'use strict';
const Promise = require('honest-promise');
const BaseClass = require('./honest-stream-base');
const shared = require('./shared');
const notIterable = x => x == null || typeof x[Symbol.iterator] !== 'function';

class HonestStream extends BaseClass {
	
	static from(iterable) {
		return new HonestStream((resolve, reject, write) => {
			if (notIterable(iterable)) throw new TypeError('Expected argument to be an iterable object');
			for (const item of iterable) write(item);
			resolve();
		});
	}
	
	static combine(...args) {
		return new HonestStream(shared.sync((resolve, reject, write) => {
			const streams = [];
			for (const arg of args) {
				if (notIterable(arg)) streams.push(arg);
				else streams.push(...arg);
			}
			if (streams.length === 0) return resolve();
			if (!streams.every(s => s instanceof HonestStream)) throw new TypeError('Expected each argument to be an HonestStream of an array of such');
			for (const stream of streams) stream.observe(write);
			Promise.all(streams).then(resolve, reject);
		}));
	}
	
	fork(count = 2) {
		const forks = new Array(assertForkCount(+count));
		const inners = new Array(forks.length);
		const assignInner = shared.sync((resolve, reject, write) => inners[i++] = { resolve, reject, write });
		let i = 0;
		while (i < forks.length) forks[i] = new HonestStream(assignInner);
		observeForForks(this, inners);
		return forks;
	}
	
	// map()
	// forEach()
	// filter()
	
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

module.exports = HonestStream;
