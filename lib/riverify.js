'use strict';
const Promise = require('wise-promise');
const WiseRiver = require('./wise-river');
const FastQueue = require('./fast-queue');
const NoDataError = require('./no-data-error');
const { push, shift, peak, destroy, isEmpty, warn } = require('./shared');

WiseRiver.riverify = (streamlike, { decouple = false } = {}) => {
	if (!isObject(streamlike)) return WiseRiver.reject(new TypeError('Expected argument to be an object'));
	if (isNodeStream(streamlike)) {
		return new WiseRiver((resolve, reject, write, free) => {
			streamlike.addListener('end', resolve);
			streamlike.addListener('error', reject);
			streamlike.addListener('data', write);
			streamlike.addListener('close', () => reject(new NoDataError('The stream was destroyed before finishing')));
			if (!decouple && typeof streamlike.destroy === 'function') {
				free(() => { streamlike.destroy(); });
			}
		});
	}
	if (isAsyncIterable(streamlike)) {
		return new WiseRiver((resolve, reject, write, free) => {
			const iterator = streamlike[Symbol.asyncIterator]();
			Promise.resolve(iterator.next()).then(function item(record) {
				try {
					if (record.done) return resolve();
					write(record.value);
					Promise.resolve(iterator.next()).then(item, reject);
				} catch (reason) {
					reject(reason);
				}
			}, reject);
			if (!decouple && typeof iterator.return === 'function') {
				free(() => {
					// If the river is not cancelled, the iterable will trigger
					// its own cleanup without taking part in the river-style
					// rethrow mechanism. Therefore, to keep the cleanup process
					// somewhat deterministic, the best we can do is report a
					// warning should the cleanup process fail.
					try { Promise.resolve(iterator.return()).catch(warn); }
					catch (reason) { warn(reason); }
				});
			}
		});
	}
	return WiseRiver.reject(new TypeError('Expected argument to be a stream or async iterable object'));
};

const asyncIterator = { [Symbol.asyncIterator]() {
	let done = false;
	let queue = new FastQueue(noop);
	const cancel = this.pump((item) => {
		if (typeof queue[peak]() === 'function') queue[shift]()(valueRecord(item));
		else queue[push](valueRecord(item));
	});
	this.then(() => {
		done = true;
		if (typeof queue[peak]() === 'function') {
			do { queue[shift]()(doneRecord()); } while (!queue[isEmpty]())
			queue[destroy]();
		}
	}, (reason) => {
		if (done) return;
		done = true;
		if (typeof queue[peak]() === 'function') {
			queue[shift]()(Promise.reject(reason));
			while (!queue[isEmpty]()) queue[shift]()(doneRecord());
			queue[destroy]();
		} else {
			queue = new FastQueue(noop);
			queue[push](Promise.reject(reason).catchLater());
		}
	});
	return {
		next() {
			if (typeof queue[peak]() === 'object') return Promise.resolve(queue[shift]());
			if (done) return (queue[destroy](), Promise.resolve(doneRecord()));
			return new Promise((resolve) => { queue[push](resolve); });
		},
		return() {
			done = true;
			if (typeof queue[peak]() === 'function') {
				do { queue[shift]()(doneRecord()); } while (!queue[isEmpty]())
			}
			queue[destroy]();
			cancel();
			return Promise.resolve(doneRecord());
		},
	};
} };

const supportsAsyncIterators = typeof Symbol.asyncIterator === 'symbol';
const isObject = x => x != null && (typeof x === 'object' || typeof x === 'function');
const isNodeStream = x => x.readable === true && typeof x.pipe === 'function' && typeof x.addListener === 'function';
const isAsyncIterable = x => supportsAsyncIterators && typeof x[Symbol.asyncIterator] === 'function';
const valueRecord = value => ({ value, done: false });
const doneRecord = () => ({ value: undefined, done: true });
const noop = () => {};

if (supportsAsyncIterators) {
	Object.defineProperty(WiseRiver.prototype, Symbol.asyncIterator, {
		writable: true,
		configurable: true,
		value: asyncIterator[Symbol.asyncIterator],
	});
}
asyncIterator[Symbol.asyncIterator] = undefined;
