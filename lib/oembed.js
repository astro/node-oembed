var request = require('request');
var htmlparser = require("htmlparser");
var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Write stream that collects <link rel='alternate'> @href by @type
 * 
 * @param {Function} cb Final callback
 */
function Discovery(cb) {
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
	this.alternates[type] = href;
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
	if (el.name === 'link' &&
	    attrs &&
	    attrs.rel === 'alternate' &&
	    attrs.type &&
	    attrs.href) {

	    this.disco.addAlternate(attrs.type, attrs.href);
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
    var req = request(url);
    req.on('response', function(res) {
	if (res.statusCode === 200) {
	    var disco = new Discovery(cb);
	    util.pump(res, disco);
	} else
	    cb(new Error("HTTP status " + res.statusCode));
    });
    req.on('error', function(error) {
	cb(error);
    });
}

var MIME_OEMBED_JSON = 'application/json+oembed';
var MIME_OEMBED_XML = 'text/xml+oembed';

exports.fetch = function(url, cb) {
    exports.discover(url, function(error, alternates) {
	if (alternates && alternates[MIME_OEMBED_JSON]) {
	    request(alternates[MIME_OEMBED_JSON], function(error, res, body) {
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
	} else if (alternates && alternates[MIME_OEMBED_XML])
	    cb(new Error("Implement xml+oembed for" + alternates[MIME_OEMBED_XML]));
	else
	    cb(error || new Error("No oEmbed links discovered"));
    });
};
