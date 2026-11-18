import express from 'express';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {WebSocketServer, WebSocket} from 'ws';
import {GAME_MODES, MAPS} from './src/fps/catalog';
import type {MapId, MatchFormat, PrivateServerSettings, TeamId} from './src/fps/types';

interface RoomPlayer {
  id: string;
  name: string;
  primaryGun: string;
  secondaryGun: string;
  meleeGun: string;
  utilityItem: string;
  wrapId: string;
  skinId: string;
  role: 'none' | 'admin' | 'owner';
  team: TeamId;
  spectator: boolean;
  ready: boolean;
  score: number;
  kills: number;
  deaths: number;
  damage: number;
  hp: number;
  alive: boolean;
  spawnIdx: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

interface RoomState {
  code: string;
  hostId: string;
  mapId: MapId;
  matchFormat: MatchFormat;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'finished';
  targetScore: number;
  teamScores: {alpha: number; bravo: number; charlie: number};
  winnerId: string | null;
  winnerTeam: TeamId | null;
  privateConfig: PrivateServerSettings;
  players: Map<string, RoomPlayer>;
}

interface LeaderboardRecord {
  callsign: string;
  role: 'none' | 'admin' | 'owner';
  wins: number;
  kills: number;
  deaths: number;
  matches: number;
  totalScore: number;
  arenaBest: number;
  rankedRR: number;
  updatedAt: number;
}

interface CommunityFeedbackEntry {
  id: string;
  author: string;
  topic: string;
  message: string;
  ts: number;
}

const PORT = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rooms = new Map<string, RoomState>();
const serverLeaderboard = new Map<string, LeaderboardRecord>();
const feedbackLog: CommunityFeedbackEntry[] = [
  {
    id: 'fb_init_1',
    author: 'ApexPro_Zero',
    topic: 'SkyGrid Experimental',
    message: 'Quad jump pads feel crisp — keep the mid spire height!',
    ts: Date.now() - 3600_000,
  },
];
const clientMeta = new Map<
  WebSocket,
  {playerId: string; roomCode: string | null; role: 'none' | 'admin' | 'owner'; callsign: string}
>();

let serverOwnerClaimed = false;
let serverOwnerName = '';
let serverOwnerPassHash = '';
const serverAppointedAdmins = new Map<string, {name: string; passcode: string; appointedAt: number}>();
const serverBannedList = new Map<
  string,
  {name: string; reason: string; bannedBy: string; bannedAt: number}
>();

function hashSecret(val: string): string {
  const input = `apex_rivals_rbac::${val.trim()}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function serializeAdminState() {
  return {
    ownerClaimed: serverOwnerClaimed,
    ownerName: serverOwnerName,
    appointedAdmins: Array.from(serverAppointedAdmins.values()),
    bannedList: Array.from(serverBannedList.values()),
  };
}

function broadcastAdminStateToAuthorized(): void {
  const state = serializeAdminState();
  for (const [sock, meta] of clientMeta.entries()) {
    if ((meta.role === 'owner' || meta.role === 'admin') && sock.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({type: 'admin:state', state}));
    }
  }
}

function isTeamFormat(fmt: MatchFormat): boolean {
  const spec = GAME_MODES[fmt];
  return spec ? spec.teamCount >= 2 : false;
}

function getFormatTargetScore(fmt: MatchFormat): number {
  return GAME_MODES[fmt]?.targetScore ?? 5;
}

function getFormatMaxPlayers(fmt: MatchFormat): number {
  return GAME_MODES[fmt]?.maxPlayers ?? 4;
}

function pickBalancedTeam(room: RoomState): TeamId {
  const teamCount = GAME_MODES[room.matchFormat]?.teamCount ?? 2;
  let alphaCount = 0;
  let bravoCount = 0;
  let charlieCount = 0;
  for (const p of room.players.values()) {
    if (p.spectator) continue;
    if (p.team === 'alpha') alphaCount++;
    else if (p.team === 'charlie') charlieCount++;
    else bravoCount++;
  }
  if (teamCount === 3 && charlieCount < alphaCount && charlieCount <= bravoCount) {
    return 'charlie';
  }
  return alphaCount <= bravoCount ? 'alpha' : 'bravo';
}

function rebalanceTeams(room: RoomState): void {
  const teamCount = GAME_MODES[room.matchFormat]?.teamCount ?? 2;
  const active = Array.from(room.players.values()).filter((p) => !p.spectator);
  active.forEach((p, idx) => {
    if (teamCount === 3) {
      p.team = idx % 3 === 0 ? 'alpha' : idx % 3 === 1 ? 'bravo' : 'charlie';
    } else {
      p.team = idx % 2 === 0 ? 'alpha' : 'bravo';
    }
  });
}

function getSortedLeaderboard(): LeaderboardRecord[] {
  return Array.from(serverLeaderboard.values())
    .sort((a, b) => b.totalScore - a.totalScore || b.rankedRR - a.rankedRR || b.wins - a.wins)
    .slice(0, 30);
}

function upsertLeaderboard(opts: {
  callsign: string;
  role: 'none' | 'admin' | 'owner';
  winsDelta?: number;
  killsDelta?: number;
  deathsDelta?: number;
  matchesDelta?: number;
  scoreDelta?: number;
  arenaBest?: number;
  rankedRR?: number;
}): void {
  const clean = opts.callsign.trim().slice(0, 16);
  if (!clean) return;
  const key = clean.toLowerCase();
  const existing = serverLeaderboard.get(key) ?? {
    callsign: clean,
    role: opts.role,
    wins: 0,
    kills: 0,
    deaths: 0,
    matches: 0,
    totalScore: 0,
    arenaBest: 0,
    rankedRR: 0,
    updatedAt: Date.now(),
  };
  existing.callsign = clean;
  existing.role = opts.role;
  existing.wins += opts.winsDelta ?? 0;
  existing.kills += opts.killsDelta ?? 0;
  existing.deaths += opts.deathsDelta ?? 0;
  existing.matches += opts.matchesDelta ?? 0;
  existing.totalScore += opts.scoreDelta ?? 0;
  existing.arenaBest = Math.max(existing.arenaBest, opts.arenaBest ?? 0);
  if (typeof opts.rankedRR === 'number') {
    existing.rankedRR = Math.max(existing.rankedRR, opts.rankedRR);
  }
  existing.updatedAt = Date.now();
  serverLeaderboard.set(key, existing);
}

function broadcastLeaderboardToAll(): void {
  const entries = getSortedLeaderboard();
  const raw = JSON.stringify({type: 'leaderboard:list', entries});
  for (const [sock] of clientMeta.entries()) {
    if (sock.readyState === WebSocket.OPEN) {
      sock.send(raw);
    }
  }
}

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? makeRoomCode() : code;
}

function serializeRoom(room: RoomState) {
  return {
    code: room.code,
    hostId: room.hostId,
    mapId: room.mapId,
    matchFormat: room.matchFormat,
    maxPlayers: room.maxPlayers,
    status: room.status,
    targetScore: room.targetScore,
    teamScores: room.teamScores,
    winnerId: room.winnerId,
    winnerTeam: room.winnerTeam,
    privateConfig: room.privateConfig,
    players: Array.from(room.players.values()),
  };
}

function broadcastToRoom(room: RoomState, payload: unknown, excludeId?: string): void {
  const raw = JSON.stringify(payload);
  for (const [ws, meta] of clientMeta.entries()) {
    if (meta.roomCode === room.code && meta.playerId !== excludeId && ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function leaveCurrentRoom(ws: WebSocket): void {
  const meta = clientMeta.get(ws);
  if (!meta || !meta.roomCode) return;
  const room = rooms.get(meta.roomCode);
  meta.roomCode = null;
  if (!room) return;

  room.players.delete(meta.playerId);
  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === meta.playerId) {
    const nextHost = room.players.values().next().value;
    if (nextHost) room.hostId = nextHost.id;
  }

  if (room.status === 'playing' && room.players.size < 2) {
    room.status = 'lobby';
  }

  broadcastToRoom(room, {type: 'room:state', room: serializeRoom(room)});
}

function startOrResetMatch(room: RoomState): void {
  room.status = 'playing';
  room.winnerId = null;
  room.winnerTeam = null;
  room.teamScores = {alpha: 0, bravo: 0, charlie: 0};
  room.targetScore = getFormatTargetScore(room.matchFormat);
  const teamMode = isTeamFormat(room.matchFormat);
  let alphaIdx = 0;
  let bravoIdx = 0;
  let charlieIdx = 0;
  let ffaIdx = 0;
  for (const p of room.players.values()) {
    p.score = 0;
    p.kills = 0;
    p.deaths = 0;
    p.damage = 0;
    p.hp = 100;
    p.alive = !p.spectator;
    if (teamMode) {
      if (p.team === 'alpha') {
        p.spawnIdx = (alphaIdx++ % 4) * 2;
      } else if (p.team === 'charlie') {
        p.spawnIdx = charlieIdx++ % 3;
      } else {
        p.spawnIdx = (bravoIdx++ % 4) * 2 + 1;
      }
    } else {
      p.spawnIdx = ffaIdx++;
    }
  }
  broadcastToRoom(room, {type: 'room:state', room: serializeRoom(room)});
  broadcastToRoom(room, {type: 'match:started', room: serializeRoom(room)});
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ok: true, rooms: rooms.size});
  });

  app.get('/api/leaderboard', (_req, res) => {
    res.json({entries: getSortedLeaderboard()});
  });

  app.get('/api/feedback', (_req, res) => {
    res.json({items: feedbackLog.slice(0, 25)});
  });

  app.post('/api/feedback', (req, res) => {
    const author = typeof req.body?.author === 'string' ? req.body.author.trim().slice(0, 16) : 'Operator';
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim().slice(0, 40) : 'Weapon Balance';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 220) : '';
    if (!message) {
      res.status(400).json({ok: false, error: 'Feedback message cannot be empty.'});
      return;
    }
    const entry: CommunityFeedbackEntry = {
      id: `fb_${Date.now()}`,
      author: author || 'Operator',
      topic,
      message,
      ts: Date.now(),
    };
    feedbackLog.unshift(entry);
    if (feedbackLog.length > 40) feedbackLog.pop();
    res.json({ok: true, entry, items: feedbackLog.slice(0, 25)});
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({server, path: '/ws'});

  wss.on('connection', (ws) => {
    const playerId = `p_${Math.random().toString(36).slice(2, 9)}`;
    clientMeta.set(ws, {playerId, roomCode: null, role: 'none', callsign: 'Striker'});
    send(ws, {type: 'welcome', playerId, ownerClaimed: serverOwnerClaimed});

    ws.on('message', (data) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(data)) as Record<string, unknown>;
      } catch {
        return;
      }

      const meta = clientMeta.get(ws);
      if (!meta) return;

      const type = msg.type;

      if (type === 'ping') {
        send(ws, {type: 'pong', clientTs: msg.clientTs});
        return;
      }

      if (type === 'admin:claim_owner') {
        const pass = typeof msg.passkey === 'string' ? msg.passkey.trim() : '';
        const name = typeof msg.name === 'string' && msg.name.trim() ? msg.name.trim().slice(0, 16) : 'Owner';
        if (pass.length < 4) {
          send(ws, {type: 'admin:auth_result', ok: false, role: 'none', reason: 'Passkey must be 4+ chars.'});
          return;
        }
        if (serverOwnerClaimed && serverOwnerPassHash !== hashSecret(pass)) {
          send(ws, {type: 'admin:auth_result', ok: false, role: 'none', reason: 'Owner already claimed.'});
          return;
        }
        serverOwnerClaimed = true;
        serverOwnerName = name;
        serverOwnerPassHash = hashSecret(pass);
        meta.role = 'owner';
        meta.callsign = name;
        if (meta.roomCode) {
          const r = rooms.get(meta.roomCode);
          const rp = r?.players.get(meta.playerId);
          if (r && rp) {
            rp.role = 'owner';
            broadcastToRoom(r, {type: 'room:state', room: serializeRoom(r)});
          }
        }
        send(ws, {type: 'admin:auth_result', ok: true, role: 'owner', label: name, state: serializeAdminState()});
        return;
      }

      if (type === 'admin:auth') {
        const pass = typeof msg.passkey === 'string' ? msg.passkey.trim() : '';
        const name = typeof msg.name === 'string' && msg.name.trim() ? msg.name.trim().slice(0, 16) : meta.callsign;
        if (serverOwnerClaimed && hashSecret(pass) === serverOwnerPassHash) {
          meta.role = 'owner';
          if (meta.roomCode) {
            const r = rooms.get(meta.roomCode);
            const rp = r?.players.get(meta.playerId);
            if (r && rp) {
              rp.role = 'owner';
              broadcastToRoom(r, {type: 'room:state', room: serializeRoom(r)});
            }
          }
          send(ws, {type: 'admin:auth_result', ok: true, role: 'owner', label: serverOwnerName || name, state: serializeAdminState()});
          return;
        }
        const entry = serverAppointedAdmins.get(name.toLowerCase());
        const matchedAny =
          entry && entry.passcode === pass
            ? entry
            : Array.from(serverAppointedAdmins.values()).find((a) => a.passcode === pass && !a.name);
        if (matchedAny) {
          meta.role = 'admin';
          if (meta.roomCode) {
            const r = rooms.get(meta.roomCode);
            const rp = r?.players.get(meta.playerId);
            if (r && rp) {
              rp.role = 'admin';
              broadcastToRoom(r, {type: 'room:state', room: serializeRoom(r)});
            }
          }
          send(ws, {type: 'admin:auth_result', ok: true, role: 'admin', label: matchedAny.name || name, state: serializeAdminState()});
          return;
        }
        send(ws, {type: 'admin:auth_result', ok: false, role: 'none', reason: 'Invalid Owner or Admin passkey.'});
        return;
      }

      if (type === 'admin:lock') {
        meta.role = 'none';
        if (meta.roomCode) {
          const r = rooms.get(meta.roomCode);
          const rp = r?.players.get(meta.playerId);
          if (r && rp) {
            rp.role = 'none';
            broadcastToRoom(r, {type: 'room:state', room: serializeRoom(r)});
          }
        }
        send(ws, {type: 'admin:auth_result', ok: true, role: 'none', label: ''});
        return;
      }

      if (type === 'admin:appoint') {
        if (meta.role !== 'owner') return;
        const targetName = typeof msg.name === 'string' ? msg.name.trim().slice(0, 16) : '';
        const passcode = typeof msg.passcode === 'string' ? msg.passcode.trim() : '';
        if (!targetName || passcode.length < 4) return;
        serverAppointedAdmins.set(targetName.toLowerCase(), {
          name: targetName,
          passcode,
          appointedAt: Date.now(),
        });
        for (const [sock, cMeta] of clientMeta.entries()) {
          if (cMeta.callsign.toLowerCase() === targetName.toLowerCase() && cMeta.role !== 'owner') {
            cMeta.role = 'admin';
            send(sock, {type: 'admin:appointed', role: 'admin', label: targetName, state: serializeAdminState()});
            if (cMeta.roomCode) {
              const r = rooms.get(cMeta.roomCode);
              const rp = r?.players.get(cMeta.playerId);
              if (r && rp) {
                rp.role = 'admin';
                broadcastToRoom(r, {type: 'room:state', room: serializeRoom(r)});
              }
            }
          }
        }
        broadcastAdminStateToAuthorized();
        return;
      }

      if (type === 'admin:revoke') {
        if (meta.role !== 'owner') return;
        const targetName = typeof msg.name === 'string' ? msg.name.trim() : '';
        serverAppointedAdmins.delete(targetName.toLowerCase());
        for (const [sock, cMeta] of clientMeta.entries()) {
          if (cMeta.callsign.toLowerCase() === targetName.toLowerCase() && cMeta.role === 'admin') {
            cMeta.role = 'none';
            send(sock, {type: 'admin:revoked'});
            if (cMeta.roomCode) {
              const r = rooms.get(cMeta.roomCode);
              const rp = r?.players.get(cMeta.playerId);
              if (r && rp) {
                rp.role = 'none';
                broadcastToRoom(r, {type: 'room:state', room: serializeRoom(r)});
              }
            }
          }
        }
        broadcastAdminStateToAuthorized();
        return;
      }

      if (type === 'admin:ban') {
        if (meta.role !== 'owner' && meta.role !== 'admin') return;
        const targetId = typeof msg.targetId === 'string' ? msg.targetId : '';
        let targetName = typeof msg.targetName === 'string' ? msg.targetName.trim() : '';
        const reason =
          typeof msg.reason === 'string' && msg.reason.trim()
            ? msg.reason.trim().slice(0, 80)
            : 'Banned by Admin';

        if (targetId) {
          for (const [, cMeta] of clientMeta.entries()) {
            if (cMeta.playerId === targetId) {
              targetName = cMeta.callsign;
              break;
            }
          }
        }
        if (!targetName) return;
        if (targetName.toLowerCase() === serverOwnerName.toLowerCase()) {
          send(ws, {type: 'room:error', message: 'Cannot ban the Owner.'});
          return;
        }

        serverBannedList.set(targetName.toLowerCase(), {
          name: targetName,
          reason,
          bannedBy: meta.callsign || meta.role.toUpperCase(),
          bannedAt: Date.now(),
        });

        for (const [sock, cMeta] of clientMeta.entries()) {
          if (
            (targetId && cMeta.playerId === targetId) ||
            cMeta.callsign.toLowerCase() === targetName.toLowerCase()
          ) {
            if (cMeta.role !== 'owner') {
              leaveCurrentRoom(sock);
              send(sock, {type: 'player:banned', reason});
            }
          }
        }
        broadcastAdminStateToAuthorized();
        return;
      }

      if (type === 'admin:unban') {
        if (meta.role !== 'owner' && meta.role !== 'admin') return;
        const targetName = typeof msg.name === 'string' ? msg.name.trim() : '';
        serverBannedList.delete(targetName.toLowerCase());
        broadcastAdminStateToAuthorized();
        return;
      }

      if (type === 'leaderboard:list') {
        send(ws, {type: 'leaderboard:list', entries: getSortedLeaderboard()});
        return;
      }

      if (type === 'leaderboard:submit') {
        const cleanName =
          typeof msg.callsign === 'string' && msg.callsign.trim()
            ? msg.callsign.trim().slice(0, 16)
            : meta.callsign;
        upsertLeaderboard({
          callsign: cleanName,
          role: meta.role,
          winsDelta: Math.max(0, Math.min(1, Number(msg.winsDelta) || 0)),
          killsDelta: Math.max(0, Math.min(100, Number(msg.killsDelta) || 0)),
          deathsDelta: Math.max(0, Math.min(100, Number(msg.deathsDelta) || 0)),
          matchesDelta: Math.max(0, Math.min(1, Number(msg.matchesDelta) || 0)),
          scoreDelta: Math.max(0, Math.min(50000, Number(msg.scoreDelta) || 0)),
          arenaBest: Math.max(0, Number(msg.arenaBest) || 0),
          rankedRR: typeof msg.rankedRR === 'number' ? msg.rankedRR : undefined,
        });
        broadcastLeaderboardToAll();
        return;
      }

      if (type === 'room:list') {
        const list = Array.from(rooms.values())
          .filter((r) => r.status === 'lobby' && !r.privateConfig.isPrivate && r.players.size < r.maxPlayers)
          .map((r) => ({
            code: r.code,
            count: r.players.size,
            maxPlayers: r.maxPlayers,
            hostName: r.players.get(r.hostId)?.name || 'Host',
            mapId: r.mapId,
            matchFormat: r.matchFormat,
            isPrivate: r.privateConfig.isPrivate,
          }));
        send(ws, {type: 'room:list', rooms: list});
        return;
      }

      if (type === 'room:create') {
        const cleanName =
          typeof msg.name === 'string' && msg.name.trim() ? msg.name.trim().slice(0, 16) : 'Striker';
        meta.callsign = cleanName;
        const banRec = serverBannedList.get(cleanName.toLowerCase());
        if (banRec && meta.role !== 'owner') {
          send(ws, {type: 'player:banned', reason: banRec.reason});
          return;
        }
        leaveCurrentRoom(ws);
        const code = makeRoomCode();
        const rawMap = msg.mapId as MapId;
        const validMap: MapId = rawMap && MAPS[rawMap] ? rawMap : 'vanguard';
        const rawFmt = msg.matchFormat as MatchFormat;
        const validFormat: MatchFormat = rawFmt && GAME_MODES[rawFmt] ? rawFmt : 'duel';
        const maxPlayers = getFormatMaxPlayers(validFormat);

        const incomingPriv = (msg.privateConfig ?? {}) as Partial<PrivateServerSettings>;
        const privateConfig: PrivateServerSettings = {
          isPrivate: Boolean(incomingPriv.isPrivate),
          serverName:
            typeof incomingPriv.serverName === 'string' && incomingPriv.serverName.trim()
              ? incomingPriv.serverName.trim().slice(0, 28)
              : `${cleanName}'s Server`,
          allowSpectators: incomingPriv.allowSpectators ?? true,
          lowGravity: Boolean(incomingPriv.lowGravity),
          instantReload: Boolean(incomingPriv.instantReload),
          headshotsOnly: Boolean(incomingPriv.headshotsOnly),
          friendlyFire: Boolean(incomingPriv.friendlyFire),
          seasonalTheme:
            incomingPriv.seasonalTheme === 'halloween' || incomingPriv.seasonalTheme === 'winter'
              ? incomingPriv.seasonalTheme
              : 'normal',
        };

        const player: RoomPlayer = {
          id: meta.playerId,
          name: cleanName,
          primaryGun: typeof msg.primaryGun === 'string' ? msg.primaryGun : 'vx47',
          secondaryGun: typeof msg.secondaryGun === 'string' ? msg.secondaryGun : 'mk2',
          meleeGun: typeof msg.meleeGun === 'string' ? msg.meleeGun : 'katana',
          utilityItem: typeof msg.utilityItem === 'string' ? msg.utilityItem : 'frag',
          wrapId: typeof msg.wrapId === 'string' ? msg.wrapId : 'carbon',
          skinId: typeof msg.skinId === 'string' ? msg.skinId : 'default_slate',
          role: meta.role,
          team: 'alpha',
          spectator: false,
          ready: true,
          score: 0,
          kills: 0,
          deaths: 0,
          damage: 0,
          hp: 100,
          alive: true,
          spawnIdx: 0,
          x: 0,
          y: 0,
          z: 22,
          yaw: 0,
          pitch: 0,
        };
        const room: RoomState = {
          code,
          hostId: meta.playerId,
          mapId: validMap,
          matchFormat: validFormat,
          maxPlayers,
          status: 'lobby',
          targetScore: getFormatTargetScore(validFormat),
          teamScores: {alpha: 0, bravo: 0, charlie: 0},
          winnerId: null,
          winnerTeam: null,
          privateConfig,
          players: new Map([[meta.playerId, player]]),
        };
        rooms.set(code, room);
        meta.roomCode = code;
        send(ws, {type: 'room:state', room: serializeRoom(room)});
        return;
      }

      if (type === 'room:join') {
        const cleanName =
          typeof msg.name === 'string' && msg.name.trim() ? msg.name.trim().slice(0, 16) : 'Rival';
        meta.callsign = cleanName;
        const banRec = serverBannedList.get(cleanName.toLowerCase());
        if (banRec && meta.role !== 'owner') {
          send(ws, {type: 'player:banned', reason: banRec.reason});
          return;
        }
        const rawCode = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : '';
        const room = rooms.get(rawCode);
        if (!room) {
          send(ws, {type: 'room:error', message: `Room "${rawCode}" not found.`});
          return;
        }
        const wantsSpectate = Boolean(msg.spectator) && room.privateConfig.allowSpectators;
        if (!wantsSpectate && room.players.size >= room.maxPlayers) {
          send(ws, {
            type: 'room:error',
            message: `Room is full (max ${room.maxPlayers} players).`,
          });
          return;
        }
        if (room.status !== 'lobby' && !wantsSpectate) {
          send(ws, {type: 'room:error', message: 'Match already in progress.'});
          return;
        }

        leaveCurrentRoom(ws);
        const spawnIdx = room.players.size;
        const assignedTeam = pickBalancedTeam(room);
        const player: RoomPlayer = {
          id: meta.playerId,
          name: cleanName,
          primaryGun: typeof msg.primaryGun === 'string' ? msg.primaryGun : 'vx47',
          secondaryGun: typeof msg.secondaryGun === 'string' ? msg.secondaryGun : 'mk2',
          meleeGun: typeof msg.meleeGun === 'string' ? msg.meleeGun : 'katana',
          utilityItem: typeof msg.utilityItem === 'string' ? msg.utilityItem : 'frag',
          wrapId: typeof msg.wrapId === 'string' ? msg.wrapId : 'arctic',
          skinId: typeof msg.skinId === 'string' ? msg.skinId : 'default_slate',
          role: meta.role,
          team: assignedTeam,
          spectator: wantsSpectate,
          ready: false,
          score: 0,
          kills: 0,
          deaths: 0,
          damage: 0,
          hp: 100,
          alive: !wantsSpectate,
          spawnIdx,
          x: 0,
          y: 0,
          z: assignedTeam === 'alpha' ? 22 : -22,
          yaw: assignedTeam === 'alpha' ? 0 : Math.PI,
          pitch: 0,
        };
        room.players.set(meta.playerId, player);
        meta.roomCode = room.code;
        broadcastToRoom(room, {type: 'room:state', room: serializeRoom(room)});
        if (room.status === 'playing' && wantsSpectate) {
          send(ws, {type: 'match:started', room: serializeRoom(room)});
        }
        return;
      }

      if (type === 'room:leave') {
        leaveCurrentRoom(ws);
        send(ws, {type: 'room:left'});
        return;
      }

      if (!meta.roomCode) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;
      const player = room.players.get(meta.playerId);
      if (!player) return;

      if (type === 'room:config') {
        if (room.hostId !== meta.playerId || room.status !== 'lobby') return;
        const rawMap = msg.mapId as MapId;
        if (rawMap && MAPS[rawMap]) {
          room.mapId = rawMap;
        }
        const rawFmt = msg.matchFormat as MatchFormat;
        if (rawFmt && GAME_MODES[rawFmt]) {
          room.matchFormat = rawFmt;
          room.maxPlayers = getFormatMaxPlayers(rawFmt);
          room.targetScore = getFormatTargetScore(rawFmt);
          rebalanceTeams(room);
        }
        if (msg.privateConfig && typeof msg.privateConfig === 'object') {
          const pc = msg.privateConfig as Partial<PrivateServerSettings>;
          room.privateConfig = {
            ...room.privateConfig,
            ...pc,
            isPrivate: pc.isPrivate ?? room.privateConfig.isPrivate,
            allowSpectators: pc.allowSpectators ?? room.privateConfig.allowSpectators,
            lowGravity: pc.lowGravity ?? room.privateConfig.lowGravity,
            instantReload: pc.instantReload ?? room.privateConfig.instantReload,
            headshotsOnly: pc.headshotsOnly ?? room.privateConfig.headshotsOnly,
            friendlyFire: pc.friendlyFire ?? room.privateConfig.friendlyFire,
            seasonalTheme:
              pc.seasonalTheme === 'halloween' || pc.seasonalTheme === 'winter' || pc.seasonalTheme === 'normal'
                ? pc.seasonalTheme
                : room.privateConfig.seasonalTheme,
          };
        }
        broadcastToRoom(room, {type: 'room:state', room: serializeRoom(room)});
        return;
      }

      // Host / Admin Room Kick & Ban Controls
      if (type === 'room:kick' || type === 'room:ban') {
        const authorized = room.hostId === meta.playerId || meta.role === 'owner' || meta.role === 'admin';
        if (!authorized) return;
        const targetId = typeof msg.targetId === 'string' ? msg.targetId : '';
        if (!targetId || targetId === meta.playerId) return;
        const targetPlayer = room.players.get(targetId);
        if (!targetPlayer || targetPlayer.role === 'owner') return;

        for (const [sock, cMeta] of clientMeta.entries()) {
          if (cMeta.playerId === targetId) {
            if (type === 'room:ban') {
              serverBannedList.set(targetPlayer.name.toLowerCase(), {
                name: targetPlayer.name,
                reason: 'Banned by Room Host',
                bannedBy: player.name,
                bannedAt: Date.now(),
              });
            }
            leaveCurrentRoom(sock);
            send(sock, {
              type: type === 'room:ban' ? 'player:banned' : 'room:kicked',
              reason:
                type === 'room:ban'
                  ? `Banned from ${room.code} by ${player.name}`
                  : `Removed from ${room.code} by ${player.name}`,
            });
            break;
          }
        }
        return;
      }

      if (type === 'player:spectate') {
        if (!room.privateConfig.allowSpectators && room.hostId !== meta.playerId) return;
        player.spectator = Boolean(msg.spectator);
        player.alive = !player.spectator;
        broadcastToRoom(room, {type: 'room:state', room: serializeRoom(room)});
        return;
      }

      if (type === 'player:switch_team') {
        if (room.status !== 'lobby') return;
        const targetTeam: TeamId =
          msg.team === 'bravo' ? 'bravo' : msg.team === 'charlie' ? 'charlie' : 'alpha';
        const tCount = GAME_MODES[room.matchFormat]?.teamCount ?? 2;
        const cap = Math.ceil(room.maxPlayers / Math.max(2, tCount));
        let countOnTarget = 0;
        for (const p of room.players.values()) {
          if (p.id !== player.id && !p.spectator && p.team === targetTeam) countOnTarget++;
        }
        if (countOnTarget >= cap) {
          send(ws, {
            type: 'room:error',
            message: `Team ${targetTeam.toUpperCase()} is full (${cap}/${cap}).`,
          });
          return;
        }
        player.team = targetTeam;
        broadcastToRoom(room, {type: 'room:state', room: serializeRoom(room)});
        return;
      }

      if (type === 'room:chat') {
        const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 140) : '';
        if (!text) return;
        broadcastToRoom(room, {
          type: 'lobby:chat',
          message: {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            sender: player.name,
            text,
            ts: Date.now(),
          },
        });
        return;
      }

      if (type === 'player:loadout') {
        if (typeof msg.primaryGun === 'string') player.primaryGun = msg.primaryGun;
        if (typeof msg.secondaryGun === 'string') player.secondaryGun = msg.secondaryGun;
        if (typeof msg.meleeGun === 'string') player.meleeGun = msg.meleeGun;
        if (typeof msg.utilityItem === 'string') player.utilityItem = msg.utilityItem;
        if (typeof msg.wrapId === 'string') player.wrapId = msg.wrapId;
        if (typeof msg.skinId === 'string') player.skinId = msg.skinId;
        if (typeof msg.ready === 'boolean') player.ready = msg.ready;
        broadcastToRoom(room, {type: 'room:state', room: serializeRoom(room)});
        return;
      }

      if (type === 'player:emote') {
        const emoteId = typeof msg.emoteId === 'string' ? msg.emoteId : 'salute';
        broadcastToRoom(
          room,
          {
            type: 'player:emote',
            id: player.id,
            name: player.name,
            emoteId,
          },
          player.id,
        );
        return;
      }

      if (type === 'match:start') {
        if (room.hostId !== meta.playerId || room.players.size < 2) return;
        startOrResetMatch(room);
        return;
      }

      if (type === 'match:rematch') {
        if (room.players.size < 2) return;
        if (room.status === 'finished' || room.hostId === meta.playerId) {
          startOrResetMatch(room);
        }
        return;
      }

      if (type === 'player:state' && room.status === 'playing') {
        player.x = Number(msg.x) || 0;
        player.y = Number(msg.y) || 0;
        player.z = Number(msg.z) || 0;
        player.yaw = Number(msg.yaw) || 0;
        player.pitch = Number(msg.pitch) || 0;
        broadcastToRoom(
          room,
          {
            type: 'player:state',
            id: player.id,
            x: player.x,
            y: player.y,
            z: player.z,
            yaw: player.yaw,
            pitch: player.pitch,
            weaponId: msg.weaponId,
            wrapId: msg.wrapId,
          },
          player.id,
        );
        return;
      }

      if (type === 'player:shoot' && room.status === 'playing') {
        broadcastToRoom(
          room,
          {
            type: 'player:shoot',
            id: player.id,
            origin: msg.origin,
            hitPoint: msg.hitPoint,
            weaponId: msg.weaponId,
          },
          player.id,
        );
        return;
      }

      if (type === 'player:hit' && room.status === 'playing') {
        const targetId = typeof msg.targetId === 'string' ? msg.targetId : '';
        const dmg = Math.max(1, Math.min(200, Number(msg.damage) || 0));
        const headshot = Boolean(msg.headshot);
        const target = room.players.get(targetId);
        if (!target || !target.alive || !player.alive || target.id === player.id) return;

        const teamMode = isTeamFormat(room.matchFormat);
        if (teamMode && !room.privateConfig.friendlyFire && target.team === player.team) {
          return;
        }

        player.damage += dmg;
        target.hp = Math.max(0, target.hp - dmg);
        broadcastToRoom(room, {
          type: 'player:damaged',
          targetId: target.id,
          attackerId: player.id,
          attackerName: player.name,
          hp: target.hp,
          damage: dmg,
          headshot,
        });

        if (target.hp <= 0) {
          target.alive = false;
          target.deaths += 1;
          player.kills += 1;
          player.score += 1;
          if (teamMode) {
            room.teamScores[player.team] += 1;
          }

          broadcastToRoom(room, {
            type: 'player:eliminated',
            targetId: target.id,
            targetName: target.name,
            targetTeam: target.team,
            attackerId: player.id,
            attackerName: player.name,
            attackerTeam: player.team,
            attackerScore: player.score,
            teamScores: room.teamScores,
            headshot,
          });
          broadcastToRoom(room, {type: 'room:state', room: serializeRoom(room)});

          const wonMatch = teamMode
            ? room.teamScores[player.team] >= room.targetScore
            : player.score >= room.targetScore;

          if (wonMatch) {
            room.status = 'finished';
            room.winnerTeam = teamMode ? player.team : null;
            const candidates = Array.from(room.players.values()).filter((p) =>
              teamMode ? p.team === player.team : p.id === player.id,
            );
            candidates.sort((a, b) => b.kills - a.kills || b.damage - a.damage);
            room.winnerId = candidates[0]?.id ?? player.id;

            for (const p of room.players.values()) {
              const pWon = teamMode ? p.team === room.winnerTeam : p.id === room.winnerId;
              const matchPts = p.kills * 250 + Math.round(p.damage * 0.5) + (pWon ? 500 : 0);
              upsertLeaderboard({
                callsign: p.name,
                role: p.role,
                winsDelta: pWon ? 1 : 0,
                killsDelta: p.kills,
                deathsDelta: p.deaths,
                matchesDelta: 1,
                scoreDelta: matchPts,
              });
            }
            broadcastLeaderboardToAll();

            broadcastToRoom(room, {
              type: 'match:victory',
              winnerId: room.winnerId,
              winnerTeam: room.winnerTeam,
              teamScores: room.teamScores,
              room: serializeRoom(room),
            });
          } else {
            const roomCode = room.code;
            const respawnTargetId = target.id;
            setTimeout(() => {
              const r = rooms.get(roomCode);
              if (!r || r.status !== 'playing') return;
              const t = r.players.get(respawnTargetId);
              if (!t || t.spectator) return;
              t.hp = 100;
              t.alive = true;
              broadcastToRoom(r, {type: 'player:respawned', targetId: t.id});
            }, 1800);
          }
        }
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(ws);
      clientMeta.delete(ws);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Rivals server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
