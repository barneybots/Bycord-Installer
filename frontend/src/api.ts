// Fala com o Go quando roda dentro do instalador; no navegador usa dados de exemplo
// para dar para ver as telas sem compilar.

export type DiscordState = "clean" | "bycord" | "other" | "unsupported" | "broken";

export interface DiscordInstall {
    branch: string;
    name: string;
    path: string;
    version: string;
    state: DiscordState;
    mod: string;
    modPath: string;
    supported: boolean;
    icon: string;
    /** Com o Bycord: como foi instalado. */
    install: "rapido" | "completo" | "";
    /** No modo Completo, a pasta do código. */
    repo: string;
}

export interface Requirement {
    name: string;
    found: boolean;
    version: string;
    link: string;
    /** Por que não serve, quando achou mas é antigo. */
    note: string;
}

export interface FolderCheck {
    state: "new" | "bycord" | "";
    error: string;
}

export interface UserPlugin {
    name: string;
    folder: string;
    path: string;
}

export type Mode = "rapido" | "completo";

export interface InstallOptions {
    branch: string;
    mode: Mode;
    folder: string;
    replaceOther: boolean;
}

export interface Progress {
    step: number;
    total: number;
    label: string;
    log: string;
    done: boolean;
    error: string;
    steps: string[];
}

export type OpKind = "install" | "repair" | "update" | "uninstall" | "build";

type GoApp = {
    Version(): Promise<string>;
    ListDiscords(): Promise<DiscordInstall[]>;
    CheckRequirements(): Promise<Requirement[]>;
    DefaultRepoFolder(): Promise<string>;
    ChooseFolder(): Promise<string>;
    CheckFolder(folder: string): Promise<FolderCheck>;
    IsRunning(branch: string): Promise<boolean>;
    OpenDiscord(branch: string): Promise<string>;
    Install(opts: InstallOptions): Promise<void>;
    Repair(branch: string): Promise<void>;
    Update(branch: string): Promise<void>;
    Uninstall(branch: string): Promise<void>;
    Build(branch: string): Promise<void>;
    UserPlugins(branch: string): Promise<UserPlugin[]>;
    CreateUserPlugin(branch: string, name: string, description: string, author: string): Promise<string>;
    HasEditor(): Promise<boolean>;
    OpenInEditor(branch: string, file: string): Promise<string>;
    OpenFolder(branch: string, which: string): Promise<string>;
    OpenURL(url: string): Promise<void>;
    Minimise(): Promise<void>;
    Quit(): Promise<void>;
};

const w = window as any;
export const inWails = Boolean(w.go?.main?.App);
const go: GoApp | null = inWails ? w.go.main.App : null;

/* ---------------- Dados de exemplo (prévia no navegador) ---------------- */

const SAMPLE_REPO = "C:\\Users\\voce\\Documents\\Bycord";

// Na prévia, ?rapido mostra o Development como instalado pelo modo Rápido.
const sampleCompleto = !location.search.includes("rapido");

const sample: DiscordInstall[] = [
    { branch: "stable", name: "Discord", path: "%LOCALAPPDATA%\\Discord", version: "1.0.9270", state: "other", mod: "Equicord", modPath: "", supported: true, icon: "", install: "", repo: "" },
    { branch: "canary", name: "Discord Canary", path: "%LOCALAPPDATA%\\DiscordCanary", version: "1.0.812", state: "clean", mod: "", modPath: "", supported: true, icon: "", install: "", repo: "" },
    {
        branch: "development", name: "Discord Development", path: "%LOCALAPPDATA%\\DiscordDevelopment", version: "1.0.1039", state: "bycord", mod: "Bycord",
        modPath: sampleCompleto ? SAMPLE_REPO + "\\dist\\patcher.js" : "C:\\Users\\voce\\AppData\\Roaming\\Bycord\\dist\\patcher.js",
        supported: true, icon: "", install: sampleCompleto ? "completo" : "rapido", repo: sampleCompleto ? SAMPLE_REPO : "",
    },
    { branch: "phoenix", name: "Discord Phoenix", path: "%LOCALAPPDATA%\\DiscordPhoenix", version: "", state: "unsupported", mod: "", modPath: "", supported: false, icon: "", install: "", repo: "" },
];

const SOURCE_STEPS = ["Baixando o código", "Instalando dependências", "Compilando"];

function sampleSteps(kind: OpKind, opts: InstallOptions): string[] {
    const completo = kind === "install" ? opts.mode === "completo" : sampleCompleto && opts.branch === "development";
    switch (kind) {
        case "install":
            return completo
                ? [...SOURCE_STEPS, "Fechando o Discord", "Aplicando o patch", "Conferindo"]
                : ["Fechando o Discord", "Baixando o Bycord", "Aplicando o patch", "Conferindo"];
        case "repair": return ["Fechando o Discord", "Aplicando o patch", "Conferindo"];
        case "update": return completo ? [...SOURCE_STEPS, "Concluindo"] : ["Baixando o Bycord", "Concluindo"];
        case "build": return ["Compilando", "Concluindo"];
        case "uninstall": return ["Fechando o Discord", "Removendo o patch", "Conferindo"];
    }
}

let samplePlugins: UserPlugin[] = [
    { name: "OlaMundo", folder: "olaMundo", path: SAMPLE_REPO + "\\src\\userplugins\\olaMundo" },
];

// Simula uma operação no navegador.
function fakeOp(kind: OpKind, opts: InstallOptions, onProgress: (p: Progress) => void) {
    const labels = sampleSteps(kind, opts);
    let i = 0;
    const failAt = location.search.includes("erro") ? 2 : -1; // ?erro na prévia simula uma falha
    const timer = setInterval(() => {
        i++;
        if (i === failAt + 1) {
            clearInterval(timer);
            onProgress({
                step: failAt, total: labels.length, label: labels[failAt - 1], log: "Erro: (simulado na prévia)",
                done: false, error: "Erro simulado na prévia: não consegui baixar o renderer.js (resposta 503).", steps: labels,
            });
            return;
        }
        const done = i > labels.length;
        onProgress({
            step: Math.min(i, labels.length), total: labels.length,
            label: done ? "Pronto" : labels[i - 1],
            log: done ? "Tudo certo. (prévia: nada foi alterado)" : `${labels[i - 1]}...`,
            done, error: "", steps: labels,
        });
        if (done) clearInterval(timer);
    }, 900);
    return () => clearInterval(timer);
}

const NAME_RE = /^[A-Za-z][A-Za-z0-9]{1,39}$/;

export const api = {
    version: () => go ? go.Version() : Promise.resolve("0.4.1"),
    listDiscords: () => go ? go.ListDiscords() : Promise.resolve(sample),
    checkRequirements: () => go ? go.CheckRequirements() : Promise.resolve<Requirement[]>([
        { name: "Git", found: true, version: "2.56.0", link: "https://git-scm.com/download/win", note: "" },
        { name: "Node.js", found: true, version: "26.13.0", link: "https://nodejs.org/", note: "" },
        { name: "pnpm", found: !location.search.includes("sempnpm"), version: "12.15.0", link: "https://pnpm.io/installation", note: "" },
    ]),
    defaultRepoFolder: () => go ? go.DefaultRepoFolder() : Promise.resolve(SAMPLE_REPO),
    chooseFolder: () => go ? go.ChooseFolder() : Promise.resolve(""),
    checkFolder: (folder: string) => go ? go.CheckFolder(folder) : Promise.resolve<FolderCheck>(
        location.search.includes("pastaruim")
            ? { state: "", error: "a pasta C:\\Users\\voce\\Documents\\Bycord já tem outros arquivos e não é o código do Bycord; escolha outra pasta" }
            : { state: "new", error: "" },
    ),
    isRunning: (branch: string) => go ? go.IsRunning(branch) : Promise.resolve(branch === "canary"),
    openDiscord: (branch: string) => go ? go.OpenDiscord(branch) : Promise.resolve(""),
    openURL: (url: string) => go ? go.OpenURL(url) : void window.open(url, "_blank"),
    minimise: () => go?.Minimise(),
    quit: () => go ? go.Quit() : undefined,

    userPlugins: (branch: string) => go ? go.UserPlugins(branch) : Promise.resolve([...samplePlugins]),
    /** Cria um plugin a partir do modelo; devolve o caminho do index.ts. Rejeita com a mensagem de erro. */
    createUserPlugin(branch: string, name: string, description: string, author: string): Promise<string> {
        if (go) return go.CreateUserPlugin(branch, name, description, author);
        if (!NAME_RE.test(name)) return Promise.reject("o nome precisa ter de 2 a 40 letras ou números, começando com letra e sem espaços (ex.: MeuPlugin)");
        const folder = name[0].toLowerCase() + name.slice(1);
        if (samplePlugins.some(p => p.folder.toLowerCase() === folder.toLowerCase())) return Promise.reject(`já existe um plugin chamado ${name}; escolha outro nome`);
        samplePlugins = [...samplePlugins, { name, folder, path: `${SAMPLE_REPO}\\src\\userplugins\\${folder}` }];
        return Promise.resolve(`${SAMPLE_REPO}\\src\\userplugins\\${folder}\\index.ts`);
    },
    hasEditor: () => go ? go.HasEditor() : Promise.resolve(true),
    openInEditor: (branch: string, file = "") => go ? go.OpenInEditor(branch, file) : Promise.resolve(""),
    openFolder: (branch: string, which = "") => go ? go.OpenFolder(branch, which) : Promise.resolve(""),

    /** Roda uma operação e avisa o progresso. Devolve uma função para parar de ouvir. */
    run(kind: OpKind, opts: InstallOptions, onProgress: (p: Progress) => void) {
        if (!go) return fakeOp(kind, opts, onProgress);

        w.runtime.EventsOn("op:progress", onProgress);
        if (kind === "install") void go.Install(opts);
        else if (kind === "repair") void go.Repair(opts.branch);
        else if (kind === "update") void go.Update(opts.branch);
        else if (kind === "build") void go.Build(opts.branch);
        else void go.Uninstall(opts.branch);
        return () => w.runtime.EventsOff("op:progress");
    },
};

export { NAME_RE };
