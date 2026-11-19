import {
  CHARACTER_PRESETS,
  CharacterConfig,
  DEFAULT_HUD_LAYOUT,
  GameSettings,
  HudElementId,
  HudLayoutConfig,
  PlayerProfile,
} from './types';

const SETTINGS_KEY = 'zonazero2017_settings_v2';
const HUD_LAYOUT_KEY = 'zonazero2017_hud_layout_v1';
const CHARACTER_KEY = 'zonazero2017_character_v1';
const PROFILE_KEY = 'zonazero2017_profile_v1';

export function isMobileHardware(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const touch =
    'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 820;
  return mobileUa || coarse || (touch && smallScreen);
}

export const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1.0,
  redDotSensitivity: 0.95,
  scope2xSensitivity: 0.85,
  scope4xSensitivity: 0.72,
  sniperSensitivity: 0.62,
  aimAssistMode: 'default',
  quality: isMobileHardware() ? 'low' : 'medium',
  soundVolume: 0.75,
  muted: false,
  showFps: true,
  controlMode: 'auto',
  invertY: false,
  hudLayout: structuredCloneLayout(DEFAULT_HUD_LAYOUT),
};

export function structuredCloneLayout(
  src?: Partial<HudLayoutConfig> | null,
): HudLayoutConfig {
  const out = {} as HudLayoutConfig;
  (Object.keys(DEFAULT_HUD_LAYOUT) as HudElementId[]).forEach((k) => {
    const base = DEFAULT_HUD_LAYOUT[k];
    const item = src?.[k];
    const xPct =
      typeof item?.xPct === 'number' && Number.isFinite(item.xPct)
        ? Math.max(2, Math.min(98, item.xPct))
        : base.xPct;
    const yPct =
      typeof item?.yPct === 'number' && Number.isFinite(item.yPct)
        ? Math.max(3, Math.min(97, item.yPct))
        : base.yPct;
    const scale =
      typeof item?.scale === 'number' && Number.isFinite(item.scale)
        ? Math.max(0.4, Math.min(2.0, item.scale))
        : base.scale;
    const opacity =
      typeof item?.opacity === 'number' && Number.isFinite(item.opacity)
        ? Math.max(0.1, Math.min(1.0, item.opacity))
        : base.opacity;
    out[k] = { xPct, yPct, scale, opacity };
  });
  return out;
}

export function loadHudLayout(): HudLayoutConfig | null {
  try {
    const raw = localStorage.getItem(HUD_LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HudLayoutConfig>;
    return structuredCloneLayout(parsed);
  } catch {
    return null;
  }
}

export function saveHudLayout(layout: HudLayoutConfig): void {
  try {
    localStorage.setItem(
      HUD_LAYOUT_KEY,
      JSON.stringify(structuredCloneLayout(layout)),
    );
  } catch {
    // Ignore quota errors
  }
}

export function loadSettings(): GameSettings {
  const dedicatedHud = loadHudLayout();
  try {
    const raw =
      localStorage.getItem(SETTINGS_KEY) ||
      localStorage.getItem('zonazero2017_settings_v1');
    if (!raw) {
      return {
        ...DEFAULT_SETTINGS,
        hudLayout: dedicatedHud ?? structuredCloneLayout(DEFAULT_HUD_LAYOUT),
      };
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      hudLayout:
        dedicatedHud ??
        structuredCloneLayout(parsed.hudLayout ?? DEFAULT_HUD_LAYOUT),
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      hudLayout: dedicatedHud ?? structuredCloneLayout(DEFAULT_HUD_LAYOUT),
    };
  }
}

export function saveSettings(settings: GameSettings): void {
  saveHudLayout(settings.hudLayout);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}

export function loadCharacterConfig(): CharacterConfig {
  try {
    const raw = localStorage.getItem(CHARACTER_KEY);
    if (!raw) return { ...CHARACTER_PRESETS[0] };
    const parsed = JSON.parse(raw) as Partial<CharacterConfig>;
    return { ...CHARACTER_PRESETS[0], ...parsed };
  } catch {
    return { ...CHARACTER_PRESETS[0] };
  }
}

export function saveCharacterConfig(config: CharacterConfig): void {
  try {
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(config));
  } catch {
    // Ignore quota errors
  }
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore quota errors
  }
}

export const DEFAULT_PROFILE: PlayerProfile = {
  nickname: 'Sobrevivente_17',
  level: 1,
  gold: 1250,
  gems: 100,
  matchesPlayed: 0,
  wins: 0,
  rankPoints: 1000,
  rankedMatches: 0,
  rankedWins: 0,
  totalKills: 0,
};
