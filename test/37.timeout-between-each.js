'use strict';
const { expect } = require('chai');
const River = require('../.');

const after = (ms, value) => new Promise((resolve) => {
	setTimeout(() => resolve(value), ms);
});

describe('.timeoutBetweenEach()', function () {
	it('should propagate rejections to the returned river', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.timeoutBetweenEach(30)).to.be.rejectedWith(err);
	});
	it('should propagate cancellations back to the source river', function () {
		const river = River.every(10);
		river.timeoutBetweenEach(30).pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
	it('should not timeout if data is regularly received', function () {
		const promise = River.from([after(10, 'a'), after(30, 'b'), after(50, 'c')])
			.timeoutBetweenEach(30)
			.all()
			.then(arr => arr.join(''));
		return expect(promise).to.become('abc');
	});
	it('should timeout if data is not received soon enough', function () {
		const promise = River.from([after(10, 'a'), after(30, 'b'), after(70, 'c')])
			.timeoutBetweenEach(30)
			.all();
		return expect(promise).to.be.rejectedWith(River.TimeoutError);
	});
	it('should accept a string reason', function () {
		const promise = River.from([after(10, 'a'), after(30, 'b'), after(70, 'c')])
			.timeoutBetweenEach(30, 'foobar')
			.all();
		return expect(promise).to.be.rejectedWith(/^foobar$/);
	});
	it('should accept an Error reason', function () {
		const err = new TypeError('foobar');
		const promise = River.from([after(10, 'a'), after(30, 'b'), after(70, 'c')])
			.timeoutBetweenEach(30, err)
			.all();
		return expect(promise).to.be.rejectedWith(err);
	});
	it('should start the timer right away', function () {
		const promise = River.from([after(40, 'a'), after(50, 'b'), after(60, 'c')])
			.timeoutBetweenEach(30)
			.all();
		return expect(promise).to.be.rejectedWith(River.TimeoutError);
	});
});
