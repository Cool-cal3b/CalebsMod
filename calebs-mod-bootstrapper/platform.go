package main

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

// The bootstrapper is its own module with no dependencies - that is the whole
// point of it, since it is the one binary a friend downloads and runs by hand.
// So it carries its own copy of the platform rules rather than importing the
// client's. The two must agree; if you change a path here, change it in
// CalebsModClient/go-services/platform.go too.

const (
	clientExeNameWindows = "CalebsModClient.exe"
	clientAppNameDarwin  = "CalebsModClient.app"
)

// clientAppName is what the installed client is called on disk. On macOS this
// is an .app bundle, which is a *directory* - the single fact behind most of
// the darwin branches below.
func clientAppName() string {
	if runtime.GOOS == "darwin" {
		return clientAppNameDarwin
	}
	return clientExeNameWindows
}

// appDataPath is where the bootstrapper keeps its own state: the version file,
// and the PrismLauncher install the client puts underneath it.
func appDataPath() (string, error) {
	switch runtime.GOOS {
	case "windows":
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			return "", fmt.Errorf("LOCALAPPDATA environment variable not set")
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

// installPath is the directory the client itself is installed into.
//
// On Windows this is the same folder as the state above, which is why the
// original bootstrapper only ever needed one path. On macOS they are
// necessarily different: a bundle has to sit in an Applications folder to be
// launchable and to appear in Spotlight, and ~/Applications is the one that
// needs no admin rights.
func installPath() (string, error) {
	if runtime.GOOS == "darwin" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, "Applications"), nil
	}
	return appDataPath()
}

// clientPath is the full path the client is installed at.
func clientPath() (string, error) {
	dir, err := installPath()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, clientAppName()), nil
}

// versionEndpoint is the release endpoint for this platform. Windows sends no
// platform parameter at all, which is what every bootstrapper released before
// macOS support did and what the server still treats as Windows.
func versionEndpoint() string {
	if runtime.GOOS == "darwin" {
		return VersionEndpoint + "?platform=mac"
	}
	return VersionEndpoint
}

// clientIsInstalled reports whether a usable client is already in place.
//
// The size floor exists to reject a truncated download that left a stub
// behind. On macOS the install is a directory, so the check moves inside the
// bundle to the executable it must contain - stat'ing the bundle itself would
// measure a directory entry and tell us nothing.
func clientIsInstalled(path string) bool {
	if runtime.GOOS == "darwin" {
		info, err := os.Stat(path)
		if err != nil || !info.IsDir() {
			return false
		}
		return bundleExecutable(path) != ""
	}

	info, err := os.Stat(path)
	return err == nil && !info.IsDir() && info.Size() >= MinReleaseZipBytes
}

// bundleExecutable returns the path of the Mach-O inside an .app, or empty if
// the bundle has no executable - which is what a bundle extracted by something
// that dropped the executable bit looks like.
func bundleExecutable(appPath string) string {
	macOSDir := filepath.Join(appPath, "Contents", "MacOS")
	entries, err := os.ReadDir(macOSDir)
	if err != nil {
		return ""
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.Mode()&0111 != 0 && info.Size() >= MinReleaseZipBytes {
			return filepath.Join(macOSDir, entry.Name())
		}
	}
	return ""
}

// findClientInDir locates the client inside an extracted release, tolerating
// the extra top-level folder some zip tools introduce.
//
// On macOS the target is a directory, so unlike the Windows search this cannot
// skip directories - it looks for them.
func findClientInDir(dir string) string {
	var found string
	wantBundle := runtime.GOOS == "darwin"

	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		name := strings.ToLower(info.Name())

		if wantBundle {
			if info.IsDir() && strings.HasSuffix(name, ".app") && strings.Contains(name, "calebsmod") {
				found = path
				return filepath.SkipAll
			}
			return nil
		}

		if info.IsDir() {
			return nil
		}
		if strings.HasSuffix(name, ".exe") && strings.Contains(name, "calebsmod") {
			found = path
			return filepath.SkipAll
		}
		return nil
	})

	return found
}

// launchClient starts the installed client.
//
// A macOS .app cannot be exec'd directly - it is a directory. `open -n` hands
// it to LaunchServices, which is also what gives it a dock icon and focus.
func launchInstalledClient(path, workingDir string) error {
	if runtime.GOOS == "darwin" {
		return exec.Command("open", "-n", path).Start()
	}

	cmd := exec.Command(path)
	cmd.Dir = workingDir
	return cmd.Start()
}

// canDeleteRunningClient reports whether the OS allows removing the client
// binary while a copy of it is running.
//
// Windows does not, which is the entire reason the install is a rename rather
// than a copy, and why a displaced ".old" file has to be collected on a later
// run. macOS does, so there is nothing to warn a Mac user about and nothing
// left behind to sweep.
func canDeleteRunningClient() bool {
	return runtime.GOOS != "windows"
}

// extractRelease unpacks a downloaded release zip.
//
// On macOS this shells out to ditto instead of using archive/zip, and that is
// load-bearing rather than a preference: an .app bundle contains symlinks and
// depends on the executable bit surviving, and archive/zip restores neither.
// Extracting a bundle with it produces no error and a client that will not
// launch. ditto is present on every Mac.
func extractRelease(src, dest string) error {
	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}

	if runtime.GOOS == "darwin" {
		// ditto is handed an archive that arrived over the network, so entry
		// names are checked for traversal first rather than trusting it to
		// refuse them. The Go extractor below makes the same check inline.
		if err := assertZipEntriesAreContained(src); err != nil {
			return err
		}
		cmd := exec.Command("/usr/bin/ditto", "-x", "-k", src, dest)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("ditto failed: %w (%s)", err, strings.TrimSpace(string(output)))
		}
		return nil
	}

	return extractZip(src, dest)
}

func assertZipEntriesAreContained(src string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		if !pathIsContained(filepath.FromSlash(f.Name)) {
			return fmt.Errorf("release contains an unsafe path: %s", f.Name)
		}
	}
	return nil
}

func pathIsContained(name string) bool {
	if filepath.IsAbs(name) {
		return false
	}
	cleaned := filepath.Clean(name)
	return cleaned != ".." && !strings.HasPrefix(cleaned, ".."+string(os.PathSeparator))
}

// extractZip unpacks src into dest, rejecting entries that would escape the
// destination. Using archive/zip rather than shelling out to Expand-Archive
// keeps the bootstrapper working where PowerShell is locked down, and drops a
// process launch that antivirus tends to take an interest in.
func extractZip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}

	root, err := filepath.Abs(dest)
	if err != nil {
		return err
	}

	for _, f := range r.File {
		target := filepath.Join(root, filepath.FromSlash(f.Name))

		rel, err := filepath.Rel(root, target)
		if err != nil || !pathIsContained(rel) {
			return fmt.Errorf("release contains an unsafe path: %s", f.Name)
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
