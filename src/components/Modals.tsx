import React from 'react';
import { X, Check, RotateCcw, Keyboard, MousePointerClick, Wifi, RefreshCw, Lock, Sparkles } from 'lucide-react';
import {
  FREE_PLAYER_AVATARS,
  PLAYER_AVATARS,
  getCharacterAvatar,
  normalizePlayerAvatarId,
} from '../game/avatars';
import { multiplayerClient } from '../game/multiplayerClient';
import {
  CharacterConfig,
  CharacterModelId,
  ControlMode,
  DEFAULT_KEY_BINDINGS,
  EMULATOR_KEY_BINDINGS,
  formatKeyCodeLabel,
  GameSettings,
  getCharacterPresetByModelId,
  GlooSkinId,
  GraphicsQuality,
  KEY_BINDING_GROUPS,
  KeyBindAction,
  MESTRE_MIN_PTS,
  NetworkSyncPreset,
  normalizeCharacterModelId,
  PlayerAvatarId,
  ShadowQuality,
  TextureQuality,
  WEAPONS,
} from '../game/types';
import {
  DEFAULT_SETTINGS,
  defaultResolutionForQuality,
  defaultShadowForQuality,
  defaultTextureForQuality,
  normalizeKeyBindings,
} from '../game/storage';
import { WeaponIcon } from './WeaponIcon';

interface AvatarCollectionGridProps {
  activeAvatarId: PlayerAvatarId;
  unlockedAvatars?: PlayerAvatarId[];
  s1PeakRankPoints?: number;
  onSelectAvatar?: (avatarId: PlayerAvatarId) => void;
}

const AvatarCollectionGrid: React.FC<AvatarCollectionGridProps> = ({
  activeAvatarId,
  unlockedAvatars,
  s1PeakRankPoints = 0,
  onSelectAvatar,
}) => {
  const unlockedSet = new Set<PlayerAvatarId>([
    ...FREE_PLAYER_AVATARS,
    ...(unlockedAvatars ?? []),
  ]);
  const isMestreUnlocked = s1PeakRankPoints >= MESTRE_MIN_PTS;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold uppercase tracking-wider text-neutral-300">
          AVATAR DE PERFIL (LOBBY, RANK E AMIGOS)
        </div>
        <span className="text-[10px] font-mono text-amber-300">
          TEMPORADA S1
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PLAYER_AVATARS.map((av) => {
          const unlocked =
            av.unlockSource === 'free' ||
            unlockedSet.has(av.id) ||
            (av.unlockSource === 's1_mestre' && isMestreUnlocked);
          const selected = normalizePlayerAvatarId(activeAvatarId) === av.id;
          return (
            <button
              key={av.id}
              type="button"
              disabled={!unlocked || !onSelectAvatar}
              onClick={() => {
                if (unlocked && onSelectAvatar) {
                  onSelectAvatar(av.id);
                }
              }}
              className={`p-2 text-left border-2 flex items-center gap-3 transition-colors ${
                selected
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 cursor-pointer'
                  : unlocked
                    ? 'bg-[#1a2028] border-neutral-700 hover:border-neutral-500 text-neutral-200 cursor-pointer'
                    : 'bg-[#11151b] border-neutral-800 text-neutral-400 opacity-75 cursor-not-allowed'
              }`}
            >
              <div className="relative w-14 h-14 bg-black/70 border border-white/20 shrink-0 overflow-hidden">
                <img
                  src={av.url}
                  alt={av.name}
                  className={`w-full h-full object-cover ${
                    unlocked ? '' : 'grayscale opacity-60'
                  }`}
                />
                {!unlocked && (
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-amber-300" />
                  </div>
                )}
                {selected && (
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-amber-400 text-black flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs uppercase truncate text-white">
                    {av.name}
                  </span>
                  {av.unlockSource === 's1_mestre' && (
                    <span className="px-1 py-0.5 bg-purple-600/40 border border-purple-400/60 text-[8px] font-black text-purple-200 shrink-0">
                      S1 MESTRE
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                  {av.subtitle}
                </div>
                <div className="text-[9px] font-mono uppercase mt-1">
                  {selected ? (
                    <span className="text-amber-300 font-bold">EQUIPADO</span>
                  ) : unlocked ? (
                    <span className="text-emerald-300">Clique para equipar</span>
                  ) : (
                    <span className="text-amber-200/80">
                      Desbloqueia ao pegar Mestre ({MESTRE_MIN_PTS} PTS)
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface CharacterModalProps {
  config: CharacterConfig;
  unlockedAvatars?: PlayerAvatarId[];
  s1PeakRankPoints?: number;
  onSelectAvatar?: (avatarId: PlayerAvatarId) => void;
  onChange: (next: CharacterConfig) => void;
  onClose: () => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  config,
  unlockedAvatars,
  s1PeakRankPoints = 0,
  onSelectAvatar,
  onChange,
  onClose,
}) => {
  const activeModel = normalizeCharacterModelId(config.modelId);
  const activeAvatarId = normalizePlayerAvatarId(config.avatarId);

  const characters: ReadonlyArray<{ id: CharacterModelId; title: string; sub: string }> = [
    { id: 'adam', title: 'ADAM', sub: 'Personagem Masculino Clássico' },
    { id: 'eva', title: 'EVA', sub: 'Personagem Feminina Clássica' },
    { id: 'maxim', title: 'MAXIM', sub: 'Guloso • Jaqueta & Boné' },
    { id: 'kelly', title: 'KELLY', sub: 'Velocista • Agasalho Amarelo' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg bg-[#14181e] border-2 border-amber-500 text-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1d232c] border-b border-neutral-700">
          <h2 className="font-black text-sm tracking-widest uppercase text-amber-400">
            SELEÇÃO DE PERSONAGEM
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[76vh] overflow-y-auto text-xs">
          {/* Core Character Selection: Adam, Eva, Maxim, Kelly */}
          <div>
            <div className="font-bold uppercase tracking-wider text-neutral-300 mb-2">
              PERSONAGEM ORIGINAL (FREE FIRE)
            </div>
            <div className="grid grid-cols-2 gap-3">
              {characters.map((ch) => {
                const selected = activeModel === ch.id;
                const preset = getCharacterPresetByModelId(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...config,
                        ...preset,
                        backpackEnabled: config.backpackEnabled,
                        glooSkin: config.glooSkin,
                        vestEnabled: false,
                      })
                    }
                    className={`p-2.5 text-left border-2 cursor-pointer transition-colors flex flex-col gap-2 ${
                      selected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-[#1a2028] border-neutral-700 hover:border-neutral-500 text-neutral-200'
                    }`}
                  >
                    <div className="relative w-full aspect-square bg-black/50 border border-white/15 overflow-hidden">
                      <img
                        src={getCharacterAvatar(ch.id)}
                        alt={ch.title}
                        className="w-full h-full object-cover object-top"
                      />
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-400 text-black flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-black text-sm tracking-wider">{ch.title}</div>
                      <span className="text-[10px] text-neutral-400">{ch.sub}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Only Backpack Toggle (no skins/vest/helmet) */}
          <button
            type="button"
            onClick={() => onChange({ ...config, backpackEnabled: !config.backpackEnabled, vestEnabled: false })}
            className={`w-full py-2.5 px-3 border flex items-center justify-between cursor-pointer ${
              config.backpackEnabled
                ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                : 'bg-[#1a2028] border-neutral-700 text-neutral-400'
            }`}
          >
            <span className="font-bold uppercase">Mochila</span>
            <span>{config.backpackEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Gloo Wall Skin Selector */}
          <div className="border-t border-neutral-700 pt-3">
            <div className="font-bold uppercase tracking-wider text-neutral-300 mb-2">
              SKIN DE PAREDE DE GELO
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  {
                    id: 'classic' as GlooSkinId,
                    title: 'GELO CLÁSSICO',
                    sub: 'Curvado, espesso e largo nos lados',
                  },
                  {
                    id: 'ffwc' as GlooSkinId,
                    title: 'FF WORLD CUP 2019',
                    sub: 'Compacto, inclinado p/ frente (dá pra pular em cima)',
                  },
                ]
              ).map((g) => {
                const activeGloo = (config.glooSkin === 'ffwc' ? 'ffwc' : 'classic') === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onChange({ ...config, glooSkin: g.id })}
                    className={`p-2.5 text-left border-2 cursor-pointer transition-colors flex flex-col gap-1.5 ${
                      activeGloo
                        ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200'
                        : 'bg-[#1a2028] border-neutral-700 hover:border-neutral-500 text-neutral-300'
                    }`}
                  >
                    <div className="w-full h-14 bg-black/55 border border-white/10 flex items-center justify-center">
                      {g.id === 'classic' ? (
                        <svg viewBox="0 0 80 42" className="w-16 h-10">
                          <path
                            d="M8,36 Q8,10 22,6 Q40,3 58,6 Q72,10 72,36 L64,38 Q62,16 40,14 Q18,16 16,38 Z"
                            fill="#dbeafe"
                            stroke="#60a5fa"
                            strokeWidth="2"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 80 42" className="w-16 h-10">
                          <path
                            d="M14,34 L18,12 L32,14 L40,9 L48,14 L62,12 L66,34 Z"
                            fill="#cbd5e1"
                            stroke="#22d3ee"
                            strokeWidth="1.5"
                          />
                          <path d="M16,26 L64,26 L66,34 L14,34 Z" fill="#090d16" />
                          <polygon points="40,13 48,21 40,30 32,21" fill="#eab308" stroke="#111827" strokeWidth="1" />
                          <polygon points="20,21 30,24 27,27 18,24" fill="#fde047" />
                          <polygon points="60,21 50,24 53,27 62,24" fill="#fde047" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-[11px] tracking-wide">{g.title}</span>
                      {activeGloo && <Check className="w-3.5 h-3.5 text-cyan-300 shrink-0" />}
                    </div>
                    <span className="text-[10px] leading-tight text-neutral-400">{g.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profile Avatar Selector */}
          {onSelectAvatar && (
            <div className="border-t border-neutral-700 pt-3">
              <AvatarCollectionGrid
                activeAvatarId={activeAvatarId}
                unlockedAvatars={unlockedAvatars}
                s1PeakRankPoints={s1PeakRankPoints}
                onSelectAvatar={onSelectAvatar}
              />
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-[#1d232c] border-t border-neutral-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest cursor-pointer"
          >
            SALVAR E FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};

interface SettingsModalProps {
  settings: GameSettings;
  nickname: string;
  onChangeNickname: (name: string) => void;
  onChangeSettings: (next: GameSettings) => void;
  onOpenHudEditor: () => void;
  onOpenGgMacroModal?: () => void;
  onRebindingChange?: (active: boolean) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  nickname,
  onChangeNickname,
  onChangeSettings,
  onOpenHudEditor,
  onOpenGgMacroModal,
  onRebindingChange,
  onClose,
}) => {
  const [tab, setTab] = React.useState<'sens' | 'controls' | 'keys' | 'network' | 'general'>('sens');
  const [listeningAction, setListeningAction] = React.useState<KeyBindAction | null>(null);
  const [livePing, setLivePing] = React.useState(() => multiplayerClient.getPingInfo());
  const [testingPing, setTestingPing] = React.useState(false);

  React.useEffect(() => {
    if (tab !== 'network') return;
    setLivePing(multiplayerClient.getPingInfo());
    const id = window.setInterval(() => {
      setLivePing(multiplayerClient.getPingInfo());
    }, 350);
    return () => window.clearInterval(id);
  }, [tab]);

  const keyBindings = React.useMemo(
    () => normalizeKeyBindings(settings.keyBindings),
    [settings.keyBindings],
  );

  React.useEffect(() => {
    onRebindingChange?.(listeningAction !== null);
    return () => {
      onRebindingChange?.(false);
    };
  }, [listeningAction, onRebindingChange]);

  React.useEffect(() => {
    if (!listeningAction) return;

    const commitCode = (newCode: string) => {
      if (!newCode || newCode === 'Escape') {
        setListeningAction(null);
        return;
      }
      const next = { ...keyBindings };
      const previousCodeForTarget = next[listeningAction];
      // Swap if another action already uses newCode so no action becomes unbound
      (Object.keys(next) as KeyBindAction[]).forEach((act) => {
        if (act !== listeningAction && next[act] === newCode) {
          next[act] = previousCodeForTarget;
        }
      });
      next[listeningAction] = newCode;
      onChangeSettings({
        ...settings,
        keyBindings: next,
      });
      setListeningAction(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListeningAction(null);
        return;
      }
      commitCode(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const map: Record<number, string> = {
        0: 'MouseLeft',
        1: 'MouseMiddle',
        2: 'MouseRight',
        3: 'MouseBack',
        4: 'MouseForward',
      };
      if (map[e.button]) {
        commitCode(map[e.button]);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      e.stopPropagation();
      commitCode(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Defer listener attachment by 1 frame so the click that started listening isn't captured immediately
    const timer = window.setTimeout(() => {
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('mousedown', onMouseDown, true);
      window.addEventListener('wheel', onWheel, { capture: true, passive: false });
      window.addEventListener('contextmenu', onContextMenu, true);
    }, 40);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, [listeningAction, keyBindings, onChangeSettings, settings]);

  const sensRows: Array<{
    key:
      | 'sensitivity'
      | 'redDotSensitivity'
      | 'scope2xSensitivity'
      | 'scope4xSensitivity'
      | 'sniperSensitivity';
    label: string;
    hint?: string;
  }> = [
    { key: 'sensitivity', label: 'Geral (Câmera Livre)' },
    { key: 'redDotSensitivity', label: 'Ponto Vermelho (1x)' },
    { key: 'scope2xSensitivity', label: 'Mira 2x' },
    { key: 'scope4xSensitivity', label: 'Mira 4x' },
    { key: 'sniperSensitivity', label: 'Mira AWM (Sniper 8x)', hint: 'Sem aimbot' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-xl bg-[#14181e] border-2 border-amber-500 text-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1d232c] border-b border-neutral-700">
          <h2 className="font-black text-sm tracking-widest uppercase text-amber-400">
            CONFIGURAÇÕES
          </h2>
          <button
            type="button"
            onClick={() => {
              setListeningAction(null);
              onClose();
            }}
            className="p-1 hover:bg-neutral-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-5 bg-[#0f1318] border-b border-neutral-700 text-[9px] sm:text-[11px] font-black uppercase">
          <button
            type="button"
            onClick={() => {
              setListeningAction(null);
              setTab('sens');
            }}
            className={`py-2.5 cursor-pointer border-b-2 ${
              tab === 'sens'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            SENSIBILIDADE
          </button>
          <button
            type="button"
            onClick={() => {
              setListeningAction(null);
              setTab('controls');
            }}
            className={`py-2.5 cursor-pointer border-b-2 ${
              tab === 'controls'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            CONTROLES
          </button>
          <button
            type="button"
            onClick={() => {
              setListeningAction(null);
              setTab('keys');
            }}
            className={`py-2.5 cursor-pointer border-b-2 flex items-center justify-center gap-1 ${
              tab === 'keys'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5 hidden sm:inline" />
            <span>TECLAS</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setListeningAction(null);
              setTab('network');
            }}
            className={`py-2.5 cursor-pointer border-b-2 flex items-center justify-center gap-1 ${
              tab === 'network'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Wifi className="w-3.5 h-3.5 hidden sm:inline" />
            <span>REDE</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setListeningAction(null);
              setTab('general');
            }}
            className={`py-2.5 cursor-pointer border-b-2 ${
              tab === 'general'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            GRÁFICOS
          </button>
        </div>

        <div className="p-4 space-y-3.5 text-xs max-h-[66vh] overflow-y-auto">
          {tab === 'sens' && (
            <>
              {sensRows.map((row) => {
                const val = settings[row.key];
                const pct = Math.round(((val - 0.2) / 2.3) * 100);
                return (
                  <div key={row.key}>
                    <div className="flex justify-between font-bold uppercase text-neutral-300 mb-1">
                      <span>
                        {row.label}
                        {row.hint && (
                          <span className="ml-1.5 text-[10px] text-purple-300 font-mono">
                            ({row.hint})
                          </span>
                        )}
                      </span>
                      <span className="text-amber-400 tabular-nums font-mono">
                        {pct} ({val.toFixed(2)}x)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={2.5}
                      step={0.05}
                      value={val}
                      onChange={(e) =>
                        onChangeSettings({
                          ...settings,
                          [row.key]: Number(e.target.value),
                        })
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>
                );
              })}

              <div className="border-t border-neutral-700 pt-3">
                <div className="font-bold uppercase text-neutral-300 mb-1.5">
                  PRECISÃO DE MIRA (AIM ASSIST)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeSettings({ ...settings, aimAssistMode: 'default' })}
                    className={`py-2 px-2 border font-bold uppercase cursor-pointer text-center ${
                      settings.aimAssistMode === 'default'
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-[#1a2028] border-neutral-700 text-neutral-300'
                    }`}
                  >
                    PADRÃO (MIRA GRUDA)
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeSettings({ ...settings, aimAssistMode: 'precise' })}
                    className={`py-2 px-2 border font-bold uppercase cursor-pointer text-center ${
                      settings.aimAssistMode === 'precise'
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-[#1a2028] border-neutral-700 text-neutral-300'
                    }`}
                  >
                    PRECISA (SEM GRUDAR)
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1.5 font-mono">
                  * Rifles e SMGs grudam no peito ao mirar no modo Padrão. A Sniper AWM-17 é sempre 100% manual.
                </p>
              </div>
            </>
          )}

          {tab === 'controls' && (
            <>
              <div>
                <div className="font-bold uppercase text-neutral-300 mb-1.5">MODO DE CONTROLE</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['auto', 'desktop', 'mobile'] as ControlMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onChangeSettings({ ...settings, controlMode: m })}
                      className={`py-2 border font-bold uppercase cursor-pointer ${
                        settings.controlMode === m
                          ? 'bg-amber-500 text-black border-amber-400'
                          : 'bg-[#1a2028] border-neutral-700'
                      }`}
                    >
                      {m === 'auto' ? 'Auto' : m === 'desktop' ? 'PC' : 'Celular'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onChangeSettings({ ...settings, invertY: !settings.invertY })}
                className={`w-full py-2.5 px-3 border flex items-center justify-between cursor-pointer ${
                  settings.invertY
                    ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                    : 'bg-[#1a2028] border-neutral-700 text-neutral-400'
                }`}
              >
                <span className="font-bold uppercase">INVERTER EIXO Y DA CÂMERA</span>
                <span>{settings.invertY ? 'SIM' : 'NÃO'}</span>
              </button>

              <div className="border-t border-neutral-700 pt-3 space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    onChangeSettings({ ...settings, autoLoot: !settings.autoLoot })
                  }
                  className={`w-full py-2.5 px-3 border flex items-center justify-between cursor-pointer ${
                    settings.autoLoot
                      ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                      : 'bg-[#1a2028] border-neutral-700 text-neutral-400'
                  }`}
                >
                  <span className="font-bold uppercase">COLETA AUTOMÁTICA DE LOOT</span>
                  <span>{settings.autoLoot ? 'LIGADA' : 'DESLIGADA'}</span>
                </button>

                {settings.autoLoot && (
                  <div>
                    <div className="font-bold uppercase text-neutral-300 mb-1.5">
                      VELOCIDADE DA COLETA AUTOMÁTICA
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'normal', label: 'Normal' },
                          { id: 'fast', label: 'Rápida' },
                          { id: 'ultra', label: 'Muito Rápida' },
                        ] as const
                      ).map((spd) => (
                        <button
                          key={spd.id}
                          type="button"
                          onClick={() =>
                            onChangeSettings({ ...settings, autoLootSpeed: spd.id })
                          }
                          className={`py-2 px-1.5 border cursor-pointer text-center font-black uppercase text-xs ${
                            settings.autoLootSpeed === spd.id
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-[#1a2028] border-neutral-700 text-neutral-300 hover:border-neutral-500'
                          }`}
                        >
                          {spd.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-700 pt-3">
                <div className="font-bold uppercase text-neutral-300 mb-2">
                  HUD PERSONALIZADO (POSIÇÃO, TAMANHO E OPACIDADE)
                </div>
                <button
                  type="button"
                  onClick={onOpenHudEditor}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest border-b-4 border-amber-700 cursor-pointer"
                >
                  ABRIR EDITOR DE HUD PERSONALIZADO
                </button>
              </div>
            </>
          )}

          {tab === 'keys' && (
            <>
              <div className="bg-[#0f141c] border border-cyan-500/40 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-black uppercase text-[11px]">
                    <MousePointerClick className="w-4 h-4 shrink-0" />
                    <span>MODO EMULADOR & CONTROLE DE MOUSE</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSettings({
                        ...settings,
                        emulatorMode: !settings.emulatorMode,
                      })
                    }
                    className={`px-3 py-1 border font-black uppercase text-[10px] cursor-pointer ${
                      settings.emulatorMode
                        ? 'bg-emerald-500 text-black border-emerald-300'
                        : 'bg-[#1a2028] text-neutral-300 border-neutral-600'
                    }`}
                  >
                    {settings.emulatorMode ? 'ATIVADO' : 'DESATIVADO'}
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 font-mono leading-snug">
                  * Use <span className="text-amber-300 font-bold">{formatKeyCodeLabel(keyBindings.toggleMouse)}</span> para suspender o mouse e clicar na tela, e aperte de novo para voltar à câmera. Use <span className="text-cyan-300 font-bold">{formatKeyCodeLabel(keyBindings.resetMouse)}</span> para reiniciar o mouse caso trave.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSettings({
                        ...settings,
                        aimToggleMode: false,
                      })
                    }
                    className={`py-1.5 px-2 border text-[10px] font-black uppercase cursor-pointer ${
                      !settings.aimToggleMode
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-[#1a2028] border-neutral-700 text-neutral-300'
                    }`}
                  >
                    MIRA: SEGURAR BOTÃO
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSettings({
                        ...settings,
                        aimToggleMode: true,
                      })
                    }
                    className={`py-1.5 px-2 border text-[10px] font-black uppercase cursor-pointer ${
                      settings.aimToggleMode
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-[#1a2028] border-neutral-700 text-neutral-300'
                    }`}
                  >
                    MIRA: CLICAR / ALTERNAR
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = settings.ggMousePro;
                      onChangeSettings({
                        ...settings,
                        ggMousePro: {
                          enabled: cur?.enabled ?? false,
                          showKeyBadges: cur?.showKeyBadges ?? true,
                          badgeOpacity: cur?.badgeOpacity ?? 0.85,
                          aimDragBoost: cur?.aimDragBoost ?? 1.15,
                          turboTouch: !(cur?.turboTouch ?? true),
                          instantQuickGloo: cur?.instantQuickGloo ?? true,
                          pins: cur?.pins ?? ({} as NonNullable<GameSettings['ggMousePro']>['pins']),
                        },
                      });
                    }}
                    className={`py-1.5 px-2 border text-[10px] font-black uppercase cursor-pointer ${
                      (settings.ggMousePro?.turboTouch ?? true)
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-[#1a2028] border-neutral-700 text-neutral-400'
                    }`}
                  >
                    TOQUE & ANIMAÇÃO TURBO: {(settings.ggMousePro?.turboTouch ?? true) ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = settings.ggMousePro;
                      onChangeSettings({
                        ...settings,
                        ggMousePro: {
                          enabled: cur?.enabled ?? false,
                          showKeyBadges: cur?.showKeyBadges ?? true,
                          badgeOpacity: cur?.badgeOpacity ?? 0.85,
                          aimDragBoost: cur?.aimDragBoost ?? 1.15,
                          turboTouch: cur?.turboTouch ?? true,
                          instantQuickGloo: !(cur?.instantQuickGloo ?? true),
                          pins: cur?.pins ?? ({} as NonNullable<GameSettings['ggMousePro']>['pins']),
                        },
                      });
                    }}
                    className={`py-1.5 px-2 border text-[10px] font-black uppercase cursor-pointer ${
                      (settings.ggMousePro?.instantQuickGloo ?? true)
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'bg-[#1a2028] border-neutral-700 text-neutral-400'
                    }`}
                  >
                    GELO RÁPIDO 1-CLIQUE: {(settings.ggMousePro?.instantQuickGloo ?? true) ? 'ON' : 'OFF'}
                  </button>
                </div>

                {onOpenGgMacroModal && (
                  <button
                    type="button"
                    onClick={onOpenGgMacroModal}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-500 to-amber-400 hover:brightness-110 text-black font-black text-[11px] uppercase tracking-wider cursor-pointer"
                  >
                    ABRIR GG MOUSE PRO & MACROS (PC / BOTÃO EMOJI ANDROID)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setListeningAction(null);
                    onChangeSettings({
                      ...settings,
                      keyBindings: { ...DEFAULT_KEY_BINDINGS },
                    });
                  }}
                  className="py-2 px-2 bg-[#1a2028] hover:bg-[#232b36] border border-neutral-600 text-[10px] font-black uppercase cursor-pointer"
                >
                  PRESET PADRÃO PC
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setListeningAction(null);
                    onChangeSettings({
                      ...settings,
                      emulatorMode: true,
                      keyBindings: { ...EMULATOR_KEY_BINDINGS },
                    });
                  }}
                  className="py-2 px-2 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/70 text-cyan-200 text-[10px] font-black uppercase cursor-pointer"
                >
                  PRESET EMULADOR (FF PC)
                </button>
              </div>

              {listeningAction && (
                <div className="bg-amber-500/20 border border-amber-400 px-3 py-2 text-[11px] font-black text-amber-200 flex items-center justify-between">
                  <span>PRESSIONE QUALQUER TECLA, BOTÃO DO MOUSE OU SCROLL...</span>
                  <button
                    type="button"
                    onClick={() => setListeningAction(null)}
                    className="px-2 py-0.5 bg-black/60 border border-white/25 text-[10px] cursor-pointer"
                  >
                    CANCELAR (ESC)
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {KEY_BINDING_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <div className="text-[10px] font-black tracking-wider text-amber-400 uppercase border-b border-neutral-700 pb-1">
                      {group.title}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const isWaiting = listeningAction === item.action;
                        const boundCode = keyBindings[item.action];
                        return (
                          <div
                            key={item.action}
                            className="flex items-center justify-between gap-2 bg-[#181e27] border border-neutral-700/80 px-2.5 py-1.5"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-[11px] text-white truncate">
                                {item.label}
                              </div>
                              {item.hint && (
                                <div className="text-[9px] text-neutral-400 leading-tight">
                                  {item.hint}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setListeningAction((cur) =>
                                    cur === item.action ? null : item.action,
                                  )
                                }
                                className={`min-w-[84px] px-2.5 py-1 border font-mono font-black text-[10px] uppercase cursor-pointer ${
                                  isWaiting
                                    ? 'bg-amber-400 text-black border-white animate-pulse'
                                    : 'bg-[#0e1218] hover:bg-[#232c3a] text-amber-300 border-neutral-600'
                                }`}
                              >
                                {isWaiting
                                  ? 'TECLE...'
                                  : boundCode
                                    ? formatKeyCodeLabel(boundCode)
                                    : '---'}
                              </button>
                              {item.action === 'quickGlooInstant' && boundCode && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onChangeSettings({
                                      ...settings,
                                      keyBindings: {
                                        ...keyBindings,
                                        quickGlooInstant: '',
                                      },
                                    })
                                  }
                                  title="Limpar tecla"
                                  className="px-1.5 py-1 bg-[#141920] hover:bg-red-900/60 border border-neutral-600 text-[10px] font-black text-neutral-300 cursor-pointer"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'network' && (
            <>
              <div className="bg-[#0e1218] border border-cyan-500/40 p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-mono uppercase text-neutral-400">
                    STATUS DA CONEXÃO MULTIPLAYER
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-base font-black font-mono tabular-nums ${
                        livePing.disconnected
                          ? 'text-red-400'
                          : livePing.pingMs <= 80
                            ? 'text-emerald-400'
                            : livePing.pingMs <= 160
                              ? 'text-amber-300'
                              : 'text-orange-400'
                      }`}
                    >
                      {livePing.label}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-300">
                      · {multiplayerClient.getNetworkConfig().wsConnected ? 'WebSocket Tempo Real' : 'HTTP Rápido'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={testingPing}
                  onClick={() => {
                    setTestingPing(true);
                    void multiplayerClient
                      .probePing()
                      .finally(() => {
                        setLivePing(multiplayerClient.getPingInfo());
                        setTestingPing(false);
                      });
                  }}
                  className="px-3 py-2 bg-[#1a2230] hover:bg-amber-500 hover:text-black border border-neutral-600 font-black uppercase text-[10px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingPing ? 'animate-spin' : ''}`} />
                  <span>TESTAR PING</span>
                </button>
              </div>

              <div>
                <div className="font-bold uppercase text-neutral-300 mb-1.5">
                  TAXA DE REQUISIÇÃO E ATUALIZAÇÃO (TICK MULTIPLAYER)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'ultra' as NetworkSyncPreset,
                        title: 'Ultra Rápida',
                        desc: '33ms (30Hz) · Resposta máxima',
                      },
                      {
                        id: 'fast' as NetworkSyncPreset,
                        title: 'Rápida (Padrão)',
                        desc: '50ms (20Hz) · Equilibrado',
                      },
                      {
                        id: 'economy' as NetworkSyncPreset,
                        title: 'Estável / 4G',
                        desc: '95ms (10Hz) · Menos dados',
                      },
                    ]
                  ).map((opt) => {
                    const active = (settings.networkSyncPreset ?? 'fast') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onChangeSettings({ ...settings, networkSyncPreset: opt.id })
                        }
                        className={`py-2 px-2 border cursor-pointer flex flex-col items-center text-center gap-0.5 ${
                          active
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-[#1a2028] border-neutral-700 hover:border-neutral-500 text-neutral-200'
                        }`}
                      >
                        <span className="font-black uppercase text-[11px]">{opt.title}</span>
                        <span
                          className={`text-[9px] leading-tight ${
                            active ? 'text-black/80 font-bold' : 'text-neutral-400'
                          }`}
                        >
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onChangeSettings({
                    ...settings,
                    networkLowLatency: !(settings.networkLowLatency ?? true),
                  })
                }
                className={`w-full py-2.5 px-3 border flex items-center justify-between gap-2 cursor-pointer text-left ${
                  (settings.networkLowLatency ?? true)
                    ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                    : 'bg-[#1a2028] border-neutral-700 text-neutral-400'
                }`}
              >
                <div>
                  <div className="font-bold uppercase">MODO BAIXA LATÊNCIA (REQUISIÇÃO RÁPIDA)</div>
                  <div className="text-[10px] font-mono text-neutral-400">
                    Envia tiros/gelo/dano na hora sem esperar o próximo ciclo e cancela pacotes travados.
                  </div>
                </div>
                <span className="font-black shrink-0">
                  {(settings.networkLowLatency ?? true) ? 'LIGADO' : 'DESLIGADO'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangeSettings({
                    ...settings,
                    networkHighPingSmoothing: !(settings.networkHighPingSmoothing ?? true),
                  })
                }
                className={`w-full py-2.5 px-3 border flex items-center justify-between gap-2 cursor-pointer text-left ${
                  (settings.networkHighPingSmoothing ?? true)
                    ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                    : 'bg-[#1a2028] border-neutral-700 text-neutral-400'
                }`}
              >
                <div>
                  <div className="font-bold uppercase">SUAVIZAÇÃO PARA PING ALTO / LAG</div>
                  <div className="text-[10px] font-mono text-neutral-400">
                    Prevê o movimento dos jogadores online entre pacotes para reduzir teleporte e engasgos.
                  </div>
                </div>
                <span className="font-black shrink-0">
                  {(settings.networkHighPingSmoothing ?? true) ? 'LIGADO' : 'DESLIGADO'}
                </span>
              </button>
            </>
          )}

          {tab === 'general' && (
            <>
              <div>
                <label className="block font-bold uppercase text-neutral-300 mb-1">
                  APELIDO DO JOGADOR
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={nickname}
                  onChange={(e) => onChangeNickname(e.target.value)}
                  className="w-full bg-[#0f1318] border border-neutral-600 px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold uppercase text-neutral-300 mb-1">
                  <span>VOLUME DO ÁUDIO</span>
                  <span className="text-amber-400 tabular-nums">
                    {settings.muted ? 'MUDO' : `${Math.round(settings.soundVolume * 100)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.soundVolume}
                  onChange={(e) =>
                    onChangeSettings({
                      ...settings,
                      soundVolume: Number(e.target.value),
                      muted: Number(e.target.value) === 0,
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="font-bold uppercase text-neutral-300 mb-1.5">
                  QUALIDADE GRÁFICA & RENDERIZAÇÃO
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'low', title: 'Suave', desc: 'Celular/PC Fraco · Máximo FPS' },
                      { id: 'medium', title: 'Padrão', desc: 'Equilibrado · Reflexos leves' },
                      { id: 'high', title: 'Ultra', desc: 'Máximo · Full HD, Reflexos & IBL' },
                    ] as Array<{ id: GraphicsQuality; title: string; desc: string }>
                  ).map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() =>
                        onChangeSettings({
                          ...settings,
                          quality: q.id,
                          resolutionScale: defaultResolutionForQuality(q.id),
                          textureQuality: defaultTextureForQuality(q.id),
                          shadowQuality: defaultShadowForQuality(q.id),
                        })
                      }
                      className={`py-2 px-1.5 border cursor-pointer flex flex-col items-center text-center gap-0.5 ${
                        settings.quality === q.id
                          ? 'bg-amber-500 text-black border-amber-400'
                          : 'bg-[#1a2028] border-neutral-700 hover:border-neutral-500'
                      }`}
                    >
                      <span className="font-black uppercase text-xs">{q.title}</span>
                      <span
                        className={`text-[9px] leading-tight ${
                          settings.quality === q.id ? 'text-black/80 font-bold' : 'text-neutral-400'
                        }`}
                      >
                        {q.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const resPct = Math.max(
                  1,
                  Math.min(
                    100,
                    Math.round(
                      settings.resolutionScale ?? defaultResolutionForQuality(settings.quality),
                    ),
                  ),
                );
                const resBadge =
                  resPct >= 95
                    ? 'ABSURDA (ULTRA NÍTIDA)'
                    : resPct >= 75
                      ? 'ALTA NITIDEZ'
                      : resPct >= 45
                        ? 'BALANCEADA'
                        : resPct >= 20
                          ? 'BAIXA (FPS)'
                          : 'RETRÔ PIXELADA';
                return (
                  <div className="bg-[#181e27] border border-neutral-700 p-2.5">
                    <div className="flex items-center justify-between font-bold uppercase text-neutral-200 mb-1">
                      <span>RESOLUÇÃO DA TELA (1% – 100%)</span>
                      <span className="text-amber-400 tabular-nums font-mono">
                        {resPct}% · {resBadge}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={resPct}
                      onChange={(e) =>
                        onChangeSettings({
                          ...settings,
                          resolutionScale: Math.max(1, Math.min(100, Number(e.target.value))),
                        })
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-neutral-400 font-mono mt-0.5">
                      <span>1% (Máximo FPS)</span>
                      <span>50% (Nativa)</span>
                      <span>100% (Qualidade Absurda)</span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <div className="font-bold uppercase text-neutral-300 mb-1.5">
                  NÍVEL DAS TEXTURAS
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'low', label: 'Baixo' },
                      { id: 'medium', label: 'Médio' },
                      { id: 'high', label: 'Alto' },
                      { id: 'ultra', label: 'Ultra' },
                    ] as Array<{ id: TextureQuality; label: string }>
                  ).map((t) => {
                    const activeTex =
                      (settings.textureQuality ?? defaultTextureForQuality(settings.quality)) === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onChangeSettings({ ...settings, textureQuality: t.id })}
                        className={`py-2 border font-black uppercase text-[11px] cursor-pointer ${
                          activeTex
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-[#1a2028] border-neutral-700 text-neutral-300 hover:border-neutral-500'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-neutral-400 mt-1 font-mono">
                  * Controla filtragem anisotrópica (até 16x), mipmaps e nitidez do calçadão, areia, prédios e asfalto à distância.
                </p>
              </div>

              <div>
                <div className="font-bold uppercase text-neutral-300 mb-1.5">
                  NÍVEL DE SOMBRAS
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: 'off', label: 'Off' },
                      { id: 'low', label: 'Baixa' },
                      { id: 'medium', label: 'Média' },
                      { id: 'high', label: 'Alta' },
                      { id: 'ultra', label: 'Ultra' },
                    ] as Array<{ id: ShadowQuality; label: string }>
                  ).map((s) => {
                    const activeShd =
                      (settings.shadowQuality ?? defaultShadowForQuality(settings.quality)) === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onChangeSettings({ ...settings, shadowQuality: s.id })}
                        className={`py-2 border font-black uppercase text-[10px] cursor-pointer ${
                          activeShd
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-[#1a2028] border-neutral-700 text-neutral-300 hover:border-neutral-500'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-neutral-400 mt-1 font-mono">
                  * Ajusta a resolução das sombras em tempo real (512px a 4K PCFSoft) e sombras de coqueiros e árvores.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onChangeSettings({ ...settings, showFps: !settings.showFps })}
                className={`w-full py-2.5 px-3 border flex items-center justify-between cursor-pointer ${
                  settings.showFps
                    ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                    : 'bg-[#1a2028] border-neutral-700 text-neutral-400'
                }`}
              >
                <span className="font-bold uppercase">MOSTRAR CONTADOR DE FPS</span>
                <span>{settings.showFps ? 'SIM' : 'NÃO'}</span>
              </button>
            </>
          )}
        </div>

        <div className="px-4 py-3 bg-[#1d232c] border-t border-neutral-700 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setListeningAction(null);
              onChangeSettings({
                ...DEFAULT_SETTINGS,
                keyBindings: { ...DEFAULT_KEY_BINDINGS },
                hudLayout: settings.hudLayout,
                activeHudSlot: settings.activeHudSlot ?? 1,
                hudSlots: settings.hudSlots ?? DEFAULT_SETTINGS.hudSlots,
              });
            }}
            className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setListeningAction(null);
              onClose();
            }}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest cursor-pointer"
          >
            CONCLUIR
          </button>
        </div>
      </div>
    </div>
  );
};

export const CreditsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
    <div className="w-full max-w-md bg-[#14181e] border-2 border-amber-500 text-white shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-[#1d232c] border-b border-neutral-700">
        <h2 className="font-black text-sm tracking-widest uppercase text-amber-400">
          CRÉDITOS — ZONA ZERO 2017
        </h2>
        <button type="button" onClick={onClose} className="p-1 hover:bg-neutral-700 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-3 text-xs leading-relaxed text-neutral-300">
        <p className="text-white font-bold text-sm">
          Projeto Battle Royale 3D Nostálgico (Inspirado nos Clássicos de 2017)
        </p>
        <p>
          Construído 100% no navegador com Three.js, TypeScript, texturas procedurais de baixa resolução, rig humanoide articulado e áudio sintetizado via Web Audio API.
        </p>
        <div className="border-t border-neutral-700 pt-3 space-y-1 font-mono text-[11px]">
          <div>· Motor 3D: Three.js WebGL + InstancedMesh</div>
          <div>· Estados: Máquina de 12 Estados (BOOT → WIN/GAMEOVER)</div>
          <div>· Controles: Teclado/Mouse + HUD Touch Mobile</div>
          <div>· Armazenamento: LocalStorage Offline</div>
        </div>
      </div>
      <div className="px-4 py-3 bg-[#1d232c] border-t border-neutral-700 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest cursor-pointer"
        >
          FECHAR
        </button>
      </div>
    </div>
  </div>
);

interface ArsenalModalProps {
  initialTab?: 'weapons' | 'avatars';
  activeAvatarId?: PlayerAvatarId;
  unlockedAvatars?: PlayerAvatarId[];
  s1PeakRankPoints?: number;
  onSelectAvatar?: (avatarId: PlayerAvatarId) => void;
  onClose: () => void;
}

export const ArsenalModal: React.FC<ArsenalModalProps> = ({
  initialTab = 'weapons',
  activeAvatarId = 'default',
  unlockedAvatars,
  s1PeakRankPoints = 0,
  onSelectAvatar,
  onClose,
}) => {
  const [tab, setTab] = React.useState<'weapons' | 'avatars'>(initialTab);
  const weaponsList = Object.values(WEAPONS);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 text-white"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#14181e] border-2 border-amber-500 shadow-2xl flex flex-col max-h-[86vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#1d232c] border-b border-neutral-700">
          <h2 className="font-black text-sm tracking-widest uppercase text-amber-400">
            COFRE · ARSENAL & AVATARES S1
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 bg-[#0f1318] border-b border-neutral-700 text-xs font-black uppercase">
          <button
            type="button"
            onClick={() => setTab('weapons')}
            className={`py-2.5 border-b-2 cursor-pointer ${
              tab === 'weapons'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            ARSENAL DE ARMAS ({weaponsList.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('avatars')}
            className={`py-2.5 border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === 'avatars'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AVATARES ({PLAYER_AVATARS.length})</span>
          </button>
        </div>

        <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
          {tab === 'avatars' ? (
            <AvatarCollectionGrid
              activeAvatarId={activeAvatarId}
              unlockedAvatars={unlockedAvatars}
              s1PeakRankPoints={s1PeakRankPoints}
              onSelectAvatar={onSelectAvatar}
            />
          ) : (
            weaponsList.map((w) => {
              const dmgPct = Math.min(100, Math.round((w.damage / 155) * 100));
              const rngPct = Math.min(100, Math.round((w.range / 390) * 100));
              const rpm = Math.round(60000 / w.fireRateMs);
              const rofPct = Math.min(100, Math.round((rpm / 780) * 100));
              return (
                <div
                  key={w.id}
                  className="bg-[#181e27] border border-neutral-700 p-3 flex flex-col sm:flex-row items-center gap-3"
                >
                  <div className="w-32 h-14 bg-black/55 border border-white/10 flex items-center justify-center p-1.5 shrink-0">
                    <WeaponIcon weaponId={w.id} className="w-28 h-10" />
                  </div>
                  <div className="flex-1 w-full space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-xs uppercase text-white">
                        {w.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold">
                          {w.category}
                        </span>
                        <span className="px-1.5 py-0.5 bg-black/60 border border-white/15 text-neutral-300">
                          PENTE {w.magSize}
                        </span>
                        <span className="px-1.5 py-0.5 bg-black/60 border border-white/15 text-neutral-300">
                          RECARGA{' '}
                          {w.reloadTimeSec < 0.75
                            ? `${Math.round(w.reloadTimeSec * 1000)}ms`
                            : `${w.reloadTimeSec.toFixed(2)}s`}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                      <div>
                        <div className="flex justify-between text-neutral-400 mb-0.5">
                          <span>DANO</span>
                          <span className="text-amber-300 font-bold">{w.damage * w.pellets}</span>
                        </div>
                        <div className="h-1.5 bg-neutral-800">
                          <div className="h-full bg-amber-400" style={{ width: `${dmgPct}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-neutral-400 mb-0.5">
                          <span>ALCANCE</span>
                          <span className="text-sky-300 font-bold">{w.range}m</span>
                        </div>
                        <div className="h-1.5 bg-neutral-800">
                          <div className="h-full bg-sky-400" style={{ width: `${rngPct}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-neutral-400 mb-0.5">
                          <span>CADÊNCIA</span>
                          <span className="text-emerald-300 font-bold">{rpm} RPM</span>
                        </div>
                        <div className="h-1.5 bg-neutral-800">
                          <div className="h-full bg-emerald-400" style={{ width: `${rofPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-3 bg-[#1d232c] border-t border-neutral-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest cursor-pointer"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};
