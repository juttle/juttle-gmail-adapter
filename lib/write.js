'use strict';

/* global JuttleAdapterAPI */
let AdapterWrite = JuttleAdapterAPI.AdapterWrite;

let Promise = require('bluebird');
let google = require('googleapis');
let mailcomposer = require('mailcomposer');
let URLSafeBase64 = require('urlsafe-base64');

let auth;

class GmailWrite extends AdapterWrite {
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

    constructor(options, params) {
        super(options, params);

        this.logger.debug('intitialize', options);

        this.to = options.to;
        this.subject = options.subject || 'Juttle Program Output';
        this.limit = options.limit || 0;
        this.jsonOnly = options.jsonOnly || false;

        this.gmail = google.gmail('v1');

        this.points = [];
        this.part_num = 1;

        this.writePromise = Promise.resolve();

        Promise.promisifyAll(this.gmail.users.messages);
        Promise.promisifyAll(this.gmail.users);
    }

    static allowedOptions() {
        return ['to', 'subject', 'limit', 'jsonOnly'];
    }

    write(points) {
        this.points = this.points.concat(points);

        this.writePromise = this.writePromise.then(() => {
            if (this.limit) {
                return this._drain_points(this.limit);
            }
        });
    }

    eof() {

        this.writePromise = this.writePromise.then(() => {
            // Use a limit equal to the length of points so they are all
            // sent.
            return this._drain_points(this.points.length);
        });

        return this.writePromise;
    }

    _drain_points(limit) {
        if (this.points.length >= limit && this.points.length > 0) {
            let batch = this.points.splice(0, limit);
            return this._send_message(batch)
            .then(() => {
                return this._drain_points(limit);
            });
        } else {
            return Promise.resolve();
        }
    }

    _send_message(points) {
        this.logger.debug('sending: ', points);
        let subject = this.subject;
        let filename = 'juttle-program-output';

        // Only include part numbers if the configured limit is
        // non-zero.
        if (this.limit !== 0) {
            subject = subject.concat(` (part ${this.part_num})`);
            filename = filename.concat(`-part${this.part_num}`);
            this.part_num++;
        }
        filename = filename.concat('.json');

        // If a to: was not provided, look up the authenticated user's
        // email address.
        let to_email_addr_promise;

        if (this.to !== undefined) {
            to_email_addr_promise = Promise.resolve(this.to);
        } else {
            to_email_addr_promise = this.gmail.users.getProfileAsync({
                auth: auth,
                userId: 'me'
            })
           .then((response) => {

               this.logger.debug('Found email address for authenticated user:', response.emailAddress);

               // Save it for later messages
               this.to = response.emailAddress;
               return response.emailAddress;
           });
        }

        return to_email_addr_promise
        .then(() => {

            // By default, send the message as a multipart/alternative
            // with a text/plain part containing prettyprinted json,
            // and an application/json containing the stringified
            // json. If jsonOnly is true, skip the plain text part.

            // For some reason, the base64-encoded email must contain a
            // From: header, but when sent, the From: header is
            // overwritten with the email address of the authenticated
            // user.
            let opts = {from: 'nobody@nobody.com',
                        to: this.to,
                        subject: subject,
                        alternatives: [
                            {filename: filename,
                             contentType: 'application/json',
                             content: JSON.stringify(points)
                            }
                        ]
                       };

            if (! this.jsonOnly) {
                opts.text = JSON.stringify(points, null, 2);
            }

            let mail = mailcomposer(opts);

            Promise.promisifyAll(mail);

            return mail.buildAsync();
        })
        .then((message) => {
            this.logger.debug('About to send:', message.toString());
            let encoded = URLSafeBase64.encode(message).toString();

            let opts = {
                auth: auth,
                userId: 'me',
                resource: {
                    raw: encoded
                }
            };

            return this.gmail.users.messages.sendAsync(opts);
        })
        .then((response) => {
            this.logger.debug('Response from sending message:', response);
        });
    }
}

function init(provided_auth) {
    auth = provided_auth;
}

module.exports = {
    init: init,
    write: GmailWrite
};
