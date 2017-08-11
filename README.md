# honest-stream [![Build Status](https://travis-ci.org/JoshuaWise/honest-stream.svg?branch=master)](https://travis-ci.org/JoshuaWise/honest-stream)

This is an implementation of object streaming (observables) that provides:
- Fast performance and low overhead
- Simple and absolute concurrency control
- A subclass of the native Promise (*dependability*)
- Seamless integration with itself, promises, and the Node.js ecosystem (*see below*)

##### "The Observable Manifesto"
An observable is the plural form of a promise, **therefore, its API should be familiar and composable with promises**.

## Installation

```bash
npm install --save honest-stream
```

## Usage

```js
const Stream = require('honest-stream');

const messages = new Stream((resolve, reject, write) => {
  const socket = connectToServer();
  socket.on('data', write);
  socket.on('end', resolve);
  socket.on('error', reject);
});

messages
  .map(parseMessages)
  .forEach(logMessages)
  .observe(processMessages)
  .then(() => console.log('connection ended!'));
```

## Why this implementation?

Most object streams in Node.js are highly opinionated, and they often don't compose well with promises (the sanctioned asynchronous primitive for JavaScript). Even the streams provided by the standard library exhibit many of these problems:
  1. They usually require subclassing or other boilerplate to accomplish simple tasks
  2. They don't handle errors consistently or reliably
  3. Their composability with the rest of the Node.js ecosystem is often weak and limited

Object streams should *feel* like regular promises, but provide the ability to easily operate on promises as a collection (just like arrays and values).

## Unopinionated by default

Unlike many styles of streams, an HonestStream does not preserve sequence/order, allowing for maximum concurrency by default (we don't make assumptions of what you're using it for!). However, HonestStream gives you total concurrency control, and therefore it can be made to process items in sequence if desired (see [Ordered Streams](#ordered-streams)).

HonestStreams inherit from the native `Promise` ([`HonestPromise`](https://github.com/JoshuaWise/honest-promise)). If an error occurs in a stream, the stream will be rejected, along with all streams that originate from it. If no error occurs, the stream will be fulfilled with `undefined` when all of its items have been been consumed.

# API

## new Stream(*handler*)

Creates and returns a new stream. `handler` must be a function with the following signature:

`function handler(resolve, reject, write)`

 1. `write(x)` is used to give values (or promises of values) to the stream. The stream will not be fulfilled until all written values have been consumed. After the stream is resolved, this becomes a no-op.
 2. `resolve(x)` behaves the same as with regular promises, except that the fulfillment value of a Stream is always `undefined`. The stream's fulfillment can still be delayed by passing a promise. After invoking this function you cannot `write` any more values to the stream.
 3. `reject(x)` behaves the same as with regular promises. After a stream is rejected, all processing stops and any values in the stream are discarded.

### .observe([*concurrency*], *callback*) -> *this*

*This is the most primitive method of an HonestStream. All other methods are derived from this one.*

Registers the `callback` function to be invoked for each item that enters the stream. The callback can return a promise to indicate that it is "processing" the item. If a `concurrency` number is provided, only that many items will be processed at a time. The default is `0` which signifies infinite concurrency.

If the `callback` throws an exception or returns a rejected promise, the stream will stop and will be rejected with the same error.

A stream cannot have two observers at the same time. If you invoke this method again on the same stream, the old `callback` and `concurrency` values will be replaced by the new ones.

### .fork(*count = 2*) -> *array of streams*

Forks a stream into several destinations and returns an array of those streams. By default it will fork into two branches, but you can specify exactly how many branches you want.

### .map([*concurrency*], *callback*) -> *stream*

Transforms the stream's data through the provided `callback` function, and passes the resulting data to a new stream returned by this method. If the `callback` returns a promise, its value will be awaited before being passed to the destination stream.

If a `concurrency` number is provided, only that many items will be processed at a time. The default is `0` which signifies infinite concurrency.

If the `callback` throws an exception or returns a rejected promise, processing will stop and the stream will be rejected with the same error.

```js
Stream.from(['foo.txt', 'bar.txt'])
  .map(readFile)
  .observe(console.log);
// => "this is bar!"
// => "this is foo!"
```

### .forEach([*concurrency*], *callback*) -> *stream*

Similar to [`.map()`](#mapconcurrency-callback---stream), except the stream's data will not be changed. If the callback returns a promise, it will still be awaited, but it will not determine the data that is passed to the destination stream. This method is primarily used for side effects.

### .filter([*concurrency*], *callback*) -> *stream*

Similar to [`.forEach()`](#foreachconcurrency-callback---stream), but the items will be filtered by the provided callback function (just like [`Array#filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter)). Filtering will occur based on the truthiness of the callback's return value. If the callback returns a promise, its value will be awaited before being used in the filtering process.

### .reduce(*callback*, [*initialValue*]) -> *promise*

Applies the `callback` function against an accumulator and each piece of data in the stream. This method returns a promise for the final result of the reduction. If no `initialValue` is provided and the stream only receives one item, that item will become the fulfillment value without invoking the callback function. If no `initialValue` is provided and the stream receives *no* items, the stream will be fulfilled with `undefined`.

If the `initialValue` is a promise, its value will be awaited before starting the reduction process. If the `callback` returns a promise, it will be awaited before processing the next piece of data against the accumulator. Keep in mind that the `callback` function will process data in the order that the stream receives it.

`callback` has the signature: `function callback(accumulator, value)`

```js
Stream.from(['Jonathan', 'Robert', 'Jennifer'])
  .map(fetchNickname)
  .reduce((a, b) => a + ', ' + b)
  .log();
// => "Jen, John, Rob"
```

### .merge() -> *promise*

Constructs an array containing all data from the stream, and returns a promise for that array. The items in the array will appear in the order that the stream received them.

```js
Stream.from(['a', 'b', 'c'])
  .forEach(delayByRandomAmount)
  .map(str => str + str)
  .merge()
  .log();
// => ["bb", "cc", "aa"]
```

### .drain() -> *promise*

Streams cannot be fulfilled until all of their data has been consumed. Sometimes the data is consumed by a new stream (such as in [`.map()`](#mapconcurrency-callback---stream)), while other times it is consumed by a process for a single value ([`.merge()`](#merge---promise), [`.reduce()`](#reducecallback-initialvalue---promise)).

`.drain()` is the simplest method of consumption, simply discarding each item in the stream. The returned promise will be fulfilled or rejected as the stream is fulfilled or rejected.

```js
new Stream(infiniteSource)
  .forEach(processData)
  .drain();
```

### *static* Stream.from(*iterable*) -> *stream*

Constructs a new stream from an `iterable` object of promises or values (or a mix thereof). Each item in the `iterable` object is immediately written to the stream in order.

### *static* Stream.combine(*...streams*) -> *stream*

Returns a new stream that contains the combination of all the values of all the given streams. The returned stream will not be fulfilled until all the given streams have been fulfilled. If any of the given streams are rejected, this stream is rejected too.

You can pass an array of streams or pass them as individual arguments (or a mix thereof).

## Ordered Streams

If you need a stream to process its data *in order*, just set its `concurrency` to `1`.

```js
new Stream(source)
  .filter(1, sanitizeData)
  .map(1, processData)
  .forEach(1, saveData)
  .drain();
```

Some methods don't have concurrency control ([`.merge()`](#merge---promise), [`.reduce()`](#reducecallback-initialvalue---promise), [`.fork()`](#forkcount--2---array-of-streams)). But don't worry, these methods will maintain order automatically.

## License

[MIT](https://github.com/JoshuaWise/honest-stream/blob/master/LICENSE)
