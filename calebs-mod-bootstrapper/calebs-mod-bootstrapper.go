package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	ServerURL         = "https://mc.calebwash.com"
	VersionEndpoint   = "/api/server/latest-client-release"
	ClientExecutable  = "CalebsModClient.exe"
	VersionFileName   = "CurrentCalebModClientVersion.txt"
	TempDownloadSuffix = ".download"
	ChecksumSuffix    = ".sha256"
)

type ReleaseInfo struct {
	Version     string `json:"version"`
	DownloadURL string `json:"downloadUrl"`
}

func main() {
	fmt.Println("=== Caleb's Mod Client Bootstrapper ===")
	fmt.Println()

	appDataPath, err := getAppDataPath()
	if err != nil {
		fmt.Printf("Error: Failed to determine AppData path: %v\n", err)
		waitForUser()
		os.Exit(1)
	}

	fmt.Printf("Using AppData path: %s\n", appDataPath)
	fmt.Println()

	if err := ensureAppDataExists(appDataPath); err != nil {
		fmt.Printf("Error: Failed to create AppData directory: %v\n", err)
		waitForUser()
		os.Exit(1)
	}

	currentVersion, err := getCurrentVersion(appDataPath)
	if err != nil {
		fmt.Printf("Warning: Could not read current version: %v\n", err)
		currentVersion = "0.00"
	}

	fmt.Printf("Current version: %s\n", currentVersion)
	fmt.Println("Checking for updates...")

	release, err := getLatestRelease()
	if err != nil {
		fmt.Printf("Error: Failed to check for updates: %v\n", err)
		fmt.Println("\nAttempting to launch existing client...")
		launchClient(appDataPath)
		waitForUser()
		os.Exit(1)
	}

	fmt.Printf("Latest version: %s\n", release.Version)
	fmt.Println()

	if currentVersion == release.Version {
		fmt.Println("You are running the latest version!")
		fmt.Println("Launching client...")
		launchClient(appDataPath)
		os.Exit(0)
	}

	fmt.Printf("Update available: %s -> %s\n", currentVersion, release.Version)
	fmt.Println("Starting update process...")
	fmt.Println()

	if err := performUpdate(appDataPath, release); err != nil {
		fmt.Printf("Error: Update failed: %v\n", err)
		fmt.Println("\nAttempting to launch existing client...")
		launchClient(appDataPath)
		waitForUser()
		os.Exit(1)
	}

	fmt.Println()
	fmt.Println("Update completed successfully!")
	fmt.Println("Launching client...")
	launchClient(appDataPath)
	os.Exit(0)
}

func getAppDataPath() (string, error) {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return "", fmt.Errorf("LOCALAPPDATA environment variable not set")
	}
	return filepath.Join(localAppData, "CalebsMod"), nil
}

func ensureAppDataExists(appDataPath string) error {
	return os.MkdirAll(appDataPath, 0755)
}

func getCurrentVersion(appDataPath string) (string, error) {
	versionFile := filepath.Join(appDataPath, VersionFileName)
	data, err := os.ReadFile(versionFile)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func getLatestRelease() (*ReleaseInfo, error) {
	url := ServerURL + VersionEndpoint
	
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to server: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	var release ReleaseInfo
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("failed to parse server response: %w", err)
	}

	return &release, nil
}

func performUpdate(appDataPath string, release *ReleaseInfo) error {
	tempZipPath := filepath.Join(appDataPath, "client"+TempDownloadSuffix)
	tempExtractPath := filepath.Join(appDataPath, "client_new")
	oldClientPath := filepath.Join(appDataPath, "client_old")

	fmt.Println("Step 1/5: Downloading new client...")
	if err := downloadFile(tempZipPath, release.DownloadURL); err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	fmt.Println("Download complete!")

	fmt.Println("\nStep 2/5: Verifying download...")
	if err := verifyDownload(tempZipPath); err != nil {
		os.Remove(tempZipPath)
		return fmt.Errorf("verification failed: %w", err)
	}
	fmt.Println("Verification successful!")

	fmt.Println("\nStep 3/5: Extracting new client...")
	if err := extractZip(tempZipPath, tempExtractPath); err != nil {
		os.Remove(tempZipPath)
		os.RemoveAll(tempExtractPath)
		return fmt.Errorf("extraction failed: %w", err)
	}
	fmt.Println("Extraction complete!")

	fmt.Println("\nStep 4/5: Backing up current client...")
	os.RemoveAll(oldClientPath)
	clientExePath := filepath.Join(appDataPath, ClientExecutable)
	if _, err := os.Stat(clientExePath); err == nil {
		if err := os.Rename(clientExePath, filepath.Join(oldClientPath, ClientExecutable)); err != nil {
			fmt.Printf("Warning: Could not backup old client: %v\n", err)
		}
	}

	fmt.Println("\nStep 5/5: Installing new client...")
	newClientExe := findExecutableInDir(tempExtractPath)
	if newClientExe == "" {
		os.RemoveAll(tempExtractPath)
		return fmt.Errorf("could not find client executable in downloaded files")
	}

	finalExePath := filepath.Join(appDataPath, ClientExecutable)
	if err := copyFile(newClientExe, finalExePath); err != nil {
		os.RemoveAll(tempExtractPath)
		return fmt.Errorf("failed to install new client: %w", err)
	}

	if err := os.WriteFile(filepath.Join(appDataPath, VersionFileName), []byte(release.Version), 0644); err != nil {
		fmt.Printf("Warning: Could not update version file: %v\n", err)
	}

	os.Remove(tempZipPath)
	os.RemoveAll(tempExtractPath)

	return nil
}

func downloadFile(filepath string, url string) error {
	client := &http.Client{
		Timeout: 10 * time.Minute,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server returned status %d for URL: %s", resp.StatusCode, url)
	}

	out, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer out.Close()

	totalBytes := resp.ContentLength
	downloaded := int64(0)
	lastPercent := -1

	buffer := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buffer)
		if n > 0 {
			if _, writeErr := out.Write(buffer[:n]); writeErr != nil {
				return writeErr
			}
			downloaded += int64(n)

			if totalBytes > 0 {
				percent := int(float64(downloaded) / float64(totalBytes) * 100)
				if percent != lastPercent && percent%10 == 0 {
					fmt.Printf("Progress: %d%% (%d MB / %d MB)\n", 
						percent, 
						downloaded/1024/1024, 
						totalBytes/1024/1024)
					lastPercent = percent
				}
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}

	return nil
}

func verifyDownload(filepath string) error {
	file, err := os.Open(filepath)
	if err != nil {
		return err
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return err
	}

	if stat.Size() < 1024*1024 {
		return fmt.Errorf("downloaded file is too small (less than 1MB)")
	}

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return err
	}

	checksum := fmt.Sprintf("%x", hash.Sum(nil))
	checksumFile := filepath + ChecksumSuffix
	os.WriteFile(checksumFile, []byte(checksum), 0644)

	return nil
}

func extractZip(zipPath, destPath string) error {
	os.RemoveAll(destPath)
	if err := os.MkdirAll(destPath, 0755); err != nil {
		return err
	}

	cmd := exec.Command("powershell", "-Command", 
		fmt.Sprintf("Expand-Archive -Path '%s' -DestinationPath '%s' -Force", zipPath, destPath))
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("extraction failed: %w\nOutput: %s", err, string(output))
	}

	return nil
}

func findExecutableInDir(dir string) string {
	var exePath string
	
	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".exe") {
			if strings.Contains(strings.ToLower(info.Name()), "calebsmod") {
				exePath = path
				return filepath.SkipAll
			}
		}
		return nil
	})

	return exePath
}

func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		return err
	}

	return destFile.Sync()
}

func launchClient(appDataPath string) {
	clientPath := filepath.Join(appDataPath, ClientExecutable)
	
	if _, err := os.Stat(clientPath); err != nil {
		fmt.Printf("Warning: Client executable not found at %s\n", clientPath)
		return
	}

	cmd := exec.Command(clientPath)
	cmd.Dir = appDataPath
	
	if err := cmd.Start(); err != nil {
		fmt.Printf("Warning: Failed to launch client: %v\n", err)
		fmt.Println("You can manually launch the client from:")
		fmt.Println(clientPath)
		return
	}

	fmt.Println("Client launched successfully!")
}

func waitForUser() {
	fmt.Println("\nPress Enter to exit...")
	fmt.Scanln()
}
