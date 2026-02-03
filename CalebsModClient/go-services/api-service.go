package go_services

import (
	"bytes"
	"io"
	"mime/multipart"
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

func MakeAuthenticatedPostRequestWithFile(url string, fieldName string, fileContent []byte, fileName string) ([]byte, error) {
	token := GetToken()
	if token == "" {
		return nil, http.ErrNotSupported
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile(fieldName, fileName)
	if err != nil {
		return nil, err
	}

	_, err = part.Write(fileContent)
	if err != nil {
		return nil, err
	}

	err = writer.Close()
	if err != nil {
		return nil, err
	}

	baseUrl := GetServerUrl()
	req, err := http.NewRequest("POST", baseUrl+url, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
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

func MakeAuthenticatedDeleteRequest(url string) ([]byte, error) {
	token := GetToken()
	if token == "" {
		return nil, http.ErrNotSupported
	}

	baseUrl := GetServerUrl()
	req, err := http.NewRequest("DELETE", baseUrl+url, nil)
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

func MakeAuthenticatedPatchRequest(url string, body []byte) ([]byte, error) {
	token := GetToken()
	if token == "" {
		return nil, http.ErrNotSupported
	}

	baseUrl := GetServerUrl()
	req, err := http.NewRequest("PATCH", baseUrl+url, bytes.NewBuffer(body))
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

func MakeGetRequest(url string) (*http.Response, error) {
	baseUrl := GetServerUrl()
	req, err := http.NewRequest("GET", baseUrl+url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	return client.Do(req)
}
