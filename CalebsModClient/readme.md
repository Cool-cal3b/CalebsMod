# CalebsModClient

Desktop launcher built with **Wails + React** that keeps a user's Minecraft client in sync with the current server modpack, then launches Minecraft.

## Goals
- Friends do **not** manually install or update mods
- Client automatically:
  - checks modpack version
  - downloads missing or updated mods
  - removes mods no longer in the pack
  - syncs config files
- Launches Minecraft using the correct loader and version
- Optionally pre-seeds the server list with `mc.calebwash.com`

## High-level flow
1. Launcher starts
2. Fetches manifest from the backend (CalebsModServer)
3. Compares manifest to local `.minecraft` state
4. Applies changes:
   - `mods/` folder
   - `config/` folder
5. Launches Minecraft

## Requirements
- Go (for Wails)
- Node.js (for React tooling)
- Minecraft Java Edition
- Java runtime (system-installed or bundled later)

## Development
```
wails dev
```

## Build
```
wails build
```

## Configuration
Currently expected values (hardcoded or simple config):
- Backend API base URL: `http://localhost:3000` (dev)
- Minecraft server address: `mc.calebwash.com`

## Planned features
- Download progress UI (per-mod + total)
- SHA1 / SHA256 validation from manifest
- Detect active Minecraft profile (username / UUID)
- Access request flow to backend for whitelist approval
- Automatic server entry in `servers.dat`
- Optional auto-join via a small client-side mod

## Notes
- Minecraft must be restarted to apply mod changes
- Designed for private servers using whitelist + online-mode

