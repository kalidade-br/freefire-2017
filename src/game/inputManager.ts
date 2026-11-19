export class InputManager {
  public moveX = 0;
  public moveZ = 0;
  public lookDeltaX = 0;
  public lookDeltaY = 0;

  public isSprinting = false;
  public isFiring = false;
  public isAiming = false;

  public jumpPressed = false;
  public crouchPressed = false;
  public pronePressed = false;
  public reloadPressed = false;
  public interactPressed = false;
  public cycleScopePressed = false;
  public backpackPressed = false;
  public medkitPressed = false;
  public glooPressed = false;
  public grenadePressed = false;
  public fireTapPressed = false;
  public revivePressed = false;
  public surfboardPressed = false;
  public quickSwapPressed = false;
  public switchSlot: 1 | 2 | 3 | 4 | null = null;
  public cycleSlotDir: -1 | 0 | 1 = 0;
  public pointerLocked = false;
  private lastCrouchMs = 0;
  private lastProneMs = 0;

  private keys = new Set<string>();
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchSprint = false;
  private touchAutoSprint = false;
  private touchFire = false;
  private touchAim = false;
  private isDraggingMouse = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private canvas: HTMLElement | null = null;
  private allowPointerLock = false;
  private onPauseCallback: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  public attachCanvas(canvas: HTMLElement, onPause?: () => void): void {
    this.detachCanvas();
    this.canvas = canvas;
    this.onPauseCallback = onPause ?? null;
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  public detachCanvas(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('wheel', this.handleWheel);
      this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    }
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas = null;
  }

  public setGameplayActive(active: boolean): void {
    this.allowPointerLock = active;
    if (!active) {
      this.isFiring = false;
      this.touchFire = false;
      this.isAiming = false;
      this.touchAim = false;
      this.touchAutoSprint = false;
      this.isDraggingMouse = false;
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
  }

  public requestLock(): void {
    if (!this.allowPointerLock || !this.canvas) return;
    try {
      this.canvas.requestPointerLock?.();
    } catch {
      // Fallback drag look still works seamlessly
    }
  }

  public setVirtualJoystick(x: number, y: number): void {
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveY = Math.max(-1, Math.min(1, y));
    if (y > 0.35) {
      this.touchAutoSprint = false;
    }
  }

  public addTouchLook(dx: number, dy: number): void {
    this.lookDeltaX += dx;
    this.lookDeltaY += dy;
  }

  public setTouchFire(active: boolean): void {
    if (active && !this.touchFire) {
      this.fireTapPressed = true;
    }
    this.touchFire = active;
  }

  public setTouchAim(active: boolean): void {
    this.touchAim = active;
  }

  public setTouchSprint(active: boolean): void {
    this.touchSprint = active;
  }

  public setTouchAutoSprint(active: boolean): void {
    this.touchAutoSprint = active;
  }

  public getTouchAutoSprint(): boolean {
    return this.touchAutoSprint;
  }

  public triggerJump(): void {
    this.jumpPressed = true;
  }

  public triggerCrouch(): void {
    const now = performance.now();
    if (now - this.lastCrouchMs < 65) return;
    this.lastCrouchMs = now;
    this.crouchPressed = true;
  }

  public triggerProne(): void {
    const now = performance.now();
    if (now - this.lastProneMs < 65) return;
    this.lastProneMs = now;
    this.pronePressed = true;
  }

  public triggerReload(): void {
    this.reloadPressed = true;
  }

  public triggerInteract(): void {
    this.interactPressed = true;
  }

  public triggerCycleScope(): void {
    this.cycleScopePressed = true;
  }

  public triggerBackpack(): void {
    this.backpackPressed = true;
  }

  public triggerMedkit(): void {
    this.medkitPressed = true;
  }

  public triggerGloo(): void {
    this.glooPressed = true;
  }

  public triggerGrenade(): void {
    this.grenadePressed = true;
  }

  public triggerFireTap(): void {
    this.fireTapPressed = true;
  }

  public triggerRevive(): void {
    this.revivePressed = true;
  }

  public triggerSurfboard(): void {
    this.surfboardPressed = true;
  }

  public triggerQuickSwap(): void {
    this.quickSwapPressed = true;
  }

  public triggerSlot(slot: 1 | 2 | 3 | 4): void {
    this.switchSlot = slot;
  }

  public sample(): void {
    let kx = 0;
    let kz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kz += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kz -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;

    if (kx !== 0 || kz < 0) {
      this.touchAutoSprint = false;
    }

    const autoZ =
      this.touchAutoSprint && Math.abs(this.touchMoveX) < 0.15 && Math.abs(this.touchMoveY) < 0.15 && kz === 0
        ? 1
        : 0;
    const combinedX = kx + this.touchMoveX;
    const combinedZ = kz - this.touchMoveY + autoZ;
    const mag = Math.hypot(combinedX, combinedZ);
    if (mag > 1) {
      this.moveX = combinedX / mag;
      this.moveZ = combinedZ / mag;
    } else {
      this.moveX = combinedX;
      this.moveZ = combinedZ;
    }

    this.isSprinting =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.touchSprint ||
      this.touchAutoSprint;
  }

  public consumeLookAndEdges(): {
    dx: number;
    dy: number;
    jump: boolean;
    crouch: boolean;
    prone: boolean;
    reload: boolean;
    interact: boolean;
    cycleScope: boolean;
    backpack: boolean;
    medkit: boolean;
    gloo: boolean;
    grenade: boolean;
    fireTap: boolean;
    revive: boolean;
    surfboard: boolean;
    quickSwap: boolean;
    slot: 1 | 2 | 3 | 4 | null;
    cycleSlotDir: -1 | 0 | 1;
  } {
    const out = {
      dx: this.lookDeltaX,
      dy: this.lookDeltaY,
      jump: this.jumpPressed,
      crouch: this.crouchPressed,
      prone: this.pronePressed,
      reload: this.reloadPressed,
      interact: this.interactPressed,
      cycleScope: this.cycleScopePressed,
      backpack: this.backpackPressed,
      medkit: this.medkitPressed,
      gloo: this.glooPressed,
      grenade: this.grenadePressed,
      fireTap: this.fireTapPressed,
      revive: this.revivePressed,
      surfboard: this.surfboardPressed,
      quickSwap: this.quickSwapPressed,
      slot: this.switchSlot,
      cycleSlotDir: this.cycleSlotDir,
    };
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.jumpPressed = false;
    this.crouchPressed = false;
    this.pronePressed = false;
    this.reloadPressed = false;
    this.interactPressed = false;
    this.cycleScopePressed = false;
    this.backpackPressed = false;
    this.medkitPressed = false;
    this.glooPressed = false;
    this.grenadePressed = false;
    this.fireTapPressed = false;
    this.revivePressed = false;
    this.surfboardPressed = false;
    this.quickSwapPressed = false;
    this.switchSlot = null;
    this.cycleSlotDir = 0;
    return out;
  }

  public getFireActive(): boolean {
    return this.isFiring || this.touchFire;
  }

  public getAimActive(): boolean {
    return this.isAiming || this.touchAim;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Tab') {
      e.preventDefault();
    }
    if (e.repeat) {
      this.keys.add(e.code);
      return;
    }
    this.keys.add(e.code);
    if (e.code === 'Space') this.jumpPressed = true;
    if (e.code === 'KeyC') this.triggerCrouch();
    if (e.code === 'KeyZ' || e.code === 'ControlLeft') this.triggerProne();
    if (e.code === 'KeyR') this.reloadPressed = true;
    if (e.code === 'KeyE' || e.code === 'KeyF') this.interactPressed = true;
    if (e.code === 'KeyY') this.cycleScopePressed = true;
    if (e.code === 'KeyQ') this.quickSwapPressed = true;
    if (e.code === 'Tab' || e.code === 'KeyB') this.backpackPressed = true;
    if (e.code === 'KeyH') this.medkitPressed = true;
    if (e.code === 'KeyG' || e.code === 'Digit5') this.glooPressed = true;
    if (e.code === 'KeyX' || e.code === 'Digit6') this.grenadePressed = true;
    if (e.code === 'KeyV') this.revivePressed = true;
    if (e.code === 'KeyT') this.surfboardPressed = true;
    if (e.code === 'Digit1') this.switchSlot = 1;
    if (e.code === 'Digit2') this.switchSlot = 2;
    if (e.code === 'Digit3') this.switchSlot = 3;
    if (e.code === 'Digit4') this.switchSlot = 4;
    if (e.code === 'Escape' && this.onPauseCallback && !this.pointerLocked) {
      this.onPauseCallback();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handleBlur = (): void => {
    this.keys.clear();
    this.isFiring = false;
    this.isAiming = false;
    this.isDraggingMouse = false;
    this.touchFire = false;
    this.touchAim = false;
    this.touchSprint = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      if (this.allowPointerLock && !this.pointerLocked) {
        this.requestLock();
      }
      this.isFiring = true;
      this.fireTapPressed = true;
      this.isDraggingMouse = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    } else if (e.button === 2) {
      this.isAiming = true;
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.isFiring = false;
      this.isDraggingMouse = false;
    } else if (e.button === 2) {
      this.isAiming = false;
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.pointerLocked) {
      this.lookDeltaX += e.movementX;
      this.lookDeltaY += e.movementY;
    } else if (this.isDraggingMouse) {
      this.lookDeltaX += e.clientX - this.lastMouseX;
      this.lookDeltaY += e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    if (!this.allowPointerLock) return;
    if (Math.abs(e.deltaY) < 4) return;
    this.cycleSlotDir = e.deltaY > 0 ? 1 : -1;
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  public dispose(): void {
    this.detachCanvas();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }
}
