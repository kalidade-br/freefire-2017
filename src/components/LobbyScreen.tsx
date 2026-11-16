import React, { useState } from 'react';
import {
  ChevronDown,
  LogOut,
  Settings,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { CharacterConfig, MatchMode, PlayerProfile } from '../game/types';

interface LobbyScreenProps {
  profile: PlayerProfile;
  character: CharacterConfig;
  matchMode: MatchMode;
  onChangeMatchMode: (mode: MatchMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onStartMatch: () => void;
  onQuickTraining: () => void;
  onOpenCharacter: () => void;
  onOpenSettings: () => void;
  onOpenCredits: () => void;
  onBackToMenu: () => void;
}

const MODE_LABELS: Record<MatchMode, { title: string; sub: string }> = {
  solo: { title: 'SOLO', sub: '50 Sobreviventes' },
  duo: { title: 'DUO (BOTS)', sub: 'Duplas · Derrubar & Finalizar' },
  squad: { title: 'SQUAD (BOTS)', sub: 'Esquadrão 4x · Derrubar & Finalizar' },
};

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  profile,
  character,
  matchMode,
  onChangeMatchMode,
  muted,
  onToggleMute,
  onStartMatch,
  onQuickTraining,
  onOpenCharacter,
  onOpenSettings,
  onOpenCredits,
  onBackToMenu,
}) => {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center text-white select-none">
      {/* 16:9 Stage aligns clickable hotzones accurately to the underlying nostalgic lobby art */}
      <div className="relative w-full h-full max-w-[177.78vh] max-h-[56.25vw] pointer-events-none overflow-hidden">
        {/* TOP-LEFT BAR: Real Player Name, Level, Gold, Gems over Image 1's top strip */}
        <div
          className="pointer-events-auto absolute left-[3.2%] top-[0.5%] h-[5%] flex items-center gap-[1.8vw] cursor-pointer"
          onClick={onOpenCharacter}
          title="Editar Personagem / Perfil"
        >
          <div className="flex flex-col leading-none pr-1">
            <span className="text-[clamp(10px,1.15vw,15px)] font-bold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
              {profile.nickname}
            </span>
          </div>

          <div className="flex items-center gap-1 ml-[1.8vw]">
            <span className="text-[clamp(9px,0.95vw,13px)] font-mono font-black text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
              Lv.{profile.level}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 ml-[3.2vw] text-[clamp(10px,1.05vw,14px)] font-mono font-bold tabular-nums text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
            {profile.gold}
          </div>

          <div className="hidden sm:flex items-center gap-1 ml-[4.6vw] text-[clamp(10px,1.05vw,14px)] font-mono font-bold tabular-nums text-sky-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
            {profile.gems}
          </div>
        </div>

        {/* TOP-RIGHT BAR UTILITY BUTTONS (Sound, Settings, Voltar/Menu over gear/top strip) */}
        <div className="pointer-events-auto absolute right-[0.6%] top-[0.6%] flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              onToggleMute();
            }}
            title={muted ? 'Ativar Som' : 'Mudo'}
            className="bg-black/75 hover:bg-black border border-white/25 p-1.5 cursor-pointer transition-colors"
          >
            {muted ? (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Configurações e Sensibilidade"
            className="bg-black/75 hover:bg-black border border-white/25 p-1.5 cursor-pointer transition-colors"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-100" />
          </button>

          <button
            type="button"
            onClick={onBackToMenu}
            title="Tela Inicial"
            className="bg-black/75 hover:bg-black border border-white/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
          >
            <LogOut className="w-3 h-3 text-amber-300" />
            <span className="hidden sm:inline">Início</span>
          </button>
        </div>

        {/* LEFT RAIL HOTZONES OVER ORIGINAL STORE / CHARACTER / VAULT / COLLECTION */}
        <button
          type="button"
          onClick={onQuickTraining}
          title="Explorar Ilha / Armas"
          aria-label="Store / Explorar Ilha"
          className="pointer-events-auto absolute left-0 top-[15%] w-[6.5%] h-[11.5%] bg-transparent hover:bg-amber-400/20 cursor-pointer transition-colors"
        />
        <button
          type="button"
          onClick={onOpenCharacter}
          title="Escolher Personagem 3D"
          aria-label="Character"
          className="pointer-events-auto absolute left-0 top-[27.5%] w-[6.5%] h-[11.5%] bg-transparent hover:bg-amber-400/20 cursor-pointer transition-colors"
        />
        <button
          type="button"
          onClick={onOpenCharacter}
          title="Vestiário / Visual"
          aria-label="Vault"
          className="pointer-events-auto absolute left-0 top-[40%] w-[6.5%] h-[11.5%] bg-transparent hover:bg-amber-400/20 cursor-pointer transition-colors"
        />
        <button
          type="button"
          onClick={onOpenCredits}
          title="Coleção & Créditos"
          aria-label="Collection"
          className="pointer-events-auto absolute left-0 top-[52.5%] w-[6.5%] h-[11.5%] bg-transparent hover:bg-amber-400/20 cursor-pointer transition-colors"
        />

        {/* CHARACTER NAME BADGE AT BOTTOM-CENTER NEAR FEET */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[9%] flex items-center gap-2 bg-black/55 border border-amber-400/40 px-3 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-200">
          <span>{character.name}</span>
          <span className="text-white/60">· Arraste para girar</span>
        </div>

        {/* CLASSIC BERMUDA MODE SELECTOR PANEL (SOLO / DUO / SQUAD - ONLY BOTS) */}
        <div className="pointer-events-auto absolute right-[0.8%] top-[7.4%] w-[23.5%] min-w-[168px]">
          {/* Clickable header over CLASSIC Bermuda card */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick(640);
              setModeMenuOpen((o) => !o);
            }}
            className="w-full bg-white/95 hover:bg-white text-neutral-900 border-l-4 border-amber-500 px-2.5 py-1.5 flex items-center justify-between shadow-lg cursor-pointer transition-colors"
          >
            <div className="text-left leading-tight">
              <div className="text-[clamp(10px,1.1vw,14px)] font-black uppercase tracking-wide flex items-center gap-1">
                <span>BERMUDA · {matchMode.toUpperCase()}</span>
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-neutral-600 truncate">
                {MODE_LABELS[matchMode].sub}
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-neutral-700 shrink-0 transition-transform ${
                modeMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Compact Mode Pills always accessible below CLASSIC Bermuda */}
          <div className="grid grid-cols-3 gap-1 mt-1">
            {(['solo', 'duo', 'squad'] as MatchMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  soundEngine.playUiClick(680);
                  onChangeMatchMode(m);
                  setModeMenuOpen(false);
                }}
                className={`py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider border cursor-pointer transition-colors flex items-center justify-center gap-1 ${
                  matchMode === m
                    ? 'bg-amber-500 text-black border-amber-200 shadow'
                    : 'bg-[#14181e]/90 text-neutral-200 border-neutral-600 hover:bg-[#232a34]'
                }`}
              >
                {m !== 'solo' && <Users className="w-2.5 h-2.5 hidden sm:inline" />}
                <span>{m}</span>
              </button>
            ))}
          </div>

          {modeMenuOpen && (
            <div className="mt-1 bg-[#14181e]/95 border border-amber-500/60 p-2 space-y-1.5 text-[10px] shadow-2xl">
              <div className="text-amber-300 font-bold uppercase tracking-wider">
                {MODE_LABELS[matchMode].title}
              </div>
              <p className="text-neutral-300 leading-snug">
                {matchMode === 'solo'
                  ? '50 bots inimigos individuais pela ilha.'
                  : matchMode === 'duo'
                    ? 'Você + 1 bot aliado vs 24 duplas de bots. Derrubados se arrastam!'
                    : 'Você + 3 bots aliados vs esquadrões de bots. Derrubados se arrastam!'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setModeMenuOpen(false);
                  onQuickTraining();
                }}
                className="w-full py-1 bg-[#1d6fa5] hover:bg-[#2584c4] text-white font-bold uppercase tracking-wider cursor-pointer"
              >
                Treino Rápido na Ilha
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM-RIGHT SLANTED START HOTZONE DIRECTLY OVER ORIGINAL YELLOW START BUTTON */}
        <button
          type="button"
          onClick={onStartMatch}
          aria-label="Start — Iniciar Partida"
          title="Iniciar Partida"
          className="pointer-events-auto absolute left-[75%] top-[77%] w-[25%] h-[23%] bg-transparent hover:bg-amber-300/20 active:scale-[0.985] cursor-pointer transition-all"
        />
      </div>
    </div>
  );
};
