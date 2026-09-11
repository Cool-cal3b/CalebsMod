//go:build windows

package go_services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCreateShortcutWithNotificationIdentity(t *testing.T) {
	target, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	shortcut := filepath.Join(t.TempDir(), "CalebsMod test.lnk")
	if err := createShortcut(shortcut, target, filepath.Dir(target), "test", target); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(shortcut); err != nil {
		t.Fatal(err)
	}
}
