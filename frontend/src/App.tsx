import { useEffect, useRef, useState } from "react";

import { api, DiscordInstall, inWails, InstallOptions, Mode, OpKind, Progress, Requirement } from "./api";
import byto from "./assets/images/byto.png";
import bytoAcenando from "./assets/images/byto-acenando.png";
import logo from "./assets/images/logo.png";

type Screen = "boas-vindas" | "discord" | "modo" | "operacao" | "pronto" | "gerenciar";

const STEPS: { id: Screen; label: string; }[] = [
    { id: "boas-vindas", label: "Boas-vindas" },
    { id: "discord", label: "Escolher o Discord" },
    { id: "modo", label: "Modo de instalação" },
    { id: "operacao", label: "Instalação" },
    { id: "pronto", label: "Pronto" },
];

const REPO_URL = "https://github.com/barneybots/Bycord";

const OP_TEXT: Record<OpKind, { running: string; done: string; }> = {
    install: { running: "Instalando…", done: "Bycord instalado" },
    repair: { running: "Reparando…", done: "Bycord reparado" },
    update: { running: "Atualizando…", done: "Bycord atualizado" },
    uninstall: { running: "Desinstalando…", done: "Bycord removido" },
};

interface Confirm {
    title: string;
    text: string;
    action: string;
    danger?: boolean;
    onConfirm: () => void;
}

export default function App() {
    const [screen, setScreen] = useState<Screen>("boas-vindas");
    const [version, setVersion] = useState("");
    const [discords, setDiscords] = useState<DiscordInstall[] | null>(null);
    const [branch, setBranch] = useState("");
    const [replaceOther, setReplaceOther] = useState(false);
    const [mode, setMode] = useState<Mode>("rapido");
    const [folder, setFolder] = useState("");
    const [reqs, setReqs] = useState<Requirement[] | null>(null);
    const [op, setOp] = useState<OpKind>("install");
    const [confirm, setConfirm] = useState<Confirm | null>(null);

    const selected = discords?.find(d => d.branch === branch);
    const options: InstallOptions = { branch, mode, folder, replaceOther };

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

    const selectBranch = (b: string) => {
        setBranch(b);
        setReplaceOther(false);
    };

    // Antes de mexer no Discord, avisa se ele está aberto (vai ser fechado).
    const startOp = async (kind: OpKind) => {
        const go = () => { setConfirm(null); setOp(kind); setScreen("operacao"); };
        const touchesDiscord = kind !== "update" && !(kind === "install" && mode === "completo");
        if (touchesDiscord && selected && await api.isRunning(branch)) {
            setConfirm({
                title: `O ${selected.name} está aberto`,
                text: "Ele vai ser fechado para continuar. Se estiver numa call, termine antes.",
                action: "Fechar e continuar",
                onConfirm: go,
            });
            return;
        }
        go();
    };

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
                            onSelect={selectBranch}
                            replaceOther={replaceOther}
                            onReplaceOther={setReplaceOther}
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
                            onNext={() => startOp("install")}
                        />
                    )}

                    {screen === "operacao" && (
                        <Operation
                            key={op + branch}
                            kind={op}
                            options={options}
                            target={selected}
                            onDone={() => { refresh(); setScreen("pronto"); }}
                            onBack={() => { refresh(); setScreen(op === "install" ? "modo" : "gerenciar"); }}
                        />
                    )}

                    {screen === "pronto" && <Done target={selected} kind={op} mode={mode} />}

                    {screen === "gerenciar" && selected && (
                        <Manage
                            target={selected}
                            onBack={() => setScreen("discord")}
                            onReinstall={() => setScreen("modo")}
                            onRepair={() => startOp("repair")}
                            onUpdate={() => startOp("update")}
                            onUninstall={() => setConfirm({
                                title: `Remover o Bycord do ${selected.name}?`,
                                text: `O Discord volta ao original. Suas configurações ficam guardadas em %APPDATA%\\Bycord, caso queira voltar.`,
                                action: "Desinstalar",
                                danger: true,
                                onConfirm: () => { setConfirm(null); void startOp("uninstall"); },
                            })}
                        />
                    )}
                </main>
            </div>

            {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
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

function ConfirmDialog({ title, text, action, danger, onConfirm, onCancel }: Confirm & { onCancel: () => void; }) {
    return (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="dialog">
                <h3 id="confirm-title">{title}</h3>
                <p>{text}</p>
                <div className="dialog-actions">
                    <button className="btn ghost" onClick={onCancel} autoFocus>Cancelar</button>
                    <button className={`btn ${danger ? "danger" : "primary"}`} onClick={onConfirm}>{action}</button>
                </div>
            </div>
        </div>
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

function ChooseDiscord({ discords, branch, onSelect, replaceOther, onReplaceOther, onRefresh, onBack, onNext, selected }: {
    discords: DiscordInstall[] | null; branch: string; onSelect: (b: string) => void;
    replaceOther: boolean; onReplaceOther: (v: boolean) => void; onRefresh: () => void;
    onBack: () => void; onNext: () => void; selected?: DiscordInstall;
}) {
    const blocked = !selected?.supported || selected.state === "broken" || (selected.state === "other" && !replaceOther);

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
                    Só dá para ter um mod por Discord. Para instalar o Bycord nele, o {selected.mod} sai deste Discord
                    (os arquivos e configurações do {selected.mod} continuam no PC).
                    <label className="check">
                        <input type="checkbox" checked={replaceOther} onChange={e => onReplaceOther(e.target.checked)} />
                        Sim, trocar o {selected.mod} pelo Bycord no {selected.name}
                    </label>
                </div>
            )}

            {selected?.state === "broken" && (
                <div className="notice warn">
                    <strong>Essa instalação está com problema</strong>
                    Não achei o app.asar do Discord. Reinstale o {selected.name} e procure de novo.
                </div>
            )}

            <Footer onBack={onBack} onNext={onNext} nextDisabled={blocked}
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
                    <span className="pill">Para devs · em breve</span>
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

function Operation({ kind, options, target, onDone, onBack }: {
    kind: OpKind; options: InstallOptions; target?: DiscordInstall; onDone: () => void; onBack: () => void;
}) {
    const [progress, setProgress] = useState<Progress | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const [showLog, setShowLog] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const logRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        setProgress(null);
        setLog([]);
        return api.run(kind, options, p => {
            setProgress(p);
            setLog(l => [...l, p.log]);
        });
    }, [attempt]);

    useEffect(() => {
        if (progress?.error) setShowLog(true);
    }, [progress?.error]);

    useEffect(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }, [log, showLog]);

    const failed = Boolean(progress?.error);
    const pct = progress ? Math.round((progress.done ? 1 : (progress.step - 1) / progress.total) * 100) : 0;
    const demo = kind === "install" && options.mode === "completo";

    return (
        <section className="screen">
            <div className="screen-head">
                <div>
                    <h2>{failed ? "Algo deu errado" : progress?.done ? "Tudo certo" : OP_TEXT[kind].running}</h2>
                    <p className="sub">
                        {target?.name}
                        {kind === "install" && `, modo ${options.mode === "rapido" ? "Rápido" : "Completo"}`}.
                    </p>
                </div>
            </div>

            {demo && (
                <div className="notice demo">
                    <strong>Demonstração</strong>
                    O modo Completo ainda só mostra as etapas. Nada é baixado e o Discord não é alterado.
                </div>
            )}

            {failed ? (
                <div className="notice error">
                    <strong>Parou em: {progress!.label}</strong>
                    {progress!.error}
                </div>
            ) : (
                <>
                    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                        <div className="progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="progress-label">{progress?.label ?? "Preparando…"} <span className="sub">{pct}%</span></p>
                </>
            )}

            <button className="link" onClick={() => setShowLog(s => !s)}>{showLog ? "Esconder detalhes" : "Ver detalhes"}</button>
            {showLog && <pre className="log" ref={logRef}>{log.join("\n")}</pre>}

            {failed
                ? (
                    <footer className="actions">
                        <button className="btn ghost" onClick={onBack}>Voltar</button>
                        <button className="btn primary" onClick={() => setAttempt(a => a + 1)}>Tentar de novo</button>
                    </footer>
                )
                : <Footer onNext={onDone} nextLabel="Continuar" nextDisabled={!progress?.done} />}
        </section>
    );
}

function Done({ target, kind, mode }: { target?: DiscordInstall; kind: OpKind; mode: Mode; }) {
    const [openError, setOpenError] = useState("");
    const demo = kind === "install" && mode === "completo";

    const tips = kind === "uninstall"
        ? ["O Discord voltou ao original.", "Suas configurações do Bycord continuam em %APPDATA%\\Bycord, caso queira voltar."]
        : kind === "update"
            ? ["Reinicie o Discord para usar a versão nova."]
            : [
                "Abra as Configurações do Discord: a seção Bycord fica no menu da esquerda.",
                "O Bycord se atualiza sozinho pelos releases do GitHub.",
                "Se o Discord atualizar e o Bycord sumir, abra este instalador e use Reparar.",
            ];

    return (
        <section className="screen done">
            <img src={bytoAcenando} alt="" className="done-byto" />
            <h2>{OP_TEXT[kind].done}{kind === "uninstall" ? " do" : " no"} {target?.name}!</h2>
            {demo && <p className="sub">(Demonstração: nada foi alterado de verdade.)</p>}
            <ul className="tips">{tips.map(t => <li key={t}>{t}</li>)}</ul>
            {openError && <div className="notice error"><strong>Não consegui abrir o Discord</strong>{openError}</div>}
            <footer className="actions">
                <button className="btn ghost" onClick={() => api.openURL(REPO_URL)}>Bycord no GitHub</button>
                <div className="actions-right">
                    <button className="btn ghost" onClick={() => api.quit()}>Fechar</button>
                    {target && !demo && (
                        <button className="btn primary" onClick={() => api.openDiscord(target.branch).then(err => {
                            if (err) setOpenError(err);
                            else api.quit();
                        })}>
                            Abrir o {target.name}
                        </button>
                    )}
                </div>
            </footer>
        </section>
    );
}

function Manage({ target, onBack, onReinstall, onRepair, onUpdate, onUninstall }: {
    target: DiscordInstall; onBack: () => void; onReinstall: () => void;
    onRepair: () => void; onUpdate: () => void; onUninstall: () => void;
}) {
    const actions = [
        { title: "Reparar", text: "Aplica o patch de novo. Use quando o Discord atualizar e o Bycord sumir.", onClick: onRepair },
        { title: "Atualizar", text: "Baixa a versão mais nova do Bycord agora.", onClick: onUpdate },
        { title: "Trocar de modo", text: "Muda entre Rápido e Completo.", onClick: onReinstall },
        { title: "Desinstalar", text: "Devolve o Discord ao original. Suas configurações ficam guardadas.", onClick: onUninstall, danger: true },
    ];

    return (
        <section className="screen">
            <div className="screen-head">
                <div>
                    <h2>Gerenciar o Bycord</h2>
                    <p className="sub">No {target.name}</p>
                </div>
            </div>
            <div className="manage">
                {actions.map(a => (
                    <button key={a.title} className={`manage-card ${a.danger ? "danger" : ""}`} onClick={a.onClick}>
                        <span className="mode-title">{a.title}</span>
                        <span className="mode-text">{a.text}</span>
                    </button>
                ))}
            </div>
            {target.modPath && <p className="hint">Carregando de <code>{target.modPath}</code></p>}
            <Footer onBack={onBack} />
        </section>
    );
}
