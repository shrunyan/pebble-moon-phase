# App Store assets

Prepared for `pebble publish` (requires `pebble login` first, with your own
rePebble developer account — not something this repo can do for you).

- `icon-small.png` — 80×80, used as `--icon-small`
- `icon-large.png` — 144×144, used as `--icon-large`
- `emery_screenshot_1.png` — sample screenshot, used as `--screenshots`
  (filename must start with the platform name; `pebble publish` can also
  auto-capture screenshots from the emulator instead if you'd rather skip
  this file — see the emulator note below)

## Suggested listing details

- **Name:** Moon Phase
- **Category:** `daily` (glanceable daily-info app, alongside things like
  weather — `tools`, `notifications`, `remotes`, `health`, and `games` are
  the other valid keys)
- **Description:** See tonight's moon phase at a glance — a procedurally
  drawn moon disc (no image assets) with illumination percentage and phase
  name, computed on-watch (Jean Meeus's algorithm) with no network required.
- **Release notes (first release):** Initial release.

## Example command

```sh
pebble login
pebble publish \
  --non-interactive \
  --description "See tonight's moon phase at a glance — a procedurally drawn moon disc with illumination percentage and phase name, computed on-watch with no network required." \
  --category daily \
  --icon-small store/icon-small.png \
  --icon-large store/icon-large.png \
  --screenshots store/emery_screenshot_1.png \
  --release-notes "Initial release." \
  --is-published
```

Drop `--is-published` to upload a release without making it publicly
visible yet, and drop `--non-interactive` to be walked through prompts
instead (recommended for the very first publish, since the CLI will also
offer to create your developer account and confirm the category list).

## Resolved: HTTPS fetch was crashing the app (network removed)

An earlier version fetched the USNO Moon Phase API in the background to
confirm/upgrade the on-watch calculation. That fetch reliably crashed the
app with `Alloy: Fatal Error / memory full` — reproduced on a freshly
wiped QEMU emulator instance (the live API itself returns a small, valid
~1.1KB JSON response, confirmed via a direct `curl`, ruling out response
size) and, decisively, on a real Pebble Time 2: removing the fetch
entirely made the crash disappear, confirmed via `pebble logs --phone`
showing a clean launch and proper teardown (`Still allocated 0B`) where
every previous attempt had crashed immediately. This device's JS heap is
only ~120KB, and fetching HTTPS from it was not reliable enough to ship,
so the app is fully local now (no network, no `@moddable/pebbleproxy`
dependency). No screenshot-capture caveat applies anymore since there's no
network path left for `pebble publish`'s auto-capture to trip over.
