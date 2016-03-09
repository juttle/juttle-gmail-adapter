# Adapter Implementation Notes

This page talks about the implementation details of the gmail adapter. It can be used with the more general [adapter API guide](https://github.com/juttle/juttle/blob/master/docs/adapters/adapter_api.md) to provide details on how to write a new adapter.

## Module Initialization

The initialization function exported by
[lib/index.js](../lib/index.js) takes a `config` argument containing
the configuration object for the adapter. For the gmail adapter, this
contains the client credentials for the application and the OAuth
token to access the mailbox. The initialization function calls
`authorize()` to initialize the Gmail API with the credentials and
token and passes the result to the Read and Write modules.

Here's the relevant section of `lib/index.js`:

```JavaScript
var GmailAdapter = function(config) {

...
    var auth = authorize(config['client-credentials'],
                         config['oauth2-token']);

    Read.init(auth);
    Write.init(auth);

    return {
        name: 'gmail',
        read: Read.read,
        write: Write.write
    };
};

module.exports = GmailAdapter;
```

## Read and `read gmail`

### Timerange and Filtering Expression

The Gmail API supports date-based searches via `before:` and `after:`. However, the arguments to `before:` and `after:` can only be dates, while the `-from`/`-to` options to `read` have greater (sub-second) precision. So when fetching messages, the adapter rounds down the `-from` to the beginning of the day and `-to` to the end of the day. Afterward, the adapter compares the actual message receipt time (in the `internalDate` field) against the `-from`/`-to` and only returns matching messages from `read()`.

Field matches in search expressions are interpreted as message header matches for a limited set of headers:

* `from`
* `to`
* `subject`
* `cc`
* `bcc`

The following comparison operators are supported:

* ~, =~ (wildcard operator). This is because Gmail's header searches match on substrings and do not perform exact matches.
* !~ (wildcard negation).

These header matches are pushed into the Gmail API search expression. Logical operators such as `AND`, `OR`, and `NOT` join terms in the expression, and parentheses can be used for logical grouping and nesting.

Full-text search is supported by the Gmail API, so any full-text searches are passed through to the search expression.

If a filter expression refers to other fields or uses other operators, the adapter returns an error.

### Constructing Points

After selecting the matching messages in `read()`, the messages must be converted to points. The Gmail adapter supports points with meaningful times, so the `time` field must be of type `JuttleMoment`, and is converted from the `internalDate` field of the message.

The adapter includes the following fields in each point:

* `time`
* `id`: the message-id from the message
* `snippet`: a short summary of the message
* `from`: the from header in the message
* `to`: the from header in the message
* `subject`: the from header in the message
* `cc`: the cc: header in the message (if present)
* `bcc`: the cc: header in the message (if present)

The goal is to provide meaningful fields that may be useful in a variety of juttle programs, without simply passing the entire message to the program.

Once the set of points are built, they are returned from `read()` and passed to the juttle program.

## Write and `write gmail`

### Program Output

The Gmail Adapter buffers points in memory until either the program has completed or a configurable batch size has been reached. This means that program output may be split across multiple messages.

When a batch of points are sent, it constructs emails containing the JSON points and sends those emails using the Gmail API. It does so using asynchronous functions (specifically [Bluebird Promise](http://bluebirdjs.com) chains) that do not block the node.js event loop.

### `write` handling

`write()` maintains a queue of points. Calls to `write()` simply append to the queue. If a `-limit` was specified in `write gmail`, when the queue of points reaches the limit, a message is sent (asynchronously by creating a promise, see below).

### `eof()` handling

`eof()` should return a promise that resolves when all output has been written. In the case of the Gmail Adapter, the promise resolves when all points have been packaged in email messages and sent. Each time a message is sent via `write()`, the promise is appended to the base promise in the `writePromise` instance variable. The chained promise is returned when `eof()` is called, and resolves when all emails have been sent.


