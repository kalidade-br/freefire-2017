import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { ensureDatabaseSchema } from './src/db/index.ts';
import {
  findAccountByPublicIdOrNick,
  getAccountByToken,
  getAccountProfileById,
  listFriendsAndRequests,
  loginAccount,
  loginOrRegisterFirebaseAccount,
  logoutSession,
  registerAccount,
  respondFriendRequest,
  removeFriend,
  sendFriendRequest,
  updateAccountStatsAndProfile,
} from './src/db/accounts.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import type {
  AirplaneRouteSync,
  ClientMatchStatePush,
  MatchRoomAction,
  MatchRoomJoinInfo,
  MatchRoomSnapshot,
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
} from './src/shared/multiplayerTypes.ts';
import type { MatchMode } from './src/game/types.ts';

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

interface ServerMatchRoom {
  roomId: string;
  seed: number;
  mode: MatchMode;
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
  lastRequestMs: Map<number, number>;
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
      member.character = acc.character;
      return party;
    }
  }
  const partyId = `pty_${acc.id}_${Date.now().toString(36)}`;
  const party: PartyState = {
    partyId,
    leaderId: acc.id,
    mode: 'solo',
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

function leaveCurrentParty(acc: PublicPlayerAccount): PartyState {
  const oldId = accountPartyMap.get(acc.id);
  if (oldId && parties.has(oldId)) {
    const oldParty = parties.get(oldId)!;
    oldParty.members = oldParty.members.filter((m) => m.accountId !== acc.id);
    if (oldParty.members.length === 0) {
      parties.delete(oldId);
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

function computeServerSafeZone(room: ServerMatchRoom, nowMs: number): SafeZoneSyncState {
  const elapsedAfterPlane = Math.max(0, (nowMs - room.planeStartedAtMs) / 1000);
  // Deterministic safe center derived from room seed
  const s1 = Math.sin(room.seed * 0.0017) * 0.5 + 0.5;
  const s2 = Math.cos(room.seed * 0.0029) * 0.5 + 0.5;
  const targetCenterX = (s1 - 0.5) * 420;
  const targetCenterZ = (s2 - 0.5) * 420;

  const radii = [890, 560, 340, 185, 85, 22];
  const dmgRates = [2, 5, 11, 18, 28];
  const holdDur = 14;
  const shrinkDur = 24;
  const cycleDur = holdDur + shrinkDur;

  const rawPhaseIdx = Math.min(4, Math.floor(elapsedAfterPlane / cycleDur));
  const phaseElapsed = elapsedAfterPlane - rawPhaseIdx * cycleDur;
  const isShrinking = phaseElapsed >= holdDur;
  const timerSec = isShrinking
    ? Math.max(0, cycleDur - phaseElapsed)
    : Math.max(0, holdDur - phaseElapsed);

  const prevR = radii[rawPhaseIdx];
  const nextR = radii[rawPhaseIdx + 1];
  const prevFrac = rawPhaseIdx / 5;
  const nextFrac = (rawPhaseIdx + 1) / 5;
  const prevX = targetCenterX * prevFrac;
  const prevZ = targetCenterZ * prevFrac;
  const nextX = targetCenterX * nextFrac;
  const nextZ = targetCenterZ * nextFrac;

  const t = isShrinking ? Math.min(1, (phaseElapsed - holdDur) / shrinkDur) : 0;
  const currentRadius = prevR + (nextR - prevR) * t;
  const currentX = prevX + (nextX - prevX) * t;
  const currentZ = prevZ + (nextZ - prevZ) * t;

  return {
    phase: rawPhaseIdx + 1,
    totalPhases: 5,
    isShrinking,
    timerSec,
    currentX,
    currentZ,
    currentRadius,
    nextX,
    nextZ,
    nextRadius: nextR,
    damagePerSec: dmgRates[rawPhaseIdx] ?? 28,
  };
}

function createAirplaneRoute(seed: number, startedAtMs: number): AirplaneRouteSync {
  const angle = ((seed % 3600) / 3600) * Math.PI * 2;
  const radius = 840;
  const offset = (((seed * 7) % 1000) / 1000 - 0.5) * 240;
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
    mode: room.mode,
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

function buildRoomSnapshot(room: ServerMatchRoom): MatchRoomSnapshot {
  const nowMs = Date.now();
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
    vehicles: Array.from(room.vehicles.values()),
    bots: room.bots,
    collectedLootIds: Array.from(room.collectedLootIds),
    glooWalls: Array.from(room.glooWalls.values()),
    killFeed: room.killFeed.slice(-8),
    aliveCount: room.aliveCount,
    winnerTeamId: room.winnerTeamId,
  };
}

function removeHumanFromRoom(accountId: number): void {
  const roomId = accountMatchMap.get(accountId);
  accountMatchMap.delete(accountId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  const p = room.humans.get(accountId);
  if (p) {
    p.eliminated = true;
    p.hp = 0;
  }
  room.humans.delete(accountId);
  room.humanMeta.delete(accountId);
  room.lastRequestMs.delete(accountId);

  if (room.humans.size === 0) {
    rooms.delete(roomId);
    return;
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
  // Preserve server-authoritative health/elimination unless client hasn't synced yet or healed legitimately
  existing.x = push.x;
  existing.y = push.y;
  existing.z = push.z;
  existing.yaw = push.yaw;
  existing.pitch = push.pitch;
  existing.stance = push.stance;
  existing.isSprinting = push.isSprinting;
  existing.isAiming = push.isAiming;
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
  existing.activeVehicleId = push.activeVehicleId;
  existing.updatedAtMs = nowMs;

  if (push.vehicleState) {
    room.vehicles.set(push.vehicleState.id, {
      ...push.vehicleState,
      driverAccountId: push.activeVehicleId === push.vehicleState.id ? accountId : null,
      updatedAtMs: nowMs,
    });
  }

  if (accountId === room.hostAccountId && Array.isArray(push.bots)) {
    room.bots = push.bots;
  }
  if (accountId === room.hostAccountId && typeof push.aliveCountHint === 'number') {
    room.aliveCount = Math.max(1, push.aliveCountHint);
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
      hp: 360,
      ownerAccountId: actorAccountId,
    };
    room.glooWalls.set(wall.id, wall);
    broadcastRoom(room, { type: 'gloo_spawned', wall }, actorAccountId);
    return;
  }

  if (action.type === 'damage_gloo') {
    const wall = room.glooWalls.get(action.id);
    if (!wall) return;
    wall.hp -= action.damage;
    if (wall.hp <= 0) {
      room.glooWalls.delete(action.id);
    }
    return;
  }

  if (action.type === 'kill_feed') {
    const entry: RemoteKillFeedEvent = {
      id: room.nextKillFeedId++,
      killerName: action.killerName,
      victimName: action.victimName,
      weaponShort: action.weaponShort,
      isHeadshot: action.isHeadshot,
      killerAccountId: actorAccountId,
    };
    room.killFeed.push(entry);
    if (room.killFeed.length > 16) room.killFeed.shift();
    broadcastRoom(room, { type: 'kill_feed_event', entry });
    return;
  }

  if (action.type === 'damage_bot') {
    sendWs(room.hostAccountId, {
      type: 'remote_bot_damage',
      fromAccountId: actorAccountId,
      fromNickname: actor.nickname,
      botId: action.botId,
      damage: action.damage,
      isHeadshot: action.isHeadshot,
      weaponShort: action.weaponShort,
      attackerX: action.attackerX,
      attackerZ: action.attackerZ,
    });
  }
}

// Periodic cleanup of stale empty rooms & expired party invites
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
  await ensureDatabaseSchema();

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
          const decoded = await adminAuth.verifyIdToken(fbToken);
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

  // --- LIGHTWEIGHT LATENCY PING ---
  app.get('/api/ping', (_req, res) => {
    return res.json({ ok: true, serverTimeMs: Date.now() });
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
      const decoded = await adminAuth.verifyIdToken(tokenStr);
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
      return res.json({ account: { ...updated, presence: getPresence(updated.id) } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar perfil.';
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
    const { mode, isRanked, autoFillBots } = req.body ?? {};
    if (mode === 'solo' || mode === 'duo' || mode === 'squad') {
      if (mode === 'solo' && party.members.length > 1) {
        return res.status(400).json({ error: 'Saia do grupo com amigos para jogar Solo.' });
      }
      if (mode === 'duo' && party.members.length > 2) {
        return res.status(400).json({ error: 'Você tem mais de 2 jogadores no grupo.' });
      }
      party.mode = mode;
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
    if (party.mode === 'solo') {
      party.mode = 'duo';
    }
    const maxM = maxMembersForMode(party.mode);
    if (party.members.length >= maxM) {
      return res.status(400).json({ error: `Grupo cheio (máx. ${maxM} jogadores no modo ${party.mode.toUpperCase()}).` });
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
      mode: party.mode,
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

  // --- MATCHMAKING & REAL-TIME MATCH ROOM ---
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

    // Find an existing open room matching mode + ranked where total online humans <= 4
    const now = Date.now();
    let matchedRoom: ServerMatchRoom | undefined;
    for (const r of rooms.values()) {
      if (
        r.joinOpen &&
        r.mode === party.mode &&
        r.isRanked === party.isRanked &&
        now < r.waitingEndsAtMs - 1500 &&
        r.humans.size + partySize <= 4
      ) {
        matchedRoom = r;
        break;
      }
    }

    if (!matchedRoom) {
      const seed = Math.floor(100000 + Math.random() * 899999);
      const roomId = `rm_${Date.now().toString(36)}_${seed.toString(36)}`;
      const waitingEndsAtMs = now + 7500;
      const planeStartedAtMs = waitingEndsAtMs;
      matchedRoom = {
        roomId,
        seed,
        mode: party.mode,
        isRanked: party.isRanked,
        autoFillBots: party.autoFillBots,
        hostAccountId: party.members[0].accountId,
        createdAtMs: now,
        waitingEndsAtMs,
        planeStartedAtMs,
        joinOpen: true,
        nextTeamId: 1,
        airplane: createAirplaneRoute(seed, planeStartedAtMs),
        humans: new Map(),
        humanMeta: new Map(),
        vehicles: new Map(),
        bots: [],
        collectedLootIds: new Set(),
        glooWalls: new Map(),
        killFeed: [],
        nextKillFeedId: 1,
        aliveCount: 51,
        winnerTeamId: null,
        lastRequestMs: new Map(),
      };
      rooms.set(roomId, matchedRoom);
    }

    const assignedTeamId = matchedRoom.nextTeamId;
    matchedRoom.nextTeamId = Math.min(12, matchedRoom.nextTeamId + 1);

    party.members.forEach((m, idx) => {
      const slotInTeam = idx + 1;
      const isTeamLeader = m.accountId === party.leaderId;
      const meta: RoomHumanSlot = {
        accountId: m.accountId,
        publicId: m.publicId,
        nickname: m.nickname,
        level: m.level,
        rankPoints: m.rankPoints,
        teamId: assignedTeamId,
        slotInTeam,
        isTeamLeader,
        character: m.character,
      };
      matchedRoom!.humanMeta.set(m.accountId, meta);
      matchedRoom!.lastRequestMs.set(m.accountId, now);
      matchedRoom!.humans.set(m.accountId, {
        accountId: m.accountId,
        publicId: m.publicId,
        nickname: m.nickname,
        level: m.level,
        rankPoints: m.rankPoints,
        teamId: assignedTeamId,
        slotInTeam,
        isTeamLeader,
        character: m.character,
        x: -60 + idx * 2.4,
        y: 2.2,
        z: 68,
        yaw: 0,
        pitch: -0.14,
        stance: 'stand',
        isSprinting: false,
        isAiming: false,
        inWater: false,
        isSwimming: false,
        isOnSurfboard: false,
        flightPhase: 'waiting',
        weaponId: 'g18',
        ammoInMag: 15,
        reserveAmmo: 45,
        hp: 200,
        maxHp: 200,
        vestLevel: 0,
        helmetLevel: 0,
        isDowned: false,
        bleedHp: 100,
        eliminated: false,
        kills: 0,
        activeVehicleId: null,
        updatedAtMs: now,
      });
      accountMatchMap.set(m.accountId, matchedRoom!.roomId);
    });

    party.status = 'in_match';
    party.roomId = matchedRoom.roomId;
    broadcastParty(party);

    for (const m of party.members) {
      sendWs(m.accountId, {
        type: 'match_found',
        joinInfo: buildJoinInfo(matchedRoom, m.accountId),
      });
    }

    return res.json({
      joinInfo: buildJoinInfo(matchedRoom, acc.id),
    });
  });

  app.post('/api/match/leave', requireSession, (req: AuthenticatedRequest, res) => {
    const acc = req.account!;
    removeHumanFromRoom(acc.id);
    const party = ensurePartyForAccount(acc);
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
    return res.json({ snapshot: buildRoomSnapshot(room) });
  });

  // --- VITE / STATIC ASSET SERVING ---
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
  const wss = new WebSocketServer({ noServer: true });

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

  wss.on('connection', async (ws, req) => {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const token = reqUrl.searchParams.get('token') || '';
    const account = await getAccountByToken(token).catch(() => null);
    if (!account) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const accountId = account.id;
    let set = onlineSockets.get(accountId);
    if (!set) {
      set = new Set();
      onlineSockets.set(accountId, set);
    }
    set.add(ws);
    lastHeartbeatMs.set(accountId, Date.now());
    const party = ensurePartyForAccount(account);
    ws.send(JSON.stringify({ type: 'party_update', party }));

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
          ws.send(
            JSON.stringify({
              type: 'match_kicked',
              roomId: '',
              reason: 'Você foi removido da partida por inatividade.',
            }),
          );
        }
        return;
      }

      if (msg.type === 'sync_state' && msg.state) {
        applyClientStatePush(room, accountId, msg.state as ClientMatchStatePush);
        ws.send(
          JSON.stringify({
            type: 'room_snapshot',
            snapshot: buildRoomSnapshot(room),
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
