# Moon Phase

A Pebble Alloy watchapp for Pebble Time 2 (Emery) that shows tonight's moon
phase: the current phase name, illumination percentage, and a moon disc
rendered procedurally (no image assets) whose lit/dark terminator is drawn
to match the real phase.

Phase data comes from the [USNO Moon Phase
API](https://aa.usno.navy.mil/data/api#phase): the app fetches the primary
phases (new/first quarter/full/last quarter) bracketing today and
interpolates between them. If the API can't be reached, it falls back to a
local mean-cycle estimate so the app still shows something useful offline.
Press the middle (select) button to refresh.

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
