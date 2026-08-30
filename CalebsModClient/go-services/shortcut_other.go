//go:build !windows && !darwin

package go_services

// EnsureClientShortcut has no meaning on platforms with no convention for
// where an installed application advertises itself. The stub keeps the package
// building on a Linux dev machine.
func EnsureClientShortcut() error { return nil }
