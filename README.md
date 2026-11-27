# Bycord Installer

Instalador do [Bycord](https://github.com/barneybots/Bycord), um client mod gratuito baseado no Vencord.

> 🚧 **Versão 0.1: demonstração.** As telas e a detecção do Discord funcionam, mas a instalação ainda é só simulada: nada é baixado e o Discord não é alterado.

## Modos

- **Rápido:** baixa só o Bycord pronto (~1 MB) dos releases do GitHub. Não precisa de mais nada.
- **Completo:** clona o repositório inteiro, roda `pnpm install` e `pnpm build` no seu PC. Precisa de Git, Node e pnpm.

## Desenvolvimento

Feito com [Wails](https://wails.io) (Go + React/TypeScript).

```sh
wails dev     # abre o instalador com recarga automática
wails build   # gera build/bin/Bycord-Installer.exe
go test ./... # testes (a detecção só lê arquivos)
```

Para ver só as telas no navegador, sem o Go: `cd frontend && npm run dev`. Nesse caso o instalador usa dados de exemplo.

## Créditos

A parte que encontra e altera o Discord segue o [instalador oficial do Vencord](https://github.com/Vencord/Installer) (GPL-3.0).

## Licença

GPL-3.0-or-later.
