package main

import (
	go_services "CalebsModClient/go-services"
	"context"
)

type MinecraftService struct {
	ctx context.Context
}

func NewMinecraftService() *MinecraftService {
	return &MinecraftService{}
}

func (m *MinecraftService) startup(ctx context.Context) {
	m.ctx = ctx
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
