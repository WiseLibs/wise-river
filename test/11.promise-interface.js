'use strict';
const { expect } = require('chai');
const River = require('../.');

describe('Promise interface', function () {
	it('should inherit from the native Promise', function () {
		expect(River.prototype).to.be.an.instanceof(Promise);
		expect(new River(() => {})).to.be.an.instanceof(Promise);
	});
	it('should mirror native promises when a resolver function is not given', function () {
		expect(() => new Promise()).to.throw(TypeError);
		expect(() => new Promise(123)).to.throw(TypeError);
		expect(() => new Promise({})).to.throw(TypeError);
		expect(() => new River()).to.throw(TypeError);
		expect(() => new River(123)).to.throw(TypeError);
		expect(() => new River({})).to.throw(TypeError);
	})
	it('should not return a river when using .then()', function () {
		const river = new River(() => {});
		const promise = river.then();
		expect(promise).to.not.be.an.instanceof(River);
		expect(promise).to.be.an.instanceof(Promise);
	});
	it('should not allow the use of confusing inherited static methods', function () {
		expect(() => River.resolve()).to.throw(TypeError);
		expect(() => River.all([])).to.throw(TypeError);
		expect(() => River.race([])).to.throw(TypeError);
		expect(() => River.any([])).to.throw(TypeError);
		expect(() => River.settle([])).to.throw(TypeError);
		expect(() => River.props({})).to.throw(TypeError);
		expect(() => River.after(1)).to.throw(TypeError);
	});
	it('should always be fulfilled with undefined', function () {
		return expect(new River((resolve, reject) => resolve(123)))
			.to.become(undefined);
	});
	it('should be rejected like regular promises', function () {
		const err = new Error('foobar');
		return expect(new River((resolve, reject) => reject(err)))
			.to.be.rejectedWith(err);
	});
	it('should hang pending like regular promises', function (done) {
		const fail = () => { done(new Error('This river should not have been resolved')); }
		new River(() => {}).then(fail, fail);
		setTimeout(done, 50);
	});
});
