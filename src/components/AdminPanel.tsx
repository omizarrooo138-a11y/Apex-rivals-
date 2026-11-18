import React, {useState} from 'react';
import {
  Ban,
  Crosshair,
  Crown,
  Eye,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import type {
  AdminRegistry,
  AdminRole,
  AdminToolsState,
  PlayMode,
  RoomStateInfo,
} from '../fps/types';

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
  adminRole: AdminRole;
  adminLabel: string;
  registry: AdminRegistry;
  tools: AdminToolsState;
  callsign: string;
  playMode: PlayMode;
  room: RoomStateInfo | null;
  selfId: string | null;
  authError: string | null;
  onClaimOwner: (ownerName: string, passkey: string) => void;
  onAuthenticate: (passkey: string) => void;
  onLockAdmin: () => void;
  onChangeTools: (next: AdminToolsState) => void;
  onForceWin: () => void;
  onAppointAdmin: (name: string, passcode: string) => void;
  onRevokeAdmin: (name: string) => void;
  onBanPlayer: (opts: {targetId?: string; targetName: string; reason: string}) => void;
  onUnbanPlayer: (name: string) => void;
}

type AdminSection = 'tools' | 'bans' | 'admins';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  open,
  onClose,
  adminRole,
  adminLabel,
  registry,
  tools,
  callsign,
  playMode,
  room,
  selfId,
  authError,
  onClaimOwner,
  onAuthenticate,
  onLockAdmin,
  onChangeTools,
  onForceWin,
  onAppointAdmin,
  onRevokeAdmin,
  onBanPlayer,
  onUnbanPlayer,
}) => {
  const [section, setSection] = useState<AdminSection>('tools');
  const [passInput, setPassInput] = useState('');
  const [ownerNameInput, setOwnerNameInput] = useState(callsign || 'Owner');
  const [appointName, setAppointName] = useState('');
  const [appointCode, setAppointCode] = useState('');
  const [banNameInput, setBanNameInput] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('Rule violation');

  if (!open) return null;

  const isAuthorized = adminRole === 'owner' || adminRole === 'admin';
  const isOwner = adminRole === 'owner';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0d1320] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            {isOwner ? (
              <Crown className="w-5 h-5 text-amber-400" />
            ) : isAuthorized ? (
              <ShieldCheck className="w-5 h-5 text-sky-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            )}
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                {isOwner
                  ? 'Owner Command Panel'
                  : isAuthorized
                  ? 'Appointed Admin Panel'
                  : 'Owner & Admin Access Only'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isAuthorized
                  ? `Authorized as ${adminLabel || callsign} (${adminRole.toUpperCase()})`
                  : 'Restricted to the game Owner and Owner-appointed Admins.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthorized && (
              <button
                type="button"
                onClick={onLockAdmin}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Lock
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Admin Panel"
              className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Auth Gate for Unauthorized Users */}
        {!isAuthorized ? (
          <div className="mt-5 space-y-4">
            {!registry.ownerClaimed ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onClaimOwner(ownerNameInput, passInput);
                  setPassInput('');
                }}
                className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-4"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Crown className="w-4 h-4" />
                  <span>First-Time Setup: Claim Game Ownership</span>
                </div>
                <p className="text-xs text-slate-300">
                  Set your private Owner Passkey to claim Owner authority. Only you and Admins you
                  explicitly appoint will be able to access ESP, Aimbot, and Ban controls.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={ownerNameInput}
                    maxLength={16}
                    onChange={(e) => setOwnerNameInput(e.target.value)}
                    placeholder="Owner Callsign"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white focus:border-amber-400 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    placeholder="Set Owner Passkey (4+ chars)"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                {authError && <p className="text-xs text-rose-400">{authError}</p>}
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
                >
                  Claim Ownership & Open Panel
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onAuthenticate(passInput);
                  setPassInput('');
                }}
                className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                  <KeyRound className="w-4 h-4" />
                  <span>Owner / Appointed Admin Sign-In</span>
                </div>
                <p className="text-xs text-slate-400">
                  Owner: <strong className="text-slate-200">{registry.ownerName || 'Verified Owner'}</strong>.
                  Enter your Owner Passkey or an Owner-issued Admin invite code for callsign{' '}
                  <strong className="text-white">{callsign}</strong>.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    placeholder="Owner Passkey or Admin Code"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-sky-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 cursor-pointer"
                  >
                    Unlock
                  </button>
                </div>
                {authError && <p className="text-xs text-rose-400">{authError}</p>}
              </form>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Section Tabs */}
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-800 bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setSection('tools')}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  section === 'tools'
                    ? 'bg-orange-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                ESP, Aimbot & Sandbox
              </button>
              <button
                type="button"
                onClick={() => setSection('bans')}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  section === 'bans'
                    ? 'bg-rose-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Ban & Moderation ({registry.bannedList.length})
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setSection('admins')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    section === 'admins'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Appoint Admins ({registry.appointedAdmins.length})
                </button>
              )}
            </div>

            {/* COMBAT & SANDBOX TOOLS */}
            {section === 'tools' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onChangeTools({...tools, espEnabled: !tools.espEnabled})}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left cursor-pointer ${
                      tools.espEnabled
                        ? 'border-rose-500 bg-rose-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-display text-sm font-bold">
                        <Eye className="w-4 h-4 text-rose-400" />
                        <span>ESP Boxes & Telemetry</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        3D wall wireframe + HP & distance overlay
                      </div>
                    </div>
                    <span className="font-mono-num text-xs font-bold">
                      {tools.espEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <div
                    className={`rounded-xl border p-3.5 ${
                      tools.aimbotEnabled
                        ? 'border-amber-500 bg-amber-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          onChangeTools({...tools, aimbotEnabled: !tools.aimbotEnabled})
                        }
                        className="flex items-center gap-1.5 font-display text-sm font-bold cursor-pointer"
                      >
                        <Crosshair className="w-4 h-4 text-amber-400" />
                        <span>Aimbot Lock (ADS / Fire)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeTools({...tools, aimbotEnabled: !tools.aimbotEnabled})
                        }
                        className="font-mono-num text-xs font-bold cursor-pointer"
                      >
                        {tools.aimbotEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Target Hitbox:</span>
                      <div className="flex gap-1">
                        {(['head', 'body'] as const).map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => onChangeTools({...tools, aimbotBone: b})}
                            className={`rounded px-2 py-0.5 font-bold uppercase cursor-pointer ${
                              tools.aimbotBone === b
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onChangeTools({...tools, godMode: !tools.godMode})}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left cursor-pointer ${
                      tools.godMode
                        ? 'border-emerald-500 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-display text-sm font-bold">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>God Mode</span>
                      </div>
                      <div className="text-[11px] text-slate-400">Immunity to enemy damage</div>
                    </div>
                    <span className="font-mono-num text-xs font-bold">
                      {tools.godMode ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeTools({...tools, infiniteAmmo: !tools.infiniteAmmo})}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left cursor-pointer ${
                      tools.infiniteAmmo
                        ? 'border-sky-500 bg-sky-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-display text-sm font-bold">
                        <Sparkles className="w-4 h-4 text-sky-400" />
                        <span>Infinite Ammo</span>
                      </div>
                      <div className="text-[11px] text-slate-400">No magazine drain or reload</div>
                    </div>
                    <span className="font-mono-num text-xs font-bold">
                      {tools.infiniteAmmo ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeTools({...tools, noRecoil: !tools.noRecoil})}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left cursor-pointer ${
                      tools.noRecoil
                        ? 'border-purple-500 bg-purple-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-display text-sm font-bold">
                        <Crosshair className="w-4 h-4 text-purple-400" />
                        <span>Zero Recoil / Spread</span>
                      </div>
                      <div className="text-[11px] text-slate-400">Pinpoint beam accuracy</div>
                    </div>
                    <span className="font-mono-num text-xs font-bold">
                      {tools.noRecoil ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeTools({...tools, speedBoost: !tools.speedBoost})}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left cursor-pointer ${
                      tools.speedBoost
                        ? 'border-orange-500 bg-orange-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-display text-sm font-bold">
                        <Zap className="w-4 h-4 text-orange-400" />
                        <span>Hyper Speed (1.65x)</span>
                      </div>
                      <div className="text-[11px] text-slate-400">Boosted movement velocity</div>
                    </div>
                    <span className="font-mono-num text-xs font-bold">
                      {tools.speedBoost ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>

                {playMode !== 'lobby' && playMode !== 'multiplayer' && (
                  <button
                    type="button"
                    onClick={() => {
                      onForceWin();
                      onClose();
                    }}
                    className="w-full rounded-xl border border-amber-500/50 bg-amber-500/20 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                  >
                    Admin Action: Force Complete Match (Instant Win)
                  </button>
                )}
              </div>
            )}

            {/* BAN & MODERATION */}
            {section === 'bans' && (
              <div className="space-y-4">
                {room && room.players.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
                    <div className="text-xs font-bold text-white mb-2">
                      Room Players ({room.code})
                    </div>
                    <div className="space-y-2">
                      {room.players.map((p) => {
                        const isSelf = p.id === selfId;
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{p.name}</span>
                              {p.role && p.role !== 'none' && (
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                                  {p.role}
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[10px] text-slate-400">(You)</span>
                              )}
                            </div>
                            {!isSelf && p.role !== 'owner' && (
                              <button
                                type="button"
                                onClick={() =>
                                  onBanPlayer({
                                    targetId: p.id,
                                    targetName: p.name,
                                    reason: banReasonInput,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-500 cursor-pointer"
                              >
                                <Ban className="w-3 h-3" />
                                Ban Player
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!banNameInput.trim()) return;
                    onBanPlayer({targetName: banNameInput.trim(), reason: banReasonInput});
                    setBanNameInput('');
                  }}
                  className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-2.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                    <Ban className="w-4 h-4" />
                    <span>Ban Player by Callsign</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={banNameInput}
                      maxLength={16}
                      onChange={(e) => setBanNameInput(e.target.value)}
                      placeholder="Player Callsign (e.g. Rival)"
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={banReasonInput}
                      maxLength={60}
                      onChange={(e) => setBanReasonInput(e.target.value)}
                      placeholder="Ban Reason"
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Ban
                  </button>
                </form>

                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
                  <div className="text-xs font-bold text-slate-300 mb-2">
                    Banned List ({registry.bannedList.length})
                  </div>
                  {registry.bannedList.length === 0 ? (
                    <p className="text-xs text-slate-500">No players currently banned.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {registry.bannedList.map((b) => (
                        <div
                          key={b.name}
                          className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
                        >
                          <div>
                            <span className="font-bold text-rose-300">{b.name}</span>
                            <span className="mx-1.5 text-slate-600">·</span>
                            <span className="text-slate-400">{b.reason}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onUnbanPlayer(b.name)}
                            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                          >
                            Unban
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OWNER-ONLY APPOINT ADMINS */}
            {section === 'admins' && isOwner && (
              <div className="space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!appointName.trim() || appointCode.trim().length < 4) return;
                    onAppointAdmin(appointName.trim(), appointCode.trim());
                    setAppointName('');
                    setAppointCode('');
                  }}
                  className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 space-y-2.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <UserPlus className="w-4 h-4" />
                    <span>Appoint New Admin (Owner Only)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Enter the player's callsign and assign an Admin Invite Passcode (4+ chars).
                    If they are in your multiplayer room, they receive instant Admin access.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={appointName}
                      maxLength={16}
                      onChange={(e) => setAppointName(e.target.value)}
                      placeholder="Player Callsign"
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={appointCode}
                      maxLength={24}
                      onChange={(e) => setAppointCode(e.target.value)}
                      placeholder="Assign Admin Code (4+ chars)"
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Appoint Admin
                  </button>
                </form>

                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
                  <div className="text-xs font-bold text-slate-300 mb-2">
                    Appointed Admins ({registry.appointedAdmins.length})
                  </div>
                  {registry.appointedAdmins.length === 0 ? (
                    <p className="text-xs text-slate-500">No admins appointed yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {registry.appointedAdmins.map((a) => (
                        <div
                          key={a.name}
                          className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
                        >
                          <div>
                            <span className="font-bold text-sky-300">{a.name}</span>
                            <span className="ml-2 font-mono-num text-[11px] text-slate-500">
                              Code: {a.passcode}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRevokeAdmin(a.name)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-950/40 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/50 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
