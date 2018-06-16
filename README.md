<a href="https://promisesaplus.com/"><img src="https://promisesaplus.com/assets/logo-small.png" align="right" /></a>
# wise-river [![Build Status](https://travis-ci.org/JoshuaWise/wise-river.svg?branch=master)](https://travis-ci.org/JoshuaWise/wise-river)

Rivers are a style of object streaming (observables) that provide:
- Simple concurrency control
- Automatic resource management
- A familiar, intuitive, and powerful API
- Seamless integration with itself, promises, and the Node.js ecosystem (*see below*)

## Installation

```bash
npm install --save wise-river
```

## Usage

```js
const River = require('wise-river');

const messages = new River((resolve, reject, write, free) => {
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

## Why rivers?

Most object streams in Node.js are highly opinionated, and they often don't compose well with promises (the sanctioned asynchronous primitive for JavaScript). Even the streams provided by the standard library exhibit many of these problems:
  1. They usually require subclassing or other boilerplate to accomplish simple tasks
  2. They don't propagate errors, destroying the composability promised by `.pipe()`
  3. Their composability with the rest of the Node.js ecosystem is often weak and limited

Object streams should *feel* like regular promises, but provide the ability to easily operate on promises as a collection (just like arrays of values).

## Unopinionated by default

Unlike many styles of streams, a river does not preserve sequence/order, allowing for maximum concurrency by default. However, rivers give you total concurrency control, and therefore they can be made to process items in sequence if desired (see [Ordered Rivers](#ordered-rivers)). This flexibility makes accomplishing complicated tasks incredibly easy, making rivers feel very powerful when compared to other types of streams or observables.

Rivers inherit from the native `Promise` ([`WisePromise`](https://github.com/JoshuaWise/wise-promise)). If an error occurs in a river, the river will be rejected, along with all rivers that originate from it. If no error occurs, the river will be fulfilled with `undefined` when all of its items have been been consumed.

Rivers are also [async iterable objects](https://github.com/tc39/proposal-async-iteration), and can be used in `for await` loops.

```js
for await (const item of River.from([1, 2, 3])) {
  console.log(item);
}
// => 1
// => 2
// => 3
```

## Automatic resource management

When a river is done being processed, it has the ability to destroy the underlying resources that the river relied on. If the river was spawned by reading from an existing river ("river chaining"), it can propagate cancellation upstream to the source. You don't need to remember to manually close resource handles—it all happens automatically. Even if you fork a river into multiple consumers, rivers are smart enough to keep the source alive until all consumers are finished.

# API

## new River(*handler*)

Creates and returns a new river. `handler` must be a function with the following signature:

`function handler(resolve, reject, write, free)`

 1. `write(x)` is used to give values (or promises of values) to the river. The river will not be fulfilled until all written values have been consumed. After the river is resolved, this becomes a no-op.
 2. `resolve(x)` behaves the same as with regular promises, except that the fulfillment value of a River is always `undefined`. The river's fulfillment can still be delayed by passing a promise. After invoking this function you cannot `write` any more values to the river.
 3. `reject(x)` behaves the same as with regular promises. After a river is rejected, all processing stops and any values in the river are discarded.
 4. `free(fn)` is used to specify *destructor functions*, which will be invoked when the river is closed (regardless of success or failure). This is for freeing the underlying resources that the river relied on (if any).

### .pump([*concurrency*], *callback*) -> *function*

*This is the most primitive method of a River. All high-level methods are derived from here.*

Registers the `callback` function to be invoked for each item that enters the river. The callback can return a promise to indicate that it is "processing" the item. If a `concurrency` number is provided, only that many items will be processed at a time. The default is `0` which signifies infinite concurrency.

If the `callback` throws an exception or returns a rejected promise, the river will stop and will be rejected with the same error.

Rivers will buffer their content until `pump()` (or a higher-level method of consumption) is used.

Each river can only have a single consumer. If you try to use `pump()` on the same river twice, a warning will be emitted and the second consumer will never receive any data. In other words, the river will look like an empty river (except to the first consumer). This way, consumers either get "all or nothing" — it's impossible to receive a partial representation of the river's content.

This method returns a function (`"cancel"`). If `cancel` is called before the river is resolved, the river will be rejected with a `Cancellation` error, which is just a subclass of `Error`. If you're piping the river's content to a *new* river, you should pass `cancel` to the fourth parameter of the River constructor (`free()`). This allows consumers downstream to cancel the river chain if they are no longer interested in it.

If you try to use `pump()` on same river twice, invocations after the first will return a no-op function; only the *real* consumer has authority over the river's cancellation.

`Cancellation` is available at `River.Cancellation`.

### .fork(*count = 2*) -> *array of rivers*

Forks a river into several destinations and returns an array of those rivers. By default it will fork into two branches, but you can specify exactly how many branches you want.

### .map([*concurrency*], *callback*) -> *river*

Transforms the river's data through the provided `callback` function, and passes the resulting data to a new river returned by this method. If the `callback` returns a promise, its value will be awaited before being passed to the destination river.

If a `concurrency` number is provided, only that many items will be processed at a time. The default is `0` which signifies infinite concurrency.

If the `callback` throws an exception or returns a rejected promise, processing will stop and the river will be rejected with the same error.

```js
River.from(['foo.txt', 'bar.txt'])
  .map(readFile)
  .consume(console.log);
// => "this is bar!"
// => "this is foo!"
```

The `.map()` method also doubles as a stereotypical `flatMap()`. If the `callback` returns a River, its values will be forwarded to the river returned by this method.

### .forEach([*concurrency*], *callback*) -> *river*

Similar to [`.map()`](#mapconcurrency-callback---river), except the river's data will not be changed. If the callback returns a promise, it will still be awaited, but it will not determine the data that is passed to the destination river. This method is primarily used for side effects.

### .filter([*concurrency*], *callback*) -> *river*

Similar to [`.forEach()`](#foreachconcurrency-callback---river), but the items will be filtered by the provided callback function (just like [`Array#filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter)). Filtering will occur based on the truthiness of the callback's return value. If the callback returns a promise, its value will be awaited before being used in the filtering process.

### .distinct([*equalsFunction*]) -> *river*

Returns a new river with the same content as the current one, except that it never emits two consecutive items of equal value. By default the `===` operator is used for checking equality, but you can optionally pass in a custom `equalsFunction` to be used instead.

`equalsFunction` has the signature: `function equals(previousValue, nextValue) -> boolean`

### .throttle(*milliseconds*) -> *river*

Returns a new river that will not emit more than one item every specified number of `milliseconds`. If the river receives data too quickly, some data will be discarded.

### .debounce(*milliseconds*) -> *river*

Returns a new river that will defer its latest data event until the specified number of `milliseconds` has passed since receiving data. If the river receives data too quickly, all data (except the most recent) will be discarded.

### .timeoutBetweenEach(*milliseconds*, [*reason*]) -> *river*

Returns a new river that will be rejected with a `TimeoutError` if the specified number of `milliseconds` passes without the river receiving any new data. The timer starts immediately when this method is invoked.

If you specify a string `reason`, the `TimeoutError` will have `reason` as its message. Otherwise, a default message will be used. If `reason` is an `instanceof Error`, it will be used instead of a `TimeoutError`.

`TimeoutError` is available at `River.TimeoutError`.

### .while([*concurrency*], *callback*) -> *river*

Forwards the river's content to a new river until the provided `callback` function returns a falsey value (or a promise for a falsey value), at which point the returned river will be fulfilled and the source river will be cancelled.

The `callback` will be invoked once for each item that enters the river.

If the source river is fulfilled or rejected before the `callback` returns a falsey value, the returned river will also be fulfilled or rejected, respectively.

### .until(*promise*) -> *river*

Forwards the river's content to a new river until the given `promise` is fulfilled, at which point the returned river will be fulfilled and the source river will be cancelled.

If the `promise` is rejected before this river resolves, the returned river will be rejected with the same error. If the source river is fulfilled or rejected before the `promise` resolves, the returned river will also be fulfilled or rejected, respectively.

### .decouple() -> *river*

Returns a new river with the same content as the current one, except that if the river chain downstream is cancelled, the source river will not be cancelled.

### .consume([*concurrency*], *callback*) -> *promise*

Similar to [`.forEach()`](#foreachconcurrency-callback---river), but the river's content is discarded instead of being piped to a new river. This method returns a promise which will be fulfilled or rejected as the river is fulfilled or rejected.

```js
new River(infiniteSource)
  .consume(processData);
```

### .reduce(*callback*, [*initialValue*]) -> *promise*

Applies the `callback` function against an accumulator and each piece of data in the river. This method returns a promise for the final result of the reduction. If no `initialValue` is provided and the river only receives one item, that item will become the fulfillment value without invoking the callback function. If no `initialValue` is provided and the river receives *no* items, the promise will be rejected with a `NoDataError`.

`NoDataError` is available at `River.NoDataError`.

If the `initialValue` is a promise, its value will be awaited before starting the reduction process. If the `callback` returns a promise, it will be awaited before processing the next piece of data against the accumulator. Keep in mind that the `callback` function will process data in the order that the river receives it.

`callback` has the signature: `function callback(accumulator, value)`

```js
River.from(['Jonathan', 'Robert', 'Jennifer'])
  .map(fetchNickname)
  .reduce((a, b) => a + ', ' + b)
  .log();
// => "Jen, John, Rob"
```

### .all() -> *promise*

Constructs an array of every item that enters the river, and returns a promise for that array. The items in the array will appear in the order that the river received them.

```js
River.from(['a', 'b', 'c'])
  .forEach(delayByRandomAmount)
  .map(str => str + str)
  .all()
  .log();
// => ["bb", "cc", "aa"]
```

### .find([*concurrency*], *predicate*) -> *promise*

Returns a promise for the first item in the river to match the `predicate` function. When a match is found, the returned promise will be fulfilled with that item and the river will be cancelled.

The `predicate` function will be invoked for each item in the river, and should return `true` if it's a match, or `false` otherwise. It can also return a promise for `true` or `false`, instead.

If the river fulfills but no items matched the `predicate`, the returned promise will be rejected with a `NoDataError`.

`NoDataError` is available at `River.NoDataError`.

### .includes(*value*) -> *promise*

Returns a promise for a boolean that indicates whether or not the given value is found in the stream. If found, the returned promise will be fulfilled with `true` and the river will be cancelled. Otherwise, the returned promise will be fulfilled with `false`.

The given `value` can be a promise, in which case its value is awaited before the river is searched.

### .first([*number*]) -> *promise*

If used without any arguments, this method returns a promise for the first item in the river. If the river never received any data, the promise will be rejected with a `NoDataError`.

If a `number` is provided, the returned promise will instead be fulfilled with an array of the first `number` of items in the river (or less, if the river gets fulfilled without receiving that many items).

In either case, the river will be cancelled when the returned promise is resolved.

`NoDataError` is available at `River.NoDataError`.

### .last([*number*]) -> *promise*

If used without any arguments, this method returns a promise for the *last* item in river. If the river never received any data, the promise will be rejected with a `NoDataError`.

If a `number` is provided, the returned promise will instead be fulfilled with an array of the last `number` of items in the river (or less, if the river gets fulfilled without receiving that many items).

`NoDataError` is available at `River.NoDataError`.

### .drain() -> *promise*

Rivers cannot be fulfilled until all of their data has been consumed. Sometimes the data is consumed by a new river (such as in [`.map()`](#mapconcurrency-callback---river)), while other times it is consumed by a process for a single value ([`.all()`](#all---promise), [`.reduce()`](#reducecallback-initialvalue---promise)).

`.drain()` is the simplest method of consumption, simply discarding each item in the river. The returned promise will be fulfilled or rejected as the river is fulfilled or rejected.

```js
new River(infiniteSource)
  .forEach(processData)
  .drain();
```

### .drop() -> *this*

Shorthand for `river.pump(() => {})()`. This method will immediately cancel the river. If the river was previously consumed, this is a no-op; only the *real* consumer has authority over the river's cancellation.

Keep in mind, if the river does not have a rejection handler, the cancellation will still cause an `unhandledRejection`. Therefore it's common to use this method in conjunction with [`.catchLater()`](https://github.com/JoshuaWise/wise-promise#catchlater---this).

```js
river.catchLater().drop();
```

### *static* River.reject(*reason*) -> *river*

Returns a new river that is rejected with the given `reason`.

### *static* River.never() -> *river*

Returns a new river that never emits any data and never resolves.

### *static* River.empty() -> *river*

Returns a new river that is already fulfilled and never emits any data.

### *static* River.one(*value*) -> *river*

Returns a new river that will simply emit the given `value` and then become fulfilled. If the given `value` is a promise, it will be awaited before being written to the river.

### *static* River.from(*iterable*) -> *river*

Returns a new river containing the contents of the given `iterable` object. Promises found in the `iterable` object are awaited before being written to the river.

### *static* River.every(*milliseconds*) -> *river*

Constructs a new river that will emit `undefined` upon every interval of `milliseconds`.

### *static* River.combine(*...rivers*) -> *river*

Returns a new river that contains the combination of all the values of all the given rivers. The returned river will not be fulfilled until all the given rivers have been fulfilled. If any of the given rivers are rejected, this river is rejected too.

You can pass an array of rivers or pass them as individual arguments (or a mix thereof).

### *static* River.riverify(*value*, [*options*]) -> *river*

Converts a [Node.js style stream](https://nodejs.org/api/stream.html) or an [async iterable object](https://github.com/tc39/proposal-async-iteration) to a river.

Currently, only one option is supported:
  - `decouple`
    * Setting this option to `true` means the resulting river will not destroy the source when the river becomes fulfilled or rejected/cancelled. This can be useful, for example, when riverifying one side of a duplex stream (since writing in the other direction may still be possible).

### *static* River.isRiver(*value*) -> *boolean*

Returns whether the given value is a river. This is useful for differentiating between rivers and regular promises.

### Promise#stream() -> *river*

After loading this package, [`WisePromise`](https://github.com/JoshuaWise/wise-promise) will be augmented with the `.stream()` method, which returns a new river containing the eventual contents of the `iterable` object that the promise is fulfilled with.

If the promise is fulfilled with something other than an `iterable` object, the river will be rejected with a `TypeError`.

## Ordered Rivers

If you need a river to process its data *in order*, just set its `concurrency` to `1`.

```js
new River(source)
  .filter(1, sanitizeData)
  .map(1, processData)
  .forEach(1, saveData)
  .drain();
```

Some methods don't have concurrency control ([`.reduce()`](#reducecallback-initialvalue---promise), [`.distinct()`](#distinctequalsfunction---river), [`.fork()`](#forkcount--2---array-of-rivers), etc.). But don't worry, these methods will maintain order automatically.

## License

[MIT](https://github.com/JoshuaWise/wise-river/blob/master/LICENSE)
