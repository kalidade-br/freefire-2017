export const AVATAR_ADAM = '/assets/aistudio/Adam_FF_b11a9a18.webp';
export const AVATAR_EVA = '/assets/aistudio/Icon_face_female01_head_B_6e9fcef7.png';

export function getCharacterAvatar(modelId?: string | null): string {
  return modelId === 'eva' ? AVATAR_EVA : AVATAR_ADAM;
}
