import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BuildingDoorway,
  BuildingNavZone,
  WalkablePlatform,
  WorldObbCollider,
} from './types';

export interface BuildingLootPoint {
  x: number;
  y: number;
  z: number;
  floor: 1 | 2;
}

export interface BuildingResult {
  group: THREE.Group;
  lootPoints: BuildingLootPoint[];
  navZone: BuildingNavZone;
}

export interface BuildingMaterials {
  stuccoWall: THREE.Material;
  brickWall: THREE.Material;
  woodWall: THREE.Material;
  barnWood: THREE.Material;
  concrete: THREE.Material;
  interiorFloor: THREE.Material;
  stairConcrete: THREE.Material;
  roofTile: THREE.Material;
  trim: THREE.Material;
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

function addLocalPlatform(
  platforms: WalkablePlatform[],
  parentX: number,
  parentY: number,
  parentZ: number,
  parentRotY: number,
  localX: number,
  localZ: number,
  w: number,
  d: number,
  topYOffset: number,
  minYOffset = -0.5,
): void {
  const cos = Math.cos(parentRotY);
  const sin = Math.sin(parentRotY);
  const wx = parentX + localX * cos + localZ * sin;
  const wz = parentZ - localX * sin + localZ * cos;
  platforms.push({
    cx: wx,
    cz: wz,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY: parentRotY,
    topY: parentY + topYOffset,
    minY: parentY + minYOffset,
  });
}

function addLocalStairPlatform(
  platforms: WalkablePlatform[],
  parentX: number,
  parentY: number,
  parentZ: number,
  parentRotY: number,
  localX: number,
  localZ: number,
  w: number,
  d: number,
  slopeAxis: 'x' | 'z',
  yNegOffset: number,
  yPosOffset: number,
): void {
  const cos = Math.cos(parentRotY);
  const sin = Math.sin(parentRotY);
  const wx = parentX + localX * cos + localZ * sin;
  const wz = parentZ - localX * sin + localZ * cos;
  platforms.push({
    cx: wx,
    cz: wz,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY: parentRotY,
    topY: parentY + Math.max(yNegOffset, yPosOffset),
    minY: parentY + Math.min(yNegOffset, yPosOffset) - 0.5,
    slopeAxis,
    topYNeg: parentY + yNegOffset,
    topYPos: parentY + yPosOffset,
  });
}

function pushBox(
  list: THREE.BufferGeometry[],
  lx: number,
  ly: number,
  lz: number,
  ww: number,
  wh: number,
  wd: number,
  rx = 0,
  rz = 0,
): void {
  if (ww <= 0.01 || wh <= 0.01 || wd <= 0.01) return;
  const g = new THREE.BoxGeometry(ww, wh, wd);
  if (rx !== 0) g.rotateX(rx);
  if (rz !== 0) g.rotateZ(rz);
  g.translate(lx, ly, lz);
  list.push(g);
}

function toWorldPoint(
  x: number,
  y: number,
  z: number,
  rotY: number,
  lx: number,
  lyOffset: number,
  lz: number,
  floor: 1 | 2,
): BuildingLootPoint {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  return {
    x: x + lx * cos + lz * sin,
    y: y + lyOffset,
    z: z - lx * sin + lz * cos,
    floor,
  };
}

function toWorldXZ(
  x: number,
  z: number,
  rotY: number,
  lx: number,
  lz: number,
): { x: number; z: number } {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  return {
    x: x + lx * cos + lz * sin,
    z: z - lx * sin + lz * cos,
  };
}

function makeDoorway(
  x: number,
  z: number,
  rotY: number,
  inLx: number,
  inLz: number,
  outLx: number,
  outLz: number,
): BuildingDoorway {
  const inside = toWorldXZ(x, z, rotY, inLx, inLz);
  const outside = toWorldXZ(x, z, rotY, outLx, outLz);
  return {
    inX: inside.x,
    inZ: inside.z,
    outX: outside.x,
    outZ: outside.z,
  };
}

function finalizePart(
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mat: THREE.Material,
  castShadow: boolean,
  receiveShadow: boolean,
  obstacleMeshes?: THREE.Object3D[],
): void {
  if (geos.length === 0) return;
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (!merged) return;
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.userData.cullRoot = group;
  group.add(mesh);
  if (obstacleMeshes) {
    obstacleMeshes.push(mesh);
  }
}

interface WallHelper {
  addWall: (
    lx: number,
    ly: number,
    lz: number,
    ww: number,
    wh: number,
    wd: number,
    regCol?: boolean,
    tag?: string,
  ) => void;
  addWindowWall: (
    cx: number,
    floorY: number,
    cz: number,
    span: number,
    wallH: number,
    axis: 'x' | 'z',
    winW?: number,
    wallT?: number,
  ) => void;
  addDoorWall: (
    cx: number,
    floorY: number,
    cz: number,
    span: number,
    wallH: number,
    axis: 'x' | 'z',
    doorW?: number,
    doorOffset?: number,
    wallT?: number,
  ) => void;
  addStairsZ: (
    cx: number,
    zLow: number,
    zHigh: number,
    width: number,
    yLow: number,
    yHigh: number,
    steps?: number,
  ) => void;
}

function makeWallHelper(
  x: number,
  y: number,
  z: number,
  rotY: number,
  wallGeos: THREE.BufferGeometry[],
  trimGeos: THREE.BufferGeometry[],
  stairGeos: THREE.BufferGeometry[],
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
): WallHelper {
  const addWall = (
    lx: number,
    ly: number,
    lz: number,
    ww: number,
    wh: number,
    wd: number,
    regCol = true,
    tag = 'house-wall',
  ) => {
    pushBox(wallGeos, lx, ly, lz, ww, wh, wd);
    if (regCol) {
      addLocalObb(colliders, x, y, z, rotY, lx, lz, ww, wd, ly - wh * 0.5, ly + wh * 0.5, tag);
    }
  };

  const addWindowWall = (
    cx: number,
    floorY: number,
    cz: number,
    span: number,
    wallH: number,
    axis: 'x' | 'z',
    winW = 1.65,
    wallT = 0.26,
  ) => {
    const sillH = 0.92;
    const winTop = 2.18;
    const headerH = Math.max(0.32, wallH - winTop);
    const wingLen = Math.max(0.55, (span - winW) * 0.5);
    const wingOff = winW * 0.5 + wingLen * 0.5;
    const midY = floorY + wallH * 0.5;

    if (axis === 'x') {
      addWall(cx - wingOff, midY, cz, wingLen, wallH, wallT);
      addWall(cx + wingOff, midY, cz, wingLen, wallH, wallT);
      addWall(cx, floorY + sillH * 0.5, cz, winW, sillH, wallT, true, 'house-window-sill');
      addWall(cx, floorY + winTop + headerH * 0.5, cz, winW, headerH, wallT, false);
      pushBox(trimGeos, cx, floorY + sillH + 0.02, cz, winW + 0.12, 0.08, wallT + 0.14);
    } else {
      addWall(cx, midY, cz - wingOff, wallT, wallH, wingLen);
      addWall(cx, midY, cz + wingOff, wallT, wallH, wingLen);
      addWall(cx, floorY + sillH * 0.5, cz, wallT, sillH, winW, true, 'house-window-sill');
      addWall(cx, floorY + winTop + headerH * 0.5, cz, wallT, headerH, winW, false);
      pushBox(trimGeos, cx, floorY + sillH + 0.02, cz, wallT + 0.14, 0.08, winW + 0.12);
    }
  };

  const addDoorWall = (
    cx: number,
    floorY: number,
    cz: number,
    span: number,
    wallH: number,
    axis: 'x' | 'z',
    doorW = 2.0,
    doorOffset = 0,
    wallT = 0.26,
  ) => {
    const doorTop = 2.48;
    const headerH = Math.max(0.32, wallH - doorTop);
    const leftLen = Math.max(0.45, span * 0.5 + doorOffset - doorW * 0.5);
    const rightLen = Math.max(0.45, span * 0.5 - doorOffset - doorW * 0.5);
    const leftC = -span * 0.5 + leftLen * 0.5;
    const rightC = span * 0.5 - rightLen * 0.5;
    const midY = floorY + wallH * 0.5;

    if (axis === 'x') {
      addWall(cx + leftC, midY, cz, leftLen, wallH, wallT);
      addWall(cx + rightC, midY, cz, rightLen, wallH, wallT);
      addWall(cx + doorOffset, floorY + doorTop + headerH * 0.5, cz, doorW, headerH, wallT, false);
    } else {
      addWall(cx, midY, cz + leftC, wallT, wallH, leftLen);
      addWall(cx, midY, cz + rightC, wallT, wallH, rightLen);
      addWall(cx, floorY + doorTop + headerH * 0.5, cz + doorOffset, wallT, headerH, doorW, false);
    }
  };

  const addStairsZ = (
    cx: number,
    zLow: number,
    zHigh: number,
    width: number,
    yLow: number,
    yHigh: number,
    steps = 10,
  ) => {
    const minZ = Math.min(zLow, zHigh);
    const maxZ = Math.max(zLow, zHigh);
    const run = maxZ - minZ;
    const rise = yHigh - yLow;
    const stepD = run / steps;
    const stepH = rise / steps;
    const goesNegZ = zHigh < zLow;

    for (let s = 0; s < steps; s++) {
      const frac = (s + 0.5) / steps;
      const sz = goesNegZ ? zLow - frac * run : zLow + frac * run;
      const top = yLow + (s + 1) * stepH;
      const blockH = Math.min(top - yLow + 0.16, 0.56);
      pushBox(stairGeos, cx, top - blockH * 0.5, sz, width, blockH, stepD + 0.04);
    }

    const yAtMinZ = goesNegZ ? yHigh : yLow;
    const yAtMaxZ = goesNegZ ? yLow : yHigh;
    addLocalStairPlatform(
      platforms,
      x,
      y,
      z,
      rotY,
      cx,
      (minZ + maxZ) * 0.5,
      width,
      run,
      'z',
      yAtMinZ,
      yAtMaxZ,
    );
  };

  return { addWall, addWindowWall, addDoorWall, addStairsZ };
}

/**
 * Classic 1-Story Enterable Bermudian House (merged into 4 draw calls)
 */
export function createEnterableHouse(
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  rotY: number,
  y: number,
  wallMat: THREE.Material,
  mats: BuildingMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): BuildingResult {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const wallT = 0.26;
  const floorH = 0.24;

  const floorGeos: THREE.BufferGeometry[] = [];
  const wallGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];
  const stairGeos: THREE.BufferGeometry[] = [];

  pushBox(floorGeos, 0, floorH * 0.5, 0, w + 0.3, floorH, d + 0.3);
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, w + 0.3, d + 0.3, floorH);

  const hw = makeWallHelper(x, y, z, rotY, wallGeos, trimGeos, stairGeos, colliders, platforms);

  // Back wall (-Z) & side walls with vaultable windows
  hw.addWindowWall(0, floorH, -d * 0.5 + wallT * 0.5, w, h, 'x', 1.65, wallT);
  hw.addWindowWall(-w * 0.5 + wallT * 0.5, floorH, 0, d - wallT * 2, h, 'z', 1.65, wallT);
  hw.addWindowWall(w * 0.5 - wallT * 0.5, floorH, 0, d - wallT * 2, h, 'z', 1.65, wallT);

  // Front wall (+Z) with open doorway
  hw.addDoorWall(0, floorH, d * 0.5 - wallT * 0.5, w, h, 'x', 1.85, 0, wallT);

  // Front stoop + interior table cover
  pushBox(trimGeos, 0, 0.07, d * 0.5 + 0.45, 2.2, 0.14, 0.9);
  pushBox(trimGeos, -w * 0.22, floorH + 0.4, -d * 0.18, 1.35, 0.8, 0.78);
  addLocalObb(colliders, x, y, z, rotY, -w * 0.22, -d * 0.18, 1.35, 0.78, floorH, floorH + 0.85, 'interior-prop');

  // Pitched prism roof
  const roofPitch = 0.44;
  const roofSlopeLen = (d * 0.5 + 0.65) / Math.cos(roofPitch);
  const roofY = floorH + h + d * 0.12;
  pushBox(roofGeos, 0, roofY, -d * 0.25, w + 0.8, 0.16, roofSlopeLen, -roofPitch);
  pushBox(roofGeos, 0, roofY, d * 0.25, w + 0.8, 0.16, roofSlopeLen, roofPitch);
  pushBox(trimGeos, 0, roofY + Math.sin(roofPitch) * roofSlopeLen * 0.48, 0, w + 0.85, 0.2, 0.24);

  finalizePart(group, floorGeos, mats.interiorFloor, false, true);
  finalizePart(group, wallGeos, wallMat, true, true, obstacleMeshes);
  finalizePart(group, trimGeos, mats.trim, false, true);
  finalizePart(group, roofGeos, mats.roofTile, true, true, obstacleMeshes);

  const lootPoints: BuildingLootPoint[] = [
    toWorldPoint(x, y, z, rotY, w * 0.18, floorH, -d * 0.15, 1),
    toWorldPoint(x, y, z, rotY, -w * 0.2, floorH, d * 0.16, 1),
    toWorldPoint(x, y, z, rotY, hw ? w * 0.18 : 0, floorH, d * 0.18, 1),
    toWorldPoint(x, y, z, rotY, -w * 0.02, floorH, 0.1, 1),
    toWorldPoint(x, y, z, rotY, -w * 0.24, floorH, -d * 0.22, 1),
  ];

  const navZone: BuildingNavZone = {
    cx: x,
    cz: z,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY,
    baseY: y,
    doors: [makeDoorway(x, z, rotY, 0, d * 0.5 - 1.5, 0, d * 0.5 + 1.85)],
  };

  return { group, lootPoints, navZone };
}

/**
 * Iconic Free Fire CASA L (2-Story L-shaped house with Primeiro Andar, Stairs & Balcony)
 */
export function createCasaL(
  x: number,
  z: number,
  rotY: number,
  y: number,
  mats: BuildingMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): BuildingResult {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const f1 = 0.24;
  const h1 = 3.2;
  const slab2T = 0.24;
  const f2 = f1 + h1 + slab2T; // 3.68m
  const h2 = 2.95;
  const wallT = 0.26;

  const floorGeos: THREE.BufferGeometry[] = [];
  const wallGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];
  const stairGeos: THREE.BufferGeometry[] = [];

  // Ground Floor L-Footprint Slabs:
  // Main Wing: lx [-5.3 .. +5.3] (w=10.6), lz [-1.8 .. +3.6] (d=5.4) -> center (0, 0.9)
  // L-Wing:    lx [-5.3 .. -0.1] (w=5.2),  lz [-6.8 .. -1.8] (d=5.0) -> center (-2.7, -4.3)
  pushBox(floorGeos, 0, f1 * 0.5, 0.9, 10.9, f1, 5.7);
  pushBox(floorGeos, -2.7, f1 * 0.5, -4.3, 5.5, f1, 5.2);
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0.9, 10.9, 5.7, f1);
  addLocalPlatform(platforms, x, y, z, rotY, -2.7, -4.3, 5.5, 5.2, f1);

  const hw = makeWallHelper(x, y, z, rotY, wallGeos, trimGeos, stairGeos, colliders, platforms);

  // --- GROUND FLOOR WALLS ---
  // Front wall (+Z at lz = +3.47) with main entrance doorway at lx = -1.2
  hw.addDoorWall(0, f1, 3.47, 10.6, h1, 'x', 2.1, -1.2, wallT);
  // Main right outer wall (+X at lx = +5.17)
  hw.addWindowWall(5.17, f1, 0.9, 5.1, h1, 'z', 1.65, wallT);
  // Main left outer wall (-X at lx = -5.17, full length -6.8 .. +3.6 = 10.4m)
  hw.addWindowWall(-5.17, f1, -1.6, 10.1, h1, 'z', 1.75, wallT);
  // Back wall of Main Right Wing (lx: -0.1 .. +5.3 at lz = -1.67) with window
  hw.addWindowWall(2.6, f1, -1.67, 5.3, h1, 'x', 1.65, wallT);
  // L-Wing Right wall (lx = -0.23, lz: -6.8 .. -1.8) with window
  hw.addWindowWall(-0.23, f1, -4.3, 4.9, h1, 'z', 1.55, wallT);
  // L-Wing Back wall (lz = -6.67, lx: -5.3 .. -0.1) with rear doorway
  hw.addDoorWall(-2.7, f1, -6.67, 5.2, h1, 'x', 1.85, 0, wallT);

  // Front entry step & ground interior cover crate
  pushBox(trimGeos, -1.2, 0.08, 4.05, 2.5, 0.16, 0.95);
  pushBox(trimGeos, -3.2, f1 + 0.42, 0.8, 1.4, 0.84, 0.9);
  addLocalObb(colliders, x, y, z, rotY, -3.2, 0.8, 1.4, 0.9, f1, f1 + 0.9, 'interior-prop');

  // --- INTERIOR STAIRCASE (lx = +3.7, width = 2.2, z: +2.8 -> -0.2) ---
  hw.addStairsZ(3.7, 2.8, -0.2, 2.2, f1, f2, 10);
  // Low divider curb on stair inner edge
  hw.addWall(2.5, f1 + 0.55, 1.3, 0.18, 1.1, 2.9, true, 'stair-rail');

  // --- PRIMEIRO ANDAR (UPPER FLOOR SLABS at f2 = 3.68, leaving stair shaft open at lx +2.6..+5.1, lz -0.2..+3.5) ---
  // 1) Main 2F left/center slab: lx [-5.3 .. +2.6] (w=7.9), lz [-1.8 .. +3.6] (d=5.4) -> center (-1.35, 0.9)
  pushBox(floorGeos, -1.35, f2 - slab2T * 0.5, 0.9, 7.9, slab2T, 5.4);
  addLocalPlatform(platforms, x, y, z, rotY, -1.35, 0.9, 7.9, 5.4, f2, f1 + h1);
  addLocalObb(colliders, x, y, z, rotY, -1.35, 0.9, 7.9, 5.4, f1 + h1, f2, 'upper-slab');

  // 2) Stair top landing slab: lx [+2.6 .. +5.3] (w=2.7), lz [-1.8 .. -0.2] (d=1.6) -> center (+3.95, -1.0)
  pushBox(floorGeos, 3.95, f2 - slab2T * 0.5, -1.0, 2.7, slab2T, 1.6);
  addLocalPlatform(platforms, x, y, z, rotY, 3.95, -1.0, 2.7, 1.6, f2, f1 + h1);
  addLocalObb(colliders, x, y, z, rotY, 3.95, -1.0, 2.7, 1.6, f1 + h1, f2, 'upper-slab');

  // 3) L-Wing 2F slab: lx [-5.3 .. -0.1] (w=5.2), lz [-6.8 .. -1.8] (d=5.0) -> center (-2.7, -4.3)
  pushBox(floorGeos, -2.7, f2 - slab2T * 0.5, -4.3, 5.2, slab2T, 5.0);
  addLocalPlatform(platforms, x, y, z, rotY, -2.7, -4.3, 5.2, 5.0, f2, f1 + h1);
  addLocalObb(colliders, x, y, z, rotY, -2.7, -4.3, 5.2, 5.0, f1 + h1, f2, 'upper-slab');

  // 4) Iconic Casa L Front Balcony ("Sacada") at lx [-5.1 .. +1.9] (w=7.0), lz [+3.6 .. +5.1] (d=1.5) -> center (-1.6, 4.35)
  pushBox(floorGeos, -1.6, f2 - slab2T * 0.5, 4.35, 7.0, slab2T, 1.5);
  addLocalPlatform(platforms, x, y, z, rotY, -1.6, 4.35, 7.0, 1.5, f2, f1 + h1);
  // Balcony parapet railings (1.0m chest-high cover)
  hw.addWall(-1.6, f2 + 0.5, 5.0, 7.0, 1.0, 0.2, true, 'balcony-rail');
  hw.addWall(-5.0, f2 + 0.5, 4.35, 0.2, 1.0, 1.4, true, 'balcony-rail');
  hw.addWall(1.8, f2 + 0.5, 4.35, 0.2, 1.0, 1.4, true, 'balcony-rail');

  // --- PRIMEIRO ANDAR WALLS (at f2 = 3.68, h2 = 2.95) ---
  hw.addDoorWall(0, f2, 3.47, 10.6, h2, 'x', 2.0, -1.6, wallT);
  hw.addWindowWall(5.17, f2, 0.9, 5.1, h2, 'z', 1.65, wallT);
  hw.addWindowWall(-5.17, f2, -1.6, 10.1, h2, 'z', 1.75, wallT);
  hw.addWindowWall(2.6, f2, -1.67, 5.3, h2, 'x', 1.65, wallT);
  hw.addWindowWall(-0.23, f2, -4.3, 4.9, h2, 'z', 1.55, wallT);
  hw.addWindowWall(-2.7, f2, -6.67, 5.2, h2, 'x', 1.75, wallT);
  // Safety railing around upper stair opening (lx = +2.55, lz: +0.2 .. +3.2)
  hw.addWall(2.55, f2 + 0.52, 1.7, 0.16, 1.04, 3.0, true, 'stair-rail');

  // --- PITCHED L-SHAPED ROOF ---
  const roofBaseY = f2 + h2;
  const rPitch = 0.36;
  const slopeMain = 3.2 / Math.cos(rPitch);
  pushBox(roofGeos, 0, roofBaseY + 0.55, -0.45, 11.2, 0.16, slopeMain, -rPitch);
  pushBox(roofGeos, 0, roofBaseY + 0.55, 2.25, 11.2, 0.16, slopeMain, rPitch);
  const slopeL = 3.0 / Math.cos(rPitch);
  pushBox(roofGeos, -4.0, roofBaseY + 0.55, -4.2, slopeL, 0.16, 5.5, 0, rPitch);
  pushBox(roofGeos, -1.4, roofBaseY + 0.55, -4.2, slopeL, 0.16, 5.5, 0, -rPitch);
  // Balcony awning
  pushBox(roofGeos, -1.6, roofBaseY - 0.1, 4.3, 7.2, 0.14, 1.7, 0.2);

  finalizePart(group, floorGeos, mats.interiorFloor, false, true);
  finalizePart(group, stairGeos, mats.stairConcrete, false, true, obstacleMeshes);
  finalizePart(group, wallGeos, mats.stuccoWall, true, true, obstacleMeshes);
  finalizePart(group, trimGeos, mats.trim, false, true);
  finalizePart(group, roofGeos, mats.roofTile, true, true, obstacleMeshes);

  const lootPoints: BuildingLootPoint[] = [
    toWorldPoint(x, y, z, rotY, -2.5, f1, -4.2, 1),
    toWorldPoint(x, y, z, rotY, -0.5, f1, 0.8, 1),
    toWorldPoint(x, y, z, rotY, 1.4, f1, -0.6, 1),
    toWorldPoint(x, y, z, rotY, -2.6, f2, -4.2, 2),
    toWorldPoint(x, y, z, rotY, -1.4, f2, 1.2, 2),
    toWorldPoint(x, y, z, rotY, -1.6, f2, 4.25, 2), // Sacada loot!
  ];

  const navZone: BuildingNavZone = {
    cx: x,
    cz: z,
    halfW: 5.5,
    halfD: 7.0,
    rotY,
    baseY: y,
    extraBoxes: [
      { lx: 0, lz: 0.9, halfW: 5.3, halfD: 2.7 },
      { lx: -2.7, lz: -4.3, halfW: 2.6, halfD: 2.5 },
    ],
    hub: toWorldXZ(x, z, rotY, -2.5, -0.8),
    secondFloorY: y + f2,
    stairBottom: toWorldXZ(x, z, rotY, 3.6, 3.0),
    stairTop: toWorldXZ(x, z, rotY, 3.6, -0.9),
    doors: [
      makeDoorway(x, z, rotY, -1.2, 1.9, -1.2, 5.2),
      makeDoorway(x, z, rotY, -2.7, -5.0, -2.7, -8.4),
    ],
  };

  return { group, lootPoints, navZone };
}

/**
 * Iconic Free Fire CASA GOD (2-Story Tactical Stronghold with Primeiro Andar & Rooftop Parapet)
 */
export function createCasaGod(
  x: number,
  z: number,
  rotY: number,
  y: number,
  mats: BuildingMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): BuildingResult {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const w = 9.6;
  const d = 9.6;
  const f1 = 0.24;
  const h1 = 3.2;
  const slab2T = 0.24;
  const f2 = f1 + h1 + slab2T; // 3.68m
  const h2 = 2.85;
  const wallT = 0.28;

  const floorGeos: THREE.BufferGeometry[] = [];
  const wallGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];
  const stairGeos: THREE.BufferGeometry[] = [];

  // Ground Slab
  pushBox(floorGeos, 0, f1 * 0.5, 0, w + 0.3, f1, d + 0.3);
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, w + 0.3, d + 0.3, f1);

  const hw = makeWallHelper(x, y, z, rotY, wallGeos, trimGeos, stairGeos, colliders, platforms);

  // --- GROUND FLOOR: Dual wide front & back archways + side windows + central pillar ---
  hw.addDoorWall(0, f1, d * 0.5 - wallT * 0.5, w, h1, 'x', 2.6, -1.0, wallT);
  hw.addDoorWall(0, f1, -d * 0.5 + wallT * 0.5, w, h1, 'x', 2.6, -1.0, wallT);
  hw.addWindowWall(-w * 0.5 + wallT * 0.5, f1, 0, d - wallT * 2, h1, 'z', 1.9, wallT);
  hw.addWindowWall(w * 0.5 - wallT * 0.5, f1, 0, d - wallT * 2, h1, 'z', 1.9, wallT);

  // Central concrete pillar cover on ground floor
  hw.addWall(-1.0, f1 + h1 * 0.5, 0, 1.05, h1, 1.05, true, 'pillar');
  pushBox(trimGeos, -1.0, 0.08, d * 0.5 + 0.45, 2.9, 0.16, 0.9);

  // --- INTERIOR STAIRS (lx = +3.5, width = 2.1, z: +3.0 -> -0.6) ---
  hw.addStairsZ(3.5, 3.0, -0.6, 2.1, f1, f2, 10);
  hw.addWall(2.35, f1 + 0.55, 1.2, 0.18, 1.1, 3.4, true, 'stair-rail');

  // --- PRIMEIRO ANDAR SLABS (leaving stair opening lx +2.4..+4.7, lz -0.6..+4.6) ---
  // Left/Center 2F deck: lx [-4.8 .. +2.4] (w=7.2), lz [-4.8 .. +4.8] (d=9.6) -> center (-1.2, 0)
  pushBox(floorGeos, -1.2, f2 - slab2T * 0.5, 0, 7.2, slab2T, 9.6);
  addLocalPlatform(platforms, x, y, z, rotY, -1.2, 0, 7.2, 9.6, f2, f1 + h1);
  addLocalObb(colliders, x, y, z, rotY, -1.2, 0, 7.2, 9.6, f1 + h1, f2, 'upper-slab');

  // Upper landing behind stair top: lx [+2.4 .. +4.8] (w=2.4), lz [-4.8 .. -0.6] (d=4.2) -> center (3.6, -2.7)
  pushBox(floorGeos, 3.6, f2 - slab2T * 0.5, -2.7, 2.4, slab2T, 4.2);
  addLocalPlatform(platforms, x, y, z, rotY, 3.6, -2.7, 2.4, 4.2, f2, f1 + h1);
  addLocalObb(colliders, x, y, z, rotY, 3.6, -2.7, 2.4, 4.2, f1 + h1, f2, 'upper-slab');

  // --- PRIMEIRO ANDAR TACTICAL PARAPET & COVER ROOM ---
  // Back half (-Z) enclosed with wide peek windows & flat concrete roof canopy
  hw.addWindowWall(0, f2, -d * 0.5 + wallT * 0.5, w, h2, 'x', 2.2, wallT);
  hw.addWindowWall(-w * 0.5 + wallT * 0.5, f2, -2.2, 4.8, h2, 'z', 1.8, wallT);
  hw.addWindowWall(w * 0.5 - wallT * 0.5, f2, -2.2, 4.8, h2, 'z', 1.8, wallT);
  // Concrete canopy roof covering back half (lz: -4.9 .. +0.3)
  pushBox(roofGeos, 0, f2 + h2 + 0.14, -2.3, w + 0.5, 0.28, 5.2);
  // Front half (+Z) open-sky tactical terrace with chest-high parapet walls (1.08m) for 360° high-ground shots!
  hw.addWall(0, f2 + 0.54, d * 0.5 - 0.14, w, 1.08, 0.26, true, 'balcony-rail');
  hw.addWall(-w * 0.5 + 0.14, f2 + 0.54, 2.3, 0.26, 1.08, 4.6, true, 'balcony-rail');
  hw.addWall(w * 0.5 - 0.14, f2 + 0.54, 2.3, 0.26, 1.08, 4.6, true, 'balcony-rail');
  // Stairwell guard rail on 2F
  hw.addWall(2.35, f2 + 0.52, 1.8, 0.18, 1.04, 4.4, true, 'stair-rail');
  // Upper corner pillars supporting roof & trim
  hw.addWall(-4.6, f2 + h2 * 0.5, 0.1, 0.45, h2, 0.45, true, 'pillar');
  hw.addWall(4.6, f2 + h2 * 0.5, 0.1, 0.45, h2, 0.45, true, 'pillar');
  pushBox(trimGeos, 0, f2 + h2 + 0.32, -2.3, w + 0.6, 0.12, 5.3);

  finalizePart(group, floorGeos, mats.interiorFloor, false, true);
  finalizePart(group, stairGeos, mats.stairConcrete, false, true, obstacleMeshes);
  finalizePart(group, wallGeos, mats.brickWall, true, true, obstacleMeshes);
  finalizePart(group, trimGeos, mats.concrete, false, true);
  finalizePart(group, roofGeos, mats.concrete, true, true, obstacleMeshes);

  const lootPoints: BuildingLootPoint[] = [
    toWorldPoint(x, y, z, rotY, -2.8, f1, 1.6, 1),
    toWorldPoint(x, y, z, rotY, -2.6, f1, -2.4, 1),
    toWorldPoint(x, y, z, rotY, 1.2, f1, -2.8, 1),
    toWorldPoint(x, y, z, rotY, -2.4, f2, -2.6, 2),
    toWorldPoint(x, y, z, rotY, -1.6, f2, 2.5, 2),
    toWorldPoint(x, y, z, rotY, 3.4, f2, -2.8, 2),
  ];

  const navZone: BuildingNavZone = {
    cx: x,
    cz: z,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY,
    baseY: y,
    secondFloorY: y + f2,
    stairBottom: toWorldXZ(x, z, rotY, 3.5, 3.4),
    stairTop: toWorldXZ(x, z, rotY, 3.5, -1.2),
    doors: [
      makeDoorway(x, z, rotY, -1.0, 3.0, -1.0, 6.2),
      makeDoorway(x, z, rotY, -1.0, -3.0, -1.0, -6.2),
    ],
  };

  return { group, lootPoints, navZone };
}

/**
 * Iconic Free Fire CELEIRO (Red Wooden Barn with Primeiro Andar Mezzanine Loft)
 */
export function createCeleiro(
  x: number,
  z: number,
  rotY: number,
  y: number,
  mats: BuildingMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): BuildingResult {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const w = 10.4;
  const d = 13.8;
  const f1 = 0.24;
  const wallH = 5.8;
  const f2 = 3.25; // Mezzanine floor surface
  const loftT = 0.22;
  const wallT = 0.28;

  const floorGeos: THREE.BufferGeometry[] = [];
  const wallGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];
  const stairGeos: THREE.BufferGeometry[] = [];

  // Barn Ground Floor
  pushBox(floorGeos, 0, f1 * 0.5, 0, w + 0.4, f1, d + 0.4);
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, w + 0.4, d + 0.4, f1);

  const hw = makeWallHelper(x, y, z, rotY, wallGeos, trimGeos, stairGeos, colliders, platforms);

  // Wide Front & Back Barn Doors (3.5m wide!)
  hw.addDoorWall(0, f1, d * 0.5 - wallT * 0.5, w, wallH, 'x', 3.5, 0, wallT);
  // Back wall (-Z) has ground barn door + upper hay-loft sniper lookout window at f2!
  const backSideW = (w - 3.5) * 0.5;
  hw.addWall(-3.5 * 0.5 - backSideW * 0.5, f1 + wallH * 0.5, -d * 0.5 + wallT * 0.5, backSideW, wallH, wallT);
  hw.addWall(3.5 * 0.5 + backSideW * 0.5, f1 + wallH * 0.5, -d * 0.5 + wallT * 0.5, backSideW, wallH, wallT);
  // Center divider band between ground door & upper hay-loft window
  hw.addWall(0, f2 + 0.2, -d * 0.5 + wallT * 0.5, 3.5, 1.5, wallT, true, 'house-window-sill');
  hw.addWall(0, f1 + wallH - 0.35, -d * 0.5 + wallT * 0.5, 3.5, 0.7, wallT, false);

  // Side walls with double windows
  hw.addWindowWall(-w * 0.5 + wallT * 0.5, f1, -2.5, 5.8, wallH, 'z', 1.65, wallT);
  hw.addWindowWall(-w * 0.5 + wallT * 0.5, f1, 3.4, 5.8, wallH, 'z', 1.65, wallT);
  hw.addWindowWall(w * 0.5 - wallT * 0.5, f1, -2.5, 5.8, wallH, 'z', 1.65, wallT);
  hw.addWindowWall(w * 0.5 - wallT * 0.5, f1, 3.4, 5.8, wallH, 'z', 1.65, wallT);

  // Hay/crate cover inside barn floor
  pushBox(trimGeos, 2.4, f1 + 0.5, 1.8, 1.5, 1.0, 1.5);
  addLocalObb(colliders, x, y, z, rotY, 2.4, 1.8, 1.5, 1.5, f1, f1 + 1.05, 'interior-prop');

  // Wooden Mezzanine Stairs along inner left wall (lx = -3.7, z: +3.8 -> -0.8)
  hw.addStairsZ(-3.7, 3.8, -0.8, 2.0, f1, f2, 9);

  // --- PRIMEIRO ANDAR / MEZANINO DE MADEIRA (lz: -6.7 .. -0.8, full width -5.0..+5.0) ---
  pushBox(floorGeos, 0, f2 - loftT * 0.5, -3.75, 10.0, loftT, 5.9);
  addLocalPlatform(platforms, x, y, z, rotY, 0, -3.75, 10.0, 5.9, f2, f1 + 2.4);
  addLocalObb(colliders, x, y, z, rotY, 0, -3.75, 10.0, 5.9, f2 - loftT, f2, 'upper-slab');

  // Mezzanine balcony railing overlooking barn interior (with stair entry gap at lx -4.7..-2.7)
  hw.addWall(1.2, f2 + 0.5, -0.85, 7.6, 1.0, 0.2, true, 'balcony-rail');

  // Steep Barn Gable Roof
  const pitch = 0.48;
  const slopeW = (w * 0.5 + 0.7) / Math.cos(pitch);
  const roofY = f1 + wallH + 1.15;
  pushBox(roofGeos, -w * 0.25 - 0.1, roofY, 0, slopeW, 0.18, d + 0.9, 0, pitch);
  pushBox(roofGeos, w * 0.25 + 0.1, roofY, 0, slopeW, 0.18, d + 0.9, 0, -pitch);
  pushBox(trimGeos, 0, roofY + Math.sin(pitch) * slopeW * 0.47, 0, 0.34, 0.28, d + 0.95);

  finalizePart(group, floorGeos, mats.woodWall, false, true);
  finalizePart(group, stairGeos, mats.stairConcrete, false, true, obstacleMeshes);
  finalizePart(group, wallGeos, mats.barnWood, true, true, obstacleMeshes);
  finalizePart(group, trimGeos, mats.trim, false, true);
  finalizePart(group, roofGeos, mats.roofTile, true, true, obstacleMeshes);

  const lootPoints: BuildingLootPoint[] = [
    toWorldPoint(x, y, z, rotY, 2.2, f1, -2.5, 1),
    toWorldPoint(x, y, z, rotY, -1.2, f1, 3.2, 1),
    toWorldPoint(x, y, z, rotY, 2.8, f1, 4.4, 1),
    toWorldPoint(x, y, z, rotY, 0.0, f2, -4.8, 2),
    toWorldPoint(x, y, z, rotY, 3.2, f2, -2.6, 2),
    toWorldPoint(x, y, z, rotY, -3.0, f2, -4.2, 2),
  ];

  const navZone: BuildingNavZone = {
    cx: x,
    cz: z,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY,
    baseY: y,
    secondFloorY: y + f2,
    stairBottom: toWorldXZ(x, z, rotY, -3.7, 4.4),
    stairTop: toWorldXZ(x, z, rotY, -3.7, -1.5),
    doors: [
      makeDoorway(x, z, rotY, 0, 5.0, 0, 8.4),
      makeDoorway(x, z, rotY, 0, -5.0, 0, -8.4),
    ],
  };

  return { group, lootPoints, navZone };
}

/**
 * Classic 2-Story Residential Sobrado (Térreo + Primeiro Andar + Sacada)
 */
export function createSobradoHouse(
  x: number,
  z: number,
  rotY: number,
  y: number,
  mats: BuildingMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): BuildingResult {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const w = 8.8;
  const d = 7.8;
  const f1 = 0.24;
  const h1 = 3.15;
  const slab2T = 0.24;
  const f2 = f1 + h1 + slab2T; // 3.63m
  const h2 = 2.85;
  const wallT = 0.26;

  const floorGeos: THREE.BufferGeometry[] = [];
  const wallGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];
  const stairGeos: THREE.BufferGeometry[] = [];

  pushBox(floorGeos, 0, f1 * 0.5, 0, w + 0.3, f1, d + 0.3);
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, w + 0.3, d + 0.3, f1);

  const hw = makeWallHelper(x, y, z, rotY, wallGeos, trimGeos, stairGeos, colliders, platforms);

  // Ground floor walls
  hw.addDoorWall(0, f1, d * 0.5 - wallT * 0.5, w, h1, 'x', 2.0, -1.1, wallT);
  hw.addWindowWall(0, f1, -d * 0.5 + wallT * 0.5, w, h1, 'x', 1.75, wallT);
  hw.addWindowWall(-w * 0.5 + wallT * 0.5, f1, 0, d - wallT * 2, h1, 'z', 1.65, wallT);
  hw.addWindowWall(w * 0.5 - wallT * 0.5, f1, 0, d - wallT * 2, h1, 'z', 1.65, wallT);
  pushBox(trimGeos, -1.1, 0.08, d * 0.5 + 0.45, 2.3, 0.16, 0.9);

  // Interior stairs along +X wall (lx = +3.1, z: +2.4 -> -0.6)
  hw.addStairsZ(3.1, 2.4, -0.6, 2.0, f1, f2, 9);
  hw.addWall(2.0, f1 + 0.55, 0.9, 0.16, 1.1, 2.9, true, 'stair-rail');

  // Primeiro Andar slabs (cutout at lx +2.0..+4.4, lz -0.6..+3.8)
  pushBox(floorGeos, -1.2, f2 - slab2T * 0.5, 0, 6.4, slab2T, d);
  addLocalPlatform(platforms, x, y, z, rotY, -1.2, 0, 6.4, d, f2, f1 + h1);
  addLocalObb(colliders, x, y, z, rotY, -1.2, 0, 6.4, d, f1 + h1, f2, 'upper-slab');

  pushBox(floorGeos, 3.2, f2 - slab2T * 0.5, -2.25, 2.4, slab2T, 3.3);
  addLocalPlatform(platforms, x, y, z, rotY, 3.2, -2.25, 2.4, 3.3, f2, f1 + h1);
  addLocalObb(colliders, x, y, z, rotY, 3.2, -2.25, 2.4, 3.3, f1 + h1, f2, 'upper-slab');

  // Front Sacada on Primeiro Andar
  pushBox(floorGeos, -1.1, f2 - slab2T * 0.5, d * 0.5 + 0.7, 5.6, slab2T, 1.4);
  addLocalPlatform(platforms, x, y, z, rotY, -1.1, d * 0.5 + 0.7, 5.6, 1.4, f2, f1 + h1);
  hw.addWall(-1.1, f2 + 0.5, d * 0.5 + 1.32, 5.6, 1.0, 0.18, true, 'balcony-rail');
  hw.addWall(-3.8, f2 + 0.5, d * 0.5 + 0.7, 0.18, 1.0, 1.3, true, 'balcony-rail');
  hw.addWall(1.6, f2 + 0.5, d * 0.5 + 0.7, 0.18, 1.0, 1.3, true, 'balcony-rail');

  // Primeiro Andar walls
  hw.addDoorWall(0, f2, d * 0.5 - wallT * 0.5, w, h2, 'x', 1.9, -1.1, wallT);
  hw.addWindowWall(0, f2, -d * 0.5 + wallT * 0.5, w, h2, 'x', 1.75, wallT);
  hw.addWindowWall(-w * 0.5 + wallT * 0.5, f2, 0, d - wallT * 2, h2, 'z', 1.65, wallT);
  hw.addWindowWall(w * 0.5 - wallT * 0.5, f2, 0, d - wallT * 2, h2, 'z', 1.65, wallT);
  hw.addWall(2.0, f2 + 0.5, 1.5, 0.16, 1.0, 4.0, true, 'stair-rail');

  // Pitched Roof
  const roofPitch = 0.4;
  const slopeLen = (d * 0.5 + 0.65) / Math.cos(roofPitch);
  const roofY = f2 + h2 + d * 0.1;
  pushBox(roofGeos, 0, roofY, -d * 0.25, w + 0.7, 0.16, slopeLen, -roofPitch);
  pushBox(roofGeos, 0, roofY, d * 0.25, w + 0.7, 0.16, slopeLen, roofPitch);

  finalizePart(group, floorGeos, mats.interiorFloor, false, true);
  finalizePart(group, stairGeos, mats.stairConcrete, false, true, obstacleMeshes);
  finalizePart(group, wallGeos, mats.brickWall, true, true, obstacleMeshes);
  finalizePart(group, trimGeos, mats.trim, false, true);
  finalizePart(group, roofGeos, mats.roofTile, true, true, obstacleMeshes);

  const lootPoints: BuildingLootPoint[] = [
    toWorldPoint(x, y, z, rotY, -2.0, f1, -1.6, 1),
    toWorldPoint(x, y, z, rotY, -1.8, f1, 1.6, 1),
    toWorldPoint(x, y, z, rotY, -1.8, f2, -1.6, 2),
    toWorldPoint(x, y, z, rotY, -1.1, f2, d * 0.5 + 0.65, 2),
  ];

  const navZone: BuildingNavZone = {
    cx: x,
    cz: z,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY,
    baseY: y,
    secondFloorY: y + f2,
    stairBottom: toWorldXZ(x, z, rotY, 3.1, 2.85),
    stairTop: toWorldXZ(x, z, rotY, 3.1, -1.2),
    doors: [makeDoorway(x, z, rotY, -1.1, 2.2, -1.1, 5.4)],
  };

  return { group, lootPoints, navZone };
}

/**
 * Iconic Free Fire GUARITA (Tactical Guard Post with 4-way shooting windows)
 */
export function createGuarita(
  x: number,
  z: number,
  rotY: number,
  y: number,
  mats: BuildingMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): BuildingResult {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const s = 3.4;
  const floorH = 0.26;
  const h = 2.65;
  const wallT = 0.22;

  const floorGeos: THREE.BufferGeometry[] = [];
  const wallGeos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];

  pushBox(floorGeos, 0, floorH * 0.5, 0, s + 0.2, floorH, s + 0.2);
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, s + 0.2, s + 0.2, floorH);

  // 4 corner pillars
  const pOff = s * 0.5 - 0.18;
  [
    [-pOff, -pOff],
    [pOff, -pOff],
    [-pOff, pOff],
    [pOff, pOff],
  ].forEach(([px, pz]) => {
    pushBox(wallGeos, px, floorH + h * 0.5, pz, 0.36, h, 0.36);
    addLocalObb(colliders, x, y, z, rotY, px, pz, 0.36, 0.36, floorH, floorH + h, 'guarita-pillar');
  });

  // 3 chest-high parapet walls (left, right, back) + front doorway
  const sillH = 1.02;
  pushBox(wallGeos, 0, floorH + sillH * 0.5, -s * 0.5 + wallT * 0.5, s - 0.4, sillH, wallT);
  addLocalObb(colliders, x, y, z, rotY, 0, -s * 0.5 + wallT * 0.5, s - 0.4, wallT, floorH, floorH + sillH, 'house-window-sill');

  pushBox(wallGeos, -s * 0.5 + wallT * 0.5, floorH + sillH * 0.5, 0, wallT, sillH, s - 0.4);
  addLocalObb(colliders, x, y, z, rotY, -s * 0.5 + wallT * 0.5, 0, wallT, s - 0.4, floorH, floorH + sillH, 'house-window-sill');

  pushBox(wallGeos, s * 0.5 - wallT * 0.5, floorH + sillH * 0.5, 0, wallT, sillH, s - 0.4);
  addLocalObb(colliders, x, y, z, rotY, s * 0.5 - wallT * 0.5, 0, wallT, s - 0.4, floorH, floorH + sillH, 'house-window-sill');

  // Overhang terracotta roof
  pushBox(roofGeos, 0, floorH + h + 0.14, 0, s + 0.7, 0.24, s + 0.7);

  finalizePart(group, floorGeos, mats.concrete, false, true);
  finalizePart(group, wallGeos, mats.stuccoWall, true, true, obstacleMeshes);
  finalizePart(group, roofGeos, mats.roofTile, true, true, obstacleMeshes);

  const navZone: BuildingNavZone = {
    cx: x,
    cz: z,
    halfW: s * 0.5,
    halfD: s * 0.5,
    rotY,
    baseY: y,
    doors: [makeDoorway(x, z, rotY, 0, 0.2, 0, 3.0)],
  };

  return {
    group,
    lootPoints: [toWorldPoint(x, y, z, rotY, 0, floorH, -0.35, 1)],
    navZone,
  };
}
