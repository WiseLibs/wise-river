'use strict';
const { expect } = require('chai');
const FastQueue = require('../lib/fast-queue');
const shared = require('../lib/shared');

describe('[shared.push]', function () {
	it('should maintain cyclic buffer continuity', function () {
		const fq = new FastQueue((resolve) => resolve())
		fq[shared.push](0)
		expect(fq[shared.shift]()).to.equal(0)
		for (let i = 0; i < 17; i++) {
			fq[shared.push](i)
		}
		for (let i = 0; !fq[shared.isEmpty](); i++) {
			expect(fq[shared.shift]()).to.equal(i)
		}
	});
});
