import * as THREE from 'three';
import {
  cloneCharacterScene,
  FF_SCENE_SCALE,
  FFModelId,
  getModelAssetPack,
  isAdamAssetsLoaded,
  UPPER_AIM_BONE_NAMES,
} from './adamAssets';
import { CharacterConfig, normalizeCharacterModelId, WeaponId } from './types';
import { buildHybridWeaponModel } from './weapon25d';

export interface CharacterRig {
  isAdam?: boolean;
  modelId?: FFModelId;
  root: THREE.Group;
  adamVisualRoot?: THREE.Group;
  mixer?: THREE.AnimationMixer;
  actions?: Record<string, THREE.AnimationAction>;
  activeClipName?: string;
  adamPelvisBone?: THREE.Object3D | null;
  adamSpineBaseBone?: THREE.Object3D | null;
  adamSpineBone?: THREE.Object3D | null;
  adamSpine2Bone?: THREE.Object3D | null;
  adamHeadBone?: THREE.Object3D | null;
  adamLeftShoulderBone?: THREE.Object3D | null;
  adamRightShoulderBone?: THREE.Object3D | null;
  adamHandLBone?: THREE.Object3D | null;
  adamHandRBone?: THREE.Object3D | null;
  adamThighLBone?: THREE.Object3D | null;
  adamThighRBone?: THREE.Object3D | null;
  adamShinLBone?: THREE.Object3D | null;
  adamShinRBone?: THREE.Object3D | null;
  adamUpperArmLBone?: THREE.Object3D | null;
  adamUpperArmRBone?: THREE.Object3D | null;
  adamLowerArmLBone?: THREE.Object3D | null;
  adamLowerArmRBone?: THREE.Object3D | null;
  adamUpperBones?: Array<{ name: string; bone: THREE.Object3D }>;

  pelvis: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  weaponMount: THREE.Group;
  backMount1: THREE.Group;
  backMount2: THREE.Group;
  muzzleFlash: THREE.Mesh;
  parachuteGroup: THREE.Group;
  surfboardGroup: THREE.Group;
  contactShadow: THREE.Mesh;
  weaponMeshes: Record<WeaponId, THREE.Group>;
  activeWeaponId?: WeaponId | null;
  bodyMeshes: THREE.Mesh[];
  setWeapon: (weaponId: WeaponId | null) => void;
  setBackWeapons: (left: WeaponId | null, right: WeaponId | null) => void;
  setPistolBackWeapon?: (weaponId: WeaponId | null) => void;
  setParachuteVisible: (visible: boolean) => void;
  setSurfboardVisible: (visible: boolean) => void;
  setBandageVisible?: (visible: boolean) => void;
  setHitFlash: (amount: number) => void;
  applyConfig: (config: CharacterConfig) => void;
  dispose: () => void;
}

export function createWeaponModel(weaponId: WeaponId): THREE.Group {
  return buildHybridWeaponModel(weaponId);
}

export function createParachuteCanopyGroup(camoTexture: THREE.Texture): THREE.Group {
  const parachuteGroup = new THREE.Group();
  const canopyMat = new THREE.MeshStandardMaterial({
    map: camoTexture,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.9, 1.15, 10, 1, true, 0, Math.PI),
    canopyMat,
  );
  canopy.rotation.z = Math.PI / 2;
  canopy.rotation.y = Math.PI / 2;
  canopy.position.set(0, 2.1, 0);
  canopy.scale.set(0.55, 1.35, 1.0);
  canopy.castShadow = true;
  parachuteGroup.add(canopy);

  const lineMat = new THREE.LineBasicMaterial({ color: 0x1d201a });
  const linePts = [
    new THREE.Vector3(-0.18, 0.1, 0),
    new THREE.Vector3(-1.35, 2.0, 0.55),
    new THREE.Vector3(-0.18, 0.1, 0),
    new THREE.Vector3(-1.35, 2.0, -0.55),
    new THREE.Vector3(0.18, 0.1, 0),
    new THREE.Vector3(1.35, 2.0, 0.55),
    new THREE.Vector3(0.18, 0.1, 0),
    new THREE.Vector3(1.35, 2.0, -0.55),
  ];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  parachuteGroup.add(new THREE.LineSegments(lineGeo, lineMat));
  parachuteGroup.visible = false;
  return parachuteGroup;
}

export function createVestGeometryGroup(vestMat: THREE.Material): THREE.Group {
  const vestGroup = new THREE.Group();
  const frontPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.155, 0.31, 12), vestMat);
  frontPlate.scale.set(1.06, 1, 0.66);
  const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.045), vestMat);
  pouchL.position.set(-0.08, -0.06, 0.118);
  const pouchR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.045), vestMat);
  pouchR.position.set(0.08, -0.06, 0.118);
  vestGroup.add(frontPlate, pouchL, pouchR);
  return vestGroup;
}

export function createBackpackGeometryGroup(packMat: THREE.Material, darkMat: THREE.Material): THREE.Group {
  const backpackGroup = new THREE.Group();
  const packMain = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.135, 0.32, 10), packMat);
  packMain.scale.set(1.05, 1, 0.6);
  const packTop = new THREE.Mesh(new THREE.SphereGeometry(0.128, 10, 8), packMat);
  packTop.scale.set(1.05, 0.5, 0.6);
  packTop.position.set(0, 0.16, 0);
  const packPocket = new THREE.Mesh(new THREE.SphereGeometry(0.088, 10, 8), darkMat);
  packPocket.scale.set(1.05, 0.85, 0.42);
  packPocket.position.set(0, -0.05, -0.065);
  backpackGroup.add(packMain, packTop, packPocket);
  return backpackGroup;
}

export function createHeadgearSet(hairMat: THREE.Material, darkMat: THREE.Material, useRealHair: boolean) {
  const hairBuzz = new THREE.Group();
  if (!useRealHair) {
    const fallbackBuzz = new THREE.Mesh(
      new THREE.SphereGeometry(0.112, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.54),
      hairMat,
    );
    fallbackBuzz.position.set(0, 0.105, -0.005);
    hairBuzz.add(fallbackBuzz);
  }

  const hairSpiky = new THREE.Group();
  if (!useRealHair) {
    const fallbackSpike = new THREE.Mesh(
      new THREE.SphereGeometry(0.118, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat,
    );
    fallbackSpike.position.set(0, 0.11, -0.005);
    hairSpiky.add(fallbackSpike);
  }

  const capGroup = new THREE.Group();
  const capY = useRealHair ? 0.118 : 0.205;
  const capCrown = new THREE.Mesh(
    new THREE.SphereGeometry(useRealHair ? 0.114 : 0.142, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hairMat,
  );
  capCrown.scale.set(0.96, 1.04, 1.05);
  capCrown.position.set(0, capY, useRealHair ? 0.006 : -0.005);
  const capVisor = new THREE.Mesh(
    new THREE.CylinderGeometry(useRealHair ? 0.105 : 0.13, useRealHair ? 0.105 : 0.13, 0.02, 12, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
    hairMat,
  );
  capVisor.scale.set(1.0, 1.0, 1.28);
  capVisor.position.set(0, capY + 0.015, useRealHair ? 0.072 : 0.065);
  capGroup.add(capCrown, capVisor);

  const helmetGroup = new THREE.Group();
  const helmetMat = new THREE.MeshStandardMaterial({
    color: 0x353c30,
    roughness: 0.42,
    metalness: 0.35,
  });
  const helmY = useRealHair ? 0.115 : 0.205;
  const helmetShell = new THREE.Mesh(
    new THREE.SphereGeometry(useRealHair ? 0.122 : 0.155, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    helmetMat,
  );
  helmetShell.scale.set(0.98, 1.02, 1.08);
  helmetShell.position.set(0, helmY, useRealHair ? 0.005 : -0.008);
  const helmetRim = new THREE.Mesh(
    new THREE.TorusGeometry(useRealHair ? 0.118 : 0.148, 0.015, 8, 16),
    darkMat,
  );
  helmetRim.rotation.x = Math.PI / 2;
  helmetRim.scale.set(0.98, 1.08, 1.0);
  helmetRim.position.set(0, helmY - 0.018, useRealHair ? 0.005 : -0.008);
  helmetGroup.add(helmetShell, helmetRim);

  return { hairBuzz, hairSpiky, capGroup, helmetGroup, helmetMat };
}

function createSurfboardGroup(): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.visible = false;

  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 1.12);
  hullShape.bezierCurveTo(0.22, 0.78, 0.31, 0.25, 0.28, -0.35);
  hullShape.bezierCurveTo(0.26, -0.74, 0.19, -0.94, 0.12, -1.04);
  hullShape.lineTo(0, -0.92);
  hullShape.lineTo(-0.12, -1.04);
  hullShape.bezierCurveTo(-0.19, -0.94, -0.26, -0.74, -0.28, -0.35);
  hullShape.bezierCurveTo(-0.31, 0.25, -0.22, 0.78, 0, 1.12);

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.052,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.014,
    bevelSegments: 2,
    curveSegments: 10,
  });
  hullGeo.rotateX(Math.PI / 2);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.24,
    metalness: 0.18,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.34,
    metalness: 0.55,
  });
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.9,
    metalness: 0.04,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.32,
    metalness: 0.65,
  });
  const jetMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.35,
  });

  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.position.y = 0.07;
  group.add(hullMesh);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.014, 1.62), stripeMat);
  stripe.position.set(0, 0.082, 0.08);
  group.add(stripe);

  const frontPad = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.014, 0.44), padMat);
  frontPad.position.set(0, 0.083, 0.22);
  const rearPad = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.014, 0.42), padMat);
  rearPad.position.set(0, 0.083, -0.44);
  group.add(frontPad, rearPad);

  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.14, 0.22), finMat);
  finL.position.set(-0.12, -0.05, -0.68);
  finL.rotation.x = -0.22;
  const finR = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.14, 0.22), finMat);
  finR.position.set(0.12, -0.05, -0.68);
  finR.rotation.x = -0.22;
  group.add(finL, finR);

  const thruster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.044, 0.14, 10),
    jetMat,
  );
  thruster.rotation.x = Math.PI / 2;
  thruster.position.set(0, 0.042, -0.94);
  group.add(thruster);

  return {
    group,
    dispose: () => {
      hullGeo.dispose();
      stripe.geometry.dispose();
      frontPad.geometry.dispose();
      rearPad.geometry.dispose();
      finL.geometry.dispose();
      finR.geometry.dispose();
      thruster.geometry.dispose();
      hullMat.dispose();
      stripeMat.dispose();
      padMat.dispose();
      finMat.dispose();
      jetMat.dispose();
    },
  };
}

export function createBandageMeshes(): {
  rollGroup: THREE.Group;
  wrapGroup: THREE.Group;
  dispose: () => void;
} {
  const gauzeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.9,
    metalness: 0.02,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.65,
    metalness: 0.05,
  });

  // White bandage roll + trailing gauze strip held in right hand
  const rollGroup = new THREE.Group();
  const rollGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.072, 12);
  const rollMesh = new THREE.Mesh(rollGeo, gauzeMat);
  rollMesh.rotation.z = Math.PI / 2;
  rollGroup.add(rollMesh);

  const stripGeo = new THREE.BoxGeometry(0.044, 0.009, 0.135);
  const stripMesh = new THREE.Mesh(stripGeo, gauzeMat);
  stripMesh.position.set(0, 0.008, 0.072);
  rollGroup.add(stripMesh);

  const tabGeo = new THREE.BoxGeometry(0.022, 0.011, 0.022);
  const tabMesh = new THREE.Mesh(tabGeo, trimMat);
  tabMesh.position.set(0, 0.014, 0.006);
  rollGroup.add(tabMesh);
  rollGroup.visible = false;

  // White wrapped gauze cuff around left forearm
  const wrapGroup = new THREE.Group();
  const cuffGeo = new THREE.CylinderGeometry(0.052, 0.047, 0.13, 12);
  const cuffMesh = new THREE.Mesh(cuffGeo, gauzeMat);
  wrapGroup.add(cuffMesh);

  const ringGeo = new THREE.TorusGeometry(0.051, 0.01, 8, 16);
  const ring1 = new THREE.Mesh(ringGeo, gauzeMat);
  ring1.rotation.x = Math.PI / 2 + 0.16;
  ring1.position.y = 0.028;
  const ring2 = new THREE.Mesh(ringGeo, gauzeMat);
  ring2.rotation.x = Math.PI / 2 - 0.16;
  ring2.position.y = -0.028;
  wrapGroup.add(ring1, ring2);
  wrapGroup.visible = false;

  return {
    rollGroup,
    wrapGroup,
    dispose: () => {
      rollGeo.dispose();
      stripGeo.dispose();
      tabGeo.dispose();
      cuffGeo.dispose();
      ringGeo.dispose();
      gauzeMat.dispose();
      trimMat.dispose();
    },
  };
}

function createAdamCharacterRig(
  initialConfig: CharacterConfig,
  camoTexture: THREE.Texture,
  contactShadowTexture: THREE.Texture,
): CharacterRig {
  const modelId: FFModelId = normalizeCharacterModelId(initialConfig.modelId);
  const pack = getModelAssetPack(modelId)!;
  const clonedScene = cloneCharacterScene(modelId)!;

  const root = new THREE.Group();
  const adamVisualRoot = new THREE.Group();
  adamVisualRoot.add(clonedScene);
  root.add(adamVisualRoot);

  // Dummy fallback hierarchy fields to satisfy interface cleanly
  const pelvis = new THREE.Group();
  const torso = new THREE.Group();
  const headGroup = new THREE.Group();
  const leftShoulder = new THREE.Group();
  const leftElbow = new THREE.Group();
  const rightShoulder = new THREE.Group();
  const rightElbow = new THREE.Group();
  const leftHip = new THREE.Group();
  const leftKnee = new THREE.Group();
  const rightHip = new THREE.Group();
  const rightKnee = new THREE.Group();

  const bodyMeshes: THREE.Mesh[] = [];
  const bodyMats: THREE.MeshStandardMaterial[] = [];

  clonedScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    bodyMeshes.push(mesh);

    const rawMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (rawMat && (rawMat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const clonedMat = (rawMat as THREE.MeshStandardMaterial).clone();
      clonedMat.roughness = Math.max(0.62, clonedMat.roughness ?? 0.78);
      clonedMat.metalness = Math.min(0.12, clonedMat.metalness ?? 0.04);
      mesh.material = clonedMat;
      bodyMats.push(clonedMat);
    }
  });

  const vestMat = new THREE.MeshStandardMaterial({
    color: initialConfig.vestColor,
    roughness: 0.62,
    metalness: 0.16,
  });
  const packMat = new THREE.MeshStandardMaterial({
    color: 0x485038,
    roughness: 0.78,
    metalness: 0.06,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: initialConfig.hairColor,
    roughness: 0.84,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1b1c1f,
    roughness: 0.7,
    metalness: 0.15,
  });

  // Contact shadow disc grounded at y = 0.018
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.018;
  root.add(contactShadow);

  // Locate real Free Fire Mixamo skeleton bones
  const adamPelvisBone = clonedScene.getObjectByName('mixamorigHips') ?? null;
  const adamSpineBaseBone = clonedScene.getObjectByName('mixamorigSpine') ?? adamPelvisBone;
  const adamSpineBone = clonedScene.getObjectByName('mixamorigSpine1') ?? adamPelvisBone;
  const adamSpine2Bone = clonedScene.getObjectByName('mixamorigSpine2') ?? adamSpineBone;
  const adamHeadBone = clonedScene.getObjectByName('mixamorigHead') ?? adamSpine2Bone;
  const adamLeftShoulderBone = clonedScene.getObjectByName('mixamorigLeftShoulder') ?? null;
  const adamRightShoulderBone = clonedScene.getObjectByName('mixamorigRightShoulder') ?? null;
  const adamHandRBone = clonedScene.getObjectByName('mixamorigRightHand') ?? adamSpine2Bone;
  const adamThighLBone = clonedScene.getObjectByName('mixamorigLeftUpLeg') ?? null;
  const adamThighRBone = clonedScene.getObjectByName('mixamorigRightUpLeg') ?? null;
  const adamShinLBone = clonedScene.getObjectByName('mixamorigLeftLeg') ?? null;
  const adamShinRBone = clonedScene.getObjectByName('mixamorigRightLeg') ?? null;
  const adamUpperArmLBone = clonedScene.getObjectByName('mixamorigLeftArm') ?? null;
  const adamUpperArmRBone = clonedScene.getObjectByName('mixamorigRightArm') ?? null;
  const adamLowerArmLBone = clonedScene.getObjectByName('mixamorigLeftForeArm') ?? null;
  const adamHandLBone = clonedScene.getObjectByName('mixamorigLeftHand') ?? null;
  const adamLowerArmRBone = clonedScene.getObjectByName('mixamorigRightForeArm') ?? null;
  const adamUpperBones: Array<{ name: string; bone: THREE.Object3D }> = [];
  for (let b = 0; b < UPPER_AIM_BONE_NAMES.length; b++) {
    const name = UPPER_AIM_BONE_NAMES[b];
    const bone = clonedScene.getObjectByName(name);
    if (bone) adamUpperBones.push({ name, bone });
  }

  // Metric-scale world-aligned mounts compensating for inner FF_SCENE_SCALE (1.78) & Mixamo bone roll
  const invScale = 1 / FF_SCENE_SCALE;
  const spineMount = new THREE.Group();
  spineMount.quaternion.copy(pack.spineMountQuat);
  spineMount.scale.setScalar(invScale);
  if (adamSpine2Bone) {
    adamSpine2Bone.add(spineMount);
  }

  const vestGroup = createVestGeometryGroup(vestMat);
  vestGroup.position.set(0, -0.02, 0.015);
  const backpackGroup = createBackpackGeometryGroup(packMat, darkMat);
  backpackGroup.position.set(0, -0.01, -0.105);
  spineMount.add(vestGroup, backpackGroup);

  const backMount1 = new THREE.Group();
  backMount1.position.set(-0.095, 0.05, -0.105);
  backMount1.rotation.set(-Math.PI * 0.44, 0.06, -0.18);
  const backMount2 = new THREE.Group();
  backMount2.position.set(0.095, 0.05, -0.105);
  backMount2.rotation.set(-Math.PI * 0.44, -0.06, 0.18);
  const pistolBackMount = new THREE.Group();
  pistolBackMount.position.set(0.095, -0.125, -0.105);
  pistolBackMount.rotation.set(Math.PI * 0.44, 0.1, -0.14);
  spineMount.add(backMount1, backMount2, pistolBackMount);

  const backMeshes1: Record<WeaponId, THREE.Group> = {
    g18: createWeaponModel('g18'),
    deagle: createWeaponModel('deagle'),
    m4a1: createWeaponModel('m4a1'),
    xm8: createWeaponModel('xm8'),
    scar: createWeaponModel('scar'),
    ak47: createWeaponModel('ak47'),
    ump45: createWeaponModel('ump45'),
    m1014: createWeaponModel('m1014'),
    awm: createWeaponModel('awm'),
  };
  const backMeshes2: Record<WeaponId, THREE.Group> = {
    g18: createWeaponModel('g18'),
    deagle: createWeaponModel('deagle'),
    m4a1: createWeaponModel('m4a1'),
    xm8: createWeaponModel('xm8'),
    scar: createWeaponModel('scar'),
    ak47: createWeaponModel('ak47'),
    ump45: createWeaponModel('ump45'),
    m1014: createWeaponModel('m1014'),
    awm: createWeaponModel('awm'),
  };
  const backPistolMeshes: Record<'g18' | 'deagle', THREE.Group> = {
    g18: createWeaponModel('g18'),
    deagle: createWeaponModel('deagle'),
  };
  backPistolMeshes.g18.visible = false;
  backPistolMeshes.deagle.visible = false;
  pistolBackMount.add(backPistolMeshes.g18, backPistolMeshes.deagle);
  (Object.keys(backMeshes1) as WeaponId[]).forEach((id) => {
    backMeshes1[id].visible = false;
    backMeshes2[id].visible = false;
    backMount1.add(backMeshes1[id]);
    backMount2.add(backMeshes2[id]);
  });

  // Attach tactical helmet cleanly onto calibrated head mount (preserve FF native hair otherwise)
  const headMount = new THREE.Group();
  headMount.quaternion.copy(pack.headMountQuat);
  headMount.scale.setScalar(invScale);
  if (adamHeadBone) {
    adamHeadBone.add(headMount);
  }
  const headgear = createHeadgearSet(hairMat, darkMat, true);
  headgear.helmetGroup.position.set(0, pack.helmetOffsetY - 0.115, 0);
  headMount.add(headgear.helmetGroup);

  // Calibrated weapon mount on mixamorigRightHand (+Z = barrel forward, +Y = sights up)
  const weaponMount = new THREE.Group();
  weaponMount.quaternion.copy(pack.weaponMountQuat);
  weaponMount.scale.setScalar(invScale);
  if (adamHandRBone) {
    adamHandRBone.add(weaponMount);
  }

  // White bandage healing meshes (roll in right hand, gauze wrap on left forearm)
  const bandage = createBandageMeshes();
  const bandageHandMount = new THREE.Group();
  bandageHandMount.quaternion.copy(pack.weaponMountQuat);
  bandageHandMount.scale.setScalar(invScale);
  bandageHandMount.position.set(0, 0.04, 0.02);
  if (adamHandRBone) {
    adamHandRBone.add(bandageHandMount);
  }
  bandageHandMount.add(bandage.rollGroup);

  const bandageArmMount = new THREE.Group();
  bandageArmMount.scale.setScalar(invScale);
  if (adamLowerArmLBone) {
    if (adamHandLBone && adamHandLBone.position.lengthSq() > 1e-4) {
      bandageArmMount.position.copy(adamHandLBone.position).multiplyScalar(0.52);
      const armDir = adamHandLBone.position.clone().normalize();
      bandageArmMount.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDir);
    } else {
      bandageArmMount.position.set(0, 0.12, 0);
    }
    adamLowerArmLBone.add(bandageArmMount);
  }
  bandageArmMount.add(bandage.wrapGroup);

  const weaponMeshes: Record<WeaponId, THREE.Group> = {
    g18: createWeaponModel('g18'),
    deagle: createWeaponModel('deagle'),
    m4a1: createWeaponModel('m4a1'),
    xm8: createWeaponModel('xm8'),
    scar: createWeaponModel('scar'),
    ak47: createWeaponModel('ak47'),
    ump45: createWeaponModel('ump45'),
    m1014: createWeaponModel('m1014'),
    awm: createWeaponModel('awm'),
  };
  Object.values(weaponMeshes).forEach((wm) => {
    wm.position.set(0.004, 0.016, 0.062);
    wm.visible = false;
    weaponMount.add(wm);
  });
  weaponMeshes.m4a1.visible = true;

  // Muzzle flash sits in weaponMount space right at the gun muzzle (+Z)
  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.085, 0.24, 6),
    new THREE.MeshBasicMaterial({
      color: 0xffc845,
      transparent: true,
      opacity: 0.92,
    }),
  );
  muzzleFlash.position.set(0, 0.036, 0.42);
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.visible = false;
  weaponMount.add(muzzleFlash);

  // Parachute canopy above character
  const parachuteGroup = createParachuteCanopyGroup(camoTexture);
  parachuteGroup.position.set(0, 1.85, 0);
  adamVisualRoot.add(parachuteGroup);

  // Tactical water surfboard attached at base of character root
  const surfboard = createSurfboardGroup();
  surfboard.group.position.set(0, 0.02, 0);
  root.add(surfboard.group);

  // Wire AnimationMixer + retargeted clips
  const mixer = new THREE.AnimationMixer(clonedScene);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (let i = 0; i < pack.animations.length; i++) {
    const clip = pack.animations[i];
    const act = mixer.clipAction(clip);
    if (clip.name === 'Death01') {
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
    } else if (
      clip.name === 'Punch_Jab' ||
      clip.name === 'Punch_Cross' ||
      clip.name === 'Punch_Jab_Upper' ||
      clip.name === 'Punch_Cross_Upper'
    ) {
      act.setLoop(THREE.LoopOnce, 1);
    } else {
      act.setLoop(THREE.LoopRepeat, Infinity);
    }
    actions[clip.name] = act;
  }

  const startIdle = actions.Idle_Loop ?? Object.values(actions)[0];
  let activeClipName: string | undefined;
  if (startIdle) {
    startIdle.play();
    mixer.update(0);
    activeClipName = startIdle.getClip().name;
  }

  const applyConfig = (cfg: CharacterConfig) => {
    vestMat.color.set(cfg.vestColor);
    hairMat.color.set(cfg.hairColor);
    vestGroup.visible = false;
    backpackGroup.visible = cfg.backpackEnabled;
    headgear.helmetGroup.visible = false;
  };

  applyConfig(initialConfig);

  let rigObj: CharacterRig | null = null;

  const setWeapon = (weaponId: WeaponId | null) => {
    if (rigObj) rigObj.activeWeaponId = weaponId;
    (Object.keys(weaponMeshes) as WeaponId[]).forEach((id) => {
      weaponMeshes[id].visible = weaponId === id;
    });
  };

  const setBackWeapons = (left: WeaponId | null, right: WeaponId | null) => {
    (Object.keys(backMeshes1) as WeaponId[]).forEach((id) => {
      backMeshes1[id].visible = right === id;
      backMeshes2[id].visible = left === id;
    });
  };

  const setPistolBackWeapon = (weaponId: WeaponId | null) => {
    backPistolMeshes.g18.visible = weaponId === 'g18';
    backPistolMeshes.deagle.visible = weaponId === 'deagle';
  };

  const setParachuteVisible = (visible: boolean) => {
    parachuteGroup.visible = visible;
  };

  const setSurfboardVisible = (visible: boolean) => {
    surfboard.group.visible = visible;
  };

  const setBandageVisible = (visible: boolean) => {
    bandage.rollGroup.visible = visible;
    bandage.wrapGroup.visible = visible;
  };

  const setHitFlash = (_amount: number) => {
    for (let m = 0; m < bodyMats.length; m++) {
      bodyMats[m].emissive.setRGB(0, 0, 0);
    }
    vestMat.emissive.setRGB(0, 0, 0);
  };

  const dispose = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(clonedScene);
    surfboard.dispose();
    bandage.dispose();
    vestMat.dispose();
    packMat.dispose();
    hairMat.dispose();
    darkMat.dispose();
    headgear.helmetMat.dispose();
    for (let m = 0; m < bodyMats.length; m++) {
      bodyMats[m].dispose();
    }
    contactShadow.geometry.dispose();
    (contactShadow.material as THREE.Material).dispose();
    muzzleFlash.geometry.dispose();
    (muzzleFlash.material as THREE.Material).dispose();
    vestGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
    });
    backpackGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
    });
    headgear.helmetGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
    });
    parachuteGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || (o as THREE.LineSegments).isLineSegments) {
        (o as THREE.Mesh).geometry.dispose();
        const mat = (o as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((mt) => mt.dispose());
        else mat?.dispose();
      }
    });
  };

  rigObj = {
    isAdam: true,
    modelId,
    root,
    adamVisualRoot,
    mixer,
    actions,
    activeClipName,
    adamPelvisBone,
    adamSpineBaseBone,
    adamSpineBone,
    adamSpine2Bone,
    adamHeadBone,
    adamLeftShoulderBone,
    adamRightShoulderBone,
    adamHandLBone,
    adamHandRBone,
    adamThighLBone,
    adamThighRBone,
    adamShinLBone,
    adamShinRBone,
    adamUpperArmLBone,
    adamUpperArmRBone,
    adamLowerArmLBone,
    adamLowerArmRBone,
    adamUpperBones,
    pelvis,
    torso,
    headGroup,
    leftShoulder,
    leftElbow,
    rightShoulder,
    rightElbow,
    leftHip,
    leftKnee,
    rightHip,
    rightKnee,
    weaponMount,
    backMount1,
    backMount2,
    muzzleFlash,
    parachuteGroup,
    surfboardGroup: surfboard.group,
    contactShadow,
    weaponMeshes,
    activeWeaponId: 'm4a1',
    bodyMeshes,
    setWeapon,
    setBackWeapons,
    setPistolBackWeapon,
    setParachuteVisible,
    setSurfboardVisible,
    setBandageVisible,
    setHitFlash,
    applyConfig,
    dispose,
  };
  return rigObj;
}

export function createCharacterRig(
  initialConfig: CharacterConfig,
  camoTexture: THREE.Texture,
  contactShadowTexture: THREE.Texture,
): CharacterRig {
  if (isAdamAssetsLoaded()) {
    return createAdamCharacterRig(initialConfig, camoTexture, contactShadowTexture);
  }
  return createProceduralCharacterRig(initialConfig, camoTexture, contactShadowTexture);
}

function createProceduralCharacterRig(
  initialConfig: CharacterConfig,
  camoTexture: THREE.Texture,
  contactShadowTexture: THREE.Texture,
): CharacterRig {
  const root = new THREE.Group();
  const bodyMeshes: THREE.Mesh[] = [];

  const skinMat = new THREE.MeshStandardMaterial({
    color: initialConfig.skinColor,
    roughness: 0.72,
    metalness: 0.02,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: initialConfig.shirtColor,
    roughness: 0.85,
    metalness: 0.0,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: initialConfig.pantsColor,
    roughness: 0.88,
    metalness: 0.0,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: initialConfig.vestColor,
    roughness: 0.65,
    metalness: 0.12,
  });
  const packMat = new THREE.MeshStandardMaterial({
    color: 0x485038,
    roughness: 0.78,
    metalness: 0.06,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: initialConfig.hairColor,
    roughness: 0.82,
    metalness: 0.05,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: initialConfig.shoesColor,
    roughness: 0.58,
    metalness: 0.08,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1b1c1f,
    roughness: 0.7,
    metalness: 0.15,
  });

  const regMesh = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    bodyMeshes.push(m);
    return m;
  };

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.018;
  root.add(contactShadow);

  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  root.add(pelvis);

  const pelvisMesh = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.175, 0.16, 12), pantsMat),
  );
  pelvisMesh.scale.set(1.08, 1, 0.72);
  pelvis.add(pelvisMesh);

  const belt = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.173, 0.175, 0.045, 12), darkMat),
  );
  belt.scale.set(1.09, 1, 0.74);
  belt.position.y = 0.055;
  pelvis.add(belt);

  const torso = new THREE.Group();
  torso.position.set(0, 0.08, 0);
  pelvis.add(torso);

  const chestMesh = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.155, 0.45, 12), shirtMat),
  );
  chestMesh.scale.set(1.05, 1, 0.68);
  chestMesh.position.y = 0.225;
  torso.add(chestMesh);

  const chestTopCap = regMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 8), shirtMat),
  );
  chestTopCap.scale.set(1.05, 0.38, 0.68);
  chestTopCap.position.y = 0.43;
  torso.add(chestTopCap);

  const hoodieCollar = regMesh(
    new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 8, 14), shirtMat),
  );
  hoodieCollar.rotation.x = Math.PI / 2;
  hoodieCollar.position.set(0, 0.45, -0.02);
  torso.add(hoodieCollar);

  const vestGroup = new THREE.Group();
  const vestPlate = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.208, 0.172, 0.34, 12), vestMat),
  );
  vestPlate.scale.set(1.06, 1, 0.74);
  vestPlate.position.y = 0.22;
  vestGroup.add(vestPlate);
  torso.add(vestGroup);

  const backpackGroup = createBackpackGeometryGroup(packMat, darkMat);
  backpackGroup.position.set(0, 0.24, -0.13);
  torso.add(backpackGroup);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.47, 0);
  torso.add(headGroup);

  const neck = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.068, 0.09, 10), skinMat),
  );
  neck.position.y = 0.03;
  headGroup.add(neck);

  const head = regMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.132, 14, 12), skinMat),
  );
  head.scale.set(0.92, 1.08, 0.98);
  head.position.y = 0.19;
  headGroup.add(head);

  const headgear = createHeadgearSet(hairMat, darkMat, false);
  headGroup.add(headgear.hairBuzz, headgear.hairSpiky, headgear.capGroup, headgear.helmetGroup);

  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.23, 0.4, 0);
    torso.add(shoulder);

    const shoulderCap = regMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), shirtMat),
    );
    shoulder.add(shoulderCap);

    const sleeve = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.054, 0.11, 10), shirtMat),
    );
    sleeve.position.y = -0.05;
    shoulder.add(sleeve);

    const upperArm = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.044, 0.24, 10), skinMat),
    );
    upperArm.position.y = -0.13;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.25, 0);
    shoulder.add(elbow);

    const forearm = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.036, 0.24, 10), skinMat),
    );
    forearm.position.y = -0.12;
    elbow.add(forearm);

    const hand = regMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), skinMat),
    );
    hand.scale.set(0.9, 1.15, 0.9);
    hand.position.y = -0.25;
    elbow.add(hand);

    return { shoulder, elbow, sleeve, upperArm, forearm };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  const bandage = createBandageMeshes();
  bandage.rollGroup.position.set(0, -0.25, 0.03);
  rightArm.elbow.add(bandage.rollGroup);
  bandage.wrapGroup.position.set(0, -0.12, 0);
  leftArm.elbow.add(bandage.wrapGroup);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.25, 0.04);
  rightArm.elbow.add(weaponMount);

  const weaponMeshes: Record<WeaponId, THREE.Group> = {
    g18: createWeaponModel('g18'),
    deagle: createWeaponModel('deagle'),
    m4a1: createWeaponModel('m4a1'),
    xm8: createWeaponModel('xm8'),
    scar: createWeaponModel('scar'),
    ak47: createWeaponModel('ak47'),
    ump45: createWeaponModel('ump45'),
    m1014: createWeaponModel('m1014'),
    awm: createWeaponModel('awm'),
  };
  Object.values(weaponMeshes).forEach((wm) => {
    wm.rotation.x = Math.PI / 2;
    wm.visible = false;
    weaponMount.add(wm);
  });
  weaponMeshes.m4a1.visible = true;

  const backMount1 = new THREE.Group();
  backMount1.position.set(0.115, 0.30, -0.145);
  backMount1.rotation.set(-Math.PI * 0.44, 0.06, -0.18);
  torso.add(backMount1);

  const backMount2 = new THREE.Group();
  backMount2.position.set(-0.115, 0.30, -0.145);
  backMount2.rotation.set(-Math.PI * 0.44, -0.06, 0.18);
  torso.add(backMount2);

  const backMeshes1: Record<WeaponId, THREE.Group> = {
    g18: createWeaponModel('g18'),
    deagle: createWeaponModel('deagle'),
    m4a1: createWeaponModel('m4a1'),
    xm8: createWeaponModel('xm8'),
    scar: createWeaponModel('scar'),
    ak47: createWeaponModel('ak47'),
    ump45: createWeaponModel('ump45'),
    m1014: createWeaponModel('m1014'),
    awm: createWeaponModel('awm'),
  };
  const backMeshes2: Record<WeaponId, THREE.Group> = {
    g18: createWeaponModel('g18'),
    deagle: createWeaponModel('deagle'),
    m4a1: createWeaponModel('m4a1'),
    xm8: createWeaponModel('xm8'),
    scar: createWeaponModel('scar'),
    ak47: createWeaponModel('ak47'),
    ump45: createWeaponModel('ump45'),
    m1014: createWeaponModel('m1014'),
    awm: createWeaponModel('awm'),
  };
  (Object.keys(backMeshes1) as WeaponId[]).forEach((id) => {
    backMeshes1[id].visible = false;
    backMeshes2[id].visible = false;
    backMount1.add(backMeshes1[id]);
    backMount2.add(backMeshes2[id]);
  });

  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.085, 0.24, 6),
    new THREE.MeshBasicMaterial({
      color: 0xffc845,
      transparent: true,
      opacity: 0.92,
    }),
  );
  muzzleFlash.position.set(0, -0.25, 0.6);
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.visible = false;
  rightArm.elbow.add(muzzleFlash);

  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.095, -0.05, 0);
    pelvis.add(hip);

    const thigh = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.062, 0.42, 10), pantsMat),
    );
    thigh.position.y = -0.21;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.42, 0);
    hip.add(knee);

    const shin = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.044, 0.37, 10), skinMat),
    );
    shin.position.y = -0.185;
    knee.add(shin);

    const shoe = regMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), shoeMat),
    );
    shoe.scale.set(0.95, 0.68, 1.65);
    shoe.position.set(0, -0.4, 0.042);
    knee.add(shoe);

    return { hip, knee, shin };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  const parachuteGroup = createParachuteCanopyGroup(camoTexture);
  parachuteGroup.position.set(0, 1.45, 0);
  torso.add(parachuteGroup);

  const surfboard = createSurfboardGroup();
  surfboard.group.position.set(0, 0.02, 0);
  root.add(surfboard.group);

  const applyConfig = (cfg: CharacterConfig) => {
    skinMat.color.set(cfg.skinColor);
    shirtMat.color.set(cfg.shirtColor);
    pantsMat.color.set(cfg.pantsColor);
    vestMat.color.set(cfg.vestColor);
    hairMat.color.set(cfg.hairColor);
    shoeMat.color.set(cfg.shoesColor);

    vestGroup.visible = false;
    backpackGroup.visible = cfg.backpackEnabled;

    const hasSleeves = cfg.shirtStyle === 'tee' || cfg.shirtStyle === 'hoodie';
    leftArm.sleeve.visible = hasSleeves;
    rightArm.sleeve.visible = hasSleeves;
    hoodieCollar.visible = cfg.shirtStyle === 'hoodie';

    leftArm.upperArm.material = cfg.shirtStyle === 'hoodie' ? shirtMat : skinMat;
    rightArm.upperArm.material = cfg.shirtStyle === 'hoodie' ? shirtMat : skinMat;
    leftArm.forearm.material = cfg.shirtStyle === 'hoodie' ? shirtMat : skinMat;
    rightArm.forearm.material = cfg.shirtStyle === 'hoodie' ? shirtMat : skinMat;
    leftLeg.shin.material = cfg.shirtStyle === 'hoodie' ? pantsMat : skinMat;
    rightLeg.shin.material = cfg.shirtStyle === 'hoodie' ? pantsMat : skinMat;

    headgear.hairBuzz.visible = cfg.hairStyle === 'buzz';
    headgear.hairSpiky.visible = cfg.hairStyle === 'spiky';
    headgear.capGroup.visible = cfg.hairStyle === 'cap';
    headgear.helmetGroup.visible = false;
  };

  applyConfig(initialConfig);

  let procRigObj: CharacterRig | null = null;

  const setWeapon = (weaponId: WeaponId | null) => {
    if (procRigObj) procRigObj.activeWeaponId = weaponId;
    (Object.keys(weaponMeshes) as WeaponId[]).forEach((id) => {
      weaponMeshes[id].visible = weaponId === id;
    });
  };

  const setBackWeapons = (left: WeaponId | null, right: WeaponId | null) => {
    (Object.keys(backMeshes1) as WeaponId[]).forEach((id) => {
      backMeshes1[id].visible = right === id;
      backMeshes2[id].visible = left === id;
    });
  };

  const setParachuteVisible = (visible: boolean) => {
    parachuteGroup.visible = visible;
  };

  const setSurfboardVisible = (visible: boolean) => {
    surfboard.group.visible = visible;
  };

  const setBandageVisible = (visible: boolean) => {
    bandage.rollGroup.visible = visible;
    bandage.wrapGroup.visible = visible;
  };

  const setHitFlash = (_amount: number) => {
    shirtMat.emissive.setRGB(0, 0, 0);
    skinMat.emissive.setRGB(0, 0, 0);
    vestMat.emissive.setRGB(0, 0, 0);
  };

  const dispose = () => {
    surfboard.dispose();
    bandage.dispose();
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && !obj.userData?.sharedWeaponAsset) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
    skinMat.dispose();
    shirtMat.dispose();
    pantsMat.dispose();
    vestMat.dispose();
    packMat.dispose();
    hairMat.dispose();
    shoeMat.dispose();
    darkMat.dispose();
    headgear.helmetMat.dispose();
  };

  procRigObj = {
    isAdam: false,
    root,
    pelvis,
    torso,
    headGroup,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    weaponMount,
    backMount1,
    backMount2,
    muzzleFlash,
    parachuteGroup,
    surfboardGroup: surfboard.group,
    contactShadow,
    weaponMeshes,
    activeWeaponId: 'm4a1',
    bodyMeshes,
    setWeapon,
    setBackWeapons,
    setParachuteVisible,
    setSurfboardVisible,
    setBandageVisible,
    setHitFlash,
    applyConfig,
    dispose,
  };
  return procRigObj;
}
