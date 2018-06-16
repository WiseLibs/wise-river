'use strict';
const { expect } = require('chai');
const River = require('../.');
const invalidArgs = require('../tools/invalid-args');

describe('.while()', function () {
	it('should return a rejected river if invalid arguments are given', function () {
		const testRejected = (value) => {
			expect(value).to.be.an.instanceof(River);
			return expect(value).to.be.rejectedWith(TypeError);
		};
		return Promise.all(invalidArgs().map(args => testRejected(River.from(['a']).while(...args))));
	});
	it('should propagate rejections to the returned river', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.while(() => true)).to.be.rejectedWith(err);
	});
	it('should propagate cancellations back to the source river', function () {
		const river = River.every(10);
		river.while(() => true).pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
	it('should invoke the callback to determine a stopping point');
	it('should respect a given concurrency value');
	it('should reject the stream if the handler throws');
	it('should reject the stream if the handler returns a rejected promise');
});
