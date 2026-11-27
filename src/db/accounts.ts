import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db, isDatabaseConfigured } from './index.ts';
import { accounts, friendships, matchHistory, sessions } from './schema.ts';
import type {
  FriendEntry,
  FriendRequestEntry,
  PresenceStatus,
  PublicPlayerAccount,
} from '../shared/multiplayerTypes.ts';
import {
  CURRENT_RANKED_SEASON,
  MESTRE_MIN_PTS,
  SEASON_1_REWARDS,
  sanitizeEquippedSkins,
  type CharacterConfig,
  type PlayerAvatarId,
} from '../game/types.ts';
import {
  FREE_PLAYER_AVATARS,
  S1_MESTRE_AVATARS,
  normalizePlayerAvatarId,
} from '../game/avatars.ts';

// ============================================================================
// IN-MEMORY STORE FALLBACK (when Cloud SQL / PostgreSQL is not configured)
// ============================================================================

type AccountRow = typeof accounts.$inferSelect;
type FriendshipRow = typeof friendships.$inferSelect;
type MatchHistoryRow = typeof matchHistory.$inferSelect;

const memAccounts = new Map<number, AccountRow>();
const memSessions = new Map<string, number>();
const memFriendships = new Map<number, FriendshipRow>();
const memMatchHistory: MatchHistoryRow[] = [];
let nextMemAccountId = 1;
let nextMemFriendshipId = 1;
let nextMemMatchId = 1;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  const derived = scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

function parseCharacter(raw: string): Partial<CharacterConfig> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseUnlockedAvatars(raw: string | null | undefined, peakRankPoints: number): PlayerAvatarId[] {
  const set = new Set<PlayerAvatarId>(FREE_PLAYER_AVATARS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string') {
            set.add(normalizePlayerAvatarId(item));
          }
        }
      }
    } catch {
      // ignore malformed json
    }
  }
  if (peakRankPoints >= MESTRE_MIN_PTS) {
    for (const av of S1_MESTRE_AVATARS) {
      set.add(av);
    }
  }
  return Array.from(set);
}

function parseClaimedRewards(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

export function toPublicAccount(
  row: AccountRow,
  presence?: PresenceStatus,
): PublicPlayerAccount {
  const s1Peak = Math.max(row.s1PeakRankPoints ?? 0, row.rankPoints);
  const unlockedAvatars = parseUnlockedAvatars(row.unlockedAvatarsJson, s1Peak);
  const requestedAvatar = normalizePlayerAvatarId(row.avatarId);
  const avatarId: PlayerAvatarId = unlockedAvatars.includes(requestedAvatar)
    ? requestedAvatar
    : 'default';
  const charParsed = parseCharacter(row.characterJson);
  return {
    id: row.id,
    publicId: row.publicId,
    username: row.username,
    nickname: row.nickname,
    level: row.level,
    gold: row.gold,
    gems: row.gems,
    matchesPlayed: row.matchesPlayed,
    wins: row.wins,
    rankPoints: row.rankPoints,
    rankedMatches: row.rankedMatches,
    rankedWins: row.rankedWins,
    totalKills: row.totalKills,
    avatarId,
    unlockedAvatars,
    seasonId: row.seasonId || CURRENT_RANKED_SEASON,
    s1PeakRankPoints: s1Peak,
    s1ClaimedRewards: parseClaimedRewards(row.s1ClaimedRewardsJson),
    character: {
      ...charParsed,
      avatarId,
    },
    presence,
  };
}

async function generateUniquePublicId(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = String(10000000 + Math.floor(Math.random() * 89999999));
    if (!isDatabaseConfigured) {
      const taken = Array.from(memAccounts.values()).some((a) => a.publicId === candidate);
      if (!taken) return candidate;
      continue;
    }
    const existing = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.publicId, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  return String(Date.now()).slice(-8);
}

function sanitizeInitialAvatar(raw?: string | null): PlayerAvatarId {
  const norm = normalizePlayerAvatarId(raw);
  return FREE_PLAYER_AVATARS.includes(norm) ? norm : 'default';
}

export async function registerAccount(params: {
  username: string;
  password: string;
  nickname?: string;
  character?: Partial<CharacterConfig>;
}): Promise<{ token: string; account: PublicPlayerAccount }> {
  const cleanUser = params.username.trim().toLowerCase();
  if (cleanUser.length < 3 || cleanUser.length > 24 || !/^[a-z0-9_.-]+$/.test(cleanUser)) {
    throw new Error('Usuário deve ter 3 a 24 caracteres (letras, números, _ . -).');
  }
  if (params.password.length < 4 || params.password.length > 64) {
    throw new Error('Senha deve ter no mínimo 4 caracteres.');
  }
  const cleanNick = (params.nickname?.trim() || params.username.trim()).slice(0, 18);
  const initialAvatar = sanitizeInitialAvatar(params.character?.avatarId);
  const safeChar = sanitizeGuestCharacter({ ...params.character, avatarId: initialAvatar });

  if (!isDatabaseConfigured) {
    const taken = Array.from(memAccounts.values()).some((a) => a.username === cleanUser);
    if (taken) {
      throw new Error('Este nome de usuário já está em uso.');
    }
    const now = new Date();
    const id = nextMemAccountId++;
    const row: AccountRow = {
      id,
      publicId: await generateUniquePublicId(),
      username: cleanUser,
      passwordHash: hashPassword(params.password),
      firebaseUid: null,
      nickname: cleanNick,
      level: 1,
      gold: 1200,
      gems: 40,
      matchesPlayed: 0,
      wins: 0,
      rankPoints: 0,
      rankedMatches: 0,
      rankedWins: 0,
      totalKills: 0,
      avatarId: initialAvatar,
      unlockedAvatarsJson: JSON.stringify(FREE_PLAYER_AVATARS),
      seasonId: CURRENT_RANKED_SEASON,
      s1PeakRankPoints: 0,
      s1ClaimedRewardsJson: '[]',
      characterJson: JSON.stringify(safeChar),
      lastSeenAt: now,
      createdAt: now,
    };
    memAccounts.set(id, row);
    const token = randomBytes(32).toString('hex');
    memSessions.set(token, id);
    return { token, account: toPublicAccount(row, 'lobby') };
  }

  try {
    const existing = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.username, cleanUser))
      .limit(1);
    if (existing.length > 0) {
      throw new Error('Este nome de usuário já está em uso.');
    }

    const publicId = await generateUniquePublicId();
    const passwordHash = hashPassword(params.password);
    const inserted = await db
      .insert(accounts)
      .values({
        publicId,
        username: cleanUser,
        passwordHash,
        nickname: cleanNick,
        rankPoints: 0,
        avatarId: initialAvatar,
        unlockedAvatarsJson: JSON.stringify(FREE_PLAYER_AVATARS),
        seasonId: CURRENT_RANKED_SEASON,
        s1PeakRankPoints: 0,
        s1ClaimedRewardsJson: '[]',
        characterJson: JSON.stringify(safeChar),
      })
      .returning();

    const row = inserted[0];
    const token = randomBytes(32).toString('hex');
    await db.insert(sessions).values({
      token,
      accountId: row.id,
    });

    return {
      token,
      account: toPublicAccount(row, 'lobby'),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('já está em uso')) {
      throw error;
    }
    console.error('registerAccount failed:', error);
    throw new Error('Não foi possível criar a conta no servidor.', { cause: error });
  }
}

export async function loginAccount(params: {
  username: string;
  password: string;
}): Promise<{ token: string; account: PublicPlayerAccount }> {
  const cleanUser = params.username.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    const row = Array.from(memAccounts.values()).find((a) => a.username === cleanUser);
    if (!row || !verifyPassword(params.password, row.passwordHash)) {
      throw new Error('Usuário ou senha incorretos.');
    }
    row.lastSeenAt = new Date();
    const token = randomBytes(32).toString('hex');
    memSessions.set(token, row.id);
    return { token, account: toPublicAccount(row, 'lobby') };
  }

  try {
    const rows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.username, cleanUser))
      .limit(1);
    const row = rows[0];
    if (!row || !verifyPassword(params.password, row.passwordHash)) {
      throw new Error('Usuário ou senha incorretos.');
    }

    await db
      .update(accounts)
      .set({ lastSeenAt: new Date() })
      .where(eq(accounts.id, row.id));

    const token = randomBytes(32).toString('hex');
    await db.insert(sessions).values({
      token,
      accountId: row.id,
    });

    return {
      token,
      account: toPublicAccount(row, 'lobby'),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Usuário ou senha incorretos.') {
      throw error;
    }
    console.error('loginAccount failed:', error);
    throw new Error('Erro ao autenticar conta no servidor.', { cause: error });
  }
}

export async function loginOrRegisterFirebaseAccount(params: {
  firebaseUid: string;
  nickname?: string;
  character?: Partial<CharacterConfig>;
}): Promise<{ token: string; account: PublicPlayerAccount }> {
  const uid = params.firebaseUid.trim();
  if (!uid) {
    throw new Error('UID do Firebase inválido.');
  }
  const cleanNick = (params.nickname?.trim() || 'Sobrevivente').slice(0, 18);
  const initialAvatar = sanitizeInitialAvatar(params.character?.avatarId);
  const safeChar = sanitizeGuestCharacter({ ...params.character, avatarId: initialAvatar });

  if (!isDatabaseConfigured) {
    let row = Array.from(memAccounts.values()).find((a) => a.firebaseUid === uid);
    if (!row) {
      const id = nextMemAccountId++;
      const now = new Date();
      row = {
        id,
        publicId: await generateUniquePublicId(),
        username: `fb_${uid.slice(0, 14).toLowerCase()}`,
        passwordHash: hashPassword(randomBytes(16).toString('hex')),
        firebaseUid: uid,
        nickname: cleanNick,
        level: 1,
        gold: 1200,
        gems: 40,
        matchesPlayed: 0,
        wins: 0,
        rankPoints: 0,
        rankedMatches: 0,
        rankedWins: 0,
        totalKills: 0,
        avatarId: initialAvatar,
        unlockedAvatarsJson: JSON.stringify(FREE_PLAYER_AVATARS),
        seasonId: CURRENT_RANKED_SEASON,
        s1PeakRankPoints: 0,
        s1ClaimedRewardsJson: '[]',
        characterJson: JSON.stringify(safeChar),
        lastSeenAt: now,
        createdAt: now,
      };
      memAccounts.set(id, row);
    } else {
      row.lastSeenAt = new Date();
    }
    const token = randomBytes(32).toString('hex');
    memSessions.set(token, row.id);
    return { token, account: toPublicAccount(row, 'lobby') };
  }

  try {
    const publicId = await generateUniquePublicId();
    const upserted = await db
      .insert(accounts)
      .values({
        publicId,
        username: `fb_${uid.slice(0, 14).toLowerCase()}_${publicId.slice(-4)}`,
        passwordHash: hashPassword(randomBytes(16).toString('hex')),
        firebaseUid: uid,
        nickname: cleanNick,
        rankPoints: 0,
        avatarId: initialAvatar,
        unlockedAvatarsJson: JSON.stringify(FREE_PLAYER_AVATARS),
        seasonId: CURRENT_RANKED_SEASON,
        s1PeakRankPoints: 0,
        s1ClaimedRewardsJson: '[]',
        characterJson: JSON.stringify(safeChar),
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: accounts.firebaseUid,
        set: { lastSeenAt: new Date() },
      })
      .returning();
    const row = upserted[0];

    const token = randomBytes(32).toString('hex');
    await db.insert(sessions).values({
      token,
      accountId: row.id,
    });
    return { token, account: toPublicAccount(row, 'lobby') };
  } catch (error) {
    console.error('loginOrRegisterFirebaseAccount failed:', error);
    throw new Error('Erro ao autenticar conta Firebase no servidor.', { cause: error });
  }
}

function sanitizeGuestCharacter(raw: unknown): Partial<CharacterConfig> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const plainStrKeys = ['id', 'name', 'modelId', 'avatarId', 'glooSkin', 'hairStyle', 'shirtStyle'] as const;
  for (const key of plainStrKeys) {
    if (typeof src[key] === 'string') {
      out[key] = src[key].replace(/[<>"'`]/g, '').trim().slice(0, 40);
    }
  }
  const colorKeys = [
    'skinColor',
    'hairColor',
    'shirtColor',
    'pantsColor',
    'vestColor',
    'shoesColor',
  ] as const;
  for (const key of colorKeys) {
    if (typeof src[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(src[key].trim())) {
      out[key] = src[key].trim();
    }
  }
  if (typeof src.vestEnabled === 'boolean') out.vestEnabled = src.vestEnabled;
  if (typeof src.backpackEnabled === 'boolean') out.backpackEnabled = src.backpackEnabled;
  const cleanSkins = sanitizeEquippedSkins(src.equippedSkins);
  if (cleanSkins) out.equippedSkins = cleanSkins;
  return out as Partial<CharacterConfig>;
}

export async function createGuestAccount(params: {
  nickname?: string;
  character?: Partial<CharacterConfig>;
} = {}): Promise<{ token: string; account: PublicPlayerAccount }> {
  const publicId = await generateUniquePublicId();
  const rawNick = typeof params.nickname === 'string' ? params.nickname : '';
  const cleanedNick = rawNick.replace(/[<>"'`]/g, '').trim().slice(0, 18);
  const cleanNick = cleanedNick || `Sobrevivente_${publicId.slice(-4)}`;
  const cleanUser = `gst_${publicId}_${randomBytes(3).toString('hex')}`.toLowerCase();
  const initialAvatar = sanitizeInitialAvatar(params.character?.avatarId);
  const safeCharacter = sanitizeGuestCharacter({ ...params.character, avatarId: initialAvatar });

  if (!isDatabaseConfigured) {
    const id = nextMemAccountId++;
    const now = new Date();
    const row: AccountRow = {
      id,
      publicId,
      username: cleanUser,
      passwordHash: hashPassword(randomBytes(16).toString('hex')),
      firebaseUid: null,
      nickname: cleanNick,
      level: 1,
      gold: 1200,
      gems: 40,
      matchesPlayed: 0,
      wins: 0,
      rankPoints: 0,
      rankedMatches: 0,
      rankedWins: 0,
      totalKills: 0,
      avatarId: initialAvatar,
      unlockedAvatarsJson: JSON.stringify(FREE_PLAYER_AVATARS),
      seasonId: CURRENT_RANKED_SEASON,
      s1PeakRankPoints: 0,
      s1ClaimedRewardsJson: '[]',
      characterJson: JSON.stringify(safeCharacter),
      lastSeenAt: now,
      createdAt: now,
    };
    memAccounts.set(id, row);
    const token = randomBytes(32).toString('hex');
    memSessions.set(token, id);
    return { token, account: toPublicAccount(row, 'lobby') };
  }

  try {
    const inserted = await db
      .insert(accounts)
      .values({
        publicId,
        username: cleanUser,
        passwordHash: hashPassword(randomBytes(16).toString('hex')),
        nickname: cleanNick,
        rankPoints: 0,
        avatarId: initialAvatar,
        unlockedAvatarsJson: JSON.stringify(FREE_PLAYER_AVATARS),
        seasonId: CURRENT_RANKED_SEASON,
        s1PeakRankPoints: 0,
        s1ClaimedRewardsJson: '[]',
        characterJson: JSON.stringify(safeCharacter),
      })
      .returning();
    const row = inserted[0];
    const token = randomBytes(32).toString('hex');
    await db.insert(sessions).values({
      token,
      accountId: row.id,
    });
    return { token, account: toPublicAccount(row, 'lobby') };
  } catch (error) {
    console.error('createGuestAccount failed:', error);
    throw new Error('Erro ao iniciar sessão de convidado no servidor.', { cause: error });
  }
}

export async function getAccountByToken(token: string): Promise<PublicPlayerAccount | null> {
  if (!token) return null;

  if (!isDatabaseConfigured) {
    const accId = memSessions.get(token);
    if (accId === undefined) return null;
    const row = memAccounts.get(accId);
    return row ? toPublicAccount(row, 'lobby') : null;
  }

  try {
    const rows = await db
      .select({ account: accounts })
      .from(sessions)
      .innerJoin(accounts, eq(sessions.accountId, accounts.id))
      .where(eq(sessions.token, token))
      .limit(1);
    if (!rows[0]) return null;
    return toPublicAccount(rows[0].account, 'lobby');
  } catch (error) {
    console.error('getAccountByToken failed:', error);
    throw new Error('Falha ao validar sessão.', { cause: error });
  }
}

export async function logoutSession(token: string): Promise<void> {
  if (!isDatabaseConfigured) {
    memSessions.delete(token);
    return;
  }

  try {
    await db.delete(sessions).where(eq(sessions.token, token));
  } catch (error) {
    console.error('logoutSession failed:', error);
  }
}

export async function updateAccountStatsAndProfile(
  accountId: number,
  patch: {
    nickname?: string;
    avatarId?: PlayerAvatarId;
    character?: Partial<CharacterConfig>;
    gold?: number;
    gems?: number;
    level?: number;
    matchesPlayed?: number;
    wins?: number;
    rankPoints?: number;
    rankedMatches?: number;
    rankedWins?: number;
    totalKills?: number;
  },
): Promise<PublicPlayerAccount> {
  const applyToRow = (row: AccountRow): Partial<AccountRow> => {
    const curRank = row.rankPoints;
    const nextRank =
      patch.rankPoints !== undefined
        ? Math.max(0, Math.min(curRank + 150, Math.round(patch.rankPoints)))
        : curRank;
    const nextPeak = Math.max(row.s1PeakRankPoints ?? 0, curRank, nextRank);
    const nextUnlocked = parseUnlockedAvatars(row.unlockedAvatarsJson, nextPeak);

    const requestedAvatarRaw = patch.avatarId ?? patch.character?.avatarId;
    let nextAvatar = normalizePlayerAvatarId(row.avatarId);
    if (requestedAvatarRaw !== undefined) {
      const candidate = normalizePlayerAvatarId(requestedAvatarRaw);
      if (!nextUnlocked.includes(candidate)) {
        throw new Error('Avatar bloqueado! Pegue Mestre na Temporada S1 para desbloquear.');
      }
      nextAvatar = candidate;
    }

    const nextGold =
      patch.gold !== undefined
        ? Math.max(0, Math.min(row.gold + 500, Math.round(patch.gold)))
        : row.gold;
    const nextGems =
      patch.gems !== undefined
        ? Math.max(0, Math.min(row.gems + 50, Math.round(patch.gems)))
        : row.gems;

    const existingChar = parseCharacter(row.characterJson);
    const mergedChar =
      patch.character !== undefined
        ? sanitizeGuestCharacter({
            ...patch.character,
            equippedSkins:
              'equippedSkins' in patch.character
                ? patch.character.equippedSkins
                : existingChar.equippedSkins,
            avatarId: nextAvatar,
          })
        : { ...existingChar, avatarId: nextAvatar };

    return {
      lastSeenAt: new Date(),
      nickname:
        patch.nickname !== undefined
          ? patch.nickname.trim().slice(0, 18) || 'Sobrevivente'
          : row.nickname,
      avatarId: nextAvatar,
      unlockedAvatarsJson: JSON.stringify(nextUnlocked),
      s1PeakRankPoints: nextPeak,
      characterJson: JSON.stringify(mergedChar),
      gold: nextGold,
      gems: nextGems,
      level: patch.level !== undefined ? Math.max(1, Math.round(patch.level)) : row.level,
      matchesPlayed:
        patch.matchesPlayed !== undefined
          ? Math.max(row.matchesPlayed, Math.round(patch.matchesPlayed))
          : row.matchesPlayed,
      wins: patch.wins !== undefined ? Math.max(row.wins, Math.round(patch.wins)) : row.wins,
      rankPoints: nextRank,
      rankedMatches:
        patch.rankedMatches !== undefined
          ? Math.max(row.rankedMatches, Math.round(patch.rankedMatches))
          : row.rankedMatches,
      rankedWins:
        patch.rankedWins !== undefined
          ? Math.max(row.rankedWins, Math.round(patch.rankedWins))
          : row.rankedWins,
      totalKills:
        patch.totalKills !== undefined
          ? Math.max(row.totalKills, Math.round(patch.totalKills))
          : row.totalKills,
    };
  };

  if (!isDatabaseConfigured) {
    const row = memAccounts.get(accountId);
    if (!row) throw new Error('Conta não encontrada.');
    const changes = applyToRow(row);
    Object.assign(row, changes);
    return toPublicAccount(row, 'lobby');
  }

  try {
    const existingRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    const current = existingRows[0];
    if (!current) throw new Error('Conta não encontrada.');

    const updateSet = applyToRow(current);
    const updated = await db
      .update(accounts)
      .set(updateSet)
      .where(eq(accounts.id, accountId))
      .returning();
    if (!updated[0]) throw new Error('Conta não encontrada.');
    return toPublicAccount(updated[0], 'lobby');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Avatar bloqueado')) {
      throw error;
    }
    console.error('updateAccountStatsAndProfile failed:', error);
    throw new Error('Falha ao salvar progresso da conta.', { cause: error });
  }
}

export async function claimSeason1Reward(
  accountId: number,
  rewardId: string,
): Promise<{
  account: PublicPlayerAccount;
  grantedGold: number;
  grantedGems: number;
  grantedAvatars: PlayerAvatarId[];
}> {
  const tier = SEASON_1_REWARDS.find((r) => r.id === rewardId);
  if (!tier) {
    throw new Error('Recompensa da Temporada S1 não encontrada.');
  }

  const computeClaim = (row: AccountRow) => {
    const peak = Math.max(row.s1PeakRankPoints ?? 0, row.rankPoints);
    if (peak < tier.minPts) {
      throw new Error(
        `Você precisa atingir ${tier.tierName} (${tier.minPts} PTS) na Temporada S1 para resgatar esta recompensa.`,
      );
    }
    const claimed = parseClaimedRewards(row.s1ClaimedRewardsJson);
    if (claimed.includes(tier.id)) {
      throw new Error('Esta recompensa da Temporada S1 já foi resgatada.');
    }

    const nextClaimed = [...claimed, tier.id];
    const unlockedSet = new Set<PlayerAvatarId>(
      parseUnlockedAvatars(row.unlockedAvatarsJson, peak),
    );
    const grantedAvatars: PlayerAvatarId[] = [];
    if (tier.avatarIds) {
      for (const av of tier.avatarIds) {
        unlockedSet.add(av);
        grantedAvatars.push(av);
      }
    }
    const grantedGold = tier.goldReward;
    const grantedGems = tier.gemsReward ?? 0;

    return {
      update: {
        gold: row.gold + grantedGold,
        gems: row.gems + grantedGems,
        unlockedAvatarsJson: JSON.stringify(Array.from(unlockedSet)),
        s1ClaimedRewardsJson: JSON.stringify(nextClaimed),
        s1PeakRankPoints: peak,
        lastSeenAt: new Date(),
      },
      grantedGold,
      grantedGems,
      grantedAvatars,
    };
  };

  if (!isDatabaseConfigured) {
    const row = memAccounts.get(accountId);
    if (!row) throw new Error('Conta não encontrada.');
    const res = computeClaim(row);
    Object.assign(row, res.update);
    return {
      account: toPublicAccount(row, 'lobby'),
      grantedGold: res.grantedGold,
      grantedGems: res.grantedGems,
      grantedAvatars: res.grantedAvatars,
    };
  }

  const rows = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  const current = rows[0];
  if (!current) throw new Error('Conta não encontrada.');
  const res = computeClaim(current);
  const updated = await db
    .update(accounts)
    .set(res.update)
    .where(eq(accounts.id, accountId))
    .returning();
  return {
    account: toPublicAccount(updated[0], 'lobby'),
    grantedGold: res.grantedGold,
    grantedGems: res.grantedGems,
    grantedAvatars: res.grantedAvatars,
  };
}

export async function findAccountByPublicIdOrNick(
  query: string,
  getPresence?: (id: number) => PresenceStatus,
): Promise<PublicPlayerAccount | null> {
  const clean = query.trim();
  if (!clean) return null;

  if (!isDatabaseConfigured) {
    const lower = clean.toLowerCase();
    const row = Array.from(memAccounts.values()).find(
      (a) =>
        a.publicId === clean ||
        a.nickname.toLowerCase() === lower ||
        a.username.toLowerCase() === lower,
    );
    if (!row) return null;
    return toPublicAccount(row, getPresence?.(row.id) ?? 'offline');
  }

  try {
    const rows = await db
      .select()
      .from(accounts)
      .where(
        or(
          eq(accounts.publicId, clean),
          ilike(accounts.nickname, clean),
          ilike(accounts.username, clean.toLowerCase()),
        ),
      )
      .limit(1);
    if (!rows[0]) return null;
    return toPublicAccount(rows[0], getPresence?.(rows[0].id) ?? 'offline');
  } catch (error) {
    console.error('findAccountByPublicIdOrNick failed:', error);
    throw new Error('Erro ao buscar jogador.', { cause: error });
  }
}

export async function getAccountProfileById(
  accountId: number,
  getPresence?: (id: number) => PresenceStatus,
): Promise<PublicPlayerAccount | null> {
  if (!isDatabaseConfigured) {
    const row = memAccounts.get(accountId);
    if (!row) return null;
    return toPublicAccount(row, getPresence?.(row.id) ?? 'offline');
  }

  try {
    const rows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    if (!rows[0]) return null;
    return toPublicAccount(rows[0], getPresence?.(rows[0].id) ?? 'offline');
  } catch (error) {
    console.error('getAccountProfileById failed:', error);
    throw new Error('Erro ao carregar perfil.', { cause: error });
  }
}

export async function sendFriendRequest(
  requesterId: number,
  targetQuery: string,
): Promise<{ status: 'pending' | 'accepted'; target: PublicPlayerAccount }> {
  const target = await findAccountByPublicIdOrNick(targetQuery);
  if (!target) {
    throw new Error('Jogador não encontrado pelo ID ou Nick.');
  }
  if (target.id === requesterId) {
    throw new Error('Você não pode adicionar a si mesmo.');
  }

  if (!isDatabaseConfigured) {
    const existing = Array.from(memFriendships.values()).find(
      (f) =>
        (f.requesterId === requesterId && f.addresseeId === target.id) ||
        (f.requesterId === target.id && f.addresseeId === requesterId),
    );
    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('Vocês já são amigos!');
      }
      if (existing.requesterId === target.id && existing.addresseeId === requesterId) {
        existing.status = 'accepted';
        return { status: 'accepted', target };
      }
      throw new Error('Pedido de amizade já enviado.');
    }
    const id = nextMemFriendshipId++;
    memFriendships.set(id, {
      id,
      requesterId,
      addresseeId: target.id,
      status: 'pending',
      createdAt: new Date(),
    });
    return { status: 'pending', target };
  }

  try {
    const existing = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, requesterId),
            eq(friendships.addresseeId, target.id),
          ),
          and(
            eq(friendships.requesterId, target.id),
            eq(friendships.addresseeId, requesterId),
          ),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const row = existing[0];
      if (row.status === 'accepted') {
        throw new Error('Vocês já são amigos!');
      }
      if (row.requesterId === target.id && row.addresseeId === requesterId) {
        await db
          .update(friendships)
          .set({ status: 'accepted' })
          .where(eq(friendships.id, row.id));
        return { status: 'accepted', target };
      }
      throw new Error('Pedido de amizade já enviado.');
    }

    await db.insert(friendships).values({
      requesterId,
      addresseeId: target.id,
      status: 'pending',
    });
    return { status: 'pending', target };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('amigos') ||
        error.message.includes('enviado') ||
        error.message.includes('encontrado') ||
        error.message.includes('si mesmo'))
    ) {
      throw error;
    }
    console.error('sendFriendRequest failed:', error);
    throw new Error('Erro ao enviar pedido de amizade.', { cause: error });
  }
}

export async function respondFriendRequest(
  accountId: number,
  friendshipId: number,
  accept: boolean,
): Promise<void> {
  if (!isDatabaseConfigured) {
    const row = memFriendships.get(friendshipId);
    if (!row) throw new Error('Pedido não encontrado.');
    if (row.addresseeId !== accountId && row.requesterId !== accountId) {
      throw new Error('Sem permissão para responder este pedido.');
    }
    if (accept && row.addresseeId === accountId) {
      row.status = 'accepted';
    } else {
      memFriendships.delete(friendshipId);
    }
    return;
  }

  try {
    const rows = await db
      .select()
      .from(friendships)
      .where(eq(friendships.id, friendshipId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error('Pedido não encontrado.');
    if (row.addresseeId !== accountId && row.requesterId !== accountId) {
      throw new Error('Sem permissão para responder este pedido.');
    }
    if (accept && row.addresseeId === accountId) {
      await db
        .update(friendships)
        .set({ status: 'accepted' })
        .where(eq(friendships.id, friendshipId));
    } else {
      await db.delete(friendships).where(eq(friendships.id, friendshipId));
    }
  } catch (error) {
    console.error('respondFriendRequest failed:', error);
    throw new Error('Erro ao atualizar pedido de amizade.', { cause: error });
  }
}

export async function removeFriend(accountId: number, friendAccountId: number): Promise<void> {
  if (!isDatabaseConfigured) {
    for (const [id, row] of memFriendships.entries()) {
      if (
        (row.requesterId === accountId && row.addresseeId === friendAccountId) ||
        (row.requesterId === friendAccountId && row.addresseeId === accountId)
      ) {
        memFriendships.delete(id);
      }
    }
    return;
  }

  try {
    await db
      .delete(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, accountId),
            eq(friendships.addresseeId, friendAccountId),
          ),
          and(
            eq(friendships.requesterId, friendAccountId),
            eq(friendships.addresseeId, accountId),
          ),
        ),
      );
  } catch (error) {
    console.error('removeFriend failed:', error);
    throw new Error('Erro ao remover amigo.', { cause: error });
  }
}

export async function listFriendsAndRequests(
  accountId: number,
  getPresence: (id: number) => PresenceStatus,
): Promise<{
  friends: FriendEntry[];
  requests: FriendRequestEntry[];
}> {
  if (!isDatabaseConfigured) {
    const rows = Array.from(memFriendships.values()).filter(
      (r) => r.requesterId === accountId || r.addresseeId === accountId,
    );
    const friends: FriendEntry[] = [];
    const requests: FriendRequestEntry[] = [];

    for (const r of rows) {
      const otherId = r.requesterId === accountId ? r.addresseeId : r.requesterId;
      const otherAcc = await getAccountProfileById(otherId, getPresence);
      if (!otherAcc) continue;
      if (r.status === 'accepted') {
        friends.push({
          friendshipId: r.id,
          account: otherAcc,
          presence: getPresence(otherId),
        });
      } else {
        requests.push({
          friendshipId: r.id,
          direction: r.addresseeId === accountId ? 'incoming' : 'outgoing',
          account: otherAcc,
          createdAt: r.createdAt.toISOString(),
        });
      }
    }

    const orderScore = (p: PresenceStatus) =>
      p === 'lobby' ? 0 : p === 'matchmaking' ? 1 : p === 'in_match' ? 2 : 3;
    friends.sort((a, b) => orderScore(a.presence) - orderScore(b.presence));

    return { friends, requests };
  }

  try {
    const rows = await db
      .select()
      .from(friendships)
      .where(
        or(
          eq(friendships.requesterId, accountId),
          eq(friendships.addresseeId, accountId),
        ),
      );

    const friends: FriendEntry[] = [];
    const requests: FriendRequestEntry[] = [];

    for (const r of rows) {
      const otherId = r.requesterId === accountId ? r.addresseeId : r.requesterId;
      const otherAcc = await getAccountProfileById(otherId, getPresence);
      if (!otherAcc) continue;
      if (r.status === 'accepted') {
        friends.push({
          friendshipId: r.id,
          account: otherAcc,
          presence: getPresence(otherId),
        });
      } else {
        requests.push({
          friendshipId: r.id,
          direction: r.addresseeId === accountId ? 'incoming' : 'outgoing',
          account: otherAcc,
          createdAt: r.createdAt.toISOString(),
        });
      }
    }

    const orderScore = (p: PresenceStatus) =>
      p === 'lobby' ? 0 : p === 'matchmaking' ? 1 : p === 'in_match' ? 2 : 3;
    friends.sort((a, b) => orderScore(a.presence) - orderScore(b.presence));

    return { friends, requests };
  } catch (error) {
    console.error('listFriendsAndRequests failed:', error);
    throw new Error('Erro ao carregar lista de amigos.', { cause: error });
  }
}

export interface MatchHistoryInput {
  roomId: string;
  mode: string;
  mapId: string;
  isRanked: boolean;
  placement: number;
  kills: number;
  damage: number;
  survivalSec: number;
  booyah: boolean;
  rankDelta: number;
}

export interface PublicMatchHistoryItem extends MatchHistoryInput {
  id: number;
  createdAt: string;
}

export async function recordMatchHistory(
  accountId: number,
  input: MatchHistoryInput,
): Promise<PublicMatchHistoryItem> {
  const cleanRoomId = (input.roomId || 'offline').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'offline';
  const cleanMode = input.mode === 'duo' || input.mode === 'squad' ? input.mode : 'solo';
  const cleanMap = 'bermuda';
  const placement = Math.max(1, Math.min(200, Math.round(Number(input.placement) || 51)));
  const kills = Math.max(0, Math.min(200, Math.round(Number(input.kills) || 0)));
  const damage = Math.max(0, Math.min(50000, Math.round(Number(input.damage) || 0)));
  const survivalSec = Math.max(0, Math.min(7200, Math.round(Number(input.survivalSec) || 0)));
  const rankDelta = Math.max(-500, Math.min(500, Math.round(Number(input.rankDelta) || 0)));
  const booyah = Boolean(input.booyah);
  const isRanked = Boolean(input.isRanked);

  if (!isDatabaseConfigured) {
    const row: MatchHistoryRow = {
      id: nextMemMatchId++,
      accountId,
      roomId: cleanRoomId,
      mode: cleanMode,
      mapId: cleanMap,
      isRanked,
      placement,
      kills,
      damage,
      survivalSec,
      booyah,
      rankDelta,
      createdAt: new Date(),
    };
    memMatchHistory.unshift(row);
    if (memMatchHistory.length > 500) memMatchHistory.length = 500;
    return {
      id: row.id,
      roomId: row.roomId,
      mode: row.mode,
      mapId: row.mapId,
      isRanked: row.isRanked,
      placement: row.placement,
      kills: row.kills,
      damage: row.damage,
      survivalSec: row.survivalSec,
      booyah: row.booyah,
      rankDelta: row.rankDelta,
      createdAt: row.createdAt.toISOString(),
    };
  }

  try {
    const inserted = await db
      .insert(matchHistory)
      .values({
        accountId,
        roomId: cleanRoomId,
        mode: cleanMode,
        mapId: cleanMap,
        isRanked,
        placement,
        kills,
        damage,
        survivalSec,
        booyah,
        rankDelta,
      })
      .returning();
    const row = inserted[0];
    return {
      id: row.id,
      roomId: row.roomId,
      mode: row.mode,
      mapId: row.mapId,
      isRanked: row.isRanked,
      placement: row.placement,
      kills: row.kills,
      damage: row.damage,
      survivalSec: row.survivalSec,
      booyah: row.booyah,
      rankDelta: row.rankDelta,
      createdAt: row.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('recordMatchHistory failed:', error);
    throw new Error('Falha ao registrar histórico da partida.', { cause: error });
  }
}

export async function getAccountMatchHistory(
  accountId: number,
  limit = 20,
): Promise<PublicMatchHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(50, Math.round(limit)));
  if (!isDatabaseConfigured) {
    return memMatchHistory
      .filter((m) => m.accountId === accountId)
      .slice(0, safeLimit)
      .map((row) => ({
        id: row.id,
        roomId: row.roomId,
        mode: row.mode,
        mapId: row.mapId,
        isRanked: row.isRanked,
        placement: row.placement,
        kills: row.kills,
        damage: row.damage,
        survivalSec: row.survivalSec,
        booyah: row.booyah,
        rankDelta: row.rankDelta,
        createdAt: row.createdAt.toISOString(),
      }));
  }

  try {
    const rows = await db
      .select()
      .from(matchHistory)
      .where(eq(matchHistory.accountId, accountId))
      .orderBy(desc(matchHistory.createdAt))
      .limit(safeLimit);
    return rows.map((row) => ({
      id: row.id,
      roomId: row.roomId,
      mode: row.mode,
      mapId: row.mapId,
      isRanked: row.isRanked,
      placement: row.placement,
      kills: row.kills,
      damage: row.damage,
      survivalSec: row.survivalSec,
      booyah: row.booyah,
      rankDelta: row.rankDelta,
      createdAt: row.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('getAccountMatchHistory failed:', error);
    throw new Error('Falha ao carregar histórico de partidas.', { cause: error });
  }
}

export interface LeaderboardEntry {
  publicId: string;
  nickname: string;
  level: number;
  rankPoints: number;
  wins: number;
  totalKills: number;
  matchesPlayed: number;
  avatarId?: PlayerAvatarId;
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  if (!isDatabaseConfigured) {
    return Array.from(memAccounts.values())
      .sort((a, b) => b.rankPoints - a.rankPoints || b.wins - a.wins)
      .slice(0, safeLimit)
      .map((a) => ({
        publicId: a.publicId,
        nickname: a.nickname,
        level: a.level,
        rankPoints: a.rankPoints,
        wins: a.wins,
        totalKills: a.totalKills,
        matchesPlayed: a.matchesPlayed,
        avatarId: normalizePlayerAvatarId(a.avatarId),
      }));
  }

  try {
    const rows = await db
      .select({
        publicId: accounts.publicId,
        nickname: accounts.nickname,
        level: accounts.level,
        rankPoints: accounts.rankPoints,
        wins: accounts.wins,
        totalKills: accounts.totalKills,
        matchesPlayed: accounts.matchesPlayed,
        avatarId: accounts.avatarId,
      })
      .from(accounts)
      .orderBy(desc(accounts.rankPoints), desc(accounts.wins))
      .limit(safeLimit);
    return rows.map((r) => ({
      ...r,
      avatarId: normalizePlayerAvatarId(r.avatarId),
    }));
  } catch (error) {
    console.error('getLeaderboard failed:', error);
    throw new Error('Falha ao carregar ranking global.', { cause: error });
  }
}
