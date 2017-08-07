'use strict';
const Promise = require('honest-promise');
const FastQueue = require('./fast-queue');
const shared = require('./shared');
const exception = { reason: undefined };
const noop = () => {};
const handler = Symbol();
const processing = Symbol();
const concurrency = Symbol();
const flush = Symbol();
const abort = Symbol();
const canProcessItem = Symbol();
const processItem = Symbol();

// Observable is like a bare-bones HonestStream, except:
// - all written items are processed synchronously (not on next-tick)
// - written items cannot be promises
// - onclose and onabort are used to indicate termination, instead of the promise interface
// Just like HonestStream, there is concurrency control (the handler can return promises)
// and all items are queued until attachHandler() is called.
class Observable extends FastQueue {
	
	constructor(fn) {
		super(fn);
		this[handler] = undefined;
		this[processing] = 1 >>> 0;
		this[concurrency] = 1 >>> 0;
		this[flush] = flushObservable(this);
		this[abort] = ; // TODO: must be safe to invoke this (asynchronously) after the stream is closed
		// TODO: have some concept of being "closed", and don't write() or flushObservable() if closed
	}
	
	[shared.write](item) {
		if (this[canProcessItem]()) this[processItem](item);
		else super[shared.push](item);
	}
	
	[shared.attachHandler](handlerFunction, concurrencyLimit = 0) {
		if (this[handler] !== undefined) {
			if (this[handler] === noop) {
				// TODO: a valid handler was added to a closed stream
			}
			throw new TypeError('This stream already has a destination');
		}
		this[handler] = handlerFunction;
		this[concurrency] = assertPositiveInteger(+concurrencyLimit) >>> 0;
		this[flush]();
	}
	
	[shared.close]() {
		super[shared.destroy]();
		this[concurrency] = 0 >>> 0;
		this[handler] = noop;
		this[flush] = noop;
		this[abort] = noop;
	}
	
	[canProcessItem]() {
		return this[concurrency] === 0 || this[processing] !== this[concurrency];
	}
	
	[processItem](item) {
		const ret = tryCatch(this[handler], item);
		if (ret === exception) {
			this[abort](exception.reason);
		} else if (Promise.isPromise(ret)) {
			this[processing] += 1;
			Promise.resolve(ret).then(this[flush], this[abort]);
		}
	}
}

const flushObservable = (observer) => () => {
	observer[processing] -= 1;
	if (!observer[shared.isEmpty]()) {
		do { observer[processItem](observer[shared.shift]()); }
		while (observer[canProcessItem]() && !observer[shared.isEmpty]())
	}
};

const tryCatch = (fn, arg) => {
	try { return fn(arg); }
	catch (err) { exception.reason = err; return exception; }
};

const assertPositiveInteger = (num) => {
	if (Number.isInteger(num) && num >= 0 && num <= 0xffffffff) return num;
	throw new TypeError('Expected concurrency to be an integer between 0 and 4294967295');
};

module.exports = Observable;
