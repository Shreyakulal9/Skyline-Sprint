import type * as THREEType from 'three';
import type { ThreeNS } from './threeLoader';

export interface GameMaterials {
  trackDeck: THREEType.MeshStandardMaterial;
  laneStripe: THREEType.MeshStandardMaterial;
  curbStone: THREEType.MeshStandardMaterial;
  underDeck: THREEType.MeshStandardMaterial;
  hazardStripe: THREEType.MeshStandardMaterial;
  barrierOrange: THREEType.MeshStandardMaterial;
  metalDark: THREEType.MeshStandardMaterial;
  metalSteel: THREEType.MeshStandardMaterial;
  crateBody: THREEType.MeshStandardMaterial;
  crateAccent: THREEType.MeshStandardMaterial;
  coinGold: THREEType.MeshStandardMaterial;
  coinRim: THREEType.MeshStandardMaterial;
  magnetRed: THREEType.MeshStandardMaterial;
  magnetSilver: THREEType.MeshStandardMaterial;
  shieldCyan: THREEType.MeshStandardMaterial;
  shieldGlow: THREEType.MeshBasicMaterial;
  contactShadow: THREEType.MeshBasicMaterial;
  foliagePalette: THREEType.MeshStandardMaterial[];
  trunkWood: THREEType.MeshStandardMaterial;
  pillarStone: THREEType.MeshStandardMaterial;
  buildingFacades: THREEType.MeshStandardMaterial[];
  dispose: () => void;
}

/**
 * Creates a crisp procedural asphalt/stone paver texture for the 3-lane skyway track.
 */
function createTrackTexture(THREE: ThreeNS, maxAniso: number): THREEType.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base slate asphalt gradient
  ctx.fillStyle = '#2d3748';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle surface grain / paver variation
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 2 + Math.random() * 4;
    const lum = 38 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgb(${lum}, ${lum + 7}, ${lum + 18})`;
    ctx.fillRect(x, y, w, w);
  }

  // Subtle horizontal expansion seams
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 3;
  for (let y = 0; y < 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Crisp edge shoulders
  ctx.fillStyle = '#3b475e';
  ctx.fillRect(0, 0, 22, 512);
  ctx.fillRect(490, 0, 22, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * Creates diagonal yellow/slate hazard stripe texture for barriers.
 */
function createHazardTexture(THREE: ThreeNS, maxAniso: number): THREEType.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#1e293b';
  for (let i = -256; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 32, 0);
    ctx.lineTo(i + 32 + 256, 256);
    ctx.lineTo(i + 256, 256);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * Creates a stylized architectural window grid texture for background low-poly towers.
 */
function createBuildingFacadeTexture(
  THREE: ThreeNS,
  baseColor: string,
  windowColor: string,
  maxAniso: number,
): THREEType.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 512);

  const cols = 4;
  const rows = 10;
  const padX = 16;
  const padY = 14;
  const cellW = (256 - padX * (cols + 1)) / cols;
  const cellH = (512 - padY * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() > 0.28;
      ctx.fillStyle = lit ? windowColor : 'rgba(15, 23, 42, 0.32)';
      ctx.fillRect(
        padX + c * (cellW + padX),
        padY + r * (cellH + padY),
        cellW,
        cellH,
      );
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * Soft radial shadow disc texture for grounding the runner & collectibles.
 */
function createContactShadowTexture(THREE: ThreeNS): THREEType.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(10, 15, 30, 0.72)');
  grad.addColorStop(0.55, 'rgba(10, 15, 30, 0.32)');
  grad.addColorStop(1, 'rgba(10, 15, 30, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGameMaterials(
  THREE: ThreeNS,
  renderer: THREEType.WebGLRenderer,
): GameMaterials {
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  const trackTex = createTrackTexture(THREE, maxAniso);
  const hazardTex = createHazardTexture(THREE, maxAniso);
  const shadowTex = createContactShadowTexture(THREE);

  const facadeConfigs: [string, string][] = [
    ['#334155', '#bae6fd'],
    ['#475569', '#fde68a'],
    ['#3b4252', '#a5f3fc'],
    ['#4c3d59', '#fed7aa'],
  ];
  const facadeTextures = facadeConfigs.map(([bg, win]) =>
    createBuildingFacadeTexture(THREE, bg, win, maxAniso),
  );

  const trackDeck = new THREE.MeshStandardMaterial({
    map: trackTex,
    roughness: 0.85,
    metalness: 0.05,
  });

  const laneStripe = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.5,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const curbStone = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.65,
    metalness: 0.05,
  });

  const underDeck = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.75,
    metalness: 0.25,
  });

  const hazardStripe = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.45,
    metalness: 0.1,
  });

  const barrierOrange = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.4,
    metalness: 0.12,
  });

  const metalDark = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.75,
  });

  const metalSteel = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.28,
    metalness: 0.85,
  });

  const crateBody = new THREE.MeshStandardMaterial({
    color: 0xd946ef,
    roughness: 0.55,
    metalness: 0.15,
  });

  const crateAccent = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.32,
    metalness: 0.65,
  });

  const coinGold = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0x78350f,
    emissiveIntensity: 0.25,
    roughness: 0.18,
    metalness: 0.92,
  });

  const coinRim = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0x92400e,
    emissiveIntensity: 0.2,
    roughness: 0.22,
    metalness: 0.95,
  });

  const magnetRed = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.35,
    roughness: 0.28,
    metalness: 0.5,
  });

  const magnetSilver = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.9,
  });

  const shieldCyan = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.75,
  });

  const shieldGlow = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.26,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });

  const foliagePalette = [
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.78, metalness: 0.0, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.8, metalness: 0.0, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x34d399, roughness: 0.74, metalness: 0.0, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.76, metalness: 0.0, flatShading: true }),
  ];

  const trunkWood = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });

  const pillarStone = new THREE.MeshStandardMaterial({
    color: 0xd6d3d1,
    roughness: 0.85,
    metalness: 0.04,
    flatShading: true,
  });

  const buildingFacades = facadeTextures.map(
    (tex) =>
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.6,
        metalness: 0.2,
      }),
  );

  const allTextures = [trackTex, hazardTex, shadowTex, ...facadeTextures];
  const allMaterials: THREEType.Material[] = [
    trackDeck,
    laneStripe,
    curbStone,
    underDeck,
    hazardStripe,
    barrierOrange,
    metalDark,
    metalSteel,
    crateBody,
    crateAccent,
    coinGold,
    coinRim,
    magnetRed,
    magnetSilver,
    shieldCyan,
    shieldGlow,
    contactShadow,
    trunkWood,
    pillarStone,
    ...foliagePalette,
    ...buildingFacades,
  ];

  return {
    trackDeck,
    laneStripe,
    curbStone,
    underDeck,
    hazardStripe,
    barrierOrange,
    metalDark,
    metalSteel,
    crateBody,
    crateAccent,
    coinGold,
    coinRim,
    magnetRed,
    magnetSilver,
    shieldCyan,
    shieldGlow,
    contactShadow,
    foliagePalette,
    trunkWood,
    pillarStone,
    buildingFacades,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
