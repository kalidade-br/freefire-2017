import React from 'react';
import { Trophy, Skull, RotateCcw, Home } from 'lucide-react';
import { GameState, HudSnapshot } from '../game/types';

interface EndMatchModalProps {
  state: GameState.WIN | GameState.GAMEOVER;
  hud: HudSnapshot;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

export const EndMatchModal: React.FC<EndMatchModalProps> = ({
  state,
  hud,
  onPlayAgain,
  onReturnLobby,
}) => {
  const isWin = state === GameState.WIN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 text-white">
      <div
        className={`w-full max-w-md bg-[#14181e] border-2 p-6 text-center space-y-5 shadow-2xl ${
          isWin ? 'border-amber-400' : 'border-red-600'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          {isWin ? (
            <Trophy className="w-12 h-12 text-amber-400" />
          ) : (
            <Skull className="w-12 h-12 text-red-500" />
          )}
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-neutral-400">
            {isWin ? 'POSIÇÃO #1 / 40' : `ELIMINADO · #${hud.aliveCount} / 40`}
          </div>
          <h2
            className={`text-3xl font-black uppercase tracking-wider ${
              isWin ? 'text-amber-400' : 'text-red-500'
            }`}
          >
            {isWin ? 'VITÓRIA! SOBREVIVENTE #1' : 'FIM DE PARTIDA'}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-[#0e1217] border border-neutral-700 p-4 text-xs font-mono">
          <div>
            <div className="text-neutral-400">ABATES / ALVOS</div>
            <div className="text-xl font-black text-white tabular-nums mt-0.5">
              {hud.kills}
            </div>
          </div>
          <div>
            <div className="text-neutral-400">DANO CAUSADO</div>
            <div className="text-xl font-black text-amber-400 tabular-nums mt-0.5">
              {hud.damageDealt}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onReturnLobby}
            className="py-3 bg-[#1d232c] hover:bg-[#28313e] border border-neutral-600 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>LOBBY</span>
          </button>
          <button
            type="button"
            onClick={onPlayAgain}
            className="py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>JOGAR NOVAMENTE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
