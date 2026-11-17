import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from './audio';
import { CharacterAnimator } from './characterAnimator';
import { CharacterRig, createCharacterRig } from './characterBuilder';
import { InputManager } from './inputManager';
import { createLobbyScene, LobbySceneHandle } from './lobbyScene';
import { GameStateMachine } from './stateMachine';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import {
  ATTACHMENT_LABELS,
  AttachmentKind,
  AttachmentSlotKey,
  BackpackItem,
  CharacterConfig,
  DamagePopup,
  GameSettings,
  GameState,
  HudSnapshot,
  KillFeedEntry,
  MatchMode,
  MinimapBuilding,
  MinimapRoad,
  NearbyLootSlot,
  PlayerStance,
  PoiMarker,
  SCOPE_META,
  ScopeType,
  VENDING_SHOP_OFFERS,
  VehicleHudState,
  WEAPONS,
  WeaponAttachments,
  WeaponDef,
  WeaponId,
  WeaponSlotState,
  WorldObbCollider,
} from './types';
import {
  createIslandWorld,
  LootVisual,
  TargetDummy,
  VehicleEntity,
  VendingMachineProp,
  WorldHandle,
} from './worldBuilder';

const SAFE_ZONE_PHASES = [
  { waitSec: 90, shrinkSec: 60, targetRadius: 320, damagePerSec: 2 },
  { waitSec: 75, shrinkSec: 55, targetRadius: 195, damagePerSec: 5 },
  { waitSec: 60, shrinkSec: 45, targetRadius: 110, damagePerSec: 10 },
  { waitSec: 45, shrinkSec: 40, targetRadius: 48, damagePerSec: 16 },
  { waitSec: 35, shrinkSec: 35, targetRadius: 10, damagePerSec: 25 },
];

const BACKPACK_CAPACITIES: Record<1 | 2 | 3, number> = {
  1: 80,
  2: 140,
  3: 220,
};

function emptyAttachments(): WeaponAttachments {
  return { muzzle: null, foregrip: null, magazine: null, stock: null };
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// Pre-allocated scratch helpers (zero GC inside render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _centerNdc = new THREE.Vector2(0, 0);
const _spreadNdc = new THREE.Vector2(0, 0);

const ALLY_NAME_POOL = [
  'Gabriel_BR',
  'Lucas_Capa',
  'Pedro_X1',
  'Matheus_FF',
  'Rafael_Pro',
  'Kauã_17',
  'Biel_Rush',
  'Enzo_Sniper',
  'Vini_Gelo',
  'Arthur_BR',
  'Cauã_Top1',
  'Davi_Mestre',
  'Igor_Bermuda',
  'Thiago_FF',
  'Yuri_AWM',
  'Luan_Rush',
  'Gustavo_17',
  'Bruno_Capa',
  'Diego_BR',
  'Samu_Pro',
  'Renan_G18',
  'Felipe_X1',
  'Murilo_FF',
  'Natan_BR',
  'Heitor_Pro',
  'Caio_17',
];

interface BulletTracer {
  mesh: THREE.Mesh;
  life: number;
  active: boolean;
}

interface AirDropCrate {
  id: string;
  x: number;
  z: number;
  y: number;
  groundY: number;
  state: 'falling' | 'landed' | 'looted';
  group: THREE.Group;
  chuteGroup: THREE.Group;
  beaconBeam: THREE.Mesh;
  beaconRing: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
}

export class BattleRoyaleEngine {
  public readonly stateMachine = new GameStateMachine();
  public readonly input = new InputManager();

  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private isSoftwareGl: boolean;
  private textures: ProceduralTextureSet;
  private envMap: THREE.Texture;

  private lobbyScene: LobbySceneHandle;
  private world: WorldHandle;
  private lobbyRig: CharacterRig;
  private playerRig: CharacterRig;
  private animator = new CharacterAnimator();

  private raycaster = new THREE.Raycaster();
  private tracerPool: BulletTracer[] = [];
  private tracerGeo = new THREE.BoxGeometry(0.035, 0.035, 1.8);
  private tracerMat = new THREE.MeshBasicMaterial({
    color: 0xffe27a,
    transparent: true,
    opacity: 0.9,
  });
  private solidObstaclesNoTerrain: THREE.Object3D[] = [];
  private scratchTargetMeshes: THREE.Object3D[] = [];
  private targetById = new Map<string, TargetDummy>();
  private crosshairCheckAccum = 0;
  private lastSunSnapX = Number.NaN;
  private lastSunSnapZ = Number.NaN;

  private glooWallGeo = new THREE.BoxGeometry(3.4, 2.35, 0.3);
  private glooPreviewMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.38,
  });
  private glooWallMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0891b2,
    emissiveIntensity: 0.35,
    roughness: 0.22,
    metalness: 0.12,
    transparent: true,
    opacity: 0.9,
  });
  private glooPreviewMesh: THREE.Mesh;
  private deployedGloos: Array<{
    id: string;
    mesh: THREE.Mesh;
    collider: WorldObbCollider;
    hp: number;
    life: number;
  }> = [];
  private nextGlooId = 1;

  private grenadeLinePositions = new Float32Array(26 * 3);
  private grenadeLineGeo = new THREE.BufferGeometry();
  private grenadeLineMat = new THREE.LineBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.92,
  });
  private grenadeLine: THREE.Line;
  private grenadeTargetGeo = new THREE.RingGeometry(0.42, 0.72, 20);
  private grenadeTargetMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  private grenadeTargetMesh: THREE.Mesh;
  private grenadeProjGeo = new THREE.SphereGeometry(0.14, 10, 8);
  private grenadeProjMat = new THREE.MeshStandardMaterial({
    color: 0x4d7c0f,
    roughness: 0.45,
    metalness: 0.4,
    emissive: 0x3f6212,
    emissiveIntensity: 0.35,
  });
  private thrownGrenades: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    active: boolean;
  }> = [];
  private explosionGeo = new THREE.SphereGeometry(1, 14, 10);
  private explosionVfx: Array<{
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    age: number;
    active: boolean;
  }> = [];

  // Periodic AirDrop system (crate + parachute + vertical sky beacon + ground ring)
  private airDropCrateGeo = new THREE.BoxGeometry(1.48, 1.35, 1.48);
  private airDropStripeGeo = new THREE.BoxGeometry(1.54, 0.28, 1.54);
  private airDropChuteGeo = new THREE.SphereGeometry(2.15, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  private airDropCordGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.8, 5);
  private airDropBeamGeo = new THREE.CylinderGeometry(0.45, 0.78, 165, 12, 1, true);
  private airDropRingGeo = new THREE.RingGeometry(1.15, 1.58, 22);
  private airDropCrateMat = new THREE.MeshStandardMaterial({
    color: 0x3f4739,
    roughness: 0.45,
    metalness: 0.52,
  });
  private airDropStripeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.3,
  });
  private airDropChuteMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.68,
    side: THREE.DoubleSide,
  });
  private airDropCordMat = new THREE.MeshBasicMaterial({ color: 0xe5e7eb });
  private airDrops: AirDropCrate[] = [];
  private nextAirDropId = 1;
  private airDropSpawnTimer = 22;
  private airDropCountSpawned = 0;
  private airDropNotice: string | null = null;
  private airDropNoticeTimer = 0;

  private healRingGeo = new THREE.RingGeometry(0.55, 0.82, 26);
  private healRingMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.78,
  });
  private healRingMesh: THREE.Mesh;
  private lastGunfightX = 0;
  private lastGunfightZ = 0;
  private lastGunfightTimer = 0;
  private launchPadFlightTimer = 0;

  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();
  private elapsed = 0;

  // Player simulation state
  private pos = new THREE.Vector3(-60, 2.2, 68);
  private vel = new THREE.Vector3();
  private yaw = 0;
  private characterYaw = 0;
  private combatFacingTimer = 0;
  private pitch = -0.14;
  private camPosCurrent = new THREE.Vector3();
  private camLookCurrent = new THREE.Vector3();
  private camDistCurrent = 3.75;
  private camShoulderCurrent = 0.42;
  private camShake = 0;
  private lobbyOrbitYaw = 0.22;
  private lobbyDragging = false;
  private lobbyLastX = 0;

  private stance: PlayerStance = 'stand';
  private isGrounded = true;
  private isSprinting = false;
  private isAiming = false;
  private wasAiming = false;
  private lockedTargetId: string | null = null;
  private aimBreakAccum = 0;
  private pullingUpTimer = 0;
  private bugDoCapaTimer = 0;
  private wasLockedWhileCrouched = false;
  private crouchLockedDist = 20;
  private aimLockedTarget = false;
  private aimAssistActive = false;
  private isDead = false;
  private deathTimer = 0;

  private hp = 200;
  private maxHp = 200;
  private vestLevel: 0 | 1 | 2 | 3 = 0;
  private vestHp = 0;
  private vestMaxHp = 0;
  private helmetLevel: 0 | 1 | 2 | 3 = 0;
  private helmetHp = 0;
  private helmetMaxHp = 0;
  private backpackLevel: 1 | 2 | 3 = 1;
  private medkitCount = 1;
  private glooCount = 2;
  private grenadeCount = 2;
  private isPlacingGloo = false;
  private isHoldingGrenade = false;
  private usingMedkit = false;
  private medkitTimer = 0;
  private readonly medkitDuration = 4.0;
  private backpackItems: BackpackItem[] = [];
  private nextBackpackItemId = 1;
  private vaultTimer = 0;
  private canVaultWindow = false;
  private revivingBotId: string | null = null;
  private reviveTimer = 0;
  private readonly reviveDuration = 3.0;

  private activeSlot: 1 | 2 | 3 = 3;
  private ownedScopes: ScopeType[] = ['none'];
  private weapons: Record<1 | 2 | 3, WeaponSlotState | null> = {
    1: null,
    2: null,
    3: {
      weaponId: 'g18',
      ammoInMag: 15,
      reserveAmmo: 60,
      scope: 'none',
      attachments: emptyAttachments(),
    },
  };
  private lastShotTime = 0;
  private consecutiveShots = 0;
  private wasFireDown = false;
  private reloadTimer = 0;
  private isReloading = false;
  private footstepAccum = 0;
  private damagePopupStagger = 0;

  // Match / Flight / Safe Zone timers
  private matchmakingTimer = 0;
  private waitingTimer = 10;
  private zonePhase = 1;
  private zoneIsShrinking = false;
  private zoneTimer = 90;
  private zoneShrinkTotal = 60;
  private zoneCurrentX = 0;
  private zoneCurrentZ = 0;
  private zoneCurrentRadius = 510;
  private zoneStartX = 0;
  private zoneStartZ = 0;
  private zoneStartRadius = 510;
  private zoneNextX = 0;
  private zoneNextZ = 0;
  private zoneNextRadius = 320;
  private zoneDmgAccum = 0;

  private airplaneProgress = 0; // 0..1 across island
  private planeStart = new THREE.Vector3(-490, 118, -320);
  private planeEnd = new THREE.Vector3(490, 118, 320);
  private aliveCount = 51;
  private kills = 0;
  private damageDealt = 0;
  private hitmarkerTimer = 0;
  private headshotFlashTimer = 0;
  private damageFlashTimer = 0;
  private damagePopups: DamagePopup[] = [];
  private nextDamagePopupId = 1;
  private damageIndicators: { id: number; worldX: number; worldZ: number; age: number }[] = [];
  private nextDamageIndicatorId = 1;
  private killFeed: KillFeedEntry[] = [];
  private nextKillFeedId = 1;
  private playerNick = 'SOBREVIVENTE';
  private matchMode: MatchMode = 'solo';
  private isRanked = false;
  private ffCoins = 100;
  private activeVehicleId: string | null = null;
  private prevCharYawForTurn = 0;
  private onLoadProgress?: (pct: number, label: string) => void;
  private loadTimers: number[] = [];

  // Settings & callbacks
  private settings: GameSettings;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onPauseRequest: () => void;
  private onBackpackRequest?: () => void;
  private onOpenShopRequest?: () => void;
  private hudEmitAccum = 0;
  private fpsAccumTime = 0;
  private fpsFrames = 0;
  private currentFps = 60;

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    initialChar: CharacterConfig,
    onHudUpdate: (snap: HudSnapshot) => void,
    onPauseRequest: () => void,
    onBackpackRequest?: () => void,
    onOpenShopRequest?: () => void,
  ) {
    this.container = container;
    this.settings = initialSettings;
    this.onHudUpdate = onHudUpdate;
    this.onPauseRequest = onPauseRequest;
    this.onBackpackRequest = onBackpackRequest;
    this.onOpenShopRequest = onOpenShopRequest;

    // 1. Software WebGL detection
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer setup (alpha enabled so nostalgic Lobby backdrop shows through 3D character)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && initialSettings.quality !== 'low',
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.applyQualitySettings(initialSettings);
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // 3. Studio IBL environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 4. Procedural textures & scenes
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);

    this.lobbyScene = createLobbyScene(this.textures, this.envMap);
    this.lobbyRig = createCharacterRig(
      initialChar,
      this.textures.camoParachute,
      this.textures.contactShadow,
    );
    this.lobbyRig.setWeapon(null);
    this.lobbyScene.characterAnchor.add(this.lobbyRig.root);

    this.world = createIslandWorld(this.textures, this.envMap);
    this.world.applyQuality(initialSettings.quality, this.isSoftwareGl);
    for (let i = 0; i < this.world.targets.length; i++) {
      this.targetById.set(this.world.targets[i].id, this.world.targets[i]);
    }
    // Exclude high-triangle terrainMesh from per-frame LOS/crosshair raycasts (handled analytically)
    this.solidObstaclesNoTerrain = this.world.obstacleMeshes.filter(
      (m) => m.name !== 'terrain-mesh',
    );
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat);
      mesh.visible = false;
      this.world.scene.add(mesh);
      this.tracerPool.push({ mesh, life: 0, active: false });
    }

    // Tactical Gloo Wall preview + Grenade trajectory line + projectile & explosion pools
    this.glooPreviewMesh = new THREE.Mesh(this.glooWallGeo, this.glooPreviewMat);
    this.glooPreviewMesh.visible = false;
    this.world.scene.add(this.glooPreviewMesh);

    this.grenadeLineGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.grenadeLinePositions, 3),
    );
    this.grenadeLine = new THREE.Line(this.grenadeLineGeo, this.grenadeLineMat);
    this.grenadeLine.frustumCulled = false;
    this.grenadeLine.visible = false;
    this.world.scene.add(this.grenadeLine);

    this.grenadeTargetMesh = new THREE.Mesh(this.grenadeTargetGeo, this.grenadeTargetMat);
    this.grenadeTargetMesh.rotation.x = -Math.PI / 2;
    this.grenadeTargetMesh.visible = false;
    this.world.scene.add(this.grenadeTargetMesh);

    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(this.grenadeProjGeo, this.grenadeProjMat);
      mesh.visible = false;
      this.world.scene.add(mesh);
      this.thrownGrenades.push({ mesh, vel: new THREE.Vector3(), active: false });

      const expMat = new THREE.MeshBasicMaterial({
        color: 0xff6b1a,
        transparent: true,
        opacity: 0.85,
      });
      const expMesh = new THREE.Mesh(this.explosionGeo, expMat);
      expMesh.visible = false;
      this.world.scene.add(expMesh);
      this.explosionVfx.push({ mesh: expMesh, mat: expMat, age: 0, active: false });
    }

    this.playerRig = createCharacterRig(
      initialChar,
      this.textures.camoParachute,
      this.textures.contactShadow,
    );
    this.playerRig.setWeapon('g18');
    this.world.scene.add(this.playerRig.root);

    this.healRingMesh = new THREE.Mesh(this.healRingGeo, this.healRingMat);
    this.healRingMesh.rotation.x = -Math.PI / 2;
    this.healRingMesh.visible = false;
    this.world.scene.add(this.healRingMesh);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.lobbyScene.scene, this.lobbyScene.camera);
      this.renderer.compile(this.world.scene, this.world.camera);
    }

    // Attach input
    this.input.attachCanvas(this.renderer.domElement, () => {
      const s = this.stateMachine.getState();
      if (s === GameState.PLAYING || s === GameState.WAITING) {
        this.onPauseRequest();
      }
    });
    this.renderer.domElement.addEventListener('pointerdown', this.onCanvasPointerDown);
    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('resize', this.handleResize);

    // Subscribe to state transitions
    this.stateMachine.subscribe((next) => {
      this.onStateEntered(next);
    });

    soundEngine.configure(initialSettings.soundVolume, initialSettings.muted);
    this.resetPlayerForWaiting();
    this.startLoop();
  }

  public setPlayerNickname(nick: string): void {
    const clean = nick.trim();
    if (clean.length > 0) {
      this.playerNick = clean.slice(0, 18);
    }
  }

  public getMapMetadata(): {
    buildings: MinimapBuilding[];
    roads: MinimapRoad[];
    pois: PoiMarker[];
  } {
    return {
      buildings: this.world.buildings,
      roads: this.world.roads,
      pois: this.world.pois,
    };
  }

  private getEnemyRenderDist(): number {
    if (this.settings.quality === 'low') return 66;
    if (this.settings.quality === 'high') return 138;
    return 100;
  }

  private getLootRenderDist(): number {
    if (this.settings.quality === 'low') return 32;
    if (this.settings.quality === 'high') return 82;
    return 54;
  }

  public applyQualitySettings(settings: GameSettings): void {
    this.settings = settings;
    soundEngine.configure(settings.soundVolume, settings.muted);

    const scale =
      this.isSoftwareGl
        ? 1
        : settings.quality === 'low'
          ? Math.min(window.devicePixelRatio, 0.85)
          : settings.quality === 'high'
            ? Math.min(window.devicePixelRatio, 2)
            : Math.min(window.devicePixelRatio, 1.35);
    this.renderer.setPixelRatio(scale);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && settings.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMappingExposure =
      settings.quality === 'low' ? 1.02 : settings.quality === 'high' ? 1.14 : 1.08;
    if (this.world) {
      this.world.applyQuality(settings.quality, this.isSoftwareGl);
      this.world.camera.far =
        settings.quality === 'low' ? 340 : settings.quality === 'high' ? 840 : 560;
      this.world.camera.updateProjectionMatrix();
    }
  }

  public updateCharacterConfig(config: CharacterConfig): void {
    this.lobbyRig.applyConfig(config);
    this.playerRig.applyConfig(config);
  }

  public setMatchMode(mode: MatchMode): void {
    this.matchMode = mode;
  }

  public getMatchMode(): MatchMode {
    return this.matchMode;
  }

  public setRankedMode(ranked: boolean): void {
    this.isRanked = ranked;
  }

  public getRankedMode(): boolean {
    return this.isRanked;
  }

  private clearLoadTimers(): void {
    for (let i = 0; i < this.loadTimers.length; i++) {
      clearTimeout(this.loadTimers[i]);
    }
    this.loadTimers.length = 0;
  }

  public startBootSequence(onProgress: (pct: number, label: string) => void): void {
    this.onLoadProgress = onProgress;
    this.clearLoadTimers();
    this.stateMachine.forceState(GameState.BOOT);
    this.loadTimers.push(
      window.setTimeout(() => {
        if (this.disposed) return;
        this.stateMachine.transition(GameState.LOADING);
        const steps = [
          { p: 18, t: 'Carregando ilha e terreno 3D...' },
          { p: 42, t: 'Gerando texturas clássicas...' },
          { p: 68, t: 'Montando personagens e armas...' },
          { p: 88, t: 'Carregando trilha clássica e áudio...' },
          { p: 100, t: 'Pronto para sobreviver!' },
        ];
        steps.forEach((step, idx) => {
          this.loadTimers.push(
            window.setTimeout(() => {
              if (this.disposed) return;
              onProgress(step.p, step.t);
              if (idx === steps.length - 1) {
                this.loadTimers.push(
                  window.setTimeout(() => {
                    if (!this.disposed) {
                      this.stateMachine.transition(GameState.MENU);
                    }
                  }, 320),
                );
              }
            }, (idx + 1) * 240),
          );
        });
      }, 380),
    );
  }

  private beginMatchLoading(target: 'waiting' | 'playing'): void {
    this.clearLoadTimers();
    this.onLoadProgress?.(10, 'Conectando à Ilha Bermuda...');
    this.stateMachine.forceState(GameState.LOADING);
    const steps = [
      { p: 32, t: 'Preparando sobreviventes e equipes...' },
      { p: 64, t: 'Distribuindo armas, coletes e loots nas casas...' },
      { p: 90, t: 'Sincronizando avião e zona segura...' },
      { p: 100, t: 'Entrando na partida!' },
    ];
    steps.forEach((step, idx) => {
      this.loadTimers.push(
        window.setTimeout(() => {
          if (this.disposed) return;
          this.onLoadProgress?.(step.p, step.t);
          if (idx === steps.length - 1) {
            this.loadTimers.push(
              window.setTimeout(() => {
                if (this.disposed) return;
                if (target === 'waiting') {
                  this.stateMachine.forceState(GameState.WAITING);
                } else {
                  this.resetPlayerForMatch(0, -10, false, true);
                  this.stateMachine.forceState(GameState.PLAYING);
                }
              }, 260),
            );
          }
        }, (idx + 1) * 290),
      );
    });
  }

  public startMatchmaking(): void {
    soundEngine.unlock();
    soundEngine.playUiConfirm();
    this.matchmakingTimer = 0;
    this.stateMachine.forceState(GameState.MATCHMAKING);
  }

  public cancelMatchmaking(): void {
    soundEngine.playUiClick(480);
    this.stateMachine.forceState(GameState.LOBBY);
  }

  public startQuickTraining(): void {
    soundEngine.unlock();
    soundEngine.playUiConfirm();
    this.beginMatchLoading('playing');
  }

  public skipWaitingToPlane(): void {
    soundEngine.playUiConfirm();
    this.enterAirplanePhase();
  }

  public jumpFromPlane(): void {
    if (this.stateMachine.getState() !== GameState.AIRPLANE) return;
    if (this.airplaneProgress < 0.08) return;
    soundEngine.playJump();
    this.vel.set(0, -4, 0);
    this.stateMachine.transition(GameState.DROPPING);

    // Allies jump simultaneously with player in V-formation!
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const formOffsets: Array<[number, number]> = [
      [-3.2, -2.6],
      [3.2, -2.6],
      [0.0, -4.6],
    ];
    let allyIdx = 0;
    for (let i = 0; i < this.world.targets.length; i++) {
      const b = this.world.targets[i];
      if (!b.isAlly || b.eliminated) continue;
      const [rx, fx] = formOffsets[allyIdx % formOffsets.length];
      allyIdx++;
      b.airState = 'skydiving';
      b.vy = -4;
      b.group.visible = true;
      if (b.parachuteMesh) b.parachuteMesh.visible = false;
      b.group.position.set(
        this.pos.x + rightX * rx + fwdX * fx,
        this.pos.y - 0.8,
        this.pos.z + rightZ * rx + fwdZ * fx,
      );
      b.group.rotation.y = this.yaw + Math.PI;
    }
  }

  public openParachute(): void {
    if (this.stateMachine.getState() !== GameState.DROPPING) return;
    soundEngine.playParachuteOpen();
    this.vel.y = Math.max(this.vel.y, -9);
    this.stateMachine.transition(GameState.PARACHUTE);

    // Allies pop camo parachutes in synchronized formation
    for (let i = 0; i < this.world.targets.length; i++) {
      const b = this.world.targets[i];
      if (!b.isAlly || b.eliminated) continue;
      if (b.airState === 'skydiving' || b.airState === 'inPlane') {
        b.airState = 'parachuting';
        b.vy = Math.max(b.vy, -9);
        b.group.visible = true;
        if (b.parachuteMesh) b.parachuteMesh.visible = true;
      }
    }
  }

  public returnToLobby(): void {
    this.clearLoadTimers();
    this.exitVehicleImmediate();
    soundEngine.stopVehicleAudio();
    this.input.setGameplayActive(false);
    this.stateMachine.forceState(GameState.LOBBY);
  }

  private applyPlayerDamage(
    rawDmg: number,
    attackerX: number,
    attackerZ: number,
    attackerName: string,
    weaponShort: string,
    isHead = false,
  ): void {
    if (this.isDead) return;
    let dmg = rawDmg;
    if (isHead && this.helmetLevel > 0 && this.helmetHp > 0) {
      const red = [0, 0.25, 0.38, 0.5][this.helmetLevel];
      this.helmetHp = Math.max(0, this.helmetHp - Math.round(rawDmg * 0.42));
      if (this.helmetHp === 0) this.helmetLevel = 0;
      dmg = Math.max(1, Math.round(rawDmg * (1 - red)));
    } else if (!isHead && this.vestLevel > 0 && this.vestHp > 0) {
      const red = [0, 0.2, 0.35, 0.48][this.vestLevel];
      this.vestHp = Math.max(0, this.vestHp - Math.round(rawDmg * 0.38));
      if (this.vestHp === 0) this.vestLevel = 0;
      dmg = Math.max(1, Math.round(rawDmg * (1 - red)));
    }

    this.hp = Math.max(0, this.hp - dmg);
    this.damageFlashTimer = 0.2;
    this.camShake = Math.max(this.camShake, 0.16);
    this.animator.triggerHit();
    if (this.damageIndicators.length >= 6) {
      this.damageIndicators.shift();
    }
    this.damageIndicators.push({
      id: this.nextDamageIndicatorId++,
      worldX: attackerX,
      worldZ: attackerZ,
      age: 0,
    });
    soundEngine.playDamage();

    if (this.hp <= 0) {
      this.exitVehicleImmediate();
      soundEngine.stopVehicleAudio();
      this.isDead = true;
      this.deathTimer = 1.6;
      this.input.setGameplayActive(false);
      this.pushKillFeed(attackerName, this.playerNick, weaponShort, isHead, false);
    }
  }

  public applyTestDamage(amount: number): void {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlashTimer = 0.25;
    this.camShake = 0.22;
    this.animator.triggerHit();
    soundEngine.playDamage();
    if (this.hp <= 0) {
      this.exitVehicleImmediate();
      soundEngine.stopVehicleAudio();
      this.isDead = true;
      this.deathTimer = 1.6;
      this.input.setGameplayActive(false);
    }
  }

  public triggerVictory(): void {
    this.exitVehicleImmediate();
    soundEngine.stopVehicleAudio();
    this.input.setGameplayActive(false);
    soundEngine.playUiConfirm();
    this.stateMachine.forceState(GameState.WIN);
  }

  private onStateEntered(state: GameState): void {
    const playable =
      state === GameState.WAITING ||
      state === GameState.DROPPING ||
      state === GameState.PARACHUTE ||
      state === GameState.PLAYING;
    this.input.setGameplayActive(playable);

    if (state !== GameState.WAITING && state !== GameState.PLAYING) {
      soundEngine.stopRunAudio();
      soundEngine.stopMedkitAudio();
      soundEngine.stopVehicleAudio();
    }

    if (state === GameState.WAITING) {
      this.resetPlayerForWaiting();
    } else if (state === GameState.AIRPLANE) {
      this.enterAirplanePhase();
    } else if (state === GameState.LOBBY || state === GameState.MENU) {
      this.lobbyOrbitYaw = 0;
    }
  }

  public setActiveWeaponScope(scope: ScopeType): void {
    const active = this.weapons[this.activeSlot];
    if (!active) return;
    const def = WEAPONS[active.weaponId];
    if (!def.allowsCustomScope) return;
    if (!this.ownedScopes.includes(scope)) return;
    active.scope = scope;
    soundEngine.playUiClick(740);
  }

  public cycleActiveWeaponScope(): void {
    const active = this.weapons[this.activeSlot];
    if (!active) return;
    const def = WEAPONS[active.weaponId];
    if (!def.allowsCustomScope) return;
    const idx = this.ownedScopes.indexOf(active.scope);
    const next = this.ownedScopes[(idx + 1) % this.ownedScopes.length];
    active.scope = next;
    soundEngine.playUiClick(740);
  }

  public useMedkit(): void {
    const state = this.stateMachine.getState();
    if (state !== GameState.PLAYING && state !== GameState.WAITING) return;
    if (this.isDead || this.usingMedkit) return;
    if (this.medkitCount <= 0 || this.hp >= this.maxHp) return;
    this.usingMedkit = true;
    this.medkitTimer = this.medkitDuration;
    this.isReloading = false;
    soundEngine.startMedkitAudio();
  }

  public dropMedkit(): void {
    if (this.medkitCount <= 0) return;
    this.medkitCount -= 1;
    this.spawnItemInFront({
      kind: 'medkit',
      label: 'Kit Médico (+75 HP)',
    });
    soundEngine.playUiClick(420);
  }

  public equipBackpackItem(itemId: string, targetSlot?: 1 | 2 | 3): void {
    const idx = this.backpackItems.findIndex((it) => it.id === itemId);
    if (idx < 0) return;
    const item = this.backpackItems[idx];

    if (item.kind === 'medkit') {
      this.useMedkit();
      return;
    }

    const slotToUse = targetSlot ?? this.activeSlot;
    const weaponState = this.weapons[slotToUse];
    if (!weaponState) return;
    const def = WEAPONS[weaponState.weaponId];

    if (item.kind === 'scope' && item.scopeType) {
      if (!def.allowsCustomScope) return;
      const oldScope = weaponState.scope;
      weaponState.scope = item.scopeType;
      if (item.quantity <= 1) {
        this.backpackItems.splice(idx, 1);
      } else {
        item.quantity -= 1;
      }
      if (oldScope !== 'none') {
        this.addScopeToBackpack(oldScope);
      }
      soundEngine.playUiClick(740);
      return;
    }

    if (item.kind === 'attachment' && item.attachmentKind) {
      if (!def.allowsAttachments) return;
      const attMeta = ATTACHMENT_LABELS[item.attachmentKind];
      const slotKey = attMeta.slot;
      const prevAtt = weaponState.attachments[slotKey];
      (weaponState.attachments as Record<AttachmentSlotKey, AttachmentKind | null>)[slotKey] =
        item.attachmentKind;

      if (item.quantity <= 1) {
        this.backpackItems.splice(idx, 1);
      } else {
        item.quantity -= 1;
      }
      if (prevAtt) {
        this.addAttachmentToBackpack(prevAtt);
      }
      soundEngine.playUiClick(760);
    }
  }

  public unequipWeaponAttachment(slot: 1 | 2 | 3, key: AttachmentSlotKey): void {
    const w = this.weapons[slot];
    if (!w) return;
    const current = w.attachments[key];
    if (!current) return;
    (w.attachments as Record<AttachmentSlotKey, AttachmentKind | null>)[key] = null;
    if (!this.addAttachmentToBackpack(current)) {
      this.spawnItemInFront({
        kind: 'attachment',
        attachmentKind: current,
        label: ATTACHMENT_LABELS[current].name,
      });
    }
    soundEngine.playUiClick(520);
  }

  public unequipWeaponScope(slot: 1 | 2 | 3): void {
    const w = this.weapons[slot];
    if (!w || !WEAPONS[w.weaponId].allowsCustomScope || w.scope === 'none') return;
    const old = w.scope;
    w.scope = 'none';
    if (!this.addScopeToBackpack(old)) {
      this.spawnItemInFront({
        kind: 'scope',
        scopeType: old,
        label: SCOPE_META[old].label,
      });
    }
    soundEngine.playUiClick(520);
  }

  public dropBackpackItem(itemId: string): void {
    const idx = this.backpackItems.findIndex((it) => it.id === itemId);
    if (idx < 0) return;
    const item = this.backpackItems[idx];
    if (item.kind === 'scope' && item.scopeType) {
      this.spawnItemInFront({
        kind: 'scope',
        scopeType: item.scopeType,
        label: item.label,
      });
    } else if (item.kind === 'attachment' && item.attachmentKind) {
      this.spawnItemInFront({
        kind: 'attachment',
        attachmentKind: item.attachmentKind,
        label: item.label,
      });
    } else if (item.kind === 'ammo') {
      this.spawnItemInFront({
        kind: 'ammo',
        ammoAmount: 30,
        label: 'Munição Tática (+30)',
      });
    }

    if (item.quantity <= 1) {
      this.backpackItems.splice(idx, 1);
    } else {
      item.quantity -= 1;
    }
    soundEngine.playUiClick(400);
  }

  public dropWeaponSlot(slot: 1 | 2 | 3): void {
    const w = this.weapons[slot];
    if (!w) return;
    // Always keep at least one firearm (slot 3 G18 or another primary)
    const occupied = ([1, 2, 3] as const).filter((s) => this.weapons[s] !== null);
    if (occupied.length <= 1) return;

    const def = WEAPONS[w.weaponId];
    this.spawnItemInFront({
      kind: 'weapon',
      weaponId: w.weaponId,
      label: def.name,
    });
    this.weapons[slot] = null;
    if (this.activeSlot === slot) {
      const next = ([1, 2, 3] as const).find((s) => this.weapons[s] !== null) ?? 3;
      this.activeSlot = next;
      const nw = this.weapons[next];
      this.playerRig.setWeapon(nw ? nw.weaponId : null);
    }
    soundEngine.playUiClick(410);
  }

  private getBackpackUsedWeight(): number {
    let w = this.medkitCount * 12;
    for (let i = 0; i < this.backpackItems.length; i++) {
      const it = this.backpackItems[i];
      const unitW = it.kind === 'scope' ? 10 : it.kind === 'attachment' ? 8 : 6;
      w += unitW * it.quantity;
    }
    return w;
  }

  private getBackpackCapacity(): number {
    return BACKPACK_CAPACITIES[this.backpackLevel];
  }

  private addScopeToBackpack(sc: ScopeType): boolean {
    if (sc === 'none' || sc === 'sniper') return false;
    if (!this.ownedScopes.includes(sc)) {
      this.ownedScopes.push(sc);
    }
    const existing = this.backpackItems.find(
      (i) => i.kind === 'scope' && i.scopeType === sc,
    );
    if (this.getBackpackUsedWeight() + 10 > this.getBackpackCapacity()) {
      return false;
    }
    if (existing) {
      existing.quantity += 1;
    } else {
      this.backpackItems.push({
        id: `bp_${this.nextBackpackItemId++}`,
        kind: 'scope',
        label: SCOPE_META[sc].label,
        quantity: 1,
        scopeType: sc,
      });
    }
    return true;
  }

  private addAttachmentToBackpack(att: AttachmentKind): boolean {
    if (this.getBackpackUsedWeight() + 8 > this.getBackpackCapacity()) {
      return false;
    }
    const existing = this.backpackItems.find(
      (i) => i.kind === 'attachment' && i.attachmentKind === att,
    );
    if (existing) {
      existing.quantity += 1;
    } else {
      this.backpackItems.push({
        id: `bp_${this.nextBackpackItemId++}`,
        kind: 'attachment',
        label: ATTACHMENT_LABELS[att].name,
        quantity: 1,
        attachmentKind: att,
      });
    }
    return true;
  }

  private spawnItemInFront(
    partial: {
      kind: 'ammo' | 'medkit' | 'weapon' | 'scope' | 'vest' | 'helmet' | 'backpack' | 'attachment';
      weaponId?: WeaponId;
      scopeType?: ScopeType;
      attachmentKind?: AttachmentKind;
      level?: 1 | 2 | 3;
      ammoAmount?: number;
      label: string;
    },
  ): void {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const dx = THREE.MathUtils.clamp(this.pos.x + fx * 1.45, -505, 505);
    const dz = THREE.MathUtils.clamp(this.pos.z + fz * 1.45, -505, 505);
    const dy = this.resolveFloorHeight(dx, dz, this.pos.y + 0.5) + 0.28;
    this.world.spawnDroppedLoot({
      ...partial,
      x: dx,
      y: dy,
      z: dz,
    });
  }

  private resetPlayerForWaiting(): void {
    this.waitingTimer = 10;
    this.resetPlayerForMatch(-215, -205, true);
  }

  private initSafeZone(): void {
    this.zonePhase = 1;
    this.zoneIsShrinking = false;
    this.zoneTimer = SAFE_ZONE_PHASES[0].waitSec;
    this.zoneShrinkTotal = SAFE_ZONE_PHASES[0].shrinkSec;
    this.zoneCurrentX = 0;
    this.zoneCurrentZ = 0;
    this.zoneCurrentRadius = 510;
    this.zoneStartX = 0;
    this.zoneStartZ = 0;
    this.zoneStartRadius = 510;
    this.zoneDmgAccum = 0;
    this.pickNextZoneCenter(0, 0, 510, SAFE_ZONE_PHASES[0].targetRadius);
    this.world.safeZoneMesh.position.set(0, 75, 0);
    this.world.safeZoneMesh.scale.set(510, 1, 510);
    this.world.safeZoneMesh.visible = false;
  }

  private pickNextZoneCenter(
    currX: number,
    currZ: number,
    currR: number,
    nextR: number,
  ): void {
    const maxShift = Math.max(0, currR - nextR) * 0.62;
    let nx = currX;
    let nz = currZ;
    for (let attempt = 0; attempt < 12; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * maxShift;
      const candX = currX + Math.cos(ang) * dist;
      const candZ = currZ + Math.sin(ang) * dist;
      if (Math.hypot(candX, candZ) <= 340 && this.world.groundHeightAt(candX, candZ) > 0.6) {
        nx = candX;
        nz = candZ;
        break;
      }
    }
    this.zoneNextX = nx;
    this.zoneNextZ = nz;
    this.zoneNextRadius = nextR;
  }

  private resetPlayerForMatch(
    startX: number,
    startZ: number,
    isWaitingLobby = false,
    startOnGround = false,
  ): void {
    const y = Math.max(0.5, this.world.groundHeightAt(startX, startZ));
    this.pos.set(startX, y, startZ);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.characterYaw = 0;
    this.combatFacingTimer = 0;
    this.pitch = -0.14;
    this.stance = 'stand';
    this.isGrounded = true;
    this.isAiming = false;
    this.wasAiming = false;
    this.lockedTargetId = null;
    this.aimBreakAccum = 0;
    this.pullingUpTimer = 0;
    this.bugDoCapaTimer = 0;
    this.wasLockedWhileCrouched = false;
    this.aimLockedTarget = false;
    this.aimAssistActive = false;
    this.vaultTimer = 0;
    this.canVaultWindow = false;
    this.revivingBotId = null;
    this.reviveTimer = 0;
    this.camDistCurrent = 3.75;
    this.camShoulderCurrent = 0.42;
    this.isDead = false;
    this.deathTimer = 0;
    this.hp = this.maxHp;
    this.vestLevel = 0;
    this.vestHp = 0;
    this.vestMaxHp = 0;
    this.helmetLevel = 0;
    this.helmetHp = 0;
    this.helmetMaxHp = 0;
    this.backpackLevel = 1;
    this.medkitCount = 1;
    this.glooCount = 2;
    this.grenadeCount = 2;
    this.isPlacingGloo = false;
    this.isHoldingGrenade = false;
    this.consecutiveShots = 0;
    this.usingMedkit = false;
    this.medkitTimer = 0;
    this.backpackItems = [];
    this.kills = 0;
    this.damageDealt = 0;
    this.ffCoins = 100;
    this.activeVehicleId = null;
    this.prevCharYawForTurn = 0;
    this.headshotFlashTimer = 0;
    this.damagePopups = [];
    this.damageIndicators = [];
    this.killFeed = [];
    this.aliveCount = 1 + this.world.targets.length;

    // Start ONLY with Glock G18 (Slot 3) when dropping into Battle Royale
    this.activeSlot = 3;
    this.ownedScopes = ['none'];
    this.weapons = {
      1: null,
      2: null,
      3: {
        weaponId: 'g18',
        ammoInMag: WEAPONS.g18.magSize,
        reserveAmmo: 60,
        scope: 'none',
        attachments: emptyAttachments(),
      },
    };
    this.isReloading = false;
    this.reloadTimer = 0;
    this.playerRig.setWeapon('g18');
    this.playerRig.weaponMount.visible = true;
    this.playerRig.root.visible = true;
    this.animator.reset();
    this.healRingMesh.visible = false;
    this.lastGunfightTimer = 0;
    this.launchPadFlightTimer = 0;

    this.clearDeployedGloos();
    this.glooPreviewMesh.visible = false;
    this.grenadeLine.visible = false;
    this.grenadeTargetMesh.visible = false;
    for (let i = 0; i < this.thrownGrenades.length; i++) {
      this.thrownGrenades[i].active = false;
      this.thrownGrenades[i].mesh.visible = false;
    }
    for (let i = 0; i < this.explosionVfx.length; i++) {
      this.explosionVfx[i].active = false;
      this.explosionVfx[i].mesh.visible = false;
    }

    this.world.clearDroppedLoots();
    this.world.resetExplosiveBarrels();
    this.world.resetVehicles();
    soundEngine.stopVehicleAudio();
    this.clearAirDrops();
    this.airDropSpawnTimer = 22;
    this.airDropCountSpawned = 0;
    this.airDropNotice = null;
    this.airDropNoticeTimer = 0;
    this.initSafeZone();

    // Shuffle fresh Brazilian nicknames for allies each match
    const shuffledNicks = [...ALLY_NAME_POOL];
    for (let s = shuffledNicks.length - 1; s > 0; s--) {
      const r = Math.floor(Math.random() * (s + 1));
      const tmp = shuffledNicks[s];
      shuffledNicks[s] = shuffledNicks[r];
      shuffledNicks[r] = tmp;
    }
    const chosenAllyNicks = shuffledNicks.slice(0, 3);

    // Pick land POIs excluding bridges
    const landPois = this.world.pois.filter((p) => !p.name.startsWith('PONTE'));

    // Reset all 50 bots with Solo/Duo/Squad team assignments
    for (let i = 0; i < this.world.targets.length; i++) {
      const b = this.world.targets[i];
      b.hp = b.maxHp;
      b.isDowned = false;
      b.bleedHp = 100;
      b.knockedByPlayer = false;
      b.downTimer = 0;
      b.eliminated = false;
      b.hitFlash = 0;
      b.vestLevel = 0;
      b.vestHp = 0;
      b.vestMaxHp = 0;
      b.helmetLevel = 0;
      b.helmetHp = 0;
      b.helmetMaxHp = 0;
      if (b.vestMesh) b.vestMesh.visible = false;
      if (b.helmetMesh) b.helmetMesh.visible = false;
      if (b.torsoGroup) {
        b.torsoGroup.position.set(0, 0.78, 0);
        b.torsoGroup.rotation.set(0, 0, 0);
      }
      if (b.headMesh) b.headMesh.rotation.set(0, 0, 0);
      if (b.legLPivot) {
        b.legLPivot.position.set(-0.1, 0.78, 0);
        b.legLPivot.rotation.set(0, 0, 0);
      }
      if (b.legRPivot) {
        b.legRPivot.position.set(0.1, 0.78, 0);
        b.legRPivot.rotation.set(0, 0, 0);
      }
      if (b.armLPivot) b.armLPivot.rotation.set(0, 0, 0);
      if (b.armRPivot) b.armRPivot.rotation.set(0, 0, 0);
      if (b.armL) b.armL.rotation.set(0, 0, 0);
      if (b.armR) b.armR.rotation.set(0, 0, 0);
      if (b.gunMesh) b.gunMesh.visible = true;
      b.weaponId = 'g18';
      b.medkits = 1;
      b.gloos = 2;
      b.glooCooldown = 0;
      b.healTimer = 0;
      b.revivingMateId = null;
      b.reviveTimer = 0;
      b.huntTimer = 1.0 + (i % 5) * 0.55;
      b.vy = 0;
      b.targetId = null;
      b.aiTimer = 0.2 + ((i * 19) % 15) * 0.05;
      b.fireCooldown = 0.5 + (i % 4) * 0.2;

      if (this.matchMode === 'duo') {
        if (i === 0) {
          b.teamId = 0;
          b.isAlly = true;
          b.nick = chosenAllyNicks[0];
        } else {
          b.teamId = 1 + Math.floor((i - 1) / 2);
          b.isAlly = false;
        }
      } else if (this.matchMode === 'squad') {
        if (i < 3) {
          b.teamId = 0;
          b.isAlly = true;
          b.nick = chosenAllyNicks[i % chosenAllyNicks.length];
        } else {
          b.teamId = 1 + Math.floor((i - 3) / 4);
          b.isAlly = false;
        }
      } else {
        b.teamId = i + 1;
        b.isAlly = false;
      }

      // Group teammates into the same drop POI so squads/duos fight together
      const poiIdx =
        this.matchMode === 'solo'
          ? i % landPois.length
          : b.isAlly
            ? 0
            : b.teamId % landPois.length;
      const poi = landPois[poiIdx];
      const ang = (i * 2.39996) % (Math.PI * 2);
      const rad = this.matchMode === 'solo' ? 10 + (i % 6) * 8 : 6 + (i % 4) * 5;
      let lx = poi.x + Math.cos(ang) * rad;
      let lz = poi.z + Math.sin(ang) * rad;
      if (this.world.groundHeightAt(lx, lz) < 0.75) {
        lx = poi.x;
        lz = poi.z;
      }
      b.landX = lx;
      b.landZ = lz;

      if (isWaitingLobby) {
        b.airState = 'ground';
        const wx = -215 + Math.cos(ang) * (8 + (i % 5) * 6);
        const wz = -205 + Math.sin(ang) * (8 + (i % 5) * 6);
        const sy = Math.max(1.0, this.world.groundHeightAt(wx, wz));
        b.group.position.set(wx, sy, wz);
        b.group.rotation.set(0, (i * 1.1) % (Math.PI * 2), 0);
        b.group.visible = true;
        if (b.parachuteMesh) b.parachuteMesh.visible = false;
        b.aiState = 'roam';
        b.goalX = wx + Math.cos(i) * 14;
        b.goalZ = wz + Math.sin(i) * 14;
      } else if (startOnGround) {
        b.airState = 'ground';
        const gx = b.isAlly ? startX + ((i === 0 ? -3.4 : i === 1 ? 3.4 : 0)) : lx;
        const gz = b.isAlly ? startZ + 4.0 : lz;
        const gy = Math.max(0.8, this.world.groundHeightAt(gx, gz));
        b.group.position.set(gx, gy, gz);
        b.group.rotation.set(0, 0, 0);
        b.group.visible = true;
        if (b.parachuteMesh) b.parachuteMesh.visible = false;
        b.aiState = b.isAlly ? 'roam' : 'loot';
        b.goalX = gx;
        b.goalZ = gz;
      } else {
        b.airState = 'inPlane';
        if (b.isAlly) {
          // Allies wait inside the airplane until the player jumps
          b.dropProgress = 1.05;
        } else {
          const teamDropBase =
            this.matchMode === 'solo'
              ? (i * 0.6180339887) % 1
              : (b.teamId * 0.6180339887) % 1;
          b.dropProgress = 0.08 + teamDropBase * 0.76 + (i % 4) * 0.015;
        }
        b.group.visible = false;
        if (b.parachuteMesh) b.parachuteMesh.visible = false;
        b.aiState = 'loot';
        b.goalX = lx;
        b.goalZ = lz;
      }
    }

    // Reset loot visibility
    this.world.loots.forEach((l) => {
      l.data.collected = false;
      l.mesh.visible = true;
    });

    this.camPosCurrent.set(startX + 1.5, y + 2.4, startZ + 4.5);
    this.camLookCurrent.set(startX, y + 1.4, startZ);
  }

  private enterAirplanePhase(): void {
    this.airplaneProgress = 0;
    const angle = Math.random() * Math.PI * 2;
    const r = 505;
    this.planeStart.set(Math.cos(angle) * r, 118, Math.sin(angle) * r);
    this.planeEnd.set(-Math.cos(angle) * r, 118, -Math.sin(angle) * r);
    this.world.airplaneGroup.visible = true;
    this.world.airplaneGroup.position.copy(this.planeStart);
    this.world.airplaneGroup.lookAt(this.planeEnd);

    this.resetPlayerForMatch(this.planeStart.x, this.planeStart.z, false);
    this.pos.copy(this.planeStart);
    this.isGrounded = false;
    if (this.stateMachine.getState() !== GameState.AIRPLANE) {
      this.stateMachine.forceState(GameState.AIRPLANE);
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      this.elapsed += dt;

      this.fpsAccumTime += rawDt;
      this.fpsFrames++;
      if (this.fpsAccumTime >= 0.4) {
        this.currentFps = Math.round(this.fpsFrames / this.fpsAccumTime);
        this.fpsAccumTime = 0;
        this.fpsFrames = 0;
      }

      this.updateSimulation(dt);
      this.renderActiveScene();

      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.05) {
        this.hudEmitAccum = 0;
        this.onHudUpdate(this.buildHudSnapshot());
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (status === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSimulation(dt: number): void {
    const state = this.stateMachine.getState();

    // Update continuous flight / wind audio loop
    soundEngine.setFlightAudioMode(
      state === GameState.AIRPLANE
        ? 'airplane'
        : state === GameState.DROPPING
          ? 'skydiving'
          : state === GameState.PARACHUTE
            ? 'parachute'
            : 'none',
    );

    // Lobby 2017 theme: plays in Lobby/Waiting Island and softly through Airplane/Parachute drop
    soundEngine.setLobbyMusicMode(
      state === GameState.MENU ||
        state === GameState.LOBBY ||
        state === GameState.MATCHMAKING ||
        state === GameState.BOOT ||
        state === GameState.LOADING
        ? 'lobby'
        : state === GameState.WAITING
          ? 'waiting'
          : state === GameState.AIRPLANE ||
              state === GameState.DROPPING ||
              state === GameState.PARACHUTE
            ? 'drop'
            : 'off',
    );

    // Update Lobby 3D character standing centered on beach backdrop
    if (
      state === GameState.BOOT ||
      state === GameState.LOADING ||
      state === GameState.MENU ||
      state === GameState.LOBBY ||
      state === GameState.MATCHMAKING
    ) {
      if (state === GameState.MATCHMAKING) {
        this.matchmakingTimer += dt;
        if (this.matchmakingTimer >= 2.6) {
          this.beginMatchLoading('waiting');
        }
      }

      this.lobbyRig.root.rotation.y =
        this.lobbyOrbitYaw + Math.sin(this.elapsed * 0.75) * 0.06;
      this.animator.update(this.lobbyRig, {
        dt,
        speed: 0,
        stance: 'stand',
        isGrounded: true,
        isSprinting: false,
        isAiming: false,
        isFiring: false,
        isLobby: true,
        isSkydiving: false,
        isParachuting: false,
        isDead: false,
        pitchRad: 0,
      });

      this.lobbyScene.camera.position.x = THREE.MathUtils.damp(
        this.lobbyScene.camera.position.x,
        0,
        8,
        dt,
      );
      this.lobbyScene.camera.position.y = THREE.MathUtils.damp(
        this.lobbyScene.camera.position.y,
        1.14,
        8,
        dt,
      );
      this.lobbyScene.camera.position.z = THREE.MathUtils.damp(
        this.lobbyScene.camera.position.z,
        3.72,
        8,
        dt,
      );
      this.lobbyScene.camera.lookAt(0, 0.84, 0);
      return;
    }

    // World dynamic props, deployed Gloos, thrown grenades, explosion VFX & tracers
    const inMatchView = state === GameState.PLAYING || state === GameState.WAITING;
    this.world.updateDynamicProps(
      dt,
      this.elapsed,
      this.world.camera.position,
      inMatchView ? this.getLootRenderDist() : 280,
    );
    this.updateDeployedGloos(dt);
    this.updateThrownGrenades(dt);
    this.updateExplosionVfx(dt);
    this.updateTracers(dt);
    this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - dt);
    this.headshotFlashTimer = Math.max(0, this.headshotFlashTimer - dt);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    this.lastGunfightTimer = Math.max(0, this.lastGunfightTimer - dt);
    this.camShake = THREE.MathUtils.damp(this.camShake, 0, 14, dt);
    for (let i = this.damagePopups.length - 1; i >= 0; i--) {
      this.damagePopups[i].age += dt;
      if (this.damagePopups[i].age >= 0.78) {
        this.damagePopups.splice(i, 1);
      }
    }
    for (let i = this.damageIndicators.length - 1; i >= 0; i--) {
      this.damageIndicators[i].age += dt;
      if (this.damageIndicators[i].age >= 1.45) {
        this.damageIndicators.splice(i, 1);
      }
    }
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].age += dt;
      if (this.killFeed[i].age >= 4.4) {
        this.killFeed.splice(i, 1);
      }
    }

    if (
      state === GameState.WAITING ||
      state === GameState.AIRPLANE ||
      state === GameState.DROPPING ||
      state === GameState.PARACHUTE ||
      state === GameState.PLAYING
    ) {
      this.updateBots(dt, state);
    }

    // Waiting Island countdown
    if (state === GameState.WAITING) {
      this.waitingTimer = Math.max(0, this.waitingTimer - dt);
      if (this.waitingTimer <= 0) {
        this.enterAirplanePhase();
        return;
      }
    }

    // Airplane flight phase
    if (state === GameState.AIRPLANE) {
      this.input.sample();
      const edges = this.input.consumeLookAndEdges();
      const sens = 0.0028 * this.settings.sensitivity;
      const invert = this.settings.invertY ? -1 : 1;
      this.yaw -= edges.dx * sens;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - edges.dy * sens * invert,
        -1.1,
        0.5,
      );

      this.airplaneProgress += dt * 0.036;
      this.pos.lerpVectors(this.planeStart, this.planeEnd, this.airplaneProgress);
      this.world.airplaneGroup.position.copy(this.pos);
      this.playerRig.root.visible = false;

      if (edges.jump || edges.interact) {
        this.jumpFromPlane();
        return;
      }
      if (this.airplaneProgress >= 0.96) {
        this.jumpFromPlane();
        return;
      }

      // Orbit camera behind/around plane
      const dist = 26;
      const horiz = Math.cos(this.pitch) * dist;
      _camDesired.set(
        this.pos.x + Math.sin(this.yaw) * horiz,
        this.pos.y - Math.sin(this.pitch) * dist + 4,
        this.pos.z + Math.cos(this.yaw) * horiz,
      );
      this.camPosCurrent.lerp(_camDesired, 1 - Math.exp(-8 * dt));
      this.camLookCurrent.lerp(this.pos, 1 - Math.exp(-10 * dt));
      this.world.camera.position.copy(this.camPosCurrent);
      this.world.camera.lookAt(this.camLookCurrent);
      return;
    }

    this.playerRig.root.visible = true;

    // Dropping (Skydiving) & Parachute
    if (state === GameState.DROPPING || state === GameState.PARACHUTE) {
      this.world.airplaneGroup.position.lerpVectors(
        this.planeStart,
        this.planeEnd,
        Math.min(1, this.airplaneProgress + dt * 0.036),
      );
      this.airplaneProgress += dt * 0.036;
      if (this.airplaneProgress >= 1.08) {
        this.world.airplaneGroup.visible = false;
      }

      this.input.sample();
      const edges = this.input.consumeLookAndEdges();
      const sens = 0.0028 * this.settings.sensitivity;
      const invert = this.settings.invertY ? -1 : 1;
      this.yaw -= edges.dx * sens;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - edges.dy * sens * invert,
        -1.15,
        0.65,
      );

      const isChute = state === GameState.PARACHUTE;
      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);

      if (this.launchPadFlightTimer > 0) {
        this.launchPadFlightTimer = Math.max(0, this.launchPadFlightTimer - dt);
        this.vel.y -= 14.5 * dt;
      } else {
        const moveSpeed = isChute ? 17 : 26;
        const mx = (forwardX * this.input.moveZ + rightX * this.input.moveX) * moveSpeed;
        const mz = (forwardZ * this.input.moveZ + rightZ * this.input.moveX) * moveSpeed;
        this.vel.x = THREE.MathUtils.damp(this.vel.x, mx, 4, dt);
        this.vel.z = THREE.MathUtils.damp(this.vel.z, mz, 4, dt);
        this.vel.y = THREE.MathUtils.damp(this.vel.y, isChute ? -8.5 : -28, 3.5, dt);
      }

      this.pos.addScaledVector(this.vel, dt);
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -505, 505);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -505, 505);

      const groundY = Math.max(0, this.resolveFloorHeight(this.pos.x, this.pos.z, this.pos.y));
      const altitude = this.pos.y - groundY;

      if (!isChute && (edges.jump || edges.interact || (this.vel.y < -2.0 && altitude < 28))) {
        this.launchPadFlightTimer = 0;
        this.openParachute();
      }
      if (this.pos.y <= groundY && this.vel.y <= 0) {
        this.launchPadFlightTimer = 0;
        this.pos.y = groundY;
        this.vel.set(0, 0, 0);
        this.isGrounded = true;
        this.animator.triggerLanding();
        this.world.airplaneGroup.visible = false;
        soundEngine.playLanding();
        this.stateMachine.transition(GameState.PLAYING);
      }

      this.characterYaw = this.yaw;
      this.playerRig.root.position.copy(this.pos);
      this.playerRig.root.rotation.y = this.characterYaw + Math.PI;
      this.animator.update(this.playerRig, {
        dt,
        speed: Math.hypot(this.vel.x, this.vel.z),
        stance: 'stand',
        isGrounded: false,
        isSprinting: false,
        isAiming: false,
        isFiring: false,
        isLobby: false,
        isSkydiving: !isChute,
        isParachuting: isChute,
        isDead: false,
        pitchRad: this.pitch,
      });

      this.updateThirdPersonCamera(dt, isChute ? 6.5 : 5.2, isChute ? 1.8 : 1.4);
      return;
    }

    // Active Ground Gameplay (WAITING or PLAYING)
    if (state === GameState.WAITING || state === GameState.PLAYING) {
      if (state === GameState.PLAYING) {
        this.updateSafeZone(dt);
        this.updateAirDrops(dt);
      } else {
        this.world.safeZoneMesh.visible = false;
      }

      this.updateVehicles(dt);

      if (this.isDead) {
        this.isAiming = false;
        this.usingMedkit = false;
        this.healRingMesh.visible = false;
        this.playerRig.weaponMount.visible = true;
        this.playerRig.root.visible = true;
        this.lockedTargetId = null;
        this.deathTimer -= dt;
        this.animator.update(this.playerRig, {
          dt,
          speed: 0,
          stance: this.stance,
          isGrounded: true,
          isSprinting: false,
          isAiming: false,
          isFiring: false,
          isLobby: false,
          isSkydiving: false,
          isParachuting: false,
          isDead: true,
          pitchRad: 0,
        });
        this.updateThirdPersonCamera(dt, 4.2, 1.0);
        if (this.deathTimer <= 0) {
          this.stateMachine.forceState(GameState.GAMEOVER);
        }
        return;
      }

      if (this.activeVehicleId) {
        this.updateDrivingPlayer(dt);
      } else {
        this.updateGroundPlayer(dt);
      }
    }
  }

  private updateSafeZone(dt: number): void {
    const phaseIdx = Math.min(SAFE_ZONE_PHASES.length - 1, this.zonePhase - 1);
    const phaseDef = SAFE_ZONE_PHASES[phaseIdx];

    if (this.airplaneProgress < 1.08) {
      this.airplaneProgress += dt * 0.036;
      if (this.airplaneProgress >= 1.08) {
        this.world.airplaneGroup.visible = false;
      }
    }

    this.zoneTimer = Math.max(0, this.zoneTimer - dt);

    if (!this.zoneIsShrinking) {
      if (this.zoneTimer <= 0) {
        this.zoneIsShrinking = true;
        this.zoneStartX = this.zoneCurrentX;
        this.zoneStartZ = this.zoneCurrentZ;
        this.zoneStartRadius = this.zoneCurrentRadius;
        this.zoneShrinkTotal = phaseDef.shrinkSec;
        this.zoneTimer = phaseDef.shrinkSec;
      }
    } else {
      const t = THREE.MathUtils.clamp(
        1 - this.zoneTimer / Math.max(1, this.zoneShrinkTotal),
        0,
        1,
      );
      this.zoneCurrentX = THREE.MathUtils.lerp(this.zoneStartX, this.zoneNextX, t);
      this.zoneCurrentZ = THREE.MathUtils.lerp(this.zoneStartZ, this.zoneNextZ, t);
      this.zoneCurrentRadius = THREE.MathUtils.lerp(
        this.zoneStartRadius,
        this.zoneNextRadius,
        t,
      );

      if (this.zoneTimer <= 0) {
        this.zoneCurrentX = this.zoneNextX;
        this.zoneCurrentZ = this.zoneNextZ;
        this.zoneCurrentRadius = this.zoneNextRadius;
        this.zoneIsShrinking = false;

        if (this.zonePhase < SAFE_ZONE_PHASES.length) {
          this.zonePhase += 1;
          const nextDef = SAFE_ZONE_PHASES[this.zonePhase - 1];
          this.zoneTimer = nextDef.waitSec;
          this.pickNextZoneCenter(
            this.zoneCurrentX,
            this.zoneCurrentZ,
            this.zoneCurrentRadius,
            nextDef.targetRadius,
          );
        } else {
          this.zoneTimer = 0;
        }
      }
    }

    this.world.safeZoneMesh.visible = true;
    this.world.safeZoneMesh.position.set(this.zoneCurrentX, 75, this.zoneCurrentZ);
    const visR = Math.max(4, this.zoneCurrentRadius);
    this.world.safeZoneMesh.scale.set(visR, 1, visR);

    // Apply real Safe Zone damage outside the blue barrier (can eliminate player!)
    const playerDist = Math.hypot(
      this.pos.x - this.zoneCurrentX,
      this.pos.z - this.zoneCurrentZ,
    );
    if (!this.isDead && playerDist > this.zoneCurrentRadius) {
      this.zoneDmgAccum += phaseDef.damagePerSec * dt;
      if (this.zoneDmgAccum >= 1) {
        const tickDmg = Math.floor(this.zoneDmgAccum);
        this.zoneDmgAccum -= tickDmg;
        this.hp = Math.max(0, this.hp - tickDmg);
        this.damageFlashTimer = 0.14;
        if (this.hp <= 0) {
          this.isDead = true;
          this.deathTimer = 1.6;
          this.input.setGameplayActive(false);
        }
      }
    } else {
      this.zoneDmgAccum = 0;
    }
  }

  private getScopeSensitivityScale(scope: ScopeType): number {
    if (!this.isAiming) return this.settings.sensitivity;
    if (scope === 'none' || scope === '1x') {
      return this.settings.redDotSensitivity * (scope === '1x' ? 0.78 : 0.88);
    }
    if (scope === '2x') return this.settings.scope2xSensitivity * 0.56;
    if (scope === '4x') return this.settings.scope4xSensitivity * 0.36;
    return this.settings.sniperSensitivity * 0.24;
  }

  private hasTerrainObstruction(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    dist: number,
  ): boolean {
    if (dist <= 2) return false;
    const steps = dist > 45 ? 8 : 5;
    for (let s = 1; s < steps; s++) {
      const t = (s / steps) * dist;
      const sx = origin.x + dir.x * t;
      const sy = origin.y + dir.y * t;
      const sz = origin.z + dir.z * t;
      if (sy < this.world.groundHeightAt(sx, sz) - 0.12) {
        return true;
      }
    }
    return false;
  }

  private raycastTerrainDist(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxRange: number,
  ): number {
    const steps = 14;
    const stepLen = maxRange / steps;
    let prevT = 0;
    for (let s = 1; s <= steps; s++) {
      const t = s * stepLen;
      const sx = origin.x + dir.x * t;
      const sy = origin.y + dir.y * t;
      const sz = origin.z + dir.z * t;
      const gy = this.world.groundHeightAt(sx, sz);
      if (sy <= gy) {
        // Binary refine once between prevT and t
        const midT = (prevT + t) * 0.5;
        const msy = origin.y + dir.y * midT;
        const mgy = this.world.groundHeightAt(
          origin.x + dir.x * midT,
          origin.z + dir.z * midT,
        );
        return msy <= mgy ? midT : t;
      }
      prevT = t;
    }
    return maxRange;
  }

  private hasLineOfSightToPoint(origin: THREE.Vector3, targetPoint: THREE.Vector3): boolean {
    _rayDir.copy(targetPoint).sub(origin);
    const dist = _rayDir.length();
    if (dist <= 0.3) return true;
    _rayDir.divideScalar(dist);
    if (this.hasTerrainObstruction(origin, _rayDir, dist)) {
      return false;
    }
    this.raycaster.set(origin, _rayDir);
    this.raycaster.far = dist - 0.35;
    const hits = this.raycaster.intersectObjects(this.solidObstaclesNoTerrain, false);
    return hits.length === 0;
  }

  private computeExactAnglesToTarget(
    tx: number,
    ty: number,
    tz: number,
    camHeight: number,
    shoulderOffset: number,
  ): { yaw: number; pitch: number; horiz: number } {
    const py = this.pos.y + camHeight;
    let yEst = this.yaw;
    let px = this.pos.x + Math.cos(yEst) * shoulderOffset;
    let pz = this.pos.z - Math.sin(yEst) * shoulderOffset;
    let dx = tx - px;
    let dz = tz - pz;
    yEst = Math.atan2(-dx, -dz);

    // Second pass refines exact camera shoulder pivot so (camPos, pivot, target) are collinear
    px = this.pos.x + Math.cos(yEst) * shoulderOffset;
    pz = this.pos.z - Math.sin(yEst) * shoulderOffset;
    dx = tx - px;
    dz = tz - pz;
    const yawOut = Math.atan2(-dx, -dz);
    const horiz = Math.hypot(dx, dz);
    const pitchOut = THREE.MathUtils.clamp(Math.atan2(ty - py, horiz), -1.0, 0.8);
    return { yaw: yawOut, pitch: pitchOut, horiz };
  }

  private getBotBodyPoint(
    bot: TargetDummy,
    part: 'chest' | 'head',
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const bx = bot.group.position.x;
    const by = bot.group.position.y;
    const bz = bot.group.position.z;
    if (bot.isDowned) {
      const fwdX = Math.sin(bot.group.rotation.y);
      const fwdZ = Math.cos(bot.group.rotation.y);
      if (part === 'head') {
        return out.set(bx + fwdX * 0.78, by + 0.76, bz + fwdZ * 0.78);
      }
      return out.set(bx + fwdX * 0.36, by + 0.60, bz + fwdZ * 0.36);
    }
    return out.set(bx, by + (part === 'head' ? bot.headOffsetY : bot.chestOffsetY), bz);
  }

  private findAimAssistTarget(maxAngleRad: number, maxRange: number): TargetDummy | null {
    const cam = this.world.camera;
    const camPos = cam.position;
    const cp = Math.cos(this.pitch);
    const fx = -Math.sin(this.yaw) * cp;
    const fy = Math.sin(this.pitch);
    const fz = -Math.cos(this.yaw) * cp;

    let best: TargetDummy | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < this.world.targets.length; i++) {
      const t = this.world.targets[i];
      if (t.isAlly || t.eliminated || !t.group.visible) continue;
      if (t.downTimer > 0 && !t.isDowned) continue;

      this.getBotBodyPoint(t, 'chest', _v2);
      const by = t.group.position.y;
      const dx = _v2.x - camPos.x;
      const dyChest = _v2.y - camPos.y;
      const dz = _v2.z - camPos.z;

      // Forward projection along camera ray to enemy distance
      const proj = dx * fx + dyChest * fy + dz * fz;
      if (proj < 1.0 || proj > maxRange) continue;

      // Exact 3D point where the crosshair ray passes the enemy
      const rayX = camPos.x + fx * proj;
      const rayY = camPos.y + fy * proj;
      const rayZ = camPos.z + fz * proj;

      // Distance-scaled vertical body capture: generous near legs/chest at medium-long range
      // while avoiding high empty sky far above the enemy's head
      const rayLocalY = rayY - by;
      const distVertPad = THREE.MathUtils.clamp(proj * 0.022, 0.14, 1.15);
      const headTopLocalY = (t.isDowned ? 1.12 : t.headOffsetY + 0.24) + distVertPad * 0.65;
      const minLocalY = (t.isDowned ? -0.35 : -0.25) - distVertPad;
      if (rayLocalY > headTopLocalY || rayLocalY < minLocalY) continue;

      // Distance-scaled horizontal sticky zone around torso (honors wider angular cone at all ranges)
      const horizErr = Math.hypot(rayX - _v2.x, rayZ - _v2.z);
      const farFalloff =
        proj > 120 ? THREE.MathUtils.clamp(1 - (proj - 120) / 145, 0.55, 1.0) : 1.0;
      const maxHorizErr = THREE.MathUtils.clamp(
        Math.tan(maxAngleRad) * proj * farFalloff,
        1.25,
        5.8 * farFalloff,
      );

      if (horizErr <= maxHorizErr) {
        const score = Math.atan2(horizErr, proj);
        if (score < bestScore) {
          if (this.hasLineOfSightToPoint(camPos, _v2)) {
            bestScore = score;
            best = t;
          }
        }
      }
    }
    return best;
  }

  private fillActiveTargetMeshes(): number {
    this.scratchTargetMeshes.length = 0;
    const targets = this.world.targets;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.isAlly || t.eliminated || !t.group.visible) continue;
      if (t.downTimer > 0 && !t.isDowned) continue;
      // Guarantee bot hitboxes match current-frame world transform before raycasting
      t.group.updateMatrixWorld(true);
      for (let j = 0; j < t.hitMeshes.length; j++) {
        this.scratchTargetMeshes.push(t.hitMeshes[j]);
      }
    }
    return this.scratchTargetMeshes.length;
  }

  private checkCrosshairTargetLock(maxRange: number): boolean {
    if (this.fillActiveTargetMeshes() === 0) return false;

    // 1. Direct center crosshair ray hit on target hitbox
    this.raycaster.setFromCamera(_centerNdc, this.world.camera);
    this.raycaster.far = maxRange;
    const targetHits = this.raycaster.intersectObjects(this.scratchTargetMeshes, false);
    if (targetHits.length > 0) {
      const hitDist = targetHits[0].distance;
      if (
        !this.hasTerrainObstruction(
          this.raycaster.ray.origin,
          this.raycaster.ray.direction,
          hitDist,
        )
      ) {
        this.raycaster.far = Math.max(0.2, hitDist - 0.15);
        const obstacleHits = this.raycaster.intersectObjects(
          this.solidObstaclesNoTerrain,
          false,
        );
        if (obstacleHits.length === 0) return true;
      }
    }

    // 2. Classic FF red proximity zone near the crosshair (wide distance-scaled sticky capture)
    const redZoneCone = this.isAiming ? 0.24 : 0.21;
    return this.findAimAssistTarget(redZoneCone, maxRange) !== null;
  }

  private findNearestDownedAlly(): { bot: TargetDummy; slotNumber: number } | null {
    let best: { bot: TargetDummy; slotNumber: number } | null = null;
    let bestDist = 3.8;
    let allySlot = 2;
    for (let i = 0; i < this.world.targets.length; i++) {
      const b = this.world.targets[i];
      if (!b.isAlly) continue;
      const curSlot = allySlot++;
      if (!b.isDowned || b.eliminated || b.downTimer > 0) continue;
      const d = Math.hypot(b.group.position.x - this.pos.x, b.group.position.z - this.pos.z);
      if (d <= bestDist && Math.abs(b.group.position.y - this.pos.y) < 2.2) {
        bestDist = d;
        best = { bot: b, slotNumber: curSlot };
      }
    }
    return best;
  }

  private findNearbyWindowSill(): boolean {
    const cols = this.world.colliders;
    const py = this.pos.y;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c.tag !== 'house-window-sill') continue;
      if (Math.abs(py - c.minY) > 1.35) continue;
      const dx = this.pos.x - c.cx;
      const dz = this.pos.z - c.cz;
      const maxExtent = c.halfW + c.halfD + 1.35;
      if (Math.abs(dx) > maxExtent || Math.abs(dz) > maxExtent) continue;
      const cos = Math.cos(c.rotY);
      const sin = Math.sin(c.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= c.halfW + 1.15 && Math.abs(lz) <= c.halfD + 1.15) {
        return true;
      }
    }
    return false;
  }

  private getEffectiveMagSize(w: WeaponSlotState): number {
    const base = WEAPONS[w.weaponId].magSize;
    return w.attachments.magazine === 'ext_mag' ? Math.round(base * 1.35) : base;
  }

  private getEffectiveReloadSec(w: WeaponSlotState): number {
    const base = WEAPONS[w.weaponId].reloadTimeSec;
    return w.attachments.magazine === 'ext_mag' ? base * 0.76 : base;
  }

  private updateGroundPlayer(dt: number): void {
    this.input.sample();
    const edges = this.input.consumeLookAndEdges();

    this.pullingUpTimer = Math.max(0, this.pullingUpTimer - dt);
    this.bugDoCapaTimer = Math.max(0, this.bugDoCapaTimer - dt);
    this.vaultTimer = Math.max(0, this.vaultTimer - dt);
    this.canVaultWindow = this.findNearbyWindowSill();

    if (edges.backpack) {
      this.onBackpackRequest?.();
    }
    if (edges.medkit) {
      this.useMedkit();
    }
    if (edges.gloo) {
      if (this.glooCount > 0) {
        this.isPlacingGloo = !this.isPlacingGloo;
        if (this.isPlacingGloo) {
          this.isHoldingGrenade = false;
          soundEngine.playWeaponSwitch();
        }
      } else {
        this.isPlacingGloo = false;
      }
    }
    if (edges.grenade) {
      if (this.grenadeCount > 0) {
        this.isHoldingGrenade = !this.isHoldingGrenade;
        if (this.isHoldingGrenade) {
          this.isPlacingGloo = false;
          soundEngine.playGrenadePin();
        }
      } else {
        this.isHoldingGrenade = false;
      }
    }

    // Weapon slot switching (1/2/3 keys, HUD clicks, or mouse wheel)
    let nextSlot = edges.slot;
    if (!nextSlot && edges.cycleSlotDir !== 0) {
      const available = ([1, 2, 3] as const).filter((s) => this.weapons[s] !== null);
      if (available.length > 1) {
        const curIdx = available.indexOf(this.activeSlot);
        const movedIdx =
          (curIdx + edges.cycleSlotDir + available.length) % available.length;
        nextSlot = available[movedIdx];
      }
    }
    if (nextSlot && this.weapons[nextSlot]) {
      this.isPlacingGloo = false;
      this.isHoldingGrenade = false;
      if (nextSlot !== this.activeSlot) {
        this.activeSlot = nextSlot;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.lockedTargetId = null;
        this.aimBreakAccum = 0;
        this.bugDoCapaTimer = 0;
        this.consecutiveShots = 0;
        this.playerRig.setWeapon(this.weapons[nextSlot]!.weaponId);
        soundEngine.playWeaponSwitch();
      }
    }

    if (edges.cycleScope) {
      this.isPlacingGloo = false;
      this.isHoldingGrenade = false;
      this.cycleActiveWeaponScope();
    }

    const activeWeaponState = this.weapons[this.activeSlot];
    const activeDef = activeWeaponState ? WEAPONS[activeWeaponState.weaponId] : null;
    const activeScope: ScopeType = activeWeaponState ? activeWeaponState.scope : 'none';

    // Stance transitions (including Window Vault on jump near house window sill!)
    const prevStance = this.stance;
    if (edges.crouch) {
      this.stance = this.stance === 'crouch' ? 'stand' : 'crouch';
    }
    if (edges.prone) {
      this.stance = this.stance === 'prone' ? 'stand' : 'prone';
    }
    if (edges.jump && this.isGrounded) {
      if (this.stance !== 'stand') {
        this.stance = 'stand';
      } else if (this.canVaultWindow) {
        // Vault smoothly over house window sill
        this.vaultTimer = 0.48;
        this.vel.y = 6.2;
        const vFx = -Math.sin(this.yaw);
        const vFz = -Math.cos(this.yaw);
        this.vel.x = vFx * 6.0;
        this.vel.z = vFz * 6.0;
        this.isGrounded = false;
        soundEngine.playJump();
      } else {
        this.vel.y = 7.4;
        this.isGrounded = false;
        soundEngine.playJump();
      }
    }

    if (prevStance !== this.stance) {
      if (this.stance === 'prone') {
        soundEngine.playProneDown();
      } else if (prevStance === 'prone') {
        soundEngine.playProneUp();
      } else {
        soundEngine.playUiClick(430);
      }
    }

    // Detect "Agacha e Levanta" (Bug do Capa) when standing up after crouching on a target
    if (prevStance === 'crouch' && this.stance === 'stand' && this.wasLockedWhileCrouched) {
      this.bugDoCapaTimer = 0.55;
      this.wasLockedWhileCrouched = false;
    }
    if (this.stance !== 'crouch') {
      this.wasLockedWhileCrouched = false;
    }

    // Aim & Fire edge transitions
    this.isAiming = this.input.getAimActive();
    if (this.isAiming && (this.isPlacingGloo || this.isHoldingGrenade)) {
      this.isPlacingGloo = false;
      this.isHoldingGrenade = false;
    }
    const justStartedAiming = this.isAiming && !this.wasAiming;
    const fireDown = this.input.getFireActive();
    const justStartedFiring = fireDown && !this.wasFireDown;

    // Handle tactical Gloo Wall deployment or Grenade throw on primary click OR HUD confirm tap
    let gadgetHandledClick = false;
    if ((justStartedFiring || edges.fireTap) && this.isPlacingGloo) {
      this.deployGlooWall();
      gadgetHandledClick = true;
    } else if ((justStartedFiring || edges.fireTap) && this.isHoldingGrenade) {
      this.throwGrenade();
      gadgetHandledClick = true;
    }
    const weaponFireDown =
      fireDown && !gadgetHandledClick && !this.isPlacingGloo && !this.isHoldingGrenade;

    if (!weaponFireDown || performance.now() - this.lastShotTime > 380) {
      this.consecutiveShots = 0;
    }

    if (!weaponFireDown) {
      this.lockedTargetId = null;
      this.aimBreakAccum = 0;
      if (this.stance !== 'crouch') {
        this.wasLockedWhileCrouched = false;
      }
    }

    const isFirstPersonAds =
      this.isAiming && !this.isPlacingGloo && !this.isHoldingGrenade;
    const targetShoulderOffset = isFirstPersonAds ? 0 : 0.42;
    const targetCamDist = isFirstPersonAds ? 0.08 : 3.75;
    const targetCamHeight =
      this.stance === 'prone' ? 0.65 : this.stance === 'crouch' ? 1.15 : 1.55;

    // Classic Free Fire Aim-Assist config check before applying look input
    const assistAllowed =
      this.settings.aimAssistMode === 'default' &&
      Boolean(activeDef?.supportsAimAssist) &&
      !this.isPlacingGloo &&
      !this.isHoldingGrenade;

    // Progressive spray fatigue: after 4 consecutive full-auto shots, aim-assist weakens & spreads
    const sprayControl =
      this.consecutiveShots <= 4
        ? 1.0
        : Math.max(0.18, 1.0 - (this.consecutiveShots - 4) * 0.12);

    // Camera Look with per-scope sensitivity (zero weapon recoil)
    const sensScale = this.getScopeSensitivityScale(activeScope);
    const sens = 0.0028 * sensScale;
    const invert = this.settings.invertY ? -1 : 1;
    const rawYawInput = -edges.dx * sens;
    const rawPitchInput = -edges.dy * sens * invert;
    const absRawYawIn = Math.abs(rawYawInput);

    // When locked while firing in initial burst, resist gentle pull so dragging upward for CAPA
    // stays stable; weakens gradually during prolonged spray so it's never 100% permanent aimbot.
    const hasActiveFireLock =
      assistAllowed && weaponFireDown && !justStartedFiring && this.lockedTargetId !== null;
    let deferredPitchApplied = false;

    if (hasActiveFireLock) {
      // Only accumulate horizontal lock-break when pulling strongly sideways (not during diagonal upward Capa drags)
      const isUpwardDrag = rawPitchInput > 0.001 && absRawYawIn < rawPitchInput * 1.35;
      if (absRawYawIn > 0.028 && !isUpwardDrag) {
        this.aimBreakAccum += absRawYawIn;
      } else {
        this.aimBreakAccum = Math.max(0, this.aimBreakAccum - dt * 1.25);
      }

      const breakFlick = 0.24 * Math.max(0.42, sprayControl);
      const breakAccumLimit = 0.98 * Math.max(0.32, sprayControl);
      if (absRawYawIn > breakFlick || this.aimBreakAccum > breakAccumLimit) {
        // Strong pull or sustained spray fatigue broke the lock
        this.lockedTargetId = null;
        this.aimBreakAccum = 0;
        this.wasLockedWhileCrouched = false;
        this.yaw += rawYawInput;
        this.pitch = THREE.MathUtils.clamp(this.pitch + rawPitchInput, -1.05, 0.85);
      } else {
        const horizSlip = THREE.MathUtils.lerp(0.55, 0.04, sprayControl);
        this.yaw += rawYawInput * horizSlip;
        deferredPitchApplied = true;
      }
    } else {
      this.yaw += rawYawInput;
      this.pitch = THREE.MathUtils.clamp(this.pitch + rawPitchInput, -1.05, 0.85);
    }

    // Upward drag detection ("puxar capa" via mouse or dragging Fire Button upward)
    if (edges.dy * invert < -0.35) {
      this.pullingUpTimer = 0.24;
    }

    // Track if crouched with target inside crosshair area (even before firing, for Bug do Capa)
    if (this.stance === 'crouch' && activeDef && !weaponFireDown) {
      const crouchPreview = this.findAimAssistTarget(this.isAiming ? 0.24 : 0.21, activeDef.range);
      if (crouchPreview) {
        this.wasLockedWhileCrouched = true;
      }
    }

    // Classic Free Fire Aim-Assist ("Mira Gruda" + "Subir Capa" + Fadiga de Spray)
    this.aimAssistActive = false;
    let justAimSnapped = false;

    if (assistAllowed && activeDef) {
      if (weaponFireDown) {
        if (justStartedAiming) {
          // If player opens scope while holding fire, refresh snap cleanly onto closest target
          this.lockedTargetId = null;
          this.aimBreakAccum = 0;
        }
        let target: TargetDummy | null = null;
        if (this.lockedTargetId) {
          const existing = this.targetById.get(this.lockedTargetId);
          if (existing && existing.downTimer <= 0 && !existing.eliminated && existing.group.visible) {
            this.getBotBodyPoint(existing, 'chest', _v2);
            const dist = _v2.distanceTo(this.world.camera.position);
            if (dist <= activeDef.range && this.hasLineOfSightToPoint(this.world.camera.position, _v2)) {
              target = existing;
            } else {
              this.lockedTargetId = null;
              this.aimBreakAccum = 0;
            }
          } else {
            this.lockedTargetId = null;
            this.aimBreakAccum = 0;
          }
        }

        if (!target && this.consecutiveShots <= 4) {
          const coneRad =
            justStartedFiring || justStartedAiming
              ? this.isAiming
                ? 0.26
                : 0.23
              : this.isAiming
                ? 0.23
                : 0.20;
          target = this.findAimAssistTarget(coneRad, activeDef.range);
          if (target) {
            this.lockedTargetId = target.id;
            this.aimBreakAccum = 0;
          }
        }

        if (target) {
          this.getBotBodyPoint(target, 'chest', _v1);
          this.getBotBodyPoint(target, 'head', _v3);
          const pivotY = this.pos.y + targetCamHeight;
          const crouchOffset = !target.isDowned && this.stance === 'crouch' ? -0.05 : 0;

          const chestAim = this.computeExactAnglesToTarget(
            _v1.x,
            _v1.y + crouchOffset,
            _v1.z,
            targetCamHeight,
            targetShoulderOffset,
          );
          const headAim = this.computeExactAnglesToTarget(
            _v3.x,
            _v3.y,
            _v3.z,
            targetCamHeight,
            targetShoulderOffset,
          );
          const headTopAim = this.computeExactAnglesToTarget(
            _v3.x,
            _v3.y + (target.isDowned ? 0.12 : 0.15),
            _v3.z,
            targetCamHeight,
            targetShoulderOffset,
          );

          if (chestAim.horiz > 0.4) {
            let deltaYaw = chestAim.yaw - this.yaw;
            while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
            while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

            const currentHitWorldY = pivotY + Math.tan(this.pitch) * chestAim.horiz;
            const horizOffsetAtTarget = Math.abs(Math.sin(deltaYaw)) * chestAim.horiz;
            const alreadyOnHead =
              !target.isDowned &&
              horizOffsetAtTarget <= 0.18 &&
              currentHitWorldY >= _v3.y - 0.15 &&
              currentHitWorldY <= _v3.y + 0.155;

            this.aimAssistActive = sprayControl > 0.3;
            if (this.stance === 'crouch' && !target.isDowned) {
              this.wasLockedWhileCrouched = true;
              this.crouchLockedDist = chestAim.horiz;
            }

            if (justStartedFiring) {
              this.yaw += deltaYaw * 0.98;
              const startPitch = alreadyOnHead ? headAim.pitch : chestAim.pitch;
              this.pitch = THREE.MathUtils.lerp(this.pitch, startPitch, 0.96);
            } else {
              // Strong burst lock that weakens progressively if player sprays nonstop
              const yawLambda = (this.isAiming ? 65 : 56) * sprayControl;
              this.yaw += deltaYaw * (1 - Math.exp(-yawLambda * dt));

              if (target.isDowned) {
                // Keep shots squarely on low crawling enemy without pulling up into empty air!
                const dampRate = (this.isAiming ? 42 : 34) * sprayControl;
                this.pitch = THREE.MathUtils.damp(this.pitch, chestAim.pitch, dampRate, dt);
              } else if (this.bugDoCapaTimer > 0) {
                const distQuality =
                  chestAim.horiz < 6
                    ? chestAim.horiz / 6
                    : chestAim.horiz <= 46
                      ? 1.0
                      : Math.max(0.35, 1.0 - (chestAim.horiz - 46) / 55);
                const bugPitch = THREE.MathUtils.lerp(
                  chestAim.pitch,
                  headAim.pitch + 0.004,
                  distQuality,
                );
                this.pitch = THREE.MathUtils.damp(this.pitch, bugPitch, 38 * sprayControl, dt);
              } else {
                const chestPitch = chestAim.pitch;
                const headPitch = headAim.pitch;
                const headTopPitch = Math.max(headPitch + 0.008, headTopAim.pitch);
                const chestHeadSpan = Math.max(0.012, headPitch - chestPitch);

                if (rawPitchInput > 0.00025) {
                  // Responsive upward climb onto head (scaled by chest->head angular span)
                  const climbScale = THREE.MathUtils.clamp(chestHeadSpan / 0.055, 0.34, 0.78);
                  const scaledUp = Math.min(
                    rawPitchInput * climbScale,
                    Math.max(0.018, chestHeadSpan * 0.65),
                  );
                  this.pitch = THREE.MathUtils.clamp(this.pitch + scaledUp, -1.05, 0.85);

                  if (this.pitch > headTopPitch + 0.022) {
                    // Player intentionally pulled high into empty air above head -> release lock so shots go over!
                    this.lockedTargetId = null;
                    this.aimBreakAccum = 0;
                    this.aimAssistActive = false;
                  } else if (
                    sprayControl > 0.45 &&
                    this.pitch > headPitch + 0.006 &&
                    rawPitchInput <= 0.13
                  ) {
                    this.pitch = headPitch + 0.002;
                  }
                } else if (rawPitchInput < -0.002) {
                  this.pitch = THREE.MathUtils.clamp(
                    this.pitch + rawPitchInput * 0.45,
                    -1.05,
                    0.85,
                  );
                  if (this.pitch < chestPitch) {
                    this.pitch = chestPitch;
                  }
                } else {
                  const inHeadZone =
                    this.pitch >= headPitch - chestHeadSpan * 0.38 &&
                    this.pitch <= headTopPitch + 0.01;
                  const dampRate = (this.isAiming ? 36 : 30) * sprayControl;
                  if (this.pitch > headTopPitch + 0.018) {
                    // Never pull aim DOWN from empty air above head back onto head!
                    this.lockedTargetId = null;
                    this.aimBreakAccum = 0;
                    this.aimAssistActive = false;
                  } else if (inHeadZone) {
                    this.pitch = THREE.MathUtils.damp(this.pitch, headPitch, dampRate, dt);
                  } else if (this.pullingUpTimer > 0) {
                    // Preserve upward climb progress between touch/mouse poll ticks!
                    this.pitch = THREE.MathUtils.clamp(this.pitch, chestPitch, headPitch + 0.008);
                  } else {
                    this.pitch = THREE.MathUtils.damp(this.pitch, chestPitch, dampRate, dt);
                  }
                }
              }
            }
          }
        } else if (deferredPitchApplied) {
          this.pitch = THREE.MathUtils.clamp(this.pitch + rawPitchInput, -1.05, 0.85);
        }
      } else if (justStartedAiming) {
        // One-time Aim-FOV snap when opening scope using actual distance-scaled body capture
        const aimSnapTarget = this.findAimAssistTarget(0.27, activeDef.range);
        if (aimSnapTarget) {
          this.getBotBodyPoint(aimSnapTarget, 'chest', _v1);
          this.getBotBodyPoint(aimSnapTarget, 'head', _v3);
          const pivotY = this.pos.y + targetCamHeight;

          const chestAim = this.computeExactAnglesToTarget(
            _v1.x,
            _v1.y,
            _v1.z,
            targetCamHeight,
            targetShoulderOffset,
          );

          if (chestAim.horiz > 0.4) {
            let deltaYawToCenter = chestAim.yaw - this.yaw;
            while (deltaYawToCenter > Math.PI) deltaYawToCenter -= Math.PI * 2;
            while (deltaYawToCenter < -Math.PI) deltaYawToCenter += Math.PI * 2;

            const currentHitWorldY = pivotY + Math.tan(this.pitch) * chestAim.horiz;
            const horizOffsetAtTarget = Math.abs(Math.sin(deltaYawToCenter)) * chestAim.horiz;
            const alreadyOnHead =
              !aimSnapTarget.isDowned &&
              horizOffsetAtTarget <= 0.18 &&
              currentHitWorldY >= _v3.y - 0.15 &&
              currentHitWorldY <= _v3.y + 0.155;

            const snapPt = alreadyOnHead ? _v3 : _v1;
            const desired = this.computeExactAnglesToTarget(
              snapPt.x,
              snapPt.y,
              snapPt.z,
              targetCamHeight,
              targetShoulderOffset,
            );
            let deltaYaw = desired.yaw - this.yaw;
            while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
            while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

            // Snap cleanly once onto exact center of chest (no side offset, no tracking next frames)
            this.yaw += deltaYaw * 0.96;
            this.pitch = THREE.MathUtils.lerp(this.pitch, desired.pitch, 0.96);
            justAimSnapped = true;
          }
        }
      }
    }
    this.wasAiming = this.isAiming;

    // Interact priority: LaunchPad -> AirDrop -> Vehicle -> Vending (Lojinha) -> Loot -> Revive
    const nearbyLaunchPad = this.findNearbyLaunchPad();
    if (nearbyLaunchPad && (edges.interact || edges.jump) && !this.revivingBotId) {
      this.triggerLaunchPad(nearbyLaunchPad);
      return;
    }

    const nearbyAirDrop = this.findNearbyAirDrop();
    const nearbyVehicle = this.findNearbyVehicle();
    const nearbyVending = this.findNearbyVending();
    const nearbyLoot = this.findNearbyLoot();

    if (edges.interact && !this.revivingBotId) {
      if (nearbyAirDrop) {
        this.collectAirDrop(nearbyAirDrop);
      } else if (nearbyVehicle) {
        this.enterVehicle(nearbyVehicle);
        return;
      } else if (nearbyVending && !nearbyLoot) {
        this.onOpenShopRequest?.();
      } else if (nearbyLoot) {
        this.tryPickupNearbyLoot();
      } else {
        const downedAlly = this.findNearestDownedAlly();
        if (downedAlly) {
          this.revivingBotId = downedAlly.bot.id;
          this.reviveTimer = this.reviveDuration;
          this.usingMedkit = false;
          this.isReloading = false;
          this.isPlacingGloo = false;
          this.isHoldingGrenade = false;
          soundEngine.stopMedkitAudio();
          soundEngine.playUiClick(700);
        }
      }
    } else if (edges.revive && !this.revivingBotId) {
      const downedAlly = this.findNearestDownedAlly();
      if (downedAlly) {
        this.revivingBotId = downedAlly.bot.id;
        this.reviveTimer = this.reviveDuration;
        this.usingMedkit = false;
        this.isReloading = false;
        this.isPlacingGloo = false;
        this.isHoldingGrenade = false;
        soundEngine.stopMedkitAudio();
        soundEngine.playUiClick(700);
      }
    }

    // Revive channel update (3.0s; cancels if sprinting, firing, or walking > 4.2m away)
    if (this.revivingBotId) {
      const revTarget = this.targetById.get(this.revivingBotId);
      const revDist = revTarget
        ? Math.hypot(revTarget.group.position.x - this.pos.x, revTarget.group.position.z - this.pos.z)
        : 999;
      if (
        !revTarget ||
        !revTarget.isDowned ||
        revTarget.eliminated ||
        revDist > 4.2 ||
        fireDown ||
        this.input.isSprinting
      ) {
        this.revivingBotId = null;
        this.reviveTimer = 0;
      } else {
        this.reviveTimer -= dt;
        if (this.reviveTimer <= 0) {
          revTarget.isDowned = false;
          revTarget.hp = 115;
          revTarget.bleedHp = 100;
          revTarget.downTimer = 0;
          revTarget.knockedByPlayer = false;
          revTarget.aiState = revTarget.medkits > 0 ? 'heal' : 'roam';
          revTarget.healTimer = 1.6;
          if (revTarget.gunMesh) revTarget.gunMesh.visible = true;
          if (revTarget.torsoGroup) {
            revTarget.torsoGroup.position.set(0, 0.78, 0);
            revTarget.torsoGroup.rotation.set(0, 0, 0);
          }
          if (revTarget.headMesh) revTarget.headMesh.rotation.set(0, 0, 0);
          if (revTarget.legLPivot) {
            revTarget.legLPivot.position.set(-0.1, 0.78, 0);
            revTarget.legLPivot.rotation.set(0, 0, 0);
          }
          if (revTarget.legRPivot) {
            revTarget.legRPivot.position.set(0.1, 0.78, 0);
            revTarget.legRPivot.rotation.set(0, 0, 0);
          }
          if (revTarget.armLPivot) revTarget.armLPivot.rotation.set(0, 0, 0);
          if (revTarget.armRPivot) revTarget.armRPivot.rotation.set(0, 0, 0);
          this.pushKillFeed(this.playerNick, `${revTarget.nick} SALVO`, 'REVIVE', false, true);
          soundEngine.completeMedkitAudio();
          this.revivingBotId = null;
          this.reviveTimer = 0;
        }
      }
    }

    // Medkit healing channel (4.0s synced with usando-kit-medico.mp3; cancels on sprint or gunfire)
    if (this.usingMedkit) {
      if (fireDown || this.input.isSprinting) {
        this.usingMedkit = false;
        this.medkitTimer = 0;
        soundEngine.stopMedkitAudio();
      } else {
        this.medkitTimer -= dt;
        if (this.medkitTimer <= 0) {
          this.usingMedkit = false;
          this.medkitTimer = 0;
          if (this.medkitCount > 0) {
            this.medkitCount -= 1;
            this.hp = Math.min(this.maxHp, this.hp + 75);
            soundEngine.completeMedkitAudio();
          }
        }
      }
    }

    // Reload (supports Extended Magazine capacity & faster reload)
    if (edges.reload && activeWeaponState && !this.isReloading) {
      const magCap = this.getEffectiveMagSize(activeWeaponState);
      if (activeWeaponState.ammoInMag < magCap && activeWeaponState.reserveAmmo > 0) {
        this.isReloading = true;
        this.reloadTimer = this.getEffectiveReloadSec(activeWeaponState);
        soundEngine.playReload();
      }
    }
    if (this.isReloading && activeWeaponState) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const magCap = this.getEffectiveMagSize(activeWeaponState);
        const needed = magCap - activeWeaponState.ammoInMag;
        const transfer = Math.min(needed, activeWeaponState.reserveAmmo);
        activeWeaponState.ammoInMag += transfer;
        activeWeaponState.reserveAmmo -= transfer;
        this.isReloading = false;
      }
    }

    // Movement Speed (weapon mobility + Stock attachment + Medkit slow)
    const hasMove = Math.abs(this.input.moveX) > 0.05 || Math.abs(this.input.moveZ) > 0.05;
    this.isSprinting =
      this.input.isSprinting &&
      hasMove &&
      this.input.moveZ >= -0.15 &&
      this.stance === 'stand' &&
      !this.isAiming &&
      !fireDown &&
      !this.usingMedkit;

    const weaponSpeedMult = activeDef ? activeDef.moveSpeedMult : 1.0;
    const stockAimBonus =
      this.isAiming && activeWeaponState?.attachments.stock === 'stock' ? 1.14 : 1.0;
    const baseSpeed =
      this.stance === 'prone'
        ? 2.2
        : this.stance === 'crouch'
          ? 3.8
          : this.isSprinting
            ? 9.1
            : this.isAiming
              ? 3.9 * stockAimBonus
              : 5.85;
    const maxSpeed = baseSpeed * weaponSpeedMult * (this.usingMedkit ? 0.55 : 1.0);

    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    if (this.vaultTimer <= 0.15) {
      const targetVx = (forwardX * this.input.moveZ + rightX * this.input.moveX) * maxSpeed;
      const targetVz = (forwardZ * this.input.moveZ + rightZ * this.input.moveX) * maxSpeed;
      const accel = this.isGrounded ? 18 : 6.5;
      this.vel.x = THREE.MathUtils.damp(this.vel.x, targetVx, accel, dt);
      this.vel.z = THREE.MathUtils.damp(this.vel.z, targetVz, accel, dt);
    }

    // Gravity
    this.vel.y -= 20.5 * dt;

    // Integrate XZ together + 2-pass OBB corner sliding so movement never snags
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.resolveHorizontalCollisions(0.4);
    this.resolveHorizontalCollisions(0.4);
    this.pos.y += this.vel.y * dt;

    // Expanded 520m Island boundary clamp
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -512, 512);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -512, 512);

    // Terrain + Walkable Platforms (Bridges, House Floors, Shed Slabs, Pier, Runway)
    const wasGrounded = this.isGrounded;
    const floorY = Math.max(-0.2, this.resolveFloorHeight(this.pos.x, this.pos.z, this.pos.y));

    if (this.pos.y <= floorY) {
      this.pos.y = floorY;
      this.vel.y = 0;
      this.isGrounded = true;
      if (!wasGrounded) {
        this.animator.triggerLanding();
        soundEngine.playLanding();
      }
    } else if (this.pos.y > floorY + 0.15) {
      this.isGrounded = false;
    }

    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    const activelyMoving =
      hasMove &&
      horizSpeed > 0.45 &&
      this.isGrounded &&
      !this.isDead &&
      this.vaultTimer <= 0.05;
    const moveSpeedRatio = activelyMoving
      ? THREE.MathUtils.clamp(horizSpeed / 9.1, 0.22, 1.05)
      : 0;
    soundEngine.updateRunAudio(activelyMoving, moveSpeedRatio, this.stance, dt);

    // Hide character body during ALL ADS scopes; hide held gun while wrapping Medkit or Reviving
    this.playerRig.root.visible = !isFirstPersonAds;
    this.playerRig.weaponMount.visible = !this.usingMedkit && !this.revivingBotId;

    if (this.usingMedkit) {
      const pulse = 1 + Math.sin(this.elapsed * 8.5) * 0.14;
      this.healRingMesh.position.set(this.pos.x, this.pos.y + 0.08, this.pos.z);
      this.healRingMesh.scale.set(pulse, pulse, 1);
      this.healRingMesh.rotation.z += dt * 2.2;
      this.healRingMesh.visible = true;
    } else {
      this.healRingMesh.visible = false;
    }

    // Decoupled character facing vs camera aim
    if (this.isAiming || weaponFireDown || this.isPlacingGloo || this.isHoldingGrenade) {
      this.combatFacingTimer = 0.28;
    } else {
      this.combatFacingTimer = Math.max(0, this.combatFacingTimer - dt);
    }

    let desiredCharYaw = this.characterYaw;
    if (this.combatFacingTimer > 0) {
      desiredCharYaw = this.yaw;
    } else if (horizSpeed > 0.35 && hasMove) {
      const moveVx = forwardX * this.input.moveZ + rightX * this.input.moveX;
      const moveVz = forwardZ * this.input.moveZ + rightZ * this.input.moveX;
      desiredCharYaw = Math.atan2(-moveVx, -moveVz);
    }

    let diffCharYaw = desiredCharYaw - this.characterYaw;
    while (diffCharYaw > Math.PI) diffCharYaw -= Math.PI * 2;
    while (diffCharYaw < -Math.PI) diffCharYaw += Math.PI * 2;
    const charTurnRate = this.combatFacingTimer > 0 ? 22 : 14;
    this.prevCharYawForTurn = this.characterYaw;
    this.characterYaw += diffCharYaw * (1 - Math.exp(-charTurnRate * dt));
    let turnDeltaRad = this.characterYaw - this.prevCharYawForTurn;
    while (turnDeltaRad > Math.PI) turnDeltaRad -= Math.PI * 2;
    while (turnDeltaRad < -Math.PI) turnDeltaRad += Math.PI * 2;

    // Character orientation & animation
    this.playerRig.root.position.copy(this.pos);
    this.playerRig.root.rotation.y = this.characterYaw + Math.PI;
    this.animator.update(this.playerRig, {
      dt,
      speed: horizSpeed,
      stance: this.stance,
      isGrounded: this.isGrounded,
      isSprinting: this.isSprinting,
      isAiming: this.isAiming,
      isFiring: weaponFireDown,
      isReloading: this.isReloading,
      isHealing: this.usingMedkit || Boolean(this.revivingBotId),
      isDriving: false,
      isLobby: false,
      isSkydiving: false,
      isParachuting: false,
      isDead: false,
      pitchRad: this.pitch,
      turnDeltaRad,
    });

    // Update Gloo preview / Grenade curved trajectory line
    if (this.isPlacingGloo && this.glooCount > 0) {
      const gPos = this.computeGlooPlacement();
      this.glooPreviewMesh.position.set(gPos.x, gPos.y + 1.175, gPos.z);
      this.glooPreviewMesh.rotation.y = this.yaw;
      this.glooPreviewMesh.visible = true;
    } else {
      this.glooPreviewMesh.visible = false;
    }

    if (this.isHoldingGrenade && this.grenadeCount > 0) {
      this.updateGrenadeTrajectoryPreview();
    } else {
      this.grenadeLine.visible = false;
      this.grenadeTargetMesh.visible = false;
    }

    // Quantized shadow camera tracking
    const snapX = Math.round(this.pos.x);
    const snapZ = Math.round(this.pos.z);
    if (snapX !== this.lastSunSnapX || snapZ !== this.lastSunSnapZ) {
      this.lastSunSnapX = snapX;
      this.lastSunSnapZ = snapZ;
      this.world.sunLight.position.set(snapX + 65, this.pos.y + 95, snapZ + 55);
      this.world.sunLight.target.position.set(snapX, this.pos.y, snapZ);
    }

    // Update camera BEFORE firing so aim-assist snaps apply cleanly with zero rotational skew!
    const snapCameraNow =
      (justStartedFiring && this.aimAssistActive) || justAimSnapped || isFirstPersonAds;
    this.updateThirdPersonCamera(
      dt,
      targetCamDist,
      targetCamHeight,
      activeScope,
      isFirstPersonAds,
      snapCameraNow,
    );

    // Fire AFTER camera & aim-assist sync
    if (weaponFireDown && activeWeaponState && !this.isReloading) {
      const def = WEAPONS[activeWeaponState.weaponId];
      const nowMs = performance.now();
      const canFire = def.automatic ? true : !this.wasFireDown;
      if (canFire && nowMs - this.lastShotTime >= def.fireRateMs) {
        this.lastShotTime = nowMs;
        this.fireActiveWeapon(activeWeaponState);
      }
    }
    this.wasFireDown = fireDown;

    this.crosshairCheckAccum += dt;
    if (this.crosshairCheckAccum >= 0.05) {
      this.crosshairCheckAccum = 0;
      this.aimLockedTarget = this.checkCrosshairTargetLock(activeDef?.range ?? 180);
    }
  }

  private resolveFloorHeight(x: number, z: number, currentY: number): number {
    let floorY = this.world.groundHeightAt(x, z);
    const plats = this.world.platforms;
    for (let i = 0; i < plats.length; i++) {
      const p = plats[i];
      if (currentY + 0.85 < p.topY) continue;
      const dx = x - p.cx;
      const dz = z - p.cz;
      const cos = Math.cos(p.rotY);
      const sin = Math.sin(p.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= p.halfW + 0.15 && Math.abs(lz) <= p.halfD + 0.15) {
        if (p.topY > floorY) floorY = p.topY;
      }
    }
    return floorY;
  }

  private resolveHorizontalCollisions(radius: number): void {
    const py = this.pos.y;
    const cols = this.world.colliders;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (this.vaultTimer > 0 && c.tag === 'house-window-sill') continue;
      if (this.activeVehicleId && c.tag === `vehicle-${this.activeVehicleId}`) continue;
      if (py + 1.55 < c.minY || py + 0.25 > c.maxY) continue;

      const dx = this.pos.x - c.cx;
      const dz = this.pos.z - c.cz;
      const maxExtent = c.halfW + c.halfD + radius;
      if (Math.abs(dx) > maxExtent || Math.abs(dz) > maxExtent) continue;

      const cos = Math.cos(c.rotY);
      const sin = Math.sin(c.rotY);
      // Transform circle center into collider's local space
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;

      const clampedX = Math.max(-c.halfW, Math.min(c.halfW, lx));
      const clampedZ = Math.max(-c.halfD, Math.min(c.halfD, lz));
      const diffX = lx - clampedX;
      const diffZ = lz - clampedZ;
      const distSq = diffX * diffX + diffZ * diffZ;

      if (distSq >= radius * radius) continue;

      let pushLx = 0;
      let pushLz = 0;
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        pushLx = (diffX / dist) * push;
        pushLz = (diffZ / dist) * push;
      } else {
        // Center is inside box; push out along closest face
        const penX = c.halfW - Math.abs(lx);
        const penZ = c.halfD - Math.abs(lz);
        if (penX < penZ) {
          pushLx = (lx >= 0 ? 1 : -1) * (penX + radius);
        } else {
          pushLz = (lz >= 0 ? 1 : -1) * (penZ + radius);
        }
      }

      // Rotate push vector back to world space
      this.pos.x += pushLx * cos + pushLz * sin;
      this.pos.z += -pushLx * sin + pushLz * cos;
    }
  }

  private computeShotDamage(
    def: WeaponDef,
    dist: number,
    isHead: boolean,
    dummy: TargetDummy,
  ): { dmg: number; armorBlocked: number } {
    // 1. Distance damage falloff
    let distMult = 1.0;
    if (def.category === 'SR') {
      distMult = dist <= 240 ? 1.0 : THREE.MathUtils.lerp(1.0, 0.85, (dist - 240) / 100);
    } else if (def.category === 'AR') {
      distMult =
        dist <= 45
          ? 1.0
          : THREE.MathUtils.lerp(1.0, 0.6, THREE.MathUtils.clamp((dist - 45) / 135, 0, 1));
    } else if (def.category === 'SMG') {
      distMult =
        dist <= 22
          ? 1.0
          : THREE.MathUtils.lerp(1.0, 0.42, THREE.MathUtils.clamp((dist - 22) / 95, 0, 1));
    } else {
      distMult =
        dist <= 9
          ? 1.0
          : THREE.MathUtils.lerp(1.0, 0.25, THREE.MathUtils.clamp((dist - 9) / 36, 0, 1));
    }

    const headMult = def.category === 'SR' ? 3.2 : 3.8;
    const rawDmg = def.damage * distMult * (isHead ? headMult : 1.0);

    // 2. Vest & Helmet mitigation by level (0..3) and durability
    let armorBlocked = 0;
    let reduction = 0;

    if (isHead && dummy.helmetLevel > 0 && dummy.helmetHp > 0) {
      const table = [0, 0.25, 0.38, 0.5];
      reduction = table[dummy.helmetLevel] * (def.category === 'SR' ? 0.5 : 1.0);
      armorBlocked = dummy.helmetLevel;
      dummy.helmetHp = Math.max(0, dummy.helmetHp - Math.round(rawDmg * 0.42));
      if (dummy.helmetHp <= 0 && dummy.helmetMesh) {
        dummy.helmetMesh.visible = false;
      }
    } else if (!isHead && dummy.vestLevel > 0 && dummy.vestHp > 0) {
      const table = [0, 0.2, 0.35, 0.48];
      reduction = table[dummy.vestLevel] * (def.category === 'SR' ? 0.45 : 1.0);
      armorBlocked = dummy.vestLevel;
      dummy.vestHp = Math.max(0, dummy.vestHp - Math.round(rawDmg * 0.38));
      if (dummy.vestHp <= 0 && dummy.vestMesh) {
        dummy.vestMesh.visible = false;
      }
    }

    const dmg = Math.max(1, Math.round(rawDmg * (1 - reduction)));
    return { dmg, armorBlocked };
  }

  private pushDamagePopup(
    worldPoint: THREE.Vector3,
    amount: number,
    isHeadshot: boolean,
    armorBlocked: number,
  ): void {
    _v1.copy(worldPoint).project(this.world.camera);
    if (_v1.z > 1) return;
    const xOffsets = [-2.8, 3.0, -4.6, 4.8, -1.6, 2.0];
    const yOffsets = [-1.8, -4.4, -0.4, -6.0, -3.2, -1.0];
    const slot = this.damagePopupStagger++ % xOffsets.length;
    const xPct = THREE.MathUtils.clamp((_v1.x * 0.5 + 0.5) * 100 + xOffsets[slot], 8, 92);
    const yPct = THREE.MathUtils.clamp((-_v1.y * 0.5 + 0.5) * 100 + yOffsets[slot], 8, 88);
    if (this.damagePopups.length >= 10) {
      this.damagePopups.shift();
    }
    this.damagePopups.push({
      id: this.nextDamagePopupId++,
      amount,
      isHeadshot,
      armorBlocked,
      xPct,
      yPct,
      age: 0,
    });
  }

  private isPointInsideCollider(x: number, y: number, z: number): boolean {
    const cols = this.world.colliders;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (y < c.minY || y > c.maxY) continue;
      const dx = x - c.cx;
      const dz = z - c.cz;
      const maxE = c.halfW + c.halfD;
      if (Math.abs(dx) > maxE || Math.abs(dz) > maxE) continue;
      const cos = Math.cos(c.rotY);
      const sin = Math.sin(c.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= c.halfW && Math.abs(lz) <= c.halfD) {
        return true;
      }
    }
    return false;
  }

  private computeGlooPlacement(): { x: number; y: number; z: number } {
    const x = THREE.MathUtils.clamp(this.pos.x - Math.sin(this.yaw) * 3.8, -508, 508);
    const z = THREE.MathUtils.clamp(this.pos.z - Math.cos(this.yaw) * 3.8, -508, 508);
    const y = Math.max(-0.2, this.resolveFloorHeight(x, z, this.pos.y + 1.2));
    return { x, y, z };
  }

  private deployGlooWall(): void {
    if (this.glooCount <= 0) {
      this.isPlacingGloo = false;
      return;
    }
    this.glooCount -= 1;
    const p = this.computeGlooPlacement();
    this.spawnGlooWallAt(p.x, p.y, p.z, this.yaw);
    soundEngine.playGlooDeploy();
    this.isPlacingGloo = false;
  }

  private spawnGlooWallAt(x: number, y: number, z: number, wallYaw: number): void {
    if (this.deployedGloos.length >= 28) {
      this.removeGlooWallAt(0);
    }
    const id = `gloo_${this.nextGlooId++}`;
    const mesh = new THREE.Mesh(this.glooWallGeo, this.glooWallMat);
    mesh.position.set(x, y + 1.175, z);
    mesh.rotation.y = wallYaw;
    mesh.castShadow = !this.isSoftwareGl;
    mesh.receiveShadow = !this.isSoftwareGl;
    mesh.userData.glooId = id;
    this.world.scene.add(mesh);

    const collider: WorldObbCollider = {
      cx: x,
      cz: z,
      halfW: 1.7,
      halfD: 0.22,
      rotY: wallYaw,
      minY: y,
      maxY: y + 2.35,
      tag: 'gloo-wall',
    };
    this.world.colliders.push(collider);
    this.solidObstaclesNoTerrain.push(mesh);
    this.deployedGloos.push({ id, mesh, collider, hp: 450, life: 55 });
  }

  private deployBotGlooWall(bot: TargetDummy, threatX: number, threatZ: number): void {
    if (bot.gloos <= 0 || bot.glooCooldown > 0 || bot.eliminated || bot.isDowned) return;
    const bx = bot.group.position.x;
    const bz = bot.group.position.z;
    const dx = threatX - bx;
    const dz = threatZ - bz;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist;
    const nz = dz / dist;
    const gx = THREE.MathUtils.clamp(bx + nx * 3.1, -504, 504);
    const gz = THREE.MathUtils.clamp(bz + nz * 3.1, -504, 504);
    const gy = Math.max(-0.2, this.resolveFloorHeight(gx, gz, bot.group.position.y + 1.0));
    const wallYaw = Math.atan2(-nx, -nz);

    bot.gloos -= 1;
    bot.glooCooldown = 13.5;
    this.spawnGlooWallAt(gx, gy, gz, wallYaw);
    if (Math.hypot(gx - this.pos.x, gz - this.pos.z) < 70) {
      soundEngine.playGlooDeploy();
    }
  }

  private removeGlooWallAt(index: number): void {
    const g = this.deployedGloos[index];
    this.world.scene.remove(g.mesh);
    const cIdx = this.world.colliders.indexOf(g.collider);
    if (cIdx >= 0) this.world.colliders.splice(cIdx, 1);
    const oIdx = this.solidObstaclesNoTerrain.indexOf(g.mesh);
    if (oIdx >= 0) this.solidObstaclesNoTerrain.splice(oIdx, 1);
    this.deployedGloos.splice(index, 1);
  }

  private clearDeployedGloos(): void {
    for (let i = this.deployedGloos.length - 1; i >= 0; i--) {
      this.removeGlooWallAt(i);
    }
  }

  private updateDeployedGloos(dt: number): void {
    for (let i = this.deployedGloos.length - 1; i >= 0; i--) {
      this.deployedGloos[i].life -= dt;
      if (this.deployedGloos[i].life <= 0 || this.deployedGloos[i].hp <= 0) {
        this.removeGlooWallAt(i);
      }
    }
  }

  private damageGlooById(glooId: string, dmg: number): void {
    for (let i = 0; i < this.deployedGloos.length; i++) {
      if (this.deployedGloos[i].id === glooId) {
        this.deployedGloos[i].hp -= dmg;
        if (this.deployedGloos[i].hp <= 0) {
          this.removeGlooWallAt(i);
        }
        return;
      }
    }
  }

  private computeGrenadeLaunchParams(): {
    ox: number;
    oy: number;
    oz: number;
    vx: number;
    vy: number;
    vz: number;
  } {
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const ox = this.pos.x + rightX * 0.28 - Math.sin(this.yaw) * 0.45;
    const oy = this.pos.y + (this.stance === 'crouch' ? 1.05 : 1.42);
    const oz = this.pos.z + rightZ * 0.28 - Math.cos(this.yaw) * 0.45;
    const throwPitch = THREE.MathUtils.clamp(this.pitch + 0.24, -0.75, 1.05);
    const speed = 22.5;
    const cp = Math.cos(throwPitch);
    const vx = -Math.sin(this.yaw) * cp * speed;
    const vy = Math.sin(throwPitch) * speed;
    const vz = -Math.cos(this.yaw) * cp * speed;
    return { ox, oy, oz, vx, vy, vz };
  }

  private updateGrenadeTrajectoryPreview(): void {
    const { ox, oy, oz, vx, vy, vz } = this.computeGrenadeLaunchParams();
    const gravity = -19.5;
    const steps = 25;
    const dtStep = 0.092;
    let impactX = ox;
    let impactY = oy;
    let impactZ = oz;
    let hitFound = false;

    this.grenadeLinePositions[0] = ox;
    this.grenadeLinePositions[1] = oy;
    this.grenadeLinePositions[2] = oz;

    let prevY = oy;
    for (let i = 1; i <= steps; i++) {
      if (!hitFound) {
        const t = i * dtStep;
        const px = ox + vx * t;
        const py = oy + vy * t + 0.5 * gravity * t * t;
        const pz = oz + vz * t;
        const floorY = this.resolveFloorHeight(px, pz, prevY + 0.4);
        if (py <= floorY || this.isPointInsideCollider(px, py, pz)) {
          impactX = px;
          impactY = Math.max(floorY + 0.05, py);
          impactZ = pz;
          hitFound = true;
        } else {
          impactX = px;
          impactY = py;
          impactZ = pz;
          prevY = py;
        }
      }
      this.grenadeLinePositions[i * 3] = impactX;
      this.grenadeLinePositions[i * 3 + 1] = impactY;
      this.grenadeLinePositions[i * 3 + 2] = impactZ;
    }

    (this.grenadeLineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.grenadeLine.visible = true;
    this.grenadeTargetMesh.position.set(impactX, impactY + 0.06, impactZ);
    this.grenadeTargetMesh.visible = true;
  }

  private throwGrenade(): void {
    if (this.grenadeCount <= 0) {
      this.isHoldingGrenade = false;
      return;
    }
    this.grenadeCount -= 1;
    this.isHoldingGrenade = false;
    this.grenadeLine.visible = false;
    this.grenadeTargetMesh.visible = false;

    const { ox, oy, oz, vx, vy, vz } = this.computeGrenadeLaunchParams();
    let slot = this.thrownGrenades.find((g) => !g.active);
    if (!slot) slot = this.thrownGrenades[0];
    slot.active = true;
    slot.mesh.position.set(ox, oy, oz);
    slot.vel.set(vx, vy, vz);
    slot.mesh.visible = true;
    soundEngine.playGrenadeThrow();
  }

  private updateThrownGrenades(dt: number): void {
    const gravity = -19.5;
    for (let i = 0; i < this.thrownGrenades.length; i++) {
      const g = this.thrownGrenades[i];
      if (!g.active) continue;
      const prevY = g.mesh.position.y;
      g.vel.y += gravity * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      g.mesh.rotation.x += dt * 10;
      g.mesh.rotation.z += dt * 8;

      const px = g.mesh.position.x;
      const py = g.mesh.position.y;
      const pz = g.mesh.position.z;
      const floorY = this.resolveFloorHeight(px, pz, prevY + 0.45);

      let touchedEnemy = false;
      for (let b = 0; b < this.world.targets.length; b++) {
        const bot = this.world.targets[b];
        if (bot.eliminated || bot.downTimer > 0) continue;
        const ddx = px - bot.group.position.x;
        const ddz = pz - bot.group.position.z;
        if (
          ddx * ddx + ddz * ddz < 0.85 * 0.85 &&
          py >= bot.group.position.y - 0.1 &&
          py <= bot.group.position.y + 1.95
        ) {
          touchedEnemy = true;
          break;
        }
      }

      if (py <= floorY || touchedEnemy || this.isPointInsideCollider(px, py, pz)) {
        g.active = false;
        g.mesh.visible = false;
        _v1.set(px, Math.max(floorY + 0.1, py), pz);
        this.explodeGrenade(_v1);
      }
    }
  }

  private explodeGrenade(center: THREE.Vector3): void {
    this.explodeAt(center, 9.5, 170, 'GRANADA');
  }

  private detonateExplosiveBarrel(instanceIdx: number): void {
    const eb = this.world.explosiveBarrels[instanceIdx];
    if (!eb || eb.exploded) return;
    this.world.hideExplosiveBarrel(instanceIdx);
    _v1.set(eb.x, eb.y + 0.3, eb.z);
    this.explodeAt(_v1, 11.5, 200, 'BARRIL');
  }

  private explodeAt(
    center: THREE.Vector3,
    blastRadius: number,
    maxDamage: number,
    weaponLabel: string,
  ): void {
    soundEngine.playExplosion();
    this.lastGunfightX = center.x;
    this.lastGunfightZ = center.z;
    this.lastGunfightTimer = 14;

    let vfx = this.explosionVfx.find((e) => !e.active);
    if (!vfx) vfx = this.explosionVfx[0];
    vfx.active = true;
    vfx.age = 0;
    vfx.mesh.position.copy(center);
    vfx.mesh.scale.setScalar(0.5);
    vfx.mat.opacity = 0.88;
    vfx.mat.color.setHex(0xff7b1c);
    vfx.mesh.visible = true;

    const camDist = center.distanceTo(this.pos);
    if (camDist < 36) {
      this.camShake = Math.max(this.camShake, THREE.MathUtils.clamp(0.75 - camDist / 48, 0.14, 0.75));
    }

    for (let i = this.deployedGloos.length - 1; i >= 0; i--) {
      const gloo = this.deployedGloos[i];
      const gd = center.distanceTo(gloo.mesh.position);
      if (gd < blastRadius) {
        gloo.hp -= Math.round(280 * (1 - gd / blastRadius));
        if (gloo.hp <= 0) {
          this.removeGlooWallAt(i);
        }
      }
    }

    const bots = this.world.targets;
    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (bot.isAlly || bot.eliminated || (bot.downTimer > 0 && !bot.isDowned)) continue;
      _v2.set(
        bot.group.position.x,
        bot.group.position.y + (bot.isDowned ? 0.45 : bot.chestOffsetY),
        bot.group.position.z,
      );
      const dist = center.distanceTo(_v2);
      if (dist > blastRadius) continue;

      const falloff = 1 - dist / blastRadius;
      const vestTable = [0, 0.18, 0.3, 0.42];
      const red = bot.vestLevel > 0 && bot.vestHp > 0 ? vestTable[bot.vestLevel] : 0;
      const dmg = Math.max(20, Math.round(maxDamage * falloff * (1 - red)));
      if (bot.vestLevel > 0 && bot.vestHp > 0) {
        bot.vestHp = Math.max(0, bot.vestHp - Math.round(dmg * 0.4));
        if (bot.vestHp <= 0 && bot.vestMesh) bot.vestMesh.visible = false;
      }

      this.applyBotHitDamage(bot, dmg, true, this.playerNick, weaponLabel, false, center.x, center.z);
      this.damageDealt += dmg;
      this.hitmarkerTimer = 0.22;
      this.pushDamagePopup(_v2, dmg, false, red > 0 ? bot.vestLevel : 0);
    }

    // Damage nearby vehicles in blast radius
    for (let vIdx = 0; vIdx < this.world.vehicles.length; vIdx++) {
      const veh = this.world.vehicles[vIdx];
      if (veh.destroyed) continue;
      const vd = Math.hypot(veh.x - center.x, veh.z - center.z);
      if (vd < blastRadius + 1.5) {
        const vFalloff = Math.max(0.2, 1 - vd / (blastRadius + 1.5));
        this.damageVehicle(veh, Math.round(maxDamage * 1.5 * vFalloff));
      }
    }

    // Lethal blast damage near feet (with Vest mitigation)
    if (!this.isDead && camDist < 6.8) {
      const selfDmg = Math.round(45 * (1 - camDist / 6.8));
      if (selfDmg > 0) {
        this.applyPlayerDamage(selfDmg, center.x, center.z, weaponLabel, weaponLabel, false);
      }
    }
  }

  private updateExplosionVfx(dt: number): void {
    for (let i = 0; i < this.explosionVfx.length; i++) {
      const e = this.explosionVfx[i];
      if (!e.active) continue;
      e.age += dt;
      const t = e.age / 0.42;
      if (t >= 1) {
        e.active = false;
        e.mesh.visible = false;
        continue;
      }
      e.mesh.scale.setScalar(0.6 + t * 8.2);
      e.mat.opacity = (1 - t) * 0.85;
      e.mat.color.setHex(t < 0.35 ? 0xfef08a : t < 0.7 ? 0xf97316 : 0xdc2626);
    }
  }

  private fireActiveWeapon(slotState: WeaponSlotState): void {
    const def = WEAPONS[slotState.weaponId];
    if (slotState.ammoInMag <= 0) {
      soundEngine.playEmptyClick();
      if (slotState.reserveAmmo > 0 && !this.isReloading) {
        this.isReloading = true;
        this.reloadTimer = this.getEffectiveReloadSec(slotState);
        soundEngine.playReload();
      }
      return;
    }

    slotState.ammoInMag -= 1;
    this.consecutiveShots += 1;
    this.animator.triggerFire();
    const isSilenced = slotState.attachments.muzzle === 'silencer';
    soundEngine.playGunshot(def.id, isSilenced);
    this.lastGunfightX = this.pos.x;
    this.lastGunfightZ = this.pos.z;
    this.lastGunfightTimer = 14;

    const cam = this.world.camera;
    this.fillActiveTargetMeshes();

    let spreadMult = 1.0;
    if (slotState.attachments.muzzle === 'compensator') spreadMult *= 0.68;
    if (slotState.attachments.foregrip === 'grip') spreadMult *= 0.78;
    const effectiveRange = isSilenced ? def.range * 1.08 : def.range;

    // Progressive spray bloom after 3 consecutive shots
    const sprayBloom =
      this.consecutiveShots > 3
        ? Math.min(0.032, (this.consecutiveShots - 3) * 0.0044)
        : 0;

    let pelletTotalDmg = 0;
    let pelletAnyHead = false;
    let pelletArmor = 0;
    let pelletHitPoint: THREE.Vector3 | null = null;

    for (let p = 0; p < def.pellets; p++) {
      const spreadFactor = (this.isAiming ? (def.pellets > 1 ? 0.55 : 0) : 1.0) * spreadMult;
      const totalSpread = def.spread * spreadFactor + sprayBloom;
      _spreadNdc.set(
        (Math.random() - 0.5) * totalSpread,
        (Math.random() - 0.5) * totalSpread,
      );
      this.raycaster.setFromCamera(_spreadNdc, cam);

      // 1. Ultra-fast analytical terrain distance check
      const terrainDist = this.raycastTerrainDist(
        this.raycaster.ray.origin,
        this.raycaster.ray.direction,
        effectiveRange,
      );
      let endDist = Math.min(effectiveRange * 0.55, terrainDist);

      // 2. Test tiny enemy hitboxes first (~20 boxes -> < 0.01ms)
      this.raycaster.far = terrainDist;
      const targetHits =
        this.scratchTargetMeshes.length > 0
          ? this.raycaster.intersectObjects(this.scratchTargetMeshes, false)
          : [];

      if (targetHits.length > 0) {
        const tHit = targetHits[0];
        this.raycaster.far = Math.max(0.2, tHit.distance - 0.1);
        const wallHits = this.raycaster.intersectObjects(
          this.solidObstaclesNoTerrain,
          false,
        );
        if (wallHits.length > 0) {
          endDist = wallHits[0].distance;
          const hitGlooId = wallHits[0].object.userData.glooId as string | undefined;
          const hitVehId = wallHits[0].object.userData.vehicleId as string | undefined;
          if (hitGlooId) {
            this.damageGlooById(hitGlooId, def.damage);
          } else if (hitVehId) {
            const veh = this.world.vehicles.find((v) => v.id === hitVehId);
            if (veh) this.damageVehicle(veh, def.damage);
          } else if (
            wallHits[0].object.userData.isExplosiveBarrelInst &&
            wallHits[0].instanceId !== undefined
          ) {
            this.detonateExplosiveBarrel(wallHits[0].instanceId);
          }
        } else {
          endDist = tHit.distance;
          const tId = tHit.object.userData.targetId as string | undefined;
          const isHead = Boolean(tHit.object.userData.isHeadshot);
          if (tId) {
            const dummy = this.targetById.get(tId);
            if (dummy && !dummy.isAlly && !dummy.eliminated && (dummy.downTimer <= 0 || dummy.isDowned)) {
              const { dmg, armorBlocked } = this.computeShotDamage(
                def,
                tHit.distance,
                isHead,
                dummy,
              );
              this.damageDealt += dmg;
              this.hitmarkerTimer = 0.18;
              if (isHead) {
                this.headshotFlashTimer = 0.45;
              }
              pelletTotalDmg += dmg;
              pelletAnyHead = pelletAnyHead || isHead;
              pelletArmor = Math.max(pelletArmor, armorBlocked);
              pelletHitPoint = tHit.point;

              soundEngine.playHitmarker();
              this.applyBotHitDamage(
                dummy,
                dmg,
                true,
                this.playerNick,
                def.shortName,
                isHead,
                this.pos.x,
                this.pos.z,
              );
            }
          }
        }
      } else if (p === 0) {
        this.raycaster.far = Math.min(effectiveRange * 0.85, terrainDist);
        const wallHits = this.raycaster.intersectObjects(
          this.solidObstaclesNoTerrain,
          false,
        );
        if (wallHits.length > 0) {
          endDist = wallHits[0].distance;
          const hitGlooId = wallHits[0].object.userData.glooId as string | undefined;
          const hitVehId = wallHits[0].object.userData.vehicleId as string | undefined;
          if (hitGlooId) {
            this.damageGlooById(hitGlooId, def.damage);
          } else if (hitVehId) {
            const veh = this.world.vehicles.find((v) => v.id === hitVehId);
            if (veh) this.damageVehicle(veh, def.damage);
          } else if (
            wallHits[0].object.userData.isExplosiveBarrelInst &&
            wallHits[0].instanceId !== undefined
          ) {
            this.detonateExplosiveBarrel(wallHits[0].instanceId);
          }
        }
      }

      // Spawn pooled tracer from weapon muzzle toward ray point
      this.playerRig.muzzleFlash.getWorldPosition(_rayOrigin);
      _rayDir.copy(this.raycaster.ray.direction).normalize();
      _v2.copy(cam.position).addScaledVector(_rayDir, endDist);
      this.spawnTracer(_rayOrigin, _v2);
    }

    if (pelletTotalDmg > 0 && pelletHitPoint) {
      this.pushDamagePopup(pelletHitPoint, pelletTotalDmg, pelletAnyHead, pelletArmor);
    }
  }

  private hasStandingTeammate(teamId: number, excludeId: string): boolean {
    if (teamId === 0 && !this.isDead) return true;
    const bots = this.world.targets;
    for (let i = 0; i < bots.length; i++) {
      const m = bots[i];
      if (m.teamId === teamId && m.id !== excludeId && !m.eliminated && !m.isDowned && m.downTimer <= 0) {
        return true;
      }
    }
    return false;
  }

  private finalizeBotElimination(
    bot: TargetDummy,
    creditPlayer: boolean,
    killerName: string,
    weaponShort: string,
    isHeadshot: boolean,
  ): void {
    if (bot.eliminated || bot.downTimer > 0) return;
    bot.isDowned = false;
    bot.bleedHp = 0;
    bot.hp = 0;
    bot.downTimer = 1.6;
    const isPlaying = this.stateMachine.getState() === GameState.PLAYING;

    if (creditPlayer) {
      this.kills += 1;
      this.ffCoins += 100;
      soundEngine.playKillSound(isHeadshot);
    }

    this.pushKillFeed(killerName, bot.nick, weaponShort, isHeadshot, creditPlayer);

    if (isPlaying) {
      this.aliveCount = Math.max(1, this.aliveCount - 1);
      // Team wipe check: if last standing member died, any already-downed teammates on same team eliminate too
      if (!this.hasStandingTeammate(bot.teamId, bot.id)) {
        const bots = this.world.targets;
        for (let i = 0; i < bots.length; i++) {
          const mate = bots[i];
          if (mate.teamId === bot.teamId && mate.id !== bot.id && mate.isDowned && !mate.eliminated) {
            mate.isDowned = false;
            mate.bleedHp = 0;
            mate.downTimer = 1.4;
            if (mate.knockedByPlayer || creditPlayer) {
              this.kills += 1;
            }
            this.aliveCount = Math.max(1, this.aliveCount - 1);
            this.pushKillFeed(killerName, mate.nick, weaponShort, false, mate.knockedByPlayer || creditPlayer);
          }
        }
      }

      const anyEnemyAlive = this.world.targets.some(
        (b) => !b.isAlly && !b.eliminated && b.downTimer <= 0,
      );
      if (!anyEnemyAlive) {
        this.aliveCount = 1;
        this.stateMachine.forceState(GameState.WIN);
      }
    }
  }

  private applyBotHitDamage(
    bot: TargetDummy,
    dmg: number,
    attackerIsPlayer: boolean,
    attackerName: string,
    weaponShort: string,
    isHeadshot: boolean,
    attackerX?: number,
    attackerZ?: number,
  ): void {
    if (bot.eliminated || (bot.downTimer > 0 && !bot.isDowned)) return;
    bot.hitFlash = 1.0;

    if (bot.isDowned) {
      bot.bleedHp -= dmg * 1.15;
      if (bot.bleedHp <= 0) {
        const creditPlayer = attackerIsPlayer || bot.knockedByPlayer;
        this.finalizeBotElimination(
          bot,
          creditPlayer,
          attackerIsPlayer ? this.playerNick : attackerName,
          weaponShort,
          isHeadshot,
        );
      }
      return;
    }

    bot.hp -= dmg;
    const isPlaying = this.stateMachine.getState() === GameState.PLAYING;
    if (
      isPlaying &&
      bot.hp > 0 &&
      bot.hp <= bot.maxHp * 0.35 &&
      bot.gloos > 0 &&
      bot.glooCooldown <= 0 &&
      bot.airState === 'ground'
    ) {
      const tx = attackerIsPlayer ? this.pos.x : (attackerX ?? bot.group.position.x + 8);
      const tz = attackerIsPlayer ? this.pos.z : (attackerZ ?? bot.group.position.z + 8);
      this.deployBotGlooWall(bot, tx, tz);
    }

    if (bot.hp <= 0) {
      if (isPlaying && this.matchMode !== 'solo' && this.hasStandingTeammate(bot.teamId, bot.id)) {
        bot.hp = 0;
        bot.isDowned = true;
        bot.bleedHp = 100;
        bot.revivingMateId = null;
        bot.reviveTimer = 0;
        bot.knockedByPlayer = attackerIsPlayer;
        bot.targetId = null;
        if (attackerIsPlayer) {
          soundEngine.playHitmarker();
        }
        this.pushKillFeed(`${attackerName} (DERRUBOU)`, bot.nick, weaponShort, isHeadshot, attackerIsPlayer);
      } else {
        this.finalizeBotElimination(bot, attackerIsPlayer, attackerName, weaponShort, isHeadshot);
      }
    }
  }

  private pushKillFeed(
    killerName: string,
    victimName: string,
    weaponShort: string,
    isHeadshot: boolean,
    isPlayerKiller: boolean,
  ): void {
    if (this.killFeed.length >= 5) {
      this.killFeed.shift();
    }
    this.killFeed.push({
      id: this.nextKillFeedId++,
      killerName,
      victimName,
      weaponShort,
      isHeadshot,
      isPlayerKiller,
      age: 0,
    });
  }

  private canBotSeePoint(
    bot: TargetDummy,
    tx: number,
    ty: number,
    tz: number,
    maxDist: number,
  ): boolean {
    const bx = bot.group.position.x;
    const by = bot.group.position.y + 1.35;
    const bz = bot.group.position.z;
    const dx = tx - bx;
    const dy = ty - by;
    const dz = tz - bz;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > maxDist * maxDist) return false;
    const dist = Math.sqrt(distSq);

    // If > 16m away, enemy must be inside bot's forward field-of-view cone (~155 deg)
    if (dist > 16) {
      const fx = Math.sin(bot.group.rotation.y);
      const fz = Math.cos(bot.group.rotation.y);
      const horiz = Math.hypot(dx, dz) || 1;
      const dot = (dx * fx + dz * fz) / horiz;
      if (dot < 0.22) return false;
    }

    _v1.set(bx, by, bz);
    _v2.set(tx, ty, tz);
    return this.hasLineOfSightToPoint(_v1, _v2);
  }

  private updateBots(dt: number, state: GameState): void {
    const bots = this.world.targets;
    const isPlaying = state === GameState.PLAYING;
    const isWaiting = state === GameState.WAITING;
    const combatEnabled = isPlaying || isWaiting;
    const dropEnabled =
      state === GameState.AIRPLANE ||
      state === GameState.DROPPING ||
      state === GameState.PARACHUTE ||
      isPlaying;
    let losBudget = 14;

    const enemyRenderDist = this.getEnemyRenderDist();
    const effectiveRenderDist =
      state === GameState.DROPPING || state === GameState.PARACHUTE
        ? Math.max(enemyRenderDist, 140)
        : enemyRenderDist;
    const effectiveRenderDistSq = effectiveRenderDist * effectiveRenderDist;
    const playerSightRange = Math.min(68, enemyRenderDist * 0.9);
    const playerSightRangeSq = playerSightRange * playerSightRange;

    const formOffsets: Array<[number, number]> = [
      [-3.2, -2.6],
      [3.2, -2.6],
      [0.0, -4.6],
    ];
    let allyGroundSlot = 0;
    let allyAirSlot = 0;
    const playerFwdX = -Math.sin(this.yaw);
    const playerFwdZ = -Math.cos(this.yaw);
    const playerRightX = Math.cos(this.yaw);
    const playerRightZ = -Math.sin(this.yaw);

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (bot.eliminated) continue;

      if (bot.downTimer > 0) {
        bot.downTimer = Math.max(0, bot.downTimer - dt);
        bot.group.rotation.x = THREE.MathUtils.damp(
          bot.group.rotation.x,
          -Math.PI * 0.46,
          12,
          dt,
        );
        if (bot.downTimer === 0) {
          if (isPlaying) {
            bot.eliminated = true;
            bot.group.visible = false;
            if (bot.parachuteMesh) bot.parachuteMesh.visible = false;
            const dropY = this.resolveFloorHeight(
              bot.group.position.x,
              bot.group.position.z,
              bot.group.position.y + 0.6,
            );
            this.world.spawnDroppedLoot({
              kind: 'deathbox',
              x: bot.group.position.x,
              y: dropY,
              z: bot.group.position.z,
              label: `Loot de ${bot.nick}`,
              deathLoot: {
                medkits: Math.max(1, bot.medkits),
                gloos: Math.max(1, bot.gloos),
                grenades: 1,
                ammo: 35,
                coins: 120,
                vestLevel: bot.vestLevel,
                helmetLevel: bot.helmetLevel,
                weaponId: bot.weaponId !== 'g18' ? bot.weaponId : undefined,
              },
            });
          } else {
            // Warm-up island respawns knocked bots automatically
            bot.hp = bot.maxHp;
            bot.isDowned = false;
            bot.bleedHp = 100;
            bot.vestHp = bot.vestMaxHp;
            bot.helmetHp = bot.helmetMaxHp;
            if (bot.vestMesh) bot.vestMesh.visible = bot.vestLevel > 0;
            if (bot.helmetMesh) bot.helmetMesh.visible = bot.helmetLevel > 0;
            bot.group.rotation.x = 0;
          }
        }
        continue;
      }

      // 0. Bot Airplane -> Skydiving -> Parachute Landing!
      if (bot.airState === 'inPlane') {
        if (!dropEnabled || bot.isAlly) continue;
        if (this.airplaneProgress >= bot.dropProgress || isPlaying) {
          const planePos = this.world.airplaneGroup.position;
          const spawnX =
            isPlaying && this.airplaneProgress >= 1.0
              ? bot.landX + (Math.random() - 0.5) * 24
              : planePos.x + (Math.random() - 0.5) * 6;
          const spawnZ =
            isPlaying && this.airplaneProgress >= 1.0
              ? bot.landZ + (Math.random() - 0.5) * 24
              : planePos.z + (Math.random() - 0.5) * 6;
          bot.airState = 'skydiving';
          bot.vy = -22;
          bot.group.visible = true;
          bot.group.position.set(spawnX, 110, spawnZ);
        }
        continue;
      }

      if (bot.airState === 'skydiving' || bot.airState === 'parachuting') {
        if (bot.isAlly) {
          const [rx, fx] = formOffsets[allyAirSlot % formOffsets.length];
          allyAirSlot++;
          const targetX = this.pos.x + playerRightX * rx + playerFwdX * fx;
          const targetZ = this.pos.z + playerRightZ * rx + playerFwdZ * fx;
          const dx = targetX - bot.group.position.x;
          const dz = targetZ - bot.group.position.z;
          const dist = Math.hypot(dx, dz);
          const isChute = bot.airState === 'parachuting';
          if (dist > 0.4) {
            const steer = Math.min(dist, (isChute ? 19 : 28) * dt);
            bot.group.position.x += (dx / dist) * steer;
            bot.group.position.z += (dz / dist) * steer;
            bot.group.rotation.y = this.yaw + Math.PI;
          }
          const gy = Math.max(0.4, this.world.groundHeightAt(bot.group.position.x, bot.group.position.z));
          const targetY = Math.max(gy, this.pos.y - 0.4);
          bot.group.position.y = THREE.MathUtils.damp(bot.group.position.y, targetY, 8, dt);
          if (!isChute && (state === GameState.PARACHUTE || bot.group.position.y - gy <= 28)) {
            bot.airState = 'parachuting';
            if (bot.parachuteMesh) bot.parachuteMesh.visible = true;
          }
          if (state === GameState.PLAYING || bot.group.position.y <= gy + 0.12) {
            bot.group.position.y = gy;
            bot.airState = 'ground';
            bot.vy = 0;
            if (bot.parachuteMesh) bot.parachuteMesh.visible = false;
            bot.goalX = targetX;
            bot.goalZ = targetZ;
          }
          continue;
        }

        const isChute = bot.airState === 'parachuting';
        const dx = bot.landX - bot.group.position.x;
        const dz = bot.landZ - bot.group.position.z;
        const dist = Math.hypot(dx, dz);
        const glideSpeed = isChute ? 12 : 20;
        if (dist > 1.5) {
          bot.group.position.x += (dx / dist) * glideSpeed * dt;
          bot.group.position.z += (dz / dist) * glideSpeed * dt;
          bot.group.rotation.y = Math.atan2(dx, dz);
        }
        bot.vy = THREE.MathUtils.damp(bot.vy, isChute ? -8.5 : -25, 3.2, dt);
        bot.group.position.y += bot.vy * dt;

        const gy = Math.max(0.4, this.world.groundHeightAt(bot.group.position.x, bot.group.position.z));
        if (!isChute && bot.group.position.y - gy <= 46) {
          bot.airState = 'parachuting';
          if (bot.parachuteMesh) bot.parachuteMesh.visible = true;
        }
        if (bot.group.position.y <= gy) {
          bot.group.position.y = gy;
          bot.airState = 'ground';
          bot.vy = 0;
          if (bot.parachuteMesh) bot.parachuteMesh.visible = false;
          bot.goalX = bot.landX;
          bot.goalZ = bot.landZ;
        }
        continue;
      }

      const activeVeh = this.activeVehicleId
        ? this.world.vehicles.find((v) => v.id === this.activeVehicleId) ?? null
        : null;
      if (activeVeh && activeVeh.passengerIds.includes(bot.id)) {
        bot.group.position.set(activeVeh.x, activeVeh.y + 0.5, activeVeh.z);
        bot.group.visible = false;
        continue;
      }

      const curAllySlot = bot.isAlly ? allyGroundSlot++ : 0;

      bot.group.rotation.x = THREE.MathUtils.damp(bot.group.rotation.x, 0, 10, dt);
      bot.aiTimer -= dt;
      bot.fireCooldown = Math.max(0, bot.fireCooldown - dt);
      bot.glooCooldown = Math.max(0, bot.glooCooldown - dt);
      bot.huntTimer = Math.max(0, bot.huntTimer - dt);

      const bx = bot.group.position.x;
      const bz = bot.group.position.z;
      const botCamDistSq =
        (bx - this.pos.x) * (bx - this.pos.x) + (bz - this.pos.z) * (bz - this.pos.z);
      const allyVisDist = Math.max(effectiveRenderDist, 165);
      const inRenderRange = botCamDistSq <= (bot.isAlly ? allyVisDist * allyVisDist : effectiveRenderDistSq);
      bot.group.visible = inRenderRange;

      // Downed crawling state ("posição de 4") in Duo / Squad
      if (bot.isDowned) {
        if (!isPlaying) {
          bot.isDowned = false;
          bot.hp = bot.maxHp;
          continue;
        }
        let bleedRate = 5.4;
        const distZone = Math.hypot(bx - this.zoneCurrentX, bz - this.zoneCurrentZ);
        if (distZone > this.zoneCurrentRadius) {
          const pDef = SAFE_ZONE_PHASES[Math.min(SAFE_ZONE_PHASES.length - 1, this.zonePhase - 1)];
          bleedRate += pDef.damagePerSec * 0.75;
        }
        bot.bleedHp -= bleedRate * dt;
        if (bot.bleedHp <= 0) {
          this.finalizeBotElimination(
            bot,
            bot.knockedByPlayer,
            bot.knockedByPlayer ? this.playerNick : 'SANGRAMENTO',
            bot.knockedByPlayer ? 'ELIMINADO' : 'SANGRAMENTO',
            false,
          );
          continue;
        }

        // Knocked allies crawl toward the player for rescue; knocked enemies crawl away
        let cdx = bot.isAlly ? this.pos.x - bx : bx - this.pos.x;
        let cdz = bot.isAlly ? this.pos.z - bz : bz - this.pos.z;
        const cdist = Math.hypot(cdx, cdz) || 1;
        let movingCrawl = true;
        if (bot.isAlly && cdist <= 1.85) {
          movingCrawl = false;
        }
        cdx /= cdist;
        cdz /= cdist;
        const crawlSpeed = movingCrawl ? 1.25 : 0;
        const nx = THREE.MathUtils.clamp(bx + cdx * crawlSpeed * dt, -490, 490);
        const nz = THREE.MathUtils.clamp(bz + cdz * crawlSpeed * dt, -490, 490);
        const ny = this.world.groundHeightAt(nx, nz);
        if (ny >= 0.35 && movingCrawl) {
          bot.group.position.set(nx, ny, nz);
          bot.group.rotation.y = Math.atan2(cdx, cdz);
        }

        if (inRenderRange) {
          if (movingCrawl) {
            bot.walkPhase += dt * 4.6;
          }
          const sw = movingCrawl ? Math.sin(bot.walkPhase) * 0.24 : 0;
          if (bot.gunMesh) bot.gunMesh.visible = false;
          if (bot.torsoGroup) {
            bot.torsoGroup.position.set(0, 0.46, 0.02);
            bot.torsoGroup.rotation.x = THREE.MathUtils.damp(
              bot.torsoGroup.rotation.x,
              Math.PI * 0.38,
              14,
              dt,
            );
          }
          if (bot.headMesh) {
            bot.headMesh.rotation.x = THREE.MathUtils.damp(bot.headMesh.rotation.x, -0.65, 14, dt);
          }
          if (bot.armLPivot) bot.armLPivot.rotation.x = -1.10 + sw * 0.45;
          if (bot.armRPivot) bot.armRPivot.rotation.x = -1.10 - sw * 0.45;
          if (bot.legLPivot) {
            bot.legLPivot.position.set(-0.11, 0.42, 0.0);
            bot.legLPivot.rotation.x = Math.PI * 0.40 + sw * 0.28;
          }
          if (bot.legRPivot) {
            bot.legRPivot.position.set(0.11, 0.42, 0.0);
            bot.legRPivot.rotation.x = Math.PI * 0.40 - sw * 0.28;
          }
        }
        continue;
      }

      // Restore standing pose cleanly when not downed
      if (bot.gunMesh) bot.gunMesh.visible = true;
      if (bot.torsoGroup) {
        bot.torsoGroup.position.set(0, 0.78, 0);
        bot.torsoGroup.rotation.x = 0;
      }
      if (bot.headMesh) bot.headMesh.rotation.x = 0;
      if (bot.legLPivot) bot.legLPivot.position.set(-0.1, 0.78, 0);
      if (bot.legRPivot) bot.legRPivot.position.set(0.1, 0.78, 0);

      if (bot.targetId === 'player' && (bot.isAlly || botCamDistSq > playerSightRangeSq)) {
        bot.targetId = null;
      }

      // Bot takes Safe Zone damage if caught outside blue ring
      if (isPlaying) {
        const distZone = Math.hypot(bx - this.zoneCurrentX, bz - this.zoneCurrentZ);
        if (distZone > this.zoneCurrentRadius) {
          const pDef = SAFE_ZONE_PHASES[Math.min(SAFE_ZONE_PHASES.length - 1, this.zonePhase - 1)];
          this.applyBotHitDamage(
            bot,
            pDef.damagePerSec * 0.75 * dt,
            false,
            'ZONA SEGURA',
            'SAFE',
            false,
          );
          if (bot.isDowned || bot.downTimer > 0) continue;
        }
      }

      // 1. Periodic staggered sight-based AI decision
      if (bot.aiTimer <= 0) {
        bot.aiTimer = 0.5 + ((i * 17) % 10) * 0.04;
        bot.targetId = null;

        const distFromZone = Math.hypot(bx - this.zoneCurrentX, bz - this.zoneCurrentZ);
        const needSafeMove = isPlaying && distFromZone > this.zoneCurrentRadius * 0.85;

        // Check for a downed squadmate needing rescue (bots save teammates like real players!)
        let downedMate: TargetDummy | null = null;
        if (isPlaying && this.matchMode !== 'solo') {
          let bestMateDistSq = 68 * 68;
          for (let j = 0; j < bots.length; j++) {
            if (i === j) continue;
            const other = bots[j];
            if (other.teamId !== bot.teamId || !other.isDowned || other.eliminated || other.downTimer > 0) {
              continue;
            }
            const md2 =
              (other.group.position.x - bx) * (other.group.position.x - bx) +
              (other.group.position.z - bz) * (other.group.position.z - bz);
            if (md2 < bestMateDistSq) {
              bestMateDistSq = md2;
              downedMate = other;
            }
          }
        }

        let immediateThreatDistSq = Infinity;
        if (combatEnabled && losBudget > 0) {
          // Sight-based enemy search up to 105m for brisk Free Fire action
          let bestDistSq = isPlaying ? 105 * 105 : 38 * 38;
          let candidate: TargetDummy | null = null;
          for (let j = 0; j < bots.length; j++) {
            if (i === j) continue;
            const other = bots[j];
            if (other.teamId === bot.teamId) continue;
            if (other.eliminated || other.downTimer > 0 || other.airState !== 'ground') continue;
            const ddx = other.group.position.x - bx;
            const ddz = other.group.position.z - bz;
            let d2 = ddx * ddx + ddz * ddz + (other.isDowned ? 900 : 0);
            if (bot.isAlly && other.targetId === 'player') {
              d2 *= 0.45;
            }
            if (d2 < bestDistSq) {
              bestDistSq = d2;
              candidate = other;
            }
          }
          if (candidate) {
            losBudget--;
            if (
              this.canBotSeePoint(
                bot,
                candidate.group.position.x,
                candidate.group.position.y + (candidate.isDowned ? 0.55 : candidate.chestOffsetY),
                candidate.group.position.z,
                isPlaying ? 105 : 38,
              )
            ) {
              bot.targetId = candidate.id;
              immediateThreatDistSq = bestDistSq;
            }
          }

          if (!bot.isAlly && !bot.targetId && isPlaying && !this.isDead && losBudget > 0) {
            if (botCamDistSq <= playerSightRangeSq) {
              losBudget--;
              if (
                this.canBotSeePoint(
                  bot,
                  this.pos.x,
                  this.pos.y + 1.25,
                  this.pos.z,
                  playerSightRange,
                )
              ) {
                bot.targetId = 'player';
                immediateThreatDistSq = botCamDistSq;
              }
            }
          }
        }

        if (downedMate && immediateThreatDistSq > 14 * 14) {
          if (bot.aiState !== 'revive' || bot.revivingMateId !== downedMate.id) {
            bot.reviveTimer = 0;
          }
          bot.aiState = 'revive';
          bot.revivingMateId = downedMate.id;
          bot.targetId = null;
        } else if (bot.targetId) {
          bot.aiState = 'combat';
          bot.revivingMateId = null;
          bot.reviveTimer = 0;
        } else if (bot.hp < 125 && bot.medkits > 0) {
          if (bot.aiState !== 'heal') {
            bot.healTimer = 3.2;
          }
          bot.aiState = 'heal';
          bot.revivingMateId = null;
        } else if (needSafeMove && !bot.isAlly) {
          bot.aiState = 'roam';
          const ang = (i * 1.47 + this.elapsed * 0.2) % (Math.PI * 2);
          const rr = Math.min(this.zoneNextRadius * 0.65, 110);
          bot.goalX = this.zoneNextX + Math.cos(ang) * rr;
          bot.goalZ = this.zoneNextZ + Math.sin(ang) * rr;
        } else if (bot.isAlly && isPlaying) {
          // Realistic Autonomous Ally: loots, fights & explores independently; boards player's vehicle if nearby!
          const distToPlayer = Math.hypot(this.pos.x - bx, this.pos.z - bz);
          const distGoal = Math.hypot(bot.goalX - bx, bot.goalZ - bz);
          const activeVeh = this.activeVehicleId
            ? this.world.vehicles.find((v) => v.id === this.activeVehicleId) ?? null
            : null;

          if (activeVeh && !activeVeh.destroyed && activeVeh.passengerIds.length < 3 && distToPlayer < 32) {
            bot.aiState = 'roam';
            bot.goalX = activeVeh.x;
            bot.goalZ = activeVeh.z;
            if (distToPlayer < 4.5) {
              activeVeh.passengerIds.push(bot.id);
              bot.group.visible = false;
              soundEngine.playVehicleEnter();
            }
          } else if (needSafeMove) {
            bot.aiState = 'roam';
            const ang = (curAllySlot * 1.45 + this.elapsed * 0.15) % (Math.PI * 2);
            const rr = Math.min(this.zoneNextRadius * 0.55, 45);
            bot.goalX = this.zoneNextX + Math.cos(ang) * rr;
            bot.goalZ = this.zoneNextZ + Math.sin(ang) * rr;
          } else if (distToPlayer > 78) {
            // Regroup smoothly only if drifted very far from squad
            const formAng = curAllySlot * 1.25 + this.yaw + Math.PI;
            bot.aiState = 'roam';
            bot.goalX = THREE.MathUtils.clamp(this.pos.x + Math.sin(formAng) * 16, -480, 480);
            bot.goalZ = THREE.MathUtils.clamp(this.pos.z + Math.cos(formAng) * 16, -480, 480);
          } else {
            let foundAllyLoot = false;
            if (bot.weaponId === 'g18' || bot.vestLevel < 2 || bot.medkits < 2) {
              for (let l = 0; l < this.world.loots.length; l++) {
                const loot = this.world.loots[l];
                if (loot.data.collected || loot.data.kind === 'deathbox' || loot.data.kind === 'coin') {
                  continue;
                }
                const db = Math.hypot(loot.data.x - bx, loot.data.z - bz);
                const dp = Math.hypot(loot.data.x - this.pos.x, loot.data.z - this.pos.z);
                if (db < 42 && dp > 5.0) {
                  bot.aiState = 'loot';
                  bot.goalX = loot.data.x;
                  bot.goalZ = loot.data.z;
                  foundAllyLoot = true;
                  break;
                }
              }
            }
            if (!foundAllyLoot && (distGoal < 4.5 || bot.huntTimer <= 0)) {
              bot.huntTimer = 4.5 + curAllySlot * 0.8;
              bot.aiState = 'roam';
              const flankAng = (curAllySlot * 2.1 + this.elapsed * 0.25) % (Math.PI * 2);
              const tacticalR = 14 + (curAllySlot % 3) * 8;
              let gx = THREE.MathUtils.clamp(this.pos.x + Math.cos(flankAng) * tacticalR, -480, 480);
              let gz = THREE.MathUtils.clamp(this.pos.z + Math.sin(flankAng) * tacticalR, -480, 480);
              if (this.world.groundHeightAt(gx, gz) < 0.7) {
                gx = this.pos.x;
                gz = this.pos.z;
              }
              bot.goalX = gx;
              bot.goalZ = gz;
            }
          }
        } else {
          // Pick up nearby gear if carrying weak gun, else hunt active firefights!
          let foundLoot = false;
          if (bot.weaponId === 'g18' || bot.vestLevel === 0) {
            for (let l = 0; l < this.world.loots.length; l++) {
              const loot = this.world.loots[l];
              if (loot.data.collected || loot.data.kind === 'deathbox') continue;
              const dp = Math.hypot(loot.data.x - this.pos.x, loot.data.z - this.pos.z);
              if (!bot.isAlly && dp < 15) continue;
              const db = Math.hypot(loot.data.x - bx, loot.data.z - bz);
              if (db < 34) {
                bot.aiState = 'loot';
                bot.goalX = loot.data.x;
                bot.goalZ = loot.data.z;
                foundLoot = true;
                break;
              }
            }
          }

          if (!foundLoot) {
            bot.aiState = 'roam';
            const distGoal = Math.hypot(bot.goalX - bx, bot.goalZ - bz);
            if (distGoal < 5.0 || (isPlaying && bot.huntTimer <= 0)) {
              bot.huntTimer = 4.2 + (i % 5) * 0.7;

              // Proactively hunt nearest enemy / gunfight hotspot ("caçar tretação")
              let huntX: number | null = null;
              let huntZ: number | null = null;
              let bestEnemyDistSq = 210 * 210;
              for (let j = 0; j < bots.length; j++) {
                if (i === j) continue;
                const other = bots[j];
                if (other.teamId === bot.teamId || other.eliminated || other.downTimer > 0 || other.airState !== 'ground') {
                  continue;
                }
                const ex = other.group.position.x;
                const ez = other.group.position.z;
                if (
                  isPlaying &&
                  Math.hypot(ex - this.zoneCurrentX, ez - this.zoneCurrentZ) > this.zoneCurrentRadius * 0.94
                ) {
                  continue;
                }
                const d2 = (ex - bx) * (ex - bx) + (ez - bz) * (ez - bz);
                if (d2 < bestEnemyDistSq) {
                  bestEnemyDistSq = d2;
                  huntX = ex;
                  huntZ = ez;
                }
              }

              if (huntX !== null && huntZ !== null) {
                const ang = ((i * 1.7) % (Math.PI * 2));
                bot.goalX = THREE.MathUtils.clamp(huntX + Math.cos(ang) * 14, -480, 480);
                bot.goalZ = THREE.MathUtils.clamp(huntZ + Math.sin(ang) * 14, -480, 480);
              } else if (
                isPlaying &&
                this.lastGunfightTimer > 0 &&
                Math.hypot(this.lastGunfightX - this.zoneCurrentX, this.lastGunfightZ - this.zoneCurrentZ) <
                  this.zoneCurrentRadius * 0.9
              ) {
                bot.goalX = this.lastGunfightX + ((i % 3) - 1) * 14;
                bot.goalZ = this.lastGunfightZ + (((i + 1) % 3) - 1) * 14;
              } else {
                const pois = this.world.pois;
                const poi = pois[(i + Math.floor(this.elapsed * 2.5)) % pois.length];
                const ang = (i * 1.9 + this.elapsed * 0.5) % (Math.PI * 2);
                const rad = 12 + (i % 5) * 10;
                let gx = poi.x + Math.cos(ang) * rad;
                let gz = poi.z + Math.sin(ang) * rad;
                if (
                  isPlaying &&
                  Math.hypot(gx - this.zoneCurrentX, gz - this.zoneCurrentZ) >
                    this.zoneCurrentRadius * 0.85
                ) {
                  gx = this.zoneNextX + Math.cos(ang) * Math.min(80, this.zoneNextRadius * 0.6);
                  gz = this.zoneNextZ + Math.sin(ang) * Math.min(80, this.zoneNextRadius * 0.6);
                }
                if (this.world.groundHeightAt(gx, gz) < 0.7) {
                  gx = this.zoneCurrentX;
                  gz = this.zoneCurrentZ;
                }
                bot.goalX = gx;
                bot.goalZ = gz;
              }
            }
          }
        }
      }

      // 2. Execute state: Revive vs Heal vs Combat vs Loot vs Roam
      let moveDirX = 0;
      let moveDirZ = 0;
      let isMoving = false;
      let isCrouchingAction = false;

      if (bot.aiState === 'revive' && bot.revivingMateId) {
        const mate = this.targetById.get(bot.revivingMateId);
        if (!mate || !mate.isDowned || mate.eliminated || mate.downTimer > 0) {
          bot.revivingMateId = null;
          bot.reviveTimer = 0;
          bot.aiState = 'roam';
        } else {
          const dx = mate.group.position.x - bx;
          const dz = mate.group.position.z - bz;
          const mDist = Math.hypot(dx, dz);
          bot.group.rotation.y = lerpAngle(bot.group.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
          if (mDist > 2.4) {
            moveDirX = dx / mDist;
            moveDirZ = dz / mDist;
            isMoving = true;
          } else {
            isCrouchingAction = true;
            if (
              bot.reviveTimer === 0 &&
              bot.hp > 0 &&
              bot.hp <= bot.maxHp * 0.35 &&
              bot.gloos > 0 &&
              bot.glooCooldown <= 0
            ) {
              // Only drop protective Gloo Wall while reviving if bot itself is at low HP
              this.deployBotGlooWall(bot, bx + Math.sin(bot.group.rotation.y) * 8, bz + Math.cos(bot.group.rotation.y) * 8);
            }
            bot.reviveTimer += dt;
            if (bot.reviveTimer >= 2.8) {
              mate.isDowned = false;
              mate.hp = 115;
              mate.bleedHp = 100;
              mate.downTimer = 0;
              mate.knockedByPlayer = false;
              mate.aiState = mate.medkits > 0 ? 'heal' : 'roam';
              mate.healTimer = 3.0;
              if (mate.gunMesh) mate.gunMesh.visible = true;
              if (mate.torsoGroup) {
                mate.torsoGroup.position.set(0, 0.78, 0);
                mate.torsoGroup.rotation.set(0, 0, 0);
              }
              if (mate.headMesh) mate.headMesh.rotation.set(0, 0, 0);
              if (mate.legLPivot) {
                mate.legLPivot.position.set(-0.1, 0.78, 0);
                mate.legLPivot.rotation.set(0, 0, 0);
              }
              if (mate.legRPivot) {
                mate.legRPivot.position.set(0.1, 0.78, 0);
                mate.legRPivot.rotation.set(0, 0, 0);
              }
              this.pushKillFeed(bot.nick, `${mate.nick} SALVO`, 'REVIVE', false, bot.isAlly);
              bot.revivingMateId = null;
              bot.reviveTimer = 0;
              bot.aiState = 'roam';
            }
          }
        }
      } else if (bot.aiState === 'heal') {
        isCrouchingAction = true;
        bot.healTimer -= dt;
        if (bot.healTimer <= 0) {
          if (bot.medkits > 0) {
            bot.medkits -= 1;
            bot.hp = Math.min(bot.maxHp, bot.hp + 75);
          }
          bot.aiState = 'roam';
        }
      } else if (bot.aiState === 'combat' && bot.targetId) {
        let tx = 0;
        let ty = 0;
        let tz = 0;
        let targetAlive = false;
        let targetBot: TargetDummy | null = null;

        if (bot.targetId === 'player') {
          if (!bot.isAlly && !this.isDead && isPlaying) {
            tx = this.pos.x;
            ty = this.pos.y + 1.15;
            tz = this.pos.z;
            targetAlive = true;
          }
        } else {
          targetBot = this.targetById.get(bot.targetId) ?? null;
          if (targetBot && !targetBot.eliminated && targetBot.downTimer <= 0) {
            tx = targetBot.group.position.x;
            ty = targetBot.group.position.y + (targetBot.isDowned ? 0.45 : targetBot.chestOffsetY);
            tz = targetBot.group.position.z;
            targetAlive = true;
          }
        }

        if (!targetAlive) {
          bot.targetId = null;
          bot.aiState = 'roam';
        } else {
          const dx = tx - bx;
          const dz = tz - bz;
          const dist = Math.hypot(dx, dz);
          const faceYaw = Math.atan2(dx, dz);
          bot.group.rotation.y = lerpAngle(bot.group.rotation.y, faceYaw, 1 - Math.exp(-15 * dt));

          if (dist > 20) {
            moveDirX = dx / dist;
            moveDirZ = dz / dist;
            isMoving = true;
          } else if (dist > 1.8) {
            const strafeSign = i % 2 === 0 ? 1 : -1;
            moveDirX = (-dz / dist) * 0.58 * strafeSign;
            moveDirZ = (dx / dist) * 0.58 * strafeSign;
            isMoving = true;
          }

          if (bot.fireCooldown <= 0 && dist < 76) {
            const def = WEAPONS[bot.weaponId];
            bot.fireCooldown = Math.max(0.28, (def.fireRateMs / 1000) * 2.5);
            this.lastGunfightX = bx;
            this.lastGunfightZ = bz;
            this.lastGunfightTimer = 14;

            const camDistSq =
              (bx - this.pos.x) * (bx - this.pos.x) + (bz - this.pos.z) * (bz - this.pos.z);
            if (isPlaying && inRenderRange && camDistSq < 140 * 140) {
              soundEngine.playGunshot(bot.weaponId, false, Math.sqrt(camDistSq));
            }
            if (camDistSq < 110 * 110) {
              _v1.set(bx, bot.group.position.y + 1.25, bz);
              _v2.set(
                tx + (Math.random() - 0.5) * 1.1,
                ty + (Math.random() - 0.5) * 0.6,
                tz + (Math.random() - 0.5) * 1.1,
              );
              this.spawnTracer(_v1, _v2);
            }

            if (bot.targetId === 'player') {
              if (dist < 58 && Math.random() < 0.3) {
                const activeVeh = this.activeVehicleId
                  ? this.world.vehicles.find((v) => v.id === this.activeVehicleId) ?? null
                  : null;
                if (activeVeh && !activeVeh.destroyed && Math.random() < 0.62) {
                  this.damageVehicle(activeVeh, 16);
                } else {
                  const baseShotDmg = dist < 18 ? 14 : dist < 38 ? 10 : 7;
                  this.applyPlayerDamage(
                    baseShotDmg,
                    bx,
                    bz,
                    bot.nick,
                    def.shortName,
                    Math.random() < 0.12,
                  );
                }
              }
            } else if (targetBot) {
              const hitChance = dist < 18 ? 0.48 : dist < 42 ? 0.34 : 0.22;
              if (Math.random() < hitChance) {
                const isHead = !targetBot.isDowned && Math.random() < 0.16;
                const { dmg } = this.computeShotDamage(def, dist, isHead, targetBot);
                const dealt = Math.round(dmg * 0.78);
                const prevDead = targetBot.eliminated || targetBot.downTimer > 0;
                this.applyBotHitDamage(
                  targetBot,
                  dealt,
                  false,
                  bot.nick,
                  def.shortName,
                  isHead,
                  bx,
                  bz,
                );
                if (!prevDead && (targetBot.eliminated || targetBot.downTimer > 0)) {
                  bot.hp = Math.min(bot.maxHp, bot.hp + 45);
                }
              }
            }
          }
        }
      } else {
        const dx = bot.goalX - bx;
        const dz = bot.goalZ - bz;
        const dist = Math.hypot(dx, dz);
        if (dist > 1.4) {
          moveDirX = dx / dist;
          moveDirZ = dz / dist;
          isMoving = true;
          bot.group.rotation.y = lerpAngle(bot.group.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
        } else if (bot.aiState === 'loot') {
          for (let l = 0; l < this.world.loots.length; l++) {
            const loot = this.world.loots[l];
            if (loot.data.collected) continue;
            if (Math.hypot(loot.data.x - bx, loot.data.z - bz) < 2.8) {
              loot.data.collected = true;
              loot.mesh.visible = false;
              if (loot.data.kind === 'medkit') {
                bot.medkits = Math.min(4, bot.medkits + 1);
              } else if (loot.data.kind === 'gloo') {
                bot.gloos = Math.min(4, bot.gloos + 1);
              } else if (
                loot.data.kind === 'weapon' &&
                loot.data.weaponId &&
                loot.data.weaponId !== 'awm'
              ) {
                bot.weaponId = loot.data.weaponId;
              } else if (loot.data.kind === 'vest') {
                const lvl = loot.data.level ?? 1;
                if (lvl > bot.vestLevel) {
                  bot.vestLevel = lvl;
                  bot.vestMaxHp = lvl === 1 ? 100 : lvl === 2 ? 160 : 220;
                  bot.vestHp = bot.vestMaxHp;
                  if (bot.vestMesh) bot.vestMesh.visible = true;
                }
              } else if (loot.data.kind === 'helmet') {
                const lvl = loot.data.level ?? 1;
                if (lvl > bot.helmetLevel) {
                  bot.helmetLevel = lvl;
                  bot.helmetMaxHp = lvl === 1 ? 75 : lvl === 2 ? 120 : 180;
                  bot.helmetHp = bot.helmetMaxHp;
                  if (bot.helmetMesh) bot.helmetMesh.visible = true;
                }
              }
              break;
            }
          }
          bot.aiState = 'roam';
        }
      }

      // 3. Apply locomotion + terrain height (skip limbs animation if culled or > 85m)
      const animateLimbs = inRenderRange && botCamDistSq < 85 * 85;

      if (isCrouchingAction && animateLimbs) {
        if (bot.gunMesh) bot.gunMesh.visible = false;
        if (bot.torsoGroup) {
          bot.torsoGroup.position.set(0, 0.54, 0.03);
          bot.torsoGroup.rotation.x = 0.22;
        }
        const wrapWave = Math.sin(this.elapsed * 9.5 + i);
        if (bot.legLPivot) bot.legLPivot.rotation.x = -0.78;
        if (bot.legRPivot) bot.legRPivot.rotation.x = 0.45;
        if (bot.armLPivot) bot.armLPivot.rotation.x = -0.82 + wrapWave * 0.22;
        if (bot.armRPivot) bot.armRPivot.rotation.x = -0.82 - wrapWave * 0.22;
      } else if (isMoving) {
        let nx = bx + moveDirX * bot.moveSpeed * dt;
        let nz = bz + moveDirZ * bot.moveSpeed * dt;
        nx = THREE.MathUtils.clamp(nx, -490, 490);
        nz = THREE.MathUtils.clamp(nz, -490, 490);
        const ny = this.world.groundHeightAt(nx, nz);
        if (ny < 0.35) {
          bot.goalX = -bx * 0.4;
          bot.goalZ = -bz * 0.4;
        } else {
          bot.group.position.set(nx, ny, nz);
        }

        if (animateLimbs) {
          bot.walkPhase += dt * bot.moveSpeed * 2.1;
          const swing = Math.sin(bot.walkPhase) * 0.62;
          const bob = Math.abs(Math.sin(bot.walkPhase)) * 0.042;
          if (bot.torsoGroup) {
            bot.torsoGroup.position.y = 0.78 + bob;
            bot.torsoGroup.rotation.x = 0.08;
            bot.torsoGroup.rotation.z = Math.sin(bot.walkPhase) * 0.04;
          }
          if (bot.legLPivot) bot.legLPivot.rotation.x = THREE.MathUtils.damp(bot.legLPivot.rotation.x, swing, 16, dt);
          if (bot.legRPivot) bot.legRPivot.rotation.x = THREE.MathUtils.damp(bot.legRPivot.rotation.x, -swing, 16, dt);
          if (bot.armLPivot) bot.armLPivot.rotation.x = THREE.MathUtils.damp(bot.armLPivot.rotation.x, -swing * 0.65, 16, dt);
          if (bot.armRPivot) {
            bot.armRPivot.rotation.x = THREE.MathUtils.damp(
              bot.armRPivot.rotation.x,
              bot.aiState === 'combat' ? -0.95 : swing * 0.45,
              16,
              dt,
            );
          }
        }
      } else if (animateLimbs) {
        if (bot.torsoGroup) {
          bot.torsoGroup.position.y = 0.78 + Math.sin(this.elapsed * 2.4 + i) * 0.012;
          bot.torsoGroup.rotation.x = THREE.MathUtils.damp(bot.torsoGroup.rotation.x, 0, 10, dt);
          bot.torsoGroup.rotation.z = THREE.MathUtils.damp(bot.torsoGroup.rotation.z, 0, 10, dt);
        }
        if (bot.legLPivot) bot.legLPivot.rotation.x = THREE.MathUtils.damp(bot.legLPivot.rotation.x, 0, 10, dt);
        if (bot.legRPivot) bot.legRPivot.rotation.x = THREE.MathUtils.damp(bot.legRPivot.rotation.x, 0, 10, dt);
        if (bot.armLPivot) bot.armLPivot.rotation.x = THREE.MathUtils.damp(bot.armLPivot.rotation.x, 0, 10, dt);
        if (bot.armRPivot) {
          bot.armRPivot.rotation.x = THREE.MathUtils.damp(
            bot.armRPivot.rotation.x,
            bot.aiState === 'combat' ? -0.95 : 0,
            12,
            dt,
          );
        }
      }
    }
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    let slot: BulletTracer | undefined;
    for (let i = 0; i < this.tracerPool.length; i++) {
      if (!this.tracerPool[i].active) {
        slot = this.tracerPool[i];
        break;
      }
    }
    if (!slot) slot = this.tracerPool[0];
    slot.active = true;
    slot.life = 0.07;
    slot.mesh.visible = true;
    slot.mesh.position.copy(from).lerp(to, 0.25);
    slot.mesh.lookAt(to);
  }

  private updateTracers(dt: number): void {
    for (let i = 0; i < this.tracerPool.length; i++) {
      const tr = this.tracerPool[i];
      if (!tr.active) continue;
      tr.life -= dt;
      tr.mesh.translateZ(dt * 190);
      if (tr.life <= 0) {
        tr.active = false;
        tr.mesh.visible = false;
      }
    }
  }

  private clearAirDrops(): void {
    for (let i = 0; i < this.airDrops.length; i++) {
      const ad = this.airDrops[i];
      this.world.scene.remove(ad.group);
      this.world.scene.remove(ad.beaconBeam);
      this.world.scene.remove(ad.beaconRing);
      ad.beaconMat.dispose();
      ad.ringMat.dispose();
    }
    this.airDrops = [];
  }

  private spawnAirDrop(): void {
    const safeR = Math.min(Math.max(30, this.zoneCurrentRadius * 0.72), 340);
    let ax = this.zoneCurrentX;
    let az = this.zoneCurrentZ;
    let groundY = Math.max(0.8, this.world.groundHeightAt(ax, az));
    for (let attempt = 0; attempt < 16; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * safeR;
      const cx = THREE.MathUtils.clamp(this.zoneCurrentX + Math.cos(ang) * dist, -440, 440);
      const cz = THREE.MathUtils.clamp(this.zoneCurrentZ + Math.sin(ang) * dist, -440, 440);
      const gy = this.world.groundHeightAt(cx, cz);
      if (gy >= 1.2) {
        ax = cx;
        az = cz;
        groundY = gy;
        break;
      }
    }

    const startY = groundY + 115;
    const group = new THREE.Group();
    group.position.set(ax, startY, az);

    const crateMesh = new THREE.Mesh(this.airDropCrateGeo, this.airDropCrateMat);
    crateMesh.position.y = 0.675;
    crateMesh.castShadow = !this.isSoftwareGl;
    crateMesh.receiveShadow = !this.isSoftwareGl;

    const stripeMesh = new THREE.Mesh(this.airDropStripeGeo, this.airDropStripeMat);
    stripeMesh.position.y = 0.92;
    group.add(crateMesh, stripeMesh);

    const chuteGroup = new THREE.Group();
    const dome = new THREE.Mesh(this.airDropChuteGeo, this.airDropChuteMat);
    dome.position.y = 3.9;
    chuteGroup.add(dome);
    const cordOffsets = [
      [-0.65, -0.65, 0.22, -0.22],
      [0.65, -0.65, -0.22, -0.22],
      [-0.65, 0.65, 0.22, 0.22],
      [0.65, 0.65, -0.22, 0.22],
    ];
    for (let i = 0; i < cordOffsets.length; i++) {
      const [cx, cz, rx, rz] = cordOffsets[i];
      const cord = new THREE.Mesh(this.airDropCordGeo, this.airDropCordMat);
      cord.position.set(cx, 2.55, cz);
      cord.rotation.z = rx;
      cord.rotation.x = rz;
      chuteGroup.add(cord);
    }
    group.add(chuteGroup);
    this.world.scene.add(group);

    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beaconBeam = new THREE.Mesh(this.airDropBeamGeo, beaconMat);
    beaconBeam.position.set(ax, groundY + 82, az);
    this.world.scene.add(beaconBeam);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beaconRing = new THREE.Mesh(this.airDropRingGeo, ringMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.set(ax, groundY + 0.08, az);
    this.world.scene.add(beaconRing);

    this.airDrops.push({
      id: `airdrop_${this.nextAirDropId++}`,
      x: ax,
      z: az,
      y: startY,
      groundY,
      state: 'falling',
      group,
      chuteGroup,
      beaconBeam,
      beaconRing,
      beaconMat,
      ringMat,
    });

    this.airDropCountSpawned += 1;
    this.airDropNotice = 'AIRDROP A CAMINHO!';
    this.airDropNoticeTimer = 4.5;
    soundEngine.playParachuteOpen();
  }

  private updateAirDrops(dt: number): void {
    if (this.airDropNoticeTimer > 0) {
      this.airDropNoticeTimer -= dt;
      if (this.airDropNoticeTimer <= 0) {
        this.airDropNotice = null;
      }
    }

    this.airDropSpawnTimer -= dt;
    if (this.airDropSpawnTimer <= 0 && this.airDropCountSpawned < 5) {
      this.spawnAirDrop();
      this.airDropSpawnTimer = 52;
    }

    for (let i = 0; i < this.airDrops.length; i++) {
      const ad = this.airDrops[i];
      if (ad.state === 'falling') {
        ad.y -= 12.5 * dt;
        ad.group.rotation.y += dt * 0.28;
        ad.group.rotation.z = Math.sin(this.elapsed * 2.1 + i) * 0.06;
        if (ad.y <= ad.groundY) {
          ad.y = ad.groundY;
          ad.state = 'landed';
          ad.chuteGroup.visible = false;
          ad.group.rotation.z = 0;
          this.airDropNotice = 'AIRDROP CAIU NA ILHA!';
          this.airDropNoticeTimer = 4.0;
          if (Math.hypot(ad.x - this.pos.x, ad.z - this.pos.z) < 75) {
            soundEngine.playLanding();
          }
        }
        ad.group.position.set(ad.x, ad.y, ad.z);
      }

      if (ad.state === 'falling' || ad.state === 'landed') {
        const pulse = 1.0 + 0.26 * Math.sin(this.elapsed * 4.5 + i);
        ad.beaconRing.scale.set(pulse, pulse, 1);
        ad.ringMat.opacity = 0.55 + 0.28 * Math.sin(this.elapsed * 4.5 + i);
        ad.beaconMat.opacity =
          (ad.state === 'landed' ? 0.36 : 0.24) + 0.08 * Math.sin(this.elapsed * 3.2 + i);
      } else {
        ad.beaconBeam.visible = false;
        ad.beaconRing.visible = false;
      }
    }
  }

  private findNearbyAirDrop(): AirDropCrate | null {
    for (let i = 0; i < this.airDrops.length; i++) {
      const ad = this.airDrops[i];
      if (ad.state !== 'landed') continue;
      const d = Math.hypot(ad.x - this.pos.x, ad.z - this.pos.z);
      if (d < 3.2 && Math.abs(ad.y - this.pos.y) < 2.6) return ad;
    }
    return null;
  }

  private collectAirDrop(ad: AirDropCrate): void {
    ad.state = 'looted';
    ad.beaconBeam.visible = false;
    ad.beaconRing.visible = false;
    soundEngine.playPickup();

    // High-tier Level 3 Armor & Backpack + 200 FF Coins
    this.ffCoins += 200;
    this.vestLevel = 3;
    this.vestMaxHp = 220;
    this.vestHp = 220;
    this.helmetLevel = 3;
    this.helmetMaxHp = 180;
    this.helmetHp = 180;
    this.backpackLevel = 3;

    // Medkits, Gloos & Grenades
    this.medkitCount += 2;
    this.glooCount = Math.min(8, this.glooCount + 2);
    this.grenadeCount = Math.min(6, this.grenadeCount + 1);

    // 4x Scope
    if (!this.ownedScopes.includes('4x')) {
      this.ownedScopes.push('4x');
    }

    // Grant AWM-17 if player doesn't have one yet, otherwise fully kitted M4-17 / ammo boost
    const hasAwm =
      this.weapons[1]?.weaponId === 'awm' || this.weapons[2]?.weaponId === 'awm';
    const grantWeaponId: WeaponId = hasAwm ? 'm4a1' : 'awm';
    const def = WEAPONS[grantWeaponId];
    const hasBothSlots = Boolean(this.weapons[1] && this.weapons[2]);
    let targetSlot: 1 | 2 = !this.weapons[1] ? 1 : !this.weapons[2] ? 2 : this.activeSlot === 2 ? 2 : 1;

    if (hasAwm && this.weapons[1]?.weaponId === 'm4a1') {
      this.weapons[1]!.reserveAmmo += 90;
      targetSlot = 1;
    } else if (hasAwm && this.weapons[2]?.weaponId === 'm4a1') {
      this.weapons[2]!.reserveAmmo += 90;
      targetSlot = 2;
    } else {
      if (hasBothSlots && this.weapons[targetSlot]) {
        const oldW = this.weapons[targetSlot]!;
        this.spawnItemInFront({
          kind: 'weapon',
          weaponId: oldW.weaponId,
          label: WEAPONS[oldW.weaponId].name,
        });
      }
      this.weapons[targetSlot] = {
        weaponId: grantWeaponId,
        ammoInMag: grantWeaponId === 'm4a1' ? Math.round(def.magSize * 1.35) : def.magSize,
        reserveAmmo: grantWeaponId === 'awm' ? 30 : def.magSize * 5,
        scope: grantWeaponId === 'awm' ? 'sniper' : '4x',
        attachments: {
          muzzle: 'silencer',
          foregrip: grantWeaponId === 'awm' ? null : 'grip',
          magazine: 'ext_mag',
          stock: 'stock',
        },
      };
      this.activeSlot = targetSlot;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.playerRig.setWeapon(grantWeaponId);
    }

    this.airDropNotice = hasAwm ? 'AIRDROP SAQUEADO (COLETE NV.3 + M4)!' : 'AIRDROP SAQUEADO (AWM + NV.3)!';
    this.airDropNoticeTimer = 3.2;
  }

  public collectLootById(id: string): void {
    if (id.startsWith('airdrop_')) {
      const ad = this.airDrops.find((a) => a.id === id && a.state === 'landed');
      if (ad) this.collectAirDrop(ad);
      return;
    }
    const lv = this.world.loots.find((l) => l.data.id === id && !l.data.collected);
    if (lv) {
      this.applyLootVisualPickup(lv);
    }
  }

  private tryPickupNearbyLoot(): void {
    const airDrop = this.findNearbyAirDrop();
    if (airDrop) {
      this.collectAirDrop(airDrop);
      return;
    }
    const nearby = this.findNearbyLoot();
    if (nearby) {
      this.applyLootVisualPickup(nearby);
    }
  }

  private applyLootVisualPickup(nearby: LootVisual): void {
    const ld = nearby.data;
    if (ld.collected) return;
    ld.collected = true;
    nearby.mesh.visible = false;

    if (ld.kind === 'coin') {
      this.ffCoins += ld.coinAmount ?? 100;
      soundEngine.playCoinPickup();
      return;
    }

    soundEngine.playPickup();

    if (ld.kind === 'medkit') {
      if (this.getBackpackUsedWeight() + 12 <= this.getBackpackCapacity()) {
        this.medkitCount += 1;
      } else {
        this.hp = Math.min(this.maxHp, this.hp + 35);
      }
      return;
    }

    if (ld.kind === 'ammo') {
      const amt = ld.ammoAmount ?? 30;
      const w = this.weapons[this.activeSlot] ?? this.weapons[1] ?? this.weapons[2] ?? this.weapons[3];
      if (w) w.reserveAmmo += amt;
      return;
    }

    if (ld.kind === 'vest') {
      const lvl = ld.level ?? 1;
      const maxV = lvl === 1 ? 100 : lvl === 2 ? 160 : 220;
      if (lvl > this.vestLevel || (lvl === this.vestLevel && this.vestHp < maxV)) {
        this.vestLevel = lvl;
        this.vestMaxHp = maxV;
        this.vestHp = maxV;
      }
      return;
    }

    if (ld.kind === 'helmet') {
      const lvl = ld.level ?? 1;
      const maxH = lvl === 1 ? 75 : lvl === 2 ? 120 : 180;
      if (lvl > this.helmetLevel || (lvl === this.helmetLevel && this.helmetHp < maxH)) {
        this.helmetLevel = lvl;
        this.helmetMaxHp = maxH;
        this.helmetHp = maxH;
      }
      return;
    }

    if (ld.kind === 'backpack') {
      const lvl = ld.level ?? 2;
      if (lvl > this.backpackLevel) {
        this.backpackLevel = lvl;
      }
      return;
    }

    if (ld.kind === 'scope' && ld.scopeType) {
      const st = ld.scopeType;
      if (!this.ownedScopes.includes(st)) {
        this.ownedScopes.push(st);
      }
      const w = this.weapons[this.activeSlot];
      if (w && WEAPONS[w.weaponId].allowsCustomScope && w.scope === 'none') {
        w.scope = st;
      } else {
        this.addScopeToBackpack(st);
      }
      return;
    }

    if (ld.kind === 'attachment' && ld.attachmentKind) {
      const att = ld.attachmentKind;
      const slotKey = ATTACHMENT_LABELS[att].slot;
      const w = this.weapons[this.activeSlot];
      if (w && WEAPONS[w.weaponId].allowsAttachments && !w.attachments[slotKey]) {
        (w.attachments as Record<AttachmentSlotKey, AttachmentKind | null>)[slotKey] = att;
      } else {
        this.addAttachmentToBackpack(att);
      }
      return;
    }

    if (ld.kind === 'gloo') {
      this.glooCount = Math.min(8, this.glooCount + (ld.glooAmount ?? 1));
      return;
    }

    if (ld.kind === 'grenade') {
      this.grenadeCount = Math.min(6, this.grenadeCount + (ld.grenadeAmount ?? 1));
      return;
    }

    if (ld.kind === 'deathbox' && ld.deathLoot) {
      const dl = ld.deathLoot;
      this.ffCoins += dl.coins ?? 120;
      const w = this.weapons[this.activeSlot] ?? this.weapons[1] ?? this.weapons[2] ?? this.weapons[3];
      if (w) w.reserveAmmo += dl.ammo;
      if (dl.medkits > 0) {
        if (this.getBackpackUsedWeight() + 12 <= this.getBackpackCapacity()) {
          this.medkitCount += dl.medkits;
        } else {
          this.hp = Math.min(this.maxHp, this.hp + 35);
        }
      }
      this.glooCount = Math.min(8, this.glooCount + dl.gloos);
      this.grenadeCount = Math.min(6, this.grenadeCount + dl.grenades);
      if (dl.vestLevel > 0) {
        const maxV = dl.vestLevel === 1 ? 100 : dl.vestLevel === 2 ? 160 : 220;
        if (dl.vestLevel > this.vestLevel || (dl.vestLevel === this.vestLevel && this.vestHp < maxV)) {
          this.vestLevel = dl.vestLevel;
          this.vestMaxHp = maxV;
          this.vestHp = maxV;
        }
      }
      if (dl.helmetLevel > 0) {
        const maxH = dl.helmetLevel === 1 ? 75 : dl.helmetLevel === 2 ? 120 : 180;
        if (dl.helmetLevel > this.helmetLevel || (dl.helmetLevel === this.helmetLevel && this.helmetHp < maxH)) {
          this.helmetLevel = dl.helmetLevel;
          this.helmetMaxHp = maxH;
          this.helmetHp = maxH;
        }
      }
      if (dl.weaponId && (!this.weapons[1] || !this.weapons[2])) {
        const wid = dl.weaponId;
        const def = WEAPONS[wid];
        const targetSlot: 1 | 2 = !this.weapons[1] ? 1 : 2;
        this.weapons[targetSlot] = {
          weaponId: wid,
          ammoInMag: def.magSize,
          reserveAmmo: def.magSize * 3,
          scope: def.defaultScope,
          attachments: emptyAttachments(),
        };
        this.activeSlot = targetSlot;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.playerRig.setWeapon(wid);
        soundEngine.playWeaponSwitch();
      }
      return;
    }

    if (ld.kind === 'weapon' && ld.weaponId) {
      const wid: WeaponId = ld.weaponId;
      const def = WEAPONS[wid];
      if (wid === 'g18') {
        if (this.weapons[3]) {
          this.weapons[3]!.reserveAmmo += 30;
        } else {
          this.weapons[3] = {
            weaponId: 'g18',
            ammoInMag: def.magSize,
            reserveAmmo: 45,
            scope: 'none',
            attachments: emptyAttachments(),
          };
          this.activeSlot = 3;
          this.playerRig.setWeapon('g18');
          soundEngine.playWeaponSwitch();
        }
        return;
      }

      // Primary weapons fill Slot 1 or Slot 2 first, else replace active primary slot & drop old gun
      let targetSlot: 1 | 2 = 1;
      if (!this.weapons[1]) {
        targetSlot = 1;
      } else if (!this.weapons[2]) {
        targetSlot = 2;
      } else {
        targetSlot = this.activeSlot === 2 ? 2 : 1;
        const oldW = this.weapons[targetSlot]!;
        this.spawnItemInFront({
          kind: 'weapon',
          weaponId: oldW.weaponId,
          label: WEAPONS[oldW.weaponId].name,
        });
      }

      this.weapons[targetSlot] = {
        weaponId: wid,
        ammoInMag: def.magSize,
        reserveAmmo: def.magSize * 4,
        scope: def.defaultScope,
        attachments: emptyAttachments(),
      };
      this.activeSlot = targetSlot;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.playerRig.setWeapon(wid);
      soundEngine.playWeaponSwitch();
    }
  }

  private findNearbyLoot() {
    for (let i = 0; i < this.world.loots.length; i++) {
      const l = this.world.loots[i];
      if (l.data.collected) continue;
      const d = Math.hypot(l.data.x - this.pos.x, l.data.z - this.pos.z);
      if (d < 2.8 && Math.abs(l.data.y - this.pos.y) < 2.4) return l;
    }
    return null;
  }

  private findNearbyLoots(maxSlots = 6): NearbyLootSlot[] {
    const items: Array<{ dist: number; slot: NearbyLootSlot }> = [];
    const ad = this.findNearbyAirDrop();
    if (ad) {
      items.push({
        dist: 0,
        slot: {
          id: ad.id,
          kind: 'airdrop',
          label: 'AIRDROP (AWM + Nv.3)',
          subLabel: '+200 Moedas',
        },
      });
    }

    for (let i = 0; i < this.world.loots.length; i++) {
      const l = this.world.loots[i];
      if (l.data.collected) continue;
      const d = Math.hypot(l.data.x - this.pos.x, l.data.z - this.pos.z);
      if (d < 2.9 && Math.abs(l.data.y - this.pos.y) < 2.5) {
        let sub: string | undefined;
        if (l.data.kind === 'coin') sub = `+${l.data.coinAmount ?? 100}`;
        else if (l.data.kind === 'ammo') sub = `+${l.data.ammoAmount ?? 30}`;
        else if (l.data.kind === 'gloo') sub = `x${l.data.glooAmount ?? 1}`;
        else if (l.data.kind === 'grenade') sub = `x${l.data.grenadeAmount ?? 1}`;
        else if (l.data.level) sub = `Nv.${l.data.level}`;
        items.push({
          dist: d,
          slot: {
            id: l.data.id,
            kind: l.data.kind,
            weaponId: l.data.weaponId,
            scopeType: l.data.scopeType,
            level: l.data.level,
            label: l.data.label,
            subLabel: sub,
          },
        });
      }
    }

    items.sort((a, b) => a.dist - b.dist);
    return items.slice(0, maxSlots).map((it) => it.slot);
  }

  private findNearbyVending(): VendingMachineProp | null {
    for (let i = 0; i < this.world.vendingMachines.length; i++) {
      const vm = this.world.vendingMachines[i];
      const d = Math.hypot(vm.x - this.pos.x, vm.z - this.pos.z);
      if (d < 3.4 && Math.abs(vm.y - this.pos.y) < 2.6) return vm;
    }
    return null;
  }

  public openNearbyVending(): void {
    if (this.findNearbyVending()) {
      this.onOpenShopRequest?.();
    }
  }

  public buyVendingOffer(offerId: string, reviveAllyId?: string): boolean {
    const state = this.stateMachine.getState();
    if (state !== GameState.PLAYING && state !== GameState.WAITING) return false;
    if (this.isDead) return false;

    if (offerId === 'revive_ally' && reviveAllyId) {
      if (this.ffCoins < 400) return false;
      const ally = this.targetById.get(reviveAllyId);
      if (!ally || !ally.isAlly || (!ally.eliminated && !ally.isDowned && ally.downTimer <= 0)) {
        return false;
      }
      this.ffCoins -= 400;
      ally.eliminated = false;
      ally.isDowned = false;
      ally.downTimer = 0;
      ally.hp = 165;
      ally.bleedHp = 100;
      ally.medkits = 1;
      ally.gloos = 2;
      ally.weaponId = 'm4a1';
      ally.airState = 'parachuting';
      ally.vy = -8;
      if (ally.torsoGroup) {
        ally.torsoGroup.position.set(0, 0.78, 0);
        ally.torsoGroup.rotation.set(0, 0, 0);
      }
      if (ally.headMesh) ally.headMesh.rotation.set(0, 0, 0);
      if (ally.legLPivot) {
        ally.legLPivot.position.set(-0.1, 0.78, 0);
        ally.legLPivot.rotation.set(0, 0, 0);
      }
      if (ally.legRPivot) {
        ally.legRPivot.position.set(0.1, 0.78, 0);
        ally.legRPivot.rotation.set(0, 0, 0);
      }
      if (ally.gunMesh) ally.gunMesh.visible = true;
      ally.group.rotation.x = 0;
      ally.group.position.set(this.pos.x + 2.8, this.pos.y + 18, this.pos.z + 2.8);
      ally.group.visible = true;
      if (ally.parachuteMesh) ally.parachuteMesh.visible = true;
      if (state === GameState.PLAYING) {
        this.aliveCount = Math.min(51, this.aliveCount + 1);
      }
      this.pushKillFeed('LOJINHA', `${ally.nick} REDESDOBRADO`, 'LOJA', false, true);
      soundEngine.playShopBuy();
      return true;
    }

    const offer = VENDING_SHOP_OFFERS.find((o) => o.id === offerId);
    if (!offer || this.ffCoins < offer.cost) return false;
    this.ffCoins -= offer.cost;
    soundEngine.playShopBuy();

    if (offer.id === 'medkit') {
      this.medkitCount += 1;
    } else if (offer.id === 'gloo2') {
      this.glooCount = Math.min(8, this.glooCount + 2);
    } else if (offer.id === 'grenade2') {
      this.grenadeCount = Math.min(6, this.grenadeCount + 2);
    } else if (offer.id === 'ammo60') {
      const w = this.weapons[this.activeSlot] ?? this.weapons[1] ?? this.weapons[2] ?? this.weapons[3];
      if (w) w.reserveAmmo += 60;
    } else if (offer.id === 'vest2') {
      if (this.vestLevel < 2 || this.vestHp < 160) {
        this.vestLevel = 2;
        this.vestMaxHp = 160;
        this.vestHp = 160;
      }
    } else if (offer.id === 'vest3') {
      this.vestLevel = 3;
      this.vestMaxHp = 220;
      this.vestHp = 220;
    } else if (offer.id === 'helmet3') {
      this.helmetLevel = 3;
      this.helmetMaxHp = 180;
      this.helmetHp = 180;
    } else if (offer.id === 'scope4x') {
      const sc = '4x' as const;
      if (!this.ownedScopes.includes(sc)) this.ownedScopes.push(sc);
      const w = this.weapons[this.activeSlot];
      if (w && WEAPONS[w.weaponId].allowsCustomScope) w.scope = sc;
      else this.addScopeToBackpack(sc);
    } else if (offer.weaponId) {
      const wid = offer.weaponId;
      const def = WEAPONS[wid];
      const slot: 1 | 2 = !this.weapons[1] ? 1 : !this.weapons[2] ? 2 : this.activeSlot === 2 ? 2 : 1;
      if (this.weapons[1] && this.weapons[2] && this.weapons[slot]) {
        const oldW = this.weapons[slot]!;
        this.spawnItemInFront({
          kind: 'weapon',
          weaponId: oldW.weaponId,
          label: WEAPONS[oldW.weaponId].name,
        });
      }
      this.weapons[slot] = {
        weaponId: wid,
        ammoInMag: def.magSize,
        reserveAmmo: wid === 'awm' ? 25 : def.magSize * 4,
        scope: wid === 'awm' ? 'sniper' : def.defaultScope,
        attachments: emptyAttachments(),
      };
      this.activeSlot = slot;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.playerRig.setWeapon(wid);
    }
    return true;
  }

  private findNearbyVehicle(): VehicleEntity | null {
    for (let i = 0; i < this.world.vehicles.length; i++) {
      const v = this.world.vehicles[i];
      if (v.destroyed) continue;
      const d = Math.hypot(v.x - this.pos.x, v.z - this.pos.z);
      if (d < 3.8 && Math.abs(v.y - this.pos.y) < 2.8) return v;
    }
    return null;
  }

  public toggleVehicle(): void {
    if (this.activeVehicleId) {
      this.exitVehicle();
      return;
    }
    const v = this.findNearbyVehicle();
    if (v) this.enterVehicle(v);
  }

  private enterVehicle(v: VehicleEntity): void {
    if (v.destroyed || this.isDead) return;
    this.activeVehicleId = v.id;
    v.driverIsPlayer = true;
    this.usingMedkit = false;
    this.isReloading = false;
    this.isAiming = false;
    this.isPlacingGloo = false;
    this.isHoldingGrenade = false;
    this.revivingBotId = null;
    this.stance = 'stand';
    soundEngine.stopRunAudio();
    soundEngine.stopMedkitAudio();
    soundEngine.playVehicleEnter();
  }

  private exitVehicleImmediate(): void {
    if (!this.activeVehicleId) return;
    const v = this.world.vehicles.find((veh) => veh.id === this.activeVehicleId);
    if (v) {
      v.driverIsPlayer = false;
      this.ejectPassengersFromVehicle(v);
    }
    this.activeVehicleId = null;
    this.playerRig.weaponMount.visible = true;
    soundEngine.stopVehicleAudio();
  }

  private exitVehicle(): void {
    if (!this.activeVehicleId) return;
    const v = this.world.vehicles.find((veh) => veh.id === this.activeVehicleId);
    this.activeVehicleId = null;
    this.playerRig.weaponMount.visible = true;
    soundEngine.stopVehicleAudio();
    soundEngine.playVehicleEnter();

    if (v) {
      v.driverIsPlayer = false;
      const sideX = Math.cos(v.yaw);
      const sideZ = -Math.sin(v.yaw);
      this.pos.x = THREE.MathUtils.clamp(v.x - sideX * 2.1, -508, 508);
      this.pos.z = THREE.MathUtils.clamp(v.z + sideZ * 2.1, -508, 508);
      this.pos.y = Math.max(-0.2, this.resolveFloorHeight(this.pos.x, this.pos.z, v.y + 1.5));
      this.vel.set(0, 0, 0);
      this.ejectPassengersFromVehicle(v);
    }
  }

  private ejectPassengersFromVehicle(v: VehicleEntity): void {
    for (let i = 0; i < v.passengerIds.length; i++) {
      const bot = this.targetById.get(v.passengerIds[i]);
      if (!bot) continue;
      const sideSign = i % 2 === 0 ? 1 : -1;
      const px = THREE.MathUtils.clamp(v.x + Math.cos(v.yaw) * 2.3 * sideSign, -495, 495);
      const pz = THREE.MathUtils.clamp(v.z - Math.sin(v.yaw) * 2.3 * sideSign, -495, 495);
      bot.group.position.set(px, Math.max(0.5, this.world.groundHeightAt(px, pz)), pz);
      bot.group.visible = !bot.eliminated;
    }
    v.passengerIds = [];
  }

  private damageVehicle(v: VehicleEntity, dmg: number): void {
    if (v.destroyed) return;
    v.hp = Math.max(0, v.hp - dmg);
    if (v.hp <= 0) {
      v.destroyed = true;
      v.speed = 0;
      v.chassisGroup.visible = false;
      v.burnedGroup.visible = true;
      v.smokeMeshes.forEach((sm) => {
        sm.visible = false;
      });
      if (this.activeVehicleId === v.id) {
        this.exitVehicle();
      } else {
        v.driverIsPlayer = false;
        this.ejectPassengersFromVehicle(v);
      }
      _v1.set(v.x, v.y + 0.9, v.z);
      this.explodeAt(_v1, 8.5, 130, 'EXPLOSÃO');
    }
  }

  private updateVehicles(dt: number): void {
    for (let i = 0; i < this.world.vehicles.length; i++) {
      const v = this.world.vehicles[i];
      if (!v.destroyed && v.hp < v.maxHp * 0.38) {
        for (let s = 0; s < v.smokeMeshes.length; s++) {
          const sm = v.smokeMeshes[s];
          sm.visible = true;
          const phase = (this.elapsed * 2.6 + s * 0.35 + i * 0.2) % 1;
          sm.position.y = 1.25 + phase * 1.45;
          sm.scale.setScalar(0.65 + phase * 0.85);
        }
      }
      if (!v.driverIsPlayer && Math.abs(v.speed) > 0.08 && !v.destroyed) {
        v.speed = THREE.MathUtils.damp(v.speed, 0, 2.2, dt);
        v.x = THREE.MathUtils.clamp(v.x + Math.sin(v.yaw) * v.speed * dt, -502, 502);
        v.z = THREE.MathUtils.clamp(v.z + Math.cos(v.yaw) * v.speed * dt, -502, 502);
        v.y = Math.max(0.2, this.world.groundHeightAt(v.x, v.z));
        v.group.position.set(v.x, v.y, v.z);
        v.collider.cx = v.x;
        v.collider.cz = v.z;
        v.collider.minY = v.y;
        v.collider.maxY = v.y + 2.05;
        const wheelSpin = (v.speed * dt) / (v.kind === 'sport' ? 0.36 : 0.42);
        v.wheelFL.rotation.x += wheelSpin;
        v.wheelFR.rotation.x += wheelSpin;
        v.wheelRL.rotation.x += wheelSpin;
        v.wheelRR.rotation.x += wheelSpin;
      }
    }
  }

  private updateDrivingPlayer(dt: number): void {
    const v = this.world.vehicles.find((veh) => veh.id === this.activeVehicleId);
    if (!v || v.destroyed) {
      this.exitVehicle();
      return;
    }

    this.input.sample();
    const edges = this.input.consumeLookAndEdges();
    if (edges.backpack) this.onBackpackRequest?.();
    if (edges.interact) {
      this.exitVehicle();
      return;
    }

    // Orbit camera around vehicle
    const sens = 0.0028 * this.settings.sensitivity;
    const invert = this.settings.invertY ? -1 : 1;
    this.yaw -= edges.dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - edges.dy * sens * invert, -0.85, 0.45);

    const isSports = v.kind === 'sport';
    const maxFwd = isSports ? 31 : 24;
    const maxRev = -10.5;
    const accelRate = isSports ? 23 : 17.5;
    const throttle = this.input.moveZ;
    const steer = this.input.moveX;

    if (throttle > 0.05) {
      v.speed = Math.min(maxFwd, v.speed + throttle * accelRate * dt);
    } else if (throttle < -0.05) {
      const decel = v.speed > 0.5 ? accelRate * 1.9 : accelRate * 0.9;
      v.speed = Math.max(maxRev, v.speed + throttle * decel * dt);
    } else {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 1.85, dt);
    }

    const speedRatio = Math.min(1, Math.abs(v.speed) / 7.0);
    if (Math.abs(steer) > 0.04 && speedRatio > 0.03) {
      const dirSign = v.speed >= -0.4 ? 1 : -1;
      const steerRate = isSports ? 2.15 : 1.75;
      v.yaw += -steer * dirSign * steerRate * speedRatio * dt;
    }

    v.x = THREE.MathUtils.clamp(v.x + Math.sin(v.yaw) * v.speed * dt, -504, 504);
    v.z = THREE.MathUtils.clamp(v.z + Math.cos(v.yaw) * v.speed * dt, -504, 504);
    const groundY = this.world.groundHeightAt(v.x, v.z);
    if (groundY < 0.35) {
      v.speed *= -0.4;
      v.x = THREE.MathUtils.clamp(v.x - Math.sin(v.yaw) * 0.9, -504, 504);
      v.z = THREE.MathUtils.clamp(v.z - Math.cos(v.yaw) * 0.9, -504, 504);
    }
    v.y = Math.max(0.25, this.world.groundHeightAt(v.x, v.z));

    // World building/prop collision bounce
    const cols = this.world.colliders;
    const vehR = 1.45;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c.tag === `vehicle-${v.id}` || c.tag === 'house-window-sill') continue;
      if (v.y + 1.8 < c.minY || v.y + 0.3 > c.maxY) continue;
      const dx = v.x - c.cx;
      const dz = v.z - c.cz;
      const maxE = c.halfW + c.halfD + vehR;
      if (Math.abs(dx) > maxE || Math.abs(dz) > maxE) continue;
      const cos = Math.cos(c.rotY);
      const sin = Math.sin(c.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const clX = Math.max(-c.halfW, Math.min(c.halfW, lx));
      const clZ = Math.max(-c.halfD, Math.min(c.halfD, lz));
      const dX = lx - clX;
      const dZ = lz - clZ;
      const dSq = dX * dX + dZ * dZ;
      if (dSq < vehR * vehR) {
        if (Math.abs(v.speed) > 9.5) {
          soundEngine.playVehicleCrash(Math.min(1, Math.abs(v.speed) / 24));
          this.camShake = Math.max(this.camShake, 0.2);
        }
        const dist = Math.sqrt(dSq) || 0.01;
        const push = vehR - dist;
        const pLx = (dX / dist) * push;
        const pLz = (dZ / dist) * push;
        v.x += pLx * cos + pLz * sin;
        v.z += -pLx * sin + pLz * cos;
        v.speed *= -0.35;
      }
    }

    // Run-over ("Atropelamento") damage to enemy bots
    if (Math.abs(v.speed) >= 5.5) {
      const bots = this.world.targets;
      for (let i = 0; i < bots.length; i++) {
        const bot = bots[i];
        if (bot.isAlly || bot.eliminated || bot.airState !== 'ground') continue;
        if (bot.downTimer > 0 && !bot.isDowned) continue;
        const bdx = bot.group.position.x - v.x;
        const bdz = bot.group.position.z - v.z;
        const distSq = bdx * bdx + bdz * bdz;
        if (distSq < 2.25 * 2.25) {
          const dmg = Math.round(Math.abs(v.speed) * 7.8);
          const bDist = Math.sqrt(distSq) || 0.1;
          const pushX = (bdx / bDist) * 2.65;
          const pushZ = (bdz / bDist) * 2.65;
          bot.group.position.x = THREE.MathUtils.clamp(v.x + pushX, -490, 490);
          bot.group.position.z = THREE.MathUtils.clamp(v.z + pushZ, -490, 490);
          this.applyBotHitDamage(bot, dmg, true, this.playerNick, 'CARRO', false, v.x, v.z);
          this.damageDealt += dmg;
          this.hitmarkerTimer = 0.22;
          _v1.set(bot.group.position.x, bot.group.position.y + 1.4, bot.group.position.z);
          this.pushDamagePopup(_v1, dmg, false, 0);
          soundEngine.playRunOver();
          this.camShake = Math.max(this.camShake, 0.24);
        }
      }
    }

    // Update vehicle visual orientation & wheel animation + terrain slope tilt
    const fH = this.world.groundHeightAt(v.x + Math.sin(v.yaw) * 1.4, v.z + Math.cos(v.yaw) * 1.4);
    const bH = this.world.groundHeightAt(v.x - Math.sin(v.yaw) * 1.4, v.z - Math.cos(v.yaw) * 1.4);
    const rH = this.world.groundHeightAt(v.x + Math.cos(v.yaw) * 0.9, v.z - Math.sin(v.yaw) * 0.9);
    const lH = this.world.groundHeightAt(v.x - Math.cos(v.yaw) * 0.9, v.z + Math.sin(v.yaw) * 0.9);
    const targetPitchTilt = Math.atan2(bH - fH, 2.8);
    const targetRollTilt = Math.atan2(lH - rH, 1.8) + steer * speedRatio * 0.05;

    v.group.position.set(v.x, v.y, v.z);
    v.group.rotation.y = v.yaw;
    v.chassisGroup.rotation.x = THREE.MathUtils.damp(v.chassisGroup.rotation.x, targetPitchTilt, 10, dt);
    v.chassisGroup.rotation.z = THREE.MathUtils.damp(v.chassisGroup.rotation.z, targetRollTilt, 10, dt);

    const steerTarget = -steer * 0.44;
    v.steerFL.rotation.y = THREE.MathUtils.damp(v.steerFL.rotation.y, steerTarget, 14, dt);
    v.steerFR.rotation.y = THREE.MathUtils.damp(v.steerFR.rotation.y, steerTarget, 14, dt);
    const wheelSpin = (v.speed * dt) / (isSports ? 0.36 : 0.42);
    v.wheelFL.rotation.x += wheelSpin;
    v.wheelFR.rotation.x += wheelSpin;
    v.wheelRL.rotation.x += wheelSpin;
    v.wheelRR.rotation.x += wheelSpin;

    v.collider.cx = v.x;
    v.collider.cz = v.z;
    v.collider.rotY = v.yaw;
    v.collider.minY = v.y;
    v.collider.maxY = v.y + 2.05;

    // Update engine audio
    soundEngine.updateVehicleEngineAudio(true, Math.abs(v.speed) / maxFwd);

    // Sync player rig inside vehicle cabin
    this.pos.set(v.x, v.y + 0.3, v.z);
    this.characterYaw = v.yaw + Math.PI;
    this.playerRig.root.visible = true;
    this.playerRig.weaponMount.visible = false;
    this.playerRig.root.position.set(v.x, v.y + 0.32, v.z);
    this.playerRig.root.rotation.y = v.yaw;
    this.animator.update(this.playerRig, {
      dt,
      speed: Math.abs(v.speed),
      stance: 'stand',
      isGrounded: true,
      isSprinting: false,
      isAiming: false,
      isFiring: false,
      isDriving: true,
      isLobby: false,
      isSkydiving: false,
      isParachuting: false,
      isDead: false,
      pitchRad: 0,
    });

    this.updateThirdPersonCamera(dt, 6.4, 1.55, 'none', false, false);
  }

  private findNearbyLaunchPad() {
    for (let i = 0; i < this.world.launchPads.length; i++) {
      const pad = this.world.launchPads[i];
      const d = Math.hypot(pad.x - this.pos.x, pad.z - this.pos.z);
      if (d < 2.35 && Math.abs(pad.y - this.pos.y) < 2.2) return pad;
    }
    return null;
  }

  private triggerLaunchPad(pad: { dirX: number; dirZ: number }): void {
    this.usingMedkit = false;
    this.healRingMesh.visible = false;
    soundEngine.stopMedkitAudio();
    this.isReloading = false;
    this.isPlacingGloo = false;
    this.isHoldingGrenade = false;
    this.stance = 'stand';
    this.isGrounded = false;
    this.yaw = Math.atan2(-pad.dirX, -pad.dirZ);
    this.pos.y += 1.4;
    this.vel.set(pad.dirX * 36, 26, pad.dirZ * 36);
    this.launchPadFlightTimer = 1.6;
    soundEngine.playParachuteOpen();
    this.stateMachine.forceState(GameState.DROPPING);
  }

  private updateThirdPersonCamera(
    dt: number,
    distance: number,
    targetHeight: number,
    activeScope: ScopeType = 'none',
    isOpticalLens = false,
    snapInstant = false,
  ): void {
    const rightShoulderOffset = isOpticalLens ? 0 : 0.42;

    if (snapInstant) {
      this.camShoulderCurrent = rightShoulderOffset;
      this.camDistCurrent = distance;
    } else {
      this.camShoulderCurrent = THREE.MathUtils.damp(
        this.camShoulderCurrent,
        rightShoulderOffset,
        22,
        dt,
      );
      this.camDistCurrent = THREE.MathUtils.damp(this.camDistCurrent, distance, 20, dt);
    }

    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    _camTarget.set(
      this.pos.x + rightX * this.camShoulderCurrent,
      this.pos.y + targetHeight,
      this.pos.z + rightZ * this.camShoulderCurrent,
    );

    if (snapInstant) {
      this.camLookCurrent.copy(_camTarget);
    } else {
      const xzAlpha = 1 - Math.exp(-28 * dt);
      const yAlpha = 1 - Math.exp(-20 * dt);
      this.camLookCurrent.x = THREE.MathUtils.lerp(this.camLookCurrent.x, _camTarget.x, xzAlpha);
      this.camLookCurrent.z = THREE.MathUtils.lerp(this.camLookCurrent.z, _camTarget.z, xzAlpha);
      this.camLookCurrent.y = THREE.MathUtils.lerp(this.camLookCurrent.y, _camTarget.y, yAlpha);
    }

    // Rigidly place camera along (-forward(yaw, pitch)) from camLookCurrent so rotation & crosshair
    // NEVER lag or skew laterally when opening scope or snapping aim!
    const cp = Math.cos(this.pitch);
    const fwdX = -Math.sin(this.yaw) * cp;
    const fwdY = Math.sin(this.pitch);
    const fwdZ = -Math.cos(this.yaw) * cp;

    let effectiveDist = this.camDistCurrent;
    const desiredY = this.camLookCurrent.y - fwdY * effectiveDist;
    const desiredX = this.camLookCurrent.x - fwdX * effectiveDist;
    const desiredZ = this.camLookCurrent.z - fwdZ * effectiveDist;
    const camGround = this.world.groundHeightAt(desiredX, desiredZ) + 0.42;
    if (desiredY < camGround && fwdY > 0.05) {
      effectiveDist = Math.max(
        0.2,
        (this.camLookCurrent.y - camGround) / Math.max(0.05, fwdY),
      );
    }

    this.camPosCurrent.set(
      this.camLookCurrent.x - fwdX * effectiveDist,
      Math.max(camGround, this.camLookCurrent.y - fwdY * effectiveDist),
      this.camLookCurrent.z - fwdZ * effectiveDist,
    );

    // Apply subtle shake
    if (this.camShake > 0.001) {
      this.camPosCurrent.x += (Math.random() - 0.5) * this.camShake;
      this.camPosCurrent.y += (Math.random() - 0.5) * this.camShake;
    }

    const targetFov = this.activeVehicleId
      ? 70
      : this.isAiming
        ? SCOPE_META[activeScope].fov
        : this.isSprinting
          ? 68
          : 62;
    if (Math.abs(this.world.camera.fov - targetFov) > 0.1) {
      this.world.camera.fov = THREE.MathUtils.damp(this.world.camera.fov, targetFov, 15, dt);
      this.world.camera.updateProjectionMatrix();
    }

    this.world.camera.position.copy(this.camPosCurrent);
    _v1.set(
      this.camPosCurrent.x + fwdX * 20,
      this.camPosCurrent.y + fwdY * 20,
      this.camPosCurrent.z + fwdZ * 20,
    );
    this.world.camera.lookAt(_v1);
    this.world.camera.updateMatrixWorld();
  }

  private renderActiveScene(): void {
    const state = this.stateMachine.getState();
    const isLobbyScene =
      state === GameState.BOOT ||
      state === GameState.LOADING ||
      state === GameState.MENU ||
      state === GameState.LOBBY ||
      state === GameState.MATCHMAKING;

    if (isLobbyScene) {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.render(this.lobbyScene.scene, this.lobbyScene.camera);
    } else {
      this.renderer.setClearColor(0x0e1217, 1);
      this.renderer.render(this.world.scene, this.world.camera);
    }
  }

  private buildHudSnapshot(): HudSnapshot {
    const state = this.stateMachine.getState();
    const groundY = Math.max(0, this.world.groundHeightAt(this.pos.x, this.pos.z));
    const altitude = Math.max(0, this.pos.y - groundY);
    const activeW = this.weapons[this.activeSlot];
    const reloadTotal = activeW ? this.getEffectiveReloadSec(activeW) : 1;
    const nearbyLaunchPad = this.findNearbyLaunchPad();
    const nearbyAirDrop = nearbyLaunchPad ? null : this.findNearbyAirDrop();
    const nearby = nearbyLaunchPad || nearbyAirDrop ? null : this.findNearbyLoot();
    const nearbyLoots = this.activeVehicleId ? [] : this.findNearbyLoots();
    const nearbyVending = this.activeVehicleId ? null : this.findNearbyVending();
    const nearbyVeh = this.activeVehicleId ? null : this.findNearbyVehicle();
    const activeVeh = this.activeVehicleId
      ? this.world.vehicles.find((v) => v.id === this.activeVehicleId) ?? null
      : null;
    const inVehicle: VehicleHudState | null = activeVeh
      ? {
          id: activeVeh.id,
          kind: activeVeh.kind,
          name: activeVeh.name,
          hp: Math.round(activeVeh.hp),
          maxHp: activeVeh.maxHp,
          speedKmh: Math.round(Math.abs(activeVeh.speed) * 3.6),
          passengerCount: 1 + activeVeh.passengerIds.length,
          isBurning: !activeVeh.destroyed && activeVeh.hp < activeVeh.maxHp * 0.38,
        }
      : null;

    let deg = ((-this.yaw * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;

    let currentPoi: string | null = null;
    for (let i = 0; i < this.world.pois.length; i++) {
      const poi = this.world.pois[i];
      if (Math.hypot(this.pos.x - poi.x, this.pos.z - poi.z) <= poi.radius) {
        currentPoi = poi.name;
        break;
      }
    }

    const totalPlayers = 1 + this.world.targets.length;
    const playerDistZone = Math.hypot(
      this.pos.x - this.zoneCurrentX,
      this.pos.z - this.zoneCurrentZ,
    );
    const activePhaseDef =
      SAFE_ZONE_PHASES[Math.min(SAFE_ZONE_PHASES.length - 1, this.zonePhase - 1)];

    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    return {
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      vestLevel: this.vestLevel,
      vestHp: this.vestHp,
      vestMaxHp: this.vestMaxHp,
      helmetLevel: this.helmetLevel,
      helmetHp: this.helmetHp,
      helmetMaxHp: this.helmetMaxHp,
      backpackLevel: this.backpackLevel,
      backpackUsed: this.getBackpackUsedWeight(),
      backpackCapacity: this.getBackpackCapacity(),
      medkitCount: this.medkitCount,
      glooCount: this.glooCount,
      grenadeCount: this.grenadeCount,
      ffCoins: this.ffCoins,
      isRanked: this.isRanked,
      isPlacingGloo: this.isPlacingGloo,
      isHoldingGrenade: this.isHoldingGrenade,
      usingMedkit: this.usingMedkit,
      medkitProgress: this.usingMedkit
        ? Math.max(0, Math.min(1, 1 - this.medkitTimer / this.medkitDuration))
        : 0,
      stance: this.stance,
      isSprinting: this.isSprinting,
      isAiming: this.isAiming,
      isGrounded: this.isGrounded,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? 1 - this.reloadTimer / reloadTotal : 0,
      isDead: this.isDead,
      activeSlot: this.activeSlot,
      activeScope: activeW ? activeW.scope : 'none',
      ownedScopes: [...this.ownedScopes],
      weapons: {
        1: this.weapons[1]
          ? { ...this.weapons[1]!, attachments: { ...this.weapons[1]!.attachments } }
          : null,
        2: this.weapons[2]
          ? { ...this.weapons[2]!, attachments: { ...this.weapons[2]!.attachments } }
          : null,
        3: this.weapons[3]
          ? { ...this.weapons[3]!, attachments: { ...this.weapons[3]!.attachments } }
          : null,
      },
      backpackItems: this.backpackItems.map((it) => ({ ...it })),
      yawDeg: deg,
      playerX: this.pos.x,
      playerZ: this.pos.z,
      playerY: this.pos.y,
      altitude,
      aliveCount: this.aliveCount,
      kills: this.kills,
      damageDealt: this.damageDealt,
      zoneTimerSec: Math.ceil(this.zoneTimer),
      safeZone: {
        phase: this.zonePhase,
        totalPhases: SAFE_ZONE_PHASES.length,
        isShrinking: this.zoneIsShrinking,
        timerSec: Math.ceil(this.zoneTimer),
        currentX: this.zoneCurrentX,
        currentZ: this.zoneCurrentZ,
        currentRadius: this.zoneCurrentRadius,
        nextX: this.zoneNextX,
        nextZ: this.zoneNextZ,
        nextRadius: this.zoneNextRadius,
        damagePerSec: activePhaseDef.damagePerSec,
        playerOutside: state === GameState.PLAYING && playerDistZone > this.zoneCurrentRadius,
      },
      waitingTimerSec: Math.ceil(this.waitingTimer),
      matchmakingCount: Math.min(
        totalPlayers,
        Math.max(1, Math.round((this.matchmakingTimer / 2.5) * totalPlayers)),
      ),
      canJumpFromPlane: state === GameState.AIRPLANE && this.airplaneProgress >= 0.08,
      canOpenParachute: state === GameState.DROPPING,
      canVaultWindow:
        (state === GameState.PLAYING || state === GameState.WAITING) &&
        this.canVaultWindow &&
        this.isGrounded,
      nearbyLootLabel: nearbyLaunchPad
        ? nearbyLaunchPad.label
        : nearbyAirDrop
          ? 'ABRIR AIRDROP (AWM / NÍVEL 3)'
          : nearby
            ? nearby.data.label
            : null,
      nearbyLoots,
      nearbyVending: nearbyVending
        ? { id: nearbyVending.id, label: nearbyVending.label }
        : null,
      nearbyVehicle: nearbyVeh
        ? {
            id: nearbyVeh.id,
            kind: nearbyVeh.kind,
            name: nearbyVeh.name,
            hp: Math.round(nearbyVeh.hp),
            maxHp: nearbyVeh.maxHp,
          }
        : null,
      inVehicle,
      vendingLocations: this.world.vendingMachines.map((vm) => ({ x: vm.x, z: vm.z })),
      vehicleLocations: this.world.vehicles.map((v) => ({
        x: v.x,
        z: v.z,
        kind: v.kind,
        destroyed: v.destroyed,
      })),
      hitmarkerActive: this.hitmarkerTimer > 0,
      headshotFlashActive: this.headshotFlashTimer > 0,
      aimLockedTarget: this.aimLockedTarget,
      aimAssistActive: this.aimAssistActive,
      damageFlashActive: this.damageFlashTimer > 0,
      damagePopups: this.damagePopups.map((d) => ({ ...d })),
      damageIndicators: this.damageIndicators.map((di) => {
        const dx = di.worldX - this.pos.x;
        const dz = di.worldZ - this.pos.z;
        const fwdDot = dx * fwdX + dz * fwdZ;
        const rightDot = dx * rightX + dz * rightZ;
        return {
          id: di.id,
          angleRad: Math.atan2(rightDot, fwdDot),
          age: di.age,
        };
      }),
      killFeed: this.killFeed.map((k) => ({ ...k })),
      fps: this.currentFps,
      pointerLocked: this.input.pointerLocked,
      currentPoi,
      matchMode: this.matchMode,
      reviveTarget: (() => {
        if (this.revivingBotId) {
          const revB = this.targetById.get(this.revivingBotId);
          if (revB && revB.isDowned && !revB.eliminated) {
            const allyIdx = this.world.targets.filter((t) => t.isAlly).indexOf(revB);
            return {
              id: revB.id,
              slotNumber: (allyIdx >= 0 ? allyIdx : 0) + 2,
              nick: revB.nick,
              bleedHp: Math.round(revB.bleedHp),
            };
          }
        }
        const nearDown = this.findNearestDownedAlly();
        if (!nearDown) return null;
        return {
          id: nearDown.bot.id,
          slotNumber: nearDown.slotNumber,
          nick: nearDown.bot.nick,
          bleedHp: Math.round(nearDown.bot.bleedHp),
        };
      })(),
      reviveProgress: this.revivingBotId
        ? Math.max(0, Math.min(1, 1 - this.reviveTimer / this.reviveDuration))
        : 0,
      teamMembers:
        this.matchMode === 'solo'
          ? []
          : [
              {
                id: 'player',
                slotNumber: 1,
                nick: this.playerNick,
                hp: Math.round(this.hp),
                maxHp: this.maxHp,
                isDowned: false,
                eliminated: this.isDead,
              },
              ...this.world.targets
                .filter((b) => b.isAlly)
                .map((b, idx) => {
                  const elim = b.eliminated || b.downTimer > 0;
                  let distance: number | undefined;
                  let onScreen = false;
                  let screenXPct: number | undefined;
                  let screenYPct: number | undefined;
                  let offscreenAngleRad: number | undefined;
                  const bx = b.group.position.x;
                  const by = b.group.position.y;
                  const bz = b.group.position.z;

                  if (!elim && b.airState !== 'inPlane') {
                    const dx = bx - this.pos.x;
                    const dz = bz - this.pos.z;
                    distance = Math.round(Math.hypot(dx, dz));
                    const fwdDot = dx * fwdX + dz * fwdZ;
                    const rightDot = dx * rightX + dz * rightZ;
                    offscreenAngleRad = Math.atan2(rightDot, fwdDot);

                    _v1.set(bx, by + (b.isDowned ? 1.05 : 2.15), bz).project(this.world.camera);
                    const inFront = _v1.z >= -1 && _v1.z <= 1;
                    const sx = (_v1.x * 0.5 + 0.5) * 100;
                    const sy = (-_v1.y * 0.5 + 0.5) * 100;
                    if (inFront && sx >= 4 && sx <= 96 && sy >= 6 && sy <= 92) {
                      onScreen = true;
                      screenXPct = sx;
                      screenYPct = sy;
                    }
                  }

                  return {
                    id: b.id,
                    slotNumber: idx + 2,
                    nick: b.nick,
                    hp: b.isDowned ? Math.round(b.bleedHp) : Math.round(b.hp),
                    maxHp: b.isDowned ? 100 : b.maxHp,
                    isDowned: b.isDowned,
                    eliminated: elim,
                    distance,
                    onScreen,
                    screenXPct,
                    screenYPct,
                    offscreenAngleRad,
                    worldX: bx,
                    worldZ: bz,
                  };
                }),
            ],
      airDrops: this.airDrops.map((ad) => ({
        id: ad.id,
        x: ad.x,
        y: ad.y,
        z: ad.z,
        state: ad.state,
        distance: Math.round(Math.hypot(ad.x - this.pos.x, ad.z - this.pos.z)),
      })),
      airDropNotice: this.airDropNotice,
    };
  }

  private onCanvasPointerDown = (e: PointerEvent): void => {
    soundEngine.unlock();
    const state = this.stateMachine.getState();
    if (state === GameState.LOBBY || state === GameState.MENU) {
      this.lobbyDragging = true;
      this.lobbyLastX = e.clientX;
    }
  };

  private onWindowPointerMove = (e: PointerEvent): void => {
    if (!this.lobbyDragging) return;
    const dx = e.clientX - this.lobbyLastX;
    this.lobbyLastX = e.clientX;
    this.lobbyOrbitYaw += dx * 0.012;
  };

  private onWindowPointerUp = (): void => {
    this.lobbyDragging = false;
  };

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;

    this.lobbyScene.camera.aspect = w / h;
    this.lobbyScene.camera.updateProjectionMatrix();
    this.world.camera.aspect = w / h;
    this.world.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public dispose(): void {
    this.disposed = true;
    this.clearLoadTimers();
    soundEngine.setFlightAudioMode('none');
    soundEngine.setLobbyMusicMode('off');
    soundEngine.stopRunAudio();
    soundEngine.stopMedkitAudio();
    soundEngine.stopVehicleAudio();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    this.renderer.domElement.removeEventListener('pointerdown', this.onCanvasPointerDown);
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    window.removeEventListener('pointerup', this.onWindowPointerUp);
    window.removeEventListener('resize', this.handleResize);

    this.input.dispose();
    this.lobbyRig.dispose();
    this.playerRig.dispose();
    this.lobbyScene.dispose();
    this.world.dispose();
    this.textures.dispose();
    this.envMap.dispose();
    this.tracerGeo.dispose();
    this.tracerMat.dispose();
    this.glooWallGeo.dispose();
    this.glooPreviewMat.dispose();
    this.glooWallMat.dispose();
    this.grenadeLineGeo.dispose();
    this.grenadeLineMat.dispose();
    this.grenadeTargetGeo.dispose();
    this.grenadeTargetMat.dispose();
    this.grenadeProjGeo.dispose();
    this.grenadeProjMat.dispose();
    this.clearAirDrops();
    this.airDropCrateGeo.dispose();
    this.airDropStripeGeo.dispose();
    this.airDropChuteGeo.dispose();
    this.airDropCordGeo.dispose();
    this.airDropBeamGeo.dispose();
    this.airDropRingGeo.dispose();
    this.airDropCrateMat.dispose();
    this.airDropStripeMat.dispose();
    this.airDropChuteMat.dispose();
    this.airDropCordMat.dispose();
    this.healRingGeo.dispose();
    this.healRingMat.dispose();
    this.explosionGeo.dispose();
    for (let i = 0; i < this.explosionVfx.length; i++) {
      this.explosionVfx[i].mat.dispose();
    }
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
