import {RANKED_TIERS} from './catalog';
import type {
  BattlePassTier,
  CharmId,
  CharmSpec,
  DailyShopOffer,
  EmoteId,
  EmoteSpec,
  FinisherId,
  FinisherSpec,
  OperatorSkinId,
  OperatorSkinSpec,
  SkinPackSpec,
  WeaponId,
  WrapId,
} from './types';
import {WEAPONS, WRAPS} from './weapons';

export {RANKED_TIERS};

export const SEASON_PASS_PRICE_CREDITS = 8;

export const OPERATOR_SKINS: Record<OperatorSkinId, OperatorSkinSpec> = {
  default_slate: {
    id: 'default_slate',
    name: 'Apex Striker',
    subtitle: 'Standard issue slate composite armor',
    primaryHex: '#2563eb',
    visorHex: '#38bdf8',
    price: 0,
  },
  olive_recon: {
    id: 'olive_recon',
    name: 'Olive Recon',
    subtitle: 'Field-ready ranger plating & amber HUD visor',
    primaryHex: '#4d7c0f',
    visorHex: '#facc15',
    packCategory: 1,
    price: 1,
  },
  vanguard_blaze: {
    id: 'vanguard_blaze',
    name: 'Blaze Vanguard',
    subtitle: 'Molten orange ceramic alloy & solar optic',
    primaryHex: '#ea580c',
    visorHex: '#fde047',
    packCategory: 2,
    price: 2,
  },
  cyber_recon: {
    id: 'cyber_recon',
    name: 'Frost Recon',
    subtitle: 'Cryo titanium frame & glacial visor',
    primaryHex: '#0284c7',
    visorHex: '#a5f3fc',
    packCategory: 3,
    price: 3,
  },
  shadow_ops: {
    id: 'shadow_ops',
    name: 'Shadow Phantom',
    subtitle: 'Matte obsidian stealth rig & toxic emerald visor',
    primaryHex: '#18181b',
    visorHex: '#84cc16',
    packCategory: 4,
    price: 4,
  },
  solar_mythic: {
    id: 'solar_mythic',
    name: 'Solar Sovereign',
    subtitle: 'Championship violet-gold exo-frame',
    primaryHex: '#7e22ce',
    visorHex: '#facc15',
    packCategory: 5,
    price: 5,
  },
  frost_warden: {
    id: 'frost_warden',
    name: 'Arctic Warden',
    subtitle: 'Glacier white winter ops armor',
    primaryHex: '#cbd5e1',
    visorHex: '#0ea5e9',
    price: 3,
  },
  crimson_knight: {
    id: 'crimson_knight',
    name: 'Crimson Ronin',
    subtitle: 'Anodized blood-red duelist plating',
    primaryHex: '#991b1b',
    visorHex: '#fbbf24',
    price: 4,
  },
  neon_shogun: {
    id: 'neon_shogun',
    name: 'Neon Shogun',
    subtitle: 'Cybernetic magenta-trimmed arena champion',
    primaryHex: '#312e81',
    visorHex: '#f472b6',
    price: 5,
  },
};

export const EMOTES: Record<EmoteId, EmoteSpec> = {
  salute: {
    id: 'salute',
    name: 'Tactical Salute',
    description: 'Crisp combat salute ready for deployment.',
    price: 0,
    accentHex: '#38bdf8',
    animationStyle: 'salute',
  },
  spin: {
    id: 'spin',
    name: '360 Gun Spin',
    description: 'Signature barrel twirl & quick draw flourish.',
    price: 0,
    accentHex: '#f97316',
    animationStyle: 'spin',
  },
  flex: {
    id: 'flex',
    name: 'Victory Flex',
    description: 'Power stance celebrate after clutching a round.',
    price: 2,
    accentHex: '#22c55e',
    animationStyle: 'flex',
  },
  shadowbox: {
    id: 'shadowbox',
    name: 'Shadowbox Combo',
    description: 'Rapid twin-jab warmup stance in the arena.',
    price: 3,
    accentHex: '#fb7185',
    animationStyle: 'shadowbox',
  },
  hologg: {
    id: 'hologg',
    name: 'Holo GG Wave',
    description: 'Drop a sporty GG flash wave to rivals.',
    price: 4,
    accentHex: '#a855f7',
    animationStyle: 'hologg',
  },
  crown: {
    id: 'crown',
    name: 'Apex Crown',
    description: 'Golden MVP salute reserved for top finishers.',
    price: 5,
    accentHex: '#facc15',
    animationStyle: 'crown',
  },
};

export const CHARMS: Record<CharmId, CharmSpec> = {
  none: {
    id: 'none',
    name: 'No Charm',
    subtitle: 'Clean receiver rail without hanging trinket',
    colorHex: '#64748b',
    priceCredits: 0,
  },
  charm_dice: {
    id: 'charm_dice',
    name: 'Tactical Dice',
    subtitle: 'Lucky anodized cube swinging on your barrel mount',
    colorHex: '#f8fafc',
    priceCredits: 2,
  },
  charm_crown: {
    id: 'charm_crown',
    name: 'Rival Crown',
    subtitle: 'Brushed 24k miniature crown emblem',
    colorHex: '#facc15',
    priceCredits: 4,
    priceKeys: 4,
  },
  charm_flame: {
    id: 'charm_flame',
    name: 'Ember Core',
    subtitle: 'Glowing thermal reactor crystal charm',
    colorHex: '#f97316',
    priceCredits: 3,
  },
  charm_ice: {
    id: 'charm_ice',
    name: 'Permafrost Shard',
    subtitle: 'Sub-zero prism dangling from side rail',
    colorHex: '#67e8f9',
    priceCredits: 3,
    priceKeys: 3,
  },
  charm_skull: {
    id: 'charm_skull',
    name: 'Reaper Skull',
    subtitle: 'Obsidian Halloween edition skull pendant',
    colorHex: '#c084fc',
    priceCredits: 4,
  },
  charm_key: {
    id: 'charm_key',
    name: 'Contraband Key',
    subtitle: 'Golden master key symbolizing unlocked Contraband gear',
    colorHex: '#fbbf24',
    priceCredits: 5,
    priceKeys: 5,
  },
};

export const FINISHERS: Record<FinisherId, FinisherSpec> = {
  finisher_default: {
    id: 'finisher_default',
    name: 'Kinetic Impact',
    subtitle: 'Classic clean spark burst upon elimination',
    colorHex: '#38bdf8',
    priceCredits: 0,
  },
  finisher_vaporize: {
    id: 'finisher_vaporize',
    name: 'Plasma Vaporize',
    subtitle: 'Dissolves defeated rivals into rising neon plasma rings',
    colorHex: '#22d3ee',
    priceCredits: 4,
  },
  finisher_shatter: {
    id: 'finisher_shatter',
    name: 'Cryo Shatter',
    subtitle: 'Freezes and shatters eliminated opponents into ice shards',
    colorHex: '#67e8f9',
    priceCredits: 4,
    priceKeys: 4,
  },
  finisher_lightning: {
    id: 'finisher_lightning',
    name: 'Orbital Strike',
    subtitle: 'Calls down an electric sky beam onto the elimination spot',
    colorHex: '#facc15',
    priceCredits: 5,
    priceKeys: 5,
  },
  finisher_nova: {
    id: 'finisher_nova',
    name: 'Prismatic Nova',
    subtitle: 'Detonates a violet-gold shockwave sphere on final blow',
    colorHex: '#c084fc',
    priceCredits: 6,
  },
  finisher_halloween: {
    id: 'finisher_halloween',
    name: 'Phantom Harvest',
    subtitle: 'Haunted pumpkin-orange vortex swirl on elimination',
    colorHex: '#fb923c',
    priceCredits: 5,
  },
};

// Strictly 5 Categories: price increases by $1 per category ($1, $2, $3, $4, $5)
export const SKIN_PACKS: SkinPackSpec[] = [
  {
    id: 'pack_cat1',
    category: 1,
    name: 'Cat 1 · Recruit Pack',
    tagline: 'Olive Recon Skin + Urban Grid Wrap',
    price: 1,
    skinId: 'olive_recon',
    wrapId: 'urban',
  },
  {
    id: 'pack_cat2',
    category: 2,
    name: 'Cat 2 · Blaze Pack',
    tagline: 'Blaze Vanguard Skin + Magma Core Wrap',
    price: 2,
    skinId: 'vanguard_blaze',
    wrapId: 'magma',
  },
  {
    id: 'pack_cat3',
    category: 3,
    name: 'Cat 3 · Cyber Recon Pack',
    tagline: 'Frost Recon Skin + Frost Circuit Wrap',
    price: 3,
    skinId: 'cyber_recon',
    wrapId: 'frost',
  },
  {
    id: 'pack_cat4',
    category: 4,
    name: 'Cat 4 · Shadow Ops Pack',
    tagline: 'Shadow Phantom Skin + Obsidian Venom Wrap',
    price: 4,
    skinId: 'shadow_ops',
    wrapId: 'venom',
  },
  {
    id: 'pack_cat5',
    category: 5,
    name: 'Cat 5 · Apex Mythic Pack',
    tagline: 'Solar Sovereign Skin + Prismatic Nova Wrap + Apex Crown Emote',
    price: 5,
    skinId: 'solar_mythic',
    wrapId: 'nova',
    emoteId: 'crown',
  },
];

// Season 4 Battle Pass (12 Tiers with Free & Premium Tracks)
export const BATTLE_PASS_TIERS: BattlePassTier[] = [
  {
    tier: 1,
    xpRequired: 250,
    freeRewardLabel: '+3 Keys',
    premiumRewardLabel: 'Tactical Dice Charm',
    freeReward: {keys: 3},
    premiumReward: {charmId: 'charm_dice'},
  },
  {
    tier: 2,
    xpRequired: 550,
    freeRewardLabel: '+$2 Credits',
    premiumRewardLabel: 'Glacial Shatter Wrap',
    freeReward: {credits: 2},
    premiumReward: {wrapId: 'permafrost_wrap'},
  },
  {
    tier: 3,
    xpRequired: 900,
    freeRewardLabel: '+4 Keys',
    premiumRewardLabel: 'Plasma Vaporize Finisher',
    freeReward: {keys: 4},
    premiumReward: {finisherId: 'finisher_vaporize'},
  },
  {
    tier: 4,
    xpRequired: 1300,
    freeRewardLabel: 'Haunted Ember Wrap',
    premiumRewardLabel: 'Arctic Warden Skin',
    freeReward: {wrapId: 'halloween_web'},
    premiumReward: {skinId: 'frost_warden'},
  },
  {
    tier: 5,
    xpRequired: 1750,
    freeRewardLabel: '+5 Keys',
    premiumRewardLabel: 'Ember Core Charm + $3',
    freeReward: {keys: 5},
    premiumReward: {charmId: 'charm_flame', credits: 3},
  },
  {
    tier: 6,
    xpRequired: 2250,
    freeRewardLabel: '+$3 Credits',
    premiumRewardLabel: 'Cryo Shatter Finisher',
    freeReward: {credits: 3},
    premiumReward: {finisherId: 'finisher_shatter'},
  },
  {
    tier: 7,
    xpRequired: 2800,
    freeRewardLabel: '+6 Keys',
    premiumRewardLabel: 'Permafrost Shard Charm',
    freeReward: {keys: 6},
    premiumReward: {charmId: 'charm_ice'},
  },
  {
    tier: 8,
    xpRequired: 3400,
    freeRewardLabel: 'Valkyrie-H Assault',
    premiumRewardLabel: 'Crimson Ronin Skin',
    freeReward: {weaponId: 'scar_heavy'},
    premiumReward: {skinId: 'crimson_knight'},
  },
  {
    tier: 9,
    xpRequired: 4100,
    freeRewardLabel: '+8 Keys',
    premiumRewardLabel: 'Orbital Strike Finisher',
    freeReward: {keys: 8},
    premiumReward: {finisherId: 'finisher_lightning'},
  },
  {
    tier: 10,
    xpRequired: 4900,
    freeRewardLabel: '+$5 Credits',
    premiumRewardLabel: 'Neon Shogun Skin + $4',
    freeReward: {credits: 5},
    premiumReward: {skinId: 'neon_shogun', credits: 4},
  },
  {
    tier: 11,
    xpRequired: 5800,
    freeRewardLabel: '+10 Keys',
    premiumRewardLabel: 'Rival Crown Charm',
    freeReward: {keys: 10},
    premiumReward: {charmId: 'charm_crown'},
  },
  {
    tier: 12,
    xpRequired: 6800,
    freeRewardLabel: 'Hyperion Energy Rifle',
    premiumRewardLabel: 'Prismatic Nova Finisher + 15 Keys',
    freeReward: {weaponId: 'energy_rifle'},
    premiumReward: {finisherId: 'finisher_nova', keys: 15},
  },
];

export function getLocalDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTimeUntilDailyReset(now = new Date()): string {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const diffSec = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
  const hh = String(Math.floor(diffSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
  const ss = String(diffSec % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function hashDateKey(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getDailyShopOffers(dateKey = getLocalDateKey()): DailyShopOffer[] {
  const seed = hashDateKey(dateKey);

  const shopSkins: OperatorSkinId[] = ['frost_warden', 'crimson_knight', 'neon_shogun'];
  const shopWraps: WrapId[] = ['neon', 'gold', 'prism', 'magma', 'frost', 'venom', 'halloween_web'];
  const shopEmotes: EmoteId[] = ['flex', 'shadowbox', 'hologg', 'crown'];
  const shopCharms: CharmId[] = ['charm_dice', 'charm_crown', 'charm_flame', 'charm_ice', 'charm_key'];
  const shopFinishers: FinisherId[] = [
    'finisher_vaporize',
    'finisher_shatter',
    'finisher_lightning',
    'finisher_halloween',
  ];
  const contrabandWeapons: WeaponId[] = ['permafrost', 'laser_saber', 'cryo_pistol', 'flash_shield'];

  const skin = OPERATOR_SKINS[shopSkins[seed % shopSkins.length]];
  const wrap = WRAPS[shopWraps[(seed >> 3) % shopWraps.length]];
  const emote = EMOTES[shopEmotes[(seed >> 5) % shopEmotes.length]];
  const charm = CHARMS[shopCharms[(seed >> 7) % shopCharms.length]];
  const finisher = FINISHERS[shopFinishers[(seed >> 9) % shopFinishers.length]];
  const contraband = WEAPONS[contrabandWeapons[(seed >> 11) % contrabandWeapons.length]];

  return [
    {
      offerId: `daily_weapon_${contraband.id}`,
      kind: 'weapon',
      itemId: contraband.id,
      name: contraband.name,
      subtitle: contraband.description,
      price: Math.max(6, (contraband.unlockCost ?? 12) - 2),
      currency: 'keys',
      originalPrice: contraband.unlockCost ?? 12,
      tag: 'CONTRABAND DEAL',
      accentHex: contraband.accentColorHex ?? '#67e8f9',
    },
    {
      offerId: `daily_skin_${skin.id}`,
      kind: 'skin',
      itemId: skin.id,
      name: skin.name,
      subtitle: skin.subtitle,
      price: Math.max(1, skin.price - 1),
      currency: 'credits',
      originalPrice: skin.price,
      tag: 'FEATURED SKIN',
      accentHex: skin.visorHex,
    },
    {
      offerId: `daily_wrap_${wrap.id}`,
      kind: 'wrap',
      itemId: wrap.id,
      name: wrap.name,
      subtitle: wrap.subtitle,
      price: 2,
      currency: 'credits',
      originalPrice: 3,
      tag: 'DAILY WRAP',
      accentHex: wrap.accentHex,
    },
    {
      offerId: `daily_charm_${charm.id}`,
      kind: 'charm',
      itemId: charm.id,
      name: charm.name,
      subtitle: charm.subtitle,
      price: Math.max(1, charm.priceCredits - 1),
      currency: 'credits',
      originalPrice: charm.priceCredits,
      tag: 'WEAPON CHARM',
      accentHex: charm.colorHex,
    },
    {
      offerId: `daily_finisher_${finisher.id}`,
      kind: 'finisher',
      itemId: finisher.id,
      name: finisher.name,
      subtitle: finisher.subtitle,
      price: Math.max(2, finisher.priceCredits - 1),
      currency: 'credits',
      originalPrice: finisher.priceCredits,
      tag: 'FINISHER FX',
      accentHex: finisher.colorHex,
    },
    {
      offerId: `daily_emote_${emote.id}`,
      kind: 'emote',
      itemId: emote.id,
      name: emote.name,
      subtitle: emote.description,
      price: Math.max(1, emote.price - 1),
      currency: 'credits',
      originalPrice: emote.price,
      tag: 'DAILY EMOTE',
      accentHex: emote.accentHex,
    },
  ];
}
