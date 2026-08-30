package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	ServerURL       = "https://mc.calebwash.com"
	VersionEndpoint = "/api/server/latest-client-release"
	VersionFileName = "CurrentCalebModClientVersion.txt"

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

	dataPath, err := appDataPath()
	if err != nil {
		fmt.Printf("Error: Failed to determine the data directory: %v\n", err)
		waitForUser()
		os.Exit(1)
	}

	// On Windows these are the same folder. On macOS the client has to live in
	// ~/Applications to be launchable and searchable, while its state stays
	// under ~/Library, so they are two directories there.
	installedClient, err := clientPath()
	if err != nil {
		fmt.Printf("Error: Failed to determine the install directory: %v\n", err)
		waitForUser()
		os.Exit(1)
	}

	fmt.Printf("Data directory: %s\n", dataPath)
	fmt.Printf("Client:         %s\n", installedClient)
	fmt.Println()

	if err := os.MkdirAll(dataPath, 0755); err != nil {
		fmt.Printf("Error: Failed to create the data directory: %v\n", err)
		waitForUser()
		os.Exit(1)
	}

	if err := os.MkdirAll(filepath.Dir(installedClient), 0755); err != nil {
		fmt.Printf("Error: Failed to create the install directory: %v\n", err)
		waitForUser()
		os.Exit(1)
	}

	// Sweep whatever a previous run or a client self-update left behind before
	// doing anything else, so leftovers cannot accumulate across releases.
	cleanupLeftovers(dataPath, installedClient)

	currentVersion, err := getCurrentVersion(dataPath)
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
		launchClient(installedClient, dataPath)
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
	if currentVersion == release.Version && clientIsInstalled(installedClient) {
		fmt.Println("You are running the latest version!")
		fmt.Println("Launching client...")
		launchClient(installedClient, dataPath)
		os.Exit(0)
	}

	if currentVersion == release.Version {
		fmt.Println("Version is current but the client is missing - reinstalling...")
	} else {
		fmt.Printf("Update available: %s -> %s\n", currentVersion, release.Version)
	}
	fmt.Println("Starting update process...")
	fmt.Println()

	if err := performUpdate(dataPath, installedClient, release); err != nil {
		fmt.Printf("Error: Update failed: %v\n", err)
		fmt.Println("\nAttempting to launch existing client...")
		launchClient(installedClient, dataPath)
		waitForUser()
		os.Exit(1)
	}

	fmt.Println()
	fmt.Println("Update completed successfully!")
	fmt.Println("Launching client...")
	launchClient(installedClient, dataPath)
	os.Exit(0)
}

// cleanupLeftovers deletes the scratch files an install can leave behind. The
// ".old" sweep is what keeps a user from accumulating one stale binary per
// release: the client's self-update renames its own running image aside and
// cannot delete it while it is still running, so somebody has to collect it
// later, and the bootstrapper always runs with no client of its own to hold
// the file open. Failures are ignored - an old client that happens to be open
// right now is collected on the next run instead.
//
// Both directories are swept because they are only the same folder on Windows;
// on macOS the staging directory sits beside the bundle in ~/Applications while
// the version file stays under ~/Library.
func cleanupLeftovers(dataPath, installedClient string) {
	installDir := filepath.Dir(installedClient)

	for _, dir := range distinct(dataPath, installDir) {
		os.RemoveAll(filepath.Join(dir, StagingDirName))

		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			// No IsDir() guard: on macOS the displaced install is a whole .app
			// bundle, so skipping directories would leak one per update.
			if strings.HasSuffix(entry.Name(), OldExeSuffix) {
				os.RemoveAll(filepath.Join(dir, entry.Name()))
			}
		}
	}

	// Scratch paths used by earlier bootstrapper versions. Windows-only by
	// definition - no Mac client has ever run one of those.
	os.RemoveAll(filepath.Join(dataPath, "client_new"))
	os.RemoveAll(filepath.Join(dataPath, "client_old"))
	os.Remove(filepath.Join(dataPath, "client.zip"))
	os.Remove(filepath.Join(dataPath, "client.zip.download"))
	os.Remove(filepath.Join(dataPath, "client.zip.download.sha256"))
}

// distinct returns the given paths with duplicates dropped, so a caller can
// treat "one directory" and "two directories" uniformly.
func distinct(paths ...string) []string {
	var out []string
	for _, p := range paths {
		seen := false
		for _, existing := range out {
			if existing == p {
				seen = true
				break
			}
		}
		if !seen {
			out = append(out, p)
		}
	}
	return out
}

func getCurrentVersion(dataPath string) (string, error) {
	versionFile := filepath.Join(dataPath, VersionFileName)
	data, err := os.ReadFile(versionFile)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func getLatestRelease() (*ReleaseInfo, error) {
	url := ServerURL + versionEndpoint()

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
func performUpdate(dataPath, installedClient string, release *ReleaseInfo) error {
	// Staging sits beside the install target, not in the data directory, so
	// that the rename below stays within one directory and therefore one
	// volume. On macOS those are two different places.
	staging := filepath.Join(filepath.Dir(installedClient), StagingDirName)

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
	if err := extractRelease(zipPath, extractPath); err != nil {
		return fmt.Errorf("extraction failed: %w", err)
	}
	fmt.Println("Extraction complete!")

	fmt.Println("\nStep 4/4: Installing new client...")
	newClient := findClientInDir(extractPath)
	if newClient == "" {
		return fmt.Errorf("could not find the client in the downloaded files")
	}

	replacedRunning, err := installExecutable(installedClient, newClient)
	if err != nil {
		return err
	}

	if err := os.WriteFile(filepath.Join(dataPath, VersionFileName), []byte(release.Version), 0644); err != nil {
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
// Every removal here is RemoveAll rather than Remove, because on macOS the
// thing being displaced is an .app bundle - a directory - and Remove refuses
// those.
func installExecutable(clientPath, newExe string) (bool, error) {
	oldPath := clientPath + OldExeSuffix
	os.RemoveAll(oldPath)

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
	//
	// This inference is Windows-only. macOS happily deletes a bundle that is
	// currently executing, so a failure there means something genuinely wrong
	// rather than "a client is open", and reporting it as the latter would
	// print a confusing warning after every single Mac update.
	failedToDelete := os.RemoveAll(oldPath) != nil
	return failedToDelete && !canDeleteRunningClient(), nil
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

func launchClient(clientPath, workingDir string) {
	if _, err := os.Stat(clientPath); err != nil {
		fmt.Printf("Warning: Client not found at %s\n", clientPath)
		return
	}

	// Make the client findable from the Start menu (Windows) or Spotlight
	// (macOS). This runs on every launch so that installs predating the
	// feature pick it up, and a deleted shortcut comes back; it is a no-op
	// once the entry is in place.
	if err := ensureClientShortcut(clientPath); err != nil {
		fmt.Printf("Note: could not register the client for search: %v\n", err)
	}

	if err := launchInstalledClient(clientPath, workingDir); err != nil {
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
