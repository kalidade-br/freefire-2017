import React, { useCallback, useEffect, useState } from 'react';
import {
  Backpack,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Diamond,
  Info,
  KeyRound,
  LogOut,
  Move,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Swords,
  Trophy,
  UserCheck,
  Users,
  Vault,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { getPlayerAvatar } from '../game/avatars';
import { soundEngine } from '../game/audio';
import { isGuestAccount, multiplayerClient, PingStatus } from '../game/multiplayerClient';
import {
  BrMapId,
  CharacterConfig,
  GameVariant,
  GladiadoresFormat,
  MatchMode,
  PlayerProfile,
  getRankInfo,
} from '../game/types';
import {
  FriendEntry,
  PartyInvitePayload,
  PartyState,
  PublicPlayerAccount,
} from '../shared/multiplayerTypes';
import { IconCoinSvg, RankEmblemSvg } from './HudIcons';
import { NetworkPingBadge } from './NetworkPingBadge';
import { VoiceChatHudWidget } from './VoiceChatHudWidget';

interface LobbyScreenProps {
  profile: PlayerProfile;
  character: CharacterConfig;
  brMapId: BrMapId;
  gameVariant: GameVariant;
  gladiadoresFormat: GladiadoresFormat;
  gladiadoresTargetRounds: number;
  matchMode: MatchMode;
  isRanked: boolean;
  autoFillBots: boolean;
  account: PublicPlayerAccount | null;
  party: PartyState | null;
  invites: PartyInvitePayload[];
  onChangeGladiadoresFormat: (format: GladiadoresFormat) => void;
  onChangeMatchMode: (mode: MatchMode) => void;
  onChangeRanked: (ranked: boolean) => void;
  onChangeAutoFillBots: (fill: boolean) => void;
  muted: boolean;
  onToggleMute: () => void;
  onStartMatch: () => void;
  onQuickTraining: () => void;
  onOpenMyProfile: () => void;
  onInspectPlayer: (accountId: number) => void;
  onOpenCharacter: () => void;
  onOpenStore: () => void;
  onOpenArsenal: () => void;
  onOpenRankModal: () => void;
  onOpenSettings: () => void;
  onOpenHudEditor: () => void;
  onOpenCredits: () => void;
  onOpenAuth: () => void;
  onOpenFriends: () => void;
  onOpenModeSelect: () => void;
  onRespondInvite: (inviteId: string, accept: boolean) => void;
  onKickMember: (accountId: number) => void;
  onLeaveParty: () => void;
  onBackToMenu: () => void;
  isSearchingMatch: boolean;
  searchElapsedSec: number;
  searchingPlayersCount: number;
  onCancelSearch: () => void;
  onOpenSearchingPlayers: () => void;
}

const HEX_CLIP = 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)';

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  profile,
  character,
  brMapId,
  gameVariant,
  gladiadoresFormat,
  gladiadoresTargetRounds: _gladiadoresTargetRounds,
  matchMode,
  isRanked,
  autoFillBots,
  account,
  party,
  invites,
  onChangeGladiadoresFormat,
  onChangeMatchMode,
  onChangeRanked: _onChangeRanked,
  onChangeAutoFillBots,
  muted,
  onToggleMute,
  onStartMatch,
  onQuickTraining,
  onOpenMyProfile,
  onInspectPlayer,
  onOpenCharacter,
  onOpenStore,
  onOpenArsenal,
  onOpenRankModal,
  onOpenSettings,
  onOpenHudEditor,
  onOpenCredits,
  onOpenAuth,
  onOpenFriends,
  onOpenModeSelect,
  onRespondInvite,
  onKickMember,
  onLeaveParty,
  onBackToMenu,
  isSearchingMatch,
  searchElapsedSec,
  searchingPlayersCount,
  onCancelSearch,
  onOpenSearchingPlayers,
}) => {
  const [pingInfo, setPingInfo] = useState<PingStatus>(() => multiplayerClient.getPingInfo());
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [selectedSlotAccountId, setSelectedSlotAccountId] = useState<number | null>(null);
  const [inviteToast, setInviteToast] = useState<string | null>(null);
  const [promoIndex, setPromoIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPingInfo(multiplayerClient.getPingInfo());
    }, 350);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPromoIndex((i) => (i + 1) % 4);
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  const refreshFriends = useCallback(async () => {
    if (!account) {
      setFriends([]);
      return;
    }
    try {
      const res = await multiplayerClient.getFriends();
      setFriends(res.friends);
    } catch {
      // ignore transient error
    }
  }, [account]);

  useEffect(() => {
    void refreshFriends();
    if (!account) return;
    const poll = window.setInterval(() => {
      void refreshFriends();
    }, 8000);
    const unsub = multiplayerClient.subscribe((ev) => {
      if (ev.type === 'friends_refresh') {
        void refreshFriends();
      }
    });
    return () => {
      window.clearInterval(poll);
      unsub();
    };
  }, [account, refreshFriends]);

  const rank = getRankInfo(profile.rankPoints);
  const isGuest = isGuestAccount(account);
  const isPartyLeader = !party || !account || party.leaderId === account.id;
  const partyMembers = party?.members ?? [];
  const maxTeamSlots =
    gameVariant === 'gladiadores'
      ? gladiadoresFormat === '2v2'
        ? 2
        : 1
      : matchMode === 'duo'
        ? 2
        : matchMode === 'squad'
          ? 4
          : 1;
  const effectiveMembers =
    partyMembers.length > 0
      ? partyMembers
      : [
          {
            accountId: account?.id ?? -1,
            publicId: account?.publicId ?? 'CONVIDADO',
            nickname: profile.nickname,
            level: profile.level,
            rankPoints: profile.rankPoints,
            avatarId: profile.avatarId ?? character.avatarId ?? 'default',
            character,
            ready: true,
            isLeader: true,
          },
        ];

  const showPodiumSlots =
    (gameVariant === 'gladiadores' && gladiadoresFormat === '2v2') ||
    (gameVariant === 'br' && matchMode !== 'solo');

  const handleQuickInviteFriend = async (friend: FriendEntry) => {
    try {
      if (gameVariant === 'br' && matchMode === 'solo' && isPartyLeader) {
        onChangeMatchMode('duo');
      }
      await multiplayerClient.inviteToParty(friend.account.id);
      soundEngine.playUiClick(740);
      setInviteToast(`Convite enviado para ${friend.account.nickname}`);
      window.setTimeout(() => setInviteToast(null), 2600);
    } catch (err) {
      setInviteToast(err instanceof Error ? err.message : 'Indisponível');
      window.setTimeout(() => setInviteToast(null), 2600);
    }
  };

  const handleSendFriendFromSlot = async (publicId: string, nickname: string) => {
    try {
      await multiplayerClient.sendFriendRequest(publicId);
      soundEngine.playUiClick(760);
      setInviteToast(`Pedido de amizade enviado para ${nickname}`);
      void refreshFriends();
    } catch (err) {
      setInviteToast(err instanceof Error ? err.message : 'Não foi possível enviar');
    }
    setSelectedSlotAccountId(null);
    window.setTimeout(() => setInviteToast(null), 2600);
  };

  const sortedFriends = [...friends].sort((a, b) => {
    const score = (p: FriendEntry['presence']) =>
      p === 'lobby' ? 0 : p === 'matchmaking' ? 1 : p === 'in_match' ? 2 : 3;
    return score(a.presence) - score(b.presence);
  });

  const promoSlides = [
    {
      title: 'LIKE US ON FACEBOOK',
      subtitle: 'FREE FIRE BATTLEGROUNDS · CLÁSSICO 2017',
      image: '/assets/loading_bg.jpg',
      actionLabel: 'VER TEMPORADA S1',
      onAction: onOpenRankModal,
    },
    {
      title: 'GLADIADORES 1v1 / 2v2',
      subtitle: 'DUELO TÁTICO · 5 RODADAS · ESCOLHA DE ARMAS',
      image: '/assets/start_bg_clean.jpg',
      actionLabel: 'SELECIONAR MODO',
      onAction: onOpenModeSelect,
    },
    {
      title: 'BERMUDA CLÁSSICA & RANQUEADA',
      subtitle: 'SAFE DINÂMICA · CARROS · PAREDE DE GELO',
      image: '/assets/lobby_bg_clean.jpg',
      actionLabel: 'ESCOLHER MAPA',
      onAction: onOpenModeSelect,
    },
    {
      title: 'TEMPORADA S1 · MESTRE',
      subtitle: 'CONQUISTE AVATARES EXCLUSIVOS NA RANKED',
      image: '/assets/loading_bg.jpg',
      actionLabel: 'VER PATENTES',
      onAction: onOpenRankModal,
    },
  ];
  const activeSlide = promoSlides[promoIndex % promoSlides.length];

  const xpProgressPct = Math.min(92, Math.max(12, ((profile.matchesPlayed % 10) + 1) * 9));

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-1.5 sm:p-3.5 text-white select-none overflow-hidden">
      {/* TOP BAR: non-wrapping responsive header so elements never collide vertically on small phones */}
      <header className="flex items-start justify-between gap-2 shrink-0 min-h-0">
        {/* Top-Left Hexagonal Avatar + Nick + Lv.X + XP bar */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick(680);
              onOpenMyProfile();
            }}
            className="flex items-center gap-1.5 sm:gap-2.5 group cursor-pointer text-left min-w-0"
            title="Ver Meu Perfil"
          >
            <div
              className="w-9 h-10 sm:w-12 sm:h-14 md:w-14 md:h-16 bg-gradient-to-b from-white/85 via-neutral-300/75 to-neutral-500/80 p-[2px] shrink-0 drop-shadow-[0_3px_8px_rgba(0,0,0,0.8)]"
              style={{ clipPath: HEX_CLIP }}
            >
              <div
                className="w-full h-full bg-[#131820] overflow-hidden"
                style={{ clipPath: HEX_CLIP }}
              >
                <img
                  src={getPlayerAvatar(profile.avatarId ?? character.avatarId, character.modelId)}
                  alt={character.name}
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>

            <div className="min-w-[74px] max-w-[115px] sm:max-w-[165px]">
              <div className="flex items-center gap-1">
                <span className="text-xs sm:text-sm md:text-base font-bold tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate group-hover:text-amber-300 transition-colors">
                  {profile.nickname}
                </span>
                <RankEmblemSvg
                  color={rank.color}
                  accent={rank.accent}
                  iconUrl={rank.iconUrl}
                  alt={rank.name}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                />
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium text-white/90 drop-shadow leading-tight">
                Lv.{profile.level}
              </div>
              <div className="mt-0.5 sm:mt-1 h-1 sm:h-1.5 w-20 sm:w-28 md:w-32 bg-black/55 border border-white/15 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-teal-300"
                  style={{ width: `${xpProgressPct}%` }}
                />
              </div>
            </div>
          </button>

          {/* Account / Google Link Pill (hidden on very small widths since bottom-left also has it) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenAuth();
            }}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors shadow shrink-0 ${
              account && !isGuest
                ? 'bg-emerald-950/75 hover:bg-emerald-900 border-emerald-400/55 text-emerald-200'
                : 'bg-black/55 hover:bg-amber-500 hover:text-black border-cyan-300/45 text-cyan-200'
            }`}
            title={
              account && !isGuest
                ? `Conta Google/Nuvem #${account.publicId}`
                : 'Jogando como Convidado Online · Clique para vincular conta Google'
            }
          >
            {account && !isGuest ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>#{account.publicId}</span>
              </>
            ) : isGuest && account ? (
              <>
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span>CONVIDADO #{account.publicId} · GOOGLE</span>
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span>CONVIDADO · ENTRAR</span>
              </>
            )}
          </button>
        </div>

        {/* Top-Center Angled Grey Parallelograms: Gold & Diamonds */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-3 pt-0.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenStore();
            }}
            className="flex items-center bg-[#5a6674]/60 hover:bg-[#6d7a89]/75 border border-white/15 px-2 sm:px-3.5 py-0.5 sm:py-1 -skew-x-[18deg] shadow-md cursor-pointer transition-colors"
            title="Ouro"
          >
            <div className="skew-x-[18deg] flex items-center gap-1 sm:gap-2 min-w-[42px] sm:min-w-[68px]">
              <IconCoinSvg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold tabular-nums text-white">
                {profile.gold}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenRankModal();
            }}
            className="flex items-center bg-[#5a6674]/60 hover:bg-[#6d7a89]/75 border border-white/15 px-2 sm:px-3.5 py-0.5 sm:py-1 -skew-x-[18deg] shadow-md cursor-pointer transition-colors"
            title="Diamantes"
          >
            <div className="skew-x-[18deg] flex items-center gap-1 sm:gap-2 min-w-[38px] sm:min-w-[62px]">
              <Diamond className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 fill-sky-400/50 shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold tabular-nums text-white">
                {profile.gems}
              </span>
            </div>
          </button>
        </div>

        {/* Top-Right: Ping, Voice, Friends silhouette, 1.7.13 + Settings Gear */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5">
            <NetworkPingBadge
              pingMs={pingInfo.pingMs}
              disconnected={pingInfo.disconnected}
            />
            <VoiceChatHudWidget compact />
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenFriends();
            }}
            title="Amigos Online e Solicitações"
            className="relative p-1 sm:p-1.5 hover:bg-white/10 text-white/95 hover:text-cyan-300 cursor-pointer transition-colors"
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]" />
            {invites.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 text-black text-[8px] font-black rounded-full flex items-center justify-center">
                {invites.length}
              </span>
            )}
          </button>

          <div className="flex flex-col items-center">
            <span className="text-[9px] sm:text-[10px] font-mono text-white/90 leading-none mb-0.5 drop-shadow">
              1.7.13
            </span>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenSettings();
              }}
              title="Configurações"
              className="p-0.5 hover:rotate-45 text-white hover:text-amber-300 cursor-pointer transition-all"
            >
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]" />
            </button>
          </div>
        </div>
      </header>

      {/* MIDDLE AREA: Left Hex Nav | Center 3D Character | Right Panel — cleanly constrained to never overflow short mobile screens */}
      <div className="flex-1 relative flex items-center justify-between gap-2 min-h-0 py-1">
        {/* Left Hexagonal Cyan-Bordered Menu — wraps cleanly or scrolls discreetly on tiny screens */}
        <nav className="pointer-events-auto flex flex-col items-center justify-center gap-1.5 sm:gap-3 pl-0.5 sm:pl-2.5 max-h-full overflow-y-auto z-20 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick(700);
              onQuickTraining();
            }}
            className="flex flex-col items-center gap-0.5 group cursor-pointer shrink-0"
            title="Ilha de Treinamento / Tutorial"
          >
            <div
              className="w-8 h-9 sm:w-11 sm:h-12 md:w-12 md:h-14 bg-cyan-400 p-[2px] group-hover:scale-105 transition-transform shadow-[0_0_10px_rgba(34,211,238,0.4)]"
              style={{ clipPath: HEX_CLIP }}
            >
              <div
                className="w-full h-full bg-[#132934]/95 flex items-center justify-center"
                style={{ clipPath: HEX_CLIP }}
              >
                <BookOpen className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
              </div>
            </div>
            <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] group-hover:text-cyan-300">
              TUTORIAL
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick(700);
              onOpenRankModal();
            }}
            className="flex flex-col items-center gap-0.5 group cursor-pointer shrink-0"
            title="Leaderboard e Patentes S1"
          >
            <div
              className="w-8 h-9 sm:w-11 sm:h-12 md:w-12 md:h-14 bg-cyan-400 p-[2px] group-hover:scale-105 transition-transform shadow-[0_0_10px_rgba(34,211,238,0.4)]"
              style={{ clipPath: HEX_CLIP }}
            >
              <div
                className="w-full h-full bg-[#132934]/95 flex items-center justify-center"
                style={{ clipPath: HEX_CLIP }}
              >
                <Trophy className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
              </div>
            </div>
            <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] group-hover:text-cyan-300">
              LEADERBOARD
            </span>
          </button>

          <div className="flex items-center gap-1 sm:flex-col sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenSearchingPlayers();
              }}
              className="relative flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 bg-black/55 hover:bg-emerald-950/90 border border-emerald-400/60 transition-colors cursor-pointer"
              title="Jogadores Buscando Partida Online"
            >
              <Radio
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                  searchingPlayersCount > 0 ? 'text-emerald-400 animate-pulse' : 'text-emerald-300'
                }`}
              />
              {searchingPlayersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1 bg-emerald-400 text-black text-[8px] font-black font-mono">
                  {searchingPlayersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenHudEditor();
              }}
              className="flex items-center justify-center w-7 h-7 sm:w-auto sm:h-auto sm:px-2 sm:py-1 bg-black/55 hover:bg-white/15 border border-white/20 text-[9px] font-bold uppercase tracking-wider text-white/85 cursor-pointer gap-1"
              title="Personalizar HUD"
            >
              <Move className="w-3 h-3 text-sky-300" />
              <span className="hidden sm:inline">HUD</span>
            </button>
          </div>

          {inviteToast && (
            <div className="max-w-[130px] px-2 py-1 bg-emerald-950/90 border border-emerald-400 text-[9px] font-bold text-emerald-200 shadow-lg">
              {inviteToast}
            </div>
          )}
        </nav>

        {/* Incoming Party Invites Floating Card */}
        {invites.length > 0 && (
          <div className="pointer-events-auto absolute top-0 left-1/2 -translate-x-1/2 flex flex-col gap-1.5 w-64 sm:w-88 z-40">
            {invites.slice(0, 2).map((inv) => (
              <div
                key={inv.inviteId}
                className="bg-[#111924]/95 border-2 border-emerald-400 px-2.5 py-1.5 shadow-2xl flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[10px] sm:text-[11px] font-black text-emerald-300 truncate">
                    CONVITE DE {inv.fromNickname}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-mono text-neutral-300">
                    {inv.gameVariant === 'gladiadores'
                      ? `GLADIADORES · ${(inv.gladiadoresFormat ?? '2v2').toUpperCase()}`
                      : `${inv.isRanked ? 'BR RANQUEADO' : 'CLÁSSICO'} · ${inv.mode.toUpperCase()}`}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRespondInvite(inv.inviteId, true)}
                    className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase cursor-pointer flex items-center gap-0.5"
                  >
                    <Check className="w-3 h-3" /> ACEITAR
                  </button>
                  <button
                    type="button"
                    onClick={() => onRespondInvite(inv.inviteId, false)}
                    className="px-2 py-1 bg-red-900/80 hover:bg-red-800 text-white font-bold text-[10px] uppercase cursor-pointer"
                  >
                    X
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RIGHT PANEL: Fluid viewport-height banner + compact tabs/buttons so NOTHING overflows short mobile phones */}
        <div className="pointer-events-auto relative flex flex-col gap-1 sm:gap-1.5 w-[47%] sm:w-[46%] max-w-[430px] min-w-[205px] mr-0.5 sm:mr-3 z-20 max-h-full justify-center">
          {/* 3 Dark Teal Navigation Tabs */}
          <div className="grid grid-cols-3 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(680);
                onOpenStore();
              }}
              className="bg-[#1a3e48]/90 hover:bg-[#245664] border border-cyan-200/20 py-1 sm:py-2 px-1 sm:px-2 flex items-center justify-center gap-1 text-[9px] sm:text-xs font-bold uppercase tracking-wider text-white cursor-pointer transition-colors shadow"
            >
              <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-200 shrink-0" />
              <span>STORE</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(680);
                onOpenCharacter();
              }}
              className="bg-[#1a3e48]/90 hover:bg-[#245664] border border-cyan-200/20 py-1 sm:py-2 px-1 sm:px-2 flex items-center justify-center gap-1 text-[9px] sm:text-xs font-bold uppercase tracking-wider text-white cursor-pointer transition-colors shadow"
            >
              <Vault className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-200 shrink-0" />
              <span>VAULT</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(680);
                onOpenArsenal();
              }}
              className="bg-[#1a3e48]/90 hover:bg-[#245664] border border-cyan-200/20 py-1 sm:py-2 px-1 sm:px-2 flex items-center justify-center gap-1 text-[9px] sm:text-xs font-bold uppercase tracking-wider text-white cursor-pointer transition-colors shadow"
            >
              <Backpack className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-200 shrink-0" />
              <span>LOADOUT</span>
            </button>
          </div>

          {/* Fluid Promo Banner Carousel constrained by viewport height (clamp) so mobile landscape fits smoothly */}
          <div className="relative w-full h-[clamp(86px,26vh,190px)] bg-black/80 border border-white/15 overflow-hidden shadow-2xl group shrink-0">
            <img
              src={activeSlide.image}
              alt={activeSlide.title}
              onClick={() => {
                soundEngine.playUiClick();
                activeSlide.onAction();
              }}
              className="w-full h-full object-cover object-center brightness-[0.62] contrast-[1.08] cursor-pointer transition-transform duration-500 group-hover:scale-[1.02]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/35" />

            <div className="pointer-events-none absolute top-1.5 right-2 sm:top-2.5 sm:right-3 text-right">
              <div className="text-xs sm:text-lg font-black tracking-wide text-white leading-none drop-shadow">
                FREE F<span className="text-amber-400">I</span>RE
              </div>
              <div className="text-[6px] sm:text-[8px] tracking-[0.38em] text-white/80 uppercase mt-0.5">
                BATTLEGROUNDS
              </div>
            </div>

            <div
              onClick={() => {
                soundEngine.playUiClick();
                activeSlide.onAction();
              }}
              className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2.5 flex flex-col items-center text-center cursor-pointer"
            >
              <div className="text-[10px] sm:text-sm font-bold uppercase tracking-wider text-white drop-shadow truncate max-w-full">
                {activeSlide.title}
              </div>
              <div className="hidden sm:block text-[9px] font-mono text-amber-300/90 truncate max-w-full">
                {activeSlide.subtitle}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {promoSlides.map((s, idx) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPromoIndex(idx);
                    }}
                    className={`h-1 sm:h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === promoIndex ? 'w-3 bg-white' : 'w-1 sm:w-1.5 bg-white/40 hover:bg-white/75'
                    }`}
                    aria-label={s.title}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPromoIndex((i) => (i - 1 + promoSlides.length) % promoSlides.length);
              }}
              className="absolute left-1 top-1/2 -translate-y-1/2 p-1 bg-black/45 hover:bg-black/80 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPromoIndex((i) => (i + 1) % promoSlides.length);
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-black/45 hover:bg-black/80 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Próximo slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Slim Mode Summary Bar */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={isSearchingMatch}
              onClick={() => {
                soundEngine.playUiClick(700);
                onOpenModeSelect();
              }}
              className="flex-1 bg-black/65 hover:bg-black/85 disabled:opacity-60 border border-white/20 px-2 py-0.5 sm:py-1 flex items-center justify-between text-left cursor-pointer transition-colors min-w-0"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {gameVariant === 'gladiadores' ? (
                  <Swords className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <RankEmblemSvg
                    color={rank.color}
                    accent={rank.accent}
                    iconUrl={rank.iconUrl}
                    alt={rank.name}
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                  />
                )}
                <span className="text-[9px] sm:text-[11px] font-black uppercase text-white truncate">
                  {gameVariant === 'gladiadores'
                    ? `GLADIADORES · ${gladiadoresFormat.toUpperCase()} (5R)`
                    : `${isRanked ? 'RANQUEADA' : 'CLÁSSICO'} · ${brMapId.toUpperCase()} · ${matchMode.toUpperCase()}`}
                </span>
              </div>
              <span className="text-[8px] sm:text-[9px] font-mono text-cyan-300 shrink-0 ml-1.5">
                MODO
              </span>
            </button>

            {gameVariant === 'br' && matchMode !== 'solo' && (
              <button
                type="button"
                disabled={!isPartyLeader || isSearchingMatch}
                onClick={() => {
                  soundEngine.playUiClick(640);
                  onChangeAutoFillBots(!autoFillBots);
                }}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 border text-[8px] sm:text-[9px] font-black uppercase cursor-pointer shrink-0 ${
                  autoFillBots
                    ? 'bg-emerald-950/85 border-emerald-400/70 text-emerald-200'
                    : 'bg-black/65 border-neutral-600 text-neutral-300'
                }`}
                title="Preencher vagas do time com bots aliados"
              >
                {autoFillBots ? 'BOT ON' : 'BOT OFF'}
              </button>
            )}
          </div>

          {/* Group & Team Quick Popover when GROUP is clicked */}
          {groupMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-[#101720]/96 border border-cyan-400/65 p-2 shadow-2xl space-y-1.5 z-40 max-h-[55vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-cyan-300">
                  {gameVariant === 'gladiadores' ? 'FORMATO GLADIADORES' : 'FORMATO DE EQUIPE'}
                </span>
                <button
                  type="button"
                  onClick={() => setGroupMenuOpen(false)}
                  className="p-0.5 hover:bg-white/10 text-neutral-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {gameVariant === 'gladiadores'
                  ? (['1v1', '2v2'] as GladiadoresFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick(700);
                          onChangeGladiadoresFormat(fmt);
                          setGroupMenuOpen(false);
                        }}
                        className={`py-1 text-[10px] sm:text-[11px] font-black uppercase border cursor-pointer ${
                          gladiadoresFormat === fmt
                            ? 'bg-cyan-500 text-black border-cyan-200'
                            : 'bg-black/50 hover:bg-white/10 text-white border-white/15'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))
                  : (['solo', 'duo', 'squad'] as MatchMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={!isPartyLeader}
                        onClick={() => {
                          soundEngine.playUiClick(700);
                          onChangeMatchMode(m);
                          setGroupMenuOpen(false);
                        }}
                        className={`py-1 text-[10px] sm:text-[11px] font-black uppercase border cursor-pointer disabled:opacity-50 ${
                          matchMode === m
                            ? 'bg-cyan-500 text-black border-cyan-200'
                            : 'bg-black/50 hover:bg-white/10 text-white border-white/15'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
              </div>

              <div className="space-y-1 pt-1 border-t border-white/10">
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold uppercase text-neutral-300">
                  <span>AMIGOS ({sortedFriends.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupMenuOpen(false);
                      onOpenFriends();
                    }}
                    className="text-amber-300 hover:underline cursor-pointer"
                  >
                    ABRIR LISTA
                  </button>
                </div>
                {sortedFriends.length > 0 ? (
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {sortedFriends.slice(0, 4).map((f) => {
                      const online = f.presence === 'lobby' || f.presence === 'matchmaking';
                      return (
                        <div
                          key={f.friendshipId}
                          className="flex items-center justify-between gap-2 bg-black/45 px-2 py-1 border border-white/10"
                        >
                          <button
                            type="button"
                            onClick={() => onInspectPlayer(f.account.id)}
                            className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                online ? 'bg-emerald-400' : 'bg-neutral-500'
                              }`}
                            />
                            <span className="text-[10px] font-bold truncate">{f.account.nickname}</span>
                          </button>
                          <button
                            type="button"
                            disabled={!online}
                            onClick={() => void handleQuickInviteFriend(f)}
                            className="px-1.5 py-0.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black text-[9px] font-black uppercase cursor-pointer"
                          >
                            CONVIDAR
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupMenuOpen(false);
                      onOpenFriends();
                    }}
                    className="w-full py-1 bg-white/5 hover:bg-white/10 border border-white/15 text-[10px] font-bold text-cyan-200 cursor-pointer"
                  >
                    + ADICIONAR AMIGOS POR ID
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Side-by-Side GROUP & PLAY Buttons */}
          {isSearchingMatch ? (
            <div className="w-full bg-[#111924]/95 border border-amber-400 px-2.5 py-1.5 sm:py-2 flex items-center justify-between gap-2 shadow-[0_0_20px_rgba(251,191,36,0.28)] shrink-0">
              <div className="flex-1 text-center leading-tight">
                <div className="text-sm sm:text-lg font-black font-mono tabular-nums text-amber-300">
                  {Math.floor(searchElapsedSec / 60)}:
                  {String(searchElapsedSec % 60).padStart(2, '0')}
                </div>
                <div className="text-[9px] sm:text-[11px] font-bold tracking-wide text-neutral-200">
                  Buscando partida...
                </div>
              </div>
              {(!account || isPartyLeader) && (
                <button
                  type="button"
                  onClick={onCancelSearch}
                  title="Cancelar busca"
                  className="p-1 sm:p-1.5 bg-black/60 hover:bg-red-900/90 border border-white/20 text-neutral-200 hover:text-white cursor-pointer transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick(650);
                  setGroupMenuOpen((v) => !v);
                }}
                className="py-1.5 sm:py-2.5 md:py-3 bg-gradient-to-b from-[#2fb7da] to-[#138aa8] hover:brightness-110 active:scale-[0.985] border border-cyan-200/40 text-white font-bold text-xs sm:text-sm md:text-base uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xl cursor-pointer transition-all"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="currentColor" aria-hidden="true">
                  <path d="M3 7h8l2 2-1.5 2H8L6.5 16H4l1-5H3V7zm18 0h-8l-2 2 1.5 2H16l1.5 5H20l-1-5h2V7z" />
                </svg>
                <span>GROUP</span>
              </button>

              <button
                type="button"
                disabled={Boolean(account && !isPartyLeader)}
                onClick={onStartMatch}
                className="py-1.5 sm:py-2.5 md:py-3 bg-gradient-to-b from-[#f59e0b] to-[#d97706] hover:brightness-110 active:scale-[0.985] disabled:from-neutral-700 disabled:to-neutral-700 disabled:text-neutral-300 border border-amber-200/45 text-[#181002] font-bold text-xs sm:text-sm md:text-base uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.38)] cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                <svg viewBox="0 0 28 20" className="w-4 h-3.5 sm:w-5 sm:h-4 shrink-0" fill="currentColor" aria-hidden="true">
                  <path d="M2 4h20v4H13l-1 4h-2l.5 5H6l1.2-9H2V4zm21 1h3v2h-3V5z" />
                </svg>
                <span>{account && !isPartyLeader ? 'WAIT...' : 'PLAY'}</span>
              </button>
            </div>
          )}
        </div>

        {/* CENTER-LEFT PODIUM SLOTS FOR DUO / SQUAD / 2v2 (anchored left of right panel so they NEVER overlap GROUP/PLAY on small screens!) */}
        {showPodiumSlots && (
          <div className="pointer-events-auto absolute bottom-0 left-14 right-[50%] sm:left-20 sm:right-[49%] lg:left-1/2 lg:right-auto lg:-translate-x-1/2 flex flex-col items-center gap-1 z-30 max-w-[460px]">
            <div
              className={`grid gap-1 sm:gap-1.5 w-full ${
                maxTeamSlots === 2 ? 'grid-cols-2 max-w-[300px]' : 'grid-cols-2 sm:grid-cols-4'
              }`}
            >
              {Array.from({ length: maxTeamSlots }).map((_, idx) => {
                const member = effectiveMembers[idx];
                if (member) {
                  const isSelf = account ? member.accountId === account.id : idx === 0;
                  const memberRank = getRankInfo(member.rankPoints);
                  const isAlreadyFriend = friends.some(
                    (f) => f.account.id === member.accountId,
                  );
                  const menuOpen = selectedSlotAccountId === member.accountId && !isSelf;
                  return (
                    <div key={`${member.accountId}-${idx}`} className="relative">
                      {menuOpen && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-40 bg-[#101620]/98 border-2 border-amber-400 p-1 shadow-2xl space-y-1 z-50">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSlotAccountId(null);
                              if (member.accountId > 0) {
                                onInspectPlayer(member.accountId);
                              }
                            }}
                            className="w-full px-2 py-1 bg-white/5 hover:bg-amber-400 hover:text-black text-left text-[10px] font-black uppercase cursor-pointer"
                          >
                            VER PERFIL
                          </button>

                          {account && member.accountId > 0 && !isAlreadyFriend && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleSendFriendFromSlot(member.publicId, member.nickname)
                              }
                              className="w-full px-2 py-1 bg-emerald-950/80 hover:bg-emerald-400 hover:text-black text-emerald-200 text-left text-[10px] font-black uppercase cursor-pointer"
                            >
                              ADICIONAR AMIGO
                            </button>
                          )}

                          {isPartyLeader && member.accountId > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSlotAccountId(null);
                                onKickMember(member.accountId);
                              }}
                              className="w-full px-2 py-1 bg-red-950/80 hover:bg-red-500 hover:text-white text-red-200 text-left text-[10px] font-black uppercase cursor-pointer"
                            >
                              EXPULSAR
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedSlotAccountId(null)}
                            className="w-full px-2 py-1 bg-black/40 hover:bg-white/10 text-neutral-400 text-center text-[9px] font-bold uppercase cursor-pointer"
                          >
                            FECHAR
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick(650);
                          if (isSelf) {
                            setSelectedSlotAccountId(null);
                            onOpenMyProfile();
                          } else {
                            setSelectedSlotAccountId((cur) =>
                              cur === member.accountId ? null : member.accountId,
                            );
                          }
                        }}
                        className={`w-full bg-[#0e131b]/90 hover:border-amber-300 border-b-2 px-1.5 py-0.5 sm:py-1 flex items-center justify-between gap-1 shadow-xl cursor-pointer transition-colors ${
                          member.isLeader ? 'border-amber-400' : 'border-cyan-400/80'
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <img
                            src={getPlayerAvatar(
                              member.avatarId ?? member.character?.avatarId,
                              member.character?.modelId,
                            )}
                            alt={member.nickname}
                            className="w-4 h-4 sm:w-5 sm:h-5 object-cover object-top border border-white/30 shrink-0"
                          />
                          {member.isLeader && (
                            <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
                          )}
                          <span className="text-[9px] sm:text-[11px] font-black text-white truncate">
                            {member.nickname}
                          </span>
                        </div>
                        <RankEmblemSvg
                          color={memberRank.color}
                          accent={memberRank.accent}
                          iconUrl={memberRank.iconUrl}
                          alt={memberRank.name}
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                        />
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={`empty-slot-${idx}`}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onOpenFriends();
                    }}
                    className="w-full bg-black/55 hover:bg-cyan-950/75 border border-dashed border-white/30 hover:border-cyan-400 px-1.5 py-0.5 sm:py-1 flex items-center justify-between gap-1 text-[9px] sm:text-[10px] text-neutral-200 cursor-pointer transition-colors shadow-lg"
                    title="Convidar amigo para este slot"
                  >
                    <span className="truncate font-bold">
                      {autoFillBots ? 'Bot / +' : '+ Convidar'}
                    </span>
                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-300 shrink-0" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(520);
                setSelectedSlotAccountId(null);
                if (gameVariant === 'gladiadores') {
                  onChangeGladiadoresFormat('1v1');
                } else if (partyMembers.length > 1) {
                  onLeaveParty();
                } else {
                  onChangeMatchMode('solo');
                }
              }}
              className="px-3 py-0.5 bg-black/75 hover:bg-red-900/90 border border-white/25 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-neutral-100 flex items-center gap-1 cursor-pointer shadow-lg transition-colors"
            >
              <LogOut className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300" />
              <span>SAIR</span>
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM-LEFT FOOTER: compact single-row controls */}
      <footer className="flex items-center justify-between gap-2 pt-0.5 shrink-0">
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              onToggleMute();
            }}
            title={muted ? 'Ativar Som' : 'Silenciar Música'}
            className="p-1 sm:p-1.5 hover:bg-white/10 text-cyan-300 cursor-pointer transition-colors shrink-0"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-300" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenAuth();
            }}
            className="px-2 py-0.5 sm:py-1 bg-black/50 hover:bg-black/80 border border-white/15 text-[9px] sm:text-[10px] font-mono text-white/85 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            title="Gerenciar Conta / Login Google"
          >
            <KeyRound className="w-3 h-3 shrink-0" />
            <span>{account && !isGuest ? `#${account.publicId}` : 'CONTA / GOOGLE'}</span>
          </button>

          <button
            type="button"
            onClick={onBackToMenu}
            className="px-2 py-0.5 sm:py-1 bg-black/50 hover:bg-red-950/80 border border-white/15 text-[9px] sm:text-[10px] font-mono text-white/80 hover:text-white flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            title="Voltar para Tela Inicial"
          >
            <LogOut className="w-3 h-3 shrink-0" />
            <span>MENU</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenCredits();
            }}
            className="hidden sm:flex px-2 py-1 bg-black/50 hover:bg-black/80 border border-white/15 text-[10px] font-mono text-white/80 hover:text-white items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            title="Créditos"
          >
            <Info className="w-3 h-3" />
            <span>CRÉDITOS</span>
          </button>
        </div>

        {/* Mobile quick Ping indicator at bottom-right when lg badge is hidden */}
        <div className="pointer-events-auto flex lg:hidden items-center gap-1.5 shrink-0">
          <NetworkPingBadge
            pingMs={pingInfo.pingMs}
            disconnected={pingInfo.disconnected}
          />
        </div>
      </footer>
    </div>
  );
};
