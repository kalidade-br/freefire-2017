import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../game/audio';
import { GameState } from '../game/types';
import winterlandsLoadingBg from '../assets/images/winterlands_loading_hd_1795808029951.jpg';

interface BootAndLoadingProps {
  state: GameState.BOOT | GameState.LOADING;
  progress: number;
  statusText: string;
}

const GARENA_LOGO_PATH = '/assets/aistudio/garena-logo_bba77b2c.png';

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const BootThreeSplash: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    const canvas = renderer.domElement;
    const width = container.clientWidth || window.innerWidth || 1280;
    const height = container.clientHeight || window.innerHeight || 720;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    const onContextRestored = () => {
      setWebglUnavailable(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.08);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(0, 0, 5.4);

    // Subtle glowing crimson particles drifting in 3D space
    const sparkCount = 72;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkSpeeds = new Float32Array(sparkCount);
    const sparkPhases = new Float32Array(sparkCount);
    for (let i = 0; i < sparkCount; i++) {
      sparkPositions[i * 3] = (Math.random() - 0.5) * 9.0;
      sparkPositions[i * 3 + 1] = (Math.random() - 0.5) * 5.2;
      sparkPositions[i * 3 + 2] = (Math.random() - 0.5) * 3.0 - 0.5;
      sparkSpeeds[i] = 0.14 + Math.random() * 0.35;
      sparkPhases[i] = Math.random() * Math.PI * 2;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));

    const sparkCanvas = document.createElement('canvas');
    sparkCanvas.width = 32;
    sparkCanvas.height = 32;
    const sCtx = sparkCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(16, 16, 1, 16, 16, 15);
      grad.addColorStop(0, 'rgba(255, 210, 140, 0.95)');
      grad.addColorStop(0.45, 'rgba(220, 38, 38, 0.55)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 32, 32);
    }
    const sparkTex = new THREE.CanvasTexture(sparkCanvas);
    const sparkMat = new THREE.PointsMaterial({
      size: 0.11,
      map: sparkTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparks);

    // Dead-center 3D Garena Logo PNG (includes emblem + "Garena" wordmark inside PNG)
    const logoGroup = new THREE.Group();
    logoGroup.position.set(0, 0, 0);
    scene.add(logoGroup);

    const logoGeo = new THREE.PlaneGeometry(2.15, 2.15);
    const logoMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const logoMesh = new THREE.Mesh(logoGeo, logoMat);
    logoGroup.add(logoMesh);

    const texLoader = new THREE.TextureLoader();
    let logoTexture: THREE.Texture | null = null;
    let textureReady = false;
    let disposed = false;

    texLoader.load(
      GARENA_LOGO_PATH,
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        logoTexture = tex;
        const img = tex.image as { width?: number; height?: number } | undefined;
        if (img?.width && img?.height) {
          const aspect = img.width / img.height;
          logoMesh.scale.set(aspect, 1, 1);
        }
        logoMat.map = tex;
        logoMat.needsUpdate = true;
        textureReady = true;
      },
      undefined,
      () => {
        if (!disposed) setWebglUnavailable(true);
      },
    );

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      const isNarrow = w < h;
      camera.position.z = isNarrow ? 7.4 : 5.4;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let rafId = 0;
    const startTime = performance.now();
    let prevTime = startTime;

    const animate = (now: number) => {
      if (disposed || !renderer) return;
      const elapsed = (now - startTime) / 1000;
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;

      // Very slow, smooth ~11.5s cycle:
      // 0.0..0.6s pure black -> 0.6..5.2s slow gentle fade-in -> 5.2..7.8s hold -> 7.8..11.5s slow fade-out to black
      const fadeIn = smoothstep(0.6, 5.2, elapsed);
      const fadeOut = 1 - smoothstep(7.8, 11.4, elapsed);
      const visibility = textureReady ? fadeIn * fadeOut : 0;

      // Subtle slow 3D depth glide + gentle scale breath (zero sudden pop)
      const glideT = smoothstep(0.6, 11.4, elapsed);
      logoGroup.scale.setScalar(THREE.MathUtils.lerp(0.86, 1.03, glideT));
      logoGroup.position.z = THREE.MathUtils.lerp(-0.9, 0.18, glideT);
      logoGroup.rotation.y = Math.sin(elapsed * 0.45) * 0.025;
      logoMat.opacity = visibility;

      // Drift ambient embers slowly in sync with logo visibility
      const posAttr = sparkGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < sparkCount; i++) {
        let y = posAttr.getY(i) + sparkSpeeds[i] * dt;
        const x = posAttr.getX(i) + Math.sin(elapsed * 0.9 + sparkPhases[i]) * 0.08 * dt;
        if (y > 2.8) y = -2.8;
        posAttr.setXY(i, x, y);
      }
      posAttr.needsUpdate = true;
      sparkMat.opacity = 0.42 * visibility;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      sparkGeo.dispose();
      sparkMat.dispose();
      sparkTex.dispose();
      logoGeo.dispose();
      logoMat.dispose();
      logoTexture?.dispose();
      renderer?.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black select-none overflow-hidden">
      {/* Pure Black Three.js 3D Stage */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Fallback only if WebGL is unavailable */}
      {webglUnavailable && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={GARENA_LOGO_PATH}
            alt="Garena"
            referrerPolicy="no-referrer"
            className="w-[46vh] h-[46vh] max-w-[260px] max-h-[260px] object-contain"
            style={{ animation: 'ffLogoSlowCycle 11.5s ease-in-out forwards' }}
          />
        </div>
      )}
    </div>
  );
};

export const BootAndLoadingScreen: React.FC<BootAndLoadingProps> = ({
  state,
  progress,
  statusText,
}) => {
  const [dotStep, setDotStep] = useState(1);

  useEffect(() => {
    if (state !== GameState.LOADING) return;
    const id = window.setInterval(() => {
      setDotStep((prev) => (prev % 3) + 1);
    }, 360);
    return () => window.clearInterval(id);
  }, [state]);

  if (state === GameState.BOOT) {
    return (
      <div onPointerDown={() => soundEngine.unlock()}>
        <BootThreeSplash />
      </div>
    );
  }

  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const dots = '.'.repeat(dotStep);

  return (
    <div
      onPointerDown={() => soundEngine.unlock()}
      className="fixed inset-0 z-50 bg-black text-white select-none overflow-hidden"
    >
      {/* Winterlands Free Fire Loading Artwork (HD) */}
      <img
        src={winterlandsLoadingBg}
        alt="Carregando Free Fire"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover object-center"
        style={{ animation: 'ffKenBurns 11s ease-in-out infinite alternate' }}
      />

      {/* Subtle bottom scrim for crisp LOADING... readability */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

      {/* Centered LOADING... + classic slim angled white progress bar matching FF 2017 v1.7.13 */}
      <div className="absolute inset-x-0 bottom-[6%] flex flex-col items-center px-6 sm:px-14">
        <div className="text-lg sm:text-2xl font-medium tracking-[0.06em] uppercase text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] mb-2.5">
          LOADING<span className="inline-block w-6 text-left">{dots}</span>
        </div>

        <div
          className="relative w-full max-w-4xl h-2.5 sm:h-3 bg-black/45 border border-white/60 overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
          style={{
            clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
          }}
        >
          <div
            className="h-full bg-gradient-to-r from-neutral-200 via-white to-white transition-[width] duration-300 ease-out"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        <div className="mt-2 max-w-[90vw] flex items-center justify-center gap-2.5 text-[10px] sm:text-[11px] font-mono text-white/75 tracking-wider uppercase drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          <span className="truncate">{statusText}</span>
          <span className="text-amber-300 font-bold tabular-nums shrink-0">{clampedProgress}%</span>
        </div>
      </div>
    </div>
  );
};
