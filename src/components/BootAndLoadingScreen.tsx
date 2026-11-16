import React from 'react';
import { soundEngine } from '../game/audio';
import { GameState } from '../game/types';

interface BootAndLoadingProps {
  state: GameState.BOOT | GameState.LOADING;
  progress: number;
  statusText: string;
}

export const BootAndLoadingScreen: React.FC<BootAndLoadingProps> = ({
  state,
  progress,
  statusText,
}) => {
  return (
    <div
      onPointerDown={() => soundEngine.unlock()}
      className="fixed inset-0 z-50 bg-black text-white select-none overflow-hidden"
    >
      {/* Clean Nostalgic Widescreen Bermuda Loading Artwork */}
      <img
        src="/assets/loading_bg.jpg"
        alt="Carregando Free Fire Bermuda"
        className="w-full h-full object-cover object-center"
      />

      {/* Bottom atmospheric scrim + iconic amber-orange Free Fire loading bar */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-16 pb-5 px-6 sm:px-10">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="flex items-center justify-between text-xs font-mono tracking-wider uppercase text-amber-100">
            <span>{state === GameState.BOOT ? 'INICIALIZANDO SISTEMA...' : statusText}</span>
            <span className="text-amber-400 font-black tabular-nums">
              {state === GameState.BOOT ? '...' : `${progress}%`}
            </span>
          </div>

          <div className="w-full h-3.5 bg-neutral-900/95 border border-amber-400/50 p-0.5 shadow-lg">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 transition-[width] duration-200"
              style={{ width: `${state === GameState.BOOT ? 12 : progress}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-neutral-300 pt-0.5">
            <span>
              DICA: No modo Duo ou Squad, inimigos derrubados ficam se arrastando — finalize antes que fujam!
            </span>
            <span className="text-amber-300/90 font-bold">FREE FIRE CLÁSSICO</span>
          </div>
        </div>
      </div>
    </div>
  );
};
