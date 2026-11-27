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
  bodyMat?: THREE.MeshLambertMaterial;
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
  setAdaptiveDrawScale: (scale: number) => void;
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

const VENDING_CABINET_MAT = new THREE.MeshLambertMaterial({ color: 0x162231 });
const VENDING_TRIM_MAT = new THREE.MeshLambertMaterial({
  color: 0xf59e0b,
  emissive: 0xd97706,
  emissiveIntensity: 0.25,
});
const VENDING_SCREEN_MAT = new THREE.MeshLambertMaterial({
  color: 0x38bdf8,
  emissive: 0x0ea5e9,
  emissiveIntensity: 0.78,
});
const VENDING_BODY_GEO = new THREE.BoxGeometry(1.35, 2.3, 0.95);
const VENDING_SCREEN_GEO = new THREE.BoxGeometry(0.96, 1.02, 0.08);
const VENDING_MARQUEE_GEO = new THREE.BoxGeometry(1.42, 0.3, 1.02);
const VENDING_PILLAR_GEO = new THREE.BoxGeometry(0.12, 2.25, 1.0);
const VENDING_TRAY_GEO = new THREE.BoxGeometry(0.88, 0.34, 0.16);

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

  const body = new THREE.Mesh(VENDING_BODY_GEO, VENDING_CABINET_MAT);
  body.position.y = 1.15;
  body.castShadow = false;
  body.receiveShadow = false;
  body.userData.cullRoot = group;

  const screen = new THREE.Mesh(VENDING_SCREEN_GEO, VENDING_SCREEN_MAT);
  screen.position.set(0, 1.38, 0.47);

  const marquee = new THREE.Mesh(VENDING_MARQUEE_GEO, VENDING_TRIM_MAT);
  marquee.position.set(0, 2.38, 0);

  const pillarL = new THREE.Mesh(VENDING_PILLAR_GEO, VENDING_TRIM_MAT);
  pillarL.position.set(-0.66, 1.13, 0);
  const pillarR = new THREE.Mesh(VENDING_PILLAR_GEO, VENDING_TRIM_MAT);
  pillarR.position.set(0.66, 1.13, 0);

  const tray = new THREE.Mesh(VENDING_TRAY_GEO, VENDING_TRIM_MAT);
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

const VEH_SPORT_BODY_MAT = new THREE.MeshLambertMaterial({ color: 0x2563eb });
const VEH_JEEP_BODY_MAT = new THREE.MeshLambertMaterial({ color: 0x4b5336 });
const VEH_SPORT_ACCENT_MAT = new THREE.MeshLambertMaterial({ color: 0x111827 });
const VEH_JEEP_ACCENT_MAT = new THREE.MeshLambertMaterial({ color: 0x2b3022 });
const VEH_TIRE_MAT = new THREE.MeshLambertMaterial({ color: 0x18191d });
const VEH_RIM_MAT = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
const VEH_GLASS_MAT = new THREE.MeshLambertMaterial({
  color: 0x7dd3fc,
  transparent: true,
  opacity: 0.72,
});
const VEH_HEADLIGHT_MAT = new THREE.MeshLambertMaterial({
  color: 0xfef08a,
  emissive: 0xfacc15,
  emissiveIntensity: 0.6,
});
const VEH_CHAR_MAT = new THREE.MeshLambertMaterial({ color: 0x18181b });
const VEH_SMOKE_GEO = new THREE.SphereGeometry(0.42, 6, 5);
const VEH_SMOKE_ORANGE_MAT = new THREE.MeshBasicMaterial({
  color: 0xf97316,
  transparent: true,
  opacity: 0.72,
});
const VEH_SMOKE_DARK_MAT = new THREE.MeshBasicMaterial({
  color: 0x262626,
  transparent: true,
  opacity: 0.72,
});
const VEH_SPORT_HULL_GEO = new THREE.BoxGeometry(1.98, 0.62, 4.1);
const VEH_JEEP_HULL_GEO = new THREE.BoxGeometry(1.96, 0.74, 3.9);
const VEH_SPORT_HOOD_GEO = new THREE.BoxGeometry(1.82, 0.36, 1.45);
const VEH_JEEP_HOOD_GEO = new THREE.BoxGeometry(1.76, 0.44, 1.3);
const VEH_SPORT_CAB_GEO = new THREE.BoxGeometry(1.72, 0.62, 1.75);
const VEH_JEEP_CAB_GEO = new THREE.BoxGeometry(1.82, 0.84, 2.0);
const VEH_SPORT_WIND_GEO = new THREE.BoxGeometry(1.56, 0.45, 0.08);
const VEH_JEEP_WIND_GEO = new THREE.BoxGeometry(1.56, 0.55, 0.08);
const VEH_BUMPER_GEO = new THREE.BoxGeometry(1.94, 0.24, 0.22);
const VEH_HEADLIGHT_GEO = new THREE.BoxGeometry(0.28, 0.16, 0.08);
const VEH_SPOILER_GEO = new THREE.BoxGeometry(1.86, 0.1, 0.34);
const VEH_SPARE_TIRE_GEO = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 8);
VEH_SPARE_TIRE_GEO.rotateX(Math.PI / 2);
const VEH_SPORT_WHEEL_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
VEH_SPORT_WHEEL_GEO.rotateZ(Math.PI / 2);
const VEH_JEEP_WHEEL_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
VEH_JEEP_WHEEL_GEO.rotateZ(Math.PI / 2);
const VEH_SPORT_HUB_GEO = new THREE.CylinderGeometry(0.36 * 0.52, 0.36 * 0.52, 0.32, 8);
VEH_SPORT_HUB_GEO.rotateZ(Math.PI / 2);
const VEH_JEEP_HUB_GEO = new THREE.CylinderGeometry(0.42 * 0.52, 0.42 * 0.52, 0.32, 8);
VEH_JEEP_HUB_GEO.rotateZ(Math.PI / 2);
const VEH_WRECK_HULL_GEO = new THREE.BoxGeometry(1.94, 0.72, 3.85);
const VEH_WRECK_CAB_GEO = new THREE.BoxGeometry(1.74, 0.65, 1.85);

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

  const bodyMat = isSports ? VEH_SPORT_BODY_MAT : VEH_JEEP_BODY_MAT;
  const accentMat = isSports ? VEH_SPORT_ACCENT_MAT : VEH_JEEP_ACCENT_MAT;

  const hull = new THREE.Mesh(isSports ? VEH_SPORT_HULL_GEO : VEH_JEEP_HULL_GEO, bodyMat);
  hull.position.y = isSports ? 0.64 : 0.78;
  hull.castShadow = false;
  hull.receiveShadow = false;
  hull.userData.vehicleId = id;

  const hood = new THREE.Mesh(isSports ? VEH_SPORT_HOOD_GEO : VEH_JEEP_HOOD_GEO, bodyMat);
  hood.position.set(0, isSports ? 0.84 : 1.05, isSports ? 1.2 : 1.15);
  hood.castShadow = false;
  hood.userData.vehicleId = id;

  const cabin = new THREE.Mesh(
    isSports ? VEH_SPORT_CAB_GEO : VEH_JEEP_CAB_GEO,
    isSports ? accentMat : bodyMat,
  );
  cabin.position.set(0, isSports ? 1.2 : 1.52, isSports ? -0.35 : -0.52);
  cabin.castShadow = false;
  cabin.userData.vehicleId = id;

  const windshield = new THREE.Mesh(
    isSports ? VEH_SPORT_WIND_GEO : VEH_JEEP_WIND_GEO,
    VEH_GLASS_MAT,
  );
  windshield.position.set(0, isSports ? 1.22 : 1.54, isSports ? 0.54 : 0.46);
  windshield.rotation.x = isSports ? -0.35 : -0.18;

  const bumperF = new THREE.Mesh(VEH_BUMPER_GEO, accentMat);
  bumperF.position.set(0, 0.45, isSports ? 2.08 : 1.98);
  const bumperR = new THREE.Mesh(VEH_BUMPER_GEO, accentMat);
  bumperR.position.set(0, 0.48, isSports ? -2.08 : -1.98);

  const hlL = new THREE.Mesh(VEH_HEADLIGHT_GEO, VEH_HEADLIGHT_MAT);
  hlL.position.set(-0.68, isSports ? 0.72 : 0.86, isSports ? 2.06 : 1.96);
  const hlR = new THREE.Mesh(VEH_HEADLIGHT_GEO, VEH_HEADLIGHT_MAT);
  hlR.position.set(0.68, isSports ? 0.72 : 0.86, isSports ? 2.06 : 1.96);

  chassisGroup.add(hull, hood, cabin, windshield, bumperF, bumperR, hlL, hlR);

  if (isSports) {
    const spoiler = new THREE.Mesh(VEH_SPOILER_GEO, accentMat);
    spoiler.position.set(0, 1.28, -1.86);
    chassisGroup.add(spoiler);
  } else {
    const spareTire = new THREE.Mesh(VEH_SPARE_TIRE_GEO, VEH_TIRE_MAT);
    spareTire.position.set(0, 0.96, -2.02);
    chassisGroup.add(spareTire);
  }

  obstacleMeshes.push(hull, cabin);

  // Wheels + Front Steering Pivots
  const wheelRadius = isSports ? 0.36 : 0.42;
  const wheelGeo = isSports ? VEH_SPORT_WHEEL_GEO : VEH_JEEP_WHEEL_GEO;
  const hubGeo = isSports ? VEH_SPORT_HUB_GEO : VEH_JEEP_HUB_GEO;

  const buildWheelMesh = () => {
    const wMesh = new THREE.Mesh(wheelGeo, VEH_TIRE_MAT);
    wMesh.castShadow = false;
    const hub = new THREE.Mesh(hubGeo, VEH_RIM_MAT);
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
  for (let s = 0; s < 3; s++) {
    const sm = new THREE.Mesh(
      VEH_SMOKE_GEO,
      s === 0 ? VEH_SMOKE_ORANGE_MAT : VEH_SMOKE_DARK_MAT,
    );
    sm.position.set((s - 1) * 0.25, 1.35 + s * 0.42, 1.25);
    sm.visible = false;
    chassisGroup.add(sm);
    smokeMeshes.push(sm);
  }

  // Charred Wreck shown on 0 HP destruction
  const burnedGroup = new THREE.Group();
  burnedGroup.visible = false;
  const wreckedHull = new THREE.Mesh(VEH_WRECK_HULL_GEO, VEH_CHAR_MAT);
  wreckedHull.position.y = 0.45;
  wreckedHull.rotation.z = 0.04;
  wreckedHull.userData.vehicleId = id;
  const wreckedCab = new THREE.Mesh(VEH_WRECK_CAB_GEO, VEH_CHAR_MAT);
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
const BOT_SKIN_PALETTE = [0xd7a27e, 0xc98e6b, 0xe2b291, 0x9b684b];

const BOT_SHIRT_MATS = BOT_SHIRT_PALETTE.map((c) => new THREE.MeshLambertMaterial({ color: c }));
const BOT_PANTS_MATS = BOT_PANTS_PALETTE.map((c) => new THREE.MeshLambertMaterial({ color: c }));
const BOT_SKIN_MATS = BOT_SKIN_PALETTE.map((c) => new THREE.MeshLambertMaterial({ color: c }));
const BOT_VEST_MATS: Record<1 | 2 | 3, THREE.MeshLambertMaterial> = {
  1: new THREE.MeshLambertMaterial({ color: 0x4d5d3d }),
  2: new THREE.MeshLambertMaterial({ color: 0x2f3842 }),
  3: new THREE.MeshLambertMaterial({ color: 0x1c1f26 }),
};
const BOT_HELM_MATS: Record<1 | 2 | 3, THREE.MeshLambertMaterial> = {
  1: new THREE.MeshLambertMaterial({ color: 0x566444 }),
  2: new THREE.MeshLambertMaterial({ color: 0x2c343d }),
  3: new THREE.MeshLambertMaterial({ color: 0x181a1f }),
};
const BOT_CHEST_GEO = new THREE.CylinderGeometry(0.21, 0.17, 0.48, 8);
const BOT_HEAD_GEO = new THREE.SphereGeometry(0.14, 10, 8);
const BOT_THIGH_GEO = new THREE.CylinderGeometry(0.078, 0.064, 0.42, 6);
const BOT_SHIN_GEO = new THREE.CylinderGeometry(0.06, 0.046, 0.42, 6);
const BOT_ARM_GEO = new THREE.CylinderGeometry(0.052, 0.044, 0.25, 6);
const BOT_FOREARM_GEO = new THREE.CylinderGeometry(0.043, 0.036, 0.24, 6);
const BOT_PARACHUTE_GEO = new THREE.CylinderGeometry(1.45, 1.7, 1.0, 8, 1, true, 0, Math.PI);

const BOT_EMPTY_WEAPON_RECORD = {} as Record<WeaponId, THREE.Group>;
const BOT_SHARED_MUZZLE_GEO = new THREE.ConeGeometry(0.085, 0.24, 6);
const BOT_SHARED_MUZZLE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffc845,
  transparent: true,
  opacity: 0.92,
});
const BOT_BLOB_SHADOW_GEO = new THREE.PlaneGeometry(1.15, 1.15);
BOT_BLOB_SHADOW_GEO.rotateX(-Math.PI / 2);

function createBotEntity(
  id: string,
  nick: string,
  x: number,
  z: number,
  rotY: number,
  idx: number,
  sharedParachuteMat: THREE.Material,
  sharedBlobShadowMat: THREE.Material,
  weaponId: WeaponId,
  vestLevel: 0 | 1 | 2 | 3 = 0,
  helmetLevel: 0 | 1 | 2 | 3 = 0,
): TargetDummy {
  const group = new THREE.Group();
  const y = WAIT_LOBBY_ORIGIN.y;
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const pantsMat = BOT_PANTS_MATS[idx % BOT_PANTS_MATS.length];
  const bodyMat = BOT_SHIRT_MATS[idx % BOT_SHIRT_MATS.length];
  const headMat = BOT_SKIN_MATS[idx % BOT_SKIN_MATS.length];

  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  group.add(pelvis);

  const torso = new THREE.Group();
  torso.position.set(0, 0.08, 0);
  pelvis.add(torso);

  const chest = new THREE.Mesh(BOT_CHEST_GEO, bodyMat);
  chest.scale.set(1.06, 1, 0.68);
  chest.position.y = 0.24;
  chest.castShadow = false;
  chest.receiveShadow = false;
  chest.userData.targetId = id;
  torso.add(chest);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.48, 0);
  torso.add(headGroup);

  const head = new THREE.Mesh(BOT_HEAD_GEO, headMat);
  head.scale.set(0.94, 1.06, 0.98);
  head.position.y = 0.18;
  head.castShadow = false;
  head.receiveShadow = false;
  head.userData.targetId = id;
  head.userData.isHeadshot = true;
  headGroup.add(head);

  // Articulated legs with knees matching createProceduralCharacterRig
  const legLPivot = new THREE.Group();
  legLPivot.position.set(-0.095, -0.05, 0);
  pelvis.add(legLPivot);
  const legL = new THREE.Mesh(BOT_THIGH_GEO, pantsMat);
  legL.position.y = -0.21;
  legL.castShadow = false;
  legLPivot.add(legL);
  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.42, 0);
  legLPivot.add(leftKnee);
  const shinL = new THREE.Mesh(BOT_SHIN_GEO, pantsMat);
  shinL.position.y = -0.21;
  shinL.castShadow = false;
  leftKnee.add(shinL);

  const legRPivot = new THREE.Group();
  legRPivot.position.set(0.095, -0.05, 0);
  pelvis.add(legRPivot);
  const legR = new THREE.Mesh(BOT_THIGH_GEO, pantsMat);
  legR.position.y = -0.21;
  legR.castShadow = false;
  legRPivot.add(legR);
  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.42, 0);
  legRPivot.add(rightKnee);
  const shinR = new THREE.Mesh(BOT_SHIN_GEO, pantsMat);
  shinR.position.y = -0.21;
  shinR.castShadow = false;
  rightKnee.add(shinR);

  // Vest & Helmet (hidden visuals — compatibility proxies)
  const vestMat = BOT_VEST_MATS[(vestLevel || 1) as 1 | 2 | 3];
  const vestMesh = new THREE.Mesh(BOT_VEST_GEO, vestMat);
  vestMesh.scale.set(1.06, 1, 0.72);
  vestMesh.position.y = 0.24;
  vestMesh.visible = false;
  torso.add(vestMesh);

  const helmMat = BOT_HELM_MATS[(helmetLevel || 1) as 1 | 2 | 3];
  const helmetMesh = new THREE.Mesh(BOT_HELMET_GEO, helmMat);
  helmetMesh.position.y = 0.2;
  helmetMesh.visible = false;
  headGroup.add(helmetMesh);

  // Articulated arms with elbows matching createProceduralCharacterRig
  const armLPivot = new THREE.Group();
  armLPivot.position.set(-0.24, 0.42, 0);
  torso.add(armLPivot);
  const armL = new THREE.Mesh(BOT_ARM_GEO, bodyMat);
  armL.position.set(0, -0.125, 0);
  armLPivot.add(armL);
  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.25, 0);
  armLPivot.add(leftElbow);
  const forearmL = new THREE.Mesh(BOT_FOREARM_GEO, headMat);
  forearmL.position.set(0, -0.12, 0);
  leftElbow.add(forearmL);

  const armRPivot = new THREE.Group();
  armRPivot.position.set(0.24, 0.42, 0);
  torso.add(armRPivot);
  const armR = new THREE.Mesh(BOT_ARM_GEO, bodyMat);
  armR.position.set(0, -0.125, 0);
  armRPivot.add(armR);
  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.25, 0);
  armRPivot.add(rightElbow);
  const forearmR = new THREE.Mesh(BOT_FOREARM_GEO, headMat);
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
  const parachuteMesh = new THREE.Mesh(BOT_PARACHUTE_GEO, sharedParachuteMat);
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
  const contactShadow = new THREE.Mesh(BOT_BLOB_SHADOW_GEO, sharedBlobShadowMat);
  contactShadow.position.y = 0.022;
  contactShadow.castShadow = false;
  contactShadow.receiveShadow = false;
  group.add(contactShadow);

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
const BOT_PACK_MAT = new THREE.MeshLambertMaterial({
  color: 0x353b30,
});

export function upgradeBotsToAdam(
  targets: TargetDummy[],
  camoTexture: THREE.Texture,
  contactShadowTexture?: THREE.Texture,
): void {
  if (!isAdamAssetsLoaded()) return;

  const sharedParachuteGeo = BOT_PARACHUTE_GEO;
  const sharedParachuteMat = new THREE.MeshLambertMaterial({
    map: camoTexture,
    side: THREE.DoubleSide,
  });
  const sharedBlobMat = contactShadowTexture
    ? new THREE.MeshBasicMaterial({
        map: contactShadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.52,
      })
    : new THREE.MeshBasicMaterial({ visible: false });
  const armUpVec = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < targets.length; i++) {
    const bot = targets[i];
    if (bot.isAdam) continue;

    // Clean up initial procedural children without disposing module-level shared BOT_* geometries
    bot.rig?.dispose();
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

    // Share base Lambert material across all bots of the same modelId (massive draw/shader savings)
    let bodyMat: THREE.MeshLambertMaterial | undefined;
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (origMat && (origMat as THREE.MeshLambertMaterial).isMeshLambertMaterial && !bodyMat) {
        bodyMat = origMat as THREE.MeshLambertMaterial;
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
      BOT_VEST_MATS[(bot.vestLevel || 1) as 1 | 2 | 3],
    );
    vestMesh.scale.set(1.06, 1, 0.68);
    vestMesh.position.set(0, -0.02, 0.015);
    vestMesh.visible = false;
    spineMount.add(vestMesh);

    const helmetMesh = new THREE.Mesh(
      BOT_HELMET_GEO,
      BOT_HELM_MATS[(bot.helmetLevel || 1) as 1 | 2 | 3],
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
    const contactShadow = new THREE.Mesh(BOT_BLOB_SHADOW_GEO, sharedBlobMat);
    contactShadow.position.y = 0.022;
    contactShadow.castShadow = false;
    contactShadow.receiveShadow = false;
    bot.group.add(contactShadow);

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
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x555d52 });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xd19a2a });
  const propMat = new THREE.MeshLambertMaterial({ color: 0x1a1c1e });

  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.7, 16, 10),
    bodyMat,
  );
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = false;

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.5, 10), bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 9.7;

  const wing = new THREE.Mesh(new THREE.BoxGeometry(20, 0.45, 3.6), bodyMat);
  wing.position.set(0, 0.9, 1.2);
  wing.castShadow = false;

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
  const skyGeo = new THREE.SphereGeometry(240, 20, 12);
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cZenith = new THREE.Color(0x1565e6);
  const cMid = new THREE.Color(0x4fb8ff);
  const cHorizon = new THREE.Color(0xbfe9ff);
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
  _envMap?: THREE.Texture | null,
): WorldHandle {
  const scene = new THREE.Scene();
  const horizonFogColor = new THREE.Color(0xaadfff);
  scene.background = horizonFogColor;
  const fog = new THREE.Fog(horizonFogColor, 95, 185);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(
    64,
    window.innerWidth / window.innerHeight,
    0.15,
    210,
  );

  // Sky Dome + Instanced Horizon Clouds (1 Draw Call)
  const skyDome = createSkyDome();
  scene.add(skyDome);

  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xf7fbff,
    transparent: true,
    opacity: 0.75,
  });
  const cloudGeo = new THREE.SphereGeometry(16, 7, 5);
  const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, 14);
  cloudInst.frustumCulled = false;
  cloudInst.castShadow = false;
  cloudInst.receiveShadow = false;
  const cloudDummy = new THREE.Object3D();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rad = 700 + (i % 3) * 110;
    cloudDummy.position.set(Math.cos(a) * rad, 175 + (i % 3) * 18, Math.sin(a) * rad);
    cloudDummy.rotation.set(0, a, 0);
    cloudDummy.scale.set(1.7 + (i % 3) * 0.5, 0.36 + (i % 2) * 0.12, 1.05);
    cloudDummy.updateMatrix();
    cloudInst.setMatrixAt(i, cloudDummy.matrix);
  }
  cloudInst.instanceMatrix.needsUpdate = true;
  scene.add(cloudInst);

  // Classic Free Fire 2017 Bright Vibrant Daylight (Zero Dynamic Shadows)
  const hemi = new THREE.HemisphereLight(0xc2ebff, 0x99b856, 1.48);
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight(0xfff1c4, 1.88);
  sunLight.position.set(110, 150, 85);
  sunLight.castShadow = false;
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
  const bermudaOceanSkirtMat = new THREE.MeshLambertMaterial({
    map: textures.waterWave,
    color: 0x1b8ec4,
  });
  const bermudaOceanSkirt = new THREE.Mesh(
    new THREE.PlaneGeometry(4600, 4600),
    bermudaOceanSkirtMat,
  );
  bermudaOceanSkirt.rotation.x = -Math.PI / 2;
  bermudaOceanSkirt.position.y = BERMUDA_GLB_WATER_Y - 0.18;
  bermudaOceanSkirt.castShadow = false;
  bermudaOceanSkirt.receiveShadow = false;
  bermudaGroup.add(bermudaOceanSkirt);

  const dummy = new THREE.Object3D();
  const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.25, 8);
  const barrelMat = new THREE.MeshLambertMaterial({
    color: 0xdc2626,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.35,
  });
  const padBaseGeo = new THREE.CylinderGeometry(1.15, 1.35, 0.25, 12);
  const padPlateGeo = new THREE.BoxGeometry(1.3, 0.14, 1.6);
  const padBaseMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
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

  const sharedBotParachuteMat = new THREE.MeshLambertMaterial({
    map: textures.camoParachute,
    side: THREE.DoubleSide,
  });
  const sharedBotBlobMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.52,
  });

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
      sharedBotParachuteMat,
      sharedBotBlobMat,
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

  // Lightweight classic mobile materials matching reference loot items
  const matAmmoOlive = new THREE.MeshLambertMaterial({ color: 0x3b6345 });
  const matAmmoRed = new THREE.MeshLambertMaterial({ color: 0xa62626 });
  const matBeigeTan = new THREE.MeshLambertMaterial({ color: 0xcabca6 });
  const matGoldTrim = new THREE.MeshLambertMaterial({ color: 0xeab308 });
  const matMedOlive = new THREE.MeshLambertMaterial({ color: 0x525946 });
  const matMedWhite = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
  const matMedRed = new THREE.MeshLambertMaterial({ color: 0xc81e1e });
  const matDarkMetal = new THREE.MeshLambertMaterial({ color: 0x20242a });
  const matLensBlue = new THREE.MeshLambertMaterial({ color: 0x0ea5e9 });
  const matGlooCyan = new THREE.MeshLambertMaterial({ color: 0x0891b2 });
  const matGrenadeOlive = new THREE.MeshLambertMaterial({ color: 0x4b5346 });
  const matDeathCrate = new THREE.MeshLambertMaterial({ color: 0x6b4728 });
  const armorMatByLevel: Record<number, THREE.MeshLambertMaterial> = {
    1: new THREE.MeshLambertMaterial({ color: 0x4b5842 }),
    2: new THREE.MeshLambertMaterial({ color: 0x334155 }),
    3: new THREE.MeshLambertMaterial({ color: 0x181c24 }),
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
    new THREE.CircleGeometry(68, 28),
    new THREE.MeshLambertMaterial({ color: 0xe6eff6 }),
  );
  waitSnowBase.rotation.x = -Math.PI / 2;
  waitSnowBase.position.y = -0.04;
  waitSnowBase.receiveShadow = false;
  const waitSeaBase = new THREE.Mesh(
    new THREE.CircleGeometry(900, 28),
    new THREE.MeshLambertMaterial({ color: 0x1a749e }),
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
    new THREE.MeshLambertMaterial({ color: 0x3b3f45 }),
  );
  gladFloorPad.rotation.x = -Math.PI / 2;
  gladFloorPad.position.set(-15.5, 0.50, 0);
  gladFloorPad.receiveShadow = false;
  const gladOuterGround = new THREE.Mesh(
    new THREE.CircleGeometry(520, 28),
    new THREE.MeshLambertMaterial({ color: 0x262b30 }),
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

  // Group repeated static meshes sharing exact BufferGeometry + Material into THREE.InstancedMesh
  const batchRepeatedStaticMeshes = (root: THREE.Object3D): void => {
    root.updateMatrixWorld(true);
    const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map<
      string,
      { geo: THREE.BufferGeometry; mat: THREE.Material; meshes: THREE.Mesh[] }
    >();

    root.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return;
      const m = node as THREE.Mesh;
      if (!m.visible || (m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh) {
        return;
      }
      if (Array.isArray(m.material) || !m.material || !m.geometry) return;
      const key = `${m.geometry.uuid}:${m.material.uuid}`;
      let entry = groups.get(key);
      if (!entry) {
        entry = { geo: m.geometry, mat: m.material, meshes: [] };
        groups.set(key, entry);
      }
      entry.meshes.push(m);
    });

    const relMat = new THREE.Matrix4();
    groups.forEach((entry) => {
      if (entry.meshes.length < 2) return;
      const inst = new THREE.InstancedMesh(entry.geo, entry.mat, entry.meshes.length);
      inst.castShadow = false;
      inst.receiveShadow = false;
      inst.frustumCulled = true;
      for (let i = 0; i < entry.meshes.length; i++) {
        const m = entry.meshes[i];
        relMat.multiplyMatrices(invRoot, m.matrixWorld);
        inst.setMatrixAt(i, relMat);
        m.parent?.remove(m);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      root.add(inst);
    });
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
      waitLobbyGroup.add(lobbyModel);
      waitLobbyGroup.updateMatrixWorld(true);
      waitCollisionGrid.buildFromObject(lobbyModel);
      batchRepeatedStaticMeshes(lobbyModel);
    }

    if (assets.gladiadoresTemplate) {
      const gladModel = assets.gladiadoresTemplate.clone(true);
      gladiadoresGroup.add(gladModel);
      gladiadoresGroup.updateMatrixWorld(true);
      gladiadoresCollisionGrid.buildFromObject(gladModel);
      batchRepeatedStaticMeshes(gladModel);
    }

    if (assets.bermudaTemplate) {
      const bermudaModel = assets.bermudaTemplate.clone(true);
      bermudaGroup.add(bermudaModel);
      bermudaGroup.updateMatrixWorld(true);
      bermudaCollisionGrid.buildFromObject(bermudaModel);
      batchRepeatedStaticMeshes(bermudaModel);
      bermudaModel.updateMatrixWorld(true);

      // Collect discrete non-instanced structures/props in bermuda.glb for view-cone + distance culling
      bermudaCullables.length = 0;
      const cullBox = new THREE.Box3();
      const cullCenter = new THREE.Vector3();
      const cullSize = new THREE.Vector3();
      const NEVER_CULL_RE =
        /terrain|ground|water|ocean|sea|sky|cloud|highway|airport_road|p_road|road|runway/i;
      bermudaModel.traverse((node) => {
        if (!(node as THREE.Mesh).isMesh || (node as THREE.InstancedMesh).isInstancedMesh) return;
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
      bermudaBarrelInst.receiveShadow = false;
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

  let structureCullDist = 145;
  let baseFogNear = 92;
  let baseFogFar = 175;
  let baseCamFar = 200;
  let adaptiveDrawScale = 1.0;

  const setAdaptiveDrawScale = (scale: number) => {
    adaptiveDrawScale = THREE.MathUtils.clamp(scale, 0.6, 1.0);
  };

  const applyQuality = (
    quality: GraphicsQuality,
    isSoftwareGl: boolean,
    textureQuality?: TextureQuality,
    _shadowQuality?: ShadowQuality,
    _maxAnisotropy = 1,
  ) => {
    const resolvedTex: TextureQuality =
      textureQuality ?? (quality === 'low' ? 'low' : quality === 'high' ? 'ultra' : 'medium');

    textures.applyQuality(resolvedTex, 1);

    // Classic Free Fire 2017: zero shadow maps everywhere
    sunLight.castShadow = false;
    if (sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null;
    }

    if (quality === 'low' || isSoftwareGl) {
      baseFogNear = 64;
      baseFogFar = 136;
      baseCamFar = 158;
      structureCullDist = 110;
      sunLight.intensity = 1.85;
      hemi.intensity = 1.54;
      cloudMat.opacity = 0.62;
    } else if (quality === 'medium') {
      baseFogNear = 90;
      baseFogFar = 172;
      baseCamFar = 198;
      structureCullDist = 142;
      sunLight.intensity = 1.88;
      hemi.intensity = 1.48;
      cloudMat.opacity = 0.74;
    } else {
      baseFogNear = 112;
      baseFogFar = 212;
      baseCamFar = 242;
      structureCullDist = 175;
      sunLight.intensity = 1.94;
      hemi.intensity = 1.46;
      cloudMat.opacity = 0.82;
    }
    scene.environment = null;
    fog.near = baseFogNear * adaptiveDrawScale;
    fog.far = baseFogFar * adaptiveDrawScale;
    camera.far = baseCamFar * adaptiveDrawScale;
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
    cloudInst.rotation.y = elapsed * 0.0025;

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

    const scaledNear = baseFogNear * adaptiveDrawScale;
    const scaledFar = baseFogFar * adaptiveDrawScale;
    const scaledCamFar = baseCamFar * adaptiveDrawScale;
    const targetFogNear = isAirborne ? Math.max(scaledNear, 220) : scaledNear;
    const targetFogFar = isAirborne ? Math.max(scaledFar, 420) : scaledFar;
    const targetCamFar = isAirborne ? Math.max(scaledCamFar, 480) : scaledCamFar;
    if (Math.abs(fog.near - targetFogNear) > 0.5 || Math.abs(fog.far - targetFogFar) > 0.5) {
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

      const effectiveCullDist = structureCullDist * adaptiveDrawScale;
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
                effectiveCullDist,
                34,
              );
          if (b.obj.visible !== vis) {
            b.obj.visible = vis;
          }
        }
      }

      // Vehicles keep full physics/collision simulation regardless of visibility;
      // 50m 360-deg safety bubble + active driver guard prevents reverse/turning bugs.
      const vehCullR = effectiveCullDist + 24;
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
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.userData?.sharedWeaponAsset) return;
        if (m.geometry && !disposedGeos.has(m.geometry)) {
          disposedGeos.add(m.geometry);
          m.geometry.dispose();
        }
        const disposeMat = (mat: THREE.Material) => {
          if (!mat || disposedMats.has(mat)) return;
          disposedMats.add(mat);
          if (mat.userData?.disposeMap && (mat as THREE.MeshLambertMaterial).map) {
            (mat as THREE.MeshLambertMaterial).map?.dispose();
          }
          mat.dispose();
        };
        if (Array.isArray(m.material)) {
          m.material.forEach(disposeMat);
        } else if (m.material) {
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
    setAdaptiveDrawScale,
    updateDynamicProps,
    dispose,
  };

  replaceInPlace(pois, bermudaPois);

  return handleRef;
}
