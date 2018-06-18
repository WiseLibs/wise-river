'use strict';
const { expect } = require('chai');
const River = require('../.');
const invalidArgs = require('../tools/invalid-args');

const after = (ms, value) => new Promise((resolve) => {
	setTimeout(() => resolve(value), ms);
});

describe('.find()', function () {
	it('should return a rejected promise if invalid arguments are given', function () {
		const testRejected = (value) => {
			expect(value).to.not.be.an.instanceof(River);
			expect(value).to.be.an.instanceof(Promise);
			return expect(value).to.be.rejectedWith(TypeError);
		};
		return Promise.all(invalidArgs().map(args => testRejected(River.from(['a']).find(...args))));
	});
	it('should propagate rejections to the returned promise', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.find(() => true)).to.be.rejectedWith(err);
	});
	it('should invoke the callback to find an item', function () {
		let invokedWith = '';
		const source = River.from(['a', 'b', 'c', 'd']);
		const promise = source.find((x) => {
			invokedWith += x;
			return (x === 'c' || x === 'd') ? Promise.resolve(true) : Promise.resolve(false);
		});
		return expect(promise).to.become('c').then(() => {
			expect(invokedWith).to.equal('abcd');
			return expect(source).to.be.rejectedWith(River.Cancellation);
		});
	});
	it('should find the first item to resolve to true', function () {
		let invokedWith = '';
		const source = River.from(['a', 'b', 'c', 'd']);
		const promise = source.find((x) => {
			invokedWith += x;
			if (x === 'c') return after(20, true);
			if (x === 'd') return after(10, true);
			return Promise.resolve(false);
		});
		return expect(promise).to.become('d').then(() => {
			expect(invokedWith).to.equal('abcd');
			return expect(source).to.be.rejectedWith(River.Cancellation);
		});
	});
	it('should respect a given concurrency value', function () {
		let invokedWith = '';
		const source = River.from(['a', 'b', 'c', 'd']);
		const promise = source.find(1, (x) => {
			invokedWith += x;
			return (x === 'c' || x === 'd') ? Promise.resolve(true) : Promise.resolve(false);
		});
		return expect(promise).to.become('c').then(() => {
			expect(invokedWith).to.equal('abc');
			return expect(source).to.be.rejectedWith(River.Cancellation);
		});
	});
	it('should reject with a NoDataError when no items match the predicate', function () {
		let invokedWith = '';
		const source = River.from(['a', 'b', 'c', 'd']);
		const promise = source.find((x) => {
			invokedWith += x;
			return Promise.resolve(false);
		});
		return Promise.all([
			expect(source).to.become(undefined),
			expect(promise).to.be.rejectedWith(River.NoDataError),
		]).then(() => {
			expect(invokedWith).to.equal('abcd');
		});
	});
	it('should reject with a NoDataError when no items are provided', function () {
		let invokedWith = '';
		const source = River.from([]);
		const promise = source.find((x) => {
			invokedWith += x;
			return Promise.resolve(true);
		});
		return Promise.all([
			expect(source).to.become(undefined),
			expect(promise).to.be.rejectedWith(River.NoDataError),
		]).then(() => {
			expect(invokedWith).to.equal('');
		});
	});
	it('should reject the promise if the handler throws', function () {
		const err = new Error('foobar');
		let str = '';
		return expect(River.from(['a', 'b', Promise.resolve('c')]).find((x) => { str += x; throw err; }))
			.to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('a'); });
	});
	it('should reject the promise if the handler returns a rejected promise', function () {
		const err = new Error('foobar');
		let str = '';
		return expect(River.from(['a', new Promise(r => setImmediate(() => r('b'))), 'c']).find((x) => { str += x; return Promise.reject(err); }))
			.to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('ac'); });
	});
});
