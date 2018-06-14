'use strict';
const Promise = require('wise-promise');
const WiseRiver = require('./wise-river');

WiseRiver.riverify = (streamlike, { decouple = false } = {}) => {
	if (!isObject(streamlike)) throw new TypeError('Expected argument to be an object');
	if (isNodeStream(streamlike)) {
		return new WiseRiver((resolve, reject, write, free) => {
			streamlike.addListener('end', resolve);
			streamlike.addListener('error', reject);
			streamlike.addListener('data', write);
			streamlike.addListener('close', () => reject(new Error('The stream was destroyed before finishing')));
			decouple || free(() => { streamlike.destroy(); });
		});
	}
	if (isAsyncIterable(streamlike)) {
		return new WiseRiver((resolve, reject, write, free) => {
			const iterator = streamlike[Symbol.asyncIterator]();
			Promise.resolve(iterator.next()).then(function item({ value, done }) {
				if (done) return resolve();
				write(value);
				Promise.resolve(iterator.next()).then(item, reject);
			}, reject);
			if (!decouple && typeof iterator.return === 'function') {
				free(() => Promise.resolve(iterator.return()));
			}
		});
	}
	throw new TypeError('Expected argument to be a stream or async iterable object');
};

const asyncIterator = { [Symbol.asyncIterator]() {
	throw new TypeError('not implemented');
} };

const supportsAsyncIterators = typeof Symbol.asyncIterator === 'symbol';
const isObject = x => x != null && (typeof x === 'object' || typeof x === 'function');
const isNodeStream = x => x.readable === true && typeof x.pipe === 'function' && typeof x.addListener === 'function' && typeof x.destroy === 'function';
const isAsyncIterable = x => supportsAsyncIterators && typeof x[Symbol.asyncIterator] === 'function';

if (supportsAsyncIterators) {
	Object.defineProperty(WiseRiver.prototype, Symbol.asyncIterator, {
		writable: true,
		configurable: true,
		value: asyncIterator[Symbol.asyncIterator],
	});
}
asyncIterator[Symbol.asyncIterator] = undefined;
