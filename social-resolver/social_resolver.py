#!/usr/bin/env python3
"""Local public-media resolver for Motrix WebExtension.

This service delegates format discovery to yt-dlp for public or user-authorized
media. It intentionally does not bypass DRM or platform access controls.
"""

from __future__ import annotations

import json
import os
import socketserver
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = os.environ.get("MOTRIX_RESOLVER_HOST", "127.0.0.1")
PORT = int(os.environ.get("MOTRIX_RESOLVER_PORT", "8199"))
MAX_BODY_BYTES = 64 * 1024
ALLOWED_HOSTS = {
    "facebook.com",
    "fb.watch",
    "dailymotion.com",
    "dai.ly",
    "youtube.com",
    "youtu.be",
}


def is_allowed_page_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    hostname = (parsed.hostname or "").lower().removeprefix("www.")
    return any(hostname == host or hostname.endswith("." + host) for host in ALLOWED_HOSTS)


def resolve_page(payload: dict[str, object]) -> dict[str, object]:
    page_url = payload.get("url")
    if not isinstance(page_url, str) or not is_allowed_page_url(page_url):
        return {"ok": False, "error": "Only supported Facebook, YouTube, and Dailymotion page URLs are allowed."}

    command = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--dump-single-json",
        "--no-warnings",
        "--skip-download",
        "--no-playlist",
        "--format",
        "best[ext=mp4]/best",
    ]
    cookie = payload.get("cookie")
    user_agent = payload.get("userAgent")
    if isinstance(cookie, str) and cookie:
        command.extend(["--add-header", f"Cookie: {cookie}"])
    if isinstance(user_agent, str) and user_agent:
        command.extend(["--add-header", f"User-Agent: {user_agent}"])
    command.append(page_url)

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )
    except FileNotFoundError:
        return {"ok": False, "error": "yt-dlp is not installed. Run install.sh in the social-resolver folder."}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "The social-media resolver timed out."}

    if completed.returncode != 0:
        return {"ok": False, "error": clean_error(completed.stderr or completed.stdout)}
    try:
        info = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "error": "yt-dlp returned an invalid media description."}

    direct_url = info.get("url")
    if not isinstance(direct_url, str) or urlparse(direct_url).scheme not in {"http", "https"}:
        requested_formats = info.get("requested_formats")
        if isinstance(requested_formats, list) and requested_formats:
            first_format = requested_formats[0]
            direct_url = first_format.get("url") if isinstance(first_format, dict) else None
    if not isinstance(direct_url, str) or urlparse(direct_url).scheme not in {"http", "https"}:
        return {"ok": False, "error": "No direct public media format was exposed for this page."}

    ext = str(info.get("ext") or "mp4")
    title = str(info.get("title") or "social-media")
    filename = str(info.get("_filename") or f"{title}.{ext}")
    headers = info.get("http_headers")
    safe_headers = {}
    if isinstance(headers, dict):
        for name in ("Cookie", "Referer", "User-Agent"):
            value = headers.get(name)
            if isinstance(value, str) and value:
                safe_headers[name] = value

    return {
        "ok": True,
        "title": title,
        "url": direct_url,
        "filename": filename,
        "ext": ext,
        "mime": info.get("mime_type") if isinstance(info.get("mime_type"), str) else None,
        "headers": safe_headers,
    }


def clean_error(value: str) -> str:
    lines = [line.strip() for line in value.splitlines() if line.strip()]
    return lines[-1][:500] if lines else "The social-media resolver could not resolve this page."


class ResolverHandler(BaseHTTPRequestHandler):
    server_version = "MotrixSocialResolver/1.0"

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/v1/health":
            self.send_json(200, {"ok": True, "service": "motrix-social-resolver"})
            return
        self.send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/v1/resolve":
            self.send_json(404, {"ok": False, "error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ValueError("Invalid request size")
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError("Request must be a JSON object")
            self.send_json(200, resolve_page(body))
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"ok": False, "error": str(error)})

    def send_json(self, status: int, value: dict[str, object]) -> None:
        data = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def log_message(self, format: str, *args: object) -> None:
        print(f"[resolver] {format % args}", file=sys.stderr)


class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True


def main() -> None:
    print(f"Motrix social resolver listening on http://{HOST}:{PORT}")
    print("Supported input: public or user-authorized Facebook, YouTube, and Dailymotion page URLs")
    with ThreadingHTTPServer((HOST, PORT), ResolverHandler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
