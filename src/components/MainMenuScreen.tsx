import React from 'react';
import { Award, Settings, User, Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../game/audio';

interface MainMenuScreenProps {
  onPlay: () => void;
  onOpenCharacter: () => void;
  onOpenSettings: () => void;
  onOpenCredits: () => void;
  muted: boolean;
  onToggleMute: () => void;
  nickname: string;
}

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  onPlay,
  onOpenCharacter,
  onOpenSettings,
  onOpenCredits,
  muted,
  onToggleMute,
  nickname,
}) => {
  const handleUnlockAndPlay = () => {
    soundEngine.unlock();
    soundEngine.setLobbyMusicMode('lobby');
    onPlay();
  };

  return (
    <div
      onPointerDown={() => {
        soundEngine.unlock();
        soundEngine.setLobbyMusicMode('lobby');
      }}
      className="fixed inset-0 z-40 bg-black flex items-center justify-center overflow-hidden select-none text-white"
    >
      {/* 16:9 Stage ensures every interactive overlay aligns pixel-precisely over COMEÇA O JOGO & LOG OUT */}
      <div className="relative w-full h-full max-w-[177.78vh] max-h-[56.25vw] overflow-hidden shadow-2xl">
        <img
          src="/assets/start_bg.jpg"
          alt="Free Fire — Tela Inicial Clássica"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
        />

        {/* Quick top utility icons neatly beside the original LOG OUT button */}
        <div className="absolute top-[1.8%] right-[13.5%] z-20 flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1.5 bg-black/65 border border-white/25 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-amber-400" />
            <span>{nickname}</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            title={muted ? 'Ativar Som' : 'Mudo'}
            className="bg-black/65 hover:bg-black/85 border border-white/25 p-1.5 cursor-pointer transition-colors"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundEngine.unlock();
              onOpenCharacter();
            }}
            title="Personagem"
            className="bg-black/65 hover:bg-black/85 border border-white/25 p-1.5 cursor-pointer transition-colors"
          >
            <User className="w-4 h-4 text-amber-300" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundEngine.unlock();
              onOpenSettings();
            }}
            title="Configurações"
            className="bg-black/65 hover:bg-black/85 border border-white/25 p-1.5 cursor-pointer transition-colors"
          >
            <Settings className="w-4 h-4 text-neutral-100" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundEngine.unlock();
              onOpenCredits();
            }}
            title="Créditos"
            className="bg-black/65 hover:bg-black/85 border border-white/25 p-1.5 cursor-pointer transition-colors"
          >
            <Award className="w-4 h-4 text-sky-300" />
          </button>
        </div>

        {/* Clickable hotzone directly over the original LOG OUT button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            soundEngine.unlock();
            soundEngine.playUiClick(480);
            onOpenSettings();
          }}
          aria-label="Log Out / Conta"
          title="Alterar Nick / Configurações"
          className="absolute left-[87.8%] top-[1.8%] w-[11%] h-[6.5%] z-20 bg-transparent hover:bg-white/15 active:bg-white/25 cursor-pointer transition-colors"
        />

        {/* Clickable hotzone directly over the iconic yellow COMEÇA O JOGO button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleUnlockAndPlay();
          }}
          aria-label="Começar o Jogo"
          className="absolute left-[34.8%] top-[55.6%] w-[29.4%] h-[9.4%] z-20 bg-transparent hover:bg-amber-300/20 active:scale-[0.985] ring-0 hover:ring-2 hover:ring-amber-200/85 cursor-pointer transition-all"
        />

        {/* Touch/click anywhere prompt cue */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[3%] text-center text-[11px] font-mono tracking-[0.2em] uppercase text-white/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
          TOQUE EM COMEÇA O JOGO PARA ENTRAR NO LOBBY
        </div>
      </div>
    </div>
  );
};
