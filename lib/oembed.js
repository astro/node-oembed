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

function getElementText(el) {
    if (el.children)
	return el.children.map(getElementText).join("");
    else if (el.type === 'text')
	return el.data;
    else
	return "";
}

exports.fetchXML = function(url, cb) {
    var req = request(url);
    req.on('response', function(res) {
	if (res.statusCode === 200) {
	    var parser = new OEmbedXMLParser(cb);
	    util.pump(res, parser);
	} else
	    cb(new Error("HTTP status " + res.statusCode));
    });
    req.on('error', function(error) {
	cb(error);
    });
};

exports.fetchJSON = function(url, cb) {
    request(url, function(error, res, body) {
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
var MIME_OEMBED_XML = exports.MIME_OEMBED_XML = 'text/xml+oembed';

exports.fetch = function(url, cb) {
    exports.discover(url, function(error, alternates) {
	if (alternates && alternates[MIME_OEMBED_JSON])
	    exports.fetchJSON(alternates[MIME_OEMBED_JSON], cb);
	else if (alternates && alternates[MIME_OEMBED_XML])
	    exports.fetchXML(alternates[MIME_OEMBED_XML], cb);
	else
	    cb(error || new Error("No oEmbed links discovered"));
    });
};
