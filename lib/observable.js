'use strict';
const Promise = require('honest-promise');
const FastQueue = require('./fast-queue');
const Cancellation = require('./cancellation');
const shared = require('./shared');
const exception = { reason: undefined };
const alreadyResolved = Promise.resolve();
const handler = Symbol();
const processing = Symbol();
const concurrency = Symbol();
const flush = Symbol();
const disposers = Symbol();
const canProcessItem = Symbol();
const processItem = Symbol();

/*
	Observable is like an HonestStreamBase, except:
		- written items cannot be promises (and therefore they are all processed synchronously)
		- a function callback is used to indicate an error, instead of the promise interface
		- closing the observable happens immediately (not deferred), and writing/processing becomes a noop
	Just like HonestStreamBase, there is concurrency control (the handler can return promises)
	and all items are queued until attachHandler() is called.
 */
class Observable extends FastQueue {
	
	constructor(fn) {
		super(fn);
		this[handler] = unassigned;
		this[processing] = 1 >>> 0;
		this[concurrency] = 1 >>> 0;
		this[flush] = flushObservable(this);
		this[shared.onabort] = noop; // ASSERT: Calling this twice must be a noop
		this[shared.onflush] = noop; // ASSERT: Calling this after onabort() must be a noop
		this[disposers] = undefined;
	}
	
	[shared.write](item) {
		if (this[canProcessItem]()) this[processItem](item);
		else super[shared.push](item);
	}
	
	[shared.attachHandler](handlerFunction, concurrencyLimit = 0) {
		if (this[handler] !== unassigned) {
			if (this[handler] === noop) shared.warn('This stream was already resolved', Observable.prototype[shared.attachHandler]);
			else shared.warn('This stream already has a destination (use .fork() instead)', Observable.prototype[shared.attachHandler]);
			return emptyDisposer;
		}
		if (this[flush] === noop) {
			this[handler] = noop;
			return emptyDisposer;
		}
		if (typeof handlerFunction !== 'function') {
			this[shared.onabort](new TypeError('Expected argument to be a function'));
			return cancelObservable(this);
		}
		concurrencyLimit = +concurrencyLimit;
		if (!isUint32(concurrencyLimit)) {
			this[shared.onabort](new TypeError('Expected concurrency to be an integer between 0 and 4294967295'));
			return cancelObservable(this);
		}
		this[handler] = handlerFunction;
		this[concurrency] = concurrencyLimit >>> 0;
		alreadyResolved.then(this[flush]);
		return cancelObservable(this);
	}
	
	[shared.close]() {
		if (this[flush] !== noop) {
			super[shared.destroy]();
			this[concurrency] = 0 >>> 0;
			if (this[handler] !== unassigned) this[handler] = noop;
			this[flush] = noop;
			this[shared.onabort] = noop;
			this[shared.onflush] = noop;
			
			const xDisposers = this[disposers];
			this[disposers] = undefined;
			if (xDisposers !== undefined) {
				if (Array.isArray(xDisposers)) {
					for (let i = xDisposers.length - 1; i >= 0; --i) tryThrow(xDisposers[i]);
				} else {
					tryThrow(xDisposers);
				}
			}
		}
	}
	
	[shared.isEmptyAndIdle]() {
		// An empty stream can be fulfilled even if a handler was never attached (because of `this[handler] === unassigned`)
		return (this[processing] === 0 || this[handler] === unassigned) && super[shared.isEmpty]();
	}
	
	[shared.use](fn) {
		// ASSERT: fn must always be a function
		if (this[flush] === noop) return tryThrow(fn);
		const currentDisposers = this[disposers];
		if (currentDisposers === undefined) this[disposers] = fn;
		else if (typeof currentDisposers === 'function') this[disposers] = [currentDisposers, fn];
		else currentDisposers.push(fn);
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

const cancelObservable = (obsv) => () => {
	if (obsv[shared.onabort] !== noop) {
		obsv[shared.onabort](new Cancellation('An upstream observer cleaned up the source stream'));
	}
};

// NOTE: This function is subject to change.
// It may be better to emit/trigger an unhandledRejection event.
const rethrow = (() => {
	const g = new Function('return this')();
	const schedule = (g != null && typeof g.setImmediate === 'function') ? g.setImmediate : fn => setTimeout(fn, 0);
	return ((schedule) => (reason) => { schedule(() => { throw reason; }); })(schedule);
})();

const tryThrow = (fn) => {
	try {
		const ret = fn();
		if (Promise.isPromise(ret)) Promise.resolve(ret).catch(rethrow);
	} catch (err) {
		rethrow(err);
	}
};

const tryCatch = (fn, arg) => {
	try { return fn(arg); }
	catch (err) { exception.reason = err; return exception; }
};

const isUint32 = (num) => {
	return Number.isInteger(num) && num >= 0 && num <= 0xffffffff;
};

const emptyDisposer = () => {};
const unassigned = () => {};
const noop = () => {};

module.exports = Observable;
