package go_services

import (
	"encoding/json"
	"fmt"
)

func GetServerStatus() (ServerStatusResponse, error) {
	response, err := MakeAuthenticatedGetRequest("/api/server/status")
	if err != nil {
		return ServerStatusResponse{}, err
	}

	var serverStatusResponse ServerStatusResponse
	err = json.Unmarshal(response, &serverStatusResponse)
	if err != nil {
		return ServerStatusResponse{}, err
	}

	return serverStatusResponse, nil
}

func StartServer() (ServerStatus, string, error) {
	fmt.Println("Starting server...")
	response, err := MakeAuthenticatedPostRequest("/api/server/start", nil)
	if err != nil {
		return ServerStatusError, "", err
	}

	err = json.Unmarshal(response, &minecraftServerResponseData)
	if err != nil {
		return ServerStatusError, "", err
	}
	return minecraftServerResponseData.Status, minecraftServerResponseData.Message, nil
}

func StopServer() (ServerStatus, string, error) {
	response, err := MakeAuthenticatedPostRequest("/api/server/stop", nil)
	if err != nil {
		return ServerStatusError, "", err
	}

	err = json.Unmarshal(response, &minecraftServerResponseData)
	if err != nil {
		return ServerStatusError, "", err
	}

	return minecraftServerResponseData.Status, minecraftServerResponseData.Message, nil
}

func UpdateDns() (bool, string, error) {
	response, err := MakeAuthenticatedPostRequest("/api/server/update-dns", nil)
	if err != nil {
		return false, "", err
	}

	var genericResponseData struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}

	err = json.Unmarshal(response, &genericResponseData)
	if err != nil {
		return false, "", err
	}

	return genericResponseData.Success, genericResponseData.Message, nil
}

var minecraftServerResponseData struct {
	Status  ServerStatus `json:"status"`
	Message string       `json:"message"`
}

type ServerStatus string

const (
	ServerStatusStarted        ServerStatus = "started"
	ServerStatusAlreadyRunning ServerStatus = "already_running"
	ServerStatusStopped        ServerStatus = "stopped"
	ServerStatusAlreadyStopped ServerStatus = "already_stopped"
	ServerStatusNotFound       ServerStatus = "not_found"
	ServerStatusError          ServerStatus = "error"
)

type ServerStatusResponse struct {
	DockerStatus  DockerStatus `json:"dockerStatus"`
	RconConnected bool         `json:"rconConnected"`
	Players       PlayersInfo  `json:"players"`
}

type DockerStatus struct {
	Exists     bool   `json:"exists"`
	Running    bool   `json:"running"`
	Status     string `json:"status"`
	StartedAt  string `json:"startedAt"`
	FinishedAt string `json:"finishedAt"`
}

type PlayersInfo struct {
	Online  int      `json:"online"`
	Max     int      `json:"max"`
	Players []string `json:"players"`
}

type ModpackUploadResponse struct {
	FilesProcessed int               `json:"filesProcessed"`
	Files          []ModpackFileInfo `json:"files"`
}

type ModpackFileInfo struct {
	Sha256       string `json:"sha256"`
	FileName     string `json:"fileName"`
	FileSize     int    `json:"fileSize"`
	FileType     string `json:"fileType"`
	RelativePath string `json:"relativePath"`
}

func UploadModpackZip(fileContent []byte, fileName string) (*ModpackUploadResponse, error) {
	url := "/api/modpack/upload-zip"
	fmt.Println("Uploading modpack zip to ", url)
	response, err := MakeAuthenticatedPostRequestWithFile(url, "file", fileContent, fileName)
	fmt.Println("Response: ", string(response))
	if err != nil {
		return nil, err
	}

	var uploadResponse ModpackUploadResponse
	err = json.Unmarshal(response, &uploadResponse)
	if err != nil {
		return nil, err
	}

	return &uploadResponse, nil
}

func UploadModpackZipFromPath(filePath string) (*ModpackUploadResponse, error) {
	fileContent, err := ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	fileName := filePath[len(filePath)-1:]
	for i := len(filePath) - 1; i >= 0; i-- {
		if filePath[i] == '/' || filePath[i] == '\\' {
			fileName = filePath[i+1:]
			break
		}
	}

	return UploadModpackZip(fileContent, fileName)
}

func GetManifest() ([]PackFileDto, error) {
	response, err := MakeAuthenticatedGetRequest("/api/modpack/manifest")
	if err != nil {
		return nil, err
	}

	var files []PackFileDto
	err = json.Unmarshal(response, &files)
	if err != nil {
		return nil, err
	}

	return files, nil
}

func DeleteAllFiles() error {
	_, err := MakeAuthenticatedDeleteRequest("/api/modpack/files")
	return err
}

type PackFileDto struct {
	Sha256       string `json:"sha256"`
	FileName     string `json:"fileName"`
	FileSize     int    `json:"fileSize"`
	FileType     string `json:"fileType"`
	RelativePath string `json:"relativePath"`
	OriginalUrl  string `json:"originalUrl"`
	ModId        string `json:"modId"`
	ModVersion   string `json:"modVersion"`
	Required     bool   `json:"required"`
}
