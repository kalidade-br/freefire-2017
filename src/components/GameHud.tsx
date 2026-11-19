import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  HeartPulse,
  LogOut,
  Move,
  Play,
  Settings,
  Trophy,
  Wrench,
} from 'lucide-react';
import { InputManager } from '../game/inputManager';
import {
  ATTACHMENT_LABELS,
  ControlMode,
  GameState,
  HudElementLayout,
  HudLayoutConfig,
  HudSnapshot,
  MinimapBuilding,
  MinimapRoad,
  PoiMarker,
  SCOPE_META,
  ScopeType,
  WEAPONS,
  WeaponSlotId,
} from '../game/types';
import {
  BERMUDA_MAP_RANGE,
  HAS_SENTOSA,
  riverCenterZ,
  sampleMainIslandEdgeRadius,
  sampleSentosaEdgeRadius,
  SENTOSA_CENTER,
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
  IconMedkitSvg,
  IconProneSvg,
  IconReloadSvg,
  IconScopeSvg,
  IconSprintSvg,
  IconSurfboardSvg,
  IconVehicleSvg,
  IconVendingSvg,
  IconVestSvg,
} from './HudIcons';
import { ScopeOverlay } from './ScopeOverlay';
import { WeaponIcon } from './WeaponIcon';

interface GameHudProps {
  gameState: GameState;
  hud: HudSnapshot;
  buildings: MinimapBuilding[];
  roads: MinimapRoad[];
  pois: PoiMarker[];
  input: InputManager;
  controlMode: ControlMode;
  hudLayout: HudLayoutConfig;
  showFps: boolean;
  isPaused: boolean;
  isBackpackOpen: boolean;
  onTogglePause: () => void;
  onToggleBackpack: () => void;
  onUseMedkit: () => void;
  onCollectLoot: (id: string) => void;
  onOpenVending: () => void;
  onToggleVehicle: () => void;
  onOpenSettings: () => void;
  onOpenHudEditor: () => void;
  onSelectScope: (scope: ScopeType) => void;
  onSkipWaiting: () => void;
  onJumpFromPlane: () => void;
  onOpenParachute: () => void;
  onReturnLobby: () => void;
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
  input,
  controlMode,
  hudLayout,
  showFps,
  isPaused,
  isBackpackOpen,
  onTogglePause,
  onToggleBackpack,
  onUseMedkit,
  onCollectLoot,
  onOpenVending,
  onToggleVehicle,
  onOpenSettings,
  onOpenHudEditor,
  onSelectScope,
  onSkipWaiting,
  onJumpFromPlane,
  onOpenParachute,
  onReturnLobby,
  onTestDamage,
  onTestVictory,
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapBgRef = useRef<HTMLCanvasElement | null>(null);
  const [minimapZoomed, setMinimapZoomed] = useState(true);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const [fireKnob, setFireKnob] = useState({ x: 0, y: 0 });
  const [isFirePressed, setIsFirePressed] = useState(false);
  const [autoSprintActive, setAutoSprintActive] = useState(false);
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM' || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      setMinimapZoomed((v) => !v);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Guarantee Fire button never stays stuck down if pointer leaves or cancels outside
  useEffect(() => {
    const releaseFire = (e: PointerEvent) => {
      if (fireDragRef.current && fireDragRef.current.id === e.pointerId) {
        fireDragRef.current = null;
        setFireKnob({ x: 0, y: 0 });
        setIsFirePressed(false);
        input.setTouchFire(false);
      }
    };
    const clearAllOnBlur = () => {
      fireDragRef.current = null;
      setFireKnob({ x: 0, y: 0 });
      setIsFirePressed(false);
      input.setTouchFire(false);
    };
    window.addEventListener('pointerup', releaseFire);
    window.addEventListener('pointercancel', releaseFire);
    window.addEventListener('blur', clearAllOnBlur);
    return () => {
      window.removeEventListener('pointerup', releaseFire);
      window.removeEventListener('pointercancel', releaseFire);
      window.removeEventListener('blur', clearAllOnBlur);
    };
  }, [input]);

  const showTouchHud =
    controlMode === 'mobile' || (controlMode === 'auto' && isTouchDevice);

  // Pre-render static 2D Minimap terrain, coastal reefs, Sentosa, river, roads, buildings & POIs at 512x512
  useEffect(() => {
    const size = 512;
    const mapRange = BERMUDA_MAP_RANGE;
    const worldToBg = size / (mapRange * 2);
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const ctx = off.getContext('2d');
    if (!ctx) return;

    const toPx = (wx: number, wz: number) => ({
      x: (wx + mapRange) * worldToBg,
      y: (wz + mapRange) * worldToBg,
    });

    ctx.fillStyle = '#14496e';
    ctx.fillRect(0, 0, size, size);

    // Coastal turquoise reef halo around main island & Sentosa
    const drawMainPoly = () => {
      ctx.beginPath();
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        const edgeR = sampleMainIslandEdgeRadius(a);
        const p = toPx(Math.cos(a) * edgeR, Math.sin(a) * edgeR);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    };
    const drawSentosaPoly = () => {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const edgeR = sampleSentosaEdgeRadius(a);
        const p = toPx(SENTOSA_CENTER.x + Math.cos(a) * edgeR, SENTOSA_CENTER.z + Math.sin(a) * edgeR);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    };

    ctx.strokeStyle = 'rgba(34, 216, 236, 0.55)';
    ctx.lineWidth = 15;
    drawMainPoly();
    ctx.stroke();
    if (HAS_SENTOSA) {
      drawSentosaPoly();
      ctx.stroke();
    }

    // Sand beach & grassy terrain fill
    ctx.fillStyle = '#5a6d3a';
    ctx.strokeStyle = '#cbb480';
    ctx.lineWidth = 5.5;
    drawMainPoly();
    ctx.fill();
    ctx.stroke();

    if (HAS_SENTOSA) {
      drawSentosaPoly();
      ctx.fill();
      ctx.stroke();
    }

    // Peak mountain elevation shading
    const peakP = toPx(30, -55);
    ctx.fillStyle = 'rgba(116, 112, 90, 0.45)';
    ctx.beginPath();
    ctx.arc(peakP.x, peakP.y, 28, 0, Math.PI * 2);
    ctx.fill();

    // Northern River & Dam basin
    ctx.strokeStyle = '#1fc6df';
    ctx.lineWidth = 11;
    ctx.beginPath();
    for (let wx = -540; wx <= 540; wx += 20) {
      const wz = riverCenterZ(wx);
      const p = toPx(wx, wz);
      if (wx === -540) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    roads.forEach((r) => {
      const p1 = toPx(r.x1, r.z1);
      const p2 = toPx(r.x2, r.z2);
      ctx.strokeStyle = r.kind === 'asphalt' ? '#686e77' : '#a48a66';
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

      if (b.kind === 'bridge') {
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 0.9;
        ctx.fillRect(-bw * 0.5, -bd * 0.5, bw, bd);
        ctx.strokeRect(-bw * 0.5, -bd * 0.5, bw, bd);
        ctx.restore();
        return;
      }

      if (b.kind === 'casaL') {
        // L-shape footprint matching createCasaL wings
        ctx.fillStyle = '#f5e6c8';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(-bw * 0.5, -bd * 0.5);
        ctx.lineTo(bw * 0.5, -bd * 0.5);
        ctx.lineTo(bw * 0.5, -bd * 0.02);
        ctx.lineTo(-bw * 0.04, -bd * 0.02);
        ctx.lineTo(-bw * 0.04, bd * 0.5);
        ctx.lineTo(-bw * 0.5, bd * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (b.kind === 'casaGod') {
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#451a03';
      } else if (b.kind === 'celeiro') {
        ctx.fillStyle = '#dc6843';
        ctx.strokeStyle = '#450a0a';
      } else if (b.kind === 'sobrado') {
        ctx.fillStyle = '#fde68a';
        ctx.strokeStyle = '#78350f';
      } else if (b.kind === 'guarita') {
        ctx.fillStyle = '#d6d3d1';
        ctx.strokeStyle = '#292524';
      } else if (b.kind === 'container') {
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#0c4a6e';
      } else if (b.kind === 'tower') {
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#422006';
      } else {
        ctx.fillStyle = '#e6d8b5';
        ctx.strokeStyle = '#44403c';
      }
      ctx.lineWidth = 0.8;
      ctx.fillRect(-bw * 0.5, -bd * 0.5, bw, bd);
      ctx.strokeRect(-bw * 0.5, -bd * 0.5, bw, bd);
      ctx.restore();
    });

    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    pois.forEach((poi) => {
      if (poi.name.startsWith('PONTE') || poi.name.startsWith('NUREK')) return;
      const p = toPx(poi.x, poi.z);
      const label = poi.name.split(' ')[0];
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.72)';
      ctx.strokeText(label, p.x, p.y - 9);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(label, p.x, p.y - 9);
    });

    minimapBgRef.current = off;
  }, [buildings, roads, pois]);

  // Fast Minimap dynamic Safe Zone circles + player arrow + zoomed radar crop blit
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    const bg = minimapBgRef.current;
    if (!canvas || !bg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = 256;
    const bgSize = bg.width; // 512
    const mapRange = BERMUDA_MAP_RANGE;
    const isGround = gameState === GameState.WAITING || gameState === GameState.PLAYING;
    const isZoomed = minimapZoomed && isGround;
    const radarHalfRange = 185; // 370m x 370m crisp tactical view on ground

    const minWorldX = isZoomed ? hud.playerX - radarHalfRange : -mapRange;
    const minWorldZ = isZoomed ? hud.playerZ - radarHalfRange : -mapRange;
    const worldSpan = isZoomed ? radarHalfRange * 2 : mapRange * 2;
    const scalePx = canvasSize / worldSpan;

    const toPx = (wx: number, wz: number) => ({
      x: (wx - minWorldX) * scalePx,
      y: (wz - minWorldZ) * scalePx,
    });

    if (isZoomed) {
      ctx.fillStyle = '#14496e';
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      const bgPerWorld = bgSize / (mapRange * 2);
      const srcX = (minWorldX + mapRange) * bgPerWorld;
      const srcY = (minWorldZ + mapRange) * bgPerWorld;
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

    if (gameState === GameState.PLAYING) {
      const sz = hud.safeZone;
      const nextP = toPx(sz.nextX, sz.nextZ);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(nextP.x, nextP.y, Math.max(4, sz.nextRadius * scalePx), 0, Math.PI * 2);
      ctx.stroke();

      const curP = toPx(sz.currentX, sz.currentZ);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(curP.x, curP.y, Math.max(4, sz.currentRadius * scalePx), 0, Math.PI * 2);
      ctx.stroke();

      if (sz.playerOutside) {
        const plP = toPx(hud.playerX, hud.playerZ);
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
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
    ctx.save();
    ctx.translate(plPx.x, plPx.y);
    ctx.rotate(rad);

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

    // Draw Duo / Squad teammate dots on Minimap
    for (let i = 0; i < hud.teamMembers.length; i++) {
      const m = hud.teamMembers[i];
      if (m.slotNumber <= 1 || m.eliminated || m.worldX === undefined || m.worldZ === undefined) {
        continue;
      }
      const mp = toPx(m.worldX, m.worldZ);
      const col = getSlotColor(m.slotNumber, m.isDowned);
      ctx.fillStyle = col;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, m.isDowned ? 6.2 : 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Draw Vending Machines (Lojinhas) as cyan squares on Minimap
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

    // Draw Drivable Vehicles on Minimap
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

    // Draw AirDrop crates on Minimap (gold crate icon)
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
  }, [
    hud.playerX,
    hud.playerZ,
    hud.yawDeg,
    hud.safeZone,
    hud.teamMembers,
    hud.airDrops,
    hud.vendingLocations,
    hud.vehicleLocations,
    gameState,
    minimapZoomed,
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
        input.setTouchSprint(ny < -0.78);
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
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if unsupported
    }
    fireDragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lx: e.clientX,
      ly: e.clientY,
      showKnob,
    };
    if (showKnob) {
      setFireKnob({ x: 0, y: 0 });
      setIsFirePressed(true);
    }
    input.setTouchFire(true);
  };

  const moveFirePointer = (e: React.PointerEvent<HTMLElement>) => {
    const drag = fireDragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    e.stopPropagation();
    const dx = e.clientX - drag.lx;
    const dy = e.clientY - drag.ly;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    // Exact same camera look sensitivity (2.0x) as right-half camera drag
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

  const endFirePointer = (e: React.PointerEvent<HTMLElement>) => {
    if (fireDragRef.current?.id === e.pointerId) {
      e.stopPropagation();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      fireDragRef.current = null;
      setFireKnob({ x: 0, y: 0 });
      setIsFirePressed(false);
      input.setTouchFire(false);
    }
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
      {/* Optical Scope Overlay (1x Red Dot, 2x, 4x, Sniper 8x) */}
      {showOpticalOverlay && (
        <ScopeOverlay
          scope={hud.activeScope}
          aimLockedTarget={hud.aimLockedTarget}
          aimAssistActive={hud.aimAssistActive}
          headshotFlashActive={hud.headshotFlashActive}
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
      {showTouchHud && !isPaused && (
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
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setMinimapZoomed((v) => !v);
          }}
          title="Alternar Zoom do Mapa (M)"
          className="relative w-[104px] h-[104px] sm:w-[124px] sm:h-[124px] border border-white/65 bg-[#14181e] overflow-hidden shadow-lg cursor-pointer p-0 block"
        >
          <canvas
            ref={minimapCanvasRef}
            width={256}
            height={256}
            className="w-full h-full block"
          />
          <span className="absolute bottom-0.5 right-0.5 bg-black/75 px-1 py-[1px] text-[7.5px] font-mono font-bold tracking-wider text-amber-200 border border-white/20">
            {minimapZoomed && isGroundCombat ? 'RADAR · M' : 'ILHA · M'}
          </span>
        </button>
        {hud.currentPoi && (
          <div
            className="pointer-events-none text-[9px] font-bold tracking-wide uppercase text-amber-200 px-1 w-fit"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
          >
            {hud.currentPoi}
          </div>
        )}
      </div>

      {/* OVERHEAD 3D-PROJECTED TEAMMATE TAGS (#2 JOGADOR + ▼) & OFF-SCREEN DIRECTIONAL ARROWS */}
      {!isPaused &&
        hud.teamMembers.map((m) => {
          if (m.slotNumber <= 1 || m.eliminated) return null;
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
                  ) : m.distance !== undefined && m.slotNumber > 1 && !m.eliminated ? (
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

      {/* BOTTOM-LEFT FPS / LATENCY READOUT */}
      {showFps && (
        <div
          className="absolute bottom-2 left-2.5 z-20 text-[10px] font-mono font-bold tabular-nums text-white/85"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
        >
          {hud.fps} FPS
        </div>
      )}

      {/* CUSTOMIZABLE UTILITY BUTTONS (MOCHILA %, KIT, GRANADA, GELO) */}
      {isGroundCombat && !hud.isDead && !hud.isPlayerDowned && !isPaused && (
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
            title="Abrir Mochila (TAB ou B)"
          >
            <IconBackpackSvg className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow" />
            <span className="absolute -top-1 right-0 bg-black/80 px-1 text-[8px] font-mono font-black text-white leading-tight">
              {backpackPct}%
            </span>
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
                disabled={hud.medkitCount <= 0 || hud.hp >= hud.maxHp || hud.usingMedkit}
                style={layoutStyle(hudLayout.medkitBtn)}
                className="pointer-events-auto touch-none absolute z-20 w-11 h-11 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/65 border border-white/25 flex items-center justify-center shadow cursor-pointer active:scale-95 disabled:brightness-50 disabled:grayscale"
                title="Usar Kit Médico (H)"
              >
                <IconMedkitSvg className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow" />
                <span className="absolute top-0 right-0.5 text-[10px] font-mono font-black text-white drop-shadow">
                  {hud.medkitCount}
                </span>
                {!showTouchHud && (
                  <span className="absolute bottom-0 left-0.5 text-[7px] font-mono text-white/75">
                    H
                  </span>
                )}
              </button>

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
                    title="Granada Explosiva (X ou 6)"
                  >
                    <IconGrenadeSvg className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow" />
                    <span className="absolute bottom-0 right-0.5 text-[10px] font-mono font-black text-white drop-shadow">
                      {hud.grenadeCount}
                    </span>
                    {!showTouchHud && (
                      <span className="absolute top-0 left-0.5 text-[7px] font-mono text-white/75">
                        X
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
                    title="Parede de Gelo (G ou 5)"
                  >
                    <IconGlooSvg className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow" />
                    <span className="absolute bottom-0 right-0.5 text-[10px] font-mono font-black text-white drop-shadow">
                      {hud.glooCount}
                    </span>
                    {!showTouchHud && (
                      <span className="absolute top-0 left-0.5 text-[7px] font-mono text-white/75">
                        G
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
            <span>ILHA DE ESPERA:</span>
            <strong className="text-amber-400 tabular-nums">
              00:{String(hud.waitingTimerSec).padStart(2, '0')}
            </strong>
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
          </div>
        )}

        {gameState === GameState.PLAYING && (
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
                  : 'Zona segura aparecerá em'}
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
          </div>
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

        {/* CENTERED RISING KILL NOTIFICATIONS ("Fulano Eliminado") */}
        {isGroundCombat && !isPaused && hud.killFeed.length > 0 && (
          <div className="pointer-events-none mt-1 flex flex-col items-center gap-0.5 w-full">
            {hud.killFeed.slice(0, 3).map((kf) => {
              const fade =
                kf.age > 3.4 ? Math.max(0, 1 - (kf.age - 3.4) / 1.0) : 1;
              const enterLift = Math.max(0, 1 - kf.age * 5) * 6;
              return (
                <div
                  key={kf.id}
                  style={{
                    opacity: fade,
                    transform: `translateY(${enterLift - kf.age * 2.0}px)`,
                    textShadow: '0 1px 4px rgba(0,0,0,0.95)',
                  }}
                  className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-bold tracking-wide"
                >
                  <span
                    className={
                      kf.isPlayerKiller ? 'text-amber-300 font-black' : 'text-white'
                    }
                  >
                    {kf.killerName}
                  </span>
                  <span className="text-[9px] font-mono px-1 bg-black/55 border border-white/20 text-neutral-200">
                    {kf.isHeadshot ? `☠ ${kf.weaponShort}` : kf.weaponShort}
                  </span>
                  <span className="text-amber-300">
                    {kf.victimName} Eliminado
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TOP-RIGHT (customizable): FF Coins + Ranked Badge + Cyan Vivo / Red-Orange Matou + Settings Gear */}
      <div
        style={layoutStyle(hudLayout.aliveBox)}
        className="pointer-events-auto absolute z-20 flex items-center gap-1.5"
      >
        {hud.isRanked && (
          <div className="bg-red-700/90 border border-amber-300/80 px-1.5 py-1 text-[9px] font-black tracking-wider uppercase text-amber-200 whitespace-nowrap">
            RANK
          </div>
        )}
        <div className="flex items-center gap-1 bg-black/75 border border-amber-400/55 px-2 py-1 text-[11px] font-mono font-black text-amber-300 tabular-nums whitespace-nowrap">
          <IconCoinSvg className="w-3.5 h-3.5 shrink-0" />
          <span>{hud.ffCoins}</span>
        </div>
        <div className="flex items-center text-[11px] sm:text-xs font-bold shadow-md overflow-hidden rounded-[2px]">
          <div className="bg-gradient-to-r from-cyan-500/85 to-teal-400/85 px-2.5 py-1 flex items-center gap-1 text-white">
            <span>Vivo</span>
            <span className="font-mono font-black tabular-nums">{hud.aliveCount}</span>
          </div>
          <div className="bg-gradient-to-r from-orange-500/85 to-red-600/85 px-2.5 py-1 flex items-center gap-1 text-white">
            <span>Matou</span>
            <span className="font-mono font-black tabular-nums">{hud.kills}</span>
          </div>
        </div>
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onTogglePause();
          }}
          className="pointer-events-auto touch-none bg-black/50 hover:bg-black/75 border border-white/25 p-1.5 rounded-[2px] cursor-pointer"
          title="Menu / Configurações (Esc)"
        >
          <Settings className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* CUSTOMIZABLE CLASSIC FREE FIRE TOP-RIGHT WEAPON BOX (MATCHES SCREENSHOTS 1 & 3) */}
      {isGroundCombat && !hud.isPlayerDowned && (
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
                      title="Soco / Punho (Tecla 4)"
                    >
                      <IconFistSvg className="w-6 h-6 text-white drop-shadow" />
                      <span className="absolute bottom-0.5 left-1 text-[10px] font-mono font-bold text-white/90 leading-none">
                        ∞
                      </span>
                      {!showTouchHud && (
                        <span className="absolute top-0.5 right-1 text-[7px] font-mono text-white/60">
                          4
                        </span>
                      )}
                    </button>
                  );
                }

                const w = hud.weapons[slotNum];
                const def = w ? WEAPONS[w.weaponId] : null;
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
                        {slotNum}
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
                        : slotNum}
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
                title="Troca Rápida de Arma (Q)"
              >
                ⇄ TROCA{!showTouchHud ? ' [Q]' : ''}
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
      {isGroundCombat && !hud.isDead && !isPaused && hud.damageIndicators.length > 0 && (
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

      {/* CENTER CROSSHAIR (Compact & Semi-Transparent) */}
      {isGroundCombat && !hud.isDead && !hud.isPlayerDowned && !isPaused && !showOpticalOverlay && !isBackpackOpen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            <div
              className={`border rounded-full transition-all duration-75 flex items-center justify-center ${
                hud.aimLockedTarget
                  ? 'w-4.5 h-4.5 border-red-500/80 border-[1.5px]'
                  : hud.isAiming
                    ? 'w-3.5 h-3.5 border-amber-300/65'
                    : hud.isSprinting
                      ? 'w-6 h-6 border-white/30'
                      : 'w-4 h-4 border-white/45'
              }`}
            >
              <div
                className="absolute -top-1 w-[1px] h-1.5"
                style={{
                  backgroundColor: hud.aimLockedTarget
                    ? 'rgba(239,68,68,0.85)'
                    : 'rgba(255,255,255,0.45)',
                }}
              />
              <div
                className="absolute -bottom-1 w-[1px] h-1.5"
                style={{
                  backgroundColor: hud.aimLockedTarget
                    ? 'rgba(239,68,68,0.85)'
                    : 'rgba(255,255,255,0.45)',
                }}
              />
              <div
                className="absolute -left-1 h-[1px] w-1.5"
                style={{
                  backgroundColor: hud.aimLockedTarget
                    ? 'rgba(239,68,68,0.85)'
                    : 'rgba(255,255,255,0.45)',
                }}
              />
              <div
                className="absolute -right-1 h-[1px] w-1.5"
                style={{
                  backgroundColor: hud.aimLockedTarget
                    ? 'rgba(239,68,68,0.85)'
                    : 'rgba(255,255,255,0.45)',
                }}
              />
            </div>
            <div
              className={`absolute w-1 h-1 rounded-full ${
                hud.aimLockedTarget ? 'bg-red-500/90' : 'bg-white/65'
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

      {/* Tactical Gloo Wall / Grenade Active Mode Banner */}
      {isGroundCombat && !hud.isDead && !hud.isPlayerDowned && !isPaused && (hud.isPlacingGloo || hud.isHoldingGrenade) && (
        <div
          className={`absolute top-[36%] left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1 border font-mono font-bold text-[10px] uppercase tracking-wider ${
            hud.isPlacingGloo
              ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200'
              : 'bg-red-950/90 border-red-400 text-red-200'
          }`}
        >
          {hud.isPlacingGloo
            ? 'GELO: CLIQUE OU BOTÃO PARA POSICIONAR'
            : 'GRANADA: CLIQUE OU BOTÃO PARA ARREMESSAR'}
        </div>
      )}

      {/* AIRPLANE / DROPPING / WINDOW VAULT / MEDKIT / LOOT / REVIVE ACTION PROMPTS (customizable) */}
      <div
        style={layoutStyle(hudLayout.actionPrompt)}
        className="pointer-events-none absolute z-20 flex flex-col items-center gap-1.5 w-[320px] max-w-[92vw]"
      >
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
            SALTAR DO AVIÃO (ESPAÇO)
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
            ABRIR PARAQUEDAS (ESPAÇO)
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
              SALVAR #{hud.reviveTarget.slotNumber} {hud.reviveTarget.nick} (V / F)
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

        {isGroundCombat && !hud.isPlayerDowned && hud.canVaultWindow && !hud.nearbyLootLabel && !hud.inVehicle && (
          <div className="px-3 py-1 bg-sky-950/88 border border-sky-400 text-sky-200 font-mono font-bold text-[11px] uppercase">
            [ESPAÇO] PULAR JANELA
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
            <span>[E] ABRIR LOJINHA</span>
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
            <span>[E] DIRIGIR {hud.nearbyVehicle.name}</span>
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
              <span className={hud.inVehicle.isBurning ? 'text-red-400 font-black' : 'text-neutral-400'}>
                {hud.inVehicle.isBurning
                  ? 'CARRO EM CHAMAS!'
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
                SAIR [E]
              </button>
            </div>
          </div>
        )}

        {isGroundCombat && (hud.isPlacingGloo || hud.isHoldingGrenade) && (
          <div className="pointer-events-auto flex items-center gap-2">
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
              {hud.isPlacingGloo ? 'BOTAR GELO AQUI' : 'ARREMESSAR GRANADA'}
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
                {hud.isOnSurfboard ? 'GUARDAR PRANCHA [T]' : 'USAR PRANCHA [T]'}
              </span>
            </button>
          )}

        {isGroundCombat && !hud.pointerLocked && !showTouchHud && !isPaused && !isBackpackOpen && (
          <div className="bg-black/55 px-2.5 py-0.5 text-[9px] font-mono text-white/80">
            CLIQUE ATIRA · DIR MIRA · Q TROCA · C AGACHA · Z DEITA · R RECAR · G GELO · X GRANADA · H KIT · T PRANCHA · TAB MOCHILA
          </div>
        )}
      </div>

      {/* CUSTOMIZABLE SLEEK FREE FIRE BOTTOM-CENTER HP / ARMOR BAR */}
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

        {/* Small Quick Gloo Diamond/Circle right of HP bar like screenshot */}
        {isGroundCombat && !hud.isPlayerDowned && !hud.isSwimming && !hud.inVehicle && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              input.triggerGloo();
            }}
            disabled={hud.glooCount <= 0}
            className={`pointer-events-auto touch-none relative w-7 h-7 rounded-full border flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 ${
              hud.isPlacingGloo
                ? 'bg-cyan-400 border-white text-black'
                : 'bg-black/55 border-white/40 text-white'
            }`}
            title="Parede de Gelo (G)"
          >
            <IconGlooSvg className="w-4 h-4" />
            <span className="absolute -bottom-1 -right-1 text-[8px] font-mono font-black bg-black/80 px-0.5 rounded-full">
              {hud.glooCount}
            </span>
          </button>
        )}
      </div>

      {/* FREE FIRE LOOT STRIP / INDIVIDUAL DEATHBOX LIST DIRECTLY UNDER TOP-RIGHT WEAPON BOX */}
      {isGroundCombat &&
        !hud.isDead &&
        !hud.isPlayerDowned &&
        !isPaused &&
        !isBackpackOpen &&
        !hud.inVehicle &&
        hud.nearbyLoots.length > 0 && (() => {
          const boxOwner = hud.nearbyLoots.find((s) => s.boxOwnerNick)?.boxOwnerNick;
          const visibleLoots = hud.nearbyLoots.slice(0, 8);
          return (
            <div className="pointer-events-auto absolute right-2 sm:right-3 top-[172px] sm:top-[190px] z-20 flex flex-col items-end gap-1 max-w-[350px] sm:max-w-[430px]">
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
                      return <IconAmmoSvg className="w-8 h-7 shrink-0 drop-shadow" />;
                    }
                    if (slot.kind === 'coin') {
                      return <IconCoinSvg className="w-6 h-6 shrink-0" />;
                    }
                    if (slot.kind === 'medkit') {
                      return <IconMedkitSvg className="w-7 h-7 text-emerald-400 shrink-0" />;
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
                      return <IconBackpackSvg className="w-7 h-7 text-amber-300 shrink-0" />;
                    }
                    if (slot.kind === 'scope') {
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
                            E
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

      {/* MOBILE VEHICLE TOUCH PEDALS & STEERING WHEN DRIVING */}
      {showTouchHud && isGroundCombat && !isPaused && hud.inVehicle && (
        <>
          <div className="pointer-events-auto absolute left-4 bottom-8 z-20 flex items-center gap-2">
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
          <div className="pointer-events-auto absolute right-4 bottom-8 z-20 flex items-center gap-2">
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

      {/* CUSTOMIZABLE MOBILE VIRTUAL JOYSTICK, SPRINT, LEFT-FIRE & RIGHT BUTTON CLUSTER */}
      {showTouchHud && (isGroundCombat || isAirborneDrop) && !isPaused && !hud.inVehicle && (
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
                  {/* Left Fire Button (customizable) */}
                  <button
                    type="button"
                    onContextMenu={(e) => e.preventDefault()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onPointerDown={(e) => beginFirePointer(e, false)}
                    onPointerMove={moveFirePointer}
                    onPointerUp={endFirePointer}
                    onPointerCancel={endFirePointer}
                    onLostPointerCapture={() => {
                      fireDragRef.current = null;
                      setFireKnob({ x: 0, y: 0 });
                      setIsFirePressed(false);
                      input.setTouchFire(false);
                    }}
                    style={layoutStyle(hudLayout.leftFireBtn)}
                    className="pointer-events-auto touch-none absolute z-20 w-12 h-12 rounded-full bg-black/45 active:bg-white/30 border-[1.5px] border-white/60 flex items-center justify-center text-white shadow-lg cursor-pointer"
                    title="Atirar Esquerdo"
                  >
                    <IconFireBurstSvg className="w-7 h-7 text-white" />
                  </button>

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

                  {/* Primary Right Fire Button: Analog-style Containment Ring + Smooth Movable Subir Capa Ball */}
                  <div
                    role="button"
                    aria-label="Atirar e Subir Capa"
                    onContextMenu={(e) => e.preventDefault()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onPointerDown={(e) => beginFirePointer(e, true)}
                    onPointerMove={moveFirePointer}
                    onPointerUp={endFirePointer}
                    onPointerCancel={endFirePointer}
                    onLostPointerCapture={() => {
                      fireDragRef.current = null;
                      setFireKnob({ x: 0, y: 0 });
                      setIsFirePressed(false);
                      input.setTouchFire(false);
                    }}
                    style={layoutStyle(hudLayout.fireBtn)}
                    className={`pointer-events-auto touch-none absolute z-20 w-28 h-28 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
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
                </>
              )}
            </>
          )}
        </>
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
    </div>
  );
};
