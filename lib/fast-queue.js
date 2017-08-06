'use strict';
const capacity = Symbol();
const length = Symbol();
const front = Symbol();

// TODO: benchmark is this is still useful in node v8.0.0 and v8.3.0
module.exports = class FastQueue {
	
	constructor() {
		this[capacity] = 8; // This must be a multiple of 2
		this[length] = 0;
		this[front] = 0;
	}
	
	push(value) {
		if (this[capacity] === this[length]) {
			arrayMove(this, this[capacity], this[front]);
			this[capacity] <<= 1;
		}
		this[(this[front] + this[length]++) & (this[capacity] - 1)] = value;
	}
	
	shift() {
		const frontIndex = this[front];
		const ret = this[frontIndex];
		this[frontIndex] = undefined;
		this[front] = (frontIndex + 1) & (this[capacity] - 1);
		this[length] -= 1;
		return ret;
	}
};

const arrayMove = (array, moveBy, len) => {
	for (let i = 0; i < len; ++i) {
		array[i + moveBy] = array[i];
		array[i] = undefined;
	}
};
