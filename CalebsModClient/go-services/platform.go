package go_services

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// Everything in this file exists because the same concept has a different
// spelling on each OS. The rule followed throughout: the caller names the
// concept ("the Prism executable", "the game directory") and this file decides
// what that is on the running platform. Nothing outside this file should be
// comparing runtime.GOOS to pick a filename.

const (
	// What the client is installed as. On Windows this is a file; on macOS an
	// .app is a directory, which is the single fact behind most of the darwin
	// special-casing in the updater and the bootstrapper.
	//
	// This is deliberately not tied to whatever `wails build` happens to emit:
	// the installer takes the bundle out of the release zip and puts it here
	// under this name, so renaming the Wails product later cannot strand an
	// installed client at a path nothing looks for.
	ClientExeNameWindows = "CalebsModClient.exe"
	ClientAppNameDarwin  = "CalebsModClient.app"
)

// ClientAppName is the name the installed client carries on disk.
func ClientAppName() string {
	if runtime.GOOS == "darwin" {
		return ClientAppNameDarwin
	}
	return ClientExeNameWindows
}

// AppDataDir is where installed-client state lives: the version file both
// updaters read, and the PrismLauncher install underneath it. It is the
// directory the bootstrapper owns.
//
// On Windows this is also where the client executable itself sits. On macOS it
// is not - an .app has to live in an Applications folder to be launchable and
// searchable - so the two paths are separate concepts there. See InstallDir.
func AppDataDir() (string, error) {
	switch runtime.GOOS {
	case "windows":
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			return "", fmt.Errorf("LOCALAPPDATA is not set")
		}
		return filepath.Join(localAppData, "CalebsMod"), nil
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, "Library", "Application Support", "CalebsMod"), nil
	case "linux":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, ".local", "share", "CalebsMod"), nil
	default:
		return "", fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}
}

// InstallDir is the directory the client binary or bundle is installed into.
//
// On macOS that is ~/Applications, which is the whole Spotlight story: an .app
// in an Applications folder is indexed and appears in search with no shortcut,
// alias or link involved. ~/Applications specifically, rather than
// /Applications, because it needs no admin rights.
func InstallDir() (string, error) {
	if runtime.GOOS == "darwin" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, "Applications"), nil
	}
	return AppDataDir()
}

// InstalledClientPath is the full path the client is installed at.
func InstalledClientPath() (string, error) {
	dir, err := InstallDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, ClientAppName()), nil
}

// ReleasePlatform is the value the server's /api/server/latest-client-release
// endpoint expects for this OS. Empty means "send no platform parameter",
// which the server resolves to Windows - the behaviour every bootstrapper
// released before macOS support depends on.
func ReleasePlatform() string {
	if runtime.GOOS == "darwin" {
		return "mac"
	}
	return ""
}

// LatestReleaseEndpoint is the release endpoint including the platform query
// for the running OS.
func LatestReleaseEndpoint() string {
	const base = "/api/server/latest-client-release"
	if p := ReleasePlatform(); p != "" {
		return base + "?platform=" + p
	}
	return base
}

// --- PrismLauncher layout ----------------------------------------------------

// PrismExecutablePath is the binary to exec to launch Prism, given the
// directory Prism was installed into. On macOS the download is an .app bundle,
// so the executable is buried inside it.
//
// The inner Mach-O is invoked directly rather than through `open`, because
// every call site passes Prism the -d/-l/-s flags and wants a child process it
// can start; `open` would hand the arguments off to LaunchServices instead.
func PrismExecutablePath(prismPath string) string {
	switch runtime.GOOS {
	case "windows":
		return filepath.Join(prismPath, "prismlauncher.exe")
	case "darwin":
		return filepath.Join(prismPath, "Prism Launcher.app", "Contents", "MacOS", "prismlauncher")
	default:
		return filepath.Join(prismPath, "PrismLauncher")
	}
}

// GameRootPath resolves an instance directory to the folder Prism actually
// puts the game in. Prism names it "minecraft" on Windows and ".minecraft" on
// macOS and Linux.
//
// The OS-native name is tried first, so an instance that also carries a
// leftover directory in the other spelling - an older client build seeded an
// empty ".minecraft" alongside the real "minecraft" on Windows - still
// resolves to the one Prism actually uses. The non-native spelling is only
// accepted when it is the sole directory present, which keeps an instance
// created by a Prism build that disagrees readable instead of being reported
// as an empty install. A brand new instance falls through to the per-OS
// default.
func GameRootPath(instancePath string) string {
	dotted := filepath.Join(instancePath, ".minecraft")
	plain := filepath.Join(instancePath, "minecraft")

	preferred, fallback := plain, dotted
	if runtime.GOOS != "windows" {
		preferred, fallback = dotted, plain
	}

	if info, err := os.Stat(preferred); err == nil && info.IsDir() {
		return preferred
	}
	if info, err := os.Stat(fallback); err == nil && info.IsDir() {
		return fallback
	}
	return preferred
}

// --- Process control ---------------------------------------------------------

// KillPrismLauncher stops a running PrismLauncher so its file locks are
// released. Reset and delete both need this: Prism holds the instance
// directory open while it runs, and a removal part-way through leaves an
// instance that is neither the old one nor a clean slate.
//
// A launcher that was not running is not an error.
func KillPrismLauncher() error {
	switch runtime.GOOS {
	case "windows":
		cmd := exec.Command("taskkill", "/F", "/IM", "prismlauncher.exe")
		output, err := cmd.CombinedOutput()
		if err != nil {
			if strings.Contains(string(output), "not found") {
				return nil
			}
			return fmt.Errorf("taskkill failed: %w, output: %s", err, string(output))
		}
		return nil
	case "darwin", "linux":
		// pkill exits 1 when nothing matched, which is the common case here.
		cmd := exec.Command("pkill", "-f", "[Pp]rism[ ]?[Ll]auncher")
		output, err := cmd.CombinedOutput()
		if err == nil {
			return nil
		}
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			return nil
		}
		return fmt.Errorf("pkill failed: %w, output: %s", err, string(output))
	default:
		return fmt.Errorf("stopping PrismLauncher is not supported on %s", runtime.GOOS)
	}
}

// LaunchApp starts an installed client. On macOS the install is a bundle and
// cannot be exec'd directly; `open -n` asks LaunchServices to start a new
// instance of it, which is also what gives the app its dock entry and
// activation behaviour.
func LaunchApp(path string) error {
	if runtime.GOOS == "darwin" {
		return exec.Command("open", "-n", path).Start()
	}
	cmd := exec.Command(path)
	cmd.Dir = filepath.Dir(path)
	return cmd.Start()
}

// --- Archive extraction ------------------------------------------------------

// ExtractArchive unpacks a downloaded archive, dispatching on its extension.
//
// The extractor is platform-dependent for a reason that is easy to miss until
// something mysteriously will not launch: a macOS .app bundle contains
// symlinks (Contents/Frameworks/.../Versions/Current) and depends on the
// executable bit surviving. Go's archive/zip restores neither reliably, so it
// produces a bundle that extracts without error and is then rejected by
// LaunchServices. `ditto` and `tar` are system binaries on every Mac and get
// both right.
func ExtractArchive(src, dest string) error {
	lower := strings.ToLower(src)

	switch {
	case strings.HasSuffix(lower, ".tar.gz"), strings.HasSuffix(lower, ".tgz"):
		return extractTarGz(src, dest)
	default:
		return ExtractZip(src, dest)
	}
}

// ExtractZip unpacks a zip, preserving bundle structure on macOS.
func ExtractZip(src, dest string) error {
	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}

	if runtime.GOOS == "darwin" {
		// ditto is handed an archive that arrived over the network, so the
		// entry names are checked for traversal first rather than trusting it
		// to refuse them. The Go extractor below makes the same check inline.
		if err := assertZipEntriesAreContained(src); err != nil {
			return err
		}
		cmd := exec.Command("/usr/bin/ditto", "-x", "-k", src, dest)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("ditto failed to extract %s: %w (%s)", filepath.Base(src), err, strings.TrimSpace(string(output)))
		}
		return nil
	}

	return extractZipWithGo(src, dest)
}

func extractTarGz(src, dest string) error {
	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}
	// -P is deliberately NOT passed, so tar strips leading slashes and refuses
	// to write through ".." components.
	cmd := exec.Command("tar", "-xzf", src, "-C", dest)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("tar failed to extract %s: %w (%s)", filepath.Base(src), err, strings.TrimSpace(string(output)))
	}
	return nil
}

// assertZipEntriesAreContained rejects an archive containing any entry that
// would be written outside dest. Used ahead of an external extractor, which
// gives no such guarantee of its own.
func assertZipEntriesAreContained(src string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		if !pathIsContained(filepath.FromSlash(f.Name)) {
			return fmt.Errorf("archive contains an unsafe path: %s", f.Name)
		}
	}
	return nil
}

// pathIsContained reports whether a relative archive entry name stays inside
// the directory it is extracted into.
func pathIsContained(name string) bool {
	if filepath.IsAbs(name) {
		return false
	}
	cleaned := filepath.Clean(name)
	if cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(os.PathSeparator)) {
		return false
	}
	return true
}

// extractZipWithGo is the dependency-free extractor used where bundle
// semantics do not apply.
func extractZipWithGo(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	root, err := filepath.Abs(dest)
	if err != nil {
		return err
	}

	for _, f := range r.File {
		target := filepath.Join(root, filepath.FromSlash(f.Name))

		// Reject "../" entries: a release zip arrives over the network and
		// must not be able to write outside the folder chosen for it.
		rel, err := filepath.Rel(root, target)
		if err != nil || !pathIsContained(rel) {
			return fmt.Errorf("archive contains an unsafe path: %s", f.Name)
		}

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}

		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			rc.Close()
			return err
		}

		_, copyErr := io.Copy(out, rc)
		out.Close()
		rc.Close()
		if copyErr != nil {
			return copyErr
		}
	}

	return nil
}
