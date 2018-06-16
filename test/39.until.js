'use strict';
const { expect } = require('chai');
const River = require('../.');

const after = (ms, value) => new Promise((resolve) => {
	setTimeout(() => resolve(value), ms);
});

describe('.until()', function () {
	it('should propagate rejections to the returned river', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.until(after(50))).to.be.rejectedWith(err);
	});
	it('should propagate cancellations back to the source river', function () {
		const river = River.every(10);
		river.until(after(50)).pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
	it('should short-circuit the returned river when the given promise resolves', function () {
		let str = '';
		const source = River.from([after(10, 'a'), after(50, 'b'), after(90, 'c')]);
		const dest = source.until(after(70));
		dest.pump(x => str += x);
		return expect(dest).to.become(undefined).then(() => {
			expect(str).to.equal('ab');
			return expect(source).to.be.rejectedWith(River.Cancellation);
		});
	});
	it('should reject the returned river when the given promise is rejected', function () {
		let str = '';
		const err = new Error('foobar');
		const source = River.from([after(10, 'a'), after(50, 'b'), after(90, 'c')]);
		const dest = source.until(new Promise((_, r) => setTimeout(() => r(err), 70)));
		dest.pump(x => str += x);
		return expect(dest).to.be.rejectedWith(err).then(() => {
			expect(str).to.equal('ab');
			return expect(source).to.be.rejectedWith(River.Cancellation);
		});
	});
	it('should treat synchronous values as already-fulfilled promises', function () {
		let str = '';
		const source = River.from([after(10, 'a'), after(20, 'b'), after(30, 'c')]);
		const dest = source.until('foobar');
		dest.pump(x => str += x);
		return expect(dest).to.become(undefined).then(() => {
			expect(str).to.equal('');
			return expect(source).to.be.rejectedWith(River.Cancellation);
		});
	});
});
