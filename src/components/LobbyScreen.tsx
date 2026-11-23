import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Crown,
  Diamond,
  Info,
  KeyRound,
  LogOut,
  Move,
  Play,
  Plus,
  Settings,
  Shield,
  ShieldCheck,
  Swords,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getCharacterAvatar } from '../game/avatars';
import { soundEngine } from '../game/audio';
import { multiplayerClient, PingStatus } from '../game/multiplayerClient';
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
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  profile,
  character,
  brMapId,
  gameVariant,
  gladiadoresFormat,
  gladiadoresTargetRounds,
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
}) => {
  const [pingInfo, setPingInfo] = useState<PingStatus>(() => multiplayerClient.getPingInfo());
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [friendsCollapsed, setFriendsCollapsed] = useState(false);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [selectedSlotAccountId, setSelectedSlotAccountId] = useState<number | null>(null);
  const [inviteToast, setInviteToast] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPingInfo(multiplayerClient.getPingInfo());
    }, 350);
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
            publicId: account?.publicId ?? 'LOCAL',
            nickname: profile.nickname,
            level: profile.level,
            rankPoints: profile.rankPoints,
            character,
            ready: true,
            isLeader: true,
          },
        ];

  const handleQuickInviteFriend = async (friend: FriendEntry) => {
    if (!account) {
      onOpenAuth();
      return;
    }
    try {
      if (matchMode === 'solo' && isPartyLeader) {
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

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-2 sm:p-3.5 text-white select-none">
      {/* TOP BAR: Left Player Banner + Gold/Diamonds | Right FREE FIRE Logo & Utility Icons */}
      <header className="flex items-start justify-between gap-2">
        {/* Top-Left Banner (Exact FF layout: Avatar + Nick + Rank + Gold + Diamonds) */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick(680);
              onOpenMyProfile();
            }}
            className="flex items-center gap-2.5 bg-gradient-to-r from-[#0e141e]/92 to-[#131b29]/80 hover:from-[#172233] hover:to-[#1d293e] border border-white/25 pr-3 pl-1 py-1 shadow-xl cursor-pointer transition-colors group"
            title="Ver Meu Perfil Completo"
          >
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 border-2 border-amber-400/80 bg-black shrink-0 overflow-hidden">
              <img
                src={getCharacterAvatar(character.modelId)}
                alt={character.name}
                className="w-full h-full object-cover object-top"
              />
              <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[8px] font-black text-amber-300 text-center leading-tight">
                Nv.{profile.level}
              </span>
            </div>

            <div className="text-left min-w-[82px] max-w-[140px]">
              <div className="text-xs sm:text-sm font-black tracking-wide truncate group-hover:text-amber-300">
                {profile.nickname}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-1 flex-1 bg-white/15 overflow-hidden min-w-[44px]">
                  <div className="h-full bg-amber-400 w-3/4" />
                </div>
                <RankEmblemSvg
                  color={rank.color}
                  accent={rank.accent}
                  className="w-4 h-4 shrink-0"
                />
              </div>
            </div>
          </button>

          {/* Gold & Diamonds Counters */}
          <div className="flex items-center gap-2 bg-black/70 border border-white/15 px-2.5 py-1.5 shadow-lg">
            <div className="flex items-center gap-1 text-xs font-mono font-black text-amber-200 tabular-nums">
              <IconCoinSvg className="w-4 h-4 shrink-0" />
              <span>{profile.gold}</span>
            </div>
            <div className="w-px h-3.5 bg-white/20" />
            <div className="flex items-center gap-1 text-xs font-mono font-black text-sky-300 tabular-nums">
              <Diamond className="w-3.5 h-3.5 fill-sky-400/35 shrink-0" />
              <span>{profile.gems}+</span>
            </div>
          </div>

          {/* Cloud Account Login / Status Pill */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenAuth();
            }}
            className={`px-2.5 py-1.5 border text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shadow-lg ${
              account
                ? 'bg-emerald-950/85 hover:bg-emerald-900 border-emerald-400/60 text-emerald-200'
                : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-black'
            }`}
            title={account ? `Conta #${account.publicId}` : 'Entrar ou Criar Conta para Multiplayer'}
          >
            {account ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">#{account.publicId}</span>
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span>ENTRAR</span>
              </>
            )}
          </button>
        </div>

        {/* Top-Right: FREE FIRE Title + Icons + Network Ping */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          <div className="hidden md:flex items-center pr-2 mr-1 select-none">
            <span className="text-xl font-black italic tracking-wider text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
              FREE F<span className="text-amber-400">I</span>RE
            </span>
          </div>

          <NetworkPingBadge
            pingMs={pingInfo.pingMs}
            disconnected={pingInfo.disconnected}
          />

          <VoiceChatHudWidget compact />

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenRankModal();
            }}
            title="Patentes e Pontuação"
            className="bg-black/70 hover:bg-amber-500 hover:text-black border border-white/20 p-2 cursor-pointer transition-colors"
          >
            <Shield className="w-4 h-4 text-amber-300" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenFriends();
            }}
            title="Amigos e Solicitações"
            className="bg-black/70 hover:bg-emerald-500 hover:text-black border border-white/20 p-2 cursor-pointer transition-colors"
          >
            <Users className="w-4 h-4 text-emerald-300" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              onToggleMute();
            }}
            title={muted ? 'Ativar Som' : 'Silenciar'}
            className="bg-black/70 hover:bg-neutral-900 border border-white/20 p-2 cursor-pointer transition-colors"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-300" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenSettings();
            }}
            title="Configurações"
            className="bg-black/70 hover:bg-neutral-900 border border-white/20 p-2 cursor-pointer transition-colors"
          >
            <Settings className="w-4 h-4 text-neutral-100" />
          </button>

          <button
            type="button"
            onClick={onBackToMenu}
            title="Voltar ao Menu"
            className="bg-black/70 hover:bg-red-900 border border-white/20 p-2 cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </header>

      {/* MIDDLE ROW: Left Slim Edge Menu | Open Center 3D Viewport | Right Quick-Invite Friend Rail */}
      <div className="flex-1 flex items-center justify-between gap-2 py-2 min-h-0 relative">
        {/* Left Compact Edge Stack matching STORE / LUCK ROYALE / BOOYAH PASS / MISSIONS / EVENTS */}
        <nav className="pointer-events-auto flex flex-col gap-1.5 w-32 sm:w-40 self-start mt-4">
          <button
            type="button"
            onClick={onQuickTraining}
            className="bg-gradient-to-r from-black/82 to-black/45 hover:from-amber-500/90 hover:to-amber-600/70 hover:text-black border-l-4 border-amber-400 px-2.5 py-2 text-left flex items-center gap-2 cursor-pointer transition-all shadow-md"
          >
            <Crosshair className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
              TREINAMENTO
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenRankModal();
            }}
            className="bg-gradient-to-r from-black/82 to-black/45 hover:from-amber-500/90 hover:to-amber-600/70 hover:text-black border-l-4 border-yellow-300 px-2.5 py-2 text-left flex items-center gap-2 cursor-pointer transition-all shadow-md"
          >
            <Award className="w-3.5 h-3.5 shrink-0 text-yellow-300" />
            <span className="text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
              PATENTES
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenHudEditor();
            }}
            className="bg-gradient-to-r from-black/82 to-black/45 hover:from-sky-500/90 hover:to-sky-600/70 hover:text-black border-l-4 border-sky-400 px-2.5 py-2 text-left flex items-center gap-2 cursor-pointer transition-all shadow-md"
          >
            <Move className="w-3.5 h-3.5 shrink-0 text-sky-400" />
            <span className="text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
              HUD CUSTOM
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenCredits();
            }}
            className="bg-gradient-to-r from-black/82 to-black/45 hover:from-white/20 hover:to-white/10 border-l-4 border-neutral-300 px-2.5 py-2 text-left flex items-center gap-2 cursor-pointer transition-all shadow-md"
          >
            <Info className="w-3.5 h-3.5 shrink-0 text-neutral-300" />
            <span className="text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
              CRÉDITOS
            </span>
          </button>

          {/* Compact Toast Feedback */}
          {inviteToast && (
            <div className="mt-1 px-2 py-1.5 bg-emerald-950/90 border border-emerald-400 text-[10px] font-bold text-emerald-200 shadow-lg">
              {inviteToast}
            </div>
          )}
        </nav>

        {/* Incoming Party Invites Floating Card (top-center-right so it never blocks character face) */}
        {invites.length > 0 && (
          <div className="pointer-events-auto absolute top-1 left-1/2 -translate-x-1/2 flex flex-col gap-1.5 w-72 sm:w-88 z-40">
            {invites.slice(0, 2).map((inv) => (
              <div
                key={inv.inviteId}
                className="bg-[#111924]/95 border-2 border-emerald-400 px-3 py-2 shadow-2xl flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-emerald-300 truncate">
                    CONVITE DE {inv.fromNickname}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-300">
                    {inv.isRanked ? 'BR RANQUEADO' : 'CLÁSSICO'} · {inv.mode.toUpperCase()}
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

        {/* Right Edge Column: Quick-Invite Friends Rail + Created Duo/Squad Team Panel */}
        <div className="pointer-events-auto flex flex-col items-end gap-2 self-stretch justify-between py-1">
          {/* Quick-Invite Vertical Friend Strip matching screenshot (Hayato +, Andrew +) */}
          <div className="flex flex-col items-end gap-1">
            {!friendsCollapsed && (
              <div className="flex flex-col gap-1 w-28 sm:w-32">
                {account && sortedFriends.length > 0 ? (
                  sortedFriends.slice(0, 4).map((f) => {
                    const isOnline = f.presence === 'lobby' || f.presence === 'matchmaking';
                    const isInMatch = f.presence === 'in_match';
                    return (
                      <div
                        key={f.friendshipId}
                        className="bg-black/75 border border-white/15 flex items-center justify-between pr-1 hover:border-amber-400/60 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => onInspectPlayer(f.account.id)}
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                          title={`Ver perfil de ${f.account.nickname}`}
                        >
                          <div className="relative w-8 h-8 shrink-0 bg-neutral-900">
                            <img
                              src={getCharacterAvatar(f.account.character?.modelId)}
                              alt={f.account.nickname}
                              className="w-full h-full object-cover object-top"
                            />
                            <span
                              className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-black ${
                                isOnline
                                  ? 'bg-emerald-400'
                                  : isInMatch
                                    ? 'bg-sky-400'
                                    : 'bg-neutral-500'
                              }`}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-white truncate">
                            {f.account.nickname}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={!isOnline}
                          onClick={() => void handleQuickInviteFriend(f)}
                          title={isOnline ? 'Convidar para equipe' : 'Jogador indisponível'}
                          className="w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-amber-400 hover:text-black disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <button
                    type="button"
                    onClick={onOpenFriends}
                    className="bg-black/75 hover:bg-black/95 border border-white/20 px-2 py-1.5 flex items-center justify-between gap-1 text-[10px] font-bold uppercase text-neutral-200 cursor-pointer"
                  >
                    <span className="truncate">{account ? 'ADD AMIGOS' : 'AMIGOS'}</span>
                    <Plus className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setFriendsCollapsed((v) => !v)}
              title={friendsCollapsed ? 'Mostrar lista rápida de amigos' : 'Recolher'}
              className="w-8 h-6 bg-black/80 hover:bg-neutral-800 border border-white/20 flex items-center justify-center cursor-pointer"
            >
              {friendsCollapsed ? (
                <ChevronLeft className="w-4 h-4 text-amber-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-neutral-300" />
              )}
            </button>
          </div>
        </div>

        {/* CENTER-BOTTOM PODIUM SLOTS FOR DUO / SQUAD FORMATION (Matching Free Fire 4-man lobby screenshot) */}
        {((gameVariant === 'gladiadores' && gladiadoresFormat === '2v2') ||
          (gameVariant === 'br' && matchMode !== 'solo')) && (
          <div className="pointer-events-auto absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-30 w-full max-w-[94vw] sm:max-w-[660px] px-2">
            <div
              className={`grid gap-2 w-full ${
                maxTeamSlots === 2
                  ? 'grid-cols-2 max-w-[380px]'
                  : 'grid-cols-2 sm:grid-cols-4'
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
                      {/* Context Action Menu on clicking a teammate nameplate */}
                      {menuOpen && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 bg-[#101620]/98 border-2 border-amber-400 p-1 shadow-2xl space-y-1 z-50">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSlotAccountId(null);
                              if (member.accountId > 0) {
                                onInspectPlayer(member.accountId);
                              }
                            }}
                            className="w-full px-2.5 py-1.5 bg-white/5 hover:bg-amber-400 hover:text-black text-left text-[10px] font-black uppercase cursor-pointer"
                          >
                            VER PERFIL
                          </button>

                          {account && member.accountId > 0 && !isAlreadyFriend && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleSendFriendFromSlot(member.publicId, member.nickname)
                              }
                              className="w-full px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-400 hover:text-black text-emerald-200 text-left text-[10px] font-black uppercase cursor-pointer"
                            >
                              ENVIAR PEDIDO AMIZADE
                            </button>
                          )}

                          {isPartyLeader && member.accountId > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSlotAccountId(null);
                                onKickMember(member.accountId);
                              }}
                              className="w-full px-2.5 py-1.5 bg-red-950/80 hover:bg-red-500 hover:text-white text-red-200 text-left text-[10px] font-black uppercase cursor-pointer"
                            >
                              EXPULSAR DA EQUIPE
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedSlotAccountId(null)}
                            className="w-full px-2.5 py-1 bg-black/40 hover:bg-white/10 text-neutral-400 text-center text-[9px] font-bold uppercase cursor-pointer"
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
                        className={`w-full bg-gradient-to-r from-[#0e131b]/92 via-[#171f2e]/90 to-[#0e131b]/92 hover:border-amber-300 border-b-2 px-2 py-1 flex items-center justify-between gap-1.5 shadow-xl cursor-pointer transition-colors ${
                          member.isLeader
                            ? 'border-amber-400'
                            : 'border-red-500/80'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <img
                            src={getCharacterAvatar(member.character?.modelId)}
                            alt={member.nickname}
                            className="w-5 h-5 object-cover object-top border border-white/30 shrink-0"
                          />
                          {member.isLeader && (
                            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                          )}
                          <span className="text-[11px] font-black text-white truncate">
                            {member.nickname}
                          </span>
                        </div>
                        <RankEmblemSvg
                          color={memberRank.color}
                          accent={memberRank.accent}
                          className="w-4 h-4 shrink-0"
                        />
                      </button>
                    </div>
                  );
                }

                // Empty Podium Invite Slot
                return (
                  <button
                    key={`empty-slot-${idx}`}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onOpenFriends();
                    }}
                    className="w-full bg-black/55 hover:bg-emerald-950/75 border border-dashed border-white/30 hover:border-emerald-400 px-2 py-1 flex items-center justify-between gap-1.5 text-[10px] text-neutral-200 cursor-pointer transition-colors shadow-lg"
                    title="Convidar amigo para este slot"
                  >
                    <span className="truncate font-bold">
                      {autoFillBots ? 'Bot Aliado / +' : '+ Convidar'}
                    </span>
                    <Plus className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* SAIR button centered right below formation slots (matches screenshot) */}
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
              className="px-4 py-1 bg-black/75 hover:bg-red-900/90 border border-white/25 text-[10px] font-black uppercase tracking-widest text-neutral-100 flex items-center gap-1 cursor-pointer shadow-lg transition-colors"
            >
              <LogOut className="w-3 h-3 text-amber-300" />
              <span>SAIR</span>
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM BAR: Left Divider Strip ([F] | COFRE | ARMAS | PERSONAGEM | AMIGOS) & Right Launch Cluster */}
      <footer className="flex flex-wrap items-end justify-between gap-2">
        {/* Bottom-Left Sleek Divider Strip matching [F] | VAULT | WEAPON | CHARACTER | LAB */}
        <div className="pointer-events-auto flex items-center bg-[#0b1017]/88 border border-white/20 shadow-xl overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick(660);
              onOpenMyProfile();
            }}
            className="px-3 py-2 hover:bg-white/10 text-amber-400 font-black text-sm tracking-tight cursor-pointer shrink-0"
            title="Ver Meu Perfil"
          >
            F
          </button>

          <span className="text-white/20 text-xs">|</span>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenArsenal();
            }}
            className="px-3 sm:px-4 py-2 hover:bg-amber-500/20 text-[11px] font-black uppercase tracking-wider text-neutral-100 cursor-pointer whitespace-nowrap shrink-0"
          >
            COFRE
          </button>

          <span className="text-white/20 text-xs">|</span>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenArsenal();
            }}
            className="px-3 sm:px-4 py-2 hover:bg-amber-500/20 text-[11px] font-black uppercase tracking-wider text-neutral-100 cursor-pointer whitespace-nowrap shrink-0"
          >
            ARMAS
          </button>

          <span className="text-white/20 text-xs">|</span>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenCharacter();
            }}
            className="px-3 sm:px-4 py-2 hover:bg-amber-500/20 text-[11px] font-black uppercase tracking-wider text-amber-300 cursor-pointer whitespace-nowrap shrink-0"
          >
            PERSONAGEM
          </button>

          <span className="text-white/20 text-xs">|</span>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenFriends();
            }}
            className="px-3 sm:px-4 py-2 hover:bg-emerald-500/20 text-[11px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span>AMIGOS</span>
          </button>
        </div>

        {/* Bottom-Right Mode Banner + Team Selector + Glossy Golden INICIAR */}
        <div className="pointer-events-auto relative flex flex-col items-end gap-1.5 w-64 sm:w-72 ml-auto">
          {/* Team Mode Popover when open */}
          {teamPickerOpen && (
            <div className="absolute bottom-full right-0 mb-1.5 w-48 bg-[#121822]/98 border-2 border-amber-400 p-1.5 shadow-2xl space-y-1 z-40">
              {gameVariant === 'gladiadores'
                ? (['1v1', '2v2'] as GladiadoresFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick(700);
                        onChangeGladiadoresFormat(fmt);
                        setTeamPickerOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 text-left text-[11px] font-black uppercase flex items-center justify-between cursor-pointer ${
                        gladiadoresFormat === fmt
                          ? 'bg-red-500 text-white'
                          : 'bg-black/40 hover:bg-white/10 text-white'
                      }`}
                    >
                      <span>{fmt}</span>
                      <span className="text-[9px] font-mono">
                        {fmt === '1v1' ? 'Duelo 1x1' : 'Dupla 2x2'}
                      </span>
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
                        setTeamPickerOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 text-left text-[11px] font-black uppercase flex items-center justify-between cursor-pointer disabled:opacity-50 ${
                        matchMode === m
                          ? 'bg-amber-400 text-black'
                          : 'bg-black/40 hover:bg-white/10 text-white'
                      }`}
                    >
                      <span>{m}</span>
                      <span className="text-[9px] font-mono">
                        {m === 'solo' ? '1 Jogador' : m === 'duo' ? 'Equipe 2' : 'Equipe 4'}
                      </span>
                    </button>
                  ))}
            </div>
          )}

          {/* Row 1: BR-RANKED / GLADIADORES + Team Pill */}
          <div className="w-full flex items-stretch gap-1">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(700);
                onOpenModeSelect();
              }}
              className="flex-1 bg-[#141923]/92 hover:bg-[#1b2230] border border-white/25 px-2.5 py-1.5 flex items-center gap-2 text-left cursor-pointer transition-colors min-w-0"
            >
              {gameVariant === 'gladiadores' ? (
                <div className="w-7 h-7 bg-red-950/90 border border-red-400/80 flex items-center justify-center shrink-0">
                  <Swords className="w-4 h-4 text-amber-300" />
                </div>
              ) : (
                <RankEmblemSvg
                  color={rank.color}
                  accent={rank.accent}
                  className="w-7 h-7 shrink-0"
                />
              )}
              <div className="min-w-0 leading-tight">
                <div className="text-[11px] sm:text-xs font-black uppercase text-white truncate">
                  {gameVariant === 'gladiadores'
                    ? `GLADIADORES · ${gladiadoresFormat.toUpperCase()}`
                    : isRanked
                      ? 'BR-RANQUEADO'
                      : 'CLÁSSICO · BR'}
                </div>
                <div className="text-[9px] font-mono text-amber-300 truncate">
                  {gameVariant === 'gladiadores'
                    ? `Arena 3D · ${gladiadoresTargetRounds} Rodadas`
                    : `${brMapId === 'bermuda' ? 'Bermuda' : 'João Pessoa'} · ${isRanked ? 'Pontos Rank' : 'Sem Pontos'}`}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(650);
                setTeamPickerOpen((v) => !v);
              }}
              className="bg-[#141923]/92 hover:bg-[#1e2636] border border-amber-400/60 px-2.5 py-1.5 flex flex-col items-center justify-center cursor-pointer transition-colors shrink-0 min-w-[66px]"
              title={gameVariant === 'gladiadores' ? 'Mudar 1v1 / 2v2' : 'Mudar Solo / Duo / Squad'}
            >
              <Users className="w-4 h-4 text-amber-300" />
              <span className="text-[9px] font-black uppercase tracking-wider text-white mt-0.5">
                {gameVariant === 'gladiadores' ? gladiadoresFormat : matchMode}
              </span>
            </button>
          </div>

          {/* Row 2: Auto Formação Toggle (when BR Duo/Squad) + Big Glossy Golden INICIAR */}
          {gameVariant === 'br' && matchMode !== 'solo' && (
            <button
              type="button"
              disabled={!isPartyLeader}
              onClick={() => {
                soundEngine.playUiClick(640);
                onChangeAutoFillBots(!autoFillBots);
              }}
              className={`w-full px-2.5 py-1 border text-[10px] font-black uppercase flex items-center justify-between cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                autoFillBots
                  ? 'bg-emerald-950/85 border-emerald-400/70 text-emerald-200'
                  : 'bg-[#12161d]/90 border-neutral-600 text-neutral-300'
              }`}
              title="Completar vagas da equipe com bots aliados"
            >
              <span>AUTO FORMAÇÃO</span>
              <span className="font-mono">{autoFillBots ? 'ON (BOTS)' : 'OFF'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={Boolean(account && !isPartyLeader)}
            onClick={onStartMatch}
            className="w-full py-2.5 sm:py-3 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 hover:brightness-110 disabled:from-neutral-700 disabled:to-neutral-700 disabled:text-neutral-300 border border-yellow-100/80 text-black font-black text-base sm:text-lg uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(251,191,36,0.45)] active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current shrink-0" />
            <span>
              {account && !isPartyLeader ? 'AGUARDANDO...' : 'INICIAR'}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
};
