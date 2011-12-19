#!/usr/bin/env node

var oembed = require('../lib/oembed');

if (process.argv.length < 3) {
    console.error("Usage: " + process.argv.join(' ') + " <URLs>");
    process.exit(1);
}

process.argv.slice(2).forEach(function(url) {
    oembed.discover(url, function(error, alternates) {
	if (error) {
	    console.error(error.toString() + " for " + url);
	    return;
	}

	var jsonUrl = alternates[oembed.MIME_OEMBED_JSON];
	var xmlUrl = alternates[oembed.MIME_OEMBED_XML];
	if (jsonUrl && xmlUrl) {
	    var jsonResult, xmlResult;
	    function compare() {
		var k;
		if (!jsonResult || !xmlResult)
		    // Not ready yet
		    return;

		for(k in jsonResult) {
		    if (jsonResult.hasOwnProperty(k) &&
			!xmlResult.hasOwnProperty(k))
			console.warn("Key " + k + " only present in JSON");
		    else if (jsonResult[k] !== xmlResult[k])
			console.warn(JSON.stringify(jsonResult[k]) +
				     " ≠ " +
				     JSON.stringify(xmlResult[k]));
		}
		for(k in xmlResult) {
		    if (!jsonResult.hasOwnProperty(k) &&
			xmlResult.hasOwnProperty(k))
			console.warn("Key " + k + " only present in XML");
		}
	    }
	    oembed.fetchJSON(jsonUrl, function(error, result) {
		if (error || !result) {
		    console.error((error ? error.toString() : "Missing result") + " for " + url);
		    return;
		}
		jsonResult = result;
		compare();
	    });
	    oembed.fetchJSON(jsonUrl, function(error, result) {
		if (error || !result) {
		    console.error((error ? error.toString() : "Missing result") + " for " + url);
		    return;
		}
		xmlResult = result;
		compare();
	    });
	} else {
	    console.log("Insufficient alternates for " + url);
	    for(var k in alternates) {
		console.log(k + ": " + alternates[k]);
	    }
	}
    });
});