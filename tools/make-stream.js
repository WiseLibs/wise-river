'use strict';
const { Readable } = require('stream');
const items = Symbol();
const finished = Symbol();
const dead = Symbol();

class Stream extends Readable {
	constructor(iterable) {
		super({ objectMode: true, highWaterMark: 2 });
		this[items] = Array.from(iterable);
		this[finished] = false;
		this[dead] = false;
	}
	get dead() {
		return this[dead];
	}
	_read() {
		setImmediate(function flow() {
			if (this[finished]) return;
			if (this[items].length === 0) {
				this.push(null);
				finish(this);
				return;
			}
			let item = this[items].shift();
			if (item instanceof Error) return void this.destroy(item);
			if (item === null) item = {};
			if (this.push(item)) setImmediate(flow.bind(this));
		}.bind(this));
	}
	_destroy(err, cb) {
		if (this[dead]) return void cb();
		finish(this);
		this[dead] = true;
		setImmediate(() => { this.emit('close'); });
		cb(err);
	}
}

const finish = (self) => {
	self[finished] = true;
	self[items] = [];
};

// Given an iterable object, this function returns a readable stream that emits
// the items found in the iterable object.
module.exports = (...args) => new Stream(...args);
