// No phone-side work needed — the app has no network calls (see
// src/embeddedjs/main.js for why).
Pebble.addEventListener("ready", function () {
	console.log("Moon Phase: pkjs ready");
});
