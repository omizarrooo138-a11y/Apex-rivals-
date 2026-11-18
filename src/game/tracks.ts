import type {
  BuiltTrack,
  BuiltTrackSegment,
  MedalTier,
  TrackDefinition,
  TrackPieceType,
} from './types';

export const TILE_SIZE = 28;
export const ROAD_HALF_WIDTH = 6.5;
export const RAMP_HEIGHT = 5.5;

export const BUILTIN_TRACKS: TrackDefinition[] = [
  {
    id: 'canyon-switchback',
    name: 'Canyon Switchback',
    biome: 'canyon',
    pieces: [
      'start',
      'boost',
      'ramp_up',
      'straight',
      'right',
      'checkpoint',
      'right',
      'ramp_down',
      'left',
      'boost',
      'right',
      'checkpoint',
      'straight',
      'right',
      'straight',
      'jump',
      'checkpoint',
      'straight',
      'right',
      'straight',
    ],
    medals: {
      author: 18500,
      gold: 21500,
      silver: 25500,
      bronze: 32000,
    },
  },
  {
    id: 'skyline-overpass',
    name: 'Skyline Overpass',
    biome: 'skyline',
    pieces: [
      'start',
      'boost',
      'straight',
      'left',
      'checkpoint',
      'left',
      'ramp_up',
      'left',
      'boost',
      'straight',
      'checkpoint',
      'straight',
      'right',
      'ramp_down',
      'right',
      'jump',
      'right',
      'straight',
    ],
    medals: {
      author: 16800,
      gold: 19500,
      silver: 23500,
      bronze: 29500,
    },
  },
  {
    id: 'alpine-hairpins',
    name: 'Alpine Hairpins',
    biome: 'alpine',
    pieces: [
      'start',
      'ramp_up',
      'ramp_up',
      'left',
      'right',
      'checkpoint',
      'right',
      'boost',
      'right',
      'left',
      'checkpoint',
      'right',
      'ramp_down',
      'boost',
      'ramp_down',
      'straight',
      'right',
      'checkpoint',
      'jump',
      'right',
    ],
    medals: {
      author: 19800,
      gold: 23000,
      silver: 27500,
      bronze: 34000,
    },
  },
];

export function forwardVec(heading: number): {x: number; z: number} {
  return {
    x: -Math.sin(heading),
    z: -Math.cos(heading),
  };
}

export function rightVec(heading: number): {x: number; z: number} {
  return {
    x: Math.cos(heading),
    z: -Math.sin(heading),
  };
}

export function buildTrack(definition: TrackDefinition): BuiltTrack {
  const segments: BuiltTrackSegment[] = [];
  let x = 0;
  let y = 0;
  let z = 0;
  let heading = 0;
  let cpIdx = 0;

  let minX = 0;
  let maxX = 0;
  let minZ = 0;
  let maxZ = 0;

  const hasExplicitFinish = definition.pieces.includes('finish');

  for (let i = 0; i < definition.pieces.length; i++) {
    const type = definition.pieces[i];
    const startX = x;
    const startY = y;
    const startZ = z;
    const startHeading = heading;

    const fwd = forwardVec(startHeading);
    const right = rightVec(startHeading);

    let endX = startX;
    let endY = startY;
    let endZ = startZ;
    let endHeading = startHeading;
    let length = TILE_SIZE;

    if (type === 'left') {
      const cx = startX - right.x * TILE_SIZE;
      const cz = startZ - right.z * TILE_SIZE;
      endHeading = startHeading + Math.PI / 2;
      const rEnd = rightVec(endHeading);
      endX = cx + rEnd.x * TILE_SIZE;
      endZ = cz + rEnd.z * TILE_SIZE;
      length = (Math.PI / 2) * TILE_SIZE;
    } else if (type === 'right') {
      const cx = startX + right.x * TILE_SIZE;
      const cz = startZ + right.z * TILE_SIZE;
      endHeading = startHeading - Math.PI / 2;
      const rEnd = rightVec(endHeading);
      endX = cx - rEnd.x * TILE_SIZE;
      endZ = cz - rEnd.z * TILE_SIZE;
      length = (Math.PI / 2) * TILE_SIZE;
    } else if (type === 'ramp_up') {
      endX = startX + fwd.x * TILE_SIZE;
      endZ = startZ + fwd.z * TILE_SIZE;
      endY = startY + RAMP_HEIGHT;
    } else if (type === 'ramp_down') {
      endX = startX + fwd.x * TILE_SIZE;
      endZ = startZ + fwd.z * TILE_SIZE;
      endY = startY - RAMP_HEIGHT;
    } else {
      endX = startX + fwd.x * TILE_SIZE;
      endZ = startZ + fwd.z * TILE_SIZE;
    }

    let checkpointIndex = -1;
    if (type === 'checkpoint') {
      checkpointIndex = cpIdx;
      cpIdx++;
    }

    segments.push({
      index: i,
      type,
      startX,
      startY,
      startZ,
      startHeading,
      endX,
      endY,
      endZ,
      endHeading,
      length,
      checkpointIndex,
      isFinish: type === 'finish',
    });

    minX = Math.min(minX, startX, endX);
    maxX = Math.max(maxX, startX, endX);
    minZ = Math.min(minZ, startZ, endZ);
    maxZ = Math.max(maxZ, startZ, endZ);

    x = endX;
    y = endY;
    z = endZ;
    heading = endHeading;
  }

  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const dx = maxX - minX;
  const dz = maxZ - minZ;
  const radius = Math.max(40, Math.hypot(dx, dz) * 0.55);

  return {
    definition,
    segments,
    checkpointCount: cpIdx,
    hasExplicitFinish,
    centerX,
    centerZ,
    radius,
  };
}

export interface SegmentSample {
  x: number;
  y: number;
  z: number;
  heading: number;
  slope: number; // dy / ds
  bank: number;  // roll angle in radians
  hasSurface: boolean;
}

export function sampleSegment(seg: BuiltTrackSegment, u: number, lateral: number): SegmentSample {
  const clampedU = Math.max(0, Math.min(1, u));

  if (seg.type === 'left') {
    const theta = clampedU * (Math.PI / 2);
    const h = seg.startHeading + theta;
    const r0 = rightVec(seg.startHeading);
    const r = rightVec(h);
    const cx = seg.startX - r0.x * TILE_SIZE;
    const cz = seg.startZ - r0.z * TILE_SIZE;
    const radius = TILE_SIZE + lateral;
    // Gentle inward banking in the middle of the turn
    const bank = 0.085 * Math.sin(clampedU * Math.PI);
    const bankLift = -lateral * Math.sin(bank);
    return {
      x: cx + r.x * radius,
      y: seg.startY + bankLift,
      z: cz + r.z * radius,
      heading: h,
      slope: 0,
      bank,
      hasSurface: true,
    };
  }

  if (seg.type === 'right') {
    const theta = clampedU * (Math.PI / 2);
    const h = seg.startHeading - theta;
    const r0 = rightVec(seg.startHeading);
    const r = rightVec(h);
    const cx = seg.startX + r0.x * TILE_SIZE;
    const cz = seg.startZ + r0.z * TILE_SIZE;
    const radius = TILE_SIZE - lateral;
    const bank = -0.085 * Math.sin(clampedU * Math.PI);
    const bankLift = -lateral * Math.sin(bank);
    return {
      x: cx - r.x * radius,
      y: seg.startY + bankLift,
      z: cz - r.z * radius,
      heading: h,
      slope: 0,
      bank,
      hasSurface: true,
    };
  }

  const fwd = forwardVec(seg.startHeading);
  const right = rightVec(seg.startHeading);
  const baseX = seg.startX + fwd.x * (clampedU * TILE_SIZE) + right.x * lateral;
  const baseZ = seg.startZ + fwd.z * (clampedU * TILE_SIZE) + right.z * lateral;

  if (seg.type === 'ramp_up') {
    const s = 3 * clampedU * clampedU - 2 * clampedU * clampedU * clampedU;
    const dsdu = 6 * clampedU * (1 - clampedU);
    return {
      x: baseX,
      y: seg.startY + RAMP_HEIGHT * s,
      z: baseZ,
      heading: seg.startHeading,
      slope: (RAMP_HEIGHT * dsdu) / TILE_SIZE,
      bank: 0,
      hasSurface: true,
    };
  }

  if (seg.type === 'ramp_down') {
    const s = 3 * clampedU * clampedU - 2 * clampedU * clampedU * clampedU;
    const dsdu = 6 * clampedU * (1 - clampedU);
    return {
      x: baseX,
      y: seg.startY - RAMP_HEIGHT * s,
      z: baseZ,
      heading: seg.startHeading,
      slope: (-RAMP_HEIGHT * dsdu) / TILE_SIZE,
      bank: 0,
      hasSurface: true,
    };
  }

  if (seg.type === 'jump') {
    // Launch ramp 0..0.42 rising +3.0m, gap 0.42..0.70, landing deck 0.70..1.0
    if (clampedU <= 0.42) {
      const lu = clampedU / 0.42;
      const h = 3.0 * (lu * lu);
      const dhdu = (6.0 * lu) / 0.42;
      return {
        x: baseX,
        y: seg.startY + h,
        z: baseZ,
        heading: seg.startHeading,
        slope: dhdu / TILE_SIZE,
        bank: 0,
        hasSurface: true,
      };
    }
    if (clampedU < 0.7) {
      return {
        x: baseX,
        y: seg.startY - 20,
        z: baseZ,
        heading: seg.startHeading,
        slope: 0,
        bank: 0,
        hasSurface: false,
      };
    }
    const lu = (clampedU - 0.7) / 0.3;
    const h = 1.6 * (1 - lu) * (1 - lu);
    const dhdu = (-3.2 * (1 - lu)) / 0.3;
    return {
      x: baseX,
      y: seg.startY + h,
      z: baseZ,
      heading: seg.startHeading,
      slope: dhdu / TILE_SIZE,
      bank: 0,
      hasSurface: true,
    };
  }

  return {
    x: baseX,
    y: seg.startY,
    z: baseZ,
    heading: seg.startHeading,
    slope: 0,
    bank: 0,
    hasSurface: true,
  };
}

export interface SurfaceHit {
  segment: BuiltTrackSegment;
  u: number;
  lateral: number;
  sample: SegmentSample;
  distSq: number;
}

export function findSurfaceAt(
  track: BuiltTrack,
  px: number,
  py: number,
  pz: number,
): SurfaceHit | null {
  let best: SurfaceHit | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < track.segments.length; i++) {
    const seg = track.segments[i];
    let u = 0;
    let lateral = 0;

    if (seg.type === 'left') {
      const r0 = rightVec(seg.startHeading);
      const cx = seg.startX - r0.x * TILE_SIZE;
      const cz = seg.startZ - r0.z * TILE_SIZE;
      const vx = px - cx;
      const vz = pz - cz;
      const dist = Math.hypot(vx, vz);
      // r0 points from center toward start point
      // local angle from r0 toward fwd0 (turning left)
      const fwd0 = forwardVec(seg.startHeading);
      const dotR = vx * r0.x + vz * r0.z;
      const dotF = vx * fwd0.x + vz * fwd0.z;
      const angle = Math.atan2(dotF, dotR);
      if (angle < -0.15 || angle > Math.PI / 2 + 0.15) continue;
      u = Math.max(0, Math.min(1, angle / (Math.PI / 2)));
      lateral = dist - TILE_SIZE;
    } else if (seg.type === 'right') {
      const r0 = rightVec(seg.startHeading);
      const cx = seg.startX + r0.x * TILE_SIZE;
      const cz = seg.startZ + r0.z * TILE_SIZE;
      const vx = px - cx;
      const vz = pz - cz;
      const dist = Math.hypot(vx, vz);
      const fwd0 = forwardVec(seg.startHeading);
      // -r0 points from center toward start point
      const dotMinusR = vx * -r0.x + vz * -r0.z;
      const dotF = vx * fwd0.x + vz * fwd0.z;
      const angle = Math.atan2(dotF, dotMinusR);
      if (angle < -0.15 || angle > Math.PI / 2 + 0.15) continue;
      u = Math.max(0, Math.min(1, angle / (Math.PI / 2)));
      lateral = TILE_SIZE - dist;
    } else {
      const fwd = forwardVec(seg.startHeading);
      const right = rightVec(seg.startHeading);
      const dx = px - seg.startX;
      const dz = pz - seg.startZ;
      const along = dx * fwd.x + dz * fwd.z;
      const lat = dx * right.x + dz * right.z;
      if (along < -2.0 || along > TILE_SIZE + 2.0) continue;
      u = Math.max(0, Math.min(1, along / TILE_SIZE));
      lateral = lat;
    }

    if (Math.abs(lateral) > ROAD_HALF_WIDTH + 2.2) continue;

    const sample = sampleSegment(seg, u, lateral);
    if (!sample.hasSurface) continue;

    // Disfavor surfaces far above the car (e.g., overpass above start straight)
    const dy = py - sample.y;
    if (dy < -2.4 || dy > 16) continue;

    const lateralPenalty = Math.max(0, Math.abs(lateral) - ROAD_HALF_WIDTH);
    const score = Math.abs(dy) * 2.5 + lateralPenalty * 4.0;
    if (score < bestScore) {
      bestScore = score;
      best = {
        segment: seg,
        u,
        lateral,
        sample,
        distSq: dy * dy + lateralPenalty * lateralPenalty,
      };
    }
  }

  return best;
}

export function evaluateMedal(timeMs: number, medals: TrackDefinition['medals']): MedalTier {
  if (timeMs <= medals.author) return 'author';
  if (timeMs <= medals.gold) return 'gold';
  if (timeMs <= medals.silver) return 'silver';
  if (timeMs <= medals.bronze) return 'bronze';
  return 'none';
}

export function formatTimeMs(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const millis = clamped % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
