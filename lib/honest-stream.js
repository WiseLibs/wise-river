'use strict';
const Promise = require('honest-promise');
const BaseClass = require('./honest-stream-base');
const noop = () => {};

class HonestStream extends BaseClass {
	
	static from(iterable) {
		return new HonestStream((resolve, reject, write) => {
			if (notIterable(iterable)) throw new TypeError('Expected argument to be an iterable object');
			for (const item of iterable) write(item);
			resolve();
		});
	}
	
	static combine(...args) {
		return new HonestStream((resolve, reject, write) => {
			const streams = [];
			for (const arg of args) {
				if (notIterable(arg)) streams.push(arg);
				else streams.push(...arg);
			}
			for (const stream of streams) {
				if (isHonestStream(stream)) stream.observe(write);
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
	
	merge() {
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

const notIterable = x => x == null || typeof x[Symbol.iterator] !== 'function';
const isHonestStream = x => x instanceof HonestStream;
const upgrade = (original, wrapper) => typeof original !== 'function' ? original : wrapper;

module.exports = HonestStream;
