'use strict';
const Promise = require('honest-promise');
const Observable = require('./observable');
const shared = require('./shared');
const exception = { reason: undefined };

class SimpleHonestStream extends Observable {
	
	constructor(fn) {
		let xrs, xrj;
		super((rs, rj) => { xrs = rs; xrj = rj; });
		
		const superWrite = item => super[shared.write](item);
		
		const resolve = value => { xrs(value); super[shared.close](); };
		const reject = reason => { xrj(reason); super[shared.close](); };
		const write = item => { Promise.resolve(item).then(superWrite, reject); };
		
		this[shared.onabort] = reject;
		
		if (tryCatch(fn, resolve, reject, write) === exception) {
			reject(exception.reason);
		}
		
		// TODO: should resolve() delay close() until after `value` is settled?
		// TODO: should resolve() delay close() until after all items are processed?
		// OPTIMIZATION?: should items be written synchronously in some cases?
		// OPTIMIZATION?: could writing non-promise values be cheaper by using `alreadyFulfilled.then(() => superWrite(item), reject)`?
		// TODO: think about how to propagate fate backwards (close underlying resource)
	}
	
	observe(concurrency, handler) {
		if (typeof concurrency === 'function') {
			handler = arguments[0];
			concurrency = arguments[1];
		} else if (typeof handler !== 'function') {
			throw new TypeError('Expected first or second argument to be a function');
		}
		super[shared.attachHandler](handler, concurrency);
		return this;
	}
}

const tryCatch = (fn, arg1, arg2, arg3) => {
	try { fn(arg1, arg2, arg3); }
	catch (err) { exception.reason = err; return exception; }
};

module.exports = SimpleHonestStream;
