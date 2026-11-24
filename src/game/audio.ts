import { PlayerStance, WeaponId } from './types';

export type FlightAudioMode = 'none' | 'airplane' | 'skydiving' | 'parachute';
export type LobbyMusicMode = 'off' | 'lobby' | 'waiting' | 'drop';

type SfxBufferKey =
  | 'kill'
  | 'headshot'
  | 'g18'
  | 'deagle'
  | 'ump45'
  | 'm4a1'
  | 'xm8'
  | 'scar'
  | 'ak47'
  | 'm1014'
  | 'awm'
  | 'run'
  | 'jump'
  | 'proneDown'
  | 'proneUp'
  | 'backpack'
  | 'medkit'
  | 'gloo'
  | 'pickupItem'
  | 'safeWeak'
  | 'safeStrong1'
  | 'safeStrong2';

const SFX_URLS: Record<SfxBufferKey, string> = {
  kill: '/audio/kill_sfx.mp3',
  headshot: '/audio/head.mp3',
  g18: '/audio/g18-1tiro.mp3',
  deagle: '/audio/desert-1tiro.mp3',
  ump45: '/audio/ump-1tiro.mp3',
  m4a1: '/audio/m4a1-1tiro.mp3',
  xm8: '/audio/xm8-1tiro.mp3',
  scar: '/audio/scar-1tiro.mp3',
  ak47: '/audio/ak-1tiro.mp3',
  m1014: '/audio/m1014-1tiro.mp3',
  awm: '/audio/awm-1tiro.mp3',
  run: '/audio/correndo.mp3',
  jump: '/audio/pulo.mp3',
  proneDown: '/audio/deitar.mp3',
  proneUp: '/audio/levantar.mp3',
  backpack: '/audio/abrindo-mochila.mp3',
  medkit: '/audio/usando-kit-medico.mp3',
  gloo: '/audio/gelo.mp3',
  pickupItem: '/audio/coletar-item.mp3',
  safeWeak: '/audio/dano-safe-fraco-ou-medio.mp3',
  safeStrong1: '/audio/dano-safe-forte1.mp3',
  safeStrong2: '/audio/dano-safe-forte2.mp3',
};

interface SampleShotProfile {
  offset: number;
  duration: number;
  gain: number;
  fadeStart: number;
}

const SAMPLE_SHOT_PROFILES: Partial<Record<WeaponId, SampleShotProfile>> = {
  g18: { offset: 0.0, duration: 0.48, gain: 0.85, fadeStart: 0.28 },
  deagle: { offset: 0.282, duration: 0.66, gain: 2.35, fadeStart: 0.44 },
  ump45: { offset: 0.372, duration: 0.52, gain: 0.85, fadeStart: 0.28 },
  m4a1: { offset: 0.296, duration: 0.48, gain: 0.85, fadeStart: 0.26 },
  xm8: { offset: 0.273, duration: 0.48, gain: 0.88, fadeStart: 0.26 },
  scar: { offset: 0.355, duration: 0.52, gain: 6.5, fadeStart: 0.34 },
  ak47: { offset: 0.475, duration: 0.54, gain: 6.8, fadeStart: 0.35 },
  m1014: { offset: 0.0, duration: 0.56, gain: 2.1, fadeStart: 0.34 },
  awm: { offset: 0.38, duration: 0.61, gain: 1.15, fadeStart: 0.45 },
};

interface WeaponBallisticProfile {
  crackHz: number;
  crackGain: number;
  crackDur: number;
  bodyHz: number;
  bodyGain: number;
  bodyDur: number;
  punchStartHz: number;
  punchEndHz: number;
  punchDur: number;
  punchGain: number;
  tailStartHz: number;
  tailDur: number;
  tailGain: number;
  whipDelay: number;
  boltHz: number;
}

const BALLISTIC_PROFILES: Record<WeaponId, WeaponBallisticProfile> = {
  g18: {
    crackHz: 3500,
    crackGain: 0.44,
    crackDur: 0.032,
    bodyHz: 920,
    bodyGain: 0.34,
    bodyDur: 0.065,
    punchStartHz: 235,
    punchEndHz: 54,
    punchDur: 0.055,
    punchGain: 0.32,
    tailStartHz: 1800,
    tailDur: 0.14,
    tailGain: 0.14,
    whipDelay: 0,
    boltHz: 2750,
  },
  deagle: {
    crackHz: 3850,
    crackGain: 0.78,
    crackDur: 0.052,
    bodyHz: 710,
    bodyGain: 0.68,
    bodyDur: 0.14,
    punchStartHz: 162,
    punchEndHz: 32,
    punchDur: 0.16,
    punchGain: 0.68,
    tailStartHz: 1950,
    tailDur: 0.38,
    tailGain: 0.32,
    whipDelay: 0.014,
    boltHz: 2150,
  },
  ump45: {
    crackHz: 2800,
    crackGain: 0.5,
    crackDur: 0.036,
    bodyHz: 780,
    bodyGain: 0.42,
    bodyDur: 0.08,
    punchStartHz: 195,
    punchEndHz: 46,
    punchDur: 0.072,
    punchGain: 0.38,
    tailStartHz: 1600,
    tailDur: 0.18,
    tailGain: 0.18,
    whipDelay: 0,
    boltHz: 2450,
  },
  m4a1: {
    crackHz: 4200,
    crackGain: 0.64,
    crackDur: 0.044,
    bodyHz: 860,
    bodyGain: 0.48,
    bodyDur: 0.095,
    punchStartHz: 175,
    punchEndHz: 38,
    punchDur: 0.088,
    punchGain: 0.42,
    tailStartHz: 2300,
    tailDur: 0.31,
    tailGain: 0.25,
    whipDelay: 0.016,
    boltHz: 2600,
  },
  xm8: {
    crackHz: 4450,
    crackGain: 0.66,
    crackDur: 0.04,
    bodyHz: 940,
    bodyGain: 0.46,
    bodyDur: 0.09,
    punchStartHz: 185,
    punchEndHz: 41,
    punchDur: 0.082,
    punchGain: 0.44,
    tailStartHz: 2450,
    tailDur: 0.29,
    tailGain: 0.23,
    whipDelay: 0.015,
    boltHz: 2720,
  },
  scar: {
    crackHz: 4100,
    crackGain: 0.65,
    crackDur: 0.042,
    bodyHz: 840,
    bodyGain: 0.49,
    bodyDur: 0.096,
    punchStartHz: 172,
    punchEndHz: 37,
    punchDur: 0.09,
    punchGain: 0.43,
    tailStartHz: 2200,
    tailDur: 0.3,
    tailGain: 0.24,
    whipDelay: 0.015,
    boltHz: 2540,
  },
  ak47: {
    crackHz: 3900,
    crackGain: 0.7,
    crackDur: 0.048,
    bodyHz: 730,
    bodyGain: 0.54,
    bodyDur: 0.11,
    punchStartHz: 158,
    punchEndHz: 34,
    punchDur: 0.105,
    punchGain: 0.5,
    tailStartHz: 1950,
    tailDur: 0.34,
    tailGain: 0.27,
    whipDelay: 0.017,
    boltHz: 2320,
  },
  m1014: {
    crackHz: 2450,
    crackGain: 0.72,
    crackDur: 0.058,
    bodyHz: 560,
    bodyGain: 0.68,
    bodyDur: 0.14,
    punchStartHz: 142,
    punchEndHz: 29,
    punchDur: 0.15,
    punchGain: 0.64,
    tailStartHz: 1450,
    tailDur: 0.38,
    tailGain: 0.3,
    whipDelay: 0.012,
    boltHz: 1950,
  },
  awm: {
    crackHz: 4500,
    crackGain: 0.84,
    crackDur: 0.065,
    bodyHz: 690,
    bodyGain: 0.72,
    bodyDur: 0.17,
    punchStartHz: 118,
    punchEndHz: 25,
    punchDur: 0.21,
    punchGain: 0.72,
    tailStartHz: 2100,
    tailDur: 0.58,
    tailGain: 0.38,
    whipDelay: 0.021,
    boltHz: 2250,
  },
};

const LOBBY_MUSIC_GAIN: Record<LobbyMusicMode, number> = {
  off: 0,
  lobby: 0.36,
  waiting: 0.24,
  drop: 0.1,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.75;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;
  private saturationCurve: Float32Array<ArrayBuffer> | null = null;
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private propGain: GainNode | null = null;
  private flightMode: FlightAudioMode = 'none';

  // Decoded MP3 SFX buffers
  private sfxBuffers = new Map<SfxBufferKey, AudioBuffer>();
  private sfxLoadStarted = false;

  // Synchronized stateful SFX nodes
  private runSource: AudioBufferSourceNode | null = null;
  private runGain: GainNode | null = null;
  private fallbackStepCooldown = 0;
  private medkitSource: AudioBufferSourceNode | null = null;
  private medkitGain: GainNode | null = null;
  private medkitActive = false;
  private stanceSource: AudioBufferSourceNode | null = null;
  private vehicleOsc: OscillatorNode | null = null;
  private vehicleSubOsc: OscillatorNode | null = null;
  private vehicleGain: GainNode | null = null;
  private vehicleFilter: BiquadFilterNode | null = null;

  // Lobby 2017 Music
  private lobbyAudio: HTMLAudioElement | null = null;
  private lobbyMusicMode: LobbyMusicMode = 'off';
  private lobbyFadeTimer: number | null = null;
  private booyahAudio: HTMLAudioElement | null = null;
  private booyahFallbackTimer: number | null = null;
  private recentRemoteShots: number[] = [];
  private lastSafeDmgAudioMs = 0;

  public configure(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.02,
      );
    }
    if (this.muted || this.volume <= 0.001) {
      this.stopRunAudio();
      this.stopMedkitAudio();
      this.stopVehicleAudio();
    }
    if (this.booyahAudio) {
      this.booyahAudio.volume = this.muted ? 0 : Math.max(0.05, Math.min(1, this.volume * 0.9));
    }
    this.syncLobbyMusicPlayback();
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
      this.saturationCurve = this.createSaturationCurve(2.6);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.preloadAllBuffers();
    this.syncLobbyMusicPlayback(true);
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 1.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createSaturationCurve(drive: number): Float32Array<ArrayBuffer> {
    const n = 256;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1;
      curve[i] = Math.tanh(x * drive);
    }
    return curve;
  }

  private preloadAllBuffers(): void {
    if (this.sfxLoadStarted || !this.ctx) return;
    this.sfxLoadStarted = true;
    const ctx = this.ctx;
    const fetchAudioBuffer = async (targetUrl: string): Promise<ArrayBuffer> => {
      const res = await fetch(targetUrl);
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || ct.includes('text/html')) {
        throw new Error('No audio asset');
      }
      return res.arrayBuffer();
    };
    (Object.keys(SFX_URLS) as SfxBufferKey[]).forEach((key) => {
      const localUrl = SFX_URLS[key];
      const fileName = localUrl.split('/').pop() || '';
      const rawGithubUrl = `https://raw.githubusercontent.com/kalidade-br/freefire-soms/main/${encodeURIComponent(fileName)}`;
      const netlifyUrl = `https://freefire-soms.netlify.app/${encodeURIComponent(fileName)}`;
      const headGithubUrl = 'https://kalidade-br.github.io/freefire-2017/som/head.mp3';
      void fetchAudioBuffer(localUrl)
        .catch(() => (key === 'headshot' ? fetchAudioBuffer(headGithubUrl) : Promise.reject()))
        .catch(() => fetchAudioBuffer(rawGithubUrl))
        .catch(() => fetchAudioBuffer(netlifyUrl))
        .then((arr) => ctx.decodeAudioData(arr))
        .then((decoded) => {
          this.sfxBuffers.set(key, decoded);
        })
        .catch(() => {
          // Synth fallback remains active if local and remote fetch/decode fail
        });
    });
  }

  private ensureLobbyAudio(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (!this.lobbyAudio) {
      const el = new Audio('/audio/lobby_2017.mp3');
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      this.lobbyAudio = el;
    }
    return this.lobbyAudio;
  }

  public setLobbyMusicMode(mode: LobbyMusicMode): void {
    if (this.lobbyMusicMode === mode) return;
    this.lobbyMusicMode = mode;
    this.syncLobbyMusicPlayback(mode !== 'off');
  }

  private getTargetLobbyVolume(): number {
    if (this.muted || this.volume <= 0.001) return 0;
    return Math.max(0, Math.min(1, this.volume * LOBBY_MUSIC_GAIN[this.lobbyMusicMode]));
  }

  private syncLobbyMusicPlayback(attemptPlay = false): void {
    const el = this.ensureLobbyAudio();
    if (!el) return;
    const target = this.getTargetLobbyVolume();

    if (target > 0.001 && attemptPlay && el.paused) {
      el.play().catch(() => {
        // Browser autoplay blocked until first user gesture; unlock() retries it cleanly
      });
    }

    if (this.lobbyFadeTimer !== null) return;
    this.lobbyFadeTimer = window.setInterval(() => {
      const audio = this.lobbyAudio;
      if (!audio) {
        if (this.lobbyFadeTimer !== null) {
          clearInterval(this.lobbyFadeTimer);
          this.lobbyFadeTimer = null;
        }
        return;
      }

      const desired = this.getTargetLobbyVolume();
      if (desired > 0.001 && audio.paused) {
        audio.play().catch(() => {
          // Wait for unlock gesture
        });
      }

      const diff = desired - audio.volume;
      if (Math.abs(diff) <= 0.012) {
        audio.volume = desired;
        if (desired <= 0.001 && !audio.paused) {
          audio.pause();
          if (this.lobbyMusicMode === 'off') {
            audio.currentTime = 0;
          }
        }
        if (this.lobbyFadeTimer !== null) {
          clearInterval(this.lobbyFadeTimer);
          this.lobbyFadeTimer = null;
        }
      } else {
        audio.volume = Math.max(0, Math.min(1, audio.volume + diff * 0.24));
      }
    }, 55);
  }

  public stopBooyahMusic(): void {
    if (this.booyahFallbackTimer !== null) {
      clearTimeout(this.booyahFallbackTimer);
      this.booyahFallbackTimer = null;
    }
    if (this.booyahAudio) {
      try {
        this.booyahAudio.onended = null;
        this.booyahAudio.onerror = null;
        this.booyahAudio.onloadedmetadata = null;
        this.booyahAudio.pause();
        this.booyahAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.booyahAudio = null;
    }
  }

  public playBooyahMusic(onEnded?: () => void, onDuration?: (sec: number) => void): void {
    this.stopBooyahMusic();
    this.setLobbyMusicMode('off');
    this.stopRunAudio();
    this.stopMedkitAudio();
    this.stopVehicleAudio();

    if (typeof Audio === 'undefined') {
      if (onEnded) {
        this.booyahFallbackTimer = window.setTimeout(onEnded, 5500);
      }
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.stopBooyahMusic();
      onEnded?.();
    };

    const el = new Audio('/audio/booyah.mp3');
    el.preload = 'auto';
    el.loop = false;
    el.volume = this.muted ? 0 : Math.max(0.05, Math.min(1, this.volume * 0.9));
    this.booyahAudio = el;

    const scheduleFallback = (ms: number) => {
      if (this.booyahFallbackTimer !== null) {
        clearTimeout(this.booyahFallbackTimer);
      }
      this.booyahFallbackTimer = window.setTimeout(finish, ms);
    };

    let triedRemoteFallback = false;
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0.5) {
        onDuration?.(el.duration);
        scheduleFallback(Math.ceil(el.duration * 1000) + 450);
      }
    };
    el.onended = () => {
      finish();
    };
    el.onerror = () => {
      if (!triedRemoteFallback) {
        triedRemoteFallback = true;
        el.src = 'https://kalidade-br.github.io/freefire-2017/som/booyah.mp3';
        el.play().catch(() => {
          scheduleFallback(5500);
        });
      } else {
        scheduleFallback(5500);
      }
    };

    // Default fallback ~6s until metadata reports actual MP3 duration
    scheduleFallback(6500);

    el.play().catch(() => {
      if (!triedRemoteFallback) {
        scheduleFallback(5500);
      }
    });
  }

  private ready(): boolean {
    if (this.muted || this.volume <= 0.001) return false;
    this.unlock();
    return Boolean(this.ctx && this.masterGain && this.ctx.state === 'running');
  }

  public playUiClick(pitch = 680): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, now + 0.055);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playUiConfirm(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [520, 780].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.16, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.13);
    });
  }

  public playGunshot(weaponId: WeaponId, silenced = false, distanceMeters = 0): void {
    if (!this.ready() || !this.ctx || !this.masterGain || !this.noiseBuffer) {
      return;
    }
    const dist = Math.max(0, distanceMeters);
    if (dist > 145) return;

    const nowMs = performance.now();
    if (dist > 4) {
      this.recentRemoteShots = this.recentRemoteShots.filter((t) => nowMs - t < 50);
      if (this.recentRemoteShots.length >= 5) return;
      this.recentRemoteShots.push(nowMs);
    }

    const atten = dist <= 3 ? 1 : 1 / (1 + Math.pow(dist / 16, 1.36));
    if (atten < 0.025) return;

    const now = this.ctx.currentTime;
    const airMaxHz = Math.max(480, 14500 * Math.exp(-dist / 42));
    const silenceFactor = silenced ? 0.36 : 1;

    // Use real Free Fire 1-shot MP3 buffer when available (each trigger plays 1 clean shot!)
    const sampleKey: SfxBufferKey | null =
      weaponId === 'g18' ||
      weaponId === 'deagle' ||
      weaponId === 'ump45' ||
      weaponId === 'm4a1' ||
      weaponId === 'xm8' ||
      weaponId === 'scar' ||
      weaponId === 'ak47' ||
      weaponId === 'm1014' ||
      weaponId === 'awm'
        ? weaponId
        : null;
    const sampleBuf = sampleKey ? this.sfxBuffers.get(sampleKey) : undefined;
    const sampleProfile = sampleKey ? SAMPLE_SHOT_PROFILES[weaponId] : undefined;

    if (sampleBuf && sampleProfile) {
      const src = this.ctx.createBufferSource();
      src.buffer = sampleBuf;

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(
        silenced ? Math.min(airMaxHz, 1250) : airMaxHz,
        now,
      );

      const g = this.ctx.createGain();
      const peakGain = sampleProfile.gain * (silenced ? 0.44 : 1) * atten;
      g.gain.setValueAtTime(peakGain, now);
      // Clean tail taper so rapid bursts stay articulated shot-by-shot instead of muddying
      g.gain.setValueAtTime(peakGain, now + sampleProfile.fadeStart);
      g.gain.exponentialRampToValueAtTime(0.001, now + sampleProfile.duration);

      src.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);

      const safeDur = Math.max(
        0.05,
        Math.min(sampleProfile.duration + 0.02, sampleBuf.duration - sampleProfile.offset),
      );
      src.start(now, sampleProfile.offset, safeDur);
      return;
    }

    // Layered ballistic synthesis for UMP45, M1014, or pre-decode fallback
    const p = BALLISTIC_PROFILES[weaponId];
    const noiseOffset = (Math.random() * 0.5) % Math.max(0.05, this.noiseBuffer.duration - 0.65);

    const crackNoise = this.ctx.createBufferSource();
    crackNoise.buffer = this.noiseBuffer;
    const crackHp = this.ctx.createBiquadFilter();
    crackHp.type = 'highpass';
    crackHp.frequency.value = silenced ? 620 : 950;

    const crackShaper = this.ctx.createWaveShaper();
    if (this.saturationCurve) {
      crackShaper.curve = this.saturationCurve;
    }

    const crackLp = this.ctx.createBiquadFilter();
    crackLp.type = 'lowpass';
    const targetCrackHz = silenced ? p.crackHz * 0.42 : p.crackHz;
    crackLp.frequency.setValueAtTime(Math.min(airMaxHz, targetCrackHz), now);
    crackLp.frequency.exponentialRampToValueAtTime(
      Math.max(320, Math.min(airMaxHz, targetCrackHz * 0.32)),
      now + p.crackDur,
    );

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.001, now);
    crackGain.gain.linearRampToValueAtTime(p.crackGain * silenceFactor * atten, now + 0.0018);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + p.crackDur);

    crackNoise.connect(crackHp);
    crackHp.connect(crackShaper);
    crackShaper.connect(crackLp);
    crackLp.connect(crackGain);
    crackGain.connect(this.masterGain);
    crackNoise.start(now, noiseOffset, p.crackDur + 0.015);

    if (!silenced && p.whipDelay > 0 && dist < 85) {
      const whipT = now + p.whipDelay;
      const whip = this.ctx.createBufferSource();
      whip.buffer = this.noiseBuffer;
      const whipBp = this.ctx.createBiquadFilter();
      whipBp.type = 'bandpass';
      whipBp.frequency.value = Math.min(airMaxHz, p.crackHz * 0.85);
      whipBp.Q.value = 1.25;
      const whipGain = this.ctx.createGain();
      whipGain.gain.setValueAtTime(p.crackGain * 0.45 * atten, whipT);
      whipGain.gain.exponentialRampToValueAtTime(0.001, whipT + 0.028);
      whip.connect(whipBp);
      whipBp.connect(whipGain);
      whipGain.connect(this.masterGain);
      whip.start(whipT, (noiseOffset + 0.17) % 0.7, 0.032);
    }

    const bodyNoise = this.ctx.createBufferSource();
    bodyNoise.buffer = this.noiseBuffer;
    const bodyBp = this.ctx.createBiquadFilter();
    bodyBp.type = 'bandpass';
    bodyBp.frequency.setValueAtTime(Math.min(airMaxHz, silenced ? p.bodyHz * 0.7 : p.bodyHz), now);
    bodyBp.Q.value = silenced ? 1.4 : 0.75;

    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(p.bodyGain * (silenced ? 0.48 : 1) * atten, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + p.bodyDur);
    bodyNoise.connect(bodyBp);
    bodyBp.connect(bodyGain);
    bodyGain.connect(this.masterGain);
    bodyNoise.start(now, (noiseOffset + 0.08) % 0.7, p.bodyDur + 0.02);

    const punch = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punch.type = silenced || dist > 45 ? 'triangle' : 'sawtooth';
    punch.frequency.setValueAtTime(p.punchStartHz, now);
    punch.frequency.exponentialRampToValueAtTime(p.punchEndHz, now + p.punchDur);
    punchGain.gain.setValueAtTime(p.punchGain * (silenced ? 0.35 : 1) * atten, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + p.punchDur + 0.01);
    punch.connect(punchGain);
    punchGain.connect(this.masterGain);
    punch.start(now);
    punch.stop(now + p.punchDur + 0.02);

    if (!silenced && dist < 16) {
      const bolt = this.ctx.createOscillator();
      const boltGain = this.ctx.createGain();
      bolt.type = 'triangle';
      bolt.frequency.setValueAtTime(p.boltHz, now);
      bolt.frequency.exponentialRampToValueAtTime(p.boltHz * 0.45, now + 0.012);
      boltGain.gain.setValueAtTime(0.14 * atten, now);
      boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.014);
      bolt.connect(boltGain);
      boltGain.connect(this.masterGain);
      bolt.start(now);
      bolt.stop(now + 0.018);
    }

    const tail = this.ctx.createBufferSource();
    tail.buffer = this.noiseBuffer;
    const tailLp = this.ctx.createBiquadFilter();
    tailLp.type = 'lowpass';
    const tailStart = Math.min(airMaxHz, silenced ? p.tailStartHz * 0.45 : p.tailStartHz);
    tailLp.frequency.setValueAtTime(tailStart, now + 0.01);
    tailLp.frequency.exponentialRampToValueAtTime(220, now + p.tailDur);

    const tailGain = this.ctx.createGain();
    const tailAmp = p.tailGain * (silenced ? 0.3 : 1) * Math.min(1, atten * 1.15);
    tailGain.gain.setValueAtTime(0.001, now);
    tailGain.gain.linearRampToValueAtTime(tailAmp, now + 0.012);
    tailGain.gain.exponentialRampToValueAtTime(0.001, now + p.tailDur);

    tail.connect(tailLp);
    tailLp.connect(tailGain);
    tailGain.connect(this.masterGain);
    tail.start(now, (noiseOffset + 0.25) % 0.65, p.tailDur + 0.02);
  }

  public playReload(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [
      { freq: 340, delay: 0 },
      { freq: 520, delay: 0.14 },
      { freq: 720, delay: 0.3 },
    ].forEach(({ freq, delay }) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + delay;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.045);
    });
  }

  public playEmptyClick(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(950, now);
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public updateRunAudio(
    active: boolean,
    speedRatio: number,
    stance: PlayerStance,
    dt = 0.016,
  ): void {
    if (!active || speedRatio <= 0.04 || this.muted || this.volume <= 0.001) {
      this.stopRunAudio();
      return;
    }
    if (!this.ready() || !this.ctx || !this.masterGain) return;

    const runBuf = this.sfxBuffers.get('run');
    const now = this.ctx.currentTime;

    if (!runBuf) {
      // Fallback footsteps until MP3 finishes decoding
      this.fallbackStepCooldown -= dt;
      if (this.fallbackStepCooldown <= 0) {
        this.fallbackStepCooldown = speedRatio > 0.78 ? 0.31 : 0.45;
        this.playFootstep(speedRatio > 0.78);
      }
      return;
    }

    if (!this.runSource || !this.runGain) {
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.connect(this.masterGain);

      const src = this.ctx.createBufferSource();
      src.buffer = runBuf;
      src.loop = true;
      src.loopStart = 0.085;
      src.loopEnd = Math.min(1.5, runBuf.duration - 0.05);
      src.connect(gain);
      src.start(now, 0.085);

      this.runGain = gain;
      this.runSource = src;
    }

    const clampedSpeed = Math.max(0.2, Math.min(1.1, speedRatio));
    // Analog speed directly scales playback rate of correndo.mp3!
    const rate = Math.max(0.45, Math.min(1.15, 0.45 + clampedSpeed * 0.65));
    const stanceMult = stance === 'prone' ? 0.42 : stance === 'crouch' ? 0.68 : 1.0;
    const targetGain = (1.1 + clampedSpeed * 1.45) * stanceMult;

    this.runSource.playbackRate.setTargetAtTime(rate, now, 0.04);
    this.runGain.gain.setTargetAtTime(targetGain, now, 0.035);
  }

  public stopRunAudio(): void {
    const src = this.runSource;
    const gain = this.runGain;
    this.runSource = null;
    this.runGain = null;
    this.fallbackStepCooldown = 0;
    if (!src || !gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.025);
      src.stop(now + 0.03);
    } catch {
      // already stopped
    }
  }

  public playFootstep(isSprint: boolean): void {
    if (!this.ready() || !this.ctx || !this.masterGain || !this.noiseBuffer) {
      return;
    }
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = isSprint ? 520 : 380;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(isSprint ? 0.12 : 0.075, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    noise.start(now, Math.random() * 0.5, 0.08);
  }

  public playJump(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const jumpBuf = this.sfxBuffers.get('jump');
    if (jumpBuf && jumpBuf.duration > 0.72) {
      const src = this.ctx.createBufferSource();
      src.buffer = jumpBuf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(1.65, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      src.connect(g);
      g.connect(this.masterGain);
      src.start(now, 0.315, 0.43);
      return;
    }

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.09);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playProneDown(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    if (this.stanceSource) {
      try {
        this.stanceSource.stop();
      } catch {
        // ignore
      }
      this.stanceSource = null;
    }
    const buf = this.sfxBuffers.get('proneDown');
    if (!buf) {
      this.playUiClick(340);
      return;
    }
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(2.1, now);
    src.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.02, Math.max(0.1, buf.duration - 0.02));
    this.stanceSource = src;
  }

  public playProneUp(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    if (this.stanceSource) {
      try {
        this.stanceSource.stop();
      } catch {
        // ignore
      }
      this.stanceSource = null;
    }
    const buf = this.sfxBuffers.get('proneUp');
    if (!buf) {
      this.playUiClick(460);
      return;
    }
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(2.6, now);
    src.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.165, Math.max(0.1, buf.duration - 0.165));
    this.stanceSource = src;
  }

  public playBackpackOpen(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const buf = this.sfxBuffers.get('backpack');
    if (!buf) {
      this.playUiClick(580);
      return;
    }
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(1.45, now);
    src.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.485, 0.56);
  }

  public startMedkitAudio(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    this.stopMedkitAudio();
    const buf = this.sfxBuffers.get('medkit');
    if (!buf) {
      this.playUiClick(640);
      return;
    }
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(2.55, now);
    src.connect(g);
    g.connect(this.masterGain);
    src.onended = () => {
      if (this.medkitSource === src) {
        this.medkitSource = null;
        this.medkitGain = null;
        this.medkitActive = false;
      }
    };
    src.start(now, 0.0);
    this.medkitSource = src;
    this.medkitGain = g;
    this.medkitActive = true;
  }

  public stopMedkitAudio(): void {
    const src = this.medkitSource;
    const gain = this.medkitGain;
    this.medkitSource = null;
    this.medkitGain = null;
    this.medkitActive = false;
    if (!src || !gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.04);
      src.stop(now + 0.045);
    } catch {
      // ignore
    }
  }

  public completeMedkitAudio(): void {
    // Let the final 4.0s..5.0s healing chime in usando-kit-medico.mp3 play cleanly
    if (this.medkitActive) {
      this.medkitActive = false;
      return;
    }
    this.playHeal();
  }

  public playHitmarker(isHeadshot = false): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (isHeadshot) {
      this.preloadAllBuffers();
      const headBuf = this.sfxBuffers.get('headshot');
      if (headBuf) {
        const src = this.ctx.createBufferSource();
        src.buffer = headBuf;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(1.18, now);
        src.connect(g);
        g.connect(this.masterGain);
        const offset = headBuf.duration > 0.12 ? 0.042 : 0;
        src.start(now, offset);
        return;
      }

      // Crisp metallic "tic" synth fallback before head.mp3 finishes decoding
      const tic = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      tic.type = 'triangle';
      tic.frequency.setValueAtTime(2750, now);
      tic.frequency.exponentialRampToValueAtTime(1320, now + 0.036);
      tg.gain.setValueAtTime(0.32, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      tic.connect(tg);
      tg.connect(this.masterGain);
      tic.start(now);
      tic.stop(now + 0.05);
      return;
    }

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1250, now);
    osc.frequency.exponentialRampToValueAtTime(820, now + 0.05);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playDamage(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.16);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playParachuteOpen(): void {
    if (!this.ready() || !this.ctx || !this.masterGain || !this.noiseBuffer) {
      return;
    }
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    noise.start(now, 0, 0.38);
  }

  public playPickup(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const pickupBuf = this.sfxBuffers.get('pickupItem');
    const now = this.ctx.currentTime;
    if (pickupBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = pickupBuf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(1.55, now);
      src.connect(g);
      g.connect(this.masterGain);
      src.start(now, 0, Math.min(0.65, pickupBuf.duration));
      return;
    }
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.08);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playHeal(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [440, 587, 784].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  public playKillSound(isHeadshot = false): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    this.preloadAllBuffers();

    const killBuf = this.sfxBuffers.get('kill');
    if (killBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = killBuf;
      const g = this.ctx.createGain();
      g.gain.value = isHeadshot ? 1.0 : 0.92;
      src.connect(g);
      g.connect(this.masterGain);
      // Trim 0.775s leading silence so kill SFX fires instantaneously
      const offset = killBuf.duration > 1.0 ? 0.775 : 0;
      src.start(this.ctx.currentTime, offset);
      return;
    }

    const now = this.ctx.currentTime;
    const bass = this.ctx.createOscillator();
    const bassG = this.ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(160, now);
    bass.frequency.exponentialRampToValueAtTime(48, now + 0.22);
    bassG.gain.setValueAtTime(0.36, now);
    bassG.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    bass.connect(bassG);
    bassG.connect(this.masterGain);
    bass.start(now);
    bass.stop(now + 0.25);

    const notes = isHeadshot ? [740, 988, 1480] : [587, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = isHeadshot ? 'triangle' : 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(isHeadshot ? 0.24 : 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playWeaponSwitch(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [390, 620].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.038;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.045);
    });
  }

  public playLanding(): void {
    if (!this.ready() || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const jumpBuf = this.sfxBuffers.get('jump');
    if (jumpBuf && jumpBuf.duration > 1.3) {
      const src = this.ctx.createBufferSource();
      src.buffer = jumpBuf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(1.25, now);
      src.connect(g);
      g.connect(this.masterGain);
      src.start(now, 0.895, 0.48);
      return;
    }

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);

    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 540;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.18, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    n.connect(f);
    f.connect(ng);
    ng.connect(this.masterGain);
    n.start(now, 0, 0.14);
  }

  public playGlooDeploy(): void {
    if (!this.ready() || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const glooBuf = this.sfxBuffers.get('gloo');
    if (glooBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = glooBuf;
      const g = this.ctx.createGain();
      const offset = glooBuf.duration > 0.9 ? 0.525 : 0;
      const dur = Math.max(0.12, Math.min(0.62, glooBuf.duration - offset));
      g.gain.setValueAtTime(6.8, now);
      g.gain.setValueAtTime(6.8, now + Math.max(0.05, dur - 0.14));
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      src.connect(g);
      g.connect(this.masterGain);
      src.start(now, offset, dur + 0.02);
      return;
    }

    const thud = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(150, now);
    thud.frequency.exponentialRampToValueAtTime(52, now + 0.18);
    tg.gain.setValueAtTime(0.32, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    thud.connect(tg);
    tg.connect(this.masterGain);
    thud.start(now);
    thud.stop(now + 0.21);

    [980, 1380].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const c = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      c.type = 'triangle';
      const t = now + i * 0.04;
      c.frequency.setValueAtTime(freq, t);
      c.frequency.exponentialRampToValueAtTime(freq * 1.15, t + 0.12);
      cg.gain.setValueAtTime(0.14, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      c.connect(cg);
      cg.connect(this.masterGain);
      c.start(t);
      c.stop(t + 0.15);
    });
  }

  public playSafeZoneDamage(isStrong: boolean): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const nowMs = performance.now();
    if (nowMs - this.lastSafeDmgAudioMs < 820) return;
    this.lastSafeDmgAudioMs = nowMs;

    const now = this.ctx.currentTime;
    let buf: AudioBuffer | undefined;
    let offset = 0;
    let dur = 0.42;
    let peakGain = 6.8;

    if (!isStrong) {
      buf = this.sfxBuffers.get('safeWeak');
      offset = 0.46;
      dur = 0.42;
      peakGain = 7.5;
    } else if (Math.random() < 0.5) {
      buf = this.sfxBuffers.get('safeStrong1') || this.sfxBuffers.get('safeStrong2');
      offset = 0.08;
      dur = 0.58;
      peakGain = 6.5;
    } else {
      buf = this.sfxBuffers.get('safeStrong2') || this.sfxBuffers.get('safeStrong1');
      offset = 0.44;
      dur = 0.45;
      peakGain = 6.8;
    }

    if (buf) {
      const safeOff = buf.duration > offset + 0.08 ? offset : 0;
      const safeDur = Math.max(0.08, Math.min(dur, buf.duration - safeOff));
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(peakGain, now);
      g.gain.setValueAtTime(peakGain, now + Math.max(0.04, safeDur - 0.1));
      g.gain.exponentialRampToValueAtTime(0.001, now + safeDur);
      src.connect(g);
      g.connect(this.masterGain);
      src.start(now, safeOff, safeDur + 0.02);
      return;
    }

    // Synth fallback if safe zone MP3s are still loading
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = isStrong ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isStrong ? 210 : 145, now);
    osc.frequency.exponentialRampToValueAtTime(isStrong ? 72 : 68, now + 0.22);
    g.gain.setValueAtTime(isStrong ? 0.3 : 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playGrenadePin(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1420, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.04);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playGrenadeThrow(): void {
    if (!this.ready() || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(620, now);
    f.frequency.exponentialRampToValueAtTime(240, now + 0.18);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.24, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    n.connect(f);
    f.connect(ng);
    ng.connect(this.masterGain);
    n.start(now, 0, 0.21);
  }

  public playExplosion(): void {
    if (!this.ready() || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const boom = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(105, now);
    boom.frequency.exponentialRampToValueAtTime(22, now + 0.48);
    bg.gain.setValueAtTime(0.72, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    boom.connect(bg);
    bg.connect(this.masterGain);
    boom.start(now);
    boom.stop(now + 0.54);

    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1600, now);
    f.frequency.exponentialRampToValueAtTime(190, now + 0.55);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.65, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    n.connect(f);
    f.connect(ng);
    ng.connect(this.masterGain);
    n.start(now, 0, 0.6);
  }

  public setFlightAudioMode(mode: FlightAudioMode): void {
    if (this.flightMode === mode && mode === 'none') return;
    this.flightMode = mode;
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    if (this.ctx.state !== 'running') return;

    if (!this.ambientGain && mode !== 'none') {
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = this.noiseBuffer;
      noiseSrc.loop = true;

      this.ambientFilter = this.ctx.createBiquadFilter();
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.value = 340;

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0;

      noiseSrc.connect(this.ambientFilter);
      this.ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);
      noiseSrc.start();

      // Airplane low prop engine rumble
      const propOsc = this.ctx.createOscillator();
      propOsc.type = 'sawtooth';
      propOsc.frequency.value = 54;
      const propFilter = this.ctx.createBiquadFilter();
      propFilter.type = 'lowpass';
      propFilter.frequency.value = 140;
      this.propGain = this.ctx.createGain();
      this.propGain.gain.value = 0;
      propOsc.connect(propFilter);
      propFilter.connect(this.propGain);
      this.propGain.connect(this.masterGain);
      propOsc.start();
    }

    if (!this.ambientGain || !this.ambientFilter || !this.propGain) return;
    const now = this.ctx.currentTime;
    if (mode === 'airplane') {
      this.ambientFilter.frequency.setTargetAtTime(260, now, 0.12);
      this.ambientGain.gain.setTargetAtTime(0.13, now, 0.12);
      this.propGain.gain.setTargetAtTime(0.11, now, 0.12);
    } else if (mode === 'skydiving') {
      this.ambientFilter.frequency.setTargetAtTime(760, now, 0.12);
      this.ambientGain.gain.setTargetAtTime(0.19, now, 0.12);
      this.propGain.gain.setTargetAtTime(0.0, now, 0.1);
    } else if (mode === 'parachute') {
      this.ambientFilter.frequency.setTargetAtTime(360, now, 0.12);
      this.ambientGain.gain.setTargetAtTime(0.08, now, 0.12);
      this.propGain.gain.setTargetAtTime(0.0, now, 0.1);
    } else {
      this.ambientGain.gain.setTargetAtTime(0.0, now, 0.08);
      this.propGain.gain.setTargetAtTime(0.0, now, 0.08);
    }
  }

  public playCoinPickup(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [987.77, 1318.5].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public playShopBuy(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [587.3, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.05;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  public playVehicleEnter(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(68, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(86, now + 0.34);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public updateVehicleEngineAudio(active: boolean, speedRatio: number): void {
    if (!active || this.muted || this.volume <= 0.001) {
      this.stopVehicleAudio();
      return;
    }
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    if (!this.vehicleOsc || !this.vehicleSubOsc || !this.vehicleGain || !this.vehicleFilter) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 46;

      const sub = this.ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.value = 23;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.001;

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      sub.start();

      this.vehicleOsc = osc;
      this.vehicleSubOsc = sub;
      this.vehicleFilter = filter;
      this.vehicleGain = gain;
    }

    const r = Math.max(0, Math.min(1.2, speedRatio));
    const baseHz = 44 + r * 68;
    this.vehicleOsc.frequency.setTargetAtTime(baseHz, now, 0.06);
    this.vehicleSubOsc.frequency.setTargetAtTime(baseHz * 0.5, now, 0.06);
    this.vehicleFilter.frequency.setTargetAtTime(175 + r * 360, now, 0.07);
    this.vehicleGain.gain.setTargetAtTime(0.08 + r * 0.11, now, 0.06);
  }

  public stopVehicleAudio(): void {
    const osc = this.vehicleOsc;
    const sub = this.vehicleSubOsc;
    const gain = this.vehicleGain;
    this.vehicleOsc = null;
    this.vehicleSubOsc = null;
    this.vehicleGain = null;
    this.vehicleFilter = null;
    if (!osc || !sub || !gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.02);
      osc.stop(now + 0.06);
      sub.stop(now + 0.06);
    } catch {
      // ignore
    }
  }

  public playVehicleCrash(intensity = 0.6): void {
    if (!this.ready() || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.15, Math.min(1.0, intensity));
    const thud = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(98, now);
    thud.frequency.exponentialRampToValueAtTime(32, now + 0.18);
    tg.gain.setValueAtTime(0.32 * clamped, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    thud.connect(tg);
    tg.connect(this.masterGain);
    thud.start(now);
    thud.stop(now + 0.22);

    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 640;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.24 * clamped, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    n.connect(f);
    f.connect(ng);
    ng.connect(this.masterGain);
    n.start(now, 0, 0.18);
  }

  public playRunOver(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playPunchSwing(): void {
    if (!this.ready() || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(520, now);
    f.frequency.exponentialRampToValueAtTime(190, now + 0.12);
    f.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    n.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    n.start(now, Math.random() * 0.4, 0.15);
  }

  public playPunchHit(isHead = false): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    if (isHead) {
      this.playHitmarker(true);
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHead ? 185 : 135, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.11);
    g.gain.setValueAtTime(isHead ? 0.48 : 0.38, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }
}

export const soundEngine = new SoundEngine();
