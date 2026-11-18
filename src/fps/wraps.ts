import * as THREE from 'three';
import type {WrapId} from './types';
import {WRAPS} from './weapons';

export interface WrapMaterialSet {
  primaryMat: THREE.MeshPhysicalMaterial;
  accentMat: THREE.MeshStandardMaterial;
  darkSteelMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createWrapMaterialSet(
  wrapId: WrapId,
  maxAnisotropy: number,
  usePbr = true,
): WrapMaterialSet {
  const spec = WRAPS[wrapId];
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = spec.primaryHex;
  ctx.fillRect(0, 0, 256, 256);

  if (wrapId === 'carbon') {
    ctx.fillStyle = spec.secondaryHex;
    for (let y = 0; y < 256; y += 16) {
      for (let x = 0; x < 256; x += 16) {
        if (((x + y) / 16) % 2 === 0) ctx.fillRect(x, y, 14, 14);
      }
    }
    ctx.fillStyle = spec.accentHex;
    ctx.fillRect(0, 118, 256, 12);
  } else if (wrapId === 'arctic') {
    ctx.fillStyle = spec.secondaryHex;
    for (let i = 0; i < 18; i++) {
      const rx = (i * 73) % 240;
      const ry = (i * 137) % 240;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + 46, ry + 12);
      ctx.lineTo(rx + 22, ry + 48);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = spec.accentHex;
    ctx.fillRect(0, 224, 256, 14);
  } else if (wrapId === 'crimson') {
    ctx.strokeStyle = spec.secondaryHex;
    ctx.lineWidth = 5;
    for (let y = -32; y < 288; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + 96);
      ctx.stroke();
    }
    ctx.fillStyle = spec.accentHex;
    ctx.fillRect(0, 122, 256, 8);
  } else if (wrapId === 'desert') {
    ctx.fillStyle = spec.secondaryHex;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.ellipse(
        (i * 41) % 256,
        (i * 67) % 256,
        42,
        10,
        0.35,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = spec.accentHex;
    ctx.fillRect(0, 18, 256, 8);
  } else if (wrapId === 'neon' || wrapId === 'frost' || wrapId === 'venom') {
    ctx.fillStyle = spec.secondaryHex;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = spec.accentHex;
    ctx.lineWidth = 4;
    for (let i = 0; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
  } else if (wrapId === 'urban') {
    ctx.fillStyle = spec.secondaryHex;
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 32) {
        if (((x + y) / 32) % 2 === 0) ctx.fillRect(x, y, 28, 28);
      }
    }
    ctx.fillStyle = spec.accentHex;
    ctx.fillRect(0, 200, 256, 12);
  } else if (wrapId === 'cobalt' || wrapId === 'gold' || wrapId === 'magma' || wrapId === 'nova') {
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, spec.primaryHex);
    grad.addColorStop(0.5, spec.accentHex);
    grad.addColorStop(1, spec.secondaryHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 0; y < 256; y += 6) ctx.fillRect(0, y, 256, 2);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#047857');
    grad.addColorStop(0.5, '#10b981');
    grad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(256 - i, 256);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(16, Math.max(1, maxAnisotropy));

  let normalTex: THREE.CanvasTexture | null = null;
  let roughTex: THREE.CanvasTexture | null = null;

  if (usePbr) {
    const nCanvas = document.createElement('canvas');
    nCanvas.width = 128;
    nCanvas.height = 128;
    const nctx = nCanvas.getContext('2d')!;
    nctx.fillStyle = 'rgb(128, 128, 255)';
    nctx.fillRect(0, 0, 128, 128);
    if (wrapId === 'carbon' || wrapId === 'urban') {
      for (let y = 0; y < 128; y += 16) {
        for (let x = 0; x < 128; x += 16) {
          nctx.fillStyle = (x + y) % 32 === 0 ? 'rgb(142, 128, 245)' : 'rgb(114, 128, 245)';
          nctx.fillRect(x + 1, y + 1, 14, 14);
        }
      }
    } else {
      for (let y = 0; y < 128; y += 4) {
        nctx.fillStyle = y % 8 === 0 ? 'rgb(128, 118, 248)' : 'rgb(128, 138, 248)';
        nctx.fillRect(0, y, 128, 2);
      }
    }
    normalTex = new THREE.CanvasTexture(nCanvas);
    normalTex.colorSpace = THREE.NoColorSpace;
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(2, 2);

    const rCanvas = document.createElement('canvas');
    rCanvas.width = 128;
    rCanvas.height = 128;
    const rctx = rCanvas.getContext('2d')!;
    const baseR = Math.round(spec.roughness * 255);
    rctx.fillStyle = `rgb(${baseR},${baseR},${baseR})`;
    rctx.fillRect(0, 0, 128, 128);
    const altR = Math.min(255, Math.max(20, baseR + 34));
    rctx.fillStyle = `rgb(${altR},${altR},${altR})`;
    for (let y = 0; y < 128; y += 16) {
      rctx.fillRect(0, y, 128, 3);
    }
    roughTex = new THREE.CanvasTexture(rCanvas);
    roughTex.colorSpace = THREE.NoColorSpace;
    roughTex.wrapS = THREE.RepeatWrapping;
    roughTex.wrapT = THREE.RepeatWrapping;
    roughTex.repeat.set(2, 2);
  }

  const primaryMat = new THREE.MeshPhysicalMaterial({
    map: tex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughnessMap: roughTex,
    metalness: spec.metalness,
    roughness: spec.roughness,
    clearcoat:
      wrapId === 'gold' ||
      wrapId === 'cobalt' ||
      wrapId === 'prism' ||
      wrapId === 'neon' ||
      wrapId === 'nova' ||
      wrapId === 'frost'
        ? 0.92
        : 0.38,
    clearcoatRoughness: 0.14,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.accentHex),
    emissive: new THREE.Color(spec.accentHex),
    emissiveIntensity:
      wrapId === 'neon' || wrapId === 'nova' || wrapId === 'venom' ? 1.05 : 0.45,
    metalness: 0.6,
    roughness: 0.22,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x171c26,
    metalness: 0.78,
    roughness: 0.32,
  });

  return {
    primaryMat,
    accentMat,
    darkSteelMat,
    dispose: () => {
      tex.dispose();
      normalTex?.dispose();
      roughTex?.dispose();
      primaryMat.dispose();
      accentMat.dispose();
      darkSteelMat.dispose();
    },
  };
}
