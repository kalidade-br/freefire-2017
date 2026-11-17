import React from 'react';
import { Award, Crosshair, Shield, Trophy, X } from 'lucide-react';
import { PlayerProfile, RANK_LADDER, getRankInfo } from '../game/types';
import { RankEmblemSvg } from './HudIcons';

interface RankModalProps {
  profile: PlayerProfile;
  onClose: () => void;
}

export const RankModal: React.FC<RankModalProps> = ({ profile, onClose }) => {
  const rank = getRankInfo(profile.rankPoints);
  const nextRank =
    rank.nextPts !== null
      ? RANK_LADDER.find((r) => r.minPts === rank.nextPts) ?? null
      : null;

  const tierProgress =
    rank.nextPts !== null
      ? Math.max(
          0,
          Math.min(
            100,
            ((profile.rankPoints - rank.minPts) / Math.max(1, rank.nextPts - rank.minPts)) *
              100,
          ),
        )
      : 100;

  const winRate =
    profile.rankedMatches > 0
      ? Math.round((profile.rankedWins / profile.rankedMatches) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 text-white"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#14181e] border-2 border-amber-500 shadow-2xl flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#1d232c] border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 className="font-black text-sm tracking-widest uppercase text-amber-400">
              TEMPORADA RANKEADA · PATENTES BR
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-700 cursor-pointer"
            aria-label="Fechar Patentes"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Active Rank Summary Card */}
          <div className="bg-[#0e1217] border border-amber-500/40 p-4 flex flex-col sm:flex-row items-center gap-4">
            <RankEmblemSvg
              color={rank.color}
              accent={rank.accent}
              className="w-16 h-16 shrink-0"
            />
            <div className="flex-1 w-full">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                    PATENTE ATUAL DE {profile.nickname}
                  </div>
                  <div className="text-xl font-black uppercase tracking-wide text-white">
                    {rank.name}{' '}
                    <span className="text-xs font-mono text-amber-300">({rank.sub})</span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="text-lg font-black text-amber-400 tabular-nums">
                    {profile.rankPoints}
                  </span>
                  <span className="text-xs text-neutral-400"> PTS</span>
                </div>
              </div>

              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                  <span>Progresso da Patente</span>
                  <span>
                    {nextRank
                      ? `Próxima: ${nextRank.name} (${rank.nextPts} pts)`
                      : 'PATENTE MÁXIMA'}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.round(tierProgress)}%`,
                      backgroundColor: rank.accent,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Career Ranked Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
            <div className="bg-[#181e27] border border-neutral-700 p-2.5">
              <div className="text-[10px] text-neutral-400 uppercase flex items-center justify-center gap-1">
                <Shield className="w-3 h-3 text-sky-400" />
                <span>Partidas Rank</span>
              </div>
              <div className="text-lg font-black text-white mt-0.5 tabular-nums">
                {profile.rankedMatches}
              </div>
            </div>
            <div className="bg-[#181e27] border border-neutral-700 p-2.5">
              <div className="text-[10px] text-neutral-400 uppercase flex items-center justify-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>Booyah! Rank</span>
              </div>
              <div className="text-lg font-black text-amber-400 mt-0.5 tabular-nums">
                {profile.rankedWins}
              </div>
            </div>
            <div className="bg-[#181e27] border border-neutral-700 p-2.5">
              <div className="text-[10px] text-neutral-400 uppercase">Taxa Vitória</div>
              <div className="text-lg font-black text-emerald-400 mt-0.5 tabular-nums">
                {winRate}%
              </div>
            </div>
            <div className="bg-[#181e27] border border-neutral-700 p-2.5">
              <div className="text-[10px] text-neutral-400 uppercase flex items-center justify-center gap-1">
                <Crosshair className="w-3 h-3 text-red-400" />
                <span>Abates Totais</span>
              </div>
              <div className="text-lg font-black text-white mt-0.5 tabular-nums">
                {profile.totalKills}
              </div>
            </div>
          </div>

          {/* All 12 Rank Tiers */}
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              TABELA DE PATENTES (12 NÍVEIS)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RANK_LADDER.map((tier) => {
                const isCurrent = tier.name === rank.name;
                const unlocked = profile.rankPoints >= tier.minPts;
                return (
                  <div
                    key={tier.name}
                    className={`flex items-center gap-2.5 p-2 border ${
                      isCurrent
                        ? 'bg-amber-500/20 border-amber-400'
                        : unlocked
                          ? 'bg-[#181e27] border-neutral-600'
                          : 'bg-[#10141a] border-neutral-800 opacity-60'
                    }`}
                  >
                    <RankEmblemSvg
                      color={tier.color}
                      accent={tier.accent}
                      className="w-8 h-8 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate">
                        {tier.name}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400">
                        {tier.minPts}+ PTS
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-[#1d232c] border-t border-neutral-700 flex items-center justify-between text-[11px] font-mono text-neutral-400">
          <span>Na Rankeada você pode ser eliminado e perder ou ganhar pontos!</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest cursor-pointer whitespace-nowrap"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};
