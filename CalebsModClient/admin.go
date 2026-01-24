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

func (a *Admin) ClearAdminKey() error {
	return go_services.ClearAdminKey()
}

func (a *Admin) StartServer() (go_services.ServerStatus, string, error) {
	return go_services.StartServer()
}

func (a *Admin) StopServer() (go_services.ServerStatus, string, error) {
	return go_services.StopServer()
}

func (a *Admin) UpdateDns() (bool, string, error) {
	return go_services.UpdateDns()
}

func (a *Admin) GetToken() string {
	return go_services.GetToken()
}
