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

export type CharacterModelId = 'adam' | 'eva';
export type GlooSkinId = 'classic' | 'ffwc';

export interface CharacterConfig {
  id: string;
  name: string;
  modelId?: CharacterModelId;
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
export type BrMapId = 'bermuda' | 'joao_pessoa';
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
  killFeed: { xPct: 50, yPct: 17.5, scale: 1.0, opacity: 1.0 },
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
  killFeed: { xPct: 50, yPct: 17.5, scale: 0.95, opacity: 0.95 },
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
      { action: 'gloo', label: 'Parede de Gelo' },
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

export interface GameSettings {
  sensitivity: number; // 0.2 .. 2.5 (Geral)
  redDotSensitivity: number; // 0.2 .. 2.5 (1x / Red Dot)
  scope2xSensitivity: number; // 0.2 .. 2.5 (2x)
  scope4xSensitivity: number; // 0.2 .. 2.5 (4x)
  sniperSensitivity: number; // 0.2 .. 2.5 (AWM Sniper)
  aimAssistMode: AimAssistMode; // 'default' = Mira Gruda, 'precise' = Livre
  quality: GraphicsQuality;
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
  keyBindings?: KeyBindingsConfig;
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
}

export type RankTierId =
  | 'bronze'
  | 'prata'
  | 'ouro'
  | 'platina'
  | 'diamante'
  | 'mestre'
  | 'desafiante';

export interface RankTierInfo {
  id: RankTierId;
  name: string;
  sub: string;
  minPts: number;
  nextPts: number | null;
  color: string;
  accent: string;
}

export const RANK_LADDER: RankTierInfo[] = [
  { id: 'bronze', name: 'Bronze I', sub: 'Recruta', minPts: 0, nextPts: 300, color: '#a16207', accent: '#d97706' },
  { id: 'bronze', name: 'Bronze II', sub: 'Sobrevivente', minPts: 300, nextPts: 550, color: '#a16207', accent: '#f59e0b' },
  { id: 'prata', name: 'Prata I', sub: 'Tático', minPts: 550, nextPts: 800, color: '#64748b', accent: '#cbd5e1' },
  { id: 'prata', name: 'Prata II', sub: 'Atirador', minPts: 800, nextPts: 1000, color: '#64748b', accent: '#e2e8f0' },
  { id: 'ouro', name: 'Ouro I', sub: 'Veterano', minPts: 1000, nextPts: 1250, color: '#ca8a04', accent: '#fde047' },
  { id: 'ouro', name: 'Ouro II', sub: 'Caçador', minPts: 1250, nextPts: 1550, color: '#ca8a04', accent: '#facc15' },
  { id: 'platina', name: 'Platina I', sub: 'Avançado', minPts: 1550, nextPts: 1850, color: '#0284c7', accent: '#38bdf8' },
  { id: 'platina', name: 'Platina II', sub: 'Elite', minPts: 1850, nextPts: 2150, color: '#0284c7', accent: '#7dd3fc' },
  { id: 'diamante', name: 'Diamante I', sub: 'Sniper', minPts: 2150, nextPts: 2500, color: '#7c3aed', accent: '#c4b5fd' },
  { id: 'diamante', name: 'Diamante II', sub: 'Comandante', minPts: 2500, nextPts: 2900, color: '#7c3aed', accent: '#ddd6fe' },
  { id: 'mestre', name: 'Mestre', sub: 'Alta Patente', minPts: 2900, nextPts: 3400, color: '#dc2626', accent: '#fca5a5' },
  { id: 'desafiante', name: 'Desafiante', sub: 'Top Ilha', minPts: 3400, nextPts: null, color: '#ea580c', accent: '#fde047' },
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
  fps: number;
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
    modelId: 'adam' | 'eva';
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
    | 'bridge'
    | 'hotelTambau'
    | 'skyscraper'
    | 'farol'
    | 'estacao'
    | 'igreja'
    | 'letreiro'
    | 'quiosque'
    | 'lagoa'
    | 'pier';
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
    damage: 19,
    fireRateMs: 540,
    magSize: 6,
    reloadTimeSec: 0.42,
    range: 48,
    spread: 0.042,
    pellets: 6,
    automatic: false,
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
];
