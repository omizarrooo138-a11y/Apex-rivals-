import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {SoundEngine} from './audio';
import {createCarRig, createGhostCarMesh, type CarRig} from './carMesh';
import {BIOME_PALETTES, createTrackMaterials, type MaterialLibrary} from './materials';
import {
  createInitialCarState,
  respawnAtCheckpoint,
  sampleGhostAt,
  stepPhysics,
  type CarPhysicsState,
} from './physics';
import {getTrackRecord, saveTrackRecord} from './storage';
import {createTrackVisuals, type BuiltTrackVisuals} from './trackMesh';
import {buildTrack, evaluateMedal, forwardVec} from './tracks';
import type {
  BuiltTrack,
  GameMode,
  GhostFrame,
  HudSnapshot,
  InputState,
  RunResult,
  TrackDefinition,
} from './types';

// Pre-allocated math helpers (zero GC in render loop)
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onRunFinished: (result: RunResult) => void;
  onContextLost?: () => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  private mats: MaterialLibrary;
  private carRig: CarRig;
  private ghostRig: {mesh: THREE.Group; dispose: () => void};

  private builtTrack: BuiltTrack;
  private trackVisuals: BuiltTrackVisuals | null = null;

  private carState: CarPhysicsState;
  private currentRecordBestMs: number | null = null;
  private activeGhost: GhostFrame[] = [];
  private recordedGhost: GhostFrame[] = [];

  private mode: GameMode = 'title';
  private input: InputState = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    drift: false,
  };

  private sound = new SoundEngine();
  private lastTimeMs = 0;
  private titleOrbitAngle = 0.6;
  private cameraShake = 0;
  private hitstopTimer = 0;
  private hudEmitAccum = 0;
  private frameId = 0;
  private disposed = false;

  // Pooled particle system
  private readonly maxParticles = 160;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.PointsMaterial;
  private particlePoints: THREE.Points;
  private particlePosAttr: THREE.BufferAttribute;
  private particleColAttr: THREE.BufferAttribute;

  private resizeHandler: () => void;
  private contextLostHandler: (e: Event) => void;

  constructor(
    container: HTMLElement,
    initialTrack: TrackDefinition,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    // Mandatory RoomEnvironment studio reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.25, 1400);

    // 3-Point Studio / Outdoor Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x8fb4e8, 0x6b412e, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffdfb3, 2.0);
    this.sunLight.position.set(85, 140, 65);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    const d = 110;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 420;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    this.rimLight.position.set(-90, 60, -80);
    this.scene.add(this.rimLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.mats = createTrackMaterials(maxAniso);

    this.carRig = createCarRig(this.isSoftwareGl);
    this.scene.add(this.carRig.root);

    this.ghostRig = createGhostCarMesh();
    this.scene.add(this.ghostRig.mesh);

    // Pooled particles
    const posArr = new Float32Array(this.maxParticles * 3);
    const colArr = new Float32Array(this.maxParticles * 3);
    for (let i = 0; i < this.maxParticles; i++) {
      posArr[i * 3 + 1] = -999;
      this.particles.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        r: 1,
        g: 1,
        b: 1,
      });
    }
    this.particleGeo = new THREE.BufferGeometry();
    this.particlePosAttr = new THREE.BufferAttribute(posArr, 3);
    this.particleColAttr = new THREE.BufferAttribute(colArr, 3);
    this.particleGeo.setAttribute('position', this.particlePosAttr);
    this.particleGeo.setAttribute('color', this.particleColAttr);
    this.particleMat = new THREE.PointsMaterial({
      size: 0.65,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.particlePoints = new THREE.Points(this.particleGeo, this.particleMat);
    this.particlePoints.frustumCulled = false;
    this.scene.add(this.particlePoints);

    // Build initial track
    this.builtTrack = buildTrack(initialTrack);
    this.carState = createInitialCarState(this.builtTrack);
    this.applyTrack(initialTrack);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeHandler = () => {
      if (this.disposed) return;
      const w = Math.max(1, this.container.clientWidth);
      const h = Math.max(1, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this.resizeHandler);

    this.contextLostHandler = (e: Event) => {
      e.preventDefault();
      this.callbacks.onContextLost?.();
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLostHandler);

    this.lastTimeMs = performance.now();
    this.startLoop();
  }

  public getSoundEngine(): SoundEngine {
    return this.sound;
  }

  public setInput(next: Partial<InputState>): void {
    Object.assign(this.input, next);
  }

  public clearInputs(): void {
    this.input.throttle = false;
    this.input.brake = false;
    this.input.left = false;
    this.input.right = false;
    this.input.drift = false;
  }

  public setMode(mode: GameMode): void {
    this.mode = mode;
    if (mode === 'playing') {
      this.sound.ensureStarted();
    } else {
      this.sound.updateEngine(false, 0, false, false, 0);
    }
  }

  public loadTrack(definition: TrackDefinition): void {
    this.applyTrack(definition);
    this.resetRun();
  }

  private applyTrack(definition: TrackDefinition): void {
    if (this.trackVisuals) {
      this.scene.remove(this.trackVisuals.group);
      this.trackVisuals.dispose();
      this.trackVisuals = null;
    }

    this.builtTrack = buildTrack(definition);
    this.trackVisuals = createTrackVisuals(
      this.builtTrack,
      this.mats,
      this.isSoftwareGl,
    );
    this.scene.add(this.trackVisuals.group);

    // Biome atmosphere & lighting
    const pal = BIOME_PALETTES[definition.biome];
    this.scene.background = new THREE.Color(pal.skyColor);
    this.scene.fog = new THREE.FogExp2(pal.fogColor, 0.0021);
    this.hemiLight.color.setHex(pal.hemiSky);
    this.hemiLight.groundColor.setHex(pal.hemiGround);
    this.sunLight.color.setHex(pal.sunColor);

    // Position sun shadow frustum around track center
    this.sunLight.position.set(
      this.builtTrack.centerX + 85,
      140,
      this.builtTrack.centerZ + 65,
    );
    this.sunLight.target.position.set(
      this.builtTrack.centerX,
      0,
      this.builtTrack.centerZ,
    );
    this.sunLight.target.updateMatrixWorld();

    const rec = getTrackRecord(definition.id);
    this.currentRecordBestMs = rec.bestTimeMs;
    this.activeGhost = rec.ghost;

    this.resetRun();
  }

  public resetRun(): void {
    this.carState = createInitialCarState(this.builtTrack);
    this.recordedGhost = [];
    this.cameraShake = 0;
    this.hitstopTimer = 0;
    this.ghostRig.mesh.visible = false;
    this.syncCarVisuals(0);
    this.updateCheckpointGlows();
    this.snapChaseCamera();
    this.emitHud();
  }

  public respawnCheckpoint(): void {
    respawnAtCheckpoint(this.carState);
    this.cameraShake = 0.15;
    this.syncCarVisuals(0);
    this.emitHud();
  }

  private snapChaseCamera(): void {
    const fwd = forwardVec(this.carState.heading);
    this.camera.position.set(
      this.carState.x - fwd.x * 9.2,
      this.carState.y + 4.1,
      this.carState.z - fwd.z * 9.2,
    );
    this.camera.lookAt(
      this.carState.x + fwd.x * 7,
      this.carState.y + 1.4,
      this.carState.z + fwd.z * 7,
    );
  }

  private updateCheckpointGlows(): void {
    if (!this.trackVisuals) return;
    const cps = this.trackVisuals.checkpointMaterials;
    for (let i = 0; i < cps.length; i++) {
      if (i < this.carState.nextCheckpoint) {
        cps[i].color.setHex(0x22c55e);
        cps[i].emissive.setHex(0x16a34a);
        cps[i].emissiveIntensity = 0.6;
      } else if (i === this.carState.nextCheckpoint) {
        cps[i].color.setHex(0x38bdf8);
        cps[i].emissive.setHex(0x0284c7);
        cps[i].emissiveIntensity = 1.35;
      } else {
        cps[i].color.setHex(0xf97316);
        cps[i].emissive.setHex(0xea580c);
        cps[i].emissiveIntensity = 0.65;
      }
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    r: number,
    g: number,
    b: number,
    maxLife = 0.38,
  ): void {
    const slot = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.maxParticles;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.life = 0;
    slot.maxLife = maxLife;
    slot.r = r;
    slot.g = g;
    slot.b = b;
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.particlePosAttr.setXYZ(i, 0, -999, 0);
        continue;
      }
      p.vy -= 9.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const fade = 1 - p.life / p.maxLife;
      this.particlePosAttr.setXYZ(i, p.x, p.y, p.z);
      this.particleColAttr.setXYZ(i, p.r * fade, p.g * fade, p.b * fade);
    }
    this.particlePosAttr.needsUpdate = true;
    this.particleColAttr.needsUpdate = true;
  }

  private syncCarVisuals(dt: number): void {
    const s = this.carState;
    this.carRig.root.position.set(s.x, s.y, s.z);
    _euler.set(s.pitch, s.heading, s.roll, 'YXZ');
    this.carRig.root.quaternion.setFromEuler(_euler);

    // Suspension squat / bounce on bodyGroup
    this.carRig.bodyGroup.position.y = s.suspensionOffset;

    // Front wheel steering & wheel rotation
    this.carRig.frontLeftSteer.rotation.y = s.steerAngle;
    this.carRig.frontRightSteer.rotation.y = s.steerAngle;
    for (let i = 0; i < this.carRig.wheels.length; i++) {
      this.carRig.wheels[i].rotation.x = -s.wheelSpin;
    }

    // Dynamic tail-light & exhaust glow
    this.carRig.tailLightMat.emissiveIntensity = this.input.brake ? 3.2 : 1.0;
    this.carRig.exhaustGlowMat.emissiveIntensity = s.boostTimer > 0 ? 3.5 : 0.45;

    // Ground shadow follows road height closely
    this.carRig.shadowMesh.visible = !s.isAirborne;

    // Emit drift / boost particles
    if (this.mode === 'playing' && dt > 0) {
      const fwd = forwardVec(s.heading);
      if (s.boostTimer > 0) {
        this.spawnParticle(
          s.x - fwd.x * 2.0 + (Math.random() - 0.5) * 0.6,
          s.y + 0.35,
          s.z - fwd.z * 2.0 + (Math.random() - 0.5) * 0.6,
          -fwd.x * 8 + (Math.random() - 0.5) * 2,
          1.5 + Math.random() * 1.5,
          -fwd.z * 8 + (Math.random() - 0.5) * 2,
          0.22,
          0.75,
          1.0,
          0.28,
        );
      } else if (s.isDrifting && !s.isAirborne) {
        this.spawnParticle(
          s.x - fwd.x * 1.3 + (Math.random() - 0.5) * 1.4,
          s.y + 0.14,
          s.z - fwd.z * 1.3 + (Math.random() - 0.5) * 1.4,
          (Math.random() - 0.5) * 2.5,
          1.2 + Math.random() * 1.2,
          (Math.random() - 0.5) * 2.5,
          0.85,
          0.88,
          0.92,
          0.35,
        );
      }
    }

    // Update Ghost Car
    if (this.mode === 'playing' && s.countdownTimer === 0 && !s.finished && this.activeGhost.length > 0) {
      const g = sampleGhostAt(this.activeGhost, s.elapsedSec);
      if (g) {
        this.ghostRig.mesh.visible = true;
        this.ghostRig.mesh.position.set(g.x, g.y, g.z);
        _euler.set(g.pitch, g.heading, g.roll, 'YXZ');
        this.ghostRig.mesh.quaternion.setFromEuler(_euler);
      } else {
        this.ghostRig.mesh.visible = false;
      }
    } else {
      this.ghostRig.mesh.visible = false;
    }
  }

  private updateCamera(dt: number): void {
    if (this.mode === 'title') {
      // Atmospheric live-world camera orbit around the starting grid & track
      this.titleOrbitAngle += dt * 0.22;
      const dist = 16.5;
      const cx = this.carState.x + Math.sin(this.titleOrbitAngle) * dist;
      const cz = this.carState.z + Math.cos(this.titleOrbitAngle) * dist;
      const cy = this.carState.y + 6.2 + Math.sin(this.titleOrbitAngle * 0.7) * 1.2;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(this.carState.x, this.carState.y + 1.1, this.carState.z);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 54, 6, dt);
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.mode === 'editor') {
      // Crisp elevated architectural overview of the custom track
      const span = Math.max(70, this.builtTrack.radius * 1.65);
      _camTarget.set(
        this.builtTrack.centerX + span * 0.55,
        span * 0.95,
        this.builtTrack.centerZ + span * 0.75,
      );
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTarget.x, 5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTarget.y, 5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTarget.z, 5, dt);
      this.camera.lookAt(this.builtTrack.centerX, 2, this.builtTrack.centerZ);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 48, 6, dt);
      this.camera.updateProjectionMatrix();
      return;
    }

    // Playing / Paused / Finished chase cam
    const s = this.carState;
    const speed = Math.hypot(s.vx, s.vz);
    const fwd = forwardVec(s.heading);

    const chaseDist = 8.4 + Math.min(2.6, speed * 0.045);
    const chaseHeight = 3.6 + Math.min(1.1, speed * 0.015);

    _camTarget.set(
      s.x - fwd.x * chaseDist,
      s.y + chaseHeight,
      s.z - fwd.z * chaseDist,
    );

    if (this.cameraShake > 0.001) {
      _camTarget.x += (Math.random() - 0.5) * this.cameraShake;
      _camTarget.y += (Math.random() - 0.5) * this.cameraShake * 0.7;
      _camTarget.z += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake *= Math.exp(-10 * dt);
    }

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTarget.x, 11, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTarget.y, 9, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTarget.z, 11, dt);

    _lookTarget.set(
      s.x + fwd.x * 8.5,
      s.y + 1.45,
      s.z + fwd.z * 8.5,
    );
    this.camera.lookAt(_lookTarget);

    // Speed & Boost FOV widening
    const targetFov = 60 + Math.min(16, speed * 0.25) + (s.boostTimer > 0 ? 8 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private emitHud(): void {
    const s = this.carState;
    const speedMs = Math.hypot(s.vx, s.vz);
    const speedKmh = Math.round(speedMs * 3.6);

    const gear = Math.min(5, Math.max(1, Math.floor(speedKmh / 40) + 1));
    const gearMin = (gear - 1) * 40;
    const rpmRatio = Math.max(0.18, Math.min(1, (speedKmh - gearMin + 12) / 48));

    let countdownText: string | null = null;
    if (s.countdownTimer > 0) {
      countdownText = String(Math.ceil(s.countdownTimer / 0.6));
    } else if (s.elapsedSec > 0 && s.elapsedSec < 0.55) {
      countdownText = 'GO!';
    }

    let pbDeltaMs: number | null = null;
    if (this.currentRecordBestMs !== null && s.elapsedSec > 0.1) {
      // Compare elapsed time against PB proportional or direct time if near end
      pbDeltaMs = Math.round(s.elapsedSec * 1000 - this.currentRecordBestMs);
    }

    this.callbacks.onHudUpdate({
      speedKmh,
      elapsedMs: Math.round(s.elapsedSec * 1000),
      checkpointIndex: s.nextCheckpoint,
      checkpointCount: this.builtTrack.checkpointCount,
      isBoosting: s.boostTimer > 0,
      isDrifting: s.isDrifting,
      isAirborne: s.isAirborne,
      pbDeltaMs,
      gear,
      rpmRatio,
      countdownText,
    });
  }

  private handleFinish(): void {
    const timeMs = Math.round(this.carState.elapsedSec * 1000);
    const prevBest = this.currentRecordBestMs;
    const isNewBest = prevBest === null || timeMs < prevBest;
    if (isNewBest) {
      const saved = saveTrackRecord(this.builtTrack.definition.id, timeMs, this.recordedGhost);
      this.currentRecordBestMs = saved.bestTimeMs;
      this.activeGhost = saved.ghost;
    }
    const medal = evaluateMedal(timeMs, this.builtTrack.definition.medals);
    this.sound.playFinish();
    this.callbacks.onRunFinished({
      trackId: this.builtTrack.definition.id,
      timeMs,
      previousBestMs: prevBest,
      isNewBest,
      medal,
    });
  }

  private startLoop(): void {
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTimeMs) / 1000;
      this.lastTimeMs = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      if (this.mode === 'playing') {
        if (this.hitstopTimer > 0) {
          this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
        } else {
          const ev = stepPhysics(
            this.carState,
            this.builtTrack,
            this.input,
            dt,
            this.recordedGhost,
          );

          if (ev.countdownTick) this.sound.playCountdown(false);
          if (ev.countdownGo) this.sound.playCountdown(true);
          if (ev.boostTriggered) this.sound.playBoost();
          if (ev.checkpointCleared !== null) {
            this.sound.playCheckpoint();
            this.updateCheckpointGlows();
          }
          if (ev.impactStrength > 0.12) {
            this.sound.playImpact(ev.impactStrength);
            this.cameraShake = Math.max(this.cameraShake, ev.impactStrength * 0.9);
            if (ev.impactStrength > 0.55) {
              this.hitstopTimer = 0.035; // crisp 35ms hitstop on heavy collision
            }
            // Spawn metallic wall sparks
            for (let k = 0; k < 10; k++) {
              this.spawnParticle(
                this.carState.x + (Math.random() - 0.5) * 1.4,
                this.carState.y + 0.5,
                this.carState.z + (Math.random() - 0.5) * 1.4,
                (Math.random() - 0.5) * 12,
                3 + Math.random() * 5,
                (Math.random() - 0.5) * 12,
                1.0,
                0.75,
                0.25,
                0.32,
              );
            }
          }
          if (ev.lapFinished) {
            this.handleFinish();
          }
        }

        const speedKmh = Math.hypot(this.carState.vx, this.carState.vz) * 3.6;
        const gear = Math.min(5, Math.max(1, Math.floor(speedKmh / 40) + 1));
        const rpmRatio = Math.max(0.18, Math.min(1, (speedKmh - (gear - 1) * 40 + 12) / 48));
        this.sound.updateEngine(
          !this.carState.finished,
          this.carState.countdownTimer > 0 && this.input.throttle ? 0.55 : rpmRatio,
          this.carState.isDrifting && !this.carState.isAirborne,
          this.carState.boostTimer > 0,
          speedKmh,
        );

        this.hudEmitAccum += dt;
        if (this.hudEmitAccum >= 0.045) {
          this.hudEmitAccum = 0;
          this.emitHud();
        }
      }

      this.syncCarVisuals(dt);
      this.updateParticles(dt);
      this.updateCamera(dt);

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.resizeHandler);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLostHandler);

    this.sound.dispose();
    this.carRig.dispose();
    this.ghostRig.dispose();
    this.trackVisuals?.dispose();
    this.mats.dispose();
    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.envRT?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
