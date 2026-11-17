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
  isHealing?: boolean;
  isReloading?: boolean;
  isDriving?: boolean;
  turnDeltaRad?: number;
  pitchRad: number;
}

export class CharacterAnimator {
  private walkPhase = 0;
  private idleTime = 0;
  private recoil = 0;
  private hitFlash = 0;
  private hitStagger = 0;
  private deathProgress = 0;
  private landingDip = 0;
  private turnBank = 0;
  private reloadPhase = 0;

  public triggerFire(): void {
    this.recoil = 1.0;
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
    this.landingDip = 0;
    this.turnBank = 0;
    this.reloadPhase = 0;
  }

  public update(rig: CharacterRig, input: CharacterAnimInput): void {
    const dt = input.dt;
    this.idleTime += dt;
    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 18, dt);
    this.hitFlash = THREE.MathUtils.damp(this.hitFlash, 0, 10, dt);
    this.hitStagger = THREE.MathUtils.damp(this.hitStagger, 0, 12, dt);
    this.landingDip = THREE.MathUtils.damp(this.landingDip, 0, 11, dt);

    const turnRate = input.turnDeltaRad ?? 0;
    this.turnBank = THREE.MathUtils.damp(
      this.turnBank,
      THREE.MathUtils.clamp(turnRate * 4.5, -0.22, 0.22),
      14,
      dt,
    );

    if (input.isReloading) {
      this.reloadPhase += dt * 9.5;
    } else {
      this.reloadPhase = THREE.MathUtils.damp(this.reloadPhase, 0, 14, dt);
    }

    rig.setHitFlash(this.hitFlash);
    rig.muzzleFlash.visible = this.recoil > 0.55 && !input.isDead && !input.isDriving;
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

    // Driving seated posture
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

    // Skydiving (DROPPING)
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

    // Parachuting (PARACHUTE)
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
    rig.contactShadow.visible = input.isGrounded;

    // Lobby relaxed idle pose
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

    // Active Locomotion / Stances
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

    // Prone (deitado)
    if (input.stance === 'prone') {
      const crawl = Math.sin(this.walkPhase) * 0.26 * strideBlend;
      rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.22, 12, dt);
      rig.pelvis.rotation.x = THREE.MathUtils.damp(rig.pelvis.rotation.x, 1.42, 12, dt);
      rig.pelvis.rotation.z = THREE.MathUtils.damp(rig.pelvis.rotation.z, crawl * 0.22, 12, dt);
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, -0.25, 10, dt);
      rig.headGroup.rotation.x = THREE.MathUtils.damp(
        rig.headGroup.rotation.x,
        -0.95 + input.pitchRad * 0.3,
        10,
        dt,
      );

      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(
        rig.rightShoulder.rotation.x,
        -1.35 - this.recoil * 0.22,
        18,
        dt,
      );
      rig.rightShoulder.rotation.y = 0.12;
      rig.rightShoulder.rotation.z = -0.1;
      rig.rightElbow.rotation.set(-0.85, 0, 0);
      rig.leftShoulder.rotation.set(-1.3 + crawl, -0.25, 0.15);
      rig.leftElbow.rotation.set(-0.9, 0, 0);

      rig.leftHip.rotation.set(0.08 + crawl * 0.5, 0, 0.14);
      rig.rightHip.rotation.set(0.08 - crawl * 0.5, 0, -0.14);
      rig.leftKnee.rotation.set(0.18, 0, 0);
      rig.rightKnee.rotation.set(0.18, 0, 0);
      return;
    }

    // Crouch vs Stand base height & posture + Landing spring dip
    const isCrouch = input.stance === 'crouch';
    const healDip = input.isHealing && !isCrouch ? -0.18 : 0;
    const landCompression = this.landingDip * (isCrouch ? 0.08 : 0.16);
    const bobAmp = input.isSprinting ? 0.058 : isCrouch ? 0.028 : 0.032;
    const targetPelvisY = isCrouch
      ? 0.58 + doubleHarmonic * bobAmp - landCompression
      : !input.isGrounded
        ? 0.96
        : 0.92 + healDip + doubleHarmonic * bobAmp + (1 - strideBlend) * breath * 0.008 - landCompression;

    rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, targetPelvisY, 16, dt);
    rig.pelvis.rotation.x = THREE.MathUtils.damp(
      rig.pelvis.rotation.x,
      (isCrouch ? 0.14 : input.isHealing ? 0.12 : 0) + this.landingDip * 0.18,
      14,
      dt,
    );
    rig.pelvis.rotation.y = THREE.MathUtils.damp(
      rig.pelvis.rotation.y,
      isMoving && !input.isAiming ? swing * (input.isSprinting ? 0.12 : 0.065) : 0,
      14,
      dt,
    );
    rig.pelvis.rotation.z = THREE.MathUtils.damp(
      rig.pelvis.rotation.z,
      (isMoving && input.isSprinting ? swing * 0.04 : 0) - this.turnBank * 0.45,
      14,
      dt,
    );

    const leanForward = input.isHealing
      ? 0.28
      : input.isSprinting
        ? 0.24
        : isCrouch
          ? 0.3
          : 0.04 + breath * 0.012;
    const hitTilt = this.hitStagger * -0.24;
    rig.torso.rotation.x = THREE.MathUtils.damp(
      rig.torso.rotation.x,
      leanForward + hitTilt - this.recoil * 0.08 + this.landingDip * 0.16,
      16,
      dt,
    );
    rig.torso.rotation.y = THREE.MathUtils.damp(
      rig.torso.rotation.y,
      input.isHealing
        ? Math.sin(this.idleTime * 5.2) * 0.12
        : input.isAiming
          ? -0.18
          : isMoving && input.isSprinting
            ? -swing * 0.13
            : 0,
      16,
      dt,
    );
    rig.torso.rotation.z = THREE.MathUtils.damp(rig.torso.rotation.z, -this.turnBank * 0.5, 14, dt);
    rig.headGroup.rotation.x = THREE.MathUtils.damp(
      rig.headGroup.rotation.x,
      input.isHealing ? 0.32 : -leanForward * 0.52 + input.pitchRad * 0.45,
      16,
      dt,
    );
    rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, this.turnBank * 0.45, 12, dt);

    // Legs with smooth asymmetric knee flexion & landing cushion
    if (!input.isGrounded) {
      rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, -0.68, 13, dt);
      rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, 1.12, 13, dt);
      rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, -0.22, 13, dt);
      rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, 0.56, 13, dt);
    } else if (isCrouch || (input.isHealing && !isMoving)) {
      const stride = swing * 0.48;
      rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, -0.82 + stride, 16, dt);
      rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, 1.32 - stride * 0.3, 16, dt);
      rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, -0.82 - stride, 16, dt);
      rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, 1.32 + stride * 0.3, 16, dt);
    } else {
      const legAmp = input.isSprinting ? 0.94 : 0.56;
      const lAngle = swing * legAmp - this.landingDip * 0.42;
      const rAngle = -swing * legAmp - this.landingDip * 0.42;
      rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, lAngle, 18, dt);
      rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, rAngle, 18, dt);

      const lKneeFlex = lAngle > 0 ? lAngle * 1.05 + 0.14 : Math.max(0.08, -lAngle * 0.45 + 0.12);
      const rKneeFlex = rAngle > 0 ? rAngle * 1.05 + 0.14 : Math.max(0.08, -rAngle * 0.45 + 0.12);
      rig.leftKnee.rotation.x = THREE.MathUtils.damp(
        rig.leftKnee.rotation.x,
        lKneeFlex + this.landingDip * 0.75,
        18,
        dt,
      );
      rig.rightKnee.rotation.x = THREE.MathUtils.damp(
        rig.rightKnee.rotation.x,
        rKneeFlex + this.landingDip * 0.75,
        18,
        dt,
      );
    }

    // Arms: Healing / Reloading / Sprinting / Aiming smoothly damped!
    if (input.isHealing) {
      const wrapS = Math.sin(this.idleTime * 7.2);
      const wrapC = Math.cos(this.idleTime * 7.2);
      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -1.15 + wrapS * 0.24, 16, dt);
      rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.55 + wrapC * 0.22, 16, dt);
      rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.35, 16, dt);
      rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -1.35 + wrapC * 0.18, 16, dt);

      rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -1.12 - wrapS * 0.22, 16, dt);
      rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.58 + wrapC * 0.2, 16, dt);
      rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.35, 16, dt);
      rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -1.28 - wrapC * 0.18, 16, dt);
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

    const aimRaise = input.isAiming || this.recoil > 0.05 ? -1.42 : -1.05;
    const pitchInfluence = input.pitchRad * 0.55;
    if (input.isSprinting && !input.isAiming && this.recoil < 0.05) {
      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, -0.84 + swing * 0.22, 16, dt);
      rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.45, 16, dt);
      rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.18, 16, dt);
      rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -1.05, 16, dt);

      rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, -0.7 - swing * 0.4, 16, dt);
      rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.35, 16, dt);
      rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.18, 16, dt);
      rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -0.95, 16, dt);
    } else {
      const idleSway = (1 - strideBlend) * breath * 0.025 + swing * 0.06;
      rig.rightShoulder.rotation.x = THREE.MathUtils.damp(
        rig.rightShoulder.rotation.x,
        aimRaise - this.recoil * 0.24 + pitchInfluence + idleSway,
        20,
        dt,
      );
      rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, 0.16, 18, dt);
      rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, -0.06, 18, dt);
      rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -0.38 - this.recoil * 0.12, 20, dt);

      rig.leftShoulder.rotation.x = THREE.MathUtils.damp(
        rig.leftShoulder.rotation.x,
        aimRaise * 0.92 - this.recoil * 0.18 + pitchInfluence - idleSway * 0.5,
        20,
        dt,
      );
      rig.leftShoulder.rotation.y = THREE.MathUtils.damp(rig.leftShoulder.rotation.y, -0.46, 18, dt);
      rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, 0.14, 18, dt);
      rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, -0.58, 20, dt);
    }
  }
}
