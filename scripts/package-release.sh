#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages"
STAGING_DIR="$ROOT_DIR/.release-staging"
OUTER="Motrix WebExtension"
INNER="$STAGING_DIR/$OUTER/$OUTER"

rm -rf "$STAGING_DIR"
mkdir -p "$INNER/Chrome" "$INNER/Firefox" "$PACKAGE_DIR"

if [[ ! -f "$ROOT_DIR/.output/chrome-mv3/manifest.json" ]]; then
  echo "Missing Chrome build. Run: pnpm build" >&2
  exit 1
fi
if [[ ! -f "$ROOT_DIR/.output/firefox-mv2/manifest.json" ]]; then
  echo "Missing Firefox build. Run: pnpm exec wxt build -b firefox" >&2
  exit 1
fi

cp -a "$ROOT_DIR/.output/chrome-mv3/." "$INNER/Chrome/"
cp -a "$ROOT_DIR/.output/firefox-mv2/." "$INNER/Firefox/"

rm -f "$PACKAGE_DIR/Motrix WebExtension.zip"
(cd "$STAGING_DIR" && zip -qr "$PACKAGE_DIR/Motrix WebExtension.zip" "$OUTER")

rm -f "$PACKAGE_DIR/Motrix WebExtension - Chrome.zip"
mkdir -p "$STAGING_DIR/chrome-only/$OUTER/$OUTER/Chrome"
cp -a "$ROOT_DIR/.output/chrome-mv3/." "$STAGING_DIR/chrome-only/$OUTER/$OUTER/Chrome/"
(cd "$STAGING_DIR/chrome-only" && zip -qr "$PACKAGE_DIR/Motrix WebExtension - Chrome.zip" "$OUTER")

rm -f "$PACKAGE_DIR/Motrix WebExtension - Firefox.zip"
mkdir -p "$STAGING_DIR/firefox-only/$OUTER/$OUTER/Firefox"
cp -a "$ROOT_DIR/.output/firefox-mv2/." "$STAGING_DIR/firefox-only/$OUTER/$OUTER/Firefox/"
(cd "$STAGING_DIR/firefox-only" && zip -qr "$PACKAGE_DIR/Motrix WebExtension - Firefox.zip" "$OUTER")

printf 'Created packages:\n'
find "$PACKAGE_DIR" -maxdepth 1 -type f -name 'Motrix WebExtension*.zip' -printf '%f\n' | sort
printf '\nCombined package structure:\n'
unzip -Z1 "$PACKAGE_DIR/Motrix WebExtension.zip" | sed -n '1,40p'
