import { useEffect, useMemo, useRef, useState } from "react";

import { api, DiscordInstall, inWails, Mode, Progress, Requirement } from "./api";
import byto from "./assets/images/byto.png";
import bytoAcenando from "./assets/images/byto-acenando.png";
import logo from "./assets/images/logo.png";

type Screen = "boas-vindas" | "discord" | "modo" | "instalando" | "pronto" | "gerenciar";

const STEPS: { id: Screen; label: string; }[] = [
    { id: "boas-vindas", label: "Boas-vindas" },
    { id: "discord", label: "Escolher o Discord" },
    { id: "modo", label: "Modo de instalação" },
    { id: "instalando", label: "Instalação" },
    { id: "pronto", label: "Pronto" },
];

const REPO_URL = "https://github.com/barneybots/Bycord";

export default function App() {
    const [screen, setScreen] = useState<Screen>("boas-vindas");
    const [version, setVersion] = useState("");
    const [discords, setDiscords] = useState<DiscordInstall[] | null>(null);
    const [branch, setBranch] = useState("");
    const [mode, setMode] = useState<Mode>("rapido");
    const [folder, setFolder] = useState("");
    const [reqs, setReqs] = useState<Requirement[] | null>(null);

    const selected = discords?.find(d => d.branch === branch);

    const refresh = () => {
        setDiscords(null);
        api.listDiscords().then(list => {
            setDiscords(list);
            setBranch(current => {
                if (list.some(d => d.branch === current && d.supported)) return current;
                return (list.find(d => d.supported && d.state === "clean") ?? list.find(d => d.supported))?.branch ?? "";
            });
        });
    };

    useEffect(() => {
        api.version().then(setVersion);
        api.defaultRepoFolder().then(setFolder);
        refresh();
    }, []);

    useEffect(() => {
        if (mode === "completo" && !reqs) api.checkRequirements().then(setReqs);
    }, [mode]);

    const stepIndex = STEPS.findIndex(s => s.id === (screen === "gerenciar" ? "discord" : screen));

    return (
        <div className="window">
            <TitleBar />
            <div className="body">
                <aside className="sidebar">
                    <ol className="steps">
                        {STEPS.map((s, i) => (
                            <li key={s.id} className={i < stepIndex ? "done" : i === stepIndex ? "current" : ""}>
                                <span className="dot">{i < stepIndex ? "✓" : i + 1}</span>
                                {s.label}
                            </li>
                        ))}
                    </ol>
                    <img className="sidebar-byto" src={byto} alt="" />
                    <div className="sidebar-foot">
                        v{version || "…"}
                        {!inWails && <span className="pill muted">prévia no navegador</span>}
                    </div>
                </aside>

                <main className="content">
                    {screen === "boas-vindas" && <Welcome onStart={() => setScreen("discord")} />}

                    {screen === "discord" && (
                        <ChooseDiscord
                            discords={discords}
                            branch={branch}
                            onSelect={setBranch}
                            onRefresh={refresh}
                            onBack={() => setScreen("boas-vindas")}
                            onNext={() => setScreen(selected?.state === "bycord" ? "gerenciar" : "modo")}
                            selected={selected}
                        />
                    )}

                    {screen === "modo" && (
                        <ChooseMode
                            mode={mode}
                            onMode={setMode}
                            folder={folder}
                            onChooseFolder={() => api.chooseFolder().then(f => f && setFolder(f))}
                            reqs={reqs}
                            onRecheck={() => { setReqs(null); api.checkRequirements().then(setReqs); }}
                            target={selected}
                            onBack={() => setScreen("discord")}
                            onNext={() => setScreen("instalando")}
                        />
                    )}

                    {screen === "instalando" && (
                        <Installing
                            options={{ branch, mode, folder }}
                            target={selected}
                            onDone={() => setScreen("pronto")}
                        />
                    )}

                    {screen === "pronto" && <Done target={selected} mode={mode} />}

                    {screen === "gerenciar" && selected && (
                        <Manage target={selected} onBack={() => setScreen("discord")} onReinstall={() => setScreen("modo")} />
                    )}
                </main>
            </div>
        </div>
    );
}

function TitleBar() {
    return (
        <header className="titlebar" style={{ "--wails-draggable": "drag" } as React.CSSProperties}>
            <img src={logo} alt="Bycord" className="titlebar-logo" />
            <span className="titlebar-name">Installer</span>
            <div className="titlebar-buttons" style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}>
                <button aria-label="Minimizar" onClick={() => api.minimise()}>
                    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" /></svg>
                </button>
                <button aria-label="Fechar" className="close" onClick={() => api.quit()}>
                    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" /></svg>
                </button>
            </div>
        </header>
    );
}

function Footer({ onBack, onNext, nextLabel = "Continuar", nextDisabled }: {
    onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean;
}) {
    return (
        <footer className="actions">
            {onBack ? <button className="btn ghost" onClick={onBack}>Voltar</button> : <span />}
            {onNext && <button className="btn primary" onClick={onNext} disabled={nextDisabled}>{nextLabel}</button>}
        </footer>
    );
}

function Welcome({ onStart }: { onStart: () => void; }) {
    return (
        <section className="screen welcome">
            <img src={logo} alt="Bycord" className="welcome-logo" />
            <h1>Seu Discord, do seu jeito.</h1>
            <p className="lead">
                O Bycord é um client mod gratuito e de código aberto, baseado no Vencord. Este instalador
                coloca o Bycord no Discord que você escolher, e dá para desfazer quando quiser.
            </p>
            <div className="notice">
                <strong>Antes de continuar</strong>
                Client mods violam os Termos de Serviço do Discord. Use por sua conta e risco.
            </div>
            <Footer onNext={onStart} nextLabel="Começar" />
        </section>
    );
}

const STATE_LABEL: Record<string, string> = {
    clean: "Sem mod",
    bycord: "Com Bycord",
    unsupported: "Não suportado",
    broken: "Instalação com problema",
};

function stateLabel(d: DiscordInstall) {
    return d.state === "other" ? `Com ${d.mod}` : STATE_LABEL[d.state];
}

function ChooseDiscord({ discords, branch, onSelect, onRefresh, onBack, onNext, selected }: {
    discords: DiscordInstall[] | null; branch: string; onSelect: (b: string) => void; onRefresh: () => void;
    onBack: () => void; onNext: () => void; selected?: DiscordInstall;
}) {
    return (
        <section className="screen">
            <div className="screen-head">
                <div>
                    <h2>Em qual Discord?</h2>
                    <p className="sub">Esses são os Discords que encontrei no seu PC.</p>
                </div>
                <button className="btn ghost small" onClick={onRefresh}>Procurar de novo</button>
            </div>

            <div className="list">
                {discords === null && <p className="sub">Procurando…</p>}
                {discords?.length === 0 && (
                    <div className="notice">
                        <strong>Nenhum Discord encontrado</strong>
                        Instale o Discord (de preferência o Canary, para testar) e clique em "Procurar de novo".
                    </div>
                )}
                {discords?.map(d => (
                    <button
                        key={d.branch}
                        className={`option ${branch === d.branch ? "selected" : ""}`}
                        disabled={!d.supported}
                        aria-pressed={branch === d.branch}
                        onClick={() => onSelect(d.branch)}
                    >
                        <span className="radio" />
                        <span className="option-main">
                            <span className="option-title">{d.name}</span>
                            <span className="option-sub">{d.supported ? `versão ${d.version}` : "Feito em Rust, sem Electron: o Bycord não roda nele"}</span>
                        </span>
                        <span className={`pill state-${d.state}`}>{stateLabel(d)}</span>
                    </button>
                ))}
            </div>

            {selected?.state === "other" && (
                <div className="notice warn">
                    <strong>Esse Discord já tem o {selected.mod}</strong>
                    Só dá para ter um mod por Discord. Se continuar, o {selected.mod} será substituído pelo Bycord nele.
                </div>
            )}

            <Footer onBack={onBack} onNext={onNext} nextDisabled={!selected?.supported}
                nextLabel={selected?.state === "bycord" ? "Gerenciar" : "Continuar"} />
        </section>
    );
}

function ChooseMode({ mode, onMode, folder, onChooseFolder, reqs, onRecheck, target, onBack, onNext }: {
    mode: Mode; onMode: (m: Mode) => void; folder: string; onChooseFolder: () => void;
    reqs: Requirement[] | null; onRecheck: () => void; target?: DiscordInstall; onBack: () => void; onNext: () => void;
}) {
    const missing = mode === "completo" && (!reqs || reqs.some(r => !r.found));

    return (
        <section className="screen">
            <div className="screen-head">
                <div>
                    <h2>Como instalar?</h2>
                    <p className="sub">No {target?.name ?? "Discord"}. Dá para trocar de modo depois.</p>
                </div>
            </div>

            <div className="modes">
                <button className={`mode ${mode === "rapido" ? "selected" : ""}`} aria-pressed={mode === "rapido"} onClick={() => onMode("rapido")}>
                    <span className="pill accent">Recomendado</span>
                    <span className="mode-title">Rápido</span>
                    <span className="mode-text">Baixa só o Bycord pronto. Não precisa de mais nada instalado e se atualiza sozinho.</span>
                    <span className="mode-meta">~1 MB · em %APPDATA%\Bycord</span>
                </button>
                <button className={`mode ${mode === "completo" ? "selected" : ""}`} aria-pressed={mode === "completo"} onClick={() => onMode("completo")}>
                    <span className="pill">Para devs</span>
                    <span className="mode-title">Completo</span>
                    <span className="mode-text">Baixa o repositório inteiro e compila no seu PC. Dá para mexer no código e usar seus próprios plugins.</span>
                    <span className="mode-meta">~200 MB · precisa de Git, Node e pnpm</span>
                </button>
            </div>

            {mode === "completo" && (
                <div className="details">
                    <div className="field">
                        <span className="field-label">Pasta do repositório</span>
                        <div className="field-row">
                            <code className="path">{folder}</code>
                            <button className="btn ghost small" onClick={onChooseFolder}>Escolher…</button>
                        </div>
                    </div>
                    <div className="field">
                        <span className="field-label">
                            Ferramentas
                            <button className="link" onClick={onRecheck}>conferir de novo</button>
                        </span>
                        <ul className="reqs">
                            {!reqs && <li className="sub">Conferindo…</li>}
                            {reqs?.map(r => (
                                <li key={r.name} className={r.found ? "ok" : "missing"}>
                                    <span className="req-icon">{r.found ? "✓" : "✕"}</span>
                                    <span className="req-name">{r.name}</span>
                                    {r.found
                                        ? <span className="sub">{r.version}</span>
                                        : <button className="link" onClick={() => api.openURL(r.link)}>baixar</button>}
                                </li>
                            ))}
                        </ul>
                        {reqs?.some(r => !r.found) && (
                            <span className="hint">Instale o que falta e clique em "conferir de novo" para liberar a instalação.</span>
                        )}
                    </div>
                </div>
            )}

            <Footer onBack={onBack} onNext={onNext} nextLabel="Instalar" nextDisabled={missing} />
        </section>
    );
}

function Installing({ options, target, onDone }: {
    options: { branch: string; mode: Mode; folder: string; }; target?: DiscordInstall; onDone: () => void;
}) {
    const [progress, setProgress] = useState<Progress | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const [showLog, setShowLog] = useState(false);
    const logRef = useRef<HTMLPreElement>(null);

    useEffect(() => api.install(options, p => {
        setProgress(p);
        setLog(l => [...l, p.log]);
    }), []);

    useEffect(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }, [log, showLog]);

    const pct = progress ? Math.round((progress.done ? 1 : (progress.step - 1) / progress.total) * 100) : 0;

    return (
        <section className="screen">
            <div className="screen-head">
                <div>
                    <h2>{progress?.done ? "Tudo certo" : "Instalando…"}</h2>
                    <p className="sub">Bycord no {target?.name}, modo {options.mode === "rapido" ? "Rápido" : "Completo"}.</p>
                </div>
            </div>

            <div className="notice demo">
                <strong>Demonstração</strong>
                Esta versão do instalador só mostra as etapas. Nada é baixado e o Discord não é alterado.
            </div>

            <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-bar" style={{ width: `${pct}%` }} />
            </div>
            <p className="progress-label">{progress?.label ?? "Preparando…"} <span className="sub">{pct}%</span></p>

            <button className="link" onClick={() => setShowLog(s => !s)}>{showLog ? "Esconder detalhes" : "Ver detalhes"}</button>
            {showLog && <pre className="log" ref={logRef}>{log.join("\n")}</pre>}

            <Footer onNext={onDone} nextLabel="Continuar" nextDisabled={!progress?.done} />
        </section>
    );
}

function Done({ target, mode }: { target?: DiscordInstall; mode: Mode; }) {
    const tips = useMemo(() => [
        "Abra as Configurações do Discord: a seção Bycord fica no menu da esquerda.",
        mode === "rapido" ? "O Bycord se atualiza sozinho pelos releases do GitHub." : "Para atualizar, use o atualizador do Bycord: ele faz git pull e recompila.",
        "Se o Discord atualizar e o Bycord sumir, abra este instalador e use Reparar.",
    ], [mode]);

    return (
        <section className="screen done">
            <img src={bytoAcenando} alt="" className="done-byto" />
            <h2>Bycord instalado no {target?.name}!</h2>
            <p className="sub">(Na demonstração, nada foi alterado de verdade.)</p>
            <ul className="tips">{tips.map(t => <li key={t}>{t}</li>)}</ul>
            <footer className="actions">
                <button className="btn ghost" onClick={() => api.openURL(REPO_URL)}>Bycord no GitHub</button>
                <button className="btn primary" onClick={() => api.quit()}>Fechar</button>
            </footer>
        </section>
    );
}

function Manage({ target, onBack, onReinstall }: { target: DiscordInstall; onBack: () => void; onReinstall: () => void; }) {
    const actions = [
        { title: "Reparar", text: "Aplica o patch de novo. Use quando o Discord atualizar e o Bycord sumir.", soon: true },
        { title: "Atualizar", text: "Baixa a versão mais nova do Bycord agora.", soon: true },
        { title: "Trocar de modo", text: "Muda entre Rápido e Completo.", onClick: onReinstall },
        { title: "Desinstalar", text: "Devolve o Discord ao original. Suas configurações ficam guardadas.", soon: true, danger: true },
    ];

    return (
        <section className="screen">
            <div className="screen-head">
                <div>
                    <h2>Gerenciar o Bycord</h2>
                    <p className="sub">No {target.name}{target.modPath ? ` · ${target.modPath}` : ""}</p>
                </div>
            </div>
            <div className="manage">
                {actions.map(a => (
                    <button key={a.title} className={`manage-card ${a.danger ? "danger" : ""}`} disabled={a.soon} onClick={a.onClick}>
                        <span className="mode-title">{a.title}{a.soon && <span className="pill muted">em breve</span>}</span>
                        <span className="mode-text">{a.text}</span>
                    </button>
                ))}
            </div>
            <Footer onBack={onBack} />
        </section>
    );
}
