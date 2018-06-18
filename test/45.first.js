'use strict';
const { expect } = require('chai');
const River = require('../.');

describe('.first()', function () {
	describe('with no arguments', function () {
		it('should propagate rejections to the returned promise', function () {
			const err = new Error('foobar');
			const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
			return expect(river.first()).to.be.rejectedWith(err);
		});
		it('should be fulfilled with the first item in the river', function () {
			const source = River.from(['a', 'b', 'c', 'd']);
			return expect(source.first()).to.become('a').then(() => {
				return expect(source).to.be.rejectedWith(River.Cancellation);
			});
		});
		it('should be rejected with a NoDataError if the river is empty', function () {
			const source = River.from([]);
			return expect(source.first()).to.be.rejectedWith(River.NoDataError).then(() => {
				return expect(source).to.be.become(undefined);
			});
		});
	});
	describe('with a count argument', function () {
		it('should return a rejected promise if an invalid count is given', function () {
			const test = (count) => {
				const source = River.from(['a', 'b', 'c']);
				const promise = source.first(count);
				return expect(promise).to.be.rejectedWith(TypeError)
					.then(() => expect(source).to.be.rejectedWith(River.Cancellation));
			};
			return Promise.all([
				test(null),
				test(0),
				test(-2),
				test(2.000001),
				test(NaN),
				test(Infinity),
				test('2'),
				test('foobar'),
			]);
		});
		it('should propagate rejections to the returned promise', function () {
			const err = new Error('foobar');
			const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
			return expect(river.first(3)).to.be.rejectedWith(err);
		});
		it('should be fulfilled with an array of the first provided items', function () {
			const source1 = River.from(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
			const source2 = River.from(['a', 'b', 'c']);
			return Promise.all([
				expect(source1.first(3)).to.become(['a', 'b', 'c'])
					.then(() => expect(source1).to.be.rejectedWith(River.Cancellation)),
				expect(source2.first(3)).to.become(['a', 'b', 'c'])
					.then(() => expect(source2).to.be.rejectedWith(River.Cancellation)),
			]);
		});
		it('should be fulfilled with a smaller array when fewer items are provided', function () {
			const source = River.from(['a', 'b']);
			return expect(source.first(3)).to.become(['a', 'b']).then(() => {
				return expect(source).to.become(undefined);
			});
		});
		it('should be fulfilled with an empty array when no items are provided', function () {
			const source = River.from([]);
			return expect(source.first(3)).to.become([]).then(() => {
				return expect(source).to.become(undefined);
			});
		});
	});
});
