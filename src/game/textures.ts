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
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, Math.max(1, anisotropy));
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export interface ProceduralTextureSet {
  grass: THREE.CanvasTexture;
  foliage: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  rock: THREE.CanvasTexture;
  waterWave: THREE.CanvasTexture;
  dirtRoad: THREE.CanvasTexture;
  asphaltRoad: THREE.CanvasTexture;
  concrete: THREE.CanvasTexture;
  interiorFloor: THREE.CanvasTexture;
  stairConcrete: THREE.CanvasTexture;
  woodPlank: THREE.CanvasTexture;
  barnWood: THREE.CanvasTexture;
  stuccoWall: THREE.CanvasTexture;
  brickWall: THREE.CanvasTexture;
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
  // 1. Clean Bright Bermudian Meadow Grass (128x128 lightweight, zero muddy blotches)
  const [grassC, grassCtx] = makeCanvas(128);
  grassCtx.fillStyle = '#6c8742';
  grassCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 42; i++) {
    const cx = (i * 47 + (i % 5) * 13) % 128;
    const cy = (i * 73 + (i % 7) * 11) % 128;
    const r = 7 + (i % 4) * 4;
    grassCtx.fillStyle =
      i % 3 === 0
        ? 'rgba(130, 160, 76, 0.34)'
        : i % 3 === 1
          ? 'rgba(84, 110, 48, 0.30)'
          : 'rgba(146, 134, 82, 0.20)';
    for (let ox = -128; ox <= 128; ox += 128) {
      for (let oy = -128; oy <= 128; oy += 128) {
        grassCtx.beginPath();
        grassCtx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        grassCtx.fill();
      }
    }
  }
  grassCtx.lineWidth = 1.3;
  for (let i = 0; i < 110; i++) {
    const x = (i * 31) % 128;
    const y = (i * 53) % 128;
    grassCtx.strokeStyle =
      i % 2 === 0 ? 'rgba(154, 184, 92, 0.45)' : 'rgba(74, 102, 42, 0.40)';
    grassCtx.beginPath();
    grassCtx.moveTo(x, y);
    grassCtx.quadraticCurveTo(x + 3, y - 4, x + 7, y - 1);
    grassCtx.stroke();
  }
  const grass = finalizeTexture(grassC, maxAnisotropy, 64, 64);

  // 1b. Crisp Leaf Canopy Texture (128x128)
  const [folC, folCtx] = makeCanvas(128);
  folCtx.fillStyle = '#537c31';
  folCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 95; i++) {
    const cx = (i * 37) % 128;
    const cy = (i * 59) % 128;
    const r = 6 + (i % 4) * 3;
    folCtx.fillStyle =
      i % 3 === 0
        ? 'rgba(128, 170, 74, 0.55)'
        : i % 3 === 1
          ? 'rgba(56, 88, 30, 0.50)'
          : 'rgba(94, 136, 52, 0.48)';
    for (let ox = -128; ox <= 128; ox += 128) {
      for (let oy = -128; oy <= 128; oy += 128) {
        folCtx.beginPath();
        folCtx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        folCtx.fill();
      }
    }
  }
  const foliage = finalizeTexture(folC, maxAnisotropy, 2, 2);

  // 1c. Tree Bark Texture (64x64)
  const [barkC, barkCtx] = makeCanvas(64);
  barkCtx.fillStyle = '#634730';
  barkCtx.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 6) {
    barkCtx.fillStyle = x % 12 === 0 ? '#503723' : '#73543b';
    barkCtx.fillRect(x, 0, 3, 64);
  }
  const bark = finalizeTexture(barkC, maxAnisotropy, 1, 2);

  // 1d. Smooth Natural Rock Texture (128x128)
  const [rockC, rockCtx] = makeCanvas(128);
  rockCtx.fillStyle = '#8b8a82';
  rockCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 48; i++) {
    const cx = (i * 43) % 128;
    const cy = (i * 67) % 128;
    const r = 8 + (i % 4) * 5;
    rockCtx.fillStyle =
      i % 2 === 0 ? 'rgba(166, 164, 156, 0.36)' : 'rgba(92, 90, 84, 0.32)';
    for (let ox = -128; ox <= 128; ox += 128) {
      for (let oy = -128; oy <= 128; oy += 128) {
        rockCtx.beginPath();
        rockCtx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        rockCtx.fill();
      }
    }
  }
  const rock = finalizeTexture(rockC, maxAnisotropy, 2, 2);

  // 1e. Seamless Turquoise Ocean Ripples (128x128)
  const [watC, watCtx] = makeCanvas(128);
  watCtx.fillStyle = '#247ba8';
  watCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 28; i++) {
    const cx = (i * 47) % 128;
    const cy = (i * 71) % 128;
    watCtx.fillStyle = i % 2 === 0 ? 'rgba(66, 165, 212, 0.34)' : 'rgba(20, 86, 126, 0.30)';
    watCtx.beginPath();
    watCtx.ellipse(cx, cy, 18, 8, (i % 5) * 0.2, 0, Math.PI * 2);
    watCtx.fill();
  }
  watCtx.strokeStyle = 'rgba(194, 236, 255, 0.34)';
  watCtx.lineWidth = 1.6;
  for (let y = 10; y < 128; y += 18) {
    watCtx.beginPath();
    watCtx.moveTo(0, y);
    watCtx.bezierCurveTo(32, y - 5, 96, y + 5, 128, y);
    watCtx.stroke();
  }
  const waterWave = finalizeTexture(watC, maxAnisotropy, 44, 44);

  // 2. Dirt road (64x64)
  const [roadC, roadCtx] = makeCanvas(64);
  roadCtx.fillStyle = '#8b7454';
  roadCtx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 110; i++) {
    roadCtx.fillStyle = i % 2 === 0 ? '#7b6548' : '#9c8462';
    roadCtx.fillRect((i * 19) % 64, (i * 29) % 64, 3, 2);
  }
  roadCtx.fillStyle = 'rgba(64, 50, 34, 0.28)';
  roadCtx.fillRect(10, 0, 5, 64);
  roadCtx.fillRect(49, 0, 5, 64);
  const dirtRoad = finalizeTexture(roadC, maxAnisotropy, 1, 6);

  // 2b. Crisp Asphalt Highway (64x64)
  const [aspC, aspCtx] = makeCanvas(64);
  aspCtx.fillStyle = '#50555c';
  aspCtx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 120; i++) {
    aspCtx.fillStyle = i % 2 === 0 ? '#45494f' : '#5e636b';
    aspCtx.fillRect((i * 29) % 64, (i * 17) % 64, 2, 2);
  }
  aspCtx.fillStyle = '#ebd788';
  aspCtx.fillRect(30, 6, 4, 20);
  aspCtx.fillRect(30, 38, 4, 20);
  aspCtx.fillStyle = 'rgba(255,255,255,0.34)';
  aspCtx.fillRect(3, 0, 2, 64);
  aspCtx.fillRect(59, 0, 2, 64);
  const asphaltRoad = finalizeTexture(aspC, maxAnisotropy, 1, 2);

  // 3. Bright Structural Concrete (128x128)
  const [concC, concCtx] = makeCanvas(128);
  concCtx.fillStyle = '#7b8085';
  concCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 180; i++) {
    concCtx.fillStyle = i % 2 === 0 ? '#70757a' : '#888e94';
    concCtx.fillRect((i * 23) % 128, (i * 41) % 128, 3, 3);
  }
  concCtx.strokeStyle = 'rgba(42, 46, 52, 0.35)';
  concCtx.lineWidth = 2;
  concCtx.strokeRect(1, 1, 126, 126);
  const concrete = finalizeTexture(concC, maxAnisotropy, 4, 4);

  // 3b. Clean Bright Interior Floor Tile (128x128) — keeps indoor rooms readable!
  const [flC, flCtx] = makeCanvas(128);
  flCtx.fillStyle = '#cec5b2';
  flCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 32) {
    for (let x = 0; x < 128; x += 32) {
      flCtx.fillStyle = ((x + y) / 32) % 2 === 0 ? '#d8d0be' : '#c5bba7';
      flCtx.fillRect(x + 1, y + 1, 30, 30);
    }
  }
  flCtx.strokeStyle = 'rgba(110, 102, 88, 0.32)';
  flCtx.lineWidth = 1;
  for (let k = 0; k <= 128; k += 32) {
    flCtx.beginPath();
    flCtx.moveTo(k, 0);
    flCtx.lineTo(k, 128);
    flCtx.moveTo(0, k);
    flCtx.lineTo(128, k);
    flCtx.stroke();
  }
  const interiorFloor = finalizeTexture(flC, maxAnisotropy, 3, 3);

  // 3c. High-Contrast Stair Step Texture (64x64)
  const [stC, stCtx] = makeCanvas(64);
  stCtx.fillStyle = '#9aa0a6';
  stCtx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    stCtx.fillStyle = '#b4bac0';
    stCtx.fillRect(0, y, 64, 5);
    stCtx.fillStyle = '#d97706';
    stCtx.fillRect(0, y + 5, 64, 1);
    stCtx.fillStyle = '#4b5259';
    stCtx.fillRect(0, y + 6, 64, 2);
  }
  const stairConcrete = finalizeTexture(stC, maxAnisotropy, 1, 2);

  // 4. Weathered Wooden Planks (128x128)
  const [woodC, woodCtx] = makeCanvas(128);
  woodCtx.fillStyle = '#9e7853';
  woodCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    woodCtx.fillStyle = y % 32 === 0 ? '#916c49' : '#ac845e';
    woodCtx.fillRect(0, y, 128, 15);
    woodCtx.fillStyle = '#5c4129';
    woodCtx.fillRect(0, y + 15, 128, 1);
  }
  const woodPlank = finalizeTexture(woodC, maxAnisotropy, 2, 2);

  // 4b. Classic Free Fire Celeiro Red Barn Wood (128x128)
  const [barnC, barnCtx] = makeCanvas(128);
  barnCtx.fillStyle = '#9b352c';
  barnCtx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) {
    barnCtx.fillStyle = x % 32 === 0 ? '#8a2d25' : '#a83d33';
    barnCtx.fillRect(x, 0, 15, 128);
    barnCtx.fillStyle = '#591b16';
    barnCtx.fillRect(x + 15, 0, 1, 128);
  }
  barnCtx.fillStyle = '#e6dfd3';
  barnCtx.fillRect(0, 0, 128, 6);
  barnCtx.fillRect(0, 122, 128, 6);
  const barnWood = finalizeTexture(barnC, maxAnisotropy, 2, 1);

  // 4c. Clean Stucco House Wall (128x128)
  const [stuccoC, stuccoCtx] = makeCanvas(128);
  stuccoCtx.fillStyle = '#dfd5be';
  stuccoCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 180; i++) {
    stuccoCtx.fillStyle = i % 2 === 0 ? '#d5cab1' : '#e8dec8';
    stuccoCtx.fillRect((i * 31) % 128, (i * 47) % 128, 4, 3);
  }
  stuccoCtx.fillStyle = 'rgba(92, 80, 64, 0.22)';
  stuccoCtx.fillRect(0, 112, 128, 16);
  const stuccoWall = finalizeTexture(stuccoC, maxAnisotropy, 2, 1);

  // 4d. Casa God / Sobrado Painted Brick & Concrete Wall (128x128)
  const [brickC, brickCtx] = makeCanvas(128);
  brickCtx.fillStyle = '#c4a67e';
  brickCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    const offset = (y / 16) % 2 === 0 ? 0 : 16;
    for (let x = -16; x < 128; x += 32) {
      brickCtx.fillStyle = ((x + y) / 16) % 3 === 0 ? '#b7976e' : '#ccaE86';
      brickCtx.fillRect(x + offset + 1, y + 1, 30, 14);
    }
  }
  brickCtx.fillStyle = '#6c727a';
  brickCtx.fillRect(0, 110, 128, 18);
  const brickWall = finalizeTexture(brickC, maxAnisotropy, 2, 1);

  // 4e. Corrugated Industrial Shed Metal (128x128)
  const [shedC, shedCtx] = makeCanvas(128);
  shedCtx.fillStyle = '#6a747b';
  shedCtx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    shedCtx.fillStyle = '#586067';
    shedCtx.fillRect(x, 0, 3, 128);
    shedCtx.fillStyle = '#7e8991';
    shedCtx.fillRect(x + 3, 0, 2, 128);
  }
  const shedMetal = finalizeTexture(shedC, maxAnisotropy, 3, 1);

  // 5. Terracotta Roof Tiles (64x64)
  const [roofC, roofCtx] = makeCanvas(64);
  roofCtx.fillStyle = '#9c4333';
  roofCtx.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 8) {
    roofCtx.fillStyle = x % 16 === 0 ? '#843527' : '#b24e3c';
    roofCtx.fillRect(x, 0, 4, 64);
  }
  const roofTile = finalizeTexture(roofC, maxAnisotropy, 3, 3);

  // 6. Corrugated Shipping Containers (Blue & Rust)
  const makeContainer = (base: string, dark: string, light: string) => {
    const [c, ctx] = makeCanvas(64);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 6) {
      ctx.fillStyle = dark;
      ctx.fillRect(x, 0, 2, 64);
      ctx.fillStyle = light;
      ctx.fillRect(x + 2, 0, 2, 64);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(6, 24, 22, 4);
    return finalizeTexture(c, maxAnisotropy, 2, 1);
  };
  const containerBlue = makeContainer('#2b5a78', '#1e4259', '#3b7396');
  const containerRust = makeContainer('#8c492e', '#6c3721', '#a45a3c');

  // 7. Camo Parachute Canopy (128x128)
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

  // 8. Soft Radial Contact Shadow (64x64)
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
    bark,
    rock,
    waterWave,
    dirtRoad,
    asphaltRoad,
    concrete,
    interiorFloor,
    stairConcrete,
    woodPlank,
    barnWood,
    stuccoWall,
    brickWall,
    shedMetal,
    roofTile,
    containerBlue,
    containerRust,
    camoParachute,
    contactShadow,
    dispose: () => {
      grass.dispose();
      foliage.dispose();
      bark.dispose();
      rock.dispose();
      waterWave.dispose();
      dirtRoad.dispose();
      asphaltRoad.dispose();
      concrete.dispose();
      interiorFloor.dispose();
      stairConcrete.dispose();
      woodPlank.dispose();
      barnWood.dispose();
      stuccoWall.dispose();
      brickWall.dispose();
      shedMetal.dispose();
      roofTile.dispose();
      containerBlue.dispose();
      containerRust.dispose();
      camoParachute.dispose();
      contactShadow.dispose();
    },
  };
}
