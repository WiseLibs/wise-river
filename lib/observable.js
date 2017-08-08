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
// - all written items are processed synchronously (not on next-tick)
// - written items cannot be promises
// - a function callback is used to indicate an error, instead of the promise interface
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
		this[shared.onempty] = noop;
	}
	
	[shared.write](item) {
		if (this[canProcessItem]()) this[processItem](item);
		else super[shared.push](item);
	}
	
	[shared.attachHandler](handlerFunction, concurrencyLimit = 0) {
		if (this[handler] !== unassigned) {
			if (this[handler] === noop) throw new TypeError('This stream was already resolved');
			throw new TypeError('This stream already has a destination');
		}
		if (this[flush] === noop) {
			this[handler] = noop;
			return;
		}
		this[handler] = handlerFunction; // ASSERT: this must always be a function
		this[concurrency] = assertConcurrency(+concurrencyLimit) >>> 0;
		this[flush]();
	}
	
	[shared.close]() {
		if (this[flush] !== noop) {
			super[shared.destroy]();
			this[concurrency] = 0 >>> 0;
			if (this[handler] !== unassigned) this[handler] = noop;
			this[flush] = noop;
			this[shared.onabort] = noop;
			this[shared.onempty] = noop;
		}
	}
	
	[shared.isEmptyAndIdle]() {
		return this[processing] === 0 && super[shared.isEmpty]();
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
	if (obsv[shared.isEmptyAndIdle]()) {
		obsv[shared.onempty]();
	}
};

const tryCatch = (fn, arg) => {
	try { return fn(arg); }
	catch (err) { exception.reason = err; return exception; }
};

const assertConcurrency = (num) => {
	if (Number.isInteger(num) && num >= 0 && num <= 0xffffffff) return num;
	throw new TypeError('Expected concurrency to be an integer between 0 and 4294967295');
};

module.exports = Observable;
