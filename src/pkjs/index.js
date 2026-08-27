// Bridges the watch's fetch() calls out to the internet via the phone.
// The watch app itself calls fetch() directly (see src/embeddedjs/main.js);
// this proxy is what actually performs the HTTP request on its behalf.
const moddableProxy = require("@moddable/pebbleproxy");

Pebble.addEventListener("ready", moddableProxy.readyReceived);
Pebble.addEventListener("appmessage", function (e) {
	moddableProxy.appMessageReceived(e);
});
