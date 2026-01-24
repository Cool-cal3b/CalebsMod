package main

import (
	"CalebsModClient/go-services"
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

func (m *MinecraftService) CheckForgeInstalled() (bool, error) {
	return go_services.CheckForgeInstalled()
}

func (m *MinecraftService) InstallForge() (bool, error) {
	return go_services.InstallForge()
}
