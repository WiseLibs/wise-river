'use strict';
const descriptor = { writable: true, enumerable: false, configurable: true, value: 'NoDataError' };

function NoDataError(message) {
	if (new.target !== NoDataError) return new NoDataError(message);
	Error.call(this, message);
	descriptor.value = '' + message;
	Object.defineProperty(this, 'message', descriptor);
	Error.captureStackTrace(this, NoDataError);
}
Object.setPrototypeOf(NoDataError.prototype, Error.prototype);
Object.defineProperty(NoDataError.prototype, 'name', descriptor);

module.exports = NoDataError;
