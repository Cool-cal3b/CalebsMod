package main

import (
	"context"
	go_services "CalebsModClient/go-services"
	
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type Admin struct {
	ctx context.Context
}

func NewAdmin() *Admin {
	return &Admin{}
}

func (a *Admin) startup(ctx context.Context) {
	a.ctx = ctx
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

func (a *Admin) GetServerStatus() (go_services.ServerStatusResponse, error) {
	return go_services.GetServerStatus()
}

func (a *Admin) StartServer() (go_services.ServerStatus, string, error) {
	return go_services.StartServer()
}

func (a *Admin) StopServer() (go_services.ServerStatus, string, error) {
	return go_services.StopServer()
}

func (a *Admin) RestartServer() (go_services.ServerStatus, string, error) {
	return go_services.RestartServer()
}

func (a *Admin) UpdateDns() (bool, string, error) {
	return go_services.UpdateDns()
}

func (a *Admin) GetServerSettings() (go_services.ServerSettingsResponse, error) {
	return go_services.GetServerSettings()
}

func (a *Admin) UpdateServerSettings(settings map[string]string) (go_services.ServerSettingsResponse, error) {
	return go_services.UpdateServerSettings(settings)
}

func (a *Admin) GetToken() string {
	return go_services.GetToken()
}

func (a *Admin) UploadModpackZip(fileContent []byte, fileName string) (*go_services.ModpackUploadResponse, error) {
	return go_services.UploadModpackZip(fileContent, fileName)
}

func (a *Admin) SelectAndUploadModpackZip() (*go_services.ModpackUploadResponse, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Modpack ZIP",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "ZIP Files (*.zip)",
				Pattern:     "*.zip",
			},
		},
	})
	if err != nil {
		return nil, err
	}
	if filePath == "" {
		return nil, nil
	}
	return go_services.UploadModpackZipFromPath(filePath)
}

func (a *Admin) GetManifest() ([]go_services.PackFileDto, error) {
	return go_services.GetManifest()
}

func (a *Admin) GetAllFiles(search string) ([]go_services.PackFileDto, error) {
	return go_services.GetAllFiles(search)
}

func (a *Admin) UpdateFileFlags(sha256 string, serverOnly bool, clientOnly bool) error {
	return go_services.UpdateFileFlags(sha256, serverOnly, clientOnly)
}

func (a *Admin) CreateFullResync() error {
	return go_services.CreateFullResync()
}

func (a *Admin) DeleteAllFiles() error {
	return go_services.DeleteAllFiles()
}

func (a *Admin) DeleteFile(sha256 string) error {
	return go_services.DeleteFile(sha256)
}
