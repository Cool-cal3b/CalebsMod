package go_services

import (
	"bytes"
	"io"
	"net/http"
)

func MakePostRequestToServer(url string, body []byte) ([]byte, error) {
	baseUrl := GetServerUrl()
	resp, err := http.Post(baseUrl+url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func MakeAuthenticatedPostRequest(url string, body []byte) ([]byte, error) {
	token := GetToken()
	if token == "" {
		return nil, http.ErrNotSupported
	}

	baseUrl := GetServerUrl()
	req, err := http.NewRequest("POST", baseUrl+url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

func MakeAuthenticatedGetRequest(url string) ([]byte, error) {
	token := GetToken()
	if token == "" {
		return nil, http.ErrNotSupported
	}

	baseUrl := GetServerUrl()
	req, err := http.NewRequest("GET", baseUrl+url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}
