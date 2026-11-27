package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const AppVersion = "0.3.0"

// App é o que a interface enxerga do Go.
type App struct {
	ctx  context.Context
	busy sync.Mutex
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// InstallOptions é o que a pessoa escolheu nas telas.
type InstallOptions struct {
	Branch       string `json:"branch"`
	Mode         string `json:"mode"`         // rapido ou completo
	Folder       string `json:"folder"`       // só no modo completo
	ReplaceOther bool   `json:"replaceOther"` // a pessoa confirmou trocar outro mod pelo Bycord
}

// Progress é enviado para a interface durante uma operação.
type Progress struct {
	Step  int      `json:"step"`
	Total int      `json:"total"`
	Label string   `json:"label"`
	Log   string   `json:"log"`
	Done  bool     `json:"done"`
	Error string   `json:"error"`
	Steps []string `json:"steps"` // nomes de todas as etapas, para a interface montar a lista
}

func (a *App) Version() string { return AppVersion }

func (a *App) ListDiscords() []DiscordInstall {
	list := FindDiscords()
	for i := range list {
		list[i].Icon = discordIconDataURL(list[i])
	}
	return list
}

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

func (a *App) IsRunning(branch string) bool {
	inst, err := findInstall(branch)
	return err == nil && len(discordProcesses(inst.Path)) > 0
}

func (a *App) OpenDiscord(branch string) string {
	inst, err := findInstall(branch)
	if err == nil {
		err = startDiscord(inst.Path, branch)
	}
	if err != nil {
		return err.Error()
	}
	return ""
}

func (a *App) OpenURL(url string) { runtime.BrowserOpenURL(a.ctx, url) }

func (a *App) Minimise() { runtime.WindowMinimise(a.ctx) }

func (a *App) Quit() { runtime.Quit(a.ctx) }

func findInstall(branch string) (DiscordInstall, error) {
	for _, d := range FindDiscords() {
		if d.Branch == branch {
			if !d.Supported {
				return d, fmt.Errorf("o %s não é suportado", d.Name)
			}
			return d, nil
		}
	}
	return DiscordInstall{}, fmt.Errorf("não achei o Discord %q", branch)
}

// step é uma etapa de uma operação; log manda linhas para o "ver detalhes".
type step struct {
	label string
	run   func(log func(string)) error
}

// run executa as etapas em segundo plano e avisa a interface pelo evento "op:progress".
func (a *App) run(steps []step) {
	go func() {
		if !a.busy.TryLock() {
			runtime.EventsEmit(a.ctx, "op:progress", Progress{Error: "Já tem uma operação em andamento."})
			return
		}
		defer a.busy.Unlock()

		total := len(steps)
		labels := make([]string, total)
		for i, s := range steps {
			labels[i] = s.label
		}
		for i, s := range steps {
			emit := func(line string) {
				runtime.EventsEmit(a.ctx, "op:progress", Progress{Step: i + 1, Total: total, Label: s.label, Log: line, Steps: labels})
			}
			emit(s.label + "...")
			if err := s.run(emit); err != nil {
				runtime.EventsEmit(a.ctx, "op:progress", Progress{Step: i + 1, Total: total, Label: s.label, Log: "Erro: " + err.Error(), Error: err.Error(), Steps: labels})
				return
			}
		}
		runtime.EventsEmit(a.ctx, "op:progress", Progress{Step: total, Total: total, Label: "Pronto", Log: "Tudo certo.", Done: true, Steps: labels})
	}()
}

func closeStep(inst DiscordInstall) step {
	return step{"Fechando o " + inst.Name, func(log func(string)) error {
		if closeDiscord(inst.Path) {
			log("O " + inst.Name + " foi fechado.")
		} else {
			log("O " + inst.Name + " não estava aberto.")
		}
		return nil
	}}
}

func (a *App) downloadStep() step {
	return step{"Baixando o Bycord", func(log func(string)) error {
		_, err := downloadRelease(a.ctx, distDir(), log)
		return err
	}}
}

func patchSteps(inst DiscordInstall, patcher string) []step {
	var resources string
	return []step{
		{"Aplicando o patch", func(log func(string)) error {
			var err error
			if resources, err = resourcesOf(inst.Path); err != nil {
				return err
			}
			log("Pasta: " + resources)
			return patchResources(resources, patcher)
		}},
		{"Conferindo", func(log func(string)) error {
			if err := verifyPatch(resources, patcher); err != nil {
				return err
			}
			log("O " + inst.Name + " agora carrega o Bycord de " + patcher)
			return nil
		}},
	}
}

// Install instala o Bycord. O modo Completo ainda é só demonstração.
func (a *App) Install(opts InstallOptions) {
	inst, err := findInstall(opts.Branch)
	if err == nil && inst.State == "other" && !opts.ReplaceOther {
		err = errors.New("esse Discord tem outro mod e a troca não foi confirmada")
	}
	if err != nil {
		a.run([]step{{"Preparando", func(func(string)) error { return err }}})
		return
	}

	if opts.Mode == "completo" {
		a.run(demoSteps(opts.Folder))
		return
	}

	steps := []step{closeStep(inst), a.downloadStep()}
	a.run(append(steps, patchSteps(inst, quickPatcherPath())...))
}

// Repair aplica o patch de novo (útil quando o Discord se atualiza e o patch some).
func (a *App) Repair(branch string) {
	inst, err := findInstall(branch)
	if err == nil && inst.State == "other" {
		err = fmt.Errorf("esse Discord está com o %s; use Instalar para trocar", inst.Mod)
	}
	if err != nil {
		a.run([]step{{"Preparando", func(func(string)) error { return err }}})
		return
	}
	patcher := inst.ModPath
	if patcher == "" || !exists(patcher) {
		patcher = quickPatcherPath()
	}
	steps := []step{closeStep(inst)}
	if patcher == quickPatcherPath() && !exists(patcher) {
		steps = append(steps, a.downloadStep())
	}
	a.run(append(steps, patchSteps(inst, patcher)...))
}

// Update baixa a build mais nova do Bycord (modo Rápido).
// Os arquivos ficam em %APPDATA%\Bycord\dist, que é o mesmo para todos os Discords com o Bycord no modo Rápido.
func (a *App) Update(branch string) {
	inst, err := findInstall(branch)
	if err == nil && inst.State != "bycord" {
		err = errors.New("esse Discord não está com o Bycord")
	}
	if err == nil && !samePath(inst.ModPath, quickPatcherPath()) {
		err = errors.New("esse Bycord foi instalado pelo modo Completo; atualize pelo atualizador dentro do Discord")
	}
	if err != nil {
		a.run([]step{{"Preparando", func(func(string)) error { return err }}})
		return
	}
	a.run([]step{a.downloadStep(), {"Concluindo", func(log func(string)) error {
		log("Reinicie o Discord para usar a versão nova.")
		return nil
	}}})
}

func samePath(a, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

// Uninstall devolve o Discord ao original. As configurações do Bycord ficam em %APPDATA%\Bycord.
func (a *App) Uninstall(branch string) {
	inst, err := findInstall(branch)
	if err == nil && inst.State != "bycord" {
		err = errors.New("esse Discord não está com o Bycord")
	}
	if err != nil {
		a.run([]step{{"Preparando", func(func(string)) error { return err }}})
		return
	}
	a.run([]step{
		closeStep(inst),
		{"Removendo o patch", func(log func(string)) error {
			resources, err := resourcesOf(inst.Path)
			if err != nil {
				return err
			}
			if err := unpatchResources(resources); err != nil {
				return err
			}
			log("O app.asar original foi restaurado.")
			return nil
		}},
		{"Conferindo", func(log func(string)) error {
			resources, _ := resourcesOf(inst.Path)
			if state, _, _ := patchState(resources); state != "clean" {
				return fmt.Errorf("o Discord ainda não ficou limpo (estado: %s)", state)
			}
			log("Suas configurações continuam em " + bycordDataDir())
			return nil
		}},
	})
}

func demoSteps(folder string) []step {
	wait := func(line string) func(log func(string)) error {
		return func(log func(string)) error {
			log(line + " (demonstração)")
			time.Sleep(800 * time.Millisecond)
			return nil
		}
	}
	return []step{
		{"Clonando o repositório", wait("git clone https://github.com/barneybots/Bycord " + folder)},
		{"Instalando dependências", wait("pnpm install")},
		{"Compilando", wait("pnpm build")},
		{"Aplicando o patch", wait("O modo Completo ainda não altera o Discord.")},
	}
}
