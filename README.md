# Moon Phase

A Pebble Alloy watchapp for Pebble Time 2 (Emery) that shows tonight's moon
phase: the current phase name, illumination percentage, and a moon disc
rendered procedurally (no image assets) whose lit/dark terminator is drawn
to match the real phase.

The phase is computed entirely on the watch (Jean Meeus, *Astronomical
Algorithms* ch. 49 — the same 4 primary phase-event formulas, including the
Quarters' 24-term correction series) — typically accurate to within a
couple of minutes on phase timing, which is far tighter than this app's
display resolution. It's anchored to 9 PM local time so it reflects that
evening's phase specifically, refreshes automatically every morning at 9
AM local, and you can press the middle (select) button to recompute on
demand.

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

```sh
pebble build                          # build for all targetPlatforms
pebble install --emulator emery       # install on the emery emulator
pebble install --phone <ip>           # install to a paired phone
```

## Target platforms

Alloy targets the modern Pebble hardware: **emery** (Pebble Time 2) and
**gabbro** (Pebble Round 2). Other platforms are currently not supported.

## Project layout

```
src/c/mdbl.c                   C glue around the Moddable runtime
src/embeddedjs/main.js         JavaScript that runs on the watch
src/embeddedjs/manifest.json   Moddable manifest
src/pkjs/index.js              PebbleKit JS (phone-side) code
package.json                   Project metadata (UUID, platforms, resources)
wscript                        Build rules — usually no need to edit
```

## Documentation

Full SDK docs and tutorials: <https://developer.repebble.com>
