package main

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

// Modo Completo: o código do Bycord fica numa pasta da pessoa (git clone), é compilado ali
// (pnpm install + pnpm build) e o Discord passa a carregar <pasta>\dist\patcher.js.
// Uma build assim já vem com o atualizador por git: dentro do Discord ele faz git pull e compila de novo.

const repoURL = "https://github.com/barneybots/Bycord"

// repoPatcher é o patcher.js que a build da pasta gera.
func repoPatcher(repo string) string { return filepath.Join(repo, "dist", "patcher.js") }

// installKind diz como um Bycord foi instalado olhando o patcher.js para onde o patch aponta.
func installKind(modPath string) (kind, repo string) {
	if modPath == "" {
		return "", ""
	}
	if samePath(modPath, quickPatcherPath()) {
		return "rapido", ""
	}
	dir := filepath.Dir(filepath.Dir(modPath))
	if isBycordRepo(dir) {
		return "completo", dir
	}
	return "", ""
}

// isBycordRepo confere se a pasta é um clone do Bycord (tem .git, o package.json do Bycord e src/bycord).
func isBycordRepo(dir string) bool {
	if !exists(filepath.Join(dir, ".git")) {
		return false
	}
	b, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if err != nil || !bytes.Contains(b, []byte(`"name": "bycord"`)) {
		return false
	}
	return exists(filepath.Join(dir, "src", "bycord"))
}

// folderState: "new" (não existe ou está vazia), "bycord" (já é um clone do Bycord) ou erro.
func folderState(dir string) (string, error) {
	if strings.TrimSpace(dir) == "" || !filepath.IsAbs(dir) {
		return "", errors.New("escolha uma pasta para o código")
	}
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) || (err == nil && len(entries) == 0) {
		return "new", nil
	}
	if err != nil {
		return "", fmt.Errorf("não consegui ler a pasta %s: %w", dir, err)
	}
	if isBycordRepo(dir) {
		return "bycord", nil
	}
	return "", fmt.Errorf("a pasta %s já tem outros arquivos e não é o código do Bycord; escolha outra pasta", dir)
}

var ansiRe = regexp.MustCompile(`\x1b\[[0-9;?]*[A-Za-z]`)

// runTool roda um comando na pasta dir e manda cada linha da saída para o log.
func runTool(ctx context.Context, dir string, log func(string), name string, args ...string) error {
	path, err := exec.LookPath(name)
	if err != nil {
		return fmt.Errorf("não achei o %s no PATH; instale e abra o instalador de novo", name)
	}
	cmd := exec.CommandContext(ctx, path, args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "NO_COLOR=1", "FORCE_COLOR=0", "GIT_TERMINAL_PROMPT=0")
	hideWindow(cmd)

	pr, pw := io.Pipe()
	cmd.Stdout = pw
	cmd.Stderr = pw

	// Guarda as últimas linhas para explicar o erro, se der.
	var mu sync.Mutex
	var tail []string
	done := make(chan struct{})
	go func() {
		defer close(done)
		sc := bufio.NewScanner(pr)
		sc.Buffer(make([]byte, 64*1024), 1024*1024)
		sc.Split(scanLinesCR)
		for sc.Scan() {
			line := strings.TrimSpace(ansiRe.ReplaceAllString(sc.Text(), ""))
			if line == "" {
				continue
			}
			log(line)
			mu.Lock()
			tail = append(tail, line)
			if len(tail) > 6 {
				tail = tail[1:]
			}
			mu.Unlock()
		}
		io.Copy(io.Discard, pr)
	}()

	log("> " + name + " " + strings.Join(args, " "))
	if err := cmd.Start(); err != nil {
		pw.Close()
		<-done
		return fmt.Errorf("não consegui rodar o %s: %w", name, err)
	}
	err = cmd.Wait()
	pw.Close()
	<-done
	if err != nil {
		mu.Lock()
		last := strings.Join(tail, " · ")
		mu.Unlock()
		if last != "" {
			return fmt.Errorf("o comando %s %s falhou: %s", name, strings.Join(args, " "), last)
		}
		return fmt.Errorf("o comando %s %s falhou: %w", name, strings.Join(args, " "), err)
	}
	return nil
}

// scanLinesCR separa por \n e também por \r (o git usa \r para a barra de progresso).
func scanLinesCR(data []byte, atEOF bool) (int, []byte, error) {
	if atEOF && len(data) == 0 {
		return 0, nil, nil
	}
	if i := bytes.IndexAny(data, "\r\n"); i >= 0 {
		return i + 1, data[:i], nil
	}
	if atEOF {
		return len(data), data, nil
	}
	return 0, nil, nil
}

// sourceSteps deixa o código pronto e compilado na pasta: clona (ou atualiza, se já for o Bycord),
// instala as dependências e compila.
func (a *App) sourceSteps(folder string) []step {
	ctx := a.context()
	return []step{
		{"Baixando o código", func(log func(string)) error {
			state, err := folderState(folder)
			if err != nil {
				return err
			}
			if state == "bycord" {
				log("A pasta já tem o código do Bycord: buscando as novidades.")
				return runTool(ctx, folder, log, "git", "pull", "--ff-only")
			}
			if err := os.MkdirAll(filepath.Dir(folder), 0o755); err != nil {
				return err
			}
			// blob:none baixa o histórico sem os arquivos antigos: bem menor, e o git pull continua normal.
			return runTool(ctx, filepath.Dir(folder), log, "git", "clone", "--progress", "--filter=blob:none", repoURL, folder)
		}},
		installDepsStep(ctx, folder),
		buildStep(ctx, folder),
	}
}

func installDepsStep(ctx context.Context, folder string) step {
	return step{"Instalando dependências", func(log func(string)) error {
		log("Pode levar alguns minutos na primeira vez.")
		return runTool(ctx, folder, log, "pnpm", "install", "--frozen-lockfile")
	}}
}

func buildStep(ctx context.Context, folder string) step {
	return step{"Compilando", func(log func(string)) error {
		if err := runTool(ctx, folder, log, "pnpm", "build"); err != nil {
			return err
		}
		if !isBycordPatcher(repoPatcher(folder)) {
			return fmt.Errorf("a build terminou, mas %s não é o patcher do Bycord", repoPatcher(folder))
		}
		return nil
	}}
}

func (a *App) context() context.Context {
	if a.ctx != nil {
		return a.ctx
	}
	return context.Background()
}

/* ---------------- Plugins da pessoa (src/userplugins) ---------------- */

// UserPlugin é um plugin em src/userplugins.
type UserPlugin struct {
	Name   string `json:"name"`   // o name do definePlugin, ou o nome da pasta
	Folder string `json:"folder"` // pasta ou arquivo dentro de src/userplugins
	Path   string `json:"path"`
}

func userPluginsDir(repo string) string { return filepath.Join(repo, "src", "userplugins") }

var pluginNameRe = regexp.MustCompile(`definePlugin\(\{[\s\S]*?\bname:\s*["'\x60]([^"'\x60]+)["'\x60]`)

// listUserPlugins lista os plugins da pessoa: pastas com index.ts(x) e arquivos .ts(x) soltos.
func listUserPlugins(repo string) ([]UserPlugin, error) {
	if !isBycordRepo(repo) {
		return nil, errors.New("essa pasta não é o código do Bycord")
	}
	entries, err := os.ReadDir(userPluginsDir(repo))
	if errors.Is(err, os.ErrNotExist) {
		return []UserPlugin{}, nil
	}
	if err != nil {
		return nil, err
	}
	out := []UserPlugin{}
	for _, e := range entries {
		full := filepath.Join(userPluginsDir(repo), e.Name())
		main := full
		if e.IsDir() {
			main = ""
			for _, f := range []string{"index.ts", "index.tsx", "index.js", "index.jsx"} {
				if exists(filepath.Join(full, f)) {
					main = filepath.Join(full, f)
					break
				}
			}
			if main == "" {
				continue
			}
		} else if ext := filepath.Ext(e.Name()); ext != ".ts" && ext != ".tsx" && ext != ".js" && ext != ".jsx" {
			continue
		}
		p := UserPlugin{Name: strings.TrimSuffix(e.Name(), filepath.Ext(e.Name())), Folder: e.Name(), Path: full}
		if b, err := os.ReadFile(main); err == nil {
			if m := pluginNameRe.FindSubmatch(b); m != nil {
				p.Name = string(m[1])
			}
		}
		out = append(out, p)
	}
	return out, nil
}

var newPluginRe = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9]{1,39}$`)

// createUserPlugin cria src/userplugins/<nome>/index.ts a partir do modelo. Não sobrescreve nada.
func createUserPlugin(repo, name, description, author string) (string, error) {
	if !isBycordRepo(repo) {
		return "", errors.New("essa pasta não é o código do Bycord")
	}
	name = strings.TrimSpace(name)
	if !newPluginRe.MatchString(name) {
		return "", errors.New("o nome precisa ter de 2 a 40 letras ou números, começando com letra e sem espaços (ex.: MeuPlugin)")
	}
	description = strings.TrimSpace(description)
	if description == "" {
		description = "Meu primeiro plugin do Bycord."
	}
	author = strings.TrimSpace(author)
	if author == "" {
		author = "Eu"
	}

	folder := strings.ToLower(name[:1]) + name[1:]
	if taken := pluginFolderTaken(repo, folder); taken != "" {
		return "", fmt.Errorf("já existe um plugin chamado %s (%s); escolha outro nome", name, taken)
	}

	dir := filepath.Join(userPluginsDir(repo), folder)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	file := filepath.Join(dir, "index.ts")
	f, err := os.OpenFile(file, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", fmt.Errorf("não consegui criar %s: %w", file, err)
	}
	defer f.Close()
	_, err = f.WriteString(pluginTemplate(name, description, author))
	return file, err
}

// pluginFolderTaken procura uma pasta de plugin com o mesmo nome (sem diferenciar maiúsculas).
func pluginFolderTaken(repo, folder string) string {
	roots := []string{"plugins", "bycordplugins", "userplugins"}
	for _, r := range roots {
		base := filepath.Join(repo, "src", r)
		var found string
		filepath.WalkDir(base, func(p string, d os.DirEntry, err error) error {
			if err != nil || found != "" {
				return nil
			}
			rel, _ := filepath.Rel(base, p)
			if depth := strings.Count(rel, string(filepath.Separator)); depth > 1 {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			stem := strings.TrimSuffix(d.Name(), filepath.Ext(d.Name()))
			if strings.EqualFold(stem, folder) {
				found = "src/" + r + "/" + filepath.ToSlash(rel)
			}
			return nil
		})
		if found != "" {
			return found
		}
	}
	return ""
}

func jsString(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", " ", "\r", "")
	return `"` + r.Replace(s) + `"`
}

func pluginTemplate(name, description, author string) string {
	return `/*
 * Plugin pessoal do Bycord. Fica em src/userplugins, que o git ignora:
 * atualizar o Bycord nunca apaga nem mexe neste arquivo.
 *
 * Depois de editar, compile de novo (no instalador: Gerenciar > Meus plugins > Compilar,
 * ou "pnpm build" nesta pasta) e aperte Ctrl+R no Discord. Ligue o plugin na Central de Plugins:
 * ele aparece com o selo "Seu".
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { showToast } from "@webpack/common";

// Opções que aparecem no painel do plugin.
const settings = definePluginSettings({
    mensagem: {
        type: OptionType.STRING,
        description: "Mensagem que aparece quando o plugin liga",
        default: "` + strings.ReplaceAll(name, `"`, "") + ` ligado!",
    },
});

export default definePlugin({
    name: ` + jsString(name) + `,
    description: ` + jsString(description) + `,
    authors: [{ name: ` + jsString(author) + `, id: 0n }],
    settings,

    // Um comando de barra de exemplo: digite /` + strings.ToLower(name) + ` no chat.
    commands: [
        {
            name: ` + jsString(strings.ToLower(name)) + `,
            description: "Responde só para você",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_args, ctx) => {
                sendBotMessage(ctx.channel.id, { content: "Oi! Eu sou o plugin ` + strings.ReplaceAll(name, `"`, "") + `." });
            },
        },
    ],

    // Roda quando o plugin é ligado.
    start() {
        showToast({ text: settings.store.mensagem });
    },

    // Roda quando o plugin é desligado: desfaça aqui o que o start fez.
    stop() {},
});
`
}

// findEditor procura o VS Code (ou o Cursor) no PATH.
func findEditor() string {
	for _, name := range []string{"code", "cursor"} {
		if p, err := exec.LookPath(name); err == nil {
			return p
		}
	}
	return ""
}
