var Juttle = require('juttle/lib/runtime').Juttle;
var JuttleErrors = require('juttle/lib/errors');
var JuttleMoment = require('juttle/lib/moment/juttle-moment');
var Promise = require('bluebird');
var google = require('googleapis');
var _ = require('underscore');
var mailcomposer = require('mailcomposer');
var URLSafeBase64 = require('urlsafe-base64');

var auth;

var Write = Juttle.proc.sink.extend({
    procName: 'gmail write',

    // The gmail write adapter supports the following options:
    //   - to: the to: header of the message.
    //         defaults to the email address of the authenticated user.
    //   - subject: the subject of the message
    //           default 'Juttle Program Output'.
    //           If output is split, " (part <part-num>)" is appended to subject.
    //   - limit: split output into batches of <limit> points.
    //   - jsonOnly: if true, only include a raw JSON mime part in the email.
    //               (The default is to attach a plain/text as well as
    //                application/json part).

    initialize: function(options) {
        var self = this;

        self.logger.debug('intitialize', options);

        self.to = options.to;
        self.subject = options.subject || 'Juttle Program Output';
        self.limit = options.limit || 0;
        self.jsonOnly = options.jsonOnly || false;

        self.gmail = google.gmail('v1');

        self.points = [];
        self.part_num = 1;
        self.in_progress_writes = 0;

        self.got_eof = false;

        Promise.promisifyAll(self.gmail.users.messages);
        Promise.promisifyAll(self.gmail.users);
    },

    process: function(points) {
        var self = this;

        self.points = self.points.concat(points);

        if (self.limit) {
            self._drain_points(self.limit);
        }
    },

    eof: function() {
        var self = this;

        self.got_eof = true;

        // Use a limit equal to the length of points so they are all
        // sent.
        self._drain_points(self.points.length)
        .then(function() {
            self._maybe_done();
        });
    },

    _drain_points: function(limit) {
        var self = this;

        if (self.points.length >= limit && self.points.length > 0) {
            var batch = self.points.splice(0, limit);
            return self._send_message(batch)
            .then(function() {
                return self._drain_points(limit);
            });
        } else {
            return Promise.resolve();
        }
    },

    _send_message: function(points) {
        var self = this;

        self.logger.debug('sending: ', points);
        var subject = self.subject;
        var filename = "juttle-program-output";

        // Only include part numbers if the configured limit is
        // non-zero.
        if (self.limit !== 0) {
            subject = subject.concat(" (part " + self.part_num + ")");
            filename = filename.concat("-part" + self.part_num);
            self.part_num++;
        }
        filename = filename.concat(".json");

        // If a to: was not provided, look up the authenticated user's
        // email address.
        var to_email_addr_promise;

        if (self.to !== undefined) {
            to_email_addr_promise = Promise.resolve(self.to);
        } else {
            to_email_addr_promise = self.gmail.users.getProfileAsync({
                auth: auth,
                userId: 'me'
            })
           .then(function(response) {

               self.logger.debug("Found email address for authenticated user:", response.emailAddress);

               // Save it for later messages
               self.to = response.emailAddress;
               return response.emailAddress;
           });
        }

        return to_email_addr_promise
        .then(function() {

            // By default, send the message as a multipart/alternative
            // with a text/plain part containing prettyprinted json,
            // and an application/json containing the stringified
            // json. If jsonOnly is true, skip the plain text part.

            // For some reason, the base64-encoded email must contain a
            // From: header, but when sent, the From: header is
            // overwritten with the email address of the authenticated
            // user.
            var opts = {from: 'nobody@nobody.com',
                        to: self.to,
                        subject: subject,
                        alternatives: [
                            {filename: filename,
                             contentType: 'application/json',
                             content: JSON.stringify(points)
                            }
                        ]
                       };

            if (! self.jsonOnly) {
                opts.text = JSON.stringify(points, null, 2);
            }

            var mail = mailcomposer(opts);

            Promise.promisifyAll(mail);

            return mail.buildAsync();
        })
        .then(function(message) {
            self.logger.debug("About to send:", message.toString());
            var encoded = URLSafeBase64.encode(message).toString();

            var opts = {
                auth: auth,
                userId: 'me',
                resource: {
                    raw: encoded
                }
            };

            self.in_progress_writes++;
            return self.gmail.users.messages.sendAsync(opts);
        })
        .then(function(response) {
            self.logger.debug("Response from sending message:", response);
        })
        .finally(function() {
            self.in_progress_writes--;
            self._maybe_done();
        });
    },

    _maybe_done: function() {
        var self = this;

        // We are only done once we have received an eof and once
        // every pending message has been sent.
        if (self.got_eof && self.in_progress_writes === 0) {
            self.done();
        }
    },
});

function init(provided_auth) {
    auth = provided_auth;
}

module.exports = {
    init: init,
    write: Write
};
