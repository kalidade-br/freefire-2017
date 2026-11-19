import React from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import {
  CHARACTER_PRESETS,
  CharacterConfig,
  ControlMode,
  GameSettings,
  GraphicsQuality,
  WEAPONS,
} from '../game/types';
import { DEFAULT_SETTINGS } from '../game/storage';
import { WeaponIcon } from './WeaponIcon';

interface CharacterModalProps {
  config: CharacterConfig;
  onChange: (next: CharacterConfig) => void;
  onClose: () => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  config,
  onChange,
  onClose,
}) => {
  const shirtColors = ['#f1f0ea', '#1f2421', '#384635', '#8d2b24', '#2a4566'];
  const pantsColors = ['#c9b396', '#9c8a72', '#2c333f', '#424b36'];
  const skinColors = ['#e2b291', '#d7a27e', '#b97e59', '#8d5b3e'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg bg-[#14181e] border-2 border-amber-500 text-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1d232c] border-b border-neutral-700">
          <h2 className="font-black text-sm tracking-widest uppercase text-amber-400">
            CUSTOMIZAÇÃO DE PERSONAGEM
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
          {/* Presets */}
          <div>
            <div className="font-bold uppercase tracking-wider text-neutral-300 mb-2">
              MODELOS CLÁSSICOS (2017)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CHARACTER_PRESETS.map((preset) => {
                const active = config.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChange({ ...preset })}
                    className={`px-3 py-2 text-left border cursor-pointer flex items-center justify-between ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                        : 'bg-[#1a2028] border-neutral-700 hover:border-neutral-500'
                    }`}
                  >
                    <span className="truncate">{preset.name}</span>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Headgear & Shirt Style */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-bold uppercase text-neutral-300 mb-1.5">CABEÇA / CAPACETE</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['buzz', 'spiky', 'cap', 'helmet'] as const).map((hs) => (
                  <button
                    key={hs}
                    type="button"
                    onClick={() => onChange({ ...config, hairStyle: hs })}
                    className={`py-1.5 border uppercase font-semibold cursor-pointer ${
                      config.hairStyle === hs
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-[#1a2028] border-neutral-700'
                    }`}
                  >
                    {hs === 'buzz'
                      ? 'Raspado'
                      : hs === 'spiky'
                        ? 'Repicado'
                        : hs === 'cap'
                          ? 'Boné'
                          : 'Capacete'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="font-bold uppercase text-neutral-300 mb-1.5">CAMISA / ESTILO</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['tank', 'tee', 'hoodie'] as const).map((ss) => (
                  <button
                    key={ss}
                    type="button"
                    onClick={() => onChange({ ...config, shirtStyle: ss })}
                    className={`py-1.5 border uppercase font-semibold cursor-pointer ${
                      config.shirtStyle === ss
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-[#1a2028] border-neutral-700'
                    }`}
                  >
                    {ss === 'tank' ? 'Regata' : ss === 'tee' ? 'Camisa' : 'Casaco'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...config, vestEnabled: !config.vestEnabled })}
              className={`py-2 px-3 border flex items-center justify-between cursor-pointer ${
                config.vestEnabled
                  ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                  : 'bg-[#1a2028] border-neutral-700 text-neutral-400'
              }`}
            >
              <span className="font-bold uppercase">Colete Tático</span>
              <span>{config.vestEnabled ? 'ON' : 'OFF'}</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...config, backpackEnabled: !config.backpackEnabled })}
              className={`py-2 px-3 border flex items-center justify-between cursor-pointer ${
                config.backpackEnabled
                  ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                  : 'bg-[#1a2028] border-neutral-700 text-neutral-400'
              }`}
            >
              <span className="font-bold uppercase">Mochila</span>
              <span>{config.backpackEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Color Swatches */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-neutral-300">TOM DE PELE</span>
              <div className="flex gap-2">
                {skinColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange({ ...config, skinColor: c })}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 border-2 cursor-pointer ${
                      config.skinColor === c ? 'border-amber-400 scale-110' : 'border-neutral-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-neutral-300">COR DA CAMISA</span>
              <div className="flex gap-2">
                {shirtColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange({ ...config, shirtColor: c })}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 border-2 cursor-pointer ${
                      config.shirtColor === c ? 'border-amber-400 scale-110' : 'border-neutral-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-neutral-300">COR DA CALÇA</span>
              <div className="flex gap-2">
                {pantsColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange({ ...config, pantsColor: c })}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 border-2 cursor-pointer ${
                      config.pantsColor === c ? 'border-amber-400 scale-110' : 'border-neutral-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
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
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  nickname,
  onChangeNickname,
  onChangeSettings,
  onOpenHudEditor,
  onClose,
}) => {
  const [tab, setTab] = React.useState<'sens' | 'controls' | 'general'>('sens');

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
      <div className="w-full max-w-lg bg-[#14181e] border-2 border-amber-500 text-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1d232c] border-b border-neutral-700">
          <h2 className="font-black text-sm tracking-widest uppercase text-amber-400">
            CONFIGURAÇÕES
          </h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-neutral-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-3 bg-[#0f1318] border-b border-neutral-700 text-[11px] font-black uppercase">
          <button
            type="button"
            onClick={() => setTab('sens')}
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
            onClick={() => setTab('controls')}
            className={`py-2.5 cursor-pointer border-b-2 ${
              tab === 'controls'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            CONTROLES & HUD
          </button>
          <button
            type="button"
            onClick={() => setTab('general')}
            className={`py-2.5 cursor-pointer border-b-2 ${
              tab === 'general'
                ? 'border-amber-400 text-amber-400 bg-[#181e27]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            GRÁFICOS & ÁUDIO
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
                      { id: 'low', title: 'Suave', desc: 'Celular/PC Fraco · Render curta' },
                      { id: 'medium', title: 'Padrão', desc: 'Celular Médio · Equilibrado' },
                      { id: 'high', title: 'Ultra', desc: 'Máximo · Sombras HD & Vegetação' },
                    ] as Array<{ id: GraphicsQuality; title: string; desc: string }>
                  ).map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onChangeSettings({ ...settings, quality: q.id })}
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
                <p className="text-[10px] text-neutral-400 mt-1.5 font-mono">
                  * Terreno distante perde texturas pesadas automaticamente mantendo a visão do mapa. Inimigos fora do alcance de render não são exibidos e não te enxergam.
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
            onClick={() =>
              onChangeSettings({
                ...DEFAULT_SETTINGS,
                hudLayout: settings.hudLayout,
              })
            }
            className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>
          <button
            type="button"
            onClick={onClose}
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

export const ArsenalModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
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
            COFRE DE ARMAS · ARSENAL DA ILHA
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
          {weaponsList.map((w) => {
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
          })}
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
