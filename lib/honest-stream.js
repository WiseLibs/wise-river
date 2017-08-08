'use strict';
const Promise = require('honest-promise');
const BaseClass = require('./simple-honest-stream');
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
}

module.exports = HonestStream;
