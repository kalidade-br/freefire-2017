import React, { useState } from 'react';
import {
  Award,
  Check,
  Crosshair,
  Edit3,
  Flame,
  Scale,
  Send,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import {
  getAvatarMeta,
  getPlayerAvatar,
  normalizePlayerAvatarId,
} from '../game/avatars';
import { soundEngine } from '../game/audio';
import {
  CURRENT_RANKED_SEASON_LABEL,
  CharacterConfig,
  CharacterModelId,
  PlayerAvatarId,
  PlayerProfile,
  getCharacterPresetByModelId,
  getRankInfo,
  normalizeCharacterModelId,
} from '../game/types';
import { PresenceStatus, PublicPlayerAccount } from '../shared/multiplayerTypes';
import { RankEmblemSvg } from './HudIcons';

export interface ProfileModalSubject {
  isOwn: boolean;
  accountId?: number;
  publicId: string;
  nickname: string;
  level: number;
  gold: number;
  gems: number;
  matchesPlayed: number;
  wins: number;
  rankPoints: number;
  rankedMatches: number;
  rankedWins: number;
  totalKills: number;
  modelId: CharacterModelId;
  avatarId?: PlayerAvatarId;
  presence?: PresenceStatus;
  isFriend?: boolean;
}

interface PlayerProfileModalProps {
  subject: ProfileModalSubject;
  onClose: () => void;
  onChangeNickname?: (nextName: string) => void;
  onOpenCharacter?: () => void;
  onOpenAvatars?: () => void;
  onOpenAuth?: () => void;
  onInviteToParty?: (accountId: number) => void;
  onAddFriend?: (publicId: string) => void;
  onRemoveFriend?: (accountId: number) => void;
}

const PRESENCE_LABEL: Record<PresenceStatus, { text: string; dot: string }> = {
  lobby: { text: 'No Lobby', dot: 'bg-emerald-400' },
  matchmaking: { text: 'Buscando Partida', dot: 'bg-amber-400 animate-pulse' },
  in_match: { text: 'Em Partida', dot: 'bg-sky-400' },
  offline: { text: 'Offline', dot: 'bg-neutral-400' },
};

export function profileFromLocal(
  profile: PlayerProfile,
  character: CharacterConfig,
  account: PublicPlayerAccount | null,
): ProfileModalSubject {
  const modelId = normalizeCharacterModelId(account?.character?.modelId ?? character.modelId);
  const avatarId = normalizePlayerAvatarId(
    account?.avatarId ?? profile.avatarId ?? character.avatarId,
  );
  return {
    isOwn: true,
    accountId: account?.id,
    publicId: account?.publicId ?? 'LOCAL',
    nickname: account?.nickname ?? profile.nickname,
    level: account?.level ?? profile.level,
    gold: account?.gold ?? profile.gold,
    gems: account?.gems ?? profile.gems,
    matchesPlayed: account?.matchesPlayed ?? profile.matchesPlayed,
    wins: account?.wins ?? profile.wins,
    rankPoints: account?.rankPoints ?? profile.rankPoints,
    rankedMatches: account?.rankedMatches ?? profile.rankedMatches,
    rankedWins: account?.rankedWins ?? profile.rankedWins,
    totalKills: account?.totalKills ?? profile.totalKills,
    modelId,
    avatarId,
    presence: account ? 'lobby' : undefined,
  };
}

export function profileFromAccount(
  acc: PublicPlayerAccount,
  options?: { isOwn?: boolean; isFriend?: boolean },
): ProfileModalSubject {
  return {
    isOwn: Boolean(options?.isOwn),
    accountId: acc.id,
    publicId: acc.publicId,
    nickname: acc.nickname,
    level: acc.level,
    gold: acc.gold,
    gems: acc.gems,
    matchesPlayed: acc.matchesPlayed,
    wins: acc.wins,
    rankPoints: acc.rankPoints,
    rankedMatches: acc.rankedMatches,
    rankedWins: acc.rankedWins,
    totalKills: acc.totalKills,
    modelId: normalizeCharacterModelId(acc.character?.modelId),
    avatarId: normalizePlayerAvatarId(acc.avatarId ?? acc.character?.avatarId),
    presence: acc.presence,
    isFriend: options?.isFriend,
  };
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  subject,
  onClose,
  onChangeNickname,
  onOpenCharacter,
  onOpenAvatars,
  onOpenAuth,
  onInviteToParty,
  onAddFriend,
  onRemoveFriend,
}) => {
  const [modeTab, setModeTab] = useState<'br_ranked' | 'classic'>('br_ranked');
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(subject.nickname);
  const [likedBonus, setLikedBonus] = useState(0);

  const rk = getRankInfo(subject.rankPoints);
  const avatarSrc = getPlayerAvatar(subject.avatarId, subject.modelId);
  const avatarMeta = getAvatarMeta(subject.avatarId);
  const charLabel = getCharacterPresetByModelId(subject.modelId).name;

  const matches = modeTab === 'br_ranked' ? subject.rankedMatches : subject.matchesPlayed;
  const wins = modeTab === 'br_ranked' ? subject.rankedWins : subject.wins;
  const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
  const baseLikes = Math.max(
    1,
    subject.wins * 7 + subject.totalKills * 2 + subject.level * 3,
  );
  const displayLikes = baseLikes + likedBonus;

  const battleTag =
    subject.totalKills >= Math.max(8, subject.matchesPlayed * 2)
      ? 'RUSHADOR'
      : subject.wins > 0
        ? 'ESTRATEGISTA'
        : 'SOBREVIVENTE';
  const socialTag1 = subject.level >= 10 ? 'VETERANO' : 'TENDÊNCIAS';
  const socialTag2 = subject.totalKills >= 15 ? 'LETAL' : 'ESQUADRÃO';

  const commitNick = () => {
    const clean = nickDraft.trim().slice(0, 18);
    if (clean && onChangeNickname) {
      onChangeNickname(clean);
    } else {
      setNickDraft(subject.nickname);
    }
    setEditingNick(false);
  };

  const presInfo = subject.presence ? PRESENCE_LABEL[subject.presence] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 text-white select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#0b0d14] border-2 border-amber-500/70 shadow-2xl grid grid-cols-1 md:grid-cols-12 overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* LEFT SHOWCASE PANEL (Dark violet pedestal like Free Fire Ninja profile screenshot) */}
        <div
          className="md:col-span-5 relative flex flex-col justify-between p-4 min-h-[240px] md:min-h-[430px] overflow-hidden border-b md:border-b-0 md:border-r border-white/10"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, #3b1768 0%, #1c0c36 48%, #090a10 100%)',
          }}
        >
          {/* Top corner status + Close on mobile */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/55 border border-purple-300/35 text-[10px] font-black uppercase tracking-wider text-purple-200">
              <span>{charLabel}</span>
              {presInfo && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="inline-flex items-center gap-1 text-white">
                    <span className={`w-1.5 h-1.5 rounded-full ${presInfo.dot}`} />
                    {presInfo.text}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 bg-black/60 hover:bg-black border border-white/20 cursor-pointer"
              aria-label="Fechar Perfil"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Center Character Showcase Portrait on Glowing Pedestal */}
          <div className="relative z-10 flex flex-col items-center justify-center my-3">
            <div
              className="relative w-36 h-44 sm:w-44 sm:h-52 border-2 border-amber-400/70 shadow-[0_0_35px_rgba(168,85,247,0.5)] overflow-hidden bg-black/50"
            >
              <img
                src={avatarSrc}
                alt={charLabel}
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
              <div className="absolute bottom-2 inset-x-2 flex items-center justify-between text-[10px] font-black uppercase">
                <span className="text-amber-300 tracking-wider">{charLabel}</span>
                <span className="text-neutral-200 font-mono">{rk.name}</span>
              </div>
            </div>

            {/* Pedestal floor ellipse */}
            <div className="w-48 h-4 -mt-1 rounded-full bg-gradient-to-r from-transparent via-purple-400/45 to-transparent blur-[1px]" />
          </div>

          {/* Bottom-left Likes Thumb Badge matching Ninja profile screenshot */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(760);
                setLikedBonus((v) => v + 1);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-black/55 hover:bg-white/15 border border-white/20 cursor-pointer transition-colors"
              title="Curtir Perfil"
            >
              <ThumbsUp className="w-4 h-4 text-white fill-white/80" />
              <span className="text-xs font-black tabular-nums">{displayLikes}</span>
            </button>

            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {subject.isOwn && onOpenAvatars && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onClose();
                    onOpenAvatars();
                  }}
                  className="px-2.5 py-1.5 bg-purple-600/30 hover:bg-purple-500 hover:text-white border border-purple-400/70 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                  title={`Avatar atual: ${avatarMeta.name}`}
                >
                  TROCAR AVATAR
                </button>
              )}
              {subject.isOwn && onOpenCharacter && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onClose();
                    onOpenCharacter();
                  }}
                  className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 hover:text-black border border-amber-400/60 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                >
                  TROCAR PERSONAGEM
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT FREE FIRE PROFILE CARD PANEL */}
        <div className="md:col-span-7 flex flex-col justify-between bg-gradient-to-b from-[#131620] to-[#0a0c12] p-3 sm:p-4 overflow-y-auto space-y-3">
          {/* 1. Classic Free Fire Yellow + Crimson Banner Header */}
          <div className="relative border-2 border-amber-500/80 bg-[#7f1d1d] overflow-hidden shadow-xl">
            <div className="flex items-stretch">
              {/* Left Yellow Slanted Panel */}
              <div className="relative w-28 sm:w-32 shrink-0 bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-500 p-2 flex flex-col justify-between text-black">
                <div className="bg-red-700 text-white text-[9px] font-black italic tracking-wider px-1.5 py-0.5 uppercase inline-block self-start">
                  FREE <span className="text-amber-300">FIRE</span>
                </div>

                {/* Square Framed Avatar */}
                <div className="relative mx-auto my-1 w-14 h-14 sm:w-16 sm:h-16 border-2 border-white shadow-md bg-neutral-900">
                  <img
                    src={avatarSrc}
                    alt={charLabel}
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#12161e] border border-amber-300 flex items-center justify-center">
                    <Trophy className="w-3 h-3 text-amber-300" />
                  </div>
                </div>

                <div className="text-xs font-black tracking-wide text-neutral-950">
                  Nvl. {subject.level}
                </div>
              </div>

              {/* Right Crimson Info Area */}
              <div className="flex-1 bg-gradient-to-r from-[#8b1111] via-[#a31616] to-[#6d0d0d] p-2 sm:p-2.5 flex flex-col justify-between min-w-0">
                {/* Top Close button (desktop) */}
                <div className="flex justify-end mb-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="hidden md:flex p-1 bg-black/35 hover:bg-black/65 text-white cursor-pointer"
                    aria-label="Fechar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* White Player Nameplate Strip */}
                <div className="bg-white/95 text-neutral-900 px-2.5 py-1.5 shadow flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {editingNick && subject.isOwn ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          maxLength={18}
                          autoFocus
                          value={nickDraft}
                          onChange={(e) => setNickDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitNick();
                            if (e.key === 'Escape') {
                              setNickDraft(subject.nickname);
                              setEditingNick(false);
                            }
                          }}
                          className="w-full bg-neutral-100 border border-amber-500 px-1.5 py-0.5 text-xs font-black text-black focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={commitNick}
                          className="p-1 bg-amber-500 text-black cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block shrink-0" />
                        <span className="font-black text-sm truncate">
                          {subject.nickname}
                        </span>
                        {subject.isOwn && onChangeNickname && (
                          <button
                            type="button"
                            onClick={() => {
                              setNickDraft(subject.nickname);
                              setEditingNick(true);
                            }}
                            className="p-0.5 text-neutral-500 hover:text-black cursor-pointer"
                            title="Editar Apelido"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="text-[10px] font-bold text-neutral-600 mt-0.5">
                      Português · Brasil
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-neutral-800 font-black text-xs shrink-0">
                    <ThumbsUp className="w-3.5 h-3.5 fill-neutral-700" />
                    <span className="tabular-nums">{displayLikes}</span>
                  </div>
                </div>

                {/* UID Bar */}
                <div className="flex items-center justify-between mt-2 text-[11px] font-mono font-bold text-amber-100">
                  <span className="uppercase text-amber-300/90">
                    {rk.name} ({subject.rankPoints})
                  </span>
                  <span className="bg-black/45 px-2 py-0.5 border border-amber-300/35">
                    UID: {subject.publicId}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Mode Tabs: BR RANQUEADA | CLÁSSICO */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(680);
                setModeTab('br_ranked');
              }}
              className={`py-2 px-3 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center gap-1.5 border ${
                modeTab === 'br_ranked'
                  ? 'bg-white text-black border-white shadow'
                  : 'bg-[#171b26] text-neutral-300 border-white/10 hover:border-white/30'
              }`}
            >
              {modeTab === 'br_ranked' && (
                <span className="w-2 h-2 bg-amber-500 rotate-45 inline-block" />
              )}
              <span>BR RANQUEADA</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(620);
                setModeTab('classic');
              }}
              className={`py-2 px-3 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center gap-1.5 border ${
                modeTab === 'classic'
                  ? 'bg-white text-black border-white shadow'
                  : 'bg-[#171b26] text-neutral-300 border-white/10 hover:border-white/30'
              }`}
            >
              {modeTab === 'classic' && (
                <span className="w-2 h-2 bg-amber-500 rotate-45 inline-block" />
              )}
              <span>CLÁSSICO / GERAL</span>
            </button>
          </div>

          {/* 3. Season + Rank Emblem + Medal Row */}
          <div className="bg-[#121622] border border-white/10 px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="text-left">
              <div className="text-[10px] font-bold uppercase text-neutral-400">
                {CURRENT_RANKED_SEASON_LABEL}
              </div>
              <div className="text-sm font-black text-white tabular-nums">
                {subject.rankPoints} PTS
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RankEmblemSvg
                color={rk.color}
                accent={rk.accent}
                iconUrl={rk.iconUrl}
                alt={rk.name}
                className="w-11 h-11 shrink-0 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]"
              />
              <div className="leading-tight">
                <div className="text-xs font-black uppercase text-amber-300">
                  {rk.name}
                </div>
                <div className="text-[10px] font-mono text-neutral-400">
                  {rk.sub}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-bold uppercase text-neutral-400">
                MEDALHA BOOYAH
              </div>
              <div className="text-sm font-black text-amber-300 flex items-center justify-end gap-1 tabular-nums">
                <Award className="w-4 h-4 text-amber-400" />
                <span>{wins}</span>
              </div>
            </div>
          </div>

          {/* 4. 5 Golden Stat Badges Row matching screenshot */}
          <div className="grid grid-cols-5 gap-1.5 bg-[#10141e] border border-white/10 py-2.5 px-2 text-center">
            <div className="flex flex-col items-center">
              <ShieldCheck className="w-5 h-5 text-slate-200 mb-0.5" />
              <span className="text-xs font-black text-amber-300 tabular-nums">
                {subject.level}
              </span>
              <span className="text-[9px] text-neutral-400 uppercase">Nível</span>
            </div>
            <div className="flex flex-col items-center">
              <Trophy className="w-5 h-5 text-amber-400 mb-0.5" />
              <span className="text-xs font-black text-amber-300 tabular-nums">
                {matches}
              </span>
              <span className="text-[9px] text-neutral-400 uppercase">Jogos</span>
            </div>
            <div className="flex flex-col items-center">
              <Flame className="w-5 h-5 text-orange-400 mb-0.5" />
              <span className="text-xs font-black text-amber-300 tabular-nums">
                {wins}
              </span>
              <span className="text-[9px] text-neutral-400 uppercase">Booyahs</span>
            </div>
            <div className="flex flex-col items-center">
              <Crosshair className="w-5 h-5 text-red-400 mb-0.5" />
              <span className="text-xs font-black text-amber-300 tabular-nums">
                {subject.totalKills}
              </span>
              <span className="text-[9px] text-neutral-400 uppercase">Abates</span>
            </div>
            <div className="flex flex-col items-center">
              <Scale className="w-5 h-5 text-yellow-300 mb-0.5" />
              <span className="text-xs font-black text-amber-300 tabular-nums">
                {winRate}%
              </span>
              <span className="text-[9px] text-neutral-400 uppercase">Taxa</span>
            </div>
          </div>

          {/* 5. ESTILO DE BATALHA & ESTILO SOCIAL */}
          <div className="space-y-2 pt-0.5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-300 mb-1 flex items-center gap-1">
                <span className="text-amber-400">»</span> ESTILO DE BATALHA
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="px-4 py-1 bg-gradient-to-r from-sky-100 via-white to-sky-200 text-slate-900 font-black text-[11px] uppercase tracking-wider border-l-4 border-sky-500 shadow">
                  {battleTag}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-300 mb-1 flex items-center gap-1">
                <span className="text-amber-400">»</span> ESTILO SOCIAL
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="px-4 py-1 bg-gradient-to-r from-pink-100 via-white to-purple-200 text-slate-900 font-black text-[11px] uppercase tracking-wider border-l-4 border-purple-500 shadow">
                  {socialTag1}
                </div>
                <div className="px-4 py-1 bg-gradient-to-r from-amber-100 via-white to-yellow-200 text-slate-900 font-black text-[11px] uppercase tracking-wider border-l-4 border-amber-500 shadow">
                  {socialTag2}
                </div>
              </div>
            </div>
          </div>

          {/* 6. Bottom Action Buttons */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {subject.isOwn && onOpenAuth && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] uppercase cursor-pointer whitespace-nowrap"
                >
                  {subject.publicId === 'LOCAL' ? 'CONECTAR CONTA NUVEM' : 'GERENCIAR CONTA'}
                </button>
              )}

              {!subject.isOwn && subject.accountId && subject.isFriend && onInviteToParty && (
                <button
                  type="button"
                  onClick={() => onInviteToParty(subject.accountId!)}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] uppercase flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>CONVIDAR P/ EQUIPE</span>
                </button>
              )}

              {!subject.isOwn && !subject.isFriend && onAddFriend && (
                <button
                  type="button"
                  onClick={() => onAddFriend(subject.publicId)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] uppercase flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>ADICIONAR AMIGO</span>
                </button>
              )}

              {!subject.isOwn && subject.accountId && subject.isFriend && onRemoveFriend && (
                <button
                  type="button"
                  onClick={() => onRemoveFriend(subject.accountId!)}
                  className="px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-200 font-bold text-[11px] uppercase flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>REMOVER</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] uppercase tracking-wider cursor-pointer whitespace-nowrap"
            >
              FECHAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
