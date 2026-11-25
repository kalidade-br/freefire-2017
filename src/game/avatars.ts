import type { PlayerAvatarId } from './types.ts';

export const AVATAR_DEFAULT = '/assets/aistudio/902000003_00e0bc79.png';
export const AVATAR_ADAM = '/assets/aistudio/Adam_FF_b11a9a18.webp';
export const AVATAR_EVA = '/assets/aistudio/Icon_face_female01_head_B_6e9fcef7.png';
export const AVATAR_MAXIM = '/assets/aistudio/maxim_0477a046.png';
export const AVATAR_KELLY = '/assets/aistudio/kelly_e77d049a.png';
export const AVATAR_ANGELIC = '/assets/aistudio/Icon_face_Anchor_B_0fc52ed4.png';
export const AVATAR_EAGLE_EYE = '/assets/aistudio/Icon_face_Ranking_S2_B_f32ab63d.png';

export const FREE_PLAYER_AVATARS: readonly PlayerAvatarId[] = [
  'default',
  'adam',
  'eva',
  'maxim',
  'kelly',
];

export const S1_MESTRE_AVATARS: readonly PlayerAvatarId[] = [
  'angelic',
  'eagle_eye',
];

export interface PlayerAvatarMeta {
  id: PlayerAvatarId;
  name: string;
  subtitle: string;
  url: string;
  unlockSource: 'free' | 's1_mestre';
}

export const PLAYER_AVATARS: readonly PlayerAvatarMeta[] = [
  {
    id: 'default',
    name: 'Padrão (Sem Avatar)',
    subtitle: 'Avatar neutro clássico caso não queira usar rosto de personagem',
    url: AVATAR_DEFAULT,
    unlockSource: 'free',
  },
  {
    id: 'angelic',
    name: 'Avatar Angelical',
    subtitle: 'Recompensa Exclusiva · Pegar Mestre na Temporada S1',
    url: AVATAR_ANGELIC,
    unlockSource: 's1_mestre',
  },
  {
    id: 'eagle_eye',
    name: 'Avatar Olho de Águia',
    subtitle: 'Recompensa Exclusiva · Pegar Mestre na Temporada S1',
    url: AVATAR_EAGLE_EYE,
    unlockSource: 's1_mestre',
  },
  {
    id: 'adam',
    name: 'Adam',
    subtitle: 'Avatar Clássico do Personagem Adam',
    url: AVATAR_ADAM,
    unlockSource: 'free',
  },
  {
    id: 'eva',
    name: 'Eva',
    subtitle: 'Avatar Clássica da Personagem Eva',
    url: AVATAR_EVA,
    unlockSource: 'free',
  },
  {
    id: 'maxim',
    name: 'Maxim',
    subtitle: 'Avatar Clássico do Personagem Maxim',
    url: AVATAR_MAXIM,
    unlockSource: 'free',
  },
  {
    id: 'kelly',
    name: 'Kelly',
    subtitle: 'Avatar Clássica da Personagem Kelly',
    url: AVATAR_KELLY,
    unlockSource: 'free',
  },
];

export function normalizePlayerAvatarId(raw?: string | null): PlayerAvatarId {
  switch (raw) {
    case 'default':
    case 'adam':
    case 'eva':
    case 'maxim':
    case 'kelly':
    case 'angelic':
    case 'eagle_eye':
      return raw;
    default:
      return 'default';
  }
}

export function getCharacterAvatar(modelId?: string | null): string {
  switch (modelId) {
    case 'eva':
      return AVATAR_EVA;
    case 'maxim':
      return AVATAR_MAXIM;
    case 'kelly':
      return AVATAR_KELLY;
    default:
      return AVATAR_ADAM;
  }
}

export function getPlayerAvatar(
  avatarId?: string | null,
  modelId?: string | null,
): string {
  if (avatarId === 'angelic') return AVATAR_ANGELIC;
  if (avatarId === 'eagle_eye') return AVATAR_EAGLE_EYE;
  if (avatarId === 'adam') return AVATAR_ADAM;
  if (avatarId === 'eva') return AVATAR_EVA;
  if (avatarId === 'maxim') return AVATAR_MAXIM;
  if (avatarId === 'kelly') return AVATAR_KELLY;
  if (avatarId === 'default') return AVATAR_DEFAULT;
  if (modelId) return getCharacterAvatar(modelId);
  return AVATAR_DEFAULT;
}

export function getAvatarMeta(id?: string | null): PlayerAvatarMeta {
  const norm = normalizePlayerAvatarId(id);
  return PLAYER_AVATARS.find((a) => a.id === norm) ?? PLAYER_AVATARS[0];
}
