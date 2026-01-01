# CalebsMod Server - Project Structure

## Final Directory Structure

```
calebs-mod-server/
├── src/
│   ├── main.ts                           # Entry point with CORS and logging
│   ├── app.module.ts                     # Root module with all imports
│   │
│   ├── database/                         # SQLite database (Global)
│   │   ├── database.module.ts
│   │   └── database.service.ts           # Schema init, audit logging
│   │
│   ├── auth/                             # JWT authentication
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts               # Token management, admin login
│   │   ├── auth.controller.ts            # POST /api/auth/admin/login
│   │   ├── jwt-auth.guard.ts             # Guard for protected routes
│   │   ├── jwt.strategy.ts               # Passport JWT strategy
│   │   └── dto/
│   │       └── auth.dto.ts
│   │
│   ├── modpack/                          # Mod management & file serving
│   │   ├── modpack.module.ts
│   │   ├── modpack.service.ts            # Mod download, hash, storage
│   │   ├── modpack.controller.ts         # Manifest, upload, download
│   │   └── dto/
│   │       ├── manifest.dto.ts           # Client-facing manifest format
│   │       └── pack.dto.ts
│   │
│   ├── access/                           # Whitelist management
│   │   ├── access.module.ts
│   │   ├── access.service.ts             # RCON whitelist operations
│   │   ├── access.controller.ts          # Request/approve/deny/revoke
│   │   └── dto/
│   │       └── access.dto.ts
│   │
│   ├── server/                           # Server control
│   │   ├── server.module.ts
│   │   ├── server.service.ts             # Start/stop/restart/metrics
│   │   ├── server.controller.ts          # Admin server management
│   │   └── dto/
│   │       └── server.dto.ts
│   │
│   ├── rcon/                             # RCON client (Global)
│   │   ├── rcon.module.ts
│   │   └── rcon.service.ts               # modern-rcon wrapper
│   │
│   └── docker/                           # Docker management (Global)
│       ├── docker.module.ts
│       └── docker.service.ts             # Dockerode container control
│
├── storage/                              # Git-ignored
│   ├── mods-store/                       # Permanent: <sha256>.jar
│   └── cache/                            # Temporary downloads
│
├── packs/                                # Optional pack metadata
│   └── .gitkeep
│
├── data/                                 # SQLite database
│   └── calebs-mod.db                     # Auto-created on first run
│
├── minecraft-data/                       # Docker volume mount
│   └── (Minecraft server files)
│
├── .env.example                          # Environment template
├── .env                                  # Your local config (git-ignored)
├── .gitignore                            # Updated for storage, data
├── docker-compose.yml                    # Reference for manual Docker setup
├── Dockerfile.minecraft                  # Reference Dockerfile
├── package.json                          # All dependencies added
├── readme.md                             # Complete project documentation
└── SETUP.md                              # Step-by-step setup guide
```

## Key Features Implemented

### ✅ Database (SQLite)

- Auto-initializes schema on first run
- Tables: packs, pack_versions, mods, pack_version_mods, access_requests, admin_sessions, audit_log
- WAL mode for better concurrency
- Full audit trail of admin actions

### ✅ Authentication

- Admin login with secret → JWT token (12h expiration)
- Token stored in database for validation
- Expired tokens auto-cleaned
- All admin endpoints protected with JwtAuthGuard

### ✅ Modpack Management

- Add mods by URL (downloads, hashes, stores)
- Upload mods via multipart form
- SHA256-based storage (no duplicates)
- Serve mods to clients
- Manifest generation (JSON)
- Pack versioning support

### ✅ Access Management

- Public access request endpoint
- Admin approve/deny with notes
- Auto-whitelist via RCON on approval
- Revoke access endpoint
- Status tracking (pending/approved/denied)

### ✅ Server Control

- Start/stop/restart Minecraft container
- Real-time status checks
- Metrics (CPU, memory, network)
- Log streaming
- RCON command execution
- Graceful shutdown messages

### ✅ Docker Integration

- Dockerode API for container management
- Auto-creates container if missing
- Volume mounts for data persistence
- Port forwarding (25565, 25575)
- Container restart policies
- Full stats monitoring

### ✅ RCON Integration

- modern-rcon client
- Auto-reconnect on failure
- Whitelist commands
- Server commands
- Player list parsing

## API Endpoint Summary

### Public (No Auth)

- `GET /api/modpack/manifest/:packId` - Modpack manifest
- `GET /api/modpack/mods/:sha256` - Download mod file
- `GET /api/server/status` - Server status
- `POST /api/access/request` - Request access

### Admin Auth

- `POST /api/auth/admin/login` - Get JWT token

### Admin (JWT Required)

**Modpack:**

- `GET /api/modpack/packs`
- `POST /api/modpack/packs`
- `POST /api/modpack/packs/:packId`
- `POST /api/modpack/packs/:packId/mods`
- `POST /api/modpack/packs/:packId/mods/upload`
- `DELETE /api/modpack/packs/:packId/mods/:sha256`

**Access:**

- `GET /api/access/requests`
- `GET /api/access/requests/:id`
- `POST /api/access/approve/:id`
- `POST /api/access/deny/:id`
- `POST /api/access/revoke/:username`

**Server:**

- `POST /api/server/start`
- `POST /api/server/stop`
- `POST /api/server/restart`
- `GET /api/server/metrics`
- `GET /api/server/logs`
- `POST /api/server/command`

## Storage Strategy

1. **Mod Files:** `storage/mods-store/<sha256>.jar`
   - Permanent storage
   - Deduplicated by hash
   - Git-ignored

2. **Temporary Cache:** `storage/cache/`
   - Downloads before verification
   - Upload staging
   - Auto-cleaned

3. **Database:** `data/calebs-mod.db`
   - SQLite with WAL mode
   - All metadata, relationships
   - Audit log

4. **Minecraft Data:** `minecraft-data/`
   - Docker volume mount
   - Persistent server files
   - Git-ignored

## Next Steps

1. Run `npm install` to install all dependencies
2. Copy `.env.example` to `.env` and configure
3. Run `npm run start:dev` to start the server
4. Create your first pack via API
5. Add mods via URL or upload
6. Integrate with CalebsModClient

## Notes

- Server runs bare-metal (not in Docker)
- Minecraft runs in Docker (managed by server)
- RCON never exposed publicly
- All admin actions logged
- Manifest auto-updates on mod changes
- Clients verify mods by SHA256
