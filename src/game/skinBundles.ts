import * as THREE from 'three';
import { GLTFLoader, type GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FF_SCENE_SCALE, getModelAssetPack } from './adamAssets';
import type { CharacterModelId, SkinGender, SkinSlotKey } from './types';

export const SKIN_CDN_BASE = 'https://kalidade-br.github.io/freefire-2017/skin';

export interface SkinCatalogBundleRef {
  id: string;
  gender: SkinGender;
  number: number;
  url: string;
}

export interface ExtractedSkinPiece {
  pieceId: string; // e.g. "male:1:shirt"
  bundleId: string; // e.g. "male:1"
  gender: SkinGender;
  bundleNumber: number;
  slot: SkinSlotKey;
  geometry: THREE.BufferGeometry; // normalized to 1.74m upright +Z facing
  material: THREE.MeshLambertMaterial;
  thumbnailUrl: string | null;
  box: THREE.Box3;
}

interface SourceJointLayout {
  joints: Record<string, THREE.Vector3>;
  limbDirs: Record<string, THREE.Vector3>;
  ankleSplitX: number;
  kneeSplitX: number;
  hipSplitX: number;
  crotchY: number;
  waistSplitWidth: number;
}

export interface LoadedSkinBundle {
  id: string;
  gender: SkinGender;
  number: number;
  url: string;
  layout: SourceJointLayout;
  pieces: Partial<Record<SkinSlotKey, ExtractedSkinPiece>>;
}

interface SpecGlossExtension {
  diffuseFactor?: [number, number, number, number];
  diffuseTexture?: { index: number; texCoord?: number };
}

function registerSpecGlossPlugin(loader: GLTFLoader): void {
  loader.register((parser: GLTFParser) => ({
    name: 'KHR_materials_pbrSpecularGlossiness',
    getMaterialType: (materialIndex: number) => {
      const matDef = parser.json.materials?.[materialIndex];
      if (matDef?.extensions?.KHR_materials_pbrSpecularGlossiness) {
        return THREE.MeshLambertMaterial;
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

let catalogEntries: SkinCatalogBundleRef[] = [
  { id: 'male:1', gender: 'male', number: 1, url: `${SKIN_CDN_BASE}/male/1.glb` },
  { id: 'female:1', gender: 'female', number: 1, url: `${SKIN_CDN_BASE}/female/1.glb` },
];
let catalogFetched = false;
let catalogPromise: Promise<SkinCatalogBundleRef[]> | null = null;
const loadedBundles = new Map<string, LoadedSkinBundle>();
const bundleLoadPromises = new Map<string, Promise<LoadedSkinBundle | null>>();
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore subscriber callback error
    }
  });
}

export function subscribeSkinBundles(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSkinCatalogRefs(): SkinCatalogBundleRef[] {
  return catalogEntries;
}

export function getLoadedSkinBundle(bundleId: string): LoadedSkinBundle | undefined {
  return loadedBundles.get(bundleId);
}

export function getAllLoadedSkinPieces(
  slot?: SkinSlotKey,
  genderFilter: SkinGender | 'all' = 'all',
): ExtractedSkinPiece[] {
  const out: ExtractedSkinPiece[] = [];
  for (let i = 0; i < catalogEntries.length; i++) {
    const ref = catalogEntries[i];
    if (genderFilter !== 'all' && ref.gender !== genderFilter) continue;
    const bundle = loadedBundles.get(ref.id);
    if (!bundle) continue;
    if (slot) {
      const p = bundle.pieces[slot];
      if (p) out.push(p);
    } else {
      (['head', 'mask', 'shirt', 'pants', 'shoes'] as SkinSlotKey[]).forEach((s) => {
        const p = bundle.pieces[s];
        if (p) out.push(p);
      });
    }
  }
  return out;
}

export function getSkinPieceById(pieceId: string): ExtractedSkinPiece | null {
  const parts = pieceId.split(':');
  if (parts.length !== 3) return null;
  const bundleId = `${parts[0]}:${parts[1]}`;
  const slot = parts[2] as SkinSlotKey;
  const bundle = loadedBundles.get(bundleId);
  return bundle?.pieces[slot] ?? null;
}

export async function discoverSkinCatalog(): Promise<SkinCatalogBundleRef[]> {
  if (catalogFetched) return catalogEntries;
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    try {
      const resp = await fetch('/api/skins/catalog');
      if (resp.ok) {
        const json = (await resp.json()) as {
          male?: SkinCatalogBundleRef[];
          female?: SkinCatalogBundleRef[];
        };
        const merged: SkinCatalogBundleRef[] = [
          ...(Array.isArray(json.male) ? json.male : []),
          ...(Array.isArray(json.female) ? json.female : []),
        ];
        if (merged.length > 0) {
          catalogEntries = merged;
        }
      }
    } catch {
      // Fallback to default male/1 & female/1
    } finally {
      catalogFetched = true;
    }
    return catalogEntries;
  })();

  return catalogPromise;
}

function createSharedLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');
  loader.setDRACOLoader(dracoLoader);
  registerSpecGlossPlugin(loader);
  return loader;
}

function toClassicLambertMaterial(raw: THREE.Material | THREE.Material[]): THREE.MeshLambertMaterial {
  const mat = Array.isArray(raw) ? raw[0] : raw;
  if (!mat) {
    return new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  }
  const pbr = mat as THREE.MeshStandardMaterial;
  const map = pbr.map ?? null;
  if (map) {
    if (map.colorSpace !== THREE.SRGBColorSpace) {
      map.colorSpace = THREE.SRGBColorSpace;
    }
    map.anisotropy = 1;
    map.needsUpdate = true;
  }

  const extraTexKeys = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'emissiveMap'] as const;
  for (let i = 0; i < extraTexKeys.length; i++) {
    const tex = (pbr as unknown as Record<string, THREE.Texture | null | undefined>)[extraTexKeys[i]];
    if (tex && tex !== map) tex.dispose();
  }

  const next = new THREE.MeshLambertMaterial({
    name: mat.name,
    color: pbr.color ? pbr.color.clone() : new THREE.Color(0xffffff),
    map,
    transparent: Boolean(mat.transparent),
    opacity: typeof mat.opacity === 'number' ? mat.opacity : 1,
    alphaTest: typeof mat.alphaTest === 'number' && mat.alphaTest > 0 ? mat.alphaTest : 0.12,
    side: THREE.DoubleSide,
    vertexColors: Boolean(mat.vertexColors),
  });
  mat.dispose();
  return next;
}

interface RawExtractedPart {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshLambertMaterial;
  box: THREE.Box3;
  avgX: number;
  avgY: number;
  avgZ: number;
  vertexCount: number;
}

function findLargestXGap(xs: number[]): { splitX: number; gapWidth: number } {
  if (xs.length < 4) return { splitX: 0, gapWidth: 0 };
  xs.sort((a, b) => a - b);
  let bestGap = 0;
  let bestMid = 0;
  for (let i = 1; i < xs.length; i++) {
    const g = xs[i] - xs[i - 1];
    const mid = (xs[i] + xs[i - 1]) * 0.5;
    if (Math.abs(mid) <= 0.14 && g > bestGap) {
      bestGap = g;
      bestMid = mid;
    }
  }
  return { splitX: bestMid, gapWidth: bestGap };
}

function measureOutfitSkeletonLayout(
  allGeoms: THREE.BufferGeometry[],
): SourceJointLayout {
  const ankleXs: number[] = [];
  const kneeXs: number[] = [];
  const hipXs: number[] = [];

  for (let g = 0; g < allGeoms.length; g++) {
    const pos = allGeoms[g].getAttribute('position');
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      if (y >= 0.03 && y <= 0.16) ankleXs.push(x);
      else if (y >= 0.40 && y <= 0.55) kneeXs.push(x);
      else if (y >= 0.62 && y <= 0.78) hipXs.push(x);
    }
  }

  const ankleGap = findLargestXGap(ankleXs);
  const kneeGap = findLargestXGap(kneeXs);
  const hipGap = findLargestXGap(hipXs);
  const ankleSplitX = ankleGap.gapWidth > 0.03 ? ankleGap.splitX : 0;
  const kneeSplitX = kneeGap.gapWidth > 0.03 ? kneeGap.splitX : ankleSplitX;
  const hipSplitX = hipGap.gapWidth > 0.025 ? hipGap.splitX : kneeSplitX;

  const avgInBox = (
    pred: (x: number, y: number, z: number) => boolean,
    fallback: readonly [number, number, number],
  ): THREE.Vector3 => {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let count = 0;
    for (let g = 0; g < allGeoms.length; g++) {
      const pos = allGeoms[g].getAttribute('position');
      if (!pos) continue;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        if (pred(x, y, z)) {
          sx += x;
          sy += y;
          sz += z;
          count++;
        }
      }
    }
    if (count === 0) return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
    return new THREE.Vector3(sx / count, sy / count, sz / count);
  };

  // Spine & Head anchors
  const hips = avgInBox((x, y) => Math.abs(x) < 0.16 && y >= 0.84 && y <= 0.96, [0, 0.90, 0]);
  hips.x = 0;
  const spine = avgInBox((x, y) => Math.abs(x) < 0.16 && y >= 0.98 && y <= 1.08, [0, 1.03, 0]);
  spine.x = 0;
  const spine1 = avgInBox((x, y) => Math.abs(x) < 0.16 && y >= 1.12 && y <= 1.22, [0, 1.16, 0]);
  spine1.x = 0;
  const spine2 = avgInBox((x, y) => Math.abs(x) < 0.16 && y >= 1.26 && y <= 1.35, [0, 1.30, -0.01]);
  spine2.x = 0;
  const neck = avgInBox((x, y) => Math.abs(x) < 0.09 && y >= 1.40 && y <= 1.47, [0, 1.43, -0.01]);
  neck.x = 0;
  const head = avgInBox((x, y) => Math.abs(x) < 0.11 && y >= 1.49 && y <= 1.60, [0, 1.53, 0]);
  head.x = 0;
  const headTop = new THREE.Vector3(0, 1.74, head.z);

  // Measure arm trajectory outward from torso on left (+X) & right (-X)
  const measureSideArm = (side: 1 | -1) => {
    const shAnchor = avgInBox(
      (x, y) => side * x >= 0.14 && side * x <= 0.22 && y >= 1.26 && y <= 1.44,
      [side * 0.18, 1.36, -0.02],
    );
    const midArm = avgInBox(
      (x, y) => side * x >= 0.24 && side * x <= 0.36 && y >= 0.90 && y <= 1.46,
      [side * 0.30, 1.20, -0.03],
    );
    const farArm = avgInBox(
      (x, y) => side * x >= 0.38 && side * x <= 0.72 && y >= 0.75 && y <= 1.48,
      [side * 0.48, 1.00, -0.02],
    );

    // If the model has long arms (e.g. A-pose / T-pose), fit upperArm -> foreArm -> hand along arm axis
    const armAxis = farArm.clone().sub(shAnchor);
    if (armAxis.lengthSq() < 0.01) {
      armAxis.copy(midArm).sub(shAnchor);
    }
    if (armAxis.lengthSq() < 0.005) {
      armAxis.set(side * 0.65, -0.75, 0);
    }
    armAxis.normalize();

    const sh = shAnchor.clone();
    sh.x = side * Math.max(0.165, Math.abs(sh.x));
    const clavicle = new THREE.Vector3(side * 0.075, sh.y + 0.02, sh.z);
    const elbow = sh.clone().addScaledVector(armAxis, 0.245);
    const wrist = elbow.clone().addScaledVector(armAxis, 0.245);
    const finger = wrist.clone().addScaledVector(armAxis, 0.09);

    return { clavicle, sh, elbow, wrist, finger, armDir: armAxis.clone() };
  };

  const lArm = measureSideArm(1);
  const rArm = measureSideArm(-1);

  // Measure left (+X) and right (-X) leg chains using local gap splitX
  const measureSideLeg = (isLeft: boolean) => {
    const sideMatch = (x: number, split: number) => (isLeft ? x >= split + 0.01 : x <= split - 0.01);
    const up = avgInBox(
      (x, y) => sideMatch(x, hipSplitX) && Math.abs(x) < 0.24 && y >= 0.78 && y <= 0.90,
      [isLeft ? 0.10 : -0.10, 0.85, 0],
    );
    const knee = avgInBox(
      (x, y) => sideMatch(x, kneeSplitX) && Math.abs(x) < 0.26 && y >= 0.42 && y <= 0.52,
      [isLeft ? 0.12 : -0.12, 0.47, -0.02],
    );
    const foot = avgInBox(
      (x, y) => sideMatch(x, ankleSplitX) && Math.abs(x) < 0.30 && y >= 0.04 && y <= 0.14,
      [isLeft ? 0.14 : -0.14, 0.09, -0.02],
    );
    const toe = new THREE.Vector3(foot.x, 0.03, foot.z + 0.105);
    const thighDir = knee.clone().sub(up).normalize();
    const shinDir = foot.clone().sub(knee).normalize();
    return { up, knee, foot, toe, thighDir, shinDir };
  };

  const lLeg = measureSideLeg(true);
  const rLeg = measureSideLeg(false);

  const joints: Record<string, THREE.Vector3> = {
    mixamorigHips: hips,
    mixamorigSpine: spine,
    mixamorigSpine1: spine1,
    mixamorigSpine2: spine2,
    mixamorigNeck: neck,
    mixamorigHead: head,
    mixamorigHeadTop_End: headTop,
    mixamorigLeftShoulder: lArm.clavicle,
    mixamorigLeftArm: lArm.sh,
    mixamorigLeftForeArm: lArm.elbow,
    mixamorigLeftHand: lArm.wrist,
    mixamorigLeftHandMiddle1: lArm.finger,
    mixamorigRightShoulder: rArm.clavicle,
    mixamorigRightArm: rArm.sh,
    mixamorigRightForeArm: rArm.elbow,
    mixamorigRightHand: rArm.wrist,
    mixamorigRightHandMiddle1: rArm.finger,
    mixamorigLeftUpLeg: lLeg.up,
    mixamorigLeftLeg: lLeg.knee,
    mixamorigLeftFoot: lLeg.foot,
    mixamorigLeftToeBase: lLeg.toe,
    mixamorigRightUpLeg: rLeg.up,
    mixamorigRightLeg: rLeg.knee,
    mixamorigRightFoot: rLeg.foot,
    mixamorigRightToeBase: rLeg.toe,
  };

  const limbDirs: Record<string, THREE.Vector3> = {
    mixamorigLeftArm: lArm.armDir,
    mixamorigLeftForeArm: lArm.armDir,
    mixamorigRightArm: rArm.armDir,
    mixamorigRightForeArm: rArm.armDir,
    mixamorigLeftUpLeg: lLeg.thighDir,
    mixamorigLeftLeg: lLeg.shinDir,
    mixamorigRightUpLeg: rLeg.thighDir,
    mixamorigRightLeg: rLeg.shinDir,
  };

  return {
    joints,
    limbDirs,
    ankleSplitX,
    kneeSplitX,
    hipSplitX,
    crotchY: 0.72,
    waistSplitWidth: hipGap.gapWidth,
  };
}

function renderBundleThumbnails(
  pieces: Partial<Record<SkinSlotKey, ExtractedSkinPiece>>,
): void {
  const entries = (['head', 'mask', 'shirt', 'pants', 'shoes'] as SkinSlotKey[])
    .map((slot) => pieces[slot])
    .filter((p): p is ExtractedSkinPiece => Boolean(p));
  if (entries.length === 0) return;

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      depth: true,
      stencil: false,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(144, 144, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    const scene = new THREE.Scene();
    const amb = new THREE.AmbientLight(0xffffff, 1.55);
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.85);
    const sun = new THREE.DirectionalLight(0xfff4dd, 1.35);
    sun.position.set(1.4, 2.2, 2.6);
    scene.add(amb, hemi, sun);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.04, 15);
    const fovRad = THREE.MathUtils.degToRad(32);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    for (let i = 0; i < entries.length; i++) {
      const piece = entries[i];
      const mesh = new THREE.Mesh(piece.geometry, piece.material);
      const yaw =
        piece.slot === 'shoes'
          ? -0.52
          : piece.slot === 'shirt' || piece.slot === 'pants'
            ? -0.26
            : -0.32;
      mesh.rotation.y = yaw;
      scene.add(mesh);
      mesh.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(mesh);
      box.getCenter(center);
      box.getSize(size);
      const radius = Math.max(0.08, size.length() * 0.5);
      const dist = (radius / Math.sin(fovRad * 0.5)) * 1.15;

      camera.position.set(
        center.x,
        center.y + (piece.slot === 'shoes' ? 0.08 : 0.03),
        center.z + dist,
      );
      camera.lookAt(center);
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      piece.thumbnailUrl = renderer.domElement.toDataURL('image/png');
      scene.remove(mesh);
    }
  } catch {
    // Graceful fallback if WebGL thumbnail context unavailable
  } finally {
    renderer?.dispose();
  }
}

function processRawSkinBundle(
  ref: SkinCatalogBundleRef,
  rawScene: THREE.Group,
): LoadedSkinBundle {
  rawScene.updateMatrixWorld(true);

  const rawMeshes: Array<{
    name: string;
    geometry: THREE.BufferGeometry;
    material: THREE.MeshLambertMaterial;
    box: THREE.Box3;
  }> = [];
  const totalBox = new THREE.Box3();
  const vTmp = new THREE.Vector3();

  rawScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geom = mesh.geometry.clone();
    const pos = geom.getAttribute('position');
    if (!pos) return;

    mesh.updateWorldMatrix(true, false);
    const normMat = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const norm = geom.getAttribute('normal');
    const meshBox = new THREE.Box3();

    for (let i = 0; i < pos.count; i++) {
      vTmp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      pos.setXYZ(i, vTmp.x, vTmp.y, vTmp.z);
      meshBox.expandByPoint(vTmp);
      totalBox.expandByPoint(vTmp);
      if (norm) {
        vTmp.fromBufferAttribute(norm, i).applyMatrix3(normMat).normalize();
        norm.setXYZ(i, vTmp.x, vTmp.y, vTmp.z);
      }
    }
    pos.needsUpdate = true;
    if (norm) norm.needsUpdate = true;
    else geom.computeVertexNormals();

    rawMeshes.push({
      name: mesh.name || `Part_${rawMeshes.length}`,
      geometry: geom,
      material: toClassicLambertMaterial(mesh.material),
      box: meshBox,
    });
  });

  const rawMinY = Number.isFinite(totalBox.min.y) ? totalBox.min.y : 0;
  const rawMaxY = Number.isFinite(totalBox.max.y) ? totalBox.max.y : 1;
  const worldScale = 1.74 / Math.max(1e-4, rawMaxY - rawMinY);

  // Robust X/Z centering around torso+head core (ignoring outstretched hands or asymmetric feet)
  const coreBox = new THREE.Box3();
  for (let m = 0; m < rawMeshes.length; m++) {
    const pos = rawMeshes[m].geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const yMeters = (pos.getY(i) - rawMinY) * worldScale;
      if (yMeters >= 0.52 && yMeters <= 1.66) {
        const xm = pos.getX(i) * worldScale;
        const ym = yMeters;
        const zm = pos.getZ(i) * worldScale;
        // Include central core points
        if (Math.abs(xm) < 0.24 || ym < 1.20) {
          vTmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
          coreBox.expandByPoint(vTmp);
        }
      }
    }
  }
  const centerSourceBox = coreBox.isEmpty() ? totalBox : coreBox;
  const centerX = (centerSourceBox.min.x + centerSourceBox.max.x) * 0.5;
  const centerZ = (centerSourceBox.min.z + centerSourceBox.max.z) * 0.5;

  // Normalize all mesh geometries into upright +Z facing 1.74m meter space
  const extractedParts: RawExtractedPart[] = [];
  for (let m = 0; m < rawMeshes.length; m++) {
    const entry = rawMeshes[m];
    const pos = entry.geometry.getAttribute('position');
    const nBox = new THREE.Box3();
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = (pos.getX(i) - centerX) * worldScale;
      const y = (pos.getY(i) - rawMinY) * worldScale;
      const z = (pos.getZ(i) - centerZ) * worldScale;
      pos.setXYZ(i, x, y, z);
      vTmp.set(x, y, z);
      nBox.expandByPoint(vTmp);
      sx += x;
      sy += y;
      sz += z;
    }
    pos.needsUpdate = true;
    entry.geometry.computeBoundingBox();
    entry.geometry.computeBoundingSphere();

    extractedParts.push({
      name: entry.name,
      geometry: entry.geometry,
      material: entry.material,
      box: nBox,
      avgX: pos.count > 0 ? sx / pos.count : 0,
      avgY: pos.count > 0 ? sy / pos.count : 0,
      avgZ: pos.count > 0 ? sz / pos.count : 0,
      vertexCount: pos.count,
    });
  }

  // Classify every mesh semantically into body | shoes | pants | shirt | head | mask
  const pieces: Partial<Record<SkinSlotKey, ExtractedSkinPiece>> = {};
  const headRegionCandidates: RawExtractedPart[] = [];
  const allNormalizedGeoms = extractedParts.map((p) => p.geometry);

  const assignPiece = (slot: SkinSlotKey, part: RawExtractedPart) => {
    pieces[slot] = {
      pieceId: `${ref.id}:${slot}`,
      bundleId: ref.id,
      gender: ref.gender,
      bundleNumber: ref.number,
      slot,
      geometry: part.geometry,
      material: part.material,
      thumbnailUrl: null,
      box: part.box,
    };
  };

  for (let i = 0; i < extractedParts.length; i++) {
    const p = extractedParts[i];
    const yMin = p.box.min.y;
    const yMax = p.box.max.y;
    const ySpan = yMax - yMin;
    const xSpan = p.box.max.x - p.box.min.x;

    // 1. Base body mesh (never selectable as a skin piece)
    if (ySpan > 1.22 || (yMin < 0.25 && yMax > 1.42)) {
      continue;
    }
    // 2. Shoes
    if (yMax <= 0.42 && yMin < 0.14) {
      if (!pieces.shoes || p.vertexCount > pieces.shoes.geometry.getAttribute('position').count) {
        assignPiece('shoes', p);
      }
      continue;
    }
    // 3. Pants / Skirt / Shorts
    if (yMin < 0.65 && yMax <= 1.22 && p.avgY < 0.98) {
      if (!pieces.pants || p.vertexCount > pieces.pants.geometry.getAttribute('position').count) {
        assignPiece('pants', p);
      }
      continue;
    }
    // 4. Shirt / Jacket / Top
    if (yMin >= 0.68 && yMax <= 1.58 && yMin < 1.32 && (xSpan > 0.24 || p.avgY < 1.43)) {
      if (!pieces.shirt || p.vertexCount > pieces.shirt.geometry.getAttribute('position').count) {
        assignPiece('shirt', p);
      }
      continue;
    }
    // 5. Head / Hair / Mask / Facewear
    headRegionCandidates.push(p);
  }

  if (headRegionCandidates.length === 1) {
    const only = headRegionCandidates[0];
    if (only.box.max.y >= 1.62 || only.avgY >= 1.57) {
      assignPiece('head', only);
    } else {
      assignPiece('mask', only);
    }
  } else if (headRegionCandidates.length >= 2) {
    headRegionCandidates.sort(
      (a, b) =>
        b.box.max.y - a.box.max.y ||
        b.avgY - a.avgY ||
        b.vertexCount - a.vertexCount,
    );
    assignPiece('head', headRegionCandidates[0]);
    // Secondary head mesh (prefer lower/forward mask over extra accessory)
    const rest = headRegionCandidates.slice(1).sort((a, b) => a.avgY - b.avgY || b.avgZ - a.avgZ);
    assignPiece('mask', rest[0]);
  }

  const layout = measureOutfitSkeletonLayout(allNormalizedGeoms);
  renderBundleThumbnails(pieces);

  return {
    id: ref.id,
    gender: ref.gender,
    number: ref.number,
    url: ref.url,
    layout,
    pieces,
  };
}

export function ensureSkinBundleLoaded(bundleId: string): Promise<LoadedSkinBundle | null> {
  const existing = loadedBundles.get(bundleId);
  if (existing) return Promise.resolve(existing);

  const inFlight = bundleLoadPromises.get(bundleId);
  if (inFlight) return inFlight;

  const ref =
    catalogEntries.find((c) => c.id === bundleId) ??
    (() => {
      const [g, numStr] = bundleId.split(':');
      const num = Number(numStr);
      if ((g === 'male' || g === 'female') && Number.isFinite(num) && num >= 1) {
        return {
          id: bundleId,
          gender: g as SkinGender,
          number: Math.round(num),
          url: `${SKIN_CDN_BASE}/${g}/${Math.round(num)}.glb`,
        };
      }
      return null;
    })();

  if (!ref) return Promise.resolve(null);

  const loader = createSharedLoader();
  const promise = new Promise<LoadedSkinBundle | null>((resolve) => {
    loader.load(
      ref.url,
      (gltf) => {
        try {
          const bundle = processRawSkinBundle(ref, gltf.scene);
          loadedBundles.set(bundle.id, bundle);
          notifyListeners();
          resolve(bundle);
        } catch {
          resolve(null);
        }
      },
      undefined,
      () => {
        resolve(null);
      },
    );
  });

  bundleLoadPromises.set(bundleId, promise);
  return promise;
}

export async function preloadSkinBundles(): Promise<void> {
  const refs = await discoverSkinCatalog();
  // Preload all discovered bundles in parallel (currently male/1 & female/1, lightweight ~1MB each)
  await Promise.all(refs.slice(0, 8).map((r) => ensureSkinBundleLoaded(r.id)));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function projectT(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const lenSq = dx * dx + dy * dy + dz * dz;
  if (lenSq < 1e-8) return 0;
  return THREE.MathUtils.clamp(
    ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / lenSq,
    0,
    1,
  );
}

function addBoneWeight(
  entries: Array<{ idx: number; w: number }>,
  boneIndexMap: Map<string, number>,
  boneName: string,
  w: number,
): void {
  if (w <= 1e-5) return;
  const idx = boneIndexMap.get(boneName);
  if (idx === undefined) return;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].idx === idx) {
      entries[i].w += w;
      return;
    }
  }
  entries.push({ idx, w });
}

function addChainWeight(
  entries: Array<{ idx: number; w: number }>,
  boneIndexMap: Map<string, number>,
  joints: Record<string, THREE.Vector3>,
  x: number,
  y: number,
  z: number,
  chain: ReadonlyArray<string>,
  scale: number,
  feather = 0.24,
): void {
  if (scale <= 1e-5) return;
  let bestSeg = 0;
  let bestT = 0;
  let bestDistSq = Infinity;

  for (let s = 0; s < chain.length - 1; s++) {
    const a = joints[chain[s]];
    const b = joints[chain[s + 1]];
    if (!a || !b) continue;
    const t = projectT(x, y, z, a.x, a.y, a.z, b.x, b.y, b.z);
    const qx = a.x + (b.x - a.x) * t;
    const qy = a.y + (b.y - a.y) * t;
    const qz = a.z + (b.z - a.z) * t;
    const dSq = (x - qx) * (x - qx) + (y - qy) * (y - qy) + (z - qz) * (z - qz);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestSeg = s;
      bestT = t;
    }
  }

  const boneA = chain[bestSeg];
  const boneB = chain[bestSeg + 1];

  if (bestSeg === chain.length - 2) {
    const isFootTip = boneA.endsWith('Foot');
    const tipFeather = isFootTip ? 0.14 : 0.15;
    if (bestSeg > 0 && bestT < tipFeather) {
      if (isFootTip) {
        const ankleY = joints[boneA]?.y ?? 0.09;
        const ankleBlend = smoothstep(ankleY - 0.022, ankleY + 0.032, y);
        const f = smoothstep(0, tipFeather, bestT) * 0.5 + 0.5;
        const shinW = (1 - f) * ankleBlend;
        addBoneWeight(entries, boneIndexMap, chain[bestSeg - 1], scale * shinW);
        addBoneWeight(entries, boneIndexMap, boneA, scale * (1 - shinW));
        return;
      }
      const f = smoothstep(0, tipFeather, bestT) * 0.5 + 0.5;
      addBoneWeight(entries, boneIndexMap, chain[bestSeg - 1], scale * (1 - f));
      addBoneWeight(entries, boneIndexMap, boneA, scale * f);
      return;
    }
    addBoneWeight(entries, boneIndexMap, boneA, scale);
    return;
  }

  if (bestSeg > 0 && bestT < feather) {
    const f = smoothstep(0, feather, bestT) * 0.5 + 0.5;
    addBoneWeight(entries, boneIndexMap, chain[bestSeg - 1], scale * (1 - f));
    addBoneWeight(entries, boneIndexMap, boneA, scale * f);
  } else if (bestT > 1 - feather) {
    let f = smoothstep(1 - feather, 1, bestT) * 0.5;
    if (boneB.endsWith('Foot')) {
      const ankleY = joints[boneB]?.y ?? 0.09;
      const ankleBlend = smoothstep(ankleY - 0.022, ankleY + 0.032, y);
      f = 1 - (1 - f) * ankleBlend;
    }
    addBoneWeight(entries, boneIndexMap, boneA, scale * (1 - f));
    addBoneWeight(entries, boneIndexMap, boneB, scale * f);
  } else {
    addBoneWeight(entries, boneIndexMap, boneA, scale);
  }
}

function addTorsoWeight(
  entries: Array<{ idx: number; w: number }>,
  boneIndexMap: Map<string, number>,
  joints: Record<string, THREE.Vector3>,
  y: number,
  scale: number,
): void {
  if (scale <= 1e-5) return;
  const hipsY = joints.mixamorigHips?.y ?? 0.90;
  const spineY = joints.mixamorigSpine?.y ?? 1.03;
  const spine1Y = joints.mixamorigSpine1?.y ?? 1.16;
  const spine2Y = joints.mixamorigSpine2?.y ?? 1.30;
  const neckY = joints.mixamorigNeck?.y ?? 1.43;

  if (y <= hipsY) {
    addBoneWeight(entries, boneIndexMap, 'mixamorigHips', scale);
  } else if (y <= spineY) {
    const t = smoothstep(hipsY, spineY, y);
    addBoneWeight(entries, boneIndexMap, 'mixamorigHips', scale * (1 - t));
    addBoneWeight(entries, boneIndexMap, 'mixamorigSpine', scale * t);
  } else if (y <= spine1Y) {
    const t = smoothstep(spineY, spine1Y, y);
    addBoneWeight(entries, boneIndexMap, 'mixamorigSpine', scale * (1 - t));
    addBoneWeight(entries, boneIndexMap, 'mixamorigSpine1', scale * t);
  } else if (y <= spine2Y) {
    const t = smoothstep(spine1Y, spine2Y, y);
    addBoneWeight(entries, boneIndexMap, 'mixamorigSpine1', scale * (1 - t));
    addBoneWeight(entries, boneIndexMap, 'mixamorigSpine2', scale * t);
  } else if (y <= neckY) {
    const t = smoothstep(spine2Y, neckY, y);
    const nw = t * 0.55;
    addBoneWeight(entries, boneIndexMap, 'mixamorigSpine2', scale * (1 - nw));
    addBoneWeight(entries, boneIndexMap, 'mixamorigNeck', scale * nw);
  } else {
    const t = smoothstep(neckY, neckY + 0.08, y);
    addBoneWeight(entries, boneIndexMap, 'mixamorigSpine2', scale * (0.45 - 0.15 * t));
    addBoneWeight(entries, boneIndexMap, 'mixamorigNeck', scale * (0.55 + 0.15 * t));
  }
}

export function createFittedSkinPieceMesh(
  pieceId: string,
  targetModelId: CharacterModelId,
  targetClonedScene: THREE.Group,
): THREE.SkinnedMesh | null {
  const piece = getSkinPieceById(pieceId);
  if (!piece) return null;

  const bundle = loadedBundles.get(piece.bundleId);
  const pack = getModelAssetPack(targetModelId);
  if (!bundle || !pack) return null;

  // Locate target skeleton bones on the live clonedScene and their bind world poses on pack.baseScene
  let refSkinned: THREE.SkinnedMesh | null = null;
  targetClonedScene.traverse((obj) => {
    if (!refSkinned && (obj as THREE.SkinnedMesh).isSkinnedMesh) {
      refSkinned = obj as THREE.SkinnedMesh;
    }
  });
  if (!refSkinned || !(refSkinned as THREE.SkinnedMesh).skeleton) return null;
  const targetLiveBones = (refSkinned as THREE.SkinnedMesh).skeleton.bones;
  if (targetLiveBones.length === 0) return null;

  const boneIndexMap = new Map<string, number>();
  for (let i = 0; i < targetLiveBones.length; i++) {
    boneIndexMap.set(targetLiveBones[i].name, i);
  }

  // Capture bind-pose bone world transforms & limb directions directly from pack.baseScene (never mutated at runtime)
  pack.baseScene.updateMatrixWorld(true);
  const targetBindWorld = new Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 }>();
  for (let i = 0; i < targetLiveBones.length; i++) {
    const bName = targetLiveBones[i].name;
    const baseBone = pack.baseScene.getObjectByName(bName);
    if (baseBone) {
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      baseBone.matrixWorld.decompose(pos, quat, scale);
      targetBindWorld.set(bName, { pos, quat, scale });
    }
  }

  const getTargetDir = (aName: string, bName: string): THREE.Vector3 | null => {
    const a = targetBindWorld.get(aName)?.pos;
    const b = targetBindWorld.get(bName)?.pos;
    if (!a || !b) return null;
    const d = b.clone().sub(a);
    return d.lengthSq() > 1e-6 ? d.normalize() : null;
  };

  const targetLimbDirs: Record<string, THREE.Vector3 | null> = {
    mixamorigLeftArm: getTargetDir('mixamorigLeftArm', 'mixamorigLeftForeArm'),
    mixamorigLeftForeArm: getTargetDir('mixamorigLeftForeArm', 'mixamorigLeftHand'),
    mixamorigRightArm: getTargetDir('mixamorigRightArm', 'mixamorigRightForeArm'),
    mixamorigRightForeArm: getTargetDir('mixamorigRightForeArm', 'mixamorigRightHand'),
    mixamorigLeftUpLeg: getTargetDir('mixamorigLeftUpLeg', 'mixamorigLeftLeg'),
    mixamorigLeftLeg: getTargetDir('mixamorigLeftLeg', 'mixamorigLeftFoot'),
    mixamorigRightUpLeg: getTargetDir('mixamorigRightUpLeg', 'mixamorigRightLeg'),
    mixamorigRightLeg: getTargetDir('mixamorigRightLeg', 'mixamorigRightFoot'),
  };

  // Compute boneInverses adapted to the outfit's rest pose & joint locations
  const layout = bundle.layout;
  const adaptedInverses: THREE.Matrix4[] = [];
  const qAlign = new THREE.Quaternion();
  const qComposed = new THREE.Quaternion();
  const mOutfitBone = new THREE.Matrix4();

  for (let i = 0; i < targetLiveBones.length; i++) {
    const bName = targetLiveBones[i].name;
    const tBind = targetBindWorld.get(bName);
    if (!tBind) {
      adaptedInverses.push(new THREE.Matrix4());
      continue;
    }

    const outfitPos = layout.joints[bName] ?? tBind.pos;
    const srcDir = layout.limbDirs[bName];
    const dstDir = targetLimbDirs[bName];
    qAlign.identity();
    if (srcDir && dstDir) {
      const dot = THREE.MathUtils.clamp(dstDir.dot(srcDir), -1, 1);
      if (dot < 0.9999) {
        if (dot < -0.9999) {
          qAlign.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
        } else {
          qAlign.setFromUnitVectors(dstDir, srcDir);
        }
      }
    }

    qComposed.copy(qAlign).multiply(tBind.quat).normalize();
    mOutfitBone.compose(outfitPos, qComposed, tBind.scale);
    adaptedInverses.push(mOutfitBone.clone().invert());
  }

  // Skin the piece geometry cleanly in 1.74m upright outfit space
  const geom = piece.geometry.clone();
  const pos = geom.getAttribute('position');
  const count = pos.count;
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);

  const headIdx = boneIndexMap.get('mixamorigHead') ?? 0;
  const hipsIdx = boneIndexMap.get('mixamorigHips') ?? 0;

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const entries: Array<{ idx: number; w: number }> = [];

    if (piece.slot === 'mask') {
      addBoneWeight(entries, boneIndexMap, 'mixamorigHead', 1);
    } else if (piece.slot === 'head') {
      if (y >= 1.44) {
        addBoneWeight(entries, boneIndexMap, 'mixamorigHead', 1);
      } else {
        // Long female hair draping below neck smoothly follows head + upper spine without piercing shoulders
        const t = smoothstep(1.30, 1.45, y);
        addBoneWeight(entries, boneIndexMap, 'mixamorigHead', 0.45 + 0.55 * t);
        addBoneWeight(entries, boneIndexMap, 'mixamorigSpine2', 0.55 * (1 - t));
      }
    } else if (piece.slot === 'shirt') {
      const absX = Math.abs(x);
      let armW = 0;
      if (y >= 1.02 && absX >= 0.145) {
        armW = smoothstep(0.14, 0.21, absX);
      }
      const torsoW = Math.max(0, 1 - armW);
      if (armW > 1e-4) {
        const isLeft = x >= 0;
        const armChain = isLeft
          ? ['mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand']
          : ['mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand'];
        addChainWeight(entries, boneIndexMap, layout.joints, x, y, z, armChain, armW, 0.24);
      }
      if (torsoW > 1e-4) {
        addTorsoWeight(entries, boneIndexMap, layout.joints, y, torsoW);
      }
    } else if (piece.slot === 'pants') {
      const hipsY = layout.joints.mixamorigHips?.y ?? 0.90;
      const localSplit =
        y < 0.30
          ? layout.ankleSplitX
          : y < 0.55
            ? layout.kneeSplitX
            : layout.hipSplitX;
      const dx = x - localSplit;
      const absDx = Math.abs(dx);

      let legW = 0;
      if (y < hipsY + 0.05) {
        legW = 1 - smoothstep(layout.crotchY - 0.04, hipsY + 0.04, y);
        if (legW > 0 && absDx < 0.045 && y >= layout.crotchY - 0.065) {
          const midHold =
            (1 - smoothstep(0.004, 0.045, absDx)) *
            smoothstep(layout.crotchY - 0.065, layout.crotchY + 0.035, y);
          legW *= 1 - midHold * 0.85;
        }
      }
      const hipsW = Math.max(0, 1 - legW);

      if (legW > 1e-4) {
        const lChain = ['mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigLeftToeBase'];
        const rChain = ['mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot', 'mixamorigRightToeBase'];
        // Handle skirts smoothly when legs don't have a clear crotch gap
        if (layout.waistSplitWidth < 0.035 && y > 0.42 && absDx < 0.06) {
          const leftRatio = smoothstep(-0.06, 0.06, dx);
          if (leftRatio > 1e-3) addChainWeight(entries, boneIndexMap, layout.joints, x, y, z, lChain, legW * leftRatio, 0.24);
          if (1 - leftRatio > 1e-3) addChainWeight(entries, boneIndexMap, layout.joints, x, y, z, rChain, legW * (1 - leftRatio), 0.24);
        } else {
          addChainWeight(entries, boneIndexMap, layout.joints, x, y, z, dx >= 0 ? lChain : rChain, legW, 0.24);
        }
      }
      if (hipsW > 1e-4) {
        addBoneWeight(entries, boneIndexMap, 'mixamorigHips', hipsW);
      }
    } else if (piece.slot === 'shoes') {
      const isLeft = x >= layout.ankleSplitX;
      const legChain = isLeft
        ? ['mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigLeftToeBase']
        : ['mixamorigRightLeg', 'mixamorigRightFoot', 'mixamorigRightToeBase'];
      const ankleY = (isLeft ? layout.joints.mixamorigLeftFoot?.y : layout.joints.mixamorigRightFoot?.y) ?? 0.09;
      if (y <= ankleY + 0.015) {
        addBoneWeight(entries, boneIndexMap, isLeft ? 'mixamorigLeftFoot' : 'mixamorigRightFoot', 1);
      } else {
        addChainWeight(entries, boneIndexMap, layout.joints, x, y, z, legChain, 1, 0.20);
      }
    }

    if (entries.length === 0) {
      entries.push({
        idx: piece.slot === 'head' || piece.slot === 'mask' ? headIdx : hipsIdx,
        w: 1,
      });
    }

    entries.sort((a, b) => b.w - a.w);
    const top = entries.slice(0, 4);
    let sum = 0;
    for (let k = 0; k < top.length; k++) sum += top[k].w;
    const invSum = sum > 1e-6 ? 1 / sum : 1;
    const o = i * 4;
    for (let k = 0; k < top.length; k++) {
      skinIndices[o + k] = top[k].idx;
      skinWeights[o + k] = top[k].w * invSum;
    }
  }

  geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  // Generous animated bounding sphere so animated skinned pieces never frustum-pop
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.8);

  const mat = piece.material.clone();
  const skinned = new THREE.SkinnedMesh(geom, mat);
  skinned.name = `CustomSkin_${piece.pieceId}`;
  skinned.castShadow = false;
  skinned.receiveShadow = false;
  skinned.frustumCulled = true;
  skinned.userData.customSkinPieceId = piece.pieceId;
  skinned.userData.customSkinSlot = piece.slot;

  const skeleton = new THREE.Skeleton(targetLiveBones, adaptedInverses);
  targetClonedScene.add(skinned);
  skinned.bind(skeleton, new THREE.Matrix4());

  return skinned;
}

export function applyAdamEvaSkinOcclusion(
  originalPositions: Float32Array,
  targetAttr: THREE.BufferAttribute,
  slots: { head?: boolean; shirt?: boolean; pants?: boolean; shoes?: boolean },
): void {
  const count = targetAttr.count;
  // Raw ff_adam/ff_eva geometry is in 1/FF_SCENE_SCALE armature space with rawRotY = -PI/2:
  // worldX = -rawZ * FF_SCENE_SCALE, worldY = rawY * FF_SCENE_SCALE, worldZ = rawX * FF_SCENE_SCALE
  const invScale = 1 / FF_SCENE_SCALE;
  const hasAny = Boolean(slots.head || slots.shirt || slots.pants || slots.shoes);

  if (!hasAny) {
    (targetAttr.array as Float32Array).set(originalPositions);
    targetAttr.needsUpdate = true;
    return;
  }

  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const rx = originalPositions[o];
    const ry = originalPositions[o + 1];
    const rz = originalPositions[o + 2];

    let wx = -rz * FF_SCENE_SCALE;
    let wy = ry * FF_SCENE_SCALE;
    let wz = rx * FF_SCENE_SCALE;

    // 1. Hair / crown tuck (preserves face/eyes/forehead at wz > 0.005 & wy < 1.635)
    if (slots.head && (wy >= 1.638 || (wy >= 1.48 && wz <= 0.005 && Math.abs(wx) <= 0.115))) {
      const cx = 0;
      const cy = 1.565;
      const cz = -0.015;
      const dx = wx - cx;
      const dy = wy - cy;
      const dz = wz - cz;
      const d = Math.hypot(dx, dy, dz);
      const maxR = 0.068;
      if (d > maxR) {
        const f = maxR / d;
        wx = cx + dx * f;
        wy = cy + dy * f;
        wz = cz + dz * f;
      }
    }

    // 2. Torso / tank-top / upper-sleeve inset
    if (slots.shirt && wy >= 0.94 && wy <= 1.44 && Math.abs(wx) < 0.215) {
      const edgeBlend = smoothstep(0.215, 0.155, Math.abs(wx)) * smoothstep(0.93, 0.99, wy) * smoothstep(1.45, 1.40, wy);
      const scaleXZ = 1 - 0.24 * edgeBlend;
      wx *= scaleXZ;
      wz *= scaleXZ;
    }

    // 3. Pants / shorts / legs inset
    if (slots.pants && wy >= 0.125 && wy <= 0.955) {
      const topBlend = smoothstep(0.96, 0.90, wy) * smoothstep(0.12, 0.16, wy);
      if (wy >= 0.74) {
        const s = 1 - 0.20 * topBlend;
        wx *= s;
        wz *= s;
      } else {
        const legCx = wx >= 0 ? 0.105 : -0.105;
        const s = 1 - 0.24 * topBlend;
        wx = legCx + (wx - legCx) * s;
        wz *= s;
      }
    }

    // 4. Boots / shoes inset
    if (slots.shoes && wy < 0.125) {
      const footCx = wx >= 0 ? 0.115 : -0.115;
      const footCz = 0.03;
      wx = footCx + (wx - footCx) * 0.72;
      wz = footCz + (wz - footCz) * 0.72;
      wy = Math.max(0.018, wy * 0.85);
    }

    // Inverse transform back to ff_adam/ff_eva raw armature space (rawRotY = -PI/2)
    targetAttr.setXYZ(i, wz * invScale, wy * invScale, -wx * invScale);
  }
  targetAttr.needsUpdate = true;
}
