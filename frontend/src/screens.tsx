import {
    ArrowLeft, CodeXml, ExternalLink, FolderOpen, Info, Lock, Power, RefreshCw, Repeat, ShieldCheck, Sparkles,
    Terminal, Trash, Undo2, Wrench, Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { api, DiscordInstall, InstallOptions, Mode, OpKind, Progress, Requirement } from "./api";
import byto from "./assets/images/byto.png";
import bytoAcenando from "./assets/images/byto-acenando.png";
import { Badge, Button, Checkbox, Confetti, ProgressRing, softSpring, spring, StepList } from "./ui";

const REPO_URL = "https://github.com/barneybots/Bycord";

/* Entrada em cascata para os itens de cada tela. */
const list = { show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: softSpring } };

function Actions({ children }: { children: React.ReactNode; }) {
    return <footer className="actions">{children}</footer>;
}

function Back({ onClick }: { onClick: () => void; }) {
    return <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={onClick}>Voltar</Button>;
}

function Heading({ title, sub, aside }: { title: string; sub?: React.ReactNode; aside?: React.ReactNode; }) {
    return (
        <motion.div className="heading" variants={item}>
            <div>
                <h2>{title}</h2>
                {sub && <p className="sub">{sub}</p>}
            </div>
            {aside}
        </motion.div>
    );
}

/* ---------------- Boas-vindas ---------------- */

export function Welcome({ version, onStart }: { version: string; onStart: () => void; }) {
    const features = [
        { icon: <Zap size={16} />, title: "Instala em segundos", text: "Baixa só o necessário, ~1 MB." },
        { icon: <Undo2 size={16} />, title: "Desfaz quando quiser", text: "O Discord original fica guardado." },
        { icon: <ShieldCheck size={16} />, title: "Gratuito e aberto", text: "Código no GitHub, baseado no Vencord." },
    ];

    return (
        <motion.section className="screen welcome" variants={list} initial="hidden" animate="show">
            <div className="welcome-copy">
                <motion.span className="eyebrow" variants={item}><Sparkles size={13} /> Instalador · v{version}</motion.span>
                <motion.h1 variants={item}>Seu Discord,<br /><span className="grad">do seu jeito.</span></motion.h1>
                <motion.p className="lead" variants={item}>
                    O Bycord é um client mod com plugins, temas e visual próprio. Escolha o Discord,
                    clique em instalar e pronto.
                </motion.p>
                <motion.ul className="features" variants={list}>
                    {features.map(f => (
                        <motion.li key={f.title} variants={item}>
                            <span className="feature-icon">{f.icon}</span>
                            <span><strong>{f.title}</strong>{f.text}</span>
                        </motion.li>
                    ))}
                </motion.ul>
            </div>

            <motion.div className="welcome-art" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...softSpring, delay: 0.15 }}>
                <div className="halo" />
                <div className="orbit orbit-a"><span /></div>
                <div className="orbit orbit-b"><span /></div>
                <motion.img
                    src={byto}
                    alt="Byto, o mascote do Bycord"
                    className="welcome-byto"
                    animate={{ y: [0, -10, 0], rotate: [0, -1.5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
            </motion.div>

            <Actions>
                <p className="tos"><Info size={14} /> Client mods violam os Termos do Discord. Use por sua conta e risco.</p>
                <Button arrow onClick={onStart}>Começar</Button>
            </Actions>
        </motion.section>
    );
}

/* ---------------- Escolher o Discord ---------------- */

const BRANCH_GLYPH: Record<string, string> = { stable: "S", ptb: "P", canary: "C", development: "D", phoenix: "Φ" };

function stateBadge(d: DiscordInstall) {
    if (d.state === "bycord") return <Badge tone="accent">Com Bycord</Badge>;
    if (d.state === "other") return <Badge tone="warn">Com {d.mod}</Badge>;
    if (d.state === "unsupported") return <Badge tone="muted">Não suportado</Badge>;
    if (d.state === "broken") return <Badge tone="danger">Com problema</Badge>;
    return <Badge>Sem mod</Badge>;
}

export function ChooseDiscord({ discords, branch, onSelect, replaceOther, onReplaceOther, onRefresh, onBack, onNext }: {
    discords: DiscordInstall[] | null; branch: string; onSelect: (b: string) => void;
    replaceOther: boolean; onReplaceOther: (v: boolean) => void; onRefresh: () => void;
    onBack: () => void; onNext: () => void;
}) {
    const selected = discords?.find(d => d.branch === branch);
    const blocked = !selected?.supported || selected.state === "broken" || (selected.state === "other" && !replaceOther);

    return (
        <motion.section className="screen" variants={list} initial="hidden" animate="show">
            <Heading
                title="Em qual Discord?"
                sub="Encontrei estes no seu PC. Só o que você escolher é alterado."
                aside={
                    <button className="icon-btn" onClick={onRefresh} aria-label="Procurar de novo" title="Procurar de novo">
                        <RefreshCw size={16} className={discords === null ? "spin" : ""} />
                    </button>
                }
            />

            <motion.div className="cards" variants={list}>
                {discords?.length === 0 && (
                    <motion.div className="empty" variants={item}>
                        <strong>Nenhum Discord encontrado</strong>
                        Instale o Discord (de preferência o Canary, para testar) e clique em procurar de novo.
                    </motion.div>
                )}
                {discords?.map(d => {
                    const active = branch === d.branch;
                    return (
                        <motion.button
                            key={d.branch}
                            variants={item}
                            className={`card discord ${active ? "active" : ""}`}
                            disabled={!d.supported}
                            aria-pressed={active}
                            onClick={() => onSelect(d.branch)}
                            whileHover={d.supported ? { y: -1 } : undefined}
                        >
                            {active && <motion.span layoutId="discord-ring" className="card-ring" transition={spring} />}
                            <span className={`glyph glyph-${d.branch}`}>{BRANCH_GLYPH[d.branch] ?? "D"}</span>
                            <span className="card-main">
                                <span className="card-title">{d.name}</span>
                                <span className="card-sub">
                                    {d.supported ? `Versão ${d.version}` : <><Lock size={11} /> Feito em Rust, sem Electron: o Bycord não roda nele</>}
                                </span>
                            </span>
                            {stateBadge(d)}
                            <span className={`radio ${active ? "on" : ""}`}>
                                <AnimatePresence>{active && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring} />}</AnimatePresence>
                            </span>
                        </motion.button>
                    );
                })}
            </motion.div>

            <AnimatePresence initial={false}>
                {selected?.state === "other" && (
                    <motion.div
                        key="other"
                        className="callout warn"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={softSpring}
                    >
                        <div className="callout-inner">
                            <strong>Esse Discord já tem o {selected.mod}</strong>
                            <span>Só cabe um mod por Discord. O {selected.mod} sai deste Discord, mas os arquivos e configurações dele continuam no PC.</span>
                            <Checkbox checked={replaceOther} onChange={onReplaceOther}>
                                Trocar o {selected.mod} pelo Bycord no {selected.name}
                            </Checkbox>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Actions>
                <Back onClick={onBack} />
                <Button arrow onClick={onNext} disabled={blocked}>{selected?.state === "bycord" ? "Gerenciar" : "Continuar"}</Button>
            </Actions>
        </motion.section>
    );
}

/* ---------------- Modo ---------------- */

export function ChooseMode({ mode, onMode, folder, onChooseFolder, reqs, onRecheck, target, onBack, onNext }: {
    mode: Mode; onMode: (m: Mode) => void; folder: string; onChooseFolder: () => void;
    reqs: Requirement[] | null; onRecheck: () => void; target?: DiscordInstall; onBack: () => void; onNext: () => void;
}) {
    const missing = mode === "completo" && (!reqs || reqs.some(r => !r.found));
    const modes = [
        {
            id: "rapido" as Mode, icon: <Zap size={20} />, title: "Rápido", tag: "Recomendado",
            text: "Baixa só o Bycord pronto e instala.",
            points: ["Não precisa de nada instalado", "Se atualiza sozinho", "~1 MB em %APPDATA%\\Bycord"],
        },
        {
            id: "completo" as Mode, icon: <CodeXml size={20} />, title: "Completo", tag: "Em breve",
            text: "Clona o repositório e compila no seu PC.",
            points: ["Mexa no código e crie plugins", "Atualiza com git pull", "~200 MB, precisa de Git, Node e pnpm"],
        },
    ];

    return (
        <motion.section className="screen" variants={list} initial="hidden" animate="show">
            <Heading title="Como instalar?" sub={<>No <b>{target?.name}</b>. Dá para trocar de modo depois.</>} />

            <motion.div className="modes" variants={list}>
                {modes.map(m => {
                    const active = mode === m.id;
                    return (
                        <motion.button
                            key={m.id}
                            variants={item}
                            className={`card mode ${active ? "active" : ""}`}
                            aria-pressed={active}
                            onClick={() => onMode(m.id)}
                            whileHover={{ y: -2 }}
                        >
                            {active && <motion.span layoutId="mode-ring" className="card-ring" transition={spring} />}
                            <span className="mode-top">
                                <span className="mode-icon">{m.icon}</span>
                                <span className={`tag ${m.id === "rapido" ? "tag-accent" : ""}`}>{m.tag}</span>
                            </span>
                            <span className="card-title big">{m.title}</span>
                            <span className="card-sub">{m.text}</span>
                            <ul className="points">{m.points.map(p => <li key={p}>{p}</li>)}</ul>
                        </motion.button>
                    );
                })}
            </motion.div>

            <AnimatePresence initial={false}>
                {mode === "completo" && (
                    <motion.div
                        key="dev"
                        className="dev-panel"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={softSpring}
                    >
                        <div className="dev-inner">
                            <div className="field">
                                <FolderOpen size={15} />
                                <code>{folder}</code>
                                <button className="link" onClick={onChooseFolder}>Alterar</button>
                            </div>
                            <div className="tools">
                                {!reqs && <span className="muted">Conferindo ferramentas…</span>}
                                {reqs?.map(r => (
                                    <span key={r.name} className={`tool ${r.found ? "ok" : "missing"}`}>
                                        <span className="tool-dot" />
                                        {r.name}
                                        {r.found ? <em>{r.version}</em> : <button className="link" onClick={() => api.openURL(r.link)}>baixar</button>}
                                    </span>
                                ))}
                                <button className="link" onClick={onRecheck}>conferir de novo</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Actions>
                <Back onClick={onBack} />
                <Button arrow onClick={onNext} disabled={missing}>Instalar</Button>
            </Actions>
        </motion.section>
    );
}

/* ---------------- Operação (instalar, reparar, atualizar, desinstalar) ---------------- */

const OP_TITLE: Record<OpKind, string> = {
    install: "Instalando o Bycord",
    repair: "Reparando o Bycord",
    update: "Atualizando o Bycord",
    uninstall: "Removendo o Bycord",
};

export function Operation({ kind, options, target, onDone, onBack }: {
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
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }, [log, showLog]);

    // Quando termina bem, segue sozinho para a tela final.
    useEffect(() => {
        if (!progress?.done) return;
        const t = setTimeout(onDone, 1100);
        return () => clearTimeout(t);
    }, [progress?.done]);

    const failed = Boolean(progress?.error);
    const value = progress ? (progress.done ? 1 : (progress.step - 0.5) / progress.total) : 0.02;
    const demo = kind === "install" && options.mode === "completo";

    return (
        <motion.section className="screen" variants={list} initial="hidden" animate="show">
            <Heading
                title={failed ? "Algo deu errado" : progress?.done ? "Tudo certo!" : OP_TITLE[kind]}
                sub={<>{target?.name}{kind === "install" && <> · modo {options.mode === "rapido" ? "Rápido" : "Completo"}</>}{demo && <> · <span className="demo">demonstração</span></>}</>}
            />

            <motion.div className="op" variants={item}>
                <ProgressRing value={value} state={failed ? "error" : progress?.done ? "done" : "running"} />
                <div className="op-side">
                    <StepList steps={progress?.steps ?? []} current={progress?.step ?? 0} done={Boolean(progress?.done)} failed={failed} />
                    <AnimatePresence>
                        {failed && (
                            <motion.div className="callout danger" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                <div className="callout-inner">
                                    <strong>Parou em “{progress!.label}”</strong>
                                    <span className="selectable">{progress!.error}</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <motion.div variants={item} className="log-wrap">
                <button className="link log-toggle" onClick={() => setShowLog(s => !s)}>
                    <Terminal size={13} /> {showLog ? "Esconder detalhes" : "Ver detalhes"}
                </button>
                <AnimatePresence initial={false}>
                    {showLog && (
                        <motion.pre
                            ref={logRef}
                            className="log"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 96 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={softSpring}
                        >
                            {log.join("\n")}
                        </motion.pre>
                    )}
                </AnimatePresence>
            </motion.div>

            <Actions>
                {failed ? <Back onClick={onBack} /> : <span />}
                {failed
                    ? <Button icon={<RefreshCw size={15} />} onClick={() => setAttempt(a => a + 1)}>Tentar de novo</Button>
                    : <Button arrow onClick={onDone} disabled={!progress?.done}>Continuar</Button>}
            </Actions>
        </motion.section>
    );
}

/* ---------------- Pronto ---------------- */

export function Done({ target, kind, mode }: { target?: DiscordInstall; kind: OpKind; mode: Mode; }) {
    const [openError, setOpenError] = useState("");
    const demo = kind === "install" && mode === "completo";
    const celebrate = kind !== "uninstall";

    const title = {
        install: "Bycord instalado!",
        repair: "Bycord reparado!",
        update: "Bycord atualizado!",
        uninstall: "Bycord removido",
    }[kind];

    const tips = kind === "uninstall"
        ? [
            { icon: <Undo2 size={16} />, text: "O Discord voltou a ser o original." },
            { icon: <FolderOpen size={16} />, text: "Suas configurações ficam em %APPDATA%\\Bycord, caso volte." },
        ]
        : kind === "update"
            ? [{ icon: <Power size={16} />, text: "Reinicie o Discord para usar a versão nova." }]
            : [
                { icon: <Sparkles size={16} />, text: "Nas Configurações do Discord, procure a seção Bycord." },
                { icon: <RefreshCw size={16} />, text: "Ele se atualiza sozinho pelo GitHub." },
                { icon: <Wrench size={16} />, text: "Se o Discord atualizar e o Bycord sumir, use Reparar aqui." },
            ];

    return (
        <motion.section className="screen done" variants={list} initial="hidden" animate="show">
            {celebrate && !demo && <Confetti />}

            <motion.div className="done-hero" variants={item}>
                <motion.div className={`done-badge ${celebrate ? "" : "neutral"}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.05 }}>
                    <span className="done-burst" />
                    {celebrate
                        ? (
                            <svg viewBox="0 0 24 24" width="40" height="40">
                                <motion.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25 }} />
                            </svg>
                        )
                        : <Undo2 size={34} />}
                </motion.div>
                <h2>{title}</h2>
                <p className="sub">{kind === "uninstall" ? "do" : "no"} <b>{target?.name}</b>{demo && " · demonstração, nada foi alterado"}</p>
            </motion.div>

            <motion.ul className={`tips tips-${tips.length}`} variants={list}>
                {tips.map(t => (
                    <motion.li key={t.text} variants={item}>
                        <span className="feature-icon">{t.icon}</span>{t.text}
                    </motion.li>
                ))}
            </motion.ul>

            {openError && <div className="callout danger"><div className="callout-inner"><strong>Não consegui abrir o Discord</strong><span>{openError}</span></div></div>}

            {celebrate && (
                <motion.img
                    src={bytoAcenando}
                    alt=""
                    className="done-byto"
                    initial={{ y: 120, rotate: 12, opacity: 0 }}
                    animate={{ y: 0, rotate: -4, opacity: 1 }}
                    transition={{ ...softSpring, delay: 0.35 }}
                />
            )}

            <Actions>
                <Button variant="subtle" icon={<ExternalLink size={15} />} onClick={() => api.openURL(REPO_URL)}>GitHub</Button>
                <div className="actions-right">
                    <Button variant="ghost" onClick={() => api.quit()}>Fechar</Button>
                    {target && !demo && kind !== "uninstall" && (
                        <Button arrow onClick={() => api.openDiscord(target.branch).then(err => err ? setOpenError(err) : api.quit())}>
                            Abrir o {target.name}
                        </Button>
                    )}
                </div>
            </Actions>
        </motion.section>
    );
}

/* ---------------- Gerenciar ---------------- */

export function Manage({ target, onBack, onReinstall, onRepair, onUpdate, onUninstall }: {
    target: DiscordInstall; onBack: () => void; onReinstall: () => void;
    onRepair: () => void; onUpdate: () => void; onUninstall: () => void;
}) {
    const actions = [
        { icon: <Wrench size={18} />, title: "Reparar", text: "Aplica o patch de novo depois de uma atualização do Discord.", onClick: onRepair },
        { icon: <RefreshCw size={18} />, title: "Atualizar", text: "Baixa agora a versão mais nova do Bycord.", onClick: onUpdate },
        { icon: <Repeat size={18} />, title: "Trocar de modo", text: "Muda entre Rápido e Completo.", onClick: onReinstall },
        { icon: <Trash size={18} />, title: "Desinstalar", text: "Devolve o Discord ao original.", onClick: onUninstall, danger: true },
    ];

    return (
        <motion.section className="screen" variants={list} initial="hidden" animate="show">
            <Heading title="Gerenciar o Bycord" sub="Esse Discord já está com o Bycord." />

            <motion.div className="manage-head" variants={item}>
                <span className={`glyph glyph-${target.branch}`}>{BRANCH_GLYPH[target.branch] ?? "D"}</span>
                <span className="card-main">
                    <span className="card-title">{target.name} <Badge tone="accent">Com Bycord</Badge></span>
                    <code className="card-sub mono">{target.modPath || target.path}</code>
                </span>
            </motion.div>

            <motion.div className="manage" variants={list}>
                {actions.map(a => (
                    <motion.button key={a.title} variants={item} className={`card action ${a.danger ? "danger" : ""}`} onClick={a.onClick} whileHover={{ y: -2 }}>
                        <span className="mode-icon">{a.icon}</span>
                        <span className="card-main">
                            <span className="card-title">{a.title}</span>
                            <span className="card-sub">{a.text}</span>
                        </span>
                    </motion.button>
                ))}
            </motion.div>

            <Actions>
                <Back onClick={onBack} />
                <span />
            </Actions>
        </motion.section>
    );
}
