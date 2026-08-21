#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages"
STAGING_DIR="$ROOT_DIR/.release-staging"
ROOT_NAME="Motrix WebExtension"
PACKAGE_ROOT="$STAGING_DIR/$ROOT_NAME"

rm -rf "$STAGING_DIR"
mkdir -p "$PACKAGE_ROOT/Chrome" "$PACKAGE_ROOT/Firefox" "$PACKAGE_DIR"

if [[ ! -f "$ROOT_DIR/.output/chrome-mv3/manifest.json" ]]; then
  echo "Missing Chrome build. Run: pnpm build" >&2
  exit 1
fi
if [[ ! -f "$ROOT_DIR/.output/firefox-mv2/manifest.json" ]]; then
  echo "Missing Firefox build. Run: pnpm exec wxt build -b firefox" >&2
  exit 1
fi

cp -a "$ROOT_DIR/.output/chrome-mv3/." "$PACKAGE_ROOT/Chrome/"
cp -a "$ROOT_DIR/.output/firefox-mv2/." "$PACKAGE_ROOT/Firefox/"

rm -f "$PACKAGE_DIR/Motrix WebExtension.zip"
(cd "$STAGING_DIR" && zip -qr "$PACKAGE_DIR/Motrix WebExtension.zip" "$ROOT_NAME")

printf 'Created package:\n'
printf '%s\n' 'Motrix WebExtension.zip'
printf '\nPackage structure:\n'
unzip -Z1 "$PACKAGE_DIR/Motrix WebExtension.zip" | sed -n '1,40p'
