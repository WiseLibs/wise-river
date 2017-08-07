'use strict';
const array = Symbol();
const length = Symbol();
const front = Symbol();

class FastQueue {
	
	constructor() {
		this[array] = new Array(16); // This must be a multiple of 2
		this[length] = 0;
		this[front] = 0;
	}
	
	push(value) {
		const arr = this[array];
		if (arr.length === this[length]) {
			arr.length *= 2;
			arrayMove(arr, arr.length, this[front]);
		}
		arr[(this[front] + this[length]++) & (arr.length - 1)] = value;
	}
	
	// This must not be invoked if isEmpty() is true
	shift() {
		const arr = this[array];
		const frontIndex = this[front];
		const ret = arr[frontIndex];
		arr[frontIndex] = undefined;
		this[front] = (frontIndex + 1) & (arr.length - 1);
		this[length] -= 1;
		return ret;
	}
	
	isEmpty() {
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
