package go_services

import (
	"os"
	"path/filepath"
)

var pathToCalebsModClient string = filepath.Join("C:\\Users\\numbe\\AppData\\Local", "CalebsModClient")

func EnsureLocalFolderExists() error {
	return os.MkdirAll(pathToCalebsModClient, 0755)
}

func GetFileInLocalFolder(filename string) ([]byte, error) {
	file, err := os.ReadFile(filepath.Join(pathToCalebsModClient, filename))
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

	err = os.WriteFile(filepath.Join(pathToCalebsModClient, filename), data, 0644)
	if err != nil {
		return err
	}
	return nil
}

func DeleteFileInLocalFolder(filename string) error {
	filePath := filepath.Join(pathToCalebsModClient, filename)
	err := os.Remove(filePath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func ReadFile(filePath string) ([]byte, error) {
	return os.ReadFile(filePath)
}
