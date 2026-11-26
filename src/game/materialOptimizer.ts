import * as THREE from 'three';

const FOLIAGE_NAME_RE =
  /leaf|leaves|foliage|tree|bush|shrub|palm|grass|fern|hedge|vine|ivy|plant|canopy|crown|folha|arvore|arbusto|grama|copa/i;
const SOLID_OVERRIDE_RE =
  /terrain|ground|road|highway|asphalt|wall|house|building|roof|floor|rock|cliff|mountain|crate|box|barrel|metal|concrete|brick|wood_plank|plank|trunk|bark/i;

const _invRootMat = new THREE.Matrix4();
const _instLocalMat = new THREE.Matrix4();

export function isFoliageMaterialOrNode(
  nodeName: string,
  matName: string,
  mat?: THREE.Material | null,
): boolean {
  const combined = `${nodeName} ${matName}`;
  if (FOLIAGE_NAME_RE.test(combined) && !/trunk|bark/i.test(combined)) {
    return true;
  }
  if (
    mat &&
    !SOLID_OVERRIDE_RE.test(combined) &&
    typeof mat.alphaTest === 'number' &&
    mat.alphaTest > 0 &&
    mat.side === THREE.DoubleSide
  ) {
    return true;
  }
  return false;
}

export function enforceMobileTextureFlags(tex: THREE.Texture | null | undefined, isColorMap: boolean): void {
  if (!tex) return;
  let changed = false;
  if (tex.anisotropy !== 1) {
    tex.anisotropy = 1;
    changed = true;
  }
  if (isColorMap && tex.colorSpace !== THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
    changed = true;
  }
  if (changed) {
    tex.needsUpdate = true;
  }
}

export function toFF2017Material(
  srcMat: THREE.Material,
  options?: {
    nodeName?: string;
    forceBasic?: boolean;
    cache?: Map<THREE.Material, THREE.Material>;
  },
): THREE.Material {
  const cached = options?.cache?.get(srcMat);
  if (cached) return cached;

  const nodeName = options?.nodeName ?? '';
  const matName = srcMat.name ?? '';
  const useBasic =
    Boolean(options?.forceBasic) ||
    (srcMat as THREE.MeshBasicMaterial).isMeshBasicMaterial ||
    isFoliageMaterialOrNode(nodeName, matName, srcMat);

  if ((srcMat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
    const bm = srcMat as THREE.MeshBasicMaterial;
    enforceMobileTextureFlags(bm.map, true);
    if (bm.envMap) {
      bm.envMap = null;
      bm.needsUpdate = true;
    }
    options?.cache?.set(srcMat, bm);
    return bm;
  }

  if ((srcMat as THREE.MeshLambertMaterial).isMeshLambertMaterial && !useBasic) {
    const lm = srcMat as THREE.MeshLambertMaterial;
    enforceMobileTextureFlags(lm.map, true);
    if (lm.envMap || lm.aoMap || lm.specularMap) {
      lm.envMap = null;
      lm.aoMap = null;
      lm.specularMap = null;
      lm.needsUpdate = true;
    }
    options?.cache?.set(srcMat, lm);
    return lm;
  }

  const anyMat = srcMat as THREE.MeshStandardMaterial;
  const color = anyMat.color ? anyMat.color.clone() : new THREE.Color(0xffffff);
  const map = anyMat.map ?? null;
  enforceMobileTextureFlags(map, true);

  let out: THREE.Material;
  if (useBasic) {
    const basicMat = new THREE.MeshBasicMaterial({
      name: matName,
      color,
      map,
      transparent: Boolean(anyMat.transparent),
      opacity: typeof anyMat.opacity === 'number' ? anyMat.opacity : 1,
      alphaTest: typeof anyMat.alphaTest === 'number' ? anyMat.alphaTest : 0,
      side: anyMat.side ?? THREE.FrontSide,
      vertexColors: Boolean(anyMat.vertexColors),
      depthWrite: typeof anyMat.depthWrite === 'boolean' ? anyMat.depthWrite : true,
      depthTest: typeof anyMat.depthTest === 'boolean' ? anyMat.depthTest : true,
      fog: typeof anyMat.fog === 'boolean' ? anyMat.fog : true,
    });
    basicMat.userData = { ...srcMat.userData };
    out = basicMat;
  } else {
    const hasEmissive =
      anyMat.emissive &&
      (anyMat.emissive.r > 0.01 || anyMat.emissive.g > 0.01 || anyMat.emissive.b > 0.01);
    const lambertMat = new THREE.MeshLambertMaterial({
      name: matName,
      color,
      map,
      emissive: hasEmissive ? anyMat.emissive.clone() : new THREE.Color(0x000000),
      emissiveIntensity: hasEmissive ? Math.min(1, anyMat.emissiveIntensity ?? 1) : 0,
      transparent: Boolean(anyMat.transparent),
      opacity: typeof anyMat.opacity === 'number' ? anyMat.opacity : 1,
      alphaTest: typeof anyMat.alphaTest === 'number' ? anyMat.alphaTest : 0,
      side: anyMat.side ?? THREE.FrontSide,
      vertexColors: Boolean(anyMat.vertexColors),
      depthWrite: typeof anyMat.depthWrite === 'boolean' ? anyMat.depthWrite : true,
      depthTest: typeof anyMat.depthTest === 'boolean' ? anyMat.depthTest : true,
      fog: typeof anyMat.fog === 'boolean' ? anyMat.fog : true,
    });
    lambertMat.userData = { ...srcMat.userData };
    out = lambertMat;
  }

  options?.cache?.set(srcMat, out);
  return out;
}

export function ensureSkinnedMeshCullingSphere(
  mesh: THREE.SkinnedMesh,
  minLocalRadius = 2.2,
): void {
  const geo = mesh.geometry;
  if (!geo) return;
  if (!geo.boundingSphere) {
    geo.computeBoundingSphere();
  }
  if (geo.boundingSphere && geo.boundingSphere.radius < minLocalRadius) {
    geo.boundingSphere.radius = minLocalRadius;
  }
}

export function optimizeObjectFF2017(
  root: THREE.Object3D,
  options?: {
    hideWatermark?: boolean;
    minSkinnedCullRadius?: number;
    materialCache?: Map<THREE.Material, THREE.Material>;
  },
): void {
  const cache = options?.materialCache ?? new Map<THREE.Material, THREE.Material>();
  const minSkinRad = options?.minSkinnedCullRadius ?? 2.2;

  root.traverse((node) => {
    if (options?.hideWatermark && /^Text_Material/i.test(node.name)) {
      node.visible = false;
      return;
    }
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;

    if (options?.hideWatermark && /^Text_Material/i.test(mesh.name)) {
      mesh.visible = false;
      return;
    }

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;

    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      ensureSkinnedMeshCullingSphere(mesh as THREE.SkinnedMesh, minSkinRad);
    } else if (mesh.geometry && !mesh.geometry.boundingSphere) {
      mesh.geometry.computeBoundingSphere();
    }

    if (Array.isArray(mesh.material)) {
      const nextMats: THREE.Material[] = new Array(mesh.material.length);
      for (let i = 0; i < mesh.material.length; i++) {
        const m = mesh.material[i];
        if (!m) {
          nextMats[i] = m;
          continue;
        }
        if (options?.hideWatermark && /^Text_Material/i.test(m.name)) {
          mesh.visible = false;
        }
        nextMats[i] = toFF2017Material(m, {
          nodeName: mesh.name,
          cache,
        });
      }
      mesh.material = nextMats;
    } else if (mesh.material) {
      if (options?.hideWatermark && /^Text_Material/i.test(mesh.material.name)) {
        mesh.visible = false;
      }
      mesh.material = toFF2017Material(mesh.material, {
        nodeName: mesh.name,
        cache,
      });
    }
  });
}

function getMaterialKey(mat: THREE.Material | THREE.Material[]): string {
  if (Array.isArray(mat)) {
    return mat.map((m) => (m ? m.uuid : 'null')).join(',');
  }
  return mat ? mat.uuid : 'null';
}

export function batchRepeatedMeshesToInstanced(
  root: THREE.Object3D,
  options?: {
    minGroupSize?: number;
    skipNameRe?: RegExp;
  },
): number {
  const minGroupSize = options?.minGroupSize ?? 2;
  const skipRe = options?.skipNameRe;
  root.updateMatrixWorld(true);
  _invRootMat.copy(root.matrixWorld).invert();

  const buckets = new Map<
    string,
    {
      geometry: THREE.BufferGeometry;
      material: THREE.Material | THREE.Material[];
      meshes: THREE.Mesh[];
      sampleName: string;
    }
  >();

  root.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) return;
    if ((node as THREE.InstancedMesh).isInstancedMesh) return;

    const mesh = node as THREE.Mesh;
    if (!mesh.visible) return;
    if (skipRe && skipRe.test(mesh.name)) return;
    if (!mesh.geometry || !mesh.material) return;

    const key = `${mesh.geometry.uuid}|${getMaterialKey(mesh.material)}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        geometry: mesh.geometry,
        material: mesh.material,
        meshes: [],
        sampleName: mesh.name || 'prop',
      };
      buckets.set(key, bucket);
    }
    bucket.meshes.push(mesh);
  });

  let instancedCreated = 0;

  for (const bucket of buckets.values()) {
    const list = bucket.meshes;
    if (list.length < minGroupSize) continue;

    const inst = new THREE.InstancedMesh(
      bucket.geometry,
      bucket.material,
      list.length,
    );
    inst.name = `Instanced_${bucket.sampleName}`;
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.frustumCulled = true;

    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      _instLocalMat.multiplyMatrices(_invRootMat, m.matrixWorld);
      inst.setMatrixAt(i, _instLocalMat);
      m.parent?.remove(m);
    }

    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingBox();
    inst.computeBoundingSphere();
    root.add(inst);
    instancedCreated++;
  }

  return instancedCreated;
}

let sharedBlobGeo: THREE.CircleGeometry | null = null;
const sharedBlobMats = new Map<string, THREE.MeshBasicMaterial>();

export function getSharedBlobShadowGeometry(): THREE.CircleGeometry {
  if (!sharedBlobGeo) {
    sharedBlobGeo = new THREE.CircleGeometry(1, 14);
    sharedBlobGeo.rotateX(-Math.PI / 2);
  }
  return sharedBlobGeo;
}

export function getSharedBlobShadowMaterial(
  contactShadowTex: THREE.Texture,
  opacity = 0.52,
): THREE.MeshBasicMaterial {
  enforceMobileTextureFlags(contactShadowTex, true);
  const key = `${contactShadowTex.uuid}_${opacity.toFixed(2)}`;
  let mat = sharedBlobMats.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    sharedBlobMats.set(key, mat);
  }
  return mat;
}

export function createBlobShadowMesh(
  contactShadowTex: THREE.Texture,
  radius = 0.56,
  opacity = 0.52,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    getSharedBlobShadowGeometry(),
    getSharedBlobShadowMaterial(contactShadowTex, opacity),
  );
  mesh.scale.setScalar(radius);
  mesh.position.y = 0.02;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = true;
  return mesh;
}
