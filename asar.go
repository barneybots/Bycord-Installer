package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Adaptado de app_asar.go do instalador oficial do Vencord
// (https://github.com/Vencord/Installer, GPL-3.0), que por sua vez veio do asar-cr.

const asarPackageJSON = `{
	"name": "discord",
	"main": "index.js"
}`

type asarEntry struct {
	Size   int32  `json:"size"`
	Offset string `json:"offset"`
}

// writeAppAsar cria um app.asar pequeno cujo index.js carrega o patcher do Bycord.
// Tem que ser um arquivo asar de verdade (não uma pasta): o Bycord copia esse arquivo
// sozinho para a versão nova quando o Discord se atualiza.
func writeAppAsar(outFile, patcherPath string) error {
	patcherJSON, _ := json.Marshal(patcherPath)
	indexJS := "require(" + string(patcherJSON) + ")"

	files := map[string]asarEntry{
		"index.js":     {Size: int32(len(indexJS)), Offset: "0"},
		"package.json": {Size: int32(len(asarPackageJSON)), Offset: strconv.Itoa(len(indexJS))},
	}
	headerBytes, _ := json.Marshal(map[string]map[string]asarEntry{"files": files})

	header := string(headerBytes)
	headerLen := uint32(len(header))
	const dataSize = uint32(4)
	aligned := (headerLen + dataSize - 1) &^ (dataSize - 1)
	header += strings.Repeat("0", int(aligned-headerLen))

	f, err := os.Create(outFile)
	if err != nil {
		return fmt.Errorf("não consegui criar %s: %w", outFile, err)
	}
	defer f.Close()

	for _, n := range []uint32{dataSize, aligned + 8, aligned + dataSize, headerLen} {
		if err := binary.Write(f, binary.LittleEndian, int32(n)); err != nil {
			return fmt.Errorf("não consegui gravar o app.asar: %w", err)
		}
	}
	if _, err := f.WriteString(header + indexJS + asarPackageJSON); err != nil {
		return fmt.Errorf("não consegui gravar o app.asar: %w", err)
	}
	return nil
}
