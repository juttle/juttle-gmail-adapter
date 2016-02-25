'use strict';

/* global JuttleAdapterAPI */
let AdapterRead = JuttleAdapterAPI.AdapterRead;
let JuttleMoment = JuttleAdapterAPI.types.JuttleMoment;

let Promise = require('bluebird');
let google = require('googleapis');
let _ = require('underscore');
let Batchelor = require('batchelor');
let FilterGmailCompiler = require('./filter-gmail-compiler');

let auth;

class GmailRead extends AdapterRead {

    periodicLiveRead() { return true;}

    defaultTimeOptions() {
        return {
            from: this.params.now,
            to: new JuttleMoment(Infinity)
        };
    }

    static allowedOptions() {
        return AdapterRead.commonOptions().concat(['raw']);
    }

    constructor(options, params) {
        super(options, params);

        this.logger.debug('intitialize', options, params);
        this.gmail = google.gmail('v1');

        this.raw = options.raw;
        this.filter_search_expr = undefined;

        if (params.filter_ast) {
            this.logger.debug('Filter ast: ', params.filter_ast);
            let compiler = new FilterGmailCompiler();
            this.filter_search_expr = compiler.compile(params.filter_ast);
            this.logger.debug('Filter expression: ', this.filter_search_expr);
        }

        Promise.promisifyAll(this.gmail.users.messages);
    }

    // XXX/mstemm ignoring limit/state for now
    read(from, to, limit, state) {
        // Build a search expression given the options.
        let search = this.raw || '';

        if (this.filter_search_expr !== undefined) {
            search += ' ' + this.filter_search_expr;
        }

        // The gmail search expression only has per-day granularity,
        // so we quantize the -from and -to to the nearest day and do
        // additional filtering in get_messages().

        // XXX/mstemm not sure how the time zone is set. It's definitely not in UTC.
        search += ' after:' + JuttleMoment.format(from, 'YYYY/MM/DD', 'US/Pacific');

        // Add 1 day to to and then quantize to a day. This
        // results in the next day, such that the before: date is
        // always in the future.
        if (! to.isEnd()) {
            search += ' before:' + JuttleMoment.format(to.add(JuttleMoment.duration(1, 'd')), 'YYYY/MM/DD', 'US/Pacific');
        }

        this.logger.debug('Search string:', search);
        return this.get_messages(from, to, search)
        .call('sort', (a, b) => {
            if (a.time.lt(b.time)) {
                return -1;
            } else if (a.time.eq(b.time)) {
                return 0;
            } else {
                return 1;
            }
        })
        .then((messages) => {
            let ret = {
                points: messages,
                readEnd: to
            };
            return ret;
        });
    }

    get_messages(from, to, search, pageToken) {
        let opts = {
            auth: auth,
            userId: 'me',
            q: search
        };

        if (pageToken) {
            opts.pageToken = pageToken;
        }

        return this.gmail.users.messages.listAsync(opts)
        .then((response) => {

            if (!_.has(response, 'messages')) {
                return [];
            }

            this.logger.debug(`Got ${response.messages.length} potential messages`);

            pageToken = response.nextPageToken;

            // Do a batch-fetch of all the message ids
            let batch = new Batchelor({
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
            batch.add(_.map(response.messages, (id) => {
                return {
                    method: 'GET',
                    'path': `/gmail/v1/users/me/messages/${id.id}?fields=internalDate,id,snippet,payload/headers`
                };
            }));

            Promise.promisifyAll(batch);
            return batch.runAsync()
            .then((response) => {
                return response.parts;
            });
        })
        .then((parts) => {
            let messages = [];

            for (let part of parts) {
                let message = part.body;
                let time = new JuttleMoment({rawDate: new Date(Number(message.internalDate))});

                this.logger.debug('Time of message: ' + time);
                if (time.lt(from)) {
                    continue;
                }

                if (time.gt(to)) {
                    continue;
                }

                let pt = {
                    time: time,
                    id: message.id,
                    snippet: message.snippet,
                    from: this.find_header(message, 'From'),
                    to: this.find_header(message, 'To'),
                    subject: this.find_header(message, 'Subject')
                };
                messages.push(pt);
            }

            if (pageToken) {
                return this.get_messages(from, to, search, pageToken).then((remaining_messages) => {
                    return messages.concat(remaining_messages);
                });
            } else {
                return messages;
            }
        });
    }

    find_header(message, name) {
        if (!_.has(message.payload, 'headers')) {
            return '';
        }

        let match = _.find(message.payload.headers, function(header) {
            return (header.name === name);
        });

        if (match === undefined) {
            return '';
        } else {
            return match.value;
        }
    }

}

function init(provided_auth) {
    auth = provided_auth;
}

module.exports = {
    init: init,
    read: GmailRead
};

