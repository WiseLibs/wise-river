'use strict';
const { expect } = require('chai');
const River = require('../.');

describe('River.isRiver()', function () {
	describe('should return false when', function () {
		specify('given: undefined', function () {
			expect(River.isRiver()).to.be.false;
			expect(River.isRiver(undefined)).to.be.false;
		});
		specify('given: null', function () {
			expect(River.isRiver(null)).to.be.false;
		});
		specify('given: 0', function () {
			expect(River.isRiver(0)).to.be.false;
		});
		specify('given: 123', function () {
			expect(River.isRiver(123)).to.be.false;
		});
		specify('given: true', function () {
			expect(River.isRiver(true)).to.be.false;
		});
		specify('given: false', function () {
			expect(River.isRiver(false)).to.be.false;
		});
		specify('given: "foo"', function () {
			expect(River.isRiver('foo')).to.be.false;
		});
		specify('given: {}', function () {
			expect(River.isRiver({})).to.be.false;
		});
		specify('given: []', function () {
			expect(River.isRiver([])).to.be.false;
		});
		specify('given: { then() {} }', function () {
			expect(River.isRiver({ then() {} })).to.be.false;
		});
		specify('given: Promise.resolve()', function () {
			expect(River.isRiver(global.Promise.resolve())).to.be.false;
		});
		specify('given: WisePromise.resolve()', function () {
			expect(River.isRiver(River.Promise.resolve())).to.be.false;
		});
		specify('given: Object.create(WiseRiver.prototype)', function () {
			expect(River.isRiver(Object.create(River.prototype))).to.be.false;
		});
	});
	describe('should return true when', function () {
		specify('given: new River()', function () {
			expect(River.isRiver(new River(() => {}))).to.be.true;
		});
		specify('given: River.reject()', function () {
			const river = River.reject(new Error('foo'));
			river.catchLater();
			expect(River.isRiver(river)).to.be.true;
		});
		specify('given: River.never()', function () {
			expect(River.isRiver(River.never())).to.be.true;
		});
		specify('given: River.empty()', function () {
			expect(River.isRiver(River.empty())).to.be.true;
		});
		specify('given: River.one()', function () {
			expect(River.isRiver(River.one({}))).to.be.true;
		});
	});
});
