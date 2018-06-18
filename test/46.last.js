'use strict';
const { expect } = require('chai');
const River = require('../.');

describe('.last()', function () {
	describe('with no arguments', function () {
		it('should propagate rejections to the returned promise', function () {
			const err = new Error('foobar');
			const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
			return expect(river.last()).to.be.rejectedWith(err);
		});
		it('should be fulfilled with the last item in the river', function () {
			const source = River.from(['a', 'b', 'c', 'd']);
			return expect(source.last()).to.become('d');
		});
		it('should be rejected with a NoDataError if the river is empty', function () {
			const source = River.from([]);
			return expect(source.last()).to.be.rejectedWith(River.NoDataError);
		});
	});
	describe('with a count argument', function () {
		xit('should return a rejected promise if an invalid count is given', function () {
			// and the source should be cancelled
		});
		it('should propagate rejections to the returned promise', function () {
			const err = new Error('foobar');
			const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
			return expect(river.last(3)).to.be.rejectedWith(err);
		});
		it('should be fulfilled with an array of the last provided items', function () {
			return Promise.all([
				expect(River.from(['a', 'b', 'c', 'd', 'e', 'f', 'g']).last(3))
					.to.become(['e', 'f', 'g']),
				expect(River.from(['a', 'b', 'c']).last(3))
					.to.become(['a', 'b', 'c']),
			]);
		});
		it('should be fulfilled with a smaller array when fewer items are provided', function () {
			const source = River.from(['a', 'b']);
			return expect(source.last(3)).to.become(['a', 'b']);
		});
		it('should be fulfilled with an empty array when no items are provided', function () {
			const source = River.from([]);
			return expect(source.last(3)).to.become([]);
		});
	});
});
