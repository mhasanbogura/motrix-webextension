#!/usr/bin/env python3
"""On-demand native resolver for public or user-authorized social media.

The browser starts this process for one request through native messaging. It
uses yt-dlp for format discovery and does not bypass DRM or access controls.
"""

from __future__ import annotations

import json
import os
import struct
import subprocess
import sys
from urllib.parse import urlparse

MAX_MESSAGE_BYTES = 64 * 1024 * 1024
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
        "best[protocol^=http][ext=mp4]/best[protocol^=http]/best",
        page_url,
    ]
    cookie = payload.get("cookie")
    user_agent = payload.get("userAgent")
    if isinstance(cookie, str) and cookie:
        command[4:4] = ["--add-header", f"Cookie: {cookie}"]
    if isinstance(user_agent, str) and user_agent:
        command[4:4] = ["--add-header", f"User-Agent: {user_agent}"]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )
    except FileNotFoundError:
        return {"ok": False, "error": "yt-dlp is not installed. Run install.sh once for this resolver."}
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
    safe_headers: dict[str, str] = {}
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


def read_message() -> dict[str, object] | None:
    header = sys.stdin.buffer.read(4)
    if not header:
        return None
    if len(header) != 4:
        raise ValueError("Incomplete native message header")
    length = struct.unpack("<I", header)[0]
    if length <= 0 or length > MAX_MESSAGE_BYTES:
        raise ValueError("Invalid native message size")
    body = sys.stdin.buffer.read(length)
    if len(body) != length:
        raise ValueError("Incomplete native message body")
    value = json.loads(body.decode("utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Native message must be a JSON object")
    return value


def write_message(value: dict[str, object]) -> None:
    body = json.dumps(value, separators=(",", ":")).encode("utf-8")
    if len(body) > MAX_MESSAGE_BYTES:
        raise ValueError("Native response is too large")
    sys.stdout.buffer.write(struct.pack("<I", len(body)))
    sys.stdout.buffer.write(body)
    sys.stdout.buffer.flush()


def run_native() -> None:
    try:
        payload = read_message()
        if payload is not None:
            write_message(resolve_page(payload))
    except Exception as error:  # Keep stdout protocol valid with a structured error.
        write_message({"ok": False, "error": str(error)[:500]})


if __name__ == "__main__":
    run_native()
