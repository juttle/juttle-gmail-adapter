var _ = require('underscore');
var juttle_test_utils = require('juttle/test/runtime/specs/juttle-test-utils');
var Juttle = require('juttle/lib/runtime').Juttle;
var GmailAdapter = require('../');
var check_juttle = juttle_test_utils.check_juttle;

describe('gmail adapter', function() {

    before(function() {

        // The config is provided via the environment to avoid putting
        // sensitive information like ids/auth tokens in source
        // files. If you want to run this test using your own setup,
        // json stringify the portion of your config under the
        // "juttle-gmail-adapter" object and set it in the environment
        // as JUTTLE_GMAIL_CONFIG.

        if (! _.has(process.env, "JUTTLE_GMAIL_CONFIG")) {
            throw new Error("To run this test, you must provide the adapter config via the environment as JUTTLE_GMAIL_CONFIG.");
        }

        var config_text = process.env.JUTTLE_GMAIL_CONFIG;
        var config = JSON.parse(config_text);
        var adapter = GmailAdapter(config, Juttle);

        Juttle.adapters.register(adapter.name, adapter);
    });

    it('basic email reading', function() {
        this.timeout(60000);
        return check_juttle({
            program: 'read gmail -from :6 months ago: | reduce count() by from | sort count -desc | view table -title "Who sends me the most mail?"'
        });
    });
});


