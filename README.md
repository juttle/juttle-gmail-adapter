# gmail-backend

Gmail backend for juttle

This uses the
[nodejs API for google](https://www.npmjs.com/package/googleapis) to
read gmail messages. It also uses
[Batchelor](https://www.npmjs.com/package/batchelor) to perform
batched email fetches, something that the main google API does not
currently support.

# Installation / Setup

Check out this repository and the juttle repository into a working directory.

Run `npm link` in each.

Make sure the following is in your environment:

`NODE_PATH=/usr/local/lib/node_modules`

# Configuration

You need to create an oauth2 token that allows this program to read your email on your behalf.

XXX/mstemm this process is very cumbersome, I'm looking into easier
ways to get it configured and set up and will update this section once
it's streamlined.

# Usage

I've only used this for historical reads so far. -from and -to are
honored. Currently the entire search expression is passed directly
through to gmail as the
[advanced search](https://support.google.com/mail/answer/7190?hl=en)
expression.

