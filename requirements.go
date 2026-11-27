package main

import (
	"os/exec"
	"regexp"
	"strings"
)

// Requirement é uma ferramenta que o modo Completo precisa.
type Requirement struct {
	Name    string `json:"name"`
	Found   bool   `json:"found"`
	Version string `json:"version"`
	Link    string `json:"link"`
}

var versionRe = regexp.MustCompile(`\d+\.\d+(\.\d+)?`)

// CheckRequirements confere Git, Node e pnpm rodando "--version". Não instala nada.
func CheckRequirements() []Requirement {
	tools := []struct{ name, cmd, link string }{
		{"Git", "git", "https://git-scm.com/download/win"},
		{"Node.js", "node", "https://nodejs.org/"},
		{"pnpm", "pnpm", "https://pnpm.io/installation"},
	}

	var out []Requirement
	for _, t := range tools {
		r := Requirement{Name: t.name, Link: t.link}
		if path, err := exec.LookPath(t.cmd); err == nil {
			cmd := exec.Command(path, "--version")
			hideWindow(cmd)
			if b, err := cmd.Output(); err == nil {
				r.Found = true
				r.Version = versionRe.FindString(strings.TrimSpace(string(b)))
			}
		}
		out = append(out, r)
	}
	return out
}
