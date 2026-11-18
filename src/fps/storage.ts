import {MAPS, RANKED_TIERS, type RankedTierSpec} from './catalog';
import {
  BATTLE_PASS_TIERS,
  CHARMS,
  EMOTES,
  FINISHERS,
  OPERATOR_SKINS,
  SEASON_PASS_PRICE_CREDITS,
  SKIN_PACKS,
  getLocalDateKey,
} from './cosmetics';
import type {
  AdminRegistry,
  AdminRole,
  AdminToolsState,
  AudioSettings,
  BanRecord,
  CareerStats,
  CharmId,
  DailyShopOffer,
  EmoteId,
  FinisherId,
  GpuSettings,
  MapId,
  MatchFormat,
  OperatorSkinId,
  PlayMode,
  PrivateServerSettings,
  WeaponId,
  WrapId,
} from './types';
import {FREE_STARTER_WEAPONS, QUESTS, WEAPONS, WRAPS} from './weapons';

const GPU_KEY = 'apexrivals_gpu_v2';
const AUDIO_KEY = 'apexrivals_audio_v1';
const LOADOUT_KEY = 'apexrivals_loadout_v2';
const CAREER_KEY = 'apexrivals_career_v3';
const NAME_KEY = 'apexrivals_callsign_v1';
const MAP_KEY = 'apexrivals_map_v1';
const SESSION_SCORE_KEY = 'apexrivals_session_score_v1';
const ADMIN_REGISTRY_KEY = 'apexrivals_admin_registry_v1';
const ADMIN_SESSION_KEY = 'apexrivals_admin_session_v1';

export const DEFAULT_GPU_SETTINGS: GpuSettings = {
  preset: 'high',
  resolutionScale: 1.0,
  shadows: true,
  particles: true,
  bloom: true,
  fxaa: true,
  pbrTextures: true,
  cinematicFx: true,
  anisotropy: 8,
  exposure: 1.12,
  fov: 88,
  sensitivity: 1.0,
  crosshair: {
    style: 'cross',
    color: '#ffffff',
    size: 2,
    thickness: 2,
    gap: 8,
    centerDot: true,
    outline: true,
    opacity: 0.95,
  },
  showFps: true,
  showPing: true,
  showKeybinds: true,
  showDamageNumbers: true,
  cameraBob: true,
  hudScale: 'standard',
  seasonalTheme: 'normal',
};

export const DEFAULT_PRIVATE_SERVER_CONFIG: PrivateServerSettings = {
  isPrivate: false,
  serverName: 'Custom Arena Server',
  allowSpectators: true,
  lowGravity: false,
  instantReload: false,
  headshotsOnly: false,
  friendlyFire: false,
  seasonalTheme: 'normal',
};

export const DEFAULT_ADMIN_TOOLS: AdminToolsState = {
  espEnabled: false,
  aimbotEnabled: false,
  aimbotBone: 'head',
  noRecoil: false,
  infiniteAmmo: false,
  godMode: false,
  speedBoost: false,
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.75,
  sfxVolume: 0.85,
  uiVolume: 0.75,
  muted: false,
};

export interface LoadoutState {
  primary: WeaponId;
  secondary: WeaponId;
  melee: WeaponId;
  utility: WeaponId;
  wrap: WrapId;
}

const DEFAULT_LOADOUT: LoadoutState = {
  primary: 'vx47',
  secondary: 'mk2',
  melee: 'katana',
  utility: 'frag',
  wrap: 'carbon',
};

function defaultUnlockedWraps(): WrapId[] {
  return (Object.keys(WRAPS) as WrapId[]).filter((id) => WRAPS[id].unlockedByDefault);
}

const DEFAULT_CAREER: CareerStats = {
  kills: 0,
  deaths: 0,
  headshots: 0,
  rivalsWins: 0,
  winStreak: 0,
  bestWinStreak: 0,
  matchesPlayed: 0,
  damageDealt: 0,
  arenaScore: 0,
  arenaBestScore: 0,
  credits: 15,
  keys: 12,
  xp: 0,
  level: 1,
  verified: false,
  rankedSeason: 4,
  rankedRR: 0,
  hiddenMmr: 1000,
  rankedWins: 0,
  rankedMatches: 0,
  seasonPassOwned: false,
  battlePassXp: 0,
  claimedFreePassTiers: [],
  claimedPremiumPassTiers: [],
  sessionTotalScore: 0,
  claimedQuests: [],
  unlockedWeapons: [...FREE_STARTER_WEAPONS],
  unlockedWraps: defaultUnlockedWraps(),
  unlockedCharms: ['none'],
  unlockedFinishers: ['finisher_default'],
  unlockedSkins: ['default_slate'],
  unlockedEmotes: ['salute', 'spin'],
  equippedSkin: 'default_slate',
  equippedEmote: 'salute',
  equippedCharm: 'none',
  equippedFinisher: 'finisher_default',
  lastDailyBonusDate: null,
};

export function getXpForNextLevel(level: number): number {
  return Math.round(250 + Math.max(0, level - 1) * 90);
}

export function getRankedTierFromRR(rr: number): RankedTierSpec {
  for (let i = RANKED_TIERS.length - 1; i >= 0; i--) {
    if (rr >= RANKED_TIERS[i].minRR) {
      return RANKED_TIERS[i];
    }
  }
  return RANKED_TIERS[0];
}

export function getBattlePassTierFromXp(bpXp: number): number {
  let reached = 0;
  for (const tier of BATTLE_PASS_TIERS) {
    if (bpXp >= tier.xpRequired) {
      reached = tier.tier;
    }
  }
  return reached;
}

export function loadGpuSettings(): GpuSettings {
  try {
    const raw = localStorage.getItem(GPU_KEY);
    if (!raw) return DEFAULT_GPU_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GpuSettings>;
    return {
      ...DEFAULT_GPU_SETTINGS,
      ...parsed,
      seasonalTheme:
        parsed.seasonalTheme === 'halloween' || parsed.seasonalTheme === 'winter'
          ? parsed.seasonalTheme
          : 'normal',
      crosshair: {
        ...DEFAULT_GPU_SETTINGS.crosshair,
        ...(parsed.crosshair ?? {}),
      },
    };
  } catch {
    return DEFAULT_GPU_SETTINGS;
  }
}

export function saveGpuSettings(settings: GpuSettings): void {
  try {
    localStorage.setItem(GPU_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(AUDIO_KEY);
    if (!raw) return DEFAULT_AUDIO_SETTINGS;
    return {...DEFAULT_AUDIO_SETTINGS, ...(JSON.parse(raw) as Partial<AudioSettings>)};
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function loadLoadout(): LoadoutState {
  try {
    const raw = localStorage.getItem(LOADOUT_KEY);
    if (!raw) return DEFAULT_LOADOUT;
    const parsed = JSON.parse(raw) as Partial<LoadoutState>;
    return {
      primary: parsed.primary && WEAPONS[parsed.primary] ? parsed.primary : DEFAULT_LOADOUT.primary,
      secondary:
        parsed.secondary && WEAPONS[parsed.secondary] ? parsed.secondary : DEFAULT_LOADOUT.secondary,
      melee: parsed.melee && WEAPONS[parsed.melee] ? parsed.melee : DEFAULT_LOADOUT.melee,
      utility: parsed.utility && WEAPONS[parsed.utility] ? parsed.utility : DEFAULT_LOADOUT.utility,
      wrap: parsed.wrap && WRAPS[parsed.wrap] ? parsed.wrap : DEFAULT_LOADOUT.wrap,
    };
  } catch {
    return DEFAULT_LOADOUT;
  }
}

export function saveLoadout(loadout: LoadoutState): void {
  try {
    localStorage.setItem(LOADOUT_KEY, JSON.stringify(loadout));
  } catch {
    // ignore
  }
}

export function loadSelectedMap(): MapId {
  try {
    const m = localStorage.getItem(MAP_KEY) as MapId | null;
    if (m && MAPS[m]) {
      return m;
    }
  } catch {
    // ignore
  }
  return 'vanguard';
}

export function saveSelectedMap(mapId: MapId): void {
  try {
    localStorage.setItem(MAP_KEY, mapId);
  } catch {
    // ignore
  }
}

export function loadCallsign(): string {
  try {
    return localStorage.getItem(NAME_KEY) || 'Striker';
  } catch {
    return 'Striker';
  }
}

export function saveCallsign(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

export function loadSessionScore(): number {
  try {
    const v = Number(sessionStorage.getItem(SESSION_SCORE_KEY) || '0');
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function addSessionScore(points: number): number {
  const next = loadSessionScore() + Math.max(0, Math.round(points));
  try {
    sessionStorage.setItem(SESSION_SCORE_KEY, String(next));
  } catch {
    // ignore
  }
  return next;
}

export function loadCareer(): CareerStats {
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    if (!raw) {
      return {
        ...DEFAULT_CAREER,
        unlockedWeapons: [...FREE_STARTER_WEAPONS],
        unlockedWraps: defaultUnlockedWraps(),
        sessionTotalScore: loadSessionScore(),
      };
    }
    const parsed = JSON.parse(raw) as Partial<CareerStats>;
    const weapons = new Set<WeaponId>([
      ...FREE_STARTER_WEAPONS,
      ...(Array.isArray(parsed.unlockedWeapons) ? parsed.unlockedWeapons : []),
    ]);
    const wraps = new Set<WrapId>([
      ...defaultUnlockedWraps(),
      ...(Array.isArray(parsed.unlockedWraps) ? parsed.unlockedWraps : []),
    ]);
    const charms = new Set<CharmId>([
      'none',
      ...(Array.isArray(parsed.unlockedCharms) ? parsed.unlockedCharms : []),
    ]);
    const finishers = new Set<FinisherId>([
      'finisher_default',
      ...(Array.isArray(parsed.unlockedFinishers) ? parsed.unlockedFinishers : []),
    ]);
    const skins = new Set<OperatorSkinId>([
      'default_slate',
      ...(Array.isArray(parsed.unlockedSkins) ? parsed.unlockedSkins : []),
    ]);
    const emotes = new Set<EmoteId>([
      'salute',
      'spin',
      ...(Array.isArray(parsed.unlockedEmotes) ? parsed.unlockedEmotes : []),
    ]);
    return {
      ...DEFAULT_CAREER,
      ...parsed,
      sessionTotalScore: loadSessionScore(),
      claimedQuests: Array.isArray(parsed.claimedQuests) ? parsed.claimedQuests : [],
      claimedFreePassTiers: Array.isArray(parsed.claimedFreePassTiers)
        ? parsed.claimedFreePassTiers
        : [],
      claimedPremiumPassTiers: Array.isArray(parsed.claimedPremiumPassTiers)
        ? parsed.claimedPremiumPassTiers
        : [],
      unlockedWeapons: Array.from(weapons),
      unlockedWraps: Array.from(wraps),
      unlockedCharms: Array.from(charms),
      unlockedFinishers: Array.from(finishers),
      unlockedSkins: Array.from(skins),
      unlockedEmotes: Array.from(emotes),
      equippedCharm:
        parsed.equippedCharm && charms.has(parsed.equippedCharm) ? parsed.equippedCharm : 'none',
      equippedFinisher:
        parsed.equippedFinisher && finishers.has(parsed.equippedFinisher)
          ? parsed.equippedFinisher
          : 'finisher_default',
    };
  } catch {
    return {
      ...DEFAULT_CAREER,
      unlockedWeapons: [...FREE_STARTER_WEAPONS],
      unlockedWraps: defaultUnlockedWraps(),
      sessionTotalScore: loadSessionScore(),
    };
  }
}

export function saveCareer(stats: CareerStats): void {
  try {
    localStorage.setItem(CAREER_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

function applyXpAndLevel(curLevel: number, curXp: number, addedXp: number): {level: number; xp: number} {
  let level = Math.max(1, curLevel);
  let xp = Math.max(0, curXp + Math.max(0, Math.round(addedXp)));
  while (xp >= getXpForNextLevel(level)) {
    xp -= getXpForNextLevel(level);
    level += 1;
  }
  return {level, xp};
}

export function recordCareerDelta(delta: {
  kills?: number;
  deaths?: number;
  headshots?: number;
  rivalsWins?: number;
  matchWon?: boolean;
  matchLost?: boolean;
  matchesPlayed?: number;
  damageDealt?: number;
  credits?: number;
  keys?: number;
  xpAdd?: number;
  battlePassXpAdd?: number;
  arenaScoreAdd?: number;
  arenaRunScore?: number;
}): CareerStats {
  const cur = loadCareer();
  let nextStreak = cur.winStreak ?? 0;
  if (delta.matchWon) nextStreak += 1;
  else if (delta.matchLost) nextStreak = 0;

  const leveled = applyXpAndLevel(cur.level ?? 1, cur.xp ?? 0, delta.xpAdd ?? 0);

  const next: CareerStats = {
    ...cur,
    kills: cur.kills + (delta.kills ?? 0),
    deaths: cur.deaths + (delta.deaths ?? 0),
    headshots: cur.headshots + (delta.headshots ?? 0),
    rivalsWins: cur.rivalsWins + (delta.rivalsWins ?? 0),
    winStreak: nextStreak,
    bestWinStreak: Math.max(cur.bestWinStreak ?? 0, nextStreak),
    matchesPlayed: cur.matchesPlayed + (delta.matchesPlayed ?? 0),
    damageDealt: cur.damageDealt + (delta.damageDealt ?? 0),
    credits: cur.credits + (delta.credits ?? 0),
    keys: (cur.keys ?? 0) + (delta.keys ?? 0),
    level: leveled.level,
    xp: leveled.xp,
    battlePassXp: (cur.battlePassXp ?? 0) + Math.max(0, Math.round(delta.battlePassXpAdd ?? 0)),
    arenaScore: cur.arenaScore + (delta.arenaScoreAdd ?? 0),
    arenaBestScore: Math.max(cur.arenaBestScore, delta.arenaRunScore ?? 0),
  };
  saveCareer(next);
  return next;
}

export function grantMatchRewards(opts: {
  victory: boolean;
  mode: PlayMode;
  matchFormat?: MatchFormat;
  isRanked?: boolean;
  kills: number;
  matchTotalScore: number;
}): {
  career: CareerStats;
  keysEarned: number;
  xpEarned: number;
  rrDelta: number;
} {
  const cur = loadCareer();
  const isRange = opts.mode === 'shooting_arena';
  const keysEarned = isRange
    ? opts.matchTotalScore >= 1200
      ? 2
      : 1
    : (opts.victory ? 4 : 2) + Math.min(3, Math.floor(opts.kills / 3));
  const xpEarned = isRange
    ? Math.max(90, Math.round(opts.matchTotalScore * 0.14))
    : (opts.victory ? 260 : 140) + opts.kills * 28 + Math.min(180, Math.round(opts.matchTotalScore * 0.05));
  const bpEarned = Math.round(xpEarned * 0.85);

  let rrDelta = 0;
  let nextMmr = cur.hiddenMmr ?? 1000;
  let nextRR = cur.rankedRR ?? 0;
  let nextRankedWins = cur.rankedWins ?? 0;
  let nextRankedMatches = cur.rankedMatches ?? 0;

  if (opts.isRanked && !isRange) {
    nextRankedMatches += 1;
    const mmrFactor = Math.max(-12, Math.min(14, Math.round((nextMmr - (1000 + nextRR * 0.4)) / 35)));
    if (opts.victory) {
      rrDelta = 34 + Math.max(0, mmrFactor) + Math.min(8, opts.kills);
      nextMmr = Math.min(4000, nextMmr + 28 + opts.kills * 2);
      nextRankedWins += 1;
    } else {
      rrDelta = -Math.max(12, 22 - Math.max(0, mmrFactor));
      nextMmr = Math.max(400, nextMmr - 18);
    }
    nextRR = Math.max(0, nextRR + rrDelta);
  }

  const leveled = applyXpAndLevel(cur.level ?? 1, cur.xp ?? 0, xpEarned);
  const next: CareerStats = {
    ...cur,
    keys: (cur.keys ?? 0) + keysEarned,
    level: leveled.level,
    xp: leveled.xp,
    battlePassXp: (cur.battlePassXp ?? 0) + bpEarned,
    rankedRR: nextRR,
    hiddenMmr: nextMmr,
    rankedWins: nextRankedWins,
    rankedMatches: nextRankedMatches,
  };
  saveCareer(next);
  return {career: next, keysEarned, xpEarned, rrDelta};
}

export function verifyOperatorAccount(email: string): {
  ok: boolean;
  reason?: string;
  career: CareerStats;
} {
  const cur = loadCareer();
  const clean = email.trim();
  if (!clean.includes('@') || !clean.includes('.') || clean.length < 5) {
    return {ok: false, reason: 'Enter a valid email address for operator verification.', career: cur};
  }
  const next: CareerStats = {
    ...cur,
    verified: true,
    verifiedEmail: clean,
  };
  saveCareer(next);
  return {ok: true, career: next};
}

export function performSeasonalRankedReset(): CareerStats {
  const cur = loadCareer();
  const next: CareerStats = {
    ...cur,
    rankedSeason: (cur.rankedSeason ?? 4) + 1,
    rankedRR: 0,
    rankedWins: 0,
    rankedMatches: 0,
    hiddenMmr: Math.round((cur.hiddenMmr ?? 1000) * 0.75 + 250),
    battlePassXp: 0,
    claimedFreePassTiers: [],
    claimedPremiumPassTiers: [],
    seasonPassOwned: false,
  };
  saveCareer(next);
  return next;
}

export function getCompetitiveRank(stats: CareerStats): {
  label: string;
  colorHex: string;
  mmr: number;
} {
  const tierSpec = getRankedTierFromRR(stats.rankedRR ?? 0);
  if ((stats.rankedRR ?? 0) > 0) {
    return {
      label: tierSpec.tier,
      colorHex: tierSpec.colorHex,
      mmr: stats.rankedRR ?? 0,
    };
  }
  const mmr =
    stats.rivalsWins * 120 +
    stats.kills * 18 +
    stats.headshots * 10 +
    Math.round(stats.arenaBestScore * 0.15);
  if (mmr >= 4500) return {label: 'Archnemesis', colorHex: '#fbbf24', mmr};
  if (mmr >= 3200) return {label: 'Nemesis', colorHex: '#f43f5e', mmr};
  if (mmr >= 2200) return {label: 'Onyx', colorHex: '#c084fc', mmr};
  if (mmr >= 1500) return {label: 'Diamond', colorHex: '#38bdf8', mmr};
  if (mmr >= 850) return {label: 'Platinum', colorHex: '#2dd4bf', mmr};
  if (mmr >= 420) return {label: 'Gold', colorHex: '#facc15', mmr};
  if (mmr >= 160) return {label: 'Silver', colorHex: '#cbd5e1', mmr};
  return {label: 'Bronze', colorHex: '#fb923c', mmr};
}

export function claimQuestReward(questId: string): CareerStats {
  const cur = loadCareer();
  const q = QUESTS.find((item) => item.id === questId);
  if (!q) return cur;
  const val = cur[q.metric];
  if (val < q.target || cur.claimedQuests.includes(questId)) {
    return cur;
  }
  const nextWraps = new Set<WrapId>(cur.unlockedWraps);
  if (q.rewardWrap) nextWraps.add(q.rewardWrap);
  const leveled = applyXpAndLevel(cur.level ?? 1, cur.xp ?? 0, q.rewardXp ?? 0);
  const next: CareerStats = {
    ...cur,
    credits: cur.credits + (q.rewardCredits ?? 0),
    keys: (cur.keys ?? 0) + (q.rewardKeys ?? 0),
    level: leveled.level,
    xp: leveled.xp,
    battlePassXp: (cur.battlePassXp ?? 0) + Math.round((q.rewardXp ?? 0) * 0.7),
    claimedQuests: [...cur.claimedQuests, questId],
    unlockedWraps: Array.from(nextWraps),
  };
  saveCareer(next);
  return next;
}

export function claimDailyBonus(): {claimed: boolean; amount: number; keysAmount: number; career: CareerStats} {
  const cur = loadCareer();
  const today = getLocalDateKey();
  if (cur.lastDailyBonusDate === today) {
    return {claimed: false, amount: 0, keysAmount: 0, career: cur};
  }
  const amount = 3;
  const keysAmount = 4;
  const next: CareerStats = {
    ...cur,
    credits: cur.credits + amount,
    keys: (cur.keys ?? 0) + keysAmount,
    lastDailyBonusDate: today,
  };
  saveCareer(next);
  return {claimed: true, amount, keysAmount, career: next};
}

export function purchaseWeapon(weaponId: WeaponId): {
  ok: boolean;
  reason?: string;
  career: CareerStats;
} {
  const cur = loadCareer();
  const spec = WEAPONS[weaponId];
  if (!spec) return {ok: false, reason: 'Weapon not found', career: cur};
  if (cur.unlockedWeapons.includes(weaponId) || spec.unlockType === 'free') {
    const unlocked = cur.unlockedWeapons.includes(weaponId)
      ? cur.unlockedWeapons
      : [...cur.unlockedWeapons, weaponId];
    const next = {...cur, unlockedWeapons: unlocked};
    saveCareer(next);
    return {ok: true, career: next};
  }
  if (spec.unlockType === 'battlepass') {
    return {ok: false, reason: 'Unlock via Season 4 Battle Pass progression.', career: cur};
  }
  const cost = spec.unlockCost ?? 3;
  if (spec.unlockType === 'keys') {
    if ((cur.keys ?? 0) < cost) {
      return {ok: false, reason: `Need ${cost} Keys to unlock Contraband ${spec.name}.`, career: cur};
    }
    const next: CareerStats = {
      ...cur,
      keys: (cur.keys ?? 0) - cost,
      unlockedWeapons: [...cur.unlockedWeapons, weaponId],
    };
    saveCareer(next);
    return {ok: true, career: next};
  }
  if (cur.credits < cost) {
    return {ok: false, reason: `Need $${cost} to unlock ${spec.name}.`, career: cur};
  }
  const next: CareerStats = {
    ...cur,
    credits: cur.credits - cost,
    unlockedWeapons: [...cur.unlockedWeapons, weaponId],
  };
  saveCareer(next);
  return {ok: true, career: next};
}

export function purchaseCharm(charmId: CharmId): {
  ok: boolean;
  reason?: string;
  career: CareerStats;
} {
  const cur = loadCareer();
  const spec = CHARMS[charmId];
  if (!spec) return {ok: false, reason: 'Charm not found', career: cur};
  if (cur.unlockedCharms.includes(charmId)) {
    const next = {...cur, equippedCharm: charmId};
    saveCareer(next);
    return {ok: true, career: next};
  }
  if (cur.credits < spec.priceCredits) {
    return {ok: false, reason: `Need $${spec.priceCredits}`, career: cur};
  }
  const next: CareerStats = {
    ...cur,
    credits: cur.credits - spec.priceCredits,
    unlockedCharms: [...cur.unlockedCharms, charmId],
    equippedCharm: charmId,
  };
  saveCareer(next);
  return {ok: true, career: next};
}

export function purchaseFinisher(finisherId: FinisherId): {
  ok: boolean;
  reason?: string;
  career: CareerStats;
} {
  const cur = loadCareer();
  const spec = FINISHERS[finisherId];
  if (!spec) return {ok: false, reason: 'Finisher not found', career: cur};
  if (cur.unlockedFinishers.includes(finisherId)) {
    const next = {...cur, equippedFinisher: finisherId};
    saveCareer(next);
    return {ok: true, career: next};
  }
  if (cur.credits < spec.priceCredits) {
    return {ok: false, reason: `Need $${spec.priceCredits}`, career: cur};
  }
  const next: CareerStats = {
    ...cur,
    credits: cur.credits - spec.priceCredits,
    unlockedFinishers: [...cur.unlockedFinishers, finisherId],
    equippedFinisher: finisherId,
  };
  saveCareer(next);
  return {ok: true, career: next};
}

export function purchaseSeasonPass(): {
  ok: boolean;
  reason?: string;
  career: CareerStats;
} {
  const cur = loadCareer();
  if (cur.seasonPassOwned) return {ok: true, career: cur};
  if (cur.credits < SEASON_PASS_PRICE_CREDITS) {
    return {
      ok: false,
      reason: `Need $${SEASON_PASS_PRICE_CREDITS} to activate the Season 4 Pass.`,
      career: cur,
    };
  }
  const next: CareerStats = {
    ...cur,
    credits: cur.credits - SEASON_PASS_PRICE_CREDITS,
    seasonPassOwned: true,
  };
  saveCareer(next);
  return {ok: true, career: next};
}

export function claimBattlePassTier(
  tierNum: number,
  track: 'free' | 'premium',
): {ok: boolean; reason?: string; career: CareerStats} {
  const cur = loadCareer();
  const tierSpec = BATTLE_PASS_TIERS.find((t) => t.tier === tierNum);
  if (!tierSpec) return {ok: false, reason: 'Tier not found', career: cur};
  if ((cur.battlePassXp ?? 0) < tierSpec.xpRequired) {
    return {ok: false, reason: `Requires ${tierSpec.xpRequired} BP XP`, career: cur};
  }
  if (track === 'premium' && !cur.seasonPassOwned) {
    return {ok: false, reason: 'Activate Premium Season Pass to claim premium track.', career: cur};
  }
  const claimedArr = track === 'free' ? cur.claimedFreePassTiers : cur.claimedPremiumPassTiers;
  if (claimedArr.includes(tierNum)) {
    return {ok: false, reason: 'Already claimed.', career: cur};
  }

  const reward = track === 'free' ? tierSpec.freeReward : tierSpec.premiumReward;
  const nextWeapons = new Set<WeaponId>(cur.unlockedWeapons);
  const nextWraps = new Set<WrapId>(cur.unlockedWraps);
  const nextCharms = new Set<CharmId>(cur.unlockedCharms);
  const nextFinishers = new Set<FinisherId>(cur.unlockedFinishers);
  const nextSkins = new Set<OperatorSkinId>(cur.unlockedSkins);

  if (reward.weaponId) nextWeapons.add(reward.weaponId);
  if (reward.wrapId) nextWraps.add(reward.wrapId);
  if ('charmId' in reward && reward.charmId) nextCharms.add(reward.charmId);
  if ('finisherId' in reward && reward.finisherId) nextFinishers.add(reward.finisherId);
  if ('skinId' in reward && reward.skinId) nextSkins.add(reward.skinId);

  const next: CareerStats = {
    ...cur,
    credits: cur.credits + (reward.credits ?? 0),
    keys: (cur.keys ?? 0) + (reward.keys ?? 0),
    unlockedWeapons: Array.from(nextWeapons),
    unlockedWraps: Array.from(nextWraps),
    unlockedCharms: Array.from(nextCharms),
    unlockedFinishers: Array.from(nextFinishers),
    unlockedSkins: Array.from(nextSkins),
    claimedFreePassTiers:
      track === 'free' ? [...cur.claimedFreePassTiers, tierNum] : cur.claimedFreePassTiers,
    claimedPremiumPassTiers:
      track === 'premium'
        ? [...cur.claimedPremiumPassTiers, tierNum]
        : cur.claimedPremiumPassTiers,
  };
  saveCareer(next);
  return {ok: true, career: next};
}

export function purchaseSkinPack(packId: string): {
  ok: boolean;
  reason?: string;
  career: CareerStats;
  packWrap?: WrapId;
  packSkin?: OperatorSkinId;
} {
  const cur = loadCareer();
  const pack = SKIN_PACKS.find((p) => p.id === packId);
  if (!pack) return {ok: false, reason: 'Pack not found', career: cur};

  const ownsAll =
    cur.unlockedSkins.includes(pack.skinId) &&
    cur.unlockedWraps.includes(pack.wrapId) &&
    (!pack.emoteId || cur.unlockedEmotes.includes(pack.emoteId));

  if (ownsAll) {
    const equipped: CareerStats = {
      ...cur,
      equippedSkin: pack.skinId,
    };
    saveCareer(equipped);
    return {ok: true, career: equipped, packWrap: pack.wrapId, packSkin: pack.skinId};
  }

  if (cur.credits < pack.price) {
    return {ok: false, reason: `Need $${pack.price} (play matches or claim quests)`, career: cur};
  }

  const nextSkins = new Set<OperatorSkinId>(cur.unlockedSkins);
  nextSkins.add(pack.skinId);
  const nextWraps = new Set<WrapId>(cur.unlockedWraps);
  nextWraps.add(pack.wrapId);
  const nextEmotes = new Set<EmoteId>(cur.unlockedEmotes);
  if (pack.emoteId) nextEmotes.add(pack.emoteId);

  const next: CareerStats = {
    ...cur,
    credits: cur.credits - pack.price,
    unlockedSkins: Array.from(nextSkins),
    unlockedWraps: Array.from(nextWraps),
    unlockedEmotes: Array.from(nextEmotes),
    equippedSkin: pack.skinId,
    equippedEmote: pack.emoteId ?? cur.equippedEmote,
  };
  saveCareer(next);
  return {ok: true, career: next, packWrap: pack.wrapId, packSkin: pack.skinId};
}

export function purchaseDailyOffer(offer: DailyShopOffer): {
  ok: boolean;
  reason?: string;
  career: CareerStats;
  unlockedWrap?: WrapId;
  unlockedSkin?: OperatorSkinId;
  unlockedEmote?: EmoteId;
  unlockedWeapon?: WeaponId;
} {
  const cur = loadCareer();

  if (offer.kind === 'weapon') {
    const wid = offer.itemId as WeaponId;
    if (cur.unlockedWeapons.includes(wid)) {
      return {ok: true, career: cur, unlockedWeapon: wid};
    }
    const useKeys = offer.currency === 'keys';
    if (useKeys) {
      if ((cur.keys ?? 0) < offer.price) {
        return {ok: false, reason: `Need ${offer.price} Keys`, career: cur};
      }
      const next: CareerStats = {
        ...cur,
        keys: (cur.keys ?? 0) - offer.price,
        unlockedWeapons: [...cur.unlockedWeapons, wid],
      };
      saveCareer(next);
      return {ok: true, career: next, unlockedWeapon: wid};
    }
    if (cur.credits < offer.price) {
      return {ok: false, reason: `Need $${offer.price}`, career: cur};
    }
    const next: CareerStats = {
      ...cur,
      credits: cur.credits - offer.price,
      unlockedWeapons: [...cur.unlockedWeapons, wid],
    };
    saveCareer(next);
    return {ok: true, career: next, unlockedWeapon: wid};
  }

  if (offer.kind === 'charm') {
    const cid = offer.itemId as CharmId;
    if (cur.unlockedCharms.includes(cid)) {
      const next = {...cur, equippedCharm: cid};
      saveCareer(next);
      return {ok: true, career: next};
    }
    if (cur.credits < offer.price) {
      return {ok: false, reason: `Need $${offer.price}`, career: cur};
    }
    const next: CareerStats = {
      ...cur,
      credits: cur.credits - offer.price,
      unlockedCharms: [...cur.unlockedCharms, cid],
      equippedCharm: cid,
    };
    saveCareer(next);
    return {ok: true, career: next};
  }

  if (offer.kind === 'finisher') {
    const fid = offer.itemId as FinisherId;
    if (cur.unlockedFinishers.includes(fid)) {
      const next = {...cur, equippedFinisher: fid};
      saveCareer(next);
      return {ok: true, career: next};
    }
    if (cur.credits < offer.price) {
      return {ok: false, reason: `Need $${offer.price}`, career: cur};
    }
    const next: CareerStats = {
      ...cur,
      credits: cur.credits - offer.price,
      unlockedFinishers: [...cur.unlockedFinishers, fid],
      equippedFinisher: fid,
    };
    saveCareer(next);
    return {ok: true, career: next};
  }

  if (offer.kind === 'skin') {
    const sid = offer.itemId as OperatorSkinId;
    if (cur.unlockedSkins.includes(sid)) {
      const next = {...cur, equippedSkin: sid};
      saveCareer(next);
      return {ok: true, career: next, unlockedSkin: sid};
    }
    if (cur.credits < offer.price) {
      return {ok: false, reason: `Need $${offer.price}`, career: cur};
    }
    const next: CareerStats = {
      ...cur,
      credits: cur.credits - offer.price,
      unlockedSkins: [...cur.unlockedSkins, sid],
      equippedSkin: sid,
    };
    saveCareer(next);
    return {ok: true, career: next, unlockedSkin: sid};
  }

  if (offer.kind === 'wrap') {
    const wid = offer.itemId as WrapId;
    if (cur.unlockedWraps.includes(wid)) {
      return {ok: true, career: cur, unlockedWrap: wid};
    }
    if (cur.credits < offer.price) {
      return {ok: false, reason: `Need $${offer.price}`, career: cur};
    }
    const next: CareerStats = {
      ...cur,
      credits: cur.credits - offer.price,
      unlockedWraps: [...cur.unlockedWraps, wid],
    };
    saveCareer(next);
    return {ok: true, career: next, unlockedWrap: wid};
  }

  const eid = offer.itemId as EmoteId;
  if (cur.unlockedEmotes.includes(eid)) {
    const next = {...cur, equippedEmote: eid};
    saveCareer(next);
    return {ok: true, career: next, unlockedEmote: eid};
  }
  if (cur.credits < offer.price) {
    return {ok: false, reason: `Need $${offer.price}`, career: cur};
  }
  const next: CareerStats = {
    ...cur,
    credits: cur.credits - offer.price,
    unlockedEmotes: [...cur.unlockedEmotes, eid],
    equippedEmote: eid,
  };
  saveCareer(next);
  return {ok: true, career: next, unlockedEmote: eid};
}

export function purchaseEmote(emoteId: EmoteId): {
  ok: boolean;
  reason?: string;
  career: CareerStats;
} {
  const cur = loadCareer();
  const spec = EMOTES[emoteId];
  if (!spec) return {ok: false, reason: 'Invalid emote', career: cur};
  if (cur.unlockedEmotes.includes(emoteId)) {
    const next = {...cur, equippedEmote: emoteId};
    saveCareer(next);
    return {ok: true, career: next};
  }
  if (cur.credits < spec.price) {
    return {ok: false, reason: `Need $${spec.price}`, career: cur};
  }
  const next: CareerStats = {
    ...cur,
    credits: cur.credits - spec.price,
    unlockedEmotes: [...cur.unlockedEmotes, emoteId],
    equippedEmote: emoteId,
  };
  saveCareer(next);
  return {ok: true, career: next};
}

export function purchaseOperatorSkin(skinId: OperatorSkinId): {
  ok: boolean;
  reason?: string;
  career: CareerStats;
} {
  const cur = loadCareer();
  const spec = OPERATOR_SKINS[skinId];
  if (!spec) return {ok: false, reason: 'Invalid skin', career: cur};
  if (cur.unlockedSkins.includes(skinId)) {
    const next = {...cur, equippedSkin: skinId};
    saveCareer(next);
    return {ok: true, career: next};
  }
  if (cur.credits < spec.price) {
    return {ok: false, reason: `Need $${spec.price}`, career: cur};
  }
  const next: CareerStats = {
    ...cur,
    credits: cur.credits - spec.price,
    unlockedSkins: [...cur.unlockedSkins, skinId],
    equippedSkin: skinId,
  };
  saveCareer(next);
  return {ok: true, career: next};
}

export function equipCosmetic(opts: {
  skinId?: OperatorSkinId;
  emoteId?: EmoteId;
  charmId?: CharmId;
  finisherId?: FinisherId;
}): CareerStats {
  const cur = loadCareer();
  const next: CareerStats = {
    ...cur,
    equippedSkin:
      opts.skinId && cur.unlockedSkins.includes(opts.skinId) ? opts.skinId : cur.equippedSkin,
    equippedEmote:
      opts.emoteId && cur.unlockedEmotes.includes(opts.emoteId)
        ? opts.emoteId
        : cur.equippedEmote,
    equippedCharm:
      opts.charmId && cur.unlockedCharms.includes(opts.charmId)
        ? opts.charmId
        : cur.equippedCharm,
    equippedFinisher:
      opts.finisherId && cur.unlockedFinishers.includes(opts.finisherId)
        ? opts.finisherId
        : cur.equippedFinisher,
  };
  saveCareer(next);
  return next;
}

function hashSecret(val: string): string {
  const input = `apex_rivals_rbac::${val.trim()}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

const DEFAULT_ADMIN_REGISTRY: AdminRegistry = {
  ownerClaimed: false,
  ownerName: '',
  ownerPasskeyHash: '',
  appointedAdmins: [],
  bannedList: [],
};

export function loadAdminRegistry(): AdminRegistry {
  try {
    const raw = localStorage.getItem(ADMIN_REGISTRY_KEY);
    if (!raw) return {...DEFAULT_ADMIN_REGISTRY};
    const parsed = JSON.parse(raw) as Partial<AdminRegistry>;
    return {
      ownerClaimed: Boolean(parsed.ownerClaimed),
      ownerName: typeof parsed.ownerName === 'string' ? parsed.ownerName : '',
      ownerPasskeyHash:
        typeof parsed.ownerPasskeyHash === 'string' ? parsed.ownerPasskeyHash : '',
      appointedAdmins: Array.isArray(parsed.appointedAdmins) ? parsed.appointedAdmins : [],
      bannedList: Array.isArray(parsed.bannedList) ? parsed.bannedList : [],
    };
  } catch {
    return {...DEFAULT_ADMIN_REGISTRY};
  }
}

export function saveAdminRegistry(reg: AdminRegistry): void {
  try {
    localStorage.setItem(ADMIN_REGISTRY_KEY, JSON.stringify(reg));
  } catch {
    // ignore
  }
}

export function loadSessionAdminRole(): {role: AdminRole; label: string} {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return {role: 'none', label: ''};
    const parsed = JSON.parse(raw) as {role?: AdminRole; label?: string};
    if (parsed.role === 'owner' || parsed.role === 'admin') {
      return {role: parsed.role, label: parsed.label || ''};
    }
  } catch {
    // ignore
  }
  return {role: 'none', label: ''};
}

export function saveSessionAdminRole(role: AdminRole, label: string): void {
  try {
    if (role === 'none') {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } else {
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({role, label}));
    }
  } catch {
    // ignore
  }
}

export function claimOwnershipLocal(
  ownerName: string,
  passkey: string,
): {ok: boolean; reason?: string; registry: AdminRegistry} {
  const reg = loadAdminRegistry();
  const cleanPass = passkey.trim();
  const cleanName = ownerName.trim() || 'Owner';
  if (cleanPass.length < 4) {
    return {ok: false, reason: 'Owner passkey must be at least 4 characters.', registry: reg};
  }
  if (reg.ownerClaimed && reg.ownerPasskeyHash !== hashSecret(cleanPass)) {
    return {ok: false, reason: 'Ownership is already claimed on this device.', registry: reg};
  }
  const next: AdminRegistry = {
    ...reg,
    ownerClaimed: true,
    ownerName: cleanName,
    ownerPasskeyHash: hashSecret(cleanPass),
  };
  saveAdminRegistry(next);
  saveSessionAdminRole('owner', cleanName);
  return {ok: true, registry: next};
}

export function authenticateAdminLocal(
  callsign: string,
  passkey: string,
): {ok: boolean; role: AdminRole; label: string; reason?: string} {
  const reg = loadAdminRegistry();
  if (!reg.ownerClaimed) {
    return {ok: false, role: 'none', label: '', reason: 'Owner has not been claimed yet.'};
  }
  const cleanPass = passkey.trim();
  if (hashSecret(cleanPass) === reg.ownerPasskeyHash) {
    saveSessionAdminRole('owner', reg.ownerName || callsign);
    return {ok: true, role: 'owner', label: reg.ownerName || callsign};
  }
  const match = reg.appointedAdmins.find(
    (a) =>
      a.passcode === cleanPass &&
      (!a.name || a.name.toLowerCase() === callsign.trim().toLowerCase()),
  );
  if (match) {
    saveSessionAdminRole('admin', match.name || callsign);
    return {ok: true, role: 'admin', label: match.name || callsign};
  }
  return {
    ok: false,
    role: 'none',
    label: '',
    reason: 'Invalid Owner passkey or Admin invite code.',
  };
}

export function appointAdminLocal(
  name: string,
  passcode: string,
): {ok: boolean; reason?: string; registry: AdminRegistry} {
  const reg = loadAdminRegistry();
  const cleanName = name.trim();
  const cleanCode = passcode.trim();
  if (!cleanName) {
    return {ok: false, reason: 'Enter a player callsign to appoint.', registry: reg};
  }
  if (cleanCode.length < 4) {
    return {ok: false, reason: 'Admin passcode must be at least 4 characters.', registry: reg};
  }
  const filtered = reg.appointedAdmins.filter(
    (a) => a.name.toLowerCase() !== cleanName.toLowerCase(),
  );
  const next: AdminRegistry = {
    ...reg,
    appointedAdmins: [
      ...filtered,
      {name: cleanName, passcode: cleanCode, appointedAt: Date.now()},
    ],
  };
  saveAdminRegistry(next);
  return {ok: true, registry: next};
}

export function revokeAdminLocal(name: string): AdminRegistry {
  const reg = loadAdminRegistry();
  const next: AdminRegistry = {
    ...reg,
    appointedAdmins: reg.appointedAdmins.filter(
      (a) => a.name.toLowerCase() !== name.trim().toLowerCase(),
    ),
  };
  saveAdminRegistry(next);
  return next;
}

export function banPlayerLocal(name: string, reason: string, bannedBy: string): AdminRegistry {
  const reg = loadAdminRegistry();
  const clean = name.trim();
  if (!clean) return reg;
  const record: BanRecord = {
    name: clean,
    reason: reason.trim() || 'Banned by Admin',
    bannedBy: bannedBy || 'Owner',
    bannedAt: Date.now(),
  };
  const next: AdminRegistry = {
    ...reg,
    bannedList: [
      record,
      ...reg.bannedList.filter((b) => b.name.toLowerCase() !== clean.toLowerCase()),
    ],
  };
  saveAdminRegistry(next);
  return next;
}

export function unbanPlayerLocal(name: string): AdminRegistry {
  const reg = loadAdminRegistry();
  const next: AdminRegistry = {
    ...reg,
    bannedList: reg.bannedList.filter(
      (b) => b.name.toLowerCase() !== name.trim().toLowerCase(),
    ),
  };
  saveAdminRegistry(next);
  return next;
}
