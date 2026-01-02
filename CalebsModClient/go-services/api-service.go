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
