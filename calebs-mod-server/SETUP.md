# CalebsMod Server Setup Guide

## Prerequisites

- Node.js 18+ installed
- Docker installed and running
- A strong admin secret ready

## Initial Setup

### 1. Install Dependencies

```bash
cd calebs-mod-server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

- `ADMIN_SECRET` - A long random string for admin authentication
- `JWT_SECRET` - Another random string for JWT signing
- `RCON_PASSWORD` - Strong password for Minecraft RCON
- Adjust Minecraft settings (version, memory, etc.) as needed

### 3. Start the Server

```bash
npm run start:dev
```

The server will:

- Create the SQLite database automatically
- Set up storage directories
- Start listening on port 3000

### 4. Create Your First Pack

Use the admin client or curl to create a pack:

```bash
# First, login to get a token
curl -X POST http://localhost:3000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"adminSecret":"your-admin-secret-here"}'

# Save the access_token from the response, then create a pack
curl -X POST http://localhost:3000/api/modpack/packs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "CalebsMod",
    "minecraftVersion": "1.20.1",
    "loaderType": "forge",
    "loaderVersion": "47.2.0"
  }'
```

### 5. Start Minecraft Server

```bash
# Via API
curl -X POST http://localhost:3000/api/server/start \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Or use the CalebsModClient admin interface.

## Adding Mods

### Via URL (Modrinth/CurseForge)

```bash
curl -X POST http://localhost:3000/api/modpack/packs/calebsmod/mods \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "url": "https://cdn.modrinth.com/data/...",
    "modId": "jei",
    "modVersion": "15.2.0.27",
    "required": true
  }'
```

### Via File Upload

Use the CalebsModClient or:

```bash
curl -X POST http://localhost:3000/api/modpack/packs/calebsmod/mods/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@path/to/mod.jar" \
  -F "modId=custom-mod" \
  -F "modVersion=1.0.0"
```

## Accessing the Manifest

Clients can fetch the manifest without authentication:

```bash
curl http://localhost:3000/api/modpack/manifest/calebsmod
```

Response:

```json
{
  "packName": "CalebsMod",
  "packId": "calebsmod",
  "version": "1.0.0",
  "minecraftVersion": "1.20.1",
  "loader": {
    "type": "forge",
    "version": "47.2.0"
  },
  "mods": [
    {
      "sha256": "abc123...",
      "fileName": "jei-1.20.1-forge-15.2.0.27.jar",
      "fileSize": 1234567,
      "required": true
    }
  ],
  "updatedAt": 1704067200000
}
```

## Managing Access Requests

Players request access via:

```bash
curl -X POST http://localhost:3000/api/access/request \
  -H "Content-Type: application/json" \
  -d '{
    "username": "PlayerName",
    "uuid": "optional-minecraft-uuid"
  }'
```

Admin reviews:

```bash
# List pending requests
curl http://localhost:3000/api/access/requests?status=pending \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Approve
curl -X POST http://localhost:3000/api/access/approve/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Approved - friend"}'

# Deny
curl -X POST http://localhost:3000/api/access/deny/2 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Unknown player"}'
```

## Monitoring

```bash
# Server status (public)
curl http://localhost:3000/api/server/status

# Detailed metrics (admin)
curl http://localhost:3000/api/server/metrics \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# View logs
curl "http://localhost:3000/api/server/logs?tail=50" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Troubleshooting

### RCON Connection Failed

- Ensure Minecraft server is running
- Check that RCON is enabled in server.properties
- Verify RCON_PASSWORD matches in both .env and server.properties
- RCON port must match (default 25575)

### Docker Container Won't Start

- Check Docker is running: `docker ps`
- View Docker logs: `docker logs calebs-minecraft-server`
- Ensure no port conflicts (25565, 25575)
- Check minecraft-data directory permissions

### Database Issues

- Database auto-creates on first run
- Located at `./data/calebs-mod.db`
- To reset: stop server, delete database, restart
- Audit log tracks all admin actions

## Production Deployment

For production:

1. Build the server: `npm run build`
2. Run with: `npm run start:prod`
3. Use a process manager (PM2, systemd)
4. Set strong secrets in .env
5. Regular backups of database and storage/

Example PM2:

```bash
pm2 start npm --name "calebs-mod-server" -- run start:prod
pm2 save
```
