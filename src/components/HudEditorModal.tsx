import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, LogOut, MicOff, RotateCcw, Save, Settings, Users, Volume2, Wifi } from 'lucide-react';
import {
  DEFAULT_HUD_LAYOUT,
  DEFAULT_HUD_LAYOUT_SLOT_2,
  HudElementId,
  HudLayoutConfig,
  HudSlotId,
} from '../game/types';
import { structuredCloneLayout } from '../game/storage';
import {
  IconBackpackSvg,
  IconCoinSvg,
  IconCrouchSvg,
  IconFireBurstSvg,
  IconFistSvg,
  IconGlooSvg,
  IconGrenadeSvg,
  IconHelmetSvg,
  IconJumpSvg,
  IconMedkitSvg,
  IconProneSvg,
  IconReloadSvg,
  IconScopeSvg,
  IconSprintSvg,
  IconVestSvg,
} from './HudIcons';

interface HudEditorModalProps {
  layout: HudLayoutConfig;
  activeSlot?: HudSlotId;
  hudSlots?: Record<HudSlotId, HudLayoutConfig>;
  onSave: (
    nextLayout: HudLayoutConfig,
    nextSlot: HudSlotId,
    nextSlots: Record<HudSlotId, HudLayoutConfig>,
  ) => void;
  onClose: () => void;
}

interface ElementMeta {
  label: string;
  sizeClass: string;
  shape: 'box' | 'circle';
  renderPreview: () => React.ReactNode;
}

const ELEMENT_ORDER: HudElementId[] = [
  'minimap',
  'teamPanel',
  'topBanner',
  'killFeed',
  'ffCoins',
  'aliveBox',
  'settingsBtn',
  'pingBadge',
  'voiceCall',
  'weapons',
  'lootList',
  'tacticalBanner',
  'hpBar',
  'quickGlooBtn',
  'backpackBtn',
  'medkitBtn',
  'smallMedkitBtn',
  'grenadeBtn',
  'glooBtn',
  'sprintBtn',
  'leftFireBtn',
  'joystick',
  'fpsBadge',
  'fireBtn',
  'aimBtn',
  'jumpBtn',
  'crouchBtn',
  'proneBtn',
  'reloadBtn',
  'actionPrompt',
  'vehicleSteer',
  'vehiclePedals',
];

const ELEMENT_META: Record<HudElementId, ElementMeta> = {
  minimap: {
    label: 'Minimapa',
    sizeClass: 'w-24 h-24 sm:w-28 sm:h-28',
    shape: 'box',
    renderPreview: () => (
      <div className="relative w-full h-full bg-[#243127]/85 border border-white/40 overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              'radial-gradient(circle at 45% 45%, #5d7b46 0%, #3d5232 55%, #233c4a 100%)',
          }}
        />
        <div className="w-12 h-12 rounded-full border border-white/55 pointer-events-none" />
        <div className="absolute w-2 h-2 rounded-full bg-amber-400 border border-white" />
      </div>
    ),
  },
  teamPanel: {
    label: 'Esquadrão',
    sizeClass: 'w-32 sm:w-36',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full flex flex-col gap-0.5 text-left pointer-events-none">
        {[
          { num: 1, color: '#f59e0b' },
          { num: 2, color: '#34d399' },
          { num: 3, color: '#38bdf8' },
          { num: 4, color: '#fbbf24' },
        ].map((p) => (
          <div
            key={p.num}
            className="flex items-center gap-1 bg-black/55 border border-white/20 px-1 py-0.5"
          >
            <span
              className="w-3 h-3 text-[8px] font-black text-black flex items-center justify-center shrink-0"
              style={{ backgroundColor: p.color }}
            >
              {p.num}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[8px] font-bold leading-none text-white truncate">
                PLAYER {p.num}
              </div>
              <div className="h-0.5 w-full bg-white/80 mt-0.5" />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  topBanner: {
    label: 'Bússola / Safe',
    sizeClass: 'w-44 h-8',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full bg-black/45 border border-white/25 px-2 flex flex-col items-center justify-center leading-tight">
        <span className="text-[8px] font-mono tracking-widest text-white/90">
          NO · N · NE · L
        </span>
        <span className="text-[8px] font-bold text-amber-300">ZONA SEGURA 00:45</span>
      </div>
    ),
  },
  killFeed: {
    label: 'Feed de Abates',
    sizeClass: 'w-40 h-6',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full bg-black/50 border border-white/25 px-1.5 flex items-center justify-center gap-1 text-[8px] font-bold whitespace-nowrap pointer-events-none">
        <span className="text-white">JOGADOR</span>
        <span className="px-1 bg-black/70 border border-white/20 text-[7px] font-mono text-neutral-200">
          AK47
        </span>
        <span className="text-amber-300">Eliminado</span>
      </div>
    ),
  },
  ffCoins: {
    label: 'Moedas FF / Telando',
    sizeClass: 'w-20 h-7',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full bg-black/75 border border-amber-400/60 px-2 flex items-center justify-center gap-1 text-[10px] font-mono font-black text-amber-300 pointer-events-none">
        <IconCoinSvg className="w-3.5 h-3.5 shrink-0" />
        <span>400</span>
      </div>
    ),
  },
  aliveBox: {
    label: 'Vivos / Abates',
    sizeClass: 'w-28 h-7',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full bg-black/65 border border-white/30 flex items-center justify-between px-2 text-[9px] font-black tracking-wider">
        <span className="text-cyan-300">VIVO 51</span>
        <span className="text-orange-400">MATOU 0</span>
      </div>
    ),
  },
  settingsBtn: {
    label: 'Configurações',
    sizeClass: 'w-8 h-8',
    shape: 'box',
    renderPreview: () => <Settings className="w-4 h-4 text-white" />,
  },
  pingBadge: {
    label: 'Ping / Rede',
    sizeClass: 'w-16 h-6',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full bg-black/75 border border-white/25 px-1.5 flex items-center justify-center gap-1 text-[9px] font-mono font-black text-emerald-400 pointer-events-none">
        <Wifi className="w-3 h-3 shrink-0" />
        <span>28ms</span>
      </div>
    ),
  },
  voiceCall: {
    label: 'Call de Voz',
    sizeClass: 'w-36 h-7',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full bg-black/80 border border-white/30 px-1 flex items-center justify-between gap-1 text-[8px] font-black uppercase pointer-events-none">
        <span className="px-1 py-0.5 bg-neutral-800 text-amber-300 flex items-center gap-0.5">
          <Volume2 className="w-2.5 h-2.5" />
          MUTAR
        </span>
        <span className="px-1.5 py-0.5 bg-amber-500 text-black flex items-center gap-0.5">
          <MicOff className="w-2.5 h-2.5" />
          FALAR
        </span>
        <span className="px-1 py-0.5 bg-neutral-800 text-amber-300 flex items-center gap-0.5">
          <Users className="w-2.5 h-2.5" />
          1
        </span>
      </div>
    ),
  },
  weapons: {
    label: 'Armas',
    sizeClass: 'w-40 sm:w-44',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full flex flex-col gap-1 pointer-events-none">
        <div className="bg-black/55 border border-white/30 px-2 py-1 flex items-center justify-between">
          <span className="text-[11px] font-mono font-black text-white">20/100</span>
          <span className="text-[9px] font-black tracking-wider text-amber-300">AK47</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <div className="h-7 bg-black/55 border border-white/25 flex items-center justify-center text-[8px] font-mono text-white">
            80
          </div>
          <div className="h-7 bg-black/55 border border-white/25 flex items-center justify-center text-[8px] font-mono text-white">
            50
          </div>
          <div className="h-7 bg-black/55 border border-white/25 flex items-center justify-center text-white">
            <IconFistSvg className="w-4 h-4" />
          </div>
        </div>
      </div>
    ),
  },
  lootList: {
    label: 'Lista de Loot',
    sizeClass: 'w-36 sm:w-44',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full flex items-center justify-center gap-1 pointer-events-none">
        {['[E] M4A1', 'COLETE 3', 'KIT'].map((lbl, idx) => (
          <div
            key={lbl}
            className={`flex-1 h-11 bg-black/65 px-1 py-0.5 flex flex-col items-center justify-between border ${
              idx === 0 ? 'border-amber-400/90' : 'border-white/30'
            }`}
          >
            <span className="text-[7px] font-mono font-black text-amber-300">
              {idx === 0 ? 'E' : 'LOOT'}
            </span>
            <span className="text-[7px] font-bold text-white leading-none truncate w-full text-center">
              {lbl}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  tacticalBanner: {
    label: 'Aviso Gelo / Granada',
    sizeClass: 'w-44 h-6',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full bg-cyan-950/90 border border-cyan-400 px-2 flex items-center justify-center text-[8px] font-mono font-bold text-cyan-200 pointer-events-none">
        GELO / GRANADA ATIVO
      </div>
    ),
  },
  hpBar: {
    label: 'Barra HP / Colete',
    sizeClass: 'w-48 sm:w-56',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full flex flex-col gap-0.5 pointer-events-none">
        <div className="flex items-center justify-center gap-3 text-white/90">
          <div className="flex items-center gap-1">
            <IconVestSvg className="w-3.5 h-3.5" />
            <div className="w-10 h-1 bg-amber-400" />
          </div>
          <div className="flex items-center gap-1">
            <IconHelmetSvg className="w-3.5 h-3.5" />
            <div className="w-10 h-1 bg-amber-400" />
          </div>
        </div>
        <div className="w-full h-3 bg-black/70 border border-white/35 px-1 flex items-center gap-1.5">
          <span className="text-[8px] font-black text-white">HP</span>
          <div className="flex-1 h-1.5 bg-white/90" />
          <span className="text-[8px] font-mono text-white">200/200</span>
        </div>
      </div>
    ),
  },
  quickGlooBtn: {
    label: 'Gelo Rápido (HP)',
    sizeClass: 'w-8 h-8',
    shape: 'circle',
    renderPreview: () => <IconGlooSvg className="w-4 h-4 text-cyan-200" />,
  },
  backpackBtn: {
    label: 'Mochila',
    sizeClass: 'w-11 h-11',
    shape: 'circle',
    renderPreview: () => <IconBackpackSvg className="w-6 h-6" />,
  },
  medkitBtn: {
    label: 'Kit Médico',
    sizeClass: 'w-11 h-11',
    shape: 'circle',
    renderPreview: () => <IconMedkitSvg className="w-6 h-6" />,
  },
  smallMedkitBtn: {
    label: 'Kit Pequeno',
    sizeClass: 'w-10 h-10',
    shape: 'circle',
    renderPreview: () => (
      <div className="relative flex items-center justify-center">
        <IconMedkitSvg className="w-5 h-5 text-emerald-300" />
        <span className="absolute -bottom-1.5 text-[7px] font-mono font-black text-emerald-300">
          PEQ
        </span>
      </div>
    ),
  },
  grenadeBtn: {
    label: 'Granada',
    sizeClass: 'w-11 h-11',
    shape: 'circle',
    renderPreview: () => <IconGrenadeSvg className="w-6 h-6" />,
  },
  glooBtn: {
    label: 'Parede de Gelo',
    sizeClass: 'w-11 h-11',
    shape: 'circle',
    renderPreview: () => <IconGlooSvg className="w-6 h-6" />,
  },
  sprintBtn: {
    label: 'Correr',
    sizeClass: 'w-11 h-11',
    shape: 'circle',
    renderPreview: () => <IconSprintSvg className="w-6 h-6" />,
  },
  leftFireBtn: {
    label: 'Atirar Esq.',
    sizeClass: 'w-12 h-12',
    shape: 'circle',
    renderPreview: () => <IconFireBurstSvg className="w-7 h-7" />,
  },
  joystick: {
    label: 'Analógico',
    sizeClass: 'w-24 h-24',
    shape: 'circle',
    renderPreview: () => (
      <div className="w-full h-full rounded-full border border-white/35 bg-black/30 flex items-center justify-center">
        <div className="w-9 h-9 rounded-full border-2 border-white/60 bg-white/15" />
      </div>
    ),
  },
  fpsBadge: {
    label: 'Contador FPS',
    sizeClass: 'w-14 h-5',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full bg-black/60 border border-white/25 flex items-center justify-center text-[9px] font-mono font-bold text-white pointer-events-none">
        60 FPS
      </div>
    ),
  },
  fireBtn: {
    label: 'Atirar Dir.',
    sizeClass: 'w-16 h-16',
    shape: 'circle',
    renderPreview: () => <IconFireBurstSvg className="w-9 h-9" />,
  },
  aimBtn: {
    label: 'Mirar',
    sizeClass: 'w-12 h-12',
    shape: 'circle',
    renderPreview: () => <IconScopeSvg className="w-6 h-6" />,
  },
  jumpBtn: {
    label: 'Pular',
    sizeClass: 'w-12 h-12',
    shape: 'circle',
    renderPreview: () => <IconJumpSvg className="w-6 h-6" />,
  },
  crouchBtn: {
    label: 'Agachar',
    sizeClass: 'w-12 h-12',
    shape: 'circle',
    renderPreview: () => <IconCrouchSvg className="w-6 h-6" />,
  },
  proneBtn: {
    label: 'Deitar',
    sizeClass: 'w-12 h-12',
    shape: 'circle',
    renderPreview: () => <IconProneSvg className="w-6 h-6" />,
  },
  reloadBtn: {
    label: 'Recarregar',
    sizeClass: 'w-11 h-11',
    shape: 'circle',
    renderPreview: () => <IconReloadSvg className="w-5 h-5" />,
  },
  actionPrompt: {
    label: 'Reusar / Ações',
    sizeClass: 'w-28 h-8',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full bg-black/60 border border-white/30 flex items-center justify-center text-[9px] font-black tracking-wider text-amber-200 pointer-events-none">
        LOJINHA / VEÍCULO
      </div>
    ),
  },
  vehicleSteer: {
    label: 'Direção Carro',
    sizeClass: 'w-24 h-10',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full flex items-center justify-center gap-1.5 pointer-events-none">
        <div className="w-10 h-10 bg-black/70 border border-white/50 flex items-center justify-center text-xs font-black text-white">
          ◀
        </div>
        <div className="w-10 h-10 bg-black/70 border border-white/50 flex items-center justify-center text-xs font-black text-white">
          ▶
        </div>
      </div>
    ),
  },
  vehiclePedals: {
    label: 'Pedais Carro',
    sizeClass: 'w-28 h-10',
    shape: 'box',
    renderPreview: () => (
      <div className="w-full h-full flex items-center justify-center gap-1.5 pointer-events-none">
        <div className="px-2.5 h-10 bg-red-900/80 border border-red-400 flex items-center justify-center text-[9px] font-black text-white">
          RÉ
        </div>
        <div className="px-2 h-10 bg-emerald-700/85 border border-emerald-300 flex items-center justify-center text-[9px] font-black text-white">
          ACELERAR
        </div>
      </div>
    ),
  },
};

export const HudEditorModal: React.FC<HudEditorModalProps> = ({
  layout,
  activeSlot: initialSlot = 1,
  hudSlots: initialSlots,
  onSave,
  onClose,
}) => {
  const [slot, setSlot] = useState<HudSlotId>(initialSlot === 2 ? 2 : 1);
  const [slots, setSlots] = useState<Record<HudSlotId, HudLayoutConfig>>(() => ({
    1: structuredCloneLayout(
      initialSlot === 1 ? layout : (initialSlots?.[1] ?? DEFAULT_HUD_LAYOUT),
      DEFAULT_HUD_LAYOUT,
    ),
    2: structuredCloneLayout(
      initialSlot === 2 ? layout : (initialSlots?.[2] ?? DEFAULT_HUD_LAYOUT_SLOT_2),
      DEFAULT_HUD_LAYOUT_SLOT_2,
    ),
  }));
  const [selected, setSelected] = useState<HudElementId>('fireBtn');
  const [panelExpanded, setPanelExpanded] = useState(true);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<HudElementId | null>(null);

  useEffect(() => {
    const stopDrag = () => {
      draggingRef.current = null;
    };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    return () => {
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  }, []);

  const currentLayout = slots[slot];
  const selItem = currentLayout[selected];

  const updateCurrentElement = (patch: Partial<HudLayoutConfig[HudElementId]>) => {
    setSlots((prev) => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        [selected]: {
          ...prev[slot][selected],
          ...patch,
        },
      },
    }));
  };

  const handleStagePointerMove = (e: React.PointerEvent) => {
    const id = draggingRef.current;
    const stage = stageRef.current;
    if (!id || !stage) return;
    const rect = stage.getBoundingClientRect();
    const xPct = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(3, Math.min(97, ((e.clientY - rect.top) / rect.height) * 100));
    setSlots((prev) => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        [id]: {
          ...prev[slot][id],
          xPct: Math.round(xPct * 10) / 10,
          yPct: Math.round(yPct * 10) / 10,
        },
      },
    }));
  };

  const handleStagePointerUp = () => {
    draggingRef.current = null;
  };

  const handleResetActiveSlot = () => {
    const presetBase = slot === 1 ? DEFAULT_HUD_LAYOUT : DEFAULT_HUD_LAYOUT_SLOT_2;
    setSlots((prev) => ({
      ...prev,
      [slot]: structuredCloneLayout(presetBase, presetBase),
    }));
  };

  const handleSaveAndClose = () => {
    const clonedSlots: Record<HudSlotId, HudLayoutConfig> = {
      1: structuredCloneLayout(slots[1], DEFAULT_HUD_LAYOUT),
      2: structuredCloneLayout(slots[2], DEFAULT_HUD_LAYOUT_SLOT_2),
    };
    onSave(clonedSlots[slot], slot, clonedSlots);
  };

  return (
    <div
      ref={stageRef}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerLeave={handleStagePointerUp}
      className="fixed inset-0 z-[60] w-screen h-screen overflow-hidden touch-none select-none text-white"
      style={{
        background:
          'linear-gradient(180deg, #536e7a 0%, #7d969e 34%, #4c5b3e 42%, #2f3a25 100%)',
      }}
    >
      {/* Subtle nostalgic terrain vignette & center reticle */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, transparent 35%, rgba(0,0,0,0.42) 100%)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-6 h-6 rounded-full border border-white/55 flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-white/80" />
        </div>
      </div>

      {/* Subtle 3rd-person survivor silhouette matching in-game camera proportion */}
      <div
        className="absolute left-[41%] bottom-[8%] -translate-x-1/2 pointer-events-none opacity-45"
        aria-hidden="true"
      >
        <svg width="78" height="190" viewBox="0 0 78 190" fill="none">
          <circle cx="39" cy="20" r="12" fill="#181c22" />
          <path d="M22 36 C22 32, 56 32, 56 36 L60 96 L18 96 Z" fill="#1f252d" />
          <path d="M22 96 L35 96 L33 176 L21 176 Z" fill="#14181e" />
          <path d="M43 96 L56 96 L57 176 L45 176 Z" fill="#14181e" />
          <rect x="44" y="42" width="12" height="36" rx="2" fill="#0d1014" />
        </svg>
      </div>

      {/* Floating Top-Center Free Fire HUD Editor Panel */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed top-2 left-1/2 -translate-x-1/2 z-40 w-[290px] sm:w-[340px] flex flex-col items-center"
      >
        <div className="w-full bg-black/80 border border-white/25 shadow-2xl">
          {/* Tabs: HUD 1 (Clássico 2017) | HUD 2 (Outro Tipo) */}
          <div className="grid grid-cols-2">
            <button
              type="button"
              onClick={() => setSlot(1)}
              className={`py-2 px-2 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors border-b ${
                slot === 1
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-[#12161d] text-neutral-300 hover:text-white border-white/15'
              }`}
            >
              HUD 1 · 2017
            </button>
            <button
              type="button"
              onClick={() => setSlot(2)}
              className={`py-2 px-2 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors border-b border-l border-white/15 ${
                slot === 2
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-[#12161d] text-neutral-300 hover:text-white'
              }`}
            >
              HUD 2 · OUTRO
            </button>
          </div>

          {/* 3 Compact Icon Actions: Sair | Resetar | Salvar */}
          <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-black/60 border-b border-white/15">
            <button
              type="button"
              onClick={onClose}
              title="Sair sem salvar"
              className="h-8 bg-white hover:bg-neutral-200 text-neutral-900 font-black text-[10px] uppercase flex items-center justify-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>SAIR</span>
            </button>
            <button
              type="button"
              onClick={handleResetActiveSlot}
              title={slot === 1 ? 'Resetar HUD 1 (Clássico 2017)' : 'Resetar HUD 2'}
              className="h-8 bg-white hover:bg-neutral-200 text-neutral-900 font-black text-[10px] uppercase flex items-center justify-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET</span>
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              title="Salvar HUD"
              className="h-8 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase flex items-center justify-center gap-1 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>SALVAR</span>
            </button>
          </div>

          {/* Collapsible Sliders: Transparência & Tamanho */}
          {panelExpanded && (
            <div className="px-3 py-2.5 space-y-2.5 bg-black/70">
              <div className="flex items-center justify-between text-[10px] font-mono text-amber-300/95 uppercase border-b border-white/10 pb-1">
                <span>Item: {ELEMENT_META[selected].label}</span>
                <span>{slot === 1 ? 'Clássico 2017' : 'Outro Tipo'}</span>
              </div>

              {/* Transparência */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-white">Transparência</span>
                  <span className="text-white font-mono tabular-nums">
                    {Math.round(selItem.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={selItem.opacity}
                  onChange={(e) =>
                    updateCurrentElement({ opacity: Number(e.target.value) })
                  }
                  className="w-full h-1.5 accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Tamanho */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-white">Tamanho</span>
                  <span className="text-white font-mono tabular-nums">
                    {Math.round(selItem.scale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={2.0}
                  step={0.05}
                  value={selItem.scale}
                  onChange={(e) =>
                    updateCurrentElement({ scale: Number(e.target.value) })
                  }
                  className="w-full h-1.5 accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Collapse / Expand Chevron Tab */}
        <button
          type="button"
          onClick={() => setPanelExpanded((v) => !v)}
          title={panelExpanded ? 'Recolher painel' : 'Expandir painel'}
          className="px-4 py-0.5 bg-black/80 hover:bg-black border border-t-0 border-white/25 text-white cursor-pointer"
        >
          {panelExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Draggable Proportional HUD Elements */}
      {ELEMENT_ORDER.map((id) => {
        const meta = ELEMENT_META[id];
        const cfg = currentLayout[id];
        const isSel = selected === id;
        const isCompositeBlock =
          id === 'minimap' ||
          id === 'teamPanel' ||
          id === 'topBanner' ||
          id === 'killFeed' ||
          id === 'ffCoins' ||
          id === 'aliveBox' ||
          id === 'pingBadge' ||
          id === 'voiceCall' ||
          id === 'weapons' ||
          id === 'lootList' ||
          id === 'tacticalBanner' ||
          id === 'hpBar' ||
          id === 'joystick' ||
          id === 'fpsBadge' ||
          id === 'actionPrompt' ||
          id === 'vehicleSteer' ||
          id === 'vehiclePedals';

        return (
          <div
            key={id}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
              setSelected(id);
              draggingRef.current = id;
            }}
            style={{
              left: `${cfg.xPct}%`,
              top: `${cfg.yPct}%`,
              opacity: cfg.opacity,
              transform: `translate(-50%, -50%) scale(${cfg.scale})`,
            }}
            title={meta.label}
            className={`absolute ${meta.sizeClass} ${
              meta.shape === 'circle' ? 'rounded-full' : 'rounded-[2px]'
            } flex items-center justify-center text-center cursor-grab active:cursor-grabbing transition-shadow ${
              isCompositeBlock
                ? isSel
                  ? 'ring-2 ring-red-500 shadow-[0_0_16px_rgba(245,158,11,0.9)] z-30'
                  : 'z-10 hover:ring-1 hover:ring-white/50'
                : isSel
                  ? 'bg-black/70 text-amber-300 border-2 border-red-500 ring-2 ring-amber-400/80 shadow-[0_0_16px_rgba(245,158,11,0.9)] z-30'
                  : 'bg-black/50 text-white border border-white/35 z-10 hover:border-white/75'
            }`}
          >
            {meta.renderPreview()}
          </div>
        );
      })}
    </div>
  );
};
