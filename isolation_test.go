package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestIsUnderRoot(t *testing.T) {
	base := `C:\Users\x\AppData\Local\`
	cases := []struct {
		path, root string
		want       bool
	}{
		{base + `Discord\app-1.0.9270\Discord.exe`, base + "Discord", true},
		{base + `Discord\Update.exe`, base + "Discord", true},
		{base + `DISCORD\app-1\discord.exe`, base + "Discord", true},
		{base + `DiscordCanary\app-1\DiscordCanary.exe`, base + "Discord", false},
		{base + `DiscordPTB\app-1\DiscordPTB.exe`, base + "Discord", false},
		{base + `DiscordPhoenix\app\Discord.exe`, base + "Discord", false},
		{base + `DiscordDevelopment\app-1\DiscordDevelopment.exe`, base + "Discord", false},
		{base + `Discord\app-1\Discord.exe`, base + "DiscordCanary", false},
		{base + `Discord`, base + "Discord", false},
		{"", base + "Discord", false},
	}
	for _, c := range cases {
		if got := isUnderRoot(c.path, c.root); got != c.want {
			t.Errorf("isUnderRoot(%q, %q) = %v, queria %v", c.path, c.root, got, c.want)
		}
	}
}

// Monta Discord e Discord Canary falsos lado a lado e instala só no Canary.
func TestOnlyChosenDiscordIsTouched(t *testing.T) {
	local := t.TempDir()
	t.Setenv("LOCALAPPDATA", local)

	mk := func(dir, content string) string {
		res := filepath.Join(local, dir, "app-1.0.5", "resources")
		os.MkdirAll(res, 0o755)
		os.WriteFile(filepath.Join(res, "app.asar"), []byte(content), 0o644)
		return res
	}
	stable := mk("Discord", "ORIGINAL STABLE")
	canary := mk("DiscordCanary", "ORIGINAL CANARY")
	ptb := mk("DiscordPTB", "ORIGINAL PTB")

	snapshot := func(res string) map[string][]byte {
		out := map[string][]byte{}
		filepath.Walk(filepath.Dir(filepath.Dir(res)), func(p string, info os.FileInfo, err error) error {
			if err == nil && !info.IsDir() {
				out[p], _ = os.ReadFile(p)
			}
			return nil
		})
		return out
	}
	beforeStable, beforePTB := snapshot(stable), snapshot(ptb)

	inst, err := findInstall("canary")
	if err != nil {
		t.Fatal(err)
	}
	res, _ := resourcesOf(inst.Path)
	if res != canary {
		t.Fatalf("resourcesOf(canary) = %s", res)
	}
	patcher := filepath.Join(t.TempDir(), "patcher.js")
	os.WriteFile(patcher, []byte(`console.log("[Bycord] Starting up...")`), 0o644)
	if err := patchResources(res, patcher); err != nil {
		t.Fatal(err)
	}
	if err := verifyPatch(res, patcher); err != nil {
		t.Fatal(err)
	}

	same := func(name string, before, after map[string][]byte) {
		if len(before) != len(after) {
			t.Fatalf("%s: arquivos mudaram (%d → %d)", name, len(before), len(after))
		}
		for p, b := range before {
			if !bytes.Equal(b, after[p]) {
				t.Fatalf("%s: %s foi alterado", name, p)
			}
		}
	}
	same("Discord", beforeStable, snapshot(stable))
	same("Discord PTB", beforePTB, snapshot(ptb))

	for _, d := range FindDiscords() {
		want := "clean"
		if d.Branch == "canary" {
			want = "bycord"
		}
		if d.State != want {
			t.Errorf("%s ficou %s, queria %s", d.Name, d.State, want)
		}
	}

	if err := unpatchResources(res); err != nil {
		t.Fatal(err)
	}
	same("Discord", beforeStable, snapshot(stable))
}

// Só lê: mostra quais processos cada instalação real fecharia. Não fecha nada.
func TestProcessesPerInstallReadOnly(t *testing.T) {
	for _, d := range FindDiscords() {
		pids := discordProcesses(d.Path)
		t.Logf("%-20s fecharia %d processo(s)", d.Name, len(pids))
		for _, pid := range pids {
			if p := processPath(pid); !isUnderRoot(p, d.Path) {
				t.Errorf("%s pegaria um processo de fora: %s", d.Name, p)
			}
		}
	}
}
