'use strict';
const Promise = require('honest-promise');
const Observable = require('./observer');
const handler = Symbol();
const NOOP = () => {};
const INITIAL_NOOP = () => {};

class HonestStream extends Observable {
	
	constructor(fn) {
		let self = { [handler]: INITIAL_NOOP };
		let processOrQueueItem = (item) => {
			
		};
		super((xrs, xrj) => {
			// TODO: should self[handler] be set after `value` is settled?
			const resolve = value => { xrs(value); self[handler] = NOOP; };
			const reject = reason => { xrj(reason); self[handler] = NOOP; };
			// OPTIMIZATION?: should items be written synchronously in some cases?
			// OPTIMIZATION?: could non-promise values be cheaper by using `alreadyFulfilled.then(() => processOrQueueItem(item), reject)`?
			const write = item => { Promise.resolve(item).then(processOrQueueItem, reject); };
			fn(resolve, reject, write);
			if (self[handler] === INITIAL_NOOP) self[handler] = undefined;
		});
		this[handler] = self[handler] === INITIAL_NOOP ? NOOP : self[handler];
		self = this;
		// TODO: propagate fate to observer
		// TODO: think about how to propagate fate backwards (close underlying resource)
	}
	
	// observe(concurrency, handler) {
	// 	if (typeof concurrency === 'function') {
	// 		handler = arguments[0];
	// 		concurrency = arguments[1];
	// 	} else if (typeof handler !== 'function') {
	// 		throw new TypeError('Expected first or second argument to be a function');
	// 	}
	// 	if (this[resolve] !== NOOP) {
	// 		const obv = new Observable(handler, concurrency);
	// 		if (this[observers] === undefined) this[observers] = obv;
	// 		else if (!Array.isArray(this[observers])) this[observers] = [this[observers], obv];
	// 		else this[observers].push(obv);
	// 	}
	// 	return this;
	// }
}

module.exports = HonestStream;
