import * as THREE from 'three';
import {MAPS} from './catalog';
import type {MapId, MatchFormat, SeasonalTheme} from './types';

export interface ArenaCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface ArenaRamp {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  axis: 'x' | 'z';
  lowCoord: number;
  highCoord: number;
  lowY: number;
  highY: number;
}

export interface ArenaJumpPad {
  x: number;
  z: number;
  radius: number;
  boostVy: number;
}

export interface ArenaSpawn {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface AnimatedArenaObject {
  mesh: THREE.Object3D;
  baseY: number;
  speed: number;
  phase: number;
  spinSpeed?: number;
}

export interface DominationZoneSpec {
  label: 'A' | 'B' | 'C';
  x: number;
  z: number;
  radius: number;
  ringMesh: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
}

export interface CtfFlagVisuals {
  alphaBase: THREE.Vector3;
  bravoBase: THREE.Vector3;
  alphaMesh: THREE.Group;
  bravoMesh: THREE.Group;
}

export interface BuiltArena {
  group: THREE.Group;
  colliders: ArenaCollider[];
  ramps: ArenaRamp[];
  jumpPads: ArenaJumpPad[];
  shootableWalls: THREE.Object3D[];
  animatedObjects: AnimatedArenaObject[];
  spawns: ArenaSpawn[];
  charlieSpawns: ArenaSpawn[];
  playerSpawn: ArenaSpawn;
  rivalSpawn: ArenaSpawn;
  arenaHalfExtent: number;
  ctfFlags?: CtfFlagVisuals;
  domZones?: DominationZoneSpec[];
  dispose: () => void;
}

export interface ArenaBuildOptions {
  pbrTextures?: boolean;
  isSoftwareGl?: boolean;
  seasonalTheme?: SeasonalTheme;
  matchFormat?: MatchFormat;
}

function createFloorTexture(
  baseHex: string,
  gridHex: string,
  trimHex: string,
  maxAnisotropy: number,
  checkerboard = false,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  if (checkerboard) {
    ctx.fillStyle = gridHex;
    for (let x = 0; x < 512; x += 128) {
      for (let y = 0; y < 512; y += 128) {
        if (((x / 128) + (y / 128)) % 2 === 0) {
          ctx.fillRect(x, y, 128, 128);
        }
      }
    }
  } else {
    for (let i = 0; i < 900; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(x, y, 4, 4);
    }

    ctx.strokeStyle = gridHex;
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = trimHex;
  ctx.lineWidth = 2;
  for (let tx = 0; tx < 512; tx += 128) {
    for (let ty = 0; ty < 512; ty += 128) {
      ctx.strokeRect(tx + 4, ty + 4, 120, 120);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.anisotropy = Math.max(1, maxAnisotropy);
  return tex;
}

function createProceduralPbrMaps(maxAnisotropy: number): {
  floorNormal: THREE.CanvasTexture;
  floorRoughness: THREE.CanvasTexture;
  panelNormal: THREE.CanvasTexture;
  panelRoughness: THREE.CanvasTexture;
} {
  const fnCanvas = document.createElement('canvas');
  fnCanvas.width = 256;
  fnCanvas.height = 256;
  const fnc = fnCanvas.getContext('2d')!;
  fnc.fillStyle = 'rgb(128, 128, 255)';
  fnc.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 32) {
    fnc.fillStyle = 'rgb(100, 128, 235)';
    fnc.fillRect(i, 0, 2, 256);
    fnc.fillStyle = 'rgb(156, 128, 235)';
    fnc.fillRect(i + 2, 0, 2, 256);
    fnc.fillStyle = 'rgb(128, 100, 235)';
    fnc.fillRect(0, i, 256, 2);
    fnc.fillStyle = 'rgb(128, 156, 235)';
    fnc.fillRect(0, i + 2, 256, 2);
  }
  const floorNormal = new THREE.CanvasTexture(fnCanvas);
  floorNormal.colorSpace = THREE.NoColorSpace;
  floorNormal.wrapS = THREE.RepeatWrapping;
  floorNormal.wrapT = THREE.RepeatWrapping;
  floorNormal.repeat.set(16, 16);
  floorNormal.anisotropy = Math.max(1, maxAnisotropy);

  const frCanvas = document.createElement('canvas');
  frCanvas.width = 256;
  frCanvas.height = 256;
  const frc = frCanvas.getContext('2d')!;
  frc.fillStyle = 'rgb(165, 165, 165)';
  frc.fillRect(0, 0, 256, 256);
  frc.fillStyle = 'rgb(228, 228, 228)';
  for (let i = 0; i < 256; i += 32) {
    frc.fillRect(i, 0, 4, 256);
    frc.fillRect(0, i, 256, 4);
  }
  const floorRoughness = new THREE.CanvasTexture(frCanvas);
  floorRoughness.colorSpace = THREE.NoColorSpace;
  floorRoughness.wrapS = THREE.RepeatWrapping;
  floorRoughness.wrapT = THREE.RepeatWrapping;
  floorRoughness.repeat.set(16, 16);
  floorRoughness.anisotropy = Math.max(1, maxAnisotropy);

  const pnCanvas = document.createElement('canvas');
  pnCanvas.width = 256;
  pnCanvas.height = 256;
  const pnc = pnCanvas.getContext('2d')!;
  pnc.fillStyle = 'rgb(128, 128, 255)';
  pnc.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    pnc.fillStyle = y % 32 === 0 ? 'rgb(128, 108, 240)' : 'rgb(128, 148, 240)';
    pnc.fillRect(0, y, 256, 2);
  }
  const panelNormal = new THREE.CanvasTexture(pnCanvas);
  panelNormal.colorSpace = THREE.NoColorSpace;
  panelNormal.wrapS = THREE.RepeatWrapping;
  panelNormal.wrapT = THREE.RepeatWrapping;
  panelNormal.repeat.set(2, 2);
  panelNormal.anisotropy = Math.max(1, maxAnisotropy);

  const prCanvas = document.createElement('canvas');
  prCanvas.width = 256;
  prCanvas.height = 256;
  const prc = prCanvas.getContext('2d')!;
  prc.fillStyle = 'rgb(142, 142, 142)';
  prc.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    prc.fillStyle = y % 16 === 0 ? 'rgb(120,120,120)' : 'rgb(168,168,168)';
    prc.fillRect(0, y, 256, 2);
  }
  const panelRoughness = new THREE.CanvasTexture(prCanvas);
  panelRoughness.colorSpace = THREE.NoColorSpace;
  panelRoughness.wrapS = THREE.RepeatWrapping;
  panelRoughness.wrapT = THREE.RepeatWrapping;
  panelRoughness.repeat.set(2, 2);
  panelRoughness.anisotropy = Math.max(1, maxAnisotropy);

  return {floorNormal, floorRoughness, panelNormal, panelRoughness};
}

function createSkyDomeTexture(topHex: string, midHex: string, horizonHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, topHex);
  grad.addColorStop(0.48, midHex);
  grad.addColorStop(0.82, horizonHex);
  grad.addColorStop(1.0, '#070a12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCombatArena(
  mapId: MapId | 'range',
  maxAnisotropy: number,
  options: ArenaBuildOptions = {},
): BuiltArena {
  const pbrEnabled = options.pbrTextures ?? true;
  const isSoftwareGl = options.isSoftwareGl ?? false;
  const seasonalTheme = options.seasonalTheme ?? 'normal';
  const matchFormat = options.matchFormat;

  const spec = mapId === 'range' ? null : MAPS[mapId];
  const tpl = mapId === 'range' ? 'range' : spec?.layoutTemplate ?? 'vanguard';
  const scale = spec?.scaleFactor ?? 1.0;
  const isLegacy = spec?.isLegacy ?? false;

  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const colliders: ArenaCollider[] = [];
  const ramps: ArenaRamp[] = [];
  const jumpPads: ArenaJumpPad[] = [];
  const shootableWalls: THREE.Object3D[] = [];
  const animatedObjects: AnimatedArenaObject[] = [];

  // Palette selection by layout template + Seasonal Reskin override
  let themeColors = {
    base: '#1a2230',
    grid: '#2a364c',
    trim: 'rgba(249, 115, 22, 0.26)',
    skyTop: '#081020',
    skyMid: '#13243f',
    skyHorizon: '#2a344c',
    padLight: 0x38bdf8,
    wallHex: isLegacy ? 0x3b4861 : 0x2b364a,
    coverHex: isLegacy ? 0x526585 : 0x3d4c68,
    checker: false,
  };

  if (tpl === 'docks') {
    themeColors = {
      ...themeColors,
      base: '#141c27',
      grid: '#233246',
      trim: 'rgba(56, 189, 248, 0.28)',
      skyTop: '#061224',
      skyMid: '#0f2744',
      skyHorizon: '#204569',
      padLight: 0x38bdf8,
    };
  } else if (tpl === 'metro' || tpl === 'station') {
    themeColors = {
      ...themeColors,
      base: '#1a1c26',
      grid: '#2d3244',
      trim: 'rgba(250, 204, 21, 0.26)',
      skyTop: '#0b0e18',
      skyMid: '#1c2032',
      skyHorizon: '#3c3024',
      padLight: 0xf97316,
    };
  } else if (tpl === 'crossroads' || tpl === 'experimental') {
    themeColors = {
      ...themeColors,
      base: '#111222',
      grid: '#252847',
      trim: 'rgba(236, 72, 153, 0.30)',
      skyTop: '#09071a',
      skyMid: '#1f1137',
      skyHorizon: '#421749',
      padLight: 0xec4899,
    };
  } else if (tpl === 'graveyard') {
    themeColors = {
      ...themeColors,
      base: '#14111d',
      grid: '#2a223b',
      trim: 'rgba(168, 85, 247, 0.3)',
      skyTop: '#0b0714',
      skyMid: '#1e1233',
      skyHorizon: '#3b1d52',
      padLight: 0xa855f7,
      wallHex: 0x2a2638,
      coverHex: 0x433c59,
    };
  } else if (tpl === 'splash') {
    themeColors = {
      ...themeColors,
      base: '#0e2d47',
      grid: '#1d4f7a',
      trim: 'rgba(56, 189, 248, 0.38)',
      skyTop: '#072442',
      skyMid: '#0f4c7a',
      skyHorizon: '#38bdf8',
      padLight: 0x22d3ee,
      wallHex: 0x1e4e6e,
      coverHex: 0x38bdf8,
    };
  } else if (tpl === 'chess') {
    themeColors = {
      ...themeColors,
      base: '#e2e8f0',
      grid: '#1e293b',
      trim: 'rgba(148, 163, 184, 0.35)',
      skyTop: '#0b0e16',
      skyMid: '#192030',
      skyHorizon: '#334155',
      padLight: 0xfacc15,
      wallHex: 0x1e293b,
      coverHex: 0xf1f5f9,
      checker: true,
    };
  } else if (tpl === 'onyx') {
    themeColors = {
      ...themeColors,
      base: '#0a0b12',
      grid: '#1f2338',
      trim: 'rgba(192, 132, 252, 0.34)',
      skyTop: '#05050b',
      skyMid: '#121324',
      skyHorizon: '#2e1f4d',
      padLight: 0xc084fc,
      wallHex: 0x151726,
      coverHex: 0x242842,
    };
  } else if (tpl === 'temple' || tpl === 'battleground') {
    themeColors = {
      ...themeColors,
      base: '#2b2218',
      grid: '#473827',
      trim: 'rgba(245, 158, 11, 0.28)',
      skyTop: '#17110a',
      skyMid: '#332415',
      skyHorizon: '#634321',
      padLight: 0xf59e0b,
      wallHex: 0x453525,
      coverHex: 0x695138,
    };
  } else if (tpl === 'construction' || tpl === 'factory') {
    themeColors = {
      ...themeColors,
      base: '#1f1d1b',
      grid: '#38332f',
      trim: 'rgba(251, 146, 60, 0.34)',
      skyTop: '#121114',
      skyMid: '#262326',
      skyHorizon: '#4f3827',
      padLight: 0xfb923c,
      wallHex: 0x3b3532,
      coverHex: 0x5c4b3b,
    };
  }

  if (seasonalTheme === 'halloween') {
    themeColors = {
      ...themeColors,
      base: '#171022',
      grid: '#331d47',
      trim: 'rgba(249, 115, 22, 0.42)',
      skyTop: '#0f0618',
      skyMid: '#2d123b',
      skyHorizon: '#7c2d12',
      padLight: 0xf97316,
    };
  } else if (seasonalTheme === 'winter') {
    themeColors = {
      ...themeColors,
      base: '#d8e9f5',
      grid: '#93c5fd',
      trim: 'rgba(14, 165, 233, 0.38)',
      skyTop: '#0c2340',
      skyMid: '#1e4b7a',
      skyHorizon: '#bae6fd',
      padLight: 0x67e8f9,
    };
  }

  // Gradient Sky Dome
  const skyTex = createSkyDomeTexture(themeColors.skyTop, themeColors.skyMid, themeColors.skyHorizon);
  texs.push(skyTex);
  const skyGeo = new THREE.SphereGeometry(220, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  geos.push(skyGeo);
  mats.push(skyMat);
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyDome);

  const floorTex = createFloorTexture(
    themeColors.base,
    themeColors.grid,
    themeColors.trim,
    maxAnisotropy,
    themeColors.checker,
  );
  texs.push(floorTex);

  const pbrMaps = pbrEnabled ? createProceduralPbrMaps(maxAnisotropy) : null;
  if (pbrMaps) {
    texs.push(
      pbrMaps.floorNormal,
      pbrMaps.floorRoughness,
      pbrMaps.panelNormal,
      pbrMaps.panelRoughness,
    );
  }

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    normalMap: pbrMaps?.floorNormal ?? null,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: pbrMaps?.floorRoughness ?? null,
    roughness: pbrMaps ? 0.85 : 0.78,
    metalness: 0.16,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: themeColors.wallHex,
    normalMap: pbrMaps?.panelNormal ?? null,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: pbrMaps?.panelRoughness ?? null,
    roughness: 0.65,
    metalness: 0.26,
  });
  const coverMat = new THREE.MeshStandardMaterial({
    color: themeColors.coverHex,
    normalMap: pbrMaps?.panelNormal ?? null,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.46,
    metalness: 0.42,
  });
  const redCargoMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    normalMap: pbrMaps?.panelNormal ?? null,
    roughness: 0.58,
    metalness: 0.3,
  });
  const blueCargoMat = new THREE.MeshStandardMaterial({
    color: 0x1e40af,
    normalMap: pbrMaps?.panelNormal ?? null,
    roughness: 0.58,
    metalness: 0.3,
  });
  const yellowSubwayMat = new THREE.MeshStandardMaterial({
    color: 0xca8a04,
    normalMap: pbrMaps?.panelNormal ?? null,
    roughness: 0.38,
    metalness: 0.42,
  });
  const glassBarrierMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    roughness: 0.12,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: isSoftwareGl ? 0.34 : 0.28,
    transmission: isSoftwareGl ? 0 : 0.55,
    ior: 1.45,
    depthWrite: false,
  });
  const accentOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.15,
    roughness: 0.3,
  });
  const accentCyanMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.35,
    roughness: 0.22,
  });
  const accentPinkMat = new THREE.MeshStandardMaterial({
    color: 0xec4899,
    emissive: 0xdb2777,
    emissiveIntensity: 1.35,
    roughness: 0.22,
  });

  mats.push(
    floorMat,
    wallMat,
    coverMat,
    redCargoMat,
    blueCargoMat,
    yellowSubwayMat,
    glassBarrierMat,
    accentOrangeMat,
    accentCyanMat,
    accentPinkMat,
  );

  const addBoxBlock = (
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    isCollider = true,
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = isCollider;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (isCollider) {
      colliders.push({
        minX: cx - w * 0.5,
        maxX: cx + w * 0.5,
        minY: cy - h * 0.5,
        maxY: cy + h * 0.5,
        minZ: cz - d * 0.5,
        maxZ: cz + d * 0.5,
      });
      shootableWalls.push(mesh);
    }
    return mesh;
  };

  const addGlassTopper = (cx: number, cy: number, cz: number, w: number, h: number, d: number) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, glassBarrierMat);
    mesh.position.set(cx, cy, cz);
    group.add(mesh);
    return mesh;
  };

  const makeRampMesh = (
    x1: number,
    x2: number,
    z1: number,
    z2: number,
    lowY: number,
    highY: number,
    axis: 'x' | 'z',
    lowAtMin: boolean,
  ) => {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const span = axis === 'x' ? w : d;
    const len = Math.hypot(span, highY - lowY);
    const angle = Math.atan2(highY - lowY, span);
    const geo =
      axis === 'x'
        ? new THREE.BoxGeometry(len, 0.25, d)
        : new THREE.BoxGeometry(w, 0.25, len);
    geos.push(geo);
    const m = new THREE.Mesh(geo, coverMat);
    m.position.set((x1 + x2) * 0.5, (lowY + highY) * 0.5 - 0.1, (z1 + z2) * 0.5);
    if (axis === 'x') m.rotation.z = lowAtMin ? angle : -angle;
    else m.rotation.x = lowAtMin ? -angle : angle;
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
    shootableWalls.push(m);

    ramps.push({
      minX: Math.min(x1, x2),
      maxX: Math.max(x1, x2),
      minZ: Math.min(z1, z2),
      maxZ: Math.max(z1, z2),
      axis,
      lowCoord:
        axis === 'x'
          ? lowAtMin
            ? Math.min(x1, x2)
            : Math.max(x1, x2)
          : lowAtMin
          ? Math.min(z1, z2)
          : Math.max(z1, z2),
      highCoord:
        axis === 'x'
          ? lowAtMin
            ? Math.max(x1, x2)
            : Math.min(x1, x2)
          : lowAtMin
          ? Math.max(z1, z2)
          : Math.min(z1, z2),
      lowY,
      highY,
    });
  };

  const addJumpPad = (
    jx: number,
    jz: number,
    colorMat: THREE.Material,
    vy = 12.5,
    lightHex = themeColors.padLight,
  ) => {
    const padGeo = new THREE.CylinderGeometry(1.7, 2.0, 0.24, 18);
    const ringGeo = new THREE.TorusGeometry(1.65, 0.06, 8, 24);
    ringGeo.rotateX(Math.PI / 2);
    geos.push(padGeo, ringGeo);

    const pad = new THREE.Mesh(padGeo, colorMat);
    pad.position.set(jx, 0.12, jz);
    group.add(pad);

    const ring = new THREE.Mesh(ringGeo, colorMat);
    ring.position.set(jx, 0.42, jz);
    group.add(ring);
    animatedObjects.push({
      mesh: ring,
      baseY: 0.42,
      speed: 2.8,
      phase: (jx + jz) * 0.25,
      spinSpeed: 1.4,
    });

    if (!isSoftwareGl) {
      const padLight = new THREE.PointLight(lightHex, 2.6, 12, 2);
      padLight.position.set(jx, 1.35, jz);
      group.add(padLight);
    }

    jumpPads.push({x: jx, z: jz, radius: 1.9, boostVy: vy});
  };

  const addExteriorTowers = (accent: THREE.Material, radius = 56 * scale) => {
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const dist = radius + (i % 2) * 14;
      const tx = Math.cos(ang) * dist;
      const tz = Math.sin(ang) * dist;
      addBoxBlock(tx, 14, tz, 10, 36, 10, wallMat, false);
      addBoxBlock(tx, 31, tz, 10.2, 0.6, 10.2, accent, false);
      addBoxBlock(tx, 22, tz, 10.1, 0.35, 10.1, accent, false);
      addBoxBlock(tx, 13, tz, 10.1, 0.35, 10.1, accent, false);
    }
  };

  const addOverheadTrusses = (accent: THREE.Material, span = 56 * scale) => {
    [-14 * scale, 14 * scale].forEach((zp) => {
      addBoxBlock(0, 12.6, zp, span, 0.45, 0.55, wallMat, false);
      addBoxBlock(0, 12.25, zp, span * 0.45, 0.14, 0.65, accent, false);
    });
  };

  // Shooting Range Practice Arena (Training Range mode)
  if (mapId === 'range') {
    const rangeFloorGeo = new THREE.PlaneGeometry(44, 68);
    rangeFloorGeo.rotateX(-Math.PI / 2);
    geos.push(rangeFloorGeo);
    const rangeFloor = new THREE.Mesh(rangeFloorGeo, floorMat);
    rangeFloor.position.set(0, 0, -10);
    rangeFloor.receiveShadow = true;
    group.add(rangeFloor);
    shootableWalls.push(rangeFloor);

    addBoxBlock(0, 4, -44, 44, 8, 1, wallMat);
    addBoxBlock(0, 4, 24, 44, 8, 1, wallMat);
    addBoxBlock(-22, 4, -10, 1, 8, 68, wallMat);
    addBoxBlock(22, 4, -10, 1, 8, 68, wallMat);

    addBoxBlock(-8, 0.55, 6, 12, 1.1, 1.0, coverMat);
    addBoxBlock(8, 0.55, 6, 12, 1.1, 1.0, coverMat);
    addGlassTopper(-8, 1.35, 6, 11.5, 0.5, 0.08);
    addGlassTopper(8, 1.35, 6, 11.5, 0.5, 0.08);

    [0, -12, -26].forEach((mz) => {
      const stripGeo = new THREE.BoxGeometry(40, 0.03, 0.25);
      geos.push(stripGeo);
      const strip = new THREE.Mesh(stripGeo, accentOrangeMat);
      strip.position.set(0, 0.02, mz);
      group.add(strip);
    });

    addBoxBlock(-14, 1.2, -8, 2.4, 2.4, 2.4, coverMat);
    addBoxBlock(14, 1.2, -16, 2.4, 2.4, 2.4, coverMat);

    const sp = {x: 0, y: 0, z: 12, yaw: 0};
    return {
      group,
      colliders,
      ramps,
      jumpPads,
      shootableWalls,
      animatedObjects,
      spawns: [sp],
      charlieSpawns: [sp],
      playerSpawn: sp,
      rivalSpawn: {x: 0, y: 0, z: -20, yaw: Math.PI},
      arenaHalfExtent: 22,
      dispose: () => {
        geos.forEach((g) => g.dispose());
        mats.forEach((m) => m.dispose());
        texs.forEach((t) => t.dispose());
      },
    };
  }

  // Scaled combat arena floor (Regular 56x56, Big variants ~75.6x75.6)
  const size = 56 * scale;
  const half = size * 0.5;
  const wallCenter = half + 0.5;

  const floorGeo = new THREE.PlaneGeometry(size, size);
  floorGeo.rotateX(-Math.PI / 2);
  geos.push(floorGeo);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  group.add(floor);
  shootableWalls.push(floor);

  addBoxBlock(0, 3, -wallCenter, size + 2, 6, 1, wallMat);
  addBoxBlock(0, 3, wallCenter, size + 2, 6, 1, wallMat);
  addBoxBlock(-wallCenter, 3, 0, 1, 6, size + 2, wallMat);
  addBoxBlock(wallCenter, 3, 0, 1, 6, size + 2, wallMat);

  addBoxBlock(0, 0.015, 0, size - 4, 0.02, 0.16, coverMat, false);
  addBoxBlock(0, 0.015, 0, 0.16, 0.02, size - 4, coverMat, false);

  // 17 clean perimeter-safe spawns (Even = Alpha/South, Odd = Bravo/North, plus ring points for FFA/Royale)
  const zS = 22 * scale;
  const spawns: ArenaSpawn[] = [
    {x: -7 * scale, y: 0, z: zS, yaw: 0},
    {x: 7 * scale, y: 0, z: -zS, yaw: Math.PI},
    {x: 7 * scale, y: 0, z: zS, yaw: 0},
    {x: -7 * scale, y: 0, z: -zS, yaw: Math.PI},
    {x: -16 * scale, y: 0, z: zS, yaw: 0},
    {x: 16 * scale, y: 0, z: -zS, yaw: Math.PI},
    {x: 16 * scale, y: 0, z: zS, yaw: 0},
    {x: -16 * scale, y: 0, z: -zS, yaw: Math.PI},
    {x: -22 * scale, y: 0, z: 12 * scale, yaw: 0.4},
    {x: 22 * scale, y: 0, z: -12 * scale, yaw: Math.PI + 0.4},
    {x: 22 * scale, y: 0, z: 12 * scale, yaw: -0.4},
    {x: -22 * scale, y: 0, z: -12 * scale, yaw: Math.PI - 0.4},
    {x: -23 * scale, y: 0, z: 0, yaw: -Math.PI / 2},
    {x: 23 * scale, y: 0, z: 0, yaw: Math.PI / 2},
    {x: 0, y: 0, z: 23 * scale, yaw: 0},
    {x: 0, y: 0, z: -23 * scale, yaw: Math.PI},
    {x: 0, y: 0, z: 16 * scale, yaw: 0},
  ];

  // Three-way Charlie spawns (East flank corner)
  const charlieSpawns: ArenaSpawn[] = [
    {x: 22 * scale, y: 0, z: -4 * scale, yaw: Math.PI / 2},
    {x: 22 * scale, y: 0, z: 4 * scale, yaw: Math.PI / 2},
    {x: 19 * scale, y: 0, z: 0, yaw: Math.PI / 2},
  ];

  if (tpl === 'docks') {
    addBoxBlock(-9 * scale, 1.6, -4 * scale, 3.4, 3.2, 10, redCargoMat);
    addBoxBlock(-9 * scale, 3.22, -4 * scale, 3.48, 0.12, 10.05, coverMat, false);
    addBoxBlock(9 * scale, 1.6, 4 * scale, 3.4, 3.2, 10, blueCargoMat);
    addBoxBlock(9 * scale, 3.22, 4 * scale, 3.48, 0.12, 10.05, coverMat, false);
    addBoxBlock(0, 1.6, 0, 10, 3.2, 3.4, redCargoMat);
    addBoxBlock(0, 4.7, 0, 8, 2.8, 3.2, blueCargoMat);
    addBoxBlock(0, 6.14, 0, 8.1, 0.12, 3.28, accentCyanMat, false);

    makeRampMesh(-10.5, -5, -1.7, 1.7, 0, 3.2, 'x', true);
    makeRampMesh(5, 10.5, -1.7, 1.7, 0, 3.2, 'x', false);

    addBoxBlock(-18 * scale, 1.6, -15 * scale, 7.5, 3.2, 3.2, blueCargoMat);
    addBoxBlock(18 * scale, 1.6, 15 * scale, 7.5, 3.2, 3.2, redCargoMat);
    addBoxBlock(-18 * scale, 1.6, 15 * scale, 3.2, 3.2, 7.5, coverMat);
    addBoxBlock(18 * scale, 1.6, -15 * scale, 3.2, 3.2, 7.5, coverMat);

    addBoxBlock(0, 0.9, 14 * scale, 4.5, 1.8, 1.6, coverMat);
    addBoxBlock(0, 0.9, -14 * scale, 4.5, 1.8, 1.6, coverMat);
    addGlassTopper(0, 2.15, 14 * scale, 4.2, 0.7, 0.08);
    addGlassTopper(0, 2.15, -14 * scale, 4.2, 0.7, 0.08);

    addJumpPad(-22 * scale, -20 * scale, accentCyanMat, 13, 0x38bdf8);
    addJumpPad(22 * scale, 20 * scale, accentCyanMat, 13, 0x38bdf8);
    addOverheadTrusses(accentCyanMat, size);
    addExteriorTowers(accentCyanMat);
  } else if (tpl === 'metro' || tpl === 'station') {
    const isStation = tpl === 'station';
    [-7 * scale, 7 * scale].forEach((tx) => {
      addBoxBlock(tx, 1.7, 0, 3.4, 3.4, 18, isStation ? blueCargoMat : yellowSubwayMat);
      addBoxBlock(tx, 3.45, 0, 3.5, 0.12, 18.1, accentOrangeMat, false);
      addBoxBlock(tx, 2.15, 0, 3.46, 0.62, 14.5, accentCyanMat, false);
      addBoxBlock(tx, 1.15, 9.04, 2.2, 0.28, 0.12, accentOrangeMat, false);
      addBoxBlock(tx, 1.15, -9.04, 2.2, 0.28, 0.12, accentOrangeMat, false);
    });
    if (isStation) {
      // Overhead Station Concourse Bridge
      addBoxBlock(0, 3.7, 0, 16, 0.45, 4.2, coverMat);
      addGlassTopper(0, 4.3, 2.0, 15.5, 0.7, 0.08);
      addGlassTopper(0, 4.3, -2.0, 15.5, 0.7, 0.08);
    }

    addBoxBlock(-16 * scale, 1.3, 0, 6, 2.6, 14, coverMat);
    addBoxBlock(16 * scale, 1.3, 0, 6, 2.6, 14, coverMat);
    addGlassTopper(-13.2 * scale, 3.05, 0, 0.08, 0.9, 12);
    addGlassTopper(13.2 * scale, 3.05, 0, 0.08, 0.9, 12);

    makeRampMesh(-19 * scale, -13 * scale, -12, -7, 0, 2.6, 'z', true);
    makeRampMesh(13 * scale, 19 * scale, 7, 12, 0, 2.6, 'z', false);

    addBoxBlock(-6 * scale, 1.2, 15 * scale, 3.2, 2.4, 2.2, wallMat);
    addBoxBlock(6 * scale, 1.2, 15 * scale, 3.2, 2.4, 2.2, wallMat);
    addBoxBlock(-6 * scale, 1.2, -15 * scale, 3.2, 2.4, 2.2, wallMat);
    addBoxBlock(6 * scale, 1.2, -15 * scale, 3.2, 2.4, 2.2, wallMat);

    addJumpPad(0, 0, accentOrangeMat, 12.5, 0xf97316);
    addOverheadTrusses(accentOrangeMat, size);
    addExteriorTowers(accentOrangeMat);
  } else if (tpl === 'crossroads') {
    const towers = [
      [-15 * scale, -15 * scale],
      [15 * scale, -15 * scale],
      [-15 * scale, 15 * scale],
      [15 * scale, 15 * scale],
    ];
    towers.forEach(([tx, tz]) => {
      addBoxBlock(tx, 1.6, tz, 6.5, 3.2, 6.5, wallMat);
      addBoxBlock(tx, 3.25, tz, 6.65, 0.12, 6.65, accentPinkMat, false);
    });

    makeRampMesh(-18 * scale, -12 * scale, -11.5 * scale, -6 * scale, 0, 3.2, 'z', false);
    makeRampMesh(12 * scale, 18 * scale, 6 * scale, 11.5 * scale, 0, 3.2, 'z', true);

    addBoxBlock(0, 3.2, 0, 3.2, 6.4, 3.2, wallMat);
    addBoxBlock(0, 6.5, 0, 3.4, 0.4, 3.4, accentPinkMat, false);

    const holoGeo = new THREE.TorusGeometry(3.1, 0.09, 8, 32);
    holoGeo.rotateX(Math.PI / 2);
    geos.push(holoGeo);
    const holoRing = new THREE.Mesh(holoGeo, accentPinkMat);
    holoRing.position.set(0, 7.4, 0);
    group.add(holoRing);
    animatedObjects.push({
      mesh: holoRing,
      baseY: 7.4,
      speed: 2.0,
      phase: 0,
      spinSpeed: 1.8,
    });

    addBoxBlock(0, 0.9, 8.5 * scale, 5.5, 1.8, 1.2, coverMat);
    addBoxBlock(0, 0.9, -8.5 * scale, 5.5, 1.8, 1.2, coverMat);
    addBoxBlock(-8.5 * scale, 0.9, 0, 1.2, 1.8, 5.5, coverMat);
    addBoxBlock(8.5 * scale, 0.9, 0, 1.2, 1.8, 5.5, coverMat);
    addGlassTopper(0, 2.15, 8.5 * scale, 5.2, 0.7, 0.08);
    addGlassTopper(0, 2.15, -8.5 * scale, 5.2, 0.7, 0.08);

    addJumpPad(-21 * scale, 15 * scale, accentPinkMat, 13.8, 0xec4899);
    addJumpPad(21 * scale, -15 * scale, accentPinkMat, 13.8, 0xec4899);
    addOverheadTrusses(accentPinkMat, size);
    addExteriorTowers(accentPinkMat);
  } else if (tpl === 'graveyard') {
    // Crypt center + stone obelisks & mausoleum walls
    addBoxBlock(0, 1.8, 0, 7.5, 3.6, 5.5, wallMat);
    addBoxBlock(0, 3.7, 0, 8.0, 0.3, 6.0, accentPinkMat, false);
    [
      [-12 * scale, -10 * scale],
      [12 * scale, -10 * scale],
      [-12 * scale, 10 * scale],
      [12 * scale, 10 * scale],
      [-18 * scale, 0],
      [18 * scale, 0],
    ].forEach(([ox, oz]) => {
      addBoxBlock(ox, 2.1, oz, 2.2, 4.2, 2.2, wallMat);
      addBoxBlock(ox, 4.3, oz, 2.4, 0.25, 2.4, accentOrangeMat, false);
    });
    addBoxBlock(0, 0.85, 12 * scale, 6, 1.7, 1.3, coverMat);
    addBoxBlock(0, 0.85, -12 * scale, 6, 1.7, 1.3, coverMat);
    addJumpPad(-20 * scale, 0, accentPinkMat, 13.0, 0xa855f7);
    addJumpPad(20 * scale, 0, accentPinkMat, 13.0, 0xa855f7);
    addExteriorTowers(accentPinkMat);
  } else if (tpl === 'splash') {
    // Waterpark central splash deck + twin slide ramps
    addBoxBlock(0, 1.0, 0, 12 * scale, 2.0, 10, coverMat);
    addBoxBlock(0, 2.05, 0, 12.1 * scale, 0.12, 10.1, accentCyanMat, false);
    makeRampMesh(-12 * scale, -6 * scale, -2.5, 2.5, 0, 2.0, 'x', true);
    makeRampMesh(6 * scale, 12 * scale, -2.5, 2.5, 0, 2.0, 'x', false);
    [-14 * scale, 14 * scale].forEach((cx) => {
      addBoxBlock(cx, 1.5, -12 * scale, 4.2, 3.0, 4.2, yellowSubwayMat);
      addBoxBlock(cx, 1.5, 12 * scale, 4.2, 3.0, 4.2, yellowSubwayMat);
    });
    addJumpPad(-20 * scale, -18 * scale, accentCyanMat, 14.0, 0x22d3ee);
    addJumpPad(20 * scale, 18 * scale, accentCyanMat, 14.0, 0x22d3ee);
    addJumpPad(0, -16 * scale, accentCyanMat, 13.0, 0x22d3ee);
    addExteriorTowers(accentCyanMat);
  } else if (tpl === 'construction' || tpl === 'factory') {
    // Steel scaffolding towers & catwalks
    addBoxBlock(-10 * scale, 1.4, 0, 5.5, 2.8, 16, coverMat);
    addBoxBlock(10 * scale, 1.4, 0, 5.5, 2.8, 16, coverMat);
    addBoxBlock(0, 2.85, 0, 15 * scale, 0.4, 4.2, wallMat);
    addBoxBlock(0, 3.1, 0, 15 * scale, 0.1, 4.3, accentOrangeMat, false);
    makeRampMesh(-13 * scale, -7 * scale, 8, 14, 0, 2.8, 'z', false);
    makeRampMesh(7 * scale, 13 * scale, -14, -8, 0, 2.8, 'z', true);
    addBoxBlock(0, 0.9, 13 * scale, 6.5, 1.8, 1.4, redCargoMat);
    addBoxBlock(0, 0.9, -13 * scale, 6.5, 1.8, 1.4, blueCargoMat);
    addJumpPad(0, 0, accentOrangeMat, 14.0, 0xf97316);
    addOverheadTrusses(accentOrangeMat, size);
    addExteriorTowers(accentOrangeMat);
  } else if (tpl === 'chess') {
    // Giant Knight / Rook style symmetrical columns on checkerboard floor
    const pieces = [
      [-10, -10, true],
      [10, -10, false],
      [-10, 10, false],
      [10, 10, true],
      [0, -7, false],
      [0, 7, true],
    ] as const;
    pieces.forEach(([px, pz, lightPiece]) => {
      addBoxBlock(px, 1.75, pz, 3.0, 3.5, 3.0, lightPiece ? coverMat : wallMat);
      addBoxBlock(px, 3.6, pz, 3.4, 0.35, 3.4, lightPiece ? accentCyanMat : accentOrangeMat, false);
    });
    addJumpPad(-19, 0, accentOrangeMat, 13.0, 0xfacc15);
    addJumpPad(19, 0, accentOrangeMat, 13.0, 0xfacc15);
    addExteriorTowers(accentOrangeMat);
  } else if (tpl === 'onyx') {
    // Clean competitive obsidian mirror layout
    addBoxBlock(0, 1.1, 0, 7, 2.2, 7, wallMat);
    addBoxBlock(0, 2.25, 0, 7.2, 0.1, 7.2, accentPinkMat, false);
    [-11, 11].forEach((ox) => {
      addBoxBlock(ox, 1.35, -8, 3.2, 2.7, 4.5, coverMat);
      addBoxBlock(ox, 1.35, 8, 3.2, 2.7, 4.5, coverMat);
    });
    addBoxBlock(0, 0.9, 13, 5.2, 1.8, 1.2, coverMat);
    addBoxBlock(0, 0.9, -13, 5.2, 1.8, 1.2, coverMat);
    addJumpPad(-20, -18, accentPinkMat, 13.0, 0xc084fc);
    addJumpPad(20, 18, accentPinkMat, 13.0, 0xc084fc);
    addExteriorTowers(accentPinkMat);
  } else if (tpl === 'bridge') {
    // Central high-speed suspension bridge + side catwalk beams
    addBoxBlock(-14, 2.5, 0, 8, 5.0, 40, wallMat);
    addBoxBlock(14, 2.5, 0, 8, 5.0, 40, wallMat);
    addBoxBlock(0, 1.0, 0, 4.2, 2.0, 10, coverMat);
    addGlassTopper(0, 2.35, 0, 0.12, 0.8, 9.6);
    [-6, 6].forEach((bz) => {
      addBoxBlock(0, 0.95, bz * 2.2, 7.5, 1.9, 1.6, coverMat);
    });
    addJumpPad(-6, 17, accentCyanMat, 12.5, 0x38bdf8);
    addJumpPad(6, -17, accentCyanMat, 12.5, 0x38bdf8);
    addOverheadTrusses(accentCyanMat, size);
  } else if (tpl === 'battleground' || tpl === 'temple') {
    // Warzone bunkers / Sandstone courtyard
    addBoxBlock(0, 1.3, 0, 9, 2.6, 9, wallMat);
    makeRampMesh(-10, -4.5, -2.5, 2.5, 0, 2.6, 'x', true);
    makeRampMesh(4.5, 10, -2.5, 2.5, 0, 2.6, 'x', false);
    [
      [-15, -13],
      [15, -13],
      [-15, 13],
      [15, 13],
    ].forEach(([tx, tz]) => {
      addBoxBlock(tx, 2.4, tz, 3.8, 4.8, 3.8, coverMat);
      addBoxBlock(tx, 4.9, tz, 4.0, 0.25, 4.0, accentOrangeMat, false);
    });
    addBoxBlock(0, 0.85, 14, 6.5, 1.7, 1.4, coverMat);
    addBoxBlock(0, 0.85, -14, 6.5, 1.7, 1.4, coverMat);
    addJumpPad(-21, 0, accentOrangeMat, 13.0, 0xf59e0b);
    addJumpPad(21, 0, accentOrangeMat, 13.0, 0xf59e0b);
    addExteriorTowers(accentOrangeMat);
  } else if (tpl === 'experimental') {
    // SkyGrid Experimental: minimal symmetrical prism cover + quad bounce pads
    [
      [-9, -9],
      [9, -9],
      [-9, 9],
      [9, 9],
    ].forEach(([px, pz]) => {
      addBoxBlock(px, 1.5, pz, 2.6, 3.0, 2.6, coverMat);
      addBoxBlock(px, 3.05, pz, 2.7, 0.12, 2.7, accentCyanMat, false);
    });
    addBoxBlock(0, 1.1, 0, 4.4, 2.2, 4.4, wallMat);
    addJumpPad(-17, -17, accentCyanMat, 14.5, 0x38bdf8);
    addJumpPad(17, -17, accentPinkMat, 14.5, 0xec4899);
    addJumpPad(-17, 17, accentPinkMat, 14.5, 0xec4899);
    addJumpPad(17, 17, accentCyanMat, 14.5, 0x38bdf8);
  } else {
    // VANGUARD ARENA & SHOOTING RANGE DUEL ARENA
    addBoxBlock(0, 1.2, 0, 10, 2.4, 10, coverMat);
    addBoxBlock(0, 2.42, 0, 10.1, 0.08, 10.1, accentOrangeMat, false);

    makeRampMesh(-11, -5, -2.5, 2.5, 0, 2.4, 'x', true);
    makeRampMesh(5, 11, -2.5, 2.5, 0, 2.4, 'x', false);

    [
      [-14 * scale, -12 * scale],
      [14 * scale, -12 * scale],
      [-14 * scale, 12 * scale],
      [14 * scale, 12 * scale],
    ].forEach(([px, pz]) => {
      addBoxBlock(px, 2.6, pz, 3.2, 5.2, 3.2, wallMat);
      addBoxBlock(px, 4.9, pz, 3.35, 0.25, 3.35, accentCyanMat, false);
    });

    addBoxBlock(0, 0.85, 13.5 * scale, 5.2, 1.7, 1.4, coverMat);
    addBoxBlock(0, 0.85, -13.5 * scale, 5.2, 1.7, 1.4, coverMat);
    addGlassTopper(0, 2.05, 13.5 * scale, 4.8, 0.7, 0.08);
    addGlassTopper(0, 2.05, -13.5 * scale, 4.8, 0.7, 0.08);

    addBoxBlock(-19 * scale, 1.1, 0, 2.2, 2.2, 6.4, coverMat);
    addBoxBlock(19 * scale, 1.1, 0, 2.2, 2.2, 6.4, coverMat);

    addJumpPad(-21 * scale, -19 * scale, accentCyanMat, 12.5, 0x38bdf8);
    addJumpPad(21 * scale, 19 * scale, accentCyanMat, 12.5, 0x38bdf8);
    addOverheadTrusses(accentCyanMat, size);
    addExteriorTowers(accentCyanMat);
  }

  // Seasonal Reskin Visual Props (Halloween jack-o-lantern orbs / Winter ice spires)
  if (seasonalTheme === 'halloween') {
    const pumpkinGeo = new THREE.SphereGeometry(0.65, 10, 10);
    geos.push(pumpkinGeo);
    [
      [-23, -23],
      [23, -23],
      [-23, 23],
      [23, 23],
    ].forEach(([px, pz], idx) => {
      const orb = new THREE.Mesh(pumpkinGeo, accentOrangeMat);
      orb.position.set(px * scale, 2.2, pz * scale);
      group.add(orb);
      animatedObjects.push({
        mesh: orb,
        baseY: 2.2,
        speed: 2.2,
        phase: idx * 1.4,
        spinSpeed: 1.1,
      });
    });
  } else if (seasonalTheme === 'winter') {
    const iceGeo = new THREE.ConeGeometry(0.9, 3.2, 5);
    geos.push(iceGeo);
    [
      [-24, -24],
      [24, -24],
      [-24, 24],
      [24, 24],
    ].forEach(([ix, iz]) => {
      const spire = new THREE.Mesh(iceGeo, accentCyanMat);
      spire.position.set(ix * scale, 1.6, iz * scale);
      group.add(spire);
    });
  }

  // CTF 3D Flag Stands
  let ctfFlags: CtfFlagVisuals | undefined;
  if (matchFormat === 'ctf') {
    const createFlagGroup = (colorHex: number) => {
      const g = new THREE.Group();
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8);
      const bannerGeo = new THREE.BoxGeometry(1.1, 0.72, 0.08);
      const ringGeo = new THREE.TorusGeometry(1.3, 0.08, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      geos.push(poleGeo, bannerGeo, ringGeo);
      const flagMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 1.1,
      });
      mats.push(flagMat);
      const pole = new THREE.Mesh(poleGeo, coverMat);
      pole.position.y = 1.6;
      const banner = new THREE.Mesh(bannerGeo, flagMat);
      banner.position.set(0.55, 2.75, 0);
      const baseRing = new THREE.Mesh(ringGeo, flagMat);
      baseRing.position.y = 0.06;
      g.add(pole, banner, baseRing);
      return g;
    };
    const alphaBase = new THREE.Vector3(0, 0, 20 * scale);
    const bravoBase = new THREE.Vector3(0, 0, -20 * scale);
    const alphaMesh = createFlagGroup(0x38bdf8);
    alphaMesh.position.copy(alphaBase);
    const bravoMesh = createFlagGroup(0xf43f5e);
    bravoMesh.position.copy(bravoBase);
    group.add(alphaMesh, bravoMesh);
    ctfFlags = {alphaBase, bravoBase, alphaMesh, bravoMesh};
  }

  // Domination A/B/C Zone Rings
  let domZones: DominationZoneSpec[] | undefined;
  if (matchFormat === 'domination') {
    const zoneDefs: {label: 'A' | 'B' | 'C'; x: number; z: number}[] = [
      {label: 'A', x: 0, z: 16 * scale},
      {label: 'B', x: -16 * scale, z: 0},
      {label: 'C', x: 0, z: -16 * scale},
    ];
    domZones = zoneDefs.map((zDef) => {
      const rGeo = new THREE.RingGeometry(3.5, 4.0, 28);
      rGeo.rotateX(-Math.PI / 2);
      geos.push(rGeo);
      const rMat = new THREE.MeshBasicMaterial({
        color: 0x94a3b8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      });
      mats.push(rMat);
      const ringMesh = new THREE.Mesh(rGeo, rMat);
      ringMesh.position.set(zDef.x, 0.08, zDef.z);
      group.add(ringMesh);
      return {
        label: zDef.label,
        x: zDef.x,
        z: zDef.z,
        radius: 4.2,
        ringMesh,
        ringMat: rMat,
      };
    });
  }

  if (!isSoftwareGl) {
    const centerGlow = new THREE.PointLight(themeColors.padLight, 2.4, 28, 2);
    centerGlow.position.set(0, 8.0, 0);
    group.add(centerGlow);
  }

  return {
    group,
    colliders,
    ramps,
    jumpPads,
    shootableWalls,
    animatedObjects,
    spawns,
    charlieSpawns,
    playerSpawn: spawns[0],
    rivalSpawn: spawns[1],
    arenaHalfExtent: half - 1.5,
    ctfFlags,
    domZones,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
    },
  };
}
