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
		Title:  "CalebsModClient",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
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
