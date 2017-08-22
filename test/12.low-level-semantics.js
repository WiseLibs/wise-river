'use strict';
const { expect } = require('chai');
const River = require('../.');

const alphabetResolver = ((resolve, _, write) => {
	setTimeout(() => { write('f'); resolve(); }, 5);
	setImmediate(() => write('e'));
	Promise.resolve().then(() => write('d'));
	process.nextTick(() => write('c'));
	write('a');
	write('b');
});

describe('Low-level semantics (constructor and .pump())', function () {
	it('should be a noop if the river is already resolved', function () {
		const err = new Error('foobar');
		const r1 = new River((r) => r());
		const r2 = new River((_, r) => r(err));
		expect(r1.pump()).to.be.a('function');
		expect(r2.pump()).to.be.a('function');
		return expect(Promise.all([r1, r2.catch(x => x)])).to.become([undefined, err]);
	});
	it('should reject the river if a function is not given', function () {
		const pumped = (a, b) => { const r = new River(() => {}); expect(r.pump(a, b)).to.be.a('function'); return r; }
		return Promise.all([
			expect(pumped()).to.be.rejectedWith(TypeError),
			expect(pumped(123)).to.be.rejectedWith(TypeError),
			expect(pumped(undefined, 123)).to.be.rejectedWith(TypeError),
			expect(pumped(123, 123)).to.be.rejectedWith(TypeError),
			expect(pumped(123, {})).to.be.rejectedWith(TypeError)
		]);
	});
	it('should reject the river if an invalid concurrency value is given', function () {
		const pumped = (a, b) => { const r = new River(() => {});  expect(r.pump(a, b)).to.be.a('function'); return r; }
		return Promise.all([
			expect(pumped(-1, () => {})).to.be.rejectedWith(TypeError),
			expect(pumped(1.000001, () => {})).to.be.rejectedWith(TypeError),
			expect(pumped(0xffffffff + 1, () => {})).to.be.rejectedWith(TypeError),
			expect(pumped(Infinity, () => {})).to.be.rejectedWith(TypeError),
			expect(pumped(NaN, () => {})).to.be.rejectedWith(TypeError),
			expect(pumped('1foo', () => {})).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, -1)).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, 1.000001)).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, 0xffffffff + 1)).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, Infinity)).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, NaN)).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, '1foo')).to.be.rejectedWith(TypeError)
		]);
	});
	it('should return a function that will cancel the river', function () {
		const err = new Error('foobar');
		const cancelled = (fn) => { const r = new River(fn); r.pump(() => {})(); return r; }
		return Promise.all([
			expect(cancelled(() => {})).to.be.rejectedWith(River.Cancellation),
			expect(cancelled((_, r) => r(err))).to.be.rejectedWith(err),
			expect(cancelled((r) => r())).to.become(undefined)
		]);
	});
	it('should feed written items into the registered handler, in order', function () {
		const river = new River(alphabetResolver);
		let str = '';
		expect(river.pump(item => str += item)).to.be.a('function');
		return expect(river.then(() => str)).to.become('abcdef');
	});
	it('should emit a warning and return a noop function if called more than once', function () {
		let warnings = 0;
		const onWarning = () => { warnings += 1; };
		process.on('warning', onWarning);
		const err = new Error('foobar');
		const pumped = (a, b, c, d) => { const r = new River((r) => setImmediate(r)); expect(r.pump(a, b)).to.be.a('function'); r.pump(c, d)(); return r; }
		const cancelled = (fn) => { const r = new River(fn); expect(r.pump(() => {})).to.be.a('function'); r.pump(() => {})(); return r; }
		return Promise.all([
			expect(cancelled((r) => setImmediate(r))).to.become(undefined),
			expect(cancelled((_, r) => setImmediate(r, err))).to.be.rejectedWith(err),
			expect(cancelled(() => {}).timeout(50)).to.be.rejectedWith(River.TimeoutError),
			expect(pumped(undefined, undefined, 0, () => {})).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, 0, undefined, undefined)).to.become(undefined),
			expect(pumped(0, () => {}, 123, 123)).to.become(undefined),
		]).then(() => {
			process.removeListener('warning', onWarning);
			expect(warnings).to.equal(6);
		}, (reason) => {
			process.removeListener('warning', onWarning);
			throw reason;
		});
	});
	it('should not feed written items into handlers after the first', function () {
		const river = new River(alphabetResolver);
		let str1 = '';
		let str2 = '';
		expect(river.pump(item => str1 = str1 + item)).to.be.a('function');
		river.pump(item => str2 = str2 + item)(/* no-op cancellation attempt */);
		return Promise.all([
			expect(river.then(() => str1)).to.become('abcdef'),
			expect(river.then(() => str2)).to.become('')
		]);
	});
	it('should not invoke the handler synchronously after registering it', function (done) {
		const river = new River((_, __, write) => { write('a'); write('b'); write('c'); });
		let str = '';
		expect(river.pump(item => str += item)).to.be.a('function');
		expect(str).to.equal('');
		Promise.resolve().then(() => {
			if (str === 'abc') done();
			else done(new Error(`Expected str to equal "abc", but it was "${str}"`));
		});
	});
	it('should write non-promise values synchronously', function () {
		let num = 0;
		const river = new River((resolve, _, write) => { setImmediate(() => {
			num += 1;
			write(1);
			num += 5;
			write(6);
			num += 101;
			write(107);
			resolve();
			num = 'foobar';
		}); });
		expect(river.pump((expected) => {
			expect(num).to.equal(expected);
		})).to.be.a('function');
		return expect(river.then(() => num)).to.become('foobar');
	});
	it('should treat write(promise) and promise.then(write) the same', function () {
		const afterWriting = (...args) => {
			const river = new River((resolve, _, write) => {
				let last;
				for (const arg of args) last = arg(write) || last;
				if (last) last.then(resolve);
				else resolve();
			});
			let str = '';
			expect(river.pump(item => str += item)).to.be.a('function');
			return river.then(() => str);
		};
		const direct = (arg) => (write) => write(Promise.resolve(arg));
		const indirect = (arg) => (write) => Promise.resolve(arg).then(write);
		return Promise.all([
			expect(afterWriting(direct('a'), direct('b'), direct('c'))).to.become('abc'),
			expect(afterWriting(indirect('a'), direct('b'), direct('c'))).to.become('abc'),
			expect(afterWriting(direct('a'), indirect('b'), direct('c'))).to.become('abc'),
			expect(afterWriting(direct('a'), direct('b'), indirect('c'))).to.become('abc'),
			expect(afterWriting(indirect('a'), indirect('b'), direct('c'))).to.become('abc'),
			expect(afterWriting(indirect('a'), direct('b'), indirect('c'))).to.become('abc'),
			expect(afterWriting(direct('a'), indirect('b'), indirect('c'))).to.become('abc'),
			expect(afterWriting(indirect('a'), indirect('b'), indirect('c'))).to.become('abc')
		]);
	});
	it('should respect a given concurrency value', function () {
		const fn = Symbol();
		const concurrencyTest = (max, args) => {
			const river = new River((resolve, _, write) => {
				write('a'); write('b'); write('c'); write('d'); write('e'); write('f'); write('g'); resolve();
			});
			let processing = 0;
			let reachedMax = false;
			let str = '';
			if (args.includes(fn)) {
				args[args.indexOf(fn)] = (item) => {
					processing += 1;
					expect(processing).to.be.lte(max);
					if (processing === max) reachedMax = true;
					return new Promise(r => setTimeout(r, 2)).then(() => { str += item; processing -= 1; });
				};
			}
			river.pump(...args);
			return river.then(() => { expect(reachedMax).to.equal(max <= 7); }).then(() => str);
		};
		return Promise.all([
			expect(concurrencyTest(8, [() => {}])).to.become(''),
			expect(concurrencyTest(8, [fn])).to.become('abcdefg'),
			expect(concurrencyTest(8, [0, fn])).to.become('abcdefg'),
			expect(concurrencyTest(8, [fn, 0])).to.become('abcdefg'),
			expect(concurrencyTest(5, [5, fn])).to.become('abcdefg'),
			expect(concurrencyTest(5, [fn, 5])).to.become('abcdefg'),
			expect(concurrencyTest(2, [fn, 2])).to.become('abcdefg'),
			expect(concurrencyTest(2, [2, fn])).to.become('abcdefg'),
			expect(concurrencyTest(1, [1, fn])).to.become('abcdefg'),
			expect(concurrencyTest(1, [fn, 1])).to.become('abcdefg')
		]);
	});
	it('should not fulfill the river until processing and racing is done', function () {
		const river1 = new River((resolve, _, write) => {
			write(new Promise(r => setTimeout(r, 20))); resolve();
		});
		const river2 = new River((resolve, _, write) => {
			write(new Promise(r => setTimeout(r, 20))); resolve();
		});
		river1.pump(x => new Promise(r => setTimeout(r, 20)));
		river2.pump(() => {});
		let timer1 = false;
		let timer2 = false;
		let timer3 = false;
		let timer4 = false;
		setTimeout(() => timer1 = true, 10);
		setTimeout(() => timer2 = true, 30);
		setTimeout(() => timer3 = true, 35);
		setTimeout(() => timer4 = true, 50);
		return Promise.all([
			river1.then(() => {
				expect(timer1).to.equal(true);
				expect(timer2).to.equal(true);
				expect(timer3).to.equal(true);
				expect(timer4).to.equal(false);
			}),
			river2.then(() => {
				expect(timer1).to.equal(true);
				expect(timer2).to.equal(false);
			})
		]);
	});
	it('should reject the river if the handler throws or returns rejected', function () {
		const handle = (fn) => { const r = new River(alphabetResolver); r.pump(fn); return r; };
		const err1 = new Error('foo');
		const err2 = new Error('bar');
		return Promise.all([
			expect(handle(() => { throw err1 })).to.be.rejectedWith(err1),
			expect(handle(() => Promise.reject(err2))).to.be.rejectedWith(err2)
		]);
	});
	it('should not be able to write any more values after resolve() is called', function () {
		const after = (ms, x) => new Promise(r => setTimeout(() => r(x), ms));
		const cutoffTest = (process, a, b, c, wait) => {
			const river = new River((r, _, w) => { w(a); r(b); w(c); });
			let str = '';
			river.pump(x => process ? after(process.process).then(() => str += x) : str += x);
			return Promise.all([
				expect(river.then(() => str)).to.become('a'),
				expect(after(wait).then(() => str)).to.become('a')
			]);
		};
		return Promise.all([
			cutoffTest(null, 'a', 'b', 'c', 10),
			cutoffTest(null, after(10, 'a'), 'b', 'c', 20),
			cutoffTest(null, 'a', after(10, 'b'), 'c', 20),
			cutoffTest(null, 'a', 'b', after(10, 'c'), 20),
			cutoffTest(null, after(10, 'a'), after(20, 'b'), 'c', 40),
			cutoffTest(null, after(10, 'a'), 'b', after(2, 'c'), 20),
			cutoffTest(null, 'a', after(20, 'b'), after(2, 'c'), 30),
			cutoffTest(null, after(10, 'a'), after(20, 'b'), after(2, 'c'), 40),
			cutoffTest({ process: 10 }, 'a', 'b', 'c', 20),
			cutoffTest({ process: 10 }, after(10, 'a'), 'b', 'c', 30),
			cutoffTest({ process: 10 }, 'a', after(10, 'b'), 'c', 30),
			cutoffTest({ process: 10 }, 'a', 'b', after(10, 'c'), 30),
			cutoffTest({ process: 10 }, after(10, 'a'), after(20, 'b'), 'c', 50),
			cutoffTest({ process: 10 }, after(10, 'a'), 'b', after(2, 'c'), 30),
			cutoffTest({ process: 10 }, 'a', after(20, 'b'), after(2, 'c'), 40),
			cutoffTest({ process: 10 }, after(10, 'a'), after(20, 'b'), after(2, 'c'), 50)
		]);
	});
	it('should ignore outside calls after resolve(), even if still processing', function () {
		const err = new Error('foobar');
		const rejected = Promise.reject(err);
		const after = (ms, x) => new Promise(r => setTimeout(() => r(x), ms));
		const cutoffTest = (process, a, b, wait) => {
			const river = new River((rs, rj, w) => { w(a); rs(b); w(rejected); rs(rejected); rj(err); });
			let str = '';
			river.pump(x => process ? after(process.process).then(() => str += x) : str += x);
			return Promise.all([
				expect(river.then(() => str)).to.become('a'),
				expect(after(wait).then(() => str)).to.become('a')
			]);
		};
		rejected.catch(() => {});
		return Promise.all([
			cutoffTest(null, 'a', 'b', 10),
			cutoffTest(null, after(10, 'a'), 'b', 20),
			cutoffTest(null, 'a', after(10, 'b'), 20),
			cutoffTest(null, after(10, 'a'), after(20, 'b'), 40),
			cutoffTest({ process: 10 }, 'a', 'b', 20),
			cutoffTest({ process: 10 }, after(10, 'a'), 'b', 30),
			cutoffTest({ process: 10 }, 'a', after(10, 'b'), 30),
			cutoffTest({ process: 10 }, after(10, 'a'), after(20, 'b'), 50)
		]);
	});
	it('should supress unhandled rejected promises written after resolve()', function () {
		let unhandled = false;
		const setUnhandled = () => unhandled = true;
		process.on('unhandledRejection', setUnhandled);
		const river = new River((r, _, w) => { r(new Promise(r => setTimeout(r, 10))); w(Promise.reject(new Error('foo'))); });
		return river.then(() => new Promise(r => setTimeout(r, 10))).then(() => {
			process.removeListener('unhandledRejection', setUnhandled);
			expect(unhandled).to.equal(false);
		}, (reason) => {
			process.removeListener('unhandledRejection', setUnhandled);
			throw reason;
		});
	});
	it('should still be able to reject the river after calling resolve()', function () {
		const err = new Error('foobar');
		const after = (ms, x) => new Promise(r => setTimeout(() => r(x), ms));
		const rejectionTest = (args, delayed, shouldCancel) => {
			const river = new River((r, _, w) => { w(); delayed ? r(after(10)) : r(); });
			const cancel = river.pump(...args);
			if (shouldCancel) cancel();
			return river;
		};
		return Promise.all([
			expect(rejectionTest([() => { throw err; }], false, false)).to.be.rejectedWith(err),
			expect(rejectionTest([() => { throw err; }], true, false)).to.be.rejectedWith(err),
			expect(rejectionTest([() => Promise.reject(err)], false, false)).to.be.rejectedWith(err),
			expect(rejectionTest([() => Promise.reject(err)], true, false)).to.be.rejectedWith(err),
			expect(rejectionTest([() => {}], false, true)).to.be.rejectedWith(River.Cancellation),
			expect(rejectionTest([() => {}], true, true)).to.be.rejectedWith(River.Cancellation)
		]);
	});
	it('should not process racing values or queued values after being rejected', function () {
		const after = (ms, x) => new Promise(r => setTimeout(() => r(x), ms));
		const river = new River((r, _, w) => { w('a'); w('b'); w(after(10, 'c')); setTimeout(() => w('d'), 20); r(); });
		const err = new Error('foobar');
		let correctValue = false;
		let invoked = 0;
		river.pump((item) => {
			correctValue = item === 'a';
			invoked += 1;
			throw err;
		});
		return Promise.all([
			expect(river).to.be.rejectedWith(err),
			expect(after(30).then(() => correctValue)).to.become(true),
			expect(after(30).then(() => invoked)).to.become(1)
		]);
	});
	it('should support cleanup functions which are invoked regardless of fate', function () {
		let str = '';
		const err = new Error('foobar');
		const cleanup = (x) => () => str += x;
		const fulfilled = new River((r, _, __, f) => { f(cleanup('a')); setTimeout(r, 7); });
		const rejected = new River((_, r, __, f) => { f(cleanup('b')); setTimeout(() => r(err), 15); });
		expect(str).to.equal('');
		return Promise.all([
			expect(new Promise(r => setTimeout(() => r(str), 1))).to.become(''),
			expect(fulfilled).to.become(undefined),
			expect(rejected).to.be.rejectedWith(err),
		]).then(() => { expect(str).to.equal('ab'); });
	});
	it('should synchronously invoke cleanup functions in LIFO order', function (done) {
		let str = '';
		const cleanup = (x) => () => { str += x; return new Promise(r => setTimeout(r, 100)); }
		new River((resolve, _, __, free) => {
			free(cleanup('a'));
			free(cleanup('b'));
			setTimeout(() => {
				try {
					expect(str).to.equal('');
					free(cleanup('c'));
					free(cleanup('d'));
					expect(str).to.equal('');
					resolve();
					expect(str).to.equal('dcba');
					done();
				} catch (err) {
					done(err);
				}
			}, 5);
		});
		expect(str).to.equal('');
	});
	it('should immediately invoke cleanup functions if river is already resolved', function () {
		let str = '';
		const cleanup = (x) => () => { str += x; return new Promise(r => setTimeout(r, 100)); }
		new River((resolve, _, __, free) => {
			free(cleanup('a'));
			free(cleanup('b'));
			free(() => {
				free(cleanup('x'));
				str += 'c';
				free(cleanup('y'));
			});
			resolve();
			free(cleanup('d'));
		});
		expect(str).to.equal('xcybad');
	});
});
