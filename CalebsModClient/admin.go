package main

import (
	go_services "CalebsModClient/go-services"
)

func AdminKeyIsSet() bool {
	key, err := go_services.GetAdminKey()
	if err != nil {
		return false
	}
	return len(key) > 0
}

func IsLoggedIn() bool {
	return go_services.IsLoggedIn()
}

func Login() error {
	return go_services.Login()
}

func SetAdminKey(key string) error {
	return go_services.SetAdminKey(key)
}
