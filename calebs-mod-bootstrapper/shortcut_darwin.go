//go:build darwin

package main

import (
	"fmt"
	"os"
	"path/filepath"
)

// ensureClientShortcut is the macOS counterpart to the Windows Start Menu
// .lnk, and it is deliberately almost nothing.
//
// Spotlight indexes ~/Applications, so an .app installed there is findable by
// name with no shortcut, alias or symlink involved - which is why the client is
// installed there in the first place (see installPath). There is no second
// artifact to create, and therefore nothing to repair when a user deletes one.
//
// What remains is making sure the folder exists: ~/Applications is not present
// by default on a fresh macOS account. /Applications is deliberately not used -
// writing there needs an admin prompt, and this whole install path is built to
// need no elevation.
func ensureClientShortcut(clientPath string) error {
	if _, err := os.Stat(clientPath); err != nil {
		return fmt.Errorf("client not found at %s: %w", clientPath, err)
	}
	return os.MkdirAll(filepath.Dir(clientPath), 0o755)
}
