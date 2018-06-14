'use strict';
const Promise = require('wise-promise');
const BaseClass = require('./wise-river-base');
const NoDataError = require('./no-data-error');
const privateSymbol = require('./shared').onabort;
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
				if (WiseRiver.isRiver(river)) free(river.pump(write));
			}
			Promise.all(rivers).then(resolve, reject);
		});
	}
	
	static isRiver(value) {
		return value != null && hasOwnProperty.call(value, privateSymbol);
	}
	
	fork(count = 2) {
		const forks = new Array(assertCount(+count));
		const inners = new Array(forks.length);
		const cancel = cancelForForks(forks.length, pumpForForks(this, inners));
		const assignInner = (resolve, reject, write, free) => {
			inners[i] = { resolve, reject, write };
			free(cancel);
		};
		let i = 0;
		for (let len = forks.length; i < len; ++i) forks[i] = new WiseRiver(assignInner);
		return forks;
	}
	
	map(concurrency, handler) {
		return new WiseRiver((resolve, reject, write, free) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			free(this.pump(concurrency, upgrade(handler, (item) => {
				const mapped = handler(item);
				if (!Promise.isPromise(mapped)) return write(mapped);
				if (WiseRiver.isRiver(mapped)) { free(mapped.pump(write)); return mapped; }
				return Promise.resolve(mapped).then(write);
			})));
			this.then(resolve, reject);
		});
	}
	
	forEach(concurrency, handler) {
		return new WiseRiver((resolve, reject, write, free) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			free(this.pump(concurrency, upgrade(handler, (item) => {
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
			free(this.pump(concurrency, upgrade(handler, (item) => {
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
			free(this.pump(0, upgrade(equals, (item) => {
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
			free(this.pump((item) => {
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
			free(this.pump((item) => {
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
			free(this.pump((item) => {
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
	
	while(concurrency, handler) {
		return new WiseRiver((resolve, reject, write, free) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			const cancel = this.pump(concurrency, upgrade(handler, (item) => {
				const bool = handler(item);
				if (!Promise.isPromise(bool)) {
					if (bool) write(item);
					else { resolve(); cancel(); }
					return;
				}
				return Promise.resolve(bool).then((bool) => {
					if (bool) write(item);
					else { resolve(); cancel(); }
				});
			}));
			free(cancel);
			this.then(resolve, reject);
		});
	}
	
	until(promise) {
		return new WiseRiver((resolve, reject, write, free) => {
			const cancel = this.pump(write);
			const finish = () => { resolve(); cancel(); };
			free(cancel);
			Promise.resolve(promise).then(finish, reject);
			this.then(finish, reject);
		});
	}
	
	decouple() {
		return new WiseRiver((resolve, reject, write) => {
			this.pump(write);
			this.then(resolve, reject);
		});
	}
	
	consume(concurrency, handler) {
		return new Promise((resolve, reject) => {
			this.pump(concurrency, handler);
			this.then(resolve, reject);
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
			this.pump(1, upgrade(handler, (item) => {
				if (firstItem) {
					firstItem = false;
					if (arguments.length < 2) { result = item; return; }
					if (!(result instanceof Promise)) return calc(result, item);
					return result.then(seed => calc(seed, item));
				}
				return calc(result, item);
			}));
			this.then(() => {
				if (!firstItem || arguments.length >= 2) resolve(result);
				else reject(new NoDataError('Cannot reduce an empty river with no initial value'));
			}, reject);
		});
	}
	
	all() {
		return new Promise((resolve, reject) => {
			const result = [];
			this.pump((item) => { result.push(item); });
			this.then(() => resolve(result), reject);
		});
	}
	
	find(concurrency, handler) {
		return new Promise((resolve, reject) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			const cancel = this.pump(concurrency, upgrade(handler, (item) => {
				const bool = handler(item);
				if (!Promise.isPromise(bool)) {
					if (bool) { resolve(item); cancel(); }
					return;
				}
				return Promise.resolve(bool).then((bool) => {
					if (bool) { resolve(item); cancel(); }
				});
			}));
			this.then(() => reject(new NoDataError('No matching data found in the river')), reject);
		});
	}
	
	includes(value, equals = strictEquals) {
		return new Promise((resolve, reject) => {
			const search = (value) => {
				const cancel = this.pump(0, upgrade(equals, (item) => {
					if (equals(value, item)) { resolve(true); cancel(); }
				}));
				this.then(() => resolve(false), reject);
			};
			if (Promise.isPromise(value)) Promise.resolve(value).then(search, reject);
			else search(value);
		});
	}
	
	first(count) {
		return new Promise((resolve, reject) => {
			if (arguments.length === 0) {
				const cancel = this.pump((item) => { resolve(item); cancel(); });
				this.then(() => reject(new NoDataError('The river never received any data')), reject);
			} else {
				let length = 0;
				const cancel = this.pump((item) => {
					result[length] = item;
					if (++length === result.length) { resolve(result); cancel(); }
				});
				this.then(() => resolve(result.slice(0, length)), reject);
				const result = new Array(assertCount(+count));
			}
		});
	}
	
	last(count) {
		return new Promise((resolve, reject) => {
			if (arguments.length === 0) {
				let lastItem = unassigned;
				this.pump((item) => { lastItem = item; });
				this.then(() => {
					if (lastItem === unassigned) reject(new NoDataError('The river never received any data'));
					else resolve(lastItem);
				}, reject);
			} else {
				let start = 0;
				let length = 0;
				this.pump((item) => {
					if (length === arr.length) {
						arr[start] = item;
						start += 1;
						if (start === length) start = 0;
					} else {
						arr[length] = item;
						length += 1;
					}
				});
				this.then(() => {
					if (start === 0) {
						if (length === arr.length) resolve(arr);
						else resolve(arr.slice(0, length));
						return;
					}
					const result = new Array(length);
					const len = length - start;
					for (let i = 0; i < len; ++i) result[i] = arr[i + start];
					for (let i = len; i < length; ++i) result[i] = arr[i - len];
					resolve(result);
				}, reject);
				const arr = new Array(assertCount(+count));
			}
		});
	}
	
	drain() {
		return this.consume(noop);
	}
	
	drop() {
		return this.pump(noop)();
	}
	
	stream() {
		return this;
	}
}

const assertCount = (num) => {
	if (Number.isInteger(num) && num >= 1 && num <= 0xffffffff) return num;
	throw new TypeError('Expected count to be an integer between 1 and 4294967295');
};

const pumpForForks = (river, forks) => {
	const count = forks.length;
	river.then(() => {
		for (let i = 0; i < count; ++i) forks[i].resolve();
	}, (reason) => {
		for (let i = 0; i < count; ++i) forks[i].reject(reason);
	});
	return river.pump((item) => {
		for (let i = 0; i < count; ++i) forks[i].write(item);
	});
};

const cancelForForks = (count, cancel) => {
	let i = 0;
	return () => { if (++i === count) cancel(); };
};

const { hasOwnProperty } = Object.prototype;
const notIterable = x => x == null || typeof x[Symbol.iterator] !== 'function';
const upgrade = (original, wrapper) => typeof original !== 'function' ? original : wrapper;
const strictEquals = (a, b) => a === b;
const invoke = fn => fn();
const noop = () => {};

module.exports = WiseRiver;
