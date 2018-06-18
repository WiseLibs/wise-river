'use strict';
const { expect } = require('chai');
const River = require('../.');
const invalidArgs = require('../tools/invalid-args');

describe('.consume()', function () {
	it('should return a rejected promise if invalid arguments are given', function () {
		const testRejected = (value) => {
			expect(value).to.not.be.an.instanceof(River);
			expect(value).to.be.an.instanceof(Promise);
			return expect(value).to.be.rejectedWith(TypeError);
		};
		return Promise.all(invalidArgs().map(args => testRejected(River.from(['a']).consume(...args))));
	});
	it('should propagate rejections to the returned promise', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.consume(x => x)).to.be.rejectedWith(err);
	});
	it('should invoke the callback for each item in the river', function () {
		let invokedWith = '';
		let pending = 0;
		const promise = River.from(['a', 'b', 'c']).consume((x) => {
			invokedWith += x;
			if (x === 'a') {
				expect(pending).to.equal(0);
				return x;
			}
			if (x === 'b') {
				expect(pending).to.equal(0);
				pending += 1;
				return Promise.resolve('foo').then(() => { pending -= 1; });
			}
			if (x === 'c') {
				expect(pending).to.equal(1);
				return x;
			}
			expect(false).to.be.true;
		});
		return expect(promise).to.become(undefined).then(() => {
			expect(pending).to.equal(0);
			expect(invokedWith).to.equal('abc');
		});
	});
	it('should respect a given concurrency value', function () {
		let invokedWith = '';
		let pending = 0;
		const promise = River.from(['a', 'b', 'c']).consume((x) => {
			expect(pending).to.equal(0);
			invokedWith += x;
			if (x === 'a') {
				return x;
			}
			if (x === 'b') {
				pending += 1;
				return Promise.resolve('foo').then(() => { pending -= 1; });
			}
			if (x === 'c') {
				return x;
			}
			expect(false).to.be.true;
		}, 1);
		return expect(promise).to.become(undefined).then(() => {
			expect(pending).to.equal(0);
			expect(invokedWith).to.equal('abc');
		});
	});
	it('should reject the promise if the handler throws', function () {
		const err = new Error('foobar');
		let str = '';
		return expect(River.from(['a', 'b', Promise.resolve('c')]).consume((x) => { str += x; throw err; }))
			.to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('a'); });
	});
	it('should reject the promise if the handler returns a rejected promise', function () {
		const err = new Error('foobar');
		let str = '';
		return expect(River.from(['a', new Promise(r => setImmediate(() => r('b'))), 'c']).consume((x) => { str += x; return Promise.reject(err); }))
			.to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('ac'); });
	});
});
