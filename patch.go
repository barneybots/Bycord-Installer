package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// resourcesOf devolve a pasta resources da versão mais nova de uma instalação.
func resourcesOf(root string) (string, error) {
	appDir, _ := latestAppDir(root)
	if appDir == "" {
		return "", fmt.Errorf("não achei nenhuma pasta app-* em %s", root)
	}
	return filepath.Join(appDir, "resources"), nil
}

// patchResources troca o app.asar por um que carrega o Bycord, guardando o original como _app.asar.
// Se já houver um mod (Bycord ou outro), só o app.asar dele é trocado: o _app.asar original fica.
func patchResources(resources, patcherPath string) error {
	appAsar := filepath.Join(resources, "app.asar")
	original := filepath.Join(resources, "_app.asar")

	if exists(original) {
		if err := os.RemoveAll(appAsar); err != nil {
			return busy(fmt.Errorf("não consegui remover o app.asar do mod atual: %w", err))
		}
		return writeAppAsar(appAsar, patcherPath)
	}

	if !exists(appAsar) {
		return errors.New("essa instalação do Discord não tem app.asar; reinstale o Discord")
	}
	if err := os.Rename(appAsar, original); err != nil {
		return busy(fmt.Errorf("não consegui guardar o app.asar original: %w", err))
	}
	if err := writeAppAsar(appAsar, patcherPath); err != nil {
		if undo := os.Rename(original, appAsar); undo != nil {
			return fmt.Errorf("%w (e não consegui desfazer: %v)", err, undo)
		}
		return err
	}
	return nil
}

// unpatchResources devolve o Discord ao original.
func unpatchResources(resources string) error {
	appAsar := filepath.Join(resources, "app.asar")
	original := filepath.Join(resources, "_app.asar")

	if !exists(original) {
		return nil
	}
	if err := os.RemoveAll(appAsar); err != nil {
		return busy(fmt.Errorf("não consegui remover o app.asar do Bycord: %w", err))
	}
	if err := os.Rename(original, appAsar); err != nil {
		return busy(fmt.Errorf("não consegui restaurar o app.asar original: %w", err))
	}
	return nil
}

// verifyPatch confere se o patch aponta para o patcher esperado e se ele existe.
func verifyPatch(resources, patcherPath string) error {
	state, _, modPath := patchState(resources)
	if state != "bycord" || !strings.EqualFold(filepath.Clean(modPath), filepath.Clean(patcherPath)) {
		return fmt.Errorf("o patch não ficou apontando para o Bycord (encontrei %q)", modPath)
	}
	if !exists(patcherPath) {
		return fmt.Errorf("o arquivo %s não existe", patcherPath)
	}
	return nil
}

func busy(err error) error {
	if errors.Is(err, os.ErrPermission) || strings.Contains(err.Error(), "being used by another process") {
		return fmt.Errorf("%w. O Discord ainda pode estar aberto: feche-o e tente de novo", err)
	}
	return err
}
