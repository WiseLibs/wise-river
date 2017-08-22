'use strict';
const { expect } = require('chai');
const River = require('../.');

describe('River.reject()', function () {
	it('should return a rejected river', function () {
		const err = new Error('foobar');
		const river = River.reject(err);
		expect(river).to.be.an.instanceof(River);
		return expect(river).to.be.rejectedWith(err);
	});
	it('should return a river that is not cancellable', function () {
		const err = new Error('foobar');
		const river = River.reject(err);
		river.pump(() => {})();
		return expect(river).to.be.rejectedWith(err);
	});
});

describe('River.never()', function () {
	it('should return a river that never emits data and never resolves', function () {
		const river = River.never();
		expect(river).to.be.an.instanceof(River);
		let noData = true;
		river.pump(() => noData = false);
		return Promise.race([river, new Promise(r => setTimeout(() => r(123), 50))]).then((result) => {
			expect(result).to.equal(123);
			expect(noData).to.equal(true);
		});
	});
	it('should return a river that can be cancelled', function () {
		const river = River.never();
		river.pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
});

describe('River.empty()', function () {
	it('should return a fulfilled river that never emits data', function () {
		const river = River.empty();
		expect(river).to.be.an.instanceof(River);
		let noData = true;
		let tooLate = false;
		river.pump(() => noData = false);
		setImmediate(() => tooLate = true);
		return river.then(() => {
			expect(noData).to.equal(true);
			expect(tooLate).to.equal(false);
		});
	});
	it('should return a river that is not cancellable', function () {
		const river = River.empty();
		river.pump(() => {})();
		return expect(river).to.become(undefined);
	});
});

describe('River.one()', function () {
	
});

describe('River.from()', function () {
	
});

describe('River.every()', function () {
	
});

describe('River.combine()', function () {
	
});
