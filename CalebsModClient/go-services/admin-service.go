package go_services

import (
	"encoding/json"
	"fmt"
)

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
