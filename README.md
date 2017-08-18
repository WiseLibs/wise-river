<a href="https://promisesaplus.com/"><img src="https://promisesaplus.com/assets/logo-small.png" align="right" /></a>
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

const messages = new Stream((resolve, reject, write, free) => {
  const socket = connectToServer();
  socket.on('data', write);
  socket.on('end', resolve);
  socket.on('error', reject);
  free(() => socket.destroy());
});

messages
  .map(parseMessages)
  .forEach(logMessages)
  .consume(processMessages)
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

`function handler(resolve, reject, write, free)`

 1. `write(x)` is used to give values (or promises of values) to the stream. The stream will not be fulfilled until all written values have been consumed. After the stream is resolved, this becomes a no-op.
 2. `resolve(x)` behaves the same as with regular promises, except that the fulfillment value of a Stream is always `undefined`. The stream's fulfillment can still be delayed by passing a promise. After invoking this function you cannot `write` any more values to the stream.
 3. `reject(x)` behaves the same as with regular promises. After a stream is rejected, all processing stops and any values in the stream are discarded.
 4. `free(fn)` is used to specify *destructor functions*, which will be invoked when the stream is closed (regardless of success or failure). This is for freeing the underlying resources that the stream relied on (if any).

### .observe([*concurrency*], *callback*) -> *function*

*This is the most primitive method of an HonestStream. All high-level methods are derived from this one.*

Registers the `callback` function to be invoked for each item that enters the stream. The callback can return a promise to indicate that it is "processing" the item. If a `concurrency` number is provided, only that many items will be processed at a time. The default is `0` which signifies infinite concurrency.

If the `callback` throws an exception or returns a rejected promise, the stream will stop and will be rejected with the same error.

Streams will buffer their content until `observe()` (or a higher-level method of consumption) is used. Each stream can only have a single consumer. If you try to `observe()` the same stream twice, a warning will be emitted and the second observer will never receive any data. In other words, the stream will look like an empty stream (except to the first observer). This way, observers either get "all or nothing" — it's impossible to receive a partial representation of the stream's content.

This method returns a function (`"cleanup"`), which will dispose of the stream's underlying resources (if any). If you're using this low-level method, it's your responsibility to ensure that `cleanup` is eventually called, regardless of success or failure. If you're piping the stream's content to a *new* stream, you should simply pass `cleanup` to the fourth parameter of the HonestStream constructor (`free()`). If you try to `observe()` the same stream twice, invocations after the first will return a no-op function; only the *first* observer (the consumer) has authority over the stream's resources.

If `cleanup` is called before the stream is resolved, the stream will be rejected with a `Cancellation` error, which is just a subclass of `Error`.

`Cancellations` don't have stack traces. `Cancellation` is available at `Stream.Cancellation`.

### .fork(*count = 2*) -> *array of streams*

Forks a stream into several destinations and returns an array of those streams. By default it will fork into two branches, but you can specify exactly how many branches you want.

### .map([*concurrency*], *callback*) -> *stream*

Transforms the stream's data through the provided `callback` function, and passes the resulting data to a new stream returned by this method. If the `callback` returns a promise, its value will be awaited before being passed to the destination stream.

If a `concurrency` number is provided, only that many items will be processed at a time. The default is `0` which signifies infinite concurrency.

If the `callback` throws an exception or returns a rejected promise, processing will stop and the stream will be rejected with the same error.

```js
Stream.from(['foo.txt', 'bar.txt'])
  .map(readFile)
  .consume(console.log);
// => "this is bar!"
// => "this is foo!"
```

The `.map()` method also doubles as a stereotypical `flatMap()`. If the `callback` returns an HonestStream, its values will be forwarded to the stream returned by this method.

### .forEach([*concurrency*], *callback*) -> *stream*

Similar to [`.map()`](#mapconcurrency-callback---stream), except the stream's data will not be changed. If the callback returns a promise, it will still be awaited, but it will not determine the data that is passed to the destination stream. This method is primarily used for side effects.

### .filter([*concurrency*], *callback*) -> *stream*

Similar to [`.forEach()`](#foreachconcurrency-callback---stream), but the items will be filtered by the provided callback function (just like [`Array#filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter)). Filtering will occur based on the truthiness of the callback's return value. If the callback returns a promise, its value will be awaited before being used in the filtering process.

### .distinct([*equalsFunction*]) -> *stream*

Returns a new stream with the same content as the current one, except that it never emits two consecutive items of equal value. By default the `===` operator is used for checking equality, but you can optionally pass in a custom `equalsFunction` to be used instead.

`equalsFunction` has the signature: `function equals(previousValue, nextValue) -> boolean`

### .throttle(*milliseconds*) -> *stream*

Returns a new stream that will not emit more than one item every specified number of `milliseconds`. If the stream receives data too quickly, some data will be discarded.

### .debounce(*milliseconds*) -> *stream*

Returns a new stream that will defer its latest data event until the specified number of `milliseconds` has passed since receiving data. If the stream receives data too quickly, all data (except the most recent) will be discarded.

### .timeoutBetweenEach(*milliseconds*, [*reason*]) -> *stream*

Returns a new stream that will be rejected with a `TimeoutError` if the specified number of `milliseconds` passes without the stream receiving any new data. The timer starts immediately when this method is invoked.

If you specify a string `reason`, the `TimeoutError` will have `reason` as its message. Otherwise, a default message will be used. If `reason` is an `instanceof Error`, it will be used instead of a `TimeoutError`.

`TimeoutError` is available at `Stream.TimeoutError`.

### .consume([*concurrency*], *callback*) -> *promise*

Similar to [`.forEach()`](#foreachconcurrency-callback---stream), but the stream's content is discarded instead of being piped to a new stream. This method returns a promise which will be fulfilled or rejected as the stream is fulfilled or rejected.

```js
new Stream(infiniteSource)
  .consume(processData);
```

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

### .all() -> *promise*

Constructs an array from each item written to the stream, and returns a promise for that array. The items in the array will appear in the order that the stream received them.

```js
Stream.from(['a', 'b', 'c'])
  .forEach(delayByRandomAmount)
  .map(str => str + str)
  .all()
  .log();
// => ["bb", "cc", "aa"]
```

### .drain() -> *promise*

Streams cannot be fulfilled until all of their data has been consumed. Sometimes the data is consumed by a new stream (such as in [`.map()`](#mapconcurrency-callback---stream)), while other times it is consumed by a process for a single value ([`.all()`](#all---promise), [`.reduce()`](#reducecallback-initialvalue---promise)).

`.drain()` is the simplest method of consumption, simply discarding each item in the stream. The returned promise will be fulfilled or rejected as the stream is fulfilled or rejected.

```js
new Stream(infiniteSource)
  .forEach(processData)
  .drain();
```

### *static* Stream.reject(*reason*) -> *stream*

Returns a new stream that is rejected with the given `reason`.

### *static* Stream.never() -> *stream*

Returns a new stream that never emits any data and never resolves.

### *static* Stream.empty() -> *stream*

Returns a new stream that is already fulfilled and never emits any data.

### *static* Stream.one(*value*) -> *stream*

Returns a new stream that will simply emit the given `value` and then become fulfilled. If the given `value` is a promise, it will be awaited before being written to the stream.

### *static* Stream.from(*iterable*) -> *stream*

Returns a new stream containing the contents of the given `iterable` object. Promises found in the `iterable` object are awaited before being written to the stream.

### *static* Stream.every(*milliseconds*) -> *stream*

Constructs a new stream that will emit `undefined` upon every interval of `milliseconds`.

### *static* Stream.combine(*...streams*) -> *stream*

Returns a new stream that contains the combination of all the values of all the given streams. The returned stream will not be fulfilled until all the given streams have been fulfilled. If any of the given streams are rejected, this stream is rejected too.

You can pass an array of streams or pass them as individual arguments (or a mix thereof).

### Promise#stream() -> *stream*

After loading this package, [`HonestPromise`](https://github.com/JoshuaWise/honest-promise) will be augmented with the `.stream()` method, which returns a new stream containing the eventual contents of the `iterable` object that the promise resolves to.

If the promise is fulfilled with something other than an `iterable` object, the stream will be rejected with a `TypeError`.

## Ordered Streams

If you need a stream to process its data *in order*, just set its `concurrency` to `1`.

```js
new Stream(source)
  .filter(1, sanitizeData)
  .map(1, processData)
  .forEach(1, saveData)
  .drain();
```

Some methods don't have concurrency control ([`.reduce()`](#reducecallback-initialvalue---promise), [`.distinct()`](#distinctequalsfunction---stream), [`.fork()`](#forkcount--2---array-of-streams), etc.). But don't worry, these methods will maintain order automatically.

## License

[MIT](https://github.com/JoshuaWise/honest-stream/blob/master/LICENSE)
