# Motrix social-media resolver

This helper provides the local resolver used by the Motrix WebExtension for public or user-authorized Facebook, YouTube, and Dailymotion page URLs. It uses `yt-dlp` to discover an available direct media format and returns the URL, filename, and required request headers to the extension. The extension then opens the normal IDM-style picker and sends the selected URL to Motrix/aria2.

## Install and run

From this directory, run:

```bash
./install.sh
.venv/bin/python social_resolver.py
```

The service listens on `http://127.0.0.1:8199`. Keep the terminal or service running while downloading. In the extension Download capture settings, leave **Social-media resolver** set to `http://127.0.0.1:8199` unless you changed the port with `MOTRIX_RESOLVER_PORT`.

The service accepts only HTTP(S) page URLs on Facebook, fb.watch, YouTube, youtu.be, Dailymotion, or dai.ly. It does not accept arbitrary hosts. Use it only for media you are authorized to download and in accordance with the platform’s terms.

DRM-protected, encrypted, login-only, private, or segment-only streams may not produce a direct downloadable format. The helper does not bypass DRM, authentication, paywalls, or other access controls.
