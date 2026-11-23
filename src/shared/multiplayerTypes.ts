import type { BrMapId, CharacterConfig, GlooSkinId, MatchMode, WeaponId } from '../game/types.ts';

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
  character: Partial<CharacterConfig>;
  ready: boolean;
  isLeader: boolean;
}

export interface PartyState {
  partyId: string;
  leaderId: number;
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
  teamId: number; // 1..12
  slotInTeam: number; // 1..4
  isTeamLeader?: boolean;
  character: Partial<CharacterConfig>;
}

export interface MatchRoomJoinInfo {
  roomId: string;
  seed: number;
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

export type RemoteFlightPhase = 'waiting' | 'airplane' | 'dropping' | 'parachute' | 'landed';

export interface RemotePlayerSync {
  accountId: number;
  publicId: string;
  nickname: string;
  level?: number;
  rankPoints?: number;
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
  activeVehicleId: string | null;
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
  updatedAtMs: number;
}

export interface RemoteBotSync {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  isDowned: boolean;
  bleedHp: number;
  eliminated: boolean;
  weaponId: WeaponId;
  stance: 'stand' | 'crouch';
  inParachute: boolean;
  isSwimming: boolean;
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
  activeVehicleId: string | null;
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
    };
