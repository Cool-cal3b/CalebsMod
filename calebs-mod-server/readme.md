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
storage/mods-store/   # Mods: <sha256>.jar
storage/cache/        # Temp downloads
data/calebs-mod.db    # SQLite
minecraft-data/       # Docker volume
```

Server runs bare-metal. Minecraft runs in Docker (managed via Dockerode).

## Flow

1. Admin adds mod (URL or upload)
2. Server downloads, hashes, stores
3. Manifest updates
4. Clients fetch manifest, download by hash

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
