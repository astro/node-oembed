#!/usr/bin/env node

var http = require('http');
var querystring = require('querystring');
var oembed = require('../lib/oembed');

if (process.argv.length < 3) {
    console.error("Usage: " + process.argv.join(' ') + " <listen-port> [listen-host]");
    process.exit(1);
}
var port = parseInt(process.argv[2], 10);
var host = process.argv[3] || "::";

function escapeXML(s) {
    return s.replace('&', '&amp;').
	replace('<', '&lt;').
	replace('>', '&gt;');
}

http.createServer(function(req, res) {
    var m;
    if (req.method === 'GET' &&
	req.url === "/") {
	res.writeHead(200, { "Content-type": "text/html" });
	res.write("<!DOCTYPE html>\n");
	res.write("<html><head><title>node-oembed HTTP service</title>\n");
	res.write("<link rel=\"shortcut icon\" href=\"/favicon.ico\">\n");
	res.write("</head><body>\n");
	res.write("<h1>node-oembed HTTP service</h1>");
	res.write("<p>Request path schema just like the <a href=\"http://embed.ly/docs/endpoints/1/oembed\">Embedly oEmbed API</a>:</p>");
	res.write("<pre>/1/oembed?url=:url&maxwidth=:maxwidth&maxheight=:maxheight&format=:format&callback=:callback</pre>");
	res.write("<h2>Example</h2>");
	res.write("<pre>/1/oembed?url=http%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DXZ5TajZYW6Y&amp;format=xml</pre>");
	res.end("</body></html>\n");
    } else if (req.url === "/favicon.ico") {
	/* Easter egg to prove that it works */
	oembed.fetch("http://www.youtube.com/watch?v=XZ5TajZYW6Y", null, function(error, result) {
	    if (error || !result || !result.thumbnail_url) {
		res.writeHead(500, { "Content-type": "text/plain" });
		res.end(error ? error.message : "No result");
		return;
	    }

	    res.writeHead(307, { "Location": result.thumbnail_url });
	    res.end();
	});
    } else if (req.method === 'GET' &&
	(m = req.url.match(/^\/1\/oembed\?(.*)/))) {
	var query = querystring.parse(m[1]);
	if (!query.url) {
	    res.writeHead(400, { "Content-type": "text/html" });
	    res.end("<h1>No URL</h1>\n");
	    return;
	}

	oembed.fetch(query.url, query, function(error, result) {
	    if (error || !result) {
		res.writeHead(500, { "Content-type": "text/plain" });
		res.end(error ? error.message : "No result");
		return;
	    }

	    switch(query.format || 'json') {
	    case 'json':
		res.writeHead(200, { "Content-type": oembed.MIME_OEMBED_JSON });
		if (query.callback)
		    res.write(query.callback + "(");
		res.write(JSON.stringify(result));
		if (query.callback)
		    res.write(")");
		res.end();
		break;
	    case 'xml':
		res.writeHead(200, { "Content-type": oembed.MIME_OEMBED_XML });
		res.write("<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\"?>\n");
		res.write("<oembed>\n");
		for(var k in result) {
		    var v = result[k];
		    if (v) {
			res.write("  <" + k + ">");
			res.write(escapeXML(v.toString()));
			res.write("</" + k + ">\n");
		    }
		}
		res.end("</oembed>\n");
		break;
	    default:
		res.writeHead(400, { "Content-type": "text/html" });
		res.end("<h1>Invalid format</h1>\n");
		return;
	    }
	});
    } else if (req.method === 'GET') {
	res.writeHead(404, { "Content-type": "text/html" });
	res.end("<h1>Not found</h1>\n");
    } else {
	res.writeHead(400, { "Content-type": "text/html" });
	res.end("<h1>Unsupported HTTP method</h1>\n");
    }
}).listen(port, host);
