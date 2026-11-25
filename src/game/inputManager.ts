import {
  DEFAULT_GG_MOUSE_PRO,
  DEFAULT_KEY_BINDINGS,
  GgMouseProConfig,
  KeyBindAction,
  KeyBindingsConfig,
  MacroConfig,
  MacroStepAction,
} from './types';

function mouseButtonToCode(button: number): string | null {
  if (button === 0) return 'MouseLeft';
  if (button === 1) return 'MouseMiddle';
  if (button === 2) return 'MouseRight';
  if (button === 3) return 'MouseBack';
  if (button === 4) return 'MouseForward';
  return null;
}

function codesMatch(bound: string, incoming: string): boolean {
  if (!bound || !incoming) return false;
  if (bound === incoming) return true;
  if (
    (bound === 'ShiftLeft' || bound === 'ShiftRight') &&
    (incoming === 'ShiftLeft' || incoming === 'ShiftRight')
  ) {
    return true;
  }
  if (
    (bound === 'ControlLeft' || bound === 'ControlRight') &&
    (incoming === 'ControlLeft' || incoming === 'ControlRight')
  ) {
    return true;
  }
  if (
    (bound === 'AltLeft' || bound === 'AltRight') &&
    (incoming === 'AltLeft' || incoming === 'AltRight')
  ) {
    return true;
  }
  return false;
}

function isEditableElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export class InputManager {
  public moveX = 0;
  public moveZ = 0;
  public lookDeltaX = 0;
  public lookDeltaY = 0;

  public isSprinting = false;
  public isFiring = false;
  public isAiming = false;

  public jumpPressed = false;
  public vaultPressed = false;
  public crouchPressed = false;
  public pronePressed = false;
  public reloadPressed = false;
  public interactPressed = false;
  public cycleScopePressed = false;
  public backpackPressed = false;
  public medkitPressed = false;
  public smallMedkitPressed = false;
  public glooPressed = false;
  public quickGlooInstantPressed = false;
  public grenadePressed = false;
  public fireTapPressed = false;
  public revivePressed = false;
  public surfboardPressed = false;
  public quickSwapPressed = false;
  public minimapTogglePressed = false;
  public switchSlot: 1 | 2 | 3 | 4 | null = null;
  public cycleSlotDir: -1 | 0 | 1 = 0;
  public pointerLocked = false;

  public keyBindings: KeyBindingsConfig = { ...DEFAULT_KEY_BINDINGS };
  public emulatorMode = false;
  public aimToggleMode = false;
  public macros: MacroConfig[] = [];
  public ggMousePro: GgMouseProConfig = {
    ...DEFAULT_GG_MOUSE_PRO,
    pins: { ...DEFAULT_GG_MOUSE_PRO.pins },
  };
  public mouseSuspended = false;
  public mouseResetTimestamp = 0;
  public isRebinding = false;

  private isAimToggled = false;
  private pendingResetCamera = false;
  private pendingRelockAfterReset = false;
  private resetRelockTimer: number | null = null;
  private macroTimers = new Set<number>();
  private lastFreeMoveX: number | null = null;
  private lastFreeMoveY: number | null = null;

  private keys = new Set<string>();
  private activeCodes = new Set<string>();
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

  public configureControls(opts: {
    keyBindings?: Partial<KeyBindingsConfig>;
    emulatorMode?: boolean;
    aimToggleMode?: boolean;
    macros?: MacroConfig[];
    ggMousePro?: GgMouseProConfig;
  }): void {
    if (opts.keyBindings) {
      this.keyBindings = { ...DEFAULT_KEY_BINDINGS, ...opts.keyBindings };
    }
    if (typeof opts.emulatorMode === 'boolean') {
      this.emulatorMode = opts.emulatorMode;
    }
    if (typeof opts.aimToggleMode === 'boolean') {
      this.aimToggleMode = opts.aimToggleMode;
      if (!opts.aimToggleMode) {
        this.isAimToggled = false;
      }
    }
    if (Array.isArray(opts.macros)) {
      this.macros = opts.macros;
    }
    if (opts.ggMousePro) {
      this.ggMousePro = opts.ggMousePro;
    }
  }

  public setRebinding(active: boolean): void {
    this.isRebinding = active;
    if (active) {
      this.keys.clear();
      this.activeCodes.clear();
      this.isFiring = false;
      this.touchFire = false;
      this.fireTapPressed = false;
      this.isAiming = false;
      this.isDraggingMouse = false;
    }
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
      this.cancelAllMacros();
      this.isFiring = false;
      this.touchFire = false;
      this.isAiming = false;
      this.isAimToggled = false;
      this.touchAim = false;
      this.touchAutoSprint = false;
      this.isDraggingMouse = false;
      this.lastFreeMoveX = null;
      this.lastFreeMoveY = null;
      this.pendingRelockAfterReset = false;
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
  }

  public requestLock(): void {
    if (!this.allowPointerLock || !this.canvas || this.mouseSuspended) return;
    try {
      const res = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (res && typeof res.catch === 'function') {
        res.catch(() => {
          // Pointer lock cooldown or iframe restriction; fallback drag/free-look still works
        });
      }
    } catch {
      // Fallback drag look still works seamlessly
    }
  }

  public suspendMouseCursor(): void {
    this.mouseSuspended = true;
    this.isFiring = false;
    this.isAiming = false;
    this.isAimToggled = false;
    this.isDraggingMouse = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.lastFreeMoveX = null;
    this.lastFreeMoveY = null;
    this.pendingRelockAfterReset = false;
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // ignore
      }
    }
  }

  public resumeCameraFromCursor(): void {
    this.mouseSuspended = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.isDraggingMouse = false;
    this.lastFreeMoveX = null;
    this.lastFreeMoveY = null;
    this.requestLock();
  }

  public toggleMouseSuspension(): void {
    if (this.mouseSuspended) {
      this.resumeCameraFromCursor();
      return;
    }
    if (this.pointerLocked || this.emulatorMode || this.ggMousePro.enabled) {
      this.suspendMouseCursor();
    } else {
      // Not locked yet in normal PC mode: lock camera directly; pressing again suspends
      this.resumeCameraFromCursor();
    }
  }

  public resetMouse(): void {
    if (this.resetRelockTimer !== null) {
      window.clearTimeout(this.resetRelockTimer);
      this.resetRelockTimer = null;
    }
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.isFiring = false;
    this.isAiming = false;
    this.isAimToggled = false;
    this.isDraggingMouse = false;
    this.touchFire = false;
    this.touchAim = false;
    this.lastFreeMoveX = null;
    this.lastFreeMoveY = null;
    this.mouseSuspended = false;
    this.mouseResetTimestamp = performance.now();
    this.pendingResetCamera = true;
    this.pendingRelockAfterReset = true;

    if (document.pointerLockElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // ignore
      }
      this.resetRelockTimer = window.setTimeout(() => {
        this.resetRelockTimer = null;
        if (this.allowPointerLock && !this.mouseSuspended) {
          this.requestLock();
        }
      }, 45);
    } else if (this.allowPointerLock) {
      this.requestLock();
    }
  }

  public consumeResetCameraFlag(): boolean {
    const was = this.pendingResetCamera;
    this.pendingResetCamera = false;
    return was;
  }

  public setVirtualJoystick(x: number, y: number): void {
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveY = Math.max(-1, Math.min(1, y));
    if (y > 0.35) {
      this.touchAutoSprint = false;
    }
  }

  public addTouchLook(dx: number, dy: number): void {
    const boost = this.ggMousePro.enabled ? this.ggMousePro.aimDragBoost : 1;
    this.lookDeltaX += dx * boost;
    this.lookDeltaY += dy * boost;
  }

  public setTouchFire(active: boolean, forceTap = false): void {
    if (active && (!this.touchFire || forceTap)) {
      this.fireTapPressed = true;
    }
    this.touchFire = active;
  }

  public setTouchAim(active: boolean): void {
    this.touchAim = active;
    if (!active) {
      this.isAimToggled = false;
    }
  }

  public toggleTouchAim(): void {
    this.setTouchAim(!this.getAimActive());
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

  public triggerVault(): void {
    this.vaultPressed = true;
  }

  public triggerCrouch(): void {
    this.crouchPressed = true;
  }

  public triggerProne(): void {
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

  public triggerSmallMedkit(): void {
    this.smallMedkitPressed = true;
  }

  public triggerGloo(): void {
    this.glooPressed = true;
  }

  public triggerQuickGlooInstant(): void {
    this.quickGlooInstantPressed = true;
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

  public cancelAllMacros(): void {
    for (const id of this.macroTimers) {
      window.clearTimeout(id);
    }
    this.macroTimers.clear();
  }

  public executeMacroAction(action: MacroStepAction): void {
    switch (action) {
      case 'crouch':
        this.triggerCrouch();
        break;
      case 'prone':
        this.triggerProne();
        break;
      case 'jump':
        this.triggerJump();
        break;
      case 'vault':
        this.triggerVault();
        break;
      case 'aimToggle':
        this.toggleTouchAim();
        break;
      case 'aimOn':
        this.setTouchAim(true);
        break;
      case 'aimOff':
        this.setTouchAim(false);
        break;
      case 'fireTap':
        this.triggerFireTap();
        break;
      case 'fireHoldStart':
        this.setTouchFire(true);
        break;
      case 'fireHoldEnd':
        this.setTouchFire(false);
        break;
      case 'gloo':
        this.triggerGloo();
        break;
      case 'quickGlooInstant':
        this.triggerQuickGlooInstant();
        break;
      case 'grenade':
        this.triggerGrenade();
        break;
      case 'reload':
        this.triggerReload();
        break;
      case 'quickSwap':
        this.triggerQuickSwap();
        break;
      case 'cycleScope':
        this.triggerCycleScope();
        break;
      case 'slot1':
        this.triggerSlot(1);
        break;
      case 'slot2':
        this.triggerSlot(2);
        break;
      case 'slot3':
        this.triggerSlot(3);
        break;
      case 'slot4':
        this.triggerSlot(4);
        break;
      case 'interact':
        this.triggerInteract();
        break;
      case 'medkit':
        this.triggerMedkit();
        break;
      case 'smallMedkit':
        this.triggerSmallMedkit();
        break;
      case 'sprintOn':
        this.setTouchAutoSprint(true);
        break;
      case 'sprintOff':
        this.setTouchAutoSprint(false);
        break;
      case 'wait':
      default:
        break;
    }
  }

  public executeMacro(macroId: string): void {
    const macro = this.macros.find((m) => m.id === macroId && m.enabled);
    if (!macro || macro.steps.length === 0) return;

    const runStep = (idx: number, actionsThisFrame: Set<MacroStepAction>) => {
      if (idx >= macro.steps.length) return;
      const step = macro.steps[idx];
      if (step.action !== 'wait') {
        this.executeMacroAction(step.action);
        actionsThisFrame.add(step.action);
      }
      if (idx + 1 >= macro.steps.length) return;
      const nextStep = macro.steps[idx + 1];
      const sameToggleSameFrame =
        nextStep.action !== 'wait' &&
        (actionsThisFrame.has(nextStep.action) ||
          (nextStep.action === 'aimToggle' && (actionsThisFrame.has('aimOn') || actionsThisFrame.has('aimOff'))));

      if (step.delayMs <= 0 && !sameToggleSameFrame) {
        runStep(idx + 1, actionsThisFrame);
        return;
      }
      const waitMs = Math.max(sameToggleSameFrame ? 18 : 0, step.delayMs);
      const tId = window.setTimeout(() => {
        this.macroTimers.delete(tId);
        runStep(idx + 1, new Set<MacroStepAction>());
      }, waitMs);
      this.macroTimers.add(tId);
    };

    runStep(0, new Set<MacroStepAction>());
  }

  private hasActiveBinding(action: KeyBindAction): boolean {
    const target = this.keyBindings[action];
    for (const code of this.activeCodes) {
      if (codesMatch(target, code)) return true;
    }
    return false;
  }

  private isCodeForAction(action: KeyBindAction, code: string): boolean {
    return codesMatch(this.keyBindings[action], code);
  }

  public sample(): void {
    let kx = 0;
    let kz = 0;
    const fwdActive =
      this.hasActiveBinding('moveForward') ||
      (this.keyBindings.moveForward === 'KeyW' && this.keys.has('ArrowUp'));
    const backActive =
      this.hasActiveBinding('moveBackward') ||
      (this.keyBindings.moveBackward === 'KeyS' && this.keys.has('ArrowDown'));
    const leftActive =
      this.hasActiveBinding('moveLeft') ||
      (this.keyBindings.moveLeft === 'KeyA' && this.keys.has('ArrowLeft'));
    const rightActive =
      this.hasActiveBinding('moveRight') ||
      (this.keyBindings.moveRight === 'KeyD' && this.keys.has('ArrowRight'));

    if (fwdActive) kz += 1;
    if (backActive) kz -= 1;
    if (leftActive) kx -= 1;
    if (rightActive) kx += 1;

    if (kx !== 0 || kz < 0) {
      this.touchAutoSprint = false;
    }

    const autoZ =
      this.touchAutoSprint &&
      Math.abs(this.touchMoveX) < 0.15 &&
      Math.abs(this.touchMoveY) < 0.15 &&
      kz === 0
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
      this.hasActiveBinding('sprint') ||
      this.touchSprint ||
      this.touchAutoSprint;
  }

  public consumeLookAndEdges(): {
    dx: number;
    dy: number;
    jump: boolean;
    vault: boolean;
    crouch: boolean;
    prone: boolean;
    reload: boolean;
    interact: boolean;
    cycleScope: boolean;
    backpack: boolean;
    medkit: boolean;
    smallMedkit: boolean;
    gloo: boolean;
    quickGlooInstant: boolean;
    grenade: boolean;
    fireTap: boolean;
    revive: boolean;
    surfboard: boolean;
    quickSwap: boolean;
    minimapToggle: boolean;
    slot: 1 | 2 | 3 | 4 | null;
    cycleSlotDir: -1 | 0 | 1;
  } {
    const out = {
      dx: this.lookDeltaX,
      dy: this.lookDeltaY,
      jump: this.jumpPressed,
      vault: this.vaultPressed,
      crouch: this.crouchPressed,
      prone: this.pronePressed,
      reload: this.reloadPressed,
      interact: this.interactPressed,
      cycleScope: this.cycleScopePressed,
      backpack: this.backpackPressed,
      medkit: this.medkitPressed,
      smallMedkit: this.smallMedkitPressed,
      gloo: this.glooPressed,
      quickGlooInstant: this.quickGlooInstantPressed,
      grenade: this.grenadePressed,
      fireTap: this.fireTapPressed,
      revive: this.revivePressed,
      surfboard: this.surfboardPressed,
      quickSwap: this.quickSwapPressed,
      minimapToggle: this.minimapTogglePressed,
      slot: this.switchSlot,
      cycleSlotDir: this.cycleSlotDir,
    };
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.jumpPressed = false;
    this.vaultPressed = false;
    this.crouchPressed = false;
    this.pronePressed = false;
    this.reloadPressed = false;
    this.interactPressed = false;
    this.cycleScopePressed = false;
    this.backpackPressed = false;
    this.medkitPressed = false;
    this.smallMedkitPressed = false;
    this.glooPressed = false;
    this.quickGlooInstantPressed = false;
    this.grenadePressed = false;
    this.fireTapPressed = false;
    this.revivePressed = false;
    this.surfboardPressed = false;
    this.quickSwapPressed = false;
    this.minimapTogglePressed = false;
    this.switchSlot = null;
    this.cycleSlotDir = 0;
    return out;
  }

  public getFireActive(): boolean {
    return this.isFiring || this.touchFire;
  }

  public getAimActive(): boolean {
    if (this.mouseSuspended) return this.touchAim;
    return (this.aimToggleMode ? this.isAimToggled : this.isAiming) || this.touchAim;
  }

  private triggerPressForCode(code: string): void {
    this.activeCodes.add(code);

    if (this.isCodeForAction('toggleMouse', code)) {
      this.toggleMouseSuspension();
      return;
    }
    if (this.isCodeForAction('resetMouse', code)) {
      this.resetMouse();
      return;
    }

    if (this.isCodeForAction('fire', code)) {
      this.isFiring = true;
      this.fireTapPressed = true;
    }
    if (this.isCodeForAction('aim', code)) {
      if (this.aimToggleMode) {
        this.isAimToggled = !this.isAimToggled;
      } else {
        this.isAiming = true;
      }
    }
    if (this.isCodeForAction('jump', code)) this.jumpPressed = true;
    if (this.isCodeForAction('crouch', code)) this.triggerCrouch();
    if (this.isCodeForAction('prone', code)) this.triggerProne();
    if (this.isCodeForAction('reload', code)) this.reloadPressed = true;
    if (this.isCodeForAction('interact', code)) this.interactPressed = true;
    if (this.isCodeForAction('cycleScope', code)) this.cycleScopePressed = true;
    if (this.isCodeForAction('quickSwap', code)) this.quickSwapPressed = true;
    if (this.isCodeForAction('backpack', code)) this.backpackPressed = true;
    if (this.isCodeForAction('medkit', code)) this.medkitPressed = true;
    if (this.isCodeForAction('smallMedkit', code)) this.smallMedkitPressed = true;
    if (this.isCodeForAction('gloo', code)) this.glooPressed = true;
    if (this.isCodeForAction('quickGlooInstant', code)) this.quickGlooInstantPressed = true;
    if (this.isCodeForAction('grenade', code)) this.grenadePressed = true;
    if (this.isCodeForAction('revive', code)) this.revivePressed = true;
    if (this.isCodeForAction('surfboard', code)) this.surfboardPressed = true;
    if (this.isCodeForAction('minimap', code)) this.minimapTogglePressed = true;
    if (this.isCodeForAction('slot1', code)) this.switchSlot = 1;
    if (this.isCodeForAction('slot2', code)) this.switchSlot = 2;
    if (this.isCodeForAction('slot3', code)) this.switchSlot = 3;
    if (this.isCodeForAction('slot4', code)) this.switchSlot = 4;

    if (this.allowPointerLock) {
      for (let i = 0; i < this.macros.length; i++) {
        const m = this.macros[i];
        if (m.enabled && m.triggerKey && codesMatch(m.triggerKey, code)) {
          this.executeMacro(m.id);
        }
      }
    }
  }

  private triggerReleaseForCode(code: string): void {
    this.activeCodes.delete(code);
    if (this.isCodeForAction('fire', code)) {
      this.isFiring = false;
    }
    if (this.isCodeForAction('aim', code) && !this.aimToggleMode) {
      this.isAiming = false;
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.isRebinding || isEditableElement(e.target)) return;

    if (
      e.code === 'Tab' ||
      e.code === 'F1' ||
      e.code === 'F2' ||
      this.isCodeForAction('toggleMouse', e.code) ||
      this.isCodeForAction('resetMouse', e.code) ||
      this.isCodeForAction('backpack', e.code)
    ) {
      e.preventDefault();
    }

    if (e.repeat) {
      this.keys.add(e.code);
      this.activeCodes.add(e.code);
      return;
    }
    this.keys.add(e.code);
    this.triggerPressForCode(e.code);

    if (e.code === 'Escape' && this.onPauseCallback && !this.pointerLocked) {
      this.onPauseCallback();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.triggerReleaseForCode(e.code);
  };

  private handleBlur = (): void => {
    this.keys.clear();
    this.activeCodes.clear();
    this.isFiring = false;
    this.isAiming = false;
    this.isAimToggled = false;
    this.isDraggingMouse = false;
    this.lastFreeMoveX = null;
    this.lastFreeMoveY = null;
    this.touchFire = false;
    this.fireTapPressed = false;
    this.touchAim = false;
    this.touchSprint = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    this.lastFreeMoveX = null;
    this.lastFreeMoveY = null;
    if (this.pointerLocked) {
      this.pendingRelockAfterReset = false;
      this.mouseSuspended = false;
    }
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.isRebinding) return;
    if (this.allowPointerLock && !this.pointerLocked && !this.mouseSuspended) {
      this.requestLock();
    }
    const mouseCode = mouseButtonToCode(e.button);
    if (mouseCode) {
      if (!this.mouseSuspended || (mouseCode !== 'MouseLeft' && mouseCode !== 'MouseRight')) {
        this.triggerPressForCode(mouseCode);
      }
    }
    if (e.button === 0 && !this.mouseSuspended) {
      this.isDraggingMouse = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    const mouseCode = mouseButtonToCode(e.button);
    if (mouseCode) {
      this.triggerReleaseForCode(mouseCode);
    }
    if (e.button === 0) {
      this.isDraggingMouse = false;
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.isRebinding || this.mouseSuspended) return;

    const lookScale = this.ggMousePro.enabled ? this.ggMousePro.aimDragBoost : 1;

    if (this.pointerLocked) {
      // Filter sudden browser pointer-lock warp jumps (> 320px in a single event)
      if (Math.abs(e.movementX) > 320 || Math.abs(e.movementY) > 320) return;
      this.lookDeltaX += e.movementX * lookScale;
      this.lookDeltaY += e.movementY * lookScale;
      return;
    }

    if (this.pendingRelockAfterReset && this.allowPointerLock) {
      this.requestLock();
    }

    if (!this.pointerLocked && (e.buttons & 1) === 0) {
      if (this.isDraggingMouse) {
        this.isDraggingMouse = false;
      }
      if (this.isFiring && this.isCodeForAction('fire', 'MouseLeft')) {
        this.triggerReleaseForCode('MouseLeft');
      }
    }

    if (this.isDraggingMouse) {
      this.lookDeltaX += (e.clientX - this.lastMouseX) * lookScale;
      this.lookDeltaY += (e.clientY - this.lastMouseY) * lookScale;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      return;
    }

    if ((this.emulatorMode || this.ggMousePro.enabled) && this.allowPointerLock && e.target === this.canvas) {
      if (this.lastFreeMoveX !== null && this.lastFreeMoveY !== null) {
        const dx = e.clientX - this.lastFreeMoveX;
        const dy = e.clientY - this.lastFreeMoveY;
        if (Math.abs(dx) < 240 && Math.abs(dy) < 240) {
          this.lookDeltaX += dx * lookScale;
          this.lookDeltaY += dy * lookScale;
        }
      }
      this.lastFreeMoveX = e.clientX;
      this.lastFreeMoveY = e.clientY;
    } else {
      this.lastFreeMoveX = null;
      this.lastFreeMoveY = null;
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    if (!this.allowPointerLock || this.isRebinding) return;
    if (Math.abs(e.deltaY) < 4) return;
    const wheelCode = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
    const anyBoundToWheel =
      (Object.keys(this.keyBindings) as KeyBindAction[]).some((act) =>
        this.isCodeForAction(act, wheelCode),
      ) ||
      this.macros.some((m) => m.enabled && m.triggerKey && codesMatch(m.triggerKey, wheelCode));
    if (anyBoundToWheel) {
      this.triggerPressForCode(wheelCode);
      this.triggerReleaseForCode(wheelCode);
      return;
    }
    this.cycleSlotDir = e.deltaY > 0 ? 1 : -1;
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  public dispose(): void {
    this.cancelAllMacros();
    if (this.resetRelockTimer !== null) {
      window.clearTimeout(this.resetRelockTimer);
      this.resetRelockTimer = null;
    }
    this.detachCanvas();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }
}
