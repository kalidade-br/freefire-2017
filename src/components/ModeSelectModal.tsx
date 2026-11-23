import React, { useState } from 'react';
import { Award, Check, Shield, Users, X } from 'lucide-react';
import { MatchMode, getRankInfo } from '../game/types';
import { RankEmblemSvg } from './HudIcons';

interface ModeSelectModalProps {
  matchMode: MatchMode;
  isRanked: boolean;
  autoFillBots: boolean;
  rankPoints: number;
  isPartyLeader: boolean;
  onChangeMatchMode: (mode: MatchMode) => void;
  onChangeRanked: (ranked: boolean) => void;
  onChangeAutoFillBots: (fill: boolean) => void;
  onQuickTraining: () => void;
  onClose: () => void;
}

export const ModeSelectModal: React.FC<ModeSelectModalProps> = ({
  matchMode,
  isRanked,
  autoFillBots,
  rankPoints,
  isPartyLeader,
  onChangeMatchMode,
  onChangeRanked,
  onChangeAutoFillBots,
  onQuickTraining,
  onClose,
}) => {
  const [topTab, setTopTab] = useState<'official' | 'creative'>('official');
  const rank = getRankInfo(rankPoints);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 text-white select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-gradient-to-br from-[#0e131b] via-[#131a26] to-[#0a0d13] border-2 border-amber-500/70 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar matching Free Fire Screenshot: MODO OFICIAL | OFICINA DE CRIAÇÃO + Close X */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-black/60 border-b border-white/15">
          <div className="w-8" />
          <div className="flex items-center gap-5 text-xs sm:text-sm font-black uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setTopTab('official')}
              className={`pb-1 border-b-2 cursor-pointer whitespace-nowrap transition-colors ${
                topTab === 'official'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              MODO OFICIAL
            </button>
            <span className="text-neutral-600">|</span>
            <button
              type="button"
              onClick={() => setTopTab('creative')}
              className={`pb-1 border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap transition-colors ${
                topTab === 'creative'
                  ? 'border-purple-400 text-purple-300'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              <span>OFICINA DE CRIAÇÃO</span>
              <span className="px-1.5 py-0.5 text-[9px] bg-purple-900/70 border border-purple-400/50 text-purple-200">
                Jogos Criativos
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 cursor-pointer"
            aria-label="Fechar Seleção de Modo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {topTab === 'official' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Large Card 1: BR RANQUEADO (with Rank Emblem & Season Banner) */}
                <button
                  type="button"
                  disabled={!isPartyLeader}
                  onClick={() => onChangeRanked(true)}
                  className={`md:col-span-5 relative min-h-[210px] sm:min-h-[240px] border-2 p-4 flex flex-col justify-between text-left overflow-hidden cursor-pointer transition-all disabled:cursor-not-allowed ${
                    isRanked
                      ? 'border-purple-300 ring-2 ring-amber-400 shadow-[0_0_25px_rgba(168,85,247,0.45)]'
                      : 'border-white/25 hover:border-purple-400/80 opacity-85'
                  }`}
                  style={{
                    background:
                      'linear-gradient(145deg, #2e1065 0%, #581c87 42%, #1e1b4b 100%)',
                  }}
                >
                  {/* Top Event Banner */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 bg-black/55 border border-purple-300/60 text-[10px] font-black uppercase tracking-wider text-purple-200">
                      ARENA DO TROVÃO
                    </span>
                    {isRanked && (
                      <span className="px-2 py-0.5 bg-amber-400 text-black font-black text-[10px] uppercase flex items-center gap-1">
                        <Check className="w-3 h-3" /> SELECIONADO
                      </span>
                    )}
                  </div>

                  {/* Center Active Rank Emblem & Points */}
                  <div className="my-auto flex flex-col items-center justify-center py-2">
                    <div className="p-2.5 bg-black/45 border-2 border-amber-400/80 shadow-xl">
                      <RankEmblemSvg
                        color={rank.color}
                        accent={rank.accent}
                        className="w-12 h-12"
                      />
                    </div>
                    <div className="mt-2 text-xs font-black uppercase tracking-wider text-amber-200">
                      {rank.name} · {rankPoints} PTS
                    </div>
                    <div className="text-[10px] font-mono text-purple-200">
                      Toque para selecionar o Modo Ranqueado
                    </div>
                  </div>

                  {/* Bottom Season & Map Row */}
                  <div className="flex items-end justify-between border-t border-white/20 pt-2">
                    <div>
                      <div className="text-lg font-black italic text-amber-400 leading-none">
                        S54
                      </div>
                      <div className="text-base font-black tracking-wide uppercase">
                        BR RANQUEADO
                      </div>
                      <div className="text-[10px] font-mono text-white/85">
                        João Pessoa ⇄ · Pontos de Patente
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-black/55 border border-amber-400/60 text-[10px] font-mono text-amber-200">
                      Bônus X1 ︽
                    </span>
                  </div>
                </button>

                {/* Large Card 2: BATTLE ROYALE CLÁSSICO */}
                <button
                  type="button"
                  disabled={!isPartyLeader}
                  onClick={() => onChangeRanked(false)}
                  className={`md:col-span-4 relative min-h-[210px] sm:min-h-[240px] border-2 p-4 flex flex-col justify-between text-left overflow-hidden cursor-pointer transition-all disabled:cursor-not-allowed ${
                    !isRanked
                      ? 'border-amber-300 ring-2 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.4)]'
                      : 'border-white/25 hover:border-amber-400/80 opacity-85'
                  }`}
                  style={{
                    background:
                      'linear-gradient(155deg, #0c4a6e 0%, #1e3a8a 52%, #111827 100%)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-black/55 border border-sky-300/60 text-[10px] font-black uppercase text-sky-200">
                      MODO CLÁSSICO
                    </span>
                    {!isRanked && (
                      <span className="px-2 py-0.5 bg-amber-400 text-black font-black text-[10px] uppercase flex items-center gap-1">
                        <Check className="w-3 h-3" /> SELECIONADO
                      </span>
                    )}
                  </div>

                  <div className="my-auto text-center py-4 space-y-1">
                    <Award className="w-11 h-11 text-amber-300 mx-auto drop-shadow" />
                    <div className="text-xs font-mono text-sky-100">
                      51 Sobreviventes · João Pessoa Completa
                    </div>
                  </div>

                  <div className="border-t border-white/20 pt-2">
                    <div className="text-lg font-black tracking-wide uppercase">
                      BATTLE ROYALE
                    </div>
                    <div className="text-[10px] font-mono text-white/85">
                      João Pessoa ⇄ · Sem perda de patente
                    </div>
                  </div>
                </button>

                {/* Right Side Compact Cards: Treinamento + Squad Rules */}
                <div className="md:col-span-3 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onQuickTraining();
                    }}
                    className="flex-1 min-h-[100px] border border-sky-400/60 hover:border-sky-300 bg-gradient-to-br from-sky-900/70 to-slate-900 p-3 flex flex-col justify-between text-left cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <Shield className="w-5 h-5 text-sky-300" />
                      <span className="text-[9px] font-mono px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-400 text-emerald-300">
                        FREE
                      </span>
                    </div>
                    <div>
                      <div className="font-black text-sm uppercase">TREINAMENTO</div>
                      <div className="text-[10px] font-mono text-sky-200/80">
                        Armas & Mira Livre
                      </div>
                    </div>
                  </button>

                  <div className="flex-1 bg-black/50 border border-white/20 p-3 flex flex-col justify-between">
                    <div className="text-[10px] font-mono uppercase text-amber-300 font-bold">
                      SALA MULTIPLAYER
                    </div>
                    <p className="text-[10px] text-neutral-300 leading-relaxed">
                      Até 4 jogadores online por sala distribuídos entre as 12 equipes + bots táticos e reviver na Lojinha.
                    </p>
                  </div>
                </div>
              </div>

              {/* Squad Formation Bar (Solo / Duo / Squad + Auto Formação) */}
              <div className="bg-black/65 border border-white/20 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {(['solo', 'duo', 'squad'] as MatchMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={!isPartyLeader}
                      onClick={() => onChangeMatchMode(m)}
                      className={`px-4 py-2 border text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap ${
                        matchMode === m
                          ? 'bg-amber-500 text-black border-amber-200'
                          : 'bg-[#171d26] text-neutral-300 border-neutral-600 hover:border-white'
                      }`}
                    >
                      {m !== 'solo' && <Users className="w-3.5 h-3.5 shrink-0" />}
                      <span>{m}</span>
                    </button>
                  ))}
                </div>

                {/* Auto Formação toggle (for Duo / Squad) */}
                <button
                  type="button"
                  disabled={!isPartyLeader || matchMode === 'solo'}
                  onClick={() => onChangeAutoFillBots(!autoFillBots)}
                  className={`px-4 py-2 border text-xs font-black uppercase flex items-center justify-between gap-3 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${
                    autoFillBots && matchMode !== 'solo'
                      ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200'
                      : 'bg-[#171d26] border-neutral-600 text-neutral-300'
                  }`}
                >
                  <span>AUTO FORMAÇÃO (BOTS NO TIME)</span>
                  <span className="px-2 py-0.5 bg-black/60 border border-white/20 font-mono text-[10px]">
                    {matchMode === 'solo' ? 'SOLO' : autoFillBots ? 'LIGADA' : 'DESLIGADA'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="py-10 text-center space-y-3">
              <div className="text-lg font-black uppercase text-purple-300">
                OFICINA DE CRIAÇÃO · ILHA DE TREINO
              </div>
              <p className="text-xs text-neutral-300 max-w-md mx-auto">
                Entre direto na Ilha de Treinamento para testar sensibilidade, armas e subida de capa antes da Ranqueada.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onQuickTraining();
                }}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-widest cursor-pointer"
              >
                ENTRAR NO TREINAMENTO
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-black/70 border-t border-white/15 flex items-center justify-between text-[11px] font-mono text-neutral-400">
          <span>
            {!isPartyLeader
              ? 'Apenas o líder do grupo pode alterar o modo.'
              : `${isRanked ? 'BR RANQUEADO' : 'BATTLE ROYALE'} · ${matchMode.toUpperCase()}${matchMode !== 'solo' ? (autoFillBots ? ' · Auto Formação ON' : ' · Sem Bots Aliados') : ''}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider cursor-pointer"
          >
            CONFIRMAR
          </button>
        </div>
      </div>
    </div>
  );
};
