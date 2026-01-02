package go_services

import (
	"encoding/json"
	"time"
)

var tempToken string = ""
var tokenExpiresAt int64 = 0
var keyFileName string = "key.json"

func Login() error {
	adminKey, err := GetAdminKey()
	if err != nil {
		return err
	}

	// Make a POST request to the server to login
	apiResponse, err := MakePostRequestToServer("/api/auth/admin/login", []byte(adminKey))
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
	return tempToken != "" && time.Now().Unix() < tokenExpiresAt
}

func GetAdminKey() (string, error) {
	keyBytes, err := GetFileInLocalFolder(keyFileName)
	if err != nil {
		return "", err
	}

	var keyData struct {
		Key string `json:"key"`
	}

	err = json.Unmarshal(keyBytes, &keyData)
	if err != nil {
		return "", err
	}

	return keyData.Key, nil
}

func SetAdminKey(key string) error {
	keyBytes, err := json.Marshal(key)
	if err != nil {
		return err
	}
	return SaveFileInLocalFolder(keyFileName, keyBytes)
}
