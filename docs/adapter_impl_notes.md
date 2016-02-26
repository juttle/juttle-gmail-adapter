# Adapter Implementation Notes

This page talks about implementation details of writing adapters. If you want to write your own adapter for your own backend, use this document as a guide.

For this document, we'll use the Gmail adapter as an example. In this case, the backend consists of a set of email messages. Each message contains a timestamp (when the message was received) and fields (email headers such as `From:`, `To:`, `Subject:`, the message body, etc). The [Gmail API](https://www.npmjs.com/package/googleapis) supports [search expressions](https://support.google.com/mail/answer/7190?hl=en) that select messages based on date, headers, or a full-text search on the message contents, and the ability to read and write messages.

For reads, the adapter's job is to interpret the options included in the juttle `read` command into a set of matching email messages, construct json objects representing those messages, and pass them to the Juttle Runtime by calling `emit()`. For writes, the adapter's job is to take the output of programs and "save" that output to the backend by sending emails.

More sophisticated adapters work together with the juttle optimizer to push aggregation operations directly into the backend. For example, to count the number of messages in a given time period you could simply fetch all the messages and have the juttle program perform the counting. However it would be more efficient to count the number of messages via Gmail APIs and simply return the count instead.

This document describes details on module loading and configuration. There are separate documents that discuss the details of the [read gmail](./read.md) and [write gmail](./write.md) procs.

## The `JuttleAdapterAPI` global

An adapter will need to access functions and objects from the Juttle runtime. All of these functions should be accessed via a global object [JuttleAdapterAPI](https://github.com/juttle/juttle/blob/master/lib/adapters/api.js). [this page](https://github.com/juttle/juttle/blob/master/docs/adapters/adapter_api.md) describes the API object and how to use it in more detail.

## Javascript Modules, Classes and Methods

The Gmail adapter implements a javascript module in [index.js](../index.js). It requires the main module in [lib/index.js](../lib/index.js) via:

```Javascript
module.exports = require('./lib/');
```

When the adapter is loaded, the CLI/juttle-engin perform a `require` of the module (i.e. the top-level directory containing `index.js`). `lib/index.js` in turn `require()s` `read.js` and `write.js`, which contain the implementation of the read and write classes, respectively.

The main function exported by `lib/index.js` takes a `config` argument containing the configuration object for the adapter, and returns an object with `name`, `read`, and `write` attributes.  The value for the `name` attribute is `gmail`, corresponding to the `read gmail`/`write gmail` proc in juttle programs. The value for `read` is a class inheriting from `AdapterRead`, which performs the read work of the adapter. The value for `write` is an class inheriting from `AdapterWrite`, which performs the write work of the adapter.

Here's a slighly simplified version of the exported function from `lib/index.js`:

```Javascript
var Read = require('./read');
var Write = require('./write');

var GmailAdapter = function(config) {

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

## Configuration

The Gmail adapter needs application client credentials as well as an OAuth2 token to use the Gmail API. These items are provided in the config object passed to the `GmailAdapter` function exported by the module.

The configuration is saved in the juttle [configuration file](https://github.com/juttle/juttle/blob/master/docs/reference/cli.md#configuration). Within the configuration object, the module name (in this case `juttle-gmail-adapter`) is used to select the portion of the configuration to pass to the module's function. That is, given a configuration file:

```
{
    "adapters": {
        "twitter": {...},
        "gmail": {...}
    }
}
```
The object below `gmail` will be passed to the module's main function.

