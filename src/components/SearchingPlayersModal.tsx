import React, { useEffect, useState } from 'react';
import { Radio, RefreshCw, Users, X } from 'lucide-react';
import { getPlayerAvatar } from '../game/avatars';
import { soundEngine } from '../game/audio';
import { getRankInfo } from '../game/types';
import { SearchingPoolInfo } from '../shared/multiplayerTypes';
import { RankEmblemSvg } from './HudIcons';

interface SearchingPlayersModalProps {
  pools: SearchingPoolInfo[];
  currentPoolKey: string | null;
  currentAccountId: number | null;
  isPartyLeader: boolean;
  joiningPoolKey: string | null;
  errorMsg: string | null;
  onRefresh: () => void;
  onJoinPool: (poolKey: string) => void;
  onClose: () => void;
}

function formatSearchClock(startedAtMs: number, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}:${String(rem).padStart(2, '0')}`;
}

export const SearchingPlayersModal: React.FC<SearchingPlayersModalProps> = ({
  pools,
  currentPoolKey,
  currentAccountId,
  isPartyLeader,
  joiningPoolKey,
  errorMsg,
  onRefresh,
  onJoinPool,
  onClose,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const totalSearching = pools.reduce((acc, p) => acc + p.players.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 text-white">
      <div className="w-full max-w-xl max-h-[85vh] flex flex-col bg-[#12161d] border-2 border-amber-400 shadow-2xl">
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/15 bg-black/40">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-300">
                JOGADORES BUSCANDO PARTIDA
              </h2>
              <p className="text-[10px] font-mono text-neutral-400">
                Clique em JUNTAR-SE para cair na mesma partida (janela de 10s–20s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(680);
                onRefresh();
              }}
              title="Atualizar lista"
              className="p-1.5 bg-black/60 hover:bg-white/10 border border-white/20 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(480);
                onClose();
              }}
              className="p-1.5 bg-black/60 hover:bg-red-900/80 border border-white/20 cursor-pointer"
            >
              <X className="w-4 h-4 text-neutral-200" />
            </button>
          </div>
        </header>

        {errorMsg && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-950/90 border border-red-500 text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {totalSearching === 0 ? (
            <div className="py-10 px-4 text-center border border-white/10 bg-black/30 space-y-2">
              <Users className="w-8 h-8 text-neutral-500 mx-auto" />
              <div className="text-sm font-black uppercase text-neutral-200">
                Nenhum jogador buscando no momento
              </div>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Ao clicar em <strong className="text-amber-300">INICIAR</strong> no lobby, sua busca fica visível aqui por 10s–20s para outros jogadores entrarem, ou inicia automaticamente com bots.
              </p>
            </div>
          ) : (
            pools.map((pool) => {
              const isMine = currentPoolKey === pool.poolKey;
              const isJoining = joiningPoolKey === pool.poolKey;
              const mapLabel = 'Bermuda';
              return (
                <div
                  key={pool.poolKey}
                  className={`border p-3 bg-black/45 space-y-2.5 ${
                    isMine ? 'border-emerald-400/80' : 'border-white/15'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-400/60 text-[10px] font-black uppercase text-amber-300">
                        {pool.isRanked ? 'RANQUEADA' : 'CLÁSSICO'}
                      </span>
                      <span className="text-xs font-black uppercase text-white">
                        {pool.mode.toUpperCase()} · {mapLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-300 tabular-nums">
                        {formatSearchClock(pool.startedAtMs, nowMs)}
                      </span>
                      {isMine ? (
                        <span className="px-2.5 py-1 bg-emerald-950 border border-emerald-400 text-[10px] font-black uppercase text-emerald-300">
                          SUA BUSCA
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!isPartyLeader || Boolean(joiningPoolKey)}
                          onClick={() => {
                            soundEngine.playUiConfirm();
                            onJoinPool(pool.poolKey);
                          }}
                          className="px-3 py-1 bg-amber-400 hover:bg-amber-300 disabled:bg-neutral-700 disabled:text-neutral-400 text-black text-[10px] font-black uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isJoining ? 'ENTRANDO...' : 'JUNTAR-SE'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {pool.players.map((p) => {
                      const rank = getRankInfo(p.rankPoints);
                      const isSelf = currentAccountId !== null && p.accountId === currentAccountId;
                      return (
                        <div
                          key={`${pool.poolKey}-${p.accountId}`}
                          className="flex items-center justify-between gap-2 bg-[#161c26] border border-white/10 px-2 py-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={getPlayerAvatar(p.avatarId, p.characterModelId)}
                              alt={p.nickname}
                              className="w-7 h-7 object-cover object-top border border-white/25 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-black text-white truncate">
                                {p.nickname} {isSelf ? '(Você)' : ''}
                              </div>
                              <div className="text-[10px] font-mono text-neutral-400">
                                Nv.{p.level} · {rank.name}
                              </div>
                            </div>
                          </div>
                          <RankEmblemSvg
                            color={rank.color}
                            accent={rank.accent}
                            iconUrl={rank.iconUrl}
                            alt={rank.name}
                            className="w-5 h-5 shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
