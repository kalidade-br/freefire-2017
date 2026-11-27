import * as THREE from 'three';
import { GLTFLoader, type GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import {
  type FFModelAssetPack,
  getCustomSkinPack,
  getOrBuildCustomSkinPack,
} from './adamAssets';
import { autoRigSkinBundle } from './autoRigCharacter';
import type { SkinGender } from './types';

export const SKIN_CDN_BASE = 'https://kalidade-br.github.io/freefire-2017/skin';

export interface SkinCatalogBundleRef {
  id: string;
  gender: SkinGender;
  number: number;
  url: string;
  fallbackUrl?: string;
}

export interface LoadedSkinBundle {
  id: string;
  gender: SkinGender;
  number: number;
  url: string;
  thumbnailUrl: string | null;
  rawScene: THREE.Group;
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
  {
    id: 'male:1',
    gender: 'male',
    number: 1,
    url: '/skin/male/1.glb',
    fallbackUrl: `${SKIN_CDN_BASE}/male/1.glb`,
  },
  {
    id: 'female:1',
    gender: 'female',
    number: 1,
    url: '/skin/female/1.glb',
    fallbackUrl: `${SKIN_CDN_BASE}/female/1.glb`,
  },
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

export function getAllLoadedSkinBundles(
  genderFilter: SkinGender | 'all' = 'all',
): LoadedSkinBundle[] {
  const out: LoadedSkinBundle[] = [];
  for (let i = 0; i < catalogEntries.length; i++) {
    const ref = catalogEntries[i];
    if (genderFilter !== 'all' && ref.gender !== genderFilter) continue;
    const bundle = loadedBundles.get(ref.id);
    if (bundle) out.push(bundle);
  }
  return out;
}

export function getSkinBundlesLoadingStatus(): {
  catalogReady: boolean;
  loadedCount: number;
  totalCount: number;
  inFlightCount: number;
} {
  return {
    catalogReady: catalogFetched,
    loadedCount: loadedBundles.size,
    totalCount: catalogEntries.length,
    inFlightCount: bundleLoadPromises.size,
  };
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

function toClassicLambertMaterial(
  raw: THREE.Material | THREE.Material[],
): THREE.MeshLambertMaterial {
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

  const extraTexKeys = [
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'bumpMap',
    'emissiveMap',
  ] as const;
  for (let i = 0; i < extraTexKeys.length; i++) {
    const tex = (pbr as unknown as Record<string, THREE.Texture | null | undefined>)[
      extraTexKeys[i]
    ];
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

function renderFullOutfitThumbnail(
  rawScene: THREE.Group,
  gender: SkinGender,
): string | null {
  let renderer: THREE.WebGLRenderer | null = null;
  const previewGeoms: THREE.BufferGeometry[] = [];
  try {
    rawScene.updateMatrixWorld(true);
    const totalBox = new THREE.Box3();
    const vTmp = new THREE.Vector3();
    const parts: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> = [];

    rawScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const geom = mesh.geometry.clone();
      const pos = geom.getAttribute('position');
      if (!pos) {
        geom.dispose();
        return;
      }
      mesh.updateWorldMatrix(true, false);
      const normMat = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
      const norm = geom.getAttribute('normal');
      for (let i = 0; i < pos.count; i++) {
        vTmp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        pos.setXYZ(i, vTmp.x, vTmp.y, vTmp.z);
        totalBox.expandByPoint(vTmp);
        if (norm) {
          vTmp.fromBufferAttribute(norm, i).applyMatrix3(normMat).normalize();
          norm.setXYZ(i, vTmp.x, vTmp.y, vTmp.z);
        }
      }
      pos.needsUpdate = true;
      if (norm) norm.needsUpdate = true;
      else geom.computeVertexNormals();
      previewGeoms.push(geom);
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      parts.push({ geometry: geom, material: mat });
    });

    if (parts.length === 0) return null;

    const targetHeight = gender === 'female' ? 1.72 : 1.74;
    const minY = Number.isFinite(totalBox.min.y) ? totalBox.min.y : 0;
    const maxY = Number.isFinite(totalBox.max.y) ? totalBox.max.y : 1;
    const worldScale = targetHeight / Math.max(1e-4, maxY - minY);

    // Two-pass torso-core centering so off-center hairstyles/hands don't shift framing
    const torsoXs: number[] = [];
    for (let p = 0; p < parts.length; p++) {
      const pos = parts[p].geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const ym = (pos.getY(i) - minY) * worldScale;
        if (ym >= 0.84 && ym <= 1.30) {
          torsoXs.push(pos.getX(i));
        }
      }
    }
    let roughCenterX = (totalBox.min.x + totalBox.max.x) * 0.5;
    if (torsoXs.length > 0) {
      torsoXs.sort((a, b) => a - b);
      roughCenterX = torsoXs[Math.floor(torsoXs.length * 0.5)];
    }

    const coreBox = new THREE.Box3();
    for (let p = 0; p < parts.length; p++) {
      const pos = parts[p].geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const ym = (pos.getY(i) - minY) * worldScale;
        if (ym >= 0.84 && ym <= 1.30) {
          const xm = (pos.getX(i) - roughCenterX) * worldScale;
          if (Math.abs(xm) < 0.175) {
            vTmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
            coreBox.expandByPoint(vTmp);
          }
        }
      }
    }
    const cBox = coreBox.isEmpty() ? totalBox : coreBox;
    const centerX = (cBox.min.x + cBox.max.x) * 0.5;
    const centerZ = (cBox.min.z + cBox.max.z) * 0.5;

    const previewGroup = new THREE.Group();
    for (let p = 0; p < parts.length; p++) {
      const pos = parts[p].geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(
          i,
          (pos.getX(i) - centerX) * worldScale,
          (pos.getY(i) - minY) * worldScale,
          (pos.getZ(i) - centerZ) * worldScale,
        );
      }
      pos.needsUpdate = true;
      parts[p].geometry.computeBoundingBox();
      parts[p].geometry.computeBoundingSphere();
      previewGroup.add(new THREE.Mesh(parts[p].geometry, parts[p].material));
    }
    previewGroup.rotation.y = -0.26;
    previewGroup.updateMatrixWorld(true);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      depth: true,
      stencil: false,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(192, 248, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    const scene = new THREE.Scene();
    scene.add(
      new THREE.AmbientLight(0xffffff, 1.65),
      new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.95),
    );
    const sun = new THREE.DirectionalLight(0xfff4dd, 1.45);
    sun.position.set(1.5, 2.3, 2.7);
    const fill = new THREE.DirectionalLight(0xbae6fd, 0.55);
    fill.position.set(-1.6, 0.8, 1.4);
    scene.add(sun, fill, previewGroup);

    const box = new THREE.Box3().setFromObject(previewGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const aspect = 192 / 248;
    const camera = new THREE.PerspectiveCamera(28, aspect, 0.05, 15);
    const fovRad = THREE.MathUtils.degToRad(28);
    const halfH = Math.max(0.4, size.y * 0.5);
    const halfW = Math.max(0.25, Math.max(size.x, size.z) * 0.5);
    const distV = halfH / Math.tan(fovRad * 0.5);
    const distH = halfW / (Math.tan(fovRad * 0.5) * aspect);
    const dist = Math.max(distV, distH) * 1.14;

    camera.position.set(center.x, center.y + 0.02, center.z + dist);
    camera.lookAt(center.x, center.y, center.z);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    for (let i = 0; i < previewGeoms.length; i++) {
      previewGeoms[i].dispose();
    }
    renderer?.dispose();
  }
}

function processRawSkinBundle(
  ref: SkinCatalogBundleRef,
  rawScene: THREE.Group,
): LoadedSkinBundle {
  rawScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = toClassicLambertMaterial(mesh.material);
  });

  const thumbnailUrl = renderFullOutfitThumbnail(rawScene, ref.gender);

  return {
    id: ref.id,
    gender: ref.gender,
    number: ref.number,
    url: ref.url,
    thumbnailUrl,
    rawScene,
  };
}

export function getOrBuildRiggedSkinPack(bundleId: string): FFModelAssetPack | null {
  const existingPack = getCustomSkinPack(bundleId);
  if (existingPack) return existingPack;

  const bundle = loadedBundles.get(bundleId);
  if (!bundle) return null;

  return getOrBuildCustomSkinPack(bundleId, () =>
    autoRigSkinBundle(bundle.rawScene, bundle.gender),
  );
}

function loadGltfWithFallback(
  loader: GLTFLoader,
  primaryUrl: string,
  fallbackUrl?: string,
): Promise<THREE.Group | null> {
  return new Promise((resolve) => {
    loader.load(
      primaryUrl,
      (gltf) => resolve(gltf.scene),
      undefined,
      () => {
        if (fallbackUrl && fallbackUrl !== primaryUrl) {
          loader.load(
            fallbackUrl,
            (gltf2) => resolve(gltf2.scene),
            undefined,
            () => resolve(null),
          );
        } else {
          resolve(null);
        }
      },
    );
  });
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
        const n = Math.round(num);
        return {
          id: bundleId,
          gender: g as SkinGender,
          number: n,
          url: `/skin/${g}/${n}.glb`,
          fallbackUrl: `${SKIN_CDN_BASE}/${g}/${n}.glb`,
        };
      }
      return null;
    })();

  if (!ref) return Promise.resolve(null);

  const loader = createSharedLoader();
  const promise = loadGltfWithFallback(loader, ref.url, ref.fallbackUrl)
    .then((rawScene) => {
      if (!rawScene) return null;
      try {
        const bundle = processRawSkinBundle(ref, rawScene);
        loadedBundles.set(bundle.id, bundle);
        notifyListeners();
        return bundle;
      } catch {
        return null;
      }
    })
    .finally(() => {
      if (!loadedBundles.has(bundleId)) {
        bundleLoadPromises.delete(bundleId);
      }
    });

  bundleLoadPromises.set(bundleId, promise);
  return promise;
}

export async function preloadSkinBundles(): Promise<void> {
  const refs = await discoverSkinCatalog();
  await Promise.all(refs.slice(0, 12).map((r) => ensureSkinBundleLoaded(r.id)));
  notifyListeners();
}
