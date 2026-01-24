# Caleb's AutoConnect Mod

A client-side Forge mod that automatically connects to Caleb's Minecraft server on launch.

## Features

- Automatically connects to the configured server when Minecraft starts
- Reads server address from a config file that can be updated by the launcher app
- Can be enabled/disabled via config
- Client-side only (doesn't need to be installed on the server)

## Building

```bash
./gradlew build
```

The compiled JAR will be in `build/libs/calebs-autoconnect-1.0.0.jar`

## Configuration

The mod reads from `.minecraft/config/autoconnect.json`:

```json
{
  "enabled": true,
  "serverAddress": "your-ip:25565"
}
```

This file is automatically created and updated by the CalebsMod launcher application.

## Installation

1. Install Forge 1.20.1
2. Place the mod JAR in your `.minecraft/mods/` folder
3. The launcher app will handle the rest!
