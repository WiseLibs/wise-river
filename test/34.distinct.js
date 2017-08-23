'use strict';
const { expect } = require('chai');
const River = require('../.');
const invalidArgs = require('../tools/invalid-args');

describe('.distinct()', function () {
	it('should return a rejected river if invalid arguments are given', function () {
		const testRejected = (value) => {
			expect(value).to.be.an.instanceof(River);
			return expect(value).to.be.rejectedWith(TypeError);
		};
		return Promise.all([
			testRejected(River.from('a').distinct(null)),
			testRejected(River.from('a').distinct('foobar')),
			testRejected(River.from('a').distinct(123)),
			testRejected(River.from('a').distinct({}))
		]);
	});
	it('should propagate rejections to the returned river', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.distinct()).to.be.rejectedWith(err);
	});
	it('should propagate cancellations back to the source river', function () {
		const river = River.every(10);
		river.distinct().pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
	it('should filter out adjacent duplicate data', function () {
		let str = '';
		const river = River.from(['a', ['q'], ['q'], 'b', 'b', 'c', 'c', 'c', Promise.resolve('x'), 'd', 'e', 'b', 'e', 'e', 'E', 'x']).distinct();
		river.pump(x => str += x);
		return expect(river.then(() => str)).to.become('aqqbcdebeEx');
	});
	it('should accept a custom equals function', function () {
		let str = '';
		const equals = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
		const river = River.from(['a', ['q'], ['q'], 'b', 'b', 'c', 'c', 'c', Promise.resolve('x'), 'd', 'e', 'b', 'e', 'e', 'E', 'x']).distinct(equals);
		river.pump(x => str += x);
		return expect(river.then(() => str)).to.become('aqbcdebex');
	});
	it('should reject the stream if the equals function throws', function () {
		const err = new Error('foobar');
		const river = River.from(['a', ['q'], ['q'], 'b', 'b', 'c', 'c', 'c', Promise.resolve('x'), 'd', 'e', 'b', 'e', 'e', 'E', 'x']).distinct((x) => { str += x; throw err; });
		let str = '';
		return expect(river).to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('a'); });
	});
});
