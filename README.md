# honest-stream [![Build Status](https://travis-ci.org/JoshuaWise/honest-stream.svg?branch=master)](https://travis-ci.org/JoshuaWise/honest-stream)

### The problem

There are many opinionated (or broken) object streaming solutions in Node.js. They have unique APIs, they often require subclassing and other boilerplate to accomplish simple tasks, and their composability often falls apart in the event of errors.

### The solution

The plural form of a regular value is an iterable. The plural form of a promise is, at its core, an object stream. This library aims to honor that notion.

`HonestStreams` are used to aggregate promises (or regular values) concurrently. Unlike many styles of streams, `HonestStream` does not maintain the same sequence of items as they were supplied. It will output items as soon as they are resolved (see [Ordered Streams](#ordered-streams) to accomplish the alternative).

`HonestStreams` inherit from `Promise` ([`HonestPromise`](https://github.com/JoshuaWise/honest-promise)). If an error occurs in a stream, the stream will be rejected, along with all streams that originate from it. If no error occurs, the stream will be fulfilled with `undefined` when all of its items have been passed on.

## Installation

```bash
npm install --save honest-stream
```

## Usage

```js
const Stream = require('honest-stream');

const stream = new Stream(function (resolve, reject, write) {
  const socket = connect();
  socket.on('data', write);
  socket.on('end', resolve);
  socket.on('error', reject);
});

stream
  .map(parseMessages)
  .forEach(logMessages)
  .observe(processMessages)
  .then(() => console.log('connection ended!'));
```

# API

## new Stream(*handler*)

This creates and returns a new stream. `handler` must be a function with the following signature:

`function handler(resolve, reject, write)`

 1. `write` is used to give values (or promises of values) to the stream. The stream will not be fulfilled until all written values have been processed and consumed. After the stream is resolved, this becomes a no-op.
 2. `resolve` behaves the same as with regular promises, except that the fulfillment value of a Stream is always `undefined`. The stream's fulfillment can still be delayed by passing a promise. After invoking this function you cannot `write` any more values to the stream.
 3. `reject` behaves the same as with regular promises. After a stream is rejected, all processing stops and any values in the stream are discarded.

### *static* Stream.from(*iterable*) -> *stream*

Constructs a new stream from an `iterable` object of promises or values (or a mix thereof). Each item in the `iterable` object is immediately written to the stream in order.

### *static* Stream.combine(*...streams*) -> *stream*

Returns a new stream that contains the combination of all the values of all the given streams. The returned stream will not be fulfilled until all the given streams have been fulfilled. If any of the given streams are rejected, this stream is rejected too.

You can pass an array of streams or pass them as individual arguments (or a mix thereof).

### .fork([*count = 2*]) -> *array of streams*

Forks a stream into several destination streams, and returns an array of those streams. By default it will fork into two branches, or you can specify exactly how many branches you want.

### .map([*concurrency*], *callback*) -> *stream*

Transforms the stream's data through the provided `callback` function, and passes the resulting data to a new stream returned by this method. If the `callback` returns a promise, its value will be awaited before being passed on to the destination stream.

If a `concurrency` number is provided, only that many items will be processed at a time. The default is `0` which signifies infinite concurrency.

If `callback` throws an exception or returns a rejected promise, processing will stop and the stream will be rejected with the same error.

```js
Stream.from(['foo.txt', 'bar.txt'])
  .map(readFile)
  .observe(console.log);
// => "this is bar!"
// => "this is foo!"
```

### .forEach([*concurrency*], *callback*) -> *stream*

Similar to [`.map()`](#mapconcurrency-callback---stream), except the stream's data will not be changed. If the callback returns a promise, it will still be awaited, but it will not determine the data that is passed on to the destination stream. This method is primarily used for side effects.

### .filter([*concurrency*], *callback*) -> *stream*

Similar to [`.forEach()`](#foreachconcurrency-callback---stream), but the items will be filtered by the provided callback function (just like [`Array#filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter)). Filtering will occur based on the truthiness of the callback's return value. If the callback returns a promise, its value will be awaited before being used in the filtering process.

### .reduce(*callback*, [*initialValue*]) -> *promise*

Applies the `callback` function against an accumulator and each piece of data in the stream. This method returns a promise for the final result of the reduction. If no `initialValue` is provided and the stream only receives one item, that item will become the fulfillment value without invoking the callback function. If no `initialValue` is provided and the stream receives *no* items, the stream will be fulfilled with `undefined`.

If the `initialValue` is a promise, its value will be awaited before starting the reduction process. If the `callback` returns a promise, it will be awaited before processing the next piece of data against the accumulator. Keep in mind that the `callback` function will process data in the order that the stream receives it.

`callback` has the signature: `function callback(accumulator, value)`

```js
Stream.from(['Jonathan', 'Robert', 'Jennifer'])
  .map(getNickname)
  .reduce((a, b) => a + ', ' + b)
  .log();
// => "Jen, John, Rob"
```

### .merge() -> *promise*

Constructs an array containing all data from the stream. When all data has been received, the returned promise will fulfill with that array. The items in the array will appear in the order that the stream received them.

```js
Stream.from(['a', 'b', 'c'])
  .map(delayByRandomAmount)
  .map(str => str + str)
  .merge()
  .log();
// => ["bb", "cc", "aa"]
```

### .drain() -> *promise*

Streams cannot be fulfilled until all of their data has been consumed. Sometimes they are consumed by new streams (such as in [`.map()`](#mapconcurrency-callback---stream)). Other times they are consumed by processes that result in singular values ([`.merge()`](#merge---this), [`.reduce()`](#reducecallback-initialvalue---this)).

`.drain()` provides the simplest method of consumption, simply discarding each item in the stream. The returned promise will be fulfilled or rejected as the stream is fulfilled or rejected.

```js
new Stream(infiniteSource)
  .forEach(processData)
  .drain();
```

## Ordered Streams

If you need streams to process their data *in order*, just set the `concurrency` control on each stream to `1`.

```js
new Stream(source)
  .filter(1, sanitizeData)
  .map(1, processData)
  .forEach(1, saveData)
  .drain();
```

Some methods don't have concurrency control ([`.merge()`](#merge---this), [`.reduce()`](#reducecallback-initialvalue---this), [`.fork()`](#forkcount-2---array-of-promises)). But don't worry, these methods will maintain order automatically.

## License

[MIT](https://github.com/JoshuaWise/honest-stream/blob/master/LICENSE)
