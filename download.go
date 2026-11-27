package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const releaseAPI = "https://api.github.com/repos/barneybots/Bycord/releases/latest"

// Os mesmos arquivos que o atualizador do Bycord baixa (src/main/updater/common.ts).
var distFiles = []string{"patcher.js", "preload.js", "renderer.js", "renderer.css"}

var httpClient = &http.Client{Timeout: 60 * time.Second}

type release struct {
	Name   string `json:"name"`
	Assets []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
		Size int64  `json:"size"`
	} `json:"assets"`
}

func bycordDataDir() string { return filepath.Join(os.Getenv("APPDATA"), "Bycord") }

func distDir() string { return filepath.Join(bycordDataDir(), "dist") }

func quickPatcherPath() string { return filepath.Join(distDir(), "patcher.js") }

// downloadRelease baixa a build mais recente do Bycord para dest.
// Os arquivos só substituem os antigos depois que todos baixaram.
func downloadRelease(ctx context.Context, dest string, log func(string)) (string, error) {
	var rel release
	if err := getJSON(ctx, releaseAPI, &rel); err != nil {
		return "", fmt.Errorf("não consegui ver a versão mais nova no GitHub: %w", err)
	}
	log("Versão encontrada: " + rel.Name)

	if err := os.MkdirAll(dest, 0o755); err != nil {
		return "", err
	}

	var temps []string
	defer func() {
		for _, t := range temps {
			os.Remove(t)
		}
	}()

	for _, name := range distFiles {
		url := ""
		for _, a := range rel.Assets {
			if a.Name == name {
				url = a.URL
			}
		}
		if url == "" {
			return "", fmt.Errorf("o release %q não tem o arquivo %s", rel.Name, name)
		}

		tmp := filepath.Join(dest, name+".download")
		temps = append(temps, tmp)
		n, err := downloadFile(ctx, url, tmp)
		if err != nil {
			return "", fmt.Errorf("falhou ao baixar %s: %w", name, err)
		}
		log(fmt.Sprintf("Baixado %s (%d KB)", name, n/1024))
	}

	for _, name := range distFiles {
		if err := os.Rename(filepath.Join(dest, name+".download"), filepath.Join(dest, name)); err != nil {
			return "", fmt.Errorf("não consegui salvar %s: %w", name, err)
		}
	}
	temps = nil

	hash := rel.Name[strings.LastIndex(rel.Name, " ")+1:]
	return hash, nil
}

func newRequest(ctx context.Context, url string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Bycord-Installer/"+AppVersion)
	return req, nil
}

func getJSON(ctx context.Context, url string, out any) error {
	req, err := newRequest(ctx, url)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	res, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("GitHub respondeu %s", res.Status)
	}
	return json.NewDecoder(res.Body).Decode(out)
}

func downloadFile(ctx context.Context, url, path string) (int64, error) {
	req, err := newRequest(ctx, url)
	if err != nil {
		return 0, err
	}
	res, err := httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("resposta %s", res.Status)
	}

	f, err := os.Create(path)
	if err != nil {
		return 0, err
	}
	n, err := io.Copy(f, res.Body)
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	return n, err
}
