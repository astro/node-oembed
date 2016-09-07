var request = require('request').defaults({maxRedirects:3});
var htmlparser = require("htmlparser");
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var parseUrl = require('url').parse;
var formatUrl = require('url').format;
var resolveUrl = require('url').resolve;
var querystring = require('querystring');


/**
 * Set this if you want fallback for sites that don't provide oEmbed.
 */
exports.EMBEDLY_KEY = undefined;
exports.EMBEDLY_URL = "http://api.embed.ly/1/oembed";

/**
 * htmlparser is not doing that for us :-(
 */
function expandEntities(s) {
    if (typeof s !== 'string')
	return undefined;
    return s.replace('&amp;', '&').
	replace('&lt;', '<').
	replace('&gt;', '>').
	replace('&quot;', '"').
	replace('&apos;', '\'');
}

function getElementText(el) {
    if (el.children)
	return expandEntities(el.children.map(getElementText).join(""));
    else if (el.type === 'text')
	return expandEntities(el.data);
    else
	return "";
}

/**
 * Wraps request()
 */
function httpGet(url, cb) {
    try {
	return request({ uri: url,
			 jar: false,  /* no cookies */
			 headers: {
			     "User-Agent": exports.USER_AGENT
			 }
		       }, cb);
    } catch (e) {
	/* request() throws at us */
	if (cb)
	    cb(e);
	else
	    throw e;
    }
}

var package = require('../package.json');
exports.USER_AGENT = "node-oembed/" + package.version + " (" + package.homepage + ")";

/**
 * Write stream that collects <link rel='alternate'> @href by @type
 *
 * @param {Function} urlConvert Expands relative to absolute URL
 * @param {Function} cb Final callback
 */
function Discovery(urlConvert, cb) {
    this.urlConvert = urlConvert;
    this.callback = cb;
    var handler = new DiscoveryHandler(this);
    this.parser = new htmlparser.Parser(handler);
    this.alternates = {};
}
util.inherits(Discovery, EventEmitter);

Discovery.prototype.write = function(data) {
    this.parser.parseChunk(data);
    return true;
};

Discovery.prototype.end = function() {
    this.parser.done();
};

Discovery.prototype.addAlternate = function(type, href) {
    if (!this.alternates.hasOwnProperty(type))
	this.alternates[type] = this.urlConvert(href);
};

Discovery.prototype.onDone = function() {
    this.callback(null, this.alternates);
};

/**
 * Methods implement htmlparser handler interface
 *
 * @param {Discovery} disco
 */
function DiscoveryHandler(disco) {
    this.disco = disco;
}

DiscoveryHandler.prototype = {
    reset: function() {
    },
    done: function() {
	this.disco.onDone();
    },
    writeTag: function(el) {
	var attrs = el.attribs;
	var type = attrs && expandEntities(attrs.type);
	var href = attrs && expandEntities(attrs.href);
	if (el.name === 'link' &&
	    attrs && attrs.rel === 'alternate' &&
	    type && href) {
	    this.disco.addAlternate(type, href);
	}
    },
    writeText: function() {
    },
    writeComment: function() {
    },
    writeDirective: function() {
    }
};

exports.discover = function(url, cb) {
    var req;
    try {
	req = httpGet(url);
    } catch (e) {
	return cb(e);
    }

    req.on('response', function(res) {
	if (res.statusCode === 200) {
	    var disco = new Discovery(function(href) {
		return resolveUrl(url, href);
	    }, cb);
	    res.pipe(disco);
	} else
	    cb(new Error("HTTP status " + res.statusCode));
    });
    req.on('error', function(error) {
	cb(error);
    });
};

function OEmbedXMLParser(cb) {
    this.callback = cb;
    var handler = new htmlparser.DefaultHandler(function(error, dom) {
	var oembedRoot = dom &&
	    dom.filter(function(el) {
		return el.name === 'oembed';
	    })[0];
	if (oembedRoot && oembedRoot.children) {
	    var result = {};
	    oembedRoot.children.forEach(function(child) {
		if (child.name)
		    result[child.name] = getElementText(child);
	    });
	    cb(null, result);
	} else
	    cb(error || new Error("Invalid oEmbed document"));
    });
    this.parser = new htmlparser.Parser(handler);
    this.alternates = {};
}
util.inherits(OEmbedXMLParser, EventEmitter);

OEmbedXMLParser.prototype.write = function(data) {
    this.parser.parseChunk(data);
    return true;
};

OEmbedXMLParser.prototype.end = function() {
    this.parser.done();
};

exports.fetchXML = function(url, cb) {
    var req = httpGet(url);
    req.on('response', function(res) {
	if (res.statusCode === 200) {
	    var parser = new OEmbedXMLParser(cb);
	    res.pipe(parser);
	} else
	    cb(new Error("HTTP status " + res.statusCode));
    });
    req.on('error', function(error) {
	cb(error);
    });
};

exports.fetchJSON = function(url, cb) {
    httpGet(url, function(error, res, body) {
	if (!error &&
	    res.statusCode === 200 &&
	    body) {
	    try {
		cb(null, JSON.parse(body));
	    } catch (e) {
		cb(e);
	    }
	} else
	    cb(error || new Error("HTTP status " + res.statusCode));
    });
};

var MIME_OEMBED_JSON = exports.MIME_OEMBED_JSON = 'application/json+oembed';
var MIME_OEMBED_TEXT_JSON = exports.MIME_OEMBED_TEXT_JSON = 'text/json+oembed';
var MIME_OEMBED_XML = exports.MIME_OEMBED_XML = 'text/xml+oembed';
var ALLOWED_PARAMETERS = ["url", "format", "key", "maxwidth", "maxheight"];

function applyParameters(url, parameters) {
    if (!parameters)
	/* Nothing to do, skip */
	return url;

    if (!url.query || typeof url.query === 'string')
	/* Parse querystring */
	url = parseUrl(url, true);

    for(var k in parameters)
	if (ALLOWED_PARAMETERS.indexOf(k) >= 0)
	    url.query[k] = parameters[k];

    /* request assumes .search, not .query */
    url.search = "?" + querystring.stringify(url.query);
    /* different libraries handle the multiple data of url onjects
     * differently, we use both the node stdlib and request. let's just
     * serialize for them so our parameters are kept.
     */
    return formatUrl(url);
}

/**
 * Main entry point
 */
exports.fetch = function(url, parameters, cb) {
    exports.discover(url, function(error, alternates) {
	var oembedUrl;
	if (alternates && alternates[MIME_OEMBED_JSON]) {
	    oembedUrl = applyParameters(alternates[MIME_OEMBED_JSON], parameters);
	    exports.fetchJSON(oembedUrl, cb);
	} else if (alternates && alternates[MIME_OEMBED_TEXT_JSON]) {
	    oembedUrl = applyParameters(alternates[MIME_OEMBED_TEXT_JSON], parameters);
	    exports.fetchJSON(oembedUrl, cb);
	} else if (alternates && alternates[MIME_OEMBED_XML]) {
	    oembedUrl = applyParameters(alternates[MIME_OEMBED_XML], parameters);
	    exports.fetchXML(oembedUrl, cb);
	} else if (exports.EMBEDLY_KEY) {
	    if (!parameters)
		parameters = {};
	    /* Fallback to the Embedly oEmbed API */
	    parameters.key = exports.EMBEDLY_KEY;
	    parameters.url = url;
	    /* Sanitize user-provided parameters */
	    parameters.format = 'json';
	    delete parameters.callback;

	    oembedUrl = applyParameters(exports.EMBEDLY_URL, parameters);
	    exports.fetchJSON(oembedUrl, cb);
	} else
	    cb(error || new Error("No oEmbed links discovered"));
    });
};
