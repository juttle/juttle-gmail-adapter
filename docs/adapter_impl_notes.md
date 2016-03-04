# Adapter Implementation Notes

This page talks about the implementation details of the gmail adapter. It can be used with the more general [adapter API guide](https://github.com/juttle/juttle/blob/master/docs/adapters/adapter_api.md) to provide details on how to write a new adapter.

This document describes details on module loading and configuration. There are separate documents that discuss the details of the [read gmail](./read.md) and [write gmail](./write.md) procs.

## Module Initialization

The initialization function exported by
[lib/index.js](../lib/index.js) takes a `config` argument containing
the configuration object for the adapter. For the gmail adapter, this
contains the client credentials for the application and the OAuth
token to access the mailbox. The initialization function calls
`authorize()` to initialize the Gmail API with the credentials and
token and passes the result to the Read and Write modules.


