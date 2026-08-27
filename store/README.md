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
- **Description:** See tonight's moon phase at a glance — an exact,
  procedurally drawn moon disc (no image assets) with illumination
  percentage and phase name, sourced from the US Naval Observatory. Falls
  back to a local estimate if the API can't be reached.
- **Release notes (first release):** Initial release.

## Example command

```sh
pebble login
pebble publish \
  --non-interactive \
  --description "See tonight's moon phase at a glance — an exact, procedurally drawn moon disc with illumination percentage and phase name, sourced from the US Naval Observatory." \
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

## Known issue: HTTPS fetch crashes the QEMU emulator

During testing, fetching `https://aa.usno.navy.mil` reliably crashed the
`pebble install --emulator emery` QEMU emulator with `Alloy: Fatal Error /
memory full` — reproduced from a single clean, freshly wiped, single
emulator instance, with no other explanation surviving elimination (the
live API itself returns a small, valid ~1.1KB JSON response, confirmed via
a direct `curl`). Fetching a plain **HTTP** endpoint with the same code path
did not crash. This points to a bug in `pypkjs`, the Python-based
HTTPS/TLS handling used only by the desktop emulator — not something fixable
from the app's JS. On a real watch, PebbleKit JS runs inside the actual
Pebble phone app using the phone OS's native networking, a completely
different implementation, so this may well not reproduce there — but that
is **not yet confirmed on physical hardware**. Test on a real Pebble Time 2
+ phone before wide release if at all possible. The app's local fallback
estimate (`localPhaseFraction`) does not depend on any network call and is
unaffected either way.

If you do use `pebble publish`'s own `--all-platforms` auto-screenshot
capture instead of the pre-made screenshot above, be aware it launches the
app in the same emulator to take the shot — which could hit this same
crash. The pre-made screenshot avoids that.
