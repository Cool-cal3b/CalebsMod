//go:build darwin

package go_services

import (
	"fmt"
	"os"
)

// EnsureClientShortcut is the macOS counterpart to the Windows Start Menu
// .lnk, and it is deliberately almost nothing.
//
// Spotlight indexes ~/Applications, so an .app installed there is findable by
// name with no shortcut, alias or symlink involved - which is why the installer
// puts the client there in the first place (see InstallDir). There is no second
// artifact to create and therefore nothing to repair when a user deletes one.
//
// What is left is making sure the folder exists at all: ~/Applications is not
// present by default on a fresh macOS account, and the installer needs
// somewhere to put the bundle. /Applications is deliberately not used - writing
// there needs an admin prompt, and this whole install path is built to need no
// elevation.
//
// Failures are returned for the caller to log and shrug off, matching the
// Windows behaviour: a missing search entry must never break launching.
func EnsureClientShortcut() error {
	dir, err := InstallDir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("could not create %s: %w", dir, err)
	}
	return nil
}
