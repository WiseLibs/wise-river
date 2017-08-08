'use strict';
const Promise = require('honest-promise');
const HonestStream = require('./lib/honest-stream');

Promise.prototype.stream = function stream() {
	return this.then(HonestStream.from);
};

module.exports = HonestStream;
module.exports.Promise = Promise;
