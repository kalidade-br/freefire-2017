export enum GameState {
  BOOT = 'BOOT',
  LOADING = 'LOADING',
  MENU = 'MENU',
  LOBBY = 'LOBBY',
  MATCHMAKING = 'MATCHMAKING',
  WAITING = 'WAITING',
  AIRPLANE = 'AIRPLANE',
  DROPPING = 'DROPPING',
  PARACHUTE = 'PARACHUTE',
  PLAYING = 'PLAYING',
  WIN = 'WIN',
  GAMEOVER = 'GAMEOVER',
}

export type PlayerStance = 'stand' | 'crouch' | 'prone';

export type WeaponId = 'g18' | 'deagle' | 'm4a1' | 'xm8' | 'scar' | 'ak47' | 'ump45' | 'm1014' | 'awm';

export type ScopeType = 'none' | '1x' | '2x' | '4x' | 'sniper';

export type AttachmentKind =
  | 'silencer'
  | 'compensator'
  | 'grip'
  | 'ext_mag'
  | 'stock';

export type AttachmentSlotKey = 'muzzle' | 'foregrip' | 'magazine' | 'stock';

export interface WeaponAttachments {
  muzzle: 'silencer' | 'compensator' | null;
  foregrip: 'grip' | null;
  magazine: 'ext_mag' | null;
  stock: 'stock' | null;
}

export interface ScopeMeta {
  id: ScopeType;
  label: string;
  short: string;
  fov: number;
}

export const SCOPE_META: Record<ScopeType, ScopeMeta> = {
  none: { id: 'none', label: 'Padrão (Ponto Azul)', short: 'PADRÃO', fov: 46 },
  '1x': { id: '1x', label: 'Mira 1x (Ponto Azul)', short: '1X', fov: 40 },
  '2x': { id: '2x', label: 'Mira 2x', short: '2X', fov: 25 },
  '4x': { id: '4x', label: 'Mira 4x', short: '4X', fov: 14.5 },
  sniper: { id: 'sniper', label: 'Luneta Sniper 8x', short: 'SNIPER', fov: 9 },
};

export interface WeaponDef {
  id: WeaponId;
  slot: 1 | 2 | 3;
  name: string;
  shortName: string;
  category: 'HG' | 'AR' | 'SMG' | 'SG' | 'SR';
  damage: number;
  fireRateMs: number;
  magSize: number;
  reloadTimeSec: number;
  range: number;
  spread: number;
  pellets: number;
  automatic: boolean;
  defaultScope: ScopeType;
  allowsCustomScope: boolean;
  allowsAttachments: boolean;
  supportsAimAssist: boolean;
  moveSpeedMult: number;
}

export interface WeaponSlotState {
  weaponId: WeaponId;
  ammoInMag: number;
  reserveAmmo: number;
  scope: ScopeType;
  attachments: WeaponAttachments;
}

export type CharacterModelId = 'adam' | 'eva' | 'maxim' | 'kelly';
export type PlayerAvatarId =
  | 'default'
  | 'adam'
  | 'eva'
  | 'maxim'
  | 'kelly'
  | 'angelic'
  | 'eagle_eye';
export type GlooSkinId = 'classic' | 'ffwc';

export function normalizeCharacterModelId(raw?: string | null): CharacterModelId {
  if (raw === 'eva' || raw === 'maxim' || raw === 'kelly') return raw;
  return 'adam';
}

export interface CharacterConfig {
  id: string;
  name: string;
  modelId?: CharacterModelId;
  avatarId?: PlayerAvatarId;
  glooSkin?: GlooSkinId;
  skinColor: string;
  hairStyle: 'buzz' | 'spiky' | 'cap' | 'helmet';
  hairColor: string;
  shirtStyle: 'tank' | 'tee' | 'hoodie';
  shirtColor: string;
  pantsColor: string;
  vestEnabled: boolean;
  vestColor: string;
  backpackEnabled: boolean;
  shoesColor: string;
}

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type TextureQuality = 'low' | 'medium' | 'high' | 'ultra';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high' | 'ultra';
export type ControlMode = 'auto' | 'desktop' | 'mobile';
export type AimAssistMode = 'default' | 'precise';
export type MatchMode = 'solo' | 'duo' | 'squad';
export type GameVariant = 'br' | 'gladiadores';
export type BrMapId = 'bermuda';
export type GladiadoresFormat = '1v1' | '2v2';

export type HudElementId =
  | 'minimap'
  | 'teamPanel'
  | 'topBanner'
  | 'killFeed'
  | 'ffCoins'
  | 'aliveBox'
  | 'settingsBtn'
  | 'pingBadge'
  | 'voiceCall'
  | 'weapons'
  | 'lootList'
  | 'tacticalBanner'
  | 'hpBar'
  | 'quickGlooBtn'
  | 'backpackBtn'
  | 'medkitBtn'
  | 'smallMedkitBtn'
  | 'grenadeBtn'
  | 'glooBtn'
  | 'sprintBtn'
  | 'leftFireBtn'
  | 'joystick'
  | 'fpsBadge'
  | 'fireBtn'
  | 'aimBtn'
  | 'vaultBtn'
  | 'jumpBtn'
  | 'crouchBtn'
  | 'proneBtn'
  | 'reloadBtn'
  | 'actionPrompt'
  | 'vehicleSteer'
  | 'vehiclePedals';

export interface HudElementLayout {
  xPct: number; // 0..100 (% of viewport width, center of element)
  yPct: number; // 0..100 (% of viewport height, center of element)
  scale: number; // 0.4..2.0
  opacity: number; // 0.1..1.0
}

export type HudSlotId = 1 | 2;

export type HudLayoutConfig = Record<HudElementId, HudElementLayout>;

// HUD 1: Clássico 2017 (layout original 2 dedos)
export const DEFAULT_HUD_LAYOUT: HudLayoutConfig = {
  minimap: { xPct: 8, yPct: 12, scale: 1.0, opacity: 1.0 },
  teamPanel: { xPct: 24, yPct: 10, scale: 1.0, opacity: 1.0 },
  topBanner: { xPct: 50, yPct: 7.5, scale: 1.0, opacity: 1.0 },
  killFeed: { xPct: 50, yPct: 72, scale: 1.0, opacity: 1.0 },
  ffCoins: { xPct: 74, yPct: 4.5, scale: 1.0, opacity: 1.0 },
  aliveBox: { xPct: 87.5, yPct: 4.5, scale: 1.0, opacity: 1.0 },
  settingsBtn: { xPct: 96.5, yPct: 4.5, scale: 1.0, opacity: 1.0 },
  pingBadge: { xPct: 75, yPct: 10.5, scale: 1.0, opacity: 1.0 },
  voiceCall: { xPct: 90, yPct: 10.5, scale: 1.0, opacity: 1.0 },
  weapons: { xPct: 87, yPct: 22, scale: 1.0, opacity: 1.0 },
  lootList: { xPct: 85, yPct: 38, scale: 1.0, opacity: 1.0 },
  tacticalBanner: { xPct: 50, yPct: 35, scale: 1.0, opacity: 1.0 },
  hpBar: { xPct: 49, yPct: 93, scale: 1.0, opacity: 1.0 },
  quickGlooBtn: { xPct: 68, yPct: 93, scale: 1.0, opacity: 0.95 },
  backpackBtn: { xPct: 4.2, yPct: 31, scale: 1.0, opacity: 0.95 },
  medkitBtn: { xPct: 4.2, yPct: 40.5, scale: 1.0, opacity: 0.95 },
  smallMedkitBtn: { xPct: 10.5, yPct: 40.5, scale: 1.0, opacity: 0.95 },
  grenadeBtn: { xPct: 4.2, yPct: 50, scale: 1.0, opacity: 0.95 },
  glooBtn: { xPct: 4.2, yPct: 59.5, scale: 1.0, opacity: 0.95 },
  sprintBtn: { xPct: 13.5, yPct: 58, scale: 1.0, opacity: 0.9 },
  leftFireBtn: { xPct: 20.5, yPct: 58, scale: 1.0, opacity: 0.9 },
  joystick: { xPct: 15, yPct: 76, scale: 1.0, opacity: 0.9 },
  fpsBadge: { xPct: 4.5, yPct: 96, scale: 1.0, opacity: 0.9 },
  fireBtn: { xPct: 84, yPct: 68, scale: 1.0, opacity: 0.92 },
  aimBtn: { xPct: 93, yPct: 56, scale: 1.0, opacity: 0.9 },
  vaultBtn: { xPct: 93, yPct: 29, scale: 1.0, opacity: 0.95 },
  jumpBtn: { xPct: 93, yPct: 40, scale: 1.0, opacity: 0.88 },
  crouchBtn: { xPct: 92, yPct: 81, scale: 1.0, opacity: 0.88 },
  proneBtn: { xPct: 81, yPct: 84, scale: 1.0, opacity: 0.88 },
  reloadBtn: { xPct: 73, yPct: 72, scale: 1.0, opacity: 0.88 },
  actionPrompt: { xPct: 50, yPct: 81, scale: 1.0, opacity: 1.0 },
  vehicleSteer: { xPct: 12, yPct: 90, scale: 1.0, opacity: 0.95 },
  vehiclePedals: { xPct: 88, yPct: 94, scale: 1.0, opacity: 0.95 },
};

// HUD 2: Outro Tipo (3 Dedos / Tático)
export const DEFAULT_HUD_LAYOUT_SLOT_2: HudLayoutConfig = {
  minimap: { xPct: 8, yPct: 12, scale: 0.95, opacity: 0.95 },
  teamPanel: { xPct: 24, yPct: 10, scale: 0.95, opacity: 0.95 },
  topBanner: { xPct: 50, yPct: 7.5, scale: 0.95, opacity: 0.9 },
  killFeed: { xPct: 50, yPct: 72, scale: 0.95, opacity: 0.95 },
  ffCoins: { xPct: 74, yPct: 4.5, scale: 0.95, opacity: 0.95 },
  aliveBox: { xPct: 87.5, yPct: 4.5, scale: 1.0, opacity: 1.0 },
  settingsBtn: { xPct: 96.5, yPct: 4.5, scale: 1.0, opacity: 1.0 },
  pingBadge: { xPct: 75, yPct: 10.5, scale: 0.95, opacity: 0.95 },
  voiceCall: { xPct: 90, yPct: 10.5, scale: 0.95, opacity: 0.95 },
  weapons: { xPct: 87, yPct: 22, scale: 1.0, opacity: 0.95 },
  lootList: { xPct: 85, yPct: 38, scale: 0.95, opacity: 0.95 },
  tacticalBanner: { xPct: 50, yPct: 35, scale: 0.95, opacity: 0.95 },
  hpBar: { xPct: 49, yPct: 93, scale: 0.95, opacity: 0.95 },
  quickGlooBtn: { xPct: 68, yPct: 93, scale: 1.0, opacity: 0.95 },
  backpackBtn: { xPct: 4.2, yPct: 33, scale: 0.95, opacity: 0.85 },
  medkitBtn: { xPct: 4.2, yPct: 43, scale: 0.95, opacity: 0.85 },
  smallMedkitBtn: { xPct: 10.5, yPct: 43, scale: 0.95, opacity: 0.85 },
  grenadeBtn: { xPct: 4.2, yPct: 53, scale: 0.95, opacity: 0.85 },
  glooBtn: { xPct: 72, yPct: 60, scale: 1.15, opacity: 0.95 },
  sprintBtn: { xPct: 13.5, yPct: 58, scale: 1.05, opacity: 0.85 },
  leftFireBtn: { xPct: 16, yPct: 28, scale: 1.3, opacity: 0.92 },
  joystick: { xPct: 14, yPct: 77, scale: 0.95, opacity: 0.85 },
  fpsBadge: { xPct: 4.5, yPct: 96, scale: 0.95, opacity: 0.85 },
  fireBtn: { xPct: 83, yPct: 72, scale: 1.15, opacity: 0.9 },
  aimBtn: { xPct: 86, yPct: 48, scale: 1.15, opacity: 0.92 },
  vaultBtn: { xPct: 93, yPct: 47, scale: 1.05, opacity: 0.95 },
  jumpBtn: { xPct: 93, yPct: 58, scale: 1.1, opacity: 0.9 },
  crouchBtn: { xPct: 73, yPct: 81, scale: 1.1, opacity: 0.9 },
  proneBtn: { xPct: 84, yPct: 85, scale: 0.95, opacity: 0.85 },
  reloadBtn: { xPct: 74, yPct: 42, scale: 1.0, opacity: 0.88 },
  actionPrompt: { xPct: 50, yPct: 80, scale: 1.0, opacity: 0.95 },
  vehicleSteer: { xPct: 12, yPct: 90, scale: 1.0, opacity: 0.95 },
  vehiclePedals: { xPct: 88, yPct: 94, scale: 1.0, opacity: 0.95 },
};

export type AutoLootSpeed = 'normal' | 'fast' | 'ultra';

export type KeyBindAction =
  | 'moveForward'
  | 'moveBackward'
  | 'moveLeft'
  | 'moveRight'
  | 'sprint'
  | 'jump'
  | 'crouch'
  | 'prone'
  | 'fire'
  | 'aim'
  | 'reload'
  | 'quickSwap'
  | 'cycleScope'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slot4'
  | 'interact'
  | 'gloo'
  | 'quickGlooInstant'
  | 'grenade'
  | 'medkit'
  | 'smallMedkit'
  | 'backpack'
  | 'revive'
  | 'surfboard'
  | 'minimap'
  | 'toggleMouse'
  | 'resetMouse';

export type KeyBindingsConfig = Record<KeyBindAction, string>;

export const DEFAULT_KEY_BINDINGS: KeyBindingsConfig = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  sprint: 'ShiftLeft',
  jump: 'Space',
  crouch: 'KeyC',
  prone: 'KeyZ',
  fire: 'MouseLeft',
  aim: 'MouseRight',
  reload: 'KeyR',
  quickSwap: 'KeyQ',
  cycleScope: 'KeyY',
  slot1: 'Digit1',
  slot2: 'Digit2',
  slot3: 'Digit3',
  slot4: 'Digit4',
  interact: 'KeyE',
  gloo: 'KeyG',
  quickGlooInstant: '',
  grenade: 'KeyX',
  medkit: 'KeyH',
  smallMedkit: 'Digit7',
  backpack: 'Tab',
  revive: 'KeyV',
  surfboard: 'KeyT',
  minimap: 'KeyM',
  toggleMouse: 'F1',
  resetMouse: 'F2',
};

export const EMULATOR_KEY_BINDINGS: KeyBindingsConfig = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  sprint: 'ShiftLeft',
  jump: 'Space',
  crouch: 'KeyC',
  prone: 'KeyZ',
  fire: 'MouseLeft',
  aim: 'MouseRight',
  reload: 'KeyR',
  quickSwap: 'KeyQ',
  cycleScope: 'KeyY',
  slot1: 'Digit1',
  slot2: 'Digit2',
  slot3: 'Digit3',
  slot4: 'Digit4',
  interact: 'KeyF',
  gloo: 'KeyE',
  quickGlooInstant: '',
  grenade: 'Digit5',
  medkit: 'KeyH',
  smallMedkit: 'Digit6',
  backpack: 'Tab',
  revive: 'KeyV',
  surfboard: 'KeyT',
  minimap: 'KeyM',
  toggleMouse: 'F1',
  resetMouse: 'F2',
};

export const KEY_BINDING_GROUPS: Array<{
  title: string;
  items: Array<{ action: KeyBindAction; label: string; hint?: string }>;
}> = [
  {
    title: 'EMULADOR & CONTROLE DE MOUSE',
    items: [
      {
        action: 'toggleMouse',
        label: 'Suspender / Voltar Câmera',
        hint: 'Libera o cursor do mouse para clicar e aperta de novo para voltar à câmera',
      },
      {
        action: 'resetMouse',
        label: 'Resetar / Reiniciar Mouse',
        hint: 'Desbuga a mira, zera o giro preso e reinicia a trava da câmera',
      },
    ],
  },
  {
    title: 'MOVIMENTAÇÃO & POSTURA',
    items: [
      { action: 'moveForward', label: 'Andar para Frente' },
      { action: 'moveBackward', label: 'Andar para Trás' },
      { action: 'moveLeft', label: 'Andar para Esquerda' },
      { action: 'moveRight', label: 'Andar para Direita' },
      { action: 'sprint', label: 'Correr / Sprint' },
      { action: 'jump', label: 'Pular / Avião / Paraquedas' },
      { action: 'crouch', label: 'Agachar' },
      { action: 'prone', label: 'Deitar' },
    ],
  },
  {
    title: 'COMBATE & ARMAS',
    items: [
      { action: 'fire', label: 'Atirar / Botar Gelo / Granada' },
      { action: 'aim', label: 'Mirar (Scope)' },
      { action: 'reload', label: 'Recarregar Arma' },
      { action: 'quickSwap', label: 'Troca Rápida de Arma' },
      { action: 'cycleScope', label: 'Alternar Mira (Red Dot/2x/4x)' },
      { action: 'slot1', label: 'Arma Principal 1' },
      { action: 'slot2', label: 'Arma Principal 2' },
      { action: 'slot3', label: 'Pistola (Slot 3)' },
      { action: 'slot4', label: 'Punho / Soco (Slot 4)' },
    ],
  },
  {
    title: 'LOOT, GELO & UTILITÁRIOS',
    items: [
      { action: 'interact', label: 'Pegar Loot / Lojinha / Carro' },
      { action: 'gloo', label: 'Parede de Gelo (Equipar)' },
      {
        action: 'quickGlooInstant',
        label: 'Gelo Instantâneo (1 Clique)',
        hint: 'Coloca o gelo imediatamente sem precisar clicar em atirar',
      },
      { action: 'grenade', label: 'Granada Explosiva' },
      { action: 'medkit', label: 'Usar Kit Médico' },
      { action: 'smallMedkit', label: 'Usar Kit Pequeno' },
      { action: 'revive', label: 'Salvar / Reviver Aliado' },
      { action: 'backpack', label: 'Abrir / Fechar Mochila' },
      { action: 'surfboard', label: 'Prancha na Água' },
      { action: 'minimap', label: 'Zoom do Minimapa' },
    ],
  },
];

export function formatKeyCodeLabel(code: string): string {
  if (!code) return '---';
  if (code === 'MouseLeft') return 'CLIQUE ESQ';
  if (code === 'MouseRight') return 'CLIQUE DIR';
  if (code === 'MouseMiddle') return 'M. MEIO';
  if (code === 'MouseBack') return 'M. LAT 1';
  if (code === 'MouseForward') return 'M. LAT 2';
  if (code === 'WheelUp') return 'SCROLL ↑';
  if (code === 'WheelDown') return 'SCROLL ↓';
  if (code === 'Space') return 'ESPAÇO';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT';
  if (code === 'Tab') return 'TAB';
  if (code === 'CapsLock') return 'CAPS';
  if (code === 'Backquote') return "' / ~";
  if (code === 'Enter' || code === 'NumpadEnter') return 'ENTER';
  if (code === 'Backspace') return 'BACKSPACE';
  if (code === 'ArrowUp') return 'SETA ↑';
  if (code === 'ArrowDown') return 'SETA ↓';
  if (code === 'ArrowLeft') return 'SETA ←';
  if (code === 'ArrowRight') return 'SETA →';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  return code.toUpperCase();
}

export type NetworkSyncPreset = 'ultra' | 'fast' | 'economy';

export type MacroStepAction =
  | 'crouch'
  | 'prone'
  | 'jump'
  | 'vault'
  | 'aimToggle'
  | 'aimOn'
  | 'aimOff'
  | 'fireTap'
  | 'fireHoldStart'
  | 'fireHoldEnd'
  | 'gloo'
  | 'quickGlooInstant'
  | 'grenade'
  | 'reload'
  | 'quickSwap'
  | 'cycleScope'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slot4'
  | 'interact'
  | 'medkit'
  | 'smallMedkit'
  | 'sprintOn'
  | 'sprintOff'
  | 'wait';

export interface MacroStep {
  id: string;
  action: MacroStepAction;
  delayMs: number; // delay in ms AFTER this step before the next step
}

export interface MacroConfig {
  id: string;
  name: string;
  emoji: string;
  triggerKey: string; // PC keyboard / mouse code (optional '')
  showFloatingBtn: boolean; // Android / touch / clickable button on HUD
  enabled: boolean;
  xPct: number;
  yPct: number;
  scale: number;
  opacity: number;
  steps: MacroStep[];
}

export const MACRO_ACTION_META: Record<
  MacroStepAction,
  { label: string; shortLabel: string; emoji: string }
> = {
  crouch: { label: 'Agachar / Levantar', shortLabel: 'Agachar', emoji: '🧎' },
  prone: { label: 'Deitar / Levantar', shortLabel: 'Deitar', emoji: '🛌' },
  jump: { label: 'Pular', shortLabel: 'Pular', emoji: '🦘' },
  vault: { label: 'Pular Janela', shortLabel: 'Janela', emoji: '🪟' },
  aimToggle: { label: 'Alternar Mira (Scope)', shortLabel: 'Mirar', emoji: '🎯' },
  aimOn: { label: 'Abrir Mira (Ligar)', shortLabel: 'Mira ON', emoji: '🔭' },
  aimOff: { label: 'Fechar Mira (Desligar)', shortLabel: 'Mira OFF', emoji: '👁️' },
  fireTap: { label: 'Tiro Rápido (1 Clique)', shortLabel: 'Atirar', emoji: '🔫' },
  fireHoldStart: { label: 'Segurar Tiro (Início)', shortLabel: 'Tiro ON', emoji: '🔥' },
  fireHoldEnd: { label: 'Soltar Tiro (Fim)', shortLabel: 'Tiro OFF', emoji: '✋' },
  gloo: { label: 'Equipar Parede de Gelo', shortLabel: 'Equip. Gelo', emoji: '🧱' },
  quickGlooInstant: { label: 'Tacar Gelo Instantâneo', shortLabel: 'Gelo 1-Tap', emoji: '🧊' },
  grenade: { label: 'Granada', shortLabel: 'Granada', emoji: '💣' },
  reload: { label: 'Recarregar', shortLabel: 'Recarregar', emoji: '🔄' },
  quickSwap: { label: 'Troca Rápida de Arma', shortLabel: 'Troca Rápida', emoji: '⇄' },
  cycleScope: { label: 'Alternar Scope', shortLabel: 'Scope', emoji: '🔍' },
  slot1: { label: 'Arma 1 (Slot 1)', shortLabel: 'Arma 1', emoji: '1️⃣' },
  slot2: { label: 'Arma 2 (Slot 2)', shortLabel: 'Arma 2', emoji: '2️⃣' },
  slot3: { label: 'Pistola (Slot 3)', shortLabel: 'Pistola', emoji: '3️⃣' },
  slot4: { label: 'Punho / Soco (Slot 4)', shortLabel: 'Soco', emoji: '👊' },
  interact: { label: 'Pegar Loot / Interagir', shortLabel: 'Interagir', emoji: '🖐️' },
  medkit: { label: 'Usar Kit Médico', shortLabel: 'Kit Grande', emoji: '❤️‍🩹' },
  smallMedkit: { label: 'Usar Kit Pequeno', shortLabel: 'Kit Peq.', emoji: '🩹' },
  sprintOn: { label: 'Ativar Corrida', shortLabel: 'Correr ON', emoji: '🏃' },
  sprintOff: { label: 'Parar Corrida', shortLabel: 'Correr OFF', emoji: '🛑' },
  wait: { label: 'Esperar (Pausa ms)', shortLabel: 'Esperar', emoji: '⏱️' },
};

export const MACRO_EMOJI_PALETTE: readonly string[] = [
  '🎯',
  '🧊',
  '⚡',
  '🔥',
  '👑',
  '💀',
  '🏃',
  '🛡️',
  '🔫',
  '💣',
  '❤️‍🩹',
  '😎',
  '🚀',
  '🦅',
  '🕹️',
  '🌪️',
  '❄️',
  '💥',
  '✨',
  '🎮',
  '👆',
  '🦾',
  '🐾',
  '⚙️',
];

export const DEFAULT_MACROS: MacroConfig[] = [
  {
    id: 'macro_agacha_mira_levanta',
    name: 'Agacha + Mira + Levanta',
    emoji: '🎯',
    triggerKey: '',
    showFloatingBtn: false,
    enabled: true,
    xPct: 62,
    yPct: 72,
    scale: 1.0,
    opacity: 0.92,
    steps: [
      { id: 's1', action: 'crouch', delayMs: 28 },
      { id: 's2', action: 'aimToggle', delayMs: 32 },
      { id: 's3', action: 'crouch', delayMs: 0 },
    ],
  },
  {
    id: 'macro_gelo_agachado',
    name: 'Gelo Agachado Rápido',
    emoji: '🧊',
    triggerKey: '',
    showFloatingBtn: false,
    enabled: true,
    xPct: 62,
    yPct: 84,
    scale: 1.0,
    opacity: 0.92,
    steps: [
      { id: 'g1', action: 'crouch', delayMs: 25 },
      { id: 'g2', action: 'quickGlooInstant', delayMs: 35 },
      { id: 'g3', action: 'crouch', delayMs: 0 },
    ],
  },
];

export type GgKeyPinId =
  | 'moveCluster'
  | 'lookPad'
  | 'fireBtn'
  | 'aimBtn'
  | 'jumpBtn'
  | 'crouchBtn'
  | 'proneBtn'
  | 'reloadBtn'
  | 'glooBtn'
  | 'quickGlooBtn'
  | 'grenadeBtn'
  | 'medkitBtn'
  | 'smallMedkitBtn'
  | 'backpackBtn'
  | 'interactBtn'
  | 'quickSwapBtn'
  | 'sprintBtn'
  | 'toggleMouseBtn'
  | 'resetMouseBtn'
  | 'slot1Btn'
  | 'slot2Btn'
  | 'slot3Btn'
  | 'slot4Btn';

export interface GgOverlayPinConfig {
  xPct: number;
  yPct: number;
  scale: number;
  visible: boolean;
}

export interface GgMouseProConfig {
  enabled: boolean;
  showKeyBadges: boolean;
  badgeOpacity: number;
  aimDragBoost: number; // 0.6 .. 2.2
  turboTouch: boolean; // Zero-delay instant click/touch
  instantQuickGloo: boolean; // 1-tap instant gloo on quickGlooBtn
  pins: Record<GgKeyPinId, GgOverlayPinConfig>;
}

export const GG_PIN_META: Record<
  GgKeyPinId,
  { label: string; kind: 'wasd' | 'look' | 'key'; action?: KeyBindAction; badgeText?: string }
> = {
  moveCluster: { label: 'Direcional WASD', kind: 'wasd' },
  lookPad: { label: 'Pino Câmera / Mira (Mouse)', kind: 'look' },
  fireBtn: { label: 'Atirar', kind: 'key', action: 'fire' },
  aimBtn: { label: 'Mirar (Scope)', kind: 'key', action: 'aim' },
  jumpBtn: { label: 'Pular / Janela', kind: 'key', action: 'jump' },
  crouchBtn: { label: 'Agachar', kind: 'key', action: 'crouch' },
  proneBtn: { label: 'Deitar', kind: 'key', action: 'prone' },
  reloadBtn: { label: 'Recarregar', kind: 'key', action: 'reload' },
  glooBtn: { label: 'Equipar Gelo', kind: 'key', action: 'gloo' },
  quickGlooBtn: { label: 'Gelo Rápido 1-Clique', kind: 'key', action: 'quickGlooInstant' },
  grenadeBtn: { label: 'Granada', kind: 'key', action: 'grenade' },
  medkitBtn: { label: 'Kit Médico', kind: 'key', action: 'medkit' },
  smallMedkitBtn: { label: 'Kit Pequeno', kind: 'key', action: 'smallMedkit' },
  backpackBtn: { label: 'Mochila', kind: 'key', action: 'backpack' },
  interactBtn: { label: 'Loot / Interagir', kind: 'key', action: 'interact' },
  quickSwapBtn: { label: 'Troca Rápida', kind: 'key', action: 'quickSwap' },
  sprintBtn: { label: 'Correr', kind: 'key', action: 'sprint' },
  toggleMouseBtn: { label: 'Suspender Mouse (Seta)', kind: 'key', action: 'toggleMouse' },
  resetMouseBtn: { label: 'Resetar Mouse', kind: 'key', action: 'resetMouse' },
  slot1Btn: { label: 'Arma 1', kind: 'key', action: 'slot1' },
  slot2Btn: { label: 'Arma 2', kind: 'key', action: 'slot2' },
  slot3Btn: { label: 'Pistola', kind: 'key', action: 'slot3' },
  slot4Btn: { label: 'Soco / Punho', kind: 'key', action: 'slot4' },
};

export const DEFAULT_GG_MOUSE_PRO: GgMouseProConfig = {
  enabled: false,
  showKeyBadges: true,
  badgeOpacity: 0.85,
  aimDragBoost: 1.15,
  turboTouch: true,
  instantQuickGloo: true,
  pins: {
    moveCluster: { xPct: 15, yPct: 76, scale: 1.0, visible: true },
    lookPad: { xPct: 58, yPct: 48, scale: 1.0, visible: true },
    fireBtn: { xPct: 84, yPct: 68, scale: 1.0, visible: true },
    aimBtn: { xPct: 93, yPct: 56, scale: 1.0, visible: true },
    jumpBtn: { xPct: 93, yPct: 40, scale: 1.0, visible: true },
    crouchBtn: { xPct: 92, yPct: 81, scale: 1.0, visible: true },
    proneBtn: { xPct: 81, yPct: 84, scale: 1.0, visible: true },
    reloadBtn: { xPct: 73, yPct: 72, scale: 1.0, visible: true },
    glooBtn: { xPct: 4.2, yPct: 59.5, scale: 1.0, visible: true },
    quickGlooBtn: { xPct: 68, yPct: 93, scale: 1.0, visible: true },
    grenadeBtn: { xPct: 4.2, yPct: 50, scale: 1.0, visible: true },
    medkitBtn: { xPct: 4.2, yPct: 40.5, scale: 1.0, visible: true },
    smallMedkitBtn: { xPct: 10.5, yPct: 40.5, scale: 1.0, visible: true },
    backpackBtn: { xPct: 4.2, yPct: 31, scale: 1.0, visible: true },
    interactBtn: { xPct: 78, yPct: 38, scale: 1.0, visible: true },
    quickSwapBtn: { xPct: 77, yPct: 28, scale: 1.0, visible: true },
    sprintBtn: { xPct: 13.5, yPct: 58, scale: 1.0, visible: true },
    toggleMouseBtn: { xPct: 42, yPct: 12, scale: 0.95, visible: true },
    resetMouseBtn: { xPct: 56, yPct: 12, scale: 0.95, visible: false },
    slot1Btn: { xPct: 82, yPct: 22, scale: 0.9, visible: true },
    slot2Btn: { xPct: 87, yPct: 22, scale: 0.9, visible: true },
    slot3Btn: { xPct: 92, yPct: 22, scale: 0.9, visible: true },
    slot4Btn: { xPct: 94, yPct: 16, scale: 0.9, visible: false },
  },
};

export interface GameSettings {
  sensitivity: number; // 0.2 .. 2.5 (Geral)
  redDotSensitivity: number; // 0.2 .. 2.5 (1x / Red Dot)
  scope2xSensitivity: number; // 0.2 .. 2.5 (2x)
  scope4xSensitivity: number; // 0.2 .. 2.5 (4x)
  sniperSensitivity: number; // 0.2 .. 2.5 (AWM Sniper)
  aimAssistMode: AimAssistMode; // 'default' = Mira Gruda, 'precise' = Livre
  quality: GraphicsQuality;
  resolutionScale?: number; // 1 .. 100 (%)
  textureQuality?: TextureQuality;
  shadowQuality?: ShadowQuality;
  soundVolume: number; // 0 .. 1
  muted: boolean;
  showFps: boolean;
  controlMode: ControlMode;
  invertY: boolean;
  autoLoot: boolean;
  autoLootSpeed: AutoLootSpeed;
  emulatorMode?: boolean;
  aimToggleMode?: boolean;
  networkSyncPreset?: NetworkSyncPreset;
  networkLowLatency?: boolean;
  networkHighPingSmoothing?: boolean;
  keyBindings?: KeyBindingsConfig;
  macros?: MacroConfig[];
  ggMousePro?: GgMouseProConfig;
  hudLayout: HudLayoutConfig;
  activeHudSlot?: HudSlotId;
  hudSlots?: Record<HudSlotId, HudLayoutConfig>;
}

export interface PlayerProfile {
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
  avatarId?: PlayerAvatarId;
  unlockedAvatars?: PlayerAvatarId[];
  seasonId?: string;
  s1PeakRankPoints?: number;
  s1ClaimedRewards?: string[];
}

export const CURRENT_RANKED_SEASON = 'S1';
export const CURRENT_RANKED_SEASON_LABEL = 'TEMPORADA 1 · S1';
export const MESTRE_MIN_PTS = 3100;

export interface SeasonRewardTier {
  id: string;
  tierName: string;
  minPts: number;
  goldReward: number;
  gemsReward?: number;
  avatarIds?: PlayerAvatarId[];
  badgeLabel: string;
}

export const SEASON_1_REWARDS: readonly SeasonRewardTier[] = [
  {
    id: 's1_bronze_2',
    tierName: 'Bronze II',
    minPts: 150,
    goldReward: 150,
    badgeLabel: 'Iniciante S1',
  },
  {
    id: 's1_prata_1',
    tierName: 'Prata I',
    minPts: 450,
    goldReward: 300,
    badgeLabel: 'Sobrevivente de Prata',
  },
  {
    id: 's1_ouro_1',
    tierName: 'Ouro I',
    minPts: 900,
    goldReward: 500,
    badgeLabel: 'Guerreiro de Ouro',
  },
  {
    id: 's1_platina_1',
    tierName: 'Platina I',
    minPts: 1600,
    goldReward: 800,
    gemsReward: 15,
    badgeLabel: 'Elite de Platina',
  },
  {
    id: 's1_diamante_1',
    tierName: 'Diamante I',
    minPts: 2300,
    goldReward: 1200,
    gemsReward: 30,
    badgeLabel: 'Lenda de Diamante',
  },
  {
    id: 's1_mestre',
    tierName: 'Mestre',
    minPts: MESTRE_MIN_PTS,
    goldReward: 2500,
    gemsReward: 50,
    avatarIds: ['angelic', 'eagle_eye'],
    badgeLabel: 'Mestre Temporada S1',
  },
];

export type RankTierId =
  | 'bronze'
  | 'prata'
  | 'ouro'
  | 'platina'
  | 'diamante'
  | 'mestre';

export interface RankTierInfo {
  id: RankTierId;
  name: string;
  sub: string;
  iconUrl: string;
  minPts: number;
  nextPts: number | null;
  color: string;
  accent: string;
}

const PATENTE_ICON_BASE = 'https://kalidade-br.github.io/freefire-2017/patentes';

export const RANK_LADDER: RankTierInfo[] = [
  { id: 'bronze', name: 'Bronze I', sub: 'Divisão I', iconUrl: `${PATENTE_ICON_BASE}/bronze-1.png`, minPts: 0, nextPts: 150, color: '#92400e', accent: '#d97706' },
  { id: 'bronze', name: 'Bronze II', sub: 'Divisão II', iconUrl: `${PATENTE_ICON_BASE}/bronze-2.png`, minPts: 150, nextPts: 300, color: '#92400e', accent: '#f59e0b' },
  { id: 'bronze', name: 'Bronze III', sub: 'Divisão III', iconUrl: `${PATENTE_ICON_BASE}/bronze-3.png`, minPts: 300, nextPts: 450, color: '#78350f', accent: '#fbbf24' },
  { id: 'prata', name: 'Prata I', sub: 'Divisão I', iconUrl: `${PATENTE_ICON_BASE}/prata-1.png`, minPts: 450, nextPts: 600, color: '#64748b', accent: '#cbd5e1' },
  { id: 'prata', name: 'Prata II', sub: 'Divisão II', iconUrl: `${PATENTE_ICON_BASE}/prata-2.png`, minPts: 600, nextPts: 750, color: '#475569', accent: '#e2e8f0' },
  { id: 'prata', name: 'Prata III', sub: 'Divisão III', iconUrl: `${PATENTE_ICON_BASE}/prata-3.png`, minPts: 750, nextPts: 900, color: '#334155', accent: '#f8fafc' },
  { id: 'ouro', name: 'Ouro I', sub: 'Divisão I', iconUrl: `${PATENTE_ICON_BASE}/ouro-1.png`, minPts: 900, nextPts: 1075, color: '#ca8a04', accent: '#fde047' },
  { id: 'ouro', name: 'Ouro II', sub: 'Divisão II', iconUrl: `${PATENTE_ICON_BASE}/ouro-2.png`, minPts: 1075, nextPts: 1250, color: '#ca8a04', accent: '#facc15' },
  { id: 'ouro', name: 'Ouro III', sub: 'Divisão III', iconUrl: `${PATENTE_ICON_BASE}/ouro-3.png`, minPts: 1250, nextPts: 1425, color: '#a16207', accent: '#fef08a' },
  { id: 'ouro', name: 'Ouro IV', sub: 'Divisão IV', iconUrl: `${PATENTE_ICON_BASE}/ouro-4.png`, minPts: 1425, nextPts: 1600, color: '#854d0e', accent: '#fde047' },
  { id: 'platina', name: 'Platina I', sub: 'Divisão I', iconUrl: `${PATENTE_ICON_BASE}/platina-1.png`, minPts: 1600, nextPts: 1775, color: '#0284c7', accent: '#38bdf8' },
  { id: 'platina', name: 'Platina II', sub: 'Divisão II', iconUrl: `${PATENTE_ICON_BASE}/platina-2.png`, minPts: 1775, nextPts: 1950, color: '#0369a1', accent: '#7dd3fc' },
  { id: 'platina', name: 'Platina III', sub: 'Divisão III', iconUrl: `${PATENTE_ICON_BASE}/platina-3.png`, minPts: 1950, nextPts: 2125, color: '#075985', accent: '#bae6fd' },
  { id: 'platina', name: 'Platina IV', sub: 'Divisão IV', iconUrl: `${PATENTE_ICON_BASE}/platina-4.png`, minPts: 2125, nextPts: 2300, color: '#0c4a6e', accent: '#e0f2fe' },
  { id: 'diamante', name: 'Diamante I', sub: 'Divisão I', iconUrl: `${PATENTE_ICON_BASE}/diamante-1.png`, minPts: 2300, nextPts: 2500, color: '#7c3aed', accent: '#c4b5fd' },
  { id: 'diamante', name: 'Diamante II', sub: 'Divisão II', iconUrl: `${PATENTE_ICON_BASE}/diamante-2.png`, minPts: 2500, nextPts: 2700, color: '#6d28d9', accent: '#ddd6fe' },
  { id: 'diamante', name: 'Diamante III', sub: 'Divisão III', iconUrl: `${PATENTE_ICON_BASE}/diamante-3.png`, minPts: 2700, nextPts: 2900, color: '#5b21b6', accent: '#ede9fe' },
  { id: 'diamante', name: 'Diamante IV', sub: 'Divisão IV', iconUrl: `${PATENTE_ICON_BASE}/diamante-4.png`, minPts: 2900, nextPts: 3100, color: '#4c1d95', accent: '#f5f3ff' },
  { id: 'mestre', name: 'Mestre', sub: 'Patente Máxima', iconUrl: `${PATENTE_ICON_BASE}/mestre.png`, minPts: 3100, nextPts: null, color: '#dc2626', accent: '#fde047' },
];

export function getRankInfo(points: number): RankTierInfo {
  const safePts = Math.max(0, Math.round(points));
  let matched = RANK_LADDER[0];
  for (let i = 0; i < RANK_LADDER.length; i++) {
    if (safePts >= RANK_LADDER[i].minPts) {
      matched = RANK_LADDER[i];
    }
  }
  return matched;
}

export function computeRankedPointDelta(params: {
  isWin: boolean;
  placement: number;
  kills: number;
  damageDealt: number;
  currentPoints: number;
}): number {
  const { isWin, placement, kills, damageDealt, currentPoints } = params;
  let delta = 0;
  if (isWin || placement <= 1) {
    delta = 46;
  } else if (placement <= 3) {
    delta = 30;
  } else if (placement <= 8) {
    delta = 18;
  } else if (placement <= 16) {
    delta = 8;
  } else if (placement <= 28) {
    delta = -6;
  } else {
    delta = -18;
  }
  delta += Math.min(26, kills * 5);
  delta += Math.min(8, Math.floor(damageDealt / 220));
  if (currentPoints >= 2500 && delta < 0) {
    delta -= 6;
  }
  return delta;
}

export interface DamagePopup {
  id: number;
  amount: number;
  isHeadshot: boolean;
  armorBlocked: number; // 0..3 vest/helmet level that mitigated part of damage
  xPct: number;
  yPct: number;
  age: number; // 0 .. 0.75s
}

export interface KillFeedEntry {
  id: number;
  killerName: string;
  victimName: string;
  weaponShort: string;
  isHeadshot: boolean;
  isPlayerKiller: boolean;
  age: number; // 0 .. 4.2s
}

export interface CombatIconPopup {
  id: number;
  kind: 'knockdown' | 'kill';
  victimName: string;
  weaponShort: string;
  isHeadshot: boolean;
  age: number; // 0 .. 2.2s
}

export interface DamageIndicator {
  id: number;
  angleRad: number; // relative to player's look direction: 0 = front, +PI/2 = right, PI = behind
  age: number; // 0 .. 1.45s
}

export interface SafeZoneHudState {
  phase: number;
  totalPhases: number;
  isShrinking: boolean;
  timerSec: number;
  currentX: number;
  currentZ: number;
  currentRadius: number;
  nextX: number;
  nextZ: number;
  nextRadius: number;
  damagePerSec: number;
  playerOutside: boolean;
}

export interface BackpackItem {
  id: string;
  kind: 'medkit' | 'ammo' | 'scope' | 'attachment';
  label: string;
  quantity: number;
  scopeType?: ScopeType;
  attachmentKind?: AttachmentKind;
}

export interface NearbyLootSlot {
  id: string;
  kind: LootItem['kind'] | 'airdrop';
  label: string;
  subLabel?: string;
  weaponId?: WeaponId;
  scopeType?: ScopeType;
  attachmentKind?: AttachmentKind;
  level?: 1 | 2 | 3;
  count?: number;
  deathBoxId?: string;
  boxOwnerNick?: string;
}

export interface VendingShopOffer {
  id: string;
  label: string;
  sub: string;
  cost: number;
  category: 'gear' | 'weapon' | 'utility';
  weaponId?: WeaponId;
}

export const VENDING_SHOP_OFFERS: VendingShopOffer[] = [
  { id: 'medkit', label: 'Kit Médico', sub: '+75 HP', cost: 100, category: 'utility' },
  { id: 'gloo2', label: 'Parede de Gelo x2', sub: 'Cobertura', cost: 150, category: 'utility' },
  { id: 'grenade2', label: 'Granada x2', sub: 'Explosivo', cost: 150, category: 'utility' },
  { id: 'ammo60', label: 'Munição +60', sub: 'Arma Ativa', cost: 100, category: 'utility' },
  { id: 'vest2', label: 'Colete Nível 2', sub: '160 Blindagem', cost: 250, category: 'gear' },
  { id: 'vest3', label: 'Colete Nível 3', sub: '220 Blindagem', cost: 450, category: 'gear' },
  { id: 'helmet3', label: 'Capacete Nível 3', sub: '180 Proteção', cost: 400, category: 'gear' },
  { id: 'scope4x', label: 'Mira 4x', sub: 'Zoom Tático', cost: 250, category: 'gear' },
  { id: 'deagle', label: 'Desert Eagle', sub: 'Pistola Pesada', cost: 200, category: 'weapon', weaponId: 'deagle' },
  { id: 'ump45', label: 'SMG UMP-17', sub: 'Curto/Médio', cost: 300, category: 'weapon', weaponId: 'ump45' },
  { id: 'm4a1', label: 'Carabina M4-17', sub: 'Rifle Assalto', cost: 350, category: 'weapon', weaponId: 'm4a1' },
  { id: 'scar', label: 'Rifle SCAR', sub: 'Estabilidade', cost: 380, category: 'weapon', weaponId: 'scar' },
  { id: 'ak47', label: 'Fuzil AK-47', sub: 'Alto Impacto', cost: 400, category: 'weapon', weaponId: 'ak47' },
  { id: 'xm8', label: 'Fuzil XM8', sub: 'Precisão Tática', cost: 420, category: 'weapon', weaponId: 'xm8' },
  { id: 'awm', label: 'Sniper AWM-17', sub: 'Alto Dano', cost: 700, category: 'weapon', weaponId: 'awm' },
];

export type VehicleKind = 'jeep' | 'sport';

export interface VehicleHudState {
  id: string;
  kind: VehicleKind;
  name: string;
  hp: number;
  maxHp: number;
  speedKmh: number;
  isBurning: boolean;
  passengerCount: number;
  isDriver?: boolean;
}

export type WeaponSlotId = 1 | 2 | 3 | 4; // 4 = Punho (Soco)

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  vestLevel: 0 | 1 | 2 | 3;
  vestHp: number;
  vestMaxHp: number;
  helmetLevel: 0 | 1 | 2 | 3;
  helmetHp: number;
  helmetMaxHp: number;
  backpackLevel: 1 | 2 | 3;
  backpackUsed: number;
  backpackCapacity: number;
  medkitCount: number;
  smallkitCount: number;
  glooCount: number;
  grenadeCount: number;
  ffCoins: number;
  isRanked: boolean;
  isPlacingGloo: boolean;
  glooSkin: GlooSkinId;
  glooPlaceDistance: number;
  isHoldingGrenade: boolean;
  usingMedkit: boolean;
  medkitProgress: number; // 0..1
  stance: PlayerStance;
  isSprinting: boolean;
  isAiming: boolean;
  isGrounded: boolean;
  inWater: boolean;
  isSwimming: boolean;
  isOnSurfboard: boolean;
  isReloading: boolean;
  reloadProgress: number; // 0..1
  isDead: boolean;
  isPlayerDowned: boolean;
  playerBleedHp: number;
  activeSlot: WeaponSlotId;
  activeScope: ScopeType;
  ownedScopes: ScopeType[];
  weapons: Record<1 | 2 | 3, WeaponSlotState | null>;
  backpackItems: BackpackItem[];
  yawDeg: number; // 0..360 compass heading
  playerX: number;
  playerZ: number;
  playerY: number;
  altitude: number;
  aliveCount: number;
  kills: number;
  damageDealt: number;
  healingDone: number;
  headshotKills: number;
  matchSurvivalSec: number;
  totalMatchPlayers: number;
  weaponDamageStats: Array<{ weaponId: WeaponId; name: string; damage: number }>;
  zoneTimerSec: number;
  safeZone: SafeZoneHudState;
  waitingTimerSec: number;
  matchmakingCount: number;
  canJumpFromPlane: boolean;
  canOpenParachute: boolean;
  canVaultWindow: boolean;
  nearbyLootLabel: string | null;
  nearbyLoots: NearbyLootSlot[];
  nearbyVending: { id: string; label: string } | null;
  nearbyVehicle: { id: string; name: string; kind: VehicleKind; hp: number; maxHp: number } | null;
  inVehicle: VehicleHudState | null;
  vendingLocations: Array<{ x: number; z: number }>;
  vehicleLocations: Array<{ x: number; z: number; kind: VehicleKind; destroyed: boolean }>;
  hitmarkerActive: boolean;
  headshotFlashActive: boolean;
  aimLockedTarget: boolean;
  aimAssistActive: boolean;
  damageFlashActive: boolean;
  damagePopups: DamagePopup[];
  damageIndicators: DamageIndicator[];
  killFeed: KillFeedEntry[];
  combatIconPopup: CombatIconPopup | null;
  fps: number;
  drawCalls: number;
  triangles: number;
  pointerLocked: boolean;
  mouseSuspended: boolean;
  mouseResetNotice: boolean;
  currentPoi: string | null;
  matchMode: MatchMode;
  gameVariant: GameVariant;
  mapId: BrMapId;
  gladiadores?: {
    format: GladiadoresFormat;
    round: number;
    targetRounds: number;
    playerScore: number;
    enemyScore: number;
    playerTeamAlive: number;
    enemyTeamAlive: number;
    phase: 'intro' | 'fight' | 'round_end';
    phaseTimerSec: number;
    banner: string | null;
  };
  reviveTarget: {
    id: string;
    slotNumber: number;
    nick: string;
    bleedHp: number;
  } | null;
  reviveProgress: number; // 0..1
  revivedBy: {
    slotNumber: number;
    nick: string;
    progress: number;
  } | null;
  teamMembers: Array<{
    id: string;
    slotNumber: number;
    nick: string;
    hp: number;
    maxHp: number;
    isDowned: boolean;
    eliminated: boolean;
    kills?: number;
    damageDealt?: number;
    healingDone?: number;
    survivalSec?: number;
    modelId?: CharacterModelId;
    distance?: number;
    onScreen?: boolean;
    screenXPct?: number;
    screenYPct?: number;
    offscreenAngleRad?: number;
    worldX?: number;
    worldZ?: number;
  }>;
  airDrops: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
    state: 'falling' | 'landed' | 'looted';
    distance: number;
  }>;
  airDropNotice: string | null;
  stanceNotice: string | null;
  isOnlineMatch?: boolean;
  autoFillBots?: boolean;
  pingMs: number;
  isNetworkDisconnected: boolean;
  showFollowLeaderToggle?: boolean;
  isFollowingLeader?: boolean;
  leaderNick?: string | null;
  isSpectating?: boolean;
  playerPlacement?: number;
  spectatorCount: number;
  matchVisualLikes: number;
  likeToast: { id: number; nick: string } | null;
  spectatingTarget?: {
    targetKey: string;
    isBot?: boolean;
    accountId: number;
    publicId: string;
    nick: string;
    level: number;
    rankPoints: number;
    modelId: CharacterModelId;
    hp: number;
    maxHp: number;
    kills: number;
    slotNumber: number;
    teamLabel?: string;
    isFriend?: boolean;
    canCycle: boolean;
    spectatorCount: number;
    likedByMe?: boolean;
    isAiming?: boolean;
  } | null;
}

export interface WorldBoxCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  tag?: string;
}

export interface WorldObbCollider {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
  minY: number;
  maxY: number;
  tag?: string;
}

export interface WalkablePlatform {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
  topY: number;
  minY: number;
  slopeAxis?: 'x' | 'z';
  topYNeg?: number;
  topYPos?: number;
}

export interface BuildingDoorway {
  inX: number;
  inZ: number;
  outX: number;
  outZ: number;
}

export interface BuildingNavBox {
  lx: number;
  lz: number;
  halfW: number;
  halfD: number;
}

export interface BuildingNavZone {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
  baseY: number;
  extraBoxes?: BuildingNavBox[];
  hub?: { x: number; z: number };
  secondFloorY?: number;
  stairBottom?: { x: number; z: number };
  stairTop?: { x: number; z: number };
  doors: BuildingDoorway[];
}

export interface PoiMarker {
  name: string;
  x: number;
  z: number;
  radius: number;
}

export interface MinimapBuilding {
  x: number;
  z: number;
  w: number;
  d: number;
  rotY: number;
  kind:
    | 'house'
    | 'casaL'
    | 'casaGod'
    | 'celeiro'
    | 'sobrado'
    | 'guarita'
    | 'shed'
    | 'container'
    | 'tower'
    | 'bridge';
}

export interface MinimapRoad {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  kind?: 'dirt' | 'asphalt';
}

export interface DeathBoxItemEntry {
  id: string;
  kind: Exclude<LootItem['kind'], 'deathbox'>;
  label: string;
  subLabel?: string;
  weaponId?: WeaponId;
  scopeType?: ScopeType;
  attachmentKind?: AttachmentKind;
  level?: 1 | 2 | 3;
  ammoAmount?: number;
  glooAmount?: number;
  grenadeAmount?: number;
  coinAmount?: number;
  medkitAmount?: number;
  smallkitAmount?: number;
  collected?: boolean;
}

export interface LootItem {
  id: string;
  x: number;
  y: number;
  z: number;
  kind:
    | 'ammo'
    | 'medkit'
    | 'smallkit'
    | 'weapon'
    | 'scope'
    | 'vest'
    | 'helmet'
    | 'backpack'
    | 'attachment'
    | 'gloo'
    | 'grenade'
    | 'coin'
    | 'deathbox';
  weaponId?: WeaponId;
  scopeType?: ScopeType;
  attachmentKind?: AttachmentKind;
  level?: 1 | 2 | 3;
  ammoAmount?: number;
  glooAmount?: number;
  grenadeAmount?: number;
  coinAmount?: number;
  deathOwnerNick?: string;
  deathEntries?: DeathBoxItemEntry[];
  deathLoot?: {
    medkits: number;
    gloos: number;
    grenades: number;
    ammo: number;
    coins?: number;
    vestLevel: 0 | 1 | 2 | 3;
    helmetLevel: 0 | 1 | 2 | 3;
    weaponId?: WeaponId;
  };
  label: string;
  collected: boolean;
}

export const ATTACHMENT_LABELS: Record<AttachmentKind, { name: string; short: string; slot: AttachmentSlotKey; bonus: string }> = {
  silencer: { name: 'Silenciador', short: 'SILENC', slot: 'muzzle', bonus: 'Disparo silencioso + alcance' },
  compensator: { name: 'Boca / Compensador', short: 'BOCA', slot: 'muzzle', bonus: '-30% dispersão' },
  grip: { name: 'Empunhadura Tática', short: 'GRIP', slot: 'foregrip', bonus: 'Precisão e firmeza' },
  ext_mag: { name: 'Carregador Estendido', short: 'CARR+', slot: 'magazine', bonus: '+35% balas e recarga rápida' },
  stock: { name: 'Coronha Tática', short: 'CORONHA', slot: 'stock', bonus: 'Mobilidade ao mirar' },
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  g18: {
    id: 'g18',
    slot: 3,
    name: 'PISTOLA GLOCK G18',
    shortName: 'G18',
    category: 'HG',
    damage: 19,
    fireRateMs: 112,
    magSize: 15,
    reloadTimeSec: 0.28,
    range: 75,
    spread: 0.0045,
    pellets: 1,
    automatic: true,
    defaultScope: 'none',
    allowsCustomScope: false,
    allowsAttachments: true,
    supportsAimAssist: true,
    moveSpeedMult: 1.04,
  },
  deagle: {
    id: 'deagle',
    slot: 3,
    name: 'DESERT EAGLE',
    shortName: 'D. EAGLE',
    category: 'HG',
    damage: 76,
    fireRateMs: 365,
    magSize: 7,
    reloadTimeSec: 0.34,
    range: 120,
    spread: 0.0022,
    pellets: 1,
    automatic: false,
    defaultScope: 'none',
    allowsCustomScope: false,
    allowsAttachments: true,
    supportsAimAssist: true,
    moveSpeedMult: 1.03,
  },
  m4a1: {
    id: 'm4a1',
    slot: 1,
    name: 'CARABINA M4-17',
    shortName: 'M4-17',
    category: 'AR',
    damage: 30,
    fireRateMs: 115,
    magSize: 30,
    reloadTimeSec: 0.36,
    range: 215,
    spread: 0.002,
    pellets: 1,
    automatic: true,
    defaultScope: 'none',
    allowsCustomScope: true,
    allowsAttachments: true,
    supportsAimAssist: true,
    moveSpeedMult: 0.96,
  },
  xm8: {
    id: 'xm8',
    slot: 1,
    name: 'FUZIL XM8',
    shortName: 'XM8',
    category: 'AR',
    damage: 33,
    fireRateMs: 102,
    magSize: 28,
    reloadTimeSec: 0.35,
    range: 230,
    spread: 0.0015,
    pellets: 1,
    automatic: true,
    defaultScope: 'none',
    allowsCustomScope: true,
    allowsAttachments: true,
    supportsAimAssist: true,
    moveSpeedMult: 0.98,
  },
  scar: {
    id: 'scar',
    slot: 1,
    name: 'RIFLE SCAR',
    shortName: 'SCAR',
    category: 'AR',
    damage: 31,
    fireRateMs: 110,
    magSize: 30,
    reloadTimeSec: 0.35,
    range: 225,
    spread: 0.0018,
    pellets: 1,
    automatic: true,
    defaultScope: 'none',
    allowsCustomScope: true,
    allowsAttachments: true,
    supportsAimAssist: true,
    moveSpeedMult: 0.97,
  },
  ak47: {
    id: 'ak47',
    slot: 1,
    name: 'FUZIL AK-47',
    shortName: 'AK-47',
    category: 'AR',
    damage: 38,
    fireRateMs: 126,
    magSize: 30,
    reloadTimeSec: 0.38,
    range: 220,
    spread: 0.0026,
    pellets: 1,
    automatic: true,
    defaultScope: 'none',
    allowsCustomScope: true,
    allowsAttachments: true,
    supportsAimAssist: true,
    moveSpeedMult: 0.94,
  },
  ump45: {
    id: 'ump45',
    slot: 2,
    name: 'SUBMETRALHADORA UMP-17',
    shortName: 'UMP-17',
    category: 'SMG',
    damage: 24,
    fireRateMs: 84,
    magSize: 32,
    reloadTimeSec: 0.32,
    range: 132,
    spread: 0.003,
    pellets: 1,
    automatic: true,
    defaultScope: 'none',
    allowsCustomScope: true,
    allowsAttachments: true,
    supportsAimAssist: true,
    moveSpeedMult: 1.0,
  },
  m1014: {
    id: 'm1014',
    slot: 1,
    name: 'ESPINGARDA M10-17',
    shortName: 'M10-17',
    category: 'SG',
    damage: 31,
    fireRateMs: 410,
    magSize: 6,
    reloadTimeSec: 0.42,
    range: 48,
    spread: 0.056,
    pellets: 8,
    automatic: true,
    defaultScope: 'none',
    allowsCustomScope: false,
    allowsAttachments: false,
    supportsAimAssist: true,
    moveSpeedMult: 0.97,
  },
  awm: {
    id: 'awm',
    slot: 1,
    name: 'RIFLE SNIPER AWM-17',
    shortName: 'AWM-17',
    category: 'SR',
    damage: 155,
    fireRateMs: 1220,
    magSize: 5,
    reloadTimeSec: 0.8,
    range: 390,
    spread: 0,
    pellets: 1,
    automatic: false,
    defaultScope: 'sniper',
    allowsCustomScope: false,
    allowsAttachments: true,
    supportsAimAssist: false,
    moveSpeedMult: 0.9,
  },
};

export const CHARACTER_PRESETS: CharacterConfig[] = [
  {
    id: 'ff_adam_classic',
    name: 'ADAM',
    modelId: 'adam',
    glooSkin: 'classic',
    skinColor: '#d7a27e',
    hairStyle: 'buzz',
    hairColor: '#2a201b',
    shirtStyle: 'tank',
    shirtColor: '#f1f0ea',
    pantsColor: '#c9b396',
    vestEnabled: false,
    vestColor: '#4c593c',
    backpackEnabled: true,
    shoesColor: '#252629',
  },
  {
    id: 'ff_eva_classic',
    name: 'EVA',
    modelId: 'eva',
    glooSkin: 'classic',
    skinColor: '#e2b291',
    hairStyle: 'spiky',
    hairColor: '#2a201b',
    shirtStyle: 'tank',
    shirtColor: '#384635',
    pantsColor: '#2c333f',
    vestEnabled: false,
    vestColor: '#3f4739',
    backpackEnabled: true,
    shoesColor: '#30343a',
  },
  {
    id: 'ff_maxim_classic',
    name: 'MAXIM',
    modelId: 'maxim',
    glooSkin: 'classic',
    skinColor: '#e2b695',
    hairStyle: 'cap',
    hairColor: '#c7ccd4',
    shirtStyle: 'hoodie',
    shirtColor: '#8b1e24',
    pantsColor: '#252830',
    vestEnabled: false,
    vestColor: '#3f4739',
    backpackEnabled: true,
    shoesColor: '#22242a',
  },
  {
    id: 'ff_kelly_classic',
    name: 'KELLY',
    modelId: 'kelly',
    glooSkin: 'classic',
    skinColor: '#e8bea0',
    hairStyle: 'spiky',
    hairColor: '#291c18',
    shirtStyle: 'hoodie',
    shirtColor: '#facc15',
    pantsColor: '#1f2937',
    vestEnabled: false,
    vestColor: '#3f4739',
    backpackEnabled: true,
    shoesColor: '#eab308',
  },
];

export function getCharacterPresetByModelId(raw?: string | null): CharacterConfig {
  const id = normalizeCharacterModelId(raw);
  return CHARACTER_PRESETS.find((p) => p.modelId === id) ?? CHARACTER_PRESETS[0];
}

