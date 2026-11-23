import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { preloadAdamAssets } from './adamAssets';
import { BERMUDA_GLB_WATER_Y, preloadExternalWorldAssets } from './externalAssets';
import { soundEngine } from './audio';
import {
  CharacterAnimator,
  WEAPON_DRAW_DURATION,
} from './characterAnimator';
import { CharacterRig, createCharacterRig } from './characterBuilder';
import {
  buildGlooCollidersAndPlatforms,
  createGlooVariantAssets,
  GlooVariantAssets,
} from './glooBuilder';
import { InputManager } from './inputManager';
import { createLobbyScene, LobbySceneHandle } from './lobbyScene';
import { multiplayerClient, MultiplayerServerEvent } from './multiplayerClient';
import { GameStateMachine } from './stateMachine';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import type {
  AirplaneRouteSync,
  ClientMatchStatePush,
  MatchRoomAction,
  MatchRoomJoinInfo,
  MatchRoomSnapshot,
  RemoteBotSync,
  RemoteFlightPhase,
  RemotePlayerSync,
  RoomHumanSlot,
} from '../shared/multiplayerTypes';
import {
  ATTACHMENT_LABELS,
  AttachmentKind,
  AttachmentSlotKey,
  BackpackItem,
  BrMapId,
  BuildingNavZone,
  CharacterConfig,
  CharacterModelId,
  DamagePopup,
  DeathBoxItemEntry,
  GameSettings,
  GameState,
  GameVariant,
  getCharacterPresetByModelId,
  GladiadoresFormat,
  GlooSkinId,
  HudSnapshot,
  KillFeedEntry,
  MatchMode,
  MinimapBuilding,
  MinimapRoad,
  NearbyLootSlot,
  normalizeCharacterModelId,
  PlayerStance,
  PoiMarker,
  SCOPE_META,
  ScopeType,
  VENDING_SHOP_OFFERS,
  VehicleHudState,
  WalkablePlatform,
  WEAPONS,
  WeaponAttachments,
  WeaponDef,
  WeaponId,
  WeaponSlotId,
  WeaponSlotState,
  WorldObbCollider,
} from './types';
import {
  defaultShadowForQuality,
  defaultTextureForQuality,
  isMobileHardware,
} from './storage';
import { preloadAllWeaponTextures } from './weapon25d';
import {
  BERMUDA_HALF,
  BERMUDA_MAP_RANGE,
  botSurfaceHeightAt,
  createIslandWorld,
  GLADIADORES_BOUNDS,
  GLADIADORES_FLOOR_Y,
  GLADIADORES_ORIGIN,
  HAS_SENTOSA,
  LootVisual,
  nearestBridgePos,
  riverCenterZ,
  SENTOSA_CENTER,
  setBotWeaponVisual,
  TargetDummy,
  upgradeBotsToAdam,
  VehicleEntity,
  VendingMachineProp,
  WAIT_LOBBY_ORIGIN,
  WAIT_SPAWN,
  WorldHandle,
} from './worldBuilder';

const SAFE_ZONE_PHASES = [
  { waitSec: 36, shrinkSec: 28, targetRadius: 420, damagePerSec: 2 },
  { waitSec: 28, shrinkSec: 24, targetRadius: 260, damagePerSec: 5 },
  { waitSec: 22, shrinkSec: 20, targetRadius: 145, damagePerSec: 10 },
  { waitSec: 16, shrinkSec: 16, targetRadius: 68, damagePerSec: 16 },
  { waitSec: 12, shrinkSec: 14, targetRadius: 18, damagePerSec: 25 },
];

const BACKPACK_CAPACITIES: Record<1 | 2 | 3, number> = {
  1: 80,
  2: 140,
  3: 220,
};

function emptyAttachments(): WeaponAttachments {
  return { muzzle: null, foregrip: null, magazine: null, stock: null };
}

function isBotPistol(wid: WeaponId): boolean {
  return WEAPONS[wid].category === 'HG';
}

const BOT_GENERAL_SCORE: Record<WeaponId, number> = {
  xm8: 95,
  scar: 92,
  ak47: 90,
  m4a1: 86,
  awm: 84,
  ump45: 78,
  m1014: 74,
  deagle: 32,
  g18: 20,
};

function isCloseRangePrimary(wid: WeaponId): boolean {
  return wid === 'm1014' || wid === 'ump45';
}

function isLongRangePrimary(wid: WeaponId): boolean {
  const cat = WEAPONS[wid].category;
  return cat === 'AR' || cat === 'SR';
}

function scoreBotWeaponForDistance(wid: WeaponId, dist: number): number {
  if (dist < 17) {
    switch (wid) {
      case 'm1014': return 100;
      case 'ump45': return 92;
      case 'ak47': return 78;
      case 'xm8': return 76;
      case 'scar': return 75;
      case 'm4a1': return 72;
      case 'deagle': return 48;
      case 'g18': return 38;
      case 'awm': return 18;
    }
  }
  if (dist < 44) {
    switch (wid) {
      case 'xm8': return 96;
      case 'scar': return 94;
      case 'ak47': return 91;
      case 'm4a1': return 88;
      case 'ump45': return 74;
      case 'awm': return 66;
      case 'deagle': return 40;
      case 'm1014': return 26;
      case 'g18': return 20;
    }
  }
  switch (wid) {
    case 'awm': return 100;
    case 'xm8': return 90;
    case 'scar': return 88;
    case 'm4a1': return 84;
    case 'ak47': return 80;
    case 'ump45': return 42;
    case 'deagle': return 28;
    case 'm1014': return 8;
    case 'g18': return 6;
  }
}

function getBotBackWeapon(bot: TargetDummy): WeaponId | null {
  if (bot.secondaryWeaponId && bot.secondaryWeaponId !== bot.weaponId) {
    return bot.secondaryWeaponId;
  }
  if (bot.pistolWeaponId && bot.pistolWeaponId !== bot.weaponId) {
    return bot.pistolWeaponId;
  }
  return null;
}

function pickBestBotWeaponForDistance(bot: TargetDummy, dist: number): WeaponId {
  const candidates: WeaponId[] = [bot.weaponId];
  if (bot.secondaryWeaponId && !candidates.includes(bot.secondaryWeaponId)) {
    candidates.push(bot.secondaryWeaponId);
  }
  if (bot.pistolWeaponId && !candidates.includes(bot.pistolWeaponId)) {
    candidates.push(bot.pistolWeaponId);
  }
  const hasNonPistolUsableAtRange = candidates.some(
    (w) => !isBotPistol(w) && !(w === 'awm' && dist < 14),
  );

  let best = bot.weaponId;
  let bestScore = -1;
  for (let i = 0; i < candidates.length; i++) {
    const w = candidates[i];
    if (hasNonPistolUsableAtRange && isBotPistol(w)) continue;
    let sc = scoreBotWeaponForDistance(w, dist);
    if (w === bot.weaponId) sc += 2.5; // slight hysteresis to prevent flicker at boundary
    if (sc > bestScore) {
      bestScore = sc;
      best = w;
    }
  }
  return best;
}

function equipBotWeapon(bot: TargetDummy, nextWid: WeaponId, triggerDraw: boolean): void {
  const prevWid = bot.weaponId;
  if (prevWid === nextWid) return;
  if (isBotPistol(prevWid)) {
    if (!bot.pistolWeaponId || BOT_GENERAL_SCORE[prevWid] >= BOT_GENERAL_SCORE[bot.pistolWeaponId]) {
      bot.pistolWeaponId = prevWid;
    }
  } else {
    bot.secondaryWeaponId = prevWid;
  }
  if (bot.secondaryWeaponId === nextWid) {
    bot.secondaryWeaponId = prevWid && !isBotPistol(prevWid) ? prevWid : undefined;
  }
  bot.weaponId = nextWid;
  bot.ammoInMag = WEAPONS[nextWid].magSize;
  bot.reloadTimer = 0;
  if (triggerDraw) {
    bot.drawTimer = WEAPON_DRAW_DURATION;
    bot.animator?.triggerWeaponDraw();
  }
  setBotWeaponVisual(bot, bot.weaponId, getBotBackWeapon(bot));
}

function giveBotLootedWeapon(bot: TargetDummy, newWid: WeaponId): boolean {
  if (isBotPistol(newWid)) {
    if (!bot.pistolWeaponId || BOT_GENERAL_SCORE[newWid] > BOT_GENERAL_SCORE[bot.pistolWeaponId]) {
      bot.pistolWeaponId = newWid;
      if (isBotPistol(bot.weaponId) && BOT_GENERAL_SCORE[newWid] > BOT_GENERAL_SCORE[bot.weaponId]) {
        bot.weaponId = newWid;
        bot.ammoInMag = WEAPONS[newWid].magSize;
        bot.reloadTimer = 0;
        bot.drawTimer = WEAPON_DRAW_DURATION;
        bot.animator?.triggerWeaponDraw();
      }
      setBotWeaponVisual(bot, bot.weaponId, getBotBackWeapon(bot));
      return true;
    }
    return false;
  }

  // Primary weapon! Bot ALWAYS prefers primary weapons over pistols.
  if (isBotPistol(bot.weaponId)) {
    if (!bot.pistolWeaponId || BOT_GENERAL_SCORE[bot.weaponId] >= BOT_GENERAL_SCORE[bot.pistolWeaponId]) {
      bot.pistolWeaponId = bot.weaponId;
    }
    bot.weaponId = newWid;
    bot.ammoInMag = WEAPONS[newWid].magSize;
    bot.reloadTimer = 0;
    bot.drawTimer = WEAPON_DRAW_DURATION;
    bot.animator?.triggerWeaponDraw();
    setBotWeaponVisual(bot, bot.weaponId, getBotBackWeapon(bot));
    return true;
  }

  if (bot.weaponId === newWid || bot.secondaryWeaponId === newWid) {
    return false;
  }

  if (!bot.secondaryWeaponId) {
    if (BOT_GENERAL_SCORE[newWid] > BOT_GENERAL_SCORE[bot.weaponId]) {
      bot.secondaryWeaponId = bot.weaponId;
      bot.weaponId = newWid;
      bot.ammoInMag = WEAPONS[newWid].magSize;
      bot.reloadTimer = 0;
      bot.drawTimer = WEAPON_DRAW_DURATION;
      bot.animator?.triggerWeaponDraw();
    } else {
      bot.secondaryWeaponId = newWid;
    }
    setBotWeaponVisual(bot, bot.weaponId, getBotBackWeapon(bot));
    return true;
  }

  // Already has 2 primaries: keep best complementary pair (1 close + 1 long/mid) or higher score
  const p1 = bot.weaponId;
  const p2 = bot.secondaryWeaponId;
  const scorePair = (a: WeaponId, b: WeaponId): number => {
    const hasClose = isCloseRangePrimary(a) || isCloseRangePrimary(b);
    const hasLong = isLongRangePrimary(a) || isLongRangePrimary(b);
    const synergy = hasClose && hasLong ? 16 : 0;
    return BOT_GENERAL_SCORE[a] + BOT_GENERAL_SCORE[b] + synergy;
  };
  const curScore = scorePair(p1, p2);
  const optA = scorePair(newWid, p2);
  const optB = scorePair(p1, newWid);
  if (optA <= curScore && optB <= curScore) {
    return false;
  }
  const [slotA, slotB]: [WeaponId, WeaponId] = optA >= optB ? [newWid, p2] : [p1, newWid];
  const primary = BOT_GENERAL_SCORE[slotA] >= BOT_GENERAL_SCORE[slotB] ? slotA : slotB;
  const secondary = primary === slotA ? slotB : slotA;
  const changedActive = bot.weaponId !== primary;
  bot.weaponId = primary;
  bot.secondaryWeaponId = secondary;
  if (changedActive) {
    bot.ammoInMag = WEAPONS[primary].magSize;
    bot.reloadTimer = 0;
    bot.drawTimer = WEAPON_DRAW_DURATION;
    bot.animator?.triggerWeaponDraw();
  }
  setBotWeaponVisual(bot, bot.weaponId, getBotBackWeapon(bot));
  return true;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// Pre-allocated scratch helpers (zero GC inside render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _centerNdc = new THREE.Vector2(0, 0);
const _spreadNdc = new THREE.Vector2(0, 0);

const ALLY_NAME_POOL = [
  'Gabriel_BR',
  'Lucas_Capa',
  'Pedro_X1',
  'Matheus_FF',
  'Rafael_Pro',
  'Kauã_17',
  'Biel_Rush',
  'Enzo_Sniper',
  'Vini_Gelo',
  'Arthur_BR',
  'Cauã_Top1',
  'Davi_Mestre',
  'Igor_Jampa',
  'Thiago_FF',
  'Yuri_AWM',
  'Luan_Rush',
  'Gustavo_17',
  'Bruno_Capa',
  'Diego_BR',
  'Samu_Pro',
  'Renan_G18',
  'Felipe_X1',
  'Murilo_FF',
  'Natan_BR',
  'Heitor_Pro',
  'Caio_17',
];

interface BulletTracer {
  mesh: THREE.Mesh;
  life: number;
  active: boolean;
}

interface RemoteHumanEntity {
  accountId: number;
  publicId: string;
  nickname: string;
  level: number;
  rankPoints: number;
  modelId: CharacterModelId;
  teamId: number;
  slotInTeam: number;
  isTeamLeader: boolean;
  rig: CharacterRig;
  animator: CharacterAnimator;
  hitMeshes: THREE.Mesh[];
  targetPos: THREE.Vector3;
  targetYaw: number;
  lastState: RemotePlayerSync | null;
  lastWeaponId: WeaponId | null;
}

interface AirDropCrate {
  id: string;
  x: number;
  z: number;
  y: number;
  groundY: number;
  state: 'falling' | 'landed' | 'looted';
  group: THREE.Group;
  chuteGroup: THREE.Group;
  beaconBeam: THREE.Mesh;
  beaconRing: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
}

export class BattleRoyaleEngine {
  public readonly stateMachine = new GameStateMachine();
  public readonly input = new InputManager();

  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private isSoftwareGl: boolean;
  private contextLost = false;
  private textures: ProceduralTextureSet;
  private envMap: THREE.Texture;

  private lobbyScene: LobbySceneHandle;
  private world: WorldHandle;
  private lobbyRig: CharacterRig;
  private lobbyExtraRigs: CharacterRig[] = [];
  private lobbySquadSignature = '';
  private lobbySquadTargetZ = 3.72;
  private lobbySelfOffsetX = 0;
  private lobbySelfOffsetZ = 0;
  private playerRig: CharacterRig;
  private animator = new CharacterAnimator();

  private raycaster = new THREE.Raycaster();
  private tracerPool: BulletTracer[] = [];
  private tracerGeo = new THREE.BoxGeometry(0.035, 0.035, 1.8);
  private tracerMat = new THREE.MeshBasicMaterial({
    color: 0xffe27a,
    transparent: true,
    opacity: 0.9,
  });
  private solidObstaclesNoTerrain: THREE.Object3D[] = [];
  private solidObstaclesActive: THREE.Object3D[] = [];
  private activeObstaclesLastRefresh = -1;
  private _colScratch: WorldObbCollider[] = [];
  private _platScratch: WalkablePlatform[] = [];
  private _botSteerCols: WorldObbCollider[] = [];
  private _botProbeCols: WorldObbCollider[] = [];
  private _botNavOut = { x: 0, z: 0, dirX: 0, dirZ: 0 };
  private scratchTargetMeshes: THREE.Object3D[] = [];
  private targetById = new Map<string, TargetDummy>();
  private botOrderScratch: number[] = [];
  private botDistSqScratch = new Float64Array(64);
  private crosshairCheckAccum = 0;
  private lastSunSnapX = Number.NaN;
  private lastSunSnapZ = Number.NaN;

  private glooAssets!: GlooVariantAssets;
  private glooPreviewMesh!: THREE.Mesh;
  private dynamicGlooPlatforms: WalkablePlatform[] = [];
  private deployedGloos: Array<{
    id: string;
    skin: GlooSkinId;
    mesh: THREE.Mesh;
    colliders: WorldObbCollider[];
    platforms: WalkablePlatform[];
    hp: number;
    life: number;
  }> = [];
  private nextGlooId = 1;

  private grenadeLinePositions = new Float32Array(26 * 3);
  private grenadeLineGeo = new THREE.BufferGeometry();
  private grenadeLineMat = new THREE.LineBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.92,
  });
  private grenadeLine: THREE.Line;
  private grenadeTargetGeo = new THREE.RingGeometry(0.42, 0.72, 20);
  private grenadeTargetMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  private grenadeTargetMesh: THREE.Mesh;
  private grenadeProjGeo = new THREE.SphereGeometry(0.14, 10, 8);
  private grenadeProjMat = new THREE.MeshStandardMaterial({
    color: 0x4d7c0f,
    roughness: 0.45,
    metalness: 0.4,
    emissive: 0x3f6212,
    emissiveIntensity: 0.35,
  });
  private thrownGrenades: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    active: boolean;
  }> = [];
  private explosionGeo = new THREE.SphereGeometry(1, 14, 10);
  private explosionVfx: Array<{
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    age: number;
    active: boolean;
  }> = [];

  // Periodic AirDrop system (crate + parachute + vertical sky beacon + ground ring)
  private airDropCrateGeo = new THREE.BoxGeometry(1.48, 1.35, 1.48);
  private airDropStripeGeo = new THREE.BoxGeometry(1.54, 0.28, 1.54);
  private airDropChuteGeo = new THREE.SphereGeometry(2.15, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  private airDropCordGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.8, 5);
  private airDropBeamGeo = new THREE.CylinderGeometry(0.45, 0.78, 165, 12, 1, true);
  private airDropRingGeo = new THREE.RingGeometry(1.15, 1.58, 22);
  private airDropCrateMat = new THREE.MeshStandardMaterial({
    color: 0x3f4739,
    roughness: 0.45,
    metalness: 0.52,
  });
  private airDropStripeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.3,
  });
  private airDropChuteMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.68,
    side: THREE.DoubleSide,
  });
  private airDropCordMat = new THREE.MeshBasicMaterial({ color: 0xe5e7eb });
  private airDrops: AirDropCrate[] = [];
  private nextAirDropId = 1;
  private airDropSpawnTimer = 22;
  private airDropCountSpawned = 0;
  private airDropNotice: string | null = null;
  private airDropNoticeTimer = 0;

  private healRingGeo = new THREE.RingGeometry(0.55, 0.82, 26);
  private healRingMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.78,
  });
  private healRingMesh: THREE.Mesh;
  private lastGunfightX = 0;
  private lastGunfightZ = 0;
  private lastGunfightTimer = 0;
  private launchPadFlightTimer = 0;
  private autoLootTimer = 0;

  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();
  private elapsed = 0;

  // Player simulation state
  private pos = new THREE.Vector3(-60, 2.2, 68);
  private vel = new THREE.Vector3();
  private yaw = 0;
  private characterYaw = 0;
  private combatFacingTimer = 0;
  private combatPoseTimer = 0;
  private pitch = -0.14;
  private camPosCurrent = new THREE.Vector3();
  private camLookCurrent = new THREE.Vector3();
  private camDistCurrent = 3.75;
  private camSafeDist = 3.75;
  private camShoulderCurrent = 0.42;
  private camShake = 0;
  private vehicleLookOverrideTimer = 0;
  private lobbyOrbitYaw = 0.22;
  private lobbyDragging = false;
  private lobbyLastX = 0;

  private stance: PlayerStance = 'stand';
  private stanceSnapTimer = 0;
  private isGrounded = true;
  private isSprinting = false;
  private inWater = false;
  private isSwimming = false;
  private isOnSurfboard = false;
  private isAiming = false;
  private wasAiming = false;
  private lockedTargetId: string | null = null;
  private aimBreakAccum = 0;
  private pullingUpTimer = 0;
  private bugDoCapaTimer = 0;
  private wasLockedWhileCrouched = false;
  private crouchLockedDist = 20;
  private aimLockedTarget = false;
  private aimAssistActive = false;
  private isDead = false;
  private isPlayerDowned = false;
  private playerBleedHp = 100;
  private playerRevivingAllyId: string | null = null;
  private deathTimer = 0;

  private hp = 200;
  private maxHp = 200;
  private vestLevel: 0 | 1 | 2 | 3 = 0;
  private vestHp = 0;
  private vestMaxHp = 0;
  private helmetLevel: 0 | 1 | 2 | 3 = 0;
  private helmetHp = 0;
  private helmetMaxHp = 0;
  private backpackLevel: 1 | 2 | 3 = 1;
  private medkitCount = 1;
  private smallkitCount = 0;
  private glooCount = 2;
  private grenadeCount = 2;
  private isPlacingGloo = false;
  private glooSkin: GlooSkinId = 'classic';
  private glooPlaceDistance = 3.8;
  private isHoldingGrenade = false;
  private usingMedkit = false;
  private healingKind: 'medkit' | 'smallkit' = 'medkit';
  private medkitTimer = 0;
  private readonly medkitDuration = 4.0;
  private readonly smallkitDuration = 4.0;
  private backpackItems: BackpackItem[] = [];
  private nextBackpackItemId = 1;
  private vaultTimer = 0;
  private canVaultWindow = false;
  private revivingBotId: string | null = null;
  private reviveTimer = 0;
  private readonly reviveDuration = 3.0;

  private activeSlot: WeaponSlotId = 3;
  private ownedScopes: ScopeType[] = ['none'];
  private weapons: Record<1 | 2 | 3, WeaponSlotState | null> = {
    1: null,
    2: null,
    3: {
      weaponId: 'g18',
      ammoInMag: 15,
      reserveAmmo: 60,
      scope: 'none',
      attachments: emptyAttachments(),
    },
  };
  private slotLastShotTime: Record<WeaponSlotId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private prevWeaponSlot: WeaponSlotId = 1;
  private hudDirty = false;
  private consecutiveShots = 0;
  private wasFireDown = false;
  private reloadTimer = 0;
  private isReloading = false;
  private footstepAccum = 0;
  private damagePopupStagger = 0;

  // Match / Flight / Safe Zone timers
  private matchmakingTimer = 0;
  private waitingTimer = 10;
  private zonePhase = 1;
  private zoneIsShrinking = false;
  private zoneTimer = 90;
  private zoneShrinkTotal = 60;
  private zoneCurrentX = 0;
  private zoneCurrentZ = 0;
  private zoneCurrentRadius = 650;
  private zoneStartX = 0;
  private zoneStartZ = 0;
  private zoneStartRadius = 650;
  private zoneNextX = 0;
  private zoneNextZ = 0;
  private zoneNextRadius = 420;
  private zoneDmgAccum = 0;
  private zoneDmgTickTimer = 0;
  private zoneGasExposureSec = 0;
  private lootSyncAccum = 0;
  private distantSkirmishTimer = 5.0;

  private airplaneProgress = 0; // 0..1 across island
  private planeStart = new THREE.Vector3(-630, 128, -420);
  private planeEnd = new THREE.Vector3(630, 128, 420);
  private aliveCount = 51;
  private kills = 0;
  private damageDealt = 0;
  private hitmarkerTimer = 0;
  private headshotFlashTimer = 0;
  private damageFlashTimer = 0;
  private damagePopups: DamagePopup[] = [];
  private nextDamagePopupId = 1;
  private damageIndicators: { id: number; worldX: number; worldZ: number; age: number }[] = [];
  private nextDamageIndicatorId = 1;
  private killFeed: KillFeedEntry[] = [];
  private nextKillFeedId = 1;
  private playerNick = 'SOBREVIVENTE';
  private matchMode: MatchMode = 'solo';
  private brMapId: BrMapId = 'bermuda';
  private gameVariant: GameVariant = 'br';
  private gladiadoresFormat: GladiadoresFormat = '1v1';
  private gladiadoresTargetRounds = 5;
  private gladRound = 1;
  private gladPlayerScore = 0;
  private gladEnemyScore = 0;
  private gladPhase: 'intro' | 'fight' | 'round_end' = 'intro';
  private gladPhaseTimer = 0;
  private gladBanner: string | null = null;
  private gladPendingWinner: 'player' | 'enemy' | null = null;
  private gladSpinReloadState = new Map<
    string,
    { phase: 'shoot' | 'reload_spin'; spinDir: number }
  >();
  private isRanked = false;
  private autoFillBots = true;
  private ffCoins = 100;
  private activeVehicleId: string | null = null;
  private prevCharYawForTurn = 0;
  private onLoadProgress?: (pct: number, label: string) => void;
  private loadTimers: number[] = [];

  // Waiting Lobby staggered spawn (multiplayers enter together first, then bots fill up to 51 total)
  private static readonly MAX_WAIT_LOBBY_PEOPLE = 51;
  private waitLobbyBotsUnlocked = 0;
  private waitLobbySpawnDelay = 0.45;
  private waitLobbySpawnTimer = 0;

  // Online Multiplayer Room State (50ms WS + HTTP fallback)
  private onlineRoomId: string | null = null;
  private onlineAccountId = 0;
  private onlineHostAccountId = 0;
  private onlineTeamId = 1;
  private onlineSlotInTeam = 1;
  private onlineWaitingEndsAtMs = 0;
  private onlinePlaneStartedAtMs = 0;
  private onlineAirplaneRoute: AirplaneRouteSync | null = null;
  private onlineHumanSlots: RoomHumanSlot[] = [];
  private onlineRemotePlayers = new Map<number, RemoteHumanEntity>();
  private onlineSyncAccum = 0;
  private onlineBotSyncAccum = 0;
  private onlineSyncInFlight = false;
  private pendingRoomActions: MatchRoomAction[] = [];
  private syncedServerLootIds = new Set<string>();
  private syncedServerGlooIds = new Set<string>();
  private seenRemoteKillIds = new Set<number>();
  private isSpectating = false;
  private spectateTargetRef:
    | { kind: 'human'; accountId: number }
    | { kind: 'bot'; botId: string }
    | null = null;
  private spectateSnapNext = false;
  private lastAttackerRef:
    | { kind: 'human'; accountId: number }
    | { kind: 'bot'; botId: string }
    | null = null;
  private playerDeathPlacement: number | null = null;
  private likedSpectateTargets = new Set<string>();
  private botSpectators: Array<{
    id: string;
    nick: string;
    leaveAtElapsed: number;
    likeAtElapsed: number | null;
    liked: boolean;
  }> = [];
  private matchVisualLikes = 0;
  private likeToasts: Array<{ id: number; nick: string; age: number }> = [];
  private nextLikeToastId = 1;
  private followingTeamLeader = true;
  private unsubMultiplayer?: () => void;

  // Settings & callbacks
  private settings: GameSettings;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onPauseRequest: () => void;
  private onBackpackRequest?: () => void;
  private onOpenShopRequest?: () => void;
  private hudEmitAccum = 0;
  private fpsAccumTime = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private currentCharConfig: CharacterConfig;

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    initialChar: CharacterConfig,
    onHudUpdate: (snap: HudSnapshot) => void,
    onPauseRequest: () => void,
    onBackpackRequest?: () => void,
    onOpenShopRequest?: () => void,
  ) {
    this.container = container;
    this.settings = initialSettings;
    this.currentCharConfig = { ...initialChar };
    this.onHudUpdate = onHudUpdate;
    this.onPauseRequest = onPauseRequest;
    this.onBackpackRequest = onBackpackRequest;
    this.onOpenShopRequest = onOpenShopRequest;

    // 1. Create a single WebGLRenderer with progressive fallbacks (never trigger WEBGL_lose_context on a probe!)
    const { renderer, isSoftwareGl } = this.createSafeRenderer(initialSettings);
    this.renderer = renderer;
    this.isSoftwareGl = isSoftwareGl;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.applyQualitySettings(initialSettings);
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onWebGLContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onWebGLContextRestored);
    container.appendChild(this.renderer.domElement);

    // 3. Studio IBL environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 4. Procedural textures & scenes
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.glooSkin = initialChar.glooSkin === 'ffwc' ? 'ffwc' : 'classic';
    this.glooAssets = createGlooVariantAssets(maxAniso);
    preloadAllWeaponTextures();

    this.lobbyScene = createLobbyScene(this.textures, this.envMap);
    this.lobbyRig = createCharacterRig(
      initialChar,
      this.textures.camoParachute,
      this.textures.contactShadow,
    );
    this.lobbyRig.setWeapon(null);
    this.lobbyRig.setBackWeapons(null, null);
    this.lobbyScene.characterAnchor.add(this.lobbyRig.root);

    this.world = createIslandWorld(this.textures, this.envMap);
    this.applyQualitySettings(initialSettings);
    for (let i = 0; i < this.world.targets.length; i++) {
      this.targetById.set(this.world.targets[i].id, this.world.targets[i]);
    }
    // Exclude high-triangle terrainMesh from per-frame LOS/crosshair raycasts (handled analytically)
    this.rebuildSolidObstaclesNoTerrain();
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat);
      mesh.visible = false;
      this.world.scene.add(mesh);
      this.tracerPool.push({ mesh, life: 0, active: false });
    }

    // Tactical Gloo Wall preview + Grenade trajectory line + projectile & explosion pools
    this.glooPreviewMesh = new THREE.Mesh(
      this.glooSkin === 'ffwc' ? this.glooAssets.ffwcGeo : this.glooAssets.classicGeo,
      this.glooSkin === 'ffwc' ? this.glooAssets.ffwcPreviewMat : this.glooAssets.classicPreviewMat,
    );
    this.glooPreviewMesh.visible = false;
    this.world.scene.add(this.glooPreviewMesh);

    this.grenadeLineGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.grenadeLinePositions, 3),
    );
    this.grenadeLine = new THREE.Line(this.grenadeLineGeo, this.grenadeLineMat);
    this.grenadeLine.frustumCulled = false;
    this.grenadeLine.visible = false;
    this.world.scene.add(this.grenadeLine);

    this.grenadeTargetMesh = new THREE.Mesh(this.grenadeTargetGeo, this.grenadeTargetMat);
    this.grenadeTargetMesh.rotation.x = -Math.PI / 2;
    this.grenadeTargetMesh.visible = false;
    this.world.scene.add(this.grenadeTargetMesh);

    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(this.grenadeProjGeo, this.grenadeProjMat);
      mesh.visible = false;
      this.world.scene.add(mesh);
      this.thrownGrenades.push({ mesh, vel: new THREE.Vector3(), active: false });

      const expMat = new THREE.MeshBasicMaterial({
        color: 0xff6b1a,
        transparent: true,
        opacity: 0.85,
      });
      const expMesh = new THREE.Mesh(this.explosionGeo, expMat);
      expMesh.visible = false;
      this.world.scene.add(expMesh);
      this.explosionVfx.push({ mesh: expMesh, mat: expMat, age: 0, active: false });
    }

    this.playerRig = createCharacterRig(
      initialChar,
      this.textures.camoParachute,
      this.textures.contactShadow,
    );
    this.syncPlayerWeaponAndBackVisuals();
    this.world.scene.add(this.playerRig.root);

    this.healRingMesh = new THREE.Mesh(this.healRingGeo, this.healRingMat);
    this.healRingMesh.rotation.x = -Math.PI / 2;
    this.healRingMesh.visible = false;
    this.world.scene.add(this.healRingMesh);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.lobbyScene.scene, this.lobbyScene.camera);
    }

    // Attach input
    this.input.attachCanvas(this.renderer.domElement, () => {
      const s = this.stateMachine.getState();
      if (s === GameState.PLAYING || s === GameState.WAITING) {
        this.onPauseRequest();
      }
    });
    this.renderer.domElement.addEventListener('pointerdown', this.onCanvasPointerDown);
    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('resize', this.handleResize);

    // Subscribe to state transitions
    this.stateMachine.subscribe((next) => {
      this.onStateEntered(next);
    });

    this.unsubMultiplayer = multiplayerClient.subscribe((ev) => {
      this.handleMultiplayerEvent(ev);
    });

    soundEngine.configure(initialSettings.soundVolume, initialSettings.muted);
    this.resetPlayerForWaiting();
    this.startLoop();
  }

  private createSafeRenderer(initialSettings: GameSettings): {
    renderer: THREE.WebGLRenderer;
    isSoftwareGl: boolean;
  } {
    const mobile = isMobileHardware();
    const attempts: THREE.WebGLRendererParameters[] = [
      {
        antialias: !mobile && initialSettings.quality === 'high',
        powerPreference: 'high-performance',
        alpha: true,
      },
      {
        antialias: false,
        powerPreference: 'default',
        alpha: true,
        failIfMajorPerformanceCaveat: false,
      },
      {
        antialias: false,
        powerPreference: 'low-power',
        alpha: true,
        failIfMajorPerformanceCaveat: false,
      },
    ];

    let renderer: THREE.WebGLRenderer | null = null;
    let lastError: unknown = null;
    for (let i = 0; i < attempts.length; i++) {
      try {
        renderer = new THREE.WebGLRenderer(attempts[i]);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!renderer) {
      throw lastError instanceof Error
        ? lastError
        : new Error('Falha ao inicializar contexto WebGL.');
    }

    let isSoftwareGl = false;
    try {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) ?? '');
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      isSoftwareGl = false;
    }

    return { renderer, isSoftwareGl };
  }

  private onWebGLContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  };

  private onWebGLContextRestored = (): void => {
    this.contextLost = false;
    this.applyQualitySettings(this.settings);
    if (!this.disposed) {
      this.startLoop();
    }
  };

  public setPlayerNickname(nick: string): void {
    const clean = nick.trim();
    if (clean.length > 0) {
      this.playerNick = clean.slice(0, 18);
    }
  }

  public getMapMetadata(): {
    buildings: MinimapBuilding[];
    roads: MinimapRoad[];
    pois: PoiMarker[];
    mapId: BrMapId;
    mapRange: number;
    bermudaMinimapCanvas: HTMLCanvasElement | null;
  } {
    const isBermuda = this.isBermudaMapActive();
    return {
      buildings: this.world.buildings,
      roads: this.world.roads,
      pois: this.world.pois,
      mapId: this.brMapId,
      mapRange: isBermuda ? this.world.bermudaMapRange : BERMUDA_MAP_RANGE,
      bermudaMinimapCanvas: isBermuda ? this.world.bermudaMinimapCanvas : null,
    };
  }

  private rebuildSolidObstaclesNoTerrain(): void {
    this.solidObstaclesNoTerrain = this.world.obstacleMeshes.filter(
      (m) => m.name !== 'terrain-mesh',
    );
    for (let i = 0; i < this.deployedGloos.length; i++) {
      this.solidObstaclesNoTerrain.push(this.deployedGloos[i].mesh);
    }
    this.refreshActiveObstacles();
  }

  private getEnemyRenderDist(): number {
    if (this.settings.quality === 'low') return 95;
    if (this.settings.quality === 'high') return 185;
    return 135;
  }

  private getLootRenderDist(): number {
    if (this.settings.quality === 'low') return 20;
    if (this.settings.quality === 'high') return 42;
    return 30;
  }

  public applyQualitySettings(settings: GameSettings): void {
    this.settings = settings;
    soundEngine.configure(settings.soundVolume, settings.muted);
    this.input.configureControls({
      keyBindings: settings.keyBindings,
      emulatorMode: Boolean(settings.emulatorMode),
      aimToggleMode: Boolean(settings.aimToggleMode),
    });

    const texLevel =
      settings.textureQuality ?? defaultTextureForQuality(settings.quality);
    const shadowLevel = this.isSoftwareGl
      ? 'off'
      : (settings.shadowQuality ?? defaultShadowForQuality(settings.quality));

    const mobile = isMobileHardware();
    const scale =
      this.isSoftwareGl
        ? 1
        : mobile
          ? settings.quality === 'low'
            ? Math.min(window.devicePixelRatio, 0.75)
            : settings.quality === 'high'
              ? Math.min(window.devicePixelRatio, 1.45)
              : Math.min(window.devicePixelRatio, 0.96)
          : settings.quality === 'low'
            ? Math.min(window.devicePixelRatio, 0.85)
            : settings.quality === 'high'
              ? Math.min(window.devicePixelRatio, 2.0)
              : Math.min(window.devicePixelRatio, 1.3);
    const prevShadowEnabled = this.renderer.shadowMap.enabled;
    const prevShadowType = this.renderer.shadowMap.type;
    const nextShadowEnabled = shadowLevel !== 'off';
    const nextShadowType =
      shadowLevel === 'high' || shadowLevel === 'ultra'
        ? THREE.PCFSoftShadowMap
        : THREE.PCFShadowMap;

    this.renderer.setPixelRatio(scale);
    this.renderer.shadowMap.enabled = nextShadowEnabled;
    this.renderer.shadowMap.type = nextShadowType;
    if (nextShadowEnabled) {
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.renderer.toneMappingExposure =
      settings.quality === 'low' ? 1.12 : settings.quality === 'high' ? 1.2 : 1.15;

    if (this.textures) {
      this.textures.applyQuality(texLevel, this.renderer.capabilities.getMaxAnisotropy());
    }
    if (this.world) {
      this.world.applyQuality(settings.quality, this.isSoftwareGl, texLevel, shadowLevel);
      this.world.camera.far =
        settings.quality === 'low' ? 430 : settings.quality === 'high' ? 1120 : 680;
      this.world.camera.updateProjectionMatrix();
      if (prevShadowEnabled !== nextShadowEnabled || prevShadowType !== nextShadowType) {
        this.world.scene.traverse((obj) => {
          const mat = (obj as THREE.Mesh).material;
          if (!mat) return;
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              m.needsUpdate = true;
            });
          } else {
            mat.needsUpdate = true;
          }
        });
      }
    }
  }

  public updateCharacterConfig(config: CharacterConfig): void {
    const prevModelId = this.currentCharConfig.modelId ?? 'adam';
    const nextModelId = config.modelId ?? 'adam';
    this.glooSkin = config.glooSkin === 'ffwc' ? 'ffwc' : 'classic';
    this.currentCharConfig = { ...config, modelId: nextModelId, glooSkin: this.glooSkin };
    if (prevModelId !== nextModelId) {
      this.rebuildPlayerAndLobbyRigs();
    } else {
      this.lobbyRig.applyConfig(this.currentCharConfig);
      this.playerRig.applyConfig(this.currentCharConfig);
    }
    this.hudDirty = true;
  }

  public setGlooSkin(skin: GlooSkinId): void {
    this.glooSkin = skin === 'ffwc' ? 'ffwc' : 'classic';
    this.currentCharConfig = { ...this.currentCharConfig, glooSkin: this.glooSkin };
    this.hudDirty = true;
  }

  private rebuildPlayerAndLobbyRigs(): void {
    this.lobbyScene.characterAnchor.remove(this.lobbyRig.root);
    this.lobbyRig.dispose();
    this.lobbyRig = createCharacterRig(
      this.currentCharConfig,
      this.textures.camoParachute,
      this.textures.contactShadow,
    );
    this.lobbyRig.setWeapon(null);
    this.lobbyRig.setBackWeapons(null, null);
    this.lobbyScene.characterAnchor.add(this.lobbyRig.root);
    this.lobbyRig.root.position.set(this.lobbySelfOffsetX, 0, this.lobbySelfOffsetZ);

    this.world.scene.remove(this.playerRig.root);
    this.playerRig.dispose();
    this.playerRig = createCharacterRig(
      this.currentCharConfig,
      this.textures.camoParachute,
      this.textures.contactShadow,
    );
    this.world.scene.add(this.playerRig.root);
    this.syncPlayerWeaponAndBackVisuals();

    upgradeBotsToAdam(this.world.targets, this.textures.camoParachute);
  }

  public setLobbySquadMembers(
    members: Array<{
      accountId: number;
      nickname: string;
      modelId: CharacterModelId;
      isLeader: boolean;
      isSelf: boolean;
    }>,
  ): void {
    const active = members.slice(0, 4);
    const sig = active
      .map((m) => `${m.accountId}:${m.modelId}:${m.isSelf ? 1 : 0}`)
      .join('|');
    if (sig === this.lobbySquadSignature) return;
    this.lobbySquadSignature = sig;

    for (let i = 0; i < this.lobbyExtraRigs.length; i++) {
      this.lobbyScene.characterAnchor.remove(this.lobbyExtraRigs[i].root);
      this.lobbyExtraRigs[i].dispose();
    }
    this.lobbyExtraRigs.length = 0;

    const count = active.length;
    const xLayouts: Record<number, number[]> = {
      1: [0],
      2: [-0.62, 0.62],
      3: [-1.1, 0, 1.1],
      4: [-1.45, -0.48, 0.48, 1.45],
    };
    const zLayouts: Record<number, number[]> = {
      1: [0],
      2: [0, 0],
      3: [-0.15, 0.08, -0.15],
      4: [-0.22, 0.08, 0.08, -0.22],
    };
    const xs = xLayouts[count] ?? [0];
    const zs = zLayouts[count] ?? [0];
    this.lobbySquadTargetZ = count <= 1 ? 3.72 : count === 2 ? 4.3 : 4.85;

    let placedSelf = false;
    for (let i = 0; i < count; i++) {
      const m = active[i];
      const px = xs[i] ?? 0;
      const pz = zs[i] ?? 0;
      if (m.isSelf && !placedSelf) {
        placedSelf = true;
        this.lobbySelfOffsetX = px;
        this.lobbySelfOffsetZ = pz;
        this.lobbyRig.root.position.set(px, 0, pz);
      } else {
        const preset = getCharacterPresetByModelId(m.modelId);
        const rig = createCharacterRig(
          {
            ...this.currentCharConfig,
            id: preset.id,
            name: preset.name,
            modelId: preset.modelId,
            hairStyle: preset.hairStyle,
            vestEnabled: false,
            backpackEnabled: true,
          },
          this.textures.camoParachute,
          this.textures.contactShadow,
        );
        rig.setWeapon(null);
        rig.setBackWeapons(null, null);
        rig.root.position.set(px, 0, pz);
        this.lobbyScene.characterAnchor.add(rig.root);
        this.lobbyExtraRigs.push(rig);
      }
    }

    if (!placedSelf) {
      this.lobbySelfOffsetX = 0;
      this.lobbySelfOffsetZ = 0;
      this.lobbyRig.root.position.set(0, 0, 0);
    }
  }

  public setMatchMode(mode: MatchMode): void {
    this.matchMode = mode;
  }

  public getMatchMode(): MatchMode {
    return this.matchMode;
  }

  public setBrMapId(mapId: BrMapId): void {
    if (this.brMapId === mapId) return;
    this.brMapId = mapId;
    this.world.setActiveBrMap(mapId);
    this.rebuildSolidObstaclesNoTerrain();
    this.hudDirty = true;
  }

  public getBrMapId(): BrMapId {
    return this.brMapId;
  }

  public setGameVariant(variant: GameVariant): void {
    this.gameVariant = variant;
  }

  public getGameVariant(): GameVariant {
    return this.gameVariant;
  }

  public setGladiadoresFormat(format: GladiadoresFormat): void {
    this.gladiadoresFormat = format;
  }

  public getGladiadoresFormat(): GladiadoresFormat {
    return this.gladiadoresFormat;
  }

  public setGladiadoresTargetRounds(rounds: number): void {
    this.gladiadoresTargetRounds = Math.max(1, Math.min(9, Math.round(rounds)));
  }

  public getGladiadoresTargetRounds(): number {
    return this.gladiadoresTargetRounds;
  }

  public setAutoFillBots(fill: boolean): void {
    this.autoFillBots = fill;
  }

  public getAutoFillBots(): boolean {
    return this.autoFillBots;
  }

  public setRankedMode(ranked: boolean): void {
    this.isRanked = ranked;
  }

  public getRankedMode(): boolean {
    return this.isRanked;
  }

  private clearLoadTimers(): void {
    for (let i = 0; i < this.loadTimers.length; i++) {
      clearTimeout(this.loadTimers[i]);
    }
    this.loadTimers.length = 0;
  }

  public startBootSequence(onProgress: (pct: number, label: string) => void): void {
    this.onLoadProgress = onProgress;
    this.clearLoadTimers();
    this.stateMachine.forceState(GameState.BOOT);
    this.loadTimers.push(
      window.setTimeout(async () => {
        if (this.disposed) return;
        this.stateMachine.transition(GameState.LOADING);
        onProgress(22, 'Carregando ilha e terreno 3D...');

        const [, extAssets] = await Promise.all([
          preloadAdamAssets((pct, label) => {
            if (!this.disposed) onProgress(Math.min(72, pct), label);
          }),
          preloadExternalWorldAssets((pct, label) => {
            if (!this.disposed) onProgress(pct, label);
          }),
        ]);
        if (this.disposed) return;

        onProgress(82, 'Montando avião, lobby e arena Gladiadores...');
        this.world.attachExternalWorldModels(extAssets);
        this.world.setActiveBrMap(this.brMapId);
        this.rebuildSolidObstaclesNoTerrain();

        onProgress(88, 'Montando personagens 3D e equipamentos...');
        this.rebuildPlayerAndLobbyRigs();

        if (!this.isSoftwareGl && !this.contextLost) {
          this.renderer.compile(this.lobbyScene.scene, this.lobbyScene.camera);
        }

        onProgress(100, 'Pronto para sobreviver!');
        this.loadTimers.push(
          window.setTimeout(() => {
            if (!this.disposed) {
              this.stateMachine.transition(GameState.MENU);
            }
          }, 320),
        );
      }, 360),
    );
  }

  private beginMatchLoading(target: 'waiting' | 'playing' | 'gladiadores'): void {
    this.clearLoadTimers();
    this.onLoadProgress?.(
      10,
      target === 'gladiadores'
        ? 'Conectando à Arena Gladiadores...'
        : this.brMapId === 'bermuda'
          ? 'Conectando à Ilha Bermuda...'
          : 'Conectando à Orla de João Pessoa...',
    );
    this.stateMachine.forceState(GameState.LOADING);
    const steps =
      target === 'gladiadores'
        ? [
            { p: 38, t: 'Preparando arena de duelo 3D...' },
            { p: 72, t: 'Equipando duelistas e armamentos...' },
            { p: 100, t: 'Entrando na Arena!' },
          ]
        : [
            { p: 32, t: 'Preparando sobreviventes e equipes...' },
            { p: 64, t: 'Distribuindo armas, coletes e loots nas casas...' },
            { p: 90, t: 'Sincronizando avião e zona segura...' },
            { p: 100, t: 'Entrando na partida!' },
          ];
    steps.forEach((step, idx) => {
      this.loadTimers.push(
        window.setTimeout(() => {
          if (this.disposed) return;
          this.onLoadProgress?.(step.p, step.t);
          if (idx === steps.length - 1) {
            this.loadTimers.push(
              window.setTimeout(() => {
                if (this.disposed) return;
                if (target === 'waiting') {
                  this.stateMachine.forceState(GameState.WAITING);
                } else if (target === 'gladiadores') {
                  this.setupGladiadoresRound();
                  this.stateMachine.forceState(GameState.PLAYING);
                } else {
                  const spawnPoi =
                    this.brMapId === 'bermuda' && this.world.pois.length > 0
                      ? this.world.pois[0]
                      : { x: 0, z: -10 };
                  this.resetPlayerForMatch(spawnPoi.x, spawnPoi.z, false, true);
                  this.stateMachine.forceState(GameState.PLAYING);
                }
              }, 240),
            );
          }
        }, (idx + 1) * 260),
      );
    });
  }

  public startMatchmaking(): void {
    soundEngine.unlock();
    soundEngine.playUiConfirm();
    this.clearOnlineRoomState();
    this.gameVariant = 'br';
    this.matchmakingTimer = 0;
    this.stateMachine.forceState(GameState.MATCHMAKING);
  }

  public startGladiadoresMatch(): void {
    soundEngine.unlock();
    soundEngine.playUiConfirm();
    this.clearOnlineRoomState();
    this.gameVariant = 'gladiadores';
    this.gladRound = 1;
    this.gladPlayerScore = 0;
    this.gladEnemyScore = 0;
    this.gladPhase = 'intro';
    this.gladPhaseTimer = 1.8;
    this.gladBanner = 'RODADA 1 · PREPARE-SE!';
    this.gladPendingWinner = null;
    this.beginMatchLoading('gladiadores');
  }

  public startOnlineMatch(joinInfo: MatchRoomJoinInfo, partyAutoFill?: boolean): void {
    soundEngine.unlock();
    soundEngine.playUiConfirm();
    this.clearOnlineRoomState();
    this.gameVariant = 'br';

    this.onlineRoomId = joinInfo.roomId;
    this.onlineAccountId = joinInfo.yourAccountId;
    this.onlineHostAccountId = joinInfo.hostAccountId;
    this.onlineTeamId = joinInfo.yourTeamId;
    this.onlineSlotInTeam = joinInfo.yourSlotInTeam;
    this.onlineWaitingEndsAtMs = joinInfo.waitingEndsAtMs;
    this.onlinePlaneStartedAtMs = joinInfo.planeStartedAtMs;
    this.onlineAirplaneRoute = joinInfo.airplane;
    this.onlineHumanSlots = joinInfo.humans;

    if (joinInfo.mapId) {
      this.setBrMapId(joinInfo.mapId);
    }
    this.matchMode = joinInfo.mode;
    this.isRanked = joinInfo.isRanked;
    this.autoFillBots = partyAutoFill ?? joinInfo.autoFillBots;

    // Create 3D Adam/Eva rigs for up to 3 other online humans in this room
    for (let i = 0; i < joinInfo.humans.length; i++) {
      const slot = joinInfo.humans[i];
      if (slot.accountId === joinInfo.yourAccountId) continue;
      this.createRemotePlayerEntity(slot);
    }

    this.beginMatchLoading('waiting');
  }

  public cancelMatchmaking(): void {
    soundEngine.playUiClick(480);
    this.clearOnlineRoomState();
    void multiplayerClient.leaveMatch();
    this.stateMachine.forceState(GameState.LOBBY);
  }

  private clearOnlineRoomState(): void {
    this.onlineRoomId = null;
    this.onlineAccountId = 0;
    this.onlineHostAccountId = 0;
    this.onlineTeamId = 1;
    this.onlineSlotInTeam = 1;
    this.onlineWaitingEndsAtMs = 0;
    this.onlinePlaneStartedAtMs = 0;
    this.onlineAirplaneRoute = null;
    this.onlineHumanSlots = [];
    this.onlineSyncAccum = 0;
    this.onlineBotSyncAccum = 0;
    this.onlineSyncInFlight = false;
    this.pendingRoomActions.length = 0;
    this.syncedServerLootIds.clear();
    this.syncedServerGlooIds.clear();
    this.seenRemoteKillIds.clear();
    this.isSpectating = false;
    this.spectateTargetRef = null;
    this.spectateSnapNext = false;

    for (const entity of this.onlineRemotePlayers.values()) {
      this.world.scene.remove(entity.rig.root);
      entity.rig.dispose();
    }
    this.onlineRemotePlayers.clear();
  }

  private createRemotePlayerEntity(slot: RoomHumanSlot): RemoteHumanEntity {
    const existing = this.onlineRemotePlayers.get(slot.accountId);
    if (existing) return existing;

    const modelId = normalizeCharacterModelId(slot.character?.modelId);
    const preset = getCharacterPresetByModelId(modelId);
    const charCfg: CharacterConfig = {
      ...this.currentCharConfig,
      ...slot.character,
      id: preset.id,
      name: preset.name,
      modelId,
      vestEnabled: false,
      backpackEnabled: slot.character?.backpackEnabled ?? true,
    };
    const rig = createCharacterRig(
      charCfg,
      this.textures.camoParachute,
      this.textures.contactShadow,
    );
    const humanSlotIdx = this.onlineHumanSlots.findIndex((s) => s.accountId === slot.accountId);
    const spawnIdx = humanSlotIdx >= 0 ? humanSlotIdx : this.onlineRemotePlayers.size + 1;
    const spawnX = WAIT_SPAWN.x + ((spawnIdx % 5) - 2) * 1.45;
    const spawnY = WAIT_LOBBY_ORIGIN.y + 0.12;
    const spawnZ = WAIT_SPAWN.z + Math.floor(spawnIdx / 5) * 1.45;

    rig.setWeapon('g18');
    rig.setBackWeapons(null, null);
    rig.root.position.set(spawnX, spawnY, spawnZ);
    rig.root.visible = this.stateMachine.getState() === GameState.WAITING;

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const chestHit = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.98, 0.56), hitMat);
    chestHit.position.set(0, 1.05, 0);
    chestHit.userData.remoteAccountId = slot.accountId;
    chestHit.userData.isHeadshot = false;
    rig.root.add(chestHit);

    const headHit = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), hitMat);
    headHit.position.set(0, 1.66, 0);
    headHit.userData.remoteAccountId = slot.accountId;
    headHit.userData.isHeadshot = true;
    rig.root.add(headHit);

    this.world.scene.add(rig.root);

    const entity: RemoteHumanEntity = {
      accountId: slot.accountId,
      publicId: slot.publicId,
      nickname: slot.nickname,
      level: slot.level ?? 1,
      rankPoints: slot.rankPoints ?? 1000,
      modelId,
      teamId: slot.teamId,
      slotInTeam: slot.slotInTeam,
      isTeamLeader: Boolean(slot.isTeamLeader),
      rig,
      animator: new CharacterAnimator(),
      hitMeshes: [chestHit, headHit],
      targetPos: new THREE.Vector3(spawnX, spawnY, spawnZ),
      targetYaw: 0,
      lastState: null,
      lastWeaponId: 'g18',
    };
    this.onlineRemotePlayers.set(slot.accountId, entity);
    return entity;
  }

  private queueOrSendRoomAction(action: MatchRoomAction): void {
    if (!this.onlineRoomId) return;
    if (!multiplayerClient.sendWsAction(action)) {
      this.pendingRoomActions.push(action);
      if (this.pendingRoomActions.length > 24) {
        this.pendingRoomActions.shift();
      }
    }
  }

  private findOnlineTeamLeader(): RemoteHumanEntity | null {
    if (!this.onlineRoomId || this.matchMode === 'solo') return null;
    const selfSlot = this.onlineHumanSlots.find((s) => s.accountId === this.onlineAccountId);
    if (selfSlot?.isTeamLeader) return null;
    for (const entity of this.onlineRemotePlayers.values()) {
      if (entity.teamId === this.onlineTeamId && entity.isTeamLeader) {
        return entity;
      }
    }
    for (const entity of this.onlineRemotePlayers.values()) {
      if (entity.teamId === this.onlineTeamId && entity.slotInTeam === 1) {
        return entity;
      }
    }
    return null;
  }

  public toggleFollowLeader(): void {
    this.followingTeamLeader = !this.followingTeamLeader;
    if (
      this.followingTeamLeader &&
      this.stateMachine.getState() === GameState.AIRPLANE
    ) {
      const leader = this.findOnlineTeamLeader();
      if (
        leader?.lastState &&
        (leader.lastState.flightPhase === 'dropping' ||
          leader.lastState.flightPhase === 'parachute')
      ) {
        this.jumpFromPlane(true);
      }
    }
    this.hudDirty = true;
  }

  private findLivingOnlineTeammate(): RemoteHumanEntity | null {
    for (const entity of this.onlineRemotePlayers.values()) {
      if (entity.teamId !== this.onlineTeamId) continue;
      if (entity.lastState && !entity.lastState.eliminated) {
        return entity;
      }
    }
    return null;
  }

  private getSpectateCandidates(): Array<
    { kind: 'human'; accountId: number } | { kind: 'bot'; botId: string }
  > {
    const humanMates: Array<{ kind: 'human'; accountId: number }> = [];
    const otherHumans: Array<{ kind: 'human'; accountId: number }> = [];
    for (const entity of this.onlineRemotePlayers.values()) {
      if (!entity.lastState || entity.lastState.eliminated) continue;
      if (entity.teamId === this.onlineTeamId) {
        humanMates.push({ kind: 'human', accountId: entity.accountId });
      } else {
        otherHumans.push({ kind: 'human', accountId: entity.accountId });
      }
    }

    const allyBots: Array<{ kind: 'bot'; botId: string }> = [];
    const enemyBots: Array<{ kind: 'bot'; botId: string }> = [];
    for (let i = 0; i < this.world.targets.length; i++) {
      const b = this.world.targets[i];
      if (b.eliminated || b.downTimer > 0) continue;
      if (b.isAlly) {
        allyBots.push({ kind: 'bot', botId: b.id });
      } else {
        enemyBots.push({ kind: 'bot', botId: b.id });
      }
    }

    const ordered: Array<
      { kind: 'human'; accountId: number } | { kind: 'bot'; botId: string }
    > = [...humanMates, ...allyBots];

    const killer = this.lastAttackerRef;
    const isSameRef = (
      a: { kind: 'human'; accountId: number } | { kind: 'bot'; botId: string },
      b: { kind: 'human'; accountId: number } | { kind: 'bot'; botId: string },
    ) =>
      a.kind === b.kind &&
      (a.kind === 'human'
        ? a.accountId === (b as { kind: 'human'; accountId: number }).accountId
        : a.botId === (b as { kind: 'bot'; botId: string }).botId);

    if (killer) {
      const killerInOthers =
        (killer.kind === 'human' &&
          otherHumans.some((h) => h.accountId === killer.accountId)) ||
        (killer.kind === 'bot' &&
          enemyBots.some((b) => b.botId === killer.botId));
      if (killerInOthers && !ordered.some((o) => isSameRef(o, killer))) {
        ordered.push(killer);
      }
    }

    for (const h of otherHumans) {
      if (!ordered.some((o) => isSameRef(o, h))) ordered.push(h);
    }
    for (const b of enemyBots) {
      if (!ordered.some((o) => isSameRef(o, b))) ordered.push(b);
    }
    return ordered;
  }

  public cycleSpectateTarget(dir: -1 | 1 = 1): void {
    if (!this.isSpectating) return;
    const candidates = this.getSpectateCandidates();
    if (candidates.length <= 1) return;
    const cur = this.spectateTargetRef;
    const idx = cur
      ? candidates.findIndex(
          (c) =>
            c.kind === cur.kind &&
            (c.kind === 'human'
              ? c.accountId === (cur as { kind: 'human'; accountId: number }).accountId
              : c.botId === (cur as { kind: 'bot'; botId: string }).botId),
        )
      : 0;
    const baseIdx = idx >= 0 ? idx : 0;
    this.spectateTargetRef =
      candidates[(baseIdx + dir + candidates.length) % candidates.length];
    this.spectateSnapNext = true;
    this.hudDirty = true;
  }

  public sendSpectateLike(): void {
    if (!this.isSpectating || !this.spectateTargetRef) return;
    const ref = this.spectateTargetRef;
    const key = ref.kind === 'human' ? `h:${ref.accountId}` : `b:${ref.botId}`;
    if (this.likedSpectateTargets.has(key)) return;
    this.likedSpectateTargets.add(key);

    let nick = 'Jogador';
    if (ref.kind === 'human') {
      nick = this.onlineRemotePlayers.get(ref.accountId)?.nickname ?? nick;
    } else {
      nick = this.targetById.get(ref.botId)?.nick ?? nick;
    }
    this.likeToasts.push({
      id: this.nextLikeToastId++,
      nick: `Você curtiu ${nick}`,
      age: 0,
    });
    soundEngine.playUiClick();
    this.hudDirty = true;
  }

  public exitSpectateToResults(): void {
    if (this.onlineRoomId && this.findLivingOnlineTeammate()) {
      this.returnToLobby();
      return;
    }
    this.isSpectating = false;
    this.spectateTargetRef = null;
    this.stateMachine.forceState(GameState.GAMEOVER);
  }

  private handleMultiplayerEvent(ev: MultiplayerServerEvent): void {
    if (!this.onlineRoomId) return;

    if (ev.type === 'match_kicked' && (!ev.roomId || ev.roomId === this.onlineRoomId)) {
      this.returnToLobby();
      return;
    }

    if (ev.type === 'room_snapshot' && ev.snapshot.roomId === this.onlineRoomId) {
      this.applyRoomSnapshot(ev.snapshot);
      return;
    }

    if (ev.type === 'remote_shot') {
      const entity = this.onlineRemotePlayers.get(ev.accountId);
      const dist = entity
        ? entity.rig.root.position.distanceTo(this.pos)
        : Math.hypot(ev.originX - this.pos.x, ev.originZ - this.pos.z);
      if (dist < 140) {
        soundEngine.playGunshot(ev.weaponId, false);
      }
      _v1.set(ev.originX, ev.originY, ev.originZ);
      _v2.set(ev.hitX, ev.hitY, ev.hitZ);
      this.spawnTracer(_v1, _v2);
      return;
    }

    if (ev.type === 'incoming_damage') {
      if (this.isDead || this.isSpectating) return;
      const wShort = WEAPONS[ev.weaponId]?.shortName ?? 'ARMA';
      this.applyPlayerDamage(
        ev.damage,
        ev.fromX,
        ev.fromZ,
        ev.fromNickname,
        wShort,
        ev.isHeadshot,
      );
      return;
    }

    if (ev.type === 'revived_by_ally') {
      if (this.isPlayerDowned && !this.isDead) {
        this.isPlayerDowned = false;
        this.hp = 115;
        this.playerBleedHp = 100;
        this.pushKillFeed(ev.fromNickname, `${this.playerNick} SALVO`, 'REVIVE', false, true);
        soundEngine.completeMedkitAudio();
        this.hudDirty = true;
      }
      return;
    }

    if (ev.type === 'revive_from_shop_drop') {
      // Redeploy eliminated player right above the Vending Shop via parachute!
      this.isSpectating = false;
      this.spectateTargetRef = null;
      this.spectateSnapNext = false;
      this.playerDeathPlacement = null;
      this.isDead = false;
      this.isPlayerDowned = false;
      this.hp = this.maxHp;
      this.playerBleedHp = 100;
      const abRev = this.getActiveBounds();
      const dropX = THREE.MathUtils.clamp(ev.shopX, abRev.minX + 12, abRev.maxX - 12);
      const dropZ = THREE.MathUtils.clamp(ev.shopZ, abRev.minZ + 12, abRev.maxZ - 12);
      const seaFloor = this.isBermudaMapActive() ? BERMUDA_GLB_WATER_Y : 0;
      const groundY = Math.max(seaFloor, this.world.groundHeightAt(dropX, dropZ));
      this.pos.set(dropX, groundY + 95, dropZ);
      this.vel.set(0, -8.5, 0);
      this.isGrounded = false;
      this.weapons = {
        1: null,
        2: null,
        3: {
          weaponId: 'g18',
          ammoInMag: WEAPONS.g18.magSize,
          reserveAmmo: 45,
          scope: 'none',
          attachments: emptyAttachments(),
        },
      };
      this.activeSlot = 3;
      this.syncPlayerWeaponAndBackVisuals();
      soundEngine.playParachuteOpen();
      this.pushKillFeed('LOJINHA', `${this.playerNick} REDESDOBRADO`, 'LOJA', false, true);
      this.stateMachine.forceState(GameState.PARACHUTE);
      this.hudDirty = true;
      return;
    }

    if (ev.type === 'loot_collected') {
      if (!this.syncedServerLootIds.has(ev.lootId)) {
        this.syncedServerLootIds.add(ev.lootId);
        const lv = this.world.loots.find((l) => l.data.id === ev.lootId && !l.data.collected);
        if (lv) {
          lv.data.collected = true;
          lv.mesh.visible = false;
        }
      }
      return;
    }

    if (ev.type === 'gloo_spawned') {
      if (!this.syncedServerGlooIds.has(ev.wall.id)) {
        this.syncedServerGlooIds.add(ev.wall.id);
        this.spawnGlooWallAt(
          ev.wall.x,
          ev.wall.y,
          ev.wall.z,
          ev.wall.rotY,
          true,
          ev.wall.skin === 'ffwc' ? 'ffwc' : 'classic',
        );
      }
      return;
    }

    if (ev.type === 'kill_feed_event') {
      if (!this.seenRemoteKillIds.has(ev.entry.id)) {
        this.seenRemoteKillIds.add(ev.entry.id);
        this.pushKillFeed(
          ev.entry.killerName,
          ev.entry.victimName,
          ev.entry.weaponShort,
          ev.entry.isHeadshot,
          ev.entry.killerAccountId === this.onlineAccountId,
        );
      }
      return;
    }

    if (ev.type === 'remote_bot_damage' && this.onlineAccountId === this.onlineHostAccountId) {
      const bot = this.targetById.get(ev.botId);
      if (bot) {
        this.applyBotHitDamage(
          bot,
          ev.damage,
          false,
          ev.fromNickname,
          ev.weaponShort,
          ev.isHeadshot,
          ev.attackerX,
          ev.attackerZ,
        );
      }
      return;
    }

    if (
      ev.type === 'spectate_damage_event' &&
      this.isSpectating &&
      this.spectateTargetRef?.kind === 'human' &&
      this.spectateTargetRef.accountId === ev.attackerAccountId
    ) {
      let hasHitPos = false;
      if (ev.botId) {
        const b = this.targetById.get(ev.botId);
        if (b) {
          this.getBotBodyPoint(b, ev.isHeadshot ? 'head' : 'chest', _v2);
          hasHitPos = true;
        }
      } else if (ev.targetAccountId) {
        const ent = this.onlineRemotePlayers.get(ev.targetAccountId);
        if (ent) {
          _v2.set(
            ent.rig.root.position.x,
            ent.rig.root.position.y + (ev.isHeadshot ? 1.55 : 1.08),
            ent.rig.root.position.z,
          );
          hasHitPos = true;
        }
      }
      if (hasHitPos) {
        this.pushDamagePopup(_v2, ev.damage, ev.isHeadshot, 0);
      }
      this.hitmarkerTimer = 0.2;
      if (ev.isHeadshot) {
        this.headshotFlashTimer = 0.45;
      }
      soundEngine.playHitmarker();
    }
  }

  private applyRoomSnapshot(snap: MatchRoomSnapshot): void {
    this.onlineHostAccountId = snap.hostAccountId;
    this.onlineWaitingEndsAtMs = snap.waitingEndsAtMs;
    this.onlinePlaneStartedAtMs = snap.planeStartedAtMs;
    this.onlineAirplaneRoute = snap.airplane;

    // 1. Update Remote Human Entities (including late joiners during waiting countdown)
    const presentAccounts = new Set<number>();
    for (let i = 0; i < snap.humans.length; i++) {
      const rh = snap.humans[i];
      if (rh.accountId === this.onlineAccountId) continue;
      presentAccounts.add(rh.accountId);
      let entity = this.onlineRemotePlayers.get(rh.accountId);
      if (!entity) {
        entity = this.createRemotePlayerEntity({
          accountId: rh.accountId,
          publicId: rh.publicId,
          nickname: rh.nickname,
          teamId: rh.teamId,
          slotInTeam: rh.slotInTeam,
          character: rh.character,
        });
      }
      const inWaitingState = this.stateMachine.getState() === GameState.WAITING;
      const inWaitArea =
        Math.hypot(rh.x - WAIT_LOBBY_ORIGIN.x, rh.z - WAIT_LOBBY_ORIGIN.z) <= 120;
      if (!inWaitingState || inWaitArea) {
        entity.targetPos.set(rh.x, rh.y, rh.z);
        entity.targetYaw = rh.yaw;
      }
      entity.lastState = rh;
      if (typeof rh.level === 'number') entity.level = rh.level;
      if (typeof rh.rankPoints === 'number') entity.rankPoints = rh.rankPoints;
      if (typeof rh.isTeamLeader === 'boolean') entity.isTeamLeader = rh.isTeamLeader;
      if (entity.lastWeaponId !== rh.weaponId) {
        entity.lastWeaponId = rh.weaponId;
        entity.rig.setWeapon(rh.weaponId);
        if (rh.weaponId) {
          entity.animator.triggerWeaponDraw();
        }
      }
      entity.rig.setParachuteVisible(rh.flightPhase === 'parachute');
      entity.rig.setSurfboardVisible(rh.isOnSurfboard);
    }
    for (const [accId, ent] of this.onlineRemotePlayers.entries()) {
      if (!presentAccounts.has(accId)) {
        ent.rig.root.visible = false;
        if (ent.lastState) {
          ent.lastState.eliminated = true;
        }
      }
    }

    // 2. Shared Vehicles (driven by other remote humans)
    for (let i = 0; i < snap.vehicles.length; i++) {
      const rv = snap.vehicles[i];
      if (rv.id === this.activeVehicleId) continue;
      const veh = this.world.vehicles.find((v) => v.id === rv.id);
      if (!veh) continue;
      if (rv.driverAccountId !== null && rv.driverAccountId !== this.onlineAccountId) {
        veh.x = rv.x;
        veh.y = rv.y;
        veh.z = rv.z;
        veh.yaw = rv.yaw;
        veh.speed = rv.speed;
        veh.hp = rv.hp;
        veh.destroyed = rv.destroyed;
        veh.group.position.set(rv.x, rv.y, rv.z);
        veh.group.rotation.y = rv.yaw;
        veh.collider.cx = rv.x;
        veh.collider.cz = rv.z;
        veh.collider.rotY = rv.yaw;
        veh.collider.minY = rv.y;
        veh.collider.maxY = rv.y + 2.05;
      }
    }

    // 3. Shared Ground Loot Collected State
    for (let i = 0; i < snap.collectedLootIds.length; i++) {
      const lid = snap.collectedLootIds[i];
      if (this.syncedServerLootIds.has(lid)) continue;
      this.syncedServerLootIds.add(lid);
      const lv = this.world.loots.find((l) => l.data.id === lid && !l.data.collected);
      if (lv) {
        lv.data.collected = true;
        lv.mesh.visible = false;
      }
    }

    // 4. Shared Safe Zone (when in PLAYING)
    if (this.stateMachine.getState() === GameState.PLAYING) {
      this.zonePhase = snap.safeZone.phase;
      this.zoneIsShrinking = snap.safeZone.isShrinking;
      this.zoneTimer = snap.safeZone.timerSec;
      this.zoneCurrentX = snap.safeZone.currentX;
      this.zoneCurrentZ = snap.safeZone.currentZ;
      this.zoneCurrentRadius = snap.safeZone.currentRadius;
      this.zoneNextX = snap.safeZone.nextX;
      this.zoneNextZ = snap.safeZone.nextZ;
      this.zoneNextRadius = snap.safeZone.nextRadius;
    }

    // 5. Shared Bots when client is NOT the room host
    if (this.onlineAccountId !== this.onlineHostAccountId && snap.bots.length > 0) {
      const isWaitNow = this.stateMachine.getState() === GameState.WAITING;
      let activeWaitBotCount = 0;
      for (let i = 0; i < snap.bots.length; i++) {
        const rb = snap.bots[i];
        const bot = this.targetById.get(rb.id);
        if (!bot) continue;
        bot.hp = rb.hp;
        bot.isDowned = rb.isDowned;
        bot.bleedHp = rb.bleedHp;
        bot.eliminated = rb.eliminated;
        bot.kills = rb.kills ?? bot.kills;
        if (bot.weaponId !== rb.weaponId) {
          bot.weaponId = rb.weaponId;
          bot.drawTimer = WEAPON_DRAW_DURATION;
          bot.animator?.triggerWeaponDraw();
          setBotWeaponVisual(bot, bot.weaponId, getBotBackWeapon(bot));
        }
        if (rb.eliminated || rb.hidden) {
          bot.waitingActive = false;
          bot.group.visible = false;
          if (bot.parachuteMesh) bot.parachuteMesh.visible = false;
          continue;
        }
        if (!bot.waitingActive) {
          bot.group.position.set(rb.x, rb.y, rb.z);
          bot.group.rotation.y = rb.yaw;
          bot.waitingActive = true;
        } else {
          bot.group.position.lerp(_v1.set(rb.x, rb.y, rb.z), 0.45);
          bot.group.rotation.y = lerpAngle(bot.group.rotation.y, rb.yaw, 0.45);
        }
        bot.airState = rb.inParachute ? 'parachuting' : 'ground';
        if (bot.parachuteMesh) bot.parachuteMesh.visible = rb.inParachute;
        const dSq =
          (bot.group.position.x - this.pos.x) * (bot.group.position.x - this.pos.x) +
          (bot.group.position.z - this.pos.z) * (bot.group.position.z - this.pos.z);
        bot.group.visible = isWaitNow || bot.isAlly || dSq <= 150 * 150;
        if (isWaitNow && bot.group.visible) {
          activeWaitBotCount++;
        }
      }
      this.aliveCount = isWaitNow
        ? Math.min(
            BattleRoyaleEngine.MAX_WAIT_LOBBY_PEOPLE,
            1 + this.onlineRemotePlayers.size + activeWaitBotCount,
          )
        : snap.aliveCount;
    }

    // 6. Kill feed catch-up
    for (let i = 0; i < snap.killFeed.length; i++) {
      const kf = snap.killFeed[i];
      if (!this.seenRemoteKillIds.has(kf.id)) {
        this.seenRemoteKillIds.add(kf.id);
        this.pushKillFeed(
          kf.killerName,
          kf.victimName,
          kf.weaponShort,
          kf.isHeadshot,
          kf.killerAccountId === this.onlineAccountId,
        );
      }
    }

    // 7. Gloo walls catch-up
    for (let i = 0; i < snap.glooWalls.length; i++) {
      const gw = snap.glooWalls[i];
      if (!this.syncedServerGlooIds.has(gw.id)) {
        this.syncedServerGlooIds.add(gw.id);
        this.spawnGlooWallAt(
          gw.x,
          gw.y,
          gw.z,
          gw.rotY,
          true,
          gw.skin === 'ffwc' ? 'ffwc' : 'classic',
        );
      }
    }
  }

  private pushOnlineSyncState(dt: number): void {
    if (!this.onlineRoomId) return;
    this.onlineSyncAccum += dt;
    this.onlineBotSyncAccum += dt;
    if (this.onlineSyncAccum < 0.05) return; // 50ms sync interval
    this.onlineSyncAccum = 0;

    const state = this.stateMachine.getState();
    const flightPhase: RemoteFlightPhase =
      state === GameState.WAITING
        ? 'waiting'
        : state === GameState.AIRPLANE
          ? 'airplane'
          : state === GameState.DROPPING
            ? 'dropping'
            : state === GameState.PARACHUTE
              ? 'parachute'
              : 'landed';

    const activeW = this.getActiveWeaponState();
    const activeVeh = this.activeVehicleId
      ? this.world.vehicles.find((v) => v.id === this.activeVehicleId) ?? null
      : null;

    let botsPayload: RemoteBotSync[] | undefined;
    if (this.onlineAccountId === this.onlineHostAccountId && this.onlineBotSyncAccum >= 0.1) {
      this.onlineBotSyncAccum = 0;
      botsPayload = this.world.targets.map((b) => ({
        id: b.id,
        x: Math.round(b.group.position.x * 100) / 100,
        y: Math.round(b.group.position.y * 100) / 100,
        z: Math.round(b.group.position.z * 100) / 100,
        yaw: Math.round(b.group.rotation.y * 1000) / 1000,
        hp: Math.round(b.hp),
        maxHp: b.maxHp,
        isDowned: b.isDowned,
        bleedHp: Math.round(b.bleedHp),
        eliminated: b.eliminated,
        weaponId: b.weaponId,
        stance: b.isDowned ? 'crouch' : 'stand',
        inParachute: b.airState === 'parachuting',
        isSwimming: b.group.position.y < -0.15,
        kills: b.kills ?? 0,
        hidden: state === GameState.WAITING ? !b.waitingActive : false,
      }));
    }

    const push: ClientMatchStatePush = {
      x: Math.round(this.pos.x * 100) / 100,
      y: Math.round(this.pos.y * 100) / 100,
      z: Math.round(this.pos.z * 100) / 100,
      yaw: Math.round(this.characterYaw * 1000) / 1000,
      pitch: Math.round(this.pitch * 1000) / 1000,
      stance: this.stance,
      isSprinting: this.isSprinting,
      isAiming: this.isAiming,
      inWater: this.inWater,
      isSwimming: this.isSwimming,
      isOnSurfboard: this.isOnSurfboard,
      flightPhase,
      weaponId: activeW ? activeW.weaponId : null,
      ammoInMag: activeW ? activeW.ammoInMag : 0,
      reserveAmmo: activeW ? activeW.reserveAmmo : 0,
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      vestLevel: this.vestLevel,
      helmetLevel: this.helmetLevel,
      isDowned: this.isPlayerDowned,
      bleedHp: Math.round(this.playerBleedHp),
      eliminated: this.isDead,
      kills: this.kills,
      activeVehicleId: this.activeVehicleId,
      vehicleState: activeVeh
        ? {
            id: activeVeh.id,
            x: Math.round(activeVeh.x * 100) / 100,
            y: Math.round(activeVeh.y * 100) / 100,
            z: Math.round(activeVeh.z * 100) / 100,
            yaw: Math.round(activeVeh.yaw * 1000) / 1000,
            speed: Math.round(activeVeh.speed * 100) / 100,
            hp: Math.round(activeVeh.hp),
            destroyed: activeVeh.destroyed,
          }
        : null,
      bots: botsPayload,
      aliveCountHint: this.onlineAccountId === this.onlineHostAccountId ? this.aliveCount : undefined,
    };

    const sentWs = multiplayerClient.sendWsState(push);
    if (!sentWs && !this.onlineSyncInFlight) {
      this.onlineSyncInFlight = true;
      const acts = this.pendingRoomActions.splice(0, this.pendingRoomActions.length);
      void multiplayerClient
        .syncRoomHttp(this.onlineRoomId, push, acts.length > 0 ? acts : undefined)
        .catch((err: unknown) => {
          const status = (err as { status?: number } | null)?.status;
          if (status === 404 && this.onlineRoomId) {
            this.returnToLobby();
          }
        })
        .finally(() => {
          this.onlineSyncInFlight = false;
        });
    } else if (sentWs && this.pendingRoomActions.length > 0) {
      const acts = this.pendingRoomActions.splice(0, this.pendingRoomActions.length);
      for (let i = 0; i < acts.length; i++) {
        multiplayerClient.sendWsAction(acts[i]);
      }
    }
  }

  private updateRemoteHumanEntities(dt: number, state: GameState): void {
    const smooth = 1 - Math.exp(-16 * dt);
    const showInGround =
      state === GameState.WAITING ||
      state === GameState.PLAYING ||
      state === GameState.DROPPING ||
      state === GameState.PARACHUTE;

    for (const entity of this.onlineRemotePlayers.values()) {
      const st = entity.lastState;
      if (!showInGround || st?.eliminated || st?.flightPhase === 'airplane') {
        entity.rig.root.visible = false;
        continue;
      }
      if (!st) {
        if (state !== GameState.WAITING) {
          entity.rig.root.visible = false;
          continue;
        }
        entity.rig.root.visible = true;
        entity.rig.root.position.lerp(entity.targetPos, smooth);
        entity.animator.update(entity.rig, {
          dt,
          speed: 0,
          stance: 'stand',
          isGrounded: true,
          isSprinting: false,
          isAiming: false,
          isFiring: false,
          isLobby: false,
          isSkydiving: false,
          isParachuting: false,
          isDead: false,
          isDriving: false,
          isSwimming: false,
          isOnSurfboard: false,
          hasWeapon: true,
          hasMoveInput: false,
          weaponCategory: 'HG',
          pitchRad: 0,
        });
        continue;
      }
      entity.rig.root.visible = true;
      const prevPos = entity.rig.root.position;
      const dx = entity.targetPos.x - prevPos.x;
      const dz = entity.targetPos.z - prevPos.z;
      const moveSpeed = Math.min(18, Math.hypot(dx, dz) / Math.max(0.016, dt));
      prevPos.lerp(entity.targetPos, smooth);
      entity.rig.root.rotation.y = lerpAngle(entity.rig.root.rotation.y, entity.targetYaw + Math.PI, smooth);

      const remoteDef = st.weaponId ? WEAPONS[st.weaponId] : null;
      entity.animator.update(entity.rig, {
        dt,
        speed: moveSpeed,
        stance: st.stance,
        isGrounded: st.flightPhase === 'landed' || st.flightPhase === 'waiting',
        isSprinting: st.isSprinting,
        isAiming: st.isAiming,
        isFiring: false,
        isLobby: false,
        isSkydiving: st.flightPhase === 'dropping',
        isParachuting: st.flightPhase === 'parachute',
        isDead: st.isDowned || st.eliminated,
        isDriving: Boolean(st.activeVehicleId),
        isSwimming: st.isSwimming,
        isOnSurfboard: st.isOnSurfboard,
        hasWeapon: st.weaponId !== null,
        hasMoveInput: moveSpeed > 0.35,
        weaponCategory: remoteDef ? remoteDef.category : null,
        pitchRad: st.pitch,
      });
    }
  }

  public startQuickTraining(): void {
    soundEngine.unlock();
    soundEngine.playUiConfirm();
    this.gameVariant = 'br';
    this.beginMatchLoading('playing');
  }

  public skipWaitingToPlane(): void {
    soundEngine.playUiConfirm();
    this.enterAirplanePhase();
  }

  public jumpFromPlane(fromLeaderFollow = false): void {
    if (this.stateMachine.getState() !== GameState.AIRPLANE) return;
    if (!fromLeaderFollow && this.airplaneProgress < 0.08) return;
    if (!fromLeaderFollow) {
      this.followingTeamLeader = false;
    }
    soundEngine.playJump();
    this.vel.set(0, -4, 0);
    this.stateMachine.transition(GameState.DROPPING);

    // Allies jump simultaneously with player in V-formation!
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const formOffsets: Array<[number, number]> = [
      [-3.2, -2.6],
      [3.2, -2.6],
      [0.0, -4.6],
    ];
    let allyIdx = 0;
    for (let i = 0; i < this.world.targets.length; i++) {
      const b = this.world.targets[i];
      if (!b.isAlly || b.eliminated) continue;
      const [rx, fx] = formOffsets[allyIdx % formOffsets.length];
      allyIdx++;
      b.airState = 'skydiving';
      b.vy = -4;
      b.group.visible = true;
      if (b.parachuteMesh) b.parachuteMesh.visible = false;
      b.group.position.set(
        this.pos.x + rightX * rx + fwdX * fx,
        this.pos.y - 0.8,
        this.pos.z + rightZ * rx + fwdZ * fx,
      );
      b.group.rotation.y = this.yaw + Math.PI;
    }
  }

  public openParachute(): void {
    if (this.stateMachine.getState() !== GameState.DROPPING) return;
    soundEngine.playParachuteOpen();
    this.vel.y = Math.max(this.vel.y, -9);
    this.stateMachine.transition(GameState.PARACHUTE);

    // Allies pop camo parachutes in synchronized formation
    for (let i = 0; i < this.world.targets.length; i++) {
      const b = this.world.targets[i];
      if (!b.isAlly || b.eliminated) continue;
      if (b.airState === 'skydiving' || b.airState === 'inPlane') {
        b.airState = 'parachuting';
        b.vy = Math.max(b.vy, -9);
        b.group.visible = true;
        if (b.parachuteMesh) b.parachuteMesh.visible = true;
      }
    }
  }

  public returnToLobby(): void {
    this.clearLoadTimers();
    this.exitVehicleImmediate();
    soundEngine.stopVehicleAudio();
    this.input.setGameplayActive(false);
    if (this.onlineRoomId) {
      this.clearOnlineRoomState();
      void multiplayerClient.leaveMatch();
    }
    this.stateMachine.forceState(GameState.LOBBY);
  }

  private eliminatePlayerAndSquad(
    attackerName: string,
    weaponShort: string,
    isHead = false,
  ): void {
    if (this.isDead) return;
    this.exitVehicleImmediate();
    soundEngine.stopVehicleAudio();
    soundEngine.stopRunAudio();
    soundEngine.stopMedkitAudio();
    this.isPlayerDowned = false;
    this.playerBleedHp = 0;
    this.playerRevivingAllyId = null;
    this.hp = 0;
    this.isDead = true;
    this.deathTimer = 1.6;
    this.input.setGameplayActive(false);
    this.pushKillFeed(attackerName, this.playerNick, weaponShort, isHead, false);
    if (this.onlineRoomId) {
      this.queueOrSendRoomAction({
        type: 'kill_feed',
        killerName: attackerName,
        victimName: this.playerNick,
        weaponShort,
        isHeadshot: isHead,
      });
    }

    this.playerDeathPlacement = Math.max(2, this.aliveCount);
    this.lastAttackerRef = null;
    for (const entity of this.onlineRemotePlayers.values()) {
      if (entity.nickname === attackerName && entity.lastState && !entity.lastState.eliminated) {
        this.lastAttackerRef = { kind: 'human', accountId: entity.accountId };
        break;
      }
    }
    if (!this.lastAttackerRef) {
      for (let i = 0; i < this.world.targets.length; i++) {
        const b = this.world.targets[i];
        if (b.nick === attackerName && !b.eliminated && b.downTimer <= 0) {
          this.lastAttackerRef = { kind: 'bot', botId: b.id };
          break;
        }
      }
    }

    // Check if an online teammate is still alive -> immediately enter Spectator mode
    if (this.onlineRoomId && this.matchMode !== 'solo') {
      const livingHumanMate = this.findLivingOnlineTeammate();
      if (livingHumanMate) {
        this.isSpectating = true;
        this.spectateTargetRef = { kind: 'human', accountId: livingHumanMate.accountId };
        this.spectateSnapNext = true;
        this.deathTimer = 0;
        this.hudDirty = true;
        return;
      }
    }

    // Team wipe: eliminate any already-downed teammates on team 0
    const bots = this.world.targets;
    for (let i = 0; i < bots.length; i++) {
      const mate = bots[i];
      if (mate.teamId === 0 && mate.isDowned && !mate.eliminated) {
        mate.isDowned = false;
        mate.bleedHp = 0;
        mate.downTimer = 1.4;
        this.aliveCount = Math.max(1, this.aliveCount - 1);
        this.pushKillFeed(attackerName, mate.nick, weaponShort, false, false);
      }
    }

    if (this.gameVariant === 'gladiadores' && this.gladPhase === 'fight') {
      const anyAllyAlive = this.hasStandingTeammate(0, 'player');
      if (!anyAllyAlive && !this.gladPendingWinner) {
        this.gladEnemyScore += 1;
        this.gladPendingWinner = 'enemy';
        this.gladPhase = 'round_end';
        this.gladPhaseTimer = 2.2;
        this.gladBanner =
          this.gladEnemyScore >= this.gladiadoresTargetRounds
            ? 'DERROTA NA ARENA'
            : 'DERROTA NA RODADA';
        this.hudDirty = true;
      }
    }
  }

  private handlePlayerZeroHp(
    attackerName: string,
    weaponShort: string,
    isHead = false,
  ): void {
    if (this.isDead || this.isPlayerDowned) return;
    const isPlaying = this.stateMachine.getState() === GameState.PLAYING;
    const hasOnlineStandingMate = Boolean(
      this.onlineRoomId &&
        this.matchMode !== 'solo' &&
        Array.from(this.onlineRemotePlayers.values()).some(
          (e) => e.teamId === this.onlineTeamId && e.lastState && !e.lastState.eliminated && !e.lastState.isDowned,
        ),
    );
    if (
      isPlaying &&
      this.matchMode !== 'solo' &&
      (hasOnlineStandingMate || this.hasStandingTeammate(0, 'player'))
    ) {
      this.exitVehicleImmediate();
      soundEngine.stopVehicleAudio();
      soundEngine.stopRunAudio();
      soundEngine.stopMedkitAudio();
      this.isPlayerDowned = true;
      this.playerBleedHp = 100;
      this.playerRevivingAllyId = null;
      this.hp = 0;
      this.isAiming = false;
      this.usingMedkit = false;
      this.medkitTimer = 0;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.isPlacingGloo = false;
      this.isHoldingGrenade = false;
      this.revivingBotId = null;
      this.reviveTimer = 0;
      this.lockedTargetId = null;
      this.pushKillFeed(`${attackerName} (DERRUBOU)`, this.playerNick, weaponShort, isHead, false);
      return;
    }
    this.eliminatePlayerAndSquad(attackerName, weaponShort, isHead);
  }

  private applyPlayerDamage(
    rawDmg: number,
    attackerX: number,
    attackerZ: number,
    attackerName: string,
    weaponShort: string,
    isHead = false,
  ): void {
    if (this.isDead) return;

    if (this.isPlayerDowned) {
      const bleedDmg = Math.max(1, Math.round(rawDmg * 1.1));
      this.playerBleedHp = Math.max(0, this.playerBleedHp - bleedDmg);
      this.damageFlashTimer = 0.2;
      this.camShake = Math.max(this.camShake, 0.14);
      this.animator.triggerHit();
      if (this.damageIndicators.length >= 6) {
        this.damageIndicators.shift();
      }
      this.damageIndicators.push({
        id: this.nextDamageIndicatorId++,
        worldX: attackerX,
        worldZ: attackerZ,
        age: 0,
      });
      soundEngine.playDamage();
      if (this.playerBleedHp <= 0) {
        this.eliminatePlayerAndSquad(attackerName, weaponShort, isHead);
      }
      return;
    }

    let dmg = rawDmg;
    if (isHead && this.helmetLevel > 0 && this.helmetHp > 0) {
      const red = [0, 0.25, 0.38, 0.5][this.helmetLevel];
      this.helmetHp = Math.max(0, this.helmetHp - Math.round(rawDmg * 0.42));
      if (this.helmetHp === 0) this.helmetLevel = 0;
      dmg = Math.max(1, Math.round(rawDmg * (1 - red)));
    } else if (!isHead && this.vestLevel > 0 && this.vestHp > 0) {
      const red = [0, 0.2, 0.35, 0.48][this.vestLevel];
      this.vestHp = Math.max(0, this.vestHp - Math.round(rawDmg * 0.38));
      if (this.vestHp === 0) this.vestLevel = 0;
      dmg = Math.max(1, Math.round(rawDmg * (1 - red)));
    }

    this.hp = Math.max(0, this.hp - dmg);
    this.damageFlashTimer = 0.2;
    this.camShake = Math.max(this.camShake, 0.16);
    this.animator.triggerHit();
    if (this.damageIndicators.length >= 6) {
      this.damageIndicators.shift();
    }
    this.damageIndicators.push({
      id: this.nextDamageIndicatorId++,
      worldX: attackerX,
      worldZ: attackerZ,
      age: 0,
    });
    soundEngine.playDamage();

    if (this.hp <= 0) {
      this.handlePlayerZeroHp(attackerName, weaponShort, isHead);
    }
  }

  public applyTestDamage(amount: number): void {
    if (this.isDead) return;
    if (this.isPlayerDowned) {
      this.playerBleedHp = Math.max(0, this.playerBleedHp - amount);
      this.damageFlashTimer = 0.25;
      this.camShake = 0.2;
      this.animator.triggerHit();
      soundEngine.playDamage();
      if (this.playerBleedHp <= 0) {
        this.eliminatePlayerAndSquad('TESTE', 'TESTE', false);
      }
      return;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlashTimer = 0.25;
    this.camShake = 0.22;
    this.animator.triggerHit();
    soundEngine.playDamage();
    if (this.hp <= 0) {
      this.handlePlayerZeroHp('TESTE', 'TESTE', false);
    }
  }

  public triggerVictory(): void {
    this.exitVehicleImmediate();
    soundEngine.stopVehicleAudio();
    this.input.setGameplayActive(false);
    soundEngine.playUiConfirm();
    this.stateMachine.forceState(GameState.WIN);
  }

  private onStateEntered(state: GameState): void {
    const playable =
      state === GameState.WAITING ||
      state === GameState.DROPPING ||
      state === GameState.PARACHUTE ||
      state === GameState.PLAYING;
    this.input.setGameplayActive(playable);

    if (state !== GameState.WAITING && state !== GameState.PLAYING) {
      soundEngine.stopRunAudio();
      soundEngine.stopMedkitAudio();
      soundEngine.stopVehicleAudio();
    }

    if (state === GameState.WAITING) {
      this.resetPlayerForWaiting();
    } else if (state === GameState.AIRPLANE) {
      this.enterAirplanePhase();
    } else if (state === GameState.LOBBY || state === GameState.MENU) {
      this.lobbyOrbitYaw = 0;
    }
  }

  private getActiveWeaponState(): WeaponSlotState | null {
    return this.activeSlot === 4 ? null : this.weapons[this.activeSlot];
  }

  private syncPlayerWeaponAndBackVisuals(): void {
    const activeW = this.getActiveWeaponState();
    this.playerRig.setWeapon(activeW ? activeW.weaponId : null);

    // Put carried non-active primary firearms on upper back & non-active pistol on lower-back holster
    const holstered: WeaponId[] = [];
    const primaryOrder: readonly (1 | 2)[] = [1, 2];
    for (let i = 0; i < primaryOrder.length; i++) {
      const s = primaryOrder[i];
      if (s !== this.activeSlot && this.weapons[s]) {
        holstered.push(this.weapons[s]!.weaponId);
      }
    }
    this.playerRig.setBackWeapons(holstered[1] ?? null, holstered[0] ?? null);
    const holsteredPistol =
      this.activeSlot !== 3 && this.weapons[3] ? this.weapons[3]!.weaponId : null;
    this.playerRig.setPistolBackWeapon?.(holsteredPistol);
  }

  private performSlotSwitch(slot: WeaponSlotId): boolean {
    if (this.isDead || this.isPlayerDowned) return false;
    if (slot !== 4 && !this.weapons[slot]) return false;
    this.isPlacingGloo = false;
    this.isHoldingGrenade = false;
    if (slot === this.activeSlot) return false;

    const prevSlot = this.activeSlot;
    if (prevSlot === 4 || this.weapons[prevSlot]) {
      this.prevWeaponSlot = prevSlot;
    }
    this.activeSlot = slot;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.lockedTargetId = null;
    this.aimBreakAccum = 0;
    this.bugDoCapaTimer = 0;
    this.consecutiveShots = 0;

    // Free Fire Double-AWM / Quick-Swap fluidity: switching guns cancels long bolt/pump lock
    const newW = this.getActiveWeaponState();
    if (newW) {
      const newDef = WEAPONS[newW.weaponId];
      if (newDef.category === 'SR' || newDef.category === 'SG') {
        const nowMs = performance.now();
        const minReadyThreshold = nowMs - Math.max(0, newDef.fireRateMs - 200);
        if (this.slotLastShotTime[slot] > minReadyThreshold) {
          this.slotLastShotTime[slot] = minReadyThreshold;
        }
      }
      if (newDef.category === 'HG') {
        this.isAiming = false;
        this.input.setTouchAim(false);
      }
    } else {
      this.isAiming = false;
      this.input.setTouchAim(false);
    }

    this.syncPlayerWeaponAndBackVisuals();
    if (slot !== 4 && newW) {
      this.animator.triggerWeaponDraw();
    }
    soundEngine.playWeaponSwitch();
    this.hudDirty = true;
    return true;
  }

  public quickSwapWeapon(): boolean {
    const candidates: WeaponSlotId[] = [];
    if (this.prevWeaponSlot !== this.activeSlot && (this.prevWeaponSlot === 4 || this.weapons[this.prevWeaponSlot])) {
      candidates.push(this.prevWeaponSlot);
    }
    const fallbackOrder: readonly WeaponSlotId[] = [1, 2, 3, 4];
    for (let i = 0; i < fallbackOrder.length; i++) {
      const s = fallbackOrder[i];
      if (s !== this.activeSlot && (s === 4 || this.weapons[s])) {
        candidates.push(s);
      }
    }
    for (let i = 0; i < candidates.length; i++) {
      if (this.performSlotSwitch(candidates[i])) return true;
    }
    return false;
  }

  public selectWeaponSlot(slot: WeaponSlotId): void {
    this.performSlotSwitch(slot);
  }

  public setActiveWeaponScope(scope: ScopeType): void {
    const active = this.getActiveWeaponState();
    if (!active) return;
    const def = WEAPONS[active.weaponId];
    if (!def.allowsCustomScope) return;
    if (!this.ownedScopes.includes(scope)) return;
    active.scope = scope;
    this.hudDirty = true;
    soundEngine.playUiClick(740);
  }

  public cycleActiveWeaponScope(): void {
    const active = this.getActiveWeaponState();
    if (!active) return;
    const def = WEAPONS[active.weaponId];
    if (!def.allowsCustomScope) return;
    const idx = this.ownedScopes.indexOf(active.scope);
    const next = this.ownedScopes[(idx + 1) % this.ownedScopes.length];
    active.scope = next;
    this.hudDirty = true;
    soundEngine.playUiClick(740);
  }

  public useMedkit(): void {
    const state = this.stateMachine.getState();
    if (state !== GameState.PLAYING && state !== GameState.WAITING) return;
    if (this.isDead || this.isPlayerDowned || this.usingMedkit || this.isSwimming) return;
    if (this.hp >= this.maxHp) return;
    if (this.medkitCount <= 0) {
      if (this.smallkitCount > 0) {
        this.useSmallKit();
      }
      return;
    }
    this.usingMedkit = true;
    this.healingKind = 'medkit';
    this.medkitTimer = this.medkitDuration;
    this.isReloading = false;
    this.hudDirty = true;
    soundEngine.startMedkitAudio();
  }

  public useSmallKit(): void {
    const state = this.stateMachine.getState();
    if (state !== GameState.PLAYING && state !== GameState.WAITING) return;
    if (this.isDead || this.isPlayerDowned || this.usingMedkit || this.isSwimming) return;
    if (this.smallkitCount <= 0 || this.hp >= this.maxHp) return;
    this.usingMedkit = true;
    this.healingKind = 'smallkit';
    this.medkitTimer = this.smallkitDuration;
    this.isReloading = false;
    this.hudDirty = true;
    soundEngine.startMedkitAudio();
  }

  private updateMedkitChannel(dt: number, cancelOnFireOrSprint: boolean): void {
    if (!this.usingMedkit) return;
    const fireDown = this.isSwimming ? false : this.input.getFireActive();
    if (cancelOnFireOrSprint && (fireDown || this.input.isSprinting)) {
      this.usingMedkit = false;
      this.medkitTimer = 0;
      this.hudDirty = true;
      soundEngine.stopMedkitAudio();
      return;
    }
    this.medkitTimer -= dt;
    if (this.medkitTimer <= 0) {
      this.usingMedkit = false;
      this.medkitTimer = 0;
      if (this.healingKind === 'smallkit' && this.smallkitCount > 0) {
        this.smallkitCount -= 1;
        this.hp = Math.min(this.maxHp, this.hp + 35);
        soundEngine.completeMedkitAudio();
      } else if (this.medkitCount > 0) {
        this.medkitCount -= 1;
        this.hp = Math.min(this.maxHp, this.hp + 75);
        soundEngine.completeMedkitAudio();
      }
      this.hudDirty = true;
    }
  }

  public dropMedkit(): void {
    if (this.medkitCount <= 0) return;
    this.medkitCount -= 1;
    this.spawnItemInFront({
      kind: 'medkit',
      label: 'Kit Médico (+75 HP)',
    });
    soundEngine.playUiClick(420);
  }

  public dropSmallKit(): void {
    if (this.smallkitCount <= 0) return;
    this.smallkitCount -= 1;
    this.spawnItemInFront({
      kind: 'smallkit',
      label: 'Kit Pequeno (+35 HP)',
    });
    soundEngine.playUiClick(420);
  }

  public dropGloo(): void {
    if (this.glooCount <= 0) return;
    this.glooCount -= 1;
    if (this.glooCount <= 0) this.isPlacingGloo = false;
    this.spawnItemInFront({
      kind: 'gloo',
      glooAmount: 1,
      label: 'Parede de Gelo (+1)',
    });
    soundEngine.playUiClick(420);
  }

  public dropGrenade(): void {
    if (this.grenadeCount <= 0) return;
    this.grenadeCount -= 1;
    if (this.grenadeCount <= 0) this.isHoldingGrenade = false;
    this.spawnItemInFront({
      kind: 'grenade',
      grenadeAmount: 1,
      label: 'Granada Explosiva (+1)',
    });
    soundEngine.playUiClick(420);
  }

  public dropAmmo(slot: 1 | 2 | 3, amount = 30): void {
    const w = this.weapons[slot];
    if (!w || w.reserveAmmo <= 0) return;
    const dropped = Math.min(amount, w.reserveAmmo);
    w.reserveAmmo -= dropped;
    this.spawnItemInFront({
      kind: 'ammo',
      ammoAmount: dropped,
      label: `Munição (+${dropped})`,
    });
    soundEngine.playUiClick(420);
  }

  public equipBackpackItem(itemId: string, targetSlot?: 1 | 2 | 3): void {
    const idx = this.backpackItems.findIndex((it) => it.id === itemId);
    if (idx < 0) return;
    const item = this.backpackItems[idx];

    if (item.kind === 'medkit') {
      this.useMedkit();
      return;
    }

    const slotToUse: 1 | 2 | 3 =
      targetSlot ??
      (this.activeSlot === 4
        ? this.weapons[1]
          ? 1
          : this.weapons[2]
            ? 2
            : 3
        : this.activeSlot);
    const weaponState = this.weapons[slotToUse];
    if (!weaponState) return;
    const def = WEAPONS[weaponState.weaponId];

    if (item.kind === 'scope' && item.scopeType) {
      if (!def.allowsCustomScope) return;
      const oldScope = weaponState.scope;
      weaponState.scope = item.scopeType;
      if (item.quantity <= 1) {
        this.backpackItems.splice(idx, 1);
      } else {
        item.quantity -= 1;
      }
      if (oldScope !== 'none') {
        this.addScopeToBackpack(oldScope);
      }
      soundEngine.playUiClick(740);
      return;
    }

    if (item.kind === 'attachment' && item.attachmentKind) {
      if (!def.allowsAttachments) return;
      const attMeta = ATTACHMENT_LABELS[item.attachmentKind];
      const slotKey = attMeta.slot;
      const prevAtt = weaponState.attachments[slotKey];
      (weaponState.attachments as Record<AttachmentSlotKey, AttachmentKind | null>)[slotKey] =
        item.attachmentKind;

      if (item.quantity <= 1) {
        this.backpackItems.splice(idx, 1);
      } else {
        item.quantity -= 1;
      }
      if (prevAtt) {
        this.addAttachmentToBackpack(prevAtt);
      }
      soundEngine.playUiClick(760);
    }
  }

  public unequipWeaponAttachment(slot: 1 | 2 | 3, key: AttachmentSlotKey): void {
    const w = this.weapons[slot];
    if (!w) return;
    const current = w.attachments[key];
    if (!current) return;
    (w.attachments as Record<AttachmentSlotKey, AttachmentKind | null>)[key] = null;
    if (!this.addAttachmentToBackpack(current)) {
      this.spawnItemInFront({
        kind: 'attachment',
        attachmentKind: current,
        label: ATTACHMENT_LABELS[current].name,
      });
    }
    soundEngine.playUiClick(520);
  }

  public dropEquippedAttachment(slot: 1 | 2 | 3, key: AttachmentSlotKey): void {
    const w = this.weapons[slot];
    if (!w) return;
    const current = w.attachments[key];
    if (!current) return;
    (w.attachments as Record<AttachmentSlotKey, AttachmentKind | null>)[key] = null;
    this.spawnItemInFront({
      kind: 'attachment',
      attachmentKind: current,
      label: ATTACHMENT_LABELS[current].name,
    });
    soundEngine.playUiClick(410);
  }

  public unequipWeaponScope(slot: 1 | 2 | 3): void {
    const w = this.weapons[slot];
    if (!w || !WEAPONS[w.weaponId].allowsCustomScope || w.scope === 'none') return;
    const old = w.scope;
    w.scope = 'none';
    if (!this.addScopeToBackpack(old)) {
      this.spawnItemInFront({
        kind: 'scope',
        scopeType: old,
        label: SCOPE_META[old].label,
      });
    }
    soundEngine.playUiClick(520);
  }

  public dropEquippedScope(slot: 1 | 2 | 3): void {
    const w = this.weapons[slot];
    if (!w || !WEAPONS[w.weaponId].allowsCustomScope || w.scope === 'none') return;
    const old = w.scope;
    w.scope = 'none';
    this.spawnItemInFront({
      kind: 'scope',
      scopeType: old,
      label: SCOPE_META[old].label,
    });
    soundEngine.playUiClick(410);
  }

  public transferScopeBetweenSlots(fromSlot: 1 | 2 | 3, toSlot: 1 | 2 | 3): void {
    if (fromSlot === toSlot) return;
    const fromW = this.weapons[fromSlot];
    const toW = this.weapons[toSlot];
    if (!fromW || !toW) return;
    if (!WEAPONS[fromW.weaponId].allowsCustomScope || !WEAPONS[toW.weaponId].allowsCustomScope) return;
    if (fromW.scope === 'none') return;
    const moved = fromW.scope;
    const replaced = toW.scope;
    toW.scope = moved;
    fromW.scope = replaced;
    soundEngine.playUiClick(760);
  }

  public transferAttachmentBetweenSlots(
    fromSlot: 1 | 2 | 3,
    key: AttachmentSlotKey,
    toSlot: 1 | 2 | 3,
  ): void {
    if (fromSlot === toSlot) return;
    const fromW = this.weapons[fromSlot];
    const toW = this.weapons[toSlot];
    if (!fromW || !toW) return;
    if (!WEAPONS[toW.weaponId].allowsAttachments) return;
    const moved = fromW.attachments[key];
    if (!moved) return;
    const replaced = toW.attachments[key];
    (toW.attachments as Record<AttachmentSlotKey, AttachmentKind | null>)[key] = moved;
    (fromW.attachments as Record<AttachmentSlotKey, AttachmentKind | null>)[key] = replaced;
    soundEngine.playUiClick(760);
  }

  public dropBackpackItem(itemId: string): void {
    const idx = this.backpackItems.findIndex((it) => it.id === itemId);
    if (idx < 0) return;
    const item = this.backpackItems[idx];
    if (item.kind === 'scope' && item.scopeType) {
      this.spawnItemInFront({
        kind: 'scope',
        scopeType: item.scopeType,
        label: item.label,
      });
    } else if (item.kind === 'attachment' && item.attachmentKind) {
      this.spawnItemInFront({
        kind: 'attachment',
        attachmentKind: item.attachmentKind,
        label: item.label,
      });
    } else if (item.kind === 'ammo') {
      this.spawnItemInFront({
        kind: 'ammo',
        ammoAmount: 30,
        label: 'Munição Tática (+30)',
      });
    }

    if (item.quantity <= 1) {
      this.backpackItems.splice(idx, 1);
    } else {
      item.quantity -= 1;
    }
    soundEngine.playUiClick(400);
  }

  public swapWeaponSlots(slotA: 1 | 2 | 3, slotB: 1 | 2 | 3): void {
    if (slotA === slotB) return;
    if (slotA === 3 || slotB === 3) return;
    const wA = this.weapons[slotA];
    const wB = this.weapons[slotB];
    if (!wA && !wB) return;
    this.weapons[slotA] = wB;
    this.weapons[slotB] = wA;
    const tmpShot = this.slotLastShotTime[slotA];
    this.slotLastShotTime[slotA] = this.slotLastShotTime[slotB];
    this.slotLastShotTime[slotB] = tmpShot;
    if (this.activeSlot === slotA) {
      this.activeSlot = slotB;
    } else if (this.activeSlot === slotB) {
      this.activeSlot = slotA;
    }
    this.isReloading = false;
    this.reloadTimer = 0;
    this.syncPlayerWeaponAndBackVisuals();
    this.hudDirty = true;
    soundEngine.playWeaponSwitch();
  }

  public dropWeaponSlot(slot: 1 | 2 | 3): void {
    const w = this.weapons[slot];
    if (!w) return;

    const def = WEAPONS[w.weaponId];
    this.spawnItemInFront({
      kind: 'weapon',
      weaponId: w.weaponId,
      label: def.name,
    });
    this.weapons[slot] = null;
    if (this.activeSlot === slot) {
      const next: WeaponSlotId =
        ([1, 2, 3] as const).find((s) => this.weapons[s] !== null) ?? 4;
      this.activeSlot = next;
    }
    this.syncPlayerWeaponAndBackVisuals();
    soundEngine.playUiClick(410);
  }

  private getBackpackUsedWeight(): number {
    let w = this.medkitCount * 12 + this.smallkitCount * 6;
    for (let i = 0; i < this.backpackItems.length; i++) {
      const it = this.backpackItems[i];
      const unitW = it.kind === 'scope' ? 10 : it.kind === 'attachment' ? 8 : 6;
      w += unitW * it.quantity;
    }
    return w;
  }

  private getBackpackCapacity(): number {
    return BACKPACK_CAPACITIES[this.backpackLevel];
  }

  private addScopeToBackpack(sc: ScopeType): boolean {
    if (sc === 'none' || sc === 'sniper') return false;
    if (!this.ownedScopes.includes(sc)) {
      this.ownedScopes.push(sc);
    }
    const existing = this.backpackItems.find(
      (i) => i.kind === 'scope' && i.scopeType === sc,
    );
    if (this.getBackpackUsedWeight() + 10 > this.getBackpackCapacity()) {
      return false;
    }
    if (existing) {
      existing.quantity += 1;
    } else {
      this.backpackItems.push({
        id: `bp_${this.nextBackpackItemId++}`,
        kind: 'scope',
        label: SCOPE_META[sc].label,
        quantity: 1,
        scopeType: sc,
      });
    }
    return true;
  }

  private addAttachmentToBackpack(att: AttachmentKind): boolean {
    if (this.getBackpackUsedWeight() + 8 > this.getBackpackCapacity()) {
      return false;
    }
    const existing = this.backpackItems.find(
      (i) => i.kind === 'attachment' && i.attachmentKind === att,
    );
    if (existing) {
      existing.quantity += 1;
    } else {
      this.backpackItems.push({
        id: `bp_${this.nextBackpackItemId++}`,
        kind: 'attachment',
        label: ATTACHMENT_LABELS[att].name,
        quantity: 1,
        attachmentKind: att,
      });
    }
    return true;
  }

  private isInWaitLobbyArea(x: number, z: number): boolean {
    return (
      Math.abs(x - WAIT_LOBBY_ORIGIN.x) < 120 &&
      Math.abs(z - WAIT_LOBBY_ORIGIN.z) < 120
    );
  }

  private isInGladiadoresArea(x: number, z: number): boolean {
    return (
      Math.abs(x - GLADIADORES_ORIGIN.x) < 120 &&
      Math.abs(z - GLADIADORES_ORIGIN.z) < 120
    );
  }

  private isBermudaMapActive(): boolean {
    return (
      this.brMapId === 'bermuda' &&
      Number.isFinite(this.world.bermudaCollisionGrid.minX)
    );
  }

  private getDryMinFloorY(): number {
    return this.isBermudaMapActive() ? BERMUDA_GLB_WATER_Y - 0.2 : -0.85;
  }

  private getDeepWaterMinY(): number {
    return this.isBermudaMapActive() ? BERMUDA_GLB_WATER_Y - 0.85 : -1.28;
  }

  private getActiveBounds(): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    useIslandRadial: boolean;
  } {
    if (this.stateMachine.getState() === GameState.WAITING) {
      return {
        minX: WAIT_LOBBY_ORIGIN.x - 16.5,
        maxX: WAIT_LOBBY_ORIGIN.x + 12.5,
        minZ: WAIT_LOBBY_ORIGIN.z - 8.2,
        maxZ: WAIT_LOBBY_ORIGIN.z + 0.5,
        useIslandRadial: false,
      };
    }
    if (this.gameVariant === 'gladiadores') {
      return {
        minX: GLADIADORES_BOUNDS.minX,
        maxX: GLADIADORES_BOUNDS.maxX,
        minZ: GLADIADORES_BOUNDS.minZ,
        maxZ: GLADIADORES_BOUNDS.maxZ,
        useIslandRadial: false,
      };
    }
    if (this.isBermudaMapActive()) {
      return {
        minX: -880,
        maxX: 880,
        minZ: -780,
        maxZ: 780,
        useIslandRadial: false,
      };
    }
    return {
      minX: -BERMUDA_HALF + 8,
      maxX: BERMUDA_HALF - 8,
      minZ: -BERMUDA_HALF + 8,
      maxZ: BERMUDA_HALF - 8,
      useIslandRadial: true,
    };
  }

  private isPointInActivePlayableArea(x: number, z: number): boolean {
    const ab = this.getActiveBounds();
    if (x < ab.minX || x > ab.maxX || z < ab.minZ || z > ab.maxZ) return false;
    if (ab.useIslandRadial && x * x + z * z > 520 * 520) return false;
    return true;
  }

  private getSafeZoneTargetRadius(phaseIndex0: number): number {
    const base = SAFE_ZONE_PHASES[Math.min(SAFE_ZONE_PHASES.length - 1, phaseIndex0)].targetRadius;
    if (!this.isBermudaMapActive()) return base;
    const bermudaRadii = [480, 300, 175, 85, 22];
    return bermudaRadii[Math.min(bermudaRadii.length - 1, phaseIndex0)] ?? base;
  }

  private sampleEntitySurface(
    x: number,
    z: number,
  ): { y: number; inWater: boolean; onBridge: boolean } {
    if (this.isInWaitLobbyArea(x, z)) {
      return { y: WAIT_LOBBY_ORIGIN.y + 0.12, inWater: false, onBridge: false };
    }
    if (this.isInGladiadoresArea(x, z)) {
      return { y: GLADIADORES_FLOOR_Y, inWater: false, onBridge: false };
    }
    if (this.isBermudaMapActive()) {
      const y = this.world.bermudaCollisionGrid.sampleTerrainHeight(x, z, BERMUDA_GLB_WATER_Y);
      return {
        y,
        inWater: y <= BERMUDA_GLB_WATER_Y + 0.25,
        onBridge: false,
      };
    }
    return botSurfaceHeightAt(x, z);
  }

  private raycastActiveGlbWall(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
  ): number | null {
    if (this.isInWaitLobbyArea(origin.x, origin.z)) {
      return this.world.waitCollisionGrid.raycast(origin, dir, maxDist);
    }
    if (this.isInGladiadoresArea(origin.x, origin.z)) {
      return this.world.gladiadoresCollisionGrid.raycast(origin, dir, maxDist);
    }
    if (this.isBermudaMapActive()) {
      return this.world.bermudaCollisionGrid.raycast(origin, dir, maxDist);
    }
    return null;
  }

  private spawnItemInFront(
    partial: {
      kind: 'ammo' | 'medkit' | 'smallkit' | 'weapon' | 'scope' | 'vest' | 'helmet' | 'backpack' | 'attachment' | 'gloo' | 'grenade';
      weaponId?: WeaponId;
      scopeType?: ScopeType;
      attachmentKind?: AttachmentKind;
      level?: 1 | 2 | 3;
      ammoAmount?: number;
      glooAmount?: number;
      grenadeAmount?: number;
      label: string;
    },
  ): void {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const ab = this.getActiveBounds();
    const dx = THREE.MathUtils.clamp(this.pos.x + fx * 1.45, ab.minX, ab.maxX);
    const dz = THREE.MathUtils.clamp(this.pos.z + fz * 1.45, ab.minZ, ab.maxZ);
    const dy =
      Math.max(
        this.getDryMinFloorY(),
        this.resolveFloorHeight(dx, dz, this.pos.y + 0.5),
      ) + 0.04;
    this.world.spawnDroppedLoot({
      ...partial,
      x: dx,
      y: dy,
      z: dz,
    });
  }

  private resetPlayerForWaiting(): void {
    this.gameVariant = 'br';
    this.waitingTimer = 10;
    this.waitLobbyBotsUnlocked = 0;
    this.waitLobbySpawnDelay = 0.45;
    this.waitLobbySpawnTimer = 0;
    const myIdx = this.onlineRoomId
      ? Math.max(0, this.onlineHumanSlots.findIndex((s) => s.accountId === this.onlineAccountId))
      : 0;
    const spawnDx = this.onlineRoomId ? ((myIdx % 5) - 2) * 1.45 : 0;
    const spawnDz = this.onlineRoomId ? Math.floor(myIdx / 5) * 1.45 : 0;
    this.resetPlayerForMatch(WAIT_SPAWN.x + spawnDx, WAIT_SPAWN.z + spawnDz, true);
  }

  private setupGladiadoresRound(): void {
    this.gameVariant = 'gladiadores';
    this.world.airplaneGroup.visible = false;
    this.world.safeZoneMesh.visible = false;
    this.clearDeployedGloos();
    this.clearAirDrops();
    this.grenadeLine.visible = false;
    this.grenadeTargetMesh.visible = false;
    for (let i = 0; i < this.thrownGrenades.length; i++) {
      this.thrownGrenades[i].active = false;
      this.thrownGrenades[i].mesh.visible = false;
    }
    for (let i = 0; i < this.explosionVfx.length; i++) {
      this.explosionVfx[i].active = false;
      this.explosionVfx[i].mesh.visible = false;
    }
    this.world.resetMatchLoots();
    this.world.loots.forEach((l) => {
      l.mesh.visible = false;
    });
    soundEngine.stopVehicleAudio();
    this.activeVehicleId = null;

    const spawnX = GLADIADORES_ORIGIN.x - 27.0;
    const spawnZ =
      this.gladiadoresFormat === '2v2'
        ? GLADIADORES_ORIGIN.z - 2.6
        : GLADIADORES_ORIGIN.z;
    const startY = this.resolveFloorHeight(spawnX, spawnZ, GLADIADORES_FLOOR_Y + 0.8);

    this.pos.set(spawnX, startY, spawnZ);
    this.vel.set(0, 0, 0);
    this.yaw = -Math.PI / 2;
    this.characterYaw = -Math.PI / 2;
    this.pitch = -0.05;
    this.stance = 'stand';
    this.isGrounded = true;
    this.isAiming = false;
    this.wasAiming = false;
    this.lockedTargetId = null;
    this.aimBreakAccum = 0;
    this.pullingUpTimer = 0;
    this.bugDoCapaTimer = 0;
    this.wasLockedWhileCrouched = false;
    this.aimLockedTarget = false;
    this.aimAssistActive = false;
    this.vaultTimer = 0;
    this.canVaultWindow = false;
    this.revivingBotId = null;
    this.reviveTimer = 0;
    this.camDistCurrent = 3.75;
    this.camSafeDist = 3.75;
    this.camShoulderCurrent = 0.42;
    this.isDead = false;
    this.isPlayerDowned = false;
    this.inWater = false;
    this.isSwimming = false;
    this.isOnSurfboard = false;
    this.playerBleedHp = 100;
    this.playerRevivingAllyId = null;
    this.deathTimer = 0;
    this.hp = this.maxHp;
    this.vestLevel = 2;
    this.vestHp = 160;
    this.vestMaxHp = 160;
    this.helmetLevel = 2;
    this.helmetHp = 120;
    this.helmetMaxHp = 120;
    this.backpackLevel = 2;
    this.medkitCount = 2;
    this.smallkitCount = 1;
    this.glooCount = 3;
    this.grenadeCount = 1;
    this.isPlacingGloo = false;
    this.isHoldingGrenade = false;
    this.consecutiveShots = 0;
    this.usingMedkit = false;
    this.medkitTimer = 0;
    this.backpackItems = [];
    this.damageFlashTimer = 0;
    this.hitmarkerTimer = 0;
    this.headshotFlashTimer = 0;
    this.damagePopups = [];
    this.damageIndicators = [];
    this.isSpectating = false;
    this.spectateTargetRef = null;
    this.playerDeathPlacement = null;

    if (this.gladRound === 1) {
      this.kills = 0;
      this.damageDealt = 0;
      this.killFeed = [];
    }

    this.activeSlot = 1;
    this.prevWeaponSlot = 2;
    this.slotLastShotTime = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.ownedScopes = ['none', '2x'];
    this.weapons = {
      1: {
        weaponId: 'scar',
        ammoInMag: WEAPONS.scar.magSize,
        reserveAmmo: 180,
        scope: '2x',
        attachments: emptyAttachments(),
      },
      2: {
        weaponId: 'm1014',
        ammoInMag: WEAPONS.m1014.magSize,
        reserveAmmo: 48,
        scope: 'none',
        attachments: emptyAttachments(),
      },
      3: {
        weaponId: 'deagle',
        ammoInMag: WEAPONS.deagle.magSize,
        reserveAmmo: 42,
        scope: 'none',
        attachments: emptyAttachments(),
      },
    };
    this.isReloading = false;
    this.reloadTimer = 0;
    this.syncPlayerWeaponAndBackVisuals();
    this.playerRig.weaponMount.visible = true;
    this.playerRig.root.visible = true;
    this.animator.reset();
    this.healRingMesh.visible = false;

    const is2v2 = this.gladiadoresFormat === '2v2';
    const enemyCount = is2v2 ? 2 : 1;
    const allyCount = is2v2 ? 1 : 0;
    this.aliveCount = 1 + allyCount + enemyCount;
    this.gladSpinReloadState.clear();

    const gladEnemyNicks = ['BOT_GLADIADOR_01', 'BOT_GLADIADOR_02'];
    let assignedAlly = 0;
    let assignedEnemy = 0;

    for (let i = 0; i < this.world.targets.length; i++) {
      const b = this.world.targets[i];
      b.animator?.reset();
      b.isDowned = false;
      b.bleedHp = 100;
      b.knockedByPlayer = false;
      b.downTimer = 0;
      b.hitFlash = 0;
      b.vy = 0;
      b.revivingMateId = null;
      b.reviveTimer = 0;
      b.targetId = null;
      b.reloadTimer = 0;
      b.stuckTimer = 0;
      b.escapeTimer = 0;
      b.glooCooldown = 0;
      b.healTimer = 0;
      if (b.parachuteMesh) b.parachuteMesh.visible = false;

      if (assignedAlly < allyCount) {
        const ax = GLADIADORES_ORIGIN.x - 27.0;
        const az = GLADIADORES_ORIGIN.z + 2.6;
        const ay = this.resolveFloorHeight(ax, az, GLADIADORES_FLOOR_Y + 0.8);
        b.eliminated = false;
        b.isAlly = true;
        b.teamId = 0;
        b.nick = ALLY_NAME_POOL[this.gladRound % ALLY_NAME_POOL.length];
        b.hp = 200;
        b.maxHp = 200;
        b.vestLevel = 2;
        b.vestHp = 160;
        b.vestMaxHp = 160;
        b.helmetLevel = 2;
        b.helmetHp = 120;
        b.helmetMaxHp = 120;
        b.weaponId = 'scar';
        b.secondaryWeaponId = 'ump45';
        b.ammoInMag = WEAPONS.scar.magSize;
        b.ammoCount = 180;
        b.medkits = 2;
        b.gloos = 2;
        b.airState = 'ground';
        b.aiState = 'roam';
        b.group.position.set(ax, ay, az);
        b.group.rotation.set(0, Math.PI / 2, 0);
        b.group.visible = true;
        setBotWeaponVisual(b, b.weaponId, b.secondaryWeaponId);
        if (b.rig) {
          b.rig.weaponMount.visible = true;
          b.rig.setParachuteVisible(false);
          b.rig.setBandageVisible?.(false);
        }
        b.goalX = ax + 8;
        b.goalY = ay;
        b.goalZ = az;
        assignedAlly++;
      } else if (assignedEnemy < enemyCount) {
        const ezOffset = is2v2 ? (assignedEnemy === 0 ? -4.0 : 4.0) : 0;
        const ex = GLADIADORES_ORIGIN.x - 5.2;
        const ez = GLADIADORES_ORIGIN.z + ezOffset;
        const ey = this.resolveFloorHeight(ex, ez, GLADIADORES_FLOOR_Y + 0.8);
        b.eliminated = false;
        b.isAlly = false;
        b.teamId = 1;
        b.nick = gladEnemyNicks[assignedEnemy] ?? `BOT_GLADIADOR_${assignedEnemy + 1}`;
        b.hp = 200;
        b.maxHp = 200;
        b.vestLevel = 1;
        b.vestHp = 100;
        b.vestMaxHp = 100;
        b.helmetLevel = 1;
        b.helmetHp = 75;
        b.helmetMaxHp = 75;
        b.weaponId = assignedEnemy === 0 ? 'ak47' : 'ump45';
        b.secondaryWeaponId = undefined;
        b.ammoInMag = WEAPONS[b.weaponId].magSize;
        b.ammoCount = 999;
        b.medkits = 0;
        b.gloos = 0;
        b.airState = 'ground';
        b.aiState = 'combat';
        b.fireCooldown = 0.25 + assignedEnemy * 0.18;
        b.group.position.set(ex, ey, ez);
        b.group.rotation.set(0, -Math.PI / 2, 0);
        b.group.visible = true;
        setBotWeaponVisual(b, b.weaponId, null);
        if (b.rig) {
          b.rig.weaponMount.visible = true;
          b.rig.setParachuteVisible(false);
          b.rig.setBandageVisible?.(false);
        }
        b.goalX = ex;
        b.goalY = ey;
        b.goalZ = ez;
        this.gladSpinReloadState.set(b.id, {
          phase: 'shoot',
          spinDir: assignedEnemy % 2 === 0 ? 1 : -1,
        });
        assignedEnemy++;
      } else {
        b.eliminated = true;
        b.downTimer = 0;
        b.isAlly = false;
        b.teamId = 99;
        b.group.visible = false;
      }
    }

    this.gladPhase = 'intro';
    this.gladPhaseTimer = 1.6;
    this.gladPendingWinner = null;
    this.gladBanner = `RODADA ${this.gladRound} · PREPARE-SE!`;

    this.camPosCurrent.set(spawnX - 3.6, startY + 2.2, spawnZ);
    this.camLookCurrent.set(spawnX, startY + 1.4, spawnZ);
    this.updateThirdPersonCamera(0.016, 3.75, 1.55, 'none', false, true);
    this.hudDirty = true;
  }

  private updateGladiadoresRound(dt: number): void {
    if (this.gameVariant !== 'gladiadores') return;
    if (this.gladPhase === 'intro') {
      this.gladPhaseTimer = Math.max(0, this.gladPhaseTimer - dt);
      if (this.gladPhaseTimer <= 0) {
        this.gladPhase = 'fight';
        this.gladBanner = null;
        soundEngine.playUiConfirm();
        this.hudDirty = true;
      }
    } else if (this.gladPhase === 'round_end') {
      this.gladPhaseTimer = Math.max(0, this.gladPhaseTimer - dt);
      if (this.gladPhaseTimer <= 0) {
        if (this.gladPlayerScore >= this.gladiadoresTargetRounds) {
          this.gladBanner = null;
          this.stateMachine.forceState(GameState.WIN);
        } else if (this.gladEnemyScore >= this.gladiadoresTargetRounds) {
          this.gladBanner = null;
          this.stateMachine.forceState(GameState.GAMEOVER);
        } else {
          this.gladRound += 1;
          this.setupGladiadoresRound();
        }
      }
    }
  }

  private initSafeZone(): void {
    const isBermuda = this.isBermudaMapActive();
    const initR = isBermuda ? 820 : 650;
    this.zonePhase = 1;
    this.zoneIsShrinking = false;
    this.zoneTimer = SAFE_ZONE_PHASES[0].waitSec;
    this.zoneShrinkTotal = SAFE_ZONE_PHASES[0].shrinkSec;
    this.zoneCurrentX = 0;
    this.zoneCurrentZ = 0;
    this.zoneCurrentRadius = initR;
    this.zoneStartX = 0;
    this.zoneStartZ = 0;
    this.zoneStartRadius = initR;
    this.zoneDmgAccum = 0;
    this.zoneDmgTickTimer = 0;
    this.zoneGasExposureSec = 0;
    this.pickNextZoneCenter(0, 0, initR, this.getSafeZoneTargetRadius(0));
    this.world.safeZoneMesh.position.set(0, 75, 0);
    this.world.safeZoneMesh.scale.set(initR, 1, initR);
    this.world.safeZoneMesh.visible = false;
  }

  private pickNextZoneCenter(
    currX: number,
    currZ: number,
    currR: number,
    nextR: number,
  ): void {
    const maxShift = Math.max(0, currR - nextR) * 0.62;
    const isBermuda = this.isBermudaMapActive();
    const minZoneDryY = isBermuda ? BERMUDA_GLB_WATER_Y + 0.35 : 0.6;
    let nx = currX;
    let nz = currZ;
    for (let attempt = 0; attempt < 16; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * maxShift;
      const candX = currX + Math.cos(ang) * dist;
      const candZ = currZ + Math.sin(ang) * dist;
      const withinMap = isBermuda
        ? Math.abs(candX) <= 680 && Math.abs(candZ) <= 580
        : Math.hypot(candX, candZ) <= 450;
      if (withinMap && this.world.groundHeightAt(candX, candZ) > minZoneDryY) {
        nx = candX;
        nz = candZ;
        break;
      }
    }
    this.zoneNextX = nx;
    this.zoneNextZ = nz;
    this.zoneNextRadius = nextR;
  }

  private resetPlayerForMatch(
    startX: number,
    startZ: number,
    isWaitingLobby = false,
    startOnGround = false,
  ): void {
    const y = isWaitingLobby
      ? this.resolveFloorHeight(startX, startZ, WAIT_LOBBY_ORIGIN.y + 1.5)
      : Math.max(this.getDryMinFloorY() + 0.25, this.world.groundHeightAt(startX, startZ));
    this.pos.set(startX, y, startZ);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.characterYaw = 0;
    this.combatFacingTimer = 0;
    this.combatPoseTimer = 0;
    this.pitch = -0.14;
    this.stance = 'stand';
    this.isGrounded = true;
    this.isAiming = false;
    this.wasAiming = false;
    this.lockedTargetId = null;
    this.aimBreakAccum = 0;
    this.pullingUpTimer = 0;
    this.bugDoCapaTimer = 0;
    this.wasLockedWhileCrouched = false;
    this.aimLockedTarget = false;
    this.aimAssistActive = false;
    this.vaultTimer = 0;
    this.canVaultWindow = false;
    this.revivingBotId = null;
    this.reviveTimer = 0;
    this.camDistCurrent = 3.75;
    this.camSafeDist = 3.75;
    this.camShoulderCurrent = 0.42;
    this.vehicleLookOverrideTimer = 0;
    this.isDead = false;
    this.isPlayerDowned = false;
    this.inWater = false;
    this.isSwimming = false;
    this.isOnSurfboard = false;
    this.playerBleedHp = 100;
    this.playerRevivingAllyId = null;
    this.deathTimer = 0;
    this.hp = this.maxHp;
    this.vestLevel = 0;
    this.vestHp = 0;
    this.vestMaxHp = 0;
    this.helmetLevel = 0;
    this.helmetHp = 0;
    this.helmetMaxHp = 0;
    this.backpackLevel = 1;
    this.medkitCount = 1;
    this.smallkitCount = 0;
    this.glooCount = 2;
    this.grenadeCount = 2;
    this.isPlacingGloo = false;
    this.isHoldingGrenade = false;
    this.consecutiveShots = 0;
    this.usingMedkit = false;
    this.medkitTimer = 0;
    this.backpackItems = [];
    this.kills = 0;
    this.damageDealt = 0;
    this.ffCoins = 100;
    this.activeVehicleId = null;
    this.prevCharYawForTurn = 0;
    this.headshotFlashTimer = 0;
    this.damagePopups = [];
    this.damageIndicators = [];
    this.killFeed = [];
    this.isSpectating = false;
    this.spectateTargetRef = null;
    this.spectateSnapNext = false;
    this.lastAttackerRef = null;
    this.playerDeathPlacement = null;
    this.likedSpectateTargets.clear();
    this.botSpectators = [];
    this.matchVisualLikes = 0;
    this.likeToasts = [];
    this.aliveCount = isWaitingLobby
      ? 1 + this.onlineRemotePlayers.size
      : 1 + this.world.targets.length;

    // Start ONLY with Glock G18 (Slot 3) when dropping into Battle Royale
    this.activeSlot = 3;
    this.prevWeaponSlot = 1;
    this.slotLastShotTime = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.ownedScopes = ['none'];
    this.weapons = {
      1: null,
      2: null,
      3: {
        weaponId: 'g18',
        ammoInMag: WEAPONS.g18.magSize,
        reserveAmmo: 60,
        scope: 'none',
        attachments: emptyAttachments(),
      },
    };
    this.isReloading = false;
    this.reloadTimer = 0;
    this.syncPlayerWeaponAndBackVisuals();
    this.playerRig.weaponMount.visible = true;
    this.playerRig.root.visible = true;
    this.animator.reset();
    this.healRingMesh.visible = false;
    this.lastGunfightTimer = 0;
    this.launchPadFlightTimer = 0;

    this.clearDeployedGloos();
    this.glooPreviewMesh.visible = false;
    this.grenadeLine.visible = false;
    this.grenadeTargetMesh.visible = false;
    for (let i = 0; i < this.thrownGrenades.length; i++) {
      this.thrownGrenades[i].active = false;
      this.thrownGrenades[i].mesh.visible = false;
    }
    for (let i = 0; i < this.explosionVfx.length; i++) {
      this.explosionVfx[i].active = false;
      this.explosionVfx[i].mesh.visible = false;
    }

    this.world.resetMatchLoots();
    this.world.syncProximityLoot(startX, startZ, 56);
    this.lootSyncAccum = 0;
    this.distantSkirmishTimer = 5.0;
    this.world.resetExplosiveBarrels();
    this.world.resetVehicles();
    soundEngine.stopVehicleAudio();
    this.clearAirDrops();
    this.airDropSpawnTimer = 22;
    this.airDropCountSpawned = 0;
    this.airDropNotice = null;
    this.airDropNoticeTimer = 0;
    this.initSafeZone();

    // Shuffle fresh Brazilian nicknames for allies each match
    const shuffledNicks = [...ALLY_NAME_POOL];
    for (let s = shuffledNicks.length - 1; s > 0; s--) {
      const r = Math.floor(Math.random() * (s + 1));
      const tmp = shuffledNicks[s];
      shuffledNicks[s] = shuffledNicks[r];
      shuffledNicks[r] = tmp;
    }
    const chosenAllyNicks = shuffledNicks.slice(0, 3);

    // Pick land POIs excluding bridges
    const landPois = this.world.pois.filter(
      (p) => !p.name.startsWith('PONTE'),
    );

    // Reset all 50 bots with Solo/Duo/Squad team assignments
    for (let i = 0; i < this.world.targets.length; i++) {
      const b = this.world.targets[i];
      b.hp = b.maxHp;
      b.isDowned = false;
      b.bleedHp = 100;
      b.knockedByPlayer = false;
      b.downTimer = 0;
      b.eliminated = false;
      b.kills = 0;
      b.hitFlash = 0;
      b.vestLevel = 0;
      b.vestHp = 0;
      b.vestMaxHp = 0;
      b.helmetLevel = 0;
      b.helmetHp = 0;
      b.helmetMaxHp = 0;
      if (b.vestMesh) b.vestMesh.visible = false;
      if (b.helmetMesh) b.helmetMesh.visible = false;
      b.animator?.reset();
      if (b.rig) {
        b.rig.weaponMount.visible = true;
        b.rig.setBandageVisible?.(false);
        b.rig.setParachuteVisible(false);
      }
      b.weaponId = 'g18';
      b.secondaryWeaponId = undefined;
      b.pistolWeaponId = 'g18';
      b.drawTimer = 0;
      setBotWeaponVisual(b, b.weaponId, null);
      b.ammoInMag = WEAPONS.g18.magSize;
      b.reloadTimer = 0;
      b.ammoCount = 45;
      b.medkits = 2;
      b.gloos = 0;
      b.grenades = 0;
      b.backpackLevel = 1;
      b.coins = 100;
      b.scopes = [];
      b.attachments = [];
      b.glooCooldown = 0;
      b.healTimer = 0;
      b.revivingMateId = null;
      b.reviveTimer = 0;
      b.huntTimer = 1.0 + (i % 5) * 0.55;
      b.stuckTimer = 0;
      b.steerSign = i % 2 === 0 ? 1 : -1;
      b.steerLockTimer = 0;
      b.navCheckTimer = 0;
      b.vaultTimer = 0;
      b.jumpCooldown = 0;
      b.isRetreating = false;
      b.retreatTimer = 0;
      b.escapeTimer = 0;
      b.badLootId = null;
      b.badLootTimer = 0;
      b.vy = 0;
      b.targetId = null;
      b.aiTimer = 0.2 + ((i * 19) % 15) * 0.05;
      b.fireCooldown = 0.5 + (i % 4) * 0.2;

      const onlineHumansInMyTeam = this.onlineRoomId
        ? 1 +
          Array.from(this.onlineRemotePlayers.values()).filter(
            (e) => e.teamId === this.onlineTeamId,
          ).length
        : 1;
      const desiredTeamMax =
        this.matchMode === 'duo' ? 2 : this.matchMode === 'squad' ? 4 : 1;
      const neededBotAllies = this.autoFillBots
        ? Math.max(0, desiredTeamMax - onlineHumansInMyTeam)
        : 0;

      if (this.matchMode === 'duo') {
        if (i < neededBotAllies) {
          b.teamId = 0;
          b.isAlly = true;
          b.nick = chosenAllyNicks[i % chosenAllyNicks.length];
        } else {
          b.teamId = 1 + Math.floor((i - neededBotAllies) / 2);
          b.isAlly = false;
        }
      } else if (this.matchMode === 'squad') {
        if (i < neededBotAllies) {
          b.teamId = 0;
          b.isAlly = true;
          b.nick = chosenAllyNicks[i % chosenAllyNicks.length];
        } else {
          b.teamId = 1 + Math.floor((i - neededBotAllies) / 4);
          b.isAlly = false;
        }
      } else {
        b.teamId = i + 1;
        b.isAlly = false;
      }

      // If auto-fill is disabled in Duo/Squad, remove unused bot slots from team 0? No unused bot slots exist because i >= neededBotAllies are assigned to enemy teams!

      // Group teammates into the same drop POI so squads/duos fight together
      const poiIdx =
        this.matchMode === 'solo'
          ? i % landPois.length
          : b.isAlly
            ? 0
            : b.teamId % landPois.length;
      const poi = landPois[poiIdx];
      const ang = (i * 2.39996) % (Math.PI * 2);
      const rad = this.matchMode === 'solo' ? 10 + (i % 6) * 8 : 6 + (i % 4) * 5;
      let lx = poi.x + Math.cos(ang) * rad;
      let lz = poi.z + Math.sin(ang) * rad;
      const minPoiDryY = this.isBermudaMapActive() ? BERMUDA_GLB_WATER_Y + 0.35 : 0.75;
      if (this.sampleEntitySurface(lx, lz).inWater || this.world.groundHeightAt(lx, lz) < minPoiDryY) {
        lx = poi.x;
        lz = poi.z;
      }
      b.landX = lx;
      b.landZ = lz;
      b.animAccum = (i % 4) * 0.02;

      if (isWaitingLobby) {
        b.airState = 'ground';
        b.waitingActive = false;
        b.group.position.set(WAIT_LOBBY_ORIGIN.x, WAIT_LOBBY_ORIGIN.y - 20, WAIT_LOBBY_ORIGIN.z);
        b.group.rotation.set(0, (i * 1.1) % (Math.PI * 2), 0);
        b.group.visible = false;
        if (b.parachuteMesh) b.parachuteMesh.visible = false;
        b.aiState = 'roam';
        b.goalX = WAIT_LOBBY_ORIGIN.x;
        b.goalY = WAIT_LOBBY_ORIGIN.y;
        b.goalZ = WAIT_LOBBY_ORIGIN.z;
      } else if (startOnGround) {
        b.airState = 'ground';
        const gx = b.isAlly ? startX + ((i === 0 ? -3.4 : i === 1 ? 3.4 : 0)) : lx;
        const gz = b.isAlly ? startZ + 4.0 : lz;
        const gs = this.sampleEntitySurface(gx, gz);
        const minGroundSpawnY = this.isBermudaMapActive() ? this.getDryMinFloorY() : 0.8;
        const gy = Math.max(minGroundSpawnY, gs.y);
        b.group.position.set(gx, gy, gz);
        this.resolveEntityHorizontalCollisions(b.group.position, 0.44, null, false);
        this.resolveEntityHorizontalCollisions(b.group.position, 0.44, null, false);
        b.group.position.y = Math.max(
          minGroundSpawnY,
          this.resolveFloorHeight(b.group.position.x, b.group.position.z, b.group.position.y + 0.5),
        );
        b.navCheckX = b.group.position.x;
        b.navCheckZ = b.group.position.z;
        b.group.rotation.set(0, 0, 0);
        b.group.visible = true;
        if (b.parachuteMesh) b.parachuteMesh.visible = false;
        b.aiState = b.isAlly ? 'roam' : 'loot';
        b.goalX = b.group.position.x;
        b.goalY = b.group.position.y;
        b.goalZ = b.group.position.z;
      } else {
        b.airState = 'inPlane';
        if (b.isAlly) {
          // Allies wait inside the airplane until the player jumps
          b.dropProgress = 1.05;
        } else {
          const teamDropBase =
            this.matchMode === 'solo'
              ? (i * 0.6180339887) % 1
              : (b.teamId * 0.6180339887) % 1;
          b.dropProgress = 0.08 + teamDropBase * 0.76 + (i % 4) * 0.015;
        }
        b.group.visible = false;
        if (b.parachuteMesh) b.parachuteMesh.visible = false;
        b.aiState = 'loot';
        b.goalX = lx;
        b.goalY = 1.0;
        b.goalZ = lz;
      }
    }

    // Reset loot visibility (initially culled; updateDynamicProps reveals within range)
    this.world.loots.forEach((l) => {
      l.data.collected = false;
      l.mesh.visible = false;
    });

    this.camPosCurrent.set(startX + 1.5, y + 2.4, startZ + 4.5);
    this.camLookCurrent.set(startX, y + 1.4, startZ);
  }

  private activateWaitingLobbyBot(b: TargetDummy, idx: number): void {
    const abWait = this.getActiveBounds();
    const wx = THREE.MathUtils.clamp(
      WAIT_LOBBY_ORIGIN.x - 14.5 + ((idx * 3.7) % 25.0),
      abWait.minX + 0.9,
      abWait.maxX - 0.9,
    );
    const wz = THREE.MathUtils.clamp(
      WAIT_LOBBY_ORIGIN.z - 7.4 + ((idx * 2.3) % 7.0),
      abWait.minZ + 0.8,
      abWait.maxZ - 0.8,
    );
    b.group.position.set(wx, WAIT_LOBBY_ORIGIN.y + 0.25, wz);
    this.resolveEntityHorizontalCollisions(b.group.position, 0.44, null, false);
    this.resolveEntityHorizontalCollisions(b.group.position, 0.44, null, false);
    b.group.position.y = this.resolveFloorHeight(
      b.group.position.x,
      b.group.position.z,
      WAIT_LOBBY_ORIGIN.y + 1.4,
    );
    b.navCheckX = b.group.position.x;
    b.navCheckZ = b.group.position.z;
    b.group.rotation.set(0, (idx * 1.1) % (Math.PI * 2), 0);
    b.goalX = THREE.MathUtils.clamp(
      WAIT_LOBBY_ORIGIN.x - 14.0 + (((idx + 4) * 4.1) % 24.5),
      abWait.minX + 0.9,
      abWait.maxX - 0.9,
    );
    b.goalY = b.group.position.y;
    b.goalZ = THREE.MathUtils.clamp(
      WAIT_LOBBY_ORIGIN.z - 7.2 + (((idx + 2) * 1.9) % 6.6),
      abWait.minZ + 0.8,
      abWait.maxZ - 0.8,
    );
    b.waitingActive = true;
    b.group.visible = true;
    b.animator?.reset();
  }

  private updateWaitingLobbySpawns(dt: number): void {
    const targets = this.world.targets;
    const totalHumans = 1 + this.onlineRemotePlayers.size;
    const maxWaitingBots = Math.min(
      targets.length,
      Math.max(0, BattleRoyaleEngine.MAX_WAIT_LOBBY_PEOPLE - totalHumans),
    );

    // If additional online humans joined mid-lobby, trim excess waiting bots to keep total <= 51
    if (this.waitLobbyBotsUnlocked > maxWaitingBots) {
      for (let k = maxWaitingBots; k < this.waitLobbyBotsUnlocked; k++) {
        const excess = targets[k];
        if (excess) {
          excess.waitingActive = false;
          excess.group.visible = false;
        }
      }
      this.waitLobbyBotsUnlocked = maxWaitingBots;
    }

    // Wait briefly so all multiplayer humans appear together first before bots stagger in
    if (this.waitLobbySpawnDelay > 0) {
      this.waitLobbySpawnDelay = Math.max(0, this.waitLobbySpawnDelay - dt);
      this.aliveCount = Math.min(
        BattleRoyaleEngine.MAX_WAIT_LOBBY_PEOPLE,
        totalHumans + this.waitLobbyBotsUnlocked,
      );
      return;
    }

    if (this.waitLobbyBotsUnlocked < maxWaitingBots) {
      this.waitLobbySpawnTimer += dt;
      if (this.waitLobbySpawnTimer >= 0.15) {
        this.waitLobbySpawnTimer = 0;
        const batchEnd = Math.min(maxWaitingBots, this.waitLobbyBotsUnlocked + 5);
        for (let k = this.waitLobbyBotsUnlocked; k < batchEnd; k++) {
          this.activateWaitingLobbyBot(targets[k], k);
        }
        this.waitLobbyBotsUnlocked = batchEnd;
      }
    }

    this.aliveCount = Math.min(
      BattleRoyaleEngine.MAX_WAIT_LOBBY_PEOPLE,
      totalHumans + this.waitLobbyBotsUnlocked,
    );
  }

  private enterAirplanePhase(): void {
    this.airplaneProgress = 0;
    this.followingTeamLeader = true;
    if (this.onlineAirplaneRoute) {
      this.planeStart.set(this.onlineAirplaneRoute.startX, 128, this.onlineAirplaneRoute.startZ);
      this.planeEnd.set(this.onlineAirplaneRoute.endX, 128, this.onlineAirplaneRoute.endZ);
    } else {
      const angle = Math.random() * Math.PI * 2;
      const r = this.isBermudaMapActive() ? 840 : 630;
      this.planeStart.set(Math.cos(angle) * r, 128, Math.sin(angle) * r);
      this.planeEnd.set(-Math.cos(angle) * r, 128, -Math.sin(angle) * r);
    }
    this.world.airplaneGroup.visible = true;
    this.world.airplaneGroup.position.copy(this.planeStart);
    this.world.airplaneGroup.lookAt(this.planeEnd);

    this.resetPlayerForMatch(this.planeStart.x, this.planeStart.z, false);
    this.pos.copy(this.planeStart);
    this.world.syncProximityLoot(0, 0, this.isBermudaMapActive() ? 860 : 520, 180);
    this.isGrounded = false;
    if (this.stateMachine.getState() !== GameState.AIRPLANE) {
      this.stateMachine.forceState(GameState.AIRPLANE);
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed || this.contextLost) return;
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      this.elapsed += dt;

      this.fpsAccumTime += rawDt;
      this.fpsFrames++;
      if (this.fpsAccumTime >= 0.4) {
        this.currentFps = Math.round(this.fpsFrames / this.fpsAccumTime);
        this.fpsAccumTime = 0;
        this.fpsFrames = 0;
      }

      this.updateSimulation(dt);
      this.renderActiveScene();

      this.hudEmitAccum += dt;
      if (this.hudDirty || this.hudEmitAccum >= 0.055) {
        this.hudEmitAccum = 0;
        this.hudDirty = false;
        this.onHudUpdate(this.buildHudSnapshot());
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (status === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSimulation(dt: number): void {
    const state = this.stateMachine.getState();

    // Update continuous flight / wind audio loop
    soundEngine.setFlightAudioMode(
      state === GameState.AIRPLANE
        ? 'airplane'
        : state === GameState.DROPPING
          ? 'skydiving'
          : state === GameState.PARACHUTE
            ? 'parachute'
            : 'none',
    );

    // Lobby 2017 theme: plays in Lobby/Waiting Island and softly through Airplane/Parachute drop
    soundEngine.setLobbyMusicMode(
      state === GameState.MENU ||
        state === GameState.LOBBY ||
        state === GameState.MATCHMAKING ||
        state === GameState.BOOT ||
        state === GameState.LOADING
        ? 'lobby'
        : state === GameState.WAITING
          ? 'waiting'
          : state === GameState.AIRPLANE ||
              state === GameState.DROPPING ||
              state === GameState.PARACHUTE
            ? 'drop'
            : 'off',
    );

    // Update Lobby 3D character standing centered on beach backdrop
    if (
      state === GameState.BOOT ||
      state === GameState.LOADING ||
      state === GameState.MENU ||
      state === GameState.LOBBY ||
      state === GameState.MATCHMAKING
    ) {
      if (state === GameState.MATCHMAKING) {
        this.matchmakingTimer += dt;
        if (this.matchmakingTimer >= 2.6) {
          this.beginMatchLoading('waiting');
        }
      }

      this.lobbyRig.root.rotation.y =
        this.lobbyOrbitYaw + Math.sin(this.elapsed * 0.75) * 0.06;
      const lobbyAnimState = {
        dt,
        speed: 0,
        stance: 'stand' as const,
        isGrounded: true,
        isSprinting: false,
        isAiming: false,
        isFiring: false,
        isLobby: true,
        isSkydiving: false,
        isParachuting: false,
        isDead: false,
        pitchRad: 0,
      };
      this.animator.update(this.lobbyRig, lobbyAnimState);
      for (let i = 0; i < this.lobbyExtraRigs.length; i++) {
        this.lobbyExtraRigs[i].root.rotation.y =
          this.lobbyOrbitYaw + Math.sin(this.elapsed * 0.75 + (i + 1) * 0.8) * 0.05;
        this.animator.update(this.lobbyExtraRigs[i], lobbyAnimState);
      }

      this.lobbyScene.camera.position.x = THREE.MathUtils.damp(
        this.lobbyScene.camera.position.x,
        0,
        8,
        dt,
      );
      this.lobbyScene.camera.position.y = THREE.MathUtils.damp(
        this.lobbyScene.camera.position.y,
        this.lobbySquadTargetZ > 4 ? 1.24 : 1.14,
        8,
        dt,
      );
      this.lobbyScene.camera.position.z = THREE.MathUtils.damp(
        this.lobbyScene.camera.position.z,
        this.lobbySquadTargetZ,
        8,
        dt,
      );
      this.lobbyScene.camera.lookAt(0, 0.84, 0);
      return;
    }

    // World dynamic props, proximity loot streaming, deployed Gloos, thrown grenades, explosion VFX & tracers
    const inMatchView = state === GameState.PLAYING || state === GameState.WAITING;
    const isAirborneLootView =
      state === GameState.AIRPLANE ||
      state === GameState.DROPPING ||
      state === GameState.PARACHUTE;
    if (inMatchView || isAirborneLootView) {
      this.lootSyncAccum += dt;
      const syncInterval = isAirborneLootView ? 0.12 : 0.35;
      if (this.lootSyncAccum >= syncInterval) {
        this.lootSyncAccum = 0;
        this.world.syncProximityLoot(
          this.pos.x,
          this.pos.z,
          isAirborneLootView ? 240 : 54,
          isAirborneLootView ? 80 : 24,
        );
      }
    }
    this.world.updateDynamicProps(
      dt,
      this.elapsed,
      isAirborneLootView ? this.pos : this.world.camera.position,
      isAirborneLootView ? 240 : inMatchView ? this.getLootRenderDist() : 120,
    );
    if (this.elapsed - this.activeObstaclesLastRefresh >= 0.15 || this.activeObstaclesLastRefresh < 0) {
      this.activeObstaclesLastRefresh = this.elapsed;
      this.refreshActiveObstacles();
    }
    this.updateDeployedGloos(dt);
    this.updateThrownGrenades(dt);
    this.updateExplosionVfx(dt);
    this.updateTracers(dt);
    this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - dt);
    this.headshotFlashTimer = Math.max(0, this.headshotFlashTimer - dt);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    this.lastGunfightTimer = Math.max(0, this.lastGunfightTimer - dt);
    this.camShake = THREE.MathUtils.damp(this.camShake, 0, 14, dt);
    for (let i = this.damagePopups.length - 1; i >= 0; i--) {
      this.damagePopups[i].age += dt;
      if (this.damagePopups[i].age >= 0.78) {
        this.damagePopups.splice(i, 1);
      }
    }
    for (let i = this.damageIndicators.length - 1; i >= 0; i--) {
      this.damageIndicators[i].age += dt;
      if (this.damageIndicators[i].age >= 1.45) {
        this.damageIndicators.splice(i, 1);
      }
    }
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].age += dt;
      if (this.killFeed[i].age >= 4.4) {
        this.killFeed.splice(i, 1);
      }
    }
    for (let i = this.likeToasts.length - 1; i >= 0; i--) {
      this.likeToasts[i].age += dt;
      if (this.likeToasts[i].age >= 3.2) {
        this.likeToasts.splice(i, 1);
      }
    }
    if (state === GameState.PLAYING && !this.isDead && this.botSpectators.length > 0) {
      for (let i = this.botSpectators.length - 1; i >= 0; i--) {
        const spec = this.botSpectators[i];
        if (!spec.liked && spec.likeAtElapsed !== null && this.elapsed >= spec.likeAtElapsed) {
          spec.liked = true;
          this.matchVisualLikes += 1;
          this.likeToasts.push({
            id: this.nextLikeToastId++,
            nick: `${spec.nick} deu Like!`,
            age: 0,
          });
          this.hudDirty = true;
        }
        if (this.elapsed >= spec.leaveAtElapsed) {
          this.botSpectators.splice(i, 1);
          this.hudDirty = true;
        }
      }
    }

    if (
      state === GameState.WAITING ||
      state === GameState.AIRPLANE ||
      state === GameState.DROPPING ||
      state === GameState.PARACHUTE ||
      state === GameState.PLAYING
    ) {
      this.updateBots(dt, state);
      if (this.onlineRoomId) {
        this.updateRemoteHumanEntities(dt, state);
        this.pushOnlineSyncState(dt);
      }
    }

    // Waiting Island countdown
    if (state === GameState.WAITING) {
      if (this.onlineRoomId && this.onlineWaitingEndsAtMs > 0) {
        this.waitingTimer = Math.max(0, (this.onlineWaitingEndsAtMs - Date.now()) / 1000);
      } else {
        this.waitingTimer = Math.max(0, this.waitingTimer - dt);
      }
      if (this.waitingTimer <= 0) {
        this.enterAirplanePhase();
        return;
      }
    }

    // Airplane flight phase
    if (state === GameState.AIRPLANE) {
      this.input.sample();
      const edges = this.input.consumeLookAndEdges();
      const sens = 0.0028 * this.settings.sensitivity;
      const invert = this.settings.invertY ? -1 : 1;
      this.yaw -= edges.dx * sens;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - edges.dy * sens * invert,
        -1.1,
        0.5,
      );

      if (this.onlineAirplaneRoute) {
        const dur = Math.max(10, this.onlineAirplaneRoute.durationSec);
        this.airplaneProgress = Math.min(
          1,
          Math.max(0, (Date.now() - this.onlineAirplaneRoute.startedAtMs) / (dur * 1000)),
        );
      } else {
        this.airplaneProgress += dt * 0.036;
      }
      this.pos.lerpVectors(this.planeStart, this.planeEnd, this.airplaneProgress);
      this.world.airplaneGroup.position.copy(this.pos);
      this.playerRig.root.visible = false;

      if (this.followingTeamLeader) {
        const leader = this.findOnlineTeamLeader();
        if (
          leader?.lastState &&
          (leader.lastState.flightPhase === 'dropping' ||
            leader.lastState.flightPhase === 'parachute')
        ) {
          this.jumpFromPlane(true);
          return;
        }
      }
      if (edges.jump || edges.interact) {
        this.jumpFromPlane();
        return;
      }
      if (this.airplaneProgress >= 0.96) {
        this.jumpFromPlane();
        return;
      }

      // Orbit camera behind/around plane
      const dist = 26;
      const horiz = Math.cos(this.pitch) * dist;
      _camDesired.set(
        this.pos.x + Math.sin(this.yaw) * horiz,
        this.pos.y - Math.sin(this.pitch) * dist + 4,
        this.pos.z + Math.cos(this.yaw) * horiz,
      );
      this.camPosCurrent.lerp(_camDesired, 1 - Math.exp(-8 * dt));
      this.camLookCurrent.lerp(this.pos, 1 - Math.exp(-10 * dt));
      this.world.camera.position.copy(this.camPosCurrent);
      this.world.camera.lookAt(this.camLookCurrent);
      return;
    }

    this.playerRig.root.visible = true;

    // Dropping (Skydiving) & Parachute
    if (state === GameState.DROPPING || state === GameState.PARACHUTE) {
      this.world.airplaneGroup.position.lerpVectors(
        this.planeStart,
        this.planeEnd,
        Math.min(1, this.airplaneProgress + dt * 0.036),
      );
      this.airplaneProgress += dt * 0.036;
      if (this.airplaneProgress >= 1.08) {
        this.world.airplaneGroup.visible = false;
      }

      this.input.sample();
      const edges = this.input.consumeLookAndEdges();
      const sens = 0.0028 * this.settings.sensitivity;
      const invert = this.settings.invertY ? -1 : 1;
      this.yaw -= edges.dx * sens;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - edges.dy * sens * invert,
        -1.15,
        0.65,
      );

      const isChute = state === GameState.PARACHUTE;
      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);

      const leaderFollowTarget = this.followingTeamLeader ? this.findOnlineTeamLeader() : null;
      const leaderAirPhase = leaderFollowTarget?.lastState?.flightPhase;
      const prevY = this.pos.y;
      const abDrop = this.getActiveBounds();
      const dropFloor = this.isBermudaMapActive() ? BERMUDA_GLB_WATER_Y : 0;
      let groundY = dropFloor;
      let landedInAir = false;

      if (
        leaderFollowTarget?.lastState &&
        (leaderAirPhase === 'dropping' || leaderAirPhase === 'parachute')
      ) {
        const formOffsets: Array<[number, number]> = [
          [-3.0, -2.5],
          [3.0, -2.5],
          [0, -4.6],
        ];
        const [rx, fx] = formOffsets[(Math.max(2, this.onlineSlotInTeam) - 2) % formOffsets.length];
        const lyaw = leaderFollowTarget.targetYaw;
        const lFwdX = -Math.sin(lyaw);
        const lFwdZ = -Math.cos(lyaw);
        const lRightX = Math.cos(lyaw);
        const lRightZ = -Math.sin(lyaw);
        const goalX = leaderFollowTarget.targetPos.x + lRightX * rx + lFwdX * fx;
        const goalY = leaderFollowTarget.targetPos.y + 0.35;
        const goalZ = leaderFollowTarget.targetPos.z + lRightZ * rx + lFwdZ * fx;
        const followLerp = 1 - Math.exp(-8 * dt);
        this.pos.x = THREE.MathUtils.lerp(this.pos.x, goalX, followLerp);
        this.pos.y = THREE.MathUtils.lerp(this.pos.y, goalY, followLerp);
        this.pos.z = THREE.MathUtils.lerp(this.pos.z, goalZ, followLerp);
        this.vel.set(0, isChute ? -8.5 : -28, 0);
        this.pos.x = THREE.MathUtils.clamp(this.pos.x, abDrop.minX + 6, abDrop.maxX - 6);
        this.pos.z = THREE.MathUtils.clamp(this.pos.z, abDrop.minZ + 6, abDrop.maxZ - 6);
        this.resolveHorizontalCollisions(0.44, 0.22, 1.72, 0.38);
        this.resolveHorizontalCollisions(0.44, 0.22, 1.72, 0.38);
        groundY = Math.max(
          dropFloor,
          this.resolveFloorHeight(this.pos.x, this.pos.z, Math.max(this.pos.y, prevY), 0.45),
        );
        if (!isChute && leaderAirPhase === 'parachute') {
          this.openParachute();
        }
        if (this.pos.y <= groundY && this.vel.y <= 0) {
          landedInAir = true;
        }
      } else {
        if (this.followingTeamLeader && leaderAirPhase === 'landed') {
          this.followingTeamLeader = false;
        }
        if (this.launchPadFlightTimer > 0) {
          this.launchPadFlightTimer = Math.max(0, this.launchPadFlightTimer - dt);
          this.isSprinting = false;
          this.vel.y -= 14.5 * dt;
        } else {
          const airMoveActive =
            Math.abs(this.input.moveX) > 0.05 || Math.abs(this.input.moveZ) > 0.05;
          this.isSprinting = this.input.isSprinting && airMoveActive;
          const sprintMult = this.isSprinting ? 1.28 : 1.0;
          const moveSpeed = (isChute ? 17 : 26) * sprintMult;
          const mx = (forwardX * this.input.moveZ + rightX * this.input.moveX) * moveSpeed;
          const mz = (forwardZ * this.input.moveZ + rightZ * this.input.moveX) * moveSpeed;
          this.vel.x = THREE.MathUtils.damp(this.vel.x, mx, 4, dt);
          this.vel.z = THREE.MathUtils.damp(this.vel.z, mz, 4, dt);
          const targetFallY = isChute
            ? this.isSprinting
              ? -10.5
              : -8.5
            : this.isSprinting
              ? -34
              : -28;
          this.vel.y = THREE.MathUtils.damp(this.vel.y, targetFallY, 3.5, dt);
        }

        // Sub-step air integration so fast diving/parachuting never tunnels through thin walls, roofs, or towers
        const frameDisp = Math.max(
          Math.hypot(this.vel.x, this.vel.z) * dt,
          Math.abs(this.vel.y) * dt,
        );
        const subSteps = Math.max(1, Math.min(6, Math.ceil(frameDisp / 0.32)));
        const subDt = dt / subSteps;
        for (let s = 0; s < subSteps; s++) {
          const subPrevY = this.pos.y;
          this.pos.addScaledVector(this.vel, subDt);
          this.pos.x = THREE.MathUtils.clamp(this.pos.x, abDrop.minX + 6, abDrop.maxX - 6);
          this.pos.z = THREE.MathUtils.clamp(this.pos.z, abDrop.minZ + 6, abDrop.maxZ - 6);

          const intendedX = this.pos.x;
          const intendedZ = this.pos.z;
          this.resolveHorizontalCollisions(0.44, 0.22, 1.72, 0.38);
          this.resolveHorizontalCollisions(0.44, 0.22, 1.72, 0.38);
          const pushX = this.pos.x - intendedX;
          const pushZ = this.pos.z - intendedZ;
          const pushLen = Math.hypot(pushX, pushZ);
          if (pushLen > 0.002) {
            const pnx = pushX / pushLen;
            const pnz = pushZ / pushLen;
            const inward = this.vel.x * pnx + this.vel.z * pnz;
            if (inward < 0) {
              this.vel.x -= pnx * inward;
              this.vel.z -= pnz * inward;
            }
          }

          groundY = Math.max(
            dropFloor,
            this.resolveFloorHeight(this.pos.x, this.pos.z, Math.max(this.pos.y, subPrevY), 0.45),
          );
          if (this.pos.y <= groundY && this.vel.y <= 0) {
            landedInAir = true;
            break;
          }
        }
      }

      const altitude = this.pos.y - groundY;

      if (!isChute && (edges.jump || edges.interact || (this.vel.y < -2.0 && altitude < 28))) {
        this.launchPadFlightTimer = 0;
        this.followingTeamLeader = false;
        this.openParachute();
      }
      if (landedInAir) {
        this.launchPadFlightTimer = 0;
        this.pos.y = groundY;
        this.vel.set(0, 0, 0);
        this.isGrounded = true;
        this.animator.triggerLanding();
        this.world.airplaneGroup.visible = false;
        soundEngine.playLanding();
        this.stateMachine.transition(GameState.PLAYING);
      }

      this.characterYaw = this.yaw;
      this.playerRig.root.position.copy(this.pos);
      this.playerRig.root.rotation.y = this.characterYaw + Math.PI;
      this.animator.update(this.playerRig, {
        dt,
        speed: Math.hypot(this.vel.x, this.vel.z),
        stance: 'stand',
        isGrounded: false,
        isSprinting: this.isSprinting,
        isAiming: false,
        isFiring: false,
        isLobby: false,
        isSkydiving: !isChute,
        isParachuting: isChute,
        isDead: false,
        pitchRad: this.pitch,
      });

      this.updateThirdPersonCamera(dt, isChute ? 6.5 : 5.2, isChute ? 1.8 : 1.4);
      return;
    }

    // Active Ground Gameplay (WAITING or PLAYING)
    if (state === GameState.WAITING || state === GameState.PLAYING) {
      if (state === GameState.PLAYING) {
        if (this.gameVariant === 'gladiadores') {
          this.world.safeZoneMesh.visible = false;
          this.updateGladiadoresRound(dt);
        } else {
          this.updateSafeZone(dt);
          this.updateAirDrops(dt);
        }
      } else {
        this.world.safeZoneMesh.visible = false;
      }

      this.updateVehicles(dt);

      if (this.isDead) {
        this.isAiming = false;
        this.isSprinting = false;
        this.usingMedkit = false;
        this.healRingMesh.visible = false;
        this.lockedTargetId = null;

        if (this.isSpectating) {
          this.playerRig.root.visible = false;
          this.input.sample();
          this.input.consumeLookAndEdges();

          const candidates = this.getSpectateCandidates();
          if (candidates.length === 0) {
            this.isSpectating = false;
            this.spectateTargetRef = null;
            this.stateMachine.forceState(GameState.GAMEOVER);
            return;
          }

          const refValid = (
            ref: { kind: 'human'; accountId: number } | { kind: 'bot'; botId: string } | null,
          ): boolean => {
            if (!ref) return false;
            if (ref.kind === 'human') {
              const ent = this.onlineRemotePlayers.get(ref.accountId);
              return Boolean(ent && ent.lastState && !ent.lastState.eliminated);
            }
            const bot = this.targetById.get(ref.botId);
            return Boolean(bot && !bot.eliminated && bot.downTimer <= 0);
          };

          if (!refValid(this.spectateTargetRef)) {
            this.spectateTargetRef = candidates[0];
            this.spectateSnapNext = true;
            this.hudDirty = true;
          }

          const ref = this.spectateTargetRef!;
          let targetYaw = this.yaw;
          let targetPitch = -0.12;
          let camDist = 3.55;
          let camHeight = 1.44;
          let spAiming = false;
          let spSprinting = false;

          if (ref.kind === 'human') {
            const ent = this.onlineRemotePlayers.get(ref.accountId)!;
            const st = ent.lastState!;
            this.pos.copy(ent.rig.root.position);
            targetYaw = st.yaw;
            targetPitch = THREE.MathUtils.clamp(st.pitch, -0.85, 0.55);
            spAiming = st.isAiming;
            spSprinting = st.isSprinting;
            if (st.activeVehicleId) {
              camDist = 6.4;
              camHeight = 1.55;
            } else if (st.flightPhase === 'parachute') {
              camDist = 6.2;
              camHeight = 1.7;
            } else if (st.flightPhase === 'dropping') {
              camDist = 5.0;
              camHeight = 1.4;
            } else if (st.isDowned || st.stance === 'prone') {
              camDist = 3.2;
              camHeight = 0.62;
            } else if (st.stance === 'crouch') {
              camDist = spAiming ? 2.45 : 3.35;
              camHeight = 1.04;
            } else {
              camDist = spAiming ? 2.55 : 3.55;
              camHeight = 1.46;
            }
          } else {
            const bot = this.targetById.get(ref.botId)!;
            this.pos.copy(bot.group.position);
            // Bot forward is (+sin(rotY), +cos(rotY)); player cam forward is (-sin(yaw), -cos(yaw))
            targetYaw = bot.group.rotation.y + Math.PI;
            targetPitch = -0.08;
            if (bot.aiState === 'combat' && bot.targetId) {
              let tPos: { x: number; y: number; z: number } | null = null;
              if (bot.targetId !== 'player') {
                const tb = this.targetById.get(bot.targetId);
                if (tb && !tb.eliminated) {
                  tPos = {
                    x: tb.group.position.x,
                    y: tb.group.position.y + (tb.isDowned ? 0.45 : tb.chestOffsetY),
                    z: tb.group.position.z,
                  };
                } else {
                  for (const re of this.onlineRemotePlayers.values()) {
                    if (`remote_${re.accountId}` === bot.targetId && re.lastState && !re.lastState.eliminated) {
                      tPos = {
                        x: re.rig.root.position.x,
                        y: re.rig.root.position.y + 1.15,
                        z: re.rig.root.position.z,
                      };
                      break;
                    }
                  }
                }
              }
              if (tPos) {
                const hDist = Math.max(
                  0.5,
                  Math.hypot(tPos.x - bot.group.position.x, tPos.z - bot.group.position.z),
                );
                const dy = tPos.y - (bot.group.position.y + 1.32);
                targetPitch = THREE.MathUtils.clamp(Math.atan2(dy, hDist), -0.55, 0.45);
              }
              spAiming = bot.fireCooldown > 0.02;
              camDist = 3.05;
            } else if (bot.airState === 'parachuting') {
              camDist = 6.2;
              camHeight = 1.7;
            } else if (bot.airState === 'skydiving') {
              camDist = 5.0;
              camHeight = 1.4;
            } else if (bot.isDowned) {
              camDist = 3.2;
              camHeight = 0.62;
            } else if (bot.aiState === 'heal' || bot.aiState === 'revive') {
              camDist = 3.35;
              camHeight = 1.04;
            } else {
              spSprinting = bot.aiState === 'roam' || bot.aiState === 'loot';
              camDist = 3.55;
              camHeight = 1.44;
            }
          }

          if (this.spectateSnapNext) {
            this.yaw = targetYaw;
            this.pitch = targetPitch;
          } else {
            const lookAlpha = 1 - Math.exp(-15 * dt);
            this.yaw = lerpAngle(this.yaw, targetYaw, lookAlpha);
            this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, lookAlpha);
          }
          this.isAiming = spAiming;
          this.isSprinting = spSprinting;
          this.aimLockedTarget = false;
          this.aimAssistActive = false;
          this.updateThirdPersonCamera(dt, camDist, camHeight, 'none', false, this.spectateSnapNext);
          this.spectateSnapNext = false;
          return;
        }

        this.playerRig.weaponMount.visible = true;
        this.playerRig.root.visible = true;
        this.deathTimer -= dt;
        this.animator.update(this.playerRig, {
          dt,
          speed: 0,
          stance: this.stance,
          isGrounded: true,
          isSprinting: false,
          isAiming: false,
          isFiring: false,
          isLobby: false,
          isSkydiving: false,
          isParachuting: false,
          isDead: true,
          pitchRad: 0,
        });
        this.updateThirdPersonCamera(dt, 4.2, 1.0);
        if (this.gameVariant === 'gladiadores') {
          return;
        }
        if (this.deathTimer <= 0) {
          const candidates = this.getSpectateCandidates();
          if (candidates.length > 0 && this.aliveCount > 1) {
            this.isSpectating = true;
            this.spectateTargetRef = candidates[0];
            this.spectateSnapNext = true;
            this.hudDirty = true;
          } else {
            this.stateMachine.forceState(GameState.GAMEOVER);
          }
        }
        return;
      }

      if (this.activeVehicleId) {
        this.updateDrivingPlayer(dt);
      } else {
        this.updateGroundPlayer(dt);
      }
    }
  }

  private updateSafeZone(dt: number): void {
    const phaseIdx = Math.min(SAFE_ZONE_PHASES.length - 1, this.zonePhase - 1);
    const phaseDef = SAFE_ZONE_PHASES[phaseIdx];

    if (this.airplaneProgress < 1.08) {
      this.airplaneProgress += dt * 0.036;
      if (this.airplaneProgress >= 1.08) {
        this.world.airplaneGroup.visible = false;
      }
    }

    this.zoneTimer = Math.max(0, this.zoneTimer - dt);

    if (!this.zoneIsShrinking) {
      if (this.zoneTimer <= 0) {
        this.zoneIsShrinking = true;
        this.zoneStartX = this.zoneCurrentX;
        this.zoneStartZ = this.zoneCurrentZ;
        this.zoneStartRadius = this.zoneCurrentRadius;
        this.zoneShrinkTotal = phaseDef.shrinkSec;
        this.zoneTimer = phaseDef.shrinkSec;
      }
    } else {
      const t = THREE.MathUtils.clamp(
        1 - this.zoneTimer / Math.max(1, this.zoneShrinkTotal),
        0,
        1,
      );
      this.zoneCurrentX = THREE.MathUtils.lerp(this.zoneStartX, this.zoneNextX, t);
      this.zoneCurrentZ = THREE.MathUtils.lerp(this.zoneStartZ, this.zoneNextZ, t);
      this.zoneCurrentRadius = THREE.MathUtils.lerp(
        this.zoneStartRadius,
        this.zoneNextRadius,
        t,
      );

      if (this.zoneTimer <= 0) {
        this.zoneCurrentX = this.zoneNextX;
        this.zoneCurrentZ = this.zoneNextZ;
        this.zoneCurrentRadius = this.zoneNextRadius;
        this.zoneIsShrinking = false;

        if (this.zonePhase < SAFE_ZONE_PHASES.length) {
          this.zonePhase += 1;
          const nextDef = SAFE_ZONE_PHASES[this.zonePhase - 1];
          this.zoneTimer = nextDef.waitSec;
          this.pickNextZoneCenter(
            this.zoneCurrentX,
            this.zoneCurrentZ,
            this.zoneCurrentRadius,
            this.getSafeZoneTargetRadius(this.zonePhase - 1),
          );
        } else {
          this.zoneTimer = 0;
        }
      }
    }

    this.world.safeZoneMesh.visible = true;
    this.world.safeZoneMesh.position.set(this.zoneCurrentX, 75, this.zoneCurrentZ);
    const visR = Math.max(4, this.zoneCurrentRadius);
    this.world.safeZoneMesh.scale.set(visR, 1, visR);

    // Apply discrete 1.5s Safe Zone damage ticks with 0.5s grace period (first tick at 0.5s)
    const playerDist = Math.hypot(
      this.pos.x - this.zoneCurrentX,
      this.pos.z - this.zoneCurrentZ,
    );
    if (!this.isDead && playerDist > this.zoneCurrentRadius) {
      this.zoneGasExposureSec += dt;
      this.zoneDmgTickTimer += dt;
      const targetInterval = this.zoneGasExposureSec <= 0.55 ? 0.5 : 1.5;
      if (this.zoneDmgTickTimer >= targetInterval) {
        this.zoneDmgTickTimer -= targetInterval;
        if (this.zoneDmgTickTimer > targetInterval) this.zoneDmgTickTimer = 0;
        const gasMult = 1 + Math.floor(this.zoneGasExposureSec / 150);
        const baseSafeDmg = Math.max(1, Math.round(phaseDef.damagePerSec * 0.45));
        const tickDmg = Math.max(1, Math.round(baseSafeDmg * gasMult));
        this.damageFlashTimer = 0.14;
        soundEngine.playSafeZoneDamage(this.zonePhase >= 4 || gasMult >= 2);
        if (this.isPlayerDowned) {
          this.playerBleedHp = Math.max(0, this.playerBleedHp - tickDmg);
          if (this.playerBleedHp <= 0) {
            this.eliminatePlayerAndSquad('ZONA SEGURA', 'SAFE', false);
          }
        } else {
          this.hp = Math.max(0, this.hp - tickDmg);
          if (this.hp <= 0) {
            this.handlePlayerZeroHp('ZONA SEGURA', 'SAFE', false);
          }
        }
      }
    } else {
      this.zoneDmgTickTimer = 0;
      this.zoneGasExposureSec = 0;
    }
  }

  private getScopeSensitivityScale(scope: ScopeType): number {
    if (!this.isAiming) return this.settings.sensitivity;
    if (scope === 'none' || scope === '1x') {
      return this.settings.redDotSensitivity * (scope === '1x' ? 0.78 : 0.88);
    }
    if (scope === '2x') return this.settings.scope2xSensitivity * 0.56;
    if (scope === '4x') return this.settings.scope4xSensitivity * 0.36;
    return this.settings.sniperSensitivity * 0.24;
  }

  private hasTerrainObstruction(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    dist: number,
  ): boolean {
    if (dist <= 2) return false;
    const steps = dist > 45 ? 8 : 5;
    for (let s = 1; s < steps; s++) {
      const t = (s / steps) * dist;
      const sx = origin.x + dir.x * t;
      const sy = origin.y + dir.y * t;
      const sz = origin.z + dir.z * t;
      if (sy < this.world.groundHeightAt(sx, sz) - 0.12) {
        return true;
      }
    }
    return false;
  }

  private raycastTerrainDist(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxRange: number,
  ): number {
    const steps = 14;
    const stepLen = maxRange / steps;
    let prevT = 0;
    for (let s = 1; s <= steps; s++) {
      const t = s * stepLen;
      const sx = origin.x + dir.x * t;
      const sy = origin.y + dir.y * t;
      const sz = origin.z + dir.z * t;
      const gy = this.world.groundHeightAt(sx, sz);
      if (sy <= gy) {
        // Binary refine once between prevT and t
        const midT = (prevT + t) * 0.5;
        const msy = origin.y + dir.y * midT;
        const mgy = this.world.groundHeightAt(
          origin.x + dir.x * midT,
          origin.z + dir.z * midT,
        );
        return msy <= mgy ? midT : t;
      }
      prevT = t;
    }
    return maxRange;
  }

  private refreshActiveObstacles(): void {
    const src = this.solidObstaclesNoTerrain;
    const dst = this.solidObstaclesActive;
    dst.length = 0;
    for (let i = 0; i < src.length; i++) {
      const m = src[i];
      const root = m.userData.cullRoot as THREE.Object3D | undefined;
      if (root && !root.visible) continue;
      dst.push(m);
    }
  }

  private hasLineOfSightToPoint(origin: THREE.Vector3, targetPoint: THREE.Vector3): boolean {
    _rayDir.copy(targetPoint).sub(origin);
    const dist = _rayDir.length();
    if (dist <= 0.3) return true;
    _rayDir.divideScalar(dist);
    if (this.hasTerrainObstruction(origin, _rayDir, dist)) {
      return false;
    }
    const glbHitDist = this.raycastActiveGlbWall(origin, _rayDir, dist - 0.35);
    if (glbHitDist !== null) {
      return false;
    }
    this.raycaster.set(origin, _rayDir);
    this.raycaster.far = dist - 0.35;
    const hits = this.raycaster.intersectObjects(this.solidObstaclesActive, false);
    return hits.length === 0;
  }

  private computeExactAnglesToTarget(
    tx: number,
    ty: number,
    tz: number,
    camHeight: number,
    shoulderOffset: number,
  ): { yaw: number; pitch: number; horiz: number } {
    const py = this.pos.y + camHeight;
    let yEst = this.yaw;
    let px = this.pos.x + Math.cos(yEst) * shoulderOffset;
    let pz = this.pos.z - Math.sin(yEst) * shoulderOffset;
    let dx = tx - px;
    let dz = tz - pz;
    yEst = Math.atan2(-dx, -dz);

    // Second pass refines exact camera shoulder pivot so (camPos, pivot, target) are collinear
    px = this.pos.x + Math.cos(yEst) * shoulderOffset;
    pz = this.pos.z - Math.sin(yEst) * shoulderOffset;
    dx = tx - px;
    dz = tz - pz;
    const yawOut = Math.atan2(-dx, -dz);
    const horiz = Math.hypot(dx, dz);
    const pitchOut = THREE.MathUtils.clamp(Math.atan2(ty - py, horiz), -1.0, 0.8);
    return { yaw: yawOut, pitch: pitchOut, horiz };
  }

  private getBotBodyPoint(
    bot: TargetDummy,
    part: 'chest' | 'head',
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const bx = bot.group.position.x;
    const by = bot.group.position.y;
    const bz = bot.group.position.z;
    if (bot.hitMeshes.length >= 2) {
      bot.group.updateMatrixWorld(true);
      const hitMesh = part === 'head' ? bot.hitMeshes[1] : bot.hitMeshes[0];
      if (hitMesh) {
        hitMesh.getWorldPosition(out);
        return out;
      }
    }
    if (bot.isDowned) {
      const fwdX = Math.sin(bot.group.rotation.y);
      const fwdZ = Math.cos(bot.group.rotation.y);
      if (part === 'head') {
        return out.set(bx + fwdX * 0.78, by + 0.76, bz + fwdZ * 0.78);
      }
      return out.set(bx + fwdX * 0.36, by + 0.60, bz + fwdZ * 0.36);
    }
    return out.set(bx, by + (part === 'head' ? bot.headOffsetY : bot.chestOffsetY), bz);
  }

  private findAimAssistTarget(maxAngleRad: number, maxRange: number): TargetDummy | null {
    const cam = this.world.camera;
    const camPos = cam.position;
    const cp = Math.cos(this.pitch);
    const fx = -Math.sin(this.yaw) * cp;
    const fy = Math.sin(this.pitch);
    const fz = -Math.cos(this.yaw) * cp;

    // Player eye origin for reliable LOS even at very close range or behind low cover
    _rayOrigin.set(this.pos.x, this.pos.y + 1.42, this.pos.z);

    let best: TargetDummy | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < this.world.targets.length; i++) {
      const t = this.world.targets[i];
      if (t.isAlly || t.eliminated || !t.group.visible) continue;
      if (t.downTimer > 0 && !t.isDowned) continue;

      this.getBotBodyPoint(t, 'chest', _v2);
      this.getBotBodyPoint(t, 'head', _v3);
      const by = t.group.position.y;
      const dx = _v2.x - camPos.x;
      const dyChest = _v2.y - camPos.y;
      const dz = _v2.z - camPos.z;

      // Forward projection along camera ray to enemy distance
      const proj = dx * fx + dyChest * fy + dz * fz;
      const playerDist = Math.hypot(_v2.x - this.pos.x, _v2.z - this.pos.z);
      if (proj < 0.8 || playerDist > maxRange) continue;

      // Exact 3D point where the crosshair ray passes the enemy
      const rayX = camPos.x + fx * proj;
      const rayY = camPos.y + fy * proj;
      const rayZ = camPos.z + fz * proj;

      // Dynamic vertical bounds track standing, crouching, medkit-kneeling, and crawling poses
      const distVertPad = THREE.MathUtils.clamp(proj * 0.026, 0.24, 1.25);
      const headTopWorldY = Math.max(_v3.y + 0.34, by + 0.95) + distVertPad * 0.72;
      const minWorldY = Math.min(_v2.y - 0.95, by - 0.28) - distVertPad;
      if (rayY > headTopWorldY || rayY < minWorldY) continue;

      // Wide close-range & angular sticky zone around torso
      const horizErr = Math.hypot(rayX - _v2.x, rayZ - _v2.z);
      const farFalloff =
        proj > 120 ? THREE.MathUtils.clamp(1 - (proj - 120) / 145, 0.55, 1.0) : 1.0;
      const minStickRadius = playerDist < 12 ? 2.25 : 1.55;
      const maxHorizErr = THREE.MathUtils.clamp(
        Math.tan(maxAngleRad) * proj * farFalloff,
        minStickRadius,
        7.8 * farFalloff,
      );

      // Screen-space reticle halo capture helps close-quarters engagements snap cleanly
      let inScreenHalo = false;
      if (playerDist < 16) {
        _camDesired.copy(_v2).project(cam);
        if (_camDesired.z >= -1 && _camDesired.z <= 1) {
          const ndcDist = Math.hypot(_camDesired.x, _camDesired.y);
          if (ndcDist <= (this.isAiming ? 0.38 : 0.34)) {
            inScreenHalo = true;
          }
        }
      }

      if (horizErr <= maxHorizErr || inScreenHalo) {
        const score = Math.atan2(horizErr, Math.max(1.5, proj));
        if (score < bestScore) {
          if (
            this.hasLineOfSightToPoint(_rayOrigin, _v2) ||
            this.hasLineOfSightToPoint(_rayOrigin, _v3) ||
            this.hasLineOfSightToPoint(camPos, _v3)
          ) {
            bestScore = score;
            best = t;
          }
        }
      }
    }
    return best;
  }

  private fillActiveTargetMeshes(): number {
    this.scratchTargetMeshes.length = 0;
    const targets = this.world.targets;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.isAlly || t.eliminated || !t.group.visible) continue;
      if (t.downTimer > 0 && !t.isDowned) continue;
      // Guarantee bot hitboxes match current-frame world transform before raycasting
      t.group.updateMatrixWorld(true);
      for (let j = 0; j < t.hitMeshes.length; j++) {
        this.scratchTargetMeshes.push(t.hitMeshes[j]);
      }
    }
    if (this.onlineRoomId) {
      for (const ent of this.onlineRemotePlayers.values()) {
        if (ent.teamId === this.onlineTeamId || !ent.rig.root.visible) continue;
        if (ent.lastState?.eliminated) continue;
        ent.rig.root.updateMatrixWorld(true);
        for (let j = 0; j < ent.hitMeshes.length; j++) {
          this.scratchTargetMeshes.push(ent.hitMeshes[j]);
        }
      }
    }
    return this.scratchTargetMeshes.length;
  }

  private checkCrosshairTargetLock(maxRange: number): boolean {
    if (this.fillActiveTargetMeshes() === 0) return false;

    // 1. Direct center crosshair ray hit on target hitbox
    this.raycaster.setFromCamera(_centerNdc, this.world.camera);
    this.raycaster.far = maxRange;
    const targetHits = this.raycaster.intersectObjects(this.scratchTargetMeshes, false);
    if (targetHits.length > 0) {
      const hitDist = targetHits[0].distance;
      if (
        !this.hasTerrainObstruction(
          this.raycaster.ray.origin,
          this.raycaster.ray.direction,
          hitDist,
        )
      ) {
        const glbHitDist = this.raycastActiveGlbWall(
          this.raycaster.ray.origin,
          this.raycaster.ray.direction,
          Math.max(0.2, hitDist - 0.15),
        );
        if (glbHitDist === null) {
          this.raycaster.far = Math.max(0.2, hitDist - 0.15);
          const obstacleHits = this.raycaster.intersectObjects(
            this.solidObstaclesActive,
            false,
          );
          if (obstacleHits.length === 0) return true;
        }
      }
    }

    // 2. Classic FF red proximity zone near the crosshair (wide distance-scaled sticky capture)
    const redZoneCone = this.isAiming ? 0.31 : 0.28;
    return this.findAimAssistTarget(redZoneCone, maxRange) !== null;
  }

  private findNearestDownedAlly(): { bot: TargetDummy; slotNumber: number } | null {
    let best: { bot: TargetDummy; slotNumber: number } | null = null;
    let bestDist = 3.8;
    let allySlot = 2;
    for (let i = 0; i < this.world.targets.length; i++) {
      const b = this.world.targets[i];
      if (!b.isAlly) continue;
      const curSlot = allySlot++;
      if (!b.isDowned || b.eliminated || b.downTimer > 0) continue;
      const d = Math.hypot(b.group.position.x - this.pos.x, b.group.position.z - this.pos.z);
      if (d <= bestDist && Math.abs(b.group.position.y - this.pos.y) < 2.2) {
        bestDist = d;
        best = { bot: b, slotNumber: curSlot };
      }
    }
    return best;
  }

  private findNearbyWindowSill(): boolean {
    const cols = this.world.colliders;
    const py = this.pos.y;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c.tag !== 'house-window-sill') continue;
      if (Math.abs(py - c.minY) > 1.35) continue;
      const dx = this.pos.x - c.cx;
      const dz = this.pos.z - c.cz;
      const maxExtent = c.halfW + c.halfD + 1.35;
      if (Math.abs(dx) > maxExtent || Math.abs(dz) > maxExtent) continue;
      const cos = Math.cos(c.rotY);
      const sin = Math.sin(c.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= c.halfW + 1.15 && Math.abs(lz) <= c.halfD + 1.15) {
        return true;
      }
    }
    return false;
  }

  private getEffectiveMagSize(w: WeaponSlotState): number {
    const base = WEAPONS[w.weaponId].magSize;
    return w.attachments.magazine === 'ext_mag' ? Math.round(base * 1.35) : base;
  }

  private getEffectiveReloadSec(w: WeaponSlotState): number {
    const base = WEAPONS[w.weaponId].reloadTimeSec;
    return w.attachments.magazine === 'ext_mag' ? base * 0.76 : base;
  }

  private updateGroundPlayer(dt: number): void {
    this.input.sample();
    const edges = this.input.consumeLookAndEdges();

    if (this.isPlayerDowned) {
      let bleedRate = 4.6;
      if (this.stateMachine.getState() === GameState.PLAYING) {
        const dz = Math.hypot(this.pos.x - this.zoneCurrentX, this.pos.z - this.zoneCurrentZ);
        if (dz > this.zoneCurrentRadius) {
          const pDef = SAFE_ZONE_PHASES[Math.min(SAFE_ZONE_PHASES.length - 1, this.zonePhase - 1)];
          bleedRate += pDef.damagePerSec * 0.7;
        }
      }
      this.playerBleedHp = Math.max(0, this.playerBleedHp - bleedRate * dt);
      if (this.playerBleedHp <= 0) {
        this.eliminatePlayerAndSquad('SANGRAMENTO', 'SANGRAMENTO', false);
        return;
      }

      const sens = 0.0028 * this.settings.sensitivity;
      const invert = this.settings.invertY ? -1 : 1;
      this.yaw -= edges.dx * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - edges.dy * sens * invert, -0.85, 0.65);

      this.isAiming = false;
      this.isSprinting = false;
      this.usingMedkit = false;
      this.isReloading = false;
      this.isPlacingGloo = false;
      this.isHoldingGrenade = false;
      this.healRingMesh.visible = false;
      this.glooPreviewMesh.visible = false;
      this.grenadeLine.visible = false;
      this.grenadeTargetMesh.visible = false;

      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);
      const hasMove = Math.abs(this.input.moveX) > 0.05 || Math.abs(this.input.moveZ) > 0.05;
      const crawlSpeed = 1.35;
      const targetVx = (forwardX * this.input.moveZ + rightX * this.input.moveX) * crawlSpeed;
      const targetVz = (forwardZ * this.input.moveZ + rightZ * this.input.moveX) * crawlSpeed;
      this.vel.x = THREE.MathUtils.damp(this.vel.x, targetVx, 14, dt);
      this.vel.z = THREE.MathUtils.damp(this.vel.z, targetVz, 14, dt);
      this.vel.y -= 20.5 * dt;

      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.resolveHorizontalCollisions(0.24, 0.2, 0.52);
      this.resolveHorizontalCollisions(0.24, 0.2, 0.52);
      this.pos.y += this.vel.y * dt;
      const abDowned = this.getActiveBounds();
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, abDowned.minX, abDowned.maxX);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, abDowned.minZ, abDowned.maxZ);

      const floorY = Math.max(
        this.getDryMinFloorY(),
        this.resolveFloorHeight(this.pos.x, this.pos.z, this.pos.y, 0.26),
      );
      if (this.pos.y <= floorY) {
        this.pos.y = floorY;
        this.vel.y = 0;
        this.isGrounded = true;
      }

      const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
      if (horizSpeed > 0.25 && hasMove) {
        const moveVx = forwardX * this.input.moveZ + rightX * this.input.moveX;
        const moveVz = forwardZ * this.input.moveZ + rightZ * this.input.moveX;
        const targetCharYaw = Math.atan2(-moveVx, -moveVz);
        let diff = targetCharYaw - this.characterYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.characterYaw += diff * (1 - Math.exp(-10 * dt));
      }

      this.playerRig.root.visible = true;
      this.playerRig.weaponMount.visible = false;
      this.playerRig.root.position.copy(this.pos);
      this.playerRig.root.rotation.y = this.characterYaw + Math.PI;
      this.animator.update(this.playerRig, {
        dt,
        speed: horizSpeed,
        stance: 'crouch',
        isGrounded: this.isGrounded,
        isSprinting: false,
        isAiming: false,
        isFiring: false,
        isLobby: false,
        isSkydiving: false,
        isParachuting: false,
        isDead: false,
        isDowned: true,
        hasWeapon: false,
        pitchRad: this.pitch,
      });

      this.updateThirdPersonCamera(dt, 3.55, 0.85, 'none', false, false);
      return;
    }

    this.pullingUpTimer = Math.max(0, this.pullingUpTimer - dt);
    this.bugDoCapaTimer = Math.max(0, this.bugDoCapaTimer - dt);
    this.combatPoseTimer = Math.max(0, this.combatPoseTimer - dt);
    this.vaultTimer = Math.max(0, this.vaultTimer - dt);
    this.canVaultWindow = this.findNearbyWindowSill();

    if (this.input.consumeResetCameraFlag()) {
      this.camShake = 0;
      this.aimBreakAccum = 0;
      this.hudDirty = true;
    }

    if (edges.backpack) {
      this.onBackpackRequest?.();
    }
    if (edges.medkit) {
      this.useMedkit();
    }
    if (edges.smallMedkit) {
      this.useSmallKit();
    }
    if (edges.gloo) {
      if (this.glooCount > 0) {
        this.isPlacingGloo = !this.isPlacingGloo;
        if (this.isPlacingGloo) {
          this.isHoldingGrenade = false;
          soundEngine.playWeaponSwitch();
        }
      } else {
        this.isPlacingGloo = false;
      }
    }
    if (edges.grenade) {
      if (this.grenadeCount > 0) {
        this.isHoldingGrenade = !this.isHoldingGrenade;
        if (this.isHoldingGrenade) {
          this.isPlacingGloo = false;
          soundEngine.playGrenadePin();
        }
      } else {
        this.isHoldingGrenade = false;
      }
    }

    // Weapon slot switching (1/2/3/4 keys, HUD clicks, Q quick-swap, or mouse wheel)
    let justSwitchedSlot = false;
    if (edges.quickSwap) {
      justSwitchedSlot = this.quickSwapWeapon();
    } else {
      let nextSlot = edges.slot;
      if (!nextSlot && edges.cycleSlotDir !== 0) {
        const available: WeaponSlotId[] = ([1, 2, 3] as const).filter(
          (s) => this.weapons[s] !== null,
        );
        available.push(4);
        if (available.length > 1) {
          const curIdx = Math.max(0, available.indexOf(this.activeSlot));
          const movedIdx =
            (curIdx + edges.cycleSlotDir + available.length) % available.length;
          nextSlot = available[movedIdx];
        }
      }
      if (nextSlot && (nextSlot === 4 || this.weapons[nextSlot])) {
        justSwitchedSlot = this.performSlotSwitch(nextSlot);
      }
    }

    if (edges.cycleScope) {
      this.isPlacingGloo = false;
      this.isHoldingGrenade = false;
      this.cycleActiveWeaponScope();
    }

    const activeWeaponState = this.getActiveWeaponState();
    const activeDef = activeWeaponState ? WEAPONS[activeWeaponState.weaponId] : null;
    const activeScope: ScopeType = activeWeaponState ? activeWeaponState.scope : 'none';
    const canUseAimScope =
      this.activeSlot !== 4 && Boolean(activeDef && activeDef.category !== 'HG');

    // Water / Swim / Surfboard detection (map-aware waterline)
    const isBermuda = this.isBermudaMapActive();
    const waterSurfaceY = isBermuda ? BERMUDA_GLB_WATER_Y : -0.35;
    const deepWaterThresh = isBermuda ? BERMUDA_GLB_WATER_Y + 0.25 : -0.78;
    const surfMountThresh = isBermuda ? BERMUDA_GLB_WATER_Y + 0.5 : -0.18;
    const surfDismountThresh = isBermuda ? BERMUDA_GLB_WATER_Y + 0.65 : -0.12;
    const swimSurfaceMax = isBermuda ? BERMUDA_GLB_WATER_Y + 0.35 : -0.72;
    const currentFloorRaw = this.resolveFloorHeight(this.pos.x, this.pos.z, this.pos.y);
    const inIsolatedGlbMap =
      this.isInWaitLobbyArea(this.pos.x, this.pos.z) ||
      this.isInGladiadoresArea(this.pos.x, this.pos.z);
    this.inWater = !inIsolatedGlbMap && currentFloorRaw <= deepWaterThresh;
    const canMountSurfboard =
      !inIsolatedGlbMap &&
      (this.isOnSurfboard ||
        (currentFloorRaw <= surfMountThresh && this.pos.y <= waterSurfaceY + 0.85));
    if (edges.surfboard && canMountSurfboard) {
      this.isOnSurfboard = !this.isOnSurfboard;
      this.hudDirty = true;
      soundEngine.playWeaponSwitch();
      if (this.isOnSurfboard && this.pos.y < waterSurfaceY + 0.04) {
        this.pos.y = waterSurfaceY + 0.04;
        this.isGrounded = true;
        this.vel.y = 0;
      }
    }
    if (
      this.isOnSurfboard &&
      currentFloorRaw >= surfDismountThresh &&
      this.pos.y <= currentFloorRaw + 0.28
    ) {
      this.isOnSurfboard = false;
      this.hudDirty = true;
    }
    this.isSwimming = this.inWater && !this.isOnSurfboard;

    if (this.isSwimming) {
      this.stance = 'stand';
      this.isAiming = false;
      this.isPlacingGloo = false;
      this.isHoldingGrenade = false;
      this.usingMedkit = false;
      this.isReloading = false;
      this.medkitTimer = 0;
      soundEngine.stopMedkitAudio();
    }

    // Stance transitions (including Window Vault on jump near house window sill!)
    this.stanceSnapTimer = Math.max(0, this.stanceSnapTimer - dt);
    const prevStance = this.stance;
    if (!this.isSwimming) {
      if (edges.crouch) {
        if (this.stance === 'crouch') {
          if (this.hasVerticalClearance(this.pos.x, this.pos.y, this.pos.z, 1.54, 0.3)) {
            this.stance = 'stand';
          }
        } else if (this.stance === 'prone') {
          if (this.hasVerticalClearance(this.pos.x, this.pos.y, this.pos.z, 0.94, 0.22)) {
            this.stance = 'crouch';
          }
        } else {
          this.stance = 'crouch';
        }
      }
      if (edges.prone) {
        if (this.stance === 'prone') {
          if (this.hasVerticalClearance(this.pos.x, this.pos.y, this.pos.z, 1.54, 0.3)) {
            this.stance = 'stand';
          } else if (this.hasVerticalClearance(this.pos.x, this.pos.y, this.pos.z, 0.94, 0.22)) {
            this.stance = 'crouch';
          }
        } else {
          this.stance = 'prone';
        }
      }
    }
    const onWaterSurface =
      this.inWater &&
      this.pos.y <= (this.isOnSurfboard ? waterSurfaceY + 0.22 : swimSurfaceMax) &&
      this.vel.y <= 0.6;
    if (edges.jump && (this.isGrounded || onWaterSurface)) {
      if (this.stance !== 'stand') {
        if (this.hasVerticalClearance(this.pos.x, this.pos.y, this.pos.z, 1.54, 0.3)) {
          this.stance = 'stand';
        } else if (
          this.stance === 'prone' &&
          this.hasVerticalClearance(this.pos.x, this.pos.y, this.pos.z, 0.94, 0.22)
        ) {
          this.stance = 'crouch';
        }
      } else if (this.canVaultWindow) {
        // Vault smoothly over house window sill
        this.vaultTimer = 0.48;
        this.vel.y = 6.2;
        const vFx = -Math.sin(this.yaw);
        const vFz = -Math.cos(this.yaw);
        this.vel.x = vFx * 6.0;
        this.vel.z = vFz * 6.0;
        this.isGrounded = false;
        soundEngine.playJump();
      } else {
        this.vel.y = this.isOnSurfboard ? 7.2 : 7.6;
        this.isGrounded = false;
        soundEngine.playJump();
      }
    }

    if (prevStance !== this.stance) {
      this.stanceSnapTimer = 0.16;
      if (this.stance === 'prone') {
        soundEngine.playProneDown();
      } else if (prevStance === 'prone') {
        soundEngine.playProneUp();
      } else {
        soundEngine.playUiClick(430);
      }
    }

    // Detect "Agacha e Levanta" (Bug do Capa) when standing up after crouching on a target
    if (prevStance === 'crouch' && this.stance === 'stand' && this.wasLockedWhileCrouched) {
      this.bugDoCapaTimer = 0.55;
      this.wasLockedWhileCrouched = false;
    }
    if (this.stance !== 'crouch') {
      this.wasLockedWhileCrouched = false;
    }

    // Aim & Fire edge transitions (Pistols, Fists & Swimming without surfboard stay off ADS)
    if ((!canUseAimScope || this.isSwimming) && this.input.getAimActive()) {
      this.input.setTouchAim(false);
    }
    this.isAiming = canUseAimScope && !this.isSwimming ? this.input.getAimActive() : false;
    if (this.isAiming && (this.isPlacingGloo || this.isHoldingGrenade)) {
      this.isPlacingGloo = false;
      this.isHoldingGrenade = false;
    }
    const justStartedAiming = this.isAiming && !this.wasAiming;
    const fireDown = this.isSwimming ? false : (this.input.getFireActive() || edges.fireTap);
    const justStartedFiring = (fireDown && !this.wasFireDown) || edges.fireTap;

    // Handle tactical Gloo Wall deployment or Grenade throw on primary click OR HUD confirm tap
    let gadgetHandledClick = false;
    if (justStartedFiring && this.isPlacingGloo) {
      this.deployGlooWall();
      gadgetHandledClick = true;
    } else if (justStartedFiring && this.isHoldingGrenade) {
      this.throwGrenade();
      gadgetHandledClick = true;
    }
    const weaponFireDown =
      fireDown && !gadgetHandledClick && !this.isPlacingGloo && !this.isHoldingGrenade;

    if (!weaponFireDown || performance.now() - this.slotLastShotTime[this.activeSlot] > 380) {
      this.consecutiveShots = 0;
    }

    if (!weaponFireDown) {
      this.lockedTargetId = null;
      this.aimBreakAccum = 0;
      if (this.stance !== 'crouch') {
        this.wasLockedWhileCrouched = false;
      }
    }

    const isFirstPersonAds =
      this.isAiming && !this.isPlacingGloo && !this.isHoldingGrenade && !this.isSwimming;
    const targetShoulderOffset = isFirstPersonAds ? 0 : 0.42;
    const targetCamDist = isFirstPersonAds ? 0.08 : 3.75;
    const rawCamHeight =
      this.stance === 'prone' ? 0.65 : this.stance === 'crouch' ? 1.15 : 1.55;
    const targetCamHeight = this.isSwimming
      ? Math.max(rawCamHeight, waterSurfaceY + 0.58 - this.pos.y)
      : rawCamHeight;

    // Classic Free Fire Aim-Assist config check before applying look input
    const assistAllowed =
      !this.isSwimming &&
      this.settings.aimAssistMode === 'default' &&
      Boolean(activeDef?.supportsAimAssist) &&
      !this.isPlacingGloo &&
      !this.isHoldingGrenade;

    // Progressive spray fatigue: after 4 consecutive full-auto shots, aim-assist weakens & spreads
    const sprayControl =
      this.consecutiveShots <= 4
        ? 1.0
        : Math.max(0.18, 1.0 - (this.consecutiveShots - 4) * 0.12);

    // Camera Look with per-scope sensitivity (zero weapon recoil)
    const sensScale = this.getScopeSensitivityScale(activeScope);
    const sens = 0.0028 * sensScale;
    const invert = this.settings.invertY ? -1 : 1;
    const rawYawInput = -edges.dx * sens;
    const rawPitchInput = -edges.dy * sens * invert;
    const absRawYawIn = Math.abs(rawYawInput);

    // When locked while firing in initial burst, resist gentle pull so dragging upward for CAPA
    // stays stable; weakens gradually during prolonged spray so it's never 100% permanent aimbot.
    const hasActiveFireLock =
      assistAllowed && weaponFireDown && !justStartedFiring && this.lockedTargetId !== null;
    let deferredPitchApplied = false;

    if (hasActiveFireLock) {
      // Only accumulate horizontal lock-break when pulling strongly sideways (not during diagonal upward Capa drags)
      const isUpwardDrag = rawPitchInput > 0.001 && absRawYawIn < rawPitchInput * 1.35;
      if (absRawYawIn > 0.028 && !isUpwardDrag) {
        this.aimBreakAccum += absRawYawIn;
      } else {
        this.aimBreakAccum = Math.max(0, this.aimBreakAccum - dt * 1.25);
      }

      const breakFlick = 0.30 * Math.max(0.48, sprayControl);
      const breakAccumLimit = 1.18 * Math.max(0.36, sprayControl);
      if (absRawYawIn > breakFlick || this.aimBreakAccum > breakAccumLimit) {
        // Strong pull or sustained spray fatigue broke the lock
        this.lockedTargetId = null;
        this.aimBreakAccum = 0;
        this.wasLockedWhileCrouched = false;
        this.yaw += rawYawInput;
        this.pitch = THREE.MathUtils.clamp(this.pitch + rawPitchInput, -1.05, 0.85);
      } else {
        const horizSlip = THREE.MathUtils.lerp(0.55, 0.04, sprayControl);
        this.yaw += rawYawInput * horizSlip;
        deferredPitchApplied = true;
      }
    } else {
      this.yaw += rawYawInput;
      this.pitch = THREE.MathUtils.clamp(this.pitch + rawPitchInput, -1.05, 0.85);
    }

    // Upward drag detection ("puxar capa" via mouse or dragging Fire Button upward)
    if (edges.dy * invert < -0.26) {
      this.pullingUpTimer = 0.28;
    }

    // Track if crouched with target inside crosshair area (even before firing, for Bug do Capa)
    if (this.stance === 'crouch' && activeDef && !weaponFireDown) {
      const crouchPreview = this.findAimAssistTarget(this.isAiming ? 0.31 : 0.28, activeDef.range);
      if (crouchPreview) {
        this.wasLockedWhileCrouched = true;
      }
    }

    // Classic Free Fire Aim-Assist ("Mira Gruda" + "Subir Capa" + Fadiga de Spray)
    this.aimAssistActive = false;
    let justAimSnapped = false;

    if (assistAllowed && activeDef) {
      if (weaponFireDown) {
        if (justStartedAiming) {
          // If player opens scope while holding fire, refresh snap cleanly onto closest target
          this.lockedTargetId = null;
          this.aimBreakAccum = 0;
        }
        let target: TargetDummy | null = null;
        if (this.lockedTargetId) {
          const existing = this.targetById.get(this.lockedTargetId);
          if (existing && existing.downTimer <= 0 && !existing.eliminated && existing.group.visible) {
            this.getBotBodyPoint(existing, 'chest', _v2);
            this.getBotBodyPoint(existing, 'head', _v3);
            _rayOrigin.set(this.pos.x, this.pos.y + targetCamHeight, this.pos.z);
            const dist = _v2.distanceTo(_rayOrigin);
            if (
              dist <= activeDef.range &&
              (this.hasLineOfSightToPoint(_rayOrigin, _v2) ||
                this.hasLineOfSightToPoint(_rayOrigin, _v3) ||
                this.hasLineOfSightToPoint(this.world.camera.position, _v3))
            ) {
              target = existing;
            } else {
              this.lockedTargetId = null;
              this.aimBreakAccum = 0;
            }
          } else {
            this.lockedTargetId = null;
            this.aimBreakAccum = 0;
          }
        }

        if (!target && this.consecutiveShots <= 4) {
          const coneRad =
            justStartedFiring || justStartedAiming
              ? this.isAiming
                ? 0.33
                : 0.30
              : this.isAiming
                ? 0.30
                : 0.27;
          target = this.findAimAssistTarget(coneRad, activeDef.range);
          if (target) {
            this.lockedTargetId = target.id;
            this.aimBreakAccum = 0;
          }
        }

        if (target) {
          this.getBotBodyPoint(target, 'chest', _v1);
          this.getBotBodyPoint(target, 'head', _v3);
          const pivotY = this.pos.y + targetCamHeight;
          const crouchOffset = !target.isDowned && this.stance === 'crouch' ? -0.04 : 0;

          const chestAim = this.computeExactAnglesToTarget(
            _v1.x,
            _v1.y + crouchOffset,
            _v1.z,
            targetCamHeight,
            targetShoulderOffset,
          );
          const headAim = this.computeExactAnglesToTarget(
            _v3.x,
            _v3.y,
            _v3.z,
            targetCamHeight,
            targetShoulderOffset,
          );
          const headTopAim = this.computeExactAnglesToTarget(
            _v3.x,
            _v3.y + (target.isDowned ? 0.12 : 0.16),
            _v3.z,
            targetCamHeight,
            targetShoulderOffset,
          );

          if (chestAim.horiz > 0.15) {
            let deltaYaw = chestAim.yaw - this.yaw;
            while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
            while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

            const currentHitWorldY = pivotY + Math.tan(this.pitch) * chestAim.horiz;
            const horizOffsetAtTarget = Math.abs(Math.sin(deltaYaw)) * chestAim.horiz;
            const alreadyOnHead =
              !target.isDowned &&
              horizOffsetAtTarget <= 0.22 &&
              currentHitWorldY >= _v3.y - 0.17 &&
              currentHitWorldY <= _v3.y + 0.17;

            this.aimAssistActive = sprayControl > 0.3;
            if (this.stance === 'crouch' && !target.isDowned) {
              this.wasLockedWhileCrouched = true;
              this.crouchLockedDist = chestAim.horiz;
            }

            if (justStartedFiring) {
              this.yaw += deltaYaw * 0.98;
              const startPitch = alreadyOnHead ? headAim.pitch : chestAim.pitch;
              this.pitch = THREE.MathUtils.lerp(this.pitch, startPitch, 0.96);
            } else {
              // Strong burst lock that weakens progressively if player sprays nonstop
              const yawLambda = (this.isAiming ? 68 : 60) * sprayControl;
              this.yaw += deltaYaw * (1 - Math.exp(-yawLambda * dt));

              if (target.isDowned) {
                // Keep shots squarely on low crawling enemy without pulling up into empty air!
                const dampRate = (this.isAiming ? 42 : 34) * sprayControl;
                this.pitch = THREE.MathUtils.damp(this.pitch, chestAim.pitch, dampRate, dt);
              } else if (this.bugDoCapaTimer > 0) {
                const distQuality =
                  chestAim.horiz < 6
                    ? chestAim.horiz / 6
                    : chestAim.horiz <= 46
                      ? 1.0
                      : Math.max(0.35, 1.0 - (chestAim.horiz - 46) / 55);
                const bugPitch = THREE.MathUtils.lerp(
                  chestAim.pitch,
                  headAim.pitch + 0.004,
                  distQuality,
                );
                this.pitch = THREE.MathUtils.damp(this.pitch, bugPitch, 38 * sprayControl, dt);
              } else {
                const chestPitch = chestAim.pitch;
                const headPitch = headAim.pitch;
                const headTopPitch = Math.max(headPitch + 0.01, headTopAim.pitch);
                const chestHeadSpan = Math.max(0.014, headPitch - chestPitch);

                if (rawPitchInput > 0.00015) {
                  // Responsive upward climb onto head (scaled cleanly for close & kneeling targets too)
                  const climbScale = THREE.MathUtils.clamp(chestHeadSpan / 0.046, 0.46, 0.94);
                  const scaledUp = Math.min(
                    rawPitchInput * climbScale,
                    Math.max(0.022, chestHeadSpan * 0.78),
                  );
                  this.pitch = THREE.MathUtils.clamp(this.pitch + scaledUp, -1.05, 0.85);

                  if (this.pitch > headTopPitch + 0.028) {
                    // Player intentionally pulled high into empty air above head -> release lock so shots go over!
                    this.lockedTargetId = null;
                    this.aimBreakAccum = 0;
                    this.aimAssistActive = false;
                  } else if (
                    sprayControl > 0.42 &&
                    this.pitch > headPitch + 0.006 &&
                    rawPitchInput <= 0.14
                  ) {
                    this.pitch = headPitch + 0.002;
                  }
                } else if (rawPitchInput < -0.002) {
                  this.pitch = THREE.MathUtils.clamp(
                    this.pitch + rawPitchInput * 0.45,
                    -1.05,
                    0.85,
                  );
                  if (this.pitch < chestPitch) {
                    this.pitch = chestPitch;
                  }
                } else {
                  const inHeadZone =
                    this.pitch >= headPitch - chestHeadSpan * 0.42 &&
                    this.pitch <= headTopPitch + 0.012;
                  const dampRate = (this.isAiming ? 38 : 32) * sprayControl;
                  if (this.pitch > headTopPitch + 0.022) {
                    // Never pull aim DOWN from empty air above head back onto head!
                    this.lockedTargetId = null;
                    this.aimBreakAccum = 0;
                    this.aimAssistActive = false;
                  } else if (inHeadZone) {
                    this.pitch = THREE.MathUtils.damp(this.pitch, headPitch, dampRate, dt);
                  } else if (this.pullingUpTimer > 0) {
                    // Preserve upward climb progress between touch/mouse poll ticks!
                    this.pitch = THREE.MathUtils.clamp(this.pitch, chestPitch, headPitch + 0.008);
                  } else {
                    this.pitch = THREE.MathUtils.damp(this.pitch, chestPitch, dampRate, dt);
                  }
                }
              }
            }
          }
        } else if (deferredPitchApplied) {
          this.pitch = THREE.MathUtils.clamp(this.pitch + rawPitchInput, -1.05, 0.85);
        }
      } else if (justStartedAiming) {
        // One-time Aim-FOV snap when opening scope using actual distance-scaled body capture
        const aimSnapTarget = this.findAimAssistTarget(0.31, activeDef.range);
        if (aimSnapTarget) {
          this.getBotBodyPoint(aimSnapTarget, 'chest', _v1);
          this.getBotBodyPoint(aimSnapTarget, 'head', _v3);
          const pivotY = this.pos.y + targetCamHeight;

          const chestAim = this.computeExactAnglesToTarget(
            _v1.x,
            _v1.y,
            _v1.z,
            targetCamHeight,
            targetShoulderOffset,
          );

          if (chestAim.horiz > 0.15) {
            let deltaYawToCenter = chestAim.yaw - this.yaw;
            while (deltaYawToCenter > Math.PI) deltaYawToCenter -= Math.PI * 2;
            while (deltaYawToCenter < -Math.PI) deltaYawToCenter += Math.PI * 2;

            const currentHitWorldY = pivotY + Math.tan(this.pitch) * chestAim.horiz;
            const horizOffsetAtTarget = Math.abs(Math.sin(deltaYawToCenter)) * chestAim.horiz;
            const alreadyOnHead =
              !aimSnapTarget.isDowned &&
              horizOffsetAtTarget <= 0.22 &&
              currentHitWorldY >= _v3.y - 0.17 &&
              currentHitWorldY <= _v3.y + 0.17;

            const snapPt = alreadyOnHead ? _v3 : _v1;
            const desired = this.computeExactAnglesToTarget(
              snapPt.x,
              snapPt.y,
              snapPt.z,
              targetCamHeight,
              targetShoulderOffset,
            );
            let deltaYaw = desired.yaw - this.yaw;
            while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
            while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

            // Snap cleanly once onto exact center of chest (no side offset, no tracking next frames)
            this.yaw += deltaYaw * 0.96;
            this.pitch = THREE.MathUtils.lerp(this.pitch, desired.pitch, 0.96);
            justAimSnapped = true;
          }
        }
      }
    }
    this.wasAiming = this.isAiming;

    // Interact priority: LaunchPad -> AirDrop -> Vehicle -> Vending (Lojinha) -> Loot -> Revive
    const nearbyLaunchPad = this.findNearbyLaunchPad();
    if (nearbyLaunchPad && (edges.interact || edges.jump) && !this.revivingBotId) {
      this.triggerLaunchPad(nearbyLaunchPad);
      return;
    }

    const nearbyAirDrop = this.findNearbyAirDrop();
    const nearbyVehicle = this.findNearbyVehicle();
    const nearbyVending = this.findNearbyVending();
    const nearbyLoot = this.findNearbyLoot();

    if (edges.interact && !this.revivingBotId) {
      if (nearbyAirDrop) {
        this.collectAirDrop(nearbyAirDrop);
      } else if (nearbyVehicle) {
        this.enterVehicle(nearbyVehicle);
        return;
      } else if (nearbyVending && !nearbyLoot) {
        this.onOpenShopRequest?.();
      } else if (nearbyLoot) {
        this.tryPickupNearbyLoot();
      } else {
        const downedAlly = this.findNearestDownedAlly();
        if (downedAlly) {
          this.revivingBotId = downedAlly.bot.id;
          this.reviveTimer = this.reviveDuration;
          this.usingMedkit = false;
          this.isReloading = false;
          this.isPlacingGloo = false;
          this.isHoldingGrenade = false;
          soundEngine.stopMedkitAudio();
          soundEngine.playUiClick(700);
        }
      }
    } else if (edges.revive && !this.revivingBotId) {
      const downedAlly = this.findNearestDownedAlly();
      if (downedAlly) {
        this.revivingBotId = downedAlly.bot.id;
        this.reviveTimer = this.reviveDuration;
        this.usingMedkit = false;
        this.isReloading = false;
        this.isPlacingGloo = false;
        this.isHoldingGrenade = false;
        soundEngine.stopMedkitAudio();
        soundEngine.playUiClick(700);
      }
    }

    this.updateAutoLoot(dt);

    // Revive channel update (3.0s; cancels if sprinting, firing, or walking > 4.2m away)
    if (this.revivingBotId) {
      const revTarget = this.targetById.get(this.revivingBotId);
      const revDist = revTarget
        ? Math.hypot(revTarget.group.position.x - this.pos.x, revTarget.group.position.z - this.pos.z)
        : 999;
      if (
        !revTarget ||
        !revTarget.isDowned ||
        revTarget.eliminated ||
        revDist > 4.2 ||
        fireDown ||
        this.input.isSprinting
      ) {
        this.revivingBotId = null;
        this.reviveTimer = 0;
      } else {
        this.reviveTimer -= dt;
        if (this.reviveTimer <= 0) {
          revTarget.isDowned = false;
          revTarget.hp = 115;
          revTarget.bleedHp = 100;
          revTarget.downTimer = 0;
          revTarget.knockedByPlayer = false;
          revTarget.aiState = revTarget.medkits > 0 ? 'heal' : 'roam';
          revTarget.healTimer = 4.0;
          revTarget.animator?.reset();
          if (revTarget.rig) {
            revTarget.rig.weaponMount.visible = true;
          }
          this.pushKillFeed(this.playerNick, `${revTarget.nick} SALVO`, 'REVIVE', false, true);
          soundEngine.completeMedkitAudio();
          this.revivingBotId = null;
          this.reviveTimer = 0;
        }
      }
    }

    // Medkit healing channel (4.0s synced with usando-kit-medico.mp3; cancels on sprint or gunfire)
    this.updateMedkitChannel(dt, true);

    // Reload (supports Extended Magazine capacity & faster reload)
    if (edges.reload && activeWeaponState && !this.isReloading) {
      const magCap = this.getEffectiveMagSize(activeWeaponState);
      if (activeWeaponState.ammoInMag < magCap && activeWeaponState.reserveAmmo > 0) {
        this.isReloading = true;
        this.reloadTimer = this.getEffectiveReloadSec(activeWeaponState);
        soundEngine.playReload();
      }
    }
    if (this.isReloading && activeWeaponState) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const magCap = this.getEffectiveMagSize(activeWeaponState);
        const needed = magCap - activeWeaponState.ammoInMag;
        const transfer = Math.min(needed, activeWeaponState.reserveAmmo);
        activeWeaponState.ammoInMag += transfer;
        activeWeaponState.reserveAmmo -= transfer;
        this.isReloading = false;
      }
    }

    // Movement Speed (weapon mobility + Stock attachment + Medkit slow; suppress sprint during firing pose)
    const hasMove = Math.abs(this.input.moveX) > 0.05 || Math.abs(this.input.moveZ) > 0.05;
    this.isSprinting =
      this.input.isSprinting &&
      hasMove &&
      this.input.moveZ >= -0.15 &&
      this.stance === 'stand' &&
      !this.isAiming &&
      !fireDown &&
      this.combatPoseTimer <= 0.12 &&
      !this.usingMedkit;

    const weaponSpeedMult =
      this.activeSlot === 4 ? 1.07 : activeDef ? activeDef.moveSpeedMult : 1.0;
    const stockAimBonus =
      this.isAiming && activeWeaponState?.attachments.stock === 'stock' ? 1.14 : 1.0;
    const baseSpeed = this.isOnSurfboard
      ? this.stance === 'crouch'
        ? 6.4
        : this.isSprinting
          ? 11.4
          : this.isAiming
            ? 5.8 * stockAimBonus
            : 8.4
      : this.isSwimming
        ? this.isSprinting
          ? 6.2
          : 4.2
        : this.stance === 'prone'
          ? 2.2
          : this.stance === 'crouch'
            ? 3.8
            : this.isSprinting
              ? 9.1
              : this.isAiming
                ? 3.9 * stockAimBonus
                : 5.85;
    const maxSpeed = baseSpeed * weaponSpeedMult * (this.usingMedkit ? 0.55 : 1.0);

    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    if (this.vaultTimer <= 0.15) {
      const targetVx = (forwardX * this.input.moveZ + rightX * this.input.moveX) * maxSpeed;
      const targetVz = (forwardZ * this.input.moveZ + rightZ * this.input.moveX) * maxSpeed;
      const accel = this.isOnSurfboard ? 10 : this.isSwimming ? 8 : this.isGrounded ? 18 : 6.5;
      this.vel.x = THREE.MathUtils.damp(this.vel.x, targetVx, accel, dt);
      this.vel.z = THREE.MathUtils.damp(this.vel.z, targetVz, accel, dt);
    }

    // Gravity (snappy on jump, preserve smooth vault arc)
    this.vel.y -= (this.vaultTimer > 0 ? 20.5 : 27.5) * dt;

    // Integrate XZ together + 2-pass stance-aware OBB/Mesh collision so crouch & prone fit real gaps
    const colProfile = this.getPlayerCollisionProfile();
    const prevGroundY = this.pos.y;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.resolveHorizontalCollisions(
      colProfile.radius,
      colProfile.minOffset,
      colProfile.maxOffset,
      colProfile.stepUp,
    );
    this.resolveHorizontalCollisions(
      colProfile.radius,
      colProfile.minOffset,
      colProfile.maxOffset,
      colProfile.stepUp,
    );
    this.pos.y += this.vel.y * dt;

    // Mode-aware boundary clamp (Waiting Lobby / Gladiadores Arena / Bermuda Island)
    const abGround = this.getActiveBounds();
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, abGround.minX, abGround.maxX);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, abGround.minZ, abGround.maxZ);

    // Terrain + Water Buoyancy + Walkable Platforms (or Distant GLB / Bermuda Floors)
    const wasGrounded = this.isGrounded;
    const floorQueryY = this.vel.y < -4 ? Math.max(this.pos.y, prevGroundY) : this.pos.y;
    const resolvedFloor = this.resolveFloorHeight(
      this.pos.x,
      this.pos.z,
      floorQueryY,
      colProfile.stepUp,
    );
    const deepWaterFloor = this.getDeepWaterMinY();
    const dryFloorMin = this.getDryMinFloorY();
    const floorY = inIsolatedGlbMap
      ? resolvedFloor
      : this.isOnSurfboard
        ? Math.max(resolvedFloor, waterSurfaceY + 0.04)
        : resolvedFloor <= deepWaterThresh
          ? Math.max(resolvedFloor, deepWaterFloor)
          : Math.max(dryFloorMin, resolvedFloor);

    if (this.pos.y <= floorY) {
      this.pos.y = floorY;
      this.vel.y = 0;
      this.isGrounded = true;
      if (!wasGrounded && !this.isSwimming && !this.isOnSurfboard) {
        this.animator.triggerLanding();
        soundEngine.playLanding();
      }
    } else if (
      wasGrounded &&
      this.vel.y <= 0 &&
      !edges.jump &&
      !this.isSwimming &&
      !this.isOnSurfboard &&
      this.pos.y - floorY <= 0.24
    ) {
      this.pos.y = floorY;
      this.vel.y = 0;
      this.isGrounded = true;
    } else if (this.pos.y > floorY + 0.15) {
      this.isGrounded = false;
    }

    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    const activelyMoving =
      hasMove &&
      horizSpeed > 0.45 &&
      this.isGrounded &&
      !this.isDead &&
      !this.isSwimming &&
      !this.isOnSurfboard &&
      this.vaultTimer <= 0.05;
    const moveSpeedRatio = activelyMoving
      ? THREE.MathUtils.clamp(horizSpeed / 9.1, 0.22, 1.05)
      : 0;
    soundEngine.updateRunAudio(activelyMoving, moveSpeedRatio, this.stance, dt);

    // Hide character body during ALL ADS scopes; hide held gun while unarmed/Medkit/Reviving/Swimming
    this.playerRig.root.visible = !isFirstPersonAds;
    this.playerRig.weaponMount.visible =
      this.activeSlot !== 4 && !this.usingMedkit && !this.revivingBotId && !this.isSwimming;

    if (this.usingMedkit) {
      const pulse = 1 + Math.sin(this.elapsed * 8.5) * 0.14;
      this.healRingMesh.position.set(this.pos.x, this.pos.y + 0.08, this.pos.z);
      this.healRingMesh.scale.set(pulse, pulse, 1);
      this.healRingMesh.rotation.z += dt * 2.2;
      this.healRingMesh.visible = true;
    } else {
      this.healRingMesh.visible = false;
    }

    // Decoupled character facing vs camera aim
    if (
      this.isAiming ||
      weaponFireDown ||
      this.combatPoseTimer > 0 ||
      this.isPlacingGloo ||
      this.isHoldingGrenade
    ) {
      this.combatFacingTimer = 0.6;
    } else {
      this.combatFacingTimer = Math.max(0, this.combatFacingTimer - dt);
    }

    let desiredCharYaw = this.characterYaw;
    if (this.combatFacingTimer > 0) {
      desiredCharYaw = this.yaw;
    } else if (horizSpeed > 0.35 && hasMove) {
      const moveVx = forwardX * this.input.moveZ + rightX * this.input.moveX;
      const moveVz = forwardZ * this.input.moveZ + rightZ * this.input.moveX;
      desiredCharYaw = Math.atan2(-moveVx, -moveVz);
    }

    let diffCharYaw = desiredCharYaw - this.characterYaw;
    while (diffCharYaw > Math.PI) diffCharYaw -= Math.PI * 2;
    while (diffCharYaw < -Math.PI) diffCharYaw += Math.PI * 2;
    const charTurnRate = this.combatFacingTimer > 0 ? 22 : 14;
    this.prevCharYawForTurn = this.characterYaw;
    this.characterYaw += diffCharYaw * (1 - Math.exp(-charTurnRate * dt));
    let turnDeltaRad = this.characterYaw - this.prevCharYawForTurn;
    while (turnDeltaRad > Math.PI) turnDeltaRad -= Math.PI * 2;
    while (turnDeltaRad < -Math.PI) turnDeltaRad += Math.PI * 2;

    // Character orientation & animation
    this.playerRig.root.position.copy(this.pos);
    this.playerRig.root.rotation.y = this.characterYaw + Math.PI;
    this.animator.update(this.playerRig, {
      dt,
      speed: horizSpeed,
      stance: this.stance,
      isGrounded: this.isGrounded,
      isSprinting: this.isSprinting,
      isAiming: this.isAiming,
      isFiring: weaponFireDown || this.combatPoseTimer > 0.12,
      isReloading: this.isReloading,
      isHealing: this.usingMedkit,
      isReviving: Boolean(this.revivingBotId),
      isDriving: false,
      isSwimming: this.isSwimming,
      isOnSurfboard: this.isOnSurfboard,
      isLobby: false,
      isSkydiving: false,
      isParachuting: false,
      isDead: false,
      hasWeapon: this.activeSlot !== 4 && !this.isSwimming,
      hasMoveInput: hasMove,
      weaponCategory:
        this.activeSlot !== 4 && !this.isSwimming && activeDef ? activeDef.category : null,
      pitchRad: this.pitch,
      turnDeltaRad,
    });

    // Update Gloo preview / Grenade curved trajectory line
    if (this.isPlacingGloo && this.glooCount > 0) {
      const gPos = this.computeGlooPlacement();
      this.glooPlaceDistance = gPos.dist;
      const targetGeo =
        this.glooSkin === 'ffwc' ? this.glooAssets.ffwcGeo : this.glooAssets.classicGeo;
      const targetMat =
        this.glooSkin === 'ffwc'
          ? this.glooAssets.ffwcPreviewMat
          : this.glooAssets.classicPreviewMat;
      if (this.glooPreviewMesh.geometry !== targetGeo) {
        this.glooPreviewMesh.geometry = targetGeo;
      }
      if (this.glooPreviewMesh.material !== targetMat) {
        this.glooPreviewMesh.material = targetMat;
      }
      this.glooPreviewMesh.position.set(gPos.x, gPos.y, gPos.z);
      this.glooPreviewMesh.rotation.y = this.yaw;
      this.glooPreviewMesh.visible = true;
    } else {
      this.glooPreviewMesh.visible = false;
    }

    if (this.isHoldingGrenade && this.grenadeCount > 0) {
      this.updateGrenadeTrajectoryPreview();
    } else {
      this.grenadeLine.visible = false;
      this.grenadeTargetMesh.visible = false;
    }

    // Quantized shadow camera tracking
    const snapX = Math.round(this.pos.x);
    const snapZ = Math.round(this.pos.z);
    if (snapX !== this.lastSunSnapX || snapZ !== this.lastSunSnapZ) {
      this.lastSunSnapX = snapX;
      this.lastSunSnapZ = snapZ;
      this.world.sunLight.position.set(snapX + 75, this.pos.y + 115, snapZ + 62);
      this.world.sunLight.target.position.set(snapX, this.pos.y, snapZ);
      this.world.sunLight.target.updateMatrixWorld();
    }

    // Update camera BEFORE firing so aim-assist snaps apply cleanly with zero rotational skew!
    const snapCameraNow =
      (justStartedFiring && this.aimAssistActive) || justAimSnapped || isFirstPersonAds;
    this.updateThirdPersonCamera(
      dt,
      targetCamDist,
      targetCamHeight,
      activeScope,
      isFirstPersonAds,
      snapCameraNow,
    );

    // Fire or Melee Punch AFTER camera & aim-assist sync (per-slot cooldown = zero Double-AWM / rush swap delay)
    const weaponFireAllowed = this.gameVariant !== 'gladiadores' || this.gladPhase === 'fight';
    if (weaponFireDown && weaponFireAllowed) {
      const nowMs = performance.now();
      if (this.activeSlot === 4) {
        if (nowMs - this.slotLastShotTime[4] >= 390) {
          this.slotLastShotTime[4] = nowMs;
          this.performMeleePunch();
        }
      } else if (activeWeaponState && !this.isReloading) {
        const def = WEAPONS[activeWeaponState.weaponId];
        const canFire = def.automatic ? true : (!this.wasFireDown || edges.fireTap || justSwitchedSlot);
        if (canFire && nowMs - this.slotLastShotTime[this.activeSlot] >= def.fireRateMs) {
          this.slotLastShotTime[this.activeSlot] = nowMs;
          this.fireActiveWeapon(activeWeaponState);
        }
      }
    }
    this.wasFireDown = this.input.getFireActive();

    this.crosshairCheckAccum += dt;
    if (this.crosshairCheckAccum >= 0.05) {
      this.crosshairCheckAccum = 0;
      this.aimLockedTarget = this.checkCrosshairTargetLock(activeDef?.range ?? 180);
    }
  }

  private getPlayerCollisionProfile(): {
    radius: number;
    minOffset: number;
    maxOffset: number;
    stepUp: number;
  } {
    if (this.stance === 'prone') {
      return { radius: 0.19, minOffset: 0.22, maxOffset: 0.44, stepUp: 0.26 };
    }
    if (this.stance === 'crouch') {
      return {
        radius: 0.26,
        minOffset: 0.32,
        maxOffset: 0.94,
        stepUp: this.isGrounded ? 0.38 : 0.46,
      };
    }
    return {
      radius: 0.35,
      minOffset: 0.36,
      maxOffset: 1.54,
      stepUp: this.vaultTimer > 0 ? 0.88 : this.isGrounded ? 0.48 : 0.62,
    };
  }

  private hasVerticalClearance(
    x: number,
    y: number,
    z: number,
    neededHeight: number,
    probeRadius = 0.22,
  ): boolean {
    const startY = y + 0.22;
    const castDist = Math.max(0.15, neededHeight - 0.2);
    _rayDir.set(0, 1, 0);

    const offsets: ReadonlyArray<[number, number]> = [
      [0, 0],
      [probeRadius, 0],
      [-probeRadius, 0],
      [0, probeRadius],
      [0, -probeRadius],
    ];
    for (let i = 0; i < offsets.length; i++) {
      _rayOrigin.set(x + offsets[i][0], startY, z + offsets[i][1]);
      if (this.raycastActiveGlbWall(_rayOrigin, _rayDir, castDist) !== null) {
        return false;
      }
    }

    const staticNear = this._colScratch;
    this.world.queryStaticCollidersNear(x, z, probeRadius + 1.5, staticNear);
    const allCols = this.world.colliders;
    const staticCount = this.world.staticColliderCount;
    for (let pass = 0; pass < 2; pass++) {
      const cols = pass === 0 ? staticNear : allCols;
      const startIdx = pass === 0 ? 0 : staticCount;
      for (let i = startIdx; i < cols.length; i++) {
        const c = cols[i];
        if (c.minY <= y + 0.28 || c.minY >= y + neededHeight) continue;
        const dx = x - c.cx;
        const dz = z - c.cz;
        const maxExtent = c.halfW + c.halfD + probeRadius;
        if (Math.abs(dx) > maxExtent || Math.abs(dz) > maxExtent) continue;
        const cos = Math.cos(c.rotY);
        const sin = Math.sin(c.rotY);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        if (
          Math.abs(lx) <= c.halfW + probeRadius &&
          Math.abs(lz) <= c.halfD + probeRadius
        ) {
          return false;
        }
      }
    }

    const plats = this._platScratch;
    this.world.queryStaticPlatformsNear(x, z, plats);
    for (let i = 0; i < plats.length; i++) {
      const p = plats[i];
      const platMinY = p.minY ?? p.topY - 0.25;
      if (platMinY <= y + 0.3 || platMinY >= y + neededHeight) continue;
      const dx = x - p.cx;
      const dz = z - p.cz;
      const cos = Math.cos(p.rotY);
      const sin = Math.sin(p.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (
        Math.abs(lx) <= p.halfW + probeRadius &&
        Math.abs(lz) <= p.halfD + probeRadius
      ) {
        return false;
      }
    }

    return true;
  }

  private resolveFloorHeight(
    x: number,
    z: number,
    currentY: number,
    stepUp = 0.85,
  ): number {
    let floorY = -Infinity;
    if (this.isInWaitLobbyArea(x, z)) {
      floorY = this.world.waitCollisionGrid.sampleFloorHeight(
        x,
        z,
        currentY + stepUp,
        WAIT_LOBBY_ORIGIN.y + 0.12,
      );
      floorY = Math.max(WAIT_LOBBY_ORIGIN.y - 0.1, floorY);
    } else if (this.isInGladiadoresArea(x, z)) {
      floorY = this.world.gladiadoresCollisionGrid.sampleFloorHeight(
        x,
        z,
        currentY + stepUp,
        GLADIADORES_FLOOR_Y,
      );
      floorY = Math.max(GLADIADORES_FLOOR_Y - 0.05, floorY);
    } else if (this.isBermudaMapActive()) {
      floorY = this.world.bermudaCollisionGrid.sampleFloorHeight(
        x,
        z,
        currentY + stepUp,
        BERMUDA_GLB_WATER_Y,
      );
      const plats = this._platScratch;
      this.world.queryStaticPlatformsNear(x, z, plats);
      for (let i = 0; i < plats.length; i++) {
        const p = plats[i];
        const dx = x - p.cx;
        const dz = z - p.cz;
        const cos = Math.cos(p.rotY);
        const sin = Math.sin(p.rotY);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        if (Math.abs(lx) <= p.halfW + 0.15 && Math.abs(lz) <= p.halfD + 0.15) {
          let platY = p.topY;
          if (p.slopeAxis && p.topYNeg !== undefined && p.topYPos !== undefined) {
            if (p.slopeAxis === 'z') {
              const t = THREE.MathUtils.clamp((lz + p.halfD) / Math.max(0.01, p.halfD * 2), 0, 1);
              platY = THREE.MathUtils.lerp(p.topYNeg, p.topYPos, t);
            } else {
              const t = THREE.MathUtils.clamp((lx + p.halfW) / Math.max(0.01, p.halfW * 2), 0, 1);
              platY = THREE.MathUtils.lerp(p.topYNeg, p.topYPos, t);
            }
          }
          if (currentY + stepUp < platY) continue;
          if (platY > floorY) floorY = platY;
        }
      }
    } else {
      floorY = this.world.groundHeightAt(x, z);
      const plats = this._platScratch;
      this.world.queryStaticPlatformsNear(x, z, plats);
      for (let i = 0; i < plats.length; i++) {
        const p = plats[i];
        const dx = x - p.cx;
        const dz = z - p.cz;
        const cos = Math.cos(p.rotY);
        const sin = Math.sin(p.rotY);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        if (Math.abs(lx) <= p.halfW + 0.15 && Math.abs(lz) <= p.halfD + 0.15) {
          let platY = p.topY;
          if (p.slopeAxis && p.topYNeg !== undefined && p.topYPos !== undefined) {
            if (p.slopeAxis === 'z') {
              const t = THREE.MathUtils.clamp((lz + p.halfD) / Math.max(0.01, p.halfD * 2), 0, 1);
              platY = THREE.MathUtils.lerp(p.topYNeg, p.topYPos, t);
            } else {
              const t = THREE.MathUtils.clamp((lx + p.halfW) / Math.max(0.01, p.halfW * 2), 0, 1);
              platY = THREE.MathUtils.lerp(p.topYNeg, p.topYPos, t);
            }
          }
          if (currentY + stepUp < platY) continue;
          if (platY > floorY) floorY = platY;
        }
      }
    }
    for (let i = 0; i < this.dynamicGlooPlatforms.length; i++) {
      const p = this.dynamicGlooPlatforms[i];
      const dx = x - p.cx;
      const dz = z - p.cz;
      const cos = Math.cos(p.rotY);
      const sin = Math.sin(p.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= p.halfW + 0.14 && Math.abs(lz) <= p.halfD + 0.14) {
        if (currentY + Math.min(0.34, stepUp) < p.topY) continue;
        if (p.topY > floorY) floorY = p.topY;
      }
    }
    return floorY;
  }

  private resolveHorizontalCollisions(
    radius: number,
    bodyMinOffset = 0.34,
    bodyMaxOffset = 1.54,
    stepUp = bodyMinOffset,
  ): void {
    this.resolveEntityHorizontalCollisions(
      this.pos,
      radius,
      this.activeVehicleId,
      this.vaultTimer > 0,
      bodyMinOffset,
      bodyMaxOffset,
      stepUp,
    );
  }

  private resolveEntityHorizontalCollisions(
    posObj: { x: number; y: number; z: number },
    radius: number,
    ignoreVehicleId: string | null = null,
    ignoreWindowSill = false,
    bodyMinOffset = 0.34,
    bodyMaxOffset = 1.54,
    stepUp = bodyMinOffset,
  ): number {
    const py = posObj.y;
    const staticNear = this._colScratch;
    this.world.queryStaticCollidersNear(posObj.x, posObj.z, radius + 2.2, staticNear);
    const allCols = this.world.colliders;
    const staticCount = this.world.staticColliderCount;
    const rSq = radius * radius;
    let totalPush = 0;

    for (let pass = 0; pass < 2; pass++) {
      const cols = pass === 0 ? staticNear : allCols;
      const startIdx = pass === 0 ? 0 : staticCount;
      for (let i = startIdx; i < cols.length; i++) {
        const c = cols[i];
        if (ignoreWindowSill && c.tag === 'house-window-sill') continue;
        if (ignoreVehicleId && c.tag === `vehicle-${ignoreVehicleId}`) continue;
        if (py + bodyMaxOffset < c.minY || py + bodyMinOffset > c.maxY) continue;

        const dx = posObj.x - c.cx;
        const dz = posObj.z - c.cz;
        const maxExtent = c.halfW + c.halfD + radius;
        if (Math.abs(dx) > maxExtent || Math.abs(dz) > maxExtent) continue;

        const cos = Math.cos(c.rotY);
        const sin = Math.sin(c.rotY);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;

        const clampedX = Math.max(-c.halfW, Math.min(c.halfW, lx));
        const clampedZ = Math.max(-c.halfD, Math.min(c.halfD, lz));
        const diffX = lx - clampedX;
        const diffZ = lz - clampedZ;
        const distSq = diffX * diffX + diffZ * diffZ;

        if (distSq >= rSq) continue;

        let pushLx = 0;
        let pushLz = 0;
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          pushLx = (diffX / dist) * push;
          pushLz = (diffZ / dist) * push;
          totalPush += push;
        } else {
          const penX = c.halfW - Math.abs(lx);
          const penZ = c.halfD - Math.abs(lz);
          if (penX < penZ) {
            const p = penX + radius;
            pushLx = (lx >= 0 ? 1 : -1) * p;
            totalPush += p;
          } else {
            const p = penZ + radius;
            pushLz = (lz >= 0 ? 1 : -1) * p;
            totalPush += p;
          }
        }

        posObj.x += pushLx * cos + pushLz * sin;
        posObj.z += -pushLx * sin + pushLz * cos;
      }
    }

    if (this.isInWaitLobbyArea(posObj.x, posObj.z)) {
      totalPush += this.world.waitCollisionGrid.resolveHorizontal(
        posObj,
        radius,
        bodyMinOffset,
        bodyMaxOffset,
        stepUp,
      );
    } else if (this.isInGladiadoresArea(posObj.x, posObj.z)) {
      totalPush += this.world.gladiadoresCollisionGrid.resolveHorizontal(
        posObj,
        radius,
        bodyMinOffset,
        bodyMaxOffset,
        stepUp,
      );
    } else if (this.isBermudaMapActive()) {
      totalPush += this.world.bermudaCollisionGrid.resolveHorizontal(
        posObj,
        radius,
        bodyMinOffset,
        bodyMaxOffset,
        stepUp,
      );
    }

    return totalPush;
  }

  private computeShotDamage(
    def: WeaponDef,
    dist: number,
    isHead: boolean,
    dummy: TargetDummy,
  ): { dmg: number; armorBlocked: number } {
    // 1. Distance damage falloff
    let distMult = 1.0;
    if (def.category === 'SR') {
      distMult = dist <= 240 ? 1.0 : THREE.MathUtils.lerp(1.0, 0.85, (dist - 240) / 100);
    } else if (def.category === 'AR') {
      distMult =
        dist <= 45
          ? 1.0
          : THREE.MathUtils.lerp(1.0, 0.6, THREE.MathUtils.clamp((dist - 45) / 135, 0, 1));
    } else if (def.category === 'SMG') {
      distMult =
        dist <= 22
          ? 1.0
          : THREE.MathUtils.lerp(1.0, 0.42, THREE.MathUtils.clamp((dist - 22) / 95, 0, 1));
    } else {
      distMult =
        dist <= 9
          ? 1.0
          : THREE.MathUtils.lerp(1.0, 0.25, THREE.MathUtils.clamp((dist - 9) / 36, 0, 1));
    }

    const headMult = def.category === 'SR' ? 3.2 : 3.8;
    const rawDmg = def.damage * distMult * (isHead ? headMult : 1.0);

    // 2. Vest & Helmet mitigation by level (0..3) and durability
    let armorBlocked = 0;
    let reduction = 0;

    if (isHead && dummy.helmetLevel > 0 && dummy.helmetHp > 0) {
      const table = [0, 0.25, 0.38, 0.5];
      reduction = table[dummy.helmetLevel] * (def.category === 'SR' ? 0.5 : 1.0);
      armorBlocked = dummy.helmetLevel;
      dummy.helmetHp = Math.max(0, dummy.helmetHp - Math.round(rawDmg * 0.42));
      if (dummy.helmetHp <= 0 && dummy.helmetMesh) {
        dummy.helmetMesh.visible = false;
      }
    } else if (!isHead && dummy.vestLevel > 0 && dummy.vestHp > 0) {
      const table = [0, 0.2, 0.35, 0.48];
      reduction = table[dummy.vestLevel] * (def.category === 'SR' ? 0.45 : 1.0);
      armorBlocked = dummy.vestLevel;
      dummy.vestHp = Math.max(0, dummy.vestHp - Math.round(rawDmg * 0.38));
      if (dummy.vestHp <= 0 && dummy.vestMesh) {
        dummy.vestMesh.visible = false;
      }
    }

    const dmg = Math.max(1, Math.round(rawDmg * (1 - reduction)));
    return { dmg, armorBlocked };
  }

  private pushDamagePopup(
    worldPoint: THREE.Vector3,
    amount: number,
    isHeadshot: boolean,
    armorBlocked: number,
  ): void {
    _v1.copy(worldPoint).project(this.world.camera);
    if (_v1.z > 1) return;
    const xOffsets = [-2.8, 3.0, -4.6, 4.8, -1.6, 2.0];
    const yOffsets = [-1.8, -4.4, -0.4, -6.0, -3.2, -1.0];
    const slot = this.damagePopupStagger++ % xOffsets.length;
    const xPct = THREE.MathUtils.clamp((_v1.x * 0.5 + 0.5) * 100 + xOffsets[slot], 8, 92);
    const yPct = THREE.MathUtils.clamp((-_v1.y * 0.5 + 0.5) * 100 + yOffsets[slot], 8, 88);
    if (this.damagePopups.length >= 10) {
      this.damagePopups.shift();
    }
    this.damagePopups.push({
      id: this.nextDamagePopupId++,
      amount,
      isHeadshot,
      armorBlocked,
      xPct,
      yPct,
      age: 0,
    });
  }

  private isPointInsideCollider(x: number, y: number, z: number): boolean {
    const staticNear = this._colScratch;
    this.world.queryStaticCollidersNear(x, z, 1.5, staticNear);
    const allCols = this.world.colliders;
    const staticCount = this.world.staticColliderCount;

    for (let pass = 0; pass < 2; pass++) {
      const cols = pass === 0 ? staticNear : allCols;
      const startIdx = pass === 0 ? 0 : staticCount;
      for (let i = startIdx; i < cols.length; i++) {
        const c = cols[i];
        if (y < c.minY || y > c.maxY) continue;
        const dx = x - c.cx;
        const dz = z - c.cz;
        const maxE = c.halfW + c.halfD;
        if (Math.abs(dx) > maxE || Math.abs(dz) > maxE) continue;
        const cos = Math.cos(c.rotY);
        const sin = Math.sin(c.rotY);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        if (Math.abs(lx) <= c.halfW && Math.abs(lz) <= c.halfD) {
          return true;
        }
      }
    }
    return false;
  }

  private computeGlooPlacement(): { x: number; y: number; z: number; dist: number } {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const eyeH = this.stance === 'prone' ? 0.65 : this.stance === 'crouch' ? 1.15 : 1.52;
    const eyeX = this.pos.x;
    const eyeY = this.pos.y + eyeH;
    const eyeZ = this.pos.z;

    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const dirX = fx * cp;
    const dirY = sp;
    const dirZ = fz * cp;

    // Camera-dependent Free Fire distance placement:
    // - Looking down places gloo close (~2.3m - 4m)
    // - Looking level / forward throws gloo ahead up to 15.5m to rush enemies, stopping before solid walls
    let maxRayDist = 15.5;
    _rayOrigin.set(eyeX, eyeY, eyeZ);
    _rayDir.set(dirX, dirY, dirZ).normalize();
    const glbGlooHit = this.raycastActiveGlbWall(_rayOrigin, _rayDir, maxRayDist);
    if (glbGlooHit !== null) {
      maxRayDist = Math.max(2.25, glbGlooHit - 0.65);
    }
    this.raycaster.set(_rayOrigin, _rayDir);
    this.raycaster.far = maxRayDist;
    const hits = this.raycaster.intersectObjects(this.solidObstaclesActive, false);
    if (hits.length > 0) {
      maxRayDist = Math.max(2.25, hits[0].distance - 0.65);
    }

    let targetHorizDist = maxRayDist;
    if (this.pitch < -0.03) {
      const steps = 26;
      const startDist = 2.25;
      const endDist = Math.max(startDist, maxRayDist);
      let prevT = startDist;
      for (let s = 0; s <= steps; s++) {
        const t = startDist + ((endDist - startDist) * s) / steps;
        const rx = eyeX + dirX * t;
        const ry = eyeY + dirY * t;
        const rz = eyeZ + dirZ * t;
        const groundY = this.resolveFloorHeight(
          rx,
          rz,
          Math.max(this.pos.y + 0.5, ry + 0.6),
        );
        if (ry <= groundY + 0.05) {
          const midT = (prevT + t) * 0.5;
          const mrx = eyeX + dirX * midT;
          const mry = eyeY + dirY * midT;
          const mrz = eyeZ + dirZ * midT;
          const mGroundY = this.resolveFloorHeight(
            mrx,
            mrz,
            Math.max(this.pos.y + 0.5, mry + 0.6),
          );
          const hitT = mry <= mGroundY + 0.05 ? midT : t;
          targetHorizDist = hitT * cp;
          break;
        }
        prevT = t;
      }
    }

    targetHorizDist = THREE.MathUtils.clamp(targetHorizDist, 2.25, 15.5);
    const abGloo = this.getActiveBounds();
    const x = THREE.MathUtils.clamp(
      this.pos.x + fx * targetHorizDist,
      abGloo.minX,
      abGloo.maxX,
    );
    const z = THREE.MathUtils.clamp(
      this.pos.z + fz * targetHorizDist,
      abGloo.minZ,
      abGloo.maxZ,
    );
    const y = Math.max(
      this.getDryMinFloorY(),
      this.resolveFloorHeight(x, z, this.pos.y + 1.8),
    );
    const dist = Math.hypot(x - this.pos.x, z - this.pos.z);
    return { x, y, z, dist };
  }

  private deployGlooWall(): void {
    if (this.glooCount <= 0) {
      this.isPlacingGloo = false;
      return;
    }
    this.glooCount -= 1;
    const p = this.computeGlooPlacement();
    this.spawnGlooWallAt(p.x, p.y, p.z, this.yaw, false, this.glooSkin);
    soundEngine.playGlooDeploy();
    this.isPlacingGloo = false;
  }

  private spawnGlooWallAt(
    x: number,
    y: number,
    z: number,
    wallYaw: number,
    skipNetEmit = false,
    skin: GlooSkinId = this.glooSkin,
  ): void {
    if (this.deployedGloos.length >= 28) {
      this.removeGlooWallAt(0);
    }
    const resolvedSkin: GlooSkinId = skin === 'ffwc' ? 'ffwc' : 'classic';
    const id = `gloo_${this.onlineAccountId || 'l'}_${this.nextGlooId++}`;
    this.syncedServerGlooIds.add(id);
    if (!skipNetEmit && this.onlineRoomId) {
      this.queueOrSendRoomAction({
        type: 'spawn_gloo',
        id,
        x,
        y,
        z,
        rotY: wallYaw,
        skin: resolvedSkin,
      });
    }
    const geo =
      resolvedSkin === 'ffwc' ? this.glooAssets.ffwcGeo : this.glooAssets.classicGeo;
    const mat =
      resolvedSkin === 'ffwc' ? this.glooAssets.ffwcMat : this.glooAssets.classicMat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = wallYaw;
    const shadowLv =
      this.settings.shadowQuality ?? defaultShadowForQuality(this.settings.quality);
    const enableShadow = !this.isSoftwareGl && shadowLv !== 'off';
    mesh.castShadow = enableShadow;
    mesh.receiveShadow = enableShadow;
    mesh.userData.glooId = id;
    this.world.scene.add(mesh);

    const { colliders, platforms } = buildGlooCollidersAndPlatforms(
      x,
      y,
      z,
      wallYaw,
      resolvedSkin,
    );
    for (let i = 0; i < colliders.length; i++) {
      this.world.colliders.push(colliders[i]);
    }
    for (let i = 0; i < platforms.length; i++) {
      this.dynamicGlooPlatforms.push(platforms[i]);
    }
    this.solidObstaclesNoTerrain.push(mesh);
    this.solidObstaclesActive.push(mesh);
    this.deployedGloos.push({
      id,
      skin: resolvedSkin,
      mesh,
      colliders,
      platforms,
      hp: 450,
      life: 55,
    });
  }

  private removeGlooWallAt(index: number): void {
    const g = this.deployedGloos[index];
    this.world.scene.remove(g.mesh);
    for (let i = 0; i < g.colliders.length; i++) {
      const cIdx = this.world.colliders.indexOf(g.colliders[i]);
      if (cIdx >= 0) this.world.colliders.splice(cIdx, 1);
    }
    for (let i = 0; i < g.platforms.length; i++) {
      const pIdx = this.dynamicGlooPlatforms.indexOf(g.platforms[i]);
      if (pIdx >= 0) this.dynamicGlooPlatforms.splice(pIdx, 1);
    }
    const oIdx = this.solidObstaclesNoTerrain.indexOf(g.mesh);
    if (oIdx >= 0) this.solidObstaclesNoTerrain.splice(oIdx, 1);
    const aIdx = this.solidObstaclesActive.indexOf(g.mesh);
    if (aIdx >= 0) this.solidObstaclesActive.splice(aIdx, 1);
    this.deployedGloos.splice(index, 1);
  }

  private clearDeployedGloos(): void {
    for (let i = this.deployedGloos.length - 1; i >= 0; i--) {
      this.removeGlooWallAt(i);
    }
  }

  private updateDeployedGloos(dt: number): void {
    for (let i = this.deployedGloos.length - 1; i >= 0; i--) {
      this.deployedGloos[i].life -= dt;
      if (this.deployedGloos[i].life <= 0 || this.deployedGloos[i].hp <= 0) {
        this.removeGlooWallAt(i);
      }
    }
  }

  private damageGlooById(glooId: string, dmg: number): void {
    for (let i = 0; i < this.deployedGloos.length; i++) {
      if (this.deployedGloos[i].id === glooId) {
        this.deployedGloos[i].hp -= dmg;
        if (this.deployedGloos[i].hp <= 0) {
          this.removeGlooWallAt(i);
        }
        return;
      }
    }
  }

  private computeGrenadeLaunchParams(): {
    ox: number;
    oy: number;
    oz: number;
    vx: number;
    vy: number;
    vz: number;
  } {
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const ox = this.pos.x + rightX * 0.28 - Math.sin(this.yaw) * 0.45;
    const oy = this.pos.y + (this.stance === 'crouch' ? 1.05 : 1.42);
    const oz = this.pos.z + rightZ * 0.28 - Math.cos(this.yaw) * 0.45;
    const throwPitch = THREE.MathUtils.clamp(this.pitch + 0.24, -0.75, 1.05);
    const speed = 22.5;
    const cp = Math.cos(throwPitch);
    const vx = -Math.sin(this.yaw) * cp * speed;
    const vy = Math.sin(throwPitch) * speed;
    const vz = -Math.cos(this.yaw) * cp * speed;
    return { ox, oy, oz, vx, vy, vz };
  }

  private updateGrenadeTrajectoryPreview(): void {
    const { ox, oy, oz, vx, vy, vz } = this.computeGrenadeLaunchParams();
    const gravity = -19.5;
    const steps = 25;
    const dtStep = 0.092;
    let impactX = ox;
    let impactY = oy;
    let impactZ = oz;
    let hitFound = false;

    this.grenadeLinePositions[0] = ox;
    this.grenadeLinePositions[1] = oy;
    this.grenadeLinePositions[2] = oz;

    let prevY = oy;
    for (let i = 1; i <= steps; i++) {
      if (!hitFound) {
        const t = i * dtStep;
        const px = ox + vx * t;
        const py = oy + vy * t + 0.5 * gravity * t * t;
        const pz = oz + vz * t;
        const floorY = this.resolveFloorHeight(px, pz, prevY + 0.4);
        if (py <= floorY || this.isPointInsideCollider(px, py, pz)) {
          impactX = px;
          impactY = Math.max(floorY + 0.05, py);
          impactZ = pz;
          hitFound = true;
        } else {
          impactX = px;
          impactY = py;
          impactZ = pz;
          prevY = py;
        }
      }
      this.grenadeLinePositions[i * 3] = impactX;
      this.grenadeLinePositions[i * 3 + 1] = impactY;
      this.grenadeLinePositions[i * 3 + 2] = impactZ;
    }

    (this.grenadeLineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.grenadeLine.visible = true;
    this.grenadeTargetMesh.position.set(impactX, impactY + 0.06, impactZ);
    this.grenadeTargetMesh.visible = true;
  }

  private throwGrenade(): void {
    if (this.grenadeCount <= 0) {
      this.isHoldingGrenade = false;
      return;
    }
    this.grenadeCount -= 1;
    this.isHoldingGrenade = false;
    this.grenadeLine.visible = false;
    this.grenadeTargetMesh.visible = false;

    const { ox, oy, oz, vx, vy, vz } = this.computeGrenadeLaunchParams();
    let slot = this.thrownGrenades.find((g) => !g.active);
    if (!slot) slot = this.thrownGrenades[0];
    slot.active = true;
    slot.mesh.position.set(ox, oy, oz);
    slot.vel.set(vx, vy, vz);
    slot.mesh.visible = true;
    soundEngine.playGrenadeThrow();
  }

  private updateThrownGrenades(dt: number): void {
    const gravity = -19.5;
    for (let i = 0; i < this.thrownGrenades.length; i++) {
      const g = this.thrownGrenades[i];
      if (!g.active) continue;
      const prevY = g.mesh.position.y;
      g.vel.y += gravity * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      g.mesh.rotation.x += dt * 10;
      g.mesh.rotation.z += dt * 8;

      const px = g.mesh.position.x;
      const py = g.mesh.position.y;
      const pz = g.mesh.position.z;
      const floorY = this.resolveFloorHeight(px, pz, prevY + 0.45);

      let touchedEnemy = false;
      for (let b = 0; b < this.world.targets.length; b++) {
        const bot = this.world.targets[b];
        if (bot.eliminated || bot.downTimer > 0) continue;
        const ddx = px - bot.group.position.x;
        const ddz = pz - bot.group.position.z;
        if (
          ddx * ddx + ddz * ddz < 0.85 * 0.85 &&
          py >= bot.group.position.y - 0.1 &&
          py <= bot.group.position.y + 1.95
        ) {
          touchedEnemy = true;
          break;
        }
      }

      if (py <= floorY || touchedEnemy || this.isPointInsideCollider(px, py, pz)) {
        g.active = false;
        g.mesh.visible = false;
        _v1.set(px, Math.max(floorY + 0.1, py), pz);
        this.explodeGrenade(_v1);
      }
    }
  }

  private explodeGrenade(center: THREE.Vector3): void {
    this.explodeAt(center, 9.5, 170, 'GRANADA');
  }

  private detonateExplosiveBarrel(instanceIdx: number): void {
    const eb = this.world.explosiveBarrels[instanceIdx];
    if (!eb || eb.exploded) return;
    this.world.hideExplosiveBarrel(instanceIdx);
    _v1.set(eb.x, eb.y + 0.3, eb.z);
    this.explodeAt(_v1, 11.5, 200, 'BARRIL');
  }

  private explodeAt(
    center: THREE.Vector3,
    blastRadius: number,
    maxDamage: number,
    weaponLabel: string,
  ): void {
    soundEngine.playExplosion();
    this.lastGunfightX = center.x;
    this.lastGunfightZ = center.z;
    this.lastGunfightTimer = 14;

    let vfx = this.explosionVfx.find((e) => !e.active);
    if (!vfx) vfx = this.explosionVfx[0];
    vfx.active = true;
    vfx.age = 0;
    vfx.mesh.position.copy(center);
    vfx.mesh.scale.setScalar(0.5);
    vfx.mat.opacity = 0.88;
    vfx.mat.color.setHex(0xff7b1c);
    vfx.mesh.visible = true;

    const camDist = center.distanceTo(this.pos);
    if (camDist < 36) {
      this.camShake = Math.max(this.camShake, THREE.MathUtils.clamp(0.75 - camDist / 48, 0.14, 0.75));
    }

    for (let i = this.deployedGloos.length - 1; i >= 0; i--) {
      const gloo = this.deployedGloos[i];
      const gd = center.distanceTo(gloo.mesh.position);
      if (gd < blastRadius) {
        gloo.hp -= Math.round(280 * (1 - gd / blastRadius));
        if (gloo.hp <= 0) {
          this.removeGlooWallAt(i);
        }
      }
    }

    const bots = this.world.targets;
    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (bot.isAlly || bot.eliminated || (bot.downTimer > 0 && !bot.isDowned)) continue;
      _v2.set(
        bot.group.position.x,
        bot.group.position.y + (bot.isDowned ? 0.45 : bot.chestOffsetY),
        bot.group.position.z,
      );
      const dist = center.distanceTo(_v2);
      if (dist > blastRadius) continue;

      const falloff = 1 - dist / blastRadius;
      const vestTable = [0, 0.18, 0.3, 0.42];
      const red = bot.vestLevel > 0 && bot.vestHp > 0 ? vestTable[bot.vestLevel] : 0;
      const dmg = Math.max(20, Math.round(maxDamage * falloff * (1 - red)));
      if (bot.vestLevel > 0 && bot.vestHp > 0) {
        bot.vestHp = Math.max(0, bot.vestHp - Math.round(dmg * 0.4));
        if (bot.vestHp <= 0 && bot.vestMesh) bot.vestMesh.visible = false;
      }

      this.applyBotHitDamage(bot, dmg, true, this.playerNick, weaponLabel, false, center.x, center.z);
      this.damageDealt += dmg;
      this.hitmarkerTimer = 0.22;
      this.pushDamagePopup(_v2, dmg, false, red > 0 ? bot.vestLevel : 0);
    }

    // Damage nearby vehicles in blast radius
    for (let vIdx = 0; vIdx < this.world.vehicles.length; vIdx++) {
      const veh = this.world.vehicles[vIdx];
      if (veh.destroyed) continue;
      const vd = Math.hypot(veh.x - center.x, veh.z - center.z);
      if (vd < blastRadius + 1.5) {
        const vFalloff = Math.max(0.2, 1 - vd / (blastRadius + 1.5));
        this.damageVehicle(veh, Math.round(maxDamage * 1.5 * vFalloff));
      }
    }

    // Lethal blast damage near feet (with Vest mitigation)
    if (!this.isDead && camDist < 6.8) {
      const selfDmg = Math.round(45 * (1 - camDist / 6.8));
      if (selfDmg > 0) {
        this.applyPlayerDamage(selfDmg, center.x, center.z, weaponLabel, weaponLabel, false);
      }
    }
  }

  private updateExplosionVfx(dt: number): void {
    for (let i = 0; i < this.explosionVfx.length; i++) {
      const e = this.explosionVfx[i];
      if (!e.active) continue;
      e.age += dt;
      const t = e.age / 0.42;
      if (t >= 1) {
        e.active = false;
        e.mesh.visible = false;
        continue;
      }
      e.mesh.scale.setScalar(0.6 + t * 8.2);
      e.mat.opacity = (1 - t) * 0.85;
      e.mat.color.setHex(t < 0.35 ? 0xfef08a : t < 0.7 ? 0xf97316 : 0xdc2626);
    }
  }

  private performMeleePunch(): void {
    this.animator.triggerPunch();
    soundEngine.playPunchSwing();
    this.combatFacingTimer = 0.42;
    this.combatPoseTimer = 0.38;

    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    let bestBot: TargetDummy | null = null;
    let bestDist = 2.85;

    const bots = this.world.targets;
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      if (b.isAlly || b.eliminated || !b.group.visible) continue;
      if (b.downTimer > 0 && !b.isDowned) continue;
      const dy = Math.abs(b.group.position.y - this.pos.y);
      if (dy > 2.2) continue;
      const dx = b.group.position.x - this.pos.x;
      const dz = b.group.position.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > bestDist) continue;
      if (dist > 0.25) {
        const dot = (dx * fwdX + dz * fwdZ) / dist;
        if (dot < 0.28) continue;
      }
      bestDist = dist;
      bestBot = b;
    }

    if (bestBot) {
      const isHead = !bestBot.isDowned && this.pitch > 0.12;
      const dmg = isHead ? 95 : 42;
      this.applyBotHitDamage(
        bestBot,
        dmg,
        true,
        this.playerNick,
        'SOCO',
        isHead,
        this.pos.x,
        this.pos.z,
      );
      this.damageDealt += dmg;
      this.hitmarkerTimer = 0.2;
      if (isHead) {
        this.headshotFlashTimer = 0.45;
      }
      soundEngine.playPunchHit(isHead);
      this.getBotBodyPoint(bestBot, isHead ? 'head' : 'chest', _v2);
      this.pushDamagePopup(_v2, dmg, isHead, 0);
      return;
    }

    // Punch nearby vehicle if no enemy hit
    for (let i = 0; i < this.world.vehicles.length; i++) {
      const veh = this.world.vehicles[i];
      if (veh.destroyed) continue;
      const dx = veh.x - this.pos.x;
      const dz = veh.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3.4) {
        this.damageVehicle(veh, 34);
        soundEngine.playPunchHit(false);
        break;
      }
    }
  }

  private fireActiveWeapon(slotState: WeaponSlotState): void {
    const def = WEAPONS[slotState.weaponId];
    if (slotState.ammoInMag <= 0) {
      soundEngine.playEmptyClick();
      if (slotState.reserveAmmo > 0 && !this.isReloading) {
        this.isReloading = true;
        this.reloadTimer = this.getEffectiveReloadSec(slotState);
        soundEngine.playReload();
      }
      return;
    }

    slotState.ammoInMag -= 1;
    this.consecutiveShots += 1;
    this.combatPoseTimer = 0.6;
    this.combatFacingTimer = 0.6;
    this.animator.triggerFire();
    const isSilenced = slotState.attachments.muzzle === 'silencer';
    soundEngine.playGunshot(def.id, isSilenced);
    this.lastGunfightX = this.pos.x;
    this.lastGunfightZ = this.pos.z;
    this.lastGunfightTimer = 14;

    const cam = this.world.camera;
    const camToPivotDist = cam.position.distanceTo(this.camLookCurrent);
    this.fillActiveTargetMeshes();

    let spreadMult = 1.0;
    if (slotState.attachments.muzzle === 'compensator') spreadMult *= 0.68;
    if (slotState.attachments.foregrip === 'grip') spreadMult *= 0.78;
    const effectiveRange = isSilenced ? def.range * 1.08 : def.range;

    // Progressive spray bloom after 3 consecutive shots
    const sprayBloom =
      this.consecutiveShots > 3
        ? Math.min(0.032, (this.consecutiveShots - 3) * 0.0044)
        : 0;

    let pelletTotalDmg = 0;
    let pelletAnyHead = false;
    let pelletArmor = 0;
    let pelletHitPoint: THREE.Vector3 | null = null;

    for (let p = 0; p < def.pellets; p++) {
      const spreadFactor = (this.isAiming ? (def.pellets > 1 ? 0.55 : 0) : 1.0) * spreadMult;
      const totalSpread = def.spread * spreadFactor + sprayBloom;
      _spreadNdc.set(
        (Math.random() - 0.5) * totalSpread,
        (Math.random() - 0.5) * totalSpread,
      );
      this.raycaster.setFromCamera(_spreadNdc, cam);

      // 1. Ultra-fast analytical terrain distance check
      const terrainDist = this.raycastTerrainDist(
        this.raycaster.ray.origin,
        this.raycaster.ray.direction,
        effectiveRange,
      );
      let endDist = Math.min(effectiveRange * 0.55, terrainDist);

      // 2. Test tiny enemy hitboxes first (skip targets standing behind the player between camera & pivot)
      this.raycaster.far = terrainDist;
      const rawTargetHits =
        this.scratchTargetMeshes.length > 0
          ? this.raycaster.intersectObjects(this.scratchTargetMeshes, false)
          : [];
      const minForwardDist = Math.max(0.2, camToPivotDist - 0.55);
      const tHit = rawTargetHits.find((h) => h.distance >= minForwardDist) ?? rawTargetHits[0];

      if (tHit) {
        const glbWallDist = this.raycastActiveGlbWall(
          this.raycaster.ray.origin,
          this.raycaster.ray.direction,
          Math.max(0.2, tHit.distance - 0.1),
        );
        this.raycaster.far = Math.max(0.2, tHit.distance - 0.1);
        const wallHits = this.raycaster.intersectObjects(
          this.solidObstaclesActive,
          false,
        );
        if (glbWallDist !== null && (wallHits.length === 0 || glbWallDist <= wallHits[0].distance)) {
          endDist = glbWallDist;
        } else if (wallHits.length > 0) {
          endDist = wallHits[0].distance;
          const hitGlooId = wallHits[0].object.userData.glooId as string | undefined;
          const hitVehId = wallHits[0].object.userData.vehicleId as string | undefined;
          if (hitGlooId) {
            this.damageGlooById(hitGlooId, def.damage);
          } else if (hitVehId) {
            const veh = this.world.vehicles.find((v) => v.id === hitVehId);
            if (veh) this.damageVehicle(veh, def.damage);
          } else if (
            wallHits[0].object.userData.isExplosiveBarrelInst &&
            wallHits[0].instanceId !== undefined
          ) {
            this.detonateExplosiveBarrel(wallHits[0].instanceId);
          }
        } else {
          endDist = tHit.distance;
          const tId = tHit.object.userData.targetId as string | undefined;
          const remoteAccId = tHit.object.userData.remoteAccountId as number | undefined;
          const isHead = Boolean(tHit.object.userData.isHeadshot);
          if (remoteAccId && this.onlineRoomId) {
            const ent = this.onlineRemotePlayers.get(remoteAccId);
            if (ent && ent.teamId !== this.onlineTeamId && !ent.lastState?.eliminated) {
              const distFalloff = Math.max(0.45, 1 - tHit.distance / (def.range * 1.4));
              const dmg = Math.max(1, Math.round(def.damage * distFalloff * (isHead ? 2.4 : 1.0)));
              this.damageDealt += dmg;
              this.hitmarkerTimer = 0.18;
              if (isHead) this.headshotFlashTimer = 0.45;
              pelletTotalDmg += dmg;
              pelletAnyHead = pelletAnyHead || isHead;
              pelletHitPoint = tHit.point;
              soundEngine.playHitmarker();
              this.queueOrSendRoomAction({
                type: 'damage_player',
                targetAccountId: remoteAccId,
                damage: dmg,
                isHeadshot: isHead,
                weaponId: def.id,
              });
            }
          } else if (tId) {
            const dummy = this.targetById.get(tId);
            if (dummy && !dummy.isAlly && !dummy.eliminated && (dummy.downTimer <= 0 || dummy.isDowned)) {
              const { dmg, armorBlocked } = this.computeShotDamage(
                def,
                tHit.distance,
                isHead,
                dummy,
              );
              this.damageDealt += dmg;
              this.hitmarkerTimer = 0.18;
              if (isHead) {
                this.headshotFlashTimer = 0.45;
              }
              pelletTotalDmg += dmg;
              pelletAnyHead = pelletAnyHead || isHead;
              pelletArmor = Math.max(pelletArmor, armorBlocked);
              pelletHitPoint = tHit.point;

              soundEngine.playHitmarker();
              this.applyBotHitDamage(
                dummy,
                dmg,
                true,
                this.playerNick,
                def.shortName,
                isHead,
                this.pos.x,
                this.pos.z,
              );
              if (this.onlineRoomId && this.onlineAccountId !== this.onlineHostAccountId) {
                this.queueOrSendRoomAction({
                  type: 'damage_bot',
                  botId: dummy.id,
                  damage: dmg,
                  isHeadshot: isHead,
                  weaponShort: def.shortName,
                  attackerX: this.pos.x,
                  attackerZ: this.pos.z,
                });
              }
            }
          }
        }
      } else if (p === 0) {
        const missFar = Math.min(effectiveRange * 0.85, terrainDist);
        const glbWallDist = this.raycastActiveGlbWall(
          this.raycaster.ray.origin,
          this.raycaster.ray.direction,
          missFar,
        );
        this.raycaster.far = missFar;
        const wallHits = this.raycaster.intersectObjects(
          this.solidObstaclesActive,
          false,
        );
        if (glbWallDist !== null && (wallHits.length === 0 || glbWallDist <= wallHits[0].distance)) {
          endDist = glbWallDist;
        } else if (wallHits.length > 0) {
          endDist = wallHits[0].distance;
          const hitGlooId = wallHits[0].object.userData.glooId as string | undefined;
          const hitVehId = wallHits[0].object.userData.vehicleId as string | undefined;
          if (hitGlooId) {
            this.damageGlooById(hitGlooId, def.damage);
          } else if (hitVehId) {
            const veh = this.world.vehicles.find((v) => v.id === hitVehId);
            if (veh) this.damageVehicle(veh, def.damage);
          } else if (
            wallHits[0].object.userData.isExplosiveBarrelInst &&
            wallHits[0].instanceId !== undefined
          ) {
            this.detonateExplosiveBarrel(wallHits[0].instanceId);
          }
        }
      }

      // Spawn pooled tracer from weapon muzzle toward ray point
      this.playerRig.muzzleFlash.getWorldPosition(_rayOrigin);
      _rayDir.copy(this.raycaster.ray.direction).normalize();
      _v2.copy(cam.position).addScaledVector(_rayDir, endDist);
      this.spawnTracer(_rayOrigin, _v2);
      if (this.onlineRoomId && p === 0) {
        this.queueOrSendRoomAction({
          type: 'shoot',
          weaponId: def.id,
          originX: _rayOrigin.x,
          originY: _rayOrigin.y,
          originZ: _rayOrigin.z,
          hitX: _v2.x,
          hitY: _v2.y,
          hitZ: _v2.z,
        });
      }
    }

    if (pelletTotalDmg > 0 && pelletHitPoint) {
      this.pushDamagePopup(pelletHitPoint, pelletTotalDmg, pelletAnyHead, pelletArmor);
    }
  }

  private hasStandingTeammate(teamId: number, excludeId: string): boolean {
    if (teamId === 0 && !this.isDead && !this.isPlayerDowned) return true;
    const bots = this.world.targets;
    for (let i = 0; i < bots.length; i++) {
      const m = bots[i];
      if (m.teamId === teamId && m.id !== excludeId && !m.eliminated && !m.isDowned && m.downTimer <= 0) {
        return true;
      }
    }
    return false;
  }

  private finalizeBotElimination(
    bot: TargetDummy,
    creditPlayer: boolean,
    killerName: string,
    weaponShort: string,
    isHeadshot: boolean,
  ): void {
    if (bot.eliminated || bot.downTimer > 0) return;
    bot.isDowned = false;
    bot.bleedHp = 0;
    bot.hp = 0;
    bot.downTimer = 1.6;
    const isPlaying = this.stateMachine.getState() === GameState.PLAYING;

    if (creditPlayer) {
      this.kills += 1;
      this.ffCoins += 100;
      soundEngine.playKillSound(isHeadshot);
      if (isPlaying && !this.isDead && Math.random() < 0.78) {
        const giveLike = Math.random() < 0.58;
        const likeDelay = 1.5 + Math.random() * 4.0;
        const leaveDelay = giveLike ? likeDelay + 2.2 + Math.random() * 8.5 : 4.2 + Math.random() * 9.5;
        this.botSpectators.push({
          id: `${bot.id}_${Math.round(this.elapsed * 10)}`,
          nick: bot.nick,
          likeAtElapsed: giveLike ? this.elapsed + likeDelay : null,
          leaveAtElapsed: this.elapsed + leaveDelay,
          liked: false,
        });
        this.hudDirty = true;
      }
    }

    this.pushKillFeed(killerName, bot.nick, weaponShort, isHeadshot, creditPlayer);

    if (isPlaying) {
      this.aliveCount = Math.max(1, this.aliveCount - 1);
      // Team wipe check: if last standing member died, eliminate downed squadmates (including downed player!)
      if (!this.hasStandingTeammate(bot.teamId, bot.id)) {
        const bots = this.world.targets;
        for (let i = 0; i < bots.length; i++) {
          const mate = bots[i];
          if (mate.teamId === bot.teamId && mate.id !== bot.id && mate.isDowned && !mate.eliminated) {
            mate.isDowned = false;
            mate.bleedHp = 0;
            mate.downTimer = 1.4;
            if (mate.knockedByPlayer || creditPlayer) {
              this.kills += 1;
            }
            this.aliveCount = Math.max(1, this.aliveCount - 1);
            this.pushKillFeed(killerName, mate.nick, weaponShort, false, mate.knockedByPlayer || creditPlayer);
          }
        }
        if (bot.teamId === 0 && !this.isDead && this.isPlayerDowned) {
          this.eliminatePlayerAndSquad(killerName, weaponShort, isHeadshot);
          return;
        }
      }

      if (this.gameVariant === 'gladiadores') {
        if (this.gladPhase === 'fight' && !this.gladPendingWinner) {
          const anyEnemyAlive = this.world.targets.some(
            (b) => !b.isAlly && !b.eliminated && b.downTimer <= 0,
          );
          const anyPlayerTeamAlive =
            !this.isDead ||
            this.world.targets.some(
              (b) => b.isAlly && !b.eliminated && b.downTimer <= 0,
            );
          if (!anyEnemyAlive) {
            this.gladPlayerScore += 1;
            this.gladPendingWinner = 'player';
            this.gladPhase = 'round_end';
            this.gladPhaseTimer = 2.2;
            this.gladBanner =
              this.gladPlayerScore >= this.gladiadoresTargetRounds
                ? 'VITÓRIA NA ARENA!'
                : 'VITÓRIA NA RODADA!';
            soundEngine.playUiConfirm();
            this.hudDirty = true;
          } else if (!anyPlayerTeamAlive) {
            this.gladEnemyScore += 1;
            this.gladPendingWinner = 'enemy';
            this.gladPhase = 'round_end';
            this.gladPhaseTimer = 2.2;
            this.gladBanner =
              this.gladEnemyScore >= this.gladiadoresTargetRounds
                ? 'DERROTA NA ARENA'
                : 'DERROTA NA RODADA';
            this.hudDirty = true;
          }
        }
        return;
      }

      const anyEnemyAlive = this.world.targets.some(
        (b) => !b.isAlly && !b.eliminated && b.downTimer <= 0,
      );
      if (!anyEnemyAlive && !this.isDead) {
        this.aliveCount = 1;
        this.stateMachine.forceState(GameState.WIN);
      }
    }
  }

  private applyBotHitDamage(
    bot: TargetDummy,
    dmg: number,
    attackerIsPlayer: boolean,
    attackerName: string,
    weaponShort: string,
    isHeadshot: boolean,
    attackerX?: number,
    attackerZ?: number,
  ): void {
    if (bot.eliminated || (bot.downTimer > 0 && !bot.isDowned)) return;
    bot.hitFlash = 0;

    if (bot.isDowned) {
      bot.bleedHp -= dmg * 1.15;
      if (bot.bleedHp <= 0) {
        const creditPlayer = attackerIsPlayer || bot.knockedByPlayer;
        this.finalizeBotElimination(
          bot,
          creditPlayer,
          attackerIsPlayer ? this.playerNick : attackerName,
          weaponShort,
          isHeadshot,
        );
      }
      return;
    }

    bot.hp -= dmg;
    const isPlaying = this.stateMachine.getState() === GameState.PLAYING;

    if (bot.hp <= 0) {
      if (
        isPlaying &&
        this.gameVariant !== 'gladiadores' &&
        this.matchMode !== 'solo' &&
        this.hasStandingTeammate(bot.teamId, bot.id)
      ) {
        bot.hp = 0;
        bot.isDowned = true;
        bot.bleedHp = 100;
        bot.revivingMateId = null;
        bot.reviveTimer = 0;
        bot.knockedByPlayer = attackerIsPlayer;
        bot.targetId = null;
        if (attackerIsPlayer) {
          soundEngine.playHitmarker();
        }
        this.pushKillFeed(`${attackerName} (DERRUBOU)`, bot.nick, weaponShort, isHeadshot, attackerIsPlayer);
      } else {
        this.finalizeBotElimination(bot, attackerIsPlayer, attackerName, weaponShort, isHeadshot);
      }
    }
  }

  private pushKillFeed(
    killerName: string,
    victimName: string,
    weaponShort: string,
    isHeadshot: boolean,
    isPlayerKiller: boolean,
  ): void {
    if (this.killFeed.length >= 5) {
      this.killFeed.shift();
    }
    this.killFeed.push({
      id: this.nextKillFeedId++,
      killerName,
      victimName,
      weaponShort,
      isHeadshot,
      isPlayerKiller,
      age: 0,
    });
  }

  private canBotSeePoint(
    bot: TargetDummy,
    tx: number,
    ty: number,
    tz: number,
    maxDist: number,
  ): boolean {
    const bx = bot.group.position.x;
    const by = bot.group.position.y + 1.35;
    const bz = bot.group.position.z;
    const dx = tx - bx;
    const dy = ty - by;
    const dz = tz - bz;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > maxDist * maxDist) return false;
    const dist = Math.sqrt(distSq);

    // If > 16m away, enemy must be inside bot's forward field-of-view cone (~155 deg) unless retreating to re-engage
    if (dist > 16 && !bot.isRetreating && (bot.retreatTimer ?? 0) <= 0) {
      const fx = Math.sin(bot.group.rotation.y);
      const fz = Math.cos(bot.group.rotation.y);
      const horiz = Math.hypot(dx, dz) || 1;
      const dot = (dx * fx + dz * fz) / horiz;
      if (dot < 0.22) return false;
    }

    _v1.set(bx, by, bz);
    _v2.set(tx, ty, tz);
    return this.hasLineOfSightToPoint(_v1, _v2);
  }

  private isPointBlockedForBot(x: number, y: number, z: number, radius = 0.46): boolean {
    const cols = this._botProbeCols;
    this.world.queryStaticCollidersNear(x, z, radius + 1.5, cols);
    const allCols = this.world.colliders;
    const staticCount = this.world.staticColliderCount;
    const rSq = radius * radius;
    for (let pass = 0; pass < 2; pass++) {
      const list = pass === 0 ? cols : allCols;
      const startIdx = pass === 0 ? 0 : staticCount;
      for (let i = startIdx; i < list.length; i++) {
        const c = list[i];
        if (y + 1.55 < c.minY || y + 0.30 > c.maxY) continue;
        const dx = x - c.cx;
        const dz = z - c.cz;
        const maxE = c.halfW + c.halfD + radius;
        if (Math.abs(dx) > maxE || Math.abs(dz) > maxE) continue;
        const cos = Math.cos(c.rotY);
        const sin = Math.sin(c.rotY);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        const cx = Math.max(-c.halfW, Math.min(c.halfW, lx));
        const cz = Math.max(-c.halfD, Math.min(c.halfD, lz));
        const ex = lx - cx;
        const ez = lz - cz;
        if (ex * ex + ez * ez < rSq) return true;
      }
    }
    return false;
  }

  private rayObbClearance(
    ox: number,
    oy: number,
    oz: number,
    dirX: number,
    dirZ: number,
    maxDist: number,
    radius: number,
    staticCols: WorldObbCollider[],
    allCols: WorldObbCollider[],
    staticCount: number,
    ignoreWindowSill = false,
  ): { dist: number; hitWindowSill: boolean } {
    let bestDist = maxDist;
    let hitWindowSill = false;

    for (let pass = 0; pass < 2; pass++) {
      const list = pass === 0 ? staticCols : allCols;
      const startIdx = pass === 0 ? 0 : staticCount;
      for (let i = startIdx; i < list.length; i++) {
        const c = list[i];
        if (ignoreWindowSill && c.tag === 'house-window-sill') continue;
        if (oy + 1.55 < c.minY || oy + 0.30 > c.maxY) continue;

        const dx = ox - c.cx;
        const dz = oz - c.cz;
        const maxE = c.halfW + c.halfD + maxDist + radius;
        if (Math.abs(dx) > maxE || Math.abs(dz) > maxE) continue;

        const cos = Math.cos(c.rotY);
        const sin = Math.sin(c.rotY);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        const ldx = dirX * cos - dirZ * sin;
        const ldz = dirX * sin + dirZ * cos;
        const hw = c.halfW + radius;
        const hd = c.halfD + radius;

        let tMin = 0;
        let tMax = bestDist;

        if (Math.abs(ldx) < 1e-6) {
          if (Math.abs(lx) > hw) continue;
        } else {
          let tx1 = (-hw - lx) / ldx;
          let tx2 = (hw - lx) / ldx;
          if (tx1 > tx2) {
            const tmp = tx1;
            tx1 = tx2;
            tx2 = tmp;
          }
          if (tx1 > tMin) tMin = tx1;
          if (tx2 < tMax) tMax = tx2;
          if (tMin > tMax) continue;
        }

        if (Math.abs(ldz) < 1e-6) {
          if (Math.abs(lz) > hd) continue;
        } else {
          let tz1 = (-hd - lz) / ldz;
          let tz2 = (hd - lz) / ldz;
          if (tz1 > tz2) {
            const tmp = tz1;
            tz1 = tz2;
            tz2 = tmp;
          }
          if (tz1 > tMin) tMin = tz1;
          if (tz2 < tMax) tMax = tz2;
          if (tMin > tMax) continue;
        }

        if (tMin < bestDist) {
          bestDist = tMin;
          hitWindowSill = c.tag === 'house-window-sill';
        }
      }
    }
    return { dist: bestDist, hitWindowSill };
  }

  private resolveSmartBuildingTarget(
    bot: TargetDummy,
    bx: number,
    by: number,
    bz: number,
    gx: number,
    gz: number,
    gy: number,
  ): void {
    this._botNavOut.x = gx;
    this._botNavOut.z = gz;

    const curB: BuildingNavZone | null = this.world.findBuildingNavZoneAt(bx, bz);
    if (bot.escapeTimer > 0) {
      if (!curB) {
        bot.escapeTimer = 0;
      } else if (
        curB.secondFloorY !== undefined &&
        by >= curB.baseY + 2.0 &&
        curB.stairTop &&
        curB.stairBottom
      ) {
        const dTop = Math.hypot(curB.stairTop.x - bx, curB.stairTop.z - bz);
        if (dTop > 1.45) {
          this._botNavOut.x = curB.stairTop.x;
          this._botNavOut.z = curB.stairTop.z;
        } else {
          this._botNavOut.x = curB.stairBottom.x;
          this._botNavOut.z = curB.stairBottom.z;
        }
        return;
      } else if (curB.doors.length > 0) {
        let escDoor = curB.doors[0];
        let escBest = Infinity;
        for (let k = 0; k < curB.doors.length; k++) {
          const d = curB.doors[k];
          const score =
            Math.hypot(d.outX - bot.escapeDoorX, d.outZ - bot.escapeDoorZ) * 2.0 +
            Math.hypot(d.inX - bx, d.inZ - bz);
          if (score < escBest) {
            escBest = score;
            escDoor = d;
          }
        }
        const dIn = Math.hypot(escDoor.inX - bx, escDoor.inZ - bz);
        const dOut = Math.hypot(escDoor.outX - bx, escDoor.outZ - bz);
        this.world.queryStaticCollidersNear((bx + escDoor.outX) * 0.5, (bz + escDoor.outZ) * 0.5, 6.0, this._botSteerCols);
        const clearToOut =
          dOut > 0.2
            ? this.rayObbClearance(
                bx,
                by,
                bz,
                (escDoor.outX - bx) / dOut,
                (escDoor.outZ - bz) / dOut,
                dOut,
                0.32,
                this._botSteerCols,
                this.world.colliders,
                this.world.staticColliderCount,
                false,
              )
            : { dist: 0, hitWindowSill: false };
        if (clearToOut.dist >= dOut - 0.35 || dIn <= 1.95 || dOut <= dIn + 0.15) {
          this._botNavOut.x = escDoor.outX;
          this._botNavOut.z = escDoor.outZ;
        } else {
          if (curB.hub) {
            const dHub = Math.hypot(curB.hub.x - bx, curB.hub.z - bz);
            if (dHub > 1.5) {
              const hitIn = this.rayObbClearance(
                bx,
                by,
                bz,
                (escDoor.inX - bx) / dIn,
                (escDoor.inZ - bz) / dIn,
                dIn,
                0.34,
                this._botSteerCols,
                this.world.colliders,
                this.world.staticColliderCount,
                false,
              );
              if (hitIn.dist < dIn - 0.55) {
                this._botNavOut.x = curB.hub.x;
                this._botNavOut.z = curB.hub.z;
                return;
              }
            }
          }
          this._botNavOut.x = escDoor.inX;
          this._botNavOut.z = escDoor.inZ;
        }
        return;
      } else {
        this._botNavOut.x = bot.escapeDoorX;
        this._botNavOut.z = bot.escapeDoorZ;
        return;
      }
    }

    const goalB: BuildingNavZone | null = this.world.findBuildingNavZoneAt(gx, gz);
    const goalOn2F = goalB?.secondFloorY !== undefined && gy >= goalB.baseY + 2.0;

    // Case A: Bot is currently INSIDE a building (curB)
    if (curB) {
      const botOn2F = curB.secondFloorY !== undefined && by >= curB.baseY + 2.0;

      // On 2nd floor wanting to go outside or back down to 1st floor
      if (botOn2F && (goalB !== curB || !goalOn2F) && curB.stairTop && curB.stairBottom) {
        const dTop = Math.hypot(curB.stairTop.x - bx, curB.stairTop.z - bz);
        if (dTop > 1.4) {
          this._botNavOut.x = curB.stairTop.x;
          this._botNavOut.z = curB.stairTop.z;
        } else {
          this._botNavOut.x = curB.stairBottom.x;
          this._botNavOut.z = curB.stairBottom.z;
        }
        return;
      }

      // On 1st floor inside curB, wanting to go to 2nd floor of curB
      if (!botOn2F && goalB === curB && goalOn2F && curB.stairBottom && curB.stairTop) {
        const dBot = Math.hypot(curB.stairBottom.x - bx, curB.stairBottom.z - bz);
        if (dBot > 1.35) {
          if (curB.hub) {
            const dHub = Math.hypot(curB.hub.x - bx, curB.hub.z - bz);
            if (dHub > 1.4 && dHub + Math.hypot(curB.stairBottom.x - curB.hub.x, curB.stairBottom.z - curB.hub.z) < dBot + 3.2) {
              this.world.queryStaticCollidersNear((bx + curB.stairBottom.x) * 0.5, (bz + curB.stairBottom.z) * 0.5, 5.5, this._botSteerCols);
              const sdx = curB.stairBottom.x - bx;
              const sdz = curB.stairBottom.z - bz;
              const hit = this.rayObbClearance(bx, by, bz, sdx / dBot, sdz / dBot, dBot, 0.34, this._botSteerCols, this.world.colliders, this.world.staticColliderCount);
              if (hit.dist < dBot - 0.6) {
                this._botNavOut.x = curB.hub.x;
                this._botNavOut.z = curB.hub.z;
                return;
              }
            }
          }
          this._botNavOut.x = curB.stairBottom.x;
          this._botNavOut.z = curB.stairBottom.z;
        } else {
          this._botNavOut.x = curB.stairTop.x;
          this._botNavOut.z = curB.stairTop.z;
        }
        return;
      }

      // On 1st floor inside curB, wanting to EXIT outside curB
      if (!botOn2F && goalB !== curB && curB.doors.length > 0) {
        let bestDoor = curB.doors[0];
        let bestCost = Infinity;
        for (let k = 0; k < curB.doors.length; k++) {
          const d = curB.doors[k];
          const c =
            Math.hypot(d.inX - bx, d.inZ - bz) + Math.hypot(gx - d.outX, gz - d.outZ);
          if (c < bestCost) {
            bestCost = c;
            bestDoor = d;
          }
        }
        const dIn = Math.hypot(bestDoor.inX - bx, bestDoor.inZ - bz);
        const dOut = Math.hypot(bestDoor.outX - bx, bestDoor.outZ - bz);
        this.world.queryStaticCollidersNear((bx + bestDoor.outX) * 0.5, (bz + bestDoor.outZ) * 0.5, 6.0, this._botSteerCols);
        const clearToOut =
          dOut > 0.2
            ? this.rayObbClearance(
                bx,
                by,
                bz,
                (bestDoor.outX - bx) / dOut,
                (bestDoor.outZ - bz) / dOut,
                dOut,
                0.32,
                this._botSteerCols,
                this.world.colliders,
                this.world.staticColliderCount,
                false,
              )
            : { dist: 0, hitWindowSill: false };

        if (clearToOut.dist >= dOut - 0.35 || dIn <= 1.95 || dOut <= dIn + 0.15) {
          this._botNavOut.x = bestDoor.outX;
          this._botNavOut.z = bestDoor.outZ;
        } else {
          if (curB.hub) {
            const dHub = Math.hypot(curB.hub.x - bx, curB.hub.z - bz);
            if (dHub > 1.45) {
              const hit = this.rayObbClearance(
                bx,
                by,
                bz,
                (bestDoor.inX - bx) / dIn,
                (bestDoor.inZ - bz) / dIn,
                dIn,
                0.34,
                this._botSteerCols,
                this.world.colliders,
                this.world.staticColliderCount,
              );
              if (hit.dist < dIn - 0.6) {
                this._botNavOut.x = curB.hub.x;
                this._botNavOut.z = curB.hub.z;
                return;
              }
            }
          }
          this._botNavOut.x = bestDoor.inX;
          this._botNavOut.z = bestDoor.inZ;
        }
        return;
      }

      // Both bot & goal inside same Casa L on 1F -> check hub if inner L-wall blocks direct path
      if (goalB === curB && curB.hub) {
        const dDirect = Math.hypot(gx - bx, gz - bz);
        if (dDirect > 2.2) {
          const dHub = Math.hypot(curB.hub.x - bx, curB.hub.z - bz);
          if (dHub > 1.4) {
            this.world.queryStaticCollidersNear((bx + gx) * 0.5, (bz + gz) * 0.5, 5.5, this._botSteerCols);
            const hit = this.rayObbClearance(
              bx,
              by,
              bz,
              (gx - bx) / dDirect,
              (gz - bz) / dDirect,
              dDirect,
              0.34,
              this._botSteerCols,
              this.world.colliders,
              this.world.staticColliderCount,
            );
            if (hit.dist < dDirect - 0.7) {
              this._botNavOut.x = curB.hub.x;
              this._botNavOut.z = curB.hub.z;
            }
          }
        }
      }
      return;
    }

    // Case B: Bot is OUTSIDE, goal is INSIDE goalB -> route to best exterior doorway!
    if (goalB && goalB.doors.length > 0) {
      let bestDoor = goalB.doors[0];
      let bestCost = Infinity;
      for (let k = 0; k < goalB.doors.length; k++) {
        const d = goalB.doors[k];
        const c =
          Math.hypot(d.outX - bx, d.outZ - bz) + Math.hypot(gx - d.inX, gz - d.inZ);
        if (c < bestCost) {
          bestCost = c;
          bestDoor = d;
        }
      }
      const dOut = Math.hypot(bestDoor.outX - bx, bestDoor.outZ - bz);
      if (dOut > 1.55) {
        this._botNavOut.x = bestDoor.outX;
        this._botNavOut.z = bestDoor.outZ;
      } else {
        this._botNavOut.x = bestDoor.inX;
        this._botNavOut.z = bestDoor.inZ;
      }
    }
  }

  private steerBotDirection(
    bot: TargetDummy,
    bx: number,
    by: number,
    bz: number,
    wantDirX: number,
    wantDirZ: number,
    avoidWater: boolean,
  ): boolean {
    const lookDist = 3.0;
    const probeR = 0.4;
    const ignoreSill = bot.vaultTimer > 0;
    this.world.queryStaticCollidersNear(
      bx + wantDirX * 1.4,
      bz + wantDirZ * 1.4,
      5.2,
      this._botSteerCols,
    );
    const allCols = this.world.colliders;
    const staticCount = this.world.staticColliderCount;

    const fwd = this.rayObbClearance(
      bx,
      by,
      bz,
      wantDirX,
      wantDirZ,
      lookDist,
      probeR,
      this._botSteerCols,
      allCols,
      staticCount,
      ignoreSill,
    );
    const fwdWaterBad =
      avoidWater && this.sampleEntitySurface(bx + wantDirX * 2.1, bz + wantDirZ * 2.1).inWater;

    if (fwd.dist >= 2.95 && !fwdWaterBad) {
      this._botNavOut.dirX = wantDirX;
      this._botNavOut.dirZ = wantDirZ;
      return false;
    }

    const wantYaw = Math.atan2(wantDirX, wantDirZ);
    const prefSign = bot.steerSign;
    const angles = [0.42, 0.84, 1.28, 1.72, 2.25, 2.85];

    let bestScore = fwd.dist - (fwdWaterBad ? 2.6 : 0) + 0.15;
    let bestDirX = wantDirX;
    let bestDirZ = wantDirZ;
    let bestSign = 0;

    for (let a = 0; a < angles.length; a++) {
      const mag = angles[a];
      for (let s = 0; s < 2; s++) {
        const sign = s === 0 ? prefSign : -prefSign;
        const ang = wantYaw + sign * mag;
        const cx = Math.sin(ang);
        const cz = Math.cos(ang);
        const res = this.rayObbClearance(
          bx,
          by,
          bz,
          cx,
          cz,
          lookDist,
          probeR,
          this._botSteerCols,
          allCols,
          staticCount,
          ignoreSill,
        );
        const wBad =
          avoidWater && this.sampleEntitySurface(bx + cx * 2.1, bz + cz * 2.1).inWater;
        const align = Math.cos(mag);
        const sideBonus = bot.steerLockTimer > 0 && sign === prefSign ? 0.65 : 0;
        const clearBonus = res.dist >= 2.6 ? 1.15 : res.dist < 0.85 ? -1.4 : 0;
        const score =
          res.dist +
          align * 1.15 +
          sideBonus +
          clearBonus -
          (wBad ? 2.6 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestDirX = cx;
          bestDirZ = cz;
          bestSign = sign;
        }
      }
    }

    if (bestSign !== 0) {
      bot.steerSign = bestSign > 0 ? 1 : -1;
      bot.steerLockTimer = 0.72;
    }
    this._botNavOut.dirX = bestDirX;
    this._botNavOut.dirZ = bestDirZ;
    return fwd.hitWindowSill && fwd.dist < 1.35;
  }

  private findClearestEscapeVector(
    bx: number,
    by: number,
    bz: number,
  ): { x: number; z: number } {
    this.world.queryStaticCollidersNear(bx, bz, 5.5, this._botSteerCols);
    const allCols = this.world.colliders;
    const staticCount = this.world.staticColliderCount;
    let bestClear = -1;
    let bestX = 0;
    let bestZ = 1;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      const dx = Math.sin(ang);
      const dz = Math.cos(ang);
      const hit = this.rayObbClearance(
        bx,
        by,
        bz,
        dx,
        dz,
        4.2,
        0.44,
        this._botSteerCols,
        allCols,
        staticCount,
        false,
      );
      let score = hit.dist;
      if (this.sampleEntitySurface(bx + dx * 2.5, bz + dz * 2.5).inWater) score -= 2.2;
      if (score > bestClear) {
        bestClear = score;
        bestX = dx;
        bestZ = dz;
      }
    }
    return { x: bestX, z: bestZ };
  }

  private updateBots(dt: number, state: GameState): void {
    // Non-host online clients follow host's authoritative bot snapshot rather than running diverging AI
    if (this.onlineRoomId && this.onlineAccountId !== this.onlineHostAccountId) {
      const bots = this.world.targets;
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i];
        b.drawTimer = Math.max(0, (b.drawTimer ?? 0) - dt);
        const moveDist =
          b.lastSyncX !== undefined && b.lastSyncZ !== undefined
            ? Math.hypot(b.group.position.x - b.lastSyncX, b.group.position.z - b.lastSyncZ)
            : 0;
        b.lastSyncX = b.group.position.x;
        b.lastSyncZ = b.group.position.z;
        b.netAnimSpeed = THREE.MathUtils.damp(
          b.netAnimSpeed ?? 0,
          Math.min(10, moveDist / Math.max(0.016, dt)),
          12,
          dt,
        );
        if (!b.group.visible || b.eliminated || !b.rig || !b.animator) continue;
        const spd = b.netAnimSpeed;
        const inWater = b.group.position.y < -0.15;
        const wCat = WEAPONS[b.weaponId]?.category ?? null;
        b.rig.weaponMount.visible = !b.isDowned && !inWater && b.airState === 'ground';
        b.animator.update(b.rig, {
          dt,
          speed: spd,
          stance: 'stand',
          isGrounded: b.airState === 'ground',
          isSprinting: spd > 3.2 && !b.isDowned && !inWater,
          isAiming: false,
          isFiring: false,
          isLobby: false,
          isSkydiving: b.airState === 'skydiving',
          isParachuting: b.airState === 'parachuting',
          isDead: false,
          isDowned: b.isDowned,
          isSwimming: inWater,
          isOnSurfboard: false,
          hasWeapon: !b.isDowned && !inWater,
          hasMoveInput: spd > 0.35,
          weaponCategory: wCat,
          pitchRad: 0,
        });
      }
      return;
    }

    const bots = this.world.targets;
    const isPlaying = state === GameState.PLAYING;
    const isWaiting = state === GameState.WAITING;
    if (isWaiting) {
      this.updateWaitingLobbySpawns(dt);
    }
    const combatEnabled = isPlaying;
    const dropEnabled =
      state === GameState.AIRPLANE ||
      state === GameState.DROPPING ||
      state === GameState.PARACHUTE ||
      isPlaying;
    let losBudget = 10;

    const enemyRenderDist = this.getEnemyRenderDist();
    const effectiveRenderDist =
      state === GameState.DROPPING || state === GameState.PARACHUTE
        ? Math.max(enemyRenderDist, 130)
        : enemyRenderDist;
    const effectiveRenderDistSq = effectiveRenderDist * effectiveRenderDist;
    const playerSightRange = Math.min(62, enemyRenderDist * 0.9);
    const playerSightRangeSq = playerSightRange * playerSightRange;

    const formOffsets: Array<[number, number]> = [
      [-3.2, -2.6],
      [3.2, -2.6],
      [0.0, -4.6],
    ];
    let allyGroundSlot = 0;
    let allyAirSlot = 0;
    const playerFwdX = -Math.sin(this.yaw);
    const playerFwdZ = -Math.cos(this.yaw);
    const playerRightX = Math.cos(this.yaw);
    const playerRightZ = -Math.sin(this.yaw);

    let closestPlayerRescuerId: string | null = null;
    if (isPlaying && this.isPlayerDowned && !this.isDead) {
      let bestAllyDistSq = 85 * 85;
      for (let k = 0; k < bots.length; k++) {
        const ab = bots[k];
        if (!ab.isAlly || ab.eliminated || ab.isDowned || ab.downTimer > 0 || ab.airState !== 'ground') {
          continue;
        }
        const d2 =
          (ab.group.position.x - this.pos.x) * (ab.group.position.x - this.pos.x) +
          (ab.group.position.z - this.pos.z) * (ab.group.position.z - this.pos.z);
        if (d2 < bestAllyDistSq) {
          bestAllyDistSq = d2;
          closestPlayerRescuerId = ab.id;
        }
      }
    }

    const activeVeh = this.activeVehicleId
      ? this.world.vehicles.find((v) => v.id === this.activeVehicleId) ?? null
      : null;

    const maxVisibleBots = isWaiting
      ? BattleRoyaleEngine.MAX_WAIT_LOBBY_PEOPLE
      : this.settings.quality === 'low'
        ? 7
        : this.settings.quality === 'high'
          ? 18
          : 12;
    const maxFullAnimBots = isWaiting
      ? 18
      : this.settings.quality === 'low'
        ? 4
        : this.settings.quality === 'high'
          ? 12
          : 7;
    let visibleBotCount = 0;
    let animatedBotCount = 0;
    let aiBudget = 8;

    if (this.botDistSqScratch.length < bots.length) {
      this.botDistSqScratch = new Float64Array(bots.length);
    }
    this.botOrderScratch.length = bots.length;
    for (let idx = 0; idx < bots.length; idx++) {
      this.botOrderScratch[idx] = idx;
      const b = bots[idx];
      if (b.eliminated) {
        this.botDistSqScratch[idx] = Infinity;
      } else if (b.isAlly) {
        this.botDistSqScratch[idx] = 0;
      } else {
        const ddx = b.group.position.x - this.pos.x;
        const ddz = b.group.position.z - this.pos.z;
        this.botDistSqScratch[idx] = ddx * ddx + ddz * ddz;
      }
    }
    this.botOrderScratch.sort(
      (a, b) => this.botDistSqScratch[a] - this.botDistSqScratch[b],
    );

    // Resolve random offscreen skirmishes between distant enemies so 51-player lobbies thin naturally without CPU simulation cost
    if (isPlaying && combatEnabled && this.aliveCount > 8) {
      this.distantSkirmishTimer -= dt;
      if (this.distantSkirmishTimer <= 0) {
        this.distantSkirmishTimer = 2.8 + Math.random() * 2.0;
        let distantVictim: TargetDummy | null = null;
        let distantKiller: TargetDummy | null = null;
        for (let idx = bots.length - 1; idx >= 0; idx--) {
          const b = bots[idx];
          if (b.eliminated || b.isAlly || b.isDowned || b.downTimer > 0) continue;
          if (this.botDistSqScratch[idx] <= effectiveRenderDistSq) continue;
          if (!distantVictim) {
            distantVictim = b;
          } else if (b.teamId !== distantVictim.teamId) {
            distantKiller = b;
            break;
          }
        }
        if (distantVictim && distantKiller) {
          const wName = WEAPONS[distantKiller.weaponId]?.name ?? 'M4A1';
          distantKiller.kills += 1;
          this.finalizeBotElimination(
            distantVictim,
            false,
            distantKiller.nick,
            wName,
            Math.random() < 0.25,
          );
        }
      }
    }

    for (let ord = 0; ord < this.botOrderScratch.length; ord++) {
      const i = this.botOrderScratch[ord];
      const bot = bots[i];
      if (bot.eliminated) continue;
      if (isWaiting && !bot.waitingActive) {
        bot.group.visible = false;
        continue;
      }

      if (bot.downTimer > 0) {
        bot.downTimer = Math.max(0, bot.downTimer - dt);
        if (bot.rig && bot.animator) {
          bot.rig.weaponMount.visible = false;
          bot.animator.update(bot.rig, {
            dt,
            speed: 0,
            stance: 'stand',
            isGrounded: true,
            isSprinting: false,
            isAiming: false,
            isFiring: false,
            isLobby: false,
            isSkydiving: false,
            isParachuting: false,
            isDead: true,
            hasWeapon: false,
            pitchRad: 0,
          });
        }
        if (bot.downTimer === 0) {
          if (isPlaying) {
            bot.eliminated = true;
            bot.group.visible = false;
            if (bot.parachuteMesh) bot.parachuteMesh.visible = false;
            const dropY = this.resolveFloorHeight(
              bot.group.position.x,
              bot.group.position.z,
              bot.group.position.y + 0.6,
            );
            const entries: DeathBoxItemEntry[] = [];
            let eid = 1;
            if (bot.weaponId !== 'g18') {
              entries.push({
                id: `e${eid++}`,
                kind: 'weapon',
                weaponId: bot.weaponId,
                label: WEAPONS[bot.weaponId].name,
                subLabel: 'Principal',
              });
            }
            if (bot.secondaryWeaponId && bot.secondaryWeaponId !== bot.weaponId) {
              entries.push({
                id: `e${eid++}`,
                kind: 'weapon',
                weaponId: bot.secondaryWeaponId,
                label: WEAPONS[bot.secondaryWeaponId].name,
                subLabel: 'Secundária',
              });
            }
            if (bot.vestLevel > 0) {
              entries.push({
                id: `e${eid++}`,
                kind: 'vest',
                level: bot.vestLevel as 1 | 2 | 3,
                label: `Colete Nv.${bot.vestLevel}`,
                subLabel: `Nv.${bot.vestLevel}`,
              });
            }
            if (bot.helmetLevel > 0) {
              entries.push({
                id: `e${eid++}`,
                kind: 'helmet',
                level: bot.helmetLevel as 1 | 2 | 3,
                label: `Capacete Nv.${bot.helmetLevel}`,
                subLabel: `Nv.${bot.helmetLevel}`,
              });
            }
            if (bot.backpackLevel > 1) {
              entries.push({
                id: `e${eid++}`,
                kind: 'backpack',
                level: bot.backpackLevel as 1 | 2 | 3,
                label: `Mochila Nv.${bot.backpackLevel}`,
                subLabel: `Nv.${bot.backpackLevel}`,
              });
            }
            if (bot.medkits > 0) {
              entries.push({
                id: `e${eid++}`,
                kind: 'medkit',
                medkitAmount: bot.medkits,
                label: 'Kit Médico',
                subLabel: `x${bot.medkits}`,
              });
            }
            if (bot.gloos > 0) {
              entries.push({
                id: `e${eid++}`,
                kind: 'gloo',
                glooAmount: bot.gloos,
                label: 'Parede de Gelo',
                subLabel: `x${bot.gloos}`,
              });
            }
            if (bot.grenades > 0) {
              entries.push({
                id: `e${eid++}`,
                kind: 'grenade',
                grenadeAmount: bot.grenades,
                label: 'Granada',
                subLabel: `x${bot.grenades}`,
              });
            }
            if (bot.ammoCount > 0) {
              entries.push({
                id: `e${eid++}`,
                kind: 'ammo',
                ammoAmount: bot.ammoCount,
                label: 'Munição',
                subLabel: `+${bot.ammoCount}`,
              });
            }
            for (let s = 0; s < bot.scopes.length; s++) {
              const sc = bot.scopes[s];
              entries.push({
                id: `e${eid++}`,
                kind: 'scope',
                scopeType: sc,
                label: `Mira ${sc.toUpperCase()}`,
                subLabel: sc.toUpperCase(),
              });
            }
            for (let a = 0; a < bot.attachments.length; a++) {
              const att = bot.attachments[a];
              entries.push({
                id: `e${eid++}`,
                kind: 'attachment',
                attachmentKind: att,
                label: ATTACHMENT_LABELS[att].name,
                subLabel: 'Acessório',
              });
            }
            entries.push({
              id: `e${eid++}`,
              kind: 'coin',
              coinAmount: Math.max(80, bot.coins),
              label: 'Moedas FF',
              subLabel: `+${Math.max(80, bot.coins)}`,
            });

            this.world.spawnDroppedLoot({
              kind: 'deathbox',
              x: bot.group.position.x,
              y: dropY,
              z: bot.group.position.z,
              label: `Caixa de ${bot.nick}`,
              deathOwnerNick: bot.nick,
              deathEntries: entries,
            });
          } else {
            // Warm-up island respawns knocked bots automatically
            bot.hp = bot.maxHp;
            bot.isDowned = false;
            bot.bleedHp = 100;
            bot.vestHp = bot.vestMaxHp;
            bot.helmetHp = bot.helmetMaxHp;
            if (bot.vestMesh) bot.vestMesh.visible = false;
            if (bot.helmetMesh) bot.helmetMesh.visible = false;
            bot.group.rotation.x = 0;
            bot.animator?.reset();
            if (bot.rig) {
              bot.rig.weaponMount.visible = true;
              bot.rig.setBandageVisible?.(false);
            }
          }
        }
        continue;
      }

      // 0. Bot Airplane -> Skydiving -> Parachute Landing!
      if (bot.airState === 'inPlane') {
        if (!dropEnabled || bot.isAlly) continue;
        if (this.airplaneProgress >= bot.dropProgress || isPlaying) {
          const planePos = this.world.airplaneGroup.position;
          const spawnX =
            isPlaying && this.airplaneProgress >= 1.0
              ? bot.landX + (Math.random() - 0.5) * 24
              : planePos.x + (Math.random() - 0.5) * 6;
          const spawnZ =
            isPlaying && this.airplaneProgress >= 1.0
              ? bot.landZ + (Math.random() - 0.5) * 24
              : planePos.z + (Math.random() - 0.5) * 6;
          bot.airState = 'skydiving';
          bot.vy = -22;
          bot.group.visible = true;
          bot.group.position.set(spawnX, 110, spawnZ);
        }
        continue;
      }

      if (bot.airState === 'skydiving' || bot.airState === 'parachuting') {
        if (bot.isAlly) {
          const [rx, fx] = formOffsets[allyAirSlot % formOffsets.length];
          allyAirSlot++;
          const targetX = this.pos.x + playerRightX * rx + playerFwdX * fx;
          const targetZ = this.pos.z + playerRightZ * rx + playerFwdZ * fx;
          const dx = targetX - bot.group.position.x;
          const dz = targetZ - bot.group.position.z;
          const dist = Math.hypot(dx, dz);
          const isChute = bot.airState === 'parachuting';
          if (dist > 0.4) {
            const steer = Math.min(dist, (isChute ? 19 : 28) * dt);
            bot.group.position.x += (dx / dist) * steer;
            bot.group.position.z += (dz / dist) * steer;
            bot.group.rotation.y = this.yaw + Math.PI;
          }
          const gSurf = this.sampleEntitySurface(bot.group.position.x, bot.group.position.z);
          const minLandY = this.getDryMinFloorY();
          const gy = Math.max(minLandY, gSurf.y);
          const targetY = Math.max(gy, this.pos.y - 0.4);
          bot.group.position.y = THREE.MathUtils.damp(bot.group.position.y, targetY, 8, dt);
          if (!isChute && (state === GameState.PARACHUTE || bot.group.position.y - gy <= 28)) {
            bot.airState = 'parachuting';
            if (bot.parachuteMesh) bot.parachuteMesh.visible = true;
          }
          if (state === GameState.PLAYING || bot.group.position.y <= gy + 0.12) {
            bot.group.position.y = gy;
            this.resolveEntityHorizontalCollisions(bot.group.position, 0.44, null, false);
            this.resolveEntityHorizontalCollisions(bot.group.position, 0.44, null, false);
            bot.group.position.y = Math.max(
              minLandY,
              this.resolveFloorHeight(bot.group.position.x, bot.group.position.z, bot.group.position.y + 0.5),
            );
            bot.navCheckX = bot.group.position.x;
            bot.navCheckZ = bot.group.position.z;
            bot.airState = 'ground';
            bot.vy = 0;
            bot.rig?.setParachuteVisible(false);
            bot.animator?.triggerLanding();
            bot.goalX = targetX;
            bot.goalZ = targetZ;
          }
          if (
            bot.rig &&
            bot.animator &&
            (bot.group.position.x - this.pos.x) ** 2 + (bot.group.position.z - this.pos.z) ** 2 < 85 * 85
          ) {
            bot.rig.weaponMount.visible = false;
            bot.animator.update(bot.rig, {
              dt,
              speed: 6,
              stance: 'stand',
              isGrounded: bot.airState === 'ground',
              isSprinting: false,
              isAiming: false,
              isFiring: false,
              isLobby: false,
              isSkydiving: bot.airState === 'skydiving',
              isParachuting: bot.airState === 'parachuting',
              isDead: false,
              hasWeapon: false,
              pitchRad: 0,
            });
          }
          continue;
        }

        const isChute = bot.airState === 'parachuting';
        const dx = bot.landX - bot.group.position.x;
        const dz = bot.landZ - bot.group.position.z;
        const dist = Math.hypot(dx, dz);
        const glideSpeed = isChute ? 12 : 20;
        if (dist > 1.5) {
          bot.group.position.x += (dx / dist) * glideSpeed * dt;
          bot.group.position.z += (dz / dist) * glideSpeed * dt;
          bot.group.rotation.y = Math.atan2(dx, dz);
        }
        bot.vy = THREE.MathUtils.damp(bot.vy, isChute ? -8.5 : -25, 3.2, dt);
        bot.group.position.y += bot.vy * dt;

        const gSurf = this.sampleEntitySurface(bot.group.position.x, bot.group.position.z);
        const minLandY = this.getDryMinFloorY();
        const gy = Math.max(minLandY, gSurf.y);
        if (!isChute && bot.group.position.y - gy <= 46) {
          bot.airState = 'parachuting';
          if (bot.parachuteMesh) bot.parachuteMesh.visible = true;
        }
        if (bot.group.position.y <= gy) {
          bot.group.position.y = gy;
          this.resolveEntityHorizontalCollisions(bot.group.position, 0.44, null, false);
          this.resolveEntityHorizontalCollisions(bot.group.position, 0.44, null, false);
          bot.group.position.y = Math.max(
            minLandY,
            this.resolveFloorHeight(bot.group.position.x, bot.group.position.z, bot.group.position.y + 0.5),
          );
          bot.navCheckX = bot.group.position.x;
          bot.navCheckZ = bot.group.position.z;
          bot.airState = 'ground';
          bot.vy = 0;
          bot.rig?.setParachuteVisible(false);
          bot.animator?.triggerLanding();
          bot.goalX = bot.landX;
          bot.goalZ = bot.landZ;
        }
        const skyDistSq =
          (bot.group.position.x - this.pos.x) ** 2 + (bot.group.position.z - this.pos.z) ** 2;
        const showSky = skyDistSq <= effectiveRenderDistSq && visibleBotCount < maxVisibleBots;
        bot.group.visible = showSky;
        if (showSky) {
          visibleBotCount++;
          if (bot.rig && bot.animator && skyDistSq < 85 * 85 && animatedBotCount < maxFullAnimBots) {
            bot.rig.weaponMount.visible = false;
            bot.animator.update(bot.rig, {
              dt,
              speed: glideSpeed,
              stance: 'stand',
              isGrounded: bot.airState === 'ground',
              isSprinting: false,
              isAiming: false,
              isFiring: false,
              isLobby: false,
              isSkydiving: bot.airState === 'skydiving',
              isParachuting: bot.airState === 'parachuting',
              isDead: false,
              hasWeapon: false,
              pitchRad: 0,
            });
            animatedBotCount++;
          }
        }
        continue;
      }

      if (activeVeh && activeVeh.passengerIds.includes(bot.id)) {
        bot.group.position.set(activeVeh.x, activeVeh.y + 0.5, activeVeh.z);
        bot.group.visible = false;
        continue;
      }

      const curAllySlot = bot.isAlly ? allyGroundSlot++ : 0;

      bot.group.rotation.x = THREE.MathUtils.damp(bot.group.rotation.x, 0, 10, dt);
      bot.aiTimer -= dt;
      bot.fireCooldown = Math.max(0, bot.fireCooldown - dt);
      bot.glooCooldown = Math.max(0, bot.glooCooldown - dt);
      bot.huntTimer = Math.max(0, bot.huntTimer - dt);
      bot.steerLockTimer = Math.max(0, bot.steerLockTimer - dt);
      bot.vaultTimer = Math.max(0, bot.vaultTimer - dt);
      bot.jumpCooldown = Math.max(0, (bot.jumpCooldown ?? 0) - dt);
      if ((bot.retreatTimer ?? 0) > 0) {
        bot.retreatTimer = Math.max(0, (bot.retreatTimer ?? 0) - dt);
      }
      bot.escapeTimer = Math.max(0, bot.escapeTimer - dt);
      bot.drawTimer = Math.max(0, (bot.drawTimer ?? 0) - dt);
      if (bot.badLootTimer > 0) {
        bot.badLootTimer = Math.max(0, bot.badLootTimer - dt);
        if (bot.badLootTimer === 0) bot.badLootId = null;
      }

      const bx = bot.group.position.x;
      const bz = bot.group.position.z;
      const botCamDistSq =
        (bx - this.pos.x) * (bx - this.pos.x) + (bz - this.pos.z) * (bz - this.pos.z);
      const allyVisDist = Math.max(effectiveRenderDist, 165);
      const isSpectatedBot =
        this.isSpectating &&
        this.spectateTargetRef?.kind === 'bot' &&
        this.spectateTargetRef.botId === bot.id;
      const wantRender =
        isSpectatedBot ||
        botCamDistSq <= (bot.isAlly ? allyVisDist * allyVisDist : effectiveRenderDistSq);
      const inRenderRange =
        isSpectatedBot || (wantRender && (bot.isAlly || visibleBotCount < maxVisibleBots));
      bot.group.visible = inRenderRange;
      if (inRenderRange) visibleBotCount++;

      // Lightweight offscreen bot simulation: skip OBB raycasts, collision passes, AI loot & animations far from camera
      if (isPlaying && !bot.isAlly && !bot.isDowned && !inRenderRange) {
        const distZoneSq =
          (bx - this.zoneCurrentX) * (bx - this.zoneCurrentX) +
          (bz - this.zoneCurrentZ) * (bz - this.zoneCurrentZ);
        if (distZoneSq > this.zoneCurrentRadius * this.zoneCurrentRadius) {
          const pDef = SAFE_ZONE_PHASES[Math.min(SAFE_ZONE_PHASES.length - 1, this.zonePhase - 1)];
          this.applyBotHitDamage(bot, pDef.damagePerSec * 0.75 * dt, false, 'ZONA SEGURA', 'SAFE', false);
          if (bot.isDowned || bot.downTimer > 0 || bot.eliminated) continue;
        }
        const dxZ = this.zoneCurrentX - bx;
        const dzZ = this.zoneCurrentZ - bz;
        const distZ = Math.hypot(dxZ, dzZ);
        if (distZ > Math.max(18, this.zoneCurrentRadius * 0.55)) {
          const stepD = Math.min(distZ, 2.6 * dt);
          const abOff = this.getActiveBounds();
          const nx = THREE.MathUtils.clamp(bx + (dxZ / distZ) * stepD, abOff.minX + 16, abOff.maxX - 16);
          const nz = THREE.MathUtils.clamp(bz + (dzZ / distZ) * stepD, abOff.minZ + 16, abOff.maxZ - 16);
          const surf = this.sampleEntitySurface(nx, nz);
          bot.group.position.set(nx, Math.max(this.getDryMinFloorY(), surf.y), nz);
          bot.navCheckX = nx;
          bot.navCheckZ = nz;
        }
        if (
          bot.airState === 'ground' &&
          this.elapsed > 9 &&
          (isBotPistol(bot.weaponId) || !bot.secondaryWeaponId) &&
          Math.random() < dt * 0.25
        ) {
          const closePool: WeaponId[] = ['m1014', 'ump45'];
          const longPool: WeaponId[] = ['xm8', 'scar', 'ak47', 'm4a1', 'awm'];
          const pickFrom =
            !isBotPistol(bot.weaponId) && isLongRangePrimary(bot.weaponId)
              ? closePool
              : Math.random() < 0.34
                ? closePool
                : longPool;
          const scavenged = pickFrom[Math.floor(Math.random() * pickFrom.length)];
          giveBotLootedWeapon(bot, scavenged);
        }
        continue;
      }

      // Downed crawling state ("posição de 4") in Duo / Squad
      if (bot.isDowned) {
        if (!isPlaying) {
          bot.isDowned = false;
          bot.hp = bot.maxHp;
          continue;
        }
        let bleedRate = 5.4;
        const distZone = Math.hypot(bx - this.zoneCurrentX, bz - this.zoneCurrentZ);
        if (distZone > this.zoneCurrentRadius) {
          const pDef = SAFE_ZONE_PHASES[Math.min(SAFE_ZONE_PHASES.length - 1, this.zonePhase - 1)];
          bleedRate += pDef.damagePerSec * 0.75;
        }
        bot.bleedHp -= bleedRate * dt;
        if (bot.bleedHp <= 0) {
          this.finalizeBotElimination(
            bot,
            bot.knockedByPlayer,
            bot.knockedByPlayer ? this.playerNick : 'SANGRAMENTO',
            bot.knockedByPlayer ? 'ELIMINADO' : 'SANGRAMENTO',
            false,
          );
          continue;
        }

        // Knocked allies crawl toward the player for rescue; knocked enemies crawl away
        let cdx = bot.isAlly ? this.pos.x - bx : bx - this.pos.x;
        let cdz = bot.isAlly ? this.pos.z - bz : bz - this.pos.z;
        const cdist = Math.hypot(cdx, cdz) || 1;
        let movingCrawl = true;
        if (bot.isAlly && cdist <= 1.85) {
          movingCrawl = false;
        }
        cdx /= cdist;
        cdz /= cdist;
        const crawlSpeed = movingCrawl ? 1.25 : 0;
        if (movingCrawl) {
          let crawlGoalX = bot.isAlly ? this.pos.x : bx + cdx * 8;
          let crawlGoalZ = bot.isAlly ? this.pos.z : bz + cdz * 8;
          if (bot.isAlly) {
            this.resolveSmartBuildingTarget(
              bot,
              bx,
              bot.group.position.y,
              bz,
              this.pos.x,
              this.pos.z,
              this.pos.y,
            );
            crawlGoalX = this._botNavOut.x;
            crawlGoalZ = this._botNavOut.z;
          }
          const cgx = crawlGoalX - bx;
          const cgz = crawlGoalZ - bz;
          const cgDist = Math.hypot(cgx, cgz) || 1;
          this.steerBotDirection(
            bot,
            bx,
            bot.group.position.y,
            bz,
            cgx / cgDist,
            cgz / cgDist,
            true,
          );
          const sdx = this._botNavOut.dirX;
          const sdz = this._botNavOut.dirZ;
          const abCrawl = this.getActiveBounds();
          const nx = THREE.MathUtils.clamp(bx + sdx * crawlSpeed * dt, abCrawl.minX + 12, abCrawl.maxX - 12);
          const nz = THREE.MathUtils.clamp(bz + sdz * crawlSpeed * dt, abCrawl.minZ + 12, abCrawl.maxZ - 12);
          bot.group.position.x = nx;
          bot.group.position.z = nz;
          this.resolveEntityHorizontalCollisions(bot.group.position, 0.36, null, false);
          this.resolveEntityHorizontalCollisions(bot.group.position, 0.36, null, false);
          const floorY = Math.max(
            this.getDryMinFloorY(),
            this.resolveFloorHeight(bot.group.position.x, bot.group.position.z, bot.group.position.y),
          );
          bot.group.position.y = floorY;
          bot.group.rotation.y = Math.atan2(sdx, sdz);
        }

        if (inRenderRange && bot.rig && bot.animator) {
          bot.rig.weaponMount.visible = false;
          if (bot.isAlly || animatedBotCount < maxFullAnimBots) {
            const animDt = dt + (bot.animAccum ?? 0);
            bot.animAccum = 0;
            bot.animator.update(bot.rig, {
              dt: animDt,
              speed: crawlSpeed,
              stance: 'stand',
              isGrounded: true,
              isSprinting: false,
              isAiming: false,
              isFiring: false,
              isLobby: false,
              isSkydiving: false,
              isParachuting: false,
              isDead: false,
              isDowned: true,
              hasWeapon: false,
              hasMoveInput: movingCrawl,
              pitchRad: 0,
            });
            animatedBotCount++;
          } else {
            bot.animAccum = (bot.animAccum ?? 0) + dt;
          }
        }
        continue;
      }

      // Gladiadores mode: classic original bad bots for enemies!
      // Stationary (zero movement/strafe), shoot nonstop until mag empties, then stop, spin in place while reloading, refill and repeat, NEVER able to kill the player!
      if (this.gameVariant === 'gladiadores' && isPlaying && !bot.isAlly) {
        const floorY = this.resolveFloorHeight(bx, bz, bot.group.position.y + 0.5);
        bot.group.position.y = floorY;

        let gladState = this.gladSpinReloadState.get(bot.id);
        if (!gladState) {
          gladState = { phase: 'shoot', spinDir: i % 2 === 0 ? 1 : -1 };
          this.gladSpinReloadState.set(bot.id, gladState);
        }

        let isFiringNow = false;
        let isReloadingNow = false;

        if (this.gladPhase === 'fight') {
          if (gladState.phase === 'reload_spin') {
            isReloadingNow = true;
            bot.reloadTimer = Math.max(0, bot.reloadTimer - dt);
            bot.group.rotation.y += gladState.spinDir * dt * 4.4;
            if (bot.reloadTimer <= 0) {
              bot.ammoInMag = WEAPONS[bot.weaponId].magSize;
              gladState.phase = 'shoot';
              bot.fireCooldown = 0.22;
            }
          } else {
            const faceYaw = Math.atan2(this.pos.x - bx, this.pos.z - bz);
            bot.group.rotation.y = lerpAngle(bot.group.rotation.y, faceYaw, 1 - Math.exp(-8 * dt));
            if (bot.ammoInMag <= 0) {
              gladState.phase = 'reload_spin';
              bot.reloadTimer = 2.6;
              isReloadingNow = true;
            } else if (bot.fireCooldown <= 0) {
              const def = WEAPONS[bot.weaponId];
              bot.ammoInMag -= 1;
              bot.animator?.triggerFire();
              isFiringNow = true;
              bot.fireCooldown = Math.max(0.11, (def.fireRateMs / 1000) * 1.15);

              const camDistSq =
                (bx - this.pos.x) * (bx - this.pos.x) + (bz - this.pos.z) * (bz - this.pos.z);
              if (camDistSq < 140 * 140) {
                soundEngine.playGunshot(bot.weaponId, false, Math.sqrt(camDistSq));
              }

              // Spray wide tracers near player so bots look busy and bad
              _v1.set(bx, bot.group.position.y + 1.25, bz);
              _v2.set(
                this.pos.x + (Math.random() - 0.5) * 5.2,
                this.pos.y + 1.15 + (Math.random() - 0.5) * 2.2,
                this.pos.z + (Math.random() - 0.5) * 5.2,
              );
              this.spawnTracer(_v1, _v2);

              // Never lethal: tiny chip graze at high HP, strictly impossible to drop player HP below 45
              if (!this.isDead && this.hp > 55 && Math.random() < 0.08) {
                const chipDmg = Math.min(4, Math.max(1, this.hp - 48));
                this.applyPlayerDamage(chipDmg, bx, bz, bot.nick, def.shortName, false);
              }
            }
          }
        } else {
          // Intro or round end: face West spawn calmly
          bot.group.rotation.y = lerpAngle(bot.group.rotation.y, -Math.PI / 2, 1 - Math.exp(-8 * dt));
        }

        if (bot.rig && bot.animator) {
          bot.rig.weaponMount.visible = true;
          bot.animator.update(bot.rig, {
            dt,
            speed: 0,
            stance: 'stand',
            isGrounded: true,
            isSprinting: false,
            isAiming: gladState.phase === 'shoot' && this.gladPhase === 'fight',
            isFiring: isFiringNow,
            isLobby: false,
            isSkydiving: false,
            isParachuting: false,
            isDead: false,
            isDowned: false,
            isReloading: isReloadingNow,
            hasWeapon: true,
            hasMoveInput: false,
            weaponCategory: WEAPONS[bot.weaponId]?.category ?? 'AR',
            pitchRad: 0,
          });
        }
        continue;
      }

      if (bot.rig) bot.rig.weaponMount.visible = true;

      if (bot.targetId === 'player' && (bot.isAlly || botCamDistSq > playerSightRangeSq)) {
        bot.targetId = null;
      }

      // Bot takes Safe Zone damage if caught outside blue ring
      if (isPlaying && this.gameVariant !== 'gladiadores') {
        const distZone = Math.hypot(bx - this.zoneCurrentX, bz - this.zoneCurrentZ);
        if (distZone > this.zoneCurrentRadius) {
          const pDef = SAFE_ZONE_PHASES[Math.min(SAFE_ZONE_PHASES.length - 1, this.zonePhase - 1)];
          this.applyBotHitDamage(
            bot,
            pDef.damagePerSec * 0.75 * dt,
            false,
            'ZONA SEGURA',
            'SAFE',
            false,
          );
          if (bot.isDowned || bot.downTimer > 0) continue;
        }
      }

      // 1. Periodic staggered sight-based AI decision
      if (bot.aiTimer <= 0 && (bot.isAlly || aiBudget > 0)) {
        if (!bot.isAlly) aiBudget--;
        bot.aiTimer = 0.5 + ((i * 17) % 10) * 0.04;
        bot.targetId = null;

        const distFromZone = Math.hypot(bx - this.zoneCurrentX, bz - this.zoneCurrentZ);
        const outsideSafeRing =
          isPlaying &&
          this.gameVariant !== 'gladiadores' &&
          distFromZone > this.zoneCurrentRadius * 0.94;
        const needSafeMove =
          isPlaying &&
          this.gameVariant !== 'gladiadores' &&
          distFromZone > this.zoneCurrentRadius * 0.85;

        // Check for a downed squadmate (OR downed player!) needing rescue
        let reviveMateTargetId: string | null = null;
        if (isPlaying && this.matchMode !== 'solo') {
          if (closestPlayerRescuerId === bot.id && this.isPlayerDowned && !this.isDead) {
            reviveMateTargetId = 'player';
          } else {
            let bestMateDistSq = 68 * 68;
            for (let j = 0; j < bots.length; j++) {
              if (i === j) continue;
              const other = bots[j];
              if (other.teamId !== bot.teamId || !other.isDowned || other.eliminated || other.downTimer > 0) {
                continue;
              }
              const md2 =
                (other.group.position.x - bx) * (other.group.position.x - bx) +
                (other.group.position.z - bz) * (other.group.position.z - bz);
              if (md2 < bestMateDistSq) {
                bestMateDistSq = md2;
                reviveMateTargetId = other.id;
              }
            }
          }
        }

        let immediateThreatDistSq = Infinity;
        if (combatEnabled && losBudget > 0) {
          // Sight-based enemy search up to 105m
          let bestDistSq = isPlaying ? 105 * 105 : 38 * 38;
          let candidate: TargetDummy | null = null;
          for (let j = 0; j < bots.length; j++) {
            if (i === j) continue;
            const other = bots[j];
            if (other.teamId === bot.teamId) continue;
            if (other.eliminated || other.downTimer > 0 || other.airState !== 'ground') continue;
            const ddx = other.group.position.x - bx;
            const ddz = other.group.position.z - bz;
            let d2 = ddx * ddx + ddz * ddz + (other.isDowned ? 900 : 0);
            if (bot.isAlly && other.targetId === 'player') {
              d2 *= 0.45;
            }
            if (d2 < bestDistSq) {
              bestDistSq = d2;
              candidate = other;
            }
          }
          if (candidate) {
            losBudget--;
            if (
              this.canBotSeePoint(
                bot,
                candidate.group.position.x,
                candidate.group.position.y + (candidate.isDowned ? 0.55 : candidate.chestOffsetY),
                candidate.group.position.z,
                isPlaying ? 105 : 38,
              )
            ) {
              bot.targetId = candidate.id;
              immediateThreatDistSq = bestDistSq;
            }
          }

          if (!bot.isAlly && !bot.targetId && isPlaying && !this.isDead && losBudget > 0) {
            const pCheckDistSq = botCamDistSq + (this.isPlayerDowned ? 900 : 0);
            if (pCheckDistSq <= playerSightRangeSq) {
              losBudget--;
              if (
                this.canBotSeePoint(
                  bot,
                  this.pos.x,
                  this.pos.y + (this.isPlayerDowned ? 0.48 : 1.25),
                  this.pos.z,
                  playerSightRange,
                )
              ) {
                bot.targetId = 'player';
                immediateThreatDistSq = pCheckDistSq;
              }
            }
          }
        }

        if (reviveMateTargetId && (reviveMateTargetId === 'player' || immediateThreatDistSq > 14 * 14)) {
          if (bot.aiState !== 'revive' || bot.revivingMateId !== reviveMateTargetId) {
            bot.reviveTimer = 0;
          }
          bot.aiState = 'revive';
          bot.revivingMateId = reviveMateTargetId;
          bot.targetId = null;
          bot.isRetreating = false;
        } else if (!bot.isAlly && outsideSafeRing && immediateThreatDistSq > 14 * 14) {
          // Prioritize running into the Safe Zone when outside/near the gas edge
          bot.aiState = 'roam';
          bot.targetId = null;
          bot.revivingMateId = null;
          bot.isRetreating = false;
          const ang = (i * 1.47 + this.elapsed * 0.15) % (Math.PI * 2);
          const rr = Math.min(Math.max(12, this.zoneNextRadius * 0.55), 95);
          let gx = this.zoneNextX + Math.cos(ang) * rr;
          let gz = this.zoneNextZ + Math.sin(ang) * rr;
          if (this.sampleEntitySurface(gx, gz).inWater || !this.isPointInActivePlayableArea(gx, gz)) {
            gx = this.zoneCurrentX;
            gz = this.zoneCurrentZ;
          }
          bot.goalX = gx;
          bot.goalZ = gz;
        } else if (bot.hp < 95 && bot.medkits > 0 && immediateThreatDistSq > 11 * 11) {
          // Stop and apply medkit when HP is low (unless enemy is right on top of them)
          if (bot.aiState !== 'heal') {
            bot.healTimer = 3.8;
          }
          bot.aiState = 'heal';
          bot.targetId = null;
          bot.revivingMateId = null;
          bot.isRetreating = false;
        } else if (bot.targetId) {
          bot.aiState = 'combat';
          bot.revivingMateId = null;
          bot.reviveTimer = 0;
        } else if (needSafeMove && !bot.isAlly) {
          bot.aiState = 'roam';
          bot.isRetreating = false;
          const ang = (i * 1.47 + this.elapsed * 0.2) % (Math.PI * 2);
          const rr = Math.min(this.zoneNextRadius * 0.65, 110);
          let gx = this.zoneNextX + Math.cos(ang) * rr;
          let gz = this.zoneNextZ + Math.sin(ang) * rr;
          if (this.sampleEntitySurface(gx, gz).inWater || !this.isPointInActivePlayableArea(gx, gz)) {
            gx = this.zoneCurrentX;
            gz = this.zoneCurrentZ;
          }
          bot.goalX = gx;
          bot.goalZ = gz;
        } else if (bot.isAlly && isPlaying) {
          const distToPlayer = Math.hypot(this.pos.x - bx, this.pos.z - bz);
          const distGoal = Math.hypot(bot.goalX - bx, bot.goalZ - bz);
          const abAlly = this.getActiveBounds();

          if (distToPlayer > 130 && !bot.isDowned) {
            const backAng = this.yaw + Math.PI + (curAllySlot - 1) * 0.45;
            const rx = THREE.MathUtils.clamp(this.pos.x + Math.sin(backAng) * 20, abAlly.minX + 12, abAlly.maxX - 12);
            const rz = THREE.MathUtils.clamp(this.pos.z + Math.cos(backAng) * 20, abAlly.minZ + 12, abAlly.maxZ - 12);
            if (!this.sampleEntitySurface(rx, rz).inWater && !this.isPointBlockedForBot(rx, this.pos.y, rz, 0.55)) {
              bot.group.position.set(
                rx,
                Math.max(this.getDryMinFloorY(), this.resolveFloorHeight(rx, rz, this.pos.y + 0.5)),
                rz,
              );
              this.resolveEntityHorizontalCollisions(bot.group.position, 0.36, null, false);
              bot.escapeTimer = 0;
              bot.stuckTimer = 0;
              bot.goalX = rx;
              bot.goalZ = rz;
            }
          }

          if (activeVeh && !activeVeh.destroyed && activeVeh.passengerIds.length < 3 && distToPlayer < 32) {
            bot.aiState = 'roam';
            bot.goalX = activeVeh.x;
            bot.goalZ = activeVeh.z;
            if (distToPlayer < 4.5) {
              activeVeh.passengerIds.push(bot.id);
              bot.group.visible = false;
              soundEngine.playVehicleEnter();
            }
          } else if (needSafeMove) {
            bot.aiState = 'roam';
            const ang = (curAllySlot * 1.45 + this.elapsed * 0.15) % (Math.PI * 2);
            const rr = Math.min(this.zoneNextRadius * 0.55, 45);
            bot.goalX = this.zoneNextX + Math.cos(ang) * rr;
            bot.goalZ = this.zoneNextZ + Math.sin(ang) * rr;
          } else if (distToPlayer > 52) {
            const formAng = curAllySlot * 1.25 + this.yaw + Math.PI;
            bot.aiState = 'roam';
            const playerBldg = this.world.findBuildingNavZoneAt(this.pos.x, this.pos.z);
            if (playerBldg && playerBldg.doors.length > 0) {
              bot.goalX = playerBldg.doors[0].outX;
              bot.goalZ = playerBldg.doors[0].outZ;
            } else {
              let pickedX = THREE.MathUtils.clamp(this.pos.x + Math.sin(formAng) * 7.5, abAlly.minX + 12, abAlly.maxX - 12);
              let pickedZ = THREE.MathUtils.clamp(this.pos.z + Math.cos(formAng) * 7.5, abAlly.minZ + 12, abAlly.maxZ - 12);
              for (let tryIdx = 0; tryIdx < 6; tryIdx++) {
                const ta = formAng + tryIdx * 1.047;
                const cx = THREE.MathUtils.clamp(this.pos.x + Math.sin(ta) * 7.5, abAlly.minX + 12, abAlly.maxX - 12);
                const cz = THREE.MathUtils.clamp(this.pos.z + Math.cos(ta) * 7.5, abAlly.minZ + 12, abAlly.maxZ - 12);
                if (!this.sampleEntitySurface(cx, cz).inWater && !this.isPointBlockedForBot(cx, this.pos.y, cz, 0.55)) {
                  pickedX = cx;
                  pickedZ = cz;
                  break;
                }
              }
              bot.goalX = pickedX;
              bot.goalZ = pickedZ;
            }
          } else {
            let foundAllyLoot = false;
            const curBotBldg = this.world.findBuildingNavZoneAt(bx, bz);
            if (
              isBotPistol(bot.weaponId) ||
              !bot.secondaryWeaponId ||
              bot.vestLevel < 2 ||
              bot.medkits < 2
            ) {
              let bestLootScore = -1;
              let chosenLoot: LootVisual | null = null;
              for (let l = 0; l < this.world.loots.length; l++) {
                const loot = this.world.loots[l];
                if (
                  loot.data.collected ||
                  loot.data.kind === 'deathbox' ||
                  loot.data.kind === 'coin' ||
                  loot.data.id === bot.badLootId
                ) {
                  continue;
                }
                if (loot.data.kind === 'weapon' && loot.data.weaponId) {
                  const wid = loot.data.weaponId;
                  if (wid === bot.weaponId || wid === bot.secondaryWeaponId) continue;
                  if (isBotPistol(wid) && !isBotPistol(bot.weaponId)) continue;
                }
                const ldx = loot.data.x - bx;
                const ldz = loot.data.z - bz;
                if (Math.abs(ldx) > 32 || Math.abs(ldz) > 32) continue;
                if (Math.abs(loot.data.y - bot.group.position.y) > 2.2) {
                  const lootBldg = this.world.findBuildingNavZoneAt(loot.data.x, loot.data.z);
                  if (!curBotBldg || curBotBldg !== lootBldg) continue;
                }
                const db = Math.hypot(ldx, ldz);
                const dp = Math.hypot(loot.data.x - this.pos.x, loot.data.z - this.pos.z);
                if (db < 32 && dp > 4.5) {
                  let prio = 32 - db;
                  if (loot.data.kind === 'weapon' && loot.data.weaponId && !isBotPistol(loot.data.weaponId)) {
                    prio += isBotPistol(bot.weaponId) ? 75 : !bot.secondaryWeaponId ? 48 : 20;
                  }
                  if (prio > bestLootScore) {
                    bestLootScore = prio;
                    chosenLoot = loot;
                  }
                }
              }
              if (chosenLoot) {
                bot.aiState = 'loot';
                bot.goalX = chosenLoot.data.x;
                bot.goalY = chosenLoot.data.y;
                bot.goalZ = chosenLoot.data.z;
                foundAllyLoot = true;
              }
            }
            if (!foundAllyLoot && (distGoal < 3.5 || bot.huntTimer <= 0)) {
              bot.huntTimer = 3.8 + curAllySlot * 0.7;
              bot.aiState = 'roam';
              const playerBldg = this.world.findBuildingNavZoneAt(this.pos.x, this.pos.z);
              let pickedX = this.pos.x;
              let pickedZ = this.pos.z;
              let foundClearSpot = false;
              const baseAng = curAllySlot * 2.094 + this.yaw + Math.PI;
              const baseR = 4.6 + (curAllySlot % 3) * 1.9;
              for (let tryIdx = 0; tryIdx < 6; tryIdx++) {
                const tryAng = baseAng + tryIdx * 1.047;
                const gx = THREE.MathUtils.clamp(this.pos.x + Math.sin(tryAng) * baseR, abAlly.minX + 12, abAlly.maxX - 12);
                const gz = THREE.MathUtils.clamp(this.pos.z + Math.cos(tryAng) * baseR, abAlly.minZ + 12, abAlly.maxZ - 12);
                if (!this.isPointInActivePlayableArea(gx, gz)) continue;
                if (this.sampleEntitySurface(gx, gz).inWater) continue;
                if (this.isPointBlockedForBot(gx, this.pos.y, gz, 0.52)) continue;
                const candBldg = this.world.findBuildingNavZoneAt(gx, gz);
                if (candBldg && candBldg !== playerBldg) continue;
                pickedX = gx;
                pickedZ = gz;
                foundClearSpot = true;
                break;
              }
              if (!foundClearSpot && playerBldg && playerBldg.doors.length > 0) {
                pickedX = playerBldg.doors[0].outX;
                pickedZ = playerBldg.doors[0].outZ;
              }
              bot.goalX = pickedX;
              bot.goalY = this.pos.y;
              bot.goalZ = pickedZ;
            }
          }
        } else {
          let foundLoot = false;
          const curBotBldg = this.world.findBuildingNavZoneAt(bx, bz);
          const abEnemy = this.getActiveBounds();
          if (isBotPistol(bot.weaponId) || !bot.secondaryWeaponId || bot.vestLevel === 0) {
            let bestLootScore = -1;
            let chosenLoot: LootVisual | null = null;
            for (let l = 0; l < this.world.loots.length; l++) {
              const loot = this.world.loots[l];
              if (
                loot.data.collected ||
                loot.data.kind === 'deathbox' ||
                loot.data.id === bot.badLootId
              ) {
                continue;
              }
              if (loot.data.kind === 'weapon' && loot.data.weaponId) {
                const wid = loot.data.weaponId;
                if (wid === bot.weaponId || wid === bot.secondaryWeaponId) continue;
                if (isBotPistol(wid) && !isBotPistol(bot.weaponId)) continue;
              }
              const ldx = loot.data.x - bx;
              const ldz = loot.data.z - bz;
              if (Math.abs(ldx) > 30 || Math.abs(ldz) > 30) continue;
              if (Math.abs(loot.data.y - bot.group.position.y) > 2.2) {
                const lootBldg = this.world.findBuildingNavZoneAt(loot.data.x, loot.data.z);
                if (!curBotBldg || curBotBldg !== lootBldg) continue;
              }
              const dp = Math.hypot(loot.data.x - this.pos.x, loot.data.z - this.pos.z);
              if (!bot.isAlly && dp < 15) continue;
              const db = Math.hypot(ldx, ldz);
              if (db < 30) {
                let prio = 30 - db;
                if (loot.data.kind === 'weapon' && loot.data.weaponId && !isBotPistol(loot.data.weaponId)) {
                  prio += isBotPistol(bot.weaponId) ? 75 : !bot.secondaryWeaponId ? 48 : 20;
                }
                if (prio > bestLootScore) {
                  bestLootScore = prio;
                  chosenLoot = loot;
                }
              }
            }
            if (chosenLoot) {
              bot.aiState = 'loot';
              bot.goalX = chosenLoot.data.x;
              bot.goalY = chosenLoot.data.y;
              bot.goalZ = chosenLoot.data.z;
              foundLoot = true;
            }
          }

          if (!foundLoot) {
            bot.aiState = 'roam';
            const distGoal = Math.hypot(bot.goalX - bx, bot.goalZ - bz);
            if (distGoal < 5.0 || (isPlaying && bot.huntTimer <= 0)) {
              bot.huntTimer = 4.2 + (i % 5) * 0.7;

              // Proactively hunt nearest enemy / gunfight hotspot ("caçar tretação")
              let huntX: number | null = null;
              let huntZ: number | null = null;
              let bestEnemyDistSq = 210 * 210;
              for (let j = 0; j < bots.length; j++) {
                if (i === j) continue;
                const other = bots[j];
                if (other.teamId === bot.teamId || other.eliminated || other.downTimer > 0 || other.airState !== 'ground') {
                  continue;
                }
                const ex = other.group.position.x;
                const ez = other.group.position.z;
                if (
                  isPlaying &&
                  Math.hypot(ex - this.zoneCurrentX, ez - this.zoneCurrentZ) > this.zoneCurrentRadius * 0.94
                ) {
                  continue;
                }
                const d2 = (ex - bx) * (ex - bx) + (ez - bz) * (ez - bz);
                if (d2 < bestEnemyDistSq) {
                  bestEnemyDistSq = d2;
                  huntX = ex;
                  huntZ = ez;
                }
              }

              if (isWaiting) {
                const abWait = this.getActiveBounds();
                bot.goalX = THREE.MathUtils.clamp(
                  WAIT_LOBBY_ORIGIN.x - 14.5 + (((i + Math.floor(this.elapsed)) * 3.9) % 25.0),
                  abWait.minX + 0.9,
                  abWait.maxX - 0.9,
                );
                bot.goalZ = THREE.MathUtils.clamp(
                  WAIT_LOBBY_ORIGIN.z - 7.4 + (((i + Math.floor(this.elapsed * 0.7)) * 2.1) % 7.0),
                  abWait.minZ + 0.8,
                  abWait.maxZ - 0.8,
                );
              } else if (huntX !== null && huntZ !== null) {
                const ang = ((i * 1.7) % (Math.PI * 2));
                bot.goalX = THREE.MathUtils.clamp(huntX + Math.cos(ang) * 14, abEnemy.minX + 12, abEnemy.maxX - 12);
                bot.goalZ = THREE.MathUtils.clamp(huntZ + Math.sin(ang) * 14, abEnemy.minZ + 12, abEnemy.maxZ - 12);
              } else if (
                isPlaying &&
                this.lastGunfightTimer > 0 &&
                Math.hypot(this.lastGunfightX - this.zoneCurrentX, this.lastGunfightZ - this.zoneCurrentZ) <
                  this.zoneCurrentRadius * 0.9
              ) {
                bot.goalX = this.lastGunfightX + ((i % 3) - 1) * 14;
                bot.goalZ = this.lastGunfightZ + (((i + 1) % 3) - 1) * 14;
              } else {
                const pois = this.world.pois;
                const poi = pois[(i + Math.floor(this.elapsed * 2.5)) % pois.length];
                const ang = (i * 1.9 + this.elapsed * 0.5) % (Math.PI * 2);
                const rad = 12 + (i % 5) * 10;
                let gx = poi.x + Math.cos(ang) * rad;
                let gz = poi.z + Math.sin(ang) * rad;
                if (
                  isPlaying &&
                  Math.hypot(gx - this.zoneCurrentX, gz - this.zoneCurrentZ) >
                    this.zoneCurrentRadius * 0.85
                ) {
                  gx = this.zoneNextX + Math.cos(ang) * Math.min(80, this.zoneNextRadius * 0.6);
                  gz = this.zoneNextZ + Math.sin(ang) * Math.min(80, this.zoneNextRadius * 0.6);
                }
                if (this.sampleEntitySurface(gx, gz).inWater || !this.isPointInActivePlayableArea(gx, gz)) {
                  gx = poi.x;
                  gz = poi.z;
                }
                bot.goalX = gx;
                bot.goalZ = gz;
              }
            }
          }
        }
      }

      // 2. Execute state: Revive vs Heal vs Combat vs Loot vs Roam
      let moveDirX = 0;
      let moveDirZ = 0;
      let isMoving = false;
      let isCrouchingAction = false;
      let wantSteerWaterAvoid = true;

      if (bot.aiState === 'revive' && bot.revivingMateId) {
        if (bot.revivingMateId === 'player') {
          if (!this.isPlayerDowned || this.isDead || !isPlaying) {
            if (this.playerRevivingAllyId === bot.id) this.playerRevivingAllyId = null;
            bot.revivingMateId = null;
            bot.reviveTimer = 0;
            bot.aiState = 'roam';
          } else {
            const dx = this.pos.x - bx;
            const dz = this.pos.z - bz;
            const mDist = Math.hypot(dx, dz);
            if (mDist > 2.4) {
              this.resolveSmartBuildingTarget(
                bot,
                bx,
                bot.group.position.y,
                bz,
                this.pos.x,
                this.pos.z,
                this.pos.y,
              );
              const wdx = this._botNavOut.x - bx;
              const wdz = this._botNavOut.z - bz;
              const wDist = Math.hypot(wdx, wdz) || 1;
              moveDirX = wdx / wDist;
              moveDirZ = wdz / wDist;
              isMoving = true;
              bot.group.rotation.y = lerpAngle(bot.group.rotation.y, Math.atan2(moveDirX, moveDirZ), 1 - Math.exp(-12 * dt));
              if (this.playerRevivingAllyId === bot.id) this.playerRevivingAllyId = null;
            } else {
              bot.group.rotation.y = lerpAngle(bot.group.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
              isCrouchingAction = true;
              this.playerRevivingAllyId = bot.id;
              bot.reviveTimer += dt;
              if (bot.reviveTimer >= 3.0) {
                this.isPlayerDowned = false;
                this.hp = 85;
                this.playerBleedHp = 100;
                this.playerRevivingAllyId = null;
                this.stance = 'crouch';
                soundEngine.completeMedkitAudio();
                this.pushKillFeed(bot.nick, `${this.playerNick} SALVO`, 'REVIVE', false, true);
                bot.revivingMateId = null;
                bot.reviveTimer = 0;
                bot.aiState = 'roam';
              }
            }
          }
        } else {
          const mate = this.targetById.get(bot.revivingMateId);
          if (!mate || !mate.isDowned || mate.eliminated || mate.downTimer > 0) {
            bot.revivingMateId = null;
            bot.reviveTimer = 0;
            bot.aiState = 'roam';
          } else {
            const dx = mate.group.position.x - bx;
            const dz = mate.group.position.z - bz;
            const mDist = Math.hypot(dx, dz);
            if (mDist > 2.4) {
              this.resolveSmartBuildingTarget(
                bot,
                bx,
                bot.group.position.y,
                bz,
                mate.group.position.x,
                mate.group.position.z,
                mate.group.position.y,
              );
              const wdx = this._botNavOut.x - bx;
              const wdz = this._botNavOut.z - bz;
              const wDist = Math.hypot(wdx, wdz) || 1;
              moveDirX = wdx / wDist;
              moveDirZ = wdz / wDist;
              isMoving = true;
              bot.group.rotation.y = lerpAngle(bot.group.rotation.y, Math.atan2(moveDirX, moveDirZ), 1 - Math.exp(-12 * dt));
            } else {
              bot.group.rotation.y = lerpAngle(bot.group.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
              isCrouchingAction = true;
              bot.reviveTimer += dt;
              if (bot.reviveTimer >= 2.8) {
                mate.isDowned = false;
                mate.hp = 115;
                mate.bleedHp = 100;
                mate.downTimer = 0;
                mate.knockedByPlayer = false;
                mate.aiState = mate.medkits > 0 ? 'heal' : 'roam';
                mate.healTimer = 3.8;
                mate.animator?.reset();
                if (mate.rig) {
                  mate.rig.weaponMount.visible = true;
                }
                this.pushKillFeed(bot.nick, `${mate.nick} SALVO`, 'REVIVE', false, bot.isAlly);
                bot.revivingMateId = null;
                bot.reviveTimer = 0;
                bot.aiState = 'roam';
              }
            }
          }
        }
      } else if (bot.aiState === 'heal') {
        isCrouchingAction = true;
        bot.isRetreating = false;
        bot.healTimer -= dt;
        if (bot.healTimer <= 0) {
          if (bot.medkits > 0) {
            bot.medkits -= 1;
            bot.hp = Math.min(bot.maxHp, bot.hp + 75);
          }
          bot.aiState = 'roam';
        }
      } else if (bot.aiState === 'combat' && bot.targetId) {
        let tx = 0;
        let ty = 0;
        let tz = 0;
        let targetBaseY = 0;
        let targetAlive = false;
        let targetBot: TargetDummy | null = null;

        if (bot.targetId === 'player') {
          if (!bot.isAlly && !this.isDead && isPlaying) {
            tx = this.pos.x;
            ty = this.pos.y + (this.isPlayerDowned ? 0.48 : 1.15);
            tz = this.pos.z;
            targetBaseY = this.pos.y;
            targetAlive = true;
          }
        } else {
          targetBot = this.targetById.get(bot.targetId) ?? null;
          if (targetBot && !targetBot.eliminated && targetBot.downTimer <= 0) {
            tx = targetBot.group.position.x;
            ty = targetBot.group.position.y + (targetBot.isDowned ? 0.45 : targetBot.chestOffsetY);
            tz = targetBot.group.position.z;
            targetBaseY = targetBot.group.position.y;
            targetAlive = true;
          }
        }

        if (!targetAlive) {
          bot.targetId = null;
          bot.isRetreating = false;
          bot.aiState = 'roam';
        } else {
          const dx = tx - bx;
          const dz = tz - bz;
          const dist = Math.hypot(dx, dz);
          const faceYaw = Math.atan2(dx, dz);

          const bestCombatWid = pickBestBotWeaponForDistance(bot, dist);
          if (bestCombatWid !== bot.weaponId && bot.reloadTimer <= 0) {
            equipBotWeapon(bot, bestCombatWid, true);
            bot.fireCooldown = Math.max(bot.fireCooldown, 0.28);
          }

          const curCombatBldg = this.world.findBuildingNavZoneAt(bx, bz);
          const targetCombatBldg = this.world.findBuildingNavZoneAt(tx, tz);
          const needBuildingNav =
            curCombatBldg !== null &&
            (curCombatBldg !== targetCombatBldg || Math.abs(bot.group.position.y - targetBaseY) > 1.8);

          // Classic Free Fire bot spacing:
          // - If enemy approaches very close (< 9.5m), turn and run away until >= 17.5m
          // - Otherwise walk closer only if beyond firing range (> 30m), then STAND STILL & shoot!
          if (dist < 9.5) {
            bot.isRetreating = true;
            bot.retreatTimer = Math.max(bot.retreatTimer ?? 0, 2.2);
          } else if (bot.isRetreating && (dist >= 17.5 || ((bot.retreatTimer ?? 0) <= 0 && dist >= 14.5))) {
            bot.isRetreating = false;
            bot.retreatTimer = 0.65;
          }

          const activeBotWid = bot.weaponId;
          const approachMaxDist = activeBotWid === 'm1014' ? 18 : 30;

          if (bot.isRetreating) {
            const safeDist = Math.max(0.01, dist);
            moveDirX = -dx / safeDist;
            moveDirZ = -dz / safeDist;
            isMoving = true;
            wantSteerWaterAvoid = true;
            bot.group.rotation.y = lerpAngle(
              bot.group.rotation.y,
              Math.atan2(moveDirX, moveDirZ),
              1 - Math.exp(-12 * dt),
            );
          } else if (dist > approachMaxDist || needBuildingNav) {
            this.resolveSmartBuildingTarget(bot, bx, bot.group.position.y, bz, tx, tz, targetBaseY);
            const wdx = this._botNavOut.x - bx;
            const wdz = this._botNavOut.z - bz;
            const wDist = Math.hypot(wdx, wdz) || 1;
            moveDirX = wdx / wDist;
            moveDirZ = wdz / wDist;
            isMoving = true;
            wantSteerWaterAvoid = false;
            bot.group.rotation.y = lerpAngle(bot.group.rotation.y, faceYaw, 1 - Math.exp(-12 * dt));
          } else {
            // Stand completely still while shooting (no strafing / no fast movement)
            isMoving = false;
            bot.group.rotation.y = lerpAngle(bot.group.rotation.y, faceYaw, 1 - Math.exp(-12 * dt));
          }

          // After gaining distance (or when standing still in range), fire clumsy wide bursts
          if (bot.reloadTimer > 0) {
            bot.reloadTimer = Math.max(0, bot.reloadTimer - dt);
            if (bot.reloadTimer === 0) {
              bot.ammoInMag = WEAPONS[bot.weaponId].magSize;
            }
          } else if (
            !bot.isRetreating &&
            !isMoving &&
            bot.fireCooldown <= 0 &&
            dist < Math.min(105, WEAPONS[bot.weaponId].range)
          ) {
            const def = WEAPONS[bot.weaponId];
            if (bot.ammoInMag <= 0) {
              bot.reloadTimer = def.reloadTimeSec + 0.45;
            } else {
              bot.ammoInMag -= 1;
              bot.animator?.triggerFire();
              const burstPause = bot.ammoInMag % 4 === 0 ? 0.28 : 0;
              bot.fireCooldown =
                Math.max(0.22, (def.fireRateMs / 1000) * (def.automatic ? 2.15 : 1.5)) + burstPause;
              this.lastGunfightX = bx;
              this.lastGunfightZ = bz;
              this.lastGunfightTimer = 14;

              const camDistSq =
                (bx - this.pos.x) * (bx - this.pos.x) + (bz - this.pos.z) * (bz - this.pos.z);
              if (isPlaying && inRenderRange && camDistSq < 140 * 140) {
                soundEngine.playGunshot(bot.weaponId, false, Math.sqrt(camDistSq));
              }
              if (camDistSq < 110 * 110) {
                _v1.set(bx, bot.group.position.y + 1.25, bz);
                _v2.set(
                  tx + (Math.random() - 0.5) * 4.4,
                  ty + (Math.random() - 0.5) * 2.0,
                  tz + (Math.random() - 0.5) * 4.4,
                );
                this.spawnTracer(_v1, _v2);
              }

              if (bot.targetId === 'player') {
                // Bad-bot aim: misses ~84% of shots, deals tiny non-lethal chip damage, never kills the player
                if (dist < Math.min(92, def.range) && Math.random() < 0.16) {
                  if (activeVeh && !activeVeh.destroyed && Math.random() < 0.62) {
                    this.damageVehicle(activeVeh, Math.max(5, Math.round(def.damage * 0.22)));
                  } else if (!this.isDead && this.hp > 24) {
                    const rawChip = Math.round(3 + Math.random() * 3);
                    const chipDmg = Math.max(0, Math.min(rawChip, Math.floor(this.hp - 22)));
                    if (chipDmg > 0) {
                      this.applyPlayerDamage(
                        chipDmg,
                        bx,
                        bz,
                        bot.nick,
                        def.shortName,
                        false,
                      );
                    }
                  }
                }
              } else if (targetBot) {
                const hitChance = dist < 18 ? 0.30 : dist < 42 ? 0.24 : 0.16;
                if (Math.random() < hitChance) {
                  const isHead = !targetBot.isDowned && Math.random() < 0.08;
                  const { dmg, armorBlocked } = this.computeShotDamage(def, dist, isHead, targetBot);
                  const dealt = Math.max(3, Math.round(dmg * 0.52));
                  const prevDead = targetBot.eliminated || targetBot.downTimer > 0;
                  this.applyBotHitDamage(
                    targetBot,
                    dealt,
                    false,
                    bot.nick,
                    def.shortName,
                    isHead,
                    bx,
                    bz,
                  );
                  if (isSpectatedBot) {
                    this.hitmarkerTimer = 0.2;
                    if (isHead) {
                      this.headshotFlashTimer = 0.45;
                    }
                    this.getBotBodyPoint(targetBot, isHead ? 'head' : 'chest', _v2);
                    this.pushDamagePopup(_v2, dealt, isHead, armorBlocked);
                    soundEngine.playHitmarker();
                  }
                  if (!prevDead && (targetBot.eliminated || targetBot.downTimer > 0)) {
                    bot.kills += 1;
                    bot.hp = Math.min(bot.maxHp, bot.hp + 45);
                  }
                }
              }
            }
          }
        }
      } else {
        if (
          isBotPistol(bot.weaponId) &&
          bot.secondaryWeaponId &&
          !isBotPistol(bot.secondaryWeaponId) &&
          bot.reloadTimer <= 0
        ) {
          equipBotWeapon(bot, bot.secondaryWeaponId, false);
        }
        const curRoamSurf = this.sampleEntitySurface(bx, bz);
        let targetGoalX = bot.goalX;
        let targetGoalZ = bot.goalZ;
        if (
          !this.isBermudaMapActive() &&
          (bot.aiState === 'roam' || bot.aiState === 'loot') &&
          !curRoamSurf.onBridge
        ) {
          if (HAS_SENTOSA) {
            const onSentosaNow = Math.hypot(bx - SENTOSA_CENTER.x, bz - SENTOSA_CENTER.z) < 175;
            const goalOnSentosa = Math.hypot(targetGoalX - SENTOSA_CENTER.x, targetGoalZ - SENTOSA_CENTER.z) < 175;
            if (onSentosaNow !== goalOnSentosa) {
              const bridge = nearestBridgePos(bx, bz, 'sentosa');
              if (Math.hypot(bridge.x - bx, bridge.z - bz) < 220) {
                targetGoalX = bridge.x;
                targetGoalZ = bridge.z;
              }
            }
          }
          if (
            Math.sign(bz - riverCenterZ(bx)) !== Math.sign(targetGoalZ - riverCenterZ(targetGoalX))
          ) {
            const bridge = nearestBridgePos(bx, bz, 'river');
            if (Math.hypot(bridge.x - bx, bridge.z - bz) < 165 && Math.abs(bx - bridge.x) > 4.0) {
              targetGoalX = bridge.x;
              targetGoalZ = bridge.z;
            }
          }
        }
        const rawDist = Math.hypot(targetGoalX - bx, targetGoalZ - bz);
        const curWalkB = this.world.findBuildingNavZoneAt(bx, bz);
        const goalWalkB = this.world.findBuildingNavZoneAt(targetGoalX, targetGoalZ);
        if (rawDist > 1.4 || bot.escapeTimer > 0 || (curWalkB !== null && curWalkB !== goalWalkB)) {
          const goalFloorGuess =
            bot.aiState === 'loot'
              ? bot.goalY
              : bot.isAlly
                ? this.pos.y
                : bot.group.position.y;
          this.resolveSmartBuildingTarget(
            bot,
            bx,
            bot.group.position.y,
            bz,
            targetGoalX,
            targetGoalZ,
            goalFloorGuess,
          );
          const dx = this._botNavOut.x - bx;
          const dz = this._botNavOut.z - bz;
          const dist = Math.hypot(dx, dz) || 1;
          moveDirX = dx / dist;
          moveDirZ = dz / dist;
          isMoving = true;
          bot.group.rotation.y = lerpAngle(bot.group.rotation.y, Math.atan2(moveDirX, moveDirZ), 1 - Math.exp(-12 * dt));
        } else if (bot.aiState === 'loot') {
          for (let l = 0; l < this.world.loots.length; l++) {
            const loot = this.world.loots[l];
            if (loot.data.collected || loot.data.kind === 'deathbox') continue;
            const ldx = loot.data.x - bx;
            const ldz = loot.data.z - bz;
            if (Math.abs(ldx) > 2.8 || Math.abs(ldz) > 2.8) continue;
            if (Math.hypot(ldx, ldz) < 2.8) {
              loot.data.collected = true;
              loot.mesh.visible = false;
              if (loot.data.kind === 'medkit') {
                bot.medkits = Math.min(4, bot.medkits + 1);
              } else if (loot.data.kind === 'gloo') {
                bot.gloos = Math.min(4, bot.gloos + 1);
              } else if (loot.data.kind === 'grenade') {
                bot.grenades = Math.min(3, bot.grenades + (loot.data.grenadeAmount ?? 1));
              } else if (loot.data.kind === 'ammo') {
                bot.ammoCount += loot.data.ammoAmount ?? 30;
              } else if (loot.data.kind === 'coin') {
                bot.coins += loot.data.coinAmount ?? 100;
              } else if (loot.data.kind === 'scope' && loot.data.scopeType) {
                if (!bot.scopes.includes(loot.data.scopeType)) {
                  bot.scopes.push(loot.data.scopeType);
                }
              } else if (loot.data.kind === 'attachment' && loot.data.attachmentKind) {
                if (!bot.attachments.includes(loot.data.attachmentKind) && bot.attachments.length < 4) {
                  bot.attachments.push(loot.data.attachmentKind);
                }
              } else if (loot.data.kind === 'backpack' && loot.data.level) {
                if (loot.data.level > bot.backpackLevel) bot.backpackLevel = loot.data.level;
              } else if (loot.data.kind === 'weapon' && loot.data.weaponId) {
                giveBotLootedWeapon(bot, loot.data.weaponId);
              } else if (loot.data.kind === 'vest') {
                const lvl = loot.data.level ?? 1;
                if (lvl > bot.vestLevel) {
                  bot.vestLevel = lvl;
                  bot.vestMaxHp = lvl === 1 ? 100 : lvl === 2 ? 160 : 220;
                  bot.vestHp = bot.vestMaxHp;
                  if (bot.vestMesh) bot.vestMesh.visible = false;
                }
              } else if (loot.data.kind === 'helmet') {
                const lvl = loot.data.level ?? 1;
                if (lvl > bot.helmetLevel) {
                  bot.helmetLevel = lvl;
                  bot.helmetMaxHp = lvl === 1 ? 75 : lvl === 2 ? 120 : 180;
                  bot.helmetHp = bot.helmetMaxHp;
                  if (bot.helmetMesh) bot.helmetMesh.visible = false;
                }
              }
              break;
            }
          }
          bot.aiState = 'roam';
        }
      }

      // 3. Apply intelligent whisker-steered locomotion + OBB collision + smooth stairs/water
      const animateLimbs = isSpectatedBot || (inRenderRange && botCamDistSq < 48 * 48);
      let botGroundedNow = true;
      let botActualSpeed = 0;

      if (isMoving && !isCrouchingAction) {
        const curSurf = this.sampleEntitySurface(bx, bz);
        const distFromZoneNow =
          isPlaying && this.gameVariant !== 'gladiadores'
            ? Math.hypot(bx - this.zoneCurrentX, bz - this.zoneCurrentZ)
            : 0;
        const isZoneRunning =
          isPlaying &&
          this.gameVariant !== 'gladiadores' &&
          !bot.isAlly &&
          distFromZoneNow > this.zoneCurrentRadius * 0.85;
        botActualSpeed = curSurf.inWater
          ? bot.moveSpeed * 0.75
          : bot.isRetreating || isZoneRunning
            ? 4.55
            : bot.moveSpeed;
        const stepDist = botActualSpeed * dt;

        // Multi-ray OBB obstacle avoidance (keep forward line while mid-jump/vaulting over obstacle)
        let hitSill = false;
        if (bot.vaultTimer <= 0 && bot.vy === 0) {
          hitSill = this.steerBotDirection(
            bot,
            bx,
            bot.group.position.y,
            bz,
            moveDirX,
            moveDirZ,
            wantSteerWaterAvoid && !curSurf.inWater,
          );
          moveDirX = this._botNavOut.dirX;
          moveDirZ = this._botNavOut.dirZ;
        }
        if (bot.aiState !== 'combat' || bot.isRetreating) {
          bot.group.rotation.y = lerpAngle(
            bot.group.rotation.y,
            Math.atan2(moveDirX, moveDirZ),
            1 - Math.exp(-12 * dt),
          );
        }

        const botBounds = this.getActiveBounds();
        const islandBound = 540;
        let nx = THREE.MathUtils.clamp(bx + moveDirX * stepDist, botBounds.minX, botBounds.maxX);
        let nz = THREE.MathUtils.clamp(bz + moveDirZ * stepDist, botBounds.minZ, botBounds.maxZ);

        const rSq = nx * nx + nz * nz;
        if (botBounds.useIslandRadial && rSq > islandBound * islandBound) {
          const invR = islandBound / Math.sqrt(rSq);
          nx *= invR;
          nz *= invR;
          bot.goalX = 0;
          bot.goalZ = 0;
        }

        const nextSurf = this.sampleEntitySurface(nx, nz);
        if (curSurf.inWater) {
          // Never freeze in water: wade smoothly and steer goal onto nearest dry ground
          bot.group.position.x = nx;
          bot.group.position.z = nz;
          if (nextSurf.inWater) {
            if (botBounds.useIslandRadial && rSq > 515 * 515) {
              bot.goalX = bx * 0.65;
              bot.goalZ = bz * 0.65;
            } else {
              const northSurf = this.sampleEntitySurface(bx, bz + 20);
              const southSurf = this.sampleEntitySurface(bx, bz - 20);
              if (!northSurf.inWater && southSurf.inWater) {
                bot.goalX = bx;
                bot.goalZ = bz + 24;
              } else if (!southSurf.inWater && northSurf.inWater) {
                bot.goalX = bx;
                bot.goalZ = bz - 24;
              } else if (northSurf.y >= southSurf.y) {
                bot.goalX = bx;
                bot.goalZ = bz + 24;
              } else {
                bot.goalX = bx;
                bot.goalZ = bz - 24;
              }
            }
          }
        } else if (nextSurf.inWater && (bot.aiState === 'roam' || bot.aiState === 'loot')) {
          const tx = THREE.MathUtils.clamp(bx + moveDirX * stepDist * 0.85, botBounds.minX, botBounds.maxX);
          const tz = THREE.MathUtils.clamp(bz + moveDirZ * stepDist * 0.85, botBounds.minZ, botBounds.maxZ);
          const surfX = this.sampleEntitySurface(tx, bz);
          const surfZ = this.sampleEntitySurface(bx, tz);
          if (!surfX.inWater && Math.abs(tx - bx) > 0.005) {
            bot.group.position.x = tx;
            bot.group.position.z = bz;
          } else if (!surfZ.inWater && Math.abs(tz - bz) > 0.005) {
            bot.group.position.x = bx;
            bot.group.position.z = tz;
          } else {
            bot.group.position.x = nx;
            bot.group.position.z = nz;
          }
        } else {
          bot.group.position.x = nx;
          bot.group.position.z = nz;
        }

        // Exact same 2-pass OBB wall/prop/vehicle/gloo collision sliding & floor platforms as the player!
        const ignoreSill = bot.vaultTimer > 0;
        const push1 = this.resolveEntityHorizontalCollisions(bot.group.position, 0.36, null, ignoreSill);
        const push2 = this.resolveEntityHorizontalCollisions(bot.group.position, 0.36, null, ignoreSill);
        bot.group.position.x = THREE.MathUtils.clamp(bot.group.position.x, botBounds.minX, botBounds.maxX);
        bot.group.position.z = THREE.MathUtils.clamp(bot.group.position.z, botBounds.minZ, botBounds.maxZ);

        const botFloorRaw = this.resolveFloorHeight(
          bot.group.position.x,
          bot.group.position.z,
          bot.group.position.y,
        );
        const isIsolated =
          this.isInWaitLobbyArea(bot.group.position.x, bot.group.position.z) ||
          this.isInGladiadoresArea(bot.group.position.x, bot.group.position.z);
        const floorY = isIsolated
          ? botFloorRaw
          : nextSurf.inWater && !nextSurf.onBridge
            ? Math.max(botFloorRaw, this.getDeepWaterMinY())
            : Math.max(this.getDryMinFloorY(), botFloorRaw);
        if (bot.vy > 0 || bot.group.position.y > floorY + 0.25) {
          bot.vy -= 20.5 * dt;
          bot.group.position.y += bot.vy * dt;
          if (bot.group.position.y <= floorY) {
            bot.group.position.y = floorY;
            bot.vy = 0;
            botGroundedNow = true;
            bot.animator?.triggerLanding();
          } else {
            botGroundedNow = false;
          }
        } else {
          bot.group.position.y = floorY;
          bot.vy = 0;
          botGroundedNow = true;
        }

        // Rolling progress monitor + jump-forward over obstacles & unstuck recovery
        const actualMoved = Math.hypot(bot.group.position.x - bx, bot.group.position.z - bz);
        bot.navCheckTimer += dt;
        let stalledThisTick = push1 + push2 > 0.018 || actualMoved < stepDist * 0.45;
        if (bot.navCheckTimer >= 0.85) {
          const netMoved = Math.hypot(
            bot.group.position.x - bot.navCheckX,
            bot.group.position.z - bot.navCheckZ,
          );
          if (netMoved < 0.85) {
            stalledThisTick = true;
            bot.stuckTimer += 0.55;
          } else if (netMoved >= 1.1 && push1 + push2 < 0.01) {
            bot.stuckTimer = Math.max(0, bot.stuckTimer - 0.35);
          }
          bot.navCheckX = bot.group.position.x;
          bot.navCheckZ = bot.group.position.z;
          bot.navCheckTimer = 0;
        }

        if (stalledThisTick) {
          bot.stuckTimer += dt;
          // Jump & keep pushing forward whenever blocked by an obstacle (crates, fences, sills, rocks, curbs)
          if (
            (hitSill || bot.stuckTimer > 0.16) &&
            botGroundedNow &&
            bot.vy === 0 &&
            (bot.jumpCooldown ?? 0) <= 0
          ) {
            bot.vy = 7.6;
            bot.vaultTimer = 0.62;
            bot.jumpCooldown = 0.95;
            bot.group.position.y += 0.08;
            botGroundedNow = false;
          }
          // Stage 1: flip steer side / drop blocked loot target
          if (bot.stuckTimer > 0.38) {
            if (bot.steerLockTimer <= 0) {
              bot.steerSign = bot.steerSign === 1 ? -1 : 1;
              bot.steerLockTimer = 1.05;
            }
            if (bot.aiState === 'loot') {
              for (let l = 0; l < this.world.loots.length; l++) {
                const ld = this.world.loots[l].data;
                if (!ld.collected && Math.hypot(ld.x - bot.goalX, ld.z - bot.goalZ) < 1.0) {
                  bot.badLootId = ld.id;
                  bot.badLootTimer = 10;
                  break;
                }
              }
              bot.aiState = 'roam';
            }
          }
          // Stage 2: building doorway escape if inside a building
          if (bot.stuckTimer > 0.75) {
            const stuckBldg = this.world.findBuildingNavZoneAt(
              bot.group.position.x,
              bot.group.position.z,
            );
            if (stuckBldg && stuckBldg.doors.length > 0 && bot.escapeTimer <= 0) {
              let bestD = stuckBldg.doors[0];
              let bestDist = Infinity;
              for (let k = 0; k < stuckBldg.doors.length; k++) {
                const d = stuckBldg.doors[k];
                const dd = Math.hypot(d.inX - bot.group.position.x, d.inZ - bot.group.position.z);
                if (dd < bestDist) {
                  bestDist = dd;
                  bestD = d;
                }
              }
              bot.escapeDoorX = bestD.outX;
              bot.escapeDoorZ = bestD.outZ;
              bot.escapeTimer = 2.6;
            }
          }
          // Stage 3 (faster for allies at 0.95s, bots at 1.25s): clear exit from building or "cola" spot
          const stage3Limit = bot.isAlly ? 0.95 : 1.25;
          if (bot.stuckTimer > stage3Limit) {
            const stuckB = this.world.findBuildingNavZoneAt(
              bot.group.position.x,
              bot.group.position.z,
            );
            if (stuckB) {
              const on2F =
                stuckB.secondFloorY !== undefined &&
                bot.group.position.y >= stuckB.baseY + 2.0 &&
                stuckB.stairTop &&
                stuckB.stairBottom;
              if (on2F && stuckB.stairTop && stuckB.stairBottom) {
                const targetX = stuckB.stairBottom.x;
                const targetZ = stuckB.stairBottom.z;
                bot.group.position.set(
                  targetX,
                  Math.max(this.getDryMinFloorY(), this.resolveFloorHeight(targetX, targetZ, stuckB.baseY + 0.4)),
                  targetZ,
                );
                bot.escapeTimer = 2.6;
              } else if (stuckB.doors.length > 0) {
                let bestD = stuckB.doors[0];
                let bestDDist = Infinity;
                for (let k = 0; k < stuckB.doors.length; k++) {
                  const d = stuckB.doors[k];
                  const dd = Math.hypot(d.inX - bot.group.position.x, d.inZ - bot.group.position.z);
                  if (dd < bestDDist) {
                    bestDDist = dd;
                    bestD = d;
                  }
                }
                if (bot.isAlly || bot.escapeTimer > 0) {
                  bot.group.position.set(
                    bestD.outX,
                    Math.max(this.getDryMinFloorY(), this.resolveFloorHeight(bestD.outX, bestD.outZ, stuckB.baseY + 0.4)),
                    bestD.outZ,
                  );
                  bot.escapeTimer = 0;
                  bot.goalX = bestD.outX;
                  bot.goalZ = bestD.outZ;
                } else {
                  bot.escapeDoorX = bestD.outX;
                  bot.escapeDoorZ = bestD.outZ;
                  bot.escapeTimer = 2.6;
                  const nd = Math.hypot(bestD.inX - bot.group.position.x, bestD.inZ - bot.group.position.z) || 1;
                  bot.group.position.x += ((bestD.inX - bot.group.position.x) / nd) * Math.min(1.0, nd);
                  bot.group.position.z += ((bestD.inZ - bot.group.position.z) / nd) * Math.min(1.0, nd);
                }
              }
              this.resolveEntityHorizontalCollisions(bot.group.position, 0.36, null, false);
            } else {
              let relocated = false;
              if (bot.isAlly && isPlaying) {
                for (let aTry = 0; aTry < 8; aTry++) {
                  const ang = (aTry * Math.PI) / 4 + this.yaw;
                  const rx = THREE.MathUtils.clamp(this.pos.x + Math.sin(ang) * 5.2, botBounds.minX, botBounds.maxX);
                  const rz = THREE.MathUtils.clamp(this.pos.z + Math.cos(ang) * 5.2, botBounds.minZ, botBounds.maxZ);
                  if (!this.sampleEntitySurface(rx, rz).inWater && !this.isPointBlockedForBot(rx, this.pos.y, rz, 0.55)) {
                    bot.group.position.set(
                      rx,
                      Math.max(this.getDryMinFloorY(), this.resolveFloorHeight(rx, rz, this.pos.y + 0.5)),
                      rz,
                    );
                    bot.goalX = rx;
                    bot.goalZ = rz;
                    relocated = true;
                    break;
                  }
                }
              }
              if (!relocated) {
                const esc = this.findClearestEscapeVector(
                  bot.group.position.x,
                  bot.group.position.y,
                  bot.group.position.z,
                );
                bot.group.position.x = THREE.MathUtils.clamp(
                  bot.group.position.x + esc.x * 1.45,
                  botBounds.minX,
                  botBounds.maxX,
                );
                bot.group.position.z = THREE.MathUtils.clamp(
                  bot.group.position.z + esc.z * 1.45,
                  botBounds.minZ,
                  botBounds.maxZ,
                );
                this.resolveEntityHorizontalCollisions(bot.group.position, 0.36, null, false);
                bot.goalX = THREE.MathUtils.clamp(bot.group.position.x + esc.x * 12, botBounds.minX, botBounds.maxX);
                bot.goalZ = THREE.MathUtils.clamp(bot.group.position.z + esc.z * 12, botBounds.minZ, botBounds.maxZ);
              }
            }
            bot.navCheckX = bot.group.position.x;
            bot.navCheckZ = bot.group.position.z;
            bot.navCheckTimer = 0;
            bot.stuckTimer = 0;
            bot.huntTimer = 0;
            bot.aiTimer = 0;
          }
        }
      } else {
        const idleSurf = this.sampleEntitySurface(bot.group.position.x, bot.group.position.z);
        const botFloorRaw = this.resolveFloorHeight(
          bot.group.position.x,
          bot.group.position.z,
          bot.group.position.y,
        );
        const isIdleIsolated =
          this.isInWaitLobbyArea(bot.group.position.x, bot.group.position.z) ||
          this.isInGladiadoresArea(bot.group.position.x, bot.group.position.z);
        const floorY = isIdleIsolated
          ? botFloorRaw
          : idleSurf.inWater && !idleSurf.onBridge
            ? Math.max(botFloorRaw, this.getDeepWaterMinY())
            : Math.max(this.getDryMinFloorY(), botFloorRaw);
        bot.group.position.y = floorY;
        bot.vy = 0;
        botGroundedNow = true;
      }

      const botSurfNow = this.sampleEntitySurface(bot.group.position.x, bot.group.position.z);
      const botInWater = botSurfNow.inWater && !botSurfNow.onBridge;

      if (animateLimbs && bot.rig && bot.animator) {
        const botIsHealing = bot.aiState === 'heal';
        const botIsReviving = bot.aiState === 'revive' && isCrouchingAction;
        const botIsReloading = bot.reloadTimer > 0;
        const botIsAiming =
          bot.aiState === 'combat' &&
          !bot.isRetreating &&
          !isMoving &&
          !botIsHealing &&
          !botIsReviving &&
          !botIsReloading &&
          !botInWater;
        const botIsSprinting =
          botActualSpeed > 3.9 && !botInWater && !botIsHealing && !botIsReviving;
        const botWeaponCat = WEAPONS[bot.weaponId]?.category ?? null;
        bot.rig.weaponMount.visible = !botInWater && !botIsHealing && !botIsReviving;

        const runFullRate =
          bot.isAlly || isSpectatedBot || animatedBotCount < maxFullAnimBots || botCamDistSq < 28 * 28;
        let stepDt = dt;
        if (runFullRate) {
          stepDt += bot.animAccum ?? 0;
          bot.animAccum = 0;
          animatedBotCount++;
        } else {
          bot.animAccum = (bot.animAccum ?? 0) + dt;
          if (bot.animAccum < 0.08) continue;
          stepDt = bot.animAccum;
          bot.animAccum = 0;
        }

        bot.animator.update(bot.rig, {
          dt: stepDt,
          speed: botActualSpeed,
          stance: 'stand',
          isGrounded: botGroundedNow,
          isSprinting: botIsSprinting,
          isAiming: botIsAiming,
          isFiring: botIsAiming && bot.fireCooldown > 0.12,
          isReloading: botIsReloading,
          isHealing: botIsHealing,
          isReviving: botIsReviving,
          isDriving: false,
          isSwimming: botInWater,
          isOnSurfboard: false,
          isLobby: false,
          isSkydiving: false,
          isParachuting: false,
          isDead: false,
          isDowned: false,
          hasWeapon: !botInWater,
          hasMoveInput: botActualSpeed > 0.35,
          weaponCategory: botInWater ? null : botWeaponCat,
          pitchRad: 0,
        });
      }
    }
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    let slot: BulletTracer | undefined;
    for (let i = 0; i < this.tracerPool.length; i++) {
      if (!this.tracerPool[i].active) {
        slot = this.tracerPool[i];
        break;
      }
    }
    if (!slot) slot = this.tracerPool[0];
    slot.active = true;
    slot.life = 0.07;
    slot.mesh.visible = true;
    slot.mesh.position.copy(from).lerp(to, 0.25);
    slot.mesh.lookAt(to);
  }

  private updateTracers(dt: number): void {
    for (let i = 0; i < this.tracerPool.length; i++) {
      const tr = this.tracerPool[i];
      if (!tr.active) continue;
      tr.life -= dt;
      tr.mesh.translateZ(dt * 190);
      if (tr.life <= 0) {
        tr.active = false;
        tr.mesh.visible = false;
      }
    }
  }

  private clearAirDrops(): void {
    for (let i = 0; i < this.airDrops.length; i++) {
      const ad = this.airDrops[i];
      this.world.scene.remove(ad.group);
      this.world.scene.remove(ad.beaconBeam);
      this.world.scene.remove(ad.beaconRing);
      ad.beaconMat.dispose();
      ad.ringMat.dispose();
    }
    this.airDrops = [];
  }

  private spawnAirDrop(): void {
    const abDrop = this.getActiveBounds();
    const isBermuda = this.isBermudaMapActive();
    const safeR = Math.min(Math.max(30, this.zoneCurrentRadius * 0.72), isBermuda ? 720 : 450);
    let ax = this.zoneCurrentX;
    let az = this.zoneCurrentZ;
    const minDropY = isBermuda ? BERMUDA_GLB_WATER_Y + 0.45 : 1.2;
    let groundY = Math.max(this.getDryMinFloorY() + 0.5, this.world.groundHeightAt(ax, az));
    for (let attempt = 0; attempt < 16; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * safeR;
      const cx = THREE.MathUtils.clamp(this.zoneCurrentX + Math.cos(ang) * dist, abDrop.minX + 20, abDrop.maxX - 20);
      const cz = THREE.MathUtils.clamp(this.zoneCurrentZ + Math.sin(ang) * dist, abDrop.minZ + 20, abDrop.maxZ - 20);
      const gy = this.world.groundHeightAt(cx, cz);
      if (gy >= minDropY) {
        ax = cx;
        az = cz;
        groundY = gy;
        break;
      }
    }

    const startY = groundY + 115;
    const group = new THREE.Group();
    group.position.set(ax, startY, az);

    const crateMesh = new THREE.Mesh(this.airDropCrateGeo, this.airDropCrateMat);
    crateMesh.position.y = 0.675;
    const airShadowLv =
      this.settings.shadowQuality ?? defaultShadowForQuality(this.settings.quality);
    const dropShadow = !this.isSoftwareGl && airShadowLv !== 'off';
    crateMesh.castShadow = dropShadow;
    crateMesh.receiveShadow = dropShadow;

    const stripeMesh = new THREE.Mesh(this.airDropStripeGeo, this.airDropStripeMat);
    stripeMesh.position.y = 0.92;
    group.add(crateMesh, stripeMesh);

    const chuteGroup = new THREE.Group();
    const dome = new THREE.Mesh(this.airDropChuteGeo, this.airDropChuteMat);
    dome.position.y = 3.9;
    chuteGroup.add(dome);
    const cordOffsets = [
      [-0.65, -0.65, 0.22, -0.22],
      [0.65, -0.65, -0.22, -0.22],
      [-0.65, 0.65, 0.22, 0.22],
      [0.65, 0.65, -0.22, 0.22],
    ];
    for (let i = 0; i < cordOffsets.length; i++) {
      const [cx, cz, rx, rz] = cordOffsets[i];
      const cord = new THREE.Mesh(this.airDropCordGeo, this.airDropCordMat);
      cord.position.set(cx, 2.55, cz);
      cord.rotation.z = rx;
      cord.rotation.x = rz;
      chuteGroup.add(cord);
    }
    group.add(chuteGroup);
    this.world.scene.add(group);

    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beaconBeam = new THREE.Mesh(this.airDropBeamGeo, beaconMat);
    beaconBeam.position.set(ax, groundY + 82, az);
    this.world.scene.add(beaconBeam);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beaconRing = new THREE.Mesh(this.airDropRingGeo, ringMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.set(ax, groundY + 0.08, az);
    beaconRing.visible = false;
    this.world.scene.add(beaconRing);

    this.airDrops.push({
      id: `airdrop_${this.nextAirDropId++}`,
      x: ax,
      z: az,
      y: startY,
      groundY,
      state: 'falling',
      group,
      chuteGroup,
      beaconBeam,
      beaconRing,
      beaconMat,
      ringMat,
    });

    this.airDropCountSpawned += 1;
    this.airDropNotice = 'AIRDROP A CAMINHO!';
    this.airDropNoticeTimer = 4.5;
    soundEngine.playParachuteOpen();
  }

  private updateAirDrops(dt: number): void {
    if (this.airDropNoticeTimer > 0) {
      this.airDropNoticeTimer -= dt;
      if (this.airDropNoticeTimer <= 0) {
        this.airDropNotice = null;
      }
    }

    this.airDropSpawnTimer -= dt;
    if (this.airDropSpawnTimer <= 0 && this.airDropCountSpawned < 5) {
      this.spawnAirDrop();
      this.airDropSpawnTimer = 52;
    }

    for (let i = 0; i < this.airDrops.length; i++) {
      const ad = this.airDrops[i];
      if (ad.state === 'falling') {
        ad.y -= 12.5 * dt;
        ad.group.rotation.y += dt * 0.28;
        ad.group.rotation.z = Math.sin(this.elapsed * 2.1 + i) * 0.06;
        if (ad.y <= ad.groundY) {
          ad.y = ad.groundY;
          ad.state = 'landed';
          ad.chuteGroup.visible = false;
          ad.group.rotation.z = 0;
          this.airDropNotice = 'AIRDROP CAIU NA ILHA!';
          this.airDropNoticeTimer = 4.0;
          if (Math.hypot(ad.x - this.pos.x, ad.z - this.pos.z) < 75) {
            soundEngine.playLanding();
          }
        }
        ad.group.position.set(ad.x, ad.y, ad.z);
      }

      if (ad.state !== 'falling' && ad.state !== 'landed') {
        ad.beaconBeam.visible = false;
        ad.beaconRing.visible = false;
      }
    }
  }

  private findNearbyAirDrop(): AirDropCrate | null {
    for (let i = 0; i < this.airDrops.length; i++) {
      const ad = this.airDrops[i];
      if (ad.state !== 'landed') continue;
      const d = Math.hypot(ad.x - this.pos.x, ad.z - this.pos.z);
      if (d < 3.2 && Math.abs(ad.y - this.pos.y) < 2.6) return ad;
    }
    return null;
  }

  private collectAirDrop(ad: AirDropCrate): void {
    ad.state = 'looted';
    ad.beaconBeam.visible = false;
    ad.beaconRing.visible = false;
    soundEngine.playPickup();

    // High-tier Level 3 Armor & Backpack + 200 FF Coins
    this.ffCoins += 200;
    this.vestLevel = 3;
    this.vestMaxHp = 220;
    this.vestHp = 220;
    this.helmetLevel = 3;
    this.helmetMaxHp = 180;
    this.helmetHp = 180;
    this.backpackLevel = 3;

    // Medkits, Gloos & Grenades
    this.medkitCount += 2;
    this.glooCount = Math.min(8, this.glooCount + 2);
    this.grenadeCount = Math.min(6, this.grenadeCount + 1);

    // 4x Scope
    if (!this.ownedScopes.includes('4x')) {
      this.ownedScopes.push('4x');
    }

    // Grant AWM-17 if player doesn't have one yet, otherwise fully kitted M4-17 / ammo boost
    const hasAwm =
      this.weapons[1]?.weaponId === 'awm' || this.weapons[2]?.weaponId === 'awm';
    const grantWeaponId: WeaponId = hasAwm ? 'm4a1' : 'awm';
    const def = WEAPONS[grantWeaponId];
    const hasBothSlots = Boolean(this.weapons[1] && this.weapons[2]);
    let targetSlot: 1 | 2 = !this.weapons[1] ? 1 : !this.weapons[2] ? 2 : this.activeSlot === 2 ? 2 : 1;

    if (hasAwm && this.weapons[1]?.weaponId === 'm4a1') {
      this.weapons[1]!.reserveAmmo += 90;
      targetSlot = 1;
    } else if (hasAwm && this.weapons[2]?.weaponId === 'm4a1') {
      this.weapons[2]!.reserveAmmo += 90;
      targetSlot = 2;
    } else {
      if (hasBothSlots && this.weapons[targetSlot]) {
        const oldW = this.weapons[targetSlot]!;
        this.spawnItemInFront({
          kind: 'weapon',
          weaponId: oldW.weaponId,
          label: WEAPONS[oldW.weaponId].name,
        });
      }
      this.weapons[targetSlot] = {
        weaponId: grantWeaponId,
        ammoInMag: grantWeaponId === 'm4a1' ? Math.round(def.magSize * 1.35) : def.magSize,
        reserveAmmo: grantWeaponId === 'awm' ? 30 : def.magSize * 5,
        scope: grantWeaponId === 'awm' ? 'sniper' : '4x',
        attachments: {
          muzzle: 'silencer',
          foregrip: grantWeaponId === 'awm' ? null : 'grip',
          magazine: 'ext_mag',
          stock: 'stock',
        },
      };
      this.activeSlot = targetSlot;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.syncPlayerWeaponAndBackVisuals();
      this.animator.triggerWeaponDraw();
    }

    this.airDropNotice = hasAwm ? 'AIRDROP SAQUEADO (COLETE NV.3 + M4)!' : 'AIRDROP SAQUEADO (AWM + NV.3)!';
    this.airDropNoticeTimer = 3.2;
  }

  public collectLootById(id: string): void {
    if (this.isDead || this.isPlayerDowned) return;
    if (id.startsWith('airdrop_')) {
      const ad = this.airDrops.find((a) => a.id === id && a.state === 'landed');
      if (ad) this.collectAirDrop(ad);
      return;
    }
    const sepIdx = id.indexOf('::');
    if (sepIdx > 0) {
      const boxId = id.slice(0, sepIdx);
      const entryId = id.slice(sepIdx + 2);
      const box = this.world.loots.find((l) => l.data.id === boxId && !l.data.collected);
      if (box && box.data.deathEntries) {
        const eIdx = box.data.deathEntries.findIndex((e) => e.id === entryId);
        if (eIdx >= 0) {
          const [entry] = box.data.deathEntries.splice(eIdx, 1);
          this.applySingleDeathBoxEntry(entry);
          if (box.data.deathEntries.length === 0) {
            box.data.collected = true;
            box.mesh.visible = false;
          }
        }
      }
      return;
    }
    const lv = this.world.loots.find((l) => l.data.id === id && !l.data.collected);
    if (lv) {
      this.applyLootVisualPickup(lv);
    }
  }

  private tryPickupNearbyLoot(): void {
    if (this.isDead || this.isPlayerDowned) return;
    const airDrop = this.findNearbyAirDrop();
    if (airDrop) {
      this.collectAirDrop(airDrop);
      return;
    }
    const nearby = this.findNearbyLoot();
    if (nearby) {
      if (nearby.data.kind === 'deathbox' && nearby.data.deathEntries && nearby.data.deathEntries.length > 0) {
        this.collectLootById(`${nearby.data.id}::${nearby.data.deathEntries[0].id}`);
      } else {
        this.applyLootVisualPickup(nearby);
      }
    }
  }

  private shouldAutoCollectLootItem(item: {
    kind: string;
    weaponId?: WeaponId;
    level?: 1 | 2 | 3;
    scopeType?: ScopeType;
    attachmentKind?: AttachmentKind;
  }): boolean {
    switch (item.kind) {
      case 'coin':
        return true;
      case 'medkit':
        return this.getBackpackUsedWeight() + 12 <= this.getBackpackCapacity();
      case 'smallkit':
        return this.getBackpackUsedWeight() + 6 <= this.getBackpackCapacity();
      case 'gloo':
        return this.glooCount < 8;
      case 'grenade':
        return this.grenadeCount < 6;
      case 'ammo':
        return !!(this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2] ?? this.weapons[3]);
      case 'vest': {
        const lvl = item.level ?? 1;
        const maxV = lvl === 1 ? 100 : lvl === 2 ? 160 : 220;
        return lvl > this.vestLevel || (lvl === this.vestLevel && this.vestHp < maxV);
      }
      case 'helmet': {
        const lvl = item.level ?? 1;
        const maxH = lvl === 1 ? 75 : lvl === 2 ? 120 : 180;
        return lvl > this.helmetLevel || (lvl === this.helmetLevel && this.helmetHp < maxH);
      }
      case 'backpack':
        return (item.level ?? 1) > this.backpackLevel;
      case 'weapon': {
        if (!item.weaponId) return false;
        const def = WEAPONS[item.weaponId];
        if (def.category === 'HG') return !this.weapons[3];
        return !this.weapons[1] || !this.weapons[2];
      }
      case 'scope': {
        if (!item.scopeType) return false;
        const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2];
        if (w && WEAPONS[w.weaponId].allowsCustomScope && w.scope === 'none') return true;
        return !this.ownedScopes.includes(item.scopeType);
      }
      case 'attachment': {
        if (!item.attachmentKind) return false;
        const slotKey = ATTACHMENT_LABELS[item.attachmentKind].slot;
        const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2];
        return !!(w && WEAPONS[w.weaponId].allowsAttachments && !w.attachments[slotKey]);
      }
      default:
        return false;
    }
  }

  private updateAutoLoot(dt: number): void {
    if (
      !this.settings.autoLoot ||
      this.isDead ||
      this.isPlayerDowned ||
      this.activeVehicleId ||
      this.revivingBotId ||
      this.usingMedkit
    ) {
      return;
    }

    this.autoLootTimer -= dt;
    if (this.autoLootTimer > 0) return;

    const interval =
      this.settings.autoLootSpeed === 'ultra'
        ? 0.06
        : this.settings.autoLootSpeed === 'fast'
          ? 0.20
          : 0.45;
    this.autoLootTimer = interval;

    for (let i = 0; i < this.world.loots.length; i++) {
      const l = this.world.loots[i];
      if (l.data.collected) continue;
      const dx = l.data.x - this.pos.x;
      const dz = l.data.z - this.pos.z;
      if (Math.abs(dx) > 2.6 || Math.abs(dz) > 2.6) continue;
      if (Math.hypot(dx, dz) > 2.6 || Math.abs(l.data.y - this.pos.y) >= 2.4) continue;

      if (l.data.kind === 'deathbox' && l.data.deathEntries && l.data.deathEntries.length > 0) {
        for (let e = 0; e < l.data.deathEntries.length; e++) {
          const entry = l.data.deathEntries[e];
          if (this.shouldAutoCollectLootItem(entry)) {
            this.collectLootById(`${l.data.id}::${entry.id}`);
            return;
          }
        }
        continue;
      }

      if (this.shouldAutoCollectLootItem(l.data)) {
        this.applyLootVisualPickup(l);
        return;
      }
    }
  }

  private applySingleDeathBoxEntry(entry: DeathBoxItemEntry): void {
    if (entry.kind === 'coin') {
      this.ffCoins += entry.coinAmount ?? 100;
      soundEngine.playCoinPickup();
      return;
    }
    soundEngine.playPickup();

    if (entry.kind === 'medkit') {
      const q = entry.medkitAmount ?? 1;
      for (let k = 0; k < q; k++) {
        if (this.getBackpackUsedWeight() + 12 <= this.getBackpackCapacity()) {
          this.medkitCount += 1;
        } else {
          this.hp = Math.min(this.maxHp, this.hp + 35);
        }
      }
    } else if (entry.kind === 'smallkit') {
      const q = entry.smallkitAmount ?? 1;
      for (let k = 0; k < q; k++) {
        if (this.getBackpackUsedWeight() + 6 <= this.getBackpackCapacity()) {
          this.smallkitCount += 1;
        } else {
          this.hp = Math.min(this.maxHp, this.hp + 25);
        }
      }
    } else if (entry.kind === 'gloo') {
      this.glooCount = Math.min(8, this.glooCount + (entry.glooAmount ?? 1));
    } else if (entry.kind === 'grenade') {
      this.grenadeCount = Math.min(6, this.grenadeCount + (entry.grenadeAmount ?? 1));
    } else if (entry.kind === 'ammo') {
      const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2] ?? this.weapons[3];
      if (w) w.reserveAmmo += entry.ammoAmount ?? 30;
    } else if (entry.kind === 'vest' && entry.level) {
      const lvl = entry.level;
      const maxV = lvl === 1 ? 100 : lvl === 2 ? 160 : 220;
      if (lvl > this.vestLevel || (lvl === this.vestLevel && this.vestHp < maxV)) {
        this.vestLevel = lvl;
        this.vestMaxHp = maxV;
        this.vestHp = maxV;
      }
    } else if (entry.kind === 'helmet' && entry.level) {
      const lvl = entry.level;
      const maxH = lvl === 1 ? 75 : lvl === 2 ? 120 : 180;
      if (lvl > this.helmetLevel || (lvl === this.helmetLevel && this.helmetHp < maxH)) {
        this.helmetLevel = lvl;
        this.helmetMaxHp = maxH;
        this.helmetHp = maxH;
      }
    } else if (entry.kind === 'backpack' && entry.level) {
      if (entry.level > this.backpackLevel) {
        this.backpackLevel = entry.level;
      }
    } else if (entry.kind === 'scope' && entry.scopeType) {
      const st = entry.scopeType;
      if (!this.ownedScopes.includes(st)) this.ownedScopes.push(st);
      const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2];
      if (w && WEAPONS[w.weaponId].allowsCustomScope && w.scope === 'none') {
        w.scope = st;
      } else {
        this.addScopeToBackpack(st);
      }
    } else if (entry.kind === 'attachment' && entry.attachmentKind) {
      const att = entry.attachmentKind;
      const slotKey = ATTACHMENT_LABELS[att].slot;
      const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2];
      if (w && WEAPONS[w.weaponId].allowsAttachments && !w.attachments[slotKey]) {
        (w.attachments as Record<AttachmentSlotKey, AttachmentKind | null>)[slotKey] = att;
      } else {
        this.addAttachmentToBackpack(att);
      }
    } else if (entry.kind === 'weapon' && entry.weaponId) {
      const wid = entry.weaponId;
      const def = WEAPONS[wid];
      if (def.category === 'HG') {
        if (this.weapons[3] && this.weapons[3]!.weaponId === wid) {
          this.weapons[3]!.reserveAmmo += 30;
        } else {
          if (this.weapons[3]) {
            const oldW = this.weapons[3]!;
            this.spawnItemInFront({
              kind: 'weapon',
              weaponId: oldW.weaponId,
              label: WEAPONS[oldW.weaponId].name,
            });
          }
          this.weapons[3] = {
            weaponId: wid,
            ammoInMag: def.magSize,
            reserveAmmo: 45,
            scope: 'none',
            attachments: emptyAttachments(),
          };
          this.activeSlot = 3;
          this.isAiming = false;
          this.input.setTouchAim(false);
          this.isReloading = false;
          this.reloadTimer = 0;
          this.syncPlayerWeaponAndBackVisuals();
          this.animator.triggerWeaponDraw();
          soundEngine.playWeaponSwitch();
        }
        return;
      }
      let targetSlot: 1 | 2 = 1;
      if (!this.weapons[1]) targetSlot = 1;
      else if (!this.weapons[2]) targetSlot = 2;
      else {
        targetSlot = this.activeSlot === 2 ? 2 : 1;
        const oldW = this.weapons[targetSlot]!;
        this.spawnItemInFront({
          kind: 'weapon',
          weaponId: oldW.weaponId,
          label: WEAPONS[oldW.weaponId].name,
        });
      }
      this.weapons[targetSlot] = {
        weaponId: wid,
        ammoInMag: def.magSize,
        reserveAmmo: def.magSize * 4,
        scope: def.defaultScope,
        attachments: emptyAttachments(),
      };
      this.activeSlot = targetSlot;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.syncPlayerWeaponAndBackVisuals();
      this.animator.triggerWeaponDraw();
      soundEngine.playWeaponSwitch();
    }
  }

  private applyLootVisualPickup(nearby: LootVisual): void {
    const ld = nearby.data;
    if (ld.collected) return;
    ld.collected = true;
    nearby.mesh.visible = false;
    if (this.onlineRoomId && ld.id) {
      this.syncedServerLootIds.add(ld.id);
      this.queueOrSendRoomAction({ type: 'collect_loot', lootId: ld.id });
    }

    if (ld.kind === 'coin') {
      this.ffCoins += ld.coinAmount ?? 100;
      soundEngine.playCoinPickup();
      return;
    }

    soundEngine.playPickup();

    if (ld.kind === 'medkit') {
      if (this.getBackpackUsedWeight() + 12 <= this.getBackpackCapacity()) {
        this.medkitCount += 1;
      } else {
        this.hp = Math.min(this.maxHp, this.hp + 35);
      }
      return;
    }

    if (ld.kind === 'smallkit') {
      if (this.getBackpackUsedWeight() + 6 <= this.getBackpackCapacity()) {
        this.smallkitCount += 1;
      } else {
        this.hp = Math.min(this.maxHp, this.hp + 25);
      }
      return;
    }

    if (ld.kind === 'ammo') {
      const amt = ld.ammoAmount ?? 30;
      const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2] ?? this.weapons[3];
      if (w) w.reserveAmmo += amt;
      return;
    }

    if (ld.kind === 'vest') {
      const lvl = ld.level ?? 1;
      const maxV = lvl === 1 ? 100 : lvl === 2 ? 160 : 220;
      if (lvl > this.vestLevel || (lvl === this.vestLevel && this.vestHp < maxV)) {
        this.vestLevel = lvl;
        this.vestMaxHp = maxV;
        this.vestHp = maxV;
      }
      return;
    }

    if (ld.kind === 'helmet') {
      const lvl = ld.level ?? 1;
      const maxH = lvl === 1 ? 75 : lvl === 2 ? 120 : 180;
      if (lvl > this.helmetLevel || (lvl === this.helmetLevel && this.helmetHp < maxH)) {
        this.helmetLevel = lvl;
        this.helmetMaxHp = maxH;
        this.helmetHp = maxH;
      }
      return;
    }

    if (ld.kind === 'backpack') {
      const lvl = ld.level ?? 2;
      if (lvl > this.backpackLevel) {
        this.backpackLevel = lvl;
      }
      return;
    }

    if (ld.kind === 'scope' && ld.scopeType) {
      const st = ld.scopeType;
      if (!this.ownedScopes.includes(st)) {
        this.ownedScopes.push(st);
      }
      const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2];
      if (w && WEAPONS[w.weaponId].allowsCustomScope && w.scope === 'none') {
        w.scope = st;
      } else {
        this.addScopeToBackpack(st);
      }
      return;
    }

    if (ld.kind === 'attachment' && ld.attachmentKind) {
      const att = ld.attachmentKind;
      const slotKey = ATTACHMENT_LABELS[att].slot;
      const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2];
      if (w && WEAPONS[w.weaponId].allowsAttachments && !w.attachments[slotKey]) {
        (w.attachments as Record<AttachmentSlotKey, AttachmentKind | null>)[slotKey] = att;
      } else {
        this.addAttachmentToBackpack(att);
      }
      return;
    }

    if (ld.kind === 'gloo') {
      this.glooCount = Math.min(8, this.glooCount + (ld.glooAmount ?? 1));
      return;
    }

    if (ld.kind === 'grenade') {
      this.grenadeCount = Math.min(6, this.grenadeCount + (ld.grenadeAmount ?? 1));
      return;
    }

    if (ld.kind === 'deathbox' && ld.deathLoot) {
      const dl = ld.deathLoot;
      this.ffCoins += dl.coins ?? 120;
      const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2] ?? this.weapons[3];
      if (w) w.reserveAmmo += dl.ammo;
      if (dl.medkits > 0) {
        if (this.getBackpackUsedWeight() + 12 <= this.getBackpackCapacity()) {
          this.medkitCount += dl.medkits;
        } else {
          this.hp = Math.min(this.maxHp, this.hp + 35);
        }
      }
      this.glooCount = Math.min(8, this.glooCount + dl.gloos);
      this.grenadeCount = Math.min(6, this.grenadeCount + dl.grenades);
      if (dl.vestLevel > 0) {
        const maxV = dl.vestLevel === 1 ? 100 : dl.vestLevel === 2 ? 160 : 220;
        if (dl.vestLevel > this.vestLevel || (dl.vestLevel === this.vestLevel && this.vestHp < maxV)) {
          this.vestLevel = dl.vestLevel;
          this.vestMaxHp = maxV;
          this.vestHp = maxV;
        }
      }
      if (dl.helmetLevel > 0) {
        const maxH = dl.helmetLevel === 1 ? 75 : dl.helmetLevel === 2 ? 120 : 180;
        if (dl.helmetLevel > this.helmetLevel || (dl.helmetLevel === this.helmetLevel && this.helmetHp < maxH)) {
          this.helmetLevel = dl.helmetLevel;
          this.helmetMaxHp = maxH;
          this.helmetHp = maxH;
        }
      }
      if (dl.weaponId && (!this.weapons[1] || !this.weapons[2])) {
        const wid = dl.weaponId;
        const def = WEAPONS[wid];
        const targetSlot: 1 | 2 = !this.weapons[1] ? 1 : 2;
        this.weapons[targetSlot] = {
          weaponId: wid,
          ammoInMag: def.magSize,
          reserveAmmo: def.magSize * 3,
          scope: def.defaultScope,
          attachments: emptyAttachments(),
        };
        this.activeSlot = targetSlot;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.syncPlayerWeaponAndBackVisuals();
        this.animator.triggerWeaponDraw();
        soundEngine.playWeaponSwitch();
      }
      return;
    }

    if (ld.kind === 'weapon' && ld.weaponId) {
      const wid: WeaponId = ld.weaponId;
      const def = WEAPONS[wid];
      if (def.category === 'HG') {
        if (this.weapons[3] && this.weapons[3]!.weaponId === wid) {
          this.weapons[3]!.reserveAmmo += 30;
        } else {
          if (this.weapons[3]) {
            const oldW = this.weapons[3]!;
            this.spawnItemInFront({
              kind: 'weapon',
              weaponId: oldW.weaponId,
              label: WEAPONS[oldW.weaponId].name,
            });
          }
          this.weapons[3] = {
            weaponId: wid,
            ammoInMag: def.magSize,
            reserveAmmo: 45,
            scope: 'none',
            attachments: emptyAttachments(),
          };
          this.activeSlot = 3;
          this.isAiming = false;
          this.input.setTouchAim(false);
          this.isReloading = false;
          this.reloadTimer = 0;
          this.syncPlayerWeaponAndBackVisuals();
          this.animator.triggerWeaponDraw();
          soundEngine.playWeaponSwitch();
        }
        return;
      }

      // Primary weapons fill Slot 1 or Slot 2 first, else replace active primary slot & drop old gun
      let targetSlot: 1 | 2 = 1;
      if (!this.weapons[1]) {
        targetSlot = 1;
      } else if (!this.weapons[2]) {
        targetSlot = 2;
      } else {
        targetSlot = this.activeSlot === 2 ? 2 : 1;
        const oldW = this.weapons[targetSlot]!;
        this.spawnItemInFront({
          kind: 'weapon',
          weaponId: oldW.weaponId,
          label: WEAPONS[oldW.weaponId].name,
        });
      }

      this.weapons[targetSlot] = {
        weaponId: wid,
        ammoInMag: def.magSize,
        reserveAmmo: def.magSize * 4,
        scope: def.defaultScope,
        attachments: emptyAttachments(),
      };
      this.activeSlot = targetSlot;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.syncPlayerWeaponAndBackVisuals();
      this.animator.triggerWeaponDraw();
      soundEngine.playWeaponSwitch();
    }
  }

  private findNearbyLoot() {
    for (let i = 0; i < this.world.loots.length; i++) {
      const l = this.world.loots[i];
      if (l.data.collected) continue;
      const dx = l.data.x - this.pos.x;
      const dz = l.data.z - this.pos.z;
      if (Math.abs(dx) > 2.9 || Math.abs(dz) > 2.9) continue;
      if (Math.hypot(dx, dz) < 2.8 && Math.abs(l.data.y - this.pos.y) < 2.4) return l;
    }
    return null;
  }

  private findNearbyLoots(maxSlots = 8): NearbyLootSlot[] {
    const items: Array<{ dist: number; slot: NearbyLootSlot }> = [];
    const ad = this.findNearbyAirDrop();
    if (ad) {
      items.push({
        dist: 0,
        slot: {
          id: ad.id,
          kind: 'airdrop',
          label: 'AIRDROP (AWM + Nv.3)',
          subLabel: '+200 Moedas',
        },
      });
    }

    for (let i = 0; i < this.world.loots.length; i++) {
      const l = this.world.loots[i];
      if (l.data.collected) continue;
      const dx = l.data.x - this.pos.x;
      const dz = l.data.z - this.pos.z;
      if (Math.abs(dx) > 2.9 || Math.abs(dz) > 2.9) continue;
      const d = Math.hypot(dx, dz);
      if (d < 2.9 && Math.abs(l.data.y - this.pos.y) < 2.5) {
        if (l.data.kind === 'deathbox' && l.data.deathEntries) {
          if (l.data.deathEntries.length === 0) {
            l.data.collected = true;
            l.mesh.visible = false;
            continue;
          }
          for (let e = 0; e < l.data.deathEntries.length; e++) {
            const entry = l.data.deathEntries[e];
            items.push({
              dist: d,
              slot: {
                id: `${l.data.id}::${entry.id}`,
                deathBoxId: l.data.id,
                boxOwnerNick: l.data.deathOwnerNick,
                kind: entry.kind,
                weaponId: entry.weaponId,
                scopeType: entry.scopeType,
                attachmentKind: entry.attachmentKind,
                level: entry.level,
                label: entry.label,
                subLabel: entry.subLabel,
              },
            });
          }
          continue;
        }

        let sub: string | undefined;
        if (l.data.kind === 'coin') sub = `+${l.data.coinAmount ?? 100}`;
        else if (l.data.kind === 'ammo') sub = `+${l.data.ammoAmount ?? 30}`;
        else if (l.data.kind === 'gloo') sub = `x${l.data.glooAmount ?? 1}`;
        else if (l.data.kind === 'grenade') sub = `x${l.data.grenadeAmount ?? 1}`;
        else if (l.data.level) sub = `Nv.${l.data.level}`;
        items.push({
          dist: d,
          slot: {
            id: l.data.id,
            kind: l.data.kind,
            weaponId: l.data.weaponId,
            scopeType: l.data.scopeType,
            attachmentKind: l.data.attachmentKind,
            level: l.data.level,
            label: l.data.label,
            subLabel: sub,
          },
        });
      }
    }

    items.sort((a, b) => a.dist - b.dist);
    return items.slice(0, maxSlots).map((it) => it.slot);
  }

  private findNearbyVending(): VendingMachineProp | null {
    for (let i = 0; i < this.world.vendingMachines.length; i++) {
      const vm = this.world.vendingMachines[i];
      const d = Math.hypot(vm.x - this.pos.x, vm.z - this.pos.z);
      if (d < 3.4 && Math.abs(vm.y - this.pos.y) < 2.6) return vm;
    }
    return null;
  }

  public openNearbyVending(): void {
    if (this.findNearbyVending()) {
      this.onOpenShopRequest?.();
    }
  }

  public buyVendingOffer(offerId: string, reviveAllyId?: string): boolean {
    const state = this.stateMachine.getState();
    if (state !== GameState.PLAYING && state !== GameState.WAITING) return false;
    if (this.isDead || this.isPlayerDowned) return false;

    if (offerId === 'revive_ally' && reviveAllyId) {
      if (this.ffCoins < 400) return false;
      if (reviveAllyId.startsWith('human_') && this.onlineRoomId) {
        const targetAccountId = Number(reviveAllyId.slice(6));
        const humanAlly = this.onlineRemotePlayers.get(targetAccountId);
        if (!humanAlly || humanAlly.teamId !== this.onlineTeamId) return false;
        const vm = this.findNearbyVending();
        const shopX = vm ? vm.x : this.pos.x;
        const shopZ = vm ? vm.z : this.pos.z;
        this.ffCoins -= 400;
        this.queueOrSendRoomAction({
          type: 'revive_from_shop',
          targetAccountId,
          shopX,
          shopZ,
        });
        this.pushKillFeed('LOJINHA', `${humanAlly.nickname} REDESDOBRADO`, 'LOJA', false, true);
        soundEngine.playShopBuy();
        return true;
      }
      const ally = this.targetById.get(reviveAllyId);
      if (!ally || !ally.isAlly || (!ally.eliminated && !ally.isDowned && ally.downTimer <= 0)) {
        return false;
      }
      this.ffCoins -= 400;
      ally.eliminated = false;
      ally.isDowned = false;
      ally.downTimer = 0;
      ally.hp = 165;
      ally.bleedHp = 100;
      ally.medkits = 1;
      ally.gloos = 2;
      ally.weaponId = 'm4a1';
      ally.secondaryWeaponId = undefined;
      ally.pistolWeaponId = 'g18';
      ally.drawTimer = 0;
      setBotWeaponVisual(ally, ally.weaponId, getBotBackWeapon(ally));
      ally.airState = 'parachuting';
      ally.vy = -8;
      ally.animator?.reset();
      if (ally.rig) {
        ally.rig.weaponMount.visible = false;
        ally.rig.setParachuteVisible(true);
        ally.rig.setBandageVisible?.(false);
      }
      ally.group.rotation.x = 0;
      ally.group.position.set(this.pos.x + 2.8, this.pos.y + 18, this.pos.z + 2.8);
      ally.group.visible = true;
      if (state === GameState.PLAYING) {
        this.aliveCount = Math.min(51, this.aliveCount + 1);
      }
      this.pushKillFeed('LOJINHA', `${ally.nick} REDESDOBRADO`, 'LOJA', false, true);
      soundEngine.playShopBuy();
      return true;
    }

    const offer = VENDING_SHOP_OFFERS.find((o) => o.id === offerId);
    if (!offer || this.ffCoins < offer.cost) return false;
    this.ffCoins -= offer.cost;
    soundEngine.playShopBuy();

    if (offer.id === 'medkit') {
      this.medkitCount += 1;
    } else if (offer.id === 'gloo2') {
      this.glooCount = Math.min(8, this.glooCount + 2);
    } else if (offer.id === 'grenade2') {
      this.grenadeCount = Math.min(6, this.grenadeCount + 2);
    } else if (offer.id === 'ammo60') {
      const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2] ?? this.weapons[3];
      if (w) w.reserveAmmo += 60;
    } else if (offer.id === 'vest2') {
      if (this.vestLevel < 2 || this.vestHp < 160) {
        this.vestLevel = 2;
        this.vestMaxHp = 160;
        this.vestHp = 160;
      }
    } else if (offer.id === 'vest3') {
      this.vestLevel = 3;
      this.vestMaxHp = 220;
      this.vestHp = 220;
    } else if (offer.id === 'helmet3') {
      this.helmetLevel = 3;
      this.helmetMaxHp = 180;
      this.helmetHp = 180;
    } else if (offer.id === 'scope4x') {
      const sc = '4x' as const;
      if (!this.ownedScopes.includes(sc)) this.ownedScopes.push(sc);
      const w = this.getActiveWeaponState() ?? this.weapons[1] ?? this.weapons[2];
      if (w && WEAPONS[w.weaponId].allowsCustomScope) w.scope = sc;
      else this.addScopeToBackpack(sc);
    } else if (offer.weaponId) {
      const wid = offer.weaponId;
      const def = WEAPONS[wid];
      if (def.category === 'HG') {
        if (this.weapons[3] && this.weapons[3]!.weaponId !== wid) {
          const oldW = this.weapons[3]!;
          this.spawnItemInFront({
            kind: 'weapon',
            weaponId: oldW.weaponId,
            label: WEAPONS[oldW.weaponId].name,
          });
        }
        this.weapons[3] = {
          weaponId: wid,
          ammoInMag: def.magSize,
          reserveAmmo: 45,
          scope: 'none',
          attachments: emptyAttachments(),
        };
        this.activeSlot = 3;
        this.isAiming = false;
        this.input.setTouchAim(false);
        this.isReloading = false;
        this.reloadTimer = 0;
        this.syncPlayerWeaponAndBackVisuals();
        this.animator.triggerWeaponDraw();
      } else {
        const slot: 1 | 2 = !this.weapons[1] ? 1 : !this.weapons[2] ? 2 : this.activeSlot === 2 ? 2 : 1;
        if (this.weapons[1] && this.weapons[2] && this.weapons[slot]) {
          const oldW = this.weapons[slot]!;
          this.spawnItemInFront({
            kind: 'weapon',
            weaponId: oldW.weaponId,
            label: WEAPONS[oldW.weaponId].name,
          });
        }
        this.weapons[slot] = {
          weaponId: wid,
          ammoInMag: def.magSize,
          reserveAmmo: wid === 'awm' ? 25 : def.magSize * 4,
          scope: wid === 'awm' ? 'sniper' : def.defaultScope,
          attachments: emptyAttachments(),
        };
        this.activeSlot = slot;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.syncPlayerWeaponAndBackVisuals();
        this.animator.triggerWeaponDraw();
      }
    }
    return true;
  }

  private findNearbyVehicle(): VehicleEntity | null {
    for (let i = 0; i < this.world.vehicles.length; i++) {
      const v = this.world.vehicles[i];
      if (v.destroyed) continue;
      const d = Math.hypot(v.x - this.pos.x, v.z - this.pos.z);
      if (d < 3.8 && Math.abs(v.y - this.pos.y) < 2.8) return v;
    }
    return null;
  }

  public toggleVehicle(): void {
    if (this.isPlayerDowned || this.isDead) return;
    if (this.activeVehicleId) {
      this.exitVehicle();
      return;
    }
    const v = this.findNearbyVehicle();
    if (v) this.enterVehicle(v);
  }

  private enterVehicle(v: VehicleEntity): void {
    if (v.destroyed || this.isDead || this.isPlayerDowned) return;
    this.activeVehicleId = v.id;
    v.driverIsPlayer = true;
    this.inWater = false;
    this.isSwimming = false;
    this.isOnSurfboard = false;
    this.playerRig.setSurfboardVisible(false);
    this.isReloading = false;
    this.isAiming = false;
    this.isPlacingGloo = false;
    this.isHoldingGrenade = false;
    this.revivingBotId = null;
    this.stance = 'stand';
    this.yaw = v.yaw + Math.PI;
    this.pitch = -0.18;
    this.vehicleLookOverrideTimer = 0;
    this.hudDirty = true;
    soundEngine.stopRunAudio();
    soundEngine.playVehicleEnter();
  }

  private exitVehicleImmediate(): void {
    if (!this.activeVehicleId) return;
    const v = this.world.vehicles.find((veh) => veh.id === this.activeVehicleId);
    if (v) {
      v.driverIsPlayer = false;
      this.ejectPassengersFromVehicle(v);
    }
    this.activeVehicleId = null;
    this.playerRig.weaponMount.visible = this.activeSlot !== 4;
    soundEngine.stopVehicleAudio();
  }

  private exitVehicle(): void {
    if (!this.activeVehicleId) return;
    const v = this.world.vehicles.find((veh) => veh.id === this.activeVehicleId);
    this.activeVehicleId = null;
    this.playerRig.weaponMount.visible = this.activeSlot !== 4;
    soundEngine.stopVehicleAudio();
    soundEngine.playVehicleEnter();

    if (v) {
      v.driverIsPlayer = false;
      const sideX = Math.cos(v.yaw);
      const sideZ = -Math.sin(v.yaw);
      const abExit = this.getActiveBounds();
      this.pos.x = THREE.MathUtils.clamp(v.x - sideX * 2.1, abExit.minX, abExit.maxX);
      this.pos.z = THREE.MathUtils.clamp(v.z + sideZ * 2.1, abExit.minZ, abExit.maxZ);
      const exitFloor = this.resolveFloorHeight(this.pos.x, this.pos.z, v.y + 1.5);
      const exitDeepThresh = this.isBermudaMapActive() ? BERMUDA_GLB_WATER_Y + 0.25 : -0.78;
      this.pos.y =
        exitFloor <= exitDeepThresh
          ? Math.max(exitFloor, this.getDeepWaterMinY())
          : Math.max(this.getDryMinFloorY(), exitFloor);
      this.vel.set(0, 0, 0);
      this.ejectPassengersFromVehicle(v);
    }
  }

  private ejectPassengersFromVehicle(v: VehicleEntity): void {
    const abExit = this.getActiveBounds();
    const minPassY = this.getDeepWaterMinY();
    for (let i = 0; i < v.passengerIds.length; i++) {
      const bot = this.targetById.get(v.passengerIds[i]);
      if (!bot) continue;
      const sideSign = i % 2 === 0 ? 1 : -1;
      const px = THREE.MathUtils.clamp(v.x + Math.cos(v.yaw) * 2.3 * sideSign, abExit.minX + 4, abExit.maxX - 4);
      const pz = THREE.MathUtils.clamp(v.z - Math.sin(v.yaw) * 2.3 * sideSign, abExit.minZ + 4, abExit.maxZ - 4);
      bot.group.position.set(px, Math.max(minPassY, this.sampleEntitySurface(px, pz).y), pz);
      bot.group.visible = !bot.eliminated;
    }
    v.passengerIds = [];
  }

  private damageVehicle(v: VehicleEntity, dmg: number): void {
    if (v.destroyed) return;
    v.hp = Math.max(0, v.hp - dmg);
    if (v.hp <= 0) {
      v.destroyed = true;
      v.speed = 0;
      v.chassisGroup.visible = false;
      v.burnedGroup.visible = true;
      v.smokeMeshes.forEach((sm) => {
        sm.visible = false;
      });
      if (this.activeVehicleId === v.id) {
        this.exitVehicle();
      } else {
        v.driverIsPlayer = false;
        this.ejectPassengersFromVehicle(v);
      }
      _v1.set(v.x, v.y + 0.9, v.z);
      this.explodeAt(_v1, 8.5, 130, 'EXPLOSÃO');
    }
  }

  private updateVehicles(dt: number): void {
    for (let i = 0; i < this.world.vehicles.length; i++) {
      const v = this.world.vehicles[i];
      if (!v.destroyed && v.hp < v.maxHp * 0.38) {
        for (let s = 0; s < v.smokeMeshes.length; s++) {
          const sm = v.smokeMeshes[s];
          sm.visible = true;
          const phase = (this.elapsed * 2.6 + s * 0.35 + i * 0.2) % 1;
          sm.position.y = 1.25 + phase * 1.45;
          sm.scale.setScalar(0.65 + phase * 0.85);
        }
      }
      if (!v.driverIsPlayer && Math.abs(v.speed) > 0.08 && !v.destroyed) {
        const abVeh = this.getActiveBounds();
        v.speed = THREE.MathUtils.damp(v.speed, 0, 2.2, dt);
        v.x = THREE.MathUtils.clamp(v.x + Math.sin(v.yaw) * v.speed * dt, abVeh.minX + 2, abVeh.maxX - 2);
        v.z = THREE.MathUtils.clamp(v.z + Math.cos(v.yaw) * v.speed * dt, abVeh.minZ + 2, abVeh.maxZ - 2);
        const surf = this.sampleEntitySurface(v.x, v.z);
        const minVehY = this.isBermudaMapActive() ? BERMUDA_GLB_WATER_Y - 0.15 : -0.82;
        v.y = surf.onBridge ? surf.y : Math.max(minVehY, surf.y);
        v.group.position.set(v.x, v.y, v.z);
        v.collider.cx = v.x;
        v.collider.cz = v.z;
        v.collider.minY = v.y;
        v.collider.maxY = v.y + 2.05;
        const wheelSpin = (v.speed * dt) / (v.kind === 'sport' ? 0.36 : 0.42);
        v.wheelFL.rotation.x += wheelSpin;
        v.wheelFR.rotation.x += wheelSpin;
        v.wheelRL.rotation.x += wheelSpin;
        v.wheelRR.rotation.x += wheelSpin;
      }
    }
  }

  private updateDrivingPlayer(dt: number): void {
    const v = this.world.vehicles.find((veh) => veh.id === this.activeVehicleId);
    if (!v || v.destroyed) {
      this.exitVehicle();
      return;
    }

    this.input.sample();
    const edges = this.input.consumeLookAndEdges();
    if (this.input.consumeResetCameraFlag()) {
      this.camShake = 0;
      this.vehicleLookOverrideTimer = 0;
      this.hudDirty = true;
    }
    if (edges.backpack) this.onBackpackRequest?.();
    if (edges.medkit) this.useMedkit();
    if (edges.smallMedkit) this.useSmallKit();
    this.updateMedkitChannel(dt, false);
    if (edges.interact) {
      this.exitVehicle();
      return;
    }

    // Orbit camera around vehicle with automatic front-facing follow behind car
    const sens = 0.0028 * this.settings.sensitivity;
    const invert = this.settings.invertY ? -1 : 1;
    const manualLook = Math.abs(edges.dx) > 0.45 || Math.abs(edges.dy) > 0.45;
    if (manualLook) {
      this.vehicleLookOverrideTimer = 1.45;
      this.yaw -= edges.dx * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - edges.dy * sens * invert, -0.85, 0.45);
    } else {
      this.vehicleLookOverrideTimer = Math.max(0, this.vehicleLookOverrideTimer - dt);
    }

    const isSports = v.kind === 'sport';
    const curVehSurf = this.sampleEntitySurface(v.x, v.z);
    const vehWaterSurfaceY = this.isBermudaMapActive() ? BERMUDA_GLB_WATER_Y : -0.35;
    const drivingInWater = !curVehSurf.onBridge && curVehSurf.y < vehWaterSurfaceY;
    const waterDrag = drivingInWater ? 0.78 : 1.0;
    const maxFwd = (isSports ? 31 : 24) * waterDrag;
    const maxRev = -10.5 * waterDrag;
    const accelRate = (isSports ? 23 : 17.5) * (drivingInWater ? 0.85 : 1.0);
    const throttle = this.input.moveZ;
    const steer = this.input.moveX;

    if (throttle > 0.05) {
      v.speed = Math.min(maxFwd, v.speed + throttle * accelRate * dt);
    } else if (throttle < -0.05) {
      const decel = v.speed > 0.5 ? accelRate * 1.9 : accelRate * 0.9;
      v.speed = Math.max(maxRev, v.speed + throttle * decel * dt);
    } else {
      v.speed = THREE.MathUtils.damp(v.speed, 0, drivingInWater ? 2.6 : 1.85, dt);
    }
    if (v.speed > maxFwd) {
      v.speed = THREE.MathUtils.damp(v.speed, maxFwd, 4.5, dt);
    }

    const speedRatio = Math.min(1, Math.abs(v.speed) / 7.0);
    if (Math.abs(steer) > 0.04 && speedRatio > 0.03) {
      const dirSign = v.speed >= -0.4 ? 1 : -1;
      const steerRate = isSports ? 2.15 : 1.75;
      v.yaw += -steer * dirSign * steerRate * speedRatio * dt;
    }

    // Automatically align chase camera behind the vehicle's forward heading
    if (this.vehicleLookOverrideTimer <= 0) {
      const targetCamYaw = v.yaw + Math.PI;
      let diffYaw = targetCamYaw - this.yaw;
      while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
      while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
      const followRate = Math.abs(v.speed) > 1.2 ? 6.8 : 3.2;
      this.yaw += diffYaw * (1 - Math.exp(-followRate * dt));
      this.pitch = THREE.MathUtils.damp(this.pitch, -0.18, 2.6, dt);
    }

    const abVeh = this.getActiveBounds();
    v.x = THREE.MathUtils.clamp(v.x + Math.sin(v.yaw) * v.speed * dt, abVeh.minX, abVeh.maxX);
    v.z = THREE.MathUtils.clamp(v.z + Math.cos(v.yaw) * v.speed * dt, abVeh.minZ, abVeh.maxZ);
    const surf = this.sampleEntitySurface(v.x, v.z);
    const minVehY = this.isBermudaMapActive() ? BERMUDA_GLB_WATER_Y - 0.15 : -0.82;
    v.y = surf.onBridge ? surf.y : Math.max(minVehY, surf.y);

    // World building/prop collision bounce
    const cols = this.world.colliders;
    const vehR = 1.45;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c.tag === `vehicle-${v.id}` || c.tag === 'house-window-sill') continue;
      if (v.y + 1.8 < c.minY || v.y + 0.3 > c.maxY) continue;
      const dx = v.x - c.cx;
      const dz = v.z - c.cz;
      const maxE = c.halfW + c.halfD + vehR;
      if (Math.abs(dx) > maxE || Math.abs(dz) > maxE) continue;
      const cos = Math.cos(c.rotY);
      const sin = Math.sin(c.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const clX = Math.max(-c.halfW, Math.min(c.halfW, lx));
      const clZ = Math.max(-c.halfD, Math.min(c.halfD, lz));
      const dX = lx - clX;
      const dZ = lz - clZ;
      const dSq = dX * dX + dZ * dZ;
      if (dSq < vehR * vehR) {
        if (Math.abs(v.speed) > 9.5) {
          soundEngine.playVehicleCrash(Math.min(1, Math.abs(v.speed) / 24));
          this.camShake = Math.max(this.camShake, 0.2);
        }
        const dist = Math.sqrt(dSq) || 0.01;
        const push = vehR - dist;
        const pLx = (dX / dist) * push;
        const pLz = (dZ / dist) * push;
        v.x += pLx * cos + pLz * sin;
        v.z += -pLx * sin + pLz * cos;
        v.speed *= -0.35;
      }
    }

    if (this.isBermudaMapActive()) {
      const vPos = { x: v.x, y: v.y, z: v.z };
      const pushGlb = this.world.bermudaCollisionGrid.resolveHorizontal(vPos, vehR);
      if (pushGlb > 0.01) {
        if (Math.abs(v.speed) > 9.5) {
          soundEngine.playVehicleCrash(Math.min(1, Math.abs(v.speed) / 24));
          this.camShake = Math.max(this.camShake, 0.2);
        }
        v.x = vPos.x;
        v.z = vPos.z;
        v.speed *= -0.35;
      }
    }

    // Run-over ("Atropelamento") damage to enemy bots
    if (Math.abs(v.speed) >= 5.5) {
      const bots = this.world.targets;
      for (let i = 0; i < bots.length; i++) {
        const bot = bots[i];
        if (bot.isAlly || bot.eliminated || bot.airState !== 'ground') continue;
        if (bot.downTimer > 0 && !bot.isDowned) continue;
        const bdx = bot.group.position.x - v.x;
        const bdz = bot.group.position.z - v.z;
        const distSq = bdx * bdx + bdz * bdz;
        if (distSq < 2.25 * 2.25) {
          const dmg = Math.round(Math.abs(v.speed) * 7.8);
          const bDist = Math.sqrt(distSq) || 0.1;
          const pushX = (bdx / bDist) * 2.65;
          const pushZ = (bdz / bDist) * 2.65;
          bot.group.position.x = THREE.MathUtils.clamp(v.x + pushX, abVeh.minX + 4, abVeh.maxX - 4);
          bot.group.position.z = THREE.MathUtils.clamp(v.z + pushZ, abVeh.minZ + 4, abVeh.maxZ - 4);
          this.applyBotHitDamage(bot, dmg, true, this.playerNick, 'CARRO', false, v.x, v.z);
          this.damageDealt += dmg;
          this.hitmarkerTimer = 0.22;
          _v1.set(bot.group.position.x, bot.group.position.y + 1.4, bot.group.position.z);
          this.pushDamagePopup(_v1, dmg, false, 0);
          soundEngine.playRunOver();
          this.camShake = Math.max(this.camShake, 0.24);
        }
      }
    }

    // Update vehicle visual orientation & wheel animation + terrain slope tilt
    const minSlopeY = this.getDryMinFloorY();
    const fH = Math.max(minSlopeY, this.world.groundHeightAt(v.x + Math.sin(v.yaw) * 1.4, v.z + Math.cos(v.yaw) * 1.4));
    const bH = Math.max(minSlopeY, this.world.groundHeightAt(v.x - Math.sin(v.yaw) * 1.4, v.z - Math.cos(v.yaw) * 1.4));
    const rH = Math.max(minSlopeY, this.world.groundHeightAt(v.x + Math.cos(v.yaw) * 0.9, v.z - Math.sin(v.yaw) * 0.9));
    const lH = Math.max(minSlopeY, this.world.groundHeightAt(v.x - Math.cos(v.yaw) * 0.9, v.z + Math.sin(v.yaw) * 0.9));
    const targetPitchTilt = surf.onBridge ? 0 : Math.atan2(bH - fH, 2.8);
    const targetRollTilt = (surf.onBridge ? 0 : Math.atan2(lH - rH, 1.8)) + steer * speedRatio * 0.05;

    v.group.position.set(v.x, v.y, v.z);
    v.group.rotation.y = v.yaw;
    v.chassisGroup.rotation.x = THREE.MathUtils.damp(v.chassisGroup.rotation.x, targetPitchTilt, 10, dt);
    v.chassisGroup.rotation.z = THREE.MathUtils.damp(v.chassisGroup.rotation.z, targetRollTilt, 10, dt);

    const steerTarget = -steer * 0.44;
    v.steerFL.rotation.y = THREE.MathUtils.damp(v.steerFL.rotation.y, steerTarget, 14, dt);
    v.steerFR.rotation.y = THREE.MathUtils.damp(v.steerFR.rotation.y, steerTarget, 14, dt);
    const wheelSpin = (v.speed * dt) / (isSports ? 0.36 : 0.42);
    v.wheelFL.rotation.x += wheelSpin;
    v.wheelFR.rotation.x += wheelSpin;
    v.wheelRL.rotation.x += wheelSpin;
    v.wheelRR.rotation.x += wheelSpin;

    v.collider.cx = v.x;
    v.collider.cz = v.z;
    v.collider.rotY = v.yaw;
    v.collider.minY = v.y;
    v.collider.maxY = v.y + 2.05;

    // Update engine audio
    soundEngine.updateVehicleEngineAudio(true, Math.abs(v.speed) / maxFwd);

    // Sync player rig & heal ring inside vehicle cabin
    this.pos.set(v.x, v.y + 0.3, v.z);
    if (this.usingMedkit) {
      const pulse = 1 + Math.sin(this.elapsed * 8.5) * 0.14;
      this.healRingMesh.position.set(v.x, v.y + 0.18, v.z);
      this.healRingMesh.scale.set(pulse * 1.45, pulse * 1.45, 1);
      this.healRingMesh.rotation.z += dt * 2.2;
      this.healRingMesh.visible = true;
    } else {
      this.healRingMesh.visible = false;
    }
    this.characterYaw = v.yaw + Math.PI;
    this.playerRig.root.visible = true;
    this.playerRig.weaponMount.visible = false;
    this.playerRig.root.position.set(v.x, v.y + 0.32, v.z);
    this.playerRig.root.rotation.y = v.yaw;
    this.animator.update(this.playerRig, {
      dt,
      speed: Math.abs(v.speed),
      stance: 'stand',
      isGrounded: true,
      isSprinting: false,
      isAiming: false,
      isFiring: false,
      isHealing: this.usingMedkit,
      isDriving: true,
      isLobby: false,
      isSkydiving: false,
      isParachuting: false,
      isDead: false,
      pitchRad: 0,
    });

    this.updateThirdPersonCamera(dt, 6.4, 1.55, 'none', false, false);
  }

  private findNearbyLaunchPad() {
    for (let i = 0; i < this.world.launchPads.length; i++) {
      const pad = this.world.launchPads[i];
      const d = Math.hypot(pad.x - this.pos.x, pad.z - this.pos.z);
      if (d < 2.35 && Math.abs(pad.y - this.pos.y) < 2.2) return pad;
    }
    return null;
  }

  private triggerLaunchPad(pad: { dirX: number; dirZ: number }): void {
    this.usingMedkit = false;
    this.healRingMesh.visible = false;
    soundEngine.stopMedkitAudio();
    this.isReloading = false;
    this.isPlacingGloo = false;
    this.isHoldingGrenade = false;
    this.stance = 'stand';
    this.isGrounded = false;
    this.yaw = Math.atan2(-pad.dirX, -pad.dirZ);
    this.pos.y += 1.4;
    this.vel.set(pad.dirX * 36, 26, pad.dirZ * 36);
    this.launchPadFlightTimer = 1.6;
    soundEngine.playParachuteOpen();
    this.stateMachine.forceState(GameState.DROPPING);
  }

  private updateThirdPersonCamera(
    dt: number,
    distance: number,
    targetHeight: number,
    activeScope: ScopeType = 'none',
    isOpticalLens = false,
    snapInstant = false,
  ): void {
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    let rightShoulderOffset = isOpticalLens || Boolean(this.activeVehicleId) ? 0 : 0.42;

    // Prevent shoulder pivot from clipping outside side walls in small rooms
    if (!isOpticalLens && rightShoulderOffset > 0.01) {
      _rayOrigin.set(this.pos.x, this.pos.y + targetHeight, this.pos.z);
      _rayDir.set(rightX, 0, rightZ);
      this.raycaster.set(_rayOrigin, _rayDir);
      this.raycaster.far = rightShoulderOffset + 0.25;
      const sideHits = this.raycaster.intersectObjects(this.solidObstaclesActive, false);
      for (let h = 0; h < sideHits.length; h++) {
        if (sideHits[h].object.userData.vehicleId === this.activeVehicleId) continue;
        rightShoulderOffset = Math.max(0.08, sideHits[h].distance - 0.22);
        break;
      }
    }

    if (snapInstant) {
      this.camShoulderCurrent = rightShoulderOffset;
      this.camDistCurrent = distance;
    } else {
      this.camShoulderCurrent = THREE.MathUtils.damp(
        this.camShoulderCurrent,
        rightShoulderOffset,
        24,
        dt,
      );
      this.camDistCurrent = THREE.MathUtils.damp(this.camDistCurrent, distance, 20, dt);
    }

    _camTarget.set(
      this.pos.x + rightX * this.camShoulderCurrent,
      this.pos.y + targetHeight,
      this.pos.z + rightZ * this.camShoulderCurrent,
    );

    if (snapInstant) {
      this.camLookCurrent.copy(_camTarget);
    } else {
      const xzAlpha = 1 - Math.exp(-30 * dt);
      const yRate = this.stanceSnapTimer > 0 ? 52 : 22;
      const yAlpha = 1 - Math.exp(-yRate * dt);
      this.camLookCurrent.x = THREE.MathUtils.lerp(this.camLookCurrent.x, _camTarget.x, xzAlpha);
      this.camLookCurrent.z = THREE.MathUtils.lerp(this.camLookCurrent.z, _camTarget.z, xzAlpha);
      this.camLookCurrent.y = THREE.MathUtils.lerp(this.camLookCurrent.y, _camTarget.y, yAlpha);
    }

    // Rigidly place camera along (-forward(yaw, pitch)) from camLookCurrent, pulling inward cleanly
    // whenever house walls, ceilings, obstacles, or terrain sit between player and camera
    const cp = Math.cos(this.pitch);
    const fwdX = -Math.sin(this.yaw) * cp;
    const fwdY = Math.sin(this.pitch);
    const fwdZ = -Math.cos(this.yaw) * cp;

    let maxSafeDist = this.camDistCurrent;
    if (!isOpticalLens && this.camDistCurrent > 0.4) {
      _rayDir.set(-fwdX, -fwdY, -fwdZ);
      const glbCamHit = this.raycastActiveGlbWall(
        this.camLookCurrent,
        _rayDir,
        this.camDistCurrent + 0.35,
      );
      if (glbCamHit !== null) {
        maxSafeDist = Math.min(maxSafeDist, Math.max(0.45, glbCamHit - 0.24));
      }
      this.raycaster.set(this.camLookCurrent, _rayDir);
      this.raycaster.far = this.camDistCurrent + 0.35;
      const wallHits = this.raycaster.intersectObjects(this.solidObstaclesActive, false);
      for (let h = 0; h < wallHits.length; h++) {
        if (wallHits[h].object.userData.vehicleId === this.activeVehicleId) continue;
        maxSafeDist = Math.min(maxSafeDist, Math.max(0.45, wallHits[h].distance - 0.24));
        break;
      }
      const terrainBackDist = this.raycastTerrainDist(
        this.camLookCurrent,
        _rayDir,
        this.camDistCurrent + 0.3,
      );
      if (terrainBackDist < this.camDistCurrent + 0.25) {
        maxSafeDist = Math.min(maxSafeDist, Math.max(0.45, terrainBackDist - 0.24));
      }
    }

    if (snapInstant) {
      this.camSafeDist = maxSafeDist;
    } else {
      const distRate = maxSafeDist < this.camSafeDist ? 55 : 11;
      this.camSafeDist = THREE.MathUtils.damp(this.camSafeDist, maxSafeDist, distRate, dt);
    }

    let effectiveDist = Math.min(this.camDistCurrent, this.camSafeDist);
    const desiredX = this.camLookCurrent.x - fwdX * effectiveDist;
    const desiredY = this.camLookCurrent.y - fwdY * effectiveDist;
    const desiredZ = this.camLookCurrent.z - fwdZ * effectiveDist;
    const camGround = this.isInWaitLobbyArea(desiredX, desiredZ)
      ? WAIT_LOBBY_ORIGIN.y + 0.35
      : this.isInGladiadoresArea(desiredX, desiredZ)
        ? GLADIADORES_FLOOR_Y + 0.35
        : this.world.groundHeightAt(desiredX, desiredZ) + 0.38;
    if (desiredY < camGround && fwdY > 0.05) {
      effectiveDist = Math.max(
        0.2,
        (this.camLookCurrent.y - camGround) / Math.max(0.05, fwdY),
      );
    }

    this.camPosCurrent.set(
      this.camLookCurrent.x - fwdX * effectiveDist,
      Math.max(camGround, this.camLookCurrent.y - fwdY * effectiveDist),
      this.camLookCurrent.z - fwdZ * effectiveDist,
    );

    // Apply subtle shake
    if (this.camShake > 0.001) {
      this.camPosCurrent.x += (Math.random() - 0.5) * this.camShake;
      this.camPosCurrent.y += (Math.random() - 0.5) * this.camShake;
    }

    const targetFov = this.activeVehicleId
      ? 70
      : this.isAiming
        ? SCOPE_META[activeScope].fov
        : this.isSprinting
          ? 68
          : 62;
    if (Math.abs(this.world.camera.fov - targetFov) > 0.1) {
      const fovRate = this.isAiming || isOpticalLens ? 34 : 18;
      this.world.camera.fov = THREE.MathUtils.damp(this.world.camera.fov, targetFov, fovRate, dt);
      this.world.camera.updateProjectionMatrix();
    }

    this.world.camera.position.copy(this.camPosCurrent);
    _v1.set(
      this.camPosCurrent.x + fwdX * 20,
      this.camPosCurrent.y + fwdY * 20,
      this.camPosCurrent.z + fwdZ * 20,
    );
    this.world.camera.lookAt(_v1);
    this.world.camera.updateMatrixWorld();
  }

  private renderActiveScene(): void {
    if (this.contextLost) return;
    const state = this.stateMachine.getState();
    const isLobbyScene =
      state === GameState.BOOT ||
      state === GameState.LOADING ||
      state === GameState.MENU ||
      state === GameState.LOBBY ||
      state === GameState.MATCHMAKING;

    if (isLobbyScene) {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.render(this.lobbyScene.scene, this.lobbyScene.camera);
    } else {
      this.renderer.setClearColor(0x0e1217, 1);
      this.renderer.render(this.world.scene, this.world.camera);
    }
  }

  private buildHudSnapshot(): HudSnapshot {
    const state = this.stateMachine.getState();
    const seaFloor = this.isBermudaMapActive() ? BERMUDA_GLB_WATER_Y : 0;
    const groundY = Math.max(seaFloor, this.world.groundHeightAt(this.pos.x, this.pos.z));
    const altitude = Math.max(0, this.pos.y - groundY);
    const activeW = this.getActiveWeaponState();
    const reloadTotal = activeW ? this.getEffectiveReloadSec(activeW) : 1;
    const nearbyLaunchPad = this.findNearbyLaunchPad();
    const nearbyAirDrop = nearbyLaunchPad ? null : this.findNearbyAirDrop();
    const nearby = nearbyLaunchPad || nearbyAirDrop ? null : this.findNearbyLoot();
    const nearbyLoots = this.activeVehicleId ? [] : this.findNearbyLoots();
    const nearbyVending = this.activeVehicleId ? null : this.findNearbyVending();
    const nearbyVeh = this.activeVehicleId ? null : this.findNearbyVehicle();
    const activeVeh = this.activeVehicleId
      ? this.world.vehicles.find((v) => v.id === this.activeVehicleId) ?? null
      : null;
    const inVehicle: VehicleHudState | null = activeVeh
      ? {
          id: activeVeh.id,
          kind: activeVeh.kind,
          name: activeVeh.name,
          hp: Math.round(activeVeh.hp),
          maxHp: activeVeh.maxHp,
          speedKmh: Math.round(Math.abs(activeVeh.speed) * 3.6),
          passengerCount: 1 + activeVeh.passengerIds.length,
          isBurning: !activeVeh.destroyed && activeVeh.hp < activeVeh.maxHp * 0.38,
        }
      : null;

    let deg = ((-this.yaw * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;

    let currentPoi: string | null = null;
    for (let i = 0; i < this.world.pois.length; i++) {
      const poi = this.world.pois[i];
      if (Math.hypot(this.pos.x - poi.x, this.pos.z - poi.z) <= poi.radius) {
        currentPoi = poi.name;
        break;
      }
    }

    const totalPlayers = 1 + this.world.targets.length;
    const playerDistZone = Math.hypot(
      this.pos.x - this.zoneCurrentX,
      this.pos.z - this.zoneCurrentZ,
    );
    const activePhaseDef =
      SAFE_ZONE_PHASES[Math.min(SAFE_ZONE_PHASES.length - 1, this.zonePhase - 1)];

    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    return {
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      vestLevel: this.vestLevel,
      vestHp: this.vestHp,
      vestMaxHp: this.vestMaxHp,
      helmetLevel: this.helmetLevel,
      helmetHp: this.helmetHp,
      helmetMaxHp: this.helmetMaxHp,
      backpackLevel: this.backpackLevel,
      backpackUsed: this.getBackpackUsedWeight(),
      backpackCapacity: this.getBackpackCapacity(),
      medkitCount: this.medkitCount,
      smallkitCount: this.smallkitCount,
      glooCount: this.glooCount,
      grenadeCount: this.grenadeCount,
      ffCoins: this.ffCoins,
      isRanked: this.isRanked,
      isPlacingGloo: this.isPlacingGloo,
      glooSkin: this.glooSkin,
      glooPlaceDistance: Math.round(this.glooPlaceDistance),
      isHoldingGrenade: this.isHoldingGrenade,
      usingMedkit: this.usingMedkit,
      medkitProgress: this.usingMedkit
        ? Math.max(
            0,
            Math.min(
              1,
              1 -
                this.medkitTimer /
                  (this.healingKind === 'smallkit' ? this.smallkitDuration : this.medkitDuration),
            ),
          )
        : 0,
      stance: this.stance,
      isSprinting: this.isSprinting,
      isAiming: this.isAiming,
      isGrounded: this.isGrounded,
      inWater: this.inWater,
      isSwimming: this.isSwimming,
      isOnSurfboard: this.isOnSurfboard,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? 1 - this.reloadTimer / reloadTotal : 0,
      isDead: this.isDead,
      isPlayerDowned: this.isPlayerDowned,
      playerBleedHp: Math.round(this.playerBleedHp),
      activeSlot: this.activeSlot,
      activeScope: activeW ? activeW.scope : 'none',
      ownedScopes: [...this.ownedScopes],
      weapons: {
        1: this.weapons[1]
          ? { ...this.weapons[1]!, attachments: { ...this.weapons[1]!.attachments } }
          : null,
        2: this.weapons[2]
          ? { ...this.weapons[2]!, attachments: { ...this.weapons[2]!.attachments } }
          : null,
        3: this.weapons[3]
          ? { ...this.weapons[3]!, attachments: { ...this.weapons[3]!.attachments } }
          : null,
      },
      backpackItems: this.backpackItems.map((it) => ({ ...it })),
      yawDeg: deg,
      playerX: this.pos.x,
      playerZ: this.pos.z,
      playerY: this.pos.y,
      altitude,
      aliveCount: this.aliveCount,
      kills: this.kills,
      damageDealt: this.damageDealt,
      zoneTimerSec: Math.ceil(this.zoneTimer),
      safeZone: {
        phase: this.zonePhase,
        totalPhases: SAFE_ZONE_PHASES.length,
        isShrinking: this.zoneIsShrinking,
        timerSec: Math.ceil(this.zoneTimer),
        currentX: this.zoneCurrentX,
        currentZ: this.zoneCurrentZ,
        currentRadius: this.zoneCurrentRadius,
        nextX: this.zoneNextX,
        nextZ: this.zoneNextZ,
        nextRadius: this.zoneNextRadius,
        damagePerSec: Math.round(
          activePhaseDef.damagePerSec * (1 + Math.floor(this.zoneGasExposureSec / 120)),
        ),
        playerOutside: state === GameState.PLAYING && playerDistZone > this.zoneCurrentRadius,
      },
      waitingTimerSec: Math.ceil(this.waitingTimer),
      matchmakingCount: Math.min(
        totalPlayers,
        Math.max(1, Math.round((this.matchmakingTimer / 2.5) * totalPlayers)),
      ),
      canJumpFromPlane: state === GameState.AIRPLANE && this.airplaneProgress >= 0.08,
      canOpenParachute: state === GameState.DROPPING,
      canVaultWindow:
        (state === GameState.PLAYING || state === GameState.WAITING) &&
        this.canVaultWindow &&
        this.isGrounded,
      nearbyLootLabel: nearbyLaunchPad
        ? nearbyLaunchPad.label
        : nearbyAirDrop
          ? 'ABRIR AIRDROP (AWM / NÍVEL 3)'
          : nearby
            ? nearby.data.label
            : null,
      nearbyLoots,
      nearbyVending: nearbyVending
        ? { id: nearbyVending.id, label: nearbyVending.label }
        : null,
      nearbyVehicle: nearbyVeh
        ? {
            id: nearbyVeh.id,
            kind: nearbyVeh.kind,
            name: nearbyVeh.name,
            hp: Math.round(nearbyVeh.hp),
            maxHp: nearbyVeh.maxHp,
          }
        : null,
      inVehicle,
      vendingLocations: this.world.vendingMachines.map((vm) => ({ x: vm.x, z: vm.z })),
      vehicleLocations: this.world.vehicles.map((v) => ({
        x: v.x,
        z: v.z,
        kind: v.kind,
        destroyed: v.destroyed,
      })),
      hitmarkerActive: this.hitmarkerTimer > 0,
      headshotFlashActive: this.headshotFlashTimer > 0,
      aimLockedTarget: this.aimLockedTarget,
      aimAssistActive: this.aimAssistActive,
      damageFlashActive: this.damageFlashTimer > 0,
      damagePopups: this.damagePopups.map((d) => ({ ...d })),
      damageIndicators: this.damageIndicators.map((di) => {
        const dx = di.worldX - this.pos.x;
        const dz = di.worldZ - this.pos.z;
        const fwdDot = dx * fwdX + dz * fwdZ;
        const rightDot = dx * rightX + dz * rightZ;
        return {
          id: di.id,
          angleRad: Math.atan2(rightDot, fwdDot),
          age: di.age,
        };
      }),
      killFeed: this.killFeed.map((k) => ({ ...k })),
      fps: this.currentFps,
      pointerLocked: this.input.pointerLocked,
      mouseSuspended: this.input.mouseSuspended,
      mouseResetNotice: performance.now() - this.input.mouseResetTimestamp < 1450,
      currentPoi:
        state === GameState.WAITING
          ? 'LOBBY DE ESPERA'
          : this.gameVariant === 'gladiadores'
            ? 'ARENA GLADIADORES'
            : currentPoi,
      matchMode: this.matchMode,
      mapId: this.brMapId,
      gameVariant: this.gameVariant,
      gladiadores:
        this.gameVariant === 'gladiadores'
          ? {
              format: this.gladiadoresFormat,
              round: this.gladRound,
              targetRounds: this.gladiadoresTargetRounds,
              playerScore: this.gladPlayerScore,
              enemyScore: this.gladEnemyScore,
              playerTeamAlive:
                (this.isDead ? 0 : 1) +
                this.world.targets.filter((b) => b.isAlly && !b.eliminated && b.downTimer <= 0).length,
              enemyTeamAlive: this.world.targets.filter(
                (b) => !b.isAlly && !b.eliminated && b.downTimer <= 0,
              ).length,
              phase: this.gladPhase,
              banner: this.gladBanner,
            }
          : undefined,
      reviveTarget: (() => {
        if (this.revivingBotId) {
          const revB = this.targetById.get(this.revivingBotId);
          if (revB && revB.isDowned && !revB.eliminated) {
            let allySlot = 2;
            for (let t = 0; t < this.world.targets.length; t++) {
              const cand = this.world.targets[t];
              if (!cand.isAlly) continue;
              if (cand === revB) break;
              allySlot++;
            }
            return {
              id: revB.id,
              slotNumber: allySlot,
              nick: revB.nick,
              bleedHp: Math.round(revB.bleedHp),
            };
          }
        }
        const nearDown = this.findNearestDownedAlly();
        if (!nearDown) return null;
        return {
          id: nearDown.bot.id,
          slotNumber: nearDown.slotNumber,
          nick: nearDown.bot.nick,
          bleedHp: Math.round(nearDown.bot.bleedHp),
        };
      })(),
      reviveProgress: this.revivingBotId
        ? Math.max(0, Math.min(1, 1 - this.reviveTimer / this.reviveDuration))
        : 0,
      revivedBy: (() => {
        if (!this.isPlayerDowned || !this.playerRevivingAllyId) return null;
        const rescuer = this.targetById.get(this.playerRevivingAllyId);
        if (!rescuer || rescuer.eliminated || rescuer.isDowned) return null;
        let allySlot = 2;
        for (let t = 0; t < this.world.targets.length; t++) {
          const cand = this.world.targets[t];
          if (!cand.isAlly) continue;
          if (cand === rescuer) break;
          allySlot++;
        }
        return {
          slotNumber: allySlot,
          nick: rescuer.nick,
          progress: Math.max(0, Math.min(1, rescuer.reviveTimer / 3.0)),
        };
      })(),
      teamMembers:
        this.matchMode === 'solo'
          ? []
          : (() => {
              const members: HudSnapshot['teamMembers'] = [
                {
                  id: 'player',
                  slotNumber: this.onlineRoomId ? this.onlineSlotInTeam : 1,
                  nick: this.playerNick,
                  hp: this.isPlayerDowned ? Math.round(this.playerBleedHp) : Math.round(this.hp),
                  maxHp: this.isPlayerDowned ? 100 : this.maxHp,
                  isDowned: this.isPlayerDowned,
                  eliminated: this.isDead,
                },
              ];

              // Include online human teammates
              if (this.onlineRoomId) {
                for (const ent of this.onlineRemotePlayers.values()) {
                  if (ent.teamId !== this.onlineTeamId) continue;
                  const st = ent.lastState;
                  const elim = Boolean(st?.eliminated);
                  const hpVal = st ? (st.isDowned ? Math.round(st.bleedHp) : Math.round(st.hp)) : 200;
                  const maxH = st?.isDowned ? 100 : st?.maxHp ?? 200;
                  let distance: number | undefined;
                  let onScreen = false;
                  let screenXPct: number | undefined;
                  let screenYPct: number | undefined;
                  let offscreenAngleRad: number | undefined;
                  const bx = ent.rig.root.position.x;
                  const by = ent.rig.root.position.y;
                  const bz = ent.rig.root.position.z;

                  if (!elim && st?.flightPhase !== 'airplane') {
                    const dx = bx - this.pos.x;
                    const dz = bz - this.pos.z;
                    distance = Math.round(Math.hypot(dx, dz));
                    const fwdDot = dx * fwdX + dz * fwdZ;
                    const rightDot = dx * rightX + dz * rightZ;
                    offscreenAngleRad = Math.atan2(rightDot, fwdDot);

                    _v1.set(bx, by + (st?.isDowned ? 1.05 : 2.15), bz).project(this.world.camera);
                    const inFront = _v1.z >= -1 && _v1.z <= 1;
                    const sx = (_v1.x * 0.5 + 0.5) * 100;
                    const sy = (-_v1.y * 0.5 + 0.5) * 100;
                    if (inFront && sx >= 4 && sx <= 96 && sy >= 6 && sy <= 92) {
                      onScreen = true;
                      screenXPct = sx;
                      screenYPct = sy;
                    }
                  }

                  members.push({
                    id: `human_${ent.accountId}`,
                    slotNumber: ent.slotInTeam,
                    nick: ent.nickname,
                    hp: hpVal,
                    maxHp: maxH,
                    isDowned: Boolean(st?.isDowned),
                    eliminated: elim,
                    distance,
                    onScreen,
                    screenXPct,
                    screenYPct,
                    offscreenAngleRad,
                    worldX: bx,
                    worldZ: bz,
                  });
                }
              }

              let allySlot = members.length + 1;
              for (let t = 0; t < this.world.targets.length; t++) {
                const b = this.world.targets[t];
                if (!b.isAlly) continue;
                const elim = b.eliminated || b.downTimer > 0;
                let distance: number | undefined;
                let onScreen = false;
                let screenXPct: number | undefined;
                let screenYPct: number | undefined;
                let offscreenAngleRad: number | undefined;
                const bx = b.group.position.x;
                const by = b.group.position.y;
                const bz = b.group.position.z;

                if (!elim && b.airState !== 'inPlane') {
                  const dx = bx - this.pos.x;
                  const dz = bz - this.pos.z;
                  distance = Math.round(Math.hypot(dx, dz));
                  const fwdDot = dx * fwdX + dz * fwdZ;
                  const rightDot = dx * rightX + dz * rightZ;
                  offscreenAngleRad = Math.atan2(rightDot, fwdDot);

                  _v1.set(bx, by + (b.isDowned ? 1.05 : 2.15), bz).project(this.world.camera);
                  const inFront = _v1.z >= -1 && _v1.z <= 1;
                  const sx = (_v1.x * 0.5 + 0.5) * 100;
                  const sy = (-_v1.y * 0.5 + 0.5) * 100;
                  if (inFront && sx >= 4 && sx <= 96 && sy >= 6 && sy <= 92) {
                    onScreen = true;
                    screenXPct = sx;
                    screenYPct = sy;
                  }
                }

                members.push({
                  id: b.id,
                  slotNumber: allySlot++,
                  nick: b.nick,
                  hp: b.isDowned ? Math.round(b.bleedHp) : Math.round(b.hp),
                  maxHp: b.isDowned ? 100 : b.maxHp,
                  isDowned: b.isDowned,
                  eliminated: elim,
                  distance,
                  onScreen,
                  screenXPct,
                  screenYPct,
                  offscreenAngleRad,
                  worldX: bx,
                  worldZ: bz,
                });
              }
              return members;
            })(),
      airDrops: this.airDrops.map((ad) => ({
        id: ad.id,
        x: ad.x,
        y: ad.y,
        z: ad.z,
        state: ad.state,
        distance: Math.round(Math.hypot(ad.x - this.pos.x, ad.z - this.pos.z)),
      })),
      airDropNotice: this.airDropNotice,
      isOnlineMatch: Boolean(this.onlineRoomId),
      autoFillBots: this.autoFillBots,
      ...(() => {
        const net = multiplayerClient.getPingInfo();
        const leader = this.findOnlineTeamLeader();
        const inFlight =
          state === GameState.AIRPLANE ||
          state === GameState.DROPPING ||
          state === GameState.PARACHUTE;
        return {
          pingMs: net.pingMs,
          isNetworkDisconnected: net.disconnected,
          showFollowLeaderToggle: Boolean(
            this.onlineRoomId && this.matchMode !== 'solo' && leader && inFlight,
          ),
          isFollowingLeader: this.followingTeamLeader,
          leaderNick: leader?.nickname ?? null,
        };
      })(),
      isSpectating: this.isSpectating,
      playerPlacement: this.playerDeathPlacement ?? Math.max(2, this.aliveCount),
      spectatorCount: this.isDead ? 0 : this.botSpectators.length,
      matchVisualLikes: this.matchVisualLikes,
      likeToast:
        this.likeToasts.length > 0
          ? {
              id: this.likeToasts[this.likeToasts.length - 1].id,
              nick: this.likeToasts[this.likeToasts.length - 1].nick,
            }
          : null,
      spectatingTarget:
        this.isSpectating && this.spectateTargetRef
          ? (() => {
              const candidates = this.getSpectateCandidates();
              const ref = this.spectateTargetRef!;
              if (ref.kind === 'human') {
                const ent = this.onlineRemotePlayers.get(ref.accountId);
                if (!ent) return null;
                const key = `h:${ent.accountId}`;
                const isTeammate = ent.teamId === this.onlineTeamId;
                const teamLabel = isTeammate
                  ? `Time ${this.onlineTeamId} (Esquadrão)`
                  : `Time ${ent.teamId}`;
                return {
                  targetKey: key,
                  isBot: false,
                  accountId: ent.accountId,
                  publicId: ent.publicId,
                  nick: ent.nickname,
                  level: ent.level,
                  rankPoints: ent.rankPoints,
                  modelId: ent.modelId,
                  hp: Math.round(ent.lastState?.hp ?? 200),
                  maxHp: ent.lastState?.maxHp ?? 200,
                  kills: ent.lastState?.kills ?? 0,
                  slotNumber: ent.slotInTeam,
                  teamLabel,
                  isFriend: false,
                  canCycle: candidates.length > 1,
                  spectatorCount: 1,
                  likedByMe: this.likedSpectateTargets.has(key),
                  isAiming: Boolean(ent.lastState?.isAiming),
                };
              }
              const bot = this.targetById.get(ref.botId);
              if (!bot) return null;
              const numHash = Array.from(bot.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
              const botLevel = 12 + (numHash % 48);
              const botRankPts = 850 + ((numHash * 73) % 2150);
              const key = `b:${bot.id}`;
              const teamLabel = bot.isAlly ? `Time ${this.onlineTeamId} (Bot Amigo)` : `Time Inimigo ${1 + (numHash % 12)}`;
              return {
                targetKey: key,
                isBot: true,
                accountId: 0,
                publicId: `BOT-${(numHash % 9000) + 1000}`,
                nick: bot.nick,
                level: botLevel,
                rankPoints: botRankPts,
                modelId: normalizeCharacterModelId(bot.modelId),
                hp: Math.max(0, Math.round(bot.hp)),
                maxHp: bot.maxHp,
                kills: bot.kills ?? 0,
                slotNumber: bot.isAlly ? 2 : 1,
                teamLabel,
                isFriend: false,
                canCycle: candidates.length > 1,
                spectatorCount: 1 + (numHash % 2),
                likedByMe: this.likedSpectateTargets.has(key),
                isAiming: bot.aiState === 'combat' && bot.fireCooldown > 0.02,
              };
            })()
          : null,
    };
  }

  private onCanvasPointerDown = (e: PointerEvent): void => {
    soundEngine.unlock();
    const state = this.stateMachine.getState();
    if (state === GameState.LOBBY || state === GameState.MENU) {
      this.lobbyDragging = true;
      this.lobbyLastX = e.clientX;
    }
  };

  private onWindowPointerMove = (e: PointerEvent): void => {
    if (!this.lobbyDragging) return;
    const dx = e.clientX - this.lobbyLastX;
    this.lobbyLastX = e.clientX;
    this.lobbyOrbitYaw += dx * 0.012;
  };

  private onWindowPointerUp = (): void => {
    this.lobbyDragging = false;
  };

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;

    this.lobbyScene.camera.aspect = w / h;
    this.lobbyScene.camera.updateProjectionMatrix();
    this.world.camera.aspect = w / h;
    this.world.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public dispose(): void {
    this.disposed = true;
    this.unsubMultiplayer?.();
    this.clearOnlineRoomState();
    this.clearLoadTimers();
    soundEngine.setFlightAudioMode('none');
    soundEngine.setLobbyMusicMode('off');
    soundEngine.stopRunAudio();
    soundEngine.stopMedkitAudio();
    soundEngine.stopVehicleAudio();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    this.renderer.domElement.removeEventListener('webglcontextlost', this.onWebGLContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onWebGLContextRestored);
    this.renderer.domElement.removeEventListener('pointerdown', this.onCanvasPointerDown);
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    window.removeEventListener('pointerup', this.onWindowPointerUp);
    window.removeEventListener('resize', this.handleResize);

    this.input.dispose();
    this.lobbyRig.dispose();
    this.playerRig.dispose();
    this.lobbyExtraRigs.forEach((r) => r.dispose());
    this.lobbyExtraRigs.length = 0;
    this.lobbyScene.dispose();
    this.world.dispose();
    this.textures.dispose();
    this.envMap.dispose();
    this.tracerGeo.dispose();
    this.tracerMat.dispose();
    this.glooAssets.dispose();
    this.grenadeLineGeo.dispose();
    this.grenadeLineMat.dispose();
    this.grenadeTargetGeo.dispose();
    this.grenadeTargetMat.dispose();
    this.grenadeProjGeo.dispose();
    this.grenadeProjMat.dispose();
    this.clearAirDrops();
    this.airDropCrateGeo.dispose();
    this.airDropStripeGeo.dispose();
    this.airDropChuteGeo.dispose();
    this.airDropCordGeo.dispose();
    this.airDropBeamGeo.dispose();
    this.airDropRingGeo.dispose();
    this.airDropCrateMat.dispose();
    this.airDropStripeMat.dispose();
    this.airDropChuteMat.dispose();
    this.airDropCordMat.dispose();
    this.healRingGeo.dispose();
    this.healRingMat.dispose();
    this.explosionGeo.dispose();
    for (let i = 0; i < this.explosionVfx.length; i++) {
      this.explosionVfx[i].mat.dispose();
    }
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
