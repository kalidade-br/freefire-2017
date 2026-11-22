import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, eq, ilike, or } from 'drizzle-orm';
import { db, isDatabaseConfigured } from './index.ts';
import { accounts, friendships, sessions } from './schema.ts';
import type {
  FriendEntry,
  FriendRequestEntry,
  PresenceStatus,
  PublicPlayerAccount,
} from '../shared/multiplayerTypes.ts';
import type { CharacterConfig } from '../game/types.ts';

// ============================================================================
// IN-MEMORY STORE FALLBACK (when Cloud SQL / PostgreSQL is not configured)
// ============================================================================

type AccountRow = typeof accounts.$inferSelect;
type FriendshipRow = typeof friendships.$inferSelect;

const memAccounts = new Map<number, AccountRow>();
const memSessions = new Map<string, number>();
const memFriendships = new Map<number, FriendshipRow>();
let nextMemAccountId = 1;
let nextMemFriendshipId = 1;

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

export function toPublicAccount(
  row: AccountRow,
  presence?: PresenceStatus,
): PublicPlayerAccount {
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
    character: parseCharacter(row.characterJson),
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
      rankPoints: 1000,
      rankedMatches: 0,
      rankedWins: 0,
      totalKills: 0,
      characterJson: JSON.stringify(params.character ?? {}),
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
        characterJson: JSON.stringify(params.character ?? {}),
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
        rankPoints: 1000,
        rankedMatches: 0,
        rankedWins: 0,
        totalKills: 0,
        characterJson: JSON.stringify(params.character ?? {}),
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
    const existing = await db
      .select()
      .from(accounts)
      .where(eq(accounts.firebaseUid, uid))
      .limit(1);
    let row = existing[0];
    if (!row) {
      const publicId = await generateUniquePublicId();
      const inserted = await db
        .insert(accounts)
        .values({
          publicId,
          username: `fb_${uid.slice(0, 14).toLowerCase()}_${publicId.slice(-4)}`,
          passwordHash: hashPassword(randomBytes(16).toString('hex')),
          firebaseUid: uid,
          nickname: cleanNick,
          characterJson: JSON.stringify(params.character ?? {}),
        })
        .returning();
      row = inserted[0];
    } else {
      await db
        .update(accounts)
        .set({ lastSeenAt: new Date() })
        .where(eq(accounts.id, row.id));
    }

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
  if (!isDatabaseConfigured) {
    const row = memAccounts.get(accountId);
    if (!row) throw new Error('Conta não encontrada.');
    row.lastSeenAt = new Date();
    if (patch.nickname !== undefined) row.nickname = patch.nickname.trim().slice(0, 18) || 'Sobrevivente';
    if (patch.character !== undefined) row.characterJson = JSON.stringify(patch.character);
    if (patch.gold !== undefined) row.gold = Math.max(0, Math.round(patch.gold));
    if (patch.gems !== undefined) row.gems = Math.max(0, Math.round(patch.gems));
    if (patch.level !== undefined) row.level = Math.max(1, Math.round(patch.level));
    if (patch.matchesPlayed !== undefined) row.matchesPlayed = Math.max(0, Math.round(patch.matchesPlayed));
    if (patch.wins !== undefined) row.wins = Math.max(0, Math.round(patch.wins));
    if (patch.rankPoints !== undefined) row.rankPoints = Math.max(0, Math.round(patch.rankPoints));
    if (patch.rankedMatches !== undefined) row.rankedMatches = Math.max(0, Math.round(patch.rankedMatches));
    if (patch.rankedWins !== undefined) row.rankedWins = Math.max(0, Math.round(patch.rankedWins));
    if (patch.totalKills !== undefined) row.totalKills = Math.max(0, Math.round(patch.totalKills));
    return toPublicAccount(row, 'lobby');
  }

  try {
    const updateSet: Partial<typeof accounts.$inferInsert> = {
      lastSeenAt: new Date(),
    };
    if (patch.nickname !== undefined) updateSet.nickname = patch.nickname.trim().slice(0, 18) || 'Sobrevivente';
    if (patch.character !== undefined) updateSet.characterJson = JSON.stringify(patch.character);
    if (patch.gold !== undefined) updateSet.gold = Math.max(0, Math.round(patch.gold));
    if (patch.gems !== undefined) updateSet.gems = Math.max(0, Math.round(patch.gems));
    if (patch.level !== undefined) updateSet.level = Math.max(1, Math.round(patch.level));
    if (patch.matchesPlayed !== undefined) updateSet.matchesPlayed = Math.max(0, Math.round(patch.matchesPlayed));
    if (patch.wins !== undefined) updateSet.wins = Math.max(0, Math.round(patch.wins));
    if (patch.rankPoints !== undefined) updateSet.rankPoints = Math.max(0, Math.round(patch.rankPoints));
    if (patch.rankedMatches !== undefined) updateSet.rankedMatches = Math.max(0, Math.round(patch.rankedMatches));
    if (patch.rankedWins !== undefined) updateSet.rankedWins = Math.max(0, Math.round(patch.rankedWins));
    if (patch.totalKills !== undefined) updateSet.totalKills = Math.max(0, Math.round(patch.totalKills));

    const updated = await db
      .update(accounts)
      .set(updateSet)
      .where(eq(accounts.id, accountId))
      .returning();
    if (!updated[0]) throw new Error('Conta não encontrada.');
    return toPublicAccount(updated[0], 'lobby');
  } catch (error) {
    console.error('updateAccountStatsAndProfile failed:', error);
    throw new Error('Falha ao salvar progresso da conta.', { cause: error });
  }
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
