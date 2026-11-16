import React from 'react';
import { ScopeType } from '../game/types';

interface ScopeOverlayProps {
  scope: ScopeType;
  aimLockedTarget: boolean;
  aimAssistActive: boolean;
  headshotFlashActive: boolean;
}

export const ScopeOverlay: React.FC<ScopeOverlayProps> = ({
  scope,
  aimLockedTarget,
  aimAssistActive,
  headshotFlashActive,
}) => {
  if (scope === 'none') return null;

  const lockColor = aimLockedTarget ? '#ef4444' : '#f8fafc';

  // 1x (Mira Aberta / Ponto Vermelho): roda preta fina estilo luneta + 4 setas apontando ao centro
  if (scope === '1x') {
    return (
      <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div
          className="relative w-[290px] h-[290px] rounded-full border-[14px] border-[#0a0c0f] shadow-[0_0_0_9999px_rgba(0,0,0,0.42),inset_0_0_24px_rgba(0,0,0,0.75)] flex items-center justify-center"
        >
          <div className="absolute inset-2 rounded-full border border-white/15" />

          {/* 4 setas / chevrons apontando para o centro */}
          <div
            className="w-3 h-3 border-r-2 border-b-2 rotate-45 absolute top-7"
            style={{ borderColor: aimLockedTarget ? '#f87171' : 'rgba(255,255,255,0.72)' }}
          />
          <div
            className="w-3 h-3 border-l-2 border-t-2 rotate-45 absolute bottom-7"
            style={{ borderColor: aimLockedTarget ? '#f87171' : 'rgba(255,255,255,0.72)' }}
          />
          <div
            className="w-3 h-3 border-t-2 border-r-2 rotate-45 absolute left-7"
            style={{ borderColor: aimLockedTarget ? '#f87171' : 'rgba(255,255,255,0.72)' }}
          />
          <div
            className="w-3 h-3 border-b-2 border-l-2 rotate-45 absolute right-7"
            style={{ borderColor: aimLockedTarget ? '#f87171' : 'rgba(255,255,255,0.72)' }}
          />

          {/* Ponto central (fica vermelho brilhante quando inimigo está na área) */}
          <div
            className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_2px_rgba(239,68,68,0.85)]"
            style={{ backgroundColor: aimLockedTarget ? '#ff2424' : '#ef4444' }}
          />
          {headshotFlashActive && (
            <div className="absolute text-amber-300 font-black text-2xl">✕</div>
          )}
          <div className="absolute -bottom-8 px-2 py-0.5 bg-black/80 border border-neutral-700 text-[10px] font-mono text-amber-300">
            MIRA 1X {aimAssistActive ? '· GRUDA' : ''}
          </div>
        </div>
      </div>
    );
  }

  if (scope === '2x') {
    return (
      <div
        className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center"
        style={{
          background:
            'radial-gradient(circle 165px at center, rgba(16,28,24,0.05) 0%, rgba(12,18,16,0.2) 84%, rgba(5,7,9,0.95) 94%, #000 100%)',
        }}
      >
        <div className="relative w-[330px] h-[330px] rounded-full border-[12px] border-[#0a0c0f] flex items-center justify-center">
          <div className="absolute w-full h-[1px] bg-black/75" />
          <div className="absolute h-full w-[1px] bg-black/75" />
          {/* Setas direcionais da 2x */}
          <div className="absolute top-6 w-2.5 h-2.5 border-r-2 border-b-2 rotate-45 border-emerald-400/80" />
          <div className="absolute bottom-6 w-2.5 h-2.5 border-l-2 border-t-2 rotate-45 border-emerald-400/80" />
          <div className="absolute left-6 w-2.5 h-2.5 border-t-2 border-r-2 rotate-45 border-emerald-400/80" />
          <div className="absolute right-6 w-2.5 h-2.5 border-b-2 border-l-2 rotate-45 border-emerald-400/80" />

          <div className="absolute w-14 h-[2px] bg-emerald-400/90" />
          <div className="absolute h-14 w-[2px] bg-emerald-400/90" />
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: aimLockedTarget ? '#ef4444' : '#34d399' }}
          />
          {headshotFlashActive && (
            <div className="absolute text-amber-300 font-black text-2xl">✕</div>
          )}
          <div className="absolute bottom-5 px-2 py-0.5 bg-black/75 text-[10px] font-mono text-emerald-300 border border-emerald-500/40">
            MIRA 2X {aimAssistActive ? '· GRUDA' : ''}
          </div>
        </div>
      </div>
    );
  }

  if (scope === '4x') {
    return (
      <div
        className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center"
        style={{
          background:
            'radial-gradient(circle 160px at center, transparent 0%, rgba(10,12,16,0.18) 82%, rgba(0,0,0,0.97) 93%, #000 100%)',
        }}
      >
        <div className="relative w-[320px] h-[320px] rounded-full border-[12px] border-black flex items-center justify-center">
          <div className="absolute w-full h-[1px] bg-black/85" />
          <div className="absolute h-full w-[1px] bg-black/85" />
          {[-44, -22, 22, 44].map((offset) => (
            <React.Fragment key={offset}>
              <div
                className="absolute w-[1px] h-2.5 bg-black/90"
                style={{ transform: `translateX(${offset}px)` }}
              />
              <div
                className="absolute h-[1px] w-3 bg-black/90"
                style={{ transform: `translateY(${offset}px)` }}
              />
            </React.Fragment>
          ))}
          {/* Seta / chevron central estilo 4x */}
          <div
            className="w-3 h-3 rotate-45 border-t-2 border-l-2"
            style={{
              borderColor: aimLockedTarget ? '#ef4444' : '#f59e0b',
            }}
          />
          {headshotFlashActive && (
            <div className="absolute text-amber-300 font-black text-2xl">✕</div>
          )}
          <div className="absolute bottom-5 px-2 py-0.5 bg-black/80 text-[10px] font-mono text-amber-300 border border-amber-500/50">
            MIRA 4X {aimAssistActive ? '· GRUDA' : ''}
          </div>
        </div>
      </div>
    );
  }

  // Sniper 8x Scope (Manual Skill — NO Aim Assist)
  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center"
      style={{
        background:
          'radial-gradient(circle 195px at center, transparent 0%, rgba(6,10,14,0.12) 85%, rgba(0,0,0,0.99) 93%, #000 100%)',
      }}
    >
      <div className="relative w-[390px] h-[390px] rounded-full border-[12px] border-black flex items-center justify-center">
        <div className="absolute left-0 w-24 h-[3px] bg-black" />
        <div className="absolute right-0 w-24 h-[3px] bg-black" />
        <div className="absolute bottom-0 h-24 w-[3px] bg-black" />
        <div className="absolute w-full h-[1px] bg-black/90" />
        <div className="absolute h-full w-[1px] bg-black/90" />
        {[-60, -40, -20, 20, 40, 60].map((pos) => (
          <React.Fragment key={pos}>
            <div
              className="absolute w-1 h-1 rounded-full bg-black"
              style={{ transform: `translateX(${pos}px)` }}
            />
            <div
              className="absolute w-1 h-1 rounded-full bg-black"
              style={{ transform: `translateY(${pos}px)` }}
            />
          </React.Fragment>
        ))}
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: lockColor }}
        />
        {headshotFlashActive && (
          <div className="absolute text-amber-300 font-black text-3xl">✕</div>
        )}
        <div className="absolute bottom-6 px-2.5 py-0.5 bg-black/85 border border-purple-400/50 text-[10px] font-mono text-purple-200 tracking-wider">
          AWM 8X · MIRA MANUAL
        </div>
      </div>
    </div>
  );
};
