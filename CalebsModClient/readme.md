# CalebsModClient

Desktop launcher (Wails + React) that auto-installs PrismLauncher, manages mods, and launches Minecraft.

## Features

- **One-Click PrismLauncher Install**: Downloads portable PrismLauncher from GitHub
- **Isolated Instance**: Creates "CalebsMod" instance with Forge 1.20.1
- **Auto-Join Server**: Uses PrismLauncher's `--server` flag to connect directly
- **Mod Sync**: Downloads and installs mods to instance (planned)
- **Admin Panel**: Server management for admins

## Development

```bash
wails dev
```

## Build

```bash
wails build
```

Output: `build/bin/CalebsModClient.exe`

## How It Works

1. User clicks "Install Launcher" (first time or to reinstall)
2. Downloads PrismLauncher portable to `%LOCALAPPDATA%\CalebsMod\PrismLauncher`
3. User logs into Microsoft account in PrismLauncher (one-time)
4. User clicks "Launch Minecraft"
5. App creates "CalebsMod" instance (Minecraft 1.20.1 + Forge 47.3.0)
6. App syncs mods to instance `.minecraft/mods/` folder
7. Fetches server IP from API
8. Launches: `prismlauncher.exe -d <path> -l CalebsMod -s <ip:port>`
9. Minecraft opens and joins server automatically

## Instance Location

`%LOCALAPPDATA%\CalebsMod\PrismLauncher\instances\CalebsMod\.minecraft\`

This is isolated from the user's regular Minecraft installation.
