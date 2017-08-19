'use strict';

// FastQueue
exports.push = Symbol();
exports.shift = Symbol();
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
	const p = (new Function('return this'))().process;
	if (p != null && typeof p.emitWarning === 'function') return p.emitWarning;
	return msg => console.warn(msg);
})();
const warningHolder = { name: '', message: '' };
exports.warn = (message, from) => {
	warningHolder.message = message;
	Error.captureStackTrace(warningHolder, from);
	emitWarning(warningHolder.stack);
};
