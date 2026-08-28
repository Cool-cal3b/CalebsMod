package go_services

import (
	"os"
	"testing"
)

// Manual end-to-end check. Destructive: wipes and repopulates the local instance.
// Run with: CALEBS_MOD_RESET_TEST=1 go test ./go-services -run TestResetClientManual -v -timeout 30m
func TestResetClientManual(t *testing.T) {
	if os.Getenv("CALEBS_MOD_RESET_TEST") != "1" {
		t.Skip("set CALEBS_MOD_RESET_TEST=1 to run")
	}

	ok, err := ResetClient()
	if err != nil {
		t.Fatalf("ResetClient failed: %v", err)
	}
	if !ok {
		t.Fatal("ResetClient returned false")
	}
	t.Log("ResetClient completed")
}
