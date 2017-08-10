'use strict';
const Promise = require('honest-promise');
const Observable = require('./observable');
const shared = require('./shared');
const exception = { reason: undefined };
const resolved = Promise.resolve();
const noop = () => {};

class HonestStreamBase extends Observable {
	
	constructor(fn) {
		let xrs, xrj, open = true, racing = 0;
		super((rs, rj) => { xrs = rs; xrj = rj; });
		
		const reject = reason => { open = false; xrj(reason); super[shared.close](); };
		
		const resolve = (defer) => {
			if (open) {
				open = false;
				const close = () => {
					if (this[shared.onabort] !== reject) return;
					this[shared.onflush] = () => {
						if (super[shared.isEmptyAndIdle]() && racing === 0) {
							xrs();
							super[shared.close]();
						}
					};
					this[shared.onflush]();
				};
				if (Promise.isPromise(defer)) Promise.resolve(defer).then(close, reject);
				else close();
			}
		};
		
		const write = (() => {
			if (fn === shared.useSync) {
				return (item) => { if (open) super[shared.write](item); };
			} else {
				const superWrite = (item) => {
					racing -= 1;
					super[shared.write](item);
					this[shared.onflush]();
				};
				return (item) => {
					if (open) {
						racing += 1;
						if (Promise.isPromise(item)) Promise.resolve(item).then(superWrite, reject);
						else resolved.then(() => superWrite(item));
					} else if (Promise.isPromise(item)) {
						Promise.resolve(item).then(undefined, noop);
					}
				};
			}
		})();
		
		this[shared.onabort] = reject;
		
		if (tryCatch(fn, resolve, reject, write) === exception) {
			reject(exception.reason);
		}
	}
	
	observe(concurrency, handler) {
		if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
		super[shared.attachHandler](handler, concurrency);
		return this;
	}
}

const tryCatch = (fn, arg1, arg2, arg3) => {
	try { fn(arg1, arg2, arg3); }
	catch (err) { exception.reason = err; return exception; }
};

module.exports = HonestStreamBase;
