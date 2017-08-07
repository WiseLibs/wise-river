'use strict';
const Promise = require('honest-promise');
const Observer = require('./observer');
const observers = Symbol();
const resolve = Symbol();
const reject = Symbol();
const NOOP = () => {};

class HonestStream extends Promise {
	
	constructor() {
		let xrs, xrj;
		super((rs, rj) => { xrs = rs; xrj = rj; });
		this[observers] = undefined;
		this[resolve] = () => { xrs(); cleanup(); };
		this[reject] = (reason) => { xrj(reason); cleanup(); };
		const cleanup = () => {
			// TODO: propagate fate to observers
			this[observers] = [];
			this[resolve] = NOOP;
			this[reject] = NOOP;
			// TODO: think about how to propagate fate backwards (close underlying resource)
		};
	}
	
	observe(concurrency, handler) {
		if (typeof concurrency === 'function') {
			handler = arguments[0];
			concurrency = arguments[1];
		} else if (typeof handler !== 'function') {
			throw new TypeError('Expected first or second argument to be a function');
		}
		if (this[resolve] !== NOOP) {
			const obv = new Observer(handler, concurrency);
			if (this[observers] === undefined) this[observers] = obv;
			else if (!Array.isArray(this[observers])) this[observers] = [this[observers], obv];
			else this[observers].push(obv);
		}
		return this;
	}
	
	write(item) {
		if (this[resolve] !== NOOP) {
			// TODO: writeToObservers
			// TODO: should items be written synchronously in some cases?
			// TODO: should the stream be queued until it has its first observer?
			//       (probably not, because people can just use arrays for that?)
			Promise.resolve(item).then(this[writeToObservers], this[reject]);
		}
		return this;
	}
	
	end(reason) {
		// TODO: should this accept a promise?
		reason ? this[reject](reason) : this[resolve]();
		return this;
	}
}

module.exports = HonestStream;
