'use strict';
require('./lib/riverify');
const Promise = require('wise-promise');
const WiseRiver = require('./lib/wise-river');

const notIterable = x => x == null || typeof x[Symbol.iterator] !== 'function';
Object.defineProperty(Promise.prototype, 'stream', {
	writable: true,
	configurable: true,
	value: function stream() {
		return new WiseRiver((resolve, reject, write) => {
			this.then((iterable) => {
				try {
					if (notIterable(iterable)) throw new TypeError('Expected promise to be resolved with an iterable object');
					for (const item of iterable) write(item);
					resolve();
				} catch (reason) {
					reject(reason);
				}
			}, reject);
		});
	}
});

Promise.River = WiseRiver;
WiseRiver.TimeoutError = Promise.TimeoutError;
WiseRiver.NoDataError = require('./lib/no-data-error');
WiseRiver.Cancellation = require('./lib/cancellation');
WiseRiver.Promise = Promise;

module.exports = WiseRiver;
