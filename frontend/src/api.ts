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
}

export interface Requirement {
    name: string;
    found: boolean;
    version: string;
    link: string;
}

export type Mode = "rapido" | "completo";

export interface Progress {
    step: number;
    total: number;
    label: string;
    log: string;
    done: boolean;
}

type GoApp = {
    Version(): Promise<string>;
    ListDiscords(): Promise<DiscordInstall[]>;
    CheckRequirements(): Promise<Requirement[]>;
    DefaultRepoFolder(): Promise<string>;
    ChooseFolder(): Promise<string>;
    Install(opts: { branch: string; mode: Mode; folder: string; }): Promise<void>;
    OpenURL(url: string): Promise<void>;
    Minimise(): Promise<void>;
    Quit(): Promise<void>;
};

const w = window as any;
export const inWails = Boolean(w.go?.main?.App);
const go: GoApp | null = inWails ? w.go.main.App : null;

const sample: DiscordInstall[] = [
    { branch: "stable", name: "Discord", path: "%LOCALAPPDATA%\\Discord", version: "1.0.9270", state: "other", mod: "Equicord", modPath: "", supported: true },
    { branch: "canary", name: "Discord Canary", path: "%LOCALAPPDATA%\\DiscordCanary", version: "1.0.812", state: "clean", mod: "", modPath: "", supported: true },
    { branch: "development", name: "Discord Development", path: "%LOCALAPPDATA%\\DiscordDevelopment", version: "1.0.1039", state: "bycord", mod: "Bycord", modPath: "", supported: true },
    { branch: "phoenix", name: "Discord Phoenix", path: "%LOCALAPPDATA%\\DiscordPhoenix", version: "", state: "unsupported", mod: "", modPath: "", supported: false },
];

export const api = {
    version: () => go ? go.Version() : Promise.resolve("0.1.0"),
    listDiscords: () => go ? go.ListDiscords() : Promise.resolve(sample),
    checkRequirements: () => go ? go.CheckRequirements() : Promise.resolve<Requirement[]>([
        { name: "Git", found: true, version: "2.56.0", link: "https://git-scm.com/download/win" },
        { name: "Node.js", found: true, version: "26.13.0", link: "https://nodejs.org/" },
        { name: "pnpm", found: false, version: "", link: "https://pnpm.io/installation" },
    ]),
    defaultRepoFolder: () => go ? go.DefaultRepoFolder() : Promise.resolve("C:\\Users\\voce\\Documents\\Bycord"),
    chooseFolder: () => go ? go.ChooseFolder() : Promise.resolve(""),
    openURL: (url: string) => go ? go.OpenURL(url) : void window.open(url, "_blank"),
    minimise: () => go?.Minimise(),
    quit: () => go ? go.Quit() : undefined,

    install(opts: { branch: string; mode: Mode; folder: string; }, onProgress: (p: Progress) => void) {
        if (go) {
            w.runtime.EventsOn("install:progress", onProgress);
            void go.Install(opts);
            return () => w.runtime.EventsOff("install:progress");
        }

        const labels = opts.mode === "completo"
            ? ["Fechando o Discord", "Clonando o repositório", "Instalando dependências", "Compilando", "Aplicando o patch"]
            : ["Fechando o Discord", "Baixando o Bycord", "Aplicando o patch", "Conferindo"];
        let i = 0;
        const timer = setInterval(() => {
            i++;
            const done = i > labels.length;
            onProgress({
                step: Math.min(i, labels.length), total: labels.length,
                label: done ? "Pronto" : labels[i - 1],
                log: done ? "Demonstração concluída. Nada foi alterado no seu PC." : `${labels[i - 1]}... (demonstração)`,
                done,
            });
            if (done) clearInterval(timer);
        }, 800);
        return () => clearInterval(timer);
    },
};
