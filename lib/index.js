var googleAuth = require('google-auth-library');
var Read = require('./read');
var Write = require('./write');

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

    var auth = authorize(config["client-credentials"],
                         config["oauth2-token"]);

    Read.init(auth);
    Write.init(auth);

    return {
        name: 'gmail',
        read: Read.read,
        write: Write.write
    };
};

module.exports = GmailBackend;
