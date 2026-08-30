package go_services

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	// The staging directory sits next to the running executable so that every
	// rename during the swap stays on one volume and is therefore atomic. A
	// staging directory in %TEMP% can land on a different drive, where
	// os.Rename degrades to a copy and stops being crash-safe.
	updateStagingDir = ".calebsmod-update"

	// Windows refuses to delete a running executable but allows renaming it,
	// which is what makes an in-process self-update possible at all. The
	// displaced binary keeps this suffix until a later launch can remove it.
	oldExeSuffix = ".old"

	versionFileName = "CurrentCalebModClientVersion.txt"

	updateDownloadTimeout = 10 * time.Minute

	// A release smaller than this is a truncated download or an error page,
	// never a real Wails build.
	minReleaseZipBytes = 1024 * 1024
)

// ReleaseInfo is the payload of /api/server/latest-client-release. Sha256 is
// optional: releases uploaded before the server started publishing a digest
// have none, and those fall back to the size check alone.
type ReleaseInfo struct {
	Version     string `json:"version"`
	DownloadURL string `json:"downloadUrl"`
	Sha256      string `json:"sha256,omitempty"`
}

// UpdateStatus describes how the running binary compares to the latest
// release. Supported is false when this build was not installed by the
// bootstrapper - a dev run or a hand-copied exe - where replacing the binary
// underneath the developer would be surprising rather than helpful.
type UpdateStatus struct {
	CurrentVersion  string `json:"currentVersion"`
	LatestVersion   string `json:"latestVersion"`
	UpdateAvailable bool   `json:"updateAvailable"`
	Supported       bool   `json:"supported"`
	Error           string `json:"error,omitempty"`
}

// UpdateProgress drives the update UI. Total is 0 while the size of the work
// is still unknown, which the frontend renders as an indeterminate bar.
type UpdateProgress struct {
	Phase string `json:"phase"`
	Done  int64  `json:"done"`
	Total int64  `json:"total"`
}

var updateProgressHandler func(UpdateProgress)

func SetUpdateProgressHandler(fn func(UpdateProgress)) {
	updateProgressHandler = fn
}

func reportUpdateProgress(phase string, done, total int64) {
	if updateProgressHandler != nil {
		updateProgressHandler(UpdateProgress{Phase: phase, Done: done, Total: total})
	}
}

// appDataDir is the directory the bootstrapper installs into. The version file
// lives here regardless of where the executable itself was started from, so
// the bootstrapper and the self-updater always read the same number.
func appDataDir() (string, error) {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return "", fmt.Errorf("LOCALAPPDATA is not set")
	}
	return filepath.Join(localAppData, "CalebsMod"), nil
}

func versionFilePath() (string, error) {
	dir, err := appDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, versionFileName), nil
}

// parseVersion splits the "X.YY" release format into comparable numbers.
func parseVersion(v string) (int, int, bool) {
	parts := strings.Split(strings.TrimSpace(v), ".")
	if len(parts) != 2 {
		return 0, 0, false
	}
	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, false
	}
	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, false
	}
	return major, minor, true
}

// isNewerVersion reports whether latest is strictly ahead of current. Ordering
// matters rather than plain inequality: pointing a client at a server that has
// rolled a release back should not prompt anyone to "update" downwards, and an
// unparseable version on either side means we stay quiet instead of guessing.
func isNewerVersion(current, latest string) bool {
	cMajor, cMinor, cOK := parseVersion(current)
	lMajor, lMinor, lOK := parseVersion(latest)
	if !cOK || !lOK {
		return false
	}
	if lMajor != cMajor {
		return lMajor > cMajor
	}
	return lMinor > cMinor
}

// FetchLatestRelease asks the server which client build is current.
func FetchLatestRelease() (ReleaseInfo, error) {
	var release ReleaseInfo

	resp, err := MakeGetRequest("/api/server/latest-client-release")
	if err != nil {
		return release, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return release, fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return release, fmt.Errorf("could not read the release info: %w", err)
	}
	if release.Version == "" || release.DownloadURL == "" {
		return release, fmt.Errorf("server returned an incomplete release")
	}
	return release, nil
}

// CheckForClientUpdate compares the installed version against the server. It
// reports failures in the returned struct rather than as an error: a client
// that cannot reach the server should still start and play offline, so the UI
// wants a status it can show quietly, not an exception.
func CheckForClientUpdate() UpdateStatus {
	status := UpdateStatus{CurrentVersion: GetClientVersion()}

	// No version file means the bootstrapper never installed this binary.
	status.Supported = status.CurrentVersion != "" && !IsRunningInDevMode()
	if !status.Supported {
		return status
	}

	release, err := FetchLatestRelease()
	if err != nil {
		status.Error = err.Error()
		return status
	}

	status.LatestVersion = release.Version
	status.UpdateAvailable = isNewerVersion(status.CurrentVersion, release.Version)
	return status
}

// currentExePath resolves the running binary, following any symlink so the
// swap targets the real file rather than a link to it.
func currentExePath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		return resolved, nil
	}
	return exe, nil
}

// ApplyClientUpdate downloads the latest release and replaces the running
// executable with it, returning the path to relaunch.
//
// The swap is the rename dance Windows allows on a running image: the live
// executable is renamed aside, the new one is renamed into its place, and the
// displaced file is deleted by a later launch once the process holding it has
// exited. Every step is a rename within one directory, so an interruption
// leaves either the old binary or the new one in place, never a half-written
// file - which is the failure the copy-over-the-top install could produce.
func ApplyClientUpdate() (string, error) {
	exePath, err := currentExePath()
	if err != nil {
		return "", fmt.Errorf("could not locate the running client: %w", err)
	}

	release, err := FetchLatestRelease()
	if err != nil {
		return "", err
	}

	current := GetClientVersion()
	if !isNewerVersion(current, release.Version) {
		return "", fmt.Errorf("no newer version to install (installed %s, server has %s)", current, release.Version)
	}

	installDir := filepath.Dir(exePath)
	staging := filepath.Join(installDir, updateStagingDir)

	os.RemoveAll(staging)
	if err := os.MkdirAll(staging, 0755); err != nil {
		return "", fmt.Errorf("could not create the update folder: %w", err)
	}
	defer os.RemoveAll(staging)

	zipPath := filepath.Join(staging, "client.zip")
	reportUpdateProgress("downloading", 0, 0)
	if err := downloadRelease(zipPath, release.DownloadURL); err != nil {
		return "", fmt.Errorf("download failed: %w", err)
	}

	reportUpdateProgress("verifying", 0, 0)
	if err := verifyReleaseZip(zipPath, release.Sha256); err != nil {
		return "", err
	}

	reportUpdateProgress("extracting", 0, 0)
	extractDir := filepath.Join(staging, "extracted")
	if err := extractZipSafely(zipPath, extractDir); err != nil {
		return "", fmt.Errorf("could not unpack the update: %w", err)
	}

	newExe := findClientExecutable(extractDir)
	if newExe == "" {
		return "", fmt.Errorf("the downloaded release did not contain %s", filepath.Base(exePath))
	}

	reportUpdateProgress("installing", 0, 0)
	if err := swapExecutable(exePath, newExe); err != nil {
		return "", err
	}

	if err := writeInstalledVersion(release.Version); err != nil {
		// The new binary is already in place, so the update did happen. A
		// stale version file only means the next check offers the same update
		// again, which is recoverable; failing here is not.
		fmt.Printf("Warning: could not record the new version: %v\n", err)
	}

	// A user who only ever updates from inside the app never re-runs the
	// bootstrapper, so this is the point where a pre-shortcut install, or one
	// whose shortcut was deleted, gets a Start Menu entry back. No-op once it
	// exists, and the target path is unchanged by the swap above.
	if err := EnsureClientShortcut(); err != nil {
		fmt.Printf("Note: could not create the Start Menu shortcut: %v\n", err)
	}

	reportUpdateProgress("done", 1, 1)
	return exePath, nil
}

// swapExecutable puts newExe at exePath, moving the running binary aside. On
// failure it restores the original so the user is never left without a client.
func swapExecutable(exePath, newExe string) error {
	oldPath := exePath + oldExeSuffix

	// A leftover from a previous update would block the rename below.
	os.Remove(oldPath)

	if err := os.Rename(exePath, oldPath); err != nil {
		return fmt.Errorf("could not move the current client aside: %w", err)
	}

	if err := os.Rename(newExe, exePath); err != nil {
		// Put the working client back before giving up.
		if restoreErr := os.Rename(oldPath, exePath); restoreErr != nil {
			return fmt.Errorf("update failed (%w) and the original client could not be restored from %s: %v", err, oldPath, restoreErr)
		}
		return fmt.Errorf("could not install the new client: %w", err)
	}

	return nil
}

func writeInstalledVersion(version string) error {
	path, err := versionFilePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(version), 0644)
}

// downloadRelease streams the release zip to disk, reporting progress so a
// slow connection does not look like a hang.
func downloadRelease(dest, url string) error {
	client := &http.Client{Timeout: updateDownloadTimeout}

	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	total := resp.ContentLength
	var done int64
	buf := make([]byte, 64*1024)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := out.Write(buf[:n]); writeErr != nil {
				return writeErr
			}
			done += int64(n)
			reportUpdateProgress("downloading", done, total)
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return readErr
		}
	}

	// A connection cut mid-transfer otherwise looks like a complete download
	// of a smaller file, and would go on to replace a working binary.
	if total > 0 && done != total {
		return fmt.Errorf("download ended early (%d of %d bytes)", done, total)
	}

	return out.Sync()
}

// verifyReleaseZip checks the download before anything is allowed to replace a
// working binary. When the server publishes a digest this is a real integrity
// check; without one only the size is known, which still catches truncated
// downloads and error pages served in place of the file.
func verifyReleaseZip(path, expectedSha256 string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if info.Size() < minReleaseZipBytes {
		return fmt.Errorf("the downloaded update is too small (%d bytes) to be a real release", info.Size())
	}

	if expectedSha256 == "" {
		return nil
	}

	actual, err := hashFile(path)
	if err != nil {
		return fmt.Errorf("could not checksum the download: %w", err)
	}
	if !strings.EqualFold(actual, expectedSha256) {
		return fmt.Errorf("the downloaded update is corrupt (expected checksum %s, got %s)", expectedSha256, actual)
	}
	return nil
}

// extractZipSafely unpacks src into dest, rejecting entries that would escape
// the destination directory.
func extractZipSafely(src, dest string) error {
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

		// Reject "../" entries: a release zip arrives over the network and
		// must not be able to write outside the folder chosen for it.
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

// findClientExecutable locates the client binary inside an extracted release,
// tolerating the extra top-level folder some zip tools introduce.
func findClientExecutable(dir string) string {
	var found string

	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		name := strings.ToLower(info.Name())
		if strings.HasSuffix(name, ".exe") && strings.Contains(name, "calebsmod") {
			found = path
			return filepath.SkipAll
		}
		return nil
	})

	return found
}

// CleanupStaleUpdateFiles removes what a previous update left behind. It runs
// at startup and ignores every failure: right after a self-update the old
// binary is still held open by the process that launched this one, so the
// delete is expected to fail once and to succeed on the launch after.
func CleanupStaleUpdateFiles() {
	exePath, err := currentExePath()
	if err != nil {
		return
	}

	installDir := filepath.Dir(exePath)
	os.RemoveAll(filepath.Join(installDir, updateStagingDir))

	entries, err := os.ReadDir(installDir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), oldExeSuffix) {
			os.Remove(filepath.Join(installDir, entry.Name()))
		}
	}
}

// RelaunchClient starts the freshly installed binary. The child is not tied to
// this process, so it keeps running once the old window closes.
func RelaunchClient(exePath string) error {
	cmd := exec.Command(exePath)
	cmd.Dir = filepath.Dir(exePath)
	return cmd.Start()
}
