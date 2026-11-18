export type TrackPieceType =
  | 'start'
  | 'straight'
  | 'left'
  | 'right'
  | 'ramp_up'
  | 'ramp_down'
  | 'boost'
  | 'checkpoint'
  | 'jump'
  | 'finish';

export type TrackBiome = 'canyon' | 'skyline' | 'alpine';

export interface MedalTimes {
  author: number; // ms
  gold: number;   // ms
  silver: number; // ms
  bronze: number; // ms
}

export type MedalTier = 'author' | 'gold' | 'silver' | 'bronze' | 'none';

export interface TrackDefinition {
  id: string;
  name: string;
  biome: TrackBiome;
  isCustom?: boolean;
  pieces: TrackPieceType[];
  medals: MedalTimes;
}

export interface BuiltTrackSegment {
  index: number;
  type: TrackPieceType;
  startX: number;
  startY: number;
  startZ: number;
  startHeading: number; // radians, 0 = -Z, +PI/2 = -X (left)
  endX: number;
  endY: number;
  endZ: number;
  endHeading: number;
  length: number;
  checkpointIndex: number; // -1 if not a checkpoint
  isFinish: boolean;
}

export interface BuiltTrack {
  definition: TrackDefinition;
  segments: BuiltTrackSegment[];
  checkpointCount: number;
  hasExplicitFinish: boolean;
  centerX: number;
  centerZ: number;
  radius: number;
}

export interface GhostFrame {
  t: number; // seconds
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
}

export interface TrackRecord {
  trackId: string;
  bestTimeMs: number | null;
  ghost: GhostFrame[];
  updatedAt: number;
}

export type GameMode = 'title' | 'playing' | 'paused' | 'finished' | 'editor';

export interface HudSnapshot {
  speedKmh: number;
  elapsedMs: number;
  checkpointIndex: number; // 0..checkpointCount
  checkpointCount: number;
  isBoosting: boolean;
  isDrifting: boolean;
  isAirborne: boolean;
  pbDeltaMs: number | null;
  gear: number;
  rpmRatio: number;
  countdownText: string | null;
}

export interface RunResult {
  trackId: string;
  timeMs: number;
  previousBestMs: number | null;
  isNewBest: boolean;
  medal: MedalTier;
}

export interface InputState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
}
