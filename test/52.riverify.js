'use strict';
const { expect } = require('chai');
const { Writable } = require('stream');
const River = require('../.');

describe('River.riverify()', function () {
	describe('for unsupported values', function () {
		it('should return a rejected river', function () {
			const test = (...args) => expect(River.riverify(...args)).to.be.rejectedWith(TypeError);
			return Promise.all([
				test(),
				test(undefined),
				test(null),
				test('foo'),
				test({}),
				test(123),
				test(NaN),
				test(Symbol()),
				test([]),
				test(() => {}),
				test(new Writable),
			]);
		});
	});
	describe('for stream objects', function () {
		it('should be tested', function () {

		});
	});
	describe('for async iterable objects', function () {
		it('should be tested');
	});
});
