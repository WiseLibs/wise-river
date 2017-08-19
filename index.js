'use strict';
const Promise = require('wise-promise');
const WiseRiver = require('./lib/wise-rivers');

const notIterable = x => x == null || typeof x[Symbol.iterator] !== 'function';
Object.defineProperty(Promise.prototype, 'stream', {
	writable: true,
	enumerable: false,
	configurable: true,
	value: function stream() {
		return new WiseRiver((resolve, reject, write) => {
			this.then((iterable) => {
				if (notIterable(iterable)) throw new TypeError('Expected promise to be resolved with an iterable object');
				for (const item of iterable) write(item);
				resolve();
			}).catch(reject);
		});
	}
});

Promise.River = WiseRiver;
WiseRiver.TimeoutError = Promise.TimeoutError;
WiseRiver.Cancellation = require('./lib/cancellation');
WiseRiver.Promise = Promise;

module.exports = WiseRiver;
