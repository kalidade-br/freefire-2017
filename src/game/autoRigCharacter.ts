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
  legSplitX?: (y: number) => number;
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
  allowArms = true,
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
  const legSplit = profile.legSplitX ? profile.legSplitX(y) : 0;
  const isLeftArm = x >= 0;
  const isLeftLeg = x >= legSplit;

  // Compute smooth arm weight using the character-specific torso/arm separator curve.
  let armWeight = 0;
  if (allowArms) {
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
  }

  // Compute smooth leg weight below hip level, keeping left/right strictly isolated and crotch anchored to Hips
  const hipsY = j.mixamorigHips[1];
  let legWeight = 0;
  if (y < hipsY + 0.05 && armWeight < 0.5) {
    legWeight = 1 - smoothstep(profile.crotchY - 0.035, hipsY + 0.04, y);
    const dxSplit = Math.abs(x - legSplit);
    if (legWeight > 0 && dxSplit < 0.042 && y >= profile.crotchY - 0.065) {
      const midlineHipHold =
        (1 - smoothstep(0.004, 0.042, dxSplit)) *
        smoothstep(profile.crotchY - 0.065, profile.crotchY + 0.035, y);
      legWeight *= 1 - midlineHipHold * 0.85;
    }
  }

  const torsoWeight = Math.max(0, 1 - armWeight - legWeight);

  if (armWeight > 1e-4) {
    const armChain: MixamoBoneName[] = isLeftArm
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
    const legChain: MixamoBoneName[] = isLeftLeg
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

  const headCandidates: Array<{
    index: number;
    skinned: THREE.SkinnedMesh;
    vertexCount: number;
    maxY: number;
    minY: number;
    avgZ: number;
  }> = [];

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
    let sumWorldZ = 0;

    for (let i = 0; i < count; i++) {
      const rx = posAttr.getX(i);
      const ry = posAttr.getY(i);
      const rz = posAttr.getZ(i);

      // World-meter coordinates (+Z facing, feet at y=0, height = profile.targetHeight)
      const wx = (rx - centerX) * worldScale;
      const wy = (ry - minY) * worldScale;
      const wz = (rz - centerZ) * worldScale;
      sumWorldZ += wz;

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

    const ySpan = meshMaxY - meshMinY;
    if (ySpan > 1.22 || (meshMinY < 0.25 && meshMaxY > 1.42)) {
      skinned.userData.partSlot = 'body';
    } else if (meshMaxY <= 0.42 && meshMinY < 0.14) {
      skinned.userData.partSlot = 'shoes';
    } else if (meshMinY < 0.65 && meshMaxY <= 1.22) {
      skinned.userData.partSlot = 'pants';
    } else if (meshMinY >= 0.68 && meshMaxY <= 1.58 && meshMinY < 1.35) {
      skinned.userData.partSlot = 'shirt';
    } else {
      skinned.userData.partSlot = 'head';
      headCandidates.push({
        index: m,
        skinned,
        vertexCount: count,
        maxY: meshMaxY,
        minY: meshMinY,
        avgZ: count > 0 ? sumWorldZ / count : 0,
      });
    }

    riggedRoot.add(skinned);
    skinned.bind(skeleton);
  }

  if (headCandidates.length >= 2) {
    headCandidates.sort((a, b) => b.maxY - a.maxY || b.vertexCount - a.vertexCount);
    headCandidates[0].skinned.userData.partSlot = 'head';
    for (let h = 1; h < headCandidates.length; h++) {
      const cand = headCandidates[h];
      const looksLikeFrontMask =
        cand.maxY < 1.635 && cand.maxY - cand.minY < 0.24 && cand.avgZ > 0.015;
      cand.skinned.userData.partSlot = looksLikeFrontMask ? 'mask' : 'head';
    }
  }

  return riggedRoot;
}

function findAdaptiveXGap(xs: number[]): { splitX: number; gapWidth: number } {
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

export function autoRigSkinBundle(
  rawStaticScene: THREE.Group,
  gender: 'male' | 'female',
): THREE.Group {
  const targetHeight = gender === 'female' ? 1.72 : 1.74;
  rawStaticScene.updateMatrixWorld(true);

  const sourceMeshes: Array<{
    name: string;
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
      geometry: geom,
      material: mesh.material,
      box: meshBox,
    });
  });

  const minY = Number.isFinite(totalBox.min.y) ? totalBox.min.y : 0;
  const maxY = Number.isFinite(totalBox.max.y) ? totalBox.max.y : 1;
  const worldScale = targetHeight / Math.max(1e-4, maxY - minY);
  const localScale = worldScale / AUTO_RIG_SCENE_SCALE;

  // Two-pass torso-core centering (excludes outstretched arms & back ponytails)
  const torsoXs: number[] = [];
  for (let m = 0; m < sourceMeshes.length; m++) {
    const pos = sourceMeshes[m].geometry.getAttribute('position');
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
  for (let m = 0; m < sourceMeshes.length; m++) {
    const pos = sourceMeshes[m].geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const ym = (pos.getY(i) - minY) * worldScale;
      if (ym >= 0.84 && ym <= 1.30) {
        const xm = (pos.getX(i) - roughCenterX) * worldScale;
        if (Math.abs(xm) < 0.175) {
          tmpV.set(pos.getX(i), pos.getY(i), pos.getZ(i));
          coreBox.expandByPoint(tmpV);
        }
      }
    }
  }
  const centerBox = coreBox.isEmpty() ? totalBox : coreBox;
  const centerX = (centerBox.min.x + centerBox.max.x) * 0.5;
  const centerZ = (centerBox.min.z + centerBox.max.z) * 0.5;

  // Gather world-meter normalized points per mesh for accurate joint measurement
  const ankleXs: number[] = [];
  const kneeXs: number[] = [];
  const hipXs: number[] = [];
  const worldPts: Array<{ x: number; y: number; z: number }> = [];

  for (let m = 0; m < sourceMeshes.length; m++) {
    const pos = sourceMeshes[m].geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const wx = (pos.getX(i) - centerX) * worldScale;
      const wy = (pos.getY(i) - minY) * worldScale;
      const wz = (pos.getZ(i) - centerZ) * worldScale;
      worldPts.push({ x: wx, y: wy, z: wz });
      if (wy >= 0.03 && wy <= 0.16) ankleXs.push(wx);
      else if (wy >= 0.40 && wy <= 0.55) kneeXs.push(wx);
      else if (wy >= 0.62 && wy <= 0.78) hipXs.push(wx);
    }
  }

  const ankleGap = findAdaptiveXGap(ankleXs);
  const kneeGap = findAdaptiveXGap(kneeXs);
  const hipGap = findAdaptiveXGap(hipXs);
  const ankleSplitX = ankleGap.gapWidth > 0.03 ? ankleGap.splitX : 0;
  const kneeSplitX = kneeGap.gapWidth > 0.03 ? kneeGap.splitX : ankleSplitX;
  const hipSplitX = hipGap.gapWidth > 0.025 ? hipGap.splitX : kneeSplitX;

  const avgTuple = (
    pred: (x: number, y: number, z: number) => boolean,
    fallback: readonly [number, number, number],
  ): [number, number, number] => {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let count = 0;
    for (let i = 0; i < worldPts.length; i++) {
      const p = worldPts[i];
      if (pred(p.x, p.y, p.z)) {
        sx += p.x;
        sy += p.y;
        sz += p.z;
        count++;
      }
    }
    if (count === 0) return [fallback[0], fallback[1], fallback[2]];
    return [sx / count, sy / count, sz / count];
  };

  const hips = avgTuple((x, y) => Math.abs(x) < 0.16 && y >= 0.84 && y <= 0.96, [0, 0.90, 0]);
  hips[0] = 0;
  const spine = avgTuple((x, y) => Math.abs(x) < 0.16 && y >= 0.98 && y <= 1.08, [0, 1.03, 0]);
  spine[0] = 0;
  const spine1 = avgTuple((x, y) => Math.abs(x) < 0.16 && y >= 1.12 && y <= 1.22, [0, 1.16, 0]);
  spine1[0] = 0;
  const spine2 = avgTuple((x, y) => Math.abs(x) < 0.16 && y >= 1.26 && y <= 1.35, [0, 1.30, -0.01]);
  spine2[0] = 0;
  const neck = avgTuple((x, y, z) => Math.abs(x) < 0.09 && y >= 1.40 && y <= 1.47 && z >= -0.09 && z <= 0.09, [0, 1.43, -0.01]);
  neck[0] = 0;
  const head = avgTuple((x, y, z) => Math.abs(x) < 0.11 && y >= 1.49 && y <= 1.61 && z >= -0.10 && z <= 0.13, [0, 1.54, 0]);
  head[0] = 0;
  const headTop: [number, number, number] = [0, targetHeight, head[2]];

  const measureArm = (side: 1 | -1) => {
    const shRaw = avgTuple(
      (x, y) => side * x >= 0.14 && side * x <= 0.22 && y >= 1.26 && y <= 1.44,
      [side * 0.18, 1.36, -0.02],
    );
    const midRaw = avgTuple(
      (x, y) => side * x >= 0.23 && side * x <= 0.34 && y >= 0.88 && y <= 1.46,
      [side * 0.28, 1.18, -0.03],
    );
    const farRaw = avgTuple(
      (x, y) => side * x >= 0.29 && side * x <= 0.74 && y >= 0.74 && y <= 1.48,
      [side * 0.44, 0.96, -0.03],
    );
    const shV = new THREE.Vector3(side * Math.max(0.165, Math.abs(shRaw[0])), shRaw[1], shRaw[2]);
    const dir = new THREE.Vector3(farRaw[0], farRaw[1], farRaw[2]).sub(shV);
    if (dir.lengthSq() < 0.01) {
      dir.set(midRaw[0], midRaw[1], midRaw[2]).sub(shV);
    }
    if (dir.lengthSq() < 0.005) {
      dir.set(side * 0.65, -0.75, 0);
    }
    dir.normalize();
    const clav: [number, number, number] = [side * 0.075, shV.y + 0.02, shV.z];
    const elbowV = shV.clone().addScaledVector(dir, 0.24);
    const wristV = elbowV.clone().addScaledVector(dir, 0.24);
    const fingerV = wristV.clone().addScaledVector(dir, 0.085);
    return {
      clavicle: clav,
      sh: [shV.x, shV.y, shV.z] as [number, number, number],
      elbow: [elbowV.x, elbowV.y, elbowV.z] as [number, number, number],
      wrist: [wristV.x, wristV.y, wristV.z] as [number, number, number],
      finger: [fingerV.x, fingerV.y, fingerV.z] as [number, number, number],
    };
  };

  const lArm = measureArm(1);
  const rArm = measureArm(-1);

  const measureLeg = (isLeft: boolean) => {
    const match = (x: number, split: number) => (isLeft ? x >= split + 0.01 : x <= split - 0.01);
    const up = avgTuple(
      (x, y) => match(x, hipSplitX) && Math.abs(x) < 0.24 && y >= 0.78 && y <= 0.90,
      [isLeft ? 0.10 : -0.10, 0.85, 0],
    );
    const knee = avgTuple(
      (x, y) => match(x, kneeSplitX) && Math.abs(x) < 0.26 && y >= 0.42 && y <= 0.52,
      [isLeft ? 0.12 : -0.12, 0.47, -0.02],
    );
    const foot = avgTuple(
      (x, y) => match(x, ankleSplitX) && Math.abs(x) < 0.30 && y >= 0.04 && y <= 0.14,
      [isLeft ? 0.14 : -0.14, 0.09, -0.02],
    );
    const toe: [number, number, number] = [foot[0], 0.03, foot[2] + 0.105];
    return { up, knee, foot, toe };
  };

  const lLeg = measureLeg(true);
  const rLeg = measureLeg(false);

  const isAPose = Math.abs(lArm.sh[1] - lArm.wrist[1]) >= 0.20;
  const profile: AutoRigProfile = {
    targetHeight,
    crotchY: 0.72,
    armMinY: isAPose ? 0.74 : 1.24,
    armBoundaryX: isAPose
      ? (y: number) => (y >= 1.24 ? 0.165 : Math.min(0.26, 0.165 + (1.24 - y) * 0.23))
      : (y: number) => (y >= 1.24 ? 0.184 : 99),
    legSplitX: (y: number) => (y < 0.30 ? ankleSplitX : y < 0.55 ? kneeSplitX : hipSplitX),
    joints: {
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
    },
  };

  const riggedRoot = new THREE.Group();
  riggedRoot.name = `FF_CustomSkin_${gender}_RiggedScene`;

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

    const meshMinY = (entry.box.min.y - minY) * worldScale;
    const meshMaxY = (entry.box.max.y - minY) * worldScale;
    const meshWidthX = (entry.box.max.x - entry.box.min.x) * worldScale;
    const isRigidHead = meshMinY >= 1.46;
    const isCollarMesh = !isRigidHead && meshMinY >= 0.88 && meshMaxY <= 1.56;
    const isTorsoOnlyMesh = !isRigidHead && meshMinY >= 0.85 && meshMaxY <= 1.58 && meshWidthX < 0.48;
    const allowArms = meshMaxY > 1.22 || (meshMinY < 0.25 && meshMaxY > 1.42);

    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      const rx = posAttr.getX(i);
      const ry = posAttr.getY(i);
      const rz = posAttr.getZ(i);

      const wx = (rx - centerX) * worldScale;
      const wy = (ry - minY) * worldScale;
      const wz = (rz - centerZ) * worldScale;

      posAttr.setXYZ(
        i,
        (rx - centerX) * localScale,
        (ry - minY) * localScale,
        (rz - centerZ) * localScale,
      );

      const skin = computeVertexSkin(
        wx,
        wy,
        wz,
        isRigidHead,
        isCollarMesh,
        isTorsoOnlyMesh,
        profile,
        allowArms,
      );
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
