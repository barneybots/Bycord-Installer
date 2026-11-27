package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFolderState(t *testing.T) {
	dir := t.TempDir()
	if s, err := folderState(filepath.Join(dir, "nova")); s != "new" || err != nil {
		t.Fatalf("pasta que não existe: %q %v", s, err)
	}
	if s, err := folderState(dir); s != "new" || err != nil {
		t.Fatalf("pasta vazia: %q %v", s, err)
	}
	os.WriteFile(filepath.Join(dir, "foto.png"), []byte("x"), 0o644)
	if _, err := folderState(dir); err == nil {
		t.Fatal("pasta com outros arquivos deveria ser recusada")
	}
	if _, err := folderState("relativa"); err == nil {
		t.Fatal("caminho relativo deveria ser recusado")
	}
}

func TestInstallKind(t *testing.T) {
	if k, _ := installKind(quickPatcherPath()); k != "rapido" {
		t.Fatalf("patcher do modo Rápido virou %q", k)
	}
	repo := fakeRepo(t)
	if k, r := installKind(repoPatcher(repo)); k != "completo" || r != repo {
		t.Fatalf("patcher da pasta virou %q %q", k, r)
	}
	if k, _ := installKind(filepath.Join(t.TempDir(), "dist", "patcher.js")); k != "" {
		t.Fatalf("pasta qualquer virou %q", k)
	}
}

// fakeRepo monta uma pasta com a cara de um clone do Bycord (sem baixar nada).
func fakeRepo(t *testing.T) string {
	repo := t.TempDir()
	for _, d := range []string{".git", "src/bycord", "src/plugins/messageLogger", "dist"} {
		os.MkdirAll(filepath.Join(repo, d), 0o755)
	}
	os.WriteFile(filepath.Join(repo, "package.json"), []byte("{\n    \"name\": \"bycord\"\n}"), 0o644)
	return repo
}

func TestCreateUserPlugin(t *testing.T) {
	repo := fakeRepo(t)

	for _, bad := range []string{"", "a", "meu plugin", "1Plugin", "Plugin-X", strings.Repeat("a", 41)} {
		if _, err := createUserPlugin(repo, bad, "", ""); err == nil {
			t.Errorf("nome %q deveria ser recusado", bad)
		}
	}
	if _, err := createUserPlugin(repo, "MessageLogger", "", ""); err == nil {
		t.Error("nome igual a um plugin que já existe deveria ser recusado")
	}

	file, err := createUserPlugin(repo, "MeuPlugin", `Diz "oi"`, "Barney")
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(repo, "src", "userplugins", "meuPlugin", "index.ts"); file != want {
		t.Fatalf("arquivo em %s, esperado %s", file, want)
	}
	b, _ := os.ReadFile(file)
	for _, s := range []string{`name: "MeuPlugin"`, `description: "Diz \"oi\""`, `name: "Barney", id: 0n`} {
		if !strings.Contains(string(b), s) {
			t.Errorf("o modelo não tem %s", s)
		}
	}
	if _, err := createUserPlugin(repo, "meuplugin", "", ""); err == nil {
		t.Error("criar de novo com o mesmo nome deveria ser recusado")
	}

	list, err := listUserPlugins(repo)
	if err != nil || len(list) != 1 || list[0].Name != "MeuPlugin" || list[0].Folder != "meuPlugin" {
		t.Fatalf("lista: %+v %v", list, err)
	}
}

// TestCompletoDeVerdade clona o Bycord do GitHub, instala, compila, cria um plugin e compila de novo.
// Demora alguns minutos e precisa de internet, Git, Node e pnpm: só roda com BYCORD_E2E=1.
// Não mexe em nenhum Discord.
func TestCompletoDeVerdade(t *testing.T) {
	if os.Getenv("BYCORD_E2E") != "1" {
		t.Skip("defina BYCORD_E2E=1 para rodar")
	}
	folder := filepath.Join(t.TempDir(), "Bycord")
	a := NewApp()

	var lines []string
	log := func(s string) { lines = append(lines, s) }
	runSteps := func(steps []step) {
		for _, s := range steps {
			if err := s.run(log); err != nil {
				tail := lines
				if len(tail) > 25 {
					tail = tail[len(tail)-25:]
				}
				t.Fatalf("%s: %v\n%s", s.label, err, strings.Join(tail, "\n"))
			}
			t.Logf("ok: %s", s.label)
		}
	}

	runSteps(a.sourceSteps(folder))
	if k, r := installKind(repoPatcher(folder)); k != "completo" || r != folder {
		t.Fatalf("depois de compilar, installKind deu %q %q", k, r)
	}

	if _, err := createUserPlugin(folder, "TesteDoInstalador", "Plugin criado pelo teste", "Teste"); err != nil {
		t.Fatal(err)
	}
	runSteps([]step{buildStep(a.context(), folder)})
	renderer, _ := os.ReadFile(filepath.Join(folder, "dist", "renderer.js"))
	if !strings.Contains(string(renderer), "TesteDoInstalador") {
		t.Fatal("o plugin criado não entrou no renderer.js")
	}

	// Rodar de novo na mesma pasta reaproveita o clone (git pull) em vez de recusar.
	runSteps(a.sourceSteps(folder)[:1])
}
