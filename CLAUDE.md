# CalebsMod — agent notes

Full architecture lives in `.cursor/rules/project-overview.mdc`. **Read it before
non-trivial work** — it covers the three components, the modpack sync/revision
model, and the release flows. This file is only the things that are easy to get
wrong and expensive to discover.

Style preferences are in `.cursor/rules/communication-style.mdc`: be brief, skip
summary documents, don't write READMEs unless asked.

## Prod is this machine

There is no remote host. `mc.calebwash.com` is this Windows PC. Caddy
(`C:\caddy`, always running) terminates HTTPS and reverse-proxies to
`127.0.0.1:31265`, where a detached `node dist/main` is listening.

Deploying = rebuild locally and restart that process. Nothing is pushed anywhere.
Full runbook in the overview under **"Deploying it"**; the short version:

```powershell
git pull
cd G:\Projects\CalebsMod\calebs-mod-server
npm run build                                    # before stopping anything
Get-NetTCPConnection -State Listen -LocalPort 31265 |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Process powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass',
    '-File','G:\Projects\CalebsMod\calebs-mod-server\start-background.ps1') -WindowStyle Hidden
```

- **Never blanket-kill `node.exe`.** Unrelated node processes run here (Vite on
  5199, OpenAI Codex runtimes). Select by listening port or `CommandLine`.
- Takes ~15s to start listening. Verify through `https://mc.calebwash.com`, not
  just localhost — that exercises Caddy too.
- The API reads version files from disk *per request*, and the macOS release
  workflow bumps `CalebsModClientVersion-mac.txt` **on GitHub**. Pull, or the
  API advertises a release whose S3 object does not exist. Version-file changes
  need no restart; code changes do.

## Two platforms, two release paths

Windows and macOS have separate version files and release independently — they
are meant to drift.

- Windows: `.\upload-new-client-to-s3.ps1` on this PC.
- macOS: GitHub Actions → "Release macOS client" (manual). Cannot be built here;
  Wails needs a Mac and the macOS SDK.
- `/api/server/latest-client-release` with no `platform` param means Windows.
  Keep it that way — bootstrappers predating macOS support depend on it.

## macOS rules that have already caused failures

- Pack and extract bundles with `ditto`. `archive/zip` and `Compress-Archive`
  drop symlinks and the exec bit, yielding a bundle that extracts cleanly and
  then refuses to launch.
- `lipo` invalidates Go's ad-hoc signature and Apple Silicon rejects unsigned
  arm64 code. Every universal build needs `codesign --force --sign -` after.
- `.sh` files authored on Windows commit as `100644`; CI calling `./script.sh`
  gets "Permission denied". Fix with `git update-index --chmod=+x`.
- All OS differences belong in `platform.go` (both modules have one). Don't
  branch on `runtime.GOOS` elsewhere to pick a path or filename.
- Check ports cheaply from Windows: `GOOS=darwin go build ./...`.

## Unverified

No part of the macOS client has run on real Apple hardware yet. In particular,
it is **not confirmed** that Prism's macOS build honours `-d <datadir>`; if it
ignores that flag, instances land outside the CalebsMod folder and the install
layout needs rework.
