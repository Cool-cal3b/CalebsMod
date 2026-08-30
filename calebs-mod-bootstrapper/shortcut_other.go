//go:build !windows && !darwin

package main

// ensureClientShortcut has no meaning on platforms with no convention for
// where an installed application advertises itself. The stub keeps the
// bootstrapper building on a Linux dev machine.
func ensureClientShortcut(string) error { return nil }
