# CalebsModClient

Desktop launcher (Wails + React) that auto-installs PrismLauncher, manages mods, and launches Minecraft.

## Features

- **One-Click PrismLauncher Install**: Downloads portable PrismLauncher from GitHub
- **Isolated Instance**: Creates separate "CalebsMod" instance with Forge 1.20.1
- **Auto-Connect**: Fetches server IP and configures auto-connect mod
- **Mod Sync**: Downloads modpack from server (planned)
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

1. Checks if PrismLauncher is installed
2. User clicks "Install Launcher" if needed (downloads portable version)
3. User clicks "Launch Minecraft"
4. Launcher creates "CalebsMod" instance if doesn't exist
5. Fetches server IP from API
6. Writes auto-connect config to instance `.minecraft/config/`
7. Launches PrismLauncher with `-l CalebsMod` to start the instance
8. Auto-connect mod connects to server

## PrismLauncher Location

- **Windows**: `%LOCALAPPDATA%\CalebsMod\PrismLauncher`
- **Mac**: `~/Library/Application Support/CalebsMod/PrismLauncher`
- **Linux**: `~/.local/share/CalebsMod/PrismLauncher`

## Instance Structure

```
PrismLauncher/instances/CalebsMod/
├── instance.cfg          # Instance config
├── mmc-pack.json         # Minecraft 1.20.1 + Forge 47.3.0
└── .minecraft/
    ├── mods/             # Your mods go here
    └── config/
        └── autoconnect.json  # Created by launcher
```
