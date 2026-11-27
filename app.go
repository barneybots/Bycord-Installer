package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const AppVersion = "0.4.0"

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

// Install instala o Bycord. No modo Rápido baixa a build pronta; no Completo clona e compila o código.
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
		folder := filepath.Clean(opts.Folder)
		if _, err := folderState(folder); err != nil {
			a.run([]step{{"Preparando", func(func(string)) error { return err }}})
			return
		}
		// Compila antes de fechar o Discord: ele só fecha quando o patch está para ser aplicado.
		steps := append(a.sourceSteps(folder), closeStep(inst))
		a.run(append(steps, patchSteps(inst, repoPatcher(folder))...))
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
	// No modo Completo, se a build sumiu, compila de novo antes de aplicar o patch.
	if kind, repo := installKind(inst.ModPath); kind == "completo" {
		var steps []step
		if !isBycordPatcher(repoPatcher(repo)) {
			steps = append(steps, installDepsStep(a.context(), repo), buildStep(a.context(), repo))
		}
		steps = append(steps, closeStep(inst))
		a.run(append(steps, patchSteps(inst, repoPatcher(repo))...))
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

// Update traz o Bycord mais novo. No modo Rápido baixa a build pronta para %APPDATA%\Bycord\dist
// (a mesma para todos os Discords no modo Rápido); no Completo faz git pull e compila de novo.
func (a *App) Update(branch string) {
	inst, err := findInstall(branch)
	if err == nil && inst.State != "bycord" {
		err = errors.New("esse Discord não está com o Bycord")
	}
	kind, repo := installKind(inst.ModPath)
	if err == nil && kind == "" {
		err = fmt.Errorf("não reconheci a instalação em %s; use Trocar de modo para instalar de novo", inst.ModPath)
	}
	if err != nil {
		a.run([]step{{"Preparando", func(func(string)) error { return err }}})
		return
	}
	finish := step{"Concluindo", func(log func(string)) error {
		log("Reinicie o Discord para usar a versão nova.")
		return nil
	}}
	if kind == "completo" {
		a.run(append(a.sourceSteps(repo), finish))
		return
	}
	a.run([]step{a.downloadStep(), finish})
}

// Build compila de novo o código da pasta (modo Completo), por exemplo depois de mexer num plugin.
func (a *App) Build(branch string) {
	inst, err := findInstall(branch)
	kind, repo := installKind(inst.ModPath)
	if err == nil && kind != "completo" {
		err = errors.New("só dá para compilar no modo Completo")
	}
	if err != nil {
		a.run([]step{{"Preparando", func(func(string)) error { return err }}})
		return
	}
	a.run([]step{buildStep(a.context(), repo), {"Concluindo", func(log func(string)) error {
		log("Aperte Ctrl+R no Discord para carregar a build nova (plugin novo começa desligado).")
		return nil
	}}})
}

// UserPlugins lista os plugins da pessoa no código do Bycord desse Discord.
func (a *App) UserPlugins(branch string) ([]UserPlugin, error) {
	repo, err := repoOf(branch)
	if err != nil {
		return nil, err
	}
	return listUserPlugins(repo)
}

// CreateUserPlugin cria um plugin novo a partir do modelo e devolve o caminho do index.ts.
func (a *App) CreateUserPlugin(branch, name, description, author string) (string, error) {
	repo, err := repoOf(branch)
	if err != nil {
		return "", err
	}
	return createUserPlugin(repo, name, description, author)
}

// HasEditor diz se o VS Code (ou o Cursor) está instalado.
func (a *App) HasEditor() bool { return findEditor() != "" }

// OpenInEditor abre o código do Bycord no editor, com um arquivo já aberto se for passado.
func (a *App) OpenInEditor(branch, file string) string {
	repo, err := repoOf(branch)
	if err != nil {
		return err.Error()
	}
	editor := findEditor()
	if editor == "" {
		return "não achei o VS Code; instale em code.visualstudio.com"
	}
	args := []string{repo}
	if file != "" && isInside(file, repo) {
		args = append(args, "--goto", file)
	}
	cmd := exec.Command(editor, args...)
	hideWindow(cmd)
	if err := cmd.Start(); err != nil {
		return err.Error()
	}
	go cmd.Wait()
	return ""
}

// OpenFolder abre no Explorer uma pasta do código do Bycord desse Discord ("" = a raiz, "userplugins").
func (a *App) OpenFolder(branch, which string) string {
	repo, err := repoOf(branch)
	if err != nil {
		return err.Error()
	}
	dir := repo
	if which == "userplugins" {
		dir = userPluginsDir(repo)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err.Error()
		}
	}
	if err := exec.Command("explorer.exe", dir).Start(); err != nil {
		return err.Error()
	}
	return ""
}

func repoOf(branch string) (string, error) {
	inst, err := findInstall(branch)
	if err != nil {
		return "", err
	}
	kind, repo := installKind(inst.ModPath)
	if inst.State != "bycord" || kind != "completo" {
		return "", errors.New("esse Discord não está com o Bycord no modo Completo")
	}
	return repo, nil
}

func isInside(path, root string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && !strings.HasPrefix(rel, "..") && !filepath.IsAbs(rel)
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
	_, repo := installKind(inst.ModPath)
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
			if repo != "" {
				log("O código continua em " + repo + ". Apague a pasta se não for mais usar.")
			}
			return nil
		}},
	})
}
