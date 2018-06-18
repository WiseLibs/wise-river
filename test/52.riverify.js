'use strict';
const { expect } = require('chai');
const { Writable } = require('stream');
const makeStream = require('../tools/make-stream');
const River = require('../.');

describe('River.riverify()', function () {
	describe('for unsupported values', function () {
		it('should return a rejected river', function () {
			const test = (...args) => expect(River.riverify(...args)).to.be.rejectedWith(TypeError);
			return Promise.all([
				test(),
				test(undefined),
				test(null),
				test('foo'),
				test({}),
				test(123),
				test(NaN),
				test(Symbol()),
				test([]),
				test(() => {}),
				test(new Writable),
			]);
		});
	});
	describe('for stream objects', function () {
		it('should return an empty river for an empty stream', function () {
			const stream = makeStream([]);
			const river = River.riverify(stream);
			let str = '';
			river.pump(x => str += x);
			return expect(river).to.become(undefined).then(() => {
				expect(str).to.equal('');
				expect(stream.dead).to.be.true;
			});
		});
		it('should return a river emitting the same data as the stream', function () {
			const stream = makeStream(['a', 'b', 'c', 'd', 'e']);
			const river = River.riverify(stream);
			let str = '';
			river.pump(x => str += x);
			return expect(river).to.become(undefined).then(() => {
				expect(str).to.equal('abcde');
				expect(stream.dead).to.be.true;
			});
		});
		it('should propagate errors emitted by the stream', function () {
			const err = new Error('foobar');
			const stream = makeStream(['a', 'b', err, 'd', 'e']);
			const river = River.riverify(stream);
			let str = '';
			river.pump(x => str += x);
			return expect(river).to.be.rejectedWith(err).then(() => {
				expect(str).to.equal('ab');
				expect(stream.dead).to.be.true;
			});
		});
		it('should return a rejected river if the stream is destroyed prematurely', function () {
			const stream = makeStream(['a', 'b', 'c', 'd', 'e']);
			const river = River.riverify(stream);
			let str = '';
			river.pump((x) => {
				str += x;
				if (x === 'c') stream.destroy();
			});
			return expect(river).to.be.rejectedWith(River.DataError).then(() => {
				expect(str).to.equal('abc');
				expect(stream.dead).to.be.true;
			});
		});
		it('should respect the "decouple" option', function () {
			const stream = makeStream(['a', 'b', 'c', 'd', 'e']);
			const river = River.riverify(stream, { decouple: true });
			let str = '';
			river.pump(x => str += x);
			return expect(river).to.become(undefined).then(() => {
				expect(str).to.equal('abcde');
				expect(stream.dead).to.be.false;
			});
		});
	});
	describe('for async iterable objects', function () {
		it('should be tested');
	});
});
