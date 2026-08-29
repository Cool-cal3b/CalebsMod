package go_services

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

func getLocalFolderPath() (string, error) {
	switch runtime.GOOS {
	case "windows":
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			return "", fmt.Errorf("LOCALAPPDATA environment variable not set")
		}
		return filepath.Join(localAppData, "CalebsModClient"), nil
	case "darwin":
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(homeDir, "Library", "Application Support", "CalebsModClient"), nil
	case "linux":
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(homeDir, ".local", "share", "CalebsModClient"), nil
	default:
		return "", fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}
}

func EnsureLocalFolderExists() error {
	path, err := getLocalFolderPath()
	if err != nil {
		return err
	}
	return os.MkdirAll(path, 0755)
}

func GetFileInLocalFolder(filename string) ([]byte, error) {
	path, err := getLocalFolderPath()
	if err != nil {
		return nil, err
	}

	file, err := os.ReadFile(filepath.Join(path, filename))
	if err != nil {
		return nil, err
	}
	return file, nil
}

func SaveFileInLocalFolder(filename string, data []byte) error {
	err := EnsureLocalFolderExists()
	if err != nil {
		return err
	}

	path, err := getLocalFolderPath()
	if err != nil {
		return err
	}

	err = os.WriteFile(filepath.Join(path, filename), data, 0644)
	if err != nil {
		return err
	}
	return nil
}

func DeleteFileInLocalFolder(filename string) error {
	path, err := getLocalFolderPath()
	if err != nil {
		return err
	}

	filePath := filepath.Join(path, filename)
	err = os.Remove(filePath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func ReadFile(filePath string) ([]byte, error) {
	return os.ReadFile(filePath)
}
