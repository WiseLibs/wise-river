'use strict';
const { expect } = require('chai');
const River = require('../.');
const invalidArgs = require('../tools/invalid-args');

describe('.map()', function () {
	it('should return a rejected river if invalid arguments are given', function () {
		const testRejected = (value) => {
			expect(value).to.be.an.instanceof(River);
			return expect(value).to.be.rejectedWith(TypeError);
		};
		return Promise.all(invalidArgs().map(args => testRejected(River.from(['a']).map(...args))));
	});
	it('should propagate rejections to the returned river', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.map(x => x)).to.be.rejectedWith(err);
	});
	it('should propagate cancellations back to the source river', function () {
		const river = River.every(10);
		river.map(x => x).pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
	it('should map the data through the callback', function () {
		let str = '';
		const river = River.from(['a', 'b', 'c']).map(x => x === 'b' ? Promise.resolve('foo') : x + x + '.');
		river.pump(x => str += x);
		return expect(river.then(() => str)).to.become('aa.cc.foo');
	});
	it('should respect a given concurrency value', function () {
		let str = '';
		const river = River.from(['a', 'b', 'c']).map(1, x => x === 'b' ? Promise.resolve('foo') : x + x + '.');
		river.pump(x => str += x);
		return expect(river.then(() => str)).to.become('aa.foocc.');
	});
	it('should reject the stream if the handler throws', function () {
		const err = new Error('foobar');
		let str = '';
		return expect(River.from(['a', 'b', Promise.resolve('c')]).map((x) => { str += x; throw err; }))
			.to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('a'); });
	});
	it('should reject the stream if the handler returns a rejected promise', function () {
		const err = new Error('foobar');
		let str = '';
		return expect(River.from(['a', new Promise(r => setImmediate(() => r('b'))), 'c']).map((x) => { str += x; return Promise.reject(err); }))
			.to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('ac'); });
	});
	it('should treat returned rivers with flatMap semantics', function () {
		const river = River.from(['a', 'b', 'c']).map(x => x === 'a' ? 'a' : River.from(['x', new Promise(r => setImmediate(() => r('y'))), 'z']));
		let str = '';
		river.pump(x => str += x);
		return expect(river.then(() => str)).become('axzxzyy');
	});
	it('should respect a given concurrency value with flatMap semantics', function () {
		const river = River.from(['a', 'b', 'c']).map(1, x => x === 'a' ? 'a' : River.from(['x', new Promise(r => setImmediate(() => r('y'))), 'z']));
		let str = '';
		river.pump(x => str += x);
		return expect(river.then(() => str)).become('axzyxzy');
	});
	it('should allow cancellation of rivers provided through a flatMap process', function () {
		const flattened = [];
		const river = River.from(['a', 'b', 'c']).map((x) => {
			if (x === 'a') return 'a'
			const r = River.from(['x', new Promise(r => setImmediate(() => r('y'))), 'z']);
			flattened.push(r);
			return r;
		});
		let str = '';
		const cancel = river.pump((x) => {
			str += x;
			if (x === 'y') cancel();
		});
		return expect(river).to.be.rejectedWith(River.Cancellation).then(() => {
			expect(str).to.equal('axzxzy');
			expect(flattened.length).to.equal(2);
			return Promise.all(flattened.map(f => expect(f).to.be.rejectedWith(River.Cancellation)));
		});
	});
});
