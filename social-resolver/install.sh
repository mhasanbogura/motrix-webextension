#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="${VENV_DIR:-.venv}"
"$PYTHON_BIN" -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip yt-dlp
printf '%s\n' 'yt-dlp installed. Start the resolver with:'
printf '%s\n' "  $VENV_DIR/bin/python social_resolver.py"
