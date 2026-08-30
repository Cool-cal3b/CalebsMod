package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	ServerURL        = "https://mc.calebwash.com"
	VersionEndpoint  = "/api/server/latest-client-release"
	ClientExecutable = "CalebsModClient.exe"
	VersionFileName  = "CurrentCalebModClientVersion.txt"

	// Everything downloaded or unpacked lives under this one directory inside
	// the install folder, so a failed run leaves a single thing to clean up
	// and every rename during the install stays on one volume.
	StagingDirName = ".calebsmod-update"

	// Windows will not delete a running executable but will rename one. The
	// displaced binary keeps this suffix until a later run can remove it.
	OldExeSuffix = ".old"

	// A release smaller than this is a truncated download or an error page,
	// never a real Wails build.
	MinReleaseZipBytes = 1024 * 1024
)

type ReleaseInfo struct {
	Version     string `json:"version"`
	DownloadURL string `json:"downloadUrl"`
	// Optional. Releases published before the server started emitting a digest
	// have none, and those fall back to the size check alone.
	Sha256 string `json:"sha256,omitempty"`
}

func main() {
	fmt.Println("=== Caleb's Mod Client Bootstrapper ===")
	fmt.Println()

	appDataPath, err := getAppDataPath()
	if err != nil {
		fmt.Printf("Error: Failed to determine AppData path: %v\n", err)
		waitForUser()
		os.Exit(1)
	}

	fmt.Printf("Using AppData path: %s\n", appDataPath)
	fmt.Println()

	if err := ensureAppDataExists(appDataPath); err != nil {
		fmt.Printf("Error: Failed to create AppData directory: %v\n", err)
		waitForUser()
		os.Exit(1)
	}

	// Sweep whatever a previous run or a client self-update left behind before
	// doing anything else, so leftovers cannot accumulate across releases.
	cleanupLeftovers(appDataPath)

	currentVersion, err := getCurrentVersion(appDataPath)
	if err != nil {
		fmt.Printf("Warning: Could not read current version: %v\n", err)
		currentVersion = "0.00"
	}

	fmt.Printf("Current version: %s\n", currentVersion)
	fmt.Println("Checking for updates...")

	release, err := getLatestRelease()
	if err != nil {
		fmt.Printf("Error: Failed to check for updates: %v\n", err)
		fmt.Println("\nAttempting to launch existing client...")
		launchClient(appDataPath)
		waitForUser()
		os.Exit(1)
	}

	fmt.Printf("Latest version: %s\n", release.Version)
	fmt.Println()

	// Any difference triggers an install, not just a higher number. The
	// bootstrapper is the "make my install match the server" tool, so it has
	// to carry a rollback down as readily as an update up. (The client's own
	// in-app update prompt is the opposite: it only offers strictly newer
	// versions, so nobody is nagged to "update" backwards.)
	if currentVersion == release.Version && clientExists(appDataPath) {
		fmt.Println("You are running the latest version!")
		fmt.Println("Launching client...")
		launchClient(appDataPath)
		os.Exit(0)
	}

	if currentVersion == release.Version {
		fmt.Println("Version is current but the client is missing - reinstalling...")
	} else {
		fmt.Printf("Update available: %s -> %s\n", currentVersion, release.Version)
	}
	fmt.Println("Starting update process...")
	fmt.Println()

	if err := performUpdate(appDataPath, release); err != nil {
		fmt.Printf("Error: Update failed: %v\n", err)
		fmt.Println("\nAttempting to launch existing client...")
		launchClient(appDataPath)
		waitForUser()
		os.Exit(1)
	}

	fmt.Println()
	fmt.Println("Update completed successfully!")
	fmt.Println("Launching client...")
	launchClient(appDataPath)
	os.Exit(0)
}

func getAppDataPath() (string, error) {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return "", fmt.Errorf("LOCALAPPDATA environment variable not set")
	}
	return filepath.Join(localAppData, "CalebsMod"), nil
}

func ensureAppDataExists(appDataPath string) error {
	return os.MkdirAll(appDataPath, 0755)
}

func clientExists(appDataPath string) bool {
	info, err := os.Stat(filepath.Join(appDataPath, ClientExecutable))
	return err == nil && !info.IsDir() && info.Size() >= MinReleaseZipBytes
}

// cleanupLeftovers deletes the scratch files an install can leave behind. The
// ".old" sweep is what keeps a user from accumulating one stale binary per
// release: the client's self-update renames its own running image aside and
// cannot delete it while it is still running, so somebody has to collect it
// later, and the bootstrapper always runs with no client of its own to hold
// the file open. Failures are ignored - an old client that happens to be open
// right now is collected on the next run instead.
func cleanupLeftovers(appDataPath string) {
	os.RemoveAll(filepath.Join(appDataPath, StagingDirName))

	// Scratch paths used by earlier bootstrapper versions.
	os.RemoveAll(filepath.Join(appDataPath, "client_new"))
	os.RemoveAll(filepath.Join(appDataPath, "client_old"))
	os.Remove(filepath.Join(appDataPath, "client.zip"))
	os.Remove(filepath.Join(appDataPath, "client.zip.download"))
	os.Remove(filepath.Join(appDataPath, "client.zip.download.sha256"))

	entries, err := os.ReadDir(appDataPath)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), OldExeSuffix) {
			os.Remove(filepath.Join(appDataPath, entry.Name()))
		}
	}
}

func getCurrentVersion(appDataPath string) (string, error) {
	versionFile := filepath.Join(appDataPath, VersionFileName)
	data, err := os.ReadFile(versionFile)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func getLatestRelease() (*ReleaseInfo, error) {
	url := ServerURL + VersionEndpoint

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to server: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	var release ReleaseInfo
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("failed to parse server response: %w", err)
	}

	if release.Version == "" || release.DownloadURL == "" {
		return nil, fmt.Errorf("server returned an incomplete release")
	}

	return &release, nil
}

// performUpdate downloads the release and swaps it into place.
//
// The install is a pair of renames within the install directory rather than a
// copy over the live binary. That matters twice over: an interrupted copy used
// to leave a truncated executable and no way back, and a copy fails outright
// when the client is already running, which silently stranded anyone who left
// the client open. A rename succeeds in both cases.
func performUpdate(appDataPath string, release *ReleaseInfo) error {
	staging := filepath.Join(appDataPath, StagingDirName)

	os.RemoveAll(staging)
	if err := os.MkdirAll(staging, 0755); err != nil {
		return fmt.Errorf("failed to create staging directory: %w", err)
	}
	defer os.RemoveAll(staging)

	zipPath := filepath.Join(staging, "client.zip")

	fmt.Println("Step 1/4: Downloading new client...")
	if err := downloadFile(zipPath, release.DownloadURL); err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	fmt.Println("Download complete!")

	fmt.Println("\nStep 2/4: Verifying download...")
	if err := verifyDownload(zipPath, release.Sha256); err != nil {
		return fmt.Errorf("verification failed: %w", err)
	}
	fmt.Println("Verification successful!")

	fmt.Println("\nStep 3/4: Extracting new client...")
	extractPath := filepath.Join(staging, "extracted")
	if err := extractZip(zipPath, extractPath); err != nil {
		return fmt.Errorf("extraction failed: %w", err)
	}
	fmt.Println("Extraction complete!")

	fmt.Println("\nStep 4/4: Installing new client...")
	newClientExe := findExecutableInDir(extractPath)
	if newClientExe == "" {
		return fmt.Errorf("could not find client executable in downloaded files")
	}

	clientPath := filepath.Join(appDataPath, ClientExecutable)
	replacedRunning, err := installExecutable(clientPath, newClientExe)
	if err != nil {
		return err
	}

	if err := os.WriteFile(filepath.Join(appDataPath, VersionFileName), []byte(release.Version), 0644); err != nil {
		fmt.Printf("Warning: Could not update version file: %v\n", err)
	}

	if replacedRunning {
		fmt.Println("\nNote: a client was already open. That window is still running the")
		fmt.Println("old version - close it and use the one about to open instead.")
	}

	return nil
}

// installExecutable moves newExe to clientPath, displacing whatever is there.
// It reports whether the replaced binary was still locked by a running
// process, which is the case worth telling the user about.
func installExecutable(clientPath, newExe string) (bool, error) {
	oldPath := clientPath + OldExeSuffix
	os.Remove(oldPath)

	existed := false
	if _, err := os.Stat(clientPath); err == nil {
		existed = true
		if err := os.Rename(clientPath, oldPath); err != nil {
			return false, fmt.Errorf("could not move the current client aside: %w", err)
		}
	}

	if err := os.Rename(newExe, clientPath); err != nil {
		if existed {
			// Put the working client back before giving up.
			if restoreErr := os.Rename(oldPath, clientPath); restoreErr != nil {
				return false, fmt.Errorf("install failed (%w) and the original client could not be restored from %s: %v", err, oldPath, restoreErr)
			}
		}
		return false, fmt.Errorf("failed to install new client: %w", err)
	}

	if !existed {
		return false, nil
	}

	// A successful delete means nothing held the file open. A failure means a
	// client is still running from it; it gets collected on the next run.
	stillRunning := os.Remove(oldPath) != nil
	return stillRunning, nil
}

func downloadFile(dest string, url string) error {
	client := &http.Client{
		Timeout: 10 * time.Minute,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server returned status %d for URL: %s", resp.StatusCode, url)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	totalBytes := resp.ContentLength
	downloaded := int64(0)
	lastPercent := -1

	buffer := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buffer)
		if n > 0 {
			if _, writeErr := out.Write(buffer[:n]); writeErr != nil {
				return writeErr
			}
			downloaded += int64(n)

			if totalBytes > 0 {
				percent := int(float64(downloaded) / float64(totalBytes) * 100)
				if percent != lastPercent && percent%10 == 0 {
					fmt.Printf("Progress: %d%% (%d MB / %d MB)\n",
						percent,
						downloaded/1024/1024,
						totalBytes/1024/1024)
					lastPercent = percent
				}
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}

	// A connection cut mid-transfer otherwise looks like a complete download
	// of a smaller file, and would go on to replace a working binary.
	if totalBytes > 0 && downloaded != totalBytes {
		return fmt.Errorf("download ended early (%d of %d bytes)", downloaded, totalBytes)
	}

	return out.Sync()
}

// verifyDownload checks the release before it is allowed to replace a working
// client. When the server publishes a digest this is a real integrity check;
// without one only the size is known, which still catches truncated downloads
// and error pages served in place of the file.
func verifyDownload(path string, expectedSha256 string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}

	if info.Size() < MinReleaseZipBytes {
		return fmt.Errorf("downloaded file is too small (%d bytes)", info.Size())
	}

	if expectedSha256 == "" {
		fmt.Println("(server published no checksum for this release; size checked only)")
		return nil
	}

	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return err
	}

	actual := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(actual, expectedSha256) {
		return fmt.Errorf("checksum mismatch (expected %s, got %s)", expectedSha256, actual)
	}

	return nil
}

// extractZip unpacks src into dest, rejecting entries that would escape the
// destination. Using archive/zip rather than shelling out to Expand-Archive
// keeps the bootstrapper working where PowerShell is locked down, and drops a
// process launch that antivirus tends to take an interest in.
func extractZip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}

	root, err := filepath.Abs(dest)
	if err != nil {
		return err
	}

	for _, f := range r.File {
		target := filepath.Join(root, filepath.FromSlash(f.Name))

		rel, err := filepath.Rel(root, target)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			return fmt.Errorf("release contains an unsafe path: %s", f.Name)
		}

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}

		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			rc.Close()
			return err
		}

		_, copyErr := io.Copy(out, rc)
		out.Close()
		rc.Close()
		if copyErr != nil {
			return copyErr
		}
	}

	return nil
}

func findExecutableInDir(dir string) string {
	var exePath string

	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".exe") {
			if strings.Contains(strings.ToLower(info.Name()), "calebsmod") {
				exePath = path
				return filepath.SkipAll
			}
		}
		return nil
	})

	return exePath
}

func launchClient(appDataPath string) {
	clientPath := filepath.Join(appDataPath, ClientExecutable)

	if _, err := os.Stat(clientPath); err != nil {
		fmt.Printf("Warning: Client executable not found at %s\n", clientPath)
		return
	}

	// Make the client findable from the Start menu. This runs on every launch
	// so that installs predating the feature pick it up, and a deleted
	// shortcut comes back; it is a no-op once the shortcut is in place.
	if err := ensureClientShortcut(clientPath); err != nil {
		fmt.Printf("Note: could not create the Start Menu shortcut: %v\n", err)
	}

	cmd := exec.Command(clientPath)
	cmd.Dir = appDataPath

	if err := cmd.Start(); err != nil {
		fmt.Printf("Warning: Failed to launch client: %v\n", err)
		fmt.Println("You can manually launch the client from:")
		fmt.Println(clientPath)
		return
	}

	fmt.Println("Client launched successfully!")
}

func waitForUser() {
	fmt.Println("\nPress Enter to exit...")
	fmt.Scanln()
}
