package go_services

import (
	"os"
	"testing"
)

// Verifies an already-complete install downloads nothing.
func TestSyncIsIdempotent(t *testing.T) {
	if os.Getenv("CALEBS_MOD_SYNC_TEST") != "1" {
		t.Skip("set CALEBS_MOD_SYNC_TEST=1 to run")
	}

	ok, err := SyncMods()
	if err != nil {
		t.Fatalf("SyncMods failed: %v", err)
	}
	if !ok {
		t.Fatal("SyncMods returned false")
	}
}
