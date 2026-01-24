# Custom Mods

This folder contains custom Forge mods for CalebsMod (currently unused - using PrismLauncher's built-in server joining instead).

## Building Mods

```powershell
.\build-all-mods.ps1
```

## Note

The autoconnect-mod is no longer needed since PrismLauncher has a built-in `--server` flag that directly joins servers on launch. Your client mods should go in the PrismLauncher instance folder instead.

## Adding Client Mods

Mods are managed by the CalebsModClient app and placed in:
- `%LOCALAPPDATA%\CalebsMod\PrismLauncher\instances\CalebsMod\.minecraft\mods\`

The "Sync Mods" button in the launcher handles this automatically.
