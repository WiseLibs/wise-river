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

describe('.pump()', function () {
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
		river.pump(item => str2 = str2 + item)(/* no-op cancellation */);
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
		setTimeout(() => timer3 = true, 39);
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
	it('should reject the river if the handler throws or returns a rejected promise', function () {
		const handle = (fn) => { const r = new River(alphabetResolver); r.pump(fn); return r; };
		const err1 = new Error('foo');
		const err2 = new Error('bar');
		return Promise.all([
			expect(handle(() => { throw err1 })).to.be.rejectedWith(err1),
			expect(handle(() => Promise.reject(err2))).to.be.rejectedWith(err2)
		]);
	});
	it('should not be able to write any more values after resolve() is called', function () {
		const river = new River((resolve, _, write) => {
			write(1);
			write(new Promise(r => setTimeout(() => r(10), 20)));
			resolve(new Promise(r => setTimeout(r, 50)).then(() => total += 5));
			write(new Promise(r => setTimeout(() => r(100), 10)));
			write(1000);
		});
		let total = 0;
		river.pump(n => new Promise(r => setTimeout(() => { total += n; r(); }, 20)));
		return Promise.all([
			expect(river.then(() => total)).to.become(16),
			expect(new Promise(r => setTimeout(r, 80)).then(() => total)).to.become(16)
		]);
	});
	it('should ignore outside calls after resolve(), even if still processing', function () {
		// ignore multiple calls to resolve(), even if passing a rejected promise
		// - ^ should this supress unhandled rejections passed to resolve()?
		// ignore reject()
		// ignore write()ing rejected promises
		// - ^ and should supress unhandled rejections passed to write()
	});
	it('should still be able to reject the river after calling resolve()', function () {
		// by throwing in the handler, or returning a rejected promise
		// by passing invalid arguments to pump()
		// by cancellation
	});
	it('should not process racing values or queued values after being rejected', function () {
		// test with promises racing and promises processing
	});
	it('should support cleanup functions that are invoked regardless of fate', function () {
		
	});
	it('should synchronously invoke cleanup functions in FILO order', function () {
		
	});
	it('should immediately invoke cleanup functions if the river is already resolved', function () {
		
	});
});
