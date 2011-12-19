require('./lib/oembed').fetch("http://www.youtube.com/watch?v=XZ5TajZYW6Y", function() {
    console.log("fetched", arguments);
});
