'use strict';

module.exports = () => [
	[],
	[undefined],
	['foo'],
	[{}],
	[123],
	[Symbol()],
	[4.000001, () => {}],
	[-1, () => {}],
	[NaN, () => {}],
	[Infinity, () => {}],
	[0xffffffff + 1, () => {}],
	['foo', () => {}],
	['2px', () => {}],
	[{}, () => {}],
	[() => 2, () => {}],
	[() => {}, 4.000001],
	[() => {}, -1],
	[() => {}, NaN],
	[() => {}, Infinity],
	[() => {}, 0xffffffff + 1],
	[() => {}, 'foo'],
	[() => {}, '2px'],
	[() => {}, {}],
	[() => {}, () => 2],
	[() => {}, Symbol()],
	[0, 'foo'],
	[0, {}],
	[0, 123],
	['foo', 0],
	[{}, 0],
	[123, 0],
	[undefined, undefined]
];

module.exports.callbackOnly = () => module.exports().filter(([x]) => typeof x !== 'function');
