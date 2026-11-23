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
  headshotFlashActive,
}) => {
  // Padrão ('none') & Mira 1x: Moldura aberta estilo reflex/holográfica com PONTO pequeno e translúcido no centro exato da tela
  if (scope === 'none' || scope === '1x') {
    const dotColor = aimLockedTarget
      ? 'rgba(239,68,68,0.58)'
      : 'rgba(56,189,248,0.52)';
    const dotGlow = aimLockedTarget
      ? '0 0 3px 0.5px rgba(239,68,68,0.34)'
      : '0 0 3px 0.5px rgba(56,189,248,0.32)';

    return (
      <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div className="relative w-[200px] h-[195px] sm:w-[240px] sm:h-[225px] flex items-center justify-center">
          <svg
            viewBox="0 0 240 225"
            className="w-full h-full overflow-visible drop-shadow-[0_6px_14px_rgba(0,0,0,0.82)]"
          >
            <defs>
              <linearGradient id="reflexFrame" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#20242b" />
                <stop offset="50%" stopColor="#0f1216" />
                <stop offset="100%" stopColor="#1c2026" />
              </linearGradient>
              <radialGradient id="reflexGlass" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(56,189,248,0.02)" />
                <stop offset="82%" stopColor="rgba(168,85,247,0.06)" />
                <stop offset="100%" stopColor="rgba(168,85,247,0.24)" />
              </radialGradient>
            </defs>

            {/* Outer reflex metallic housing centered around exact screen center (120, 112.5) */}
            <path
              d="M 55 42 Q 120 32 185 42 C 204 46 216 90 214 130 C 212 164 184 182 120 182 C 56 182 28 164 26 130 C 24 90 36 46 55 42 Z"
              fill="none"
              stroke="url(#reflexFrame)"
              strokeWidth="15"
            />
            {/* Subtle purple glass rim reflection */}
            <path
              d="M 59 49 Q 120 40 181 49 C 197 53 207 91 205 128 C 203 158 177 173 120 173 C 63 173 37 158 35 128 C 33 91 43 53 59 49 Z"
              fill="url(#reflexGlass)"
              stroke="rgba(192,132,252,0.34)"
              strokeWidth="2.2"
            />
            {/* Bottom compact weapon sight mount */}
            <path
              d="M 52 176 L 188 176 L 198 208 L 42 208 Z"
              fill="#111419"
              stroke="#2c313a"
              strokeWidth="2"
            />
            <rect x="64" y="202" width="112" height="72" rx="4" fill="#14181f" stroke="#262b33" strokeWidth="2" />
          </svg>

          {/* Exact screen-center tiny translucent dot matching raycast (50%, 50%) */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[3.5px] h-[3.5px] rounded-full"
            style={{
              backgroundColor: dotColor,
              boxShadow: dotGlow,
            }}
          />

          {headshotFlashActive && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 font-black text-2xl drop-shadow-[0_0_4px_#000]">
              ✕
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mira 2x: Tubo preto com torres laterais + PONTO NO MEIO COM UM CÍRCULO EM VOLTA
  if (scope === '2x') {
    const reticleColor = aimLockedTarget ? '#ff2a2a' : '#ef4444';

    return (
      <div
        className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center"
        style={{
          background:
            'radial-gradient(circle 180px at center, transparent 0%, rgba(12,15,18,0.12) 78%, rgba(4,6,8,0.68) 96%, rgba(0,0,0,0.88) 100%)',
        }}
      >
        <div className="relative w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] flex items-center justify-center">
          <svg
            viewBox="0 0 360 360"
            className="w-full h-full overflow-visible drop-shadow-[0_10px_28px_rgba(0,0,0,0.9)]"
          >
            <defs>
              <radialGradient id="lens2x" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="rgba(0,0,0,0)" />
                <stop offset="93%" stopColor="rgba(0,0,0,0.34)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.82)" />
              </radialGradient>
            </defs>

            {/* Top & Right Turret Knobs */}
            <rect x="132" y="-14" width="96" height="24" rx="4" fill="#181b20" stroke="#30353f" strokeWidth="2" />
            <rect x="348" y="132" width="24" height="96" rx="4" fill="#181b20" stroke="#30353f" strokeWidth="2" />
            {/* Bottom Gun Rail Mount */}
            <rect x="108" y="340" width="144" height="90" rx="4" fill="#12151a" stroke="#252930" strokeWidth="2" />

            {/* Lens vignette */}
            <circle cx="180" cy="180" r="146" fill="url(#lens2x)" />

            {/* Heavy cylindrical black scope barrel */}
            <circle cx="180" cy="180" r="160" fill="none" stroke="#0c0e12" strokeWidth="28" />
            <circle cx="180" cy="180" r="146" fill="none" stroke="#262b33" strokeWidth="3" />
            <circle cx="180" cy="180" r="174" fill="none" stroke="#1e222a" strokeWidth="2" />

            {/* Exact 2x Reticle: Tiny translucent dot in center + thin ring around it */}
            <circle
              cx="180"
              cy="180"
              r="11"
              fill="none"
              stroke={reticleColor}
              strokeWidth="1.2"
              strokeOpacity={0.56}
              style={{ filter: 'drop-shadow(0 0 2px rgba(239,68,68,0.34))' }}
            />
            <circle
              cx="180"
              cy="180"
              r="1.3"
              fill={reticleColor}
              fillOpacity={0.54}
              style={{ filter: 'drop-shadow(0 0 2px rgba(239,68,68,0.38))' }}
            />
          </svg>

          {headshotFlashActive && (
            <div className="absolute text-red-500 font-black text-2xl drop-shadow-[0_0_4px_#000]">
              ✕
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mira 4x: Aro preto + contorno interno laranja + LINHAS PRETAS com ticks + "V" (^ chevron) verde/ciano no centro
  if (scope === '4x') {
    const vColor = aimLockedTarget ? '#ff3b3b' : '#10b981';

    return (
      <div
        className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center"
        style={{
          background:
            'radial-gradient(circle 195px at center, transparent 0%, rgba(8,10,12,0.16) 76%, rgba(0,0,0,0.82) 95%, #000 100%)',
        }}
      >
        <div className="relative w-[330px] h-[330px] sm:w-[400px] sm:h-[400px] flex items-center justify-center">
          <svg
            viewBox="0 0 400 400"
            className="w-full h-full overflow-visible drop-shadow-[0_12px_32px_rgba(0,0,0,0.95)]"
          >
            <defs>
              <radialGradient id="lens4x" cx="50%" cy="50%" r="50%">
                <stop offset="72%" stopColor="rgba(0,0,0,0)" />
                <stop offset="94%" stopColor="rgba(0,0,0,0.42)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.88)" />
              </radialGradient>
            </defs>

            {/* Outer rugged bezel + inner warm orange ring (classic 4x look) */}
            <circle cx="200" cy="200" r="158" fill="url(#lens4x)" />

            {/* Black horizontal & vertical stadia lines (leaving clean gap around center V) */}
            <line x1="42" y1="200" x2="184" y2="200" stroke="#0b0d10" strokeWidth="1.5" strokeOpacity={0.78} />
            <line x1="216" y1="200" x2="358" y2="200" stroke="#0b0d10" strokeWidth="1.5" strokeOpacity={0.78} />
            <line x1="200" y1="214" x2="200" y2="358" stroke="#0b0d10" strokeWidth="1.5" strokeOpacity={0.78} />

            {/* Small black tick marks along horizontal line */}
            {[-120, -96, -72, -48, -28, 28, 48, 72, 96, 120].map((dx) => (
              <line
                key={dx}
                x1={200 + dx}
                y1="195"
                x2={200 + dx}
                y2="205"
                stroke="#0b0d10"
                strokeWidth="1.8"
              />
            ))}

            {/* Small black tick marks along lower vertical post */}
            {[30, 52, 74, 96].map((dy) => (
              <line
                key={dy}
                x1="196"
                y1={200 + dy}
                x2="204"
                y2={200 + dy}
                stroke="#0b0d10"
                strokeWidth="1.6"
              />
            ))}

            {/* Fine translucent green/cyan chevron "V" apex at exact dead-center (200, 200) */}
            <path
              d="M 195 205 L 200 199 L 205 205"
              fill="none"
              stroke={vColor}
              strokeWidth="1.35"
              strokeOpacity={0.58}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                filter: aimLockedTarget
                  ? 'drop-shadow(0 0 2px rgba(255,59,59,0.4))'
                  : 'drop-shadow(0 0 2px rgba(16,185,129,0.4))',
              }}
            />

            {/* Outer housing ring + subtle orange accent rim */}
            <circle cx="200" cy="200" r="176" fill="none" stroke="#0a0c10" strokeWidth="36" />
            <circle cx="200" cy="200" r="159" fill="none" stroke="rgba(234,88,12,0.72)" strokeWidth="2.2" />
            <circle cx="200" cy="200" r="192" fill="none" stroke="#1f242c" strokeWidth="2.5" />
          </svg>

          {headshotFlashActive && (
            <div className="absolute text-red-500 font-black text-2xl drop-shadow-[0_0_4px_#000]">
              ✕
            </div>
          )}
        </div>
      </div>
    );
  }

  // Luneta AWM 8x: Cruz completa de LINHAS PRETAS graduadas + PONTO NO MEIO (vermelho)
  const centerDotColor = aimLockedTarget ? '#ff2424' : '#ef4444';

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center"
      style={{
        background:
          'radial-gradient(circle 210px at center, transparent 0%, rgba(4,6,8,0.14) 76%, rgba(0,0,0,0.92) 94%, #000 100%)',
      }}
    >
      <div className="relative w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] flex items-center justify-center">
        <svg
          viewBox="0 0 420 420"
          className="w-full h-full overflow-visible drop-shadow-[0_14px_34px_rgba(0,0,0,0.98)]"
        >
          <defs>
            <radialGradient id="lens8x" cx="50%" cy="50%" r="50%">
              <stop offset="72%" stopColor="rgba(0,0,0,0)" />
              <stop offset="93%" stopColor="rgba(0,0,0,0.45)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.92)" />
            </radialGradient>
          </defs>

          {/* Top & Right Sniper Turrets + Bottom Mount */}
          <rect x="166" y="-14" width="88" height="22" rx="4" fill="#14171c" stroke="#2c313a" strokeWidth="2" />
          <rect x="410" y="166" width="22" height="88" rx="4" fill="#14171c" stroke="#2c313a" strokeWidth="2" />
          <rect x="130" y="398" width="160" height="84" rx="4" fill="#101216" stroke="#242830" strokeWidth="2" />

          <circle cx="210" cy="210" r="172" fill="url(#lens8x)" />

          {/* Full fine black crosshairs */}
          <line x1="38" y1="210" x2="382" y2="210" stroke="#08090b" strokeWidth="1.25" strokeOpacity={0.78} />
          <line x1="210" y1="38" x2="210" y2="382" stroke="#08090b" strokeWidth="1.25" strokeOpacity={0.78} />

          {/* Thicker outer black bezel stadia posts */}
          <line x1="38" y1="210" x2="96" y2="210" stroke="#050608" strokeWidth="4.2" />
          <line x1="324" y1="210" x2="382" y2="210" stroke="#050608" strokeWidth="4.2" />
          <line x1="210" y1="324" x2="210" y2="382" stroke="#050608" strokeWidth="4.2" />

          {/* Horizontal mil-dot ticks */}
          {[-105, -80, -55, -30, 30, 55, 80, 105].map((dx) => (
            <line
              key={`h_${dx}`}
              x1={210 + dx}
              y1="205"
              x2={210 + dx}
              y2="215"
              stroke="#08090b"
              strokeWidth="1.8"
            />
          ))}

          {/* Upper vertical ticks */}
          {[-90, -60, -30].map((dy) => (
            <line
              key={`vu_${dy}`}
              x1="205"
              y1={210 + dy}
              x2="215"
              y2={210 + dy}
              stroke="#08090b"
              strokeWidth="1.8"
            />
          ))}

          {/* Lower rangefinder horizontal stadia bars (matching AWM screenshot) */}
          {[28, 48, 70, 94, 120].map((dy, idx) => {
            const halfW = 10 + idx * 5;
            return (
              <line
                key={`vl_${dy}`}
                x1={210 - halfW}
                y1={210 + dy}
                x2={210 + halfW}
                y2={210 + dy}
                stroke="#08090b"
                strokeWidth="1.8"
              />
            );
          })}

          {/* Tiny translucent central red dot */}
          <circle
            cx="210"
            cy="210"
            r="1.4"
            fill={centerDotColor}
            fillOpacity={0.55}
            style={{ filter: 'drop-shadow(0 0 2px rgba(239,68,68,0.4))' }}
          />

          {/* Outer black scope frame */}
          <circle cx="210" cy="210" r="190" fill="none" stroke="#080a0d" strokeWidth="36" />
          <circle cx="210" cy="210" r="172" fill="none" stroke="#2a2f38" strokeWidth="2.5" />
          <circle cx="210" cy="210" r="206" fill="none" stroke="#1a1e25" strokeWidth="2" />
        </svg>

        {headshotFlashActive && (
          <div className="absolute text-red-500 font-black text-3xl drop-shadow-[0_0_4px_#000]">
            ✕
          </div>
        )}
      </div>
    </div>
  );
};
