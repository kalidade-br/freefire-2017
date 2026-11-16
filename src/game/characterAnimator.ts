import * as THREE from 'three';
import { CharacterRig } from './characterBuilder';
import { PlayerStance } from './types';

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
  pitchRad: number;
}

export class CharacterAnimator {
  private walkPhase = 0;
  private idleTime = 0;
  private recoil = 0;
  private hitFlash = 0;
  private hitStagger = 0;
  private deathProgress = 0;

  public triggerFire(): void {
    this.recoil = 1.0;
  }

  public triggerHit(): void {
    this.hitFlash = 1.0;
    this.hitStagger = 1.0;
  }

  public reset(): void {
    this.deathProgress = 0;
    this.hitFlash = 0;
    this.hitStagger = 0;
    this.recoil = 0;
  }

  public update(rig: CharacterRig, input: CharacterAnimInput): void {
    const dt = input.dt;
    this.idleTime += dt;
    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 18, dt);
    this.hitFlash = THREE.MathUtils.damp(this.hitFlash, 0, 10, dt);
    this.hitStagger = THREE.MathUtils.damp(this.hitStagger, 0, 12, dt);

    rig.setHitFlash(this.hitFlash);
    rig.muzzleFlash.visible = this.recoil > 0.55 && !input.isDead;
    if (rig.muzzleFlash.visible) {
      rig.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.5;
      rig.muzzleFlash.scale.set(s, s, s);
    }

    // Death collapse animation
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

    // Skydiving (DROPPING)
    if (input.isSkydiving) {
      rig.setParachuteVisible(false);
      rig.contactShadow.visible = false;
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.92, 10, dt);
      rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 1.32, 8, dt);
      rig.pelvis.rotation.z = Math.sin(this.idleTime * 5) * 0.08;
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

    // Parachuting (PARACHUTE)
    if (input.isParachuting) {
      rig.setParachuteVisible(true);
      rig.contactShadow.visible = false;
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.92, 10, dt);
      rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 0.08, 8, dt);
      rig.pelvis.rotation.z = Math.sin(this.idleTime * 2.2) * 0.05;
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
    rig.contactShadow.visible = input.isGrounded;

    // Lobby relaxed idle pose (matching Screenshot 2 survivor stance)
    if (input.isLobby) {
      const breath = Math.sin(this.idleTime * 2.1);
      rig.pelvis.position.y = 0.92 + breath * 0.008;
      rig.pelvis.rotation.set(0, 0.08, 0);
      rig.torso.rotation.set(0.02 + breath * 0.015, -0.06, 0);
      rig.headGroup.rotation.set(breath * 0.02, 0.08, 0);
      rig.leftShoulder.rotation.set(0.08, 0, 0.14);
      rig.leftElbow.rotation.set(-0.22, 0, 0);
      rig.rightShoulder.rotation.set(0.12, 0, -0.14);
      rig.rightElbow.rotation.set(-0.3, 0, 0);
      rig.leftHip.rotation.set(-0.04, 0, 0.06);
      rig.leftKnee.rotation.set(0.08, 0, 0);
      rig.rightHip.rotation.set(0.04, 0, -0.06);
      rig.rightKnee.rotation.set(0.05, 0, 0);
      return;
    }

    // Active Locomotion / Stances
    const isMoving = input.speed > 0.35;
    if (isMoving && input.isGrounded) {
      const freq = input.isSprinting ? 12.5 : input.stance === 'crouch' ? 7.2 : input.stance === 'prone' ? 5.2 : 8.8;
      this.walkPhase += dt * freq;
    } else {
      this.walkPhase = THREE.MathUtils.damp(this.walkPhase, Math.round(this.walkPhase / Math.PI) * Math.PI, 8, dt);
    }

    const swing = isMoving ? Math.sin(this.walkPhase) : 0;
    const bob = isMoving ? Math.abs(Math.cos(this.walkPhase)) : 0;

    // Prone (deitado)
    if (input.stance === 'prone') {
      const crawl = isMoving ? Math.sin(this.walkPhase) * 0.25 : 0;
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.22, 12, dt);
      rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 1.42, 12, dt);
      rig.pelvis.rotation.z = THREE.MathUtils.damp(rig.pelvis.rotation.z, crawl * 0.2, 12, dt);
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, -0.25, 10, dt);
      rig.headGroup.rotation.x = THREE.MathUtils.damp(rig.headGroup.rotation.x, -0.95 + input.pitchRad * 0.3, 10, dt);

      rig.rightShoulder.rotation.set(-1.35 - this.recoil * 0.22, 0.12, -0.1);
      rig.rightElbow.rotation.set(-0.85, 0, 0);
      rig.leftShoulder.rotation.set(-1.3 + crawl, -0.25, 0.15);
      rig.leftElbow.rotation.set(-0.9, 0, 0);

      rig.leftHip.rotation.set(0.08 + crawl * 0.5, 0, 0.14);
      rig.rightHip.rotation.set(0.08 - crawl * 0.5, 0, -0.14);
      rig.leftKnee.rotation.set(0.18, 0, 0);
      rig.rightKnee.rotation.set(0.18, 0, 0);
      return;
    }

    // Crouch vs Stand base height & posture
    const isCrouch = input.stance === 'crouch';
    const targetPelvisY = isCrouch
      ? 0.58 + bob * 0.03
      : !input.isGrounded
        ? 0.96
        : 0.92 + bob * (input.isSprinting ? 0.065 : 0.035);

    rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, targetPelvisY, 16, dt);
    rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, isCrouch ? 0.14 : 0, 14, dt);
    rig.pelvis.rotation.y = THREE.MathUtils.damp(
      rig.pelvis.rotation.y,
      isMoving && !input.isAiming ? swing * (input.isSprinting ? 0.11 : 0.06) : 0,
      14,
      dt,
    );
    rig.pelvis.rotation.z = THREE.MathUtils.damp(
      rig.pelvis.rotation.z,
      isMoving && input.isSprinting ? swing * 0.035 : 0,
      14,
      dt,
    );

    const leanForward = input.isSprinting ? 0.26 : isCrouch ? 0.3 : 0.05;
    const hitTilt = this.hitStagger * -0.24;
    rig.torso.rotation.x = THREE.MathUtils.damp(
      rig.torso.rotation.x,
      leanForward + hitTilt - this.recoil * 0.08,
      16,
      dt,
    );
    rig.torso.rotation.y = THREE.MathUtils.damp(
      rig.torso.rotation.y,
      input.isAiming ? -0.18 : isMoving && input.isSprinting ? -swing * 0.12 : 0,
      16,
      dt,
    );
    rig.headGroup.rotation.x = THREE.MathUtils.damp(
      rig.headGroup.rotation.x,
      -leanForward * 0.55 + input.pitchRad * 0.45,
      16,
      dt,
    );

    // Legs
    if (!input.isGrounded) {
      // Jump pose
      rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, -0.68, 14, dt);
      rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, 1.1, 14, dt);
      rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, -0.22, 14, dt);
      rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, 0.55, 14, dt);
    } else if (isCrouch) {
      const stride = swing * 0.48;
      rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, -0.95 + stride, 18, dt);
      rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, 1.48 - stride * 0.3, 18, dt);
      rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, -0.95 - stride, 18, dt);
      rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, 1.48 + stride * 0.3, 18, dt);
    } else {
      const legAmp = input.isSprinting ? 0.92 : 0.56;
      const lAngle = swing * legAmp;
      const rAngle = -swing * legAmp;
      rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, lAngle, 20, dt);
      rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, rAngle, 20, dt);
      rig.leftKnee.rotation.x = THREE.MathUtils.damp(
        rig.leftKnee.rotation.x,
        Math.max(0.08, -lAngle * 0.85 + 0.16),
        20,
        dt,
      );
      rig.rightKnee.rotation.x = THREE.MathUtils.damp(
        rig.rightKnee.rotation.x,
        Math.max(0.08, -rAngle * 0.85 + 0.16),
        20,
        dt,
      );
    }

    // Arms & Weapon Aim/Fire posture
    const aimRaise = input.isAiming || this.recoil > 0.05 ? -1.42 : -1.05;
    const pitchInfluence = input.pitchRad * 0.55;
    if (input.isSprinting && !input.isAiming && this.recoil < 0.05) {
      // Sprint weapon tucked across chest
      rig.rightShoulder.rotation.set(-0.85 + swing * 0.18, 0.45, -0.18);
      rig.rightElbow.rotation.set(-1.05, 0, 0);
      rig.leftShoulder.rotation.set(-0.7 - swing * 0.35, -0.35, 0.18);
      rig.leftElbow.rotation.set(-0.95, 0, 0);
    } else {
      // Ready / Aim / Fire two-handed stance
      rig.rightShoulder.rotation.set(
        aimRaise - this.recoil * 0.24 + pitchInfluence,
        0.16,
        -0.06,
      );
      rig.rightElbow.rotation.set(-0.38 - this.recoil * 0.12, 0, 0);
      rig.leftShoulder.rotation.set(
        aimRaise * 0.92 - this.recoil * 0.18 + pitchInfluence,
        -0.46,
        0.14,
      );
      rig.leftElbow.rotation.set(-0.58, 0, 0);
    }
  }
}
