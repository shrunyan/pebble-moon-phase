// Moon Phase — shows tonight's moon phase, drawn procedurally (no image
// assets). Computed locally (Jean Meeus, Astronomical Algorithms 2nd ed.,
// ch. 49; the Quarters use the full 25-term correction series) — typically
// accurate to within a couple of minutes on primary phase timing, which is
// far tighter than this app's display resolution. The phase is recomputed
// every time the app is opened, and again whenever the select button is
// pressed.
//
// There is no network call: an earlier version also confirmed/upgraded this
// against the USNO Moon Phase API in the background, but that fetch reliably
// crashed the watch with an out-of-memory abort (reproduced on both the QEMU
// emulator and physical hardware, across several memory-optimization
// attempts), so it was removed rather than keep shipping a crashing app.
// This app targets the Pebble Time 2 (emery) — a rectangular display — only.

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

const infoFont = new render.Font("Gothic-Regular", 14);

// Fixed decorative starfield, given as fractions of the screen size so it
// scales cleanly if the drawing surface is reported at a different size.
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

let phaseInfo; // { fraction, illumination, name } — set before first draw(), see bottom of file

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

// Fixed 3-row layout: phase name, then date + illumination, then the moon.
// Rows 1-2 use Gothic-Regular (not -Bold) at a small size since "Tonight's
// Phase: Waxing Crescent" is too wide for a 200px-class screen at larger/
// bolder sizes — Gothic-Regular-14 is the smallest step that still reads
// clearly while fitting every phase name on one line.
function draw() {
	if (!phaseInfo) return; // nothing computed yet; refreshPhase() draws once it is

	const w = render.width, h = render.height;
	render.begin();

	render.fillRectangle(skyColor, 0, 0, w, h);
	STARS.forEach(([nx, ny]) => {
		render.fillRectangle(starColor, Math.round(nx * w), Math.round(ny * h), 1, 1);
	});

	const topPad = Math.round(h * 0.08);
	const row1Y = topPad;
	const row2Y = row1Y + infoFont.height + 8;
	const topBlockBottom = row2Y + infoFont.height + 14;

	const bottomPad = Math.round(h * 0.07);
	const bottomBlockTop = h - bottomPad;

	const cx = w / 2;
	const cy = Math.round((topBlockBottom + bottomBlockTop) / 2);
	const maxRByHeight = Math.floor((bottomBlockTop - topBlockBottom) / 2);
	const maxRByWidth = Math.floor(w / 2) - 14;
	const r = Math.min(maxRByHeight, maxRByWidth);

	drawCenteredText(`Tonight's Phase: ${phaseInfo.name}`, infoFont, textColor, row1Y, w);

	const dateStr = formatDate(phaseInfo.date);
	drawCenteredText(`${dateStr}, ${phaseInfo.illumination}% illuminated`, infoFont, dimColor, row2Y, w);

	drawMoon(cx, cy, r, phaseInfo.fraction);

	render.end();
}

// --- Moon phase calculation (Jean Meeus, Astronomical Algorithms ch. 49) --

// The app answers "what will the moon look like tonight" — so the
// calculation is anchored to a representative evening time on today's
// date, not the literal instant it happens to run.
function tonightAnchor() {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0, 0);
}

const DEG2RAD = Math.PI / 180;

function normalizeDegrees(deg) {
	let d = deg % 360;
	if (d < 0) d += 360;
	return d;
}

function toJulianDate(date) {
	let year = date.getUTCFullYear();
	let month = date.getUTCMonth() + 1;
	const day = date.getUTCDate() +
		(date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;
	if (month <= 2) { year -= 1; month += 12; }
	const A = Math.floor(year / 100);
	const B = 2 - A + Math.floor(A / 4);
	return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

const MEEUS_PHASE_TYPES = ["new", "first_quarter", "full", "last_quarter"];
const MEEUS_PHASE_OFFSET = { new: 0, first_quarter: 0.25, full: 0.5, last_quarter: 0.75 };

// Rough lunation number nearest a date — only needs to land within about
// half a cycle of correct, since meeusPhaseFraction() below samples a full
// window of neighboring lunations and picks the true bracket by exact JDE
// comparison rather than trusting this estimate directly.
function estimateBaseLunation(date) {
	const decimalYear = date.getUTCFullYear() + date.getUTCMonth() / 12;
	return Math.round((decimalYear - 2000.0) * 12.3685);
}

// JDE of one specific phase event: lunation is a whole-cycle offset from
// the algorithm's epoch, phaseType selects which of the 4 primary phases
// within that lunation. Meeus, Astronomical Algorithms (2nd ed.), ch. 49 /
// Table 49.A. New/Full use their own 14-term periodic series; the Quarters
// use the full 25-term series plus the extra "W" term for the asymmetric
// geometry of a half-lit disc. Written as flat expressions (no term tables)
// to keep module-load allocation near zero — this device's JS heap is only
// ~120KB and static arrays here overflow it on launch.
function meeusPhaseJde(lunation, phaseType) {
	const k = lunation + MEEUS_PHASE_OFFSET[phaseType];
	const T = k / 1236.85;
	const T2 = T * T, T3 = T2 * T, T4 = T3 * T;

	const jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;

	const M = normalizeDegrees(2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3) * DEG2RAD;
	const Mp = normalizeDegrees(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * DEG2RAD;
	const F = normalizeDegrees(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * DEG2RAD;
	const Omega = normalizeDegrees(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * DEG2RAD;

	const E = 1.0 - 0.002516 * T - 0.0000074 * T2;
	const EE = E * E;

	// A1: first planetary-argument correction, applied to every phase.
	const A1 = normalizeDegrees(299.77 + 0.107408 * k - 0.009173 * T2) * DEG2RAD;

	let corrections, additional;
	if (phaseType === "new" || phaseType === "full") {
		corrections = phaseType === "new"
			? -0.40720 * Math.sin(Mp) + 0.17241 * E * Math.sin(M) + 0.01608 * Math.sin(2 * Mp) +
			   0.01039 * Math.sin(2 * F) + 0.00739 * E * Math.sin(Mp - M) + -0.00514 * E * Math.sin(Mp + M) +
			   0.00208 * EE * Math.sin(2 * M) + -0.00111 * Math.sin(Mp - 2 * F) + -0.00057 * Math.sin(Mp + 2 * F) +
			   0.00056 * E * Math.sin(2 * Mp + M) + -0.00042 * Math.sin(3 * Mp) + 0.00042 * E * Math.sin(M + 2 * F) +
			   0.00038 * E * Math.sin(M - 2 * F) + -0.00024 * E * Math.sin(2 * Mp - M)
			: -0.40614 * Math.sin(Mp) + 0.17302 * E * Math.sin(M) + 0.01614 * Math.sin(2 * Mp) +
			   0.01043 * Math.sin(2 * F) + 0.00734 * E * Math.sin(Mp - M) + -0.00515 * E * Math.sin(Mp + M) +
			   0.00209 * EE * Math.sin(2 * M) + -0.00111 * Math.sin(Mp - 2 * F) + -0.00057 * Math.sin(Mp + 2 * F) +
			   0.00056 * E * Math.sin(2 * Mp + M) + -0.00042 * Math.sin(3 * Mp) + 0.00042 * E * Math.sin(M + 2 * F) +
			   0.00038 * E * Math.sin(M - 2 * F) + -0.00024 * E * Math.sin(2 * Mp - M);
		additional = 0.000325 * Math.sin(A1) - 0.000165 * Math.sin(Omega);
	} else {
		// First/Last Quarter — full 25-term series from Meeus Table 49.A.
		corrections =
			-0.62801 * Math.sin(Mp) + 0.17172 * E * Math.sin(M) + -0.01183 * E * Math.sin(Mp + M) +
			 0.00862 * Math.sin(2 * Mp) + 0.00804 * Math.sin(2 * F) + 0.00454 * E * Math.sin(Mp - M) +
			 0.00204 * EE * Math.sin(2 * M) + -0.00180 * Math.sin(Mp - 2 * F) + -0.00070 * Math.sin(Mp + 2 * F) +
			-0.00040 * Math.sin(3 * Mp) + -0.00034 * E * Math.sin(2 * Mp - M) + 0.00032 * E * Math.sin(M + 2 * F) +
			 0.00032 * E * Math.sin(M - 2 * F) + -0.00028 * EE * Math.sin(Mp + 2 * M) + 0.00027 * E * Math.sin(2 * Mp + M) +
			-0.00017 * Math.sin(Omega) + -0.00005 * Math.sin(Mp - M - 2 * F) + 0.00004 * Math.sin(2 * Mp + 2 * F) +
			-0.00004 * Math.sin(Mp + M + 2 * F) + 0.00004 * Math.sin(Mp - 2 * M) + 0.00003 * Math.sin(Mp + M - 2 * F) +
			 0.00003 * Math.sin(3 * M) + 0.00002 * Math.sin(2 * Mp - 2 * F) + 0.00002 * Math.sin(Mp - M + 2 * F) +
			-0.00002 * Math.sin(3 * Mp + M);
		let W = 0.00306 - 0.00038 * E * Math.cos(M) + 0.00026 * Math.cos(Mp) - 0.00002 * Math.cos(Mp - M) + 0.00002 * Math.cos(Mp + M) + 0.00002 * Math.cos(2 * F);
		if (phaseType === "last_quarter") W = -W;
		additional = W + 0.000325 * Math.sin(A1);
	}

	return jde + corrections + additional;
}

// Brackets a date between its two nearest primary-phase events and linearly
// interpolates. Samples a 3-lunation window so the true bracket is found by
// exact JDE comparison regardless of how accurate the rough lunation
// estimate turns out to be. Tracks only the running best prev/next
// candidates rather than collecting all 12 samples into an array to sort —
// this device's heap is tiny, and that array was unnecessary allocation
// for something computed on every launch.
function meeusPhaseFraction(date) {
	const jdNow = toJulianDate(date);
	const baseLunation = estimateBaseLunation(date);

	let prevJde = -Infinity, prevFraction = 0;
	let nextJde = Infinity, nextFraction = 0;

	for (let dk = -1; dk <= 1; dk++) {
		for (let i = 0; i < MEEUS_PHASE_TYPES.length; i++) {
			const phaseType = MEEUS_PHASE_TYPES[i];
			const jde = meeusPhaseJde(baseLunation + dk, phaseType);
			const fraction = MEEUS_PHASE_OFFSET[phaseType] + dk;
			if (jde <= jdNow) {
				if (jde > prevJde) { prevJde = jde; prevFraction = fraction; }
			} else {
				if (jde < nextJde) { nextJde = jde; nextFraction = fraction; }
			}
		}
	}
	if (prevJde === -Infinity || nextJde === Infinity) return 0; // shouldn't happen with a 3-lunation window

	const span = nextJde - prevJde;
	const progress = span > 0 ? (jdNow - prevJde) / span : 0;
	const fraction = prevFraction + progress * (nextFraction - prevFraction);
	return ((fraction % 1) + 1) % 1;
}

function buildPhaseInfo(fraction, anchor) {
	return {
		fraction,
		illumination: Math.round(((1 - Math.cos(2 * Math.PI * fraction)) / 2) * 100),
		name: phaseNameFor(fraction),
		date: anchor, // the evening the fraction was computed for; shown in the date row
	};
}

function refreshPhase() {
	const anchor = tonightAnchor();
	phaseInfo = buildPhaseInfo(meeusPhaseFraction(anchor), anchor);
	console.log(`Moon Phase: ${phaseInfo.name}, ${phaseInfo.illumination}% (fraction ${phaseInfo.fraction.toFixed(4)})`);
	draw();
}

// Compute once now (the app was just opened) and again on every select press.
refreshPhase();

watch.addEventListener("resize", draw);

// Kept in a module-level binding so the instance (and its native handler
// registration) isn't collected for the life of the app.
const selectButton = new Button({
	types: ["select"],
	onPush(down) {
		if (down) refreshPhase();
	},
});
void selectButton;
