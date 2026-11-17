import * as THREE from 'three';
import { CharacterConfig, WeaponId } from './types';

export interface CharacterRig {
  root: THREE.Group;
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
  contactShadow: THREE.Mesh;
  weaponMeshes: Record<WeaponId, THREE.Group>;
  bodyMeshes: THREE.Mesh[];
  setWeapon: (weaponId: WeaponId | null) => void;
  setBackWeapons: (left: WeaponId | null, right: WeaponId | null) => void;
  setParachuteVisible: (visible: boolean) => void;
  setHitFlash: (amount: number) => void;
  applyConfig: (config: CharacterConfig) => void;
  dispose: () => void;
}

const WEAPON_GUN_METAL_MAT = new THREE.MeshStandardMaterial({
  color: 0x26292e,
  roughness: 0.35,
  metalness: 0.85,
});
const WEAPON_POLYMER_MAT = new THREE.MeshStandardMaterial({
  color: 0x191a1d,
  roughness: 0.78,
  metalness: 0.1,
});
const WEAPON_WOOD_MAT = new THREE.MeshStandardMaterial({
  color: 0x5c3c24,
  roughness: 0.72,
  metalness: 0.05,
});
const WEAPON_SNIPER_GREEN_MAT = new THREE.MeshStandardMaterial({
  color: 0x3b4d32,
  roughness: 0.72,
  metalness: 0.12,
});
const WEAPON_LENS_MAT = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  roughness: 0.15,
  metalness: 0.9,
});

export function createWeaponModel(weaponId: WeaponId): THREE.Group {
  const group = new THREE.Group();
  const gunMetal = WEAPON_GUN_METAL_MAT;
  const polymer = WEAPON_POLYMER_MAT;
  const woodAccent = WEAPON_WOOD_MAT;

  if (weaponId === 'g18') {
    const slide = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.045, 0.21),
      gunMetal,
    );
    slide.position.set(0, 0.03, 0.06);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.03, 0.18),
      polymer,
    );
    frame.position.set(0, 0.0, 0.05);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.12, 0.048),
      polymer,
    );
    grip.position.set(0, -0.06, -0.02);
    grip.rotation.x = 0.18;
    group.add(slide, frame, grip);
  } else if (weaponId === 'm4a1') {
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.09, 0.32),
      gunMetal,
    );
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.32, 6),
      gunMetal,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, 0.28);

    const handguard = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.055, 0.22),
      polymer,
    );
    handguard.position.set(0, 0.01, 0.22);

    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.1, 0.2),
      polymer,
    );
    stock.position.set(0, -0.01, -0.22);

    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.14, 0.06),
      gunMetal,
    );
    mag.position.set(0, -0.09, 0.07);
    mag.rotation.x = 0.18;

    const sight = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.045, 0.12),
      polymer,
    );
    sight.position.set(0, 0.065, 0.01);

    group.add(receiver, barrel, handguard, stock, mag, sight);
  } else if (weaponId === 'ump45') {
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.085, 0.28),
      polymer,
    );
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.16, 6),
      gunMetal,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, 0.2);

    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.075, 0.18),
      polymer,
    );
    stock.position.set(0, 0.0, -0.2);

    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.16, 0.045),
      gunMetal,
    );
    mag.position.set(0, -0.1, 0.05);
    mag.rotation.x = 0.08;

    group.add(receiver, barrel, stock, mag);
  } else if (weaponId === 'm1014') {
    // m1014 tactical shotgun
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.058, 0.08, 0.34),
      gunMetal,
    );
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.42, 6),
      gunMetal,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.32);

    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.35, 6),
      polymer,
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.01, 0.28);

    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.095, 0.22),
      woodAccent,
    );
    stock.position.set(0, -0.02, -0.23);

    group.add(receiver, barrel, tube, stock);
  } else {
    // AWM-17 Bolt-Action Sniper Rifle with 8x Scope
    const sniperGreen = WEAPON_SNIPER_GREEN_MAT;
    const lensMat = WEAPON_LENS_MAT;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.058, 0.088, 0.46),
      sniperGreen,
    );
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.1, 0.24),
      sniperGreen,
    );
    stock.position.set(0, -0.015, -0.28);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.015, 0.56, 8),
      gunMetal,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.022, 0.44);
    const muzzleBrake = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.036, 0.07),
      gunMetal,
    );
    muzzleBrake.position.set(0, 0.022, 0.73);
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.034, 0.11, 0.07),
      gunMetal,
    );
    mag.position.set(0, -0.085, 0.05);
    const scopeTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.02, 0.26, 8),
      gunMetal,
    );
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.085, 0.04);
    const scopeFront = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.024, 0.05, 8),
      lensMat,
    );
    scopeFront.rotation.x = Math.PI / 2;
    scopeFront.position.set(0, 0.085, 0.18);
    group.add(body, stock, barrel, muzzleBrake, mag, scopeTube, scopeFront);
  }

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
    }
  });
  return group;
}

export function createCharacterRig(
  initialConfig: CharacterConfig,
  camoTexture: THREE.Texture,
  contactShadowTexture: THREE.Texture,
): CharacterRig {
  const root = new THREE.Group();
  const bodyMeshes: THREE.Mesh[] = [];

  // Shared editable materials
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

  // Contact shadow disc grounded at y=0.015
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

  // Pelvis pivot at ~0.92m above ground (smooth rounded hips)
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  root.add(pelvis);

  const pelvisMesh = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.175, 0.16, 12), pantsMat),
  );
  pelvisMesh.scale.set(1.08, 1, 0.72);
  pelvis.add(pelvisMesh);

  // Rounded Belt accent
  const belt = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.173, 0.175, 0.045, 12), darkMat),
  );
  belt.scale.set(1.09, 1, 0.74);
  belt.position.y = 0.055;
  pelvis.add(belt);

  // Torso group (smooth contoured chest + shoulders)
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

  // Rounded hoodie collar toggleable part
  const hoodieCollar = regMesh(
    new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 8, 14), shirtMat),
  );
  hoodieCollar.rotation.x = Math.PI / 2;
  hoodieCollar.position.set(0, 0.45, -0.02);
  torso.add(hoodieCollar);

  // Tactical Vest (rounded plate carrier, toggleable)
  const vestGroup = new THREE.Group();
  const vestPlate = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.208, 0.172, 0.34, 12), vestMat),
  );
  vestPlate.scale.set(1.06, 1, 0.74);
  vestPlate.position.y = 0.22;
  const pouchL = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.1, 8), vestMat),
  );
  pouchL.scale.set(1.1, 1, 0.65);
  pouchL.position.set(-0.1, 0.14, 0.135);
  const pouchR = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.1, 8), vestMat),
  );
  pouchR.scale.set(1.1, 1, 0.65);
  pouchR.position.set(0.1, 0.14, 0.135);
  vestGroup.add(vestPlate, pouchL, pouchR);
  torso.add(vestGroup);

  // Rounded Tactical Backpack (toggleable)
  const backpackGroup = new THREE.Group();
  const packMain = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.145, 0.34, 10), packMat),
  );
  packMain.scale.set(1.1, 1, 0.62);
  packMain.position.set(0, 0.24, -0.175);
  const packTop = regMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.138, 10, 8), packMat),
  );
  packTop.scale.set(1.1, 0.52, 0.62);
  packTop.position.set(0, 0.4, -0.175);
  const packPocket = regMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), darkMat),
  );
  packPocket.scale.set(1.1, 0.9, 0.45);
  packPocket.position.set(0, 0.18, -0.245);
  backpackGroup.add(packMain, packTop, packPocket);
  torso.add(backpackGroup);

  // Smooth Rounded Head + Neck
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

  // Subtle face eyes
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x161618,
    roughness: 0.4,
  });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), eyeMat);
  eyeL.scale.set(1.3, 0.75, 0.6);
  eyeL.position.set(-0.044, 0.205, 0.118);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), eyeMat);
  eyeR.scale.set(1.3, 0.75, 0.6);
  eyeR.position.set(0.044, 0.205, 0.118);
  headGroup.add(eyeL, eyeR);

  // Rounded Headgear variations
  const hairBuzz = regMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.136, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat),
  );
  hairBuzz.scale.set(0.94, 1.06, 1.0);
  hairBuzz.position.set(0, 0.195, -0.005);

  const hairSpiky = new THREE.Group();
  const spikeBase = regMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat),
  );
  spikeBase.scale.set(0.96, 1.12, 1.02);
  spikeBase.position.set(0, 0.2, -0.006);
  const spikeFront = regMesh(
    new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.11, 8), hairMat),
  );
  spikeFront.position.set(0, 0.32, 0.075);
  spikeFront.rotation.x = 0.55;
  hairSpiky.add(spikeBase, spikeFront);

  const capGroup = new THREE.Group();
  const capCrown = regMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.142, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat),
  );
  capCrown.scale.set(0.96, 1.04, 1.02);
  capCrown.position.set(0, 0.205, -0.005);
  const capVisor = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.022, 12, 1, false, -Math.PI * 0.42, Math.PI * 0.84), hairMat),
  );
  capVisor.scale.set(1.0, 1.0, 1.28);
  capVisor.position.set(0, 0.225, 0.065);
  capGroup.add(capCrown, capVisor);

  const helmetGroup = new THREE.Group();
  const helmetShell = regMesh(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      new THREE.MeshStandardMaterial({
        color: 0x353c30,
        roughness: 0.42,
        metalness: 0.35,
      }),
    ),
  );
  helmetShell.scale.set(0.98, 1.02, 1.05);
  helmetShell.position.set(0, 0.205, -0.008);
  const helmetRim = regMesh(
    new THREE.Mesh(
      new THREE.TorusGeometry(0.148, 0.018, 8, 16),
      darkMat,
    ),
  );
  helmetRim.rotation.x = Math.PI / 2;
  helmetRim.scale.set(0.98, 1.05, 1.0);
  helmetRim.position.set(0, 0.185, -0.008);
  helmetGroup.add(helmetShell, helmetRim);

  headGroup.add(hairBuzz, hairSpiky, capGroup, helmetGroup);

  // Smooth Rounded Arms helper
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

    const elbowJoint = regMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.044, 8, 6), skinMat),
    );
    elbow.add(elbowJoint);

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

  // Weapon mount attached to right hand
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.25, 0.04);
  rightArm.elbow.add(weaponMount);

  const weaponMeshes: Record<WeaponId, THREE.Group> = {
    g18: createWeaponModel('g18'),
    m4a1: createWeaponModel('m4a1'),
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

  // Holstered Back Weapon Mounts (Right & Left shoulder slings behind/beside backpack)
  const backMount1 = new THREE.Group();
  backMount1.position.set(0.175, 0.31, -0.215);
  backMount1.rotation.set(-Math.PI * 0.44, 0.12, -0.22);
  torso.add(backMount1);

  const backMount2 = new THREE.Group();
  backMount2.position.set(-0.175, 0.31, -0.215);
  backMount2.rotation.set(-Math.PI * 0.44, -0.12, 0.22);
  torso.add(backMount2);

  const backMeshes1: Record<WeaponId, THREE.Group> = {
    g18: createWeaponModel('g18'),
    m4a1: createWeaponModel('m4a1'),
    ump45: createWeaponModel('ump45'),
    m1014: createWeaponModel('m1014'),
    awm: createWeaponModel('awm'),
  };
  const backMeshes2: Record<WeaponId, THREE.Group> = {
    g18: createWeaponModel('g18'),
    m4a1: createWeaponModel('m4a1'),
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

  // Muzzle flash sprite-like cone
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

  // Smooth Rounded Legs helper
  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.095, -0.05, 0);
    pelvis.add(hip);

    const hipJoint = regMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), pantsMat),
    );
    hip.add(hipJoint);

    const thigh = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.062, 0.42, 10), pantsMat),
    );
    thigh.position.y = -0.21;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.42, 0);
    hip.add(knee);

    const kneeCap = regMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), pantsMat),
    );
    knee.add(kneeCap);

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

  // Parachute canopy + suspension lines (hidden unless PARACHUTE state)
  const parachuteGroup = new THREE.Group();
  parachuteGroup.position.set(0, 1.45, 0);
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
  torso.add(parachuteGroup);

  const applyConfig = (cfg: CharacterConfig) => {
    skinMat.color.set(cfg.skinColor);
    shirtMat.color.set(cfg.shirtColor);
    pantsMat.color.set(cfg.pantsColor);
    vestMat.color.set(cfg.vestColor);
    hairMat.color.set(cfg.hairColor);
    shoeMat.color.set(cfg.shoesColor);

    vestGroup.visible = cfg.vestEnabled;
    backpackGroup.visible = cfg.backpackEnabled;

    const hasSleeves = cfg.shirtStyle === 'tee' || cfg.shirtStyle === 'hoodie';
    leftArm.sleeve.visible = hasSleeves;
    rightArm.sleeve.visible = hasSleeves;
    hoodieCollar.visible = cfg.shirtStyle === 'hoodie';

    // Long sleeves/pants for hoodie style
    leftArm.upperArm.material = cfg.shirtStyle === 'hoodie' ? shirtMat : skinMat;
    rightArm.upperArm.material = cfg.shirtStyle === 'hoodie' ? shirtMat : skinMat;
    leftArm.forearm.material = cfg.shirtStyle === 'hoodie' ? shirtMat : skinMat;
    rightArm.forearm.material = cfg.shirtStyle === 'hoodie' ? shirtMat : skinMat;
    leftLeg.shin.material = cfg.shirtStyle === 'hoodie' ? pantsMat : skinMat;
    rightLeg.shin.material = cfg.shirtStyle === 'hoodie' ? pantsMat : skinMat;

    hairBuzz.visible = cfg.hairStyle === 'buzz';
    hairSpiky.visible = cfg.hairStyle === 'spiky';
    capGroup.visible = cfg.hairStyle === 'cap';
    helmetGroup.visible = cfg.hairStyle === 'helmet';
  };

  applyConfig(initialConfig);

  const setWeapon = (weaponId: WeaponId | null) => {
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

  const setHitFlash = (amount: number) => {
    const r = Math.max(0, Math.min(1, amount));
    shirtMat.emissive.setRGB(r * 0.85, 0, 0);
    skinMat.emissive.setRGB(r * 0.85, 0, 0);
    vestMat.emissive.setRGB(r * 0.75, 0, 0);
  };

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
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
    canopyMat.dispose();
    lineMat.dispose();
  };

  return {
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
    contactShadow,
    weaponMeshes,
    bodyMeshes,
    setWeapon,
    setBackWeapons,
    setParachuteVisible,
    setHitFlash,
    applyConfig,
    dispose,
  };
}
