import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Award,
  Ban,
  BarChart3,
  DollarSign,
  Eye,
  Film,
  Flag,
  Flame,
  Heart,
  KeyRound,
  Pause,
  RotateCcw,
  Shield,
  ShieldCheck,
  ShoppingBag,
  SkipForward,
  Snowflake,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import {AdminPanel} from './components/AdminPanel';
import {LobbyOverlay, type FeedbackEntry, type LobbyTab} from './components/LobbyOverlay';
import {PlayModeModal} from './components/PlayModeModal';
import {SettingsPanel} from './components/SettingsPanel';
import {GAME_MODES, MAPS} from './fps/catalog';
import {CHARMS, EMOTES, FINISHERS, OPERATOR_SKINS, SKIN_PACKS} from './fps/cosmetics';
import {FpsEngine} from './fps/FpsEngine';
import {
  DEFAULT_ADMIN_TOOLS,
  DEFAULT_PRIVATE_SERVER_CONFIG,
  appointAdminLocal,
  authenticateAdminLocal,
  banPlayerLocal,
  claimBattlePassTier,
  claimDailyBonus,
  claimOwnershipLocal,
  claimQuestReward,
  loadAdminRegistry,
  loadAudioSettings,
  loadCallsign,
  loadCareer,
  loadGpuSettings,
  loadLoadout,
  loadSelectedMap,
  loadSessionAdminRole,
  performSeasonalRankedReset,
  purchaseCharm,
  purchaseDailyOffer,
  purchaseEmote,
  purchaseFinisher,
  purchaseOperatorSkin,
  purchaseSeasonPass,
  purchaseSkinPack,
  purchaseWeapon,
  recordCareerDelta,
  revokeAdminLocal,
  saveCallsign,
  saveLoadout,
  saveSelectedMap,
  saveSessionAdminRole,
  unbanPlayerLocal,
  verifyOperatorAccount,
  type LoadoutState,
} from './fps/storage';
import type {
  AdminRegistry,
  AdminRole,
  AdminToolsState,
  AudioSettings,
  BotDifficulty,
  CareerStats,
  CharmId,
  DailyShopOffer,
  EmoteId,
  FinisherId,
  FloatingDamage,
  GlobalLeaderboardEntry,
  GpuSettings,
  KillCamInfo,
  KillFeedItem,
  LobbyChatMessage,
  MapId,
  MatchFormat,
  MatchHudSnapshot,
  MatchLeaderboardRow,
  MatchOverSummary,
  OperatorSkinId,
  PlayMode,
  PrivateServerSettings,
  PublicRoomSummary,
  RoomStateInfo,
  ScreenOverlay,
  TeamId,
  WeaponId,
  WrapId,
} from './fps/types';
import {WEAPONS, WRAPS} from './fps/weapons';
import {useOnlineStatus} from './hooks/useOnlineStatus';

const INITIAL_HUD: MatchHudSnapshot = {
  hp: 100,
  maxHp: 100,
  shield: 50,
  maxShield: 50,
  ammo: 28,
  magSize: 28,
  isReloading: false,
  reloadProgress: 0,
  activeSlot: 'primary',
  weaponId: 'vx47',
  weaponName: 'VX-47 Carbine',
  isAds: false,
  isSliding: false,
  isCrouching: false,
  dashReady: true,
  utilityCooldownSec: 0,
  playerScore: 0,
  rivalScore: 0,
  targetScore: 5,
  matchFormat: 'duel',
  selfTeam: 'alpha',
  teamScores: {alpha: 0, bravo: 0},
  roundNumber: 1,
  roundBanner: null,
  hitmarkerType: 'none',
  damageFlash: 0,
  arenaScore: 0,
  arenaTimeLeftSec: 60,
  arenaAccuracyPct: 100,
  arenaStreak: 0,
  pointerLocked: false,
  radarBlips: [],
  playerYaw: 0,
  teammateMarkers: [],
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FpsEngine | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const {isOnline} = useOnlineStatus();

  const [playMode, setPlayMode] = useState<PlayMode>('lobby');
  const [overlay, setOverlay] = useState<ScreenOverlay>('none');
  const [pauseShowSettings, setPauseShowSettings] = useState(false);
  const [lobbyTab, setLobbyTab] = useState<LobbyTab>('play');
  const [playModalOpen, setPlayModalOpen] = useState(false);
  const [isRankedQueue, setIsRankedQueue] = useState(false);
  const [privateDraft, setPrivateDraft] = useState<PrivateServerSettings>(() => ({
    ...DEFAULT_PRIVATE_SERVER_CONFIG,
  }));

  const [loadout, setLoadout] = useState<LoadoutState>(() => loadLoadout());
  const [previewWeapon, setPreviewWeapon] = useState<WeaponId>(() => loadLoadout().primary);
  const [selectedMap, setSelectedMap] = useState<MapId>(() => loadSelectedMap());
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('duel');
  const [gpu, setGpu] = useState<GpuSettings>(() => loadGpuSettings());
  const [audio, setAudio] = useState<AudioSettings>(() => loadAudioSettings());
  const [career, setCareer] = useState<CareerStats>(() => loadCareer());
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('tactician');
  const [callsign, setCallsign] = useState<string>(() => loadCallsign());

  const [hud, setHud] = useState<MatchHudSnapshot>(INITIAL_HUD);
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([]);
  const [damageNumbers, setDamageNumbers] = useState<FloatingDamage[]>([]);
  const [matchSummary, setMatchSummary] = useState<MatchOverSummary | null>(null);
  const [killCamInfo, setKillCamInfo] = useState<KillCamInfo | null>(null);
  const [killCamProgress, setKillCamProgress] = useState(0);
  const [shopNotice, setShopNotice] = useState<string | null>(null);
  const [emoteToast, setEmoteToast] = useState<{text: string; accentHex: string} | null>(null);

  // Owner & Admin RBAC state
  const [adminSession, setAdminSession] = useState<{role: AdminRole; label: string}>(() =>
    loadSessionAdminRole(),
  );
  const [adminRegistry, setAdminRegistry] = useState<AdminRegistry>(() => loadAdminRegistry());
  const [adminTools, setAdminTools] = useState<AdminToolsState>(() => ({...DEFAULT_ADMIN_TOOLS}));
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [bannedNotice, setBannedNotice] = useState<string | null>(null);

  const [contextLost, setContextLost] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Multiplayer WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomStateInfo | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [lobbyChat, setLobbyChat] = useState<LobbyChatMessage[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<GlobalLeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackEntry[]>([]);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [fps, setFps] = useState<number>(60);
  const [pingMs, setPingMs] = useState<number | null>(null);

  const selfIdRef = useRef<string | null>(null);
  selfIdRef.current = selfId;
  const playModeRef = useRef<PlayMode>(playMode);
  playModeRef.current = playMode;
  const overlayRef = useRef<ScreenOverlay>(overlay);
  overlayRef.current = overlay;
  const roomRef = useRef<RoomStateInfo | null>(room);
  roomRef.current = room;
  const callsignRef = useRef<string>(callsign);
  callsignRef.current = callsign;
  const equippedSkinRef = useRef<OperatorSkinId>(career.equippedSkin);
  equippedSkinRef.current = career.equippedSkin;
  const showDamageNumbersRef = useRef<boolean>(gpu.showDamageNumbers ?? true);
  showDamageNumbersRef.current = gpu.showDamageNumbers ?? true;
  const emoteTimerRef = useRef<number>(0);

  const refreshLeaderboard = useCallback(async () => {
    if (!isOnline) return;
    setLeaderboardLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = (await res.json()) as {entries?: GlobalLeaderboardEntry[]};
        if (Array.isArray(data.entries)) {
          setLeaderboardEntries(data.entries);
        }
      }
    } catch {
      // ignore offline error
    } finally {
      setLeaderboardLoading(false);
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({type: 'leaderboard:list'}));
    }
  }, [isOnline]);

  const showEmoteToast = useCallback((sender: string, emoteId: EmoteId) => {
    const spec = EMOTES[emoteId];
    if (!spec) return;
    window.clearTimeout(emoteTimerRef.current);
    setEmoteToast({text: `${sender} · ${spec.name}`, accentHex: spec.accentHex});
    emoteTimerRef.current = window.setTimeout(() => {
      setEmoteToast(null);
    }, 2200);
  }, []);

  const refreshFeedback = useCallback(async () => {
    if (!isOnline) return;
    try {
      const res = await fetch('/api/feedback');
      if (res.ok) {
        const data = (await res.json()) as {items?: FeedbackEntry[]};
        if (Array.isArray(data.items)) setFeedbackItems(data.items);
      }
    } catch {
      // ignore offline
    }
  }, [isOnline]);

  const handleSubmitFeedback = useCallback(
    async (topic: string, message: string) => {
      if (!isOnline) {
        setFeedbackItems((prev) => [
          {id: `local_${Date.now()}`, author: callsignRef.current, topic, message, ts: Date.now()},
          ...prev,
        ]);
        return;
      }
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({author: callsignRef.current, topic, message}),
      });
      if (res.ok) {
        const data = (await res.json()) as {items?: FeedbackEntry[]};
        if (Array.isArray(data.items)) setFeedbackItems(data.items);
      }
    },
    [isOnline],
  );

  useEffect(() => {
    refreshFeedback();
  }, [refreshFeedback]);

  useEffect(() => {
    const touch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    setIsTouchDevice(touch);
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const engine = new FpsEngine(el, {
      onHudUpdate: (snap) => setHud(snap),
      onFpsUpdate: (val) => setFps(val),
      onKillFeed: (item) => {
        setKillFeed((prev) => [item, ...prev].slice(0, 4));
      },
      onDamageNumber: (dmg) => {
        if (!showDamageNumbersRef.current) return;
        setDamageNumbers((prev) => [...prev.slice(-6), dmg]);
        window.setTimeout(() => {
          setDamageNumbers((prev) => prev.filter((item) => item.id !== dmg.id));
        }, 620);
      },
      onKillCamStart: (info) => {
        setKillCamInfo(info);
        setKillCamProgress(0);
        setShowScoreboard(false);
        setOverlay('kill_cam');
      },
      onKillCamProgress: (progress01) => {
        setKillCamProgress(progress01);
      },
      onMatchOver: (summary) => {
        const finalSummary: MatchOverSummary =
          summary.mode === 'rivals_1p' && !summary.leaderboard
            ? {
                ...summary,
                leaderboard: [
                  {
                    id: 'self',
                    name: callsignRef.current,
                    kills: summary.kills,
                    deaths: summary.deaths,
                    damage: summary.damageDealt,
                    score: summary.matchTotalScore,
                    isSelf: true,
                  },
                  {
                    id: 'bot_rival',
                    name: 'Rival AI',
                    kills: summary.rivalScore,
                    deaths: summary.kills,
                    damage: 0,
                    score: summary.rivalScore * 250,
                  },
                ].sort((a, b) => b.kills - a.kills || b.score - a.score),
              }
            : summary;

        setShowScoreboard(false);
        setMatchSummary(finalSummary);
        setOverlay('match_over');

        if (
          finalSummary.mode !== 'multiplayer' &&
          wsRef.current?.readyState === WebSocket.OPEN
        ) {
          const latestCareer = loadCareer();
          wsRef.current.send(
            JSON.stringify({
              type: 'leaderboard:submit',
              callsign: callsignRef.current,
              winsDelta: finalSummary.victory && finalSummary.mode !== 'shooting_arena' ? 1 : 0,
              killsDelta: finalSummary.kills,
              deathsDelta: finalSummary.deaths,
              matchesDelta: 1,
              scoreDelta: finalSummary.matchTotalScore,
              arenaBest: finalSummary.arenaScore ?? 0,
              rankedRR: latestCareer.rankedRR ?? 0,
            }),
          );
        }
      },
      onEmotePerformed: (emoteId) => {
        showEmoteToast(callsignRef.current, emoteId);
      },
      onSendNetEmote: (emoteId) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({type: 'player:emote', emoteId}));
        }
      },
      onCareerUpdated: () => {
        setCareer(loadCareer());
      },
      onPointerLockChange: () => {},
      onContextLost: () => setContextLost(true),
      onSendNetState: (st) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({type: 'player:state', ...st}));
        }
      },
      onSendNetShoot: (payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({type: 'player:shoot', ...payload}));
        }
      },
      onSendNetHit: (payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({type: 'player:hit', ...payload}));
        }
      },
    });

    engine.setLoadout(
      loadout.primary,
      loadout.secondary,
      loadout.melee,
      loadout.utility,
      loadout.wrap,
    );
    engine.setOperatorCosmetics(
      career.equippedSkin,
      career.equippedEmote,
      career.equippedCharm,
      career.equippedFinisher,
    );
    engine.setAdminTools(adminSession.role, adminTools);
    engineRef.current = engine;

    return () => {
      window.clearTimeout(emoteTimerRef.current);
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setOperatorCosmetics(
      career.equippedSkin,
      career.equippedEmote,
      career.equippedCharm,
      career.equippedFinisher,
    );
  }, [career.equippedSkin, career.equippedEmote, career.equippedCharm, career.equippedFinisher]);

  useEffect(() => {
    engineRef.current?.setAdminTools(adminSession.role, adminTools);
  }, [adminSession.role, adminTools]);

  useEffect(() => {
    if (!isOnline) {
      setWsConnected(false);
      setPingMs(null);
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    let cancelled = false;
    let reconnectTimer = 0;

    const connect = () => {
      if (cancelled) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setWsConnected(true);
        setRoomError(null);
        ws.send(JSON.stringify({type: 'room:list'}));
        ws.send(JSON.stringify({type: 'leaderboard:list'}));
        ws.send(JSON.stringify({type: 'ping', clientTs: Date.now()}));
      };

      ws.onmessage = (evt) => {
        if (cancelled) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(evt.data)) as Record<string, unknown>;
        } catch {
          return;
        }

        if (msg.type === 'pong' && typeof msg.clientTs === 'number') {
          setPingMs(Math.max(1, Math.round(Date.now() - msg.clientTs)));
        } else if (msg.type === 'welcome' && typeof msg.playerId === 'string') {
          setSelfId(msg.playerId);
          if (typeof msg.ownerClaimed === 'boolean' && msg.ownerClaimed) {
            setAdminRegistry((prev) => ({...prev, ownerClaimed: true}));
          }
        } else if (msg.type === 'leaderboard:list' && Array.isArray(msg.entries)) {
          setLeaderboardEntries(msg.entries as GlobalLeaderboardEntry[]);
          setLeaderboardLoading(false);
        } else if (msg.type === 'admin:auth_result') {
          if (msg.ok) {
            const role = (msg.role as AdminRole) || 'none';
            const label = typeof msg.label === 'string' ? msg.label : '';
            saveSessionAdminRole(role, label);
            setAdminSession({role, label});
            setAdminAuthError(null);
            if (msg.state) {
              const st = msg.state as Partial<AdminRegistry>;
              setAdminRegistry((prev) => ({
                ...prev,
                ownerClaimed: Boolean(st.ownerClaimed),
                ownerName: st.ownerName ?? prev.ownerName,
                appointedAdmins: st.appointedAdmins ?? prev.appointedAdmins,
                bannedList: st.bannedList ?? prev.bannedList,
              }));
            }
            if (role === 'none') {
              setAdminTools({...DEFAULT_ADMIN_TOOLS});
            }
          } else {
            setAdminAuthError(
              typeof msg.reason === 'string' ? msg.reason : 'Authorization failed.',
            );
          }
        } else if (msg.type === 'admin:state' && msg.state) {
          const st = msg.state as Partial<AdminRegistry>;
          setAdminRegistry((prev) => ({
            ...prev,
            ownerClaimed: Boolean(st.ownerClaimed),
            ownerName: st.ownerName ?? prev.ownerName,
            appointedAdmins: st.appointedAdmins ?? prev.appointedAdmins,
            bannedList: st.bannedList ?? prev.bannedList,
          }));
        } else if (msg.type === 'admin:appointed') {
          const label = typeof msg.label === 'string' ? msg.label : callsignRef.current;
          saveSessionAdminRole('admin', label);
          setAdminSession({role: 'admin', label});
          setShopNotice('Owner appointed you as an Arena Admin! Press F9 to open Admin Panel.');
        } else if (msg.type === 'admin:revoked') {
          saveSessionAdminRole('none', '');
          setAdminSession({role: 'none', label: ''});
          setAdminTools({...DEFAULT_ADMIN_TOOLS});
          setAdminPanelOpen(false);
        } else if (msg.type === 'player:banned' || msg.type === 'room:kicked') {
          const reason =
            typeof msg.reason === 'string'
              ? msg.reason
              : msg.type === 'room:kicked'
              ? 'Removed from room by Host'
              : 'Banned by Admin';
          setRoom(null);
          setOverlay('none');
          setPlayMode('lobby');
          engineRef.current?.enterLobby();
          setBannedNotice(reason);
          setRoomError(reason);
        } else if (msg.type === 'room:list' && Array.isArray(msg.rooms)) {
          setPublicRooms(msg.rooms as PublicRoomSummary[]);
        } else if (msg.type === 'room:error' && typeof msg.message === 'string') {
          setRoomError(msg.message);
        } else if (msg.type === 'room:left') {
          setRoom(null);
          setLobbyChat([]);
        } else if (msg.type === 'lobby:chat' && msg.message) {
          const chatMsg = msg.message as LobbyChatMessage;
          setLobbyChat((prev) => [...prev.slice(-18), chatMsg]);
        } else if (msg.type === 'room:state' && msg.room) {
          const r = msg.room as RoomStateInfo;
          setRoom(r);
          setRoomError(null);
          const me = r.players.find((p) => p.id === selfIdRef.current);
          const topOther = r.players
            .filter((p) => p.id !== selfIdRef.current)
            .reduce((m, p) => Math.max(m, p.score), 0);
          if (me && playModeRef.current === 'multiplayer') {
            engineRef.current?.updateMultiplayerScores(me.score, topOther, r.teamScores);
          }
        } else if (msg.type === 'match:started' && msg.room) {
          const r = msg.room as RoomStateInfo;
          setRoom(r);
          const myId = selfIdRef.current || '';
          const me = r.players.find((p) => p.id === myId);
          setKillFeed([]);
          setDamageNumbers([]);
          setMatchSummary(null);
          setKillCamInfo(null);
          setShowScoreboard(false);
          setOverlay('none');
          setPlayMode('multiplayer');
          engineRef.current?.startMultiplayerMatch(
            me?.spawnIdx ?? 0,
            r.players,
            myId,
            r.mapId,
            r.matchFormat,
            me?.team ?? 'alpha',
            {
              privateConfig: r.privateConfig,
              selfSpectator: Boolean(me?.spectator),
            },
          );
        } else if (msg.type === 'player:state' && typeof msg.id === 'string') {
          engineRef.current?.syncRemotePlayerState(
            msg.id,
            Number(msg.x) || 0,
            Number(msg.y) || 0,
            Number(msg.z) || 0,
            Number(msg.yaw) || 0,
          );
        } else if (msg.type === 'player:shoot') {
          if (Array.isArray(msg.origin) && Array.isArray(msg.hitPoint)) {
            engineRef.current?.spawnRemoteShot(
              msg.origin as [number, number, number],
              msg.hitPoint as [number, number, number],
            );
          }
        } else if (msg.type === 'player:damaged') {
          if (msg.targetId === selfIdRef.current) {
            engineRef.current?.handleRemoteDamage(
              Number(msg.hp) || 0,
              typeof msg.attackerId === 'string' ? msg.attackerId : undefined,
              typeof msg.attackerName === 'string' ? msg.attackerName : undefined,
            );
          }
        } else if (msg.type === 'player:eliminated') {
          const tid = String(msg.targetId);
          const aid = String(msg.attackerId);
          const headshot = Boolean(msg.headshot);
          engineRef.current?.handleRemotePlayerState(tid, false);
          if (aid === selfIdRef.current) {
            recordCareerDelta({kills: 1, headshots: headshot ? 1 : 0});
            setCareer(loadCareer());
          }
          setKillFeed((prev) =>
            [
              {
                id: Date.now() + Math.random(),
                attacker: aid === selfIdRef.current ? 'You' : String(msg.attackerName || 'Rival'),
                victim: tid === selfIdRef.current ? 'You' : String(msg.targetName || 'Rival'),
                attackerTeam: msg.attackerTeam as TeamId | undefined,
                victimTeam: msg.targetTeam as TeamId | undefined,
                weapon: 'Arena Fire',
                headshot,
              },
              ...prev,
            ].slice(0, 4),
          );
        } else if (msg.type === 'player:respawned') {
          const tid = String(msg.targetId);
          engineRef.current?.handleRemotePlayerState(tid, true);
          if (tid === selfIdRef.current) {
            const me = roomRef.current?.players.find((p) => p.id === tid);
            engineRef.current?.respawnSelfMultiplayer(me?.spawnIdx ?? 0);
          }
        } else if (msg.type === 'player:emote' && typeof msg.id === 'string') {
          const sender =
            roomRef.current?.players.find((p) => p.id === msg.id)?.name || 'Rival';
          showEmoteToast(sender, msg.emoteId as EmoteId);
        } else if (msg.type === 'match:victory' && msg.room) {
          const r = msg.room as RoomStateInfo;
          setRoom(r);
          const isTdm = (GAME_MODES[r.matchFormat]?.teamCount ?? 0) >= 2;
          const me = r.players.find((p) => p.id === selfIdRef.current);
          const winTeam = (msg.winnerTeam as TeamId | null | undefined) ?? r.winnerTeam ?? null;
          const won = isTdm
            ? Boolean(winTeam && me?.team === winTeam)
            : String(msg.winnerId) === selfIdRef.current;

          const pScore = isTdm ? r.teamScores[me?.team ?? 'alpha'] ?? 0 : me?.score ?? 0;
          const otherTeams = (['alpha', 'bravo', 'charlie'] as TeamId[]).filter(
            (t) => t !== (me?.team ?? 'alpha'),
          );
          const rScore = isTdm
            ? Math.max(...otherTeams.map((t) => r.teamScores[t] ?? 0))
            : r.players
                .filter((p) => p.id !== selfIdRef.current)
                .reduce((m, p) => Math.max(m, p.score), 0);

          const finalLeaderboard: MatchLeaderboardRow[] = r.players
            .map((p) => {
              const pWon = isTdm ? p.team === winTeam : p.id === String(msg.winnerId);
              return {
                id: p.id,
                name: p.name,
                team: p.team,
                role: p.role,
                kills: p.kills ?? p.score,
                deaths: p.deaths ?? 0,
                damage: p.damage ?? 0,
                score:
                  (p.kills ?? p.score) * 250 +
                  Math.round((p.damage ?? 0) * 0.5) +
                  (pWon ? 500 : 0),
                isSelf: p.id === selfIdRef.current,
                alive: p.alive,
              };
            })
            .sort((a, b) => b.kills - a.kills || b.score - a.score);

          setShowScoreboard(false);
          engineRef.current?.releasePointerLock();
          const summary = engineRef.current?.buildMatchSummary(
            won,
            'multiplayer',
            pScore,
            rScore,
            {
              teamScores: r.teamScores,
              winnerTeam: winTeam,
              leaderboard: finalLeaderboard,
            },
          );
          if (summary) {
            setMatchSummary(summary);
            if (engineRef.current?.hasKillCam() && engineRef.current.startKillCamReplay(summary)) {
              return;
            }
          }
          setOverlay('match_over');
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setWsConnected(false);
        setPingMs(null);
        reconnectTimer = window.setTimeout(connect, 2500);
      };
    };

    connect();

    const pingInterval = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({type: 'ping', clientTs: Date.now()}));
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      clearInterval(pingInterval);
      wsRef.current?.close();
    };
  }, [isOnline]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Tab' && playModeRef.current !== 'lobby' && overlayRef.current === 'none') {
        e.preventDefault();
        setShowScoreboard(true);
        return;
      }

      if (e.code === 'F9' && !e.repeat) {
        e.preventDefault();
        engineRef.current?.releasePointerLock();
        setAdminPanelOpen((v) => !v);
        return;
      }

      if (e.code === 'KeyM' && !e.repeat) {
        setAudio((prev) => {
          const next = {...prev, muted: !prev.muted};
          engineRef.current?.applyAudioSettings(next);
          return next;
        });
        return;
      }

      if (e.code === 'Escape' && !e.repeat && playModeRef.current !== 'lobby') {
        if (overlayRef.current === 'none') {
          setShowScoreboard(false);
          engineRef.current?.setPaused(true);
          setPauseShowSettings(false);
          setOverlay('paused');
        } else if (overlayRef.current === 'paused') {
          engineRef.current?.setPaused(false);
          setOverlay('none');
        }
        return;
      }

      if (e.code === 'KeyF' && !e.repeat && playModeRef.current !== 'lobby') {
        engineRef.current?.triggerDash();
        return;
      }

      if (e.code === 'KeyB' && !e.repeat && playModeRef.current === 'lobby') {
        engineRef.current?.triggerEmote();
        return;
      }

      if (playModeRef.current !== 'lobby' && overlayRef.current === 'none') {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }
        engineRef.current?.onKeyDown(e.code);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        setShowScoreboard(false);
        return;
      }
      engineRef.current?.onKeyUp(e.code);
    };

    const onBlur = () => {
      setShowScoreboard(false);
      engineRef.current?.clearAllInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const handleLoadoutChange = useCallback(
    (next: {
      primary?: WeaponId;
      secondary?: WeaponId;
      melee?: WeaponId;
      utility?: WeaponId;
      wrap?: WrapId;
      previewId?: WeaponId;
    }) => {
      setLoadout((prev) => {
        const updated: LoadoutState = {
          primary: next.primary ?? prev.primary,
          secondary: next.secondary ?? prev.secondary,
          melee: next.melee ?? prev.melee,
          utility: next.utility ?? prev.utility,
          wrap: next.wrap ?? prev.wrap,
        };
        const showId = next.previewId ?? previewWeapon;
        if (next.previewId) setPreviewWeapon(next.previewId);
        saveLoadout(updated);
        engineRef.current?.setLoadout(
          updated.primary,
          updated.secondary,
          updated.melee,
          updated.utility,
          updated.wrap,
          showId,
        );
        if (wsRef.current?.readyState === WebSocket.OPEN && room) {
          wsRef.current.send(
            JSON.stringify({
              type: 'player:loadout',
              primaryGun: updated.primary,
              secondaryGun: updated.secondary,
              meleeGun: updated.melee,
              utilityItem: updated.utility,
              wrapId: updated.wrap,
              skinId: equippedSkinRef.current,
            }),
          );
        }
        return updated;
      });
    },
    [room, previewWeapon],
  );

  const syncSkinToRoom = useCallback(
    (skinId: OperatorSkinId) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && room) {
        wsRef.current.send(JSON.stringify({type: 'player:loadout', skinId}));
      }
    },
    [room],
  );

  const handleClaimDailyBonus = useCallback(() => {
    const res = claimDailyBonus();
    setCareer(res.career);
    setShopNotice(
      res.claimed
        ? `Claimed +$${res.amount} & +${res.keysAmount} Keys daily drop! Wallet: $${res.career.credits}`
        : 'Daily drop already claimed today.',
    );
  }, []);

  const handleUnlockWeapon = useCallback(
    (wid: WeaponId) => {
      const res = purchaseWeapon(wid);
      setCareer(res.career);
      if (res.ok) {
        const w = WEAPONS[wid];
        if (w.slot === 'primary') handleLoadoutChange({primary: wid, previewId: wid});
        else if (w.slot === 'secondary') handleLoadoutChange({secondary: wid, previewId: wid});
        else if (w.slot === 'melee') handleLoadoutChange({melee: wid, previewId: wid});
        else handleLoadoutChange({utility: wid, previewId: wid});
        setShopNotice(`Unlocked & equipped ${w.name}!`);
      } else if (res.reason) {
        setShopNotice(res.reason);
      }
    },
    [handleLoadoutChange],
  );

  const handleBuyOrEquipCharm = useCallback((charmId: CharmId) => {
    const res = purchaseCharm(charmId);
    setCareer(res.career);
    if (res.ok) {
      setShopNotice(`Equipped charm: ${CHARMS[charmId].name}`);
    } else if (res.reason) {
      setShopNotice(res.reason);
    }
  }, []);

  const handleBuyOrEquipFinisher = useCallback((finisherId: FinisherId) => {
    const res = purchaseFinisher(finisherId);
    setCareer(res.career);
    if (res.ok) {
      setShopNotice(`Equipped finisher: ${FINISHERS[finisherId].name}`);
    } else if (res.reason) {
      setShopNotice(res.reason);
    }
  }, []);

  const handleBuySeasonPass = useCallback(() => {
    const res = purchaseSeasonPass();
    setCareer(res.career);
    setShopNotice(res.ok ? 'Season 4 Battle Pass Activated!' : res.reason ?? null);
  }, []);

  const handleClaimPassTier = useCallback((tierNum: number, track: 'free' | 'premium') => {
    const res = claimBattlePassTier(tierNum, track);
    setCareer(res.career);
    setShopNotice(
      res.ok ? `Claimed Tier ${tierNum} (${track}) Battle Pass reward!` : res.reason ?? null,
    );
  }, []);

  const handleVerifyAccount = useCallback((email: string) => {
    const res = verifyOperatorAccount(email);
    setCareer(res.career);
    setShopNotice(
      res.ok
        ? 'Real-world operator verification complete! Ranked unlocks at Level 50.'
        : res.reason ?? null,
    );
  }, []);

  const handleSeasonalReset = useCallback(() => {
    const next = performSeasonalRankedReset();
    setCareer(next);
    setShopNotice(`Entered Season ${next.rankedSeason} — Ranked RR & Battle Pass reset!`);
  }, []);

  const handleBuySkinPack = useCallback(
    (packId: string) => {
      const pack = SKIN_PACKS.find((p) => p.id === packId);
      const res = purchaseSkinPack(packId);
      setCareer(res.career);
      if (res.ok) {
        if (res.packWrap) handleLoadoutChange({wrap: res.packWrap});
        if (res.packSkin) syncSkinToRoom(res.packSkin);
        setShopNotice(`Equipped ${pack?.name ?? 'Skin Pack'}! Wallet: $${res.career.credits}`);
      } else if (res.reason) {
        setShopNotice(res.reason);
      }
    },
    [handleLoadoutChange, syncSkinToRoom],
  );

  const handleBuyDailyOffer = useCallback(
    (offer: DailyShopOffer) => {
      const res = purchaseDailyOffer(offer);
      setCareer(res.career);
      if (res.ok) {
        if (res.unlockedWrap) handleLoadoutChange({wrap: res.unlockedWrap});
        if (res.unlockedSkin) syncSkinToRoom(res.unlockedSkin);
        if (res.unlockedEmote) engineRef.current?.triggerEmote(res.unlockedEmote);
        if (res.unlockedWeapon) {
          const w = WEAPONS[res.unlockedWeapon];
          if (w.slot === 'primary') handleLoadoutChange({primary: w.id, previewId: w.id});
          else if (w.slot === 'secondary') handleLoadoutChange({secondary: w.id, previewId: w.id});
          else if (w.slot === 'melee') handleLoadoutChange({melee: w.id, previewId: w.id});
          else handleLoadoutChange({utility: w.id, previewId: w.id});
        }
        setShopNotice(`Unlocked & equipped ${offer.name}!`);
      } else if (res.reason) {
        setShopNotice(res.reason);
      }
    },
    [handleLoadoutChange, syncSkinToRoom],
  );

  const handleBuyOrEquipSkin = useCallback(
    (skinId: OperatorSkinId) => {
      const res = purchaseOperatorSkin(skinId);
      setCareer(res.career);
      if (res.ok) {
        syncSkinToRoom(skinId);
        setShopNotice(
          `Equipped ${OPERATOR_SKINS[skinId].name} · Wallet: $${res.career.credits}`,
        );
      } else if (res.reason) {
        setShopNotice(res.reason);
      }
    },
    [syncSkinToRoom],
  );

  const handleBuyOrEquipEmote = useCallback((emoteId: EmoteId) => {
    const res = purchaseEmote(emoteId);
    setCareer(res.career);
    if (res.ok) {
      engineRef.current?.triggerEmote(emoteId);
      setShopNotice(
        `Equipped emote ${EMOTES[emoteId].name} (Press B in arena) · Wallet: $${res.career.credits}`,
      );
    } else if (res.reason) {
      setShopNotice(res.reason);
    }
  }, []);

  const handlePreviewWeapon = useCallback(
    (id: WeaponId) => {
      setPreviewWeapon(id);
      engineRef.current?.setLoadout(
        loadout.primary,
        loadout.secondary,
        loadout.melee,
        loadout.utility,
        loadout.wrap,
        id,
      );
    },
    [loadout],
  );

  const handleGpuChange = useCallback((next: GpuSettings) => {
    setGpu(next);
    engineRef.current?.applyGpuSettings(next);
  }, []);

  const handleAudioChange = useCallback((next: AudioSettings) => {
    setAudio(next);
    engineRef.current?.applyAudioSettings(next);
  }, []);

  const launchOfflineMatch = useCallback(
    (opts?: {mode?: MatchFormat; mapId?: MapId; isRanked?: boolean}) => {
      const fmt = opts?.mode ?? matchFormat;
      const mid = opts?.mapId ?? selectedMap;
      const ranked = opts?.isRanked ?? (isRankedQueue && (career.level ?? 1) >= 50 && career.verified);
      setMatchFormat(fmt);
      setSelectedMap(mid);
      saveSelectedMap(mid);
      setKillFeed([]);
      setDamageNumbers([]);
      setMatchSummary(null);
      setOverlay('none');
      setPlayMode('rivals_1p');
      engineRef.current?.startSinglePlayerRivals(botDifficulty, mid, fmt, {
        isRanked: ranked,
        privateConfig: privateDraft,
      });
    },
    [botDifficulty, selectedMap, matchFormat, isRankedQueue, career.level, career.verified, privateDraft],
  );

  const handleStartRivals1P = useCallback(() => {
    launchOfflineMatch();
  }, [launchOfflineMatch]);

  const handleQuickDuelPad = useCallback(
    (fmt: MatchFormat) => {
      launchOfflineMatch({mode: fmt});
    },
    [launchOfflineMatch],
  );

  const handleStartArena = useCallback(() => {
    setKillFeed([]);
    setDamageNumbers([]);
    setMatchSummary(null);
    setOverlay('none');
    setPlayMode('shooting_arena');
    engineRef.current?.startShootingArena();
  }, []);

  const returnToLobby = useCallback(() => {
    if (playMode === 'multiplayer' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({type: 'room:leave'}));
      setRoom(null);
      setLobbyChat([]);
    }
    setOverlay('none');
    setPlayMode('lobby');
    engineRef.current?.enterLobby();
  }, [playMode]);

  const handleClaimOwner = useCallback((ownerName: string, passkey: string) => {
    const res = claimOwnershipLocal(ownerName, passkey);
    setAdminRegistry(res.registry);
    if (res.ok) {
      setAdminSession({role: 'owner', label: res.registry.ownerName || ownerName});
      setAdminAuthError(null);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({type: 'admin:claim_owner', name: ownerName, passkey}),
        );
      }
    } else {
      setAdminAuthError(res.reason || 'Failed to claim ownership.');
    }
  }, []);

  const handleAuthenticateAdmin = useCallback(
    (passkey: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({type: 'admin:auth', name: callsign, passkey}));
      }
      const res = authenticateAdminLocal(callsign, passkey);
      if (res.ok) {
        setAdminSession({role: res.role, label: res.label});
        setAdminAuthError(null);
      } else if (wsRef.current?.readyState !== WebSocket.OPEN) {
        setAdminAuthError(res.reason || 'Invalid Owner or Admin passkey.');
      }
    },
    [callsign],
  );

  const handleLockAdmin = useCallback(() => {
    saveSessionAdminRole('none', '');
    setAdminSession({role: 'none', label: ''});
    setAdminTools({...DEFAULT_ADMIN_TOOLS});
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({type: 'admin:lock'}));
    }
  }, []);

  const handleAppointAdmin = useCallback((name: string, passcode: string) => {
    const res = appointAdminLocal(name, passcode);
    setAdminRegistry(res.registry);
    if (res.ok && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({type: 'admin:appoint', name, passcode}));
    }
  }, []);

  const handleRevokeAdmin = useCallback((name: string) => {
    setAdminRegistry(revokeAdminLocal(name));
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({type: 'admin:revoke', name}));
    }
  }, []);

  const handleBanPlayer = useCallback(
    (opts: {targetId?: string; targetName: string; reason: string}) => {
      setAdminRegistry(
        banPlayerLocal(opts.targetName, opts.reason, adminSession.label || callsign),
      );
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'admin:ban',
            targetId: opts.targetId,
            targetName: opts.targetName,
            reason: opts.reason,
          }),
        );
      }
    },
    [adminSession.label, callsign],
  );

  const handleUnbanPlayer = useCallback((name: string) => {
    setAdminRegistry(unbanPlayerLocal(name));
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({type: 'admin:unban', name}));
    }
  }, []);

  const touchLookRef = useRef<{x: number; y: number} | null>(null);
  const crosshairGap = gpu.crosshair.gap ?? (gpu.crosshair.size === 1 ? 6 : gpu.crosshair.size === 3 ? 13 : 9);
  const crosshairArm = 3 + gpu.crosshair.size * 3;
  const crosshairThick = gpu.crosshair.thickness ?? 2;
  const crosshairOutline = gpu.crosshair.outline ?? true ? '0 0 0 1px rgba(0,0,0,0.9)' : 'none';
  const crosshairDot = gpu.crosshair.centerDot ?? true;
  const crosshairOpacity = gpu.crosshair.opacity ?? 0.95;
  const showFps = gpu.showFps ?? true;
  const showPing = gpu.showPing ?? true;
  const showKeybinds = gpu.showKeybinds ?? true;
  const hudScaleClass =
    gpu.hudScale === 'compact'
      ? 'scale-90'
      : gpu.hudScale === 'large'
      ? 'scale-[1.06]'
      : 'scale-100';

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#0b0f17] text-slate-100"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Isolated WebGL Viewport */}
      <div
        ref={mountRef}
        className="fixed inset-0 z-0"
        onMouseDown={(e) => {
          if (playMode !== 'lobby' && overlay === 'none') {
            engineRef.current?.onMouseDown(e.button, e.clientX, e.clientY);
          }
        }}
        onMouseMove={(e) => {
          if (playMode !== 'lobby' && overlay === 'none') {
            engineRef.current?.onMouseMove(e.movementX, e.movementY, e.clientX, e.clientY);
          }
        }}
        onMouseUp={(e) => {
          if (playMode !== 'lobby') {
            engineRef.current?.onMouseUp(e.button);
          }
        }}
      />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f17] p-6 text-center">
          <div className="max-w-md rounded-xl border border-slate-700 bg-[#111827] p-6">
            <h2 className="font-display text-xl font-bold text-white">Graphics Context Lost</h2>
            <p className="mt-2 text-sm text-slate-300">
              WebGL context was interrupted. Reload to restore the arena.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-bold text-slate-950 cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      )}

      {/* LOBBY SCREEN */}
      {playMode === 'lobby' && (
        <>
          <LobbyOverlay
            activeTab={lobbyTab}
            onChangeTab={setLobbyTab}
            onOpenPlayModal={() => setPlayModalOpen(true)}
            primaryGun={loadout.primary}
            secondaryGun={loadout.secondary}
            meleeGun={loadout.melee}
            utilityItem={loadout.utility}
            wrapId={loadout.wrap}
            onSelectPrimary={(id) => handleLoadoutChange({primary: id, previewId: id})}
            onSelectSecondary={(id) => handleLoadoutChange({secondary: id, previewId: id})}
            onSelectMelee={(id) => handleLoadoutChange({melee: id, previewId: id})}
            onSelectUtility={(id) => handleLoadoutChange({utility: id, previewId: id})}
            onSelectWrap={(id) => handleLoadoutChange({wrap: id})}
            onUnlockWeapon={handleUnlockWeapon}
            onPreviewWeapon={handlePreviewWeapon}
            selectedMap={selectedMap}
            onSelectMap={(m) => {
              setSelectedMap(m);
              saveSelectedMap(m);
            }}
            matchFormat={matchFormat}
            onSelectFormat={setMatchFormat}
            onQuickDuelPad={handleQuickDuelPad}
            botDifficulty={botDifficulty}
            onChangeDifficulty={setBotDifficulty}
            isRankedQueue={isRankedQueue}
            onStartRivals1P={handleStartRivals1P}
            onStartShootingArena={handleStartArena}
            gpu={gpu}
            audio={audio}
            onChangeGpu={handleGpuChange}
            onChangeAudio={handleAudioChange}
            career={career}
            onClaimQuest={(qid) => setCareer(claimQuestReward(qid))}
            shopNotice={shopNotice}
            onClaimDailyBonus={handleClaimDailyBonus}
            onBuySkinPack={handleBuySkinPack}
            onBuyDailyOffer={handleBuyDailyOffer}
            onBuyOrEquipSkin={handleBuyOrEquipSkin}
            onBuyOrEquipEmote={handleBuyOrEquipEmote}
            onBuyOrEquipCharm={handleBuyOrEquipCharm}
            onBuyOrEquipFinisher={handleBuyOrEquipFinisher}
            onBuySeasonPass={handleBuySeasonPass}
            onClaimPassTier={handleClaimPassTier}
            onVerifyAccount={handleVerifyAccount}
            onSeasonalReset={handleSeasonalReset}
            onPreviewEmote={(emoteId) => engineRef.current?.triggerEmote(emoteId)}
            adminRole={adminSession.role}
            onOpenAdminPanel={() => setAdminPanelOpen(true)}
            onQuickBanPlayer={(targetId, targetName) =>
              handleBanPlayer({targetId, targetName, reason: 'Banned by Room Admin'})
            }
            isOnline={isOnline}
            wsConnected={wsConnected}
            callsign={callsign}
            onChangeCallsign={(name) => {
              setCallsign(name);
              saveCallsign(name);
            }}
            room={room}
            selfId={selfId}
            publicRooms={publicRooms}
            roomError={roomError}
            lobbyChat={lobbyChat}
            privateDraft={privateDraft}
            onChangePrivateDraft={setPrivateDraft}
            onRefreshRooms={() => wsRef.current?.send(JSON.stringify({type: 'room:list'}))}
            onCreateRoom={(asPrivate) => {
              setLobbyChat([]);
              wsRef.current?.send(
                JSON.stringify({
                  type: 'room:create',
                  name: callsign,
                  mapId: selectedMap,
                  matchFormat,
                  privateConfig: {
                    ...privateDraft,
                    isPrivate: Boolean(asPrivate),
                    seasonalTheme: gpu.seasonalTheme ?? 'normal',
                  },
                  primaryGun: loadout.primary,
                  secondaryGun: loadout.secondary,
                  meleeGun: loadout.melee,
                  utilityItem: loadout.utility,
                  wrapId: loadout.wrap,
                  skinId: career.equippedSkin,
                }),
              );
            }}
            onJoinRoom={(code, asSpectator) => {
              setLobbyChat([]);
              wsRef.current?.send(
                JSON.stringify({
                  type: 'room:join',
                  code,
                  name: callsign,
                  spectator: Boolean(asSpectator),
                  primaryGun: loadout.primary,
                  secondaryGun: loadout.secondary,
                  meleeGun: loadout.melee,
                  utilityItem: loadout.utility,
                  wrapId: loadout.wrap,
                  skinId: career.equippedSkin,
                }),
              );
            }}
            onLeaveRoom={() => wsRef.current?.send(JSON.stringify({type: 'room:leave'}))}
            onToggleReady={() => {
              const me = room?.players.find((p) => p.id === selfId);
              wsRef.current?.send(
                JSON.stringify({type: 'player:loadout', ready: !(me?.ready ?? false)}),
              );
            }}
            onToggleSpectate={() => {
              const me = room?.players.find((p) => p.id === selfId);
              wsRef.current?.send(
                JSON.stringify({type: 'player:spectate', spectator: !(me?.spectator ?? false)}),
              );
            }}
            onKickPlayer={(targetId) =>
              wsRef.current?.send(JSON.stringify({type: 'room:kick', targetId}))
            }
            onConfigRoom={(cfg) =>
              wsRef.current?.send(JSON.stringify({type: 'room:config', ...cfg}))
            }
            onSwitchTeam={(team) =>
              wsRef.current?.send(JSON.stringify({type: 'player:switch_team', team}))
            }
            onSendChat={(text) =>
              wsRef.current?.send(JSON.stringify({type: 'room:chat', text}))
            }
            onStartMpMatch={() => wsRef.current?.send(JSON.stringify({type: 'match:start'}))}
            leaderboardEntries={leaderboardEntries}
            leaderboardLoading={leaderboardLoading}
            onRefreshLeaderboard={refreshLeaderboard}
            feedbackItems={feedbackItems}
            onSubmitFeedback={handleSubmitFeedback}
          />

          <PlayModeModal
            open={playModalOpen}
            onClose={() => setPlayModalOpen(false)}
            selectedMode={matchFormat}
            selectedMap={selectedMap}
            botDifficulty={botDifficulty}
            seasonalTheme={gpu.seasonalTheme ?? 'normal'}
            career={career}
            isRankedQueue={isRankedQueue}
            onToggleRankedQueue={setIsRankedQueue}
            onSelectMode={setMatchFormat}
            onSelectMap={(m) => {
              setSelectedMap(m);
              saveSelectedMap(m);
            }}
            onChangeDifficulty={setBotDifficulty}
            onDeployMatch={(opts) => launchOfflineMatch(opts)}
            inMultiplayerRoomHost={Boolean(room && room.hostId === selfId)}
            onApplyToRoom={(mode, mapId) => {
              setMatchFormat(mode);
              setSelectedMap(mapId);
              saveSelectedMap(mapId);
              wsRef.current?.send(JSON.stringify({type: 'room:config', matchFormat: mode, mapId}));
            }}
            onGoToRankedTab={() => setLobbyTab('ranked')}
          />
        </>
      )}

      {/* Emote Broadcast Toast */}
      {emoteToast && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-30 -translate-x-1/2 rounded-xl border border-slate-700 bg-[#0b0f17]/95 px-4 py-2 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Sparkles className="w-3.5 h-3.5" style={{color: emoteToast.accentHex}} />
            <span>{emoteToast.text}</span>
          </div>
        </div>
      )}

      {/* Live FPS & Ping Telemetry Overlay (Visible in Lobby & In-Match) */}
      {(showFps || showPing) && overlay !== 'kill_cam' && (
        <div
          className={`pointer-events-none fixed z-20 flex items-center gap-2.5 rounded-lg border border-slate-700/80 bg-[#0b0f17]/92 px-3 py-1 font-mono-num text-[11px] font-bold shadow-lg ${
            playMode === 'lobby'
              ? 'top-[76px] right-4 md:right-6'
              : 'top-4 left-1/2 -translate-x-1/2'
          }`}
        >
          {showFps && (
            <span
              className={
                fps >= 50 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-300' : 'text-rose-400'
              }
            >
              FPS {fps}
            </span>
          )}
          {showFps && showPing && <span className="text-slate-600">·</span>}
          {showPing && (
            <span
              className={
                !isOnline || !wsConnected || pingMs === null
                  ? 'text-slate-400'
                  : pingMs < 65
                  ? 'text-sky-300'
                  : pingMs < 130
                  ? 'text-amber-300'
                  : 'text-rose-400'
              }
            >
              PING {isOnline && wsConnected && pingMs !== null ? `${pingMs}ms` : 'OFFLINE'}
            </span>
          )}
        </div>
      )}

      {/* Banned Toast Banner */}
      {bannedNotice && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-rose-500/70 bg-rose-950/95 px-4 py-2.5 text-xs font-bold text-rose-100 shadow-2xl">
          <Ban className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{bannedNotice}</span>
          <button
            type="button"
            onClick={() => setBannedNotice(null)}
            className="rounded bg-rose-800 px-2 py-0.5 text-[10px] hover:bg-rose-700 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* COMBAT & SHOOTING ARENA HUD */}
      {playMode !== 'lobby' && overlay !== 'kill_cam' && (
        <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 md:p-6">
          {/* Friendly TDM Teammate Overhead Markers */}
          {hud.teammateMarkers?.map((tm) => (
            <div
              key={tm.id}
              className="fixed pointer-events-none -translate-x-1/2 -translate-y-full"
              style={{left: `${tm.x}%`, top: `${tm.y}%`}}
            >
              <div className="whitespace-nowrap rounded border border-sky-400/70 bg-sky-950/90 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-sky-200">
                ALLY · {tm.name} · {tm.distMeters}m
              </div>
            </div>
          ))}

          {/* Admin ESP 2D Brackets Overlay */}
          {(adminSession.role === 'owner' || adminSession.role === 'admin') &&
            adminTools.espEnabled &&
            hud.espTargets?.map((t) => {
              const isTdm = hud.matchFormat === 'tdm_2v2' || hud.matchFormat === 'tdm_4v4';
              const isAlly = isTdm && t.team === hud.selfTeam;
              return (
                <div
                  key={t.id}
                  className={`fixed pointer-events-none -translate-x-1/2 -translate-y-1/2 border-2 ${
                    isAlly ? 'border-sky-400/90' : 'border-rose-500/90'
                  }`}
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width: `${t.boxW}vh`,
                    height: `${t.boxH}vh`,
                  }}
                >
                  <div
                    className={`absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 font-mono-num text-[10px] font-bold border ${
                      isAlly
                        ? 'bg-sky-950/90 text-sky-200 border-sky-400/60'
                        : 'bg-rose-950/90 text-rose-200 border-rose-500/60'
                    }`}
                  >
                    {isTdm && t.team ? `[${t.team.toUpperCase()}] ` : ''}
                    {t.name} · {t.hp}HP · {t.distMeters}m
                  </div>
                </div>
              );
            })}

          {/* Flashbang Blindness Whiteout Vignette */}
          {(hud.blindedFlash ?? 0) > 0.02 && (
            <div
              className="fixed inset-0 z-20 pointer-events-none bg-white"
              style={{opacity: Math.min(0.95, hud.blindedFlash ?? 0)}}
            />
          )}

          {/* Damage Screen Vignette */}
          {hud.damageFlash > 0.02 && (
            <div
              className="fixed inset-0 pointer-events-none border-[10px] border-rose-500/70"
              style={{opacity: hud.damageFlash * 0.75}}
            />
          )}

          {/* Floating Damage Numbers */}
          {damageNumbers.map((d) => (
            <div
              key={d.id}
              className={`fixed pointer-events-none -translate-x-1/2 -translate-y-full font-mono-num font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
                d.crit ? 'text-xl text-amber-300' : 'text-base text-white'
              }`}
              style={{left: `${d.x}%`, top: `${d.y}%`}}
            >
              -{d.amount}
            </div>
          ))}

          {/* Sniper Scope Overlay */}
          {hud.isAds && hud.weaponId === 'longbow' && (
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
              <div className="h-64 w-64 rounded-full border-2 border-sky-400/70 shadow-[0_0_0_9999px_rgba(8,12,20,0.72)] flex items-center justify-center">
                <div className="h-px w-full bg-sky-400/45" />
                <div className="absolute w-px h-64 bg-sky-400/45" />
              </div>
            </div>
          )}

          {/* Top Bar: Scoreboard + Radar | Killfeed + Pause */}
          <div className="flex items-start justify-between gap-4">
            <div className={`flex flex-col gap-2.5 origin-top-left ${hudScaleClass}`}>
              {/* Score / Mode Objective Cluster */}
              {playMode === 'shooting_arena' ? (
                <div className="rounded-xl border border-slate-700/70 bg-[#0b0f17]/88 px-4 py-2.5">
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="font-display font-bold text-sky-300">SHOOTING ARENA</span>
                    <span className="font-mono-num font-bold text-white">
                      {hud.arenaTimeLeftSec}s
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-4 font-mono-num">
                    <span className="text-2xl font-bold text-white">{hud.arenaScore}</span>
                    <span className="text-xs text-slate-400">ACC {hud.arenaAccuracyPct}%</span>
                    <span className="text-xs text-orange-400">STREAK {hud.arenaStreak}</span>
                  </div>
                </div>
              ) : (GAME_MODES[hud.matchFormat]?.teamCount ?? 0) >= 2 ? (
                <div className="rounded-xl border border-slate-700/70 bg-[#0b0f17]/90 px-4 py-2.5 min-w-[245px]">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                    <span className="font-display font-bold text-orange-400">
                      {MAPS[room?.mapId ?? selectedMap]?.name.toUpperCase()} ·{' '}
                      {GAME_MODES[hud.matchFormat]?.shortLabel}
                    </span>
                    <span>Goal {hud.targetScore}</span>
                  </div>
                  <div
                    className={`mt-1.5 grid ${
                      GAME_MODES[hud.matchFormat]?.teamCount === 3
                        ? 'grid-cols-3'
                        : 'grid-cols-[1fr_auto_1fr]'
                    } items-center gap-2.5 font-mono-num`}
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-1.5 text-xs">
                        <span className="font-bold text-sky-300">
                          ALPHA{hud.selfTeam === 'alpha' ? '*' : ''}
                        </span>
                        <span className="text-lg font-bold text-sky-400">
                          {hud.teamScores?.alpha ?? 0}
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-sky-400 transition-transform duration-150 origin-left"
                          style={{
                            transform: `scaleX(${Math.min(
                              1,
                              (hud.teamScores?.alpha ?? 0) / Math.max(1, hud.targetScore),
                            )})`,
                          }}
                        />
                      </div>
                    </div>

                    {GAME_MODES[hud.matchFormat]?.teamCount !== 3 && (
                      <span className="text-slate-600 font-bold">:</span>
                    )}

                    <div>
                      <div className="flex items-baseline justify-between gap-1.5 text-xs">
                        <span className="font-bold text-rose-300">
                          BRAVO{hud.selfTeam === 'bravo' ? '*' : ''}
                        </span>
                        <span className="text-lg font-bold text-rose-400">
                          {hud.teamScores?.bravo ?? 0}
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-rose-500 transition-transform duration-150 origin-left"
                          style={{
                            transform: `scaleX(${Math.min(
                              1,
                              (hud.teamScores?.bravo ?? 0) / Math.max(1, hud.targetScore),
                            )})`,
                          }}
                        />
                      </div>
                    </div>

                    {GAME_MODES[hud.matchFormat]?.teamCount === 3 && (
                      <div>
                        <div className="flex items-baseline justify-between gap-1.5 text-xs">
                          <span className="font-bold text-emerald-300">
                            CHARLIE{hud.selfTeam === 'charlie' ? '*' : ''}
                          </span>
                          <span className="text-lg font-bold text-emerald-400">
                            {hud.teamScores?.charlie ?? 0}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full bg-emerald-400 transition-transform duration-150 origin-left"
                            style={{
                              transform: `scaleX(${Math.min(
                                1,
                                (hud.teamScores?.charlie ?? 0) / Math.max(1, hud.targetScore),
                              )})`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-700/70 bg-[#0b0f17]/88 px-4 py-2.5">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="font-display font-bold text-orange-400">
                      {MAPS[room?.mapId ?? selectedMap]?.name.toUpperCase()} ·{' '}
                      {GAME_MODES[hud.matchFormat]?.shortLabel}
                    </span>
                    <span>First to {hud.targetScore}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 font-mono-num text-xl font-bold">
                    <span className="text-emerald-400">YOU {hud.playerScore}</span>
                    <span className="text-slate-600">:</span>
                    <span className="text-rose-400">RIVAL {hud.rivalScore}</span>
                  </div>
                </div>
              )}

              {/* Mode Objective Pills (Gun Game, CTF, Domination, Royale, PvE, Buffs) */}
              <div className="flex flex-wrap gap-1.5">
                {hud.gunGameTotal && (
                  <div className="rounded-lg border border-amber-400/50 bg-amber-950/75 px-2.5 py-1 font-mono-num text-[11px] font-bold text-amber-200">
                    GUN LADDER: {(hud.gunGameStep ?? 0) + 1} / {hud.gunGameTotal}
                  </div>
                )}
                {hud.pveMaxWaves && (
                  <div className="rounded-lg border border-purple-400/50 bg-purple-950/75 px-2.5 py-1 font-mono-num text-[11px] font-bold text-purple-200">
                    TOWER WAVE {hud.pveWave ?? 1} / {hud.pveMaxWaves}
                  </div>
                )}
                {typeof hud.royaleAlive === 'number' && (
                  <div className="rounded-lg border border-rose-400/50 bg-rose-950/75 px-2.5 py-1 font-mono-num text-[11px] font-bold text-rose-200">
                    ALIVE: {hud.royaleAlive} · STORM {hud.royaleZoneRadius ?? 45}m
                  </div>
                )}
                {hud.ctfCarrier && (
                  <div className="inline-flex items-center gap-1 rounded-lg border border-amber-400/60 bg-amber-950/80 px-2.5 py-1 text-[11px] font-bold text-amber-200">
                    <Flag className="w-3.5 h-3.5" />
                    Flag Carrier: {hud.ctfCarrier}
                  </div>
                )}
                {hud.domZones && hud.domZones.length > 0 && (
                  <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#0b0f17]/90 px-2 py-1 font-mono-num text-[11px] font-bold">
                    {hud.domZones.map((z) => (
                      <span
                        key={z.label}
                        className={`rounded px-1.5 py-0.5 ${
                          z.owner === 'alpha'
                            ? 'bg-sky-500/30 text-sky-300'
                            : z.owner === 'bravo'
                            ? 'bg-rose-500/30 text-rose-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {z.label}
                      </span>
                    ))}
                  </div>
                )}
                {(hud.warHornTimer ?? 0) > 0 && (
                  <div className="inline-flex items-center gap-1 rounded-lg border border-amber-400/60 bg-amber-950/80 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                    <Swords className="w-3 h-3" />
                    WAR HORN BOOST
                  </div>
                )}
                {(hud.chilledTimer ?? 0) > 0 && (
                  <div className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/60 bg-cyan-950/80 px-2.5 py-1 text-[11px] font-bold text-cyan-200">
                    <Snowflake className="w-3 h-3" />
                    CRYO SLOWED
                  </div>
                )}
              </div>

              {/* Tactical Radar Minimap */}
              <div className="relative h-24 w-24 rounded-full border border-slate-700/80 bg-[#0b0f17]/85 overflow-hidden shadow-lg">
                <div className="absolute inset-3 rounded-full border border-slate-800/90" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-800/70" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-800/70" />
                {/* Self Center Triangle */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 bg-emerald-400 rotate-45 rounded-[1px]" />
                {/* Radar Blips rotated to player look yaw */}
                {hud.radarBlips.map((b, idx) => {
                  const cos = Math.cos(-hud.playerYaw);
                  const sin = Math.sin(-hud.playerYaw);
                  const rx = b.dx * cos - b.dz * sin;
                  const rz = b.dx * sin + b.dz * cos;
                  const scale = 1.35; // ~32m radius inside 48px half-width
                  const px = Math.max(-42, Math.min(42, rx * scale));
                  const py = Math.max(-42, Math.min(42, rz * scale));
                  return (
                    <div
                      key={idx}
                      className={`absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 ${
                        b.hostile ? 'bg-rose-500' : 'bg-sky-400'
                      }`}
                      style={{transform: `translate(${px}px, ${py}px)`}}
                    />
                  );
                })}
              </div>
            </div>

            {/* Top-Right Controls & Killfeed */}
            <div className={`flex flex-col items-end gap-2 origin-top-right ${hudScaleClass}`}>
              <div className="pointer-events-auto flex items-center gap-2">
                {!hud.pointerLocked && !isTouchDevice && overlay === 'none' && (
                  <button
                    type="button"
                    onClick={() => engineRef.current?.requestPointerLock()}
                    className="rounded-lg border border-orange-500/50 bg-[#0d1320]/90 px-3 py-1.5 text-xs font-semibold text-orange-200 hover:bg-slate-800 cursor-pointer"
                  >
                    Click Arena to Lock Aim
                  </button>
                )}
                {playMode !== 'shooting_arena' && (
                  <button
                    type="button"
                    onClick={() => setShowScoreboard((v) => !v)}
                    title="Scoreboard (Hold Tab)"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-[#0d1320]/90 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    <BarChart3 className="w-4 h-4 text-sky-400" />
                    <span className="hidden sm:inline">Tab</span>
                  </button>
                )}
                {playMode === 'shooting_arena' && (
                  <button
                    type="button"
                    onClick={handleStartArena}
                    title="Restart Arena Challenge"
                    className="rounded-lg border border-slate-700/80 bg-[#0d1320]/90 p-2 text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowScoreboard(false);
                    engineRef.current?.setPaused(true);
                    setOverlay('paused');
                  }}
                  title="Pause (Esc)"
                  className="rounded-lg border border-slate-700/80 bg-[#0d1320]/90 p-2 text-slate-200 hover:bg-slate-800 cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                </button>
              </div>

              {killFeed.map((kf) => (
                <div
                  key={kf.id}
                  className="rounded-md border border-slate-700/60 bg-[#0b0f17]/88 px-2.5 py-1 text-[11px] font-medium text-slate-200"
                >
                  <span
                    className={`font-semibold ${
                      kf.attackerTeam === 'alpha'
                        ? 'text-sky-300'
                        : kf.attackerTeam === 'bravo'
                        ? 'text-rose-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {kf.attacker}
                  </span>
                  <span className="mx-1.5 text-slate-500">
                    [{kf.weapon}
                    {kf.headshot ? ' HS' : ''}]
                  </span>
                  <span
                    className={`font-semibold ${
                      kf.victimTeam === 'alpha'
                        ? 'text-sky-300'
                        : kf.victimTeam === 'bravo'
                        ? 'text-rose-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {kf.victim}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Tab Match Scoreboard Overlay */}
          {showScoreboard && overlay === 'none' && playMode !== 'shooting_arena' && (
            <div className="pointer-events-none fixed inset-x-0 top-28 z-20 mx-auto w-full max-w-xl px-4">
              <div className="rounded-xl border border-slate-700 bg-[#0b0f17]/94 p-4 shadow-2xl">
                <div className="flex items-center justify-between text-xs mb-2.5">
                  <span className="font-display font-bold text-white uppercase tracking-wider">
                    Live Match Scoreboard · {MAPS[room?.mapId ?? selectedMap]?.name}
                  </span>
                  <span className="font-mono-num text-slate-400">
                    Target: {hud.targetScore}
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="py-1.5">Operator</th>
                      {(hud.matchFormat === 'tdm_2v2' || hud.matchFormat === 'tdm_4v4') && (
                        <th className="py-1.5">Team</th>
                      )}
                      <th className="py-1.5 text-right">Kills</th>
                      <th className="py-1.5 text-right">Deaths</th>
                      <th className="py-1.5 text-right">Damage</th>
                      <th className="py-1.5 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 font-mono-num">
                    {(playMode === 'multiplayer' && room
                      ? [...room.players].sort(
                          (a, b) => (b.kills ?? b.score) - (a.kills ?? a.score),
                        )
                      : [
                          {
                            id: 'self',
                            name: callsign,
                            team: 'alpha' as TeamId,
                            kills: hud.playerScore,
                            deaths: hud.rivalScore,
                            damage: 0,
                            score: hud.playerScore * 250,
                          },
                          {
                            id: 'bot_rival',
                            name: 'Rival AI',
                            team: 'bravo' as TeamId,
                            kills: hud.rivalScore,
                            deaths: hud.playerScore,
                            damage: 0,
                            score: hud.rivalScore * 250,
                          },
                        ]
                    ).map((row) => {
                      const isMe = row.id === selfId || row.id === 'self';
                      return (
                        <tr key={row.id} className={isMe ? 'text-white bg-slate-800/40' : 'text-slate-300'}>
                          <td className="py-1.5 font-sans font-semibold">
                            {row.name} {isMe ? <span className="text-[10px] text-emerald-400">(YOU)</span> : ''}
                          </td>
                          {(hud.matchFormat === 'tdm_2v2' || hud.matchFormat === 'tdm_4v4') && (
                            <td className="py-1.5 font-sans text-[10px] font-bold">
                              <span className={row.team === 'alpha' ? 'text-sky-400' : 'text-rose-400'}>
                                {row.team === 'alpha' ? 'ALPHA' : 'BRAVO'}
                              </span>
                            </td>
                          )}
                          <td className="py-1.5 text-right text-emerald-400">{row.kills ?? row.score}</td>
                          <td className="py-1.5 text-right">{row.deaths ?? 0}</td>
                          <td className="py-1.5 text-right">{row.damage ?? 0}</td>
                          <td className="py-1.5 text-right font-bold">
                            {((row.kills ?? row.score) * 250 + Math.round((row.damage ?? 0) * 0.5)).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Center Crosshair & Hitmarker & Round Banner */}
          <div className="relative my-auto flex flex-col items-center justify-center">
            {hud.isSpectating && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-sky-400/60 bg-[#0b0f17]/92 px-4 py-1.5 text-xs font-bold text-sky-200 shadow-lg">
                <Eye className="w-4 h-4 text-sky-400" />
                <span>
                  SPECTATING: {hud.spectateTargetName ?? 'Arena Camera'} · Click or ←/→ to switch
                </span>
              </div>
            )}
            {hud.killStreakBanner && (
              <div className="mb-3 rounded-lg border border-amber-400/70 bg-amber-950/90 px-4 py-1 font-display text-sm font-extrabold tracking-widest text-amber-300 shadow-lg">
                {hud.killStreakBanner}
              </div>
            )}
            {hud.roundBanner && (
              <div className="mb-14 rounded-xl border border-orange-500/50 bg-[#0b0f17]/90 px-5 py-2 font-display text-2xl font-bold tracking-wider text-white">
                {hud.roundBanner}
              </div>
            )}

            {/* Dynamic Configurable Crosshair */}
            <div className="relative flex items-center justify-center" style={{opacity: crosshairOpacity}}>
              {(gpu.crosshair.style === 'dot' || crosshairDot) && (
                <div
                  className="rounded-full"
                  style={{
                    width: Math.max(3, crosshairThick + 1),
                    height: Math.max(3, crosshairThick + 1),
                    backgroundColor: gpu.crosshair.color,
                    boxShadow: crosshairOutline,
                  }}
                />
              )}
              {(gpu.crosshair.style === 'cross' || gpu.crosshair.style === 'tcross') && (
                <>
                  {gpu.crosshair.style === 'cross' && (
                    <div
                      className="absolute"
                      style={{
                        backgroundColor: gpu.crosshair.color,
                        width: crosshairThick,
                        height: crosshairArm,
                        boxShadow: crosshairOutline,
                        transform: `translateY(-${crosshairGap + crosshairArm / 2}px)`,
                      }}
                    />
                  )}
                  <div
                    className="absolute"
                    style={{
                      backgroundColor: gpu.crosshair.color,
                      width: crosshairThick,
                      height: crosshairArm,
                      boxShadow: crosshairOutline,
                      transform: `translateY(${crosshairGap + crosshairArm / 2}px)`,
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      backgroundColor: gpu.crosshair.color,
                      width: crosshairArm,
                      height: crosshairThick,
                      boxShadow: crosshairOutline,
                      transform: `translateX(-${crosshairGap + crosshairArm / 2}px)`,
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      backgroundColor: gpu.crosshair.color,
                      width: crosshairArm,
                      height: crosshairThick,
                      boxShadow: crosshairOutline,
                      transform: `translateX(${crosshairGap + crosshairArm / 2}px)`,
                    }}
                  />
                </>
              )}
              {gpu.crosshair.style === 'circle' && (
                <div
                  className="absolute rounded-full"
                  style={{
                    borderStyle: 'solid',
                    borderWidth: crosshairThick,
                    borderColor: gpu.crosshair.color,
                    boxShadow: crosshairOutline,
                    width: crosshairGap * 2 + 6,
                    height: crosshairGap * 2 + 6,
                  }}
                />
              )}

              {hud.hitmarkerType !== 'none' && (
                <div
                  className={`absolute h-5 w-5 pointer-events-none ${
                    hud.hitmarkerType === 'kill'
                      ? 'text-rose-400'
                      : hud.hitmarkerType === 'head'
                      ? 'text-amber-300'
                      : 'text-white'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-full w-full stroke-current" strokeWidth="2.5">
                    <line x1="4" y1="4" x2="9" y2="9" />
                    <line x1="20" y1="4" x2="15" y2="9" />
                    <line x1="4" y1="20" x2="9" y2="15" />
                    <line x1="20" y1="20" x2="15" y2="15" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Shield + HP + Movement | Touch Controls | 4-Slot Hotbar + Ammo */}
          <div className="flex items-end justify-between gap-4">
            {/* Shield + HP + Dash/Slide */}
            <div className={`flex items-end gap-2.5 origin-bottom-left ${hudScaleClass}`}>
              <div className="min-w-[185px] rounded-xl border border-slate-700/70 bg-[#0b0f17]/88 px-4 py-2.5 space-y-1.5">
                {/* Shield Bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 font-semibold text-sky-300">
                      <Shield className="w-3 h-3" />
                      SHIELD
                    </span>
                    <span className="font-mono-num font-bold text-sky-200">{hud.shield}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-sky-400 transition-transform duration-100 origin-left"
                      style={{transform: `scaleX(${Math.max(0, hud.shield / hud.maxShield)})`}}
                    />
                  </div>
                </div>

                {/* HP Bar */}
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300">
                      <Heart className="w-3.5 h-3.5 text-emerald-400" />
                      HP
                    </span>
                    <span className="font-mono-num text-2xl font-bold text-white leading-none">
                      {hud.hp}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full transition-transform duration-100 origin-left ${
                        hud.hp > 35 ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}
                      style={{transform: `scaleX(${Math.max(0, hud.hp / hud.maxHp)})`}}
                    />
                  </div>
                </div>
              </div>

              {showKeybinds && (
                <div className="hidden sm:flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-[#0b0f17]/88 px-2.5 py-1.5 text-[11px]">
                    <Zap className={`w-3.5 h-3.5 ${hud.dashReady ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span className="font-semibold text-slate-300">
                      Dash (F) {hud.dashReady ? 'Ready' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-[#0b0f17]/88 px-2.5 py-1.5 text-[11px]">
                    <Flame
                      className={`w-3.5 h-3.5 ${
                        hud.utilityCooldownSec <= 0 ? 'text-orange-400' : 'text-slate-500'
                      }`}
                    />
                    <span className="font-semibold text-slate-300">
                      {hud.isSliding
                        ? 'SLIDING'
                        : hud.isCrouching
                        ? 'CROUCH'
                        : hud.utilityCooldownSec > 0
                        ? `Util ${hud.utilityCooldownSec}s`
                        : 'Util (G) Ready'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Touch Controls for Mobile PWA */}
            {isTouchDevice && overlay === 'none' && (
              <div className="pointer-events-auto flex items-center gap-2.5">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-600 bg-[#0d1320]/80 text-[10px] font-bold text-slate-300"
                  onTouchMove={(e) => {
                    const t = e.touches[0];
                    const rect = e.currentTarget.getBoundingClientRect();
                    const nx = Math.max(-1, Math.min(1, (t.clientX - (rect.left + rect.width / 2)) / 36));
                    const ny = Math.max(-1, Math.min(1, ((rect.top + rect.height / 2) - t.clientY) / 36));
                    engineRef.current?.setTouchMove(nx, ny);
                  }}
                  onTouchEnd={() => engineRef.current?.setTouchMove(0, 0)}
                >
                  MOVE
                </div>

                <div
                  className="flex h-20 w-24 items-center justify-center rounded-xl border border-slate-600 bg-[#0d1320]/80 text-[10px] font-bold text-slate-300"
                  onTouchStart={(e) => {
                    touchLookRef.current = {x: e.touches[0].clientX, y: e.touches[0].clientY};
                  }}
                  onTouchMove={(e) => {
                    const t = e.touches[0];
                    if (touchLookRef.current) {
                      engineRef.current?.addTouchLook(
                        t.clientX - touchLookRef.current.x,
                        t.clientY - touchLookRef.current.y,
                      );
                    }
                    touchLookRef.current = {x: t.clientX, y: t.clientY};
                  }}
                  onTouchEnd={() => {
                    touchLookRef.current = null;
                  }}
                >
                  AIM
                </div>

                <button
                  type="button"
                  onTouchStart={() => engineRef.current?.triggerTouchJump()}
                  className="h-14 px-3 rounded-xl border border-slate-600 bg-[#0d1320]/85 text-xs font-bold text-white"
                >
                  JUMP
                </button>
                <button
                  type="button"
                  onTouchStart={() => engineRef.current?.useUtility()}
                  className="h-14 px-3 rounded-xl border border-sky-500/60 bg-sky-950/60 text-xs font-bold text-sky-200"
                >
                  UTIL
                </button>
                <button
                  type="button"
                  onTouchStart={() => engineRef.current?.triggerEmote()}
                  className="h-14 px-3 rounded-xl border border-amber-500/60 bg-amber-950/60 text-xs font-bold text-amber-200"
                >
                  EMOTE
                </button>
                <button
                  type="button"
                  onTouchStart={() => engineRef.current?.setTouchFire(true)}
                  onTouchEnd={() => engineRef.current?.setTouchFire(false)}
                  className="h-16 px-5 rounded-xl border border-orange-500 bg-orange-500/30 text-sm font-bold text-white"
                >
                  FIRE
                </button>
              </div>
            )}

            {/* 4-Slot Hotbar & Ammo Cluster */}
            <div className={`pointer-events-auto flex items-end gap-2 origin-bottom-right ${hudScaleClass}`}>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    {slot: 'primary', label: showKeybinds ? '1 · Primary' : 'Primary'},
                    {slot: 'secondary', label: showKeybinds ? '2 · Sidearm' : 'Sidearm'},
                    {slot: 'melee', label: showKeybinds ? '3 · Melee' : 'Melee'},
                    {
                      slot: 'utility',
                      label:
                        hud.utilityCooldownSec > 0
                          ? `${showKeybinds ? '4 · ' : ''}${hud.utilityCooldownSec}s`
                          : showKeybinds
                          ? '4 · Utility'
                          : 'Utility',
                    },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.slot}
                    type="button"
                    onClick={() => engineRef.current?.switchSlot(s.slot)}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-bold cursor-pointer ${
                      hud.activeSlot === s.slot
                        ? 'border-orange-500 bg-orange-500/20 text-orange-200'
                        : 'border-slate-700 bg-[#0b0f17]/88 text-slate-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="min-w-[165px] rounded-xl border border-slate-700/70 bg-[#0b0f17]/88 px-4 py-2.5 text-right">
                <div className="font-display text-xs font-bold text-slate-300">
                  {hud.weaponName}
                </div>
                {hud.activeSlot === 'melee' ? (
                  <div className="mt-1 font-display text-xl font-bold text-sky-300">BLADE</div>
                ) : hud.activeSlot === 'utility' ? (
                  <div className="mt-1 font-display text-xl font-bold text-orange-300">
                    {hud.utilityCooldownSec > 0
                      ? `WAIT ${hud.utilityCooldownSec}s`
                      : showKeybinds
                      ? 'READY (G)'
                      : 'READY'}
                  </div>
                ) : hud.isReloading ? (
                  <div className="mt-1 font-display text-lg font-bold text-amber-400">
                    RELOADING...
                  </div>
                ) : (
                  <div className="mt-0.5 font-mono-num text-3xl font-bold text-white leading-none">
                    {hud.ammo}
                    <span className="text-sm font-normal text-slate-400"> / {hud.magSize}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {overlay === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0d1320] p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-bold text-white">Match Paused</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdminPanelOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/50 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin Panel
                </button>
                <button
                  type="button"
                  onClick={() => setPauseShowSettings((v) => !v)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                >
                  {pauseShowSettings ? 'Hide Settings' : 'GPU, Crosshair & Audio'}
                </button>
              </div>
            </div>

            {pauseShowSettings && (
              <div className="mt-4">
                <SettingsPanel
                  gpu={gpu}
                  audio={audio}
                  onChangeGpu={handleGpuChange}
                  onChangeAudio={handleAudioChange}
                />
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  engineRef.current?.setPaused(false);
                  setOverlay('none');
                }}
                className="flex-1 rounded-xl bg-orange-500 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-orange-400 cursor-pointer"
              >
                Resume Match
              </button>
              <button
                type="button"
                onClick={returnToLobby}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-900 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KILL CAM OVERLAY (OPPONENT POV REPLAY BEFORE MVP SUMMARY) */}
      {overlay === 'kill_cam' && killCamInfo && (
        <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-5 sm:p-8">
          {/* Letterbox Top */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/50 bg-[#0b0f17]/92 px-5 py-3 shadow-2xl">
            <div className="flex items-center gap-3">
              <Film className="w-5 h-5 text-rose-400" />
              <div>
                <div className="font-display text-sm font-bold tracking-widest text-rose-400 uppercase">
                  KILL CAM · OPPONENT POV
                </div>
                <div className="text-xs text-slate-200">
                  Eliminated by <strong className="text-white">{killCamInfo.attackerName}</strong>{' '}
                  with <span className="text-sky-300">{killCamInfo.weaponName}</span>
                  {killCamInfo.headshot ? ' (Headshot)' : ''}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => engineRef.current?.skipKillCam()}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-orange-400 cursor-pointer"
            >
              <span>Skip to Stats</span>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Letterbox Bottom Progress */}
          <div className="mx-auto w-full max-w-xl rounded-xl border border-slate-700/80 bg-[#0b0f17]/92 px-4 py-3 shadow-xl">
            <div className="flex items-center justify-between text-[11px] font-mono-num text-slate-300 mb-1.5">
              <span>REPLAYING FINAL ELIMINATION</span>
              <span>{Math.round(killCamProgress * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-rose-500 transition-transform duration-75 origin-left"
                style={{transform: `scaleX(${Math.max(0, Math.min(1, killCamProgress))})`}}
              />
            </div>
          </div>
        </div>
      )}

      {/* END-OF-MATCH MVP SUMMARY SCREEN */}
      {overlay === 'match_over' && matchSummary && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#0d1320] p-6 shadow-2xl">
            {/* MVP Header Banner + Keys/XP/Ranked RR Earned */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-1 text-xs font-bold tracking-wider text-amber-300">
                <Award className="w-4 h-4 text-amber-400" />
                <span>{matchSummary.mvpTitle}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono-num text-xs font-bold">
                <div className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 text-emerald-300">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+${matchSummary.creditsEarned}</span>
                </div>
                {(matchSummary.keysEarned ?? 0) > 0 && (
                  <div className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-950/60 px-2.5 py-1 text-cyan-300">
                    <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                    <span>+{matchSummary.keysEarned} Keys</span>
                  </div>
                )}
                {(matchSummary.xpEarned ?? 0) > 0 && (
                  <div className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-950/60 px-2.5 py-1 text-sky-300">
                    <span>+{matchSummary.xpEarned} XP</span>
                  </div>
                )}
                {matchSummary.isRanked && typeof matchSummary.rrDelta === 'number' && (
                  <div
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 ${
                      matchSummary.rrDelta >= 0
                        ? 'border-amber-400/50 bg-amber-950/60 text-amber-300'
                        : 'border-rose-500/50 bg-rose-950/60 text-rose-300'
                    }`}
                  >
                    <span>
                      {matchSummary.rrDelta >= 0 ? `+${matchSummary.rrDelta}` : matchSummary.rrDelta}{' '}
                      RR
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl font-bold text-white">
                  {matchSummary.mode === 'shooting_arena'
                    ? 'ARENA COMPLETE'
                    : matchSummary.winnerTeam
                    ? `TEAM ${matchSummary.winnerTeam.toUpperCase()} WINS`
                    : matchSummary.victory
                    ? 'VICTORY'
                    : 'DEFEAT'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Operator <strong className="text-slate-200">{callsign}</strong> ·{' '}
                  {OPERATOR_SKINS[career.equippedSkin]?.name} · {WRAPS[loadout.wrap]?.name}
                </p>
              </div>
              <div className="text-right font-mono-num">
                <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                  {matchSummary.mode === 'shooting_arena'
                    ? 'Range Score'
                    : matchSummary.teamScores
                    ? 'Team Score'
                    : 'Scoreboard'}
                </span>
                <span className="text-xl font-bold text-white">
                  {matchSummary.mode === 'shooting_arena'
                    ? matchSummary.arenaScore
                    : matchSummary.teamScores &&
                      (GAME_MODES[matchSummary.matchFormat ?? 'duel']?.teamCount ?? 0) >= 2
                    ? `${matchSummary.teamScores.alpha} - ${matchSummary.teamScores.bravo}${
                        typeof matchSummary.teamScores.charlie === 'number' &&
                        GAME_MODES[matchSummary.matchFormat ?? 'duel']?.teamCount === 3
                          ? ` - ${matchSummary.teamScores.charlie}`
                          : ''
                      }`
                    : `${matchSummary.playerScore} - ${matchSummary.rivalScore}`}
                </span>
              </div>
            </div>

            {/* Primary MVP Performance KPIs: K/D Ratio, Accuracy %, Total Session Score */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono-num">
              <div className="rounded-xl border border-slate-800 bg-slate-900/95 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  K/D Ratio
                </div>
                <div className="mt-1 text-3xl font-bold text-sky-400">
                  {matchSummary.kdRatio.toFixed(2)}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {matchSummary.kills} Kills · {matchSummary.deaths} Deaths
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/95 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Accuracy
                </div>
                <div className="mt-1 text-3xl font-bold text-emerald-400">
                  {matchSummary.accuracyPct}%
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {matchSummary.shotsHit} / {matchSummary.shotsFired} Hits
                </div>
              </div>

              <div className="rounded-xl border border-orange-500/40 bg-orange-950/20 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-orange-300">
                  Session Total Score
                </div>
                <div className="mt-1 text-3xl font-bold text-white">
                  {matchSummary.sessionTotalScore.toLocaleString()}
                </div>
                <div className="mt-1 text-[11px] text-orange-200/80">
                  Match +{matchSummary.matchTotalScore.toLocaleString()} pts
                </div>
              </div>
            </div>

            {/* Secondary Match Breakdown */}
            <div className="mt-3 grid grid-cols-3 gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 text-center font-mono-num">
              <div>
                <span className="block text-[10px] uppercase text-slate-400">Match Score</span>
                <span className="text-base font-bold text-white">
                  {matchSummary.matchTotalScore.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-400">Headshots</span>
                <span className="text-base font-bold text-amber-300">{matchSummary.headshots}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-400">Damage Dealt</span>
                <span className="text-base font-bold text-rose-300">
                  {matchSummary.damageDealt}
                </span>
              </div>
            </div>

            {/* Final Match Leaderboard */}
            {matchSummary.leaderboard && matchSummary.leaderboard.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/75 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Match Leaderboard
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-2">#</th>
                      <th className="py-1 pr-2">Player</th>
                      {(GAME_MODES[matchSummary.matchFormat ?? 'duel']?.teamCount ?? 0) >= 2 && (
                        <th className="py-1 pr-2">Team</th>
                      )}
                      <th className="py-1 text-right">K</th>
                      <th className="py-1 text-right">D</th>
                      <th className="py-1 text-right">K/D</th>
                      <th className="py-1 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 font-mono-num">
                    {matchSummary.leaderboard.map((row, idx) => {
                      const rkd =
                        row.deaths > 0 ? (row.kills / row.deaths).toFixed(2) : row.kills.toFixed(2);
                      return (
                        <tr
                          key={row.id}
                          className={row.isSelf ? 'text-white bg-sky-950/30' : 'text-slate-300'}
                        >
                          <td className="py-1 pr-2 font-bold text-amber-400">#{idx + 1}</td>
                          <td className="py-1 pr-2 font-sans font-semibold">
                            {row.name}{' '}
                            {row.isSelf ? <span className="text-[10px] text-emerald-400">(YOU)</span> : ''}
                          </td>
                          {(GAME_MODES[matchSummary.matchFormat ?? 'duel']?.teamCount ?? 0) >= 2 && (
                            <td className="py-1 pr-2 font-sans text-[10px] font-bold uppercase">
                              <span
                                className={
                                  row.team === 'alpha'
                                    ? 'text-sky-400'
                                    : row.team === 'charlie'
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }
                              >
                                {row.team ?? 'alpha'}
                              </span>
                            </td>
                          )}
                          <td className="py-1 text-right text-emerald-400">{row.kills}</td>
                          <td className="py-1 text-right">{row.deaths}</td>
                          <td className="py-1 text-right text-sky-300">{rkd}</td>
                          <td className="py-1 text-right font-bold">{row.score.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (matchSummary.mode === 'multiplayer') {
                    wsRef.current?.send(JSON.stringify({type: 'match:rematch'}));
                  } else if (matchSummary.mode === 'shooting_arena') {
                    handleStartArena();
                  } else {
                    handleStartRivals1P();
                  }
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Rematch
              </button>
              <button
                type="button"
                onClick={() => {
                  setLobbyTab('shop');
                  returnToLobby();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-950/40 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/50 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                Shop &amp; Packs
              </button>
              {matchSummary.hasKillCam && (
                <button
                  type="button"
                  onClick={() => engineRef.current?.startKillCamReplay(matchSummary)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-900/50 cursor-pointer"
                >
                  <Film className="w-4 h-4" />
                  Kill Cam
                </button>
              )}
              <button
                type="button"
                onClick={returnToLobby}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800 cursor-pointer"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OWNER & ADMIN PANEL MODAL */}
      <AdminPanel
        open={adminPanelOpen}
        onClose={() => setAdminPanelOpen(false)}
        adminRole={adminSession.role}
        adminLabel={adminSession.label}
        registry={adminRegistry}
        tools={adminTools}
        callsign={callsign}
        playMode={playMode}
        room={room}
        selfId={selfId}
        authError={adminAuthError}
        onClaimOwner={handleClaimOwner}
        onAuthenticate={handleAuthenticateAdmin}
        onLockAdmin={handleLockAdmin}
        onChangeTools={setAdminTools}
        onForceWin={() => engineRef.current?.forceWinCurrentMatch()}
        onAppointAdmin={handleAppointAdmin}
        onRevokeAdmin={handleRevokeAdmin}
        onBanPlayer={handleBanPlayer}
        onUnbanPlayer={handleUnbanPlayer}
      />
    </div>
  );
}
