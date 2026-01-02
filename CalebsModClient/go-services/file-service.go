package go_services

import (
	"os"
	"path"
)

var pathToWindowsLocalAppData string = "C:\\Users\\numbe\\AppData\\Local"
var pathToCalebsModClient string = path.Join(pathToWindowsLocalAppData, "CalebsModClient")

func EnsureLocalFolderExists() error {
	return os.MkdirAll(pathToCalebsModClient, 0755)
}

func GetFileInLocalFolder(filename string) ([]byte, error) {
	file, err := os.ReadFile(path.Join(pathToCalebsModClient, filename))
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

	err = os.WriteFile(path.Join(pathToCalebsModClient, filename), data, 0644)
	if err != nil {
		return err
	}
	return nil
}
