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
}

export interface Requirement {
    name: string;
    found: boolean;
    version: string;
    link: string;
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

export type OpKind = "install" | "repair" | "update" | "uninstall";

type GoApp = {
    Version(): Promise<string>;
    ListDiscords(): Promise<DiscordInstall[]>;
    CheckRequirements(): Promise<Requirement[]>;
    DefaultRepoFolder(): Promise<string>;
    ChooseFolder(): Promise<string>;
    IsRunning(branch: string): Promise<boolean>;
    OpenDiscord(branch: string): Promise<string>;
    Install(opts: InstallOptions): Promise<void>;
    Repair(branch: string): Promise<void>;
    Update(branch: string): Promise<void>;
    Uninstall(branch: string): Promise<void>;
    OpenURL(url: string): Promise<void>;
    Minimise(): Promise<void>;
    Quit(): Promise<void>;
};

const w = window as any;
export const inWails = Boolean(w.go?.main?.App);
const go: GoApp | null = inWails ? w.go.main.App : null;

const sample: DiscordInstall[] = [
    { branch: "stable", name: "Discord", path: "%LOCALAPPDATA%\\Discord", version: "1.0.9270", state: "other", mod: "Equicord", modPath: "", supported: true, icon: "" },
    { branch: "canary", name: "Discord Canary", path: "%LOCALAPPDATA%\\DiscordCanary", version: "1.0.812", state: "clean", mod: "", modPath: "", supported: true, icon: "" },
    { branch: "development", name: "Discord Development", path: "%LOCALAPPDATA%\\DiscordDevelopment", version: "1.0.1039", state: "bycord", mod: "Bycord", modPath: "C:\\Users\\voce\\AppData\\Roaming\\Bycord\\dist\\patcher.js", supported: true, icon: "" },
    { branch: "phoenix", name: "Discord Phoenix", path: "%LOCALAPPDATA%\\DiscordPhoenix", version: "", state: "unsupported", mod: "", modPath: "", supported: false, icon: "" },
];

const sampleSteps: Record<OpKind, string[]> = {
    install: ["Fechando o Discord", "Baixando o Bycord", "Aplicando o patch", "Conferindo"],
    repair: ["Fechando o Discord", "Aplicando o patch", "Conferindo"],
    update: ["Baixando o Bycord", "Concluindo"],
    uninstall: ["Fechando o Discord", "Removendo o patch", "Conferindo"],
};

// Simula uma operação no navegador.
function fakeOp(kind: OpKind, onProgress: (p: Progress) => void) {
    const labels = sampleSteps[kind];
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

export const api = {
    version: () => go ? go.Version() : Promise.resolve("0.3.0"),
    listDiscords: () => go ? go.ListDiscords() : Promise.resolve(sample),
    checkRequirements: () => go ? go.CheckRequirements() : Promise.resolve<Requirement[]>([
        { name: "Git", found: true, version: "2.56.0", link: "https://git-scm.com/download/win" },
        { name: "Node.js", found: true, version: "26.13.0", link: "https://nodejs.org/" },
        { name: "pnpm", found: false, version: "", link: "https://pnpm.io/installation" },
    ]),
    defaultRepoFolder: () => go ? go.DefaultRepoFolder() : Promise.resolve("C:\\Users\\voce\\Documents\\Bycord"),
    chooseFolder: () => go ? go.ChooseFolder() : Promise.resolve(""),
    isRunning: (branch: string) => go ? go.IsRunning(branch) : Promise.resolve(branch === "canary"),
    openDiscord: (branch: string) => go ? go.OpenDiscord(branch) : Promise.resolve(""),
    openURL: (url: string) => go ? go.OpenURL(url) : void window.open(url, "_blank"),
    minimise: () => go?.Minimise(),
    quit: () => go ? go.Quit() : undefined,

    /** Roda uma operação e avisa o progresso. Devolve uma função para parar de ouvir. */
    run(kind: OpKind, opts: InstallOptions, onProgress: (p: Progress) => void) {
        if (!go) return fakeOp(kind, onProgress);

        w.runtime.EventsOn("op:progress", onProgress);
        if (kind === "install") void go.Install(opts);
        else if (kind === "repair") void go.Repair(opts.branch);
        else if (kind === "update") void go.Update(opts.branch);
        else void go.Uninstall(opts.branch);
        return () => w.runtime.EventsOff("op:progress");
    },
};
