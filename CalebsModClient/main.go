package main

import (
	"CalebsModClient/notificationagent"
	"context"
	"embed"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	if notificationagent.IsAgentMode() {
		if err := notificationagent.RunAgent(); err != nil {
			_, _ = os.Stderr.WriteString("Notification agent error: " + err.Error() + "\n")
			os.Exit(1)
		}
		return
	}

	app := NewApp()
	admin := NewAdmin()
	minecraft := NewMinecraftService()
	notifications := NewNotificationService()

	err := wails.Run(&options.App{
		Title:     "CalebsMod",
		Width:     1024,
		Height:    768,
		MinWidth:  820,
		MinHeight: 620,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// Matches --bg in the frontend so the window does not flash a
		// different colour before the web view paints.
		BackgroundColour: &options.RGBA{R: 244, G: 242, B: 236, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			admin.startup(ctx)
			minecraft.startup(ctx)
			notifications.startup(ctx)
		},
		Bind: []interface{}{
			app,
			admin,
			minecraft,
			notifications,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
