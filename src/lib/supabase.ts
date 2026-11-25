import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PublicPlayerAccount } from '../shared/multiplayerTypes.ts';

let cachedAdminClient: SupabaseClient | null = null;
let cachedPublicClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY),
  );
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) return null;
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedAdminClient;
}

export function getSupabasePublicClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();
  if (!url || !key) return null;
  if (!cachedPublicClient) {
    cachedPublicClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedPublicClient;
}

export async function verifySupabaseToken(
  accessToken: string,
): Promise<{ id: string; email?: string; nickname: string } | null> {
  const client = getSupabasePublicClient();
  if (!client || !accessToken.trim()) return null;
  try {
    const { data, error } = await client.auth.getUser(accessToken.trim());
    if (error || !data.user) return null;
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const rawNick =
      typeof meta.nickname === 'string'
        ? meta.nickname
        : typeof meta.full_name === 'string'
          ? meta.full_name
          : data.user.email
            ? data.user.email.split('@')[0]
            : 'Sobrevivente';
    return {
      id: data.user.id,
      email: data.user.email,
      nickname: rawNick.replace(/[<>"'`]/g, '').trim().slice(0, 18) || 'Sobrevivente',
    };
  } catch {
    return null;
  }
}

export async function syncAccountToSupabase(
  account: PublicPlayerAccount,
): Promise<void> {
  const client = getSupabaseAdminClient();
  if (!client) return;
  try {
    await client.from('accounts').upsert(
      {
        public_id: account.publicId,
        nickname: account.nickname,
        level: account.level,
        gold: account.gold,
        gems: account.gems,
        matches_played: account.matchesPlayed,
        wins: account.wins,
        rank_points: account.rankPoints,
        ranked_matches: account.rankedMatches,
        ranked_wins: account.rankedWins,
        total_kills: account.totalKills,
        character_json: JSON.stringify(account.character ?? {}),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'public_id' },
    );
  } catch (err) {
    console.warn('[Supabase] Non-blocking profile sync skipped:', err);
  }
}

export async function syncMatchHistoryToSupabase(params: {
  publicId: string;
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
}): Promise<void> {
  const client = getSupabaseAdminClient();
  if (!client) return;
  try {
    await client.from('match_history').insert({
      public_id: params.publicId,
      room_id: params.roomId,
      mode: params.mode,
      map_id: params.mapId,
      is_ranked: params.isRanked,
      placement: params.placement,
      kills: params.kills,
      damage: params.damage,
      survival_sec: params.survivalSec,
      booyah: params.booyah,
      rank_delta: params.rankDelta,
    });
  } catch (err) {
    console.warn('[Supabase] Non-blocking match sync skipped:', err);
  }
}

export async function fetchSupabaseLeaderboard(limit = 50): Promise<
  Array<{
    publicId: string;
    nickname: string;
    level: number;
    rankPoints: number;
    wins: number;
    totalKills: number;
    matchesPlayed: number;
    avatarId?: string;
  }> | null
> {
  const client = getSupabasePublicClient();
  if (!client) return null;
  try {
    const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
    const { data, error } = await client
      .from('accounts')
      .select('public_id, nickname, level, rank_points, wins, total_kills, matches_played, character_json')
      .order('rank_points', { ascending: false })
      .order('wins', { ascending: false })
      .limit(safeLimit);
    if (error || !data) return null;
    return data.map((r) => {
      let avatarId: string = 'default';
      if (typeof r.character_json === 'string') {
        try {
          const parsed = JSON.parse(r.character_json) as { avatarId?: string };
          if (typeof parsed?.avatarId === 'string') avatarId = parsed.avatarId;
        } catch {
          // ignore
        }
      }
      return {
        publicId: String(r.public_id ?? ''),
        nickname: String(r.nickname ?? 'Sobrevivente'),
        level: Number(r.level ?? 1),
        rankPoints: Number(r.rank_points ?? 0),
        wins: Number(r.wins ?? 0),
        totalKills: Number(r.total_kills ?? 0),
        matchesPlayed: Number(r.matches_played ?? 0),
        avatarId,
      };
    });
  } catch {
    return null;
  }
}
