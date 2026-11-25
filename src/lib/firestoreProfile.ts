import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  FREE_PLAYER_AVATARS,
  S1_MESTRE_AVATARS,
  normalizePlayerAvatarId,
} from '../game/avatars';
import type {
  CharacterConfig,
  CharacterModelId,
  PlayerAvatarId,
  PlayerProfile,
} from '../game/types';
import {
  CURRENT_RANKED_SEASON,
  MESTRE_MIN_PTS,
  normalizeCharacterModelId,
} from '../game/types';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface FirestoreUserProfileDoc {
  uid: string;
  publicId: string;
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
  characterModelId: CharacterModelId;
  avatarId: PlayerAvatarId;
  unlockedAvatars: PlayerAvatarId[];
  seasonId: string;
  s1PeakRankPoints: number;
  s1ClaimedRewards: string[];
}

function clampInt(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
}

function sanitizeNickname(raw: string | null | undefined): string {
  const clean = (raw ?? 'Sobrevivente').trim().slice(0, 24);
  return clean.length > 0 ? clean : 'Sobrevivente';
}

function sanitizePublicId(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/[^0-9]/g, '');
  if (digits.length >= 4 && digits.length <= 16) return digits;
  return String(10000000 + Math.floor(Math.random() * 89999999));
}

function sanitizeModelId(raw: string | undefined): CharacterModelId {
  return normalizeCharacterModelId(raw);
}

function sanitizeUnlockedAvatars(
  raw: unknown,
  peakRankPoints: number,
): PlayerAvatarId[] {
  const set = new Set<PlayerAvatarId>(FREE_PLAYER_AVATARS);
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        const norm = normalizePlayerAvatarId(item);
        if (
          FREE_PLAYER_AVATARS.includes(norm) ||
          peakRankPoints >= MESTRE_MIN_PTS
        ) {
          set.add(norm);
        }
      }
    }
  }
  if (peakRankPoints >= MESTRE_MIN_PTS) {
    for (const av of S1_MESTRE_AVATARS) {
      set.add(av);
    }
  }
  return Array.from(set).slice(0, 10);
}

function sanitizeClaimedRewards(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 32)
    .slice(0, 10);
}

export async function syncPrivateUserInfo(user: User): Promise<void> {
  if (!user.email || !user.emailVerified) return;
  const privatePath = `users/${user.uid}/private/info`;
  const ref = doc(db, 'users', user.uid, 'private', 'info');
  try {
    const snap = await getDoc(ref);
    const payload = {
      uid: user.uid,
      email: user.email.slice(0, 254),
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(ref, payload);
    } else {
      await updateDoc(ref, {
        email: payload.email,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, privatePath);
  }
}

const inFlightProfileLoads = new Map<string, Promise<FirestoreUserProfileDoc | null>>();

export async function loadOrCreateFirestoreProfile(
  user: User,
  fallbackProfile: PlayerProfile,
  fallbackCharacter: CharacterConfig,
  suggestedPublicId?: string,
): Promise<FirestoreUserProfileDoc | null> {
  if (!user.emailVerified) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  const existingPromise = inFlightProfileLoads.get(user.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const work = (async (): Promise<FirestoreUserProfileDoc | null> => {
    const docPath = `users/${user.uid}`;
    const ref = doc(db, 'users', user.uid);

    let snap;
    try {
      snap = await getDoc(ref);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, docPath);
    }

    if (snap.exists()) {
      const data = snap.data() as Partial<FirestoreUserProfileDoc>;
      void syncPrivateUserInfo(user).catch(() => undefined);

      // One-time Season 1 Bronze Reset if profile predates S1
      const isSeason1 = data.seasonId === CURRENT_RANKED_SEASON;
      const rankPoints = isSeason1 ? clampInt(Number(data.rankPoints ?? 0), 0, 1000000) : 0;
      const s1PeakRankPoints = isSeason1
        ? Math.max(rankPoints, clampInt(Number(data.s1PeakRankPoints ?? rankPoints), 0, 1000000))
        : 0;
      const unlockedAvatars = sanitizeUnlockedAvatars(
        isSeason1 ? data.unlockedAvatars : undefined,
        s1PeakRankPoints,
      );
      const candidateAvatar = normalizePlayerAvatarId(data.avatarId);
      const avatarId = unlockedAvatars.includes(candidateAvatar) ? candidateAvatar : 'default';
      const s1ClaimedRewards = isSeason1 ? sanitizeClaimedRewards(data.s1ClaimedRewards) : [];

      const docModel: FirestoreUserProfileDoc = {
        uid: user.uid,
        publicId: sanitizePublicId(data.publicId ?? suggestedPublicId),
        nickname: sanitizeNickname(data.nickname ?? fallbackProfile.nickname),
        level: clampInt(Number(data.level ?? fallbackProfile.level), 1, 999),
        gold: clampInt(Number(data.gold ?? fallbackProfile.gold), 0, 100000000),
        gems: clampInt(Number(data.gems ?? fallbackProfile.gems), 0, 100000000),
        matchesPlayed: clampInt(Number(data.matchesPlayed ?? 0), 0, 1000000),
        wins: clampInt(Number(data.wins ?? 0), 0, 1000000),
        rankPoints,
        rankedMatches: isSeason1 ? clampInt(Number(data.rankedMatches ?? 0), 0, 1000000) : 0,
        rankedWins: isSeason1 ? clampInt(Number(data.rankedWins ?? 0), 0, 1000000) : 0,
        totalKills: clampInt(Number(data.totalKills ?? 0), 0, 10000000),
        characterModelId: sanitizeModelId(data.characterModelId),
        avatarId,
        unlockedAvatars,
        seasonId: CURRENT_RANKED_SEASON,
        s1PeakRankPoints,
        s1ClaimedRewards,
      };

      if (!isSeason1 || !data.avatarId) {
        try {
          await updateDoc(ref, {
            rankPoints: docModel.rankPoints,
            rankedMatches: docModel.rankedMatches,
            rankedWins: docModel.rankedWins,
            avatarId: docModel.avatarId,
            unlockedAvatars: docModel.unlockedAvatars,
            seasonId: CURRENT_RANKED_SEASON,
            s1PeakRankPoints: docModel.s1PeakRankPoints,
            s1ClaimedRewards: docModel.s1ClaimedRewards,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, docPath);
        }
      }

      return docModel;
    }

    const initialRank = clampInt(fallbackProfile.rankPoints ?? 0, 0, 1000000);
    const initialPeak = Math.max(initialRank, clampInt(fallbackProfile.s1PeakRankPoints ?? 0, 0, 1000000));
    const initialUnlocked = sanitizeUnlockedAvatars(fallbackProfile.unlockedAvatars, initialPeak);
    const initialAvatar = normalizePlayerAvatarId(fallbackProfile.avatarId ?? fallbackCharacter.avatarId);

    const initial: FirestoreUserProfileDoc = {
      uid: user.uid,
      publicId: sanitizePublicId(suggestedPublicId),
      nickname: sanitizeNickname(user.displayName || fallbackProfile.nickname),
      level: clampInt(fallbackProfile.level, 1, 999),
      gold: clampInt(fallbackProfile.gold, 0, 100000000),
      gems: clampInt(fallbackProfile.gems, 0, 100000000),
      matchesPlayed: clampInt(fallbackProfile.matchesPlayed, 0, 1000000),
      wins: clampInt(fallbackProfile.wins, 0, 1000000),
      rankPoints: initialRank,
      rankedMatches: clampInt(fallbackProfile.rankedMatches, 0, 1000000),
      rankedWins: clampInt(fallbackProfile.rankedWins, 0, 1000000),
      totalKills: clampInt(fallbackProfile.totalKills, 0, 10000000),
      characterModelId: sanitizeModelId(fallbackCharacter.modelId),
      avatarId: initialUnlocked.includes(initialAvatar) ? initialAvatar : 'default',
      unlockedAvatars: initialUnlocked,
      seasonId: CURRENT_RANKED_SEASON,
      s1PeakRankPoints: initialPeak,
      s1ClaimedRewards: sanitizeClaimedRewards(fallbackProfile.s1ClaimedRewards),
    };

    try {
      await setDoc(ref, {
        ...initial,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, docPath);
    }

    await syncPrivateUserInfo(user);
    return initial;
  })();

  inFlightProfileLoads.set(user.uid, work);
  try {
    return await work;
  } finally {
    inFlightProfileLoads.delete(user.uid);
  }
}

export async function saveFirestoreProfile(
  user: User,
  patch: Partial<
    Pick<
      FirestoreUserProfileDoc,
      | 'nickname'
      | 'level'
      | 'gold'
      | 'gems'
      | 'matchesPlayed'
      | 'wins'
      | 'rankPoints'
      | 'rankedMatches'
      | 'rankedWins'
      | 'totalKills'
      | 'characterModelId'
      | 'avatarId'
      | 'unlockedAvatars'
      | 'seasonId'
      | 's1PeakRankPoints'
      | 's1ClaimedRewards'
    >
  >,
): Promise<void> {
  if (!user.emailVerified) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const docPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.nickname !== undefined) updateData.nickname = sanitizeNickname(patch.nickname);
  if (patch.level !== undefined) updateData.level = clampInt(patch.level, 1, 999);
  if (patch.gold !== undefined) updateData.gold = clampInt(patch.gold, 0, 100000000);
  if (patch.gems !== undefined) updateData.gems = clampInt(patch.gems, 0, 100000000);
  if (patch.matchesPlayed !== undefined) updateData.matchesPlayed = clampInt(patch.matchesPlayed, 0, 1000000);
  if (patch.wins !== undefined) updateData.wins = clampInt(patch.wins, 0, 1000000);
  if (patch.rankPoints !== undefined) updateData.rankPoints = clampInt(patch.rankPoints, 0, 1000000);
  if (patch.rankedMatches !== undefined) updateData.rankedMatches = clampInt(patch.rankedMatches, 0, 1000000);
  if (patch.rankedWins !== undefined) updateData.rankedWins = clampInt(patch.rankedWins, 0, 1000000);
  if (patch.totalKills !== undefined) updateData.totalKills = clampInt(patch.totalKills, 0, 10000000);
  if (patch.characterModelId !== undefined) updateData.characterModelId = sanitizeModelId(patch.characterModelId);
  if (patch.avatarId !== undefined) updateData.avatarId = normalizePlayerAvatarId(patch.avatarId);
  if (patch.s1PeakRankPoints !== undefined) {
    updateData.s1PeakRankPoints = clampInt(patch.s1PeakRankPoints, 0, 1000000);
  }
  if (patch.unlockedAvatars !== undefined) {
    const peakHint = clampInt(
      Number(patch.s1PeakRankPoints ?? patch.rankPoints ?? 0),
      0,
      1000000,
    );
    updateData.unlockedAvatars = sanitizeUnlockedAvatars(patch.unlockedAvatars, peakHint);
  }
  if (patch.seasonId !== undefined) updateData.seasonId = CURRENT_RANKED_SEASON;
  if (patch.s1ClaimedRewards !== undefined) {
    updateData.s1ClaimedRewards = sanitizeClaimedRewards(patch.s1ClaimedRewards);
  }

  try {
    await updateDoc(ref, updateData);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docPath);
  }
}
