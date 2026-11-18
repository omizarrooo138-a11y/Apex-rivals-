import React, {useEffect, useMemo, useState} from 'react';
import {
  Award,
  Ban,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Crosshair,
  Crown,
  DollarSign,
  Eye,
  Flame,
  Gift,
  KeyRound,
  Lock,
  Map as MapIcon,
  MessageSquare,
  Package,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Sparkles,
  Swords,
  Target,
  Trophy,
  User,
  UserX,
  Users,
  WifiOff,
} from 'lucide-react';
import {GAME_MODES, MAPS, RANKED_TIERS, UPDATE_PATCH_NOTES} from '../fps/catalog';
import {
  BATTLE_PASS_TIERS,
  CHARMS,
  EMOTES,
  FINISHERS,
  OPERATOR_SKINS,
  SEASON_PASS_PRICE_CREDITS,
  SKIN_PACKS,
  getDailyShopOffers,
  getLocalDateKey,
  getTimeUntilDailyReset,
} from '../fps/cosmetics';
import {
  getBattlePassTierFromXp,
  getCompetitiveRank,
  getRankedTierFromRR,
  getXpForNextLevel,
} from '../fps/storage';
import type {
  AdminRole,
  AudioSettings,
  BotDifficulty,
  CareerStats,
  CharmId,
  DailyShopOffer,
  EmoteId,
  FinisherId,
  GlobalLeaderboardEntry,
  GpuSettings,
  LobbyChatMessage,
  MapId,
  MatchFormat,
  OperatorSkinId,
  PrivateServerSettings,
  PublicRoomSummary,
  RoomStateInfo,
  TeamId,
  WeaponId,
  WrapId,
} from '../fps/types';
import {
  MELEE_WEAPONS,
  PRIMARY_WEAPONS,
  QUESTS,
  SECONDARY_WEAPONS,
  UTILITY_WEAPONS,
  WEAPONS,
  WRAPS,
} from '../fps/weapons';
import {OfflineBadge} from './OfflineBadge';
import {PWAInstallButton} from './PWAInstallButton';
import {SettingsPanel} from './SettingsPanel';

export type LobbyTab =
  | 'play'
  | 'arsenal'
  | 'shop'
  | 'ranked'
  | 'leaderboard'
  | 'quests'
  | 'settings';
type ArsenalSlot = 'primary' | 'secondary' | 'melee' | 'utility';
type LeaderboardSort = 'totalScore' | 'rankedRR' | 'kills' | 'wins' | 'arenaBest';

export interface FeedbackEntry {
  id: string;
  author: string;
  topic: string;
  message: string;
  ts: number;
}

function formatMatchModeLabel(fmt: MatchFormat): string {
  return GAME_MODES[fmt]?.shortLabel ?? fmt;
}

interface LobbyOverlayProps {
  activeTab: LobbyTab;
  onChangeTab: (tab: LobbyTab) => void;
  onOpenPlayModal: () => void;
  primaryGun: WeaponId;
  secondaryGun: WeaponId;
  meleeGun: WeaponId;
  utilityItem: WeaponId;
  wrapId: WrapId;
  onSelectPrimary: (id: WeaponId) => void;
  onSelectSecondary: (id: WeaponId) => void;
  onSelectMelee: (id: WeaponId) => void;
  onSelectUtility: (id: WeaponId) => void;
  onSelectWrap: (id: WrapId) => void;
  onUnlockWeapon: (id: WeaponId) => void;
  onPreviewWeapon: (id: WeaponId) => void;
  selectedMap: MapId;
  onSelectMap: (mapId: MapId) => void;
  matchFormat: MatchFormat;
  onSelectFormat: (fmt: MatchFormat) => void;
  onQuickDuelPad: (fmt: MatchFormat) => void;
  botDifficulty: BotDifficulty;
  onChangeDifficulty: (d: BotDifficulty) => void;
  isRankedQueue: boolean;
  onStartRivals1P: () => void;
  onStartShootingArena: () => void;
  gpu: GpuSettings;
  audio: AudioSettings;
  onChangeGpu: (next: GpuSettings) => void;
  onChangeAudio: (next: AudioSettings) => void;
  career: CareerStats;
  onClaimQuest: (questId: string) => void;
  // Cosmetics & Battle Pass props
  shopNotice: string | null;
  onClaimDailyBonus: () => void;
  onBuySkinPack: (packId: string) => void;
  onBuyDailyOffer: (offer: DailyShopOffer) => void;
  onBuyOrEquipSkin: (skinId: OperatorSkinId) => void;
  onBuyOrEquipEmote: (emoteId: EmoteId) => void;
  onBuyOrEquipCharm: (charmId: CharmId) => void;
  onBuyOrEquipFinisher: (finisherId: FinisherId) => void;
  onBuySeasonPass: () => void;
  onClaimPassTier: (tierNum: number, track: 'free' | 'premium') => void;
  onVerifyAccount: (email: string) => void;
  onSeasonalReset: () => void;
  onPreviewEmote: (emoteId: EmoteId) => void;
  // Admin & Moderation
  adminRole: AdminRole;
  onOpenAdminPanel: () => void;
  onQuickBanPlayer: (targetId: string, targetName: string) => void;
  // Multiplayer & Private Server props
  isOnline: boolean;
  wsConnected: boolean;
  callsign: string;
  onChangeCallsign: (name: string) => void;
  room: RoomStateInfo | null;
  selfId: string | null;
  publicRooms: PublicRoomSummary[];
  roomError: string | null;
  lobbyChat: LobbyChatMessage[];
  privateDraft: PrivateServerSettings;
  onChangePrivateDraft: (next: PrivateServerSettings) => void;
  onRefreshRooms: () => void;
  onCreateRoom: (asPrivate?: boolean) => void;
  onJoinRoom: (code: string, asSpectator?: boolean) => void;
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onToggleSpectate: () => void;
  onKickPlayer: (targetId: string) => void;
  onConfigRoom: (cfg: {
    mapId?: MapId;
    matchFormat?: MatchFormat;
    privateConfig?: Partial<PrivateServerSettings>;
  }) => void;
  onSwitchTeam: (team: TeamId) => void;
  onSendChat: (text: string) => void;
  onStartMpMatch: () => void;
  // Leaderboard & Community Feedback
  leaderboardEntries: GlobalLeaderboardEntry[];
  leaderboardLoading: boolean;
  onRefreshLeaderboard: () => void;
  feedbackItems: FeedbackEntry[];
  onSubmitFeedback: (topic: string, message: string) => Promise<void>;
}

export const LobbyOverlay: React.FC<LobbyOverlayProps> = ({
  activeTab,
  onChangeTab,
  onOpenPlayModal,
  primaryGun,
  secondaryGun,
  meleeGun,
  utilityItem,
  wrapId,
  onSelectPrimary,
  onSelectSecondary,
  onSelectMelee,
  onSelectUtility,
  onSelectWrap,
  onUnlockWeapon,
  onPreviewWeapon,
  selectedMap,
  matchFormat,
  onQuickDuelPad,
  botDifficulty,
  onChangeDifficulty,
  isRankedQueue,
  onStartRivals1P,
  onStartShootingArena,
  gpu,
  audio,
  onChangeGpu,
  onChangeAudio,
  career,
  onClaimQuest,
  shopNotice,
  onClaimDailyBonus,
  onBuySkinPack,
  onBuyDailyOffer,
  onBuyOrEquipSkin,
  onBuyOrEquipEmote,
  onBuyOrEquipCharm,
  onBuyOrEquipFinisher,
  onBuySeasonPass,
  onClaimPassTier,
  onVerifyAccount,
  onSeasonalReset,
  onPreviewEmote,
  adminRole,
  onOpenAdminPanel,
  onQuickBanPlayer,
  isOnline,
  wsConnected,
  callsign,
  onChangeCallsign,
  room,
  selfId,
  publicRooms,
  roomError,
  lobbyChat,
  privateDraft,
  onChangePrivateDraft,
  onRefreshRooms,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleReady,
  onToggleSpectate,
  onKickPlayer,
  onConfigRoom,
  onSwitchTeam,
  onSendChat,
  onStartMpMatch,
  leaderboardEntries,
  leaderboardLoading,
  onRefreshLeaderboard,
  feedbackItems,
  onSubmitFeedback,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [chatText, setChatText] = useState('');
  const [arsenalSlot, setArsenalSlot] = useState<ArsenalSlot>('primary');
  const [lbSort, setLbSort] = useState<LeaderboardSort>('totalScore');
  const [verifyEmail, setVerifyEmail] = useState(career.verifiedEmail ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  const [fbTopic, setFbTopic] = useState('Weapon Balance');
  const [fbMessage, setFbMessage] = useState('');
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(() => getTimeUntilDailyReset());
  const todayKey = getLocalDateKey();
  const dailyOffers = getDailyShopOffers(todayKey);

  useEffect(() => {
    if (activeTab !== 'shop') return;
    setResetCountdown(getTimeUntilDailyReset());
    const timer = window.setInterval(() => {
      setResetCountdown(getTimeUntilDailyReset());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'leaderboard' && isOnline) {
      onRefreshLeaderboard();
    }
  }, [activeTab, isOnline, onRefreshLeaderboard]);

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboardEntries].sort((a, b) => (b[lbSort] ?? 0) - (a[lbSort] ?? 0));
  }, [leaderboardEntries, lbSort]);

  const tabs: {id: LobbyTab; label: string; icon: React.ReactNode}[] = [
    {id: 'play', label: 'Lobby', icon: <Play className="w-3.5 h-3.5" />},
    {id: 'arsenal', label: '52 Weapons', icon: <Crosshair className="w-3.5 h-3.5" />},
    {id: 'shop', label: 'Shop & Packs', icon: <ShoppingBag className="w-3.5 h-3.5" />},
    {id: 'ranked', label: 'Ranked & Pass', icon: <Award className="w-3.5 h-3.5" />},
    {id: 'leaderboard', label: 'Leaderboard', icon: <BarChart3 className="w-3.5 h-3.5" />},
    {id: 'quests', label: 'Quests & U13', icon: <Trophy className="w-3.5 h-3.5" />},
    {id: 'settings', label: 'Settings', icon: <Sliders className="w-3.5 h-3.5" />},
  ];

  const slotList =
    arsenalSlot === 'primary'
      ? PRIMARY_WEAPONS
      : arsenalSlot === 'secondary'
      ? SECONDARY_WEAPONS
      : arsenalSlot === 'melee'
      ? MELEE_WEAPONS
      : UTILITY_WEAPONS;

  const equippedForSlot =
    arsenalSlot === 'primary'
      ? primaryGun
      : arsenalSlot === 'secondary'
      ? secondaryGun
      : arsenalSlot === 'melee'
      ? meleeGun
      : utilityItem;

  const handleSelectOrUnlockWeapon = (id: WeaponId) => {
    const owned = career.unlockedWeapons.includes(id) || WEAPONS[id].unlockType === 'free';
    if (!owned) {
      onUnlockWeapon(id);
      return;
    }
    if (arsenalSlot === 'primary') onSelectPrimary(id);
    else if (arsenalSlot === 'secondary') onSelectSecondary(id);
    else if (arsenalSlot === 'melee') onSelectMelee(id);
    else onSelectUtility(id);
    onPreviewWeapon(id);
  };

  const kdRatio =
    career.deaths > 0 ? (career.kills / career.deaths).toFixed(2) : career.kills.toFixed(2);
  const rank = getCompetitiveRank(career);
  const rankedTierSpec = getRankedTierFromRR(career.rankedRR ?? 0);
  const xpNext = getXpForNextLevel(career.level ?? 1);
  const bpTier = getBattlePassTierFromXp(career.battlePassXp ?? 0);
  const currentModeSpec = GAME_MODES[matchFormat];
  const currentMapSpec = MAPS[selectedMap];

  const roomTeamCount = room ? GAME_MODES[room.matchFormat]?.teamCount ?? 2 : 2;
  const roomTeams: TeamId[] =
    roomTeamCount === 3 ? ['alpha', 'bravo', 'charlie'] : ['alpha', 'bravo'];

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 md:p-6">
      {/* Top Bar */}
      <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/70 bg-[#0b0f17]/94 px-4 py-2.5 shadow-xl">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <svg width="28" height="28" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#141c2e" />
            <path d="M14 44 L26 18 L38 18 L26 44 Z" fill="#f97316" />
            <path d="M32 44 L44 18 L52 18 L40 44 Z" fill="#38bdf8" />
          </svg>
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            APEX RIVALS
          </span>
          {/* Iconic Green Play Button */}
          <button
            type="button"
            onClick={onOpenPlayModal}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 font-display text-xs font-extrabold text-slate-950 hover:bg-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.45)] transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>PLAY</span>
          </button>
        </div>

        <nav className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeTab(t.id)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? 'bg-orange-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="hidden lg:inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/95 px-2 py-1 font-mono-num text-[11px] font-bold text-slate-200"
            title={`XP ${career.xp ?? 0} / ${xpNext}`}
          >
            <span className="text-sky-400">LV {career.level ?? 1}</span>
            {career.verified && (
              <span title="Verified Operator">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              </span>
            )}
          </div>

          <div
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/95 px-2.5 py-1 text-xs font-bold"
            title={`Ranked: ${rankedTierSpec.tier} (${career.rankedRR ?? 0} RR) · Win Streak: ${
              career.winStreak ?? 0
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{backgroundColor: rank.colorHex}} />
            <span style={{color: rank.colorHex}}>{rank.label}</span>
          </div>

          <button
            type="button"
            onClick={() => onPreviewEmote(career.equippedEmote)}
            title="Perform Equipped Emote (B)"
            className="hidden xl:inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-amber-300 hover:bg-slate-800 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenAdminPanel}
            title="Owner & Admin Panel (F9)"
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold cursor-pointer ${
              adminRole === 'owner'
                ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                : adminRole === 'admin'
                ? 'border-sky-400/60 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {adminRole === 'owner' ? (
              <Crown className="w-3.5 h-3.5 text-amber-400" />
            ) : adminRole === 'admin' ? (
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden md:inline">
              {adminRole === 'owner' ? 'Owner' : adminRole === 'admin' ? 'Admin' : 'Staff'}
            </span>
          </button>

          <div
            className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-950/60 px-2 py-1 font-mono-num text-xs font-bold text-cyan-300"
            title="Contraband Keys"
          >
            <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            <span>{career.keys ?? 0}</span>
          </div>

          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2 py-1 font-mono-num text-xs font-bold text-emerald-300"
            title="Arena Wallet Credits"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>{career.credits}</span>
          </div>

          <OfflineBadge />
          <PWAInstallButton />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="my-auto overflow-y-auto max-h-[calc(100vh-146px)] pr-1">
        {activeTab === 'play' && (
          <div className="pointer-events-auto max-w-3xl space-y-3.5">
            {/* Active Mode & Lobby Duel Pads */}
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-4 sm:p-5 shadow-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-400">
                    <Shield className="w-4 h-4" />
                    <span>
                      {isRankedQueue ? 'Ranked Season 4 Queue' : 'Play Offline or Co-op Bots'} ·{' '}
                      {currentMapSpec?.name}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 capitalize">
                      Theme: {gpu.seasonalTheme ?? 'normal'}
                    </span>
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-bold text-white">
                    {currentModeSpec?.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-300">{currentModeSpec?.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onOpenPlayModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-3 font-display text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
                  >
                    <MapIcon className="w-4 h-4" />
                    21 Modes &amp; 30 Maps
                  </button>
                  <button
                    type="button"
                    onClick={onStartRivals1P}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-display text-sm font-bold text-slate-950 hover:bg-orange-400 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Deploy Now
                  </button>
                </div>
              </div>

              {/* Lobby Duel Pads + AI Difficulty */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                    <Swords className="w-3.5 h-3.5 text-emerald-400" />
                    Lobby Duel Pads:
                  </span>
                  {(
                    [
                      {fmt: 'duel', label: '1v1 Pad'},
                      {fmt: 'duel_2v2', label: '2v2 Pad'},
                      {fmt: 'duel_3v3', label: '3v3 Pad'},
                      {fmt: 'duel_5v5', label: '5v5 Pad'},
                    ] as {fmt: MatchFormat; label: string}[]
                  ).map((pad) => (
                    <button
                      key={pad.fmt}
                      type="button"
                      onClick={() => onQuickDuelPad(pad.fmt)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                        matchFormat === pad.fmt
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-400/60 hover:text-white'
                      }`}
                    >
                      {pad.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Bot AI:</span>
                  {(['recruit', 'tactician', 'ace'] as BotDifficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onChangeDifficulty(d)}
                      className={`rounded-lg border px-2.5 py-1 font-semibold capitalize cursor-pointer ${
                        botDifficulty === d
                          ? 'border-orange-500 bg-orange-500/20 text-orange-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Shooting Arena & Active Loadout Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/92 p-4 shadow-xl flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                    <Target className="w-4 h-4" />
                    <span>Offline Aim Range</span>
                  </div>
                  <h3 className="mt-0.5 font-display text-lg font-bold text-white">
                    Shooting Arena
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-300">
                    60s target gauntlet · Best:{' '}
                    <span className="font-mono-num font-bold text-emerald-300">
                      {career.arenaBestScore}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onStartShootingArena}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-sky-500/20 px-4 py-2 font-display text-xs font-bold text-sky-200 hover:bg-sky-500/30 transition-colors cursor-pointer"
                >
                  <Target className="w-4 h-4" />
                  Enter Shooting Arena
                </button>
              </div>

              <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/92 p-4 shadow-xl">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-300 truncate">
                    {WRAPS[wrapId]?.name} · {CHARMS[career.equippedCharm]?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangeTab('arsenal')}
                    className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 cursor-pointer shrink-0"
                  >
                    52 Weapons →
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      {slot: 'primary', label: '1 · Primary', wid: primaryGun},
                      {slot: 'secondary', label: '2 · Sidearm', wid: secondaryGun},
                      {slot: 'melee', label: '3 · Melee', wid: meleeGun},
                      {slot: 'utility', label: '4 · Utility', wid: utilityItem},
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.slot}
                      type="button"
                      onClick={() => {
                        setArsenalSlot(s.slot);
                        onPreviewWeapon(s.wid);
                        onChangeTab('arsenal');
                      }}
                      className="rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-left hover:border-orange-500/60 transition-colors cursor-pointer"
                    >
                      <div className="text-[9px] font-bold uppercase tracking-wider text-orange-400">
                        {s.label}
                      </div>
                      <div className="font-display text-[11px] font-bold text-white truncate">
                        {WEAPONS[s.wid]?.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Multiplayer & Free Private Server Terminal */}
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/92 p-4 sm:p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-display text-lg font-bold text-white">
                    Multiplayer &amp; Free Private Servers
                  </h2>
                </div>
                <input
                  type="text"
                  value={callsign}
                  maxLength={14}
                  onChange={(e) => onChangeCallsign(e.target.value)}
                  aria-label="Player callsign"
                  placeholder="Callsign"
                  className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              {!isOnline || !wsConnected ? (
                <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-200">
                  <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    {!isOnline
                      ? 'Offline mode active. All 21 modes, 30 maps, 52 weapons & Shooting Arena work offline with zero network.'
                      : 'Connecting to Multiplayer Arena server...'}
                  </span>
                </div>
              ) : room ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 px-3.5 py-2 border border-slate-800">
                    <div className="text-xs text-slate-300">
                      Room:{' '}
                      <strong className="font-mono-num text-base text-orange-400 tracking-widest">
                        {room.code}
                      </strong>
                      {room.privateConfig?.isPrivate && (
                        <span className="ml-2 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">
                          PRIVATE FREE
                        </span>
                      )}
                      <span className="ml-2 text-slate-400">
                        {MAPS[room.mapId]?.name} · {formatMatchModeLabel(room.matchFormat)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={onToggleReady}
                        className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"
                      >
                        Toggle Ready
                      </button>
                      {(room.privateConfig?.allowSpectators ?? true) && (
                        <button
                          type="button"
                          onClick={onToggleSpectate}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                            room.players.find((p) => p.id === selfId)?.spectator
                              ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                              : 'border-slate-700 bg-slate-800 text-slate-300'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {room.players.find((p) => p.id === selfId)?.spectator
                            ? 'Spectating'
                            : 'Spectate'}
                        </button>
                      )}
                      {room.hostId === selfId && (
                        <button
                          type="button"
                          disabled={room.players.length < 2}
                          onClick={onStartMpMatch}
                          className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
                        >
                          Start ({room.players.length}/{room.maxPlayers})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onLeaveRoom}
                        className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 cursor-pointer"
                      >
                        Leave
                      </button>
                    </div>
                  </div>

                  {/* Host Private Server Lobby Terminal */}
                  {room.hostId === selfId && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                          Host Lobby Terminal (30 Maps · 21 Modes · Free Private Rules)
                        </span>
                        <button
                          type="button"
                          onClick={onOpenPlayModal}
                          className="rounded-md bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                        >
                          Browse All 30 Maps / 21 Modes
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        {[
                          {key: 'isPrivate', label: 'Private Unlisted'},
                          {key: 'allowSpectators', label: 'Spectators'},
                          {key: 'lowGravity', label: 'Low Gravity'},
                          {key: 'instantReload', label: 'Instant Reload'},
                          {key: 'headshotsOnly', label: 'Headshots Only'},
                          {key: 'friendlyFire', label: 'Friendly Fire'},
                        ].map((opt) => {
                          const k = opt.key as keyof PrivateServerSettings;
                          const val = Boolean(room.privateConfig?.[k]);
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() =>
                                onConfigRoom({
                                  privateConfig: {[k]: !val},
                                })
                              }
                              className={`rounded-md border px-2 py-1 font-semibold cursor-pointer ${
                                val
                                  ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                  : 'border-slate-800 bg-slate-900 text-slate-400'
                              }`}
                            >
                              {opt.label}: {val ? 'ON' : 'OFF'}
                            </button>
                          );
                        })}
                        <select
                          aria-label="Room Seasonal Map Theme"
                          value={room.privateConfig?.seasonalTheme ?? 'normal'}
                          onChange={(e) =>
                            onConfigRoom({
                              privateConfig: {
                                seasonalTheme: e.target.value as PrivateServerSettings['seasonalTheme'],
                              },
                            })
                          }
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-200"
                        >
                          <option value="normal">Theme: Standard</option>
                          <option value="halloween">Theme: Halloween</option>
                          <option value="winter">Theme: Winter</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Player Roster (2 teams, 3 teams, or FFA) */}
                  {roomTeamCount >= 2 ? (
                    <div
                      className={`grid grid-cols-1 ${
                        roomTeamCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
                      } gap-2.5`}
                    >
                      {roomTeams.map((tid) => {
                        const teamPlayers = room.players.filter(
                          (p) => !p.spectator && (p.team ?? 'alpha') === tid,
                        );
                        const myTeam =
                          room.players.find((p) => p.id === selfId)?.team ?? 'alpha';
                        const maxPerTeam = Math.ceil(room.maxPlayers / roomTeamCount);
                        const colorStyle =
                          tid === 'alpha'
                            ? {
                                border: 'border-sky-500/40 bg-sky-950/20',
                                text: 'text-sky-300',
                                btn: 'bg-sky-500 text-slate-950 hover:bg-sky-400',
                              }
                            : tid === 'charlie'
                            ? {
                                border: 'border-emerald-500/40 bg-emerald-950/20',
                                text: 'text-emerald-300',
                                btn: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
                              }
                            : {
                                border: 'border-rose-500/40 bg-rose-950/20',
                                text: 'text-rose-300',
                                btn: 'bg-rose-500 text-white hover:bg-rose-400',
                              };
                        return (
                          <div
                            key={tid}
                            className={`rounded-xl border p-2.5 space-y-2 ${colorStyle.border}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`font-display text-xs font-bold uppercase tracking-wider ${colorStyle.text}`}
                              >
                                {tid} ({teamPlayers.length}/{maxPerTeam})
                              </span>
                              {myTeam !== tid && teamPlayers.length < maxPerTeam && (
                                <button
                                  type="button"
                                  onClick={() => onSwitchTeam(tid)}
                                  className={`rounded px-2 py-0.5 text-[10px] font-bold capitalize cursor-pointer ${colorStyle.btn}`}
                                >
                                  Join {tid}
                                </button>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              {teamPlayers.map((p) => {
                                const canKickOrBan =
                                  (room.hostId === selfId ||
                                    adminRole === 'owner' ||
                                    adminRole === 'admin') &&
                                  p.id !== selfId &&
                                  p.role !== 'owner';
                                return (
                                  <div
                                    key={p.id}
                                    className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-xs"
                                  >
                                    <div className="min-w-0 pr-1">
                                      <div className="flex items-center gap-1">
                                        <span className="font-semibold text-white truncate">
                                          {p.name}
                                        </span>
                                        {p.id === selfId && (
                                          <span className="text-[9px] font-bold text-emerald-400">
                                            (YOU)
                                          </span>
                                        )}
                                      </div>
                                      <span className="block text-[10px] text-slate-400 truncate">
                                        {WEAPONS[p.primaryGun]?.name} · {WRAPS[p.wrapId]?.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span
                                        className={`font-semibold text-[10px] ${
                                          p.ready ? 'text-emerald-400' : 'text-slate-500'
                                        }`}
                                      >
                                        {p.ready ? 'Ready' : 'Wait'}
                                      </span>
                                      {canKickOrBan && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => onKickPlayer(p.id)}
                                            title={`Kick ${p.name}`}
                                            className="rounded bg-amber-600/80 p-1 text-white hover:bg-amber-500 cursor-pointer"
                                          >
                                            <UserX className="w-2.5 h-2.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => onQuickBanPlayer(p.id, p.name)}
                                            title={`Ban ${p.name}`}
                                            className="rounded bg-rose-600/85 p-1 text-white hover:bg-rose-500 cursor-pointer"
                                          >
                                            <Ban className="w-2.5 h-2.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {room.players.map((p) => {
                        const canKickOrBan =
                          (room.hostId === selfId ||
                            adminRole === 'owner' ||
                            adminRole === 'admin') &&
                          p.id !== selfId &&
                          p.role !== 'owner';
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs"
                          >
                            <div className="min-w-0 pr-1">
                              <span className="font-semibold text-white truncate block">
                                {p.name} {p.spectator ? '(SPECTATOR)' : ''}
                              </span>
                              <span className="block text-[11px] text-slate-400 truncate">
                                {WEAPONS[p.primaryGun]?.name} · {WRAPS[p.wrapId]?.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`font-semibold ${
                                  p.ready ? 'text-emerald-400' : 'text-slate-500'
                                }`}
                              >
                                {p.ready ? 'Ready' : 'Waiting'}
                              </span>
                              {canKickOrBan && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onKickPlayer(p.id)}
                                    title={`Kick ${p.name}`}
                                    className="rounded bg-amber-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-amber-500 cursor-pointer"
                                  >
                                    Kick
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onQuickBanPlayer(p.id, p.name)}
                                    title={`Ban ${p.name}`}
                                    className="rounded bg-rose-600/85 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-rose-500 cursor-pointer"
                                  >
                                    Ban
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Spectators Strip */}
                  {room.players.some((p) => p.spectator) && (
                    <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 px-3 py-1.5 text-[11px] text-sky-200">
                      <strong>Spectators: </strong>
                      {room.players
                        .filter((p) => p.spectator)
                        .map((p) => p.name)
                        .join(', ')}
                    </div>
                  )}

                  {/* Lobby Chat */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5">
                      <MessageSquare className="w-3 h-3" />
                      <span>Room Chat</span>
                    </div>
                    <div className="max-h-20 overflow-y-auto space-y-1 text-xs mb-2">
                      {lobbyChat.length === 0 ? (
                        <div className="text-slate-500 text-[11px]">No messages yet.</div>
                      ) : (
                        lobbyChat.map((m) => (
                          <div key={m.id} className="text-slate-300">
                            <span className="font-semibold text-sky-300">{m.sender}: </span>
                            <span>{m.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!chatText.trim()) return;
                        onSendChat(chatText.trim());
                        setChatText('');
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        type="text"
                        value={chatText}
                        maxLength={120}
                        onChange={(e) => setChatText(e.target.value)}
                        placeholder="Send message to room..."
                        className="flex-1 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-white focus:border-sky-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700 cursor-pointer"
                        aria-label="Send chat message"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onCreateRoom(false)}
                      className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 whitespace-nowrap cursor-pointer"
                    >
                      Create Public Room
                    </button>
                    <button
                      type="button"
                      onClick={() => onCreateRoom(true)}
                      className="rounded-lg border border-purple-400/50 bg-purple-500/20 px-3.5 py-2 text-xs font-bold text-purple-200 hover:bg-purple-500/30 whitespace-nowrap cursor-pointer"
                    >
                      Free Private Server
                    </button>
                    <input
                      type="text"
                      value={joinCode}
                      maxLength={4}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="CODE"
                      aria-label="Room code"
                      className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 font-mono-num text-xs font-bold uppercase text-white focus:border-sky-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onJoinRoom(joinCode, false)}
                      disabled={joinCode.trim().length < 4}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      Join
                    </button>
                    <button
                      type="button"
                      onClick={() => onJoinRoom(joinCode, true)}
                      disabled={joinCode.trim().length < 4}
                      title="Join as Spectator"
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-950/40 px-2.5 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-900/50 disabled:opacity-40 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Spectate
                    </button>
                    <button
                      type="button"
                      onClick={onRefreshRooms}
                      title="Refresh Open Rooms"
                      className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Private Server Physics Pre-Config */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Server Modifiers:</span>
                    {[
                      {key: 'lowGravity', label: 'Low Grav'},
                      {key: 'instantReload', label: 'Instant Reload'},
                      {key: 'headshotsOnly', label: 'HS Only'},
                    ].map((opt) => {
                      const k = opt.key as keyof PrivateServerSettings;
                      const active = Boolean(privateDraft[k]);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => onChangePrivateDraft({...privateDraft, [k]: !active})}
                          className={`rounded border px-2 py-0.5 font-semibold cursor-pointer ${
                            active
                              ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                              : 'border-slate-800 bg-slate-900 text-slate-400'
                          }`}
                        >
                          {opt.label}: {active ? 'ON' : 'OFF'}
                        </button>
                      );
                    })}
                  </div>

                  {roomError && <p className="text-xs text-rose-400">{roomError}</p>}

                  {publicRooms.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {publicRooms.map((r) => (
                        <button
                          key={r.code}
                          type="button"
                          onClick={() => onJoinRoom(r.code)}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-sky-400 cursor-pointer"
                        >
                          <span className="font-mono-num font-bold text-orange-400">{r.code}</span>
                          <span className="mx-1.5 text-slate-500">·</span>
                          <span>{r.hostName}</span>
                          <span className="ml-1.5 text-slate-400">
                            ({MAPS[r.mapId]?.name || r.mapId} · {formatMatchModeLabel(r.matchFormat)}{' '}
                            · {r.count}/{r.maxPlayers})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'arsenal' && (
          <div className="pointer-events-auto max-w-3xl space-y-4">
            {/* 52 Weapons across 4 Slots */}
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    52-Weapon Arsenal ({career.unlockedWeapons.length}/52 Owned)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Unlock Contraband weapons with Keys or standard weapons with Credits.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono-num text-xs">
                  <span className="text-cyan-300 font-bold">{career.keys ?? 0} Keys</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-300 font-bold">${career.credits}</span>
                </div>
              </div>

              {shopNotice && (
                <div className="mt-3 rounded-lg border border-sky-500/40 bg-sky-950/50 px-3 py-2 text-xs font-medium text-sky-200">
                  {shopNotice}
                </div>
              )}

              {/* 4 Slot Tabs */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    {
                      slot: 'primary',
                      label: `1 · Primary (${PRIMARY_WEAPONS.length})`,
                      equipped: WEAPONS[primaryGun].name,
                    },
                    {
                      slot: 'secondary',
                      label: `2 · Sidearm (${SECONDARY_WEAPONS.length})`,
                      equipped: WEAPONS[secondaryGun].name,
                    },
                    {
                      slot: 'melee',
                      label: `3 · Melee (${MELEE_WEAPONS.length})`,
                      equipped: WEAPONS[meleeGun].name,
                    },
                    {
                      slot: 'utility',
                      label: `4 · Utility (${UTILITY_WEAPONS.length})`,
                      equipped: WEAPONS[utilityItem].name,
                    },
                  ] as {slot: ArsenalSlot; label: string; equipped: string}[]
                ).map((item) => (
                  <button
                    key={item.slot}
                    type="button"
                    onClick={() => {
                      setArsenalSlot(item.slot);
                      const id =
                        item.slot === 'primary'
                          ? primaryGun
                          : item.slot === 'secondary'
                          ? secondaryGun
                          : item.slot === 'melee'
                          ? meleeGun
                          : utilityItem;
                      onPreviewWeapon(id);
                    }}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                      arsenalSlot === item.slot
                        ? 'border-orange-500 bg-orange-500/20 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                      {item.label}
                    </div>
                    <div className="font-display text-xs font-bold truncate mt-0.5 text-slate-100">
                      {item.equipped}
                    </div>
                  </button>
                ))}
              </div>

              {/* Weapons for Selected Slot */}
              <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {slotList.map((w) => {
                  const owned =
                    career.unlockedWeapons.includes(w.id) || w.unlockType === 'free';
                  const selected = w.id === equippedForSlot;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleSelectOrUnlockWeapon(w.id)}
                      className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-orange-500 bg-orange-500/15 text-white'
                          : w.contraband
                          ? 'border-cyan-500/45 bg-cyan-950/20 text-slate-200 hover:border-cyan-400'
                          : 'border-slate-700/80 bg-slate-900/85 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-display text-sm font-bold truncate">{w.name}</span>
                          {w.contraband && (
                            <span className="rounded bg-cyan-500/25 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300 shrink-0">
                              CONTRABAND
                            </span>
                          )}
                        </div>
                        {owned ? (
                          <span
                            className={`text-[10px] font-bold shrink-0 ${
                              selected ? 'text-orange-400' : 'text-emerald-400'
                            }`}
                          >
                            {selected ? 'EQUIPPED' : 'OWNED'}
                          </span>
                        ) : w.unlockType === 'keys' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-cyan-300 shrink-0">
                            <KeyRound className="w-3 h-3" />
                            {w.unlockCost ?? 10} Keys
                          </span>
                        ) : w.unlockType === 'battlepass' ? (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 shrink-0">
                            Battle Pass
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300 shrink-0">
                            Unlock ${w.unlockCost ?? 3}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{w.description}</p>
                      <div className="mt-2 flex items-center gap-2.5 font-mono-num text-[11px] text-slate-300">
                        <span className="text-slate-400">{w.category}</span>
                        <span>·</span>
                        <span>DMG {w.damage * w.pellets}</span>
                        {w.slot !== 'melee' && w.slot !== 'utility' && (
                          <>
                            <span>·</span>
                            <span>MAG {w.magSize}</span>
                            <span>·</span>
                            <span>RPS {w.fireRateRps}</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 15 Weapon Wraps */}
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/92 p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-white">15 Weapon Wraps</h2>
                <span className="text-xs text-slate-400">
                  Equipping on <strong className="text-white">{WEAPONS[equippedForSlot].name}</strong>
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {Object.values(WRAPS).map((wrap) => {
                  const unlocked = career.unlockedWraps.includes(wrap.id);
                  const active = wrap.id === wrapId;
                  return (
                    <button
                      key={wrap.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => onSelectWrap(wrap.id)}
                      className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
                        active
                          ? 'border-orange-500 bg-orange-500/15'
                          : 'border-slate-700/80 bg-slate-900/85 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <span
                            className="h-3 w-3 rounded-sm border border-white/20"
                            style={{background: wrap.primaryHex}}
                          />
                          <span
                            className="h-3 w-3 rounded-sm border border-white/20"
                            style={{background: wrap.accentHex}}
                          />
                        </div>
                        {!unlocked ? (
                          <Lock className="w-3 h-3 text-slate-400" />
                        ) : active ? (
                          <Check className="w-3 h-3 text-orange-400" />
                        ) : null}
                      </div>
                      <div className="mt-1.5 font-display text-[11px] font-bold text-white truncate">
                        {wrap.name}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-tight text-slate-400 line-clamp-2">
                        {unlocked ? wrap.subtitle : wrap.unlockHint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weapon Charms & Elimination Finishers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/92 p-4 shadow-xl">
                <h3 className="font-display text-sm font-bold text-white mb-2.5">
                  3D Weapon Charms
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(CHARMS).map((charm) => {
                    const owned = career.unlockedCharms.includes(charm.id);
                    const active = career.equippedCharm === charm.id;
                    return (
                      <button
                        key={charm.id}
                        type="button"
                        onClick={() => onBuyOrEquipCharm(charm.id)}
                        className={`rounded-lg border p-2.5 text-left cursor-pointer ${
                          active
                            ? 'border-orange-500 bg-orange-500/15'
                            : 'border-slate-800 bg-slate-900/85 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{backgroundColor: charm.colorHex}}
                          />
                          <span className="font-mono-num text-[10px] font-bold text-emerald-300">
                            {active ? 'Equipped' : owned ? 'Equip' : `$${charm.priceCredits}`}
                          </span>
                        </div>
                        <div className="mt-1 font-display text-xs font-bold text-white truncate">
                          {charm.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/92 p-4 shadow-xl">
                <h3 className="font-display text-sm font-bold text-white mb-2.5">
                  3D Elimination Finishers
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(FINISHERS).map((fin) => {
                    const owned = career.unlockedFinishers.includes(fin.id);
                    const active = career.equippedFinisher === fin.id;
                    return (
                      <button
                        key={fin.id}
                        type="button"
                        onClick={() => onBuyOrEquipFinisher(fin.id)}
                        className={`rounded-lg border p-2.5 text-left cursor-pointer ${
                          active
                            ? 'border-orange-500 bg-orange-500/15'
                            : 'border-slate-800 bg-slate-900/85 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{backgroundColor: fin.colorHex}}
                          />
                          <span className="font-mono-num text-[10px] font-bold text-emerald-300">
                            {active ? 'Equipped' : owned ? 'Equip' : `$${fin.priceCredits}`}
                          </span>
                        </div>
                        <div className="mt-1 font-display text-xs font-bold text-white truncate">
                          {fin.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="pointer-events-auto max-w-3xl space-y-4">
            {/* Daily Shop Rotation */}
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-orange-400">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Daily Shop · {todayKey}</span>
                  </div>
                  <h2 className="mt-0.5 font-display text-xl font-bold text-white">
                    Contraband Keys, Skins, Wraps, Charms &amp; Finishers
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono-num text-xs text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    Resets {resetCountdown}
                  </span>
                  <button
                    type="button"
                    disabled={career.lastDailyBonusDate === todayKey}
                    onClick={onClaimDailyBonus}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400 cursor-pointer disabled:cursor-default"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    {career.lastDailyBonusDate === todayKey
                      ? 'Daily Claimed'
                      : 'Claim +$3 & +4 Keys'}
                  </button>
                </div>
              </div>

              {shopNotice && (
                <div className="mt-3 rounded-lg border border-sky-500/40 bg-sky-950/50 px-3 py-2 text-xs font-medium text-sky-200">
                  {shopNotice}
                </div>
              )}

              <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {dailyOffers.map((offer) => {
                  const isOwned =
                    offer.kind === 'weapon'
                      ? career.unlockedWeapons.includes(offer.itemId as WeaponId)
                      : offer.kind === 'charm'
                      ? career.unlockedCharms.includes(offer.itemId as CharmId)
                      : offer.kind === 'finisher'
                      ? career.unlockedFinishers.includes(offer.itemId as FinisherId)
                      : offer.kind === 'skin'
                      ? career.unlockedSkins.includes(offer.itemId as OperatorSkinId)
                      : offer.kind === 'wrap'
                      ? career.unlockedWraps.includes(offer.itemId as WrapId)
                      : career.unlockedEmotes.includes(offer.itemId as EmoteId);

                  const isEquipped =
                    offer.kind === 'skin'
                      ? career.equippedSkin === offer.itemId
                      : offer.kind === 'wrap'
                      ? wrapId === offer.itemId
                      : offer.kind === 'charm'
                      ? career.equippedCharm === offer.itemId
                      : offer.kind === 'finisher'
                      ? career.equippedFinisher === offer.itemId
                      : offer.kind === 'emote'
                      ? career.equippedEmote === offer.itemId
                      : primaryGun === offer.itemId ||
                        secondaryGun === offer.itemId ||
                        meleeGun === offer.itemId ||
                        utilityItem === offer.itemId;

                  const priceStr =
                    offer.currency === 'keys' ? `${offer.price} Keys` : `$${offer.price}`;
                  const origStr =
                    offer.currency === 'keys'
                      ? `${offer.originalPrice}K`
                      : `$${offer.originalPrice}`;

                  return (
                    <div
                      key={offer.offerId}
                      className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-3.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-950"
                            style={{backgroundColor: offer.accentHex}}
                          >
                            {offer.tag}
                          </span>
                          <div className="font-mono-num text-xs">
                            <span className="mr-1.5 text-slate-500 line-through">{origStr}</span>
                            <span
                              className={`font-bold ${
                                offer.currency === 'keys' ? 'text-cyan-300' : 'text-emerald-400'
                              }`}
                            >
                              {priceStr}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 font-display text-sm font-bold text-white">
                          {offer.name}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">{offer.subtitle}</p>
                      </div>

                      <div className="mt-3 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => onBuyDailyOffer(offer)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                            isEquipped
                              ? 'border border-orange-500/60 bg-orange-500/20 text-orange-200'
                              : isOwned
                              ? 'border border-slate-600 bg-slate-800 text-white hover:bg-slate-700'
                              : offer.currency === 'keys'
                              ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                              : 'bg-orange-500 text-slate-950 hover:bg-orange-400'
                          }`}
                        >
                          {isEquipped ? 'Equipped' : isOwned ? 'Equip' : `Buy ${priceStr}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5-Category Select Skin Packs ($1 to $5) */}
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                    <Package className="w-4 h-4" />
                    <span>5-Category Select Skin Packs</span>
                  </div>
                  <h2 className="mt-0.5 font-display text-lg font-bold text-white">
                    Tiered Bundles ($1 to $5 · +$1 Per Category)
                  </h2>
                </div>
                <span className="font-mono-num text-xs text-emerald-300">
                  Wallet: ${career.credits}
                </span>
              </div>

              <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {SKIN_PACKS.map((pack) => {
                  const skinSpec = OPERATOR_SKINS[pack.skinId];
                  const wrapSpec = WRAPS[pack.wrapId];
                  const owned =
                    career.unlockedSkins.includes(pack.skinId) &&
                    career.unlockedWraps.includes(pack.wrapId) &&
                    (!pack.emoteId || career.unlockedEmotes.includes(pack.emoteId));
                  const equipped = career.equippedSkin === pack.skinId && wrapId === pack.wrapId;

                  return (
                    <div
                      key={pack.id}
                      className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors ${
                        equipped
                          ? 'border-orange-500 bg-orange-500/15'
                          : 'border-slate-800 bg-slate-900/90'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono-num text-[10px] font-bold text-sky-300">
                            CATEGORY {pack.category}
                          </span>
                          <span className="font-mono-num text-sm font-bold text-emerald-400">
                            ${pack.price}
                          </span>
                        </div>
                        <div className="mt-2 font-display text-sm font-bold text-white">
                          {pack.name}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">
                          {pack.tagline}
                        </p>
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <span
                            className="h-3.5 w-3.5 rounded-sm border border-white/25"
                            style={{backgroundColor: skinSpec.primaryHex}}
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-sm border border-white/25"
                            style={{backgroundColor: skinSpec.visorHex}}
                          />
                          <span className="text-[10px] text-slate-500">+</span>
                          <span
                            className="h-3.5 w-3.5 rounded-sm border border-white/25"
                            style={{backgroundColor: wrapSpec.primaryHex}}
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-sm border border-white/25"
                            style={{backgroundColor: wrapSpec.accentHex}}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onBuySkinPack(pack.id)}
                        className={`mt-3 w-full rounded-lg py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                          equipped
                            ? 'border border-orange-500/60 bg-orange-500/25 text-orange-200'
                            : owned
                            ? 'border border-slate-600 bg-slate-800 text-white hover:bg-slate-700'
                            : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        }`}
                      >
                        {equipped ? 'Equipped' : owned ? 'Equip Pack' : `Buy Pack · $${pack.price}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Operator Skins & Emotes */}
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-sky-400" />
                  <h2 className="font-display text-lg font-bold text-white">Operator Skins</h2>
                </div>
                <span className="text-xs text-slate-400">Previewed on 3D operator</span>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Object.values(OPERATOR_SKINS).map((skin) => {
                  const unlocked = career.unlockedSkins.includes(skin.id);
                  const active = career.equippedSkin === skin.id;
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => onBuyOrEquipSkin(skin.id)}
                      className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-orange-500 bg-orange-500/15'
                          : 'border-slate-800 bg-slate-900/90 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-3.5 w-3.5 rounded-sm border border-white/25"
                            style={{backgroundColor: skin.primaryHex}}
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-sm border border-white/25"
                            style={{backgroundColor: skin.visorHex}}
                          />
                        </div>
                        {active ? (
                          <Check className="w-3.5 h-3.5 text-orange-400" />
                        ) : unlocked ? (
                          <span className="text-[10px] font-semibold text-emerald-400">Owned</span>
                        ) : (
                          <span className="font-mono-num text-[11px] font-bold text-emerald-300">
                            ${skin.price}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 font-display text-xs font-bold text-white">
                        {skin.name}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-snug text-slate-400">
                        {skin.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h2 className="font-display text-lg font-bold text-white">Emotes</h2>
                </div>
                <span className="text-xs text-slate-400">Press B in combat to emote</span>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.values(EMOTES).map((emote) => {
                  const unlocked = career.unlockedEmotes.includes(emote.id);
                  const active = career.equippedEmote === emote.id;

                  return (
                    <div
                      key={emote.id}
                      className={`flex flex-col justify-between rounded-xl border p-3.5 ${
                        active
                          ? 'border-orange-500 bg-orange-500/15'
                          : 'border-slate-800 bg-slate-900/90'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-bold text-white">
                            {emote.name}
                          </span>
                          <span
                            className="font-mono-num text-xs font-bold"
                            style={{color: unlocked ? '#34d399' : emote.accentHex}}
                          >
                            {unlocked ? (active ? 'Equipped' : 'Owned') : `$${emote.price}`}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">{emote.description}</p>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onPreviewEmote(emote.id)}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => onBuyOrEquipEmote(emote.id)}
                          className={`ml-auto rounded-lg px-3 py-1 text-[11px] font-bold cursor-pointer ${
                            active
                              ? 'bg-orange-500/25 border border-orange-500/60 text-orange-200'
                              : unlocked
                              ? 'bg-slate-700 text-white hover:bg-slate-600'
                              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          }`}
                        >
                          {active ? 'Active (B)' : unlocked ? 'Equip' : `Buy $${emote.price}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ranked' && (
          <div className="pointer-events-auto max-w-3xl space-y-4">
            {/* Ranked Status, Level 50 & Verification Gate */}
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                    <Award className="w-4 h-4" />
                    <span>Ranked Season {career.rankedSeason ?? 4} · Bronze → Archnemesis</span>
                  </div>
                  <h2 className="mt-0.5 font-display text-xl font-bold text-white">
                    {rankedTierSpec.tier} ({career.rankedRR ?? 0} RR)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Hidden MMR: <strong className="text-sky-300">{career.hiddenMmr ?? 1000}</strong> ·{' '}
                    Ranked Record: {career.rankedWins ?? 0}W /{' '}
                    {Math.max(0, (career.rankedMatches ?? 0) - (career.rankedWins ?? 0))}L
                  </p>
                </div>

                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Seasonal Reset
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSeasonalReset();
                        setConfirmReset(false);
                      }}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                    >
                      Confirm New Season
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {shopNotice && (
                <div className="rounded-lg border border-sky-500/40 bg-sky-950/50 px-3 py-2 text-xs font-medium text-sky-200">
                  {shopNotice}
                </div>
              )}

              {/* 8 Tier Ladder */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {RANKED_TIERS.map((t) => {
                  const isCurrent = t.tier === rankedTierSpec.tier;
                  return (
                    <div
                      key={t.tier}
                      className={`rounded-lg border p-2.5 ${
                        isCurrent
                          ? 'border-amber-400 bg-amber-950/30'
                          : 'border-slate-800 bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-bold" style={{color: t.colorHex}}>
                          {t.tier}
                        </span>
                        <span className="font-mono-num text-[10px] text-slate-400">
                          {t.minRR}+ RR
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ranked Eligibility: Level 50 + Real-World Verification */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="rounded-xl border border-slate-800 bg-slate-900/85 p-3.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-200">1. Level 50 Clearance</span>
                    <span
                      className={`font-mono-num ${
                        (career.level ?? 1) >= 50 ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      Lv {career.level ?? 1} / 50
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-sky-400 transition-transform origin-left"
                      style={{
                        transform: `scaleX(${Math.min(1, (career.level ?? 1) / 50)})`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Next Level XP: {career.xp ?? 0} / {xpNext} (earn XP from matches &amp; quests)
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/85 p-3.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-200">2. Real-World Operator Verification</span>
                    {career.verified ? (
                      <span className="text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-rose-300">Required</span>
                    )}
                  </div>
                  {career.verified ? (
                    <p className="mt-2 text-xs text-slate-300">
                      Verified Identity: <strong>{career.verifiedEmail}</strong>
                    </p>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        onVerifyAccount(verifyEmail);
                      }}
                      className="mt-2 flex gap-1.5"
                    >
                      <input
                        type="email"
                        value={verifyEmail}
                        onChange={(e) => setVerifyEmail(e.target.value)}
                        placeholder="operator@domain.com"
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                      >
                        Verify
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* Season 4 Battle Pass */}
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                    <Crown className="w-4 h-4" />
                    <span>Season {career.rankedSeason ?? 4} Battle Pass · Tier {bpTier}/12</span>
                  </div>
                  <h2 className="mt-0.5 font-display text-xl font-bold text-white">
                    Free &amp; Premium Reward Track ({career.battlePassXp ?? 0} BP XP)
                  </h2>
                </div>

                {career.seasonPassOwned ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200">
                    <Check className="w-4 h-4" />
                    Season Pass Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onBuySeasonPass}
                    className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-300 cursor-pointer"
                  >
                    Unlock Season Pass (${SEASON_PASS_PRICE_CREDITS})
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {BATTLE_PASS_TIERS.map((tier) => {
                  const unlocked = (career.battlePassXp ?? 0) >= tier.xpRequired;
                  const freeClaimed = career.claimedFreePassTiers.includes(tier.tier);
                  const premClaimed = career.claimedPremiumPassTiers.includes(tier.tier);
                  return (
                    <div
                      key={tier.tier}
                      className={`rounded-xl border p-3 space-y-2 ${
                        unlocked
                          ? 'border-sky-500/50 bg-slate-900/95'
                          : 'border-slate-800 bg-slate-950/80 opacity-85'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-display font-bold text-white">Tier {tier.tier}</span>
                        <span className="font-mono-num text-[10px] text-slate-400">
                          {tier.xpRequired} BP XP
                        </span>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-300 truncate">Free: {tier.freeRewardLabel}</span>
                        {freeClaimed ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : unlocked ? (
                          <button
                            type="button"
                            onClick={() => onClaimPassTier(tier.tier, 'free')}
                            className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 cursor-pointer shrink-0"
                          >
                            Claim
                          </button>
                        ) : (
                          <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                        )}
                      </div>

                      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-amber-200 truncate">
                          Pass: {tier.premiumRewardLabel}
                        </span>
                        {premClaimed ? (
                          <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        ) : unlocked && career.seasonPassOwned ? (
                          <button
                            type="button"
                            onClick={() => onClaimPassTier(tier.tier, 'premium')}
                            className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950 cursor-pointer shrink-0"
                          >
                            Claim
                          </button>
                        ) : (
                          <Lock className="w-3 h-3 text-amber-500/70 shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="pointer-events-auto max-w-3xl space-y-4">
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                    <BarChart3 className="w-4 h-4" />
                    <span>Arena Rankings · Global &amp; Ranked RR</span>
                  </div>
                  <h2 className="mt-0.5 font-display text-xl font-bold text-white">
                    Global &amp; Career Leaderboard
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={onRefreshLeaderboard}
                  disabled={!isOnline || leaderboardLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-45 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${leaderboardLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-sky-500/40 bg-sky-950/25 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-sky-500/20 px-2 py-0.5 font-bold text-sky-300">
                      YOU
                    </span>
                    <span className="font-display text-sm font-bold text-white">{callsign}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 font-mono-num text-slate-200">
                    <span style={{color: rankedTierSpec.colorHex}}>
                      {rankedTierSpec.tier} ({career.rankedRR ?? 0} RR)
                    </span>
                    <span>{career.kills} K</span>
                    <span>{kdRatio} K/D</span>
                    <span>{career.rivalsWins} Wins</span>
                    <span className="text-emerald-300">Range Best {career.arenaBestScore}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 mr-1">Sort by:</span>
                {(
                  [
                    {id: 'totalScore', label: 'Total Score'},
                    {id: 'rankedRR', label: 'Ranked RR'},
                    {id: 'kills', label: 'Kills'},
                    {id: 'wins', label: 'Wins'},
                    {id: 'arenaBest', label: 'Arena Best'},
                  ] as {id: LeaderboardSort; label: string}[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLbSort(opt.id)}
                    className={`rounded-lg border px-2.5 py-1 font-semibold cursor-pointer ${
                      lbSort === opt.id
                        ? 'border-orange-500 bg-orange-500/20 text-orange-200'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="mt-3.5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
                {!isOnline ? (
                  <div className="p-5 text-center text-xs text-slate-400">
                    Offline mode active — your local career stats above are saved on-device. Reconnect to view server rankings.
                  </div>
                ) : sortedLeaderboard.length === 0 ? (
                  <div className="p-5 text-center text-xs text-slate-400">
                    No online match results submitted yet. Finish a match to claim #1 on the board.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-900/90 text-[10px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Operator</th>
                        <th className="px-3 py-2 text-right">RR</th>
                        <th className="px-3 py-2 text-right">Wins</th>
                        <th className="px-3 py-2 text-right">Kills</th>
                        <th className="px-3 py-2 text-right">K/D</th>
                        <th className="px-3 py-2 text-right">Range</th>
                        <th className="px-3 py-2 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono-num">
                      {sortedLeaderboard.map((entry, idx) => {
                        const ekd =
                          entry.deaths > 0
                            ? (entry.kills / entry.deaths).toFixed(2)
                            : entry.kills.toFixed(2);
                        const isMe = entry.callsign.toLowerCase() === callsign.trim().toLowerCase();
                        return (
                          <tr
                            key={entry.callsign}
                            className={isMe ? 'bg-sky-950/35 text-white' : 'text-slate-300'}
                          >
                            <td className="px-3 py-2 font-bold text-amber-400">#{idx + 1}</td>
                            <td className="px-3 py-2 font-sans font-semibold text-white">
                              {entry.callsign}
                            </td>
                            <td className="px-3 py-2 text-right text-amber-300">
                              {entry.rankedRR ?? 0}
                            </td>
                            <td className="px-3 py-2 text-right text-emerald-400">{entry.wins}</td>
                            <td className="px-3 py-2 text-right">{entry.kills}</td>
                            <td className="px-3 py-2 text-right text-sky-300">{ekd}</td>
                            <td className="px-3 py-2 text-right">{entry.arenaBest}</td>
                            <td className="px-3 py-2 text-right font-bold text-white">
                              {entry.totalScore.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quests' && (
          <div className="pointer-events-auto max-w-3xl space-y-4">
            {/* Career Stats Summary */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-4 text-center font-mono-num shadow-xl">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Kills</div>
                <div className="text-lg font-bold text-white">{career.kills}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">K/D</div>
                <div className="text-lg font-bold text-sky-400">{kdRatio}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Headshots</div>
                <div className="text-lg font-bold text-amber-300">{career.headshots}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Wins</div>
                <div className="text-lg font-bold text-emerald-400">{career.rivalsWins}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Level</div>
                <div className="text-lg font-bold text-sky-300">{career.level ?? 1}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Keys</div>
                <div className="text-lg font-bold text-cyan-300">{career.keys ?? 0}</div>
              </div>
            </div>

            {/* Quests */}
            <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl">
              <h2 className="font-display text-xl font-bold text-white">Arena Quests</h2>
              <p className="text-xs text-slate-400">
                Complete offline or multiplayer challenges to earn Keys, Credits, XP &amp; Wraps.
              </p>

              <div className="mt-4 space-y-3">
                {QUESTS.map((q) => {
                  const current = career[q.metric];
                  const pct = Math.min(100, Math.round((current / q.target) * 100));
                  const claimed = career.claimedQuests.includes(q.id);
                  const ready = current >= q.target && !claimed;

                  return (
                    <div
                      key={q.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/90 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-display text-sm font-bold text-white">{q.title}</h3>
                          <p className="text-xs text-slate-400">{q.description}</p>
                        </div>

                        {claimed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                            <Check className="w-4 h-4" />
                            Claimed
                          </span>
                        ) : ready ? (
                          <button
                            type="button"
                            onClick={() => onClaimQuest(q.id)}
                            className="rounded-lg bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-orange-400 cursor-pointer"
                          >
                            Claim Reward
                          </button>
                        ) : (
                          <span className="font-mono-num text-xs font-semibold text-slate-300">
                            {Math.min(current, q.target)} / {q.target}
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full bg-orange-500 transition-transform duration-200 origin-left"
                            style={{transform: `scaleX(${pct / 100})`}}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-sky-300 whitespace-nowrap">
                          {q.rewardLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Update 13 Patch Notes & Community Balance Feedback */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {UPDATE_PATCH_NOTES.map((patch) => (
                <div
                  key={patch.version}
                  className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl space-y-3"
                >
                  <div>
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      {patch.version} · {patch.date}
                    </span>
                    <h3 className="mt-1.5 font-display text-sm font-bold text-white">
                      {patch.title}
                    </h3>
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-300 list-disc pl-4">
                    {patch.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    {patch.balanceChanges.map((bc) => (
                      <div key={bc.weaponOrFeature} className="text-[11px]">
                        <span
                          className={`mr-1.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                            bc.kind === 'buff'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : bc.kind === 'nerf'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {bc.kind}
                        </span>
                        <strong className="text-white">{bc.weaponOrFeature}:</strong>{' '}
                        <span className="text-slate-400">{bc.change}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5 shadow-xl space-y-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                    Community Balance Feedback
                  </span>
                  <h3 className="font-display text-sm font-bold text-white">
                    Vote on Maps &amp; Weapon Tuning
                  </h3>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!fbMessage.trim() || fbSubmitting) return;
                    setFbSubmitting(true);
                    try {
                      await onSubmitFeedback(fbTopic, fbMessage.trim());
                      setFbMessage('');
                    } finally {
                      setFbSubmitting(false);
                    }
                  }}
                  className="space-y-2"
                >
                  <select
                    aria-label="Feedback topic"
                    value={fbTopic}
                    onChange={(e) => setFbTopic(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="Weapon Balance">Weapon Balance (52 Arsenal)</option>
                    <option value="SkyGrid Experimental">SkyGrid Experimental Map</option>
                    <option value="Weekly LTM Rotation">Weekly LTM Rotation</option>
                    <option value="Ranked & Matchmaking">Ranked &amp; Map Bans</option>
                  </select>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={fbMessage}
                      maxLength={200}
                      onChange={(e) => setFbMessage(e.target.value)}
                      placeholder="Suggest a balance tweak or map change..."
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={fbSubmitting || !fbMessage.trim()}
                      className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-45 cursor-pointer"
                    >
                      Submit
                    </button>
                  </div>
                </form>

                <div className="max-h-40 overflow-y-auto space-y-2 pt-1">
                  {feedbackItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-[11px]"
                    >
                      <div className="flex items-center justify-between text-slate-400">
                        <strong className="text-sky-300">{item.author}</strong>
                        <span className="text-[10px] text-amber-300">{item.topic}</span>
                      </div>
                      <p className="mt-0.5 text-slate-200">{item.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="pointer-events-auto max-w-4xl">
            <SettingsPanel
              gpu={gpu}
              audio={audio}
              onChangeGpu={onChangeGpu}
              onChangeAudio={onChangeAudio}
            />
          </div>
        )}
      </div>

      {/* Bottom Control Hint */}
      {(gpu.showKeybinds ?? true) ? (
        <footer className="flex items-center justify-between text-xs text-slate-400">
          <span className="rounded-lg border border-slate-800 bg-[#0b0f17]/85 px-3 py-1.5">
            WASD Move · Space Jump · Shift Sprint · C/Ctrl Slide · F Dash · V Quick Melee · B Emote · 1-4 Swap · G Utility · Y Inspect · R Reload
          </span>
        </footer>
      ) : (
        <div />
      )}
    </div>
  );
};
