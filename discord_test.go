package main

import "testing"

// Mostra o que o instalador enxerga nesta máquina. Só lê arquivos.
func TestFindDiscords(t *testing.T) {
	for _, d := range FindDiscords() {
		t.Logf("%-20s %-12s %-10s %s", d.Name, d.State, d.Mod, d.ModPath)
	}
}

func TestVersionLess(t *testing.T) {
	if !versionLess("1.0.9", "1.0.10") || versionLess("1.0.10", "1.0.9") {
		t.Fatal("ordem de versões errada")
	}
}
