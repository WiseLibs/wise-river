'use strict';
const Promise = require('honest-promise');
const BaseClass = require('./honest-stream-base');

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
			this.observe(concurrency, upgrade(handler, (item, i) => {
				const mapped = handler(item, i);
				if (!Promise.isPromise(mapped)) return write(mapped);
				return Promise.resolve(mapped).then(write);
			}));
			this.then(resolve, reject);
		});
	}
	
	forEach(concurrency, handler) {
		return new HonestStream((resolve, reject, write) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			this.observe(concurrency, upgrade(handler, (item, i) => {
				const defer = handler(item, i);
				if (!Promise.isPromise(defer)) return write(item);
				return Promise.resolve(defer).then(() => write(item));
			}));
			this.then(resolve, reject);
		});
	}
	
	filter(concurrency, handler) {
		return new HonestStream((resolve, reject, write) => {
			if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
			this.observe(concurrency, upgrade(handler, (item, i) => {
				const bool = handler(item, i);
				if (!Promise.isPromise(bool)) { if (bool) write(item); return; }
				return Promise.resolve(bool).then((bool) => { if (bool) write(item); });
			}));
			this.then(resolve, reject);
		});
	}
	
	// reduce()
	// merge()
	// drain()
	
	// pipe()
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
