import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Crosshair,
  Gamepad2,
  Keyboard,
  MousePointerClick,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_GG_MOUSE_PRO,
  DEFAULT_HUD_LAYOUT,
  formatKeyCodeLabel,
  GameSettings,
  GG_PIN_META,
  GgKeyPinId,
  GgMouseProConfig,
  HudLayoutConfig,
  KeyBindAction,
  KeyBindingsConfig,
  MACRO_ACTION_META,
  MACRO_EMOJI_PALETTE,
  MacroConfig,
  MacroStep,
  MacroStepAction,
} from '../game/types';
import {
  normalizeGgMousePro,
  normalizeKeyBindings,
  normalizeMacros,
} from '../game/storage';

interface GgMouseMacroModalProps {
  settings: GameSettings;
  onSave: (next: GameSettings) => void;
  onRebindingChange?: (active: boolean) => void;
  onClose: () => void;
}

type ModalTab = 'gg' | 'macros';
type WasdAction = 'moveForward' | 'moveBackward' | 'moveLeft' | 'moveRight';

type SelectedItem =
  | { kind: 'pin'; pinId: GgKeyPinId }
  | { kind: 'macro'; macroId: string }
  | null;

type ListeningTarget =
  | { kind: 'pin'; pinId: GgKeyPinId; wasdDir?: WasdAction }
  | { kind: 'macro'; macroId: string }
  | null;

const PIN_ORDER: GgKeyPinId[] = [
  'moveCluster',
  'lookPad',
  'fireBtn',
  'aimBtn',
  'jumpBtn',
  'crouchBtn',
  'proneBtn',
  'reloadBtn',
  'glooBtn',
  'quickGlooBtn',
  'grenadeBtn',
  'medkitBtn',
  'smallMedkitBtn',
  'backpackBtn',
  'interactBtn',
  'quickSwapBtn',
  'sprintBtn',
  'toggleMouseBtn',
  'resetMouseBtn',
  'slot1Btn',
  'slot2Btn',
  'slot3Btn',
  'slot4Btn',
];

const QUICK_STEP_ACTIONS: MacroStepAction[] = [
  'crouch',
  'aimToggle',
  'quickGlooInstant',
  'fireTap',
  'jump',
  'prone',
  'quickSwap',
  'reload',
  'medkit',
  'wait',
];

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function buildPinsFromHudLayout(
  hudLayout: HudLayoutConfig,
  prevPins: Record<GgKeyPinId, GgMouseProConfig['pins'][GgKeyPinId]>,
): GgMouseProConfig['pins'] {
  const layout = { ...DEFAULT_HUD_LAYOUT, ...hudLayout };
  const mapPin = (
    pinId: GgKeyPinId,
    hudKey: keyof HudLayoutConfig | null,
    fallback = DEFAULT_GG_MOUSE_PRO.pins[pinId],
  ) => {
    const prev = prevPins[pinId] ?? fallback;
    if (!hudKey || !layout[hudKey]) {
      return { ...fallback, visible: prev.visible, scale: prev.scale };
    }
    return {
      xPct: layout[hudKey].xPct,
      yPct: layout[hudKey].yPct,
      scale: prev.scale,
      visible: prev.visible,
    };
  };

  return {
    moveCluster: mapPin('moveCluster', 'joystick'),
    lookPad: { ...DEFAULT_GG_MOUSE_PRO.pins.lookPad, visible: prevPins.lookPad?.visible ?? true, scale: prevPins.lookPad?.scale ?? 1 },
    fireBtn: mapPin('fireBtn', 'fireBtn'),
    aimBtn: mapPin('aimBtn', 'aimBtn'),
    jumpBtn: mapPin('jumpBtn', 'jumpBtn'),
    crouchBtn: mapPin('crouchBtn', 'crouchBtn'),
    proneBtn: mapPin('proneBtn', 'proneBtn'),
    reloadBtn: mapPin('reloadBtn', 'reloadBtn'),
    glooBtn: mapPin('glooBtn', 'glooBtn'),
    quickGlooBtn: mapPin('quickGlooBtn', 'quickGlooBtn'),
    grenadeBtn: mapPin('grenadeBtn', 'grenadeBtn'),
    medkitBtn: mapPin('medkitBtn', 'medkitBtn'),
    smallMedkitBtn: mapPin('smallMedkitBtn', 'smallMedkitBtn'),
    backpackBtn: mapPin('backpackBtn', 'backpackBtn'),
    interactBtn: mapPin('interactBtn', 'lootList'),
    quickSwapBtn: mapPin('quickSwapBtn', 'weapons'),
    sprintBtn: mapPin('sprintBtn', 'sprintBtn'),
    toggleMouseBtn: { ...DEFAULT_GG_MOUSE_PRO.pins.toggleMouseBtn, visible: prevPins.toggleMouseBtn?.visible ?? true },
    resetMouseBtn: { ...DEFAULT_GG_MOUSE_PRO.pins.resetMouseBtn, visible: prevPins.resetMouseBtn?.visible ?? false },
    slot1Btn: {
      xPct: Math.max(4, Math.min(96, layout.weapons.xPct - 5)),
      yPct: layout.weapons.yPct,
      scale: prevPins.slot1Btn?.scale ?? 0.9,
      visible: prevPins.slot1Btn?.visible ?? true,
    },
    slot2Btn: {
      xPct: layout.weapons.xPct,
      yPct: layout.weapons.yPct,
      scale: prevPins.slot2Btn?.scale ?? 0.9,
      visible: prevPins.slot2Btn?.visible ?? true,
    },
    slot3Btn: {
      xPct: Math.max(4, Math.min(96, layout.weapons.xPct + 5)),
      yPct: layout.weapons.yPct,
      scale: prevPins.slot3Btn?.scale ?? 0.9,
      visible: prevPins.slot3Btn?.visible ?? true,
    },
    slot4Btn: {
      xPct: Math.max(4, Math.min(96, layout.weapons.xPct + 8)),
      yPct: Math.max(4, layout.weapons.yPct - 6),
      scale: prevPins.slot4Btn?.scale ?? 0.9,
      visible: prevPins.slot4Btn?.visible ?? false,
    },
  };
}

export const GgMouseMacroModal: React.FC<GgMouseMacroModalProps> = ({
  settings,
  onSave,
  onRebindingChange,
  onClose,
}) => {
  const [tab, setTab] = useState<ModalTab>('gg');
  const [draftGg, setDraftGg] = useState<GgMouseProConfig>(() =>
    normalizeGgMousePro(settings.ggMousePro),
  );
  const [draftKeys, setDraftKeys] = useState<KeyBindingsConfig>(() =>
    normalizeKeyBindings(settings.keyBindings),
  );
  const [draftMacros, setDraftMacros] = useState<MacroConfig[]>(() =>
    normalizeMacros(settings.macros),
  );
  const [draftEmulator, setDraftEmulator] = useState<boolean>(
    Boolean(settings.emulatorMode),
  );

  const [selected, setSelected] = useState<SelectedItem>({ kind: 'pin', pinId: 'lookPad' });
  const [selectedMacroId, setSelectedMacroId] = useState<string>(() => {
    const init = normalizeMacros(settings.macros);
    return init[0]?.id ?? '';
  });
  const [listeningFor, setListeningFor] = useState<ListeningTarget>(null);
  const [previewStepIdx, setPreviewStepIdx] = useState<number | null>(null);
  const [newStepAction, setNewStepAction] = useState<MacroStepAction>('crouch');

  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<SelectedItem>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const previewTimersRef = useRef<number[]>([]);

  const hudLayout = useMemo(
    () => ({ ...DEFAULT_HUD_LAYOUT, ...settings.hudLayout }),
    [settings.hudLayout],
  );

  const selectedMacro = useMemo(
    () => draftMacros.find((m) => m.id === selectedMacroId) ?? draftMacros[0] ?? null,
    [draftMacros, selectedMacroId],
  );

  useEffect(() => {
    onRebindingChange?.(listeningFor !== null);
    return () => {
      onRebindingChange?.(false);
    };
  }, [listeningFor, onRebindingChange]);

  useEffect(() => {
    return () => {
      previewTimersRef.current.forEach((t) => window.clearTimeout(t));
      previewTimersRef.current = [];
    };
  }, []);

  // Capture any keyboard key, mouse button or scroll wheel when listeningFor is active
  useEffect(() => {
    if (!listeningFor) return;

    const commitCode = (code: string) => {
      if (!code || code === 'Escape') {
        setListeningFor(null);
        return;
      }
      if (listeningFor.kind === 'macro') {
        setDraftMacros((prev) =>
          prev.map((m) =>
            m.id === listeningFor.macroId ? { ...m, triggerKey: code } : m,
          ),
        );
        setListeningFor(null);
        return;
      }

      const targetAction: KeyBindAction | undefined = listeningFor.wasdDir
        ? listeningFor.wasdDir
        : GG_PIN_META[listeningFor.pinId]?.action;

      if (targetAction) {
        setDraftKeys((prev) => {
          const next = { ...prev };
          const prevCode = next[targetAction];
          if (prevCode) {
            (Object.keys(next) as KeyBindAction[]).forEach((act) => {
              if (act !== targetAction && next[act] === code) {
                next[act] = prevCode;
              }
            });
          } else {
            // For optional bindings like quickGlooInstant, clear conflicting binding only if non-empty
            (Object.keys(next) as KeyBindAction[]).forEach((act) => {
              if (act !== targetAction && next[act] === code && act === 'quickGlooInstant') {
                next[act] = '';
              }
            });
          }
          next[targetAction] = code;
          return next;
        });
      }
      setListeningFor(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      commitCode(e.code);
    };
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const map: Record<number, string> = {
        0: 'MouseLeft',
        1: 'MouseMiddle',
        2: 'MouseRight',
        3: 'MouseBack',
        4: 'MouseForward',
      };
      if (map[e.button]) {
        commitCode(map[e.button]);
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      e.stopPropagation();
      commitCode(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const timer = window.setTimeout(() => {
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('mousedown', onMouseDown, true);
      window.addEventListener('wheel', onWheel, { capture: true, passive: false });
      window.addEventListener('contextmenu', onContextMenu, true);
    }, 45);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, [listeningFor]);

  // Global drag handler for GG Pins and Floating Macro Pins inside Tab 1 stage
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const target = draggingRef.current;
      const stage = stageRef.current;
      if (!target || !stage) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const xPct = Math.max(
        2,
        Math.min(
          98,
          Math.round(
            (((e.clientX - rect.left) / rect.width) * 100 + dragOffsetRef.current.dx) * 10,
          ) / 10,
        ),
      );
      const yPct = Math.max(
        3,
        Math.min(
          97,
          Math.round(
            (((e.clientY - rect.top) / rect.height) * 100 + dragOffsetRef.current.dy) * 10,
          ) / 10,
        ),
      );
      if (target.kind === 'pin') {
        setDraftGg((prev) => ({
          ...prev,
          pins: {
            ...prev.pins,
            [target.pinId]: {
              ...prev.pins[target.pinId],
              xPct,
              yPct,
            },
          },
        }));
      } else {
        setDraftMacros((prev) =>
          prev.map((m) => (m.id === target.macroId ? { ...m, xPct, yPct } : m)),
        );
      }
    };

    const onPointerUp = () => {
      draggingRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  const beginDrag = (e: React.PointerEvent, item: SelectedItem, curX: number, curY: number) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    const stage = stageRef.current;
    if (stage) {
      const rect = stage.getBoundingClientRect();
      const ptrX = ((e.clientX - rect.left) / rect.width) * 100;
      const ptrY = ((e.clientY - rect.top) / rect.height) * 100;
      dragOffsetRef.current = { dx: curX - ptrX, dy: curY - ptrY };
    } else {
      dragOffsetRef.current = { dx: 0, dy: 0 };
    }
    setSelected(item);
    if (item?.kind === 'macro') {
      setSelectedMacroId(item.macroId);
    }
    draggingRef.current = item;
  };

  const updateSelectedMacro = (patch: Partial<MacroConfig>) => {
    if (!selectedMacro) return;
    setDraftMacros((prev) =>
      prev.map((m) => (m.id === selectedMacro.id ? { ...m, ...patch } : m)),
    );
  };

  const addMacroPreset = (preset: 'blank' | 'agachaMiraLevanta' | 'geloAgachado' | 'puloTiro') => {
    const id = makeId('macro');
    let next: MacroConfig;
    if (preset === 'agachaMiraLevanta') {
      next = {
        id,
        name: 'Agacha + Mira + Levanta',
        emoji: '🎯',
        triggerKey: '',
        showFloatingBtn: true,
        enabled: true,
        xPct: 64,
        yPct: 72,
        scale: 1.0,
        opacity: 0.92,
        steps: [
          { id: makeId('s'), action: 'crouch', delayMs: 28 },
          { id: makeId('s'), action: 'aimToggle', delayMs: 32 },
          { id: makeId('s'), action: 'crouch', delayMs: 0 },
        ],
      };
    } else if (preset === 'geloAgachado') {
      next = {
        id,
        name: 'Gelo Agachado Turbo',
        emoji: '🧊',
        triggerKey: '',
        showFloatingBtn: true,
        enabled: true,
        xPct: 64,
        yPct: 84,
        scale: 1.0,
        opacity: 0.92,
        steps: [
          { id: makeId('s'), action: 'crouch', delayMs: 25 },
          { id: makeId('s'), action: 'quickGlooInstant', delayMs: 35 },
          { id: makeId('s'), action: 'crouch', delayMs: 0 },
        ],
      };
    } else if (preset === 'puloTiro') {
      next = {
        id,
        name: 'Pulo + Tiro Rápido',
        emoji: '⚡',
        triggerKey: '',
        showFloatingBtn: true,
        enabled: true,
        xPct: 72,
        yPct: 58,
        scale: 1.0,
        opacity: 0.92,
        steps: [
          { id: makeId('s'), action: 'jump', delayMs: 25 },
          { id: makeId('s'), action: 'fireTap', delayMs: 0 },
        ],
      };
    } else {
      next = {
        id,
        name: `Macro ${draftMacros.length + 1}`,
        emoji: '🎮',
        triggerKey: '',
        showFloatingBtn: true,
        enabled: true,
        xPct: 62,
        yPct: 65,
        scale: 1.0,
        opacity: 0.92,
        steps: [{ id: makeId('s'), action: 'crouch', delayMs: 30 }],
      };
    }
    setDraftMacros((prev) => [...prev, next].slice(0, 24));
    setSelectedMacroId(id);
  };

  const duplicateSelectedMacro = () => {
    if (!selectedMacro) return;
    const id = makeId('macro');
    const copy: MacroConfig = {
      ...selectedMacro,
      id,
      name: `${selectedMacro.name} (Cópia)`.slice(0, 40),
      triggerKey: '',
      xPct: Math.min(92, selectedMacro.xPct + 6),
      steps: selectedMacro.steps.map((s) => ({ ...s, id: makeId('s') })),
    };
    setDraftMacros((prev) => [...prev, copy].slice(0, 24));
    setSelectedMacroId(id);
  };

  const deleteSelectedMacro = () => {
    if (!selectedMacro) return;
    setDraftMacros((prev) => {
      const next = prev.filter((m) => m.id !== selectedMacro.id);
      if (selected?.kind === 'macro' && selected.macroId === selectedMacro.id) {
        setSelected({ kind: 'pin', pinId: 'lookPad' });
      }
      setSelectedMacroId(next[0]?.id ?? '');
      return next;
    });
  };

  const runVisualStepPreview = () => {
    if (!selectedMacro || selectedMacro.steps.length === 0) return;
    previewTimersRef.current.forEach((t) => window.clearTimeout(t));
    previewTimersRef.current = [];

    let acc = 0;
    selectedMacro.steps.forEach((step, idx) => {
      const t = window.setTimeout(() => {
        setPreviewStepIdx(idx);
      }, acc);
      previewTimersRef.current.push(t);
      acc += Math.max(45, step.delayMs);
    });
    const endT = window.setTimeout(() => {
      setPreviewStepIdx(null);
    }, acc + 260);
    previewTimersRef.current.push(endT);
  };

  const handleSave = () => {
    setListeningFor(null);
    onRebindingChange?.(false);
    onSave({
      ...settings,
      emulatorMode: draftEmulator,
      keyBindings: normalizeKeyBindings(draftKeys),
      ggMousePro: normalizeGgMousePro(draftGg),
      macros: normalizeMacros(draftMacros),
    });
  };

  const handleCancel = () => {
    setListeningFor(null);
    onRebindingChange?.(false);
    onClose();
  };

  const hudSilhouettes: Array<{
    key: keyof HudLayoutConfig;
    label: string;
    circle?: boolean;
    size: string;
  }> = [
    { key: 'joystick', label: 'JOYSTICK', circle: true, size: 'w-24 h-24' },
    { key: 'sprintBtn', label: 'CORRER', circle: true, size: 'w-10 h-10' },
    { key: 'backpackBtn', label: 'MOCHILA', circle: false, size: 'w-9 h-9' },
    { key: 'medkitBtn', label: 'KIT', circle: false, size: 'w-9 h-9' },
    { key: 'smallMedkitBtn', label: 'KIT P', circle: false, size: 'w-9 h-9' },
    { key: 'grenadeBtn', label: 'GRAN', circle: false, size: 'w-9 h-9' },
    { key: 'glooBtn', label: 'GELO', circle: false, size: 'w-9 h-9' },
    { key: 'quickGlooBtn', label: 'GELO 1x', circle: true, size: 'w-9 h-9' },
    { key: 'fireBtn', label: 'ATIRAR', circle: true, size: 'w-24 h-24' },
    { key: 'aimBtn', label: 'MIRA', circle: true, size: 'w-11 h-11' },
    { key: 'jumpBtn', label: 'PULAR', circle: true, size: 'w-11 h-11' },
    { key: 'crouchBtn', label: 'AGACHAR', circle: true, size: 'w-11 h-11' },
    { key: 'proneBtn', label: 'DEITAR', circle: true, size: 'w-11 h-11' },
    { key: 'reloadBtn', label: 'RECAR.', circle: true, size: 'w-10 h-10' },
    { key: 'weapons', label: 'ARMAS', circle: false, size: 'w-36 h-12' },
    { key: 'lootList', label: 'LOOT', circle: false, size: 'w-28 h-12' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0b1018] text-white flex flex-col select-none">
      {/* TOP BAR */}
      <div className="shrink-0 bg-[#121822] border-b border-cyan-500/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300">
            <MousePointerClick className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-cyan-300 leading-none">
              GG MOUSE PRO · MAPEADOR & MACROS
            </div>
            <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
              Teclas sobre o HUD (PC/Emulador) + Botões Emoji Flutuantes (Android/Toque)
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-1 bg-[#0a0e14] border border-neutral-700 p-0.5">
          <button
            type="button"
            onClick={() => {
              setListeningFor(null);
              setTab('gg');
            }}
            className={`px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer ${
              tab === 'gg'
                ? 'bg-cyan-500 text-black'
                : 'text-neutral-300 hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Mapeador GG Mouse Pro</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setListeningFor(null);
              setTab('macros');
            }}
            className={`px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer ${
              tab === 'macros'
                ? 'bg-amber-500 text-black'
                : 'text-neutral-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Macros & Botões Emoji ({draftMacros.length})</span>
          </button>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 bg-[#1b222c] hover:bg-neutral-700 border border-neutral-600 text-[10px] sm:text-xs font-black uppercase cursor-pointer"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] sm:text-xs font-black uppercase flex items-center gap-1 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>SALVAR TUDO</span>
          </button>
        </div>
      </div>

      {/* LISTENING BANNER */}
      {listeningFor && (
        <div className="shrink-0 bg-amber-500 text-black px-4 py-1.5 text-xs font-black uppercase flex items-center justify-between">
          <span>
            PRESSIONE QUALQUER TECLA DO TECLADO, BOTÃO DO MOUSE OU RODA (SCROLL)... (ESC CANCELA)
          </span>
          <button
            type="button"
            onClick={() => setListeningFor(null)}
            className="px-2 py-0.5 bg-black text-white text-[10px] cursor-pointer"
          >
            CANCELAR
          </button>
        </div>
      )}

      {/* TAB 1: GG MOUSE PRO CANVAS KEYMAPPER */}
      {tab === 'gg' && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Quick Toggles Bar */}
          <div className="shrink-0 bg-[#10161f] border-b border-neutral-800 px-3 py-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase">
            <button
              type="button"
              onClick={() =>
                setDraftGg((p) => ({ ...p, enabled: !p.enabled }))
              }
              className={`px-2.5 py-1 border cursor-pointer ${
                draftGg.enabled
                  ? 'bg-cyan-500 text-black border-cyan-300'
                  : 'bg-[#1a222d] text-neutral-300 border-neutral-600'
              }`}
            >
              GG MOUSE PRO: {draftGg.enabled ? 'LIGADO' : 'DESLIGADO'}
            </button>

            <button
              type="button"
              onClick={() =>
                setDraftGg((p) => ({ ...p, showKeyBadges: !p.showKeyBadges }))
              }
              className={`px-2.5 py-1 border cursor-pointer ${
                draftGg.showKeyBadges
                  ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400'
                  : 'bg-[#1a222d] text-neutral-400 border-neutral-700'
              }`}
            >
              TECLAS NA TELA: {draftGg.showKeyBadges ? 'VISÍVEL' : 'OCULTO'}
            </button>

            <button
              type="button"
              onClick={() =>
                setDraftGg((p) => ({ ...p, turboTouch: !p.turboTouch }))
              }
              className={`px-2.5 py-1 border cursor-pointer ${
                draftGg.turboTouch
                  ? 'bg-amber-500/25 text-amber-300 border-amber-400'
                  : 'bg-[#1a222d] text-neutral-400 border-neutral-700'
              }`}
            >
              TOQUE TURBO (0ms): {draftGg.turboTouch ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() =>
                setDraftGg((p) => ({
                  ...p,
                  instantQuickGloo: !p.instantQuickGloo,
                }))
              }
              className={`px-2.5 py-1 border cursor-pointer ${
                draftGg.instantQuickGloo
                  ? 'bg-sky-500/25 text-sky-300 border-sky-400'
                  : 'bg-[#1a222d] text-neutral-400 border-neutral-700'
              }`}
            >
              GELO RÁPIDO 1-CLIQUE: {draftGg.instantQuickGloo ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => setDraftEmulator((v) => !v)}
              className={`px-2.5 py-1 border cursor-pointer ${
                draftEmulator
                  ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                  : 'bg-[#1a222d] text-neutral-400 border-neutral-700'
              }`}
            >
              MODO EMULADOR: {draftEmulator ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() =>
                setDraftGg((p) => ({
                  ...p,
                  pins: buildPinsFromHudLayout(hudLayout, p.pins),
                }))
              }
              className="ml-auto px-2.5 py-1 bg-[#1b232e] hover:bg-amber-500 hover:text-black border border-neutral-600 text-amber-300 flex items-center gap-1 cursor-pointer"
              title="Alinhar todos os pinos GG exatamente sobre os botões do seu HUD atual"
            >
              <RotateCcw className="w-3 h-3" />
              <span>ALINHAR PINOS NO HUD</span>
            </button>
          </div>

          {/* Interactive GG Mapping Stage */}
          <div
            ref={stageRef}
            onPointerDown={() => setSelected(null)}
            className="relative flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-[#202d38] via-[#1b242a] to-[#12171c]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(56,189,248,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.06) 1px, transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          >
            {/* Subtle Center Crosshair Guide */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-35">
              <Crosshair className="w-7 h-7 text-white" />
            </div>

            {/* Translucent HUD Silhouettes so user drops GG keys right over HUD buttons */}
            {hudSilhouettes.map((el) => {
              const cfg = hudLayout[el.key];
              return (
                <div
                  key={el.key}
                  style={{
                    left: `${cfg.xPct}%`,
                    top: `${cfg.yPct}%`,
                    transform: `translate(-50%, -50%) scale(${cfg.scale})`,
                  }}
                  className={`pointer-events-none absolute ${el.size} ${
                    el.circle ? 'rounded-full' : 'rounded-sm'
                  } border border-white/20 bg-white/5 flex items-center justify-center text-[8px] font-mono font-bold text-white/45`}
                >
                  {el.label}
                </div>
              );
            })}

            {/* Draggable GG Mouse Pro Pins */}
            {PIN_ORDER.map((pinId) => {
              const meta = GG_PIN_META[pinId];
              const pin = draftGg.pins[pinId] ?? DEFAULT_GG_MOUSE_PRO.pins[pinId];
              const isSel = selected?.kind === 'pin' && selected.pinId === pinId;

              if (meta.kind === 'wasd') {
                return (
                  <div
                    key={pinId}
                    onPointerDown={(e) =>
                      beginDrag(e, { kind: 'pin', pinId }, pin.xPct, pin.yPct)
                    }
                    style={{
                      left: `${pin.xPct}%`,
                      top: `${pin.yPct}%`,
                      opacity: pin.visible ? draftGg.badgeOpacity : 0.28,
                      transform: `translate(-50%, -50%) scale(${pin.scale})`,
                    }}
                    className={`touch-none absolute z-20 w-24 h-24 rounded-full border-2 flex items-center justify-center cursor-grab active:cursor-grabbing ${
                      isSel
                        ? 'border-cyan-300 bg-cyan-500/20 ring-2 ring-cyan-400/60 shadow-[0_0_18px_rgba(34,211,238,0.65)]'
                        : 'border-cyan-400/75 bg-black/70'
                    }`}
                    title="Arraste para posicionar o bloco WASD"
                  >
                    <span className="absolute top-1.5 text-[10px] font-mono font-black text-cyan-200">
                      {formatKeyCodeLabel(draftKeys.moveForward)}
                    </span>
                    <span className="absolute bottom-1.5 text-[10px] font-mono font-black text-cyan-200">
                      {formatKeyCodeLabel(draftKeys.moveBackward)}
                    </span>
                    <span className="absolute left-2 text-[10px] font-mono font-black text-cyan-200">
                      {formatKeyCodeLabel(draftKeys.moveLeft)}
                    </span>
                    <span className="absolute right-2 text-[10px] font-mono font-black text-cyan-200">
                      {formatKeyCodeLabel(draftKeys.moveRight)}
                    </span>
                    <span className="text-[8px] font-black uppercase text-white/70">
                      MOVER
                    </span>
                  </div>
                );
              }

              if (meta.kind === 'look') {
                return (
                  <div
                    key={pinId}
                    onPointerDown={(e) =>
                      beginDrag(e, { kind: 'pin', pinId }, pin.xPct, pin.yPct)
                    }
                    style={{
                      left: `${pin.xPct}%`,
                      top: `${pin.yPct}%`,
                      opacity: pin.visible ? draftGg.badgeOpacity : 0.28,
                      transform: `translate(-50%, -50%) scale(${pin.scale})`,
                    }}
                    className={`touch-none absolute z-20 w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing ${
                      isSel
                        ? 'border-amber-300 bg-cyan-500/30 ring-2 ring-amber-400/70 shadow-[0_0_20px_rgba(34,211,238,0.7)]'
                        : 'border-cyan-400 bg-cyan-950/75'
                    }`}
                    title="Pino de Mira / Câmera (GG Mouse Pro)"
                  >
                    <Crosshair className="w-5 h-5 text-cyan-300" />
                    <span className="text-[8px] font-mono font-black text-amber-300 leading-none mt-0.5">
                      {formatKeyCodeLabel(draftKeys.toggleMouse)}
                    </span>
                  </div>
                );
              }

              const keyCode = meta.action ? draftKeys[meta.action] : '';
              const keyLabel = keyCode ? formatKeyCodeLabel(keyCode) : '---';

              return (
                <div
                  key={pinId}
                  onPointerDown={(e) =>
                    beginDrag(e, { kind: 'pin', pinId }, pin.xPct, pin.yPct)
                  }
                  style={{
                    left: `${pin.xPct}%`,
                    top: `${pin.yPct}%`,
                    opacity: pin.visible ? draftGg.badgeOpacity : 0.28,
                    transform: `translate(-50%, -50%) scale(${pin.scale})`,
                  }}
                  className={`touch-none absolute z-20 min-w-[38px] px-1.5 py-1 rounded-full border-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing ${
                    isSel
                      ? 'border-amber-300 bg-cyan-600/80 ring-2 ring-amber-400/70 shadow-[0_0_16px_rgba(245,158,11,0.7)] z-30'
                      : 'border-cyan-400/80 bg-black/80 hover:border-white'
                  }`}
                  title={`${meta.label}: ${keyLabel}`}
                >
                  <span className="text-[10px] font-mono font-black text-white leading-none">
                    {keyLabel}
                  </span>
                  <span className="text-[7px] font-bold uppercase text-cyan-200/90 leading-none mt-0.5 whitespace-nowrap">
                    {meta.label.split(' ')[0]}
                  </span>
                </div>
              );
            })}

            {/* Draggable Floating Macro Emoji Buttons */}
            {draftMacros
              .filter((m) => m.showFloatingBtn)
              .map((macro) => {
                const isSel = selected?.kind === 'macro' && selected.macroId === macro.id;
                return (
                  <div
                    key={macro.id}
                    onPointerDown={(e) =>
                      beginDrag(
                        e,
                        { kind: 'macro', macroId: macro.id },
                        macro.xPct,
                        macro.yPct,
                      )
                    }
                    style={{
                      left: `${macro.xPct}%`,
                      top: `${macro.yPct}%`,
                      opacity: macro.enabled ? macro.opacity : 0.35,
                      transform: `translate(-50%, -50%) scale(${macro.scale})`,
                    }}
                    className={`touch-none absolute z-20 w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing ${
                      isSel
                        ? 'border-amber-300 bg-amber-500/35 ring-2 ring-amber-400 z-30'
                        : 'border-amber-400/85 bg-black/80'
                    }`}
                    title={`Macro: ${macro.name}`}
                  >
                    <span className="text-xl leading-none">{macro.emoji}</span>
                    {macro.triggerKey && (
                      <span className="absolute -bottom-1.5 px-1 bg-amber-400 text-black text-[8px] font-mono font-black rounded-sm">
                        {formatKeyCodeLabel(macro.triggerKey)}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Bottom Inspector Bar for Selected Pin / Macro + Global GG Sliders */}
          <div className="shrink-0 bg-[#121822] border-t border-cyan-500/40 px-3 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            {selected?.kind === 'pin' ? (() => {
              const pinId = selected.pinId;
              const meta = GG_PIN_META[pinId];
              const pin = draftGg.pins[pinId] ?? DEFAULT_GG_MOUSE_PRO.pins[pinId];
              const boundCode = meta.action ? draftKeys[meta.action] : '';

              return (
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                  <div className="font-black uppercase text-cyan-300 text-[11px] shrink-0">
                    PINO: {meta.label}
                  </div>

                  {meta.kind === 'wasd' ? (
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { dir: 'moveForward', prefix: '↑' },
                          { dir: 'moveLeft', prefix: '←' },
                          { dir: 'moveBackward', prefix: '↓' },
                          { dir: 'moveRight', prefix: '→' },
                        ] as const
                      ).map((w) => (
                        <button
                          key={w.dir}
                          type="button"
                          onClick={() =>
                            setListeningFor({ kind: 'pin', pinId, wasdDir: w.dir })
                          }
                          className="px-2 py-1 bg-[#0b1017] hover:bg-cyan-500 hover:text-black border border-cyan-500/60 font-mono font-black text-[10px] cursor-pointer"
                        >
                          {w.prefix} {formatKeyCodeLabel(draftKeys[w.dir])}
                        </button>
                      ))}
                    </div>
                  ) : meta.action ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setListeningFor({ kind: 'pin', pinId })}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase cursor-pointer"
                      >
                        TECLA: {boundCode ? formatKeyCodeLabel(boundCode) : 'DEFINIR'}
                      </button>
                      {meta.action === 'quickGlooInstant' && boundCode && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraftKeys((p) => ({ ...p, quickGlooInstant: '' }))
                          }
                          className="px-2 py-1 bg-[#1b222c] hover:bg-red-900/60 border border-neutral-600 text-[10px] font-bold uppercase cursor-pointer"
                        >
                          LIMPAR
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-neutral-400">
                      Arraste onde o cursor gira a câmera (F1 suspende)
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setDraftGg((p) => ({
                        ...p,
                        pins: {
                          ...p.pins,
                          [pinId]: { ...pin, visible: !pin.visible },
                        },
                      }))
                    }
                    className={`px-2 py-1 border text-[10px] font-black uppercase cursor-pointer ${
                      pin.visible
                        ? 'bg-emerald-900/50 border-emerald-400 text-emerald-200'
                        : 'bg-[#1a222d] border-neutral-600 text-neutral-400'
                    }`}
                  >
                    {pin.visible ? 'VISÍVEL' : 'OCULTO'}
                  </button>

                  <label className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-300">
                    <span>TAM.</span>
                    <input
                      type="range"
                      min={0.5}
                      max={1.8}
                      step={0.05}
                      value={pin.scale}
                      onChange={(e) =>
                        setDraftGg((p) => ({
                          ...p,
                          pins: {
                            ...p.pins,
                            [pinId]: { ...pin, scale: Number(e.target.value) },
                          },
                        }))
                      }
                      className="w-20 accent-cyan-400"
                    />
                  </label>
                </div>
              );
            })() : selected?.kind === 'macro' && selectedMacro ? (
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                <div className="font-black uppercase text-amber-300 text-[11px] flex items-center gap-1">
                  <span>{selectedMacro.emoji}</span>
                  <span>MACRO: {selectedMacro.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setListeningFor({ kind: 'macro', macroId: selectedMacro.id })
                  }
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase cursor-pointer"
                >
                  TECLA PC:{' '}
                  {selectedMacro.triggerKey
                    ? formatKeyCodeLabel(selectedMacro.triggerKey)
                    : 'DEFINIR'}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('macros')}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[10px] uppercase cursor-pointer"
                >
                  EDITAR AÇÕES →
                </button>
                <label className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-300">
                  <span>TAM.</span>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    value={selectedMacro.scale}
                    onChange={(e) =>
                      updateSelectedMacro({ scale: Number(e.target.value) })
                    }
                    className="w-20 accent-amber-400"
                  />
                </label>
              </div>
            ) : (
              <div className="text-[11px] font-mono text-neutral-400 flex-1">
                Toque/clique e arraste qualquer pino GG ou botão Emoji para posicionar e editar.
              </div>
            )}

            {/* Global Aim Drag Speed & Pin Opacity */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-neutral-300 shrink-0">
              <label className="flex items-center gap-1.5">
                <span className="text-cyan-300 font-bold">ARRASTE MIRA GG:</span>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={draftGg.aimDragBoost}
                  onChange={(e) =>
                    setDraftGg((p) => ({
                      ...p,
                      aimDragBoost: Number(e.target.value),
                    }))
                  }
                  className="w-20 accent-cyan-400"
                />
                <span className="w-9 text-right text-cyan-200">
                  {draftGg.aimDragBoost.toFixed(2)}x
                </span>
              </label>

              <label className="flex items-center gap-1.5">
                <span className="text-neutral-300 font-bold">OPAC. PINOS:</span>
                <input
                  type="range"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={draftGg.badgeOpacity}
                  onChange={(e) =>
                    setDraftGg((p) => ({
                      ...p,
                      badgeOpacity: Number(e.target.value),
                    }))
                  }
                  className="w-16 accent-amber-400"
                />
                <span className="w-8 text-right">
                  {Math.round(draftGg.badgeOpacity * 100)}%
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MACROS & ANDROID EMOJI BUTTON BUILDER */}
      {tab === 'macros' && (
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[275px_1fr] overflow-hidden">
          {/* Left Macro List + Presets */}
          <div className="bg-[#0f141c] border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col min-h-0 max-h-[34vh] md:max-h-none">
            <div className="p-2.5 border-b border-neutral-800 space-y-1.5">
              <button
                type="button"
                onClick={() => addMacroPreset('blank')}
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>NOVA MACRO EMOJI</span>
              </button>
              <div className="grid grid-cols-1 gap-1 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => addMacroPreset('agachaMiraLevanta')}
                  className="py-1 px-2 bg-[#171f2a] hover:bg-[#222d3d] border border-cyan-500/40 text-cyan-200 text-left truncate cursor-pointer"
                >
                  + 🎯 Agacha + Mira + Levanta
                </button>
                <button
                  type="button"
                  onClick={() => addMacroPreset('geloAgachado')}
                  className="py-1 px-2 bg-[#171f2a] hover:bg-[#222d3d] border border-sky-500/40 text-sky-200 text-left truncate cursor-pointer"
                >
                  + 🧊 Gelo Agachado Rápido
                </button>
                <button
                  type="button"
                  onClick={() => addMacroPreset('puloTiro')}
                  className="py-1 px-2 bg-[#171f2a] hover:bg-[#222d3d] border border-amber-500/40 text-amber-200 text-left truncate cursor-pointer"
                >
                  + ⚡ Pulo + Tiro Rápido
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {draftMacros.length === 0 && (
                <div className="text-[11px] font-mono text-neutral-500 text-center py-4">
                  Nenhuma macro criada ainda.
                </div>
              )}
              {draftMacros.map((m) => {
                const active = selectedMacro?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMacroId(m.id)}
                    className={`w-full p-2 border text-left flex items-center gap-2 cursor-pointer ${
                      active
                        ? 'bg-amber-500/15 border-amber-400'
                        : 'bg-[#141a24] border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <span className="w-8 h-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-lg shrink-0">
                      {m.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black text-white truncate">
                        {m.name}
                      </div>
                      <div className="text-[9px] font-mono text-neutral-400 flex items-center gap-1.5 mt-0.5">
                        <span>{m.steps.length} ações</span>
                        {m.triggerKey && (
                          <span className="px-1 bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                            {formatKeyCodeLabel(m.triggerKey)}
                          </span>
                        )}
                        {m.showFloatingBtn && (
                          <span className="px-1 bg-amber-950 text-amber-300 border border-amber-500/40">
                            TELA
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Macro Editor */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
            {!selectedMacro ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-2">
                <Gamepad2 className="w-10 h-10 text-amber-400/60" />
                <p className="text-xs font-mono">
                  Crie ou selecione uma macro à esquerda para configurar ações e emoji.
                </p>
              </div>
            ) : (
              <>
                {/* Name & Top Actions */}
                <div className="bg-[#121822] border border-neutral-700 p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-11 h-11 rounded-full bg-black/70 border-2 border-amber-400 flex items-center justify-center text-2xl shrink-0">
                      {selectedMacro.emoji}
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-0.5">
                        NOME DA MACRO
                      </label>
                      <input
                        type="text"
                        maxLength={40}
                        value={selectedMacro.name}
                        onChange={(e) =>
                          updateSelectedMacro({ name: e.target.value })
                        }
                        className="w-full bg-[#0a0e14] border border-neutral-600 px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedMacro({ enabled: !selectedMacro.enabled })
                      }
                      className={`px-3 py-2 border text-[10px] font-black uppercase cursor-pointer ${
                        selectedMacro.enabled
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-[#1a222d] text-neutral-400 border-neutral-600'
                      }`}
                    >
                      {selectedMacro.enabled ? 'ATIVA' : 'PAUSADA'}
                    </button>
                    <button
                      type="button"
                      onClick={duplicateSelectedMacro}
                      title="Duplicar macro"
                      className="p-2 bg-[#1a222d] hover:bg-neutral-700 border border-neutral-600 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedMacro}
                      title="Excluir macro"
                      className="p-2 bg-red-950/60 hover:bg-red-800 border border-red-700 text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Trigger Key (PC) + Floating Button Toggle (Android/Touch) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-[#0b1017] border border-neutral-700 p-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-black uppercase text-cyan-300">
                          TECLA DE ATALHO (PC)
                        </div>
                        <div className="text-[9px] font-mono text-neutral-400">
                          Dispara toda a sequência no teclado/mouse
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setListeningFor({
                              kind: 'macro',
                              macroId: selectedMacro.id,
                            })
                          }
                          className="px-2.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-black text-[10px] uppercase cursor-pointer"
                        >
                          {selectedMacro.triggerKey
                            ? formatKeyCodeLabel(selectedMacro.triggerKey)
                            : 'DEFINIR'}
                        </button>
                        {selectedMacro.triggerKey && (
                          <button
                            type="button"
                            onClick={() => updateSelectedMacro({ triggerKey: '' })}
                            className="p-1.5 bg-[#1b222c] hover:bg-red-900/60 border border-neutral-600 cursor-pointer"
                            title="Remover tecla"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedMacro({
                          showFloatingBtn: !selectedMacro.showFloatingBtn,
                        })
                      }
                      className={`p-2.5 border text-left flex items-center justify-between gap-2 cursor-pointer ${
                        selectedMacro.showFloatingBtn
                          ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                          : 'bg-[#0b1017] border-neutral-700 text-neutral-400'
                      }`}
                    >
                      <div>
                        <div className="text-[10px] font-black uppercase">
                          BOTÃO FLUTUANTE NA TELA (ANDROID / TOQUE)
                        </div>
                        <div className="text-[9px] font-mono opacity-80">
                          Cria botão circular com emoji clicável na partida
                        </div>
                      </div>
                      <span className="font-black text-xs shrink-0">
                        {selectedMacro.showFloatingBtn ? 'LIGADO' : 'OFF'}
                      </span>
                    </button>
                  </div>

                  {/* Emoji Picker & Floating Button Appearance */}
                  <div className="bg-[#0b1017] border border-neutral-800 p-2.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase text-amber-300">
                        ESCOLHER EMOJI DO BOTÃO
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-neutral-400">
                          Outro emoji:
                        </span>
                        <input
                          type="text"
                          maxLength={4}
                          value={selectedMacro.emoji}
                          onChange={(e) =>
                            updateSelectedMacro({
                              emoji: e.target.value || '⚡',
                            })
                          }
                          className="w-12 text-center bg-[#141a24] border border-neutral-600 py-0.5 text-sm outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {MACRO_EMOJI_PALETTE.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => updateSelectedMacro({ emoji: em })}
                          className={`w-8 h-8 border flex items-center justify-center text-base cursor-pointer ${
                            selectedMacro.emoji === em
                              ? 'bg-amber-500/30 border-amber-400 scale-105'
                              : 'bg-[#141a24] border-neutral-700 hover:border-neutral-500'
                          }`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>

                    {selectedMacro.showFloatingBtn && (
                      <div className="pt-2 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono">
                        <label className="flex items-center gap-2">
                          <span>TAMANHO:</span>
                          <input
                            type="range"
                            min={0.5}
                            max={2.0}
                            step={0.05}
                            value={selectedMacro.scale}
                            onChange={(e) =>
                              updateSelectedMacro({ scale: Number(e.target.value) })
                            }
                            className="w-24 accent-amber-400"
                          />
                          <span>{Math.round(selectedMacro.scale * 100)}%</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <span>OPACIDADE:</span>
                          <input
                            type="range"
                            min={0.2}
                            max={1.0}
                            step={0.05}
                            value={selectedMacro.opacity}
                            onChange={(e) =>
                              updateSelectedMacro({ opacity: Number(e.target.value) })
                            }
                            className="w-24 accent-amber-400"
                          />
                          <span>{Math.round(selectedMacro.opacity * 100)}%</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected({ kind: 'macro', macroId: selectedMacro.id });
                            setTab('gg');
                          }}
                          className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase cursor-pointer"
                        >
                          POSICIONAR NA TELA →
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sequence Builder */}
                <div className="bg-[#121822] border border-neutral-700 p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-black uppercase text-amber-400">
                        SEQUÊNCIA DE AÇÕES ({selectedMacro.steps.length})
                      </h3>
                      <p className="text-[10px] font-mono text-neutral-400">
                        Ex: Agachar → Alternar Mira → Agachar (levanta sozinho no 2º clique!)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={runVisualStepPreview}
                      disabled={selectedMacro.steps.length === 0}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>TESTAR SEQUÊNCIA</span>
                    </button>
                  </div>

                  {/* Quick Add Action Chips */}
                  <div className="flex flex-wrap items-center gap-1">
                    {QUICK_STEP_ACTIONS.map((act) => {
                      const meta = MACRO_ACTION_META[act];
                      return (
                        <button
                          key={act}
                          type="button"
                          onClick={() =>
                            updateSelectedMacro({
                              steps: [
                                ...selectedMacro.steps,
                                { id: makeId('st'), action: act, delayMs: 28 },
                              ].slice(0, 24),
                            })
                          }
                          className="px-2 py-1 bg-[#18202c] hover:bg-amber-500 hover:text-black border border-neutral-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>{meta.emoji}</span>
                          <span>+ {meta.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Full Action Add Dropdown */}
                  <div className="flex items-center gap-2">
                    <select
                      value={newStepAction}
                      onChange={(e) =>
                        setNewStepAction(e.target.value as MacroStepAction)
                      }
                      className="flex-1 bg-[#0a0e14] border border-neutral-600 px-2.5 py-1.5 text-xs font-bold text-white outline-none"
                    >
                      {(Object.keys(MACRO_ACTION_META) as MacroStepAction[]).map(
                        (act) => (
                          <option key={act} value={act}>
                            {MACRO_ACTION_META[act].emoji} {MACRO_ACTION_META[act].label}
                          </option>
                        ),
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedMacro({
                          steps: [
                            ...selectedMacro.steps,
                            {
                              id: makeId('st'),
                              action: newStepAction,
                              delayMs: 30,
                            },
                          ].slice(0, 24),
                        })
                      }
                      className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>ADICIONAR</span>
                    </button>
                  </div>

                  {/* Step List */}
                  <div className="space-y-1.5">
                    {selectedMacro.steps.map((step, idx) => {
                      const isPlayingNow = previewStepIdx === idx;
                      const updateStep = (patch: Partial<MacroStep>) => {
                        const nextSteps = selectedMacro.steps.map((s, i) =>
                          i === idx ? { ...s, ...patch } : s,
                        );
                        updateSelectedMacro({ steps: nextSteps });
                      };
                      const moveStep = (dir: -1 | 1) => {
                        const target = idx + dir;
                        if (target < 0 || target >= selectedMacro.steps.length) return;
                        const copy = [...selectedMacro.steps];
                        const [removed] = copy.splice(idx, 1);
                        copy.splice(target, 0, removed);
                        updateSelectedMacro({ steps: copy });
                      };

                      return (
                        <div
                          key={step.id}
                          className={`p-2 border flex flex-wrap items-center gap-2 transition-colors ${
                            isPlayingNow
                              ? 'bg-emerald-500/25 border-emerald-400'
                              : 'bg-[#0b1017] border-neutral-700/80'
                          }`}
                        >
                          <span className="w-6 h-6 bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>

                          <select
                            value={step.action}
                            onChange={(e) =>
                              updateStep({
                                action: e.target.value as MacroStepAction,
                              })
                            }
                            className="flex-1 min-w-[165px] bg-[#141a24] border border-neutral-600 px-2 py-1 text-xs font-bold text-white outline-none"
                          >
                            {(Object.keys(MACRO_ACTION_META) as MacroStepAction[]).map(
                              (act) => (
                                <option key={act} value={act}>
                                  {MACRO_ACTION_META[act].emoji}{' '}
                                  {MACRO_ACTION_META[act].label}
                                </option>
                              ),
                            )}
                          </select>

                          <div className="flex items-center gap-1.5 text-[10px] font-mono">
                            <span className="text-neutral-400">ATRASO:</span>
                            <input
                              type="number"
                              min={0}
                              max={2000}
                              step={5}
                              value={step.delayMs}
                              onChange={(e) =>
                                updateStep({
                                  delayMs: Math.max(
                                    0,
                                    Math.min(2000, Number(e.target.value) || 0),
                                  ),
                                })
                              }
                              className="w-16 bg-[#141a24] border border-neutral-600 px-1.5 py-0.5 text-center text-cyan-300 font-bold"
                            />
                            <span className="text-neutral-400">ms</span>
                            {[0, 25, 40, 80].map((ms) => (
                              <button
                                key={ms}
                                type="button"
                                onClick={() => updateStep({ delayMs: ms })}
                                className={`px-1.5 py-0.5 border text-[9px] cursor-pointer ${
                                  step.delayMs === ms
                                    ? 'bg-cyan-500 text-black border-cyan-300 font-black'
                                    : 'bg-[#141a24] text-neutral-300 border-neutral-700'
                                }`}
                              >
                                {ms}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => moveStep(-1)}
                              disabled={idx === 0}
                              className="p-1 bg-[#141a24] border border-neutral-700 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStep(1)}
                              disabled={idx === selectedMacro.steps.length - 1}
                              className="p-1 bg-[#141a24] border border-neutral-700 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedMacro({
                                  steps: selectedMacro.steps.filter(
                                    (_, i) => i !== idx,
                                  ),
                                })
                              }
                              className="p-1 bg-red-950/60 hover:bg-red-800 border border-red-700/70 text-red-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
