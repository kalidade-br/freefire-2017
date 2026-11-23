import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { soundEngine } from './game/audio';
import { BattleRoyaleEngine } from './game/gameEngine';
import { multiplayerClient } from './game/multiplayerClient';
import { voiceChatManager } from './game/voiceChat';
import { auth } from './lib/firebase';
import { loadOrCreateFirestoreProfile, saveFirestoreProfile } from './lib/firestoreProfile';
import {
  loadCharacterConfig,
  loadProfile,
  loadSettings,
  saveCharacterConfig,
  saveProfile,
  saveSettings,
} from './game/storage';
import {
  CharacterConfig,
  GameSettings,
  GameState,
  HudSnapshot,
  MatchMode,
  MinimapBuilding,
  MinimapRoad,
  PlayerProfile,
  PoiMarker,
  computeRankedPointDelta,
} from './game/types';
import {
  MatchRoomJoinInfo,
  PartyInvitePayload,
  PartyState,
  PublicPlayerAccount,
} from './shared/multiplayerTypes';
import { BootAndLoadingScreen } from './components/BootAndLoadingScreen';
import { MainMenuScreen } from './components/MainMenuScreen';
import { LobbyScreen } from './components/LobbyScreen';
import {
  ArsenalModal,
  CharacterModal,
  CreditsModal,
  SettingsModal,
} from './components/Modals';
import { MatchmakingOverlay } from './components/MatchmakingOverlay';
import { GameHud } from './components/GameHud';
import { EndMatchModal } from './components/EndMatchModal';
import { HudEditorModal } from './components/HudEditorModal';
import { BackpackModal } from './components/BackpackModal';
import { VendingShopModal } from './components/VendingShopModal';
import { RankModal } from './components/RankModal';
import { AuthModal } from './components/AuthModal';
import { FriendsModal } from './components/FriendsModal';
import { ModeSelectModal } from './components/ModeSelectModal';
import {
  PlayerProfileModal,
  ProfileModalSubject,
  profileFromAccount,
  profileFromLocal,
} from './components/PlayerProfileModal';

const INITIAL_HUD: HudSnapshot = {
  hp: 200,
  maxHp: 200,
  vestLevel: 0,
  vestHp: 0,
  vestMaxHp: 0,
  helmetLevel: 0,
  helmetHp: 0,
  helmetMaxHp: 0,
  backpackLevel: 1,
  backpackUsed: 12,
  backpackCapacity: 80,
  medkitCount: 1,
  smallkitCount: 0,
  glooCount: 2,
  grenadeCount: 2,
  ffCoins: 100,
  isRanked: false,
  isPlacingGloo: false,
  glooSkin: 'classic',
  glooPlaceDistance: 4,
  isHoldingGrenade: false,
  usingMedkit: false,
  medkitProgress: 0,
  stance: 'stand',
  isSprinting: false,
  isAiming: false,
  isGrounded: true,
  inWater: false,
  isSwimming: false,
  isOnSurfboard: false,
  isReloading: false,
  reloadProgress: 0,
  isDead: false,
  isPlayerDowned: false,
  playerBleedHp: 100,
  revivedBy: null,
  activeSlot: 3,
  activeScope: 'none',
  ownedScopes: ['none'],
  weapons: {
    1: null,
    2: null,
    3: {
      weaponId: 'g18',
      ammoInMag: 15,
      reserveAmmo: 60,
      scope: 'none',
      attachments: { muzzle: null, foregrip: null, magazine: null, stock: null },
    },
  },
  backpackItems: [],
  yawDeg: 0,
  playerX: 0,
  playerZ: 0,
  playerY: 0,
  altitude: 0,
  aliveCount: 51,
  kills: 0,
  damageDealt: 0,
  zoneTimerSec: 90,
  safeZone: {
    phase: 1,
    totalPhases: 5,
    isShrinking: false,
    timerSec: 90,
    currentX: 0,
    currentZ: 0,
    currentRadius: 890,
    nextX: 0,
    nextZ: 0,
    nextRadius: 560,
    damagePerSec: 2,
    playerOutside: false,
  },
  waitingTimerSec: 10,
  matchmakingCount: 1,
  canJumpFromPlane: false,
  canOpenParachute: false,
  canVaultWindow: false,
  nearbyLootLabel: null,
  nearbyLoots: [],
  nearbyVending: null,
  nearbyVehicle: null,
  inVehicle: null,
  vendingLocations: [],
  vehicleLocations: [],
  hitmarkerActive: false,
  headshotFlashActive: false,
  aimLockedTarget: false,
  aimAssistActive: false,
  damageFlashActive: false,
  damagePopups: [],
  damageIndicators: [],
  killFeed: [],
  fps: 60,
  pointerLocked: false,
  currentPoi: null,
  matchMode: 'solo',
  reviveTarget: null,
  reviveProgress: 0,
  teamMembers: [],
  airDrops: [],
  airDropNotice: null,
  isOnlineMatch: false,
  autoFillBots: true,
  pingMs: 24,
  isNetworkDisconnected: false,
  isSpectating: false,
  spectatorCount: 0,
  matchVisualLikes: 0,
  likeToast: null,
  spectatingTarget: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BattleRoyaleEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>(GameState.BOOT);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadText, setLoadText] = useState('Inicializando...');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const hudRef = useRef<HudSnapshot>(INITIAL_HUD);
  hudRef.current = hud;

  const [mapMeta, setMapMeta] = useState<{
    buildings: MinimapBuilding[];
    roads: MinimapRoad[];
    pois: PoiMarker[];
  }>({ buildings: [], roads: [], pois: [] });

  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [character, setCharacter] = useState<CharacterConfig>(() =>
    loadCharacterConfig(),
  );
  const characterRef = useRef<CharacterConfig>(character);
  characterRef.current = character;

  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const profileRef = useRef<PlayerProfile>(profile);
  profileRef.current = profile;

  // Multiplayer Cloud SQL Account & Party State
  const [account, setAccount] = useState<PublicPlayerAccount | null>(null);
  const accountRef = useRef<PublicPlayerAccount | null>(null);
  accountRef.current = account;

  const [party, setParty] = useState<PartyState | null>(null);
  const partyRef = useRef<PartyState | null>(null);
  partyRef.current = party;

  const [invites, setInvites] = useState<PartyInvitePayload[]>([]);
  const [autoFillBots, setAutoFillBots] = useState(true);
  const autoFillBotsRef = useRef(true);
  autoFillBotsRef.current = autoFillBots;

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [profileModalSubject, setProfileModalSubject] = useState<ProfileModalSubject | null>(null);
  const [showModeModal, setShowModeModal] = useState(false);
  const [showCharModal, setShowCharModal] = useState(false);
  const [showArsenalModal, setShowArsenalModal] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHudEditor, setShowHudEditor] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [matchMode, setMatchMode] = useState<MatchMode>('solo');
  const [isRanked, setIsRanked] = useState(false);
  const [lastRankDelta, setLastRankDelta] = useState<number | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [onlineStarting, setOnlineStarting] = useState(false);

  const prevBackpackOpenRef = useRef(false);
  const activeLaunchedRoomIdRef = useRef<string | null>(null);
  const firebaseUserRef = useRef<FirebaseUser | null>(null);

  const applyServerAccount = useCallback((acc: PublicPlayerAccount) => {
    setAccount(acc);
    voiceChatManager.setLocalAccountId(acc.id);
    const mergedProfile: PlayerProfile = {
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
    };
    setProfile(mergedProfile);
    saveProfile(mergedProfile);
    engineRef.current?.setPlayerNickname(acc.nickname);

    if (acc.character && (acc.character.modelId === 'adam' || acc.character.modelId === 'eva')) {
      const nextChar: CharacterConfig = {
        ...characterRef.current,
        ...acc.character,
        id: acc.character.modelId === 'eva' ? 'ff_eva_classic' : 'ff_adam_classic',
        name: acc.character.modelId === 'eva' ? 'EVA' : 'ADAM',
        modelId: acc.character.modelId,
        vestEnabled: false,
      };
      setCharacter(nextChar);
      saveCharacterConfig(nextChar);
      engineRef.current?.updateCharacterConfig(nextChar);
    }
  }, []);

  const syncPartyConfigState = useCallback((nextParty: PartyState) => {
    setParty(nextParty);
    setMatchMode(nextParty.mode);
    setIsRanked(nextParty.isRanked);
    setAutoFillBots(nextParty.autoFillBots);
    engineRef.current?.setMatchMode(nextParty.mode);
    engineRef.current?.setRankedMode(nextParty.isRanked);
    engineRef.current?.setAutoFillBots(nextParty.autoFillBots);
  }, []);

  const launchOnlineRoom = useCallback((joinInfo: MatchRoomJoinInfo, fillBotsOverride?: boolean) => {
    if (!engineRef.current) return;
    if (activeLaunchedRoomIdRef.current === joinInfo.roomId) return;
    activeLaunchedRoomIdRef.current = joinInfo.roomId;
    setOnlineStarting(false);
    setShowAuthModal(false);
    setShowFriendsModal(false);
    setShowModeModal(false);
    engineRef.current.startOnlineMatch(
      joinInfo,
      fillBotsOverride ?? partyRef.current?.autoFillBots ?? autoFillBotsRef.current,
    );
  }, []);

  // Hydrate existing session token & listen for multiplayer WS events
  useEffect(() => {
    if (multiplayerClient.isAuthenticated()) {
      multiplayerClient
        .getMe()
        .then((res) => {
          applyServerAccount(res.account);
          syncPartyConfigState(res.party);
          setInvites(res.invites);
        })
        .catch(() => {
          // Invalid/expired token already cleared
        });
    }

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      firebaseUserRef.current = fbUser;
      if (!fbUser) return;

      void (async () => {
        try {
          if (!multiplayerClient.isAuthenticated()) {
            const idToken = await fbUser.getIdToken();
            const res = await multiplayerClient.loginWithFirebase({
              idToken,
              nickname: fbUser.displayName || profileRef.current.nickname,
              character: characterRef.current,
            });
            const fsProf = await loadOrCreateFirestoreProfile(
              fbUser,
              profileRef.current,
              characterRef.current,
              res.account.publicId,
            ).catch(() => null);
            const merged = fsProf
              ? {
                  ...res.account,
                  nickname: fsProf.nickname,
                  level: fsProf.level,
                  gold: fsProf.gold,
                  gems: fsProf.gems,
                  matchesPlayed: fsProf.matchesPlayed,
                  wins: fsProf.wins,
                  rankPoints: fsProf.rankPoints,
                  rankedMatches: fsProf.rankedMatches,
                  rankedWins: fsProf.rankedWins,
                  totalKills: fsProf.totalKills,
                  character: {
                    ...res.account.character,
                    modelId: fsProf.characterModelId,
                  },
                }
              : res.account;
            applyServerAccount(merged);
            syncPartyConfigState(res.party);
            setInvites(res.invites);
          } else {
            const fsProf = await loadOrCreateFirestoreProfile(
              fbUser,
              profileRef.current,
              characterRef.current,
              accountRef.current?.publicId,
            ).catch(() => null);
            if (fsProf && accountRef.current) {
              applyServerAccount({
                ...accountRef.current,
                nickname: fsProf.nickname,
                level: fsProf.level,
                gold: fsProf.gold,
                gems: fsProf.gems,
                matchesPlayed: fsProf.matchesPlayed,
                wins: fsProf.wins,
                rankPoints: fsProf.rankPoints,
                rankedMatches: fsProf.rankedMatches,
                rankedWins: fsProf.rankedWins,
                totalKills: fsProf.totalKills,
                character: {
                  ...accountRef.current.character,
                  modelId: fsProf.characterModelId,
                },
              });
            }
          }
        } catch {
          // Ignore transient auth sync errors
        }
      })();
    });

    const unsub = multiplayerClient.subscribe((ev) => {
      if (ev.type === 'party_update') {
        syncPartyConfigState(ev.party);
      } else if (ev.type === 'party_invite') {
        setInvites((prev) => {
          if (prev.some((p) => p.inviteId === ev.invite.inviteId)) return prev;
          return [ev.invite, ...prev];
        });
      } else if (ev.type === 'match_found') {
        launchOnlineRoom(ev.joinInfo);
      }
    });
    return () => {
      unsub();
      unsubAuth();
    };
  }, [applyServerAccount, launchOnlineRoom, syncPartyConfigState]);

  // Keep 3D Lobby Squad characters synced side-by-side with current party & mode
  useEffect(() => {
    if (!engineRef.current) return;
    if (matchMode === 'solo' || !party || party.members.length === 0) {
      engineRef.current.setLobbySquadMembers([
        {
          accountId: account?.id ?? -1,
          nickname: profile.nickname,
          modelId: character.modelId === 'eva' ? 'eva' : 'adam',
          isLeader: true,
          isSelf: true,
        },
      ]);
      return;
    }
    engineRef.current.setLobbySquadMembers(
      party.members.map((m) => ({
        accountId: m.accountId,
        nickname: m.nickname,
        modelId:
          m.accountId === account?.id
            ? character.modelId === 'eva'
              ? 'eva'
              : 'adam'
            : m.character?.modelId === 'eva'
              ? 'eva'
              : 'adam',
        isLeader: m.isLeader,
        isSelf: account ? m.accountId === account.id : false,
      })),
    );
  }, [account, character.modelId, gameState, matchMode, party, profile.nickname]);

  // Release pointer lock when Backpack / Shop / Pause opens & handle keyboard shortcuts to close
  useEffect(() => {
    if (isBackpackOpen && !prevBackpackOpenRef.current) {
      soundEngine.playBackpackOpen();
    }
    prevBackpackOpenRef.current = isBackpackOpen;

    if (isBackpackOpen || isPaused || isShopOpen) {
      soundEngine.stopRunAudio();
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      engineRef.current?.input.setGameplayActive(false);
    } else if (
      gameState === GameState.WAITING ||
      gameState === GameState.DROPPING ||
      gameState === GameState.PARACHUTE ||
      gameState === GameState.PLAYING
    ) {
      engineRef.current?.input.setGameplayActive(true);
    }

    if (!isBackpackOpen && !isShopOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (isShopOpen && e.code === 'Escape') {
        e.preventDefault();
        setIsShopOpen(false);
        return;
      }
      if (isBackpackOpen && (e.code === 'Tab' || e.code === 'KeyB' || e.code === 'Escape')) {
        e.preventDefault();
        setIsBackpackOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isBackpackOpen, isPaused, isShopOpen, gameState]);

  // Mount WebGLRenderer once inside isolated container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    let engine: BattleRoyaleEngine;
    try {
      engine = new BattleRoyaleEngine(
        container,
        settings,
        character,
        (snap) => setHud(snap),
        () => {
          setIsBackpackOpen(false);
          setIsShopOpen(false);
          setIsPaused((p) => !p);
        },
        () => {
          setIsShopOpen(false);
          setIsBackpackOpen((b) => !b);
        },
        () => {
          setIsBackpackOpen(false);
          setIsShopOpen(true);
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar contexto WebGL.';
      setWebglError(msg);
      return;
    }
    setWebglError(null);
    engineRef.current = engine;
    engine.setPlayerNickname(profile.nickname);
    engine.setAutoFillBots(autoFillBots);
    setMapMeta(engine.getMapMetadata());

    const unsub = engine.stateMachine.subscribe((next) => {
      setGameState(next);
      setIsPaused(false);
      setIsBackpackOpen(false);
      setIsShopOpen(false);

      if (next === GameState.LOBBY || next === GameState.MATCHMAKING) {
        setLastRankDelta(null);
      }

      if (next === GameState.LOBBY) {
        activeLaunchedRoomIdRef.current = null;
        if (accountRef.current) {
          void multiplayerClient.leaveMatch();
          void multiplayerClient.getParty().then((p) => {
            syncPartyConfigState(p.party);
            setInvites(p.invites);
          }).catch(() => undefined);
        }
      }

      if (next === GameState.WIN || next === GameState.GAMEOVER) {
        activeLaunchedRoomIdRef.current = null;
        const snap = hudRef.current;
        const rankedActive = engine.getRankedMode();
        const isWin = next === GameState.WIN;
        const placement = isWin ? 1 : (snap.playerPlacement ?? Math.max(2, snap.aliveCount));
        const curProfile = profileRef.current;
        const delta = rankedActive
          ? computeRankedPointDelta({
              isWin,
              placement,
              kills: snap.kills,
              damageDealt: snap.damageDealt,
              currentPoints: curProfile.rankPoints,
            })
          : null;
        setLastRankDelta(delta);

        const appliedDelta = delta ?? 0;
        const updated: PlayerProfile = {
          ...curProfile,
          matchesPlayed: curProfile.matchesPlayed + 1,
          wins: isWin ? curProfile.wins + 1 : curProfile.wins,
          gold: curProfile.gold + (isWin ? 250 : 60),
          rankPoints: rankedActive ? Math.max(0, curProfile.rankPoints + appliedDelta) : curProfile.rankPoints,
          rankedMatches: rankedActive ? curProfile.rankedMatches + 1 : curProfile.rankedMatches,
          rankedWins: rankedActive && isWin ? curProfile.rankedWins + 1 : curProfile.rankedWins,
          totalKills: curProfile.totalKills + snap.kills,
        };
        setProfile(updated);
        saveProfile(updated);

        if (accountRef.current) {
          void multiplayerClient.leaveMatch();
          void multiplayerClient
            .updateProfile({
              matchesPlayed: updated.matchesPlayed,
              wins: updated.wins,
              gold: updated.gold,
              rankPoints: updated.rankPoints,
              rankedMatches: updated.rankedMatches,
              rankedWins: updated.rankedWins,
              totalKills: updated.totalKills,
            })
            .then((res) => setAccount(res.account))
            .catch(() => undefined);
        }

        if (firebaseUserRef.current) {
          void saveFirestoreProfile(firebaseUserRef.current, {
            matchesPlayed: updated.matchesPlayed,
            wins: updated.wins,
            gold: updated.gold,
            rankPoints: updated.rankPoints,
            rankedMatches: updated.rankedMatches,
            rankedWins: updated.rankedWins,
            totalKills: updated.totalKills,
          }).catch(() => undefined);
        }
      }
    });

    engine.startBootSequence((pct, label) => {
      setLoadProgress(pct);
      setLoadText(label);
    });

    return () => {
      unsub();
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateSettings = (next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    engineRef.current?.applyQualitySettings(next);
  };

  const handleToggleMute = () => {
    soundEngine.unlock();
    const next = { ...settings, muted: !settings.muted };
    handleUpdateSettings(next);
  };

  const handleUpdateCharacter = (next: CharacterConfig) => {
    soundEngine.playUiClick(620);
    setCharacter(next);
    saveCharacterConfig(next);
    engineRef.current?.updateCharacterConfig(next);
    if (account) {
      void multiplayerClient
        .updateProfile({ character: next })
        .then((res) => setAccount(res.account))
        .catch(() => undefined);
    }
    if (firebaseUserRef.current) {
      void saveFirestoreProfile(firebaseUserRef.current, {
        characterModelId: next.modelId === 'eva' ? 'eva' : 'adam',
      }).catch(() => undefined);
    }
  };

  const handleUpdateNickname = (name: string) => {
    const clean = name.trim() || 'Sobrevivente_17';
    const next = { ...profile, nickname: clean };
    setProfile(next);
    saveProfile(next);
    engineRef.current?.setPlayerNickname(next.nickname);
    if (account) {
      void multiplayerClient
        .updateProfile({ nickname: clean })
        .then((res) => setAccount(res.account))
        .catch(() => undefined);
    }
    if (firebaseUserRef.current) {
      void saveFirestoreProfile(firebaseUserRef.current, {
        nickname: clean,
      }).catch(() => undefined);
    }
  };

  const handleChangeMatchMode = (mode: MatchMode) => {
    setMatchMode(mode);
    engineRef.current?.setMatchMode(mode);
    if (account) {
      void multiplayerClient
        .setPartyConfig({ mode })
        .then((res) => syncPartyConfigState(res.party))
        .catch(() => undefined);
    }
  };

  const handleChangeRanked = (ranked: boolean) => {
    setIsRanked(ranked);
    engineRef.current?.setRankedMode(ranked);
    if (account) {
      void multiplayerClient
        .setPartyConfig({ isRanked: ranked })
        .then((res) => syncPartyConfigState(res.party))
        .catch(() => undefined);
    }
  };

  const handleChangeAutoFillBots = (fill: boolean) => {
    setAutoFillBots(fill);
    engineRef.current?.setAutoFillBots(fill);
    if (account) {
      void multiplayerClient
        .setPartyConfig({ autoFillBots: fill })
        .then((res) => syncPartyConfigState(res.party))
        .catch(() => undefined);
    }
  };

  const handleStartMatch = async () => {
    if (!engineRef.current) return;
    if (account) {
      setOnlineStarting(true);
      try {
        const res = await multiplayerClient.startMatchmaking();
        launchOnlineRoom(res.joinInfo, autoFillBots);
      } catch {
        setOnlineStarting(false);
        engineRef.current.startMatchmaking();
      }
      return;
    }
    engineRef.current.startMatchmaking();
  };

  const handleRespondInvite = async (inviteId: string, accept: boolean) => {
    setInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
    try {
      const res = await multiplayerClient.respondPartyInvite(inviteId, accept);
      syncPartyConfigState(res.party);
    } catch {
      // ignore
    }
  };

  const handleKickMember = async (targetAccountId: number) => {
    try {
      const res = await multiplayerClient.kickPartyMember(targetAccountId);
      syncPartyConfigState(res.party);
    } catch {
      // ignore
    }
  };

  const handleLeaveParty = async () => {
    try {
      const res = await multiplayerClient.leaveParty();
      syncPartyConfigState(res.party);
    } catch {
      // ignore
    }
  };

  const inGameplayHud =
    gameState === GameState.WAITING ||
    gameState === GameState.AIRPLANE ||
    gameState === GameState.DROPPING ||
    gameState === GameState.PARACHUTE ||
    gameState === GameState.PLAYING;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Fullscreen Nostalgic Lobby Backdrop behind transparent 3D character canvas */}
      {gameState === GameState.LOBBY && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img
            src="/assets/lobby_bg_clean.jpg"
            alt="Lobby Free Fire João Pessoa"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45" />
        </div>
      )}

      {/* Isolated WebGL Canvas Mount */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 z-10 w-full h-full"
      />

      {/* 1. BOOT & 2. LOADING */}
      {(gameState === GameState.BOOT || gameState === GameState.LOADING) && (
        <BootAndLoadingScreen
          state={gameState}
          progress={loadProgress}
          statusText={loadText}
        />
      )}

      {/* 3. MENU */}
      {gameState === GameState.MENU && (
        <MainMenuScreen
          nickname={profile.nickname}
          account={account}
          muted={settings.muted}
          onToggleMute={handleToggleMute}
          onPlay={() => {
            soundEngine.playUiConfirm();
            engineRef.current?.stateMachine.transition(GameState.LOBBY);
          }}
          onOpenCharacter={() => {
            soundEngine.playUiClick();
            engineRef.current?.stateMachine.transition(GameState.LOBBY);
            setShowCharModal(true);
          }}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(true);
          }}
          onOpenCredits={() => {
            soundEngine.playUiClick();
            setShowCreditsModal(true);
          }}
          onOpenAuth={() => {
            soundEngine.playUiClick();
            setShowAuthModal(true);
          }}
        />
      )}

      {/* 4. LOBBY */}
      {gameState === GameState.LOBBY && (
        <LobbyScreen
          profile={profile}
          character={character}
          matchMode={matchMode}
          isRanked={isRanked}
          autoFillBots={autoFillBots}
          account={account}
          party={party}
          invites={invites}
          onChangeMatchMode={handleChangeMatchMode}
          onChangeRanked={handleChangeRanked}
          onChangeAutoFillBots={handleChangeAutoFillBots}
          muted={settings.muted}
          onToggleMute={handleToggleMute}
          onStartMatch={() => void handleStartMatch()}
          onQuickTraining={() => engineRef.current?.startQuickTraining()}
          onOpenMyProfile={() => {
            soundEngine.playUiClick();
            setProfileModalSubject(profileFromLocal(profile, character, account));
          }}
          onInspectPlayer={(accountId) => {
            soundEngine.playUiClick();
            void Promise.all([
              multiplayerClient.getPlayerProfile(accountId),
              account ? multiplayerClient.getFriends().catch(() => ({ friends: [] })) : Promise.resolve({ friends: [] }),
            ])
              .then(([profRes, frRes]) => {
                const isFriend = frRes.friends.some((f) => f.account.id === accountId);
                setProfileModalSubject(
                  profileFromAccount(profRes.player, {
                    isOwn: account?.id === accountId,
                    isFriend,
                  }),
                );
              })
              .catch(() => undefined);
          }}
          onOpenCharacter={() => {
            soundEngine.playUiClick();
            setShowCharModal(true);
          }}
          onOpenArsenal={() => {
            soundEngine.playUiClick();
            setShowArsenalModal(true);
          }}
          onOpenRankModal={() => {
            soundEngine.playUiClick();
            setShowRankModal(true);
          }}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(true);
          }}
          onOpenHudEditor={() => {
            soundEngine.playUiClick();
            setShowHudEditor(true);
          }}
          onOpenCredits={() => {
            soundEngine.playUiClick();
            setShowCreditsModal(true);
          }}
          onOpenAuth={() => {
            soundEngine.playUiClick();
            setShowAuthModal(true);
          }}
          onOpenFriends={() => {
            soundEngine.playUiClick();
            if (!account) {
              setShowAuthModal(true);
            } else {
              setShowFriendsModal(true);
            }
          }}
          onOpenModeSelect={() => {
            soundEngine.playUiClick();
            setShowModeModal(true);
          }}
          onRespondInvite={(id, accept) => void handleRespondInvite(id, accept)}
          onKickMember={(id) => void handleKickMember(id)}
          onLeaveParty={() => void handleLeaveParty()}
          onBackToMenu={() => {
            soundEngine.playUiClick(480);
            engineRef.current?.stateMachine.transition(GameState.MENU);
          }}
        />
      )}

      {/* 5. MATCHMAKING */}
      {(gameState === GameState.MATCHMAKING || onlineStarting) && (
        <MatchmakingOverlay
          playerCount={hud.matchmakingCount}
          matchMode={matchMode}
          isOnline={Boolean(account)}
          onCancel={() => {
            setOnlineStarting(false);
            engineRef.current?.cancelMatchmaking();
          }}
        />
      )}

      {/* 6. WAITING, 7. AIRPLANE, 8. DROPPING, 9. PARACHUTE, 10. PLAYING */}
      {inGameplayHud && engineRef.current && (
        <GameHud
          gameState={gameState}
          hud={hud}
          buildings={mapMeta.buildings}
          roads={mapMeta.roads}
          pois={mapMeta.pois}
          input={engineRef.current.input}
          controlMode={settings.controlMode}
          hudLayout={settings.hudLayout}
          showFps={settings.showFps}
          isPaused={isPaused}
          isBackpackOpen={isBackpackOpen}
          onTogglePause={() => {
            soundEngine.playUiClick();
            setIsBackpackOpen(false);
            setIsShopOpen(false);
            setIsPaused((p) => !p);
          }}
          onToggleBackpack={() => {
            setIsShopOpen(false);
            setIsBackpackOpen((b) => !b);
          }}
          onUseMedkit={() => engineRef.current?.useMedkit()}
          onUseSmallKit={() => engineRef.current?.useSmallKit()}
          onCycleSpectate={(dir) => engineRef.current?.cycleSpectateTarget(dir)}
          onSendSpectateLike={() => engineRef.current?.sendSpectateLike()}
          onSendFriendRequest={(publicId) => {
            soundEngine.playUiClick();
            void multiplayerClient.sendFriendRequest(publicId).catch(() => {});
          }}
          onExitSpectate={() => engineRef.current?.exitSpectateToResults()}
          onInspectSpectatedPlayer={(accountId) => {
            soundEngine.playUiClick();
            void Promise.all([
              multiplayerClient.getPlayerProfile(accountId),
              account ? multiplayerClient.getFriends().catch(() => ({ friends: [] })) : Promise.resolve({ friends: [] }),
            ])
              .then(([profRes, frRes]) => {
                const isFriend = frRes.friends.some((f) => f.account.id === accountId);
                setProfileModalSubject(
                  profileFromAccount(profRes.player, {
                    isOwn: account?.id === accountId,
                    isFriend,
                  }),
                );
              })
              .catch(() => undefined);
          }}
          onToggleFollowLeader={() => engineRef.current?.toggleFollowLeader()}
          onCollectLoot={(id) => engineRef.current?.collectLootById(id)}
          onOpenVending={() => engineRef.current?.openNearbyVending()}
          onToggleVehicle={() => engineRef.current?.toggleVehicle()}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(true);
          }}
          onOpenHudEditor={() => {
            soundEngine.playUiClick();
            setShowHudEditor(true);
          }}
          onSelectScope={(sc) => engineRef.current?.setActiveWeaponScope(sc)}
          onSelectGlooSkin={(skin) => {
            const nextChar: CharacterConfig = { ...character, glooSkin: skin };
            handleUpdateCharacter(nextChar);
            engineRef.current?.setGlooSkin(skin);
          }}
          onSkipWaiting={() => engineRef.current?.skipWaitingToPlane()}
          onJumpFromPlane={() => engineRef.current?.jumpFromPlane()}
          onOpenParachute={() => engineRef.current?.openParachute()}
          onReturnLobby={() => {
            setIsPaused(false);
            setIsBackpackOpen(false);
            setIsShopOpen(false);
            activeLaunchedRoomIdRef.current = null;
            voiceChatManager.disconnect();
            if (account) {
              void multiplayerClient.leaveMatch();
            }
            engineRef.current?.returnToLobby();
          }}
          onTestDamage={() => engineRef.current?.applyTestDamage(55)}
          onTestVictory={() => engineRef.current?.triggerVictory()}
        />
      )}

      {inGameplayHud && isBackpackOpen && !isPaused && engineRef.current && (
        <BackpackModal
          hud={hud}
          onClose={() => setIsBackpackOpen(false)}
          onUseMedkit={() => engineRef.current?.useMedkit()}
          onDropMedkit={() => engineRef.current?.dropMedkit()}
          onUseSmallKit={() => engineRef.current?.useSmallKit()}
          onDropSmallKit={() => engineRef.current?.dropSmallKit()}
          onDropGloo={() => engineRef.current?.dropGloo()}
          onDropGrenade={() => engineRef.current?.dropGrenade()}
          onDropAmmo={(slot, amt) => engineRef.current?.dropAmmo(slot, amt)}
          onEquipItem={(id, slot) => engineRef.current?.equipBackpackItem(id, slot)}
          onDropItem={(id) => engineRef.current?.dropBackpackItem(id)}
          onUnequipAttachment={(slot, key) =>
            engineRef.current?.unequipWeaponAttachment(slot, key)
          }
          onDropEquippedAttachment={(slot, key) =>
            engineRef.current?.dropEquippedAttachment(slot, key)
          }
          onUnequipScope={(slot) => engineRef.current?.unequipWeaponScope(slot)}
          onDropEquippedScope={(slot) => engineRef.current?.dropEquippedScope(slot)}
          onTransferScope={(from, to) =>
            engineRef.current?.transferScopeBetweenSlots(from, to)
          }
          onTransferAttachment={(from, key, to) =>
            engineRef.current?.transferAttachmentBetweenSlots(from, key, to)
          }
          onDropWeaponSlot={(slot) => engineRef.current?.dropWeaponSlot(slot)}
          onSwapWeaponSlots={(slotA, slotB) => engineRef.current?.swapWeaponSlots(slotA, slotB)}
          onSelectSlot={(slot) => engineRef.current?.selectWeaponSlot(slot)}
        />
      )}

      {inGameplayHud && isShopOpen && !isPaused && engineRef.current && (
        <VendingShopModal
          ffCoins={hud.ffCoins}
          teamMembers={hud.teamMembers}
          onBuyOffer={(offerId, reviveAllyId) =>
            engineRef.current?.buyVendingOffer(offerId, reviveAllyId) ?? false
          }
          onClose={() => setIsShopOpen(false)}
        />
      )}

      {/* 11. WIN & 12. GAMEOVER */}
      {(gameState === GameState.WIN || gameState === GameState.GAMEOVER) && (
        <EndMatchModal
          state={gameState}
          hud={hud}
          isRanked={isRanked || hud.isRanked}
          rankPoints={profile.rankPoints}
          rankDelta={lastRankDelta}
          onPlayAgain={() => void handleStartMatch()}
          onReturnLobby={() => engineRef.current?.returnToLobby()}
        />
      )}

      {/* MODALS */}
      {showAuthModal && (
        <AuthModal
          currentAccount={account}
          onAuthenticated={(acc) => {
            applyServerAccount(acc);
            void multiplayerClient.getParty().then((p) => {
              syncPartyConfigState(p.party);
              setInvites(p.invites);
            }).catch(() => undefined);
          }}
          onLoggedOut={() => {
            firebaseUserRef.current = null;
            voiceChatManager.setLocalAccountId(null);
            setAccount(null);
            setParty(null);
            setInvites([]);
          }}
          onClose={() => {
            soundEngine.playUiClick();
            setShowAuthModal(false);
          }}
        />
      )}

      {showFriendsModal && account && (
        <FriendsModal
          currentAccount={account}
          onClose={() => {
            soundEngine.playUiClick();
            setShowFriendsModal(false);
          }}
        />
      )}

      {profileModalSubject && (
        <PlayerProfileModal
          subject={
            profileModalSubject.isOwn
              ? profileFromLocal(profile, character, account)
              : profileModalSubject
          }
          onClose={() => {
            soundEngine.playUiClick();
            setProfileModalSubject(null);
          }}
          onChangeNickname={handleUpdateNickname}
          onOpenCharacter={() => setShowCharModal(true)}
          onOpenAuth={() => setShowAuthModal(true)}
          onInviteToParty={(accId) => {
            if (matchMode === 'solo') {
              handleChangeMatchMode('duo');
            }
            void multiplayerClient.inviteToParty(accId).catch(() => undefined);
          }}
          onAddFriend={(pubId) => {
            void multiplayerClient.sendFriendRequest(pubId).catch(() => undefined);
          }}
          onRemoveFriend={(accId) => {
            void multiplayerClient.removeFriend(accId).then(() => {
              setProfileModalSubject(null);
            }).catch(() => undefined);
          }}
        />
      )}

      {showModeModal && (
        <ModeSelectModal
          matchMode={matchMode}
          isRanked={isRanked}
          autoFillBots={autoFillBots}
          rankPoints={profile.rankPoints}
          isPartyLeader={!party || !account || party.leaderId === account.id}
          onChangeMatchMode={handleChangeMatchMode}
          onChangeRanked={handleChangeRanked}
          onChangeAutoFillBots={handleChangeAutoFillBots}
          onQuickTraining={() => engineRef.current?.startQuickTraining()}
          onClose={() => {
            soundEngine.playUiClick();
            setShowModeModal(false);
          }}
        />
      )}

      {showCharModal && (
        <CharacterModal
          config={character}
          onChange={handleUpdateCharacter}
          onClose={() => {
            soundEngine.playUiClick();
            setShowCharModal(false);
          }}
        />
      )}

      {showArsenalModal && (
        <ArsenalModal
          onClose={() => {
            soundEngine.playUiClick();
            setShowArsenalModal(false);
          }}
        />
      )}

      {showRankModal && (
        <RankModal
          profile={profile}
          onClose={() => {
            soundEngine.playUiClick();
            setShowRankModal(false);
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          nickname={profile.nickname}
          onChangeNickname={handleUpdateNickname}
          onChangeSettings={handleUpdateSettings}
          onOpenHudEditor={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(false);
            setShowHudEditor(true);
          }}
          onClose={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(false);
          }}
        />
      )}

      {showHudEditor && (
        <HudEditorModal
          layout={settings.hudLayout}
          activeSlot={settings.activeHudSlot ?? 1}
          hudSlots={settings.hudSlots}
          onSave={(nextLayout, nextSlot, nextSlots) => {
            soundEngine.playUiConfirm();
            handleUpdateSettings({
              ...settings,
              hudLayout: nextLayout,
              activeHudSlot: nextSlot,
              hudSlots: nextSlots,
            });
            setShowHudEditor(false);
          }}
          onClose={() => {
            soundEngine.playUiClick();
            setShowHudEditor(false);
          }}
        />
      )}

      {showCreditsModal && (
        <CreditsModal
          onClose={() => {
            soundEngine.playUiClick();
            setShowCreditsModal(false);
          }}
        />
      )}

      {webglError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 text-white">
          <div className="w-full max-w-md bg-[#14181e] border-2 border-amber-500 p-6 space-y-4 text-center shadow-2xl">
            <h2 className="text-lg font-black uppercase tracking-wider text-amber-400">
              Motor 3D (WebGL) Bloqueado
            </h2>
            <p className="text-xs text-neutral-300 leading-relaxed">
              O navegador bloqueou temporariamente a criação do contexto gráfico 3D nesta aba.
              Recarregue a página para restaurar o WebGL normalmente.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest cursor-pointer"
            >
              RECARREGAR JOGO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
