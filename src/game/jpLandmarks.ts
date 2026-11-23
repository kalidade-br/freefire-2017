import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BuildingNavZone,
  WalkablePlatform,
  WorldObbCollider,
} from './types';
import { BuildingLootPoint } from './buildingPrefabs';
import { ProceduralTextureSet } from './textures';

export interface JpLandmarkMaterials {
  concrete: THREE.Material;
  calcadaoWave: THREE.Material;
  modernGlass: THREE.Material;
  colonialPastel: THREE.Material;
  plazaStone: THREE.Material;
  interiorFloor: THREE.Material;
  stairConcrete: THREE.Material;
  roofTile: THREE.Material;
  woodPlank: THREE.Material;
  whiteModern: THREE.Material;
  accentBlue: THREE.Material;
  trimGold: THREE.Material;
}

export interface LandmarkBuildOutput {
  group: THREE.Group;
  lootPoints: BuildingLootPoint[];
  navZones: BuildingNavZone[];
}

function safeMerge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => {
    const nonIdx = g.index ? g.toNonIndexed() : g.clone();
    if (!nonIdx.getAttribute('normal')) nonIdx.computeVertexNormals();
    if (!nonIdx.getAttribute('uv')) {
      const count = nonIdx.getAttribute('position').count;
      nonIdx.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    g.dispose();
    return nonIdx;
  });
  const merged = mergeGeometries(prepared, false);
  prepared.forEach((p) => p.dispose());
  return merged ?? new THREE.BoxGeometry(1, 1, 1);
}

function addLocalObb(
  colliders: WorldObbCollider[],
  parentX: number,
  parentY: number,
  parentZ: number,
  parentRotY: number,
  localX: number,
  localZ: number,
  w: number,
  d: number,
  minYOffset: number,
  maxYOffset: number,
  tag: string,
): void {
  const cos = Math.cos(parentRotY);
  const sin = Math.sin(parentRotY);
  const wx = parentX + localX * cos + localZ * sin;
  const wz = parentZ - localX * sin + localZ * cos;
  colliders.push({
    cx: wx,
    cz: wz,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY: parentRotY,
    minY: parentY + minYOffset,
    maxY: parentY + maxYOffset,
    tag,
  });
}

function addLocalPlatform(
  platforms: WalkablePlatform[],
  parentX: number,
  parentY: number,
  parentZ: number,
  parentRotY: number,
  localX: number,
  localZ: number,
  w: number,
  d: number,
  topYOffset: number,
  minYOffset = -0.5,
): void {
  const cos = Math.cos(parentRotY);
  const sin = Math.sin(parentRotY);
  const wx = parentX + localX * cos + localZ * sin;
  const wz = parentZ - localX * sin + localZ * cos;
  platforms.push({
    cx: wx,
    cz: wz,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY: parentRotY,
    topY: parentY + topYOffset,
    minY: parentY + minYOffset,
  });
}

function addLocalStair(
  platforms: WalkablePlatform[],
  parentX: number,
  parentY: number,
  parentZ: number,
  parentRotY: number,
  localX: number,
  localZ: number,
  w: number,
  d: number,
  slopeAxis: 'x' | 'z',
  yNegOffset: number,
  yPosOffset: number,
): void {
  const cos = Math.cos(parentRotY);
  const sin = Math.sin(parentRotY);
  const wx = parentX + localX * cos + localZ * sin;
  const wz = parentZ - localX * sin + localZ * cos;
  platforms.push({
    cx: wx,
    cz: wz,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY: parentRotY,
    topY: parentY + Math.max(yNegOffset, yPosOffset),
    minY: parentY + Math.min(yNegOffset, yPosOffset) - 0.5,
    slopeAxis,
    topYNeg: parentY + yNegOffset,
    topYPos: parentY + yPosOffset,
  });
}

function toWorldPt(
  parentX: number,
  parentZ: number,
  parentRotY: number,
  lx: number,
  lz: number,
): { x: number; z: number } {
  const cos = Math.cos(parentRotY);
  const sin = Math.sin(parentRotY);
  return {
    x: parentX + lx * cos + lz * sin,
    z: parentZ - lx * sin + lz * cos,
  };
}

/**
 * 1. Letreiro "JOÃO [Sol] PESSOA" — Busto de Tamandaré / Largo de Tambaú
 * Baseado fielmente na foto enviada: base azul turquesa, letras brancas em 3D,
 * "O" solar colorido em gomos e guarda-corpo branco dos lados.
 */
export function createLetreiroJoaoPessoa(
  x: number,
  y: number,
  z: number,
  rotY: number,
  mats: JpLandmarkMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  // Pedra Portuguesa circular boardwalk plaza beneath monument
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16.5, 0.36, 20),
    mats.calcadaoWave,
  );
  plaza.position.y = 0.14;
  plaza.receiveShadow = true;
  group.add(plaza);
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, 26, 26, 0.32, -0.4);

  // Turquoise blue concrete plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.85, 2.2), mats.accentBlue);
  plinth.position.set(0, 0.65, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);
  obstacleMeshes.push(plinth);
  addLocalObb(colliders, x, y, z, rotY, 0, 0, 17.5, 2.2, 0, 1.2, 'letreiro-plinth');
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, 17.5, 2.2, 1.08, 0.2);

  // Crisp double-sided banner panel texture for JOÃO + PESSOA letters + colorful sun ring
  const buildTextCanvas = (text: string, widthPx: number): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = widthPx;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(0, 114, c.width, 14);
    ctx.font = '900 96px Arial Black, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeText(text, c.width * 0.5, 62);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, c.width * 0.5, 62);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const joaoTex = buildTextCanvas('JOÃO', 256);
  const pessoaTex = buildTextCanvas('PESSOA', 384);

  const joaoMat = new THREE.MeshStandardMaterial({
    map: joaoTex,
    transparent: true,
    alphaTest: 0.25,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  joaoMat.userData.disposeMap = true;
  const pessoaMat = new THREE.MeshStandardMaterial({
    map: pessoaTex,
    transparent: true,
    alphaTest: 0.25,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  pessoaMat.userData.disposeMap = true;

  // Solid thick white letter blocks + textured crisp faces
  const joaoCore = new THREE.Mesh(new THREE.BoxGeometry(5.1, 1.75, 0.55), mats.whiteModern);
  joaoCore.position.set(-5.1, 1.92, 0);
  joaoCore.castShadow = true;
  const joaoFaceF = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 1.95), joaoMat);
  joaoFaceF.position.set(-5.1, 1.95, 0.29);
  const joaoFaceB = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 1.95), joaoMat);
  joaoFaceB.position.set(-5.1, 1.95, -0.29);
  joaoFaceB.rotation.y = Math.PI;

  const pessoaCore = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.75, 0.55), mats.whiteModern);
  pessoaCore.position.set(4.6, 1.92, 0);
  pessoaCore.castShadow = true;
  const pessoaFaceF = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.95), pessoaMat);
  pessoaFaceF.position.set(4.6, 1.95, 0.29);
  const pessoaFaceB = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.95), pessoaMat);
  pessoaFaceB.position.set(4.6, 1.95, -0.29);
  pessoaFaceB.rotation.y = Math.PI;

  // Colorful Sun "O" Ring centerpiece (exact multi-segment yellow/orange/red/teal arc!)
  const sunPalette = [0xeab308, 0xf97316, 0xef4444, 0xfacc15, 0x10b981, 0x06b6d4];
  const sunCenterX = -0.8;
  const sunCenterY = 2.45;
  for (let s = 0; s < 10; s++) {
    const a = (s / 10) * Math.PI * 2;
    const segGeo = new THREE.BoxGeometry(0.75, 0.55, 0.62);
    const segMat = new THREE.MeshStandardMaterial({
      color: sunPalette[s % sunPalette.length],
      roughness: 0.42,
    });
    const seg = new THREE.Mesh(segGeo, segMat);
    seg.position.set(
      sunCenterX + Math.cos(a) * 1.42,
      sunCenterY + Math.sin(a) * 1.42,
      0,
    );
    seg.rotation.z = a;
    seg.castShadow = true;
    group.add(seg);
  }

  // White flanking guardrails (merged into 1 mesh!)
  const railGeos: THREE.BufferGeometry[] = [];
  [-10.6, 10.6].forEach((rx) => {
    const topBar = new THREE.BoxGeometry(3.4, 0.08, 0.08);
    topBar.translate(rx, 1.65, -0.8);
    railGeos.push(topBar);
    const midBar = new THREE.BoxGeometry(3.4, 0.08, 0.08);
    midBar.translate(rx, 1.15, -0.8);
    railGeos.push(midBar);
    for (let p = -1.5; p <= 1.5; p += 0.75) {
      const post = new THREE.BoxGeometry(0.08, 1.1, 0.08);
      post.translate(rx + p, 1.15, -0.8);
      railGeos.push(post);
    }
  });
  const railsMesh = new THREE.Mesh(safeMerge(railGeos), mats.whiteModern);
  group.add(joaoCore, joaoFaceF, joaoFaceB, pessoaCore, pessoaFaceF, pessoaFaceB, railsMesh);
  obstacleMeshes.push(joaoCore, pessoaCore);
  addLocalObb(colliders, x, y, z, rotY, -5.1, 0, 5.1, 0.7, 0.8, 3.2, 'letreiro-joao');
  addLocalObb(colliders, x, y, z, rotY, 4.6, 0, 7.2, 0.7, 0.8, 3.2, 'letreiro-pessoa');

  return group;
}

/**
 * 2. Hotel Tambaú — Clássico resort circular na beira-mar de Tambaú!
 * Pátio central aberto, anel térreo transitável com 4 acessos, escadas e anel superior!
 */
export function createHotelTambau(
  x: number,
  y: number,
  z: number,
  mats: JpLandmarkMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): LandmarkBuildOutput {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  // Circular beachfront terrace slab
  const patio = new THREE.Mesh(
    new THREE.CylinderGeometry(24, 24.6, 0.5, 24),
    mats.plazaStone,
  );
  patio.position.y = 0.25;
  patio.receiveShadow = true;
  group.add(patio);
  addLocalPlatform(platforms, x, y, z, 0, 0, 0, 44, 44, 0.5, -0.5);

  // Central ornamental garden pool
  const poolRim = new THREE.Mesh(
    new THREE.TorusGeometry(5.6, 0.45, 8, 20),
    mats.whiteModern,
  );
  poolRim.rotation.x = Math.PI / 2;
  poolRim.position.y = 0.58;
  const poolWater = new THREE.Mesh(
    new THREE.CylinderGeometry(5.3, 5.3, 0.16, 20),
    new THREE.MeshStandardMaterial({ color: 0x16a3d4, roughness: 0.18, metalness: 0.25 }),
  );
  poolWater.position.y = 0.56;
  group.add(poolRim, poolWater);

  // 8 Curved Ring Segments around Courtyard (leaving 4 wide N/S/E/W gates!)
  const ringGeos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];
  const pillGeos: THREE.BufferGeometry[] = [];
  const ringRadius = 17.5;
  const lootPoints: BuildingLootPoint[] = [];

  for (let i = 0; i < 12; i++) {
    // Leave 4 cardinal gateways open (i = 0, 3, 6, 9)
    if (i % 3 === 0) continue;
    const a = (i / 12) * Math.PI * 2;
    const sx = Math.cos(a) * ringRadius;
    const sz = Math.sin(a) * ringRadius;

    // Ground & Upper Wall Ring Block (with outer glass aesthetic)
    const wallG = new THREE.BoxGeometry(6.8, 7.2, 6.2);
    wallG.rotateY(-a + Math.PI / 2);
    wallG.translate(sx, 3.8, sz);
    ringGeos.push(wallG);

    const colG = new THREE.CylinderGeometry(0.42, 0.45, 7.2, 8);
    colG.translate(Math.cos(a) * (ringRadius - 3.9), 3.8, Math.sin(a) * (ringRadius - 3.9));
    pillGeos.push(colG);

    // Register OBB for solid ring segment
    const cos = Math.cos(-a + Math.PI / 2);
    colliders.push({
      cx: x + sx,
      cz: z + sz,
      halfW: 3.4,
      halfD: 3.1,
      rotY: -a + Math.PI / 2,
      minY: y,
      maxY: y + 7.6,
      tag: 'hotel-tambau-ring',
    });
    void cos;

    // Upper Roof Deck platform on top of ring!
    platforms.push({
      cx: x + sx,
      cz: z + sz,
      halfW: 3.4,
      halfD: 3.2,
      rotY: -a + Math.PI / 2,
      topY: y + 7.45,
      minY: y + 6.4,
    });

    if (i % 2 === 1) {
      lootPoints.push({ x: x + sx * 0.72, y: y + 0.55, z: z + sz * 0.72, floor: 1 });
    } else {
      lootPoints.push({ x: x + sx, y: y + 7.5, z: z + sz, floor: 2 });
    }
  }

  // Continuous circular upper canopy slab ring
  const topRingGeo = new THREE.CylinderGeometry(21.4, 21.4, 0.45, 24, 1, true);
  topRingGeo.translate(0, 7.25, 0);
  const parapetGeo = new THREE.TorusGeometry(20.6, 0.35, 6, 24);
  parapetGeo.rotateX(Math.PI / 2);
  parapetGeo.translate(0, 7.7, 0);
  roofGeos.push(topRingGeo, parapetGeo);

  // Two opposing exterior access ramps on N and S inner sides up to the roof deck!
  const rampS = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 11.2), mats.stairConcrete);
  rampS.position.set(0, 3.85, 13.5);
  rampS.rotation.x = -0.62;
  rampS.castShadow = true;
  group.add(rampS);
  addLocalStair(platforms, x, y, z, 0, 0, 13.5, 3.4, 9.8, 'z', 0.5, 7.45);

  const rampN = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 11.2), mats.stairConcrete);
  rampN.position.set(0, 3.85, -13.5);
  rampN.rotation.x = 0.62;
  rampN.castShadow = true;
  group.add(rampN);
  addLocalStair(platforms, x, y, z, 0, 0, -13.5, 3.4, 9.8, 'z', 7.45, 0.5);

  const ringMesh = new THREE.Mesh(safeMerge(ringGeos), mats.modernGlass);
  ringMesh.castShadow = true;
  ringMesh.receiveShadow = true;
  const pillMesh = new THREE.Mesh(safeMerge(pillGeos), mats.whiteModern);
  const roofMesh = new THREE.Mesh(safeMerge(roofGeos), mats.whiteModern);
  group.add(ringMesh, pillMesh, roofMesh);
  obstacleMeshes.push(ringMesh);

  // Central Tambaú Tower Spire
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.1, 13, 12), mats.whiteModern);
  spire.position.set(0, 6.5, 0);
  spire.castShadow = true;
  group.add(spire);
  obstacleMeshes.push(spire);
  addLocalObb(colliders, x, y, z, 0, 0, 0, 3.6, 3.6, 0, 13, 'hotel-tambau-spire');

  const navZone: BuildingNavZone = {
    cx: x,
    cz: z,
    halfW: 13.5,
    halfD: 13.5,
    rotY: 0,
    baseY: y + 0.5,
    hub: { x, z: z + 7.5 },
    doors: [
      { inX: x + 13, inZ: z, outX: x + 24, outZ: z },
      { inX: x - 13, inZ: z, outX: x - 24, outZ: z },
      { inX: x, inZ: z + 13, outX: x, outZ: z + 24 },
      { inX: x, inZ: z - 13, outX: x, outZ: z - 24 },
    ],
  };

  return { group, lootPoints, navZones: [navZone] };
}

/**
 * 3. Farol do Cabo Branco — Monumento triangular icônico no ponto mais oriental!
 */
export function createFarolCaboBranco(
  x: number,
  y: number,
  z: number,
  mats: JpLandmarkMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  // Scenic paved cliff-top mirante octagon
  const mirante = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 15, 0.65, 8),
    mats.plazaStone,
  );
  mirante.position.y = 0.32;
  mirante.receiveShadow = true;
  group.add(mirante);
  addLocalPlatform(platforms, x, y, z, 0, 0, 0, 25, 25, 0.65, -0.5);

  // Iconic 3-wing triangular lighthouse tower (Niemeyer/Pedroso inspired)
  const parts: THREE.BufferGeometry[] = [];
  const core = new THREE.CylinderGeometry(1.3, 2.2, 18.5, 6);
  core.translate(0, 9.6, 0);
  parts.push(core);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const fin = new THREE.BoxGeometry(0.85, 16.5, 4.6);
    fin.translate(0, 8.6, 2.2);
    fin.rotateY(a);
    parts.push(fin);
  }
  const deck = new THREE.CylinderGeometry(3.8, 3.2, 0.8, 6);
  deck.translate(0, 17.6, 0);
  parts.push(deck);

  const mergedTower = new THREE.Mesh(safeMerge(parts), mats.whiteModern);
  mergedTower.castShadow = true;
  mergedTower.receiveShadow = true;
  group.add(mergedTower);
  obstacleMeshes.push(mergedTower);

  // Glowing beacon lantern dome at top
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 8), beaconMat);
  lantern.position.y = 19.1;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.4, 6), mats.accentBlue);
  cap.position.y = 20.7;
  group.add(lantern, cap);

  addLocalObb(colliders, x, y, z, 0, 0, 0, 6.2, 6.2, 0, 19, 'farol-cabo-branco');
  return group;
}

/**
 * 4. Estação Cabo Branco (Niemeyer) — Disco voador / Octógono envidraçado elevado com rampa!
 */
export function createEstacaoCaboBranco(
  x: number,
  y: number,
  z: number,
  mats: JpLandmarkMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): LandmarkBuildOutput {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  // Stone reflection courtyard
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(20, 20.5, 0.4, 16), mats.plazaStone);
  plaza.position.y = 0.2;
  plaza.receiveShadow = true;
  group.add(plaza);
  addLocalPlatform(platforms, x, y, z, 0, 0, 0, 36, 36, 0.4, -0.5);

  // Central structural core + pilotis pillars
  const structGeos: THREE.BufferGeometry[] = [];
  const core = new THREE.CylinderGeometry(4.2, 4.8, 6.0, 8);
  core.translate(0, 3.2, 0);
  structGeos.push(core);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pil = new THREE.CylinderGeometry(0.45, 0.55, 6.0, 8);
    pil.translate(Math.cos(a) * 11.2, 3.1, Math.sin(a) * 11.2);
    structGeos.push(pil);
  }
  const discFloor = new THREE.CylinderGeometry(14.5, 13.8, 0.65, 16);
  discFloor.translate(0, 6.0, 0);
  structGeos.push(discFloor);

  const discRoof = new THREE.CylinderGeometry(13.2, 14.8, 0.9, 16);
  discRoof.translate(0, 9.9, 0);
  structGeos.push(discRoof);

  const spireCap = new THREE.ConeGeometry(3.2, 3.0, 12);
  spireCap.translate(0, 11.8, 0);
  structGeos.push(spireCap);

  const whiteShell = new THREE.Mesh(safeMerge(structGeos), mats.whiteModern);
  whiteShell.castShadow = true;
  whiteShell.receiveShadow = true;
  group.add(whiteShell);
  obstacleMeshes.push(whiteShell);

  // Glass octagonal upper drum
  const glassDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(12.2, 12.2, 3.4, 12),
    mats.modernGlass,
  );
  glassDrum.position.y = 7.9;
  group.add(glassDrum);
  obstacleMeshes.push(glassDrum);

  // Wide sweeping modernist access ramp from East (-X/+Z) up to deck y=6.35
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.45, 13.5), mats.stairConcrete);
  ramp.position.set(0, 3.2, 13.2);
  ramp.rotation.x = -0.46;
  ramp.castShadow = true;
  group.add(ramp);
  addLocalStair(platforms, x, y, z, 0, 0, 13.2, 4.2, 12.2, 'z', 0.4, 6.35);

  // Upper walkable terrace deck around the glass core!
  addLocalPlatform(platforms, x, y, z, 0, 0, 0, 26, 26, 6.35, 5.2);
  addLocalObb(colliders, x, y, z, 0, 0, 0, 8.6, 8.6, 0, 6.0, 'estacao-core');
  addLocalObb(colliders, x, y, z, 0, 0, 0, 19, 19, 6.35, 10.5, 'estacao-glass-drum');

  const lootPoints: BuildingLootPoint[] = [
    { x: x - 7.5, y: y + 0.45, z: z - 4, floor: 1 },
    { x: x + 7.5, y: y + 0.45, z: z - 4, floor: 1 },
    { x: x + 10.8, y: y + 6.4, z, floor: 2 },
    { x: x - 10.8, y: y + 6.4, z, floor: 2 },
  ];

  const navZone: BuildingNavZone = {
    cx: x,
    cz: z,
    halfW: 13.5,
    halfD: 13.5,
    rotY: 0,
    baseY: y + 0.4,
    hub: { x, z: z + 7.2 },
    secondFloorY: y + 6.35,
    stairBottom: { x, z: z + 19.0 },
    stairTop: { x, z: z + 7.4 },
    doors: [
      { inX: x + 8, inZ: z, outX: x + 16, outZ: z },
      { inX: x - 8, inZ: z, outX: x - 16, outZ: z },
    ],
  };

  return { group, lootPoints, navZones: [navZone] };
}

/**
 * 5. Arranha-céus do Altiplano Cabo Branco — Torres altas modernas inspiradas na foto aérea!
 * Térreo envidraçado entrável com 2 portas amplas, saguão aberto + corpo em torre alta (~30-42m)!
 */
export function createAltiplanoSkyscraper(
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  rotY: number,
  accentColor: number,
  mats: JpLandmarkMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): LandmarkBuildOutput {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const lobbyH = 4.2;
  const wallT = 0.5;
  const doorW = 3.2;

  // Lobby interior floor & exterior base apron
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width + 1.8, 0.35, depth + 1.8),
    mats.interiorFloor,
  );
  floor.position.y = 0.175;
  floor.receiveShadow = true;
  group.add(floor);
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, width + 1.8, depth + 1.8, 0.35, -0.5);

  // Ground Lobby Walls (front + back wide doorways)
  const shellGeos: THREE.BufferGeometry[] = [];
  const sideW = (width - doorW) * 0.5;
  const frontZ = depth * 0.5 - wallT * 0.5;
  const backZ = -depth * 0.5 + wallT * 0.5;
  const leftX = -width * 0.5 + wallT * 0.5;
  const rightX = width * 0.5 - wallT * 0.5;

  [frontZ, backZ].forEach((wz) => {
    const segL = new THREE.BoxGeometry(sideW, lobbyH, wallT);
    segL.translate(-doorW * 0.5 - sideW * 0.5, lobbyH * 0.5 + 0.35, wz);
    shellGeos.push(segL);

    const segR = new THREE.BoxGeometry(sideW, lobbyH, wallT);
    segR.translate(doorW * 0.5 + sideW * 0.5, lobbyH * 0.5 + 0.35, wz);
    shellGeos.push(segR);

    const header = new THREE.BoxGeometry(doorW, 1.0, wallT);
    header.translate(0, lobbyH - 0.15, wz);
    shellGeos.push(header);

    addLocalObb(colliders, x, y, z, rotY, -doorW * 0.5 - sideW * 0.5, wz, sideW, wallT, 0, lobbyH + 0.5, 'altiplano-wall');
    addLocalObb(colliders, x, y, z, rotY, doorW * 0.5 + sideW * 0.5, wz, sideW, wallT, 0, lobbyH + 0.5, 'altiplano-wall');
  });

  [leftX, rightX].forEach((wx) => {
    const sideWall = new THREE.BoxGeometry(wallT, lobbyH, depth - wallT * 2);
    sideWall.translate(wx, lobbyH * 0.5 + 0.35, 0);
    shellGeos.push(sideWall);
    addLocalObb(colliders, x, y, z, rotY, wx, 0, wallT, depth, 0, lobbyH + 0.5, 'altiplano-wall');
  });

  // White structural lobby shell
  const lobbyMesh = new THREE.Mesh(safeMerge(shellGeos), mats.whiteModern);
  lobbyMesh.castShadow = true;
  lobbyMesh.receiveShadow = true;
  group.add(lobbyMesh);
  obstacleMeshes.push(lobbyMesh);

  // Upper Sleek Glass Curtain-Wall Tower Body (merged single glass mesh + white architectural crown/ribs!)
  const upperH = height - lobbyH;
  const towerGlass = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.3, upperH, depth - 0.3),
    mats.modernGlass,
  );
  towerGlass.position.y = lobbyH + upperH * 0.5 + 0.35;
  towerGlass.castShadow = true;
  towerGlass.receiveShadow = true;
  group.add(towerGlass);
  obstacleMeshes.push(towerGlass);

  // Architectural corner ribs + stepped penthouse crown merged in 1 draw call
  const trimGeos: THREE.BufferGeometry[] = [];
  [-width * 0.5, width * 0.5].forEach((cx) => {
    [-depth * 0.5, depth * 0.5].forEach((cz) => {
      const rib = new THREE.BoxGeometry(0.75, upperH + 1.2, 0.75);
      rib.translate(cx * 0.96, lobbyH + upperH * 0.5 + 0.35, cz * 0.96);
      trimGeos.push(rib);
    });
  });
  const crown = new THREE.BoxGeometry(width * 0.72, 2.8, depth * 0.72);
  crown.translate(0, height + 1.75, 0);
  trimGeos.push(crown);
  const spire = new THREE.CylinderGeometry(0.18, 0.35, 5.2, 6);
  spire.translate(0, height + 5.2, 0);
  trimGeos.push(spire);

  const trimMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.42, metalness: 0.25 });
  const trimMesh = new THREE.Mesh(safeMerge(trimGeos), trimMat);
  group.add(trimMesh);

  addLocalObb(colliders, x, y, z, rotY, 0, 0, width, depth, lobbyH + 0.35, height + 2.5, 'altiplano-tower');
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, width, depth, height + 0.35, height - 1);

  const p1 = toWorldPt(x, z, rotY, -width * 0.24, 0);
  const p2 = toWorldPt(x, z, rotY, width * 0.24, 0);
  const doorFIn = toWorldPt(x, z, rotY, 0, depth * 0.5 - 1.3);
  const doorFOut = toWorldPt(x, z, rotY, 0, depth * 0.5 + 1.8);
  const doorBIn = toWorldPt(x, z, rotY, 0, -depth * 0.5 + 1.3);
  const doorBOut = toWorldPt(x, z, rotY, 0, -depth * 0.5 - 1.8);

  return {
    group,
    lootPoints: [
      { x: p1.x, y: y + 0.4, z: p1.z, floor: 1 },
      { x: p2.x, y: y + 0.4, z: p2.z, floor: 1 },
    ],
    navZones: [
      {
        cx: x,
        cz: z,
        halfW: width * 0.5 - 0.6,
        halfD: depth * 0.5 - 0.6,
        rotY,
        baseY: y + 0.35,
        hub: { x, z },
        doors: [
          { inX: doorFIn.x, inZ: doorFIn.z, outX: doorFOut.x, outZ: doorFOut.z },
          { inX: doorBIn.x, inZ: doorBIn.z, outX: doorBOut.x, outZ: doorBOut.z },
        ],
      },
    ],
  };
}

/**
 * 6. Igreja & Convento de São Francisco (Centro Histórico)
 * Fachada barroca com frontão curvo, torres sineiras gêmeas e nave interna entrável.
 */
export function createIgrejaSaoFrancisco(
  x: number,
  y: number,
  z: number,
  rotY: number,
  mats: JpLandmarkMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): LandmarkBuildOutput {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const w = 13.5;
  const d = 19.5;
  const h = 7.4;
  const wallT = 0.55;

  // Stone courtyard & interior floor
  const courtyard = new THREE.Mesh(new THREE.BoxGeometry(24, 0.35, 30), mats.plazaStone);
  courtyard.position.set(0, 0.175, 2.5);
  courtyard.receiveShadow = true;
  group.add(courtyard);
  addLocalPlatform(platforms, x, y, z, rotY, 0, 2.5, 24, 30, 0.35, -0.5);

  const wallGeos: THREE.BufferGeometry[] = [];
  // Side nave walls
  [-w * 0.5 + wallT * 0.5, w * 0.5 - wallT * 0.5].forEach((wx) => {
    const sw = new THREE.BoxGeometry(wallT, h, d);
    sw.translate(wx, h * 0.5 + 0.35, 0);
    wallGeos.push(sw);
    addLocalObb(colliders, x, y, z, rotY, wx, 0, wallT, d, 0, h + 1, 'igreja-wall');
  });
  // Back wall
  const bw = new THREE.BoxGeometry(w, h, wallT);
  bw.translate(0, h * 0.5 + 0.35, -d * 0.5 + wallT * 0.5);
  wallGeos.push(bw);
  addLocalObb(colliders, x, y, z, rotY, 0, -d * 0.5 + wallT * 0.5, w, wallT, 0, h + 1, 'igreja-back');

  // Front Baroque Facade with wide portal door (3.4m)
  const frontZ = d * 0.5 - wallT * 0.5;
  const segW = (w - 3.4) * 0.5;
  const fL = new THREE.BoxGeometry(segW, h + 2.2, wallT);
  fL.translate(-1.7 - segW * 0.5, (h + 2.2) * 0.5 + 0.35, frontZ);
  const fR = new THREE.BoxGeometry(segW, h + 2.2, wallT);
  fR.translate(1.7 + segW * 0.5, (h + 2.2) * 0.5 + 0.35, frontZ);
  const fHeader = new THREE.BoxGeometry(3.4, 5.2, wallT);
  fHeader.translate(0, 6.8, frontZ);
  const gable = new THREE.CylinderGeometry(4.2, 4.2, wallT, 12);
  gable.rotateX(Math.PI / 2);
  gable.translate(0, 9.6, frontZ);
  wallGeos.push(fL, fR, fHeader, gable);

  addLocalObb(colliders, x, y, z, rotY, -1.7 - segW * 0.5, frontZ, segW, wallT, 0, 10, 'igreja-front');
  addLocalObb(colliders, x, y, z, rotY, 1.7 + segW * 0.5, frontZ, segW, wallT, 0, 10, 'igreja-front');

  // Twin Baroque Bell Towers + Crosses
  [-5.2, 5.2].forEach((tx) => {
    const tower = new THREE.BoxGeometry(3.2, 13.5, 3.2);
    tower.translate(tx, 7.1, frontZ - 0.6);
    const dome = new THREE.ConeGeometry(2.1, 3.4, 6);
    dome.translate(tx, 15.5, frontZ - 0.6);
    wallGeos.push(tower, dome);
    addLocalObb(colliders, x, y, z, rotY, tx, frontZ - 0.6, 3.2, 3.2, 0, 16, 'igreja-tower');
  });

  // Nave ceiling
  const ceiling = new THREE.BoxGeometry(w, 0.5, d);
  ceiling.translate(0, h + 0.4, 0);
  wallGeos.push(ceiling);

  const naveMesh = new THREE.Mesh(safeMerge(wallGeos), mats.colonialPastel);
  naveMesh.castShadow = true;
  naveMesh.receiveShadow = true;
  group.add(naveMesh);
  obstacleMeshes.push(naveMesh);

  // Historic Stone Cross in Courtyard (Cruzeiro de São Francisco)
  const crossGeos: THREE.BufferGeometry[] = [];
  const crossBase = new THREE.CylinderGeometry(1.5, 1.9, 1.0, 8);
  crossBase.translate(0, 0.8, 14.5);
  const crossVert = new THREE.BoxGeometry(0.42, 4.2, 0.42);
  crossVert.translate(0, 3.2, 14.5);
  const crossHoriz = new THREE.BoxGeometry(1.85, 0.38, 0.38);
  crossHoriz.translate(0, 4.1, 14.5);
  crossGeos.push(crossBase, crossVert, crossHoriz);
  const crossMesh = new THREE.Mesh(safeMerge(crossGeos), mats.concrete);
  crossMesh.castShadow = true;
  group.add(crossMesh);
  addLocalObb(colliders, x, y, z, rotY, 0, 14.5, 2.2, 2.2, 0, 5.2, 'cruzeiro');

  const dIn = toWorldPt(x, z, rotY, 0, frontZ - 1.6);
  const dOut = toWorldPt(x, z, rotY, 0, frontZ + 2.0);
  const lp1 = toWorldPt(x, z, rotY, -3.0, -2.5);
  const lp2 = toWorldPt(x, z, rotY, 3.0, -2.5);

  return {
    group,
    lootPoints: [
      { x: lp1.x, y: y + 0.4, z: lp1.z, floor: 1 },
      { x: lp2.x, y: y + 0.4, z: lp2.z, floor: 1 },
    ],
    navZones: [
      {
        cx: x,
        cz: z,
        halfW: w * 0.5 - 0.8,
        halfD: d * 0.5 - 0.8,
        rotY,
        baseY: y + 0.35,
        hub: { x, z },
        doors: [{ inX: dIn.x, inZ: dIn.z, outX: dOut.x, outZ: dOut.z }],
      },
    ],
  };
}

/**
 * 7. Parque Solon de Lucena (A Lagoa) — Lagoa circular central + ilha com chafariz + pontes!
 */
export function createParqueLagoa(
  x: number,
  y: number,
  z: number,
  mats: JpLandmarkMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  // Outer cobblestone ring promenade
  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(46, 56, 36),
    mats.plazaStone,
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.08;
  outerRing.receiveShadow = true;
  group.add(outerRing);

  // Calm shallow lagoon water basin
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x168aad,
    roughness: 0.22,
    metalness: 0.2,
  });
  const lagoonWater = new THREE.Mesh(new THREE.CircleGeometry(46.5, 36), waterMat);
  lagoonWater.rotation.x = -Math.PI / 2;
  lagoonWater.position.y = 0.03;
  group.add(lagoonWater);

  // Central stone island & monument fountain
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(11.5, 12.2, 0.55, 20),
    mats.plazaStone,
  );
  island.position.y = 0.26;
  island.receiveShadow = true;
  group.add(island);
  addLocalPlatform(platforms, x, y, z, 0, 0, 0, 20, 20, 0.55, -0.5);

  const fountainGeos: THREE.BufferGeometry[] = [];
  const basin = new THREE.CylinderGeometry(4.2, 4.6, 0.9, 14);
  basin.translate(0, 0.85, 0);
  const column = new THREE.CylinderGeometry(0.85, 1.35, 7.5, 10);
  column.translate(0, 4.5, 0);
  const topBowl = new THREE.CylinderGeometry(2.4, 0.6, 0.9, 12);
  topBowl.translate(0, 4.4, 0);
  fountainGeos.push(basin, column, topBowl);
  const fountainMesh = new THREE.Mesh(safeMerge(fountainGeos), mats.whiteModern);
  fountainMesh.castShadow = true;
  group.add(fountainMesh);
  obstacleMeshes.push(fountainMesh);
  addLocalObb(colliders, x, y, z, 0, 0, 0, 5.2, 5.2, 0, 8.5, 'lagoa-fountain');

  // 2 Walkable Footbridges crossing from West (-X) and East (+X) onto the Central Island!
  [-29, 29].forEach((bx) => {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(39, 0.45, 5.2), mats.woodPlank);
    deck.position.set(bx, 0.35, 0);
    deck.receiveShadow = true;
    group.add(deck);
    addLocalPlatform(platforms, x, y, z, 0, bx, 0, 39, 5.2, 0.58, -0.5);

    const railN = new THREE.Mesh(new THREE.BoxGeometry(39, 0.85, 0.22), mats.whiteModern);
    railN.position.set(bx, 0.9, -2.45);
    const railS = railN.clone();
    railS.position.set(bx, 0.9, 2.45);
    group.add(railN, railS);
    addLocalObb(colliders, x, y, z, 0, bx, -2.45, 39, 0.28, 0.4, 1.4, 'lagoa-bridge-rail');
    addLocalObb(colliders, x, y, z, 0, bx, 2.45, 39, 0.28, 0.4, 1.4, 'lagoa-bridge-rail');
  });

  return group;
}

/**
 * 8. Quiosque da Orla / Feirinha de Tambaú & Píer de Madeira (Jacaré / Areia Vermelha)
 */
export function createCoastalQuiosque(
  x: number,
  y: number,
  z: number,
  rotY: number,
  roofColor: number,
  mats: JpLandmarkMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.35, 8), mats.plazaStone);
  base.position.y = 0.17;
  base.receiveShadow = true;

  const counter = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.15, 8), mats.woodPlank);
  counter.position.y = 0.75;
  counter.castShadow = true;

  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.78 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 1.85, 8), roofMat);
  roof.position.y = 3.85;
  roof.castShadow = true;

  const postGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const p = new THREE.CylinderGeometry(0.11, 0.12, 2.8, 6);
    p.translate(Math.cos(a) * 3.1, 1.75, Math.sin(a) * 3.1);
    postGeos.push(p);
  }
  const posts = new THREE.Mesh(safeMerge(postGeos), mats.woodPlank);

  group.add(base, counter, roof, posts);
  obstacleMeshes.push(counter, roof);
  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, 7.6, 7.6, 0.35, -0.3);
  addLocalObb(colliders, x, y, z, rotY, 0, 0, 2.6, 2.6, 0, 1.4, 'quiosque-counter');

  return group;
}

export function createWoodenPier(
  x: number,
  y: number,
  z: number,
  width: number,
  length: number,
  rotY: number,
  mats: JpLandmarkMaterials,
  colliders: WorldObbCollider[],
  platforms: WalkablePlatform[],
  obstacleMeshes: THREE.Object3D[],
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const geos: THREE.BufferGeometry[] = [];
  const deck = new THREE.BoxGeometry(width, 0.36, length);
  deck.translate(0, 0, 0);
  geos.push(deck);

  for (let pz = -length * 0.45; pz <= length * 0.45; pz += 7.5) {
    [-width * 0.42, width * 0.42].forEach((px) => {
      const pile = new THREE.CylinderGeometry(0.22, 0.24, 4.0, 6);
      pile.translate(px, -1.6, pz);
      geos.push(pile);
    });
  }

  const pierMesh = new THREE.Mesh(safeMerge(geos), mats.woodPlank);
  pierMesh.receiveShadow = true;
  group.add(pierMesh);
  obstacleMeshes.push(pierMesh);

  addLocalPlatform(platforms, x, y, z, rotY, 0, 0, width, length, 0.2, -0.5);
  addLocalObb(colliders, x, y, z, rotY, -width * 0.5 + 0.18, 0, 0.3, length, 0, 1.0, 'pier-rail');
  addLocalObb(colliders, x, y, z, rotY, width * 0.5 - 0.18, 0, 0.3, length, 0, 1.0, 'pier-rail');
  return group;
}

/**
 * 9. InstancedMesh High-FPS Vegetation + Beach Umbrellas + Streetlamps Builder
 * Renders ~500 tropical assets in ONLY ~9 GPU Draw Calls!
 */
export interface VegetationInput {
  sampleGroundHeight: (x: number, z: number) => number;
  isOnRoad: (x: number, z: number) => boolean;
  isInsideBuildingFootprint: (x: number, z: number) => boolean;
  riverCenterZ: (x: number) => number;
  textures: ProceduralTextureSet;
  colliders: WorldObbCollider[];
  obstacleMeshes: THREE.Object3D[];
}

export interface JpFoliageController {
  setFoliageShadows: (castPalm: boolean, castForest: boolean) => void;
}

export function createInstancedJoaoPessoaFoliage(
  scene: THREE.Scene,
  input: VegetationInput,
): JpFoliageController {
  const {
    sampleGroundHeight,
    isOnRoad,
    isInsideBuildingFootprint,
    riverCenterZ,
    textures,
    colliders,
    obstacleMeshes,
  } = input;
  let palmTrunksMesh: THREE.InstancedMesh | null = null;
  let palmCrownsMesh: THREE.InstancedMesh | null = null;
  let forestTrunksMesh: THREE.InstancedMesh | null = null;
  let forestCanopiesMesh: THREE.InstancedMesh | null = null;

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  const canPlace = (x: number, z: number, minH = 0.55) => {
    const h = sampleGroundHeight(x, z);
    if (h < minH) return false;
    if (Math.abs(z - riverCenterZ(x)) < 24) return false;
    // Avoid Lagoa water basin center (-175, -15)
    if (Math.hypot(x + 175, z + 15) < 51) return false;
    if (isOnRoad(x, z)) return false;
    if (isInsideBuildingFootprint(x, z)) return false;
    return true;
  };

  // --- A. COQUEIROS (Coconut Palms along Orla, Lagoa, Epitácio Pessoa, Areia Vermelha) ---
  const palmSpots: Array<{ x: number; z: number; scale: number; rot: number }> = [];

  // 1. Orla de Bessa -> Manaíra -> Tambaú -> Cabo Branco palm line!
  for (let z = -345; z <= 325; z += 17) {
    const shoreX = z < -120 ? 318 - (z + 120) * 0.12 : z < 160 ? 328 : 308 - (z - 160) * 0.16;
    const x1 = shoreX - 18 + Math.sin(z * 0.08) * 5;
    const x2 = shoreX - 42 + Math.cos(z * 0.06) * 6;
    if (canPlace(x1, z, 0.35)) {
      palmSpots.push({ x: x1, z, scale: 0.92 + ((Math.abs(z) % 5) * 0.06), rot: z * 0.4 });
    }
    if (z % 34 === 0 && canPlace(x2, z, 0.35)) {
      palmSpots.push({ x: x2, z, scale: 0.88 + ((Math.abs(z) % 4) * 0.07), rot: z * 0.9 });
    }
  }
  // 2. Av. Epitácio Pessoa median & Parque da Lagoa imperial ring!
  for (let x = -110; x <= 285; x += 24) {
    const zN = -10;
    const zS = 14;
    if (canPlace(x, zN, 0.6)) palmSpots.push({ x, z: zN, scale: 1.0, rot: x * 0.3 });
    if (canPlace(x, zS, 0.6)) palmSpots.push({ x, z: zS, scale: 1.0, rot: -x * 0.3 });
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const px = -175 + Math.cos(a) * 58;
    const pz = -15 + Math.sin(a) * 58;
    if (canPlace(px, pz, 0.5)) palmSpots.push({ x: px, z: pz, scale: 1.15, rot: a });
  }
  // 3. Areia Vermelha & Praia do Jacaré palms
  [
    [455, -278], [482, -252], [472, -284],
    [-252, -218], [-228, -216], [-276, -220],
  ].forEach(([px, pz], idx) => {
    if (canPlace(px, pz, 0.25)) palmSpots.push({ x: px, z: pz, scale: 0.95, rot: idx * 1.1 });
  });

  // Palm Geometry: slender slightly-curved trunk + 6 arched palm fronds merged into 1 crown geo
  const palmTrunkGeos: THREE.BufferGeometry[] = [];
  const seg1 = new THREE.CylinderGeometry(0.22, 0.32, 3.6, 6);
  seg1.translate(0, 1.8, 0);
  const seg2 = new THREE.CylinderGeometry(0.16, 0.22, 3.8, 6);
  seg2.rotateZ(0.08);
  seg2.translate(-0.15, 5.4, 0);
  const seg3 = new THREE.CylinderGeometry(0.12, 0.16, 3.2, 6);
  seg3.rotateZ(0.14);
  seg3.translate(-0.5, 8.6, 0);
  palmTrunkGeos.push(seg1, seg2, seg3);
  const palmTrunkGeo = safeMerge(palmTrunkGeos);
  const palmTrunkMat = new THREE.MeshStandardMaterial({
    map: textures.bark,
    color: 0xa1866f,
    roughness: 0.9,
  });

  const frondGeos: THREE.BufferGeometry[] = [];
  for (let f = 0; f < 6; f++) {
    const a = (f / 6) * Math.PI * 2;
    const frond = new THREE.BoxGeometry(0.75, 0.1, 3.8);
    frond.rotateX(0.32);
    frond.translate(0, -0.45, 1.85);
    frond.rotateY(a);
    frondGeos.push(frond);
  }
  const topCap = new THREE.SphereGeometry(0.45, 6, 5);
  frondGeos.push(topCap);
  const palmCrownGeo = safeMerge(frondGeos);
  const palmCrownMat = new THREE.MeshStandardMaterial({
    map: textures.foliage,
    color: 0x65a30d,
    roughness: 0.82,
  });

  if (palmSpots.length > 0) {
    const palmTrunks = new THREE.InstancedMesh(palmTrunkGeo, palmTrunkMat, palmSpots.length);
    const palmCrowns = new THREE.InstancedMesh(palmCrownGeo, palmCrownMat, palmSpots.length);
    palmTrunks.castShadow = false;
    palmCrowns.castShadow = false;
    palmTrunksMesh = palmTrunks;
    palmCrownsMesh = palmCrowns;
    palmSpots.forEach((p, idx) => {
      const py = sampleGroundHeight(p.x, p.z);
      dummy.position.set(p.x, py, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      palmTrunks.setMatrixAt(idx, dummy.matrix);

      // Crown sits at top of curved trunk
      const crownOffX = -0.75 * Math.cos(p.rot) * p.scale;
      const crownOffZ = 0.75 * Math.sin(p.rot) * p.scale;
      dummy.position.set(p.x + crownOffX, py + 10.1 * p.scale, p.z + crownOffZ);
      dummy.rotation.set(0, p.rot + idx * 0.5, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      palmCrowns.setMatrixAt(idx, dummy.matrix);

      // Lightweight slim trunk collider
      colliders.push({
        cx: p.x,
        cz: p.z,
        halfW: 0.28,
        halfD: 0.28,
        rotY: 0,
        minY: py,
        maxY: py + 6.0,
        tag: 'coqueiro',
      });
    });
    palmTrunks.instanceMatrix.needsUpdate = true;
    palmCrowns.instanceMatrix.needsUpdate = true;
    palmTrunks.computeBoundingSphere();
    palmCrowns.computeBoundingSphere();
    scene.add(palmTrunks, palmCrowns);
    obstacleMeshes.push(palmTrunks);
  }

  // --- B. MATA ATLÂNTICA & IPÊS AMARELOS (Mata do Buraquinho, Bica, Falésia) ---
  const forestSpots: Array<{ x: number; z: number; scale: number; isIpe: boolean }> = [];
  for (let i = 0; i < 190; i++) {
    // Deterministic seeded scatter across Mata do Buraquinho (-45..+95, -80..+200), Bica, & Falésia
    const seed1 = Math.sin(i * 12.9898) * 43758.5453;
    const seed2 = Math.sin(i * 78.233) * 43758.5453;
    const r1 = seed1 - Math.floor(seed1);
    const r2 = seed2 - Math.floor(seed2);

    let fx: number;
    let fz: number;
    if (i < 115) {
      // Mata do Buraquinho central lush belt
      fx = -45 + r1 * 145;
      fz = -75 + r2 * 265;
    } else if (i < 155) {
      // Falésia / Cabo Branco green hillside
      fx = 90 + r1 * 155;
      fz = 165 + r2 * 185;
    } else {
      // Parque Bica & Northern river greenway
      fx = -290 + r1 * 210;
      fz = -210 + r2 * 130;
    }

    if (canPlace(fx, fz, 1.0)) {
      forestSpots.push({
        x: fx,
        z: fz,
        scale: 0.85 + ((i % 6) * 0.12),
        isIpe: i % 7 === 0,
      });
    }
  }

  const treeTrunkGeo = new THREE.CylinderGeometry(0.28, 0.44, 4.4, 7);
  treeTrunkGeo.translate(0, 2.2, 0);
  const treeCanopyGeos: THREE.BufferGeometry[] = [];
  const puffMain = new THREE.DodecahedronGeometry(2.6, 0);
  puffMain.translate(0, 5.4, 0);
  const puffA = new THREE.DodecahedronGeometry(1.85, 0);
  puffA.translate(1.4, 4.8, 0.9);
  const puffB = new THREE.DodecahedronGeometry(1.75, 0);
  puffB.translate(-1.3, 4.9, -0.8);
  treeCanopyGeos.push(puffMain, puffA, puffB);
  const treeCanopyGeo = safeMerge(treeCanopyGeos);
  const treeCanopyMat = new THREE.MeshStandardMaterial({
    map: textures.foliage,
    color: 0xffffff,
    roughness: 0.86,
  });

  if (forestSpots.length > 0) {
    const forestTrunks = new THREE.InstancedMesh(treeTrunkGeo, palmTrunkMat, forestSpots.length);
    const forestCanopies = new THREE.InstancedMesh(treeCanopyGeo, treeCanopyMat, forestSpots.length);
    forestTrunks.castShadow = false;
    forestCanopies.castShadow = false;
    forestTrunksMesh = forestTrunks;
    forestCanopiesMesh = forestCanopies;
    forestSpots.forEach((f, idx) => {
      const fy = sampleGroundHeight(f.x, f.z);
      dummy.position.set(f.x, fy, f.z);
      dummy.rotation.set(0, (idx * 1.3) % (Math.PI * 2), 0);
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      forestTrunks.setMatrixAt(idx, dummy.matrix);
      forestCanopies.setMatrixAt(idx, dummy.matrix);

      if (f.isIpe) {
        tmpColor.setHex(0xfacc15); // Ipê Amarelo da Paraíba!
      } else if (idx % 3 === 0) {
        tmpColor.setHex(0x4d7c0f);
      } else if (idx % 3 === 1) {
        tmpColor.setHex(0x65a30d);
      } else {
        tmpColor.setHex(0x3f6212);
      }
      forestCanopies.setColorAt(idx, tmpColor);

      colliders.push({
        cx: f.x,
        cz: f.z,
        halfW: 0.36,
        halfD: 0.36,
        rotY: 0,
        minY: fy,
        maxY: fy + 5.0,
        tag: 'mata-tree',
      });
    });
    forestTrunks.instanceMatrix.needsUpdate = true;
    forestCanopies.instanceMatrix.needsUpdate = true;
    if (forestCanopies.instanceColor) forestCanopies.instanceColor.needsUpdate = true;
    forestTrunks.computeBoundingSphere();
    forestCanopies.computeBoundingSphere();
    scene.add(forestTrunks, forestCanopies);
    obstacleMeshes.push(forestTrunks);
  }

  // --- C. GUARDA-SÓIS COLORIDOS NA AREIA (Beach Umbrellas matching reference photos!) ---
  const umbrellaSpots: Array<{ x: number; z: number; color: number }> = [];
  const umbrellaPalette = [0xef4444, 0xfacc15, 0x0ea5e9, 0x22c55e, 0xf97316];
  for (let z = -310; z <= 275; z += 14) {
    const shoreX = z < -120 ? 326 - (z + 120) * 0.12 : z < 160 ? 344 : 322 - (z - 160) * 0.16;
    const ux = shoreX - 4 + Math.sin(z * 0.11) * 3.5;
    const uh = sampleGroundHeight(ux, z);
    if (uh > 0.18 && uh < 2.2 && !isInsideBuildingFootprint(ux, z)) {
      umbrellaSpots.push({
        x: ux,
        z,
        color: umbrellaPalette[Math.abs(Math.floor(z / 14)) % umbrellaPalette.length],
      });
    }
  }
  // Extra cluster on Areia Vermelha sandbar
  [
    [458, -264], [468, -268], [476, -260], [465, -254], [485, -266],
  ].forEach(([ux, uz], idx) => {
    if (sampleGroundHeight(ux, uz) > 0.15) {
      umbrellaSpots.push({ x: ux, z: uz, color: umbrellaPalette[idx % umbrellaPalette.length] });
    }
  });

  if (umbrellaSpots.length > 0) {
    const poleGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.3, 6);
    poleGeo.translate(0, 1.15, 0);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
    const canopyGeo = new THREE.ConeGeometry(1.55, 0.65, 8);
    canopyGeo.translate(0, 2.25, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });

    const poles = new THREE.InstancedMesh(poleGeo, poleMat, umbrellaSpots.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, umbrellaSpots.length);
    poles.castShadow = false;
    canopies.castShadow = false;

    umbrellaSpots.forEach((u, idx) => {
      const uy = sampleGroundHeight(u.x, u.z);
      dummy.position.set(u.x, uy, u.z);
      dummy.rotation.set((idx % 3 - 1) * 0.05, idx * 0.7, 0);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      poles.setMatrixAt(idx, dummy.matrix);
      canopies.setMatrixAt(idx, dummy.matrix);
      tmpColor.setHex(u.color);
      canopies.setColorAt(idx, tmpColor);
    });
    poles.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    poles.computeBoundingSphere();
    canopies.computeBoundingSphere();
    scene.add(poles, canopies);
  }

  // --- D. POSTES DA ORLA & BANCOS DO CALÇADÃO (Instanced Coastal Lamps) ---
  const lampSpots: Array<{ x: number; z: number; rot: number }> = [];
  for (let z = -230; z <= 250; z += 36) {
    const lx = z < 150 ? 298 : 284 - (z - 150) * 0.14;
    if (canPlace(lx, z, 0.5)) lampSpots.push({ x: lx, z, rot: 0 });
  }
  for (let x = -110; x <= 270; x += 38) {
    if (canPlace(x, 12, 0.6)) lampSpots.push({ x, z: 12, rot: Math.PI / 2 });
  }
  if (lampSpots.length > 0) {
    const postGeos: THREE.BufferGeometry[] = [];
    const shaft = new THREE.CylinderGeometry(0.11, 0.16, 6.2, 6);
    shaft.translate(0, 3.1, 0);
    const arm = new THREE.BoxGeometry(1.4, 0.12, 0.14);
    arm.translate(0.6, 6.1, 0);
    postGeos.push(shaft, arm);
    const lampMesh = new THREE.InstancedMesh(
      safeMerge(postGeos),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.45, roughness: 0.4 }),
      lampSpots.length,
    );
    lampSpots.forEach((l, idx) => {
      dummy.position.set(l.x, sampleGroundHeight(l.x, l.z), l.z);
      dummy.rotation.set(0, l.rot, 0);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      lampMesh.setMatrixAt(idx, dummy.matrix);
    });
    lampMesh.instanceMatrix.needsUpdate = true;
    lampMesh.computeBoundingSphere();
    scene.add(lampMesh);
  }

  // --- E. ARBUSTOS COSTEIROS / RESTINGA SHRUBS (Zero-collision low-cost bushes!) ---
  const shrubSpots: Array<{ x: number; z: number; s: number }> = [];
  for (let i = 0; i < 160; i++) {
    const sx = -320 + ((i * 97) % 640);
    const sz = -230 + ((i * 151) % 550);
    if (canPlace(sx, sz, 0.7)) {
      shrubSpots.push({ x: sx, z: sz, s: 0.75 + (i % 4) * 0.22 });
    }
  }
  if (shrubSpots.length > 0) {
    const shrubGeo = new THREE.DodecahedronGeometry(0.95, 0);
    shrubGeo.scale(1.25, 0.68, 1.25);
    shrubGeo.translate(0, 0.45, 0);
    const shrubMesh = new THREE.InstancedMesh(shrubGeo, treeCanopyMat, shrubSpots.length);
    shrubSpots.forEach((b, idx) => {
      dummy.position.set(b.x, sampleGroundHeight(b.x, b.z), b.z);
      dummy.rotation.set(0, idx * 0.9, 0);
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      shrubMesh.setMatrixAt(idx, dummy.matrix);
      tmpColor.setHex(idx % 3 === 0 ? 0x65a30d : idx % 3 === 1 ? 0x4d7c0f : 0x84cc16);
      shrubMesh.setColorAt(idx, tmpColor);
    });
    shrubMesh.instanceMatrix.needsUpdate = true;
    if (shrubMesh.instanceColor) shrubMesh.instanceColor.needsUpdate = true;
    shrubMesh.computeBoundingSphere();
    scene.add(shrubMesh);
  }

  return {
    setFoliageShadows: (castPalm: boolean, castForest: boolean) => {
      if (palmTrunksMesh) palmTrunksMesh.castShadow = castPalm;
      if (palmCrownsMesh) palmCrownsMesh.castShadow = castPalm;
      if (forestTrunksMesh) forestTrunksMesh.castShadow = castForest;
      if (forestCanopiesMesh) forestCanopiesMesh.castShadow = castForest;
    },
  };
}
