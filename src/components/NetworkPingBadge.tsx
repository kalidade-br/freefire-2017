import React from 'react';

interface NetworkPingBadgeProps {
  pingMs: number;
  disconnected: boolean;
  compact?: boolean;
}

const WIFI_CONNECTED_SRC = '/assets/aistudio/7263427_88bee5e4.png';
const WIFI_DISCONNECTED_SRC = '/assets/aistudio/7535882_b7b43e30.png';

export const NetworkPingBadge: React.FC<NetworkPingBadgeProps> = ({
  pingMs,
  disconnected,
  compact = false,
}) => {
  const isLost = disconnected || pingMs >= 999;

  const colorHex = isLost
    ? '#ef4444'
    : pingMs <= 90
      ? '#34d399'
      : pingMs <= 200
        ? '#fbbf24'
        : '#fb923c';

  const textClass = isLost
    ? 'text-red-500'
    : pingMs <= 90
      ? 'text-emerald-400'
      : pingMs <= 200
        ? 'text-amber-300'
        : 'text-orange-400';

  const borderClass = isLost
    ? 'border-red-500/90 bg-red-950/80 animate-pulse'
    : 'border-white/25 bg-black/70';

  const iconSrc = isLost ? WIFI_DISCONNECTED_SRC : WIFI_CONNECTED_SRC;
  const label = isLost ? '999+' : `${Math.max(1, Math.round(pingMs))}ms`;

  return (
    <div
      className={`flex items-center gap-1 border whitespace-nowrap shrink-0 tabular-nums font-mono font-black ${borderClass} ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
      }`}
      title={
        isLost
          ? 'Conexão perdida (999+ ms)'
          : `Latência atual: ${Math.max(1, Math.round(pingMs))} ms`
      }
    >
      <span
        aria-hidden="true"
        className={compact ? 'w-3.5 h-3.5 inline-block shrink-0' : 'w-4 h-4 inline-block shrink-0'}
        style={{
          backgroundColor: colorHex,
          WebkitMaskImage: `url(${iconSrc})`,
          maskImage: `url(${iconSrc})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
      <span className={textClass}>{label}</span>
    </div>
  );
};
