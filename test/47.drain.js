'use strict';
const { expect } = require('chai');
const River = require('../.');

const after = (ms, value) => new Promise((resolve) => {
	setTimeout(() => resolve(value), ms);
});

describe('.drain()', function () {
	it('should propagate rejections to the returned promise', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.drain()).to.be.rejectedWith(err);
	});
	it('should be fulfilled with undefined', function () {
		const source = River.from(['a', Promise.resolve('b'), 'c']);
		return Promise.all([
			expect(source.drain()).to.become(undefined),
			expect(source).to.become(undefined),
		]);
	});
	it('should wait for all items to be consumed', function () {
		const source = River.from([after(20), after(60), after(100)]);
		const startTime = Date.now();
		return Promise.all([
			expect(source.drain()).to.become(undefined),
			expect(source).to.become(undefined),
		]).then(() => {
			expect(Date.now() - startTime).to.be.within(80, 120);
		});
	});
});
