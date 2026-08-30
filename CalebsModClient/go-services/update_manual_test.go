package go_services

import (
	"os"
	"path/filepath"
	"testing"
)

// Manual check against the live server. Non-destructive: it points LOCALAPPDATA
// at a temp directory, so the real install and its version file are untouched.
// Run with: CALEBS_MOD_UPDATE_TEST=1 go test ./go-services -run TestCheckForClientUpdateManual -v
func TestCheckForClientUpdateManual(t *testing.T) {
	if os.Getenv("CALEBS_MOD_UPDATE_TEST") != "1" {
		t.Skip("set CALEBS_MOD_UPDATE_TEST=1 to run")
	}

	// Stand up a fake install whose version is deliberately behind, so the
	// server's current release always registers as an update.
	fakeAppData := t.TempDir()
	installDir := filepath.Join(fakeAppData, "CalebsMod")
	if err := os.MkdirAll(installDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(installDir, versionFileName), []byte("0.01"), 0644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("LOCALAPPDATA", fakeAppData)

	status := CheckForClientUpdate()
	t.Logf("current=%q latest=%q available=%v supported=%v err=%q",
		status.CurrentVersion, status.LatestVersion, status.UpdateAvailable, status.Supported, status.Error)

	if status.Error != "" {
		t.Fatalf("could not reach the server: %s", status.Error)
	}
	if !status.Supported {
		t.Fatal("a bootstrapper-installed client should support self-update")
	}
	if status.LatestVersion == "" {
		t.Fatal("server did not report a version")
	}
	if !status.UpdateAvailable {
		t.Fatalf("expected 0.01 to be behind the server's %s", status.LatestVersion)
	}

	// The release must also carry a usable download URL, since that is what
	// ApplyClientUpdate would fetch next.
	release, err := FetchLatestRelease()
	if err != nil {
		t.Fatalf("FetchLatestRelease: %v", err)
	}
	if release.DownloadURL == "" {
		t.Fatal("release has no download URL")
	}
	if release.Sha256 == "" {
		t.Log("NOTE: server published no sha256 for this release; the updater will fall back to the size check")
	} else {
		t.Logf("server published sha256=%s", release.Sha256)
	}
}
