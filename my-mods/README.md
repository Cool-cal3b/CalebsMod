# Custom Mods

This folder contains all custom mods for CalebsMod.

## Building Mods

Build all mods at once:

```powershell
.\build-all-mods.ps1
```

Or build individual mods:

```powershell
cd autoconnect-mod
.\gradlew.bat build
```

## Output

Compiled JARs are in each mod's `build/libs/` folder.

## Distribution

### Client-Side Mods
- **autoconnect-mod** - Auto-connects friends to your server
- Copy to your modpack that friends download

### Server-Side Mods
- None currently
- If you add server mods, copy to `calebs-mod-server/minecraft-data/mods/`

## Adding New Mods

1. Create a new Forge mod project in this folder
2. Make sure it has `build.gradle` and `gradlew.bat`
3. Run `.\build-all-mods.ps1` to build everything
