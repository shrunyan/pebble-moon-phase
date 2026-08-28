# Moon Phase

A Pebble Alloy watchapp for Pebble Time 2 (Emery) that shows tonight's moon
phase: the current phase name, illumination percentage, and a moon disc
rendered procedurally (no image assets) whose lit/dark terminator is drawn
to match the real phase.

The phase is computed entirely on the watch (Jean Meeus, *Astronomical
Algorithms* 2nd ed., ch. 49 / Table 49.A). The New/Full events use the
leading periodic terms; the Quarters use the full 25-term correction
series plus the *W* term — phase timing is typically accurate to within a
couple of minutes, far tighter than this app's display resolution. The
value is anchored to 9 PM local time so it reflects that evening's phase
specifically. It is recomputed every time you open the app, and you can
press the middle (select) button to recompute on demand.

The correction series are written as flat arithmetic rather than
coefficient arrays on purpose: this device gives the watch-side JavaScript
only ~120 KB of heap, and the array form overflowed it at module load.

There is no network call. An earlier version also confirmed/upgraded the
local value against the USNO Moon Phase API in the background, but that
fetch reliably crashed the watch with an out-of-memory abort — reproduced
on both the QEMU emulator and physical hardware, across several
memory-optimization attempts, and confirmed by removing the fetch entirely
and watching the crash disappear (clean heap usage log, proper
teardown, `Still allocated 0B`, on a real Pebble Time 2). See git history
for that investigation if you want to revisit it; this device's JS heap is
only ~120KB, and fetching HTTPS from it was not reliable enough to ship.

## Building & running

Common workflows are wired up as `package.json` scripts:

```sh
npm run build            # pebble build
npm run rebuild          # pebble clean && pebble build
npm start                # build, then install on the emery emulator
npm run install:emulator # install on the emery emulator
npm run logs             # tail emulator logs
npm run screenshot       # capture the emulator screen -> screenshots/emery.png
npm run kill             # stop running emulators

PEBBLE_PHONE=<ip> npm run install:phone   # install to a paired phone

npm run art              # regenerate store/marketing/ composites

npm run release -- fix    # bump patch, commit + tag, publish, push
npm run release -- minor  # bump minor  ·  also: major
```

`npm run release` builds, runs `npm version` (which commits + tags), then
`pebble publish`, then `git push --follow-tags`. It uploads the release
without making it public — add `PUBLISH=1` to publish live, and
`RELEASE_NOTES="…"` to set the notes. Must be run from a clean `main`.
See `store/README.md` for the appstore details.

Or run the raw commands directly — `pebble build`, `pebble install
--emulator emery`, `pebble install --phone <ip>`.

## Target platforms

**emery** (Pebble Time 2) only. The layout assumes a rectangular display,
so the round platform (gabbro) is not built or supported.

## Project layout

```
src/c/mdbl.c                   C glue around the Moddable runtime
src/embeddedjs/main.js         JavaScript that runs on the watch
src/embeddedjs/manifest.json   Moddable manifest
src/pkjs/index.js              PebbleKit JS (phone-side) code
package.json                   Project metadata (UUID, platforms, resources) + npm scripts
scripts/release.sh             Version bump + publish + push (npm run release)
store/                         Appstore icons, screenshots, marketing art, submission notes
wscript                        Build rules — usually no need to edit
```

## Documentation

Full SDK docs and tutorials: <https://developer.repebble.com>
