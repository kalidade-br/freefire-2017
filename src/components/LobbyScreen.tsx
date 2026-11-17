import React, { useState } from 'react';
import {
  Award,
  Check,
  Crosshair,
  Diamond,
  Edit3,
  Info,
  LogOut,
  Move,
  Play,
  Settings,
  Shield,
  Users,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { CharacterConfig, MatchMode, PlayerProfile, getRankInfo } from '../game/types';
import { IconCoinSvg, RankEmblemSvg } from './HudIcons';

interface LobbyScreenProps {
  profile: PlayerProfile;
  character: CharacterConfig;
  matchMode: MatchMode;
  isRanked: boolean;
  onChangeMatchMode: (mode: MatchMode) => void;
  onChangeRanked: (ranked: boolean) => void;
  onChangeNickname: (name: string) => void;
  muted: boolean;
  onToggleMute: () => void;
  onStartMatch: () => void;
  onQuickTraining: () => void;
  onOpenCharacter: () => void;
  onOpenArsenal: () => void;
  onOpenRankModal: () => void;
  onOpenSettings: () => void;
  onOpenHudEditor: () => void;
  onOpenCredits: () => void;
  onBackToMenu: () => void;
}

const MODE_LABELS: Record<MatchMode, { title: string; desc: string }> = {
  solo: { title: 'SOLO', desc: '51 Sobreviventes individuais' },
  duo: { title: 'DUO (BOTS)', desc: 'Você + 1 Aliado vs Duplas' },
  squad: { title: 'SQUAD (BOTS)', desc: 'Você + 3 Aliados vs Esquadrões' },
};

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  profile,
  character,
  matchMode,
  isRanked,
  onChangeMatchMode,
  onChangeRanked,
  onChangeNickname,
  muted,
  onToggleMute,
  onStartMatch,
  onQuickTraining,
  onOpenCharacter,
  onOpenArsenal,
  onOpenRankModal,
  onOpenSettings,
  onOpenHudEditor,
  onOpenCredits,
  onBackToMenu,
}) => {
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(profile.nickname);

  const rank = getRankInfo(profile.rankPoints);

  const commitNick = () => {
    const trimmed = nickDraft.trim();
    if (trimmed) {
      onChangeNickname(trimmed.slice(0, 18));
    } else {
      setNickDraft(profile.nickname);
    }
    setEditingNick(false);
  };

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 text-white select-none">
      {/* TOP BAR: Profile / Currencies / Rank Badge / Utilities */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        {/* Left Player Identity & Economy */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 bg-black/75 border border-white/15 px-2.5 py-1.5 shadow-xl">
          <div className="w-8 h-8 bg-amber-500/20 border border-amber-400/60 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-amber-300" />
          </div>

          {editingNick ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                maxLength={18}
                autoFocus
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitNick();
                  if (e.key === 'Escape') {
                    setNickDraft(profile.nickname);
                    setEditingNick(false);
                  }
                }}
                onBlur={commitNick}
                className="w-32 sm:w-40 bg-[#0d1117] border border-amber-400 px-2 py-0.5 text-xs font-bold text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={commitNick}
                className="p-1 bg-amber-500 text-black cursor-pointer"
                aria-label="Salvar Apelido"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNickDraft(profile.nickname);
                setEditingNick(true);
              }}
              className="flex items-center gap-1.5 hover:text-amber-300 cursor-pointer pr-1"
              title="Alterar Apelido"
            >
              <span className="text-xs sm:text-sm font-black tracking-wide truncate max-w-[130px] sm:max-w-[170px]">
                {profile.nickname}
              </span>
              <Edit3 className="w-3 h-3 text-neutral-400 shrink-0" />
            </button>
          )}

          <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-400/40 text-[10px] font-mono font-black text-amber-300 whitespace-nowrap">
            Nv.{profile.level}
          </span>

          <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-white/15 text-xs font-mono font-bold text-amber-200 tabular-nums">
            <IconCoinSvg className="w-3.5 h-3.5 shrink-0" />
            <span>{profile.gold}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-white/15 text-xs font-mono font-bold text-sky-300 tabular-nums">
            <Diamond className="w-3.5 h-3.5 fill-sky-400/30 shrink-0" />
            <span>{profile.gems}</span>
          </div>

          {/* Clickable Active Rank Badge */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenRankModal();
            }}
            className="flex items-center gap-1.5 pl-2 border-l border-white/15 hover:bg-white/10 px-1.5 py-0.5 cursor-pointer transition-colors"
            title="Ver Tabela de Patentes e Pontos"
          >
            <RankEmblemSvg
              color={rank.color}
              accent={rank.accent}
              className="w-5 h-5 shrink-0"
            />
            <div className="text-left leading-none">
              <div className="text-[10px] font-black uppercase text-white whitespace-nowrap">
                {rank.name}
              </div>
              <div className="text-[9px] font-mono text-amber-300 tabular-nums whitespace-nowrap">
                {profile.rankPoints} PTS
              </div>
            </div>
          </button>
        </div>

        {/* Right Title & Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <div className="hidden md:flex items-center gap-1.5 bg-black/75 border border-white/15 px-3 py-1.5 mr-1">
            <span className="font-black text-xs tracking-[0.18em] text-amber-400 uppercase whitespace-nowrap">
              FREE FIRE
            </span>
            <span className="text-[10px] font-mono text-neutral-400 whitespace-nowrap">
              BERMUDA 2017
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              onToggleMute();
            }}
            title={muted ? 'Ativar Som' : 'Mudo'}
            className="bg-black/80 hover:bg-neutral-900 border border-white/25 p-2 cursor-pointer transition-colors"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenHudEditor();
            }}
            title="Personalizar HUD (Tamanho, Posição e Transparência)"
            className="bg-black/80 hover:bg-amber-500 hover:text-black border border-amber-400/60 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <Move className="w-3.5 h-3.5" />
            <span>HUD</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenSettings();
            }}
            title="Configurações e Sensibilidade"
            className="bg-black/80 hover:bg-neutral-900 border border-white/25 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-200" />
            <span className="hidden sm:inline">Config</span>
          </button>

          <button
            type="button"
            onClick={onBackToMenu}
            title="Voltar para Tela Inicial"
            className="bg-black/80 hover:bg-red-950/90 border border-white/25 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Início</span>
          </button>
        </div>
      </header>

      {/* MIDDLE ROW: Left Navigation Rail + Center 3D Character Viewport + Right Match Panel */}
      <div className="flex-1 flex items-center justify-between gap-3 py-3 min-h-0">
        {/* Left Functional Rail */}
        <nav className="pointer-events-auto flex flex-col gap-1.5 w-36 sm:w-44">
          <button
            type="button"
            onClick={onOpenCharacter}
            className="bg-black/78 hover:bg-amber-500 hover:text-black border border-white/20 px-3 py-2.5 text-left flex items-center gap-2.5 cursor-pointer transition-colors shadow-lg"
          >
            <User className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">
              Personagem
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenArsenal();
            }}
            className="bg-black/78 hover:bg-amber-500 hover:text-black border border-white/20 px-3 py-2.5 text-left flex items-center gap-2.5 cursor-pointer transition-colors shadow-lg"
          >
            <Crosshair className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">
              Cofre / Armas
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenRankModal();
            }}
            className="bg-black/78 hover:bg-amber-500 hover:text-black border border-white/20 px-3 py-2.5 text-left flex items-center gap-2.5 cursor-pointer transition-colors shadow-lg"
          >
            <Award className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">
              Patentes Rank
            </span>
          </button>

          <button
            type="button"
            onClick={onQuickTraining}
            className="bg-black/78 hover:bg-sky-500 hover:text-black border border-white/20 px-3 py-2.5 text-left flex items-center gap-2.5 cursor-pointer transition-colors shadow-lg"
          >
            <Shield className="w-4 h-4 shrink-0 text-sky-400" />
            <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">
              Ilha de Treino
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenCredits}
            className="bg-black/78 hover:bg-neutral-800 border border-white/20 px-3 py-2.5 text-left flex items-center gap-2.5 cursor-pointer transition-colors shadow-lg"
          >
            <Info className="w-4 h-4 shrink-0 text-neutral-300" />
            <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">
              Sobre / Créditos
            </span>
          </button>
        </nav>

        {/* Right Match Setup & Start Panel */}
        <aside className="pointer-events-auto flex flex-col justify-between gap-2.5 w-60 sm:w-72 bg-black/82 border border-white/20 p-3 shadow-2xl">
          {/* Match Type: Clássica vs Rankeada */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
              MODO DE PARTIDA · BERMUDA
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick(620);
                  onChangeRanked(false);
                }}
                className={`py-2 px-2 border text-xs font-black uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap ${
                  !isRanked
                    ? 'bg-amber-500 text-black border-amber-200'
                    : 'bg-[#14181e] text-neutral-300 border-neutral-700 hover:border-neutral-500'
                }`}
              >
                CLÁSSICA
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick(740);
                  onChangeRanked(true);
                }}
                className={`py-2 px-2 border text-xs font-black uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
                  isRanked
                    ? 'bg-red-600 text-white border-amber-300'
                    : 'bg-[#14181e] text-neutral-300 border-neutral-700 hover:border-neutral-500'
                }`}
              >
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span>RANKEADA</span>
              </button>
            </div>
          </div>

          {/* Squad Mode: Solo / Duo / Squad */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
              EQUIPE (BOTS TÁTICOS)
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['solo', 'duo', 'squad'] as MatchMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick(680);
                    onChangeMatchMode(m);
                  }}
                  className={`py-1.5 px-1.5 text-[11px] font-black uppercase tracking-wider border cursor-pointer transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
                    matchMode === m
                      ? 'bg-white text-black border-white'
                      : 'bg-[#14181e] text-neutral-300 border-neutral-700 hover:border-neutral-500'
                  }`}
                >
                  {m !== 'solo' && <Users className="w-3 h-3 shrink-0" />}
                  <span>{m}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Rules & Match Summary Box */}
          <div className="bg-[#0f1318] border border-neutral-700 p-2.5 text-[11px] space-y-1">
            <div className="flex items-center justify-between font-black text-amber-300 uppercase">
              <span>{isRanked ? 'BR RANKEADA' : 'MODO CLÁSSICO'}</span>
              <span>{MODE_LABELS[matchMode].title}</span>
            </div>
            <p className="text-neutral-300 text-[10px] leading-snug">
              {MODE_LABELS[matchMode].desc}.{' '}
              {isRanked
                ? 'Morte real ativa! Ganhe ou perca pontos de patente ao morrer ou fazer Booyah.'
                : 'Lojinhas com moedas, veículos dirigíveis e AirDrops pela ilha.'}
            </p>
          </div>

          {/* Big Start Button */}
          <button
            type="button"
            onClick={onStartMatch}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 active:scale-[0.99] text-black font-black text-sm uppercase tracking-[0.18em] flex items-center justify-center gap-2 shadow-xl cursor-pointer transition-all whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-black shrink-0" />
            <span>INICIAR PARTIDA</span>
          </button>
        </aside>
      </div>

      {/* BOTTOM BAR: Character Preset Badge & Controls Hint */}
      <footer className="flex items-center justify-center">
        <div className="pointer-events-auto flex items-center gap-2 bg-black/75 border border-amber-400/40 px-3.5 py-1 text-[11px] font-mono uppercase tracking-wider text-amber-200">
          <span className="font-bold">{character.name}</span>
          <span className="text-white/55">· Arraste na tela para girar</span>
        </div>
      </footer>
    </div>
  );
};
