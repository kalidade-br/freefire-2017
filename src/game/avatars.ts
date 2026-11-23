export const AVATAR_ADAM = '/assets/aistudio/Adam_FF_b11a9a18.webp';
export const AVATAR_EVA = '/assets/aistudio/Icon_face_female01_head_B_6e9fcef7.png';
export const AVATAR_MAXIM = '/assets/aistudio/maxim_0477a046.png';
export const AVATAR_KELLY = '/assets/aistudio/kelly_e77d049a.png';

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

