'use strict';
const Promise = require('wise-promise');
const BaseClass = require('./wise-river-base');
const TimeoutError = Promise.TimeoutError;
const unassigned = Symbol();

class WiseRiver extends BaseClass {
	
	static get resolve() { return undefined; }
	static get all() { return undefined; }
	static get race() { return undefined; }
	static get any() { return undefined; }
	static get settle() { return undefined; }
	static get props() { return undefined; }
	static get after() { return undefined; }
	
	static reject(x) { return new WiseRiver((_, r) => { r(x); }); }
	static never() { return new WiseRiver(noop); }
	static empty() { return new WiseRiver(invoke); }
	static one(x) { return new WiseRiver((r, _, w) => { w(x); r(); }); }
	
	static from(iterable) {
		return new WiseRiver((resolve, reject, write) => {
			if (notIterable(iterable)) throw new TypeError('Expected argument to be an iterable object');
			for (const item of iterable) write(item);
			resolve();
		});
	}
	
	static every(ms) {
		return new WiseRiver((resolve, reject, write, free) => {
			const timer = setInterval(write, ~~ms);
			free(() => { clearInterval(timer); });
		});
	}
	
	static combine(...args) {
		return new WiseRiver((resolve, reject, write, free) => {
			const rivers = [];
			for (const arg of args) {
				if (notIterable(arg)) rivers.push(arg);
				else rivers.push(...arg);
			}
			for (const river of rivers) {
				if (river instanceof WiseRiver) free(river.observe(write));
			}
			Promise.all(rivers).then(resolve, reject);
		});
	}
	
	fork(count = 2) {
		const forks = new Array(assertForkCount(+count));
		const inners = new Array(forks.length);
		const cleanup = cleanupForForks(forks.length, observeForForks(this, inners));
		const assignInner = (resolve, reject, write, free) => {
			inners[i] = { resolve, reject, write };
			free(cleanup);
		};
		let i = 0;
		for (let len = forks.length; i < len; ++i) forks[i] = new WiseRiver(assignInner);
		return forks;
	}
	
	map(concurrency, handler) {
		return new WiseRiver((resolve, reject, write, free) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			free(this.observe(concurrency, upgrade(handler, (item) => {
				const mapped = handler(item);
				if (!Promise.isPromise(mapped)) return write(mapped);
				if (mapped instanceof WiseRiver) { free(mapped.observe(write)); return mapped; }
				return Promise.resolve(mapped).then(write);
			})));
			this.then(resolve, reject);
		});
	}
	
	forEach(concurrency, handler) {
		return new WiseRiver((resolve, reject, write, free) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			free(this.observe(concurrency, upgrade(handler, (item) => {
				const defer = handler(item);
				if (!Promise.isPromise(defer)) return write(item);
				return Promise.resolve(defer).then(() => write(item));
			})));
			this.then(resolve, reject);
		});
	}
	
	filter(concurrency, handler) {
		return new WiseRiver((resolve, reject, write, free) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			free(this.observe(concurrency, upgrade(handler, (item) => {
				const bool = handler(item);
				if (!Promise.isPromise(bool)) { if (bool) write(item); return; }
				return Promise.resolve(bool).then((bool) => { if (bool) write(item); });
			})));
			this.then(resolve, reject);
		});
	}
	
	distinct(equals = strictEquals) {
		return new WiseRiver((resolve, reject, write, free) => {
			let lastItem = unassigned;
			free(this.observe(0, upgrade(equals, (item) => {
				if (lastItem === unassigned || !equals(lastItem, item)) write(item);
				lastItem = item;
			})));
			this.then(resolve, reject);
		});
	}
	
	throttle(ms) {
		return new WiseRiver((resolve, reject, write, free) => {
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
			free(this.observe((item) => {
				lastItem = item;
				if (timer === undefined) writeAndThrottle();
			}));
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
		return new WiseRiver((resolve, reject, write, free) => {
			const writeLastItem = () => {
				write(lastItem);
				lastItem = undefined;
				if (timer !== undefined) timer = undefined;
				else resolve();
			};
			const delay = ~~ms;
			let lastItem;
			let timer;
			free(this.observe((item) => {
				lastItem = item;
				clearTimeout(timer);
				timer = setTimeout(writeLastItem, delay);
			}));
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
		return new WiseRiver((resolve, reject, write, free) => {
			const delay = ~~ms;
			let fail = () => {
				reject(
					reason == null ? new TimeoutError(`The river timed out after ${delay > 0 ? delay : 0}ms`)
					: reason instanceof Error ? reason : new TimeoutError(String(reason))
				);
				fail = noop;
			};
			let timer;
			free(this.observe((item) => {
				if (fail !== noop) {
					clearTimeout(timer);
					timer = setTimeout(fail, delay);
					write(item);
				}
			}));
			this.then(() => { clearTimeout(timer); resolve(); },
				(reason) => { clearTimeout(timer); reject(reason); });
			timer = setTimeout(fail, delay);
		});
	}
	
	consume(concurrency, handler) {
		return new Promise((resolve, reject) => {
			const cleanup = this.observe(concurrency, handler);
			this.then(() => { resolve(); cleanup(); },
				(reason) => { reject(reason); cleanup(); });
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
			const cleanup = this.observe(1, upgrade(handler, (item) => {
				if (firstItem) {
					firstItem = false;
					if (arguments.length < 2) { result = item; return; }
					if (!(result instanceof Promise)) return calc(result, item);
					return result.then(seed => calc(seed, item));
				}
				return calc(result, item);
			}));
			this.then(() => { resolve(result); cleanup(); },
				(reason) => { reject(reason); cleanup(); });
		});
	}
	
	all() {
		return new Promise((resolve, reject) => {
			const result = [];
			const cleanup = this.observe((item) => { result.push(item); });
			this.then(() => { resolve(result); cleanup(); },
				(reason) => { reject(reason); cleanup(); });
		});
	}
	
	drain() {
		return consume(noop);
	}
	
	stream() {
		return this;
	}
}

const assertForkCount = (num) => {
	if (Number.isInteger(num) && num >= 2 && num <= 0xffffffff) return num;
	throw new TypeError('Expected fork count to be an integer between 2 and 4294967295');
};

const observeForForks = (river, forks) => {
	const count = forks.length;
	river.then(() => {
		for (let i = 0; i < count; ++i) forks[i].resolve();
	}, (reason) => {
		for (let i = 0; i < count; ++i) forks[i].reject(reason);
	});
	return river.observe((item) => {
		for (let i = 0; i < count; ++i) forks[i].write(item);
	});
};

const cleanupForForks = (count, cleanup) => {
	let i = 0;
	return () => { if (++i === count) cleanup(); };
};

const notIterable = x => x == null || typeof x[Symbol.iterator] !== 'function';
const upgrade = (original, wrapper) => typeof original !== 'function' ? original : wrapper;
const strictEquals = (a, b) => a === b;
const invoke = fn => fn();
const noop = () => {};

module.exports = WiseRiver;
