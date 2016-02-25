'use strict';

let path = require('path');
let _ = require('underscore');
let juttle_test_utils = require('juttle/test').utils;
let check_juttle = juttle_test_utils.check_juttle;
let expect = require('chai').expect;
let read_config = require('juttle/lib/config/read-config');

describe('gmail adapter', function() {

    before(function() {

        // Try to read from the config file first. If not present,
        // look in the environment variable JUTTLE_GMAIL_CONFIG. In
        // TravisCI, the config is provided via the environment to
        // avoid putting sensitive information like ids/auth tokens in
        // source files.

        let config = read_config();
        let gmail_config;

        if (_.has(config, 'adapters') &&
            _.has(config.adapters, 'gmail')) {
            gmail_config = config.adapters.gmail;
        } else {
            if (! _.has(process.env, 'JUTTLE_GMAIL_CONFIG') ||
                process.env.JUTTLE_GMAIL_CONFIG === '') {
                throw new Error('To run this test, you must provide the adapter config via the environment as JUTTLE_GMAIL_CONFIG.');
            }
            gmail_config = JSON.parse(process.env.JUTTLE_GMAIL_CONFIG);
        }

        gmail_config.path = path.resolve(__dirname, '..');

        juttle_test_utils.configureAdapter({
            gmail: gmail_config
        });
    });

    describe(' properly returns errors for invalid timeranges like', function() {

        it(' no -from/-to/-last specified', function() {
            return check_juttle({
                program: 'read gmail | view table'
            }).catch(function(err) {
                expect(err.code).to.equal('MISSING-TIME-RANGE-ERROR');
            });
        });

        it(' -from/-to combined with -last', function() {
            return check_juttle({
                program: 'read gmail -from :2h ago: -to :1h ago: -last :1h: | view table'
            }).catch(function(err) {
                expect(err.code).to.equal('LAST-FROM-TO-ERROR');
            });
        });

        it(' -from combined with -last', function() {
            return check_juttle({
                program: 'read gmail -from :2h ago: -last :1h: | view table'
            }).catch(function(err) {
                expect(err.code).to.equal('LAST-FROM-TO-ERROR');
            });
        });

        it(' -to combined with -last', function() {
            return check_juttle({
                program: 'read gmail -to :1h ago: -last :1h: | view table'
            }).catch(function(err) {
                expect(err.code).to.equal('LAST-FROM-TO-ERROR');
            });
        });

        it(' -from later than -to', function() {
            return check_juttle({
                program: 'read gmail -from :1h ago: -to :2h ago: | view table'
            }).catch(function(err) {
                expect(err.code).to.equal('TO-BEFORE-FROM-MOMENT-ERROR');
            });
        });
    });

    it(' can read basic emails', function() {
        this.timeout(60000);
        return check_juttle({
            program: 'read gmail -last :1d:| view text'
        })
        .then(function(result) {
            expect(result.errors).to.have.length(0);
            expect(result.warnings).to.have.length(0);
            for (let line of result.sinks.text) {
                expect(line).to.contain.keys(['time', 'id', 'snippet', 'from', 'to']);
            }
        });
    });

    it(' can write basic emails', function() {
        this.timeout(60000);
        return check_juttle({
            program: 'emit -from :0: -limit 10 | write gmail'
        })
        .then(function(result) {
            expect(result.errors).to.have.length(0);
            expect(result.warnings).to.have.length(0);
        });
    });

    it(' can write basic emails with a -limit that forces splitting into multiple emails', function() {
        this.timeout(60000);
        return check_juttle({
            program: 'emit -from :0: -limit 10 | write gmail -limit 5'
        })
        .then(function(result) {
            expect(result.errors).to.have.length(0);
            expect(result.warnings).to.have.length(0);
        });
    });

    it(' can write basic emails for a program containing multiple branches', function() {
        this.timeout(60000);
        return check_juttle({
            program: '(emit -from :0: -limit 10; emit -from :1: -limit 5) | write gmail'
        })
        .then(function(result) {
            expect(result.errors).to.have.length(0);
            expect(result.warnings).to.have.length(0);
        });
    });
});

