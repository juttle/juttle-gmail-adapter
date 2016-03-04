# The Gmail Adapter and `read gmail`

This page provides notes on how the Gmail Adapter implements read support.

## Timerange and Filtering Expression

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

## Constructing Points

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

