import * as THREE from 'three';

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  pixelated = true,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  if (pixelated) {
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
  }
  tex.needsUpdate = true;
  return tex;
}

export interface ProceduralTextureSet {
  grass: THREE.CanvasTexture;
  foliage: THREE.CanvasTexture;
  rock: THREE.CanvasTexture;
  waterWave: THREE.CanvasTexture;
  dirtRoad: THREE.CanvasTexture;
  asphaltRoad: THREE.CanvasTexture;
  concrete: THREE.CanvasTexture;
  woodPlank: THREE.CanvasTexture;
  stuccoWall: THREE.CanvasTexture;
  shedMetal: THREE.CanvasTexture;
  roofTile: THREE.CanvasTexture;
  containerBlue: THREE.CanvasTexture;
  containerRust: THREE.CanvasTexture;
  camoParachute: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(
  maxAnisotropy: number,
): ProceduralTextureSet {
  // 1. Realistic Organic Wavy Grass/Earth Texture (256x256, rounded patches + curved grass waves)
  const [grassC, grassCtx] = makeCanvas(256);
  grassCtx.fillStyle = '#586a37';
  grassCtx.fillRect(0, 0, 256, 256);

  // Soft rounded organic soil & moss blotches (tiled seamlessly via 3x3 wrap)
  for (let i = 0; i < 65; i++) {
    const cx = (i * 53 + (i % 7) * 19) % 256;
    const cy = (i * 89 + (i % 5) * 23) % 256;
    const r = 10 + (i % 5) * 6;
    const col =
      i % 4 === 0
        ? 'rgba(72, 92, 42, 0.42)'
        : i % 4 === 1
          ? 'rgba(108, 122, 62, 0.36)'
          : i % 4 === 2
            ? 'rgba(118, 100, 62, 0.28)'
            : 'rgba(65, 82, 36, 0.38)';
    grassCtx.fillStyle = col;
    for (let ox = -256; ox <= 256; ox += 256) {
      for (let oy = -256; oy <= 256; oy += 256) {
        grassCtx.beginPath();
        grassCtx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        grassCtx.fill();
      }
    }
  }
  // Curved wavy grass strokes for organic field texture
  grassCtx.lineWidth = 1.6;
  for (let i = 0; i < 240; i++) {
    const x = (i * 41) % 256;
    const y = (i * 73) % 256;
    grassCtx.strokeStyle =
      i % 3 === 0
        ? 'rgba(132, 152, 74, 0.5)'
        : i % 3 === 1
          ? 'rgba(62, 82, 34, 0.5)'
          : 'rgba(96, 114, 52, 0.45)';
    grassCtx.beginPath();
    grassCtx.moveTo(x, y);
    grassCtx.quadraticCurveTo(x + 4, y - 5, x + 9, y - 2);
    grassCtx.stroke();
  }
  const grass = finalizeTexture(grassC, maxAnisotropy, 56, 56, false);

  // 1b. Rounded Organic Leaf Canopy Texture (128x128) for trees & bushes
  const [folC, folCtx] = makeCanvas(128);
  folCtx.fillStyle = '#4e6f2d';
  folCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 120; i++) {
    const cx = (i * 37) % 128;
    const cy = (i * 59) % 128;
    const r = 6 + (i % 4) * 3;
    folCtx.fillStyle =
      i % 3 === 0
        ? 'rgba(116, 152, 68, 0.55)'
        : i % 3 === 1
          ? 'rgba(54, 82, 30, 0.55)'
          : 'rgba(84, 122, 46, 0.5)';
    for (let ox = -128; ox <= 128; ox += 128) {
      for (let oy = -128; oy <= 128; oy += 128) {
        folCtx.beginPath();
        folCtx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        folCtx.fill();
      }
    }
  }
  const foliage = finalizeTexture(folC, maxAnisotropy, 2, 2, false);

  // 1c. Rounded Wavy Natural Stone / Rock Texture (128x128)
  const [rockC, rockCtx] = makeCanvas(128);
  rockCtx.fillStyle = '#7c7b74';
  rockCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) {
    const cx = (i * 43) % 128;
    const cy = (i * 67) % 128;
    const r = 8 + (i % 4) * 5;
    rockCtx.fillStyle =
      i % 3 === 0
        ? 'rgba(154, 152, 144, 0.38)'
        : i % 3 === 1
          ? 'rgba(86, 84, 78, 0.36)'
          : 'rgba(118, 114, 102, 0.32)';
    for (let ox = -128; ox <= 128; ox += 128) {
      for (let oy = -128; oy <= 128; oy += 128) {
        rockCtx.beginPath();
        rockCtx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        rockCtx.fill();
      }
    }
  }
  rockCtx.strokeStyle = 'rgba(62, 60, 56, 0.35)';
  rockCtx.lineWidth = 2;
  for (let y = 16; y < 128; y += 26) {
    rockCtx.beginPath();
    rockCtx.moveTo(0, y);
    rockCtx.bezierCurveTo(42, y - 8, 86, y + 8, 128, y);
    rockCtx.stroke();
  }
  const rock = finalizeTexture(rockC, maxAnisotropy, 2, 2, false);

  // 1d. Seamless Wavy Ocean / River Ripples Texture (128x128)
  const [watC, watCtx] = makeCanvas(128);
  watCtx.fillStyle = '#206891';
  watCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 36; i++) {
    const cx = (i * 47) % 128;
    const cy = (i * 71) % 128;
    watCtx.fillStyle = i % 2 === 0 ? 'rgba(54, 140, 184, 0.35)' : 'rgba(18, 76, 112, 0.35)';
    watCtx.beginPath();
    watCtx.ellipse(cx, cy, 18, 8, (i % 5) * 0.2, 0, Math.PI * 2);
    watCtx.fill();
  }
  watCtx.strokeStyle = 'rgba(176, 226, 248, 0.34)';
  watCtx.lineWidth = 1.8;
  for (let y = 8; y < 128; y += 16) {
    watCtx.beginPath();
    watCtx.moveTo(0, y);
    watCtx.bezierCurveTo(32, y - 5, 96, y + 5, 128, y);
    watCtx.stroke();
  }
  const waterWave = finalizeTexture(watC, maxAnisotropy, 44, 44, false);

  // 2. Dirt road (64x64)
  const [roadC, roadCtx] = makeCanvas(64);
  roadCtx.fillStyle = '#7e6a4e';
  roadCtx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 160; i++) {
    roadCtx.fillStyle = i % 2 === 0 ? '#6e5b41' : '#8e785a';
    roadCtx.fillRect((i * 19) % 64, (i * 29) % 64, 3, 2);
  }
  roadCtx.fillStyle = 'rgba(60, 48, 32, 0.35)';
  roadCtx.fillRect(10, 0, 5, 64);
  roadCtx.fillRect(49, 0, 5, 64);
  const dirtRoad = finalizeTexture(roadC, maxAnisotropy, 1, 6);

  // 2b. Paved Asphalt Highway (64x64)
  const [aspC, aspCtx] = makeCanvas(64);
  aspCtx.fillStyle = '#484b50';
  aspCtx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 180; i++) {
    aspCtx.fillStyle = i % 2 === 0 ? '#3d4045' : '#55595e';
    aspCtx.fillRect((i * 29) % 64, (i * 17) % 64, 2, 2);
  }
  aspCtx.fillStyle = '#d4c890';
  aspCtx.fillRect(30, 6, 4, 20);
  aspCtx.fillRect(30, 38, 4, 20);
  aspCtx.fillStyle = 'rgba(255,255,255,0.28)';
  aspCtx.fillRect(3, 0, 2, 64);
  aspCtx.fillRect(59, 0, 2, 64);
  const asphaltRoad = finalizeTexture(aspC, maxAnisotropy, 1, 2);

  // 3. Industrial concrete (128x128) for Lobby & Bridge/Runway
  const [concC, concCtx] = makeCanvas(128);
  concCtx.fillStyle = '#525659';
  concCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 360; i++) {
    concCtx.fillStyle = i % 2 === 0 ? '#474b4e' : '#5e6266';
    concCtx.fillRect((i * 23) % 128, (i * 41) % 128, 3, 3);
  }
  concCtx.strokeStyle = 'rgba(22, 24, 26, 0.45)';
  concCtx.lineWidth = 2;
  concCtx.strokeRect(1, 1, 126, 126);
  concCtx.beginPath();
  concCtx.moveTo(64, 0);
  concCtx.lineTo(64, 128);
  concCtx.moveTo(0, 64);
  concCtx.lineTo(128, 64);
  concCtx.stroke();
  const concrete = finalizeTexture(concC, maxAnisotropy, 6, 6);

  // 4. Weathered wooden planks (128x128)
  const [woodC, woodCtx] = makeCanvas(128);
  woodCtx.fillStyle = '#8b6848';
  woodCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    woodCtx.fillStyle = y % 32 === 0 ? '#7e5d3f' : '#967252';
    woodCtx.fillRect(0, y, 128, 15);
    woodCtx.fillStyle = '#4b3421';
    woodCtx.fillRect(0, y + 15, 128, 1);
  }
  const woodPlank = finalizeTexture(woodC, maxAnisotropy, 2, 2);

  // 4b. Weathered Stucco / Plaster House Wall (128x128)
  const [stuccoC, stuccoCtx] = makeCanvas(128);
  stuccoCtx.fillStyle = '#cfc4ac';
  stuccoCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 320; i++) {
    stuccoCtx.fillStyle = i % 2 === 0 ? '#c2b69d' : '#dcd2bb';
    stuccoCtx.fillRect((i * 31) % 128, (i * 47) % 128, 4, 3);
  }
  stuccoCtx.fillStyle = 'rgba(72, 62, 48, 0.28)';
  stuccoCtx.fillRect(0, 108, 128, 20);
  const stuccoWall = finalizeTexture(stuccoC, maxAnisotropy, 2, 1);

  // 4c. Corrugated Industrial Shed Metal (128x128)
  const [shedC, shedCtx] = makeCanvas(128);
  shedCtx.fillStyle = '#60686e';
  shedCtx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    shedCtx.fillStyle = '#4f565c';
    shedCtx.fillRect(x, 0, 3, 128);
    shedCtx.fillStyle = '#737c83';
    shedCtx.fillRect(x + 3, 0, 2, 128);
  }
  shedCtx.fillStyle = 'rgba(110, 62, 34, 0.25)';
  shedCtx.fillRect(0, 96, 128, 32);
  const shedMetal = finalizeTexture(shedC, maxAnisotropy, 3, 1);

  // 5. Terracotta / Rusty corrugated roof (64x64)
  const [roofC, roofCtx] = makeCanvas(64);
  roofCtx.fillStyle = '#8e3c2e';
  roofCtx.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 8) {
    roofCtx.fillStyle = x % 16 === 0 ? '#772f23' : '#a14637';
    roofCtx.fillRect(x, 0, 4, 64);
  }
  const roofTile = finalizeTexture(roofC, maxAnisotropy, 3, 3);

  // 6. Corrugated shipping container (Blue & Rust)
  const makeContainer = (base: string, dark: string, light: string) => {
    const [c, ctx] = makeCanvas(128);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 8) {
      ctx.fillStyle = dark;
      ctx.fillRect(x, 0, 3, 128);
      ctx.fillStyle = light;
      ctx.fillRect(x + 3, 0, 2, 128);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(10, 48, 44, 6);
    ctx.fillRect(10, 58, 28, 4);
    return finalizeTexture(c, maxAnisotropy, 2, 1);
  };
  const containerBlue = makeContainer('#264e68', '#1a384c', '#346482');
  const containerRust = makeContainer('#7c4028', '#5e2f1d', '#924f34');

  // 7. Rounded Camo parachute canopy (128x128)
  const [camoC, camoCtx] = makeCanvas(128);
  camoCtx.fillStyle = '#60683c';
  camoCtx.fillRect(0, 0, 128, 128);
  const blobs = [
    { x: 30, y: 28, rx: 22, ry: 14, c: '#3d4528' },
    { x: 88, y: 26, rx: 24, ry: 16, c: '#867850' },
    { x: 56, y: 80, rx: 28, ry: 15, c: '#323620' },
    { x: 102, y: 98, rx: 18, ry: 18, c: '#867850' },
    { x: 20, y: 102, rx: 20, ry: 14, c: '#3d4528' },
  ];
  blobs.forEach((b) => {
    camoCtx.fillStyle = b.c;
    camoCtx.beginPath();
    camoCtx.ellipse(b.x, b.y, b.rx, b.ry, 0.3, 0, Math.PI * 2);
    camoCtx.fill();
  });
  camoCtx.strokeStyle = 'rgba(20, 24, 14, 0.55)';
  camoCtx.lineWidth = 2;
  for (let x = 0; x <= 128; x += 16) {
    camoCtx.beginPath();
    camoCtx.moveTo(x, 0);
    camoCtx.lineTo(x, 128);
    camoCtx.stroke();
  }
  const camoParachute = finalizeTexture(camoC, maxAnisotropy, 1, 1);

  // 8. Soft radial contact shadow (64x64)
  const [shC, shCtx] = makeCanvas(64);
  const grad = shCtx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 64, 64);
  const contactShadow = new THREE.CanvasTexture(shC);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;

  return {
    grass,
    foliage,
    rock,
    waterWave,
    dirtRoad,
    asphaltRoad,
    concrete,
    woodPlank,
    stuccoWall,
    shedMetal,
    roofTile,
    containerBlue,
    containerRust,
    camoParachute,
    contactShadow,
    dispose: () => {
      grass.dispose();
      foliage.dispose();
      rock.dispose();
      waterWave.dispose();
      dirtRoad.dispose();
      asphaltRoad.dispose();
      concrete.dispose();
      woodPlank.dispose();
      stuccoWall.dispose();
      shedMetal.dispose();
      roofTile.dispose();
      containerBlue.dispose();
      containerRust.dispose();
      camoParachute.dispose();
      contactShadow.dispose();
    },
  };
}
