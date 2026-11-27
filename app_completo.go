package main

import "path/filepath"

// FolderCheck diz o que vai acontecer com a pasta escolhida para o modo Completo.
type FolderCheck struct {
	State string `json:"state"` // new (o código vai ser baixado nela) ou bycord (já tem o código: atualiza e usa)
	Error string `json:"error"` // por que essa pasta não serve
}

// CheckFolder confere a pasta escolhida para o código antes de instalar.
func (a *App) CheckFolder(folder string) FolderCheck {
	state, err := folderState(filepath.Clean(folder))
	if err != nil {
		return FolderCheck{Error: err.Error()}
	}
	return FolderCheck{State: state}
}
