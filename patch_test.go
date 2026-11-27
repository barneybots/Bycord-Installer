package main

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// fakeDiscord monta uma instalação falsa numa pasta temporária.
func fakeDiscord(t *testing.T) (root, resources string) {
	t.Helper()
	root = t.TempDir()
	resources = filepath.Join(root, "app-1.0.9", "resources")
	if err := os.MkdirAll(resources, 0o755); err != nil {
		t.Fatal(err)
	}
	os.MkdirAll(filepath.Join(root, "app-1.0.10", "resources"), 0o755)
	resources = filepath.Join(root, "app-1.0.10", "resources")
	if err := os.WriteFile(filepath.Join(resources, "app.asar"), []byte("ORIGINAL"), 0o644); err != nil {
		t.Fatal(err)
	}
	return root, resources
}

// readAsarFile lê um arquivo de dentro de um asar, como o Electron faz.
func readAsarFile(t *testing.T, asar, name string) string {
	t.Helper()
	b, err := os.ReadFile(asar)
	if err != nil {
		t.Fatal(err)
	}
	headerSize := binary.LittleEndian.Uint32(b[4:8])
	jsonLen := binary.LittleEndian.Uint32(b[12:16])
	var header struct {
		Files map[string]struct {
			Size   int    `json:"size"`
			Offset string `json:"offset"`
		} `json:"files"`
	}
	if err := json.Unmarshal(b[16:16+jsonLen], &header); err != nil {
		t.Fatalf("cabeçalho do asar inválido: %v", err)
	}
	f, ok := header.Files[name]
	if !ok {
		t.Fatalf("%s não está no asar", name)
	}
	var off int
	json.Unmarshal([]byte(f.Offset), &off)
	start := int(8+headerSize) + off
	return string(b[start : start+f.Size])
}

func TestPatchAndUnpatch(t *testing.T) {
	root, resources := fakeDiscord(t)
	patcher := `C:\Users\Alguém\AppData\Roaming\Bycord\dist\patcher.js`

	got, err := resourcesOf(root)
	if err != nil || got != resources {
		t.Fatalf("resourcesOf = %q, %v; queria a versão mais nova %q", got, err, resources)
	}

	if err := patchResources(resources, patcher); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(filepath.Join(resources, "_app.asar")); string(b) != "ORIGINAL" {
		t.Fatal("o app.asar original não foi guardado como _app.asar")
	}
	if js := readAsarFile(t, filepath.Join(resources, "app.asar"), "index.js"); js != `require("C:\\Users\\Alguém\\AppData\\Roaming\\Bycord\\dist\\patcher.js")` {
		t.Fatalf("index.js inesperado: %s", js)
	}
	if pkg := readAsarFile(t, filepath.Join(resources, "app.asar"), "package.json"); pkg != asarPackageJSON {
		t.Fatalf("package.json inesperado: %s", pkg)
	}

	state, mod, modPath := patchState(resources)
	if state != "bycord" || mod != "Bycord" || modPath != patcher {
		t.Fatalf("patchState = %s %s %s", state, mod, modPath)
	}

	// Aplicar de novo não pode perder o original.
	if err := patchResources(resources, patcher); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(filepath.Join(resources, "_app.asar")); string(b) != "ORIGINAL" {
		t.Fatal("o segundo patch estragou o _app.asar")
	}

	if err := unpatchResources(resources); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(filepath.Join(resources, "app.asar")); string(b) != "ORIGINAL" {
		t.Fatal("o desinstalar não restaurou o app.asar original")
	}
	if exists(filepath.Join(resources, "_app.asar")) {
		t.Fatal("sobrou _app.asar depois de desinstalar")
	}
	if state, _, _ := patchState(resources); state != "clean" {
		t.Fatalf("estado depois de desinstalar = %s", state)
	}
}

func TestReplaceOtherModFolder(t *testing.T) {
	_, resources := fakeDiscord(t)
	// Simula o Equicord: app.asar vira pasta e o original fica em _app.asar.
	os.Rename(filepath.Join(resources, "app.asar"), filepath.Join(resources, "_app.asar"))
	os.MkdirAll(filepath.Join(resources, "app.asar"), 0o755)
	os.WriteFile(filepath.Join(resources, "app.asar", "index.js"), []byte(`require("C:\\Users\\x\\Equicord\\dist\\desktop\\patcher.js");`), 0o644)

	if state, mod, _ := patchState(resources); state != "other" || mod != "Equicord" {
		t.Fatalf("não reconheceu o Equicord: %s %s", state, mod)
	}

	patcher := `C:\Bycord\dist\patcher.js`
	if err := patchResources(resources, patcher); err != nil {
		t.Fatal(err)
	}
	if state, _, modPath := patchState(resources); state != "bycord" || modPath != patcher {
		t.Fatalf("depois de trocar: %s %s", state, modPath)
	}
	if b, _ := os.ReadFile(filepath.Join(resources, "_app.asar")); string(b) != "ORIGINAL" {
		t.Fatal("trocar o mod estragou o _app.asar original")
	}
}

func TestVerifyPatch(t *testing.T) {
	_, resources := fakeDiscord(t)
	patcher := filepath.Join(t.TempDir(), "patcher.js")
	patchResources(resources, patcher)
	if err := verifyPatch(resources, patcher); err == nil {
		t.Fatal("deveria reclamar que o patcher.js não existe")
	}
	// Numa pasta com qualquer nome (modo Completo), o Bycord é reconhecido pelo conteúdo do patcher.
	os.WriteFile(patcher, []byte(`console.log("[Bycord] Starting up...");`), 0o644)
	if err := verifyPatch(resources, patcher); err != nil {
		t.Fatal(err)
	}
}

// Baixa o release de verdade numa pasta temporária. Pule com -short.
func TestDownloadRelease(t *testing.T) {
	if testing.Short() {
		t.Skip("precisa de internet")
	}
	dest := t.TempDir()
	hash, err := downloadRelease(context.Background(), dest, func(s string) { t.Log(s) })
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range distFiles {
		if st, err := os.Stat(filepath.Join(dest, f)); err != nil || st.Size() == 0 {
			t.Fatalf("%s não baixou", f)
		}
	}
	t.Logf("hash do release: %s", hash)
}
