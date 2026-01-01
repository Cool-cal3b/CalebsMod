# CalebsMod

Private Minecraft modpack server and launcher for friends.

## Components

- **calebs-mod-server**: NestJS backend (mod hosting, whitelist, server control)
- **CalebsModClient**: Wails desktop app (launcher, admin tools)

## Quick Start

```powershell
# Single window mode
.\start-dev.ps1

# Separate windows mode (better for debugging)
.\start-dev.ps1 -sw
```

First run will create `.env` - edit `calebs-mod-server/.env` with your secrets before running again.

## Prerequisites

- Node.js 18+
- Go 1.21+
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- Docker Desktop (for Minecraft server)

## Manual Setup

```powershell
# Server
cd calebs-mod-server
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env
npm run start:dev

# Client (separate terminal)
cd CalebsModClient
wails dev
```

## How It Works

1. Admin uploads mods via client
2. Server mirrors mods (SHA256-verified)
3. Players use client to auto-sync mods
4. Server manages Minecraft via Docker + RCON

Server: `http://localhost:3000`

See `calebs-mod-server/readme.md` for API docs.
