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

Configuration involves these steps:
1. Create application credentials that allow your code to access the google nodejs APIs.
2. Authorize a user using Oauth2 to use the application to access gmail.
3. Add the appropriate configuration items to `.juttle/config.{js,json}`

## Create application credentials

To create application credentials, follow the
[nodejs quickstart instructions](https://developers.google.com/gmail/api/quickstart/nodejs). This
will result in a file on disk titled `client_secret.json` with this structure:

```
{
  "installed": {
    "client_id": "--your-client-id--",
    "project_id": "--your-project-id",
    "auth_uri": "https:\/\/accounts.google.com\/o\/oauth2\/auth",
    "token_uri": "https:\/\/accounts.google.com\/o\/oauth2\/token",
    "auth_provider_x509_cert_url": "https:\/\/www.googleapis.com\/oauth2\/v1\/certs",
    "client_secret": "--your-client-secret-id--",
    "redirect_uris": [
      "urn:ietf:wg:oauth:2.0:oob",
      "http:\/\/localhost"
    ]
  }
}
```

You'll use this file in the next step.

## Authorize a user using OAuth2

You need to create an oauth2 token that allows this program to read your email on your behalf.

To do this, run `node create_oauth_token.js` from the gmail-backend directory.

This will provide a json config block to add to your `.juttle/config.{js,json}` file.

This will also use the gmail nodejs api to read the list of labels
assocated with the authenticated user, to verify that the token was created successfully.

## Add the appropriate configuration items to `.juttle/config.{js,json}`

`create_oauth_token.js` printed a configuration block like this:

```
{
  "backends": {
    "juttle-gmail-backend": {
      "client-credentials": {
        "installed": {
          "client_id": "--your-client-id--",
          "project_id": "--your-project-id",
          "auth_uri": "https:\/\/accounts.google.com\/o\/oauth2\/auth",
          "token_uri": "https:\/\/accounts.google.com\/o\/oauth2\/token",
          "auth_provider_x509_cert_url": "https:\/\/www.googleapis.com\/oauth2\/v1\/certs",
          "client_secret": "--your-client-secret-id--",
          "redirect_uris": [
            "urn:ietf:wg:oauth:2.0:oob",
            "http:\/\/localhost"
          ]
        }
      },
      "oauth2-token": {
        "access_token": "---your-access-token---",
        "token_type": "Bearer",
        "refresh_token": "---your-refresh-token---",
        "expiry_date": DDDDDDDDDDDDD
      }
    }
  }
}
```

Add this configuration to your `.juttle/config.{js,json}` file. If you
have an existing "backends" section, for example:

```
{
  "backends": {
    "juttle-twitter-backend": {...}
  }
}
```

Add the juttle-gmail-backend section as a peer item below "backends":
```
{
  "backends": {
    "juttle-twitter-backend": {...},
    "juttle-gmail-backend": {...}
  }
}
```

# Usage

I've only used this for historical reads so far. -from and -to are
honored. Currently the entire search expression is passed directly
through to gmail as the
[advanced search](https://support.google.com/mail/answer/7190?hl=en)
expression.

