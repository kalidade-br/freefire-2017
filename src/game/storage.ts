import {
  CHARACTER_PRESETS,
  CharacterConfig,
  DEFAULT_GG_MOUSE_PRO,
  DEFAULT_HUD_LAYOUT,
  DEFAULT_HUD_LAYOUT_SLOT_2,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_MACROS,
  GameSettings,
  getCharacterPresetByModelId,
  GgKeyPinId,
  GgMouseProConfig,
  GgOverlayPinConfig,
  GraphicsQuality,
  HudElementId,
  HudLayoutConfig,
  HudSlotId,
  KeyBindAction,
  KeyBindingsConfig,
  MACRO_ACTION_META,
  MacroConfig,
  MacroStep,
  MacroStepAction,
  NetworkSyncPreset,
  normalizeCharacterModelId,
  normalizeLobbyMusicTrack,
  PlayerProfile,
  sanitizeEquippedSkins,
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
    if (action === 'quickGlooInstant') {
      out[action] = typeof val === 'string' && val !== 'Escape' ? val.trim() : '';
      return;
    }
    if (typeof val === 'string' && val.trim().length > 0 && val !== 'Escape') {
      out[action] = val;
    }
  });
  return out;
}

export function normalizeMacros(src?: MacroConfig[] | null): MacroConfig[] {
  if (!Array.isArray(src)) {
    return DEFAULT_MACROS.map((m) => ({
      ...m,
      steps: m.steps.map((s) => ({ ...s })),
    }));
  }
  return src
    .filter((m) => m && typeof m.id === 'string')
    .slice(0, 24)
    .map((m, idx) => {
      const steps: MacroStep[] = Array.isArray(m.steps)
        ? m.steps
            .filter((s) => s && typeof s.action === 'string' && s.action in MACRO_ACTION_META)
            .slice(0, 24)
            .map((s, sIdx) => ({
              id: typeof s.id === 'string' && s.id ? s.id : `step_${idx}_${sIdx}`,
              action: s.action as MacroStepAction,
              delayMs:
                typeof s.delayMs === 'number' && Number.isFinite(s.delayMs)
                  ? Math.max(0, Math.min(2000, Math.round(s.delayMs)))
                  : 30,
            }))
        : [];
      return {
        id: m.id,
        name: typeof m.name === 'string' && m.name.trim() ? m.name.trim().slice(0, 40) : `Macro ${idx + 1}`,
        emoji: typeof m.emoji === 'string' && m.emoji.trim() ? m.emoji.trim().slice(0, 6) : '⚡',
        triggerKey: typeof m.triggerKey === 'string' && m.triggerKey !== 'Escape' ? m.triggerKey.trim() : '',
        showFloatingBtn: Boolean(m.showFloatingBtn),
        enabled: m.enabled !== false,
        xPct:
          typeof m.xPct === 'number' && Number.isFinite(m.xPct)
            ? Math.max(3, Math.min(97, m.xPct))
            : 62,
        yPct:
          typeof m.yPct === 'number' && Number.isFinite(m.yPct)
            ? Math.max(4, Math.min(96, m.yPct))
            : 72,
        scale:
          typeof m.scale === 'number' && Number.isFinite(m.scale)
            ? Math.max(0.5, Math.min(2.0, m.scale))
            : 1.0,
        opacity:
          typeof m.opacity === 'number' && Number.isFinite(m.opacity)
            ? Math.max(0.15, Math.min(1.0, m.opacity))
            : 0.92,
        steps,
      };
    });
}

export function normalizeGgMousePro(
  src?: Partial<GgMouseProConfig> | null,
): GgMouseProConfig {
  const pins = {} as Record<GgKeyPinId, GgOverlayPinConfig>;
  (Object.keys(DEFAULT_GG_MOUSE_PRO.pins) as GgKeyPinId[]).forEach((pinId) => {
    const base = DEFAULT_GG_MOUSE_PRO.pins[pinId];
    const item = src?.pins?.[pinId];
    pins[pinId] = {
      xPct:
        typeof item?.xPct === 'number' && Number.isFinite(item.xPct)
          ? Math.max(2, Math.min(98, item.xPct))
          : base.xPct,
      yPct:
        typeof item?.yPct === 'number' && Number.isFinite(item.yPct)
          ? Math.max(3, Math.min(97, item.yPct))
          : base.yPct,
      scale:
        typeof item?.scale === 'number' && Number.isFinite(item.scale)
          ? Math.max(0.5, Math.min(1.8, item.scale))
          : base.scale,
      visible: typeof item?.visible === 'boolean' ? item.visible : base.visible,
    };
  });
  return {
    enabled: typeof src?.enabled === 'boolean' ? src.enabled : DEFAULT_GG_MOUSE_PRO.enabled,
    showKeyBadges:
      typeof src?.showKeyBadges === 'boolean'
        ? src.showKeyBadges
        : DEFAULT_GG_MOUSE_PRO.showKeyBadges,
    badgeOpacity:
      typeof src?.badgeOpacity === 'number' && Number.isFinite(src.badgeOpacity)
        ? Math.max(0.2, Math.min(1.0, src.badgeOpacity))
        : DEFAULT_GG_MOUSE_PRO.badgeOpacity,
    aimDragBoost:
      typeof src?.aimDragBoost === 'number' && Number.isFinite(src.aimDragBoost)
        ? Math.max(0.5, Math.min(2.5, src.aimDragBoost))
        : DEFAULT_GG_MOUSE_PRO.aimDragBoost,
    turboTouch:
      typeof src?.turboTouch === 'boolean' ? src.turboTouch : DEFAULT_GG_MOUSE_PRO.turboTouch,
    instantQuickGloo:
      typeof src?.instantQuickGloo === 'boolean'
        ? src.instantQuickGloo
        : DEFAULT_GG_MOUSE_PRO.instantQuickGloo,
    pins,
  };
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

export function defaultResolutionForQuality(q: GraphicsQuality): number {
  if (q === 'low') return 55;
  if (q === 'high') return 100;
  return 80;
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
  resolutionScale: isMobileHardware() ? 60 : 85,
  textureQuality: isMobileHardware() ? 'low' : 'medium',
  shadowQuality: isMobileHardware() ? 'off' : 'low',
  soundVolume: 0.75,
  muted: false,
  lobbyMusicTrack: 'natal_2018',
  showFps: true,
  controlMode: 'auto',
  invertY: false,
  autoLoot: true,
  autoLootSpeed: 'fast',
  emulatorMode: false,
  aimToggleMode: false,
  networkSyncPreset: 'fast',
  networkLowLatency: true,
  networkHighPingSmoothing: true,
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
  macros: normalizeMacros(null),
  ggMousePro: normalizeGgMousePro(null),
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

const HUD_KILLFEED_BOTTOM_MIGRATED_KEY = 'zonazero2017_killfeed_bottom_v1';
const HUD_FPS_TOP_MIGRATED_KEY = 'zonazero2017_fps_top_v1';

function migrateLegacyKillFeedLayout(
  layout: HudLayoutConfig,
  fallbackBase: HudLayoutConfig,
): HudLayoutConfig {
  if (
    layout.killFeed &&
    Math.abs(layout.killFeed.xPct - 50) < 0.25 &&
    Math.abs(layout.killFeed.yPct - 17.5) < 0.25
  ) {
    return {
      ...layout,
      killFeed: {
        ...layout.killFeed,
        yPct: fallbackBase.killFeed.yPct,
      },
    };
  }
  return layout;
}

function migrateLegacyFpsBadgeLayout(
  layout: HudLayoutConfig,
  fallbackBase: HudLayoutConfig,
): HudLayoutConfig {
  if (
    layout.fpsBadge &&
    Math.abs(layout.fpsBadge.xPct - 4.5) < 0.5 &&
    Math.abs(layout.fpsBadge.yPct - 96) < 0.5
  ) {
    return {
      ...layout,
      fpsBadge: {
        ...layout.fpsBadge,
        xPct: fallbackBase.fpsBadge.xPct,
        yPct: fallbackBase.fpsBadge.yPct,
      },
    };
  }
  return layout;
}

export function loadSettings(): GameSettings {
  const dedicatedHud = loadHudLayout();
  const savedSlots = loadHudSlots(dedicatedHud);
  let needsKillFeedMigration = false;
  let needsFpsTopMigration = false;
  try {
    needsKillFeedMigration = localStorage.getItem(HUD_KILLFEED_BOTTOM_MIGRATED_KEY) !== '1';
    needsFpsTopMigration = localStorage.getItem(HUD_FPS_TOP_MIGRATED_KEY) !== '1';
  } catch {
    needsKillFeedMigration = false;
    needsFpsTopMigration = false;
  }

  const applyMigration = (
    slot1: HudLayoutConfig,
    slot2: HudLayoutConfig,
    active: HudLayoutConfig,
  ) => {
    if (!needsKillFeedMigration && !needsFpsTopMigration) {
      return { slot1, slot2, active };
    }
    let next1 = slot1;
    let next2 = slot2;
    let nextActive = active;
    if (needsKillFeedMigration) {
      next1 = migrateLegacyKillFeedLayout(next1, DEFAULT_HUD_LAYOUT);
      next2 = migrateLegacyKillFeedLayout(next2, DEFAULT_HUD_LAYOUT_SLOT_2);
      nextActive = migrateLegacyKillFeedLayout(nextActive, DEFAULT_HUD_LAYOUT);
    }
    if (needsFpsTopMigration) {
      next1 = migrateLegacyFpsBadgeLayout(next1, DEFAULT_HUD_LAYOUT);
      next2 = migrateLegacyFpsBadgeLayout(next2, DEFAULT_HUD_LAYOUT_SLOT_2);
      nextActive = migrateLegacyFpsBadgeLayout(nextActive, DEFAULT_HUD_LAYOUT);
    }
    try {
      saveHudLayout(nextActive);
      saveHudSlots(savedSlots.activeSlot, { 1: next1, 2: next2 });
      localStorage.setItem(HUD_KILLFEED_BOTTOM_MIGRATED_KEY, '1');
      localStorage.setItem(HUD_FPS_TOP_MIGRATED_KEY, '1');
    } catch {
      // Ignore storage errors
    }
    return { slot1: next1, slot2: next2, active: nextActive };
  };

  try {
    const raw =
      localStorage.getItem(SETTINGS_KEY) ||
      localStorage.getItem('zonazero2017_settings_v1');
    if (!raw) {
      const migrated = applyMigration(
        savedSlots.slots[1],
        savedSlots.slots[2],
        savedSlots.slots[savedSlots.activeSlot],
      );
      return {
        ...DEFAULT_SETTINGS,
        activeHudSlot: savedSlots.activeSlot,
        hudSlots: { 1: migrated.slot1, 2: migrated.slot2 },
        hudLayout: migrated.active,
      };
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const activeHudSlot: HudSlotId = parsed.activeHudSlot === 2 ? 2 : savedSlots.activeSlot;
    const rawHudSlots: Record<HudSlotId, HudLayoutConfig> = {
      1: structuredCloneLayout(
        parsed.hudSlots?.[1] ?? savedSlots.slots[1],
        DEFAULT_HUD_LAYOUT,
      ),
      2: structuredCloneLayout(
        parsed.hudSlots?.[2] ?? savedSlots.slots[2],
        DEFAULT_HUD_LAYOUT_SLOT_2,
      ),
    };
    const rawActiveLayout =
      dedicatedHud ??
      structuredCloneLayout(
        parsed.hudLayout ?? rawHudSlots[activeHudSlot],
        activeHudSlot === 2 ? DEFAULT_HUD_LAYOUT_SLOT_2 : DEFAULT_HUD_LAYOUT,
      );
    const migrated = applyMigration(rawHudSlots[1], rawHudSlots[2], rawActiveLayout);
    const resolvedQuality: GraphicsQuality =
      parsed.quality === 'low' || parsed.quality === 'high' ? parsed.quality : 'medium';
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      quality: parsed.quality ?? DEFAULT_SETTINGS.quality,
      resolutionScale:
        typeof parsed.resolutionScale === 'number' && Number.isFinite(parsed.resolutionScale)
          ? Math.max(1, Math.min(100, Math.round(parsed.resolutionScale)))
          : defaultResolutionForQuality(parsed.quality ?? resolvedQuality),
      textureQuality:
        parsed.textureQuality ?? defaultTextureForQuality(parsed.quality ?? resolvedQuality),
      shadowQuality:
        parsed.shadowQuality ?? defaultShadowForQuality(parsed.quality ?? resolvedQuality),
      lobbyMusicTrack: normalizeLobbyMusicTrack(parsed.lobbyMusicTrack),
      emulatorMode: Boolean(parsed.emulatorMode),
      aimToggleMode: Boolean(parsed.aimToggleMode),
      networkSyncPreset:
        parsed.networkSyncPreset === 'ultra' ||
        parsed.networkSyncPreset === 'economy' ||
        parsed.networkSyncPreset === 'fast'
          ? (parsed.networkSyncPreset as NetworkSyncPreset)
          : 'fast',
      networkLowLatency:
        typeof parsed.networkLowLatency === 'boolean' ? parsed.networkLowLatency : true,
      networkHighPingSmoothing:
        typeof parsed.networkHighPingSmoothing === 'boolean'
          ? parsed.networkHighPingSmoothing
          : true,
      keyBindings: normalizeKeyBindings(parsed.keyBindings),
      macros: normalizeMacros(parsed.macros),
      ggMousePro: normalizeGgMousePro(parsed.ggMousePro),
      activeHudSlot,
      hudSlots: { 1: migrated.slot1, 2: migrated.slot2 },
      hudLayout: migrated.active,
    };
  } catch {
    const migrated = applyMigration(
      savedSlots.slots[1],
      savedSlots.slots[2],
      savedSlots.slots[savedSlots.activeSlot],
    );
    return {
      ...DEFAULT_SETTINGS,
      activeHudSlot: savedSlots.activeSlot,
      hudSlots: { 1: migrated.slot1, 2: migrated.slot2 },
      hudLayout: migrated.active,
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
      avatarId:
        parsed.avatarId === 'adam' ||
        parsed.avatarId === 'eva' ||
        parsed.avatarId === 'maxim' ||
        parsed.avatarId === 'kelly' ||
        parsed.avatarId === 'angelic' ||
        parsed.avatarId === 'eagle_eye'
          ? parsed.avatarId
          : 'default',
      glooSkin,
      equippedSkins: sanitizeEquippedSkins(parsed.equippedSkins),
    };
  } catch {
    return { ...CHARACTER_PRESETS[0], avatarId: 'default' };
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
    if (parsed.seasonId !== 'S1') {
      const migrated: PlayerProfile = {
        ...DEFAULT_PROFILE,
        nickname: parsed.nickname || DEFAULT_PROFILE.nickname,
        level: parsed.level ?? DEFAULT_PROFILE.level,
        gold: parsed.gold ?? DEFAULT_PROFILE.gold,
        gems: parsed.gems ?? DEFAULT_PROFILE.gems,
        matchesPlayed: parsed.matchesPlayed ?? 0,
        wins: parsed.wins ?? 0,
        totalKills: parsed.totalKills ?? 0,
        rankPoints: 0,
        rankedMatches: 0,
        rankedWins: 0,
        avatarId: parsed.avatarId ?? 'default',
        unlockedAvatars: ['default', 'adam', 'eva', 'maxim', 'kelly'],
        seasonId: 'S1',
        s1PeakRankPoints: 0,
        s1ClaimedRewards: [],
      };
      saveProfile(migrated);
      return migrated;
    }
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      avatarId: parsed.avatarId ?? 'default',
      unlockedAvatars:
        Array.isArray(parsed.unlockedAvatars) && parsed.unlockedAvatars.length > 0
          ? parsed.unlockedAvatars
          : [...DEFAULT_PROFILE.unlockedAvatars!],
      s1PeakRankPoints: parsed.s1PeakRankPoints ?? parsed.rankPoints ?? 0,
      s1ClaimedRewards: Array.isArray(parsed.s1ClaimedRewards) ? parsed.s1ClaimedRewards : [],
    };
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
  rankPoints: 0,
  rankedMatches: 0,
  rankedWins: 0,
  totalKills: 0,
  avatarId: 'default',
  unlockedAvatars: ['default', 'adam', 'eva', 'maxim', 'kelly'],
  seasonId: 'S1',
  s1PeakRankPoints: 0,
  s1ClaimedRewards: [],
};
