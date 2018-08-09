'use strict';
const Promise = require('wise-promise');
const shared = require('./shared');
const array = Symbol();
const length = Symbol();
const front = Symbol();

/*
	FastQueue is a dynamically-sized queue implemented with a circular buffer.
	Its push() and shift() functions are very simple O(1) calculations.
	It performs much better than using a regular array as a queue.
	It's a subclass of Promise only because WiseRiverBase must be a subclass
	of Promise, and JavaScript does not support multiple inheritance.
 */
class FastQueue extends Promise {
	
	constructor(fn) {
		super(fn);
		this[array] = new Array(16); // ASSERT: This must be a power of 2
		this[length] = 0;
		this[front] = 0;
	}
	
	[shared.push](value) {
		const arr = this[array];
		if (arr.length === this[length]) {
			arr.length *= 2;
			arrayMove(arr, this[length], this[front]);
		}
		arr[(this[front] + this[length]++) & (arr.length - 1)] = value;
	}
	
	// ASSERT: This must not be invoked if isEmpty() is true
	[shared.shift]() {
		const arr = this[array];
		const frontIndex = this[front];
		const ret = arr[frontIndex];
		arr[frontIndex] = undefined;
		this[front] = (frontIndex + 1) & (arr.length - 1);
		this[length] -= 1;
		return ret;
	}
	
	[shared.peak]() {
		if (this[length] === 0) return;
		return this[array][this[front]];
	}
	
	// ASSERT: The push() and shift() methods must not be invoked after this is invoked
	[shared.destroy]() {
		this[array] = undefined;
		this[length] = 0;
	}
	
	[shared.isEmpty]() {
		return this[length] === 0;
	}
}

const arrayMove = (arr, moveBy, len) => {
	for (let i = 0; i < len; ++i) {
		arr[i + moveBy] = arr[i];
		arr[i] = undefined;
	}
};

module.exports = FastQueue;
