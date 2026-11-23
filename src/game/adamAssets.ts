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

export interface FFModelAssetPack {
  modelId: FFModelId;
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

export function isAdamAssetsLoaded(): boolean {
  return loadedData !== null;
}

export function getAdamData(): AdamLoadedData | null {
  return loadedData;
}

export function getModelAssetPack(modelId: FFModelId = 'adam'): FFModelAssetPack | null {
  if (!loadedData) return null;
  if (modelId === 'eva') return loadedData.eva;
  if (modelId === 'maxim') return loadedData.maxim;
  if (modelId === 'kelly') return loadedData.kelly;
  return loadedData.adam;
}

export function getAimPoseQuats(modelId: FFModelId = 'adam'): Record<string, THREE.Quaternion> | null {
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

function buildFFPack(
  modelId: FFModelId,
  rawScene: THREE.Group,
  srcScene: THREE.Group,
  srcClips: THREE.AnimationClip[],
  rawRotY = -Math.PI / 2,
): FFModelAssetPack {
  // Normalize meshes: disable frustum culling & preserve clean PBR skin/outfit maps
  rawScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      stdMat.roughness = Math.max(0.62, stdMat.roughness ?? 0.78);
      stdMat.metalness = Math.min(0.12, stdMat.metalness ?? 0.04);
      if (stdMat.map) {
        stdMat.map.colorSpace = THREE.SRGBColorSpace;
        stdMat.map.needsUpdate = true;
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

  // Measure source skeleton bind-pose limb directions in upright +Z world space
  srcScene.updateMatrixWorld(true);
  const srcDirArmL = getWorldLimbDir(srcScene, 'upperarm_l', 'lowerarm_l', new THREE.Vector3(1, 0, 0));
  const srcDirForeL = getWorldLimbDir(srcScene, 'lowerarm_l', 'hand_l', new THREE.Vector3(1, 0, 0));
  const srcDirArmR = getWorldLimbDir(srcScene, 'upperarm_r', 'lowerarm_r', new THREE.Vector3(-1, 0, 0));
  const srcDirForeR = getWorldLimbDir(srcScene, 'lowerarm_r', 'hand_r', new THREE.Vector3(-1, 0, 0));
  const srcDirLegL = getWorldLimbDir(srcScene, 'thigh_l', 'calf_l', new THREE.Vector3(0, -1, 0));
  const srcDirShinL = getWorldLimbDir(srcScene, 'calf_l', 'foot_l', new THREE.Vector3(0, -1, 0));
  const srcDirLegR = getWorldLimbDir(srcScene, 'thigh_r', 'calf_r', new THREE.Vector3(0, -1, 0));
  const srcDirShinR = getWorldLimbDir(srcScene, 'calf_r', 'foot_r', new THREE.Vector3(0, -1, 0));

  // Align destination limbs to match source bind-pose directions before sampling bind quats
  alignBoneToWorldDir(wrapper, 'mixamorigLeftArm', 'mixamorigLeftForeArm', srcDirArmL);
  alignBoneToWorldDir(wrapper, 'mixamorigLeftForeArm', 'mixamorigLeftHand', srcDirForeL);
  alignBoneToWorldDir(wrapper, 'mixamorigRightArm', 'mixamorigRightForeArm', srcDirArmR);
  alignBoneToWorldDir(wrapper, 'mixamorigRightForeArm', 'mixamorigRightHand', srcDirForeR);
  alignBoneToWorldDir(wrapper, 'mixamorigLeftUpLeg', 'mixamorigLeftLeg', srcDirLegL);
  alignBoneToWorldDir(wrapper, 'mixamorigLeftLeg', 'mixamorigLeftFoot', srcDirShinL);
  alignBoneToWorldDir(wrapper, 'mixamorigRightUpLeg', 'mixamorigRightLeg', srcDirLegR);
  alignBoneToWorldDir(wrapper, 'mixamorigRightLeg', 'mixamorigRightFoot', srcDirShinR);
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
        const worldDeltaY = tmpSrcPos.y - srcHipsBindWorldY;
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

        if ((modelId === 'adam' || modelId === 'maxim') && (dstName === 'mixamorigLeftShoulder' || dstName === 'mixamorigRightShoulder')) {
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

      // For straight T-pose meshes (Adam & Maxim), softly limit extreme (>60°) elbow bends so arms never crease or over-fold
      if (modelId === 'adam' || modelId === 'maxim') {
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
  }

  srcMixer.stopAllAction();

  // Restore aligned bind pose on wrapper
  for (const [dstName, q] of savedLocalQuats.entries()) {
    dstNodes.get(dstName)?.quaternion.copy(q);
  }
  if (dstHips) dstHips.position.copy(savedHipsPos);
  wrapper.updateMatrixWorld(true);

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
      const [animLibGltf, ffAdamGltf, ffEvaGltf, maximGltf, kellyGltf] = await Promise.all([
        loadGlbAsync(loader, '/assets/models/adam.glb'),
        loadGlbAsync(loader, '/assets/models/ff_adam.glb'),
        loadGlbAsync(loader, '/assets/models/ff_eva.glb'),
        loadGlbAsync(loader, '/assets/models/maxim.glb'),
        loadGlbAsync(loader, '/assets/models/kelly.glb'),
      ]);

      onStep?.(72, 'Aplicando animações Free Fire nos 4 personagens...');
      const adamPack = buildFFPack('adam', ffAdamGltf.scene, animLibGltf.scene, animLibGltf.animations);
      const evaPack = buildFFPack('eva', ffEvaGltf.scene, animLibGltf.scene, animLibGltf.animations);
      const maximRigged = autoRigStaticCharacter(maximGltf.scene, 'maxim');
      const kellyRigged = autoRigStaticCharacter(kellyGltf.scene, 'kelly');
      const maximPack = buildFFPack('maxim', maximRigged, animLibGltf.scene, animLibGltf.animations, 0);
      const kellyPack = buildFFPack('kelly', kellyRigged, animLibGltf.scene, animLibGltf.animations, 0);

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
