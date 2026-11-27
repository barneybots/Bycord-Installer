package main

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const AppVersion = "0.1.0"

// App é o que a interface enxerga do Go.
type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// InstallOptions é o que a pessoa escolheu nas telas.
type InstallOptions struct {
	Branch string `json:"branch"`
	Mode   string `json:"mode"`   // rapido ou completo
	Folder string `json:"folder"` // só no modo completo
}

// Progress é enviado para a interface durante a instalação.
type Progress struct {
	Step  int    `json:"step"`
	Total int    `json:"total"`
	Label string `json:"label"`
	Log   string `json:"log"`
	Done  bool   `json:"done"`
}

func (a *App) Version() string { return AppVersion }

func (a *App) ListDiscords() []DiscordInstall { return FindDiscords() }

func (a *App) CheckRequirements() []Requirement { return CheckRequirements() }

// DefaultRepoFolder sugere Documentos\Bycord para o modo completo.
func (a *App) DefaultRepoFolder() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Documents", "Bycord")
}

func (a *App) ChooseFolder() string {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "Onde guardar o repositório do Bycord",
		DefaultDirectory:     filepath.Dir(a.DefaultRepoFolder()),
		CanCreateDirectories: true,
	})
	if err != nil || dir == "" {
		return ""
	}
	return filepath.Join(dir, "Bycord")
}

type step struct{ label, log string }

// Install ainda é uma DEMONSTRAÇÃO: só mostra as etapas, sem baixar nem mexer no Discord.
func (a *App) Install(opts InstallOptions) {
	steps := []step{
		{"Fechando o Discord", "Procurando processos do Discord... (demonstração)"},
		{"Baixando o Bycord", "Baixando os arquivos do release devbuild... (demonstração)"},
		{"Aplicando o patch", "Guardando o app.asar original como _app.asar... (demonstração)"},
		{"Conferindo", "Conferindo se o patch aponta para o Bycord... (demonstração)"},
	}
	if opts.Mode == "completo" {
		steps = []step{
			{"Fechando o Discord", "Procurando processos do Discord... (demonstração)"},
			{"Clonando o repositório", "git clone https://github.com/barneybots/Bycord " + opts.Folder + " (demonstração)"},
			{"Instalando dependências", "pnpm install (demonstração)"},
			{"Compilando", "pnpm build (demonstração)"},
			{"Aplicando o patch", "Guardando o app.asar original como _app.asar... (demonstração)"},
		}
	}

	go func() {
		for i, s := range steps {
			runtime.EventsEmit(a.ctx, "install:progress", Progress{Step: i + 1, Total: len(steps), Label: s.label, Log: s.log})
			time.Sleep(900 * time.Millisecond)
		}
		runtime.EventsEmit(a.ctx, "install:progress", Progress{Step: len(steps), Total: len(steps), Label: "Pronto", Log: "Demonstração concluída. Nada foi alterado no seu PC.", Done: true})
	}()
}

func (a *App) OpenURL(url string) { runtime.BrowserOpenURL(a.ctx, url) }

func (a *App) Minimise() { runtime.WindowMinimise(a.ctx) }

func (a *App) Quit() { runtime.Quit(a.ctx) }
