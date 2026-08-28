#!/usr/bin/env bash
#
# Cut a release: bump the version, commit + tag, push, and publish to the
# Rebble appstore.
#
#   npm run release -- major     1.2.3 -> 2.0.0
#   npm run release -- minor     1.2.3 -> 1.3.0
#   npm run release -- fix       1.2.3 -> 1.2.4   (npm "patch")
#
# Env:
#   PUBLISH=1              make the release public (default: upload only)
#   RELEASE_NOTES="..."    appstore release notes (default: "Release vX.Y.Z")
#
# Order of operations: build -> npm version (commit + tag) -> publish ->
# push. Push happens last so a failed publish leaves only a local commit
# you can drop with `git reset --hard HEAD~1 && git tag -d vX.Y.Z`.

set -euo pipefail
cd "$(dirname "$0")/.."

BUMP="${1:-}"
case "$BUMP" in
  major|minor) ;;
  fix|patch)   BUMP=patch ;;
  *)
    echo "usage: npm run release -- <major|minor|fix>" >&2
    exit 1
    ;;
esac

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "release must be cut from 'main' (on '$BRANCH')" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "working tree is not clean — commit or stash first" >&2
  git status --short >&2
  exit 1
fi

echo "==> Building"
pebble build

echo "==> Bumping version ($BUMP)"
NEW_VERSION="$(npm version "$BUMP" -m 'Release %s' | tail -n1)"   # -> vX.Y.Z, commits + tags
echo "    $NEW_VERSION"

# From here on, a failure has left a local (unpushed) version commit + tag.
trap 'echo >&2; echo "release failed after the version bump — undo the local commit + tag with:" >&2; echo "  git reset --hard HEAD~1 && git tag -d $NEW_VERSION" >&2' ERR

echo "==> Publishing to the appstore"
# --non-interactive so the flags are used verbatim (otherwise pebble prompts
# for a screenshot source and reads stdin). --replace-screenshots makes the
# listing's screenshots exactly the three in store/ on every release; the
# description/category/icons are likewise pushed from the repo each time.
pebble publish \
  --non-interactive \
  --name "Moon Phase" \
  --version "${NEW_VERSION#v}" \
  --description "$(cat store/listing-description.txt)" \
  --category daily \
  --source "https://github.com/shrunyan/pebble-moon-phase" \
  --icon-small store/icon-small.png \
  --icon-large store/icon-large.png \
  --screenshots store/emery_screenshot_1.png store/emery_screenshot_2.png store/emery_screenshot_3.png \
  --replace-screenshots \
  --release-notes "${RELEASE_NOTES:-Release ${NEW_VERSION}}" \
  ${PUBLISH:+--is-published}

echo "==> Pushing $NEW_VERSION"
git push --follow-tags

echo "==> Released $NEW_VERSION"
