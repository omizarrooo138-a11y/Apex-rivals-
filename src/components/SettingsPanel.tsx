import React from 'react';
import {Eye, Monitor, Volume2, VolumeX} from 'lucide-react';
import type {AudioSettings, CrosshairStyle, GpuPreset, GpuSettings, HudScale} from '../fps/types';

interface SettingsPanelProps {
  gpu: GpuSettings;
  audio: AudioSettings;
  onChangeGpu: (next: GpuSettings) => void;
  onChangeAudio: (next: AudioSettings) => void;
}

const PRESETS: {
  id: GpuPreset;
  label: string;
  scale: number;
  shadows: boolean;
  particles: boolean;
  bloom: boolean;
  fxaa: boolean;
  pbrTextures: boolean;
  cinematicFx: boolean;
  anisotropy: number;
}[] = [
  {
    id: 'low',
    label: 'Low',
    scale: 0.5,
    shadows: false,
    particles: false,
    bloom: false,
    fxaa: false,
    pbrTextures: false,
    cinematicFx: false,
    anisotropy: 1,
  },
  {
    id: 'medium',
    label: 'Medium',
    scale: 0.75,
    shadows: false,
    particles: true,
    bloom: true,
    fxaa: true,
    pbrTextures: true,
    cinematicFx: false,
    anisotropy: 4,
  },
  {
    id: 'high',
    label: 'High',
    scale: 1.0,
    shadows: true,
    particles: true,
    bloom: true,
    fxaa: true,
    pbrTextures: true,
    cinematicFx: true,
    anisotropy: 8,
  },
  {
    id: 'ultra',
    label: 'Ultra',
    scale: 1.5,
    shadows: true,
    particles: true,
    bloom: true,
    fxaa: true,
    pbrTextures: true,
    cinematicFx: true,
    anisotropy: 16,
  },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  gpu,
  audio,
  onChangeGpu,
  onChangeAudio,
}) => {
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    onChangeGpu({
      ...gpu,
      preset: p.id,
      resolutionScale: p.scale,
      shadows: p.shadows,
      particles: p.particles,
      bloom: p.bloom,
      fxaa: p.fxaa,
      pbrTextures: p.pbrTextures,
      cinematicFx: p.cinematicFx,
      anisotropy: p.anisotropy,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* GPU / Graphics Options */}
      <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Monitor className="w-4 h-4 text-sky-400" />
          <span className="font-display tracking-wide">GPU & Display</span>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1.5">Quality Preset</span>
            <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-slate-900 p-1 border border-slate-800">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    gpu.preset === p.id
                      ? 'bg-orange-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-400">Render Resolution Scale</span>
              <span className="font-mono-num font-semibold text-slate-200">
                {gpu.resolutionScale.toFixed(2)}x
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[0.5, 0.75, 1.0, 1.5].map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => onChangeGpu({...gpu, resolutionScale: sc})}
                  className={`rounded-lg border py-1.5 font-mono-num text-xs font-semibold cursor-pointer ${
                    gpu.resolutionScale === sc
                      ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sc}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-300">Dynamic Shadows</span>
            <button
              type="button"
              onClick={() => onChangeGpu({...gpu, shadows: !gpu.shadows})}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                gpu.shadows
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {gpu.shadows ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-300">Impact Sparks & Tracers</span>
            <button
              type="button"
              onClick={() => onChangeGpu({...gpu, particles: !gpu.particles})}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                gpu.particles
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {gpu.particles ? 'Enabled' : 'Reduced'}
            </button>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1.5">
              Seasonal Map Reskin
            </span>
            <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-slate-900 p-1 border border-slate-800">
              {(
                [
                  {id: 'normal', label: 'Standard'},
                  {id: 'halloween', label: 'Halloween Spooky'},
                  {id: 'winter', label: 'Winter Frost'},
                ] as const
              ).map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onChangeGpu({...gpu, seasonalTheme: theme.id})}
                  className={`rounded-md py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    (gpu.seasonalTheme ?? 'normal') === theme.id
                      ? theme.id === 'halloween'
                        ? 'bg-orange-500 text-slate-950'
                        : theme.id === 'winter'
                        ? 'bg-sky-400 text-slate-950'
                        : 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Post-Processing & Shader Pipeline */}
          <div className="border-t border-slate-800 pt-3.5 space-y-2.5">
            <span className="block text-xs font-semibold text-sky-300">
              Advanced Graphics & Post-Processing
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeGpu({...gpu, bloom: !(gpu.bloom ?? true)})}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold cursor-pointer ${
                  gpu.bloom ?? true
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                HDR Bloom Glow: {gpu.bloom ?? true ? 'On' : 'Off'}
              </button>

              <button
                type="button"
                onClick={() => onChangeGpu({...gpu, fxaa: !(gpu.fxaa ?? true)})}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold cursor-pointer ${
                  gpu.fxaa ?? true
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                FXAA Anti-Aliasing: {gpu.fxaa ?? true ? 'On' : 'Off'}
              </button>

              <button
                type="button"
                onClick={() => onChangeGpu({...gpu, pbrTextures: !(gpu.pbrTextures ?? true)})}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold cursor-pointer ${
                  gpu.pbrTextures ?? true
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                PBR Normal & Roughness: {gpu.pbrTextures ?? true ? 'On' : 'Off'}
              </button>

              <button
                type="button"
                onClick={() => onChangeGpu({...gpu, cinematicFx: !(gpu.cinematicFx ?? true)})}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold cursor-pointer ${
                  gpu.cinematicFx ?? true
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                Vignette & Hit FX: {gpu.cinematicFx ?? true ? 'On' : 'Off'}
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Anisotropic Filtering</span>
                <span className="font-mono-num font-semibold text-white">{gpu.anisotropy ?? 8}x</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 4, 8, 16].map((af) => (
                  <button
                    key={af}
                    type="button"
                    onClick={() => onChangeGpu({...gpu, anisotropy: af})}
                    className={`rounded-lg border py-1 font-mono-num text-xs font-semibold cursor-pointer ${
                      (gpu.anisotropy ?? 8) === af
                        ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {af}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">ACES Tone Exposure</span>
                <span className="font-mono-num font-semibold text-white">
                  {(gpu.exposure ?? 1.12).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.8}
                max={1.5}
                step={0.04}
                value={gpu.exposure ?? 1.12}
                onChange={(e) => onChangeGpu({...gpu, exposure: Number(e.target.value)})}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Field of View (FOV)</span>
              <span className="font-mono-num font-semibold text-white">{gpu.fov}°</span>
            </div>
            <input
              type="range"
              min={75}
              max={110}
              step={1}
              value={gpu.fov}
              onChange={(e) => onChangeGpu({...gpu, fov: Number(e.target.value)})}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Mouse Sensitivity</span>
              <span className="font-mono-num font-semibold text-white">
                {gpu.sensitivity.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.5}
              step={0.1}
              value={gpu.sensitivity}
              onChange={(e) => onChangeGpu({...gpu, sensitivity: Number(e.target.value)})}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>

          <div className="border-t border-slate-800 pt-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white">Crosshair Customizer</span>
              <div className="flex items-center gap-1.5">
                {(['#ffffff', '#38bdf8', '#22c55e', '#f97316', '#f43f5e', '#facc15', '#e879f9'] as const).map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Crosshair color ${hex}`}
                    onClick={() =>
                      onChangeGpu({...gpu, crosshair: {...gpu.crosshair, color: hex}})
                    }
                    className={`h-4 w-4 rounded-full border-2 cursor-pointer ${
                      gpu.crosshair.color === hex ? 'border-white scale-110' : 'border-slate-700'
                    }`}
                    style={{backgroundColor: hex}}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Custom crosshair color"
                  value={gpu.crosshair.color}
                  onChange={(e) =>
                    onChangeGpu({...gpu, crosshair: {...gpu.crosshair, color: e.target.value}})
                  }
                  className="h-5 w-6 rounded border border-slate-700 bg-slate-900 cursor-pointer"
                />
              </div>
            </div>

            {/* Live Crosshair Preview */}
            <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-gradient-to-b from-slate-800/80 via-slate-900 to-slate-950">
              <span className="absolute left-2.5 top-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Live Preview
              </span>
              {(() => {
                const ch = gpu.crosshair;
                const arm = 3 + ch.size * 3;
                const thick = ch.thickness ?? 2;
                const gap = ch.gap ?? 8;
                const opacity = ch.opacity ?? 0.95;
                const outlineShadow = ch.outline ? '0 0 0 1px rgba(0,0,0,0.9)' : 'none';
                return (
                  <div className="relative flex items-center justify-center" style={{opacity}}>
                    {(ch.style === 'dot' || ch.centerDot) && (
                      <div
                        className="rounded-full"
                        style={{
                          width: Math.max(3, thick + 1),
                          height: Math.max(3, thick + 1),
                          backgroundColor: ch.color,
                          boxShadow: outlineShadow,
                        }}
                      />
                    )}
                    {(ch.style === 'cross' || ch.style === 'tcross') && (
                      <>
                        {ch.style === 'cross' && (
                          <div
                            className="absolute"
                            style={{
                              width: thick,
                              height: arm,
                              backgroundColor: ch.color,
                              boxShadow: outlineShadow,
                              transform: `translateY(-${gap + arm / 2}px)`,
                            }}
                          />
                        )}
                        <div
                          className="absolute"
                          style={{
                            width: thick,
                            height: arm,
                            backgroundColor: ch.color,
                            boxShadow: outlineShadow,
                            transform: `translateY(${gap + arm / 2}px)`,
                          }}
                        />
                        <div
                          className="absolute"
                          style={{
                            width: arm,
                            height: thick,
                            backgroundColor: ch.color,
                            boxShadow: outlineShadow,
                            transform: `translateX(-${gap + arm / 2}px)`,
                          }}
                        />
                        <div
                          className="absolute"
                          style={{
                            width: arm,
                            height: thick,
                            backgroundColor: ch.color,
                            boxShadow: outlineShadow,
                            transform: `translateX(${gap + arm / 2}px)`,
                          }}
                        />
                      </>
                    )}
                    {ch.style === 'circle' && (
                      <div
                        className="absolute rounded-full"
                        style={{
                          borderStyle: 'solid',
                          borderWidth: thick,
                          borderColor: ch.color,
                          boxShadow: outlineShadow,
                          width: gap * 2 + 6,
                          height: gap * 2 + 6,
                        }}
                      />
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  {id: 'cross', label: 'Cross'},
                  {id: 'tcross', label: 'T-Style'},
                  {id: 'dot', label: 'Dot'},
                  {id: 'circle', label: 'Circle'},
                ] as {id: CrosshairStyle; label: string}[]
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() =>
                    onChangeGpu({...gpu, crosshair: {...gpu.crosshair, style: st.id}})
                  }
                  className={`rounded-lg border py-1.5 text-xs font-semibold cursor-pointer ${
                    gpu.crosshair.style === st.id
                      ? 'border-orange-500 bg-orange-500/20 text-orange-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Arm Length</span>
                  <span className="font-mono-num text-white">{gpu.crosshair.size}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={gpu.crosshair.size}
                  onChange={(e) =>
                    onChangeGpu({
                      ...gpu,
                      crosshair: {...gpu.crosshair, size: Number(e.target.value)},
                    })
                  }
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Thickness</span>
                  <span className="font-mono-num text-white">{gpu.crosshair.thickness ?? 2}px</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={gpu.crosshair.thickness ?? 2}
                  onChange={(e) =>
                    onChangeGpu({
                      ...gpu,
                      crosshair: {...gpu.crosshair, thickness: Number(e.target.value)},
                    })
                  }
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Center Gap</span>
                  <span className="font-mono-num text-white">{gpu.crosshair.gap ?? 8}px</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={16}
                  step={1}
                  value={gpu.crosshair.gap ?? 8}
                  onChange={(e) =>
                    onChangeGpu({
                      ...gpu,
                      crosshair: {...gpu.crosshair, gap: Number(e.target.value)},
                    })
                  }
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Opacity</span>
                  <span className="font-mono-num text-white">
                    {Math.round((gpu.crosshair.opacity ?? 0.95) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={1}
                  step={0.05}
                  value={gpu.crosshair.opacity ?? 0.95}
                  onChange={(e) =>
                    onChangeGpu({
                      ...gpu,
                      crosshair: {...gpu.crosshair, opacity: Number(e.target.value)},
                    })
                  }
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  onChangeGpu({
                    ...gpu,
                    crosshair: {...gpu.crosshair, centerDot: !(gpu.crosshair.centerDot ?? true)},
                  })
                }
                className={`flex-1 rounded-lg border py-1.5 font-semibold cursor-pointer ${
                  gpu.crosshair.centerDot ?? true
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                Center Dot: {gpu.crosshair.centerDot ?? true ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeGpu({
                    ...gpu,
                    crosshair: {...gpu.crosshair, outline: !(gpu.crosshair.outline ?? true)},
                  })
                }
                className={`flex-1 rounded-lg border py-1.5 font-semibold cursor-pointer ${
                  gpu.crosshair.outline ?? true
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                Outline Shadow: {gpu.crosshair.outline ?? true ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Options */}
      <div className="rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Volume2 className="w-4 h-4 text-orange-400" />
            <span className="font-display tracking-wide">Audio Mixer</span>
          </div>
          <button
            type="button"
            onClick={() => onChangeAudio({...audio, muted: !audio.muted})}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
              audio.muted
                ? 'border-rose-500/50 bg-rose-950/60 text-rose-300'
                : 'border-slate-700 bg-slate-900 text-slate-200'
            }`}
          >
            {audio.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {audio.muted ? 'Muted' : 'Active'}
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Master Volume</span>
              <span className="font-mono-num font-semibold text-white">
                {Math.round(audio.masterVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audio.masterVolume}
              onChange={(e) =>
                onChangeAudio({...audio, masterVolume: Number(e.target.value), muted: false})
              }
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Weapon & Combat SFX</span>
              <span className="font-mono-num font-semibold text-white">
                {Math.round(audio.sfxVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audio.sfxVolume}
              onChange={(e) => onChangeAudio({...audio, sfxVolume: Number(e.target.value)})}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Hitmarkers & Round Cues</span>
              <span className="font-mono-num font-semibold text-white">
                {Math.round(audio.uiVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audio.uiVolume}
              onChange={(e) => onChangeAudio({...audio, uiVolume: Number(e.target.value)})}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3.5 text-xs text-slate-400 leading-relaxed">
            All GPU, Audio, Loadout, Wrap, and Quest settings save automatically in local storage so your configuration works 100% offline.
          </div>
        </div>
      </div>

      {/* UI, Telemetry & HUD Display */}
      <div className="md:col-span-2 rounded-xl border border-slate-700/70 bg-[#0d1320]/94 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span className="font-display tracking-wide">UI, Telemetry &amp; HUD Display</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Live telemetry shows in both Lobby &amp; Combat
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          <button
            type="button"
            onClick={() => onChangeGpu({...gpu, showFps: !(gpu.showFps ?? true)})}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 font-semibold cursor-pointer ${
              gpu.showFps ?? true
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            <span>Show FPS Counter</span>
            <span>{gpu.showFps ?? true ? 'On' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeGpu({...gpu, showPing: !(gpu.showPing ?? true)})}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 font-semibold cursor-pointer ${
              gpu.showPing ?? true
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            <span>Show Network Ping</span>
            <span>{gpu.showPing ?? true ? 'On' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeGpu({...gpu, showKeybinds: !(gpu.showKeybinds ?? true)})}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 font-semibold cursor-pointer ${
              gpu.showKeybinds ?? true
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            <span>Controls Keybind Bar</span>
            <span>{gpu.showKeybinds ?? true ? 'On' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeGpu({...gpu, showDamageNumbers: !(gpu.showDamageNumbers ?? true)})
            }
            className={`flex items-center justify-between rounded-lg border px-3 py-2 font-semibold cursor-pointer ${
              gpu.showDamageNumbers ?? true
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            <span>Floating Damage Numbers</span>
            <span>{gpu.showDamageNumbers ?? true ? 'On' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeGpu({...gpu, cameraBob: !(gpu.cameraBob ?? true)})}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 font-semibold cursor-pointer ${
              gpu.cameraBob ?? true
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            <span>Camera Bob &amp; Shake</span>
            <span>{gpu.cameraBob ?? true ? 'On' : 'Off'}</span>
          </button>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5">
            <span className="font-semibold text-slate-300">HUD Scale</span>
            <div className="inline-flex rounded-md bg-slate-950 p-0.5 border border-slate-800">
              {(
                [
                  {id: 'compact', label: '90%'},
                  {id: 'standard', label: '100%'},
                  {id: 'large', label: '110%'},
                ] as {id: HudScale; label: string}[]
              ).map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onChangeGpu({...gpu, hudScale: sc.id})}
                  className={`rounded px-2 py-0.5 font-mono-num text-[11px] font-bold cursor-pointer ${
                    (gpu.hudScale ?? 'standard') === sc.id
                      ? 'bg-orange-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
