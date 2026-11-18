import * as THREE from 'three';
import {BIOME_PALETTES, type MaterialLibrary} from './materials';
import {
  ROAD_HALF_WIDTH,
  TILE_SIZE,
  forwardVec,
  rightVec,
  sampleSegment,
} from './tracks';
import type {BuiltTrack, BuiltTrackSegment} from './types';

export interface BuiltTrackVisuals {
  group: THREE.Group;
  checkpointMaterials: THREE.MeshStandardMaterial[];
  dispose: () => void;
}

function buildRibbonStrip(
  seg: BuiltTrackSegment,
  uStart: number,
  uEnd: number,
  steps: number,
  latLeft: number,
  latRight: number,
  yOffset: number,
  thickness: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const totalLen = seg.length * (uEnd - uStart);
  const vRepeat = Math.max(0.5, totalLen / 14);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = uStart + (uEnd - uStart) * t;
    const pL = sampleSegment(seg, u, latLeft);
    const pR = sampleSegment(seg, u, latRight);

    // Top-left (0), Top-right (1), Bottom-left (2), Bottom-right (3)
    positions.push(
      pL.x, pL.y + yOffset, pL.z,
      pR.x, pR.y + yOffset, pR.z,
      pL.x, pL.y + yOffset - thickness, pL.z,
      pR.x, pR.y + yOffset - thickness, pR.z,
    );

    const vCoord = t * vRepeat;
    uvs.push(
      0, vCoord,
      1, vCoord,
      0, vCoord,
      1, vCoord,
    );
  }

  for (let i = 0; i < steps; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    // Top face
    indices.push(a + 0, a + 1, b + 0);
    indices.push(a + 1, b + 1, b + 0);
    // Left side wall
    indices.push(a + 2, a + 0, b + 2);
    indices.push(a + 0, b + 0, b + 2);
    // Right side wall
    indices.push(a + 1, a + 3, b + 1);
    indices.push(a + 3, b + 3, b + 1);
    // Bottom face
    indices.push(a + 3, a + 2, b + 3);
    indices.push(a + 2, b + 2, b + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildFlatDecalStrip(
  seg: BuiltTrackSegment,
  uStart: number,
  uEnd: number,
  steps: number,
  latLeft: number,
  latRight: number,
  yOffset: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = uStart + (uEnd - uStart) * t;
    const pL = sampleSegment(seg, u, latLeft);
    const pR = sampleSegment(seg, u, latRight);
    positions.push(
      pL.x, pL.y + yOffset, pL.z,
      pR.x, pR.y + yOffset, pR.z,
    );
    uvs.push(0, t, 1, t);
  }

  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    const b = (i + 1) * 2;
    indices.push(a, a + 1, b);
    indices.push(a + 1, b + 1, b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addGantry(
  parent: THREE.Group,
  seg: BuiltTrackSegment,
  u: number,
  bannerMat: THREE.Material,
  pillarMat: THREE.Material,
  geometries: THREE.BufferGeometry[],
): void {
  const center = sampleSegment(seg, u, 0);
  const gantry = new THREE.Group();
  gantry.position.set(center.x, center.y, center.z);
  gantry.rotation.y = center.heading;

  const span = ROAD_HALF_WIDTH * 2 + 1.8;
  const height = 4.6;

  const postGeo = new THREE.BoxGeometry(0.45, height, 0.45);
  const crossGeo = new THREE.BoxGeometry(span + 0.6, 0.55, 0.55);
  const bannerGeo = new THREE.BoxGeometry(span - 0.8, 1.05, 0.62);
  geometries.push(postGeo, crossGeo, bannerGeo);

  const leftPost = new THREE.Mesh(postGeo, pillarMat);
  leftPost.position.set(-span * 0.5, height * 0.5, 0);
  leftPost.castShadow = true;

  const rightPost = new THREE.Mesh(postGeo, pillarMat);
  rightPost.position.set(span * 0.5, height * 0.5, 0);
  rightPost.castShadow = true;

  const cross = new THREE.Mesh(crossGeo, pillarMat);
  cross.position.set(0, height + 0.1, 0);
  cross.castShadow = true;

  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, height - 0.6, 0);

  gantry.add(leftPost, rightPost, cross, banner);
  parent.add(gantry);
}

// Deterministic pseudo-random helper for consistent offline scenery
function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createTrackVisuals(
  track: BuiltTrack,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): BuiltTrackVisuals {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const extraMaterials: THREE.Material[] = [];
  const checkpointMaterials: THREE.MeshStandardMaterial[] = [];

  const palette = BIOME_PALETTES[track.definition.biome];

  // Build segments
  for (let i = 0; i < track.segments.length; i++) {
    const seg = track.segments[i];
    const isTurn = seg.type === 'left' || seg.type === 'right';
    const steps = isTurn ? 18 : seg.type === 'ramp_up' || seg.type === 'ramp_down' ? 12 : 4;

    if (seg.type === 'jump') {
      // Launch ramp section + landing apron
      const launchRoad = buildRibbonStrip(seg, 0, 0.42, 8, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, 0, 0.65);
      const landRoad = buildRibbonStrip(seg, 0.70, 1.0, 6, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, 0, 0.65);
      const lipGeo = buildFlatDecalStrip(seg, 0.34, 0.42, 2, -ROAD_HALF_WIDTH + 0.4, ROAD_HALF_WIDTH - 0.4, 0.03);
      geometries.push(launchRoad, landRoad, lipGeo);

      const m1 = new THREE.Mesh(launchRoad, mats.asphalt);
      m1.receiveShadow = true;
      m1.castShadow = true;
      const m2 = new THREE.Mesh(landRoad, mats.asphalt);
      m2.receiveShadow = true;
      m2.castShadow = true;
      const lip = new THREE.Mesh(lipGeo, mats.jumpLipMat);
      group.add(m1, m2, lip);

      // Curbs on launch & land
      [-1, 1].forEach((side) => {
        const lA = side < 0 ? -ROAD_HALF_WIDTH - 0.75 : ROAD_HALF_WIDTH;
        const lB = side < 0 ? -ROAD_HALF_WIDTH : ROAD_HALF_WIDTH + 0.75;
        const c1 = buildRibbonStrip(seg, 0, 0.42, 8, lA, lB, 0.08, 0.73);
        const c2 = buildRibbonStrip(seg, 0.70, 1.0, 6, lA, lB, 0.08, 0.73);
        geometries.push(c1, c2);
        const cm1 = new THREE.Mesh(c1, mats.curb);
        const cm2 = new THREE.Mesh(c2, mats.curb);
        cm1.receiveShadow = true;
        cm2.receiveShadow = true;
        group.add(cm1, cm2);
      });
    } else {
      // Full continuous road deck
      const roadGeo = buildRibbonStrip(seg, 0, 1, steps, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, 0, 0.65);
      geometries.push(roadGeo);
      const roadMesh = new THREE.Mesh(roadGeo, mats.asphalt);
      roadMesh.receiveShadow = true;
      roadMesh.castShadow = true;
      group.add(roadMesh);

      // Curbs & Guardrails on both sides
      [-1, 1].forEach((side) => {
        const lA = side < 0 ? -ROAD_HALF_WIDTH - 0.85 : ROAD_HALF_WIDTH;
        const lB = side < 0 ? -ROAD_HALF_WIDTH : ROAD_HALF_WIDTH + 0.85;
        const curbGeo = buildRibbonStrip(seg, 0, 1, steps, lA, lB, 0.09, 0.74);
        geometries.push(curbGeo);
        const curbMesh = new THREE.Mesh(curbGeo, mats.curb);
        curbMesh.receiveShadow = true;
        curbMesh.castShadow = true;
        group.add(curbMesh);

        // Guardrail ribbon raised at outer edge
        const rA = side < 0 ? -ROAD_HALF_WIDTH - 0.82 : ROAD_HALF_WIDTH + 0.56;
        const rB = side < 0 ? -ROAD_HALF_WIDTH - 0.56 : ROAD_HALF_WIDTH + 0.82;
        const railGeo = buildRibbonStrip(seg, 0, 1, steps, rA, rB, 0.68, 0.34);
        geometries.push(railGeo);
        const railMesh = new THREE.Mesh(railGeo, mats.guardrail);
        railMesh.castShadow = true;
        group.add(railMesh);
      });
    }

    // Elevated support piers for bridges & ramps
    const mid = sampleSegment(seg, 0.5, 0);
    if (mid.y > 1.2) {
      const pierHeight = mid.y + 1.5;
      const pierGeo = new THREE.BoxGeometry(1.8, pierHeight, 1.8);
      geometries.push(pierGeo);
      [-ROAD_HALF_WIDTH + 1.4, ROAD_HALF_WIDTH - 1.4].forEach((lat) => {
        const p = sampleSegment(seg, 0.5, lat);
        const pier = new THREE.Mesh(pierGeo, mats.pillarMat);
        pier.position.set(p.x, (p.y - 1.5) * 0.5 - 0.3, p.z);
        pier.rotation.y = p.heading;
        pier.castShadow = true;
        pier.receiveShadow = true;
        group.add(pier);
      });
    }

    // Feature overlays
    if (seg.type === 'boost') {
      const boostGeo = buildFlatDecalStrip(seg, 0.12, 0.88, 2, -2.8, 2.8, 0.03);
      geometries.push(boostGeo);
      const boostMesh = new THREE.Mesh(boostGeo, mats.boostMat);
      group.add(boostMesh);
    }

    if (seg.type === 'start') {
      const lineGeo = buildFlatDecalStrip(seg, 0.44, 0.56, 1, -ROAD_HALF_WIDTH + 0.3, ROAD_HALF_WIDTH - 0.3, 0.03);
      geometries.push(lineGeo);
      group.add(new THREE.Mesh(lineGeo, mats.startFinishMat));
      addGantry(group, seg, 0.5, mats.startFinishMat, mats.pillarMat, geometries);
    }

    if (seg.type === 'finish') {
      const lineGeo = buildFlatDecalStrip(seg, 0.44, 0.56, 1, -ROAD_HALF_WIDTH + 0.3, ROAD_HALF_WIDTH - 0.3, 0.03);
      geometries.push(lineGeo);
      group.add(new THREE.Mesh(lineGeo, mats.startFinishMat));
      addGantry(group, seg, 0.5, mats.startFinishMat, mats.pillarMat, geometries);
    }

    if (seg.type === 'checkpoint') {
      const cpMat = mats.checkpointMat.clone();
      extraMaterials.push(cpMat);
      checkpointMaterials.push(cpMat);
      addGantry(group, seg, 0.5, cpMat, mats.pillarMat, geometries);
    }
  }

  // Rolling Low-Poly Terrain Ground (never boxed in indoor walls!)
  const terrainSize = 1500;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, 64, 64);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i) + track.centerX;
    const vz = posAttr.getZ(i) + track.centerZ;

    // Keep track footprint flat at y = -1.6m, gently undulate outer hills
    let minTrackDist = Infinity;
    for (let s = 0; s < track.segments.length; s++) {
      const seg = track.segments[s];
      const mx = (seg.startX + seg.endX) * 0.5;
      const mz = (seg.startZ + seg.endZ) * 0.5;
      const d = Math.hypot(vx - mx, vz - mz);
      if (d < minTrackDist) minTrackDist = d;
    }

    const hillMask = Math.max(0, Math.min(1, (minTrackDist - 32) / 90));
    const wave =
      Math.sin(vx * 0.015) * Math.cos(vz * 0.015) * 18 +
      Math.sin(vx * 0.038 + vz * 0.025) * 7;
    const rimLift = Math.max(0, (Math.hypot(vx - track.centerX, vz - track.centerZ) - 240) * 0.14);
    const vy = -1.6 + hillMask * (Math.max(0, wave) + rimLift);

    posAttr.setXYZ(i, vx, vy, vz);
  }
  terrainGeo.computeVertexNormals();
  geometries.push(terrainGeo);

  const terrainMat = new THREE.MeshStandardMaterial({
    color: palette.groundColor,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });
  extraMaterials.push(terrainMat);

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Stylized Low-Poly Trees & Cliffs via InstancedMesh (clean outdoor perimeter)
  const rand = seededRand(track.definition.name.length * 997 + track.segments.length * 37);

  // Trees (trunk + layered foliage cones)
  const treeCount = isSoftwareGl ? 65 : 130;
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.45, 2.8, 6);
  trunkGeo.translate(0, 1.4, 0); // bottom-center pivot!
  const canopyGeo = new THREE.ConeGeometry(2.4, 6.2, 6);
  canopyGeo.translate(0, 5.2, 0); // sits cleanly atop trunk!
  geometries.push(trunkGeo, canopyGeo);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4b3621,
    roughness: 0.9,
    flatShading: true,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    flatShading: true,
  });
  extraMaterials.push(trunkMat, canopyMat);

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
  trunkInst.castShadow = true;
  canopyInst.castShadow = true;
  canopyInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const c1 = new THREE.Color(palette.foliagePrimary);
  const c2 = new THREE.Color(palette.foliageSecondary);
  const tmpColor = new THREE.Color();

  let placedTrees = 0;
  let attempts = 0;
  while (placedTrees < treeCount && attempts < treeCount * 12) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const dist = 36 + rand() * 240;
    const px = track.centerX + Math.cos(angle) * dist;
    const pz = track.centerZ + Math.sin(angle) * dist;

    // Ensure clear of all track segments
    let safe = true;
    for (let s = 0; s < track.segments.length; s++) {
      const seg = track.segments[s];
      const mx = (seg.startX + seg.endX) * 0.5;
      const mz = (seg.startZ + seg.endZ) * 0.5;
      if (Math.hypot(px - mx, pz - mz) < TILE_SIZE * 0.95) {
        safe = false;
        break;
      }
    }
    if (!safe) continue;

    const scale = 0.85 + rand() * 0.35; // ±15% natural variation
    dummy.position.set(px, -1.6, pz);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(scale, scale * (0.9 + rand() * 0.25), scale);
    dummy.updateMatrix();

    trunkInst.setMatrixAt(placedTrees, dummy.matrix);
    canopyInst.setMatrixAt(placedTrees, dummy.matrix);
    tmpColor.copy(c1).lerp(c2, rand());
    canopyInst.setColorAt(placedTrees, tmpColor);
    placedTrees++;
  }
  trunkInst.count = placedTrees;
  canopyInst.count = placedTrees;
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  group.add(trunkInst, canopyInst);

  // Faceted Low-Poly Rock Monoliths & Perimeter Cliffs via InstancedMesh
  const rockCount = isSoftwareGl ? 36 : 70;
  const rockGeo = new THREE.DodecahedronGeometry(4.5, 0);
  rockGeo.translate(0, 2.2, 0); // bottom-center grounded!
  geometries.push(rockGeo);

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.05,
    flatShading: true,
  });
  extraMaterials.push(rockMat);

  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  const baseRock = new THREE.Color(palette.cliffColor);
  const accentRock = new THREE.Color(palette.groundAccent);

  let placedRocks = 0;
  attempts = 0;
  while (placedRocks < rockCount && attempts < rockCount * 10) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const dist = 55 + rand() * 260;
    const px = track.centerX + Math.cos(angle) * dist;
    const pz = track.centerZ + Math.sin(angle) * dist;

    let safe = true;
    for (let s = 0; s < track.segments.length; s++) {
      const seg = track.segments[s];
      const mx = (seg.startX + seg.endX) * 0.5;
      const mz = (seg.startZ + seg.endZ) * 0.5;
      if (Math.hypot(px - mx, pz - mz) < TILE_SIZE * 1.1) {
        safe = false;
        break;
      }
    }
    if (!safe) continue;

    const sx = 0.85 + rand() * 2.2;
    const sy = 0.75 + rand() * 2.6;
    const sz = 0.85 + rand() * 2.2;
    dummy.position.set(px, -1.8, pz);
    dummy.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI * 2, (rand() - 0.5) * 0.25);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();

    rockInst.setMatrixAt(placedRocks, dummy.matrix);
    tmpColor.copy(baseRock).lerp(accentRock, rand() * 0.45);
    rockInst.setColorAt(placedRocks, tmpColor);
    placedRocks++;
  }
  rockInst.count = placedRocks;
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);

  // Helper: subtle direction chevron beacons along start straight
  const fwd0 = forwardVec(0);
  const right0 = rightVec(0);
  void fwd0;
  void right0;

  return {
    group,
    checkpointMaterials,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      extraMaterials.forEach((m) => m.dispose());
    },
  };
}
