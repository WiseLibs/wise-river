'use strict';
const descriptor = { writable: true, enumerable: false, configurable: true, value: 'Cancellation' };

function Cancellation(message) {
	if (new.target !== Cancellation) return new Cancellation(message);
	descriptor.value = '' + message;
	Object.defineProperty(this, 'message', descriptor);
	// NOTE: Not having stack traces is subject to change.
	// It may sometimes be useful to have cancellations with stack traces.
	descriptor.value = String(this);
	Object.defineProperty(this, 'stack', descriptor);
}
Object.setPrototypeOf(Cancellation.prototype, Error.prototype);
Object.defineProperty(Cancellation.prototype, 'name', descriptor);

module.exports = Cancellation;
