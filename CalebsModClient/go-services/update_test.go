package go_services

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestIsNewerVersion(t *testing.T) {
	cases := []struct {
		current string
		latest  string
		want    bool
		why     string
	}{
		{"0.09", "0.10", true, "minor bump"},
		{"0.99", "1.00", true, "major rollover"},
		{"0.10", "0.10", false, "same version must not prompt"},
		{"0.10", "0.09", false, "a server rollback must not prompt an update downwards"},
		{"1.00", "0.99", false, "major rollback"},
		{"", "0.10", false, "no installed version means this build was not installed by the bootstrapper"},
		{"0.10", "", false, "empty server version"},
		{"dev", "0.10", false, "unparseable current version stays quiet rather than guessing"},
		{"0.10", "latest", false, "unparseable server version stays quiet"},
		{"0.9", "0.10", true, "9 < 10 numerically, even though \"0.9\" sorts after \"0.10\" as a string"},
	}

	for _, c := range cases {
		if got := isNewerVersion(c.current, c.latest); got != c.want {
			t.Errorf("isNewerVersion(%q, %q) = %v, want %v — %s", c.current, c.latest, got, c.want, c.why)
		}
	}
}

// swapExecutable is the heart of the self-update, so both its success path and
// its rollback are worth pinning down.
func TestSwapExecutable(t *testing.T) {
	dir := t.TempDir()
	live := filepath.Join(dir, "client.exe")
	staged := filepath.Join(dir, "staged.exe")

	if err := os.WriteFile(live, []byte("OLD"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(staged, []byte("NEW"), 0755); err != nil {
		t.Fatal(err)
	}

	if err := swapExecutable(live, staged); err != nil {
		t.Fatalf("swapExecutable: %v", err)
	}

	got, err := os.ReadFile(live)
	if err != nil {
		t.Fatalf("reading swapped binary: %v", err)
	}
	if string(got) != "NEW" {
		t.Errorf("live binary = %q, want %q", got, "NEW")
	}

	// The displaced binary is kept, not deleted: on Windows it is still held
	// open by the running process and only a later launch can collect it.
	old, err := os.ReadFile(live + oldExeSuffix)
	if err != nil {
		t.Fatalf("displaced binary should be kept for later cleanup: %v", err)
	}
	if string(old) != "OLD" {
		t.Errorf("displaced binary = %q, want %q", old, "OLD")
	}
}

func TestSwapExecutableRestoresOriginalWhenStagedFileIsMissing(t *testing.T) {
	dir := t.TempDir()
	live := filepath.Join(dir, "client.exe")

	if err := os.WriteFile(live, []byte("OLD"), 0755); err != nil {
		t.Fatal(err)
	}

	err := swapExecutable(live, filepath.Join(dir, "does-not-exist.exe"))
	if err == nil {
		t.Fatal("expected an error when the staged binary is missing")
	}

	// The user must never be left without a client because an update failed.
	got, readErr := os.ReadFile(live)
	if readErr != nil {
		t.Fatalf("original binary was not restored: %v", readErr)
	}
	if string(got) != "OLD" {
		t.Errorf("restored binary = %q, want %q", got, "OLD")
	}
}

func TestCleanupStaleUpdateFilesRemovesDisplacedBinaries(t *testing.T) {
	// CleanupStaleUpdateFiles works on the directory of the running binary,
	// which under `go test` is the test binary's own temp directory. Writing
	// the leftovers there exercises the real path selection rather than a
	// stubbed one.
	exe, err := currentExePath()
	if err != nil {
		t.Skipf("cannot resolve test binary path: %v", err)
	}
	dir := filepath.Dir(exe)

	stale := filepath.Join(dir, "CalebsModClient.exe"+oldExeSuffix)
	if err := os.WriteFile(stale, []byte("OLD"), 0644); err != nil {
		t.Skipf("cannot write into the test binary's directory: %v", err)
	}
	t.Cleanup(func() { os.Remove(stale) })

	staging := filepath.Join(dir, updateStagingDir)
	if err := os.MkdirAll(staging, 0755); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(staging) })

	CleanupStaleUpdateFiles()

	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Error("a displaced .old binary should have been swept")
	}
	if _, err := os.Stat(staging); !os.IsNotExist(err) {
		t.Error("the staging directory should have been swept")
	}
}

func writeTestZip(t *testing.T, path string, entries map[string]string) {
	t.Helper()

	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	w := zip.NewWriter(f)
	for name, body := range entries {
		e, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := e.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestExtractZipSafely(t *testing.T) {
	dir := t.TempDir()
	zipPath := filepath.Join(dir, "release.zip")
	writeTestZip(t, zipPath, map[string]string{
		"CalebsModClient.exe": "BINARY",
		"nested/readme.txt":   "hello",
	})

	dest := filepath.Join(dir, "out")
	if err := extractZipSafely(zipPath, dest); err != nil {
		t.Fatalf("extractZipSafely: %v", err)
	}

	got, err := os.ReadFile(filepath.Join(dest, "CalebsModClient.exe"))
	if err != nil || string(got) != "BINARY" {
		t.Errorf("extracted exe = %q, err = %v", got, err)
	}
	if _, err := os.Stat(filepath.Join(dest, "nested", "readme.txt")); err != nil {
		t.Errorf("nested entry not extracted: %v", err)
	}
}

// A release zip arrives over the network, so an entry that climbs out of the
// destination must be refused rather than written.
func TestExtractZipSafelyRejectsPathTraversal(t *testing.T) {
	dir := t.TempDir()
	zipPath := filepath.Join(dir, "evil.zip")
	writeTestZip(t, zipPath, map[string]string{
		"../escaped.txt": "should never be written",
	})

	dest := filepath.Join(dir, "out")
	err := extractZipSafely(zipPath, dest)
	if err == nil {
		t.Fatal("expected extraction to be refused")
	}
	if !strings.Contains(err.Error(), "unsafe path") {
		t.Errorf("unexpected error: %v", err)
	}

	if _, statErr := os.Stat(filepath.Join(dir, "escaped.txt")); !os.IsNotExist(statErr) {
		t.Error("the traversing entry escaped the destination directory")
	}
}

func TestFindClientExecutable(t *testing.T) {
	dir := t.TempDir()

	// Some zip tools wrap the payload in an extra top-level folder.
	nested := filepath.Join(dir, "CalebsModClient-0.10")
	if err := os.MkdirAll(nested, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(nested, "CalebsModClient.exe"), []byte("BINARY"), 0755); err != nil {
		t.Fatal(err)
	}

	found := findClientExecutable(dir)
	if filepath.Base(found) != "CalebsModClient.exe" {
		t.Errorf("findClientExecutable = %q, want the nested CalebsModClient.exe", found)
	}
}

func TestFindClientExecutableIgnoresUnrelatedBinaries(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "vcredist.exe"), []byte("x"), 0755); err != nil {
		t.Fatal(err)
	}

	if found := findClientExecutable(dir); found != "" {
		t.Errorf("findClientExecutable = %q, want empty for a release with no client binary", found)
	}
}

func TestVerifyReleaseZip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "release.zip")

	body := make([]byte, minReleaseZipBytes+16)
	for i := range body {
		body[i] = byte(i % 251)
	}
	if err := os.WriteFile(path, body, 0644); err != nil {
		t.Fatal(err)
	}

	sum := sha256.Sum256(body)
	digest := hex.EncodeToString(sum[:])

	if err := verifyReleaseZip(path, digest); err != nil {
		t.Errorf("matching checksum should verify: %v", err)
	}

	// Callers send whatever the server gave them; case must not decide whether
	// a good release is rejected.
	if err := verifyReleaseZip(path, strings.ToUpper(digest)); err != nil {
		t.Errorf("checksum comparison should be case-insensitive: %v", err)
	}

	if err := verifyReleaseZip(path, ""); err != nil {
		t.Errorf("a release with no published digest should fall back to the size check: %v", err)
	}

	err := verifyReleaseZip(path, strings.Repeat("a", 64))
	if err == nil || !strings.Contains(err.Error(), "corrupt") {
		t.Errorf("mismatched checksum should be refused, got %v", err)
	}
}

// A truncated download or an HTML error page served in place of the release
// must never be allowed to replace a working binary.
func TestVerifyReleaseZipRejectsTruncatedDownload(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "release.zip")
	if err := os.WriteFile(path, []byte("<html>403 Forbidden</html>"), 0644); err != nil {
		t.Fatal(err)
	}

	err := verifyReleaseZip(path, "")
	if err == nil || !strings.Contains(err.Error(), "too small") {
		t.Errorf("expected the size check to refuse a tiny file, got %v", err)
	}
}
