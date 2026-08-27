// Moon Phase — shows tonight's moon phase, drawn procedurally (no image
// assets) using the US Naval Observatory's Moon Phase API for the primary
// phase dates, interpolated to get today's exact position in the cycle.
// https://aa.usno.navy.mil/data/api#phase

import Poco from "commodetto/Poco";
import Button from "pebble/button";

console.log("Moon Phase: starting");

const render = new Poco(screen);

const skyColor    = render.makeColor(10, 12, 30);
const starColor   = render.makeColor(200, 205, 230);
const moonLit     = render.makeColor(228, 222, 196);
const moonDark    = render.makeColor(40, 44, 66);
const moonEdge    = render.makeColor(80, 84, 110);
const textColor   = render.makeColor(235, 235, 245);
const dimColor    = render.makeColor(150, 155, 180);
const noteColor   = render.makeColor(235, 150, 90);

const infoFont  = new render.Font("Gothic-Regular", 14);
const smallFont = new render.Font("Gothic-Regular", 9);

// Fixed decorative starfield, given as fractions of the screen size so it
// scales cleanly across a resize or a different watch shape.
const STARS = [
	[0.08, 0.10], [0.85, 0.07], [0.65, 0.15], [0.14, 0.32], [0.92, 0.34],
	[0.06, 0.58], [0.90, 0.62], [0.22, 0.88], [0.78, 0.90], [0.50, 0.05],
];

const PHASE_NAMES = [
	"New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
	"Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
	"Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let state = "loading"; // "loading" | "ready"
let phaseInfo = null;  // { fraction, illumination, name, fromApi }

// fraction: position in the lunar cycle since the last new moon, 0..1
// (0 = new moon, 0.25 = first quarter, 0.5 = full moon, 0.75 = last quarter).
function phaseNameFor(fraction) {
	const index = Math.floor(((fraction + 1 / 16) % 1) * 8);
	return PHASE_NAMES[index];
}

function formatDate(date) {
	return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Renders the moon disc by scanning it row by row. At vertical offset dy
// from the center, both the disc's edge and the day/night terminator are
// horizontal slices of ellipses that share the same vertical radius, so
// their half-widths at that row scale by the same factor — which means the
// terminator's half-width is just the disc's half-width scaled by
// cos(2*pi*fraction). That gives an exact terminator curve using only
// fillRectangle, no ellipse primitive required.
function drawMoon(cx, cy, r, fraction) {
	render.drawCircle(moonEdge, cx, cy, r + 1, 0, 360);

	const c = Math.cos(2 * Math.PI * fraction); // +1 new, 0 quarters, -1 full
	const waxing = fraction < 0.5;               // waxing -> lit on the right

	for (let dy = -r; dy <= r; dy++) {
		const k = Math.sqrt(Math.max(0, 1 - (dy * dy) / (r * r)));
		const hwCircle = r * k;
		const hwTerm = hwCircle * c;
		const rowY = cy + dy;
		const leftX = cx - hwCircle;
		const rightX = cx + hwCircle;
		const rowWidth = Math.max(1, Math.round(rightX - leftX));

		render.fillRectangle(moonDark, Math.round(leftX), rowY, rowWidth, 1);

		let litX, litW;
		if (waxing) {
			litX = cx + hwTerm;
			litW = rightX - litX;
		} else {
			litX = leftX;
			litW = (cx - hwTerm) - leftX;
		}
		litW = Math.round(litW);
		if (litW > 0)
			render.fillRectangle(moonLit, Math.round(litX), rowY, litW, 1);
	}
}

function drawCenteredText(text, font, color, y, w) {
	const textW = render.getTextWidth(text, font);
	render.drawText(text, font, color, (w - textW) / 2, y);
}

// Fixed 4-row layout: phase name, then date + illumination, then the moon
// itself, then an offline note if the data isn't live. Rows 1-2 use
// Gothic-Regular (not -Bold) at a small size since "Tonight's Phase:
// Waxing Crescent" is too wide for a 200px-class screen at larger/bolder
// sizes — Gothic-Regular-14 is the smallest step that still reads clearly
// while fitting every phase name on one line.
function draw() {
	const w = render.width, h = render.height;
	render.begin();

	render.fillRectangle(skyColor, 0, 0, w, h);
	STARS.forEach(([nx, ny]) => {
		render.fillRectangle(starColor, Math.round(nx * w), Math.round(ny * h), 1, 1);
	});

	// Reserve fixed space for all 4 rows up front — including row 4, whether
	// or not it actually has text this draw — so the moon's size and
	// position never shift between states. It's centered in whatever band
	// is left between the two text blocks, sized to fill that band.
	const topPad = Math.round(h * 0.04);
	const row1Y = topPad;
	const row2Y = row1Y + infoFont.height + 2;
	const topBlockBottom = row2Y + infoFont.height;

	const bottomPad = Math.round(h * 0.04);
	const row4Y = h - bottomPad - smallFont.height;
	const bottomBlockTop = row4Y - 4;

	const cx = w / 2;
	const cy = Math.round((topBlockBottom + bottomBlockTop) / 2);
	const maxRByHeight = Math.floor((bottomBlockTop - topBlockBottom) / 2) - 4;
	const maxRByWidth = Math.floor(w / 2) - 6;
	const r = Math.min(maxRByHeight, maxRByWidth);

	if (state === "loading") {
		drawCenteredText("Tonight's Phase: Loading...", infoFont, textColor, row1Y, w);
		drawMoon(cx, cy, r, 0);
	} else {
		drawCenteredText(`Tonight's Phase: ${phaseInfo.name}`, infoFont, textColor, row1Y, w);

		const dateStr = formatDate(new Date());
		drawCenteredText(`${dateStr}, ${phaseInfo.illumination}% illuminated`, infoFont, dimColor, row2Y, w);

		drawMoon(cx, cy, r, phaseInfo.fraction);

		if (!phaseInfo.fromApi)
			drawCenteredText("offline estimate - tap to retry", smallFont, noteColor, row4Y, w);
	}

	render.end();
}

// --- Moon phase data --------------------------------------------------

// The app answers "what will the moon look like tonight" — so phase
// calculations are anchored to a representative evening time on today's
// date, not the literal instant the calculation happens to run (which
// matters most when the daily 9 AM refresh fires).
function tonightAnchor() {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0, 0);
}

const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14); // a reference new moon

// Used only if the USNO API can't be reached: a plain mean-cycle estimate.
function localPhaseFraction(nowTs) {
	const days = (nowTs - KNOWN_NEW_MOON_UTC) / 86400000;
	let fraction = (days / SYNODIC_MONTH_DAYS) % 1;
	if (fraction < 0) fraction += 1;
	return fraction;
}

const PRIMARY_PHASE_FRACTION = {
	"New Moon": 0,
	"First Quarter": 0.25,
	"Full Moon": 0.5,
	"Last Quarter": 0.75,
};

// fetch() is relayed to the phone over Bluetooth AppMessage, and that
// channel isn't necessarily up yet the instant the watch app launches — if
// a request goes out before it's ready, this fetch() implementation has no
// built-in timeout, so the promise can simply never settle. Race it against
// a plain timer so a slow/never-ready connection degrades to the offline
// estimate instead of leaving the app stuck on "Loading..." forever.
const FETCH_TIMEOUT_MS = 15000;
function withTimeout(promise, ms, message) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), ms);
		promise.then(
			value => { clearTimeout(timer); resolve(value); },
			err => { clearTimeout(timer); reject(err); }
		);
	});
}

// Queries the USNO Moon Phase API for the primary phases (new/first
// quarter/full/last quarter) bracketing today, then linearly interpolates
// between them to get today's precise position in the cycle.
// https://aa.usno.navy.mil/data/api#phase
async function fetchPhaseFraction() {
	const now = tonightAnchor();
	const start = new Date(now.getTime() - 30 * 86400000);
	const dateParam = `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`;

	const url = new URL("https://aa.usno.navy.mil/api/moon/phases/date");
	url.search = (new URLSearchParams({ date: dateParam, nump: "8" })).toString();

	const response = await withTimeout(fetch(url), FETCH_TIMEOUT_MS, "USNO API request timed out");
	if (!response.ok) throw new Error(`USNO API HTTP ${response.status}`);
	// A rate-limit/error response can come back as an HTML page rather than
	// JSON. Bail before parsing it.
	const contentType = (response.headers && response.headers.get("content-type")) || "";
	if (contentType.indexOf("json") === -1)
		throw new Error("USNO API returned non-JSON response (" + contentType + ")");
	const data = await response.json();
	if (data.error || !Array.isArray(data.phasedata) || !data.phasedata.length)
		throw new Error("USNO API returned no phase data");

	const entries = data.phasedata.map(p => {
		const [hh, mm] = p.time.split(":").map(Number);
		return {
			ts: Date.UTC(p.year, p.month - 1, p.day, hh, mm),
			fraction: PRIMARY_PHASE_FRACTION[p.phase],
		};
	}).sort((a, b) => a.ts - b.ts);

	const nowTs = now.getTime();
	let prev = null, next = null;
	for (const entry of entries) {
		if (entry.ts <= nowTs) prev = entry;
		else if (!next) next = entry;
	}
	if (!prev || !next) throw new Error("USNO API window did not bracket today");

	let nextFraction = next.fraction;
	if (nextFraction <= prev.fraction) nextFraction += 1; // wrapped past new moon

	const span = next.ts - prev.ts;
	const progress = span > 0 ? (nowTs - prev.ts) / span : 0;
	const fraction = prev.fraction + progress * (nextFraction - prev.fraction);
	return ((fraction % 1) + 1) % 1;
}

function buildPhaseInfo(fraction, fromApi) {
	return {
		fraction,
		illumination: Math.round(((1 - Math.cos(2 * Math.PI * fraction)) / 2) * 100),
		name: phaseNameFor(fraction),
		fromApi,
	};
}

// This device's JS heap is tiny (~120KB), and a failed/unexpected response
// can still cost real memory before it's recognized as unusable. Rather
// than retry quickly on failure, back off hard: 2 minutes, then 4, 8, 16...
// A successful fetch hasn't shown any problem, so only failures extend the
// wait — the app stays just as responsive on the common path, and a user
// mashing "tap to retry" during an outage can't make things worse.
// Capped well under a day so a prolonged outage can never make this back
// off further than scheduleNextRefresh()'s own once-a-day cadence — without
// a cap, enough consecutive failures would silently swallow that daily
// attempt too, since it also goes through this same cooldown check.
const BASE_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const MAX_RETRY_BACKOFF_MS = 30 * 60 * 1000;
const MIN_RELOAD_INTERVAL_MS = 15000; // floor once a fetch has succeeded

let loading = false;
let lastLoadAt = 0;
let consecutiveFailures = 0;

function reloadCooldownMs() {
	if (consecutiveFailures === 0) return MIN_RELOAD_INTERVAL_MS;
	return Math.min(BASE_RETRY_BACKOFF_MS * Math.pow(2, consecutiveFailures - 1), MAX_RETRY_BACKOFF_MS);
}

async function loadPhase(force) {
	if (loading) return;
	if (!force && Date.now() - lastLoadAt < reloadCooldownMs()) return;
	loading = true;
	lastLoadAt = Date.now();
	state = "loading";
	draw();

	try {
		const fraction = await fetchPhaseFraction();
		phaseInfo = buildPhaseInfo(fraction, true);
		consecutiveFailures = 0;
	} catch (err) {
		consecutiveFailures++;
		const reason = String((err && err.message) || err).slice(0, 100);
		console.log("Moon Phase: USNO fetch failed (" + reason + "), using offline estimate. consecutiveFailures=" + consecutiveFailures);
		phaseInfo = buildPhaseInfo(localPhaseFraction(tonightAnchor().getTime()), false);
	}

	state = "ready";
	loading = false;
	draw();
}

watch.addEventListener("resize", draw);

// The initial loadPhase() call below can fire before the phone's
// AppMessage channel is actually up (see FETCH_TIMEOUT_MS above) and time
// out into the offline estimate. Once the connection genuinely comes up,
// retry right away rather than waiting out any backoff from that timeout —
// a connection state change is new information, not impatient mashing.
watch.addEventListener("connected", () => {
	if (watch.connected.pebblekit) loadPhase(true);
});

new Button({
	types: ["select"],
	onPush(down, type) {
		if (down && type === "select") loadPhase();
	},
});

// Refresh once every morning at 9 AM local time, so the phase is already
// re-anchored to that evening before the user glances at the watch.
// Recomputed on each firing (rather than a single 24h setInterval) so it
// can't drift and stays correct across the app being backgrounded/resumed.
function msUntilNext9am() {
	const now = new Date();
	const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
	if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
	return next.getTime() - now.getTime();
}

function scheduleNextRefresh() {
	setTimeout(() => {
		loadPhase();
		scheduleNextRefresh();
	}, msUntilNext9am());
}

draw();
loadPhase();
scheduleNextRefresh();
