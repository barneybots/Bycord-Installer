# Bycord Installer

Instalador do [Bycord](https://github.com/barneybots/Bycord), um client mod gratuito baseado no Vencord.

> 🚧 **Versão 0.2.** O modo **Rápido** funciona de verdade: instala, repara, atualiza e desinstala. O modo **Completo** ainda é só demonstração.

## O que ele faz no seu PC

- Baixa `patcher.js`, `preload.js`, `renderer.js` e `renderer.css` do release `devbuild` para `%APPDATA%\Bycord\dist`.
- Na versão mais nova do Discord escolhido (`app-*\resources`), guarda o `app.asar` original como `_app.asar` e cria um `app.asar` pequeno que carrega o Bycord.
- Fecha só o Discord escolhido, e só depois de perguntar.
- Se o Discord já tiver outro mod (Vencord, Equicord…), só troca depois de você marcar a confirmação. O `_app.asar` original é mantido.
- Desinstalar devolve o `app.asar` original. As configurações ficam em `%APPDATA%\Bycord`.

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
