import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ProceduralTextureSet } from './textures';
import {
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
  group: THREE.Group;
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
  gunMesh?: THREE.Mesh;
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
  medkits: number;
  healTimer: number;
  gloos: number;
  glooCooldown: number;
  revivingMateId: string | null;
  reviveTimer: number;
  huntTimer: number;
  airState: 'inPlane' | 'skydiving' | 'parachuting' | 'ground';
  dropProgress: number;
  landX: number;
  landZ: number;
  vy: number;
  aiState: 'roam' | 'loot' | 'combat' | 'heal' | 'revive';
  goalX: number;
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
  platforms: WalkablePlatform[];
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

export const POIS: PoiMarker[] = [
  { name: 'CLOCK TOWER', x: 0, z: -65, radius: 58 },
  { name: 'PEAK', x: 118, z: -145, radius: 52 },
  { name: 'BIMASAKTI STRIP', x: -5, z: 165, radius: 56 },
  { name: 'FACTORY', x: -175, z: -105, radius: 58 },
  { name: 'MILL LESTE', x: 255, z: -75, radius: 54 },
  { name: 'OBSERVATÓRIO', x: 135, z: -265, radius: 46 },
  { name: 'POCHINOK', x: 165, z: 225, radius: 56 },
  { name: 'SHIPYARD PORTO', x: -245, z: 215, radius: 56 },
  { name: 'KOTA TUA', x: -275, z: 22, radius: 56 },
  { name: 'MARS ELECTRIC', x: -25, z: 305, radius: 58 },
  { name: 'CAPETOWN', x: 305, z: 115, radius: 48 },
  { name: 'PISTA DE ESPERA', x: -215, z: -230, radius: 54 },
  { name: 'HANGAR NORTE', x: -105, z: -255, radius: 46 },
  { name: 'RIM NAM VILA', x: -330, z: 120, radius: 46 },
  { name: 'PONTE VELHA', x: 0, z: 52, radius: 28 },
  { name: 'PONTE LESTE', x: 195, z: 85.4, radius: 26 },
  { name: 'PONTE OESTE', x: -185, z: 18.5, radius: 26 },
];

export function riverCenterZ(x: number): number {
  return 52 + Math.sin(x * 0.009) * 34;
}

const BRIDGE_BANKS = [
  { x: 0, z: riverCenterZ(0), halfW: 11, len: 34, targetH: 2.75 },
  { x: 195, z: riverCenterZ(195), halfW: 10, len: 32, targetH: 2.75 },
  { x: -185, z: riverCenterZ(-185), halfW: 10, len: 32, targetH: 2.75 },
];

const COMPOUNDS = [
  { x: 0, z: -65, r: 50, targetH: 3.4 }, // Clock Tower
  { x: 118, z: -145, r: 42, targetH: 10.6 }, // Peak (high hilltop)
  { x: -5, z: 165, r: 48, targetH: 3.5 }, // Bimasakti Strip
  { x: -175, z: -105, r: 46, targetH: 3.4 }, // Factory
  { x: 255, z: -75, r: 44, targetH: 4.2 }, // Mill Leste
  { x: 135, z: -265, r: 36, targetH: 12.2 }, // Observatório
  { x: 165, z: 225, r: 48, targetH: 3.7 }, // Pochinok
  { x: -245, z: 215, r: 46, targetH: 2.1 }, // Shipyard Porto
  { x: -275, z: 22, r: 46, targetH: 3.4 }, // Kota Tua
  { x: -25, z: 305, r: 48, targetH: 3.8 }, // Mars Electric
  { x: 305, z: 115, r: 36, targetH: 8.8 }, // Capetown
  { x: -215, z: -230, r: 48, targetH: 3.1 }, // Pista de Espera
  { x: -105, z: -255, r: 38, targetH: 3.6 }, // Hangar Norte
  { x: -330, z: 120, r: 36, targetH: 2.4 }, // Rim Nam Vila
];

export function sampleGroundHeight(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  const coastVariation = Math.sin(angle * 3) * 28 + Math.cos(angle * 5) * 17;
  const distFromCenter = Math.hypot(x, z);
  const effectiveEdge = 515 + coastVariation;
  const islandMask = THREE.MathUtils.smoothstep(effectiveEdge - distFromCenter, 0, 74);

  // Rolling rounded terrain relief + smooth organic undulations ("onduras")
  const n1 = Math.sin(x * 0.009) * Math.cos(z * 0.01) * 5.8;
  const n2 = Math.sin(x * 0.025 + 1.1) * Math.sin(z * 0.022 - 0.6) * 2.2;
  const wave =
    Math.sin(x * 0.045 + z * 0.032) * 0.95 +
    Math.cos(z * 0.038 - x * 0.028) * 0.72;
  const northRidge = Math.max(0, Math.sin((x * 0.55 - z) * 0.007)) * 7.2;
  const southHill =
    Math.exp(-((x + 85) * (x + 85) + (z - 190) * (z - 190)) / 6800) * 10.5;

  let h = (3.0 + n1 + n2 + wave + northRidge + southHill) * islandMask - (1 - islandMask) * 5.5;

  // Flatten bridge approach embankments before river channel carve
  for (let i = 0; i < BRIDGE_BANKS.length; i++) {
    const b = BRIDGE_BANKS[i];
    const dx = Math.abs(x - b.x);
    const dz = Math.abs(z - b.z);
    if (dx < b.halfW + 14 && dz < b.len + 16) {
      const bx = 1 - THREE.MathUtils.smoothstep(dx, b.halfW * 0.5, b.halfW + 14);
      const bz = 1 - THREE.MathUtils.smoothstep(dz, b.len * 0.55, b.len + 16);
      h = THREE.MathUtils.lerp(h, b.targetH, bx * bz);
    }
  }

  // River channel cutting East-West across the island
  const rz = riverCenterZ(x);
  const distRiver = Math.abs(z - rz);
  if (distRiver < 17 && distFromCenter < 495) {
    const carve = (1 - THREE.MathUtils.smoothstep(distRiver, 3.5, 17)) * 5.4;
    h -= carve;
  }

  // Flatten POI plateaus so structures sit cleanly on terrain
  for (let i = 0; i < COMPOUNDS.length; i++) {
    const c = COMPOUNDS[i];
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r + 22) {
      const blend = 1 - THREE.MathUtils.smoothstep(d, c.r * 0.7, c.r + 22);
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

function createEnterableHouse(
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  rotY: number,
  wallMat: THREE.Material,
  roofMat: THREE.Material,
  trimMat: THREE.Material,
  floorMat: THREE.Material,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): THREE.Group {
  const group = new THREE.Group();
  const y = sampleGroundHeight(x, z);
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const wallT = 0.28;
  const doorW = 1.7;
  const floorH = 0.24;

  // Interior floor & porch slab (only 1 mesh + merged walls + merged roof + merged trim = 4 draw calls total!)
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.3, floorH, d + 0.3),
    floorMat,
  );
  slab.position.y = floorH * 0.5;
  slab.receiveShadow = true;
  group.add(slab);

  platforms.push({
    cx: x,
    cz: z,
    halfW: (w + 0.3) * 0.5,
    halfD: (d + 0.3) * 0.5,
    rotY,
    topY: y + floorH,
    minY: y - 0.5,
  });

  const wallGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];

  const pushBox = (
    list: THREE.BufferGeometry[],
    lx: number,
    ly: number,
    lz: number,
    ww: number,
    wh: number,
    wd: number,
    rx = 0,
  ) => {
    const g = new THREE.BoxGeometry(ww, wh, wd);
    if (rx !== 0) g.rotateX(rx);
    g.translate(lx, ly, lz);
    list.push(g);
  };

  const addWallBox = (
    lx: number,
    ly: number,
    lz: number,
    ww: number,
    wh: number,
    wd: number,
    registerCollider = true,
    colliderTag = 'house-wall',
  ) => {
    pushBox(wallGeos, lx, ly, lz, ww, wh, wd);
    if (registerCollider) {
      addLocalObb(colliders, x, y, z, rotY, lx, lz, ww, wd, ly - wh * 0.5, ly + wh * 0.5, colliderTag);
    }
  };

  const baseH = floorH + h * 0.5;
  const winW = 1.65;
  const sillH = 0.92;
  const winOpenTop = 2.18;
  const headerH = Math.max(0.35, h - winOpenTop);

  // Back wall (-Z) with vaultable center window
  const backSideLen = Math.max(0.9, (w - winW) * 0.5);
  const backSideOff = winW * 0.5 + backSideLen * 0.5;
  addWallBox(-backSideOff, baseH, -d * 0.5 + wallT * 0.5, backSideLen, h, wallT);
  addWallBox(backSideOff, baseH, -d * 0.5 + wallT * 0.5, backSideLen, h, wallT);
  addWallBox(0, floorH + sillH * 0.5, -d * 0.5 + wallT * 0.5, winW, sillH, wallT, true, 'house-window-sill');
  addWallBox(0, floorH + winOpenTop + headerH * 0.5, -d * 0.5 + wallT * 0.5, winW, headerH, wallT, false);

  // Left & Right walls (-X / +X) with real vaultable windows
  const sideWallTotal = d - wallT * 2;
  const wingLen = Math.max(0.75, (sideWallTotal - winW) * 0.5);
  const wingOff = winW * 0.5 + wingLen * 0.5;
  [-1, 1].forEach((sideSign) => {
    const wx = sideSign * (w * 0.5 - wallT * 0.5);
    addWallBox(wx, baseH, -wingOff, wallT, h, wingLen);
    addWallBox(wx, baseH, wingOff, wallT, h, wingLen);
    addWallBox(wx, floorH + sillH * 0.5, 0, wallT, sillH, winW, true, 'house-window-sill');
    addWallBox(wx, floorH + winOpenTop + headerH * 0.5, 0, wallT, headerH, winW, false);
    pushBox(trimGeos, wx, floorH + sillH + 0.02, 0, 0.42, 0.08, winW + 0.1);
  });

  pushBox(trimGeos, 0, floorH + sillH + 0.02, -d * 0.5 + wallT * 0.5, winW + 0.1, 0.08, 0.42);

  // Front wall split around open doorway (+Z side)
  const sideSpan = Math.max(0.8, (w - doorW) * 0.5);
  const sideCenter = doorW * 0.5 + sideSpan * 0.5;
  addWallBox(-sideCenter, baseH, d * 0.5 - wallT * 0.5, sideSpan, h, wallT);
  addWallBox(sideCenter, baseH, d * 0.5 - wallT * 0.5, sideSpan, h, wallT);
  addWallBox(0, floorH + h - 0.45, d * 0.5 - wallT * 0.5, doorW, 0.9, wallT, false);

  pushBox(trimGeos, 0, 0.07, d * 0.5 + 0.45, 2.1, 0.14, 0.9);
  pushBox(trimGeos, -w * 0.22, floorH + 0.4, -d * 0.18, 1.4, 0.8, 0.8);
  addLocalObb(colliders, x, y, z, rotY, -w * 0.22, -d * 0.18, 1.4, 0.8, floorH, floorH + 0.9, 'interior-prop');

  // Pitched prism roof (merged into 1 roof draw call!)
  const roofPitch = 0.46;
  const roofSlopeLen = (d * 0.5 + 0.65) / Math.cos(roofPitch);
  const roofY = floorH + h + d * 0.13;
  pushBox(roofGeos, 0, roofY, -d * 0.25, w + 0.8, 0.16, roofSlopeLen, -roofPitch);
  pushBox(roofGeos, 0, roofY, d * 0.25, w + 0.8, 0.16, roofSlopeLen, roofPitch);
  pushBox(trimGeos, 0, roofY + Math.sin(roofPitch) * roofSlopeLen * 0.48, 0, w + 0.85, 0.2, 0.25);

  const wallGeoMerged = mergeGeometries(wallGeos, false);
  wallGeos.forEach((g) => g.dispose());
  const wallMesh = new THREE.Mesh(wallGeoMerged, wallMat);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  group.add(wallMesh);
  obstacleMeshes.push(wallMesh);

  const trimGeoMerged = mergeGeometries(trimGeos, false);
  trimGeos.forEach((g) => g.dispose());
  const trimMesh = new THREE.Mesh(trimGeoMerged, trimMat);
  trimMesh.receiveShadow = true;
  group.add(trimMesh);

  const roofGeoMerged = mergeGeometries(roofGeos, false);
  roofGeos.forEach((g) => g.dispose());
  const roofMesh = new THREE.Mesh(roofGeoMerged, roofMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);
  obstacleMeshes.push(roofMesh);

  return group;
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

  const rR = new THREE.Mesh(new THREE.BoxGeometry(slopeW, 0.16, d + 0.6), roofMat);
  rR.position.set(w * 0.25, slabH + h + 0.35, 0);
  rR.rotation.z = -pitch;
  rR.castShadow = true;
  rR.receiveShadow = true;
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
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 12.5, 10), concreteMat);
  shaft.position.y = 7.75;
  shaft.castShadow = true;
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
    wMesh.castShadow = true;
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
    medkits: 2,
    healTimer: 0,
    gloos: 2,
    glooCooldown: 0,
    revivingMateId: null,
    reviveTimer: 0,
    huntTimer: 1 + (idx % 4) * 0.6,
    airState: 'ground',
    dropProgress: 0.1 + (idx / 50) * 0.78,
    landX: x,
    landZ: z,
    vy: 0,
    aiState: 'roam',
    goalX: x,
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
  const skyGeo = new THREE.SphereGeometry(1450, 24, 16);
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cZenith = new THREE.Color(0x286bb5);
  const cMid = new THREE.Color(0x5da4e3);
  const cHorizon = new THREE.Color(0xb8dcf0);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp(y / 1450, 0, 1);
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
  return new THREE.Mesh(skyGeo, skyMat);
}

export function createIslandWorld(
  textures: ProceduralTextureSet,
  envMap: THREE.Texture,
): WorldHandle {
  const scene = new THREE.Scene();
  const horizonFogColor = new THREE.Color(0xa6cfe8);
  scene.background = horizonFogColor;
  const fog = new THREE.Fog(horizonFogColor, 230, 880);
  scene.fog = fog;
  scene.environment = envMap;

  const camera = new THREE.PerspectiveCamera(
    64,
    window.innerWidth / window.innerHeight,
    0.15,
    1600,
  );

  // Distant-Render Texture LOD uniform: strips detail texture past threshold while keeping geometry visible
  const texDistUniform = { value: 95.0 };
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
  scene.add(createSkyDome());

  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xf4f8fc,
    transparent: true,
    opacity: 0.72,
  });
  const cloudGeo = new THREE.SphereGeometry(14, 10, 7);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const rad = 540 + (i % 3) * 110;
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.set(Math.cos(a) * rad, 175 + (i % 4) * 18, Math.sin(a) * rad);
    cloud.rotation.y = a;
    cloud.scale.set(1.6 + (i % 3) * 0.5, 0.35 + (i % 2) * 0.14, 1.0);
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);

  // Warm / Cool Outdoor Daylight Rig
  const hemi = new THREE.HemisphereLight(0xa3d8ff, 0x6b583d, 0.9);
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight(0xfff2d6, 1.8);
  sunLight.position.set(110, 150, 85);
  sunLight.castShadow = true;
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
    // Main North-South Paved Highway (Clock Tower -> Ponte Velha -> Bimasakti Strip -> Mars Electric)
    { x1: 0, z1: -275, x2: 0, z2: 36, width: 8.4, kind: 'asphalt' },
    { x1: 0, z1: 68, x2: -5, z2: 165, width: 8.4, kind: 'asphalt' },
    { x1: -5, z1: 165, x2: -25, z2: 305, width: 8.0, kind: 'asphalt' },
    // West Highway Ring (Pista de Espera -> Factory -> Kota Tua -> Ponte Oeste -> Rim Nam -> Shipyard)
    { x1: -215, z1: -230, x2: -175, z2: -105, width: 7.2, kind: 'asphalt' },
    { x1: -175, z1: -105, x2: -275, z2: 22, width: 7.2, kind: 'asphalt' },
    { x1: -275, z1: 22, x2: -185, z2: 4, width: 7.2, kind: 'asphalt' },
    { x1: -185, z1: 35, x2: -245, z2: 215, width: 7.2, kind: 'asphalt' },
    { x1: -275, z1: 22, x2: -330, z2: 120, width: 5.8, kind: 'dirt' },
    { x1: -330, z1: 120, x2: -245, z2: 215, width: 5.8, kind: 'dirt' },
    // Cross-island West-to-Center & East-to-Center links
    { x1: -175, z1: -105, x2: 0, z2: -65, width: 7.2, kind: 'asphalt' },
    { x1: 0, z1: -65, x2: 255, z2: -75, width: 7.4, kind: 'asphalt' },
    // North Ring (Hangar Norte <-> Observatório <-> Peak <-> Clock Tower)
    { x1: -215, z1: -230, x2: -105, z2: -255, width: 6.4, kind: 'dirt' },
    { x1: -105, z1: -255, x2: 135, z2: -265, width: 6.4, kind: 'dirt' },
    { x1: 135, z1: -265, x2: 118, z2: -145, width: 6.2, kind: 'dirt' },
    { x1: 118, z1: -145, x2: 0, z2: -65, width: 6.6, kind: 'dirt' },
    { x1: 118, z1: -145, x2: 255, z2: -75, width: 6.2, kind: 'dirt' },
    // East Highway across Ponte Leste -> Capetown & Pochinok
    { x1: 255, z1: -75, x2: 195, z2: 69, width: 7.0, kind: 'asphalt' },
    { x1: 195, z1: 101, x2: 165, z2: 225, width: 7.0, kind: 'asphalt' },
    { x1: 195, z1: 101, x2: 305, z2: 115, width: 6.0, kind: 'dirt' },
    // Southern Ring (Shipyard <-> Mars Electric <-> Bimasakti <-> Pochinok)
    { x1: -245, z1: 215, x2: -25, z2: 305, width: 7.2, kind: 'asphalt' },
    { x1: -25, z1: 305, x2: 165, z2: 225, width: 6.8, kind: 'asphalt' },
    { x1: -5, z1: 165, x2: 165, z2: 225, width: 6.4, kind: 'dirt' },
  ];

  // 1. Large 1180m x 1180m Terrain Mesh (112x112 smooth rounded relief with crisp performance)
  const terrainGeo = new THREE.PlaneGeometry(1180, 1180, 112, 112);
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

    if (vy < 0.85) {
      tmpColor.copy(cSand);
    } else if (vy > 9.5) {
      tmpColor.copy(cPeak);
    } else if (vy > 5.0) {
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

  // 2. Ocean Water Plane with seamless animated wave ripples
  const waterMat = new THREE.MeshStandardMaterial({
    map: textures.waterWave,
    color: 0x3391bf,
    roughness: 0.22,
    metalness: 0.28,
  });
  applyDistanceTextureLod(waterMat, [0.24, 0.56, 0.76]);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.35;
  water.receiveShadow = true;
  scene.add(water);

  // 3. Distant Horizon Rounded Archipelago Islands
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x4b6875,
    roughness: 0.95,
    flatShading: false,
  });
  const mountainGeo = new THREE.SphereGeometry(86, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const mountainCount = 32;
  const mountains = new THREE.InstancedMesh(mountainGeo, mountainMat, mountainCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < mountainCount; i++) {
    const angle = (i / mountainCount) * Math.PI * 2;
    const rad = 690 + (i % 4) * 52;
    dummy.position.set(Math.cos(angle) * rad, -6, Math.sin(angle) * rad);
    dummy.rotation.y = i * 0.63;
    const sc = 0.85 + (i % 5) * 0.24;
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

      // Clip ribbon cleanly when dipping into river water outside bridge decks
      if (hC < 0.4 && riverDist < 14) {
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

  // Shared Architectural Materials (with distance texture LOD)
  const stuccoWallMat = new THREE.MeshStandardMaterial({
    map: textures.stuccoWall,
    roughness: 0.88,
  });
  applyDistanceTextureLod(stuccoWallMat, [0.8, 0.76, 0.68]);
  const woodWallMat = new THREE.MeshStandardMaterial({
    map: textures.woodPlank,
    roughness: 0.86,
  });
  applyDistanceTextureLod(woodWallMat, [0.54, 0.41, 0.28]);
  const shedMetalMat = new THREE.MeshStandardMaterial({
    map: textures.shedMetal,
    roughness: 0.58,
    metalness: 0.42,
  });
  applyDistanceTextureLod(shedMetalMat, [0.38, 0.41, 0.44]);
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roofTile,
    roughness: 0.78,
  });
  applyDistanceTextureLod(roofMat, [0.56, 0.24, 0.18]);
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x3b352f,
    roughness: 0.82,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    map: textures.concrete,
    color: 0x8a9096,
    roughness: 0.85,
  });
  applyDistanceTextureLod(concreteMat, [0.54, 0.56, 0.58]);
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x393f45,
    roughness: 0.45,
    metalness: 0.7,
  });
  const blueContainerMat = new THREE.MeshStandardMaterial({
    map: textures.containerBlue,
    roughness: 0.55,
    metalness: 0.45,
  });
  applyDistanceTextureLod(blueContainerMat, [0.15, 0.31, 0.41]);
  const rustContainerMat = new THREE.MeshStandardMaterial({
    map: textures.containerRust,
    roughness: 0.68,
    metalness: 0.35,
  });
  applyDistanceTextureLod(rustContainerMat, [0.48, 0.25, 0.16]);

  // 5. Bridges over the River (3 crossings aligned seamlessly with highways)
  const ponteVelhaZ = riverCenterZ(0);
  scene.add(
    createBridge(0, ponteVelhaZ, 9.6, 36, 2.75, 0, concreteMat, concreteMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: 0, z: ponteVelhaZ, w: 9.6, d: 36, rotY: 0, kind: 'bridge' });
  scene.add(
    createContainer(2.1, ponteVelhaZ - 3, 0.05, blueContainerMat, colliders, platforms, obstacleMeshes, 2.75 - sampleGroundHeight(2.1, ponteVelhaZ - 3)),
  );

  const ponteLesteZ = riverCenterZ(195);
  scene.add(
    createBridge(195, ponteLesteZ, 8.2, 34, 2.75, 0, woodWallMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: 195, z: ponteLesteZ, w: 8.2, d: 34, rotY: 0, kind: 'bridge' });

  const ponteOesteZ = riverCenterZ(-185);
  scene.add(
    createBridge(-185, ponteOesteZ, 8.2, 34, 2.75, 0, concreteMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: -185, z: ponteOesteZ, w: 8.2, d: 34, rotY: 0, kind: 'bridge' });

  // 5b. ICONIC FREE FIRE CLOCK TOWER LANDMARK at (0, -65)
  {
    const ctX = 0;
    const ctZ = -65;
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
    ctGroup.add(ctShaft);
    obstacleMeshes.push(ctShaft);

    const ctRoof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 4.4, 4), roofMat);
    ctRoof.position.y = 19.8;
    ctRoof.rotation.y = Math.PI / 4;
    ctGroup.add(ctRoof);

    // 4 Glowing Clock Faces
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

  // 6. 46 Enterable Houses across 14 Free Fire Cities & Compounds (cleanly offset from roads!)
  const houseSpecs: Array<[number, number, number, number, number, number, boolean]> = [
    // CLOCK TOWER (6 houses framing the plaza)
    [-22, -84, 8.8, 7.0, 3.4, 0.05, false],
    [22, -84, 9.0, 7.2, 3.5, -0.05, true],
    [-26, -42, 8.2, 6.8, 3.4, 1.55, false],
    [26, -42, 8.4, 6.8, 3.4, -1.55, true],
    [-38, -64, 8.0, 6.4, 3.3, 0.1, false],
    [38, -64, 8.0, 6.6, 3.4, 3.1, true],
    // PEAK (Hilltop Manor & 4 ridge houses)
    [118, -124, 11.5, 8.6, 4.2, 0.0, false],
    [94, -152, 8.2, 6.6, 3.3, 1.4, true],
    [142, -150, 8.4, 6.8, 3.4, -1.5, false],
    [116, -172, 8.6, 6.8, 3.4, 3.14, true],
    // BIMASAKTI STRIP (Street of 6 townhouses flanking main road x=-5)
    [-24, 146, 8.6, 6.8, 3.4, 1.57, false],
    [16, 146, 8.6, 6.8, 3.4, -1.57, true],
    [-24, 166, 8.2, 6.6, 3.4, 1.57, true],
    [16, 166, 8.8, 7.0, 3.5, -1.57, false],
    [-24, 186, 8.4, 6.8, 3.4, 1.57, false],
    [16, 186, 8.2, 6.6, 3.3, -1.57, true],
    // FACTORY (3 barracks/control houses near hangars)
    [-198, -88, 8.4, 6.6, 3.4, 0.2, false],
    [-156, -126, 8.0, 6.4, 3.3, -0.3, true],
    [-196, -124, 8.2, 6.6, 3.3, 1.5, false],
    // MILL LESTE (3 ridge houses overlooking hangars)
    [238, -96, 8.4, 6.6, 3.3, 0.1, false],
    [274, -92, 8.0, 6.4, 3.3, -0.4, true],
    [276, -54, 8.4, 6.6, 3.4, 2.9, false],
    // OBSERVATÓRIO NORTE
    [115, -252, 7.8, 6.2, 3.2, 0.35, false],
    [154, -250, 7.8, 6.2, 3.2, -0.35, true],
    // POCHINOK (Dense Southern Village of 5 houses)
    [146, 206, 8.6, 6.8, 3.4, 0.15, false],
    [184, 208, 8.8, 7.0, 3.5, -0.2, true],
    [144, 242, 8.2, 6.6, 3.3, 1.5, true],
    [186, 242, 9.2, 7.4, 3.6, -1.5, false],
    [165, 256, 8.4, 6.6, 3.4, 3.1, true],
    // SHIPYARD PORTO
    [-268, 198, 8.2, 6.4, 3.3, 0.1, false],
    [-216, 232, 8.4, 6.6, 3.3, -0.25, true],
    // KOTA TUA (West Town Square)
    [-292, 6, 8.8, 7.0, 3.4, 0.1, false],
    [-254, 4, 8.2, 6.6, 3.3, -0.2, true],
    [-292, 38, 8.0, 6.4, 3.3, 1.55, true],
    [-254, 38, 8.6, 6.8, 3.4, -1.5, false],
    // MARS ELECTRIC (Southern Compound)
    [-48, 288, 9.0, 7.2, 3.5, 0.05, false],
    [4, 288, 9.0, 7.2, 3.5, -0.05, false],
    [-46, 324, 8.4, 6.6, 3.4, 3.1, true],
    // CAPETOWN
    [295, 98, 8.0, 6.4, 3.3, 0.45, true],
    [318, 132, 8.2, 6.4, 3.3, -0.5, false],
    // PISTA DE ESPERA & HANGAR NORTE
    [-236, -214, 8.4, 6.6, 3.3, 0.2, false],
    [-194, -242, 8.0, 6.4, 3.2, -0.3, true],
    [-86, -244, 8.2, 6.6, 3.3, 0.1, false],
    // RIM NAM VILA (Beachside stilt/wood village)
    [-345, 106, 7.8, 6.2, 3.2, 0.4, true],
    [-316, 136, 7.8, 6.2, 3.2, -0.3, true],
    [-346, 138, 7.6, 6.0, 3.2, 1.5, true],
  ];

  houseSpecs.forEach(([hx, hz, hw, hd, hh, hrot, isWood]) => {
    const houseObj = createEnterableHouse(
      hx,
      hz,
      hw,
      hd,
      hh,
      hrot,
      isWood ? woodWallMat : stuccoWallMat,
      roofMat,
      trimMat,
      concreteMat,
      colliders,
      platforms,
      obstacleMeshes,
    );
    scene.add(houseObj);
    cullableStructures.push({ obj: houseObj, x: hx, z: hz, radiusScale: 1.0 });
    buildings.push({
      x: hx,
      z: hz,
      w: hw,
      d: hd,
      rotY: hrot,
      kind: isWood ? 'shed' : 'house',
    });
  });

  // 7. Industrial Sheds & Hangars (Factory, Mill, Mars Electric, Shipyard, Hangar Norte, Pista)
  const shedSpecs: Array<[number, number, number, number, number, number]> = [
    [-176, -106, 13.0, 18.5, 5.2, 0.0], // Giant Factory Main Hangar
    [-196, -106, 10.5, 14.5, 4.6, 0.0], // Factory Wing 2
    [250, -60, 11.5, 16.5, 4.8, 0.0], // Mill Hangar 1
    [266, -86, 10.8, 15.0, 4.6, 1.57], // Mill Hangar 2
    [-220, -210, 11.0, 15.5, 4.6, 0.0], // Pista Hangar
    [-112, -264, 11.5, 16.0, 4.8, 1.57], // Hangar Norte
    [-234, 194, 10.5, 14.5, 4.4, 0.3], // Shipyard Warehouse
    [-22, 318, 12.5, 17.5, 5.0, 1.57], // Mars Electric Hangar
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
  });

  // Concrete Airstrip Runway at Pista de Espera
  const runwayY = sampleGroundHeight(-215, -238);
  const runway = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.16, 66),
    concreteMat,
  );
  runway.position.set(-215, runwayY + 0.04, -242);
  runway.receiveShadow = true;
  scene.add(runway);
  platforms.push({
    cx: -215,
    cz: -242,
    halfW: 6,
    halfD: 33,
    rotY: 0,
    topY: runwayY + 0.12,
    minY: runwayY - 1,
  });

  // 8. SHIPYARD PORTO (Dock Pier + Stacked Shipping Containers across Porto/Factory/Mill/Mars)
  const pierY = 2.2;
  const pier = new THREE.Mesh(new THREE.BoxGeometry(34, 0.6, 20), concreteMat);
  pier.position.set(-254, pierY - 0.3, 224);
  pier.receiveShadow = true;
  scene.add(pier);
  platforms.push({
    cx: -254,
    cz: 224,
    halfW: 17,
    halfD: 10,
    rotY: 0,
    topY: pierY,
    minY: 0,
  });

  const containerSpecs: Array<[number, number, number, boolean, number]> = [
    [-242, 214, 0.05, true, 0],
    [-246, 214, 0.05, false, 0],
    [-244, 214, 0.05, true, 2.7],
    [-232, 222, 1.5, false, 0],
    [-258, 204, -0.35, true, 0],
    [-226, 204, 0.15, false, 0],
    [-166, -98, 0.2, true, 0],
    [-184, -120, 1.57, false, 0],
    [244, -74, 0.4, true, 0],
    [258, -94, 1.57, false, 0],
    [-30, 294, 0.0, true, 0],
    [-12, 294, 0.0, false, 0],
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

  // 9. Watchtowers (Observatório + Capetown + Mars Electric + Peak)
  const wtCoords: Array<[number, number]> = [
    [135, -265],
    [308, 120],
    [-32, 312],
    [104, -138],
  ];
  wtCoords.forEach(([wx, wz]) => {
    const wt = createWatchTowerLOD(wx, wz, concreteMat, steelMat, colliders, obstacleMeshes);
    scene.add(wt);
    cullableStructures.push({ obj: wt, x: wx, z: wz, radiusScale: 1.25 });
    buildings.push({ x: wx, z: wz, w: 7.2, d: 7.2, rotY: 0, kind: 'tower' });
  });

  // 10. Drivable Vehicles across Roads & POIs + 8 Vending Machines (Lojinhas)
  const vehicleSpecs: Array<{ id: string; kind: VehicleKind; x: number; z: number; rotY: number }> = [
    { id: 'veh_0', kind: 'jeep', x: 160, z: 214, rotY: -0.85 },
    { id: 'veh_1', kind: 'jeep', x: -12, z: -46, rotY: 0.55 },
    { id: 'veh_2', kind: 'sport', x: -5, z: 146, rotY: 0.05 },
    { id: 'veh_3', kind: 'jeep', x: 240, z: -68, rotY: -1.2 },
    { id: 'veh_4', kind: 'sport', x: -206, z: -220, rotY: 0.35 },
    { id: 'veh_5', kind: 'jeep', x: -272, z: 24, rotY: 1.1 },
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

  const vendingSpecs: Array<{ id: string; x: number; z: number; rotY: number; label: string }> = [
    { id: 'vm_clock', x: 18, z: -62, rotY: -1.57, label: 'Lojinha Clock Tower' },
    { id: 'vm_peak', x: 108, z: -142, rotY: 0.4, label: 'Lojinha Peak' },
    { id: 'vm_bima', x: -16, z: 162, rotY: 1.57, label: 'Lojinha Bimasakti' },
    { id: 'vm_factory', x: -164, z: -108, rotY: -0.8, label: 'Lojinha Factory' },
    { id: 'vm_mill', x: 246, z: -80, rotY: 0.2, label: 'Lojinha Mill Leste' },
    { id: 'vm_pochinok', x: 156, z: 218, rotY: 0.6, label: 'Lojinha Pochinok' },
    { id: 'vm_ship', x: -238, z: 206, rotY: -0.5, label: 'Lojinha Shipyard' },
    { id: 'vm_mars', x: -16, z: 294, rotY: 0.0, label: 'Lojinha Mars Electric' },
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
    [-10, -65, 0],
    [10, -65, 0],
    [0, -48, 1.57],
    [0, -82, 1.57],
    [0, ponteVelhaZ + 11, 0.3],
    [0, ponteVelhaZ - 11, -0.25],
    [-5, 156, 0.2],
    [-5, 174, -0.2],
    [118, -136, 0.4],
    [130, -256, -0.6],
    [-242, 210, 0.5],
    [248, -72, 0.2],
    [-275, 22, 0.9],
    [-25, 295, 0.1],
    [-175, -96, 0.0],
    [162, 222, -0.3],
  ];
  const barrierGeo = new THREE.BoxGeometry(2.6, 1.15, 0.55);
  const barrierInst = new THREE.InstancedMesh(barrierGeo, concreteMat, barrierCoords.length);
  barrierInst.castShadow = true;
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
    [-206, -220, 0.2],
    [-204, -218, 0.7],
    [12, -58, 0.1],
    [-12, -72, 0.5],
    [252, -66, 0.4],
    [-236, 212, 0.2],
    [168, 228, -0.4],
    [128, -260, 0.3],
    [-268, 28, 0.4],
    [-20, 304, -0.2],
    [114, -142, 0.5],
    [-172, -112, 0.2],
    [-10, 162, -0.3],
    [0, 170, 0.4],
  ];
  const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const crateInst = new THREE.InstancedMesh(crateGeo, woodWallMat, crateCoords.length);
  crateInst.castShadow = true;
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
    [10, -64],
    [-14, -68],
    [122, -138],
    [110, -148],
    [-12, 158],
    [8, 172],
    [-168, -98],
    [-184, -114],
    [244, -66],
    [262, -80],
    [130, -258],
    [156, 218],
    [174, 232],
    [-238, 206],
    [-268, 18],
    [-18, 298],
    [-32, 308],
    [298, 112],
    [-212, -222],
    [-102, -252],
    [-332, 116],
    [2, ponteVelhaZ + 6],
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
  barrelInst.castShadow = true;
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

  // Classic Free Fire Launch Pads ("Lançadores") between major cities
  const launchPadSpecs: Array<[number, number, number, number, string]> = [
    [16, -65, 118, -145, 'LANÇADOR -> PEAK'],
    [104, -145, 0, -65, 'LANÇADOR -> CLOCK TOWER'],
    [-156, -102, 0, -65, 'LANÇADOR -> CLOCK TOWER'],
    [12, 166, 165, 225, 'LANÇADOR -> POCHINOK'],
    [244, -84, 118, -145, 'LANÇADOR -> PEAK'],
    [-35, 290, -245, 215, 'LANÇADOR -> SHIPYARD'],
    [135, -246, 255, -75, 'LANÇADOR -> MILL LESTE'],
    [-256, 20, -175, -105, 'LANÇADOR -> FACTORY'],
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

  // 12. ALL TREES REMOVED FOR MAXIMUM FPS & CLEAN FREE FIRE COMBAT SIGHTLINES!
  // Smooth Rounded Wavy Rocks & Boulders (lightweight InstancedMesh cover)
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
  applyDistanceTextureLod(rockMat, [0.49, 0.48, 0.45]);
  const isClearOfPoiAndRoads = (x: number, z: number): boolean => {
    const tooClosePoi = POIS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius * 0.72);
    if (tooClosePoi) return false;
    if (Math.abs(x) < 10 && Math.abs(z) < 310) return false;
    if (Math.abs(z - riverCenterZ(x)) < 18) return false;
    return true;
  };
  const rockList: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 190 && rockList.length < 130; i++) {
    const a = i * 1.77 + 0.5;
    const r = 46 + ((i * 47) % 415);
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r;
    const ry = sampleGroundHeight(rx, rz);
    if (ry < 0.4) continue;
    if (!isClearOfPoiAndRoads(rx, rz)) continue;
    const sc = 0.75 + (i % 5) * 0.32;
    rockList.push([rx, ry, rz, sc]);
  }
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockList.length);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;
  rockList.forEach(([rx, ry, rz, sc], idx) => {
    dummy.position.set(rx, ry + sc * 0.42, rz);
    dummy.rotation.set(idx * 0.4, idx * 0.9, idx * 0.2);
    dummy.scale.set(sc * 1.22, sc * 0.82, sc);
    dummy.updateMatrix();
    rockInst.setMatrixAt(idx, dummy.matrix);
    const shade = 0.72 + (idx % 4) * 0.08;
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

  // Lightweight Tactical Low Bushes (only visible on Medium/Ultra; zero heavy grass meshes)
  const bushGeo = new THREE.SphereGeometry(0.9, 7, 5);
  bushGeo.scale(1.2, 0.72, 1.0);
  bushGeo.translate(0, 0.42, 0);
  const foliageMat = new THREE.MeshStandardMaterial({
    map: textures.foliage,
    color: 0xffffff,
    roughness: 0.86,
  });
  applyDistanceTextureLod(foliageMat, [0.42, 0.58, 0.26]);
  const bushInst = new THREE.InstancedMesh(bushGeo, foliageMat, 110);
  let placedBushes = 0;
  for (let i = 0; i < 180 && placedBushes < 110; i++) {
    const a = i * 2.71;
    const r = 24 + ((i * 41) % 430);
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    const by = sampleGroundHeight(bx, bz);
    if (by < 1.1 || !isClearOfPoiAndRoads(bx, bz)) continue;
    dummy.position.set(bx, by, bz);
    dummy.rotation.set(0, i * 0.8, 0);
    const bs = 0.85 + (i % 4) * 0.18;
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

  const landPois = POIS.filter((p) => !p.name.startsWith('PONTE'));
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
    // Wait island spawn around Pista de Espera (-215, -230)
    const waitX = -215 + Math.cos(idx * 0.7) * (10 + (idx % 5) * 4);
    const waitZ = -230 + Math.sin(idx * 0.7) * (10 + (idx % 5) * 4);
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

  const interiorWeapons: WeaponId[] = ['m4a1', 'ump45', 'm1014', 'awm', 'm4a1', 'ump45'];
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
    lootDefs.push({
      x: sx - 1.8,
      z: sz - 2.2,
      yOverride: shedY,
      kind: 'weapon',
      weaponId: idx % 2 === 0 ? 'm4a1' : 'awm',
      label: idx % 2 === 0 ? 'Carabina M4-17' : 'Sniper AWM-17',
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

  // Shared pooled geometries & materials for ALL loot items (cuts GPU draw overhead dramatically)
  const lootBoxGeo = new THREE.BoxGeometry(0.54, 0.28, 0.38);
  const lootGlooGeo = new THREE.BoxGeometry(0.46, 0.56, 0.18);
  const lootDeathGeo = new THREE.BoxGeometry(0.76, 0.44, 0.52);
  const lootCylGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.44, 10);
  const lootCoinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 12);
  lootCoinGeo.rotateZ(Math.PI / 2);
  const lootSphereGeo = new THREE.SphereGeometry(0.24, 10, 8);
  const lootGrenadeGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const lootRingGeo = new THREE.RingGeometry(0.42, 0.54, 14);
  const lootDeathRingGeo = new THREE.RingGeometry(0.65, 0.85, 16);

  const lootMatCache = new Map<number, THREE.MeshStandardMaterial>();
  const ringMatCache = new Map<number, THREE.MeshBasicMaterial>();
  const getLootMat = (hex: number) => {
    let m = lootMatCache.get(hex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.42,
        metalness: 0.35,
        emissive: hex,
        emissiveIntensity: 0.28,
      });
      lootMatCache.set(hex, m);
    }
    return m;
  };
  const getRingMat = (hex: number) => {
    let m = ringMatCache.get(hex);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        color: hex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.68,
      });
      ringMatCache.set(hex, m);
    }
    return m;
  };

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
      deathLoot?: LootItem['deathLoot'];
      label: string;
    },
    isDynamic = false,
  ): LootVisual => {
    const g = new THREE.Group();
    const ly = ld.yOverride !== undefined ? ld.yOverride : sampleGroundHeight(ld.x, ld.z);
    g.position.set(ld.x, ly + 0.25, ld.z);

    const boxColor =
      ld.kind === 'coin'
        ? 0xfacc15
        : ld.kind === 'deathbox'
          ? 0xf59e0b
          : ld.kind === 'gloo'
            ? 0x22d3ee
            : ld.kind === 'grenade'
              ? 0x84cc16
              : ld.kind === 'medkit'
                ? 0xd93838
                : ld.kind === 'ammo'
                  ? 0xd69f2b
                  : ld.kind === 'scope'
                    ? 0x10b981
                    : ld.kind === 'vest'
                      ? 0x0ea5e9
                      : ld.kind === 'helmet'
                        ? 0x38bdf8
                        : ld.kind === 'backpack'
                          ? 0xf59e0b
                          : ld.kind === 'attachment'
                            ? 0xf43f5e
                            : ld.weaponId === 'awm'
                              ? 0xa855f7
                              : 0x3b82f6;

    const itemGeo =
      ld.kind === 'coin'
        ? lootCoinGeo
        : ld.kind === 'deathbox'
          ? lootDeathGeo
          : ld.kind === 'gloo'
            ? lootGlooGeo
            : ld.kind === 'grenade'
              ? lootGrenadeGeo
              : ld.kind === 'scope' || ld.kind === 'attachment'
                ? lootCylGeo
                : ld.kind === 'helmet'
                  ? lootSphereGeo
                  : lootBoxGeo;

    const itemMesh = new THREE.Mesh(itemGeo, getLootMat(boxColor));
    if (ld.kind === 'scope' || ld.kind === 'attachment') {
      itemMesh.rotation.z = Math.PI / 2;
    }
    const ring = new THREE.Mesh(
      ld.kind === 'deathbox' ? lootDeathRingGeo : lootRingGeo,
      getRingMat(boxColor),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.2;
    g.add(itemMesh, ring);
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
  safeZoneMesh.scale.set(500, 1, 500);
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

  let structureCullDist = 265;

  const applyQuality = (quality: GraphicsQuality, isSoftwareGl: boolean) => {
    if (quality === 'low' || isSoftwareGl) {
      // SUAVE: mínimo leve para celular fraco e PC fraco (render enxuto + textura curta)
      texDistUniform.value = 34.0;
      fog.near = 88;
      fog.far = 260;
      structureCullDist = 175;
      bushInst.visible = false;
      sunLight.castShadow = false;
      sunLight.shadow.mapSize.set(512, 512);
      sunLight.intensity = 1.48;
      hemi.intensity = 1.05;
      waterMat.roughness = 0.65;
      waterMat.metalness = 0.05;
      scene.environmentIntensity = 0.55;
    } else if (quality === 'medium') {
      // PADRÃO: equilibrado para celular intermediário com render otimizado
      texDistUniform.value = 68.0;
      fog.near = 145;
      fog.far = 430;
      structureCullDist = 265;
      bushInst.visible = true;
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.intensity = 1.78;
      hemi.intensity = 0.92;
      waterMat.roughness = 0.3;
      waterMat.metalness = 0.22;
      scene.environmentIntensity = 0.85;
    } else {
      // ULTRA: gráfico detalhado, sombra 2048, folhagem completa com culling distante
      texDistUniform.value = 122.0;
      fog.near = 205;
      fog.far = 640;
      structureCullDist = 390;
      bushInst.visible = true;
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(2048, 2048);
      sunLight.intensity = 2.05;
      hemi.intensity = 0.98;
      waterMat.roughness = 0.16;
      waterMat.metalness = 0.34;
      scene.environmentIntensity = 1.15;
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
    lootRenderDist = 80,
  ) => {
    cloudGroup.rotation.y = elapsed * 0.0025;
    textures.waterWave.offset.x = (elapsed * 0.028) % 1;
    textures.waterWave.offset.y = (elapsed * 0.016) % 1;
    safeZoneMat.opacity = 0.2 + Math.sin(elapsed * 2.5) * 0.05;

    const cx = camPos ? camPos.x : 0;
    const cz = camPos ? camPos.z : 0;
    const cy = camPos ? camPos.y : 0;
    const renderMaxSq = lootRenderDist * lootRenderDist;
    const animMaxSq = 55 * 55;

    // Distance-cull distant structures when on the ground (keep visible when skydiving/plane!)
    if (camPos) {
      const keepAllStructures = cy > 45;
      for (let i = 0; i < cullableStructures.length; i++) {
        const s = cullableStructures[i];
        if (keepAllStructures) {
          if (!s.obj.visible) s.obj.visible = true;
        } else {
          const maxR = structureCullDist * s.radiusScale;
          const dSq = (s.x - cx) * (s.x - cx) + (s.z - cz) * (s.z - cz);
          const vis = dSq <= maxR * maxR;
          if (s.obj.visible !== vis) {
            s.obj.visible = vis;
          }
        }
      }
    }

    for (let i = 0; i < loots.length; i++) {
      const l = loots[i];
      if (l.data.collected) continue;
      if (camPos) {
        const dSq = (l.data.x - cx) * (l.data.x - cx) + (l.data.z - cz) * (l.data.z - cz);
        const vis = dSq <= renderMaxSq;
        if (l.mesh.visible !== vis) {
          l.mesh.visible = vis;
        }
        if (!vis || dSq > animMaxSq) continue;
      }
      l.mesh.children[0].rotation.y = elapsed * 1.8 + i;
      l.mesh.children[0].position.y = Math.sin(elapsed * 3 + i) * 0.07;
    }
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.hitFlash > 0) {
        t.hitFlash = Math.max(0, t.hitFlash - dt * 5);
        t.hitMeshes.forEach((m) => {
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.emissive.setRGB(t.hitFlash, 0, 0);
        });
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
    platforms,
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
