import * as THREE from 'three';
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
  shotSeq?: number;
  lastShotAtElapsed?: number;
  netIsSprinting?: boolean;
  netIsAiming?: boolean;
  netIsFiring?: boolean;
  netIsReloading?: boolean;
  netIsHealing?: boolean;
  netIsReviving?: boolean;
  netIsDying?: boolean;
  netLastShotSeq?: number;
  netTurnDeltaRad?: number;
  netPrevYaw?: number;
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
  damageDealt: number;
  healingDone: number;
  survivalSec: number;
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
  aiState: 'roam' | 'loot' | 'combat' | 'heal' | 'revive' | 'shop';
  shopTimer?: number;
  shopCooldown?: number;
  targetVendingId?: string | null;
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
  netDriverAccountId?: number | null;
  netPassengerAccountIds?: number[];
  netTarget?: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    speed: number;
    hp: number;
    destroyed: boolean;
    driverAccountId: number | null;
    updatedAtMs: number;
  } | null;
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
    maxAnisotropy?: number,
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
  minZ: GLADIADORES_ORIGIN.z - 21.0,
  maxZ: GLADIADORES_ORIGIN.z + 21.0,
} as const;

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
  const y = groundYOverride !== undefined ? groundYOverride : BERMUDA_GLB_WATER_Y;
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
  const y = groundYOverride !== undefined ? groundYOverride : BERMUDA_GLB_WATER_Y;

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
  const y = WAIT_LOBBY_ORIGIN.y;
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
    damageDealt: 0,
    healingDone: 0,
    survivalSec: 0,
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
    shopTimer: 0,
    shopCooldown: 0,
    targetVendingId: null,
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
          mesh.position.set(0.004, 0.016, 0.062);
        } else {
          mesh.position.set(0, 0, 0.02);
        }
        bot.handWeaponMeshes[activeWeaponId] = mesh;
        bot.gunMesh.add(mesh);
      }
      mesh.visible = true;
    }
    bot.activeHandWeaponId = activeWeaponId;
    if (bot.rig) {
      bot.rig.activeWeaponId = activeWeaponId ?? undefined;
    }
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
const BOT_CHEST_PROXY_GEO = new THREE.BoxGeometry(0.52, 0.56, 0.36);
const BOT_HEAD_PROXY_GEO = new THREE.BoxGeometry(0.36, 0.36, 0.36);
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
    const adamSpineBaseBone = cloned.getObjectByName('mixamorigSpine') ?? adamPelvisBone;
    const adamSpineBone = cloned.getObjectByName('mixamorigSpine1') ?? adamSpineBaseBone;
    const adamSpine2Bone = cloned.getObjectByName('mixamorigSpine2') ?? adamSpineBone;
    const spineBone = adamSpine2Bone ?? adamSpineBone ?? cloned;
    const headBone = cloned.getObjectByName('mixamorigHead') ?? spineBone;
    const handRBone = cloned.getObjectByName('mixamorigRightHand') ?? spineBone;
    const adamThighLBone = cloned.getObjectByName('mixamorigLeftUpLeg') ?? null;
    const adamThighRBone = cloned.getObjectByName('mixamorigRightUpLeg') ?? null;
    const adamShinLBone = cloned.getObjectByName('mixamorigLeftLeg') ?? null;
    const adamShinRBone = cloned.getObjectByName('mixamorigRightLeg') ?? null;
    const adamLeftShoulderBone = cloned.getObjectByName('mixamorigLeftShoulder') ?? null;
    const adamRightShoulderBone = cloned.getObjectByName('mixamorigRightShoulder') ?? null;
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
    chestHit.position.set(0, -0.08, 0);
    chestHit.userData.targetId = bot.id;
    spineMount.add(chestHit);

    const headHit = new THREE.Mesh(BOT_HEAD_PROXY_GEO, BOT_HIT_PROXY_MAT);
    headHit.position.set(0, pack.helmetOffsetY + 0.005, 0.01);
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
      adamSpineBaseBone,
      adamSpineBone,
      adamSpine2Bone,
      adamHeadBone: headBone,
      adamHandRBone: handRBone,
      adamThighLBone,
      adamThighRBone,
      adamShinLBone,
      adamShinRBone,
      adamLeftShoulderBone,
      adamRightShoulderBone,
      adamUpperArmLBone,
      adamUpperArmRBone,
      adamLowerArmLBone,
      adamHandLBone,
      adamLowerArmRBone,
      adamUpperBones: upperAimBones,
      activeWeaponId: bot.weaponId,
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
      setWeapon: (weaponId: WeaponId | null) => {
        rig.activeWeaponId = weaponId ?? undefined;
      },
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

  // Distant-Render Texture Blur LOD uniform: preserves normal textures at all distances with soft optical blur
  const texDistUniform = { value: 64.0 };
  let currentGlbAniso = 4;
  const glbTextures = new Set<THREE.Texture>();

  const applyDistanceTextureLod = (
    mat: THREE.MeshStandardMaterial,
    _flatRgb?: [number, number, number],
  ) => {
    void _flatRgb;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTexMaxDist = texDistUniform;
      shader.fragmentShader = 'uniform float uTexMaxDist;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          float texBlurFade = smoothstep(uTexMaxDist * 0.44, uTexMaxDist * 1.15, length(vViewPosition));
          float mipBias = texBlurFade * 2.25;
          vec2 blurStep = vec2(0.0055) * texBlurFade;
          vec4 blurSample = (
            texture2D( map, vMapUv + vec2( blurStep.x, 0.0), mipBias ) +
            texture2D( map, vMapUv + vec2(-blurStep.x, 0.0), mipBias ) +
            texture2D( map, vMapUv + vec2(0.0,  blurStep.y), mipBias ) +
            texture2D( map, vMapUv + vec2(0.0, -blurStep.y), mipBias )
          ) * 0.25;
          #ifdef DECODE_VIDEO_TEXTURE
            sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
            blurSample = sRGBTransferEOTF( blurSample );
          #endif
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, blurSample.rgb, texBlurFade * 0.92);
          diffuseColor *= sampledDiffuseColor;
        #endif`,
      );
    };
    mat.customProgramCacheKey = () => 'proc-dist-blur-lod';
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
          glbTextures.add(mat.map);
          mat.map.generateMipmaps = true;
          mat.map.minFilter = THREE.LinearMipmapLinearFilter;
          mat.map.magFilter = THREE.LinearFilter;
          mat.map.anisotropy = currentGlbAniso;
          mat.map.needsUpdate = true;
        }
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uTexMaxDist = texDistUniform;
          shader.fragmentShader = 'uniform float uTexMaxDist;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              vec4 sampledDiffuseColor = texture2D( map, vMapUv );
              float texBlurFade = smoothstep(uTexMaxDist * 0.44, uTexMaxDist * 1.15, length(vViewPosition));
              float mipBias = texBlurFade * 2.05;
              vec2 blurStep = vec2(0.0018) * texBlurFade;
              vec4 blurSample = (
                texture2D( map, vMapUv + vec2( blurStep.x, 0.0), mipBias ) +
                texture2D( map, vMapUv + vec2(-blurStep.x, 0.0), mipBias ) +
                texture2D( map, vMapUv + vec2(0.0,  blurStep.y), mipBias ) +
                texture2D( map, vMapUv + vec2(0.0, -blurStep.y), mipBias )
              ) * 0.25;
              #ifdef DECODE_VIDEO_TEXTURE
                sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
                blurSample = sRGBTransferEOTF( blurSample );
              #endif
              sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, blurSample.rgb, texBlurFade * 0.92);
              diffuseColor *= sampledDiffuseColor;
            #endif`,
          );
        };
        mat.customProgramCacheKey = () => 'glb-dist-blur-lod';
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

  const bermudaGroup = new THREE.Group();
  bermudaGroup.visible = true;
  scene.add(bermudaGroup);

  const colliders: WorldObbCollider[] = [];
  const platforms: WalkablePlatform[] = [];
  const buildingNavZones: BuildingNavZone[] = [];
  const obstacleMeshes: THREE.Object3D[] = [];
  const buildings: MinimapBuilding[] = [];
  const bermudaCullables: Array<{
    obj: THREE.Object3D;
    x: number;
    z: number;
    radius: number;
  }> = [];

  const roads: MinimapRoad[] = [];

  // Seamless surrounding tropical ocean skirt for Bermuda 3D map
  const bermudaOceanSkirtMat = new THREE.MeshStandardMaterial({
    map: textures.waterWave,
    color: 0x1680b0,
    roughness: 0.28,
    metalness: 0.18,
  });
  applyDistanceTextureLod(bermudaOceanSkirtMat);
  const bermudaOceanSkirt = new THREE.Mesh(
    new THREE.PlaneGeometry(4600, 4600),
    bermudaOceanSkirtMat,
  );
  bermudaOceanSkirt.rotation.x = -Math.PI / 2;
  bermudaOceanSkirt.position.y = BERMUDA_GLB_WATER_Y - 0.18;
  bermudaGroup.add(bermudaOceanSkirt);

  const dummy = new THREE.Object3D();
  const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.25, 8);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.42,
  });
  const padBaseGeo = new THREE.CylinderGeometry(1.15, 1.35, 0.25, 14);
  const padPlateGeo = new THREE.BoxGeometry(1.3, 0.14, 1.6);
  const padBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });
  const padGlowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

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
    if (bermudaAttached) {
      return bermudaCollisionGrid.sampleTerrainHeight(x, z, BERMUDA_GLB_WATER_Y);
    }
    return BERMUDA_GLB_WATER_Y + 0.35;
  };

  const queryStaticCollidersNear = (
    x: number,
    z: number,
    radius: number,
    out: WorldObbCollider[],
  ): void => {
    out.length = 0;
    const pad = radius + 1.5;
    for (let i = 0; i < bermudaStaticColliders.length; i++) {
      const c = bermudaStaticColliders[i];
      if (Math.abs(c.cx - x) <= pad && Math.abs(c.cz - z) <= pad) {
        out.push(c);
      }
    }
  };

  const findBuildingNavZoneAt = (x: number, z: number): BuildingNavZone | null => {
    for (let i = 0; i < bermudaBuildingNavZones.length; i++) {
      const nz = bermudaBuildingNavZones[i];
      if (Math.abs(x - nz.cx) <= nz.halfW + 0.5 && Math.abs(z - nz.cz) <= nz.halfD + 0.5) {
        return nz;
      }
    }
    return null;
  };

  const queryStaticPlatformsNear = (
    _x: number,
    _z: number,
    out: WalkablePlatform[],
  ): void => {
    out.length = 0;
  };

  const vehicles: VehicleEntity[] = [];

  // 13. 50 Real Parachuting, Looting & Classic Bot AI (51 total participants with player)
  const BOT_NICKS = [
    'LuanPro_17', 'xX_Braga_Xx', 'Gabriel_07', 'YuriRush', 'CAPA_MESTRE',
    'Pedro_BR', 'BielCapa', 'Kauan_FF', 'Matheus_X1', 'Davi_Gelo',
    'ViniTop1', 'LucasSniper', 'Arthur_X1', 'Marcos_99', 'HenriqueBR',
    'Rafael2017', 'Thiago_Pro', 'Caua_Rush', 'Enzo_Capa', 'FelipeZika',
    'Gustavo_BR', 'BrunoSertao', 'Diego_17', 'Natan_FF', 'Igor_Clock',
    'Samu_Sniper', 'Ruan_Mestre', 'Caio_Lenda', 'Vitor_Peak', 'Léo_Rush',
    'Erick_Bermuda', 'Murilo_BR', 'Breno_FF', 'Renan_18', 'DaniloRush',
    'Otavio_FF', 'NicolasCapa', 'Heitor_07', 'Eduardo_BR', 'Kaique_X1',
    'Bernardo_FF', 'Leandro2018', 'Wesley_Sertao', 'Fabricio_X1', 'AlexandreBR',
    'Emanuel_Top1', 'Samuel_M4', 'Guilherme_17', 'RodrigoCapa', 'Victor_Peak',
  ];

  const targets: TargetDummy[] = BOT_NICKS.map((nick, idx) => {
    const poi = bermudaPois[idx % bermudaPois.length];
    const ang = (idx * 2.399) % (Math.PI * 2);
    const dist = 12 + ((idx * 11) % 44);
    const lx = poi.x + Math.cos(ang) * dist;
    const lz = poi.z + Math.sin(ang) * dist;
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

  // 14. Comprehensive World Loot inside Bermuda Houses, Sheds, Containers, Towers & POIs
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
    const ly = ld.yOverride !== undefined ? ld.yOverride : groundHeightAt(ld.x, ld.z);
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

  const getActiveLootDefs = () => bermudaPendingLootDefs;

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
    const eb = bermudaExplosiveBarrels[idx];
    if (!eb || eb.exploded || !bermudaBarrelInst) return;
    eb.exploded = true;
    dummy.position.set(eb.x, -50, eb.z);
    dummy.scale.set(0.001, 0.001, 0.001);
    dummy.updateMatrix();
    bermudaBarrelInst.setMatrixAt(idx, dummy.matrix);
    bermudaBarrelInst.instanceMatrix.needsUpdate = true;
    const col = bermudaBarrelColliders[idx];
    if (col) {
      col.minY = -99;
      col.maxY = -98;
    }
  };

  const resetExplosiveBarrels = () => {
    if (!bermudaBarrelInst) return;
    for (let i = 0; i < bermudaExplosiveBarrels.length; i++) {
      const eb = bermudaExplosiveBarrels[i];
      eb.exploded = false;
      dummy.position.set(eb.x, eb.y, eb.z);
      dummy.rotation.set(0, i * 0.5, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bermudaBarrelInst.setMatrixAt(i, dummy.matrix);
      const col = bermudaBarrelColliders[i];
      if (col) {
        col.minY = eb.y - 0.625;
        col.maxY = eb.y + 0.655;
      }
    }
    bermudaBarrelInst.instanceMatrix.needsUpdate = true;
  };

  // 17. Electric Blue Shrinking Safe Zone Cylinder Wall
  const safeZoneGeo = new THREE.CylinderGeometry(1, 1, 240, 48, 1, true);
  const safeZoneMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.32,
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
    bermudaGroup.visible = true;
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
  };

  const setActiveBrMap = (_mapId: BrMapId) => {
    activeBrMap = 'bermuda';
    bermudaGroup.visible = true;
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
      // Keep large terrain/ground/road/ocean meshes always visible (handled by fog & soft-blur normal-texture LOD).
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

  let structureCullDist = 155;

  let baseFogNear = 102;
  let baseFogFar = 195;
  let baseCamFar = 230;

  const applyQuality = (
    quality: GraphicsQuality,
    isSoftwareGl: boolean,
    textureQuality?: TextureQuality,
    shadowQuality?: ShadowQuality,
    maxAnisotropy = 8,
  ) => {
    const resolvedTex: TextureQuality =
      textureQuality ?? (quality === 'low' ? 'low' : quality === 'high' ? 'ultra' : 'medium');
    const resolvedShadow: ShadowQuality = isSoftwareGl
      ? 'off'
      : (shadowQuality ?? (quality === 'low' ? 'off' : quality === 'high' ? 'high' : 'low'));

    const capAniso = Math.max(1, maxAnisotropy);
    currentGlbAniso =
      resolvedTex === 'low'
        ? Math.min(2, capAniso)
        : resolvedTex === 'medium'
          ? Math.min(4, capAniso)
          : resolvedTex === 'high'
            ? Math.min(8, capAniso)
            : Math.min(16, capAniso);

    textures.applyQuality(resolvedTex, capAniso);
    for (const tex of glbTextures) {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = currentGlbAniso;
      tex.needsUpdate = true;
    }

    // Distant texture-blur transition threshold (keeps normal texture softly blurred at range)
    texDistUniform.value =
      resolvedTex === 'low'
        ? 46.0
        : resolvedTex === 'medium'
          ? 64.0
          : resolvedTex === 'high'
            ? 84.0
            : 106.0;
    if (resolvedShadow === 'off') {
      sunLight.castShadow = false;
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
    }
    if (sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null;
    }

    if (quality === 'low' || isSoftwareGl) {
      baseFogNear = 70;
      baseFogFar = 148;
      baseCamFar = 175;
      structureCullDist = 115;
      sunLight.intensity = 1.95;
      hemi.intensity = 1.62;
      bermudaOceanSkirtMat.roughness = 0.72;
      bermudaOceanSkirtMat.metalness = 0.02;
      bermudaOceanSkirtMat.envMapIntensity = 0.4;
      cloudMat.opacity = 0.6;
      scene.environment = null;
      scene.environmentIntensity = 0;
    } else if (quality === 'medium') {
      baseFogNear = 102;
      baseFogFar = 195;
      baseCamFar = 230;
      structureCullDist = 155;
      sunLight.intensity = 1.98;
      hemi.intensity = 1.38;
      bermudaOceanSkirtMat.roughness = 0.32;
      bermudaOceanSkirtMat.metalness = 0.2;
      bermudaOceanSkirtMat.envMapIntensity = 0.9;
      cloudMat.opacity = 0.74;
      scene.environment = envMap;
      scene.environmentIntensity = 0.58;
    } else {
      baseFogNear = 132;
      baseFogFar = 245;
      baseCamFar = 285;
      structureCullDist = 195;
      sunLight.intensity = 2.24;
      hemi.intensity = 1.36;
      bermudaOceanSkirtMat.roughness = 0.12;
      bermudaOceanSkirtMat.metalness = 0.38;
      bermudaOceanSkirtMat.envMapIntensity = 1.35;
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

    const targetFogNear = isAirborne ? Math.max(baseFogNear, 240) : baseFogNear;
    const targetFogFar = isAirborne ? Math.max(baseFogFar, 460) : baseFogFar;
    const targetCamFar = isAirborne ? Math.max(baseCamFar, 520) : baseCamFar;
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
      if (bermudaAttached) {
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
      // 50m 360-deg safety bubble + active driver guard prevents reverse/turning bugs.
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
                50,
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
      v.netDriverAccountId = null;
      v.netPassengerAccountIds = [];
      v.netTarget = null;
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
    staticColliderCount: 0,
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

  replaceInPlace(pois, bermudaPois);

  return handleRef;
}
