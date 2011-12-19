#!/usr/bin/env node

var oembed = require('../lib/oembed');

if (process.argv.length < 3) {
    console.error("Usage: " + process.argv.join(' ') + " <URL> [maxwidth=1024] [maxheight=768]");
    process.exit(1);
}

var url = process.argv[2];

var parameters;  /* None by default */
process.argv.slice(3).forEach(function(arg) {
    if (!parameters)
	parameters = {};

    var m;
    if ((m = arg.match(/(.+?)=(.*)/))) {
	parameters[m[1]] = m[2];
    } else
	throw "Unrecognized argument: " + arg;
});

oembed.fetch(url, parameters, function(error, result) {
    if (error)
	console.error(error.message || error.toString());
    else
	console.log(JSON.stringify(result));
});
