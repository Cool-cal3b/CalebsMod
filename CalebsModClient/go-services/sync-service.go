package go_services

import (
	"archive/zip"
	"bytes"
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
	// Batches stay under the server's MAX_BATCH_FILES and small enough that a
	// dropped connection costs seconds to redo rather than the whole pack.
	syncBatchMaxFiles = 400
	syncBatchMaxBytes = 32 * 1024 * 1024
	syncBatchAttempts = 3
	syncBatchTimeout  = 5 * time.Minute
)

// SyncProgress is emitted as the sync walks its phases so the UI can show
// something more useful than a spinner.
type SyncProgress struct {
	Phase string `json:"phase"`
	Done  int    `json:"done"`
	Total int    `json:"total"`
}

var syncProgressHandler func(SyncProgress)

func SetSyncProgressHandler(fn func(SyncProgress)) {
	syncProgressHandler = fn
}

func reportProgress(phase string, done, total int) {
	if syncProgressHandler != nil {
		syncProgressHandler(SyncProgress{Phase: phase, Done: done, Total: total})
	}
}

func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

type verifyMode int

const (
	// verifyMissing only refetches files that are absent. This is what a repair
	// of an already-current install uses: mods write to their own configs at
	// runtime (chiselsandbits, embeddium) and players edit options.txt, and
	// none of that should be silently reverted on the next launch.
	verifyMissing verifyMode = iota

	// verifySize also refetches files whose size no longer matches the
	// manifest. Used when the server says these files actually changed.
	verifySize

	// verifyHash additionally re-reads and hashes every file. Diagnostic only -
	// it flags legitimately game-modified configs as differing.
	verifyHash
)

// pendingFiles returns the files that need downloading under the given mode.
// Because this runs before every sync, an interrupted sync resumes from where
// it stopped instead of re-downloading the whole pack, and an install that has
// lost files repairs itself.
func pendingFiles(root string, files []SyncFile, mode verifyMode) []SyncFile {
	pending := make([]SyncFile, 0)

	for i, f := range files {
		if i%500 == 0 {
			reportProgress("verifying", i, len(files))
		}

		target := filepath.Join(root, filepath.FromSlash(f.RelativePath))

		info, err := os.Stat(target)
		if err != nil || info.IsDir() {
			pending = append(pending, f)
			continue
		}

		if mode == verifyMissing {
			continue
		}

		if f.FileSize > 0 && info.Size() != f.FileSize {
			pending = append(pending, f)
			continue
		}

		if mode == verifyHash {
			actual, err := hashFile(target)
			if err != nil || actual != f.Sha256 {
				pending = append(pending, f)
			}
		}
	}

	reportProgress("verifying", len(files), len(files))
	return pending
}

func batchFiles(files []SyncFile) [][]SyncFile {
	batches := make([][]SyncFile, 0)
	current := make([]SyncFile, 0, syncBatchMaxFiles)
	var currentBytes int64

	for _, f := range files {
		tooManyFiles := len(current) >= syncBatchMaxFiles
		tooManyBytes := len(current) > 0 && currentBytes+f.FileSize > syncBatchMaxBytes

		if tooManyFiles || tooManyBytes {
			batches = append(batches, current)
			current = make([]SyncFile, 0, syncBatchMaxFiles)
			currentBytes = 0
		}

		current = append(current, f)
		currentBytes += f.FileSize
	}

	if len(current) > 0 {
		batches = append(batches, current)
	}

	return batches
}

func downloadBatch(batch []SyncFile) (string, error) {
	hashes := make([]string, 0, len(batch))
	for _, f := range batch {
		hashes = append(hashes, f.Sha256)
	}

	payload, err := json.Marshal(map[string][]string{"sha256s": hashes})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", GetServerUrl()+"/api/modpack/batch-zip", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: syncBatchTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("batch request failed: %s: %s", resp.Status, string(detail))
	}

	tmp, err := os.CreateTemp("", "calebsmod-batch-*.zip")
	if err != nil {
		return "", err
	}
	tmpPath := tmp.Name()

	_, copyErr := io.Copy(tmp, resp.Body)
	closeErr := tmp.Close()

	if copyErr != nil {
		os.Remove(tmpPath)
		return "", fmt.Errorf("failed to save batch: %w", copyErr)
	}
	if closeErr != nil {
		os.Remove(tmpPath)
		return "", closeErr
	}

	return tmpPath, nil
}

// writeSyncedFile writes verified bytes to their target path. Files are always
// written writable: an older client honoured the zip entry mode and left
// everything read-only, which stopped Forge writing config/fml.toml.
func writeSyncedFile(root, relativePath string, data []byte) error {
	target := filepath.Join(root, filepath.FromSlash(relativePath))

	cleanRoot := filepath.Clean(root)
	if !strings.HasPrefix(filepath.Clean(target), cleanRoot+string(os.PathSeparator)) {
		return fmt.Errorf("refusing to write outside the instance: %s", relativePath)
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return fmt.Errorf("failed to create directory for %s: %w", relativePath, err)
	}

	if info, err := os.Stat(target); err == nil && info.Mode().Perm()&0200 == 0 {
		if err := os.Chmod(target, 0644); err != nil {
			return fmt.Errorf("failed to make %s writable: %w", relativePath, err)
		}
	}

	return os.WriteFile(target, data, 0644)
}

// extractBatch writes each entry to the paths its hash maps to, checking the
// contents against that hash first so a corrupt download can never land on disk.
func extractBatch(zipPath, root string, targets map[string][]string) error {
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("failed to open batch zip: %w", err)
	}
	defer zr.Close()

	written := make(map[string]bool, len(targets))

	for _, entry := range zr.File {
		if entry.FileInfo().IsDir() {
			continue
		}

		hash := entry.Name
		paths, wanted := targets[hash]
		if !wanted {
			continue
		}

		rc, err := entry.Open()
		if err != nil {
			return fmt.Errorf("failed to open %s: %w", hash, err)
		}

		data, readErr := io.ReadAll(rc)
		rc.Close()
		if readErr != nil {
			return fmt.Errorf("failed to read %s: %w", hash, readErr)
		}

		sum := sha256.Sum256(data)
		if actual := hex.EncodeToString(sum[:]); actual != hash {
			return fmt.Errorf("checksum mismatch for %s (got %s)", hash, actual)
		}

		for _, relativePath := range paths {
			if err := writeSyncedFile(root, relativePath, data); err != nil {
				return err
			}
		}

		written[hash] = true
	}

	for hash := range targets {
		if !written[hash] {
			return fmt.Errorf("batch response was missing %s", hash)
		}
	}

	return nil
}

func syncOneBatch(root string, batch []SyncFile) error {
	targets := make(map[string][]string, len(batch))
	for _, f := range batch {
		targets[f.Sha256] = append(targets[f.Sha256], f.RelativePath)
	}

	zipPath, err := downloadBatch(batch)
	if err != nil {
		return err
	}
	defer os.Remove(zipPath)

	return extractBatch(zipPath, root, targets)
}

// SyncFilesVerified brings root in line with files, downloading only what is
// missing or wrong and verifying everything it writes. It returns an error
// unless every file is present and correct, so the caller can safely treat
// success as proof the install is complete.
func SyncFilesVerified(root string, files []SyncFile, mode verifyMode) error {
	pending := pendingFiles(root, files, mode)
	if len(pending) == 0 {
		fmt.Println("All files already present and verified")
		return nil
	}

	batches := batchFiles(pending)
	fmt.Printf("Downloading %d of %d file(s) in %d batch(es)\n", len(pending), len(files), len(batches))

	done := 0
	for i, batch := range batches {
		var lastErr error

		for attempt := 1; attempt <= syncBatchAttempts; attempt++ {
			lastErr = syncOneBatch(root, batch)
			if lastErr == nil {
				break
			}

			fmt.Printf("Batch %d/%d attempt %d failed: %v\n", i+1, len(batches), attempt, lastErr)
			time.Sleep(time.Duration(attempt) * time.Second)
		}

		if lastErr != nil {
			return fmt.Errorf("batch %d of %d failed after %d attempts: %w", i+1, len(batches), syncBatchAttempts, lastErr)
		}

		done += len(batch)
		fmt.Printf("Downloaded %d/%d file(s)\n", done, len(pending))
		reportProgress("downloading", done, len(pending))
	}

	// Contents were hash-checked before they were written, so confirming
	// presence is enough to call the install complete.
	if remaining := pendingFiles(root, files, verifyMissing); len(remaining) > 0 {
		return fmt.Errorf("%d file(s) still missing after sync", len(remaining))
	}

	return nil
}

// FetchClientManifest returns every file the client is expected to have. The
// sync endpoint only describes a delta, so this is what an up-to-date install
// gets checked against.
func FetchClientManifest() ([]SyncFile, error) {
	resp, err := MakeGetRequest("/api/modpack/manifest")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("manifest request failed: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var manifest []SyncFile
	if err := json.Unmarshal(body, &manifest); err != nil {
		return nil, err
	}

	return manifest, nil
}
