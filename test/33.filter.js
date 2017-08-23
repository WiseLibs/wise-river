'use strict';
const { expect } = require('chai');
const River = require('../.');
const invalidArgs = require('../tools/invalid-args');

describe('.filter()', function () {
	it('should return a rejected river if invalid arguments are given', function () {
		const testRejected = (value) => {
			expect(value).to.be.an.instanceof(River);
			return expect(value).to.be.rejectedWith(TypeError);
		};
		return Promise.all(invalidArgs().map(args => testRejected(River.from(['a']).filter(...args))));
	});
	it('should propagate rejections to the returned river', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.filter(x => false)).to.be.rejectedWith(err);
	});
	it('should propagate cancellations back to the source river', function () {
		const river = River.every(10);
		river.filter(x => false).pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
	it('should invoke the callback to filter the data', function () {
		let str = '';
		let invokedWith = '';
		const river = River.from(['a', 'b', 'c', 'd']).filter((x) => {
			invokedWith += x;
			return x === 'b' ? Promise.resolve(true) : x === 'd' ? Promise.resolve(false) : x === 'c';
		});
		river.pump(x => str += x);
		return expect(river).to.become(undefined).then(() => {
			expect(invokedWith).to.equal('abcd');
			expect(str).to.equal('cb');
		});
	});
	it('should respect a given concurrency value', function () {
		let str = '';
		let invokedWith = '';
		const river = River.from(['a', 'b', 'c', 'd']).filter(1, (x) => {
			invokedWith += x;
			return x === 'b' ? Promise.resolve(true) : x === 'd' ? Promise.resolve(false) : x === 'c';
		});
		river.pump(x => str += x);
		return expect(river).to.become(undefined).then(() => {
			expect(invokedWith).to.equal('abcd');
			expect(str).to.equal('bc');
		});
	});
	it('should reject the stream if the handler throws', function () {
		const err = new Error('foobar');
		let str = '';
		return expect(River.from(['a', 'b', Promise.resolve('c')]).filter((x) => { str += x; throw err; }))
			.to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('a'); });
	});
	it('should reject the stream if the handler returns a rejected promise', function () {
		const err = new Error('foobar');
		let str = '';
		return expect(River.from(['a', new Promise(r => setImmediate(() => r('b'))), 'c']).filter((x) => { str += x; return Promise.reject(err); }))
			.to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('ac'); });
	});
});
