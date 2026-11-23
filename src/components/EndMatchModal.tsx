import React from 'react';
import { Trophy, Skull, RotateCcw, Home } from 'lucide-react';
import { GameState, HudSnapshot, getRankInfo } from '../game/types';
import { RankEmblemSvg } from './HudIcons';

interface EndMatchModalProps {
  state: GameState.WIN | GameState.GAMEOVER;
  hud: HudSnapshot;
  isRanked: boolean;
  rankPoints: number;
  rankDelta: number | null;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

export const EndMatchModal: React.FC<EndMatchModalProps> = ({
  state,
  hud,
  isRanked,
  rankPoints,
  rankDelta,
  onPlayAgain,
  onReturnLobby,
}) => {
  const isWin = state === GameState.WIN;
  const isGladiadores = hud.gameVariant === 'gladiadores' && Boolean(hud.gladiadores);
  const rank = getRankInfo(rankPoints);
  const placement = isWin ? 1 : Math.max(2, hud.aliveCount);

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
            {isGladiadores && hud.gladiadores
              ? `GLADIADORES ${hud.gladiadores.format.toUpperCase()} · META ${hud.gladiadores.targetRounds} RODADAS`
              : isWin
                ? 'BOOYAH! POSIÇÃO #1 / 51'
                : `ELIMINADO · #${placement} / 51`}
          </div>
          <h2
            className={`text-3xl font-black uppercase tracking-wider ${
              isWin ? 'text-amber-400' : 'text-red-500'
            }`}
          >
            {isGladiadores
              ? isWin
                ? 'CAMPEÃO DA ARENA!'
                : 'DERROTA NA ARENA'
              : isWin
                ? 'VITÓRIA! SOBREVIVENTE #1'
                : 'FIM DE PARTIDA'}
          </h2>
        </div>

        {/* Gladiadores Final Round Scoreboard */}
        {isGladiadores && hud.gladiadores && (
          <div className="bg-[#0e1217] border border-red-500/45 p-4 flex items-center justify-around font-mono">
            <div>
              <div className="text-[10px] text-emerald-300 uppercase font-bold">VOCÊ</div>
              <div className="text-3xl font-black text-emerald-400 tabular-nums">
                {hud.gladiadores.playerScore}
              </div>
            </div>
            <div className="text-lg font-black text-neutral-500">X</div>
            <div>
              <div className="text-[10px] text-red-300 uppercase font-bold">INIMIGO</div>
              <div className="text-3xl font-black text-red-400 tabular-nums">
                {hud.gladiadores.enemyScore}
              </div>
            </div>
          </div>
        )}

        {/* Ranked Delta Card (BR Ranqueado only) */}
        {!isGladiadores && isRanked && (
          <div className="bg-[#0e1217] border border-amber-500/45 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-left">
              <RankEmblemSvg
                color={rank.color}
                accent={rank.accent}
                className="w-10 h-10 shrink-0"
              />
              <div>
                <div className="text-[10px] font-mono uppercase text-neutral-400">
                  PATENTE RANKEADA
                </div>
                <div className="text-sm font-black uppercase text-white">
                  {rank.name}
                </div>
              </div>
            </div>

            <div className="text-right font-mono">
              {rankDelta !== null && (
                <div
                  className={`text-base font-black tabular-nums ${
                    rankDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {rankDelta >= 0 ? `+${rankDelta}` : rankDelta} PTS
                </div>
              )}
              <div className="text-xs text-amber-300 font-bold tabular-nums">
                Total: {rankPoints} PTS
              </div>
            </div>
          </div>
        )}

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
