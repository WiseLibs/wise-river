'use strict';
const { expect } = require('chai');
const { callbackOnly } = require('../tools/invalid-args');
const River = require('../.');

const after = (ms, value) => new Promise((resolve) => {
	setTimeout(() => resolve(value), ms);
});

describe('.reduce()', function () {
	it('should return a rejected promise if invalid arguments are given', function () {
		const testRejected = (value) => {
			expect(value).to.not.be.an.instanceof(River);
			expect(value).to.be.an.instanceof(Promise);
			return expect(value).to.be.rejectedWith(TypeError);
		};
		return Promise.all(callbackOnly().map(args => testRejected(River.from(['a']).reduce(...args))));
	});
	it('should propagate rejections to the returned promise', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.reduce(x => x)).to.be.rejectedWith(err);
	});
	it('should apply the reducer to a river of items', function () {
		let invokedWith = '';
		const promise = River.from(['a', 'b', 'c']).reduce((x, y) => {
			invokedWith += `[${x}+${y}]`;
			if (y === 'c') return Promise.resolve(x + ',' + y + '(foo)');
			return x + ',' + y;
		});
		return expect(promise).to.become('a,b,c(foo)').then(() => {
			expect(invokedWith).to.equal('[a+b][a,b+c]');
		});
	});
	it('should accept an initial value', function () {
		let invokedWith = '';
		const promise = River.from(['a', 'b', 'c']).reduce((x, y) => {
			invokedWith += `[${x}+${y}]`;
			if (y === 'c') return Promise.resolve(x + ',' + y + '(foo)');
			return x + ',' + y;
		}, '(bar)');
		return expect(promise).to.become('(bar),a,b,c(foo)').then(() => {
			expect(invokedWith).to.equal('[(bar)+a][(bar),a+b][(bar),a,b+c]');
		});
	});
	it('should accept an initial value as a promise', function () {
		let ready = false;
		let invokedWith = '';
		const promise = River.from(['a', 'b', 'c']).reduce((x, y) => {
			expect(ready).to.be.true;
			invokedWith += `[${x}+${y}]`;
			if (y === 'c') return Promise.resolve(x + ',' + y + '(foo)');
			return x + ',' + y;
		}, after(20).then(() => { ready = true; return '(bar)' }));
		return expect(promise).to.become('(bar),a,b,c(foo)').then(() => {
			expect(invokedWith).to.equal('[(bar)+a][(bar),a+b][(bar),a,b+c]');
		});
	});
	it('should not invoke the callback when only one item is provided', function () {
		let invokedWith = '';
		const promise = River.from(['a']).reduce((x, y) => {
			invokedWith += `[${x}+${y}]`;
			if (y === 'c') return Promise.resolve(x + ',' + y + '(foo)');
			return x + ',' + y;
		});
		return expect(promise).to.become('a').then(() => {
			expect(invokedWith).to.equal('');
		});
	});
	it('should not invoke the callback when only an initial value is provided', function () {
		let ready = false;
		let invokedWith = '';
		const promise = River.from([]).reduce((x, y) => {
			invokedWith += `[${x}+${y}]`;
			if (y === 'c') return Promise.resolve(x + ',' + y + '(foo)');
			return x + ',' + y;
		}, after(20).then(() => { ready = true; return '(bar)' }));
		return expect(promise).to.become('(bar)').then(() => {
			expect(ready).to.be.true;
			expect(invokedWith).to.equal('');
		});
	});
	it('should return a NoDataError when no values are provided', function () {
		let invokedWith = '';
		const promise = River.from([]).reduce((x, y) => {
			invokedWith += `[${x}+${y}]`;
			if (y === 'c') return Promise.resolve(x + ',' + y + '(foo)');
			return x + ',' + y;
		});
		return expect(promise).to.be.rejectedWith(River.NoDataError).then(() => {
			expect(invokedWith).to.equal('');
		});
	});
	it('should use a concurrency of 1 when the callback returns a promise', function () {
		let invokedWith = '';
		let pending = 1;
		const promise = River.from(['a', 'b', 'c']).reduce((x, y) => {
			expect(pending).to.equal(0);
			invokedWith += `[${x}+${y}]`;
			if (y === 'a') {
				return x + ',' + y;
			}
			if (y === 'b') {
				pending += 1;
				return after(20).then(() => { pending -=1; return x + ',' + y + '(foo)'; });
			}
			if (y === 'c') {
				return x + ',' + y;
			}
			expect(false).to.be.true;
		}, after(20).then(() => { pending -= 1; return '(bar)' }));
		return expect(promise).to.become('(bar),a,b(foo),c').then(() => {
			expect(pending).to.equal(0);
			expect(invokedWith).to.equal('[(bar)+a][(bar),a+b][(bar),a,b(foo)+c]');
		});
	});
	it('should reject the promise if the handler throws', function () {
		const err = new Error('foobar');
		let str = '';
		return expect(River.from(['a', 'b', Promise.resolve('c')]).reduce((x) => { str += x; throw err; }))
			.to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('a'); });
	});
	it('should reject the promise if the handler returns a rejected promise', function () {
		const err = new Error('foobar');
		let str = '';
		return expect(River.from(['a', new Promise(r => setImmediate(() => r('b'))), 'c']).reduce((x) => { str += x; return Promise.reject(err); }))
			.to.be.rejectedWith(err)
			.then(() => new Promise(r => setImmediate(r)))
			.then(() => { expect(str).to.equal('a'); });
	});
});
