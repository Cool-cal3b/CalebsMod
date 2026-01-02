package go_services

import (
	"encoding/json"
	"time"
)

var tempToken string = ""
var tokenExpiresAt int64 = 0
var keyFileName string = "admin-key.json"

func Login() error {
	adminKey, err := GetAdminKey()
	if err != nil {
		return err
	}

	requestBody := map[string]string{
		"adminSecret": adminKey,
	}

	requestBodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return err
	}

	apiResponse, err := MakePostRequestToServer("/api/auth/admin/login", requestBodyBytes)
	if err != nil {
		return err
	}

	var apiResponseData struct {
		AccessToken string `json:"access_token"`
		ExpiresAt   int64  `json:"expires_at"`
	}
	err = json.Unmarshal(apiResponse, &apiResponseData)
	if err != nil {
		return err
	}

	tempToken = apiResponseData.AccessToken
	tokenExpiresAt = apiResponseData.ExpiresAt
	return nil
}

func IsLoggedIn() bool {
	return tempToken != "" && time.Now().UnixMilli() < tokenExpiresAt
}

func GetToken() string {
	if IsLoggedIn() {
		return tempToken
	}
	return ""
}

func GetAdminKey() (string, error) {
	keyBytes, err := GetFileInLocalFolder(keyFileName)
	if err != nil {
		return "", err
	}

	var keyData struct {
		AdminSecret string `json:"adminSecret"`
	}

	err = json.Unmarshal(keyBytes, &keyData)
	if err != nil {
		return "", err
	}

	return keyData.AdminSecret, nil
}

func SetAdminKey(key string) error {
	err := EnsureLocalFolderExists()
	if err != nil {
		return err
	}

	keyData := map[string]string{
		"adminSecret": key,
	}

	keyBytes, err := json.Marshal(keyData)
	if err != nil {
		return err
	}

	return SaveFileInLocalFolder(keyFileName, keyBytes)
}
