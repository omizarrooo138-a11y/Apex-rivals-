export type PrimaryWeaponId =
  | 'vx47'
  | 'pulse3'
  | 'scar_heavy'
  | 'paintball_gun'
  | 'spectre9'
  | 'vector_x'
  | 'kestrel'
  | 'double_barrel'
  | 'longbow'
  | 'crossbow'
  | 'bow'
  | 'vulcan'
  | 'rpg'
  | 'grenade_launcher'
  | 'flamethrower'
  | 'energy_rifle'
  | 'permafrost'
  | 'gunblade';

export type SecondaryWeaponId =
  | 'mk2'
  | 'revolver'
  | 'shorty'
  | 'vipers'
  | 'daggers'
  | 'flare_gun'
  | 'slingshot'
  | 'exogun'
  | 'spray'
  | 'hand_cannon'
  | 'suppressed_pistol'
  | 'cryo_pistol';

export type MeleeWeaponId =
  | 'knife'
  | 'katana'
  | 'scythe'
  | 'chainsaw'
  | 'battle_axe'
  | 'trowel'
  | 'riot_shield'
  | 'boxing_gloves'
  | 'karambit'
  | 'laser_saber'
  | 'wrench';

export type UtilityWeaponId =
  | 'frag'
  | 'stim'
  | 'molotov'
  | 'flash'
  | 'smoke'
  | 'freeze_ray'
  | 'subspace_tripmine'
  | 'war_horn'
  | 'jump_pad'
  | 'satchel'
  | 'flash_shield';

export type WeaponId =
  | PrimaryWeaponId
  | SecondaryWeaponId
  | MeleeWeaponId
  | UtilityWeaponId;

export type WeaponArchetype =
  | 'bullet'
  | 'pellet'
  | 'explosive'
  | 'flame'
  | 'freeze'
  | 'blade'
  | 'shield_bash'
  | 'heal'
  | 'smoke'
  | 'buff'
  | 'tripmine'
  | 'jumppad'
  | 'molotov'
  | 'flash';

export type WrapId =
  | 'carbon'
  | 'arctic'
  | 'crimson'
  | 'cobalt'
  | 'desert'
  | 'neon'
  | 'gold'
  | 'prism'
  | 'urban'
  | 'magma'
  | 'frost'
  | 'venom'
  | 'nova'
  | 'permafrost_wrap'
  | 'halloween_web';

export type CharmId =
  | 'none'
  | 'charm_dice'
  | 'charm_crown'
  | 'charm_flame'
  | 'charm_ice'
  | 'charm_skull'
  | 'charm_key';

export type FinisherId =
  | 'finisher_default'
  | 'finisher_vaporize'
  | 'finisher_shatter'
  | 'finisher_lightning'
  | 'finisher_nova'
  | 'finisher_halloween';

export type OperatorSkinId =
  | 'default_slate'
  | 'olive_recon'
  | 'vanguard_blaze'
  | 'cyber_recon'
  | 'shadow_ops'
  | 'solar_mythic'
  | 'frost_warden'
  | 'crimson_knight'
  | 'neon_shogun';

export type EmoteId =
  | 'salute'
  | 'spin'
  | 'flex'
  | 'shadowbox'
  | 'hologg'
  | 'crown';

export type SkinPackCategory = 1 | 2 | 3 | 4 | 5;

export type MapId =
  | 'vanguard'
  | 'shooting_range'
  | 'station'
  | 'graveyard'
  | 'splash'
  | 'construction'
  | 'chess'
  | 'onyx'
  | 'battleground'
  | 'docks'
  | 'metro'
  | 'crossroads'
  | 'bridge'
  | 'temple'
  | 'factory'
  | 'big_crossroads'
  | 'big_station'
  | 'big_arena'
  | 'big_docks'
  | 'big_splash'
  | 'big_graveyard'
  | 'big_construction'
  | 'legacy_arena'
  | 'legacy_crossroads'
  | 'legacy_station'
  | 'legacy_docks'
  | 'legacy_bridge'
  | 'legacy_onyx'
  | 'legacy_metro'
  | 'exp_skygrid';

export type MapCategory = 'regular' | 'big' | 'legacy' | 'experimental';
export type MapDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Pro';
export type SeasonalTheme = 'normal' | 'halloween' | 'winter';

export type MatchFormat =
  | 'duel'
  | 'duel_2v2'
  | 'duel_3v3'
  | 'duel_4v4'
  | 'duel_5v5'
  | 'beginner'
  | 'ffa'
  | 'tdm_2v2'
  | 'tdm_4v4'
  | 'gun_game'
  | 'threeway_1v1v1'
  | 'threeway_2v2v2'
  | 'ctf'
  | 'domination'
  | 'royale'
  | 'pve_tower'
  | 'mirror_matchup'
  | 'limitless_loadout'
  | 'head_honcho'
  | 'double_trouble'
  | 'juggernaut';

export type GameModeCategory =
  | 'duels'
  | 'core'
  | 'objective'
  | 'special'
  | 'ltm';

export interface GameModeSpec {
  id: MatchFormat;
  name: string;
  shortLabel: string;
  category: GameModeCategory;
  description: string;
  maxPlayers: number;
  teamCount: 0 | 2 | 3; // 0 = FFA/Royale, 2 = Alpha vs Bravo, 3 = Alpha vs Bravo vs Charlie
  targetScore: number;
  isLtm?: boolean;
  isWeeklyFeatured?: boolean;
  minLevel?: number;
}

export type TeamId = 'alpha' | 'bravo' | 'charlie';

export type BotDifficulty = 'recruit' | 'tactician' | 'ace';

export type PlayMode = 'lobby' | 'rivals_1p' | 'shooting_arena' | 'multiplayer';

export type ScreenOverlay = 'none' | 'paused' | 'kill_cam' | 'match_over';

export type GpuPreset = 'low' | 'medium' | 'high' | 'ultra';

export type CrosshairStyle = 'cross' | 'dot' | 'circle' | 'tcross';

export type RankedTier =
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Onyx'
  | 'Nemesis'
  | 'Archnemesis';

export interface CrosshairSettings {
  style: CrosshairStyle;
  color: string;
  size: number;
  thickness: number;
  gap: number;
  centerDot: boolean;
  outline: boolean;
  opacity: number;
}

export type HudScale = 'compact' | 'standard' | 'large';

export interface GpuSettings {
  preset: GpuPreset;
  resolutionScale: number;
  shadows: boolean;
  particles: boolean;
  bloom: boolean;
  fxaa: boolean;
  pbrTextures: boolean;
  cinematicFx: boolean;
  anisotropy: number;
  exposure: number;
  fov: number;
  sensitivity: number;
  crosshair: CrosshairSettings;
  showFps: boolean;
  showPing: boolean;
  showKeybinds: boolean;
  showDamageNumbers: boolean;
  cameraBob: boolean;
  hudScale: HudScale;
  seasonalTheme: SeasonalTheme;
}

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  uiVolume: number;
  muted: boolean;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  category: string;
  slot: 'primary' | 'secondary' | 'melee' | 'utility';
  archetype: WeaponArchetype;
  damage: number;
  headshotMult: number;
  fireRateRps: number;
  magSize: number;
  reloadSec: number;
  pellets: number;
  hipSpread: number;
  adsSpread: number;
  adsFov: number;
  recoilKick: number;
  automatic: boolean;
  burstCount?: number;
  moveMult: number;
  range: number;
  splashRadius?: number;
  unlockType: 'free' | 'credits' | 'keys' | 'battlepass';
  unlockCost?: number;
  contraband?: boolean;
  accentColorHex?: string;
  description: string;
}

export interface WrapSpec {
  id: WrapId;
  name: string;
  subtitle: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  metalness: number;
  roughness: number;
  unlockedByDefault: boolean;
  unlockHint: string;
}

export interface CharmSpec {
  id: CharmId;
  name: string;
  subtitle: string;
  colorHex: string;
  priceCredits: number;
  priceKeys?: number;
}

export interface FinisherSpec {
  id: FinisherId;
  name: string;
  subtitle: string;
  colorHex: string;
  priceCredits: number;
  priceKeys?: number;
}

export interface OperatorSkinSpec {
  id: OperatorSkinId;
  name: string;
  subtitle: string;
  primaryHex: string;
  visorHex: string;
  packCategory?: SkinPackCategory;
  price: number;
}

export interface EmoteSpec {
  id: EmoteId;
  name: string;
  description: string;
  price: number;
  accentHex: string;
  animationStyle: EmoteId;
}

export interface SkinPackSpec {
  id: string;
  category: SkinPackCategory;
  name: string;
  tagline: string;
  price: number;
  skinId: OperatorSkinId;
  wrapId: WrapId;
  emoteId?: EmoteId;
}

export interface DailyShopOffer {
  offerId: string;
  kind: 'skin' | 'wrap' | 'emote' | 'charm' | 'finisher' | 'weapon';
  itemId: string;
  name: string;
  subtitle: string;
  price: number;
  currency?: 'credits' | 'keys';
  originalPrice: number;
  tag: string;
  accentHex: string;
}

export interface BattlePassTier {
  tier: number;
  xpRequired: number;
  freeRewardLabel: string;
  premiumRewardLabel: string;
  freeReward: {credits?: number; keys?: number; wrapId?: WrapId; weaponId?: WeaponId};
  premiumReward: {
    credits?: number;
    keys?: number;
    wrapId?: WrapId;
    charmId?: CharmId;
    finisherId?: FinisherId;
    skinId?: OperatorSkinId;
    weaponId?: WeaponId;
  };
}

export interface MapSpec {
  id: MapId;
  name: string;
  tagline: string;
  category: MapCategory;
  difficulty: MapDifficulty;
  creator: string;
  supportedModes: MatchFormat[];
  isRankedPool?: boolean;
  skyHex: number;
  fogHex: number;
  layoutTemplate:
    | 'vanguard'
    | 'range'
    | 'docks'
    | 'metro'
    | 'crossroads'
    | 'station'
    | 'graveyard'
    | 'splash'
    | 'construction'
    | 'chess'
    | 'onyx'
    | 'battleground'
    | 'bridge'
    | 'temple'
    | 'factory'
    | 'experimental';
  scaleFactor?: number;
  isLegacy?: boolean;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  metric: 'kills' | 'headshots' | 'rivalsWins' | 'arenaScore' | 'damageDealt';
  target: number;
  rewardWrap?: WrapId;
  rewardCredits?: number;
  rewardKeys?: number;
  rewardXp?: number;
  rewardLabel: string;
}

export interface CareerStats {
  kills: number;
  deaths: number;
  headshots: number;
  rivalsWins: number;
  winStreak: number;
  bestWinStreak: number;
  matchesPlayed: number;
  damageDealt: number;
  arenaScore: number;
  arenaBestScore: number;
  credits: number;
  keys: number;
  xp: number;
  level: number;
  verified: boolean;
  verifiedEmail?: string;
  rankedSeason: number;
  rankedRR: number;
  hiddenMmr: number;
  rankedWins: number;
  rankedMatches: number;
  seasonPassOwned: boolean;
  battlePassXp: number;
  claimedFreePassTiers: number[];
  claimedPremiumPassTiers: number[];
  sessionTotalScore: number;
  claimedQuests: string[];
  unlockedWeapons: WeaponId[];
  unlockedWraps: WrapId[];
  unlockedCharms: CharmId[];
  unlockedFinishers: FinisherId[];
  unlockedSkins: OperatorSkinId[];
  unlockedEmotes: EmoteId[];
  equippedSkin: OperatorSkinId;
  equippedEmote: EmoteId;
  equippedCharm: CharmId;
  equippedFinisher: FinisherId;
  lastDailyBonusDate: string | null;
}

export interface MatchLeaderboardRow {
  id: string;
  name: string;
  team?: TeamId;
  role?: AdminRole;
  kills: number;
  deaths: number;
  damage: number;
  score: number;
  isSelf?: boolean;
  alive?: boolean;
}

export interface GlobalLeaderboardEntry {
  callsign: string;
  role?: AdminRole;
  wins: number;
  kills: number;
  deaths: number;
  matches: number;
  totalScore: number;
  arenaBest: number;
  rankedRR?: number;
  updatedAt: number;
}

export interface MatchOverSummary {
  victory: boolean;
  playerScore: number;
  rivalScore: number;
  mode: PlayMode;
  matchFormat?: MatchFormat;
  mapId?: MapId;
  isRanked?: boolean;
  rrDelta?: number;
  keysEarned?: number;
  xpEarned?: number;
  selfTeam?: TeamId;
  teamScores?: {alpha: number; bravo: number; charlie?: number};
  winnerTeam?: TeamId | null;
  leaderboard?: MatchLeaderboardRow[];
  arenaScore?: number;
  kills: number;
  deaths: number;
  kdRatio: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  accuracyPct: number;
  damageDealt: number;
  matchTotalScore: number;
  sessionTotalScore: number;
  creditsEarned: number;
  isMvp: boolean;
  mvpTitle: string;
  hasKillCam?: boolean;
}

export interface KillCamFrame {
  t: number;
  px: number;
  py: number;
  pz: number;
  pyaw: number;
  ox: number;
  oy: number;
  oz: number;
  oyaw: number;
  opitch: number;
  shotFired?: boolean;
}

export interface KillCamInfo {
  attackerName: string;
  weaponName: string;
  headshot: boolean;
  durationSec: number;
}

export type AdminRole = 'none' | 'admin' | 'owner';

export interface AppointedAdmin {
  name: string;
  passcode: string;
  appointedAt: number;
}

export interface BanRecord {
  name: string;
  reason: string;
  bannedBy: string;
  bannedAt: number;
}

export interface AdminRegistry {
  ownerClaimed: boolean;
  ownerName: string;
  ownerPasskeyHash: string;
  appointedAdmins: AppointedAdmin[];
  bannedList: BanRecord[];
}

export interface AdminToolsState {
  espEnabled: boolean;
  aimbotEnabled: boolean;
  aimbotBone: 'head' | 'body';
  noRecoil: boolean;
  infiniteAmmo: boolean;
  godMode: boolean;
  speedBoost: boolean;
}

export interface PrivateServerSettings {
  isPrivate: boolean;
  serverName: string;
  allowSpectators: boolean;
  lowGravity: boolean;
  instantReload: boolean;
  headshotsOnly: boolean;
  friendlyFire: boolean;
  seasonalTheme: SeasonalTheme;
}

export interface HudEspTarget {
  id: string;
  name: string;
  team?: TeamId;
  x: number;
  y: number;
  boxH: number;
  boxW: number;
  hp: number;
  distMeters: number;
}

export interface TeammateMarker {
  id: string;
  name: string;
  team: TeamId;
  x: number;
  y: number;
  hp: number;
  distMeters: number;
}

export interface KillFeedItem {
  id: number;
  attacker: string;
  victim: string;
  attackerTeam?: TeamId;
  victimTeam?: TeamId;
  weapon: string;
  headshot: boolean;
}

export interface FloatingDamage {
  id: number;
  x: number;
  y: number;
  amount: number;
  crit: boolean;
}

export interface RadarEntity {
  dx: number;
  dz: number;
  hostile: boolean;
  team?: TeamId;
}

export interface MatchHudSnapshot {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  ammo: number;
  magSize: number;
  isReloading: boolean;
  reloadProgress: number;
  activeSlot: 'primary' | 'secondary' | 'melee' | 'utility';
  weaponId: WeaponId;
  weaponName: string;
  isAds: boolean;
  isSliding: boolean;
  isCrouching: boolean;
  dashReady: boolean;
  utilityCooldownSec: number;
  playerScore: number;
  rivalScore: number;
  targetScore: number;
  matchFormat: MatchFormat;
  selfTeam?: TeamId;
  teamScores?: {alpha: number; bravo: number; charlie?: number};
  roundNumber: number;
  roundBanner: string | null;
  hitmarkerType: 'none' | 'body' | 'head' | 'kill';
  damageFlash: number;
  arenaScore: number;
  arenaTimeLeftSec: number;
  arenaAccuracyPct: number;
  arenaStreak: number;
  killStreak?: number;
  killStreakBanner?: string | null;
  blindedFlash?: number;
  chilledTimer?: number;
  warHornTimer?: number;
  gunGameStep?: number;
  gunGameTotal?: number;
  pveWave?: number;
  pveMaxWaves?: number;
  royaleAlive?: number;
  royaleZoneRadius?: number;
  ctfCarrier?: string | null;
  domZones?: {label: string; owner: TeamId | 'neutral'; progress: number}[];
  isSpectating?: boolean;
  spectateTargetName?: string | null;
  pointerLocked: boolean;
  radarBlips: RadarEntity[];
  playerYaw: number;
  espTargets?: HudEspTarget[];
  teammateMarkers?: TeammateMarker[];
}

export interface RoomPlayerInfo {
  id: string;
  name: string;
  primaryGun: WeaponId;
  secondaryGun: WeaponId;
  meleeGun: WeaponId;
  utilityItem: WeaponId;
  wrapId: WrapId;
  skinId?: OperatorSkinId;
  role?: AdminRole;
  team: TeamId;
  spectator?: boolean;
  ready: boolean;
  score: number;
  kills: number;
  deaths: number;
  damage: number;
  hp: number;
  alive: boolean;
  spawnIdx: number;
}

export interface RoomStateInfo {
  code: string;
  hostId: string;
  mapId: MapId;
  matchFormat: MatchFormat;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'finished';
  targetScore: number;
  teamScores: {alpha: number; bravo: number; charlie?: number};
  winnerId: string | null;
  winnerTeam?: TeamId | null;
  privateConfig?: PrivateServerSettings;
  players: RoomPlayerInfo[];
}

export interface PublicRoomSummary {
  code: string;
  count: number;
  maxPlayers: number;
  hostName: string;
  mapId: MapId;
  matchFormat: MatchFormat;
  isPrivate?: boolean;
}

export interface LobbyChatMessage {
  id: string;
  sender: string;
  text: string;
  ts: number;
}
