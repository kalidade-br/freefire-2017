import * as THREE from 'three';
import { FFModelId, getAimPoseQuats } from './adamAssets';
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
  hasWeapon?: boolean;
  hasMoveInput?: boolean;
  weaponCategory?: 'HG' | 'AR' | 'SMG' | 'SG' | 'SR' | null;
  turnDeltaRad?: number;
  pitchRad: number;
}

export const WEAPON_DRAW_DURATION = 0.06;

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
  modelId: FFModelId = 'adam',
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
    // Lift right upper arm straight up & over shoulder, elbow flared slightly out
    rotateBoneCharAxis(_qVisW, rArm, 1, 0, 0, -1.78 * reachWeight);
    rotateBoneCharAxis(_qVisW, rArm, 0, 0, 1, -0.44 * reachWeight);
    rotateBoneCharAxis(_qVisW, rArm, 0, 1, 0, -0.32 * reachWeight);
  }
  if (rForeArm) {
    // Bend forearm deeply behind the right shoulder blade onto the slung weapon
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
  private tacCarryBlend = 0;
  private crouchLowBlend = 0;
  private bandageBlend = 0;
  private bandagePhase = 0;
  private jumpPoseBlend = 0;
  private runSwayPhase = 0;
  private drawTimer = 0;
  private wasGrounded = true;
  private airTime = 0;
  private jumpCancelled = false;
  private jumpStartMoving = false;
  private wasCrouch = false;
  private crouchFast = false;
  private spineFwdTarget = 0.21;

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
    this.tacCarryBlend = 0;
    this.crouchLowBlend = 0;
    this.bandageBlend = 0;
    this.bandagePhase = 0;
    this.jumpPoseBlend = 0;
    this.runSwayPhase = 0;
    this.drawTimer = 0;
    this.wasGrounded = true;
    this.airTime = 0;
    this.jumpCancelled = false;
    this.jumpStartMoving = false;
    this.wasCrouch = false;
    this.crouchFast = false;
    this.spineFwdTarget = 0.21;
  }

  private playAdamClip(
    rig: CharacterRig,
    clipName: string,
    fadeSec = 0.025,
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

  private updateAdamRig(rig: CharacterRig, input: CharacterAnimInput): void {
    const dt = input.dt;
    const vis = rig.adamVisualRoot;
    const mixer = rig.mixer;
    if (!mixer || !vis) return;

    const hasWeapon = input.hasWeapon ?? true;
    const isMoving = input.speed > 0.35;

    rig.muzzleFlash.visible =
      this.recoil > 0.55 && hasWeapon && !input.isDead && !input.isDriving && !input.isDowned;
    if (rig.muzzleFlash.visible) {
      rig.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.5;
      rig.muzzleFlash.scale.set(s, s, s);
    }

    // 1. Death clip
    if (input.isDead) {
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

    // 4b. Swimming in water (without surfboard) — Freestyle horizontal crawl when moving, treading water when idle
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
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, 0.28 + Math.max(0, Math.cos(phaseL)) * 0.42);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, -2.0 + Math.sin(phaseR) * 1.1);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, -0.28 - Math.max(0, Math.cos(phaseR)) * 0.42);
      } else {
        const scull = Math.sin(this.idleTime * 4.2);
        rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, -0.08);
        rotateBoneCharAxis(_qVisW, rig.adamThighLBone, 1, 0, 0, 0.14 + scull * 0.22);
        rotateBoneCharAxis(_qVisW, rig.adamThighRBone, 1, 0, 0, 0.14 - scull * 0.22);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, 0.52 + scull * 0.2);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, -0.45 + Math.cos(this.idleTime * 4.2) * 0.24);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, -0.52 - scull * 0.2);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, -0.45 - Math.cos(this.idleTime * 4.2) * 0.24);
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
        0.03,
        isMoving ? 0.95 : 0.8,
      );
      mixer.update(dt);
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, -0.65);
      return;
    }

    // 6. Prone (Deitado de bruços: barriga e pernas retas no chão, cabeça e arma erguidas à frente)
    if (input.stance === 'prone') {
      if (isMoving) {
        this.walkPhase += dt * 5.8;
      }
      const crawl = isMoving ? Math.sin(this.walkPhase) : 0;
      vis.position.set(0, 0.23, -0.74);
      vis.rotation.set(1.45, 0, crawl * 0.07);
      this.playAdamClip(rig, 'Idle_Loop', 0.025, 0.75);
      mixer.update(dt);
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);

      rotateBoneCharAxis(_qVisW, rig.adamThighLBone, 1, 0, 0, 0.12 + crawl * 0.14);
      rotateBoneCharAxis(_qVisW, rig.adamThighRBone, 1, 0, 0, 0.12 - crawl * 0.14);
      rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 1, 0, 0, -0.58);
      rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, -0.52 + input.pitchRad * 0.28);

      const aimQuats = getAimPoseQuats(rig.modelId ?? 'adam');
      if (hasWeapon && rig.adamUpperBones && aimQuats) {
        for (let i = 0; i < rig.adamUpperBones.length; i++) {
          const entry = rig.adamUpperBones[i];
          if (
            entry.name.endsWith('Shoulder') ||
            entry.name.endsWith('Arm') ||
            entry.name.endsWith('ForeArm') ||
            entry.name.endsWith('Hand')
          ) {
            const targetQ = aimQuats[entry.name];
            if (targetQ) entry.bone.quaternion.copy(targetQ);
          }
        }
        rig.adamSpineBone?.updateMatrixWorld(true);
        rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 1, 0, 0, -this.recoil * 0.08);
      } else {
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, -1.85 + crawl * 0.35);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, 0.28);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, -1.85 - crawl * 0.35);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, -0.28);
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmLBone, 1, 0, 0, -0.65);
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 1, 0, 0, -0.65);
      }
      return;
    }

    // 7. Standing / Crouching / Surfboard Locomotion
    const waveBob = input.isOnSurfboard ? Math.sin(this.idleTime * 4.4) * 0.024 : 0;
    if (input.isOnSurfboard) {
      rig.surfboardGroup.position.set(0, 0.02 + waveBob, 0);
      rig.surfboardGroup.rotation.set(isMoving ? -0.055 : 0.015, 0, -this.turnBank * 0.85);
    }

    vis.position.set(
      0,
      input.isOnSurfboard ? 0.08 + waveBob : -this.landingDip * 0.045,
      0,
    );
    vis.rotation.set(
      input.isOnSurfboard && isMoving ? -0.04 : 0,
      0,
      input.isOnSurfboard && isMoving
        ? -this.turnBank * 0.68
        : isMoving && !input.isOnSurfboard
          ? -this.turnBank * 0.14
          : 0,
    );

    const isCombatActive =
      hasWeapon &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading &&
      (input.isAiming || input.isFiring || this.fireHold > 0.08 || this.recoil > 0.05);

    const curMove = isMoving || Boolean(input.hasMoveInput);

    const isAirborne =
      !input.isGrounded && !input.isOnSurfboard && !input.isHealing && !input.isReviving;
    const isAirborneWeaponHold =
      isAirborne && hasWeapon && !input.isReloading && (isCombatActive || this.jumpCancelled);

    // While crouched with a weapon:
    // - stationary & not aiming/shooting -> hold weapon clearly lowered ("arma baixada")
    // - pulling analog stick / moving -> raise weapon pointing forward ("apontando para frente")
    const crouchAimForward =
      input.stance === 'crouch' &&
      hasWeapon &&
      curMove &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading;
    const wantsCrouchLow =
      input.stance === 'crouch' &&
      hasWeapon &&
      !curMove &&
      !isCombatActive &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading &&
      !input.isOnSurfboard;

    const isLargeWeapon =
      hasWeapon && Boolean(input.weaponCategory && input.weaponCategory !== 'HG');
    const wantsTacCarry =
      isLargeWeapon &&
      isMoving &&
      !isCombatActive &&
      !isAirborne &&
      !input.isHealing &&
      !input.isReviving &&
      !input.isReloading &&
      !input.isOnSurfboard &&
      input.stance === 'stand';

    const lockCombatUpper = isCombatActive || isAirborneWeaponHold || crouchAimForward;
    this.combatUpperBlend = THREE.MathUtils.damp(
      this.combatUpperBlend,
      lockCombatUpper ? 1 : 0,
      lockCombatUpper ? 120 : 85,
      dt,
    );
    this.tacCarryBlend = THREE.MathUtils.damp(
      this.tacCarryBlend,
      wantsTacCarry ? 1 : 0,
      80,
      dt,
    );
    this.crouchLowBlend = THREE.MathUtils.damp(
      this.crouchLowBlend,
      wantsCrouchLow ? 1 : 0,
      95,
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
      95,
      dt,
    );

    const fastCrouchFade = 0.02;
    const fastJumpExitFade = 0.025;

    if (input.isReviving) {
      this.playAdamClip(rig, 'Fixing_Kneeling', 0.03, 1.1);
    } else if (!hasWeapon && this.punchTimer > 0 && !input.isHealing) {
      const punchClip = this.punchSide > 0 ? 'Punch_Jab' : 'Punch_Cross';
      this.playAdamClip(rig, punchClip, 0.02, 1.45, this.punchTimer > 0.31);
    } else if (input.stance === 'crouch') {
      this.playAdamClip(
        rig,
        isMoving ? 'Crouch_Fwd_Loop' : 'Crouch_Idle_Loop',
        0.02,
        isMoving ? THREE.MathUtils.clamp(input.speed / 2.8, 0.85, 1.45) : 1.15,
      );
    } else if (input.isHealing) {
      this.playAdamClip(
        rig,
        isMoving ? 'Jog_Fwd_Loop' : 'Idle_Loop',
        0.025,
        isMoving ? THREE.MathUtils.clamp(input.speed / 5.2, 0.72, 1.28) : 1.0,
      );
    } else if (isAirborne) {
      // Keep erect Idle_Loop base in the air (never run Sprint_Loop/Jog_Fwd_Loop in the sky!)
      this.playAdamClip(rig, 'Idle_Loop', 0.025, 1.0);
    } else if (input.isReloading && hasWeapon) {
      this.playAdamClip(rig, 'Pistol_Reload', 0.025, 1.35);
    } else if (input.isOnSurfboard) {
      if (hasWeapon) {
        if (input.isFiring || this.recoil > 0.25 || this.fireHold > 0.22) {
          this.playAdamClip(rig, 'Pistol_Shoot', 0.02, 1.35);
        } else if (input.isAiming || isCombatActive) {
          this.playAdamClip(rig, 'Pistol_Aim_Neutral', 0.02, 1.0);
        } else {
          this.playAdamClip(rig, 'Pistol_Idle_Loop', 0.025, 1.0);
        }
      } else {
        this.playAdamClip(rig, 'Idle_Loop', 0.025, 1.0);
      }
    } else if (isMoving) {
      if (input.isSprinting && !isCombatActive) {
        this.playAdamClip(
          rig,
          'Sprint_Loop',
          fastJumpExitFade,
          THREE.MathUtils.clamp(input.speed / 7.2, 0.85, 1.35),
        );
      } else if (isCombatActive && input.speed < 1.6) {
        this.playAdamClip(rig, 'Pistol_Aim_Neutral', 0.02, 1.0);
      } else {
        this.playAdamClip(
          rig,
          'Jog_Fwd_Loop',
          fastJumpExitFade,
          THREE.MathUtils.clamp(input.speed / 5.2, 0.72, 1.28),
        );
      }
    } else if (hasWeapon) {
      if (input.isFiring || this.recoil > 0.25 || this.fireHold > 0.22) {
        this.playAdamClip(rig, 'Pistol_Shoot', 0.02, 1.35);
      } else if (input.isAiming || isCombatActive) {
        this.playAdamClip(rig, 'Pistol_Aim_Neutral', 0.02, 1.0);
      } else {
        this.playAdamClip(rig, 'Pistol_Idle_Loop', fastCrouchFade, 1.0);
      }
    } else {
      this.playAdamClip(rig, 'Idle_Loop', fastCrouchFade, 1.0);
    }

    mixer.update(dt);

    // 1. Lock upper body & gun in two-handed aiming pose while firing/aiming, crouching+moving, OR jumping with weapon
    const aimQuats = getAimPoseQuats(rig.modelId ?? 'adam');
    if (this.combatUpperBlend > 0.01 && rig.adamUpperBones && aimQuats) {
      for (let i = 0; i < rig.adamUpperBones.length; i++) {
        const entry = rig.adamUpperBones[i];
        const targetQ = aimQuats[entry.name];
        if (targetQ) {
          entry.bone.quaternion.slerp(targetQ, this.combatUpperBlend);
        }
      }
    }

    // 1b. Crouched stationary: keep weapon held clearly lowered ("arma baixada") until pulling analog stick
    const crouchLowW =
      this.crouchLowBlend * (1 - this.combatUpperBlend) * (1 - this.bandageBlend);
    if (crouchLowW > 0.01 && rig.adamUpperBones && aimQuats) {
      for (let i = 0; i < rig.adamUpperBones.length; i++) {
        const entry = rig.adamUpperBones[i];
        if (entry.name === 'mixamorigHead' || entry.name === 'mixamorigNeck' || entry.name.startsWith('mixamorigSpine')) {
          continue;
        }
        const targetQ = aimQuats[entry.name];
        if (targetQ) {
          entry.bone.quaternion.slerp(targetQ, 0.88 * crouchLowW);
        }
      }
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      if (rig.adamUpperArmRBone) {
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, 0.62 * crouchLowW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 1, 0, 0.14 * crouchLowW);
      }
      if (rig.adamUpperArmLBone) {
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, 0.56 * crouchLowW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 1, 0, 0.12 * crouchLowW);
      }
    }

    // 2. Running with a large weapon (AR/SMG/SG/SR): realistic military two-handed tactical carry with gentle side-to-side sway
    const tacWeight = this.tacCarryBlend * (1 - this.combatUpperBlend) * (1 - this.bandageBlend);
    if (tacWeight > 0.01 && rig.adamUpperBones && aimQuats) {
      for (let i = 0; i < rig.adamUpperBones.length; i++) {
        const entry = rig.adamUpperBones[i];
        const targetQ = aimQuats[entry.name];
        if (!targetQ) continue;
        const isHeadOrNeck = entry.name === 'mixamorigHead' || entry.name === 'mixamorigNeck';
        const isSpine = entry.name.startsWith('mixamorigSpine');
        const boneBlend = isHeadOrNeck ? 0.14 : isSpine ? 0.56 : 0.92;
        entry.bone.quaternion.slerp(targetQ, boneBlend * tacWeight);
      }

      const sway = Math.sin(this.runSwayPhase);
      const stepBounce = Math.sin(this.runSwayPhase * 2);
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);

      if (rig.adamSpineBone) {
        rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 0, 1, 0, (0.20 + sway * 0.105) * tacWeight);
      }
      const armCarryDrop = (0.32 + stepBounce * 0.042) * tacWeight;
      if (rig.adamUpperArmRBone) {
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, armCarryDrop);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 1, 0, sway * 0.065 * tacWeight);
      }
      if (rig.adamUpperArmLBone) {
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, armCarryDrop * 0.94);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 1, 0, sway * 0.065 * tacWeight);
      }
    }

    // 3. Medkit / Bandage wrapping animation ("colocando faixa branca"): continuous hand wrapping motion while allowing crouching/standing/walking
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
      // Left forearm held across chest receiving the white bandage
      if (rig.adamUpperArmLBone) {
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, 0.42 * bW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 1, 0, -0.22 * bW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, -0.18 * bW);
      }
      if (rig.adamLowerArmLBone) {
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmLBone, 0, 1, 0, (0.34 + wrapSin * 0.11) * bW);
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmLBone, 1, 0, 0, (-0.18 + wrapCos * 0.06) * bW);
      }
      // Right arm & hand orbiting around the left forearm to wrap the white gauze roll
      if (rig.adamUpperArmRBone) {
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, (0.34 - wrapCos * 0.28) * bW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 1, 0, (0.28 + wrapSin * 0.24) * bW);
        rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, (0.12 + wrapCos * 0.14) * bW);
      }
      if (rig.adamLowerArmRBone) {
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 1, 0, 0, (-0.28 + wrapCos * 0.42) * bW);
        rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 0, 1, 0, (-0.18 + wrapSin * 0.36) * bW);
      }
      if (rig.adamHandRBone) {
        rotateBoneCharAxis(_qVisW, rig.adamHandRBone, 0, 0, 1, wrapSin * 0.45 * bW);
        rotateBoneCharAxis(_qVisW, rig.adamHandRBone, 1, 0, 0, wrapCos * 0.22 * bW);
      }
    }

    // 4. Athletic jump pose: legs tucked cleanly + arms slightly open like subtle wings with hands forward ("estilo asa e mão para frente")
    if (this.jumpPoseBlend > 0.01) {
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      const jW = this.jumpPoseBlend;
      if (rig.adamThighLBone) rotateBoneCharAxis(_qVisW, rig.adamThighLBone, 1, 0, 0, -0.46 * jW);
      if (rig.adamShinLBone) rotateBoneCharAxis(_qVisW, rig.adamShinLBone, 1, 0, 0, 0.78 * jW);
      if (rig.adamThighRBone) rotateBoneCharAxis(_qVisW, rig.adamThighRBone, 1, 0, 0, 0.14 * jW);
      if (rig.adamShinRBone) rotateBoneCharAxis(_qVisW, rig.adamShinRBone, 1, 0, 0, 0.42 * jW);

      if (isAirborne && !isCombatActive && !this.jumpCancelled && !input.isReloading) {
        // Left arm: slight outward wing flare + forearm/hand pointed forward
        if (rig.adamUpperArmLBone) {
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 0, 1, 0.52 * jW);
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 1, 0, 0, -0.34 * jW);
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmLBone, 0, 1, 0, 0.12 * jW);
        }
        if (rig.adamLowerArmLBone) {
          rotateBoneCharAxis(_qVisW, rig.adamLowerArmLBone, 1, 0, 0, -1.05 * jW);
          rotateBoneCharAxis(_qVisW, rig.adamLowerArmLBone, 0, 1, 0, -0.22 * jW);
        }

        // Right arm: matching subtle wing flare + hand forward (slightly higher forward angle if holding gun)
        if (rig.adamUpperArmRBone) {
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 0, 1, (hasWeapon ? -0.42 : -0.52) * jW);
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 1, 0, 0, (hasWeapon ? -0.48 : -0.34) * jW);
          rotateBoneCharAxis(_qVisW, rig.adamUpperArmRBone, 0, 1, 0, (hasWeapon ? -0.08 : -0.12) * jW);
        }
        if (rig.adamLowerArmRBone) {
          rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 1, 0, 0, (hasWeapon ? -0.92 : -1.05) * jW);
          rotateBoneCharAxis(_qVisW, rig.adamLowerArmRBone, 0, 1, 0, (hasWeapon ? 0.16 : 0.22) * jW);
        }
      }
    }

    // 5. Soft athletic posture: slightly upright (never hunched 52-78deg, never rigid 0deg) with natural slightly lowered FF lean & fluid sway
    const desiredFwdLean =
      input.stance === 'crouch'
        ? 0.38
        : isAirborne
          ? 0.24
          : isMoving
            ? input.isSprinting
              ? 0.30
              : 0.25
            : 0.20;
    this.spineFwdTarget = THREE.MathUtils.damp(this.spineFwdTarget, desiredFwdLean, 65, dt);
    const spineBaseBone = rig.adamUpperBones?.[0]?.bone ?? rig.adamSpineBone;
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
        const leanCorrFactor = leanDiff > 0 ? 0.88 : 0.45;
        rotateBoneCharAxis(_qVisW, spineBaseBone, 1, 0, 0, -leanDiff * leanCorrFactor);
        rotateBoneCharAxis(_qVisW, spineBaseBone, 0, 0, 1, sideLean * 0.25);
      }
    }

    // Subtle additive bone pitch & recoil kick on spine/head only while aiming/firing
    const pitchTilt = isCombatActive && !input.isHealing ? -input.pitchRad * 0.35 - this.recoil * 0.1 : 0;
    const headTilt = input.isHealing ? 0 : -input.pitchRad * 0.2;
    if (Math.abs(pitchTilt) > 1e-4 || Math.abs(headTilt) > 1e-4) {
      vis.updateMatrixWorld(true);
      vis.getWorldQuaternion(_qVisW);
      if (Math.abs(pitchTilt) > 1e-4) {
        rotateBoneCharAxis(_qVisW, rig.adamSpineBone, 1, 0, 0, pitchTilt);
      }
      if (Math.abs(headTilt) > 1e-4) {
        rotateBoneCharAxis(_qVisW, rig.adamHeadBone, 1, 0, 0, headTilt);
      }
    }

    // Over-the-shoulder "pegando flecha nas costas" weapon draw pose
    const drawReach =
      hasWeapon && this.drawTimer > 0 && !input.isHealing && !input.isReviving && !input.isReloading
        ? applyAdamOverBackDraw(vis, rig.adamUpperBones, this.drawTimer, rig.modelId ?? 'adam')
        : 0;
    // Reset weaponMount tilt cleanly when draw completes; while reaching back, angle gun into draw arc
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

    const isMovingNow = input.speed > 0.35;
    if (isMovingNow && input.isGrounded) {
      this.runSwayPhase += dt * (input.isSprinting ? 10.8 : 8.2);
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

    if (!input.isGrounded && !input.isOnSurfboard && !input.isSkydiving && !input.isParachuting && !input.isSwimming) {
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

    rig.muzzleFlash.visible =
      this.recoil > 0.55 && (input.hasWeapon ?? true) && !input.isDead && !input.isDriving;
    if (rig.muzzleFlash.visible) {
      rig.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.5;
      rig.muzzleFlash.scale.set(s, s, s);
    }

    // Death collapse animation (fallback)
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
      rig.surfboardGroup.rotation.set(input.speed > 0.35 ? -0.055 : 0.015, 0, -this.turnBank * 0.85);
    }

    if (input.isSwimming && !input.isOnSurfboard) {
      const swimStroke = Math.sin(this.idleTime * 6.5);
      const kick = Math.sin(this.idleTime * 9.5);
      const isSwMoving = input.speed > 0.35;
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, isSwMoving ? 0.52 : 0.72, 10, dt);
      rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, isSwMoving ? 1.44 : 0.12, 10, dt);
      rig.pelvis.rotation.z = swimStroke * (isSwMoving ? 0.14 : 0.04) - this.turnBank * 0.4;
      rig.torso.rotation.set(isSwMoving ? -0.26 : 0, 0, 0);
      rig.headGroup.rotation.set(isSwMoving ? -0.88 : -0.1, 0, 0);
      rig.leftShoulder.rotation.set(isSwMoving ? -2.2 + swimStroke * 1.1 : -0.45, 0, isSwMoving ? 0.28 : 0.52);
      rig.rightShoulder.rotation.set(isSwMoving ? -2.2 - swimStroke * 1.1 : -0.45, 0, isSwMoving ? -0.28 : -0.52);
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
      rig.torso.rotation.set(0.02 + breath * 0.015, -0.06 + Math.sin(this.idleTime * 0.7) * 0.03, 0);
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

    const isMoving = input.speed > 0.35;
    if (isMoving && input.isGrounded) {
      const speedFactor = THREE.MathUtils.clamp(input.speed / 5.8, 0.65, 1.55);
      const baseFreq = input.isSprinting
        ? 11.4
        : input.stance === 'crouch'
          ? 7.2
          : input.stance === 'prone'
            ? 5.2
            : 8.6;
      this.walkPhase += dt * baseFreq * (input.stance === 'stand' ? speedFactor * 0.85 : 1.0);
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
      const crawl = Math.sin(this.walkPhase) * 0.24 * strideBlend;
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.22, 65, dt);
      rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 1.46, 65, dt);
      rig.pelvis.rotation.z = THREE.MathUtils.damp(rig.pelvis.rotation.z, crawl * 0.18, 55, dt);
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, -0.46, 55, dt);
      rig.headGroup.rotation.x = THREE.MathUtils.damp(
        rig.headGroup.rotation.x,
        -0.84 + input.pitchRad * 0.28,
        55,
        dt,
      );
      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(
        rig.rightShoulder.rotation.x,
        -1.92 - this.recoil * 0.2,
        75,
        dt,
      );
      rig.rightShoulder.rotation.y = 0.14;
      rig.rightShoulder.rotation.z = -0.14;
      rig.rightElbow.rotation.set(-0.92, 0, 0);
      rig.leftShoulder.rotation.set(-1.85 + crawl, -0.22, 0.16);
      rig.leftElbow.rotation.set(-0.92, 0, 0);
      rig.leftHip.rotation.set(0.04 + crawl * 0.35, 0, 0.1);
      rig.rightHip.rotation.set(0.04 - crawl * 0.35, 0, -0.1);
      rig.leftKnee.rotation.set(0.08, 0, 0);
      rig.rightKnee.rotation.set(0.08, 0, 0);
      return;
    }

    const isCrouch = input.stance === 'crouch';
    const crouchRate = 85;
    const healDip = 0;
    const landCompression = this.landingDip * (isCrouch ? 0.08 : 0.16);
    const bobAmp = input.isSprinting ? 0.058 : isCrouch ? 0.028 : 0.032;
    const targetPelvisY = isCrouch
      ? 0.58 + doubleHarmonic * bobAmp - landCompression
      : !input.isGrounded
        ? 0.96
        : 0.92 + healDip + doubleHarmonic * bobAmp + (1 - strideBlend) * breath * 0.008 - landCompression;

    rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, targetPelvisY, crouchRate, dt);
    rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 0, crouchRate, dt);
    rig.pelvis.rotation.y = THREE.MathUtils.damp(
      rig.pelvis.rotation.y,
      isMoving && !input.isAiming ? swing * (input.isSprinting ? 0.08 : 0.05) : 0,
      55,
      dt,
    );
    rig.pelvis.rotation.z = THREE.MathUtils.damp(rig.pelvis.rotation.z, 0, 55, dt);

    // Relaxed, slightly lowered athletic forward lean (matching original Free Fire)
    const procTorsoLean =
      (isCrouch ? 0.28 : input.isSprinting ? 0.20 : isMoving ? 0.14 : 0.08) +
      this.landingDip * 0.06;
    rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, procTorsoLean, crouchRate, dt);
    rig.torso.rotation.y = THREE.MathUtils.damp(
      rig.torso.rotation.y,
      input.isHealing
        ? Math.cos(this.bandagePhase) * 0.06
        : input.isReviving
          ? Math.sin(this.idleTime * 5.2) * 0.12
          : input.isAiming
            ? -0.18
            : isMoving && input.isSprinting
              ? -swing * 0.1
              : 0,
      70,
      dt,
    );
    rig.torso.rotation.z = THREE.MathUtils.damp(
      rig.torso.rotation.z,
      isMoving ? -this.turnBank * 0.18 : 0,
      55,
      dt,
    );
    rig.headGroup.rotation.x = THREE.MathUtils.damp(
      rig.headGroup.rotation.x,
      input.isHealing || input.isReviving ? 0.2 : input.pitchRad * 0.35,
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
      const stride = swing * 0.48;
      rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, -0.82 + stride, crouchRate, dt);
      rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, 1.32 - stride * 0.3, crouchRate, dt);
      rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, -0.82 - stride, crouchRate, dt);
      rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, 1.32 + stride * 0.3, crouchRate, dt);
    } else {
      const legAmp = input.isSprinting ? 0.94 : 0.56;
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
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.42 + swing * 0.85, 18, dt);
        rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.12, 16, dt);
        rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.16, 16, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -1.35, 16, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.42 - swing * 0.85, 18, dt);
        rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.12, 16, dt);
        rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.16, 16, dt);
        rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -1.35, 16, dt);
      } else {
        const idleFist = (1 - strideBlend) * breath * 0.03 + swing * 0.28;
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.78 + idleFist, 18, dt);
        rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.18, 16, dt);
        rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.14, 16, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -1.25, 16, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.85 - idleFist, 18, dt);
        rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.22, 16, dt);
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
      ? -0.48
      : input.isAiming || isAirborneWeaponHold || isCrouchPointForward || this.recoil > 0.05
        ? -1.42
        : -1.05;

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
      if (isLargeWeapon) {
        // Large weapon two-handed military low-ready carry with smooth side-to-side sway
        const sway = Math.sin(this.runSwayPhase);
        const bounce = Math.sin(this.runSwayPhase * 2);
        rig.torso.rotation.y += sway * 0.09 + 0.16;
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.96 + bounce * 0.05, 18, dt);
        rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.24 + sway * 0.06, 18, dt);
        rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.08, 18, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -0.58, 18, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.92 + bounce * 0.05, 18, dt);
        rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.50 + sway * 0.06, 18, dt);
        rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.14, 18, dt);
        rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -0.68, 18, dt);
      } else {
        // Pistol: keep normal arm swing
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.84 + swing * 0.22, 16, dt);
        rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.45, 16, dt);
        rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.18, 16, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -1.05, 16, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.7 - swing * 0.4, 16, dt);
        rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.35, 16, dt);
        rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.18, 16, dt);
        rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -0.95, 16, dt);
      }
    } else {
      const idleSway = (1 - strideBlend) * breath * 0.025 + swing * 0.06;
      const twoHandJumpDamp = 90;
      const targetElbowR = isCrouchWeaponDown ? -0.74 : -0.38 - this.recoil * 0.12;
      const targetElbowL = isCrouchWeaponDown ? -0.86 : -0.58;
      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(
        rig.rightShoulder.rotation.x,
        aimRaise - this.recoil * 0.24 + (isCrouchWeaponDown ? 0 : pitchInfluence) + idleSway,
        twoHandJumpDamp,
        dt,
      );
      rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.16, 75, dt);
      rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.06, 75, dt);
      rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, targetElbowR, twoHandJumpDamp, dt);

      rig.leftShoulder.rotation.x = THREE.MathUtils.damp(
        rig.leftShoulder.rotation.x,
        aimRaise * 0.92 - this.recoil * 0.18 + (isCrouchWeaponDown ? 0 : pitchInfluence) - idleSway * 0.5,
        twoHandJumpDamp,
        dt,
      );
      rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.46, 75, dt);
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
