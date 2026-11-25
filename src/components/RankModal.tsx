import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Check,
  Crosshair,
  Diamond,
  Globe,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import {
  AVATAR_ANGELIC,
  AVATAR_EAGLE_EYE,
  getPlayerAvatar,
} from '../game/avatars';
import { soundEngine } from '../game/audio';
import { multiplayerClient } from '../game/multiplayerClient';
import {
  CURRENT_RANKED_SEASON_LABEL,
  MESTRE_MIN_PTS,
  PlayerAvatarId,
  PlayerProfile,
  RANK_LADDER,
  SEASON_1_REWARDS,
  getRankInfo,
} from '../game/types';
import { IconCoinSvg, RankEmblemSvg } from './HudIcons';

interface LeaderboardRow {
  publicId: string;
  nickname: string;
  level: number;
  rankPoints: number;
  wins: number;
  totalKills: number;
  matchesPlayed: number;
  avatarId?: PlayerAvatarId;
}

interface RankModalProps {
  profile: PlayerProfile;
  currentPublicId?: string;
  initialTab?: 'patentes' | 'season' | 'global';
  claimingRewardId?: string | null;
  seasonClaimFeedback?: string | null;
  onClaimSeason1Reward?: (rewardId: string) => void;
  onClose: () => void;
}

export const RankModal: React.FC<RankModalProps> = ({
  profile,
  currentPublicId,
  initialTab = 'patentes',
  claimingRewardId = null,
  seasonClaimFeedback = null,
  onClaimSeason1Reward,
  onClose,
}) => {
  const [tab, setTab] = useState<'patentes' | 'season' | 'global'>(initialTab);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [lbSource, setLbSource] = useState<string>('cloudsql');
  const [lbLoading, setLbLoading] = useState(false);
  const [lbError, setLbError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true);
    setLbError(null);
    try {
      const res = await multiplayerClient.getLeaderboard(50);
      setLeaderboard(Array.isArray(res.leaderboard) ? res.leaderboard : []);
      setLbSource(res.source || 'cloudsql');
    } catch (err) {
      setLbError(err instanceof Error ? err.message : 'Erro ao carregar Top Global.');
    } finally {
      setLbLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
    const unsub = multiplayerClient.subscribe((ev) => {
      if (ev.type === 'leaderboard_update') {
        void loadLeaderboard();
      }
    });
    return () => unsub();
  }, [loadLeaderboard]);

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

  const myGlobalPosition = currentPublicId
    ? leaderboard.findIndex((r) => r.publicId === currentPublicId) + 1
    : 0;

  const s1Peak = Math.max(profile.rankPoints, profile.s1PeakRankPoints ?? 0);
  const claimedSet = new Set(profile.s1ClaimedRewards ?? []);
  const claimableCount = SEASON_1_REWARDS.filter(
    (t) => s1Peak >= t.minPts && !claimedSet.has(t.id),
  ).length;
  const mestreUnlocked =
    s1Peak >= MESTRE_MIN_PTS ||
    (profile.unlockedAvatars ?? []).includes('angelic') ||
    (profile.unlockedAvatars ?? []).includes('eagle_eye');
  const mestrePct = Math.max(0, Math.min(100, Math.round((s1Peak / MESTRE_MIN_PTS) * 100)));

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
            <div>
              <h2 className="font-black text-sm tracking-widest uppercase text-amber-400 leading-none">
                RANKEADA · {CURRENT_RANKED_SEASON_LABEL}
              </h2>
              <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                Patentes reiniciadas no Bronze I (0 PTS) · Suba até Mestre!
              </p>
            </div>
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

        {/* Modal Tabs */}
        <div className="grid grid-cols-3 bg-[#0f1318] border-b border-neutral-700 text-[11px] sm:text-xs font-black uppercase">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick(650);
              setTab('patentes');
            }}
            className={`py-2.5 border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'patentes'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4 shrink-0" />
            <span>PATENTES ({RANK_LADDER.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick(700);
              setTab('season');
            }}
            className={`py-2.5 border-b-2 flex items-center justify-center gap-1.5 cursor-pointer relative ${
              tab === 'season'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
            <span>TEMPORADA S1</span>
            {claimableCount > 0 && (
              <span className="px-1.5 py-0.5 bg-emerald-400 text-black text-[9px] font-black leading-none">
                {claimableCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick(650);
              setTab('global');
              void loadLeaderboard();
            }}
            className={`py-2.5 border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'global'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span>TOP GLOBAL</span>
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {tab === 'patentes' && (
            <>
              {/* Active Rank Summary Card */}
              <div className="bg-[#0e1217] border border-amber-500/40 p-4 flex flex-col sm:flex-row items-center gap-4">
                <RankEmblemSvg
                  color={rank.color}
                  accent={rank.accent}
                  iconUrl={rank.iconUrl}
                  alt={rank.name}
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
                          : 'PATENTE MÁXIMA (MESTRE)'}
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

              {/* All 19 Rank Tiers (Bronze I -> Mestre) */}
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
                  TABELA DE PATENTES (BRONZE I AO MESTRE)
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
                          iconUrl={tier.iconUrl}
                          alt={tier.name}
                          className="w-9 h-9 shrink-0"
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
            </>
          )}

          {tab === 'season' && (
            <div className="space-y-4">
              {/* Season 1 Exclusive Mestre Spotlight */}
              <div className="bg-gradient-to-br from-[#1b1530] via-[#131824] to-[#0e1218] border-2 border-amber-400/75 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-amber-300">
                      PRIMEIRA TEMPORADA RANQUEADA
                    </div>
                    <h3 className="text-base sm:text-lg font-black uppercase text-white">
                      RECOMPENSAS DA TEMPORADA S1
                    </h3>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-[10px] text-neutral-400 uppercase">PICO NA S1</div>
                    <div className="text-base font-black text-amber-400 tabular-nums">
                      {s1Peak} / {MESTRE_MIN_PTS} PTS
                    </div>
                  </div>
                </div>

                {/* Progress bar toward Mestre */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-neutral-300 mb-1">
                    <span>Rumo ao Mestre S1</span>
                    <span>{mestreUnlocked ? 'MESTRE ALCANÇADO!' : `${mestrePct}%`}</span>
                  </div>
                  <div className="w-full h-2.5 bg-black/65 border border-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 via-yellow-300 to-emerald-400 transition-all"
                      style={{ width: `${mestrePct}%` }}
                    />
                  </div>
                </div>

                {/* Mestre Exclusive Avatars Showcase */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {[
                    {
                      id: 'angelic',
                      name: 'AVATAR ANGELICAL',
                      sub: 'Exclusivo Mestre S1 (Asa Angelical)',
                      url: AVATAR_ANGELIC,
                    },
                    {
                      id: 'eagle_eye',
                      name: 'AVATAR OLHO DE ÁGUIA',
                      sub: 'Exclusivo Mestre S1 (Águia S1/S2)',
                      url: AVATAR_EAGLE_EYE,
                    },
                  ].map((av) => (
                    <div
                      key={av.id}
                      className={`flex items-center gap-3 p-2.5 border ${
                        mestreUnlocked
                          ? 'bg-emerald-950/40 border-emerald-400/70'
                          : 'bg-black/45 border-amber-400/35'
                      }`}
                    >
                      <div className="relative w-14 h-14 border-2 border-amber-300/80 bg-black shrink-0 overflow-hidden">
                        <img
                          src={av.url}
                          alt={av.name}
                          className={`w-full h-full object-cover ${
                            mestreUnlocked ? '' : 'opacity-75'
                          }`}
                        />
                        {!mestreUnlocked && (
                          <span className="absolute bottom-0.5 right-0.5 bg-black/80 p-0.5 border border-amber-400/50">
                            <Lock className="w-3 h-3 text-amber-300" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-amber-300 truncate">
                          {av.name}
                        </div>
                        <div className="text-[10px] text-neutral-300 leading-snug">
                          {av.sub}
                        </div>
                        <div className="mt-1 text-[9px] font-mono uppercase">
                          {mestreUnlocked ? (
                            <span className="text-emerald-300 font-bold">DESBLOQUEADO</span>
                          ) : (
                            <span className="text-amber-200/80">Requer Mestre ({MESTRE_MIN_PTS} PTS)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {seasonClaimFeedback && (
                <div className="px-3 py-2 bg-emerald-950/80 border border-emerald-400 text-emerald-200 text-xs font-bold">
                  {seasonClaimFeedback}
                </div>
              )}

              {/* Season 1 Tier Milestone Rewards List */}
              <div className="space-y-2">
                {SEASON_1_REWARDS.map((tier) => {
                  const unlocked = s1Peak >= tier.minPts;
                  const claimed = claimedSet.has(tier.id);
                  const isBusy = claimingRewardId === tier.id;
                  const matchingRank =
                    RANK_LADDER.find((r) => r.name === tier.tierName) ?? RANK_LADDER[0];
                  const missingPts = Math.max(0, tier.minPts - s1Peak);

                  return (
                    <div
                      key={tier.id}
                      className={`p-3 border flex flex-wrap items-center justify-between gap-3 ${
                        claimed
                          ? 'bg-[#12181f] border-emerald-500/40'
                          : unlocked
                            ? 'bg-[#1c212b] border-amber-400'
                            : 'bg-[#11151c] border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <RankEmblemSvg
                          color={matchingRank.color}
                          accent={matchingRank.accent}
                          iconUrl={matchingRank.iconUrl}
                          alt={tier.tierName}
                          className="w-10 h-10 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-black uppercase text-white">
                              {tier.tierName}
                            </span>
                            <span className="text-[10px] font-mono text-amber-300">
                              {tier.minPts} PTS
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2.5 mt-1 text-[11px] font-mono">
                            <span className="inline-flex items-center gap-1 text-amber-200 font-bold">
                              <IconCoinSvg className="w-3.5 h-3.5 shrink-0" />
                              +{tier.goldReward} Ouro
                            </span>
                            {tier.gemsReward ? (
                              <span className="inline-flex items-center gap-1 text-sky-300 font-bold">
                                <Diamond className="w-3.5 h-3.5 fill-sky-400/35 shrink-0" />
                                +{tier.gemsReward} Diamantes
                              </span>
                            ) : null}
                            {tier.avatarIds && tier.avatarIds.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                                +2 Avatares Exclusivos
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {claimed ? (
                          <span className="px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/70 text-emerald-300 text-[10px] font-black uppercase inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>RESGATADO</span>
                          </span>
                        ) : unlocked ? (
                          <button
                            type="button"
                            disabled={Boolean(claimingRewardId)}
                            onClick={() => {
                              soundEngine.playUiConfirm();
                              onClaimSeason1Reward?.(tier.id);
                            }}
                            className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-black text-[11px] font-black uppercase tracking-wider cursor-pointer shadow"
                          >
                            {isBusy ? 'RESGATANDO...' : 'RESGATAR'}
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 bg-black/50 border border-neutral-700 text-neutral-400 text-[10px] font-mono uppercase inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>Falta {missingPts} PTS</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'global' && (
            <div className="space-y-3">
              {/* Leaderboard Header Bar */}
              <div className="bg-[#0e1217] border border-amber-500/40 p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black uppercase text-amber-300">
                    RANKING MUNDIAL POR PONTOS (TOP 50)
                  </div>
                  <div className="text-[10px] font-mono text-neutral-400">
                    Fonte:{' '}
                    {lbSource === 'cloudsql'
                      ? 'Cloud SQL'
                      : lbSource === 'supabase'
                        ? 'Supabase'
                        : 'Servidor'}
                    {myGlobalPosition > 0
                      ? ` · Sua posição: #${myGlobalPosition}`
                      : ` · Sua pontuação: ${profile.rankPoints} PTS`}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={lbLoading}
                  onClick={() => void loadLeaderboard()}
                  className="px-3 py-1.5 bg-[#1d232c] hover:bg-neutral-700 border border-neutral-600 text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${lbLoading ? 'animate-spin' : ''}`} />
                  <span>ATUALIZAR</span>
                </button>
              </div>

              {lbError && (
                <div className="px-3 py-2 bg-red-950/70 border border-red-500/60 text-red-200 text-xs font-mono">
                  {lbError}
                </div>
              )}

              {lbLoading && leaderboard.length === 0 ? (
                <div className="py-10 text-center text-xs font-mono text-neutral-400">
                  Carregando ranking global...
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="py-10 text-center text-xs font-mono text-neutral-400">
                  Nenhum jogador ranqueado registrado ainda. Jogue uma partida BR Ranqueada!
                </div>
              ) : (
                <div className="space-y-1.5">
                  {leaderboard.map((row, idx) => {
                    const pos = idx + 1;
                    const rk = getRankInfo(row.rankPoints);
                    const isSelf = Boolean(currentPublicId && row.publicId === currentPublicId);
                    const posBadgeClass =
                      pos === 1
                        ? 'bg-amber-400 text-black border-yellow-200'
                        : pos === 2
                          ? 'bg-slate-300 text-black border-white'
                          : pos === 3
                            ? 'bg-orange-500 text-black border-orange-300'
                            : 'bg-black/60 text-neutral-300 border-neutral-700';

                    return (
                      <div
                        key={`${row.publicId}-${pos}`}
                        className={`flex items-center justify-between gap-2 px-3 py-2 border ${
                          isSelf
                            ? 'bg-amber-500/20 border-amber-400'
                            : pos <= 3
                              ? 'bg-[#1a2029] border-amber-500/35'
                              : 'bg-[#151a22] border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 border flex items-center justify-center font-mono font-black text-xs shrink-0 ${posBadgeClass}`}
                          >
                            {pos}
                          </div>
                          <img
                            src={getPlayerAvatar(row.avatarId, 'adam')}
                            alt={row.nickname}
                            className="w-8 h-8 object-cover object-top border border-white/25 bg-black shrink-0"
                          />
                          <RankEmblemSvg
                            color={rk.color}
                            accent={rk.accent}
                            iconUrl={rk.iconUrl}
                            alt={rk.name}
                            className="w-7 h-7 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-xs text-white truncate">
                                {row.nickname}
                              </span>
                              {isSelf && (
                                <span className="px-1 py-0.5 bg-amber-400 text-black text-[8px] font-black uppercase">
                                  VOCÊ
                                </span>
                              )}
                              <span className="text-[9px] font-mono text-neutral-400">
                                #{row.publicId}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-2">
                              <span className="text-amber-300 font-bold">{rk.name}</span>
                              <span>· Nv.{row.level}</span>
                              <span>· {row.wins} Booyahs</span>
                              <span>· {row.totalKills} Abates</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          <div className="text-sm font-black text-amber-400 tabular-nums">
                            {row.rankPoints}
                          </div>
                          <div className="text-[9px] text-neutral-400">PTS</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-[#1d232c] border-t border-neutral-700 flex items-center justify-between text-[11px] font-mono text-neutral-400">
          <span>Na Rankeada S1 você sobe do Bronze I ao Mestre e ganha recompensas!</span>
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
