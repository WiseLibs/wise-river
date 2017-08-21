'use strict';
const { expect } = require('chai');

['NoDataError', 'Cancellation'].forEach((name) => {
	const CustomError = require('../.')[name];
	describe('class ' + name, function () {
		it('should be a subclass of Error', function () {
			expect(CustomError).to.be.a('function');
			expect(CustomError.prototype).to.be.an.instanceof(Error);
			expect(CustomError).to.not.equal(Error);
		});
		it('should use regular Error properties', function () {
			const error = new CustomError('foobar');
			expect(error.message).to.equal('foobar');
			expect(error.name).to.equal(name);
			expect(typeof error.stack).to.equal(typeof (new Error('baz').stack));
		});
		it('should be callable as a function', function () {
			const error = CustomError('foobarbaz');
			expect(error.message).to.equal('foobarbaz');
			expect(error.name).to.equal(name);
			expect(typeof error.stack).to.equal(typeof (Error('qux').stack));
		});
		it('should have the same property descriptors as a regular Error', function () {
			const getOwnPropertyDescriptors = (obj) => {
				const ret = {};
				for (const key of Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj))) {
					ret[key] = Object.getOwnPropertyDescriptor(obj, key);
				}
				return ret;
			};
			const aObject = Error('qux');
			const bObject = CustomError('qux');
			const a = getOwnPropertyDescriptors(aObject);
			const b = getOwnPropertyDescriptors(bObject);
			const aStack = (a.stack.value || a.stack.get.call(aObject)).split('\n')[0];
			const bStack = (b.stack.value || b.stack.get.call(bObject)).split('\n')[0];
			a.stack.value = '';
			b.stack.value = '';
			if (name === 'Cancellation' && typeof a.stack.get === 'function') {
				delete a.stack.get;
				delete a.stack.set;
			}
			expect(a).to.deep.equal(b);
			expect(bStack.replace(name, 'Error')).to.equal(aStack);
			expect(aStack).to.equal(String(aObject));
			expect(bStack).to.equal(String(bObject));
		});
		if (name === 'Cancellation') it('should not have a full stack trace', function () {
			expect(new CustomError('foobar').stack).to.equal(String(new CustomError('foobar')));
		});
	});
});
