import type {
  BrMapId,
  CharacterConfig,
  GameVariant,
  GladiadoresFormat,
  GlooSkinId,
  MatchMode,
  PlayerAvatarId,
  WeaponId,
} from '../game/types.ts';

export type PresenceStatus = 'offline' | 'lobby' | 'matchmaking' | 'in_match';

export interface PublicPlayerAccount {
  id: number;
  publicId: string;
  username: string;
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
  avatarId: PlayerAvatarId;
  unlockedAvatars: PlayerAvatarId[];
  seasonId: string;
  s1PeakRankPoints: number;
  s1ClaimedRewards: string[];
  character: Partial<CharacterConfig>;
  presence?: PresenceStatus;
}

export interface FriendEntry {
  friendshipId: number;
  account: PublicPlayerAccount;
  presence: PresenceStatus;
}

export interface FriendRequestEntry {
  friendshipId: number;
  direction: 'incoming' | 'outgoing';
  account: PublicPlayerAccount;
  createdAt: string;
}

export interface PartyMemberInfo {
  accountId: number;
  publicId: string;
  nickname: string;
  level: number;
  rankPoints: number;
  avatarId?: PlayerAvatarId;
  character: Partial<CharacterConfig>;
  ready: boolean;
  isLeader: boolean;
}

export interface PartyState {
  partyId: string;
  leaderId: number;
  gameVariant?: GameVariant;
  gladiadoresFormat?: GladiadoresFormat;
  mode: MatchMode;
  mapId?: BrMapId;
  isRanked: boolean;
  autoFillBots: boolean;
  status: 'idle' | 'matchmaking' | 'in_match';
  roomId: string | null;
  members: PartyMemberInfo[];
}

export interface PartyInvitePayload {
  inviteId: string;
  partyId: string;
  fromAccountId: number;
  fromPublicId: string;
  fromNickname: string;
  fromRankPoints: number;
  gameVariant?: GameVariant;
  gladiadoresFormat?: GladiadoresFormat;
  mode: MatchMode;
  mapId?: BrMapId;
  isRanked: boolean;
  createdAt: number;
}

export interface AirplaneRouteSync {
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  durationSec: number;
  startedAtMs: number;
}

export interface SafeZoneSyncState {
  phase: number;
  totalPhases: number;
  isShrinking: boolean;
  timerSec: number;
  currentX: number;
  currentZ: number;
  currentRadius: number;
  nextX: number;
  nextZ: number;
  nextRadius: number;
  damagePerSec: number;
}

export interface RoomHumanSlot {
  accountId: number;
  publicId: string;
  nickname: string;
  level?: number;
  rankPoints?: number;
  avatarId?: PlayerAvatarId;
  teamId: number; // 1..12
  slotInTeam: number; // 1..4
  isTeamLeader?: boolean;
  character: Partial<CharacterConfig>;
}

export interface MatchRoomJoinInfo {
  roomId: string;
  seed: number;
  gameVariant?: GameVariant;
  gladiadoresFormat?: GladiadoresFormat;
  mode: MatchMode;
  mapId?: BrMapId;
  isRanked: boolean;
  autoFillBots: boolean;
  hostAccountId: number;
  yourAccountId: number;
  yourTeamId: number;
  yourSlotInTeam: number;
  waitingEndsAtMs: number;
  planeStartedAtMs: number;
  airplane: AirplaneRouteSync;
  humans: RoomHumanSlot[];
}

export interface SearchingPlayerInfo {
  accountId: number;
  publicId: string;
  nickname: string;
  level: number;
  rankPoints: number;
  characterModelId: string;
  avatarId?: PlayerAvatarId;
}

export interface SearchingPoolInfo {
  poolKey: string;
  gameVariant?: GameVariant;
  gladiadoresFormat?: GladiadoresFormat;
  mode: MatchMode;
  mapId: BrMapId;
  isRanked: boolean;
  startedAtMs: number;
  launchAtMs: number;
  players: SearchingPlayerInfo[];
}

export interface MatchmakingSearchStatus {
  searching: boolean;
  poolKey?: string;
  startedAtMs?: number;
  launchAtMs?: number;
  gameVariant?: GameVariant;
  gladiadoresFormat?: GladiadoresFormat;
  mode?: MatchMode;
  mapId?: BrMapId;
  isRanked?: boolean;
}

export type RemoteFlightPhase = 'waiting' | 'airplane' | 'dropping' | 'parachute' | 'landed';

export interface RemotePlayerSync {
  accountId: number;
  publicId: string;
  nickname: string;
  level?: number;
  rankPoints?: number;
  avatarId?: PlayerAvatarId;
  teamId: number;
  slotInTeam: number;
  isTeamLeader?: boolean;
  character: Partial<CharacterConfig>;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  stance: 'stand' | 'crouch' | 'prone';
  isSprinting: boolean;
  isAiming: boolean;
  isFiring?: boolean;
  isReloading?: boolean;
  isHealing?: boolean;
  isReviving?: boolean;
  isGrounded?: boolean;
  isVaulting?: boolean;
  vaultProgress?: number;
  inWater: boolean;
  isSwimming: boolean;
  isOnSurfboard: boolean;
  flightPhase: RemoteFlightPhase;
  weaponId: WeaponId | null;
  ammoInMag: number;
  reserveAmmo: number;
  hp: number;
  maxHp: number;
  vestLevel: 0 | 1 | 2 | 3;
  helmetLevel: 0 | 1 | 2 | 3;
  isDowned: boolean;
  bleedHp: number;
  eliminated: boolean;
  kills: number;
  damageDealt?: number;
  healingDone?: number;
  activeVehicleId: string | null;
  vehicleSeat?: 'driver' | 'passenger' | null;
  updatedAtMs: number;
}

export interface RemoteVehicleSync {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  hp: number;
  destroyed: boolean;
  driverAccountId: number | null;
  passengerAccountIds?: number[];
  updatedAtMs: number;
}

export interface RemoteBotSync {
  id: string;
  teamId?: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  isDowned: boolean;
  bleedHp: number;
  eliminated: boolean;
  isDying?: boolean;
  weaponId: WeaponId;
  stance: 'stand' | 'crouch';
  airState?: 'inPlane' | 'skydiving' | 'parachuting' | 'ground';
  inParachute: boolean;
  isSwimming: boolean;
  isSprinting?: boolean;
  isAiming?: boolean;
  isFiring?: boolean;
  isReloading?: boolean;
  isHealing?: boolean;
  isReviving?: boolean;
  shotSeq?: number;
  kills: number;
  hidden?: boolean;
}

export interface RemoteGlooWallSync {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  ownerAccountId: number;
  skin?: GlooSkinId;
}

export interface RemoteKillFeedEvent {
  id: number;
  killerName: string;
  victimName: string;
  weaponShort: string;
  isHeadshot: boolean;
  killerAccountId?: number;
}

export interface GladiadoresRoomSync {
  round: number;
  phase: 'intro' | 'fight' | 'round_end';
  phaseTimerSec: number;
  scoreTeam1: number;
  scoreTeam2: number;
  winnerTeamId: number | null;
  banner: string | null;
}

export interface MatchRoomSnapshot {
  roomId: string;
  hostAccountId: number;
  serverTimeMs: number;
  waitingEndsAtMs: number;
  planeStartedAtMs: number;
  matchElapsedSec: number;
  airplane: AirplaneRouteSync;
  safeZone: SafeZoneSyncState;
  humans: RemotePlayerSync[];
  vehicles: RemoteVehicleSync[];
  bots: RemoteBotSync[];
  collectedLootIds: string[];
  glooWalls: RemoteGlooWallSync[];
  killFeed: RemoteKillFeedEvent[];
  aliveCount: number;
  winnerTeamId: number | null;
  gladiadores?: GladiadoresRoomSync | null;
}

export interface ClientMatchStatePush {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  stance: 'stand' | 'crouch' | 'prone';
  isSprinting: boolean;
  isAiming: boolean;
  isFiring?: boolean;
  isReloading?: boolean;
  isHealing?: boolean;
  isReviving?: boolean;
  isGrounded?: boolean;
  isVaulting?: boolean;
  vaultProgress?: number;
  inWater: boolean;
  isSwimming: boolean;
  isOnSurfboard: boolean;
  flightPhase: RemoteFlightPhase;
  weaponId: WeaponId | null;
  ammoInMag: number;
  reserveAmmo: number;
  hp: number;
  maxHp: number;
  vestLevel: 0 | 1 | 2 | 3;
  helmetLevel: 0 | 1 | 2 | 3;
  isDowned: boolean;
  bleedHp: number;
  eliminated: boolean;
  kills: number;
  damageDealt?: number;
  healingDone?: number;
  activeVehicleId: string | null;
  vehicleSeat?: 'driver' | 'passenger' | null;
  vehicleState?: {
    id: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    speed: number;
    hp: number;
    destroyed: boolean;
  } | null;
  bots?: RemoteBotSync[];
  aliveCountHint?: number;
  gladiadores?: GladiadoresRoomSync | null;
}

export type MatchRoomAction =
  | {
      type: 'shoot';
      weaponId: WeaponId;
      originX: number;
      originY: number;
      originZ: number;
      hitX: number;
      hitY: number;
      hitZ: number;
    }
  | {
      type: 'damage_player';
      targetAccountId: number;
      damage: number;
      isHeadshot: boolean;
      weaponId: WeaponId;
    }
  | {
      type: 'revive_downed_player';
      targetAccountId: number;
    }
  | {
      type: 'revive_from_shop';
      targetAccountId: number;
      shopX: number;
      shopZ: number;
    }
  | {
      type: 'collect_loot';
      lootId: string;
    }
  | {
      type: 'spawn_gloo';
      id: string;
      x: number;
      y: number;
      z: number;
      rotY: number;
      skin?: GlooSkinId;
    }
  | {
      type: 'damage_gloo';
      id: string;
      damage: number;
    }
  | {
      type: 'kill_feed';
      killerName: string;
      victimName: string;
      weaponShort: string;
      isHeadshot: boolean;
    }
  | {
      type: 'damage_bot';
      botId: string;
      damage: number;
      isHeadshot: boolean;
      weaponShort: string;
      attackerX: number;
      attackerZ: number;
    }
  | {
      type: 'glad_ready';
      round: number;
    };
