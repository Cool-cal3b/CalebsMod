package main

import (
	go_services "CalebsModClient/go-services"
)

type Admin struct {
	ctx interface{}
}

func NewAdmin() *Admin {
	return &Admin{}
}

func (a *Admin) AdminKeyIsSet() bool {
	key, err := go_services.GetAdminKey()
	if err != nil {
		return false
	}
	return len(key) > 0
}

func (a *Admin) IsLoggedIn() bool {
	return go_services.IsLoggedIn()
}

func (a *Admin) Login() error {
	return go_services.Login()
}

func (a *Admin) SetAdminKey(key string) error {
	return go_services.SetAdminKey(key)
}

func (a *Admin) GetToken() string {
	return go_services.GetToken()
}
