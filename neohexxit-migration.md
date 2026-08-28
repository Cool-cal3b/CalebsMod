# NeoHexxit Migration — Session Notes

## What Was Done

The goal was to replace the existing modpack with the NeoHexxit server pack (`hexxit-serverpack-FLAT`), boot-test the server, classify mods/configs/datapacks correctly, and finalize a single clean revision baseline.

---

## Steps Performed

### 1. Cleared Existing Modpack State

- Revision tracking paused + history reset via `POST /api/modpack/revision-tracking` `{ paused: true, resetHistory: true }`
- Deleted all existing files via `DELETE /api/modpack/files` (removed 8,686 prior entries)

### 2. Ingested NeoHexxit Pack

- Zipped `C:\Users\numbe\Downloads\hexxit-serverpack-FLAT\*` and uploaded via `POST /api/modpack/upload-zip`
- 9,060 files processed, 5,934 net new files added to DB

### 3. Boot Testing — Round 1 Crash

**Error:** `IllegalStateException: Unbound values in registry minecraft:worldgen/configured_feature` — references to `geophilic:`*, `gravelores_expansion:*`, `regions_unexplored:blueblossom`

**Cause:** The `thingpacks/editors`, `thingpacks/Geophilic v3.2 f15-61`, `thingpacks/gravelores`, and `thingpacks/gravelores_expansion` subdirectories inside the source pack were written into the DB as server-side content, but the mods that define the referenced world-gen features (`geophilic`, `gravelores`) do **not exist in the mods folder**. The datapacks reference biome features provided by absent mods.

**Fix:**

- Deleted all `thingpacks/Geophilic v3.2 f15-61/`*, `thingpacks/gravelores/*`, `thingpacks/gravelores_expansion/*`, and `thingpacks/editors/*` rows from the `files` table directly via `sqlite3`
- Deleted stale world save data from `calebs-mod-server/minecraft-data/` (world folders + level.dat)

### 4. Boot Testing — Round 2 Crash

**Error:** `IllegalStateException: Overworld settings missing`

**Cause:** Stale leftover world data from prior runs (written when a different level-type/world-gen config was active) conflicted with the fresh world.

**Fix:** Deleted world save data again cleanly; server generated a new world successfully.

### 5. Server Successfully Boots

Log confirmed: `Done (...s)! For help, type "help"` — container reached `healthy` status.

### 6. Flag Classification Pass

Set correct `server_only` / `client_only` flags via `sqlite3`:

- `server_only = 0` for all `mod`, `config`, `defaultconfig`, `resourcepack`, `shaderpack`, `options`, `servers`, `panorama` types (client gets them)
- `server_only = 1` for all `thingpack` type (server-side datapacks only, never sent to client)
- `client_only = 1` for the 17 visual/perf/UI mods listed below (they are excluded from the server manifest and never deployed to the Docker container)

### 7. Revision History Finalized

- Paused + `resetHistory: true`, then unpaused + `resetHistory: true` to collapse everything into one baseline
- Final revision ID: **21** (1 row in `revisions` table)

---

## Thingpacks Removed (not loaded anywhere)

These were inside `hexxit-serverpack-FLAT/thingpacks/` but **removed from the DB entirely** because the mods that define their referenced world-gen features do not exist in the pack's mod folder:


| Thingpack               | Reason Removed                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Geophilic v3.2 f15-61` | References `geophilic:`* biome features — mod absent from server                                                                            |
| `gravelores`            | References `gravelores:*` features — mod absent                                                                                             |
| `gravelores_expansion`  | References `gravelores_expansion:*` features and `buntsy:*` — mods absent                                                                   |
| `editors`               | References `twilightforest` world-gen overrides + `geophilic`/`gravelores` features via cross-pack references that caused registry failures |


## Thingpacks Still Active (deployed to server)

These three are synced to `minecraft-data/thingpacks/` on server start:


| Thingpack                     | Contents                                       |
| ----------------------------- | ---------------------------------------------- |
| `Classic Villages by MineOym` | Minecraft village structure overrides          |
| `Tinker2`                     | TConstruct + Tinkers Katanas recipes/materials |
| `TinkerStuff`                 | TConstruct + Tinkers Things materials          |


---

## Client-Only Mods (not sent to server, `client_only = 1`)

These are flagged `client_only` — they are included in the client sync manifest but excluded from the server manifest, so they are never deployed to the Docker Minecraft container:

```
BetterAdvancements-Forge-1.20.1-0.4.2.25.jar
BetterClouds-1.1.jar
MouseTweaks-forge-mc1.20.1-2.25.1.jar
betterchunkloading-1.20.1-5.4.jar
caelum-1.20.1-2.0.0.0.jar
embeddium-0.3.31+mc1.20.1.jar
entityculling-forge-1.8.2-mc1.20.1.jar
flerovium-forge-1.20.1-1.2.15-all.jar
gnetum-2.1.3.jar
gpumemleakfix-1.20.1-1.8.jar
inventoryhud.forge.1.20.1-3.4.26.jar
mcwifipnp-1.7.6-1.20.1-forge.jar
panorama_screens-1.0+forge+mc1.20.jar
raised-forge-1.20.1-5.0.1.jar
retrodamageindicators-1.0.1.jar
smoothchunk-1.20.1-4.1.jar
spanorama-1.5.2.jar
```

---

## Current Database State


| Metric                                     | Count                           |
| ------------------------------------------ | ------------------------------- |
| Total files in DB                          | 5,934                           |
| Client manifest (`server_only = 0`)        | 1,969                           |
| Server manifest (`client_only = 0`)        | 4,707                           |
| Client-only mods (`client_only = 1`)       | 1,227                           |
| Server-only thingpacks (`server_only = 1`) | 3,965                           |
| Revisions                                  | **1** (baseline revision ID 21) |
| Revision files                             | 5,934                           |


### File type breakdown


| Type           | Count |
| -------------- | ----- |
| `thingpack`    | 3,965 |
| `resourcepack` | 1,166 |
| `config`       | 594   |
| `mod`          | 165   |
| `panorama`     | 36    |
| `shaderpack`   | 7     |
| `options`      | 1     |


### Mod counts

- **148 shared mods** (`server_only = 0`, `client_only = 0`) — sent to both server and client
- **17 client-only mods** — sent to client only
- **0 server-only mods** — all mods are included in client sync

---

## Current Server State


| Item                          | Value                                                  |
| ----------------------------- | ------------------------------------------------------ |
| Container name                | `minecraft-server-calebsmod`                           |
| Container status              | `Up 2+ hours (healthy)`                                |
| Forge version                 | 47.4.10                                                |
| Minecraft version             | 1.20.1                                                 |
| Mods deployed to `/data/mods` | 148                                                    |
| Active thingpacks             | Classic Villages, Tinker2, TinkerStuff                 |
| World                         | Freshly generated (old saves deleted during migration) |
| API port                      | 3000 (prod)                                            |


---

## Known Issues / Caveats

### `Missing required datapack registries: twilightmagic:paintings, twilightrestrictions`

This error appears **on the client side at login** if the client instance has stale leftover thingpack/datapack data from a previous install. The server does not provide `twilightmagic` or `twilightrestrictions` datapacks.

**Fix for connecting clients:**

1. Delete `%LOCALAPPDATA%\CalebsMod\PrismLauncher\instances\CalebsMod` (or the full `PrismLauncher` folder)
2. Delete `%LOCALAPPDATA%\CalebsModClient\revision.txt`
3. Relaunch the client app and let it sync fresh

### `AccessDeniedException: ...fml.toml`

Forge fails to write its config on launch. Caused by a read-only file from a previous synced install.

**Fix:**

```powershell
attrib -R "%LOCALAPPDATA%\CalebsMod\PrismLauncher\instances\CalebsMod\minecraft\*" /S /D
```

Then retry launch. If it persists, delete and reinstall the instance as above.

---

## Revision Tracking Policy

Revisions are currently **active** (not paused). Any future modpack upload, file delete, or flag change will create new incremental revisions on top of baseline 21. Clients sync from their stored revision number upward.

To make bulk changes without creating noisy revision history, pause first:

```
POST /api/modpack/revision-tracking  { "paused": true, "resetHistory": true }
```

Then make changes, then unpause with reset to collapse to one new baseline.