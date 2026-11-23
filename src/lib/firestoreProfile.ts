import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import type { CharacterConfig, CharacterModelId, PlayerProfile } from '../game/types';
import { normalizeCharacterModelId } from '../game/types';
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
      return {
        uid: user.uid,
        publicId: sanitizePublicId(data.publicId ?? suggestedPublicId),
        nickname: sanitizeNickname(data.nickname ?? fallbackProfile.nickname),
        level: clampInt(Number(data.level ?? fallbackProfile.level), 1, 999),
        gold: clampInt(Number(data.gold ?? fallbackProfile.gold), 0, 100000000),
        gems: clampInt(Number(data.gems ?? fallbackProfile.gems), 0, 100000000),
        matchesPlayed: clampInt(Number(data.matchesPlayed ?? 0), 0, 1000000),
        wins: clampInt(Number(data.wins ?? 0), 0, 1000000),
        rankPoints: clampInt(Number(data.rankPoints ?? 1000), 0, 1000000),
        rankedMatches: clampInt(Number(data.rankedMatches ?? 0), 0, 1000000),
        rankedWins: clampInt(Number(data.rankedWins ?? 0), 0, 1000000),
        totalKills: clampInt(Number(data.totalKills ?? 0), 0, 10000000),
        characterModelId: sanitizeModelId(data.characterModelId),
      };
    }

    const initial: FirestoreUserProfileDoc = {
      uid: user.uid,
      publicId: sanitizePublicId(suggestedPublicId),
      nickname: sanitizeNickname(user.displayName || fallbackProfile.nickname),
      level: clampInt(fallbackProfile.level, 1, 999),
      gold: clampInt(fallbackProfile.gold, 0, 100000000),
      gems: clampInt(fallbackProfile.gems, 0, 100000000),
      matchesPlayed: clampInt(fallbackProfile.matchesPlayed, 0, 1000000),
      wins: clampInt(fallbackProfile.wins, 0, 1000000),
      rankPoints: clampInt(fallbackProfile.rankPoints, 0, 1000000),
      rankedMatches: clampInt(fallbackProfile.rankedMatches, 0, 1000000),
      rankedWins: clampInt(fallbackProfile.rankedWins, 0, 1000000),
      totalKills: clampInt(fallbackProfile.totalKills, 0, 10000000),
      characterModelId: sanitizeModelId(fallbackCharacter.modelId),
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
    >
  >,
): Promise<void> {
  if (!user.emailVerified) return;
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

  try {
    await updateDoc(ref, updateData);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docPath);
  }
}
