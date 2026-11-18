import {loadAudioSettings, saveAudioSettings} from './storage';
import type {AudioSettings, WeaponId} from './types';
import {WEAPONS} from './weapons';

export class FpsSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private settings: AudioSettings = loadAudioSettings();

  public getSettings(): AudioSettings {
    return {...this.settings};
  }

  public applySettings(next: AudioSettings): void {
    this.settings = {...next};
    saveAudioSettings(this.settings);
    this.syncGains();
  }

  private syncGains(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.uiGain) return;
    const now = this.ctx.currentTime;
    const m = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(m, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.02);
    this.uiGain.gain.setTargetAtTime(this.settings.uiVolume, now, 0.02);
  }

  public ensureReady(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.uiGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.uiGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.6, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
      this.syncGains();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playGunshot(weaponId: WeaponId): void {
    this.ensureReady();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const spec = WEAPONS[weaponId];

    // Melee swings / shields
    if (spec?.slot === 'melee') {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      const freq =
        weaponId === 'chainsaw'
          ? 640
          : weaponId === 'laser_saber'
          ? 2400
          : weaponId === 'scythe' || weaponId === 'battle_axe'
          ? 1100
          : 1800;
      filter.frequency.setValueAtTime(freq, now);
      filter.frequency.exponentialRampToValueAtTime(360, now + 0.16);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(weaponId === 'chainsaw' ? 0.24 : 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.19);
      return;
    }

    // Silent bows / slingshot / daggers
    if (
      weaponId === 'bow' ||
      weaponId === 'crossbow' ||
      weaponId === 'daggers' ||
      weaponId === 'slingshot'
    ) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(
        weaponId === 'daggers' ? 880 : weaponId === 'slingshot' ? 540 : 420,
        now,
      );
      osc.frequency.exponentialRampToValueAtTime(weaponId === 'daggers' ? 320 : 130, now + 0.085);
      g.gain.setValueAtTime(0.24, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.11);
      return;
    }

    // Cryo / Freeze weapons
    if (spec?.archetype === 'freeze') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.13);
      g.gain.setValueAtTime(0.26, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.15);
      return;
    }

    // Flamethrower / Flare
    if (spec?.archetype === 'flame') {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.15);
      return;
    }

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    const noiseGain = this.ctx.createGain();

    if (
      weaponId === 'rpg' ||
      weaponId === 'grenade_launcher' ||
      weaponId === 'exogun'
    ) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(weaponId === 'exogun' ? 420 : 120, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.24);
      oscGain.gain.setValueAtTime(0.45, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    } else if (
      weaponId === 'vx47' ||
      weaponId === 'pulse3' ||
      weaponId === 'scar_heavy' ||
      weaponId === 'energy_rifle' ||
      weaponId === 'gunblade' ||
      weaponId === 'paintball_gun'
    ) {
      osc.type = weaponId === 'energy_rifle' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(
        weaponId === 'scar_heavy' ? 145 : weaponId === 'energy_rifle' ? 320 : 190,
        now,
      );
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.09);
      oscGain.gain.setValueAtTime(0.32, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1900, now);
      noiseGain.gain.setValueAtTime(weaponId === 'paintball_gun' ? 0.18 : 0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    } else if (
      weaponId === 'spectre9' ||
      weaponId === 'vector_x' ||
      weaponId === 'vipers' ||
      weaponId === 'spray' ||
      weaponId === 'vulcan'
    ) {
      osc.type = weaponId === 'vulcan' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(weaponId === 'vulcan' ? 155 : 260, now);
      osc.frequency.exponentialRampToValueAtTime(weaponId === 'vulcan' ? 54 : 85, now + 0.055);
      oscGain.gain.setValueAtTime(weaponId === 'vulcan' ? 0.25 : 0.22, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(weaponId === 'vulcan' ? 900 : 1400, now);
      noiseGain.gain.setValueAtTime(weaponId === 'vulcan' ? 0.24 : 0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    } else if (spec?.archetype === 'pellet') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);
      oscGain.gain.setValueAtTime(0.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(450, now + 0.24);
      noiseGain.gain.setValueAtTime(0.55, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    } else if (weaponId === 'longbow') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.26);
      oscGain.gain.setValueAtTime(0.42, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2600, now);
      noiseGain.gain.setValueAtTime(0.42, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    } else if (weaponId === 'revolver' || weaponId === 'hand_cannon') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(weaponId === 'hand_cannon' ? 165 : 190, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.16);
      oscGain.gain.setValueAtTime(0.44, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1700, now);
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    } else {
      const suppressed = weaponId === 'suppressed_pistol';
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(suppressed ? 340 : 220, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
      oscGain.gain.setValueAtTime(suppressed ? 0.18 : 0.28, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(suppressed ? 2800 : 2100, now);
      noiseGain.gain.setValueAtTime(suppressed ? 0.12 : 0.26, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    }

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.3);
    noise.start(now);
    noise.stop(now + 0.3);
  }

  public playWarHorn(): void {
    this.ensureReady();
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    [220, 277.18, 329.63].forEach((freq) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.58);
    });
  }

  public playFlashbang(): void {
    this.ensureReady();
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(1750, now + 0.38);
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  public playExplosion(): void {
    this.ensureReady();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.48);
    oscGain.gain.setValueAtTime(0.65, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.52);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.5);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.55, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.55);
  }

  public playHeal(): void {
    this.ensureReady();
    if (!this.ctx || !this.uiGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      if (!this.ctx || !this.uiGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const t = now + i * 0.055;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g);
      g.connect(this.uiGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  public playHitmarker(headshot: boolean, kill: boolean): void {
    if (!this.ctx || !this.uiGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = headshot ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(headshot ? 1480 : 920, now);
    if (kill) {
      osc.frequency.exponentialRampToValueAtTime(headshot ? 1980 : 1240, now + 0.09);
    }
    gain.gain.setValueAtTime(headshot ? 0.32 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (kill ? 0.14 : 0.065));
    osc.connect(gain);
    gain.connect(this.uiGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playReload(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    [320, 520].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.14;
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  public playDash(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.16);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  public playDamageTaken(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.15);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playRoundBanner(victory: boolean): void {
    if (!this.ctx || !this.uiGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const freqs = victory ? [523.25, 659.25, 783.99] : [392.0, 311.13];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.uiGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.09;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.uiGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
