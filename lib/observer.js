'use strict';
const Promise = require('honest-promise');
const FastQueue = require('./fast-queue');
const exception = { reason: undefined };

class Observer extends FastQueue {
	
	constructor(handlerFunction, concurrencyLimit = 0) {
		super();
		this.handler = handlerFunction;
		this.processing = 0 >>> 0;
		this.concurrency = assertPositiveInteger(+concurrencyLimit) >>> 0;
		this.flush = () => flushObserver(this);
		this.error = (reason) => {
			// TODO
		};
		// TODO: have some concept of being "closed", and don't write() or flushObserver() if closed
	}
	
	write(item) {
		if (this.concurrency !== 0 && this.processing === this.concurrency) super.push(item);
		else this.processItem(item);
	}
	
	processItem(item) {
		const ret = tryCatch(this.handler, item);
		if (ret === exception) {
			this.error(exception.reason);
		} else if (Promise.isPromise(ret)) {
			this.processing += 1;
			Promise.resolve(ret).then(this.flush, this.error);
		}
	}
}

const flushObserver = (observer) => {
	observer.processing -= 1;
	if (!observer.isEmpty()) {
		do { observer.processItem(observer.shift()); }
		while (observer.processing !== observer.concurrency && !observer.isEmpty())
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

module.exports = Observer;
