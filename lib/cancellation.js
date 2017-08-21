'use strict';
const descriptor = { writable: true, enumerable: false, configurable: true, value: 'Cancellation' };

function Cancellation(message) {
	if (new.target !== Cancellation) return new Cancellation(message);
	descriptor.value = '' + message;
	Object.defineProperty(this, 'message', descriptor);
	descriptor.value = String(this);
	Object.defineProperty(this, 'stack', descriptor);
}
Object.setPrototypeOf(Cancellation.prototype, Error.prototype);
Object.defineProperty(Cancellation.prototype, 'name', descriptor);

module.exports = Cancellation;
