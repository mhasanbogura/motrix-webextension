#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
INSTALL_DIR="${MOTRIX_RESOLVER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/motrix-social-resolver}"
HOST_NAME='com.motrix.social_resolver'
CHROME_EXTENSION_ID='ffamkaafaenbpmjeflbjkncogmkbcmnn'
FIREFOX_EXTENSION_ID='motrix-webextension@mhasanbogura'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$INSTALL_DIR"
cp "$SCRIPT_DIR/social_resolver.py" "$INSTALL_DIR/social_resolver.py"

"$PYTHON_BIN" -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/python" -m pip install --upgrade pip 'yt-dlp[default,deno]'

cat > "$INSTALL_DIR/run-native.sh" <<EOF
#!/usr/bin/env bash
exec "$INSTALL_DIR/.venv/bin/python" "$INSTALL_DIR/social_resolver.py"
EOF
chmod 755 "$INSTALL_DIR/run-native.sh"

write_manifest() {
  local path="$1"
  local browser="$2"
  mkdir -p "$(dirname "$path")"
  if [[ "$browser" == 'firefox' ]]; then
    cat > "$path" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Motrix public social-media resolver",
  "path": "$INSTALL_DIR/run-native.sh",
  "type": "stdio",
  "allowed_extensions": ["$FIREFOX_EXTENSION_ID"]
}
EOF
  else
    cat > "$path" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Motrix public social-media resolver",
  "path": "$INSTALL_DIR/run-native.sh",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$CHROME_EXTENSION_ID/"]
}
EOF
  fi
}

case "$(uname -s)" in
  Darwin)
    write_manifest "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/$HOST_NAME.json" chrome
    write_manifest "$HOME/Library/Application Support/Chromium/NativeMessagingHosts/$HOST_NAME.json" chrome
    write_manifest "$HOME/Library/Application Support/Firefox/NativeMessagingHosts/$HOST_NAME.json" firefox
    ;;
  Linux*)
    write_manifest "$HOME/.config/google-chrome/NativeMessagingHosts/$HOST_NAME.json" chrome
    write_manifest "$HOME/.config/chromium/NativeMessagingHosts/$HOST_NAME.json" chrome
    write_manifest "$HOME/.mozilla/native-messaging-hosts/$HOST_NAME.json" firefox
    ;;
  *)
    printf '%s\n' "Unsupported Unix platform: $(uname -s)" >&2
    exit 1
    ;;
esac

printf '%s\n' 'Motrix Social Resolver installed for on-demand native messaging with yt-dlp EJS and Deno support.'
printf '%s\n' "Installed helper: $INSTALL_DIR"
printf '%s\n' 'Restart the browser once after installation. No resolver command is needed for each download.'
