import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { isDatabaseConfigured } from './src/db/index.ts';
import {
  claimSeason1Reward,
  createGuestAccount,
  findAccountByPublicIdOrNick,
  getAccountByToken,
  getAccountMatchHistory,
  getAccountProfileById,
  getLeaderboard,
  listFriendsAndRequests,
  loginAccount,
  loginOrRegisterFirebaseAccount,
  logoutSession,
  recordMatchHistory,
  registerAccount,
  respondFriendRequest,
  removeFriend,
  sendFriendRequest,
  updateAccountStatsAndProfile,
} from './src/db/accounts.ts';
import { verifyFirebaseIdToken } from './src/lib/firebase-admin.ts';
import {
  fetchSupabaseLeaderboard,
  isSupabaseConfigured,
  syncAccountToSupabase,
  syncMatchHistoryToSupabase,
  verifySupabaseToken,
} from './src/lib/supabase.ts';
import type {
  AirplaneRouteSync,
  ClientMatchStatePush,
  GladiadoresRoomSync,
  MatchRoomAction,
  MatchRoomJoinInfo,
  MatchRoomSnapshot,
  MatchmakingSearchStatus,
  PartyInvitePayload,
  PartyMemberInfo,
  PartyState,
  PresenceStatus,
  PublicPlayerAccount,
  RemoteBotSync,
  RemoteGlooWallSync,
  RemoteKillFeedEvent,
  RemotePlayerSync,
  RemoteVehicleSync,
  RoomHumanSlot,
  SafeZoneSyncState,
  SearchingPlayerInfo,
  SearchingPoolInfo,
} from './src/shared/multiplayerTypes.ts';
import type { BrMapId, GameVariant, GladiadoresFormat, MatchMode } from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

interface AuthenticatedRequest extends Request {
  account?: PublicPlayerAccount;
  token?: string;
}

// ============================================================================
// REAL-TIME PRESENCE, PARTIES & AUTHORITATIVE MULTIPLAYER ROOMS (IN MEMORY)
// ============================================================================

const onlineSockets = new Map<number, Set<WebSocket>>();
const lastHeartbeatMs = new Map<number, number>();
const accountPartyMap = new Map<number, string>();
const parties = new Map<string, PartyState>();
const partyInvites = new Map<string, PartyInvitePayload[]>(); // keyed by targetAccountId (as string)
const accountMatchMap = new Map<number, string>();
const rooms = new Map<string, ServerMatchRoom>();

// Initial-lobby matchmaking queue pools (gather online players in 10s-20s BEFORE entering match)
const QUEUE_SOLO_LAUNCH_MS = 12_000;
const QUEUE_MAX_WINDOW_MS = 20_000;
const QUEUE_JOIN_GRACE_MS = 5_000;
const ROOM_BRIEF_WARMUP_MS = 5_500;

interface MatchmakingPoolEntry {
  partyId: string;
  joinedAtMs: number;
  lastPollAtMs: number;
}

interface MatchmakingPool {
  poolKey: string;
  gameVariant: GameVariant;
  gladiadoresFormat: GladiadoresFormat;
  mode: MatchMode;
  mapId: BrMapId;
  isRanked: boolean;
  startedAtMs: number;
  launchAtMs: number;
  entries: MatchmakingPoolEntry[];
}

const matchmakingPools = new Map<string, MatchmakingPool>();
const partyPoolKeyMap = new Map<string, string>();
const pendingMatchFound = new Map<number, { joinInfo: MatchRoomJoinInfo; expiresAtMs: number }>();

interface ServerMatchRoom {
  roomId: string;
  seed: number;
  gameVariant: GameVariant;
  gladiadoresFormat: GladiadoresFormat;
  mode: MatchMode;
  mapId: BrMapId;
  isRanked: boolean;
  autoFillBots: boolean;
  hostAccountId: number;
  createdAtMs: number;
  waitingEndsAtMs: number;
  planeStartedAtMs: number;
  joinOpen: boolean;
  nextTeamId: number;
  airplane: AirplaneRouteSync;
  humans: Map<number, RemotePlayerSync>;
  humanMeta: Map<number, RoomHumanSlot>;
  vehicles: Map<string, RemoteVehicleSync>;
  bots: RemoteBotSync[];
  collectedLootIds: Set<string>;
  glooWalls: Map<string, RemoteGlooWallSync>;
  killFeed: RemoteKillFeedEvent[];
  nextKillFeedId: number;
  aliveCount: number;
  winnerTeamId: number | null;
  gladiadores?: GladiadoresRoomSync | null;
  lastRequestMs: Map<number, number>;
  lastBotSentMs: Map<number, number>;
  lastWorldSentMs: Map<number, number>;
  sentWorldVersion: Map<number, number>;
  worldVersion: number;
}

function getPresence(accountId: number): PresenceStatus {
  const roomId = accountMatchMap.get(accountId);
  if (roomId && rooms.has(roomId)) {
    return 'in_match';
  }
  const pid = accountPartyMap.get(accountId);
  if (pid) {
    const p = parties.get(pid);
    if (p?.status === 'matchmaking') return 'matchmaking';
    if (p?.status === 'in_match') return 'in_match';
  }
  const socks = onlineSockets.get(accountId);
  if (socks && socks.size > 0) return 'lobby';
  const lastHb = lastHeartbeatMs.get(accountId) ?? 0;
  if (Date.now() - lastHb < 15000) return 'lobby';
  return 'offline';
}

function sendWs(accountId: number, payload: unknown): void {
  const set = onlineSockets.get(accountId);
  if (!set || set.size === 0) return;
  const raw = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === 1) {
      ws.send(raw);
    }
  }
}

function broadcastAllWs(payload: unknown): void {
  const raw = JSON.stringify(payload);
  for (const set of onlineSockets.values()) {
    for (const ws of set) {
      if (ws.readyState === 1) {
        ws.send(raw);
      }
    }
  }
}

function broadcastParty(party: PartyState): void {
  for (const m of party.members) {
    sendWs(m.accountId, { type: 'party_update', party });
  }
}

function broadcastRoom(room: ServerMatchRoom, payload: unknown, exceptAccountId?: number): void {
  const raw = JSON.stringify(payload);
  for (const accountId of room.humans.keys()) {
    if (exceptAccountId !== undefined && accountId === exceptAccountId) continue;
    const set = onlineSockets.get(accountId);
    if (!set) continue;
    for (const ws of set) {
      if (ws.readyState === 1) ws.send(raw);
    }
  }
}

function makePartyMember(acc: PublicPlayerAccount, isLeader: boolean): PartyMemberInfo {
  return {
    accountId: acc.id,
    publicId: acc.publicId,
    nickname: acc.nickname,
    level: acc.level,
    rankPoints: acc.rankPoints,
    avatarId: acc.avatarId,
    character: acc.character,
    ready: true,
    isLeader,
  };
}

function ensurePartyForAccount(acc: PublicPlayerAccount): PartyState {
  const existingId = accountPartyMap.get(acc.id);
  if (existingId && parties.has(existingId)) {
    const party = parties.get(existingId)!;
    const member = party.members.find((m) => m.accountId === acc.id);
    if (member) {
      member.nickname = acc.nickname;
      member.level = acc.level;
      member.rankPoints = acc.rankPoints;
      member.avatarId = acc.avatarId;
      member.character = acc.character;
      return party;
    }
  }
  const partyId = `pty_${acc.id}_${Date.now().toString(36)}`;
  const party: PartyState = {
    partyId,
    leaderId: acc.id,
    gameVariant: 'br',
    gladiadoresFormat: '1v1',
    mode: 'solo',
    mapId: 'bermuda',
    isRanked: false,
    autoFillBots: true,
    status: 'idle',
    roomId: null,
    members: [makePartyMember(acc, true)],
  };
  parties.set(partyId, party);
  accountPartyMap.set(acc.id, partyId);
  return party;
}

function makePoolKey(
  gameVariant: GameVariant,
  gladiadoresFormat: GladiadoresFormat,
  mode: MatchMode,
  mapId: BrMapId,
  isRanked: boolean,
): string {
  if (gameVariant === 'gladiadores') {
    return `gladiadores:${gladiadoresFormat}`;
  }
  return `${mode}:${mapId}:${isRanked ? 'ranked' : 'classic'}`;
}

function buildSearchingPoolsList(): SearchingPoolInfo[] {
  const result: SearchingPoolInfo[] = [];
  for (const pool of matchmakingPools.values()) {
    const players: SearchingPlayerInfo[] = [];
    for (const entry of pool.entries) {
      const party = parties.get(entry.partyId);
      if (!party || party.status !== 'matchmaking') continue;
      for (const m of party.members) {
        players.push({
          accountId: m.accountId,
          publicId: m.publicId,
          nickname: m.nickname,
          level: m.level,
          rankPoints: m.rankPoints,
          characterModelId: String(m.character?.modelId || 'adam'),
          avatarId: m.avatarId ?? m.character?.avatarId ?? 'default',
        });
      }
    }
    if (players.length === 0) continue;
    result.push({
      poolKey: pool.poolKey,
      gameVariant: pool.gameVariant,
      gladiadoresFormat: pool.gladiadoresFormat,
      mode: pool.mode,
      mapId: pool.mapId,
      isRanked: pool.isRanked,
      startedAtMs: pool.startedAtMs,
      launchAtMs: pool.launchAtMs,
      players,
    });
  }
  result.sort((a, b) => a.startedAtMs - b.startedAtMs);
  return result;
}

function broadcastSearchingQueue(): void {
  broadcastAllWs({
    type: 'matchmaking_queue_update',
    pools: buildSearchingPoolsList(),
  });
}

function removePartyFromMatchmaking(partyId: string, broadcast = true): void {
  const poolKey = partyPoolKeyMap.get(partyId);
  if (!poolKey) return;
  partyPoolKeyMap.delete(partyId);
  const pool = matchmakingPools.get(poolKey);
  if (pool) {
    pool.entries = pool.entries.filter((e) => e.partyId !== partyId);
    if (pool.entries.length === 0) {
      matchmakingPools.delete(poolKey);
    }
  }
  const party = parties.get(partyId);
  if (party && party.status === 'matchmaking') {
    party.status = 'idle';
    party.roomId = null;
    if (broadcast) {
      broadcastParty(party);
      for (const m of party.members) {
        sendWs(m.accountId, {
          type: 'matchmaking_status',
          status: { searching: false },
        });
      }
    }
  }
  if (broadcast) {
    broadcastSearchingQueue();
  }
}

function getSearchStatusForParty(party: PartyState): MatchmakingSearchStatus {
  const poolKey = partyPoolKeyMap.get(party.partyId);
  const pool = poolKey ? matchmakingPools.get(poolKey) : undefined;
  if (!pool || party.status !== 'matchmaking') {
    return { searching: false };
  }
  const entry = pool.entries.find((e) => e.partyId === party.partyId);
  return {
    searching: true,
    poolKey: pool.poolKey,
    startedAtMs: entry?.joinedAtMs ?? pool.startedAtMs,
    launchAtMs: pool.launchAtMs,
    gameVariant: pool.gameVariant,
    gladiadoresFormat: pool.gladiadoresFormat,
    mode: pool.mode,
    mapId: pool.mapId,
    isRanked: pool.isRanked,
  };
}

function joinPoolForParty(
  party: PartyState,
  gameVariant: GameVariant,
  gladiadoresFormat: GladiadoresFormat,
  mode: MatchMode,
  mapId: BrMapId,
  isRanked: boolean,
): MatchmakingSearchStatus {
  const now = Date.now();
  removePartyFromMatchmaking(party.partyId, false);
  const poolKey = makePoolKey(gameVariant, gladiadoresFormat, mode, mapId, isRanked);
  let pool = matchmakingPools.get(poolKey);
  if (!pool) {
    pool = {
      poolKey,
      gameVariant,
      gladiadoresFormat,
      mode,
      mapId,
      isRanked,
      startedAtMs: now,
      launchAtMs: now + QUEUE_SOLO_LAUNCH_MS,
      entries: [],
    };
    matchmakingPools.set(poolKey, pool);
  } else {
    pool.launchAtMs = Math.min(
      pool.startedAtMs + QUEUE_MAX_WINDOW_MS,
      Math.max(pool.launchAtMs, now + QUEUE_JOIN_GRACE_MS),
    );
  }

  pool.entries.push({
    partyId: party.partyId,
    joinedAtMs: now,
    lastPollAtMs: now,
  });
  if (gameVariant === 'gladiadores') {
    let totalHumans = 0;
    for (const e of pool.entries) {
      totalHumans += parties.get(e.partyId)?.members.length ?? 0;
    }
    const targetHumans = gladiadoresFormat === '2v2' ? 4 : 2;
    if (totalHumans >= targetHumans) {
      pool.launchAtMs = Math.min(pool.launchAtMs, now + 1_200);
    }
  }
  partyPoolKeyMap.set(party.partyId, poolKey);
  party.status = 'matchmaking';
  party.roomId = null;
  broadcastParty(party);

  const status: MatchmakingSearchStatus = {
    searching: true,
    poolKey: pool.poolKey,
    startedAtMs: now,
    launchAtMs: pool.launchAtMs,
    gameVariant: pool.gameVariant,
    gladiadoresFormat: pool.gladiadoresFormat,
    mode: pool.mode,
    mapId: pool.mapId,
    isRanked: pool.isRanked,
  };
  for (const m of party.members) {
    pendingMatchFound.delete(m.accountId);
    sendWs(m.accountId, { type: 'matchmaking_status', status });
  }
  broadcastSearchingQueue();
  return status;
}

function leaveCurrentParty(acc: PublicPlayerAccount): PartyState {
  const oldId = accountPartyMap.get(acc.id);
  if (oldId && parties.has(oldId)) {
    const oldParty = parties.get(oldId)!;
    oldParty.members = oldParty.members.filter((m) => m.accountId !== acc.id);
    if (oldParty.members.length === 0) {
      removePartyFromMatchmaking(oldId, false);
      parties.delete(oldId);
      broadcastSearchingQueue();
    } else {
      if (oldParty.leaderId === acc.id) {
        oldParty.leaderId = oldParty.members[0].accountId;
        oldParty.members[0].isLeader = true;
      }
      broadcastParty(oldParty);
    }
  }
  accountPartyMap.delete(acc.id);
  return ensurePartyForAccount(acc);
}

function maxMembersForMode(mode: MatchMode): number {
  if (mode === 'solo') return 1;
  if (mode === 'duo') return 2;
  return 4;
}

function maxMembersForParty(party: PartyState): number {
  if ((party.gameVariant ?? 'br') === 'gladiadores') {
    return (party.gladiadoresFormat ?? '1v1') === '2v2' ? 2 : 1;
  }
  return maxMembersForMode(party.mode);
}

function computeServerSafeZone(room: ServerMatchRoom, nowMs: number): SafeZoneSyncState {
  const elapsedAfterPlane = Math.max(0, (nowMs - room.planeStartedAtMs) / 1000);
  const radii = [820, 480, 300, 175, 85, 0];
  const dmgRates = [1, 2, 4, 8, 16];
  const phases = [
    { waitSec: 40, baseShrinkSec: 90, maxEdgeSpeed: 4.6 },
    { waitSec: 35, baseShrinkSec: 85, maxEdgeSpeed: 3.3 },
    { waitSec: 30, baseShrinkSec: 85, maxEdgeSpeed: 2.2 },
    { waitSec: 25, baseShrinkSec: 85, maxEdgeSpeed: 1.45 },
    { waitSec: 20, baseShrinkSec: 90, maxEdgeSpeed: 1.05 },
  ];

  // Build deterministic off-center zone chain from room.seed across varied island locations
  const centers: Array<{ x: number; z: number }> = [{ x: 0, z: 0 }];
  const shrinkSecs: number[] = [];
  for (let i = 0; i < phases.length; i++) {
    const prev = centers[i];
    const prevR = radii[i];
    const nextR = radii[i + 1];
    const maxAvailShift = Math.max(0, prevR - nextR);
    const h1 = Math.sin(room.seed * 0.00173 + (i + 1) * 19.37) * 43758.5453;
    const u1 = h1 - Math.floor(h1);
    const h2 = Math.cos(room.seed * 0.00291 + (i + 1) * 31.71) * 29341.1279;
    const u2 = h2 - Math.floor(h2);
    const ang = u1 * Math.PI * 2;
    const frac = nextR > 0 ? 0.48 + u2 * 0.42 : 0.22 + u2 * 0.4;
    const dist = maxAvailShift * frac;
    let nx = prev.x + Math.cos(ang) * dist;
    let nz = prev.z + Math.sin(ang) * dist;
    // Clamp gently inside Bermuda dry island bounds while staying inside previous circle
    const maxBoundX = 620;
    const maxBoundZ = 520;
    if (Math.abs(nx) > maxBoundX || Math.abs(nz) > maxBoundZ) {
      const clampedX = Math.max(-maxBoundX, Math.min(maxBoundX, nx));
      const clampedZ = Math.max(-maxBoundZ, Math.min(maxBoundZ, nz));
      const cDist = Math.hypot(clampedX - prev.x, clampedZ - prev.z);
      if (cDist > maxAvailShift && cDist > 0.001) {
        const s = maxAvailShift / cDist;
        nx = prev.x + (clampedX - prev.x) * s;
        nz = prev.z + (clampedZ - prev.z) * s;
      } else {
        nx = clampedX;
        nz = clampedZ;
      }
    }
    centers.push({ x: nx, z: nz });
    const shiftDist = Math.hypot(nx - prev.x, nz - prev.z);
    const farEdgeTravel = Math.max(10, (prevR - nextR) + shiftDist);
    shrinkSecs.push(
      Math.max(phases[i].baseShrinkSec, Math.round(farEdgeTravel / phases[i].maxEdgeSpeed)),
    );
  }

  let accSec = 0;
  for (let i = 0; i < phases.length; i++) {
    const phaseCfg = phases[i];
    const shrinkSec = shrinkSecs[i];
    const phaseDur = phaseCfg.waitSec + shrinkSec;
    const prev = centers[i];
    const next = centers[i + 1];
    const prevR = radii[i];
    const nextR = radii[i + 1];

    if (elapsedAfterPlane < accSec + phaseDur) {
      const phaseElapsed = elapsedAfterPlane - accSec;
      const isShrinking = phaseElapsed >= phaseCfg.waitSec;
      const timerSec = isShrinking
        ? Math.max(0, phaseDur - phaseElapsed)
        : Math.max(0, phaseCfg.waitSec - phaseElapsed);
      const t = isShrinking
        ? Math.min(1, (phaseElapsed - phaseCfg.waitSec) / Math.max(1, shrinkSec))
        : 0;
      return {
        phase: i + 1,
        totalPhases: 5,
        isShrinking,
        timerSec,
        currentX: prev.x + (next.x - prev.x) * t,
        currentZ: prev.z + (next.z - prev.z) * t,
        currentRadius: prevR + (nextR - prevR) * t,
        nextX: next.x,
        nextZ: next.z,
        nextRadius: nextR,
        damagePerSec: dmgRates[i] ?? 16,
      };
    }
    accSec += phaseDur;
  }

  const finalCenter = centers[centers.length - 1];
  return {
    phase: 5,
    totalPhases: 5,
    isShrinking: false,
    timerSec: 0,
    currentX: finalCenter.x,
    currentZ: finalCenter.z,
    currentRadius: 0,
    nextX: finalCenter.x,
    nextZ: finalCenter.z,
    nextRadius: 0,
    damagePerSec: dmgRates[4],
  };
}

function createAirplaneRoute(
  seed: number,
  startedAtMs: number,
  _mapId: BrMapId = 'bermuda',
): AirplaneRouteSync {
  const angle = ((seed % 3600) / 3600) * Math.PI * 2;
  const radius = 840;
  const offset = (((seed * 7) % 1000) / 1000 - 0.5) * 320;
  const perpX = -Math.sin(angle);
  const perpZ = Math.cos(angle);
  return {
    startX: -Math.cos(angle) * radius + perpX * offset,
    startZ: -Math.sin(angle) * radius + perpZ * offset,
    endX: Math.cos(angle) * radius + perpX * offset,
    endZ: Math.sin(angle) * radius + perpZ * offset,
    durationSec: 32,
    startedAtMs,
  };
}

function buildJoinInfo(room: ServerMatchRoom, yourAccountId: number): MatchRoomJoinInfo {
  const yourMeta = room.humanMeta.get(yourAccountId);
  return {
    roomId: room.roomId,
    seed: room.seed,
    gameVariant: room.gameVariant,
    gladiadoresFormat: room.gladiadoresFormat,
    mode: room.mode,
    mapId: room.mapId,
    isRanked: room.isRanked,
    autoFillBots: room.autoFillBots,
    hostAccountId: room.hostAccountId,
    yourAccountId,
    yourTeamId: yourMeta?.teamId ?? 1,
    yourSlotInTeam: yourMeta?.slotInTeam ?? 1,
    waitingEndsAtMs: room.waitingEndsAtMs,
    planeStartedAtMs: room.planeStartedAtMs,
    airplane: room.airplane,
    humans: Array.from(room.humanMeta.values()),
  };
}

function buildRoomSnapshot(
  room: ServerMatchRoom,
  recipientAccountId?: number,
  forceFullWorld = false,
): MatchRoomSnapshot {
  const nowMs = Date.now();
  const isHost = recipientAccountId !== undefined && recipientAccountId === room.hostAccountId;

  let botsOut: RemoteBotSync[] = [];
  if (!isHost) {
    if (recipientAccountId === undefined || forceFullWorld) {
      botsOut = room.bots;
      if (recipientAccountId !== undefined) {
        room.lastBotSentMs.set(recipientAccountId, nowMs);
      }
    } else {
      const prevBotAt = room.lastBotSentMs.get(recipientAccountId) ?? 0;
      if (nowMs - prevBotAt >= 90) {
        botsOut = room.bots;
        room.lastBotSentMs.set(recipientAccountId, nowMs);
      }
    }
  }

  let includeWorld = forceFullWorld || recipientAccountId === undefined;
  if (!includeWorld && recipientAccountId !== undefined) {
    const prevVer = room.sentWorldVersion.get(recipientAccountId) ?? -1;
    const prevWorldAt = room.lastWorldSentMs.get(recipientAccountId) ?? 0;
    if (prevVer !== room.worldVersion || nowMs - prevWorldAt >= 1800) {
      includeWorld = true;
    }
  }
  if (includeWorld && recipientAccountId !== undefined) {
    room.sentWorldVersion.set(recipientAccountId, room.worldVersion);
    room.lastWorldSentMs.set(recipientAccountId, nowMs);
  }

  const passengersByVeh = new Map<string, number[]>();
  for (const h of room.humans.values()) {
    if (!h.eliminated && h.activeVehicleId) {
      let arr = passengersByVeh.get(h.activeVehicleId);
      if (!arr) {
        arr = [];
        passengersByVeh.set(h.activeVehicleId, arr);
      }
      arr.push(h.accountId);
    }
  }

  const vehiclesOut: RemoteVehicleSync[] = [];
  for (const v of room.vehicles.values()) {
    let driverId = v.driverAccountId;
    if (driverId !== null) {
      const drv = room.humans.get(driverId);
      if (!drv || drv.eliminated || drv.activeVehicleId !== v.id || drv.vehicleSeat === 'passenger') {
        driverId = null;
        v.driverAccountId = null;
      }
    }
    const allOccupants = passengersByVeh.get(v.id) ?? [];
    const passengers = driverId !== null ? allOccupants.filter((id) => id !== driverId) : allOccupants;
    vehiclesOut.push({
      ...v,
      driverAccountId: driverId,
      passengerAccountIds: passengers,
    });
  }

  return {
    roomId: room.roomId,
    hostAccountId: room.hostAccountId,
    serverTimeMs: nowMs,
    waitingEndsAtMs: room.waitingEndsAtMs,
    planeStartedAtMs: room.planeStartedAtMs,
    matchElapsedSec: Math.max(0, (nowMs - room.planeStartedAtMs) / 1000),
    airplane: room.airplane,
    safeZone: computeServerSafeZone(room, nowMs),
    humans: Array.from(room.humans.values()),
    vehicles: vehiclesOut,
    bots: botsOut,
    collectedLootIds: includeWorld ? Array.from(room.collectedLootIds) : [],
    glooWalls: includeWorld ? Array.from(room.glooWalls.values()) : [],
    killFeed: room.killFeed.slice(-8),
    aliveCount: room.aliveCount,
    winnerTeamId: room.winnerTeamId,
    gladiadores: room.gladiadores ?? null,
  };
}

function removeHumanFromRoom(accountId: number): void {
  pendingMatchFound.delete(accountId);
  const roomId = accountMatchMap.get(accountId);
  accountMatchMap.delete(accountId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  const p = room.humans.get(accountId);
  const wasAlive = Boolean(p && !p.eliminated);
  const nick = p?.nickname ?? '';
  if (p) {
    p.eliminated = true;
    p.hp = 0;
  }
  for (const v of room.vehicles.values()) {
    if (v.driverAccountId === accountId) {
      v.driverAccountId = null;
      v.speed = 0;
    }
  }
  room.humans.delete(accountId);
  room.humanMeta.delete(accountId);
  room.lastRequestMs.delete(accountId);
  room.lastBotSentMs.delete(accountId);
  room.lastWorldSentMs.delete(accountId);
  room.sentWorldVersion.delete(accountId);

  if (room.humans.size === 0) {
    rooms.delete(roomId);
    return;
  }

  if (wasAlive && nick && room.winnerTeamId === null) {
    const entry: RemoteKillFeedEvent = {
      id: room.nextKillFeedId++,
      killerName: '',
      victimName: nick,
      weaponShort: 'ELIM_ENV',
      isHeadshot: false,
      killerAccountId: 0,
    };
    room.killFeed.push(entry);
    if (room.killFeed.length > 16) room.killFeed.shift();
    broadcastRoom(room, { type: 'kill_feed_event', entry });
  }

  if (room.hostAccountId === accountId) {
    const nextHost = Array.from(room.humans.keys())[0];
    if (nextHost !== undefined) {
      room.hostAccountId = nextHost;
    }
  }
}

function applyClientStatePush(
  room: ServerMatchRoom,
  accountId: number,
  push: ClientMatchStatePush,
): void {
  const existing = room.humans.get(accountId);
  if (!existing) return;

  const nowMs = Date.now();
  room.lastRequestMs.set(accountId, nowMs);
  const prevVehId = existing.activeVehicleId;
  // Preserve server-authoritative health/elimination unless client hasn't synced yet or healed legitimately
  existing.x = push.x;
  existing.y = push.y;
  existing.z = push.z;
  existing.yaw = push.yaw;
  existing.pitch = push.pitch;
  existing.stance = push.stance;
  existing.isSprinting = push.isSprinting;
  existing.isAiming = push.isAiming;
  existing.isFiring = Boolean(push.isFiring);
  existing.isReloading = Boolean(push.isReloading);
  existing.isHealing = Boolean(push.isHealing);
  existing.isReviving = Boolean(push.isReviving);
  existing.isGrounded = push.isGrounded ?? true;
  existing.isVaulting = Boolean(push.isVaulting);
  existing.vaultProgress =
    typeof push.vaultProgress === 'number' && Number.isFinite(push.vaultProgress)
      ? Math.max(0, Math.min(1, push.vaultProgress))
      : 0;
  existing.inWater = push.inWater;
  existing.isSwimming = push.isSwimming;
  existing.isOnSurfboard = push.isOnSurfboard;
  existing.flightPhase = push.flightPhase;
  existing.weaponId = push.weaponId;
  existing.ammoInMag = push.ammoInMag;
  existing.reserveAmmo = push.reserveAmmo;
  existing.vestLevel = push.vestLevel;
  existing.helmetLevel = push.helmetLevel;
  existing.hp = push.hp;
  existing.maxHp = push.maxHp;
  existing.isDowned = push.isDowned;
  existing.bleedHp = push.bleedHp;
  existing.eliminated = push.eliminated;
  existing.kills = Math.max(existing.kills, push.kills);
  if (typeof push.damageDealt === 'number') {
    existing.damageDealt = Math.max(existing.damageDealt ?? 0, push.damageDealt);
  }
  if (typeof push.healingDone === 'number') {
    existing.healingDone = Math.max(existing.healingDone ?? 0, push.healingDone);
  }
  existing.activeVehicleId = push.activeVehicleId;
  existing.vehicleSeat = push.activeVehicleId ? (push.vehicleSeat ?? 'driver') : null;
  existing.updatedAtMs = nowMs;

  if (prevVehId && prevVehId !== push.activeVehicleId) {
    const oldVeh = room.vehicles.get(prevVehId);
    if (oldVeh && oldVeh.driverAccountId === accountId) {
      oldVeh.driverAccountId = null;
      oldVeh.updatedAtMs = nowMs;
    }
  }

  if (push.vehicleState && push.vehicleSeat !== 'passenger') {
    const curVeh = room.vehicles.get(push.vehicleState.id);
    const prevDriverId = curVeh?.driverAccountId ?? null;
    const prevDriverHuman = prevDriverId !== null ? room.humans.get(prevDriverId) : undefined;
    const prevDriverActive = Boolean(
      prevDriverHuman &&
        !prevDriverHuman.eliminated &&
        prevDriverHuman.activeVehicleId === push.vehicleState.id &&
        prevDriverHuman.vehicleSeat !== 'passenger' &&
        nowMs - (curVeh?.updatedAtMs ?? 0) <= 1500,
    );
    if (prevDriverId === null || prevDriverId === accountId || !prevDriverActive) {
      const isDrivingNow = push.activeVehicleId === push.vehicleState.id;
      room.vehicles.set(push.vehicleState.id, {
        ...push.vehicleState,
        driverAccountId: isDrivingNow ? accountId : null,
        passengerAccountIds: curVeh?.passengerAccountIds ?? [],
        updatedAtMs: nowMs,
      });
    }
  }

  if (accountId === room.hostAccountId && Array.isArray(push.bots)) {
    room.bots = push.bots;
  }
  if (accountId === room.hostAccountId && typeof push.aliveCountHint === 'number') {
    room.aliveCount = Math.max(1, push.aliveCountHint);
  }
  if (accountId === room.hostAccountId && push.gladiadores !== undefined) {
    room.gladiadores = push.gladiadores;
  }
}

function handleRoomAction(
  room: ServerMatchRoom,
  actorAccountId: number,
  action: MatchRoomAction,
): void {
  const actor = room.humans.get(actorAccountId);
  if (!actor) return;
  room.lastRequestMs.set(actorAccountId, Date.now());

  if (action.type === 'shoot') {
    broadcastRoom(
      room,
      {
        type: 'remote_shot',
        accountId: actorAccountId,
        weaponId: action.weaponId,
        originX: action.originX,
        originY: action.originY,
        originZ: action.originZ,
        hitX: action.hitX,
        hitY: action.hitY,
        hitZ: action.hitZ,
      },
      actorAccountId,
    );
    return;
  }

  if (action.type === 'damage_player') {
    const target = room.humans.get(action.targetAccountId);
    if (!target || target.eliminated || target.teamId === actor.teamId) return;
    const dmg = Math.max(1, Math.min(250, Math.round(action.damage)));

    // Relay real hit damage directly to the victim client so their local shield/HP & bleed state stays accurate
    sendWs(target.accountId, {
      type: 'incoming_damage',
      fromAccountId: actorAccountId,
      fromNickname: actor.nickname,
      fromX: actor.x,
      fromZ: actor.z,
      damage: dmg,
      isHeadshot: action.isHeadshot,
      weaponId: action.weaponId,
    });
    broadcastRoom(
      room,
      {
        type: 'spectate_damage_event',
        attackerAccountId: actorAccountId,
        targetAccountId: action.targetAccountId,
        damage: dmg,
        isHeadshot: action.isHeadshot,
      },
      actorAccountId,
    );
    return;
  }

  if (action.type === 'revive_downed_player') {
    const target = room.humans.get(action.targetAccountId);
    if (!target || target.teamId !== actor.teamId) return;
    target.isDowned = false;
    target.hp = 115;
    sendWs(target.accountId, {
      type: 'revived_by_ally',
      fromAccountId: actorAccountId,
      fromNickname: actor.nickname,
    });
    return;
  }

  if (action.type === 'revive_from_shop') {
    const target = room.humans.get(action.targetAccountId);
    if (!target || target.teamId !== actor.teamId) return;
    target.eliminated = false;
    target.isDowned = false;
    target.hp = 200;
    target.flightPhase = 'parachute';
    target.x = action.shopX;
    target.z = action.shopZ;
    sendWs(target.accountId, {
      type: 'revive_from_shop_drop',
      fromAccountId: actorAccountId,
      fromNickname: actor.nickname,
      shopX: action.shopX,
      shopZ: action.shopZ,
    });
    return;
  }

  if (action.type === 'collect_loot') {
    if (room.collectedLootIds.has(action.lootId)) return;
    room.collectedLootIds.add(action.lootId);
    room.worldVersion += 1;
    broadcastRoom(room, { type: 'loot_collected', lootId: action.lootId }, actorAccountId);
    return;
  }

  if (action.type === 'spawn_gloo') {
    const wall: RemoteGlooWallSync = {
      id: action.id,
      x: action.x,
      y: action.y,
      z: action.z,
      rotY: action.rotY,
      hp: 450,
      ownerAccountId: actorAccountId,
      skin: action.skin === 'ffwc' ? 'ffwc' : 'classic',
    };
    room.glooWalls.set(wall.id, wall);
    room.worldVersion += 1;
    broadcastRoom(room, { type: 'gloo_spawned', wall }, actorAccountId);
    return;
  }

  if (action.type === 'damage_gloo') {
    const wall = room.glooWalls.get(action.id);
    if (!wall) return;
    wall.hp -= action.damage;
    if (wall.hp <= 0) {
      room.glooWalls.delete(action.id);
      room.worldVersion += 1;
    }
    return;
  }

  if (action.type === 'kill_feed') {
    const isEnv =
      !action.killerName ||
      action.weaponShort === 'ELIM_ENV' ||
      action.weaponShort === 'KNOCK_ENV';
    const entry: RemoteKillFeedEvent = {
      id: room.nextKillFeedId++,
      killerName: isEnv ? '' : action.killerName,
      victimName: action.victimName,
      weaponShort: action.weaponShort,
      isHeadshot: isEnv ? false : action.isHeadshot,
      killerAccountId: isEnv ? 0 : actorAccountId,
    };
    room.killFeed.push(entry);
    if (room.killFeed.length > 16) room.killFeed.shift();
    broadcastRoom(room, { type: 'kill_feed_event', entry });
    return;
  }

  if (action.type === 'damage_bot') {
    const dmg = Math.max(1, Math.min(400, Math.round(action.damage)));
    sendWs(room.hostAccountId, {
      type: 'remote_bot_damage',
      fromAccountId: actorAccountId,
      fromNickname: actor.nickname,
      botId: action.botId,
      damage: dmg,
      isHeadshot: action.isHeadshot,
      weaponShort: action.weaponShort,
      attackerX: action.attackerX,
      attackerZ: action.attackerZ,
    });
    broadcastRoom(
      room,
      {
        type: 'spectate_damage_event',
        attackerAccountId: actorAccountId,
        botId: action.botId,
        damage: dmg,
        isHeadshot: action.isHeadshot,
      },
      actorAccountId,
    );
    return;
  }

  if (action.type === 'glad_ready') {
    sendWs(room.hostAccountId, {
      type: 'glad_ready',
      accountId: actorAccountId,
      round: action.round,
    });
  }
}

function launchSingleRoomBatch(
  pool: MatchmakingPool,
  batchParties: PartyState[],
  batchIndex: number,
): void {
  const now = Date.now();
  const seed = Math.floor(100000 + Math.random() * 899999);
  const roomId = `rm_${now.toString(36)}_${batchIndex}_${seed.toString(36)}`;
  const isGlad = pool.gameVariant === 'gladiadores';
  const waitingEndsAtMs = isGlad ? now : now + ROOM_BRIEF_WARMUP_MS;
  const planeStartedAtMs = waitingEndsAtMs;
  const firstParty = batchParties[0];

  const matchedRoom: ServerMatchRoom = {
    roomId,
    seed,
    gameVariant: pool.gameVariant,
    gladiadoresFormat: pool.gladiadoresFormat,
    mode: isGlad ? (pool.gladiadoresFormat === '2v2' ? 'duo' : 'solo') : pool.mode,
    mapId: pool.mapId,
    isRanked: isGlad ? false : pool.isRanked,
    autoFillBots: isGlad ? true : firstParty.autoFillBots,
    hostAccountId: firstParty.members[0].accountId,
    createdAtMs: now,
    waitingEndsAtMs,
    planeStartedAtMs,
    joinOpen: false,
    nextTeamId: 1,
    airplane: createAirplaneRoute(seed, planeStartedAtMs, pool.mapId),
    humans: new Map(),
    humanMeta: new Map(),
    vehicles: new Map(),
    bots: [],
    collectedLootIds: new Set(),
    glooWalls: new Map(),
    killFeed: [],
    nextKillFeedId: 1,
    aliveCount: isGlad ? (pool.gladiadoresFormat === '2v2' ? 4 : 2) : 51,
    winnerTeamId: null,
    gladiadores: isGlad
      ? {
          round: 1,
          phase: 'intro',
          phaseTimerSec: 10,
          scoreTeam1: 0,
          scoreTeam2: 0,
          winnerTeamId: null,
          banner: 'RODADA 1 · ESCOLHA SUAS ARMAS (10s)',
        }
      : null,
    lastRequestMs: new Map(),
    lastBotSentMs: new Map(),
    lastWorldSentMs: new Map(),
    sentWorldVersion: new Map(),
    worldVersion: 1,
  };

  let gladTeam1Count = 0;
  let gladTeam2Count = 0;
  const gladTeamCap = pool.gladiadoresFormat === '2v2' ? 2 : 1;

  for (const party of batchParties) {
    let assignedTeamId = matchedRoom.nextTeamId;
    if (isGlad) {
      const pLen = party.members.length;
      if (gladTeam1Count === 0) {
        assignedTeamId = 1;
      } else if (gladTeam2Count + pLen <= gladTeamCap && (gladTeam2Count <= gladTeam1Count || gladTeam1Count + pLen > gladTeamCap)) {
        assignedTeamId = 2;
      } else if (gladTeam1Count + pLen <= gladTeamCap) {
        assignedTeamId = 1;
      } else {
        assignedTeamId = 2;
      }
    } else {
      matchedRoom.nextTeamId += 1;
    }

    party.members.forEach((m, idx) => {
      removeHumanFromRoom(m.accountId);
      const slotInTeam = isGlad
        ? assignedTeamId === 1
          ? ++gladTeam1Count
          : ++gladTeam2Count
        : idx + 1;
      const isTeamLeader = isGlad ? slotInTeam === 1 : m.accountId === party.leaderId;
      const spawnSlotIdx = matchedRoom.humans.size;
      const spawnDx = ((spawnSlotIdx % 12) - 5.5) * 1.35;
      const spawnDz = Math.floor(spawnSlotIdx / 12) * 1.35;
      const gladX = slotInTeam === 2 ? -2613.5 : -2617.5;
      const gladZ = assignedTeamId === 1 ? -2619.5 : -2580.5;
      const meta: RoomHumanSlot = {
        accountId: m.accountId,
        publicId: m.publicId,
        nickname: m.nickname,
        level: m.level,
        rankPoints: m.rankPoints,
        avatarId: m.avatarId ?? m.character?.avatarId ?? 'default',
        teamId: assignedTeamId,
        slotInTeam,
        isTeamLeader,
        character: m.character,
      };
      matchedRoom.humanMeta.set(m.accountId, meta);
      matchedRoom.lastRequestMs.set(m.accountId, now);
      matchedRoom.humans.set(m.accountId, {
        accountId: m.accountId,
        publicId: m.publicId,
        nickname: m.nickname,
        level: m.level,
        rankPoints: m.rankPoints,
        avatarId: m.avatarId ?? m.character?.avatarId ?? 'default',
        teamId: assignedTeamId,
        slotInTeam,
        isTeamLeader,
        character: m.character,
        x: isGlad ? gladX : 2598 + spawnDx,
        y: isGlad ? 18.57 : 18.12,
        z: isGlad ? gladZ : 2596 + spawnDz,
        yaw: isGlad ? (assignedTeamId === 1 ? Math.PI : 0) : 0,
        pitch: isGlad ? -0.05 : -0.14,
        stance: 'stand',
        isSprinting: false,
        isAiming: false,
        isFiring: false,
        isReloading: false,
        isHealing: false,
        isReviving: false,
        isGrounded: true,
        isVaulting: false,
        vaultProgress: 0,
        inWater: false,
        isSwimming: false,
        isOnSurfboard: false,
        flightPhase: isGlad ? 'landed' : 'waiting',
        weaponId: isGlad ? 'scar' : 'g18',
        ammoInMag: isGlad ? 30 : 15,
        reserveAmmo: isGlad ? 180 : 45,
        hp: 200,
        maxHp: 200,
        vestLevel: isGlad ? 2 : 0,
        helmetLevel: isGlad ? 2 : 0,
        isDowned: false,
        bleedHp: 100,
        eliminated: false,
        kills: 0,
        activeVehicleId: null,
        updatedAtMs: now,
      });
      accountMatchMap.set(m.accountId, matchedRoom.roomId);
    });
  }

  if (!isGlad) {
    matchedRoom.aliveCount = Math.max(51, matchedRoom.humans.size);
  }
  rooms.set(roomId, matchedRoom);

  for (const party of batchParties) {
    party.status = 'in_match';
    party.roomId = matchedRoom.roomId;
    broadcastParty(party);
    for (const m of party.members) {
      const joinInfo = buildJoinInfo(matchedRoom, m.accountId);
      pendingMatchFound.set(m.accountId, {
        joinInfo,
        expiresAtMs: now + 35_000,
      });
      sendWs(m.accountId, {
        type: 'match_found',
        joinInfo,
      });
    }
  }
  for (const accId of matchedRoom.humans.keys()) {
    sendWs(accId, {
      type: 'room_snapshot',
      snapshot: buildRoomSnapshot(matchedRoom, accId, true),
    });
  }
}

function launchMatchmakingPool(pool: MatchmakingPool): void {
  matchmakingPools.delete(pool.poolKey);
  const activeParties: PartyState[] = [];
  for (const entry of pool.entries) {
    partyPoolKeyMap.delete(entry.partyId);
    const p = parties.get(entry.partyId);
    if (p && p.members.length > 0 && p.status === 'matchmaking') {
      activeParties.push(p);
    }
  }
  if (activeParties.length === 0) {
    broadcastSearchingQueue();
    return;
  }

  if (pool.gameVariant === 'gladiadores') {
    const maxHumans = pool.gladiadoresFormat === '2v2' ? 4 : 2;
    let curBatch: PartyState[] = [];
    let curCount = 0;
    let batchIdx = 0;
    for (const party of activeParties) {
      if (curBatch.length > 0 && curCount + party.members.length > maxHumans) {
        launchSingleRoomBatch(pool, curBatch, batchIdx++);
        curBatch = [];
        curCount = 0;
      }
      curBatch.push(party);
      curCount += party.members.length;
    }
    if (curBatch.length > 0) {
      launchSingleRoomBatch(pool, curBatch, batchIdx);
    }
  } else {
    launchSingleRoomBatch(pool, activeParties, 0);
  }
  broadcastSearchingQueue();
}

// Launch ready lobby matchmaking pools every 400ms
const matchmakingTickTimer = setInterval(() => {
  const now = Date.now();
  for (const pool of Array.from(matchmakingPools.values())) {
    let changed = false;
    const kept: MatchmakingPoolEntry[] = [];
    for (const entry of pool.entries) {
      const party = parties.get(entry.partyId);
      if (!party || party.status !== 'matchmaking' || party.members.length === 0) {
        partyPoolKeyMap.delete(entry.partyId);
        changed = true;
        continue;
      }
      const anyAlive = party.members.some((m) => {
        const socks = onlineSockets.get(m.accountId);
        if (socks && socks.size > 0) return true;
        const lastHb = lastHeartbeatMs.get(m.accountId) ?? 0;
        return now - lastHb < 30_000;
      });
      if (!anyAlive && now - entry.lastPollAtMs > 30_000) {
        partyPoolKeyMap.delete(entry.partyId);
        party.status = 'idle';
        changed = true;
        continue;
      }
      kept.push(entry);
    }
    pool.entries = kept;
    if (pool.entries.length === 0) {
      matchmakingPools.delete(pool.poolKey);
      changed = true;
      if (changed) broadcastSearchingQueue();
      continue;
    }
    if (now >= pool.launchAtMs) {
      launchMatchmakingPool(pool);
      continue;
    }
    if (changed) {
      broadcastSearchingQueue();
    }
  }
}, 400);
matchmakingTickTimer.unref?.();

// Periodic cleanup of stale empty rooms, pending notifications & expired party invites
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now > room.waitingEndsAtMs) {
      room.joinOpen = false;
    }
    if (room.humans.size === 0 || now - room.createdAtMs > 45 * 60 * 1000) {
      rooms.delete(roomId);
    }
  }
  for (const [accId, item] of pendingMatchFound.entries()) {
    if (now > item.expiresAtMs) pendingMatchFound.delete(accId);
  }
  for (const [k, list] of partyInvites.entries()) {
    const fresh = list.filter((inv) => now - inv.createdAt < 90_000);
    if (fresh.length === 0) partyInvites.delete(k);
    else partyInvites.set(k, fresh);
  }
}, 2500);
cleanupTimer.unref?.();

// ============================================================================
// EXPRESS SERVER + API ROUTES + WEBSOCKET SERVER ON PORT 3000
// ============================================================================

let cachedServerlessApp: express.Express | null = null;

export async function createExpressApp(
  options: { attachFrontend?: boolean } = {},
): Promise<express.Express> {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '512kb' }));

  const defaultAllowedOrigins = [
    'https://freefire-2017.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  const envOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*');
  const allowedOrigins = new Set<string>([...defaultAllowedOrigins, ...envOrigins]);

  app.use('/api', (req, res, next) => {
    const reqOrigin = req.headers.origin;
    const hostHeader = req.get('host');
    const sameOriginHttp = hostHeader ? `http://${hostHeader}` : '';
    const sameOriginHttps = hostHeader ? `https://${hostHeader}` : '';
    const isAllowedOrigin =
      Boolean(reqOrigin) &&
      (allowedOrigins.has(reqOrigin!) ||
        reqOrigin === sameOriginHttp ||
        reqOrigin === sameOriginHttps);

    if (isAllowedOrigin && reqOrigin) {
      res.setHeader('Access-Control-Allow-Origin', reqOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Firebase-Id-Token',
    );
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  const requireSession = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';
    const fbTokenHeader = req.headers['x-firebase-id-token'];
    const fbToken = typeof fbTokenHeader === 'string' ? fbTokenHeader.trim() : '';

    if (!token && !fbToken) {
      return res.status(401).json({ error: 'Sessão não autenticada.' });
    }
    try {
      let account = token ? await getAccountByToken(token) : null;
      if (!account && fbToken) {
        try {
          const decoded = await verifyFirebaseIdToken(fbToken);
          const restored = await loginOrRegisterFirebaseAccount({
            firebaseUid: decoded.uid,
            nickname: decoded.name
              ? String(decoded.name)
              : decoded.email
                ? String(decoded.email).split('@')[0]
                : 'Sobrevivente',
          });
          account = restored.account;
        } catch {
          account = null;
        }
      }
      if (!account) {
        return res.status(401).json({ error: 'Sessão expirada ou inválida.' });
      }
      lastHeartbeatMs.set(account.id, Date.now());
      req.account = account;
      req.token = token;
      next();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao validar sessão.';
      return res.status(500).json({ error: msg });
    }
  };

  // --- LIGHTWEIGHT LATENCY PING & BACKEND CAPABILITIES ---
  app.get('/api/ping', (_req, res) => {
    return res.json({ ok: true, serverTimeMs: Date.now() });
  });

  app.get(['/api/health', '/api/supabase/status'], (_req, res) => {
    return res.json({
      ok: true,
      cloudSql: isDatabaseConfigured,
      supabase: isSupabaseConfigured(),
      websocket: true,
      serverTimeMs: Date.now(),
    });
  });

  // --- FREE MIX-AND-MATCH SKIN BUNDLES CATALOG (numbered male/female GLBs) ---
  const SKIN_CDN_BASE = 'https://kalidade-br.github.io/freefire-2017/skin';
  const localSkinRoot = path.resolve(__dirname, 'skin');
  interface SkinBundleCatalogEntry {
    id: string;
    gender: 'male' | 'female';
    number: number;
    url: string;
    fallbackUrl?: string;
  }
  let cachedSkinCatalog: {
    expiresAt: number;
    male: SkinBundleCatalogEntry[];
    female: SkinBundleCatalogEntry[];
  } | null = null;
  let skinCatalogInFlight: Promise<{
    male: SkinBundleCatalogEntry[];
    female: SkinBundleCatalogEntry[];
  }> | null = null;

  async function probeNumberedSkinGender(gender: 'male' | 'female'): Promise<SkinBundleCatalogEntry[]> {
    const found: SkinBundleCatalogEntry[] = [];
    for (let n = 1; n <= 30; n++) {
      const localFile = path.join(localSkinRoot, gender, `${n}.glb`);
      const hasLocal = fs.existsSync(localFile);
      const remoteUrl = `${SKIN_CDN_BASE}/${gender}/${n}.glb`;
      let hasRemote = false;

      if (!hasLocal) {
        try {
          const ac = new AbortController();
          const timer = setTimeout(() => ac.abort(), 2500);
          const resp = await fetch(remoteUrl, { method: 'HEAD', signal: ac.signal });
          clearTimeout(timer);
          hasRemote = resp.ok;
        } catch {
          hasRemote = false;
        }
      }

      if (!hasLocal && !hasRemote) {
        break;
      }

      found.push(
        hasLocal
          ? {
              id: `${gender}:${n}`,
              gender,
              number: n,
              url: `/skin/${gender}/${n}.glb`,
              fallbackUrl: remoteUrl,
            }
          : {
              id: `${gender}:${n}`,
              gender,
              number: n,
              url: remoteUrl,
            },
      );
    }
    if (found.length === 0) {
      found.push({
        id: `${gender}:1`,
        gender,
        number: 1,
        url: `${SKIN_CDN_BASE}/${gender}/1.glb`,
      });
    }
    return found;
  }

  app.get('/api/skins/catalog', async (_req, res) => {
    const now = Date.now();
    if (cachedSkinCatalog && now < cachedSkinCatalog.expiresAt) {
      return res.json({
        male: cachedSkinCatalog.male,
        female: cachedSkinCatalog.female,
      });
    }
    try {
      if (!skinCatalogInFlight) {
        skinCatalogInFlight = Promise.all([
          probeNumberedSkinGender('male'),
          probeNumberedSkinGender('female'),
        ]).then(([male, female]) => {
          cachedSkinCatalog = {
            expiresAt: Date.now() + 5 * 60_000,
            male,
            female,
          };
          return { male, female };
        });
      }
      const result = await skinCatalogInFlight;
      return res.json(result);
    } catch {
      return res.json({
        male: [
          {
            id: 'male:1',
            gender: 'male',
            number: 1,
            url: '/skin/male/1.glb',
            fallbackUrl: `${SKIN_CDN_BASE}/male/1.glb`,
          },
        ],
        female: [
          {
            id: 'female:1',
            gender: 'female',
            number: 1,
            url: '/skin/female/1.glb',
            fallbackUrl: `${SKIN_CDN_BASE}/female/1.glb`,
          },
        ],
      });
    } finally {
      skinCatalogInFlight = null;
    }
  });

  // --- AUTH ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password, nickname, character } = req.body ?? {};
      const out = await registerAccount({
        username: String(username ?? ''),
        password: String(password ?? ''),
        nickname: nickname ? String(nickname) : undefined,
        character,
      });
      lastHeartbeatMs.set(out.account.id, Date.now());
      const party = ensurePartyForAccount(out.account);
      return res.json({ ...out, party, invites: [] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta.';
      return res.status(400).json({ error: msg });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body ?? {};
      const out = await loginAccount({
        username: String(username ?? ''),
        password: String(password ?? ''),
      });
      lastHeartbeatMs.set(out.account.id, Date.now());
      const party = ensurePartyForAccount(out.account);
      const invites = partyInvites.get(String(out.account.id)) ?? [];
      return res.json({ ...out, party, invites });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao entrar.';
      return res.status(401).json({ error: msg });
    }
  });

  app.post('/api/auth/firebase', async (req, res) => {
    try {
      const { idToken, nickname, character } = req.body ?? {};
      const tokenStr = String(idToken ?? '').trim();
      if (!tokenStr) {
        return res.status(400).json({ error: 'Token Firebase ausente.' });
      }
      const decoded = await verifyFirebaseIdToken(tokenStr);
      const out = await loginOrRegisterFirebaseAccount({
        firebaseUid: decoded.uid,
        nickname: nickname
          ? String(nickname)
          : decoded.name
            ? String(decoded.name)
            : decoded.email
              ? String(decoded.email).split('@')[0]
              : 'Sobrevivente',
        character,
      });
      lastHeartbeatMs.set(out.account.id, Date.now());
      const party = ensurePartyForAccount(out.account);
      const invites = partyInvites.get(String(out.account.id)) ?? [];
      return res.json({ ...out, party, invites });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar com Firebase.';
      return res.status(401).json({ error: msg });
    }
  });

  app.post('/api/auth/supabase', async (req, res) => {
    try {
      const accessToken = String(req.body?.accessToken ?? '').trim();
      if (!accessToken) {
        return res.status(400).json({ error: 'Token Supabase ausente.' });
      }
      const sbUser = await verifySupabaseToken(accessToken);
      if (!sbUser) {
        return res.status(401).json({ error: 'Token Supabase inválido ou não configurado.' });
      }
      const out = await loginOrRegisterFirebaseAccount({
        firebaseUid: `sb:${sbUser.id}`,
        nickname:
          typeof req.body?.nickname === 'string' && req.body.nickname.trim()
            ? req.body.nickname
            : sbUser.nickname,
        character: req.body?.character,
      });
      lastHeartbeatMs.set(out.account.id, Date.now());
      const party = ensurePartyForAccount(out.account);
      const invites = partyInvites.get(String(out.account.id)) ?? [];
      void syncAccountToSupabase(out.account);
      return res.json({ ...out, party, invites });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar com Supabase.';
      return res.status(401).json({ error: msg });
    }
  });

  app.post('/api/auth/guest', async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const nickname = typeof body.nickname === 'string' ? body.nickname : undefined;
      const character = body.character && typeof body.character === 'object' ? body.character : undefined;
      const out = await createGuestAccount({ nickname, character });
      lastHeartbeatMs.set(out.account.id, Date.now());
      const party = ensurePartyForAccount(out.account);
      return res.json({ ...out, party, invites: [] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar sessão de convidado.';
      return res.status(500).json({ error: msg });
    }
  });

  app.post('/api/auth/logout', requireSession, async (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    removeHumanFromRoom(acc.id);
    leaveCurrentParty(acc);
    await logoutSession(req.token!);
    return res.json({ ok: true });
  });

  app.get('/api/auth/me', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const party = ensurePartyForAccount(acc);
    const invites = partyInvites.get(String(acc.id)) ?? [];
    return res.json({
      account: { ...acc, presence: getPresence(acc.id) },
      party,
      invites,
    });
  });

  app.put('/api/profile/me', requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const acc = req.account!;
      const updated = await updateAccountStatsAndProfile(acc.id, req.body ?? {});
      const party = ensurePartyForAccount(updated);
      broadcastParty(party);
      void syncAccountToSupabase(updated);
      if (
        req.body &&
        (typeof req.body.rankPoints === 'number' ||
          typeof req.body.wins === 'number' ||
          typeof req.body.avatarId === 'string')
      ) {
        broadcastAllWs({ type: 'leaderboard_update' });
      }
      return res.json({ account: { ...updated, presence: getPresence(updated.id) } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar perfil.';
      const status = msg.includes('Avatar bloqueado') ? 403 : 500;
      return res.status(status).json({ error: msg });
    }
  });

  app.post('/api/season/s1/claim', requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const acc = req.account!;
      const rewardId = String(req.body?.rewardId ?? '').trim();
      const result = await claimSeason1Reward(acc.id, rewardId);
      const party = ensurePartyForAccount(result.account);
      broadcastParty(party);
      void syncAccountToSupabase(result.account);
      return res.json({
        account: { ...result.account, presence: getPresence(result.account.id) },
        grantedGold: result.grantedGold,
        grantedGems: result.grantedGems,
        grantedAvatars: result.grantedAvatars,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao resgatar recompensa S1.';
      const status = msg.includes('precisa atingir')
        ? 403
        : msg.includes('não encontrada')
          ? 404
          : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // --- CLOUD SQL + SUPABASE REST APIs (LEADERBOARD & MATCH HISTORY) ---
  app.get(['/api/leaderboard', '/rest/v1/leaderboard'], async (req, res) => {
    try {
      const rawLimit = Number(req.query.limit ?? 50);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 50;
      const source = req.query.source === 'supabase' ? 'supabase' : 'cloudsql';
      if (source === 'supabase' && isSupabaseConfigured()) {
        const sbRows = await fetchSupabaseLeaderboard(limit);
        if (sbRows) {
          return res.json({ source: 'supabase', leaderboard: sbRows });
        }
      }
      const rows = await getLeaderboard(limit);
      return res.json({ source: isDatabaseConfigured ? 'cloudsql' : 'memory', leaderboard: rows });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar ranking.';
      return res.status(500).json({ error: msg });
    }
  });

  app.get(['/api/matches/me', '/rest/v1/match_history'], requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const rawLimit = Number(req.query.limit ?? 20);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, rawLimit)) : 20;
      const matches = await getAccountMatchHistory(req.account!.id, limit);
      return res.json({ matches });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar histórico.';
      return res.status(500).json({ error: msg });
    }
  });

  app.post(['/api/matches/record', '/rest/v1/match_history'], requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const acc = req.account!;
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const entry = await recordMatchHistory(acc.id, {
        roomId: typeof body.roomId === 'string' ? body.roomId : 'offline',
        mode: typeof body.mode === 'string' ? body.mode : 'solo',
        mapId: 'bermuda',
        isRanked: Boolean(body.isRanked),
        placement: Number(body.placement ?? 51),
        kills: Number(body.kills ?? 0),
        damage: Number(body.damage ?? 0),
        survivalSec: Number(body.survivalSec ?? 0),
        booyah: Boolean(body.booyah),
        rankDelta: Number(body.rankDelta ?? 0),
      });
      void syncMatchHistoryToSupabase({
        publicId: acc.publicId,
        ...entry,
      });
      broadcastAllWs({ type: 'leaderboard_update' });
      return res.status(201).json({ match: entry });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar partida.';
      return res.status(500).json({ error: msg });
    }
  });

  // --- PLAYER SEARCH & FULL PROFILE ---
  app.get('/api/players/search', requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const q = String(req.query.q ?? '').trim();
      if (!q) return res.status(400).json({ error: 'Informe um ID ou Nick.' });
      const player = await findAccountByPublicIdOrNick(q, getPresence);
      if (!player) return res.status(404).json({ error: 'Jogador não encontrado.' });
      return res.json({ player });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar jogador.';
      return res.status(500).json({ error: msg });
    }
  });

  app.get('/api/players/:id/profile', requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const targetId = Number(req.params.id);
      if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'ID inválido.' });
      const player = await getAccountProfileById(targetId, getPresence);
      if (!player) return res.status(404).json({ error: 'Perfil não encontrado.' });
      return res.json({ player });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar perfil.';
      return res.status(500).json({ error: msg });
    }
  });

  // --- FRIENDSHIPS ---
  app.get('/api/friends', requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const data = await listFriendsAndRequests(req.account!.id, getPresence);
      return res.json({
        friends: data.friends,
        incoming: data.requests.filter((r) => r.direction === 'incoming'),
        outgoing: data.requests.filter((r) => r.direction === 'outgoing'),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao listar amigos.';
      return res.status(500).json({ error: msg });
    }
  });

  app.post('/api/friends/request', requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const target = String(req.body?.target ?? '').trim();
      const result = await sendFriendRequest(req.account!.id, target);
      sendWs(result.target.id, { type: 'friends_refresh' });
      return res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar pedido.';
      return res.status(400).json({ error: msg });
    }
  });

  app.post('/api/friends/respond', requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const friendshipId = Number(req.body?.friendshipId);
      const accept = Boolean(req.body?.accept);
      await respondFriendRequest(req.account!.id, friendshipId, accept);
      const data = await listFriendsAndRequests(req.account!.id, getPresence);
      return res.json({
        friends: data.friends,
        incoming: data.requests.filter((r) => r.direction === 'incoming'),
        outgoing: data.requests.filter((r) => r.direction === 'outgoing'),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao responder pedido.';
      return res.status(400).json({ error: msg });
    }
  });

  app.delete('/api/friends/:friendId', requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const friendId = Number(req.params.friendId);
      await removeFriend(req.account!.id, friendId);
      sendWs(friendId, { type: 'friends_refresh' });
      return res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover amigo.';
      return res.status(400).json({ error: msg });
    }
  });

  // --- PARTY / SQUAD ---
  app.get('/api/party', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const party = ensurePartyForAccount(acc);
    const invites = partyInvites.get(String(acc.id)) ?? [];
    const activeRoom = party.roomId ? rooms.get(party.roomId) : undefined;
    return res.json({
      party,
      invites,
      roomJoinInfo:
        activeRoom && activeRoom.humanMeta.has(acc.id)
          ? buildJoinInfo(activeRoom, acc.id)
          : null,
    });
  });

  app.post('/api/party/config', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const party = ensurePartyForAccount(acc);
    if (party.leaderId !== acc.id) {
      return res.status(403).json({ error: 'Apenas o líder do grupo pode alterar o modo.' });
    }
    if (party.status === 'matchmaking') {
      return res.status(400).json({ error: 'Cancele a busca de partida antes de alterar o modo.' });
    }
    const { gameVariant, gladiadoresFormat, mode, mapId, isRanked, autoFillBots } = req.body ?? {};
    if (gameVariant === 'br' || gameVariant === 'gladiadores') {
      if (gameVariant === 'gladiadores' && party.members.length > 2) {
        return res.status(400).json({ error: 'Gladiadores aceita no máximo 2 jogadores na equipe (2v2).' });
      }
      party.gameVariant = gameVariant;
      if (gameVariant === 'gladiadores' && party.members.length === 2) {
        party.gladiadoresFormat = '2v2';
      }
    }
    if (gladiadoresFormat === '1v1' || gladiadoresFormat === '2v2') {
      if (
        (party.gameVariant ?? 'br') === 'gladiadores' &&
        gladiadoresFormat === '1v1' &&
        party.members.length > 1
      ) {
        return res.status(400).json({ error: 'Saia do grupo para jogar Gladiadores 1v1.' });
      }
      party.gladiadoresFormat = gladiadoresFormat;
    }
    if (mode === 'solo' || mode === 'duo' || mode === 'squad') {
      if (mode === 'solo' && party.members.length > 1) {
        return res.status(400).json({ error: 'Saia do grupo com amigos para jogar Solo.' });
      }
      if (mode === 'duo' && party.members.length > 2) {
        return res.status(400).json({ error: 'Você tem mais de 2 jogadores no grupo.' });
      }
      party.mode = mode;
    }
    if (mapId === 'bermuda') {
      party.mapId = 'bermuda';
    }
    if (typeof isRanked === 'boolean') party.isRanked = isRanked;
    if (typeof autoFillBots === 'boolean') party.autoFillBots = autoFillBots;
    broadcastParty(party);
    return res.json({ party });
  });

  app.post('/api/party/invite', requireSession, async (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const party = ensurePartyForAccount(acc);
    const targetAccountId = Number(req.body?.targetAccountId);
    if (!Number.isFinite(targetAccountId) || targetAccountId === acc.id) {
      return res.status(400).json({ error: 'Jogador inválido.' });
    }
    if (party.leaderId !== acc.id) {
      return res.status(403).json({ error: 'Somente o líder pode convidar jogadores.' });
    }
    if ((party.gameVariant ?? 'br') === 'gladiadores') {
      if ((party.gladiadoresFormat ?? '1v1') === '1v1') {
        party.gladiadoresFormat = '2v2';
      }
    } else if (party.mode === 'solo') {
      party.mode = 'duo';
    }
    const maxM = maxMembersForParty(party);
    if (party.members.length >= maxM) {
      return res.status(400).json({
        error:
          (party.gameVariant ?? 'br') === 'gladiadores'
            ? 'Grupo cheio (máx. 2 jogadores no Gladiadores 2v2).'
            : `Grupo cheio (máx. ${maxM} jogadores no modo ${party.mode.toUpperCase()}).`,
      });
    }
    if (party.members.some((m) => m.accountId === targetAccountId)) {
      return res.status(400).json({ error: 'Jogador já está no seu grupo.' });
    }

    const invite: PartyInvitePayload = {
      inviteId: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      partyId: party.partyId,
      fromAccountId: acc.id,
      fromPublicId: acc.publicId,
      fromNickname: acc.nickname,
      fromRankPoints: acc.rankPoints,
      gameVariant: party.gameVariant ?? 'br',
      gladiadoresFormat: party.gladiadoresFormat ?? '1v1',
      mode: party.mode,
      mapId: party.mapId ?? 'bermuda',
      isRanked: party.isRanked,
      createdAt: Date.now(),
    };
    const key = String(targetAccountId);
    const list = partyInvites.get(key) ?? [];
    const dedup = list.filter((x) => x.partyId !== party.partyId);
    dedup.unshift(invite);
    partyInvites.set(key, dedup.slice(0, 8));
    broadcastParty(party);
    sendWs(targetAccountId, { type: 'party_invite', invite });
    return res.json({ ok: true, party });
  });

  app.post('/api/party/invite/respond', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const inviteId = String(req.body?.inviteId ?? '');
    const accept = Boolean(req.body?.accept);
    const key = String(acc.id);
    const list = partyInvites.get(key) ?? [];
    const inv = list.find((i) => i.inviteId === inviteId);
    partyInvites.set(
      key,
      list.filter((i) => i.inviteId !== inviteId),
    );
    if (!inv) return res.status(404).json({ error: 'Convite expirado.' });
    if (!accept) {
      return res.json({ ok: true, party: ensurePartyForAccount(acc) });
    }

    const targetParty = parties.get(inv.partyId);
    if (!targetParty || targetParty.status === 'in_match') {
      return res.status(400).json({ error: 'Este grupo já iniciou ou não existe mais.' });
    }
    const maxM = maxMembersForMode(targetParty.mode);
    if (targetParty.members.length >= maxM) {
      return res.status(400).json({ error: 'O grupo já está completo.' });
    }

    leaveCurrentParty(acc);
    targetParty.members.push(makePartyMember(acc, false));
    accountPartyMap.set(acc.id, targetParty.partyId);
    broadcastParty(targetParty);
    return res.json({ ok: true, party: targetParty });
  });

  app.post('/api/party/leave', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    removeHumanFromRoom(acc.id);
    const newParty = leaveCurrentParty(acc);
    return res.json({ party: newParty });
  });

  app.post('/api/party/kick', requireSession, async (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const party = ensurePartyForAccount(acc);
    const targetId = Number(req.body?.targetAccountId);
    if (party.leaderId !== acc.id || targetId === acc.id) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }
    const targetAcc = await getAccountProfileById(targetId, getPresence);
    party.members = party.members.filter((m) => m.accountId !== targetId);
    accountPartyMap.delete(targetId);
    if (targetAcc) {
      const solo = ensurePartyForAccount(targetAcc);
      sendWs(targetId, { type: 'party_update', party: solo });
    }
    broadcastParty(party);
    return res.json({ party });
  });

  // --- MATCHMAKING QUEUE (INITIAL LOBBY) & REAL-TIME MATCH ROOM ---
  app.get('/api/matchmaking/searching', (_req, res) => {
    return res.json({ pools: buildSearchingPoolsList() });
  });

  app.get('/api/matchmaking/status', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const pending = pendingMatchFound.get(acc.id);
    if (pending && rooms.has(pending.joinInfo.roomId)) {
      pendingMatchFound.delete(acc.id);
      return res.json({
        search: { searching: false },
        joinInfo: pending.joinInfo,
      });
    }
    const activeRoomId = accountMatchMap.get(acc.id);
    const activeRoom = activeRoomId ? rooms.get(activeRoomId) : undefined;
    if (activeRoom && activeRoom.humanMeta.has(acc.id)) {
      return res.json({
        search: { searching: false },
        joinInfo: buildJoinInfo(activeRoom, acc.id),
      });
    }
    const party = ensurePartyForAccount(acc);
    const poolKey = partyPoolKeyMap.get(party.partyId);
    const pool = poolKey ? matchmakingPools.get(poolKey) : undefined;
    const entry = pool?.entries.find((e) => e.partyId === party.partyId);
    if (entry) entry.lastPollAtMs = Date.now();
    return res.json({
      search: getSearchStatusForParty(party),
    });
  });

  app.post('/api/matchmaking/start', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const party = ensurePartyForAccount(acc);
    if (party.leaderId !== acc.id) {
      return res.status(403).json({ error: 'Apenas o líder pode iniciar a partida.' });
    }
    const partySize = party.members.length;
    if (partySize > 4) {
      return res.status(400).json({ error: 'Máximo de 4 jogadores por esquadrão.' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (party.status !== 'matchmaking') {
      const { gameVariant, gladiadoresFormat, mode, mapId, isRanked, autoFillBots } = body;
      if (gameVariant === 'br' || gameVariant === 'gladiadores') {
        if (gameVariant === 'gladiadores' && partySize > 2) {
          return res.status(400).json({ error: 'Gladiadores aceita no máximo 2 jogadores na equipe (2v2).' });
        }
        party.gameVariant = gameVariant;
        if (gameVariant === 'gladiadores' && partySize === 2) {
          party.gladiadoresFormat = '2v2';
        }
      }
      if (gladiadoresFormat === '1v1' || gladiadoresFormat === '2v2') {
        if ((party.gameVariant ?? 'br') === 'gladiadores' && gladiadoresFormat === '1v1' && partySize > 1) {
          return res.status(400).json({ error: 'Saia do grupo para jogar Gladiadores 1v1.' });
        }
        party.gladiadoresFormat = gladiadoresFormat;
      }
      if (mode === 'solo' || mode === 'duo' || mode === 'squad') {
        if (mode === 'solo' && partySize > 1) {
          return res.status(400).json({ error: 'Saia do grupo com amigos para jogar Solo.' });
        }
        if (mode === 'duo' && partySize > 2) {
          return res.status(400).json({ error: 'Você tem mais de 2 jogadores no grupo.' });
        }
        party.mode = mode;
      }
      if (mapId === 'bermuda') {
        party.mapId = 'bermuda';
      }
      if (typeof isRanked === 'boolean') party.isRanked = isRanked;
      if (typeof autoFillBots === 'boolean') party.autoFillBots = autoFillBots;
    }

    const gv: GameVariant = party.gameVariant ?? 'br';
    const gf: GladiadoresFormat = party.gladiadoresFormat ?? '1v1';
    if (gv === 'gladiadores' && partySize > (gf === '2v2' ? 2 : 1)) {
      return res.status(400).json({ error: 'Equipe excede o limite de jogadores deste formato de Gladiadores.' });
    }
    const partyMapId: BrMapId = 'bermuda';

    // Idempotent check if already searching in the same pool
    if (party.status === 'matchmaking') {
      const existingPoolKey = partyPoolKeyMap.get(party.partyId);
      const targetPoolKey = makePoolKey(gv, gf, party.mode, partyMapId, party.isRanked);
      if (existingPoolKey && existingPoolKey === targetPoolKey && matchmakingPools.has(existingPoolKey)) {
        return res.json({ search: getSearchStatusForParty(party), party });
      }
    }

    for (const m of party.members) {
      removeHumanFromRoom(m.accountId);
    }
    const search = joinPoolForParty(party, gv, gf, party.mode, partyMapId, party.isRanked);
    return res.json({ search, party });
  });

  app.post('/api/matchmaking/join-queue', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const party = ensurePartyForAccount(acc);
    if (party.leaderId !== acc.id) {
      return res.status(403).json({ error: 'Apenas o líder pode entrar em outra fila.' });
    }
    const targetPoolKey = typeof req.body?.poolKey === 'string' ? req.body.poolKey.trim() : '';
    const targetPool = matchmakingPools.get(targetPoolKey);
    if (!targetPool || targetPool.entries.length === 0) {
      return res.status(404).json({ error: 'Essa busca já foi iniciada ou encerrada.' });
    }
    const poolMax =
      targetPool.gameVariant === 'gladiadores'
        ? targetPool.gladiadoresFormat === '2v2'
          ? 2
          : 1
        : maxMembersForMode(targetPool.mode);
    if (party.members.length > poolMax) {
      return res.status(400).json({
        error: `Seu grupo tem ${party.members.length} jogadores; esta fila comporta até ${poolMax} por equipe.`,
      });
    }
    for (const m of party.members) {
      removeHumanFromRoom(m.accountId);
    }
    party.gameVariant = targetPool.gameVariant;
    party.gladiadoresFormat = targetPool.gladiadoresFormat;
    party.mode = targetPool.mode;
    party.mapId = targetPool.mapId;
    party.isRanked = targetPool.isRanked;
    const search = joinPoolForParty(
      party,
      targetPool.gameVariant,
      targetPool.gladiadoresFormat,
      targetPool.mode,
      targetPool.mapId,
      targetPool.isRanked,
    );
    return res.json({ search, party });
  });

  app.post('/api/matchmaking/cancel', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const party = ensurePartyForAccount(acc);
    if (party.leaderId !== acc.id) {
      return res.status(403).json({ error: 'Apenas o líder pode cancelar a busca.' });
    }
    removePartyFromMatchmaking(party.partyId, true);
    return res.json({ ok: true, party });
  });

  app.post('/api/match/leave', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    removeHumanFromRoom(acc.id);
    const party = ensurePartyForAccount(acc);
    if (party.status === 'matchmaking') {
      removePartyFromMatchmaking(party.partyId, false);
    }
    party.status = 'idle';
    party.roomId = null;
    broadcastParty(party);
    return res.json({ ok: true });
  });

  // 50ms HTTP fallback & explicit state/action sync endpoint
  app.post('/api/match/:roomId/sync', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    const room = rooms.get(String(req.params.roomId));
    if (!room || !room.humanMeta.has(acc.id)) {
      return res.status(404).json({ error: 'Sala da partida encerrada.' });
    }
    const { state, actions } = req.body ?? {};
    if (state) {
      applyClientStatePush(room, acc.id, state as ClientMatchStatePush);
    }
    if (Array.isArray(actions)) {
      for (const act of actions as MatchRoomAction[]) {
        handleRoomAction(room, acc.id, act);
      }
    }
    return res.json({ snapshot: buildRoomSnapshot(room, acc.id) });
  });

  // --- VITE / STATIC ASSET SERVING ---
  if (fs.existsSync(localSkinRoot)) {
    app.use('/skin', express.static(localSkinRoot, { maxAge: '1h' }));
  }
  if (options.attachFrontend !== false) {
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      const vitePkg = 'vite';
      const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(__dirname, 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return app;
}

export async function getServerlessApp(): Promise<express.Express> {
  if (!cachedServerlessApp) {
    cachedServerlessApp = await createExpressApp({ attachFrontend: false });
  }
  return cachedServerlessApp;
}

export async function startServer(): Promise<void> {
  const app = await createExpressApp({ attachFrontend: true });
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  server.on('upgrade', (req, socket, head) => {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (reqUrl.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  const wsAliveMap = new WeakMap<WebSocket, boolean>();
  const wsHeartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (wsAliveMap.get(ws) === false) {
        ws.terminate();
        continue;
      }
      wsAliveMap.set(ws, false);
      if (ws.readyState === 1) {
        ws.ping();
      }
    }
  }, 25_000);
  wsHeartbeatTimer.unref?.();

  wss.on('connection', async (ws, req) => {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const token = reqUrl.searchParams.get('token') || '';
    const account = await getAccountByToken(token).catch(() => null);
    if (!account) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const accountId = account.id;
    wsAliveMap.set(ws, true);
    ws.on('pong', () => {
      wsAliveMap.set(ws, true);
      lastHeartbeatMs.set(accountId, Date.now());
    });

    let set = onlineSockets.get(accountId);
    if (!set) {
      set = new Set();
      onlineSockets.set(accountId, set);
    }
    set.add(ws);
    lastHeartbeatMs.set(accountId, Date.now());
    const party = ensurePartyForAccount(account);
    ws.send(
      JSON.stringify({
        type: 'ws_ready',
        serverTimeMs: Date.now(),
        capabilities: {
          cloudSql: isDatabaseConfigured,
          supabase: isSupabaseConfigured(),
          websocket: true,
        },
      }),
    );
    ws.send(JSON.stringify({ type: 'party_update', party }));
    ws.send(
      JSON.stringify({
        type: 'matchmaking_queue_update',
        pools: buildSearchingPoolsList(),
      }),
    );
    if (party.status === 'matchmaking') {
      ws.send(
        JSON.stringify({
          type: 'matchmaking_status',
          status: getSearchStatusForParty(party),
        }),
      );
    }

    const pendingJoin = pendingMatchFound.get(accountId);
    if (pendingJoin && rooms.has(pendingJoin.joinInfo.roomId)) {
      pendingMatchFound.delete(accountId);
      ws.send(
        JSON.stringify({
          type: 'match_found',
          joinInfo: pendingJoin.joinInfo,
        }),
      );
    }

    const activeRoomId = accountMatchMap.get(accountId);
    const activeRoom = activeRoomId ? rooms.get(activeRoomId) : undefined;
    if (activeRoom && activeRoom.humanMeta.has(accountId)) {
      activeRoom.lastRequestMs.set(accountId, Date.now());
      ws.send(
        JSON.stringify({
          type: 'room_snapshot',
          snapshot: buildRoomSnapshot(activeRoom, accountId, true),
        }),
      );
    }

    let orphanSyncStrikes = 0;
    ws.on('message', (raw) => {
      lastHeartbeatMs.set(accountId, Date.now());
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg.type === 'ping') {
        const pingRoomId = accountMatchMap.get(accountId);
        const pingRoom = pingRoomId ? rooms.get(pingRoomId) : undefined;
        if (pingRoom) {
          pingRoom.lastRequestMs.set(accountId, Date.now());
        }
        ws.send(JSON.stringify({ type: 'pong', clientTs: msg.clientTs ?? Date.now() }));
        return;
      }

      const roomId = accountMatchMap.get(accountId);
      const room = roomId ? rooms.get(roomId) : undefined;

      if (msg.type === 'lobby_chat') {
        const cleanText =
          typeof msg.text === 'string'
            ? msg.text.replace(/[<>"'`]/g, '').trim().slice(0, 160)
            : '';
        if (!cleanText) return;
        const chatPayload = {
          type: 'chat_message',
          scope: room ? 'match' : 'party',
          fromAccountId: accountId,
          nickname: account.nickname,
          text: cleanText,
          sentAtMs: Date.now(),
        };
        if (room) {
          broadcastRoom(room, chatPayload);
        } else {
          const senderPartyId = accountPartyMap.get(accountId);
          const senderParty = senderPartyId ? parties.get(senderPartyId) : undefined;
          if (senderParty) {
            for (const m of senderParty.members) {
              sendWs(m.accountId, chatPayload);
            }
          } else {
            sendWs(accountId, chatPayload);
          }
        }
        return;
      }

      if (msg.type === 'webrtc_signal') {
        const targetId = Number(msg.targetAccountId);
        if (!targetId || targetId === accountId) return;

        // Allow WebRTC voice call signaling between teammates in the same match team OR same lobby party
        const senderInRoom = room ? room.humans.get(accountId) : undefined;
        const targetInRoom = room ? room.humans.get(targetId) : undefined;
        const sameMatchTeam = Boolean(
          senderInRoom && targetInRoom && senderInRoom.teamId === targetInRoom.teamId,
        );

        const senderPartyId = accountPartyMap.get(accountId);
        const targetPartyId = accountPartyMap.get(targetId);
        const sameParty = Boolean(
          senderPartyId &&
            senderPartyId === targetPartyId &&
            parties.get(senderPartyId)?.members.some((m) => m.accountId === targetId),
        );

        if (sameMatchTeam || sameParty) {
          sendWs(targetId, {
            type: 'webrtc_signal',
            fromAccountId: accountId,
            signal: msg.signal,
          });
        }
        return;
      }

      if (!room) {
        if (msg.type === 'sync_state' || msg.type === 'room_action') {
          const pending = pendingMatchFound.get(accountId);
          if (pending && rooms.has(pending.joinInfo.roomId)) {
            pendingMatchFound.delete(accountId);
            ws.send(JSON.stringify({ type: 'match_found', joinInfo: pending.joinInfo }));
            return;
          }
          orphanSyncStrikes += 1;
          if (orphanSyncStrikes >= 3) {
            ws.send(
              JSON.stringify({
                type: 'match_kicked',
                roomId: '',
                reason: 'Você foi removido da partida por inatividade.',
              }),
            );
          }
        }
        return;
      }
      orphanSyncStrikes = 0;

      if (msg.type === 'sync_state' && msg.state) {
        applyClientStatePush(room, accountId, msg.state as ClientMatchStatePush);
        ws.send(
          JSON.stringify({
            type: 'room_snapshot',
            snapshot: buildRoomSnapshot(room, accountId),
          }),
        );
        return;
      }

      if (msg.type === 'room_action' && msg.action) {
        handleRoomAction(room, accountId, msg.action as MatchRoomAction);
      }
    });

    ws.on('close', () => {
      const s = onlineSockets.get(accountId);
      if (s) {
        s.delete(ws);
        if (s.size === 0) onlineSockets.delete(accountId);
      }
    });
  });

  // 4-minute offline / no-request auto-kick from active match rooms (only removes the inactive player)
  const OFFLINE_MATCH_KICK_MS = 4 * 60 * 1000;
  const kickTimer = setInterval(() => {
    const now = Date.now();
    for (const room of Array.from(rooms.values())) {
      for (const accId of Array.from(room.humans.keys())) {
        const lastAt = room.lastRequestMs.get(accId) ?? room.createdAtMs;
        if (now - lastAt >= OFFLINE_MATCH_KICK_MS) {
          const kickedNick = room.humans.get(accId)?.nickname ?? 'Jogador';
          removeHumanFromRoom(accId);
          const pid = accountPartyMap.get(accId);
          if (pid) {
            const p = parties.get(pid);
            if (p && p.roomId === room.roomId) {
              const anyStillInRoom = p.members.some((m) => room.humans.has(m.accountId));
              if (!anyStillInRoom) {
                p.status = 'idle';
                p.roomId = null;
                broadcastParty(p);
              }
            }
          }
          sendWs(accId, {
            type: 'match_kicked',
            roomId: room.roomId,
            reason: 'Removido da partida após 4 minutos offline sem resposta.',
          });
          if (rooms.has(room.roomId)) {
            broadcastRoom(room, {
              type: 'kill_feed_event',
              entry: {
                id: room.nextKillFeedId++,
                killerName: 'SERVIDOR',
                victimName: `${kickedNick} (OFFLINE 4m)`,
                weaponShort: 'KICK',
                isHeadshot: false,
              },
            });
          }
        }
      }
    }
  }, 10_000);
  kickTimer.unref?.();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

const isServerlessRuntime = Boolean(
  process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.FUNCTION_TARGET,
);

if (!isServerlessRuntime) {
  void startServer();
}
