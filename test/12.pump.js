'use strict';
const { expect } = require('chai');
const River = require('../.');

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
		const river = new River((resolve, _, write) => {
			setImmediate(() => { write('e'); resolve(); });
			Promise.resolve().then(() => write('d'));
			process.nextTick(() => write('c'));
			write('a');
			write('b');
		});
		let str = '';
		expect(river.pump(item => str = str + item)).to.be.a('function');
		return expect(river.then(() => str)).to.become('abcde');
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
});
