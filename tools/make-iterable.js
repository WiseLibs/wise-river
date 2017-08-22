'use strict';

// Given an array or array-like object, this function returns an iterable object
// that iterates directly through the array. The array is not copied or cloned.
module.exports = (arr) => {
	const obj = {};
	obj[Symbol.iterator] = () => {
		let i = 0;
		return { next: () => {
			return i < arr.length
			 ? { done: false, value: arr[i++] }
			 : (i = NaN, { done: true, value: undefined });
		} };
	};
	return obj;
};
