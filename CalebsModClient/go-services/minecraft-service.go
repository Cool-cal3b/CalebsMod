package go_services

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
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

func CheckForgeInstalled() (bool, error) {
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

func InstallForge() (bool, error) {
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
