'use strict';
const { expect } = require('chai');
const River = require('../.');

describe('.stream()', function () {
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
