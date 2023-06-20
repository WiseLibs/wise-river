'use strict';
const { expect } = require('chai');
const River = require('../.');
const makeIterable = require('../tools/make-iterable');

describe('River.reject()', function () {
	it('should return a rejected river', function () {
		const err = new Error('foobar');
		const river = River.reject(err);
		expect(river).to.be.an.instanceof(River);
		return expect(river).to.be.rejectedWith(err);
	});
	it('should return a river that is not cancellable', function () {
		const err = new Error('foobar');
		const river = River.reject(err);
		river.pump(() => {})();
		return expect(river).to.be.rejectedWith(err);
	});
});

describe('River.never()', function () {
	it('should return a river that never emits data and never resolves', function () {
		const river = River.never();
		expect(river).to.be.an.instanceof(River);
		let noData = true;
		river.pump(() => noData = false);
		return Promise.race([river, new Promise(r => setTimeout(() => r(123), 50))]).then((result) => {
			expect(result).to.equal(123);
			expect(noData).to.equal(true);
		});
	});
	it('should return a river that can be cancelled', function () {
		const river = River.never();
		river.pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
});

describe('River.empty()', function () {
	it('should return a fulfilled river that never emits data', function () {
		const river = River.empty();
		expect(river).to.be.an.instanceof(River);
		let noData = true;
		let tooLate = false;
		river.pump(() => noData = false);
		setImmediate(() => tooLate = true);
		return river.then(() => {
			expect(noData).to.equal(true);
			expect(tooLate).to.equal(false);
		});
	});
	it('should return a river that is not cancellable', function () {
		const river = River.empty();
		river.pump(() => {})();
		return expect(river).to.become(undefined);
	});
});

describe('River.one()', function () {
	it('should return a river that emits only one item', function () {
		const river = River.one(['foobar']);
		expect(river).to.be.an.instanceof(River);
		const data = [];
		let tooLate = false;
		river.pump(item => data.push(item));
		setImmediate(() => tooLate = true);
		return river.then(() => {
			expect(data).to.deep.equal([['foobar']]);
			expect(tooLate).to.equal(false);
		});
	});
	it('should return a river that can be cancelled', function () {
		const river = River.one(['foobar']);
		river.pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
});

describe('River.from()', function () {
	it('should return a river that emits each item in the array', function () {
		const river = River.from([['foo'], 'bar', 'baz']);
		expect(river).to.be.an.instanceof(River);
		const data = [];
		let tooLate = false;
		river.pump(item => data.push(item));
		setImmediate(() => tooLate = true);
		return river.then(() => {
			expect(data).to.deep.equal([['foo'], 'bar', 'baz']);
			expect(tooLate).to.equal(false);
		});
	});
	it('should work with non-array iterable objects', function () {
		const river = River.from(makeIterable([['foo'], 'bar', 'baz']));
		expect(river).to.be.an.instanceof(River);
		const data = [];
		let tooLate = false;
		river.pump(item => data.push(item));
		setImmediate(() => tooLate = true);
		return river.then(() => {
			expect(data).to.deep.equal([['foo'], 'bar', 'baz']);
			expect(tooLate).to.equal(false);
		});
	});
	it('should return a rejected river if the argument is not an iterable object', function () {
		const river = River.from(123);
		expect(river).to.be.an.instanceof(River);
		return expect(river).to.be.rejectedWith(TypeError);
	});
	it('should return a river that can be cancelled', function () {
		const river = River.from([['foo'], 'bar', 'baz']);
		river.pump(() => {})();
		return expect(river).to.be.rejectedWith(River.Cancellation);
	});
});

describe('River.every()', function () {
	it('should return a cancellable river that emits on an interval', function () {
		const river = River.every(40);
		expect(river).to.be.an.instanceof(River);
		let count = 0;
		let successes = 0;
		let tooLate = false;
		const cancel = river.pump((x) => { expect(x).to.equal(undefined); count += 1 });
		const check = (expected) => () => { if (count === expected) successes += 1; }
		setTimeout(check(0), 20);
		setTimeout(check(1), 60);
		setTimeout(check(2), 100);
		setTimeout(() => { check(3)(); cancel(); }, 140);
		setTimeout(() => tooLate = true, 160);
		river.catchLater();
		return new Promise(r => setTimeout(r, 141)).then(() => {
			expect(count).to.equal(3);
			expect(successes).to.equal(4);
			return expect(river).to.be.rejectedWith(River.Cancellation);
		}).then(() => {
			expect(count).to.equal(3);
			expect(successes).to.equal(4);
			expect(tooLate).to.equal(false);
			return new Promise(r => setTimeout(r, 100));
		}).then(() => {
			expect(count).to.equal(3);
			expect(successes).to.equal(4);
		});
	});
	it('should treat time values as 32-bit integers', function () {
		const river = River.every('foobar');
		expect(river).to.be.an.instanceof(River);
		let count = 0;
		const cancel = river.pump((x) => { expect(x).to.equal(undefined); count += 1 });
		return new Promise(r => setTimeout(r, 40)).then(() => {
			cancel();
			expect(count).to.be.within(2, 60);
		});
	});
});

describe('River.combine()', function () {
	it('should return a river with the combined data of the given rivers', function () {
		const after = (ms, x) => new Promise(r => setTimeout(() => r(x), ms));
		const rivers = [
			River.one('a'),
			River.empty(),
			River.from(['b', after(40, 'c'), 'd']),
			River.one('e')
		];
		const river = River.combine(rivers);
		let str = '';
		river.pump(item => str += item);
		return after(16).then(() => {
			expect(str).to.equal('abde');
			return Promise.race([river, after(1, 123)]);
		}).then((value) => {
			expect(value).to.equal(123);
			expect(str).to.equal('abde');
			return Promise.race([river, after(30, 123)]);
		}).then((value) => {
			expect(value).to.equal(undefined);
			expect(str).to.equal('abdec');
		});
	});
	it('should accept regular promises', function () {
		const after = (ms, x) => new Promise(r => setTimeout(() => r(x), ms));
		const river = River.combine(123, after(40, 456), [789, River.from(['a', 'b', 'c'])]);
		let str = '';
		river.pump(item => str += item);
		return after(20).then(() => {
			expect(str).to.equal('abc');
			return Promise.race([river, after(2, 'qux')]);
		}).then((value) => {
			expect(value).to.equal('qux');
			expect(str).to.equal('abc');
			return Promise.race([river, after(30, 123)]);
		}).then((value) => {
			expect(value).to.equal(undefined);
			expect(str).to.equal('abc');
		});
	});
	it('should not affect any arguments if iteration throws', function () {
		const called = 0;
		const err = new Error('foobar');
		const promise = Promise.resolve();
		promise.then = function (a, b) { called += 1; return Promise.prototype.then.call(this, a, b); };
		const river = River.never();
		const combined = River.combine([promise, river], { [Symbol.iterator]: () => ({ next() { throw err; } }) });
		return expect(combined).to.be.rejectedWith(err).then(() => {
			return new Promise(r => setTimeout(r, 5));
		}).then(() => {
			expect(called).to.equal(0);
			const fail = () => { throw new Error('This river should not have been resolved'); }
			return Promise.race([river.then(fail, fail), new Promise(r => setTimeout(r, 5))]);
		});
	});
	it('should cancel all given rivers when itself is cancelled', function () {
		const rivers = [River.one('foo'), River.empty(), River.every(5), River.never()];
		const river = River.combine(rivers);
		river.pump(() => {})();
		return Promise.all([
			expect(river).to.be.rejectedWith(River.Cancellation),
			expect(rivers[0]).to.be.rejectedWith(River.Cancellation),
			expect(rivers[2]).to.be.rejectedWith(River.Cancellation),
			expect(rivers[3]).to.be.rejectedWith(River.Cancellation),
			expect(rivers[1]).to.become(undefined)
		]);
	});
});
