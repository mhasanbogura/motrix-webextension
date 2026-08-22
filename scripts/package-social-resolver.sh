#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages"
STAGING_DIR="$ROOT_DIR/.social-resolver-staging"
PACKAGE_ROOT="$STAGING_DIR/Motrix Social Resolver"

rm -rf "$STAGING_DIR"
mkdir -p "$PACKAGE_ROOT"
cp "$ROOT_DIR/social-resolver/social_resolver.py" "$PACKAGE_ROOT/"
cp "$ROOT_DIR/social-resolver/install.sh" "$PACKAGE_ROOT/"
cp "$ROOT_DIR/social-resolver/install-windows.ps1" "$PACKAGE_ROOT/"
cp "$ROOT_DIR/social-resolver/README.md" "$PACKAGE_ROOT/"
chmod +x "$PACKAGE_ROOT/install.sh" "$PACKAGE_ROOT/social_resolver.py"
rm -f "$PACKAGE_DIR/Motrix Social Resolver.zip"
(cd "$STAGING_DIR" && zip -qr "$PACKAGE_DIR/Motrix Social Resolver.zip" "Motrix Social Resolver")
printf '%s\n' 'Created package:' 'Motrix Social Resolver.zip'
unzip -Z1 "$PACKAGE_DIR/Motrix Social Resolver.zip"
