import * as THREE from 'three';
import type {TrackBiome} from './types';

export interface BiomePalette {
  skyColor: number;
  fogColor: number;
  groundColor: number;
  groundAccent: number;
  cliffColor: number;
  foliagePrimary: number;
  foliageSecondary: number;
  sunColor: number;
  hemiSky: number;
  hemiGround: number;
}

export const BIOME_PALETTES: Record<TrackBiome, BiomePalette> = {
  canyon: {
    skyColor: 0x1c2538,
    fogColor: 0x293247,
    groundColor: 0x8f563b,
    groundAccent: 0xb26d47,
    cliffColor: 0x6b3e2b,
    foliagePrimary: 0x3b6e4c,
    foliageSecondary: 0x4f8357,
    sunColor: 0xffdfb3,
    hemiSky: 0x8fb4e8,
    hemiGround: 0x6b412e,
  },
  skyline: {
    skyColor: 0x101829,
    fogColor: 0x162035,
    groundColor: 0x243044,
    groundAccent: 0x2e3e57,
    cliffColor: 0x1a2436,
    foliagePrimary: 0x2d6a62,
    foliageSecondary: 0x368077,
    sunColor: 0xdbeafe,
    hemiSky: 0x60a5fa,
    hemiGround: 0x1a2234,
  },
  alpine: {
    skyColor: 0x82b3d9,
    fogColor: 0xa6cbe5,
    groundColor: 0x3f6e4b,
    groundAccent: 0x52855c,
    cliffColor: 0x64748b,
    foliagePrimary: 0x1f4d36,
    foliageSecondary: 0x2c6647,
    sunColor: 0xfff3d6,
    hemiSky: 0xcbe6ff,
    hemiGround: 0x3a5241,
  },
};

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export interface MaterialLibrary {
  asphalt: THREE.MeshStandardMaterial;
  curb: THREE.MeshStandardMaterial;
  guardrail: THREE.MeshStandardMaterial;
  boostMat: THREE.MeshStandardMaterial;
  startFinishMat: THREE.MeshStandardMaterial;
  checkpointMat: THREE.MeshStandardMaterial;
  pillarMat: THREE.MeshStandardMaterial;
  jumpLipMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createTrackMaterials(maxAnisotropy: number): MaterialLibrary {
  const textures: THREE.Texture[] = [];

  // 1. Crisp Asphalt with dashed centerline & subtle shoulder stripes
  const asphaltTex = makeCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#262b36';
      ctx.fillRect(0, 0, w, h);

      // Subtle mineral grain
      for (let i = 0; i < 4200; i++) {
        const x = (i * 97) % w;
        const y = (i * 53) % h;
        const lum = 34 + ((i * 17) % 16);
        ctx.fillStyle = `rgb(${lum},${lum + 4},${lum + 10})`;
        ctx.fillRect(x, y, 2, 2);
      }

      // Edge white racing lines
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(14, 0, 10, h);
      ctx.fillRect(w - 24, 0, 10, h);

      // Subtle tire-wear track grooves
      ctx.fillStyle = 'rgba(14, 18, 26, 0.25)';
      ctx.fillRect(w * 0.26, 0, w * 0.14, h);
      ctx.fillRect(w * 0.60, 0, w * 0.14, h);

      // Center dashed line
      ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
      for (let y = 16; y < h; y += 64) {
        ctx.fillRect(w * 0.5 - 4, y, 8, 34);
      }
    },
    maxAnisotropy,
    1,
    2,
  );
  textures.push(asphaltTex);

  // 2. Red & White Apex Curb Stripes
  const curbTex = makeCanvasTexture(
    128,
    256,
    (ctx, w, h) => {
      const bands = 4;
      const bandH = h / bands;
      for (let i = 0; i < bands; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#f8fafc';
        ctx.fillRect(0, i * bandH, w, bandH);
      }
    },
    maxAnisotropy,
    1,
    3,
  );
  textures.push(curbTex);

  // 3. Glowing Boost Chevron Strip
  const boostTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Draw crisp glowing chevrons pointing along -V (forward)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 22;
      ctx.lineCap = 'square';
      for (let row = 0; row < 3; row++) {
        const cy = 54 + row * 84;
        ctx.beginPath();
        ctx.moveTo(42, cy + 36);
        ctx.lineTo(w * 0.5, cy - 16);
        ctx.lineTo(w - 42, cy + 36);
        ctx.stroke();
      }
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, w - 16, h - 16);
    },
    maxAnisotropy,
    1,
    1,
  );
  textures.push(boostTex);

  // 4. Checkered Start / Finish Banner
  const checkerTex = makeCanvasTexture(
    256,
    128,
    (ctx, w, h) => {
      const cols = 8;
      const rows = 4;
      const cw = w / cols;
      const ch = h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#0f172a';
          ctx.fillRect(c * cw, r * ch, cw, ch);
        }
      }
    },
    maxAnisotropy,
    1,
    1,
  );
  textures.push(checkerTex);

  const asphalt = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.78,
    metalness: 0.08,
  });

  const curb = new THREE.MeshStandardMaterial({
    map: curbTex,
    roughness: 0.65,
    metalness: 0.05,
  });

  const guardrail = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.35,
    metalness: 0.65,
  });

  const boostMat = new THREE.MeshStandardMaterial({
    map: boostTex,
    emissive: 0x0284c7,
    emissiveMap: boostTex,
    emissiveIntensity: 1.4,
    roughness: 0.3,
    metalness: 0.2,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const startFinishMat = new THREE.MeshStandardMaterial({
    map: checkerTex,
    roughness: 0.45,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const checkpointMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.85,
    roughness: 0.35,
    metalness: 0.3,
  });

  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.82,
    metalness: 0.18,
  });

  const jumpLipMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    roughness: 0.4,
    metalness: 0.25,
  });

  return {
    asphalt,
    curb,
    guardrail,
    boostMat,
    startFinishMat,
    checkpointMat,
    pillarMat,
    jumpLipMat,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      asphalt.dispose();
      curb.dispose();
      guardrail.dispose();
      boostMat.dispose();
      startFinishMat.dispose();
      checkpointMat.dispose();
      pillarMat.dispose();
      jumpLipMat.dispose();
    },
  };
}
