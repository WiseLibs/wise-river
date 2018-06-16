'use strict';
const { expect } = require('chai');
const River = require('../.');

const after = (ms, value) => new Promise((resolve) => {
	setTimeout(() => resolve(value), ms);
});

describe('.throttle()', function () {
	it('should propagate rejections to the returned river', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return Promise.all([
			expect(river.throttle(1)).to.be.rejectedWith(err),
			expect(river.throttle(30)).to.be.rejectedWith(err),
		]);
	});
	it('should propagate cancellations back to the source river', function () {
		const river = River.every(10);
		river.throttle(1).pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
	it('should keep data that is received at an accepted pace', function () {
		let str = '';
		const river = River.from([after(10, 'a'), after(50, 'b'), after(90, 'c')]).throttle(25);
		river.pump(x => str += x);
		return expect(river).to.become(undefined).then(() => {
			expect(str).to.equal('abc');
		});
	});
	it('should defer the most recent piece of data', function () {
		let str = '';
		const river = River.from([after(10, 'a'), after(20, 'b'), after(40, 'c')]).throttle(25);
		river.pump(x => str += x);
		return expect(river).to.become(undefined).then(() => {
			expect(str).to.equal('abc');
		});
	});
	it('should discard data that is received too quickly', function () {
		let str = '';
		const river = River.from([after(10, 'a'), after(20, 'b'), after(25, 'c')]).throttle(25);
		river.pump(x => str += x);
		return expect(river).to.become(undefined).then(() => {
			expect(str).to.equal('ac');
		});
	});
	it('should cast any argument to a signed integer', function () {
		let str = '';
		const river = River.from([after(10, 'a'), after(20, 'b'), after(25, 'c')]).throttle(4294967321);
		river.pump(x => str += x);
		return expect(river).to.become(undefined).then(() => {
			expect(str).to.equal('ac');
		});
	});
});
