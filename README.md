node-oembed
===========

From [oEmbed.com](http://oembed.com/):

> oEmbed is a format for allowing an embedded representation of a URL
> on third party sites. The simple API allows a website to display
> embedded content (such as photos or videos) when a user posts a link
> to that resource, without having to parse the resource directly.

This library allows you to discover and retrieve the oEmbed JSON
descriptors for these posts. It automatically converts the additional
XML format to JavaScript objects for your convenience.  This package
comes with multiple tools that allow you to consume oEmbed
information.


Installation
------------

    npm i oembed

Don't forget to put it in `dependencies` of your `package.json` later
if you use this in a node app.


Features
--------

* Supports both

  * application/json+oembed
  * text/xml+oembed

* Automatic [Embed.ly](http://embed.ly/) fallback when an API key is provided
* Uses [htmlparser](https://github.com/tautologistics/node-htmlparser/) for HTML and XML parsing


Tools (bin/)
------------

### oembed_get &lt;URL&gt;

Retrieve and display oEmbed information for a custom URL.

### oembed_httpd &lt;bind-port&gt; [bind-host]

Replicates the embed.ly API in a simple Web server.

### oembed_diff_json_xml &lt;URL&gt;

Compare JSON and XML descriptors for a URL.


API (require('oembed'))
-----------------------

In a real-world app all you should need is the *fetch* function to get
oEmbed information. We always use the `function callback(error,
result)` convention.

```javascript
oembed.fetch(url, { maxwidth: 1920 }, function(error, result) {
    if (error)
        console.error(error);
    else
        console.log("oEmbed result", result);
});
```

The two steps can be executed separately whenever you need more
control:

* `oembed.discover(url, callback)` finds all `<link rel="alternate">`
  in a document
* Get and parse descriptors immediately with `oembed.fetchJSON(url,
  callback)` and `oembed.fetchXML(url, callback)` if you have
  discovery information already


### Embed.ly fallback

The Embed.ly service can deliver oEmbed information even for resources
that don't provide oEmbed links. Go
[sign up](https://app.embed.ly/pricing/free) with them and configure
your API key like:

```javascript
oembed.EMBEDLY_KEY = "...";
```

TODO
----

* Document size limits?
* bin/oembed_httpd: Multiple URLs like embed.ly
* bin/oembed_httpd: Pass through for ETags and Last-Modified
