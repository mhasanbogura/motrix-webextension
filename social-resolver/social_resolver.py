#!/usr/bin/env python3
"""On-demand native resolver for public or user-authorized social media.

The browser starts this process for one request through native messaging. It
uses yt-dlp for format discovery and does not bypass DRM or access controls.
"""

from __future__ import annotations

import json
import os
import re
import struct
import subprocess
import sys
from pathlib import Path
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

    cookie = payload.get("cookie")
    user_agent = payload.get("userAgent")
    cookie_file = find_cookie_file()
    hostname = (urlparse(page_url).hostname or "").lower().removeprefix("www.")
    clients: tuple[str | None, ...] = (
        ("android_vr", "mweb", "web_safari", "web")
        if hostname in {"youtube.com", "youtu.be"} or hostname.endswith(".youtube.com")
        else (None,)
    )
    errors: list[str] = []

    for client in clients:
        command = [
            sys.executable,
            "-m",
            "yt_dlp",
            "--dump-single-json",
            "--no-warnings",
            "--skip-download",
            "--no-playlist",
            "--js-runtimes",
            "deno",
            "--format",
            "best[protocol^=http][ext=mp4]/best[protocol^=http]",
            page_url,
        ]
        if client:
            command[9:9] = ["--extractor-args", f"youtube:player_client={client}"]
        if cookie_file:
            command[4:4] = ["--cookies", str(cookie_file)]
        elif isinstance(cookie, str) and cookie:
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
            errors.append("The social-media resolver timed out.")
            continue

        if completed.returncode != 0:
            errors.append(clean_error(completed.stderr or completed.stdout))
            continue
        try:
            info = json.loads(completed.stdout)
        except json.JSONDecodeError:
            errors.append("yt-dlp returned an invalid media description.")
            continue

        direct_url = info.get("url")
        if not isinstance(direct_url, str) or urlparse(direct_url).scheme not in {"http", "https"}:
            requested_formats = info.get("requested_formats")
            if isinstance(requested_formats, list) and requested_formats:
                first_format = requested_formats[0]
                direct_url = first_format.get("url") if isinstance(first_format, dict) else None
        if not isinstance(direct_url, str) or urlparse(direct_url).scheme not in {"http", "https"}:
            errors.append("No direct public media format was exposed for this page.")
            continue

        ext = str(info.get("ext") or "mp4")
        title = str(info.get("title") or "social-media")
        filename = build_social_filename(str(info.get("_filename") or ""), title, ext)
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

    return {"ok": False, "error": clean_error(errors[0] if errors else "")}


def find_cookie_file() -> Path | None:
    path = Path(__file__).with_name("cookies.txt")
    if not path.is_file():
        return None
    try:
        has_cookie = any(
            line.strip() and not line.lstrip().startswith("#") and len(line.rstrip("\n").split("\t")) >= 7
            for line in path.read_text(encoding="utf-8", errors="ignore").splitlines()
        )
    except OSError:
        return None
    return path if has_cookie else None


def build_social_filename(filename: str, title: str, ext: str) -> str:
    preferred = title if title and not is_generic_filename(title) else filename or title or "social-media"
    normalized_ext = (ext or extract_extension(filename) or "mp4").lstrip(".").lower()
    base = re.sub(r"\.[a-z0-9]{2,5}$", "", preferred, flags=re.IGNORECASE)
    base = re.sub(r"\s*\[[^\]]{4,}\]\s*$", "", base)
    base = re.sub(r"[\\/:*?\"<>|]", "_", base)
    base = re.sub(r"[\x00-\x1f]", "", base)
    base = re.sub(r"\s+", " ", base).strip()
    return f"{base or 'social-media'}.{normalized_ext}"


def is_generic_filename(value: str) -> bool:
    return bool(re.fullmatch(r"(?:download|file|media|video|audio|videoplayback|manifest|master|playlist)(?:\.[a-z0-9]{2,5})?", value.strip(), re.IGNORECASE))


def extract_extension(value: str) -> str | None:
    match = re.search(r"\.([a-z0-9]{2,5})$", value, re.IGNORECASE)
    return match.group(1) if match else None


def rename_local_file(payload: dict[str, object]) -> dict[str, object]:
    path = payload.get("path")
    filename = payload.get("filename")
    if not isinstance(path, str) or not isinstance(filename, str):
        return {"ok": False, "error": "A local file path and filename are required."}
    if not filename.strip() or any(separator in filename for separator in ("/", "\\\\")):
        return {"ok": False, "error": "The new filename must be a non-empty file name without folders."}
    clean_filename = re.sub(r"[\\/:*?\"<>|]", "_", filename)
    clean_filename = re.sub(r"\s+", " ", clean_filename).strip()
    if not clean_filename or clean_filename in {".", ".."}:
        return {"ok": False, "error": "The new filename is not valid."}
    source = os.path.abspath(path)
    if not os.path.isfile(source):
        return {"ok": False, "error": "The downloaded file is not available for renaming."}
    target = os.path.join(os.path.dirname(source), clean_filename)
    if source != target and os.path.exists(target):
        return {"ok": False, "error": "A file with that name already exists."}
    if source != target:
        os.replace(source, target)
        sidecar = f"{source}.aria2"
        if os.path.exists(sidecar):
            os.replace(sidecar, f"{target}.aria2")
    return {"ok": True, "filename": clean_filename}


def clean_error(value: str) -> str:
    lines = [line.strip() for line in value.splitlines() if line.strip()]
    detail = lines[-1] if lines else "The social-media resolver could not resolve this page."
    lowered = detail.lower()
    if "no supported javascript runtime" in lowered or "javascript runtime" in lowered:
        return "YouTube now requires the resolver's JavaScript runtime. Run the latest one-time Motrix Social Resolver installer."
    if "sign in to confirm" in lowered or "not a bot" in lowered:
        return "YouTube blocked this request. Keep YouTube signed in in the browser, then run the latest resolver installer and try again."
    if "requested format is not available" in lowered or "no direct" in lowered:
        return "YouTube did not expose a direct downloadable HTTP video format for this request. The video may require a PO Token or account access."
    return detail[:500]


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
        if payload is None:
            return
        if payload.get("action") == "rename":
            write_message(rename_local_file(payload))
        else:
            write_message(resolve_page(payload))
    except Exception as error:  # Keep stdout protocol valid with a structured error.
        write_message({"ok": False, "error": str(error)[:500]})


if __name__ == "__main__":
    run_native()
