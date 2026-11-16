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

export type WeaponId = 'g18' | 'm4a1' | 'ump45' | 'm1014' | 'awm';

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
  none: { id: 'none', label: 'Padrão (Sem Mira)', short: 'PADRÃO', fov: 48 },
  '1x': { id: '1x', label: 'Mira 1x (Red Dot)', short: '1X', fov: 39 },
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

export interface CharacterConfig {
  id: string;
  name: string;
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
export type ControlMode = 'auto' | 'desktop' | 'mobile';
export type AimAssistMode = 'default' | 'precise';
export type MatchMode = 'solo' | 'duo' | 'squad';

export type HudElementId =
  | 'minimap'
  | 'weapons'
  | 'hpBar'
  | 'joystick'
  | 'fireBtn'
  | 'aimBtn'
  | 'jumpBtn'
  | 'crouchBtn'
  | 'proneBtn'
  | 'reloadBtn';

export interface HudElementLayout {
  xPct: number; // 0..100 (% of viewport width, center of element)
  yPct: number; // 0..100 (% of viewport height, center of element)
  scale: number; // 0.6..1.6
  opacity: number; // 0.3..1.0
}

export type HudLayoutConfig = Record<HudElementId, HudElementLayout>;

export const DEFAULT_HUD_LAYOUT: HudLayoutConfig = {
  minimap: { xPct: 8, yPct: 12, scale: 1.0, opacity: 1.0 },
  weapons: { xPct: 87, yPct: 18, scale: 1.0, opacity: 1.0 },
  hpBar: { xPct: 50, yPct: 92, scale: 1.0, opacity: 1.0 },
  joystick: { xPct: 15, yPct: 76, scale: 1.0, opacity: 0.9 },
  fireBtn: { xPct: 84, yPct: 68, scale: 1.0, opacity: 0.92 },
  aimBtn: { xPct: 93, yPct: 56, scale: 1.0, opacity: 0.9 },
  jumpBtn: { xPct: 93, yPct: 40, scale: 1.0, opacity: 0.88 },
  crouchBtn: { xPct: 92, yPct: 84, scale: 1.0, opacity: 0.88 },
  proneBtn: { xPct: 81, yPct: 88, scale: 1.0, opacity: 0.88 },
  reloadBtn: { xPct: 73, yPct: 72, scale: 1.0, opacity: 0.88 },
};

export interface GameSettings {
  sensitivity: number; // 0.2 .. 2.5 (Geral)
  redDotSensitivity: number; // 0.2 .. 2.5 (1x / Red Dot)
  scope2xSensitivity: number; // 0.2 .. 2.5 (2x)
  scope4xSensitivity: number; // 0.2 .. 2.5 (4x)
  sniperSensitivity: number; // 0.2 .. 2.5 (AWM Sniper)
  aimAssistMode: AimAssistMode; // 'default' = Mira Gruda, 'precise' = Livre
  quality: GraphicsQuality;
  soundVolume: number; // 0 .. 1
  muted: boolean;
  showFps: boolean;
  controlMode: ControlMode;
  invertY: boolean;
  hudLayout: HudLayoutConfig;
}

export interface PlayerProfile {
  nickname: string;
  level: number;
  gold: number;
  gems: number;
  matchesPlayed: number;
  wins: number;
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
  glooCount: number;
  grenadeCount: number;
  isPlacingGloo: boolean;
  isHoldingGrenade: boolean;
  usingMedkit: boolean;
  medkitProgress: number; // 0..1
  stance: PlayerStance;
  isSprinting: boolean;
  isAiming: boolean;
  isGrounded: boolean;
  isReloading: boolean;
  reloadProgress: number; // 0..1
  isDead: boolean;
  activeSlot: 1 | 2 | 3;
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
  currentPoi: string | null;
  matchMode: MatchMode;
  reviveTarget: {
    id: string;
    slotNumber: number;
    nick: string;
    bleedHp: number;
  } | null;
  reviveProgress: number; // 0..1
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
  kind: 'house' | 'shed' | 'container' | 'tower' | 'bridge';
}

export interface MinimapRoad {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  kind?: 'dirt' | 'asphalt';
}

export interface LootItem {
  id: string;
  x: number;
  y: number;
  z: number;
  kind:
    | 'ammo'
    | 'medkit'
    | 'weapon'
    | 'scope'
    | 'vest'
    | 'helmet'
    | 'backpack'
    | 'attachment'
    | 'gloo'
    | 'grenade'
    | 'deathbox';
  weaponId?: WeaponId;
  scopeType?: ScopeType;
  attachmentKind?: AttachmentKind;
  level?: 1 | 2 | 3;
  ammoAmount?: number;
  glooAmount?: number;
  grenadeAmount?: number;
  deathLoot?: {
    medkits: number;
    gloos: number;
    grenades: number;
    ammo: number;
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
    fireRateMs: 92,
    magSize: 15,
    reloadTimeSec: 0.8,
    range: 75,
    spread: 0.005,
    pellets: 1,
    automatic: true,
    defaultScope: 'none',
    allowsCustomScope: false,
    allowsAttachments: true,
    supportsAimAssist: true,
    moveSpeedMult: 1.04,
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
    reloadTimeSec: 1.05,
    range: 210,
    spread: 0.002,
    pellets: 1,
    automatic: true,
    defaultScope: 'none',
    allowsCustomScope: true,
    allowsAttachments: true,
    supportsAimAssist: true,
    moveSpeedMult: 0.96,
  },
  ump45: {
    id: 'ump45',
    slot: 2,
    name: 'SUBMETRALHADORA UMP-17',
    shortName: 'UMP-17',
    category: 'SMG',
    damage: 24,
    fireRateMs: 78,
    magSize: 32,
    reloadTimeSec: 0.9,
    range: 130,
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
    reloadTimeSec: 1.25,
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
    reloadTimeSec: 1.45,
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
    id: 'adam_classic',
    name: 'RAFAEL (CLÁSSICO 2017)',
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
    id: 'tactical_recon',
    name: 'MARCOS (TÁTICO)',
    skinColor: '#c98e6b',
    hairStyle: 'helmet',
    hairColor: '#2b302b',
    shirtStyle: 'tee',
    shirtColor: '#1f2421',
    pantsColor: '#9c8a72',
    vestEnabled: true,
    vestColor: '#4f5e39',
    backpackEnabled: true,
    shoesColor: '#b32d2e',
  },
  {
    id: 'desert_scout',
    name: 'LARA (EXPLORADORA)',
    skinColor: '#e2b291',
    hairStyle: 'cap',
    hairColor: '#3a281d',
    shirtStyle: 'tank',
    shirtColor: '#384635',
    pantsColor: '#b49f7d',
    vestEnabled: true,
    vestColor: '#3f4739',
    backpackEnabled: true,
    shoesColor: '#30343a',
  },
  {
    id: 'street_runner',
    name: 'BRUNO (URBANO)',
    skinColor: '#8d5b3e',
    hairStyle: 'spiky',
    hairColor: '#18181b',
    shirtStyle: 'hoodie',
    shirtColor: '#8d2b24',
    pantsColor: '#2c333f',
    vestEnabled: false,
    vestColor: '#3c4536',
    backpackEnabled: true,
    shoesColor: '#e5e7eb',
  },
];
