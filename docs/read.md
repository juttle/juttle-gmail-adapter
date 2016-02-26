# The Gmail Adapter and `read gmail`

This page describes details of the Gmail Adapter's read proc, including how the adapter handles live and historical reads, how it interprets filter expressions, and details on the implementation of the juttle proc.

## Live vs Historical

Juttle's `read` command specifies a timerange based on the values of the `-from`, `-to`, and `-last` options. When the timerange specified by `-from/-to/-last` is in the past, an adapter need only fetch the matching set of messages for the provided timerange. Such a program is called *historical*. When a part of the timerange is in the future, the adapter must also watch for new messages and pass them to the program. Such a problem is called *live*. A program can be both live and historical, with a `-from` in the past and a `-to` in the future. In that case, the adapter must fetch both old and newly-arriving messages.

Although Gmail messages have natural time values (the time the message was received), not all backends do. If your backend does not have meaningful time values, but was given a timerange in the `read` proc, your adapter should return an error.

For more information on Time Range Semantics, see [this page](https://github.com/juttle/juttle/wiki/Time-Range-Semantics).

## Fields and Searching

Every `read` command can contain a [filter expression](https://github.com/juttle/juttle/blob/master/docs/concepts/filtering.md) that is used as an initial filter for the messages selected by the adapter. An adapter is not obligated to support a filter expression. The `filter` proc allows for filtering of points within programs. However, for performance reasons it is highly recommended that adapters implement filter expressions and push filtering into the backend whenever possible.

A filter expression either takes the form of a full-text search or a field match expression, possibly combined with logical operators like `AND`, `OR`, etc.

## The `read` Proc

The `read` proc is the interface between the juttle program and the adapter implementation. The specific format of the options to `read` are not enforced by the Juttle compiler, and a read proc can have any number of options. Shared code can perform validation, see `allowedOptions` below. There are a set of commonly supported options that are supported by most adapters:

```
read <adapter> [-from <moment>] [-to <moment>] [-timeField <field>] [-raw <expression>] [<filter expression>]
```

* `-from`/`-to`: [Juttle Moments](https://github.com/juttle/juttle/blob/master/lib/moment/juttle-moment.js) representing the start and end of the time range for the read.
* `-last`: a JuttleMoment. shorthand for `from :now: - <last> -to :now:`
* `-lag`: a JuttleMoment. Controls how long to wait behind real time to fetch datapoints. For example, with  `-from :1 minute ago: -to :now: -lag :30s:`, the runtime will initially wait 30 seconds, and then ask the points for the time period `[:1 minute ago:-:now:]`. A lag is useful when your backend takes a while to have results ready (due to write delays, etc).
* `-timeField`: A field from the backend data that should be used as the time of the points emitted to the program.
* `-raw`: A backend-specific search parameter that is passed opaquely to the adapter. For the Gmail Adapter, the `-raw` expression is passed directly through as a Gmail advanced search string.

Let's discuss how the Gmail adapter interprets `-from`, `-to`, `-raw`, and the filter expression to select messages:

The Gmail API supports date-based searches via `before:` and `after:`. However, the arguments to `before:` and `after:` can only be dates, while the `-from`/`-to` options to `read` have greater (sub-second) precision. So when fetching messages, the adapter rounds down the `-from` to the beginning of the day and `-to` to the end of the day. Afterward, the adapter compares the actual message receipt time (in the `internalDate` field) against the `-from`/`-to` and only passes matching messages along to `emit()`.

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

## Object methods and instance variables

The `Read` class derives from [AdapterRead](https://github.com/juttle/juttle/blob/master/lib/adapters/adapter-read.js), which is included with the Juttle runtime. Most of the work of managing options and interacting with the Juttle runtime is handled by the base class. Here we'll discuss methods that can be overridden to customize behavior and methods that must be overridden to do work.

### Methods that can be overridden

Here are methods that can be overridden from AdapterRead used by the Gmail Adapter.

```Javascript
periodicLiveRead() { return true; }
```

`periodicLiveRead` tells the juttle runtime whether it should periodically call into the adapter to get updated sets of points when the value for -from is in the future. The Gmail adapter wants this behavior (polling for new messages), so it overrides this method to return true.

```Javascript
defaultTimeOptions() {
        return {
            from: this.params.now,
            to: new JuttleMoment(Infinity)
        };
}
```

`defaultTimeOptions` specifies the default values for `-from` and `-to`. In the case of the Gmail adapter, a read with no arguments will run forever, returning all new email messages.

```Javascript
static allowedOptions() {
    return AdapterRead.commonOptions().concat(['raw']);
}
```

allowedOptions tells the runtime what options the adapter supports. The base class has a list of common options, and the Gmail Adapter adds `-raw` to this list. The base class will take care of validating that the allowed options have appropriate values and that no unexpected options have been specifieid.

```
constructor(options, params) {...}
```

The main object constructor, which is responsible for validating and parsing the parameters not covered by the base class and filter expression. The arguments to `initialize` are the following:

* `options`: The options provided to the `read gmail` proc in the juttle program. `-from`, `-to`, etc. are all examples of options.
* `params`: The filter expression is passed as `params.filter_ast`.

### Methods that must be overridden

```
read(from, to, limit, state)
```

`read` is called by the juttle runtime to fetch a set of points and return them. read() may be called more than once in the case of periodic live reads. At this time the adapter fetches the relevant messages given the search expression, constructs points from the messages, and returns them.

read() typically returns a [Promise](https://github.com/petkaantonov/bluebird) to allow for asynchronous operations that eventually result in a set of points. In the case of the Gmail adapter, it interacts with the Gmail API to fetch the set of matching messages in a chain of promises that resolves with the set of matching messages.

### Logging

To log messages, use the logger instance variable, for example:
```Javascript
this.logger.debug(`Got ${response.messages.length} potential messages`);
```

Log messages are passed through the Juttle runtime and eventually logged to files/console and/or passed to the browser.

### Returning Errors

To throw errors, use the methods `compileError` or `runtimeError` in the `AdapterRead` base class to construct an error and throw() it. Here's an example:

```Javascript
var unknown = _.difference(_.keys(options), this.allowed_options);
if (unknown.length > 0) {
    throw this.compile_error('UNKNOWN-OPTION-ERROR', {
        option: unknown[0]
    });
}
```

Code is one of the values in [juttle-error-strings-en-US.json](https://github.com/juttle/juttle/blob/master/lib/strings/juttle-error-strings-en-US.json) from the juttle repository. Based on the error code, the `info` object is used to interpolate the error string template into a specific error string.

## The `filter_ast` expression

The filter expression is parsed by the juttle compiler and provided to the adapter as params.filter_ast, which is the output of the juttle compiler. The best way to parse a filter expression is to create a class deriving from [StaticFilterCompiler](https://github.com/juttle/juttle/blob/master/lib/compiler/filters/static-filter-compiler.js) to step through the ast with callbacks for the terms of the filter expression to build up a backend-specific search expression. The gmail adapter does this in [filter-gmail-compiler.js](../lib/filter-gmail-compiler.js).

## Constructing Points

After selecting the matching messages in `read()`, the messages must be converted to points. Points are simply json objects. The Gmail adapter supports points with meaningful times, so the `time` field must be of type `JuttleMoment`, and is converted from the `internalDate` field of the message.

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

