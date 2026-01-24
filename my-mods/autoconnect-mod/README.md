# AutoConnect Mod

Client-side Forge mod that automatically connects to the server on launch.

## Build

```bash
.\gradlew.bat build
```

Output: `build/libs/calebs-autoconnect-1.0.0.jar`

## How It Works

1. Reads `.minecraft/config/autoconnect.json` (created by launcher)
2. Waits for title screen
3. Automatically connects to configured server

## Config Format

```json
{
  "enabled": true,
  "serverAddress": "ip:port"
}
```

The launcher app creates and updates this file automatically.
