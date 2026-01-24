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

	instancePath, err := ensureCalebsModInstance(prismPath)
	if err != nil {
		return false, fmt.Errorf("failed to ensure CalebsMod instance: %w", err)
	}

	if err := writeAutoConnectConfig(instancePath, serverAddress); err != nil {
		return false, fmt.Errorf("failed to write config: %w", err)
	}

	if err := launchPrismInstance(prismPath, INSTANCE_NAME); err != nil {
		return false, fmt.Errorf("failed to launch Minecraft: %w", err)
	}

	return true, nil
}

func CheckForgeInstalled() (bool, error) {
	prismPath, err := getPrismLauncherPath()
	if err != nil {
		return false, nil
	}

	if _, err := os.Stat(prismPath); os.IsNotExist(err) {
		return false, nil
	}

	return true, nil
}

func InstallForge() (bool, error) {
	_, err := ensurePrismLauncherInstalled()
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

	for _, asset := range release.Assets {
		name := asset.Name
		if runtime.GOOS == "windows" && filepath.Ext(name) == ".zip" {
			lowerName := strings.ToLower(name)
			if strings.Contains(lowerName, "windows") && 
			   strings.Contains(lowerName, "portable") &&
			   !strings.Contains(lowerName, "legacy") {
				downloadURL = asset.BrowserDownloadURL
				assetName = asset.Name
				break
			}
		}
	}

	if downloadURL == "" {
		return fmt.Errorf("could not find Windows portable release. Available assets: %v", 
			func() []string {
				names := make([]string, len(release.Assets))
				for i, a := range release.Assets {
					names[i] = a.Name
				}
				return names
			}())
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

func ensureCalebsModInstance(prismPath string) (string, error) {
	instancesPath := filepath.Join(prismPath, "instances", INSTANCE_NAME)
	
	if _, err := os.Stat(instancesPath); os.IsNotExist(err) {
		if err := createCalebsModInstance(prismPath); err != nil {
			return "", err
		}
	}

	return filepath.Join(instancesPath, ".minecraft"), nil
}

func createCalebsModInstance(prismPath string) error {
	instancesPath := filepath.Join(prismPath, "instances", INSTANCE_NAME)
	minecraftPath := filepath.Join(instancesPath, ".minecraft")
	
	if err := os.MkdirAll(minecraftPath, 0755); err != nil {
		return err
	}

	instanceCfg := fmt.Sprintf(`InstanceType=OneSix
name=%s
iconKey=default
notes=CalebsMod Private Modpack
`, INSTANCE_NAME)

	if err := os.WriteFile(filepath.Join(instancesPath, "instance.cfg"), []byte(instanceCfg), 0644); err != nil {
		return err
	}

	mmcPackJson := `{
	"components": [
		{
			"uid": "net.minecraft",
			"version": "1.20.1"
		},
		{
			"uid": "net.minecraftforge",
			"version": "47.3.0"
		}
	],
	"formatVersion": 1
}`

	if err := os.WriteFile(filepath.Join(instancesPath, "mmc-pack.json"), []byte(mmcPackJson), 0644); err != nil {
		return err
	}

	return nil
}

func launchPrismInstance(prismPath, instanceName string) error {
	prismExe := filepath.Join(prismPath, "prismlauncher.exe")
	
	cmd := exec.Command(prismExe, "-l", instanceName)
	
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to launch PrismLauncher: %w", err)
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

func writeAutoConnectConfig(instanceMinecraftPath string, serverAddress string) error {
	configDir := filepath.Join(instanceMinecraftPath, "config")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	config := AutoConnectConfig{
		Enabled:       true,
		ServerAddress: serverAddress,
	}

	configData, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	configPath := filepath.Join(configDir, "autoconnect.json")
	if err := os.WriteFile(configPath, configData, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}
