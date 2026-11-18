import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CharacterConfig } from './types';

export interface AdamLoadedData {
  baseScene: THREE.Group;
  animations: THREE.AnimationClip[];
  hairBuzzedGeo: THREE.BufferGeometry | null;
  hairPartedGeo: THREE.BufferGeometry | null;
  baseSkinTex: THREE.Texture | null;
  normalTex: THREE.Texture | null;
  roughnessTex: THREE.Texture | null;
  eyeMaterial: THREE.Material | null;
  eyebrowMaterial: THREE.Material | null;
  positions: Float32Array;
  uvs: Float32Array;
  indices: ArrayLike<number> | null;
}

let loadedData: AdamLoadedData | null = null;
let loadPromise: Promise<AdamLoadedData | null> | null = null;
const outfitTextureCache = new Map<string, THREE.CanvasTexture>();

export function isAdamAssetsLoaded(): boolean {
  return loadedData !== null;
}

export function getAdamData(): AdamLoadedData | null {
  return loadedData;
}

export function cloneAdamScene(): THREE.Group | null {
  if (!loadedData) return null;
  return SkeletonUtils.clone(loadedData.baseScene) as THREE.Group;
}

function loadGlbAsync(loader: GLTFLoader, url: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations ?? [] }),
      undefined,
      (err) => reject(err),
    );
  });
}

function extractFirstGeometry(root: THREE.Object3D): THREE.BufferGeometry | null {
  let geo: THREE.BufferGeometry | null = null;
  root.traverse((obj) => {
    if (!geo && (obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      geo = m.geometry.clone();
      // Align world-space Quaternius hair coords (origin at floor) onto Head bone (0, 1.600, -0.017)
      geo.translate(0, -1.6, 0.017);
      geo.computeVertexNormals();
    }
  });
  return geo;
}

export function preloadAdamAssets(onStep?: (pct: number, label: string) => void): Promise<AdamLoadedData | null> {
  if (loadedData) return Promise.resolve(loadedData);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const loader = new GLTFLoader();
      onStep?.(52, 'Baixando personagem 3D Adam e animações...');
      const [adamGltf, buzzedGltf, partedGltf] = await Promise.all([
        loadGlbAsync(loader, '/assets/models/adam.glb'),
        loadGlbAsync(loader, '/assets/models/hair_buzzed.glb').catch(() => null),
        loadGlbAsync(loader, '/assets/models/hair_parted.glb').catch(() => null),
      ]);

      onStep?.(78, 'Preparando esqueleto, roupas e texturas do Adam...');

      let bodyMesh: THREE.SkinnedMesh | null = null;
      let eyeMaterial: THREE.Material | null = null;
      let eyebrowMaterial: THREE.Material | null = null;

      adamGltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false; // SkinnedMesh bounding spheres can clip when animated far from bind pose
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const n = mesh.name.toLowerCase();
        if (n.includes('superhero') || n.includes('sphere') || (!n.includes('eye') && mesh instanceof THREE.SkinnedMesh)) {
          if (mesh instanceof THREE.SkinnedMesh && !n.includes('eye')) {
            bodyMesh = mesh;
          }
        }
        if (n === 'eyes' || n.includes('eye_')) {
          eyeMaterial = mat ?? null;
        } else if (n === 'eyebrows' || n === 'face') {
          eyebrowMaterial = mat ?? null;
        }
      });

      if (!bodyMesh) {
        // Fallback lookup: pick largest SkinnedMesh
        let bestCount = -1;
        adamGltf.scene.traverse((obj) => {
          if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
            const sm = obj as THREE.SkinnedMesh;
            const c = sm.geometry.attributes.position?.count ?? 0;
            if (c > bestCount) {
              bestCount = c;
              bodyMesh = sm;
            }
          }
        });
      }

      if (!bodyMesh) {
        return null;
      }

      const bm = bodyMesh as THREE.SkinnedMesh;
      const bodyMat = (Array.isArray(bm.material) ? bm.material[0] : bm.material) as THREE.MeshStandardMaterial;
      const posAttr = bm.geometry.getAttribute('position');
      const uvAttr = bm.geometry.getAttribute('uv');
      const idxAttr = bm.geometry.getIndex();

      const vCount = posAttr ? posAttr.count : 0;
      const positions = new Float32Array(vCount * 3);
      const uvs = new Float32Array(vCount * 2);
      for (let vi = 0; vi < vCount; vi++) {
        positions[vi * 3] = posAttr.getX(vi);
        positions[vi * 3 + 1] = posAttr.getY(vi);
        positions[vi * 3 + 2] = posAttr.getZ(vi);
        if (uvAttr) {
          uvs[vi * 2] = uvAttr.getX(vi);
          uvs[vi * 2 + 1] = uvAttr.getY(vi);
        }
      }

      loadedData = {
        baseScene: adamGltf.scene,
        animations: adamGltf.animations,
        hairBuzzedGeo: buzzedGltf ? extractFirstGeometry(buzzedGltf.scene) : null,
        hairPartedGeo: partedGltf ? extractFirstGeometry(partedGltf.scene) : null,
        baseSkinTex: bodyMat?.map ?? null,
        normalTex: bodyMat?.normalMap ?? null,
        roughnessTex: bodyMat?.roughnessMap ?? null,
        eyeMaterial,
        eyebrowMaterial,
        positions,
        uvs,
        indices: idxAttr ? idxAttr.array : null,
      };
      return loadedData;
    } catch {
      return null;
    }
  })();

  return loadPromise;
}

function tintHex(hex: string, factor: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return `#${c.getHexString()}`;
}

export function getAdamOutfitTexture(cfg: Pick<CharacterConfig, 'skinColor' | 'shirtStyle' | 'shirtColor' | 'pantsColor' | 'shoesColor'>): THREE.Texture | null {
  if (!loadedData) return null;
  const key = `${cfg.skinColor}|${cfg.shirtStyle}|${cfg.shirtColor}|${cfg.pantsColor}|${cfg.shoesColor}`;
  const cached = outfitTextureCache.get(key);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return loadedData.baseSkinTex;

  // 1. Paint clean skin base + subtle baked face contour
  const baseImg = loadedData.baseSkinTex?.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
  ctx.fillStyle = cfg.skinColor;
  ctx.fillRect(0, 0, size, size);
  if (baseImg) {
    ctx.globalAlpha = 0.24;
    ctx.drawImage(baseImg, 0, 0, size, size);
    ctx.globalAlpha = 1.0;
  }

  // 2. Rasterize bind-pose triangles cleanly into everyday clothing & skin regions
  const pos = loadedData.positions;
  const uvs = loadedData.uvs;
  const idx = loadedData.indices;
  const triCount = idx ? Math.floor(idx.length / 3) : Math.floor(pos.length / 9);

  const skinDark = tintHex(cfg.skinColor, 0.91);
  const soleColor = '#eceef2';
  const tongueColor = '#17191f';
  const sockColor = '#e2e5ea';
  const beltColor = '#1f2024';
  const shirtShade = tintHex(cfg.shirtColor, 0.84);
  const pantsShade = tintHex(cfg.pantsColor, 0.84);

  const drawTri = (
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    u2: number,
    v2: number,
    fill: string,
    alpha = 1.0,
  ) => {
    const x0 = u0 * size;
    const y0 = v0 * size;
    const x1 = u1 * size;
    const y1 = v1 * size;
    const x2 = u2 * size;
    const y2 = v2 * size;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.strokeStyle = fill;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx[t * 3] : t * 3;
    const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
    const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;

    const cx = (pos[i0 * 3] + pos[i1 * 3] + pos[i2 * 3]) / 3;
    const cy = (pos[i0 * 3 + 1] + pos[i1 * 3 + 1] + pos[i2 * 3 + 1]) / 3;
    const cz = (pos[i0 * 3 + 2] + pos[i1 * 3 + 2] + pos[i2 * 3 + 2]) / 3;
    const ax = Math.abs(cx);

    const u0 = uvs[i0 * 2];
    const v0 = uvs[i0 * 2 + 1];
    const u1 = uvs[i1 * 2];
    const v1 = uvs[i1 * 2 + 1];
    const u2 = uvs[i2 * 2];
    const v2 = uvs[i2 * 2 + 1];

    // Feet / Sneakers (y < 0.128)
    if (cy < 0.128) {
      if (cy < 0.036) {
        drawTri(u0, v0, u1, v1, u2, v2, soleColor, 1.0);
      } else if (cz > 0.015 && cy > 0.068) {
        drawTri(u0, v0, u1, v1, u2, v2, tongueColor, 1.0);
      } else {
        drawTri(u0, v0, u1, v1, u2, v2, cfg.shoesColor, 1.0);
      }
      continue;
    }

    // Socks (when wearing tank + shorts)
    if (cfg.shirtStyle === 'tank' && cy >= 0.128 && cy < 0.172) {
      drawTri(u0, v0, u1, v1, u2, v2, sockColor, 1.0);
      continue;
    }

    // Pants (tee/hoodie = full-length everyday pants; tank = cargo shorts)
    const pantsBottom = cfg.shirtStyle === 'tank' ? 0.48 : 0.128;
    if (cy >= pantsBottom && cy <= 0.995 && ax < 0.28) {
      if (cy >= 0.955) {
        drawTri(u0, v0, u1, v1, u2, v2, beltColor, 1.0);
      } else if (cy >= 0.54 && cy <= 0.72 && ax > 0.145) {
        drawTri(u0, v0, u1, v1, u2, v2, pantsShade, 1.0);
      } else {
        drawTri(u0, v0, u1, v1, u2, v2, cfg.pantsColor, 1.0);
      }
      continue;
    }

    // Everyday Top (Tank top / Short-sleeve T-shirt / Long-sleeve Hoodie)
    const maxArmX =
      cfg.shirtStyle === 'hoodie'
        ? 0.65
        : cfg.shirtStyle === 'tee'
          ? 0.36
          : 0.185;
    const isNeckCutout =
      cfg.shirtStyle === 'tank'
        ? cy > 1.375 && ax < 0.088 && cz > 0.008
        : cy > 1.425 && ax < 0.068 && cz > 0.012;

    if (cy >= 0.96 && cy <= 1.505 && ax < maxArmX && !isNeckCutout) {
      const collarRim =
        cfg.shirtStyle === 'tee' && cy > 1.41 && ax < 0.095;
      const ribShade =
        collarRim || (cfg.shirtStyle === 'tank' && Math.floor(cx * 36) % 2 === 0 && cz > 0);
      drawTri(u0, v0, u1, v1, u2, v2, ribShade ? shirtShade : cfg.shirtColor, 1.0);
      continue;
    }

    // Clean Skin below neck (arms, hands, neck)
    if (cy < 1.515) {
      drawTri(u0, v0, u1, v1, u2, v2, cz < -0.02 ? skinDark : cfg.skinColor, 1.0);
    } else {
      // Clean Face skin (preserve eyes/eyebrow socket depth while covering superhero mask markings)
      const isEyeRegion = cy > 1.655 && cy < 1.735 && cz > 0.045 && ax < 0.062;
      drawTri(u0, v0, u1, v1, u2, v2, cfg.skinColor, isEyeRegion ? 0.65 : 0.92);
    }
  }

  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  outfitTextureCache.set(key, tex);
  return tex;
}
