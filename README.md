# CalebsMod

Private Minecraft modpack server and launcher for friends with automatic server connection.

## Features

- **Auto-Install PrismLauncher**: One-click portable launcher installation
- **Isolated Instance**: Separate "CalebsMod" instance, won't affect other Minecraft installs
- **Auto-Connect**: Friends click "Launch Minecraft" and automatically connect
- **Dynamic IP**: Works without static IP (fetches current public IP)
- **Mod Sync**: Automatic mod downloading and updating
- **Server Management**: Start/stop/restart via desktop app

## Quick Start

```powershell
.\start-dev.ps1
```

First run creates `.env` - edit `calebs-mod-server/.env` before running again.

## Prerequisites

- Node.js 18+, Go 1.21+, Java 17+, Docker Desktop
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

## Project Structure

```
CalebsMod/
├── my-mods/                  # Custom Forge mods
│   ├── autoconnect-mod/      # Auto-connect mod
│   └── build-all-mods.ps1    # Build all mods
├── calebs-mod-server/        # NestJS API server
├── CalebsModClient/          # Wails desktop app
└── README.md
```

## Building for Distribution

### 1. Build Custom Mods

```powershell
cd my-mods
.\build-all-mods.ps1
```

### 2. Build Launcher

```powershell
cd CalebsModClient
wails build
```

### 3. Port Forwarding

Forward ports **25565** (Minecraft) and **3000** (API) on your router.

### 4. Distribute

Give friends the CalebsModClient installer. They click "Install Launcher" to get PrismLauncher.

## How Auto-Connect Works

1. Friend opens CalebsMod app, clicks "Install Launcher" (first time only)
2. App downloads PrismLauncher portable to `%LOCALAPPDATA%\CalebsMod\PrismLauncher`
3. Friend clicks "Launch Minecraft"
4. App fetches your current public IP from server
5. App creates isolated "CalebsMod" instance with Forge 1.20.1
6. App writes auto-connect config to instance
7. App launches PrismLauncher with CalebsMod instance
8. Auto-connect mod loads and connects to your server

## Why PrismLauncher?

- **Instance Isolation**: Won't mess with friends' other Minecraft installs
- **Portable**: No admin rights, installs to user folder
- **Automatic Forge**: Handles Forge installation for the instance
- **Direct Launch**: Launches straight to CalebsMod instance

## Development

See README files in each directory for details:
- `my-mods/README.md` - Building custom mods
- `calebs-mod-server/readme.md` - API documentation
- `CalebsModClient/readme.md` - Desktop app details

## Troubleshooting

**Friends can't connect:**
- Verify port forwarding (25565 and 3000)
- Check public IP: `curl https://api.ipify.org`
- Ensure server is running

**Auto-connect not working:**
- Check PrismLauncher instance has the auto-connect mod
- Verify config exists in instance `.minecraft/config/`
- Check logs in PrismLauncher

**Launcher install fails:**
- Ensure internet connection
- Check %LOCALAPPDATA% is writable
- Try downloading PrismLauncher manually from https://prismlauncher.org
