package main

import (
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var discordExe = map[string]string{
	"stable":      "Discord.exe",
	"ptb":         "DiscordPTB.exe",
	"canary":      "DiscordCanary.exe",
	"development": "DiscordDevelopment.exe",
}

// discordProcesses lista os processos cujo executável fica dentro da pasta da instalação.
// Assim fechar o Canary nunca fecha o Discord normal.
func discordProcesses(root string) []uint32 {
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil
	}
	defer windows.CloseHandle(snap)

	prefix := strings.ToLower(filepath.Clean(root)) + `\`
	var pids []uint32
	entry := windows.ProcessEntry32{Size: uint32(unsafe.Sizeof(windows.ProcessEntry32{}))}
	for err = windows.Process32First(snap, &entry); err == nil; err = windows.Process32Next(snap, &entry) {
		if path := processPath(entry.ProcessID); path != "" && strings.HasPrefix(strings.ToLower(path), prefix) {
			pids = append(pids, entry.ProcessID)
		}
	}
	return pids
}

func processPath(pid uint32) string {
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return ""
	}
	defer windows.CloseHandle(h)
	buf := make([]uint16, windows.MAX_PATH*2)
	size := uint32(len(buf))
	if err := windows.QueryFullProcessImageName(h, 0, &buf[0], &size); err != nil {
		return ""
	}
	return windows.UTF16ToString(buf[:size])
}

// closeDiscord encerra os processos da instalação e espera eles saírem.
func closeDiscord(root string) bool {
	pids := discordProcesses(root)
	if len(pids) == 0 {
		return false
	}
	for _, pid := range pids {
		if h, err := windows.OpenProcess(windows.PROCESS_TERMINATE, false, pid); err == nil {
			windows.TerminateProcess(h, 0)
			windows.CloseHandle(h)
		}
	}
	for i := 0; i < 20 && len(discordProcesses(root)) > 0; i++ {
		time.Sleep(250 * time.Millisecond)
	}
	// O Windows às vezes demora um pouco para soltar os arquivos.
	time.Sleep(500 * time.Millisecond)
	return true
}

// startDiscord abre o Discord pelo Update.exe, como o atalho do menu Iniciar faz.
func startDiscord(root, branch string) error {
	exe, ok := discordExe[branch]
	if !ok {
		exe = "Discord.exe"
	}
	cmd := exec.Command(filepath.Join(root, "Update.exe"), "--processStart", exe)
	hideWindow(cmd)
	return cmd.Start()
}
