import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
  AttachmentKind,
  BuildingNavZone,
  DeathBoxItemEntry,
  GraphicsQuality,
  LootItem,
  MinimapBuilding,
  MinimapRoad,
  PoiMarker,
  ScopeType,
  VehicleKind,
  WalkablePlatform,
  WeaponId,
  WorldObbCollider,
} from './types';

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
  airplaneProps: THREE.Mesh[];
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
  applyQuality: (quality: GraphicsQuality, isSoftwareGl: boolean) => void;
  updateDynamicProps: (
    dt: number,
    elapsed: number,
    camPos?: THREE.Vector3,
    lootRenderDist?: number,
  ) => void;
  dispose: () => void;
}

export const BERMUDA_HALF = 660;
export const BERMUDA_MAP_RANGE = 690;
export const HAS_SENTOSA = false;
export const WAIT_SPAWN = { x: -255, z: -365 } as const;
export const SENTOSA_CENTER = { x: 400, z: 380 } as const;

export const POIS: PoiMarker[] = [
  { name: 'CLOCK TOWER', x: -110, z: -35, radius: 52 },
  { name: 'PEAK', x: 30, z: -55, radius: 54 },
  { name: 'BIMASAKTI STRIP', x: -12, z: 125, radius: 54 },
  { name: 'FACTORY', x: -135, z: 250, radius: 58 },
  { name: 'POCHINOK', x: 145, z: 255, radius: 54 },
  { name: 'CAPETOWN', x: 405, z: 65, radius: 50 },
  { name: 'KERATON', x: 255, z: 55, radius: 48 },
  { name: 'KATULISTIWA', x: -230, z: -140, radius: 50 },
  { name: 'PLANTATION', x: 145, z: -170, radius: 48 },
  { name: 'MILL', x: 370, z: -155, radius: 52 },
  { name: 'RIVERSIDE', x: 175, z: -325, radius: 46 },
  { name: 'HANGAR', x: -255, z: -365, radius: 54 },
  { name: 'NUREK DAM', x: 55, z: riverCenterZ(55), radius: 36 },
  { name: 'PONTE OESTE', x: -195, z: riverCenterZ(-195), radius: 28 },
  { name: 'PONTE LESTE', x: 295, z: riverCenterZ(295), radius: 28 },
];

export function riverCenterZ(x: number): number {
  return -270 + Math.sin(x * 0.0072) * 30;
}

export function sampleMainIslandEdgeRadius(angle: number): number {
  const baseVar =
    Math.sin(angle * 3) * 36 +
    Math.cos(angle * 5) * 22 +
    Math.sin(angle * 7 + 0.6) * 14;
  return 540 + baseVar;
}

export function sampleSentosaEdgeRadius(_relAngle: number): number {
  return 0;
}

const BRIDGE_BANKS = [
  { x: -195, z: riverCenterZ(-195), deckHalfX: 4.5, deckHalfZ: 24.0, targetH: 3.4 }, // Ponte Oeste
  { x: 55, z: riverCenterZ(55), deckHalfX: 5.2, deckHalfZ: 27.0, targetH: 5.5 }, // Nurek Dam
  { x: 295, z: riverCenterZ(295), deckHalfX: 4.5, deckHalfZ: 24.0, targetH: 3.4 }, // Ponte Leste
];

const BRIDGE_ABUTMENTS = [
  { x: -195, z: riverCenterZ(-195) - 24, r: 13, targetH: 3.25 },
  { x: -195, z: riverCenterZ(-195) + 24, r: 13, targetH: 3.25 },
  { x: 55, z: riverCenterZ(55) - 27, r: 15, targetH: 5.35 },
  { x: 55, z: riverCenterZ(55) + 27, r: 15, targetH: 5.35 },
  { x: 295, z: riverCenterZ(295) - 24, r: 13, targetH: 3.25 },
  { x: 295, z: riverCenterZ(295) + 24, r: 13, targetH: 3.25 },
];

export function nearestBridgePos(
  x: number,
  z = -270,
  _mode: 'river' | 'sentosa' = 'river',
): { x: number; z: number } {
  let best = BRIDGE_BANKS[0];
  let bestDist = Math.hypot(x - best.x, z - best.z);
  for (let i = 1; i < BRIDGE_BANKS.length; i++) {
    const d = Math.hypot(x - BRIDGE_BANKS[i].x, z - BRIDGE_BANKS[i].z);
    if (d < bestDist) {
      bestDist = d;
      best = BRIDGE_BANKS[i];
    }
  }
  return { x: best.x, z: best.z };
}

export function botSurfaceHeightAt(
  x: number,
  z: number,
): { y: number; inWater: boolean; onBridge: boolean } {
  for (let i = 0; i < BRIDGE_BANKS.length; i++) {
    const b = BRIDGE_BANKS[i];
    if (Math.abs(x - b.x) <= b.deckHalfX && Math.abs(z - b.z) <= b.deckHalfZ) {
      return { y: b.targetH + 0.14, inWater: false, onBridge: true };
    }
  }
  const h = sampleGroundHeight(x, z);
  return { y: h, inWater: h < 0.45, onBridge: false };
}

const COMPOUNDS = [
  { x: 30, z: -55, r: 46, targetH: 18.0 }, // Peak
  { x: -110, z: -35, r: 44, targetH: 5.8 }, // Clock Tower
  { x: -12, z: 125, r: 46, targetH: 5.2 }, // Bimasakti Strip
  { x: -135, z: 250, r: 48, targetH: 4.4 }, // Factory
  { x: 145, z: 255, r: 46, targetH: 4.6 }, // Pochinok
  { x: 405, z: 65, r: 42, targetH: 7.4 }, // Capetown
  { x: 255, z: 55, r: 42, targetH: 5.2 }, // Keraton
  { x: -230, z: -140, r: 44, targetH: 5.0 }, // Katulistiwa
  { x: 145, z: -170, r: 42, targetH: 5.4 }, // Plantation
  { x: 370, z: -155, r: 44, targetH: 8.6 }, // Mill
  { x: 175, z: -325, r: 40, targetH: 3.6 }, // Riverside
  { x: -255, z: -365, r: 46, targetH: 4.2 }, // Hangar / Wait Lobby
];

export function sampleGroundHeight(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  const distFromCenter = Math.hypot(x, z);
  const effectiveEdge = sampleMainIslandEdgeRadius(angle);
  const islandMask = THREE.MathUtils.smoothstep(effectiveEdge - distFromCenter, 0, 72);

  // Rolling Bermuda mountain relief & ridges
  const n1 = Math.sin(x * 0.008) * Math.cos(z * 0.0085) * 5.8;
  const n2 = Math.sin(x * 0.021 + 1.1) * Math.sin(z * 0.019 - 0.6) * 2.2;
  const wave =
    Math.sin(x * 0.036 + z * 0.028) * 0.95 +
    Math.cos(z * 0.032 - x * 0.025) * 0.75;
  const peakMassif =
    Math.exp(-((x - 30) * (x - 30) + (z + 55) * (z + 55)) / 24000) * 15.0;
  const millHill =
    Math.exp(-((x - 370) * (x - 370) + (z + 155) * (z + 155)) / 12000) * 5.4;

  let h =
    (3.5 + n1 + n2 + wave + peakMassif + millHill) * islandMask -
    (1 - islandMask) * 6.0;

  // River channel cutting East-West across Northern Bermuda
  const rz = riverCenterZ(x);
  const distRiver = Math.abs(z - rz);
  if (distRiver < 20 && distFromCenter < 530) {
    const carve = (1 - THREE.MathUtils.smoothstep(distRiver, 4.5, 20)) * 6.2;
    h -= carve;
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
      const blend = 1 - THREE.MathUtils.smoothstep(d, c.r * 0.72, c.r + 24);
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
): { group: THREE.Group; data: VendingMachineProp } {
  const group = new THREE.Group();
  const y = sampleGroundHeight(x, z);
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
): VehicleEntity {
  const isSports = kind === 'sport';
  const maxHp = isSports ? 420 : 620;
  const y = sampleGroundHeight(x, z);

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
    gloos: 2,
    grenades: 1,
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
    moveSpeed: 4.8 + (idx % 3) * 0.55,
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

    const modelId: FFModelId = i % 2 === 0 ? 'adam' : 'eva';
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
  const skyGeo = new THREE.SphereGeometry(240, 20, 14);
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cZenith = new THREE.Color(0x286bb5);
  const cMid = new THREE.Color(0x5da4e3);
  const cHorizon = new THREE.Color(0xb8dcf0);
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

  // Distant-Render Texture LOD uniform: strips detail texture past threshold while keeping geometry visible
  const texDistUniform = { value: 165.0 };
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
          float texDistFade = smoothstep(uTexMaxDist * 0.68, uTexMaxDist, length(vViewPosition));
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, uUntexturedColor, texDistFade);
          diffuseColor *= sampledDiffuseColor;
        #endif`,
      );
    };
    mat.needsUpdate = true;
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

  const roads: MinimapRoad[] = [
    // Northern Highway across Ponte Oeste -> Riverside -> Nurek Dam -> Ponte Leste -> Mill
    { x1: -255, z1: -365, x2: -195, z2: riverCenterZ(-195) - 24, width: 7.4, kind: 'asphalt' },
    { x1: -195, z1: riverCenterZ(-195) + 24, x2: -230, z2: -140, width: 7.4, kind: 'asphalt' },
    { x1: -255, z1: -365, x2: 55, z2: riverCenterZ(55) - 27, width: 7.0, kind: 'asphalt' },
    { x1: 55, z1: riverCenterZ(55) - 27, x2: 175, z2: -325, width: 7.0, kind: 'asphalt' },
    { x1: 175, z1: -325, x2: 295, z2: riverCenterZ(295) - 24, width: 7.2, kind: 'asphalt' },
    { x1: 295, z1: riverCenterZ(295) + 24, x2: 370, z2: -155, width: 7.2, kind: 'asphalt' },
    { x1: 55, z1: riverCenterZ(55) + 27, x2: 145, z2: -170, width: 7.4, kind: 'asphalt' },
    // Central Mountain & City Spine (Plantation -> Peak -> Clock Tower -> Bimasakti -> Factory/Pochinok)
    { x1: 145, z1: -170, x2: 30, z2: -55, width: 6.8, kind: 'dirt' },
    { x1: 30, z1: -55, x2: -110, z2: -35, width: 7.8, kind: 'asphalt' },
    { x1: -110, z1: -35, x2: -12, z2: 125, width: 8.2, kind: 'asphalt' },
    { x1: -12, z1: 125, x2: -135, z2: 250, width: 7.6, kind: 'asphalt' },
    { x1: -12, z1: 125, x2: 145, z2: 255, width: 7.6, kind: 'asphalt' },
    // West & South Connectors
    { x1: -230, z1: -140, x2: -110, z2: -35, width: 7.4, kind: 'asphalt' },
    { x1: -230, z1: -140, x2: -135, z2: 250, width: 6.8, kind: 'dirt' },
    { x1: -135, z1: 250, x2: 145, z2: 255, width: 7.4, kind: 'asphalt' },
    // East Ring (Mill -> Keraton -> Capetown -> Pochinok)
    { x1: 370, z1: -155, x2: 255, z2: 55, width: 7.2, kind: 'asphalt' },
    { x1: 255, z1: 55, x2: 405, z2: 65, width: 7.0, kind: 'asphalt' },
    { x1: 255, z1: 55, x2: 145, z2: 255, width: 6.8, kind: 'dirt' },
    { x1: 30, z1: -55, x2: 255, z2: 55, width: 6.6, kind: 'dirt' },
  ];

  // 1. Compacted Bermuda 1480m x 1480m Terrain Mesh (92x92 crisp relief - 2.4x faster vertex/fill!)
  const terrainGeo = new THREE.PlaneGeometry(1480, 1480, 92, 92);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cGrass = new THREE.Color(0x66783e);
  const cSand = new THREE.Color(0xc2ac79);
  const cHill = new THREE.Color(0x526334);
  const cPeak = new THREE.Color(0x6e6a56);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = sampleGroundHeight(vx, vz);
    posAttr.setY(i, vy);

    if (vy < 0.9) {
      tmpColor.copy(cSand);
    } else if (vy > 10.0) {
      tmpColor.copy(cPeak);
    } else if (vy > 5.6) {
      tmpColor.copy(cHill);
    } else {
      tmpColor.copy(cGrass);
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
    roughness: 0.94,
    metalness: 0.0,
  });
  applyDistanceTextureLod(terrainMat, [0.58, 0.64, 0.48]);
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'terrain-mesh';
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);
  obstacleMeshes.push(terrainMesh);

  // 2. Lightweight Tropical Ocean Mesh (44x44 vertices - 8x faster than before!)
  const waterGeo = new THREE.PlaneGeometry(2200, 2200, 44, 44);
  waterGeo.rotateX(-Math.PI / 2);
  const waterPos = waterGeo.attributes.position;
  const waterColors = new Float32Array(waterPos.count * 3);
  const cReefShallow = new THREE.Color(0x22d8ec);
  const cLagoon = new THREE.Color(0x1b96c9);
  const cDeepOcean = new THREE.Color(0x14496e);

  for (let i = 0; i < waterPos.count; i++) {
    const wx = waterPos.getX(i);
    const wz = waterPos.getZ(i);
    const gh = sampleGroundHeight(wx, wz);
    if (gh > -2.3) {
      const t = THREE.MathUtils.clamp((gh + 2.3) / 2.6, 0, 1);
      tmpColor.copy(cLagoon).lerp(cReefShallow, t);
    } else if (gh > -5.1) {
      const t = THREE.MathUtils.clamp((gh + 5.1) / 2.8, 0, 1);
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
    roughness: 0.25,
    metalness: 0.2,
  });
  applyDistanceTextureLod(waterMat, [0.85, 0.94, 0.98]);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = -0.35;
  water.receiveShadow = false;
  scene.add(water);

  // 3. Distant Horizon Archipelago Silhouettes (16 instances)
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x4b6875,
    roughness: 0.95,
    flatShading: false,
  });
  const mountainGeo = new THREE.SphereGeometry(95, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const mountainCount = 16;
  const mountains = new THREE.InstancedMesh(mountainGeo, mountainMat, mountainCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < mountainCount; i++) {
    const angle = (i / mountainCount) * Math.PI * 2;
    const rad = 820 + (i % 3) * 65;
    dummy.position.set(Math.cos(angle) * rad, -8, Math.sin(angle) * rad);
    dummy.rotation.y = i * 0.63;
    const sc = 0.85 + (i % 4) * 0.22;
    dummy.scale.set(sc * 1.35, sc * 0.85, sc * 1.15);
    dummy.updateMatrix();
    mountains.setMatrixAt(i, dummy.matrix);
  }
  mountains.computeBoundingSphere();
  scene.add(mountains);

  // 4. Seamless Terrain-Conforming Continuous Ribbon Roads (merged into 2 total draw calls!)
  const dirtRoadMat = new THREE.MeshStandardMaterial({
    map: textures.dirtRoad,
    roughness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  applyDistanceTextureLod(dirtRoadMat, [0.5, 0.42, 0.31]);
  const asphaltRoadMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltRoad,
    roughness: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  applyDistanceTextureLod(asphaltRoadMat, [0.3, 0.32, 0.34]);

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
      const riverDist = Math.abs(cz - riverCenterZ(cx));

      // Clip ribbon cleanly when dipping into river or strait water outside bridge decks
      if (hC < 0.2) {
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
    scene.add(mAsphalt);
    asphaltGeos.forEach((g) => g.dispose());
  }
  if (dirtGeos.length > 0) {
    const mDirt = new THREE.Mesh(mergeGeometries(dirtGeos, false), dirtRoadMat);
    mDirt.receiveShadow = true;
    scene.add(mDirt);
    dirtGeos.forEach((g) => g.dispose());
  }

  // Shared Architectural Materials (with distance texture LOD & crisp Bermudian brightness)
  const stuccoWallMat = new THREE.MeshStandardMaterial({
    map: textures.stuccoWall,
    roughness: 0.86,
  });
  applyDistanceTextureLod(stuccoWallMat, [0.88, 0.84, 0.77]);
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

  // 5. Bridges over Northern River & Sentosa Strait (5 full Bermuda crossings!)
  const ponteOesteZ = riverCenterZ(-265);
  scene.add(
    createBridge(-195, ponteOesteZ, 8.8, 48, 3.4, 0, concreteMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: -195, z: ponteOesteZ, w: 8.8, d: 48, rotY: 0, kind: 'bridge' });

  const damZ = riverCenterZ(55);
  scene.add(
    createBridge(55, damZ, 10.4, 54, 5.5, 0, concreteMat, concreteMat, colliders, platforms, obstacleMeshes),
  );
  const damWall = new THREE.Mesh(new THREE.BoxGeometry(56, 6.2, 6.0), concreteMat);
  damWall.position.set(55, 2.2, damZ);
  damWall.castShadow = false;
  damWall.receiveShadow = true;
  scene.add(damWall);
  buildings.push({ x: 55, z: damZ, w: 10.4, d: 54, rotY: 0, kind: 'bridge' });

  const ponteLesteZ = riverCenterZ(295);
  scene.add(
    createBridge(295, ponteLesteZ, 8.8, 48, 3.4, 0, woodWallMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: 295, z: ponteLesteZ, w: 8.8, d: 48, rotY: 0, kind: 'bridge' });

  // 5b. ICONIC FREE FIRE CLOCK TOWER LANDMARK at (-110, -35)
  {
    const ctX = -110;
    const ctZ = -35;
    const ctY = sampleGroundHeight(ctX, ctZ);
    const ctGroup = new THREE.Group();
    ctGroup.position.set(ctX, ctY, ctZ);

    const ctPlinth = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.4, 11.5), concreteMat);
    ctPlinth.position.y = 0.2;
    ctPlinth.receiveShadow = true;
    ctGroup.add(ctPlinth);

    const ctPillarPositions: Array<[number, number]> = [
      [-3.2, -3.2],
      [3.2, -3.2],
      [-3.2, 3.2],
      [3.2, 3.2],
    ];
    ctPillarPositions.forEach(([px, pz]) => {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5.2, 1.5), concreteMat);
      pil.position.set(px, 2.8, pz);
      pil.castShadow = true;
      pil.receiveShadow = true;
      pil.userData.cullRoot = ctGroup;
      ctGroup.add(pil);
      obstacleMeshes.push(pil);
      colliders.push({
        cx: ctX + px,
        cz: ctZ + pz,
        halfW: 0.78,
        halfD: 0.78,
        rotY: 0,
        minY: ctY,
        maxY: ctY + 5.6,
        tag: 'clocktower-pillar',
      });
    });

    const ctShaft = new THREE.Mesh(new THREE.BoxGeometry(6.2, 12.5, 6.2), stuccoWallMat);
    ctShaft.position.y = 11.4;
    ctShaft.castShadow = true;
    ctShaft.userData.cullRoot = ctGroup;
    ctGroup.add(ctShaft);
    obstacleMeshes.push(ctShaft);

    const ctRoof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 4.4, 4), roofMat);
    ctRoof.position.y = 19.8;
    ctRoof.rotation.y = Math.PI / 4;
    ctGroup.add(ctRoof);

    const faceMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
    const faceGeo = new THREE.CircleGeometry(1.45, 12);
    [
      [0, 14.5, 3.15, 0],
      [0, 14.5, -3.15, Math.PI],
      [3.15, 14.5, 0, Math.PI / 2],
      [-3.15, 14.5, 0, -Math.PI / 2],
    ].forEach(([fx, fy, fz, fry]) => {
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.set(fx, fy, fz);
      face.rotation.y = fry;
      ctGroup.add(face);
    });

    scene.add(ctGroup);
    cullableStructures.push({ obj: ctGroup, x: ctX, z: ctZ, radiusScale: 1.4 });
    buildings.push({ x: ctX, z: ctZ, w: 11.5, d: 11.5, rotY: 0, kind: 'tower' });
  }

  // 6. 30 Enterable Houses across compacted Bermuda Cities (high FPS density!)
  const houseSpecs: Array<[number, number, number, number, number, number, boolean]> = [
    // CLOCK TOWER (-110, -35)
    [-132, -52, 8.8, 7.0, 3.4, 0.05, false],
    [-88, -52, 9.0, 7.2, 3.5, -0.05, true],
    [-134, -14, 8.2, 6.8, 3.4, 1.55, false],
    [-86, -14, 8.4, 6.8, 3.4, -1.55, true],
    // PEAK (30, -55)
    [30, -34, 11.5, 8.4, 4.0, 0.0, false],
    [6, -62, 8.4, 6.8, 3.3, 1.4, true],
    [54, -60, 8.6, 6.8, 3.4, -1.5, false],
    // BIMASAKTI STRIP (-12, 125)
    [-32, 108, 8.6, 6.8, 3.4, 1.57, false],
    [8, 108, 8.6, 6.8, 3.4, -1.57, true],
    [-32, 138, 8.4, 6.8, 3.4, 1.57, true],
    [8, 138, 8.4, 6.8, 3.4, -1.57, false],
    // FACTORY (-135, 250)
    [-160, 232, 8.4, 6.6, 3.4, 0.2, false],
    [-112, 234, 8.0, 6.4, 3.3, -0.3, true],
    // POCHINOK (145, 255)
    [124, 236, 8.6, 6.8, 3.4, 0.15, false],
    [164, 238, 8.8, 7.0, 3.5, -0.2, true],
    [145, 282, 8.4, 6.6, 3.4, 3.1, true],
    // CAPETOWN (405, 65)
    [386, 46, 8.2, 6.4, 3.3, 0.3, true],
    [424, 48, 8.4, 6.6, 3.3, -0.4, false],
    [405, 88, 8.4, 6.6, 3.4, 2.9, true],
    // KERATON (255, 55)
    [234, 38, 8.6, 6.8, 3.4, 0.1, false],
    [276, 38, 8.4, 6.6, 3.4, -0.2, true],
    // KATULISTIWA (-230, -140)
    [-252, -158, 8.6, 6.8, 3.4, 0.1, false],
    [-208, -158, 8.4, 6.6, 3.4, -0.2, true],
    // PLANTATION (145, -170)
    [124, -186, 8.2, 6.4, 3.3, 0.25, true],
    [166, -186, 8.4, 6.6, 3.3, -0.25, false],
    // MILL (370, -155)
    [350, -176, 8.4, 6.6, 3.3, 0.1, false],
    [390, -172, 8.2, 6.4, 3.3, -0.4, true],
    // RIVERSIDE (175, -325)
    [154, -342, 8.2, 6.4, 3.3, 0.2, true],
    [196, -340, 8.2, 6.4, 3.3, -0.2, false],
    // HANGAR (-255, -365)
    [-280, -348, 8.4, 6.6, 3.3, 0.2, false],
  ];

  const buildingNavZones: BuildingNavZone[] = [];

  houseSpecs.forEach(([hx, hz, hw, hd, hh, hrot, isWood]) => {
    const houseRes = createEnterableHouse(
      hx,
      hz,
      hw,
      hd,
      hh,
      hrot,
      sampleGroundHeight(hx, hz),
      isWood ? woodWallMat : stuccoWallMat,
      buildingMats,
      colliders,
      platforms,
      obstacleMeshes,
    );
    scene.add(houseRes.group);
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

  // 6b. Iconic Free Fire Multi-Story Buildings ("Primeiro Andar") & Tactical Outposts
  const prefabLootPoints: BuildingLootPoint[] = [];

  // 10 Casas L (L-Shaped 2-Story House with Balcony / Sacada)
  const casaLSpecs: Array<[number, number, number]> = [
    [-156, -56, 0.3], // Clock Tower West
    [8, -86, 0.0], // Peak North-West
    [-52, 122, -1.57], // Bimasakti West
    [28, 148, 1.57], // Bimasakti East
    [-176, 252, -1.57], // Factory West
    [104, 255, -1.57], // Pochinok West
    [438, 68, 1.57], // Capetown East
    [-270, -138, -1.57], // Katulistiwa West
    [186, -168, 1.57], // Plantation East
    [-300, -372, -1.57], // Hangar West
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
    scene.add(res.group);
    cullableStructures.push({ obj: res.group, x: bx, z: bz, radiusScale: 1.25 });
    buildings.push({ x: bx, z: bz, w: 10.8, d: 10.6, rotY: brot, kind: 'casaL' });
    buildingNavZones.push(res.navZone);
    prefabLootPoints.push(...res.lootPoints);
  });

  // 8 Casas God (2-Story Tactical Stronghold with Rooftop Parapet)
  const casaGodSpecs: Array<[number, number, number]> = [
    [-110, -72, 0.0], // Clock Tower North
    [52, -84, 0.2], // Peak North
    [28, 114, 1.57], // Bimasakti East
    [-108, 272, 0.0], // Factory South-East
    [186, 254, 1.57], // Pochinok East
    [256, 20, 0.0], // Keraton North
    [334, -154, -1.57], // Mill West
    [-70, 44, -1.57], // Roadside Clock Tower <-> Bimasakti
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
    scene.add(res.group);
    cullableStructures.push({ obj: res.group, x: bx, z: bz, radiusScale: 1.22 });
    buildings.push({ x: bx, z: bz, w: 9.8, d: 9.8, rotY: brot, kind: 'casaGod' });
    buildingNavZones.push(res.navZone);
    prefabLootPoints.push(...res.lootPoints);
  });

  // 7 Celeiros (Red Wooden Barns with Mezzanine Loft)
  const celeiroSpecs: Array<[number, number, number]> = [
    [-12, -44, -1.3], // Peak West Meadow
    [176, 218, 3.14], // Pochinok North-East
    [-230, -180, 0.0], // Katulistiwa North
    [106, -170, -1.57], // Plantation West
    [370, -196, 0.0], // Mill North
    [136, -324, -1.57], // Riverside West
    [255, 92, 3.14], // Keraton South
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
    scene.add(res.group);
    cullableStructures.push({ obj: res.group, x: bx, z: bz, radiusScale: 1.3 });
    buildings.push({ x: bx, z: bz, w: 10.6, d: 14.0, rotY: brot, kind: 'celeiro' });
    buildingNavZones.push(res.navZone);
    prefabLootPoints.push(...res.lootPoints);
  });

  // 10 Sobrados (2-Story Residential Houses)
  const sobradoSpecs: Array<[number, number, number]> = [
    [-82, -70, 0.0], // Clock Tower North-East
    [-124, 14, 3.14], // Clock Tower South
    [68, -42, 1.57], // Peak East
    [-52, 152, -1.57], // Bimasakti South-West
    [145, 216, 0.0], // Pochinok North
    [368, 72, -1.57], // Capetown West
    [292, 60, 1.57], // Keraton East
    [-188, -140, 1.57], // Katulistiwa East
    [176, -362, 0.0], // Riverside North
    [76, 178, -0.4], // Central Crossroads Bimasakti <-> Pochinok
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
    scene.add(res.group);
    cullableStructures.push({ obj: res.group, x: bx, z: bz, radiusScale: 1.15 });
    buildings.push({ x: bx, z: bz, w: 8.8, d: 7.8, rotY: brot, kind: 'sobrado' });
    buildingNavZones.push(res.navZone);
    prefabLootPoints.push(...res.lootPoints);
  });

  // 12 Guaritas (4-Way Guard Posts)
  const guaritaSpecs: Array<[number, number, number]> = [
    [-102, 0, 3.14], // Clock Tower South
    [12, -28, 2.7], // Peak South-West
    [-22, 92, 0.0], // Bimasakti North
    [-134, 218, 0.0], // Factory North
    [122, 286, 2.5], // Pochinok South
    [412, 98, 3.14], // Capetown South
    [282, 88, 2.6], // Keraton South
    [-206, -110, 2.7], // Katulistiwa South
    [168, -144, 3.14], // Plantation South
    [346, -124, 2.8], // Mill South
    [-272, -402, 0.0], // Hangar North
    [42, -220, 0.0], // Nurek Dam South Guardpost
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
    scene.add(res.group);
    cullableStructures.push({ obj: res.group, x: bx, z: bz, radiusScale: 0.78 });
    buildings.push({ x: bx, z: bz, w: 3.4, d: 3.4, rotY: brot, kind: 'guarita' });
    buildingNavZones.push(res.navZone);
    prefabLootPoints.push(...res.lootPoints);
  });

  // 7. 6 Industrial Sheds & Hangars
  const shedSpecs: Array<[number, number, number, number, number, number]> = [
    [-135, 250, 13.0, 18.0, 5.0, 0.0], // Factory Main Hangar
    [-156, 250, 10.2, 14.0, 4.5, 0.0], // Factory Wing 2
    [364, -142, 11.0, 15.5, 4.6, 0.0], // Mill Hangar 1
    [384, -164, 10.4, 14.5, 4.5, 1.57], // Mill Hangar 2
    [-258, -346, 11.0, 15.5, 4.6, 0.0], // Hangar Main
    [-230, -140, 10.2, 13.5, 4.4, 1.57], // Katulistiwa Depot
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
    scene.add(shedObj);
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

  // Concrete Airstrip Runway at Hangar (-255, -365)
  const runwayY = sampleGroundHeight(-255, -372);
  const runway = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.16, 56),
    concreteMat,
  );
  runway.position.set(-255, runwayY + 0.04, -375);
  runway.receiveShadow = true;
  scene.add(runway);
  platforms.push({
    cx: -255,
    cz: -375,
    halfW: 5.5,
    halfD: 28,
    rotY: 0,
    topY: runwayY + 0.12,
    minY: runwayY - 1,
  });

  // 8. 8 Shipping Containers across Factory / Mill / Hangar
  const containerSpecs: Array<[number, number, number, boolean, number]> = [
    [-126, 258, 0.2, true, 0],
    [-144, 236, 1.57, false, 0],
    [-135, 258, 0.2, false, 2.6],
    [358, -160, 0.4, true, 0],
    [376, -178, 1.57, false, 0],
    [-244, -360, 0.0, true, 0],
    [-266, -368, 0.1, false, 0],
    [138, 258, 0.3, true, 0],
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
    scene.add(cObj);
    cullableStructures.push({ obj: cObj, x: cx, z: cz, radiusScale: 0.85 });
    buildings.push({ x: cx, z: cz, w: 2.6, d: 6.2, rotY: crot, kind: 'container' });
  });

  // 9. 4 Watchtowers
  const wtCoords: Array<[number, number]> = [
    [18, -50], // Peak
    [408, 72], // Capetown
    [-144, 266], // Factory
    [-240, -356], // Hangar
  ];
  wtCoords.forEach(([wx, wz]) => {
    const wt = createWatchTowerLOD(wx, wz, concreteMat, steelMat, colliders, obstacleMeshes);
    scene.add(wt);
    cullableStructures.push({ obj: wt, x: wx, z: wz, radiusScale: 1.25 });
    buildings.push({ x: wx, z: wz, w: 7.2, d: 7.2, rotY: 0, kind: 'tower' });
  });

  // 10. 8 Vending Machines (Lojinhas)
  const vendingSpecs: Array<{ id: string; x: number; z: number; rotY: number; label: string }> = [
    { id: 'vm_clock', x: -96, z: -32, rotY: -1.57, label: 'Lojinha Clock Tower' },
    { id: 'vm_peak', x: 22, z: -52, rotY: 0.4, label: 'Lojinha Peak' },
    { id: 'vm_bima', x: -22, z: 122, rotY: 1.57, label: 'Lojinha Bimasakti' },
    { id: 'vm_factory', x: -124, z: 244, rotY: -0.8, label: 'Lojinha Factory' },
    { id: 'vm_mill', x: 362, z: -158, rotY: 0.2, label: 'Lojinha Mill' },
    { id: 'vm_pochinok', x: 138, z: 248, rotY: 0.6, label: 'Lojinha Pochinok' },
    { id: 'vm_katu', x: -222, z: -136, rotY: -1.1, label: 'Lojinha Katulistiwa' },
    { id: 'vm_cape', x: 396, z: 62, rotY: 1.2, label: 'Lojinha Capetown' },
  ];
  const vendingMachines: VendingMachineProp[] = vendingSpecs.map((vs) => {
    const vm = createVendingMachineProp(
      vs.id,
      vs.x,
      vs.z,
      vs.rotY,
      vs.label,
      colliders,
      obstacleMeshes,
    );
    scene.add(vm.group);
    cullableStructures.push({ obj: vm.group, x: vs.x, z: vs.z, radiusScale: 0.7 });
    return vm.data;
  });

  // 11. Concrete Barriers, Wooden Crates, Explosive Red Barrels & Launch Pads
  const barrierCoords: Array<[number, number, number]> = [
    [-118, -35, 0],
    [-100, -35, 0],
    [55, damZ + 10, 0.3],
    [55, damZ - 10, -0.25],
    [-12, 118, 0.2],
    [30, -48, 0.4],
    [364, -150, 0.2],
    [-230, -140, 0.9],
    [-135, 242, 0.0],
    [142, 250, -0.3],
    [398, 60, 0.2],
    [-250, -358, 0.1],
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
  scene.add(barrierInst);
  obstacleMeshes.push(barrierInst);

  const crateCoords: Array<[number, number, number]> = [
    [-248, -356, 0.2],
    [-102, -30, 0.1],
    [-118, -40, 0.5],
    [366, -148, 0.4],
    [148, 258, -0.4],
    [-222, -134, 0.4],
    [25, -52, 0.5],
    [-130, 244, 0.2],
    [-16, 122, -0.3],
    [252, 52, -0.2],
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
      cz: cz,
      halfW: 0.72,
      halfD: 0.72,
      rotY: rot,
      minY: cy,
      maxY: cy + 1.45,
      tag: 'crate',
    });
  });
  crateInst.computeBoundingSphere();
  scene.add(crateInst);
  obstacleMeshes.push(crateInst);

  const barrelCoords: Array<[number, number]> = [
    [-104, -34],
    [-120, -38],
    [34, -50],
    [-18, 120],
    [-4, 130],
    [-128, 254],
    [-142, 242],
    [362, -146],
    [378, -158],
    [138, 248],
    [-224, -138],
    [398, 62],
    [-250, -360],
    [57, damZ + 8],
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

  const explosiveBarrels: ExplosiveBarrel[] = [];
  const barrelColliders: WorldObbCollider[] = [];
  barrelCoords.forEach(([bx, bz], idx) => {
    const by = sampleGroundHeight(bx, bz);
    dummy.position.set(bx, by + 0.625, bz);
    dummy.rotation.set(0, idx * 0.5, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    barrelInst.setMatrixAt(idx, dummy.matrix);
    explosiveBarrels.push({
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
  scene.add(barrelInst);
  obstacleMeshes.push(barrelInst);

  const hideExplosiveBarrel = (idx: number) => {
    const eb = explosiveBarrels[idx];
    if (!eb || eb.exploded) return;
    eb.exploded = true;
    dummy.position.set(eb.x, -50, eb.z);
    dummy.scale.set(0.001, 0.001, 0.001);
    dummy.updateMatrix();
    barrelInst.setMatrixAt(idx, dummy.matrix);
    barrelInst.instanceMatrix.needsUpdate = true;
    const col = barrelColliders[idx];
    if (col) {
      col.minY = -99;
      col.maxY = -98;
    }
  };
  const resetExplosiveBarrels = () => {
    for (let i = 0; i < explosiveBarrels.length; i++) {
      const eb = explosiveBarrels[i];
      eb.exploded = false;
      dummy.position.set(eb.x, eb.y, eb.z);
      dummy.rotation.set(0, i * 0.5, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      barrelInst.setMatrixAt(i, dummy.matrix);
      const col = barrelColliders[i];
      if (col) {
        col.minY = eb.y - 0.625;
        col.maxY = eb.y + 0.655;
      }
    }
    barrelInst.instanceMatrix.needsUpdate = true;
  };

  // 6 Classic Free Fire Launch Pads ("Lançadores")
  const launchPadSpecs: Array<[number, number, number, number, string]> = [
    [-95, -35, 30, -55, 'LANÇADOR -> PEAK'],
    [14, -55, -110, -35, 'LANÇADOR -> CLOCK TOWER'],
    [-128, 236, -12, 125, 'LANÇADOR -> BIMASAKTI'],
    [4, 128, 145, 255, 'LANÇADOR -> POCHINOK'],
    [356, -155, 255, 55, 'LANÇADOR -> KERATON'],
    [-238, -355, -230, -140, 'LANÇADOR -> KATULISTIWA'],
  ];
  const launchPads: LaunchPadProp[] = [];
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
    scene.add(padG);
    cullableStructures.push({ obj: padG, x: lx, z: lz, radiusScale: 0.7 });
    launchPads.push({
      x: lx,
      y: ly,
      z: lz,
      dirX: dx / horiz,
      dirY: 0.72,
      dirZ: dz / horiz,
      label,
    });
  });

  // 12. Instanced World Cover Props, Roadside Assets & Bermudian Trees (low draw-call density!)
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

  const isClearOfPoiAndRoads = (x: number, z: number, roadMinDist = 11): boolean => {
    const tooClosePoi = POIS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius * 0.72);
    if (tooClosePoi) return false;
    if (Math.abs(z - riverCenterZ(x)) < 24) return false;
    if (distToRoadSq(x, z) < roadMinDist * roadMinDist) return false;
    return true;
  };

  // 12a. Low Tactical Muretas (Compound/Roadside Cover Walls - 1 draw call)
  const muretaList: Array<[number, number, number, number]> = [];
  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    const dx = r.x2 - r.x1;
    const dz = r.z2 - r.z1;
    const len = Math.hypot(dx, dz);
    if (len < 30) continue;
    const ang = Math.atan2(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    const countOnRoad = Math.min(3, Math.floor(len / 75));
    for (let k = 1; k <= countOnRoad; k++) {
      const t = k / (countOnRoad + 1);
      const side = (i + k) % 2 === 0 ? 1 : -1;
      const offset = r.width * 0.5 + 4.8;
      const mx = r.x1 + dx * t + nx * side * offset;
      const mz = r.z1 + dz * t + nz * side * offset;
      const my = sampleGroundHeight(mx, mz);
      if (my < 1.0 || Math.abs(mz - riverCenterZ(mx)) < 24) continue;
      muretaList.push([mx, my, mz, ang + Math.PI * 0.5]);
    }
  }
  const muretaGeo = new THREE.BoxGeometry(3.0, 1.15, 0.36);
  const muretaInst = new THREE.InstancedMesh(muretaGeo, brickWallMat, Math.max(1, muretaList.length));
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
  muretaInst.count = muretaList.length;
  muretaInst.computeBoundingSphere();
  if (muretaList.length > 0) {
    scene.add(muretaInst);
    obstacleMeshes.push(muretaInst);
  }

  // 12b. Roadside Tire Stacks & Military Supply Crates
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.88, metalness: 0.1 });
  const tireGeo = new THREE.CylinderGeometry(0.46, 0.5, 0.98, 8);
  const tireList: Array<[number, number, number]> = [];
  const milCrateGeo = new THREE.BoxGeometry(1.65, 1.05, 1.15);
  const milCrateMat = new THREE.MeshStandardMaterial({ color: 0x4b5836, roughness: 0.82, metalness: 0.12 });
  const milCrateList: Array<[number, number, number, number]> = [];

  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    const dx = r.x2 - r.x1;
    const dz = r.z2 - r.z1;
    const len = Math.hypot(dx, dz);
    if (len < 42) continue;
    const nx = -dz / len;
    const nz = dx / len;
    const steps = Math.min(2, Math.floor(len / 95));
    for (let k = 1; k <= steps; k++) {
      const t = (k + 0.35) / (steps + 1);
      const side = (i + k) % 2 === 0 ? -1 : 1;
      const px = r.x1 + dx * t + nx * side * (r.width * 0.5 + 3.6);
      const pz = r.z1 + dz * t + nz * side * (r.width * 0.5 + 3.6);
      const py = sampleGroundHeight(px, pz);
      if (py < 1.0 || Math.abs(pz - riverCenterZ(px)) < 24) continue;
      if ((i + k) % 2 === 0) {
        tireList.push([px, py, pz]);
      } else {
        milCrateList.push([px, py, pz, Math.atan2(dx, dz)]);
      }
    }
  }
  if (tireList.length > 0) {
    const tireInst = new THREE.InstancedMesh(tireGeo, tireMat, tireList.length);
    tireInst.castShadow = false;
    tireInst.receiveShadow = true;
    tireList.forEach(([tx, ty, tz], idx) => {
      dummy.position.set(tx, ty + 0.48, tz);
      dummy.rotation.set(0, idx * 0.6, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tireInst.setMatrixAt(idx, dummy.matrix);
      colliders.push({
        cx: tx,
        cz: tz,
        halfW: 0.52,
        halfD: 0.52,
        rotY: 0,
        minY: ty,
        maxY: ty + 1.0,
        tag: 'tire-stack',
      });
    });
    tireInst.computeBoundingSphere();
    scene.add(tireInst);
    obstacleMeshes.push(tireInst);
  }
  if (milCrateList.length > 0) {
    const milInst = new THREE.InstancedMesh(milCrateGeo, milCrateMat, milCrateList.length);
    milInst.castShadow = false;
    milInst.receiveShadow = true;
    milCrateList.forEach(([cx, cy, cz, rot], idx) => {
      dummy.position.set(cx, cy + 0.52, cz);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      milInst.setMatrixAt(idx, dummy.matrix);
      colliders.push({
        cx,
        cz,
        halfW: 0.85,
        halfD: 0.6,
        rotY: rot,
        minY: cy,
        maxY: cy + 1.1,
        tag: 'mil-crate',
      });
    });
    milInst.computeBoundingSphere();
    scene.add(milInst);
    obstacleMeshes.push(milInst);
  }

  // 12c. Roadside Utility Power Poles
  const poleTrunk = new THREE.CylinderGeometry(0.13, 0.19, 6.4, 5);
  poleTrunk.translate(0, 3.2, 0);
  const poleArm = new THREE.BoxGeometry(1.5, 0.14, 0.14);
  poleArm.translate(0, 5.9, 0);
  const poleGeo = mergeGeometries([poleTrunk, poleArm], false);
  poleTrunk.dispose();
  poleArm.dispose();
  const poleList: Array<[number, number, number, number]> = [];
  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    if (r.kind !== 'asphalt') continue;
    const dx = r.x2 - r.x1;
    const dz = r.z2 - r.z1;
    const len = Math.hypot(dx, dz);
    if (len < 60) continue;
    const ang = Math.atan2(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    const count = Math.min(2, Math.floor(len / 85));
    for (let k = 1; k <= count; k++) {
      const t = k / (count + 1);
      const px = r.x1 + dx * t + nx * (r.width * 0.5 + 2.4);
      const pz = r.z1 + dz * t + nz * (r.width * 0.5 + 2.4);
      const py = sampleGroundHeight(px, pz);
      if (py < 1.1 || Math.abs(pz - riverCenterZ(px)) < 24) continue;
      poleList.push([px, py, pz, ang]);
    }
  }
  if (poleGeo && poleList.length > 0) {
    const poleInst = new THREE.InstancedMesh(poleGeo, woodWallMat, poleList.length);
    poleInst.castShadow = false;
    poleInst.receiveShadow = false;
    poleList.forEach(([px, py, pz, rot], idx) => {
      dummy.position.set(px, py, pz);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(idx, dummy.matrix);
      colliders.push({
        cx: px,
        cz: pz,
        halfW: 0.24,
        halfD: 0.24,
        rotY: 0,
        minY: py,
        maxY: py + 6.4,
        tag: 'pole',
      });
    });
    poleInst.computeBoundingSphere();
    scene.add(poleInst);
    obstacleMeshes.push(poleInst);
  }

  // Trees, rocks & bushes intentionally removed for ultra-high mobile FPS (Redmi Note 11)

  // Capture staticColliderCount BEFORE dynamic vehicles & runtime gloo walls!
  const staticColliderCount = colliders.length;

  // Build 2D Spatial Hash Grid (32m x 32m cells covering -1024..+1024) for fast O(1) collision & platform queries
  const GRID_HALF_SPAN = 1024;
  const GRID_CELL_SIZE = 32;
  const GRID_DIM = 64;
  const colliderBuckets: number[][] = Array.from({ length: GRID_DIM * GRID_DIM }, () => []);
  const platformBuckets: number[][] = Array.from({ length: GRID_DIM * GRID_DIM }, () => []);
  const colStamp = new Uint32Array(Math.max(1, staticColliderCount));
  const platStamp = new Uint32Array(Math.max(1, platforms.length));
  let colQuerySeq = 1;
  let platQuerySeq = 1;

  for (let i = 0; i < staticColliderCount; i++) {
    const c = colliders[i];
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

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
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
            out.push(colliders[idx]);
          }
        }
      }
    }
  };

  const navBuckets: number[][] = Array.from({ length: GRID_DIM * GRID_DIM }, () => []);
  for (let i = 0; i < buildingNavZones.length; i++) {
    const nz = buildingNavZones[i];
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
    const gx = THREE.MathUtils.clamp(Math.floor((x + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const gz = THREE.MathUtils.clamp(Math.floor((z + GRID_HALF_SPAN) / GRID_CELL_SIZE), 0, GRID_DIM - 1);
    const bucket = navBuckets[gz * GRID_DIM + gx];
    for (let b = 0; b < bucket.length; b++) {
      const nz = buildingNavZones[bucket[b]];
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
        out.push(platforms[idx]);
      }
    }
  };

  // Spawn 8 Drivable Vehicles across key cities
  const vehicleSpecs: Array<{ id: string; kind: VehicleKind; x: number; z: number; rotY: number }> = [
    { id: 'veh_0', kind: 'jeep', x: 140, z: 244, rotY: -0.85 },
    { id: 'veh_1', kind: 'jeep', x: -102, z: -26, rotY: 0.55 },
    { id: 'veh_2', kind: 'sport', x: -12, z: 108, rotY: 0.05 },
    { id: 'veh_3', kind: 'jeep', x: 358, z: -148, rotY: -1.2 },
    { id: 'veh_4', kind: 'sport', x: -246, z: -356, rotY: 0.35 },
    { id: 'veh_5', kind: 'jeep', x: -224, z: -136, rotY: 1.1 },
    { id: 'veh_6', kind: 'sport', x: 396, z: 62, rotY: -1.5 },
    { id: 'veh_7', kind: 'jeep', x: 140, z: -165, rotY: 2.1 },
  ];
  const vehicles: VehicleEntity[] = vehicleSpecs.map((spec) => {
    const v = createDrivableVehicle(
      spec.id,
      spec.kind,
      spec.x,
      spec.z,
      spec.rotY,
      colliders,
      obstacleMeshes,
    );
    scene.add(v.group);
    return v;
  });

  // 13. 30 Real Parachuting, Looting & Tactical Combat AI Bots (high FPS for mobile!)
  const BOT_NICKS = [
    'LuanPro_17', 'xX_Braga_Xx', 'Gabriel_07', 'YuriRush', 'CAPA_MESTRE',
    'Pedro_BR', 'BielCapa', 'Kauan_FF', 'Matheus_RJ', 'Davi_Gelo',
    'ViniTop1', 'LucasSniper', 'Arthur_X1', 'Marcos_99', 'HenriqueBR',
    'Rafael2017', 'Thiago_Pro', 'Caua_Rush', 'Enzo_Capa', 'FelipeZika',
    'GustavoBR', 'BrunoSertao', 'Diego_17', 'Natan_FF', 'Igor_Top10',
    'Samu_Sniper', 'Ruan_Mestre', 'Caio_Lenda', 'JoaoVitorBR', 'Léo_Bermuda',
  ];

  const landPois = POIS.filter(
    (p) => !p.name.startsWith('PONTE') && !p.name.startsWith('NUREK'),
  );
  const targets: TargetDummy[] = BOT_NICKS.map((nick, idx) => {
    const poi = landPois[idx % landPois.length];
    const ang = (idx * 2.399) % (Math.PI * 2);
    const dist = 12 + ((idx * 11) % 46);
    let lx = poi.x + Math.cos(ang) * dist;
    let lz = poi.z + Math.sin(ang) * dist;
    if (sampleGroundHeight(lx, lz) < 0.75) {
      lx = poi.x;
      lz = poi.z;
    }
    const waitX = WAIT_SPAWN.x + Math.cos(idx * 0.7) * (8 + (idx % 5) * 3.5);
    const waitZ = WAIT_SPAWN.z + Math.sin(idx * 0.7) * (8 + (idx % 5) * 3.5);
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
  const pendingLootDefs = lootDefs.map((ld, idx) => ({
    ...ld,
    id: `loot_${idx}`,
    spawned: false,
  }));

  const syncProximityLoot = (px: number, pz: number, radius = 56, maxPerTick = 24) => {
    const rSq = radius * radius;
    let spawnedThisTick = 0;
    for (let i = 0; i < pendingLootDefs.length; i++) {
      const entry = pendingLootDefs[i];
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
    for (let i = 0; i < pendingLootDefs.length; i++) {
      pendingLootDefs[i].spawned = false;
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
  const { group: airplaneGroup, props: airplaneProps } = createAirplane();
  airplaneGroup.visible = false;
  scene.add(airplaneGroup);

  // Freeze static terrain, buildings, props, roads & foliage matrices to prevent wasted CPU traversal
  const dynamicRoots = new Set<THREE.Object3D>([
    airplaneGroup,
    cloudGroup,
    safeZoneMesh,
    sunLight,
    sunLight.target,
    camera,
    ...targets.map((t) => t.group),
    ...loots.map((l) => l.mesh),
    ...vehicles.map((v) => v.group),
  ]);
  for (let i = 0; i < scene.children.length; i++) {
    const ch = scene.children[i];
    if (dynamicRoots.has(ch)) continue;
    ch.traverse((node) => {
      node.updateMatrix();
      node.matrixAutoUpdate = false;
    });
  }

  let structureCullDist = 250;

  const applyQuality = (quality: GraphicsQuality, isSoftwareGl: boolean) => {
    if (quality === 'low' || isSoftwareGl) {
      // SUAVE: máximo FPS no celular (sem IBL shader overhead, névoa próxima, distância enxuta)
      texDistUniform.value = 72.0;
      fog.near = 135;
      fog.far = 365;
      structureCullDist = 175;
      sunLight.castShadow = false;
      sunLight.intensity = 1.95;
      hemi.intensity = 1.65;
      waterMat.roughness = 0.72;
      waterMat.metalness = 0.02;
      scene.environment = null;
      scene.environmentIntensity = 0;
    } else if (quality === 'medium') {
      // PADRÃO: equilibrado, boa visão à distância sem peso de sombras
      texDistUniform.value = 125.0;
      fog.near = 220;
      fog.far = 540;
      structureCullDist = 260;
      sunLight.castShadow = false;
      sunLight.intensity = 1.9;
      hemi.intensity = 1.38;
      waterMat.roughness = 0.35;
      waterMat.metalness = 0.16;
      scene.environment = envMap;
      scene.environmentIntensity = 0.52;
    } else {
      // ULTRA: visão máxima com sombras suaves PCF e IBL completo
      texDistUniform.value = 210.0;
      fog.near = 350;
      fog.far = 820;
      structureCullDist = 400;
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.intensity = 2.05;
      hemi.intensity = 1.28;
      waterMat.roughness = 0.18;
      waterMat.metalness = 0.32;
      scene.environment = envMap;
      scene.environmentIntensity = 0.9;
    }
    if (sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null;
    }
  };

  const updateDynamicProps = (
    dt: number,
    elapsed: number,
    camPos?: THREE.Vector3,
    lootRenderDist = 28,
  ) => {
    cloudGroup.rotation.y = elapsed * 0.0025;

    const cx = camPos ? camPos.x : 0;
    const cz = camPos ? camPos.z : 0;
    const cy = camPos ? camPos.y : 0;
    skyDome.position.set(cx, 0, cz);
    const renderMaxSq = lootRenderDist * lootRenderDist;
    const animMaxSq = 16 * 16;

    // Distance-cull distant structures & vehicles when on the ground (keep visible in airplane/skydive)
    if (camPos) {
      const keepAllStructures = cy > 45;
      for (let i = 0; i < cullableStructures.length; i++) {
        const s = cullableStructures[i];
        if (keepAllStructures) {
          if (!s.obj.visible) s.obj.visible = true;
        } else {
          const maxR = structureCullDist * s.radiusScale;
          const dx = s.x - cx;
          const dz = s.z - cz;
          const vis =
            Math.abs(dx) <= maxR &&
            Math.abs(dz) <= maxR &&
            dx * dx + dz * dz <= maxR * maxR;
          if (s.obj.visible !== vis) {
            s.obj.visible = vis;
          }
        }
      }

      const vehCullR = structureCullDist + 45;
      const vehCullSq = vehCullR * vehCullR;
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        if (keepAllStructures || v.driverIsPlayer) {
          if (!v.group.visible) v.group.visible = true;
        } else {
          const dx = v.x - cx;
          const dz = v.z - cz;
          const vis =
            Math.abs(dx) <= vehCullR &&
            Math.abs(dz) <= vehCullR &&
            dx * dx + dz * dz <= vehCullSq;
          if (v.group.visible !== vis) {
            v.group.visible = vis;
          }
        }
      }
    }

    for (let i = 0; i < loots.length; i++) {
      const l = loots[i];
      if (l.data.collected) continue;
      if (camPos) {
        const dx = l.data.x - cx;
        const dz = l.data.z - cz;
        if (Math.abs(dx) > lootRenderDist || Math.abs(dz) > lootRenderDist) {
          if (l.mesh.visible) l.mesh.visible = false;
          continue;
        }
        const dSq = dx * dx + dz * dz;
        const vis = dSq <= renderMaxSq;
        if (l.mesh.visible !== vis) {
          l.mesh.visible = vis;
        }
        if (!vis || dSq > animMaxSq) continue;
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
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    });
  };

  const resetVehicles = () => {
    vehicles.forEach((v) => {
      const sy = sampleGroundHeight(v.spawnX, v.spawnZ);
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

  return {
    scene,
    camera,
    sunLight,
    airplaneGroup,
    airplaneProps,
    safeZoneMesh,
    colliders,
    staticColliderCount,
    platforms,
    buildingNavZones,
    obstacleMeshes,
    buildings,
    roads,
    pois: POIS,
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
    groundHeightAt: sampleGroundHeight,
    syncProximityLoot,
    resetMatchLoots,
    spawnDroppedLoot,
    clearDroppedLoots,
    applyQuality,
    updateDynamicProps,
    dispose,
  };
}
