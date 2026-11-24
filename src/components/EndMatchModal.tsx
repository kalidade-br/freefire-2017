import React, { useEffect, useMemo, useState } from 'react';
import { Award, Crosshair, Shield, Skull, Star, Trophy } from 'lucide-react';
import {
  CharacterModelId,
  GameState,
  HudSnapshot,
  getRankInfo,
} from '../game/types';
import { getCharacterAvatar } from '../game/avatars';
import { soundEngine } from '../game/audio';
import { RankEmblemSvg } from './HudIcons';

type EndStage = 'booyah_field' | 'rank_progress' | 'team_summary';

interface EndMatchModalProps {
  state: GameState.WIN | GameState.GAMEOVER;
  hud: HudSnapshot;
  isRanked: boolean;
  prevRankPoints: number;
  rankPoints: number;
  rankDelta: number | null;
  playerNickname: string;
  playerModelId?: CharacterModelId;
  onReturnLobby: () => void;
}

function formatSurvivalTime(totalSec: number): string {
  const safe = Math.max(0, Math.round(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}'${String(secs).padStart(2, '0')}"`;
}

function computeMemberScore(params: {
  isWin: boolean;
  placement: number;
  kills: number;
  damage: number;
  healing: number;
  survivalSec: number;
}): number {
  const { isWin, placement, kills, damage, healing, survivalSec } = params;
  const base = isWin ? 8.2 : Math.max(2.0, 7.2 - (placement - 1) * 0.12);
  const score =
    base +
    Math.min(4.2, kills * 0.34) +
    Math.min(2.6, damage / 1400) +
    Math.min(0.8, healing / 300) +
    Math.min(0.9, survivalSec / 700);
  return Math.min(16.0, Math.max(1.5, Math.round(score * 10) / 10));
}

export const EndMatchModal: React.FC<EndMatchModalProps> = ({
  state,
  hud,
  isRanked,
  prevRankPoints,
  rankPoints,
  rankDelta,
  playerNickname,
  playerModelId,
  onReturnLobby,
}) => {
  const isWin = state === GameState.WIN;
  const isGladiadores = hud.gameVariant === 'gladiadores' && Boolean(hud.gladiadores);
  const totalPlayers = Math.max(2, hud.totalMatchPlayers || 51);
  const placement = isWin ? 1 : Math.max(2, hud.playerPlacement ?? hud.aliveCount);
  const hasRankFlow = !isGladiadores && (isRanked || isWin);

  const [stage, setStage] = useState<EndStage>(() => {
    if (isWin) return 'booyah_field';
    if (!isGladiadores && isRanked) return 'rank_progress';
    return 'team_summary';
  });

  const [booyahCountdown, setBooyahCountdown] = useState(6);
  const [animatedPoints, setAnimatedPoints] = useState(prevRankPoints);

  // Release pointer lock cleanly on match end
  useEffect(() => {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore
      }
    }
  }, []);

  // Stage 1: Booyah music playback + countdown timer -> auto-advance to Stage 2 when music ends
  useEffect(() => {
    if (stage !== 'booyah_field') {
      soundEngine.stopBooyahMusic();
      return;
    }

    let cancelled = false;
    setBooyahCountdown(6);

    soundEngine.playBooyahMusic(
      () => {
        if (cancelled) return;
        setStage(hasRankFlow ? 'rank_progress' : 'team_summary');
      },
      (durSec) => {
        if (cancelled) return;
        setBooyahCountdown(Math.max(1, Math.ceil(durSec)));
      },
    );

    const tick = window.setInterval(() => {
      setBooyahCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(tick);
      soundEngine.stopBooyahMusic();
    };
  }, [stage, hasRankFlow]);

  // Stage 2: Real-time smooth point & progress bar animation
  useEffect(() => {
    if (stage !== 'rank_progress') return;
    setAnimatedPoints(prevRankPoints);

    if (prevRankPoints === rankPoints) return;

    let rafId = 0;
    const startDelayMs = 260;
    const durationMs = 1750;
    const mountedAt = performance.now();

    const step = (now: number) => {
      const elapsed = now - mountedAt - startDelayMs;
      if (elapsed <= 0) {
        rafId = requestAnimationFrame(step);
        return;
      }
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedPoints(prevRankPoints + (rankPoints - prevRankPoints) * eased);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setAnimatedPoints(rankPoints);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [stage, prevRankPoints, rankPoints]);

  const battleRating = useMemo(
    () =>
      computeMemberScore({
        isWin,
        placement,
        kills: hud.kills,
        damage: hud.damageDealt,
        healing: hud.healingDone,
        survivalSec: hud.matchSurvivalSec,
      }),
    [isWin, placement, hud.kills, hud.damageDealt, hud.healingDone, hud.matchSurvivalSec],
  );

  const surpassedPct = useMemo(() => {
    if (isWin) return '99.4';
    const pct = Math.max(5, Math.min(98.5, ((totalPlayers - placement) / (totalPlayers - 1)) * 100));
    return pct.toFixed(1);
  }, [isWin, placement, totalPlayers]);

  const medalLabel = isWin
    ? 'Medalha de Ouro recebida'
    : placement <= 10
      ? 'Medalha de Prata recebida'
      : 'Medalha de Combate';

  const displayDelta = rankDelta ?? 0;
  const startRank = getRankInfo(prevRankPoints);
  const currentRank = getRankInfo(animatedPoints);
  const finalRank = getRankInfo(rankPoints);
  const rankedUp =
    rankPoints > prevRankPoints &&
    currentRank.minPts > startRank.minPts;

  const tierSpan =
    currentRank.nextPts !== null ? Math.max(1, currentRank.nextPts - currentRank.minPts) : 100;
  const barFillPct =
    currentRank.nextPts !== null
      ? Math.max(0, Math.min(100, ((animatedPoints - currentRank.minPts) / tierSpan) * 100))
      : 100;
  const baseFillPct =
    currentRank.id === startRank.id && currentRank.name === startRank.name && currentRank.nextPts !== null
      ? Math.max(0, Math.min(barFillPct, ((prevRankPoints - currentRank.minPts) / tierSpan) * 100))
      : 0;

  // Score breakdown summing accurately to displayDelta (or battle score breakdown if casual)
  const scoreBreakdown = useMemo(() => {
    const targetTotal = displayDelta;
    if (!isRanked || targetTotal <= 0) {
      return [
        { label: 'Bônus de Booyah', val: isWin ? 5 : 0 },
        { label: 'Pontuação Ranqueada', val: targetTotal },
        { label: 'Pontuação de Batalha', val: Math.round(battleRating * 2) },
      ];
    }
    const medalPts = Math.min(targetTotal, isWin ? 20 : placement <= 10 ? 10 : 4);
    const booyahPts = isWin ? Math.min(targetTotal - medalPts, 5) : 0;
    const missionPts = Math.min(targetTotal - medalPts - booyahPts, 15);
    const rem = Math.max(0, targetTotal - medalPts - booyahPts - missionPts);
    const rankedPts = Math.ceil(rem * 0.58);
    const battlePts = Math.max(0, rem - rankedPts);
    return [
      { label: medalLabel, val: medalPts, highlight: true },
      ...(booyahPts > 0 ? [{ label: 'Bônus de Booyah', val: booyahPts }] : []),
      ...(missionPts > 0 ? [{ label: 'Pontuação de Missão Diária', val: missionPts }] : []),
      { label: 'Pontuação Ranqueada', val: rankedPts },
      { label: 'Pontuação de Batalha', val: battlePts },
    ];
  }, [displayDelta, isRanked, isWin, placement, battleRating, medalLabel]);

  const arsenalRows = useMemo(() => {
    if (hud.weaponDamageStats.length > 0) {
      return hud.weaponDamageStats.map((w) => ({
        name: w.name,
        points: Math.max(15, Math.round(w.damage / 12)),
      }));
    }
    const equipped = [hud.weapons[1], hud.weapons[2], hud.weapons[3]].filter(Boolean);
    if (equipped.length > 0) {
      return equipped.slice(0, 3).map((w) => ({
        name: w!.weaponId.toUpperCase(),
        points: isWin ? 25 : 10,
      }));
    }
    return [{ name: 'G18', points: isWin ? 25 : 10 }];
  }, [hud.weaponDamageStats, hud.weapons, isWin]);

  const roleBadges = useMemo(() => {
    const roles: Array<{ name: string; pts: number }> = [];
    if (hud.damageDealt >= 400 || hud.kills >= 3) roles.push({ name: 'Rushador', pts: 7 });
    roles.push({ name: 'Fuzileiro', pts: 7 });
    if (hud.healingDone >= 75) roles.push({ name: 'Médico', pts: 5 });
    return roles.slice(0, 3);
  }, [hud.damageDealt, hud.kills, hud.healingDone]);

  const teamRows = useMemo(() => {
    if (hud.teamMembers.length > 0) {
      return hud.teamMembers.map((m) => {
        const isLocal = m.id === 'player';
        const kills = isLocal ? hud.kills : m.kills ?? 0;
        const dmg = isLocal ? hud.damageDealt : m.damageDealt ?? 0;
        const heal = isLocal ? hud.healingDone : m.healingDone ?? 0;
        const surv = isLocal ? hud.matchSurvivalSec : m.survivalSec ?? hud.matchSurvivalSec;
        const model = isLocal ? playerModelId : m.modelId;
        const score = computeMemberScore({
          isWin,
          placement,
          kills,
          damage: dmg,
          healing: heal,
          survivalSec: surv,
        });
        return {
          id: m.id,
          slot: m.slotNumber,
          nick: m.nick,
          isLocal,
          kills,
          dmg,
          heal,
          surv,
          model,
          score,
        };
      });
    }
    return [
      {
        id: 'player',
        slot: 1,
        nick: playerNickname,
        isLocal: true,
        kills: hud.kills,
        dmg: hud.damageDealt,
        heal: hud.healingDone,
        surv: hud.matchSurvivalSec,
        model: playerModelId,
        score: battleRating,
      },
    ];
  }, [
    hud.teamMembers,
    hud.kills,
    hud.damageDealt,
    hud.healingDone,
    hud.matchSurvivalSec,
    playerNickname,
    playerModelId,
    isWin,
    placement,
    battleRating,
  ]);

  const modeTitle = isGladiadores
    ? `GLADIADORES ${hud.gladiadores?.format.toUpperCase() ?? ''}`
    : isRanked
      ? 'BR RANQUEADO'
      : 'BR CLÁSSICO';
  const mapTitle = hud.mapId === 'joao_pessoa' ? 'JOÃO PESSOA' : 'BERMUDA';

  // =========================================================================
  // STAGE 1: LIVE BATTLEFIELD BOOYAH OVERLAY (Screenshot 4)
  // =========================================================================
  if (stage === 'booyah_field') {
    return (
      <div className="fixed inset-0 z-50 pointer-events-auto select-none">
        {/* Top-center glowing BOOYAH banner */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[min(680px,92vw)] flex flex-col items-center">
          <div className="relative w-full py-2 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-700/85 to-transparent blur-[1px]" />
            <div className="absolute inset-x-10 inset-y-0.5 bg-gradient-to-r from-transparent via-amber-500/85 to-transparent" />
            <div className="absolute inset-x-12 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
            <div className="absolute inset-x-12 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
            <h1 className="relative text-3xl sm:text-5xl font-black tracking-[0.14em] text-white uppercase drop-shadow-[0_2px_12px_rgba(251,191,36,0.9)]">
              {isGladiadores ? 'BOOYAH!' : 'BOOYAH'}
            </h1>
          </div>
          {isGladiadores && hud.gladiadores && (
            <div className="mt-1 px-4 py-0.5 bg-black/70 border border-amber-400/50 text-amber-300 text-xs font-black tracking-widest uppercase">
              ARENA {hud.gladiadores.playerScore} X {hud.gladiadores.enemyScore}
            </div>
          )}
        </div>

        {/* Left-side compact score card */}
        <div className="absolute left-4 sm:left-7 top-1/2 -translate-y-1/2 w-56 sm:w-64 bg-gradient-to-b from-[#3d3420]/85 to-[#1f1c14]/90 border border-amber-400/55 shadow-2xl backdrop-blur-sm text-white overflow-hidden">
          <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-amber-300/25">
            <div className="flex items-baseline font-black tracking-tight">
              <span className="text-2xl sm:text-3xl text-amber-400">#1</span>
              <span className="text-lg sm:text-xl text-neutral-300">/{totalPlayers}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 border border-amber-400/70 text-amber-300 text-xs font-black tabular-nums">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{battleRating.toFixed(1)}</span>
            </div>
          </div>

          <div className="px-3.5 py-2.5 space-y-1.5 text-xs font-bold tracking-wide">
            <div className="flex items-center justify-between">
              <span className="text-neutral-200 uppercase">PONTUAÇÃO</span>
              <span className="tabular-nums">
                <span className="text-white">{prevRankPoints}</span>{' '}
                {isRanked ? (
                  <span className={displayDelta >= 0 ? 'text-amber-400' : 'text-red-400'}>
                    {displayDelta >= 0 ? `+${displayDelta}` : displayDelta}
                  </span>
                ) : (
                  <span className="text-amber-400">+{hud.kills * 10 + 50} XP</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-200 uppercase">ABATER</span>
              <span className="text-white tabular-nums">{hud.kills}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-300">
              <span className="uppercase">DANO / CURA</span>
              <span className="tabular-nums">
                {hud.damageDealt} / {hud.healingDone}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom-right: ONLY the return button (no Jogar Outra) */}
        <div className="absolute right-4 sm:right-8 bottom-5 sm:bottom-7">
          <button
            type="button"
            onClick={() => {
              soundEngine.stopBooyahMusic();
              soundEngine.playUiClick(620);
              setStage(hasRankFlow ? 'rank_progress' : 'team_summary');
            }}
            className="min-w-[148px] px-7 py-2.5 bg-[#eceff4] hover:bg-white active:scale-[0.98] text-[#14181e] font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl border border-white/80 cursor-pointer transition-transform"
          >
            VOLTAR {booyahCountdown > 0 ? `(${booyahCountdown}s)` : ''}
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STAGE 2: RANK PROGRESSION & REAL-TIME BAR FILL (Screenshots 1 & 2)
  // =========================================================================
  if (stage === 'rank_progress') {
    const headlineHighlight = scoreBreakdown[0];
    const otherRows = scoreBreakdown.slice(1);

    return (
      <div
        onClick={() => {
          soundEngine.playUiClick(580);
          setStage('team_summary');
        }}
        className="fixed inset-0 z-50 flex flex-col justify-between bg-[#090d14]/88 backdrop-blur-md text-white select-none cursor-pointer overflow-hidden"
      >
        {/* Atmospheric background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`w-[580px] h-[340px] rounded-full blur-3xl transition-all duration-700 ${
              rankedUp ? 'bg-blue-500/35 scale-110' : 'bg-indigo-600/25'
            }`}
          />
        </div>

        {/* Top Header */}
        <div className="relative z-10 px-6 sm:px-10 pt-4 flex items-start justify-between">
          <div>
            <div className="text-sm sm:text-base font-black tracking-wider text-neutral-100 uppercase">
              {modeTitle}
            </div>
            <div className="text-[11px] font-mono text-neutral-400 uppercase">{mapTitle}</div>
          </div>
          {!isWin && (
            <div className="text-right">
              <div className="text-xl font-black text-red-400">
                #{placement}/{totalPlayers}
              </div>
            </div>
          )}
        </div>

        {/* Main 3-Column Stage */}
        <div className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-12 items-center gap-4">
          {/* Left: DETALHES DE PONTUAÇÃO */}
          <div className="md:col-span-4 space-y-2.5 self-end md:self-center pb-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              <span className="w-0.5 h-4 bg-amber-400 inline-block" />
              <span>DETALHES DE PONTUAÇÃO</span>
            </div>

            {headlineHighlight && (
              <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-500/50 via-amber-600/25 to-transparent border-l-2 border-amber-400 shadow">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-amber-500 text-black text-[11px] font-black tabular-nums">
                    {battleRating.toFixed(1)}
                  </span>
                  <span className="text-xs font-bold text-amber-100">
                    {headlineHighlight.label}
                  </span>
                </div>
                <span className="text-xs font-black text-amber-300 tabular-nums">
                  +{headlineHighlight.val}
                </span>
              </div>
            )}

            <div className="space-y-1.5 px-1 text-xs">
              {otherRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between text-neutral-300 border-b border-white/5 pb-1"
                >
                  <span>{row.label}</span>
                  <span className="font-bold text-white tabular-nums">
                    {row.val >= 0 ? `+${row.val}` : row.val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Center: Animated Rank Ribbon Card */}
          <div className="md:col-span-4 flex justify-center">
            <div
              className="relative w-[240px] sm:w-[270px] pt-6 pb-10 px-6 flex flex-col items-center text-center shadow-2xl border-t border-white/20"
              style={{
                background:
                  'linear-gradient(180deg, rgba(64,74,104,0.92) 0%, rgba(145,51,71,0.94) 55%, rgba(206,42,68,0.96) 100%)',
                clipPath: 'polygon(0 0, 100% 0, 100% 89%, 0 100%)',
              }}
            >
              <div
                className={`text-xl sm:text-2xl font-black uppercase tracking-wider transition-all duration-300 ${
                  rankedUp ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]' : 'text-neutral-200'
                }`}
              >
                {currentRank.name.toUpperCase()}
              </div>

              <div className="h-7 mt-1.5 flex items-center justify-center">
                {rankedUp ? (
                  <div className="px-3 py-0.5 bg-black/55 border border-amber-400/80 text-amber-300 text-[11px] font-black tracking-widest uppercase shadow-md animate-pulse">
                    AVANÇO DE PATENTE
                  </div>
                ) : (
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/65">
                    {currentRank.sub}
                  </div>
                )}
              </div>

              <div
                className={`my-5 transition-transform duration-500 ${
                  rankedUp ? 'scale-110' : 'scale-100'
                }`}
              >
                <RankEmblemSvg
                  color={currentRank.color}
                  accent={currentRank.accent}
                  className="w-24 h-24 drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
                />
              </div>

              {/* Real-time Score + Progress Bar */}
              <div className="w-full space-y-2 mt-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-1.5 text-white/90">
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center">
                      <Star className="w-2.5 h-2.5 fill-black" />
                    </span>
                    <span className="tracking-wider uppercase">PONTUAÇÃO</span>
                  </div>
                  <div className="tabular-nums font-black">
                    <span className="text-white">{Math.round(animatedPoints)}</span>{' '}
                    {isRanked && (
                      <span className={displayDelta >= 0 ? 'text-amber-300' : 'text-red-300'}>
                        {displayDelta >= 0 ? `+${displayDelta}` : displayDelta}
                      </span>
                    )}
                  </div>
                </div>

                {/* Real-time animated progress bar */}
                <div className="relative w-full h-2.5 bg-black/55 overflow-hidden border border-white/15">
                  {baseFillPct > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 bg-amber-500"
                      style={{ width: `${baseFillPct}%` }}
                    />
                  )}
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                    style={{ width: `${barFillPct}%` }}
                  />
                </div>

                {currentRank.nextPts !== null && (
                  <div className="flex justify-between text-[10px] font-mono text-white/75 tabular-nums">
                    <span>{currentRank.minPts}</span>
                    <span>
                      Próxima ({finalRank.nextPts ?? currentRank.nextPts})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: ARSENAL DA FAMA & FUNÇÃO */}
          <div className="md:col-span-4 space-y-5 self-start md:self-center">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                <span className="w-0.5 h-4 bg-amber-400 inline-block" />
                <span>ARSENAL DA FAMA</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {arsenalRows.map((w) => (
                  <div
                    key={w.name}
                    className="flex items-center justify-between border-b border-white/10 pb-1"
                  >
                    <span className="text-neutral-200 font-semibold">{w.name}</span>
                    <span className="text-amber-300 font-bold tabular-nums">+{w.points}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                <span className="w-0.5 h-4 bg-amber-400 inline-block" />
                <span>FUNÇÃO</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {roleBadges.map((r) => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between border-b border-white/10 pb-1"
                  >
                    <span className="text-neutral-200 font-semibold">{r.name}</span>
                    <span className="text-emerald-300 font-bold tabular-nums">+{r.pts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom tap prompt */}
        <div className="relative z-10 pb-4 text-center">
          <span className="text-xs sm:text-sm font-semibold tracking-wider text-neutral-300 animate-pulse">
            Toque para fechar
          </span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STAGE 3: TEAM & MATCH STATS SUMMARY (Screenshot 3)
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#090d14]/92 backdrop-blur-md text-white select-none overflow-y-auto">
      {/* Top Bar */}
      <div className="px-6 sm:px-10 pt-4 flex items-center justify-between">
        <div>
          <div className="text-sm sm:text-base font-black tracking-wider text-neutral-100 uppercase">
            {modeTitle}
          </div>
          <div className="text-[11px] font-mono text-neutral-400 uppercase">{mapTitle}</div>
        </div>
        {isRanked && (
          <div className="flex items-center gap-2 bg-black/45 border border-amber-500/40 px-3 py-1.5">
            <RankEmblemSvg
              color={finalRank.color}
              accent={finalRank.accent}
              className="w-6 h-6"
            />
            <div className="text-right leading-tight">
              <div className="text-[11px] font-black uppercase text-white">{finalRank.name}</div>
              <div className="text-[10px] font-mono text-amber-300 tabular-nums">
                {rankPoints} PTS ({displayDelta >= 0 ? `+${displayDelta}` : displayDelta})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Center Placement & Team Table */}
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-8 py-4 space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center gap-2 font-black tracking-tight">
            {isWin ? (
              <Trophy className="w-7 h-7 text-amber-400" />
            ) : (
              <Skull className="w-7 h-7 text-red-500" />
            )}
            <div className="text-4xl sm:text-5xl tabular-nums">
              <span className={isWin ? 'text-amber-400' : 'text-red-500'}>#{placement}</span>
              <span className="text-neutral-400 text-3xl sm:text-4xl">/{totalPlayers}</span>
            </div>
          </div>

          <div className="w-full max-w-2xl py-1.5 px-4 bg-gradient-to-r from-transparent via-amber-500/25 to-transparent border-y border-amber-400/45 text-xs sm:text-sm font-black uppercase tracking-wider text-neutral-100">
            {isGladiadores && hud.gladiadores
              ? `ARENA GLADIADORES · VOCÊ ${hud.gladiadores.playerScore} X ${hud.gladiadores.enemyScore} INIMIGO`
              : isWin
                ? `VOCÊ SUPEROU ${surpassedPct}% DOS JOGADORES E RECEBEU UMA MEDALHA DE OURO`
                : `VOCÊ SUPEROU ${surpassedPct}% DOS JOGADORES NESTA PARTIDA`}
          </div>
        </div>

        {/* Team Scoreboard Table */}
        <div className="w-full overflow-x-auto bg-black/35 border border-white/10">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-white/15 bg-white/5 text-[11px] font-black uppercase tracking-wider text-neutral-300">
                <th className="py-2.5 px-3 text-center w-24">PONTUAÇÃO</th>
                <th className="py-2.5 px-3">APELIDO</th>
                <th className="py-2.5 px-3 text-center w-16">K</th>
                <th className="py-2.5 px-3 text-center w-24">DMG</th>
                <th className="py-2.5 px-3 text-center w-36">TEMPO DE SOBREVIVÊNCIA</th>
                <th className="py-2.5 px-3 text-center w-20">CURA</th>
                <th className="py-2.5 px-3 text-center w-24">DESTAQUES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-xs sm:text-sm font-bold">
              {teamRows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.isLocal
                      ? 'bg-gradient-to-r from-sky-700/65 via-sky-600/50 to-sky-700/35 text-white'
                      : 'bg-black/25 text-neutral-200'
                  }
                >
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 bg-amber-500/20 border border-amber-400/75 text-amber-300 font-black tabular-nums text-xs">
                      {row.score.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-9 h-9 shrink-0 border border-white/30 bg-black/50 overflow-hidden">
                        <img
                          src={getCharacterAvatar(row.model)}
                          alt={row.nick}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-0 left-0 px-1 bg-sky-500 text-[9px] font-black text-white leading-tight">
                          {row.slot}
                        </span>
                      </div>
                      <span className="font-black tracking-wide truncate max-w-[160px]">
                        {row.nick}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums text-base font-black">
                    {row.kills}
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums text-amber-300">
                    {row.dmg}
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums">
                    {formatSurvivalTime(row.surv)}
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums text-emerald-300">
                    {row.heal}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {row.kills >= 3 && (
                        <span
                          title="Eliminador"
                          className="w-6 h-6 rounded-full bg-amber-500/25 border border-amber-400/70 flex items-center justify-center"
                        >
                          <Crosshair className="w-3.5 h-3.5 text-amber-300" />
                        </span>
                      )}
                      {isWin && (
                        <span
                          title="Booyah"
                          className="w-6 h-6 rounded-full bg-yellow-500/25 border border-yellow-400/70 flex items-center justify-center"
                        >
                          <Shield className="w-3.5 h-3.5 text-yellow-300" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Highlights & Return-to-Lobby ONLY Button */}
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-8 pb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          {hud.headshotKills > 0 ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-red-600 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg border border-amber-200/70">
              <span>VÁRIOS CAPAS</span>
              <span className="text-base">X {hud.headshotKills}</span>
            </div>
          ) : hud.kills > 0 ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg">
              <span>ABATES NA PARTIDA</span>
              <span className="text-base">X {hud.kills}</span>
            </div>
          ) : null}
        </div>

        {/* ONLY Lobby/Voltar button (start next match strictly from Lobby for squad compatibility) */}
        <button
          type="button"
          onClick={() => {
            soundEngine.stopBooyahMusic();
            soundEngine.playUiClick(520);
            onReturnLobby();
          }}
          className="px-10 py-3 bg-[#eceff4] hover:bg-white active:scale-[0.98] text-[#14181e] font-black text-xs sm:text-sm uppercase tracking-[0.18em] shadow-xl border border-white cursor-pointer transition-transform ml-auto"
        >
          LOBBY
        </button>
      </div>
    </div>
  );
};
