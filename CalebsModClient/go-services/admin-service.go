package go_services

import "encoding/json"

func StartServer() (ServerStatus, string, error) {
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
