# Bycord Installer

Instalador do [Bycord](https://github.com/barneybots/Bycord), um client mod gratuito baseado no Vencord.

> **Versão 0.4.** Os dois modos funcionam: **Rápido** (build pronta) e **Completo** (código no seu PC, com plugins próprios).

## O que ele faz no seu PC

- No modo Rápido, baixa `patcher.js`, `preload.js`, `renderer.js` e `renderer.css` do release `devbuild` para `%APPDATA%\Bycord\dist`.
- No modo Completo, clona o código na pasta que você escolher e compila ali (`<pasta>\dist`).
- Na versão mais nova do Discord escolhido (`app-*\resources`), guarda o `app.asar` original como `_app.asar` e cria um `app.asar` pequeno que carrega o Bycord.
- Fecha só o Discord escolhido, e só depois de perguntar.
- Se o Discord já tiver outro mod (Vencord, Equicord…), só troca depois de você marcar a confirmação. O `_app.asar` original é mantido.
- Desinstalar devolve o `app.asar` original. As configurações ficam em `%APPDATA%\Bycord`.

## Modos

- **Rápido:** baixa só o Bycord pronto (~1 MB) dos releases do GitHub. Não precisa de mais nada.
- **Completo:** clona o repositório (`git clone --filter=blob:none`), roda `pnpm install` e `pnpm build` no seu PC e aponta o Discord para `<pasta>\dist\patcher.js`. Precisa de Git, Node 22+ e pnpm. Se a pasta já tiver o código do Bycord, ele é atualizado e reaproveitado; uma pasta com outros arquivos é recusada.
  - **Atualizar** faz `git pull`, `pnpm install` e `pnpm build`. O atualizador de dentro do Discord também funciona (ele faz `git pull` e compila).
  - **Meus plugins** cria plugins em `src/userplugins/<nome>/index.ts` a partir de um modelo (opção, comando `/nome` e aviso ao ligar). O git ignora essa pasta, então atualizar nunca apaga seus plugins. Depois de editar, **Compilar** e Ctrl+R no Discord; o plugin aparece na Central de Plugins com o selo "Seu", desligado.
  - **Abrir o código** abre no VS Code (ou Cursor), se estiver instalado; senão, abre a pasta.

## Desenvolvimento

Feito com [Wails](https://wails.io) (Go + React/TypeScript), animações com [Motion](https://motion.dev), ícones [Lucide](https://lucide.dev) e fonte [Geist](https://vercel.com/font).

```sh
wails dev     # abre o instalador com recarga automática
wails build   # gera build/bin/Bycord-Installer.exe
go test ./... # testes (a detecção só lê arquivos)
BYCORD_E2E=1 go test -run TestCompletoDeVerdade ./...  # clona e compila de verdade numa pasta temporária (sem mexer no Discord)
```

Para ver só as telas no navegador, sem o Go: `cd frontend && npm run dev`. Nesse caso o instalador usa dados de exemplo; `?tela=plugins`, `?tela=gerenciar`, `?completo`, `?op=build`, `?erro`, `?rapido`, `?pastaruim` e `?sempnpm` abrem estados específicos.

## Créditos

A parte que encontra e altera o Discord segue o [instalador oficial do Vencord](https://github.com/Vencord/Installer) (GPL-3.0).

## Licença

GPL-3.0-or-later.
