import {
  CHARACTER_PRESETS,
  CharacterConfig,
  DEFAULT_HUD_LAYOUT,
  DEFAULT_HUD_LAYOUT_SLOT_2,
  DEFAULT_KEY_BINDINGS,
  GameSettings,
  getCharacterPresetByModelId,
  GraphicsQuality,
  HudElementId,
  HudLayoutConfig,
  HudSlotId,
  KeyBindAction,
  KeyBindingsConfig,
  normalizeCharacterModelId,
  PlayerProfile,
  ShadowQuality,
  TextureQuality,
} from './types';

export function normalizeKeyBindings(
  src?: Partial<KeyBindingsConfig> | null,
): KeyBindingsConfig {
  const out = { ...DEFAULT_KEY_BINDINGS };
  if (!src) return out;
  (Object.keys(DEFAULT_KEY_BINDINGS) as KeyBindAction[]).forEach((action) => {
    const val = src[action];
    if (typeof val === 'string' && val.trim().length > 0 && val !== 'Escape') {
      out[action] = val;
    }
  });
  return out;
}

export function defaultTextureForQuality(q: GraphicsQuality): TextureQuality {
  if (q === 'low') return 'low';
  if (q === 'high') return 'ultra';
  return 'medium';
}

export function defaultShadowForQuality(q: GraphicsQuality): ShadowQuality {
  if (q === 'low') return 'off';
  if (q === 'high') return 'high';
  return 'low';
}

const SETTINGS_KEY = 'zonazero2017_settings_v2';
const HUD_LAYOUT_KEY = 'zonazero2017_hud_layout_v1';
const HUD_SLOTS_KEY = 'zonazero2017_hud_slots_v1';
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
  textureQuality: isMobileHardware() ? 'low' : 'medium',
  shadowQuality: isMobileHardware() ? 'off' : 'low',
  soundVolume: 0.75,
  muted: false,
  showFps: true,
  controlMode: 'auto',
  invertY: false,
  autoLoot: true,
  autoLootSpeed: 'fast',
  emulatorMode: false,
  aimToggleMode: false,
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
  hudLayout: structuredCloneLayout(DEFAULT_HUD_LAYOUT),
  activeHudSlot: 1,
  hudSlots: {
    1: structuredCloneLayout(DEFAULT_HUD_LAYOUT),
    2: structuredCloneLayout(DEFAULT_HUD_LAYOUT_SLOT_2, DEFAULT_HUD_LAYOUT_SLOT_2),
  },
};

export function structuredCloneLayout(
  src?: Partial<HudLayoutConfig> | null,
  fallbackBase: HudLayoutConfig = DEFAULT_HUD_LAYOUT,
): HudLayoutConfig {
  const out = {} as HudLayoutConfig;
  (Object.keys(fallbackBase) as HudElementId[]).forEach((k) => {
    const base = fallbackBase[k];
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

export function loadHudSlots(legacySlot1?: HudLayoutConfig | null): {
  activeSlot: HudSlotId;
  slots: Record<HudSlotId, HudLayoutConfig>;
} {
  const fallbackSlots: Record<HudSlotId, HudLayoutConfig> = {
    1: structuredCloneLayout(legacySlot1 ?? DEFAULT_HUD_LAYOUT, DEFAULT_HUD_LAYOUT),
    2: structuredCloneLayout(DEFAULT_HUD_LAYOUT_SLOT_2, DEFAULT_HUD_LAYOUT_SLOT_2),
  };
  try {
    const raw = localStorage.getItem(HUD_SLOTS_KEY);
    if (!raw) return { activeSlot: 1, slots: fallbackSlots };
    const parsed = JSON.parse(raw) as {
      activeSlot?: HudSlotId;
      slots?: Partial<Record<'1' | '2', Partial<HudLayoutConfig>>>;
    };
    const activeSlot: HudSlotId = parsed.activeSlot === 2 ? 2 : 1;
    return {
      activeSlot,
      slots: {
        1: structuredCloneLayout(parsed.slots?.['1'] ?? fallbackSlots[1], DEFAULT_HUD_LAYOUT),
        2: structuredCloneLayout(
          parsed.slots?.['2'] ?? DEFAULT_HUD_LAYOUT_SLOT_2,
          DEFAULT_HUD_LAYOUT_SLOT_2,
        ),
      },
    };
  } catch {
    return { activeSlot: 1, slots: fallbackSlots };
  }
}

export function saveHudSlots(
  activeSlot: HudSlotId,
  slots: Record<HudSlotId, HudLayoutConfig>,
): void {
  try {
    localStorage.setItem(
      HUD_SLOTS_KEY,
      JSON.stringify({
        activeSlot,
        slots: {
          1: structuredCloneLayout(slots[1], DEFAULT_HUD_LAYOUT),
          2: structuredCloneLayout(slots[2], DEFAULT_HUD_LAYOUT_SLOT_2),
        },
      }),
    );
  } catch {
    // Ignore quota errors
  }
}

export function loadSettings(): GameSettings {
  const dedicatedHud = loadHudLayout();
  const savedSlots = loadHudSlots(dedicatedHud);
  try {
    const raw =
      localStorage.getItem(SETTINGS_KEY) ||
      localStorage.getItem('zonazero2017_settings_v1');
    if (!raw) {
      return {
        ...DEFAULT_SETTINGS,
        activeHudSlot: savedSlots.activeSlot,
        hudSlots: savedSlots.slots,
        hudLayout: savedSlots.slots[savedSlots.activeSlot],
      };
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const activeHudSlot: HudSlotId = parsed.activeHudSlot === 2 ? 2 : savedSlots.activeSlot;
    const hudSlots: Record<HudSlotId, HudLayoutConfig> = {
      1: structuredCloneLayout(
        parsed.hudSlots?.[1] ?? savedSlots.slots[1],
        DEFAULT_HUD_LAYOUT,
      ),
      2: structuredCloneLayout(
        parsed.hudSlots?.[2] ?? savedSlots.slots[2],
        DEFAULT_HUD_LAYOUT_SLOT_2,
      ),
    };
    const activeLayout =
      dedicatedHud ??
      structuredCloneLayout(
        parsed.hudLayout ?? hudSlots[activeHudSlot],
        activeHudSlot === 2 ? DEFAULT_HUD_LAYOUT_SLOT_2 : DEFAULT_HUD_LAYOUT,
      );
    const resolvedQuality: GraphicsQuality =
      parsed.quality === 'low' || parsed.quality === 'high' ? parsed.quality : 'medium';
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      quality: parsed.quality ?? DEFAULT_SETTINGS.quality,
      textureQuality:
        parsed.textureQuality ?? defaultTextureForQuality(parsed.quality ?? resolvedQuality),
      shadowQuality:
        parsed.shadowQuality ?? defaultShadowForQuality(parsed.quality ?? resolvedQuality),
      emulatorMode: Boolean(parsed.emulatorMode),
      aimToggleMode: Boolean(parsed.aimToggleMode),
      keyBindings: normalizeKeyBindings(parsed.keyBindings),
      activeHudSlot,
      hudSlots,
      hudLayout: activeLayout,
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      activeHudSlot: savedSlots.activeSlot,
      hudSlots: savedSlots.slots,
      hudLayout: savedSlots.slots[savedSlots.activeSlot],
    };
  }
}

export function saveSettings(settings: GameSettings): void {
  const activeSlot: HudSlotId = settings.activeHudSlot === 2 ? 2 : 1;
  const slots: Record<HudSlotId, HudLayoutConfig> = {
    1: structuredCloneLayout(
      activeSlot === 1 ? settings.hudLayout : (settings.hudSlots?.[1] ?? DEFAULT_HUD_LAYOUT),
      DEFAULT_HUD_LAYOUT,
    ),
    2: structuredCloneLayout(
      activeSlot === 2
        ? settings.hudLayout
        : (settings.hudSlots?.[2] ?? DEFAULT_HUD_LAYOUT_SLOT_2),
      DEFAULT_HUD_LAYOUT_SLOT_2,
    ),
  };
  saveHudLayout(settings.hudLayout);
  saveHudSlots(activeSlot, slots);
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...settings, activeHudSlot: activeSlot, hudSlots: slots }),
    );
  } catch {
    // Ignore quota errors
  }
}

export function loadCharacterConfig(): CharacterConfig {
  try {
    const raw = localStorage.getItem(CHARACTER_KEY);
    if (!raw) return { ...CHARACTER_PRESETS[0] };
    const parsed = JSON.parse(raw) as Partial<CharacterConfig>;
    const modelId = normalizeCharacterModelId(parsed.modelId);
    const glooSkin = parsed.glooSkin === 'ffwc' ? 'ffwc' : 'classic';
    const base = getCharacterPresetByModelId(modelId);
    return {
      ...base,
      backpackEnabled: parsed.backpackEnabled ?? true,
      vestEnabled: false,
      modelId,
      glooSkin,
    };
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
