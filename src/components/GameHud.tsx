import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  HeartPulse,
  LogOut,
  MousePointerClick,
  Move,
  Play,
  Settings,
  ThumbsUp,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react';
import { getCharacterAvatar } from '../game/avatars';
import { InputManager } from '../game/inputManager';
import {
  ATTACHMENT_LABELS,
  BrMapId,
  ControlMode,
  DEFAULT_GG_MOUSE_PRO,
  DEFAULT_KEY_BINDINGS,
  formatKeyCodeLabel,
  GameState,
  GG_PIN_META,
  GgKeyPinId,
  GgMouseProConfig,
  GlooSkinId,
  HudElementLayout,
  HudLayoutConfig,
  HudSnapshot,
  KeyBindingsConfig,
  MacroConfig,
  MinimapBuilding,
  MinimapRoad,
  PoiMarker,
  SCOPE_META,
  ScopeType,
  WEAPONS,
  WeaponId,
  WeaponSlotId,
  getRankInfo,
} from '../game/types';
import {
  BERMUDA_MAP_RANGE,
  GLADIADORES_BOUNDS,
  GLADIADORES_ORIGIN,
  WAIT_LOBBY_ORIGIN,
} from '../game/worldBuilder';
import {
  IconAmmoSvg,
  IconBackpackSvg,
  IconCoinSvg,
  IconCrouchSvg,
  IconFireBurstSvg,
  IconFistSvg,
  IconGlooSvg,
  IconGrenadeSvg,
  IconHelmetSvg,
  IconJumpSvg,
  IconProneSvg,
  IconReloadSvg,
  IconScopeSvg,
  IconSprintSvg,
  IconSurfboardSvg,
  IconVaultSvg,
  IconVehicleSvg,
  IconVendingSvg,
  IconVestSvg,
  RankEmblemSvg,
} from './HudIcons';
import { NetworkPingBadge } from './NetworkPingBadge';
import { ScopeOverlay } from './ScopeOverlay';
import { VoiceChatHudWidget } from './VoiceChatHudWidget';
import { WeaponIcon } from './WeaponIcon';

interface GameHudProps {
  gameState: GameState;
  hud: HudSnapshot;
  buildings: MinimapBuilding[];
  roads: MinimapRoad[];
  pois: PoiMarker[];
  mapId?: BrMapId;
  mapRange?: number;
  bermudaMinimapCanvas?: HTMLCanvasElement | null;
  input: InputManager;
  controlMode: ControlMode;
  keyBindings?: KeyBindingsConfig;
  emulatorMode?: boolean;
  macros?: MacroConfig[];
  ggMousePro?: GgMouseProConfig;
  hudLayout: HudLayoutConfig;
  showFps: boolean;
  isPaused: boolean;
  isBackpackOpen: boolean;
  onTogglePause: () => void;
  onToggleBackpack: () => void;
  onUseMedkit: () => void;
  onUseSmallKit?: () => void;
  onCycleSpectate?: (dir: -1 | 1) => void;
  onSendSpectateLike?: () => void;
  onExitSpectate?: () => void;
  onInspectSpectatedPlayer?: (accountId: number) => void;
  onToggleFollowLeader?: () => void;
  onCollectLoot: (id: string) => void;
  onOpenVending: () => void;
  onToggleVehicle: () => void;
  onOpenSettings: () => void;
  onOpenHudEditor: () => void;
  onOpenGgMacroModal?: () => void;
  onSelectScope: (scope: ScopeType) => void;
  onSelectGlooSkin?: (skin: GlooSkinId) => void;
  onSelectGladiadoresWeapon?: (weaponId: WeaponId, slot?: 1 | 2) => void;
  onReadyGladiadoresRound?: () => void;
  onSkipWaiting: () => void;
  onJumpFromPlane: () => void;
  onOpenParachute: () => void;
  onReturnLobby: () => void;
  onSendFriendRequest?: (publicId: string) => void;
  onTestDamage: () => void;
  onTestVictory: () => void;
}

const COMPASS_LABELS = [
  { deg: 0, label: 'N' },
  { deg: 45, label: 'NE' },
  { deg: 90, label: 'L' },
  { deg: 135, label: 'SE' },
  { deg: 180, label: 'S' },
  { deg: 225, label: 'SO' },
  { deg: 270, label: 'O' },
  { deg: 315, label: 'NO' },
];

function layoutStyle(cfg: HudElementLayout): React.CSSProperties {
  return {
    left: `${cfg.xPct}%`,
    top: `${cfg.yPct}%`,
    opacity: cfg.opacity,
    transform: `translate(-50%, -50%) scale(${cfg.scale})`,
  };
}

function getSlotColor(slotNumber: number, isDowned = false): string {
  if (isDowned) return '#ef4444';
  if (slotNumber === 2) return '#34d399'; // Verde Esmeralda
  if (slotNumber === 3) return '#38bdf8'; // Azul Ciano
  if (slotNumber === 4) return '#fbbf24'; // Amarelo Ouro
  return '#f59e0b';
}

export const GameHud: React.FC<GameHudProps> = ({
  gameState,
  hud,
  buildings,
  roads,
  pois,
  mapId,
  mapRange,
  bermudaMinimapCanvas = null,
  input,
  controlMode,
  keyBindings,
  emulatorMode = false,
  macros = [],
  ggMousePro,
  hudLayout,
  showFps,
  isPaused,
  isBackpackOpen,
  onTogglePause,
  onToggleBackpack,
  onUseMedkit,
  onUseSmallKit,
  onCycleSpectate,
  onSendSpectateLike,
  onExitSpectate,
  onInspectSpectatedPlayer,
  onToggleFollowLeader,
  onCollectLoot,
  onOpenVending,
  onToggleVehicle,
  onOpenSettings,
  onOpenHudEditor,
  onOpenGgMacroModal,
  onSelectScope,
  onSelectGlooSkin,
  onSelectGladiadoresWeapon,
  onReadyGladiadoresRound,
  onSkipWaiting,
  onJumpFromPlane,
  onOpenParachute,
  onReturnLobby,
  onSendFriendRequest,
  onTestDamage,
  onTestVictory,
}) => {
  const kb = keyBindings ?? DEFAULT_KEY_BINDINGS;
  const kJump = formatKeyCodeLabel(kb.jump);
  const kCrouch = formatKeyCodeLabel(kb.crouch);
  const kProne = formatKeyCodeLabel(kb.prone);
  const kReload = formatKeyCodeLabel(kb.reload);
  const kQuickSwap = formatKeyCodeLabel(kb.quickSwap);
  const kInteract = formatKeyCodeLabel(kb.interact);
  const kGloo = formatKeyCodeLabel(kb.gloo);
  const kGrenade = formatKeyCodeLabel(kb.grenade);
  const kMedkit = formatKeyCodeLabel(kb.medkit);
  const kSmallMedkit = formatKeyCodeLabel(kb.smallMedkit);
  const kRevive = formatKeyCodeLabel(kb.revive);
  const kBackpack = formatKeyCodeLabel(kb.backpack);
  const kSurfboard = formatKeyCodeLabel(kb.surfboard);
  const kToggleMouse = formatKeyCodeLabel(kb.toggleMouse);
  const kResetMouse = formatKeyCodeLabel(kb.resetMouse);
  const kSlot1 = formatKeyCodeLabel(kb.slot1);
  const kSlot2 = formatKeyCodeLabel(kb.slot2);
  const kSlot3 = formatKeyCodeLabel(kb.slot3);
  const kSlot4 = formatKeyCodeLabel(kb.slot4);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullMapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapBgRef = useRef<HTMLCanvasElement | null>(null);
  const [minimapZoomed, setMinimapZoomed] = useState(true);
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const [fireKnob, setFireKnob] = useState({ x: 0, y: 0 });
  const [isFirePressed, setIsFirePressed] = useState(false);
  const [autoSprintActive, setAutoSprintActive] = useState(false);
  const [gladWeaponSlot, setGladWeaponSlot] = useState<1 | 2>(1);
  const joyOriginRef = useRef<{ id: number; cx: number; cy: number } | null>(null);
  const lookTouchRef = useRef<{ id: number; lx: number; ly: number } | null>(null);
  const fireDragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    lx: number;
    ly: number;
    showKnob: boolean;
  } | null>(null);
  const leftFireIdsRef = useRef<Set<number>>(new Set());
  const vehTouchRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const setVehAxis = (axis: 'x' | 'y', value: number) => {
    vehTouchRef.current[axis] = value;
    input.setVirtualJoystick(vehTouchRef.current.x, vehTouchRef.current.y);
  };

  const inVehicleActive = Boolean(hud.inVehicle);

  useEffect(() => {
    if (!inVehicleActive) {
      if (vehTouchRef.current.x !== 0 || vehTouchRef.current.y !== 0) {
        vehTouchRef.current = { x: 0, y: 0 };
        input.setVirtualJoystick(0, 0);
      }
    }
  }, [inVehicleActive, input]);

  useEffect(() => {
    if (
      gameState === GameState.AIRPLANE ||
      gameState === GameState.LOBBY ||
      hud.isDead ||
      hud.isPlayerDowned
    ) {
      setAutoSprintActive((prev) => (prev ? false : prev));
      input.setTouchAutoSprint(false);
      input.setTouchSprint(false);
    }
  }, [gameState, hud.isDead, hud.isPlayerDowned, input]);

  useEffect(() => {
    if (
      hud.isSwimming ||
      hud.isDead ||
      hud.isPlayerDowned ||
      inVehicleActive ||
      isPaused ||
      (gameState !== GameState.WAITING && gameState !== GameState.PLAYING)
    ) {
      fireDragRef.current = null;
      leftFireIdsRef.current.clear();
      setFireKnob((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
      setIsFirePressed((prev) => (prev ? false : prev));
      input.setTouchFire(false);
    }
  }, [hud.isSwimming, hud.isDead, hud.isPlayerDowned, inVehicleActive, isPaused, gameState, input]);

  useEffect(() => {
    const coarse =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    setIsTouchDevice(coarse);
  }, []);

  useEffect(() => {
    const minimapCode = kb.minimap || 'KeyM';
    const onKeyDown = (e: KeyboardEvent) => {
      if (input.isRebinding) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Escape' && fullMapOpen) {
        setFullMapOpen(false);
        return;
      }
      if (e.code !== minimapCode || e.repeat) return;
      if (hud.gameVariant === 'gladiadores' || gameState === GameState.WAITING) {
        setMinimapZoomed((v) => !v);
      } else {
        setFullMapOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [kb.minimap, input, fullMapOpen, hud.gameVariant, gameState]);

  useEffect(() => {
    if (
      gameState === GameState.LOBBY ||
      gameState === GameState.WIN ||
      gameState === GameState.GAMEOVER ||
      hud.gameVariant === 'gladiadores'
    ) {
      setFullMapOpen(false);
    }
  }, [gameState, hud.gameVariant]);

  // Track fire button dragging globally on window so fast upward "puxar capa" swipes never freeze
  // or drop if pointer leaves the button bounds or pointer capture resets on Android/WebViews.
  useEffect(() => {
    const syncFireState = () => {
      const anyActive = Boolean(fireDragRef.current) || leftFireIdsRef.current.size > 0;
      input.setTouchFire(anyActive);
    };
    const clearRightFire = () => {
      fireDragRef.current = null;
      setFireKnob({ x: 0, y: 0 });
      setIsFirePressed(false);
      syncFireState();
    };
    const moveFire = (e: PointerEvent) => {
      const drag = fireDragRef.current;
      if (!drag || drag.id !== e.pointerId) return;
      if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        clearRightFire();
        return;
      }
      const dx = e.clientX - drag.lx;
      const dy = e.clientY - drag.ly;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      input.addTouchLook(dx * 2.0, dy * 2.0);
      if (drag.showKnob) {
        const ox = e.clientX - drag.startX;
        const oy = e.clientY - drag.startY;
        const maxR = 26;
        const dist = Math.hypot(ox, oy);
        const scale = dist > maxR ? maxR / dist : 1;
        setFireKnob({ x: ox * scale, y: oy * scale });
      }
    };
    const releaseFire = (e: PointerEvent) => {
      let changed = false;
      if (leftFireIdsRef.current.delete(e.pointerId)) {
        changed = true;
      }
      if (fireDragRef.current && fireDragRef.current.id === e.pointerId) {
        fireDragRef.current = null;
        setFireKnob({ x: 0, y: 0 });
        setIsFirePressed(false);
        changed = true;
      }
      if (changed) {
        syncFireState();
      }
    };
    const clearAllOnBlur = () => {
      fireDragRef.current = null;
      leftFireIdsRef.current.clear();
      setFireKnob({ x: 0, y: 0 });
      setIsFirePressed(false);
      input.setTouchFire(false);
    };
    window.addEventListener('pointermove', moveFire);
    window.addEventListener('pointerup', releaseFire);
    window.addEventListener('pointercancel', releaseFire);
    window.addEventListener('blur', clearAllOnBlur);
    return () => {
      window.removeEventListener('pointermove', moveFire);
      window.removeEventListener('pointerup', releaseFire);
      window.removeEventListener('pointercancel', releaseFire);
      window.removeEventListener('blur', clearAllOnBlur);
    };
  }, [input]);

  const showTouchHud =
    controlMode === 'mobile' || (controlMode === 'auto' && isTouchDevice);

  // Pre-render static 2D Bermuda Minimap terrain & POIs at 512x512
  useEffect(() => {
    const size = 512;
    const activeMapRange = mapRange ?? BERMUDA_MAP_RANGE;
    const worldToBg = size / (activeMapRange * 2);
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const ctx = off.getContext('2d');
    if (!ctx) return;

    const toPx = (wx: number, wz: number) => ({
      x: (wx + activeMapRange) * worldToBg,
      y: (wz + activeMapRange) * worldToBg,
    });

    ctx.fillStyle = '#0d3650';
    ctx.fillRect(0, 0, size, size);

    if (bermudaMinimapCanvas) {
      ctx.drawImage(bermudaMinimapCanvas, 0, 0, size, size);
    } else {
      roads.forEach((r) => {
        const p1 = toPx(r.x1, r.z1);
        const p2 = toPx(r.x2, r.z2);
        ctx.strokeStyle = r.kind === 'asphalt' ? '#686e77' : '#b2976e';
        ctx.lineWidth = Math.max(2.6, r.width * worldToBg * 0.92);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      buildings.forEach((b) => {
        const p = toPx(b.x, b.z);
        const bw = Math.max(2.6, b.w * worldToBg);
        const bd = Math.max(2.6, b.d * worldToBg);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(-b.rotY);
        ctx.fillStyle = b.kind === 'sobrado' ? '#fde68a' : '#e6d8b5';
        ctx.strokeStyle = '#44403c';
        ctx.lineWidth = 0.8;
        ctx.fillRect(-bw * 0.5, -bd * 0.5, bw, bd);
        ctx.strokeRect(-bw * 0.5, -bd * 0.5, bw, bd);
        ctx.restore();
      });
    }

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    pois.forEach((poi) => {
      const p = toPx(poi.x, poi.z);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.84)';
      ctx.strokeText(poi.name, p.x, p.y - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(poi.name, p.x, p.y - 6);
    });

    minimapBgRef.current = off;
  }, [buildings, roads, pois, mapId, hud.mapId, mapRange, bermudaMinimapCanvas]);

  // Fast Minimap dynamic Safe Zone circles + player arrow + zoomed radar crop blit
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    const bg = minimapBgRef.current;
    if (!canvas || !bg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = 256;
    const bgSize = bg.width; // 512

    // Dedicated tactical radar for Gladiadores Arena or distant Waiting Lobby
    if (hud.gameVariant === 'gladiadores' || gameState === GameState.WAITING) {
      const isGlad = hud.gameVariant === 'gladiadores';
      const centerX = isGlad
        ? (GLADIADORES_BOUNDS.minX + GLADIADORES_BOUNDS.maxX) * 0.5
        : WAIT_LOBBY_ORIGIN.x;
      const centerZ = isGlad
        ? (GLADIADORES_BOUNDS.minZ + GLADIADORES_BOUNDS.maxZ) * 0.5
        : WAIT_LOBBY_ORIGIN.z;
      const halfSpan = isGlad ? 24 : 36;
      const minX = centerX - halfSpan;
      const minZ = centerZ - halfSpan;
      const scale = canvasSize / (halfSpan * 2);
      const toArenaPx = (wx: number, wz: number) => ({
        x: (wx - minX) * scale,
        y: (wz - minZ) * scale,
      });

      ctx.fillStyle = isGlad ? '#181c24' : '#16354d';
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      if (isGlad) {
        const tl = toArenaPx(GLADIADORES_BOUNDS.minX, GLADIADORES_BOUNDS.minZ);
        const br = toArenaPx(GLADIADORES_BOUNDS.maxX, GLADIADORES_BOUNDS.maxZ);
        ctx.fillStyle = '#262b36';
        ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

        // Center cover blocks visual guide (symmetrical between North/South spawns)
        const c1 = toArenaPx(GLADIADORES_ORIGIN.x - 24, GLADIADORES_ORIGIN.z - 2.5);
        const c2 = toArenaPx(GLADIADORES_ORIGIN.x - 7, GLADIADORES_ORIGIN.z + 2.5);
        ctx.fillStyle = '#475569';
        ctx.fillRect(c1.x, c1.y, c2.x - c1.x, c2.y - c1.y);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 2;
        ctx.strokeRect(24, 24, canvasSize - 48, canvasSize - 48);
      }

      const plPx = toArenaPx(hud.playerX, hud.playerZ);
      const rad = (hud.yawDeg * Math.PI) / 180;
      ctx.save();
      ctx.translate(plPx.x, plPx.y);
      ctx.rotate(rad);
      ctx.fillStyle = '#5eead4';
      ctx.strokeStyle = '#042f2e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 7);
      ctx.lineTo(0, 3.6);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < hud.teamMembers.length; i++) {
        const m = hud.teamMembers[i];
        if (m.id === 'player' || m.eliminated || m.worldX === undefined || m.worldZ === undefined) {
          continue;
        }
        const mp = toArenaPx(m.worldX, m.worldZ);
        ctx.fillStyle = getSlotColor(m.slotNumber, m.isDowned);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mp.x, mp.y, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      return;
    }

    const drawTacticalMap = (
      ctx: CanvasRenderingContext2D,
      canvasSize: number,
      isZoomed: boolean,
    ) => {
      const mapRangeVal = mapRange ?? BERMUDA_MAP_RANGE;
      const radarHalfRange = 235;

      const minWorldX = isZoomed ? hud.playerX - radarHalfRange : -mapRangeVal;
      const minWorldZ = isZoomed ? hud.playerZ - radarHalfRange : -mapRangeVal;
      const worldSpan = isZoomed ? radarHalfRange * 2 : mapRangeVal * 2;
      const scalePx = canvasSize / worldSpan;

      const toPx = (wx: number, wz: number) => ({
        x: (wx - minWorldX) * scalePx,
        y: (wz - minWorldZ) * scalePx,
      });

      if (isZoomed) {
        ctx.fillStyle = '#0d3650';
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        const bgPerWorld = bgSize / (mapRangeVal * 2);
        const srcX = (minWorldX + mapRangeVal) * bgPerWorld;
        const srcY = (minWorldZ + mapRangeVal) * bgPerWorld;
        const srcW = worldSpan * bgPerWorld;
        const srcH = worldSpan * bgPerWorld;

        const clipL = Math.max(0, srcX);
        const clipT = Math.max(0, srcY);
        const clipR = Math.min(bgSize, srcX + srcW);
        const clipB = Math.min(bgSize, srcY + srcH);

        if (clipR > clipL && clipB > clipT) {
          const dstX = ((clipL - srcX) / srcW) * canvasSize;
          const dstY = ((clipT - srcY) / srcH) * canvasSize;
          const dstW = ((clipR - clipL) / srcW) * canvasSize;
          const dstH = ((clipB - clipT) / srcH) * canvasSize;
          ctx.drawImage(
            bg,
            clipL,
            clipT,
            clipR - clipL,
            clipB - clipT,
            dstX,
            dstY,
            dstW,
            dstH,
          );
        }
      } else {
        ctx.drawImage(bg, 0, 0, canvasSize, canvasSize);
      }

      if (
        gameState === GameState.PLAYING ||
        gameState === GameState.AIRPLANE ||
        gameState === GameState.DROPPING
      ) {
        const sz = hud.safeZone;
        const curP = toPx(sz.currentX, sz.currentZ);
        const curRpx = Math.max(0, sz.currentRadius * scalePx);
        const nextP = toPx(sz.nextX, sz.nextZ);

        // Darken everything outside the shrinking safe zone circle
        ctx.save();
        ctx.fillStyle = 'rgba(7, 15, 30, 0.58)';
        ctx.beginPath();
        ctx.rect(0, 0, canvasSize, canvasSize);
        if (curRpx > 0.5) {
          ctx.arc(curP.x, curP.y, curRpx, 0, Math.PI * 2);
        }
        ctx.fill('evenodd');
        ctx.restore();

        // Outer shrinking storm edge ring
        if (curRpx > 0.5) {
          ctx.save();
          ctx.strokeStyle = sz.isShrinking ? '#38bdf8' : 'rgba(186, 230, 253, 0.9)';
          ctx.lineWidth = canvasSize > 300 ? 2.8 : 2.2;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.65)';
          ctx.shadowBlur = canvasSize > 300 ? 8 : 4;
          ctx.beginPath();
          ctx.arc(curP.x, curP.y, Math.max(1.5, curRpx), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Inner white next safe zone circle
        if (sz.nextRadius > 0.2) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.lineWidth = canvasSize > 300 ? 2.2 : 1.7;
          ctx.beginPath();
          ctx.arc(nextP.x, nextP.y, Math.max(1.5, sz.nextRadius * scalePx), 0, Math.PI * 2);
          ctx.stroke();
        }

        if (sz.playerOutside) {
          const plP = toPx(hud.playerX, hud.playerZ);
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(plP.x, plP.y);
          ctx.lineTo(nextP.x, nextP.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      const plPx = toPx(hud.playerX, hud.playerZ);
      const rad = (hud.yawDeg * Math.PI) / 180;
      const iconScale = canvasSize > 300 ? 1.25 : 1.0;
      ctx.save();
      ctx.translate(plPx.x, plPx.y);
      ctx.rotate(rad);
      ctx.scale(iconScale, iconScale);

      ctx.fillStyle = 'rgba(45, 212, 191, 0.34)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-18, -38);
      ctx.lineTo(18, -38);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#5eead4';
      ctx.strokeStyle = '#042f2e';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 7);
      ctx.lineTo(0, 3.6);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < hud.teamMembers.length; i++) {
        const m = hud.teamMembers[i];
        if (m.id === 'player' || m.eliminated || m.worldX === undefined || m.worldZ === undefined) {
          continue;
        }
        const mp = toPx(m.worldX, m.worldZ);
        const col = getSlotColor(m.slotNumber, m.isDowned);
        ctx.fillStyle = col;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(mp.x, mp.y, (m.isDowned ? 6.2 : 5.2) * iconScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      for (let i = 0; i < hud.vendingLocations.length; i++) {
        const vm = hud.vendingLocations[i];
        const vp = toPx(vm.x, vm.z);
        if (vp.x < -10 || vp.x > canvasSize + 10 || vp.y < -10 || vp.y > canvasSize + 10) continue;
        ctx.fillStyle = '#22d3ee';
        ctx.strokeStyle = '#083344';
        ctx.lineWidth = 1.6;
        ctx.fillRect(vp.x - 3.6, vp.y - 3.6, 7.2, 7.2);
        ctx.strokeRect(vp.x - 3.6, vp.y - 3.6, 7.2, 7.2);
      }

      for (let i = 0; i < hud.vehicleLocations.length; i++) {
        const veh = hud.vehicleLocations[i];
        if (veh.destroyed) continue;
        const vp = toPx(veh.x, veh.z);
        if (vp.x < -10 || vp.x > canvasSize + 10 || vp.y < -10 || vp.y > canvasSize + 10) continue;
        ctx.fillStyle = veh.kind === 'sport' ? '#f43f5e' : '#f97316';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      for (let i = 0; i < hud.airDrops.length; i++) {
        const ad = hud.airDrops[i];
        if (ad.state === 'looted') continue;
        const ap = toPx(ad.x, ad.z);
        if (ap.x < -14 || ap.x > canvasSize + 14 || ap.y < -14 || ap.y > canvasSize + 14) continue;
        if (ad.state === 'falling') {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(ap.x, ap.y, 9.0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.8;
        ctx.fillRect(ap.x - 5.0, ap.y - 5.0, 10.0, 10.0);
        ctx.strokeRect(ap.x - 5.0, ap.y - 5.0, 10.0, 10.0);
      }
    };

    const isGround = gameState === GameState.PLAYING;
    drawTacticalMap(ctx, canvasSize, minimapZoomed && isGround);

    if (fullMapOpen && fullMapCanvasRef.current) {
      const fCanvas = fullMapCanvasRef.current;
      const fCtx = fCanvas.getContext('2d');
      if (fCtx) {
        drawTacticalMap(fCtx, fCanvas.width, false);
      }
    }
  }, [
    hud.playerX,
    hud.playerZ,
    hud.yawDeg,
    hud.safeZone,
    hud.teamMembers,
    hud.airDrops,
    hud.vendingLocations,
    hud.vehicleLocations,
    hud.gameVariant,
    hud.mapId,
    mapId,
    mapRange,
    bermudaMinimapCanvas,
    gameState,
    minimapZoomed,
    fullMapOpen,
    buildings,
    roads,
    pois,
  ]);

  const activeWeaponSlot =
    hud.activeSlot === 4 ? null : hud.weapons[hud.activeSlot];
  const activeWeaponDef = activeWeaponSlot
    ? WEAPONS[activeWeaponSlot.weaponId]
    : null;

  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const armorPct =
    hud.vestMaxHp > 0
      ? Math.max(0, Math.min(100, (hud.vestHp / hud.vestMaxHp) * 100))
      : 0;
  const backpackPct = Math.min(
    100,
    Math.round((hud.backpackUsed / Math.max(1, hud.backpackCapacity)) * 100),
  );
  const zoneMin = String(Math.floor(hud.zoneTimerSec / 60)).padStart(2, '0');
  const zoneSec = String(hud.zoneTimerSec % 60).padStart(2, '0');

  const isGroundCombat =
    gameState === GameState.WAITING || gameState === GameState.PLAYING;
  const isAirborneDrop =
    gameState === GameState.DROPPING || gameState === GameState.PARACHUTE;
  const canAimWeapon =
    hud.activeSlot !== 4 &&
    Boolean(activeWeaponDef && activeWeaponDef.category !== 'HG');
  const hideGameplayHud = Boolean(hud.isDead);

  // Virtual Joystick Handlers
  const handleJoyStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.changedTouches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    joyOriginRef.current = {
      id: touch.identifier,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
  };

  const handleJoyMove = (e: React.TouchEvent) => {
    const origin = joyOriginRef.current;
    if (!origin) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === origin.id) {
        const dx = t.clientX - origin.cx;
        const dy = t.clientY - origin.cy;
        const maxR = 40;
        const dist = Math.hypot(dx, dy);
        const clamped = dist > maxR ? maxR / dist : 1;
        const nx = (dx * clamped) / maxR;
        const ny = (dy * clamped) / maxR;
        setJoyKnob({ x: nx * maxR, y: ny * maxR });
        input.setVirtualJoystick(nx, ny);
        input.setTouchSprint(ny < -0.82 && dist > maxR * 1.18);
        if (ny > 0.35 && autoSprintActive) {
          setAutoSprintActive(false);
        }
      }
    }
  };

  const handleJoyEnd = (e: React.TouchEvent) => {
    const origin = joyOriginRef.current;
    if (!origin) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === origin.id) {
        joyOriginRef.current = null;
        setJoyKnob({ x: 0, y: 0 });
        input.setVirtualJoystick(0, 0);
        input.setTouchSprint(false);
        break;
      }
    }
  };

  // Right Touch Look Area Handlers
  const handleLookStart = (e: React.TouchEvent) => {
    if (e.target !== e.currentTarget) return;
    const t = e.changedTouches[0];
    lookTouchRef.current = { id: t.identifier, lx: t.clientX, ly: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    const look = lookTouchRef.current;
    if (!look) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === look.id) {
        const dx = t.clientX - look.lx;
        const dy = t.clientY - look.ly;
        look.lx = t.clientX;
        look.ly = t.clientY;
        input.addTouchLook(dx * 2.0, dy * 2.0);
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent) => {
    const look = lookTouchRef.current;
    if (!look) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === look.id) {
        lookTouchRef.current = null;
        break;
      }
    }
  };

  const beginFirePointer = (
    e: React.PointerEvent<HTMLElement>,
    showKnob = true,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.pointerType === 'mouse') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore if unsupported
      }
    }
    if (showKnob) {
      fireDragRef.current = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lx: e.clientX,
        ly: e.clientY,
        showKnob: true,
      };
      setFireKnob({ x: 0, y: 0 });
      setIsFirePressed(true);
    } else {
      leftFireIdsRef.current.add(e.pointerId);
    }
    input.setTouchFire(true, true);
  };

  const endFirePointer = (
    e: React.PointerEvent<HTMLElement>,
    isRightBtn: boolean,
  ) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse') {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
    if (isRightBtn) {
      if (fireDragRef.current?.id === e.pointerId) {
        fireDragRef.current = null;
        setFireKnob({ x: 0, y: 0 });
        setIsFirePressed(false);
      }
    } else {
      leftFireIdsRef.current.delete(e.pointerId);
    }
    input.setTouchFire(Boolean(fireDragRef.current) || leftFireIdsRef.current.size > 0);
  };

  const showOpticalOverlay =
    isGroundCombat &&
    canAimWeapon &&
    hud.isAiming &&
    !hud.isPlacingGloo &&
    !hud.isHoldingGrenade &&
    !hud.isDead &&
    !hud.isPlayerDowned &&
    !isPaused;

  const inactiveWeaponSlots: WeaponSlotId[] = (
    [1, 2, 3, 4] as const
  ).filter((s) => s !== hud.activeSlot);

  return (
    <div className="fixed inset-0 z-30 pointer-events-none select-none text-white">
      {/* Optical Scope Overlay */}
      {showOpticalOverlay && (
        <ScopeOverlay
          scope={hud.activeScope}
          aimLockedTarget={hud.aimLockedTarget}
          aimAssistActive={hud.aimAssistActive}
          headshotFlashActive={hud.headshotFlashActive}
        />
      )}

      {/* Outside Safe Zone Blue Storm Edge Vignette */}
      {isGroundCombat && hud.safeZone.playerOutside && !hud.isDead && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 85px 22px rgba(14, 48, 102, 0.56)',
          }}
        />
      )}

      {/* Damage Vignette Flash */}
      {hud.damageFlashActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 90px 28px rgba(220, 38, 38, 0.72)',
          }}
        />
      )}

      {/* Right Half Touch Camera Pad (when mobile HUD enabled) */}
      {showTouchHud && !isPaused && !hideGameplayHud && (
        <div
          onTouchStart={handleLookStart}
          onTouchMove={handleLookMove}
          onTouchEnd={handleLookEnd}
          onTouchCancel={handleLookEnd}
          className="pointer-events-auto touch-none absolute top-16 right-0 bottom-0 left-1/2 z-10"
        />
      )}

      {/* TOP-LEFT CUSTOMIZABLE SQUARE MINIMAP (clickable or [M] to toggle Radar / Full Island) */}
      <div
        style={layoutStyle(hudLayout.minimap)}
        className="pointer-events-auto absolute z-20 flex flex-col gap-0.5"
      >
        <div className="relative w-[104px] h-[104px] sm:w-[124px] sm:h-[124px] border border-white/65 bg-[#14181e] overflow-hidden shadow-lg">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (hud.gameVariant === 'gladiadores' || gameState === GameState.WAITING) {
                setMinimapZoomed((v) => !v);
              } else {
                setFullMapOpen(true);
              }
            }}
            title="Abrir Mapa Completo (M)"
            className="w-full h-full cursor-pointer p-0 block"
          >
            <canvas
              ref={minimapCanvasRef}
              width={256}
              height={256}
              className="w-full h-full block"
            />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setMinimapZoomed((v) => !v);
            }}
            title="Alternar Zoom do Minimapa"
            className="absolute bottom-0.5 right-0.5 bg-black/80 hover:bg-black px-1 py-[1px] text-[7.5px] font-mono font-bold tracking-wider text-amber-200 border border-white/25 cursor-pointer"
          >
            {minimapZoomed && isGroundCombat ? 'RADAR · M' : 'ILHA · M'}
          </button>
        </div>
        {hud.currentPoi && (
          <div
            className="pointer-events-none text-[9px] font-bold tracking-wide uppercase text-amber-200 px-1 w-fit"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
          >
            {hud.currentPoi}
          </div>
        )}
      </div>

      {/* Full Island Tactical Map Overlay (M or tap minimap) */}
      {fullMapOpen && hud.gameVariant !== 'gladiadores' && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setFullMapOpen(false)}
          className="fixed inset-0 z-50 bg-black/78 backdrop-blur-sm flex flex-col items-center justify-center p-3 pointer-events-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-3 px-3 py-1 bg-black/85 border border-white/25 text-[11px] font-mono uppercase">
              <span className="text-sky-300 font-bold">
                ZONA {hud.safeZone.phase}/{hud.safeZone.totalPhases}
              </span>
              <span className="text-white">
                {hud.safeZone.isShrinking
                  ? `FECHANDO (${hud.safeZone.timerSec}s)`
                  : hud.safeZone.currentRadius <= 0.2
                    ? 'FECHADA'
                    : `FECHA EM ${hud.safeZone.timerSec}s`}
              </span>
              {hud.safeZone.playerOutside && (
                <span className="text-red-400 font-bold">
                  -{hud.safeZone.damagePerSec} HP/s
                </span>
              )}
            </div>

            <div className="relative w-[min(80vh,90vw)] h-[min(80vh,90vw)] border-2 border-white/45 bg-[#0d3650] shadow-2xl overflow-hidden">
              <canvas
                ref={fullMapCanvasRef}
                width={512}
                height={512}
                className="w-full h-full block"
              />
            </div>

            <div className="w-full flex items-center justify-between text-[10px] font-mono text-neutral-300">
              <span>Área escura = fora da safe · Círculo branco = próxima safe</span>
              <button
                type="button"
                onClick={() => setFullMapOpen(false)}
                className="px-5 py-1.5 bg-neutral-900/95 hover:bg-neutral-800 border border-white/40 text-white font-black text-xs uppercase tracking-wider cursor-pointer"
              >
                VOLTAR ({formatKeyCodeLabel(kb.minimap || 'KeyM')})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERHEAD 3D-PROJECTED TEAMMATE TAGS (#2 JOGADOR + ▼) & OFF-SCREEN DIRECTIONAL ARROWS */}
      {!isPaused &&
        hud.teamMembers.map((m) => {
          if (m.id === 'player' || m.eliminated) return null;
          const color = getSlotColor(m.slotNumber, m.isDowned);
          if (m.onScreen && m.screenXPct !== undefined && m.screenYPct !== undefined) {
            return (
              <div
                key={`tag_${m.id}`}
                className="pointer-events-none absolute z-20 flex flex-col items-center -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${m.screenXPct}%`,
                  top: `${m.screenYPct}%`,
                  textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                }}
              >
                <div
                  className={`flex items-center gap-1 px-1.5 py-0.5 bg-black/65 border rounded-[2px] ${
                    m.isDowned ? 'border-red-500 animate-pulse' : 'border-white/25'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-[2px] flex items-center justify-center text-[9px] font-black text-black shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {m.slotNumber}
                  </span>
                  <span
                    className="text-[10px] font-bold tracking-tight whitespace-nowrap"
                    style={{ color: m.isDowned ? '#fca5a5' : '#ffffff' }}
                  >
                    {m.nick}
                  </span>
                  {m.distance !== undefined && (
                    <span className="text-[8px] font-mono text-white/75">{m.distance}m</span>
                  )}
                </div>
                {m.isDowned && (
                  <span className="mt-0.5 px-1 bg-red-600 text-[8px] font-black text-white uppercase tracking-wider">
                    CAÍDO · SALVAR
                  </span>
                )}
                <span
                  className="text-[11px] leading-none -mt-0.5"
                  style={{ color }}
                >
                  ▼
                </span>
              </div>
            );
          }

          if (m.offscreenAngleRad !== undefined) {
            const clampedAngle = m.offscreenAngleRad;
            const sinA = Math.sin(clampedAngle);
            const cosA = Math.cos(clampedAngle);
            const xPct = 50 + sinA * 40;
            const yPct = 50 - cosA * 38;
            return (
              <div
                key={`off_${m.id}`}
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: `${xPct}%`, top: `${yPct}%` }}
              >
                <div
                  className="w-5 h-5 flex items-center justify-center"
                  style={{ transform: `rotate(${clampedAngle}rad)` }}
                >
                  <svg viewBox="0 0 20 20" className="w-4 h-4 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                    <path d="M10 1 L18 17 L10 13 L2 17 Z" fill={color} stroke="#000" strokeWidth="1.2" />
                  </svg>
                </div>
                <div className="flex items-center gap-0.5 bg-black/70 px-1 rounded-[2px] text-[8px] font-mono font-bold">
                  <span
                    className="w-3 h-3 rounded-[2px] flex items-center justify-center text-[8px] font-black text-black"
                    style={{ backgroundColor: color }}
                  >
                    {m.slotNumber}
                  </span>
                  {m.distance !== undefined && <span className="text-white">{m.distance}m</span>}
                </div>
              </div>
            );
          }
          return null;
        })}

      {/* DUO / SQUAD TEAMMATE STATUS PANEL (customizable) */}
      {hud.teamMembers.length > 0 && (
        <div
          style={layoutStyle(hudLayout.teamPanel)}
          className="absolute z-20 flex flex-col gap-1 pointer-events-none"
        >
          {hud.teamMembers.map((m) => {
            const slotColor = getSlotColor(m.slotNumber, m.isDowned);
            return (
              <div
                key={m.id}
                className={`w-28 sm:w-34 bg-black/55 border px-1.5 py-0.5 ${
                  m.eliminated
                    ? 'border-neutral-600/60 opacity-50'
                    : m.isDowned
                      ? 'border-red-500 animate-pulse'
                      : 'border-white/25'
                }`}
              >
                <div className="flex items-center justify-between text-[9px] font-bold leading-tight gap-1">
                  <span className="flex items-center gap-1 truncate">
                    <span
                      className="w-3.5 h-3.5 rounded-[2px] inline-flex items-center justify-center text-[8px] font-black text-black shrink-0"
                      style={{ backgroundColor: m.slotNumber === 1 ? '#f59e0b' : slotColor }}
                    >
                      {m.slotNumber}
                    </span>
                    <span className="truncate">{m.nick}</span>
                  </span>
                  {m.isDowned ? (
                    <span className="text-[8px] font-black text-red-400 shrink-0">CAÍDO</span>
                  ) : m.distance !== undefined && m.id !== 'player' && !m.eliminated ? (
                    <span className="text-[8px] font-mono text-white/65 shrink-0">{m.distance}m</span>
                  ) : null}
                </div>
                <div className="w-full h-1 bg-white/15 mt-0.5">
                  <div
                    className={`h-full transition-all ${
                      m.isDowned
                        ? 'bg-red-500'
                        : m.eliminated
                          ? 'bg-neutral-500'
                          : 'bg-emerald-400'
                    }`}
                    style={{
                      width: `${m.eliminated ? 0 : Math.max(4, Math.min(100, (m.hp / m.maxHp) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CUSTOMIZABLE FPS READOUT */}
      {showFps && (
        <div
          style={{
            ...layoutStyle(hudLayout.fpsBadge),
            textShadow: '0 1px 2px rgba(0,0,0,0.95)',
          }}
          className="pointer-events-none absolute z-20 whitespace-nowrap text-[10px] font-mono font-bold tabular-nums text-white/85"
        >
          {hud.fps} FPS
        </div>
      )}

      {/* CUSTOMIZABLE UTILITY BUTTONS (MOCHILA %, KIT, GRANADA, GELO) */}
      {isGroundCombat && !hideGameplayHud && !hud.isPlayerDowned && !isPaused && (
        <>
          {/* Mochila (% lotação) */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleBackpack();
            }}
            style={layoutStyle(hudLayout.backpackBtn)}
            className="pointer-events-auto touch-none absolute z-20 w-11 h-11 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/65 border border-white/25 flex items-center justify-center shadow cursor-pointer active:scale-95"
            title={`Abrir Mochila (${kBackpack})`}
          >
            <IconBackpackSvg className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow" />
            <span className="absolute -top-1 right-0 bg-black/80 px-1 text-[8px] font-mono font-black text-white leading-tight">
              {backpackPct}%
            </span>
            {!showTouchHud && (
              <span className="absolute bottom-0.5 left-0.5 text-[7px] font-mono text-white/75">
                {kBackpack}
              </span>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/15">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${backpackPct}%` }}
              />
            </div>
          </button>

          {!hud.isSwimming && (
            <>
              {/* Kit Médico (disponível a pé e dentro de veículos) */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onUseMedkit();
                }}
                disabled={
                  (hud.medkitCount <= 0 && hud.smallkitCount <= 0) ||
                  hud.hp >= hud.maxHp ||
                  hud.usingMedkit
                }
                style={layoutStyle(hudLayout.medkitBtn)}
                className="pointer-events-auto touch-none absolute z-20 w-11 h-11 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/65 border border-white/25 flex items-center justify-center shadow cursor-pointer active:scale-95 disabled:brightness-50 disabled:grayscale"
                title={`Usar Kit Médico (${kMedkit})`}
              >
                <img
                  src={hud.medkitCount > 0 ? '/icons/kit-grande.png' : '/icons/kit.png'}
                  alt="Kit Médico"
                  className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow"
                />
                <span className="absolute top-0 right-0.5 text-[10px] font-mono font-black text-white drop-shadow">
                  {hud.medkitCount > 0 ? hud.medkitCount : hud.smallkitCount}
                </span>
                {!showTouchHud && (
                  <span className="absolute bottom-0 left-0.5 text-[7px] font-mono text-white/75">
                    {kMedkit}
                  </span>
                )}
              </button>

              {/* Kit Pequeno (rápido +35 HP) ao lado do Kit Médico quando disponível */}
              {hud.smallkitCount > 0 && hud.medkitCount > 0 && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onUseSmallKit?.();
                  }}
                  disabled={hud.hp >= hud.maxHp || hud.usingMedkit}
                  style={layoutStyle(hudLayout.smallMedkitBtn)}
                  className="pointer-events-auto touch-none absolute z-20 w-10 h-10 bg-black/55 hover:bg-emerald-950/65 border border-emerald-400/50 flex items-center justify-center shadow cursor-pointer active:scale-95 disabled:brightness-50 disabled:grayscale"
                  title={`Kit Pequeno (+35 HP · 4s) (${kSmallMedkit})`}
                >
                  <img
                    src="/icons/kit.png"
                    alt="Kit Pequeno"
                    className="w-6 h-6 object-contain drop-shadow"
                  />
                  <span className="absolute top-0 right-0.5 text-[9px] font-mono font-black text-emerald-300 drop-shadow">
                    {hud.smallkitCount}
                  </span>
                  {!showTouchHud && (
                    <span className="absolute bottom-0 left-0.5 text-[7px] font-mono text-emerald-200/80">
                      {kSmallMedkit}
                    </span>
                  )}
                </button>
              )}

              {!hud.inVehicle && (
                <>
                  {/* Granada */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      input.triggerGrenade();
                    }}
                    disabled={hud.grenadeCount <= 0}
                    style={layoutStyle(hudLayout.grenadeBtn)}
                    className={`pointer-events-auto touch-none absolute z-20 w-11 h-11 sm:w-12 sm:h-12 border flex items-center justify-center shadow cursor-pointer active:scale-95 disabled:brightness-50 disabled:grayscale ${
                      hud.isHoldingGrenade
                        ? 'bg-red-600/80 border-amber-300 text-white ring-1 ring-amber-300'
                        : 'bg-black/50 hover:bg-black/65 border-white/25 text-white'
                    }`}
                    title={`Granada Explosiva (${kGrenade})`}
                  >
                    <IconGrenadeSvg className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow" />
                    <span className="absolute bottom-0 right-0.5 text-[10px] font-mono font-black text-white drop-shadow">
                      {hud.grenadeCount}
                    </span>
                    {!showTouchHud && (
                      <span className="absolute top-0 left-0.5 text-[7px] font-mono text-white/75">
                        {kGrenade}
                      </span>
                    )}
                  </button>

                  {/* Parede de Gelo */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      input.triggerGloo();
                    }}
                    disabled={hud.glooCount <= 0}
                    style={layoutStyle(hudLayout.glooBtn)}
                    className={`pointer-events-auto touch-none absolute z-20 w-11 h-11 sm:w-12 sm:h-12 border flex items-center justify-center shadow cursor-pointer active:scale-95 disabled:brightness-50 disabled:grayscale ${
                      hud.isPlacingGloo
                        ? 'bg-cyan-500/85 border-white text-black ring-1 ring-cyan-300'
                        : 'bg-black/50 hover:bg-black/65 border-white/25 text-cyan-200'
                    }`}
                    title={`Parede de Gelo (${kGloo})`}
                  >
                    <IconGlooSvg className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow" />
                    <span className="absolute bottom-0 right-0.5 text-[10px] font-mono font-black text-white drop-shadow">
                      {hud.glooCount}
                    </span>
                    {!showTouchHud && (
                      <span className="absolute top-0 left-0.5 text-[7px] font-mono text-white/75">
                        {kGloo}
                      </span>
                    )}
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* TOP-CENTER (customizable): Compass + Tapered Dark Smoke Zone Banner + Timer + Centered Rising Kill Feed */}
      <div
        style={layoutStyle(hudLayout.topBanner)}
        className="pointer-events-none absolute z-20 flex flex-col items-center gap-0.5 w-[300px] sm:w-[370px] max-w-[92vw]"
      >
        {/* Crisp Compass Strip */}
        <div
          className="px-3 py-0.5 flex items-center gap-2.5 text-[10px] font-mono tabular-nums text-white/85"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
        >
          {COMPASS_LABELS.map((c) => {
            let diff = Math.abs(hud.yawDeg - c.deg);
            if (diff > 180) diff = 360 - diff;
            if (diff > 70) return null;
            return (
              <span
                key={c.label}
                className={
                  diff < 15 ? 'text-amber-300 font-black' : 'text-white/75'
                }
              >
                {c.label}
              </span>
            );
          })}
          <span className="text-white font-bold border-l border-white/30 pl-2">
            {Math.round(hud.yawDeg)}°
          </span>
        </div>

        {gameState === GameState.WAITING && (
          <div className="pointer-events-auto flex items-center gap-2 bg-black/75 border border-amber-400/70 px-3 py-1 text-xs font-mono mt-0.5">
            <span>{hud.isOnlineMatch ? 'ILHA DE ESPERA · EMBARQUE:' : 'ILHA DE ESPERA:'}</span>
            <strong className="text-amber-400 tabular-nums">
              00:{String(hud.waitingTimerSec).padStart(2, '0')}
            </strong>
            {!hud.isOnlineMatch && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSkipWaiting();
                }}
                className="touch-none ml-1 px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase cursor-pointer"
              >
                EMBARCAR
              </button>
            )}
          </div>
        )}

        {gameState === GameState.PLAYING && hud.gameVariant === 'gladiadores' && hud.gladiadores ? (
          <div className="flex flex-col items-center gap-1.5 mt-0.5">
            <div className="flex items-center gap-2 bg-black/80 border border-white/25 px-3 py-1 shadow-xl">
              <div className="text-right">
                <div className="text-[9px] font-mono uppercase text-emerald-300 font-bold">VOCÊ</div>
                <div className="text-lg font-black font-mono text-emerald-400 tabular-nums leading-none">
                  {hud.gladiadores.playerScore}
                </div>
              </div>

              <div className="px-2.5 border-x border-white/20 text-center">
                <div className="text-[9px] font-black uppercase tracking-wider text-amber-300">
                  GLADIADORES {hud.gladiadores.format.toUpperCase()}
                </div>
                <div className="text-[10px] font-mono text-neutral-200">
                  RODADA {hud.gladiadores.round}/5 · META 3
                  {hud.gladiadores.phase === 'intro' ? ` · ${hud.gladiadores.phaseTimerSec}s` : ''}
                </div>
              </div>

              <div className="text-left">
                <div className="text-[9px] font-mono uppercase text-red-300 font-bold">BOT</div>
                <div className="text-lg font-black font-mono text-red-400 tabular-nums leading-none">
                  {hud.gladiadores.enemyScore}
                </div>
              </div>
            </div>

            {hud.gladiadores.banner && (
              <div className="mt-1 px-5 py-1 bg-gradient-to-r from-red-950/92 via-black/95 to-red-950/92 border-y-2 border-amber-400 text-xs sm:text-sm font-black uppercase tracking-widest text-amber-300 shadow-2xl">
                {hud.gladiadores.banner}
              </div>
            )}

            {hud.gladiadores.phase === 'intro' && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="pointer-events-auto mt-1 w-[min(92vw,470px)] bg-black/88 border border-amber-400/75 p-2.5 shadow-2xl backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-white/15">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                      ARSENAL ({hud.gladiadores.phaseTimerSec}s)
                    </span>
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setGladWeaponSlot(1);
                      }}
                      className={`touch-none px-2 py-0.5 text-[10px] font-black uppercase border cursor-pointer ${
                        gladWeaponSlot === 1
                          ? 'bg-amber-400 text-black border-white'
                          : 'bg-white/10 text-neutral-200 border-white/25 hover:bg-white/20'
                      }`}
                    >
                      SLOT 1
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setGladWeaponSlot(2);
                      }}
                      className={`touch-none px-2 py-0.5 text-[10px] font-black uppercase border cursor-pointer ${
                        gladWeaponSlot === 2
                          ? 'bg-amber-400 text-black border-white'
                          : 'bg-white/10 text-neutral-200 border-white/25 hover:bg-white/20'
                      }`}
                    >
                      SLOT 2
                    </button>
                  </div>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onReadyGladiadoresRound?.();
                    }}
                    className="touch-none px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase tracking-wider border border-white cursor-pointer"
                  >
                    PRONTO ▶
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {Object.values(WEAPONS).map((w) => {
                    const isEqSlot1 = hud.weapons[1]?.weaponId === w.id;
                    const isEqSlot2 = hud.weapons[2]?.weaponId === w.id;
                    const isEqSlot3 = hud.weapons[3]?.weaponId === w.id;
                    const equipped = isEqSlot1 || isEqSlot2 || isEqSlot3;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onSelectGladiadoresWeapon?.(w.id, gladWeaponSlot);
                        }}
                        className={`touch-none flex flex-col items-center justify-between p-1.5 border text-center cursor-pointer transition-colors ${
                          equipped
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                            : 'bg-white/5 hover:bg-white/15 border-white/20 text-neutral-100'
                        }`}
                      >
                        <WeaponIcon weaponId={w.id} className="w-12 h-6 shrink-0" />
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-black uppercase tracking-tight leading-none">
                            {w.shortName}
                          </span>
                          {equipped && (
                            <span className="text-[8px] font-mono font-black px-1 bg-amber-400 text-black leading-tight">
                              {isEqSlot1 ? '1' : isEqSlot2 ? '2' : '3'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          gameState === GameState.PLAYING && (
            <div className="flex flex-col items-center w-full">
              {/* Tapered Dark Smoke Warning Strip matching screenshot */}
              <div
                className="w-full py-0.5 px-4 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-medium tracking-wide"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(8,10,12,0.72) 24%, rgba(8,10,12,0.72) 76%, transparent 100%)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.95)',
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 fill-amber-400/25 shrink-0" />
                <span className="text-white/95">
                  {hud.safeZone.isShrinking
                    ? `Zona segura ${hud.safeZone.phase}/${hud.safeZone.totalPhases} fechando`
                    : hud.safeZone.phase >= hud.safeZone.totalPhases &&
                        hud.safeZone.currentRadius <= 0.2
                      ? `Zona segura ${hud.safeZone.phase}/${hud.safeZone.totalPhases} fechada`
                      : `Zona segura ${hud.safeZone.phase}/${hud.safeZone.totalPhases} fechará em`}
                </span>
              </div>

              {/* Large Centered White Timer */}
              <div
                className="text-2xl sm:text-[28px] font-bold font-mono tabular-nums text-white leading-tight mt-0.5"
                style={{ textShadow: '0 2px 5px rgba(0,0,0,0.9)' }}
              >
                {zoneMin}:{zoneSec}
              </div>

              {hud.safeZone.playerOutside && (
                <div className="mt-0.5 flex items-center gap-1 bg-red-950/88 border border-red-500 px-2 py-0.5 text-[10px] font-mono font-bold text-red-200 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span>FORA DA ZONA (-{hud.safeZone.damagePerSec} HP/s)</span>
                </div>
              )}

              {hud.airDropNotice && (
                <div className="mt-0.5 flex items-center gap-1.5 bg-amber-950/90 border border-amber-400 px-2.5 py-0.5 text-[10px] font-mono font-black text-amber-200 tracking-wider uppercase shadow">
                  <span className="w-2 h-2 bg-amber-400 rounded-xs animate-pulse" />
                  <span>{hud.airDropNotice}</span>
                </div>
              )}

              {hud.stanceNotice && (
                <div className="mt-1 flex items-center gap-1.5 bg-red-950/92 border border-red-400 px-3 py-1 text-[11px] font-mono font-black text-red-100 tracking-wide shadow-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>{hud.stanceNotice}</span>
                </div>
              )}
            </div>
          )
        )}

        {(gameState === GameState.AIRPLANE ||
          gameState === GameState.DROPPING ||
          gameState === GameState.PARACHUTE) && (
          <div
            className="px-4 py-0.5 text-xs font-mono tabular-nums"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(8,10,12,0.72) 25%, rgba(8,10,12,0.72) 75%, transparent 100%)',
            }}
          >
            ALTITUDE: <strong className="text-amber-300">{Math.round(hud.altitude)}m</strong>
          </div>
        )}
      </div>

      {/* CUSTOMIZABLE RISING KILL FEED ("NICK matou NICK2 (G18)" / "NICK3 headshot NICK4 (SCAR)") */}
      {isGroundCombat && !isPaused && hud.killFeed.length > 0 && (
        <div
          style={layoutStyle(hudLayout.killFeed)}
          className="pointer-events-none absolute z-20 flex flex-col items-center gap-0.5 w-[320px] sm:w-[420px] max-w-[94vw]"
        >
          {hud.killFeed.slice(-4).map((kf) => {
            const fadeIn = Math.min(1, kf.age / 0.14);
            const fadeOut =
              kf.age > 3.3 ? Math.max(0, 1 - (kf.age - 3.3) / 1.1) : 1;
            const opacity = fadeIn * fadeOut;
            const enterLift = Math.max(0, 1 - kf.age / 0.22) * 10;
            const driftUp = -kf.age * 4.5;

            if (kf.weaponShort === 'REVIVE') {
              const savedNick = kf.victimName.replace(/\s+SALVO$/i, '');
              return (
                <div
                  key={kf.id}
                  style={{
                    opacity,
                    transform: `translateY(${(enterLift + driftUp).toFixed(1)}px)`,
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.62) 16%, rgba(0,0,0,0.62) 84%, transparent 100%)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.98)',
                  }}
                  className="px-4 py-0.5 text-[11px] sm:text-xs font-bold tracking-wide whitespace-nowrap"
                >
                  <span className={kf.isPlayerKiller ? 'text-amber-300 font-black' : 'text-white'}>
                    {kf.killerName}
                  </span>{' '}
                  <span className="text-emerald-300 font-extrabold">salvou</span>{' '}
                  <span className="text-white">{savedNick}</span>
                </div>
              );
            }

            if (kf.weaponShort === 'LOJA') {
              const targetNick = kf.victimName.replace(/\s+REDESDOBRADO$/i, '');
              return (
                <div
                  key={kf.id}
                  style={{
                    opacity,
                    transform: `translateY(${(enterLift + driftUp).toFixed(1)}px)`,
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.62) 16%, rgba(0,0,0,0.62) 84%, transparent 100%)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.98)',
                  }}
                  className="px-4 py-0.5 text-[11px] sm:text-xs font-bold tracking-wide whitespace-nowrap"
                >
                  <span className="text-cyan-200 font-black">{targetNick}</span>{' '}
                  <span className="text-neutral-200">redesdobrado</span>{' '}
                  <span className="text-amber-300 font-mono">({kf.killerName})</span>
                </div>
              );
            }

            if (kf.weaponShort === 'ELIM_ENV') {
              return (
                <div
                  key={kf.id}
                  style={{
                    opacity,
                    transform: `translateY(${(enterLift + driftUp).toFixed(1)}px)`,
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.62) 16%, rgba(0,0,0,0.62) 84%, transparent 100%)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.98)',
                  }}
                  className="px-4 py-0.5 text-[11px] sm:text-xs font-bold tracking-wide whitespace-nowrap"
                >
                  <span className="text-white">{kf.victimName}</span>{' '}
                  <span className="text-neutral-300 font-semibold">eliminado</span>
                </div>
              );
            }

            if (kf.weaponShort === 'KNOCK_ENV') {
              return (
                <div
                  key={kf.id}
                  style={{
                    opacity,
                    transform: `translateY(${(enterLift + driftUp).toFixed(1)}px)`,
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.62) 16%, rgba(0,0,0,0.62) 84%, transparent 100%)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.98)',
                  }}
                  className="px-4 py-0.5 text-[11px] sm:text-xs font-bold tracking-wide whitespace-nowrap"
                >
                  <span className="text-white">{kf.victimName}</span>{' '}
                  <span className="text-orange-300 font-extrabold">derrubado</span>
                </div>
              );
            }

            const isKnockdown = kf.killerName.includes('(DERRUBOU)');
            const cleanKiller = isKnockdown
              ? kf.killerName.replace(' (DERRUBOU)', '')
              : kf.killerName;
            const verb = isKnockdown
              ? 'derrubou'
              : kf.isHeadshot
                ? 'headshot'
                : 'matou';

            return (
              <div
                key={kf.id}
                style={{
                  opacity,
                  transform: `translateY(${(enterLift + driftUp).toFixed(1)}px)`,
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.62) 16%, rgba(0,0,0,0.62) 84%, transparent 100%)',
                  textShadow: '0 1px 3px rgba(0,0,0,0.98)',
                }}
                className="px-4 py-0.5 text-[11px] sm:text-xs font-bold tracking-wide whitespace-nowrap"
              >
                <span className={kf.isPlayerKiller ? 'text-amber-300 font-black' : 'text-white'}>
                  {cleanKiller}
                </span>{' '}
                <span
                  className={
                    kf.isHeadshot
                      ? 'text-red-400 font-black'
                      : isKnockdown
                        ? 'text-orange-300 font-extrabold'
                        : 'text-neutral-200 font-semibold'
                  }
                >
                  {verb}
                </span>{' '}
                <span className="text-white">{kf.victimName}</span>{' '}
                <span className="text-neutral-300 font-mono font-semibold">
                  ({kf.weaponShort})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* CUSTOMIZABLE FF COINS + SPECTATORS + LIKES BADGE */}
      {(!hideGameplayHud || Boolean(hud.likeToast)) && (
        <div
          style={layoutStyle(hudLayout.ffCoins)}
          className="pointer-events-none absolute z-20 flex flex-col items-center gap-1 w-max"
        >
          <div className="flex items-center gap-1">
            {!hideGameplayHud && (
              <div className="flex items-center gap-1 bg-black/75 border border-amber-400/55 px-2 py-1 text-[11px] font-mono font-black text-amber-300 tabular-nums whitespace-nowrap">
                <IconCoinSvg className="w-3.5 h-3.5 shrink-0" />
                <span>{hud.ffCoins}</span>
              </div>
            )}
            {!hideGameplayHud && hud.spectatorCount > 0 && (
              <div
                className="flex items-center gap-1 bg-black/70 border border-white/30 px-2 py-0.5 text-[11px] font-mono font-black text-white shadow"
                title="Espectadores assistindo você"
              >
                <img
                  src="/assets/aistudio/159604_d43d3e53.png"
                  alt="Telando"
                  className="w-3.5 h-3.5 object-contain brightness-0 invert"
                />
                <span className="tabular-nums">{hud.spectatorCount}</span>
              </div>
            )}
            {!hideGameplayHud && hud.matchVisualLikes > 0 && (
              <div
                className="flex items-center gap-1 bg-amber-500/20 border border-amber-400/60 px-1.5 py-0.5 text-[10px] font-mono font-black text-amber-300 shadow"
                title="Likes nesta partida"
              >
                <ThumbsUp className="w-3 h-3 fill-amber-400 text-amber-300" />
                <span className="tabular-nums">{hud.matchVisualLikes}</span>
              </div>
            )}
          </div>
          {hud.likeToast && (
            <div className="flex items-center gap-1.5 bg-black/80 border border-amber-400/80 px-2.5 py-1 text-[10px] font-bold text-amber-200 shadow-lg animate-pulse whitespace-nowrap">
              <ThumbsUp className="w-3.5 h-3.5 fill-amber-400 text-amber-300 shrink-0" />
              <span>{hud.likeToast.nick}</span>
            </div>
          )}
        </div>
      )}

      {/* CUSTOMIZABLE ALIVE / KILLS BOX (+ RANK BADGE) */}
      <div
        style={layoutStyle(hudLayout.aliveBox)}
        className="pointer-events-none absolute z-20 flex items-center gap-1.5 w-max"
      >
        {hud.isRanked && hud.gameVariant !== 'gladiadores' && (
          <div className="bg-red-700/90 border border-amber-300/80 px-1.5 py-1 text-[9px] font-black tracking-wider uppercase text-amber-200 whitespace-nowrap">
            RANK
          </div>
        )}
        <div className="flex items-center text-[11px] sm:text-xs font-bold shadow-md overflow-hidden rounded-[2px]">
          <div className="bg-gradient-to-r from-cyan-500/85 to-teal-400/85 px-2.5 py-1 flex items-center gap-1 text-white">
            <span>
              {hud.gameVariant === 'gladiadores'
                ? 'Arena'
                : gameState === GameState.WAITING
                  ? 'Lobby'
                  : 'Vivo'}
            </span>
            <span className="font-mono font-black tabular-nums">
              {hud.gameVariant === 'gladiadores' && hud.gladiadores
                ? `${hud.gladiadores.playerTeamAlive}v${hud.gladiadores.enemyTeamAlive}`
                : gameState === GameState.WAITING
                  ? `${hud.aliveCount}/51`
                  : hud.aliveCount}
            </span>
          </div>
          <div className="bg-gradient-to-r from-orange-500/85 to-red-600/85 px-2.5 py-1 flex items-center gap-1 text-white">
            <span>Matou</span>
            <span className="font-mono font-black tabular-nums">
              {hud.spectatingTarget ? hud.spectatingTarget.kills : hud.kills}
            </span>
          </div>
        </div>
      </div>

      {/* CUSTOMIZABLE SETTINGS / PAUSE GEAR BUTTON */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onTogglePause();
        }}
        style={layoutStyle(hudLayout.settingsBtn)}
        className="pointer-events-auto touch-none absolute z-20 bg-black/50 hover:bg-black/75 border border-white/25 p-1.5 rounded-[2px] cursor-pointer shadow"
        title="Menu / Configurações (Esc)"
      >
        <Settings className="w-4 h-4 text-white" />
      </button>

      {/* CUSTOMIZABLE NETWORK PING BADGE */}
      <div
        style={layoutStyle(hudLayout.pingBadge)}
        className="pointer-events-none absolute z-20 w-max"
      >
        <NetworkPingBadge
          pingMs={hud.pingMs}
          disconnected={hud.isNetworkDisconnected}
          compact
        />
      </div>

      {/* CUSTOMIZABLE VOICE CALL WIDGET (MUTAR / FALAR / PARTICIPANTES) */}
      <div
        style={layoutStyle(hudLayout.voiceCall)}
        className="pointer-events-auto absolute z-20 w-max"
      >
        <VoiceChatHudWidget />
      </div>

      {/* CUSTOMIZABLE CLASSIC FREE FIRE TOP-RIGHT WEAPON BOX (MATCHES SCREENSHOTS 1 & 3) */}
      {isGroundCombat && !hud.isPlayerDowned && !hideGameplayHud && (
        <div
          style={layoutStyle(hudLayout.weapons)}
          className="pointer-events-auto absolute z-20 flex flex-col items-end gap-1 w-[184px] sm:w-[214px]"
        >
          <div className="w-full bg-black/50 border border-white/30 shadow-lg overflow-hidden">
            {/* Top Active Slot Card (tap to quick-swap with last weapon) */}
            {hud.activeSlot === 4 || !activeWeaponDef || !activeWeaponSlot ? (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  input.triggerQuickSwap();
                }}
                className="touch-none w-full relative grid grid-cols-12 h-11 sm:h-12 border-b border-white/25 bg-black/35 hover:bg-white/10 cursor-pointer text-left"
                title="Troca Rápida de Arma (Q)"
              >
                <div className="col-span-5 flex flex-col items-center justify-center leading-none border-r border-white/15">
                  <span className="text-2xl font-light text-white leading-none">∞</span>
                  <span className="text-[8px] font-mono text-white/75 tracking-wider">
                    PUNHO
                  </span>
                </div>
                <div className="col-span-7 flex items-center justify-center px-2">
                  <IconFistSvg className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" />
                </div>
              </button>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  input.triggerQuickSwap();
                }}
                className="touch-none w-full relative grid grid-cols-12 h-11 sm:h-12 border-b border-white/25 bg-black/35 hover:bg-white/10 cursor-pointer text-left"
                title="Troca Rápida de Arma (Q)"
              >
                {/* Left Ammo Stack: Mag / Reserve */}
                <div className="col-span-4 flex flex-col items-center justify-center leading-none px-1 border-r border-white/15 font-mono tabular-nums">
                  {hud.isReloading ? (
                    <span className="text-[9px] font-black text-amber-300">RECAR...</span>
                  ) : (
                    <>
                      <span className="text-sm sm:text-base font-black text-white leading-none">
                        {activeWeaponSlot.ammoInMag}
                      </span>
                      <div className="w-5 h-[1px] bg-white/40 my-0.5" />
                      <span className="text-[9px] font-bold text-white/75 leading-none">
                        {activeWeaponSlot.reserveAmmo}
                      </span>
                    </>
                  )}
                </div>

                {/* Right Active Weapon Silhouette + Recarga Rápida header */}
                <div className="col-span-8 relative flex flex-col items-center justify-center px-1.5 pt-2.5 pb-0.5">
                  <div className="absolute top-0.5 inset-x-1.5 flex items-center justify-between text-[7px] font-sans tracking-wide text-white/85">
                    <span>Recarga Rápida</span>
                    <span className="font-mono font-bold text-amber-300">
                      {activeWeaponDef.shortName}
                    </span>
                  </div>
                  <WeaponIcon
                    weaponId={activeWeaponSlot.weaponId}
                    className="w-[90%] h-7 sm:h-8 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                  />
                </div>

                {hud.isReloading && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/60">
                    <div
                      className="h-full bg-amber-300"
                      style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
                    />
                  </div>
                )}
              </button>
            )}

            {/* Bottom Row: 3 Inactive Slots (Always includes remaining guns + Punho) */}
            <div className="grid grid-cols-3 h-11 sm:h-12 divide-x divide-white/25">
              {inactiveWeaponSlots.map((slotNum) => {
                if (slotNum === 4) {
                  return (
                    <button
                      key={4}
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        input.triggerSlot(4);
                      }}
                      className="touch-none relative flex items-center justify-center p-1 hover:bg-white/15 cursor-pointer"
                      title={`Soco / Punho (${kSlot4})`}
                    >
                      <IconFistSvg className="w-6 h-6 text-white drop-shadow" />
                      <span className="absolute bottom-0.5 left-1 text-[10px] font-mono font-bold text-white/90 leading-none">
                        ∞
                      </span>
                      {!showTouchHud && (
                        <span className="absolute top-0.5 right-1 text-[7px] font-mono text-white/60">
                          {kSlot4}
                        </span>
                      )}
                    </button>
                  );
                }

                const w = hud.weapons[slotNum];
                const def = w ? WEAPONS[w.weaponId] : null;
                const slotKeyLabel = slotNum === 1 ? kSlot1 : slotNum === 2 ? kSlot2 : kSlot3;
                if (!w || !def) {
                  return (
                    <div
                      key={slotNum}
                      className="relative flex items-center justify-center opacity-35"
                    >
                      <WeaponIcon
                        weaponId={slotNum === 3 ? 'g18' : 'm4a1'}
                        silhouette
                        className="w-8 h-4 opacity-40"
                      />
                      <span className="absolute top-0.5 left-1 text-[7px] font-mono text-white/60">
                        {slotKeyLabel}
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={slotNum}
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      input.triggerSlot(slotNum);
                    }}
                    className="touch-none relative flex items-center justify-center p-1 hover:bg-white/15 cursor-pointer"
                    title={`Slot ${slotNum}: ${def.name}`}
                  >
                    <WeaponIcon
                      weaponId={w.weaponId}
                      className="w-[90%] h-6 -rotate-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                    />
                    <span className="absolute bottom-0.5 left-1 text-[8px] font-mono font-black text-white/95 tabular-nums leading-none">
                      {w.ammoInMag + w.reserveAmmo}
                    </span>
                    <span className="absolute top-0.5 right-1 text-[7px] font-mono text-amber-300/90 leading-none">
                      {def.allowsCustomScope && w.scope !== 'none'
                        ? SCOPE_META[w.scope].short
                        : slotKeyLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Swap Button (⇄) + Compact Scope Switcher under weapon box */}
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {!hud.inVehicle && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  input.triggerQuickSwap();
                }}
                className="touch-none px-1.5 py-0.5 text-[8px] font-mono font-black border border-amber-400/70 bg-black/65 hover:bg-amber-400 hover:text-black text-amber-300 cursor-pointer"
                title={`Troca Rápida de Arma (${kQuickSwap})`}
              >
                ⇄ TROCA{!showTouchHud ? ` [${kQuickSwap}]` : ''}
              </button>
            )}
            {activeWeaponDef && activeWeaponSlot && activeWeaponDef.allowsCustomScope &&
              hud.ownedScopes.map((sc) => {
                const isEq = hud.activeScope === sc;
                return (
                  <button
                    key={sc}
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onSelectScope(sc);
                    }}
                    className={`touch-none px-1.5 py-0.5 text-[8px] font-mono border cursor-pointer ${
                      isEq
                        ? 'bg-amber-400 text-black border-amber-200 font-black'
                        : 'bg-black/55 text-white/80 border-white/25 hover:border-white/50'
                    }`}
                  >
                    {SCOPE_META[sc].short}
                  </button>
                );
              })}
          </div>

          {activeWeaponSlot &&
            (activeWeaponSlot.attachments.muzzle ||
              activeWeaponSlot.attachments.foregrip ||
              activeWeaponSlot.attachments.magazine ||
              activeWeaponSlot.attachments.stock) && (
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {activeWeaponSlot.attachments.muzzle && (
                  <span className="text-[7px] font-mono px-1 bg-black/60 border border-amber-400/50 text-amber-200">
                    {ATTACHMENT_LABELS[activeWeaponSlot.attachments.muzzle].short}
                  </span>
                )}
                {activeWeaponSlot.attachments.foregrip && (
                  <span className="text-[7px] font-mono px-1 bg-black/60 border border-amber-400/50 text-amber-200">
                    {ATTACHMENT_LABELS[activeWeaponSlot.attachments.foregrip].short}
                  </span>
                )}
                {activeWeaponSlot.attachments.magazine && (
                  <span className="text-[7px] font-mono px-1 bg-black/60 border border-amber-400/50 text-amber-200">
                    {ATTACHMENT_LABELS[activeWeaponSlot.attachments.magazine].short}
                  </span>
                )}
                {activeWeaponSlot.attachments.stock && (
                  <span className="text-[7px] font-mono px-1 bg-black/60 border border-amber-400/50 text-amber-200">
                    {ATTACHMENT_LABELS[activeWeaponSlot.attachments.stock].short}
                  </span>
                )}
              </div>
            )}
        </div>
      )}

      {/* DIRECTIONAL DAMAGE INDICATOR ARROWS */}
      {isGroundCombat && !hideGameplayHud && !isPaused && hud.damageIndicators.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          {hud.damageIndicators.map((di) => {
            const opacity = Math.max(0, 1 - di.age / 1.45);
            return (
              <div
                key={di.id}
                className="absolute w-40 h-40 flex items-start justify-center"
                style={{
                  opacity,
                  transform: `rotate(${di.angleRad}rad)`,
                }}
              >
                <svg
                  viewBox="0 0 36 22"
                  className="w-8 h-5 drop-shadow-[0_0_8px_rgba(239,68,68,0.95)]"
                >
                  <path
                    d="M18 1 L34 18 L18 12 L2 18 Z"
                    fill="#ef4444"
                    stroke="#7f1d1d"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            );
          })}
        </div>
      )}

      {/* CENTER CROSSHAIR (Compact & Semi-Transparent; also shown while spectating) */}
      {isGroundCombat && ((!hideGameplayHud && !hud.isPlayerDowned) || Boolean(hud.isSpectating)) && !isPaused && !showOpticalOverlay && !isBackpackOpen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            <div
              className={`border rounded-full flex items-center justify-center ${
                hud.aimLockedTarget
                  ? 'w-4 h-4 border-red-500/55 border-[1.2px]'
                  : hud.isAiming
                    ? 'w-3 h-3 border-amber-300/45'
                    : hud.isSprinting
                      ? 'w-5.5 h-5.5 border-white/20'
                      : 'w-3.5 h-3.5 border-white/30'
              }`}
            >
              <div
                className="absolute -top-1 w-[1px] h-1"
                style={{
                  backgroundColor: hud.aimLockedTarget
                    ? 'rgba(239,68,68,0.55)'
                    : 'rgba(255,255,255,0.28)',
                }}
              />
              <div
                className="absolute -bottom-1 w-[1px] h-1"
                style={{
                  backgroundColor: hud.aimLockedTarget
                    ? 'rgba(239,68,68,0.55)'
                    : 'rgba(255,255,255,0.28)',
                }}
              />
              <div
                className="absolute -left-1 h-[1px] w-1"
                style={{
                  backgroundColor: hud.aimLockedTarget
                    ? 'rgba(239,68,68,0.55)'
                    : 'rgba(255,255,255,0.28)',
                }}
              />
              <div
                className="absolute -right-1 h-[1px] w-1"
                style={{
                  backgroundColor: hud.aimLockedTarget
                    ? 'rgba(239,68,68,0.55)'
                    : 'rgba(255,255,255,0.28)',
                }}
              />
            </div>
            <div
              className={`absolute w-[2.5px] h-[2.5px] rounded-full ${
                hud.aimLockedTarget ? 'bg-red-500/55' : 'bg-white/42'
              }`}
            />
            {hud.hitmarkerActive && (
              <div
                className={`absolute w-6 h-6 flex items-center justify-center font-black ${
                  hud.headshotFlashActive ? 'text-amber-400 text-xl' : 'text-red-500 text-base'
                }`}
              >
                ✕
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Damage Numbers (Peito = Branco/Dourado, Capa = Vermelho Vivo estilo 4x) */}
      {isGroundCombat &&
        !isPaused &&
        (!hideGameplayHud || Boolean(hud.isSpectating)) &&
        hud.damagePopups.map((d) => {
          const opacity = Math.max(0, 1 - d.age / 0.78);
          const liftPx = d.age * 46;
          return (
            <div
              key={d.id}
              className="absolute z-20 pointer-events-none flex items-center gap-1 font-sans font-black leading-none tracking-tight"
              style={{
                left: `${d.xPct}%`,
                top: `${d.yPct}%`,
                opacity,
                transform: `translate(-50%, calc(-50% - ${liftPx}px))`,
                textShadow:
                  '0 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
              }}
            >
              <span
                className={
                  d.isHeadshot
                    ? 'text-[#ff1e1e] text-[22px] sm:text-[26px]'
                    : d.armorBlocked > 0
                      ? 'text-amber-300 text-[17px] sm:text-[19px]'
                      : 'text-white text-[17px] sm:text-[19px]'
                }
              >
                {d.amount}
              </span>
              {d.armorBlocked > 0 && (
                <span className="text-[9px] font-mono px-1 py-0.5 bg-black/80 border border-white/30 text-neutral-200">
                  {d.isHeadshot ? `K${d.armorBlocked}` : `C${d.armorBlocked}`}
                </span>
              )}
            </div>
          );
        })}

      {/* Classic Free Fire Knockdown / Kill Emblem Popup (Fixed Top-Center, non-customizable) */}
      {isGroundCombat &&
        !isPaused &&
        hud.combatIconPopup &&
        (() => {
          const pop = hud.combatIconPopup;
          const enterT = Math.min(1, pop.age / 0.14);
          const scale = 1.4 - 0.4 * (1 - Math.pow(1 - enterT, 3));
          const opacity = pop.age > 1.12 ? Math.max(0, 1 - (pop.age - 1.12) / 0.38) : 1;
          const isKnock = pop.kind === 'knockdown';
          return (
            <div
              key={pop.id}
              className="pointer-events-none absolute left-1/2 top-[18%] sm:top-[17.5%] z-25 flex flex-col items-center select-none"
              style={{
                opacity,
                transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
              }}
            >
              <img
                src={isKnock ? '/icons/knockdown-icon.png' : '/icons/kill-icon.png'}
                alt={isKnock ? 'Derrubou oponente' : 'Abate confirmado'}
                className={
                  isKnock
                    ? 'w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_4px_16px_rgba(245,158,11,0.75)]'
                    : 'w-22 h-22 sm:w-26 sm:h-26 object-contain drop-shadow-[0_4px_20px_rgba(239,68,68,0.85)]'
                }
              />
              <div
                className={`-mt-1 flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${
                  isKnock ? 'text-amber-300' : 'text-red-400'
                }`}
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.78) 20%, rgba(0,0,0,0.78) 80%, transparent 100%)',
                  textShadow: '0 1px 3px #000',
                }}
              >
                <span>{isKnock ? 'DERRUBOU' : 'ABATE'}</span>
                <span className="text-white">{pop.victimName}</span>
                {pop.isHeadshot && (
                  <span className="text-[9px] px-1 bg-red-600/90 text-white font-mono">
                    CAPA
                  </span>
                )}
              </div>
            </div>
          );
        })()}

      {/* CUSTOMIZABLE Tactical Gloo Wall / Grenade Active Mode Banner */}
      {isGroundCombat && !hideGameplayHud && !hud.isPlayerDowned && !isPaused && (hud.isPlacingGloo || hud.isHoldingGrenade) && (
        <div
          style={layoutStyle(hudLayout.tacticalBanner)}
          className={`absolute z-20 pointer-events-none whitespace-nowrap px-3 py-1 border font-mono font-bold text-[10px] uppercase tracking-wider ${
            hud.isPlacingGloo
              ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200'
              : 'bg-red-950/90 border-red-400 text-red-200'
          }`}
        >
          {hud.isPlacingGloo
            ? `GELO ${hud.glooSkin === 'ffwc' ? 'CUP 2019' : 'CLÁSSICO'} (${hud.glooPlaceDistance}m): CLIQUE OU BOTÃO`
            : 'GRANADA: CLIQUE OU BOTÃO PARA ARREMESSAR'}
        </div>
      )}

      {/* AIRPLANE / DROPPING / WINDOW VAULT / MEDKIT / LOOT / REVIVE ACTION PROMPTS (customizable) */}
      {!hideGameplayHud && (
      <div
        style={layoutStyle(hudLayout.actionPrompt)}
        className="pointer-events-none absolute z-20 flex flex-col items-center gap-1.5 w-[320px] max-w-[92vw]"
      >
        {hud.showFollowLeaderToggle && onToggleFollowLeader && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleFollowLeader();
            }}
            className={`pointer-events-auto touch-none px-4 py-2 border-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xl cursor-pointer transition-colors ${
              hud.isFollowingLeader
                ? 'bg-emerald-600/95 hover:bg-emerald-500 border-emerald-200 text-white'
                : 'bg-black/85 hover:bg-neutral-900 border-white/40 text-neutral-200'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>
              {hud.isFollowingLeader
                ? `SEGUINDO LÍDER (${hud.leaderNick ?? 'LÍDER'}) · DESATIVAR`
                : `SEGUIR LÍDER (${hud.leaderNick ?? 'LÍDER'}) · ATIVAR`}
            </span>
          </button>
        )}

        {hud.canJumpFromPlane && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onJumpFromPlane();
              }}
              className="pointer-events-auto touch-none px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-sm uppercase tracking-widest border-b-4 border-amber-700 shadow-xl cursor-pointer"
            >
              SALTAR DO AVIÃO ({kJump})
            </button>
          )}

          {hud.canOpenParachute && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenParachute();
              }}
              className="pointer-events-auto touch-none px-6 py-3 bg-sky-500 hover:bg-sky-400 text-black font-black text-sm uppercase tracking-widest border-b-4 border-sky-700 shadow-xl cursor-pointer"
            >
              ABRIR PARAQUEDAS ({kJump})
            </button>
          )}

        {isGroundCombat && !hud.isDead && !isPaused && hud.isPlayerDowned && (
          <div className="pointer-events-none flex flex-col items-center gap-1.5 w-72 max-w-[88vw]">
            <div className="w-full bg-red-950/92 border-2 border-red-500 px-3 py-2 shadow-2xl">
              <div className="flex items-center justify-between text-[10px] font-mono font-black text-red-200 uppercase tracking-wider mb-1 gap-2">
                <span className="animate-pulse truncate">
                  VOCÊ FOI DERRUBADO! AGUARDANDO RESGATE...
                </span>
                <span className="tabular-nums text-white shrink-0">
                  {Math.max(0, Math.ceil(hud.playerBleedHp))}/100
                </span>
              </div>
              <div className="w-full h-2 bg-black/75 overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-[width] duration-75"
                  style={{ width: `${Math.max(0, Math.min(100, hud.playerBleedHp))}%` }}
                />
              </div>
            </div>

            {hud.revivedBy && (
              <div className="w-full bg-emerald-950/92 border border-emerald-400 px-3 py-1.5 shadow-xl">
                <div className="flex items-center justify-between text-[10px] font-mono font-black text-emerald-200 uppercase mb-1 gap-2">
                  <span className="truncate">
                    #{hud.revivedBy.slotNumber} {hud.revivedBy.nick} SALVANDO VOCÊ...
                  </span>
                  <span className="tabular-nums shrink-0">
                    {Math.round(hud.revivedBy.progress * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-black/75 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-[width] duration-75"
                    style={{
                      width: `${Math.round(Math.max(0, Math.min(1, hud.revivedBy.progress)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isGroundCombat && !hud.isPlayerDowned && hud.reviveProgress > 0 && hud.reviveTarget && (
          <div className="w-60 bg-black/85 border border-emerald-400 px-3 py-1.5 shadow-xl">
            <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300 mb-1">
              <span>
                SALVANDO #{hud.reviveTarget.slotNumber} {hud.reviveTarget.nick}...
              </span>
              <span>{Math.round(hud.reviveProgress * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800">
              <div
                className="h-full bg-emerald-400 transition-[width] duration-75"
                style={{ width: `${Math.round(hud.reviveProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {isGroundCombat && !hud.isPlayerDowned && hud.reviveTarget && hud.reviveProgress <= 0 && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              input.triggerRevive();
            }}
            className="pointer-events-auto touch-none flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 border-2 border-white text-black font-black text-xs uppercase tracking-wider shadow-2xl cursor-pointer animate-pulse"
          >
            <HeartPulse className="w-4 h-4 stroke-[2.6]" />
            <span>
              SALVAR #{hud.reviveTarget.slotNumber} {hud.reviveTarget.nick} ({kRevive})
            </span>
          </button>
        )}

        {isGroundCombat && !hud.isPlayerDowned && hud.usingMedkit && (
          <div className="w-56 bg-black/80 border border-emerald-400 px-3 py-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300 mb-1">
              <span>USANDO KIT MÉDICO...</span>
              <span>{Math.round(hud.medkitProgress * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800">
              <div
                className="h-full bg-emerald-400 transition-[width] duration-75"
                style={{ width: `${Math.round(hud.medkitProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {isGroundCombat && !hud.isPlayerDowned && hud.nearbyVending && !hud.inVehicle && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenVending();
            }}
            className="pointer-events-auto touch-none flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 border-2 border-white text-black font-black text-xs uppercase tracking-wider shadow-xl cursor-pointer whitespace-nowrap"
          >
            <IconVendingSvg className="w-4 h-4 shrink-0" />
            <span>[{kInteract}] ABRIR LOJINHA</span>
          </button>
        )}

        {isGroundCombat && !hud.isPlayerDowned && hud.nearbyVehicle && !hud.inVehicle && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleVehicle();
            }}
            className="pointer-events-auto touch-none flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 border-2 border-white text-black font-black text-xs uppercase tracking-wider shadow-xl cursor-pointer whitespace-nowrap"
          >
            <IconVehicleSvg className="w-4 h-4 shrink-0" />
            <span>[{kInteract}] DIRIGIR {hud.nearbyVehicle.name}</span>
          </button>
        )}

        {isGroundCombat && hud.inVehicle && (
          <div className="pointer-events-auto flex flex-col items-center gap-1.5 bg-black/82 border border-amber-400/70 px-3.5 py-2 shadow-2xl w-64">
            <div className="w-full flex items-center justify-between text-[11px] font-black uppercase">
              <span className="flex items-center gap-1.5 text-amber-300">
                <IconVehicleSvg className="w-4 h-4 shrink-0" />
                <span>{hud.inVehicle.name}</span>
              </span>
              <span className="font-mono text-white tabular-nums">
                {hud.inVehicle.speedKmh} km/h
              </span>
            </div>
            <div className="w-full flex items-center gap-2">
              <div className="flex-1 h-2 bg-neutral-800 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    hud.inVehicle.isBurning ? 'bg-red-500' : 'bg-emerald-400'
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, (hud.inVehicle.hp / hud.inVehicle.maxHp) * 100))}%`,
                  }}
                />
              </div>
              <span className="text-[9px] font-mono text-neutral-300 tabular-nums">
                {Math.ceil(hud.inVehicle.hp)}/{hud.inVehicle.maxHp}
              </span>
            </div>
            <div className="w-full flex items-center justify-between text-[10px] font-mono">
              <span
                className={
                  hud.inVehicle.isBurning
                    ? 'text-red-400 font-black'
                    : hud.inVehicle.isDriver === false
                      ? 'text-cyan-300 font-bold'
                      : 'text-neutral-400'
                }
              >
                {hud.inVehicle.isBurning
                  ? 'CARRO EM CHAMAS!'
                  : hud.inVehicle.isDriver === false
                    ? `PASSAGEIRO · ${hud.inVehicle.passengerCount} a bordo`
                    : `${hud.inVehicle.passengerCount} a bordo`}
              </span>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleVehicle();
                }}
                className="touch-none px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-black uppercase cursor-pointer"
              >
                SAIR [{kInteract}]
              </button>
            </div>
          </div>
        )}

        {isGroundCombat && (hud.isPlacingGloo || hud.isHoldingGrenade) && (
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  input.triggerFireTap();
                }}
                className={`touch-none px-4 py-2 font-black text-xs uppercase tracking-wider border-2 shadow-xl cursor-pointer ${
                  hud.isPlacingGloo
                    ? 'bg-cyan-400 hover:bg-cyan-300 text-black border-white'
                    : 'bg-red-500 hover:bg-red-400 text-white border-amber-300'
                }`}
              >
                {hud.isPlacingGloo ? `BOTAR GELO (${hud.glooPlaceDistance}m)` : 'ARREMESSAR GRANADA'}
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (hud.isPlacingGloo) input.triggerGloo();
                  else input.triggerGrenade();
                }}
                className="touch-none px-3 py-2 bg-black/85 hover:bg-neutral-800 border border-neutral-400 text-neutral-200 font-bold text-xs uppercase cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
            {hud.isPlacingGloo && onSelectGlooSkin && (
              <div className="flex items-center gap-1 bg-black/85 border border-white/25 p-0.5 text-[10px] font-black uppercase">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSelectGlooSkin('classic');
                  }}
                  className={`touch-none px-2.5 py-1 cursor-pointer ${
                    hud.glooSkin === 'classic'
                      ? 'bg-cyan-400 text-black'
                      : 'text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  CLÁSSICO
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSelectGlooSkin('ffwc');
                  }}
                  className={`touch-none px-2.5 py-1 cursor-pointer ${
                    hud.glooSkin === 'ffwc'
                      ? 'bg-amber-400 text-black'
                      : 'text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  CUP 2019
                </button>
              </div>
            )}
          </div>
        )}

        {isGroundCombat &&
          !hud.isDead &&
          !hud.isPlayerDowned &&
          !hud.inVehicle &&
          !isPaused &&
          (hud.inWater || hud.isOnSurfboard) && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                input.triggerSurfboard();
              }}
              className={`pointer-events-auto touch-none flex items-center gap-2 px-4 py-2 border-2 font-black text-xs uppercase tracking-wider shadow-xl cursor-pointer whitespace-nowrap ${
                hud.isOnSurfboard
                  ? 'bg-cyan-400 hover:bg-cyan-300 border-white text-black'
                  : 'bg-sky-900/90 hover:bg-sky-800 border-cyan-400 text-cyan-100'
              }`}
            >
              <IconSurfboardSvg className="w-5 h-5 shrink-0" />
              <span>
                {hud.isOnSurfboard ? `GUARDAR PRANCHA [${kSurfboard}]` : `USAR PRANCHA [${kSurfboard}]`}
              </span>
            </button>
          )}

        {!showTouchHud && !isPaused && !isBackpackOpen && hud.mouseResetNotice && (
          <div className="bg-cyan-950/92 border border-cyan-400 px-3 py-1 text-[10px] font-mono font-black text-cyan-200 uppercase tracking-wider shadow-lg">
            MOUSE REINICIADO · CÂMERA CENTRALIZADA
          </div>
        )}

        {!showTouchHud && !isPaused && !isBackpackOpen && hud.mouseSuspended && (
          <div className="pointer-events-auto flex items-center gap-1.5 bg-amber-950/90 border border-amber-400 px-2.5 py-1 shadow-xl">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                input.resumeCameraFromCursor();
              }}
              className="text-[10px] font-mono font-black text-amber-200 hover:text-white uppercase cursor-pointer"
            >
              CURSOR LIVRE · CLIQUE AQUI OU [{kToggleMouse}] P/ VOLTAR CÂMERA
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                input.resetMouse();
              }}
              className="px-1.5 py-0.5 bg-cyan-500 hover:bg-cyan-400 text-black text-[9px] font-mono font-black uppercase cursor-pointer"
              title={`Resetar / Reiniciar Mouse (${kResetMouse})`}
            >
              RESET [{kResetMouse}]
            </button>
          </div>
        )}

        {isGroundCombat && !hud.pointerLocked && !hud.mouseSuspended && !showTouchHud && !isPaused && !isBackpackOpen && (
          <div className="bg-black/60 border border-white/15 px-2.5 py-0.5 text-[9px] font-mono text-white/85 text-center">
            {emulatorMode ? 'EMULADOR · ' : ''}
            {kQuickSwap} TROCA · {kCrouch} AGACHA · {kProne} DEITA · {kReload} RECAR · {kGloo} GELO · {kGrenade} GRANADA · {kMedkit} KIT · {kBackpack} MOCHILA · {kToggleMouse} CURSOR · {kResetMouse} RESET MOUSE
          </div>
        )}
      </div>
      )}

      {/* CUSTOMIZABLE SLEEK FREE FIRE BOTTOM-CENTER HP / ARMOR BAR */}
      {!hideGameplayHud && (
      <div
        style={layoutStyle(hudLayout.hpBar)}
        className="absolute z-20 flex items-end gap-2.5 w-[270px] sm:w-[320px] max-w-[82vw]"
      >
        {/* Helmet & Vest Level Indicators */}
        {isGroundCombat && (
          <div className="flex items-center gap-1 pb-0.5 shrink-0">
            <div
              className={`flex items-center gap-0.5 ${
                hud.helmetLevel > 0 ? 'text-amber-300' : 'text-white/30'
              }`}
              title={`Capacete Nv.${hud.helmetLevel}`}
            >
              <IconHelmetSvg className="w-4 h-4 drop-shadow" />
              {hud.helmetLevel > 0 && (
                <span className="text-[8px] font-mono font-black">{hud.helmetLevel}</span>
              )}
            </div>
            <div
              className={`flex items-center gap-0.5 ${
                hud.vestLevel > 0 ? 'text-amber-300' : 'text-white/30'
              }`}
              title={`Colete Nv.${hud.vestLevel}`}
            >
              <IconVestSvg className="w-4 h-4 drop-shadow" />
              {hud.vestLevel > 0 && (
                <span className="text-[8px] font-mono font-black">{hud.vestLevel}</span>
              )}
            </div>
          </div>
        )}

        {/* Dual Sleek Progress Stack (Colete Amber + White HP Bar) */}
        <div className="flex-1 flex flex-col gap-0.5">
          {/* Colete / Armor Bar */}
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] font-mono font-bold text-amber-300 tabular-nums shrink-0"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
            >
              {hud.vestLevel > 0 ? `COLETE ${hud.vestHp}/${hud.vestMaxHp}` : 'COLETE 0/0'}
            </span>
            <div className="flex-1 h-1.5 bg-black/55 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-[width] duration-150"
                style={{ width: `${armorPct}%` }}
              />
            </div>
          </div>

          {/* White Health Bar */}
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-mono font-black text-white tabular-nums shrink-0"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
            >
              HP {hud.hp}/{hud.maxHp}
            </span>
            <div className="flex-1 h-2.5 bg-black/60 overflow-hidden shadow">
              <div
                className={`h-full transition-[width] duration-150 ${
                  hpPct > 40 ? 'bg-white' : 'bg-red-500'
                }`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* CUSTOMIZABLE QUICK GLOO BUTTON (formerly beside HP bar) */}
      {!hideGameplayHud && isGroundCombat && !hud.isPlayerDowned && !hud.isSwimming && !hud.inVehicle && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (ggMousePro?.instantQuickGloo !== false) {
              input.triggerQuickGlooInstant();
            } else {
              input.triggerGloo();
            }
          }}
          disabled={hud.glooCount <= 0}
          style={layoutStyle(hudLayout.quickGlooBtn)}
          className={`pointer-events-auto touch-none absolute z-20 w-8 h-8 rounded-full border flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 shadow ${
            hud.isPlacingGloo
              ? 'bg-cyan-400 border-white text-black'
              : 'bg-black/55 border-white/40 text-white'
          }`}
          title="Parede de Gelo Rápido (G)"
        >
          <IconGlooSvg className="w-4 h-4" />
          <span className="absolute -bottom-1 -right-1 text-[8px] font-mono font-black bg-black/80 px-1 rounded-full">
            {hud.glooCount}
          </span>
        </button>
      )}

      {/* CUSTOMIZABLE FREE FIRE LOOT STRIP / INDIVIDUAL DEATHBOX LIST */}
      {isGroundCombat &&
        !hideGameplayHud &&
        !hud.isPlayerDowned &&
        !isPaused &&
        !isBackpackOpen &&
        !hud.inVehicle &&
        hud.nearbyLoots.length > 0 && (() => {
          const boxOwner = hud.nearbyLoots.find((s) => s.boxOwnerNick)?.boxOwnerNick;
          const visibleLoots = hud.nearbyLoots.slice(0, 8);
          return (
            <div
              style={layoutStyle(hudLayout.lootList)}
              className="pointer-events-auto absolute z-20 flex flex-col items-center gap-1 w-[240px] sm:w-[360px] max-w-[90vw]"
            >
              {boxOwner && (
                <div className="bg-black/82 border border-amber-400/80 px-2.5 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider text-amber-300 shadow">
                  CAIXA DE {boxOwner}
                </div>
              )}
              <div className="flex flex-row-reverse flex-wrap justify-start gap-1.5 max-h-[190px] overflow-y-auto pr-0.5">
                {visibleLoots.map((slot, idx) => {
                  const renderSlotIcon = () => {
                    if (slot.weaponId) {
                      return (
                        <WeaponIcon
                          weaponId={slot.weaponId}
                          className="w-14 h-8 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                        />
                      );
                    }
                    if (slot.kind === 'ammo') {
                      const lbl = slot.label.toLowerCase();
                      const ammoImg = lbl.includes('awm')
                        ? '/icons/rifle.png'
                        : lbl.includes('sg') || lbl.includes('doze') || lbl.includes('12')
                          ? '/icons/doze.png'
                          : lbl.includes('smg')
                            ? '/icons/smg.png'
                            : '/icons/ar.png';
                      return (
                        <img
                          src={ammoImg}
                          alt={slot.label}
                          className="w-8 h-8 object-contain shrink-0 drop-shadow"
                        />
                      );
                    }
                    if (slot.kind === 'coin') {
                      return (
                        <img
                          src="/icons/moedas.png"
                          alt="Moedas FF"
                          className="w-7 h-7 object-contain shrink-0 drop-shadow"
                        />
                      );
                    }
                    if (slot.kind === 'medkit') {
                      return (
                        <img
                          src="/icons/kit-grande.png"
                          alt="Kit Médico"
                          className="w-8 h-8 object-contain shrink-0 drop-shadow"
                        />
                      );
                    }
                    if (slot.kind === 'smallkit') {
                      return (
                        <img
                          src="/icons/kit.png"
                          alt="Kit Pequeno"
                          className="w-7 h-7 object-contain shrink-0 drop-shadow"
                        />
                      );
                    }
                    if (slot.kind === 'gloo') {
                      return <IconGlooSvg className="w-7 h-7 text-cyan-300 shrink-0" />;
                    }
                    if (slot.kind === 'grenade') {
                      return <IconGrenadeSvg className="w-7 h-7 text-red-400 shrink-0" />;
                    }
                    if (slot.kind === 'vest') {
                      return <IconVestSvg className="w-7 h-7 text-sky-300 shrink-0" />;
                    }
                    if (slot.kind === 'helmet') {
                      return <IconHelmetSvg className="w-7 h-7 text-sky-300 shrink-0" />;
                    }
                    if (slot.kind === 'backpack') {
                      const lv = slot.level ?? 1;
                      return (
                        <img
                          src={`/icons/mochila-nv${lv}.png`}
                          alt={`Mochila Nv${lv}`}
                          className="w-8 h-8 object-contain shrink-0 drop-shadow"
                        />
                      );
                    }
                    if (slot.kind === 'scope') {
                      if (slot.scopeType === '2x') {
                        return <img src="/icons/mira-2x.png" alt="Mira 2x" className="w-7 h-7 object-contain shrink-0" />;
                      }
                      if (slot.scopeType === '4x') {
                        return <img src="/icons/mira-4x.png" alt="Mira 4x" className="w-7 h-7 object-contain shrink-0" />;
                      }
                      return <IconScopeSvg className="w-7 h-7 text-emerald-300 shrink-0" />;
                    }
                    if (slot.kind === 'attachment') {
                      return <Wrench className="w-6 h-6 text-amber-300 shrink-0" />;
                    }
                    if (slot.kind === 'airdrop') {
                      return <Trophy className="w-7 h-7 text-amber-400 shrink-0" />;
                    }
                    return <IconBackpackSvg className="w-6 h-6 text-emerald-300 shrink-0" />;
                  };

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onCollectLoot(slot.id);
                      }}
                      className={`relative w-[74px] h-[76px] sm:w-[82px] sm:h-[84px] flex flex-col items-center justify-between p-1.5 border shadow-lg cursor-pointer transition-colors ${
                        idx === 0
                          ? 'bg-black/72 hover:bg-amber-500/25 border-amber-400/90 text-white'
                          : slot.boxOwnerNick
                            ? 'bg-black/68 hover:bg-amber-500/20 border-amber-300/45 text-neutral-100'
                            : 'bg-black/58 hover:bg-black/78 border-white/30 text-neutral-100'
                      }`}
                    >
                      {/* Top row: [E] badge left + Quantity / level right */}
                      <div className="w-full flex items-center justify-between leading-none">
                        {idx === 0 ? (
                          <span className="px-1 py-0.5 bg-amber-400 text-black text-[8px] font-black font-mono">
                            {kInteract}
                          </span>
                        ) : slot.boxOwnerNick ? (
                          <span className="px-1 py-0.5 bg-amber-950/90 border border-amber-400/50 text-amber-200 text-[7px] font-black font-mono">
                            CX
                          </span>
                        ) : (
                          <span />
                        )}
                        {slot.subLabel && (
                          <span className="text-[9px] font-mono font-bold text-white/90">
                            {slot.subLabel.replace('+', '')}
                          </span>
                        )}
                      </div>

                      {/* Center item graphic */}
                      <div className="flex-1 flex items-center justify-center">
                        {renderSlotIcon()}
                      </div>

                      {/* Bottom item name */}
                      <div className="w-full text-[8px] sm:text-[9px] font-sans font-medium leading-[1.1] text-center text-white/95 line-clamp-2">
                        {slot.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

      {/* CUSTOMIZABLE MOBILE VEHICLE TOUCH PEDALS & STEERING WHEN DRIVING */}
      {showTouchHud &&
        isGroundCombat &&
        !hideGameplayHud &&
        !isPaused &&
        hud.inVehicle &&
        hud.inVehicle.isDriver !== false && (
        <>
          <div
            style={layoutStyle(hudLayout.vehicleSteer)}
            className="pointer-events-auto absolute z-20 flex items-center gap-2 w-max"
          >
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setVehAxis('x', -1);
              }}
              onPointerUp={() => setVehAxis('x', 0)}
              onPointerCancel={() => setVehAxis('x', 0)}
              className="touch-none w-14 h-14 bg-black/65 border-2 border-white/60 text-white font-black text-lg cursor-pointer active:bg-amber-500 active:text-black"
            >
              ◀
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setVehAxis('x', 1);
              }}
              onPointerUp={() => setVehAxis('x', 0)}
              onPointerCancel={() => setVehAxis('x', 0)}
              className="touch-none w-14 h-14 bg-black/65 border-2 border-white/60 text-white font-black text-lg cursor-pointer active:bg-amber-500 active:text-black"
            >
              ▶
            </button>
          </div>
          <div
            style={layoutStyle(hudLayout.vehiclePedals)}
            className="pointer-events-auto absolute z-20 flex items-center gap-2 w-max"
          >
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setVehAxis('y', 1);
              }}
              onPointerUp={() => setVehAxis('y', 0)}
              onPointerCancel={() => setVehAxis('y', 0)}
              className="touch-none px-4 h-14 bg-red-900/75 border-2 border-red-400 text-white font-black text-xs uppercase cursor-pointer active:bg-red-500"
            >
              RÉ
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setVehAxis('y', -1);
              }}
              onPointerUp={() => setVehAxis('y', 0)}
              onPointerCancel={() => setVehAxis('y', 0)}
              className="touch-none px-4 h-14 bg-emerald-700/80 border-2 border-emerald-300 text-white font-black text-xs uppercase cursor-pointer active:bg-emerald-500"
            >
              ACELERAR
            </button>
          </div>
        </>
      )}

      {/* DEDICATED WINDOW VAULT BUTTON ABOVE JUMP (available on Mobile & Desktop when near a window) */}
      {isGroundCombat &&
        !hideGameplayHud &&
        !hud.isPlayerDowned &&
        !isPaused &&
        !hud.inVehicle &&
        !hud.isSwimming &&
        hud.canVaultWindow && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              input.triggerVault();
            }}
            style={layoutStyle(hudLayout.vaultBtn)}
            title={`Pular Janela (${kJump})`}
            className="pointer-events-auto touch-none absolute z-20 w-12 h-12 rounded-full bg-sky-500/85 hover:bg-sky-400 active:scale-95 border-2 border-white text-white flex flex-col items-center justify-center shadow-[0_0_16px_rgba(56,189,248,0.65)] cursor-pointer"
          >
            <IconVaultSvg className="w-6 h-6 drop-shadow" />
            <span className="text-[7px] font-black uppercase leading-none -mt-0.5 tracking-tight drop-shadow">
              JANELA
            </span>
          </button>
        )}

      {/* CUSTOMIZABLE MOBILE VIRTUAL JOYSTICK, SPRINT, LEFT-FIRE & RIGHT BUTTON CLUSTER */}
      {showTouchHud && (isGroundCombat || isAirborneDrop) && !hideGameplayHud && !isPaused && !hud.inVehicle && (
        <>
          {/* Left Virtual Joystick (usable on ground, while downed, and while skydiving/parachuting) */}
          <div
            onTouchStart={handleJoyStart}
            onTouchMove={handleJoyMove}
            onTouchEnd={handleJoyEnd}
            onTouchCancel={handleJoyEnd}
            style={layoutStyle(hudLayout.joystick)}
            className="pointer-events-auto absolute z-20 w-28 h-28 rounded-full border-2 border-white/35 bg-black/25 flex items-center justify-center touch-none"
          >
            <div
              className="w-11 h-11 rounded-full bg-white/55 border border-white/80 shadow"
              style={{
                transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
              }}
            />
          </div>

          {((isGroundCombat && !hud.isPlayerDowned) || isAirborneDrop) && (
            <>
              {/* Sprint Toggle (active on ground and during skydive/parachute) */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const next = !autoSprintActive;
                  setAutoSprintActive(next);
                  input.setTouchAutoSprint(next);
                }}
                style={layoutStyle(hudLayout.sprintBtn)}
                className={`pointer-events-auto touch-none absolute z-20 w-11 h-11 rounded-full border-2 flex items-center justify-center shadow-lg cursor-pointer ${
                  autoSprintActive || hud.isSprinting
                    ? 'bg-white/85 border-white text-black'
                    : 'bg-black/45 border-white/55 text-white'
                }`}
                title="Correr Automático"
              >
                <IconSprintSvg className="w-6 h-6" />
              </button>
            </>
          )}

          {isGroundCombat && !hud.isPlayerDowned && (
            <>
              {/* Jump / Swim-Climb Button (always active on ground, water & surfboard) */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  input.triggerJump();
                }}
                style={layoutStyle(hudLayout.jumpBtn)}
                className="pointer-events-auto touch-none absolute z-20 w-12 h-12 rounded-full bg-black/45 border-[1.5px] border-white/55 text-white flex items-center justify-center shadow cursor-pointer active:bg-white/25"
              >
                <IconJumpSvg className="w-6 h-6" />
              </button>

              {/* Combat Controls: disabled only while free-swimming; fully enabled on ground & surfboard */}
              {!hud.isSwimming && (
                <>
                  {/* Left Fire Button (hidden only when prone with fists & no grenade/gloo) */}
                  {!(
                    hud.stance === 'prone' &&
                    hud.activeSlot === 4 &&
                    !hud.isPlacingGloo &&
                    !hud.isHoldingGrenade
                  ) && (
                    <button
                      type="button"
                      onContextMenu={(e) => e.preventDefault()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onTouchCancel={(e) => e.stopPropagation()}
                      onPointerDown={(e) => beginFirePointer(e, false)}
                      onPointerUp={(e) => endFirePointer(e, false)}
                      onPointerCancel={(e) => endFirePointer(e, false)}
                      style={layoutStyle(hudLayout.leftFireBtn)}
                      className="pointer-events-auto touch-none absolute z-[25] w-12 h-12 rounded-full bg-black/45 active:bg-white/30 border-[1.5px] border-white/60 flex items-center justify-center text-white shadow-lg cursor-pointer"
                      title="Atirar Esquerdo"
                    >
                      <IconFireBurstSvg className="w-7 h-7 text-white" />
                    </button>
                  )}

                  {/* Prone Button */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      input.triggerProne();
                    }}
                    style={layoutStyle(hudLayout.proneBtn)}
                    className={`pointer-events-auto touch-none absolute z-20 w-12 h-12 rounded-full border-[1.5px] flex items-center justify-center shadow cursor-pointer ${
                      hud.stance === 'prone'
                        ? 'bg-amber-400/90 text-black border-white'
                        : 'bg-black/45 text-white border-white/55'
                    }`}
                  >
                    <IconProneSvg className="w-6 h-6" />
                  </button>

                  {/* Crouch Button (Single tap, zero bounce) */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      input.triggerCrouch();
                    }}
                    style={layoutStyle(hudLayout.crouchBtn)}
                    className={`pointer-events-auto touch-none absolute z-20 w-12 h-12 rounded-full border-[1.5px] flex items-center justify-center shadow cursor-pointer ${
                      hud.stance === 'crouch'
                        ? 'bg-amber-400/90 text-black border-white'
                        : 'bg-black/45 text-white border-white/55'
                    }`}
                  >
                    <IconCrouchSvg className="w-6 h-6" />
                  </button>

                  {/* Reload Button */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      input.triggerReload();
                    }}
                    style={layoutStyle(hudLayout.reloadBtn)}
                    className="pointer-events-auto touch-none absolute z-20 w-11 h-11 rounded-full bg-black/45 border-[1.5px] border-white/55 text-white flex items-center justify-center shadow cursor-pointer active:bg-white/25"
                  >
                    <IconReloadSvg className="w-5 h-5" />
                  </button>

                  {/* Scope / Aim Button (hidden on fists and pistols) */}
                  {canAimWeapon && (
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        input.setTouchAim(!hud.isAiming);
                      }}
                      style={layoutStyle(hudLayout.aimBtn)}
                      className={`pointer-events-auto touch-none absolute z-20 w-12 h-12 rounded-full border-[1.5px] flex items-center justify-center shadow cursor-pointer ${
                        hud.isAiming
                          ? 'bg-amber-400/90 text-black border-white'
                          : 'bg-black/45 text-white border-white/55'
                      }`}
                    >
                      <IconScopeSvg className="w-6 h-6" />
                    </button>
                  )}

                  {/* Primary Right Fire Button (hidden only when prone with fists & no grenade/gloo) */}
                  {!(
                    hud.stance === 'prone' &&
                    hud.activeSlot === 4 &&
                    !hud.isPlacingGloo &&
                    !hud.isHoldingGrenade
                  ) && (
                    <div
                      role="button"
                      aria-label="Atirar e Subir Capa"
                      onContextMenu={(e) => e.preventDefault()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onTouchCancel={(e) => e.stopPropagation()}
                      onPointerDown={(e) => beginFirePointer(e, true)}
                      onPointerUp={(e) => endFirePointer(e, true)}
                      onPointerCancel={(e) => endFirePointer(e, true)}
                      style={layoutStyle(hudLayout.fireBtn)}
                      className={`pointer-events-auto touch-none absolute z-[25] w-28 h-28 rounded-full border-2 flex items-center justify-center cursor-pointer ${
                        isFirePressed
                          ? 'border-amber-300/80 bg-amber-400/10'
                          : 'border-white/25 bg-black/15'
                      }`}
                    >
                      <div
                        className={`w-16 h-16 rounded-full border-2 flex items-center justify-center text-white shadow-xl pointer-events-none ${
                          isFirePressed
                            ? 'bg-white/30 border-amber-200 ring-4 ring-amber-400/35'
                            : 'bg-black/50 border-white/80 ring-4 ring-white/10'
                        }`}
                        style={{
                          transform: `translate(${fireKnob.x}px, ${fireKnob.y}px)`,
                        }}
                      >
                        <IconFireBurstSvg className="w-9 h-9 text-white drop-shadow" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* FLOATING EMOJI MACRO BUTTONS (Android / Touch / Clickable HUD buttons) */}
      {isGroundCombat &&
        !hideGameplayHud &&
        !isPaused &&
        !hud.isPlayerDowned &&
        !hud.isSwimming &&
        !hud.inVehicle &&
        macros
          .filter((m) => m.enabled && m.showFloatingBtn)
          .map((macro) => (
            <button
              key={macro.id}
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                input.executeMacro(macro.id);
              }}
              style={{
                left: `${macro.xPct}%`,
                top: `${macro.yPct}%`,
                opacity: macro.opacity,
                transform: `translate(-50%, -50%) scale(${macro.scale})`,
              }}
              title={macro.name}
              className="pointer-events-auto touch-none select-none absolute z-20 w-12 h-12 rounded-full bg-black/60 active:bg-amber-400/85 active:scale-90 border-2 border-amber-400/85 flex items-center justify-center shadow-lg cursor-pointer"
            >
              <span className="text-xl leading-none pointer-events-none">{macro.emoji}</span>
              {macro.triggerKey && (
                <span className="absolute -bottom-1.5 px-1 bg-black/90 border border-amber-400/60 text-amber-300 text-[8px] font-mono font-black rounded-sm pointer-events-none">
                  {formatKeyCodeLabel(macro.triggerKey)}
                </span>
              )}
            </button>
          ))}

      {/* GG MOUSE PRO ON-SCREEN KEY BADGES (Non-blocking pointer-events-none overlay) */}
      {ggMousePro?.enabled &&
        ggMousePro.showKeyBadges &&
        isGroundCombat &&
        !hideGameplayHud &&
        !isPaused &&
        !hud.isPlayerDowned && (
          <div className="pointer-events-none select-none fixed inset-0 z-20">
            {(Object.keys(GG_PIN_META) as GgKeyPinId[]).map((pinId) => {
              const meta = GG_PIN_META[pinId];
              const pin = ggMousePro.pins?.[pinId] ?? DEFAULT_GG_MOUSE_PRO.pins[pinId];
              if (!pin || !pin.visible) return null;

              if (meta.kind === 'wasd') {
                return (
                  <div
                    key={pinId}
                    style={{
                      left: `${pin.xPct}%`,
                      top: `${pin.yPct}%`,
                      opacity: ggMousePro.badgeOpacity,
                      transform: `translate(-50%, -50%) scale(${pin.scale})`,
                    }}
                    className="absolute w-24 h-24 rounded-full border border-cyan-400/50 bg-black/25 flex items-center justify-center"
                  >
                    <span className="absolute top-1 text-[9px] font-mono font-black text-cyan-200 bg-black/75 px-1 rounded-sm">
                      {formatKeyCodeLabel(kb.moveForward)}
                    </span>
                    <span className="absolute bottom-1 text-[9px] font-mono font-black text-cyan-200 bg-black/75 px-1 rounded-sm">
                      {formatKeyCodeLabel(kb.moveBackward)}
                    </span>
                    <span className="absolute left-1 text-[9px] font-mono font-black text-cyan-200 bg-black/75 px-1 rounded-sm">
                      {formatKeyCodeLabel(kb.moveLeft)}
                    </span>
                    <span className="absolute right-1 text-[9px] font-mono font-black text-cyan-200 bg-black/75 px-1 rounded-sm">
                      {formatKeyCodeLabel(kb.moveRight)}
                    </span>
                  </div>
                );
              }

              if (meta.kind === 'look') {
                return (
                  <div
                    key={pinId}
                    style={{
                      left: `${pin.xPct}%`,
                      top: `${pin.yPct}%`,
                      opacity: ggMousePro.badgeOpacity,
                      transform: `translate(-50%, -50%) scale(${pin.scale})`,
                    }}
                    className="absolute w-10 h-10 rounded-full border border-cyan-400/65 bg-cyan-950/40 flex flex-col items-center justify-center"
                  >
                    <Crosshair className="w-4 h-4 text-cyan-300" />
                    <span className="text-[7px] font-mono font-black text-amber-300 leading-none">
                      {kToggleMouse}
                    </span>
                  </div>
                );
              }

              const code = meta.action ? kb[meta.action] : '';
              if (!code) return null;

              return (
                <div
                  key={pinId}
                  style={{
                    left: `${pin.xPct}%`,
                    top: `${pin.yPct}%`,
                    opacity: ggMousePro.badgeOpacity,
                    transform: `translate(-50%, -50%) scale(${pin.scale})`,
                  }}
                  className="absolute px-1.5 py-0.5 rounded-full bg-black/75 border border-cyan-400/75 text-[9px] font-mono font-black text-cyan-200 shadow"
                >
                  {formatKeyCodeLabel(code)}
                </div>
              );
            })}
          </div>
        )}

      {/* PAUSE / TEST MODAL */}
      {isPaused && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm bg-[#14181e] border-2 border-amber-500 p-5 space-y-2.5 shadow-2xl">
            <h2 className="text-center font-black text-base tracking-widest uppercase text-amber-400 border-b border-neutral-700 pb-2">
              MENU DE PAUSA
            </h2>

            <button
              type="button"
              onClick={onTogglePause}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>CONTINUAR PARTIDA</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full py-2.5 bg-[#1d232c] hover:bg-[#27303d] border border-neutral-600 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>SENSIBILIDADE E CONFIGURAÇÕES</span>
            </button>

            <button
              type="button"
              onClick={onOpenHudEditor}
              className="w-full py-2.5 bg-[#1d232c] hover:bg-[#27303d] border border-amber-500/50 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <Move className="w-4 h-4" />
              <span>PERSONALIZAR HUD</span>
            </button>

            {onOpenGgMacroModal && (
              <button
                type="button"
                onClick={onOpenGgMacroModal}
                className="w-full py-2.5 bg-[#15222e] hover:bg-[#1d3042] border border-cyan-400/60 text-cyan-300 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <MousePointerClick className="w-4 h-4" />
                <span>GG MOUSE PRO & MACROS</span>
              </button>
            )}

            <div className="border-t border-neutral-700 pt-2.5 space-y-2">
              <div className="text-[10px] font-mono text-neutral-400 uppercase text-center">
                TESTES RÁPIDOS DE PARTIDA
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onTogglePause();
                    onTestDamage();
                  }}
                  className="py-2 px-2 bg-red-900/50 hover:bg-red-800/60 border border-red-600 text-[11px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
                >
                  <HeartPulse className="w-3.5 h-3.5" />
                  <span>SOFRER DANO</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTogglePause();
                    onTestVictory();
                  }}
                  className="py-2 px-2 bg-emerald-900/50 hover:bg-emerald-800/60 border border-emerald-600 text-[11px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>TESTAR VITÓRIA</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onReturnLobby}
              className="w-full py-2.5 bg-red-950/70 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>VOLTAR AO LOBBY</span>
            </button>
          </div>
        </div>
      )}
      {/* SPECTATOR OVERLAY (Bottom-left arrows + Free Fire Player Profile Banner + Spectator Eye + Like, gameplay HUD hidden) */}
      {isGroundCombat && hud.spectatingTarget && !isPaused && (() => {
        const sp = hud.spectatingTarget;
        const rk = getRankInfo(sp.rankPoints);
        const spHpPct = Math.max(0, Math.min(100, (sp.hp / Math.max(1, sp.maxHp)) * 100));
        return (
          <>
            <div className="pointer-events-auto fixed bottom-3 left-3 z-40 flex items-end gap-2 select-none">
              {/* Two cycling arrows on bottom-left */}
              <div className="flex items-center gap-1 bg-black/85 border border-white/25 p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => onCycleSpectate?.(-1)}
                  title="Jogador Anterior"
                  className="w-8 h-9 bg-[#1a2230] hover:bg-amber-400 hover:text-black text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onCycleSpectate?.(1)}
                  title="Próximo Jogador"
                  className="w-8 h-9 bg-[#1a2230] hover:bg-amber-400 hover:text-black text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Player Banner Card with Avatar, Nick, Level, Patente & Spectator Eye */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!sp.isBot && sp.accountId > 0 && onInspectSpectatedPlayer) {
                    onInspectSpectatedPlayer(sp.accountId);
                  }
                }}
                className={`flex items-stretch bg-gradient-to-r from-[#7f1d1d] via-[#991b1b] to-[#111827] border-2 border-amber-400/80 shadow-2xl overflow-hidden min-w-[260px] max-w-[360px] text-left ${
                  !sp.isBot && sp.accountId > 0 ? 'cursor-pointer hover:ring-2 hover:ring-amber-300' : ''
                }`}
                title={!sp.isBot && sp.accountId > 0 ? 'Clique para ver Perfil / Adicionar Amigo' : undefined}
              >
                {/* Yellow Left Strip with Avatar & Level */}
                <div className="w-16 shrink-0 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 p-1 flex flex-col items-center justify-between text-black">
                  <div className="w-12 h-12 border-2 border-white bg-neutral-900 overflow-hidden shadow">
                    <img
                      src={getCharacterAvatar(sp.modelId)}
                      alt={sp.nick}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <span className="text-[9px] font-black leading-none mt-0.5">
                    Nvl. {sp.level}
                  </span>
                </div>

                {/* Crimson/Dark Banner Details */}
                <div className="flex-1 p-2 flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
                        <span className="text-xs font-black text-white truncate">
                          {sp.nick}
                        </span>
                        {sp.teamLabel && (
                          <span className="bg-black/60 border border-amber-300/40 px-1 py-[0.5px] text-[7.5px] font-mono text-amber-300 whitespace-nowrap">
                            {sp.teamLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-amber-200">
                        <RankEmblemSvg
                          color={rk.color}
                          accent={rk.accent}
                          iconUrl={rk.iconUrl}
                          alt={rk.name}
                          className="w-4 h-4 shrink-0"
                        />
                        <span className="truncate">{rk.name}</span>
                        {!sp.isBot && sp.accountId > 0 && (
                          <span className="text-[8px] font-mono text-amber-300 underline ml-1">
                            Ver Perfil
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <div
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-black/50 border border-white/15 text-[10px] font-mono font-bold text-white"
                        title="Espectadores"
                      >
                        <img
                          src="/assets/aistudio/159604_d43d3e53.png"
                          alt="Telando"
                          className="w-3 h-3 object-contain brightness-0 invert"
                        />
                        <span>{sp.spectatorCount}</span>
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/50 border border-white/15 text-[10px] font-mono font-bold text-amber-300">
                        <Crosshair className="w-3 h-3" />
                        <span>{sp.kills}</span>
                      </div>
                    </div>
                  </div>

                  {/* HP Bar */}
                  <div className="mt-1.5">
                    <div className="w-full h-1.5 bg-black/70 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all"
                        style={{ width: `${spHpPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Like Button */}
              <button
                type="button"
                onClick={() => onSendSpectateLike?.()}
                disabled={Boolean(sp.likedByMe)}
                title={sp.likedByMe ? 'Like enviado' : 'Dar Like'}
                className={`h-10 px-2.5 border flex items-center gap-1 text-[11px] font-black uppercase shadow-xl transition-colors ${
                  sp.likedByMe
                    ? 'bg-amber-400 text-black border-amber-200 cursor-default'
                    : 'bg-black/85 hover:bg-amber-400 hover:text-black border-amber-400/70 text-amber-300 cursor-pointer'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${sp.likedByMe ? 'fill-black' : ''}`} />
                <span className="hidden sm:inline">{sp.likedByMe ? 'CURTIDO' : 'LIKE'}</span>
              </button>

              {!sp.isBot && !sp.isFriend && sp.publicId && (
                <button
                  type="button"
                  onClick={() => onSendFriendRequest?.(sp.publicId)}
                  title="Enviar Pedido de Amizade"
                  className="h-10 px-2.5 bg-neutral-900/90 hover:bg-amber-400 hover:text-black border border-amber-400/70 text-amber-300 flex items-center gap-1 text-[11px] font-black uppercase shadow-xl transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">+ AMIGO</span>
                </button>
              )}
            </div>

            {/* Quit / Kitar Match Button (does not penalize alive teammates) */}
            <button
              type="button"
              onClick={() => (onExitSpectate ? onExitSpectate() : onReturnLobby())}
              className="pointer-events-auto fixed bottom-3 right-3 z-40 px-3.5 py-2 bg-red-950/90 hover:bg-red-800 border border-red-400/70 text-red-100 font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-xl cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>SAIR DA PARTIDA</span>
            </button>
          </>
        );
      })()}
    </div>
  );
};
