# The Gmail Adapter and ``write gmail``

This page describes details of the Gmail Adapter's ``write gmail`` proc, including how the adapter receives the output of programs, how it interacts with the juttle program to signal that all data has been written, and details on the implementation of the juttle proc.

## Program output == JSON points

A write proc receives arrays of JSON points from a given juttle program via the ``process`` callback method. The responsibility of the write proc is to save those points to its associated backend in a timely manner and in a way that does not starve the program for resources.

The Gmail Adapter buffers points in memory until either the program has completed or a configurable batch size has been reached. This means that program output may be split across multiple messages.

In the case of the Gmail Adapter, it constructs emails containing the JSON points and sends those emails using the Gmail API. It does so using asynchronous functions (specifically [Bluebird Promise](http://bluebirdjs.com) chains) that do not block the node.js event loop.

## Orderly shutdown of programs via the ``eof()/done()`` functions.

The juttle program informs the adapter that the program is finished by calling the ``eof`` callback method. This is an indication that the program has completed and no additional points will be passed to the adapter.

In turn, the adapter must inform the program that all data has been written and it is safe to tear down the program. It does so by calling the ``done()`` method.

In the case of the Gmail Adapter, it ensures that all in-progress email messages have been sent. See the ``_maybe_done()`` method for details.

## ``write gmail`` options

Unlike ``read``, there are no conventions for a standard set of options supported by all adapters. In general, options related to configuration (hostnames, API keys, etc) should be specified in the adapter's configuration rather than provided as arguments to the ``write gmail`` command.

The ``write gmail`` command takes the following options:

* ``to``: the to: header of the message. If not specified, defaults to the email address of the authenticated user.
* ``subject``: the subject of the message.  Default is 'Juttle Program Output'. If output is split, " (part <part-num>)" is appended to subject.
* ``limit``: split output into batches of <limit> points. By default all points are buffered in memory until the program has completed.
* ``jsonOnly``: if true, only include a raw JSON mime part in the email. The default (false) is to attach a plain/text as well as application/json part.

## Object methods and instance variables

The ``Write`` object should implement the following methods:

```
initialize: function(options) {...}
```

``initialize`` is called when the program is compiled and is responsible for validating and saving the provided options. At any time after initialize, the Write object should be prepared to accept points.

```
process: function(points) {...}
```

``process`` is called to pass a group of points from the juttle program to the adapter. The Write object should arrange for these points to be written to the associated backend. If necessary it should queue these points to be written later. The adapter should avoid use of blocking operations to avoid stalling the juttle program.

```
eof: function() {...}
```

``eof`` is called when the juttle program has completed. The Write object should write all buffered points to the associated backend, and then call ``done()`` once all writes have completed.





