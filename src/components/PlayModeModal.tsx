import React, {useMemo, useState} from 'react';
import {
  Ban,
  Bot,
  Check,
  Crown,
  Flame,
  Lock,
  Map as MapIcon,
  Play,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  GAME_MODES,
  GAME_MODES_LIST,
  MAPS,
  MAPS_LIST,
  RANKED_CURATED_MAP_POOL,
} from '../fps/catalog';
import {getRankedTierFromRR} from '../fps/storage';
import type {
  BotDifficulty,
  CareerStats,
  GameModeCategory,
  MapCategory,
  MapId,
  MatchFormat,
  SeasonalTheme,
} from '../fps/types';

interface PlayModeModalProps {
  open: boolean;
  onClose: () => void;
  selectedMode: MatchFormat;
  selectedMap: MapId;
  botDifficulty: BotDifficulty;
  seasonalTheme: SeasonalTheme;
  career: CareerStats;
  isRankedQueue: boolean;
  onToggleRankedQueue: (ranked: boolean) => void;
  onSelectMode: (mode: MatchFormat) => void;
  onSelectMap: (mapId: MapId) => void;
  onChangeDifficulty: (d: BotDifficulty) => void;
  onDeployMatch: (opts: {mode: MatchFormat; mapId: MapId; isRanked: boolean}) => void;
  onApplyToRoom?: (mode: MatchFormat, mapId: MapId) => void;
  inMultiplayerRoomHost: boolean;
  onGoToRankedTab: () => void;
}

const MODE_CATEGORIES: {id: GameModeCategory | 'all'; label: string}[] = [
  {id: 'all', label: 'All 21 Modes'},
  {id: 'duels', label: 'Duels (1v1–5v5)'},
  {id: 'core', label: 'Core'},
  {id: 'objective', label: 'Objective'},
  {id: 'special', label: 'Special'},
  {id: 'ltm', label: 'Weekly LTMs'},
];

const MAP_CATEGORIES: {id: MapCategory | 'all'; label: string}[] = [
  {id: 'all', label: 'All 30 Maps'},
  {id: 'regular', label: 'Regular (15)'},
  {id: 'big', label: 'Big Variants (7)'},
  {id: 'legacy', label: 'Legacy (7)'},
  {id: 'experimental', label: 'Experimental (1)'},
];

export const PlayModeModal: React.FC<PlayModeModalProps> = ({
  open,
  onClose,
  selectedMode,
  selectedMap,
  botDifficulty,
  seasonalTheme,
  career,
  isRankedQueue,
  onToggleRankedQueue,
  onSelectMode,
  onSelectMap,
  onChangeDifficulty,
  onDeployMatch,
  onApplyToRoom,
  inMultiplayerRoomHost,
  onGoToRankedTab,
}) => {
  const [modeCat, setModeCat] = useState<GameModeCategory | 'all'>('all');
  const [mapCat, setMapCat] = useState<MapCategory | 'all'>('all');
  const [bannedRankedMaps, setBannedRankedMaps] = useState<MapId[]>(['onyx', 'construction']);

  const rankedUnlocked = (career.level ?? 1) >= 50 && Boolean(career.verified);
  const rankTier = getRankedTierFromRR(career.rankedRR ?? 0);

  const availableRankedMaps = useMemo(
    () => RANKED_CURATED_MAP_POOL.filter((id) => !bannedRankedMaps.includes(id)),
    [bannedRankedMaps],
  );

  const filteredModes = useMemo(() => {
    if (modeCat === 'all') return GAME_MODES_LIST;
    return GAME_MODES_LIST.filter((m) => m.category === modeCat);
  }, [modeCat]);

  const filteredMaps = useMemo(() => {
    if (mapCat === 'all') return MAPS_LIST;
    return MAPS_LIST.filter((m) => m.category === mapCat);
  }, [mapCat]);

  if (!open) return null;

  const activeModeSpec = GAME_MODES[selectedMode];
  const activeMapSpec = MAPS[selectedMap];
  const effectiveMapId: MapId = isRankedQueue
    ? availableRankedMaps.includes(selectedMap)
      ? selectedMap
      : availableRankedMaps[0] ?? 'vanguard'
    : selectedMap;

  const toggleBanMap = (id: MapId) => {
    setBannedRankedMaps((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-700 bg-[#0b101b] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0d1424] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white tracking-wide">
                SELECT GAME MODE &amp; ARENA MAP
              </h2>
              <p className="text-[11px] text-slate-400">
                21 Modes · 30 Maps · Ranked Season {career.rankedSeason ?? 4} · Theme:{' '}
                <span className="text-amber-300 font-semibold capitalize">{seasonalTheme}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close mode selector"
            className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Ranked Queue & Map Ban Strip */}
          <div
            className={`rounded-xl border p-4 transition-colors ${
              isRankedQueue
                ? 'border-amber-400/70 bg-amber-950/25'
                : 'border-slate-800 bg-slate-900/75'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-white">
                      Ranked Competitive Queue
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-slate-950"
                      style={{backgroundColor: rankTier.colorHex}}
                    >
                      {rankTier.tier} · {career.rankedRR ?? 0} RR
                    </span>
                    {!rankedUnlocked && (
                      <span className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                        <Lock className="w-3 h-3" />
                        Requires Lv 50 ({career.level ?? 1}/50) &amp;{' '}
                        {career.verified ? 'Verified' : 'Unverified'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Curated 10-map pool, interactive 2-map ban phase, hidden MMR calibration &amp; RR ladder.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!rankedUnlocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGoToRankedTab();
                    }}
                    className="rounded-lg border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                  >
                    Unlock in Ranked &amp; Pass
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleRankedQueue(!isRankedQueue)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                      isRankedQueue
                        ? 'bg-amber-400 text-slate-950'
                        : 'border border-amber-400/60 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                    }`}
                  >
                    {isRankedQueue ? 'Ranked Queue ACTIVE' : 'Enter Ranked Queue'}
                  </button>
                )}
              </div>
            </div>

            {isRankedQueue && rankedUnlocked && (
              <div className="mt-3 pt-3 border-t border-amber-500/25">
                <div className="flex items-center justify-between text-[11px] text-amber-200 mb-2">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5 text-rose-400" />
                    Map Ban Phase — Click 2 Curated Maps to Ban ({bannedRankedMaps.length}/2)
                  </span>
                  <span className="font-mono-num text-emerald-300">
                    Active Pick: {MAPS[effectiveMapId].name}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {RANKED_CURATED_MAP_POOL.map((mid) => {
                    const isBanned = bannedRankedMaps.includes(mid);
                    const isPicked = !isBanned && effectiveMapId === mid;
                    return (
                      <div
                        key={mid}
                        className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-[11px] ${
                          isBanned
                            ? 'border-rose-500/50 bg-rose-950/50 text-rose-300 line-through'
                            : isPicked
                            ? 'border-emerald-400 bg-emerald-950/50 text-emerald-200 font-bold'
                            : 'border-slate-700 bg-slate-900 text-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => !isBanned && onSelectMap(mid)}
                          className="truncate text-left flex-1 cursor-pointer"
                        >
                          {MAPS[mid].name}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleBanMap(mid)}
                          title={isBanned ? 'Unban Map' : 'Ban Map'}
                          className={`ml-1 rounded px-1 py-0.5 text-[9px] font-bold cursor-pointer ${
                            isBanned
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white'
                          }`}
                        >
                          {isBanned ? 'BAN' : '×'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 21 Game Modes Section */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
                  21 Game Modes
                </h3>
              </div>

              <div className="flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
                {MODE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setModeCat(cat.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                      modeCat === cat.id
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredModes.map((m) => {
                const active = selectedMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectMode(m.id)}
                    className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-emerald-400 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-xs font-bold text-white truncate">
                        {m.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.isWeeklyFeatured && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                            <Flame className="w-2.5 h-2.5" />
                            WEEKLY
                          </span>
                        )}
                        {m.isLtm && !m.isWeeklyFeatured && (
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                            LTM
                          </span>
                        )}
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-num text-[10px] text-slate-300">
                          {m.maxPlayers}P
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-snug line-clamp-2">
                      {m.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 30 Maps Section */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-sky-400" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
                  30 Arena Maps
                </h3>
              </div>

              <div className="flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
                {MAP_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setMapCat(cat.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                      mapCat === cat.id
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredMaps.map((map) => {
                const active = effectiveMapId === map.id;
                const supportsCurrentMode = map.supportedModes.includes(selectedMode);
                return (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => onSelectMap(map.id)}
                    className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-orange-500 bg-orange-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-display text-xs font-bold text-white truncate">
                        {map.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {map.isRankedPool && (
                          <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-300">
                            RNK
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            map.difficulty === 'Easy'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : map.difficulty === 'Medium'
                              ? 'bg-sky-500/20 text-sky-300'
                              : map.difficulty === 'Hard'
                              ? 'bg-orange-500/20 text-orange-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {map.difficulty}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-snug line-clamp-2">
                      {map.tagline}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="truncate">By {map.creator}</span>
                      <span
                        className={`font-semibold ${
                          supportsCurrentMode ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {map.supportedModes.length} modes
                        {!supportsCurrentMode ? ' · Custom' : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky Deploy Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-[#0d1424] px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Bot className="w-4 h-4 text-sky-400" />
              <span>Offline AI:</span>
              {(['recruit', 'tactician', 'ace'] as BotDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChangeDifficulty(d)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold capitalize cursor-pointer ${
                    botDifficulty === d
                      ? 'border-orange-500 bg-orange-500/20 text-orange-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="hidden md:flex items-center gap-2 text-slate-400">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                <strong className="text-white">{activeModeSpec.name}</strong> on{' '}
                <strong className="text-white">{MAPS[effectiveMapId]?.name ?? activeMapSpec.name}</strong>
                {isRankedQueue ? ' (Ranked)' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {inMultiplayerRoomHost && onApplyToRoom && (
              <button
                type="button"
                onClick={() => {
                  onApplyToRoom(selectedMode, effectiveMapId);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/60 bg-sky-500/20 px-4 py-2.5 text-xs font-bold text-sky-200 hover:bg-sky-500/30 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                Apply to Room
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeployMatch({
                  mode: selectedMode,
                  mapId: effectiveMapId,
                  isRanked: isRankedQueue && rankedUnlocked,
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              PLAY {activeModeSpec.shortLabel.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
