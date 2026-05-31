# CalebsModServer

Backend control plane for a private modded Minecraft server. Manages mod distribution, whitelist access, and Minecraft server control via Docker.

## Quick Start

```bash
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env with your secrets
npm run start:dev
```

Server: `http://localhost:3000`

## Features

- **Mod Distribution**: Mirrors mods by SHA256, serves to clients
- **Access Control**: Whitelist management via RCON
- **Server Control**: Start/stop/restart Minecraft Docker container
- **Admin Auth**: JWT-based authentication

## Environment (.env)

```env
ADMIN_SECRET=<long-random-string>
JWT_SECRET=<another-long-random-string>
RCON_PASSWORD=<minecraft-rcon-password>

MINECRAFT_VERSION=1.20.1
MINECRAFT_TYPE=FORGE
MINECRAFT_MEMORY=4G
```

## API Endpoints

### Public

- `GET /api/modpack/manifest/:packId` - Mod list
- `GET /api/modpack/mods/:sha256` - Download mod
- `GET /api/server/status` - Server status
- `POST /api/access/request` - Request access

### Admin (JWT Required)

**Login:**

```bash
POST /api/auth/admin/login
Body: {"adminSecret": "your-secret"}
```

**Modpack:**

- `POST /api/modpack/packs` - Create pack
- `POST /api/modpack/packs/:id/mods` - Add by URL
- `POST /api/modpack/packs/:id/mods/upload` - Upload file
- `DELETE /api/modpack/packs/:id/mods/:sha256` - Remove

**Access:**

- `GET /api/access/requests` - List requests
- `POST /api/access/approve/:id` - Approve
- `POST /api/access/deny/:id` - Deny

**Server:**

- `POST /api/server/start` - Start
- `POST /api/server/stop` - Stop
- `POST /api/server/restart` - Restart
- `GET /api/server/metrics` - Stats
- `GET /api/server/logs?tail=100` - Logs

## Architecture

```
storage/pack-files/   # Files keyed by SHA256 (no extension)
storage/cache/        # Temp uploads and downloads
data/calebs-mod.db    # SQLite
minecraft-data/       # Docker volume (Minecraft server files)
```

Server runs bare-metal. Minecraft runs in Docker (managed via Dockerode).

## Flow

1. Admin adds mod (URL or upload)
2. Server downloads, hashes, stores
3. Manifest updates
4. Clients fetch manifest, download by hash

---

## Mod Syncing (Detailed)

### 1. Upload

Mods are added via **zip upload** (`POST /api/modpack/upload-zip`). The admin uploads a modpack zip (e.g. exported from CurseForge/Modrinth). The zip is saved to `storage/cache/`, then parsed.

### 2. Parsing & Client/Server Flags

Each entry in the zip is processed:

- **Path normalization**: `overrides/` prefix is stripped. Paths like `modpack-name/overrides/mods/foo.jar` become `mods/foo.jar`.
- **Client-only**: Files under `.for-manual-install/` are marked `clientOnly = true`. These go to the client only (e.g. shaders, resource packs the user installs manually).
- **Server-only**: Files under `mods/`, `config/`, or `thingpacks/` (at top level or under a parent folder) are marked `serverOnly = true`. These go to the Minecraft server only.
- **Both**: Files not matching the above (e.g. `resourcepacks/`, `shaderpacks/`, `options.txt`) are neither client-only nor server-only and sync to both.
- **File type**: Derived from the top-level folder (`mods` → mod, `config` → config, `resourcepacks` → resourcepack, etc.). Root files like `options.txt` and `servers.dat` are also supported.

### 3. Storage on Disk

- Each file is hashed with SHA256. The binary is stored at `storage/pack-files/<sha256>` (no extension).
- Deduplication: if a file with the same hash already exists on disk, it is not copied again.
- Temp files used during extraction are written to `storage/cache/` and deleted after processing.

### 4. Storage in DB

The `files` table stores:

| Column        | Purpose                                                |
|---------------|--------------------------------------------------------|
| sha256        | Primary key, content hash                               |
| file_name     | Original filename                                       |
| file_size     | Size in bytes                                           |
| file_type     | mod, config, resourcepack, shaderpack, etc.             |
| relative_path | Path in modpack (e.g. `mods/foo.jar`)                   |
| server_only   | 1 = server only, 0 = not server only                    |
| client_only   | 1 = client only, 0 = not client only                    |
| required      | Whether the file is required                            |

Each add/remove creates a **revision** in `revisions` and `revision_files`. Revisions track the delta: which files were added or removed in each change.

### 5. Manifests

- **Client manifest** (`GET /api/modpack/manifest`): All files where `server_only = 0`. Used by the client to know what to sync.
- **Server manifest** (`getServerManifest()`): All files where `client_only = 0`. Used when syncing files to the Minecraft server (e.g. on `POST /api/server/start`).

### 6. Client Sync Flow

1. Client calls `GET /api/modpack/latest-revision` to get the current revision.
2. Client stores its last synced revision in `revision.txt` locally.
3. Client calls `GET /api/modpack/sync/:fromRevision` with its stored revision.
4. Server compares `fromRevision` to the latest revision. If equal, returns `{ upToDate: true }`.
5. If behind, server queries `revision_files` for all changes since `fromRevision`, **excluding** files where `server_only = 1`.
6. Response includes `filesToAdd`, `filesToRemove`, and `zipUrl` (e.g. `/api/modpack/sync-zip/:fromRevision`).
7. Client deletes `filesToRemove` from its `.minecraft` folder.
8. Client fetches the zip from `zipUrl`, which contains only the `filesToAdd` (server-only files are excluded).
9. Client extracts the zip into `.minecraft`, preserving `relativePath`.
10. Client saves the new `latestRevision` to `revision.txt`.

### 7. Minecraft Server Sync

When the server is started (`POST /api/server/start`), `syncModpackFiles()` runs:

1. Fetches the **server manifest** (files where `client_only = 0`).
2. For each file, copies from `storage/pack-files/<sha256>` to `minecraft-data/<relativePath>`.
3. Skips copy if the target already exists and has the same SHA256.
4. Prunes mods in `minecraft-data/mods/` that are not in the manifest.

### 8. Admin Overrides

Admins can change flags per file via `PATCH /api/modpack/files/:sha256` with `{ serverOnly, clientOnly }`. After changing flags, `POST /api/modpack/resync` creates a full resync revision so all clients re-sync from scratch.

## Minecraft Setup

Auto-creates Docker container:

- Image: `itzg/minecraft-server:latest`
- Ports: 25565, 25575 (RCON)
- Volume: `./minecraft-data:/data`

`server.properties`:

```properties
online-mode=true
white-list=true
enable-rcon=true
rcon.password=<match .env>
```

## Database

SQLite tables: packs, mods, pack_versions, access_requests, admin_sessions, audit_log

## Example

```bash
# Login
curl -X POST http://localhost:3000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"adminSecret":"your-secret"}'

TOKEN="<token>"

# Create pack
curl -X POST http://localhost:3000/api/modpack/packs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"CalebsMod","minecraftVersion":"1.20.1","loaderType":"forge","loaderVersion":"47.2.0"}'

# Add mod
curl -X POST http://localhost:3000/api/modpack/packs/calebsmod/mods \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://cdn.modrinth.com/...","required":true}'

# Start server
curl -X POST http://localhost:3000/api/server/start \
  -H "Authorization: Bearer $TOKEN"
```

## Security

- Whitelist enforced
- Online mode (Mojang auth)
- JWT-protected admin endpoints
- RCON localhost only
- Audit log for all actions
