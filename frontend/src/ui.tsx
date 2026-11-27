import { ArrowRight, Check, CircleCheck, CircleX, LoaderCircle, Minus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";

import { api } from "./api";
import logoMark from "./assets/images/logo.png";

export const spring = { type: "spring", stiffness: 420, damping: 34 } as const;
export const softSpring = { type: "spring", stiffness: 220, damping: 26 } as const;

/* Fundo animado: brilho que se move devagar e uma grade de pontos. */
export function Background() {
    return (
        <div className="bg" aria-hidden>
            <div className="bg-blob bg-blob-a" />
            <div className="bg-blob bg-blob-b" />
            <div className="bg-grid" />
            <div className="bg-noise" />
        </div>
    );
}

export function TitleBar() {
    return (
        <header className="titlebar" style={{ "--wails-draggable": "drag" } as React.CSSProperties}>
            <img src={logoMark} alt="Bycord" className="titlebar-logo" />
            <span className="titlebar-sep" />
            <span className="titlebar-name">Installer</span>
            <div className="titlebar-buttons" style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}>
                <button aria-label="Minimizar" onClick={() => api.minimise()}><Minus size={14} /></button>
                <button aria-label="Fechar" className="close" onClick={() => api.quit()}><X size={14} /></button>
            </div>
        </header>
    );
}

/* O indicador de etapas é um cabo: cada etapa é um conector e a "energia" corre até a etapa atual. */
export function CableStepper({ steps, current }: { steps: string[]; current: number; }) {
    const fill = steps.length > 1 ? current / (steps.length - 1) : 0;
    return (
        <nav className="cable" aria-label="Etapas">
            <div className="cable-track">
                <motion.div className="cable-fill" initial={false} animate={{ scaleX: fill }} transition={softSpring} />
                <motion.div className="cable-spark" initial={false} animate={{ left: `${fill * 100}%` }} transition={softSpring} />
            </div>
            <ol className="cable-nodes">
                {steps.map((label, i) => {
                    const state = i < current ? "done" : i === current ? "current" : "todo";
                    return (
                        <li key={label} className={`cable-node ${state}`} aria-current={state === "current" ? "step" : undefined}>
                            <span className="node-dot">
                                <AnimatePresence initial={false}>
                                    {state === "done" && (
                                        <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring}>
                                            <Check size={12} strokeWidth={3} />
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                {state === "current" && <span className="node-pulse" />}
                            </span>
                            <span className="node-label">{label}</span>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

type ButtonProps = ComponentProps<typeof motion.button> & {
    variant?: "primary" | "ghost" | "danger" | "subtle";
    arrow?: boolean;
    icon?: ReactNode;
};

export function Button({ variant = "primary", arrow, icon, children, className = "", ...rest }: ButtonProps) {
    return (
        <motion.button
            whileTap={rest.disabled ? undefined : { scale: 0.97 }}
            className={`btn btn-${variant} ${className}`}
            {...rest}
        >
            {icon}
            <span>{children as ReactNode}</span>
            {arrow && <ArrowRight className="btn-arrow" size={16} />}
        </motion.button>
    );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "warn" | "danger" | "muted"; children: ReactNode; }) {
    return (
        <span className={`badge badge-${tone}`}>
            <span className="badge-dot" />
            {children}
        </span>
    );
}

export function Dialog({ open, icon, tone = "warn", title, text, action, onConfirm, onCancel }: {
    open: boolean; icon: ReactNode; tone?: "warn" | "danger"; title: string; text: string; action: string;
    onConfirm: () => void; onCancel: () => void;
}) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={onCancel}
                >
                    <motion.div
                        className="dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="dialog-title"
                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 6 }}
                        transition={spring}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className={`dialog-icon tone-${tone}`}>{icon}</div>
                        <h3 id="dialog-title">{title}</h3>
                        <p>{text}</p>
                        <div className="dialog-actions">
                            <Button variant="ghost" onClick={onCancel} autoFocus>Cancelar</Button>
                            <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>{action}</Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/* Anel de progresso com brilho. */
export function ProgressRing({ value, state }: { value: number; state: "running" | "done" | "error"; }) {
    const r = 62;
    const c = 2 * Math.PI * r;
    return (
        <div className={`ring ring-${state}`}>
            <svg viewBox="0 0 150 150" width="150" height="150">
                <defs>
                    <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ddd6fe" />
                        <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                </defs>
                <circle cx="75" cy="75" r={r} className="ring-track" />
                <motion.circle
                    cx="75" cy="75" r={r}
                    className="ring-value"
                    strokeDasharray={c}
                    initial={{ strokeDashoffset: c }}
                    animate={{ strokeDashoffset: c * (1 - value) }}
                    transition={softSpring}
                />
            </svg>
            {state === "running" && <div className="ring-orbit" />}
            <div className="ring-center">
                <AnimatePresence mode="wait" initial={false}>
                    {state === "running" && (
                        <motion.span key="pct" className="ring-pct" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                            {Math.round(value * 100)}<small>%</small>
                        </motion.span>
                    )}
                    {state === "done" && (
                        <motion.span key="ok" className="ring-icon ok" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={spring}>
                            <Check size={44} strokeWidth={2.6} />
                        </motion.span>
                    )}
                    {state === "error" && (
                        <motion.span key="err" className="ring-icon err" initial={{ scale: 0 }} animate={{ scale: 1, x: [0, -6, 6, -4, 4, 0] }} transition={{ duration: 0.45 }}>
                            <X size={44} strokeWidth={2.6} />
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

/* Lista de etapas com ícone animado para cada estado. */
export function StepList({ steps, current, done, failed }: { steps: string[]; current: number; done: boolean; failed: boolean; }) {
    return (
        <ol className="steplist">
            {steps.map((label, i) => {
                const n = i + 1;
                const state = done || n < current ? "done" : n === current ? (failed ? "error" : "active") : "todo";
                return (
                    <motion.li
                        key={label + i}
                        className={`steplist-item ${state}`}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...softSpring, delay: i * 0.06 }}
                    >
                        <span className="steplist-icon">
                            <AnimatePresence mode="wait" initial={false}>
                                {state === "done" && <motion.span key="d" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}><CircleCheck size={18} /></motion.span>}
                                {state === "active" && <motion.span key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><LoaderCircle size={18} className="spin" /></motion.span>}
                                {state === "error" && <motion.span key="e" initial={{ scale: 0 }} animate={{ scale: 1 }}><CircleX size={18} /></motion.span>}
                                {state === "todo" && <motion.span key="t" className="steplist-todo" />}
                            </AnimatePresence>
                        </span>
                        {label}
                    </motion.li>
                );
            })}
        </ol>
    );
}

/* Confete simples: pedacinhos saem do centro e caem. */
export function Confetti() {
    const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => {
        const angle = (i / 36) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 120 + Math.random() * 140;
        return {
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist * 0.7 - 40,
            rotate: Math.random() * 540 - 270,
            color: ["#8b5cf6", "#ddd6fe", "#fafafa", "#a78bfa", "#52525b"][i % 5],
            w: 4 + Math.random() * 5,
            delay: Math.random() * 0.12,
        };
    }), []);

    return (
        <div className="confetti" aria-hidden>
            {pieces.map((p, i) => (
                <motion.span
                    key={i}
                    style={{ background: p.color, width: p.w, height: p.w * 1.6 }}
                    initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
                    animate={{ x: p.x, y: [0, p.y, p.y + 160], opacity: [1, 1, 0], rotate: p.rotate, scale: 1 }}
                    transition={{ duration: 1.6, delay: p.delay, ease: [0.16, 0.84, 0.44, 1], times: [0, 0.45, 1] }}
                />
            ))}
        </div>
    );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; }) {
    return (
        <label className={`checkbox ${checked ? "on" : ""}`}>
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
            <span className="checkbox-box">
                <motion.svg viewBox="0 0 16 16" width="12" height="12">
                    <motion.path
                        d="M3 8.5l3 3 7-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={false}
                        animate={{ pathLength: checked ? 1 : 0 }}
                        transition={{ duration: 0.2 }}
                    />
                </motion.svg>
            </span>
            {children}
        </label>
    );
}
