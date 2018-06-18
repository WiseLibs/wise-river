'use strict';
const { expect } = require('chai');
const River = require('../.');

describe('.fork()', function () {
	it('should throw a TypeError if an invalid count is given', function () {
		expect(() => River.from(['a']).fork(null)).to.throw(TypeError);
		expect(() => River.from(['a']).fork(0)).to.throw(TypeError);
		expect(() => River.from(['a']).fork(-2)).to.throw(TypeError);
		expect(() => River.from(['a']).fork(2.000001)).to.throw(TypeError);
		expect(() => River.from(['a']).fork(NaN)).to.throw(TypeError);
		expect(() => River.from(['a']).fork(Infinity)).to.throw(TypeError);
		expect(() => River.from(['a']).fork('2')).to.throw(TypeError);
		expect(() => River.from(['a']).fork('foobar')).to.throw(TypeError);
	});
	it('should return an array with the given number of branches', function () {
		const river = River.empty();
		const countTest = (count, value) => {
			expect(Array.isArray(value)).to.equal(true);
			expect(value.length).to.equal(count);
		};
		countTest(2, river.fork());
		countTest(1, river.fork(1));
		countTest(47, river.fork(47));
	});
	it('should propagate data to the branches', function () {
		const source = River.from(['a', 'b', 'c']);
		let str = '';
		source.fork(3).forEach(f => f.pump(x => str += x));
		return expect(source.then(() => str)).to.become('aaabbbccc');
	});
	it('should propagate fulfillment, but respect forks that are processing', function () {
		const err = new Error('bar');
		const source = River.one('foo');
		const forks = source.fork(4);
		let str = '';
		source.then(() => str += '1');
		forks[0].pump(() => str += 'a');
		forks[1].pump(() => new Promise(r => setTimeout(() => { str += 'b'; r(); }, 20)));
		forks[2].pump(() => { throw err; });
		forks[3].pump(() => str += 'd');
		forks[0].then(() => str += 'w');
		forks[1].then(() => str += 'x');
		forks[2].then(() => str += 'y', () => {});
		forks[3].then(() => str += 'z');
		return Promise.all([
			new Promise(r => setTimeout(r, 10)),
			expect(forks[2]).to.be.rejectedWith(err)
		]).then(() => {
			expect(str).to.equal('ad1wz');
			return new Promise(r => setTimeout(r, 20));
		}).then(() => {
			expect(str).to.equal('ad1wzbx');
		});
	});
	it('should propagate rejections, but respect forks that are resolved', function () {
		const err = new Error('foobar');
		const source = River.from([new Promise((_, r) => setTimeout(() => r(err), 2)), 'a']);
		const forks = source.fork(3);
		let str = '';
		forks.map(f => f.pump(x => str += x))[1]();
		return Promise.all([
			expect(forks[0]).to.be.rejectedWith(err),
			expect(forks[1]).to.be.rejectedWith(River.Cancellation),
			expect(forks[2]).to.be.rejectedWith(err)
		]).then(() => {
			expect(str).to.equal('aa');
		});
	});
	it('should require all forks to be cancelled for the source to be cancelled', function () {
		const source = River.every(10);
		const forks = source.fork(4);
		let str = '';
		forks[0].pump(() => {})();
		const cancel1 = forks[1].pump(() => str += 'a');
		const cancel2 = forks[2].pump(() => str += 'b');
		const cancel3 = forks[3].pump(() => str += 'c');
		source.catch(() => str += 'z');
		return expect(forks[0]).to.be.rejectedWith(River.Cancellation).then(() => {
			expect(str).to.equal('');
			return new Promise(r => setTimeout(r, 10));
		}).then(() => {
			expect(str).to.equal('abc');
			cancel1();
			cancel3();
			forks[1].catchLater();
			forks[3].catchLater();
			return new Promise(r => setTimeout(r, 10));
		}).then(() => {
			expect(str).to.equal('abcb');
			cancel2();
			forks[2].catchLater();
		}).then(() => {
			expect(str).to.equal('abcbz');
			return expect(source).to.be.rejectedWith(River.Cancellation);
		});
	});
});
