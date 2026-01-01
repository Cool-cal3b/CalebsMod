# CalebsModServer

Backend control plane for a private modded Minecraft server.

Built with **Nest.js**. Provides:

- Modpack manifest endpoints with verified mirror storage
- Mod file hosting (SHA256-verified)
- Admin file upload via client
- Access request and approval (whitelist management via RCON)
- Docker-based Minecraft server control (start/stop/restart)
- Server stats and monitoring
- JWT-based admin authentication

## Architecture

The CalebsMod server runs **bare-metal** on your local machine and manages a **Dockerized Minecraft server**.

### Admin Workflow

1. Admin uses CalebsModClient to upload a mod (URL or file)
2. Server downloads/verifies the mod, computes SHA256
3. Server stores mod in `storage/mods-store/<sha256>.jar`
4. Manifest is updated automatically
5. Regular clients download mods from your server using the manifest

### Storage Layout

```
storage/
  mods-store/         # Permanent mod binaries (SHA256-named)
  cache/              # Temporary downloads
packs/                # Pack metadata (optional, can be in DB)
data/                 # SQLite database
minecraft-data/       # Docker volume mount for Minecraft
```

## Core ideas

- Launcher (CalebsModClient) auto-syncs mods and configs using manifest
- Admin uploads mods once; all clients download from local server
- Players request access; admin approves; server whitelists via RCON
- Minecraft runs in Docker, managed by this server
- Minecraft remains authoritative for identity (`online-mode=true`)

## Recommended Minecraft settings

In `server.properties`:

- `online-mode=true`
- `white-list=true`
- `enforce-whitelist=true`

For RCON:

- `enable-rcon=true`
- `rcon.password=<strong password>`
- `rcon.port=25575`

Never expose RCON publicly.

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:

- `ADMIN_SECRET` - Admin authentication secret
- `JWT_SECRET` - JWT signing secret
- `RCON_PASSWORD` - Must match Minecraft server RCON password
- `MINECRAFT_VERSION` - Minecraft version (e.g., 1.20.1)
- `MINECRAFT_TYPE` - Loader type (FORGE, FABRIC, etc.)

## Running locally

```bash
npm install
npm run start:dev
```

Default address: `http://localhost:3000`

## API Endpoints

### Public

- `GET /api/modpack/manifest/:packId` - Get modpack manifest
- `GET /api/modpack/mods/:sha256` - Download mod file
- `GET /api/server/status` - Get server status
- `POST /api/access/request` - Request server access

### Admin Authentication

- `POST /api/auth/admin/login` - Login with admin secret, receive JWT

### Admin (Protected)

**Modpack Management:**

- `GET /api/modpack/packs` - List all packs
- `POST /api/modpack/packs` - Create new pack
- `POST /api/modpack/packs/:packId` - Update pack
- `POST /api/modpack/packs/:packId/mods` - Add mod by URL
- `POST /api/modpack/packs/:packId/mods/upload` - Upload mod file
- `DELETE /api/modpack/packs/:packId/mods/:sha256` - Remove mod

**Access Management:**

- `GET /api/access/requests` - List access requests
- `GET /api/access/requests/:id` - Get request details
- `POST /api/access/approve/:id` - Approve request (whitelists player)
- `POST /api/access/deny/:id` - Deny request
- `POST /api/access/revoke/:username` - Revoke access

**Server Control:**

- `POST /api/server/start` - Start Minecraft server
- `POST /api/server/stop` - Stop Minecraft server
- `POST /api/server/restart` - Restart Minecraft server
- `GET /api/server/metrics` - Get server metrics (CPU, memory, network)
- `GET /api/server/logs` - Get server logs
- `POST /api/server/command` - Send RCON command

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── database/                  # SQLite database module
│   ├── database.module.ts
│   └── database.service.ts
├── auth/                      # JWT authentication
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── jwt-auth.guard.ts
│   ├── jwt.strategy.ts
│   └── dto/
├── modpack/                   # Mod management & serving
│   ├── modpack.module.ts
│   ├── modpack.service.ts
│   ├── modpack.controller.ts
│   └── dto/
├── access/                    # Whitelist management
│   ├── access.module.ts
│   ├── access.service.ts
│   ├── access.controller.ts
│   └── dto/
├── server/                    # Server control
│   ├── server.module.ts
│   ├── server.service.ts
│   ├── server.controller.ts
│   └── dto/
├── rcon/                      # RCON client wrapper (rcon-client)
│   ├── rcon.module.ts
│   └── rcon.service.ts
└── docker/                    # Docker container management
    ├── docker.module.ts
    └── docker.service.ts
```

## Database Schema

SQLite database includes:

- `packs` - Modpack definitions
- `pack_versions` - Version history
- `mods` - Mod files (SHA256, metadata)
- `pack_version_mods` - Many-to-many relationship
- `access_requests` - Player access requests
- `admin_sessions` - JWT session tracking
- `audit_log` - All admin actions

## Docker Management

The server uses Dockerode to manage a Minecraft container. You can:

- Start/stop/restart the container via API
- View logs and metrics
- Send RCON commands while running

Reference `docker-compose.yml` provided for manual Docker setup if needed.

## Domain and networking

- Public server address: `mc.calebwash.com`
- Dynamic DNS keeps the domain pointed at current home IP
- Port forward TCP 25565 to the host machine
- RCON port (25575) should NOT be exposed publicly

## Security

- Whitelist enforced
- Online mode enabled
- Admin endpoints protected with JWT
- RCON never exposed to the internet
- Admin secret + token rotation supported
- All admin actions logged in audit trail

## Development

Run tests:

```bash
npm test
```

Build for production:

```bash
npm run build
npm run start:prod
```
