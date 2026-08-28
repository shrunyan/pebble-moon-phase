# App Store assets & submission

Everything needed to publish **Moon Phase** to the Rebble appstore, following
<https://developer.rebble.io/guides/appstore-publishing/preparing-a-submission/>.
Publishing requires your own Rebble developer account (`pebble login`) — the
repo can't do that part.

## Readiness checklist

| Item | Status | Notes |
|---|---|---|
| Valid `.pbw` | ✅ | `pebble build` → `build/pebble-moon-phase.pbw` (emery only) |
| Unique UUID | ✅ | `a005a91f-e252-425e-a8d3-a1c032615991` (in `package.json`; never published before) |
| Version | ✅ | `1.0.0` — must strictly increase on every later release |
| Watchapp, not watchface | ✅ | `pebble.watchapp.watchface = false` |
| App launcher icon | ✅ | `resources/images/icon.png` — 25×25, **white on transparent** (verified in the emery launcher) |
| Store icon — small | ✅ | `icon-small.png`, 80×80 PNG (`pebble publish` prompts "iconSmall (80x80)") |
| Store icon — large | ✅ | `icon-large.png`, 144×144 PNG |
| Screenshots (≥1, ≤5, unframed) | ✅ | `emery_screenshot_{1,2,3}.png`, native 200×228, filename starts with the platform name |
| Marketing banner (720×320) | ✅ | `marketing/marketing-banner-720x320.png` — dev-portal upload only, not a CLI flag |
| Category | ✅ | `daily` |
| Description (≤1600 chars) | ✅ | `listing-description.txt` (~1100 chars) |
| Source URL | ✅ | `https://github.com/shrunyan/pebble-moon-phase` |
| Website URL | ⚠️ | optional Basic-Info field; point it at the repo or a personal page in the dev portal |
| Support email | ⚠️ | defaults to your developer-account email if you don't set one |
| Companion app | n/a | none — fully on-watch, no phone/network |
| Timeline | n/a | no pins |

## Files

| File | Size | Purpose |
|---|---|---|
| `icon-small.png` | 80×80 | `--icon-small` |
| `icon-large.png` | 144×144 | `--icon-large` |
| `emery_screenshot_1.png` | 200×228 | First Quarter — `--screenshots` |
| `emery_screenshot_2.png` | 200×228 | Waxing Crescent |
| `emery_screenshot_3.png` | 200×228 | Waxing Gibbous |
| `marketing/marketing-banner-720x320.png` | 720×320 | marketing banner (upload in the dev portal) |
| `marketing/hero_1600x1000.png` | 1600×1000 | oversized composite — README / social, not a store slot |
| `marketing/square_1200x1200.png` | 1200×1200 | square tile — social |
| `marketing/banner_1400x560.png` | 1400×560 | wide banner — README / social |
| `marketing/build_art.py` | — | regenerates the `marketing/` composites from the screenshots |

Store screenshots **must be unframed** and match the emery screen exactly
(200×228). The framed watch mock-ups belong only in the marketing banner,
per the guide. All three screenshots were captured from the emery emulator;
`pebble publish` can also auto-capture from a running emulator instead.

## Listing copy

- **Name:** Moon Phase
- **Category:** `daily`
- **Short description / tagline:** See tonight's moon phase at a glance —
  phase name, illumination, and a procedurally drawn disc, computed on your
  watch with no network.
- **Full description:** see `listing-description.txt`
- **Release notes (1.0.0):** Initial release.

## Publishing

Releasing is wired up as `npm run release` (`scripts/release.sh`):

```sh
pebble login                        # once, first time only

npm run release -- fix              # 1.0.0 -> 1.0.1
npm run release -- minor            # 1.0.0 -> 1.1.0
npm run release -- major            # 1.0.0 -> 2.0.0

PUBLISH=1 npm run release -- fix            # ...and make it public
RELEASE_NOTES="Fixed X" npm run release -- fix
```

From a clean `main`, it runs: `pebble build` → `npm version <bump>`
(updates `package.json` + `package-lock.json`, commits `Release vX.Y.Z`,
tags `vX.Y.Z`) → `pebble publish` → `git push --follow-tags`. Push is
last, so a failed publish leaves only a local commit — undo it with
`git reset --hard HEAD~1 && git tag -d vX.Y.Z`.

The publish step is:

```sh
pebble publish \
  --name "Moon Phase" \
  --version "<the new version>" \
  --description "$(cat store/listing-description.txt)" \
  --category daily \
  --source "https://github.com/shrunyan/pebble-moon-phase" \
  --icon-small store/icon-small.png \
  --icon-large store/icon-large.png \
  --screenshots store/emery_screenshot_1.png store/emery_screenshot_2.png store/emery_screenshot_3.png \
  --release-notes "${RELEASE_NOTES:-Release vX.Y.Z}" \
  ${PUBLISH:+--is-published}
```

Notes:

- Every published release must have a strictly greater version — the
  `npm version` bump guarantees this.
- Passing local `--screenshots` skips the emulator GIF capture that
  `pebble publish` does by default (`--gif-all-platforms` is on otherwise).
- For the **very first** publish, run `pebble publish` by hand without
  `--non-interactive` so the CLI can walk you through creating the
  developer account and confirm the live category list. After that,
  `npm run release` handles it.
- The **marketing banner is not a CLI flag** — upload
  `marketing/marketing-banner-720x320.png` from the dev portal listing page.

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
dependency).
