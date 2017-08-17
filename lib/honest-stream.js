'use strict';
const Promise = require('honest-promise');
const BaseClass = require('./honest-stream-base');
const TimeoutError = Promise.TimeoutError;
const unassigned = Symbol();

class HonestStream extends BaseClass {
	
	static get resolve() { return undefined; }
	static get all() { return undefined; }
	static get race() { return undefined; }
	static get any() { return undefined; }
	static get settle() { return undefined; }
	static get props() { return undefined; }
	static get after() { return undefined; }
	
	static reject(x) { return new HonestStream((_, r) => { r(x); }); }
	static never() { return new HonestStream(noop); }
	static empty() { return new HonestStream(invoke); }
	static one(x) { return new HonestStream((r, _, w) => { w(x); r(); }); }
	
	static from(iterable) {
		return new HonestStream((resolve, reject, write) => {
			if (notIterable(iterable)) throw new TypeError('Expected argument to be an iterable object');
			for (const item of iterable) write(item);
			resolve();
		});
	}
	
	static every(ms) {
		let resolve, write;
		const stream = new HonestStream((r, _, w) => { resolve = r; write = w; });
		const stop = getIntervalResolver(setInterval(write, ~~ms), resolve);
		return { stream, stop };
	}
	
	static combine(...args) {
		return new HonestStream((resolve, reject, write) => {
			const streams = [];
			for (const arg of args) {
				if (notIterable(arg)) streams.push(arg);
				else streams.push(...arg);
			}
			for (const stream of streams) {
				if (stream instanceof HonestStream) stream.observe(write);
			}
			Promise.all(streams).then(resolve, reject);
		});
	}
	
	fork(count = 2) {
		const forks = new Array(assertForkCount(+count));
		const inners = new Array(forks.length);
		const assignInner = (resolve, reject, write) => inners[i++] = { resolve, reject, write };
		let i = 0;
		while (i < forks.length) forks[i] = new HonestStream(assignInner);
		observeForForks(this, inners);
		return forks;
	}
	
	map(concurrency, handler) {
		return new HonestStream((resolve, reject, write) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			this.observe(concurrency, upgrade(handler, (item) => {
				const mapped = handler(item);
				if (!Promise.isPromise(mapped)) return write(mapped);
				if (mapped instanceof HonestStream) { mapped.observe(write); return mapped; }
				return Promise.resolve(mapped).then(write);
			}));
			this.then(resolve, reject);
		});
	}
	
	forEach(concurrency, handler) {
		return new HonestStream((resolve, reject, write) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			this.observe(concurrency, upgrade(handler, (item) => {
				const defer = handler(item);
				if (!Promise.isPromise(defer)) return write(item);
				return Promise.resolve(defer).then(() => write(item));
			}));
			this.then(resolve, reject);
		});
	}
	
	filter(concurrency, handler) {
		return new HonestStream((resolve, reject, write) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			this.observe(concurrency, upgrade(handler, (item) => {
				const bool = handler(item);
				if (!Promise.isPromise(bool)) { if (bool) write(item); return; }
				return Promise.resolve(bool).then((bool) => { if (bool) write(item); });
			}));
			this.then(resolve, reject);
		});
	}
	
	distinct(equals = strictEquals) {
		return new HonestStream((resolve, reject, write) => {
			let lastItem = unassigned;
			this.observe(0, upgrade(equals, (item) => {
				if (lastItem === unassigned || !equals(lastItem, item)) write(item);
				lastItem = item;
			}));
			this.then(resolve, reject);
		});
	}

	throttle(ms) {
		return new HonestStream((resolve, reject, write) => {
			const writeAndThrottle = () => {
				timer = setTimeout(whenAvailable, delay);
				write(lastItem);
				lastItem = unassigned;
			};
			const whenAvailable = () => {
				if (timer !== undefined) {
					if (lastItem !== unassigned) writeAndThrottle();
					else timer = undefined;
				} else {
					write(lastItem);
					resolve();
				}
			};
			const delay = ~~ms;
			let lastItem;
			let timer;
			this.observe((item) => {
				lastItem = item;
				if (timer === undefined) writeAndThrottle();
			});
			this.then(() => {
				if (timer === undefined) resolve();
				else if (lastItem === unassigned) { clearTimeout(timer); resolve(); }
				else timer = undefined;
			}, (reason) => {
				clearTimeout(timer);
				reject(reason);
			});
		});
	}
	
	debounce(ms) {
		return new HonestStream((resolve, reject, write) => {
			const writeLastItem = () => {
				write(lastItem);
				lastItem = undefined;
				if (timer !== undefined) timer = undefined;
				else resolve();
			};
			const delay = ~~ms;
			let lastItem;
			let timer;
			this.observe((item) => {
				lastItem = item;
				clearTimeout(timer);
				timer = setTimeout(writeLastItem, delay);
			});
			this.then(() => {
				if (timer === undefined) resolve();
				else timer = undefined;
			}, (reason) => {
				clearTimeout(timer);
				reject(reason);
			});
		});
	}
	
	timeoutBetweenEach(ms, reason) {
		return new HonestStream((resolve, reject, write) => {
			const delay = ~~ms;
			let fail = () => {
				reject(
					reason == null ? new TimeoutError(`The stream timed out after ${delay > 0 ? delay : 0}ms`)
					: reason instanceof Error ? reason : new TimeoutError(String(reason))
				);
				fail = noop;
			};
			let timer;
			this.observe((item) => {
				if (fail !== noop) {
					clearTimeout(timer);
					timer = setTimeout(fail, delay);
					write(item);
				}
			});
			this.then(() => { clearTimeout(timer); resolve(); },
				(reason) => { clearTimeout(timer); reject(reason); });
			timer = setTimeout(fail, delay);
		});
	}
	
	reduce(handler, result) {
		return new Promise((resolve, reject) => {
			if (Promise.isPromise(result)) result = Promise.resolve(result).catchLater();
			let firstItem = true;
			const calc = (a, b) => {
				const ret = handler(a, b);
				if (!Promise.isPromise(ret)) { result = ret; return; }
				return Promise.resolve(ret).then((ret) => { result = ret; });
			};
			this.observe(1, upgrade(handler, (item) => {
				if (firstItem) {
					firstItem = false;
					if (arguments.length < 2) { result = item; return; }
					if (!(result instanceof Promise)) return calc(result, item);
					return result.then(seed => calc(seed, item));
				}
				return calc(result, item);
			}));
			this.then(() => resolve(result), reject);
		});
	}
	
	all() {
		return new Promise((resolve, reject) => {
			const result = [];
			this.observe((item) => { result.push(item); });
			this.then(() => resolve(result), reject);
		});
	}
	
	drain() {
		return new Promise((resolve, reject) => {
			this.observe(noop);
			this.then(resolve, reject);
		});
	}
}

const assertForkCount = (num) => {
	if (Number.isInteger(num) && num >= 2 && num <= 0xffffffff) return num;
	throw new TypeError('Expected fork count to be an integer between 2 and 4294967295');
};

const observeForForks = (stream, forks) => {
	const count = forks.length;
	stream.observe((item) => {
		for (let i = 0; i < count; ++i) forks[i].write(item);
	});
	stream.then(() => {
		for (let i = 0; i < count; ++i) forks[i].resolve();
	}, (reason) => {
		for (let i = 0; i < count; ++i) forks[i].reject(reason);
	});
};

const getIntervalResolver = (timer, resolve) => () => { clearInterval(timer); resolve(); };
const notIterable = x => x == null || typeof x[Symbol.iterator] !== 'function';
const upgrade = (original, wrapper) => typeof original !== 'function' ? original : wrapper;
const strictEquals = (a, b) => a === b;
const invoke = fn => fn();
const noop = () => {};

module.exports = HonestStream;
