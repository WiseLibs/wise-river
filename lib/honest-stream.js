'use strict';
// const Promise = require('honest-promise');
const BaseClass = require('./honest-stream-base');
// const shared = require('./shared');
const notIterable = x => x == null || typeof x[Symbol.iterator] !== 'function';

class HonestStream extends BaseClass {
	
	static from(iterable) {
		return new HonestStream((resolve, reject, write) => {
			if (notIterable(iterable)) throw new TypeError('Expected argument to be an iterable object');
			for (const item of iterable) write(item);
			resolve();
		});
	}
	
	fork(count = 2) {
		// const forks = new Array(assertForkCount(+count));
		// for (let i = 0; i < forks.length; ++i) forks[i] = 
		// return forks;
	}
}

// const assertForkCount = (num) => {
// 	if (Number.isInteger(num) && num >= 2 && num <= 0xffffffff) return num;
// 	throw new TypeError('Expected fork count to be an integer between 2 and 4294967295');
// };

module.exports = HonestStream;
