# Motrix social-media resolver

This helper provides the Snaptube-like download path used by the Motrix WebExtension for public or user-authorized Facebook, YouTube, and Dailymotion page URLs. It uses `yt-dlp` to discover an available direct media format and returns the URL, filename, and required request headers to the extension. Motrix then opens the normal IDM-style picker and sends the task to aria2.

## One-time installation

On Linux or macOS, open a terminal in this folder and run:

```bash
./install.sh
```

On Windows, right-click `install-windows.ps1`, choose **Run with PowerShell**, or run it from PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-windows.ps1
```

The installer creates a private Python environment, installs `yt-dlp` with its default EJS components and Deno JavaScript runtime, registers the native-messaging host for Chrome/Chromium and Firefox, and installs an on-demand launcher. **If the resolver was installed before this release, run the installer again once** so the new YouTube dependencies are installed. Restart the browser once after installation. You do not need to start a server or run a command for each download.

The extension’s stable native-helper registration uses host name `com.motrix.social_resolver`. No resolver URL needs to be entered in settings.

The helper accepts only HTTP(S) page URLs on Facebook, fb.watch, YouTube, youtu.be, Dailymotion, or dai.ly. Use it only for media you are authorized to download and in accordance with the platform’s terms.

DRM-protected, encrypted, login-only, private, or segment-only streams may not produce a direct downloadable format. The helper does not bypass DRM, authentication, paywalls, or other access controls. YouTube may also require the browser to be signed in or may require a PO Token for particular videos; in those cases the extension reports an actionable error instead of silently sending an unusable task to Motrix.
