package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	admin := NewAdmin()
	minecraft := NewMinecraftService()

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
		},
		Bind: []interface{}{
			app,
			admin,
			minecraft,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
