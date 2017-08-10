'use strict';
const Promise = require('honest-promise');
const FastQueue = require('./fast-queue');
const shared = require('./shared');
const exception = { reason: undefined };
const unassigned = () => {};
const noop = () => {};
const handler = Symbol();
const processing = Symbol();
const concurrency = Symbol();
const flush = Symbol();
const canProcessItem = Symbol();
const processItem = Symbol();

// Observable is like a HonestStreamBase, except:
// - written items cannot be promises (and therefore they are all processed synchronously)
// - a function callback is used to indicate an error, instead of the promise interface
// - closing the observable happens immediately (not deferred), and writing/processing becomes a noop
// Just like HonestStreamBase, there is concurrency control (the handler can return promises)
// and all items are queued until attachHandler() is called.
class Observable extends FastQueue {
	
	constructor(fn) {
		super(fn);
		this[handler] = unassigned;
		this[processing] = 1 >>> 0;
		this[concurrency] = 1 >>> 0;
		this[flush] = flushObservable(this);
		this[shared.onabort] = noop; // ASSERT: Calling this twice must be a noop
		this[shared.onflush] = noop; // ASSERT: Calling this after onabort() must be a noop
	}
	
	[shared.write](item) {
		if (this[canProcessItem]()) this[processItem](item);
		else super[shared.push](item);
	}
	
	[shared.attachHandler](handlerFunction, concurrencyLimit = 0) {
		if (this[handler] !== unassigned) {
			if (this[handler] === noop) shared.warn('This stream was already resolved', Observable.prototype[shared.attachHandler]);
			else shared.warn('This stream already has a destination (use .fork() instead)', Observable.prototype[shared.attachHandler]);
			return;
		}
		if (this[flush] === noop) {
			this[handler] = noop;
			return;
		}
		if (typeof handlerFunction !== 'function') {
			this[shared.onabort](new TypeError('Expected argument to be a function'));
			return;
		}
		concurrencyLimit = +concurrencyLimit;
		if (!isUint32(concurrencyLimit)) {
			this[shared.onabort](new TypeError('Expected concurrency to be an integer between 0 and 4294967295'));
			return;
		}
		this[handler] = handlerFunction;
		this[concurrency] = concurrencyLimit >>> 0;
		this[flush]();
	}
	
	[shared.close]() {
		if (this[flush] !== noop) {
			super[shared.destroy]();
			this[concurrency] = 0 >>> 0;
			if (this[handler] !== unassigned) this[handler] = noop;
			this[flush] = noop;
			this[shared.onabort] = noop;
			this[shared.onflush] = noop;
		}
	}
	
	[shared.isEmptyAndIdle]() {
		// An empty stream can be fulfilled even if a handler was never attached (because of `this[handler] === unassigned`)
		return (this[processing] === 0 || this[handler] === unassigned) && super[shared.isEmpty]();
	}
	
	[canProcessItem]() {
		return this[concurrency] === 0 || this[processing] !== this[concurrency];
	}
	
	[processItem](item) {
		const ret = tryCatch(this[handler], item);
		if (ret === exception) {
			this[shared.onabort](exception.reason);
		} else if (Promise.isPromise(ret)) {
			this[processing] += 1;
			Promise.resolve(ret).then(this[flush], this[shared.onabort]);
		}
	}
}

const flushObservable = (obsv) => () => {
	obsv[processing] -= 1;
	if (!obsv[shared.isEmpty]()) {
		do { obsv[processItem](obsv[shared.shift]()); }
		while (obsv[canProcessItem]() && !obsv[shared.isEmpty]())
	}
	obsv[shared.onflush]();
};

const tryCatch = (fn, arg) => {
	try { return fn(arg); }
	catch (err) { exception.reason = err; return exception; }
};

const isUint32 = (num) => {
	return Number.isInteger(num) && num >= 0 && num <= 0xffffffff;
};

module.exports = Observable;
