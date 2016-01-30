var _ = require('underscore');
var juttle_test_utils = require('juttle/test/runtime/specs/juttle-test-utils');
var Juttle = require('juttle/lib/runtime').Juttle;
var GmailAdapter = require('../');
var check_juttle = juttle_test_utils.check_juttle;
var expect = require('chai').expect;
var read_config = require('juttle/lib/config/read-config');

describe('gmail adapter', function() {

    before(function() {

        // Try to read from the config file first. If not present,
        // look in the environment variable JUTTLE_GMAIL_CONFIG. In
        // TravisCI, the config is provided via the environment to
        // avoid putting sensitive information like ids/auth tokens in
        // source files.

        var config = read_config();

        if (! _.has(config, "adapters")) {
            if (! _.has(process.env, "JUTTLE_GMAIL_CONFIG") ||
                process.env.JUTTLE_GMAIL_CONFIG === '') {
                throw new Error("To run this test, you must provide the adapter config via the environment as JUTTLE_GMAIL_CONFIG.");
            }
            var gmail_config = JSON.parse(process.env.JUTTLE_GMAIL_CONFIG);
            config = {
                adapters: {
                    gmail: gmail_config
                }
            };
        }

        var adapter = GmailAdapter(config.adapters.gmail, Juttle);

        Juttle.adapters.register(adapter.name, adapter);
    });

    describe(' properly returns errors for invalid timeranges like', function() {

        it(' no -from/-to/-last specified', function() {
            return check_juttle({
                program: 'read gmail | view table'
            }).catch(function(err) {
                expect(err.code).to.equal('RT-MISSING-TIME-RANGE-ERROR');
            });
        });

        it(' -from/-to combined with -last', function() {
            return check_juttle({
                program: 'read gmail -from :2h ago: -to :1h ago: -last :1h: | view table'
            }).catch(function(err) {
                expect(err.code).to.equal('RT-LAST-FROM-TO-ERROR');
            });
        });

        it(' -from combined with -last', function() {
            return check_juttle({
                program: 'read gmail -from :2h ago: -last :1h: | view table'
            }).catch(function(err) {
                expect(err.code).to.equal('RT-LAST-FROM-TO-ERROR');
            });
        });

        it(' -to combined with -last', function() {
            return check_juttle({
                program: 'read gmail -to :1h ago: -last :1h: | view table'
            }).catch(function(err) {
                expect(err.code).to.equal('RT-LAST-FROM-TO-ERROR');
            });
        });

        it(' -from later than -to', function() {
            return check_juttle({
                program: 'read gmail -from :1h ago: -to :2h ago: | view table'
            }).catch(function(err) {
                expect(err.code).to.equal('RT-TO-FROM-MOMENT-ERROR');
            });
        });
    });

    it(' can read basic emails', function() {
        this.timeout(60000);
        return check_juttle({
            program: 'read gmail -from :1 months ago: | reduce count() by from | sort count -desc | view table -title "Who sends me the most mail?"'
        })
        .then(function(result) {
            expect(result.errors).to.have.length(0);
            expect(result.warnings).to.have.length(0);
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


