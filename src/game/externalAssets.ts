import * as THREE from 'three';
import { GLTFLoader, type GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MinimapBuilding } from './types';

export const BERMUDA_GLB_SCALE = 5.0;
export const BERMUDA_GLB_OFFSET_X = 500.0;
export const BERMUDA_GLB_OFFSET_Z = 97.1;
export const BERMUDA_GLB_WATER_Y = -2.2;
export const BERMUDA_GLB_MAP_RANGE = 960;

export interface ExternalWorldAssets {
  airplaneTemplate: THREE.Group | null;
  lobbyTemplate: THREE.Group | null;
  gladiadoresTemplate: THREE.Group | null;
  bermudaTemplate: THREE.Group | null;
}

interface SpecGlossExtension {
  diffuseFactor?: [number, number, number, number];
  diffuseTexture?: { index: number; texCoord?: number };
  specularFactor?: [number, number, number];
  glossinessFactor?: number;
}

function registerSpecGlossPlugin(loader: GLTFLoader): void {
  loader.register((parser: GLTFParser) => ({
    name: 'KHR_materials_pbrSpecularGlossiness',
    getMaterialType: (materialIndex: number) => {
      const matDef = parser.json.materials?.[materialIndex];
      if (matDef?.extensions?.KHR_materials_pbrSpecularGlossiness) {
        return THREE.MeshStandardMaterial;
      }
      return null;
    },
    extendMaterialParams: async (
      materialIndex: number,
      materialParams: Record<string, unknown>,
    ) => {
      const matDef = parser.json.materials?.[materialIndex];
      const ext = matDef?.extensions?.KHR_materials_pbrSpecularGlossiness as
        | SpecGlossExtension
        | undefined;
      if (!ext) return null;

      if (Array.isArray(ext.diffuseFactor)) {
        const [r, g, b, a] = ext.diffuseFactor;
        materialParams.color = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
        if (a < 1) {
          materialParams.opacity = a;
          materialParams.transparent = true;
        }
      }
      const gloss = typeof ext.glossinessFactor === 'number' ? ext.glossinessFactor : 0.45;
      materialParams.roughness = THREE.MathUtils.clamp(1 - gloss, 0.12, 0.96);
      materialParams.metalness = 0.12;

      if (ext.diffuseTexture) {
        await parser.assignTexture(
          materialParams,
          'map',
          ext.diffuseTexture,
          THREE.SRGBColorSpace,
        );
      }
      return undefined;
    },
  }));
}

let cachedAssets: ExternalWorldAssets | null = null;
let loadPromise: Promise<ExternalWorldAssets> | null = null;

export function getExternalWorldAssets(): ExternalWorldAssets | null {
  return cachedAssets;
}

function loadGlbScene(loader: GLTFLoader, url: string): Promise<THREE.Group | null> {
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        resolve(gltf.scene);
      },
      undefined,
      () => {
        resolve(null);
      },
    );
  });
}

function prepareModelMaterials(
  root: THREE.Group,
  castShadow: boolean,
  receiveShadow: boolean,
  options?: { hideWatermark?: boolean; clampRoughness?: boolean },
): void {
  root.traverse((node) => {
    if (options?.hideWatermark && /^Text_Material/i.test(node.name)) {
      node.visible = false;
      return;
    }
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      if (options?.hideWatermark && /^Text_Material/i.test(mesh.name)) {
        mesh.visible = false;
        return;
      }
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i] as THREE.MeshStandardMaterial | undefined;
        if (!mat) continue;
        if (options?.hideWatermark && /^Text_Material/i.test(mat.name)) {
          mesh.visible = false;
        }
        if (mat.map && mat.map.colorSpace !== THREE.SRGBColorSpace) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.map.needsUpdate = true;
        }
        if (options?.clampRoughness && typeof mat.roughness === 'number') {
          mat.roughness = THREE.MathUtils.clamp(mat.roughness, 0.35, 0.96);
          mat.metalness = Math.min(mat.metalness ?? 0.1, 0.35);
        }
      }
    }
  });
}

export async function preloadExternalWorldAssets(
  onProgress?: (pct: number, label: string) => void,
): Promise<ExternalWorldAssets> {
  if (cachedAssets) return cachedAssets;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);
    registerSpecGlossPlugin(loader);

    onProgress?.(68, 'Carregando avião, lobby, Gladiadores e ilha Bermuda...');

    const [rawAirplane, rawLobby, rawGladiadores, rawBermuda] = await Promise.all([
      loadGlbScene(loader, encodeURI('/3d/avião.glb')),
      loadGlbScene(loader, '/3d/lobby.glb'),
      loadGlbScene(loader, '/3d/gladiadores.glb'),
      loadGlbScene(loader, '/3d/bermuda.glb'),
    ]);

    let airplaneTemplate: THREE.Group | null = null;
    if (rawAirplane) {
      rawAirplane.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(rawAirplane);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxHoriz = Math.max(size.x, size.z, 1);
      const normScale = 25.0 / maxHoriz;

      const wrapper = new THREE.Group();
      rawAirplane.scale.multiplyScalar(normScale);
      rawAirplane.position.set(
        -center.x * normScale,
        -box.min.y * normScale - (size.y * normScale * 0.45),
        -center.z * normScale,
      );
      prepareModelMaterials(rawAirplane, true, false);
      wrapper.add(rawAirplane);
      airplaneTemplate = wrapper;
    }

    if (rawLobby) {
      prepareModelMaterials(rawLobby, false, true);
    }
    if (rawGladiadores) {
      prepareModelMaterials(rawGladiadores, false, true);
    }

    let bermudaTemplate: THREE.Group | null = null;
    if (rawBermuda) {
      prepareModelMaterials(rawBermuda, false, true, {
        hideWatermark: true,
        clampRoughness: true,
      });
      const wrapper = new THREE.Group();
      rawBermuda.scale.setScalar(BERMUDA_GLB_SCALE);
      rawBermuda.position.set(BERMUDA_GLB_OFFSET_X, 0, BERMUDA_GLB_OFFSET_Z);
      wrapper.add(rawBermuda);
      wrapper.updateMatrixWorld(true);
      bermudaTemplate = wrapper;
    }

    cachedAssets = {
      airplaneTemplate,
      lobbyTemplate: rawLobby,
      gladiadoresTemplate: rawGladiadores,
      bermudaTemplate,
    };
    return cachedAssets;
  })();

  return loadPromise;
}

export function extractAirplanePropellers(root: THREE.Object3D): THREE.Object3D[] {
  const props: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (
      node.name === 'airscrew1' ||
      node.name === 'airscrew2' ||
      node.name === 'airscrew3' ||
      node.name === 'airscrew4'
    ) {
      props.push(node);
    }
  });
  return props;
}

// ---------------------------------------------------------------------------
// Fast Spatial Mesh Triangle Grid for GLB Floor, Horizontal Push & Raycasting
// ---------------------------------------------------------------------------

interface GridTri {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
  nx: number;
  ny: number;
  nz: number;
  minY: number;
  maxY: number;
  stamp: number;
}

const _tA = new THREE.Vector3();
const _tB = new THREE.Vector3();
const _tC = new THREE.Vector3();
const _tE1 = new THREE.Vector3();
const _tE2 = new THREE.Vector3();
const _tN = new THREE.Vector3();
const _tP = new THREE.Vector3();
const _tQ = new THREE.Vector3();
const _tTvec = new THREE.Vector3();

function closestPointOnSegmentXZ(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): [number, number] {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq < 1e-8) return [ax, az];
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / lenSq));
  return [ax + abx * t, az + abz * t];
}

function pointInTriXZ(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
): boolean {
  const v0x = cx - ax;
  const v0z = cz - az;
  const v1x = bx - ax;
  const v1z = bz - az;
  const v2x = px - ax;
  const v2z = pz - az;
  const dot00 = v0x * v0x + v0z * v0z;
  const dot01 = v0x * v1x + v0z * v1z;
  const dot02 = v0x * v2x + v0z * v2z;
  const dot11 = v1x * v1x + v1z * v1z;
  const dot12 = v1x * v2x + v1z * v2z;
  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-8) return false;
  const inv = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;
  return u >= -0.001 && v >= -0.001 && u + v <= 1.002;
}

const TERRAIN_MESH_RE = /terrain|ground|highway|airport_road|p_road|road|runway|grass|sand|beach/i;
const WATERMARK_RE = /^Text_Material/i;

export class MeshCollisionGrid {
  private readonly cellSize: number;
  private readonly floorCells = new Map<string, GridTri[]>();
  private readonly terrainFloorCells = new Map<string, GridTri[]>();
  private readonly wallCells = new Map<string, GridTri[]>();
  private readonly allCells = new Map<string, GridTri[]>();
  private stampCounter = 1;
  public minX = Infinity;
  public maxX = -Infinity;
  public minZ = Infinity;
  public maxZ = -Infinity;

  constructor(cellSize = 2.5) {
    this.cellSize = cellSize;
  }

  private key(ix: number, iz: number): string {
    return `${ix},${iz}`;
  }

  private insertInto(
    map: Map<string, GridTri[]>,
    tri: GridTri,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
  ): void {
    const ix0 = Math.floor(minX / this.cellSize);
    const ix1 = Math.floor(maxX / this.cellSize);
    const iz0 = Math.floor(minZ / this.cellSize);
    const iz1 = Math.floor(maxZ / this.cellSize);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const k = this.key(ix, iz);
        let list = map.get(k);
        if (!list) {
          list = [];
          map.set(k, list);
        }
        list.push(tri);
      }
    }
  }

  public buildFromObject(root: THREE.Object3D): void {
    this.floorCells.clear();
    this.terrainFloorCells.clear();
    this.wallCells.clear();
    this.allCells.clear();
    this.minX = Infinity;
    this.maxX = -Infinity;
    this.minZ = Infinity;
    this.maxZ = -Infinity;

    root.updateMatrixWorld(true);

    root.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      if (!mesh.visible || WATERMARK_RE.test(mesh.name)) return;
      const geo = mesh.geometry as THREE.BufferGeometry | undefined;
      if (!geo) return;
      const posAttr = geo.attributes.position;
      if (!posAttr) return;

      let matName = '';
      const rawMat = mesh.material;
      if (Array.isArray(rawMat)) {
        matName = rawMat.map((m) => m?.name ?? '').join(' ');
      } else if (rawMat) {
        matName = rawMat.name ?? '';
      }
      if (WATERMARK_RE.test(matName)) return;

      const isTerrainLike =
        TERRAIN_MESH_RE.test(mesh.name) ||
        TERRAIN_MESH_RE.test(mesh.parent?.name ?? '') ||
        TERRAIN_MESH_RE.test(matName);

      const idxAttr = geo.index;
      const triCount = idxAttr ? Math.floor(idxAttr.count / 3) : Math.floor(posAttr.count / 3);
      const matWorld = mesh.matrixWorld;

      for (let t = 0; t < triCount; t++) {
        const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
        const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
        const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;

        _tA.fromBufferAttribute(posAttr, i0).applyMatrix4(matWorld);
        _tB.fromBufferAttribute(posAttr, i1).applyMatrix4(matWorld);
        _tC.fromBufferAttribute(posAttr, i2).applyMatrix4(matWorld);

        _tE1.subVectors(_tB, _tA);
        _tE2.subVectors(_tC, _tA);
        _tN.crossVectors(_tE1, _tE2);
        const area2 = _tN.length();
        if (area2 < 1e-5) continue;
        _tN.divideScalar(area2);

        const tMinX = Math.min(_tA.x, _tB.x, _tC.x);
        const tMaxX = Math.max(_tA.x, _tB.x, _tC.x);
        const tMinY = Math.min(_tA.y, _tB.y, _tC.y);
        const tMaxY = Math.max(_tA.y, _tB.y, _tC.y);
        const tMinZ = Math.min(_tA.z, _tB.z, _tC.z);
        const tMaxZ = Math.max(_tA.z, _tB.z, _tC.z);

        this.minX = Math.min(this.minX, tMinX);
        this.maxX = Math.max(this.maxX, tMaxX);
        this.minZ = Math.min(this.minZ, tMinZ);
        this.maxZ = Math.max(this.maxZ, tMaxZ);

        const tri: GridTri = {
          ax: _tA.x,
          ay: _tA.y,
          az: _tA.z,
          bx: _tB.x,
          by: _tB.y,
          bz: _tB.z,
          cx: _tC.x,
          cy: _tC.y,
          cz: _tC.z,
          nx: _tN.x,
          ny: _tN.y,
          nz: _tN.z,
          minY: tMinY,
          maxY: tMaxY,
          stamp: 0,
        };

        this.insertInto(this.allCells, tri, tMinX, tMaxX, tMinZ, tMaxZ);
        const absNy = Math.abs(_tN.y);
        if (absNy > 0.45) {
          this.insertInto(this.floorCells, tri, tMinX, tMaxX, tMinZ, tMaxZ);
          if (isTerrainLike) {
            this.insertInto(this.terrainFloorCells, tri, tMinX, tMaxX, tMinZ, tMaxZ);
          }
        }
        if (absNy < 0.72) {
          this.insertInto(this.wallCells, tri, tMinX, tMaxX, tMinZ, tMaxZ);
        }
      }
    });
  }

  private sampleFromCellMap(
    map: Map<string, GridTri[]>,
    x: number,
    z: number,
    maxStepY: number,
    pickLowest: boolean,
  ): number {
    const ix = Math.floor(x / this.cellSize);
    const iz = Math.floor(z / this.cellSize);
    const tris = map.get(this.key(ix, iz));
    if (!tris) return -Infinity;

    let bestY = pickLowest ? Infinity : -Infinity;
    let found = false;

    for (let i = 0; i < tris.length; i++) {
      const tri = tris[i];
      if (!pickLowest && tri.minY > maxStepY) continue;

      const v0x = tri.cx - tri.ax;
      const v0z = tri.cz - tri.az;
      const v1x = tri.bx - tri.ax;
      const v1z = tri.bz - tri.az;
      const v2x = x - tri.ax;
      const v2z = z - tri.az;

      const dot00 = v0x * v0x + v0z * v0z;
      const dot01 = v0x * v1x + v0z * v1z;
      const dot02 = v0x * v2x + v0z * v2z;
      const dot11 = v1x * v1x + v1z * v1z;
      const dot12 = v1x * v2x + v1z * v2z;
      const denom = dot00 * dot11 - dot01 * dot01;
      if (Math.abs(denom) < 1e-8) continue;

      const inv = 1 / denom;
      const u = (dot11 * dot02 - dot01 * dot12) * inv;
      const v = (dot00 * dot12 - dot01 * dot02) * inv;
      if (u < -0.002 || v < -0.002 || u + v > 1.004) continue;

      const w = 1 - u - v;
      const hitY = w * tri.ay + v * tri.by + u * tri.cy;
      if (hitY > maxStepY) continue;
      if (!found || (pickLowest ? hitY < bestY : hitY > bestY)) {
        bestY = hitY;
        found = true;
      }
    }

    return found ? bestY : -Infinity;
  }

  public sampleTerrainHeight(x: number, z: number, fallbackY: number): number {
    const tHit = this.sampleFromCellMap(this.terrainFloorCells, x, z, 260, false);
    if (tHit > -Infinity) return tHit;
    const lowest = this.sampleFromCellMap(this.floorCells, x, z, 260, true);
    return lowest > -Infinity ? lowest : fallbackY;
  }

  public sampleFloorHeight(x: number, z: number, maxStepY: number, fallbackY: number): number {
    const hit = this.sampleFromCellMap(this.floorCells, x, z, maxStepY, false);
    return hit > -Infinity ? hit : fallbackY;
  }

  public resolveHorizontal(
    posObj: { x: number; y: number; z: number },
    radius: number,
  ): number {
    const px = posObj.x;
    const pz = posObj.z;
    const bodyMinY = posObj.y + 0.34;
    const bodyMaxY = posObj.y + 1.56;
    const ix0 = Math.floor((px - radius) / this.cellSize);
    const ix1 = Math.floor((px + radius) / this.cellSize);
    const iz0 = Math.floor((pz - radius) / this.cellSize);
    const iz1 = Math.floor((pz + radius) / this.cellSize);

    const stamp = ++this.stampCounter;
    const rSq = radius * radius;
    let totalPush = 0;

    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const tris = this.wallCells.get(this.key(ix, iz));
        if (!tris) continue;
        for (let i = 0; i < tris.length; i++) {
          const tri = tris[i];
          if (tri.stamp === stamp) continue;
          tri.stamp = stamp;

          if (tri.maxY < bodyMinY || tri.minY > bodyMaxY) continue;

          let bestX = px;
          let bestZ = pz;
          let bestDistSq = Infinity;

          if (
            pointInTriXZ(
              posObj.x,
              posObj.z,
              tri.ax,
              tri.az,
              tri.bx,
              tri.bz,
              tri.cx,
              tri.cz,
            )
          ) {
            const nh = Math.hypot(tri.nx, tri.nz);
            if (nh > 1e-4) {
              const p = radius * 0.35;
              posObj.x += (tri.nx / nh) * p;
              posObj.z += (tri.nz / nh) * p;
              totalPush += p;
            }
            continue;
          }

          const [c1x, c1z] = closestPointOnSegmentXZ(
            posObj.x,
            posObj.z,
            tri.ax,
            tri.az,
            tri.bx,
            tri.bz,
          );
          const d1 = (posObj.x - c1x) * (posObj.x - c1x) + (posObj.z - c1z) * (posObj.z - c1z);
          if (d1 < bestDistSq) {
            bestDistSq = d1;
            bestX = c1x;
            bestZ = c1z;
          }

          const [c2x, c2z] = closestPointOnSegmentXZ(
            posObj.x,
            posObj.z,
            tri.bx,
            tri.bz,
            tri.cx,
            tri.cz,
          );
          const d2 = (posObj.x - c2x) * (posObj.x - c2x) + (posObj.z - c2z) * (posObj.z - c2z);
          if (d2 < bestDistSq) {
            bestDistSq = d2;
            bestX = c2x;
            bestZ = c2z;
          }

          const [c3x, c3z] = closestPointOnSegmentXZ(
            posObj.x,
            posObj.z,
            tri.cx,
            tri.cz,
            tri.ax,
            tri.az,
          );
          const d3 = (posObj.x - c3x) * (posObj.x - c3x) + (posObj.z - c3z) * (posObj.z - c3z);
          if (d3 < bestDistSq) {
            bestDistSq = d3;
            bestX = c3x;
            bestZ = c3z;
          }

          if (bestDistSq < rSq && bestDistSq > 1e-8) {
            const dist = Math.sqrt(bestDistSq);
            const push = radius - dist;
            posObj.x += ((posObj.x - bestX) / dist) * push;
            posObj.z += ((posObj.z - bestZ) / dist) * push;
            totalPush += push;
          }
        }
      }
    }
    return totalPush;
  }

  public raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number | null {
    const endX = origin.x + dir.x * maxDist;
    const endY = origin.y + dir.y * maxDist;
    const endZ = origin.z + dir.z * maxDist;
    const minRx = Math.min(origin.x, endX) - 0.5;
    const maxRx = Math.max(origin.x, endX) + 0.5;
    const minRy = Math.min(origin.y, endY) - 1.0;
    const maxRy = Math.max(origin.y, endY) + 1.0;
    const minRz = Math.min(origin.z, endZ) - 0.5;
    const maxRz = Math.max(origin.z, endZ) + 0.5;

    if (maxRx < this.minX || minRx > this.maxX || maxRz < this.minZ || minRz > this.maxZ) {
      return null;
    }

    const stepSize = Math.min(2.4, Math.max(1.2, this.cellSize * 0.4));
    const numSteps = Math.max(1, Math.ceil(maxDist / stepSize));
    const stamp = ++this.stampCounter;
    let bestT = maxDist + 1;
    let prevIx = Number.NaN;
    let prevIz = Number.NaN;

    for (let s = 0; s <= numSteps; s++) {
      const dist = (s / numSteps) * maxDist;
      if (dist > bestT) break;
      const sx = origin.x + dir.x * dist;
      const sz = origin.z + dir.z * dist;
      const ix = Math.floor(sx / this.cellSize);
      const iz = Math.floor(sz / this.cellSize);
      if (ix === prevIx && iz === prevIz) continue;
      prevIx = ix;
      prevIz = iz;

      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const tris = this.allCells.get(this.key(ix + ox, iz + oz));
          if (!tris) continue;
          for (let i = 0; i < tris.length; i++) {
            const tri = tris[i];
            if (tri.stamp === stamp) continue;
            tri.stamp = stamp;

            if (tri.maxY < minRy || tri.minY > maxRy) continue;

            _tA.set(tri.ax, tri.ay, tri.az);
            _tE1.set(tri.bx - tri.ax, tri.by - tri.ay, tri.bz - tri.az);
            _tE2.set(tri.cx - tri.ax, tri.cy - tri.ay, tri.cz - tri.az);
            _tP.crossVectors(dir, _tE2);
            const det = _tE1.dot(_tP);
            if (Math.abs(det) < 1e-7) continue;
            const invDet = 1 / det;
            _tTvec.subVectors(origin, _tA);
            const u = _tTvec.dot(_tP) * invDet;
            if (u < 0 || u > 1) continue;
            _tQ.crossVectors(_tTvec, _tE1);
            const v = dir.dot(_tQ) * invDet;
            if (v < 0 || u + v > 1) continue;
            const t = _tE2.dot(_tQ) * invDet;
            if (t > 0.05 && t < bestT && t <= maxDist) {
              bestT = t;
            }
          }
        }
      }
    }

    return bestT <= maxDist ? bestT : null;
  }
}

export interface BermudaBuildingSpot {
  x: number;
  z: number;
  w: number;
  d: number;
  groundY: number;
  topY: number;
  secondFloorY: number | null;
  name: string;
}

const SKIP_BUILDING_RE =
  /terrain|water|ocean|sea|sky|cloud|road|highway|airport_road|p_road|grass|tree|bush|palm|rock|cliff|mountain|sand|beach|Text_Material/i;

export function extractBermudaBuildingSpots(
  root: THREE.Object3D,
  grid: MeshCollisionGrid,
): BermudaBuildingSpot[] {
  root.updateMatrixWorld(true);
  const spots: BermudaBuildingSpot[] = [];
  const meshBox = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  root.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    if (!mesh.visible || SKIP_BUILDING_RE.test(mesh.name)) return;
    const geo = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geo) return;
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (!geo.boundingBox) return;

    meshBox.copy(geo.boundingBox).applyMatrix4(mesh.matrixWorld);
    meshBox.getSize(size);
    meshBox.getCenter(center);

    // Keep real house/compound/hangar structures inside the island bounds
    if (
      Math.abs(center.x) > 940 ||
      Math.abs(center.z) > 840 ||
      size.x < 4.5 ||
      size.z < 4.5 ||
      size.x > 160 ||
      size.z > 160 ||
      size.y < 2.2
    ) {
      return;
    }

    // Deduplicate overlapping mesh parts in the same building footprint (~7m)
    for (let i = 0; i < spots.length; i++) {
      if (Math.hypot(spots[i].x - center.x, spots[i].z - center.z) < 7.0) {
        if (size.x * size.z > spots[i].w * spots[i].d) {
          spots[i].w = Math.max(spots[i].w, size.x);
          spots[i].d = Math.max(spots[i].d, size.z);
          spots[i].topY = Math.max(spots[i].topY, meshBox.max.y);
        }
        return;
      }
    }

    const groundY = grid.sampleTerrainHeight(center.x, center.z, meshBox.min.y);
    if (groundY < BERMUDA_GLB_WATER_Y + 0.1) return;

    const floorY = grid.sampleFloorHeight(center.x, center.z, groundY + 1.8, groundY);
    const secondCandidate = grid.sampleFloorHeight(
      center.x,
      center.z,
      groundY + 5.2,
      groundY,
    );
    const hasSecond =
      size.y >= 5.2 &&
      secondCandidate > floorY + 2.1 &&
      secondCandidate < floorY + 5.4;

    spots.push({
      x: center.x,
      z: center.z,
      w: Math.min(48, Math.max(6, size.x)),
      d: Math.min(48, Math.max(6, size.z)),
      groundY: floorY,
      topY: meshBox.max.y,
      secondFloorY: hasSecond ? secondCandidate : null,
      name: mesh.name || 'structure',
    });
  });

  return spots;
}

export function generateBermudaMinimapCanvas(
  grid: MeshCollisionGrid,
  buildings: MinimapBuilding[],
  mapRange = BERMUDA_GLB_MAP_RANGE,
): HTMLCanvasElement {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const img = ctx.createImageData(size, size);
  const data = img.data;
  const span = mapRange * 2;

  for (let py = 0; py < size; py++) {
    const wz = -mapRange + ((py + 0.5) / size) * span;
    for (let px = 0; px < size; px++) {
      const wx = -mapRange + ((px + 0.5) / size) * span;
      const idx = (py * size + px) * 4;

      const tY = grid.sampleTerrainHeight(wx, wz, -999);
      const topY = grid.sampleFloorHeight(wx, wz, 140, -999);

      if (tY <= -900 || tY < BERMUDA_GLB_WATER_Y - 0.15) {
        // Ocean water with subtle shallow turquoise halo near coastline
        const shallow = tY > -4.2 && tY > -900;
        data[idx] = shallow ? 31 : 20;
        data[idx + 1] = shallow ? 136 : 73;
        data[idx + 2] = shallow ? 172 : 110;
        data[idx + 3] = 255;
      } else if (tY < BERMUDA_GLB_WATER_Y + 0.85) {
        // Sandy shoreline
        data[idx] = 216;
        data[idx + 1] = 192;
        data[idx + 2] = 132;
        data[idx + 3] = 255;
      } else if (topY > tY + 2.2) {
        // Roof / compound structure surface
        data[idx] = 185;
        data[idx + 1] = 176;
        data[idx + 2] = 158;
        data[idx + 3] = 255;
      } else {
        // Natural terrain shaded by altitude
        const elev = THREE.MathUtils.clamp((tY + 1) / 38, 0, 1);
        data[idx] = Math.round(86 + elev * 42);
        data[idx + 1] = Math.round(118 + elev * 28);
        data[idx + 2] = Math.round(62 + elev * 20);
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(img, 0, 0);

  // Subtle contour outlines for detected building footprints
  const worldToPx = size / span;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const px = (b.x + mapRange) * worldToPx;
    const py = (b.z + mapRange) * worldToPx;
    const bw = Math.max(2.6, b.w * worldToPx);
    const bd = Math.max(2.6, b.d * worldToPx);
    ctx.fillStyle = b.kind === 'sobrado' || b.kind === 'tower' ? '#f59e0b' : '#e7dcc2';
    ctx.strokeStyle = '#3b2f20';
    ctx.lineWidth = 0.8;
    ctx.fillRect(px - bw * 0.5, py - bd * 0.5, bw, bd);
    ctx.strokeRect(px - bw * 0.5, py - bd * 0.5, bw, bd);
  }

  return canvas;
}
