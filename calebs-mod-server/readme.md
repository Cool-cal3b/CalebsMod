# CalebsModServer

Backend control plane for a private modded Minecraft server.

Built with **Nest.js**. Provides:
- Modpack manifest endpoints
- Optional mod/config file hosting
- Access request and approval (whitelist management via RCON)
- Server control and basic stats

Intended to run locally on the same machine as the Minecraft server.

## Core ideas
- The launcher (CalebsModClient) auto-syncs mods and configs using a manifest from this server
- Players request access; admin approves; server whitelists them
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

## Planned endpoints
### Public
- `GET /api/modpack/manifest`
- `GET /api/modpack/version`

### Player access
- `POST /api/access/request`
  - Body: `{ username: string, uuid?: string }`

### Admin (protected)
- `POST /api/access/approve/:id`
- `POST /api/access/deny/:id`
- `POST /api/server/restart`
- `GET  /api/server/status`
- `GET  /api/server/metrics`

## Running locally
```
npm install
npm run start:dev
```

Default address: `http://localhost:3000`

## Environment variables (planned)
- `RCON_HOST`
- `RCON_PORT`
- `RCON_PASSWORD`
- `ADMIN_TOKEN`

## Docker notes
- This backend may run bare-metal or in Docker
- Minecraft server is recommended to run in Docker with a mounted data volume
- Mods and configs should live outside the container and be updated by this server

## Domain and networking
- Public server address: `mc.calebwash.com`
- Dynamic DNS keeps the domain pointed at the current home IP
- Port forward TCP 25565 to the host machine

## Security
- Whitelist enforced
- Online mode enabled
- Admin endpoints protected
- RCON never exposed to the internet

