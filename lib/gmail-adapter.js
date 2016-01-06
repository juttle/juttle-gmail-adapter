var Juttle = require('juttle/lib/runtime').Juttle;
var JuttleErrors = require('juttle/lib/errors');
var JuttleMoment = require('juttle/lib/moment/juttle-moment');
var Promise = require('bluebird');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var _ = require('underscore');
var Batchelor = require('batchelor');

var auth;

var Read = Juttle.proc.base.extend({
    sourceType: 'batch',
    procName: 'read-gmail',

    initialize: function(options, params, pname, location, program, juttle) {
        this.logger.debug('intitialize', options, params);
        this.gmail = google.gmail('v1');

        var time_related_options = ['from', 'to', 'last'];
        var allowed_options = time_related_options.concat(['raw']);
        var unknown = _.difference(_.keys(options), allowed_options);

        if (unknown.length > 0) {
            throw JuttleErrors.syntaxError('RT-UNKNOWN-OPTION-ERROR',
                                           {proc: 'gmail', option: unknown[0], location: location});
        }

        // One of 'from', 'to', or 'last' must be present.
        var opts = _.intersection(_.keys(options), time_related_options);
        if (opts.length === 0) {
            // Waiting on a juttle release that incorporates https://github.com/juttle/juttle/pull/108
            //throw JuttleErrors.syntaxError('RT-MISSING-TIMERANGE-ERROR', {location: location});
            throw new Error('Error: One of -from, -to, or -last must be specified to define a query time range');
        }

        // If 'from'/'to' are present, 'last' can not be present.
        if ((_.has(options, 'from') || _.has(options, 'to')) &&
            _.has(options, 'last')) {
            throw JuttleErrors.syntaxError('RT-LAST-FROM-TO-ERROR', {location: location});
        }

        // 'from' must be before 'to'
        if (_.has(options, 'from') && _.has(options, 'to') &&
            options.from > options.to) {
            throw JuttleErrors.syntaxError('RT-TO-FROM-MOMENT-ERROR', {location: location});
        }

        // If 'last' is specified, set appropriate 'from'/'to'
        if (_.has(options, 'last')) {
            this.from = program.now.subtract(options.last);
            this.to = program.now;
        } else {
            // Initialize from/to if necessary.
            this.from = options.from || program.now;
            this.to = options.to || program.now;
        }

        this.raw = options.raw;

        this.delay = options.delay || JuttleMoment.duration(1, 's');

        Promise.promisifyAll(this.gmail.users.messages);
    },

    start: function() {
        var self = this;

        return self.get_messages_for_timerange(self.from, self.to);
    },

    teardown: function() {
    },

    // Non juttle proc methods below here
    get_messages_for_timerange: function(from, to) {
        this.logger.debug('get_messages_for_timerange from=' + from + " to=" + to);
        var self = this;

        // Build a search expression given the options.
        var search = self.raw || "";

        var now = new JuttleMoment();

        // The gmail search expression only has per-day granularity,
        // so we quantize the -from and -to to the nearest day and do
        // additional filtering in get_messages().

        // XXX/mstemm not sure how the time zone is set. It's definitely not in UTC.
        search += " after:" + JuttleMoment.format(from, "YYYY/MM/DD", "US/Pacific");

        // Add 1 day to to and then quantize to a day. This
        // results in the next day, such that the before: date is
        // always in the future.
        if (! self.to.isEnd()) {
            search += " before:" + JuttleMoment.format(to.add(JuttleMoment.duration(1, "d")), "YYYY/MM/DD", "US/Pacific");
        }

        this.logger.debug("Search string:", search);
        return self.get_messages(from, to, search)
        .call("sort", function(a, b) {
            if (a.time.lt(b.time)) {
                return -1;
            } else if (a.time.eq(b.time)) {
                return 0;
            } else {
                return 1;
            }
        })
        .then(function(messages) {
            if (messages && messages.length > 0) {
                self.emit(messages);
            }
            return messages;
        })
        .then(function(messages) {
            // If to is in the future, arrange with the scheduler to
            // get all messages from the timestamp of the last message
            // to "to". Otherwise we're done.
            if (to.gt(now)) {
                var next_poll = now.add(self.delay);
                var next_from = from;

                if (messages && messages.length > 0) {
                    var last_time = _.last(messages).time;
                    next_from = last_time.add(JuttleMoment.duration(1, 'ms'));
                }

                self.program.scheduler.schedule(next_poll.unixms(), function() {
                    self.get_messages_for_timerange(next_from, to);
                });
            } else {
                self.eof();
            }
        })
        .catch(function(err) {
            self.logger.error("Could not read latest emails:", err);
        });
    },

    get_messages: function(from, to, search, pageToken) {
        var self = this;

        var opts = {
            auth: auth,
            userId: 'me',
            q: search
        };

        if (pageToken) {
            opts.pageToken = pageToken;
        }

        return self.gmail.users.messages.listAsync(opts)
        .then(function(response) {

            if (!_.has(response, "messages")) {
                return [];
            }

            self.logger.debug("Got " + response.messages.length + " potential messages");

            pageToken = response.nextPageToken;

            // Do a batch-fetch of all the message ids
            var batch = new Batchelor({
                'uri':'https://www.googleapis.com/batch',
                'method':'POST',
                'auth': {
                    'bearer': auth.credentials.access_token
                },
                'headers': {
                    'Content-Type': 'multipart/mixed'
                }
            });

            // The fields argument limits the fields returned to those
            // we are interested in.
            batch.add(_.map(response.messages, function(id) {
                return {
                    method: 'GET',
                    'path': '/gmail/v1/users/me/messages/' + id.id + "?fields=internalDate,id,snippet,payload/headers"
                };
            }));

            Promise.promisifyAll(batch);
            return batch.runAsync()
            .then(function(response) {
                return response.parts;
            });
        })
        .then(function(parts) {
            var messages = [];

            parts.forEach(function(part) {
                var message = part.body;
                var time = new JuttleMoment({rawDate: new Date(Number(message.internalDate))});

                if (time.lt(from)) {
                    return;
                }

                if (time.gt(to)) {
                    return;
                }

                var pt = {
                    time: time,
                    id: message.id,
                    snippet: message.snippet,
                    from: self.find_header(message, 'From'),
                    to: self.find_header(message, 'To'),
                    subject: self.find_header(message, 'Subject')
                };
                messages.push(pt);
            });

            if (pageToken) {
                return self.get_messages(from, to, search, pageToken).then(function(remaining_messages) {
                    return messages.concat(remaining_messages);
                });
            } else {
                return messages;
            }
        });
    },

    find_header: function(message, name) {
        var self = this;

        if (!_.has(message.payload, "headers")) {
            return "";
        }

        var match = _.find(message.payload.headers, function(header) {
            return (header.name === name);
        });

        if (match === undefined) {
            return "";
        } else {
            return match.value;
        }
    }

});

// Non-juttle pluggable adapter api functions below here.
// Taken from the quickstart page:
// https://developers.google.com/gmail/api/quickstart/nodejs, and
// then converted to use promises.

/**
 * Return an OAuth2 client with the given credentials and token.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {Object} token An OAuth2 token.
 */
function authorize(credentials, token) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    oauth2Client.credentials = token;
    return oauth2Client;
}

var GmailBackend = function(config) {

    auth = authorize(config["client-credentials"],
                     config["oauth2-token"]);

    return {
        name: 'gmail',
        read: Read
    };
};

module.exports = GmailBackend;
