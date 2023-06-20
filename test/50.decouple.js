'use strict';
const { expect } = require('chai');
const River = require('../.');

const after = (ms, value) => new Promise((resolve) => {
	setTimeout(() => resolve(value), ms);
});

describe('.decouple()', function () {
	it('should propagate rejections to the returned river', function () {
		const err = new Error('foobar');
		const river = River.one(new Promise((_, r) => setTimeout(() => r(err), 10)));
		return expect(river.decouple()).to.be.rejectedWith(err);
	});
	it('should not propagate cancellations back to the source river', function () {
		const source = River.from([after(20), after(60), after(100)]);
		const dest = source.decouple();
		dest.pump(() => {})();
		const startTime = Date.now();
		return Promise.all([
			expect(source).to.become(undefined),
			expect(dest).to.be.rejectedWith(River.Cancellation),
		]).then(() => {
			expect(Date.now() - startTime).to.be.within(80, 120);
		});
	});
	it('should return a river with the same contents as the source', function () {
		let str = '';
		const source = River.from(['a', 'b', 'c']);
		const dest = source.decouple();
		expect(source).to.not.equal(dest);
		dest.pump(x => str += x);
		return expect(dest).to.become(undefined).then(() => {
			expect(str).to.equal('abc');
		});
	});
});
