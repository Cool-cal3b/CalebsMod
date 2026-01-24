# CalebsMod

Private Minecraft modpack server and launcher for friends with automatic server connection.

## Features

- **Auto-Install PrismLauncher**: One-click portable launcher installation
- **Isolated Instance**: Separate "CalebsMod" instance, won't affect other Minecraft installs
- **Auto-Join Server**: Launches directly into your server using PrismLauncher's `--server` flag
- **Dynamic IP**: Works without static IP (fetches current public IP)
- **Mod Sync**: Automatic mod downloading and updating
- **Server Management**: Start/stop/restart via desktop app

## Quick Start

```powershell
.\start-dev.ps1
```

First run creates `.env` - edit `calebs-mod-server/.env` before running again.

## Prerequisites

- Node.js 18+, Go 1.21+, Docker Desktop
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- Java (for building custom mods, if needed)

## Project Structure

```
CalebsMod/
├── my-mods/                  # Custom Forge mods (optional)
├── calebs-mod-server/        # NestJS API server
├── CalebsModClient/          # Wails desktop app
└── README.md
```

## Building for Distribution

### 1. Build Launcher

```powershell
cd CalebsModClient
wails build
```

### 2. Port Forwarding

Forward ports **25565** (Minecraft) and **3000** (API) on your router.

### 3. Distribute

Give friends the CalebsModClient installer. They:
1. Install the launcher
2. Click "Install Launcher" to get PrismLauncher
3. Log into Microsoft account (one-time)
4. Click "Launch Minecraft" to play

## How It Works

1. Friend opens CalebsMod app, clicks "Install Launcher"
2. App downloads PrismLauncher portable to `%LOCALAPPDATA%\CalebsMod\PrismLauncher`
3. Friend logs into Microsoft account in PrismLauncher (one-time)
4. Friend clicks "Launch Minecraft"
5. App creates "CalebsMod" instance (if doesn't exist)
6. App syncs mods to instance
7. App fetches your current public IP
8. App launches: `prismlauncher.exe -l CalebsMod -s <your_ip:25565>`
9. Minecraft opens and joins your server automatically

## Why PrismLauncher?

- **Instance Isolation**: Separate from other Minecraft installs
- **Portable**: No admin rights needed
- **Direct Server Join**: Built-in `--server` flag
- **Forge Management**: Handles Forge automatically

## Troubleshooting

**Friends can't connect:**
- Verify port forwarding (25565 and 3000)
- Check public IP: `curl https://api.ipify.org`
- Ensure server is running

**Launcher incompatible:**
- Click "Reinstall Launcher" to download correct version for your system

**Need to log in again:**
- They need to log into Microsoft account in PrismLauncher once
- After that, launches work automatically
