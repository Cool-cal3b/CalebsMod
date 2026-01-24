# CalebsMod

Private Minecraft modpack server and launcher for friends with automatic server connection.

## Features

- **Auto-Install PrismLauncher**: One-click portable launcher installation
- **Isolated Instance**: Separate "CalebsMod" instance, won't affect other Minecraft installs
- **Auto-Join Server**: Launches directly into your server using PrismLauncher's `--server` flag
- **Dynamic DNS**: Automatic Cloudflare DNS updates for custom domain (mc.calebwash.com)
- **Dynamic IP Fallback**: Works without static IP if DNS not configured
- **Mod Sync**: Automatic mod downloading and updating
- **Server Management**: Start/stop/restart via desktop app

## Quick Start

```powershell
.\start-dev.ps1
```

First run creates `.env` - edit `calebs-mod-server/.env` before running again.

## Prerequisites

- Node.js 18+, Go 1.21+, Docker Desktop
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- Java (for building custom mods, if needed)

## Project Structure

```
CalebsMod/
├── my-mods/                  # Custom Forge mods (optional)
├── calebs-mod-server/        # NestJS API server
├── CalebsModClient/          # Wails desktop app
└── README.md
```

## Building for Distribution

### 1. Build Launcher

```powershell
cd CalebsModClient
wails build
```

### 2. Configure DNS (Optional but Recommended)

If you want to use a custom domain (e.g., `mc.calebwash.com`) instead of your dynamic IP:

1. Get Cloudflare API credentials:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit zone DNS" template
   - Select your zone (calebwash.com)
   - Copy the API token
   
2. Get your Zone ID:
   - Go to your domain overview in Cloudflare dashboard
   - Copy the Zone ID from the right sidebar
   
3. Add to `calebs-mod-server/.env`:
   ```
   CLOUDFLARE_API_TOKEN=your-api-token
   CLOUDFLARE_ZONE_ID=your-zone-id
   ```

4. Update DNS from admin panel or run:
   ```bash
   curl -X POST http://localhost:3000/api/server/update-dns \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

### 3. Port Forwarding

Forward ports **25565** (Minecraft) and **3000** (API) on your router.

### 4. Distribute

Give friends the CalebsModClient installer. They:
1. Install the launcher
2. Click "Install Launcher" to get PrismLauncher
3. Log into Microsoft account (one-time)
4. Click "Launch Minecraft" to play

## How It Works

1. Friend opens CalebsMod app, clicks "Install Launcher"
2. App downloads PrismLauncher portable to `%LOCALAPPDATA%\CalebsMod\PrismLauncher`
3. Friend logs into Microsoft account in PrismLauncher (one-time)
4. Friend clicks "Launch Minecraft"
5. App creates "CalebsMod" instance (if doesn't exist)
6. App syncs mods to instance
7. App fetches server address (mc.calebwash.com or your public IP)
8. App launches: `prismlauncher.exe -l CalebsMod -s mc.calebwash.com`
9. Minecraft opens and joins your server automatically

## Why PrismLauncher?

- **Instance Isolation**: Separate from other Minecraft installs
- **Portable**: No admin rights needed
- **Direct Server Join**: Built-in `--server` flag
- **Forge Management**: Handles Forge automatically

## Troubleshooting

**Friends can't connect:**
- Verify port forwarding (25565 and 3000)
- If using DNS: Ensure DNS record updated via admin panel
- If not using DNS: Check public IP matches: `curl https://api.ipify.org`
- Ensure server is running

**Update DNS record:**
- Use admin panel "Update DNS" button
- Or manually: Check Cloudflare dashboard for mc.calebwash.com A record

**Launcher incompatible:**
- Click "Reinstall Launcher" to download correct version for your system

**Need to log in again:**
- They need to log into Microsoft account in PrismLauncher once
- After that, launches work automatically
