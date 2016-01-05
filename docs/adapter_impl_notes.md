# Adapter Implementation Notes

This page talks about implementation details of writing adapters. If you want to write your own adapter for your own backend, use this document as a guide.

For this document, we'll use the Gmail adapter as an example. In this case, the backend consists a set of email messages. Each message contains a timestamp (when the message was received) and fields (email headers such as ``From:``, ``To:``, ``Subject:``, the message body, etc). The [Gmail API](https://www.npmjs.com/package/googleapis) supports [search expressions](https://support.google.com/mail/answer/7190?hl=en) that select messages based on date, headers, or a full-text search on the message contents.

As of 2015-12-23, the adapter implementation doesn't *exactly* match this description. For example, the adapter doesn't yet support filtering expressions or live programs. However, the notes still do a good job of illustrating the concepts.

The adapter's job is to interpret the options included in the juttle ``read`` command into a set of matching email messages, construct json objects representing those messages, and pass them to the Juttle Runtime by calling ``emit()``. (Adapters can also support ``write`` commands, but the Gmail adapter only supports reads).

More sophisticated adapters work together with the juttle optimizer to push aggregation operations directly into the backend. For example, to count the number of messages in a given time period you could simply fetch all the messages and have the juttle program perform the counting. But it would be more efficient to count the number of messages via Gmail APIs and simply return the count instead.

## Live vs Historical

Juttle's ``read`` command specifies a timerange based on the values of the ``-from``, ``-to``, and ``-last`` options. When the timerange specified by ``-from/-to/-last`` is in the past, an adapter need only fetch the matching set of messages for the provided timerange. Such a program is called *historical*. When a part of the timerange is in the future, the adapter must also watch for new messages and pass them to the program. Such a problem is called *live*. A program can be both live and historical, with a ``-from`` in the past and a ``-to`` in the future. In that case, the adapter must fetch both old and newly-arriving messages.

Although Gmail messages have natural time values (the time the message was received), not all backends do. If your backend does not have meaningful time values, but was given a timerange in the ``read`` proc, your adapter should return an error.

For more information on Time Range Semantics, see [this page](https://github.com/juttle/juttle/wiki/Time-Range-Semantics).

## Fields and Searching

Every ``read`` command can contain a [filter expression](https://github.com/juttle/juttle/blob/master/docs/concepts/filtering.md) that is used as an initial filter for the messages selected by the adapter. An adapter is not obligated to support a filter expression. The ``filter`` proc allows for filtering of points within programs. However, for performance reasons it is highly recommended that adapters implement filter expressions and push filtering into the backend whenever possible.

A filter expression either takes the form of a full-text search or a field match expression, possibly combined with logical operators like ``AND``, ``OR``, etc.

## The ``read`` Proc

The ``read`` proc is the interface between the juttle program and the adapter implementation. The specific format of the options to ``read`` are not enforced by the Juttle compiler. A read proc can have any number of options. However, there are conventions for commonly supported options:

```
read <adapter> [-from <moment>] [-to <moment>] [-timeField <field>] [-raw <expression>] [<filter expression>]
```

* ``-from``/``-to``: [Juttle Moments](https://github.com/juttle/juttle/blob/master/lib/moment/juttle-moment.js) representing the start and end of the time range for the read.
* ``-timeField``: A field from the backend data that should be used as the time of the points emitted to the program.
* ``-raw``: A backend-specific search parameter that is passed opaquely to the adapter. For the Gmail Adapter, the ``-raw`` expression is passed directly through as a Gmail advanced search string.

Let's discuss how the Gmail adapter interprets ``-from``, ``-to``, ``-raw``, and the filter expression to select messages:

The Gmail API supports date-based searches via ``before:`` and ``after:``. However, the arguments to ``before:`` and ``after:`` can only be dates, while the ``-from``/``-to`` options to ``read`` have greater (sub-second) precision. So when fetching messages, the adapter rounds down the ``-from`` to the beginning of the day and ``-to`` to the end of the day. Afterward, the adapter compares the actual message receipt time (in the ``internalDate`` field) against the ``-from``/``-to`` and only passes matching messages along to ``emit()``.

Field matches in search expressions are interpreted as message header matches for a limited set of headers:

* ``from``
* ``to``
* ``subject``
* ``cc``
* ``bcc``

The following comparison operators are supported:

* ~, =~ (wildcard operator). This is because Gmail's header searches match on substrings and do not perform exact matches.
* !~ (wildcard negation).

These header matches are pushed into the Gmail API search expression. Logical operators such as ``AND``, ``OR``, and ``NOT`` join terms in the expression.

Full-text search is supported by the Gmail API, so any full-text searches are passed through to the search expression.

If a filter expression refers to other fields or uses other operators, the adapter returns an error.

## Javascript Modules, Classes and Methods

The Gmail adapter implements a javascript module in [index.js](../index.js). It requires the main module in [lib/gmail-adapter.js](../lib/gmail-adapter.js) via:

```Javascript
module.exports = require('./lib/gmail-adapter');
```

When the adapter is loaded, the CLI/Outrigger perform a ``require`` of the module (i.e. the directory containing ``index.js``).

The main function exported by ``gmail-adapter.js`` takes a ``config`` argument containing the configuration object for the adapter, and returns an object with ``name`` and ``read`` attributes. The Gmail adapter only implements ``read`` and not ``write``. Adapters that additionally support ``write`` would have an additional attribute ``write``. The value for the ``name``' attribute is ``gmail``, corresponding to the ``read gmail`` proc in juttle programs. The value for ``read``' is an object inheriting from ``Juttle.proc.base``, which performs the work of the adapter.

Here's the exported function from ``gmail-backend.js``:

```Javascript
var GmailBackend = function(config) {

    auth = authorize(config["client-credentials"],
                     config["oauth2-token"]);

    return {
        name: 'gmail',
        read: Read
    };
};

module.exports = GmailBackend;
```

The ``Read`` object should implement the following methods:

```
initialize: function(options, params, pname, location, program, juttle) {...}
```

``initialize`` is called when the program is compiled, and is responsible for validating and parsing the parameters and filter expression. The arguments to ``initialize`` are the following:

* ``options``: The options provided to the ``read gmail`` proc in the juttle program. ``-from``, ``-to``, etc. are all examples of options.
* ``params``: The filter expression is passed as ``params.filter_ast``.
* ``pname``: XXX/mstemm is this needed?
* ``location``: The location in the juttle program where this proc is located. It has been saved to ``this.location`` by the parent class.
* ``program``: A reference to the associated ``Program`` object.
* ``juttle``: XXX/mstemm is this needed?

```
start: function() {...}
```

``start`` is called when the program starts. At this time the adapter fetches the relevant messages given the search expression, constructs points from the messages, and calls ``emit()`` to pass the points to the program.

```
teardown: function() {...}
```

``teardown`` is called when the program ends. At this time the adapter performs any necessary cleanup (not necessary for the gmail adapter).

## Returning Errors

``Juttle.proc.base`` provides a method ``compile_error(code, info)`` that can be
called when there is an error in ``initialize``. Here's an example:

```Javascript
var unknown = _.difference(_.keys(options), this.allowed_options);
if (unknown.length > 0) {
    throw this.compile_error('RT-UNKNOWN-OPTION-ERROR', {
        option: unknown[0]
    });
}
```

Code is one of the values in [juttle-error-strings-en-US.json](https://github.com/juttle/juttle/blob/master/lib/strings/juttle-error-strings-en-US.json) from the juttle repository. Based on the error code, the ``info`` object is used to interpolate the error string template into a specific error string.

## The ``filter_ast`` expression

The filter expression is parsed by the juttle compiler and provided to the adapter as params.filter_ast, which is the output of the juttle compiler. The best way to parse a filter expression is by using the [ASTVisitor class](https://github.com/juttle/juttle/blob/master/lib/compiler/ast-visitor.js) to step through the ast with callbacks for the terms of the filter expression.

## Constructing Points

After selecting the matching messages in ``start()``, the messages must be converted to points. Points are simply json objects. The Gmail adapter supports points with meaningful times, so the ``time`` field must be of type ``JuttleMoment``, and is converted from the ``internalDate`` field of the message.

The adapter includes the following fields in each point:

* ``time``
* ``id``: the message-id from the message
* ``snippet``: a short summary of the message
* ``from``: the from header in the message
* ``to``: the from header in the message
* ``subject``: the from header in the message
* ``cc``: the cc: header in the message (if present)
* ``bcc``: the cc: header in the message (if present)

The goal is to provide meaningful fields that may be useful in a variety of juttle programs, without simply passing the entire message to the program.

Once the set of points are built, the adapter calls ``emit()`` to pass the points to the juttle program. Note that you can pass an array of points via a single call to ``emit()``.

## Working with the scheduler for live programs

So far, we've discussed how to fetch a set of messages for a given ``-from``/``-to`` timerange. For live programs, the adapter must also fetch new messages and pass them to the program. The easiest way to do this is to keep track of the timestamp of the last message, wait a bit, and then look for new messages that have arrived since that timestamp.

An important notion is the idea of *program time*, which is separate from wall clock time. Program time is separate to allow it to progress faster/slower than wall clock time, or even to stop entirely (in cases where flow control has been applied to allow slow sinks to catch up with fast sources). Program time is managed by the program scheduler.

To handle the "wait a bit" task, the adapter works with the program scheduler, via this call:

```
this.program.scheduler.schedule(this.live_window_next.unixms(), function() { self.get_messages(); });
```

This arranges for the ``get_messages`` method to be called at the appropriate time.

## Configuration

The Gmail adapter needs application client credentials as well as an OAuth2 token to use the Gmail API. These items are provided in the config object passed to the ``GmailBackend`` function exported by the module.

The configuration is saved in the juttle [configuration file](https://github.com/juttle/juttle/blob/master/docs/reference/cli.md#configuration). Within the configuration object, the module name (in this case ``juttle-gmail-adapter``) is used to select the portion of the configuration to pass to the module's function. That is, given a configuration file:

```
{
    "adapters": {
        "juttle-twitter-adapter": {...},
        "juttle-gmail-adapter": {...}
    }
}
```
The object below ``juttle-gmail-adapter`` will be passed to the module's main function.

