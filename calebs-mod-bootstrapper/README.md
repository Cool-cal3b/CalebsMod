# Caleb's Mod Bootstrapper

This is the bootstrapper/launcher for Caleb's Mod Client. This small executable handles automatic updates and launches the main client application.

## For Distribution (What to tell your friends)

### Simple Instructions for Friends:

1. **Download** the `CalebsModBootstrapper.exe` file
2. **Run** the executable by double-clicking it
3. The bootstrapper will:
   - Check for the latest version
   - Download the client automatically (if needed)
   - Launch the game client
4. **That's it!** The client will open automatically

### What Happens Behind the Scenes:

- The bootstrapper stores files in: `%LOCALAPPDATA%\CalebsMod\`
- It checks the server for the latest version
- If an update is available, it downloads and installs it atomically (safely)
- Old versions are backed up before installing new ones
- The client is launched automatically after updates

### First Time Setup:

When running for the first time, the bootstrapper will:
1. Download the full client (~several MB)
2. Extract it to your local AppData folder
3. Launch the client

This may take a few minutes depending on your internet connection.

### Subsequent Runs:

On subsequent runs, the bootstrapper will:
1. Check for updates (takes a few seconds)
2. Download and install updates if available
3. Launch the client immediately if no updates are needed

### Troubleshooting:

**Problem: "Failed to check for updates"**
- Check your internet connection
- Make sure you can reach: https://mc.calebwash.com:3000
- The server might be temporarily down

**Problem: "Download failed"**
- Check your internet connection
- Make sure you have enough disk space
- Try running the bootstrapper again

**Problem: Client doesn't launch**
- Check your antivirus - it might be blocking the client
- Make sure you have necessary permissions to run executables
- Try running as administrator

**Problem: Stuck on old version**
- Delete the file: `%LOCALAPPDATA%\CalebsMod\CurrentCalebModClientVersion.txt`
- Run the bootstrapper again

### Manual File Locations:

If you need to manually access or remove files:
- **Bootstrapper files**: `%LOCALAPPDATA%\CalebsMod\`
- **Client executable**: `%LOCALAPPDATA%\CalebsMod\CalebsModClient.exe`
- **Version file**: `%LOCALAPPDATA%\CalebsMod\CurrentCalebModClientVersion.txt`

To completely uninstall, simply delete the `%LOCALAPPDATA%\CalebsMod\` folder.

---

## For Developers

### Building the Bootstrapper:

**Prerequisites:**
- Go 1.20 or higher installed
- Windows OS (or cross-compilation setup)

**Build Command:**

```powershell
.\build.ps1
```

This will create `dist\CalebsModBootstrapper.exe`

**Manual Build:**

```bash
# With console window (recommended for debugging)
go build -ldflags="-s -w" -o CalebsModBootstrapper.exe calebs-mod-bootstrapper.go

# Without console window (silent mode)
go build -ldflags="-s -w -H windowsgui" -o CalebsModBootstrapper.exe calebs-mod-bootstrapper.go
```

### How It Works:

1. **Version Check**: Hits `GET /api/server/latest-client-release` endpoint
2. **Compare Versions**: Compares local version with server version
3. **Download**: Downloads the signed S3 URL if update is needed
4. **Atomic Update**:
   - Downloads to temporary file (`.download` suffix)
   - Verifies download integrity (size check and SHA256)
   - Extracts to temporary directory
   - Backs up old client to `client_old`
   - Moves new client to main location
   - Updates version file
5. **Launch**: Executes the client

### Configuration:

Edit these constants in `calebs-mod-bootstrapper.go`:

```go
const (
    ServerURL         = "https://mc.calebwash.com:3000"
    VersionEndpoint   = "/api/server/latest-client-release"
    ClientExecutable  = "CalebsModClient.exe"
)
```

### Important Gotchas Addressed:

✅ **Atomic Updates**: Old client is backed up before new one is installed
✅ **Integrity Checks**: Downloaded files are verified before extraction
✅ **Graceful Fallback**: If update fails, attempts to launch existing client
✅ **Progress Indicators**: Shows download progress to users
✅ **Error Messages**: Clear, actionable error messages
✅ **Auto-launch**: Client launches automatically after updates
✅ **Idempotent**: Can be run multiple times safely
✅ **No Admin Required**: Uses user's AppData directory

### Testing:

1. Build the bootstrapper: `.\build.ps1`
2. Run the executable: `.\dist\CalebsModBootstrapper.exe`
3. Watch the console output for any errors
4. Verify the client launches

### Distribution Checklist:

- [ ] Build the bootstrapper
- [ ] Test on a clean Windows machine
- [ ] Verify auto-update works
- [ ] Upload client version to S3 using `upload-new-client-to-s3.ps1`
- [ ] Share `CalebsModBootstrapper.exe` with friends
- [ ] Provide simple instructions (see above)

### Update Workflow:

When you release a new client version:

1. Build the Wails client: `wails build` in CalebsModClient directory
2. Upload to S3: `.\upload-new-client-to-s3.ps1`
3. Commit the version bump
4. Friends run the existing bootstrapper - it will auto-update!

No need to redistribute the bootstrapper unless you change the bootstrapper code itself.
