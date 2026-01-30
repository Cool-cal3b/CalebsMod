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

	prismExe := filepath.Join(prismPath, "prismlauncher.exe")
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

	if runtime.GOOS == "windows" {
		if err := killProcessByName("prismlauncher.exe"); err != nil {
			fmt.Printf("Warning: failed to kill PrismLauncher process: %v\n", err)
		}
		time.Sleep(500 * time.Millisecond)
	}

	if err := os.RemoveAll(prismPath); err != nil {
		return false, fmt.Errorf("failed to remove PrismLauncher directory: %w. Make sure PrismLauncher is closed", err)
	}

	return true, nil
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

 	minecraftPath := filepath.Join(instancePath, "minecraft")
	if err := os.MkdirAll(minecraftPath, 0755); err != nil {
		return false, fmt.Errorf("failed to create minecraft directory: %w", err)
	}

	serversFilePath := filepath.Join(minecraftPath, "servers.dat")
	
	serverAddress := "mc.calebwash.com"
	serverName := "Caleb's Mod Server"

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
		return false, fmt.Errorf("failed to write servers file: %w", err)
	}

	fmt.Printf("Successfully wrote servers file\n")
	return true, nil
}

func killProcessByName(processName string) error {
	if runtime.GOOS != "windows" {
		return fmt.Errorf("only supported on Windows")
	}

	cmd := exec.Command("taskkill", "/F", "/IM", processName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		if strings.Contains(string(output), "not found") {
			return nil
		}
		return fmt.Errorf("taskkill failed: %w, output: %s", err, string(output))
	}
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

	prismExe := filepath.Join(prismPath, "prismlauncher.exe")
	if _, err := os.Stat(prismExe); err == nil {
		return prismPath, nil
	}

	if err := downloadAndInstallPrism(prismPath); err != nil {
		return "", err
	}

	return prismPath, nil
}

func getPrismLauncherPath() (string, error) {
	switch runtime.GOOS {
	case "windows":
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			return "", fmt.Errorf("LOCALAPPDATA environment variable not set")
		}
		return filepath.Join(localAppData, "CalebsMod", "PrismLauncher"), nil
	case "darwin":
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(homeDir, "Library", "Application Support", "CalebsMod", "PrismLauncher"), nil
	case "linux":
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(homeDir, ".local", "share", "CalebsMod", "PrismLauncher"), nil
	default:
		return "", fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}
}

func downloadAndInstallPrism(destPath string) error {
	release, err := getLatestPrismRelease()
	if err != nil {
		return fmt.Errorf("failed to get latest release: %w", err)
	}

	var downloadURL string
	var assetName string

	arch := runtime.GOARCH

	for _, asset := range release.Assets {
		name := asset.Name
		if runtime.GOOS == "windows" && filepath.Ext(name) == ".zip" {
			lowerName := strings.ToLower(name)

			if !strings.Contains(lowerName, "windows") ||
				!strings.Contains(lowerName, "portable") ||
				strings.Contains(lowerName, "setup") {
				continue
			}

			if arch == "amd64" && strings.Contains(lowerName, "msvc") && !strings.Contains(lowerName, "arm64") {
				downloadURL = asset.BrowserDownloadURL
				assetName = asset.Name
				break
			} else if arch == "arm64" && strings.Contains(lowerName, "arm64") {
				downloadURL = asset.BrowserDownloadURL
				assetName = asset.Name
				break
			}
		}
	}

	if downloadURL == "" {
		availableAssets := make([]string, len(release.Assets))
		for i, a := range release.Assets {
			availableAssets[i] = a.Name
		}
		return fmt.Errorf("could not find compatible Windows portable release for %s/%s. Available assets: %v",
			runtime.GOOS, arch, availableAssets)
	}

	tempDir := os.TempDir()
	zipPath := filepath.Join(tempDir, assetName)

	if err := downloadFile(zipPath, downloadURL); err != nil {
		return fmt.Errorf("failed to download: %w", err)
	}

	if err := os.MkdirAll(destPath, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	if err := unzip(zipPath, destPath); err != nil {
		return fmt.Errorf("failed to unzip: %w", err)
	}

	os.Remove(zipPath)
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

func unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		fpath := filepath.Join(dest, f.Name)

		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()

		if err != nil {
			return err
		}
	}
	return nil
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
	prismExe := filepath.Join(prismPath, "prismlauncher.exe")

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

	instanceCfg := `InstanceType=OneSix
name=CalebsMod
iconKey=default
notes=CalebsMod Private Modpack
`
	if err := addFileToZip(zipWriter, "instance.cfg", []byte(instanceCfg)); err != nil {
		return err
	}

	mmcPackJson := `{
	"components": [
		{
			"cachedName": "Minecraft",
			"cachedRequires": [],
			"cachedVersion": "1.20.1",
			"important": true,
			"uid": "net.minecraft",
			"version": "1.20.1"
		},
		{
			"cachedName": "Forge",
			"cachedRequires": [
				{
					"uid": "net.minecraft"
				}
			],
			"cachedVersion": "47.3.0",
			"uid": "net.minecraftforge",
			"version": "47.3.0"
		}
	],
	"formatVersion": 1
}`
	if err := addFileToZip(zipWriter, "mmc-pack.json", []byte(mmcPackJson)); err != nil {
		return err
	}

	return nil
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
	prismExe := filepath.Join(prismPath, "prismlauncher.exe")

	cmd := exec.Command(prismExe, "-d", prismPath, "-l", instanceName, "-s", serverAddress)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to launch PrismLauncher: %w", err)
	}

	return nil
}

func syncModsToInstance(instancePath string) error {
	minecraftPath := filepath.Join(instancePath, ".minecraft")
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
