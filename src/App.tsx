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
  FREE_PLAYER_AVATARS,
  S1_MESTRE_AVATARS,
  normalizePlayerAvatarId,
} from './game/avatars';
import {
  BrMapId,
  CURRENT_RANKED_SEASON,
  CharacterConfig,
  GameSettings,
  GameState,
  GameVariant,
  GladiadoresFormat,
  HudSnapshot,
  MESTRE_MIN_PTS,
  MatchMode,
  MinimapBuilding,
  MinimapRoad,
  PlayerAvatarId,
  PlayerProfile,
  PoiMarker,
  SEASON_1_REWARDS,
  computeRankedPointDelta,
  getCharacterPresetByModelId,
  normalizeCharacterModelId,
} from './game/types';
import { BERMUDA_MAP_RANGE } from './game/worldBuilder';
import {
  MatchRoomJoinInfo,
  PartyInvitePayload,
  PartyState,
  PublicPlayerAccount,
  SearchingPoolInfo,
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
import { SearchingPlayersModal } from './components/SearchingPlayersModal';
import { GameHud } from './components/GameHud';
import { EndMatchModal } from './components/EndMatchModal';
import { GgMouseMacroModal } from './components/GgMouseMacroModal';
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

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return (
    doc.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.mozFullScreenElement ??
    doc.msFullscreenElement ??
    null
  );
}

function isTouchMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || '',
  );
  const smallTouch =
    (navigator.maxTouchPoints ?? 0) > 0 &&
    Math.min(window.innerWidth, window.innerHeight) <= 950;
  return coarse || uaMobile || smallTouch;
}

function requestAppFullscreen(): void {
  if (typeof document === 'undefined') return;
  if (getFullscreenElement()) return;
  const docEl = document.documentElement as FullscreenElement | null;
  if (!docEl) return;

  try {
    let req: Promise<void> | void | undefined;
    if (typeof docEl.requestFullscreen === 'function') {
      req = docEl.requestFullscreen();
    } else if (typeof docEl.webkitRequestFullscreen === 'function') {
      req = docEl.webkitRequestFullscreen();
    } else if (typeof docEl.mozRequestFullScreen === 'function') {
      req = docEl.mozRequestFullScreen();
    } else if (typeof docEl.msRequestFullscreen === 'function') {
      req = docEl.msRequestFullscreen();
    }
    if (req && typeof (req as Promise<void>).catch === 'function') {
      (req as Promise<void>).catch(() => undefined);
    }
  } catch {
    // Fullscreen may be restricted in sandboxed iframes or unsupported browsers
  }

  if (isTouchMobileDevice()) {
    try {
      const orientation = screen.orientation as unknown as {
        lock?: (mode: string) => Promise<void>;
      };
      orientation?.lock?.('landscape')?.catch?.(() => undefined);
    } catch {
      // Orientation lock unsupported on some mobile browsers
    }
  }
}

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
  mapId: 'bermuda',
  gameVariant: 'br',
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
  healingDone: 0,
  headshotKills: 0,
  matchSurvivalSec: 0,
  totalMatchPlayers: 51,
  weaponDamageStats: [],
  zoneTimerSec: 90,
  safeZone: {
    phase: 1,
    totalPhases: 5,
    isShrinking: false,
    timerSec: 90,
    currentX: 0,
    currentZ: 0,
    currentRadius: 820,
    nextX: 0,
    nextZ: 0,
    nextRadius: 480,
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
  combatIconPopup: null,
  fps: 60,
  drawCalls: 0,
  triangles: 0,
  pointerLocked: false,
  mouseSuspended: false,
  mouseResetNotice: false,
  currentPoi: null,
  matchMode: 'solo',
  reviveTarget: null,
  reviveProgress: 0,
  teamMembers: [],
  airDrops: [],
  airDropNotice: null,
  stanceNotice: null,
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
    mapId: BrMapId;
    mapRange: number;
    bermudaMinimapCanvas: HTMLCanvasElement | null;
  }>({
    buildings: [],
    roads: [],
    pois: [],
    mapId: 'bermuda',
    mapRange: BERMUDA_MAP_RANGE,
    bermudaMinimapCanvas: null,
  });

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
  const [arsenalInitialTab, setArsenalInitialTab] = useState<'weapons' | 'avatars'>('weapons');
  const [showRankModal, setShowRankModal] = useState(false);
  const [claimingRewardId, setClaimingRewardId] = useState<string | null>(null);
  const [seasonClaimFeedback, setSeasonClaimFeedback] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHudEditor, setShowHudEditor] = useState(false);
  const [showGgMacroModal, setShowGgMacroModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [brMapId, setBrMapId] = useState<BrMapId>('bermuda');
  const [gameVariant, setGameVariant] = useState<GameVariant>('br');
  const [gladiadoresFormat, setGladiadoresFormat] = useState<GladiadoresFormat>('1v1');
  const [gladiadoresTargetRounds, setGladiadoresTargetRounds] = useState<number>(5);
  const [matchMode, setMatchMode] = useState<MatchMode>('solo');
  const [isRanked, setIsRanked] = useState(false);
  const [lastRankDelta, setLastRankDelta] = useState<number | null>(null);
  const [rankTransition, setRankTransition] = useState<{
    prevPoints: number;
    newPoints: number;
  } | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [searchState, setSearchState] = useState<{
    active: boolean;
    startedAtMs: number;
    poolKey: string | null;
    isOffline: boolean;
  }>({ active: false, startedAtMs: 0, poolKey: null, isOffline: false });
  const [searchElapsedSec, setSearchElapsedSec] = useState(0);
  const [searchingPools, setSearchingPools] = useState<SearchingPoolInfo[]>([]);
  const [showSearchingModal, setShowSearchingModal] = useState(false);
  const [joiningPoolKey, setJoiningPoolKey] = useState<string | null>(null);
  const [searchJoinError, setSearchJoinError] = useState<string | null>(null);
  const offlineLaunchTimerRef = useRef<number | null>(null);
  const [needsRotateLandscape, setNeedsRotateLandscape] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isTouchMobileDevice() && window.innerHeight > window.innerWidth;
  });

  const prevBackpackOpenRef = useRef(false);
  const prevGladPhaseRef = useRef<string | null>(null);
  const activeLaunchedRoomIdRef = useRef<string | null>(null);
  const firebaseUserRef = useRef<FirebaseUser | null>(null);

  // Auto-open Fullscreen on any click/tap + detect mobile portrait orientation
  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setNeedsRotateLandscape(isTouchMobileDevice() && portrait);
    };
    checkOrientation();

    const onGestureFullscreen = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      requestAppFullscreen();
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    screen.orientation?.addEventListener?.('change', checkOrientation);
    window.addEventListener('click', onGestureFullscreen, { capture: true, passive: true });
    window.addEventListener('touchend', onGestureFullscreen, { capture: true, passive: true });

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      screen.orientation?.removeEventListener?.('change', checkOrientation);
      window.removeEventListener('click', onGestureFullscreen, { capture: true });
      window.removeEventListener('touchend', onGestureFullscreen, { capture: true });
    };
  }, []);

  const applyServerAccount = useCallback((acc: PublicPlayerAccount) => {
    setAccount(acc);
    voiceChatManager.setLocalAccountId(acc.id);
    const mergedAvatar = normalizePlayerAvatarId(acc.avatarId ?? acc.character?.avatarId);
    const mergedPeak = Math.max(
      acc.rankPoints ?? 0,
      acc.s1PeakRankPoints ?? 0,
    );
    const mergedUnlocked = Array.from(
      new Set<PlayerAvatarId>([
        ...FREE_PLAYER_AVATARS,
        ...(acc.unlockedAvatars ?? []),
        ...(mergedPeak >= MESTRE_MIN_PTS ? S1_MESTRE_AVATARS : []),
      ]),
    );
    const safeAvatar: PlayerAvatarId = mergedUnlocked.includes(mergedAvatar)
      ? mergedAvatar
      : 'default';

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
      avatarId: safeAvatar,
      unlockedAvatars: mergedUnlocked,
      seasonId: acc.seasonId || CURRENT_RANKED_SEASON,
      s1PeakRankPoints: mergedPeak,
      s1ClaimedRewards: Array.isArray(acc.s1ClaimedRewards) ? acc.s1ClaimedRewards : [],
    };
    setProfile(mergedProfile);
    saveProfile(mergedProfile);
    engineRef.current?.setPlayerNickname(acc.nickname);

    const basePreset = getCharacterPresetByModelId(
      acc.character?.modelId ?? characterRef.current.modelId,
    );
    const nextChar: CharacterConfig = {
      ...characterRef.current,
      ...(acc.character ?? {}),
      id: basePreset.id,
      name: basePreset.name,
      modelId: basePreset.modelId,
      avatarId: safeAvatar,
      hairStyle: basePreset.hairStyle,
      vestEnabled: false,
    };
    setCharacter(nextChar);
    saveCharacterConfig(nextChar);
    engineRef.current?.updateCharacterConfig(nextChar);
  }, []);

  const syncPartyConfigState = useCallback((nextParty: PartyState) => {
    const nextMap: BrMapId = 'bermuda';
    const nextVariant: GameVariant = nextParty.gameVariant === 'gladiadores' ? 'gladiadores' : 'br';
    const nextGladFormat: GladiadoresFormat =
      nextParty.gladiadoresFormat === '2v2' ? '2v2' : '1v1';
    setParty(nextParty);
    setBrMapId(nextMap);
    setMatchMode(nextParty.mode);
    setIsRanked(nextParty.isRanked);
    setAutoFillBots(nextParty.autoFillBots);
    setGameVariant(nextVariant);
    setGladiadoresFormat(nextGladFormat);
    engineRef.current?.setBrMapId(nextMap);
    engineRef.current?.setMatchMode(nextParty.mode);
    engineRef.current?.setRankedMode(nextParty.isRanked);
    engineRef.current?.setAutoFillBots(nextParty.autoFillBots);
    engineRef.current?.setGameVariant(nextVariant);
    engineRef.current?.setGladiadoresFormat(nextGladFormat);
    if (engineRef.current) {
      setMapMeta(engineRef.current.getMapMetadata());
    }
  }, []);

  const launchOnlineRoom = useCallback((joinInfo: MatchRoomJoinInfo, fillBotsOverride?: boolean) => {
    if (!engineRef.current) return;
    if (activeLaunchedRoomIdRef.current === joinInfo.roomId) return;
    activeLaunchedRoomIdRef.current = joinInfo.roomId;
    if (offlineLaunchTimerRef.current !== null) {
      window.clearTimeout(offlineLaunchTimerRef.current);
      offlineLaunchTimerRef.current = null;
    }
    setSearchState({ active: false, startedAtMs: 0, poolKey: null, isOffline: false });
    setSearchElapsedSec(0);
    setShowSearchingModal(false);
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
                  avatarId: fsProf.avatarId,
                  unlockedAvatars: fsProf.unlockedAvatars,
                  seasonId: fsProf.seasonId,
                  s1PeakRankPoints: fsProf.s1PeakRankPoints,
                  s1ClaimedRewards: fsProf.s1ClaimedRewards,
                  character: {
                    ...res.account.character,
                    modelId: fsProf.characterModelId,
                    avatarId: fsProf.avatarId,
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
                avatarId: fsProf.avatarId,
                unlockedAvatars: fsProf.unlockedAvatars,
                seasonId: fsProf.seasonId,
                s1PeakRankPoints: fsProf.s1PeakRankPoints,
                s1ClaimedRewards: fsProf.s1ClaimedRewards,
                character: {
                  ...accountRef.current.character,
                  modelId: fsProf.characterModelId,
                  avatarId: fsProf.avatarId,
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
        if (ev.party.status === 'matchmaking') {
          setSearchState((cur) =>
            cur.active
              ? cur
              : { active: true, startedAtMs: Date.now(), poolKey: null, isOffline: false },
          );
        } else if (ev.party.status === 'idle') {
          setSearchState((cur) =>
            cur.isOffline ? cur : { active: false, startedAtMs: 0, poolKey: null, isOffline: false },
          );
        }
      } else if (ev.type === 'party_invite') {
        setInvites((prev) => {
          if (prev.some((p) => p.inviteId === ev.invite.inviteId)) return prev;
          return [ev.invite, ...prev];
        });
      } else if (ev.type === 'matchmaking_queue_update') {
        setSearchingPools(ev.pools);
      } else if (ev.type === 'matchmaking_status') {
        if (ev.status.searching) {
          setSearchState({
            active: true,
            startedAtMs: ev.status.startedAtMs ?? Date.now(),
            poolKey: ev.status.poolKey ?? null,
            isOffline: false,
          });
        } else {
          setSearchState((cur) =>
            cur.isOffline ? cur : { active: false, startedAtMs: 0, poolKey: null, isOffline: false },
          );
        }
      } else if (ev.type === 'match_found') {
        launchOnlineRoom(ev.joinInfo);
      }
    });
    return () => {
      unsub();
      unsubAuth();
    };
  }, [applyServerAccount, launchOnlineRoom, syncPartyConfigState]);

  // Initial-lobby search timer ticker (0:00, 0:07...) & fallback status poll
  useEffect(() => {
    if (!searchState.active) {
      setSearchElapsedSec(0);
      return;
    }
    const tick = () => {
      setSearchElapsedSec(Math.max(0, Math.floor((Date.now() - searchState.startedAtMs) / 1000)));
    };
    tick();
    const timerId = window.setInterval(tick, 250);

    let pollId: number | null = null;
    if (!searchState.isOffline) {
      pollId = window.setInterval(() => {
        void multiplayerClient
          .getMatchmakingStatus()
          .then((res) => {
            if (res.joinInfo) {
              launchOnlineRoom(res.joinInfo);
            } else if (!res.search.searching) {
              setSearchState((cur) =>
                cur.isOffline
                  ? cur
                  : { active: false, startedAtMs: 0, poolKey: null, isOffline: false },
              );
            }
          })
          .catch(() => undefined);
      }, 1200);
    }

    return () => {
      window.clearInterval(timerId);
      if (pollId !== null) window.clearInterval(pollId);
    };
  }, [launchOnlineRoom, searchState.active, searchState.isOffline, searchState.startedAtMs]);

  // Keep live list of searching players fresh while in initial lobby
  const refreshSearchingPools = useCallback(() => {
    void multiplayerClient
      .getSearchingPlayers()
      .then((res) => setSearchingPools(res.pools))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (gameState !== GameState.LOBBY) return;
    refreshSearchingPools();
    const intervalMs = showSearchingModal ? 2000 : 5000;
    const id = window.setInterval(refreshSearchingPools, intervalMs);
    return () => window.clearInterval(id);
  }, [gameState, refreshSearchingPools, showSearchingModal]);

  // Keep 3D Lobby Squad characters synced side-by-side with current party & mode
  useEffect(() => {
    if (!engineRef.current) return;
    const selfModelId = normalizeCharacterModelId(character.modelId);
    if (gameVariant === 'gladiadores') {
      if (gladiadoresFormat === '1v1' || !party || party.members.length === 0) {
        engineRef.current.setLobbySquadMembers([
          {
            accountId: account?.id ?? -1,
            nickname: profile.nickname,
            modelId: selfModelId,
            isLeader: true,
            isSelf: true,
          },
        ]);
        return;
      }
      engineRef.current.setLobbySquadMembers(
        party.members.slice(0, 2).map((m) => ({
          accountId: m.accountId,
          nickname: m.nickname,
          modelId:
            m.accountId === account?.id
              ? selfModelId
              : normalizeCharacterModelId(m.character?.modelId),
          isLeader: m.isLeader,
          isSelf: account ? m.accountId === account.id : false,
        })),
      );
      return;
    }
    if (matchMode === 'solo' || !party || party.members.length === 0) {
      engineRef.current.setLobbySquadMembers([
        {
          accountId: account?.id ?? -1,
          nickname: profile.nickname,
          modelId: selfModelId,
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
            ? selfModelId
            : normalizeCharacterModelId(m.character?.modelId),
        isLeader: m.isLeader,
        isSelf: account ? m.accountId === account.id : false,
      })),
    );
  }, [account, character.modelId, gameState, gameVariant, gladiadoresFormat, matchMode, party, profile.nickname]);

  // Release pointer lock when Backpack / Shop / Pause / Gladiadores Arsenal opens & handle keyboard shortcuts to close
  useEffect(() => {
    if (isBackpackOpen && !prevBackpackOpenRef.current) {
      soundEngine.playBackpackOpen();
    }
    prevBackpackOpenRef.current = isBackpackOpen;

    const gladPhase =
      gameState === GameState.PLAYING && hud.gameVariant === 'gladiadores'
        ? (hud.gladiadores?.phase ?? null)
        : null;
    const prevGladPhase = prevGladPhaseRef.current;
    prevGladPhaseRef.current = gladPhase;

    const modalBlocking =
      isBackpackOpen || isPaused || isShopOpen || showGgMacroModal || showSettingsModal || showHudEditor;

    if (modalBlocking) {
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
      if (gladPhase === 'intro') {
        if (document.pointerLockElement) {
          document.exitPointerLock?.();
        }
      } else if (
        prevGladPhase === 'intro' &&
        gladPhase === 'fight' &&
        engineRef.current &&
        !engineRef.current.input.mouseSuspended
      ) {
        engineRef.current.input.requestLock();
      }
    }

    if (!isBackpackOpen && !isShopOpen) return;
    const backpackCode = settings.keyBindings?.backpack ?? 'Tab';
    const onKey = (e: KeyboardEvent) => {
      if (isShopOpen && e.code === 'Escape') {
        e.preventDefault();
        setIsShopOpen(false);
        if (!isPaused && engineRef.current && !engineRef.current.input.mouseSuspended) {
          engineRef.current.input.setGameplayActive(true);
          engineRef.current.input.requestLock();
        }
        return;
      }
      if (
        isBackpackOpen &&
        (e.code === backpackCode || e.code === 'Tab' || e.code === 'KeyB' || e.code === 'Escape')
      ) {
        e.preventDefault();
        setIsBackpackOpen(false);
        if (!isPaused && engineRef.current && !engineRef.current.input.mouseSuspended) {
          engineRef.current.input.setGameplayActive(true);
          engineRef.current.input.requestLock();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    isBackpackOpen,
    isPaused,
    isShopOpen,
    showGgMacroModal,
    showSettingsModal,
    showHudEditor,
    gameState,
    hud.gameVariant,
    hud.gladiadores?.phase,
    settings.keyBindings?.backpack,
  ]);

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

      if (
        next === GameState.MENU ||
        next === GameState.LOBBY ||
        next === GameState.WAITING ||
        next === GameState.PLAYING
      ) {
        setMapMeta(engine.getMapMetadata());
      }

      if (next === GameState.LOBBY || next === GameState.MATCHMAKING) {
        setLastRankDelta(null);
        setRankTransition(null);
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
        const rankedActive = snap.gameVariant !== 'gladiadores' && engine.getRankedMode();
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
        const nextRankPts = rankedActive
          ? Math.max(0, curProfile.rankPoints + appliedDelta)
          : curProfile.rankPoints;
        setRankTransition({
          prevPoints: curProfile.rankPoints,
          newPoints: nextRankPts,
        });
        const nextPeak = Math.max(
          curProfile.s1PeakRankPoints ?? 0,
          curProfile.rankPoints,
          nextRankPts,
        );
        const nextUnlocked = Array.from(
          new Set<PlayerAvatarId>([
            ...FREE_PLAYER_AVATARS,
            ...(curProfile.unlockedAvatars ?? []),
            ...(nextPeak >= MESTRE_MIN_PTS ? S1_MESTRE_AVATARS : []),
          ]),
        );
        const updated: PlayerProfile = {
          ...curProfile,
          matchesPlayed: curProfile.matchesPlayed + 1,
          wins: isWin ? curProfile.wins + 1 : curProfile.wins,
          gold: curProfile.gold + (isWin ? 250 : 60),
          rankPoints: nextRankPts,
          rankedMatches: rankedActive ? curProfile.rankedMatches + 1 : curProfile.rankedMatches,
          rankedWins: rankedActive && isWin ? curProfile.rankedWins + 1 : curProfile.rankedWins,
          totalKills: curProfile.totalKills + snap.kills,
          seasonId: CURRENT_RANKED_SEASON,
          s1PeakRankPoints: nextPeak,
          unlockedAvatars: nextUnlocked,
        };
        setProfile(updated);
        saveProfile(updated);

        if (accountRef.current) {
          const activeRoomId = multiplayerClient.getLatestSnapshot()?.roomId ?? 'offline';
          void multiplayerClient
            .recordMatchResult({
              roomId: activeRoomId,
              mode: snap.matchMode,
              mapId: snap.mapId,
              isRanked: rankedActive,
              placement,
              kills: snap.kills,
              damage: Math.round(snap.damageDealt),
              survivalSec: Math.round(snap.matchSurvivalSec ?? 0),
              booyah: isWin,
              rankDelta: appliedDelta,
            })
            .catch(() => undefined);
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
            .then((res) => applyServerAccount(res.account))
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
            seasonId: CURRENT_RANKED_SEASON,
            s1PeakRankPoints: updated.s1PeakRankPoints,
            unlockedAvatars: updated.unlockedAvatars,
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
        characterModelId: normalizeCharacterModelId(next.modelId),
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

  const handleSelectAvatar = async (nextAvatarId: PlayerAvatarId) => {
    const cleanAvatar = normalizePlayerAvatarId(nextAvatarId);
    const peak = Math.max(profile.rankPoints, profile.s1PeakRankPoints ?? 0);
    const unlockedSet = new Set<PlayerAvatarId>([
      ...FREE_PLAYER_AVATARS,
      ...(profile.unlockedAvatars ?? []),
      ...(peak >= MESTRE_MIN_PTS ? S1_MESTRE_AVATARS : []),
    ]);
    if (!unlockedSet.has(cleanAvatar)) return;

    soundEngine.playUiClick(740);
    const nextChar: CharacterConfig = { ...character, avatarId: cleanAvatar };
    const nextProf: PlayerProfile = {
      ...profile,
      avatarId: cleanAvatar,
      unlockedAvatars: Array.from(unlockedSet),
    };
    setCharacter(nextChar);
    saveCharacterConfig(nextChar);
    setProfile(nextProf);
    saveProfile(nextProf);

    if (account) {
      try {
        const res = await multiplayerClient.updateProfile({
          avatarId: cleanAvatar,
          character: nextChar,
        });
        applyServerAccount(res.account);
      } catch {
        // ignore transient sync error
      }
    }
    if (firebaseUserRef.current) {
      void saveFirestoreProfile(firebaseUserRef.current, {
        avatarId: cleanAvatar,
      }).catch(() => undefined);
    }
  };

  const handleClaimSeason1Reward = async (rewardId: string) => {
    if (claimingRewardId) return;
    const tier = SEASON_1_REWARDS.find((r) => r.id === rewardId);
    if (!tier) return;
    setSeasonClaimFeedback(null);
    setClaimingRewardId(rewardId);

    try {
      if (account) {
        const res = await multiplayerClient.claimSeason1Reward(rewardId);
        applyServerAccount(res.account);
        if (firebaseUserRef.current) {
          void saveFirestoreProfile(firebaseUserRef.current, {
            gold: res.account.gold,
            gems: res.account.gems,
            unlockedAvatars: res.account.unlockedAvatars,
            s1ClaimedRewards: res.account.s1ClaimedRewards,
          }).catch(() => undefined);
        }
        const extraAvatars =
          res.grantedAvatars.length > 0
            ? ' + Avatar Angelical & Avatar Olho de Águia desbloqueados!'
            : '';
        setSeasonClaimFeedback(
          `Recompensa ${tier.tierName} resgatada: +${res.grantedGold} Ouro${
            res.grantedGems > 0 ? ` e +${res.grantedGems} Diamantes` : ''
          }${extraAvatars}`,
        );
      } else {
        const peak = Math.max(profile.rankPoints, profile.s1PeakRankPoints ?? 0);
        const already = (profile.s1ClaimedRewards ?? []).includes(rewardId);
        if (peak < tier.minPts || already) return;
        const unlockedSet = new Set<PlayerAvatarId>([
          ...FREE_PLAYER_AVATARS,
          ...(profile.unlockedAvatars ?? []),
          ...(tier.avatarIds ?? []),
        ]);
        const nextProf: PlayerProfile = {
          ...profile,
          gold: profile.gold + tier.goldReward,
          gems: profile.gems + (tier.gemsReward ?? 0),
          s1ClaimedRewards: [...(profile.s1ClaimedRewards ?? []), rewardId],
          unlockedAvatars: Array.from(unlockedSet),
        };
        setProfile(nextProf);
        saveProfile(nextProf);
        setSeasonClaimFeedback(
          `Recompensa ${tier.tierName} resgatada: +${tier.goldReward} Ouro${
            tier.gemsReward ? ` e +${tier.gemsReward} Diamantes` : ''
          }${tier.avatarIds?.length ? ' + Avatares de Mestre S1!' : ''}`,
        );
      }
    } catch (err) {
      setSeasonClaimFeedback(
        err instanceof Error ? err.message : 'Não foi possível resgatar a recompensa.',
      );
    } finally {
      setClaimingRewardId(null);
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

  const handleChangeBrMap = (nextMap: BrMapId) => {
    setBrMapId(nextMap);
    engineRef.current?.setBrMapId(nextMap);
    if (engineRef.current) {
      setMapMeta(engineRef.current.getMapMetadata());
    }
    if (account) {
      void multiplayerClient
        .setPartyConfig({ mapId: nextMap })
        .then((res) => syncPartyConfigState(res.party))
        .catch(() => undefined);
    }
  };

  const handleChangeGameVariant = (variant: GameVariant) => {
    setGameVariant(variant);
    engineRef.current?.setGameVariant(variant);
    const syncedFormat: GladiadoresFormat | undefined =
      variant === 'gladiadores' && party && party.members.length === 2 ? '2v2' : undefined;
    if (syncedFormat) {
      setGladiadoresFormat(syncedFormat);
      engineRef.current?.setGladiadoresFormat(syncedFormat);
    }
    if (account) {
      void multiplayerClient
        .setPartyConfig({
          gameVariant: variant,
          ...(syncedFormat ? { gladiadoresFormat: syncedFormat } : {}),
        })
        .then((res) => syncPartyConfigState(res.party))
        .catch(() => undefined);
    }
  };

  const handleChangeGladiadoresFormat = (fmt: GladiadoresFormat) => {
    setGladiadoresFormat(fmt);
    engineRef.current?.setGladiadoresFormat(fmt);
    if (account) {
      void multiplayerClient
        .setPartyConfig({ gladiadoresFormat: fmt })
        .then((res) => syncPartyConfigState(res.party))
        .catch(() => undefined);
    }
  };

  const handleChangeGladiadoresTargetRounds = (rounds: number) => {
    setGladiadoresTargetRounds(rounds);
    engineRef.current?.setGladiadoresTargetRounds(rounds);
  };

  const handleStartMatch = async () => {
    if (!engineRef.current) return;
    if (searchState.active) return;
    soundEngine.unlock();
    soundEngine.playUiConfirm();
    engineRef.current.setGameVariant(gameVariant);
    if (gameVariant === 'gladiadores') {
      engineRef.current.setGladiadoresFormat(gladiadoresFormat);
      engineRef.current.setGladiadoresTargetRounds(gladiadoresTargetRounds);
    }
    const startedAt = Date.now();
    setSearchState({ active: true, startedAtMs: startedAt, poolKey: null, isOffline: false });
    try {
      if (!multiplayerClient.isAuthenticated()) {
        const guest = await multiplayerClient.loginGuest({
          nickname: profileRef.current.nickname,
          character: characterRef.current,
        });
        applyServerAccount(guest.account);
        syncPartyConfigState(guest.party);
        setInvites(guest.invites);
      }
      await multiplayerClient
        .setPartyConfig({
          gameVariant,
          gladiadoresFormat,
          mode: matchMode,
          mapId: brMapId,
          isRanked,
          autoFillBots,
        })
        .then((cfg) => syncPartyConfigState(cfg.party))
        .catch(() => undefined);
      const res = await multiplayerClient.startMatchmaking();
      setSearchState({
        active: true,
        startedAtMs: res.search.startedAtMs ?? startedAt,
        poolKey: res.search.poolKey ?? null,
        isOffline: false,
      });
      refreshSearchingPools();
    } catch {
      // Offline fallback: gather for 10s right in the initial lobby, then launch bots
      setSearchState({ active: true, startedAtMs: startedAt, poolKey: null, isOffline: true });
      if (offlineLaunchTimerRef.current !== null) {
        window.clearTimeout(offlineLaunchTimerRef.current);
      }
      offlineLaunchTimerRef.current = window.setTimeout(() => {
        offlineLaunchTimerRef.current = null;
        setSearchState({ active: false, startedAtMs: 0, poolKey: null, isOffline: false });
        if (gameVariant === 'gladiadores') {
          engineRef.current?.setGladiadoresFormat(gladiadoresFormat);
          engineRef.current?.setGladiadoresTargetRounds(gladiadoresTargetRounds);
          engineRef.current?.startGladiadoresMatch();
        } else {
          engineRef.current?.startOfflineBrMatch();
        }
      }, 10_000);
    }
  };

  const handleCancelSearch = () => {
    soundEngine.playUiClick(480);
    if (offlineLaunchTimerRef.current !== null) {
      window.clearTimeout(offlineLaunchTimerRef.current);
      offlineLaunchTimerRef.current = null;
    }
    setSearchState({ active: false, startedAtMs: 0, poolKey: null, isOffline: false });
    setSearchElapsedSec(0);
    void multiplayerClient.cancelMatchmaking().catch(() => undefined);
  };

  const handleJoinSearchingPool = async (poolKey: string) => {
    setSearchJoinError(null);
    setJoiningPoolKey(poolKey);
    try {
      if (!multiplayerClient.isAuthenticated()) {
        const guest = await multiplayerClient.loginGuest({
          nickname: profileRef.current.nickname,
          character: characterRef.current,
        });
        applyServerAccount(guest.account);
        syncPartyConfigState(guest.party);
        setInvites(guest.invites);
      }
      const res = await multiplayerClient.joinMatchmakingQueue(poolKey);
      syncPartyConfigState(res.party);
      setSearchState({
        active: true,
        startedAtMs: res.search.startedAtMs ?? Date.now(),
        poolKey: res.search.poolKey ?? poolKey,
        isOffline: false,
      });
      setShowSearchingModal(false);
      refreshSearchingPools();
    } catch (err) {
      setSearchJoinError(err instanceof Error ? err.message : 'Não foi possível entrar nesta busca.');
    } finally {
      setJoiningPoolKey(null);
    }
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
            alt="Lobby Free Fire Bermuda"
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
          brMapId={brMapId}
          gameVariant={gameVariant}
          gladiadoresFormat={gladiadoresFormat}
          gladiadoresTargetRounds={gladiadoresTargetRounds}
          matchMode={matchMode}
          isRanked={isRanked}
          autoFillBots={autoFillBots}
          account={account}
          party={party}
          invites={invites}
          onChangeGladiadoresFormat={handleChangeGladiadoresFormat}
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
            setArsenalInitialTab('weapons');
            setShowArsenalModal(true);
          }}
          onOpenRankModal={() => {
            soundEngine.playUiClick();
            setSeasonClaimFeedback(null);
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
            if (searchState.active) {
              handleCancelSearch();
            }
            engineRef.current?.stateMachine.transition(GameState.MENU);
          }}
          isSearchingMatch={searchState.active}
          searchElapsedSec={searchElapsedSec}
          searchingPlayersCount={searchingPools.reduce((sum, p) => sum + p.players.length, 0)}
          onCancelSearch={handleCancelSearch}
          onOpenSearchingPlayers={() => {
            setSearchJoinError(null);
            refreshSearchingPools();
            setShowSearchingModal(true);
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
          mapId={mapMeta.mapId}
          mapRange={mapMeta.mapRange}
          bermudaMinimapCanvas={mapMeta.bermudaMinimapCanvas}
          input={engineRef.current.input}
          controlMode={settings.controlMode}
          keyBindings={settings.keyBindings}
          emulatorMode={settings.emulatorMode}
          macros={settings.macros}
          ggMousePro={settings.ggMousePro}
          hudLayout={settings.hudLayout}
          showFps={settings.showFps}
          isPaused={isPaused}
          isBackpackOpen={isBackpackOpen}
          onTogglePause={() => {
            soundEngine.playUiClick();
            setIsBackpackOpen(false);
            setIsShopOpen(false);
            setIsPaused((p) => {
              const next = !p;
              if (!next && engineRef.current && !engineRef.current.input.mouseSuspended) {
                engineRef.current.input.setGameplayActive(true);
                engineRef.current.input.requestLock();
              }
              return next;
            });
          }}
          onToggleBackpack={() => {
            setIsShopOpen(false);
            setIsBackpackOpen((b) => {
              const next = !b;
              if (!next && !isPaused && engineRef.current && !engineRef.current.input.mouseSuspended) {
                engineRef.current.input.setGameplayActive(true);
                engineRef.current.input.requestLock();
              }
              return next;
            });
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
          onOpenGgMacroModal={() => {
            soundEngine.playUiClick();
            setShowGgMacroModal(true);
          }}
          onSelectScope={(sc) => engineRef.current?.setActiveWeaponScope(sc)}
          onSelectGlooSkin={(skin) => {
            const nextChar: CharacterConfig = { ...character, glooSkin: skin };
            handleUpdateCharacter(nextChar);
            engineRef.current?.setGlooSkin(skin);
          }}
          onSelectGladiadoresWeapon={(wid, slot) => {
            engineRef.current?.selectGladiadoresWeapon(wid, slot);
          }}
          onReadyGladiadoresRound={() => {
            engineRef.current?.skipGladiadoresPrep();
          }}
          onSkipWaiting={() => engineRef.current?.skipWaitingToPlane()}
          onJumpFromPlane={() => engineRef.current?.jumpFromPlane()}
          onOpenParachute={() => engineRef.current?.openParachute()}
          onReturnLobby={() => {
            setIsPaused(false);
            setIsBackpackOpen(false);
            setIsShopOpen(false);
            activeLaunchedRoomIdRef.current = null;
            voiceChatManager.handleReturnToLobby();
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
          onClose={() => {
            setIsBackpackOpen(false);
            if (engineRef.current && !engineRef.current.input.mouseSuspended) {
              engineRef.current.input.setGameplayActive(true);
              engineRef.current.input.requestLock();
            }
          }}
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
          onClose={() => {
            setIsShopOpen(false);
            if (engineRef.current && !engineRef.current.input.mouseSuspended) {
              engineRef.current.input.setGameplayActive(true);
              engineRef.current.input.requestLock();
            }
          }}
        />
      )}

      {/* 11. WIN & 12. GAMEOVER */}
      {(gameState === GameState.WIN || gameState === GameState.GAMEOVER) && (
        <EndMatchModal
          state={gameState}
          hud={hud}
          isRanked={isRanked || hud.isRanked}
          prevRankPoints={rankTransition?.prevPoints ?? profile.rankPoints}
          rankPoints={rankTransition?.newPoints ?? profile.rankPoints}
          rankDelta={lastRankDelta}
          playerNickname={profile.nickname}
          playerModelId={character.modelId}
          playerAvatarId={profile.avatarId ?? character.avatarId}
          onReturnLobby={() => {
            voiceChatManager.handleReturnToLobby();
            engineRef.current?.returnToLobby();
          }}
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

      {showSearchingModal && (
        <SearchingPlayersModal
          pools={searchingPools}
          currentPoolKey={searchState.poolKey}
          currentAccountId={account?.id ?? null}
          isPartyLeader={!party || !account || party.leaderId === account.id}
          joiningPoolKey={joiningPoolKey}
          errorMsg={searchJoinError}
          onRefresh={refreshSearchingPools}
          onJoinPool={(poolKey) => void handleJoinSearchingPool(poolKey)}
          onClose={() => {
            setShowSearchingModal(false);
            setSearchJoinError(null);
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
          onOpenAvatars={() => {
            setArsenalInitialTab('avatars');
            setShowArsenalModal(true);
          }}
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
          brMapId={brMapId}
          gameVariant={gameVariant}
          gladiadoresFormat={gladiadoresFormat}
          gladiadoresTargetRounds={gladiadoresTargetRounds}
          matchMode={matchMode}
          isRanked={isRanked}
          autoFillBots={autoFillBots}
          rankPoints={profile.rankPoints}
          isPartyLeader={!party || !account || party.leaderId === account.id}
          onChangeBrMap={handleChangeBrMap}
          onChangeGameVariant={handleChangeGameVariant}
          onChangeGladiadoresFormat={handleChangeGladiadoresFormat}
          onChangeGladiadoresTargetRounds={handleChangeGladiadoresTargetRounds}
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
          unlockedAvatars={profile.unlockedAvatars}
          s1PeakRankPoints={Math.max(profile.rankPoints, profile.s1PeakRankPoints ?? 0)}
          onSelectAvatar={(av) => void handleSelectAvatar(av)}
          onChange={handleUpdateCharacter}
          onClose={() => {
            soundEngine.playUiClick();
            setShowCharModal(false);
          }}
        />
      )}

      {showArsenalModal && (
        <ArsenalModal
          initialTab={arsenalInitialTab}
          activeAvatarId={normalizePlayerAvatarId(profile.avatarId ?? character.avatarId)}
          unlockedAvatars={profile.unlockedAvatars}
          s1PeakRankPoints={Math.max(profile.rankPoints, profile.s1PeakRankPoints ?? 0)}
          onSelectAvatar={(av) => void handleSelectAvatar(av)}
          onClose={() => {
            soundEngine.playUiClick();
            setShowArsenalModal(false);
          }}
        />
      )}

      {showRankModal && (
        <RankModal
          profile={profile}
          currentPublicId={account?.publicId}
          claimingRewardId={claimingRewardId}
          seasonClaimFeedback={seasonClaimFeedback}
          onClaimSeason1Reward={(id) => void handleClaimSeason1Reward(id)}
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
          onOpenGgMacroModal={() => {
            soundEngine.playUiClick();
            engineRef.current?.input.setRebinding(false);
            setShowSettingsModal(false);
            setShowGgMacroModal(true);
          }}
          onRebindingChange={(active) => {
            engineRef.current?.input.setRebinding(active);
          }}
          onClose={() => {
            soundEngine.playUiClick();
            engineRef.current?.input.setRebinding(false);
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
          onOpenGgMacroModal={() => {
            soundEngine.playUiClick();
            setShowHudEditor(false);
            setShowGgMacroModal(true);
          }}
          onClose={() => {
            soundEngine.playUiClick();
            setShowHudEditor(false);
          }}
        />
      )}

      {showGgMacroModal && (
        <GgMouseMacroModal
          settings={settings}
          onSave={(nextSettings) => {
            soundEngine.playUiConfirm();
            engineRef.current?.input.setRebinding(false);
            handleUpdateSettings(nextSettings);
            setShowGgMacroModal(false);
          }}
          onRebindingChange={(active) => {
            engineRef.current?.input.setRebinding(active);
          }}
          onClose={() => {
            soundEngine.playUiClick();
            engineRef.current?.input.setRebinding(false);
            setShowGgMacroModal(false);
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

      {needsRotateLandscape && (
        <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-6 text-center text-white select-none">
          <div className="max-w-xs w-full flex flex-col items-center gap-5">
            <div
              className="w-20 h-20 flex items-center justify-center"
              style={{ animation: 'ffPhoneRotate 2.4s ease-in-out infinite' }}
            >
              <svg
                viewBox="0 0 64 64"
                className="w-16 h-16 text-amber-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="18" y="6" width="28" height="52" rx="5" />
                <line x1="28" y1="51" x2="36" y2="51" />
                <path d="M8 24 C8 16 12 11 18 9" stroke="#fbbf24" strokeWidth="2.4" />
                <polyline points="5,20 8,25 13,22" stroke="#fbbf24" strokeWidth="2.4" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
                Vire a Tela
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Gire o celular para a posição horizontal (deitada) para jogar em tela cheia.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                requestAppFullscreen();
              }}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-black text-xs uppercase tracking-wider cursor-pointer transition-transform"
            >
              Ativar Tela Cheia e Girar
            </button>
          </div>
        </div>
      )}

      {gameState !== GameState.BOOT && (
        <div
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
          className="pointer-events-none fixed top-0.5 left-1.5 z-[35] whitespace-nowrap rounded-none bg-black/35 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white/90"
        >
          {hud.fps} FPS | {hud.drawCalls} Calls | {hud.triangles} Tris
        </div>
      )}
    </div>
  );
}
