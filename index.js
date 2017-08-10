'use strict';
const Promise = require('honest-promise');
const HonestStream = require('./lib/honest-stream');

const notIterable = x => x == null || typeof x[Symbol.iterator] !== 'function';
Object.defineProperty(Promise.prototype, 'stream', {
	writable: true,
	enumerable: false,
	configurable: true,
	value: function stream() {
		return new HonestStream((resolve, reject, write) => {
			this.then((iterable) => {
				if (notIterable(iterable)) return reject(new TypeError('Expected promise to be resolved with an iterable object'));
				for (const item of iterable) write(item);
				resolve();
			}, reject);
		});
	}
});

Promise.Stream = HonestStream;
HonestStream.Promise = Promise;

module.exports = HonestStream;
