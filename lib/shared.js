'use strict';

// FastQueue
exports.push = Symbol();
exports.shift = Symbol();
exports.destroy = Symbol();
exports.isEmpty = Symbol();

// Observable
exports.write = Symbol();
exports.attachHandler = Symbol();
exports.close = Symbol();
exports.isEmptyAndIdle = Symbol();
exports.onabort = Symbol();
exports.onflush = Symbol();

// HonestStreamBase
let syncHandler = () => {};
const useSyncHandler = (a, b, c) => syncHandler(a, b, c);
exports.sync = (fn) => { syncHandler = fn; return useSyncHandler };
exports.useSync = useSyncHandler;

// Warnings
const warningHolder = { name: 'Warning', message: '' };
exports.warn = (message, from) => {
	warningHolder.message = message;
	Error.captureStackTrace(warningHolder, from);
	process.emitWarning(warningHolder.stack);
};