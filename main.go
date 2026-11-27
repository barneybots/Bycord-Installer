package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "Bycord Installer",
		Width:            920,
		Height:           600,
		DisableResize:    true,
		Frameless:        true,
		BackgroundColour: &options.RGBA{R: 24, G: 24, B: 27, A: 255},
		AssetServer:      &assetserver.Options{Assets: assets},
		OnStartup:        app.startup,
		Bind:             []interface{}{app},
		Windows: &windows.Options{
			Theme: windows.Dark,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
