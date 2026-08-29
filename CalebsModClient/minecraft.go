package main

import (
	go_services "CalebsModClient/go-services"
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type MinecraftService struct {
	ctx context.Context
}

func NewMinecraftService() *MinecraftService {
	return &MinecraftService{}
}

func (m *MinecraftService) startup(ctx context.Context) {
	m.ctx = ctx

	// Surface sync progress to the UI; a 400MB pack behind a bare spinner is
	// how a half-finished sync gets mistaken for a finished one.
	go_services.SetSyncProgressHandler(func(p go_services.SyncProgress) {
		runtime.EventsEmit(ctx, "sync:progress", p)
	})
}

func (m *MinecraftService) StartMinecraftClient() (bool, error) {
	return go_services.StartMinecraftClient()
}

func (m *MinecraftService) CheckLauncherInstalled() (bool, error) {
	return go_services.CheckLauncherInstalled()
}

func (m *MinecraftService) InstallLauncher() (bool, error) {
	return go_services.InstallLauncher()
}

func (m *MinecraftService) DeleteLauncher() (bool, error) {
	return go_services.DeleteLauncher()
}

func (m *MinecraftService) SyncMods() (bool, error) {
	return go_services.SyncMods()
}

func (m *MinecraftService) ResetClient() (bool, error) {
	return go_services.ResetClient()
}

func (m *MinecraftService) GetClientStatus() (go_services.ClientStatus, error) {
	return go_services.GetClientStatus()
}

func (m *MinecraftService) GetServerStatus() (go_services.ServerStatusResponse, error) {
	return go_services.GetPublicServerStatus()
}

func (m *MinecraftService) GetClientVersion() string {
	return go_services.GetClientVersion()
}
