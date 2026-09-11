//go:build windows

package notificationagent

import (
	"bytes"
	"testing"
)

func TestDPAPIRoundTrip(t *testing.T) {
	want := []byte("one-time-device-token")
	encoded, err := protect(want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := unprotect(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("unprotected token = %q, want %q", got, want)
	}
}

func TestDefaultNotificationSettings(t *testing.T) {
	settings := defaultPersisted().Settings
	if !settings.StartWithWindows || !settings.DirectPings {
		t.Fatal("startup and direct pings should default on")
	}
	if settings.PlayerJoined || settings.PlayerLeft {
		t.Fatal("future join/leave notifications should default off")
	}
}
