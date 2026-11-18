import {
  ROAD_HALF_WIDTH,
  findSurfaceAt,
  forwardVec,
  rightVec,
  sampleSegment,
} from './tracks';
import type {BuiltTrack, GhostFrame, InputState} from './types';

export interface CarPhysicsState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  pitch: number;
  roll: number;
  steerAngle: number;
  wheelSpin: number;
  isAirborne: boolean;
  isDrifting: boolean;
  boostTimer: number;
  suspensionOffset: number;
  suspensionVel: number;

  // Race progress
  elapsedSec: number;
  countdownTimer: number; // > 0 before GO
  nextCheckpoint: number;
  respawnX: number;
  respawnY: number;
  respawnZ: number;
  respawnHeading: number;
  finished: boolean;
  leftStartZone: boolean;
}

export interface PhysicsEvents {
  countdownTick: boolean;
  countdownGo: boolean;
  boostTriggered: boolean;
  checkpointCleared: number | null;
  lapFinished: boolean;
  impactStrength: number;
  respawned: boolean;
}

export function createInitialCarState(track: BuiltTrack): CarPhysicsState {
  const startSeg = track.segments[0];
  const spawn = startSeg ? sampleSegment(startSeg, 0.32, 0) : {x: 0, y: 0, z: 0, heading: 0};

  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: spawn.heading,
    pitch: 0,
    roll: 0,
    steerAngle: 0,
    wheelSpin: 0,
    isAirborne: false,
    isDrifting: false,
    boostTimer: 0,
    suspensionOffset: 0,
    suspensionVel: 0,
    elapsedSec: 0,
    countdownTimer: 1.8, // snappy 3-2-1-GO (0.6s per beat)
    nextCheckpoint: 0,
    respawnX: spawn.x,
    respawnY: spawn.y,
    respawnZ: spawn.z,
    respawnHeading: spawn.heading,
    finished: false,
    leftStartZone: false,
  };
}

export function respawnAtCheckpoint(state: CarPhysicsState): void {
  state.x = state.respawnX;
  state.y = state.respawnY + 0.15;
  state.z = state.respawnZ;
  state.vx = 0;
  state.vy = 0;
  state.vz = 0;
  state.heading = state.respawnHeading;
  state.pitch = 0;
  state.roll = 0;
  state.isAirborne = false;
  state.isDrifting = false;
  state.boostTimer = 0;
}

export function stepPhysics(
  state: CarPhysicsState,
  track: BuiltTrack,
  input: InputState,
  dt: number,
  recordedGhost: GhostFrame[],
): PhysicsEvents {
  const events: PhysicsEvents = {
    countdownTick: false,
    countdownGo: false,
    boostTriggered: false,
    checkpointCleared: null,
    lapFinished: false,
    impactStrength: 0,
    respawned: false,
  };

  if (state.finished) {
    // Gentle coast after crossing finish line
    state.vx *= Math.exp(-2.2 * dt);
    state.vz *= Math.exp(-2.2 * dt);
    state.x += state.vx * dt;
    state.z += state.vz * dt;
    return events;
  }

  // Countdown handling
  if (state.countdownTimer > 0) {
    const prevBeat = Math.ceil(state.countdownTimer / 0.6);
    state.countdownTimer = Math.max(0, state.countdownTimer - dt);
    const nextBeat = Math.ceil(state.countdownTimer / 0.6);
    if (state.countdownTimer === 0) {
      events.countdownGo = true;
    } else if (nextBeat < prevBeat) {
      events.countdownTick = true;
    }
    // Allow steering wheel wiggle on grid
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    state.steerAngle += (steerInput * 0.42 - state.steerAngle) * Math.min(1, dt * 12);
    return events;
  }

  state.elapsedSec += dt;

  // Sub-step physics at max 1/120s for rock-solid deterministic behavior
  const subSteps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const subDt = dt / subSteps;

  for (let s = 0; s < subSteps; s++) {
    const stepEv = stepSub(state, track, input, subDt);
    if (stepEv.boostTriggered) events.boostTriggered = true;
    if (stepEv.checkpointCleared !== null) events.checkpointCleared = stepEv.checkpointCleared;
    if (stepEv.lapFinished) events.lapFinished = true;
    if (stepEv.impactStrength > events.impactStrength) events.impactStrength = stepEv.impactStrength;
    if (stepEv.respawned) events.respawned = true;
    if (state.finished) break;
  }

  // Record ghost frame (~20 Hz)
  if (
    recordedGhost.length === 0 ||
    state.elapsedSec - recordedGhost[recordedGhost.length - 1].t >= 0.05
  ) {
    recordedGhost.push({
      t: state.elapsedSec,
      x: state.x,
      y: state.y,
      z: state.z,
      heading: state.heading,
      pitch: state.pitch,
      roll: state.roll,
    });
  }

  return events;
}

function stepSub(
  state: CarPhysicsState,
  track: BuiltTrack,
  input: InputState,
  dt: number,
): PhysicsEvents {
  const ev: PhysicsEvents = {
    countdownTick: false,
    countdownGo: false,
    boostTriggered: false,
    checkpointCleared: null,
    lapFinished: false,
    impactStrength: 0,
    respawned: false,
  };

  if (state.boostTimer > 0) {
    state.boostTimer = Math.max(0, state.boostTimer - dt);
  }

  const fwd = forwardVec(state.heading);
  const right = rightVec(state.heading);

  const vFwd = state.vx * fwd.x + state.vz * fwd.z;
  const vLat = state.vx * right.x + state.vz * right.z;
  const speed = Math.hypot(state.vx, state.vz);

  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const targetSteer = steerInput * 0.44;
  state.steerAngle += (targetSteer - state.steerAngle) * Math.min(1, dt * 14);

  const isBoosting = state.boostTimer > 0;
  const maxSpeed = isBoosting ? 64.0 : 47.0; // ~230 km/h boost, ~169 km/h normal
  const accelPower = isBoosting ? 58.0 : 34.0;

  let nextVFwd = vFwd;
  let nextVLat = vLat;

  if (!state.isAirborne) {
    // Acceleration / Braking / Reverse
    if (input.throttle) {
      const speedFactor = Math.max(0.15, 1 - Math.max(0, vFwd) / maxSpeed);
      nextVFwd += accelPower * speedFactor * dt;
    } else if (input.brake) {
      if (vFwd > 1.0) {
        nextVFwd -= 46.0 * dt;
      } else {
        nextVFwd -= 20.0 * dt;
        if (nextVFwd < -18.0) nextVFwd = -18.0;
      }
    } else {
      // Natural rolling drag
      nextVFwd *= Math.exp(-0.75 * dt);
    }

    if (isBoosting && nextVFwd < maxSpeed * 0.92) {
      nextVFwd += 42.0 * dt;
    }

    // Aero drag above normal top speed
    if (!isBoosting && nextVFwd > 47.0) {
      nextVFwd -= (nextVFwd - 47.0) * 1.8 * dt;
    }

    // Steering & Drift
    const drifting = input.drift && Math.abs(vFwd) > 10;
    state.isDrifting = drifting && (Math.abs(steerInput) > 0.1 || Math.abs(vLat) > 2.8);

    const speedTurnScale = Math.min(1, speed / 7.5);
    const reverseSign = vFwd >= -0.5 ? 1 : -1;
    const baseTurnRate = drifting ? 2.65 : 2.15;
    const highSpeedDamp = 1 - Math.min(0.32, speed / 150);
    state.heading += steerInput * reverseSign * baseTurnRate * speedTurnScale * highSpeedDamp * dt;

    // Lateral tire grip
    const gripDecay = drifting ? 3.1 : 10.8;
    nextVLat *= Math.exp(-gripDecay * dt);

    // Subtle forward scrub while sliding hard
    if (drifting && Math.abs(nextVLat) > 4) {
      nextVFwd *= Math.exp(-0.35 * dt);
    }
  } else {
    // Subtle air control
    state.heading += steerInput * 0.45 * dt;
    nextVFwd *= Math.exp(-0.12 * dt);
    nextVLat *= Math.exp(-0.3 * dt);
  }

  // Recompute world velocity from updated heading
  const newFwd = forwardVec(state.heading);
  const newRight = rightVec(state.heading);
  state.vx = newFwd.x * nextVFwd + newRight.x * nextVLat;
  state.vz = newFwd.z * nextVFwd + newRight.z * nextVLat;

  // Integrate position
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  state.wheelSpin += (nextVFwd / 0.38) * dt;

  // Surface detection & vertical physics
  const hit = findSurfaceAt(track, state.x, state.y, state.z);

  if (hit) {
    const targetY = hit.sample.y;
    const heightAbove = state.y - targetY;

    // Compute road slope velocity along car's movement direction
    const segFwd = forwardVec(hit.sample.heading);
    const velAlongSeg = state.vx * segFwd.x + state.vz * segFwd.z;
    const expectedSlopeVy = velAlongSeg * hit.sample.slope;

    if (state.isAirborne) {
      state.vy -= 26.0 * dt;
      state.y += state.vy * dt;
      if (state.y <= targetY + 0.05 && state.vy <= expectedSlopeVy + 2.0) {
        // Touchdown!
        const impact = Math.abs(state.vy - expectedSlopeVy);
        if (impact > 4.5) {
          ev.impactStrength = Math.max(ev.impactStrength, Math.min(1, impact / 22));
          state.suspensionVel = -Math.min(4.5, impact * 0.25);
        }
        state.y = targetY;
        state.vy = expectedSlopeVy;
        state.isAirborne = false;
      }
    } else {
      if (heightAbove > 0.45) {
        // Launched over a crest!
        state.isAirborne = true;
      } else {
        state.y = targetY;
        state.vy = expectedSlopeVy;
      }
    }

    // Guardrail containment inside road deck
    const wallLimit = ROAD_HALF_WIDTH - 0.85;
    if (!state.isAirborne && Math.abs(hit.lateral) > wallLimit) {
      const sign = hit.lateral > 0 ? 1 : -1;
      const overshoot = Math.abs(hit.lateral) - wallLimit;
      const segRight = rightVec(hit.sample.heading);

      state.x -= segRight.x * sign * overshoot;
      state.z -= segRight.z * sign * overshoot;

      // Reflect outward velocity component
      const vOut = state.vx * segRight.x + state.vz * segRight.z;
      if (vOut * sign > 0) {
        const hitMag = Math.abs(vOut);
        if (hitMag > 4.0) {
          ev.impactStrength = Math.max(ev.impactStrength, Math.min(1, hitMag / 24));
        }
        state.vx -= segRight.x * vOut * 1.35;
        state.vz -= segRight.z * vOut * 1.35;
        state.vx *= 0.92;
        state.vz *= 0.92;
      }
    }

    // Visual pitch & roll alignment
    const targetPitch = state.isAirborne
      ? Math.max(-0.35, Math.min(0.35, state.vy * 0.02))
      : Math.atan(hit.sample.slope) * (velAlongSeg >= 0 ? 1 : -1);
    const targetRoll = state.isAirborne
      ? 0
      : hit.sample.bank + steerInput * Math.min(0.08, speed / 350);

    state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 12);
    state.roll += (targetRoll - state.roll) * Math.min(1, dt * 10);

    // Track triggers: Boost pads, Checkpoints, Start/Finish
    const seg = hit.segment;
    if (seg.type === 'boost' && hit.u >= 0.1 && hit.u <= 0.9 && Math.abs(hit.lateral) < 3.2) {
      if (state.boostTimer < 0.75) {
        ev.boostTriggered = true;
      }
      state.boostTimer = 1.05;
    }

    if (seg.index >= 2) {
      state.leftStartZone = true;
    }

    if (seg.checkpointIndex === state.nextCheckpoint && hit.u >= 0.25 && hit.u <= 0.85) {
      ev.checkpointCleared = state.nextCheckpoint;
      state.nextCheckpoint++;
      const cpSample = sampleSegment(seg, 0.5, 0);
      state.respawnX = cpSample.x;
      state.respawnY = cpSample.y;
      state.respawnZ = cpSample.z;
      state.respawnHeading = cpSample.heading;
    }

    const allCheckpointsDone = state.nextCheckpoint >= track.checkpointCount;
    if (allCheckpointsDone) {
      if (track.hasExplicitFinish && seg.isFinish && hit.u >= 0.35) {
        state.finished = true;
        ev.lapFinished = true;
      } else if (!track.hasExplicitFinish && seg.type === 'start' && state.leftStartZone && hit.u >= 0.35 && hit.u <= 0.75) {
        state.finished = true;
        ev.lapFinished = true;
      }
    }
  } else {
    // Off-track / Jump air gap
    state.isAirborne = true;
    state.isDrifting = false;
    state.vy -= 26.0 * dt;
    state.y += state.vy * dt;

    const targetPitch = Math.max(-0.4, Math.min(0.4, state.vy * 0.022));
    state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 8);
    state.roll += (0 - state.roll) * Math.min(1, dt * 6);

    // Fall out of bounds -> instant clean checkpoint respawn
    if (state.y < -12) {
      respawnAtCheckpoint(state);
      ev.respawned = true;
    }
  }

  // Spring suspension bounce
  const springK = 140;
  const springDamp = 14;
  const force = -springK * state.suspensionOffset - springDamp * state.suspensionVel;
  state.suspensionVel += force * dt;
  state.suspensionOffset += state.suspensionVel * dt;

  return ev;
}

export function sampleGhostAt(ghost: GhostFrame[], t: number): GhostFrame | null {
  if (ghost.length === 0) return null;
  if (t <= ghost[0].t) return ghost[0];
  if (t >= ghost[ghost.length - 1].t) return null;

  // Binary search for frame interval
  let lo = 0;
  let hi = ghost.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (ghost[mid].t <= t) lo = mid;
    else hi = mid;
  }

  const a = ghost[lo];
  const b = ghost[hi];
  const span = Math.max(0.0001, b.t - a.t);
  const alpha = (t - a.t) / span;

  // Shortest-angle interpolation for heading
  let dh = b.heading - a.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;

  return {
    t,
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    z: a.z + (b.z - a.z) * alpha,
    heading: a.heading + dh * alpha,
    pitch: a.pitch + (b.pitch - a.pitch) * alpha,
    roll: a.roll + (b.roll - a.roll) * alpha,
  };
}
