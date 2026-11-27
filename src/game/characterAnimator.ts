import * as THREE from 'three';
import { FFModelId, getAimPoseQuats, getModelAssetPack } from './adamAssets';
import { CharacterRig } from './characterBuilder';
import { PlayerStance } from './types';

const _vAxis = new THREE.Vector3();
const _qDeltaW = new THREE.Quaternion();
const _qVisW = new THREE.Quaternion();
const _qInvVisW = new THREE.Quaternion();
const _qParentW = new THREE.Quaternion();
const _qInvParentW = new THREE.Quaternion();
const _qLocalDelta = new THREE.Quaternion();
const _pBaseW = new THREE.Vector3();
const _pTopW = new THREE.Vector3();
const _dChar = new THREE.Vector3();
const _qHeadW = new THREE.Quaternion();
const _headFwdChar = new THREE.Vector3();
const _qMountW = new THREE.Quaternion();
const _barrelChar = new THREE.Vector3();

const _ikA = new THREE.Vector3();
const _ikB = new THREE.Vector3();
const _ikC = new THREE.Vector3();
const _ikAT = new THREE.Vector3();
const _ikDir = new THREE.Vector3();
const _ikPole = new THREE.Vector3();
const _ikElbowTarget = new THREE.Vector3();
const _ikCurUpper = new THREE.Vector3();
const _ikTargetUpper = new THREE.Vector3();
const _ikCurLower = new THREE.Vector3();
const _ikTargetLower = new THREE.Vector3();
const _ikTargetW = new THREE.Vector3();
const _ikVisW = new THREE.Quaternion();
const _ikQDelta = new THREE.Quaternion();
const _ikQBlend = new THREE.Quaternion();

const WEAPON_SUPPORT_WRIST_LOCAL: Record<string, readonly [number, number, number]> = {
  g18: [0.036, -0.028, 0.024],
  deagle: [0.036, -0.028, 0.026],
  ump45: [0.044, -0.002, 0.150],
  m4a1: [0.044, -0.006, 0.154],
  xm8: [0.044, -0.008, 0.220],
  scar: [0.044, -0.010, 0.184],
  ak47: [0.044, 0.002, 0.226],
  m1014: [0.044, -0.010, 0.224],
  awm: [0.044, -0.014, 0.214],
};

function solveTwoBoneLeftArmIK(
  vis: THREE.Object3D,
  rig: CharacterRig,
  weaponId: string | null | undefined,
  weaponCategory: CharacterAnimInput['weaponCategory'],
  blend: number,
): void {
  const w = THREE.MathUtils.clamp(blend, 0, 1);
  if (w <= 0.01) return;
  const upper = rig.adamUpperArmLBone;
  const lower = rig.adamLowerArmLBone;
  const hand = rig.adamHandLBone;
  if (!upper || !lower || !hand || !upper.parent || !lower.parent) return;

  const fallbackCoords: readonly [number, number, number] =
    weaponCategory === 'HG'
      ? [0.036, -0.028, 0.024]
      : weaponCategory === 'SMG'
        ? [0.044, -0.002, 0.150]
        : [0.044, -0.006, 0.184];
  const coords = (weaponId && WEAPON_SUPPORT_WRIST_LOCAL[weaponId]) || fallbackCoords;

  const isMaxim = rig.modelId === 'maxim';
  const isLarge = Boolean(weaponCategory && weaponCategory !== 'HG');
  vis.updateMatrixWorld(true);
  vis.getWorldQuaternion(_ikVisW);
  _ikTargetW.set(
    coords[0] + (isMaxim && isLarge ? 0.014 : 0),
    coords[1],
    coords[2] + (isMaxim && isLarge ? 0.02 : 0),
  );
  rig.weaponMount.localToWorld(_ikTargetW);

  upper.getWorldPosition(_ikA);
  lower.getWorldPosition(_ikB);
  hand.getWorldPosition(_ikC);

  const l1 = _ikB.distanceTo(_ikA);
  const l2 = _ikC.distanceTo(_ikB);
  if (l1 < 0.05 || l2 < 0.05) return;

  _ikAT.copy(_ikTargetW).sub(_ikA);
  const dRaw = _ikAT.length();
  if (dRaw < 1e-4) return;
  _ikDir.copy(_ikAT).divideScalar(dRaw);

  const d = THREE.MathUtils.clamp(dRaw, Math.abs(l1 - l2) + 0.02, (l1 + l2) * 0.985);

  if (isMaxim) {
    _ikPole.set(0.84, -0.54, 0.16).normalize().applyQuaternion(_ikVisW);
  } else {
    _ikPole.set(0.66, -0.72, -0.08).normalize().applyQuaternion(_ikVisW);
  }
  const proj = _ikPole.dot(_ikDir);
  _ikPole.addScaledVector(_ikDir, -proj);
  if (_ikPole.lengthSq() < 1e-6) {
    _ikPole.set(1, 0, 0).applyQuaternion(_ikVisW);
    const p2 = _ikPole.dot(_ikDir);
    _ikPole.addScaledVector(_ikDir, -p2);
  }
  _ikPole.normalize();

  const cosAlpha = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
  _ikElbowTarget
    .copy(_ikA)
    .addScaledVector(_ikDir, l1 * cosAlpha)
    .addScaledVector(_ikPole, l1 * sinAlpha);

  _ikCurUpper.copy(_ikB).sub(_ikA).normalize();
  _ikTargetUpper.copy(_ikElbowTarget).sub(_ikA).normalize();
  if (_ikCurUpper.lengthSq() > 1e-6 && _ikTargetUpper.lengthSq() > 1e-6) {
    _ikQDelta.setFromUnitVectors(_ikCurUpper, _ikTargetUpper);
    _ikQBlend.identity().slerp(_ikQDelta, w);
    upper.parent.getWorldQuaternion(_qParentW);
    _qInvParentW.copy(_qParentW).invert();
    _qLocalDelta.copy(_qInvParentW).multiply(_ikQBlend).multiply(_qParentW);
    upper.quaternion.premultiply(_qLocalDelta).normalize();
    upper.updateMatrixWorld(true);
  }

  lower.getWorldPosition(_ikB);
  hand.getWorldPosition(_ikC);
  _ikCurLower.copy(_ikC).sub(_ikB).normalize();
  _ikTargetLower.copy(_ikTargetW).sub(_ikB).normalize();
  if (_ikCurLower.lengthSq() > 1e-6 && _ikTargetLower.lengthSq() > 1e-6) {
    _ikQDelta.setFromUnitVectors(_ikCurLower, _ikTargetLower);
    _ikQBlend.identity().slerp(_ikQDelta, w);
    lower.parent.getWorldQuaternion(_qParentW);
    _qInvParentW.copy(_qParentW).invert();
    _qLocalDelta.copy(_qInvParentW).multiply(_ikQBlend).multiply(_qParentW);
    lower.quaternion.premultiply(_qLocalDelta).normalize();
    lower.updateMatrixWorld(true);
  }
}

function rotateBoneCharAxis(
  visW: THREE.Quaternion,
  bone: THREE.Object3D | null | undefined,
  ax: number,
  ay: number,
  az: number,
  angle: number,
): void {
  if (!bone || !bone.parent || Math.abs(angle) < 1e-4) return;
  _vAxis.set(ax, ay, az).normalize().applyQuaternion(visW);
  _qDeltaW.setFromAxisAngle(_vAxis, angle);
  bone.parent.getWorldQuaternion(_qParentW);
  _qInvParentW.copy(_qParentW).invert();
  _qLocalDelta.copy(_qInvParentW).multiply(_qDeltaW).multiply(_qParentW);
  bone.quaternion.premultiply(_qLocalDelta).normalize();
  bone.updateMatrixWorld(true);
}

function slerpArmBones(
  upperBones: Array<{ name: string; bone: THREE.Object3D }> | undefined,
  aimQuats: Record<string, THREE.Quaternion> | null,
  weight: number,
  includeSpineAndHead = false,
  sideFilter: 'all' | 'rightOnly' = 'all',
  spineStabilizeWeight = 0,
): void {
  if (!upperBones || !aimQuats || weight <= 0.005) return;
  const w = THREE.MathUtils.clamp(weight, 0, 1);
  const sw = THREE.MathUtils.clamp(spineStabilizeWeight, 0, 1);
  for (let i = 0; i < upperBones.length; i++) {
    const entry = upperBones[i];
    if (!includeSpineAndHead) {
      if (entry.name === 'mixamorigHead' || entry.name === 'mixamorigNeck') {
        continue;
      }
      if (entry.name.startsWith('mixamorigSpine')) {
        if (sw > 0.005 && (entry.name === 'mixamorigSpine1' || entry.name === 'mixamorigSpine2')) {
          const spineTarget = aimQuats[entry.name];
          if (spineTarget) {
            entry.bone.quaternion.slerp(spineTarget, sw);
          }
        }
        continue;
      }
    }
    if (sideFilter === 'rightOnly' && entry.name.includes('Left')) {
      continue;
    }
    const targetQ = aimQuats[entry.name];
    if (targetQ) {
      entry.bone.quaternion.slerp(targetQ, w);
    }
  }
}

export interface CharacterAnimInput {
  dt: number;
  speed: number; // horizontal speed m/s
  stance: PlayerStance;
  isGrounded: boolean;
  isSprinting: boolean;
  isAiming: boolean;
  isFiring: boolean;
  isLobby: boolean;
  isSkydiving: boolean;
  isParachuting: boolean;
  isDead: boolean;
  isDowned?: boolean;
  isHealing?: boolean;
  isReviving?: boolean;
  isReloading?: boolean;
  isDriving?: boolean;
  isSwimming?: boolean;
  isOnSurfboard?: boolean;
  isVaulting?: boolean;
  vaultProgress?: number; // 0..1
  hasWeapon?: boolean;
  hasMoveInput?: boolean;
  weaponCategory?: 'HG' | 'AR' | 'SMG' | 'SG' | 'SR' | null;
  turnDeltaRad?: number;
  moveLocalX?: number; // +1 right, -1 left in character facing space
  moveLocalZ?: number; // +1 forward, -1 backward in character facing space
  pitchRad: number;
}

export const WEAPON_DRAW_DURATION = 0.025;

export function computeWeaponDrawWeights(drawTimer: number): {
  progress: number;
  reachWeight: number;
} {
  if (drawTimer <= 0) {
    return { progress: 1, reachWeight: 0 };
  }
  const progress = THREE.MathUtils.clamp(1 - drawTimer / WEAPON_DRAW_DURATION, 0, 1);
  // 0..0.38: snap arm up & behind right shoulder like grabbing an arrow/gun off the back
  // 0.38..1.0: pull cleanly forward over shoulder into combat grip
  const reachWeight =
    progress < 0.38
      ? Math.sin((progress / 0.38) * Math.PI * 0.5)
      : Math.pow(Math.cos(((progress - 0.38) / 0.62) * Math.PI * 0.5), 1.35);
  return { progress, reachWeight };
}

export function applyAdamOverBackDraw(
  vis: THREE.Object3D | undefined,
  upperBones: Array<{ name: string; bone: THREE.Object3D }> | undefined,
  drawTimer: number,
  modelId: string = 'adam',
): number {
  if (!vis || !upperBones || drawTimer <= 0) return 0;
  const { reachWeight } = computeWeaponDrawWeights(drawTimer);
  if (reachWeight <= 0.005) return 0;

  const aimQuats = getAimPoseQuats(modelId);
  let spineBone: THREE.Object3D | undefined;
  let rShoulder: THREE.Object3D | undefined;
  let rArm: THREE.Object3D | undefined;
  let rForeArm: THREE.Object3D | undefined;
  let lArm: THREE.Object3D | undefined;

  for (let i = 0; i < upperBones.length; i++) {
    const e = upperBones[i];
    if (e.name === 'mixamorigSpine2' || e.name === 'mixamorigSpine1') {
      if (e.name === 'mixamorigSpine2' || !spineBone) spineBone = e.bone;
    } else if (e.name === 'mixamorigRightShoulder') {
      rShoulder = e.bone;
    } else if (e.name === 'mixamorigRightArm') {
      rArm = e.bone;
    } else if (e.name === 'mixamorigRightForeArm') {
      rForeArm = e.bone;
    } else if (e.name === 'mixamorigLeftArm') {
      lArm = e.bone;
    }
    if (
      aimQuats &&
      (e.name === 'mixamorigRightShoulder' ||
        e.name === 'mixamorigRightArm' ||
        e.name === 'mixamorigRightForeArm' ||
        e.name === 'mixamorigRightHand')
    ) {
      const q = aimQuats[e.name];
      if (q) e.bone.quaternion.slerp(q, Math.min(1, reachWeight * 0.92));
    }
  }

  vis.updateMatrixWorld(true);
  vis.getWorldQuaternion(_qVisW);
  if (spineBone) {
    rotateBoneCharAxis(_qVisW, spineBone, 0, 1, 0, -0.26 * reachWeight);
    rotateBoneCharAxis(_qVisW, spineBone, 1, 0, 0, -0.06 * reachWeight);
  }
  if (rShoulder) {
    rotateBoneCharAxis(_qVisW, rShoulder, 0, 0, 1, -0.18 * reachWeight);
    rotateBoneCharAxis(_qVisW, rShoulder, 0, 1, 0, -0.16 * reachWeight);
  }
  if (rArm) {
    rotateBoneCharAxis(_qVisW, rArm, 1, 0, 0, -1.78 * reachWeight);
    rotateBoneCharAxis(_qVisW, rArm, 0, 0, 1, -0.44 * reachWeight);
    rotateBoneCharAxis(_qVisW, rArm, 0, 1, 0, -0.32 * reachWeight);
  }
  if (rForeArm) {
    rotateBoneCharAxis(_qVisW, rForeArm, 1, 0, 0, -1.28 * reachWeight);
    rotateBoneCharAxis(_qVisW, rForeArm, 0, 1, 0, 0.34 * reachWeight);
  }
  if (lArm) {
    rotateBoneCharAxis(_qVisW, lArm, 1, 0, 0, 0.18 * reachWeight);
  }
  return reachWeight;
}

export class CharacterAnimator {
  private walkPhase = 0;
  private idleTime = 0;
  private recoil = 0;
  private punchTimer = 0;
  private punchSide = 1;
  private hitFlash = 0;
  private hitStagger = 0;
  private deathProgress = 0;
  private landingDip = 0;
  private turnBank = 0;
  private reloadPhase = 0;
  private fireHold = 0;
  private combatUpperBlend = 0;
  private sprintCarryBlend = 0;
  private analogCarryBlend = 0;
  private idleHoldBlend = 0;
  private crouchLowBlend = 0;
  private unarmedRunBlend = 0;
  private bandageBlend = 0;
  private bandagePhase = 0;
  private jumpPoseBlend = 0;
  private crouchRootZ = 0;
  private runSwayPhase = 0;
  private drawTimer = 0;
  private wasGrounded = true;
  private airTime = 0;
  private jumpCancelled = false;
  private jumpStartMoving = false;
  private wasCrouch = false;
  private crouchFast = false;
  private spineFwdTarget = 0.19;

  public triggerFire(): void {
    this.recoil = 1.0;
    this.fireHold = 0.55;
  }

  public triggerWeaponDraw(): void {
    this.drawTimer = WEAPON_DRAW_DURATION;
  }

  public triggerPunch(): void {
    this.punchTimer = 0.34;
    this.punchSide = -this.punchSide;
  }

  public triggerHit(): void {
    this.hitFlash = 1.0;
    this.hitStagger = 1.0;
  }

  public triggerLanding(): void {
    this.landingDip = 1.0;
  }

  public reset(): void {
    this.deathProgress = 0;
    this.hitFlash = 0;
    this.hitStagger = 0;
    this.recoil = 0;
    this.punchTimer = 0;
    this.landingDip = 0;
    this.turnBank = 0;
    this.reloadPhase = 0;
    this.fireHold = 0;
    this.combatUpperBlend = 0;
    this.sprintCarryBlend = 0;
    this.analogCarryBlend = 0;
    this.idleHoldBlend = 0;
    this.crouchLowBlend = 0;
    this.unarmedRunBlend = 0;
    this.bandageBlend = 0;
    this.bandagePhase = 0;
    this.jumpPoseBlend = 0;
    this.crouchRootZ = 0;
    this.runSwayPhase = 0;
    this.drawTimer = 0;
    this.wasGrounded = true;
    this.airTime = 0;
    this.jumpCancelled = false;
    this.jumpStartMoving = false;
    this.wasCrouch = false;
    this.crouchFast = false;
    this.spineFwdTarget = 0.19;
  }

  private playAdamClip(
    rig: CharacterRig,
    clipName: string,
    fadeSec = 0.018,
    timeScale = 1.0,
    restart = false,
  ): void {
    const actions = rig.actions;
    if (!actions) return;
    const next = actions[clipName] ?? actions.Idle_Loop ?? Object.values(actions)[0];
    if (!next) return;
    const resolvedName = next.getClip().name;
    next.timeScale = timeScale;

    if (rig.activeClipName === resolvedName) {
      if (restart) {
        next.reset().play();
      }
      return;
    }

    const prev = rig.activeClipName ? actions[rig.activeClipName] : undefined;
    next.enabled = true;
    next.reset();
    next.play();
    if (prev && prev !== next) {
      prev.crossFadeTo(next, fadeSec, true);
    }
    rig.activeClipName = resolvedName;
  }

  private stopUpperPunchOverlay(rig: CharacterRig): void {
    const actions = rig.actions;
    if (!actions) return;
    const jabU = actions.Punch_Jab_Upper;
    if (jabU && jabU.isRunning()) jabU.stop();
    const crossU = actions.Punch_Cross_Upper;
    if (crossU && crossU.isRunning()) crossU.stop();
  }

  private updateAdamRig(rig: CharacterRig, input: CharacterAnimInput): void {
    const dt = input.dt;
    const vis = rig.adamVisualRoot;
    const mixer = rig.mixer;
    if (!mixer || !vis) return;

    const hasWeapon = input.hasWeapon ?? true;
    const isLargeWeapon =
      hasWeapon && Boolean(input.weaponCategory && input.weaponCategory !== 'HG');
    const isMoving = input.speed > 0.32;
    const curMove = isMoving || Boolean(input.hasMoveInput);
    const localX = THREE.MathUtils.clamp(input.moveLocalX ?? 0, -1, 1);
    const localZ = THREE.MathUtils.clamp(input.moveLocalZ ?? 1, -1, 1);
    const isBackpedaling = isMoving && localZ < -0.28;

    rig.muzzleFlash.visible =
      this.recoil > 0.55 && hasWeapon && !input.isDead && !input.isDriving && !input.isDowned;
    if (rig.muzzleFlash.visible) {
      rig.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.5;
      rig.muzzleFlash.scale.set(s, s, s);
    }

    // 1. Death clip
    if (input.isDead) {
      this.stopUpperPunchOverlay(rig);
      rig.setParachuteVisible(false);
      rig.setSurfboardVisible(false);
      rig.contactShadow.visible = false;
      vis.position.set(0, 0, 0);
      vis.rotation.set(0, 0, 0);
      this.playAdamClip(rig, 'Death01', 0.12, 1.05);
      mixer.update(dt);
      return;
    }

    // 2. Driving vehicle seated clip
    if (input.isDriving) {
      this.stopUpperPunchOverlay(rig);
      rig.setParachuteVisible(false);
      rig.setSurfboardVisible(false);
      rig.contactShadow.visible = false;
      vis.position.set(0, 0.04, 0);
      vis.rotation.set(0, 0, -this.turnBank * 0.3);
      this.playAdamClip(rig, 'Driving_Loop', 0.18, 1.0);
      mixer.update(dt);
      return;
    }

    // 3. Skydiving / Parachuting
    if (input.isSkydiving) {
      this.stopUpperPunchOverlay(rig);
      rig.setParachuteVisible(false);
      rig.setSurfboardVisible(false);
      rig.contactShadow.visible = false;
      vis.position.set(0, 0.95, 0);
      vis.rotation.set(1.22, 0, Math.sin(this.idleTime * 5) * 0.08 + this.turnBank);
      this.playAdamClip(rig, 'Jump_Loop', 0.2, 0.85);
      mixer.update(dt);
      return;
    }

    if (input.isParachuting) {
      rig.setParachuteVisible(true);
      rig.setSurfboardVisible(false);
      rig.contactShadow.visible = false;
      vis.position.set(0, 0, 0);
      vis.rotation.set(0.08, 0, Math.sin(this.idleTime * 2.2) * 0.05 + this.turnBank * 0.5);
      this.playAdamClip(rig, 'Jump_Loop', 0.2, 0.7);
      mixer.update(dt);
      return;
    }

    rig.setParachuteVisible(false);
    rig.setSurfboardVisible(Boolean(input.isOnSurfboard));
    rig.contactShadow.visible = input.isGrounded && !input.isSwimming && !input.isOnSurfboard;

    // 4. Lobby Idle
    if (input.isLobby) {
      vis.position.set(0, 0, 0);
      vis.rotation.set(0, 0, 0);
      this.playAdamClip(rig, 'Idle_Loop', 0.22, 1.0);
      mixer.update(dt);
      return;
    }

    // 4b. Swimming in water (without surfboard)
    if (input.isSwimming && !input.isOnSurfboard) {
      const bob = Math.sin(this.idleTime * 4.0) * 0.04;
      this.playAdamClip(rig, 'Idle_Loop', 0.14, 0.85);
      if (isMoving) {
        vis.position.set(0, 0.34 + bob, -0.62);
        vis.rotation.set(1.42, 0, Math.sin(this.idleTime * 5.6) * 0.15 + this.turnBank * 0.45);
      } else {
        vis.position.set(0, -0.10 + bob, 0);
        vis.rotation.set(0.08, 0, Math.sin(this.idleTime * 2.4) * 0.04);
      }
      mixer.update(dt);
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      if (isMoving) {
        const kick = Math.sin(this.idleTime * 9.8) * 0.34;
        const phaseL = this.idleTime * 6.4;
        const phaseR = phaseL + Math.PI;
        rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 1, 0, 0, -0.28);
        rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, -0.82);
        rotateBoneCharAxis(_qVisW, rig.adamThighLBone, 1, 0, 0, 0.22 + kick);
        rotateBoneCharAxis(_qVisW, rig.adamThighRBone, 1, 0, 0, 0.22 - kick);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, -2.0 + Math.sin(phaseL) * 1.1);
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmLBone,
          0,
          0,
          1,
          0.28 + Math.max(0, Math.cos(phaseL)) * 0.42,
        );
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, -2.0 + Math.sin(phaseR) * 1.1);
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          0,
          1,
          -0.28 - Math.max(0, Math.cos(phaseR)) * 0.42,
        );
      } else {
        const scull = Math.sin(this.idleTime * 4.2);
        rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, -0.08);
        rotateBoneCharAxis(_qVisW, rig.adamThighLBone, 1, 0, 0, 0.14 + scull * 0.22);
        rotateBoneCharAxis(_qVisW, rig.adamThighRBone, 1, 0, 0, 0.14 - scull * 0.22);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, 0.52 + scull * 0.2);
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmLBone,
          1,
          0,
          0,
          -0.45 + Math.cos(this.idleTime * 4.2) * 0.24,
        );
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, -0.52 - scull * 0.2);
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          1,
          0,
          0,
          -0.45 - Math.cos(this.idleTime * 4.2) * 0.24,
        );
      }
      return;
    }

    // 5. Downed crawling ("posição de 4")
    if (input.isDowned) {
      vis.position.set(0, 0.34, 0.05);
      vis.rotation.set(Math.PI * 0.32, 0, Math.sin(this.idleTime * 7) * (isMoving ? 0.07 : 0));
      this.playAdamClip(
        rig,
        isMoving ? 'Crouch_Fwd_Loop' : 'Crouch_Idle_Loop',
        0.04,
        isMoving ? 0.95 : 0.8,
      );
      mixer.update(dt);
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, -0.65);
      return;
    }

    // 5b. Parkour One-Handed Speed Vault over window sill (plant left hand, swing both legs sideways over sill)
    if (input.isVaulting) {
      const p = THREE.MathUtils.clamp(input.vaultProgress ?? 0.5, 0, 1);
      const plantEnv = Math.sin(Math.min(1, p / 0.88) * Math.PI);
      const swingEnv = Math.sin(Math.pow(p, 0.82) * Math.PI);
      const isMaxim = rig.modelId === 'maxim';

      vis.position.set(0, 0.14 * swingEnv, 0);
      vis.rotation.set(0.28 * plantEnv, 0, -0.54 * plantEnv);
      this.playAdamClip(rig, 'Idle_Loop', 0.03, 1.0);
      mixer.update(dt);
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);

      const aimQuats = getAimPoseQuats(rig.skinBundleId ?? rig.modelId ?? 'adam');
      if (hasWeapon && aimQuats && rig.adamUpperBones) {
        slerpArmBones(rig.adamUpperBones, aimQuats, 0.72 * plantEnv, false, 'rightOnly', 0);
        vis.updateMatrixWorld(true);
        vis.getWorldQuaternion(_qVisW);
      }

      // Twist upper torso slightly toward planted left hand, keep head looking over landing spot
      rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 0, 1, 0, -0.26 * plantEnv);
      rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 1, 0, 0, 0.14 * plantEnv);
      rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, -0.32 * plantEnv);

      // Left arm braced straight down onto the window sill supporting body weight
      rotateBoneCharAxis(_qVisW, rig.adamLeftShoulderBone, 0, 0, 1, 0.18 * plantEnv);
      rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, -0.88 * plantEnv);
      rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, 0.36 * plantEnv);
      rotateBoneCharAxis(_qVisW, rig.adamLowerArmLBone, 1, 0, 0, -0.18 * plantEnv);
      rotateBoneCharAxis(_qVisW, rig.adamHandLBone, 1, 0, 0, 0.35 * plantEnv);

      // Right arm tucks weapon cleanly at right hip/side (or balances out if unarmed)
      if (hasWeapon) {
        if (isMaxim) {
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 1, 0, 0.14 * plantEnv);
        }
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, 0.22 * plantEnv);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 1, 0, (isMaxim ? -0.24 : -0.08) * plantEnv);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, -0.26 * plantEnv);
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 1, 0, 0, -0.44 * plantEnv);
      } else {
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, -0.62 * plantEnv);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, -0.58 * plantEnv);
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 1, 0, 0, -0.88 * plantEnv);
      }

      // Sweep both tucked legs sideways to the right cleanly clearing the window sill
      rotateBoneCharAxis(_qVisW, rig.adamThighLBone, 1, 0, 0, -1.12 * swingEnv);
      rotateBoneCharAxis(_qVisW, rig.adamThighLBone, 0, 0, 1, -0.34 * swingEnv);
      rotateBoneCharAxis(_qVisW, rig.adamShinLBone, 1, 0, 0, 1.38 * swingEnv);

      rotateBoneCharAxis(_qVisW, rig.adamThighRBone, 1, 0, 0, -0.94 * swingEnv);
      rotateBoneCharAxis(_qVisW, rig.adamThighRBone, 0, 0, 1, -0.42 * swingEnv);
      rotateBoneCharAxis(_qVisW, rig.adamShinRBone, 1, 0, 0, 1.24 * swingEnv);
      return;
    }

    // 6. Prone (FF 2017 "Deitar": barriga apoiada rente ao chão, pernas alinhadas sem flutuar,
    //    rastejo alternado de joelhos e cotovelos, e arma nivelada à frente na altura do olhar)
    if (input.stance === 'prone') {
      this.stopUpperPunchOverlay(rig);
      if (isMoving) {
        this.walkPhase += dt * 6.4;
      } else {
        const restP = Math.round(this.walkPhase / Math.PI) * Math.PI;
        this.walkPhase = THREE.MathUtils.damp(this.walkPhase, restP, 18, dt);
      }
      const crawl = Math.sin(this.walkPhase);
      const crawlPosL = Math.max(0, crawl);
      const crawlPosR = Math.max(0, -crawl);
      const moveAmt = isMoving ? 1 : 0;

      vis.position.set(0, 0.145, -0.52);
      vis.rotation.set(1.50, 0, crawl * 0.055 * moveAmt);
      this.playAdamClip(rig, 'Idle_Loop', 0.03, 0.65);
      mixer.update(dt);
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);

      // Neutralize Idle_Loop's front/back foot stagger so both legs rest symmetrically on the dirt
      // and drive an alternating army-crawl knee sweep when moving
      rotateBoneCharAxis(
        _qVisW,
        rig.adamThighLBone,
        1,
        0,
        0,
        0.15 - crawlPosL * 0.24 * moveAmt,
      );
      rotateBoneCharAxis(
        _qVisW,
        rig.adamThighLBone,
        0,
        0,
        1,
        0.11 + crawlPosL * 0.16 * moveAmt,
      );
      rotateBoneCharAxis(
        _qVisW,
        rig.adamShinLBone,
        1,
        0,
        0,
        0.14 + crawlPosL * 0.42 * moveAmt,
      );

      rotateBoneCharAxis(
        _qVisW,
        rig.adamThighRBone,
        1,
        0,
        0,
        -0.23 - crawlPosR * 0.24 * moveAmt,
      );
      rotateBoneCharAxis(
        _qVisW,
        rig.adamThighRBone,
        0,
        0,
        1,
        -0.11 - crawlPosR * 0.16 * moveAmt,
      );
      rotateBoneCharAxis(
        _qVisW,
        rig.adamShinRBone,
        1,
        0,
        0,
        0.12 + crawlPosR * 0.42 * moveAmt,
      );

      // Prop upper chest subtly on elbows & lift head comfortably along the sightline
      rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 1, 0, 0, -0.34 - this.recoil * 0.06);
      rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, -0.64 + input.pitchRad * 0.24);

      const aimQuats = getAimPoseQuats(rig.skinBundleId ?? rig.modelId ?? 'adam');
      if (aimQuats && rig.adamUpperBones) {
        slerpArmBones(rig.adamUpperBones, aimQuats, 1.0, false);
        vis.updateMatrixWorld(true);
        vis.getWorldQuaternion(_qVisW);

        if (hasWeapon) {
          // Level arms horizontally over the dirt instead of pointing 35° up into the sky
          const proneArmDrop = 0.34 - this.recoil * 0.07 - input.pitchRad * 0.26;
          const crawlNudge = crawl * 0.045 * moveAmt;
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, proneArmDrop + crawlNudge);
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, -0.09);
          solveTwoBoneLeftArmIK(vis, rig, rig.activeWeaponId, input.weaponCategory, 1.0);
        } else {
          // Unarmed prone: forearms planted low ahead of chest, reaching alternately on crawl
          rotateBoneCharAxis(
            _qVisW,
            rig.adamUpperArmLBone,
            1,
            0,
            0,
            0.52 + crawl * 0.34 * moveAmt,
          );
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, 0.22);
          rotateBoneCharAxis(_qVisW, rig.adamLowerArmLBone, 1, 0, 0, -0.62);

          rotateBoneCharAxis(
            _qVisW,
            rig.adamUpperArmRBone,
            1,
            0,
            0,
            0.52 - crawl * 0.34 * moveAmt,
          );
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, -0.22);
          rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 1, 0, 0, -0.62);
        }
      }
      return;
    }

    // 7. Standing / Crouching / Surfboard Locomotion
    const isCrouch = input.stance === 'crouch';
    const waveBob = input.isOnSurfboard ? Math.sin(this.idleTime * 4.4) * 0.024 : 0;
    if (input.isOnSurfboard) {
      rig.surfboardGroup.position.set(0, 0.02 + waveBob, 0);
      rig.surfboardGroup.rotation.set(isMoving ? -0.055 : 0.015, 0, -this.turnBank * 0.85);
    }

    // Center crouch pelvis slightly forward (+0.10m) so upright crouch stays centered inside capsule
    this.crouchRootZ = THREE.MathUtils.damp(this.crouchRootZ, isCrouch ? 0.10 : 0, 165, dt);

    vis.position.set(
      0,
      input.isOnSurfboard ? 0.08 + waveBob : -this.landingDip * 0.04,
      this.crouchRootZ,
    );
    vis.rotation.set(
      input.isOnSurfboard && isMoving ? -0.04 : 0,
      0,
      input.isOnSurfboard && isMoving ? -this.turnBank * 0.68 : 0,
    );

    const isCombatActive =
      hasWeapon &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading &&
      (input.isAiming || input.isFiring || this.fireHold > 0.08 || this.recoil > 0.05);

    const isAirborne =
      !input.isGrounded && !input.isOnSurfboard && !input.isHealing && !input.isReviving;
    const isAirborneWeaponHold =
      isAirborne && hasWeapon && !input.isReloading && (isCombatActive || this.jumpCancelled);

    const crouchAimForward =
      isCrouch &&
      hasWeapon &&
      curMove &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading;
    const wantsCrouchLow =
      isCrouch &&
      hasWeapon &&
      !curMove &&
      !isCombatActive &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading &&
      !input.isOnSurfboard;

    const wantsSprintCarry =
      hasWeapon &&
      isMoving &&
      input.isSprinting &&
      !isCombatActive &&
      !isAirborne &&
      !isCrouch &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading &&
      !input.isOnSurfboard;

    const wantsAnalogCarry =
      hasWeapon &&
      isMoving &&
      !input.isSprinting &&
      !isCombatActive &&
      !isAirborne &&
      !isCrouch &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading &&
      !input.isOnSurfboard;

    const wantsIdleHold =
      hasWeapon &&
      !isMoving &&
      !isCombatActive &&
      !isAirborne &&
      !isCrouch &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading &&
      !input.isOnSurfboard;

    const hasFFRunClip = Boolean(rig.actions?.FF_Run_Loop);
    const wantsUnarmedRun =
      !hasWeapon &&
      isMoving &&
      !isAirborne &&
      !isCrouch &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isOnSurfboard &&
      this.punchTimer <= 0 &&
      !hasFFRunClip;

    const lockCombatUpper = isCombatActive || isAirborneWeaponHold || crouchAimForward;

    this.combatUpperBlend = THREE.MathUtils.damp(
      this.combatUpperBlend,
      lockCombatUpper ? 1 : 0,
      lockCombatUpper ? 210 : 120,
      dt,
    );
    this.sprintCarryBlend = THREE.MathUtils.damp(
      this.sprintCarryBlend,
      wantsSprintCarry ? 1 : 0,
      130,
      dt,
    );
    this.analogCarryBlend = THREE.MathUtils.damp(
      this.analogCarryBlend,
      wantsAnalogCarry ? 1 : 0,
      130,
      dt,
    );
    this.idleHoldBlend = THREE.MathUtils.damp(
      this.idleHoldBlend,
      wantsIdleHold ? 1 : 0,
      125,
      dt,
    );
    this.crouchLowBlend = THREE.MathUtils.damp(
      this.crouchLowBlend,
      wantsCrouchLow ? 1 : 0,
      185,
      dt,
    );
    this.unarmedRunBlend = THREE.MathUtils.damp(
      this.unarmedRunBlend,
      wantsUnarmedRun ? 1 : 0,
      125,
      dt,
    );
    const targetJumpPose = isAirborne
      ? isCombatActive || this.jumpCancelled
        ? 0.0
        : 1.0
      : 0;
    this.jumpPoseBlend = THREE.MathUtils.damp(
      this.jumpPoseBlend,
      targetJumpPose,
      165,
      dt,
    );

    const fastCrouchFade = 0.008;
    const fastJumpExitFade = 0.018;
    const isCrouchPunching =
      isCrouch && !hasWeapon && this.punchTimer > 0 && !input.isHealing && !input.isReviving;

    if (isCrouchPunching && rig.actions?.Crouch_Lower_Idle && rig.actions?.Punch_Jab_Upper) {
      const crouchRate = isMoving
        ? THREE.MathUtils.clamp(input.speed / 3.3, 0.55, 1.32) * (isBackpedaling ? -1 : 1)
        : 1.05;
      this.playAdamClip(
        rig,
        isMoving ? 'Crouch_Lower_Fwd' : 'Crouch_Lower_Idle',
        fastCrouchFade,
        crouchRate,
      );
      const upperName = this.punchSide > 0 ? 'Punch_Jab_Upper' : 'Punch_Cross_Upper';
      const otherName = this.punchSide > 0 ? 'Punch_Cross_Upper' : 'Punch_Jab_Upper';
      const otherAct = rig.actions[otherName];
      if (otherAct && otherAct.isRunning()) {
        otherAct.stop();
      }
      const upperAct = rig.actions[upperName];
      if (upperAct) {
        upperAct.enabled = true;
        upperAct.timeScale = 1.45;
        upperAct.setEffectiveWeight(1.0);
        if (!upperAct.isRunning() || this.punchTimer > 0.31) {
          upperAct.reset().play();
        }
      }
    } else {
      this.stopUpperPunchOverlay(rig);
      if (input.isReviving) {
        this.playAdamClip(rig, 'Fixing_Kneeling', 0.04, 1.1);
      } else if (!hasWeapon && this.punchTimer > 0 && !input.isHealing) {
        const punchClip = this.punchSide > 0 ? 'Punch_Jab' : 'Punch_Cross';
        this.playAdamClip(rig, punchClip, 0.025, 1.45, this.punchTimer > 0.31);
      } else if (isCrouch) {
        const crouchRate = isMoving
          ? THREE.MathUtils.clamp(input.speed / 3.3, 0.55, 1.32) * (isBackpedaling ? -1 : 1)
          : 1.05;
        this.playAdamClip(
          rig,
          isMoving ? 'Crouch_Fwd_Loop' : 'Crouch_Idle_Loop',
          fastCrouchFade,
          crouchRate,
        );
      } else if (input.isHealing) {
        this.playAdamClip(
          rig,
          isMoving ? 'Jog_Fwd_Loop' : 'Idle_Loop',
          0.05,
          isMoving ? THREE.MathUtils.clamp(input.speed / 5.4, 0.55, 1.2) : 1.0,
        );
      } else if (isAirborne) {
        this.playAdamClip(rig, 'Idle_Loop', 0.03, 1.0);
      } else if (input.isReloading && hasWeapon) {
        this.playAdamClip(rig, 'Pistol_Reload', 0.04, 1.35);
      } else if (input.isOnSurfboard) {
        if (hasWeapon) {
          if (input.isFiring || this.recoil > 0.25 || this.fireHold > 0.22) {
            this.playAdamClip(rig, 'Pistol_Shoot', 0.025, 1.35);
          } else if (input.isAiming || isCombatActive) {
            this.playAdamClip(rig, 'Pistol_Aim_Neutral', 0.03, 1.0);
          } else {
            this.playAdamClip(rig, 'Idle_Loop', 0.05, 1.0);
          }
        } else {
          this.playAdamClip(rig, 'Idle_Loop', 0.04, 1.0);
        }
      } else if (isMoving) {
        if (input.isSprinting && !isCombatActive) {
          const sprintClip = hasFFRunClip ? 'FF_Run_Loop' : 'Sprint_Loop';
          this.playAdamClip(
            rig,
            sprintClip,
            fastJumpExitFade,
            THREE.MathUtils.clamp(input.speed / 8.2, 0.92, 1.28),
          );
        } else if (isCombatActive && input.speed < 0.85) {
          this.playAdamClip(rig, 'Pistol_Aim_Neutral', 0.03, 1.0);
        } else if (hasFFRunClip) {
          // Analog walk uses the full FF_Run_Loop animation in slow-motion proportional to joystick speed
          const slowRunRate =
            THREE.MathUtils.clamp(input.speed / 8.8, 0.34, 0.62) * (isBackpedaling ? -1 : 1);
          this.playAdamClip(rig, 'FF_Run_Loop', fastJumpExitFade, slowRunRate);
        } else {
          const jogRate =
            THREE.MathUtils.clamp(input.speed / 5.4, 0.42, 1.18) * (isBackpedaling ? -1 : 1);
          this.playAdamClip(rig, 'Jog_Fwd_Loop', fastJumpExitFade, jogRate);
        }
      } else if (hasWeapon) {
        if (input.isFiring || this.recoil > 0.25 || this.fireHold > 0.22) {
          this.playAdamClip(rig, 'Pistol_Shoot', 0.025, 1.35);
        } else if (input.isAiming || isCombatActive) {
          this.playAdamClip(rig, 'Pistol_Aim_Neutral', 0.025, 1.0);
        } else {
          // Use clean athletic Idle_Loop base so standing rifle/pistol ready pose looks natural (not frozen zombie pistol aim)
          this.playAdamClip(rig, 'Idle_Loop', 0.06, 1.0);
        }
      } else {
        this.playAdamClip(rig, 'Idle_Loop', 0.05, 1.0);
      }
    }

    mixer.update(dt);

    const aimQuats = getAimPoseQuats(rig.skinBundleId ?? rig.modelId ?? 'adam');
    const isMaxim = rig.modelId === 'maxim';
    const breath = Math.sin(this.idleTime * 2.3);
    const sway = Math.sin(this.runSwayPhase);
    const stepBounce = Math.sin(this.runSwayPhase * 2);

    // A. Combat Upper Body (Aiming / Firing / Crouch-Moving / Airborne Weapon Hold)
    //    When crouched, stabilize upper chest squarely forward without snapping hips upright
    const combatW = this.combatUpperBlend * (1 - this.bandageBlend);
    if (combatW > 0.01 && rig.adamUpperBones && aimQuats) {
      slerpArmBones(
        rig.adamUpperBones,
        aimQuats,
        combatW,
        !isCrouch,
        'all',
        isCrouch ? 0.80 * combatW : 0,
      );
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      if (isMaxim) {
        rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 1, 0, 0.16 * combatW);
        rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 0, 1, -0.08 * combatW);
      }
      if (isLargeWeapon) {
        // Seat rifle cleanly at front right shoulder with outward clearance so stock & arm never clip chest
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, (isMaxim ? -0.02 : 0.04) * combatW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 1, 0, (isMaxim ? -0.22 : -0.04) * combatW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, (isMaxim ? -0.14 : -0.06) * combatW);
        if (isMaxim) {
          rotateBoneCharAxis(_qVisW, rig.adamLeftShoulderBone, 0, 1, 0, -0.07 * combatW);
        }
      } else if (isMaxim) {
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 1, 0, -0.16 * combatW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, -0.10 * combatW);
      }
    }

    // B. Standing Idle Weapon Hold (Natural human relaxed upright posture — lowered two-handed pistol / ready rifle)
    const idleW = this.idleHoldBlend * (1 - this.combatUpperBlend) * (1 - this.bandageBlend);
    if (idleW > 0.01 && rig.adamUpperBones && aimQuats) {
      slerpArmBones(rig.adamUpperBones, aimQuats, idleW, false, 'all', isMaxim ? 0.56 * idleW : 0);
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);

      if (isLargeWeapon) {
        rotateBoneCharAxis(
          _qVisW,
          rig.adamSpineBone,
          0,
          1,
          0,
          (0.06 + breath * 0.002) * idleW,
        );
        rotateBoneCharAxis(_qVisW, rig.adamSpine2Bone, 1, 0, 0, breath * 0.003 * idleW);
        if (isMaxim) {
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 1, 0, 0.16 * idleW);
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 0, 1, -0.08 * idleW);
          rotateBoneCharAxis(_qVisW, rig.adamLeftShoulderBone, 0, 1, 0, -0.06 * idleW);
        }
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          1,
          0,
          0,
          ((isMaxim ? 0.20 : 0.36) + breath * 0.004) * idleW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          1,
          0,
          ((isMaxim ? -0.28 : 0.16) + breath * 0.002) * idleW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          0,
          1,
          (isMaxim ? -0.18 : -0.07) * idleW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamLowerArmRBone,
          1,
          0,
          0,
          (isMaxim ? -0.02 : -0.08) * idleW,
        );
      } else {
        // Original FF Pistol Idle: lowered forward with both hands in front of waist/hip
        rotateBoneCharAxis(
          _qVisW,
          rig.adamSpineBone,
          0,
          1,
          0,
          (0.04 + breath * 0.002) * idleW,
        );
        rotateBoneCharAxis(_qVisW, rig.adamSpine2Bone, 1, 0, 0, breath * 0.003 * idleW);
        if (isMaxim) {
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 1, 0, 0.14 * idleW);
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 0, 1, -0.07 * idleW);
        }
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          1,
          0,
          0,
          ((isMaxim ? 0.56 : 0.62) + breath * 0.004) * idleW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          1,
          0,
          ((isMaxim ? -0.22 : 0.05) + breath * 0.002) * idleW,
        );
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, (isMaxim ? -0.15 : -0.05) * idleW);
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 1, 0, 0, 0.10 * idleW);
      }
    }

    // C. Crouched Stationary Weapon Hold (Firm two-handed low-ready with IK lock & untwisted upper chest)
    const crouchLowW =
      this.crouchLowBlend * (1 - this.combatUpperBlend) * (1 - this.bandageBlend);
    if (crouchLowW > 0.01 && rig.adamUpperBones && aimQuats) {
      slerpArmBones(
        rig.adamUpperBones,
        aimQuats,
        crouchLowW,
        false,
        'all',
        (isMaxim ? 0.70 : 0.55) * crouchLowW,
      );
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      if (isMaxim) {
        rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 1, 0, 0.16 * crouchLowW);
        rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 0, 1, -0.08 * crouchLowW);
        if (isLargeWeapon) {
          rotateBoneCharAxis(_qVisW, rig.adamLeftShoulderBone, 0, 1, 0, -0.06 * crouchLowW);
        }
      }
      rotateBoneCharAxis(
        _qVisW,
        rig.adamUpperArmRBone,
        1,
        0,
        0,
        ((isLargeWeapon ? (isMaxim ? 0.18 : 0.30) : 0.52) + breath * 0.004) * crouchLowW,
      );
      rotateBoneCharAxis(
        _qVisW,
        rig.adamUpperArmRBone,
        0,
        1,
        0,
        (isMaxim ? (isLargeWeapon ? -0.28 : -0.20) : isLargeWeapon ? 0.14 : 0.05) * crouchLowW,
      );
      rotateBoneCharAxis(
        _qVisW,
        rig.adamUpperArmRBone,
        0,
        0,
        1,
        (isMaxim ? (isLargeWeapon ? -0.18 : -0.14) : -0.07) * crouchLowW,
      );
    }

    // D. Analog Walk Weapon Carry (Slow-motion FF_Run_Loop legs + lowered two-handed pistol OR steady rifle with minimal sway)
    const analogW =
      this.analogCarryBlend *
      (1 - this.combatUpperBlend) *
      (1 - this.sprintCarryBlend) *
      (1 - this.bandageBlend);
    if (analogW > 0.01 && rig.adamUpperBones && aimQuats) {
      slerpArmBones(
        rig.adamUpperBones,
        aimQuats,
        analogW,
        false,
        'all',
        (isMaxim ? 0.70 : 0.45) * analogW,
      );
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);

      const speedScale = THREE.MathUtils.clamp(input.speed / 5.8, 0.35, 1.0);
      const bob = stepBounce * 0.005 * speedScale;
      const microSway = sway * 0.005 * speedScale;
      if (isLargeWeapon) {
        rotateBoneCharAxis(
          _qVisW,
          rig.adamSpineBone,
          0,
          1,
          0,
          (0.08 + microSway) * analogW,
        );
        if (isMaxim) {
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 1, 0, 0.16 * analogW);
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 0, 1, -0.08 * analogW);
          rotateBoneCharAxis(_qVisW, rig.adamLeftShoulderBone, 0, 1, 0, -0.06 * analogW);
        }
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          1,
          0,
          0,
          ((isMaxim ? 0.18 : 0.34) + bob) * analogW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          1,
          0,
          ((isMaxim ? -0.28 : 0.15) + microSway) * analogW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          0,
          1,
          (isMaxim ? -0.18 : -0.07) * analogW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamLowerArmRBone,
          1,
          0,
          0,
          (isMaxim ? -0.02 : -0.08) * analogW,
        );
      } else {
        // Original FF Analog Pistol Walk: both hands holding pistol lowered forward
        rotateBoneCharAxis(
          _qVisW,
          rig.adamSpineBone,
          0,
          1,
          0,
          (0.04 + microSway) * analogW,
        );
        if (isMaxim) {
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 1, 0, 0.14 * analogW);
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 0, 1, -0.07 * analogW);
        }
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          1,
          0,
          0,
          ((isMaxim ? 0.54 : 0.60) + bob) * analogW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          1,
          0,
          ((isMaxim ? -0.20 : 0.05) + microSway) * analogW,
        );
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, (isMaxim ? -0.14 : -0.05) * analogW);
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 1, 0, 0, 0.10 * analogW);
      }
    }

    // E. Sprinting With Weapon on top of run.glb (FF_Run_Loop):
    //    - Pistol (HG): right arm stretched downward holding pistol, left arm pumping freely
    //    - Rush SMG (UMP): right arm bent holding SMG pointed UPWARD, left arm pumping freely
    //    - Rifle / SG / SR (XM8/M4A1/SCAR/AK/M1014/AWM): two-handed stationary chest-cradled hold with subtle micro-sway
    const sprintW =
      this.sprintCarryBlend * (1 - this.combatUpperBlend) * (1 - this.bandageBlend);
    const isSmgRushSprint = input.weaponCategory === 'SMG';
    const isPistolSprint = input.weaponCategory === 'HG';
    if (sprintW > 0.01 && rig.adamUpperBones && aimQuats) {
      const sprintBob = stepBounce * 0.007;
      const sprintMicroSway = sway * 0.008;

      if (isPistolSprint) {
        slerpArmBones(
          rig.adamUpperBones,
          aimQuats,
          sprintW,
          false,
          'rightOnly',
          (isMaxim ? 0.50 : 0.20) * sprintW,
        );
        vis.updateMatrixWorld(true);
        vis.getWorldQuaternion(_qVisW);

        // Stretch right arm downward beside hip while running + left arm swings naturally
        if (isMaxim) {
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 1, 0, 0.14 * sprintW);
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 0, 1, -0.07 * sprintW);
        }
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          1,
          0,
          0,
          ((isMaxim ? 0.88 : 0.94) + stepBounce * 0.015) * sprintW,
        );
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 1, 0, (isMaxim ? -0.24 : -0.08) * sprintW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, (isMaxim ? -0.24 : -0.15) * sprintW);
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 1, 0, 0, 0.22 * sprintW);
      } else if (isSmgRushSprint) {
        slerpArmBones(
          rig.adamUpperBones,
          aimQuats,
          sprintW,
          false,
          'rightOnly',
          (isMaxim ? 0.56 : 0.25) * sprintW,
        );
        vis.updateMatrixWorld(true);
        vis.getWorldQuaternion(_qVisW);

        // Rush SMG (UMP): hold upward with one arm (right forearm raised ~40°), left arm swinging freely
        if (isMaxim) {
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 1, 0, 0.16 * sprintW);
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 0, 1, -0.09 * sprintW);
        }
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          1,
          0,
          0,
          ((isMaxim ? 0.20 : 0.34) + stepBounce * 0.012) * sprintW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          1,
          0,
          (isMaxim ? -0.34 : -0.06) * sprintW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          0,
          1,
          (isMaxim ? -0.28 : -0.14) * sprintW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamLowerArmRBone,
          1,
          0,
          0,
          (isMaxim ? -0.68 : -0.82) * sprintW,
        );
        rotateBoneCharAxis(_qVisW, rig.adamHandRBone, 1, 0, 0, -0.22 * sprintW);
      } else {
        // AR / XM8 / SG / SR: two-handed stationary chest hold with minimal living micro-bob/sway
        slerpArmBones(
          rig.adamUpperBones,
          aimQuats,
          sprintW,
          false,
          'all',
          (isMaxim ? 0.78 : 0.65) * sprintW,
        );
        vis.updateMatrixWorld(true);
        vis.getWorldQuaternion(_qVisW);

        rotateBoneCharAxis(
          _qVisW,
          rig.adamSpineBone,
          0,
          1,
          0,
          (0.11 + sprintMicroSway) * sprintW,
        );
        if (isMaxim) {
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 1, 0, 0.16 * sprintW);
          rotateBoneCharAxis(_qVisW, rig.adamRightShoulderBone, 0, 0, 1, -0.08 * sprintW);
          rotateBoneCharAxis(_qVisW, rig.adamLeftShoulderBone, 0, 1, 0, -0.06 * sprintW);
        }
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          1,
          0,
          0,
          ((isMaxim ? 0.18 : 0.30) + sprintBob) * sprintW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          1,
          0,
          ((isMaxim ? -0.28 : 0.15) + sprintMicroSway) * sprintW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          0,
          1,
          (isMaxim ? -0.18 : -0.07) * sprintW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamLowerArmRBone,
          1,
          0,
          0,
          (isMaxim ? -0.03 : -0.09) * sprintW,
        );
      }
    }

    // Unified 2-bone analytical Left-Arm IK pass locking left palm onto weapon handguard/grip
    const isOneHandedSprint = isPistolSprint || isSmgRushSprint;
    const leftHandLockW = Math.min(
      1,
      combatW + idleW + crouchLowW + analogW + (isOneHandedSprint ? 0 : sprintW),
    );
    if (leftHandLockW > 0.01 && hasWeapon && !input.isHealing && !input.isReviving && !input.isReloading) {
      solveTwoBoneLeftArmIK(vis, rig, rig.activeWeaponId, input.weaponCategory, leftHandLockW);
    }

    // F. Unarmed slow jog arm pump (sprint unarmed uses FF_Run_Loop directly without arm overrides)
    const unarmedW = this.unarmedRunBlend * (1 - this.bandageBlend);
    if (unarmedW > 0.01 && rig.adamUpperBones && aimQuats) {
      slerpArmBones(rig.adamUpperBones, aimQuats, 0.88 * unarmedW, false);
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);

      const pumpAmp = input.isSprinting ? 0.56 : 0.36;
      const pump = sway * pumpAmp;
      rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 0, 1, 0, -sway * 0.05 * unarmedW);

      rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, (1.14 + pump) * unarmedW);
      rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, -0.14 * unarmedW);
      rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 1, 0, 0.12 * unarmedW);
      rotateBoneCharAxis(
        _qVisW,
        rig.adamLowerArmRBone,
        1,
        0,
        0,
        (-1.38 - Math.max(0, -pump) * 0.25) * unarmedW,
      );

      rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, (1.14 - pump) * unarmedW);
      rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, 0.14 * unarmedW);
      rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 1, 0, -0.12 * unarmedW);
      rotateBoneCharAxis(
        _qVisW,
        rig.adamLowerArmLBone,
        1,
        0,
        0,
        (-1.38 - Math.max(0, pump) * 0.25) * unarmedW,
      );
    }

    // G. Medkit / Bandage wrapping animation ("colocando faixa branca")
    const bW = this.bandageBlend;
    if (bW > 0.01 && rig.adamUpperBones && aimQuats) {
      for (let i = 0; i < rig.adamUpperBones.length; i++) {
        const entry = rig.adamUpperBones[i];
        const targetQ = aimQuats[entry.name];
        if (!targetQ) continue;
        const isHeadOrNeck = entry.name === 'mixamorigHead' || entry.name === 'mixamorigNeck';
        const isSpine = entry.name.startsWith('mixamorigSpine');
        const boneBlend = isHeadOrNeck ? 0.25 : isSpine ? 0.35 : 0.85;
        entry.bone.quaternion.slerp(targetQ, boneBlend * bW);
      }

      const wrapSin = Math.sin(this.bandagePhase);
      const wrapCos = Math.cos(this.bandagePhase);
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);

      if (rig.adamSpineBone) {
        rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 0, 1, 0, (0.14 + wrapCos * 0.04) * bW);
      }
      if (rig.adamHeadBone) {
        rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, (0.22 + wrapSin * 0.03) * bW);
      }
      if (rig.adamUpperArmLBone) {
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, 0.42 * bW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 1, 0, -0.22 * bW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, -0.18 * bW);
      }
      if (rig.adamLowerArmLBone) {
        rotateBoneCharAxis(
          _qVisW,
          rig.adamLowerArmLBone,
          0,
          1,
          0,
          (0.34 + wrapSin * 0.11) * bW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamLowerArmLBone,
          1,
          0,
          0,
          (-0.18 + wrapCos * 0.06) * bW,
        );
      }
      if (rig.adamUpperArmRBone) {
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          1,
          0,
          0,
          (0.34 - wrapCos * 0.28) * bW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          1,
          0,
          (0.28 + wrapSin * 0.24) * bW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamUpperArmRBone,
          0,
          0,
          1,
          (0.12 + wrapCos * 0.14) * bW,
        );
      }
      if (rig.adamLowerArmRBone) {
        rotateBoneCharAxis(
          _qVisW,
          rig.adamLowerArmRBone,
          1,
          0,
          0,
          (-0.28 + wrapCos * 0.42) * bW,
        );
        rotateBoneCharAxis(
          _qVisW,
          rig.adamLowerArmRBone,
          0,
          1,
          0,
          (-0.18 + wrapSin * 0.36) * bW,
        );
      }
      if (rig.adamHandRBone) {
        rotateBoneCharAxis(_qVisW, rig.adamHandRBone, 0, 0, 1, wrapSin * 0.45 * bW);
        rotateBoneCharAxis(_qVisW, rig.adamHandRBone, 1, 0, 0, wrapCos * 0.22 * bW);
      }
    }

    // H. Athletic FF 2017 jump pose
    if (this.jumpPoseBlend > 0.01) {
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      const jW = this.jumpPoseBlend;
      if (rig.adamThighLBone) rotateBoneCharAxis(_qVisW, rig.adamThighLBone, 1, 0, 0, -0.46 * jW);
      if (rig.adamShinLBone) rotateBoneCharAxis(_qVisW, rig.adamShinLBone, 1, 0, 0, 0.78 * jW);
      if (rig.adamThighRBone) rotateBoneCharAxis(_qVisW, rig.adamThighRBone, 1, 0, 0, 0.14 * jW);
      if (rig.adamShinRBone) rotateBoneCharAxis(_qVisW, rig.adamShinRBone, 1, 0, 0, 0.42 * jW);

      if (isAirborne && !isCombatActive && !this.jumpCancelled && !input.isReloading) {
        if (rig.adamUpperArmLBone) {
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, 0.52 * jW);
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, -0.34 * jW);
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 1, 0, 0.12 * jW);
        }
        if (rig.adamLowerArmLBone) {
          rotateBoneCharAxis(_qVisW, rig.adamLowerArmLBone, 1, 0, 0, -1.05 * jW);
          rotateBoneCharAxis(_qVisW, rig.adamLowerArmLBone, 0, 1, 0, -0.22 * jW);
        }
        if (rig.adamUpperArmRBone) {
          rotateBoneCharAxis(
            _qVisW,
            rig.adamUpperArmRBone,
            0,
            0,
            1,
            (hasWeapon ? -0.42 : -0.52) * jW,
          );
          rotateBoneCharAxis(
            _qVisW,
            rig.adamUpperArmRBone,
            1,
            0,
            0,
            (hasWeapon ? -0.48 : -0.34) * jW,
          );
          rotateBoneCharAxis(
            _qVisW,
            rig.adamUpperArmRBone,
            0,
            1,
            0,
            (hasWeapon ? -0.08 : -0.12) * jW,
          );
        }
        if (rig.adamLowerArmRBone) {
          rotateBoneCharAxis(
            _qVisW,
            rig.adamLowerArmRBone,
            1,
            0,
            0,
            (hasWeapon ? -0.92 : -1.05) * jW,
          );
          rotateBoneCharAxis(
            _qVisW,
            rig.adamLowerArmRBone,
            0,
            1,
            0,
            (hasWeapon ? 0.16 : 0.22) * jW,
          );
        }
      }
    }

    // I. Natural upright human torso posture across FF_Run_Loop, crouch, and idle
    const isUsingFFRun = rig.activeClipName === 'FF_Run_Loop';
    const desiredFwdLean = isCrouch
      ? 0.14
      : isAirborne
        ? 0.16
        : isMoving
          ? input.isSprinting
            ? hasWeapon
              ? 0.17
              : 0.19
            : 0.11
          : 0.05;
    this.spineFwdTarget = THREE.MathUtils.damp(this.spineFwdTarget, desiredFwdLean, 65, dt);
    const spineBaseBone =
      rig.adamSpineBaseBone ?? rig.adamUpperBones?.[0]?.bone ?? rig.adamSpineBone;
    const torsoTopBone = rig.adamUpperBones?.[3]?.bone ?? rig.adamHeadBone;
    if (spineBaseBone && torsoTopBone && !input.isReviving) {
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      _qInvVisW.copy(_qVisW).invert();
      spineBaseBone.getWorldPosition(_pBaseW);
      torsoTopBone.getWorldPosition(_pTopW);
      _dChar.copy(_pTopW).sub(_pBaseW).applyQuaternion(_qInvVisW);
      if (_dChar.lengthSq() > 1e-4) {
        const fwdLean = Math.atan2(_dChar.z, Math.max(0.05, _dChar.y));
        const sideLean = Math.atan2(_dChar.x, Math.max(0.05, _dChar.y));
        const leanDiff = fwdLean - this.spineFwdTarget;
        const leanCorrFactor = isCrouch
          ? 0.90
          : isUsingFFRun
            ? 0.90
            : !isMoving
              ? 0.28
              : leanDiff > 0
                ? 0.85
                : 0.55;
        rotateBoneCharAxis(_qVisW, spineBaseBone, 1, 0, 0, -leanDiff * leanCorrFactor);
        rotateBoneCharAxis(
          _qVisW,
          spineBaseBone,
          0,
          0,
          1,
          sideLean * (isMoving ? 0.22 : 0.08) - (isMoving ? localX * 0.03 : 0),
        );
      }
    }

    const pitchTilt =
      (isCombatActive || isCrouchPunching) && !input.isHealing
        ? -input.pitchRad * 0.35 - this.recoil * 0.1
        : 0;
    if (Math.abs(pitchTilt) > 1e-4) {
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 1, 0, 0, pitchTilt);
    }

    // Measure actual head gaze direction via headMountQuat so head looks straight ahead naturally in every clip
    const modelPack = getModelAssetPack(rig.skinBundleId ?? rig.modelId ?? 'adam');
    if (modelPack && rig.adamHeadBone && !input.isReviving && !input.isHealing) {
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      _qInvVisW.copy(_qVisW).invert();
      rig.adamHeadBone.getWorldQuaternion(_qHeadW);
      _headFwdChar
        .set(0, 0, 1)
        .applyQuaternion(modelPack.headMountQuat)
        .applyQuaternion(_qHeadW)
        .applyQuaternion(_qInvVisW);
      if (_headFwdChar.lengthSq() > 1e-4) {
        const curHeadPitch = Math.atan2(_headFwdChar.y, Math.max(0.1, _headFwdChar.z));
        const targetHeadPitch = input.pitchRad * 0.25 - (isCrouch ? 0.02 : 0.015);
        const headCorr = THREE.MathUtils.clamp(targetHeadPitch - curHeadPitch, -0.65, 0.65);
        if (Math.abs(headCorr) > 1e-3) {
          rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, -headCorr * 0.88);
        }
      }
    } else if (!input.isHealing) {
      const fallbackHead = -input.pitchRad * 0.22 + (isCrouch ? -0.12 : 0);
      if (Math.abs(fallbackHead) > 1e-4) {
        vis.updateMatrixWorld(true);
        vis.getWorldQuaternion(_qVisW);
        rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, fallbackHead);
      }
    }

    // Align crouched aiming/moving barrel straight along camera sightline and keep left hand locked via IK
    if (
      isCrouch &&
      hasWeapon &&
      combatW > 0.05 &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading
    ) {
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      _qInvVisW.copy(_qVisW).invert();
      rig.weaponMount.getWorldQuaternion(_qMountW);
      _barrelChar.set(0, 0, 1).applyQuaternion(_qMountW).applyQuaternion(_qInvVisW);
      if (_barrelChar.lengthSq() > 1e-4) {
        const curYaw = Math.atan2(_barrelChar.x, Math.max(0.1, _barrelChar.z));
        const curPitch = Math.atan2(
          _barrelChar.y,
          Math.max(0.1, Math.hypot(_barrelChar.x, _barrelChar.z)),
        );
        const targetPitch = THREE.MathUtils.clamp(input.pitchRad * 0.72, -0.55, 0.55);
        const yawCorr = THREE.MathUtils.clamp(-curYaw, -0.55, 0.55) * 0.88 * combatW;
        const pitchCorr = THREE.MathUtils.clamp(curPitch - targetPitch, -0.55, 0.55) * 0.88 * combatW;
        if (Math.abs(yawCorr) > 1e-3) {
          rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 0, 1, 0, yawCorr);
        }
        if (Math.abs(pitchCorr) > 1e-3) {
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, pitchCorr);
        }
        if (leftHandLockW > 0.01) {
          solveTwoBoneLeftArmIK(vis, rig, rig.activeWeaponId, input.weaponCategory, leftHandLockW);
        }
      }
    }

    // J. Over-the-shoulder weapon draw pose
    const drawReach =
      hasWeapon && this.drawTimer > 0 && !input.isHealing && !input.isReviving && !input.isReloading
        ? applyAdamOverBackDraw(
            vis,
            rig.adamUpperBones,
            this.drawTimer,
            rig.skinBundleId ?? rig.modelId ?? 'adam',
          )
        : 0;
    if (!rig.weaponMount.userData.baseMountQuat) {
      rig.weaponMount.userData.baseMountQuat = rig.weaponMount.quaternion.clone();
    }
    const baseMountQ = rig.weaponMount.userData.baseMountQuat as THREE.Quaternion;
    rig.weaponMount.quaternion.copy(baseMountQ);
    if (drawReach > 0.005) {
      rig.weaponMount.rotateX(0.55 * drawReach);
    }
  }

  public update(rig: CharacterRig, input: CharacterAnimInput): void {
    const dt = input.dt;
    this.idleTime += dt;
    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 48, dt);
    this.fireHold = Math.max(0, this.fireHold - dt);
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.drawTimer = Math.max(0, this.drawTimer - dt);
    this.hitFlash = THREE.MathUtils.damp(this.hitFlash, 0, 28, dt);
    this.hitStagger = THREE.MathUtils.damp(this.hitStagger, 0, 36, dt);
    this.landingDip = THREE.MathUtils.damp(this.landingDip, 0, 45, dt);

    const isMovingNow = input.speed > 0.32;
    if (isMovingNow && input.isGrounded) {
      const freqScale = input.isSprinting
        ? THREE.MathUtils.clamp(input.speed / 8.2, 0.85, 1.3) * 10.8
        : THREE.MathUtils.clamp(input.speed / 8.8, 0.34, 0.62) * 10.8;
      this.runSwayPhase += dt * freqScale;
    } else {
      const restSway = Math.round(this.runSwayPhase / Math.PI) * Math.PI;
      this.runSwayPhase = THREE.MathUtils.damp(this.runSwayPhase, restSway, 40, dt);
    }

    const curMoveInput = Boolean(input.hasMoveInput ?? isMovingNow);
    const hasWeaponNow = input.hasWeapon ?? true;
    const isCombatNow =
      hasWeaponNow &&
      !input.isHealing &&
      !input.isReloading &&
      (input.isAiming || input.isFiring || this.fireHold > 0.08 || this.recoil > 0.05);

    if (
      !input.isGrounded &&
      !input.isOnSurfboard &&
      !input.isSkydiving &&
      !input.isParachuting &&
      !input.isSwimming
    ) {
      if (this.wasGrounded) {
        this.airTime = 0;
        this.jumpStartMoving = curMoveInput;
        this.jumpCancelled = isCombatNow;
      } else {
        this.airTime += dt;
        if (isCombatNow || curMoveInput !== this.jumpStartMoving) {
          this.jumpCancelled = true;
        }
      }
    } else {
      this.airTime = 0;
      this.jumpCancelled = false;
    }
    this.wasGrounded = input.isGrounded;
    const isCrouchInput = input.stance === 'crouch';
    this.crouchFast = isCrouchInput || this.wasCrouch;
    this.wasCrouch = isCrouchInput;

    const turnRate = input.turnDeltaRad ?? 0;
    this.turnBank = THREE.MathUtils.damp(
      this.turnBank,
      THREE.MathUtils.clamp(turnRate * 4.5, -0.22, 0.22),
      40,
      dt,
    );

    if (input.isReloading) {
      this.reloadPhase += dt * 9.5;
    } else {
      this.reloadPhase = THREE.MathUtils.damp(this.reloadPhase, 0, 45, dt);
    }

    if (input.isHealing) {
      this.bandagePhase += dt * 7.2;
    }
    this.bandageBlend = THREE.MathUtils.damp(
      this.bandageBlend,
      input.isHealing ? 1 : 0,
      70,
      dt,
    );
    const showBandage =
      Boolean(input.isHealing) &&
      !input.isDead &&
      !input.isDriving &&
      !input.isSkydiving &&
      !input.isParachuting &&
      !input.isDowned &&
      !(input.isSwimming && !input.isOnSurfboard);
    rig.setBandageVisible?.(showBandage);

    rig.setHitFlash(this.hitFlash);

    if (rig.isAdam) {
      this.updateAdamRig(rig, input);
      return;
    }

    // Fallback Procedural Rig (FF 2017 postures mirrored cleanly)
    rig.muzzleFlash.visible =
      this.recoil > 0.55 && (input.hasWeapon ?? true) && !input.isDead && !input.isDriving;
    if (rig.muzzleFlash.visible) {
      rig.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.5;
      rig.muzzleFlash.scale.set(s, s, s);
    }

    if (input.isDead) {
      this.deathProgress = Math.min(1, this.deathProgress + dt * 2.4);
      const ease = 1 - Math.pow(1 - this.deathProgress, 2);
      rig.pelvis.position.y = THREE.MathUtils.lerp(0.92, 0.2, ease);
      rig.pelvis.rotation.x = THREE.MathUtils.lerp(0, -Math.PI * 0.46, ease);
      rig.pelvis.rotation.z = THREE.MathUtils.lerp(0, 0.25, ease);
      rig.leftShoulder.rotation.set(-0.4 * ease, 0, 0.7 * ease);
      rig.rightShoulder.rotation.set(-0.2 * ease, 0, -0.8 * ease);
      rig.leftHip.rotation.set(0.25 * ease, 0, 0.15 * ease);
      rig.rightHip.rotation.set(0.1 * ease, 0, -0.2 * ease);
      return;
    }

    if (input.isDriving) {
      rig.setParachuteVisible(false);
      rig.contactShadow.visible = false;
      const steer = this.turnBank * 1.4;
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.55, 16, dt);
      rig.pelvis.rotation.set(-0.08, 0, -this.turnBank * 0.35);
      rig.torso.rotation.set(0.14, 0, -this.turnBank * 0.35);
      rig.headGroup.rotation.set(-0.08, steer * 0.3, 0);
      rig.leftShoulder.rotation.set(-1.12 + steer * 0.25, 0.22, 0.14);
      rig.rightShoulder.rotation.set(-1.12 - steer * 0.25, -0.22, -0.14);
      rig.leftElbow.rotation.set(-0.65, 0, 0);
      rig.rightElbow.rotation.set(-0.65, 0, 0);
      rig.leftHip.rotation.set(-1.25, 0, 0.08);
      rig.rightHip.rotation.set(-1.25, 0, -0.08);
      rig.leftKnee.rotation.set(1.35, 0, 0);
      rig.rightKnee.rotation.set(1.35, 0, 0);
      return;
    }

    if (input.isSkydiving) {
      rig.setParachuteVisible(false);
      rig.contactShadow.visible = false;
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.92, 10, dt);
      rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 1.32, 8, dt);
      rig.pelvis.rotation.z = Math.sin(this.idleTime * 5) * 0.08 + this.turnBank;
      rig.torso.rotation.set(-0.2, 0, 0);
      rig.headGroup.rotation.set(-0.45, 0, 0);
      rig.leftShoulder.rotation.set(-0.3, 0, 1.15 + Math.sin(this.idleTime * 8) * 0.1);
      rig.rightShoulder.rotation.set(-0.3, 0, -1.15 - Math.sin(this.idleTime * 8) * 0.1);
      rig.leftElbow.rotation.set(-0.45, 0, 0);
      rig.rightElbow.rotation.set(-0.45, 0, 0);
      rig.leftHip.rotation.set(0.25, 0, 0.25);
      rig.rightHip.rotation.set(0.25, 0, -0.25);
      rig.leftKnee.rotation.set(0.45, 0, 0);
      rig.rightKnee.rotation.set(0.45, 0, 0);
      return;
    }

    if (input.isParachuting) {
      rig.setParachuteVisible(true);
      rig.contactShadow.visible = false;
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.92, 10, dt);
      rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 0.08, 8, dt);
      rig.pelvis.rotation.z = Math.sin(this.idleTime * 2.2) * 0.05 + this.turnBank * 0.6;
      rig.torso.rotation.set(0, 0, 0);
      rig.headGroup.rotation.set(0.1, 0, 0);
      rig.leftShoulder.rotation.set(-2.55, 0, 0.35);
      rig.rightShoulder.rotation.set(-2.55, 0, -0.35);
      rig.leftElbow.rotation.set(-0.35, 0, 0);
      rig.rightElbow.rotation.set(-0.35, 0, 0);
      rig.leftHip.rotation.set(-0.35 + Math.sin(this.idleTime * 2.4) * 0.1, 0, 0.05);
      rig.rightHip.rotation.set(-0.2 + Math.cos(this.idleTime * 2.4) * 0.1, 0, -0.05);
      rig.leftKnee.rotation.set(0.65, 0, 0);
      rig.rightKnee.rotation.set(0.55, 0, 0);
      return;
    }

    rig.setParachuteVisible(false);
    rig.setSurfboardVisible(Boolean(input.isOnSurfboard));
    rig.contactShadow.visible = input.isGrounded && !input.isSwimming && !input.isOnSurfboard;

    if (input.isOnSurfboard) {
      const waveBob = Math.sin(this.idleTime * 4.4) * 0.024;
      rig.surfboardGroup.position.set(0, 0.02 + waveBob, 0);
      rig.surfboardGroup.rotation.set(
        input.speed > 0.35 ? -0.055 : 0.015,
        0,
        -this.turnBank * 0.85,
      );
    }

    if (input.isSwimming && !input.isOnSurfboard) {
      const swimStroke = Math.sin(this.idleTime * 6.5);
      const kick = Math.sin(this.idleTime * 9.5);
      const isSwMoving = input.speed > 0.35;
      rig.pelvis.position.y = THREE.MathUtils.damp(
        rig.pelvis.position.y,
        isSwMoving ? 0.52 : 0.72,
        10,
        dt,
      );
      rig.pelvis.rotation.x = THREE.MathUtils.damp(
        rig.pelvis.rotation.x,
        isSwMoving ? 1.44 : 0.12,
        10,
        dt,
      );
      rig.pelvis.rotation.z = swimStroke * (isSwMoving ? 0.14 : 0.04) - this.turnBank * 0.4;
      rig.torso.rotation.set(isSwMoving ? -0.26 : 0, 0, 0);
      rig.headGroup.rotation.set(isSwMoving ? -0.88 : -0.1, 0, 0);
      rig.leftShoulder.rotation.set(
        isSwMoving ? -2.2 + swimStroke * 1.1 : -0.45,
        0,
        isSwMoving ? 0.28 : 0.52,
      );
      rig.rightShoulder.rotation.set(
        isSwMoving ? -2.2 - swimStroke * 1.1 : -0.45,
        0,
        isSwMoving ? -0.28 : -0.52,
      );
      rig.leftElbow.rotation.set(-0.3, 0, 0);
      rig.rightElbow.rotation.set(-0.3, 0, 0);
      rig.leftHip.rotation.set(kick * (isSwMoving ? 0.34 : 0.22), 0, 0.08);
      rig.rightHip.rotation.set(-kick * (isSwMoving ? 0.34 : 0.22), 0, -0.08);
      rig.leftKnee.rotation.set(0.14, 0, 0);
      rig.rightKnee.rotation.set(0.14, 0, 0);
      return;
    }

    if (input.isLobby) {
      const breath = Math.sin(this.idleTime * 2.0);
      rig.pelvis.position.y = 0.92 + breath * 0.008;
      rig.pelvis.rotation.set(0, 0.08, 0);
      rig.torso.rotation.set(
        0.02 + breath * 0.015,
        -0.06 + Math.sin(this.idleTime * 0.7) * 0.03,
        0,
      );
      rig.headGroup.rotation.set(breath * 0.02, 0.08 - Math.sin(this.idleTime * 0.7) * 0.04, 0);
      rig.leftShoulder.rotation.set(0.08 + breath * 0.02, 0, 0.14);
      rig.leftElbow.rotation.set(-0.22, 0, 0);
      rig.rightShoulder.rotation.set(0.12 - breath * 0.02, 0, -0.14);
      rig.rightElbow.rotation.set(-0.3, 0, 0);
      rig.leftHip.rotation.set(-0.04, 0, 0.06);
      rig.leftKnee.rotation.set(0.08, 0, 0);
      rig.rightHip.rotation.set(0.04, 0, -0.06);
      rig.rightKnee.rotation.set(0.05, 0, 0);
      return;
    }

    const isMoving = input.speed > 0.32;
    const isBackpedal = isMoving && (input.moveLocalZ ?? 1) < -0.28;
    const phaseDir = isBackpedal ? -1 : 1;
    if (isMoving && input.isGrounded) {
      const speedFactor = THREE.MathUtils.clamp(input.speed / 5.4, 0.45, 1.3);
      const baseFreq = input.isSprinting
        ? 11.2
        : input.stance === 'crouch'
          ? 7.2
          : input.stance === 'prone'
            ? 5.8
            : 8.6;
      this.walkPhase +=
        dt * baseFreq * phaseDir * (input.stance === 'stand' ? speedFactor * 0.88 : 1.0);
    } else {
      const targetRest = Math.round(this.walkPhase / Math.PI) * Math.PI;
      this.walkPhase = THREE.MathUtils.damp(this.walkPhase, targetRest, 10, dt);
    }

    const strideBlend = THREE.MathUtils.clamp((input.speed - 0.25) / 1.8, 0, 1);
    const swing = Math.sin(this.walkPhase) * strideBlend;
    const doubleHarmonic = Math.abs(Math.sin(this.walkPhase)) * strideBlend;
    const breath = Math.sin(this.idleTime * 2.4);

    if (input.isDowned) {
      const crawl = Math.sin(this.walkPhase) * 0.34 * strideBlend;
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.44, 14, dt);
      rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 1.08, 14, dt);
      rig.pelvis.rotation.z = THREE.MathUtils.damp(rig.pelvis.rotation.z, crawl * 0.16, 12, dt);
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, -0.18, 12, dt);
      rig.headGroup.rotation.x = THREE.MathUtils.damp(
        rig.headGroup.rotation.x,
        -0.78 + input.pitchRad * 0.25,
        12,
        dt,
      );
      rig.leftShoulder.rotation.set(-1.12 + crawl, 0, 0.12);
      rig.rightShoulder.rotation.set(-1.12 - crawl, 0, -0.12);
      rig.leftElbow.rotation.set(-0.35, 0, 0);
      rig.rightElbow.rotation.set(-0.35, 0, 0);
      rig.leftHip.rotation.set(-0.35 - crawl * 0.55, 0, 0.12);
      rig.rightHip.rotation.set(-0.35 + crawl * 0.55, 0, -0.12);
      rig.leftKnee.rotation.set(1.25, 0, 0);
      rig.rightKnee.rotation.set(1.25, 0, 0);
      return;
    }

    if (input.stance === 'prone') {
      const crawl = Math.sin(this.walkPhase) * 0.28 * strideBlend;
      const posL = Math.max(0, crawl);
      const posR = Math.max(0, -crawl);
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.18, 65, dt);
      rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 1.48, 65, dt);
      rig.pelvis.rotation.z = THREE.MathUtils.damp(rig.pelvis.rotation.z, crawl * 0.14, 55, dt);
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, -0.34, 55, dt);
      rig.headGroup.rotation.x = THREE.MathUtils.damp(
        rig.headGroup.rotation.x,
        -0.78 + input.pitchRad * 0.28,
        55,
        dt,
      );
      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(
        rig.rightShoulder.rotation.x,
        -1.58 - this.recoil * 0.16,
        75,
        dt,
      );
      rig.rightShoulder.rotation.y = 0.14;
      rig.rightShoulder.rotation.z = -0.14;
      rig.rightElbow.rotation.set(-0.85, 0, 0);
      rig.leftShoulder.rotation.set(-1.52 + crawl * 0.8, -0.22, 0.16);
      rig.leftElbow.rotation.set(-0.85, 0, 0);
      rig.leftHip.rotation.set(-posL * 0.45, 0, 0.11 + posL * 0.22);
      rig.rightHip.rotation.set(-posR * 0.45, 0, -0.11 - posR * 0.22);
      rig.leftKnee.rotation.set(0.14 + posL * 0.65, 0, 0);
      rig.rightKnee.rotation.set(0.14 + posR * 0.65, 0, 0);
      return;
    }

    if (input.isVaulting) {
      const p = THREE.MathUtils.clamp(input.vaultProgress ?? 0.5, 0, 1);
      const plantEnv = Math.sin(Math.min(1, p / 0.88) * Math.PI);
      const swingEnv = Math.sin(Math.pow(p, 0.82) * Math.PI);
      rig.pelvis.position.y = 1.02 + 0.14 * swingEnv;
      rig.pelvis.rotation.set(0.28 * plantEnv, 0, -0.52 * plantEnv);
      rig.torso.rotation.set(0.14 * plantEnv, -0.24 * plantEnv, 0);
      rig.headGroup.rotation.set(-0.28 * plantEnv, 0, 0);
      rig.leftShoulder.rotation.set(-0.95 * plantEnv, 0, 0.34 * plantEnv);
      rig.leftElbow.rotation.set(-0.18 * plantEnv, 0, 0);
      rig.rightShoulder.rotation.set(-0.55 * plantEnv, 0.16, -0.42 * plantEnv);
      rig.rightElbow.rotation.set(-0.78 * plantEnv, 0, 0);
      rig.leftHip.rotation.set(-1.08 * swingEnv, 0, -0.32 * swingEnv);
      rig.leftKnee.rotation.set(1.36 * swingEnv, 0, 0);
      rig.rightHip.rotation.set(-0.92 * swingEnv, 0, -0.4 * swingEnv);
      rig.rightKnee.rotation.set(1.22 * swingEnv, 0, 0);
      return;
    }

    const isCrouch = input.stance === 'crouch';
    const crouchRate = 85;
    const landCompression = this.landingDip * (isCrouch ? 0.08 : 0.16);
    const bobAmp = input.isSprinting ? 0.056 : isCrouch ? 0.025 : 0.03;
    const targetPelvisY = isCrouch
      ? 0.59 + doubleHarmonic * bobAmp - landCompression
      : !input.isGrounded
        ? 0.96
        : 0.92 +
          doubleHarmonic * bobAmp +
          (1 - strideBlend) * breath * 0.008 -
          landCompression;

    rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, targetPelvisY, crouchRate, dt);
    rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 0, crouchRate, dt);
    rig.pelvis.rotation.y = THREE.MathUtils.damp(
      rig.pelvis.rotation.y,
      isMoving && !input.isAiming ? swing * (input.isSprinting ? 0.08 : 0.05) : 0,
      55,
      dt,
    );
    rig.pelvis.rotation.z = THREE.MathUtils.damp(rig.pelvis.rotation.z, 0, 55, dt);

    const procTorsoLean =
      (isCrouch ? 0.13 : input.isSprinting ? 0.16 : isMoving ? 0.10 : 0.04) +
      this.landingDip * 0.06;
    rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, procTorsoLean, crouchRate, dt);
    rig.torso.rotation.y = THREE.MathUtils.damp(
      rig.torso.rotation.y,
      input.isHealing
        ? Math.cos(this.bandagePhase) * 0.06
        : input.isReviving
          ? Math.sin(this.idleTime * 5.2) * 0.12
          : input.isAiming
            ? -0.14
            : isMoving && input.isSprinting
              ? -swing * 0.05
              : 0,
      70,
      dt,
    );
    rig.torso.rotation.z = THREE.MathUtils.damp(
      rig.torso.rotation.z,
      isMoving ? -(input.moveLocalX ?? 0) * 0.035 : 0,
      55,
      dt,
    );
    rig.headGroup.rotation.x = THREE.MathUtils.damp(
      rig.headGroup.rotation.x,
      input.isHealing || input.isReviving ? 0.2 : input.pitchRad * 0.35 - (isCrouch ? 0.16 : 0),
      crouchRate,
      dt,
    );
    rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, 0, 55, dt);

    const procAirborne =
      !input.isGrounded && !input.isOnSurfboard && !input.isHealing && !input.isReviving;

    if (procAirborne) {
      const airBend = isCombatNow || this.jumpCancelled ? 0.3 : 1.0;
      rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, -0.46 * airBend, 18, dt);
      rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, 0.78 * airBend, 18, dt);
      rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, 0.12 * airBend, 18, dt);
      rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, 0.38 * airBend, 18, dt);
    } else if (isCrouch || (input.isReviving && !isMoving)) {
      const stride = swing * 0.44;
      rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, -0.82 + stride, crouchRate, dt);
      rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, 1.30 - stride * 0.3, crouchRate, dt);
      rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, -0.82 - stride, crouchRate, dt);
      rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, 1.30 + stride * 0.3, crouchRate, dt);
    } else {
      const legAmp = input.isSprinting ? 0.96 : 0.58;
      const lAngle = swing * legAmp - this.landingDip * 0.42;
      const rAngle = -swing * legAmp - this.landingDip * 0.42;
      rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, lAngle, crouchRate, dt);
      rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, rAngle, crouchRate, dt);

      const lKneeFlex = lAngle > 0 ? lAngle * 1.05 + 0.14 : Math.max(0.08, -lAngle * 0.45 + 0.12);
      const rKneeFlex = rAngle > 0 ? rAngle * 1.05 + 0.14 : Math.max(0.08, -rAngle * 0.45 + 0.12);
      rig.leftKnee.rotation.x = THREE.MathUtils.damp(
        rig.leftKnee.rotation.x,
        lKneeFlex + this.landingDip * 0.75,
        crouchRate,
        dt,
      );
      rig.rightKnee.rotation.x = THREE.MathUtils.damp(
        rig.rightKnee.rotation.x,
        rKneeFlex + this.landingDip * 0.75,
        crouchRate,
        dt,
      );
    }

    if (input.isHealing || input.isReviving) {
      const wrapS = Math.sin(this.bandagePhase);
      const wrapC = Math.cos(this.bandagePhase);
      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.92 + wrapC * 0.28, 22, dt);
      rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.48 + wrapS * 0.26, 22, dt);
      rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.22 - wrapC * 0.12, 22, dt);
      rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -1.25 + wrapC * 0.34, 22, dt);

      rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.82, 20, dt);
      rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.58 - wrapS * 0.08, 20, dt);
      rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.24, 20, dt);
      rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -1.18 + wrapS * 0.08, 20, dt);
      return;
    }

    if (input.isReloading) {
      const magSwap = Math.sin(this.reloadPhase) * 0.28;
      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.95, 18, dt);
      rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.28, 18, dt);
      rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.1, 18, dt);
      rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -0.75, 18, dt);

      rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -1.08 + magSwap, 20, dt);
      rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.52, 18, dt);
      rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.16, 18, dt);
      rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -0.95 - magSwap * 0.6, 20, dt);
      return;
    }

    const hasWeapon = input.hasWeapon ?? true;
    const pitchInfluence = input.pitchRad * 0.55;
    const isAirborneWingJump =
      procAirborne && this.jumpPoseBlend > 0.05 && !isCombatNow && !this.jumpCancelled;

    if (!hasWeapon) {
      if (isAirborneWingJump) {
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.34, 24, dt);
        rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, -0.12, 24, dt);
        rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.52, 24, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -1.05, 24, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.34, 24, dt);
        rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, 0.12, 24, dt);
        rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.52, 24, dt);
        rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -1.05, 24, dt);
        return;
      }

      if (this.punchTimer > 0) {
        const pNorm = Math.sin((this.punchTimer / 0.34) * Math.PI);
        const rPunch = this.punchSide > 0 ? pNorm : 0;
        const lPunch = this.punchSide < 0 ? pNorm : 0;
        rig.torso.rotation.y += this.punchSide * pNorm * 0.34;
        rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(-0.92, -1.62 + pitchInfluence, rPunch);
        rig.rightShoulder.rotation.y = THREE.MathUtils.lerp(0.18, 0.05, rPunch);
        rig.rightShoulder.rotation.z = -0.14;
        rig.rightElbow.rotation.x = THREE.MathUtils.lerp(-1.45, -0.16, rPunch);

        rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(-0.92, -1.62 + pitchInfluence, lPunch);
        rig.leftShoulder.rotation.y = THREE.MathUtils.lerp(-0.18, -0.05, lPunch);
        rig.leftShoulder.rotation.z = 0.14;
        rig.leftElbow.rotation.x = THREE.MathUtils.lerp(-1.45, -0.16, lPunch);
        return;
      }

      if (input.isSprinting) {
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.45 + swing * 0.9, 18, dt);
        rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.14, 16, dt);
        rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.16, 16, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -1.42, 16, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.45 - swing * 0.9, 18, dt);
        rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.14, 16, dt);
        rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.16, 16, dt);
        rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -1.42, 16, dt);
      } else {
        const idleFist = (1 - strideBlend) * breath * 0.03 + swing * 0.34;
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.56 + idleFist, 18, dt);
        rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.16, 16, dt);
        rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.14, 16, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -1.28, 16, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.62 - idleFist, 18, dt);
        rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.18, 16, dt);
        rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.14, 16, dt);
        rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -1.32, 16, dt);
      }
      return;
    }

    const isLargeWeapon =
      hasWeapon && Boolean(input.weaponCategory && input.weaponCategory !== 'HG');
    const isAirborneWeaponHold =
      !input.isGrounded && !input.isOnSurfboard && hasWeapon && (isCombatNow || this.jumpCancelled);
    const isCrouchPointForward = isCrouch && curMoveInput;
    const isCrouchWeaponDown = isCrouch && !curMoveInput && !input.isAiming && this.recoil < 0.05;
    const aimRaise = isCrouchWeaponDown
      ? -0.62
      : input.isAiming || isAirborneWeaponHold || isCrouchPointForward || this.recoil > 0.05
        ? -1.42
        : !isLargeWeapon
          ? -0.78
          : -1.04;

    if (isAirborneWingJump) {
      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.48, 24, dt);
      rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, -0.08, 24, dt);
      rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.42, 24, dt);
      rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -0.92, 24, dt);

      rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.34, 24, dt);
      rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, 0.12, 24, dt);
      rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.52, 24, dt);
      rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -1.05, 24, dt);
    } else if (input.isSprinting && !input.isAiming && !isAirborneWeaponHold && this.recoil < 0.05) {
      const swayS = Math.sin(this.runSwayPhase);
      const bounce = Math.sin(this.runSwayPhase * 2);
      const microBob = bounce * 0.008;
      const microSway = swayS * 0.008;
      if (input.weaponCategory === 'HG') {
        // Pistol sprint: right arm stretched downward beside thigh, left arm swinging freely
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, 0.14 + bounce * 0.02, 20, dt);
        rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, -0.08, 20, dt);
        rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.15, 20, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -0.18, 20, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.45 - swing * 0.72, 18, dt);
        rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.14, 18, dt);
        rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.16, 18, dt);
        rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -1.35, 18, dt);
      } else if (input.weaponCategory === 'SMG') {
        // SMG sprint: right arm holding UMP upward, left arm swinging freely
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.68 + microBob, 20, dt);
        rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.06, 20, dt);
        rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.14, 20, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -1.65, 20, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.45 - swing * 0.72, 18, dt);
        rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.14, 18, dt);
        rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.16, 18, dt);
        rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -1.35, 18, dt);
      } else {
        // AR / XM8 / SG / SR: two-handed stationary chest hold with minimal micro-motion
        rig.torso.rotation.y += microSway + 0.12;
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -1.04 + microBob, 24, dt);
        rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.18 + microSway, 24, dt);
        rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.07, 24, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -0.40, 24, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.96 + microBob, 24, dt);
        rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.50 + microSway, 24, dt);
        rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.14, 24, dt);
        rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -0.52, 24, dt);
      }
    } else {
      const idleSway = (1 - strideBlend) * breath * 0.004 + swing * 0.006;
      const twoHandJumpDamp = 90;
      const targetElbowR = isCrouchWeaponDown ? -0.70 : -0.38 - this.recoil * 0.12;
      const targetElbowL = isCrouchWeaponDown ? -0.80 : -0.52;
      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(
        rig.rightShoulder.rotation.x,
        aimRaise - this.recoil * 0.24 + (isCrouchWeaponDown ? 0 : pitchInfluence) + idleSway,
        twoHandJumpDamp,
        dt,
      );
      rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.18, 75, dt);
      rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.06, 75, dt);
      rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, targetElbowR, twoHandJumpDamp, dt);

      rig.leftShoulder.rotation.x = THREE.MathUtils.damp(
        rig.leftShoulder.rotation.x,
        aimRaise * 0.92 - this.recoil * 0.18 + (isCrouchWeaponDown ? 0 : pitchInfluence) - idleSway * 0.5,
        twoHandJumpDamp,
        dt,
      );
      rig.leftShoulder.rotation.y = THREE.MathUtils.damp(
        rig.leftShoulder.rotation.y,
        isLargeWeapon ? -0.50 : -0.44,
        75,
        dt,
      );
      rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.14, 75, dt);
      rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, targetElbowL, twoHandJumpDamp, dt);
    }

    if (this.drawTimer > 0) {
      const { reachWeight } = computeWeaponDrawWeights(this.drawTimer);
      rig.torso.rotation.y += -0.26 * reachWeight;
      rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -2.85, reachWeight);
      rig.rightShoulder.rotation.y = THREE.MathUtils.lerp(rig.rightShoulder.rotation.y, -0.32, reachWeight);
      rig.rightShoulder.rotation.z = THREE.MathUtils.lerp(rig.rightShoulder.rotation.z, -0.44, reachWeight);
      rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -1.65, reachWeight);
      rig.weaponMount.rotation.x = 0.45 * reachWeight;
    } else {
      rig.weaponMount.rotation.x = 0;
    }
  }
}
