'use strict';
const Promise = require('honest-promise');
const BaseClass = require('./honest-stream-base');
const notIterable = x => x == null || typeof x[Symbol.iterator] !== 'function';

class HonestStream extends BaseClass {
	
	static from(iterable) {
		return new HonestStream((resolve, reject, write) => {
			if (notIterable(iterable)) throw new TypeError('Expected argument to be an iterable object');
			for (const item of iterable) write(item);
			resolve();
		});
	}
	
	// static zip/combine()
	
	fork(count = 2) {
		const forks = new Array(assertForkCount(+count));
		const inners = new Array(forks.length);
		const assignInner = (resolve, reject, write) => inners[i++] = { resolve, reject, write };
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
