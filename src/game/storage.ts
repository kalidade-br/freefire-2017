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
const CHARACTER_KEY = 'zonazero2017_character_v1';
const PROFILE_KEY = 'zonazero2017_profile_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1.0,
  redDotSensitivity: 0.95,
  scope2xSensitivity: 0.85,
  scope4xSensitivity: 0.72,
  sniperSensitivity: 0.62,
  aimAssistMode: 'default',
  quality: 'medium',
  soundVolume: 0.75,
  muted: false,
  showFps: true,
  controlMode: 'auto',
  invertY: false,
  hudLayout: structuredCloneLayout(DEFAULT_HUD_LAYOUT),
};

export function structuredCloneLayout(src: HudLayoutConfig): HudLayoutConfig {
  const out = {} as HudLayoutConfig;
  (Object.keys(DEFAULT_HUD_LAYOUT) as HudElementId[]).forEach((k) => {
    out[k] = { ...DEFAULT_HUD_LAYOUT[k], ...(src[k] ?? {}) };
  });
  return out;
}

export function loadSettings(): GameSettings {
  try {
    const raw =
      localStorage.getItem(SETTINGS_KEY) ||
      localStorage.getItem('zonazero2017_settings_v1');
    if (!raw) {
      return {
        ...DEFAULT_SETTINGS,
        hudLayout: structuredCloneLayout(DEFAULT_HUD_LAYOUT),
      };
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      hudLayout: structuredCloneLayout(
        parsed.hudLayout ?? DEFAULT_HUD_LAYOUT,
      ),
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      hudLayout: structuredCloneLayout(DEFAULT_HUD_LAYOUT),
    };
  }
}

export function saveSettings(settings: GameSettings): void {
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
};
