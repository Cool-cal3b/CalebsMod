package main

import (
	go_services "CalebsModClient/go-services"
	"context"
	"fmt"
	"os"
	"time"

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

	go_services.SetUpdateProgressHandler(func(p go_services.UpdateProgress) {
		runtime.EventsEmit(ctx, "update:progress", p)
	})

	// Sweep the binary this process replaced on the previous run. Doing it at
	// startup rather than right after the swap is deliberate: the old file is
	// still open until the process that launched us exits.
	go go_services.CleanupStaleUpdateFiles()

	// Keep the Start menu entry alive on every launch, and refresh the Windows
	// notification identity on shortcuts created by older releases.
	go func() {
		if err := go_services.EnsureClientShortcut(); err != nil {
			fmt.Printf("Note: could not create the Start Menu shortcut: %v\n", err)
		}
	}()
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

func (m *MinecraftService) GetRecentPlayers() (go_services.RecentPlayersResponse, error) {
	return go_services.GetRecentPlayers()
}

func (m *MinecraftService) GetDocumentationList() ([]go_services.DocumentationSummary, error) {
	return go_services.GetDocumentationList()
}

func (m *MinecraftService) GetDocumentation(id string) (go_services.DocumentationDocument, error) {
	return go_services.GetDocumentation(id)
}

func (m *MinecraftService) GetClientVersion() string {
	return go_services.GetClientVersion()
}

func (m *MinecraftService) CheckForClientUpdate() go_services.UpdateStatus {
	return go_services.CheckForClientUpdate()
}

// How long the graceful window close gets before this process exits anyway.
// Long enough that a slow shutdown is not cut short, short enough that a user
// watching the update never sees two windows side by side.
const quitGraceDuration = 3 * time.Second

// ApplyClientUpdate installs the newer client and restarts into it. It returns
// as soon as the replacement succeeds so the UI can say what is happening; the
// window then closes a moment later, once the new process is on screen.
func (m *MinecraftService) ApplyClientUpdate() error {
	exePath, err := go_services.ApplyClientUpdate()
	if err != nil {
		return err
	}

	if err := go_services.RelaunchClient(exePath); err != nil {
		_ = go_services.EnsureNotificationAgentRunning()
		return err
	}

	go func() {
		time.Sleep(750 * time.Millisecond)
		runtime.Quit(m.ctx)

		// runtime.Quit only asks the window to close, and that request has been
		// observed not to take effect: after an update it left the old process
		// running beside the new one, two identical windows on screen with no
		// way to tell which was which. By this point the new client is already
		// up and this process owns nothing worth saving - it is holding the
		// replaced binary open, which is what stops the next launch from
		// tidying it away. So give the graceful path a moment and then leave
		// regardless.
		time.Sleep(quitGraceDuration)
		os.Exit(0)
	}()

	return nil
}
