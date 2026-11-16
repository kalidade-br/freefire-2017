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
  airState: 'inPlane' | 'skydiving' | 'parachuting' | 'ground';
  dropProgress: number;
  landX: number;
  landZ: number;
  vy: number;
  aiState: 'roam' | 'loot' | 'combat' | 'heal';
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
  { name: 'VILA CENTRAL', x: 0, z: -45, radius: 58 },
  { name: 'GALPÕES LESTE', x: 225, z: -45, radius: 55 },
  { name: 'PORTO CONTÊINER', x: -235, z: 205, radius: 56 },
  { name: 'OBSERVATÓRIO NORTE', x: 135, z: -245, radius: 48 },
  { name: 'FAZENDA SUL', x: 195, z: 220, radius: 55 },
  { name: 'POSTO DE ESPERA', x: -215, z: -205, radius: 58 },
  { name: 'CIDADE DO VALE', x: -260, z: 22, radius: 56 },
  { name: 'BASE MILITAR SUL', x: -20, z: 290, radius: 58 },
  { name: 'COLINA DO FAROL', x: 285, z: 115, radius: 48 },
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
  { x: 0, z: -45, r: 48, targetH: 3.3 }, // Vila Central
  { x: 225, z: -45, r: 45, targetH: 3.5 }, // Galpões Leste
  { x: -235, z: 205, r: 46, targetH: 2.1 }, // Porto Contêiner
  { x: 135, z: -245, r: 36, targetH: 12.2 }, // Observatório Norte (hilltop)
  { x: 195, z: 220, r: 45, targetH: 3.7 }, // Fazenda Sul
  { x: -215, z: -205, r: 52, targetH: 3.1 }, // Posto de Espera / Pista
  { x: -260, z: 22, r: 46, targetH: 3.4 }, // Cidade do Vale
  { x: -20, z: 290, r: 48, targetH: 3.8 }, // Base Militar Sul
  { x: 285, z: 115, r: 34, targetH: 9.8 }, // Colina do Farol
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

  // Interior floor & porch slab
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.3, floorH, d + 0.3),
    floorMat,
  );
  slab.position.y = floorH * 0.5;
  slab.receiveShadow = true;
  slab.castShadow = true;
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

  const makeWall = (
    lx: number,
    ly: number,
    lz: number,
    ww: number,
    wh: number,
    wd: number,
    mat: THREE.Material,
    registerCollider = true,
    colliderTag = 'house-wall',
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), mat);
    m.position.set(lx, ly, lz);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    obstacleMeshes.push(m);
    if (registerCollider) {
      addLocalObb(colliders, x, y, z, rotY, lx, lz, ww, wd, ly - wh * 0.5, ly + wh * 0.5, colliderTag);
    }
    return m;
  };

  const baseH = floorH + h * 0.5;
  const winW = 1.65;
  const sillH = 0.92;
  const winOpenTop = 2.18;
  const headerH = Math.max(0.35, h - winOpenTop);

  // Back wall (-Z) with vaultable center window
  const backSideLen = Math.max(0.9, (w - winW) * 0.5);
  const backSideOff = winW * 0.5 + backSideLen * 0.5;
  makeWall(-backSideOff, baseH, -d * 0.5 + wallT * 0.5, backSideLen, h, wallT, wallMat);
  makeWall(backSideOff, baseH, -d * 0.5 + wallT * 0.5, backSideLen, h, wallT, wallMat);
  makeWall(0, floorH + sillH * 0.5, -d * 0.5 + wallT * 0.5, winW, sillH, wallT, wallMat, true, 'house-window-sill');
  makeWall(0, floorH + winOpenTop + headerH * 0.5, -d * 0.5 + wallT * 0.5, winW, headerH, wallT, wallMat, false);

  // Left & Right walls (-X / +X) with real vaultable windows!
  const sideWallTotal = d - wallT * 2;
  const wingLen = Math.max(0.75, (sideWallTotal - winW) * 0.5);
  const wingOff = winW * 0.5 + wingLen * 0.5;
  [-1, 1].forEach((sideSign) => {
    const wx = sideSign * (w * 0.5 - wallT * 0.5);
    makeWall(wx, baseH, -wingOff, wallT, h, wingLen, wallMat);
    makeWall(wx, baseH, wingOff, wallT, h, wingLen, wallMat);
    makeWall(wx, floorH + sillH * 0.5, 0, wallT, sillH, winW, wallMat, true, 'house-window-sill');
    makeWall(wx, floorH + winOpenTop + headerH * 0.5, 0, wallT, headerH, winW, wallMat, false);

    // Window sill wooden ledge highlight
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, winW + 0.1), trimMat);
    ledge.position.set(wx, floorH + sillH + 0.02, 0);
    group.add(ledge);
  });

  // Back window sill wooden ledge highlight
  const backLedge = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.1, 0.08, 0.42), trimMat);
  backLedge.position.set(0, floorH + sillH + 0.02, -d * 0.5 + wallT * 0.5);
  group.add(backLedge);

  // Front wall split around open doorway (+Z side)
  const sideSpan = Math.max(0.8, (w - doorW) * 0.5);
  const sideCenter = doorW * 0.5 + sideSpan * 0.5;
  makeWall(-sideCenter, baseH, d * 0.5 - wallT * 0.5, sideSpan, h, wallT, wallMat);
  makeWall(sideCenter, baseH, d * 0.5 - wallT * 0.5, sideSpan, h, wallT, wallMat);
  // Door lintel above doorway (no player collider since above head)
  makeWall(0, floorH + h - 0.45, d * 0.5 - wallT * 0.5, doorW, 0.9, wallT, wallMat, false);

  const doorStep = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 0.9), trimMat);
  doorStep.position.set(0, 0.07, d * 0.5 + 0.45);
  group.add(doorStep);

  // Interior table/crate cover inside the house
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.8), trimMat);
  table.position.set(-w * 0.22, floorH + 0.4, -d * 0.18);
  table.castShadow = true;
  table.receiveShadow = true;
  group.add(table);
  addLocalObb(colliders, x, y, z, rotY, -w * 0.22, -d * 0.18, 1.4, 0.8, floorH, floorH + 0.9, 'interior-prop');

  // Pitched prism roof (two sloped eaves + gable fill)
  const roofPitch = 0.46;
  const roofSlopeLen = (d * 0.5 + 0.65) / Math.cos(roofPitch);
  const roofY = floorH + h + d * 0.13;
  const roofL = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.8, 0.16, roofSlopeLen),
    roofMat,
  );
  roofL.position.set(0, roofY, -d * 0.25);
  roofL.rotation.x = -roofPitch;
  roofL.castShadow = true;
  roofL.receiveShadow = true;

  const roofR = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.8, 0.16, roofSlopeLen),
    roofMat,
  );
  roofR.position.set(0, roofY, d * 0.25);
  roofR.rotation.x = roofPitch;
  roofR.castShadow = true;
  roofR.receiveShadow = true;

  const ridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.85, 0.2, 0.25),
    trimMat,
  );
  ridgeBeam.position.set(0, roofY + Math.sin(roofPitch) * roofSlopeLen * 0.48, 0);
  group.add(roofL, roofR, ridgeBeam);
  obstacleMeshes.push(roofL, roofR);

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

function createJeepProp(
  x: number,
  z: number,
  rotY: number,
  colliders: WorldObbCollider[],
  obstacleMeshes: THREE.Object3D[],
): THREE.Group {
  const group = new THREE.Group();
  const y = sampleGroundHeight(x, z);
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const oliveMat = new THREE.MeshStandardMaterial({
    color: 0x4b5336,
    roughness: 0.72,
    metalness: 0.25,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1b1c1f,
    roughness: 0.9,
    metalness: 0.05,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x6b8496,
    roughness: 0.2,
    metalness: 0.6,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 3.8), oliveMat);
  chassis.position.y = 0.78;
  chassis.castShadow = true;
  chassis.receiveShadow = true;

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.45, 1.3), oliveMat);
  hood.position.set(0, 1.05, 1.15);
  hood.castShadow = true;

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.85, 2.0), oliveMat);
  cabin.position.set(0, 1.52, -0.55);
  cabin.castShadow = true;

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 0.08), glassMat);
  windshield.position.set(0, 1.55, 0.44);
  windshield.rotation.x = -0.18;

  group.add(chassis, hood, cabin, windshield);
  obstacleMeshes.push(chassis, cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  [
    [-0.98, 0.42, 1.2],
    [0.98, 0.42, 1.2],
    [-0.98, 0.42, -1.2],
    [0.98, 0.42, -1.2],
  ].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    group.add(wheel);
  });

  const spare = new THREE.Mesh(wheelGeo, tireMat);
  spare.rotation.y = Math.PI / 2;
  spare.position.set(0, 0.95, -1.98);
  group.add(spare);

  colliders.push({
    cx: x,
    cz: z,
    halfW: 1.05,
    halfD: 2.0,
    rotY,
    minY: y,
    maxY: y + 2.1,
    tag: 'jeep',
  });

  return group;
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
    medkits: 1,
    healTimer: 0,
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
    moveSpeed: 4.4 + (idx % 3) * 0.6,
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
    // Main North-South Paved Highway across Ponte Velha
    { x1: 0, z1: -275, x2: 0, z2: 290, width: 8.0, kind: 'asphalt' },
    // Crossroad Posto de Espera (NW) -> Vila Central -> Galpões Leste
    { x1: -215, z1: -205, x2: 0, z2: -45, width: 6.4, kind: 'dirt' },
    { x1: 0, z1: -45, x2: 225, z2: -45, width: 7.2, kind: 'asphalt' },
    // East route across Ponte Leste -> Fazenda Sul & Colina do Farol
    { x1: 225, z1: -45, x2: 195, z2: 85, width: 6.4, kind: 'dirt' },
    { x1: 195, z1: 85, x2: 195, z2: 220, width: 6.4, kind: 'dirt' },
    { x1: 195, z1: 85, x2: 285, z2: 115, width: 5.5, kind: 'dirt' },
    // South Highway across Base Militar Sul -> Fazenda Sul & Porto Contêiner
    { x1: -20, z1: 290, x2: 195, z2: 220, width: 6.2, kind: 'dirt' },
    { x1: -20, z1: 290, x2: -235, z2: 205, width: 6.8, kind: 'asphalt' },
    // West route Posto de Espera -> Cidade do Vale -> Ponte Oeste -> Porto Contêiner
    { x1: -215, z1: -205, x2: -260, z2: 22, width: 6.0, kind: 'dirt' },
    { x1: -260, z1: 22, x2: -185, z2: 19, width: 6.4, kind: 'asphalt' },
    { x1: -185, z1: 19, x2: -235, z2: 205, width: 6.0, kind: 'dirt' },
    // Observatório Norte
    { x1: 0, z1: -45, x2: 135, z2: -245, width: 5.8, kind: 'dirt' },
  ];

  // 1. Large 1180m x 1180m Terrain Mesh (128x128 segments -> smooth rounded hills with fast vertex throughput)
  const terrainGeo = new THREE.PlaneGeometry(1180, 1180, 128, 128);
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
  const mountainGeo = new THREE.SphereGeometry(86, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const mountainCount = 40;
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

  // 4. Dirt & Asphalt Road Segments conforming to terrain
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

  roads.forEach((r) => {
    const dx = r.x2 - r.x1;
    const dz = r.z2 - r.z1;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / 9);
    const segLen = len / steps;
    const yaw = Math.atan2(dx, dz);
    const mat = r.kind === 'asphalt' ? asphaltRoadMat : dirtRoadMat;

    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const rx = r.x1 + dx * t;
      const rz = r.z1 + dz * t;
      const ry = sampleGroundHeight(rx, rz);
      if (ry < 0.15) continue;
      const seg = new THREE.Mesh(
        new THREE.PlaneGeometry(r.width, segLen + 0.65),
        mat,
      );
      seg.rotation.x = -Math.PI / 2;
      seg.rotation.z = -yaw;
      seg.position.set(rx, ry + 0.05, rz);
      seg.receiveShadow = true;
      scene.add(seg);
    }
  });

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

  // 5. Bridges over the River (3 crossings)
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
    createBridge(195, ponteLesteZ, 7.8, 32, 2.75, 0.12, woodWallMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: 195, z: ponteLesteZ, w: 7.8, d: 32, rotY: 0.12, kind: 'bridge' });

  const ponteOesteZ = riverCenterZ(-185);
  scene.add(
    createBridge(-185, ponteOesteZ, 7.8, 32, 2.75, -0.1, concreteMat, steelMat, colliders, platforms, obstacleMeshes),
  );
  buildings.push({ x: -185, z: ponteOesteZ, w: 7.8, d: 32, rotY: -0.1, kind: 'bridge' });

  // 6. Enterable Houses with Real Vaultable Windows across all Towns & Compounds
  const houseSpecs: Array<[number, number, number, number, number, number, boolean]> = [
    // Vila Central
    [-18, -60, 8.6, 7.0, 3.4, 0.1, false],
    [18, -62, 9.0, 7.2, 3.5, -0.15, true],
    [-22, -28, 7.8, 6.6, 3.3, 1.5, true],
    [22, -28, 8.4, 6.6, 3.4, -1.55, false],
    [-34, -46, 8.0, 6.4, 3.3, 0.05, false],
    [34, -46, 8.0, 6.6, 3.4, 3.1, true],
    // Cidade do Vale (West town)
    [-275, 10, 8.8, 7.0, 3.4, 0.15, false],
    [-245, 12, 8.2, 6.6, 3.3, -0.25, true],
    [-272, 36, 7.8, 6.4, 3.3, 1.55, true],
    [-242, 38, 8.6, 6.8, 3.4, -1.5, false],
    // Fazenda Sul
    [202, 232, 11.5, 8.8, 4.4, 0.22, true],
    [176, 210, 8.0, 6.6, 3.3, -0.35, false],
    [214, 206, 7.6, 6.2, 3.2, 2.9, true],
    // Posto de Espera (NW compound)
    [-232, -196, 8.4, 6.6, 3.3, 0.25, false],
    [-198, -218, 7.6, 6.2, 3.2, -0.4, true],
    // Observatório Norte Guardhouses
    [118, -238, 7.4, 6.0, 3.2, 0.4, false],
    [148, -234, 7.4, 6.0, 3.2, -0.4, true],
    // Base Militar Sul Barracks
    [-38, 282, 9.0, 7.2, 3.5, 0.05, false],
    [6, 282, 9.0, 7.2, 3.5, -0.05, false],
    // Colina do Farol
    [280, 104, 7.6, 6.2, 3.2, 0.5, true],
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

  // 7. Industrial Sheds & Hangars
  const shedSpecs: Array<[number, number, number, number, number, number]> = [
    [220, -30, 11.5, 16.5, 4.8, 0.0],
    [244, -50, 10.8, 15.0, 4.6, 1.57],
    [206, -62, 9.8, 13.5, 4.3, 0.2],
    [-218, -184, 11.0, 15.5, 4.6, 0.0], // Hangar at Posto de Espera
    [-220, 190, 10.5, 14.5, 4.4, 0.3], // Harbor Warehouse at Porto Contêiner
    [-16, 306, 12.0, 17.0, 4.9, 1.57], // Base Militar Sul Hangar
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

  // Concrete Airstrip Runway at Posto de Espera
  const runwayY = sampleGroundHeight(-215, -215);
  const runway = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.16, 66),
    concreteMat,
  );
  runway.position.set(-215, runwayY + 0.04, -225);
  runway.receiveShadow = true;
  scene.add(runway);
  platforms.push({
    cx: -215,
    cz: -225,
    halfW: 6,
    halfD: 33,
    rotY: 0,
    topY: runwayY + 0.12,
    minY: runwayY - 1,
  });

  // 8. PORTO CONTÊINER (Dock Pier + Stacked Shipping Containers)
  const pierY = 2.2;
  const pier = new THREE.Mesh(new THREE.BoxGeometry(32, 0.6, 20), concreteMat);
  pier.position.set(-246, pierY - 0.3, 218);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);
  platforms.push({
    cx: -246,
    cz: 218,
    halfW: 16,
    halfD: 10,
    rotY: 0,
    topY: pierY,
    minY: 0,
  });

  const containerSpecs: Array<[number, number, number, boolean, number]> = [
    [-238, 210, 0.05, true, 0],
    [-242, 210, 0.05, false, 0],
    [-240, 210, 0.05, true, 2.7],
    [-228, 218, 1.5, false, 0],
    [-250, 198, -0.35, true, 0],
    [-224, 200, 0.15, false, 0],
    [224, -44, 0.4, true, 0],
    [234, -30, 1.57, false, 0],
    [-24, 272, 0.0, true, 0],
    [-10, 272, 0.0, false, 0],
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

  // 9. Watchtowers (Observatório Norte + Colina do Farol + Base Militar Sul)
  const wt1 = createWatchTowerLOD(135, -245, concreteMat, steelMat, colliders, obstacleMeshes);
  scene.add(wt1);
  cullableStructures.push({ obj: wt1, x: 135, z: -245, radiusScale: 1.25 });
  buildings.push({ x: 135, z: -245, w: 7.2, d: 7.2, rotY: 0, kind: 'tower' });

  const wt2 = createWatchTowerLOD(288, 120, concreteMat, steelMat, colliders, obstacleMeshes);
  scene.add(wt2);
  cullableStructures.push({ obj: wt2, x: 288, z: 120, radiusScale: 1.25 });
  buildings.push({ x: 288, z: 120, w: 7.2, d: 7.2, rotY: 0, kind: 'tower' });

  const wt3 = createWatchTowerLOD(-26, 294, concreteMat, steelMat, colliders, obstacleMeshes);
  scene.add(wt3);
  cullableStructures.push({ obj: wt3, x: -26, z: 294, radiusScale: 1.25 });
  buildings.push({ x: -26, z: 294, w: 7.2, d: 7.2, rotY: 0, kind: 'tower' });

  // 10. Military Jeeps across POIs
  const jeepSpecs: Array<[number, number, number]> = [
    [182, 216, -0.85],
    [-4, -42, 0.65],
    [214, -36, -1.2],
    [-208, -202, 0.4],
    [-256, 24, 1.1],
    [-12, 286, -0.5],
  ];
  jeepSpecs.forEach(([jx, jz, jrot]) => {
    const jObj = createJeepProp(jx, jz, jrot, colliders, obstacleMeshes);
    scene.add(jObj);
    cullableStructures.push({ obj: jObj, x: jx, z: jz, radiusScale: 0.75 });
  });

  // 11. Instanced Cover Obstacles (Concrete Barriers, Wooden Crates, Oil Barrels)
  const barrierCoords: Array<[number, number, number]> = [
    [-6, -45, 0],
    [6, -45, 0],
    [0, -32, 1.57],
    [0, -58, 1.57],
    [0, ponteVelhaZ + 11, 0.3],
    [0, ponteVelhaZ - 11, -0.25],
    [126, -238, 0.8],
    [142, -240, -0.6],
    [-232, 202, 0.5],
    [216, -48, 0.2],
    [-258, 22, 0.9],
    [-20, 276, 0.1],
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
    [-206, -198, 0.2],
    [-204, -196, 0.7],
    [-220, -206, -0.3],
    [8, -40, 0.1],
    [-8, -50, 0.5],
    [226, -38, 0.4],
    [228, -40, 0.9],
    [-230, 212, 0.2],
    [192, 224, -0.4],
    [130, -250, 0.3],
    [-252, 28, 0.4],
    [-18, 294, -0.2],
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

  const barrelCoords: Array<[number, number]> = [
    [218, -26],
    [219.2, -26.4],
    [238, -46],
    [-224, 196],
    [-223, 197.4],
    [188, 212],
    [129, -242],
    [-212, -192],
    [-264, 16],
    [-14, 300],
  ];
  const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.15, 8);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.45 });
  const barrelInst = new THREE.InstancedMesh(barrelGeo, barrelMat, barrelCoords.length);
  barrelInst.castShadow = true;
  barrelInst.receiveShadow = true;
  barrelCoords.forEach(([bx, bz], idx) => {
    const by = sampleGroundHeight(bx, bz);
    dummy.position.set(bx, by + 0.58, bz);
    dummy.rotation.set(0, idx, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    barrelInst.setMatrixAt(idx, dummy.matrix);
    barrelInst.setColorAt(idx, tmpColor.setHex(idx % 2 === 0 ? 0xa63429 : 0x455939));
    colliders.push({
      cx: bx,
      cz: bz,
      halfW: 0.45,
      halfD: 0.45,
      rotY: 0,
      minY: by,
      maxY: by + 1.2,
      tag: 'barrel',
    });
  });
  barrelInst.computeBoundingSphere();
  if (barrelInst.instanceColor) barrelInst.instanceColor.needsUpdate = true;
  scene.add(barrelInst);
  obstacleMeshes.push(barrelInst);

  // 12. Varied Forests across expanded 520m island (InstancedMesh)
  const isClearOfPoiAndRoads = (x: number, z: number): boolean => {
    const tooClosePoi = POIS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius * 0.72);
    if (tooClosePoi) return false;
    if (Math.abs(x) < 8 && Math.abs(z) < 285) return false;
    if (Math.abs(z - riverCenterZ(x)) < 18) return false;
    return true;
  };

  // A) Pine Trees
  const pineList: Array<[number, number, number]> = [];
  for (let i = 0; i < 650 && pineList.length < 320; i++) {
    const angle = i * 2.39996;
    const rad = 58 + Math.sqrt(i / 650) * 405;
    const tx = Math.cos(angle) * rad;
    const tz = Math.sin(angle) * rad;
    const ty = sampleGroundHeight(tx, tz);
    if (ty < 2.0) continue;
    if (!isClearOfPoiAndRoads(tx, tz)) continue;
    if (tz > 165 && (i % 3 !== 0)) continue;
    pineList.push([tx, ty, tz]);
  }

  const pineTrunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 3.4, 8);
  pineTrunkGeo.translate(0, 1.7, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: textures.woodPlank,
    color: 0x7c5a3e,
    roughness: 0.9,
  });
  applyDistanceTextureLod(trunkMat, [0.54, 0.4, 0.28]);
  const pineLowerGeo = new THREE.ConeGeometry(2.05, 3.6, 10);
  pineLowerGeo.translate(0, 4.1, 0);
  const pineUpperGeo = new THREE.ConeGeometry(1.45, 3.2, 10);
  pineUpperGeo.translate(0, 6.1, 0);
  const foliageMat = new THREE.MeshStandardMaterial({
    map: textures.foliage,
    color: 0xffffff,
    roughness: 0.84,
    flatShading: false,
  });
  applyDistanceTextureLod(foliageMat, [0.4, 0.56, 0.24]);

  const pineTrunkInst = new THREE.InstancedMesh(pineTrunkGeo, trunkMat, pineList.length);
  const pineLowInst = new THREE.InstancedMesh(pineLowerGeo, foliageMat, pineList.length);
  const pineTopInst = new THREE.InstancedMesh(pineUpperGeo, foliageMat, pineList.length);
  pineTrunkInst.castShadow = true;
  pineLowInst.castShadow = true;
  pineTopInst.castShadow = true;

  const pineColors = [
    new THREE.Color(0x527d3e),
    new THREE.Color(0x618d48),
    new THREE.Color(0x456e35),
    new THREE.Color(0x6d9950),
  ];

  pineList.forEach(([tx, ty, tz], idx) => {
    const s = 0.85 + ((idx * 17) % 35) / 100;
    dummy.position.set(tx, ty - 0.1, tz);
    dummy.rotation.set(0, idx * 1.1, 0);
    dummy.scale.set(s, s * (0.95 + (idx % 3) * 0.14), s);
    dummy.updateMatrix();
    pineTrunkInst.setMatrixAt(idx, dummy.matrix);
    pineLowInst.setMatrixAt(idx, dummy.matrix);
    pineTopInst.setMatrixAt(idx, dummy.matrix);
    const col = pineColors[idx % pineColors.length];
    pineLowInst.setColorAt(idx, col);
    pineTopInst.setColorAt(idx, col);

    colliders.push({
      cx: tx,
      cz: tz,
      halfW: 0.42 * s,
      halfD: 0.42 * s,
      rotY: 0,
      minY: ty,
      maxY: ty + 4.0 * s,
      tag: 'tree-pine',
    });
  });
  pineTrunkInst.computeBoundingSphere();
  pineLowInst.computeBoundingSphere();
  pineTopInst.computeBoundingSphere();
  if (pineLowInst.instanceColor) pineLowInst.instanceColor.needsUpdate = true;
  if (pineTopInst.instanceColor) pineTopInst.instanceColor.needsUpdate = true;
  scene.add(pineTrunkInst, pineLowInst, pineTopInst);
  obstacleMeshes.push(pineTrunkInst);

  // B) Broadleaf Trees (Smooth rounded undulating canopy spheres!)
  const broadList: Array<[number, number, number]> = [];
  for (let i = 0; i < 540 && broadList.length < 245; i++) {
    const angle = i * 2.39996 + 0.85;
    const rad = 52 + Math.sqrt(i / 540) * 395;
    const tx = Math.cos(angle) * rad;
    const tz = Math.sin(angle) * rad;
    const ty = sampleGroundHeight(tx, tz);
    if (ty < 1.3 || ty > 8.5) continue;
    if (!isClearOfPoiAndRoads(tx, tz)) continue;
    broadList.push([tx, ty, tz]);
  }
  const broadTrunkGeo = new THREE.CylinderGeometry(0.26, 0.42, 3.0, 8);
  broadTrunkGeo.translate(0, 1.5, 0);
  const broadCrownGeo = new THREE.SphereGeometry(2.15, 11, 8);
  const broadCrownPos = broadCrownGeo.attributes.position;
  for (let v = 0; v < broadCrownPos.count; v++) {
    const vx = broadCrownPos.getX(v);
    const vy = broadCrownPos.getY(v);
    const vz = broadCrownPos.getZ(v);
    const ripple = 1 + Math.sin(vx * 2.4 + vz * 1.9) * 0.09 + Math.cos(vy * 3.1) * 0.07;
    broadCrownPos.setXYZ(v, vx * ripple, vy * ripple * 0.85, vz * ripple);
  }
  broadCrownGeo.computeVertexNormals();
  broadCrownGeo.translate(0, 4.3, 0);

  const broadTrunkInst = new THREE.InstancedMesh(broadTrunkGeo, trunkMat, broadList.length);
  const broadCrownInst = new THREE.InstancedMesh(broadCrownGeo, foliageMat, broadList.length);
  broadTrunkInst.castShadow = true;
  broadCrownInst.castShadow = true;

  const broadColors = [
    new THREE.Color(0x6c9648),
    new THREE.Color(0x7ca654),
    new THREE.Color(0x88a852),
    new THREE.Color(0x5c8440),
  ];

  broadList.forEach(([tx, ty, tz], idx) => {
    const s = 0.85 + ((idx * 19) % 35) / 100;
    dummy.position.set(tx, ty - 0.1, tz);
    dummy.rotation.set(0, idx * 0.7, 0);
    dummy.scale.set(s, s * 1.08, s);
    dummy.updateMatrix();
    broadTrunkInst.setMatrixAt(idx, dummy.matrix);
    broadCrownInst.setMatrixAt(idx, dummy.matrix);
    broadCrownInst.setColorAt(idx, broadColors[idx % broadColors.length]);

    colliders.push({
      cx: tx,
      cz: tz,
      halfW: 0.44 * s,
      halfD: 0.44 * s,
      rotY: 0,
      minY: ty,
      maxY: ty + 3.6 * s,
      tag: 'tree-broad',
    });
  });
  broadTrunkInst.computeBoundingSphere();
  broadCrownInst.computeBoundingSphere();
  if (broadCrownInst.instanceColor) broadCrownInst.instanceColor.needsUpdate = true;
  scene.add(broadTrunkInst, broadCrownInst);
  obstacleMeshes.push(broadTrunkInst);

  // C) Coastal Tropical Palm Trees (rounded trunks + arched 6-frond layered canopy!)
  const palmList: Array<[number, number, number]> = [];
  for (let i = 0; i < 160 && palmList.length < 96; i++) {
    const a = (i / 160) * Math.PI * 2;
    const r = 455 + (i % 5) * 11;
    const tx = Math.cos(a) * r;
    const tz = Math.sin(a) * r;
    const ty = sampleGroundHeight(tx, tz);
    if (ty < 0.2 || ty > 2.8) continue;
    palmList.push([tx, ty, tz]);
  }
  const palmTrunkGeo = new THREE.CylinderGeometry(0.15, 0.28, 5.4, 8);
  palmTrunkGeo.translate(0, 2.7, 0);

  const palmFrondParts: THREE.BufferGeometry[] = [];
  const crownHub = new THREE.SphereGeometry(0.45, 8, 6);
  crownHub.translate(0, 5.45, 0);
  palmFrondParts.push(crownHub);
  for (let f = 0; f < 6; f++) {
    const fa = (f / 6) * Math.PI * 2;
    const blade = new THREE.SphereGeometry(1.15, 8, 6);
    blade.scale(0.42, 0.14, 1.35);
    blade.rotateX(0.32);
    blade.translate(0, 5.25, 1.25);
    blade.rotateY(fa);
    palmFrondParts.push(blade);
  }
  const palmCrownGeo = mergeGeometries(palmFrondParts, false);
  palmFrondParts.forEach((g) => g.dispose());

  const palmTrunkInst = new THREE.InstancedMesh(palmTrunkGeo, trunkMat, palmList.length);
  const palmCrownInst = new THREE.InstancedMesh(palmCrownGeo, foliageMat, palmList.length);
  palmTrunkInst.castShadow = true;
  palmCrownInst.castShadow = true;
  palmList.forEach(([tx, ty, tz], idx) => {
    const s = 0.9 + (idx % 4) * 0.14;
    dummy.position.set(tx, ty - 0.1, tz);
    dummy.rotation.set(0.08, idx * 1.4, 0.06);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    palmTrunkInst.setMatrixAt(idx, dummy.matrix);
    palmCrownInst.setMatrixAt(idx, dummy.matrix);
    palmCrownInst.setColorAt(idx, tmpColor.setHex(idx % 2 === 0 ? 0x6fa246 : 0x82b254));
    colliders.push({
      cx: tx,
      cz: tz,
      halfW: 0.35 * s,
      halfD: 0.35 * s,
      rotY: 0,
      minY: ty,
      maxY: ty + 5.0 * s,
      tag: 'tree-palm',
    });
  });
  palmTrunkInst.computeBoundingSphere();
  palmCrownInst.computeBoundingSphere();
  if (palmCrownInst.instanceColor) palmCrownInst.instanceColor.needsUpdate = true;
  scene.add(palmTrunkInst, palmCrownInst);

  // 13. Smooth Rounded Wavy Rocks & Boulders (InstancedMesh)
  const rockGeo = new THREE.IcosahedronGeometry(1.25, 2);
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
  const rockList: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 310 && rockList.length < 210; i++) {
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

  // 14. Rounded Wavy Tactical Bushes & Grass Tufts (InstancedMesh)
  const bushGeo = new THREE.SphereGeometry(0.92, 9, 7);
  const bushPos = bushGeo.attributes.position;
  for (let v = 0; v < bushPos.count; v++) {
    const vx = bushPos.getX(v);
    const vy = bushPos.getY(v);
    const vz = bushPos.getZ(v);
    const w = 1 + Math.sin(vx * 3.4 + vz * 2.8) * 0.12;
    bushPos.setXYZ(v, vx * w, vy * 0.76, vz * w);
  }
  bushGeo.computeVertexNormals();
  bushGeo.translate(0, 0.48, 0);
  const bushInst = new THREE.InstancedMesh(bushGeo, foliageMat, 200);
  let placedBushes = 0;
  for (let i = 0; i < 290 && placedBushes < 200; i++) {
    const a = i * 2.71;
    const r = 24 + ((i * 41) % 430);
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    const by = sampleGroundHeight(bx, bz);
    if (by < 1.1) continue;
    dummy.position.set(bx, by, bz);
    dummy.rotation.set(0, i * 0.8, 0);
    const bs = 0.85 + (i % 4) * 0.2;
    dummy.scale.set(bs * 1.2, bs * 0.85, bs);
    dummy.updateMatrix();
    bushInst.setMatrixAt(placedBushes, dummy.matrix);
    bushInst.setColorAt(placedBushes, tmpColor.setHex(i % 2 === 0 ? 0x649440 : 0x76a64c));
    placedBushes++;
  }
  bushInst.count = placedBushes;
  bushInst.computeBoundingSphere();
  if (bushInst.instanceColor) bushInst.instanceColor.needsUpdate = true;
  scene.add(bushInst);

  const grassBladeGeo = new THREE.ConeGeometry(0.28, 0.55, 4);
  grassBladeGeo.translate(0, 0.27, 0);
  const grassMat = new THREE.MeshStandardMaterial({
    map: textures.foliage,
    color: 0xffffff,
    roughness: 0.9,
    flatShading: false,
  });
  applyDistanceTextureLod(grassMat, [0.5, 0.65, 0.28]);
  const grassCount = 1050;
  const grassInst = new THREE.InstancedMesh(grassBladeGeo, grassMat, grassCount);
  let placedGrass = 0;
  for (let i = 0; i < grassCount; i++) {
    const a = i * 2.13;
    const r = 12 + ((i * 53) % 445);
    const gx = Math.cos(a) * r;
    const gz = Math.sin(a) * r;
    const gy = sampleGroundHeight(gx, gz);
    if (gy < 1.0) continue;
    dummy.position.set(gx, gy, gz);
    dummy.rotation.set(0, i * 0.5, 0);
    const gs = 0.85 + (i % 4) * 0.2;
    dummy.scale.set(gs, gs, gs);
    dummy.updateMatrix();
    grassInst.setMatrixAt(placedGrass, dummy.matrix);
    grassInst.setColorAt(
      placedGrass,
      tmpColor.setHex(i % 2 === 0 ? 0x7da446 : 0x90b452),
    );
    placedGrass++;
  }
  grassInst.count = placedGrass;
  grassInst.computeBoundingSphere();
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  scene.add(grassInst);

  // 15. 50 Real Parachuting, Looting & Sight-Based Combat AI Bots!
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
    // Wait island spawn around Posto de Espera (-215, -205)
    const waitX = -215 + Math.cos(idx * 0.7) * (10 + (idx % 5) * 4);
    const waitZ = -205 + Math.sin(idx * 0.7) * (10 + (idx % 5) * 4);
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

  // 16. Comprehensive World Loot inside Houses, Sheds, Containers, Towers & POIs
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
  });

  // Shared pooled geometries & materials for ALL loot items (cuts GPU draw overhead dramatically)
  const lootBoxGeo = new THREE.BoxGeometry(0.54, 0.28, 0.38);
  const lootGlooGeo = new THREE.BoxGeometry(0.46, 0.56, 0.18);
  const lootDeathGeo = new THREE.BoxGeometry(0.76, 0.44, 0.52);
  const lootCylGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.44, 10);
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
      deathLoot?: LootItem['deathLoot'];
      label: string;
    },
    isDynamic = false,
  ): LootVisual => {
    const g = new THREE.Group();
    const ly = ld.yOverride !== undefined ? ld.yOverride : sampleGroundHeight(ld.x, ld.z);
    g.position.set(ld.x, ly + 0.25, ld.z);

    const boxColor =
      ld.kind === 'deathbox'
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
      ld.kind === 'deathbox'
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
      grassInst.visible = false;
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
      grassInst.visible = false;
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
      grassInst.visible = true;
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
    groundHeightAt: sampleGroundHeight,
    spawnDroppedLoot,
    clearDroppedLoots,
    applyQuality,
    updateDynamicProps,
    dispose,
  };
}
