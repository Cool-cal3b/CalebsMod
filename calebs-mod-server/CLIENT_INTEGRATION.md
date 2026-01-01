# CalebsModClient - Server Integration Guide

This document describes how the CalebsModClient should interact with the CalebsMod Server.

## Authentication Flow

### 1. Store Admin Secret Locally

The client should store the admin secret in a local config file (not in the app binary).

**Example config location:**

- Windows: `%APPDATA%/CalebsModClient/config.json`
- macOS: `~/Library/Application Support/CalebsModClient/config.json`
- Linux: `~/.config/CalebsModClient/config.json`

```json
{
  "serverUrl": "http://localhost:3000",
  "adminSecret": "your-admin-secret-here"
}
```

### 2. Login to Get Token

```javascript
const response = await fetch(`${serverUrl}/api/auth/admin/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ adminSecret }),
});

const { access_token, expires_at } = await response.json();
```

Store the token in memory (or local storage for session persistence).

### 3. Use Token for Admin Requests

```javascript
const response = await fetch(`${serverUrl}/api/modpack/packs`, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${access_token}`,
  },
});
```

### 4. Handle Token Expiration

When you receive a 401 response, re-login:

```javascript
async function apiRequest(url, options = {}) {
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${access_token}`,
    },
  });

  if (response.status === 401) {
    await login();
    response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${access_token}`,
      },
    });
  }

  return response;
}
```

## Client Features to Implement

### For Regular Users (Player Mode)

1. **Check for Updates**
   - `GET /api/modpack/manifest/:packId`
   - Compare local mod hashes with manifest
   - Download missing/updated mods

2. **Download Mods**
   - `GET /api/modpack/mods/:sha256`
   - Verify downloaded file hash matches
   - Place in Minecraft mods folder

3. **Request Access**
   - `POST /api/access/request`
   - Submit username (and optional UUID)
   - Show confirmation message

4. **Check Server Status**
   - `GET /api/server/status`
   - Display if server is online
   - Show player count if available

### For Admin (Admin Mode)

5. **Upload Mod by URL**

```javascript
await fetch(`${serverUrl}/api/modpack/packs/${packId}/mods`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    url: 'https://cdn.modrinth.com/data/...',
    modId: 'jei',
    modVersion: '15.2.0.27',
    required: true,
  }),
});
```

6. **Upload Mod File**

```javascript
const formData = new FormData();
formData.append('file', fileBlob, 'mod.jar');
formData.append('modId', 'custom-mod');
formData.append('modVersion', '1.0.0');
formData.append('required', 'true');

await fetch(`${serverUrl}/api/modpack/packs/${packId}/mods/upload`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

7. **Remove Mod**

```javascript
await fetch(`${serverUrl}/api/modpack/packs/${packId}/mods/${sha256}`, {
  method: 'DELETE',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

8. **Manage Access Requests**

```javascript
// List pending requests
const requests = await fetch(
  `${serverUrl}/api/access/requests?status=pending`,
  {
    headers: { Authorization: `Bearer ${token}` },
  },
).then((r) => r.json());

// Approve
await fetch(`${serverUrl}/api/access/approve/${requestId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ notes: 'Approved' }),
});

// Deny
await fetch(`${serverUrl}/api/access/deny/${requestId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ notes: 'Unknown player' }),
});
```

9. **Server Control**

```javascript
// Start
await fetch(`${serverUrl}/api/server/start`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});

// Stop
await fetch(`${serverUrl}/api/server/stop`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});

// Restart
await fetch(`${serverUrl}/api/server/restart`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});

// Metrics
const metrics = await fetch(`${serverUrl}/api/server/metrics`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
```

10. **View Logs**

```javascript
const logs = await fetch(`${serverUrl}/api/server/logs?tail=100`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.text());
```

## Manifest Format

When you fetch the manifest, you'll receive:

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
      "originalUrl": "https://...",
      "modId": "jei",
      "modVersion": "15.2.0.27",
      "required": true
    }
  ],
  "updatedAt": 1704067200000
}
```

## Client Sync Logic

```javascript
async function syncMods(packId) {
  // 1. Fetch manifest
  const manifest = await fetch(
    `${serverUrl}/api/modpack/manifest/${packId}`,
  ).then((r) => r.json());

  // 2. Get local mods
  const localMods = await listLocalMods();
  const localHashes = new Set(localMods.map((m) => m.hash));

  // 3. Find mods to download
  const toDownload = manifest.mods.filter(
    (mod) => !localHashes.has(mod.sha256),
  );

  // 4. Find mods to remove (not in manifest)
  const manifestHashes = new Set(manifest.mods.map((m) => m.sha256));
  const toRemove = localMods.filter((m) => !manifestHashes.has(m.hash));

  // 5. Download missing mods
  for (const mod of toDownload) {
    await downloadMod(mod.sha256, mod.fileName);
  }

  // 6. Remove old mods
  for (const mod of toRemove) {
    await removeLocalMod(mod.path);
  }

  console.log(`Synced: ${toDownload.length} added, ${toRemove.length} removed`);
}

async function downloadMod(sha256, fileName) {
  const response = await fetch(`${serverUrl}/api/modpack/mods/${sha256}`);
  const blob = await response.blob();

  // Verify hash
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (hashHex !== sha256) {
    throw new Error(`Hash mismatch for ${fileName}`);
  }

  // Save to mods folder
  await saveFile(`./mods/${fileName}`, blob);
}
```

## UI Suggestions

### Player Mode

- **Home Screen:** Server status, mod sync button
- **Mods Tab:** List of installed mods with versions
- **Request Access:** Simple form with username field

### Admin Mode

- **Dashboard:** Server stats, player count, online status
- **Mods Manager:**
  - List of all mods in pack
  - Add mod button (URL or file picker)
  - Remove mod button per item
- **Access Requests:**
  - List pending/approved/denied
  - Approve/Deny buttons
- **Server Control:**
  - Start/Stop/Restart buttons
  - Live logs viewer
  - Server metrics display

## Error Handling

Always handle these common errors:

```javascript
try {
  const response = await apiRequest(...);

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid
      await relogin();
    } else if (response.status === 404) {
      // Pack or mod not found
      showError('Resource not found');
    } else if (response.status === 500) {
      // Server error
      showError('Server error, try again later');
    } else {
      const error = await response.json();
      showError(error.message);
    }
  }
} catch (error) {
  // Network error
  showError('Cannot connect to server');
}
```

## Testing the Integration

Use the server's test endpoints:

```bash
# Start the server
cd calebs-mod-server
npm run start:dev

# The server will be available at http://localhost:3000
```

Point your client to `http://localhost:3000` during development.
