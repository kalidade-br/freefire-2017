import * as THREE from 'three';
import type { GlooSkinId, WalkablePlatform, WorldObbCollider } from './types';

export interface GlooVariantAssets {
  classicGeo: THREE.BufferGeometry;
  ffwcGeo: THREE.BufferGeometry;
  classicMat: THREE.MeshStandardMaterial;
  ffwcMat: THREE.MeshStandardMaterial;
  classicPreviewMat: THREE.MeshBasicMaterial;
  ffwcPreviewMat: THREE.MeshBasicMaterial;
  classicTex: THREE.CanvasTexture;
  ffwcTex: THREE.CanvasTexture;
  dispose: () => void;
}

function hash2d(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Generates an organic sculpted glacier ice texture matching the classic Free Fire Gloo Wall:
 * pale frost-white / lavender-blue ice ridges with soft recessed icy pockets.
 */
function createClassicGlooTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#f3f7ff');
  grad.addColorStop(0.45, '#d5e2f7');
  grad.addColorStop(0.85, '#b6c9ea');
  grad.addColorStop(1, '#98afd9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Soft sculpted glacial pockets & bumps
  for (let i = 0; i < 85; i++) {
    const cx = hash2d(i, 1.3) * size;
    const cy = hash2d(i, 2.7) * size;
    const rx = 10 + hash2d(i, 4.1) * 24;
    const ry = 10 + hash2d(i, 5.9) * 28;
    const dark = i % 2 === 0;
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, Math.max(rx, ry));
    if (dark) {
      g.addColorStop(0, 'rgba(110, 134, 184, 0.36)');
      g.addColorStop(0.65, 'rgba(138, 162, 210, 0.16)');
      g.addColorStop(1, 'rgba(138, 162, 210, 0)');
    } else {
      g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      g.addColorStop(0.6, 'rgba(240, 247, 255, 0.2)');
      g.addColorStop(1, 'rgba(240, 247, 255, 0)');
    }
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Subtle vertical ice seams & frost veins
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 24; i++) {
    const sx = (i + 0.5) * (size / 24) + (hash2d(i, 9.2) - 0.5) * 6;
    ctx.strokeStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.42)' : 'rgba(122,146,196,0.28)';
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.bezierCurveTo(
      sx + (hash2d(i, 11.4) - 0.5) * 18,
      size * 0.33,
      sx + (hash2d(i, 13.7) - 0.5) * 18,
      size * 0.66,
      sx + (hash2d(i, 15.1) - 0.5) * 12,
      size,
    );
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates the FF World Cup 2019 ("Cup") compact tilted Gloo Wall texture:
 * - Upper icy white/silver glacier surface with subtle glowing cyan hexagon lattice
 * - Lower dark cityscape silhouette with bright cyan hex lines
 * - Twin golden angular side wings flanking a central black & gold "FREE FIRE WORLD CUP 2019" shield
 */
function createFfwcGlooTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // 1. Icy mottled silver-white background
  const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
  baseGrad.addColorStop(0, '#eef3f8');
  baseGrad.addColorStop(0.55, '#cfd9e6');
  baseGrad.addColorStop(0.75, '#95a5bc');
  baseGrad.addColorStop(1, '#11161f');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle ice shading clouds
  for (let i = 0; i < 65; i++) {
    const cx = hash2d(i, 3.1) * w;
    const cy = hash2d(i, 4.9) * (h * 0.8);
    const r = 16 + hash2d(i, 7.2) * 34;
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    if (i % 2 === 0) {
      g.addColorStop(0, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      g.addColorStop(0, 'rgba(105,120,145,0.28)');
      g.addColorStop(1, 'rgba(105,120,145,0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Glowing cyan hexagonal lattice across the ice
  const drawHex = (hx: number, hy: number, rad: number, stroke: string, lineW: number) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ang = (Math.PI / 3) * k + Math.PI / 6;
      const px = hx + Math.cos(ang) * rad;
      const py = hy + Math.sin(ang) * rad;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineW;
    ctx.stroke();
  };

  const hexR = 16;
  const dx = Math.sqrt(3) * hexR;
  const dy = 1.5 * hexR;
  for (let row = -1; row < Math.ceil(h / dy) + 2; row++) {
    for (let col = -1; col < Math.ceil(w / dx) + 2; col++) {
      const hx = col * dx + (row % 2 === 0 ? 0 : dx * 0.5);
      const hy = row * dy;
      const isBottom = hy > h * 0.68;
      drawHex(
        hx,
        hy,
        hexR,
        isBottom ? 'rgba(40, 224, 255, 0.55)' : 'rgba(56, 212, 248, 0.24)',
        isBottom ? 1.5 : 1.0,
      );
    }
  }

  // 3. Lower dark obsidian band + black city skyline silhouette
  const skyGrad = ctx.createLinearGradient(0, h * 0.62, 0, h);
  skyGrad.addColorStop(0, 'rgba(8, 12, 18, 0)');
  skyGrad.addColorStop(0.32, 'rgba(8, 12, 18, 0.92)');
  skyGrad.addColorStop(1, '#05070b');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  // City buildings silhouette on left and right lower sides (dips lower in center for shield)
  ctx.fillStyle = '#090c12';
  const buildings = [
    { x: 18, bw: 18, bh: 54 },
    { x: 40, bw: 24, bh: 74 },
    { x: 68, bw: 16, bh: 48 },
    { x: 88, bw: 22, bh: 68 },
    { x: 114, bw: 18, bh: 52 },
    { x: 136, bw: 15, bh: 40 },
    { x: 158, bw: 16, bh: 32 },
    { x: 338, bw: 16, bh: 34 },
    { x: 358, bw: 20, bh: 52 },
    { x: 382, bw: 24, bh: 72 },
    { x: 410, bw: 18, bh: 56 },
    { x: 432, bw: 24, bh: 66 },
    { x: 460, bw: 22, bh: 46 },
  ];
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    ctx.fillRect(b.x, h - b.bh - 18, b.bw, b.bh + 18);
  }

  // Crisp cyan hex lines overlaid on top of dark bottom band
  for (let row = 8; row < Math.ceil(h / dy) + 2; row++) {
    for (let col = -1; col < Math.ceil(w / dx) + 2; col++) {
      const hx = col * dx + (row % 2 === 0 ? 0 : dx * 0.5);
      const hy = row * dy;
      if (hy >= h * 0.72) {
        drawHex(hx, hy, hexR, 'rgba(42, 232, 255, 0.72)', 1.4);
      }
    }
  }

  // 4. Twin golden wing chevrons flanking center
  const drawGoldWing = (dir: -1 | 1) => {
    const cx = w * 0.5;
    const goldGrad = ctx.createLinearGradient(cx, h * 0.35, cx + dir * 210, h * 0.6);
    goldGrad.addColorStop(0, '#ca8a04');
    goldGrad.addColorStop(0.45, '#fde047');
    goldGrad.addColorStop(1, '#a16207');

    // Outer large blade
    ctx.beginPath();
    ctx.moveTo(cx + dir * 74, h * 0.58);
    ctx.lineTo(cx + dir * 184, h * 0.52);
    ctx.lineTo(cx + dir * 204, h * 0.31);
    ctx.lineTo(cx + dir * 168, h * 0.43);
    ctx.lineTo(cx + dir * 92, h * 0.49);
    ctx.closePath();
    ctx.fillStyle = goldGrad;
    ctx.fill();
    ctx.strokeStyle = '#713f12';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Inner accent shard
    ctx.beginPath();
    ctx.moveTo(cx + dir * 82, h * 0.44);
    ctx.lineTo(cx + dir * 138, h * 0.39);
    ctx.lineTo(cx + dir * 150, h * 0.30);
    ctx.lineTo(cx + dir * 98, h * 0.38);
    ctx.closePath();
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.stroke();
  };
  drawGoldWing(-1);
  drawGoldWing(1);

  // 5. Center FF World Cup 2019 Shield Emblem
  const cx = w * 0.5;
  const cy = h * 0.46;

  // Crossed dark rifle silhouettes behind shield
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 58, cy - 52);
  ctx.lineTo(cx + 52, cy + 44);
  ctx.moveTo(cx + 58, cy - 52);
  ctx.lineTo(cx - 52, cy + 44);
  ctx.stroke();

  // Outer shield polygon
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy - 34);
  ctx.lineTo(cx, cy - 42);
  ctx.lineTo(cx + 52, cy - 34);
  ctx.lineTo(cx + 42, cy + 16);
  ctx.lineTo(cx, cy + 56);
  ctx.lineTo(cx - 42, cy + 16);
  ctx.closePath();
  ctx.fillStyle = '#111318';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#eab308';
  ctx.stroke();

  // Golden crown above shield
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 42);
  ctx.lineTo(cx - 22, cy - 58);
  ctx.lineTo(cx - 9, cy - 49);
  ctx.lineTo(cx, cy - 64);
  ctx.lineTo(cx + 9, cy - 49);
  ctx.lineTo(cx + 22, cy - 58);
  ctx.lineTo(cx + 18, cy - 42);
  ctx.closePath();
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#713f12';
  ctx.stroke();

  // Gold ribbon bar across shield center
  ctx.beginPath();
  ctx.moveTo(cx - 56, cy - 2);
  ctx.lineTo(cx + 56, cy - 2);
  ctx.lineTo(cx + 46, cy + 20);
  ctx.lineTo(cx - 46, cy + 20);
  ctx.closePath();
  ctx.fillStyle = '#d97706';
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Emblem Typography
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 17px Impact, "Arial Black", sans-serif';
  ctx.fillText('FREE FIRE', cx, cy - 16);

  ctx.fillStyle = '#111318';
  ctx.font = '900 13px Impact, "Arial Black", sans-serif';
  ctx.fillText('WORLD CUP', cx, cy + 9);

  ctx.fillStyle = '#fde047';
  ctx.font = '900 13px "Arial Black", sans-serif';
  ctx.fillText('2019', cx, cy + 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a closed curved thick 3D Gloo Wall BufferGeometry whose bottom base rests flush at y = 0.
 * Local -Z faces forward (toward enemy); wings curve slightly back toward +Z to shield player flanks.
 */
function buildCurvedGlooGeometry(skin: GlooSkinId): THREE.BufferGeometry {
  const isFfwc = skin === 'ffwc';
  const uSegs = isFfwc ? 24 : 28;
  const vSegs = isFfwc ? 10 : 14;

  const halfSpan = isFfwc ? 1.5 : 2.15;
  const curveDepth = isFfwc ? 0.56 : 0.96;
  const baseThick = isFfwc ? 0.34 : 0.44;
  const baseHeight = isFfwc ? 0.9 : 2.35;
  const forwardLeanSlope = isFfwc ? -0.23 : 0; // leans upper body forward (-Z) while keeping base flush at y=0

  // Helper returning midline centerline point + thickness at normalized (u in [-1..1], v in [0..1])
  const samplePoint = (u: number, v: number, side: -1 | 1): [number, number, number] => {
    const absU = Math.abs(u);
    // U-arc centerline: apex near -0.28 at u=0, wings curve toward +Z
    const centerZ = -curveDepth * 0.34 + curveDepth * (absU * absU * 0.88 + absU * 0.12);
    const centerX = u * halfSpan * (1 - absU * 0.06);

    // Crest height profile (jagged glacier crown)
    let crestY = baseHeight;
    if (isFfwc) {
      // Slightly ragged crystalline top while keeping central walkable ridge ~0.96-1.02m
      const wave =
        Math.sin(u * 6.5) * 0.045 +
        Math.cos(u * 13.0) * 0.032 -
        Math.pow(absU, 2.8) * 0.08;
      crestY = baseHeight + wave;
    } else {
      const wave =
        Math.sin(u * 5.2 + 0.4) * 0.08 +
        Math.cos(u * 11.7) * 0.055 -
        Math.pow(absU, 3.0) * 0.16;
      crestY = baseHeight + wave;
    }

    const y = v * crestY;

    // Curve tangent & normal in XZ plane
    const dxdU = halfSpan * (1 - absU * 0.12);
    const dzdU = curveDepth * (1.76 * u + 0.12 * Math.sign(u));
    const tLen = Math.hypot(dxdU, dzdU) || 1;
    // Normal pointing outward toward -Z (enemy side) when side === 1, +Z (player side) when side === -1
    const nx = dzdU / tLen;
    const nz = -dxdU / tLen;

    // Organic bumpy surface displacement (zero at bottom row so floor contact stays tight)
    const bumpFade = Math.sin(Math.min(1, v * 1.15) * Math.PI * 0.5) * (1 - v * 0.15);
    const bumpAmp = isFfwc ? 0.028 : 0.072;
    const bump =
      bumpFade *
      bumpAmp *
      (Math.sin(u * 10.5 + v * 6.0 + side * 1.1) +
        0.55 * Math.cos(u * 19.0 - v * 9.5));

    // Slightly thicker base tapering subtly near crest
    const halfT = baseThick * 0.5 * (1 - v * (isFfwc ? 0.14 : 0.12)) + bump;

    // Forward tilt shear (-Z increases with y)
    const tiltZ = y * forwardLeanSlope;

    const px = centerX + nx * halfT * side;
    const pz = centerZ + nz * halfT * side + tiltZ;
    return [px, y, pz];
  };

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    uva: [number, number],
    uvb: [number, number],
    uvc: [number, number],
  ) => {
    const base = positions.length / 3;
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uvs.push(uva[0], uva[1], uvb[0], uvb[1], uvc[0], uvc[1]);
    indices.push(base, base + 1, base + 2);
  };

  const frontGrid: [number, number, number][][] = [];
  const backGrid: [number, number, number][][] = [];

  for (let iu = 0; iu <= uSegs; iu++) {
    const u = (iu / uSegs) * 2 - 1;
    frontGrid[iu] = [];
    backGrid[iu] = [];
    for (let iv = 0; iv <= vSegs; iv++) {
      const v = iv / vSegs;
      frontGrid[iu][iv] = samplePoint(u, v, 1);
      backGrid[iu][iv] = samplePoint(u, v, -1);
    }
  }

  // Front face (-Z outward) & Back face (+Z player-facing)
  for (let iu = 0; iu < uSegs; iu++) {
    const u0 = iu / uSegs;
    const u1 = (iu + 1) / uSegs;
    for (let iv = 0; iv < vSegs; iv++) {
      const v0 = iv / vSegs;
      const v1 = (iv + 1) / vSegs;

      // Front face (outward -Z: u increases +X, v increases +Y -> CCW facing -Z)
      const f00 = frontGrid[iu][iv];
      const f10 = frontGrid[iu + 1][iv];
      const f01 = frontGrid[iu][iv + 1];
      const f11 = frontGrid[iu + 1][iv + 1];
      pushTri(f00, f01, f11, [u0, v0], [u0, v1], [u1, v1]);
      pushTri(f00, f11, f10, [u0, v0], [u1, v1], [u1, v0]);

      // Back face (facing player +Z: CCW facing +Z, flip u horizontally so emblem reads cleanly from behind too)
      const b00 = backGrid[iu][iv];
      const b10 = backGrid[iu + 1][iv];
      const b01 = backGrid[iu][iv + 1];
      const b11 = backGrid[iu + 1][iv + 1];
      pushTri(b00, b11, b01, [1 - u0, v0], [1 - u1, v1], [1 - u0, v1]);
      pushTri(b00, b10, b11, [1 - u0, v0], [1 - u1, v0], [1 - u1, v1]);
    }
  }

  // Top crest cap & Bottom floor cap
  for (let iu = 0; iu < uSegs; iu++) {
    const u0 = iu / uSegs;
    const u1 = (iu + 1) / uSegs;

    // Top cap
    const ft0 = frontGrid[iu][vSegs];
    const ft1 = frontGrid[iu + 1][vSegs];
    const bt0 = backGrid[iu][vSegs];
    const bt1 = backGrid[iu + 1][vSegs];
    pushTri(bt0, ft1, ft0, [u0, 0.96], [u1, 1.0], [u0, 1.0]);
    pushTri(bt0, bt1, ft1, [u0, 0.96], [u1, 0.96], [u1, 1.0]);

    // Bottom cap
    const fb0 = frontGrid[iu][0];
    const fb1 = frontGrid[iu + 1][0];
    const bb0 = backGrid[iu][0];
    const bb1 = backGrid[iu + 1][0];
    pushTri(fb0, fb1, bb1, [u0, 0], [u1, 0], [u1, 0.04]);
    pushTri(fb0, bb1, bb0, [u0, 0], [u1, 0.04], [u0, 0.04]);
  }

  // Left & Right side wing end caps
  for (let iv = 0; iv < vSegs; iv++) {
    const v0 = iv / vSegs;
    const v1 = (iv + 1) / vSegs;

    // Left cap (iu = 0, normal -X)
    const lf0 = frontGrid[0][iv];
    const lf1 = frontGrid[0][iv + 1];
    const lb0 = backGrid[0][iv];
    const lb1 = backGrid[0][iv + 1];
    pushTri(lb0, lf1, lf0, [0.02, v0], [0.06, v1], [0.06, v0]);
    pushTri(lb0, lb1, lf1, [0.02, v0], [0.02, v1], [0.06, v1]);

    // Right cap (iu = uSegs, normal +X)
    const rf0 = frontGrid[uSegs][iv];
    const rf1 = frontGrid[uSegs][iv + 1];
    const rb0 = backGrid[uSegs][iv];
    const rb1 = backGrid[uSegs][iv + 1];
    pushTri(rf0, rf1, rb1, [0.94, v0], [0.94, v1], [0.98, v1]);
    pushTri(rf0, rb1, rb0, [0.94, v0], [0.98, v1], [0.98, v0]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function createGlooVariantAssets(maxAnisotropy: number): GlooVariantAssets {
  const classicTex = createClassicGlooTexture(maxAnisotropy);
  const ffwcTex = createFfwcGlooTexture(maxAnisotropy);

  const classicGeo = buildCurvedGlooGeometry('classic');
  const ffwcGeo = buildCurvedGlooGeometry('ffwc');

  const classicMat = new THREE.MeshStandardMaterial({
    map: classicTex,
    color: 0xffffff,
    emissive: 0x1e40af,
    emissiveIntensity: 0.14,
    roughness: 0.34,
    metalness: 0.08,
    transparent: true,
    opacity: 0.94,
  });

  const ffwcMat = new THREE.MeshStandardMaterial({
    map: ffwcTex,
    color: 0xffffff,
    emissive: 0x0e7490,
    emissiveIntensity: 0.18,
    roughness: 0.3,
    metalness: 0.16,
    transparent: true,
    opacity: 0.96,
  });

  const classicPreviewMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  const ffwcPreviewMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });

  return {
    classicGeo,
    ffwcGeo,
    classicMat,
    ffwcMat,
    classicPreviewMat,
    ffwcPreviewMat,
    classicTex,
    ffwcTex,
    dispose: () => {
      classicGeo.dispose();
      ffwcGeo.dispose();
      classicMat.dispose();
      ffwcMat.dispose();
      classicPreviewMat.dispose();
      ffwcPreviewMat.dispose();
      classicTex.dispose();
      ffwcTex.dispose();
    },
  };
}

/**
 * Generates curved 3-segment OBB colliders (and walkable top platforms for the jumpable 'ffwc' Cup gloo).
 */
export function buildGlooCollidersAndPlatforms(
  x: number,
  y: number,
  z: number,
  wallYaw: number,
  skin: GlooSkinId,
): { colliders: WorldObbCollider[]; platforms: WalkablePlatform[] } {
  const cos = Math.cos(wallYaw);
  const sin = Math.sin(wallYaw);

  const toWorld = (lx: number, lz: number): [number, number] => [
    x + lx * cos + lz * sin,
    z - lx * sin + lz * cos,
  ];

  const isFfwc = skin === 'ffwc';
  const height = isFfwc ? 0.88 : 2.35;

  // Center, Left angled wing (+rot), Right angled wing (-rot)
  const segments = isFfwc
    ? [
        { lx: 0, lz: -0.25, halfW: 0.68, halfD: 0.22, rotOffset: 0 },
        { lx: -1.0, lz: 0.04, halfW: 0.58, halfD: 0.22, rotOffset: 0.44 },
        { lx: 1.0, lz: 0.04, halfW: 0.58, halfD: 0.22, rotOffset: -0.44 },
      ]
    : [
        { lx: 0, lz: -0.26, halfW: 0.94, halfD: 0.25, rotOffset: 0 },
        { lx: -1.44, lz: 0.18, halfW: 0.88, halfD: 0.25, rotOffset: 0.52 },
        { lx: 1.44, lz: 0.18, halfW: 0.88, halfD: 0.25, rotOffset: -0.52 },
      ];

  const colliders: WorldObbCollider[] = [];
  const platforms: WalkablePlatform[] = [];

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const [wx, wz] = toWorld(s.lx, s.lz);
    const segRot = wallYaw + s.rotOffset;
    colliders.push({
      cx: wx,
      cz: wz,
      halfW: s.halfW,
      halfD: s.halfD,
      rotY: segRot,
      minY: y,
      maxY: y + height,
      tag: 'gloo-wall',
    });

    if (isFfwc) {
      // Slight forward shift at top matches the forward lean so footing aligns visually with the crest
      const [topWx, topWz] = toWorld(s.lx, s.lz - 0.14);
      platforms.push({
        cx: topWx,
        cz: topWz,
        halfW: s.halfW + 0.05,
        halfD: 0.32,
        rotY: segRot,
        topY: y + height,
        minY: y,
      });
    }
  }

  return { colliders, platforms };
}
