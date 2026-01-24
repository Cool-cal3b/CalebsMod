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
