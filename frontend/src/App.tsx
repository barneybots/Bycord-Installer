import { Trash, TriangleExclamationPoint } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { api, DiscordInstall, inWails, InstallOptions, Mode, OpKind, Requirement } from "./api";
import { ChooseDiscord, ChooseMode, Done, Manage, Operation, Welcome } from "./screens";
import { Background, CableStepper, Dialog, TitleBar } from "./ui";

type Screen = "boas-vindas" | "discord" | "modo" | "operacao" | "pronto" | "gerenciar";

const ORDER: Screen[] = ["boas-vindas", "discord", "modo", "operacao", "pronto"];
const STEP_LABELS = ["Início", "Discord", "Modo", "Instalação", "Pronto"];

interface Confirm {
    tone: "warn" | "danger";
    title: string;
    text: string;
    action: string;
    onConfirm: () => void;
}

export default function App() {
    const [screen, setScreenRaw] = useState<Screen>("boas-vindas");
    const [direction, setDirection] = useState(1);
    const [version, setVersion] = useState("");
    const [discords, setDiscords] = useState<DiscordInstall[] | null>(null);
    const [branch, setBranch] = useState("");
    const [replaceOther, setReplaceOther] = useState(false);
    const [mode, setMode] = useState<Mode>("rapido");
    const [folder, setFolder] = useState("");
    const [reqs, setReqs] = useState<Requirement[] | null>(null);
    const [op, setOp] = useState<OpKind>("install");
    const [confirm, setConfirm] = useState<Confirm | null>(null);
    const lastConfirm = useRef<Confirm | null>(null);
    if (confirm) lastConfirm.current = confirm;

    const selected = discords?.find(d => d.branch === branch);
    const options: InstallOptions = { branch, mode, folder, replaceOther };

    const position = (s: Screen) => s === "gerenciar" ? 1.5 : ORDER.indexOf(s);
    const setScreen = (next: Screen) => {
        setDirection(position(next) >= position(screen) ? 1 : -1);
        setScreenRaw(next);
    };

    const refresh = () => {
        setDiscords(null);
        api.listDiscords().then(found => {
            setTimeout(() => setDiscords(found), 250);
            setBranch(current => {
                if (found.some(d => d.branch === current && d.supported)) return current;
                return (found.find(d => d.supported && d.state === "clean") ?? found.find(d => d.supported))?.branch ?? "";
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

    // Antes de mexer no Discord, avisa se ele está aberto (vai ser fechado).
    const startOp = async (kind: OpKind) => {
        const go = () => { setConfirm(null); setOp(kind); setScreen("operacao"); };
        const touchesDiscord = kind !== "update" && !(kind === "install" && mode === "completo");
        if (touchesDiscord && selected && await api.isRunning(branch)) {
            setConfirm({
                tone: "warn",
                title: `O ${selected.name} está aberto`,
                text: "Ele vai ser fechado para continuar. Se estiver numa call, termine antes.",
                action: "Fechar e continuar",
                onConfirm: go,
            });
            return;
        }
        go();
    };

    const stepIndex = screen === "gerenciar" ? 1 : ORDER.indexOf(screen);
    const shown = confirm ?? lastConfirm.current;

    return (
        <MotionConfig reducedMotion="user">
            <div className="window">
                <Background />
                <TitleBar />
                <CableStepper steps={STEP_LABELS} current={stepIndex} />

                <main className="stage">
                    <AnimatePresence mode="wait" custom={direction} initial={false}>
                        <motion.div
                            key={screen}
                            className="stage-inner"
                            custom={direction}
                            initial={{ opacity: 0, x: direction * 28, filter: "blur(4px)" }}
                            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, x: direction * -28, filter: "blur(4px)" }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {screen === "boas-vindas" && <Welcome version={version || "…"} onStart={() => setScreen("discord")} />}

                            {screen === "discord" && (
                                <ChooseDiscord
                                    discords={discords}
                                    branch={branch}
                                    onSelect={b => { setBranch(b); setReplaceOther(false); }}
                                    replaceOther={replaceOther}
                                    onReplaceOther={setReplaceOther}
                                    onRefresh={refresh}
                                    onBack={() => setScreen("boas-vindas")}
                                    onNext={() => setScreen(selected?.state === "bycord" ? "gerenciar" : "modo")}
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
                                        tone: "danger",
                                        title: `Remover o Bycord do ${selected.name}?`,
                                        text: "O Discord volta ao original. Suas configurações ficam guardadas em %APPDATA%\\Bycord, caso queira voltar.",
                                        action: "Desinstalar",
                                        onConfirm: () => { setConfirm(null); void startOp("uninstall"); },
                                    })}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </main>

                {!inWails && <span className="preview-tag">prévia no navegador</span>}

                <Dialog
                    open={Boolean(confirm)}
                    tone={shown?.tone}
                    icon={shown?.tone === "danger" ? <Trash size={20} /> : <TriangleExclamationPoint size={20} />}
                    title={shown?.title ?? ""}
                    text={shown?.text ?? ""}
                    action={shown?.action ?? ""}
                    onConfirm={() => confirm?.onConfirm()}
                    onCancel={() => setConfirm(null)}
                />
            </div>
        </MotionConfig>
    );
}
