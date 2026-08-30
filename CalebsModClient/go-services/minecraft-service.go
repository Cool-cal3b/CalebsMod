package go_services

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Tnze/go-mc/nbt"
)

type AutoConnectConfig struct {
	Enabled       bool   `json:"enabled"`
	ServerAddress string `json:"serverAddress"`
}

type GitHubRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

type MinecraftServer struct {
	Hidden bool   `nbt:"hidden,omitempty"`
	IP     string `nbt:"ip"`
	Name   string `nbt:"name"`
}

type ServersData struct {
	Servers []MinecraftServer `nbt:"servers"`
}

const (
	PRISM_RELEASE_API = "https://api.github.com/repos/PrismLauncher/PrismLauncher/releases/latest"
	INSTANCE_NAME     = "CalebsMod"

	// Must match the server's FORGE_VERSION (calebs-mod-server/.env). A mismatch
	// here is what makes the client and server refuse each other.
	MINECRAFT_VERSION = "1.20.1"
	FORGE_VERSION     = "47.4.10"
)

func StartMinecraftClient() (bool, error) {
	prismPath, err := ensurePrismLauncherInstalled()
	if err != nil {
		return false, fmt.Errorf("failed to ensure PrismLauncher is installed: %w", err)
	}

	serverAddress, err := getServerAddress()
	if err != nil {
		return false, fmt.Errorf("failed to get server address: %w", err)
	}

	instanceExists, err := checkInstanceExists(prismPath)
	if err != nil {
		return false, fmt.Errorf("failed to check instance: %w", err)
	}

	if !instanceExists {
		if err := createInstanceViaPrismUI(prismPath); err != nil {
			return false, err
		}
		return false, fmt.Errorf("instance created - please click 'Launch Minecraft' again after setting up your Microsoft account in PrismLauncher")
	}

	if err := syncModsToInstance(filepath.Join(prismPath, "instances", INSTANCE_NAME)); err != nil {
		return false, fmt.Errorf("failed to sync mods: %w", err)
	}

	if err := launchPrismInstance(prismPath, INSTANCE_NAME, serverAddress); err != nil {
		return false, fmt.Errorf("failed to launch Minecraft: %w", err)
	}

	return true, nil
}

func CheckLauncherInstalled() (bool, error) {
	prismPath, err := getPrismLauncherPath()
	if err != nil {
		return false, nil
	}

	prismExe := PrismExecutablePath(prismPath)
	if _, err := os.Stat(prismExe); os.IsNotExist(err) {
		return false, nil
	}

	return true, nil
}

func DeleteLauncher() (bool, error) {
	prismPath, err := getPrismLauncherPath()
	if err != nil {
		return false, fmt.Errorf("failed to get PrismLauncher path: %w", err)
	}

	if _, err := os.Stat(prismPath); os.IsNotExist(err) {
		return true, nil
	}

	if err := KillPrismLauncher(); err != nil {
		fmt.Printf("Warning: failed to stop PrismLauncher: %v\n", err)
	}
	time.Sleep(500 * time.Millisecond)

	if err := os.RemoveAll(prismPath); err != nil {
		return false, fmt.Errorf("failed to remove PrismLauncher directory: %w. Make sure PrismLauncher is closed", err)
	}

	return true, nil
}

// ResetClient wipes every piece of local client state and repopulates from a
// full sync. Incremental revision syncs only apply the deltas since the client's
// stored revision, so a pack that changed underneath them (or a sync that died
// half-way) can leave stale mods, configs and datapacks behind that then fail the
// FML handshake. This takes the client back to a known-good baseline.
func ResetClient() (bool, error) {
	prismPath, err := getPrismLauncherPath()
	if err != nil {
		return false, fmt.Errorf("failed to get PrismLauncher path: %w", err)
	}

	// Prism holds file locks on the instance while it is running. This used to
	// be skipped off Windows, which meant a Mac reset quietly raced a running
	// launcher and half-deleted the instance.
	if err := KillPrismLauncher(); err != nil {
		fmt.Printf("Warning: failed to stop PrismLauncher: %v\n", err)
	}
	time.Sleep(500 * time.Millisecond)

	instancePath := filepath.Join(prismPath, "instances", INSTANCE_NAME)

	// Forge writes read-only configs (fml.toml), which make RemoveAll fail on Windows.
	if err := clearReadOnlyAttributes(instancePath); err != nil {
		fmt.Printf("Warning: failed to clear read-only attributes: %v\n", err)
	}

	if err := os.RemoveAll(instancePath); err != nil {
		return false, fmt.Errorf("failed to remove instance: %w. Make sure PrismLauncher and Minecraft are closed", err)
	}

	// Drop local revision tracking so the next sync starts from revision 0.
	if err := DeleteFileInLocalFolder("revision.txt"); err != nil {
		return false, fmt.Errorf("failed to clear local revision: %w", err)
	}

	if err := createInstanceOnDisk(prismPath); err != nil {
		return false, fmt.Errorf("failed to recreate instance: %w", err)
	}

	if _, err := SyncMods(); err != nil {
		return false, fmt.Errorf("failed to repopulate mods: %w", err)
	}

	return true, nil
}

// createInstanceOnDisk writes the instance skeleton directly, rather than going
// through Prism's import UI, so a reset needs no manual steps from the user.
func createInstanceOnDisk(prismPath string) error {
	instancePath := filepath.Join(prismPath, "instances", INSTANCE_NAME)

	if err := os.MkdirAll(GameRootPath(instancePath), 0755); err != nil {
		return fmt.Errorf("failed to create instance directory: %w", err)
	}

	cfgPath := filepath.Join(instancePath, "instance.cfg")
	if err := os.WriteFile(cfgPath, []byte(buildInstanceCfg()), 0644); err != nil {
		return fmt.Errorf("failed to write instance.cfg: %w", err)
	}

	packPath := filepath.Join(instancePath, "mmc-pack.json")
	if err := os.WriteFile(packPath, []byte(buildMmcPackJson()), 0644); err != nil {
		return fmt.Errorf("failed to write mmc-pack.json: %w", err)
	}

	return nil
}

// clearReadOnlyAttributes makes every file under root writable so RemoveAll can
// delete it. Missing paths are not an error - there may be nothing to reset yet.
func clearReadOnlyAttributes(root string) error {
	if _, err := os.Stat(root); os.IsNotExist(err) {
		return nil
	}

	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		if info.Mode().Perm()&0200 == 0 {
			if chmodErr := os.Chmod(path, info.Mode().Perm()|0200); chmodErr != nil {
				fmt.Printf("Warning: failed to clear read-only on %s: %v\n", path, chmodErr)
			}
		}
		return nil
	})
}

func SyncMods() (bool, error) {
	prismPath, err := getPrismLauncherPath()
	if err != nil {
		return false, fmt.Errorf("failed to get PrismLauncher path: %w", err)
	}

	instancePath := filepath.Join(prismPath, "instances", INSTANCE_NAME)
	if _, err := os.Stat(instancePath); os.IsNotExist(err) {
		return false, fmt.Errorf("instance not found. Please install the launcher first")
	}

	minecraftPath := GameRootPath(instancePath)
	if err := os.MkdirAll(minecraftPath, 0755); err != nil {
		return false, fmt.Errorf("failed to create minecraft directory: %w", err)
	}

	if err := addServerToServersFile(minecraftPath); err != nil {
		return false, fmt.Errorf("failed to add server to servers file: %w", err)
	}

	currentRevision, err := getCurrentRevision()
	if err != nil {
		return false, fmt.Errorf("failed to get current revision: %w", err)
	}

	syncData, err := fetchSyncData(currentRevision)
	if err != nil {
		return false, fmt.Errorf("failed to fetch sync data: %w", err)
	}

	if syncData.LatestRevision == 0 && !syncData.UpToDate {
		fmt.Println("Warning: server returned latestRevision=0; check server getLatestRevision() + JSON field names")
	}

	if syncData.UpToDate {
		// Being on the right revision does not prove the install is intact -
		// files can be deleted or a sync can die after recording progress - so
		// check against the full manifest and refetch anything missing.
		manifest, err := FetchClientManifest()
		if err != nil {
			fmt.Printf("Warning: could not fetch manifest to verify install: %v\n", err)
			fmt.Println("Already up to date!")
			return true, nil
		}

		if err := SyncFilesVerified(minecraftPath, manifest, verifyMissing); err != nil {
			return false, fmt.Errorf("failed to repair install: %w", err)
		}

		fmt.Println("Already up to date!")
		return true, nil
	}

	fmt.Printf("Syncing from revision %d to %d...\n", currentRevision, syncData.LatestRevision)

	for _, relPath := range syncData.FilesToRemove {
		targetPath := filepath.Join(minecraftPath, relPath)
		if err := os.Remove(targetPath); err != nil && !os.IsNotExist(err) {
			fmt.Printf("Warning: failed to remove %s: %v\n", relPath, err)
		} else {
			fmt.Printf("Removed: %s\n", relPath)
		}
	}

	if len(syncData.FilesToAdd) > 0 {
		// Verified, resumable, batched. The revision below is only recorded if
		// every file arrived intact, so a half-finished sync is never mistaken
		// for a complete install.
		if err := SyncFilesVerified(minecraftPath, syncData.FilesToAdd, verifySize); err != nil {
			return false, fmt.Errorf("failed to sync files: %w", err)
		}

		fmt.Printf("Synced %d file(s)\n", len(syncData.FilesToAdd))
	}

	if err := saveCurrentRevision(syncData.LatestRevision); err != nil {
		return false, fmt.Errorf("failed to save revision: %w", err)
	}

	fmt.Printf("Sync complete! Now at revision %d\n", syncData.LatestRevision)
	return true, nil
}

type SyncResponse struct {
	UpToDate       bool       `json:"upToDate"`
	LatestRevision int        `json:"latestRevision"`
	FilesToAdd     []SyncFile `json:"filesToAdd"`
	FilesToRemove  []string   `json:"filesToRemove"`
	ZipUrl         string     `json:"zipUrl"` // NEW
}

type SyncFile struct {
	Sha256       string `json:"sha256"`
	FileName     string `json:"fileName"`
	FileType     string `json:"fileType"`
	RelativePath string `json:"relativePath"`
	FileSize     int64  `json:"fileSize"`
}

type File struct {
	Sha256       string `json:"sha256"`
	FileName     string `json:"fileName"`
	FileType     string `json:"fileType"`
	RelativePath string `json:"relativePath"`
	FileSize     int    `json:"fileSize"`
}

func getCurrentRevision() (int, error) {
	data, err := GetFileInLocalFolder("revision.txt")
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	var revision int
	_, err = fmt.Sscanf(string(data), "%d", &revision)
	if err != nil {
		return 0, nil
	}

	return revision, nil
}

func saveCurrentRevision(revision int) error {
	data := []byte(fmt.Sprintf("%d", revision))
	return SaveFileInLocalFolder("revision.txt", data)
}

func fetchSyncData(fromRevision int) (*SyncResponse, error) {
	url := fmt.Sprintf("/api/modpack/sync/%d", fromRevision)
	resp, err := MakeGetRequest(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var syncResp SyncResponse
	if err := json.Unmarshal(body, &syncResp); err != nil {
		return nil, err
	}

	return &syncResp, nil
}

func addServerToServersFile(minecraftPath string) error {
	serversFilePath := filepath.Join(minecraftPath, "servers.dat")

	serverAddress := SERVER_CONFIG_ADDRESS
	serverName := SERVER_CONFIG_NAME

	servers, err := readServersFile(serversFilePath)
	if err != nil {
		fmt.Printf("Error reading servers file: %v\n", err)
		servers = []MinecraftServer{}
	}

	fmt.Printf("Read %d servers from file\n", len(servers))

	serverExists := false
	for i, server := range servers {
		fmt.Printf("Server %d: IP=%s, Name=%s, Hidden=%v\n", i, server.IP, server.Name, server.Hidden)
		cleanIP := strings.TrimSuffix(server.IP, ":25565")
		if cleanIP == serverAddress || server.IP == serverAddress {
			serverExists = true
			fmt.Printf("BEFORE UPDATE: IP=%s, Name=%s, Hidden=%v\n", servers[i].IP, servers[i].Name, servers[i].Hidden)
			servers[i].Name = serverName
			servers[i].IP = serverAddress
			servers[i].Hidden = false
			fmt.Printf("AFTER UPDATE: IP=%s, Name=%s, Hidden=%v\n", servers[i].IP, servers[i].Name, servers[i].Hidden)
			break
		}
	}

	fmt.Printf("About to write servers:\n")
	for i, server := range servers {
		fmt.Printf("  Server %d: IP=%s, Name=%s, Hidden=%v\n", i, server.IP, server.Name, server.Hidden)
	}

	if !serverExists {
		fmt.Printf("Adding new server: %s\n", serverAddress)
		servers = append(servers, MinecraftServer{
			Hidden: false,
			IP:     serverAddress,
			Name:   serverName,
		})
	}

	fmt.Printf("Writing %d servers to file: %s\n", len(servers), serversFilePath)
	if err := writeServersFile(serversFilePath, servers); err != nil {
		return fmt.Errorf("failed to write servers file: %w", err)
	}

	fmt.Printf("Successfully wrote servers file\n")
	return nil
}

func InstallLauncher() (bool, error) {
	prismPath, err := getPrismLauncherPath()
	if err != nil {
		return false, fmt.Errorf("failed to get PrismLauncher path: %w", err)
	}

	if _, err := os.Stat(prismPath); err == nil {
		if err := os.RemoveAll(prismPath); err != nil {
			return false, fmt.Errorf("failed to remove existing PrismLauncher: %w", err)
		}
	}

	_, err = ensurePrismLauncherInstalled()
	if err != nil {
		return false, fmt.Errorf("failed to install PrismLauncher: %w", err)
	}
	return true, nil
}

func ensurePrismLauncherInstalled() (string, error) {
	prismPath, err := getPrismLauncherPath()
	if err != nil {
		return "", err
	}

	prismExe := PrismExecutablePath(prismPath)
	if _, err := os.Stat(prismExe); err == nil {
		return prismPath, nil
	}

	if err := downloadAndInstallPrism(prismPath); err != nil {
		return "", err
	}

	return prismPath, nil
}

// getPrismLauncherPath is both where Prism is installed and the data directory
// it is launched with (-d), so instances live alongside the launcher rather
// than in Prism's own per-user location. That keeps a CalebsMod install
// self-contained and leaves a separately-installed Prism untouched.
func getPrismLauncherPath() (string, error) {
	dir, err := AppDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "PrismLauncher"), nil
}

// selectPrismAsset picks the right PrismLauncher release asset for the running
// platform, returning its URL and filename (empty when nothing matches).
//
// The two platforms publish quite different things. Windows ships several
// per-toolchain zips and we want the portable one, never the "setup"
// installer. macOS ships a single universal .tar.gz covering both Intel and
// Apple Silicon, plus a "Legacy" variant for older systems - so there is no
// architecture to match there, only a macOS version floor. The current build is
// preferred and Legacy is the fallback, which is the right way round: a modern
// Mac running Legacy works but gives up features, whereas an old Mac running
// the current build does not launch at all.
func selectPrismAsset(release *GitHubRelease) (url string, name string) {
	arch := runtime.GOARCH

	switch runtime.GOOS {
	case "windows":
		for _, asset := range release.Assets {
			if filepath.Ext(asset.Name) != ".zip" {
				continue
			}
			lowerName := strings.ToLower(asset.Name)

			if !strings.Contains(lowerName, "windows") ||
				!strings.Contains(lowerName, "portable") ||
				strings.Contains(lowerName, "setup") {
				continue
			}

			if arch == "amd64" && strings.Contains(lowerName, "msvc") && !strings.Contains(lowerName, "arm64") {
				return asset.BrowserDownloadURL, asset.Name
			}
			if arch == "arm64" && strings.Contains(lowerName, "arm64") {
				return asset.BrowserDownloadURL, asset.Name
			}
		}

	case "darwin":
		var legacyURL, legacyName string

		for _, asset := range release.Assets {
			lowerName := strings.ToLower(asset.Name)

			if !strings.Contains(lowerName, "macos") || !strings.HasSuffix(lowerName, ".tar.gz") {
				continue
			}

			if strings.Contains(lowerName, "legacy") {
				legacyURL, legacyName = asset.BrowserDownloadURL, asset.Name
				continue
			}
			return asset.BrowserDownloadURL, asset.Name
		}

		return legacyURL, legacyName
	}

	return "", ""
}

func downloadAndInstallPrism(destPath string) error {
	release, err := getLatestPrismRelease()
	if err != nil {
		return fmt.Errorf("failed to get latest release: %w", err)
	}

	downloadURL, assetName := selectPrismAsset(release)

	if downloadURL == "" {
		availableAssets := make([]string, len(release.Assets))
		for i, a := range release.Assets {
			availableAssets[i] = a.Name
		}
		return fmt.Errorf("could not find a compatible PrismLauncher release for %s/%s. Available assets: %v",
			runtime.GOOS, runtime.GOARCH, availableAssets)
	}

	tempDir := os.TempDir()
	archivePath := filepath.Join(tempDir, assetName)

	if err := downloadFile(archivePath, downloadURL); err != nil {
		return fmt.Errorf("failed to download: %w", err)
	}

	if err := os.MkdirAll(destPath, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// ExtractArchive rather than the local unzip(): the macOS asset is a
	// .tar.gz, and what is inside it is an .app bundle whose symlinks and
	// executable bits have to survive or Prism will not launch.
	if err := ExtractArchive(archivePath, destPath); err != nil {
		return fmt.Errorf("failed to extract %s: %w", assetName, err)
	}

	os.Remove(archivePath)
	return nil
}

func getLatestPrismRelease() (*GitHubRelease, error) {
	resp, err := http.Get(PRISM_RELEASE_API)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch release: status %d", resp.StatusCode)
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, err
	}

	return &release, nil
}

func downloadFile(filepath string, url string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	out, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

func checkInstanceExists(prismPath string) (bool, error) {
	instancesPath := filepath.Join(prismPath, "instances", INSTANCE_NAME)
	instanceCfgPath := filepath.Join(instancesPath, "instance.cfg")

	if _, err := os.Stat(instanceCfgPath); os.IsNotExist(err) {
		return false, nil
	}

	return true, nil
}

func createInstanceViaPrismUI(prismPath string) error {
	if err := createModpackZip(prismPath); err != nil {
		return fmt.Errorf("failed to create modpack: %w", err)
	}

	modpackPath := filepath.Join(prismPath, "CalebsMod.zip")
	prismExe := PrismExecutablePath(prismPath)

	cmd := exec.Command(prismExe, "-d", prismPath, "-I", modpackPath)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to launch PrismLauncher: %w", err)
	}

	return fmt.Errorf("PrismLauncher opened - it will import the CalebsMod instance. After import:\n1. Log into your Microsoft account if prompted\n2. Close PrismLauncher\n3. Click 'Launch Minecraft' again")
}

func createModpackZip(prismPath string) error {
	modpackPath := filepath.Join(prismPath, "CalebsMod.zip")

	zipFile, err := os.Create(modpackPath)
	if err != nil {
		return err
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	if err := addFileToZip(zipWriter, "instance.cfg", []byte(buildInstanceCfg())); err != nil {
		return err
	}

	if err := addFileToZip(zipWriter, "mmc-pack.json", []byte(buildMmcPackJson())); err != nil {
		return err
	}

	return nil
}

func buildInstanceCfg() string {
	return `[General]
InstanceType=OneSix
name=` + INSTANCE_NAME + `
iconKey=default
notes=CalebsMod Private Modpack
`
}

func buildMmcPackJson() string {
	return fmt.Sprintf(`{
	"components": [
		{
			"cachedName": "Minecraft",
			"cachedRequires": [],
			"cachedVersion": %[1]q,
			"important": true,
			"uid": "net.minecraft",
			"version": %[1]q
		},
		{
			"cachedName": "Forge",
			"cachedRequires": [
				{
					"uid": "net.minecraft"
				}
			],
			"cachedVersion": %[2]q,
			"uid": "net.minecraftforge",
			"version": %[2]q
		}
	],
	"formatVersion": 1
}`, MINECRAFT_VERSION, FORGE_VERSION)
}

func addFileToZip(zipWriter *zip.Writer, filename string, data []byte) error {
	writer, err := zipWriter.Create(filename)
	if err != nil {
		return err
	}
	_, err = writer.Write(data)
	return err
}

func launchPrismInstance(prismPath, instanceName, serverAddress string) error {
	prismExe := PrismExecutablePath(prismPath)

	cmd := exec.Command(prismExe, "-d", prismPath, "-l", instanceName, "-s", serverAddress)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to launch PrismLauncher: %w", err)
	}

	return nil
}

func syncModsToInstance(instancePath string) error {
	// This used to hardcode ".minecraft" while every other caller used
	// "minecraft", so on Windows it seeded an empty second directory Prism
	// never looked at. GameRootPath is the single answer both now use.
	minecraftPath := GameRootPath(instancePath)
	modsPath := filepath.Join(minecraftPath, "mods")
	configPath := filepath.Join(minecraftPath, "config")

	if err := os.MkdirAll(modsPath, 0755); err != nil {
		return fmt.Errorf("failed to create mods directory: %w", err)
	}

	if err := os.MkdirAll(configPath, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	return nil
}

func getServerAddress() (string, error) {
	baseUrl := GetServerUrl()
	resp, err := http.Get(baseUrl + "/api/server/ip-and-port")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var ipAndPortResponseData struct {
		Ip            string `json:"ip"`
		Port          string `json:"port"`
		ServerAddress string `json:"serverAddress"`
	}

	err = json.Unmarshal(body, &ipAndPortResponseData)
	if err != nil {
		return "", err
	}

	if ipAndPortResponseData.ServerAddress != "" {
		return ipAndPortResponseData.ServerAddress, nil
	}

	return fmt.Sprintf("%s:%s", ipAndPortResponseData.Ip, ipAndPortResponseData.Port), nil
}

func readServersFile(filePath string) ([]MinecraftServer, error) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		fmt.Printf("Servers file does not exist: %s\n", filePath)
		return []MinecraftServer{}, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read servers file: %w", err)
	}

	fmt.Printf("Read %d bytes from servers file\n", len(data))

	var serversData ServersData
	reader := bytes.NewReader(data)
	decoder := nbt.NewDecoder(reader)

	if _, err := decoder.Decode(&serversData); err != nil {
		fmt.Printf("Failed to decode NBT: %v\n", err)
		return []MinecraftServer{}, nil
	}

	fmt.Printf("Decoded %d servers from NBT\n", len(serversData.Servers))
	return serversData.Servers, nil
}

func writeServersFile(filePath string, servers []MinecraftServer) error {
	serversData := ServersData{
		Servers: servers,
	}

	var buf bytes.Buffer
	encoder := nbt.NewEncoder(&buf)

	if err := encoder.Encode(serversData, ""); err != nil {
		return fmt.Errorf("failed to encode servers: %w", err)
	}

	fmt.Printf("Encoded %d bytes of NBT data\n", buf.Len())
	fmt.Printf("Writing to file: %s\n", filePath)

	if err := os.WriteFile(filePath, buf.Bytes(), 0644); err != nil {
		return fmt.Errorf("failed to write servers file: %w", err)
	}

	fmt.Printf("Successfully wrote file\n")
	return nil
}
