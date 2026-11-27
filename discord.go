package main

import (
	"bytes"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Partes desta detecção seguem o instalador oficial do Vencord
// (https://github.com/Vencord/Installer, GPL-3.0).

// DiscordInstall descreve uma instalação do Discord encontrada no PC.
type DiscordInstall struct {
	Branch    string `json:"branch"`    // stable, ptb, canary, development, phoenix
	Name      string `json:"name"`      // nome para mostrar
	Path      string `json:"path"`      // pasta raiz da instalação
	Version   string `json:"version"`   // versão do app-x.y.z mais recente
	State     string `json:"state"`     // clean, bycord, other, unsupported, broken
	Mod       string `json:"mod"`       // Bycord, Equicord, Vencord ou outro, quando há patch
	ModPath   string `json:"modPath"`   // caminho do patcher.js para onde o patch aponta
	Supported bool   `json:"supported"` // false para o Phoenix
}

var branches = []struct{ dir, branch, name string }{
	{"Discord", "stable", "Discord"},
	{"DiscordPTB", "ptb", "Discord PTB"},
	{"DiscordCanary", "canary", "Discord Canary"},
	{"DiscordDevelopment", "development", "Discord Development"},
}

var requireRe = regexp.MustCompile(`require\("((?:[^"\\]|\\.)*)"\)`)

// FindDiscords procura as instalações do Discord em %LOCALAPPDATA%. Só lê arquivos.
func FindDiscords() []DiscordInstall {
	base := os.Getenv("LOCALAPPDATA")
	var found []DiscordInstall

	for _, b := range branches {
		root := filepath.Join(base, b.dir)
		appDir, version := latestAppDir(root)
		if appDir == "" {
			continue
		}
		inst := DiscordInstall{Branch: b.branch, Name: b.name, Path: root, Version: version, Supported: true}
		inst.State, inst.Mod, inst.ModPath = patchState(filepath.Join(appDir, "resources"))
		found = append(found, inst)
	}

	if exists(filepath.Join(base, "DiscordPhoenix", "app", "Discord.exe")) {
		found = append(found, DiscordInstall{
			Branch: "phoenix", Name: "Discord Phoenix", Path: filepath.Join(base, "DiscordPhoenix"),
			State: "unsupported",
		})
	}

	return found
}

// latestAppDir devolve a pasta app-x.y.z mais nova de uma instalação.
func latestAppDir(root string) (string, string) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return "", ""
	}
	var versions []string
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), "app-") {
			versions = append(versions, strings.TrimPrefix(e.Name(), "app-"))
		}
	}
	if len(versions) == 0 {
		return "", ""
	}
	sort.Slice(versions, func(i, j int) bool { return versionLess(versions[i], versions[j]) })
	v := versions[len(versions)-1]
	return filepath.Join(root, "app-"+v), v
}

func versionLess(a, b string) bool {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < len(pa) && i < len(pb); i++ {
		na, _ := strconv.Atoi(pa[i])
		nb, _ := strconv.Atoi(pb[i])
		if na != nb {
			return na < nb
		}
	}
	return len(pa) < len(pb)
}

// patchState descobre se o Discord está limpo ou com algum mod aplicado.
func patchState(resources string) (state, mod, modPath string) {
	appAsar := filepath.Join(resources, "app.asar")
	_appAsar := filepath.Join(resources, "_app.asar")

	if !exists(_appAsar) {
		if exists(appAsar) {
			return "clean", "", ""
		}
		return "broken", "", ""
	}

	// Com patch, o app.asar vira uma pasta (ou um asar pequeno) com um index.js que faz require do patcher.
	content, err := os.ReadFile(filepath.Join(appAsar, "index.js"))
	if err != nil {
		content, _ = os.ReadFile(appAsar)
	}
	if m := requireRe.FindSubmatch(content); m != nil {
		modPath = strings.ReplaceAll(string(m[1]), `\\`, `\`)
	}

	lower := strings.ToLower(modPath)
	switch {
	case isBycordPatcher(modPath) || strings.Contains(lower, "bycord"):
		return "bycord", "Bycord", modPath
	case strings.Contains(lower, "equicord"):
		return "other", "Equicord", modPath
	case strings.Contains(lower, "vencord"):
		return "other", "Vencord", modPath
	default:
		return "other", "outro mod", modPath
	}
}

// isBycordPatcher olha o conteúdo do patcher.js: no modo Completo a pasta pode ter qualquer nome.
func isBycordPatcher(path string) bool {
	if path == "" {
		return false
	}
	b, err := os.ReadFile(path)
	return err == nil && bytes.Contains(b, []byte("[Bycord] Starting up"))
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
