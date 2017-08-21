'use strict';
const { expect } = require('chai');
const River = require('../.');

describe('.pump()', function () {
	it('should be a noop if the river is already resolved', function () {
		const err = new Error('foobar');
		const r1 = new River((r) => r());
		const r2 = new River((_, r) => r(err));
		r1.pump();
		r2.pump();
		return expect(Promise.all([r1, r2.catch(x => x)])).to.become([undefined, err]);
	});
	it('should reject the river if a function is not given', function () {
		const pumped = (a, b) => { const r = new River(() => {}); r.pump(a, b); return r; }
		return Promise.all([
			expect(pumped()).to.be.rejectedWith(TypeError),
			expect(pumped(123)).to.be.rejectedWith(TypeError),
			expect(pumped(undefined, 123)).to.be.rejectedWith(TypeError),
			expect(pumped(123, 123)).to.be.rejectedWith(TypeError),
			expect(pumped(123, {})).to.be.rejectedWith(TypeError)
		]);
	});
	it('should reject the river if an invalid concurrency value is given', function () {
		const pumped = (a, b) => { const r = new River(() => {}); r.pump(a, b); return r; }
		return Promise.all([
			expect(pumped(-1, () => {})).to.be.rejectedWith(TypeError),
			expect(pumped(0xffffffff + 1, () => {})).to.be.rejectedWith(TypeError),
			expect(pumped(NaN, () => {})).to.be.rejectedWith(TypeError),
			expect(pumped('1foo', () => {})).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, -1)).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, 0xffffffff + 1)).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, NaN)).to.be.rejectedWith(TypeError),
			expect(pumped(() => {}, '1foo')).to.be.rejectedWith(TypeError)
		]);
	});
	it('should return a function that will cancel the river', function () {
		const cancelled = (fn) => { const r = new River(fn); r.pump(() => {})(); return r; }
		return Promise.all([
			expect(cancelled(() => {})).to.be.rejectedWith(River.Cancellation),
		]);
	});
});
