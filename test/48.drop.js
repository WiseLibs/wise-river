'use strict';
const { expect } = require('chai');
const River = require('../.');

const after = (ms, value) => new Promise((resolve) => {
	setTimeout(() => resolve(value), ms);
});

describe('.drop()', function () {
	it('should cancel the river if not yet consumed', function () {
		const river = River.from(['a']);
		const result = river.drop();
		expect(river).to.equal(result);
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
	it('should do nothing if the river was consumed', function () {
		const river = River.from(['a']);
		river.pump(() => {});
		const result = river.drop();
		expect(river).to.equal(result);
		return expect(river).to.become(undefined);
	});
	it('should do nothing if the river is already resolved', function () {
		const river = River.from([]);
		const result = river.drop();
		expect(river).to.equal(result);
		return expect(river).to.become(undefined);
	});
});
