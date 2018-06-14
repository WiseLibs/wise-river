'use strict';

// FastQueue
exports.push = Symbol();
exports.shift = Symbol();
exports.peak = Symbol();
exports.destroy = Symbol();
exports.isEmpty = Symbol();

// CoObservable
exports.write = Symbol();
exports.attachHandler = Symbol();
exports.close = Symbol();
exports.isEmptyAndIdle = Symbol();
exports.use = Symbol();
exports.onabort = Symbol();
exports.onflush = Symbol();

// Warnings
const emitWarning = (() => {
	const hasEmitWarning = typeof process === 'object' && process !== null && typeof process.emitWarning === 'function';
	return hasEmitWarning ? process.emitWarning : msg => console.warn(msg);
})();
const warningHolder = { name: '', message: '' };
exports.warn = (message, from) => {
	if (from !== undefined && typeof Error.captureStackTrace === 'function') {
		warningHolder.message = message;
		Error.captureStackTrace(warningHolder, from);
		message = warningHolder.stack;
	} else if (message instanceof Error && message.stack) {
		message = message.stack;
	}
	emitWarning(message);
};
