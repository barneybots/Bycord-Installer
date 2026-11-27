package main

import (
	"os/exec"
	"syscall"
)

// hideWindow evita que um console pisque na tela ao rodar comandos.
func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
}
