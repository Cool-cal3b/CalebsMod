package go_services

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Address and display name this client registers in Minecraft's multiplayer
// list. Kept in one place so the "is the server already configured" check and
// the code that writes servers.dat stay in agreement.
const (
	SERVER_CONFIG_ADDRESS = "mc.calebwash.com"
	SERVER_CONFIG_NAME    = "Caleb's Mod Server"
)

// ClientStatus is a snapshot of how the local install compares to the server.
// It drives the home screen: whether the sync button is needed, and what the
// status bar should say.
type ClientStatus struct {
	LauncherInstalled bool     `json:"launcherInstalled"`
	InstanceExists    bool     `json:"instanceExists"`
	ServerInConfig    bool     `json:"serverInConfig"`
	FilesExpected     int      `json:"filesExpected"`
	FilesMissing      int      `json:"filesMissing"`
	ModsExpected      int      `json:"modsExpected"`
	ModsMissing       int      `json:"modsMissing"`
	MissingExamples   []string `json:"missingExamples"`
	NeedsSync         bool     `json:"needsSync"`
	ManifestError     string   `json:"manifestError,omitempty"`
}

// GetClientStatus inspects the local PrismLauncher instance and compares it to
// the server's manifest without downloading anything.
func GetClientStatus() (ClientStatus, error) {
	var status ClientStatus

	prismPath, err := getPrismLauncherPath()
	if err != nil {
		return status, err
	}

	if _, err := os.Stat(filepath.Join(prismPath, "prismlauncher.exe")); err == nil {
		status.LauncherInstalled = true
	}

	instancePath := filepath.Join(prismPath, "instances", INSTANCE_NAME)
	minecraftPath := filepath.Join(instancePath, "minecraft")

	if _, err := os.Stat(filepath.Join(instancePath, "instance.cfg")); err == nil {
		status.InstanceExists = true
	}

	status.ServerInConfig = serverIsInServersFile(filepath.Join(minecraftPath, "servers.dat"))

	manifest, err := FetchClientManifest()
	if err != nil {
		// Without the manifest we cannot tell which files are missing, but the
		// caller can still act on the servers.dat check.
		status.ManifestError = err.Error()
		status.NeedsSync = !status.InstanceExists || !status.ServerInConfig
		return status, nil
	}

	missing := missingManifestFiles(minecraftPath, manifest)

	status.FilesExpected = len(manifest)
	status.FilesMissing = len(missing)
	for _, f := range manifest {
		if f.FileType == "mod" {
			status.ModsExpected++
		}
	}
	for _, f := range missing {
		if f.FileType == "mod" {
			status.ModsMissing++
		}
		if len(status.MissingExamples) < 5 {
			status.MissingExamples = append(status.MissingExamples, f.FileName)
		}
	}

	status.NeedsSync = !status.InstanceExists || !status.ServerInConfig || status.FilesMissing > 0
	return status, nil
}

// missingManifestFiles reports the manifest entries that have no file on disk.
// It checks presence only and never hashes: mods rewrite their own configs at
// runtime (chiselsandbits, embeddium) and players edit options.txt, so a
// content comparison flags a perfectly healthy install as out of date. A file
// that is simply absent is unambiguous.
func missingManifestFiles(root string, files []SyncFile) []SyncFile {
	var missing []SyncFile
	for _, f := range files {
		target := filepath.Join(root, filepath.FromSlash(f.RelativePath))
		if info, err := os.Stat(target); err != nil || info.IsDir() {
			missing = append(missing, f)
		}
	}
	return missing
}

func serverIsInServersFile(serversFilePath string) bool {
	servers, err := readServersFile(serversFilePath)
	if err != nil {
		return false
	}
	for _, s := range servers {
		if strings.TrimSuffix(s.IP, ":25565") == SERVER_CONFIG_ADDRESS {
			return true
		}
	}
	return false
}

// GetPublicServerStatus fetches the unauthenticated /api/server/status so the
// home screen can show whether the server is up and how many players are on.
func GetPublicServerStatus() (ServerStatusResponse, error) {
	resp, err := MakeGetRequest("/api/server/status")
	if err != nil {
		return ServerStatusResponse{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ServerStatusResponse{}, err
	}

	var out ServerStatusResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return ServerStatusResponse{}, err
	}
	return out, nil
}

// GetClientVersion reports the version the bootstrapper last installed. The
// file is absent when the client is run directly (dev, or a manual copy), in
// which case the UI simply shows nothing rather than a fake number.
func GetClientVersion() string {
	path, err := versionFilePath()
	if err != nil {
		return ""
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}
