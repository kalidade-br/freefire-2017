import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BERMUDA_GLB_MAP_RANGE,
  BERMUDA_GLB_WATER_Y,
  ExternalWorldAssets,
  MeshCollisionGrid,
  extractAirplanePropellers,
  extractBermudaBuildingSpots,
  generateBermudaMinimapCanvas,
} from './externalAssets';
import {
  cloneCharacterScene,
  FF_SCENE_SCALE,
  FFModelId,
  getModelAssetPack,
  isAdamAssetsLoaded,
  UPPER_AIM_BONE_NAMES,
} from './adamAssets';
import {
  BuildingLootPoint,
  BuildingMaterials,
  createCasaGod,
  createCasaL,
  createCeleiro,
  createEnterableHouse,
  createGuarita,
  createSobradoHouse,
} from './buildingPrefabs';
import { CharacterAnimator } from './characterAnimator';
import {
  CharacterRig,
  createBackpackGeometryGroup,
  createBandageMeshes,
  createVestGeometryGroup,
  createWeaponModel,
} from './characterBuilder';
import { ProceduralTextureSet } from './textures';
import {
  createAltiplanoSkyscraper,
  createCoastalQuiosque,
  createEstacaoCaboBranco,
  createFarolCaboBranco,
  createHotelTambau,
  createIgrejaSaoFrancisco,
  createInstancedJoaoPessoaFoliage,
  createLetreiroJoaoPessoa,
  createParqueLagoa,
  createWoodenPier,
  JpLandmarkMaterials,
} from './jpLandmarks';
import {
  AttachmentKind,
  BrMapId,
  BuildingNavZone,
  DeathBoxItemEntry,
  GraphicsQuality,
  LootItem,
  MinimapBuilding,
  MinimapRoad,
  PoiMarker,
  ScopeType,
  ShadowQuality,
  TextureQuality,
  VehicleKind,
  WalkablePlatform,
  WeaponId,
  WEAPONS,
  WorldObbCollider,
} from './types';
import { isMobileHardware } from './storage';

export interface TargetDummy {
  id: string;
  nick: string;
  isBot: boolean;
  isAdam?: boolean;
  modelId?: FFModelId;
  group: THREE.Group;
  rig?: CharacterRig;
  animator?: CharacterAnimator;
  visualRoot?: THREE.Group;
  mixer?: THREE.AnimationMixer;
  actions?: Record<string, THREE.AnimationAction>;
  activeClipName?: string;
  animAccum?: number;
  lastSyncX?: number;
  lastSyncZ?: number;
  netAnimSpeed?: number;
  upperAimBones?: Array<{ name: string; bone: THREE.Object3D }>;
  bodyMat?: THREE.MeshStandardMaterial;
  torsoGroup?: THREE.Group;
  headMesh?: THREE.Mesh;
  legLPivot?: THREE.Group;
  legRPivot?: THREE.Group;
  armLPivot?: THREE.Group;
  armRPivot?: THREE.Group;
  hitMeshes: THREE.Mesh[];
  legL?: THREE.Mesh;
  legR?: THREE.Mesh;
  armL?: THREE.Mesh;
  armR?: THREE.Mesh;
  gunMesh?: THREE.Object3D;
  backGunMesh?: THREE.Object3D;
  handWeaponMeshes?: Partial<Record<WeaponId, THREE.Group>>;
  backWeaponMeshes?: Partial<Record<WeaponId, THREE.Group>>;
  activeHandWeaponId?: WeaponId | null;
  activeBackWeaponId?: WeaponId | null;
  drawTimer?: number;
  parachuteMesh?: THREE.Mesh;
  hp: number;
  maxHp: number;
  teamId: number;
  isAlly: boolean;
  isDowned: boolean;
  bleedHp: number;
  knockedByPlayer: boolean;
  downTimer: number;
  eliminated: boolean;
  waitingActive?: boolean;
  kills: number;
  hitFlash: number;
  chestOffsetY: number;
  headOffsetY: number;
  vestLevel: 0 | 1 | 2 | 3;
  vestHp: number;
  vestMaxHp: number;
  vestMesh: THREE.Mesh | null;
  helmetLevel: 0 | 1 | 2 | 3;
  helmetHp: number;
  helmetMaxHp: number;
  helmetMesh: THREE.Mesh | null;
  weaponId: WeaponId;
  secondaryWeaponId?: WeaponId;
  pistolWeaponId?: WeaponId;
  ammoInMag: number;
  reloadTimer: number;
  ammoCount: number;
  medkits: number;
  healTimer: number;
  gloos: number;
  grenades: number;
  backpackLevel: 1 | 2 | 3;
  coins: number;
  scopes: ScopeType[];
  attachments: AttachmentKind[];
  glooCooldown: number;
  revivingMateId: string | null;
  reviveTimer: number;
  huntTimer: number;
  stuckTimer: number;
  steerSign: 1 | -1;
  steerLockTimer: number;
  navCheckX: number;
  navCheckZ: number;
  navCheckTimer: number;
  vaultTimer: number;
  jumpCooldown?: number;
  isRetreating?: boolean;
  retreatTimer?: number;
  escapeTimer: number;
  escapeDoorX: number;
  escapeDoorZ: number;
  badLootId: string | null;
  badLootTimer: number;
  airState: 'inPlane' | 'skydiving' | 'parachuting' | 'ground';
  dropProgress: number;
  landX: number;
  landZ: number;
  vy: number;
  aiState: 'roam' | 'loot' | 'combat' | 'heal' | 'revive';
  goalX: number;
  goalY: number;
  goalZ: number;
  aiTimer: number;
  fireCooldown: number;
  targetId: string | null;
  walkPhase: number;
  moveSpeed: number;
  patrolOriginX: number;
  patrolOriginZ: number;
  patrolAxisX: number;
  patrolAxisZ: number;
  patrolRange: number;
  patrolSpeed: number;
  patrolPhase: number;
}

export interface LootVisual {
  data: LootItem;
  mesh: THREE.Group;
  isDynamic?: boolean;
}

export interface ExplosiveBarrel {
  id: string;
  x: number;
  y: number;
  z: number;
  exploded: boolean;
  instanceIdx: number;
}

export interface LaunchPadProp {
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  label: string;
}

export interface VendingMachineProp {
  id: string;
  x: number;
  y: number;
  z: number;
  label: string;
}

export interface VehicleEntity {
  id: string;
  kind: VehicleKind;
  name: string;
  group: THREE.Group;
  chassisGroup: THREE.Group;
  burnedGroup: THREE.Group;
  steerFL: THREE.Group;
  steerFR: THREE.Group;
  wheelFL: THREE.Mesh;
  wheelFR: THREE.Mesh;
  wheelRL: THREE.Mesh;
  wheelRR: THREE.Mesh;
  smokeMeshes: THREE.Mesh[];
  collider: WorldObbCollider;
  spawnX: number;
  spawnZ: number;
  spawnRotY: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  driverIsPlayer: boolean;
  passengerIds: string[];
}

export interface WorldHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sunLight: THREE.DirectionalLight;
  airplaneGroup: THREE.Group;
  airplaneProps: THREE.Object3D[];
  waitLobbyGroup: THREE.Group;
  gladiadoresGroup: THREE.Group;
  waitCollisionGrid: MeshCollisionGrid;
  gladiadoresCollisionGrid: MeshCollisionGrid;
  bermudaCollisionGrid: MeshCollisionGrid;
  bermudaMinimapCanvas: HTMLCanvasElement | null;
  bermudaMapRange: number;
  getActiveBrMap: () => BrMapId;
  setActiveBrMap: (mapId: BrMapId) => void;
  attachExternalWorldModels: (assets: ExternalWorldAssets) => void;
  safeZoneMesh: THREE.Mesh;
  colliders: WorldObbCollider[];
  staticColliderCount: number;
  platforms: WalkablePlatform[];
  buildingNavZones: BuildingNavZone[];
  obstacleMeshes: THREE.Object3D[];
  buildings: MinimapBuilding[];
  roads: MinimapRoad[];
  pois: PoiMarker[];
  targets: TargetDummy[];
  loots: LootVisual[];
  explosiveBarrels: ExplosiveBarrel[];
  launchPads: LaunchPadProp[];
  vendingMachines: VendingMachineProp[];
  vehicles: VehicleEntity[];
  queryStaticCollidersNear: (
    x: number,
    z: number,
    radius: number,
    out: WorldObbCollider[],
  ) => void;
  queryStaticPlatformsNear: (x: number, z: number, out: WalkablePlatform[]) => void;
  findBuildingNavZoneAt: (x: number, z: number) => BuildingNavZone | null;
  hideExplosiveBarrel: (idx: number) => void;
  resetExplosiveBarrels: () => void;
  resetVehicles: () => void;
  groundHeightAt: (x: number, z: number) => number;
  syncProximityLoot: (px: number, pz: number, radius?: number, maxPerTick?: number) => void;
  resetMatchLoots: () => void;
  spawnDroppedLoot: (item: Omit<LootItem, 'id' | 'collected'>) => void;
  clearDroppedLoots: () => void;
  applyQuality: (
    quality: GraphicsQuality,
    isSoftwareGl: boolean,
    textureQuality?: TextureQuality,
    shadowQuality?: ShadowQuality,
  ) => void;
  updateDynamicProps: (
    dt: number,
    elapsed: number,
    camPos?: THREE.Vector3,
    lootRenderDist?: number,
    camFwdX?: number,
    camFwdZ?: number,
    isAirborne?: boolean,
  ) => void;
  dispose: () => void;
}

export const BERMUDA_HALF = 660;
export const BERMUDA_MAP_RANGE = 690;
export const HAS_SENTOSA = true;
export const WAIT_LOBBY_ORIGIN = { x: 2600, y: 18, z: 2600 } as const;
export const WAIT_SPAWN = {
  x: WAIT_LOBBY_ORIGIN.x - 2.0,
  z: WAIT_LOBBY_ORIGIN.z - 4.0,
} as const;
export const GLADIADORES_ORIGIN = { x: -2600, y: 18, z: -2600 } as const;
export const GLADIADORES_FLOOR_Y = GLADIADORES_ORIGIN.y + 0.57;
export const GLADIADORES_BOUNDS = {
  minX: GLADIADORES_ORIGIN.x - 29.0,
  maxX: GLADIADORES_ORIGIN.x - 2.0,
  minZ: GLADIADORES_ORIGIN.z - 19.0,
  maxZ: GLADIADORES_ORIGIN.z + 19.0,
} as const;
export const SENTOSA_CENTER = { x: 475, z: -265 } as const;

export const POIS: PoiMarker[] = [
  { name: 'TAMBAÚ', x: 300, z: 12, radius: 58 },
  { name: 'CABO BRANCO', x: 265, z: 185, radius: 54 },
  { name: 'FAROL DO SEIXAS', x: 265, z: 320, radius: 52 },
  { name: 'ALTIPLANO', x: 142, z: 45, radius: 58 },
  { name: 'MANAÍRA', x: 255, z: -135, radius: 54 },
  { name: 'BESSA', x: 210, z: -325, radius: 52 },
  { name: 'AREIA VERMELHA', x: 475, z: -265, radius: 52 },
  { name: 'MATA BURAQUINHO', x: 10, z: 58, radius: 60 },
  { name: 'A LAGOA', x: -175, z: -15, radius: 62 },
  { name: 'CENTRO HISTÓRICO', x: -290, z: 160, radius: 58 },
  { name: 'PRAIA DO JACARÉ', x: -225, z: -185, radius: 50 },
  { name: 'PORTO SANHAUÁ', x: -155, z: 295, radius: 54 },
  { name: 'AEROCLUBE', x: -20, z: -372, radius: 56 },
  { name: 'PONTE SANHAUÁ', x: -215, z: riverCenterZ(-215), radius: 28 },
  { name: 'PONTE DO JACARÉ', x: -20, z: riverCenterZ(-20), radius: 28 },
  { name: 'PONTE CABEDELO', x: 195, z: riverCenterZ(195), radius: 28 },
];

export function riverCenterZ(x: number): number {
  return -248 + Math.sin(x * 0.0068) * 24;
}

export function sampleMainIslandEdgeRadius(angle: number): number {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // Sweeping Atlantic crescent coastline on the East (+X) with Ponta do Seixas headland to SE
  const eastCoast =
    c > 0
      ? -95 * Math.pow(c, 1.45) + 46 * Math.exp(-Math.pow(angle - 0.84, 2) / 0.16)
      : 0;
  const northExtend = s < -0.35 ? 28 * Math.pow(-s, 2) : 0;
  const naturalVar = Math.sin(angle * 3) * 14 + Math.cos(angle * 5) * 9;
  return 486 + eastCoast + northExtend + naturalVar;
}

export function sampleSentosaEdgeRadius(relAngle: number): number {
  // Ilha de Areia Vermelha tidal reef sandbar
  return 72 + Math.sin(relAngle * 3) * 7 + Math.cos(relAngle * 2) * 5;
}

const RIVER_BRIDGES = [
  { x: -215, z: riverCenterZ(-215), deckHalfX: 4.6, deckHalfZ: 25.0, targetH: 3.4 },
  { x: -20, z: riverCenterZ(-20), deckHalfX: 5.0, deckHalfZ: 25.0, targetH: 3.6 },
  { x: 195, z: riverCenterZ(195), deckHalfX: 4.8, deckHalfZ: 25.0, targetH: 3.4 },
];

const AREIA_BRIDGE_ROT = Math.atan2(76, -18);
const AREIA_BRIDGE = { x: 386, z: -246, deckHalfX: 4.6, deckHalfZ: 42.5, targetH: 2.35 };

const BRIDGE_ABUTMENTS = [
  { x: -215, z: riverCenterZ(-215) - 25, r: 14, targetH: 3.25 },
  { x: -215, z: riverCenterZ(-215) + 25, r: 14, targetH: 3.25 },
  { x: -20, z: riverCenterZ(-20) - 25, r: 14, targetH: 3.45 },
  { x: -20, z: riverCenterZ(-20) + 25, r: 14, targetH: 3.45 },
  { x: 195, z: riverCenterZ(195) - 25, r: 14, targetH: 3.25 },
  { x: 195, z: riverCenterZ(195) + 25, r: 14, targetH: 3.25 },
  { x: 344, z: -236, r: 12, targetH: 2.2 },
  { x: 426, z: -255, r: 12, targetH: 2.2 },
];

export function nearestBridgePos(
  x: number,
  z = -248,
  mode: 'river' | 'sentosa' = 'river',
): { x: number; z: number } {
  if (mode === 'sentosa') {
    return { x: AREIA_BRIDGE.x, z: AREIA_BRIDGE.z };
  }
  let best = RIVER_BRIDGES[0];
  let bestDist = Math.hypot(x - best.x, z - best.z);
  for (let i = 1; i < RIVER_BRIDGES.length; i++) {
    const d = Math.hypot(x - RIVER_BRIDGES[i].x, z - RIVER_BRIDGES[i].z);
    if (d < bestDist) {
      bestDist = d;
      best = RIVER_BRIDGES[i];
    }
  }
  return { x: best.x, z: best.z };
}

export function botSurfaceHeightAt(
  x: number,
  z: number,
): { y: number; inWater: boolean; onBridge: boolean } {
  for (let i = 0; i < RIVER_BRIDGES.length; i++) {
    const b = RIVER_BRIDGES[i];
    if (Math.abs(x - b.x) <= b.deckHalfX && Math.abs(z - b.z) <= b.deckHalfZ) {
      return { y: b.targetH + 0.14, inWater: false, onBridge: true };
    }
  }
  // Check wooden reef bridge to Areia Vermelha
  {
    const dx = x - AREIA_BRIDGE.x;
    const dz = z - AREIA_BRIDGE.z;
    const cos = Math.cos(AREIA_BRIDGE_ROT);
    const sin = Math.sin(AREIA_BRIDGE_ROT);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) <= AREIA_BRIDGE.deckHalfX && Math.abs(lz) <= AREIA_BRIDGE.deckHalfZ) {
      return { y: AREIA_BRIDGE.targetH + 0.12, inWater: false, onBridge: true };
    }
  }
  const h = sampleGroundHeight(x, z);
  return { y: h, inWater: h < 0.42, onBridge: false };
}

const COMPOUNDS = [
  { x: 300, z: 12, r: 50, targetH: 2.0 }, // Tambaú Orla & Letreiro
  { x: 265, z: 185, r: 46, targetH: 2.6 }, // Cabo Branco Orla
  { x: 245, z: 305, r: 52, targetH: 11.2 }, // Falésia / Farol / Estação Cabo Branco plateau
  { x: 142, z: 45, r: 52, targetH: 9.0 }, // Altiplano Cabo Branco ridge
  { x: 255, z: -135, r: 48, targetH: 2.2 }, // Manaíra
  { x: 210, z: -325, r: 46, targetH: 2.1 }, // Bessa
  { x: 475, z: -265, r: 46, targetH: 1.65 }, // Ilha de Areia Vermelha
  { x: 10, z: 58, r: 54, targetH: 9.6 }, // Mata do Buraquinho
  { x: -175, z: -15, r: 62, targetH: 2.4 }, // Parque Solon de Lucena (A Lagoa)
  { x: -290, z: 160, r: 52, targetH: 4.2 }, // Centro Histórico & São Francisco
  { x: -225, z: -185, r: 44, targetH: 2.5 }, // Praia do Jacaré
  { x: -155, z: 295, r: 48, targetH: 3.4 }, // Porto / Distrito Sul
  { x: -20, z: -372, r: 52, targetH: 2.6 }, // Aeroclube / Wait Lobby
];

export function sampleGroundHeight(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  const distFromCenter = Math.hypot(x, z);
  const effectiveEdge = sampleMainIslandEdgeRadius(angle);
  const mainlandMask = THREE.MathUtils.smoothstep(effectiveEdge - distFromCenter, 0, 56);

  // Offshore Ilha de Areia Vermelha sandbar height
  const avDx = x - SENTOSA_CENTER.x;
  const avDz = z - SENTOSA_CENTER.z;
  const avDist = Math.hypot(avDx, avDz);
  const avEdge = sampleSentosaEdgeRadius(Math.atan2(avDz, avDx));
  const avMask = THREE.MathUtils.smoothstep(avEdge - avDist, 0, 26);

  // Altiplano & Mata do Buraquinho central highland plateau + Falésia cliff at SE
  const altiplanoRidge =
    Math.exp(-((x - 125) * (x - 125) / 14000 + (z - 45) * (z - 45) / 26000)) * 7.2;
  const mataHighland =
    Math.exp(-((x - 5) * (x - 5) / 16000 + (z - 60) * (z - 60) / 24000)) * 7.8;
  const falesiaCliff =
    Math.exp(-((x - 245) * (x - 245) / 9500 + (z - 310) * (z - 310) / 8500)) * 9.8;

  const gentleWave =
    Math.sin(x * 0.011) * Math.cos(z * 0.011) * 1.45 +
    Math.sin(x * 0.028 + z * 0.022) * 0.55;

  // Slope smoothly down to shallow sandy beaches along East Coast (+X > 275)
  const beachTaper =
    x > 265 ? 1 - THREE.MathUtils.smoothstep(x, 275, 345) * 0.72 : 1.0;

  let h =
    (2.8 + (altiplanoRidge + mataHighland + falesiaCliff + gentleWave) * beachTaper) *
      mainlandMask -
    (1 - mainlandMask) * 5.2;

  if (avMask > 0.01) {
    const avHeight = (1.65 + Math.sin(x * 0.04) * 0.22) * avMask - (1 - avMask) * 3.2;
    h = Math.max(h, avHeight);
  }

  // Rio Paraíba / Sanhauá channel cutting across the North
  const rz = riverCenterZ(x);
  const distRiver = Math.abs(z - rz);
  if (distRiver < 22 && distFromCenter < 480) {
    const carve = (1 - THREE.MathUtils.smoothstep(distRiver, 4.5, 22)) * 6.0;
    h -= carve;
  }

  // Gentle circular basin dip under Parque da Lagoa (-175, -15)
  const lagoaDist = Math.hypot(x + 175, z + 15);
  if (lagoaDist < 48) {
    const basin = (1 - THREE.MathUtils.smoothstep(lagoaDist, 38, 48)) * 0.65;
    h = THREE.MathUtils.lerp(h, 2.0 - basin, 0.85);
  }

  for (let i = 0; i < BRIDGE_ABUTMENTS.length; i++) {
    const ab = BRIDGE_ABUTMENTS[i];
    const d = Math.hypot(x - ab.x, z - ab.z);
    if (d < ab.r + 12) {
      const blend = 1 - THREE.MathUtils.smoothstep(d, ab.r * 0.45, ab.r + 12);
      h = THREE.MathUtils.lerp(h, ab.targetH, blend);
    }
  }

  for (let i = 0; i < COMPOUNDS.length; i++) {
    const c = COMPOUNDS[i];
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r + 24) {
      const blend = 1 - THREE.MathUtils.smoothstep(d, c.r * 0.68, c.r + 24);
      h = THREE.MathUtils.lerp(h, c.targetH, blend);
    }
  }

  return h;
}

function addLocalObb(
  colliders: WorldObbCollider[],
  parentX: number,
  parentY: number,
  parentZ: number,
  parentRotY: number,
  localX: number,
  localZ: number,
  w: number,
  d: number,
  minYOffset: number,
  maxYOffset: number,
  tag: string,
): void {
  const cos = Math.cos(parentRotY);
  const sin = Math.sin(parentRotY);
  const wx = parentX + localX * cos + localZ * sin;
  const wz = parentZ - localX * sin + localZ * cos;
  colliders.push({
    cx: wx,
    cz: wz,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY: parentRotY,
    minY: parentY + minYOffset,
    maxY: parentY + maxYOffset,
    tag,
  });
}


function createIndustrialShed(
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  rotY: number,
  metalMat: THREE.Material,
  roofMat: THREE.Material,
  concreteMat: THREE.Material,
  steelMat: THREE.Material,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): THREE.Group {
  const group = new THREE.Group();
  const y = sampleGroundHeight(x, z);
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const slabH = 0.22;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, slabH, d + 0.4), concreteMat);
  slab.position.y = slabH * 0.5;
  slab.receiveShadow = true;
  group.add(slab);
  platforms.push({
    cx: x,
    cz: z,
    halfW: (w + 0.4) * 0.5,
    halfD: (d + 0.4) * 0.5,
    rotY,
    topY: y + slabH,
    minY: y - 0.5,
  });

  const wallT = 0.26;
  const addShedWall = (lx: number, lz: number, ww: number, wd: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, h, wd), metalMat);
    m.position.set(lx, slabH + h * 0.5, lz);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.cullRoot = group;
    group.add(m);
    obstacleMeshes.push(m);
    addLocalObb(colliders, x, y, z, rotY, lx, lz, ww, wd, slabH, slabH + h, 'shed-wall');
  };

  // Left and right full walls, open front & back bays for walkthrough combat
  addShedWall(-w * 0.5 + wallT * 0.5, 0, wallT, d);
  addShedWall(w * 0.5 - wallT * 0.5, 0, wallT, d);

  // Corner steel I-beams
  [-w * 0.5 + 0.2, w * 0.5 - 0.2].forEach((bx) => {
    [-d * 0.48, 0, d * 0.48].forEach((bz) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.32, h + 0.3, 0.32), steelMat);
      col.position.set(bx, slabH + h * 0.5, bz);
      col.castShadow = true;
      group.add(col);
    });
  });

  // Curved / angled hangar roof
  const pitch = 0.28;
  const slopeW = (w * 0.5 + 0.5) / Math.cos(pitch);
  const rL = new THREE.Mesh(new THREE.BoxGeometry(slopeW, 0.16, d + 0.6), roofMat);
  rL.position.set(-w * 0.25, slabH + h + 0.35, 0);
  rL.rotation.z = pitch;
  rL.castShadow = true;
  rL.receiveShadow = true;
  rL.userData.cullRoot = group;

  const rR = new THREE.Mesh(new THREE.BoxGeometry(slopeW, 0.16, d + 0.6), roofMat);
  rR.position.set(w * 0.25, slabH + h + 0.35, 0);
  rR.rotation.z = -pitch;
  rR.castShadow = true;
  rR.receiveShadow = true;
  rR.userData.cullRoot = group;
  group.add(rL, rR);
  obstacleMeshes.push(rL, rR);

  return group;
}

function createContainer(
  x: number,
  z: number,
  rotY: number,
  mat: THREE.Material,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
  yOffset = 0,
): THREE.Group {
  const w = 2.6;
  const h = 2.7;
  const d = 6.2;
  const group = new THREE.Group();
  const baseY = sampleGroundHeight(x, z) + yOffset;
  group.position.set(x, baseY, z);
  group.rotation.y = rotY;

  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  box.position.y = h / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  box.userData.cullRoot = group;
  group.add(box);
  obstacleMeshes.push(box);

  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x262a2e,
    roughness: 0.45,
    metalness: 0.75,
  });
  const endBar = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.08, 0.16, d + 0.08),
    ribMat,
  );
  endBar.position.y = h - 0.08;
  group.add(endBar);

  colliders.push({
    cx: x,
    cz: z,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY,
    minY: baseY,
    maxY: baseY + h,
    tag: 'container',
  });
  platforms.push({
    cx: x,
    cz: z,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY,
    topY: baseY + h,
    minY: baseY,
  });

  return group;
}

function createBridge(
  x: number,
  z: number,
  width: number,
  length: number,
  deckY: number,
  rotY: number,
  deckMat: THREE.Material,
  railMat: THREE.Material,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, deckY, z);
  group.rotation.y = rotY;

  // Main deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.7, length), deckMat);
  deck.position.y = -0.35;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);
  obstacleMeshes.push(deck);

  platforms.push({
    cx: x,
    cz: z,
    halfW: width * 0.5,
    halfD: length * 0.5,
    rotY,
    topY: deckY,
    minY: deckY - 2,
  });

  // Guard rails along both sides
  const railGeo = new THREE.BoxGeometry(0.4, 1.05, length);
  const railL = new THREE.Mesh(railGeo, railMat);
  railL.position.set(-width * 0.5 + 0.2, 0.52, 0);
  railL.castShadow = true;
  const railR = new THREE.Mesh(railGeo, railMat);
  railR.position.set(width * 0.5 - 0.2, 0.52, 0);
  railR.castShadow = true;
  group.add(railL, railR);
  obstacleMeshes.push(railL, railR);

  addLocalObb(colliders, x, deckY, z, rotY, -width * 0.5 + 0.2, 0, 0.4, length, 0, 1.3, 'bridge-rail');
  addLocalObb(colliders, x, deckY, z, rotY, width * 0.5 - 0.2, 0, 0.4, length, 0, 1.3, 'bridge-rail');

  // Support pillars dipping into riverbed
  [-length * 0.3, 0, length * 0.3].forEach((pz) => {
    [-width * 0.38, width * 0.38].forEach((px) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 6.5, 8), railMat);
      pillar.position.set(px, -3.5, pz);
      pillar.castShadow = true;
      group.add(pillar);
    });
  });

  return group;
}

function createWatchTowerLOD(
  x: number,
  z: number,
  concreteMat: THREE.Material,
  metalMat: THREE.Material,
  colliders: WorldObbCollider[],
  obstacleMeshes: THREE.Object3D[],
): THREE.LOD {
  const lod = new THREE.LOD();
  const y = sampleGroundHeight(x, z);
  lod.position.set(x, y, z);

  // High detail (0..120m)
  const high = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.5, 6.0), concreteMat);
  base.position.y = 0.75;
  base.castShadow = true;
  base.receiveShadow = true;
  base.userData.cullRoot = lod;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 12.5, 10), concreteMat);
  shaft.position.y = 7.75;
  shaft.castShadow = true;
  shaft.userData.cullRoot = lod;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.55, 7.2), concreteMat);
  deck.position.y = 14.2;
  deck.castShadow = true;
  const railN = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.9, 0.2), metalMat);
  railN.position.set(0, 14.9, -3.5);
  const railS = railN.clone();
  railS.position.set(0, 14.9, 3.5);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.2, 6), metalMat);
  cap.position.y = 18.2;
  const radar = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.2, 0.8, 8), metalMat);
  radar.position.set(0, 20.0, 0);
  radar.rotation.x = 0.65;
  high.add(base, shaft, deck, railN, railS, cap, radar);
  obstacleMeshes.push(base, shaft);

  // Low detail (>120m)
  const low = new THREE.Group();
  const lowCol = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.2, 16, 6), concreteMat);
  lowCol.position.y = 8;
  const lowCap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.4, 5), metalMat);
  lowCap.position.y = 17.5;
  low.add(lowCol, lowCap);

  lod.addLevel(high, 0);
  lod.addLevel(low, 120);

  colliders.push({
    cx: x,
    cz: z,
    halfW: 3.0,
    halfD: 3.0,
    rotY: 0,
    minY: y,
    maxY: y + 15,
    tag: 'watchtower',
  });

  return lod;
}

function createVendingMachineProp(
  id: string,
  x: number,
  z: number,
  rotY: number,
  label: string,
  colliders: WorldObbCollider[],
  obstacleMeshes: THREE.Object3D[],
  groundYOverride?: number,
): { group: THREE.Group; data: VendingMachineProp } {
  const group = new THREE.Group();
  const y = groundYOverride !== undefined ? groundYOverride : sampleGroundHeight(x, z);
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const cabinetMat = new THREE.MeshStandardMaterial({
    color: 0x162231,
    roughness: 0.45,
    metalness: 0.55,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.35,
    metalness: 0.4,
    emissive: 0xd97706,
    emissiveIntensity: 0.25,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.78,
    roughness: 0.2,
    metalness: 0.1,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.3, 0.95), cabinetMat);
  body.position.y = 1.15;
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.cullRoot = group;

  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.02, 0.08), screenMat);
  screen.position.set(0, 1.38, 0.47);

  const marquee = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.3, 1.02), trimMat);
  marquee.position.set(0, 2.38, 0);

  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.25, 1.0), trimMat);
  pillarL.position.set(-0.66, 1.13, 0);
  const pillarR = pillarL.clone();
  pillarR.position.set(0.66, 1.13, 0);

  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.34, 0.16), trimMat);
  tray.position.set(0, 0.46, 0.46);

  group.add(body, screen, marquee, pillarL, pillarR, tray);
  obstacleMeshes.push(body);

  colliders.push({
    cx: x,
    cz: z,
    halfW: 0.72,
    halfD: 0.52,
    rotY,
    minY: y,
    maxY: y + 2.5,
    tag: `vending-${id}`,
  });

  return {
    group,
    data: { id, x, y, z, label },
  };
}

function createDrivableVehicle(
  id: string,
  kind: VehicleKind,
  x: number,
  z: number,
  rotY: number,
  colliders: WorldObbCollider[],
  obstacleMeshes: THREE.Object3D[],
  groundYOverride?: number,
): VehicleEntity {
  const isSports = kind === 'sport';
  const maxHp = isSports ? 420 : 620;
  const y = groundYOverride !== undefined ? groundYOverride : sampleGroundHeight(x, z);

  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const chassisGroup = new THREE.Group();
  group.add(chassisGroup);

  const bodyColor = isSports ? 0x2563eb : 0x4b5336;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: isSports ? 0.32 : 0.68,
    metalness: isSports ? 0.58 : 0.25,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: isSports ? 0x111827 : 0x2b3022,
    roughness: 0.55,
    metalness: 0.45,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18191d,
    roughness: 0.88,
    metalness: 0.08,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.3,
    metalness: 0.75,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.16,
    metalness: 0.65,
    transparent: true,
    opacity: 0.72,
  });
  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.6,
  });

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(isSports ? 1.98 : 1.96, isSports ? 0.62 : 0.74, isSports ? 4.1 : 3.9),
    bodyMat,
  );
  hull.position.y = isSports ? 0.64 : 0.78;
  hull.castShadow = true;
  hull.receiveShadow = true;
  hull.userData.vehicleId = id;

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(isSports ? 1.82 : 1.76, isSports ? 0.36 : 0.44, isSports ? 1.45 : 1.3),
    bodyMat,
  );
  hood.position.set(0, isSports ? 0.84 : 1.05, isSports ? 1.2 : 1.15);
  hood.castShadow = true;
  hood.userData.vehicleId = id;

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(isSports ? 1.72 : 1.82, isSports ? 0.62 : 0.84, isSports ? 1.75 : 2.0),
    isSports ? accentMat : bodyMat,
  );
  cabin.position.set(0, isSports ? 1.2 : 1.52, isSports ? -0.35 : -0.52);
  cabin.castShadow = true;
  cabin.userData.vehicleId = id;

  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.56, isSports ? 0.45 : 0.55, 0.08),
    glassMat,
  );
  windshield.position.set(0, isSports ? 1.22 : 1.54, isSports ? 0.54 : 0.46);
  windshield.rotation.x = isSports ? -0.35 : -0.18;

  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.24, 0.22), accentMat);
  bumperF.position.set(0, 0.45, isSports ? 2.08 : 1.98);
  const bumperR = bumperF.clone();
  bumperR.position.set(0, 0.48, isSports ? -2.08 : -1.98);

  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), headLightMat);
  hlL.position.set(-0.68, isSports ? 0.72 : 0.86, isSports ? 2.06 : 1.96);
  const hlR = hlL.clone();
  hlR.position.x = 0.68;

  chassisGroup.add(hull, hood, cabin, windshield, bumperF, bumperR, hlL, hlR);

  if (isSports) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.1, 0.34), accentMat);
    spoiler.position.set(0, 1.28, -1.86);
    chassisGroup.add(spoiler);
  } else {
    const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.24, 10), tireMat);
    spareTire.rotation.x = Math.PI / 2;
    spareTire.position.set(0, 0.96, -2.02);
    chassisGroup.add(spareTire);
  }

  obstacleMeshes.push(hull, cabin);

  // Wheels + Front Steering Pivots
  const wheelRadius = isSports ? 0.36 : 0.42;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(wheelRadius * 0.52, wheelRadius * 0.52, 0.32, 8);
  hubGeo.rotateZ(Math.PI / 2);

  const buildWheelMesh = () => {
    const wMesh = new THREE.Mesh(wheelGeo, tireMat);
    wMesh.castShadow = false;
    const hub = new THREE.Mesh(hubGeo, rimMat);
    wMesh.add(hub);
    return wMesh;
  };

  const frontZ = isSports ? 1.26 : 1.2;
  const rearZ = isSports ? -1.26 : -1.2;
  const trackX = 0.99;

  const steerFL = new THREE.Group();
  steerFL.position.set(-trackX, wheelRadius, frontZ);
  const wheelFL = buildWheelMesh();
  steerFL.add(wheelFL);

  const steerFR = new THREE.Group();
  steerFR.position.set(trackX, wheelRadius, frontZ);
  const wheelFR = buildWheelMesh();
  steerFR.add(wheelFR);

  const wheelRL = buildWheelMesh();
  wheelRL.position.set(-trackX, wheelRadius, rearZ);

  const wheelRR = buildWheelMesh();
  wheelRR.position.set(trackX, wheelRadius, rearZ);

  chassisGroup.add(steerFL, steerFR, wheelRL, wheelRR);

  // Smoke & flame puff spheres over engine hood (<35% HP)
  const smokeMeshes: THREE.Mesh[] = [];
  const smokeGeo = new THREE.SphereGeometry(0.42, 8, 6);
  for (let s = 0; s < 3; s++) {
    const sMat = new THREE.MeshBasicMaterial({
      color: s === 0 ? 0xf97316 : 0x262626,
      transparent: true,
      opacity: 0.72,
    });
    const sm = new THREE.Mesh(smokeGeo, sMat);
    sm.position.set((s - 1) * 0.25, 1.35 + s * 0.42, 1.25);
    sm.visible = false;
    chassisGroup.add(sm);
    smokeMeshes.push(sm);
  }

  // Charred Wreck shown on 0 HP destruction
  const burnedGroup = new THREE.Group();
  burnedGroup.visible = false;
  const charMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.95,
    metalness: 0.15,
  });
  const wreckedHull = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.72, 3.85), charMat);
  wreckedHull.position.y = 0.45;
  wreckedHull.rotation.z = 0.04;
  wreckedHull.userData.vehicleId = id;
  const wreckedCab = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.65, 1.85), charMat);
  wreckedCab.position.set(0, 1.02, -0.45);
  wreckedCab.rotation.z = -0.05;
  wreckedCab.userData.vehicleId = id;
  burnedGroup.add(wreckedHull, wreckedCab);
  group.add(burnedGroup);

  const collider: WorldObbCollider = {
    cx: x,
    cz: z,
    halfW: 1.05,
    halfD: isSports ? 2.08 : 2.0,
    rotY,
    minY: y,
    maxY: y + 2.05,
    tag: `vehicle-${id}`,
  };
  colliders.push(collider);

  return {
    id,
    kind,
    name: isSports ? 'Esportivo Turbo' : 'Jipe Militar',
    group,
    chassisGroup,
    burnedGroup,
    steerFL,
    steerFR,
    wheelFL,
    wheelFR,
    wheelRL,
    wheelRR,
    smokeMeshes,
    collider,
    spawnX: x,
    spawnZ: z,
    spawnRotY: rotY,
    x,
    y,
    z,
    yaw: rotY,
    speed: 0,
    hp: maxHp,
    maxHp,
    destroyed: false,
    driverIsPlayer: false,
    passengerIds: [],
  };
}

const BOT_SHIRT_PALETTE = [
  0xf1f0ea, 0x26313a, 0x8d2b24, 0x3b4d34, 0xd98a3b, 0x2c4b6e, 0x5c3e66,
];
const BOT_PANTS_PALETTE = [
  0xc9b396, 0x2c333f, 0x3b424d, 0x4b4234, 0x222730,
];

const BOT_EMPTY_WEAPON_RECORD = {} as Record<WeaponId, THREE.Group>;
const BOT_SHARED_MUZZLE_GEO = new THREE.ConeGeometry(0.085, 0.24, 6);
const BOT_SHARED_MUZZLE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffc845,
  transparent: true,
  opacity: 0.92,
});
const BOT_SHARED_SHADOW_GEO = new THREE.PlaneGeometry(0.01, 0.01);
const BOT_SHARED_SHADOW_MAT = new THREE.MeshBasicMaterial({ visible: false });

function createBotEntity(
  id: string,
  nick: string,
  x: number,
  z: number,
  rotY: number,
  idx: number,
  camoTexture: THREE.Texture,
  weaponId: WeaponId,
  vestLevel: 0 | 1 | 2 | 3 = 0,
  helmetLevel: 0 | 1 | 2 | 3 = 0,
): TargetDummy {
  const group = new THREE.Group();
  const y = sampleGroundHeight(x, z);
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const pantsMat = new THREE.MeshStandardMaterial({
    color: BOT_PANTS_PALETTE[idx % BOT_PANTS_PALETTE.length],
    roughness: 0.85,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: BOT_SHIRT_PALETTE[idx % BOT_SHIRT_PALETTE.length],
    roughness: 0.68,
  });
  const skinColors = [0xd7a27e, 0xc98e6b, 0xe2b291, 0x9b684b];
  const headMat = new THREE.MeshStandardMaterial({
    color: skinColors[idx % skinColors.length],
    roughness: 0.58,
  });

  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  group.add(pelvis);

  const torso = new THREE.Group();
  torso.position.set(0, 0.08, 0);
  pelvis.add(torso);

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.48, 10), bodyMat);
  chest.scale.set(1.06, 1, 0.68);
  chest.position.y = 0.24;
  chest.castShadow = true;
  chest.userData.targetId = id;
  torso.add(chest);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.48, 0);
  torso.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), headMat);
  head.scale.set(0.94, 1.06, 0.98);
  head.position.y = 0.18;
  head.castShadow = true;
  head.userData.targetId = id;
  head.userData.isHeadshot = true;
  headGroup.add(head);

  // Articulated legs with knees matching createProceduralCharacterRig
  const legLPivot = new THREE.Group();
  legLPivot.position.set(-0.095, -0.05, 0);
  pelvis.add(legLPivot);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.064, 0.42, 8), pantsMat);
  legL.position.y = -0.21;
  legL.castShadow = true;
  legLPivot.add(legL);
  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.42, 0);
  legLPivot.add(leftKnee);
  const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.046, 0.42, 8), pantsMat);
  shinL.position.y = -0.21;
  shinL.castShadow = true;
  leftKnee.add(shinL);

  const legRPivot = new THREE.Group();
  legRPivot.position.set(0.095, -0.05, 0);
  pelvis.add(legRPivot);
  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.064, 0.42, 8), pantsMat);
  legR.position.y = -0.21;
  legR.castShadow = true;
  legRPivot.add(legR);
  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.42, 0);
  legRPivot.add(rightKnee);
  const shinR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.046, 0.42, 8), pantsMat);
  shinR.position.y = -0.21;
  shinR.castShadow = true;
  rightKnee.add(shinR);

  // Vest & Helmet (hidden visuals — compatibility proxies)
  const vestMat = new THREE.MeshStandardMaterial({
    color: vestLevel === 3 ? 0x1c1f26 : vestLevel === 2 ? 0x2f3842 : 0x4d5d3d,
    roughness: 0.55,
    metalness: vestLevel === 3 ? 0.45 : 0.15,
  });
  const vestMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.36, 10), vestMat);
  vestMesh.scale.set(1.06, 1, 0.72);
  vestMesh.position.y = 0.24;
  vestMesh.visible = false;
  torso.add(vestMesh);

  const helmMat = new THREE.MeshStandardMaterial({
    color: helmetLevel === 3 ? 0x181a1f : helmetLevel === 2 ? 0x2c343d : 0x566444,
    roughness: 0.45,
    metalness: helmetLevel === 3 ? 0.55 : 0.2,
  });
  const helmetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
    helmMat,
  );
  helmetMesh.position.y = 0.2;
  helmetMesh.visible = false;
  headGroup.add(helmetMesh);

  // Articulated arms with elbows matching createProceduralCharacterRig
  const armLPivot = new THREE.Group();
  armLPivot.position.set(-0.24, 0.42, 0);
  torso.add(armLPivot);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.25, 8), bodyMat);
  armL.position.set(0, -0.125, 0);
  armLPivot.add(armL);
  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.25, 0);
  armLPivot.add(leftElbow);
  const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.036, 0.24, 8), headMat);
  forearmL.position.set(0, -0.12, 0);
  leftElbow.add(forearmL);

  const armRPivot = new THREE.Group();
  armRPivot.position.set(0.24, 0.42, 0);
  torso.add(armRPivot);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.25, 8), bodyMat);
  armR.position.set(0, -0.125, 0);
  armRPivot.add(armR);
  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.25, 0);
  armRPivot.add(rightElbow);
  const forearmR = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.036, 0.24, 8), headMat);
  forearmR.position.set(0, -0.12, 0);
  rightElbow.add(forearmR);

  const bandage = createBandageMeshes();
  bandage.rollGroup.position.set(0, -0.25, 0.03);
  rightElbow.add(bandage.rollGroup);
  bandage.wrapGroup.position.set(0, -0.12, 0);
  leftElbow.add(bandage.wrapGroup);

  const gunPivot = new THREE.Group();
  gunPivot.position.set(0, -0.25, 0.04);
  gunPivot.rotation.x = Math.PI / 2;
  rightElbow.add(gunPivot);

  const muzzleFlash = new THREE.Mesh(BOT_SHARED_MUZZLE_GEO, BOT_SHARED_MUZZLE_MAT);
  muzzleFlash.position.set(0, -0.25, 0.6);
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.visible = false;
  rightElbow.add(muzzleFlash);

  // Diagonal slung weapon on bot's back
  const backGunPivot = new THREE.Group();
  backGunPivot.position.set(0.095, 0.28, -0.125);
  backGunPivot.rotation.set(-Math.PI * 0.44, 0.06, -0.18);
  backGunPivot.visible = false;
  torso.add(backGunPivot);

  // Bot Camo Parachute Canopy
  const parachuteGroup = new THREE.Group();
  const parachuteMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.7, 1.0, 8, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({
      map: camoTexture,
      roughness: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  parachuteMesh.rotation.z = Math.PI / 2;
  parachuteMesh.rotation.y = Math.PI / 2;
  parachuteMesh.position.set(0, 1.8, 0);
  parachuteMesh.scale.set(0.55, 1.3, 0.95);
  parachuteGroup.add(parachuteMesh);
  parachuteGroup.position.set(0, 1.45, 0);
  parachuteGroup.visible = false;
  torso.add(parachuteGroup);

  const dummyBackMount1 = new THREE.Group();
  const dummyBackMount2 = new THREE.Group();
  const surfboardGroup = new THREE.Group();
  surfboardGroup.visible = false;
  const contactShadow = new THREE.Mesh(BOT_SHARED_SHADOW_GEO, BOT_SHARED_SHADOW_MAT);
  contactShadow.visible = false;

  const setBandageVisible = (visible: boolean) => {
    bandage.rollGroup.visible = visible;
    bandage.wrapGroup.visible = visible;
  };

  const rig: CharacterRig = {
    isAdam: false,
    root: group,
    pelvis,
    torso,
    headGroup,
    leftShoulder: armLPivot,
    leftElbow,
    rightShoulder: armRPivot,
    rightElbow,
    leftHip: legLPivot,
    leftKnee,
    rightHip: legRPivot,
    rightKnee,
    weaponMount: gunPivot,
    backMount1: dummyBackMount1,
    backMount2: dummyBackMount2,
    muzzleFlash,
    parachuteGroup,
    surfboardGroup,
    contactShadow,
    weaponMeshes: BOT_EMPTY_WEAPON_RECORD,
    bodyMeshes: [],
    setWeapon: () => {},
    setBackWeapons: () => {},
    setParachuteVisible: (visible: boolean) => {
      parachuteGroup.visible = visible;
      parachuteMesh.visible = visible;
    },
    setSurfboardVisible: (visible: boolean) => {
      surfboardGroup.visible = visible;
    },
    setBandageVisible,
    setHitFlash: () => {},
    applyConfig: () => {},
    dispose: () => {
      bandage.dispose();
    },
  };

  const vestMaxHp = vestLevel === 0 ? 0 : vestLevel === 1 ? 100 : vestLevel === 2 ? 160 : 220;
  const helmetMaxHp =
    helmetLevel === 0 ? 0 : helmetLevel === 1 ? 75 : helmetLevel === 2 ? 120 : 180;

  const bot: TargetDummy = {
    id,
    nick,
    isBot: true,
    group,
    rig,
    animator: new CharacterAnimator(),
    torsoGroup: torso,
    headMesh: head,
    legLPivot,
    legRPivot,
    armLPivot,
    armRPivot,
    hitMeshes: [chest, head],
    legL,
    legR,
    armL,
    armR,
    gunMesh: gunPivot,
    backGunMesh: backGunPivot,
    handWeaponMeshes: {},
    backWeaponMeshes: {},
    activeHandWeaponId: null,
    activeBackWeaponId: null,
    drawTimer: 0,
    parachuteMesh,
    hp: 200,
    maxHp: 200,
    teamId: idx + 1,
    isAlly: false,
    isDowned: false,
    bleedHp: 100,
    knockedByPlayer: false,
    downTimer: 0,
    eliminated: false,
    kills: 0,
    hitFlash: 0,
    chestOffsetY: 1.18,
    headOffsetY: 1.69,
    vestLevel,
    vestHp: vestMaxHp,
    vestMaxHp,
    vestMesh,
    helmetLevel,
    helmetHp: helmetMaxHp,
    helmetMaxHp,
    helmetMesh,
    weaponId,
    secondaryWeaponId: undefined,
    pistolWeaponId: weaponId === 'g18' || weaponId === 'deagle' ? weaponId : undefined,
    ammoInMag: 15,
    reloadTimer: 0,
    ammoCount: 45,
    medkits: 2,
    healTimer: 0,
    gloos: 0,
    grenades: 0,
    backpackLevel: 1,
    coins: 100,
    scopes: [],
    attachments: [],
    glooCooldown: 0,
    revivingMateId: null,
    reviveTimer: 0,
    huntTimer: 1 + (idx % 4) * 0.6,
    stuckTimer: 0,
    steerSign: idx % 2 === 0 ? 1 : -1,
    steerLockTimer: 0,
    navCheckX: x,
    navCheckZ: z,
    navCheckTimer: 0,
    vaultTimer: 0,
    jumpCooldown: 0,
    isRetreating: false,
    retreatTimer: 0,
    escapeTimer: 0,
    escapeDoorX: x,
    escapeDoorZ: z,
    badLootId: null,
    badLootTimer: 0,
    airState: 'ground',
    dropProgress: 0.1 + (idx / 50) * 0.78,
    landX: x,
    landZ: z,
    vy: 0,
    aiState: 'roam',
    goalX: x,
    goalY: y,
    goalZ: z,
    aiTimer: (idx % 5) * 0.25,
    fireCooldown: 0.6 + (idx % 4) * 0.2,
    targetId: null,
    walkPhase: idx * 0.7,
    moveSpeed: 3.15 + (idx % 3) * 0.25,
    patrolOriginX: x,
    patrolOriginZ: z,
    patrolAxisX: 0,
    patrolAxisZ: 0,
    patrolRange: 0,
    patrolSpeed: 0,
    patrolPhase: idx,
  };
  setBotWeaponVisual(bot, weaponId, null);
  return bot;
}

export function setBotWeaponVisual(
  bot: TargetDummy,
  activeWeaponId: WeaponId | null,
  backWeaponId?: WeaponId | null,
): void {
  if (bot.gunMesh) {
    if (!bot.handWeaponMeshes) bot.handWeaponMeshes = {};
    const prevId = bot.activeHandWeaponId;
    if (prevId && prevId !== activeWeaponId && bot.handWeaponMeshes[prevId]) {
      bot.handWeaponMeshes[prevId]!.visible = false;
    }
    if (activeWeaponId) {
      let mesh = bot.handWeaponMeshes[activeWeaponId];
      if (!mesh) {
        mesh = createWeaponModel(activeWeaponId);
        if (bot.isAdam) {
          mesh.position.set(0, -0.02, 0.05);
        } else {
          mesh.position.set(0, 0, 0.02);
        }
        bot.handWeaponMeshes[activeWeaponId] = mesh;
        bot.gunMesh.add(mesh);
      }
      mesh.visible = true;
    }
    bot.activeHandWeaponId = activeWeaponId;
  }

  if (bot.backGunMesh) {
    if (!bot.backWeaponMeshes) bot.backWeaponMeshes = {};
    const resolvedBack = backWeaponId && backWeaponId !== activeWeaponId ? backWeaponId : null;
    const prevBackId = bot.activeBackWeaponId;
    if (prevBackId && prevBackId !== resolvedBack && bot.backWeaponMeshes[prevBackId]) {
      bot.backWeaponMeshes[prevBackId]!.visible = false;
    }
    if (resolvedBack) {
      let backMesh = bot.backWeaponMeshes[resolvedBack];
      if (!backMesh) {
        backMesh = createWeaponModel(resolvedBack);
        backMesh.position.set(0, 0, 0);
        bot.backWeaponMeshes[resolvedBack] = backMesh;
        bot.backGunMesh.add(backMesh);
      }
      backMesh.visible = true;
      bot.backGunMesh.visible = true;
    } else {
      bot.backGunMesh.visible = false;
    }
    bot.activeBackWeaponId = resolvedBack;
  }
}

const BOT_HIT_PROXY_MAT = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
});
const BOT_CHEST_PROXY_GEO = new THREE.BoxGeometry(0.42, 0.56, 0.3);
const BOT_HEAD_PROXY_GEO = new THREE.BoxGeometry(0.26, 0.28, 0.26);
const BOT_VEST_GEO = new THREE.CylinderGeometry(0.175, 0.155, 0.31, 10);
const BOT_HELMET_GEO = new THREE.SphereGeometry(0.122, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
const BOT_PACK_GEO = new THREE.BoxGeometry(0.24, 0.32, 0.14);
const BOT_PACK_MAT = new THREE.MeshStandardMaterial({
  color: 0x353b30,
  roughness: 0.78,
  metalness: 0.1,
});

export function upgradeBotsToAdam(
  targets: TargetDummy[],
  camoTexture: THREE.Texture,
): void {
  if (!isAdamAssetsLoaded()) return;

  const vestMats: Record<1 | 2 | 3, THREE.MeshStandardMaterial> = {
    1: new THREE.MeshStandardMaterial({ color: 0x4d5d3d, roughness: 0.55, metalness: 0.15 }),
    2: new THREE.MeshStandardMaterial({ color: 0x2f3842, roughness: 0.55, metalness: 0.15 }),
    3: new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.55, metalness: 0.45 }),
  };
  const helmMats: Record<1 | 2 | 3, THREE.MeshStandardMaterial> = {
    1: new THREE.MeshStandardMaterial({ color: 0x566444, roughness: 0.45, metalness: 0.2 }),
    2: new THREE.MeshStandardMaterial({ color: 0x2c343d, roughness: 0.45, metalness: 0.2 }),
    3: new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.45, metalness: 0.55 }),
  };
  const sharedParachuteGeo = new THREE.CylinderGeometry(1.45, 1.7, 1.0, 8, 1, true, 0, Math.PI);
  const sharedParachuteMat = new THREE.MeshStandardMaterial({
    map: camoTexture,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const armUpVec = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < targets.length; i++) {
    const bot = targets[i];
    if (bot.isAdam) continue;

    // Clean up initial procedural children & geometries
    bot.rig?.dispose();
    bot.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && !obj.userData?.sharedWeaponAsset) {
        (obj as THREE.Mesh).geometry?.dispose();
      }
    });
    while (bot.group.children.length > 0) {
      bot.group.remove(bot.group.children[0]);
    }

    const BOT_MODEL_POOL: readonly FFModelId[] = ['adam', 'eva', 'maxim', 'kelly'];
    const modelId: FFModelId = BOT_MODEL_POOL[i % BOT_MODEL_POOL.length];
    const pack = getModelAssetPack(modelId);
    const cloned = cloneCharacterScene(modelId);
    if (!cloned || !pack) continue;

    const visualRoot = new THREE.Group();
    visualRoot.add(cloned);
    bot.group.add(visualRoot);

    let bodyMat: THREE.MeshStandardMaterial | undefined;
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = bot.isAlly;
      mesh.receiveShadow = bot.isAlly;
      mesh.frustumCulled = false;
      const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (origMat && (origMat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const clonedMat = (origMat as THREE.MeshStandardMaterial).clone();
        clonedMat.roughness = Math.max(0.62, clonedMat.roughness ?? 0.78);
        clonedMat.metalness = Math.min(0.12, clonedMat.metalness ?? 0.04);
        mesh.material = clonedMat;
        if (!bodyMat) bodyMat = clonedMat;
      }
    });

    const adamPelvisBone = cloned.getObjectByName('mixamorigHips') ?? null;
    const adamSpineBone = cloned.getObjectByName('mixamorigSpine1') ?? adamPelvisBone;
    const spineBone = cloned.getObjectByName('mixamorigSpine2') ?? adamSpineBone ?? cloned;
    const headBone = cloned.getObjectByName('mixamorigHead') ?? spineBone;
    const handRBone = cloned.getObjectByName('mixamorigRightHand') ?? spineBone;
    const adamThighLBone = cloned.getObjectByName('mixamorigLeftUpLeg') ?? null;
    const adamThighRBone = cloned.getObjectByName('mixamorigRightUpLeg') ?? null;
    const adamShinLBone = cloned.getObjectByName('mixamorigLeftLeg') ?? null;
    const adamShinRBone = cloned.getObjectByName('mixamorigRightLeg') ?? null;
    const adamUpperArmLBone = cloned.getObjectByName('mixamorigLeftArm') ?? null;
    const adamUpperArmRBone = cloned.getObjectByName('mixamorigRightArm') ?? null;
    const adamLowerArmLBone = cloned.getObjectByName('mixamorigLeftForeArm') ?? null;
    const adamHandLBone = cloned.getObjectByName('mixamorigLeftHand') ?? null;
    const adamLowerArmRBone = cloned.getObjectByName('mixamorigRightForeArm') ?? null;
    const upperAimBones: Array<{ name: string; bone: THREE.Object3D }> = [];
    for (let b = 0; b < UPPER_AIM_BONE_NAMES.length; b++) {
      const bName = UPPER_AIM_BONE_NAMES[b];
      const bone = cloned.getObjectByName(bName);
      if (bone) upperAimBones.push({ name: bName, bone });
    }

    const invScale = 1 / FF_SCENE_SCALE;
    const spineMount = new THREE.Group();
    spineMount.quaternion.copy(pack.spineMountQuat);
    spineMount.scale.setScalar(invScale);
    spineBone.add(spineMount);

    const headMount = new THREE.Group();
    headMount.quaternion.copy(pack.headMountQuat);
    headMount.scale.setScalar(invScale);
    headBone.add(headMount);

    // Invisible fast bone-attached hit proxies (zero SkinnedMesh raycasting overhead)
    const chestHit = new THREE.Mesh(BOT_CHEST_PROXY_GEO, BOT_HIT_PROXY_MAT);
    chestHit.position.set(0, -0.02, 0);
    chestHit.userData.targetId = bot.id;
    spineMount.add(chestHit);

    const headHit = new THREE.Mesh(BOT_HEAD_PROXY_GEO, BOT_HIT_PROXY_MAT);
    headHit.position.set(0, pack.helmetOffsetY - 0.01, 0.01);
    headHit.userData.targetId = bot.id;
    headHit.userData.isHeadshot = true;
    headMount.add(headHit);

    // Vest & Helmet kept hidden so only base model + backpack render
    const vestMesh = new THREE.Mesh(
      BOT_VEST_GEO,
      vestMats[(bot.vestLevel || 1) as 1 | 2 | 3],
    );
    vestMesh.scale.set(1.06, 1, 0.68);
    vestMesh.position.set(0, -0.02, 0.015);
    vestMesh.visible = false;
    spineMount.add(vestMesh);

    const helmetMesh = new THREE.Mesh(
      BOT_HELMET_GEO,
      helmMats[(bot.helmetLevel || 1) as 1 | 2 | 3],
    );
    helmetMesh.scale.set(0.98, 1.02, 1.08);
    helmetMesh.position.set(0, pack.helmetOffsetY, 0.005);
    helmetMesh.visible = false;
    headMount.add(helmetMesh);

    const backpackMesh = new THREE.Mesh(BOT_PACK_GEO, BOT_PACK_MAT);
    backpackMesh.position.set(0, -0.01, -0.105);
    spineMount.add(backpackMesh);

    // Gun held in mixamorigRightHand via calibrated metric weaponMount + slung back gun
    const gunPivot = new THREE.Group();
    gunPivot.quaternion.copy(pack.weaponMountQuat);
    gunPivot.scale.setScalar(invScale);
    handRBone.add(gunPivot);

    const muzzleFlash = new THREE.Mesh(BOT_SHARED_MUZZLE_GEO, BOT_SHARED_MUZZLE_MAT);
    muzzleFlash.position.set(0, 0.02, 0.41);
    muzzleFlash.rotation.x = Math.PI / 2;
    muzzleFlash.visible = false;
    gunPivot.add(muzzleFlash);

    // White bandage healing meshes (identical to player rig)
    const bandage = createBandageMeshes();
    const bandageHandMount = new THREE.Group();
    bandageHandMount.quaternion.copy(pack.weaponMountQuat);
    bandageHandMount.scale.setScalar(invScale);
    bandageHandMount.position.set(0, 0.04, 0.02);
    handRBone.add(bandageHandMount);
    bandageHandMount.add(bandage.rollGroup);

    const bandageArmMount = new THREE.Group();
    bandageArmMount.scale.setScalar(invScale);
    if (adamLowerArmLBone) {
      if (adamHandLBone && adamHandLBone.position.lengthSq() > 1e-4) {
        bandageArmMount.position.copy(adamHandLBone.position).multiplyScalar(0.52);
        const armDir = adamHandLBone.position.clone().normalize();
        bandageArmMount.quaternion.setFromUnitVectors(armUpVec, armDir);
      } else {
        bandageArmMount.position.set(0, 0.12, 0);
      }
      adamLowerArmLBone.add(bandageArmMount);
    }
    bandageArmMount.add(bandage.wrapGroup);

    const backGunPivot = new THREE.Group();
    backGunPivot.position.set(-0.095, 0.05, -0.105);
    backGunPivot.rotation.set(-Math.PI * 0.44, 0.06, -0.18);
    backGunPivot.visible = false;
    spineMount.add(backGunPivot);

    const parachuteGroup = new THREE.Group();
    const parachuteMesh = new THREE.Mesh(sharedParachuteGeo, sharedParachuteMat);
    parachuteMesh.rotation.z = Math.PI / 2;
    parachuteMesh.rotation.y = Math.PI / 2;
    parachuteMesh.position.set(0, 3.25, 0);
    parachuteMesh.scale.set(0.55, 1.3, 0.95);
    parachuteGroup.add(parachuteMesh);
    parachuteGroup.visible = false;
    visualRoot.add(parachuteGroup);

    const mixer = new THREE.AnimationMixer(cloned);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (let c = 0; c < pack.animations.length; c++) {
      const clip = pack.animations[c];
      const act = mixer.clipAction(clip);
      if (clip.name === 'Death01') {
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
      } else if (clip.name === 'Punch_Jab' || clip.name === 'Punch_Cross') {
        act.setLoop(THREE.LoopOnce, 1);
      } else {
        act.setLoop(THREE.LoopRepeat, Infinity);
      }
      actions[clip.name] = act;
    }

    const idleAct = actions.Idle_Loop ?? Object.values(actions)[0];
    if (idleAct) {
      idleAct.play();
      mixer.update(0);
      bot.activeClipName = idleAct.getClip().name;
    }

    const dummyGroup = new THREE.Group();
    const surfboardGroup = new THREE.Group();
    surfboardGroup.visible = false;
    const contactShadow = new THREE.Mesh(BOT_SHARED_SHADOW_GEO, BOT_SHARED_SHADOW_MAT);
    contactShadow.visible = false;

    const rig: CharacterRig = {
      isAdam: true,
      modelId,
      root: bot.group,
      adamVisualRoot: visualRoot,
      mixer,
      actions,
      activeClipName: bot.activeClipName,
      adamPelvisBone,
      adamSpineBone,
      adamHeadBone: headBone,
      adamHandRBone: handRBone,
      adamThighLBone,
      adamThighRBone,
      adamShinLBone,
      adamShinRBone,
      adamUpperArmLBone,
      adamUpperArmRBone,
      adamLowerArmLBone,
      adamLowerArmRBone,
      adamUpperBones: upperAimBones,
      pelvis: dummyGroup,
      torso: dummyGroup,
      headGroup: dummyGroup,
      leftShoulder: dummyGroup,
      leftElbow: dummyGroup,
      rightShoulder: dummyGroup,
      rightElbow: dummyGroup,
      leftHip: dummyGroup,
      leftKnee: dummyGroup,
      rightHip: dummyGroup,
      rightKnee: dummyGroup,
      weaponMount: gunPivot,
      backMount1: dummyGroup,
      backMount2: dummyGroup,
      muzzleFlash,
      parachuteGroup,
      surfboardGroup,
      contactShadow,
      weaponMeshes: BOT_EMPTY_WEAPON_RECORD,
      bodyMeshes: [],
      setWeapon: () => {},
      setBackWeapons: () => {},
      setParachuteVisible: (visible: boolean) => {
        parachuteGroup.visible = visible;
        parachuteMesh.visible = visible;
      },
      setSurfboardVisible: (visible: boolean) => {
        surfboardGroup.visible = visible;
      },
      setBandageVisible: (visible: boolean) => {
        bandage.rollGroup.visible = visible;
        bandage.wrapGroup.visible = visible;
      },
      setHitFlash: () => {},
      applyConfig: () => {},
      dispose: () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(cloned);
        bandage.dispose();
      },
    };

    bot.isAdam = true;
    bot.modelId = modelId;
    bot.rig = rig;
    bot.animator = new CharacterAnimator();
    bot.visualRoot = visualRoot;
    bot.mixer = mixer;
    bot.actions = actions;
    bot.upperAimBones = upperAimBones;
    bot.bodyMat = bodyMat;
    bot.torsoGroup = undefined;
    bot.headMesh = undefined;
    bot.legLPivot = undefined;
    bot.legRPivot = undefined;
    bot.armLPivot = undefined;
    bot.armRPivot = undefined;
    bot.hitMeshes = [chestHit, headHit];
    bot.vestMesh = vestMesh;
    bot.helmetMesh = helmetMesh;
    bot.gunMesh = gunPivot;
    bot.backGunMesh = backGunPivot;
    bot.handWeaponMeshes = {};
    bot.backWeaponMeshes = {};
    bot.activeHandWeaponId = null;
    bot.activeBackWeaponId = null;
    bot.parachuteMesh = parachuteMesh;
    const backId =
      bot.secondaryWeaponId && bot.secondaryWeaponId !== bot.weaponId
        ? bot.secondaryWeaponId
        : bot.pistolWeaponId && bot.pistolWeaponId !== bot.weaponId
          ? bot.pistolWeaponId
          : null;
    setBotWeaponVisual(bot, bot.weaponId, backId);
  }
}

function createAirplane(): { group: THREE.Group; props: THREE.Mesh[] } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x555d52,
    roughness: 0.55,
    metalness: 0.45,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xd19a2a,
    roughness: 0.5,
    metalness: 0.2,
  });
  const propMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c1e,
    roughness: 0.4,
    metalness: 0.7,
  });

  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.7, 16, 10),
    bodyMat,
  );
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.5, 10), bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 9.7;

  const wing = new THREE.Mesh(new THREE.BoxGeometry(20, 0.45, 3.6), bodyMat);
  wing.position.set(0, 0.9, 1.2);
  wing.castShadow = true;

  const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.2, 2.8), stripeMat);
  tailV.position.set(0, 2.5, -6.8);

  const tailH = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 2.0), bodyMat);
  tailH.position.set(0, 0.8, -7.2);

  group.add(fuselage, nose, wing, tailV, tailH);

  const props: THREE.Mesh[] = [];
  [-6.2, -3.2, 3.2, 6.2].forEach((px) => {
    const engine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 2.0, 8),
      propMat,
    );
    engine.rotation.x = Math.PI / 2;
    engine.position.set(px, 0.75, 2.6);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.18, 0.08),
      propMat,
    );
    blade.position.set(px, 0.75, 3.7);
    group.add(engine, blade);
    props.push(blade);
  });

  return { group, props };
}

function createSkyDome(): THREE.Mesh {
  const skyGeo = new THREE.SphereGeometry(240, 24, 16);
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cZenith = new THREE.Color(0x1b5ec7);
  const cMid = new THREE.Color(0x4ea3eb);
  const cHorizon = new THREE.Color(0xbce4fa);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp(y / 240, 0, 1);
    if (t < 0.28) {
      tmp.copy(cHorizon).lerp(cMid, t / 0.28);
    } else {
      tmp.copy(cMid).lerp(cZenith, (t - 0.28) / 0.72);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const skyMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(skyGeo, skyMat);
  mesh.renderOrder = -100;
  return mesh;
}

export function createIslandWorld(
  textures: ProceduralTextureSet,
  envMap: THREE.Texture,
): WorldHandle {
  const scene = new THREE.Scene();
  const horizonFogColor = new THREE.Color(0xaad6f0);
  scene.background = horizonFogColor;
  const fog = new THREE.Fog(horizonFogColor, 400, 1050);
  scene.fog = fog;
  scene.environment = envMap;

  const camera = new THREE.PerspectiveCamera(
    64,
    window.innerWidth / window.innerHeight,
    0.15,
    1220,
  );

  // Distant-Render Texture LOD uniform: strips texture resolution past threshold into flat base color
  const texDistUniform = { value: 56.0 };
  const applyDistanceTextureLod = (
    mat: THREE.MeshStandardMaterial,
    flatRgb: [number, number, number],
  ) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTexMaxDist = texDistUniform;
      shader.uniforms.uUntexturedColor = {
        value: new THREE.Vector3(flatRgb[0], flatRgb[1], flatRgb[2]),
      };
      shader.fragmentShader =
        'uniform float uTexMaxDist;\nuniform vec3 uUntexturedColor;\n' +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          #ifdef DECODE_VIDEO_TEXTURE
            sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
          #endif
          float texDistFade = smoothstep(uTexMaxDist * 0.56, uTexMaxDist, length(vViewPosition));
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, uUntexturedColor, texDistFade);
          diffuseColor *= sampledDiffuseColor;
        #endif`,
      );
    };
    mat.customProgramCacheKey = () => 'proc-dist-flat-lod';
    mat.needsUpdate = true;
  };

  const patchedGlbMats = new Set<THREE.Material>();
  const applyGlbDistanceTextureLod = (root: THREE.Object3D) => {
    root.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i] as THREE.MeshStandardMaterial | undefined;
        if (!mat || !mat.map || patchedGlbMats.has(mat)) continue;
        patchedGlbMats.add(mat);
        if (mat.map) {
          mat.map.generateMipmaps = true;
          mat.map.minFilter = THREE.LinearMipmapLinearFilter;
          mat.map.needsUpdate = true;
        }
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uTexMaxDist = texDistUniform;
          shader.fragmentShader = 'uniform float uTexMaxDist;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              vec4 sampledDiffuseColor = texture2D( map, vMapUv );
              vec4 flatDistTexColor = texture2D( map, vMapUv, 7.5 );
              #ifdef DECODE_VIDEO_TEXTURE
                sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
                flatDistTexColor = sRGBTransferEOTF( flatDistTexColor );
              #endif
              float texDistFade = smoothstep(uTexMaxDist * 0.56, uTexMaxDist, length(vViewPosition));
              sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, flatDistTexColor.rgb, texDistFade);
              diffuseColor *= sampledDiffuseColor;
            #endif`,
          );
        };
        mat.customProgramCacheKey = () => 'glb-dist-flat-lod';
        mat.needsUpdate = true;
      }
    });
  };

  // Sky Dome + Soft Rounded Horizon Clouds
  const skyDome = createSkyDome();
  scene.add(skyDome);

  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xf4f8fc,
    transparent: true,
    opacity: 0.72,
  });
  const cloudGeo = new THREE.SphereGeometry(16, 7, 5);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rad = 700 + (i % 3) * 110;
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.set(Math.cos(a) * rad, 175 + (i % 3) * 18, Math.sin(a) * rad);
    cloud.rotation.y = a;
    cloud.scale.set(1.7 + (i % 3) * 0.5, 0.36 + (i % 2) * 0.12, 1.05);
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);

  // Warm / Cool Outdoor Daylight Rig
  const hemi = new THREE.HemisphereLight(0xc4e8ff, 0x948062, 1.35);
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight(0xfff4dc, 1.9);
  sunLight.position.set(110, 150, 85);
  sunLight.castShadow = false;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 260;
  const d = 65;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const joaoPessoaGroup = new THREE.Group();
  joaoPessoaGroup.visible = false;
  scene.add(joaoPessoaGroup);

  const bermudaGroup = new THREE.Group();
  bermudaGroup.visible = true;
  scene.add(bermudaGroup);

  const colliders: WorldObbCollider[] = [];
  const platforms: WalkablePlatform[] = [];
  const obstacleMeshes: THREE.Object3D[] = [];
  const buildings: MinimapBuilding[] = [];
  const cullableStructures: Array<{
    obj: THREE.Object3D;
    x: number;
    z: number;
    radiusScale: number;
  }> = [];
  const bermudaCullables: Array<{
    obj: THREE.Object3D;
    x: number;
    z: number;
    radius: number;
  }> = [];

  const roads: MinimapRoad[] = [
    // Av. Cabo Branco / Tambaú / Manaíra / Bessa — Main Eastern Orla Boulevard
    { x1: 210, z1: -325, x2: 195, z2: riverCenterZ(195) - 25, width: 8.2, kind: 'asphalt' },
    { x1: 195, z1: riverCenterZ(195) + 25, x2: 265, z2: -135, width: 8.4, kind: 'asphalt' },
    { x1: 265, z1: -135, x2: 298, z2: 12, width: 8.8, kind: 'asphalt' },
    { x1: 298, z1: 12, x2: 274, z2: 185, width: 8.6, kind: 'asphalt' },
    { x1: 274, z1: 185, x2: 252, z2: 300, width: 7.8, kind: 'asphalt' },
    // Av. Epitácio Pessoa — Grand Straight Axis from Tambaú -> Altiplano -> Lagoa!
    { x1: 298, z1: 12, x2: 142, z2: 10, width: 9.2, kind: 'asphalt' },
    { x1: 142, z1: 10, x2: -115, z2: -15, width: 9.2, kind: 'asphalt' },
    // Northern Highway & River Bridges (Ponte Sanhauá, Ponte Jacaré, Ponte Cabedelo)
    { x1: -20, z1: -372, x2: 210, z2: -325, width: 7.8, kind: 'asphalt' },
    { x1: -20, z1: -372, x2: -215, z2: riverCenterZ(-215) - 25, width: 7.4, kind: 'asphalt' },
    { x1: -20, z1: -372, x2: -20, z2: riverCenterZ(-20) - 25, width: 8.0, kind: 'asphalt' },
    { x1: -20, z1: riverCenterZ(-20) + 25, x2: -115, z2: -15, width: 7.8, kind: 'asphalt' },
    { x1: -215, z1: riverCenterZ(-215) + 25, x2: -225, z2: -185, width: 7.4, kind: 'asphalt' },
    { x1: -225, z1: -185, x2: -175, z2: -82, width: 7.6, kind: 'asphalt' },
    // Altiplano -> Estação Cabo Branco -> Cabo Branco Panoramic Spine
    { x1: 142, z1: 10, x2: 142, z2: 45, width: 8.0, kind: 'asphalt' },
    { x1: 142, z1: 45, x2: 192, z2: 286, width: 7.4, kind: 'asphalt' },
    { x1: 192, z1: 286, x2: 265, z2: 320, width: 7.6, kind: 'asphalt' },
    // Centro Histórico, Lagoa, Porto Sanhauá & Mata do Buraquinho Eco-Trails
    { x1: -235, z1: -15, x2: -290, z2: 160, width: 7.8, kind: 'asphalt' },
    { x1: -290, z1: 160, x2: -155, z2: 295, width: 7.6, kind: 'asphalt' },
    { x1: -155, z1: 295, x2: 192, z2: 286, width: 7.2, kind: 'dirt' },
    { x1: -115, z1: -15, x2: 10, z2: 58, width: 6.6, kind: 'dirt' },
    { x1: 10, z1: 58, x2: 142, z2: 45, width: 6.6, kind: 'dirt' },
    { x1: 10, z1: 58, x2: -155, z2: 295, width: 6.4, kind: 'dirt' },
  ];

  // 1. João Pessoa 1480m x 1480m Coastal Terrain Mesh (92x92 crisp relief + Biome Vertex Colors!)
  const terrainGeo = new THREE.PlaneGeometry(1480, 1480, 92, 92);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cParkGrass = new THREE.Color(0x638e3d);
  const cMataForest = new THREE.Color(0x3f6b2c);
  const cSandGold = new THREE.Color(0xe6cf9e);
  const cAreiaVermelha = new THREE.Color(0xd99b66);
  const cFalesiaClay = new THREE.Color(0xb8603c);
  const cUrbanGrey = new THREE.Color(0x7c838a);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = sampleGroundHeight(vx, vz);
    posAttr.setY(i, vy);

    const distAreia = Math.hypot(vx - SENTOSA_CENTER.x, vz - SENTOSA_CENTER.z);
    const distMata = Math.hypot(vx - 10, vz - 58);
    const distCentro = Math.hypot(vx + 240, vz - 90);
    const distAltiplano = Math.hypot(vx - 142, vz - 45);
    const isFalesiaSlope = vx > 215 && vz > 240 && vy > 3.2 && vy < 10.6;
    const isEastBeach = vx > 300 && vy < 2.35 && vz < 260;

    if (distAreia < 95) {
      tmpColor.copy(cAreiaVermelha);
    } else if (isFalesiaSlope) {
      tmpColor.copy(cFalesiaClay);
    } else if (isEastBeach || vy < 1.35) {
      tmpColor.copy(cSandGold);
    } else if (distMata < 110 && vy > 5.0) {
      tmpColor.copy(cMataForest);
    } else if (distCentro < 95 || distAltiplano < 56 || Math.hypot(vx + 20, vz + 372) < 52) {
      tmpColor.copy(cUrbanGrey).lerp(cParkGrass, 0.35);
    } else if (vy > 6.8) {
      tmpColor.copy(cMataForest).lerp(cParkGrass, 0.45);
    } else {
      tmpColor.copy(cParkGrass);
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.grass,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
  });
  applyDistanceTextureLod(terrainMat, [0.58, 0.68, 0.45]);
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'terrain-mesh';
  terrainMesh.receiveShadow = true;
  joaoPessoaGroup.add(terrainMesh);
  obstacleMeshes.push(terrainMesh);

  // 2. Tropical Atlantic Ocean & Turquoise Coastal Reefs (44x44 lightweight mesh)
  const waterGeo = new THREE.PlaneGeometry(2200, 2200, 44, 44);
  waterGeo.rotateX(-Math.PI / 2);
  const waterPos = waterGeo.attributes.position;
  const waterColors = new Float32Array(waterPos.count * 3);
  const cReefShallow = new THREE.Color(0x2ce3d0);
  const cLagoon = new THREE.Color(0x1697c9);
  const cDeepOcean = new THREE.Color(0x114873);

  for (let i = 0; i < waterPos.count; i++) {
    const wx = waterPos.getX(i);
    const wz = waterPos.getZ(i);
    const gh = sampleGroundHeight(wx, wz);
    if (gh > -2.4) {
      const t = THREE.MathUtils.clamp((gh + 2.4) / 2.7, 0, 1);
      tmpColor.copy(cLagoon).lerp(cReefShallow, t);
    } else if (gh > -5.0) {
      const t = THREE.MathUtils.clamp((gh + 5.0) / 2.6, 0, 1);
      tmpColor.copy(cDeepOcean).lerp(cLagoon, t);
    } else {
      tmpColor.copy(cDeepOcean);
    }
    waterColors[i * 3] = tmpColor.r;
    waterColors[i * 3 + 1] = tmpColor.g;
    waterColors[i * 3 + 2] = tmpColor.b;
  }
  waterGeo.setAttribute('color', new THREE.BufferAttribute(waterColors, 3));

  const waterMat = new THREE.MeshStandardMaterial({
    map: textures.waterWave,
    vertexColors: true,
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.22,
  });
  applyDistanceTextureLod(waterMat, [0.78, 0.94, 0.98]);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = -0.35;
  water.receiveShadow = false;
  joaoPessoaGroup.add(water);

  // Seamless surrounding tropical ocean skirt for Bermuda 3D map
  const bermudaOceanSkirt = new THREE.Mesh(
    new THREE.PlaneGeometry(4600, 4600),
    new THREE.MeshStandardMaterial({
      map: textures.waterWave,
      color: 0x1680b0,
      roughness: 0.28,
      metalness: 0.18,
    }),
  );
  bermudaOceanSkirt.rotation.x = -Math.PI / 2;
  bermudaOceanSkirt.position.y = BERMUDA_GLB_WATER_Y - 0.18;
  bermudaGroup.add(bermudaOceanSkirt);

  // 3. Distant Horizon Coastal Headlands (12 low-cost islands/dunes)
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x4f7582,
    roughness: 0.95,
  });
  const mountainGeo = new THREE.SphereGeometry(90, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const mountainCount = 12;
  const mountains = new THREE.InstancedMesh(mountainGeo, mountainMat, mountainCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < mountainCount; i++) {
    const angle = (i / mountainCount) * Math.PI * 2;
    const rad = 840 + (i % 3) * 65;
    dummy.position.set(Math.cos(angle) * rad, -8, Math.sin(angle) * rad);
    dummy.rotation.y = i * 0.63;
    const sc = 0.8 + (i % 4) * 0.2;
    dummy.scale.set(sc * 1.4, sc * 0.65, sc * 1.1);
    dummy.updateMatrix();
    mountains.setMatrixAt(i, dummy.matrix);
  }
  mountains.computeBoundingSphere();
  joaoPessoaGroup.add(mountains);

  // 4. Terrain-Conforming Continuous Asphalt Highways, Dirt Eco-Trails & Calçadão de Pedra Portuguesa!
  const dirtRoadMat = new THREE.MeshStandardMaterial({
    map: textures.dirtRoad,
    roughness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  applyDistanceTextureLod(dirtRoadMat, [0.54, 0.44, 0.32]);
  const asphaltRoadMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltRoad,
    roughness: 0.84,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  applyDistanceTextureLod(asphaltRoadMat, [0.3, 0.32, 0.35]);
  const calcadaoMat = new THREE.MeshStandardMaterial({
    map: textures.calcadaoWave,
    roughness: 0.78,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  applyDistanceTextureLod(calcadaoMat, [0.76, 0.75, 0.72]);

  const buildRoadStripGeo = (r: MinimapRoad): THREE.BufferGeometry | null => {
    const dx = r.x2 - r.x1;
    const dz = r.z2 - r.z1;
    const len = Math.hypot(dx, dz);
    if (len < 1) return null;
    const steps = Math.max(4, Math.ceil(len / 7.5));
    const nx = -dz / len;
    const nz = dx / len;
    const hw = r.width * 0.5;

    const verts: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let prevValid = false;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = r.x1 + dx * t;
      const cz = r.z1 + dz * t;
      const lx = cx - nx * hw;
      const lz = cz - nz * hw;
      const rx = cx + nx * hw;
      const rz = cz + nz * hw;
      const hC = sampleGroundHeight(cx, cz);
      const hL = sampleGroundHeight(lx, lz);
      const hR = sampleGroundHeight(rx, rz);

      if (hC < 0.25) {
        prevValid = false;
        continue;
      }

      const vBase = verts.length / 3;
      verts.push(lx, Math.max(hL, hC) + 0.08, lz);
      verts.push(rx, Math.max(hR, hC) + 0.08, rz);
      const vCoord = (t * len) / 6;
      uvs.push(0, vCoord, 1, vCoord);

      if (prevValid) {
        const p0 = vBase - 2;
        const p1 = vBase - 1;
        const p2 = vBase;
        const p3 = vBase + 1;
        indices.push(p0, p2, p1, p1, p2, p3);
      }
      prevValid = true;
    }

    if (indices.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  };

  const asphaltGeos: THREE.BufferGeometry[] = [];
  const dirtGeos: THREE.BufferGeometry[] = [];
  roads.forEach((r) => {
    const g = buildRoadStripGeo(r);
    if (!g) return;
    if (r.kind === 'asphalt') asphaltGeos.push(g);
    else dirtGeos.push(g);
  });
  if (asphaltGeos.length > 0) {
    const mAsphalt = new THREE.Mesh(mergeGeometries(asphaltGeos, false), asphaltRoadMat);
    mAsphalt.receiveShadow = true;
    joaoPessoaGroup.add(mAsphalt);
    asphaltGeos.forEach((g) => g.dispose());
  }
  if (dirtGeos.length > 0) {
    const mDirt = new THREE.Mesh(mergeGeometries(dirtGeos, false), dirtRoadMat);
    mDirt.receiveShadow = true;
    joaoPessoaGroup.add(mDirt);
    dirtGeos.forEach((g) => g.dispose());
  }

  // Calçadão de Pedra Portuguesa along Manaíra -> Tambaú -> Cabo Branco beachfront!
  const calcadaoSegments: MinimapRoad[] = [
    { x1: 278, z1: -145, x2: 312, z2: 12, width: 6.2 },
    { x1: 312, z1: 12, x2: 288, z2: 185, width: 6.2 },
  ];
  const calcGeos: THREE.BufferGeometry[] = [];
  calcadaoSegments.forEach((seg) => {
    const cg = buildRoadStripGeo(seg);
    if (cg) calcGeos.push(cg);
  });
  if (calcGeos.length > 0) {
    const calcMesh = new THREE.Mesh(mergeGeometries(calcGeos, false), calcadaoMat);
    calcMesh.receiveShadow = true;
    joaoPessoaGroup.add(calcMesh);
    calcGeos.forEach((g) => g.dispose());
  }

  // Shared Architectural & João Pessoa Landmark Materials
  const stuccoWallMat = new THREE.MeshStandardMaterial({
    map: textures.stuccoWall,
    roughness: 0.84,
  });
  applyDistanceTextureLod(stuccoWallMat, [0.9, 0.87, 0.82]);
  const colonialPastelMat = new THREE.MeshStandardMaterial({
    map: textures.colonialPastel,
    roughness: 0.86,
  });
  applyDistanceTextureLod(colonialPastelMat, [0.92, 0.84, 0.65]);
  const modernGlassMat = new THREE.MeshStandardMaterial({
    map: textures.modernGlass,
    roughness: 0.24,
    metalness: 0.45,
  });
  applyDistanceTextureLod(modernGlassMat, [0.22, 0.52, 0.72]);
  const plazaStoneMat = new THREE.MeshStandardMaterial({
    map: textures.plazaStone,
    roughness: 0.86,
  });
  applyDistanceTextureLod(plazaStoneMat, [0.62, 0.64, 0.67]);
  const whiteModernMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fb,
    roughness: 0.58,
    metalness: 0.08,
  });
  const accentBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.46,
    metalness: 0.14,
  });
  const trimGoldMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.36,
    metalness: 0.5,
  });
  const brickWallMat = new THREE.MeshStandardMaterial({
    map: textures.brickWall,
    roughness: 0.87,
  });
  applyDistanceTextureLod(brickWallMat, [0.76, 0.45, 0.34]);
  const woodWallMat = new THREE.MeshStandardMaterial({
    map: textures.woodPlank,
    roughness: 0.86,
  });
  applyDistanceTextureLod(woodWallMat, [0.64, 0.49, 0.34]);
  const barnWoodMat = new THREE.MeshStandardMaterial({
    map: textures.barnWood,
    roughness: 0.86,
  });
  applyDistanceTextureLod(barnWoodMat, [0.62, 0.25, 0.2]);
  const interiorFloorMat = new THREE.MeshStandardMaterial({
    map: textures.interiorFloor,
    roughness: 0.84,
  });
  applyDistanceTextureLod(interiorFloorMat, [0.76, 0.73, 0.67]);
  const stairConcreteMat = new THREE.MeshStandardMaterial({
    map: textures.stairConcrete,
    roughness: 0.88,
  });
  applyDistanceTextureLod(stairConcreteMat, [0.68, 0.67, 0.65]);
  const shedMetalMat = new THREE.MeshStandardMaterial({
    map: textures.shedMetal,
    roughness: 0.56,
    metalness: 0.4,
  });
  applyDistanceTextureLod(shedMetalMat, [0.46, 0.49, 0.52]);
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roofTile,
    roughness: 0.78,
  });
  applyDistanceTextureLod(roofMat, [0.68, 0.32, 0.24]);
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x453e37,
    roughness: 0.82,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    map: textures.concrete,
    color: 0xaab0b6,
    roughness: 0.84,
  });
  applyDistanceTextureLod(concreteMat, [0.66, 0.68, 0.7]);
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x393f45,
    roughness: 0.45,
    metalness: 0.7,
  });
  const blueContainerMat = new THREE.MeshStandardMaterial({
    map: textures.containerBlue,
    roughness: 0.54,
    metalness: 0.42,
  });
  applyDistanceTextureLod(blueContainerMat, [0.22, 0.42, 0.55]);
  const rustContainerMat = new THREE.MeshStandardMaterial({
    map: textures.containerRust,
    roughness: 0.66,
    metalness: 0.32,
  });
  applyDistanceTextureLod(rustContainerMat, [0.58, 0.32, 0.22]);

  const buildingMats: BuildingMaterials = {
    stuccoWall: stuccoWallMat,
    brickWall: brickWallMat,
    woodWall: woodWallMat,
    barnWood: barnWoodMat,
    concrete: concreteMat,
    interiorFloor: interiorFloorMat,
    stairConcrete: stairConcreteMat,
    roofTile: roofMat,
    trim: trimMat,
  };

  const jpMats: JpLandmarkMaterials = {
    concrete: concreteMat,
    calcadaoWave: calcadaoMat,
    modernGlass: modernGlassMat,
    colonialPastel: colonialPastelMat,
    plazaStone: plazaStoneMat,
    interiorFloor: interiorFloorMat,
    stairConcrete: stairConcreteMat,
    roofTile: roofMat,
    woodPlank: woodWallMat,
    whiteModern: whiteModernMat,
    accentBlue: accentBlueMat,
    trimGold: trimGoldMat,
  };

  // 5. Bridges over Rio Paraíba / Sanhauá + Wooden Reef Bridge to Ilha de Areia Vermelha
  const ponteSanhauaZ = riverCenterZ(-215);
  joaoPessoaGroup.add(
    createBridge(-215, ponteSanhauaZ, 9.2, 50, 3.4, 0, concreteMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: -215, z: ponteSanhauaZ, w: 9.2, d: 50, rotY: 0, kind: 'bridge' });

  const ponteJacareZ = riverCenterZ(-20);
  joaoPessoaGroup.add(
    createBridge(-20, ponteJacareZ, 10.0, 50, 3.6, 0, concreteMat, whiteModernMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: -20, z: ponteJacareZ, w: 10.0, d: 50, rotY: 0, kind: 'bridge' });

  const ponteCabedeloZ = riverCenterZ(195);
  joaoPessoaGroup.add(
    createBridge(195, ponteCabedeloZ, 9.6, 50, 3.4, 0, concreteMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: 195, z: ponteCabedeloZ, w: 9.6, d: 50, rotY: 0, kind: 'bridge' });

  // Wooden Reef Walkway to Ilha de Areia Vermelha
  joaoPessoaGroup.add(
    createBridge(AREIA_BRIDGE.x, AREIA_BRIDGE.z, 8.2, 84, AREIA_BRIDGE.targetH, AREIA_BRIDGE_ROT, woodWallMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: AREIA_BRIDGE.x, z: AREIA_BRIDGE.z, w: 8.2, d: 84, rotY: AREIA_BRIDGE_ROT, kind: 'bridge' });

  // 5b. ICONIC JOÃO PESSOA LANDMARKS!
  const buildingNavZones: BuildingNavZone[] = [];
  const prefabLootPoints: BuildingLootPoint[] = [];

  // A. Letreiro "JOÃO [Sol] PESSOA" — Busto de Tamandaré / Tambaú
  {
    const lx = 324;
    const lz = 16;
    const ly = sampleGroundHeight(lx, lz);
    const letreiro = createLetreiroJoaoPessoa(
      lx,
      ly,
      lz,
      -Math.PI / 2,
      jpMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(letreiro);
    cullableStructures.push({ obj: letreiro, x: lx, z: lz, radiusScale: 1.2 });
    buildings.push({ x: lx, z: lz, w: 4, d: 20, rotY: 0, kind: 'letreiro' });
  }

  // B. Hotel Tambaú (Circular Beachfront Resort)
  {
    const hx = 334;
    const hz = -54;
    const hy = sampleGroundHeight(hx, hz);
    const hotel = createHotelTambau(
      hx,
      hy,
      hz,
      jpMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(hotel.group);
    cullableStructures.push({ obj: hotel.group, x: hx, z: hz, radiusScale: 1.4 });
    buildings.push({ x: hx, z: hz, w: 42, d: 42, rotY: 0, kind: 'hotelTambau' });
    buildingNavZones.push(...hotel.navZones);
    prefabLootPoints.push(...hotel.lootPoints);
  }

  // C. Farol do Cabo Branco (Ponta do Seixas Cliff Lighthouse)
  {
    const fx = 282;
    const fz = 326;
    const fy = sampleGroundHeight(fx, fz);
    const farol = createFarolCaboBranco(
      fx,
      fy,
      fz,
      jpMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(farol);
    cullableStructures.push({ obj: farol, x: fx, z: fz, radiusScale: 1.35 });
    buildings.push({ x: fx, z: fz, w: 14, d: 14, rotY: 0, kind: 'farol' });
  }

  // D. Estação Cabo Branco (Niemeyer Flying-Disc Pavilion + Ramp)
  {
    const ex = 202;
    const ez = 292;
    const ey = sampleGroundHeight(ex, ez);
    const estacao = createEstacaoCaboBranco(
      ex,
      ey,
      ez,
      jpMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(estacao.group);
    cullableStructures.push({ obj: estacao.group, x: ex, z: ez, radiusScale: 1.45 });
    buildings.push({ x: ex, z: ez, w: 30, d: 30, rotY: 0, kind: 'estacao' });
    buildingNavZones.push(...estacao.navZones);
    prefabLootPoints.push(...estacao.lootPoints);
  }

  // E. Altiplano Cabo Branco High-Rise Skyscrapers (4 Modern Glass Towers!)
  const skyscraperSpecs: Array<[number, number, number, number, number, number, number]> = [
    [142, 24, 14.0, 12.0, 42.0, 0.0, 0xf8fafc], // Tour Geneve inspired flagship tower
    [166, 56, 12.5, 11.5, 35.0, 0.25, 0x0ea5e9],
    [118, 62, 12.0, 11.5, 32.0, -0.2, 0xe2e8f0],
    [146, 88, 11.5, 11.0, 29.0, 1.57, 0x38bdf8],
  ];
  skyscraperSpecs.forEach(([sx, sz, sw, sd, sh, srot, accent]) => {
    const sy = sampleGroundHeight(sx, sz);
    const res = createAltiplanoSkyscraper(
      sx,
      sy,
      sz,
      sw,
      sd,
      sh,
      srot,
      accent,
      jpMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(res.group);
    cullableStructures.push({ obj: res.group, x: sx, z: sz, radiusScale: 1.55 });
    buildings.push({ x: sx, z: sz, w: sw, d: sd, rotY: srot, kind: 'skyscraper' });
    buildingNavZones.push(...res.navZones);
    prefabLootPoints.push(...res.lootPoints);
  });

  // F. Igreja & Convento de São Francisco (Centro Histórico)
  {
    const ix = -302;
    const iz = 158;
    const iy = sampleGroundHeight(ix, iz);
    const igreja = createIgrejaSaoFrancisco(
      ix,
      iy,
      iz,
      Math.PI / 2,
      jpMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(igreja.group);
    cullableStructures.push({ obj: igreja.group, x: ix, z: iz, radiusScale: 1.4 });
    buildings.push({ x: ix, z: iz, w: 14, d: 20, rotY: Math.PI / 2, kind: 'igreja' });
    buildingNavZones.push(...igreja.navZones);
    prefabLootPoints.push(...igreja.lootPoints);
  }

  // G. Parque Solon de Lucena — A Lagoa (Central Lagoon + Fountain + Footbridges)
  {
    const lx = -175;
    const lz = -15;
    const ly = sampleGroundHeight(lx, lz);
    const lagoa = createParqueLagoa(
      lx,
      ly,
      lz,
      jpMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(lagoa);
    cullableStructures.push({ obj: lagoa, x: lx, z: lz, radiusScale: 1.8 });
    buildings.push({ x: lx, z: lz, w: 94, d: 94, rotY: 0, kind: 'lagoa' });
  }

  // H. Feirinha de Tambaú, Quiosques da Orla & Piers da Praia do Jacaré
  const quiosqueSpecs: Array<[number, number, number, number]> = [
    [258, 12, 0.0, 0xdc2626], // Feirinha de Tambaú
    [258, 26, 0.0, 0xf59e0b],
    [244, 12, 0.0, 0x0284c7],
    [244, 26, 0.0, 0x16a34a],
    [292, 160, -1.57, 0x0ea5e9], // Cabo Branco Quiosque 1
    [282, 212, -1.57, 0xf97316], // Cabo Branco Quiosque 2
    [282, -125, -1.57, 0x22c55e], // Manaíra Quiosque
    [232, -312, -1.57, 0xef4444], // Bessa Quiosque
    [468, -264, 0.3, 0xeab308], // Areia Vermelha Tenda 1
    [486, -252, -0.5, 0x0284c7], // Areia Vermelha Tenda 2
    [-228, -196, 0.0, 0xd97706], // Praia do Jacaré Quiosque
  ];
  quiosqueSpecs.forEach(([qx, qz, qrot, qcol]) => {
    const q = createCoastalQuiosque(
      qx,
      sampleGroundHeight(qx, qz),
      qz,
      qrot,
      qcol,
      jpMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(q);
    cullableStructures.push({ obj: q, x: qx, z: qz, radiusScale: 0.8 });
    buildings.push({ x: qx, z: qz, w: 7, d: 7, rotY: qrot, kind: 'quiosque' });
  });

  // Praia do Jacaré Wooden Sunset Piers over Rio Paraíba
  [
    [-242, -230, 0.12],
    [-202, -228, -0.08],
  ].forEach(([px, pz, prot]) => {
    const py = 1.95;
    const pier = createWoodenPier(
      px,
      py,
      pz,
      5.2,
      28,
      prot,
      jpMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(pier);
    cullableStructures.push({ obj: pier, x: px, z: pz, radiusScale: 1.1 });
    buildings.push({ x: px, z: pz, w: 5.2, d: 28, rotY: prot, kind: 'pier' });
  });

  // 6. 26 Enterable João Pessoa Coastal & Colonial Houses
  const houseSpecs: Array<[number, number, number, number, number, number, boolean]> = [
    // Tambaú & Manaíra Beachfront Neighborhood
    [270, -18, 8.8, 7.0, 3.5, 1.57, false],
    [274, -84, 8.6, 6.8, 3.4, -1.57, false],
    [232, -118, 8.6, 6.8, 3.4, 0.1, false],
    [274, -162, 8.8, 7.0, 3.5, -1.57, false],
    [234, -168, 8.4, 6.6, 3.4, 0.2, true],
    // Cabo Branco & Ponta do Seixas
    [244, 152, 8.8, 7.0, 3.4, 1.57, false],
    [244, 218, 8.6, 6.8, 3.4, -1.57, false],
    [242, 336, 8.4, 6.8, 3.4, 0.1, false],
    // Bessa & Caribessa
    [188, -342, 8.6, 6.8, 3.4, 0.0, false],
    [232, -346, 8.4, 6.6, 3.4, -0.2, true],
    [194, -296, 8.4, 6.6, 3.4, 3.1, false],
    // Altiplano Residential Edge
    [116, 18, 8.8, 7.0, 3.5, 0.0, false],
    [168, 12, 8.6, 6.8, 3.4, -0.1, false],
    // Centro Histórico & Lagoa (Pastel Colonial Style!)
    [-256, 134, 8.8, 7.0, 3.6, 1.57, false],
    [-258, 186, 8.8, 7.0, 3.6, 1.57, false],
    [-332, 132, 8.6, 6.8, 3.5, 0.0, false],
    [-332, 196, 8.6, 6.8, 3.5, 3.1, false],
    [-112, -52, 8.6, 6.8, 3.4, 0.0, false],
    [-242, -58, 8.4, 6.8, 3.4, 1.57, false],
    [-242, 32, 8.4, 6.8, 3.4, -1.57, false],
    // Praia do Jacaré & Porto Sanhauá & Aeroclube
    [-250, -172, 8.4, 6.6, 3.4, 0.2, true],
    [-198, -176, 8.2, 6.4, 3.3, -0.2, true],
    [-182, 276, 8.6, 6.8, 3.4, 0.0, false],
    [-130, 314, 8.4, 6.6, 3.4, 3.1, true],
    [16, -348, 8.4, 6.6, 3.4, 0.1, false],
    [-58, -348, 8.4, 6.6, 3.4, -0.1, true],
  ];

  houseSpecs.forEach(([hx, hz, hw, hd, hh, hrot, isWood]) => {
    const isCentro = hx < -220 && hz > 80;
    const houseRes = createEnterableHouse(
      hx,
      hz,
      hw,
      hd,
      hh,
      hrot,
      sampleGroundHeight(hx, hz),
      isWood ? woodWallMat : isCentro ? colonialPastelMat : stuccoWallMat,
      buildingMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(houseRes.group);
    cullableStructures.push({ obj: houseRes.group, x: hx, z: hz, radiusScale: 1.0 });
    buildingNavZones.push(houseRes.navZone);
    buildings.push({
      x: hx,
      z: hz,
      w: hw,
      d: hd,
      rotY: hrot,
      kind: isWood ? 'shed' : 'house',
    });
  });

  // 6b. Multi-Story Buildings ("Primeiro Andar") across João Pessoa Neighborhoods
  // 8 Casas L (2-Story Balcony Apartments)
  const casaLSpecs: Array<[number, number, number]> = [
    [272, 54, -1.57], // Tambaú South
    [238, 192, -1.57], // Cabo Branco
    [232, -142, 1.57], // Manaíra
    [175, -315, 0.0], // Bessa
    [98, 42, -1.57], // Altiplano West
    [-175, -88, 0.0], // Lagoa North
    [-286, 108, 0.0], // Centro Histórico North
    [-125, 272, 1.57], // Porto Sanhauá East
  ];
  casaLSpecs.forEach(([bx, bz, brot]) => {
    const res = createCasaL(
      bx,
      bz,
      brot,
      sampleGroundHeight(bx, bz),
      buildingMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(res.group);
    cullableStructures.push({ obj: res.group, x: bx, z: bz, radiusScale: 1.25 });
    buildings.push({ x: bx, z: bz, w: 10.8, d: 10.6, rotY: brot, kind: 'casaL' });
    buildingNavZones.push(res.navZone);
    prefabLootPoints.push(...res.lootPoints);
  });

  // 7 Casas God (2-Story Tactical Strongholds)
  const casaGodSpecs: Array<[number, number, number]> = [
    [244, -22, 1.57], // Tambaú Inland
    [280, 126, -1.57], // Tambaú <-> Cabo Branco Orla
    [172, 24, 0.0], // Altiplano North-East
    [-175, 58, 3.14], // Lagoa South
    [-258, 212, 0.0], // Centro Histórico South
    [242, -198, -1.57], // Manaíra North
    [12, -402, 0.0], // Aeroclube North
  ];
  casaGodSpecs.forEach(([bx, bz, brot]) => {
    const res = createCasaGod(
      bx,
      bz,
      brot,
      sampleGroundHeight(bx, bz),
      buildingMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(res.group);
    cullableStructures.push({ obj: res.group, x: bx, z: bz, radiusScale: 1.22 });
    buildings.push({ x: bx, z: bz, w: 9.8, d: 9.8, rotY: brot, kind: 'casaGod' });
    buildingNavZones.push(res.navZone);
    prefabLootPoints.push(...res.lootPoints);
  });

  // 5 Celeiros / Rustic Atlantic Forest Barns & River Depot
  const celeiroSpecs: Array<[number, number, number]> = [
    [-8, 42, -0.6], // Mata do Buraquinho North
    [32, 92, 1.1], // Mata do Buraquinho South-East
    [-226, -148, 0.0], // Praia do Jacaré South
    [-186, 326, 1.57], // Porto Sanhauá South
    [144, 272, 0.3], // Falésia West Slope
  ];
  celeiroSpecs.forEach(([bx, bz, brot]) => {
    const res = createCeleiro(
      bx,
      bz,
      brot,
      sampleGroundHeight(bx, bz),
      buildingMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(res.group);
    cullableStructures.push({ obj: res.group, x: bx, z: bz, radiusScale: 1.3 });
    buildings.push({ x: bx, z: bz, w: 10.6, d: 14.0, rotY: brot, kind: 'celeiro' });
    buildingNavZones.push(res.navZone);
    prefabLootPoints.push(...res.lootPoints);
  });

  // 9 Sobrados (2-Story Urban & Colonial Houses)
  const sobradoSpecs: Array<[number, number, number]> = [
    [276, -42, -1.57], // Tambaú
    [264, -108, -1.57], // Manaíra
    [244, 242, -1.57], // Cabo Branco South
    [226, -304, -1.57], // Bessa
    [98, 86, 1.57], // Altiplano South-West
    [-108, 12, 1.57], // Lagoa East Entrance (Epitácio Pessoa)
    [-246, -12, -1.57], // Lagoa West
    [-294, 212, 3.14], // Centro Histórico
    [-156, 254, 0.0], // Porto Sanhauá North
  ];
  sobradoSpecs.forEach(([bx, bz, brot]) => {
    const res = createSobradoHouse(
      bx,
      bz,
      brot,
      sampleGroundHeight(bx, bz),
      buildingMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(res.group);
    cullableStructures.push({ obj: res.group, x: bx, z: bz, radiusScale: 1.15 });
    buildings.push({ x: bx, z: bz, w: 8.8, d: 7.8, rotY: brot, kind: 'sobrado' });
    buildingNavZones.push(res.navZone);
    prefabLootPoints.push(...res.lootPoints);
  });

  // 10 Guaritas (Coastal & Bridge Checkpoints)
  const guaritaSpecs: Array<[number, number, number]> = [
    [296, -14, 1.57], // Tambaú Boardwalk North
    [282, 82, 1.57], // Tambaú <-> Cabo Branco
    [258, 294, 0.4], // Mirante Farol Cabo Branco
    [138, 118, 0.0], // Altiplano South
    [206, -278, 3.14], // Ponte Cabedelo South Guard
    [454, -274, 1.2], // Areia Vermelha Guard
    [-20, riverCenterZ(-20) - 34, 0.0], // Ponte Jacaré North Guard
    [-102, -38, 0.8], // Lagoa NE
    [-264, 158, -1.57], // Centro Histórico Plaza
    [-42, -334, 0.0], // Aeroclube South Gate
  ];
  guaritaSpecs.forEach(([bx, bz, brot]) => {
    const res = createGuarita(
      bx,
      bz,
      brot,
      sampleGroundHeight(bx, bz),
      buildingMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(res.group);
    cullableStructures.push({ obj: res.group, x: bx, z: bz, radiusScale: 0.78 });
    buildings.push({ x: bx, z: bz, w: 3.4, d: 3.4, rotY: brot, kind: 'guarita' });
    buildingNavZones.push(res.navZone);
    prefabLootPoints.push(...res.lootPoints);
  });

  // 7. 5 Industrial Hangars & Porto Warehouses (Aeroclube + Porto Sanhauá)
  const shedSpecs: Array<[number, number, number, number, number, number]> = [
    [-46, -372, 11.5, 16.0, 4.6, 0.0], // Aeroclube Main Hangar
    [-46, -396, 10.5, 14.0, 4.4, 0.0], // Aeroclube Hangar 2
    [-156, 296, 13.0, 18.0, 5.0, 0.0], // Porto Sanhauá Warehouse 1
    [-178, 298, 10.4, 14.5, 4.5, 0.0], // Porto Sanhauá Warehouse 2
    [6, 74, 9.6, 12.5, 4.2, 0.8], // Mata Buraquinho Research Shed
  ];
  shedSpecs.forEach(([sx, sz, sw, sd, sh, srot]) => {
    const shedObj = createIndustrialShed(
      sx,
      sz,
      sw,
      sd,
      sh,
      srot,
      shedMetalMat,
      roofMat,
      concreteMat,
      steelMat,
      colliders,
      platforms,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(shedObj);
    cullableStructures.push({ obj: shedObj, x: sx, z: sz, radiusScale: 1.08 });
    buildings.push({ x: sx, z: sz, w: sw, d: sd, rotY: srot, kind: 'shed' });
    const cos = Math.cos(srot);
    const sin = Math.sin(srot);
    const toW = (lx: number, lz: number) => ({
      x: sx + lx * cos + lz * sin,
      z: sz - lx * sin + lz * cos,
    });
    const fIn = toW(0, sd * 0.5 - 1.6);
    const fOut = toW(0, sd * 0.5 + 2.0);
    const bIn = toW(0, -sd * 0.5 + 1.6);
    const bOut = toW(0, -sd * 0.5 - 2.0);
    buildingNavZones.push({
      cx: sx,
      cz: sz,
      halfW: sw * 0.5,
      halfD: sd * 0.5,
      rotY: srot,
      baseY: sampleGroundHeight(sx, sz),
      doors: [
        { inX: fIn.x, inZ: fIn.z, outX: fOut.x, outZ: fOut.z },
        { inX: bIn.x, inZ: bIn.z, outX: bOut.x, outZ: bOut.z },
      ],
    });
  });

  // Aeroclube Airstrip Runway at WAIT_SPAWN (-20, -372)
  const runwayY = sampleGroundHeight(-20, -372);
  const runway = new THREE.Mesh(new THREE.BoxGeometry(12, 0.16, 60), concreteMat);
  runway.position.set(-20, runwayY + 0.04, -376);
  runway.receiveShadow = true;
  joaoPessoaGroup.add(runway);
  platforms.push({
    cx: -20,
    cz: -376,
    halfW: 6,
    halfD: 30,
    rotY: 0,
    topY: runwayY + 0.12,
    minY: runwayY - 1,
  });

  // 8. Shipping Containers (Porto Sanhauá, Aeroclube, Areia Vermelha)
  const containerSpecs: Array<[number, number, number, boolean, number]> = [
    [-142, 286, 0.15, true, 0],
    [-142, 306, 1.57, false, 0],
    [-142, 286, 0.15, false, 2.6],
    [-4, -364, 0.0, true, 0],
    [-4, -384, 0.1, false, 0],
    [474, -282, 0.4, true, 0],
    [486, -276, 1.57, false, 0],
  ];
  containerSpecs.forEach(([cx, cz, crot, isBlue, yOff]) => {
    const cObj = createContainer(
      cx,
      cz,
      crot,
      isBlue ? blueContainerMat : rustContainerMat,
      colliders,
      platforms,
      obstacleMeshes,
      yOff,
    );
    joaoPessoaGroup.add(cObj);
    cullableStructures.push({ obj: cObj, x: cx, z: cz, radiusScale: 0.85 });
    buildings.push({ x: cx, z: cz, w: 2.6, d: 6.2, rotY: crot, kind: 'container' });
  });

  // 9. 4 Watchtowers (Mata do Buraquinho Eco-Tower, Aeroclube ATC, Porto, Jacaré)
  const wtCoords: Array<[number, number]> = [
    [14, 62], // Mata do Buraquinho Mirante
    [12, -366], // Aeroclube Controle
    [-162, 318], // Porto Sanhauá
    [-216, -206], // Praia do Jacaré
  ];
  wtCoords.forEach(([wx, wz]) => {
    const wt = createWatchTowerLOD(wx, wz, concreteMat, steelMat, colliders, obstacleMeshes);
    joaoPessoaGroup.add(wt);
    cullableStructures.push({ obj: wt, x: wx, z: wz, radiusScale: 1.25 });
    buildings.push({ x: wx, z: wz, w: 7.2, d: 7.2, rotY: 0, kind: 'tower' });
  });

  // 10. 8 Vending Machines (Lojinhas de João Pessoa)
  const vendingSpecs: Array<{ id: string; x: number; z: number; rotY: number; label: string }> = [
    { id: 'vm_tambau', x: 288, z: 24, rotY: -1.57, label: 'Lojinha Tambaú' },
    { id: 'vm_cabobranco', x: 272, z: 186, rotY: -1.4, label: 'Lojinha Cabo Branco' },
    { id: 'vm_altiplano', x: 152, z: 16, rotY: 0.2, label: 'Lojinha Altiplano' },
    { id: 'vm_manaira', x: 266, z: -135, rotY: -1.57, label: 'Lojinha Manaíra' },
    { id: 'vm_lagoa', x: -116, z: -8, rotY: 1.57, label: 'Lojinha da Lagoa' },
    { id: 'vm_centro', x: -278, z: 154, rotY: 0.9, label: 'Lojinha Centro Histórico' },
    { id: 'vm_porto', x: -146, z: 294, rotY: -0.6, label: 'Lojinha Porto Sanhauá' },
    { id: 'vm_bessa', x: 208, z: -322, rotY: 0.4, label: 'Lojinha Bessa' },
  ];
  const jpVendingMachines: VendingMachineProp[] = vendingSpecs.map((vs) => {
    const vm = createVendingMachineProp(
      vs.id,
      vs.x,
      vs.z,
      vs.rotY,
      vs.label,
      colliders,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(vm.group);
    cullableStructures.push({ obj: vm.group, x: vs.x, z: vs.z, radiusScale: 0.7 });
    return vm.data;
  });

  // 11. Concrete Cover Barriers, Supply Crates, Explosive Red Barrels & Launch Pads
  const barrierCoords: Array<[number, number, number]> = [
    [306, 8, 1.57],
    [306, 26, 1.57],
    [142, 36, 0.3],
    [252, 184, 0.2],
    [244, 308, -0.3],
    [464, -264, 0.5],
    [-118, -22, 0.2],
    [-280, 168, 0.9],
    [-150, 280, 0.0],
    [-20, riverCenterZ(-20) + 12, 0.1],
    [195, riverCenterZ(195) - 12, -0.1],
    [-10, -356, 0.2],
  ];
  const barrierGeo = new THREE.BoxGeometry(2.6, 1.15, 0.55);
  const barrierInst = new THREE.InstancedMesh(barrierGeo, concreteMat, barrierCoords.length);
  barrierInst.castShadow = false;
  barrierInst.receiveShadow = true;
  barrierCoords.forEach(([bx, bz, rot], idx) => {
    const by = sampleGroundHeight(bx, bz);
    dummy.position.set(bx, by + 0.57, bz);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    barrierInst.setMatrixAt(idx, dummy.matrix);
    colliders.push({
      cx: bx,
      cz: bz,
      halfW: 1.3,
      halfD: 0.28,
      rotY: rot,
      minY: by,
      maxY: by + 1.2,
      tag: 'barrier',
    });
  });
  barrierInst.computeBoundingSphere();
  joaoPessoaGroup.add(barrierInst);
  obstacleMeshes.push(barrierInst);

  const crateCoords: Array<[number, number, number]> = [
    [-16, -364, 0.2],
    [290, -10, 0.1],
    [154, 44, 0.5],
    [270, 316, 0.4],
    [474, -256, -0.4],
    [-284, 146, 0.4],
    [-164, 286, 0.2],
    [14, 52, -0.3],
  ];
  const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const crateInst = new THREE.InstancedMesh(crateGeo, woodWallMat, crateCoords.length);
  crateInst.castShadow = false;
  crateInst.receiveShadow = true;
  crateCoords.forEach(([cx, cz, rot], idx) => {
    const cy = sampleGroundHeight(cx, cz);
    dummy.position.set(cx, cy + 0.7, cz);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    crateInst.setMatrixAt(idx, dummy.matrix);
    colliders.push({
      cx,
      cz,
      halfW: 0.72,
      halfD: 0.72,
      rotY: rot,
      minY: cy,
      maxY: cy + 1.45,
      tag: 'crate',
    });
  });
  crateInst.computeBoundingSphere();
  joaoPessoaGroup.add(crateInst);
  obstacleMeshes.push(crateInst);

  const barrelCoords: Array<[number, number]> = [
    [292, 4],
    [304, -36],
    [134, 38],
    [262, 198],
    [266, 314],
    [470, -268],
    [-124, -18],
    [-272, 162],
    [-152, 288],
    [252, -142],
    [206, -328],
    [-222, -184],
    [-18, -362],
  ];
  const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.25, 8);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.42,
  });
  const barrelInst = new THREE.InstancedMesh(barrelGeo, barrelMat, barrelCoords.length);
  barrelInst.castShadow = false;
  barrelInst.receiveShadow = true;
  barrelInst.userData.isExplosiveBarrelInst = true;

  const jpExplosiveBarrels: ExplosiveBarrel[] = [];
  const barrelColliders: WorldObbCollider[] = [];
  barrelCoords.forEach(([bx, bz], idx) => {
    const by = sampleGroundHeight(bx, bz);
    dummy.position.set(bx, by + 0.625, bz);
    dummy.rotation.set(0, idx * 0.5, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    barrelInst.setMatrixAt(idx, dummy.matrix);
    jpExplosiveBarrels.push({
      id: `barrel_${idx}`,
      x: bx,
      y: by + 0.625,
      z: bz,
      exploded: false,
      instanceIdx: idx,
    });
    const col: WorldObbCollider = {
      cx: bx,
      cz: bz,
      halfW: 0.48,
      halfD: 0.48,
      rotY: 0,
      minY: by,
      maxY: by + 1.28,
      tag: 'barrel',
    };
    colliders.push(col);
    barrelColliders.push(col);
  });
  barrelInst.computeBoundingSphere();
  joaoPessoaGroup.add(barrelInst);
  obstacleMeshes.push(barrelInst);

  // 6 Tactical Launch Pads ("Lançadores" across João Pessoa!)
  const launchPadSpecs: Array<[number, number, number, number, string]> = [
    [290, 2, 142, 45, 'LANÇADOR -> ALTIPLANO'],
    [154, 62, 265, 185, 'LANÇADOR -> CABO BRANCO'],
    [262, 298, 10, 58, 'LANÇADOR -> MATA BURAQUINHO'],
    [-115, -24, 142, 45, 'LANÇADOR -> ALTIPLANO'],
    [452, -264, 255, -135, 'LANÇADOR -> MANAÍRA'],
    [-10, -352, -175, -15, 'LANÇADOR -> A LAGOA'],
  ];
  const jpLaunchPads: LaunchPadProp[] = [];
  const padBaseGeo = new THREE.CylinderGeometry(1.15, 1.35, 0.25, 14);
  const padPlateGeo = new THREE.BoxGeometry(1.3, 0.14, 1.6);
  const padBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });
  const padGlowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  launchPadSpecs.forEach(([lx, lz, tx, tz, label]) => {
    const ly = sampleGroundHeight(lx, lz);
    const dx = tx - lx;
    const dz = tz - lz;
    const horiz = Math.hypot(dx, dz) || 1;
    const yaw = Math.atan2(dx, dz);
    const padG = new THREE.Group();
    padG.position.set(lx, ly + 0.12, lz);
    padG.rotation.y = yaw;
    const base = new THREE.Mesh(padBaseGeo, padBaseMat);
    const plate = new THREE.Mesh(padPlateGeo, padGlowMat);
    plate.position.set(0, 0.26, 0.15);
    plate.rotation.x = -0.48;
    padG.add(base, plate);
    joaoPessoaGroup.add(padG);
    cullableStructures.push({ obj: padG, x: lx, z: lz, radiusScale: 0.7 });
    jpLaunchPads.push({
      x: lx,
      y: ly,
      z: lz,
      dirX: dx / horiz,
      dirY: 0.72,
      dirZ: dz / horiz,
      label,
    });
  });

  // 12. Roadside Cover & Authentic João Pessoa Instanced Vegetation + Beach Umbrellas!
  const distToRoadSq = (px: number, pz: number): number => {
    let best = 1e9;
    for (let i = 0; i < roads.length; i++) {
      const r = roads[i];
      const dx = r.x2 - r.x1;
      const dz = r.z2 - r.z1;
      const lenSq = dx * dx + dz * dz;
      if (lenSq < 1) continue;
      const t = THREE.MathUtils.clamp(((px - r.x1) * dx + (pz - r.z1) * dz) / lenSq, 0, 1);
      const qx = r.x1 + dx * t;
      const qz = r.z1 + dz * t;
      const dSq = (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
      if (dSq < best) best = dSq;
    }
    return best;
  };

  const isOnRoadCheck = (x: number, z: number) => distToRoadSq(x, z) < 100;
  const isInsideBuildingFootprint = (x: number, z: number) => {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (b.kind === 'lagoa') continue;
      const r = Math.max(b.w, b.d) * 0.56 + 2.4;
      if (Math.abs(x - b.x) < r && Math.abs(z - b.z) < r) return true;
    }
    return false;
  };

  // Roadside Concrete Muretas (1 draw call)
  const muretaList: Array<[number, number, number, number]> = [];
  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    const dx = r.x2 - r.x1;
    const dz = r.z2 - r.z1;
    const len = Math.hypot(dx, dz);
    if (len < 36) continue;
    const ang = Math.atan2(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    const countOnRoad = Math.min(2, Math.floor(len / 85));
    for (let k = 1; k <= countOnRoad; k++) {
      const t = k / (countOnRoad + 1);
      const side = (i + k) % 2 === 0 ? 1 : -1;
      const offset = r.width * 0.5 + 4.8;
      const mx = r.x1 + dx * t + nx * side * offset;
      const mz = r.z1 + dz * t + nz * side * offset;
      const my = sampleGroundHeight(mx, mz);
      if (my < 1.0 || Math.abs(mz - riverCenterZ(mx)) < 24 || isInsideBuildingFootprint(mx, mz)) continue;
      muretaList.push([mx, my, mz, ang + Math.PI * 0.5]);
    }
  }
  if (muretaList.length > 0) {
    const muretaGeo = new THREE.BoxGeometry(3.0, 1.15, 0.36);
    const muretaInst = new THREE.InstancedMesh(muretaGeo, concreteMat, muretaList.length);
    muretaInst.castShadow = false;
    muretaInst.receiveShadow = true;
    muretaList.forEach(([mx, my, mz, rot], idx) => {
      dummy.position.set(mx, my + 0.56, mz);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      muretaInst.setMatrixAt(idx, dummy.matrix);
      colliders.push({
        cx: mx,
        cz: mz,
        halfW: 1.5,
        halfD: 0.2,
        rotY: rot,
        minY: my - 0.3,
        maxY: my + 1.2,
        tag: 'mureta',
      });
    });
    muretaInst.computeBoundingSphere();
    joaoPessoaGroup.add(muretaInst);
    obstacleMeshes.push(muretaInst);
  }

  // Batched InstancedMesh Coqueiros, Mata Atlântica, Ipês Amarelos, Arbustos, Guarda-sóis & Postes!
  const foliageCtrl = createInstancedJoaoPessoaFoliage(joaoPessoaGroup, {
    sampleGroundHeight,
    isOnRoad: isOnRoadCheck,
    isInsideBuildingFootprint,
    riverCenterZ,
    textures,
    colliders,
    obstacleMeshes,
  });

  // Capture staticColliderCount BEFORE dynamic vehicles & runtime gloo walls!
  const jpStaticColliders = [...colliders];
  const jpPlatforms = [...platforms];
  const jpBuildingNavZones = [...buildingNavZones];
  const jpObstacleMeshes = [...obstacleMeshes];
  const jpBuildings = [...buildings];
  const jpRoads = [...roads];
  const jpPois = [...POIS];

  let activeBrMap: BrMapId = 'bermuda';
  const bermudaCollisionGrid = new MeshCollisionGrid(8.0);
  let bermudaAttached = false;
  let bermudaMinimapCanvas: HTMLCanvasElement | null = null;

  const bermudaStaticColliders: WorldObbCollider[] = [];
  const bermudaPlatforms: WalkablePlatform[] = [];
  const bermudaBuildingNavZones: BuildingNavZone[] = [];
  const bermudaObstacleMeshes: THREE.Object3D[] = [];
  const bermudaBuildings: MinimapBuilding[] = [];
  const bermudaRoads: MinimapRoad[] = [];
  const bermudaPois: PoiMarker[] = [
    { name: 'CLOCK TOWER', x: -256.5, z: -173.4, radius: 75 },
    { name: 'POCHINOK', x: -125.0, z: -162.9, radius: 75 },
    { name: 'PEAK', x: -77.0, z: -264.4, radius: 85 },
    { name: 'MILL', x: 0.0, z: -407.9, radius: 70 },
    { name: 'FACTORY', x: 105.5, z: -131.4, radius: 80 },
    { name: 'BIMASAKTI STRIP', x: 53.5, z: -257.4, radius: 80 },
    { name: 'HANGAR', x: 259.0, z: -199.4, radius: 75 },
    { name: 'AEROPORTO', x: 447.0, z: 23.1, radius: 90 },
    { name: 'OBSERVATÓRIO', x: -345.5, z: -3.4, radius: 75 },
    { name: 'RIM NAM VILLAGE', x: -372.0, z: -171.9, radius: 75 },
    { name: 'KOTA TUA', x: 295.0, z: 165.0, radius: 75 },
    { name: 'MARS ELECTRIC', x: -35.0, z: 185.0, radius: 80 },
  ];
  const bermudaVendingMachines: VendingMachineProp[] = [];
  const bermudaExplosiveBarrels: ExplosiveBarrel[] = [];
  const bermudaBarrelColliders: WorldObbCollider[] = [];
  let bermudaBarrelInst: THREE.InstancedMesh | null = null;
  const bermudaLaunchPads: LaunchPadProp[] = [];
  const bermudaVehicles: VehicleEntity[] = [];

  const groundHeightAt = (x: number, z: number): number => {
    if (activeBrMap === 'bermuda' && bermudaAttached) {
      return bermudaCollisionGrid.sampleTerrainHeight(x, z, BERMUDA_GLB_WATER_Y);
    }
    return sampleGroundHeight(x, z);
  };

  // Build 2D Spatial Hash Grid (32m x 32m cells covering -1024..+1024) for fast O(1) collision & platform queries
  const GRID_HALF_SPAN = 1024;
  const GRID_CELL_SIZE = 32;
  const GRID_DIM = 64;
  const colliderBuckets: number[][] = Array.from({ length: GRID_DIM * GRID_DIM }, () => []);
  const platformBuckets: number[][] = Array.from({ length: GRID_DIM * GRID_DIM }, () => []);
  const colStamp = new Uint32Array(Math.max(1, jpStaticColliders.length));
  const platStamp = new Uint32Array(Math.max(1, jpPlatforms.length));
  let colQuerySeq = 1;
  let platQuerySeq = 1;

  for (let i = 0; i < jpStaticColliders.length; i++) {
    const c = jpStaticColliders[i];
    const cos = Math.abs(Math.cos(c.rotY));
    const sin = Math.abs(Math.sin(c.rotY));
    const ex = cos * c.halfW + sin * c.halfD;
    const ez = sin * c.halfW + cos * c.halfD;
    const minGx = THREE.MathUtils.clamp(Math.floor((c.cx - ex + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const maxGx = THREE.MathUtils.clamp(Math.floor((c.cx + ex + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const minGz = THREE.MathUtils.clamp(Math.floor((c.cz - ez + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const maxGz = THREE.MathUtils.clamp(Math.floor((c.cz + ez + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    for (let gz = minGz; gz <= maxGz; gz++) {
      const row = gz * GRID_DIM;
      for (let gx = minGx; gx <= maxGx; gx++) {
        colliderBuckets[row + gx].push(i);
      }
    }
  }

  for (let i = 0; i < jpPlatforms.length; i++) {
    const p = jpPlatforms[i];
    const cos = Math.abs(Math.cos(p.rotY));
    const sin = Math.abs(Math.sin(p.rotY));
    const ex = cos * p.halfW + sin * p.halfD + 0.5;
    const ez = sin * p.halfW + cos * p.halfD + 0.5;
    const minGx = THREE.MathUtils.clamp(Math.floor((p.cx - ex + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const maxGx = THREE.MathUtils.clamp(Math.floor((p.cx + ex + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const minGz = THREE.MathUtils.clamp(Math.floor((p.cz - ez + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const maxGz = THREE.MathUtils.clamp(Math.floor((p.cz + ez + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    for (let gz = minGz; gz <= maxGz; gz++) {
      const row = gz * GRID_DIM;
      for (let gx = minGx; gx <= maxGx; gx++) {
        platformBuckets[row + gx].push(i);
      }
    }
  }

  const queryStaticCollidersNear = (
    x: number,
    z: number,
    radius: number,
    out: WorldObbCollider[],
  ): void => {
    out.length = 0;
    if (activeBrMap === 'bermuda') {
      const pad = radius + 1.5;
      for (let i = 0; i < bermudaStaticColliders.length; i++) {
        const c = bermudaStaticColliders[i];
        if (Math.abs(c.cx - x) <= pad && Math.abs(c.cz - z) <= pad) {
          out.push(c);
        }
      }
      return;
    }
    if (colQuerySeq >= 0xfffffffe) {
      colStamp.fill(0);
      colQuerySeq = 1;
    }
    const seq = ++colQuerySeq;
    const minGx = THREE.MathUtils.clamp(Math.floor((x - radius + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const maxGx = THREE.MathUtils.clamp(Math.floor((x + radius + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const minGz = THREE.MathUtils.clamp(Math.floor((z - radius + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const maxGz = THREE.MathUtils.clamp(Math.floor((z + radius + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    for (let gz = minGz; gz <= maxGz; gz++) {
      const row = gz * GRID_DIM;
      for (let gx = minGx; gx <= maxGx; gx++) {
        const bucket = colliderBuckets[row + gx];
        for (let b = 0; b < bucket.length; b++) {
          const idx = bucket[b];
          if (colStamp[idx] !== seq) {
            colStamp[idx] = seq;
            out.push(jpStaticColliders[idx]);
          }
        }
      }
    }
  };

  const navBuckets: number[][] = Array.from({ length: GRID_DIM * GRID_DIM }, () => []);
  for (let i = 0; i < jpBuildingNavZones.length; i++) {
    const nz = jpBuildingNavZones[i];
    const cos = Math.abs(Math.cos(nz.rotY));
    const sin = Math.abs(Math.sin(nz.rotY));
    const ex = cos * nz.halfW + sin * nz.halfD + 0.8;
    const ez = sin * nz.halfW + cos * nz.halfD + 0.8;
    const minGx = THREE.MathUtils.clamp(Math.floor((nz.cx - ex + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const maxGx = THREE.MathUtils.clamp(Math.floor((nz.cx + ex + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const minGz = THREE.MathUtils.clamp(Math.floor((nz.cz - ez + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const maxGz = THREE.MathUtils.clamp(Math.floor((nz.cz + ez + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    for (let gz = minGz; gz <= maxGz; gz++) {
      const row = gz * GRID_DIM;
      for (let gx = minGx; gx <= maxGx; gx++) {
        navBuckets[row + gx].push(i);
      }
    }
  }

  const findBuildingNavZoneAt = (x: number, z: number): BuildingNavZone | null => {
    if (activeBrMap === 'bermuda') {
      for (let i = 0; i < bermudaBuildingNavZones.length; i++) {
        const nz = bermudaBuildingNavZones[i];
        if (Math.abs(x - nz.cx) <= nz.halfW + 0.5 && Math.abs(z - nz.cz) <= nz.halfD + 0.5) {
          return nz;
        }
      }
      return null;
    }
    const gx = THREE.MathUtils.clamp(Math.floor((x + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const gz = THREE.MathUtils.clamp(Math.floor((z + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const bucket = navBuckets[gz * GRID_DIM + gx];
    for (let b = 0; b < bucket.length; b++) {
      const nz = jpBuildingNavZones[bucket[b]];
      const dx = x - nz.cx;
      const dz = z - nz.cz;
      const maxE = nz.halfW + nz.halfD + 0.5;
      if (Math.abs(dx) > maxE || Math.abs(dz) > maxE) continue;
      const cos = Math.cos(nz.rotY);
      const sin = Math.sin(nz.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (nz.extraBoxes && nz.extraBoxes.length > 0) {
        for (let k = 0; k < nz.extraBoxes.length; k++) {
          const box = nz.extraBoxes[k];
          if (Math.abs(lx - box.lx) <= box.halfW + 0.28 && Math.abs(lz - box.lz) <= box.halfD + 0.28) {
            return nz;
          }
        }
      } else if (Math.abs(lx) <= nz.halfW + 0.28 && Math.abs(lz) <= nz.halfD + 0.28) {
        return nz;
      }
    }
    return null;
  };

  const queryStaticPlatformsNear = (
    x: number,
    z: number,
    out: WalkablePlatform[],
  ): void => {
    out.length = 0;
    if (activeBrMap === 'bermuda') return;
    if (platQuerySeq >= 0xfffffffe) {
      platStamp.fill(0);
      platQuerySeq = 1;
    }
    const seq = ++platQuerySeq;
    const gx = THREE.MathUtils.clamp(Math.floor((x + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const gz = THREE.MathUtils.clamp(Math.floor((z + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const bucket = platformBuckets[gz * GRID_DIM + gx];
    for (let b = 0; b < bucket.length; b++) {
      const idx = bucket[b];
      if (platStamp[idx] !== seq) {
        platStamp[idx] = seq;
        out.push(jpPlatforms[idx]);
      }
    }
  };

  // Spawn 8 Drivable Vehicles across João Pessoa avenues & beaches
  const vehicleSpecs: Array<{ id: string; kind: VehicleKind; x: number; z: number; rotY: number }> = [
    { id: 'veh_0', kind: 'sport', x: 298, z: 32, rotY: 0.0 }, // Av. Tambaú
    { id: 'veh_1', kind: 'jeep', x: 150, z: 12, rotY: -1.57 }, // Epitácio Pessoa / Altiplano
    { id: 'veh_2', kind: 'sport', x: -112, z: -12, rotY: 1.57 }, // Lagoa East
    { id: 'veh_3', kind: 'jeep', x: 270, z: 190, rotY: -0.2 }, // Cabo Branco
    { id: 'veh_4', kind: 'jeep', x: 266, z: -135, rotY: 0.1 }, // Manaíra
    { id: 'veh_5', kind: 'sport', x: 214, z: -320, rotY: -0.4 }, // Bessa
    { id: 'veh_6', kind: 'jeep', x: -272, z: 162, rotY: 0.8 }, // Centro Histórico
    { id: 'veh_7', kind: 'sport', x: -14, z: -354, rotY: 0.2 }, // Aeroclube
  ];
  const jpVehicles: VehicleEntity[] = vehicleSpecs.map((spec) => {
    const v = createDrivableVehicle(
      spec.id,
      spec.kind,
      spec.x,
      spec.z,
      spec.rotY,
      colliders,
      obstacleMeshes,
    );
    joaoPessoaGroup.add(v.group);
    return v;
  });
  const vehicles: VehicleEntity[] = [];

  // 13. 50 Real Parachuting, Looting & Classic Bot AI (51 total participants with player)
  const BOT_NICKS = [
    'LuanPro_17', 'xX_Braga_Xx', 'Gabriel_07', 'YuriRush', 'CAPA_MESTRE',
    'Pedro_PB', 'BielCapa', 'Kauan_JP', 'Matheus_PB', 'Davi_Gelo',
    'ViniTop1', 'LucasSniper', 'Arthur_X1', 'Marcos_99', 'HenriqueBR',
    'Rafael2017', 'Thiago_Pro', 'Caua_Rush', 'Enzo_Capa', 'FelipeZika',
    'Gustavo_JP', 'BrunoSertao', 'Diego_17', 'Natan_FF', 'Igor_Tambaú',
    'Samu_Sniper', 'Ruan_Mestre', 'Caio_Lenda', 'JoaoVitorPB', 'Léo_Jampa',
    'Erick_Bermuda', 'Murilo_BR', 'Vitor_Bessa', 'Renan_18', 'DaniloRush',
    'Otavio_FF', 'NicolasCapa', 'Heitor_07', 'Eduardo_PB', 'Kaique_X1',
    'Bernardo_FF', 'Leandro2018', 'Wesley_Sertao', 'Fabricio_JP', 'AlexandreBR',
    'Emanuel_Top1', 'Samuel_M4', 'Guilherme_17', 'RodrigoCapa', 'Victor_Manaíra',
  ];

  const landPois = POIS.filter(
    (p) => !p.name.startsWith('PONTE'),
  );
  const targets: TargetDummy[] = BOT_NICKS.map((nick, idx) => {
    const poi = landPois[idx % landPois.length];
    const ang = (idx * 2.399) % (Math.PI * 2);
    const dist = 12 + ((idx * 11) % 44);
    let lx = poi.x + Math.cos(ang) * dist;
    let lz = poi.z + Math.sin(ang) * dist;
    if (sampleGroundHeight(lx, lz) < 0.75 || Math.hypot(lx + 175, lz + 15) < 48) {
      lx = poi.x + (poi.name === 'A LAGOA' ? 56 : 0);
      lz = poi.z;
    }
    const waitX = WAIT_SPAWN.x - 14.5 + ((idx * 3.7) % 25.0);
    const waitZ = WAIT_SPAWN.z - 7.4 + ((idx * 2.3) % 7.0);
    const bot = createBotEntity(
      `bot_${idx + 1}`,
      nick,
      waitX,
      waitZ,
      (idx * 1.1) % (Math.PI * 2),
      idx,
      textures.camoParachute,
      'g18',
      0,
      0,
    );
    bot.landX = lx;
    bot.landZ = lz;
    bot.dropProgress = 0.08 + (idx / BOT_NICKS.length) * 0.78;
    return bot;
  });
  targets.forEach((t) => scene.add(t.group));

  // 14. Comprehensive World Loot inside Houses, Sheds, Containers, Towers & POIs
  const lootDefs: Array<{
    x: number;
    z: number;
    yOverride?: number;
    kind: LootItem['kind'];
    weaponId?: WeaponId;
    scopeType?: ScopeType;
    attachmentKind?: LootItem['attachmentKind'];
    level?: 1 | 2 | 3;
    glooAmount?: number;
    grenadeAmount?: number;
    deathLoot?: LootItem['deathLoot'];
    ammoAmount?: number;
    coinAmount?: number;
    label: string;
  }> = [];

  const interiorWeapons: WeaponId[] = [
    'm4a1',
    'scar',
    'ak47',
    'xm8',
    'ump45',
    'deagle',
    'm1014',
    'awm',
    'scar',
    'ak47',
    'xm8',
    'ump45',
  ];
  const interiorAttachments: NonNullable<LootItem['attachmentKind']>[] = [
    'silencer',
    'compensator',
    'grip',
    'ext_mag',
    'stock',
  ];
  const interiorScopes: ScopeType[] = ['1x', '2x', '4x'];

  // Spawn rich loot INSIDE every house!
  houseSpecs.forEach(([hx, hz, hw, hd, , hrot], idx) => {
    const cos = Math.cos(hrot);
    const sin = Math.sin(hrot);
    const houseBaseY = sampleGroundHeight(hx, hz) + 0.25;
    const toWorld = (lx: number, lz: number) => ({
      x: hx + lx * cos + lz * sin,
      z: hz - lx * sin + lz * cos,
    });

    // 1. Weapon inside the house
    const wId = interiorWeapons[idx % interiorWeapons.length];
    const p1 = toWorld(hw * 0.18, -hd * 0.15);
    lootDefs.push({
      x: p1.x,
      z: p1.z,
      yOverride: houseBaseY,
      kind: 'weapon',
      weaponId: wId,
      label:
        wId === 'm4a1'
          ? 'Carabina M4-17'
          : wId === 'xm8'
            ? 'Fuzil XM8'
            : wId === 'scar'
              ? 'Rifle SCAR'
              : wId === 'ak47'
                ? 'Fuzil AK-47'
                : wId === 'deagle'
                  ? 'Desert Eagle'
                  : wId === 'ump45'
                    ? 'SMG UMP-17'
                    : wId === 'm1014'
                      ? 'Espingarda M10-17'
                      : 'Sniper AWM-17',
    });

    // 2. Vest, Helmet or Backpack inside the house
    const p2 = toWorld(-hw * 0.2, hd * 0.16);
    const gearMod = idx % 3;
    const lvl = ((idx % 3) + 1) as 1 | 2 | 3;
    if (gearMod === 0) {
      lootDefs.push({
        x: p2.x,
        z: p2.z,
        yOverride: houseBaseY,
        kind: 'vest',
        level: lvl,
        label: `Colete Nível ${lvl}`,
      });
    } else if (gearMod === 1) {
      lootDefs.push({
        x: p2.x,
        z: p2.z,
        yOverride: houseBaseY,
        kind: 'helmet',
        level: lvl,
        label: `Capacete Nível ${lvl}`,
      });
    } else {
      lootDefs.push({
        x: p2.x,
        z: p2.z,
        yOverride: houseBaseY,
        kind: 'backpack',
        level: lvl === 1 ? 2 : lvl,
        label: `Mochila Nível ${lvl === 1 ? 2 : lvl}`,
      });
    }

    // 3. Medkit or Attachment or Scope inside the house
    const p3 = toWorld(hw * 0.18, hd * 0.18);
    if (idx % 2 === 0) {
      const isSmallKit = idx % 4 === 2;
      lootDefs.push({
        x: p3.x,
        z: p3.z,
        yOverride: houseBaseY,
        kind: isSmallKit ? 'smallkit' : 'medkit',
        label: isSmallKit ? 'Kit Pequeno (+35 HP)' : 'Kit Médico (+75 HP)',
      });
    } else {
      const att = interiorAttachments[idx % interiorAttachments.length];
      lootDefs.push({
        x: p3.x,
        z: p3.z,
        yOverride: houseBaseY,
        kind: 'attachment',
        attachmentKind: att,
        label:
          att === 'silencer'
            ? 'Silenciador'
            : att === 'compensator'
              ? 'Boca / Compensador'
              : att === 'grip'
                ? 'Empunhadura Tática'
                : att === 'ext_mag'
                  ? 'Carregador Estendido'
                  : 'Coronha Tática',
      });
    }

    // 4. Scope or Gloo or Grenade or Ammo inside house
    const p4 = toWorld(-hw * 0.02, 0.1);
    const mod4 = idx % 4;
    if (mod4 === 0) {
      const sc = interiorScopes[idx % interiorScopes.length];
      lootDefs.push({
        x: p4.x,
        z: p4.z,
        yOverride: houseBaseY,
        kind: 'scope',
        scopeType: sc,
        label: `Mira ${sc.toUpperCase()}`,
      });
    } else if (mod4 === 1) {
      lootDefs.push({
        x: p4.x,
        z: p4.z,
        yOverride: houseBaseY,
        kind: 'gloo',
        glooAmount: 2,
        label: 'Parede de Gelo x2',
      });
    } else if (mod4 === 2) {
      lootDefs.push({
        x: p4.x,
        z: p4.z,
        yOverride: houseBaseY,
        kind: 'grenade',
        grenadeAmount: 2,
        label: 'Granada Explosiva x2',
      });
    } else {
      lootDefs.push({
        x: p4.x,
        z: p4.z,
        yOverride: houseBaseY,
        kind: 'ammo',
        ammoAmount: 45,
        label: 'Munição +45',
      });
    }
    // 5. Gold FF Coins inside houses
    const p5 = toWorld(-hw * 0.24, -hd * 0.22);
    lootDefs.push({
      x: p5.x,
      z: p5.z,
      yOverride: houseBaseY,
      kind: 'coin',
      coinAmount: idx % 3 === 0 ? 200 : 100,
      label: idx % 3 === 0 ? '200 Moedas FF' : '100 Moedas FF',
    });
  });

  // Spawn loot INSIDE every shed & around POIs
  shedSpecs.forEach(([sx, sz, , , ,], idx) => {
    const shedY = sampleGroundHeight(sx, sz) + 0.25;
    const shedWeapon: WeaponId =
      idx % 6 === 0
        ? 'scar'
        : idx % 6 === 1
          ? 'ak47'
          : idx % 6 === 2
            ? 'xm8'
            : idx % 6 === 3
              ? 'awm'
              : idx % 6 === 4
                ? 'm4a1'
                : 'deagle';
    lootDefs.push({
      x: sx - 1.8,
      z: sz - 2.2,
      yOverride: shedY,
      kind: 'weapon',
      weaponId: shedWeapon,
      label:
        shedWeapon === 'scar'
          ? 'Rifle SCAR'
          : shedWeapon === 'ak47'
            ? 'Fuzil AK-47'
            : shedWeapon === 'xm8'
              ? 'Fuzil XM8'
              : shedWeapon === 'deagle'
                ? 'Desert Eagle'
                : shedWeapon === 'm4a1'
                  ? 'Carabina M4-17'
                  : 'Sniper AWM-17',
    });
    lootDefs.push({
      x: sx + 1.8,
      z: sz + 2.0,
      yOverride: shedY,
      kind: 'vest',
      level: idx % 2 === 0 ? 3 : 2,
      label: idx % 2 === 0 ? 'Colete Nível 3' : 'Colete Nível 2',
    });
    lootDefs.push({
      x: sx,
      z: sz + 0.2,
      yOverride: shedY,
      kind: idx % 2 === 0 ? 'gloo' : 'grenade',
      glooAmount: 2,
      grenadeAmount: 2,
      label: idx % 2 === 0 ? 'Parede de Gelo x2' : 'Granada Explosiva x2',
    });
    lootDefs.push({
      x: sx - 1.4,
      z: sz + 2.4,
      yOverride: shedY,
      kind: 'backpack',
      level: 3,
      label: 'Mochila Nível 3',
    });
    lootDefs.push({
      x: sx + 1.5,
      z: sz - 2.0,
      yOverride: shedY,
      kind: 'coin',
      coinAmount: 200,
      label: '200 Moedas FF',
    });
  });

  // Spawn loot INSIDE all new 2-story buildings (Térreo + Primeiro Andar + Sacada + Mezanino) & Guaritas!
  prefabLootPoints.forEach((lp, idx) => {
    const mod = idx % 6;
    if (mod === 0) {
      const wId = interiorWeapons[(idx + (lp.floor === 2 ? 1 : 0)) % interiorWeapons.length];
      lootDefs.push({
        x: lp.x,
        z: lp.z,
        yOverride: lp.y,
        kind: 'weapon',
        weaponId: wId,
        label:
          wId === 'm4a1'
            ? 'Carabina M4-17'
            : wId === 'xm8'
              ? 'Fuzil XM8'
              : wId === 'scar'
                ? 'Rifle SCAR'
                : wId === 'ak47'
                  ? 'Fuzil AK-47'
                  : wId === 'deagle'
                    ? 'Desert Eagle'
                    : wId === 'ump45'
                      ? 'SMG UMP-17'
                      : wId === 'm1014'
                        ? 'Espingarda M10-17'
                        : 'Sniper AWM-17',
      });
    } else if (mod === 1) {
      const lvl: 1 | 2 | 3 = lp.floor === 2 ? (idx % 2 === 0 ? 3 : 2) : (((idx % 3) + 1) as 1 | 2 | 3);
      const isHelm = idx % 2 === 0;
      lootDefs.push({
        x: lp.x,
        z: lp.z,
        yOverride: lp.y,
        kind: isHelm ? 'helmet' : 'vest',
        level: lvl,
        label: `${isHelm ? 'Capacete' : 'Colete'} Nível ${lvl}`,
      });
    } else if (mod === 2) {
      lootDefs.push({
        x: lp.x,
        z: lp.z,
        yOverride: lp.y,
        kind: idx % 4 === 2 ? 'smallkit' : idx % 2 === 0 ? 'medkit' : 'gloo',
        glooAmount: 2,
        label:
          idx % 4 === 2
            ? 'Kit Pequeno (+35 HP)'
            : idx % 2 === 0
              ? 'Kit Médico (+75 HP)'
              : 'Parede de Gelo x2',
      });
    } else if (mod === 3) {
      const sc = interiorScopes[(idx + (lp.floor === 2 ? 1 : 0)) % interiorScopes.length];
      lootDefs.push({
        x: lp.x,
        z: lp.z,
        yOverride: lp.y,
        kind: 'scope',
        scopeType: sc,
        label: `Mira ${sc.toUpperCase()}`,
      });
    } else if (mod === 4) {
      const att = interiorAttachments[idx % interiorAttachments.length];
      lootDefs.push({
        x: lp.x,
        z: lp.z,
        yOverride: lp.y,
        kind: 'attachment',
        attachmentKind: att,
        label:
          att === 'silencer'
            ? 'Silenciador'
            : att === 'compensator'
              ? 'Boca / Compensador'
              : att === 'grip'
                ? 'Empunhadura Tática'
                : att === 'ext_mag'
                  ? 'Carregador Estendido'
                  : 'Coronha Tática',
      });
    } else {
      lootDefs.push({
        x: lp.x,
        z: lp.z,
        yOverride: lp.y,
        kind: idx % 12 === 5 ? 'backpack' : 'ammo',
        level: 3,
        ammoAmount: 45,
        label: idx % 12 === 5 ? 'Mochila Nível 3' : 'Munição +45',
      });
    }
  });

  // Extra POI & Compound ground loot
  landPois.forEach((poi, idx) => {
    lootDefs.push({
      x: poi.x + 4,
      z: poi.z + 3,
      kind: idx % 2 === 0 ? 'medkit' : 'smallkit',
      label: idx % 2 === 0 ? 'Kit Médico (+75 HP)' : 'Kit Pequeno (+35 HP)',
    });
    lootDefs.push({
      x: poi.x - 4,
      z: poi.z + 5,
      kind: 'ammo',
      ammoAmount: 45,
      label: 'Munição +45',
    });
    lootDefs.push({
      x: poi.x + 2,
      z: poi.z - 5,
      kind: idx % 2 === 0 ? 'gloo' : 'grenade',
      glooAmount: 1,
      grenadeAmount: 1,
      label: idx % 2 === 0 ? 'Parede de Gelo (+1)' : 'Granada (+1)',
    });
    lootDefs.push({
      x: poi.x - 5,
      z: poi.z - 3,
      kind: 'scope',
      scopeType: interiorScopes[idx % interiorScopes.length],
      label: `Mira ${interiorScopes[idx % interiorScopes.length].toUpperCase()}`,
    });
    lootDefs.push({
      x: poi.x + 6,
      z: poi.z - 2,
      kind: 'helmet',
      level: ((idx % 3) + 1) as 1 | 2 | 3,
      label: `Capacete Nível ${(idx % 3) + 1}`,
    });
    lootDefs.push({
      x: poi.x - 2,
      z: poi.z + 1.8,
      kind: 'coin',
      coinAmount: 100,
      label: '100 Moedas FF',
    });
  });

  // Shared pooled geometries, prototypes & clean realistic materials + faint white floor glow disc
  const lootGlowTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      grad.addColorStop(0, 'rgba(255,255,255,0.75)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
      grad.addColorStop(1, 'rgba(255,255,255,0.0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  })();
  const lootGlowGeo = new THREE.CircleGeometry(0.52, 14);
  lootGlowGeo.rotateX(-Math.PI / 2);
  const lootGlowMat = new THREE.MeshBasicMaterial({
    map: lootGlowTex,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    color: 0xffffff,
  });

  const ammoCrateGeo = new THREE.BoxGeometry(0.32, 0.11, 0.22);
  const ammoStripGeo = new THREE.BoxGeometry(0.11, 0.116, 0.224);
  const medCaseGeo = new THREE.BoxGeometry(0.46, 0.18, 0.31);
  const medPadGeo = new THREE.BoxGeometry(0.24, 0.024, 0.18);
  const medCrossHGeo = new THREE.BoxGeometry(0.13, 0.03, 0.045);
  const medCrossVGeo = new THREE.BoxGeometry(0.045, 0.03, 0.13);
  const medHandleGeo = new THREE.BoxGeometry(0.14, 0.06, 0.05);
  const smallKitGeo = new THREE.BoxGeometry(0.24, 0.10, 0.19);
  const smallKitBandGeo = new THREE.BoxGeometry(0.075, 0.106, 0.194);
  const helmDomeGeo = new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const helmRimGeo = new THREE.TorusGeometry(0.205, 0.024, 6, 14);
  const scopeTubeGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.34, 10);
  scopeTubeGeo.rotateZ(Math.PI / 2);
  const scopeBellGeo = new THREE.CylinderGeometry(0.075, 0.058, 0.09, 10);
  scopeBellGeo.rotateZ(Math.PI / 2);
  const attCylGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.34, 10);
  attCylGeo.rotateZ(Math.PI / 2);
  const attGripGeo = new THREE.BoxGeometry(0.07, 0.22, 0.08);
  const attMagGeo = new THREE.BoxGeometry(0.065, 0.26, 0.11);
  const attStockGeo = new THREE.BoxGeometry(0.07, 0.16, 0.30);
  const glooCanGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.42, 10);
  const glooBandGeo = new THREE.TorusGeometry(0.145, 0.02, 6, 12);
  const fragBodyGeo = new THREE.BoxGeometry(0.19, 0.20, 0.19);
  const fragCapGeo = new THREE.BoxGeometry(0.04, 0.09, 0.04);
  const lootCoinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12);
  lootCoinGeo.rotateZ(Math.PI / 2);
  const lootDeathGeo = new THREE.BoxGeometry(0.76, 0.42, 0.52);

  // Clean realistic PBR materials matching reference loot items
  const matAmmoOlive = new THREE.MeshStandardMaterial({ color: 0x3b6345, roughness: 0.68, metalness: 0.15 });
  const matAmmoRed = new THREE.MeshStandardMaterial({ color: 0xa62626, roughness: 0.62, metalness: 0.15 });
  const matBeigeTan = new THREE.MeshStandardMaterial({ color: 0xcabca6, roughness: 0.64, metalness: 0.06 });
  const matGoldTrim = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.34, metalness: 0.72 });
  const matMedOlive = new THREE.MeshStandardMaterial({ color: 0x525946, roughness: 0.62, metalness: 0.14 });
  const matMedWhite = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.48, metalness: 0.05 });
  const matMedRed = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.42 });
  const matDarkMetal = new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.38, metalness: 0.78 });
  const matLensBlue = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.18, metalness: 0.85 });
  const matGlooCyan = new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.38, metalness: 0.28 });
  const matGrenadeOlive = new THREE.MeshStandardMaterial({ color: 0x4b5346, roughness: 0.55, metalness: 0.25 });
  const matDeathCrate = new THREE.MeshStandardMaterial({ color: 0x6b4728, roughness: 0.72, metalness: 0.12 });
  const armorMatByLevel: Record<number, THREE.MeshStandardMaterial> = {
    1: new THREE.MeshStandardMaterial({ color: 0x4b5842, roughness: 0.58, metalness: 0.22 }),
    2: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.48, metalness: 0.42 }),
    3: new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.35, metalness: 0.65 }),
  };

  // Weapon prototypes (exact same held assets via createWeaponModel, cloned for ground pickups)
  const weaponPrototypes: Record<WeaponId, THREE.Group> = {
    g18: createWeaponModel('g18'),
    deagle: createWeaponModel('deagle'),
    m4a1: createWeaponModel('m4a1'),
    xm8: createWeaponModel('xm8'),
    scar: createWeaponModel('scar'),
    ak47: createWeaponModel('ak47'),
    ump45: createWeaponModel('ump45'),
    m1014: createWeaponModel('m1014'),
    awm: createWeaponModel('awm'),
  };
  Object.values(weaponPrototypes).forEach((proto) => {
    proto.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
  });

  const buildLootVisual = (
    ld: {
      id: string;
      x: number;
      z: number;
      yOverride?: number;
      kind: LootItem['kind'];
      weaponId?: WeaponId;
      scopeType?: ScopeType;
      attachmentKind?: LootItem['attachmentKind'];
      level?: 1 | 2 | 3;
      ammoAmount?: number;
      glooAmount?: number;
      grenadeAmount?: number;
      coinAmount?: number;
      deathOwnerNick?: string;
      deathEntries?: DeathBoxItemEntry[];
      deathLoot?: LootItem['deathLoot'];
      label: string;
    },
    isDynamic = false,
  ): LootVisual => {
    const g = new THREE.Group();
    const ly = ld.yOverride !== undefined ? ld.yOverride : sampleGroundHeight(ld.x, ld.z);
    const yLift =
      ld.kind === 'deathbox' ? 0.21 : ld.kind === 'weapon' ? 0.34 : ld.kind === 'vest' || ld.kind === 'backpack' ? 0.30 : 0.24;
    g.position.set(ld.x, ly + yLift, ld.z);

    const itemRoot = new THREE.Group();

    if (ld.kind === 'weapon' && ld.weaponId) {
      const gun = weaponPrototypes[ld.weaponId].clone();
      const wScale =
        ld.weaponId === 'g18' || ld.weaponId === 'deagle'
          ? 1.55
          : ld.weaponId === 'awm'
            ? 1.15
            : 1.32;
      gun.scale.setScalar(wScale);
      gun.rotation.set(0, 0, 0.14);
      itemRoot.add(gun);
    } else if (ld.kind === 'ammo') {
      const isShotgunAmmo = (ld.ammoAmount ?? 30) <= 20;
      const crate = new THREE.Mesh(ammoCrateGeo, isShotgunAmmo ? matAmmoRed : matAmmoOlive);
      const strip = new THREE.Mesh(ammoStripGeo, matBeigeTan);
      strip.position.x = 0.095;
      itemRoot.add(crate, strip);
    } else if (ld.kind === 'coin') {
      const coin = new THREE.Mesh(lootCoinGeo, matGoldTrim);
      itemRoot.add(coin);
    } else if (ld.kind === 'medkit') {
      const box = new THREE.Mesh(medCaseGeo, matMedOlive);
      const strap = new THREE.Mesh(medHandleGeo, matDarkMetal);
      strap.scale.set(3.4, 0.45, 6.4);
      const latch = new THREE.Mesh(medHandleGeo, matDarkMetal);
      latch.position.set(0, 0, 0.155);
      latch.scale.set(0.6, 1.3, 0.4);
      const redPad = new THREE.Mesh(medPadGeo, matMedRed);
      redPad.position.y = 0.088;
      const crossH = new THREE.Mesh(medCrossHGeo, matMedWhite);
      crossH.position.y = 0.096;
      const crossV = new THREE.Mesh(medCrossVGeo, matMedWhite);
      crossV.position.y = 0.096;
      itemRoot.add(box, strap, latch, redPad, crossH, crossV);
    } else if (ld.kind === 'smallkit') {
      const pouch = new THREE.Mesh(smallKitGeo, matBeigeTan);
      const band = new THREE.Mesh(smallKitBandGeo, matMedRed);
      const crossH = new THREE.Mesh(medCrossHGeo, matMedWhite);
      crossH.scale.set(0.45, 0.7, 0.45);
      crossH.position.y = 0.048;
      itemRoot.add(pouch, band, crossH);
    } else if (ld.kind === 'vest') {
      const armorMat = armorMatByLevel[ld.level ?? 1] ?? armorMatByLevel[1];
      const vestAsset = createVestGeometryGroup(armorMat);
      vestAsset.scale.setScalar(1.15);
      itemRoot.add(vestAsset);
    } else if (ld.kind === 'helmet') {
      const armorMat = armorMatByLevel[ld.level ?? 1] ?? armorMatByLevel[1];
      const dome = new THREE.Mesh(helmDomeGeo, armorMat);
      dome.position.y = -0.04;
      const rim = new THREE.Mesh(helmRimGeo, matDarkMetal);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = -0.05;
      itemRoot.add(dome, rim);
    } else if (ld.kind === 'backpack') {
      const armorMat = armorMatByLevel[ld.level ?? 2] ?? armorMatByLevel[2];
      const packAsset = createBackpackGeometryGroup(armorMat, matDarkMetal);
      packAsset.scale.setScalar(1.15);
      itemRoot.add(packAsset);
    } else if (ld.kind === 'scope') {
      const tube = new THREE.Mesh(scopeTubeGeo, matDarkMetal);
      const bell = new THREE.Mesh(scopeBellGeo, matDarkMetal);
      bell.position.x = 0.17;
      const lens = new THREE.Mesh(scopeBellGeo, matLensBlue);
      lens.scale.set(0.35, 0.85, 0.85);
      lens.position.x = 0.21;
      itemRoot.add(tube, bell, lens);
    } else if (ld.kind === 'attachment') {
      if (ld.attachmentKind === 'grip') {
        const grip = new THREE.Mesh(attGripGeo, matDarkMetal);
        const rail = new THREE.Mesh(medHandleGeo, matGoldTrim);
        rail.position.y = 0.11;
        itemRoot.add(grip, rail);
      } else if (ld.attachmentKind === 'ext_mag') {
        const mag = new THREE.Mesh(attMagGeo, matDarkMetal);
        mag.rotation.z = -0.18;
        const base = new THREE.Mesh(medHandleGeo, matGoldTrim);
        base.position.set(0.02, -0.13, 0);
        itemRoot.add(mag, base);
      } else if (ld.attachmentKind === 'stock') {
        const st = new THREE.Mesh(attStockGeo, matDarkMetal);
        itemRoot.add(st);
      } else if (ld.attachmentKind === 'compensator') {
        const body = new THREE.Mesh(attCylGeo, matDarkMetal);
        body.scale.set(0.58, 1.15, 1.15);
        const tip = new THREE.Mesh(glooBandGeo, matGoldTrim);
        tip.scale.setScalar(0.42);
        tip.rotation.y = Math.PI / 2;
        tip.position.x = 0.08;
        itemRoot.add(body, tip);
      } else {
        const body = new THREE.Mesh(attCylGeo, matDarkMetal);
        const ringT = new THREE.Mesh(glooBandGeo, matGoldTrim);
        ringT.scale.setScalar(0.38);
        ringT.rotation.y = Math.PI / 2;
        itemRoot.add(body, ringT);
      }
    } else if (ld.kind === 'gloo') {
      const can = new THREE.Mesh(glooCanGeo, matGlooCyan);
      const band1 = new THREE.Mesh(glooBandGeo, matMedWhite);
      band1.rotation.x = Math.PI / 2;
      band1.position.y = 0.1;
      const band2 = new THREE.Mesh(glooBandGeo, matMedWhite);
      band2.rotation.x = Math.PI / 2;
      band2.position.y = -0.1;
      itemRoot.add(can, band1, band2);
    } else if (ld.kind === 'grenade') {
      const body = new THREE.Mesh(fragBodyGeo, matGrenadeOlive);
      const cap = new THREE.Mesh(fragCapGeo, matGoldTrim);
      cap.position.y = 0.18;
      itemRoot.add(body, cap);
    } else {
      const crate = new THREE.Mesh(lootDeathGeo, matDeathCrate);
      const trim = new THREE.Mesh(medHandleGeo, matGoldTrim);
      trim.scale.set(2.5, 1, 2.2);
      trim.position.y = 0.22;
      itemRoot.add(crate, trim);
    }

    // Stationary ground item with subtle, lightweight faint white glow disc underneath
    const glowSpot = new THREE.Mesh(lootGlowGeo, lootGlowMat);
    glowSpot.position.y = -yLift + 0.03;
    glowSpot.renderOrder = 1;
    g.add(glowSpot, itemRoot);
    scene.add(g);

    return {
      data: {
        id: ld.id,
        x: ld.x,
        y: ly,
        z: ld.z,
        kind: ld.kind,
        weaponId: ld.weaponId,
        scopeType: ld.scopeType,
        attachmentKind: ld.attachmentKind,
        level: ld.level,
        ammoAmount: ld.ammoAmount,
        glooAmount: ld.glooAmount,
        grenadeAmount: ld.grenadeAmount,
        coinAmount: ld.coinAmount,
        deathOwnerNick: ld.deathOwnerNick,
        deathEntries: ld.deathEntries,
        deathLoot: ld.deathLoot,
        label: ld.label,
        collected: false,
      },
      mesh: g,
      isDynamic,
    };
  };

  const loots: LootVisual[] = [];
  const jpPendingLootDefs = lootDefs.map((ld, idx) => ({
    ...ld,
    id: `loot_${idx}`,
    spawned: false,
  }));
  const bermudaPendingLootDefs: Array<{
    x: number;
    z: number;
    yOverride?: number;
    kind: LootItem['kind'];
    weaponId?: WeaponId;
    scopeType?: ScopeType;
    attachmentKind?: LootItem['attachmentKind'];
    level?: 1 | 2 | 3;
    glooAmount?: number;
    grenadeAmount?: number;
    deathLoot?: LootItem['deathLoot'];
    ammoAmount?: number;
    coinAmount?: number;
    label: string;
    id: string;
    spawned: boolean;
  }> = [];

  const getActiveLootDefs = () =>
    activeBrMap === 'bermuda' && bermudaPendingLootDefs.length > 0
      ? bermudaPendingLootDefs
      : jpPendingLootDefs;

  const syncProximityLoot = (px: number, pz: number, radius = 56, maxPerTick = 24) => {
    const activeDefs = getActiveLootDefs();
    const rSq = radius * radius;
    let spawnedThisTick = 0;
    for (let i = 0; i < activeDefs.length; i++) {
      const entry = activeDefs[i];
      if (entry.spawned) continue;
      const dx = entry.x - px;
      const dz = entry.z - pz;
      if (Math.abs(dx) > radius || Math.abs(dz) > radius) continue;
      if (dx * dx + dz * dz <= rSq) {
        entry.spawned = true;
        loots.push(buildLootVisual(entry, false));
        spawnedThisTick++;
        if (spawnedThisTick >= maxPerTick) break;
      }
    }
  };

  const resetMatchLoots = () => {
    for (let i = loots.length - 1; i >= 0; i--) {
      scene.remove(loots[i].mesh);
    }
    loots.length = 0;
    for (let i = 0; i < jpPendingLootDefs.length; i++) {
      jpPendingLootDefs[i].spawned = false;
    }
    for (let i = 0; i < bermudaPendingLootDefs.length; i++) {
      bermudaPendingLootDefs[i].spawned = false;
    }
  };

  let dynamicLootCounter = 1;
  const spawnDroppedLoot = (item: Omit<LootItem, 'id' | 'collected'>) => {
    const lv = buildLootVisual(
      {
        ...item,
        id: `drop_${dynamicLootCounter++}`,
        yOverride: item.y,
      },
      true,
    );
    loots.push(lv);
  };

  const clearDroppedLoots = () => {
    for (let i = loots.length - 1; i >= 0; i--) {
      if (loots[i].isDynamic) {
        scene.remove(loots[i].mesh);
        loots.splice(i, 1);
      }
    }
  };

  const hideExplosiveBarrel = (idx: number) => {
    const list = activeBrMap === 'bermuda' ? bermudaExplosiveBarrels : jpExplosiveBarrels;
    const cols = activeBrMap === 'bermuda' ? bermudaBarrelColliders : barrelColliders;
    const inst = activeBrMap === 'bermuda' ? bermudaBarrelInst : barrelInst;
    const eb = list[idx];
    if (!eb || eb.exploded || !inst) return;
    eb.exploded = true;
    dummy.position.set(eb.x, -50, eb.z);
    dummy.scale.set(0.001, 0.001, 0.001);
    dummy.updateMatrix();
    inst.setMatrixAt(idx, dummy.matrix);
    inst.instanceMatrix.needsUpdate = true;
    const col = cols[idx];
    if (col) {
      col.minY = -99;
      col.maxY = -98;
    }
  };

  const resetExplosiveBarrels = () => {
    const list = activeBrMap === 'bermuda' ? bermudaExplosiveBarrels : jpExplosiveBarrels;
    const cols = activeBrMap === 'bermuda' ? bermudaBarrelColliders : barrelColliders;
    const inst = activeBrMap === 'bermuda' ? bermudaBarrelInst : barrelInst;
    if (!inst) return;
    for (let i = 0; i < list.length; i++) {
      const eb = list[i];
      eb.exploded = false;
      dummy.position.set(eb.x, eb.y, eb.z);
      dummy.rotation.set(0, i * 0.5, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      const col = cols[i];
      if (col) {
        col.minY = eb.y - 0.625;
        col.maxY = eb.y + 0.655;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
  };

  // 17. Electric Blue Shrinking Safe Zone Cylinder Wall
  const safeZoneGeo = new THREE.CylinderGeometry(1, 1, 240, 48, 1, true);
  const safeZoneMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const safeZoneMesh = new THREE.Mesh(safeZoneGeo, safeZoneMat);
  safeZoneMesh.position.set(0, 75, 0);
  safeZoneMesh.scale.set(650, 1, 650);
  safeZoneMesh.visible = false;
  scene.add(safeZoneMesh);

  // 18. Airplane
  const { group: airplaneGroup, props: proceduralAirplaneProps } = createAirplane();
  const airplaneProps: THREE.Object3D[] = [...proceduralAirplaneProps];
  airplaneGroup.visible = false;
  scene.add(airplaneGroup);

  // 19. Distant Waiting Lobby Island (/3d/lobby.glb) & Gladiadores Arena (/3d/gladiadores.glb)
  const waitLobbyGroup = new THREE.Group();
  waitLobbyGroup.position.set(WAIT_LOBBY_ORIGIN.x, WAIT_LOBBY_ORIGIN.y, WAIT_LOBBY_ORIGIN.z);
  waitLobbyGroup.visible = false;
  const waitSnowBase = new THREE.Mesh(
    new THREE.CircleGeometry(68, 32),
    new THREE.MeshStandardMaterial({ color: 0xe6eff6, roughness: 0.9, metalness: 0.02 }),
  );
  waitSnowBase.rotation.x = -Math.PI / 2;
  waitSnowBase.position.y = -0.04;
  waitSnowBase.receiveShadow = true;
  const waitSeaBase = new THREE.Mesh(
    new THREE.CircleGeometry(900, 32),
    new THREE.MeshStandardMaterial({ color: 0x1a749e, roughness: 0.35, metalness: 0.12 }),
  );
  waitSeaBase.rotation.x = -Math.PI / 2;
  waitSeaBase.position.y = -1.6;
  waitLobbyGroup.add(waitSnowBase, waitSeaBase);
  scene.add(waitLobbyGroup);

  const gladiadoresGroup = new THREE.Group();
  gladiadoresGroup.position.set(GLADIADORES_ORIGIN.x, GLADIADORES_ORIGIN.y, GLADIADORES_ORIGIN.z);
  gladiadoresGroup.visible = false;
  const gladFloorPad = new THREE.Mesh(
    new THREE.PlaneGeometry(86, 74),
    new THREE.MeshStandardMaterial({ color: 0x3b3f45, roughness: 0.92, metalness: 0.08 }),
  );
  gladFloorPad.rotation.x = -Math.PI / 2;
  gladFloorPad.position.set(-15.5, 0.50, 0);
  gladFloorPad.receiveShadow = true;
  const gladOuterGround = new THREE.Mesh(
    new THREE.CircleGeometry(520, 32),
    new THREE.MeshStandardMaterial({ color: 0x262b30, roughness: 0.95, metalness: 0.04 }),
  );
  gladOuterGround.rotation.x = -Math.PI / 2;
  gladOuterGround.position.set(-15.5, -0.45, 0);
  gladiadoresGroup.add(gladFloorPad, gladOuterGround);
  scene.add(gladiadoresGroup);

  const waitCollisionGrid = new MeshCollisionGrid(2.0);
  const gladiadoresCollisionGrid = new MeshCollisionGrid(2.2);
  let externalAttached = false;

  const replaceInPlace = <T,>(target: T[], source: T[]): void => {
    target.length = 0;
    for (let i = 0; i < source.length; i++) {
      target.push(source[i]);
    }
  };

  const applyActiveMapLists = () => {
    const isBermuda = activeBrMap === 'bermuda' && bermudaAttached;
    joaoPessoaGroup.visible = !isBermuda;
    bermudaGroup.visible = isBermuda;

    if (isBermuda) {
      replaceInPlace(pois, bermudaPois);
      replaceInPlace(buildings, bermudaBuildings);
      replaceInPlace(roads, bermudaRoads);
      replaceInPlace(vendingMachines, bermudaVendingMachines);
      replaceInPlace(explosiveBarrels, bermudaExplosiveBarrels);
      replaceInPlace(launchPads, bermudaLaunchPads);
      replaceInPlace(buildingNavZones, bermudaBuildingNavZones);
      replaceInPlace(obstacleMeshes, bermudaObstacleMeshes);
      replaceInPlace(platforms, bermudaPlatforms);
      replaceInPlace(colliders, bermudaStaticColliders);
      handleRef.staticColliderCount = colliders.length;
      for (let i = 0; i < bermudaVehicles.length; i++) {
        colliders.push(bermudaVehicles[i].collider);
      }
      replaceInPlace(vehicles, bermudaVehicles);
    } else {
      replaceInPlace(pois, jpPois);
      replaceInPlace(buildings, jpBuildings);
      replaceInPlace(roads, jpRoads);
      replaceInPlace(vendingMachines, jpVendingMachines);
      replaceInPlace(explosiveBarrels, jpExplosiveBarrels);
      replaceInPlace(launchPads, jpLaunchPads);
      replaceInPlace(buildingNavZones, jpBuildingNavZones);
      replaceInPlace(obstacleMeshes, jpObstacleMeshes);
      replaceInPlace(platforms, jpPlatforms);
      replaceInPlace(colliders, jpStaticColliders);
      handleRef.staticColliderCount = colliders.length;
      for (let i = 0; i < jpVehicles.length; i++) {
        colliders.push(jpVehicles[i].collider);
      }
      replaceInPlace(vehicles, jpVehicles);
    }
  };

  const setActiveBrMap = (mapId: BrMapId) => {
    if (activeBrMap === mapId && (mapId !== 'bermuda' || bermudaAttached)) {
      joaoPessoaGroup.visible = mapId === 'joao_pessoa';
      bermudaGroup.visible = mapId === 'bermuda';
      return;
    }
    activeBrMap = mapId;
    resetMatchLoots();
    applyActiveMapLists();
  };

  const attachExternalWorldModels = (assets: ExternalWorldAssets) => {
    if (externalAttached) return;
    externalAttached = true;

    if (assets.airplaneTemplate) {
      const planeModel = assets.airplaneTemplate.clone(true);
      airplaneGroup.clear();
      airplaneGroup.add(planeModel);
      airplaneProps.length = 0;
      const screws = extractAirplanePropellers(planeModel);
      for (let i = 0; i < screws.length; i++) {
        airplaneProps.push(screws[i]);
      }
    }

    if (assets.lobbyTemplate) {
      const lobbyModel = assets.lobbyTemplate.clone(true);
      applyGlbDistanceTextureLod(lobbyModel);
      waitLobbyGroup.add(lobbyModel);
      waitLobbyGroup.updateMatrixWorld(true);
      waitCollisionGrid.buildFromObject(lobbyModel);
    }

    if (assets.gladiadoresTemplate) {
      const gladModel = assets.gladiadoresTemplate.clone(true);
      applyGlbDistanceTextureLod(gladModel);
      gladiadoresGroup.add(gladModel);
      gladiadoresGroup.updateMatrixWorld(true);
      gladiadoresCollisionGrid.buildFromObject(gladModel);
    }

    if (assets.bermudaTemplate) {
      const bermudaModel = assets.bermudaTemplate.clone(true);
      applyGlbDistanceTextureLod(bermudaModel);
      bermudaGroup.add(bermudaModel);
      bermudaGroup.updateMatrixWorld(true);
      bermudaCollisionGrid.buildFromObject(bermudaModel);

      // Collect discrete buildings, trees, rocks & props in bermuda.glb for view-cone + distance culling
      // Keep large terrain/ground/road/ocean meshes always visible (handled by fog & flat-color LOD).
      bermudaCullables.length = 0;
      const cullBox = new THREE.Box3();
      const cullCenter = new THREE.Vector3();
      const cullSize = new THREE.Vector3();
      const NEVER_CULL_RE =
        /terrain|ground|water|ocean|sea|sky|cloud|highway|airport_road|p_road|road|runway/i;
      bermudaModel.traverse((node) => {
        if (!(node as THREE.Mesh).isMesh) return;
        const m = node as THREE.Mesh;
        if (!m.visible) return;
        const pName = m.parent?.name ?? '';
        if (NEVER_CULL_RE.test(m.name) || NEVER_CULL_RE.test(pName)) return;
        const geo = m.geometry as THREE.BufferGeometry | undefined;
        if (!geo) return;
        if (!geo.boundingBox) geo.computeBoundingBox();
        if (!geo.boundingBox) return;
        cullBox.copy(geo.boundingBox).applyMatrix4(m.matrixWorld);
        cullBox.getSize(cullSize);
        if (Math.max(cullSize.x, cullSize.z) >= 135) return;
        cullBox.getCenter(cullCenter);
        const radius = Math.max(2.5, Math.hypot(cullSize.x, cullSize.z) * 0.5);
        bermudaCullables.push({
          obj: m,
          x: cullCenter.x,
          z: cullCenter.z,
          radius,
        });
      });

      // Extract real houses, hangars & 2nd floors from bermuda.glb (zero changes to map mesh!)
      const spots = extractBermudaBuildingSpots(bermudaModel, bermudaCollisionGrid);
      const bermudaGroundAt = (x: number, z: number) =>
        bermudaCollisionGrid.sampleTerrainHeight(x, z, BERMUDA_GLB_WATER_Y);
      const findNearestDrySpot = (tx: number, tz: number): { x: number; z: number; y: number } => {
        const directY = bermudaGroundAt(tx, tz);
        if (directY > -0.6) return { x: tx, z: tz, y: directY };
        for (let r = 8; r <= 72; r += 8) {
          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            const cx = tx + Math.cos(ang) * r;
            const cz = tz + Math.sin(ang) * r;
            const cy = bermudaGroundAt(cx, cz);
            if (cy > -0.6) return { x: cx, z: cz, y: cy };
          }
        }
        let bestSpot = spots[0];
        let bestDist = Infinity;
        for (let i = 0; i < spots.length; i++) {
          const d = Math.hypot(spots[i].x - tx, spots[i].z - tz);
          if (d < bestDist) {
            bestDist = d;
            bestSpot = spots[i];
          }
        }
        if (bestSpot) return { x: bestSpot.x, z: bestSpot.z, y: bestSpot.groundY };
        return { x: tx, z: tz, y: 0.2 };
      };

      // Populate minimap buildings, bot nav zones & inside/2nd-floor loot across the entire island!
      let bermudaLootId = 0;
      const pushBermudaLoot = (
        ld: Omit<(typeof bermudaPendingLootDefs)[number], 'id' | 'spawned'>,
      ) => {
        bermudaPendingLootDefs.push({
          ...ld,
          id: `b_loot_${bermudaLootId++}`,
          spawned: false,
        });
      };

      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        const kind: MinimapBuilding['kind'] =
          s.w > 22 || s.d > 22
            ? 'shed'
            : s.secondFloorY !== null
              ? 'sobrado'
              : 'house';
        bermudaBuildings.push({
          x: s.x,
          z: s.z,
          w: s.w,
          d: s.d,
          rotY: 0,
          kind,
        });
        bermudaBuildingNavZones.push({
          cx: s.x,
          cz: s.z,
          halfW: Math.max(3, s.w * 0.42),
          halfD: Math.max(3, s.d * 0.42),
          rotY: 0,
          baseY: s.groundY,
          secondFloorY: s.secondFloorY ?? undefined,
          doors: [
            { inX: s.x, inZ: s.z, outX: s.x + s.w * 0.55 + 2.2, outZ: s.z },
            { inX: s.x, inZ: s.z, outX: s.x - s.w * 0.55 - 2.2, outZ: s.z },
          ],
        });

        // 1st-floor weapon + gear + healing/utility/coins
        const floorY = s.groundY + 0.12;
        const wId = interiorWeapons[i % interiorWeapons.length];
        pushBermudaLoot({
          x: s.x + Math.min(2.2, s.w * 0.16),
          z: s.z - Math.min(2.2, s.d * 0.16),
          yOverride: floorY,
          kind: 'weapon',
          weaponId: wId,
          label:
            wId === 'm4a1'
              ? 'Carabina M4-17'
              : wId === 'xm8'
                ? 'Fuzil XM8'
                : wId === 'scar'
                  ? 'Rifle SCAR'
                  : wId === 'ak47'
                    ? 'Fuzil AK-47'
                    : wId === 'deagle'
                      ? 'Desert Eagle'
                      : wId === 'ump45'
                        ? 'SMG UMP-17'
                        : wId === 'm1014'
                          ? 'Espingarda M10-17'
                          : 'Sniper AWM-17',
        });

        const lvl = (((i % 3) + 1) as 1 | 2 | 3);
        const gearMod = i % 3;
        pushBermudaLoot({
          x: s.x - Math.min(2.0, s.w * 0.15),
          z: s.z + Math.min(2.0, s.d * 0.15),
          yOverride: floorY,
          kind: gearMod === 0 ? 'vest' : gearMod === 1 ? 'helmet' : 'backpack',
          level: gearMod === 2 && lvl === 1 ? 2 : lvl,
          label:
            gearMod === 0
              ? `Colete Nível ${lvl}`
              : gearMod === 1
                ? `Capacete Nível ${lvl}`
                : `Mochila Nível ${lvl === 1 ? 2 : lvl}`,
        });

        if (i % 2 === 0) {
          const isSmall = i % 4 === 2;
          pushBermudaLoot({
            x: s.x + Math.min(1.6, s.w * 0.12),
            z: s.z + Math.min(1.8, s.d * 0.14),
            yOverride: floorY,
            kind: isSmall ? 'smallkit' : 'medkit',
            label: isSmall ? 'Kit Pequeno (+35 HP)' : 'Kit Médico (+75 HP)',
          });
        } else {
          const att = interiorAttachments[i % interiorAttachments.length];
          pushBermudaLoot({
            x: s.x + Math.min(1.6, s.w * 0.12),
            z: s.z + Math.min(1.8, s.d * 0.14),
            yOverride: floorY,
            kind: 'attachment',
            attachmentKind: att,
            label:
              att === 'silencer'
                ? 'Silenciador'
                : att === 'compensator'
                  ? 'Boca / Compensador'
                  : att === 'grip'
                    ? 'Empunhadura Tática'
                    : att === 'ext_mag'
                      ? 'Carregador Estendido'
                      : 'Coronha Tática',
          });
        }

        const mod4 = i % 4;
        if (mod4 === 0) {
          const sc = interiorScopes[i % interiorScopes.length];
          pushBermudaLoot({
            x: s.x,
            z: s.z,
            yOverride: floorY,
            kind: 'scope',
            scopeType: sc,
            label: `Mira ${sc.toUpperCase()}`,
          });
        } else if (mod4 === 1) {
          pushBermudaLoot({
            x: s.x,
            z: s.z,
            yOverride: floorY,
            kind: 'gloo',
            glooAmount: 2,
            label: 'Parede de Gelo x2',
          });
        } else if (mod4 === 2) {
          pushBermudaLoot({
            x: s.x,
            z: s.z,
            yOverride: floorY,
            kind: 'grenade',
            grenadeAmount: 2,
            label: 'Granada Explosiva x2',
          });
        } else {
          pushBermudaLoot({
            x: s.x,
            z: s.z,
            yOverride: floorY,
            kind: 'ammo',
            ammoAmount: 45,
            label: 'Munição +45',
          });
        }

        pushBermudaLoot({
          x: s.x - Math.min(1.8, s.w * 0.14),
          z: s.z - Math.min(1.8, s.d * 0.14),
          yOverride: floorY,
          kind: 'coin',
          coinAmount: i % 3 === 0 ? 200 : 100,
          label: i % 3 === 0 ? '200 Moedas FF' : '100 Moedas FF',
        });

        // 2nd floor tactical loot when building has upper story
        if (s.secondFloorY !== null) {
          const upperY = s.secondFloorY + 0.12;
          const upWeapon = interiorWeapons[(i + 3) % interiorWeapons.length];
          pushBermudaLoot({
            x: s.x + 1.1,
            z: s.z + 1.1,
            yOverride: upperY,
            kind: 'weapon',
            weaponId: upWeapon,
            label: WEAPONS[upWeapon].name,
          });
          pushBermudaLoot({
            x: s.x - 1.1,
            z: s.z - 1.1,
            yOverride: upperY,
            kind: i % 2 === 0 ? 'vest' : 'scope',
            level: 3,
            scopeType: '4x',
            label: i % 2 === 0 ? 'Colete Nível 3' : 'Mira 4X',
          });
        }
      }

      // Snap Bermuda POIs to confirmed dry ground & sprinkle compound courtyard loot
      for (let i = 0; i < bermudaPois.length; i++) {
        const dry = findNearestDrySpot(bermudaPois[i].x, bermudaPois[i].z);
        bermudaPois[i].x = dry.x;
        bermudaPois[i].z = dry.z;

        const poiW = interiorWeapons[i % interiorWeapons.length];
        pushBermudaLoot({
          x: dry.x + 3.2,
          z: dry.z + 2.4,
          yOverride: bermudaGroundAt(dry.x + 3.2, dry.z + 2.4) + 0.12,
          kind: 'weapon',
          weaponId: poiW,
          label: WEAPONS[poiW].name,
        });
        pushBermudaLoot({
          x: dry.x - 3.4,
          z: dry.z + 3.0,
          yOverride: bermudaGroundAt(dry.x - 3.4, dry.z + 3.0) + 0.12,
          kind: 'ammo',
          ammoAmount: 45,
          label: 'Munição +45',
        });
        pushBermudaLoot({
          x: dry.x + 2.0,
          z: dry.z - 3.6,
          yOverride: bermudaGroundAt(dry.x + 2.0, dry.z - 3.6) + 0.12,
          kind: i % 2 === 0 ? 'medkit' : 'gloo',
          glooAmount: 2,
          label: i % 2 === 0 ? 'Kit Médico (+75 HP)' : 'Parede de Gelo x2',
        });
      }

      // 8 Vending Machines ("Lojinhas") across Bermuda
      const bermudaVendingSpecs = [
        { id: 'bvm_clock', x: -242, z: -162, rotY: 0.4, label: 'Lojinha Clock Tower' },
        { id: 'bvm_pochinok', x: -115, z: -152, rotY: -0.6, label: 'Lojinha Pochinok' },
        { id: 'bvm_peak', x: -64, z: -252, rotY: 0.2, label: 'Lojinha Peak' },
        { id: 'bvm_bimasakti', x: 64, z: -246, rotY: -1.2, label: 'Lojinha Bimasakti' },
        { id: 'bvm_factory', x: 118, z: -120, rotY: 0.8, label: 'Lojinha Factory' },
        { id: 'bvm_hangar', x: 248, z: -186, rotY: -0.3, label: 'Lojinha Hangar' },
        { id: 'bvm_observatorio', x: -334, z: 6, rotY: 1.1, label: 'Lojinha Observatório' },
        { id: 'bvm_mars', x: -25, z: 175, rotY: 0.0, label: 'Lojinha Mars Electric' },
      ];
      bermudaVendingSpecs.forEach((vs) => {
        const dry = findNearestDrySpot(vs.x, vs.z);
        const vm = createVendingMachineProp(
          vs.id,
          dry.x,
          dry.z,
          vs.rotY,
          vs.label,
          bermudaStaticColliders,
          bermudaObstacleMeshes,
          dry.y,
        );
        bermudaGroup.add(vm.group);
        bermudaVendingMachines.push(vm.data);
      });

      // 16 Explosive Red Barrels across Bermuda POIs
      const bermudaBarrelSpots = [
        [-252, -165], [-268, -182], [-120, -158], [-72, -258],
        [-84, -270], [4, -398], [100, -124], [114, -138],
        [48, -248], [62, -264], [254, -192], [268, -206],
        [436, 18], [-340, 4], [-364, -166], [-30, 178],
      ];
      bermudaBarrelInst = new THREE.InstancedMesh(
        barrelGeo,
        barrelMat,
        bermudaBarrelSpots.length,
      );
      bermudaBarrelInst.castShadow = false;
      bermudaBarrelInst.receiveShadow = true;
      bermudaBarrelInst.userData.isExplosiveBarrelInst = true;
      bermudaBarrelSpots.forEach(([bx, bz], idx) => {
        const dry = findNearestDrySpot(bx, bz);
        dummy.position.set(dry.x, dry.y + 0.625, dry.z);
        dummy.rotation.set(0, idx * 0.5, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bermudaBarrelInst!.setMatrixAt(idx, dummy.matrix);
        bermudaExplosiveBarrels.push({
          id: `b_barrel_${idx}`,
          x: dry.x,
          y: dry.y + 0.625,
          z: dry.z,
          exploded: false,
          instanceIdx: idx,
        });
        const col: WorldObbCollider = {
          cx: dry.x,
          cz: dry.z,
          halfW: 0.48,
          halfD: 0.48,
          rotY: 0,
          minY: dry.y,
          maxY: dry.y + 1.28,
          tag: 'barrel',
        };
        bermudaStaticColliders.push(col);
        bermudaBarrelColliders.push(col);
      });
      bermudaBarrelInst.computeBoundingSphere();
      bermudaGroup.add(bermudaBarrelInst);
      bermudaObstacleMeshes.push(bermudaBarrelInst);

      // 8 Drivable Vehicles across Bermuda Highways & Airport
      const bermudaVehSpecs: Array<{
        id: string;
        kind: VehicleKind;
        x: number;
        z: number;
        rotY: number;
      }> = [
        { id: 'bveh_0', kind: 'sport', x: -248, z: -156, rotY: 0.3 },
        { id: 'bveh_1', kind: 'jeep', x: -118, z: -146, rotY: -1.1 },
        { id: 'bveh_2', kind: 'sport', x: 58, z: -240, rotY: 1.4 },
        { id: 'bveh_3', kind: 'jeep', x: 112, z: -116, rotY: -0.4 },
        { id: 'bveh_4', kind: 'sport', x: 252, z: -182, rotY: 0.8 },
        { id: 'bveh_5', kind: 'jeep', x: 432, z: 20, rotY: 1.57 },
        { id: 'bveh_6', kind: 'jeep', x: -330, z: -12, rotY: 0.2 },
        { id: 'bveh_7', kind: 'sport', x: -42, z: 168, rotY: -0.5 },
      ];
      bermudaVehSpecs.forEach((vs) => {
        const dry = findNearestDrySpot(vs.x, vs.z);
        const v = createDrivableVehicle(
          vs.id,
          vs.kind,
          dry.x,
          dry.z,
          vs.rotY,
          bermudaStaticColliders,
          bermudaObstacleMeshes,
          dry.y,
        );
        // Remove the constructor-pushed collider from bermudaStaticColliders tail; it belongs in dynamic tail
        bermudaStaticColliders.pop();
        bermudaGroup.add(v.group);
        bermudaVehicles.push(v);
      });

      // 6 Tactical Launch Pads across Bermuda
      const bermudaPadSpecs: Array<[number, number, number, number, string]> = [
        [-248, -182, -77, -264, 'LANÇADOR -> PEAK'],
        [-68, -270, 53, -257, 'LANÇADOR -> BIMASAKTI'],
        [62, -262, 105, -131, 'LANÇADOR -> FACTORY'],
        [114, -142, 259, -199, 'LANÇADOR -> HANGAR'],
        [272, -188, 447, 23, 'LANÇADOR -> AEROPORTO'],
        [-334, -18, -256, -173, 'LANÇADOR -> CLOCK TOWER'],
      ];
      bermudaPadSpecs.forEach(([lx, lz, tx, tz, label]) => {
        const dry = findNearestDrySpot(lx, lz);
        const dx = tx - dry.x;
        const dz = tz - dry.z;
        const horiz = Math.hypot(dx, dz) || 1;
        const yaw = Math.atan2(dx, dz);
        const padG = new THREE.Group();
        padG.position.set(dry.x, dry.y + 0.12, dry.z);
        padG.rotation.y = yaw;
        const base = new THREE.Mesh(padBaseGeo, padBaseMat);
        const plate = new THREE.Mesh(padPlateGeo, padGlowMat);
        plate.position.set(0, 0.26, 0.15);
        plate.rotation.x = -0.48;
        padG.add(base, plate);
        bermudaGroup.add(padG);
        bermudaLaunchPads.push({
          x: dry.x,
          y: dry.y,
          z: dry.z,
          dirX: dx / horiz,
          dirY: 0.72,
          dirZ: dz / horiz,
          label,
        });
      });

      bermudaMinimapCanvas = generateBermudaMinimapCanvas(
        bermudaCollisionGrid,
        bermudaBuildings,
        BERMUDA_GLB_MAP_RANGE,
      );
      handleRef.bermudaMinimapCanvas = bermudaMinimapCanvas;
      bermudaAttached = true;
      applyActiveMapLists();
    }
  };

  // Freeze static terrain, buildings, props, roads & foliage matrices of Joao Pessoa
  joaoPessoaGroup.traverse((node) => {
    node.updateMatrix();
    node.matrixAutoUpdate = false;
  });
  for (let i = 0; i < jpVehicles.length; i++) {
    jpVehicles[i].group.traverse((node) => {
      node.matrixAutoUpdate = true;
    });
  }

  let structureCullDist = 250;

  let baseFogNear = 92;
  let baseFogFar = 220;
  let baseCamFar = 245;

  const applyQuality = (
    quality: GraphicsQuality,
    isSoftwareGl: boolean,
    textureQuality?: TextureQuality,
    shadowQuality?: ShadowQuality,
  ) => {
    const resolvedTex: TextureQuality =
      textureQuality ?? (quality === 'low' ? 'low' : quality === 'high' ? 'ultra' : 'medium');
    const resolvedShadow: ShadowQuality = isSoftwareGl
      ? 'off'
      : (shadowQuality ?? (quality === 'low' ? 'off' : quality === 'high' ? 'high' : 'low'));

    textures.applyQuality(resolvedTex);
    // Tighter texture-detail distance across ALL presets (even Ultra) -> flat texture color beyond threshold
    texDistUniform.value =
      resolvedTex === 'low'
        ? 28.0
        : resolvedTex === 'medium'
          ? 42.0
          : resolvedTex === 'high'
            ? 56.0
            : 70.0;
    terrainMat.roughness = resolvedTex === 'low' ? 0.94 : resolvedTex === 'ultra' ? 0.86 : 0.9;
    asphaltRoadMat.roughness = resolvedTex === 'low' ? 0.88 : resolvedTex === 'ultra' ? 0.76 : 0.82;

    if (resolvedShadow === 'off') {
      sunLight.castShadow = false;
      foliageCtrl.setFoliageShadows(false, false);
    } else {
      const mobile = isMobileHardware();
      sunLight.castShadow = true;
      const mapDim =
        resolvedShadow === 'low'
          ? 512
          : resolvedShadow === 'medium'
            ? 1024
            : resolvedShadow === 'high'
              ? 2048
              : mobile
                ? 2048
                : 4096;
      const frustumHalf =
        resolvedShadow === 'low'
          ? 58
          : resolvedShadow === 'medium'
            ? 78
            : resolvedShadow === 'high'
              ? 102
              : 124;
      sunLight.shadow.mapSize.set(mapDim, mapDim);
      sunLight.shadow.camera.left = -frustumHalf;
      sunLight.shadow.camera.right = frustumHalf;
      sunLight.shadow.camera.top = frustumHalf;
      sunLight.shadow.camera.bottom = -frustumHalf;
      sunLight.shadow.camera.near = 8;
      sunLight.shadow.camera.far = 290;
      sunLight.shadow.camera.updateProjectionMatrix();
      sunLight.shadow.radius =
        resolvedShadow === 'low'
          ? 1.0
          : resolvedShadow === 'medium'
            ? 1.5
            : resolvedShadow === 'high'
              ? 2.1
              : 2.6;
      sunLight.shadow.bias = resolvedShadow === 'ultra' ? -0.00032 : -0.00048;
      sunLight.shadow.normalBias = resolvedShadow === 'ultra' ? 0.018 : 0.024;
      foliageCtrl.setFoliageShadows(
        resolvedShadow === 'high' || resolvedShadow === 'ultra',
        resolvedShadow === 'ultra',
      );
    }
    if (sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null;
    }

    if (quality === 'low' || isSoftwareGl) {
      baseFogNear = 62;
      baseFogFar = 165;
      baseCamFar = 185;
      structureCullDist = 105;
      sunLight.intensity = 1.95;
      hemi.intensity = 1.62;
      waterMat.roughness = 0.72;
      waterMat.metalness = 0.02;
      waterMat.envMapIntensity = 0.4;
      cloudMat.opacity = 0.6;
      scene.environment = null;
      scene.environmentIntensity = 0;
    } else if (quality === 'medium') {
      baseFogNear = 92;
      baseFogFar = 220;
      baseCamFar = 245;
      structureCullDist = 140;
      sunLight.intensity = 1.98;
      hemi.intensity = 1.38;
      waterMat.roughness = 0.32;
      waterMat.metalness = 0.2;
      waterMat.envMapIntensity = 0.9;
      cloudMat.opacity = 0.74;
      scene.environment = envMap;
      scene.environmentIntensity = 0.58;
    } else {
      baseFogNear = 122;
      baseFogFar = 275;
      baseCamFar = 305;
      structureCullDist = 180;
      sunLight.intensity = 2.24;
      hemi.intensity = 1.36;
      waterMat.roughness = 0.12;
      waterMat.metalness = 0.38;
      waterMat.envMapIntensity = 1.35;
      cloudMat.opacity = 0.86;
      scene.environment = envMap;
      scene.environmentIntensity = 1.05;
    }
    fog.near = baseFogNear;
    fog.far = baseFogFar;
    camera.far = baseCamFar;
    camera.updateProjectionMatrix();
  };

  const shouldRenderInView = (
    ox: number,
    oz: number,
    cx: number,
    cz: number,
    fwdX: number,
    fwdZ: number,
    hasFwd: boolean,
    objRadius: number,
    maxDist: number,
    near360Radius: number,
  ): boolean => {
    const dx = ox - cx;
    const dz = oz - cz;
    const maxR = maxDist + objRadius;
    if (Math.abs(dx) > maxR || Math.abs(dz) > maxR) return false;
    const dSq = dx * dx + dz * dz;
    if (dSq > maxR * maxR) return false;
    const safeR = near360Radius + objRadius;
    if (dSq <= safeR * safeR) return true;
    if (!hasFwd) return true;
    const dist = Math.sqrt(dSq);
    const dot = dx * fwdX + dz * fwdZ;
    // Wide ~160-deg front cone + object radius margin so screen edges never pop
    return dot + objRadius * 1.1 >= dist * 0.14;
  };

  const updateDynamicProps = (
    dt: number,
    elapsed: number,
    camPos?: THREE.Vector3,
    lootRenderDist = 24,
    camFwdX?: number,
    camFwdZ?: number,
    isAirborne = false,
  ) => {
    cloudGroup.rotation.y = elapsed * 0.0025;

    const cx = camPos ? camPos.x : 0;
    const cz = camPos ? camPos.z : 0;
    const cy = camPos ? camPos.y : 0;
    skyDome.position.set(cx, 0, cz);
    const animMaxSq = 16 * 16;

    const fwdLen =
      camFwdX !== undefined && camFwdZ !== undefined ? Math.hypot(camFwdX, camFwdZ) : 0;
    const hasFwd = fwdLen > 0.001;
    const fwdX = hasFwd ? camFwdX! / fwdLen : 0;
    const fwdZ = hasFwd ? camFwdZ! / fwdLen : -1;

    const targetFogNear = isAirborne ? Math.max(baseFogNear, 280) : baseFogNear;
    const targetFogFar = isAirborne ? Math.max(baseFogFar, 560) : baseFogFar;
    const targetCamFar = isAirborne ? Math.max(baseCamFar, 620) : baseCamFar;
    if (fog.near !== targetFogNear || fog.far !== targetFogFar) {
      fog.near = targetFogNear;
      fog.far = targetFogFar;
    }
    if (Math.abs(camera.far - targetCamFar) > 1) {
      camera.far = targetCamFar;
      camera.updateProjectionMatrix();
    }

    if (camPos) {
      waitLobbyGroup.visible =
        Math.abs(cx - WAIT_LOBBY_ORIGIN.x) < 180 &&
        Math.abs(cz - WAIT_LOBBY_ORIGIN.z) < 180;
      gladiadoresGroup.visible =
        Math.abs(cx - GLADIADORES_ORIGIN.x) < 180 &&
        Math.abs(cz - GLADIADORES_ORIGIN.z) < 180;

      const keepAllStructures = isAirborne || cy > 45;
      if (activeBrMap === 'joao_pessoa') {
        for (let i = 0; i < cullableStructures.length; i++) {
          const s = cullableStructures[i];
          const vis = keepAllStructures
            ? true
            : shouldRenderInView(
                s.x,
                s.z,
                cx,
                cz,
                fwdX,
                fwdZ,
                hasFwd,
                16 * s.radiusScale,
                structureCullDist * s.radiusScale,
                34,
              );
          if (s.obj.visible !== vis) {
            s.obj.visible = vis;
          }
        }
      } else if (bermudaAttached) {
        for (let i = 0; i < bermudaCullables.length; i++) {
          const b = bermudaCullables[i];
          const vis = keepAllStructures
            ? true
            : shouldRenderInView(
                b.x,
                b.z,
                cx,
                cz,
                fwdX,
                fwdZ,
                hasFwd,
                b.radius,
                structureCullDist,
                34,
              );
          if (b.obj.visible !== vis) {
            b.obj.visible = vis;
          }
        }
      }

      // Vehicles keep full physics/collision simulation regardless of visibility;
      // 42m 360-deg safety bubble + active driver guard prevents reverse/turning bugs.
      const vehCullR = structureCullDist + 24;
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        const vis =
          keepAllStructures || v.driverIsPlayer
            ? true
            : shouldRenderInView(
                v.x,
                v.z,
                cx,
                cz,
                fwdX,
                fwdZ,
                hasFwd,
                3.2,
                vehCullR,
                42,
              );
        if (v.group.visible !== vis) {
          v.group.visible = vis;
        }
      }
    }

    for (let i = 0; i < loots.length; i++) {
      const l = loots[i];
      if (l.data.collected) continue;
      if (camPos) {
        const vis = shouldRenderInView(
          l.data.x,
          l.data.z,
          cx,
          cz,
          fwdX,
          fwdZ,
          hasFwd,
          1.2,
          lootRenderDist,
          10,
        );
        if (l.mesh.visible !== vis) {
          l.mesh.visible = vis;
        }
        if (!vis) continue;
        const dx = l.data.x - cx;
        const dz = l.data.z - cz;
        if (dx * dx + dz * dz > animMaxSq) continue;
      }
      if (l.data.kind !== 'deathbox') {
        l.mesh.children[0].rotation.y = elapsed * 1.8 + i;
      }
    }
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.hitFlash > 0) {
        t.hitFlash = 0;
      }
    }
    if (airplaneGroup.visible) {
      airplaneProps.forEach((p) => {
        p.rotation.z += dt * 28;
      });
    }
  };

  const dispose = () => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.userData?.sharedWeaponAsset) return;
        m.geometry.dispose();
        const disposeMat = (mat: THREE.Material) => {
          if (mat.userData?.disposeMap && (mat as THREE.MeshStandardMaterial).map) {
            (mat as THREE.MeshStandardMaterial).map?.dispose();
          }
          mat.dispose();
        };
        if (Array.isArray(m.material)) {
          m.material.forEach(disposeMat);
        } else {
          disposeMat(m.material);
        }
      }
    });
  };

  const resetVehicles = () => {
    vehicles.forEach((v) => {
      const sy = groundHeightAt(v.spawnX, v.spawnZ);
      v.x = v.spawnX;
      v.y = sy;
      v.z = v.spawnZ;
      v.yaw = v.spawnRotY;
      v.speed = 0;
      v.hp = v.maxHp;
      v.destroyed = false;
      v.driverIsPlayer = false;
      v.passengerIds = [];
      v.group.position.set(v.x, v.y, v.z);
      v.group.rotation.set(0, v.yaw, 0);
      v.chassisGroup.rotation.set(0, 0, 0);
      v.chassisGroup.visible = true;
      v.burnedGroup.visible = false;
      v.steerFL.rotation.y = 0;
      v.steerFR.rotation.y = 0;
      v.smokeMeshes.forEach((sm) => {
        sm.visible = false;
      });
      v.collider.cx = v.x;
      v.collider.cz = v.z;
      v.collider.rotY = v.yaw;
      v.collider.minY = v.y;
      v.collider.maxY = v.y + 2.05;
    });
  };

  const pois: PoiMarker[] = [];
  const explosiveBarrels: ExplosiveBarrel[] = [];
  const launchPads: LaunchPadProp[] = [];
  const vendingMachines: VendingMachineProp[] = [];

  const handleRef: WorldHandle = {
    scene,
    camera,
    sunLight,
    airplaneGroup,
    airplaneProps,
    waitLobbyGroup,
    gladiadoresGroup,
    waitCollisionGrid,
    gladiadoresCollisionGrid,
    bermudaCollisionGrid,
    bermudaMinimapCanvas,
    bermudaMapRange: BERMUDA_GLB_MAP_RANGE,
    getActiveBrMap: () => activeBrMap,
    setActiveBrMap,
    attachExternalWorldModels,
    safeZoneMesh,
    colliders,
    staticColliderCount: jpStaticColliders.length,
    platforms,
    buildingNavZones,
    obstacleMeshes,
    buildings,
    roads,
    pois,
    targets,
    loots,
    explosiveBarrels,
    launchPads,
    vendingMachines,
    vehicles,
    queryStaticCollidersNear,
    queryStaticPlatformsNear,
    findBuildingNavZoneAt,
    hideExplosiveBarrel,
    resetExplosiveBarrels,
    resetVehicles,
    groundHeightAt,
    syncProximityLoot,
    resetMatchLoots,
    spawnDroppedLoot,
    clearDroppedLoots,
    applyQuality,
    updateDynamicProps,
    dispose,
  };

  // Populate initial João Pessoa lists until bermuda.glb attaches (then defaults cleanly to Bermuda)
  replaceInPlace(pois, jpPois);
  replaceInPlace(vendingMachines, jpVendingMachines);
  replaceInPlace(explosiveBarrels, jpExplosiveBarrels);
  replaceInPlace(launchPads, jpLaunchPads);
  for (let i = 0; i < jpVehicles.length; i++) {
    colliders.push(jpVehicles[i].collider);
  }
  replaceInPlace(vehicles, jpVehicles);
  if (!bermudaAttached) {
    joaoPessoaGroup.visible = true;
    bermudaGroup.visible = false;
  }

  return handleRef;
}
