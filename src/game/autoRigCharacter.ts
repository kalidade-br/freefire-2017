import * as THREE from 'three';

export const AUTO_RIG_SCENE_SCALE = 1.78;

const MIXAMO_BONE_DEFS = [
  'mixamorigHips',
  'mixamorigSpine',
  'mixamorigSpine1',
  'mixamorigSpine2',
  'mixamorigNeck',
  'mixamorigHead',
  'mixamorigHeadTop_End',
  'mixamorigLeftShoulder',
  'mixamorigLeftArm',
  'mixamorigLeftForeArm',
  'mixamorigLeftHand',
  'mixamorigLeftHandMiddle1',
  'mixamorigRightShoulder',
  'mixamorigRightArm',
  'mixamorigRightForeArm',
  'mixamorigRightHand',
  'mixamorigRightHandMiddle1',
  'mixamorigLeftUpLeg',
  'mixamorigLeftLeg',
  'mixamorigLeftFoot',
  'mixamorigLeftToeBase',
  'mixamorigRightUpLeg',
  'mixamorigRightLeg',
  'mixamorigRightFoot',
  'mixamorigRightToeBase',
] as const;

type MixamoBoneName = (typeof MIXAMO_BONE_DEFS)[number];

const BONE_INDEX: Record<MixamoBoneName, number> = MIXAMO_BONE_DEFS.reduce(
  (acc, name, idx) => {
    acc[name] = idx;
    return acc;
  },
  {} as Record<MixamoBoneName, number>,
);

const BONE_PARENT: Record<MixamoBoneName, MixamoBoneName | null> = {
  mixamorigHips: null,
  mixamorigSpine: 'mixamorigHips',
  mixamorigSpine1: 'mixamorigSpine',
  mixamorigSpine2: 'mixamorigSpine1',
  mixamorigNeck: 'mixamorigSpine2',
  mixamorigHead: 'mixamorigNeck',
  mixamorigHeadTop_End: 'mixamorigHead',
  mixamorigLeftShoulder: 'mixamorigSpine2',
  mixamorigLeftArm: 'mixamorigLeftShoulder',
  mixamorigLeftForeArm: 'mixamorigLeftArm',
  mixamorigLeftHand: 'mixamorigLeftForeArm',
  mixamorigLeftHandMiddle1: 'mixamorigLeftHand',
  mixamorigRightShoulder: 'mixamorigSpine2',
  mixamorigRightArm: 'mixamorigRightShoulder',
  mixamorigRightForeArm: 'mixamorigRightArm',
  mixamorigRightHand: 'mixamorigRightForeArm',
  mixamorigRightHandMiddle1: 'mixamorigRightHand',
  mixamorigLeftUpLeg: 'mixamorigHips',
  mixamorigLeftLeg: 'mixamorigLeftUpLeg',
  mixamorigLeftFoot: 'mixamorigLeftLeg',
  mixamorigLeftToeBase: 'mixamorigLeftFoot',
  mixamorigRightUpLeg: 'mixamorigHips',
  mixamorigRightLeg: 'mixamorigRightUpLeg',
  mixamorigRightFoot: 'mixamorigRightLeg',
  mixamorigRightToeBase: 'mixamorigRightFoot',
};

interface AutoRigProfile {
  targetHeight: number;
  crotchY: number;
  armMinY: number;
  armBoundaryX: (y: number) => number;
  joints: Record<MixamoBoneName, readonly [number, number, number]>;
}

const MAXIM_PROFILE: AutoRigProfile = {
  targetHeight: 1.74,
  crotchY: 0.72,
  armMinY: 1.24,
  armBoundaryX: (y: number) => (y >= 1.24 ? 0.184 : 99),
  joints: {
    mixamorigHips: [0, 0.88, 0],
    mixamorigSpine: [0, 0.995, 0],
    mixamorigSpine1: [0, 1.13, 0],
    mixamorigSpine2: [0, 1.28, -0.015],
    mixamorigNeck: [0, 1.43, -0.012],
    mixamorigHead: [0, 1.515, -0.008],
    mixamorigHeadTop_End: [0, 1.74, -0.008],
    mixamorigLeftShoulder: [0.092, 1.375, -0.025],
    mixamorigLeftArm: [0.208, 1.375, -0.032],
    mixamorigLeftForeArm: [0.435, 1.365, -0.032],
    mixamorigLeftHand: [0.715, 1.355, -0.012],
    mixamorigLeftHandMiddle1: [0.805, 1.355, -0.015],
    mixamorigRightShoulder: [-0.092, 1.380, -0.015],
    mixamorigRightArm: [-0.220, 1.382, -0.010],
    mixamorigRightForeArm: [-0.438, 1.372, -0.012],
    mixamorigRightHand: [-0.715, 1.360, -0.012],
    mixamorigRightHandMiddle1: [-0.805, 1.360, -0.015],
    mixamorigLeftUpLeg: [0.105, 0.855, 0.01],
    mixamorigLeftLeg: [0.132, 0.47, -0.018],
    mixamorigLeftFoot: [0.173, 0.105, -0.032],
    mixamorigLeftToeBase: [0.173, 0.035, 0.095],
    mixamorigRightUpLeg: [-0.105, 0.855, 0.01],
    mixamorigRightLeg: [-0.132, 0.47, -0.018],
    mixamorigRightFoot: [-0.173, 0.105, -0.032],
    mixamorigRightToeBase: [-0.173, 0.035, 0.095],
  },
};

const KELLY_PROFILE: AutoRigProfile = {
  targetHeight: 1.72,
  crotchY: 0.73,
  armMinY: 0.85,
  armBoundaryX: (y: number) => (y >= 1.25 ? 0.155 : 0.155 + (1.25 - y) * 0.34),
  joints: {
    mixamorigHips: [0, 0.92, -0.005],
    mixamorigSpine: [0, 1.03, -0.005],
    mixamorigSpine1: [0, 1.155, -0.01],
    mixamorigSpine2: [0, 1.295, -0.02],
    mixamorigNeck: [0, 1.435, -0.015],
    mixamorigHead: [0, 1.515, -0.01],
    mixamorigHeadTop_End: [0, 1.72, -0.01],
    mixamorigLeftShoulder: [0.07, 1.39, -0.025],
    mixamorigLeftArm: [0.19, 1.355, -0.038],
    mixamorigLeftForeArm: [0.3, 1.155, -0.025],
    mixamorigLeftHand: [0.425, 0.952, 0.036],
    mixamorigLeftHandMiddle1: [0.455, 0.88, 0.042],
    mixamorigRightShoulder: [-0.07, 1.39, -0.025],
    mixamorigRightArm: [-0.19, 1.355, -0.038],
    mixamorigRightForeArm: [-0.3, 1.155, -0.025],
    mixamorigRightHand: [-0.425, 0.952, 0.036],
    mixamorigRightHandMiddle1: [-0.455, 0.88, 0.042],
    mixamorigLeftUpLeg: [0.105, 0.895, 0],
    mixamorigLeftLeg: [0.128, 0.475, -0.03],
    mixamorigLeftFoot: [0.156, 0.1, 0.002],
    mixamorigLeftToeBase: [0.156, 0.03, 0.105],
    mixamorigRightUpLeg: [-0.105, 0.895, 0],
    mixamorigRightLeg: [-0.128, 0.475, -0.03],
    mixamorigRightFoot: [-0.156, 0.1, 0.002],
    mixamorigRightToeBase: [-0.156, 0.03, 0.105],
  },
};

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

interface WeightAccumulator {
  entries: Array<{ idx: number; w: number }>;
}

function addWeight(acc: WeightAccumulator, boneName: MixamoBoneName, w: number): void {
  if (w <= 1e-5) return;
  const idx = BONE_INDEX[boneName];
  for (let i = 0; i < acc.entries.length; i++) {
    if (acc.entries[i].idx === idx) {
      acc.entries[i].w += w;
      return;
    }
  }
  acc.entries.push({ idx, w });
}

function addChainWeights(
  acc: WeightAccumulator,
  x: number,
  y: number,
  z: number,
  joints: Record<MixamoBoneName, readonly [number, number, number]>,
  chain: ReadonlyArray<MixamoBoneName>,
  scale: number,
  jointFeather = 0.22,
): void {
  if (scale <= 1e-5) return;
  let bestSeg = 0;
  let bestT = 0;
  let bestDistSq = Infinity;

  for (let s = 0; s < chain.length - 1; s++) {
    const a = joints[chain[s]];
    const b = joints[chain[s + 1]];
    const t = projectT(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2]);
    const qx = a[0] + (b[0] - a[0]) * t;
    const qy = a[1] + (b[1] - a[1]) * t;
    const qz = a[2] + (b[2] - a[2]) * t;
    const dSq = (x - qx) * (x - qx) + (y - qy) * (y - qy) + (z - qz) * (z - qz);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestSeg = s;
      bestT = t;
    }
  }

  const boneA = chain[bestSeg];
  const boneB = chain[bestSeg + 1];

  // Terminal tip segment (e.g. Hand -> HandMiddle1, Foot -> ToeBase) stays on boneA;
  // for Foot -> ToeBase, only blend into Leg at/above the ankle collar so heels and soles stay 100% Foot.
  if (bestSeg === chain.length - 2) {
    const isFootTip = boneA.endsWith('Foot');
    const tipFeather = isFootTip ? 0.14 : 0.15;
    if (bestSeg > 0 && bestT < tipFeather) {
      if (isFootTip) {
        const ankleY = joints[boneA][1];
        const ankleBlend = smoothstep(ankleY - 0.022, ankleY + 0.032, y);
        const f = smoothstep(0, tipFeather, bestT) * 0.5 + 0.5;
        const shinW = (1 - f) * ankleBlend;
        addWeight(acc, chain[bestSeg - 1], scale * shinW);
        addWeight(acc, boneA, scale * (1 - shinW));
        return;
      }
      const f = smoothstep(0, tipFeather, bestT) * 0.5 + 0.5;
      addWeight(acc, chain[bestSeg - 1], scale * (1 - f));
      addWeight(acc, boneA, scale * f);
      return;
    }
    addWeight(acc, boneA, scale);
    return;
  }

  // Smooth bend zone around joints: near start of segment blend with prev bone; near end blend with next bone
  if (bestSeg > 0 && bestT < jointFeather) {
    const f = smoothstep(0, jointFeather, bestT) * 0.5 + 0.5;
    addWeight(acc, chain[bestSeg - 1], scale * (1 - f));
    addWeight(acc, boneA, scale * f);
  } else if (bestT > 1 - jointFeather) {
    let f = smoothstep(1 - jointFeather, 1, bestT) * 0.5;
    if (boneB.endsWith('Foot')) {
      const ankleY = joints[boneB][1];
      const ankleBlend = smoothstep(ankleY - 0.022, ankleY + 0.032, y);
      f = 1 - (1 - f) * ankleBlend;
    }
    addWeight(acc, boneA, scale * (1 - f));
    addWeight(acc, boneB, scale * f);
  } else {
    addWeight(acc, boneA, scale);
  }
}

function addTorsoSpineWeights(
  acc: WeightAccumulator,
  y: number,
  isCollarMesh: boolean,
  profile: AutoRigProfile,
  scale: number,
): void {
  if (scale <= 1e-5) return;
  const j = profile.joints;
  const hipsY = j.mixamorigHips[1];
  const spineY = j.mixamorigSpine[1];
  const spine1Y = j.mixamorigSpine1[1];
  const spine2Y = j.mixamorigSpine2[1];
  const neckY = j.mixamorigNeck[1];
  const headY = j.mixamorigHead[1];

  if (y <= hipsY) {
    addWeight(acc, 'mixamorigHips', scale);
    return;
  }
  if (y <= spineY) {
    const t = smoothstep(hipsY, spineY, y);
    addWeight(acc, 'mixamorigHips', scale * (1 - t));
    addWeight(acc, 'mixamorigSpine', scale * t);
    return;
  }
  if (y <= spine1Y) {
    const t = smoothstep(spineY, spine1Y, y);
    addWeight(acc, 'mixamorigSpine', scale * (1 - t));
    addWeight(acc, 'mixamorigSpine1', scale * t);
    return;
  }
  if (y <= spine2Y) {
    const t = smoothstep(spine1Y, spine2Y, y);
    addWeight(acc, 'mixamorigSpine1', scale * (1 - t));
    addWeight(acc, 'mixamorigSpine2', scale * t);
    return;
  }
  if (y <= neckY) {
    const t = smoothstep(spine2Y, neckY, y);
    const maxNeck = isCollarMesh ? 0.55 : 0.85;
    const nw = t * maxNeck;
    addWeight(acc, 'mixamorigSpine2', scale * (1 - nw));
    addWeight(acc, 'mixamorigNeck', scale * nw);
    return;
  }
  if (isCollarMesh) {
    // Keep hoodie/tracksuit collars anchored to shoulders & neck so head turns never tear collars
    const t = smoothstep(neckY, neckY + 0.08, y);
    addWeight(acc, 'mixamorigSpine2', scale * (0.45 - 0.15 * t));
    addWeight(acc, 'mixamorigNeck', scale * (0.55 + 0.15 * t));
    return;
  }
  const tHead = smoothstep(neckY + 0.01, headY - 0.015, y);
  addWeight(acc, 'mixamorigNeck', scale * (1 - tHead));
  addWeight(acc, 'mixamorigHead', scale * tHead);
}

function computeVertexSkin(
  x: number,
  y: number,
  z: number,
  isRigidHead: boolean,
  isCollarMesh: boolean,
  isTorsoOnlyMesh: boolean,
  profile: AutoRigProfile,
): { indices: [number, number, number, number]; weights: [number, number, number, number] } {
  const acc: WeightAccumulator = { entries: [] };
  const j = profile.joints;

  // Hair / cap submeshes rotate 100% rigidly with head
  if (isRigidHead) {
    return {
      indices: [BONE_INDEX.mixamorigHead, 0, 0, 0],
      weights: [1, 0, 0, 0],
    };
  }

  const absX = Math.abs(x);
  const isLeft = x >= 0;

  // Compute smooth arm weight using the character-specific torso/arm separator curve.
  // Torso/hoodie submeshes keep ribcage/waist strictly torso-bound, while allowing upper shoulder sleeves
  // (y >= 1.30, |x| >= 0.168) to follow the shoulder/upper-arm gently so arms never poke through frozen cuffs.
  let armWeight = 0;
  if (isTorsoOnlyMesh) {
    if (y >= 1.30 && absX >= 0.168) {
      armWeight = smoothstep(1.29, 1.34, y) * smoothstep(0.165, 0.212, absX) * 0.62;
    }
  } else if (y >= profile.armMinY) {
    const boundX = profile.armBoundaryX(y);
    if (boundX < 50) {
      armWeight = smoothstep(boundX - 0.035, boundX + 0.035, absX);
    }
  }

  // Compute smooth leg weight below hip level, keeping left/right strictly isolated and crotch anchored to Hips
  const hipsY = j.mixamorigHips[1];
  let legWeight = 0;
  if (y < hipsY + 0.05 && armWeight < 0.5) {
    legWeight = 1 - smoothstep(profile.crotchY - 0.035, hipsY + 0.04, y);
    if (legWeight > 0 && absX < 0.042 && y >= profile.crotchY - 0.065) {
      const midlineHipHold =
        (1 - smoothstep(0.004, 0.042, absX)) *
        smoothstep(profile.crotchY - 0.065, profile.crotchY + 0.035, y);
      legWeight *= 1 - midlineHipHold * 0.85;
    }
  }

  const torsoWeight = Math.max(0, 1 - armWeight - legWeight);

  if (armWeight > 1e-4) {
    const armChain: MixamoBoneName[] = isLeft
      ? [
          'mixamorigLeftShoulder',
          'mixamorigLeftArm',
          'mixamorigLeftForeArm',
          'mixamorigLeftHand',
          'mixamorigLeftHandMiddle1',
        ]
      : [
          'mixamorigRightShoulder',
          'mixamorigRightArm',
          'mixamorigRightForeArm',
          'mixamorigRightHand',
          'mixamorigRightHandMiddle1',
        ];
    addChainWeights(acc, x, y, z, j, armChain, armWeight, 0.24);
  }

  if (legWeight > 1e-4) {
    const legChain: MixamoBoneName[] = isLeft
      ? ['mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigLeftToeBase']
      : ['mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot', 'mixamorigRightToeBase'];
    addChainWeights(acc, x, y, z, j, legChain, legWeight, 0.26);
  }

  if (torsoWeight > 1e-4) {
    addTorsoSpineWeights(acc, y, isCollarMesh, profile, torsoWeight);
  }

  if (acc.entries.length === 0) {
    addWeight(acc, 'mixamorigHips', 1);
  }

  // Keep top 4 influences and normalize strictly to sum = 1.0
  acc.entries.sort((a, b) => b.w - a.w);
  const top = acc.entries.slice(0, 4);
  let sum = 0;
  for (let i = 0; i < top.length; i++) sum += top[i].w;
  if (sum <= 1e-6) {
    return {
      indices: [BONE_INDEX.mixamorigHips, 0, 0, 0],
      weights: [1, 0, 0, 0],
    };
  }

  const indices: [number, number, number, number] = [0, 0, 0, 0];
  const weights: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < top.length; i++) {
    indices[i] = top[i].idx;
    weights[i] = top[i].w / sum;
  }
  return { indices, weights };
}

export function autoRigStaticCharacter(
  rawStaticScene: THREE.Group,
  modelId: 'maxim' | 'kelly',
): THREE.Group {
  const profile = modelId === 'kelly' ? KELLY_PROFILE : MAXIM_PROFILE;

  rawStaticScene.updateMatrixWorld(true);

  const sourceMeshes: Array<{
    name: string;
    mesh: THREE.Mesh;
    geometry: THREE.BufferGeometry;
    material: THREE.Material | THREE.Material[];
    box: THREE.Box3;
  }> = [];

  const totalBox = new THREE.Box3();
  const tmpV = new THREE.Vector3();

  rawStaticScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geom = mesh.geometry.clone();
    const posAttr = geom.getAttribute('position');
    if (!posAttr) return;

    mesh.updateWorldMatrix(true, false);
    const normMat = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const normAttr = geom.getAttribute('normal');
    const meshBox = new THREE.Box3();

    for (let i = 0; i < posAttr.count; i++) {
      tmpV.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
      posAttr.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
      totalBox.expandByPoint(tmpV);
      meshBox.expandByPoint(tmpV);

      if (normAttr) {
        tmpV.fromBufferAttribute(normAttr, i).applyMatrix3(normMat).normalize();
        normAttr.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
      }
    }
    posAttr.needsUpdate = true;
    if (normAttr) normAttr.needsUpdate = true;
    else geom.computeVertexNormals();

    sourceMeshes.push({
      name: mesh.name || `Mesh_${sourceMeshes.length}`,
      mesh,
      geometry: geom,
      material: mesh.material,
      box: meshBox,
    });
  });

  const sizeY = Math.max(1e-4, totalBox.max.y - totalBox.min.y);
  const centerX = (totalBox.min.x + totalBox.max.x) * 0.5;
  const centerZ = (totalBox.min.z + totalBox.max.z) * 0.5;
  const minY = totalBox.min.y;
  const worldScale = profile.targetHeight / sizeY;
  const localScale = worldScale / AUTO_RIG_SCENE_SCALE;

  const riggedRoot = new THREE.Group();
  riggedRoot.name = `FF_${modelId}_RiggedScene`;

  // Build Mixamo bone hierarchy in unscaled armature space (jointWorld / AUTO_RIG_SCENE_SCALE)
  const boneMap = new Map<MixamoBoneName, THREE.Bone>();
  const bones: THREE.Bone[] = [];

  for (let i = 0; i < MIXAMO_BONE_DEFS.length; i++) {
    const boneName = MIXAMO_BONE_DEFS[i];
    const bone = new THREE.Bone();
    bone.name = boneName;
    const jWorld = profile.joints[boneName];
    const parentName = BONE_PARENT[boneName];

    if (parentName) {
      const parentWorld = profile.joints[parentName];
      bone.position.set(
        (jWorld[0] - parentWorld[0]) / AUTO_RIG_SCENE_SCALE,
        (jWorld[1] - parentWorld[1]) / AUTO_RIG_SCENE_SCALE,
        (jWorld[2] - parentWorld[2]) / AUTO_RIG_SCENE_SCALE,
      );
      boneMap.get(parentName)!.add(bone);
    } else {
      bone.position.set(
        jWorld[0] / AUTO_RIG_SCENE_SCALE,
        jWorld[1] / AUTO_RIG_SCENE_SCALE,
        jWorld[2] / AUTO_RIG_SCENE_SCALE,
      );
      riggedRoot.add(bone);
    }

    boneMap.set(boneName, bone);
    bones.push(bone);
  }

  riggedRoot.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();

  for (let m = 0; m < sourceMeshes.length; m++) {
    const entry = sourceMeshes[m];
    const geom = entry.geometry;
    const posAttr = geom.getAttribute('position');
    const count = posAttr.count;

    // Classify submesh anatomically by world-meter bounding box (independent of GLTF node naming)
    const meshMinY = (entry.box.min.y - minY) * worldScale;
    const meshMaxY = (entry.box.max.y - minY) * worldScale;
    const meshWidthX = (entry.box.max.x - entry.box.min.x) * worldScale;
    const isRigidHead = meshMinY >= 1.46;
    const isCollarMesh = !isRigidHead && meshMinY >= 0.88 && meshMaxY <= 1.56;
    const isTorsoOnlyMesh = !isRigidHead && meshMinY >= 0.85 && meshMaxY <= 1.58 && meshWidthX < 0.48;

    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      const rx = posAttr.getX(i);
      const ry = posAttr.getY(i);
      const rz = posAttr.getZ(i);

      // World-meter coordinates (+Z facing, feet at y=0, height = profile.targetHeight)
      const wx = (rx - centerX) * worldScale;
      const wy = (ry - minY) * worldScale;
      const wz = (rz - centerZ) * worldScale;

      // Store geometry vertex in unscaled armature space
      posAttr.setXYZ(
        i,
        (rx - centerX) * localScale,
        (ry - minY) * localScale,
        (rz - centerZ) * localScale,
      );

      const skin = computeVertexSkin(wx, wy, wz, isRigidHead, isCollarMesh, isTorsoOnlyMesh, profile);
      const o = i * 4;
      skinIndices[o] = skin.indices[0];
      skinIndices[o + 1] = skin.indices[1];
      skinIndices[o + 2] = skin.indices[2];
      skinIndices[o + 3] = skin.indices[3];
      skinWeights[o] = skin.weights[0];
      skinWeights[o + 1] = skin.weights[1];
      skinWeights[o + 2] = skin.weights[2];
      skinWeights[o + 3] = skin.weights[3];
    }

    posAttr.needsUpdate = true;
    geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    geom.computeBoundingBox();
    geom.computeBoundingSphere();

    const skinned = new THREE.SkinnedMesh(geom, entry.material);
    skinned.name = entry.name;
    skinned.frustumCulled = false;
    riggedRoot.add(skinned);
    skinned.bind(skeleton);
  }

  return riggedRoot;
}
