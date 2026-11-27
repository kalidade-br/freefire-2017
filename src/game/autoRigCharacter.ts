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

type ComponentRole = 'head' | 'armL' | 'armR' | 'leg' | 'merged';

interface VertexSkinContext {
  role: ComponentRole;
  legSide: 'L' | 'R' | 'both';
  isCollarMesh: boolean;
  isTorsoOnlyMesh: boolean;
  allowArms: boolean;
}

function distToChainSq(
  px: number,
  py: number,
  pz: number,
  joints: Record<MixamoBoneName, readonly [number, number, number]>,
  chain: ReadonlyArray<MixamoBoneName>,
): number {
  let best = Infinity;
  for (let s = 0; s < chain.length - 1; s++) {
    const a = joints[chain[s]];
    const b = joints[chain[s + 1]];
    const t = projectT(px, py, pz, a[0], a[1], a[2], b[0], b[1], b[2]);
    const qx = a[0] + (b[0] - a[0]) * t;
    const qy = a[1] + (b[1] - a[1]) * t;
    const qz = a[2] + (b[2] - a[2]) * t;
    const d = (px - qx) * (px - qx) + (py - qy) * (py - qy) + (pz - qz) * (pz - qz);
    if (d < best) best = d;
  }
  return best;
}

function addTorsoSpineWeights(
  acc: WeightAccumulator,
  y: number,
  isCollarMesh: boolean,
  profile: AutoRigProfile,
  scale: number,
  headCompleteY = 1.46,
  absX = 0,
): void {
  if (scale <= 1e-5) return;
  const j = profile.joints;
  const hipsY = j.mixamorigHips[1];
  const spineY = j.mixamorigSpine[1];
  const spine1Y = j.mixamorigSpine1[1];
  const spine2Y = j.mixamorigSpine2[1];
  const neckY = j.mixamorigNeck[1];

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
    const maxNeck = isCollarMesh && absX >= 0.068 ? 0.55 : 0.88;
    const nw = t * maxNeck;
    addWeight(acc, 'mixamorigSpine2', scale * (1 - nw));
    addWeight(acc, 'mixamorigNeck', scale * nw);
    return;
  }
  if (isCollarMesh) {
    // Anchor wide outer collars/hoods to Spine2/Neck, while letting narrow inner neck skin (absX < 0.068)
    // blend smoothly into Head so the neck meets the jaw without twisting or tearing.
    const innerNeckBlend = 1 - smoothstep(0.052, 0.078, absX);
    const tCollar = smoothstep(neckY, neckY + 0.08, y);
    const collarS2 = 0.45 - 0.15 * tCollar;
    const collarNk = 0.55 + 0.15 * tCollar;
    const tHead = smoothstep(neckY, headCompleteY + 0.025, y);
    const neckS2 = (1 - tHead) * 0.12;
    const neckNk = (1 - tHead) * 0.88;
    const neckHd = tHead;
    addWeight(acc, 'mixamorigSpine2', scale * (collarS2 * (1 - innerNeckBlend) + neckS2 * innerNeckBlend));
    addWeight(acc, 'mixamorigNeck', scale * (collarNk * (1 - innerNeckBlend) + neckNk * innerNeckBlend));
    addWeight(acc, 'mixamorigHead', scale * (neckHd * innerNeckBlend));
    return;
  }
  const tHead = smoothstep(neckY, headCompleteY, y);
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
  ctx?: VertexSkinContext,
): { indices: [number, number, number, number]; weights: [number, number, number, number] } {
  const acc: WeightAccumulator = { entries: [] };
  const j = profile.joints;

  if (ctx) {
    if (ctx.role === 'head') {
      if (y >= 1.44) {
        return {
          indices: [BONE_INDEX.mixamorigHead, 0, 0, 0],
          weights: [1, 0, 0, 0],
        };
      }
      if (y >= 1.37) {
        const tHead = smoothstep(1.37, 1.44, y);
        addWeight(acc, 'mixamorigNeck', 1 - tHead);
        addWeight(acc, 'mixamorigHead', tHead);
      } else {
        const tNeck = smoothstep(1.24, 1.37, y);
        addWeight(acc, 'mixamorigSpine2', 1 - tNeck);
        addWeight(acc, 'mixamorigNeck', tNeck);
      }
      acc.entries.sort((a, b) => b.w - a.w);
      const top = acc.entries.slice(0, 4);
      const sum = top.reduce((s, e) => s + e.w, 0) || 1;
      const indices: [number, number, number, number] = [0, 0, 0, 0];
      const weights: [number, number, number, number] = [0, 0, 0, 0];
      for (let i = 0; i < top.length; i++) {
        indices[i] = top[i].idx;
        weights[i] = top[i].w / sum;
      }
      return { indices, weights };
    }

    if (ctx.role === 'armL' || ctx.role === 'armR') {
      const isLeft = ctx.role === 'armL';
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
      let torsoSeam = 0;
      const absX = Math.abs(x);
      if (y >= 1.24 && absX < 0.155) {
        torsoSeam = (1 - smoothstep(0.095, 0.155, absX)) * 0.35;
      }
      addChainWeights(acc, x, y, z, j, armChain, 1 - torsoSeam, 0.24);
      if (torsoSeam > 1e-4) {
        addWeight(acc, 'mixamorigSpine2', torsoSeam);
      }
      acc.entries.sort((a, b) => b.w - a.w);
      const top = acc.entries.slice(0, 4);
      const sum = top.reduce((s, e) => s + e.w, 0) || 1;
      const indices: [number, number, number, number] = [0, 0, 0, 0];
      const weights: [number, number, number, number] = [0, 0, 0, 0];
      for (let i = 0; i < top.length; i++) {
        indices[i] = top[i].idx;
        weights[i] = top[i].w / sum;
      }
      return { indices, weights };
    }
  }

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
  const isLeftLeg =
    ctx && ctx.legSide !== 'both' ? ctx.legSide === 'L' : x >= legSplit;

  // Compute smooth arm weight using the character-specific torso/arm separator curve.
  let armWeight = 0;
  const effectiveAllowArms = ctx ? ctx.role !== 'leg' && ctx.allowArms : allowArms;
  const effectiveTorsoOnly = ctx ? ctx.isTorsoOnlyMesh : isTorsoOnlyMesh;
  const effectiveCollar = ctx ? ctx.isCollarMesh : isCollarMesh;

  if (effectiveAllowArms) {
    const armChainCand: MixamoBoneName[] = isLeftArm
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
    if (effectiveTorsoOnly) {
      if (y >= 1.24 && absX >= 0.162) {
        armWeight = smoothstep(1.22, 1.30, y) * smoothstep(0.155, 0.205, absX) * 0.72;
      }
    } else if (y >= profile.armMinY) {
      const boundX = profile.armBoundaryX(y);
      if (boundX < 50) {
        let rawArm = smoothstep(boundX - 0.045, boundX + 0.048, absX);
        if (ctx && ctx.role === 'merged' && rawArm > 0.01) {
          // Ensure torso flanks & hip pockets near body stay on torso/hips,
          // while sleeves (absX >= 0.255) smoothly preserve 100% arm weight with zero step cliffs.
          const dArm = Math.sqrt(distToChainSq(x, y, z, j, armChainCand));
          const maxR = y >= 1.24 ? 0.175 : 0.155;
          const minR = y >= 1.24 ? 0.115 : 0.10;
          const prox = 1 - smoothstep(minR, maxR, dArm);
          const keepByX = smoothstep(0.195, 0.255, absX);
          rawArm *= Math.max(prox, keepByX);
        }
        armWeight = rawArm;
      }
    }
  }

  // Compute smooth leg weight below hip level, keeping left/right isolated while feathering shared crotch/inseam meshes
  const hipsY = j.mixamorigHips[1];
  let legWeight = 0;
  const isSharedLegMesh =
    !ctx || ctx.role === 'merged' || (ctx.role === 'leg' && ctx.legSide === 'both');
  if (y < hipsY + 0.05 && armWeight < 0.5) {
    legWeight = 1 - smoothstep(profile.crotchY - 0.035, hipsY + 0.04, y);
    if (isSharedLegMesh) {
      const dxSplit = Math.abs(x - legSplit);
      const crotchBaseY = profile.crotchY - 0.145;
      if (legWeight > 0 && dxSplit < 0.052 && y >= crotchBaseY) {
        const midlineHipHold =
          (1 - smoothstep(0.005, 0.052, dxSplit)) *
          smoothstep(crotchBaseY, profile.crotchY + 0.02, y);
        legWeight *= 1 - midlineHipHold * 0.85;
      }
    }
  }

  const torsoWeight = Math.max(0, 1 - armWeight - legWeight);

  if (armWeight > 1e-4) {
    const shBone: MixamoBoneName = isLeftArm ? 'mixamorigLeftShoulder' : 'mixamorigRightShoulder';
    const armBone: MixamoBoneName = isLeftArm ? 'mixamorigLeftArm' : 'mixamorigRightArm';
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
    if (ctx && ctx.role === 'merged' && y >= 1.05 && absX < 0.235) {
      // Smoothly bridge armpit/deltoid crease through clavicle so raising arms never pinches torso-arm seam
      const clavShare = (1 - smoothstep(0.155, 0.235, absX)) * 0.55;
      addChainWeights(acc, x, y, z, j, armChain, armWeight * (1 - clavShare), 0.28);
      addWeight(acc, shBone, armWeight * clavShare * 0.82);
      addWeight(acc, armBone, armWeight * clavShare * 0.18);
    } else {
      addChainWeights(acc, x, y, z, j, armChain, armWeight, 0.26);
    }
  }

  if (legWeight > 1e-4) {
    const legLChain: MixamoBoneName[] = [
      'mixamorigLeftUpLeg',
      'mixamorigLeftLeg',
      'mixamorigLeftFoot',
      'mixamorigLeftToeBase',
    ];
    const legRChain: MixamoBoneName[] = [
      'mixamorigRightUpLeg',
      'mixamorigRightLeg',
      'mixamorigRightFoot',
      'mixamorigRightToeBase',
    ];
    const dx = x - legSplit;
    if (isSharedLegMesh && y >= 0.54 && Math.abs(dx) < 0.036) {
      const leftRatio = smoothstep(-0.036, 0.036, dx);
      addChainWeights(acc, x, y, z, j, legLChain, legWeight * leftRatio, 0.26);
      addChainWeights(acc, x, y, z, j, legRChain, legWeight * (1 - leftRatio), 0.26);
    } else {
      addChainWeights(acc, x, y, z, j, isLeftLeg ? legLChain : legRChain, legWeight, 0.26);
    }
  }

  if (torsoWeight > 1e-4) {
    addTorsoSpineWeights(
      acc,
      y,
      effectiveCollar,
      profile,
      torsoWeight,
      ctx ? 1.46 : 1.525,
      absX,
    );
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

function findAdaptiveXGap(xs: number[], maxAbsMid = 0.075): { splitX: number; gapWidth: number } {
  if (xs.length < 4) return { splitX: 0, gapWidth: 0 };
  xs.sort((a, b) => a - b);
  let bestGap = 0;
  let bestMid = 0;
  for (let i = 1; i < xs.length; i++) {
    const g = xs[i] - xs[i - 1];
    const mid = (xs[i] + xs[i - 1]) * 0.5;
    if (Math.abs(mid) <= maxAbsMid && g > bestGap) {
      bestGap = g;
      bestMid = mid;
    }
  }
  return { splitX: bestMid, gapWidth: bestGap };
}

interface MeshComponentInfo {
  role: ComponentRole;
  legSide: 'L' | 'R' | 'both';
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  isCollar: boolean;
  isTorsoOnly: boolean;
  allowArms: boolean;
}

function buildMeshWeldedComponents(
  geom: THREE.BufferGeometry,
  worldScale = 1,
): {
  compOfVertex: Int32Array;
  compCount: number;
} {
  const posAttr = geom.getAttribute('position');
  const count = posAttr.count;
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const unite = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  // Weld coincident vertex positions in ~0.25mm world-meter cells (UV/normal seams)
  const weldFactor = 4000 * Math.max(1e-4, worldScale);
  const posMap = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(posAttr.getX(i) * weldFactor)},${Math.round(posAttr.getY(i) * weldFactor)},${Math.round(posAttr.getZ(i) * weldFactor)}`;
    const prev = posMap.get(key);
    if (prev !== undefined) unite(prev, i);
    else posMap.set(key, i);
  }

  const indexAttr = geom.getIndex();
  if (indexAttr) {
    const arr = indexAttr.array;
    for (let i = 0; i + 2 < arr.length; i += 3) {
      unite(arr[i], arr[i + 1]);
      unite(arr[i + 1], arr[i + 2]);
    }
  } else {
    for (let i = 0; i + 2 < count; i += 3) {
      unite(i, i + 1);
      unite(i + 1, i + 2);
    }
  }

  const rootToIdx = new Map<number, number>();
  const compOfVertex = new Int32Array(count);
  let nextIdx = 0;
  for (let i = 0; i < count; i++) {
    const r = find(i);
    let idx = rootToIdx.get(r);
    if (idx === undefined) {
      idx = nextIdx++;
      rootToIdx.set(r, idx);
    }
    compOfVertex[i] = idx;
  }
  return { compOfVertex, compCount: nextIdx };
}

export function autoRigSkinBundle(
  rawStaticScene: THREE.Group,
  gender: 'male' | 'female',
): THREE.Group {
  const targetHeight = gender === 'female' ? 1.72 : 1.74;
  rawStaticScene.updateMatrixWorld(true);

  const rawMeshes: Array<{
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

    rawMeshes.push({
      name: mesh.name || `Mesh_${rawMeshes.length}`,
      geometry: geom,
      material: mesh.material,
      box: meshBox,
    });
  });

  const minY = Number.isFinite(totalBox.min.y) ? totalBox.min.y : 0;
  const maxY = Number.isFinite(totalBox.max.y) ? totalBox.max.y : 1;
  const worldScale = targetHeight / Math.max(1e-4, maxY - minY);
  const localScale = worldScale / AUTO_RIG_SCENE_SCALE;

  const sourceMeshes = rawMeshes.map((rm) => {
    const { compOfVertex, compCount } = buildMeshWeldedComponents(rm.geometry, worldScale);
    return {
      ...rm,
      compOfVertex,
      compCount,
    };
  });

  // Center X using head face/cranium core (immune to staggered feet or asymmetric pockets/holsters)
  const coarseBox = totalBox;
  const roughMidX = (coarseBox.min.x + coarseBox.max.x) * 0.5;
  const headXs: number[] = [];
  const headZs: number[] = [];
  for (let m = 0; m < sourceMeshes.length; m++) {
    const pos = sourceMeshes[m].geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const ym = (pos.getY(i) - minY) * worldScale;
      const xm = (pos.getX(i) - roughMidX) * worldScale;
      if (ym >= 1.48 && ym <= 1.65 && Math.abs(xm) < 0.14) {
        headXs.push(pos.getX(i));
        headZs.push(pos.getZ(i));
      }
    }
  }
  let centerX = roughMidX;
  if (headXs.length >= 12) {
    headXs.sort((a, b) => a - b);
    // Trimmed midpoint (10% - 90%) avoids asymmetric hair/hat brims
    const lo = Math.floor(headXs.length * 0.1);
    const hi = Math.max(lo, Math.floor(headXs.length * 0.9) - 1);
    centerX = (headXs[lo] + headXs[hi]) * 0.5;
  }

  const coreBox = new THREE.Box3();
  for (let m = 0; m < sourceMeshes.length; m++) {
    const entry = sourceMeshes[m];
    const mMinY = (entry.box.min.y - minY) * worldScale;
    const mMaxY = (entry.box.max.y - minY) * worldScale;
    const mWidthX = (entry.box.max.x - entry.box.min.x) * worldScale;
    if (mMinY >= 1.24 && mMaxY >= 1.54 && mWidthX <= 0.42) continue;

    const pos = entry.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const ym = (pos.getY(i) - minY) * worldScale;
      if (ym >= 0.96 && ym <= 1.42) {
        const xm = (pos.getX(i) - centerX) * worldScale;
        if (Math.abs(xm) < 0.145) {
          tmpV.set(pos.getX(i), pos.getY(i), pos.getZ(i));
          coreBox.expandByPoint(tmpV);
        }
      }
    }
  }
  const centerBox = coreBox.isEmpty() ? totalBox : coreBox;
  const centerZ = (centerBox.min.z + centerBox.max.z) * 0.5;

  // Classify each welded component across every mesh in normalized world meters
  const meshComps: MeshComponentInfo[][] = [];
  const worldPts: Array<{
    x: number;
    y: number;
    z: number;
    role: ComponentRole;
    legSide: 'L' | 'R' | 'both';
    isMajorMerged: boolean;
  }> = [];

  for (let m = 0; m < sourceMeshes.length; m++) {
    const entry = sourceMeshes[m];
    const pos = entry.geometry.getAttribute('position');
    const cCount = entry.compCount;
    const minXs = new Float32Array(cCount).fill(Infinity);
    const maxXs = new Float32Array(cCount).fill(-Infinity);
    const minYs = new Float32Array(cCount).fill(Infinity);
    const maxYs = new Float32Array(cCount).fill(-Infinity);
    const compVerts = new Int32Array(cCount);

    for (let i = 0; i < pos.count; i++) {
      const cid = entry.compOfVertex[i];
      compVerts[cid]++;
      const wx = (pos.getX(i) - centerX) * worldScale;
      const wy = (pos.getY(i) - minY) * worldScale;
      if (wx < minXs[cid]) minXs[cid] = wx;
      if (wx > maxXs[cid]) maxXs[cid] = wx;
      if (wy < minYs[cid]) minYs[cid] = wy;
      if (wy > maxYs[cid]) maxYs[cid] = wy;
    }

    const infos: MeshComponentInfo[] = [];
    for (let cid = 0; cid < cCount; cid++) {
      const cMinX = minXs[cid];
      const cMaxX = maxXs[cid];
      const cMinY = minYs[cid];
      const cMaxY = maxYs[cid];
      const maxAbsX = Math.max(Math.abs(cMinX), Math.abs(cMaxX));
      const widthX = cMaxX - cMinX;

      let role: ComponentRole = 'merged';
      let legSide: 'L' | 'R' | 'both' = 'both';

      if (
        ((cMinY >= 1.35 && cMaxY >= 1.48) || (cMinY >= 1.15 && cMaxY >= 1.54)) &&
        maxAbsX <= 0.21
      ) {
        role = 'head';
      } else if (
        cMinY >= 0.58 &&
        cMaxY <= 1.49 &&
        cMinX >= 0.08 &&
        (cMaxY >= 1.18 || maxAbsX >= 0.29)
      ) {
        role = 'armL';
      } else if (
        cMinY >= 0.58 &&
        cMaxY <= 1.49 &&
        cMaxX <= -0.08 &&
        (cMaxY >= 1.18 || maxAbsX >= 0.29)
      ) {
        role = 'armR';
      } else if (cMaxY <= 1.08 && cMinY < 0.68) {
        role = 'leg';
        if (cMinX >= 0.015) legSide = 'L';
        else if (cMaxX <= -0.015) legSide = 'R';
      }

      const isCollar = role === 'merged' && cMinY >= 0.88 && cMaxY <= 1.56;
      // Only treat narrow shells as torso-only if they do not contain sleeve projections (>= 0.23m out)
      const isTorsoOnly =
        role === 'merged' &&
        cMinY >= 0.85 &&
        cMaxY <= 1.58 &&
        widthX < 0.43;
      const allowArms =
        role === 'armL' ||
        role === 'armR' ||
        (role === 'merged' && (cMaxY > 1.22 || maxAbsX > 0.28));

      infos.push({
        role,
        legSide,
        minX: cMinX,
        maxX: cMaxX,
        minY: cMinY,
        maxY: cMaxY,
        isCollar,
        isTorsoOnly,
        allowArms,
      });
    }
    meshComps.push(infos);

    for (let i = 0; i < pos.count; i++) {
      const cid = entry.compOfVertex[i];
      const wx = (pos.getX(i) - centerX) * worldScale;
      const wy = (pos.getY(i) - minY) * worldScale;
      const wz = (pos.getZ(i) - centerZ) * worldScale;
      const info = infos[cid];
      worldPts.push({
        x: wx,
        y: wy,
        z: wz,
        role: info.role,
        legSide: info.legSide,
        isMajorMerged: info.role === 'merged' && compVerts[cid] >= 90,
      });
    }
  }

  // Adaptive torso-arm gap boundary at 5 heights per side (for merged shells)
  const sampleBoundaryAtY = (side: 1 | -1, targetY: number): number => {
    const minSearchMid = targetY >= 1.08 ? 0.118 : 0.155;
    const vals: number[] = [];
    for (let i = 0; i < worldPts.length; i++) {
      const p = worldPts[i];
      if (!p.isMajorMerged && p.role !== 'armL' && p.role !== 'armR') continue;
      if (Math.abs(p.y - targetY) <= 0.034 && side * p.x >= 0) {
        vals.push(side * p.x);
      }
    }
    if (vals.length >= 8) {
      vals.sort((a, b) => a - b);
      const maxVal = vals[vals.length - 1];
      let bestGap = 0;
      let bestMid = 0;
      for (let i = 1; i < vals.length; i++) {
        const g = vals[i] - vals[i - 1];
        const mid = (vals[i] + vals[i - 1]) * 0.5;
        // Require real torso points inside (i >= 4) and real arm points outside (maxVal >= mid + 0.05)
        if (
          i >= 4 &&
          mid >= minSearchMid &&
          mid <= 0.295 &&
          maxVal >= mid + 0.05 &&
          g > bestGap
        ) {
          bestGap = g;
          bestMid = mid;
        }
      }
      if (bestGap >= 0.017) return bestMid;
    }
    const tDown = THREE.MathUtils.clamp((1.26 - targetY) / (1.26 - 0.76), 0, 1);
    return 0.175 + tDown * 0.055;
  };

  const boundYLevels = [1.24, 1.12, 1.00, 0.88, 0.76];
  const boundLeft = boundYLevels.map((y) => sampleBoundaryAtY(1, y));
  const boundRight = boundYLevels.map((y) => sampleBoundaryAtY(-1, y));
  const boundCombined = boundYLevels.map((_, idx) => (boundLeft[idx] + boundRight[idx]) * 0.5);

  const evalArmBoundary = (y: number): number => {
    if (y >= boundYLevels[0]) return boundCombined[0];
    if (y <= boundYLevels[boundYLevels.length - 1]) return boundCombined[boundCombined.length - 1];
    for (let i = 0; i < boundYLevels.length - 1; i++) {
      const yHi = boundYLevels[i];
      const yLo = boundYLevels[i + 1];
      if (y <= yHi && y >= yLo) {
        const t = (yHi - y) / Math.max(1e-4, yHi - yLo);
        return boundCombined[i] + (boundCombined[i + 1] - boundCombined[i]) * t;
      }
    }
    return 0.19;
  };

  // Leg split X using leg + merged lower-body points (never arms)
  const ankleXs: number[] = [];
  const kneeXs: number[] = [];
  const hipXs: number[] = [];
  for (let i = 0; i < worldPts.length; i++) {
    const p = worldPts[i];
    if (p.role === 'armL' || p.role === 'armR' || p.role === 'head') continue;
    if (p.y >= 0.03 && p.y <= 0.16) ankleXs.push(p.x);
    else if (p.y >= 0.40 && p.y <= 0.55) kneeXs.push(p.x);
    else if (p.y >= 0.62 && p.y <= 0.78) hipXs.push(p.x);
  }
  const ankleGap = findAdaptiveXGap(ankleXs, 0.08);
  const kneeGap = findAdaptiveXGap(kneeXs, 0.065);
  const hipGap = findAdaptiveXGap(hipXs, 0.045);
  const ankleSplitX = ankleGap.gapWidth > 0.028 ? ankleGap.splitX : 0;
  const kneeSplitX = kneeGap.gapWidth > 0.028 ? kneeGap.splitX : ankleSplitX * 0.5;
  const hipSplitX = hipGap.gapWidth > 0.028 ? hipGap.splitX : kneeSplitX * 0.4;

  const avgTuple = (
    pred: (p: {
      x: number;
      y: number;
      z: number;
      role: ComponentRole;
      legSide: 'L' | 'R' | 'both';
    }) => boolean,
    fallback: readonly [number, number, number],
  ): [number, number, number] => {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let count = 0;
    for (let i = 0; i < worldPts.length; i++) {
      const p = worldPts[i];
      if (pred(p)) {
        sx += p.x;
        sy += p.y;
        sz += p.z;
        count++;
      }
    }
    if (count === 0) return [fallback[0], fallback[1], fallback[2]];
    return [sx / count, sy / count, sz / count];
  };

  const notArm = (role: ComponentRole) => role !== 'armL' && role !== 'armR';
  const torsoOnly = (role: ComponentRole) => role !== 'armL' && role !== 'armR' && role !== 'head';

  const hips = avgTuple(
    (p) => torsoOnly(p.role) && Math.abs(p.x) < 0.15 && p.y >= 0.84 && p.y <= 0.96,
    [0, 0.90, 0],
  );
  hips[0] = 0;
  const spine = avgTuple(
    (p) => torsoOnly(p.role) && Math.abs(p.x) < 0.15 && p.y >= 0.98 && p.y <= 1.08,
    [0, 1.03, 0],
  );
  spine[0] = 0;
  const spine1 = avgTuple(
    (p) => torsoOnly(p.role) && Math.abs(p.x) < 0.15 && p.y >= 1.12 && p.y <= 1.22,
    [0, 1.16, 0],
  );
  spine1[0] = 0;
  const spine2 = avgTuple(
    (p) => torsoOnly(p.role) && Math.abs(p.x) < 0.15 && p.y >= 1.26 && p.y <= 1.35,
    [0, 1.30, -0.01],
  );
  spine2[0] = 0;
  const neckTorsoPts = worldPts.filter(
    (p) =>
      torsoOnly(p.role) &&
      Math.abs(p.x) < 0.068 &&
      p.y >= 1.38 &&
      p.y <= 1.45 &&
      p.z >= -0.08 &&
      p.z <= 0.08,
  );
  const neck =
    neckTorsoPts.length >= 10
      ? avgTuple(
          (p) =>
            torsoOnly(p.role) &&
            Math.abs(p.x) < 0.068 &&
            p.y >= 1.38 &&
            p.y <= 1.45 &&
            p.z >= -0.08 &&
            p.z <= 0.08,
          [0, 1.41, spine2[2]],
        )
      : avgTuple(
          (p) =>
            notArm(p.role) &&
            Math.abs(p.x) < 0.075 &&
            p.y >= 1.38 &&
            p.y <= 1.45 &&
            p.z >= -0.09 &&
            p.z <= 0.09,
          [0, 1.41, spine2[2]],
        );
  neck[0] = 0;
  neck[2] = THREE.MathUtils.clamp(neck[2], spine2[2] - 0.015, spine2[2] + 0.02);
  const head = avgTuple(
    (p) =>
      notArm(p.role) &&
      Math.abs(p.x) < 0.11 &&
      p.y >= 1.47 &&
      p.y <= 1.61 &&
      p.z >= -0.14 &&
      p.z <= 0.13,
    [0, 1.53, neck[2]],
  );
  head[0] = 0;
  head[2] = THREE.MathUtils.clamp(head[2], neck[2] - 0.015, neck[2] + 0.015);
  const headTop: [number, number, number] = [0, targetHeight, head[2]];

  const measureArm = (side: 1 | -1) => {
    const targetArmRole: ComponentRole = side === 1 ? 'armL' : 'armR';
    const pureArmPts = worldPts.filter((p) => p.role === targetArmRole);
    let pureMinY = Infinity;
    let pureMaxY = -Infinity;
    for (let i = 0; i < pureArmPts.length; i++) {
      if (pureArmPts[i].y < pureMinY) pureMinY = pureArmPts[i].y;
      if (pureArmPts[i].y > pureMaxY) pureMaxY = pureArmPts[i].y;
    }

    const usePureArm = pureArmPts.length >= 40 && pureMaxY - pureMinY >= 0.30;
    const armPts = usePureArm
      ? pureArmPts
      : worldPts.filter((p) => {
          if (p.role === targetArmRole) return true;
          if (p.role !== 'merged') return false;
          if (p.y < 0.72 || p.y > 1.44) return false;
          return side * p.x >= Math.max(0.155, sampleBoundaryAtY(side, p.y));
        });

    const shRaw = avgTuple(
      (p) =>
        (p.role === targetArmRole || p.role === 'merged') &&
        side * p.x >= 0.145 &&
        side * p.x <= 0.235 &&
        p.y >= 1.25 &&
        p.y <= 1.42,
      [side * 0.18, 1.34, spine2[2]],
    );
    const shV = new THREE.Vector3(
      side * THREE.MathUtils.clamp(Math.abs(shRaw[0]), 0.165, 0.225),
      THREE.MathUtils.clamp(shRaw[1], 1.26, 1.40),
      shRaw[2],
    );

    if (armPts.length < 10) {
      const clavicle: [number, number, number] = [side * 0.075, shV.y + 0.02, shV.z];
      return {
        clavicle,
        sh: [shV.x, shV.y, shV.z] as [number, number, number],
        elbow: [side * 0.28, shV.y - 0.19, shV.z - 0.02] as [number, number, number],
        wrist: [side * 0.39, shV.y - 0.40, shV.z - 0.02] as [number, number, number],
        finger: [side * 0.42, shV.y - 0.48, shV.z - 0.02] as [number, number, number],
      };
    }

    // Prefer pure arm/glove endpoints when available so hip/waist mesh cannot hijack farPt
    const handSearchPts = pureArmPts.length >= 40 ? pureArmPts : armPts;
    let farPt = handSearchPts[0];
    let maxDistSq = -1;
    for (let i = 0; i < handSearchPts.length; i++) {
      const p = handSearchPts[i];
      const dx = p.x - shV.x;
      const dy = p.y - shV.y;
      const dz = p.z - shV.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq > maxDistSq) {
        maxDistSq = dSq;
        farPt = p;
      }
    }
    const farV = new THREE.Vector3(farPt.x, farPt.y, farPt.z);
    const armAxis = farV.clone().sub(shV);
    const armSpan = Math.max(0.25, armAxis.length());
    armAxis.divideScalar(armSpan);

    // Filter out any stray torso/waist points far from the shoulder->hand corridor
    const corridorPts = armPts.filter((p) => {
      if (p.role === targetArmRole) return true;
      const dx = p.x - shV.x;
      const dy = p.y - shV.y;
      const dz = p.z - shV.z;
      const proj = THREE.MathUtils.clamp(dx * armAxis.x + dy * armAxis.y + dz * armAxis.z, 0, armSpan);
      const px = shV.x + armAxis.x * proj;
      const py = shV.y + armAxis.y * proj;
      const pz = shV.z + armAxis.z * proj;
      const perpSq = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py) + (p.z - pz) * (p.z - pz);
      return perpSq <= 0.115 * 0.115;
    });
    const measurePts = corridorPts.length >= 16 ? corridorPts : armPts;

    const avgAlongArm = (tMin: number, tMax: number): THREE.Vector3 | null => {
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let cnt = 0;
      for (let i = 0; i < measurePts.length; i++) {
        const p = measurePts[i];
        const t =
          ((p.x - shV.x) * armAxis.x +
            (p.y - shV.y) * armAxis.y +
            (p.z - shV.z) * armAxis.z) /
          armSpan;
        if (t >= tMin && t <= tMax) {
          sx += p.x;
          sy += p.y;
          sz += p.z;
          cnt++;
        }
      }
      return cnt > 0 ? new THREE.Vector3(sx / cnt, sy / cnt, sz / cnt) : null;
    };

    const wristV =
      avgAlongArm(0.75, 0.90) ?? shV.clone().addScaledVector(armAxis, armSpan * 0.82);
    const elbowV =
      avgAlongArm(0.40, 0.56) ?? shV.clone().lerp(wristV, 0.5);

    const foreDir = wristV.clone().sub(elbowV);
    if (foreDir.lengthSq() < 1e-4) foreDir.copy(armAxis);
    else foreDir.normalize();
    const fingerV = wristV.clone().addScaledVector(foreDir, 0.085);

    const clavicle: [number, number, number] = [side * 0.075, shV.y + 0.02, shV.z];
    return {
      clavicle,
      sh: [shV.x, shV.y, shV.z] as [number, number, number],
      elbow: [elbowV.x, elbowV.y, elbowV.z] as [number, number, number],
      wrist: [wristV.x, wristV.y, wristV.z] as [number, number, number],
      finger: [fingerV.x, fingerV.y, fingerV.z] as [number, number, number],
    };
  };

  const lArm = measureArm(1);
  const rArm = measureArm(-1);

  const measureLeg = (isLeft: boolean) => {
    const targetSide: 'L' | 'R' = isLeft ? 'L' : 'R';
    const hasIsolatedSideLegs = worldPts.some(
      (p) => p.role === 'leg' && p.legSide === targetSide && p.y <= 0.16,
    );
    const matchSide = (
      p: { x: number; y: number; z: number; role: ComponentRole; legSide: 'L' | 'R' | 'both' },
      split: number,
    ): boolean => {
      if (p.role === 'armL' || p.role === 'armR' || p.role === 'head') return false;
      if (p.role === 'leg' && p.legSide !== 'both') {
        return p.legSide === targetSide;
      }
      return isLeft ? p.x >= split + 0.01 : p.x <= split - 0.01;
    };

    const up = avgTuple(
      (p) => matchSide(p, hipSplitX) && Math.abs(p.x) < 0.175 && p.y >= 0.78 && p.y <= 0.90,
      [isLeft ? 0.10 : -0.10, 0.85, 0],
    );
    const knee = avgTuple(
      (p) => matchSide(p, kneeSplitX) && Math.abs(p.x) < 0.28 && p.y >= 0.41 && p.y <= 0.54,
      [isLeft ? 0.12 : -0.12, 0.47, -0.02],
    );
    const foot = avgTuple(
      (p) => matchSide(p, ankleSplitX) && Math.abs(p.x) < 0.34 && p.y >= 0.04 && p.y <= 0.15,
      [isLeft ? 0.14 : -0.14, 0.09, -0.02],
    );

    const soleZs: number[] = [];
    for (let i = 0; i < worldPts.length; i++) {
      const p = worldPts[i];
      if (p.y > 0.06) continue;
      if (hasIsolatedSideLegs && p.role === 'leg' && p.legSide !== 'both') {
        if (p.legSide === targetSide) soleZs.push(p.z);
      } else if (matchSide(p, ankleSplitX) && Math.abs(p.x) < 0.34) {
        soleZs.push(p.z);
      }
    }
    let toeZ = foot[2] + 0.105;
    if (soleZs.length > 0) {
      soleZs.sort((a, b) => a - b);
      const frontZ = soleZs[Math.min(soleZs.length - 1, Math.floor(soleZs.length * 0.88))];
      toeZ = Math.max(foot[2] + 0.06, frontZ);
    }
    const toe: [number, number, number] = [foot[0], 0.025, toeZ];
    return { up, knee, foot, toe };
  };

  const lLeg = measureLeg(true);
  const rLeg = measureLeg(false);

  const isAPose = Math.abs(lArm.sh[1] - lArm.wrist[1]) >= 0.16;
  const profile: AutoRigProfile = {
    targetHeight,
    crotchY: Math.max(0.66, hips[1] - 0.16),
    armMinY: isAPose ? 0.70 : 1.24,
    armBoundaryX: evalArmBoundary,
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
    const compInfos = meshComps[m];

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

      const comp = compInfos[entry.compOfVertex[i]];
      const skin = computeVertexSkin(
        wx,
        wy,
        wz,
        comp.role === 'head',
        comp.isCollar,
        comp.isTorsoOnly,
        profile,
        comp.allowArms,
        {
          role: comp.role,
          legSide: comp.legSide,
          isCollarMesh: comp.isCollar,
          isTorsoOnlyMesh: comp.isTorsoOnly,
          allowArms: comp.allowArms,
        },
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
