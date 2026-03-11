import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Phaser from "phaser";
import {
  MainScene,
  type ModuleData,
  type NpcData,
  FALLBACK_MODULES,
} from "../game/MainScene";

interface ModuleInfo {
  id: number;
  name: string;
}

type QuestState = "pending" | "accepted" | "declined";

interface DialogLine {
  text: string;
  speaker?: string; // si absent → même speaker que précédent
}

interface DialogState {
  lines: DialogLine[];
  index: number;
  choices?: { label: string; onSelect: () => void }[];
  showChoices: boolean;
}

const CONTROLS_H = 240;
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

// ── Dialogs ────────────────────────────────────────────────────────────────────

const INTRO_DIALOG: DialogLine[] = [
  {
    speaker: "Mirokaï",
    text: "Bonjour à toi, humain, et bienvenue à la Mirokaï Experience !",
  },
  { speaker: "Mirokaï", text: "Je t'attendais… Il faut que tu m'aides !" },
  {
    speaker: "Mirokaï",
    text: "Miroka, notre compagnon, a disparu quelque part dans cet espace.",
  },
  {
    speaker: "Mirokaï",
    text: "Seul quelqu'un qui aura exploré tous les modules pourra le retrouver…",
  },
  { speaker: "Mirokaï", text: "Acceptes-tu de m'aider à retrouver Miroka ?" },
];

const QUEST_ACCEPTED_FOLLOWUP: DialogLine[] = [
  {
    speaker: "Mirokaï",
    text: "Excellent ! Explore tous les modules violets sur la carte.",
  },
  {
    speaker: "Mirokaï",
    text: "Miroka se cache quelque part ici… Bonne chance !",
  },
];

const QUEST_DECLINED_FOLLOWUP: DialogLine[] = [
  {
    speaker: "Mirokaï",
    text: "Je comprends… Reviens me voir si tu changes d'avis.",
  },
  { speaker: "Mirokaï", text: "Miroka compte sur toi." },
];

const QUEST_REMINDER: DialogLine[] = [
  {
    speaker: "Mirokaï",
    text: "Tu es revenu ! Miroka est toujours introuvable…",
  },
  { speaker: "Mirokaï", text: "Acceptes-tu enfin de m'aider à le retrouver ?" },
];

const QUEST_IN_PROGRESS: DialogLine[] = [
  { speaker: "Mirokaï", text: "Continue d'explorer les modules !" },
  { speaker: "Mirokaï", text: "Miroka est forcément quelque part par ici…" },
];

const ALL_MODULES_DIALOG: DialogLine[] = [
  { speaker: "Mirokaï", text: "..." },
  { speaker: "Mirokaï", text: "Tiens… tu entends ce bruit ?" },
  {
    speaker: "Mirokaï",
    text: "On dirait que ça vient de quelque part sur la carte…",
  },
];

const MIROKA_FOUND_DIALOG: DialogLine[] = [
  { speaker: "Miroka", text: "...!" },
  {
    speaker: "Miroka",
    text: "Tu m'as trouvé ! Je me cachais pour observer les visiteurs…",
  },
  {
    speaker: "Miroka",
    text: "Bravo ! Tu as exploré toute l'expérience Enchanted Tools.",
  },
  {
    speaker: "Miroka",
    text: "Tu es maintenant un véritable expert des Mirokaï !",
  },
];

// ──────────────────────────────────────────────────────────────────────────────

async function fetchModules(): Promise<ModuleData[] | null> {
  try {
    const res = await fetch(`${API_URL}/modules`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: {
      number: number;
      name: string;
      mapX?: number;
      mapY?: number;
    }[] = await res.json();

    // Seuls les modules avec des coordonnées valides sont affichés dans le jeu
    const merged: ModuleData[] = data
      .filter((m) => m.mapX != null && m.mapY != null)
      .map((m) => ({
        id: m.number,
        name: m.name,
        x: Math.round(m.mapX! * 48),
        y: Math.round(m.mapY! * 44),
      }));

    return merged.length > 0 ? merged : null;
  } catch {
    return null;
  }
}

export function GameScreen() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<MainScene | null>(null);
  const questRef = useRef<QuestState>("pending");
  const visitedModulesRef = useRef<Set<number>>(new Set());
  const mirokaSoundTriggeredRef = useRef(false);
  const totalModulesRef = useRef(0);
  const pendingDarkModeRef = useRef<(typeof DIFFICULTIES)[number] | null>(null);

  const [nearModule, setNearModule] = useState<ModuleInfo | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleInfo | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [modules, setModules] = useState<ModuleData[] | null | undefined>(
    undefined,
  );
  const [nearNpc, setNearNpc] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [questState, setQuestState] = useState<QuestState>("pending");
  const [selectedChoice, setSelectedChoice] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [menuTab, setMenuTab] = useState<"main" | "code">("main");
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [zombiesLeft, setZombiesLeft] = useState<number | null>(null);
  const [playerHP, setPlayerHP] = useState(5);
  const [gameOver, setGameOver] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const playerHPRef = useRef(5);
  const [showDifficulty, setShowDifficulty] = useState(false);
  const lastDifficultyRef = useRef<(typeof DIFFICULTIES)[number] | null>(null);
  const [bossHP, setBossHP] = useState<{ hp: number; max: number } | null>(null);
  const [bossIncoming, setBossIncoming] = useState(false);
  const [victory, setVictory] = useState(false);

  const DIFFICULTIES = [
    {
      key: "normal",
      label: "Normal",
      desc: "4 zombies · Lents · Boss 3❤️ · 5 ❤️",
      color: "#22c55e",
      config: { zombieCount: 4, zombieDelay: 1200, chaseRate: 0.7, hp: 5, bossHp: 3 },
    },
    {
      key: "difficile",
      label: "Difficile",
      desc: "8 zombies · Rapides · Boss 6❤️ · 3 ❤️",
      color: "#f59e0b",
      config: { zombieCount: 8, zombieDelay: 800, chaseRate: 0.85, hp: 3, bossHp: 6 },
    },
    {
      key: "impossible",
      label: "Impossible",
      desc: "14 zombies · Très rapides · Boss 10❤️ · 1 ❤️",
      color: "#ef4444",
      config: { zombieCount: 14, zombieDelay: 500, chaseRate: 0.95, hp: 1, bossHp: 10 },
    },
  ] as const;

  const MAX_HP = playerHPRef.current;

  const SECRET_CODE = (
    import.meta.env.VITE_APP_CODE ?? "DARKMODE"
  ).toUpperCase();

  // Étape 1 : fetch modules
  useEffect(() => {
    fetchModules().then((data) => setModules(data));
  }, []);

  // Étape 2 : créer le jeu
  useEffect(() => {
    if (modules === undefined) return;
    if (!containerRef.current || !wrapperRef.current) return;

    const scene = new MainScene(modules ?? undefined);
    totalModulesRef.current =
      scene["modules"]?.length ?? FALLBACK_MODULES.length;

    scene.onNearModule = (mod) => setNearModule(mod);
    scene.onInteract = (mod) => setActiveModule(mod);
    scene.onNearNpc = (npc) => setNearNpc(!!npc);
    scene.onInteractNpc = (npc: NpcData) => {
      if (npc.id === "miroka") {
        openDialog(MIROKA_FOUND_DIALOG);
      } else {
        handleNpcInteract();
      }
    };
    scene.onStartIntro = () => openIntroDialog();
    scene.onModuleInteracted = (id: number) => {
      visitedModulesRef.current.add(id);
    };
    scene.onZombieKilled = (remaining) => setZombiesLeft(remaining);
    scene.onAllZombiesKilled = () => setZombiesLeft(0);
    scene.onBossAppear = (maxHp: number) => {
      setZombiesLeft(null);
      setBossIncoming(true);
      setTimeout(() => setBossIncoming(false), 3000);
      setBossHP({ hp: maxHp, max: maxHp });
    };
    scene.onBossHit = (hp, max) => setBossHP({ hp, max });
    scene.onBossKilled = () => {
      setBossHP(null);
      setGameOver(false);
      // Écran victoire géré via bossKilled state
      setBossIncoming(false);
      setVictory(true);
    };

    // Relance auto du dark mode après un restart
    if (pendingDarkModeRef.current) {
      const diff = pendingDarkModeRef.current;
      pendingDarkModeRef.current = null;
      setTimeout(() => launchDarkMode(diff), 800);
    }
    scene.onPlayerHit = () => {
      const newHP = Math.max(0, playerHPRef.current - 1);
      playerHPRef.current = newHP;
      setPlayerHP(newHP);
      setHitFlash(true);
      setTimeout(() => setHitFlash(false), 400);
      if (newHP <= 0) setGameOver(true);
    };
    sceneRef.current = scene;

    const GAME_H = wrapperRef.current.clientHeight - CONTROLS_H;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: GAME_H,
      backgroundColor: "#0a0a0a",
      parent: containerRef.current,
      scene,
      render: { pixelArt: true, antialias: false },
    });
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules]);

  // ── Dialog helpers ──────────────────────────────────────────────────────────

  function openDialog(lines: DialogLine[], choices?: DialogState["choices"]) {
    setDialog({ lines, index: 0, choices, showChoices: false });
  }

  function openIntroDialog() {
    openDialog(INTRO_DIALOG, [
      {
        label: "Oui, j'accepte !",
        onSelect: () => {
          setQuestState("accepted");
          questRef.current = "accepted";
          openDialog(QUEST_ACCEPTED_FOLLOWUP);
        },
      },
      {
        label: "Non, pas maintenant.",
        onSelect: () => {
          setQuestState("declined");
          questRef.current = "declined";
          openDialog(QUEST_DECLINED_FOLLOWUP);
        },
      },
    ]);
  }

  function handleNpcInteract() {
    const q = questRef.current;
    if (q === "pending") {
      openIntroDialog();
    } else if (q === "declined") {
      openDialog(QUEST_REMINDER, [
        {
          label: "Oui, j'accepte !",
          onSelect: () => {
            setQuestState("accepted");
            questRef.current = "accepted";
            openDialog(QUEST_ACCEPTED_FOLLOWUP);
          },
        },
        {
          label: "Toujours pas…",
          onSelect: () => openDialog(QUEST_DECLINED_FOLLOWUP),
        },
      ]);
    } else {
      openDialog(QUEST_IN_PROGRESS);
    }
  }

  function submitCode() {
    if (codeInput.toUpperCase() === SECRET_CODE) {
      setShowMenu(false);
      setMenuTab("main");
      setCodeInput("");
      setCodeError(false);
      setShowDifficulty(true);
    } else {
      setCodeError(true);
      setCodeInput("");
    }
  }

  function launchDarkMode(diff: (typeof DIFFICULTIES)[number]) {
    lastDifficultyRef.current = diff;
    setShowDifficulty(false);
    setDarkMode(true);
    playerHPRef.current = diff.config.hp;
    setPlayerHP(diff.config.hp);
    setZombiesLeft(diff.config.zombieCount);
    sceneRef.current?.enableDarkMode({
      zombieCount: diff.config.zombieCount,
      zombieDelay: diff.config.zombieDelay,
      chaseRate: diff.config.chaseRate,
      bossHp: diff.config.bossHp,
    });
  }

  function closeModule() {
    setActiveModule(null);
    if (
      visitedModulesRef.current.size >= totalModulesRef.current &&
      totalModulesRef.current > 0 &&
      !mirokaSoundTriggeredRef.current
    ) {
      mirokaSoundTriggeredRef.current = true;
      openDialog(ALL_MODULES_DIALOG);
      setTimeout(() => sceneRef.current?.revealMiroka(), 200);
    }
  }

  function advanceDialog() {
    if (!dialog) return;
    const isLastLine = dialog.index >= dialog.lines.length - 1;
    if (isLastLine && dialog.choices?.length) {
      setDialog({ ...dialog, showChoices: true });
      setSelectedChoice(0);
      return;
    }
    if (!isLastLine) {
      setDialog({ ...dialog, index: dialog.index + 1 });
    } else {
      setDialog(null);
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  function pressDir(dx: number, dy: number) {
    // Si le dialog est ouvert, bloquer le mouvement
    if (dialog) {
      if (dialog.showChoices && dialog.choices) {
        // Naviguer les choix avec haut/bas
        if (dy === -1)
          setSelectedChoice(
            (i) => (i - 1 + dialog.choices!.length) % dialog.choices!.length,
          );
        if (dy === 1)
          setSelectedChoice((i) => (i + 1) % dialog.choices!.length);
      }
      return;
    }
    sceneRef.current?.setHeldDir(dx, dy);
  }
  function release() {
    if (dialog) return;
    sceneRef.current?.clearHeldDir();
  }

  function handleRestart() {
    // Si dark mode actif, on repart avec la même difficulté
    if (lastDifficultyRef.current) {
      pendingDarkModeRef.current = lastDifficultyRef.current;
    }
    setShowMenu(false);
    setActiveModule(null);
    setNearModule(null);
    setNearNpc(false);
    setDialog(null);
    setQuestState("pending");
    questRef.current = "pending";
    visitedModulesRef.current = new Set();
    mirokaSoundTriggeredRef.current = false;
    setDarkMode(false);
    setZombiesLeft(null);
    setMenuTab("main");
    setPlayerHP(5);
    setGameOver(false);
    setHitFlash(false);
    setShowDifficulty(false);
    setBossHP(null);
    setBossIncoming(false);
    setVictory(false);
    playerHPRef.current = 5;
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
    setModules(undefined);
    fetchModules().then((data) => setModules(data));
  }

  function handleQuit() {
    setShowMenu(false);
    navigate("/");
  }

  const btnClass =
    "flex items-center justify-center bg-zinc-700 active:bg-zinc-500 active:scale-95 rounded-sm text-white font-bold transition-transform select-none";

  const currentLine = dialog ? dialog.lines[dialog.index] : null;
  const speaker = currentLine?.speaker ?? "Mirokaï";

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col select-none overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {/* Chargement */}
      {modules === undefined && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
          <p className="text-purple-400 text-sm animate-pulse">
            Chargement de l'expérience…
          </p>
        </div>
      )}

      {/* Flash dégâts */}
      {hitFlash && (
        <div className="absolute inset-0 z-40 pointer-events-none bg-red-600/30 animate-pulse" />
      )}

      {/* Game Over */}
      {gameOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
          <p
            className="text-red-500 text-3xl font-bold tracking-widest mb-2"
            style={{ fontFamily: "monospace" }}
          >
            VOUS AVEZ PERDU
          </p>
          <p className="text-zinc-500 text-xs tracking-widest mb-8">
            Les zombies ont eu raison de vous…
          </p>
          <button
            onPointerDown={handleRestart}
            className="px-6 py-3 bg-red-800 border border-red-500 text-white text-sm font-bold tracking-widest uppercase rounded-sm active:bg-red-600"
          >
            ↺ Recommencer
          </button>
          <button
            onPointerDown={handleQuit}
            className="mt-3 text-zinc-600 text-xs tracking-widest active:text-zinc-400"
          >
            Quitter
          </button>
        </div>
      )}

      {/* Victoire */}
      {victory && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
          <p className="text-yellow-400 text-3xl font-bold tracking-widest mb-1" style={{ fontFamily: "monospace" }}>
            VICTOIRE !
          </p>
          <p className="text-orange-400 text-sm mb-1">☠ Le mega-zombie est vaincu !</p>
          <p className="text-zinc-500 text-xs tracking-widest mb-8">Tu es un véritable guerrier Mirokaï.</p>
          <button
            onPointerDown={handleRestart}
            className="px-6 py-3 bg-yellow-600 border border-yellow-400 text-white text-sm font-bold tracking-widest uppercase rounded-sm active:bg-yellow-500"
          >
            ↺ Rejouer
          </button>
          <button onPointerDown={handleQuit} className="mt-3 text-zinc-600 text-xs tracking-widest active:text-zinc-400">
            Quitter
          </button>
        </div>
      )}

      {/* Sélection difficulté */}
      {showDifficulty && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85">
          <div className="bg-zinc-900 border-2 border-red-700 rounded-sm shadow-2xl w-72 overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-700 text-center">
              <p className="text-red-400 text-xs tracking-widest uppercase font-bold">
                ☠ Choisis ta difficulté
              </p>
            </div>
            <div className="flex flex-col divide-y divide-zinc-800">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff.key}
                  onPointerDown={() => launchDarkMode(diff)}
                  className="px-5 py-4 text-left flex items-center gap-3 active:bg-zinc-800 transition-colors"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: diff.color }}
                  />
                  <div>
                    <p
                      className="text-white text-sm font-bold tracking-wide"
                      style={{ color: diff.color }}
                    >
                      {diff.label}
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5">{diff.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-5 py-2 border-t border-zinc-700">
              <button
                onPointerDown={() => setShowDifficulty(false)}
                className="w-full text-center text-zinc-600 text-xs tracking-widest py-1 active:text-zinc-400"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu START */}
      {showMenu && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 border-2 border-purple-500 rounded-sm shadow-2xl w-64 overflow-hidden">
            {/* Header avec onglets */}
            <div className="flex border-b border-zinc-700">
              <button
                onPointerDown={() => setMenuTab("main")}
                className={`flex-1 py-2.5 text-xs tracking-widest uppercase transition-colors ${menuTab === "main" ? "text-purple-400 border-b-2 border-purple-400" : "text-zinc-500 active:text-zinc-300"}`}
              >
                Menu
              </button>
              <button
                onPointerDown={() => {
                  setMenuTab("code");
                  setCodeError(false);
                  setCodeInput("");
                }}
                className={`flex-1 py-2.5 text-xs tracking-widest uppercase transition-colors ${menuTab === "code" ? "text-yellow-400 border-b-2 border-yellow-400" : "text-zinc-500 active:text-zinc-300"}`}
              >
                ✦ Code
              </button>
            </div>

            {menuTab === "main" ? (
              <>
                <div className="flex flex-col">
                  <button
                    onPointerDown={handleRestart}
                    className="px-5 py-4 text-white text-sm font-bold tracking-widest uppercase text-left border-b border-zinc-700 active:bg-zinc-700 transition-colors"
                  >
                    ↺ &nbsp;Recommencer
                  </button>
                  <button
                    onPointerDown={handleQuit}
                    className="px-5 py-4 text-red-400 text-sm font-bold tracking-widest uppercase text-left active:bg-zinc-700 transition-colors"
                  >
                    ✕ &nbsp;Quitter
                  </button>
                </div>
                <div className="px-5 py-2 border-t border-zinc-700">
                  <button
                    onPointerDown={() => setShowMenu(false)}
                    className="w-full text-center text-gray-500 text-xs tracking-widest py-1 active:text-gray-300"
                  >
                    Reprendre
                  </button>
                </div>
              </>
            ) : (
              <div className="px-5 py-4 flex flex-col gap-3">
                <p className="text-yellow-400 text-xs text-center tracking-wide">
                  {darkMode
                    ? "✦ Mode sombre déjà actif !"
                    : "Entre le code secret"}
                </p>
                {!darkMode && (
                  <>
                    <input
                      type="text"
                      value={codeInput}
                      onChange={(e) => {
                        setCodeInput(e.target.value.toUpperCase());
                        setCodeError(false);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && submitCode()}
                      placeholder="CODE…"
                      maxLength={12}
                      autoFocus
                      className="bg-zinc-800 border border-zinc-600 rounded-sm px-3 py-2 text-white text-sm text-center tracking-widest uppercase focus:outline-none focus:border-yellow-400"
                    />
                    {codeError && (
                      <p className="text-red-400 text-xs text-center">
                        Code incorrect…
                      </p>
                    )}
                    <button
                      onPointerDown={submitCode}
                      className="w-full py-2 bg-yellow-400 text-zinc-900 text-xs font-bold tracking-widest uppercase rounded-sm active:bg-yellow-300"
                    >
                      Valider
                    </button>
                  </>
                )}
                <button
                  onPointerDown={() => setMenuTab("main")}
                  className="text-zinc-500 text-xs text-center active:text-zinc-300"
                >
                  ← Retour
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Écran jeu */}
      <div
        className="relative bg-[#0f0f1a] shrink-0"
        style={
          darkMode ? { boxShadow: "inset 0 0 40px rgba(180,0,0,0.35)" } : {}
        }
      >
        <div ref={containerRef} />
        {/* Badge dark mode + vie */}
        {darkMode && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="bg-red-900/80 border border-red-600 px-2 py-0.5 text-red-300 text-xs tracking-widest rounded-sm">
                ☠ DARK MODE
              </span>
              {zombiesLeft !== null && zombiesLeft > 0 && (
                <span className="bg-zinc-900/80 border border-red-700 px-2 py-0.5 text-red-400 text-xs rounded-sm">
                  🧟 ×{zombiesLeft}
                </span>
              )}
              {zombiesLeft === 0 && (
                <span className="bg-zinc-900/80 border border-yellow-500 px-2 py-0.5 text-yellow-400 text-xs rounded-sm animate-pulse">
                  ✓ Éliminés !
                </span>
              )}
            </div>
            {/* Barre de vie */}
            <div className="flex items-center gap-0.5 bg-zinc-900/80 px-2 py-1 rounded-sm border border-zinc-700">
              {Array.from({ length: MAX_HP }).map((_, i) => (
                <span
                  key={i}
                  className="text-sm leading-none"
                  style={{
                    filter: i < playerHP ? "none" : "grayscale(1) opacity(0.3)",
                  }}
                >
                  ❤️
                </span>
              ))}
            </div>
          </div>
        )}
        {darkMode && (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <span className="text-red-400 text-xs bg-zinc-900/70 px-2 py-0.5 rounded-sm border border-red-800">
              A = 🔥
            </span>
            {/* Barre de vie du boss */}
            {bossHP && (
              <div className="bg-zinc-900/90 border border-red-700 rounded-sm px-2 py-1.5 min-w-[120px]">
                <p className="text-red-400 text-[10px] tracking-widest uppercase mb-1 text-center">☠ Mega Zombie</p>
                <div className="w-full h-2.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(bossHP.hp / bossHP.max) * 100}%`,
                      background: bossHP.hp / bossHP.max > 0.5 ? "#ef4444" : bossHP.hp / bossHP.max > 0.25 ? "#f59e0b" : "#ff0000",
                    }}
                  />
                </div>
                <p className="text-red-300 text-[10px] text-center mt-0.5">{bossHP.hp} / {bossHP.max}</p>
              </div>
            )}
          </div>
        )}

        {/* Alerte boss */}
        {bossIncoming && (
          <div className="absolute inset-x-4 top-1/3 z-40 pointer-events-none flex items-center justify-center">
            <div className="bg-black/90 border-2 border-red-600 px-6 py-3 rounded-sm text-center animate-pulse">
              <p className="text-red-500 text-lg font-bold tracking-widest">☠ MEGA ZOMBIE !</p>
              <p className="text-red-400 text-xs mt-1">Il faut plusieurs coups pour l'abattre…</p>
            </div>
          </div>
        )}

        {(nearModule || nearNpc) && !activeModule && !dialog && !darkMode && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 border border-purple-500 px-3 py-1 text-xs text-purple-300 whitespace-nowrap rounded-sm animate-pulse">
            {nearNpc
              ? "Mirokaï · Appuyer A"
              : `Module ${nearModule!.id} · Appuyer A`}
          </div>
        )}
        {darkMode && nearNpc && !dialog && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 border border-yellow-500 px-3 py-1 text-xs text-yellow-300 whitespace-nowrap rounded-sm animate-pulse">
            Mirokaï · Appuyer A
          </div>
        )}
      </div>

      {/* Popup module */}
      {activeModule && (
        <div className="absolute inset-x-6 top-[20%] z-50 bg-zinc-900 border-2 border-purple-500 p-4 rounded-sm shadow-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-purple-400 text-xs tracking-widest uppercase">
              Module {activeModule.id}
            </span>
            <button onClick={closeModule} className="text-gray-500 text-xs">
              ✕
            </button>
          </div>
          <p className="text-white font-bold text-sm">{activeModule.name}</p>
          <p className="text-gray-400 text-xs mt-2">
            Approchez-vous de ce module lors de votre visite pour en savoir
            plus.
          </p>
        </div>
      )}

      {/* Dialog PNJ */}
      {dialog && (
        <div className="absolute inset-x-4 bottom-[252px] z-50">
          <div className="bg-zinc-900 border-2 border-yellow-400 rounded-sm shadow-2xl overflow-hidden">
            {/* Header speaker */}
            <div className="px-4 pt-3 pb-1 flex items-center gap-2 border-b border-yellow-400/20">
              <span className="text-yellow-400 text-xs tracking-widest uppercase font-bold">
                {speaker}
              </span>
              {!dialog.showChoices && (
                <span className="text-zinc-600 text-xs ml-auto">
                  {dialog.index + 1} / {dialog.lines.length}
                </span>
              )}
            </div>

            {/* Texte ou choix */}
            {!dialog.showChoices ? (
              <>
                <p className="px-4 py-3 text-white text-sm leading-relaxed min-h-[56px]">
                  {currentLine?.text}
                </p>
                <button
                  onPointerDown={advanceDialog}
                  className="w-full py-2 bg-yellow-400/10 border-t border-yellow-400/30 text-yellow-400 text-xs tracking-widest text-center active:bg-yellow-400/20"
                >
                  {dialog.index < dialog.lines.length - 1
                    ? "Suivant ▶"
                    : dialog.choices?.length
                      ? "Choisir…"
                      : "Fermer ✕"}
                </button>
              </>
            ) : (
              <div className="flex flex-col divide-y divide-zinc-800">
                {dialog.choices!.map((choice, i) => {
                  const isSelected = i === selectedChoice;
                  return (
                    <button
                      key={i}
                      onPointerDown={() => {
                        setDialog(null);
                        choice.onSelect();
                      }}
                      onPointerEnter={() => setSelectedChoice(i)}
                      className="px-4 py-3 text-left text-sm flex items-center gap-2 transition-colors"
                      style={{
                        background: isSelected
                          ? "rgba(255,202,68,0.12)"
                          : "transparent",
                        color: isSelected ? "#FFCA44" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      <span
                        className="text-base transition-transform"
                        style={{
                          opacity: isSelected ? 1 : 0,
                          transform: isSelected
                            ? "translateX(0)"
                            : "translateX(-4px)",
                        }}
                      >
                        ▶
                      </span>
                      {choice.label}
                    </button>
                  );
                })}
                <p className="px-4 py-1.5 text-zinc-600 text-xs text-center">
                  ▲▼ naviguer · A confirmer
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coque Gameboy */}
      <div
        className="flex flex-col justify-between px-4 py-3 bg-zinc-900 border-t-2 border-zinc-700"
        style={{ height: CONTROLS_H }}
      >
        <div className="flex items-center justify-between">
          {/* Croix directionnelle */}
          <div className="grid grid-cols-3 grid-rows-3 gap-0.5 w-32 h-32">
            <div />
            <button
              className={`${btnClass} text-xl`}
              onPointerDown={() => pressDir(0, -1)}
              onPointerUp={release}
              onPointerLeave={release}
            >
              ▲
            </button>
            <div />
            <button
              className={`${btnClass} text-xl`}
              onPointerDown={() => pressDir(-1, 0)}
              onPointerUp={release}
              onPointerLeave={release}
            >
              ◀
            </button>
            <div className="bg-zinc-600 rounded-sm" />
            <button
              className={`${btnClass} text-xl`}
              onPointerDown={() => pressDir(1, 0)}
              onPointerUp={release}
              onPointerLeave={release}
            >
              ▶
            </button>
            <div />
            <button
              className={`${btnClass} text-xl`}
              onPointerDown={() => pressDir(0, 1)}
              onPointerUp={release}
              onPointerLeave={release}
            >
              ▼
            </button>
            <div />
          </div>

          {/* Boutons A / B */}
          <div className="flex gap-2 items-end mb-2">
            <button
              onPointerDown={closeModule}
              className="w-10 h-10 rounded-full bg-zinc-600 active:bg-zinc-400 active:scale-95 border-b-4 border-zinc-800 text-white text-xs font-bold shadow-lg transition-transform"
            >
              B
            </button>
            <button
              onPointerDown={() => {
                if (dialog?.showChoices) {
                  const choice = dialog.choices![selectedChoice];
                  setDialog(null);
                  choice.onSelect();
                } else if (dialog) {
                  advanceDialog();
                } else if (darkMode) {
                  sceneRef.current?.shoot();
                } else {
                  sceneRef.current?.interact();
                }
              }}
              className="w-12 h-12 rounded-full bg-red-600 active:bg-red-400 active:scale-95 border-b-4 border-red-900 text-white text-sm font-bold shadow-lg transition-transform"
            >
              A
            </button>
          </div>
        </div>

        {/* SELECT / START */}
        <div className="flex justify-center gap-4">
          <button className="px-4 py-0.5 bg-zinc-700 active:bg-zinc-500 rounded-full text-xs text-gray-400">
            SELECT
          </button>
          <button
            onPointerDown={() => setShowMenu((v) => !v)}
            className="px-4 py-0.5 bg-zinc-700 active:bg-zinc-500 rounded-full text-xs text-gray-400"
          >
            START
          </button>
        </div>
      </div>
    </div>
  );
}
