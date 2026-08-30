//go:build !windows

package main

// ensureClientShortcut only has meaning on Windows, where the Start Menu is.
// The stub keeps the bootstrapper building on a non-Windows dev machine.
func ensureClientShortcut(string) error { return nil }
