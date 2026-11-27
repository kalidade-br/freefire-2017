import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { autoRigStaticCharacter } from './autoRigCharacter';
import type { CharacterModelId } from './types';

export type FFModelId = CharacterModelId;

export const FF_SCENE_SCALE = 1.78;

export const UPPER_AIM_BONE_NAMES = [
  'mixamorigSpine',
  'mixamorigSpine1',
  'mixamorigSpine2',
  'mixamorigNeck',
  'mixamorigHead',
  'mixamorigLeftShoulder',
  'mixamorigLeftArm',
  'mixamorigLeftForeArm',
  'mixamorigLeftHand',
  'mixamorigRightShoulder',
  'mixamorigRightArm',
  'mixamorigRightForeArm',
  'mixamorigRightHand',
] as const;

const BONE_MAP: ReadonlyArray<readonly [src: string, dst: string]> = [
  ['pelvis', 'mixamorigHips'],
  ['spine_01', 'mixamorigSpine'],
  ['spine_02', 'mixamorigSpine1'],
  ['spine_03', 'mixamorigSpine2'],
  ['neck_01', 'mixamorigNeck'],
  ['Head', 'mixamorigHead'],
  ['clavicle_l', 'mixamorigLeftShoulder'],
  ['upperarm_l', 'mixamorigLeftArm'],
  ['lowerarm_l', 'mixamorigLeftForeArm'],
  ['hand_l', 'mixamorigLeftHand'],
  ['clavicle_r', 'mixamorigRightShoulder'],
  ['upperarm_r', 'mixamorigRightArm'],
  ['lowerarm_r', 'mixamorigRightForeArm'],
  ['hand_r', 'mixamorigRightHand'],
  ['thigh_l', 'mixamorigLeftUpLeg'],
  ['calf_l', 'mixamorigLeftLeg'],
  ['foot_l', 'mixamorigLeftFoot'],
  ['thigh_r', 'mixamorigRightUpLeg'],
  ['calf_r', 'mixamorigRightLeg'],
  ['foot_r', 'mixamorigRightFoot'],
];

const RUN_BONE_MAP: ReadonlyArray<readonly [src: string, dst: string]> = [
  ['bone_Hips_02', 'mixamorigHips'],
  ['bone_Spine_011', 'mixamorigSpine'],
  ['bone_Spine1_012', 'mixamorigSpine1'],
  ['bone_Neck_027', 'mixamorigNeck'],
  ['bone_Head_028', 'mixamorigHead'],
  ['bone_LeftClav_015', 'mixamorigLeftShoulder'],
  ['bone_LeftArm_016', 'mixamorigLeftArm'],
  ['bone_LeftForeArm_019', 'mixamorigLeftForeArm'],
  ['bone_LeftHand_020', 'mixamorigLeftHand'],
  ['bone_RightClav_034', 'mixamorigRightShoulder'],
  ['bone_RightArm_035', 'mixamorigRightArm'],
  ['bone_RightForeArm_038', 'mixamorigRightForeArm'],
  ['bone_RightHand_039', 'mixamorigRightHand'],
  ['bone_LeftLegUpper_03', 'mixamorigLeftUpLeg'],
  ['bone_LeftLeg_04', 'mixamorigLeftLeg'],
  ['bone_LeftAnkle_05', 'mixamorigLeftFoot'],
  ['bone_RightLegUpper_07', 'mixamorigRightUpLeg'],
  ['bone_RightLeg_08', 'mixamorigRightLeg'],
  ['bone_RightAnkle_09', 'mixamorigRightFoot'],
];

export interface FFModelAssetPack {
  modelId: string;
  baseScene: THREE.Group;
  animations: THREE.AnimationClip[];
  aimPoseQuats: Record<string, THREE.Quaternion>;
  spineMountQuat: THREE.Quaternion;
  headMountQuat: THREE.Quaternion;
  weaponMountQuat: THREE.Quaternion;
  helmetOffsetY: number;
}

export interface AdamLoadedData {
  adam: FFModelAssetPack;
  eva: FFModelAssetPack;
  maxim: FFModelAssetPack;
  kelly: FFModelAssetPack;
  animations: THREE.AnimationClip[];
  aimPoseQuats: Record<string, THREE.Quaternion>;
}

let loadedData: AdamLoadedData | null = null;
let loadPromise: Promise<AdamLoadedData | null> | null = null;
let cachedAnimLib: {
  srcScene: THREE.Group;
  srcClips: THREE.AnimationClip[];
  runData: { scene: THREE.Group; clip: THREE.AnimationClip } | null;
} | null = null;
const customSkinPacks = new Map<string, FFModelAssetPack>();

export function isAdamAssetsLoaded(): boolean {
  return loadedData !== null;
}

export function getAdamData(): AdamLoadedData | null {
  return loadedData;
}

export function getModelAssetPack(modelId: string = 'adam'): FFModelAssetPack | null {
  const custom = customSkinPacks.get(modelId);
  if (custom) return custom;
  if (!loadedData) return null;
  if (modelId === 'eva') return loadedData.eva;
  if (modelId === 'maxim') return loadedData.maxim;
  if (modelId === 'kelly') return loadedData.kelly;
  return loadedData.adam;
}

export function getCustomSkinPack(bundleId: string): FFModelAssetPack | null {
  return customSkinPacks.get(bundleId) ?? null;
}

export function getOrBuildCustomSkinPack(
  bundleId: string,
  buildRiggedScene: () => THREE.Group,
): FFModelAssetPack | null {
  const existing = customSkinPacks.get(bundleId);
  if (existing) return existing;
  if (!cachedAnimLib) return null;

  const riggedScene = buildRiggedScene();
  const pack = buildFFPack(
    bundleId,
    riggedScene,
    cachedAnimLib.srcScene,
    cachedAnimLib.srcClips,
    0,
    cachedAnimLib.runData,
  );
  customSkinPacks.set(bundleId, pack);
  return pack;
}

export function cloneCharacterSceneForPack(pack: FFModelAssetPack): THREE.Group {
  return SkeletonUtils.clone(pack.baseScene) as THREE.Group;
}

export function getAimPoseQuats(modelId: string = 'adam'): Record<string, THREE.Quaternion> | null {
  const pack = getModelAssetPack(modelId);
  return pack ? pack.aimPoseQuats : null;
}

export function cloneCharacterScene(modelId: FFModelId = 'adam'): THREE.Group | null {
  const pack = getModelAssetPack(modelId);
  if (!pack) return null;
  return SkeletonUtils.clone(pack.baseScene) as THREE.Group;
}

export function cloneAdamScene(): THREE.Group | null {
  return cloneCharacterScene('adam');
}

function loadGlbAsync(
  loader: GLTFLoader,
  url: string,
): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations ?? [] }),
      undefined,
      (err) => reject(err),
    );
  });
}

function alignBoneToWorldDir(
  parentRoot: THREE.Object3D,
  boneName: string,
  childName: string,
  targetWorldDir: THREE.Vector3,
): void {
  const bone = parentRoot.getObjectByName(boneName);
  const child = parentRoot.getObjectByName(childName);
  if (!bone || !child || !bone.parent) return;

  parentRoot.updateMatrixWorld(true);
  const pBone = bone.getWorldPosition(new THREE.Vector3());
  const pChild = child.getWorldPosition(new THREE.Vector3());
  const curDir = pChild.sub(pBone);
  if (curDir.lengthSq() < 1e-8) return;
  curDir.normalize();

  const tgt = targetWorldDir.clone().normalize();
  const dot = THREE.MathUtils.clamp(curDir.dot(tgt), -1, 1);
  if (dot > 0.9999) return;

  const qDeltaW = new THREE.Quaternion();
  if (dot < -0.9999) {
    qDeltaW.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  } else {
    qDeltaW.setFromUnitVectors(curDir, tgt);
  }

  const parentW = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const invParentW = parentW.clone().invert();
  const qLocalDelta = invParentW.multiply(qDeltaW).multiply(parentW);
  bone.quaternion.premultiply(qLocalDelta).normalize();
  parentRoot.updateMatrixWorld(true);
}

function getWorldLimbDir(root: THREE.Object3D, aName: string, bName: string, fallback: THREE.Vector3): THREE.Vector3 {
  const a = root.getObjectByName(aName);
  const b = root.getObjectByName(bName);
  if (!a || !b) return fallback.clone().normalize();
  const pa = a.getWorldPosition(new THREE.Vector3());
  const pb = b.getWorldPosition(new THREE.Vector3());
  const d = pb.sub(pa);
  if (d.lengthSq() < 1e-8) return fallback.clone().normalize();
  return d.normalize();
}

function computePosedWorldMinY(root: THREE.Object3D): number | null {
  root.updateMatrixWorld(true);
  let minY = Infinity;
  const v = new THREE.Vector3();
  root.traverse((obj) => {
    const sm = obj as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.geometry || !sm.skeleton) return;
    const pos = sm.geometry.getAttribute('position');
    if (!pos) return;
    sm.skeleton.update();
    for (let i = 0; i < pos.count; i++) {
      sm.applyBoneTransform(i, v.fromBufferAttribute(pos, i));
      v.applyMatrix4(sm.matrixWorld);
      if (Number.isFinite(v.y) && v.y < minY) minY = v.y;
    }
  });
  return Number.isFinite(minY) ? minY : null;
}

function buildRunLoopFromRunGlb(
  runScene: THREE.Group,
  runClip: THREE.AnimationClip,
  wrapper: THREE.Group,
): THREE.AnimationClip | null {
  let runSkinned: THREE.SkinnedMesh | null = null;
  runScene.traverse((obj) => {
    if (!runSkinned && (obj as THREE.SkinnedMesh).isSkinnedMesh) {
      runSkinned = obj as THREE.SkinnedMesh;
    }
  });
  if (!runSkinned) return null;
  const skel = (runSkinned as THREE.SkinnedMesh).skeleton;
  if (!skel || !skel.bones.length || !skel.boneInverses.length) return null;

  const srcBindWorldPos = new Map<string, THREE.Vector3>();
  const srcBindWorldQ = new Map<string, THREE.Quaternion>();
  const m = new THREE.Matrix4();
  for (let i = 0; i < skel.bones.length; i++) {
    const bone = skel.bones[i];
    const inv = skel.boneInverses[i];
    if (!bone || !inv) continue;
    m.copy(inv).invert();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    m.decompose(pos, quat, scl);
    srcBindWorldPos.set(bone.name, pos);
    srcBindWorldQ.set(bone.name, quat);
  }

  const getBindDir = (aName: string, bName: string, fallback: THREE.Vector3): THREE.Vector3 => {
    const a = srcBindWorldPos.get(aName);
    const b = srcBindWorldPos.get(bName);
    if (!a || !b) return fallback.clone().normalize();
    const d = b.clone().sub(a);
    return d.lengthSq() > 1e-8 ? d.normalize() : fallback.clone().normalize();
  };

  const dstTemp = SkeletonUtils.clone(wrapper) as THREE.Group;
  dstTemp.updateMatrixWorld(true);
  alignBoneToWorldDir(dstTemp, 'mixamorigLeftArm', 'mixamorigLeftForeArm', getBindDir('bone_LeftArm_016', 'bone_LeftForeArm_019', new THREE.Vector3(0.6, -0.8, 0)));
  alignBoneToWorldDir(dstTemp, 'mixamorigLeftForeArm', 'mixamorigLeftHand', getBindDir('bone_LeftForeArm_019', 'bone_LeftHand_020', new THREE.Vector3(0.6, -0.8, 0.2)));
  alignBoneToWorldDir(dstTemp, 'mixamorigRightArm', 'mixamorigRightForeArm', getBindDir('bone_RightArm_035', 'bone_RightForeArm_038', new THREE.Vector3(-0.6, -0.8, 0)));
  alignBoneToWorldDir(dstTemp, 'mixamorigRightForeArm', 'mixamorigRightHand', getBindDir('bone_RightForeArm_038', 'bone_RightHand_039', new THREE.Vector3(-0.6, -0.8, 0.2)));
  alignBoneToWorldDir(dstTemp, 'mixamorigLeftUpLeg', 'mixamorigLeftLeg', getBindDir('bone_LeftLegUpper_03', 'bone_LeftLeg_04', new THREE.Vector3(0, -1, 0)));
  alignBoneToWorldDir(dstTemp, 'mixamorigLeftLeg', 'mixamorigLeftFoot', getBindDir('bone_LeftLeg_04', 'bone_LeftAnkle_05', new THREE.Vector3(0, -1, 0)));
  alignBoneToWorldDir(dstTemp, 'mixamorigRightUpLeg', 'mixamorigRightLeg', getBindDir('bone_RightLegUpper_07', 'bone_RightLeg_08', new THREE.Vector3(0, -1, 0)));
  alignBoneToWorldDir(dstTemp, 'mixamorigRightLeg', 'mixamorigRightFoot', getBindDir('bone_RightLeg_08', 'bone_RightAnkle_09', new THREE.Vector3(0, -1, 0)));
  dstTemp.updateMatrixWorld(true);

  const dstNodes = new Map<string, THREE.Object3D>();
  const dstBindWorldQ = new Map<string, THREE.Quaternion>();
  for (let b = 0; b < RUN_BONE_MAP.length; b++) {
    const [, dstName] = RUN_BONE_MAP[b];
    const db = dstTemp.getObjectByName(dstName);
    if (db) {
      dstNodes.set(dstName, db);
      dstBindWorldQ.set(dstName, db.getWorldQuaternion(new THREE.Quaternion()));
    }
  }
  const dstHips = dstNodes.get('mixamorigHips');
  const dstHipsBindWorldPos = dstHips
    ? dstHips.getWorldPosition(new THREE.Vector3())
    : new THREE.Vector3(0, 0.9, 0);
  const dstSpine2 = dstTemp.getObjectByName('mixamorigSpine2');
  const dstSpine2NeutralQ = dstSpine2 ? dstSpine2.quaternion.clone() : null;
  const dstSpine2BindW = dstSpine2 ? dstSpine2.getWorldQuaternion(new THREE.Quaternion()) : null;

  const runClone = SkeletonUtils.clone(runScene) as THREE.Group;
  runClone.updateMatrixWorld(true);
  let runCloneMeshScale = 1;
  runClone.traverse((obj) => {
    if (runCloneMeshScale === 1 && (obj as THREE.SkinnedMesh).isSkinnedMesh) {
      runCloneMeshScale = Math.max(0.01, obj.getWorldScale(new THREE.Vector3()).y);
    }
  });

  const srcNodes = new Map<string, THREE.Object3D>();
  for (let b = 0; b < RUN_BONE_MAP.length; b++) {
    const [srcName] = RUN_BONE_MAP[b];
    const sb = runClone.getObjectByName(srcName);
    if (sb) srcNodes.set(srcName, sb);
  }
  const srcHips = srcNodes.get('bone_Hips_02');
  const srcBindHipsY = srcBindWorldPos.get('bone_Hips_02')?.y ?? 0.55;

  const duration = Math.max(0.1, runClip.duration);
  const fps = 30;
  const frameCount = Math.max(2, Math.ceil(duration * fps) + 1);
  const times = new Float32Array(frameCount);
  const quatBuffers = new Map<string, Float32Array>();
  for (let b = 0; b < RUN_BONE_MAP.length; b++) {
    const [srcName, dstName] = RUN_BONE_MAP[b];
    if (srcNodes.has(srcName) && dstNodes.has(dstName) && srcBindWorldQ.has(srcName)) {
      quatBuffers.set(dstName, new Float32Array(frameCount * 4));
    }
  }
  const hipsPosBuf = srcHips && dstHips ? new Float32Array(frameCount * 3) : null;

  const runMixer = new THREE.AnimationMixer(runClone);
  const action = runMixer.clipAction(runClip);
  action.reset().play();

  const qSrcCurW = new THREE.Quaternion();
  const qInvSrcBindW = new THREE.Quaternion();
  const qTargetW = new THREE.Quaternion();
  const qParentW = new THREE.Quaternion();
  const qLocal = new THREE.Quaternion();
  const tmpSrcPos = new THREE.Vector3();
  const tmpDstWorldTargetPos = new THREE.Vector3();

  for (let f = 0; f < frameCount; f++) {
    const t = f === frameCount - 1 ? duration : (f / (frameCount - 1)) * duration;
    times[f] = t;
    runMixer.setTime(t);
    runClone.updateMatrixWorld(true);

    if (hipsPosBuf && srcHips && dstHips && dstHips.parent) {
      srcHips.getWorldPosition(tmpSrcPos);
      const srcCurHipsY = tmpSrcPos.y / runCloneMeshScale;
      const worldDeltaY = (srcCurHipsY - srcBindHipsY) * (dstHipsBindWorldPos.y / Math.max(0.1, srcBindHipsY));
      tmpDstWorldTargetPos.copy(dstHipsBindWorldPos);
      tmpDstWorldTargetPos.y += worldDeltaY;
      dstHips.parent.worldToLocal(tmpDstWorldTargetPos);
      hipsPosBuf[f * 3] = tmpDstWorldTargetPos.x;
      hipsPosBuf[f * 3 + 1] = tmpDstWorldTargetPos.y;
      hipsPosBuf[f * 3 + 2] = tmpDstWorldTargetPos.z;
    }

    for (let b = 0; b < RUN_BONE_MAP.length; b++) {
      const [srcName, dstName] = RUN_BONE_MAP[b];
      const sb = srcNodes.get(srcName);
      const db = dstNodes.get(dstName);
      const buf = quatBuffers.get(dstName);
      const sbBindW = srcBindWorldQ.get(srcName);
      const dbBindW = dstBindWorldQ.get(dstName);
      if (!sb || !db || !buf || !sbBindW || !dbBindW) continue;

      sb.getWorldQuaternion(qSrcCurW);
      qInvSrcBindW.copy(sbBindW).invert();
      qTargetW.copy(qSrcCurW).multiply(qInvSrcBindW).multiply(dbBindW);

      if (db.parent) {
        db.parent.getWorldQuaternion(qParentW);
        qLocal.copy(qParentW).invert().multiply(qTargetW).normalize();
      } else {
        qLocal.copy(qTargetW).normalize();
      }

      db.quaternion.copy(qLocal);
      db.updateMatrixWorld(false);

      buf[f * 4] = qLocal.x;
      buf[f * 4 + 1] = qLocal.y;
      buf[f * 4 + 2] = qLocal.z;
      buf[f * 4 + 3] = qLocal.w;
    }

    // Keep Neck smoothly aligned between Spine1/Spine2 and Head during FF_Run_Loop
    const nkNode = dstNodes.get('mixamorigNeck');
    const hdNode = dstNodes.get('mixamorigHead');
    const s2Node = dstTemp.getObjectByName('mixamorigSpine2');
    const nkBuf = quatBuffers.get('mixamorigNeck');
    const hdBuf = quatBuffers.get('mixamorigHead');
    const nkBind = dstBindWorldQ.get('mixamorigNeck');
    const hdBind = dstBindWorldQ.get('mixamorigHead');
    if (nkNode && hdNode && s2Node && nkBuf && hdBuf && nkBind && hdBind && dstSpine2BindW) {
      dstTemp.updateMatrixWorld(true);
      const qS2W = s2Node.getWorldQuaternion(new THREE.Quaternion());
      const qNkW = nkNode.getWorldQuaternion(new THREE.Quaternion());
      const qHdW = hdNode.getWorldQuaternion(new THREE.Quaternion());
      const qS2D = qS2W.clone().multiply(dstSpine2BindW.clone().invert());
      const qNkD = qNkW.clone().multiply(nkBind.clone().invert());
      const qHdD = qHdW.clone().multiply(hdBind.clone().invert());
      const qMidD = qS2D.clone().slerp(qHdD, 0.55);
      qNkD.slerp(qMidD, 0.55);
      const qNewNkW = qNkD.multiply(nkBind).normalize();
      if (nkNode.parent) {
        nkNode.parent.getWorldQuaternion(qParentW);
        qLocal.copy(qParentW).invert().multiply(qNewNkW).normalize();
      } else {
        qLocal.copy(qNewNkW);
      }
      nkNode.quaternion.copy(qLocal);
      nkBuf[f * 4] = qLocal.x;
      nkBuf[f * 4 + 1] = qLocal.y;
      nkBuf[f * 4 + 2] = qLocal.z;
      nkBuf[f * 4 + 3] = qLocal.w;

      qLocal.copy(qNewNkW).invert().multiply(qHdW).normalize();
      hdNode.quaternion.copy(qLocal);
      hdBuf[f * 4] = qLocal.x;
      hdBuf[f * 4 + 1] = qLocal.y;
      hdBuf[f * 4 + 2] = qLocal.z;
      hdBuf[f * 4 + 3] = qLocal.w;
    }
  }

  action.stop();
  runMixer.stopAllAction();
  runMixer.uncacheRoot(runClone);

  const tracks: THREE.KeyframeTrack[] = [];
  if (hipsPosBuf) {
    tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', times, hipsPosBuf));
  }
  if (dstSpine2NeutralQ) {
    const s2Buf = new Float32Array(frameCount * 4);
    for (let f = 0; f < frameCount; f++) {
      s2Buf[f * 4] = dstSpine2NeutralQ.x;
      s2Buf[f * 4 + 1] = dstSpine2NeutralQ.y;
      s2Buf[f * 4 + 2] = dstSpine2NeutralQ.z;
      s2Buf[f * 4 + 3] = dstSpine2NeutralQ.w;
    }
    tracks.push(new THREE.QuaternionKeyframeTrack('mixamorigSpine2.quaternion', times, s2Buf));
  }
  for (const [dstName, buf] of quatBuffers.entries()) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${dstName}.quaternion`, times, buf));
  }

  return new THREE.AnimationClip('FF_Run_Loop', duration, tracks);
}

function buildFFPack(
  modelId: string,
  rawScene: THREE.Group,
  srcScene: THREE.Group,
  srcClips: THREE.AnimationClip[],
  rawRotY = -Math.PI / 2,
  runData?: { scene: THREE.Group; clip: THREE.AnimationClip } | null,
): FFModelAssetPack {
  // Normalize meshes: disable shadows, enable frustum culling with generous animated bounds, and convert PBR to MeshLambertMaterial
  const animCenter = new THREE.Vector3(0, 0.9 / FF_SCENE_SCALE, 0);
  const animRadius = 2.8 / FF_SCENE_SCALE;
  rawScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    if (mesh.geometry) {
      mesh.geometry.boundingSphere = new THREE.Sphere(animCenter.clone(), animRadius);
    }
    const rawMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (rawMat) {
      const pbr = rawMat as THREE.MeshStandardMaterial;
      const map = pbr.map ?? null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 1;
        map.needsUpdate = true;
      }
      if ((pbr as THREE.MeshStandardMaterial).isMeshStandardMaterial || (pbr as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
        const lambert = new THREE.MeshLambertMaterial({
          name: pbr.name,
          color: pbr.color ? pbr.color.clone() : new THREE.Color(0xffffff),
          map,
          transparent: pbr.transparent,
          opacity: pbr.opacity,
          alphaTest: pbr.alphaTest,
          side: pbr.side,
          vertexColors: pbr.vertexColors,
        });
        pbr.dispose();
        mesh.material = lambert;
      }
    }
  });

  // Wrap raw (~0.98m) scene inside +Z-facing upright wrapper (~1.74m)
  rawScene.rotation.set(0, rawRotY, 0);
  rawScene.scale.setScalar(FF_SCENE_SCALE);
  rawScene.position.set(0, 0, 0);

  const wrapper = new THREE.Group();
  wrapper.name = `FF_${modelId}_Wrapper`;
  wrapper.add(rawScene);
  wrapper.updateMatrixWorld(true);

  const isAutoRigged = modelId === 'maxim' || modelId === 'kelly' || modelId.includes(':');

  // Measure source skeleton bind-pose limb directions in upright +Z world space
  srcScene.updateMatrixWorld(true);
  const srcDirArmL = getWorldLimbDir(srcScene, 'upperarm_l', 'lowerarm_l', new THREE.Vector3(1, 0, 0));
  const srcDirForeL = getWorldLimbDir(srcScene, 'lowerarm_l', 'hand_l', new THREE.Vector3(1, 0, 0));
  const srcDirArmR = getWorldLimbDir(srcScene, 'upperarm_r', 'lowerarm_r', new THREE.Vector3(-1, 0, 0));
  const srcDirForeR = getWorldLimbDir(srcScene, 'lowerarm_r', 'hand_r', new THREE.Vector3(-1, 0, 0));
  const srcDirLegL = getWorldLimbDir(srcScene, 'thigh_l', 'calf_l', new THREE.Vector3(0, -1, 0));
  const srcDirShinL = getWorldLimbDir(srcScene, 'calf_l', 'foot_l', new THREE.Vector3(0, -1, 0));
  const srcDirFootL = getWorldLimbDir(srcScene, 'foot_l', 'ball_l', new THREE.Vector3(0, -0.44, 0.90));
  const srcDirLegR = getWorldLimbDir(srcScene, 'thigh_r', 'calf_r', new THREE.Vector3(0, -1, 0));
  const srcDirShinR = getWorldLimbDir(srcScene, 'calf_r', 'foot_r', new THREE.Vector3(0, -1, 0));
  const srcDirFootR = getWorldLimbDir(srcScene, 'foot_r', 'ball_r', new THREE.Vector3(0, -0.44, 0.90));

  // Align destination limbs to match source bind-pose directions before sampling bind quats
  alignBoneToWorldDir(wrapper, 'mixamorigLeftArm', 'mixamorigLeftForeArm', srcDirArmL);
  alignBoneToWorldDir(wrapper, 'mixamorigLeftForeArm', 'mixamorigLeftHand', srcDirForeL);
  alignBoneToWorldDir(wrapper, 'mixamorigRightArm', 'mixamorigRightForeArm', srcDirArmR);
  alignBoneToWorldDir(wrapper, 'mixamorigRightForeArm', 'mixamorigRightHand', srcDirForeR);
  alignBoneToWorldDir(wrapper, 'mixamorigLeftUpLeg', 'mixamorigLeftLeg', srcDirLegL);
  alignBoneToWorldDir(wrapper, 'mixamorigLeftLeg', 'mixamorigLeftFoot', srcDirShinL);
  alignBoneToWorldDir(wrapper, 'mixamorigRightUpLeg', 'mixamorigRightLeg', srcDirLegR);
  alignBoneToWorldDir(wrapper, 'mixamorigRightLeg', 'mixamorigRightFoot', srcDirShinR);
  if (isAutoRigged) {
    alignBoneToWorldDir(wrapper, 'mixamorigLeftFoot', 'mixamorigLeftToeBase', srcDirFootL);
    alignBoneToWorldDir(wrapper, 'mixamorigRightFoot', 'mixamorigRightToeBase', srcDirFootR);
    // Re-ground hips vertically so soles sit flush at y = 0 after straightening bent/staggered legs
    const posedMinY = computePosedWorldMinY(wrapper);
    const groundHips = wrapper.getObjectByName('mixamorigHips');
    if (posedMinY !== null && groundHips && Math.abs(posedMinY) > 1e-4) {
      groundHips.position.y -= posedMinY / FF_SCENE_SCALE;
    }
  }
  wrapper.updateMatrixWorld(true);

  // Measure head height & crown offset in aligned standing pose
  const bbox = new THREE.Box3().setFromObject(wrapper);
  const headBoneBind = wrapper.getObjectByName('mixamorigHead');
  const headWorldY = headBoneBind ? headBoneBind.getWorldPosition(new THREE.Vector3()).y : 1.51;
  const crownAboveHead = Math.max(0.18, bbox.max.y - headWorldY);
  const helmetOffsetY = THREE.MathUtils.clamp(crownAboveHead * 0.48, 0.085, 0.125);

  // Capture aligned bind-pose world quaternions for source & destination
  const srcClone = SkeletonUtils.clone(srcScene) as THREE.Group;
  srcClone.updateMatrixWorld(true);

  const srcBindWorldQ = new Map<string, THREE.Quaternion>();
  const dstBindWorldQ = new Map<string, THREE.Quaternion>();
  const srcNodes = new Map<string, THREE.Object3D>();
  const dstNodes = new Map<string, THREE.Object3D>();

  for (let b = 0; b < BONE_MAP.length; b++) {
    const [srcName, dstName] = BONE_MAP[b];
    const sb = srcClone.getObjectByName(srcName);
    const db = wrapper.getObjectByName(dstName);
    if (sb) {
      srcNodes.set(srcName, sb);
      srcBindWorldQ.set(srcName, sb.getWorldQuaternion(new THREE.Quaternion()));
    }
    if (db) {
      dstNodes.set(dstName, db);
      dstBindWorldQ.set(dstName, db.getWorldQuaternion(new THREE.Quaternion()));
    }
  }

  const actualHeadChainBindW = new Map<string, THREE.Quaternion>();
  for (const bName of ['mixamorigSpine2', 'mixamorigNeck', 'mixamorigHead'] as const) {
    const db = dstNodes.get(bName);
    if (db) actualHeadChainBindW.set(bName, db.getWorldQuaternion(new THREE.Quaternion()));
  }

  // Auto-rigged characters have upright (+Y up, +Z forward) bind spine/neck/head bones;
  // align their virtual bind ref to adam.glb's spine/neck/head bind frame so Spine2-Neck-Head stay straight instead of inheriting UE4's -13°/+17° S-tilt.
  if (isAutoRigged) {
    const spineChainPairs: ReadonlyArray<readonly [string, string]> = [
      ['spine_01', 'mixamorigSpine'],
      ['spine_02', 'mixamorigSpine1'],
      ['spine_03', 'mixamorigSpine2'],
      ['neck_01', 'mixamorigNeck'],
      ['Head', 'mixamorigHead'],
    ];
    for (let s = 0; s < spineChainPairs.length; s++) {
      const [srcN, dstN] = spineChainPairs[s];
      const sbQ = srcBindWorldQ.get(srcN);
      if (sbQ && dstBindWorldQ.has(dstN)) {
        dstBindWorldQ.set(dstN, sbQ.clone());
      }
    }
  }

  const srcPelvis = srcNodes.get('pelvis');
  const dstHips = dstNodes.get('mixamorigHips');
  const srcHipsBindWorldY = srcPelvis ? srcPelvis.getWorldPosition(new THREE.Vector3()).y : 0.92;
  const dstHipsBindWorldPos = dstHips ? dstHips.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0.92, 0);

  // Save initial aligned local transforms on wrapper so we can restore after sampling clips
  const savedLocalQuats = new Map<string, THREE.Quaternion>();
  for (const [dstName, db] of dstNodes.entries()) {
    savedLocalQuats.set(dstName, db.quaternion.clone());
  }
  const savedHipsPos = dstHips ? dstHips.position.clone() : new THREE.Vector3();

  // Retarget all source animation clips onto the destination Mixamo hierarchy
  const srcMixer = new THREE.AnimationMixer(srcClone);
  const fps = 24;
  const retargetedClips: THREE.AnimationClip[] = [];

  const qSrcCurW = new THREE.Quaternion();
  const qInvSrcBindW = new THREE.Quaternion();
  const qTargetW = new THREE.Quaternion();
  const qParentW = new THREE.Quaternion();
  const qLocal = new THREE.Quaternion();
  const tmpSrcPos = new THREE.Vector3();
  const tmpDstWorldTargetPos = new THREE.Vector3();

  for (let c = 0; c < srcClips.length; c++) {
    const srcClip = srcClips[c];
    const duration = Math.max(0.05, srcClip.duration);
    const frameCount = Math.max(2, Math.ceil(duration * fps) + 1);
    const times = new Float32Array(frameCount);

    const quatBuffers = new Map<string, Float32Array>();
    for (let b = 0; b < BONE_MAP.length; b++) {
      const [srcName, dstName] = BONE_MAP[b];
      if (srcNodes.has(srcName) && dstNodes.has(dstName)) {
        quatBuffers.set(dstName, new Float32Array(frameCount * 4));
      }
    }
    const hipsPosBuf = srcPelvis && dstHips ? new Float32Array(frameCount * 3) : null;

    // Reset destination bones to bind before each clip pass
    for (const [dstName, q] of savedLocalQuats.entries()) {
      dstNodes.get(dstName)?.quaternion.copy(q);
    }
    if (dstHips) dstHips.position.copy(savedHipsPos);
    wrapper.updateMatrixWorld(true);

    const action = srcMixer.clipAction(srcClip);
    action.reset();
    action.play();

    for (let f = 0; f < frameCount; f++) {
      const t = f === frameCount - 1 ? duration : (f / (frameCount - 1)) * duration;
      times[f] = t;
      srcMixer.setTime(t);
      srcClone.updateMatrixWorld(true);

      if (hipsPosBuf && srcPelvis && dstHips && dstHips.parent) {
        srcPelvis.getWorldPosition(tmpSrcPos);
        const hipsYScale = isAutoRigged ? dstHipsBindWorldPos.y / Math.max(0.2, srcHipsBindWorldY) : 1;
        const worldDeltaY = (tmpSrcPos.y - srcHipsBindWorldY) * hipsYScale;
        tmpDstWorldTargetPos.copy(dstHipsBindWorldPos);
        tmpDstWorldTargetPos.y += worldDeltaY;
        dstHips.parent.worldToLocal(tmpDstWorldTargetPos);
        hipsPosBuf[f * 3] = tmpDstWorldTargetPos.x;
        hipsPosBuf[f * 3 + 1] = tmpDstWorldTargetPos.y;
        hipsPosBuf[f * 3 + 2] = tmpDstWorldTargetPos.z;
      }

      for (let b = 0; b < BONE_MAP.length; b++) {
        const [srcName, dstName] = BONE_MAP[b];
        const sb = srcNodes.get(srcName);
        const db = dstNodes.get(dstName);
        const buf = quatBuffers.get(dstName);
        if (!sb || !db || !buf) continue;

        const sbBindW = srcBindWorldQ.get(srcName);
        const dbBindW = dstBindWorldQ.get(dstName);
        if (!sbBindW || !dbBindW) continue;

        sb.getWorldQuaternion(qSrcCurW);
        qInvSrcBindW.copy(sbBindW).invert();
        qTargetW.copy(qSrcCurW).multiply(qInvSrcBindW).multiply(dbBindW);

        if (db.parent) {
          db.parent.getWorldQuaternion(qParentW);
          qLocal.copy(qParentW).invert().multiply(qTargetW).normalize();
        } else {
          qLocal.copy(qTargetW).normalize();
        }

        db.quaternion.copy(qLocal);
        db.updateMatrixWorld(false);

        if ((modelId === 'adam' || isAutoRigged) && (dstName === 'mixamorigLeftShoulder' || dstName === 'mixamorigRightShoulder')) {
          const baseShQ = savedLocalQuats.get(dstName);
          if (baseShQ) {
            qLocal.copy(baseShQ).slerp(qLocal, 0.78).normalize();
            db.quaternion.copy(qLocal);
            db.updateMatrixWorld(false);
          }
        }

        buf[f * 4] = qLocal.x;
        buf[f * 4 + 1] = qLocal.y;
        buf[f * 4 + 2] = qLocal.z;
        buf[f * 4 + 3] = qLocal.w;
      }

      // Softly smooth Neck between chest & head and dampen extreme sideways Head roll on custom skins & Eva
      if (isAutoRigged || modelId === 'eva') {
        const s2Node = dstNodes.get('mixamorigSpine2');
        const nkNode = dstNodes.get('mixamorigNeck');
        const hdNode = dstNodes.get('mixamorigHead');
        const nkBuf = quatBuffers.get('mixamorigNeck');
        const hdBuf = quatBuffers.get('mixamorigHead');
        const s2BindActual = actualHeadChainBindW.get('mixamorigSpine2');
        const nkBindActual = actualHeadChainBindW.get('mixamorigNeck');
        const hdBindActual = actualHeadChainBindW.get('mixamorigHead');
        if (s2Node && nkNode && hdNode && nkBuf && hdBuf && s2BindActual && nkBindActual && hdBindActual) {
          wrapper.updateMatrixWorld(true);
          const qS2W = s2Node.getWorldQuaternion(new THREE.Quaternion());
          const qNkW = nkNode.getWorldQuaternion(new THREE.Quaternion());
          const qHdW = hdNode.getWorldQuaternion(new THREE.Quaternion());

          const qS2Delta = qS2W.clone().multiply(s2BindActual.clone().invert());
          const qNkDelta = qNkW.clone().multiply(nkBindActual.clone().invert());
          const qHdDelta = qHdW.clone().multiply(hdBindActual.clone().invert());

          // Dampen sideways Head roll beyond ~3.4° so aiming/idle head posture stays upright instead of crooked
          const headFwdW = new THREE.Vector3(0, 0, 1).applyQuaternion(qHdDelta);
          const headUpW = new THREE.Vector3(0, 1, 0).applyQuaternion(qHdDelta);
          const leftNoRoll = new THREE.Vector3(0, 1, 0).cross(headFwdW);
          if (leftNoRoll.lengthSq() > 1e-4) {
            leftNoRoll.normalize();
            const upNoRoll = headFwdW.clone().cross(leftNoRoll).normalize();
            const roll = Math.atan2(headUpW.dot(leftNoRoll), headUpW.dot(upNoRoll));
            if (Math.abs(roll) > 0.06) {
              const targetRoll = Math.sign(roll) * (0.06 + (Math.abs(roll) - 0.06) * 0.28);
              const qRollFix = new THREE.Quaternion().setFromAxisAngle(headFwdW, roll - targetRoll);
              qHdDelta.premultiply(qRollFix).normalize();
            }
          }
          const qNewHdW = qHdDelta.clone().multiply(hdBindActual).normalize();

          // Bridge Neck smoothly between Spine2 and Head so it never twists or kinks independently
          const qMidDelta = qS2Delta.clone().slerp(qHdDelta, 0.52);
          qNkDelta.slerp(qMidDelta, isAutoRigged ? 0.72 : 0.65);
          const qNewNkW = qNkDelta.multiply(nkBindActual).normalize();

          if (nkNode.parent) {
            nkNode.parent.getWorldQuaternion(qParentW);
            qLocal.copy(qParentW).invert().multiply(qNewNkW).normalize();
          } else {
            qLocal.copy(qNewNkW);
          }
          nkNode.quaternion.copy(qLocal);
          nkNode.updateMatrixWorld(false);
          nkBuf[f * 4] = qLocal.x;
          nkBuf[f * 4 + 1] = qLocal.y;
          nkBuf[f * 4 + 2] = qLocal.z;
          nkBuf[f * 4 + 3] = qLocal.w;

          qLocal.copy(qNewNkW).invert().multiply(qNewHdW).normalize();
          hdNode.quaternion.copy(qLocal);
          hdNode.updateMatrixWorld(false);
          hdBuf[f * 4] = qLocal.x;
          hdBuf[f * 4 + 1] = qLocal.y;
          hdBuf[f * 4 + 2] = qLocal.z;
          hdBuf[f * 4 + 3] = qLocal.w;
        }
      }

      // Softly limit extreme (>60°) elbow bends on auto-rigged / T-pose meshes so arms never crease or over-fold
      if (modelId === 'adam' || isAutoRigged) {
        wrapper.updateMatrixWorld(true);
        const elbowPairs: ReadonlyArray<readonly [string, string, string]> = [
          ['mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand'],
          ['mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand'],
        ];
        for (let ep = 0; ep < elbowPairs.length; ep++) {
          const [armN, foreN, handN] = elbowPairs[ep];
          const armNode = dstNodes.get(armN);
          const foreNode = dstNodes.get(foreN);
          const handNode = dstNodes.get(handN);
          const foreBuf = quatBuffers.get(foreN);
          if (!armNode || !foreNode || !handNode || !foreBuf) continue;

          const pA = armNode.getWorldPosition(new THREE.Vector3());
          const pF = foreNode.getWorldPosition(new THREE.Vector3());
          const pH = handNode.getWorldPosition(new THREE.Vector3());
          const vU = pF.clone().sub(pA).normalize();
          const vF = pH.clone().sub(pF).normalize();
          const ang = Math.acos(THREE.MathUtils.clamp(vU.dot(vF), -1, 1));
          if (ang > 1.05) {
            const targetAng = 1.05 + (ang - 1.05) * 0.3;
            const axisW = vU.clone().cross(vF);
            if (axisW.lengthSq() > 1e-8) {
              axisW.normalize();
              qTargetW.setFromAxisAngle(axisW, targetAng - ang);
              if (foreNode.parent) {
                foreNode.parent.getWorldQuaternion(qParentW);
                qLocal.copy(qParentW).invert().multiply(qTargetW).multiply(qParentW);
                foreNode.quaternion.premultiply(qLocal).normalize();
              } else {
                foreNode.quaternion.premultiply(qTargetW).normalize();
              }
              foreNode.updateMatrixWorld(false);
              foreBuf[f * 4] = foreNode.quaternion.x;
              foreBuf[f * 4 + 1] = foreNode.quaternion.y;
              foreBuf[f * 4 + 2] = foreNode.quaternion.z;
              foreBuf[f * 4 + 3] = foreNode.quaternion.w;
            }
          }
        }
      }
    }

    action.stop();

    const tracks: THREE.KeyframeTrack[] = [];
    if (hipsPosBuf) {
      tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', times, hipsPosBuf));
    }
    for (const [dstName, buf] of quatBuffers.entries()) {
      tracks.push(new THREE.QuaternionKeyframeTrack(`${dstName}.quaternion`, times, buf));
    }

    retargetedClips.push(new THREE.AnimationClip(srcClip.name, duration, tracks));

    if (srcClip.name === 'Punch_Jab' || srcClip.name === 'Punch_Cross') {
      const upperTracks = tracks.filter((tr) => {
        const boneName = tr.name.split('.')[0];
        return (UPPER_AIM_BONE_NAMES as readonly string[]).includes(boneName);
      });
      if (upperTracks.length > 0) {
        retargetedClips.push(
          new THREE.AnimationClip(`${srcClip.name}_Upper`, duration, upperTracks),
        );
      }
    } else if (srcClip.name === 'Crouch_Idle_Loop' || srcClip.name === 'Crouch_Fwd_Loop') {
      const lowerTracks = tracks.filter((tr) => {
        const boneName = tr.name.split('.')[0];
        return !(UPPER_AIM_BONE_NAMES as readonly string[]).includes(boneName);
      });
      if (lowerTracks.length > 0) {
        const lowerClipName =
          srcClip.name === 'Crouch_Idle_Loop' ? 'Crouch_Lower_Idle' : 'Crouch_Lower_Fwd';
        retargetedClips.push(new THREE.AnimationClip(lowerClipName, duration, lowerTracks));
      }
    }
  }

  srcMixer.stopAllAction();

  // Restore aligned bind pose on wrapper
  for (const [dstName, q] of savedLocalQuats.entries()) {
    dstNodes.get(dstName)?.quaternion.copy(q);
  }
  if (dstHips) dstHips.position.copy(savedHipsPos);
  wrapper.updateMatrixWorld(true);

  if (runData) {
    const ffRunClip = buildRunLoopFromRunGlb(runData.scene, runData.clip, wrapper);
    if (ffRunClip) {
      retargetedClips.push(ffRunClip);
    }
  }

  // Calibrate mount inverse quaternions & extract upper-body Aim pose quats on a fresh sample clone
  const spineMountQuat = new THREE.Quaternion();
  const headMountQuat = new THREE.Quaternion();
  const weaponMountQuat = new THREE.Quaternion();
  const aimPoseQuats: Record<string, THREE.Quaternion> = {};

  const sampleClone = SkeletonUtils.clone(wrapper) as THREE.Group;
  const sampleMixer = new THREE.AnimationMixer(sampleClone);

  const idleClip = retargetedClips.find((a) => a.name === 'Idle_Loop') ?? retargetedClips[0];
  if (idleClip) {
    const idleAct = sampleMixer.clipAction(idleClip);
    idleAct.play();
    sampleMixer.update(0.05);
    sampleClone.updateMatrixWorld(true);

    const s2 = sampleClone.getObjectByName('mixamorigSpine2');
    if (s2) spineMountQuat.copy(s2.getWorldQuaternion(new THREE.Quaternion())).invert();

    const hd = sampleClone.getObjectByName('mixamorigHead');
    if (hd) headMountQuat.copy(hd.getWorldQuaternion(new THREE.Quaternion())).invert();

    idleAct.stop();
  }

  const aimClip =
    retargetedClips.find((a) => a.name === 'Pistol_Aim_Neutral') ??
    retargetedClips.find((a) => a.name === 'Pistol_Shoot');
  if (aimClip) {
    const aimAct = sampleMixer.clipAction(aimClip);
    aimAct.reset().play();
    sampleMixer.update(0.05);
    sampleClone.updateMatrixWorld(true);

    const rh = sampleClone.getObjectByName('mixamorigRightHand');
    if (rh) weaponMountQuat.copy(rh.getWorldQuaternion(new THREE.Quaternion())).invert();

    for (let b = 0; b < UPPER_AIM_BONE_NAMES.length; b++) {
      const bName = UPPER_AIM_BONE_NAMES[b];
      const bone = sampleClone.getObjectByName(bName);
      if (bone) {
        aimPoseQuats[bName] = bone.quaternion.clone();
      }
    }
    aimAct.stop();
  }

  sampleMixer.stopAllAction();
  sampleMixer.uncacheRoot(sampleClone);

  return {
    modelId,
    baseScene: wrapper,
    animations: retargetedClips,
    aimPoseQuats,
    spineMountQuat,
    headMountQuat,
    weaponMountQuat,
    helmetOffsetY,
  };
}

export function preloadAdamAssets(
  onStep?: (pct: number, label: string) => void,
): Promise<AdamLoadedData | null> {
  if (loadedData) return Promise.resolve(loadedData);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const loader = new GLTFLoader();
      onStep?.(46, 'Carregando personagens Adam, Eva, Maxim e Kelly...');
      const [animLibGltf, ffAdamGltf, ffEvaGltf, maximGltf, kellyGltf, runGltf] = await Promise.all([
        loadGlbAsync(loader, '/assets/models/adam.glb'),
        loadGlbAsync(loader, '/assets/models/ff_adam.glb'),
        loadGlbAsync(loader, '/assets/models/ff_eva.glb'),
        loadGlbAsync(loader, '/assets/models/maxim.glb'),
        loadGlbAsync(loader, '/assets/models/kelly.glb'),
        loadGlbAsync(loader, '/assets/models/run.glb').catch(() => null),
      ]);

      const runData =
        runGltf && runGltf.animations.length > 0
          ? { scene: runGltf.scene, clip: runGltf.animations[0] }
          : null;

      cachedAnimLib = {
        srcScene: animLibGltf.scene,
        srcClips: animLibGltf.animations,
        runData,
      };

      onStep?.(72, 'Aplicando animações Free Fire nos 4 personagens...');
      const adamPack = buildFFPack('adam', ffAdamGltf.scene, animLibGltf.scene, animLibGltf.animations, -Math.PI / 2, runData);
      const evaPack = buildFFPack('eva', ffEvaGltf.scene, animLibGltf.scene, animLibGltf.animations, -Math.PI / 2, runData);
      const maximRigged = autoRigStaticCharacter(maximGltf.scene, 'maxim');
      const kellyRigged = autoRigStaticCharacter(kellyGltf.scene, 'kelly');
      const maximPack = buildFFPack('maxim', maximRigged, animLibGltf.scene, animLibGltf.animations, 0, runData);
      const kellyPack = buildFFPack('kelly', kellyRigged, animLibGltf.scene, animLibGltf.animations, 0, runData);

      loadedData = {
        adam: adamPack,
        eva: evaPack,
        maxim: maximPack,
        kelly: kellyPack,
        animations: adamPack.animations,
        aimPoseQuats: adamPack.aimPoseQuats,
      };
      onStep?.(88, 'Personagens Adam, Eva, Maxim & Kelly prontos!');
      return loadedData;
    } catch {
      return null;
    }
  })();

  return loadPromise;
}
