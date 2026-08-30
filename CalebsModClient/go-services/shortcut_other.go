//go:build !windows

package go_services

// EnsureClientShortcut is a no-op off Windows, where there is no Start Menu.
func EnsureClientShortcut() error { return nil }
