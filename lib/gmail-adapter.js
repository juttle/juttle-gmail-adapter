var Juttle = require('juttle/lib/runtime').Juttle;
var JuttleMoment = require('juttle/lib/moment/juttle-moment');
var Promise = require('bluebird');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var _ = require('underscore');
var Batchelor = require('batchelor');

var auth;

var Read = Juttle.proc.base.extend({
    procName: 'read-gmail',

    initialize: function(options, params, pname, location, program, juttle) {
        this.logger.debug('intitialize', options, params);
        this.gmail = google.gmail('v1');

        var allowed_options = ['raw', 'from', 'to'];
        var unknown = _.difference(_.keys(options), allowed_options);

        if (unknown.length > 0) {
            throw new Error('Unknown option ' + unknown[0]);
        }

        this.raw = options.raw;

        this.logger.info("Filter Expression:", this.raw);

        Promise.promisifyAll(this.gmail.users.messages);
        this.options = options;
    },

    start: function() {
        var self = this;

        // Build a search expression given the options.
        var search = self.raw;

        // The gmail search expression only has per-day granularity,
        // so we quantize the -from and -to to the nearest day and do
        // additional filtering in get_messages().

        // XXX/mstemm not sure how the time zone is set. It's definitely not in UTC.

        if (self.options.from) {
            search += " after:" + JuttleMoment.format(self.options.from, "YYYY/MM/DD", "US/Pacific");
        }

        if (self.options.to) {
            search += " before:" + JuttleMoment.format(self.options.to, "YYYY/MM/DD", "US/Pacific");
        }

        self.get_messages(search)
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
            self.eof();
        }).catch(function(err) {
            self.logger.error("Could not read latest emails:", err);
        });
    },

    get_messages: function(search, pageToken) {
        var self = this;

        var opts = {
            auth: auth,
            userId: 'me',
            q: search,
        };

        if (pageToken) {
            opts.pageToken = pageToken;
        }

        return self.gmail.users.messages.listAsync(opts)
        .then(function(response) {

            if (!_.has(response, "messages")) {
                return [];
            }

            self.logger.info("Got " + response.messages.length + " potential messages");

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

                if (self.options.from &&
                    time.lt(self.options.from)) {
                    return;
                }

                if (self.options.to &&
                    time.gt(self.options.to)) {
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
                return self.get_messages(search, pageToken).then(function(remaining_messages) {
                    return messages.concat(remaining_messages);
                });
            } else {
                return messages;
            }
        });
    },

    teardown: function() {
    },


    // Non juttle proc methods below here
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
