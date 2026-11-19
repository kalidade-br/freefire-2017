import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  cloneAdamScene,
  getAdamData,
  getAdamOutfitTexture,
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
import {
  createBackpackGeometryGroup,
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
  group: THREE.Group;
  visualRoot?: THREE.Group;
  mixer?: THREE.AnimationMixer;
  actions?: Record<string, THREE.AnimationAction>;
  activeClipName?: string;
  animAccum?: number;
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

export const BERMUDA_HALF = 900;
export const BERMUDA_MAP_RANGE = 940;
export const SENTOSA_CENTER = { x: 555, z: 515 } as const;

export const POIS: PoiMarker[] = [
  { name: 'CLOCK TOWER', x: -145, z: -45, radius: 66 },
  { name: 'PEAK', x: 35, z: -75, radius: 68 },
  { name: 'BIMASAKTI STRIP', x: -15, z: 165, radius: 68 },
  { name: 'FACTORY', x: -165, z: 325, radius: 72 },
  { name: 'POCHINOK', x: 195, z: 335, radius: 68 },
  { name: 'MARS ELECTRIC', x: -345, z: 485, radius: 68 },
  { name: 'SENTOSA', x: 555, z: 515, radius: 84 },
  { name: 'CAPETOWN', x: 545, z: 85, radius: 62 },
  { name: 'KERATON', x: 345, z: 70, radius: 60 },
  { name: 'KATULISTIWA', x: -295, z: -185, radius: 62 },
  { name: 'PLANTATION', x: 185, z: -225, radius: 58 },
  { name: 'MILL', x: 495, z: -210, radius: 64 },
  { name: 'RIVERSIDE', x: 225, z: -430, radius: 56 },
  { name: 'SHIPYARD', x: 265, z: -565, radius: 68 },
  { name: 'HANGAR', x: -345, z: -495, radius: 66 },
  { name: 'GRAVEYARD', x: -515, z: -235, radius: 62 },
  { name: 'BULLSEYE', x: -455, z: -505, radius: 56 },
  { name: 'OBSERVATÓRIO', x: -575, z: 35, radius: 56 },
  { name: 'RIM NAM VILA', x: -535, z: 295, radius: 62 },
  { name: 'NUREK DAM', x: 75, z: -358, radius: 42 },
  { name: 'PONTE OESTE', x: -265, z: -416.7, radius: 32 },
  { name: 'PONTE LESTE', x: 395, z: -340.4, radius: 32 },
  { name: 'PONTE SENTOSA NORTE', x: 555, z: 325, radius: 40 },
  { name: 'PONTE SENTOSA OESTE', x: 380, z: 515, radius: 40 },
];

export function riverCenterZ(x: number): number {
  return -375 + Math.sin(x * 0.0055) * 42;
}

export function sampleMainIslandEdgeRadius(angle: number): number {
  const baseVar =
    Math.sin(angle * 3) * 55 +
    Math.cos(angle * 5) * 34 +
    Math.sin(angle * 7 + 0.6) * 20;
  let diff = angle - 0.748;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const bayCarve = Math.exp(-(diff * diff) / 0.145) * 245;
  return 755 + baseVar - bayCarve;
}

export function sampleSentosaEdgeRadius(relAngle: number): number {
  return (
    154 +
    Math.sin(relAngle * 3) * 14 +
    Math.cos(relAngle * 4 + 0.8) * 9
  );
}

const BRIDGE_BANKS = [
  { x: -265, z: riverCenterZ(-265), deckHalfX: 4.5, deckHalfZ: 25.0, targetH: 3.4 }, // Ponte Oeste
  { x: 75, z: riverCenterZ(75), deckHalfX: 5.2, deckHalfZ: 29.0, targetH: 5.5 }, // Nurek Dam
  { x: 395, z: riverCenterZ(395), deckHalfX: 4.5, deckHalfZ: 25.0, targetH: 3.4 }, // Ponte Leste
  { x: 555, z: 325, deckHalfX: 4.8, deckHalfZ: 64.0, targetH: 3.4 }, // Ponte Sentosa Norte
  { x: 380, z: 515, deckHalfX: 68.0, deckHalfZ: 4.8, targetH: 3.4 }, // Ponte Sentosa Oeste
];

const BRIDGE_ABUTMENTS = [
  // North river bridge ends
  { x: -265, z: riverCenterZ(-265) - 25, r: 14, targetH: 3.25 },
  { x: -265, z: riverCenterZ(-265) + 25, r: 14, targetH: 3.25 },
  { x: 75, z: riverCenterZ(75) - 29, r: 16, targetH: 5.35 },
  { x: 75, z: riverCenterZ(75) + 29, r: 16, targetH: 5.35 },
  { x: 395, z: riverCenterZ(395) - 25, r: 14, targetH: 3.25 },
  { x: 395, z: riverCenterZ(395) + 25, r: 14, targetH: 3.25 },
  // Sentosa bridge ends
  { x: 555, z: 261, r: 15, targetH: 3.25 },
  { x: 555, z: 389, r: 15, targetH: 3.25 },
  { x: 312, z: 515, r: 15, targetH: 3.25 },
  { x: 448, z: 515, r: 15, targetH: 3.25 },
];

export function nearestBridgePos(
  x: number,
  z = -375,
  mode: 'river' | 'sentosa' = 'river',
): { x: number; z: number } {
  const start = mode === 'sentosa' ? 3 : 0;
  const end = mode === 'sentosa' ? 5 : 3;
  let best = BRIDGE_BANKS[start];
  let bestDist = Math.hypot(x - best.x, z - best.z);
  for (let i = start + 1; i < end; i++) {
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
  { x: 35, z: -75, r: 58, targetH: 20.5 }, // Peak (prominent central mountain)
  { x: -145, z: -45, r: 52, targetH: 6.2 }, // Clock Tower
  { x: -15, z: 165, r: 54, targetH: 5.4 }, // Bimasakti Strip
  { x: -165, z: 325, r: 58, targetH: 4.5 }, // Factory
  { x: 195, z: 335, r: 54, targetH: 4.8 }, // Pochinok
  { x: -345, z: 485, r: 54, targetH: 4.2 }, // Mars Electric
  { x: 555, z: 515, r: 68, targetH: 4.8 }, // Sentosa Island
  { x: 545, z: 85, r: 46, targetH: 8.6 }, // Capetown
  { x: 345, z: 70, r: 46, targetH: 5.5 }, // Keraton
  { x: -295, z: -185, r: 48, targetH: 5.2 }, // Katulistiwa
  { x: 185, z: -225, r: 46, targetH: 5.6 }, // Plantation
  { x: 495, z: -210, r: 50, targetH: 9.8 }, // Mill
  { x: 225, z: -430, r: 44, targetH: 3.6 }, // Riverside
  { x: 265, z: -565, r: 54, targetH: 2.6 }, // Shipyard
  { x: -345, z: -495, r: 54, targetH: 4.2 }, // Hangar / Wait Lobby
  { x: -515, z: -235, r: 48, targetH: 5.4 }, // Graveyard
  { x: -455, z: -505, r: 46, targetH: 5.8 }, // Bullseye
  { x: -575, z: 35, r: 44, targetH: 15.2 }, // Observatório
  { x: -535, z: 295, r: 48, targetH: 3.2 }, // Rim Nam Vila
];

export function sampleGroundHeight(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  const distFromCenter = Math.hypot(x, z);
  const effectiveEdge = sampleMainIslandEdgeRadius(angle);
  const mainMask = THREE.MathUtils.smoothstep(effectiveEdge - distFromCenter, 0, 82);

  // Sentosa offshore island mask (SE across the turquoise strait)
  const sdx = x - SENTOSA_CENTER.x;
  const sdz = z - SENTOSA_CENTER.z;
  const sentosaDist = Math.hypot(sdx, sdz);
  const sentosaEdge = sampleSentosaEdgeRadius(Math.atan2(sdz, sdx));
  const sentosaMask = THREE.MathUtils.smoothstep(sentosaEdge - sentosaDist, 0, 44);

  const islandMask = Math.max(mainMask, sentosaMask);

  // Rolling Bermuda mountain relief & ridges
  const n1 = Math.sin(x * 0.0062) * Math.cos(z * 0.0068) * 6.8;
  const n2 = Math.sin(x * 0.017 + 1.1) * Math.sin(z * 0.015 - 0.6) * 2.6;
  const wave =
    Math.sin(x * 0.032 + z * 0.024) * 1.15 +
    Math.cos(z * 0.028 - x * 0.021) * 0.85;
  const peakMassif =
    Math.exp(-((x - 35) * (x - 35) + (z + 75) * (z + 75)) / 36000) * 17.5;
  const obsRidge =
    Math.exp(-((x + 560) * (x + 560) + (z - 35) * (z - 35)) / 18000) * 12.0;
  const millHill =
    Math.exp(-((x - 495) * (x - 495) + (z + 210) * (z + 210)) / 15000) * 6.5;

  let h =
    (3.6 + n1 + n2 + wave + peakMassif + obsRidge + millHill) * islandMask -
    (1 - islandMask) * 6.2;

  // River channel cutting East-West across Northern Bermuda (under Ponte Oeste, Nurek Dam, Ponte Leste)
  const rz = riverCenterZ(x);
  const distRiver = Math.abs(z - rz);
  if (distRiver < 22 && distFromCenter < 740) {
    const carve = (1 - THREE.MathUtils.smoothstep(distRiver, 4.5, 22)) * 6.4;
    h -= carve;
  }

  // Smooth bridge abutment ramps so roads meet every bridge deck flush
  for (let i = 0; i < BRIDGE_ABUTMENTS.length; i++) {
    const ab = BRIDGE_ABUTMENTS[i];
    const d = Math.hypot(x - ab.x, z - ab.z);
    if (d < ab.r + 14) {
      const blend = 1 - THREE.MathUtils.smoothstep(d, ab.r * 0.45, ab.r + 14);
      h = THREE.MathUtils.lerp(h, ab.targetH, blend);
    }
  }

  // Flatten POI plateaus so all 20 cities sit cleanly on terrain
  for (let i = 0; i < COMPOUNDS.length; i++) {
    const c = COMPOUNDS[i];
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r + 28) {
      const blend = 1 - THREE.MathUtils.smoothstep(d, c.r * 0.72, c.r + 28);
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

  // Hip leg pivots (standing at y=0.78 -> legs extend down to y=0)
  const legLPivot = new THREE.Group();
  legLPivot.position.set(-0.1, 0.78, 0);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.064, 0.78, 8), pantsMat);
  legL.position.set(0, -0.39, 0);
  legL.castShadow = true;
  legLPivot.add(legL);

  const legRPivot = new THREE.Group();
  legRPivot.position.set(0.1, 0.78, 0);
  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.064, 0.78, 8), pantsMat);
  legR.position.set(0, -0.39, 0);
  legR.castShadow = true;
  legRPivot.add(legR);
  group.add(legLPivot, legRPivot);

  // Articulated torso group at waist y=0.78 (allows natural leaning/all-fours crawling pose!)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.78, 0);
  group.add(torsoGroup);

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.68, 10), bodyMat);
  chest.scale.set(1.08, 1, 0.68);
  chest.position.y = 0.40;
  chest.castShadow = true;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), headMat);
  head.scale.set(0.95, 1.06, 0.98);
  head.position.y = 0.91;
  head.castShadow = true;

  chest.userData.targetId = id;
  head.userData.targetId = id;
  head.userData.isHeadshot = true;

  torsoGroup.add(chest, head);

  // Vest (always created so bot can visibly equip vest if it loots one!)
  const vestMat = new THREE.MeshStandardMaterial({
    color: vestLevel === 3 ? 0x1c1f26 : vestLevel === 2 ? 0x2f3842 : 0x4d5d3d,
    roughness: 0.55,
    metalness: vestLevel === 3 ? 0.45 : 0.15,
  });
  const vestMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.5, 10), vestMat);
  vestMesh.scale.set(1.08, 1, 0.74);
  vestMesh.position.y = 0.43;
  vestMesh.visible = vestLevel > 0;
  torsoGroup.add(vestMesh);

  // Helmet (always created so bot can visibly equip helmet when looting!)
  const helmMat = new THREE.MeshStandardMaterial({
    color: helmetLevel === 3 ? 0x181a1f : helmetLevel === 2 ? 0x2c343d : 0x566444,
    roughness: 0.45,
    metalness: helmetLevel === 3 ? 0.55 : 0.2,
  });
  const helmetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.172, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
    helmMat,
  );
  helmetMesh.position.y = 0.93;
  helmetMesh.visible = helmetLevel > 0;
  torsoGroup.add(helmetMesh);

  const armLPivot = new THREE.Group();
  armLPivot.position.set(-0.27, 0.65, 0);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.54, 8), bodyMat);
  armL.position.set(0, -0.25, 0);
  armLPivot.add(armL);

  const armRPivot = new THREE.Group();
  armRPivot.position.set(0.27, 0.65, 0);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.54, 8), bodyMat);
  armR.position.set(0, -0.25, 0.04);

  const gunMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.1, 0.58),
    new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.4, metalness: 0.65 }),
  );
  gunMesh.position.set(0, -0.44, 0.24);
  gunMesh.rotation.x = 0.95;
  armRPivot.add(armR, gunMesh);

  // Diagonal slung weapon on bot's back (visible when carrying primary weapon or healing)
  const backGunMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.085, 0.66),
    new THREE.MeshStandardMaterial({ color: 0x1e2228, roughness: 0.42, metalness: 0.72 }),
  );
  backGunMesh.position.set(0.14, 0.42, -0.17);
  backGunMesh.rotation.set(-Math.PI * 0.42, 0.1, -0.24);
  backGunMesh.visible = weaponId !== 'g18' && weaponId !== 'deagle';
  torsoGroup.add(backGunMesh);

  // Bot Camo Parachute Canopy (visible during parachute descent across the map)
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
  parachuteMesh.position.set(0, 3.3, 0);
  parachuteMesh.scale.set(0.55, 1.3, 0.95);
  parachuteMesh.visible = false;

  torsoGroup.add(armLPivot, armRPivot);
  group.add(parachuteMesh);

  const vestMaxHp = vestLevel === 0 ? 0 : vestLevel === 1 ? 100 : vestLevel === 2 ? 160 : 220;
  const helmetMaxHp =
    helmetLevel === 0 ? 0 : helmetLevel === 1 ? 75 : helmetLevel === 2 ? 120 : 180;

  return {
    id,
    nick,
    isBot: true,
    group,
    torsoGroup,
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
    gunMesh,
    backGunMesh,
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
const BOT_GUN_GEO = new THREE.BoxGeometry(0.06, 0.08, 0.52);
const BOT_GUN_MAT = new THREE.MeshStandardMaterial({
  color: 0x22262b,
  roughness: 0.4,
  metalness: 0.65,
});

export function setBotAdamClip(
  bot: TargetDummy,
  clipName: string,
  timeScale = 1.0,
  fadeSec = 0.18,
): void {
  const actions = bot.actions;
  if (!actions) return;
  const next = actions[clipName] ?? actions.Idle_Loop;
  if (!next) return;
  const resolved = next.getClip().name;
  next.timeScale = timeScale;
  if (bot.activeClipName === resolved) return;
  const prev = bot.activeClipName ? actions[bot.activeClipName] : undefined;
  next.enabled = true;
  next.reset();
  next.play();
  if (prev && prev !== next) {
    prev.crossFadeTo(next, fadeSec, true);
  }
  bot.activeClipName = resolved;
}

export function upgradeBotsToAdam(
  targets: TargetDummy[],
  camoTexture: THREE.Texture,
): void {
  if (!isAdamAssetsLoaded()) return;
  const data = getAdamData();
  if (!data) return;

  const skinColors = ['#d7a27e', '#c98e6b', '#e2b291', '#9b684b'];
  const hairColors = ['#18181b', '#2b1f18', '#3f2e21', '#111827'];
  const shoeColors = ['#1f242d', '#332924', '#18181b', '#e5e7eb'];

  const hairMats = hairColors.map(
    (col) =>
      new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
  );
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

  for (let i = 0; i < targets.length; i++) {
    const bot = targets[i];
    if (bot.isAdam) continue;

    // Clean up initial procedural children
    while (bot.group.children.length > 0) {
      const child = bot.group.children[0];
      bot.group.remove(child);
    }

    const cloned = cloneAdamScene();
    if (!cloned) continue;

    const visualRoot = new THREE.Group();
    visualRoot.add(cloned);
    bot.group.add(visualRoot);

    const shirtHex = `#${new THREE.Color(BOT_SHIRT_PALETTE[i % BOT_SHIRT_PALETTE.length]).getHexString()}`;
    const pantsHex = `#${new THREE.Color(BOT_PANTS_PALETTE[i % BOT_PANTS_PALETTE.length]).getHexString()}`;
    const skinHex = skinColors[i % skinColors.length];
    const shoeHex = shoeColors[i % shoeColors.length];
    const shirtStyle = i % 4 === 0 ? 'hoodie' : i % 6 === 0 ? 'tank' : 'tee';

    const outfitTex = getAdamOutfitTexture({
      skinColor: shirtStyle === 'tank' ? '#d7a27e' : skinHex,
      shirtStyle,
      shirtColor: shirtStyle === 'tank' ? '#f1f0ea' : shirtHex,
      pantsColor: shirtStyle === 'tank' ? '#c9b396' : pantsHex,
      shoesColor: shoeHex,
    });

    let bodyMat: THREE.MeshStandardMaterial | undefined;
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = bot.isAlly;
      mesh.receiveShadow = bot.isAlly;
      mesh.frustumCulled = false;
      const n = mesh.name.toLowerCase();
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh && !n.includes('eye')) {
        const clonedMat = (
          (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
        ).clone();
        if (outfitTex) {
          clonedMat.map = outfitTex;
        }
        clonedMat.normalMap = null;
        clonedMat.roughnessMap = null;
        clonedMat.color.setHex(0xffffff);
        clonedMat.roughness = 0.78;
        clonedMat.metalness = 0.02;
        clonedMat.needsUpdate = true;
        mesh.material = clonedMat;
        bodyMat = clonedMat;
      }
    });

    const spineBone = cloned.getObjectByName('spine_02') ?? cloned;
    const headBone = cloned.getObjectByName('Head') ?? spineBone;
    const handRBone = cloned.getObjectByName('hand_r') ?? spineBone;
    const upperAimBones: Array<{ name: string; bone: THREE.Object3D }> = [];
    for (let b = 0; b < UPPER_AIM_BONE_NAMES.length; b++) {
      const bName = UPPER_AIM_BONE_NAMES[b];
      const bone = cloned.getObjectByName(bName);
      if (bone) upperAimBones.push({ name: bName, bone });
    }

    // Invisible fast bone-attached hit proxies (zero SkinnedMesh raycasting overhead)
    const chestHit = new THREE.Mesh(BOT_CHEST_PROXY_GEO, BOT_HIT_PROXY_MAT);
    chestHit.position.set(0, 0.08, 0);
    chestHit.userData.targetId = bot.id;
    spineBone.add(chestHit);

    const headHit = new THREE.Mesh(BOT_HEAD_PROXY_GEO, BOT_HIT_PROXY_MAT);
    headHit.position.set(0, 0.11, 0.01);
    headHit.userData.targetId = bot.id;
    headHit.userData.isHeadshot = true;
    headBone.add(headHit);

    // Hair attached to Head
    const hairGeo = i % 2 === 0 ? data.hairBuzzedGeo : data.hairPartedGeo;
    if (hairGeo) {
      const hairMesh = new THREE.Mesh(hairGeo, hairMats[i % hairMats.length]);
      headBone.add(hairMesh);
    }

    // Vest & Helmet attached to real bones
    const vestMesh = new THREE.Mesh(
      BOT_VEST_GEO,
      vestMats[(bot.vestLevel || 1) as 1 | 2 | 3],
    );
    vestMesh.scale.set(1.06, 1, 0.68);
    vestMesh.position.set(0, 0.08, 0.008);
    vestMesh.visible = bot.vestLevel > 0;
    spineBone.add(vestMesh);

    const helmetMesh = new THREE.Mesh(
      BOT_HELMET_GEO,
      helmMats[(bot.helmetLevel || 1) as 1 | 2 | 3],
    );
    helmetMesh.scale.set(0.98, 1.02, 1.08);
    helmetMesh.position.set(0, 0.115, 0.005);
    helmetMesh.visible = bot.helmetLevel > 0;
    headBone.add(helmetMesh);

    // Gun held in hand_r + slung back gun on spine_02
    const gunPivot = new THREE.Group();
    gunPivot.position.set(0, 0.055, 0.025);
    gunPivot.rotation.set(-Math.PI / 2, 0, Math.PI);
    const gunBox = new THREE.Mesh(BOT_GUN_GEO, BOT_GUN_MAT);
    gunBox.position.set(0, 0.02, 0.16);
    gunPivot.add(gunBox);
    handRBone.add(gunPivot);

    const backGunMesh = new THREE.Mesh(BOT_GUN_GEO, BOT_GUN_MAT);
    backGunMesh.position.set(-0.15, 0.15, -0.17);
    backGunMesh.rotation.set(-Math.PI * 0.42, 0.1, -0.24);
    backGunMesh.visible = bot.weaponId !== 'g18' && bot.weaponId !== 'deagle';
    spineBone.add(backGunMesh);

    const parachuteMesh = new THREE.Mesh(sharedParachuteGeo, sharedParachuteMat);
    parachuteMesh.rotation.z = Math.PI / 2;
    parachuteMesh.rotation.y = Math.PI / 2;
    parachuteMesh.position.set(0, 3.25, 0);
    parachuteMesh.scale.set(0.55, 1.3, 0.95);
    parachuteMesh.visible = false;
    visualRoot.add(parachuteMesh);

    const mixer = new THREE.AnimationMixer(cloned);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (let c = 0; c < data.animations.length; c++) {
      const clip = data.animations[c];
      const act = mixer.clipAction(clip);
      if (clip.name === 'Death01') {
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
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

    bot.isAdam = true;
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
    bot.backGunMesh = backGunMesh;
    bot.parachuteMesh = parachuteMesh;
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
  const cloudGeo = new THREE.SphereGeometry(18, 10, 7);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const rad = 940 + (i % 3) * 140;
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.set(Math.cos(a) * rad, 195 + (i % 4) * 20, Math.sin(a) * rad);
    cloud.rotation.y = a;
    cloud.scale.set(1.8 + (i % 3) * 0.55, 0.36 + (i % 2) * 0.14, 1.1);
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);

  // Warm / Cool Outdoor Daylight Rig (bright Bermudian clarity across all distances)
  const hemi = new THREE.HemisphereLight(0xc4e8ff, 0x948062, 1.35);
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight(0xfff4dc, 1.9);
  sunLight.position.set(110, 150, 85);
  sunLight.castShadow = false;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 310;
  const d = 75;
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
    { x1: -455, z1: -505, x2: -345, z2: -495, width: 7.4, kind: 'dirt' },
    { x1: -345, z1: -495, x2: -265, z2: riverCenterZ(-265) - 25, width: 7.6, kind: 'asphalt' },
    { x1: -265, z1: riverCenterZ(-265) + 25, x2: -295, z2: -185, width: 7.6, kind: 'asphalt' },
    { x1: -345, z1: -495, x2: 75, z2: riverCenterZ(75) - 29, width: 7.2, kind: 'asphalt' },
    { x1: 75, z1: riverCenterZ(75) - 29, x2: 225, z2: -430, width: 7.2, kind: 'asphalt' },
    { x1: 225, z1: -430, x2: 265, z2: -565, width: 7.2, kind: 'asphalt' },
    { x1: 225, z1: -430, x2: 395, z2: riverCenterZ(395) - 25, width: 7.4, kind: 'asphalt' },
    { x1: 395, z1: riverCenterZ(395) + 25, x2: 495, z2: -210, width: 7.4, kind: 'asphalt' },
    { x1: 75, z1: riverCenterZ(75) + 29, x2: 185, z2: -225, width: 7.6, kind: 'asphalt' },
    // Central Mountain & City Spine (Plantation -> Peak -> Clock Tower -> Bimasakti -> Factory/Pochinok)
    { x1: 185, z1: -225, x2: 35, z2: -75, width: 7.0, kind: 'dirt' },
    { x1: 35, z1: -75, x2: -145, z2: -45, width: 8.0, kind: 'asphalt' },
    { x1: -145, z1: -45, x2: -15, z2: 165, width: 8.6, kind: 'asphalt' },
    { x1: -15, z1: 165, x2: -165, z2: 325, width: 8.0, kind: 'asphalt' },
    { x1: -15, z1: 165, x2: 195, z2: 335, width: 8.0, kind: 'asphalt' },
    // West Ring (Graveyard -> Katulistiwa -> Observatório -> Clock Tower -> Rim Nam -> Mars Electric)
    { x1: -515, z1: -235, x2: -295, z2: -185, width: 7.2, kind: 'asphalt' },
    { x1: -295, z1: -185, x2: -145, z2: -45, width: 7.6, kind: 'asphalt' },
    { x1: -515, z1: -235, x2: -575, z2: 35, width: 6.4, kind: 'dirt' },
    { x1: -575, z1: 35, x2: -535, z2: 295, width: 6.8, kind: 'dirt' },
    { x1: -535, z1: 295, x2: -345, z2: 485, width: 7.2, kind: 'asphalt' },
    { x1: -345, z1: 485, x2: -165, z2: 325, width: 7.6, kind: 'asphalt' },
    { x1: -165, z1: 325, x2: 195, z2: 335, width: 7.6, kind: 'asphalt' },
    // East Ring (Mill -> Keraton -> Capetown -> Sentosa Bridges -> Sentosa)
    { x1: 495, z1: -210, x2: 345, z2: 70, width: 7.4, kind: 'asphalt' },
    { x1: 345, z1: 70, x2: 545, z2: 85, width: 7.2, kind: 'asphalt' },
    { x1: 345, z1: 70, x2: 195, z2: 335, width: 7.0, kind: 'dirt' },
    { x1: 35, z1: -75, x2: 345, z2: 70, width: 6.8, kind: 'dirt' },
    { x1: 545, z1: 85, x2: 555, z2: 261, width: 7.6, kind: 'asphalt' },
    { x1: 555, z1: 389, x2: 555, z2: 515, width: 7.6, kind: 'asphalt' },
    { x1: 195, z1: 335, x2: 312, z2: 515, width: 7.6, kind: 'asphalt' },
    { x1: 448, z1: 515, x2: 555, z2: 515, width: 7.6, kind: 'asphalt' },
  ];

  // 1. Full Bermuda 2200m x 2200m Terrain Mesh (144x144 crisp relief)
  const terrainGeo = new THREE.PlaneGeometry(2200, 2200, 144, 144);
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
    } else if (vy > 11.0) {
      tmpColor.copy(cPeak);
    } else if (vy > 5.8) {
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

  // 2. Tropical Turquoise Coastal Reef Water -> Deep Ocean Blue (single draw call via vertex colors!)
  const waterGeo = new THREE.PlaneGeometry(3600, 3600, 128, 128);
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
    roughness: 0.22,
    metalness: 0.24,
  });
  applyDistanceTextureLod(waterMat, [0.85, 0.94, 0.98]);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = -0.35;
  water.receiveShadow = false;
  scene.add(water);

  // 3. Distant Horizon Rounded Archipelago Islands
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x4b6875,
    roughness: 0.95,
    flatShading: false,
  });
  const mountainGeo = new THREE.SphereGeometry(110, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const mountainCount = 34;
  const mountains = new THREE.InstancedMesh(mountainGeo, mountainMat, mountainCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < mountainCount; i++) {
    const angle = (i / mountainCount) * Math.PI * 2;
    const rad = 1140 + (i % 4) * 75;
    dummy.position.set(Math.cos(angle) * rad, -8, Math.sin(angle) * rad);
    dummy.rotation.y = i * 0.63;
    const sc = 0.9 + (i % 5) * 0.25;
    dummy.scale.set(sc * 1.4, sc * 0.9, sc * 1.2);
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
    createBridge(-265, ponteOesteZ, 8.8, 50, 3.4, 0, concreteMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: -265, z: ponteOesteZ, w: 8.8, d: 50, rotY: 0, kind: 'bridge' });

  const damZ = riverCenterZ(75);
  scene.add(
    createBridge(75, damZ, 10.4, 58, 5.5, 0, concreteMat, concreteMat, colliders, platforms, obstacleMeshes),
  );
  // Nurek Dam monumental concrete spillway wall across the northern gorge
  const damWall = new THREE.Mesh(new THREE.BoxGeometry(62, 6.2, 6.5), concreteMat);
  damWall.position.set(75, 2.2, damZ);
  damWall.castShadow = true;
  damWall.receiveShadow = true;
  scene.add(damWall);
  buildings.push({ x: 75, z: damZ, w: 10.4, d: 58, rotY: 0, kind: 'bridge' });

  const ponteLesteZ = riverCenterZ(395);
  scene.add(
    createBridge(395, ponteLesteZ, 8.8, 50, 3.4, 0, woodWallMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: 395, z: ponteLesteZ, w: 8.8, d: 50, rotY: 0, kind: 'bridge' });

  // Sentosa Strait North & West Long Steel Bridges
  scene.add(
    createBridge(555, 325, 9.6, 128, 3.4, 0, concreteMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: 555, z: 325, w: 9.6, d: 128, rotY: 0, kind: 'bridge' });
  scene.add(
    createContainer(557.2, 315, 0.04, blueContainerMat, colliders, platforms, obstacleMeshes, 3.4 - sampleGroundHeight(557.2, 315)),
  );

  scene.add(
    createBridge(380, 515, 9.6, 136, 3.4, Math.PI / 2, concreteMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: 380, z: 515, w: 136, d: 9.6, rotY: 0, kind: 'bridge' });
  scene.add(
    createContainer(388, 517.2, Math.PI / 2 + 0.04, rustContainerMat, colliders, platforms, obstacleMeshes, 3.4 - sampleGroundHeight(388, 517.2)),
  );

  // 5b. ICONIC FREE FIRE CLOCK TOWER LANDMARK at (-145, -45)
  {
    const ctX = -145;
    const ctZ = -45;
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
    const faceGeo = new THREE.CircleGeometry(1.45, 16);
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

  // 6. 64 Enterable Houses across all 20 Bermuda Cities & Compounds (cleanly offset from roads!)
  const houseSpecs: Array<[number, number, number, number, number, number, boolean]> = [
    // CLOCK TOWER (-145, -45)
    [-168, -64, 8.8, 7.0, 3.4, 0.05, false],
    [-122, -64, 9.0, 7.2, 3.5, -0.05, true],
    [-172, -22, 8.2, 6.8, 3.4, 1.55, false],
    [-118, -22, 8.4, 6.8, 3.4, -1.55, true],
    [-184, -45, 8.0, 6.4, 3.3, 0.1, false],
    [-106, -45, 8.0, 6.6, 3.4, 3.1, true],
    // PEAK (35, -75 - hilltop manor + compound)
    [35, -52, 12.0, 8.8, 4.2, 0.0, false],
    [10, -82, 8.4, 6.8, 3.3, 1.4, true],
    [62, -80, 8.6, 6.8, 3.4, -1.5, false],
    [34, -104, 8.8, 7.0, 3.4, 3.14, true],
    // BIMASAKTI STRIP (-15, 165)
    [-34, 146, 8.6, 6.8, 3.4, 1.57, false],
    [6, 146, 8.6, 6.8, 3.4, -1.57, true],
    [-34, 166, 8.2, 6.6, 3.4, 1.57, true],
    [6, 166, 8.8, 7.0, 3.5, -1.57, false],
    [-34, 186, 8.4, 6.8, 3.4, 1.57, false],
    [6, 186, 8.2, 6.6, 3.3, -1.57, true],
    // FACTORY (-165, 325)
    [-190, 306, 8.4, 6.6, 3.4, 0.2, false],
    [-144, 306, 8.0, 6.4, 3.3, -0.3, true],
    [-190, 344, 8.2, 6.6, 3.3, 1.5, false],
    // POCHINOK (195, 335)
    [174, 316, 8.6, 6.8, 3.4, 0.15, false],
    [214, 318, 8.8, 7.0, 3.5, -0.2, true],
    [172, 354, 8.2, 6.6, 3.3, 1.5, true],
    [216, 354, 9.2, 7.4, 3.6, -1.5, false],
    [195, 368, 8.4, 6.6, 3.4, 3.1, true],
    // MARS ELECTRIC (-345, 485)
    [-370, 466, 9.0, 7.2, 3.5, 0.05, false],
    [-318, 466, 9.0, 7.2, 3.5, -0.05, false],
    [-366, 506, 8.4, 6.6, 3.4, 3.1, true],
    // SENTOSA ISLAND (555, 515)
    [530, 492, 8.8, 7.0, 3.4, 0.1, false],
    [580, 492, 8.8, 7.0, 3.4, -0.1, true],
    [526, 534, 8.4, 6.6, 3.4, 1.55, true],
    [582, 534, 8.6, 6.8, 3.4, -1.55, false],
    [555, 554, 9.0, 7.2, 3.5, 3.14, true],
    [504, 508, 8.0, 6.4, 3.3, 0.4, false],
    // CAPETOWN (545, 85)
    [524, 66, 8.2, 6.4, 3.3, 0.3, true],
    [566, 68, 8.4, 6.6, 3.3, -0.4, false],
    [544, 108, 8.4, 6.6, 3.4, 2.9, true],
    // KERATON (345, 70)
    [324, 52, 8.6, 6.8, 3.4, 0.1, false],
    [366, 52, 8.4, 6.6, 3.4, -0.2, true],
    [345, 92, 8.2, 6.6, 3.3, 3.1, false],
    // KATULISTIWA (-295, -185)
    [-318, -204, 8.6, 6.8, 3.4, 0.1, false],
    [-272, -204, 8.4, 6.6, 3.4, -0.2, true],
    [-295, -162, 8.8, 7.0, 3.4, 3.1, false],
    // PLANTATION (185, -225)
    [164, -242, 8.2, 6.4, 3.3, 0.25, true],
    [206, -242, 8.4, 6.6, 3.3, -0.25, false],
    [185, -202, 8.6, 6.8, 3.4, 3.14, true],
    // MILL (495, -210)
    [474, -232, 8.4, 6.6, 3.3, 0.1, false],
    [516, -228, 8.2, 6.4, 3.3, -0.4, true],
    [516, -188, 8.4, 6.6, 3.4, 2.9, false],
    // RIVERSIDE (225, -430)
    [204, -448, 8.2, 6.4, 3.3, 0.2, true],
    [246, -446, 8.2, 6.4, 3.3, -0.2, false],
    [225, -408, 8.0, 6.2, 3.2, 3.1, true],
    // SHIPYARD (265, -565)
    [242, -584, 8.4, 6.6, 3.3, 0.1, false],
    [290, -546, 8.4, 6.6, 3.3, -0.25, true],
    // HANGAR (-345, -495)
    [-370, -478, 8.4, 6.6, 3.3, 0.2, false],
    [-320, -514, 8.2, 6.4, 3.2, -0.3, true],
    // GRAVEYARD (-515, -235)
    [-536, -254, 8.2, 6.6, 3.3, 0.15, false],
    [-492, -252, 8.4, 6.6, 3.3, -0.15, true],
    [-515, -210, 8.6, 6.8, 3.4, 3.1, false],
    // BULLSEYE (-455, -505)
    [-474, -522, 8.0, 6.4, 3.3, 0.1, true],
    [-436, -488, 8.2, 6.4, 3.3, -0.2, false],
    // OBSERVATÓRIO (-575, 35)
    [-594, 18, 7.8, 6.2, 3.2, 0.35, false],
    [-556, 52, 7.8, 6.2, 3.2, -0.35, true],
    // RIM NAM VILA (-535, 295)
    [-556, 278, 7.8, 6.2, 3.2, 0.4, true],
    [-514, 310, 7.8, 6.2, 3.2, -0.3, true],
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

  // 18 Casas L (L-Shaped 2-Story House with Balcony / Sacada)
  const casaLSpecs: Array<[number, number, number]> = [
    [-198, -72, 0.3], // Clock Tower West
    [8, -112, 0.0], // Peak North-West
    [-56, 152, -1.57], // Bimasakti West
    [28, 188, 1.57], // Bimasakti East
    [-210, 325, -1.57], // Factory West
    [150, 334, -1.57], // Pochinok West
    [-312, 508, 3.14], // Mars Electric South-East
    [602, 512, 1.57], // Sentosa East
    [586, 88, 1.57], // Capetown East
    [302, 74, -1.57], // Keraton West
    [-342, -184, -1.57], // Katulistiwa West
    [226, -222, 1.57], // Plantation East
    [538, -208, 1.57], // Mill East
    [266, -428, 1.57], // Riverside East
    [-392, -504, -1.57], // Hangar West
    [-512, 272, 0.2], // Rim Nam Vila
    [-65, -76, 0.15], // Highway Peak <-> Clock Tower
    [98, 242, -0.4], // Central Crossroads Bimasakti <-> Pochinok
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

  // 14 Casas God (2-Story Tactical Stronghold with Rooftop Parapet)
  const casaGodSpecs: Array<[number, number, number]> = [
    [-145, -84, 0.0], // Clock Tower North
    [56, -110, 0.2], // Peak North
    [28, 154, 1.57], // Bimasakti East
    [-134, 344, 0.0], // Factory South-East
    [238, 334, 1.57], // Pochinok East
    [-388, 488, -1.57], // Mars Electric West
    [524, 468, 0.0], // Sentosa North-West
    [544, 42, 0.0], // Capetown North
    [346, 30, 0.0], // Keraton North
    [454, -208, -1.57], // Mill West
    [222, -552, -1.57], // Shipyard West
    [-472, -232, 1.57], // Graveyard East
    [-560, 316, 3.14], // Rim Nam Vila South
    [-96, 60, -1.57], // Roadside Clock Tower <-> Bimasakti
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

  // 10 Celeiros (Red Wooden Barns with Mezzanine Loft)
  const celeiroSpecs: Array<[number, number, number]> = [
    [-10, -56, -1.3], // Peak West Meadow
    [226, 296, 3.14], // Pochinok North-East
    [555, 582, 3.14], // Sentosa South Farm
    [-296, -224, 0.0], // Katulistiwa North
    [142, -224, -1.57], // Plantation West
    [494, -252, 0.0], // Mill North
    [184, -428, -1.57], // Riverside West
    [-556, -230, -1.57], // Graveyard West
    [-422, -522, 0.4], // Bullseye North-East
    [-492, 298, 1.57], // Rim Nam Vila East
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

  // 16 Sobrados (2-Story Residential Houses across POIs & Roadside Villages)
  const sobradoSpecs: Array<[number, number, number]> = [
    [-115, -82, 0.0], // Clock Tower North-East
    [-162, 10, 3.14], // Clock Tower South
    [74, -54, 1.57], // Peak East
    [-56, 186, -1.57], // Bimasakti South-West
    [-138, 286, 0.0], // Factory North
    [195, 294, 0.0], // Pochinok North
    [-344, 444, 0.0], // Mars Electric North
    [586, 468, 0.0], // Sentosa North-East
    [510, 558, 3.14], // Sentosa South-West
    [506, 92, -1.57], // Capetown West
    [384, 76, 1.57], // Keraton East
    [-250, -184, 1.57], // Katulistiwa East
    [186, -264, 0.0], // Plantation North
    [226, -468, 0.0], // Riverside North
    [308, -568, 1.57], // Shipyard East
    [-64, 72, 1.57], // Roadside Village Clock Tower <-> Bimasakti
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

  // 24 Guaritas (4-Way Guard Posts at City Entrances, Crossroads & Bridges)
  const guaritaSpecs: Array<[number, number, number]> = [
    [-134, -5, 3.14], // Clock Tower South
    [12, -40, 2.7], // Peak South-West
    [-28, 126, 0.0], // Bimasakti North
    [8, 208, 3.14], // Bimasakti South
    [-164, 292, 0.0], // Factory North
    [160, 372, 2.5], // Pochinok South
    [-322, 446, 0.0], // Mars Electric North
    [538, 422, 0.0], // Sentosa North Bridge
    [566, 122, 3.14], // Capetown South
    [372, 108, 2.6], // Keraton South
    [-266, -152, 2.7], // Katulistiwa South
    [212, -196, 3.14], // Plantation South
    [468, -174, 2.8], // Mill South
    [252, -402, 2.9], // Riverside South
    [282, -592, 0.0], // Shipyard North
    [-364, -536, 0.0], // Hangar North
    [-486, -204, 2.8], // Graveyard South
    [-446, -466, 3.14], // Bullseye South
    [-602, 52, 1.57], // Observatório West
    [-536, 256, 0.0], // Rim Nam North
    [-84, 42, -0.8], // Highway Outpost
    [110, 265, 2.2], // Crossroads Bimasakti <-> Pochinok
    [60, -310, 0.0], // Nurek Dam South Guardpost
    [292, 498, -1.57], // Sentosa West Bridge Approach
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

  // Extra Roadside Villages in Open Mid-Island Corridors
  const roadsideExtras: Array<
    | { kind: 'casaL' | 'casaGod' | 'celeiro' | 'sobrado'; x: number; z: number; rot: number }
  > = [
    { kind: 'casaGod', x: 16, z: 352, rot: 0.0 },
    { kind: 'sobrado', x: -18, z: 346, rot: 3.14 },
    { kind: 'casaL', x: -268, z: 405, rot: 0.6 },
    { kind: 'sobrado', x: -242, z: 428, rot: -2.4 },
    { kind: 'celeiro', x: -536, z: 168, rot: 0.1 },
    { kind: 'casaL', x: 196, z: -18, rot: -0.3 },
    { kind: 'casaGod', x: 222, z: 6, rot: 2.8 },
    { kind: 'celeiro', x: 345, z: -228, rot: 0.0 },
    { kind: 'sobrado', x: 372, z: -206, rot: 1.57 },
    { kind: 'casaGod', x: 96, z: -282, rot: 0.0 },
  ];
  roadsideExtras.forEach((re) => {
    const ry = sampleGroundHeight(re.x, re.z);
    if (ry < 1.2) return;
    if (re.kind === 'casaL') {
      const r = createCasaL(re.x, re.z, re.rot, ry, buildingMats, colliders, platforms, obstacleMeshes);
      scene.add(r.group);
      cullableStructures.push({ obj: r.group, x: re.x, z: re.z, radiusScale: 1.25 });
      buildings.push({ x: re.x, z: re.z, w: 10.8, d: 10.6, rotY: re.rot, kind: 'casaL' });
      buildingNavZones.push(r.navZone);
      prefabLootPoints.push(...r.lootPoints);
    } else if (re.kind === 'casaGod') {
      const r = createCasaGod(re.x, re.z, re.rot, ry, buildingMats, colliders, platforms, obstacleMeshes);
      scene.add(r.group);
      cullableStructures.push({ obj: r.group, x: re.x, z: re.z, radiusScale: 1.22 });
      buildings.push({ x: re.x, z: re.z, w: 9.8, d: 9.8, rotY: re.rot, kind: 'casaGod' });
      buildingNavZones.push(r.navZone);
      prefabLootPoints.push(...r.lootPoints);
    } else if (re.kind === 'celeiro') {
      const r = createCeleiro(re.x, re.z, re.rot, ry, buildingMats, colliders, platforms, obstacleMeshes);
      scene.add(r.group);
      cullableStructures.push({ obj: r.group, x: re.x, z: re.z, radiusScale: 1.3 });
      buildings.push({ x: re.x, z: re.z, w: 10.6, d: 14.0, rotY: re.rot, kind: 'celeiro' });
      buildingNavZones.push(r.navZone);
      prefabLootPoints.push(...r.lootPoints);
    } else {
      const r = createSobradoHouse(re.x, re.z, re.rot, ry, buildingMats, colliders, platforms, obstacleMeshes);
      scene.add(r.group);
      cullableStructures.push({ obj: r.group, x: re.x, z: re.z, radiusScale: 1.15 });
      buildings.push({ x: re.x, z: re.z, w: 8.8, d: 7.8, rotY: re.rot, kind: 'sobrado' });
      buildingNavZones.push(r.navZone);
      prefabLootPoints.push(...r.lootPoints);
    }
  });

  // 7. Industrial Sheds & Hangars (Factory, Mill, Mars Electric, Shipyard, Hangar, Sentosa, Bullseye)
  const shedSpecs: Array<[number, number, number, number, number, number]> = [
    [-165, 326, 13.5, 19.0, 5.2, 0.0], // Giant Factory Main Hangar
    [-186, 326, 10.5, 14.5, 4.6, 0.0], // Factory Wing 2
    [488, -196, 11.5, 16.5, 4.8, 0.0], // Mill Hangar 1
    [508, -220, 10.8, 15.0, 4.6, 1.57], // Mill Hangar 2
    [-348, -476, 11.5, 16.0, 4.8, 0.0], // Hangar Main
    [256, -552, 10.5, 14.5, 4.4, 0.3], // Shipyard Warehouse
    [-342, 496, 12.5, 17.5, 5.0, 1.57], // Mars Electric Hangar
    [555, 502, 11.0, 15.0, 4.6, 1.57], // Sentosa Storage Hangar
    [-456, -504, 10.5, 14.0, 4.5, 0.2], // Bullseye Warehouse
    [-294, -184, 10.5, 14.0, 4.5, 1.57], // Katulistiwa Depot
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

  // Concrete Airstrip Runway at Hangar (-345, -495)
  const runwayY = sampleGroundHeight(-345, -505);
  const runway = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.16, 72),
    concreteMat,
  );
  runway.position.set(-345, runwayY + 0.04, -508);
  runway.receiveShadow = true;
  scene.add(runway);
  platforms.push({
    cx: -345,
    cz: -508,
    halfW: 6,
    halfD: 36,
    rotY: 0,
    topY: runwayY + 0.12,
    minY: runwayY - 1,
  });

  // 8. SHIPYARD PORTO (Dock Pier + Stacked Shipping Containers across Shipyard/Factory/Mill/Mars/Sentosa)
  const pierY = sampleGroundHeight(265, -565);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(36, 0.6, 22), concreteMat);
  pier.position.set(274, pierY - 0.15, -574);
  pier.receiveShadow = true;
  scene.add(pier);
  platforms.push({
    cx: 274,
    cz: -574,
    halfW: 18,
    halfD: 11,
    rotY: 0,
    topY: pierY + 0.15,
    minY: 0,
  });

  const containerSpecs: Array<[number, number, number, boolean, number]> = [
    [264, -566, 0.05, true, 0],
    [268, -566, 0.05, false, 0],
    [266, -566, 0.05, true, 2.7],
    [280, -560, 1.5, false, 0],
    [250, -576, -0.35, true, 0],
    [284, -576, 0.15, false, 0],
    [-156, 332, 0.2, true, 0],
    [-174, 310, 1.57, false, 0],
    [484, -214, 0.4, true, 0],
    [498, -234, 1.57, false, 0],
    [-350, 476, 0.0, true, 0],
    [-332, 476, 0.0, false, 0],
    [542, 514, 0.1, true, 0],
    [568, 516, 1.57, false, 0],
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

  // 9. Watchtowers (Observatório, Capetown, Mars Electric, Peak, Sentosa, Graveyard)
  const wtCoords: Array<[number, number]> = [
    [-575, 35],
    [548, 92],
    [-352, 492],
    [22, -68],
    [555, 480],
    [-515, -242],
  ];
  wtCoords.forEach(([wx, wz]) => {
    const wt = createWatchTowerLOD(wx, wz, concreteMat, steelMat, colliders, obstacleMeshes);
    scene.add(wt);
    cullableStructures.push({ obj: wt, x: wx, z: wz, radiusScale: 1.25 });
    buildings.push({ x: wx, z: wz, w: 7.2, d: 7.2, rotY: 0, kind: 'tower' });
  });

  // 10. Vending Machines (Lojinhas) - vehicles are spawned right after static props so staticColliderCount stays exact!

  const vendingSpecs: Array<{ id: string; x: number; z: number; rotY: number; label: string }> = [
    { id: 'vm_clock', x: -128, z: -42, rotY: -1.57, label: 'Lojinha Clock Tower' },
    { id: 'vm_peak', x: 25, z: -72, rotY: 0.4, label: 'Lojinha Peak' },
    { id: 'vm_bima', x: -26, z: 162, rotY: 1.57, label: 'Lojinha Bimasakti' },
    { id: 'vm_factory', x: -154, z: 320, rotY: -0.8, label: 'Lojinha Factory' },
    { id: 'vm_mill', x: 486, z: -214, rotY: 0.2, label: 'Lojinha Mill' },
    { id: 'vm_pochinok', x: 186, z: 328, rotY: 0.6, label: 'Lojinha Pochinok' },
    { id: 'vm_ship', x: 260, z: -558, rotY: -0.5, label: 'Lojinha Shipyard' },
    { id: 'vm_mars', x: -336, z: 474, rotY: 0.0, label: 'Lojinha Mars Electric' },
    { id: 'vm_sentosa', x: 545, z: 510, rotY: 0.5, label: 'Lojinha Sentosa' },
    { id: 'vm_katu', x: -286, z: -182, rotY: -1.1, label: 'Lojinha Katulistiwa' },
    { id: 'vm_grave', x: -506, z: -232, rotY: 0.9, label: 'Lojinha Graveyard' },
    { id: 'vm_cape', x: 536, z: 82, rotY: 1.2, label: 'Lojinha Capetown' },
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

  // 11. Free Fire Tactical Gameplay Props: Concrete Street Barriers, Wooden Crates, EXPLOSIVE RED BARRELS, & LAUNCH PADS!
  const barrierCoords: Array<[number, number, number]> = [
    [-155, -45, 0],
    [-135, -45, 0],
    [-145, -28, 1.57],
    [-145, -62, 1.57],
    [75, damZ + 12, 0.3],
    [75, damZ - 12, -0.25],
    [-15, 156, 0.2],
    [-15, 174, -0.2],
    [35, -66, 0.4],
    [-570, 26, -0.6],
    [262, -560, 0.5],
    [488, -206, 0.2],
    [-295, -185, 0.9],
    [-345, 475, 0.1],
    [-165, 316, 0.0],
    [192, 332, -0.3],
    [555, 505, 0.2],
    [555, 385, 0.0],
    [318, 515, 1.57],
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
    [-336, -485, 0.2],
    [-334, -483, 0.7],
    [-133, -38, 0.1],
    [-157, -52, 0.5],
    [492, -200, 0.4],
    [270, -560, 0.2],
    [198, 338, -0.4],
    [-568, 30, 0.3],
    [-288, -178, 0.4],
    [-340, 484, -0.2],
    [30, -72, 0.5],
    [-160, 318, 0.2],
    [-20, 162, -0.3],
    [-10, 170, 0.4],
    [548, 512, 0.3],
    [342, 68, -0.2],
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
  scene.add(crateInst);
  obstacleMeshes.push(crateInst);

  // Iconic Free Fire Explosive RED Oil Barrels (shoot to detonate!)
  const barrelCoords: Array<[number, number]> = [
    [-135, -44],
    [-159, -48],
    [40, -68],
    [26, -78],
    [-22, 158],
    [-4, 172],
    [-158, 332],
    [-174, 316],
    [484, -200],
    [502, -214],
    [-570, 28],
    [186, 328],
    [204, 342],
    [258, -558],
    [-288, -182],
    [-338, 478],
    [-352, 488],
    [538, 82],
    [-342, -488],
    [-452, -502],
    [-532, 290],
    [548, 506],
    [77, damZ + 8],
  ];
  const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.25, 10);
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

  // Classic Free Fire Launch Pads ("Lançadores") between Bermuda cities
  const launchPadSpecs: Array<[number, number, number, number, string]> = [
    [-128, -45, 35, -75, 'LANÇADOR -> PEAK'],
    [18, -75, -145, -45, 'LANÇADOR -> CLOCK TOWER'],
    [-160, 310, -15, 165, 'LANÇADOR -> BIMASAKTI'],
    [2, 168, 195, 335, 'LANÇADOR -> POCHINOK'],
    [480, -210, 345, 70, 'LANÇADOR -> KERATON'],
    [-335, 470, -165, 325, 'LANÇADOR -> FACTORY'],
    [535, 495, 195, 335, 'LANÇADOR -> POCHINOK'],
    [-555, 35, -295, -185, 'LANÇADOR -> KATULISTIWA'],
    [255, -545, 185, -225, 'LANÇADOR -> PLANTATION'],
    [-325, -485, -295, -185, 'LANÇADOR -> KATULISTIWA'],
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
    const countOnRoad = Math.min(5, Math.floor(len / 52));
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

  // 12b. Roadside Tire Stacks & Military Supply Crates (2 draw calls)
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.88, metalness: 0.1 });
  const tireGeo = new THREE.CylinderGeometry(0.46, 0.5, 0.98, 10);
  const tireList: Array<[number, number, number]> = [];
  const milCrateGeo = new THREE.BoxGeometry(1.65, 1.05, 1.15);
  const milCrateMat = new THREE.MeshStandardMaterial({ color: 0x4b5836, roughness: 0.82, metalness: 0.12 });
  const milCrateList: Array<[number, number, number, number]> = [];

  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    const dx = r.x2 - r.x1;
    const dz = r.z2 - r.z1;
    const len = Math.hypot(dx, dz);
    if (len < 36) continue;
    const nx = -dz / len;
    const nz = dx / len;
    const steps = Math.min(3, Math.floor(len / 75));
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

  // 12c. Roadside Utility Power Poles (1 draw call)
  const poleTrunk = new THREE.CylinderGeometry(0.13, 0.19, 6.4, 6);
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
    if (len < 45) continue;
    const ang = Math.atan2(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    const count = Math.min(4, Math.floor(len / 55));
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

  // 12d. Smooth Rounded Wavy Rocks & Boulders (lightweight InstancedMesh cover across full Bermuda)
  const rockGeo = new THREE.IcosahedronGeometry(1.25, 1);
  const rockPos = rockGeo.attributes.position;
  for (let v = 0; v < rockPos.count; v++) {
    const vx = rockPos.getX(v);
    const vy = rockPos.getY(v);
    const vz = rockPos.getZ(v);
    const waveMod = 1 + Math.sin(vx * 2.1 + vy * 2.7) * 0.1 + Math.cos(vz * 2.5) * 0.08;
    rockPos.setXYZ(v, vx * waveMod, vy * waveMod * 0.84, vz * waveMod);
  }
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({
    map: textures.rock,
    color: 0xffffff,
    roughness: 0.88,
    flatShading: false,
  });
  applyDistanceTextureLod(rockMat, [0.56, 0.55, 0.52]);
  const rockList: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 400 && rockList.length < 240; i++) {
    const a = i * 1.77 + 0.5;
    const r = 65 + ((i * 83) % 780);
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r;
    const ry = sampleGroundHeight(rx, rz);
    if (ry < 0.75) continue;
    if (!isClearOfPoiAndRoads(rx, rz, 10)) continue;
    const sc = 0.8 + (i % 5) * 0.34;
    rockList.push([rx, ry, rz, sc]);
  }
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockList.length);
  rockInst.castShadow = false;
  rockInst.receiveShadow = true;
  rockList.forEach(([rx, ry, rz, sc], idx) => {
    dummy.position.set(rx, ry + sc * 0.42, rz);
    dummy.rotation.set(idx * 0.4, idx * 0.9, idx * 0.2);
    dummy.scale.set(sc * 1.22, sc * 0.82, sc);
    dummy.updateMatrix();
    rockInst.setMatrixAt(idx, dummy.matrix);
    const shade = 0.76 + (idx % 4) * 0.07;
    rockInst.setColorAt(idx, tmpColor.setRGB(shade, shade * 0.98, shade * 0.95));
    colliders.push({
      cx: rx,
      cz: rz,
      halfW: sc * 1.05,
      halfD: sc * 0.9,
      rotY: idx * 0.9,
      minY: ry - 0.5,
      maxY: ry + sc * 1.3,
      tag: 'rock',
    });
  });
  rockInst.computeBoundingSphere();
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  scene.add(rockInst);
  obstacleMeshes.push(rockInst);

  // 12e. Optimized Bermudian Trees (ONLY 2 draw calls total, castShadow=false, outside POIs & roads!)
  const foliageMat = new THREE.MeshStandardMaterial({
    map: textures.foliage,
    color: 0xffffff,
    roughness: 0.85,
  });
  applyDistanceTextureLod(foliageMat, [0.46, 0.64, 0.32]);
  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.bark,
    color: 0x9c7b5c,
    roughness: 0.9,
  });
  applyDistanceTextureLod(barkMat, [0.48, 0.36, 0.25]);

  const treeTrunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 4.4, 6);
  treeTrunkGeo.translate(0, 2.2, 0);
  const crownLow = new THREE.IcosahedronGeometry(2.15, 1);
  crownLow.scale(1.15, 0.85, 1.15);
  crownLow.translate(0, 4.9, 0);
  const crownTop = new THREE.IcosahedronGeometry(1.55, 1);
  crownTop.scale(1.05, 0.92, 1.05);
  crownTop.translate(0.18, 6.2, -0.1);
  const treeCanopyGeo = mergeGeometries([crownLow, crownTop], false);
  crownLow.dispose();
  crownTop.dispose();

  const treeCoords: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 420 && treeCoords.length < 165; i++) {
    const a = i * 2.39996 + 0.2;
    const rad = 55 + ((i * 97) % 760);
    const tx = Math.cos(a) * rad;
    const tz = Math.sin(a) * rad;
    const ty = sampleGroundHeight(tx, tz);
    if (ty < 1.35) continue;
    const nearPoi = POIS.some((p) => Math.hypot(tx - p.x, tz - p.z) < p.radius * 0.85);
    if (nearPoi) continue;
    if (Math.abs(tz - riverCenterZ(tx)) < 26) continue;
    if (distToRoadSq(tx, tz) < 14 * 14) continue;
    const sc = 0.85 + (i % 4) * 0.16;
    treeCoords.push([tx, ty, tz, sc]);
  }
  const treeTrunkInst = new THREE.InstancedMesh(treeTrunkGeo, barkMat, Math.max(1, treeCoords.length));
  treeTrunkInst.castShadow = false;
  treeTrunkInst.receiveShadow = true;
  const treeCanopyInst = new THREE.InstancedMesh(
    treeCanopyGeo ?? new THREE.IcosahedronGeometry(2.0, 1),
    foliageMat,
    Math.max(1, treeCoords.length),
  );
  treeCanopyInst.castShadow = false;
  treeCanopyInst.receiveShadow = false;
  const treePalette = [0x4f8a36, 0x5d993e, 0x6ba649, 0x487d32];
  treeCoords.forEach(([tx, ty, tz, sc], idx) => {
    dummy.position.set(tx, ty - 0.1, tz);
    dummy.rotation.set(0, idx * 1.1, 0);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    treeTrunkInst.setMatrixAt(idx, dummy.matrix);
    treeCanopyInst.setMatrixAt(idx, dummy.matrix);
    treeCanopyInst.setColorAt(idx, tmpColor.setHex(treePalette[idx % treePalette.length]));
    colliders.push({
      cx: tx,
      cz: tz,
      halfW: 0.42 * sc,
      halfD: 0.42 * sc,
      rotY: 0,
      minY: ty - 0.3,
      maxY: ty + 4.4 * sc,
      tag: 'tree-trunk',
    });
  });
  treeTrunkInst.count = treeCoords.length;
  treeCanopyInst.count = treeCoords.length;
  treeTrunkInst.computeBoundingSphere();
  treeCanopyInst.computeBoundingSphere();
  if (treeCanopyInst.instanceColor) treeCanopyInst.instanceColor.needsUpdate = true;
  if (treeCoords.length > 0) {
    scene.add(treeTrunkInst, treeCanopyInst);
    obstacleMeshes.push(treeTrunkInst);
  }

  // Lightweight Tactical Low Bushes
  const bushGeo = new THREE.SphereGeometry(0.9, 7, 5);
  bushGeo.scale(1.2, 0.72, 1.0);
  bushGeo.translate(0, 0.42, 0);
  const bushInst = new THREE.InstancedMesh(bushGeo, foliageMat, 180);
  let placedBushes = 0;
  for (let i = 0; i < 320 && placedBushes < 180; i++) {
    const a = i * 2.71;
    const r = 45 + ((i * 71) % 780);
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    const by = sampleGroundHeight(bx, bz);
    if (by < 1.1 || !isClearOfPoiAndRoads(bx, bz, 11)) continue;
    dummy.position.set(bx, by, bz);
    dummy.rotation.set(0, i * 0.8, 0);
    const bs = 0.88 + (i % 4) * 0.2;
    dummy.scale.set(bs, bs, bs);
    dummy.updateMatrix();
    bushInst.setMatrixAt(placedBushes, dummy.matrix);
    bushInst.setColorAt(placedBushes, tmpColor.setHex(i % 2 === 0 ? 0x649440 : 0x76a64c));
    placedBushes++;
  }
  bushInst.count = placedBushes;
  bushInst.computeBoundingSphere();
  if (bushInst.instanceColor) bushInst.instanceColor.needsUpdate = true;
  scene.add(bushInst);

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

  // Spawn 12 Drivable Vehicles AFTER staticColliderCount so vehicle colliders stay in dynamic range
  const vehicleSpecs: Array<{ id: string; kind: VehicleKind; x: number; z: number; rotY: number }> = [
    { id: 'veh_0', kind: 'jeep', x: 190, z: 324, rotY: -0.85 },
    { id: 'veh_1', kind: 'jeep', x: -135, z: -34, rotY: 0.55 },
    { id: 'veh_2', kind: 'sport', x: -15, z: 146, rotY: 0.05 },
    { id: 'veh_3', kind: 'jeep', x: 480, z: -202, rotY: -1.2 },
    { id: 'veh_4', kind: 'sport', x: -336, z: -486, rotY: 0.35 },
    { id: 'veh_5', kind: 'jeep', x: -292, z: -182, rotY: 1.1 },
    { id: 'veh_6', kind: 'sport', x: 545, z: 505, rotY: -0.6 },
    { id: 'veh_7', kind: 'jeep', x: -340, z: 478, rotY: 0.8 },
    { id: 'veh_8', kind: 'sport', x: 256, z: -556, rotY: 1.4 },
    { id: 'veh_9', kind: 'jeep', x: 536, z: 82, rotY: -1.5 },
    { id: 'veh_10', kind: 'sport', x: -510, z: -230, rotY: 0.2 },
    { id: 'veh_11', kind: 'jeep', x: 180, z: -220, rotY: 2.1 },
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

  // 13. 50 Real Parachuting, Looting & Tactical Combat AI Bots!
  const BOT_NICKS = [
    'LuanPro_17', 'xX_Braga_Xx', 'Gabriel_07', 'YuriRush', 'CAPA_MESTRE',
    'Pedro_BR', 'BielCapa', 'Kauan_FF', 'Matheus_RJ', 'Davi_Gelo',
    'ViniTop1', 'LucasSniper', 'Arthur_X1', 'Marcos_99', 'HenriqueBR',
    'Rafael2017', 'Thiago_Pro', 'Caua_Rush', 'Enzo_Capa', 'FelipeZika',
    'GustavoBR', 'BrunoSertao', 'Diego_17', 'Natan_FF', 'Igor_Top10',
    'Samu_Sniper', 'Ruan_Mestre', 'Caio_Lenda', 'JoaoVitorBR', 'Léo_Bermuda',
    'Kleberson_X', 'Daniel_G18', 'Vitor_AWM', 'Renan_10', 'Kaio_Rush',
    'Murilo_FF', 'Elias_Safe', 'Mateus_01', 'Alisson_PRO', 'Wesley_BR',
    'Douglas_98', 'Andre_Capa', 'Luiz_Sniper', 'Junior_17', 'Thales_FF',
    'Fernando_X', 'Victor_BR', 'Otavio_2k', 'Fabricio_FF', 'Sandro_Pro',
  ];

  const landPois = POIS.filter(
    (p) => !p.name.startsWith('PONTE') && !p.name.startsWith('NUREK'),
  );
  const targets: TargetDummy[] = BOT_NICKS.map((nick, idx) => {
    const poi = landPois[idx % landPois.length];
    const ang = (idx * 2.399) % (Math.PI * 2);
    const dist = 16 + ((idx * 13) % 72);
    let lx = poi.x + Math.cos(ang) * dist;
    let lz = poi.z + Math.sin(ang) * dist;
    if (sampleGroundHeight(lx, lz) < 0.75) {
      lx = poi.x;
      lz = poi.z;
    }
    // Wait island spawn around Hangar (-345, -495)
    const waitX = -345 + Math.cos(idx * 0.7) * (10 + (idx % 5) * 4);
    const waitZ = -495 + Math.sin(idx * 0.7) * (10 + (idx % 5) * 4);
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
    bot.dropProgress = 0.06 + (idx / 50) * 0.82;
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
      lootDefs.push({
        x: p3.x,
        z: p3.z,
        yOverride: houseBaseY,
        kind: 'medkit',
        label: 'Kit Médico (+75 HP)',
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
        kind: idx % 2 === 0 ? 'medkit' : 'gloo',
        glooAmount: 2,
        label: idx % 2 === 0 ? 'Kit Médico (+75 HP)' : 'Parede de Gelo x2',
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
      kind: 'medkit',
      label: 'Kit Médico (+75 HP)',
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

  // Shared pooled geometries, prototypes & clean realistic materials for ALL ground loot assets (zero glow/ring/beam effects)
  const ammoCrateGeo = new THREE.BoxGeometry(0.46, 0.22, 0.28);
  const ammoStripGeo = new THREE.BoxGeometry(0.34, 0.06, 0.12);
  const medCaseGeo = new THREE.BoxGeometry(0.44, 0.18, 0.32);
  const medCrossHGeo = new THREE.BoxGeometry(0.18, 0.04, 0.06);
  const medCrossVGeo = new THREE.BoxGeometry(0.06, 0.04, 0.18);
  const medHandleGeo = new THREE.BoxGeometry(0.16, 0.05, 0.05);
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
  const fragBodyGeo = new THREE.SphereGeometry(0.15, 10, 8);
  fragBodyGeo.scale(0.9, 1.18, 0.9);
  const fragCapGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8);
  const lootCoinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12);
  lootCoinGeo.rotateZ(Math.PI / 2);
  const lootDeathGeo = new THREE.BoxGeometry(0.76, 0.42, 0.52);

  // Clean realistic PBR materials (zero emissive glow/bloom overhead)
  const matAmmoOlive = new THREE.MeshStandardMaterial({ color: 0x3b442b, roughness: 0.68, metalness: 0.2 });
  const matGoldTrim = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.34, metalness: 0.72 });
  const matMedWhite = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.48, metalness: 0.05 });
  const matMedRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42 });
  const matDarkMetal = new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.38, metalness: 0.78 });
  const matLensBlue = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.18, metalness: 0.85 });
  const matGlooCyan = new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.38, metalness: 0.28 });
  const matGrenadeOlive = new THREE.MeshStandardMaterial({ color: 0x4d5d33, roughness: 0.55, metalness: 0.25 });
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
      const crate = new THREE.Mesh(ammoCrateGeo, matAmmoOlive);
      const strip = new THREE.Mesh(ammoStripGeo, matGoldTrim);
      strip.position.y = 0.125;
      itemRoot.add(crate, strip);
    } else if (ld.kind === 'coin') {
      const coin = new THREE.Mesh(lootCoinGeo, matGoldTrim);
      itemRoot.add(coin);
    } else if (ld.kind === 'medkit') {
      const box = new THREE.Mesh(medCaseGeo, matMedWhite);
      const crossH = new THREE.Mesh(medCrossHGeo, matMedRed);
      crossH.position.y = 0.1;
      const crossV = new THREE.Mesh(medCrossVGeo, matMedRed);
      crossV.position.y = 0.1;
      const handle = new THREE.Mesh(medHandleGeo, matMedRed);
      handle.position.set(0, 0.04, 0.17);
      itemRoot.add(box, crossH, crossV, handle);
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

    // Only the clean asset itself (no rings, no floor glow, no light beams)
    g.add(itemRoot);
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

  const loots: LootVisual[] = lootDefs.map((ld, idx) =>
    buildLootVisual({ ...ld, id: `loot_${idx}` }, false),
  );

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
  safeZoneMesh.scale.set(890, 1, 890);
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

  let structureCullDist = 440;

  const applyQuality = (quality: GraphicsQuality, isSoftwareGl: boolean) => {
    if (quality === 'low' || isSoftwareGl) {
      // SUAVE: sem sombra, visibilidade ampla e iluminação clara para enxergar o mapa inteiro
      texDistUniform.value = 95.0;
      fog.near = 280;
      fog.far = 780;
      structureCullDist = 300;
      bushInst.visible = false;
      sunLight.castShadow = false;
      sunLight.intensity = 1.8;
      hemi.intensity = 1.38;
      waterMat.roughness = 0.65;
      waterMat.metalness = 0.05;
      scene.environment = envMap;
      scene.environmentIntensity = 0.45;
    } else if (quality === 'medium') {
      // PADRÃO: sem sombra (evita manchas pretas), visão longa e fluida
      texDistUniform.value = 165.0;
      fog.near = 400;
      fog.far = 1050;
      structureCullDist = 440;
      bushInst.visible = true;
      sunLight.castShadow = false;
      sunLight.intensity = 1.9;
      hemi.intensity = 1.35;
      waterMat.roughness = 0.35;
      waterMat.metalness = 0.18;
      scene.environment = envMap;
      scene.environmentIntensity = 0.68;
    } else {
      // ULTRA: visão máxima do mapa com sombras suaves PCF e texturas nítidas
      texDistUniform.value = 260.0;
      fog.near = 540;
      fog.far = 1350;
      structureCullDist = 600;
      bushInst.visible = true;
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.intensity = 2.05;
      hemi.intensity = 1.28;
      waterMat.roughness = 0.18;
      waterMat.metalness = 0.32;
      scene.environment = envMap;
      scene.environmentIntensity = 1.0;
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
    lootRenderDist = 38,
  ) => {
    cloudGroup.rotation.y = elapsed * 0.0025;

    const cx = camPos ? camPos.x : 0;
    const cz = camPos ? camPos.z : 0;
    const cy = camPos ? camPos.y : 0;
    skyDome.position.set(cx, 0, cz);
    const renderMaxSq = lootRenderDist * lootRenderDist;
    const animMaxSq = 28 * 28;

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
        t.hitFlash = Math.max(0, t.hitFlash - dt * 5);
        if (t.bodyMat) {
          t.bodyMat.emissive.setRGB(t.hitFlash * 0.85, 0, 0);
        } else {
          t.hitMeshes.forEach((m) => {
            const mat = m.material as THREE.MeshStandardMaterial;
            if (mat && 'emissive' in mat) {
              mat.emissive.setRGB(t.hitFlash, 0, 0);
            }
          });
        }
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
    spawnDroppedLoot,
    clearDroppedLoots,
    applyQuality,
    updateDynamicProps,
    dispose,
  };
}
