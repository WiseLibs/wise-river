'use strict';
const { expect } = require('chai');
const River = require('../.');

describe('.all()', function () {
	it('should propagate rejections to the returned promise', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.all()).to.be.rejectedWith(err);
	});
	it('should resolve to an array of all items provided', function () {
		return expect(River.from(['a', Promise.resolve('b'), 'c']).all()).to.become(['a', 'c', 'b']);
	});
	it('should resolve to an empty array when no items are provided', function () {
		return expect(River.from([]).all()).to.become([]);
	});
});
