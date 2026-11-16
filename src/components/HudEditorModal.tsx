import React, { useRef, useState } from 'react';
import { RotateCcw, Save, X, Move } from 'lucide-react';
import {
  DEFAULT_HUD_LAYOUT,
  HudElementId,
  HudLayoutConfig,
} from '../game/types';
import { structuredCloneLayout } from '../game/storage';

interface HudEditorModalProps {
  layout: HudLayoutConfig;
  onSave: (next: HudLayoutConfig) => void;
  onClose: () => void;
}

const ELEMENT_LABELS: Record<HudElementId, { label: string; sizeClass: string; shape: 'box' | 'circle' }> = {
  minimap: { label: 'Minimapa', sizeClass: 'w-20 h-20', shape: 'box' },
  weapons: { label: 'Armas / Mira', sizeClass: 'w-28 h-12', shape: 'box' },
  hpBar: { label: 'Barra HP', sizeClass: 'w-40 h-7', shape: 'box' },
  joystick: { label: 'Joystick', sizeClass: 'w-20 h-20', shape: 'circle' },
  fireBtn: { label: 'Atirar', sizeClass: 'w-14 h-14', shape: 'circle' },
  aimBtn: { label: 'Mirar', sizeClass: 'w-11 h-11', shape: 'circle' },
  jumpBtn: { label: 'Pular', sizeClass: 'w-11 h-11', shape: 'circle' },
  crouchBtn: { label: 'Agachar', sizeClass: 'w-11 h-11', shape: 'circle' },
  proneBtn: { label: 'Deitar', sizeClass: 'w-11 h-11', shape: 'circle' },
  reloadBtn: { label: 'Recarregar', sizeClass: 'w-11 h-11', shape: 'circle' },
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<HudElementId | null>(null);

  const handleStagePointerMove = (e: React.PointerEvent) => {
    const id = draggingRef.current;
    const stage = stageRef.current;
    if (!id || !stage) return;
    const rect = stage.getBoundingClientRect();
    const xPct = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(6, Math.min(94, ((e.clientY - rect.top) / rect.height) * 100));
    setDraft((prev) => ({
      ...prev,
      [id]: { ...prev[id], xPct: Math.round(xPct * 10) / 10, yPct: Math.round(yPct * 10) / 10 },
    }));
  };

  const handleStagePointerUp = () => {
    draggingRef.current = null;
  };

  const applyPreset = (preset: 'classic' | 'claw3' | 'compact') => {
    const next = structuredCloneLayout(DEFAULT_HUD_LAYOUT);
    if (preset === 'claw3') {
      next.fireBtn = { xPct: 16, yPct: 26, scale: 1.25, opacity: 0.95 };
      next.aimBtn = { xPct: 86, yPct: 50, scale: 1.15, opacity: 0.95 };
      next.jumpBtn = { xPct: 86, yPct: 68, scale: 1.1, opacity: 0.9 };
      next.crouchBtn = { xPct: 74, yPct: 82, scale: 1.05, opacity: 0.9 };
    } else if (preset === 'compact') {
      (Object.keys(next) as HudElementId[]).forEach((k) => {
        next[k].scale = 0.85;
        next[k].opacity = 0.78;
      });
    }
    setDraft(next);
  };

  const selItem = draft[selected];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0c1016] text-white select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#161c24] border-b-2 border-amber-500">
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4 text-amber-400" />
          <span className="font-black text-xs sm:text-sm tracking-widest uppercase text-amber-400">
            EDITOR DE HUD PERSONALIZADO
          </span>
          <span className="hidden md:inline text-[11px] text-neutral-400 font-mono">
            (Arraste qualquer botão na tela)
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => applyPreset('classic')}
            className="px-2.5 py-1 bg-[#222b38] hover:bg-[#2d3848] border border-neutral-600 font-bold uppercase cursor-pointer"
          >
            Clássico 2017
          </button>
          <button
            type="button"
            onClick={() => applyPreset('claw3')}
            className="px-2.5 py-1 bg-[#222b38] hover:bg-[#2d3848] border border-neutral-600 font-bold uppercase cursor-pointer"
          >
            HUD 3 Dedos
          </button>
          <button
            type="button"
            onClick={() => applyPreset('compact')}
            className="px-2.5 py-1 bg-[#222b38] hover:bg-[#2d3848] border border-neutral-600 font-bold uppercase cursor-pointer"
          >
            Compacto
          </button>
          <button
            type="button"
            onClick={() => setDraft(structuredCloneLayout(DEFAULT_HUD_LAYOUT))}
            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 flex items-center gap-1 uppercase cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
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
              'linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Crosshair guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-5 h-5 rounded-full border border-white/60" />
        </div>

        {(Object.keys(ELEMENT_LABELS) as HudElementId[]).map((id) => {
          const meta = ELEMENT_LABELS[id];
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
              className={`absolute ${meta.sizeClass} ${
                meta.shape === 'circle' ? 'rounded-full' : 'rounded-sm'
              } flex items-center justify-center text-center px-1 text-[10px] font-black uppercase cursor-grab active:cursor-grabbing border-2 ${
                isSel
                  ? 'bg-amber-500/80 text-black border-white shadow-[0_0_16px_rgba(245,158,11,0.9)] z-20'
                  : 'bg-[#14181e]/85 text-white border-amber-400/60 z-10'
              }`}
            >
              {meta.label}
            </div>
          );
        })}
      </div>

      {/* Bottom Selected Control Inspector */}
      <div className="bg-[#161c24] border-t-2 border-neutral-700 px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <div className="text-[10px] text-neutral-400 uppercase font-mono">
              ELEMENTO SELECIONADO
            </div>
            <div className="font-black text-amber-400 uppercase">
              {ELEMENT_LABELS[selected].label} ({Math.round(selItem.xPct)}%, {Math.round(selItem.yPct)}%)
            </div>
          </div>

          <div className="w-40">
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span>TAMANHO</span>
              <span className="text-amber-400 tabular-nums">
                {Math.round(selItem.scale * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.6}
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
          </div>

          <div className="w-40">
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span>TRANSPARÊNCIA</span>
              <span className="text-amber-400 tabular-nums">
                {Math.round(selItem.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.3}
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
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#232b36] hover:bg-[#2f3a48] border border-neutral-600 font-bold uppercase flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancelar</span>
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar HUD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
