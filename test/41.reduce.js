'use strict';
const { expect } = require('chai');
const River = require('../.');

describe('.reduce()', function () {
	it('should return a rejected promise if invalid arguments are given', function () {});
	it('should propagate rejections to the returned promise', function () {});
	it('should apply the reducer to a river of items', function () {});
	it('should accept an initial value', function () {});
	it('should accept an initial value as a promise', function () {});
	it('should not invoke the callback when only one item is provided', function () {});
	it('should not invoke the callback when only an initial value is provided', function () {});
	it('should return a NoDataError when no values are provided', function () {});
	it('should use a concurrency of 1 when the callback returns a promise', function () {});
	it('should reject the promise if the handler throws', function () {});
	it('should reject the promise if the handler returns a rejected promise', function () {});
});
