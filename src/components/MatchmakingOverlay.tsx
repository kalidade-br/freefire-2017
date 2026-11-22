import React from 'react';
import { X } from 'lucide-react';
import { MatchMode } from '../game/types';

interface MatchmakingOverlayProps {
  playerCount: number;
  matchMode: MatchMode;
  isOnline?: boolean;
  onCancel: () => void;
}

export const MatchmakingOverlay: React.FC<MatchmakingOverlayProps> = ({
  playerCount,
  matchMode,
  isOnline = false,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4 text-white">
      <div className="w-full max-w-sm bg-[#14181e]/95 border-2 border-amber-500 p-5 text-center space-y-4 shadow-2xl">
        <div className="text-xs font-mono uppercase tracking-[0.22em] text-amber-400">
          PREPARANDO PARTIDA {matchMode.toUpperCase()}
        </div>
        <div className="text-2xl font-black tracking-wider uppercase">
          {isOnline ? 'CONECTANDO AO SERVIDOR' : 'BUSCANDO SOBREVIVENTES'}
        </div>

        <div className="bg-[#0e1217] border border-neutral-700 py-3 px-4">
          <div className="text-3xl font-black font-mono tabular-nums text-amber-400">
            {playerCount} / 51
          </div>
          <div className="text-[11px] font-mono text-neutral-400 mt-1">
            BERMUDA · {matchMode.toUpperCase()} {isOnline ? '· MULTIPLAYER ONLINE' : '(BOTS)'}
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
        >
          <X className="w-4 h-4 text-red-400" />
          <span>CANCELAR</span>
        </button>
      </div>
    </div>
  );
};
