# The Gmail Adapter and `write gmail`

This page provides notes on how the Gmail Adapter implements write support.

## `write` handling

The adapter ensures that calls to `write()` do not block the event loop by maintaining a queue of points. Calls to `write()` simply append to the queue. If a `-limit` was specified in `write gmail`, when the queue of points reaches the limit, a message is sent (asynchronously by creating a promise, see below).

## `eof()` handling

`eof()` should return a promise that resolves when all output has been written. In the case of the Gmail Adapter, the promise resolves when all points have been packaged in email messages and sent. Each time a message is sent via `write()`, the promise is appended to the base promise in the `writePromise` instance variable. The chained promise is returned when `eof()` is called, and resolves when all emails have been sent.

