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
const titleColor  = render.makeColor(140, 150, 195);
const textColor   = render.makeColor(235, 235, 245);
const dimColor    = render.makeColor(150, 155, 180);
const noteColor   = render.makeColor(235, 150, 90);

const titleFont = new render.Font("Gothic-Bold", 14);
const phaseFont = new render.Font("Gothic-Bold", 18);
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

function draw() {
	const w = render.width, h = render.height;
	render.begin();

	render.fillRectangle(skyColor, 0, 0, w, h);
	STARS.forEach(([nx, ny]) => {
		render.fillRectangle(starColor, Math.round(nx * w), Math.round(ny * h), 1, 1);
	});

	const title = "TONIGHT'S MOON";
	const titleW = render.getTextWidth(title, titleFont);
	render.drawText(title, titleFont, titleColor, (w - titleW) / 2, Math.round(h * 0.05));

	const cx = w / 2;
	const cy = Math.round(h * 0.42);
	const r = Math.round(Math.min(w, h) * 0.24);

	if (state === "loading") {
		drawMoon(cx, cy, r, 0);
		const msg = "Loading...";
		const mw = render.getTextWidth(msg, infoFont);
		render.drawText(msg, infoFont, dimColor, (w - mw) / 2, cy + r + 16);
	} else {
		drawMoon(cx, cy, r, phaseInfo.fraction);

		const nameW = render.getTextWidth(phaseInfo.name, phaseFont);
		render.drawText(phaseInfo.name, phaseFont, textColor, (w - nameW) / 2, cy + r + 12);

		const info = `${phaseInfo.illumination}% illuminated`;
		const infoW = render.getTextWidth(info, infoFont);
		render.drawText(info, infoFont, dimColor, (w - infoW) / 2, cy + r + 36);

		const dateStr = formatDate(new Date());
		const dateW = render.getTextWidth(dateStr, smallFont);
		render.drawText(dateStr, smallFont, dimColor, (w - dateW) / 2, cy + r + 56);

		if (!phaseInfo.fromApi) {
			const note = "offline estimate - tap to retry";
			const noteW = render.getTextWidth(note, smallFont);
			render.drawText(note, smallFont, noteColor, (w - noteW) / 2, h - 16);
		}
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

	const response = await fetch(url);
	if (!response.ok) throw new Error(`USNO API HTTP ${response.status}`);
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

let loading = false;
async function loadPhase() {
	if (loading) return;
	loading = true;
	state = "loading";
	draw();

	try {
		const fraction = await fetchPhaseFraction();
		phaseInfo = buildPhaseInfo(fraction, true);
	} catch (err) {
		console.log("Moon Phase: USNO fetch failed, using offline estimate - " + err);
		phaseInfo = buildPhaseInfo(localPhaseFraction(tonightAnchor().getTime()), false);
	}

	state = "ready";
	loading = false;
	draw();
}

watch.addEventListener("resize", draw);

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
