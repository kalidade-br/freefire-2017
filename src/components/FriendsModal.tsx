import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Search,
  Send,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { getPlayerAvatar } from '../game/avatars';
import { multiplayerClient } from '../game/multiplayerClient';
import { getRankInfo } from '../game/types';
import {
  FriendEntry,
  FriendRequestEntry,
  PresenceStatus,
  PublicPlayerAccount,
} from '../shared/multiplayerTypes';
import { RankEmblemSvg } from './HudIcons';
import { PlayerProfileModal, profileFromAccount } from './PlayerProfileModal';

interface FriendsModalProps {
  currentAccount: PublicPlayerAccount;
  onInviteSent?: (targetNick: string) => void;
  onClose: () => void;
}

const PRESENCE_META: Record<
  PresenceStatus,
  { label: string; dot: string; text: string }
> = {
  lobby: { label: 'No Lobby', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  matchmaking: { label: 'Buscando', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300' },
  in_match: { label: 'Em Partida', dot: 'bg-sky-400', text: 'text-sky-300' },
  offline: { label: 'Offline', dot: 'bg-neutral-500', text: 'text-neutral-400' },
};

export const FriendsModal: React.FC<FriendsModalProps> = ({
  currentAccount,
  onInviteSent,
  onClose,
}) => {
  const [tab, setTab] = useState<'friends' | 'add' | 'requests'>('friends');
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<PublicPlayerAccount | null>(null);
  const [inspectProfile, setInspectProfile] = useState<PublicPlayerAccount | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFriends = useCallback(async () => {
    try {
      const data = await multiplayerClient.getFriends();
      setFriends(data.friends);
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
    } catch {
      // ignore transient fetch issues
    }
  }, []);

  useEffect(() => {
    void loadFriends();
    const timer = window.setInterval(() => {
      void loadFriends();
    }, 5000);
    const unsub = multiplayerClient.subscribe((ev) => {
      if (ev.type === 'friends_refresh') {
        void loadFriends();
      }
    });
    return () => {
      window.clearInterval(timer);
      unsub();
    };
  }, [loadFriends]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setBusy(true);
    setStatusMsg(null);
    setSearchResult(null);
    try {
      const res = await multiplayerClient.searchPlayer(q);
      setSearchResult(res.player);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Jogador não encontrado.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendRequest = async (target: string) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await multiplayerClient.sendFriendRequest(target);
      setStatusMsg(
        res.status === 'accepted'
          ? `Vocês agora são amigos com ${res.target.nickname}!`
          : `Pedido de amizade enviado para ${res.target.nickname}!`,
      );
      await loadFriends();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Não foi possível enviar pedido.');
    } finally {
      setBusy(false);
    }
  };

  const handleRespond = async (friendshipId: number, accept: boolean) => {
    setBusy(true);
    try {
      const data = await multiplayerClient.respondFriendRequest(friendshipId, accept);
      setFriends(data.friends);
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
      setStatusMsg(accept ? 'Amigo adicionado!' : 'Solicitação recusada.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Erro ao responder solicitação.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveFriend = async (friendId: number) => {
    setBusy(true);
    try {
      await multiplayerClient.removeFriend(friendId);
      setInspectProfile(null);
      await loadFriends();
    } finally {
      setBusy(false);
    }
  };

  const handleInviteParty = async (friend: FriendEntry) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await multiplayerClient.inviteToParty(friend.account.id);
      setStatusMsg(`Convite enviado para ${friend.account.nickname}!`);
      onInviteSent?.(friend.account.nickname);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Falha ao convidar.');
    } finally {
      setBusy(false);
    }
  };

  const handleViewProfile = async (accountId: number) => {
    try {
      const res = await multiplayerClient.getPlayerProfile(accountId);
      setInspectProfile(res.player);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 text-white"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#14181e] border-2 border-amber-500 shadow-2xl flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1d232c] border-b border-neutral-700">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-black text-sm tracking-widest uppercase text-amber-400 leading-none">
                AMIGOS & MULTIPLAYER
              </h2>
              <p className="text-[10px] font-mono text-neutral-300 mt-0.5">
                Seu ID Público: <strong className="text-amber-300">#{currentAccount.publicId}</strong> · Nick: {currentAccount.nickname}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 bg-[#0f1318] border-b border-neutral-700 text-xs font-black uppercase">
          <button
            type="button"
            onClick={() => setTab('friends')}
            className={`py-2.5 border-b-2 cursor-pointer whitespace-nowrap ${
              tab === 'friends'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            AMIGOS ({friends.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('add')}
            className={`py-2.5 border-b-2 cursor-pointer whitespace-nowrap ${
              tab === 'add'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            ADICIONAR (ID / NICK)
          </button>
          <button
            type="button"
            onClick={() => setTab('requests')}
            className={`py-2.5 border-b-2 cursor-pointer whitespace-nowrap ${
              tab === 'requests'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            PEDIDOS ({incoming.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {statusMsg && (
            <div className="px-3 py-2 bg-amber-950/75 border border-amber-400 text-amber-200 text-xs font-mono">
              {statusMsg}
            </div>
          )}

          {/* Full Free Fire Profile Inspector Modal */}
          {inspectProfile && (
            <PlayerProfileModal
              subject={profileFromAccount(inspectProfile, {
                isOwn: inspectProfile.id === currentAccount.id,
                isFriend: friends.some((f) => f.account.id === inspectProfile.id),
              })}
              onClose={() => setInspectProfile(null)}
              onInviteToParty={(accId) => {
                const match = friends.find((f) => f.account.id === accId);
                if (match) {
                  void handleInviteParty(match);
                }
              }}
              onAddFriend={(pubId) => {
                void handleSendRequest(pubId);
              }}
              onRemoveFriend={(accId) => {
                void handleRemoveFriend(accId);
              }}
            />
          )}

          {tab === 'friends' && (
            <div className="space-y-2">
              {friends.length === 0 ? (
                <div className="text-center py-8 text-xs font-mono text-neutral-400 space-y-2">
                  <p>Você ainda não tem amigos adicionados.</p>
                  <button
                    type="button"
                    onClick={() => setTab('add')}
                    className="px-4 py-2 bg-amber-500 text-black font-black uppercase cursor-pointer"
                  >
                    PROCURAR AMIGO POR ID OU NICK
                  </button>
                </div>
              ) : (
                friends.map((f) => {
                  const pres = PRESENCE_META[f.presence];
                  const rk = getRankInfo(f.account.rankPoints);
                  return (
                    <div
                      key={f.friendshipId}
                      className="bg-[#192029] border border-neutral-700 p-2.5 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => void handleViewProfile(f.account.id)}
                        className="flex items-center gap-2.5 text-left min-w-0 flex-1 hover:opacity-90 cursor-pointer"
                        title="Ver perfil completo do jogador"
                      >
                        <div className="relative w-10 h-10 shrink-0 border border-amber-400/60 bg-black/60">
                          <img
                            src={getPlayerAvatar(
                              f.account.avatarId ?? f.account.character?.avatarId,
                              f.account.character?.modelId,
                            )}
                            alt={f.account.nickname}
                            className="w-full h-full object-cover object-top"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-black ${pres.dot}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs text-white truncate">
                              {f.account.nickname}
                            </span>
                            <span className="text-[9px] font-mono text-neutral-400">
                              #{f.account.publicId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            <span className={pres.text}>{pres.label}</span>
                            <span className="text-neutral-400 inline-flex items-center gap-1">
                              <RankEmblemSvg
                                color={rk.color}
                                accent={rk.accent}
                                iconUrl={rk.iconUrl}
                                alt={rk.name}
                                className="w-4 h-4 shrink-0"
                              />
                              {rk.name}
                            </span>
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleViewProfile(f.account.id)}
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap"
                        >
                          PERFIL
                        </button>
                        <button
                          type="button"
                          disabled={busy || f.presence === 'offline' || f.presence === 'in_match'}
                          onClick={() => void handleInviteParty(f)}
                          className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-black text-[10px] uppercase cursor-pointer flex items-center gap-1 whitespace-nowrap"
                        >
                          <Send className="w-3 h-3" />
                          <span>CONVIDAR</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'add' && (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Digite o ID (ex: 10048219) ou Nick do jogador"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0e1218] border border-neutral-600 focus:border-amber-400 pl-9 pr-3 py-2.5 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase cursor-pointer whitespace-nowrap"
                >
                  BUSCAR
                </button>
              </form>

              {searchResult && (() => {
                const rk = getRankInfo(searchResult.rankPoints);
                const alreadyFriend = friends.some((f) => f.account.id === searchResult.id);
                const isSelf = searchResult.id === currentAccount.id;
                return (
                  <div className="bg-[#18202a] border border-amber-400/70 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={getPlayerAvatar(
                          searchResult.avatarId ?? searchResult.character?.avatarId,
                          searchResult.character?.modelId,
                        )}
                        alt={searchResult.nickname}
                        className="w-10 h-10 object-cover object-top border border-amber-400/60 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-black text-sm text-white truncate">
                          {searchResult.nickname}{' '}
                          <span className="text-[10px] font-mono text-amber-300">
                            #{searchResult.publicId}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-neutral-300 flex items-center gap-2">
                          <span>Nv.{searchResult.level}</span>
                          <span>· {rk.name}</span>
                          <span className="inline-flex items-center gap-0.5 text-red-300">
                            <Trophy className="w-3 h-3" /> {searchResult.wins} Booyahs
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleViewProfile(searchResult.id)}
                        className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap"
                      >
                        VER PERFIL
                      </button>
                      {!isSelf && !alreadyFriend && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleSendRequest(searchResult.publicId)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase cursor-pointer flex items-center gap-1 whitespace-nowrap"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>ADICIONAR</span>
                        </button>
                      )}
                      {alreadyFriend && (
                        <span className="px-2.5 py-1.5 bg-emerald-950 border border-emerald-500 text-emerald-300 text-[10px] font-bold uppercase flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>AMIGO</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-mono uppercase text-neutral-400 mb-2">
                  SOLICITAÇÕES RECEBIDAS ({incoming.length})
                </div>
                {incoming.length === 0 ? (
                  <div className="text-xs font-mono text-neutral-500 py-3">
                    Nenhum pedido pendente.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incoming.map((req) => (
                      <div
                        key={req.friendshipId}
                        className="bg-[#192029] border border-amber-400/50 p-2.5 flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => void handleViewProfile(req.account.id)}
                          className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer hover:opacity-90"
                        >
                          <img
                            src={getPlayerAvatar(
                              req.account.avatarId ?? req.account.character?.avatarId,
                              req.account.character?.modelId,
                            )}
                            alt={req.account.nickname}
                            className="w-9 h-9 object-cover object-top border border-amber-400/50 shrink-0"
                          />
                          <div>
                            <div className="text-xs font-black text-white">
                              {req.account.nickname}{' '}
                              <span className="text-[10px] font-mono text-amber-300">
                                #{req.account.publicId}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-neutral-400">
                              Nv.{req.account.level} · {req.account.rankPoints} PTS
                            </div>
                          </div>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRespond(req.friendshipId, true)}
                            className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>ACEITAR</span>
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRespond(req.friendshipId, false)}
                            className="px-2.5 py-1.5 bg-red-900/80 hover:bg-red-800 text-red-100 font-bold text-[10px] uppercase cursor-pointer"
                          >
                            RECUSAR
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {outgoing.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase text-neutral-400 mb-2">
                    ENVIADOS ({outgoing.length})
                  </div>
                  <div className="space-y-1.5">
                    {outgoing.map((req) => (
                      <div
                        key={req.friendshipId}
                        className="bg-[#12161d] border border-neutral-800 px-3 py-2 flex items-center justify-between text-xs"
                      >
                        <span>
                          {req.account.nickname} #{req.account.publicId}
                        </span>
                        <span className="text-[10px] font-mono text-amber-300">Aguardando...</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
