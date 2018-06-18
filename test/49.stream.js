'use strict';
const { expect } = require('chai');
const makeIterable = require('../tools/make-iterable');
const River = require('../.');
const WisePromise = River.Promise;

describe('.stream()', function () {
	describe('for WiseRiver', function () {
		it('should just return the same river', function () {
			let str = '';
			const river = River.from(['a', 'b', 'c']);
			const result = river.stream();
			expect(river).to.equal(result);
			river.pump(x => str += x);
			return expect(river).to.become(undefined).then(() => {
				expect(str).to.equal('abc');
			});
		});
	});
	describe('for WisePromise', function () {
		it('should propagate rejections to the returned river', function () {
			const err = new Error('foobar');
			const promise = new WisePromise((_, r) => setTimeout(() => r(err), 10));
			const river = promise.stream();
			expect(river).to.be.an.instanceof(River);
			return expect(river).to.be.rejectedWith(err);
		});
		it('should return a river that emits each item in the obtained array', function () {
			const data = [];
			const river = WisePromise.resolve([['foo'], 'bar', 'baz']).stream();
			expect(river).to.be.an.instanceof(River);
			river.pump(item => data.push(item));
			return river.then(() => {
				expect(data).to.deep.equal([['foo'], 'bar', 'baz']);
			});
		});
		it('should work with promises of non-array iterable objects', function () {
			const data = [];
			const river = WisePromise.resolve(makeIterable([['foo'], 'bar', 'baz'])).stream();
			expect(river).to.be.an.instanceof(River);
			river.pump(item => data.push(item));
			return river.then(() => {
				expect(data).to.deep.equal([['foo'], 'bar', 'baz']);
			});
		});
		it('should return a rejected river if an iterable is not obtained', function () {
			const river = WisePromise.resolve(123).stream();
			expect(river).to.be.an.instanceof(River);
			return expect(river).to.be.rejectedWith(TypeError);
		});
		it('should return a rejected river if iteration throws an exception', function () {
			const err = new Error('foobar');
			const river = WisePromise.resolve({ [Symbol.iterator]: () => ({ next() { throw err; } }) }).stream();
			expect(river).to.be.an.instanceof(River);
			return expect(river).to.be.rejectedWith(err);
		});
	});
});
