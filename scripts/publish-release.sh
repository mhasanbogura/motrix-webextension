#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO='mhasanbogura/motrix-webextension'
NOTES='/home/ubuntu/motrix-extension-strM-release-notes.md'

if gh release view vname --repo "$REPO" >/dev/null 2>&1; then
  gh release delete vname --repo "$REPO" --yes --cleanup-tag
fi

VERSION=$(awk -F'"' '{ for (i = 1; i <= NF; i++) if ($i == "version_name") print $(i + 2) }' .output/chrome-mv3/manifest.json)
TAG="v${VERSION}"

gh release create "$TAG" \
  'packages/Motrix WebExtension.zip' \
  'packages/Motrix WebExtension - Chrome.zip' \
  'packages/Motrix WebExtension - Firefox.zip' \
  --repo "$REPO" \
  --title "Motrix WebExtension ${VERSION}" \
  --notes-file "$NOTES"

echo "Published https://github.com/${REPO}/releases/tag/${TAG}"
