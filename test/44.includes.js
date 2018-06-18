'use strict';
const { expect } = require('chai');
const River = require('../.');

const after = (ms, value) => new Promise((resolve) => {
	setTimeout(() => resolve(value), ms);
});

describe('.includes()', function () {
	it('should propagate rejections to the returned promise', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.includes(undefined)).to.be.rejectedWith(err);
	});
	it('should be fulfilled with true when the given value is found', function () {
		const source = River.from(['a', 'b', 'c', 'd']);
		const promise = source.includes('c');
		return expect(promise).to.become(true).then(() => {
			return expect(source).to.be.rejectedWith(River.Cancellation);
		});
	});
	it('should accept a promise of the value to search for', function () {
		const source = River.from(['a', 'b', 'c', 'd']);
		const promise = source.includes(after(20, 'c'));
		return expect(promise).to.become(true).then(() => {
			return expect(source).to.be.rejectedWith(River.Cancellation);
		});
	});
	it('should be fulfilled to false when the given value is not found', function () {
		const source = River.from(['a', 'b', 'c', 'd']);
		const promise = source.includes('e');
		return expect(promise).to.become(false).then(() => {
			return expect(source).to.be.become(undefined);
		});
	});
	it('should reject the returned promise when the given promise is rejected', function () {
		const err = new Error('foobar');
		const source = River.from(['a', 'b', 'c', 'd']);
		const promise = source.includes(new Promise((_, r) => setTimeout(() => r(err), 20)));
		return expect(promise).to.be.rejectedWith(err).then(() => {
			return expect(source).to.be.rejectedWith(River.Cancellation);
		});
	});
	it('should accept a custom equals function', function () {
		const equals = (x, y) => {
			expect(x).to.equal('c');
			if (y === 'b') y = 'c';
			else if (y === 'c') y = 'b';
			return x === y;
		};
		const test = (source, result, expectation) => {
			return expect(source.includes('c', equals)).to.become(result).then(() => {
				return expectation(expect(source));
			});
		};
		return Promise.all([
			test(River.from(['a', 'b', 'd']), true, x => x.to.be.rejectedWith(River.Cancellation)),
			test(River.from(['a', 'c', 'd']), false, x => x.to.become(undefined)),
		]);
	});
});
