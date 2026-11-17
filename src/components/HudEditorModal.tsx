import React, { useEffect, useRef, useState } from 'react';
import { Move, RotateCcw, Save, Sliders, X } from 'lucide-react';
import {
  DEFAULT_HUD_LAYOUT,
  HudElementId,
  HudLayoutConfig,
} from '../game/types';
import { structuredCloneLayout } from '../game/storage';
import {
  IconBackpackSvg,
  IconCrouchSvg,
  IconFireBurstSvg,
  IconGlooSvg,
  IconGrenadeSvg,
  IconJumpSvg,
  IconMedkitSvg,
  IconProneSvg,
  IconReloadSvg,
  IconScopeSvg,
  IconSprintSvg,
} from './HudIcons';

interface HudEditorModalProps {
  layout: HudLayoutConfig;
  onSave: (next: HudLayoutConfig) => void;
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
  'aliveBox',
  'weapons',
  'hpBar',
  'backpackBtn',
  'medkitBtn',
  'grenadeBtn',
  'glooBtn',
  'sprintBtn',
  'leftFireBtn',
  'joystick',
  'fireBtn',
  'aimBtn',
  'jumpBtn',
  'crouchBtn',
  'proneBtn',
  'reloadBtn',
  'actionPrompt',
];

const ELEMENT_META: Record<HudElementId, ElementMeta> = {
  minimap: {
    label: 'Minimapa',
    sizeClass: 'w-20 h-20',
    shape: 'box',
    renderPreview: () => (
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[9px] font-black">MINIMAPA</span>
        <span className="text-[7px] opacity-75">BERMUDA</span>
      </div>
    ),
  },
  teamPanel: {
    label: 'Time (Duo/Squad)',
    sizeClass: 'w-24 h-12',
    shape: 'box',
    renderPreview: () => (
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[8px] font-black">ESQUADRÃO</span>
        <span className="text-[7px] opacity-75">1·2·3·4</span>
      </div>
    ),
  },
  topBanner: {
    label: 'Bússola / Safe',
    sizeClass: 'w-44 h-10',
    shape: 'box',
    renderPreview: () => (
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[8px] font-black">N · NE · ZONA SEGURA</span>
        <span className="text-[9px] font-mono">00:45</span>
      </div>
    ),
  },
  aliveBox: {
    label: 'Vivo / Matou',
    sizeClass: 'w-28 h-7',
    shape: 'box',
    renderPreview: () => (
      <span className="text-[9px] font-black">VIVO 50 · MATOU 0</span>
    ),
  },
  weapons: {
    label: 'Caixa de Armas',
    sizeClass: 'w-32 h-14',
    shape: 'box',
    renderPreview: () => (
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[9px] font-black">ARMAS / PUNHO</span>
        <span className="text-[7px] font-mono opacity-80">1 · 2 · 3 · 4</span>
      </div>
    ),
  },
  hpBar: {
    label: 'Barra HP / Colete',
    sizeClass: 'w-44 h-8',
    shape: 'box',
    renderPreview: () => (
      <span className="text-[9px] font-black">COLETE · HP 200/200</span>
    ),
  },
  backpackBtn: {
    label: 'Mochila',
    sizeClass: 'w-11 h-11',
    shape: 'box',
    renderPreview: () => <IconBackpackSvg className="w-6 h-6" />,
  },
  medkitBtn: {
    label: 'Kit Médico',
    sizeClass: 'w-11 h-11',
    shape: 'box',
    renderPreview: () => <IconMedkitSvg className="w-6 h-6" />,
  },
  grenadeBtn: {
    label: 'Granada',
    sizeClass: 'w-11 h-11',
    shape: 'box',
    renderPreview: () => <IconGrenadeSvg className="w-6 h-6" />,
  },
  glooBtn: {
    label: 'Parede Gelo',
    sizeClass: 'w-11 h-11',
    shape: 'box',
    renderPreview: () => <IconGlooSvg className="w-6 h-6" />,
  },
  sprintBtn: {
    label: 'Correr Auto',
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
    label: 'Joystick',
    sizeClass: 'w-24 h-24',
    shape: 'circle',
    renderPreview: () => (
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full border border-current/70 bg-current/25" />
        <span className="text-[8px] font-black mt-0.5">ANDAR</span>
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
    label: 'Ações (Loot/Salvar)',
    sizeClass: 'w-40 h-8',
    shape: 'box',
    renderPreview: () => (
      <span className="text-[8px] font-black">[E] LOOT · SALVAR · SALTAR</span>
    ),
  },
};

export const HudEditorModal: React.FC<HudEditorModalProps> = ({
  layout,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<HudLayoutConfig>(() =>
    structuredCloneLayout(layout),
  );
  const [selected, setSelected] = useState<HudElementId>('fireBtn');
  const [showFinePos, setShowFinePos] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<HudElementId | null>(null);

  // Global release safety so dragging never stays stuck if pointer leaves window
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

  const handleStagePointerMove = (e: React.PointerEvent) => {
    const id = draggingRef.current;
    const stage = stageRef.current;
    if (!id || !stage) return;
    const rect = stage.getBoundingClientRect();
    const xPct = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(3, Math.min(97, ((e.clientY - rect.top) / rect.height) * 100));
    setDraft((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        xPct: Math.round(xPct * 10) / 10,
        yPct: Math.round(yPct * 10) / 10,
      },
    }));
  };

  const handleStagePointerUp = () => {
    draggingRef.current = null;
  };

  const applyPreset = (preset: 'classic' | 'claw3' | 'compact' | 'large') => {
    const next = structuredCloneLayout(DEFAULT_HUD_LAYOUT);
    if (preset === 'claw3') {
      next.fireBtn = { xPct: 16, yPct: 26, scale: 1.3, opacity: 0.95 };
      next.aimBtn = { xPct: 86, yPct: 50, scale: 1.15, opacity: 0.95 };
      next.jumpBtn = { xPct: 86, yPct: 68, scale: 1.1, opacity: 0.92 };
      next.crouchBtn = { xPct: 74, yPct: 82, scale: 1.05, opacity: 0.92 };
      next.glooBtn = { xPct: 74, yPct: 66, scale: 1.15, opacity: 0.95 };
    } else if (preset === 'compact') {
      ELEMENT_ORDER.forEach((k) => {
        next[k].scale = 0.8;
        next[k].opacity = 0.7;
      });
    } else if (preset === 'large') {
      ELEMENT_ORDER.forEach((k) => {
        next[k].scale = k === 'topBanner' || k === 'hpBar' ? 1.05 : 1.25;
        next[k].opacity = 0.95;
      });
    }
    setDraft(next);
  };

  const applyOpacityToAll = (opacity: number) => {
    setDraft((prev) => {
      const next = structuredCloneLayout(prev);
      ELEMENT_ORDER.forEach((k) => {
        next[k].opacity = opacity;
      });
      return next;
    });
  };

  const applyScaleToAll = (scale: number) => {
    setDraft((prev) => {
      const next = structuredCloneLayout(prev);
      ELEMENT_ORDER.forEach((k) => {
        next[k].scale = scale;
      });
      return next;
    });
  };

  const resetSelectedElement = () => {
    setDraft((prev) => ({
      ...prev,
      [selected]: { ...DEFAULT_HUD_LAYOUT[selected] },
    }));
  };

  const selItem = draft[selected];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0c1016] text-white select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#161c24] border-b-2 border-amber-500">
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-amber-400">
            HUD PERSONALIZADO TOTAL
          </span>
          <span className="hidden lg:inline text-[11px] text-neutral-400 font-mono">
            (Arraste qualquer item · Salvo no navegador)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[10px] sm:text-[11px]">
          <button
            type="button"
            onClick={() => applyPreset('classic')}
            className="px-2 py-1 bg-[#222b38] hover:bg-[#2d3848] border border-neutral-600 font-bold uppercase cursor-pointer"
          >
            Clássico 2017
          </button>
          <button
            type="button"
            onClick={() => applyPreset('claw3')}
            className="px-2 py-1 bg-[#222b38] hover:bg-[#2d3848] border border-neutral-600 font-bold uppercase cursor-pointer"
          >
            3 Dedos
          </button>
          <button
            type="button"
            onClick={() => applyPreset('compact')}
            className="px-2 py-1 bg-[#222b38] hover:bg-[#2d3848] border border-neutral-600 font-bold uppercase cursor-pointer"
          >
            Compacto
          </button>
          <button
            type="button"
            onClick={() => applyPreset('large')}
            className="px-2 py-1 bg-[#222b38] hover:bg-[#2d3848] border border-neutral-600 font-bold uppercase cursor-pointer"
          >
            Grande
          </button>
          <button
            type="button"
            onClick={() => setDraft(structuredCloneLayout(DEFAULT_HUD_LAYOUT))}
            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 flex items-center gap-1 uppercase cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Tudo</span>
          </button>
        </div>
      </div>

      {/* Quick Element Picker Strip */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-[#10151c] border-b border-neutral-800 overflow-x-auto">
        <span className="text-[10px] font-mono text-neutral-400 uppercase shrink-0 mr-1">
          Item:
        </span>
        {ELEMENT_ORDER.map((id) => {
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap border cursor-pointer transition-colors ${
                active
                  ? 'bg-amber-500 text-black border-amber-200'
                  : 'bg-[#1a222d] text-neutral-300 border-neutral-700 hover:border-neutral-500'
              }`}
            >
              {ELEMENT_META[id].label}
            </button>
          );
        })}
      </div>

      {/* Interactive Drag Stage */}
      <div
        ref={stageRef}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerLeave={handleStagePointerUp}
        className="relative flex-1 overflow-hidden touch-none"
        style={{
          background:
            'linear-gradient(180deg, #4b84b8 0%, #7cb2d6 45%, #5b6d3c 46%, #3f4e2b 100%)',
        }}
      >
        {/* Subtle Grid */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Crosshair guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-5 h-5 rounded-full border border-white/60" />
        </div>

        {ELEMENT_ORDER.map((id) => {
          const meta = ELEMENT_META[id];
          const cfg = draft[id];
          const isSel = selected === id;
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
              title={`${meta.label} (${Math.round(cfg.xPct)}%, ${Math.round(cfg.yPct)}%)`}
              className={`absolute ${meta.sizeClass} ${
                meta.shape === 'circle' ? 'rounded-full' : 'rounded-sm'
              } flex items-center justify-center text-center px-1 cursor-grab active:cursor-grabbing border-2 ${
                isSel
                  ? 'bg-amber-500/85 text-black border-white shadow-[0_0_18px_rgba(245,158,11,0.95)] z-20'
                  : 'bg-[#14181e]/80 text-white border-amber-400/65 z-10'
              }`}
            >
              {meta.renderPreview()}
            </div>
          );
        })}
      </div>

      {/* Bottom Selected Control Inspector */}
      <div className="bg-[#161c24] border-t-2 border-neutral-700 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="min-w-[140px]">
            <div className="text-[10px] text-neutral-400 uppercase font-mono">
              SELECIONADO
            </div>
            <div className="font-black text-amber-400 uppercase text-xs">
              {ELEMENT_META[selected].label}
            </div>
            <div className="text-[10px] font-mono text-neutral-400">
              X: {selItem.xPct.toFixed(1)}% · Y: {selItem.yPct.toFixed(1)}%
            </div>
          </div>

          {/* Tamanho Slider (40% .. 200%) */}
          <div className="w-36 sm:w-40">
            <div className="flex justify-between text-[10px] font-bold mb-0.5">
              <span>TAMANHO</span>
              <span className="text-amber-400 tabular-nums">
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
                setDraft((prev) => ({
                  ...prev,
                  [selected]: { ...prev[selected], scale: Number(e.target.value) },
                }))
              }
              className="w-full accent-amber-500"
            />
            <button
              type="button"
              onClick={() => applyScaleToAll(selItem.scale)}
              className="text-[9px] font-mono text-amber-300/90 hover:text-amber-200 underline cursor-pointer"
            >
              Aplicar tamanho em todos
            </button>
          </div>

          {/* Transparência Slider (10% .. 100%) */}
          <div className="w-36 sm:w-40">
            <div className="flex justify-between text-[10px] font-bold mb-0.5">
              <span>TRANSPARÊNCIA</span>
              <span className="text-amber-400 tabular-nums">
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
                setDraft((prev) => ({
                  ...prev,
                  [selected]: { ...prev[selected], opacity: Number(e.target.value) },
                }))
              }
              className="w-full accent-amber-500"
            />
            <button
              type="button"
              onClick={() => applyOpacityToAll(selItem.opacity)}
              className="text-[9px] font-mono text-amber-300/90 hover:text-amber-200 underline cursor-pointer"
            >
              Aplicar opacidade em todos
            </button>
          </div>

          {/* Toggle Fine X/Y Sliders */}
          <button
            type="button"
            onClick={() => setShowFinePos((v) => !v)}
            className={`px-2.5 py-1.5 border text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer ${
              showFinePos
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-[#202834] border-neutral-600 text-neutral-300 hover:text-white'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>Posição Fina</span>
          </button>

          {showFinePos && (
            <div className="flex items-center gap-3 bg-[#10151c] border border-neutral-700 px-2.5 py-1">
              <div className="w-24">
                <div className="flex justify-between text-[9px] font-mono">
                  <span>X</span>
                  <span className="text-amber-300">{selItem.xPct.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={98}
                  step={0.5}
                  value={selItem.xPct}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [selected]: { ...prev[selected], xPct: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-amber-500"
                />
              </div>
              <div className="w-24">
                <div className="flex justify-between text-[9px] font-mono">
                  <span>Y</span>
                  <span className="text-amber-300">{selItem.yPct.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={97}
                  step={0.5}
                  value={selItem.yPct}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [selected]: { ...prev[selected], yPct: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={resetSelectedElement}
            className="px-2.5 py-1.5 bg-[#202834] hover:bg-[#2a3444] border border-neutral-600 text-[10px] font-bold uppercase cursor-pointer"
          >
            Reset Item
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-[#232b36] hover:bg-[#2f3a48] border border-neutral-600 font-bold uppercase flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancelar</span>
          </button>
          <button
            type="button"
            onClick={() => onSave(structuredCloneLayout(draft))}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar HUD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
