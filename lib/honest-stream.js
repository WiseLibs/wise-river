'use strict';
const Promise = require('honest-promise');
const Observer = require('./observer');
const observers = Symbol();
const resolve = Symbol();
const reject = Symbol();

class HonestStream extends Promise {
	
	constructor() {
		let xrs, xrj;
		super((rs, rj) => { xrs = rs; xrj = rj; });
		this[observers] = undefined;
		this[resolve] = xrs;
		this[reject] = xrj;
	}
	
	observe(concurrency, handler) {
		if (typeof concurrency === 'function') {
			handler = arguments[0];
			concurrency = arguments[1];
		} else if (typeof handler !== 'function') {
			throw new TypeError('Expected first or second argument to be a function');
		}
		const obv = new Observer(handler, concurrency);
		if (this[observers] === undefined) this[observers] = obv;
		else if (!Array.isArray(this[observers])) this[observers] = [this[observers], obv];
		else this[observers].push(obv);
	}
	
	write(item) {
		if (Promise.isPromise(item)) Promise.resolve(item).then(this[writeToObservers], this[error]);
		else this[writeToObservers](item);
		return this;
	}
}

module.exports = HonestStream;
