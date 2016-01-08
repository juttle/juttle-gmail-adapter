# Juttle Gmail Adapter

Gmail adapter for the [Juttle data flow
language](https://github.com/juttle/juttle).

This uses the
[nodejs API for google](https://www.npmjs.com/package/googleapis) to
read and write gmail messages. It also uses
[Batchelor](https://www.npmjs.com/package/batchelor) to perform
batched email fetches, something that the main google API does not
currently support.

## Examples

```juttle
read gmail -from :5 days ago: -raw "to:me"
   | reduce count() by from
   | sort count -desc
   | view table -title "Who sends me the most mail?";
```

```juttle
read gmail -from :5 days ago: -to :1 day ago: -raw "to:me"
   | batch -every :1h:
   | reduce count()
   | view timechart -title "When during the day do I get mail?"
```

```juttle
read gmail -from :5 days ago: -to :1 day ago: -raw "to:me"
   | batch -every :1h:
   | reduce count()
   | write gmail -subject "When during the day do I get mail?"
```

## Installation

Like Juttle itself, the adapter is installed as a npm package. Both Juttle and
the adapter need to be installed side-by-side:

```bash
$ npm install juttle
$ npm install juttle-gmail-adapter
```
## Configuration

Configuration involves these steps:

1. Create application credentials that allow your code to access the google nodejs APIs.
2. Authorize a user using Oauth2 to use the application to access gmail.
3. Add the appropriate configuration items to `.juttle/config.js`

### Create application credentials

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

### Authorize a user using OAuth2

You need to create an oauth2 token that allows this program to read your email on your behalf.

To do this, run `node create_oauth_token.js` from the juttle-gmail-adapter directory.

This will provide a json config block to add to your `.juttle/config.js` file.

This will also use the gmail nodejs api to read the list of labels
assocated with the authenticated user, to verify that the token was created successfully.

### Add the appropriate configuration items to `.juttle/config.js`

`create_oauth_token.js` printed a configuration block like this:

```
{
  "adapters": {
    "juttle-gmail-adapter": {
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

Add this configuration to your `.juttle/config.js` file. If you
have an existing "adapters" section, for example:

```
{
  "adapters": {
    "juttle-twitter-adapter": {...}
  }
}
```

Add the juttle-gmail-adapter section as a peer item below "adapters":
```
{
  "adapters": {
    "juttle-twitter-adapter": {...},
    "juttle-gmail-adapter": {...}
  }
}
```

## Usage

### Read Options

Name | Type | Required | Description
-----|------|----------|-------------
`raw`  | string | no  | Use the following [advanced search](https://support.google.com/mail/answer/7190?hl=en) filter to select messages.
`from` | moment | no | select messages after this time (inclusive)
`to`   | moment | no | select messages before this time (exclusive)

### Write Options

Name | Type | Required | Description
-----|------|----------|-------------
`to` | string | no     | the to: header of the message. If not specified, defaults to the email address of the authenticated user.
`subject` | string | no | the subject of the message.  Default is 'Juttle Program Output'. If output is split, " (part <part-num>)" is appended to subject.
`limit` | number | no  | split output into batches of <limit> points. By default all points are buffered in memory until the program has completed.
`jsonOnly` | boolean | no | if true, only include a raw JSON mime part in the email. The default (false) is to attach a plain/text as well as application/json part.

## Detailed Walkthough

If you want to write your own adapter, look at the [detailed notes](./docs/adapter_impl_notes.md) on how the Gmail adapter interacts with the Juttle runtime/compiler to fetch messages and pass them as points to the juttle program.

## Contributing

Want to contribute? Awesome! Don’t hesitate to file an issue or open a pull
request.
