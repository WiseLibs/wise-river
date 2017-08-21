'use strict';
const Promise = require('wise-promise');
const CoObservable = require('./co-observable');
const shared = require('./shared');
const exception = { reason: undefined };

/*
	WiseRiverBase implements the low-level interface of WiseRiver.
	All other methods of WiseRiver are derived from methods in this class.
 */
class WiseRiverBase extends CoObservable {
	
	constructor(fn) {
		if (typeof fn !== 'function') throw new TypeError(`River resolver (${fn === null ? 'null' : typeof fn}) is not a function`);
		let xrs, xrj, open = true, racing = 0;
		super((rs, rj) => { xrs = rs; xrj = rj; });
		
		const reject = (reason) => { open = false; xrj(reason); super[shared.close](); };
		
		const resolve = (defer) => {
			if (open) {
				open = false;
				const close = () => {
					if (this[shared.onabort] === reject) {
						const finalize = () => {
							if (super[shared.isEmptyAndIdle]() && racing === 0) {
								xrs();
								super[shared.close]();
							}
						};
						finalize();
						if (this[shared.onabort] === reject) {
							this[shared.onflush] = finalize;
						}
					}
				};
				if (Promise.isPromise(defer)) Promise.resolve(defer).then(close, reject);
				else close();
			}
		};
		
		const superWrite = (item) => {
			racing -= 1;
			super[shared.write](item);
			this[shared.onflush]();
		};
		
		const write = (item) => {
			if (open) {
				if (Promise.isPromise(item)) {
					racing += 1;
					Promise.resolve(item).then(superWrite, reject);
				} else {
					super[shared.write](item);
				}
			} else if (Promise.isPromise(item)) {
				Promise.resolve(item).catchLater();
			}
		};
		
		const free = (fn) => {
			if (typeof fn === 'function') super[shared.use](fn);
		};
		
		this[shared.onabort] = reject;
		
		if (tryCatch(fn, resolve, reason => void(open && reject(reason)), write, free) === exception) {
			reject(exception.reason);
		}
	}
	
	pump(concurrency, handler) {
		if (typeof concurrency === 'function') { handler = arguments[0]; concurrency = arguments[1]; }
		return super[shared.attachHandler](handler, concurrency);
	}
}

const tryCatch = (fn, arg1, arg2, arg3, arg4) => {
	try { fn(arg1, arg2, arg3, arg4); }
	catch (err) { exception.reason = err; return exception; }
};

module.exports = WiseRiverBase;
