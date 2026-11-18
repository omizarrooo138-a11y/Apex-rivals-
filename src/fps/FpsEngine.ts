import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FXAAPass} from 'three/addons/postprocessing/FXAAPass.js';
import {buildCombatArena, type BuiltArena} from './arena';
import {FpsSoundEngine} from './audio';
import {GAME_MODES, MAPS} from './catalog';
import {FINISHERS, OPERATOR_SKINS} from './cosmetics';
import {
  createOperatorRig,
  createRangeTarget,
  createViewmodelArms,
  createWeaponModel,
  type OperatorRig,
  type RangeTargetRig,
  type WeaponRig,
} from './models';
import {
  DEFAULT_ADMIN_TOOLS,
  DEFAULT_PRIVATE_SERVER_CONFIG,
  addSessionScore,
  grantMatchRewards,
  loadGpuSettings,
  recordCareerDelta,
  saveGpuSettings,
} from './storage';
import type {
  AdminRole,
  AdminToolsState,
  AudioSettings,
  BotDifficulty,
  CharmId,
  EmoteId,
  FinisherId,
  FloatingDamage,
  GpuSettings,
  HudEspTarget,
  KillCamFrame,
  KillCamInfo,
  KillFeedItem,
  MapId,
  MatchFormat,
  MatchHudSnapshot,
  MatchLeaderboardRow,
  MatchOverSummary,
  OperatorSkinId,
  PlayMode,
  PrivateServerSettings,
  RadarEntity,
  RoomPlayerInfo,
  SeasonalTheme,
  TeamId,
  TeammateMarker,
  WeaponId,
  WrapId,
} from './types';
import {GUN_GAME_LADDER, PRIMARY_WEAPONS, SECONDARY_WEAPONS, WEAPONS} from './weapons';
import {createWrapMaterialSet, type WrapMaterialSet} from './wraps';

const CinematicShader = {
  uniforms: {
    tDiffuse: {value: null},
    uAberration: {value: 0.0},
    uVignette: {value: 0.24},
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uAberration;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec2 distFromCenter = vUv - vec2(0.5);
      float r2 = dot(distFromCenter, distFromCenter);
      vec2 offset = distFromCenter * uAberration * 0.018;
      vec4 base = texture2D(tDiffuse, vUv);
      float r = texture2D(tDiffuse, vUv + offset).r;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 col = mix(base.rgb, vec3(r, base.g, b), clamp(uAberration * 1.4, 0.0, 1.0));
      float vig = clamp(1.0 - r2 * uVignette * 2.2, 0.35, 1.0);
      gl_FragColor = vec4(col * vig, base.a);
    }
  `,
};

const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _tmpVec = new THREE.Vector3();
const _tmpVec2 = new THREE.Vector3();
const _projVec = new THREE.Vector3();

interface TracerLine {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  life: number;
  maxLife: number;
}

interface SparkSlot {
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

interface ActiveGrenade {
  kind: 'frag' | 'molotov' | 'flash' | 'smoke' | 'satchel' | 'tripmine';
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
  armed?: boolean;
  splashRadius?: number;
  maxDmg?: number;
}

interface SmokeCloud {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  life: number;
  maxLife: number;
}

interface FirePool {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
  tickAccum: number;
}

interface ExplosionFlash {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

interface DeployedJumpPad {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  life: number;
}

interface RangeTargetInstance {
  id: string;
  kind: 'static' | 'strafe' | 'drone';
  baseX: number;
  baseY: number;
  baseZ: number;
  ampX: number;
  speed: number;
  phase: number;
  hp: number;
  maxHp: number;
  respawnTimer: number;
  hitFlash: number;
  rig: RangeTargetRig;
}

interface RemoteOperatorState {
  id: string;
  name: string;
  team: TeamId;
  rig: OperatorRig;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetYaw: number;
  alive: boolean;
  spectator?: boolean;
}

interface BotAgent {
  id: string;
  name: string;
  team: TeamId;
  rig: OperatorRig;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  strafeDir: number;
  strafeTimer: number;
  fireCooldown: number;
  blindTimer: number;
  chillTimer: number;
  moveSeed: number;
  isHoncho?: boolean;
  isJuggernaut?: boolean;
  gunGameStep: number;
  kills: number;
  deaths: number;
  damage: number;
}

export interface FpsEngineCallbacks {
  onHudUpdate: (hud: MatchHudSnapshot) => void;
  onFpsUpdate?: (fps: number) => void;
  onKillFeed: (item: KillFeedItem) => void;
  onDamageNumber?: (dmg: FloatingDamage) => void;
  onKillCamStart?: (info: KillCamInfo) => void;
  onKillCamProgress?: (progress01: number) => void;
  onMatchOver: (summary: MatchOverSummary) => void;
  onEmotePerformed?: (emoteId: EmoteId) => void;
  onSendNetEmote?: (emoteId: EmoteId) => void;
  onCareerUpdated: () => void;
  onPointerLockChange: (locked: boolean) => void;
  onContextLost: () => void;
  onSendNetState?: (state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weaponId: WeaponId;
    wrapId: WrapId;
  }) => void;
  onSendNetShoot?: (payload: {
    origin: [number, number, number];
    hitPoint: [number, number, number];
    weaponId: WeaponId;
  }) => void;
  onSendNetHit?: (payload: {
    targetId: string;
    damage: number;
    headshot: boolean;
  }) => void;
}

export class FpsEngine {
  private container: HTMLElement;
  private callbacks: FpsEngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private composer: EffectComposer | null = null;
  private composerRT: THREE.WebGLRenderTarget | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private cinematicPass: ShaderPass | null = null;
  private outputPass: OutputPass | null = null;
  private fxaaPass: FXAAPass | null = null;
  private cinematicAberration = 0;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private muzzlePointLight: THREE.PointLight;

  private sound = new FpsSoundEngine();
  private gpuSettings: GpuSettings = loadGpuSettings();

  private playMode: PlayMode = 'lobby';
  private selectedMap: MapId = 'vanguard';
  private matchFormat: MatchFormat = 'duel';
  private isRankedMatch = false;
  private privateConfig: PrivateServerSettings = {...DEFAULT_PRIVATE_SERVER_CONFIG};
  private paused = false;
  private matchEnded = false;

  // 4-Slot Loadout, Wraps, Charms & Finishers
  private primaryId: WeaponId = 'vx47';
  private secondaryId: WeaponId = 'mk2';
  private meleeId: WeaponId = 'katana';
  private utilityId: WeaponId = 'frag';
  private wrapId: WrapId = 'carbon';
  private skinId: OperatorSkinId = 'default_slate';
  private emoteId: EmoteId = 'salute';
  private charmId: CharmId = 'none';
  private finisherId: FinisherId = 'finisher_default';
  private activeSlot: 'primary' | 'secondary' | 'melee' | 'utility' = 'primary';
  private lastWeaponSlot: 'primary' | 'secondary' | 'melee' = 'primary';

  // Mirror Matchup / Gun Game temporary weapon overrides
  private overridePrimaryId: WeaponId | null = null;
  private overrideSecondaryId: WeaponId | null = null;

  private wrapMats: WrapMaterialSet | null = null;
  private viewModelGroup = new THREE.Group();
  private viewWeaponRig: WeaponRig | null = null;
  private viewArmsRig: {root: THREE.Group; dispose: () => void} | null = null;

  // Lobby showcase pedestal + Operator mannequin
  private lobbyGroup = new THREE.Group();
  private lobbyWeaponRig: WeaponRig | null = null;
  private lobbyOperatorRig: OperatorRig | null = null;
  private lobbySpinAngle = 0;
  private lobbyEmoteTimer = 0;
  private lobbyEmoteActive: EmoteId = 'salute';
  private viewEmoteTimer = 0;

  // Arena & Targets
  private arena: BuiltArena | null = null;
  private rangeTargets: RangeTargetInstance[] = [];
  private raycaster = new THREE.Raycaster();

  // Multi-Bot AI Pool (supports 1v1..5v5, 1v1v1, 2v2v2, TDM, FFA, Royale, PvE Tower, LTMs)
  private botDifficulty: BotDifficulty = 'tactician';
  private bots: BotAgent[] = [];
  private lastBotAttacker: BotAgent | null = null;

  // Objective & Mode Specific State (CTF / Domination / Royale / PvE Tower / Gun Game)
  private ctfAlphaCarrier: string | null = null;
  private ctfBravoCarrier: string | null = null;
  private domState: {label: 'A' | 'B' | 'C'; owner: TeamId | 'neutral'; progress: number}[] = [];
  private domTickAccum = 0;
  private royaleZoneRadius = 32;
  private royaleRingMesh: THREE.Mesh | null = null;
  private royaleDamageAccum = 0;
  private pveWave = 1;
  private readonly pveMaxWaves = 5;
  private gunGameStep = 0;

  // Multiplayer Remote Operators & Spectating
  private remoteOps = new Map<string, RemoteOperatorState>();
  private netSendAccum = 0;
  private isSpectating = false;
  private spectateIdx = 0;

  // Player Kinematics & Combat
  private px = 0;
  private py = 0;
  private pz = 21;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private yaw = 0;
  private pitch = 0;
  private currentEyeHeight = 1.62;
  private grounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private dashCooldown = 0;
  private dashBurstTimer = 0;
  private isCrouching = false;
  private slideTimer = 0;
  private slideCooldown = 0;
  private slideDirX = 0;
  private slideDirZ = -1;

  private hp = 100;
  private maxHp = 100;
  private shield = 50;
  private outOfCombatTimer = 0;
  private playerRespawnTimer = 0;
  private playerChilledTimer = 0;
  private warHornTimer = 0;

  private ammoMap: Record<'primary' | 'secondary', number> = {primary: 28, secondary: 12};
  private isReloading = false;
  private reloadTimer = 0;
  private fireCooldown = 0;
  private burstRemaining = 0;
  private burstDelay = 0;
  private utilityCooldownSec = 0;
  private meleeSwingTimer = 0;
  private inspectTimer = 0;
  private triggerDown = false;
  private triggerJustPressed = false;
  private isAds = false;

  private recoilOffset = 0;
  private recoilPitch = 0;
  private walkBobPhase = 0;
  private muzzleFlashTimer = 0;
  private hitmarkerType: 'none' | 'body' | 'head' | 'kill' = 'none';
  private hitmarkerTimer = 0;
  private damageFlash = 0;
  private screenShake = 0;
  private hitstopTimer = 0;

  // Match Scores & Arena Challenge
  private playerScore = 0;
  private rivalScore = 0;
  private targetScore = 5;
  private selfTeam: TeamId = 'alpha';
  private teamScores: {alpha: number; bravo: number; charlie: number} = {
    alpha: 0,
    bravo: 0,
    charlie: 0,
  };
  private roundNumber = 1;
  private roundResetTimer = 0;
  private roundBanner: string | null = null;
  private matchKills = 0;
  private matchDeaths = 0;
  private matchHeadshots = 0;
  private matchShots = 0;
  private matchHits = 0;
  private matchDamage = 0;

  private arenaScore = 0;
  private arenaTimeLeftSec = 60;
  private arenaShots = 0;
  private arenaHits = 0;
  private arenaStreak = 0;

  // Projectiles, Explosions, Fire Pools, Smokes, Deployed Pads, Tracers & Pooled Sparks
  private grenades: ActiveGrenade[] = [];
  private firePools: FirePool[] = [];
  private smokeClouds: SmokeCloud[] = [];
  private deployedPads: DeployedJumpPad[] = [];
  private explosionFlashes: ExplosionFlash[] = [];
  private tracers: TracerLine[] = [];
  private readonly maxSparks = 140;
  private sparks: SparkSlot[] = [];
  private sparkCursor = 0;
  private sparkGeo: THREE.BufferGeometry;
  private sparkPosAttr: THREE.BufferAttribute;
  private sparkColAttr: THREE.BufferAttribute;
  private sparkPoints: THREE.Points;

  // Input flags
  private keys = new Set<string>();
  private pointerLocked = false;
  private dragLooking = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private touchMoveX = 0;
  private touchMoveY = 0;

  private killFeedCounter = 1;
  private dmgCounter = 1;
  private hudAccum = 0;
  private fpsFrames = 0;
  private fpsAccumSec = 0;
  private quickMeleeReturnSlot: 'primary' | 'secondary' | null = null;
  private quickMeleeTimer = 0;
  private blindedFlash = 0;
  private killStreak = 0;
  private killStreakBanner: string | null = null;
  private killStreakBannerTimer = 0;
  private lastTimeMs = 0;
  private frameId = 0;
  private disposed = false;

  // Admin & Owner Tools
  private adminRole: AdminRole = 'none';
  private adminTools: AdminToolsState = {...DEFAULT_ADMIN_TOOLS};
  private espBoxes = new Map<string, THREE.LineSegments>();

  // Kill Cam Recording & Replay
  private killCamBuffer: KillCamFrame[] = [];
  private killCamSampleAccum = 0;
  private botShotPending = false;
  private netShotPending = false;
  private lastAttackerId: string | null = null;
  private lastAttackerName = 'Rival';
  private lastDeathFrames: KillCamFrame[] = [];
  private lastKillCamInfo: KillCamInfo | null = null;
  private isPlayingKillCam = false;
  private killCamElapsed = 0;
  private killCamDuration = 3.2;
  private killCamLastShotIdx = -1;
  private killCamSelfRig: OperatorRig | null = null;
  private pendingMatchSummary: MatchOverSummary | null = null;

  private boundResize: () => void;
  private boundPointerLock: () => void;
  private boundContextLost: (e: Event) => void;

  constructor(container: HTMLElement, callbacks: FpsEngineCallbacks) {
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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1320);
    this.scene.fog = new THREE.FogExp2(0x111a2d, 0.0085);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(this.gpuSettings.fov, w / h, 0.08, 340);
    this.scene.add(this.camera);
    this.camera.add(this.viewModelGroup);

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.78);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffe8c8, 1.85);
    this.sunLight.position.set(28, 42, 22);
    this.sunLight.shadow.mapSize.set(2048, 2048);
    const d = 38;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 120;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    this.rimLight.position.set(-28, 18, -26);
    this.scene.add(this.rimLight);

    this.muzzlePointLight = new THREE.PointLight(0xfbbf24, 0, 12, 2);
    this.camera.add(this.muzzlePointLight);
    this.muzzlePointLight.position.set(0.25, -0.15, -0.8);

    const posArr = new Float32Array(this.maxSparks * 3);
    const colArr = new Float32Array(this.maxSparks * 3);
    for (let i = 0; i < this.maxSparks; i++) {
      posArr[i * 3 + 1] = -999;
      this.sparks.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.25,
        r: 1,
        g: 0.8,
        b: 0.3,
      });
    }
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkPosAttr = new THREE.BufferAttribute(posArr, 3);
    this.sparkColAttr = new THREE.BufferAttribute(colArr, 3);
    this.sparkGeo.setAttribute('position', this.sparkPosAttr);
    this.sparkGeo.setAttribute('color', this.sparkColAttr);
    const sparkMat = new THREE.PointsMaterial({
      size: 0.16,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.sparkPoints = new THREE.Points(this.sparkGeo, sparkMat);
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    this.buildLobbyShowcase();

    if (!this.isSoftwareGl) {
      this.composerRT = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        samples: 0,
      });
      this.composer = new EffectComposer(this.renderer, this.composerRT);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.36, 0.42, 0.86);
      this.composer.addPass(this.bloomPass);
      this.cinematicPass = new ShaderPass(CinematicShader);
      this.composer.addPass(this.cinematicPass);
      this.outputPass = new OutputPass();
      this.composer.addPass(this.outputPass);
      this.fxaaPass = new FXAAPass();
      this.composer.addPass(this.fxaaPass);
    }

    this.applyGpuSettings(this.gpuSettings);
    this.rebuildWrapAndWeapon();
    this.enterLobby();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.boundResize = () => {
      if (this.disposed) return;
      const cw = Math.max(1, this.container.clientWidth);
      const ch = Math.max(1, this.container.clientHeight);
      this.camera.aspect = cw / ch;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(cw, ch);
      this.composer?.setPixelRatio(this.renderer.getPixelRatio());
      this.composer?.setSize(cw, ch);
    };
    window.addEventListener('resize', this.boundResize);

    this.boundPointerLock = () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
      this.callbacks.onPointerLockChange(this.pointerLocked);
    };
    document.addEventListener('pointerlockchange', this.boundPointerLock);

    this.boundContextLost = (e: Event) => {
      e.preventDefault();
      this.callbacks.onContextLost();
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.boundContextLost);

    this.lastTimeMs = performance.now();
    this.startLoop();
  }

  private buildLobbyShowcase(): void {
    const deckCanvas = document.createElement('canvas');
    deckCanvas.width = 512;
    deckCanvas.height = 512;
    const dctx = deckCanvas.getContext('2d')!;
    dctx.fillStyle = '#0f1624';
    dctx.fillRect(0, 0, 512, 512);
    dctx.strokeStyle = '#1e293b';
    dctx.lineWidth = 4;
    for (let i = 0; i <= 512; i += 64) {
      dctx.beginPath();
      dctx.moveTo(i, 0);
      dctx.lineTo(i, 512);
      dctx.stroke();
      dctx.beginPath();
      dctx.moveTo(0, i);
      dctx.lineTo(512, i);
      dctx.stroke();
    }
    dctx.strokeStyle = 'rgba(249, 115, 22, 0.32)';
    dctx.lineWidth = 3;
    dctx.strokeRect(4, 4, 504, 504);

    const deckTex = new THREE.CanvasTexture(deckCanvas);
    deckTex.colorSpace = THREE.SRGBColorSpace;
    deckTex.wrapS = THREE.RepeatWrapping;
    deckTex.wrapT = THREE.RepeatWrapping;
    deckTex.repeat.set(4, 4);

    const pedGeo = new THREE.CylinderGeometry(1.18, 1.42, 0.32, 12);
    const ringGeo = new THREE.TorusGeometry(1.24, 0.036, 8, 32);
    ringGeo.rotateX(Math.PI / 2);
    const outerRingGeo = new THREE.TorusGeometry(2.55, 0.025, 8, 48);
    outerRingGeo.rotateX(Math.PI / 2);
    const floorGeo = new THREE.CircleGeometry(12, 48);
    floorGeo.rotateX(-Math.PI / 2);

    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x1a2232,
      metalness: 0.72,
      roughness: 0.32,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x243045,
      metalness: 0.68,
      roughness: 0.42,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 1.25,
    });
    const cyanMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.15,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: deckTex,
      metalness: 0.38,
      roughness: 0.62,
    });

    const ped = new THREE.Mesh(pedGeo, pedMat);
    ped.position.set(0, 0.16, 0);
    ped.receiveShadow = true;

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.34, 0);

    const outerRing = new THREE.Mesh(outerRingGeo, cyanMat);
    outerRing.position.set(0, 0.02, -0.35);

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;

    const pillarGeo = new THREE.BoxGeometry(0.45, 5.2, 0.45);
    const beamGeo = new THREE.BoxGeometry(6.8, 0.42, 0.55);
    const stripGeo = new THREE.BoxGeometry(5.6, 0.09, 0.58);
    const crateGeo = new THREE.BoxGeometry(1.15, 0.85, 0.95);

    const leftPillar = new THREE.Mesh(pillarGeo, steelMat);
    leftPillar.position.set(-3.1, 2.6, -3.2);
    const rightPillar = new THREE.Mesh(pillarGeo, steelMat);
    rightPillar.position.set(3.1, 2.6, -3.2);
    const topBeam = new THREE.Mesh(beamGeo, steelMat);
    topBeam.position.set(0, 5.1, -3.2);
    const topLightStrip = new THREE.Mesh(stripGeo, cyanMat);
    topLightStrip.position.set(0, 4.92, -3.18);

    const crateL = new THREE.Mesh(crateGeo, pedMat);
    crateL.position.set(-2.35, 0.425, -2.1);
    crateL.rotation.y = 0.25;
    crateL.castShadow = true;
    const crateR = new THREE.Mesh(crateGeo, pedMat);
    crateR.position.set(2.35, 0.425, -2.25);
    crateR.rotation.y = -0.3;
    crateR.castShadow = true;

    this.lobbyGroup.add(
      ped,
      ring,
      outerRing,
      floor,
      leftPillar,
      rightPillar,
      topBeam,
      topLightStrip,
      crateL,
      crateR,
    );

    if (!this.isSoftwareGl) {
      const coneGeo = new THREE.ConeGeometry(1.85, 4.4, 24, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(-0.78, 2.2, -0.78);
      this.lobbyGroup.add(cone);

      const lobbyKeyLight = new THREE.PointLight(0x38bdf8, 2.2, 10, 2);
      lobbyKeyLight.position.set(-1.2, 3.2, -0.4);
      this.lobbyGroup.add(lobbyKeyLight);
    }

    this.scene.add(this.lobbyGroup);
  }

  private applyMapAtmosphere(mapId: MapId | 'range', seasonalTheme?: SeasonalTheme): void {
    const spec = mapId === 'range' ? MAPS.vanguard : MAPS[mapId] ?? MAPS.vanguard;
    const theme = seasonalTheme ?? this.gpuSettings.seasonalTheme ?? 'normal';
    let sky = spec.skyHex;
    let fog = spec.fogHex;
    if (theme === 'halloween') {
      sky = 0x160a24;
      fog = 0x2b123b;
    } else if (theme === 'winter') {
      sky = 0x123254;
      fog = 0x1f4f7a;
    }
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.FogExp2(fog, 0.0075);
  }

  public applyGpuSettings(next: GpuSettings): void {
    const prevAniso = this.gpuSettings.anisotropy;
    const prevPbr = this.gpuSettings.pbrTextures;
    this.gpuSettings = {...next};
    saveGpuSettings(this.gpuSettings);

    const effectiveRatio = this.isSoftwareGl
      ? 1
      : Math.min(2, Math.max(0.5, this.gpuSettings.resolutionScale));
    this.renderer.setPixelRatio(effectiveRatio);
    this.renderer.toneMappingExposure = Math.max(0.75, Math.min(1.6, this.gpuSettings.exposure ?? 1.12));

    const cw = Math.max(1, this.container.clientWidth);
    const ch = Math.max(1, this.container.clientHeight);
    if (this.composer) {
      this.composer.setPixelRatio(effectiveRatio);
      this.composer.setSize(cw, ch);
    }
    if (this.bloomPass) {
      this.bloomPass.enabled = !this.isSoftwareGl && (this.gpuSettings.bloom ?? true);
    }
    if (this.cinematicPass) {
      this.cinematicPass.enabled = !this.isSoftwareGl && (this.gpuSettings.cinematicFx ?? true);
    }
    if (this.fxaaPass) {
      this.fxaaPass.enabled = !this.isSoftwareGl && (this.gpuSettings.fxaa ?? true);
    }

    const shadowsOn = !this.isSoftwareGl && this.gpuSettings.shadows;
    this.renderer.shadowMap.enabled = shadowsOn;
    this.sunLight.castShadow = shadowsOn;

    this.sparkPoints.visible = this.gpuSettings.particles;
    if (!this.isAds && this.playMode !== 'lobby') {
      this.camera.fov = this.gpuSettings.fov;
      this.camera.updateProjectionMatrix();
    }

    if ((prevAniso !== next.anisotropy || prevPbr !== next.pbrTextures) && this.playMode === 'lobby') {
      this.rebuildWrapAndWeapon();
    }
  }

  public applyAudioSettings(next: AudioSettings): void {
    this.sound.applySettings(next);
  }

  public getAudioSettings(): AudioSettings {
    return this.sound.getSettings();
  }

  private getEffectivePrimaryId(): WeaponId {
    if (this.matchFormat === 'gun_game') {
      return GUN_GAME_LADDER[Math.min(GUN_GAME_LADDER.length - 1, this.gunGameStep)] ?? this.primaryId;
    }
    return this.overridePrimaryId ?? this.primaryId;
  }

  private getEffectiveSecondaryId(): WeaponId {
    return this.overrideSecondaryId ?? this.secondaryId;
  }

  public getActiveWeaponId(): WeaponId {
    if (this.activeSlot === 'primary') return this.getEffectivePrimaryId();
    if (this.activeSlot === 'secondary') return this.getEffectiveSecondaryId();
    if (this.activeSlot === 'melee') return this.meleeId;
    return this.utilityId;
  }

  public setLoadout(
    primary: WeaponId,
    secondary: WeaponId,
    melee: WeaponId,
    utility: WeaponId,
    wrap: WrapId,
    showcasePreviewId?: WeaponId,
  ): void {
    this.primaryId = primary;
    this.secondaryId = secondary;
    this.meleeId = melee;
    this.utilityId = utility;
    this.wrapId = wrap;
    this.rebuildWrapAndWeapon(showcasePreviewId);
  }

  public setOperatorCosmetics(
    skinId: OperatorSkinId,
    emoteId: EmoteId,
    charmId: CharmId = this.charmId,
    finisherId: FinisherId = this.finisherId,
  ): void {
    const charmChanged = this.charmId !== charmId;
    this.skinId = skinId;
    this.emoteId = emoteId;
    this.charmId = charmId;
    this.finisherId = finisherId;
    this.rebuildLobbyOperator();
    this.rebuildViewArms();
    if (charmChanged) {
      this.rebuildWrapAndWeapon();
    }
  }

  public setSpectating(spectate: boolean): void {
    this.isSpectating = spectate;
    this.viewModelGroup.visible = !spectate && this.playMode !== 'lobby';
    this.emitHud();
  }

  public cycleSpectateTarget(dir: 1 | -1): void {
    const count = this.remoteOps.size + this.bots.length;
    if (count === 0) return;
    this.spectateIdx = (this.spectateIdx + dir + count) % count;
    this.emitHud();
  }

  private rebuildViewArms(): void {
    if (this.viewArmsRig) {
      this.viewModelGroup.remove(this.viewArmsRig.root);
      this.viewArmsRig.dispose();
      this.viewArmsRig = null;
    }
    const spec = OPERATOR_SKINS[this.skinId] ?? OPERATOR_SKINS.default_slate;
    const primaryHex = Number.parseInt(spec.primaryHex.replace('#', ''), 16);
    const visorHex = Number.parseInt(spec.visorHex.replace('#', ''), 16);
    this.viewArmsRig = createViewmodelArms(primaryHex, visorHex);
    this.viewModelGroup.add(this.viewArmsRig.root);
  }

  private rebuildLobbyOperator(): void {
    if (this.lobbyOperatorRig) {
      this.lobbyGroup.remove(this.lobbyOperatorRig.root);
      this.lobbyOperatorRig.dispose();
      this.lobbyOperatorRig = null;
    }
    const spec = OPERATOR_SKINS[this.skinId] ?? OPERATOR_SKINS.default_slate;
    const primaryHex = Number.parseInt(spec.primaryHex.replace('#', ''), 16);
    const visorHex = Number.parseInt(spec.visorHex.replace('#', ''), 16);
    const rig = createOperatorRig('lobby_self', primaryHex, visorHex);
    rig.root.position.set(-0.78, 0.0, -0.78);
    rig.root.rotation.y = 2.75;
    rig.root.scale.setScalar(0.86);
    this.lobbyGroup.add(rig.root);
    this.lobbyOperatorRig = rig;
  }

  private getEffectiveAnisotropy(): number {
    const cap = this.renderer.capabilities.getMaxAnisotropy();
    return Math.max(1, Math.min(cap, this.gpuSettings.anisotropy ?? 8));
  }

  private rebuildWrapAndWeapon(showcasePreviewId?: WeaponId): void {
    this.wrapMats?.dispose();
    this.wrapMats = createWrapMaterialSet(
      this.wrapId,
      this.getEffectiveAnisotropy(),
      this.gpuSettings.pbrTextures ?? true,
    );

    if (this.viewWeaponRig) {
      this.viewModelGroup.remove(this.viewWeaponRig.root);
      this.viewWeaponRig.dispose();
    }
    const activeId = this.getActiveWeaponId();
    this.viewWeaponRig = createWeaponModel(activeId, this.wrapMats, this.charmId);
    this.viewModelGroup.add(this.viewWeaponRig.root);

    if (!this.viewArmsRig) {
      this.rebuildViewArms();
    }

    if (this.lobbyWeaponRig) {
      this.lobbyGroup.remove(this.lobbyWeaponRig.root);
      this.lobbyWeaponRig.dispose();
    }
    this.lobbyWeaponRig = createWeaponModel(
      showcasePreviewId ?? this.primaryId,
      this.wrapMats,
      this.charmId,
    );
    this.lobbyWeaponRig.root.scale.setScalar(2.4);
    this.lobbyWeaponRig.root.position.set(0, 1.15, 0);
    this.lobbyGroup.add(this.lobbyWeaponRig.root);

    if (!this.lobbyOperatorRig) {
      this.rebuildLobbyOperator();
    }
  }

  public setAdminTools(role: AdminRole, tools: AdminToolsState): void {
    this.adminRole = role;
    if (role === 'owner' || role === 'admin') {
      this.adminTools = {...tools};
    } else {
      this.adminTools = {...DEFAULT_ADMIN_TOOLS};
    }
    if (!this.adminTools.espEnabled) {
      this.clearEspBoxes();
    }
  }

  public forceWinCurrentMatch(): void {
    if (this.adminRole !== 'owner' && this.adminRole !== 'admin') return;
    if (this.playMode === 'rivals_1p' && !this.matchEnded) {
      this.finishRivalsMatch(true);
    } else if (this.playMode === 'shooting_arena' && !this.matchEnded) {
      this.matchEnded = true;
      this.releasePointerLock();
      this.callbacks.onMatchOver(this.buildMatchSummary(true, 'shooting_arena'));
    }
  }

  private clearEspBoxes(): void {
    for (const box of this.espBoxes.values()) {
      this.scene.remove(box);
      box.geometry.dispose();
      (box.material as THREE.Material).dispose();
    }
    this.espBoxes.clear();
  }

  private ensureEspBox(id: string, colorHex = 0xf43f5e): THREE.LineSegments {
    const existing = this.espBoxes.get(id);
    if (existing) {
      (existing.material as THREE.LineBasicMaterial).color.setHex(colorHex);
      return existing;
    }
    const boxGeo = new THREE.BoxGeometry(0.95, 1.85, 0.95);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      depthTest: false,
      transparent: true,
      opacity: 0.92,
    });
    const seg = new THREE.LineSegments(edges, mat);
    seg.renderOrder = 999;
    this.scene.add(seg);
    this.espBoxes.set(id, seg);
    return seg;
  }

  public enterLobby(): void {
    this.stopKillCam(true);
    this.playMode = 'lobby';
    this.paused = false;
    this.matchEnded = false;
    this.isSpectating = false;
    this.overridePrimaryId = null;
    this.overrideSecondaryId = null;
    this.releasePointerLock();
    this.clearArena();
    this.applyMapAtmosphere('vanguard', this.gpuSettings.seasonalTheme);
    this.lobbyGroup.visible = true;
    this.viewModelGroup.visible = false;
    this.camera.position.set(0.6, 1.55, 2.35);
    this.camera.lookAt(0.22, 1.08, -0.1);
    this.camera.fov = 52;
    this.camera.updateProjectionMatrix();
  }

  private clearArena(): void {
    this.clearEspBoxes();
    this.killCamBuffer = [];
    this.lastDeathFrames = [];
    this.lastKillCamInfo = null;
    this.pendingMatchSummary = null;
    this.isPlayingKillCam = false;
    this.lastBotAttacker = null;
    if (this.killCamSelfRig) {
      this.scene.remove(this.killCamSelfRig.root);
      this.killCamSelfRig.dispose();
      this.killCamSelfRig = null;
    }
    if (this.royaleRingMesh) {
      this.scene.remove(this.royaleRingMesh);
      this.royaleRingMesh.geometry.dispose();
      (this.royaleRingMesh.material as THREE.Material).dispose();
      this.royaleRingMesh = null;
    }
    if (this.arena) {
      this.scene.remove(this.arena.group);
      this.arena.dispose();
      this.arena = null;
    }
    for (const b of this.bots) {
      this.scene.remove(b.rig.root);
      b.rig.dispose();
    }
    this.bots = [];
    for (const r of this.rangeTargets) {
      this.scene.remove(r.rig.root);
      r.rig.dispose();
    }
    this.rangeTargets = [];
    for (const rem of this.remoteOps.values()) {
      this.scene.remove(rem.rig.root);
      rem.rig.dispose();
    }
    this.remoteOps.clear();
    for (const g of this.grenades) {
      this.scene.remove(g.mesh);
      g.mesh.geometry.dispose();
      (g.mesh.material as THREE.Material).dispose();
    }
    this.grenades = [];
    for (const fp of this.firePools) {
      this.scene.remove(fp.mesh);
      fp.mesh.geometry.dispose();
      fp.mat.dispose();
    }
    this.firePools = [];
    for (const sm of this.smokeClouds) {
      this.scene.remove(sm.mesh);
      sm.mesh.geometry.dispose();
      sm.mat.dispose();
    }
    this.smokeClouds = [];
    for (const dp of this.deployedPads) {
      this.scene.remove(dp.mesh);
      dp.mesh.geometry.dispose();
      (dp.mesh.material as THREE.Material).dispose();
    }
    this.deployedPads = [];
    for (const f of this.explosionFlashes) {
      this.scene.remove(f.mesh);
      f.mesh.geometry.dispose();
      f.mat.dispose();
    }
    this.explosionFlashes = [];
    this.blindedFlash = 0;
    this.playerChilledTimer = 0;
    this.warHornTimer = 0;
    this.killStreak = 0;
    this.killStreakBanner = null;
    this.killStreakBannerTimer = 0;
    this.quickMeleeReturnSlot = null;
    this.quickMeleeTimer = 0;
  }

  private isRoundBasedMode(fmt: MatchFormat): boolean {
    return (
      fmt === 'duel' ||
      fmt === 'duel_2v2' ||
      fmt === 'duel_3v3' ||
      fmt === 'duel_4v4' ||
      fmt === 'duel_5v5' ||
      fmt === 'beginner' ||
      fmt === 'mirror_matchup' ||
      fmt === 'limitless_loadout' ||
      fmt === 'juggernaut'
    );
  }

  private isTeamMode(fmt: MatchFormat): boolean {
    const spec = GAME_MODES[fmt];
    return spec ? spec.teamCount >= 2 : false;
  }

  public startSinglePlayerRivals(
    difficulty: BotDifficulty,
    mapId: MapId = 'vanguard',
    matchFormat: MatchFormat = 'duel',
    opts?: {isRanked?: boolean; privateConfig?: PrivateServerSettings},
  ): void {
    this.sound.ensureReady();
    this.botDifficulty = matchFormat === 'beginner' ? 'recruit' : difficulty;
    this.selectedMap = mapId;
    this.matchFormat = matchFormat;
    this.isRankedMatch = Boolean(opts?.isRanked);
    this.privateConfig = opts?.privateConfig
      ? {...opts.privateConfig}
      : {...DEFAULT_PRIVATE_SERVER_CONFIG};
    this.playMode = 'rivals_1p';
    this.paused = false;
    this.matchEnded = false;
    this.isSpectating = false;
    this.lobbyGroup.visible = false;
    this.viewModelGroup.visible = true;
    this.activeSlot = 'primary';
    this.lastWeaponSlot = 'primary';
    this.gunGameStep = 0;

    if (matchFormat === 'mirror_matchup') {
      const rp = PRIMARY_WEAPONS[Math.floor(Math.random() * PRIMARY_WEAPONS.length)];
      const rs = SECONDARY_WEAPONS[Math.floor(Math.random() * SECONDARY_WEAPONS.length)];
      this.overridePrimaryId = rp.id;
      this.overrideSecondaryId = rs.id;
    } else {
      this.overridePrimaryId = null;
      this.overrideSecondaryId = null;
    }

    this.rebuildWrapAndWeapon();
    this.clearArena();

    const theme = this.privateConfig.isPrivate
      ? this.privateConfig.seasonalTheme
      : this.gpuSettings.seasonalTheme;
    this.applyMapAtmosphere(mapId, theme);
    this.arena = buildCombatArena(mapId, this.getEffectiveAnisotropy(), {
      pbrTextures: this.gpuSettings.pbrTextures,
      isSoftwareGl: this.isSoftwareGl,
      seasonalTheme: theme,
      matchFormat,
    });
    this.scene.add(this.arena.group);

    this.playerScore = 0;
    this.rivalScore = 0;
    this.selfTeam = 'alpha';
    this.teamScores = {alpha: 0, bravo: 0, charlie: 0};
    const modeSpec = GAME_MODES[matchFormat];
    this.targetScore = modeSpec?.targetScore ?? 5;
    this.roundNumber = 1;
    this.matchKills = 0;
    this.matchDeaths = 0;
    this.matchHeadshots = 0;
    this.matchShots = 0;
    this.matchHits = 0;
    this.matchDamage = 0;
    this.playerRespawnTimer = 0;
    this.ctfAlphaCarrier = null;
    this.ctfBravoCarrier = null;
    this.pveWave = 1;

    if (this.arena.domZones) {
      this.domState = this.arena.domZones.map((z) => ({
        label: z.label,
        owner: 'neutral',
        progress: 0,
      }));
    } else {
      this.domState = [];
    }

    if (matchFormat === 'royale') {
      this.royaleZoneRadius = (this.arena.arenaHalfExtent || 26) * 1.15;
      const ringGeo = new THREE.CylinderGeometry(
        this.royaleZoneRadius,
        this.royaleZoneRadius,
        14,
        36,
        1,
        true,
      );
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.royaleRingMesh = new THREE.Mesh(ringGeo, ringMat);
      this.royaleRingMesh.position.y = 7;
      this.scene.add(this.royaleRingMesh);
    }

    // Spawn AI teammates & rivals tailored to the selected Game Mode
    this.spawnOfflineBotsForFormat(matchFormat);

    recordCareerDelta({matchesPlayed: 1});
    this.callbacks.onCareerUpdated();

    const bannerPrefix = this.isRankedMatch ? 'RANKED · ' : '';
    this.resetDuelRound(`${bannerPrefix}${modeSpec?.name.toUpperCase() ?? 'ARENA'} · FIGHT`);
    this.requestPointerLock();
    this.emitHud();
  }

  private spawnOfflineBotsForFormat(fmt: MatchFormat): void {
    if (!this.arena) return;
    let alphaAllies = 0;
    let bravoEnemies = 1;
    let charlieEnemies = 0;

    if (fmt === 'duel_2v2' || fmt === 'tdm_2v2') {
      alphaAllies = 1;
      bravoEnemies = 2;
    } else if (fmt === 'duel_3v3') {
      alphaAllies = 2;
      bravoEnemies = 3;
    } else if (fmt === 'duel_4v4' || fmt === 'tdm_4v4') {
      alphaAllies = 3;
      bravoEnemies = 4;
    } else if (fmt === 'duel_5v5') {
      alphaAllies = 4;
      bravoEnemies = 5;
    } else if (fmt === 'threeway_1v1v1') {
      alphaAllies = 0;
      bravoEnemies = 1;
      charlieEnemies = 1;
    } else if (fmt === 'threeway_2v2v2') {
      alphaAllies = 1;
      bravoEnemies = 2;
      charlieEnemies = 2;
    } else if (fmt === 'ffa' || fmt === 'gun_game') {
      bravoEnemies = 5;
    } else if (fmt === 'royale') {
      bravoEnemies = 8;
    } else if (fmt === 'ctf' || fmt === 'domination' || fmt === 'head_honcho') {
      alphaAllies = 2;
      bravoEnemies = 3;
    } else if (fmt === 'pve_tower') {
      alphaAllies = 1;
      bravoEnemies = 3;
    } else if (fmt === 'juggernaut') {
      alphaAllies = 2;
      bravoEnemies = 1;
    }

    const addBot = (
      id: string,
      name: string,
      team: TeamId,
      primaryHex: number,
      visorHex: number,
      hpMax = 100,
      extra?: {isHoncho?: boolean; isJuggernaut?: boolean},
    ) => {
      const rig = createOperatorRig(id, primaryHex, visorHex);
      if (extra?.isJuggernaut) rig.root.scale.setScalar(1.32);
      this.scene.add(rig.root);
      this.bots.push({
        id,
        name,
        team,
        rig,
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        hp: hpMax,
        maxHp: hpMax,
        alive: true,
        respawnTimer: 0,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        strafeTimer: 0.9,
        fireCooldown: 0.7 + Math.random() * 0.6,
        blindTimer: 0,
        chillTimer: 0,
        moveSeed: Math.random() * 10,
        isHoncho: extra?.isHoncho,
        isJuggernaut: extra?.isJuggernaut,
        gunGameStep: 0,
        kills: 0,
        deaths: 0,
        damage: 0,
      });
    };

    for (let i = 0; i < alphaAllies; i++) {
      addBot(`ally_${i}`, `Wingman-${i + 1}`, 'alpha', 0x0284c7, 0x38bdf8);
    }

    const isFfaLike = fmt === 'ffa' || fmt === 'gun_game' || fmt === 'royale';
    for (let i = 0; i < bravoEnemies; i++) {
      const isJugg = fmt === 'juggernaut' && i === 0;
      const isHoncho = fmt === 'head_honcho' && i === 0;
      const maxHp = isJugg ? 500 : fmt === 'pve_tower' ? 90 + (this.pveWave - 1) * 20 : 100;
      const label = isJugg
        ? 'TITAN JUGGERNAUT'
        : isHoncho
        ? 'HEAD HONCHO'
        : isFfaLike
        ? `Rival-${i + 1}`
        : `Bravo-${i + 1}`;
      addBot(
        `bot_b_${i}`,
        label,
        'bravo',
        isJugg ? 0x7c2d12 : isHoncho ? 0xf59e0b : 0xe11d48,
        isJugg ? 0xf97316 : isHoncho ? 0xfef08a : 0xfbbf24,
        maxHp,
        {isHoncho, isJuggernaut: isJugg},
      );
    }

    for (let i = 0; i < charlieEnemies; i++) {
      addBot(`bot_c_${i}`, `Charlie-${i + 1}`, 'charlie', 0x047857, 0x34d399);
    }
  }

  public startShootingArena(): void {
    this.sound.ensureReady();
    this.playMode = 'shooting_arena';
    this.paused = false;
    this.matchEnded = false;
    this.isSpectating = false;
    this.isRankedMatch = false;
    this.overridePrimaryId = null;
    this.overrideSecondaryId = null;
    this.lobbyGroup.visible = false;
    this.viewModelGroup.visible = true;
    this.activeSlot = 'primary';
    this.lastWeaponSlot = 'primary';
    this.rebuildWrapAndWeapon();

    this.clearArena();
    this.applyMapAtmosphere('range', this.gpuSettings.seasonalTheme);
    this.arena = buildCombatArena('range', this.getEffectiveAnisotropy(), {
      pbrTextures: this.gpuSettings.pbrTextures,
      isSoftwareGl: this.isSoftwareGl,
      seasonalTheme: this.gpuSettings.seasonalTheme,
    });
    this.scene.add(this.arena.group);

    const specs: {
      id: string;
      kind: 'static' | 'strafe' | 'drone';
      x: number;
      y: number;
      z: number;
      amp: number;
      spd: number;
    }[] = [
      {id: 't_close_l', kind: 'static', x: -7.5, y: 0, z: -2, amp: 0, spd: 0},
      {id: 't_close_r', kind: 'static', x: 7.5, y: 0, z: -4, amp: 0, spd: 0},
      {id: 't_mid_strafe1', kind: 'strafe', x: -4, y: 0, z: -14, amp: 6.5, spd: 1.8},
      {id: 't_mid_strafe2', kind: 'strafe', x: 4, y: 0, z: -20, amp: 7.5, spd: 2.3},
      {id: 't_far_sniper', kind: 'static', x: 0, y: 0, z: -34, amp: 0, spd: 0},
      {id: 't_drone', kind: 'drone', x: 0, y: 4.5, z: -16, amp: 9.0, spd: 1.5},
    ];

    specs.forEach((s, i) => {
      const rig = createRangeTarget(s.id, s.kind === 'drone');
      rig.root.position.set(s.x, s.y, s.z);
      this.scene.add(rig.root);
      this.rangeTargets.push({
        id: s.id,
        kind: s.kind,
        baseX: s.x,
        baseY: s.y,
        baseZ: s.z,
        ampX: s.amp,
        speed: s.spd,
        phase: i * 1.1,
        hp: 100,
        maxHp: 100,
        respawnTimer: 0,
        hitFlash: 0,
        rig,
      });
    });

    this.arenaScore = 0;
    this.arenaTimeLeftSec = 60;
    this.arenaShots = 0;
    this.arenaHits = 0;
    this.arenaStreak = 0;
    this.matchKills = 0;
    this.matchDeaths = 0;
    this.matchHeadshots = 0;
    this.matchShots = 0;
    this.matchHits = 0;
    this.matchDamage = 0;

    this.resetPlayerToSpawn(0, 0, 12, 0);
    this.roundBanner = 'SHOOTING ARENA · 60s';
    this.roundResetTimer = 1.4;
    this.requestPointerLock();
    this.emitHud();
  }

  public startMultiplayerMatch(
    selfSpawnIdx: number,
    players: RoomPlayerInfo[],
    selfId: string,
    mapId: MapId = 'vanguard',
    matchFormat: MatchFormat = 'duel',
    selfTeam: TeamId = 'alpha',
    opts?: {privateConfig?: PrivateServerSettings; selfSpectator?: boolean},
  ): void {
    this.sound.ensureReady();
    this.selectedMap = mapId;
    this.matchFormat = matchFormat;
    this.selfTeam = selfTeam;
    this.isRankedMatch = false;
    this.privateConfig = opts?.privateConfig
      ? {...opts.privateConfig}
      : {...DEFAULT_PRIVATE_SERVER_CONFIG};
    this.teamScores = {alpha: 0, bravo: 0, charlie: 0};
    this.playMode = 'multiplayer';
    this.paused = false;
    this.matchEnded = false;
    this.isSpectating = Boolean(opts?.selfSpectator);
    this.overridePrimaryId = null;
    this.overrideSecondaryId = null;
    this.gunGameStep = 0;
    this.lobbyGroup.visible = false;
    this.viewModelGroup.visible = !this.isSpectating;
    this.activeSlot = 'primary';
    this.lastWeaponSlot = 'primary';
    this.rebuildWrapAndWeapon();

    this.clearArena();
    const theme = this.privateConfig.isPrivate
      ? this.privateConfig.seasonalTheme
      : this.gpuSettings.seasonalTheme;
    this.applyMapAtmosphere(mapId, theme);
    this.arena = buildCombatArena(mapId, this.getEffectiveAnisotropy(), {
      pbrTextures: this.gpuSettings.pbrTextures,
      isSoftwareGl: this.isSoftwareGl,
      seasonalTheme: theme,
      matchFormat,
    });
    this.scene.add(this.arena.group);

    this.playerScore = 0;
    this.rivalScore = 0;
    this.targetScore = GAME_MODES[matchFormat]?.targetScore ?? 5;
    this.roundNumber = 1;
    this.matchKills = 0;
    this.matchDeaths = 0;
    this.matchHeadshots = 0;
    this.matchShots = 0;
    this.matchHits = 0;
    this.matchDamage = 0;

    recordCareerDelta({matchesPlayed: 1});
    this.callbacks.onCareerUpdated();

    const spawns =
      selfTeam === 'charlie' && this.arena.charlieSpawns.length > 0
        ? this.arena.charlieSpawns
        : this.arena.spawns;
    const sp = spawns[selfSpawnIdx % spawns.length];
    this.resetPlayerToSpawn(sp.x, sp.y, sp.z, sp.yaw);

    const isTeam = this.isTeamMode(matchFormat);

    players.forEach((p) => {
      if (p.id === selfId || p.spectator) return;
      const team: TeamId = p.team ?? 'alpha';
      const skin = OPERATOR_SKINS[p.skinId ?? 'default_slate'] ?? OPERATOR_SKINS.default_slate;
      const pCol = isTeam
        ? team === 'alpha'
          ? 0x0284c7
          : team === 'charlie'
          ? 0x059669
          : 0xbe123c
        : Number.parseInt(skin.primaryHex.replace('#', ''), 16);
      const vCol = isTeam
        ? team === 'alpha'
          ? 0x38bdf8
          : team === 'charlie'
          ? 0x6ee7b7
          : 0xfb7185
        : Number.parseInt(skin.visorHex.replace('#', ''), 16);
      const rig = createOperatorRig(p.id, pCol, vCol);
      const teamSpawns =
        team === 'charlie' && this.arena!.charlieSpawns.length > 0
          ? this.arena!.charlieSpawns
          : this.arena!.spawns;
      const rsp = teamSpawns[p.spawnIdx % teamSpawns.length];
      rig.root.position.set(rsp.x, rsp.y, rsp.z);
      this.scene.add(rig.root);
      this.remoteOps.set(p.id, {
        id: p.id,
        name: p.name,
        team,
        rig,
        targetX: rsp.x,
        targetY: rsp.y,
        targetZ: rsp.z,
        targetYaw: rsp.yaw,
        alive: true,
        spectator: p.spectator,
      });
    });

    const mapName = (MAPS[mapId]?.name ?? 'ARENA').toUpperCase();
    this.roundBanner = this.isSpectating
      ? `${mapName} · SPECTATING`
      : isTeam
      ? `${mapName} · TEAM ${selfTeam.toUpperCase()}`
      : `${mapName} · LIVE`;
    this.roundResetTimer = 1.6;
    this.requestPointerLock();
    this.emitHud();
  }

  public syncRemotePlayerState(
    id: string,
    x: number,
    y: number,
    z: number,
    yaw: number,
  ): void {
    const rem = this.remoteOps.get(id);
    if (!rem) return;
    rem.targetX = x;
    rem.targetY = y;
    rem.targetZ = z;
    rem.targetYaw = yaw;
  }

  public spawnRemoteShot(
    origin: [number, number, number],
    hitPoint: [number, number, number],
  ): void {
    this.netShotPending = true;
    this.spawnTracer(
      new THREE.Vector3(origin[0], origin[1], origin[2]),
      new THREE.Vector3(hitPoint[0], hitPoint[1], hitPoint[2]),
      0x38bdf8,
    );
  }

  public handleRemoteDamage(hp: number, attackerId?: string, attackerName?: string): void {
    if ((this.adminRole === 'owner' || this.adminRole === 'admin') && this.adminTools.godMode) {
      this.hp = 100;
      this.shield = 50;
      return;
    }
    if (attackerId) this.lastAttackerId = attackerId;
    if (attackerName) this.lastAttackerName = attackerName;
    this.hp = hp;
    this.outOfCombatTimer = 0;
    this.damageFlash = 0.85;
    this.cinematicAberration = Math.min(1, this.cinematicAberration + 0.65);
    this.screenShake = Math.max(this.screenShake, 0.25);
    this.sound.playDamageTaken();
    if (hp <= 0) {
      this.matchDeaths++;
      this.captureKillCam(this.lastAttackerName || 'Rival', 'Arena Rifle', false);
      recordCareerDelta({deaths: 1});
      this.callbacks.onCareerUpdated();
    }
    this.emitHud();
  }

  public handleRemotePlayerState(targetId: string, alive: boolean): void {
    const rem = this.remoteOps.get(targetId);
    if (rem) {
      rem.alive = alive;
      rem.rig.root.visible = alive;
    }
  }

  public respawnSelfMultiplayer(spawnIdx: number): void {
    const spawns = this.arena?.spawns ?? [{x: 0, y: 0, z: 21, yaw: 0}];
    const sp = spawns[spawnIdx % spawns.length];
    this.resetPlayerToSpawn(sp.x, sp.y, sp.z, sp.yaw);
    this.emitHud();
  }

  public updateMultiplayerScores(
    playerScore: number,
    topRivalScore: number,
    teamScores?: {alpha: number; bravo: number; charlie?: number},
  ): void {
    this.playerScore = playerScore;
    this.rivalScore = topRivalScore;
    if (teamScores) {
      this.teamScores = {
        alpha: teamScores.alpha,
        bravo: teamScores.bravo,
        charlie: teamScores.charlie ?? 0,
      };
    }
    this.emitHud();
  }

  private resetPlayerToSpawn(x: number, y: number, z: number, yaw: number): void {
    this.px = x;
    this.py = y;
    this.pz = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.maxHp = 100;
    this.hp = 100;
    this.shield = 50;
    this.outOfCombatTimer = 0;
    this.playerChilledTimer = 0;
    this.warHornTimer = 0;
    this.grounded = true;
    this.isCrouching = false;
    this.slideTimer = 0;
    this.currentEyeHeight = 1.62;
    const priSpec = WEAPONS[this.getEffectivePrimaryId()];
    const secSpec = WEAPONS[this.getEffectiveSecondaryId()];
    this.ammoMap = {
      primary: priSpec.magSize,
      secondary: secSpec.magSize,
    };
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.burstRemaining = 0;
    this.utilityCooldownSec = 0;
    this.recoilOffset = 0;
    this.recoilPitch = 0;
  }

  private resetDuelRound(banner: string): void {
    if (!this.arena) return;
    if (this.matchFormat === 'mirror_matchup' && this.roundNumber > 1) {
      const rp = PRIMARY_WEAPONS[Math.floor(Math.random() * PRIMARY_WEAPONS.length)];
      const rs = SECONDARY_WEAPONS[Math.floor(Math.random() * SECONDARY_WEAPONS.length)];
      this.overridePrimaryId = rp.id;
      this.overrideSecondaryId = rs.id;
      this.rebuildWrapAndWeapon();
    }

    const ps = this.arena.playerSpawn;
    this.resetPlayerToSpawn(ps.x, ps.y, ps.z, ps.yaw);

    const allSpawns = this.arena.spawns;
    const charlieSpawns = this.arena.charlieSpawns;
    let aIdx = 1;
    let bIdx = 0;
    let cIdx = 0;
    for (const bot of this.bots) {
      let sp = allSpawns[1];
      if (bot.team === 'alpha') {
        sp = allSpawns[((aIdx++) * 2) % allSpawns.length];
      } else if (bot.team === 'charlie' && charlieSpawns.length > 0) {
        sp = charlieSpawns[(cIdx++) % charlieSpawns.length];
      } else {
        sp = allSpawns[((bIdx++) * 2 + 1) % allSpawns.length];
      }
      bot.x = sp.x;
      bot.y = sp.y;
      bot.z = sp.z;
      bot.yaw = sp.yaw;
      bot.hp = bot.maxHp;
      bot.alive = true;
      bot.blindTimer = 0;
      bot.chillTimer = 0;
      bot.fireCooldown = 0.8 + Math.random() * 0.6;
      bot.rig.root.visible = true;
      bot.rig.root.position.set(bot.x, bot.y, bot.z);
      bot.rig.root.rotation.y = bot.yaw;
    }

    this.roundBanner = banner;
    this.roundResetTimer = 1.3;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    this.keys.clear();
    this.triggerDown = false;
    this.isAds = false;
    if (paused) {
      this.releasePointerLock();
    } else if (this.playMode !== 'lobby' && !this.matchEnded) {
      this.requestPointerLock();
    }
  }

  public requestPointerLock(): void {
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Ignore if sandbox blocks pointer lock
    }
  }

  public releasePointerLock(): void {
    try {
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    } catch {
      // ignore
    }
  }

  public onKeyDown(code: string): void {
    if (this.playMode === 'lobby' || this.paused || this.matchEnded) return;
    if (this.isSpectating) {
      if (code === 'ArrowRight' || code === 'KeyD') this.cycleSpectateTarget(1);
      if (code === 'ArrowLeft' || code === 'KeyA') this.cycleSpectateTarget(-1);
      return;
    }
    const wasDown = this.keys.has(code);
    this.keys.add(code);

    if (code === 'Space') this.jumpBufferTimer = 0.12;
    if (code === 'KeyR') this.startReload();
    if (code === 'Digit1') this.switchSlot('primary');
    if (code === 'Digit2') this.switchSlot('secondary');
    if (code === 'Digit3') this.switchSlot('melee');
    if (code === 'Digit4') this.switchSlot('utility');
    if (code === 'KeyG' && !wasDown) this.useUtility();
    if (code === 'KeyV' && !wasDown) this.triggerQuickMelee();
    if (code === 'KeyY' && !wasDown) this.triggerInspect();
    if (code === 'KeyB' && !wasDown) this.triggerEmote();
    if (code === 'KeyQ' && !wasDown) {
      this.switchSlot(this.activeSlot === 'primary' ? 'secondary' : 'primary');
    }
    if (code === 'KeyE' && !wasDown) this.isAds = !this.isAds;

    if ((code === 'KeyC' || code === 'ControlLeft' || code === 'ControlRight') && !wasDown) {
      const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      const moving = Math.hypot(this.vx, this.vz) > 4.5;
      if (sprinting && moving && this.grounded && this.slideCooldown <= 0) {
        this.slideTimer = 0.46;
        this.slideCooldown = 1.0;
        const speed = Math.max(0.1, Math.hypot(this.vx, this.vz));
        this.slideDirX = this.vx / speed;
        this.slideDirZ = this.vz / speed;
        this.vx = this.slideDirX * 16.5;
        this.vz = this.slideDirZ * 16.5;
        this.sound.playDash();
      }
    }
  }

  public onKeyUp(code: string): void {
    this.keys.delete(code);
  }

  public clearAllInputs(): void {
    this.keys.clear();
    this.triggerDown = false;
    this.dragLooking = false;
    this.isAds = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
  }

  public onMouseMove(dx: number, dy: number, clientX: number, clientY: number): void {
    if (this.playMode === 'lobby' || this.paused || this.matchEnded) return;
    const sens = 0.0022 * this.gpuSettings.sensitivity * (this.isAds ? 0.62 : 1.0);
    if (this.pointerLocked) {
      this.yaw -= dx * sens;
      this.pitch = Math.max(-1.42, Math.min(1.42, this.pitch - dy * sens));
    } else if (this.dragLooking) {
      const ddx = clientX - this.lastDragX;
      const ddy = clientY - this.lastDragY;
      this.lastDragX = clientX;
      this.lastDragY = clientY;
      this.yaw -= ddx * sens * 1.4;
      this.pitch = Math.max(-1.42, Math.min(1.42, this.pitch - ddy * sens * 1.4));
    }
  }

  public onMouseDown(button: number, clientX: number, clientY: number): void {
    if (this.playMode === 'lobby' || this.paused || this.matchEnded) return;
    this.sound.ensureReady();
    if (!this.pointerLocked) {
      this.requestPointerLock();
      this.dragLooking = true;
      this.lastDragX = clientX;
      this.lastDragY = clientY;
    }
    if (this.isSpectating) {
      if (button === 0) this.cycleSpectateTarget(1);
      return;
    }
    if (button === 0) {
      this.triggerDown = true;
      this.triggerJustPressed = true;
    } else if (button === 2) {
      if (this.activeSlot === 'primary' || this.activeSlot === 'secondary') {
        this.isAds = true;
      }
    }
  }

  public onMouseUp(button: number): void {
    this.dragLooking = false;
    if (button === 0) {
      this.triggerDown = false;
    } else if (button === 2) {
      this.isAds = false;
    }
  }

  public setTouchMove(x: number, y: number): void {
    this.touchMoveX = x;
    this.touchMoveY = y;
  }

  public addTouchLook(dx: number, dy: number): void {
    const sens = 0.004 * this.gpuSettings.sensitivity;
    this.yaw -= dx * sens;
    this.pitch = Math.max(-1.42, Math.min(1.42, this.pitch - dy * sens));
  }

  public setTouchFire(firing: boolean): void {
    this.sound.ensureReady();
    if (firing && !this.triggerDown) {
      this.triggerJustPressed = true;
    }
    this.triggerDown = firing;
  }

  public triggerTouchJump(): void {
    this.jumpBufferTimer = 0.14;
  }

  public triggerDash(): void {
    if (this.dashCooldown <= 0 && !this.paused && this.playMode !== 'lobby' && !this.isSpectating) {
      this.dashBurstTimer = 0.16;
      this.dashCooldown = this.matchFormat === 'limitless_loadout' ? 0.55 : 2.4;
      this.cinematicAberration = Math.min(1, this.cinematicAberration + 0.45);
      this.sound.playDash();
    }
  }

  public triggerInspect(): void {
    if (!this.isReloading && !this.isAds && this.playMode !== 'lobby') {
      this.inspectTimer = 1.1;
    }
  }

  public triggerEmote(overrideId?: EmoteId): void {
    const eid = overrideId ?? this.emoteId;
    this.sound.ensureReady();
    this.sound.playHeal();
    if (this.playMode === 'lobby') {
      this.lobbyEmoteActive = eid;
      this.lobbyEmoteTimer = 1.6;
      this.callbacks.onEmotePerformed?.(eid);
      return;
    }
    if (!this.paused && !this.matchEnded) {
      this.viewEmoteTimer = 1.25;
      this.callbacks.onEmotePerformed?.(eid);
      if (this.playMode === 'multiplayer') {
        this.callbacks.onSendNetEmote?.(eid);
      }
    }
  }

  public switchSlot(slot: 'primary' | 'secondary' | 'melee' | 'utility'): void {
    if (this.activeSlot === slot) return;
    if (this.activeSlot !== 'utility') {
      this.lastWeaponSlot = this.activeSlot;
    }
    this.activeSlot = slot;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.burstRemaining = 0;
    this.inspectTimer = 0;
    this.isAds = false;
    this.rebuildWrapAndWeapon();
    this.emitHud();
  }

  public startReload(): void {
    if (this.activeSlot !== 'primary' && this.activeSlot !== 'secondary') return;
    const activeId = this.getActiveWeaponId();
    const spec = WEAPONS[activeId];
    if (this.isReloading || this.ammoMap[this.activeSlot] >= spec.magSize) return;
    if (this.privateConfig.isPrivate && this.privateConfig.instantReload) {
      this.ammoMap[this.activeSlot] = spec.magSize;
      this.sound.playReload();
      this.emitHud();
      return;
    }
    this.isReloading = true;
    this.reloadTimer = spec.reloadSec;
    this.burstRemaining = 0;
    this.inspectTimer = 0;
    this.isAds = false;
    this.sound.playReload();
  }

  public triggerQuickMelee(): void {
    if (this.playMode === 'lobby' || this.paused || this.matchEnded || this.isSpectating) return;
    if (this.playerRespawnTimer > 0 || this.quickMeleeTimer > 0) return;

    const returnSlot =
      this.activeSlot === 'primary' || this.activeSlot === 'secondary'
        ? this.activeSlot
        : this.lastWeaponSlot === 'melee'
        ? 'primary'
        : this.lastWeaponSlot;

    if (this.activeSlot !== 'melee') {
      this.quickMeleeReturnSlot = returnSlot;
      this.switchSlot('melee');
    } else {
      this.quickMeleeReturnSlot = null;
    }
    this.fireCooldown = 0;
    this.tryMeleeSlash();
    this.quickMeleeTimer = 0.28;
  }

  public useUtility(): void {
    if (this.playMode === 'lobby' || this.paused || this.matchEnded || this.isSpectating) return;
    if (this.utilityCooldownSec > 0 || this.playerRespawnTimer > 0) return;

    const uSpec = WEAPONS[this.utilityId];
    this.utilityCooldownSec = this.matchFormat === 'limitless_loadout' ? 0.9 : 9.0;
    this.inspectTimer = 0;

    if (uSpec.archetype === 'heal') {
      const isFlashShield = this.utilityId === 'flash_shield';
      this.hp = Math.min(this.maxHp, this.hp + (isFlashShield ? 35 : 55));
      this.shield = Math.min(50, this.shield + (isFlashShield ? 50 : 25));
      if (isFlashShield) this.dashBurstTimer = 0.2;
      this.sound.playHeal();
      if (this.activeSlot === 'utility') this.switchSlot(this.lastWeaponSlot);
      this.emitHud();
      return;
    }

    if (uSpec.archetype === 'buff') {
      this.warHornTimer = 6.0;
      this.sound.playWarHorn();
      if (this.activeSlot === 'utility') this.switchSlot(this.lastWeaponSlot);
      this.emitHud();
      return;
    }

    if (uSpec.archetype === 'jumppad') {
      const padGeo = new THREE.CylinderGeometry(1.5, 1.8, 0.2, 16);
      const padMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.4,
      });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set(this.px, this.py + 0.1, this.pz);
      this.scene.add(padMesh);
      this.deployedPads.push({mesh: padMesh, x: this.px, y: this.py, z: this.pz, life: 16});
      this.vy = 13.5;
      this.grounded = false;
      this.sound.playDash();
      if (this.activeSlot === 'utility') this.switchSlot(this.lastWeaponSlot);
      this.emitHud();
      return;
    }

    if (this.utilityId === 'freeze_ray') {
      this.sound.playGunshot('freeze_ray');
      this.executeSingleShot('secondary', 'freeze_ray');
      if (this.activeSlot === 'utility') this.switchSlot(this.lastWeaponSlot);
      this.emitHud();
      return;
    }

    const kind: ActiveGrenade['kind'] =
      this.utilityId === 'molotov'
        ? 'molotov'
        : this.utilityId === 'flash'
        ? 'flash'
        : this.utilityId === 'smoke'
        ? 'smoke'
        : this.utilityId === 'satchel'
        ? 'satchel'
        : this.utilityId === 'subspace_tripmine'
        ? 'tripmine'
        : 'frag';

    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    _rayDir.set(0, 0, -1).applyEuler(_euler).normalize();

    const gGeo = new THREE.SphereGeometry(0.14, 10, 10);
    const gMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive:
        kind === 'flash'
          ? 0x38bdf8
          : kind === 'molotov'
          ? 0xf59e0b
          : kind === 'tripmine'
          ? 0xec4899
          : kind === 'smoke'
          ? 0x94a3b8
          : 0xf97316,
      emissiveIntensity: 1.35,
      roughness: 0.3,
    });
    const mesh = new THREE.Mesh(gGeo, gMat);
    mesh.position.set(
      this.px + _rayDir.x * 0.65,
      this.py + this.currentEyeHeight - 0.1 + _rayDir.y * 0.5,
      this.pz + _rayDir.z * 0.65,
    );
    this.scene.add(mesh);

    this.grenades.push({
      kind,
      mesh,
      vx: _rayDir.x * (kind === 'tripmine' ? 12 : 21) + this.vx * 0.25,
      vy: _rayDir.y * (kind === 'tripmine' ? 8 : 21) + 4.5,
      vz: _rayDir.z * (kind === 'tripmine' ? 12 : 21) + this.vz * 0.25,
      fuse:
        kind === 'flash'
          ? 0.85
          : kind === 'molotov'
          ? 1.5
          : kind === 'tripmine'
          ? 18.0
          : 1.2,
      splashRadius: uSpec.splashRadius ?? 9.0,
      maxDmg: uSpec.damage || 95,
    });
    this.sound.playDash();

    if (this.activeSlot === 'utility') {
      this.switchSlot(this.lastWeaponSlot);
    }
    this.emitHud();
  }

  private detonateGrenade(
    pos: THREE.Vector3,
    kind: ActiveGrenade['kind'],
    radiusOverride?: number,
    dmgOverride?: number,
  ): void {
    if (kind === 'smoke') {
      this.sound.playDash();
      const smokeGeo = new THREE.SphereGeometry(4.4, 16, 12);
      const smokeMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.95,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      const smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
      smokeMesh.position.set(pos.x, pos.y + 1.8, pos.z);
      this.scene.add(smokeMesh);
      this.smokeClouds.push({mesh: smokeMesh, mat: smokeMat, life: 0, maxLife: 6.0});
      return;
    }

    if (kind === 'flash') {
      this.sound.playFlashbang();
      this.spawnSparkBurst(pos, [0.7, 0.95, 1.0], 24);
      const flashGeo = new THREE.SphereGeometry(1, 14, 14);
      const flashMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const flashMesh = new THREE.Mesh(flashGeo, flashMat);
      flashMesh.position.copy(pos);
      this.scene.add(flashMesh);
      this.explosionFlashes.push({mesh: flashMesh, mat: flashMat, life: 0, maxLife: 0.24});

      const blindRadius = 11.5;
      if (this.playMode === 'rivals_1p') {
        for (const bot of this.bots) {
          if (!bot.alive || bot.team === this.selfTeam) continue;
          const bPos = new THREE.Vector3(bot.x, bot.y + 1.0, bot.z);
          if (pos.distanceTo(bPos) <= blindRadius) {
            bot.blindTimer = 3.0;
            this.hitmarkerType = 'body';
            this.hitmarkerTimer = 0.22;
            this.sound.playHitmarker(false, false);
          }
        }
      }
      const selfDist = pos.distanceTo(new THREE.Vector3(this.px, this.py + 1.4, this.pz));
      if (selfDist <= 8.5) {
        this.blindedFlash = Math.min(0.85, 0.9 * (1 - selfDist / 8.5));
      }
      return;
    }

    if (kind === 'molotov') {
      this.sound.playExplosion();
      this.spawnSparkBurst(pos, [1, 0.55, 0.1], 24);
      const poolGeo = new THREE.CylinderGeometry(3.4, 3.6, 0.08, 24);
      const poolMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const poolMesh = new THREE.Mesh(poolGeo, poolMat);
      poolMesh.position.set(pos.x, 0.05, pos.z);
      this.scene.add(poolMesh);
      this.firePools.push({
        mesh: poolMesh,
        mat: poolMat,
        x: pos.x,
        y: 0.05,
        z: pos.z,
        life: 0,
        maxLife: 4.5,
        tickAccum: 0.35,
      });
      return;
    }

    this.sound.playExplosion();
    this.screenShake = Math.max(
      this.screenShake,
      Math.max(0.06, 0.35 - pos.distanceTo(this.camera.position) * 0.015),
    );
    this.spawnSparkBurst(
      pos,
      kind === 'tripmine' ? [0.95, 0.3, 0.85] : [1, 0.55, 0.15],
      28,
    );

    const flashGeo = new THREE.SphereGeometry(1, 14, 14);
    const flashMat = new THREE.MeshBasicMaterial({
      color: kind === 'tripmine' ? 0xec4899 : 0xf97316,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(pos);
    this.scene.add(flashMesh);
    this.explosionFlashes.push({mesh: flashMesh, mat: flashMat, life: 0, maxLife: 0.28});

    const radius = radiusOverride ?? 9.0;
    const maxDmg = dmgOverride ?? 95;
    const wUsed: WeaponId =
      kind === 'satchel' ? 'satchel' : kind === 'tripmine' ? 'subspace_tripmine' : 'frag';

    this.matchShots++;
    let nadeHit = false;

    if (this.playMode === 'rivals_1p') {
      const isTeam = this.isTeamMode(this.matchFormat);
      for (const bot of this.bots) {
        if (!bot.alive) continue;
        if (isTeam && bot.team === this.selfTeam) continue;
        const bPos = new THREE.Vector3(bot.x, bot.y + 1.0, bot.z);
        const dist = pos.distanceTo(bPos);
        if (dist <= radius) {
          const dmg = Math.round(maxDmg * (1 - dist / radius));
          if (dmg > 4) {
            nadeHit = true;
            const killed = this.applyHitToTarget(bot.id, dmg, false, wUsed, bPos);
            this.hitmarkerType = killed ? 'kill' : 'body';
            this.hitmarkerTimer = 0.22;
            this.sound.playHitmarker(false, killed);
          }
        }
      }
    } else if (this.playMode === 'shooting_arena') {
      for (const t of this.rangeTargets) {
        if (t.hp <= 0) continue;
        const dist = pos.distanceTo(t.rig.root.position);
        if (dist <= radius) {
          const dmg = Math.round(maxDmg * (1 - dist / radius));
          if (dmg > 4) {
            nadeHit = true;
            this.applyHitToTarget(t.id, dmg, false, wUsed, t.rig.root.position);
          }
        }
      }
    } else if (this.playMode === 'multiplayer') {
      const isTeam = this.isTeamMode(this.matchFormat);
      for (const rem of this.remoteOps.values()) {
        if (!rem.alive) continue;
        if (isTeam && rem.team === this.selfTeam) continue;
        const rPos = new THREE.Vector3(rem.targetX, rem.targetY + 1.0, rem.targetZ);
        const dist = pos.distanceTo(rPos);
        if (dist <= radius) {
          const dmg = Math.round(maxDmg * (1 - dist / radius));
          if (dmg > 4) {
            nadeHit = true;
            this.applyHitToTarget(rem.id, dmg, false, wUsed, rPos);
          }
        }
      }
    }
    if (nadeHit) this.matchHits++;

    const selfDist = pos.distanceTo(new THREE.Vector3(this.px, this.py + 0.9, this.pz));
    if (selfDist <= radius * 0.7 && this.playMode !== 'shooting_arena') {
      const selfDmg = Math.round(35 * (1 - selfDist / (radius * 0.7)));
      if (selfDmg > 3) {
        this.applyDamageToSelf(selfDmg);
      }
    }
  }

  private tryMeleeSlash(): void {
    const activeId = this.meleeId;
    const spec = WEAPONS[activeId];
    if (this.fireCooldown > 0) return;

    this.fireCooldown = 1 / spec.fireRateRps;
    this.meleeSwingTimer = 0.24;
    this.inspectTimer = 0;
    this.sound.playGunshot(activeId);

    const targets: THREE.Object3D[] = [];
    const isTeam = this.isTeamMode(this.matchFormat);
    if (this.playMode === 'rivals_1p') {
      for (const bot of this.bots) {
        if (!bot.alive) continue;
        if (isTeam && bot.team === this.selfTeam) continue;
        targets.push(bot.rig.root);
      }
    } else if (this.playMode === 'shooting_arena') {
      for (const t of this.rangeTargets) {
        if (t.hp > 0) targets.push(t.rig.root);
      }
    } else if (this.playMode === 'multiplayer') {
      for (const rem of this.remoteOps.values()) {
        if (!rem.alive) continue;
        if (isTeam && rem.team === this.selfTeam) continue;
        targets.push(rem.rig.root);
      }
    }

    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    _rayDir.set(0, 0, -1).applyEuler(_euler).normalize();
    _rayOrigin.copy(this.camera.position);

    this.raycaster.set(_rayOrigin, _rayDir);
    this.raycaster.far = spec.range;
    const hits = this.raycaster.intersectObjects(targets, true);

    this.matchShots++;
    if (hits.length > 0) {
      const hit = hits[0];
      const ud = hit.object.userData as {hitbox?: string; targetId?: string};
      if (ud && ud.targetId) {
        this.matchHits++;
        const isHead = ud.hitbox === 'head';
        let dmg = Math.round(spec.damage * (isHead ? spec.headshotMult : 1));
        if (this.matchFormat === 'double_trouble') dmg *= 2;
        if (this.warHornTimer > 0) dmg = Math.round(dmg * 1.25);
        const killed = this.applyHitToTarget(ud.targetId, dmg, isHead, activeId, hit.point);
        this.hitmarkerType = killed ? 'kill' : isHead ? 'head' : 'body';
        this.hitmarkerTimer = 0.24;
        this.sound.playHitmarker(isHead || killed, killed);
        this.spawnSparkBurst(hit.point, [1, 0.4, 0.3], 8);
      }
    }
  }

  private tryFire(): void {
    if (this.playerRespawnTimer > 0 || this.isSpectating) return;

    if (this.activeSlot === 'utility') {
      this.useUtility();
      return;
    }
    if (this.activeSlot === 'melee') {
      this.tryMeleeSlash();
      return;
    }

    const slot = this.activeSlot;
    const activeId = this.getActiveWeaponId();
    const spec = WEAPONS[activeId];

    if (this.isReloading || this.fireCooldown > 0) return;
    if (this.ammoMap[slot] <= 0) {
      this.startReload();
      return;
    }

    this.fireCooldown = 1 / spec.fireRateRps;
    if (spec.burstCount && spec.burstCount > 1) {
      this.burstRemaining = spec.burstCount - 1;
      this.burstDelay = 0.065;
    }

    this.executeSingleShot(slot, activeId);
  }

  private executeSingleShot(slot: 'primary' | 'secondary', activeId: WeaponId): void {
    const spec = WEAPONS[activeId];
    const isAuthAdmin = this.adminRole === 'owner' || this.adminRole === 'admin';
    const infAmmo = isAuthAdmin && this.adminTools.infiniteAmmo;
    const noRecoil = isAuthAdmin && this.adminTools.noRecoil;

    if (activeId !== 'freeze_ray') {
      if (!infAmmo && this.ammoMap[slot] <= 0) {
        this.burstRemaining = 0;
        this.startReload();
        return;
      }
      if (!infAmmo) {
        this.ammoMap[slot]--;
      }
    }
    this.inspectTimer = 0;
    if (!noRecoil) {
      this.recoilOffset = Math.min(0.14, this.recoilOffset + spec.recoilKick * 2.2);
      this.recoilPitch = Math.min(0.18, this.recoilPitch + spec.recoilKick);
    } else {
      this.recoilOffset = 0;
      this.recoilPitch = 0;
    }
    this.muzzleFlashTimer = 0.055;
    this.muzzlePointLight.intensity = 3.2;
    this.sound.playGunshot(activeId);

    this.matchShots++;
    if (this.playMode === 'shooting_arena') {
      this.arenaShots++;
    }

    const wallObjects = this.arena ? this.arena.shootableWalls : [];
    const targetObjects: THREE.Object3D[] = [];
    const isTeam = this.isTeamMode(this.matchFormat);
    if (this.playMode === 'rivals_1p') {
      for (const bot of this.bots) {
        if (!bot.alive) continue;
        if (isTeam && bot.team === this.selfTeam) continue;
        targetObjects.push(bot.rig.root);
      }
    } else if (this.playMode === 'shooting_arena') {
      for (const t of this.rangeTargets) {
        if (t.hp > 0) targetObjects.push(t.rig.root);
      }
    } else if (this.playMode === 'multiplayer') {
      for (const rem of this.remoteOps.values()) {
        if (!rem.alive) continue;
        if (isTeam && rem.team === this.selfTeam) continue;
        targetObjects.push(rem.rig.root);
      }
    }

    const allCastables = [...wallObjects, ...targetObjects];
    const spread = noRecoil ? 0 : this.isAds ? spec.adsSpread : spec.hipSpread;
    let bestHitMark: 'none' | 'body' | 'head' | 'kill' = 'none';

    const muzzleWorld = new THREE.Vector3();
    if (this.viewWeaponRig) {
      this.viewWeaponRig.muzzlePoint.getWorldPosition(muzzleWorld);
    } else {
      muzzleWorld.copy(this.camera.position);
    }

    const tracerColor =
      spec.archetype === 'freeze'
        ? 0x67e8f9
        : spec.archetype === 'flame'
        ? 0xf97316
        : activeId === 'exogun'
        ? 0xc084fc
        : activeId === 'longbow'
        ? 0x38bdf8
        : 0xfef08a;

    for (let p = 0; p < spec.pellets; p++) {
      _euler.set(
        this.pitch + this.recoilPitch + (Math.random() - 0.5) * spread * 2,
        this.yaw + (Math.random() - 0.5) * spread * 2,
        0,
        'YXZ',
      );
      _rayDir.set(0, 0, -1).applyEuler(_euler).normalize();
      _rayOrigin.copy(this.camera.position);

      this.raycaster.set(_rayOrigin, _rayDir);
      this.raycaster.far = spec.range;
      const hits = this.raycaster.intersectObjects(allCastables, true);

      let endPoint = _rayOrigin.clone().addScaledVector(_rayDir, spec.range * 0.65);

      if (hits.length > 0) {
        const hit = hits[0];
        endPoint = hit.point;
        const ud = hit.object.userData as {hitbox?: string; targetId?: string};

        if (spec.archetype === 'explosive') {
          this.detonateGrenade(
            hit.point,
            'frag',
            spec.splashRadius ?? 5.5,
            spec.damage * (this.matchFormat === 'double_trouble' ? 2 : 1),
          );
          if (ud && ud.targetId) bestHitMark = 'body';
        } else if (ud && ud.targetId) {
          const isHead = ud.hitbox === 'head';
          if (this.privateConfig.isPrivate && this.privateConfig.headshotsOnly && !isHead) {
            this.spawnSparkBurst(hit.point, [0.7, 0.85, 1], 4);
          } else {
            let dmg = Math.round(spec.damage * (isHead ? spec.headshotMult : 1));
            if (this.matchFormat === 'double_trouble') dmg *= 2;
            if (this.warHornTimer > 0) dmg = Math.round(dmg * 1.25);

            const killed = this.applyHitToTarget(ud.targetId, dmg, isHead, activeId, hit.point);
            if (killed) bestHitMark = 'kill';
            else if (isHead && bestHitMark !== 'kill') bestHitMark = 'head';
            else if (bestHitMark === 'none') bestHitMark = 'body';

            this.spawnSparkBurst(
              hit.point,
              spec.archetype === 'freeze'
                ? [0.4, 0.92, 1.0]
                : isHead
                ? [1, 0.78, 0.2]
                : [1, 0.35, 0.35],
              7,
            );
          }
        } else {
          this.spawnSparkBurst(hit.point, [0.95, 0.85, 0.6], 5);
        }
      } else if (spec.archetype === 'explosive') {
        this.detonateGrenade(endPoint, 'frag', spec.splashRadius ?? 5.5, spec.damage);
      }

      this.spawnTracer(muzzleWorld, endPoint, tracerColor);

      if (this.playMode === 'multiplayer' && p === 0) {
        this.callbacks.onSendNetShoot?.({
          origin: [muzzleWorld.x, muzzleWorld.y, muzzleWorld.z],
          hitPoint: [endPoint.x, endPoint.y, endPoint.z],
          weaponId: activeId,
        });
      }
    }

    if (bestHitMark !== 'none') {
      this.matchHits++;
      this.hitmarkerType = bestHitMark;
      this.hitmarkerTimer = bestHitMark === 'kill' ? 0.28 : 0.16;
      this.sound.playHitmarker(bestHitMark === 'head' || bestHitMark === 'kill', bestHitMark === 'kill');
    }

    if (!infAmmo && activeId !== 'freeze_ray' && this.ammoMap[slot] === 0) {
      this.burstRemaining = 0;
      this.startReload();
    }
  }

  private spawnFinisherEffect(worldPos: THREE.Vector3): void {
    const spec = FINISHERS[this.finisherId] ?? FINISHERS.finisher_default;
    const color = new THREE.Color(spec.colorHex);
    this.spawnSparkBurst(worldPos, [color.r, color.g, color.b], 34);

    if (this.finisherId === 'finisher_default') return;

    const geo =
      this.finisherId === 'finisher_lightning'
        ? new THREE.CylinderGeometry(0.35, 0.55, 16, 12)
        : new THREE.SphereGeometry(1.1, 16, 14);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(worldPos);
    if (this.finisherId === 'finisher_lightning') mesh.position.y += 7;
    this.scene.add(mesh);
    this.explosionFlashes.push({mesh, mat, life: 0, maxLife: 0.42});
  }

  private emitDamageNumber(worldPos: THREE.Vector3, amount: number, crit: boolean): void {
    if (!this.callbacks.onDamageNumber) return;
    _projVec.copy(worldPos);
    _projVec.project(this.camera);
    if (_projVec.z > 1) return;
    const x = Math.max(8, Math.min(92, (_projVec.x * 0.5 + 0.5) * 100));
    const y = Math.max(8, Math.min(92, (-_projVec.y * 0.5 + 0.5) * 100));
    this.callbacks.onDamageNumber({
      id: this.dmgCounter++,
      x,
      y,
      amount,
      crit,
    });
  }

  private applyHitToTarget(
    targetId: string,
    damage: number,
    headshot: boolean,
    weaponId: WeaponId,
    hitWorldPos?: THREE.Vector3,
  ): boolean {
    if (hitWorldPos) {
      this.emitDamageNumber(hitWorldPos, damage, headshot);
    }

    this.matchDamage += damage;
    recordCareerDelta({damageDealt: damage});

    if (this.playMode === 'rivals_1p') {
      const bot = this.bots.find((b) => b.id === targetId);
      if (!bot || !bot.alive) return false;
      if (this.isTeamMode(this.matchFormat) && bot.team === this.selfTeam) return false;

      if (WEAPONS[weaponId]?.archetype === 'freeze') {
        bot.chillTimer = 1.8;
      }

      bot.hp = Math.max(0, bot.hp - damage);
      if (bot.hp <= 0) {
        bot.alive = false;
        bot.deaths += 1;
        bot.rig.root.visible = false;
        this.spawnFinisherEffect(new THREE.Vector3(bot.x, bot.y + 1.0, bot.z));

        this.matchKills++;
        this.killStreak++;
        if (this.killStreak >= 2) {
          this.killStreakBanner =
            this.killStreak === 2
              ? 'DOUBLE KILL!'
              : this.killStreak === 3
              ? 'TRIPLE KILL!'
              : this.killStreak === 4
              ? 'RAMPAGE!'
              : `UNSTOPPABLE x${this.killStreak}!`;
          this.killStreakBannerTimer = 2.4;
        }
        if (headshot) this.matchHeadshots++;
        this.hitstopTimer = 0.035;
        this.screenShake = 0.22;

        // Drop enemy flag if carried
        if (this.ctfAlphaCarrier === bot.id) {
          this.ctfAlphaCarrier = null;
          if (this.arena?.ctfFlags) {
            this.arena.ctfFlags.alphaMesh.position.copy(this.arena.ctfFlags.alphaBase);
          }
        }

        const ptsEarned = bot.isHoncho ? 3 : 1;
        if (this.matchFormat === 'gun_game') {
          this.gunGameStep += 1;
          this.playerScore = this.gunGameStep;
          this.rebuildWrapAndWeapon();
          const nextW = this.getEffectivePrimaryId();
          this.ammoMap.primary = WEAPONS[nextW].magSize;
        } else if (!this.isRoundBasedMode(this.matchFormat)) {
          if (
            this.matchFormat === 'tdm_2v2' ||
            this.matchFormat === 'tdm_4v4' ||
            this.matchFormat === 'threeway_1v1v1' ||
            this.matchFormat === 'threeway_2v2v2' ||
            this.matchFormat === 'head_honcho' ||
            this.matchFormat === 'double_trouble'
          ) {
            this.teamScores.alpha += ptsEarned;
            this.playerScore = this.teamScores.alpha;
          } else if (this.matchFormat === 'ffa') {
            this.playerScore += 1;
          }
        }

        recordCareerDelta({kills: 1, headshots: headshot ? 1 : 0});
        this.callbacks.onCareerUpdated();
        this.callbacks.onKillFeed({
          id: this.killFeedCounter++,
          attacker: 'You',
          victim: bot.name,
          attackerTeam: this.selfTeam,
          victimTeam: bot.team,
          weapon: WEAPONS[weaponId].name,
          headshot,
        });
        this.sound.playRoundBanner(true);

        const aliveHostiles = this.bots.filter(
          (b) => b.alive && (!this.isTeamMode(this.matchFormat) || b.team !== this.selfTeam),
        ).length;

        if (this.matchFormat === 'royale') {
          if (aliveHostiles === 0) {
            this.playerScore = 1;
            this.finishRivalsMatch(true);
          }
          return true;
        }

        if (this.matchFormat === 'pve_tower') {
          if (aliveHostiles === 0) {
            if (this.pveWave >= this.pveMaxWaves) {
              this.playerScore = this.pveMaxWaves;
              this.finishRivalsMatch(true);
            } else {
              this.playerScore = this.pveWave;
              this.pveWave += 1;
              for (const b of this.bots) {
                if (b.team !== this.selfTeam) {
                  b.maxHp += 25;
                }
              }
              this.roundNumber = this.pveWave;
              this.roundBanner = `TOWER WAVE ${this.pveWave} / ${this.pveMaxWaves}`;
              this.roundResetTimer = 1.8;
            }
          }
          return true;
        }

        if (this.isRoundBasedMode(this.matchFormat)) {
          if (aliveHostiles === 0) {
            this.playerScore += 1;
            this.teamScores.alpha = this.playerScore;
            if (this.playerScore >= this.targetScore) {
              this.finishRivalsMatch(true);
            } else {
              this.roundNumber++;
              this.roundBanner = 'ROUND WON';
              this.roundResetTimer = 1.6;
            }
          }
        } else {
          // Respawn modes (FFA, TDM, Gun Game, Head Honcho, Double Trouble, CTF, Domination, 3-Way)
          bot.respawnTimer = 1.8;
          if (
            this.matchFormat !== 'ctf' &&
            this.matchFormat !== 'domination' &&
            this.playerScore >= this.targetScore
          ) {
            this.finishRivalsMatch(true);
          }
        }
        return true;
      }
      this.callbacks.onCareerUpdated();
      return false;
    }

    if (this.playMode === 'shooting_arena') {
      const target = this.rangeTargets.find((t) => t.id === targetId);
      if (!target || target.hp <= 0) return false;
      this.arenaHits++;
      target.hitFlash = 0.18;
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp <= 0) {
        target.rig.root.visible = false;
        target.respawnTimer = 1.25;
        this.arenaStreak++;
        const pts = (headshot ? 200 : 100) + Math.min(100, this.arenaStreak * 15);
        this.arenaScore += pts;
        this.matchKills++;
        if (headshot) this.matchHeadshots++;
        recordCareerDelta({
          kills: 1,
          headshots: headshot ? 1 : 0,
          arenaScoreAdd: pts,
          arenaRunScore: this.arenaScore,
        });
        this.callbacks.onCareerUpdated();
        return true;
      }
      this.callbacks.onCareerUpdated();
      return false;
    }

    if (this.playMode === 'multiplayer') {
      const isTeam = this.isTeamMode(this.matchFormat);
      const rem = this.remoteOps.get(targetId);
      if (isTeam && rem && rem.team === this.selfTeam) {
        return false;
      }
      this.callbacks.onSendNetHit?.({targetId, damage, headshot});
      this.callbacks.onCareerUpdated();
      return false;
    }

    return false;
  }

  private applyDamageToSelf(dmg: number): void {
    if ((this.adminRole === 'owner' || this.adminRole === 'admin') && this.adminTools.godMode) {
      this.hp = 100;
      this.shield = 50;
      return;
    }
    const effectiveDmg =
      this.activeSlot === 'melee' && this.meleeId === 'riot_shield'
        ? Math.max(1, Math.round(dmg * 0.45))
        : dmg;
    this.outOfCombatTimer = 0;
    let rem = effectiveDmg;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, rem);
      this.shield -= absorbed;
      rem -= absorbed;
    }
    if (rem > 0) {
      this.hp = Math.max(0, this.hp - rem);
    }
    this.damageFlash = 0.85;
    this.cinematicAberration = Math.min(1, this.cinematicAberration + 0.65);
    this.screenShake = Math.max(this.screenShake, 0.22);
    this.sound.playDamageTaken();
  }

  private sampleKillCamFrame(): void {
    if (this.playMode !== 'rivals_1p' && this.playMode !== 'multiplayer') return;
    let ox = 0;
    let oy = 0;
    let oz = -18;
    let shotFired = false;

    if (this.playMode === 'rivals_1p') {
      const refBot = this.lastBotAttacker ?? this.bots.find((b) => b.team !== this.selfTeam) ?? this.bots[0];
      if (refBot) {
        ox = refBot.x;
        oy = refBot.y;
        oz = refBot.z;
      }
      shotFired = this.botShotPending;
      this.botShotPending = false;
    } else {
      const attacker =
        (this.lastAttackerId ? this.remoteOps.get(this.lastAttackerId) : undefined) ||
        this.remoteOps.values().next().value;
      if (attacker) {
        ox = attacker.targetX;
        oy = attacker.targetY;
        oz = attacker.targetZ;
      }
      shotFired = this.netShotPending;
      this.netShotPending = false;
    }

    const dx = this.px - ox;
    const dz = this.pz - oz;
    const oyaw = Math.atan2(-dx, -dz);
    const opitch = Math.atan2(this.py + 1.42 - (oy + 1.54), Math.max(0.25, Math.hypot(dx, dz)));

    this.killCamBuffer.push({
      t: performance.now() / 1000,
      px: this.px,
      py: this.py,
      pz: this.pz,
      pyaw: this.yaw,
      ox,
      oy,
      oz,
      oyaw,
      opitch,
      shotFired,
    });

    if (this.killCamBuffer.length > 70) {
      this.killCamBuffer.shift();
    }
  }

  private captureKillCam(attackerName: string, weaponName: string, headshot: boolean): void {
    this.sampleKillCamFrame();
    if (this.killCamBuffer.length < 2) return;
    this.lastDeathFrames = this.killCamBuffer.map((f) => ({...f}));
    this.lastKillCamInfo = {
      attackerName,
      weaponName,
      headshot,
      durationSec: 3.2,
    };
  }

  public hasKillCam(): boolean {
    return this.lastDeathFrames.length >= 2 && this.lastKillCamInfo !== null;
  }

  public startKillCamReplay(summary?: MatchOverSummary): boolean {
    if (summary) this.pendingMatchSummary = summary;
    if (!this.hasKillCam() || !this.lastKillCamInfo) return false;

    this.matchEnded = true;
    this.releasePointerLock();
    this.clearEspBoxes();
    this.isPlayingKillCam = true;
    this.killCamElapsed = 0;
    this.killCamLastShotIdx = -1;
    this.viewModelGroup.visible = false;

    if (this.killCamSelfRig) {
      this.scene.remove(this.killCamSelfRig.root);
      this.killCamSelfRig.dispose();
    }
    const skin = OPERATOR_SKINS[this.skinId] ?? OPERATOR_SKINS.default_slate;
    const pCol = Number.parseInt(skin.primaryHex.replace('#', ''), 16);
    const vCol = Number.parseInt(skin.visorHex.replace('#', ''), 16);
    this.killCamSelfRig = createOperatorRig('killcam_victim', pCol, vCol);
    this.scene.add(this.killCamSelfRig.root);

    for (const b of this.bots) b.rig.root.visible = false;
    for (const rem of this.remoteOps.values()) {
      rem.rig.root.visible = false;
    }

    this.callbacks.onKillCamStart?.(this.lastKillCamInfo);
    return true;
  }

  public skipKillCam(): void {
    this.stopKillCam(false);
  }

  private stopKillCam(silent: boolean): void {
    if (!this.isPlayingKillCam) return;
    this.isPlayingKillCam = false;
    if (this.killCamSelfRig) {
      this.scene.remove(this.killCamSelfRig.root);
      this.killCamSelfRig.dispose();
      this.killCamSelfRig = null;
    }
    if (!silent && this.pendingMatchSummary) {
      this.callbacks.onMatchOver(this.pendingMatchSummary);
    }
  }

  public buildMatchSummary(
    victory: boolean,
    mode: PlayMode,
    playerScoreOverride?: number,
    rivalScoreOverride?: number,
    extra?: {
      teamScores?: {alpha: number; bravo: number; charlie?: number};
      winnerTeam?: TeamId | null;
      leaderboard?: MatchLeaderboardRow[];
    },
  ): MatchOverSummary {
    const pScore = playerScoreOverride ?? this.playerScore;
    const rScore = rivalScoreOverride ?? this.rivalScore;
    const kills = mode === 'multiplayer' ? Math.max(this.matchKills, pScore) : this.matchKills;
    const deaths = this.matchDeaths;
    const kdRatio = Number((kills / Math.max(1, deaths)).toFixed(2));
    const shotsFired = mode === 'shooting_arena' ? this.arenaShots : this.matchShots;
    const shotsHit = mode === 'shooting_arena' ? this.arenaHits : this.matchHits;
    const accuracyPct =
      shotsFired > 0 ? Math.min(100, Math.round((shotsHit / shotsFired) * 100)) : 100;

    const matchTotalScore =
      mode === 'shooting_arena'
        ? this.arenaScore + kills * 25 + this.matchHeadshots * 50
        : pScore * 250 +
          kills * 100 +
          this.matchHeadshots * 75 +
          Math.round(this.matchDamage * 0.5) +
          (victory ? 500 : 0);

    const sessionTotalScore = addSessionScore(matchTotalScore);
    const creditsEarned = Math.max(1, Math.round(matchTotalScore / 350) + (victory ? 2 : 0));

    recordCareerDelta({
      credits: creditsEarned,
      rivalsWins: victory && mode !== 'shooting_arena' ? 1 : 0,
      matchWon: victory && mode !== 'shooting_arena',
      matchLost: !victory && mode !== 'shooting_arena',
    });

    const prog = grantMatchRewards({
      victory,
      mode,
      matchFormat: this.matchFormat,
      isRanked: this.isRankedMatch,
      kills,
      matchTotalScore,
    });
    this.callbacks.onCareerUpdated();

    const offlineLeaderboard: MatchLeaderboardRow[] | undefined =
      mode === 'rivals_1p'
        ? [
            {
              id: 'self',
              name: 'You',
              team: this.selfTeam,
              kills,
              deaths,
              damage: this.matchDamage,
              score: matchTotalScore,
              isSelf: true,
              alive: true,
            },
            ...this.bots.map((b) => ({
              id: b.id,
              name: b.name,
              team: b.team,
              kills: b.kills,
              deaths: b.deaths,
              damage: b.damage,
              score: b.kills * 220 + Math.round(b.damage * 0.4),
              alive: b.alive,
            })),
          ].sort((a, b) => b.score - a.score || b.kills - a.kills)
        : undefined;

    const isMvp = victory || mode === 'shooting_arena' || kdRatio >= 1.5;
    const mvpTitle =
      mode === 'shooting_arena'
        ? 'ARENA SHARPSHOOTER'
        : victory
        ? this.isRankedMatch
          ? 'RANKED MVP'
          : 'MATCH MVP'
        : kdRatio >= 1.5
        ? 'COMBAT STANDOUT'
        : 'RIVAL CHALLENGER';

    return {
      victory,
      playerScore: pScore,
      rivalScore: rScore,
      mode,
      matchFormat: this.matchFormat,
      mapId: this.selectedMap,
      isRanked: this.isRankedMatch,
      rrDelta: prog.rrDelta,
      keysEarned: prog.keysEarned,
      xpEarned: prog.xpEarned,
      selfTeam: this.selfTeam,
      teamScores: extra?.teamScores ?? this.teamScores,
      winnerTeam: extra?.winnerTeam ?? null,
      leaderboard: extra?.leaderboard ?? offlineLeaderboard,
      arenaScore: mode === 'shooting_arena' ? this.arenaScore : undefined,
      kills,
      deaths,
      kdRatio,
      headshots: this.matchHeadshots,
      shotsFired,
      shotsHit,
      accuracyPct,
      damageDealt: this.matchDamage,
      matchTotalScore,
      sessionTotalScore,
      creditsEarned,
      isMvp,
      mvpTitle,
      hasKillCam: this.hasKillCam(),
    };
  }

  private finishRivalsMatch(victory: boolean): void {
    this.matchEnded = true;
    this.releasePointerLock();
    const summary = this.buildMatchSummary(victory, this.playMode);
    if (this.hasKillCam() && this.startKillCamReplay(summary)) {
      return;
    }
    this.callbacks.onMatchOver(summary);
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3, colorHex: number): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.88,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({line, mat, life: 0, maxLife: 0.085});
  }

  private spawnSparkBurst(point: THREE.Vector3, rgb: [number, number, number], count: number): void {
    if (!this.gpuSettings.particles) return;
    for (let i = 0; i < count; i++) {
      const slot = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % this.maxSparks;
      slot.active = true;
      slot.x = point.x;
      slot.y = point.y;
      slot.z = point.z;
      slot.vx = (Math.random() - 0.5) * 9;
      slot.vy = 1.5 + Math.random() * 5.5;
      slot.vz = (Math.random() - 0.5) * 9;
      slot.life = 0;
      slot.maxLife = 0.24 + Math.random() * 0.16;
      slot.r = rgb[0];
      slot.g = rgb[1];
      slot.b = rgb[2];
    }
  }

  private stepGrenades(dt: number): void {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;

      if (!g.armed) {
        g.vy -= 18 * dt;
        g.mesh.position.x += g.vx * dt;
        g.mesh.position.y += g.vy * dt;
        g.mesh.position.z += g.vz * dt;
        g.mesh.rotation.x += dt * 8;
        g.mesh.rotation.z += dt * 6;

        if (g.mesh.position.y <= 0.14) {
          g.mesh.position.y = 0.14;
          if (g.kind === 'molotov' || g.kind === 'smoke') {
            g.fuse = 0;
          } else if (g.kind === 'tripmine') {
            g.armed = true;
            g.vx = 0;
            g.vy = 0;
            g.vz = 0;
          } else {
            g.vy = Math.abs(g.vy) * 0.45;
            g.vx *= 0.72;
            g.vz *= 0.72;
          }
        }

        if (this.arena) {
          for (const c of this.arena.colliders) {
            if (
              g.mesh.position.x > c.minX - 0.14 &&
              g.mesh.position.x < c.maxX + 0.14 &&
              g.mesh.position.y > c.minY - 0.14 &&
              g.mesh.position.y < c.maxY + 0.14 &&
              g.mesh.position.z > c.minZ - 0.14 &&
              g.mesh.position.z < c.maxZ + 0.14
            ) {
              g.vx *= -0.5;
              g.vz *= -0.5;
              g.vy = Math.max(1.2, Math.abs(g.vy) * 0.4);
              break;
            }
          }
        }
      } else if (g.kind === 'tripmine') {
        // Proximity trigger when rival walks within 3.2m
        for (const bot of this.bots) {
          if (!bot.alive || bot.team === this.selfTeam) continue;
          if (Math.hypot(bot.x - g.mesh.position.x, bot.z - g.mesh.position.z) < 3.2) {
            g.fuse = 0;
            break;
          }
        }
      }

      if (g.fuse <= 0) {
        const pos = g.mesh.position.clone();
        const kind = g.kind;
        const rad = g.splashRadius;
        const dmg = g.maxDmg;
        this.scene.remove(g.mesh);
        g.mesh.geometry.dispose();
        (g.mesh.material as THREE.Material).dispose();
        this.grenades.splice(i, 1);
        this.detonateGrenade(pos, kind, rad, dmg);
      }
    }

    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const sm = this.smokeClouds[i];
      sm.life += dt;
      if (sm.life >= sm.maxLife) {
        this.scene.remove(sm.mesh);
        sm.mesh.geometry.dispose();
        sm.mat.dispose();
        this.smokeClouds.splice(i, 1);
      } else if (sm.life > sm.maxLife - 1.2) {
        sm.mat.opacity = 0.78 * ((sm.maxLife - sm.life) / 1.2);
      }
    }

    for (let i = this.deployedPads.length - 1; i >= 0; i--) {
      const dp = this.deployedPads[i];
      dp.life -= dt;
      if (Math.hypot(this.px - dp.x, this.pz - dp.z) < 1.8 && Math.abs(this.py - dp.y) < 0.8) {
        this.vy = 13.5;
        this.grounded = false;
        this.sound.playDash();
      }
      if (dp.life <= 0) {
        this.scene.remove(dp.mesh);
        dp.mesh.geometry.dispose();
        (dp.mesh.material as THREE.Material).dispose();
        this.deployedPads.splice(i, 1);
      }
    }

    for (let i = this.firePools.length - 1; i >= 0; i--) {
      const fp = this.firePools[i];
      fp.life += dt;
      fp.tickAccum += dt;
      if (fp.life >= fp.maxLife) {
        this.scene.remove(fp.mesh);
        fp.mesh.geometry.dispose();
        fp.mat.dispose();
        this.firePools.splice(i, 1);
        continue;
      }
      fp.mat.opacity = 0.55 * (1 - fp.life / fp.maxLife);
      if (fp.tickAccum >= 0.35) {
        fp.tickAccum = 0;
        const isTeam = this.isTeamMode(this.matchFormat);
        if (this.playMode === 'rivals_1p') {
          for (const bot of this.bots) {
            if (!bot.alive || (isTeam && bot.team === this.selfTeam)) continue;
            if (Math.hypot(bot.x - fp.x, bot.z - fp.z) <= 3.7 && bot.y < 1.2) {
              const bPos = new THREE.Vector3(bot.x, bot.y + 1.0, bot.z);
              const killed = this.applyHitToTarget(bot.id, 14, false, 'molotov', bPos);
              this.hitmarkerType = killed ? 'kill' : 'body';
              this.hitmarkerTimer = 0.16;
              this.sound.playHitmarker(false, killed);
            }
          }
        } else if (this.playMode === 'multiplayer') {
          for (const rem of this.remoteOps.values()) {
            if (!rem.alive || (isTeam && rem.team === this.selfTeam)) continue;
            if (Math.hypot(rem.targetX - fp.x, rem.targetZ - fp.z) <= 3.7 && rem.targetY < 1.2) {
              this.applyHitToTarget(
                rem.id,
                14,
                false,
                'molotov',
                new THREE.Vector3(rem.targetX, rem.targetY + 1, rem.targetZ),
              );
            }
          }
        }
        if (
          Math.hypot(this.px - fp.x, this.pz - fp.z) <= 3.5 &&
          this.py < 1.1 &&
          this.playMode !== 'shooting_arena'
        ) {
          this.applyDamageToSelf(6);
        }
      }
    }

    for (let i = this.explosionFlashes.length - 1; i >= 0; i--) {
      const f = this.explosionFlashes[i];
      f.life += dt;
      if (f.life >= f.maxLife) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mat.dispose();
        this.explosionFlashes.splice(i, 1);
      } else {
        const t = f.life / f.maxLife;
        f.mesh.scale.setScalar(0.5 + t * 5.2);
        f.mat.opacity = 0.6 * (1 - t);
      }
    }
  }

  private stepSpectatorCamera(dt: number): void {
    const candidates: {x: number; y: number; z: number; yaw: number}[] = [];
    for (const rem of this.remoteOps.values()) {
      if (rem.alive && !rem.spectator) {
        candidates.push({x: rem.targetX, y: rem.targetY, z: rem.targetZ, yaw: rem.targetYaw});
      }
    }
    for (const b of this.bots) {
      if (b.alive) candidates.push({x: b.x, y: b.y, z: b.z, yaw: b.yaw});
    }
    if (candidates.length === 0) {
      this.camera.position.set(0, 14, 24);
      this.camera.lookAt(0, 1.5, 0);
      return;
    }
    const tgt = candidates[this.spectateIdx % candidates.length];
    const dist = 4.2;
    const cx = tgt.x + Math.sin(tgt.yaw) * dist;
    const cz = tgt.z + Math.cos(tgt.yaw) * dist;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, cx, 8, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, tgt.y + 2.6, 8, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, cz, 8, dt);
    this.camera.lookAt(tgt.x, tgt.y + 1.4, tgt.z);
  }

  private stepPlayerMovement(dt: number): void {
    if (!this.arena) return;
    const spec = WEAPONS[this.getActiveWeaponId()];

    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.dashBurstTimer > 0) this.dashBurstTimer = Math.max(0, this.dashBurstTimer - dt);
    if (this.slideCooldown > 0) this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    if (this.slideTimer > 0) this.slideTimer = Math.max(0, this.slideTimer - dt);
    if (this.playerChilledTimer > 0) this.playerChilledTimer = Math.max(0, this.playerChilledTimer - dt);
    if (this.warHornTimer > 0) this.warHornTimer = Math.max(0, this.warHornTimer - dt);

    const crouchHeld =
      this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.keys.has('ControlRight');
    this.isCrouching = crouchHeld && this.slideTimer <= 0;

    const isAuthAdmin = this.adminRole === 'owner' || this.adminRole === 'admin';
    const adminMult = isAuthAdmin && this.adminTools.speedBoost ? 1.65 : 1.0;
    const modeSpeedMult = this.matchFormat === 'double_trouble' ? 1.22 : 1.0;
    const chillMult = this.playerChilledTimer > 0 ? 0.65 : 1.0;
    const hornMult = this.warHornTimer > 0 ? 1.3 : 1.0;

    const sprinting = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && !this.isCrouching;
    const baseSpeed =
      (this.dashBurstTimer > 0
        ? 22.0
        : this.slideTimer > 0
        ? 15.8
        : this.isCrouching
        ? 4.6
        : sprinting && !this.isAds
        ? 10.6
        : this.isAds
        ? 5.6
        : 8.2) *
      spec.moveMult *
      adminMult *
      modeSpeedMult *
      chillMult *
      hornMult;

    let moveFwd =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    let moveRight =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);

    moveFwd += this.touchMoveY;
    moveRight += this.touchMoveX;

    const mag = Math.hypot(moveFwd, moveRight);
    if (mag > 1) {
      moveFwd /= mag;
      moveRight /= mag;
    }

    if (this.slideTimer > 0) {
      this.vx = THREE.MathUtils.damp(this.vx, this.slideDirX * 15.5, 4, dt);
      this.vz = THREE.MathUtils.damp(this.vz, this.slideDirZ * 15.5, 4, dt);
    } else {
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);
      const wishX = -sinY * moveFwd + cosY * moveRight;
      const wishZ = -cosY * moveFwd - sinY * moveRight;

      const accel = this.grounded ? 16 : 5;
      this.vx += (wishX * baseSpeed - this.vx) * Math.min(1, accel * dt);
      this.vz += (wishZ * baseSpeed - this.vz) * Math.min(1, accel * dt);
    }

    if (this.grounded) {
      this.coyoteTimer = 0.11;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      if (this.coyoteTimer > 0) {
        this.vy = 8.4;
        this.grounded = false;
        this.slideTimer = 0;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      }
    }

    for (const pad of this.arena.jumpPads) {
      if (Math.hypot(this.px - pad.x, this.pz - pad.z) < pad.radius && this.py < 0.8) {
        this.vy = pad.boostVy;
        this.grounded = false;
        this.sound.playDash();
      }
    }

    const grav = this.privateConfig.isPrivate && this.privateConfig.lowGravity ? 11.0 : 22.0;
    this.vy -= grav * dt;

    const radius = 0.48;
    const playerHeight = this.slideTimer > 0 || this.isCrouching ? 1.15 : 1.75;

    this.px += this.vx * dt;
    this.resolveHorizontalCollisions(radius, playerHeight, 'x');

    this.pz += this.vz * dt;
    this.resolveHorizontalCollisions(radius, playerHeight, 'z');

    this.py += this.vy * dt;
    let floorY = 0;

    for (const r of this.arena.ramps) {
      if (this.px >= r.minX && this.px <= r.maxX && this.pz >= r.minZ && this.pz <= r.maxZ) {
        const coord = r.axis === 'x' ? this.px : this.pz;
        const t = Math.max(0, Math.min(1, (coord - r.lowCoord) / (r.highCoord - r.lowCoord)));
        floorY = Math.max(floorY, r.lowY + (r.highY - r.lowY) * t);
      }
    }

    for (const c of this.arena.colliders) {
      if (
        this.px + radius > c.minX &&
        this.px - radius < c.maxX &&
        this.pz + radius > c.minZ &&
        this.pz - radius < c.maxZ &&
        this.py >= c.maxY - 0.55
      ) {
        floorY = Math.max(floorY, c.maxY);
      }
    }

    if (this.py <= floorY) {
      this.py = floorY;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    if (this.grounded && mag > 0.1 && this.slideTimer <= 0) {
      this.walkBobPhase += dt * (sprinting ? 14 : 9.5);
    }

    const targetEye = this.slideTimer > 0 ? 0.92 : this.isCrouching ? 1.04 : 1.62;
    this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 16, dt);

    const allowBob = this.gpuSettings.cameraBob ?? true;
    const shakeX = allowBob && this.screenShake > 0.002 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = allowBob && this.screenShake > 0.002 ? (Math.random() - 0.5) * this.screenShake : 0;
    this.screenShake *= Math.exp(-12 * dt);

    this.camera.position.set(this.px + shakeX, this.py + this.currentEyeHeight + shakeY, this.pz);
    _euler.set(this.pitch + this.recoilPitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    const targetFov = this.isAds ? spec.adsFov : this.gpuSettings.fov + (this.slideTimer > 0 ? 5 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
      this.camera.updateProjectionMatrix();
    }

    this.recoilOffset = THREE.MathUtils.damp(this.recoilOffset, 0, 14, dt);
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 12, dt);

    const bobX = allowBob ? Math.cos(this.walkBobPhase) * (this.isAds ? 0.003 : 0.012) : 0;
    const bobY = allowBob ? Math.abs(Math.sin(this.walkBobPhase)) * (this.isAds ? 0.003 : 0.014) : 0;
    const targetVmX = this.isAds ? 0 : 0.24;
    const targetVmY = this.isAds ? -0.155 : -0.21;
    const targetVmZ = (this.isAds ? -0.34 : -0.42) + this.recoilOffset;
    const reloadDip =
      this.isReloading && spec.reloadSec > 0
        ? Math.sin((this.reloadTimer / spec.reloadSec) * Math.PI) * 0.25
        : 0;
    const meleeSweep = this.meleeSwingTimer > 0 ? Math.sin((this.meleeSwingTimer / 0.24) * Math.PI) : 0;
    const inspectAmt = this.inspectTimer > 0 ? Math.sin((this.inspectTimer / 1.1) * Math.PI) : 0;

    this.viewModelGroup.position.x = THREE.MathUtils.damp(
      this.viewModelGroup.position.x,
      targetVmX + bobX - meleeSweep * 0.22 - inspectAmt * 0.08,
      16,
      dt,
    );
    this.viewModelGroup.position.y = THREE.MathUtils.damp(
      this.viewModelGroup.position.y,
      targetVmY - bobY - reloadDip + meleeSweep * 0.06 + inspectAmt * 0.04,
      16,
      dt,
    );
    this.viewModelGroup.position.z = THREE.MathUtils.damp(
      this.viewModelGroup.position.z,
      targetVmZ - meleeSweep * 0.16,
      20,
      dt,
    );
    const emotePhase = this.viewEmoteTimer > 0 ? 1 - this.viewEmoteTimer / 1.25 : 0;
    const emoteSpin = this.viewEmoteTimer > 0 ? Math.sin(emotePhase * Math.PI * 2) : 0;
    this.viewModelGroup.rotation.x =
      this.recoilPitch * 1.6 - reloadDip * 1.4 - meleeSweep * 0.85 + emoteSpin * 0.45;
    this.viewModelGroup.rotation.y =
      inspectAmt * 0.72 + meleeSweep * 0.6 + (this.viewEmoteTimer > 0 ? emotePhase * Math.PI * 2 : 0);
    this.viewModelGroup.rotation.z =
      inspectAmt * 0.28 + (this.slideTimer > 0 ? 0.12 : 0) + emoteSpin * 0.35;
  }

  private resolveHorizontalCollisions(radius: number, height: number, axis: 'x' | 'z'): void {
    if (!this.arena) return;
    for (const c of this.arena.colliders) {
      if (this.py + 0.55 >= c.maxY || this.py + height <= c.minY) continue;
      if (
        this.px + radius > c.minX &&
        this.px - radius < c.maxX &&
        this.pz + radius > c.minZ &&
        this.pz - radius < c.maxZ
      ) {
        if (axis === 'x') {
          if (this.vx > 0) this.px = c.minX - radius;
          else if (this.vx < 0) this.px = c.maxX + radius;
          this.vx = 0;
        } else {
          if (this.vz > 0) this.pz = c.minZ - radius;
          else if (this.vz < 0) this.pz = c.maxZ + radius;
          this.vz = 0;
        }
      }
    }
  }

  private stepModeObjectives(dt: number): void {
    if (!this.arena || this.matchEnded) return;

    // 1. Capture the Flag
    if (this.matchFormat === 'ctf' && this.arena.ctfFlags) {
      const flags = this.arena.ctfFlags;
      if (!this.ctfBravoCarrier && this.playerRespawnTimer <= 0) {
        if (Math.hypot(this.px - flags.bravoBase.x, this.pz - flags.bravoBase.z) < 2.2) {
          this.ctfBravoCarrier = 'You';
          this.sound.playHeal();
          this.roundBanner = 'ENEMY FLAG CAPTURED — RETURN TO ALPHA BASE!';
          this.roundResetTimer = 2.0;
        }
      }
      if (this.ctfBravoCarrier === 'You') {
        flags.bravoMesh.position.set(this.px, this.py + 0.5, this.pz);
        if (Math.hypot(this.px - flags.alphaBase.x, this.pz - flags.alphaBase.z) < 2.4) {
          this.ctfBravoCarrier = null;
          flags.bravoMesh.position.copy(flags.bravoBase);
          this.teamScores.alpha += 1;
          this.playerScore = this.teamScores.alpha;
          this.sound.playRoundBanner(true);
          if (this.teamScores.alpha >= this.targetScore) {
            this.finishRivalsMatch(true);
            return;
          }
        }
      }
      // Bravo bot attempts Alpha flag
      for (const bot of this.bots) {
        if (!bot.alive || bot.team !== 'bravo') continue;
        if (!this.ctfAlphaCarrier && Math.hypot(bot.x - flags.alphaBase.x, bot.z - flags.alphaBase.z) < 2.0) {
          this.ctfAlphaCarrier = bot.id;
        }
        if (this.ctfAlphaCarrier === bot.id) {
          flags.alphaMesh.position.set(bot.x, bot.y + 0.5, bot.z);
          if (Math.hypot(bot.x - flags.bravoBase.x, bot.z - flags.bravoBase.z) < 2.2) {
            this.ctfAlphaCarrier = null;
            flags.alphaMesh.position.copy(flags.alphaBase);
            this.teamScores.bravo += 1;
            this.rivalScore = this.teamScores.bravo;
            this.sound.playRoundBanner(false);
            if (this.teamScores.bravo >= this.targetScore) {
              this.finishRivalsMatch(false);
              return;
            }
          }
        }
      }
    }

    // 2. Domination A / B / C
    if (this.matchFormat === 'domination' && this.arena.domZones) {
      for (let i = 0; i < this.arena.domZones.length; i++) {
        const zone = this.arena.domZones[i];
        const st = this.domState[i];
        if (!st) continue;
        let alphaNear =
          this.playerRespawnTimer <= 0 &&
          Math.hypot(this.px - zone.x, this.pz - zone.z) <= zone.radius
            ? 1
            : 0;
        let bravoNear = 0;
        for (const bot of this.bots) {
          if (!bot.alive) continue;
          if (Math.hypot(bot.x - zone.x, bot.z - zone.z) <= zone.radius) {
            if (bot.team === 'alpha') alphaNear++;
            else bravoNear++;
          }
        }
        if (alphaNear > bravoNear) {
          st.progress = Math.min(100, st.progress + dt * 38);
          if (st.progress >= 100) st.owner = 'alpha';
        } else if (bravoNear > alphaNear) {
          st.progress = Math.max(-100, st.progress - dt * 38);
          if (st.progress <= -100) st.owner = 'bravo';
        }
        zone.ringMat.color.setHex(
          st.owner === 'alpha' ? 0x38bdf8 : st.owner === 'bravo' ? 0xf43f5e : 0x94a3b8,
        );
      }

      this.domTickAccum += dt;
      if (this.domTickAccum >= 1.0) {
        this.domTickAccum = 0;
        for (const st of this.domState) {
          if (st.owner === 'alpha') this.teamScores.alpha += 2;
          else if (st.owner === 'bravo') this.teamScores.bravo += 2;
        }
        this.playerScore = this.teamScores.alpha;
        this.rivalScore = this.teamScores.bravo;
        if (this.teamScores.alpha >= this.targetScore) {
          this.finishRivalsMatch(true);
        } else if (this.teamScores.bravo >= this.targetScore) {
          this.finishRivalsMatch(false);
        }
      }
    }

    // 3. Royale Storm Ring
    if (this.matchFormat === 'royale') {
      this.royaleZoneRadius = Math.max(6, this.royaleZoneRadius - dt * 0.72);
      if (this.royaleRingMesh) {
        const baseR = (this.arena.arenaHalfExtent || 26) * 1.15;
        this.royaleRingMesh.scale.set(
          this.royaleZoneRadius / baseR,
          1,
          this.royaleZoneRadius / baseR,
        );
      }
      this.royaleDamageAccum += dt;
      if (this.royaleDamageAccum >= 0.8) {
        this.royaleDamageAccum = 0;
        if (Math.hypot(this.px, this.pz) > this.royaleZoneRadius && this.playerRespawnTimer <= 0) {
          this.applyDamageToSelf(8);
          if (this.hp <= 0) {
            this.finishRivalsMatch(false);
          }
        }
        for (const bot of this.bots) {
          if (bot.alive && Math.hypot(bot.x, bot.z) > this.royaleZoneRadius) {
            bot.hp -= 10;
            if (bot.hp <= 0) {
              bot.alive = false;
              bot.rig.root.visible = false;
            }
          }
        }
      }
    }
  }

  private stepBotRivals(dt: number): void {
    if (!this.arena || this.roundResetTimer > 0) return;

    this.stepModeObjectives(dt);

    const maxExtent = Math.max(20, this.arena.arenaHalfExtent - 1.5);
    const blocked = (tx: number, tz: number) => {
      for (const c of this.arena!.colliders) {
        if (c.maxY < 0.8) continue;
        if (tx + 0.5 > c.minX && tx - 0.5 < c.maxX && tz + 0.5 > c.minZ && tz - 0.5 < c.maxZ) {
          return true;
        }
      }
      return Math.abs(tx) > maxExtent || Math.abs(tz) > maxExtent;
    };

    for (const bot of this.bots) {
      if (!bot.alive) {
        if (!this.isRoundBasedMode(this.matchFormat) && this.matchFormat !== 'royale' && bot.respawnTimer > 0) {
          bot.respawnTimer = Math.max(0, bot.respawnTimer - dt);
          if (bot.respawnTimer === 0) {
            const sp = this.arena.spawns[Math.floor(Math.random() * this.arena.spawns.length)];
            bot.x = sp.x;
            bot.y = sp.y;
            bot.z = sp.z;
            bot.hp = bot.maxHp;
            bot.alive = true;
            bot.chillTimer = 0;
            bot.rig.root.visible = true;
          }
        }
        continue;
      }

      if (this.playerRespawnTimer > 0) continue;

      bot.moveSeed += dt;
      if (bot.chillTimer > 0) bot.chillTimer = Math.max(0, bot.chillTimer - dt);
      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) {
        bot.strafeDir = Math.random() > 0.5 ? 1 : -1;
        bot.strafeTimer = 0.7 + Math.random() * 1.1;
      }

      // Target nearest opposing combatant
      let targetX = this.px;
      let targetY = this.py;
      let targetZ = this.pz;
      let targetKind: 'player' | 'bot' = 'player';
      let targetBot: BotAgent | null = null;
      let bestDist = Infinity;

      const isTeam = this.isTeamMode(this.matchFormat);
      if (!isTeam || bot.team !== this.selfTeam) {
        bestDist = Math.hypot(this.px - bot.x, this.pz - bot.z);
      }

      for (const other of this.bots) {
        if (!other.alive || other.id === bot.id) continue;
        if (isTeam && other.team === bot.team) continue;
        const d = Math.hypot(other.x - bot.x, other.z - bot.z);
        if (d < bestDist) {
          bestDist = d;
          targetX = other.x;
          targetY = other.y;
          targetZ = other.z;
          targetKind = 'bot';
          targetBot = other;
        }
      }

      if (!Number.isFinite(bestDist)) continue;

      const dx = targetX - bot.x;
      const dz = targetZ - bot.z;
      const dist = Math.max(0.1, Math.hypot(dx, dz));
      bot.yaw = Math.atan2(-dx, -dz);

      const baseSpeed =
        this.botDifficulty === 'ace' ? 7.2 : this.botDifficulty === 'tactician' ? 5.8 : 4.1;
      const speed =
        baseSpeed * (bot.chillTimer > 0 ? 0.6 : 1.0) * (bot.isJuggernaut ? 0.84 : 1.0);
      const approach = dist > 16 ? 0.75 : dist < 8 ? -0.65 : 0.1;

      const dirX = dx / dist;
      const dirZ = dz / dist;
      const perpX = -dirZ * bot.strafeDir;
      const perpZ = dirX * bot.strafeDir;

      const nx = bot.x + (dirX * approach + perpX * 0.85) * speed * dt;
      const nz = bot.z + (dirZ * approach + perpZ * 0.85) * speed * dt;

      if (!blocked(nx, bot.z)) bot.x = nx;
      if (!blocked(bot.x, nz)) bot.z = nz;

      bot.rig.root.position.set(bot.x, bot.y, bot.z);
      bot.rig.root.rotation.y = bot.yaw;
      bot.rig.leftLeg.rotation.x = Math.sin(bot.moveSeed * 9) * 0.45;
      bot.rig.rightLeg.rotation.x = -Math.sin(bot.moveSeed * 9) * 0.45;

      if (bot.blindTimer > 0) {
        bot.blindTimer = Math.max(0, bot.blindTimer - dt);
        bot.rig.headGroup.rotation.y = Math.sin(bot.moveSeed * 12) * 0.55;
        continue;
      }
      bot.rig.headGroup.rotation.y = 0;

      bot.fireCooldown -= dt;
      if (bot.fireCooldown <= 0) {
        const eyeOrigin = _tmpVec.set(bot.x, bot.y + 1.5, bot.z);
        const tgtEye = _tmpVec2.set(targetX, targetY + 1.35, targetZ);
        const toTarget = tgtEye.clone().sub(eyeOrigin);
        const rayLen = toTarget.length();
        toTarget.normalize();

        this.raycaster.set(eyeOrigin, toTarget);
        this.raycaster.far = rayLen;
        const wallHits = this.raycaster.intersectObjects(this.arena.shootableWalls, true);

        if (wallHits.length === 0) {
          const rate =
            bot.isJuggernaut
              ? 0.24
              : this.botDifficulty === 'ace'
              ? 0.42
              : this.botDifficulty === 'tactician'
              ? 0.62
              : 0.95;
          const accuracy =
            this.botDifficulty === 'ace' ? 0.44 : this.botDifficulty === 'tactician' ? 0.3 : 0.18;
          bot.fireCooldown = rate + Math.random() * 0.3;

          const hitTgt = Math.random() < accuracy;
          const tracerEnd = hitTgt
            ? tgtEye.clone()
            : tgtEye
                .clone()
                .add(
                  new THREE.Vector3(
                    (Math.random() - 0.5) * 2.4,
                    (Math.random() - 0.5) * 1.4,
                    (Math.random() - 0.5) * 2.4,
                  ),
                );

          if (targetKind === 'player') this.botShotPending = true;
          this.spawnTracer(
            eyeOrigin,
            tracerEnd,
            bot.team === 'alpha' ? 0x38bdf8 : bot.team === 'charlie' ? 0x34d399 : 0xf43f5e,
          );

          if (hitTgt) {
            const dmgBase =
              bot.isJuggernaut
                ? 11
                : this.botDifficulty === 'ace'
                ? 14
                : this.botDifficulty === 'tactician'
                ? 10
                : 7;
            const dmg = dmgBase * (this.matchFormat === 'double_trouble' ? 2 : 1);

            if (targetKind === 'bot' && targetBot) {
              targetBot.hp = Math.max(0, targetBot.hp - dmg);
              bot.damage += dmg;
              if (targetBot.hp <= 0) {
                targetBot.alive = false;
                targetBot.deaths += 1;
                targetBot.rig.root.visible = false;
                bot.kills += 1;
                if (!this.isRoundBasedMode(this.matchFormat) && this.matchFormat !== 'royale') {
                  targetBot.respawnTimer = 2.0;
                  if (bot.team === 'alpha') {
                    this.teamScores.alpha += 1;
                    this.playerScore = this.teamScores.alpha;
                  } else if (bot.team === 'bravo') {
                    this.teamScores.bravo += 1;
                    this.rivalScore = this.teamScores.bravo;
                  } else {
                    this.teamScores.charlie += 1;
                    this.rivalScore = Math.max(this.teamScores.bravo, this.teamScores.charlie);
                  }
                }
              }
            } else {
              this.lastBotAttacker = bot;
              this.applyDamageToSelf(dmg);
              if (this.hp <= 0) {
                this.matchDeaths++;
                this.killStreak = 0;
                bot.kills += 1;
                this.captureKillCam(bot.name, bot.isJuggernaut ? 'Vulcan Minigun' : 'VX-47 Carbine', false);
                recordCareerDelta({deaths: 1});
                this.callbacks.onCareerUpdated();
                this.callbacks.onKillFeed({
                  id: this.killFeedCounter++,
                  attacker: bot.name,
                  victim: 'You',
                  attackerTeam: bot.team,
                  victimTeam: this.selfTeam,
                  weapon: bot.isJuggernaut ? 'Vulcan Minigun' : 'VX-47 Carbine',
                  headshot: false,
                });
                this.sound.playRoundBanner(false);

                if (this.matchFormat === 'royale' || this.matchFormat === 'pve_tower') {
                  this.finishRivalsMatch(false);
                  return;
                }

                if (this.isRoundBasedMode(this.matchFormat)) {
                  this.rivalScore += 1;
                  this.teamScores.bravo = this.rivalScore;
                  if (this.rivalScore >= this.targetScore) {
                    this.finishRivalsMatch(false);
                  } else {
                    this.roundNumber++;
                    this.resetDuelRound('RIVAL SCORED');
                  }
                } else {
                  if (bot.team === 'charlie') {
                    this.teamScores.charlie += 1;
                    this.rivalScore = Math.max(this.teamScores.bravo, this.teamScores.charlie);
                  } else {
                    this.teamScores.bravo += 1;
                    this.rivalScore = this.teamScores.bravo;
                  }
                  if (this.rivalScore >= this.targetScore && this.matchFormat !== 'ctf' && this.matchFormat !== 'domination') {
                    this.finishRivalsMatch(false);
                  } else {
                    this.playerRespawnTimer = 1.4;
                    this.roundBanner = 'RESPAWNING...';
                    this.roundResetTimer = 1.4;
                  }
                }
              }
            }
          }
        } else {
          bot.fireCooldown = 0.28;
        }
      }
    }
  }

  private stepShootingArena(dt: number): void {
    const tNow = performance.now() / 1000;
    for (const target of this.rangeTargets) {
      if (target.hp <= 0) {
        target.respawnTimer -= dt;
        if (target.respawnTimer <= 0) {
          target.hp = target.maxHp;
          target.rig.root.visible = true;
        }
        continue;
      }

      if (target.kind === 'strafe' || target.kind === 'drone') {
        const x = target.baseX + Math.sin(tNow * target.speed + target.phase) * target.ampX;
        const y =
          target.kind === 'drone' ? target.baseY + Math.sin(tNow * 2.6 + target.phase) * 0.7 : target.baseY;
        target.rig.root.position.set(x, y, target.baseZ);
      }

      if (target.hitFlash > 0) {
        target.hitFlash = Math.max(0, target.hitFlash - dt);
        target.rig.baseMat.emissive.setHex(0xf97316);
        target.rig.baseMat.emissiveIntensity = target.hitFlash * 4;
      } else {
        target.rig.baseMat.emissiveIntensity = 0;
      }
    }

    if (!this.matchEnded) {
      this.arenaTimeLeftSec = Math.max(0, this.arenaTimeLeftSec - dt);
      if (this.arenaTimeLeftSec <= 0) {
        this.matchEnded = true;
        this.releasePointerLock();
        this.sound.playRoundBanner(true);
        this.callbacks.onMatchOver(this.buildMatchSummary(true, 'shooting_arena'));
      }
    }
  }

  private computeRadarBlips(): RadarEntity[] {
    const blips: RadarEntity[] = [];
    const isTeam = this.isTeamMode(this.matchFormat);
    if (this.playMode === 'rivals_1p') {
      for (const b of this.bots) {
        if (!b.alive) continue;
        blips.push({
          dx: b.x - this.px,
          dz: b.z - this.pz,
          hostile: !isTeam || b.team !== this.selfTeam,
          team: b.team,
        });
      }
    } else if (this.playMode === 'multiplayer') {
      for (const rem of this.remoteOps.values()) {
        if (rem.alive && !rem.spectator) {
          blips.push({
            dx: rem.targetX - this.px,
            dz: rem.targetZ - this.pz,
            hostile: !isTeam || rem.team !== this.selfTeam,
            team: rem.team,
          });
        }
      }
    } else if (this.playMode === 'shooting_arena') {
      for (const t of this.rangeTargets) {
        if (t.hp > 0) {
          blips.push({
            dx: t.rig.root.position.x - this.px,
            dz: t.rig.root.position.z - this.pz,
            hostile: true,
          });
        }
      }
    }
    return blips;
  }

  private stepAdminAimbotAndEsp(dt: number): void {
    const isAuthAdmin = this.adminRole === 'owner' || this.adminRole === 'admin';
    if (!isAuthAdmin) {
      if (this.espBoxes.size > 0) this.clearEspBoxes();
      return;
    }

    const isTeam = this.isTeamMode(this.matchFormat);

    if (this.adminTools.espEnabled) {
      const activeIds = new Set<string>();
      if (this.playMode === 'rivals_1p') {
        for (const bot of this.bots) {
          if (!bot.alive) continue;
          activeIds.add(bot.id);
          const isAlly = isTeam && bot.team === this.selfTeam;
          const box = this.ensureEspBox(bot.id, isAlly ? 0x38bdf8 : 0xf43f5e);
          box.position.set(bot.x, bot.y + 0.94, bot.z);
        }
      } else if (this.playMode === 'multiplayer') {
        for (const rem of this.remoteOps.values()) {
          if (!rem.alive || rem.spectator) continue;
          activeIds.add(rem.id);
          const isAlly = isTeam && rem.team === this.selfTeam;
          const box = this.ensureEspBox(rem.id, isAlly ? 0x38bdf8 : 0xf43f5e);
          box.position.set(rem.targetX, rem.targetY + 0.94, rem.targetZ);
        }
      }
      for (const [id, box] of this.espBoxes.entries()) {
        if (!activeIds.has(id)) {
          this.scene.remove(box);
          box.geometry.dispose();
          (box.material as THREE.Material).dispose();
          this.espBoxes.delete(id);
        }
      }
    } else if (this.espBoxes.size > 0) {
      this.clearEspBoxes();
    }

    if (this.adminTools.aimbotEnabled && (this.triggerDown || this.isAds)) {
      const yOffset = this.adminTools.aimbotBone === 'head' ? 1.54 : 1.05;
      let bestDist = Infinity;
      let targetVec: THREE.Vector3 | null = null;

      if (this.playMode === 'rivals_1p') {
        for (const bot of this.bots) {
          if (!bot.alive) continue;
          if (isTeam && bot.team === this.selfTeam) continue;
          const d = Math.hypot(bot.x - this.px, bot.z - this.pz);
          if (d < bestDist) {
            bestDist = d;
            targetVec = _tmpVec.set(bot.x, bot.y + yOffset, bot.z);
          }
        }
      } else if (this.playMode === 'multiplayer') {
        for (const rem of this.remoteOps.values()) {
          if (!rem.alive || rem.spectator) continue;
          if (isTeam && rem.team === this.selfTeam) continue;
          const d = Math.hypot(rem.targetX - this.px, rem.targetZ - this.pz);
          if (d < bestDist) {
            bestDist = d;
            targetVec = _tmpVec.set(rem.targetX, rem.targetY + yOffset, rem.targetZ);
          }
        }
      } else if (this.playMode === 'shooting_arena') {
        for (const t of this.rangeTargets) {
          if (t.hp <= 0) continue;
          const p = t.rig.root.position;
          const d = Math.hypot(p.x - this.px, p.z - this.pz);
          if (d < bestDist) {
            bestDist = d;
            targetVec = _tmpVec.set(
              p.x,
              p.y + (this.adminTools.aimbotBone === 'head' ? 0.38 : 0),
              p.z,
            );
          }
        }
      }

      if (targetVec) {
        const dx = targetVec.x - this.px;
        const dy = targetVec.y - (this.py + this.currentEyeHeight);
        const dz = targetVec.z - this.pz;
        const desiredYaw = Math.atan2(-dx, -dz);
        const desiredPitch = Math.max(-1.45, Math.min(1.45, Math.atan2(dy, Math.hypot(dx, dz))));

        let yawDiff = desiredYaw - this.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        const blend = Math.min(1, dt * 26);
        this.yaw += yawDiff * blend;
        this.pitch = THREE.MathUtils.lerp(this.pitch, desiredPitch, blend);
      }
    }
  }

  private computeHudEspTargets(): HudEspTarget[] {
    const isAuthAdmin = this.adminRole === 'owner' || this.adminRole === 'admin';
    if (!isAuthAdmin || !this.adminTools.espEnabled) return [];
    const results: HudEspTarget[] = [];

    const projectTarget = (
      id: string,
      name: string,
      wx: number,
      wy: number,
      wz: number,
      hp: number,
      team?: TeamId,
    ) => {
      _projVec.set(wx, wy + 1.0, wz);
      const dist = Math.round(_projVec.distanceTo(this.camera.position));
      _projVec.project(this.camera);
      if (_projVec.z > 1) return;
      const sx = (_projVec.x * 0.5 + 0.5) * 100;
      const sy = (-_projVec.y * 0.5 + 0.5) * 100;
      if (sx < -10 || sx > 110 || sy < -10 || sy > 110) return;
      const boxH = Math.max(4, Math.min(34, 180 / Math.max(3, dist)));
      const boxW = boxH * 0.55;
      results.push({id, name, team, x: sx, y: sy, boxH, boxW, hp, distMeters: dist});
    };

    if (this.playMode === 'rivals_1p') {
      for (const bot of this.bots) {
        if (bot.alive) {
          projectTarget(bot.id, bot.name, bot.x, bot.y, bot.z, bot.hp, bot.team);
        }
      }
    } else if (this.playMode === 'multiplayer') {
      for (const rem of this.remoteOps.values()) {
        if (rem.alive && !rem.spectator) {
          projectTarget(rem.id, rem.name, rem.targetX, rem.targetY, rem.targetZ, 100, rem.team);
        }
      }
    }
    return results;
  }

  private computeTeammateMarkers(): TeammateMarker[] {
    if (!this.isTeamMode(this.matchFormat)) return [];
    const markers: TeammateMarker[] = [];

    if (this.playMode === 'multiplayer') {
      for (const rem of this.remoteOps.values()) {
        if (!rem.alive || rem.spectator || rem.team !== this.selfTeam) continue;
        _projVec.set(rem.targetX, rem.targetY + 2.15, rem.targetZ);
        const dist = Math.round(_projVec.distanceTo(this.camera.position));
        _projVec.project(this.camera);
        if (_projVec.z > 1) continue;
        const sx = (_projVec.x * 0.5 + 0.5) * 100;
        const sy = (-_projVec.y * 0.5 + 0.5) * 100;
        if (sx < 2 || sx > 98 || sy < 4 || sy > 96) continue;
        markers.push({
          id: rem.id,
          name: rem.name,
          team: rem.team,
          x: sx,
          y: sy,
          hp: 100,
          distMeters: dist,
        });
      }
    } else if (this.playMode === 'rivals_1p') {
      for (const bot of this.bots) {
        if (!bot.alive || bot.team !== this.selfTeam) continue;
        _projVec.set(bot.x, bot.y + 2.15, bot.z);
        const dist = Math.round(_projVec.distanceTo(this.camera.position));
        _projVec.project(this.camera);
        if (_projVec.z > 1) continue;
        const sx = (_projVec.x * 0.5 + 0.5) * 100;
        const sy = (-_projVec.y * 0.5 + 0.5) * 100;
        if (sx < 2 || sx > 98 || sy < 4 || sy > 96) continue;
        markers.push({
          id: bot.id,
          name: bot.name,
          team: bot.team,
          x: sx,
          y: sy,
          hp: bot.hp,
          distMeters: dist,
        });
      }
    }
    return markers;
  }

  private emitHud(): void {
    const activeId = this.getActiveWeaponId();
    const spec = WEAPONS[activeId];
    const ammo =
      this.activeSlot === 'primary' || this.activeSlot === 'secondary'
        ? this.ammoMap[this.activeSlot]
        : 1;

    const specTargets = [...this.remoteOps.values()].filter((r) => r.alive && !r.spectator);
    const spectateName = this.isSpectating
      ? specTargets.length > 0
        ? specTargets[this.spectateIdx % specTargets.length]?.name
        : this.bots[this.spectateIdx % Math.max(1, this.bots.length)]?.name ?? 'Arena Cam'
      : null;

    this.callbacks.onHudUpdate({
      hp: this.hp,
      maxHp: this.maxHp,
      shield: Math.round(this.shield),
      maxShield: 50,
      ammo,
      magSize: spec.magSize,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading && spec.reloadSec > 0 ? 1 - this.reloadTimer / spec.reloadSec : 0,
      activeSlot: this.activeSlot,
      weaponId: activeId,
      weaponName: spec.name,
      isAds: this.isAds,
      isSliding: this.slideTimer > 0,
      isCrouching: this.isCrouching,
      dashReady: this.dashCooldown <= 0,
      utilityCooldownSec: Math.ceil(this.utilityCooldownSec),
      playerScore: this.playerScore,
      rivalScore: this.rivalScore,
      targetScore: this.targetScore,
      matchFormat: this.matchFormat,
      selfTeam: this.selfTeam,
      teamScores: this.teamScores,
      roundNumber: this.roundNumber,
      roundBanner: this.roundBanner,
      hitmarkerType: this.hitmarkerType,
      damageFlash: this.damageFlash,
      arenaScore: this.arenaScore,
      arenaTimeLeftSec: Math.ceil(this.arenaTimeLeftSec),
      arenaAccuracyPct: this.arenaShots > 0 ? Math.round((this.arenaHits / this.arenaShots) * 100) : 100,
      arenaStreak: this.arenaStreak,
      killStreak: this.killStreak,
      killStreakBanner: this.killStreakBanner,
      blindedFlash: this.blindedFlash,
      chilledTimer: this.playerChilledTimer,
      warHornTimer: this.warHornTimer,
      gunGameStep: this.matchFormat === 'gun_game' ? this.gunGameStep + 1 : undefined,
      gunGameTotal: this.matchFormat === 'gun_game' ? GUN_GAME_LADDER.length : undefined,
      pveWave: this.matchFormat === 'pve_tower' ? this.pveWave : undefined,
      pveMaxWaves: this.matchFormat === 'pve_tower' ? this.pveMaxWaves : undefined,
      royaleAlive:
        this.matchFormat === 'royale'
          ? (this.playerRespawnTimer <= 0 ? 1 : 0) + this.bots.filter((b) => b.alive).length
          : undefined,
      royaleZoneRadius: this.matchFormat === 'royale' ? Math.round(this.royaleZoneRadius) : undefined,
      ctfCarrier: this.matchFormat === 'ctf' ? this.ctfBravoCarrier : undefined,
      domZones: this.matchFormat === 'domination' ? this.domState : undefined,
      isSpectating: this.isSpectating,
      spectateTargetName: spectateName,
      pointerLocked: this.pointerLocked,
      radarBlips: this.computeRadarBlips(),
      playerYaw: this.yaw,
      espTargets: this.computeHudEspTargets(),
      teammateMarkers: this.computeTeammateMarkers(),
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

      this.fpsFrames++;
      this.fpsAccumSec += Math.max(0.001, rawDt);
      if (this.fpsAccumSec >= 0.45) {
        const measuredFps = Math.min(999, Math.round(this.fpsFrames / this.fpsAccumSec));
        this.callbacks.onFpsUpdate?.(measuredFps);
        this.fpsFrames = 0;
        this.fpsAccumSec = 0;
      }

      if (this.playMode === 'lobby') {
        this.lobbySpinAngle += dt * 0.55;
        if (this.lobbyWeaponRig) {
          this.lobbyWeaponRig.root.rotation.y = this.lobbySpinAngle;
          this.lobbyWeaponRig.root.position.y = 1.12 + Math.sin(this.lobbySpinAngle * 2) * 0.04;
        }
        if (this.lobbyOperatorRig) {
          if (this.lobbyEmoteTimer > 0) {
            this.lobbyEmoteTimer = Math.max(0, this.lobbyEmoteTimer - dt);
            const p = 1 - this.lobbyEmoteTimer / 1.6;
            const wave = Math.sin(p * Math.PI * 4);
            if (this.lobbyEmoteActive === 'spin' || this.lobbyEmoteActive === 'crown') {
              this.lobbyOperatorRig.root.rotation.y = 2.75 + p * Math.PI * 2;
              this.lobbyOperatorRig.root.position.y = Math.sin(p * Math.PI) * 0.25;
            } else if (this.lobbyEmoteActive === 'flex' || this.lobbyEmoteActive === 'salute') {
              this.lobbyOperatorRig.root.position.y = Math.abs(Math.sin(p * Math.PI * 2)) * 0.14;
              this.lobbyOperatorRig.gunMount.rotation.x = -0.85 * Math.sin(p * Math.PI);
            } else {
              this.lobbyOperatorRig.root.rotation.y = 2.75 + wave * 0.45;
              this.lobbyOperatorRig.headGroup.rotation.z = wave * 0.18;
            }
          } else {
            this.lobbyOperatorRig.root.rotation.y = THREE.MathUtils.damp(
              this.lobbyOperatorRig.root.rotation.y,
              2.75 + Math.sin(this.lobbySpinAngle * 0.8) * 0.12,
              8,
              dt,
            );
            this.lobbyOperatorRig.root.position.y = THREE.MathUtils.damp(
              this.lobbyOperatorRig.root.position.y,
              0,
              10,
              dt,
            );
            this.lobbyOperatorRig.gunMount.rotation.x = THREE.MathUtils.damp(
              this.lobbyOperatorRig.gunMount.rotation.x,
              0,
              10,
              dt,
            );
            this.lobbyOperatorRig.headGroup.rotation.z = THREE.MathUtils.damp(
              this.lobbyOperatorRig.headGroup.rotation.z,
              0,
              10,
              dt,
            );
          }
        }
      } else if (this.isPlayingKillCam && this.lastDeathFrames.length >= 2) {
        this.killCamElapsed += dt;
        const progress = Math.min(1, this.killCamElapsed / this.killCamDuration);
        const fSpan = this.lastDeathFrames.length - 1;
        const exactIdx = progress * fSpan;
        const i0 = Math.min(fSpan, Math.floor(exactIdx));
        const i1 = Math.min(fSpan, i0 + 1);
        const alpha = exactIdx - i0;
        const a = this.lastDeathFrames[i0];
        const b = this.lastDeathFrames[i1];

        const ox = THREE.MathUtils.lerp(a.ox, b.ox, alpha);
        const oy = THREE.MathUtils.lerp(a.oy, b.oy, alpha);
        const oz = THREE.MathUtils.lerp(a.oz, b.oz, alpha);
        const oyaw = THREE.MathUtils.lerp(a.oyaw, b.oyaw, alpha);
        const opitch = THREE.MathUtils.lerp(a.opitch, b.opitch, alpha);

        const px = THREE.MathUtils.lerp(a.px, b.px, alpha);
        const py = THREE.MathUtils.lerp(a.py, b.py, alpha);
        const pz = THREE.MathUtils.lerp(a.pz, b.pz, alpha);
        const pyaw = THREE.MathUtils.lerp(a.pyaw, b.pyaw, alpha);

        this.camera.position.set(ox, oy + 1.56, oz);
        _euler.set(opitch, oyaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(_euler);
        this.camera.fov = 76;
        this.camera.updateProjectionMatrix();

        if (this.killCamSelfRig) {
          this.killCamSelfRig.root.position.set(px, py, pz);
          this.killCamSelfRig.root.rotation.y = pyaw;
          if (progress > 0.86) {
            this.killCamSelfRig.root.rotation.x = -Math.PI * 0.42 * ((progress - 0.86) / 0.14);
          } else {
            this.killCamSelfRig.root.rotation.x = 0;
          }
        }

        if (i0 > this.killCamLastShotIdx) {
          for (let k = this.killCamLastShotIdx + 1; k <= i0; k++) {
            const kf = this.lastDeathFrames[k];
            if (kf.shotFired) {
              this.spawnTracer(
                new THREE.Vector3(kf.ox, kf.oy + 1.48, kf.oz),
                new THREE.Vector3(kf.px, kf.py + 1.35, kf.pz),
                0xf43f5e,
              );
              this.sound.playGunshot('vx47');
            }
          }
          this.killCamLastShotIdx = i0;
        }

        this.callbacks.onKillCamProgress?.(progress);
        if (this.killCamElapsed >= this.killCamDuration) {
          this.stopKillCam(false);
        }
      } else if (!this.paused && !this.matchEnded) {
        if (this.hitstopTimer > 0) {
          this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
        } else {
          if (this.roundResetTimer > 0) {
            this.roundResetTimer = Math.max(0, this.roundResetTimer - dt);
            if (this.roundResetTimer === 0) {
              this.roundBanner = null;
              const aliveEnemies = this.bots.filter((b) => b.alive && b.team !== this.selfTeam).length;
              if (
                this.playMode === 'rivals_1p' &&
                (this.isRoundBasedMode(this.matchFormat) || this.matchFormat === 'pve_tower') &&
                aliveEnemies === 0
              ) {
                this.resetDuelRound(
                  this.matchFormat === 'pve_tower'
                    ? `WAVE ${this.pveWave} · FIGHT`
                    : `ROUND ${this.roundNumber} · FIGHT`,
                );
              }
            }
          }

          if (this.isSpectating) {
            this.stepSpectatorCamera(dt);
          } else if (this.playerRespawnTimer > 0) {
            this.playerRespawnTimer = Math.max(0, this.playerRespawnTimer - dt);
            if (this.playerRespawnTimer === 0 && this.arena) {
              const sp = this.arena.spawns[Math.floor(Math.random() * this.arena.spawns.length)];
              this.resetPlayerToSpawn(sp.x, sp.y, sp.z, sp.yaw);
            }
          } else {
            this.stepPlayerMovement(dt);
          }

          this.stepAdminAimbotAndEsp(dt);

          this.outOfCombatTimer += dt;
          if (this.outOfCombatTimer >= 5.0 && this.shield < 50 && this.hp > 0) {
            this.shield = Math.min(50, this.shield + 14 * dt);
          }

          if (this.utilityCooldownSec > 0) {
            this.utilityCooldownSec = Math.max(0, this.utilityCooldownSec - dt);
          }
          if (this.meleeSwingTimer > 0) {
            this.meleeSwingTimer = Math.max(0, this.meleeSwingTimer - dt);
          }
          if (this.quickMeleeTimer > 0) {
            this.quickMeleeTimer = Math.max(0, this.quickMeleeTimer - dt);
            if (this.quickMeleeTimer === 0 && this.quickMeleeReturnSlot) {
              const ret = this.quickMeleeReturnSlot;
              this.quickMeleeReturnSlot = null;
              this.switchSlot(ret);
            }
          }
          if (this.killStreakBannerTimer > 0) {
            this.killStreakBannerTimer = Math.max(0, this.killStreakBannerTimer - dt);
            if (this.killStreakBannerTimer === 0) {
              this.killStreakBanner = null;
            }
          }
          if (this.blindedFlash > 0) {
            this.blindedFlash = Math.max(0, this.blindedFlash - dt * 0.45);
          }
          if (this.inspectTimer > 0) {
            this.inspectTimer = Math.max(0, this.inspectTimer - dt);
          }
          if (this.viewEmoteTimer > 0) {
            this.viewEmoteTimer = Math.max(0, this.viewEmoteTimer - dt);
          }

          if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
          if (this.burstRemaining > 0) {
            this.burstDelay -= dt;
            if (this.burstDelay <= 0 && (this.activeSlot === 'primary' || this.activeSlot === 'secondary')) {
              this.burstRemaining--;
              this.burstDelay = 0.065;
              this.executeSingleShot(this.activeSlot, this.getActiveWeaponId());
            }
          }

          if (this.isReloading && (this.activeSlot === 'primary' || this.activeSlot === 'secondary')) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
              this.ammoMap[this.activeSlot] = WEAPONS[this.getActiveWeaponId()].magSize;
              this.isReloading = false;
              this.reloadTimer = 0;
            }
          }

          const activeSpec = WEAPONS[this.getActiveWeaponId()];
          if ((activeSpec.automatic && this.triggerDown) || (!activeSpec.automatic && this.triggerJustPressed)) {
            this.tryFire();
          }
          this.triggerJustPressed = false;

          if (this.muzzleFlashTimer > 0) {
            this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
            if (this.viewWeaponRig) {
              this.viewWeaponRig.muzzleFlash.visible = this.muzzleFlashTimer > 0;
              this.viewWeaponRig.muzzleFlash.rotation.z += dt * 25;
            }
            if (this.muzzleFlashTimer === 0) this.muzzlePointLight.intensity = 0;
          }

          if (this.hitmarkerTimer > 0) {
            this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - dt);
            if (this.hitmarkerTimer === 0) this.hitmarkerType = 'none';
          }
          if (this.damageFlash > 0) {
            this.damageFlash = Math.max(0, this.damageFlash - dt * 2.8);
          }

          this.stepGrenades(dt);

          if (this.playMode === 'rivals_1p') {
            this.stepBotRivals(dt);
          } else if (this.playMode === 'shooting_arena') {
            this.stepShootingArena(dt);
          } else if (this.playMode === 'multiplayer') {
            for (const rem of this.remoteOps.values()) {
              rem.rig.root.position.x = THREE.MathUtils.damp(rem.rig.root.position.x, rem.targetX, 14, dt);
              rem.rig.root.position.y = THREE.MathUtils.damp(rem.rig.root.position.y, rem.targetY, 14, dt);
              rem.rig.root.position.z = THREE.MathUtils.damp(rem.rig.root.position.z, rem.targetZ, 14, dt);
              rem.rig.root.rotation.y = rem.targetYaw;
            }
            if (!this.isSpectating) {
              this.netSendAccum += dt;
              if (this.netSendAccum >= 0.05) {
                this.netSendAccum = 0;
                this.callbacks.onSendNetState?.({
                  x: this.px,
                  y: this.py,
                  z: this.pz,
                  yaw: this.yaw,
                  pitch: this.pitch,
                  weaponId: this.getActiveWeaponId(),
                  wrapId: this.wrapId,
                });
              }
            }
          }

          this.killCamSampleAccum += dt;
          if (this.killCamSampleAccum >= 0.05) {
            this.killCamSampleAccum = 0;
            this.sampleKillCamFrame();
          }
        }

        this.hudAccum += dt;
        if (this.hudAccum >= 0.05) {
          this.hudAccum = 0;
          this.emitHud();
        }
      }

      for (let i = this.tracers.length - 1; i >= 0; i--) {
        const tr = this.tracers[i];
        tr.life += dt;
        if (tr.life >= tr.maxLife) {
          this.scene.remove(tr.line);
          tr.line.geometry.dispose();
          tr.mat.dispose();
          this.tracers.splice(i, 1);
        } else {
          tr.mat.opacity = 1 - tr.life / tr.maxLife;
        }
      }

      for (let i = 0; i < this.maxSparks; i++) {
        const s = this.sparks[i];
        if (!s.active) continue;
        s.life += dt;
        if (s.life >= s.maxLife) {
          s.active = false;
          this.sparkPosAttr.setXYZ(i, 0, -999, 0);
          continue;
        }
        s.vy -= 14 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        const fade = 1 - s.life / s.maxLife;
        this.sparkPosAttr.setXYZ(i, s.x, s.y, s.z);
        this.sparkColAttr.setXYZ(i, s.r * fade, s.g * fade, s.b * fade);
      }
      this.sparkPosAttr.needsUpdate = true;
      this.sparkColAttr.needsUpdate = true;

      if (this.arena?.animatedObjects.length) {
        const tAnim = now / 1000;
        for (const ao of this.arena.animatedObjects) {
          ao.mesh.position.y = ao.baseY + Math.sin(tAnim * ao.speed + ao.phase) * 0.14;
          if (ao.spinSpeed) {
            ao.mesh.rotation.y = tAnim * ao.spinSpeed;
          }
        }
      }

      if (this.cinematicAberration > 0) {
        this.cinematicAberration = Math.max(0, this.cinematicAberration - dt * 2.4);
      }
      if (this.cinematicPass) {
        this.cinematicPass.uniforms.uAberration.value = this.cinematicAberration;
      }

      const useComposer =
        !this.isSoftwareGl &&
        this.composer !== null &&
        ((this.gpuSettings.bloom ?? true) ||
          (this.gpuSettings.fxaa ?? true) ||
          (this.gpuSettings.cinematicFx ?? true));

      if (useComposer) {
        this.composer!.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }

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
    window.removeEventListener('resize', this.boundResize);
    document.removeEventListener('pointerlockchange', this.boundPointerLock);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.boundContextLost);

    this.releasePointerLock();
    this.clearArena();
    this.viewWeaponRig?.dispose();
    this.viewArmsRig?.dispose();
    this.lobbyWeaponRig?.dispose();
    this.lobbyOperatorRig?.dispose();
    this.wrapMats?.dispose();
    this.sound.dispose();
    this.sparkGeo.dispose();
    this.composer?.dispose();
    this.composerRT?.dispose();
    this.bloomPass?.dispose();
    this.outputPass?.dispose();
    this.fxaaPass?.dispose();
    this.envRT?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
