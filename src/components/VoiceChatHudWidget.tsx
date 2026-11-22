import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Users, Radio } from 'lucide-react';
import { voiceChatManager, VoiceParticipant } from '../game/voiceChat';

export const VoiceChatHudWidget: React.FC = () => {
  const [micActive, setMicActive] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = voiceChatManager.subscribe((parts) => {
      setParticipants(parts);
      setIsSpeaking(voiceChatManager.isLocalSpeaking());
      setSpeakerMuted(voiceChatManager.isSpeakerMuted());
      setMicActive(!voiceChatManager.isMicMuted() && voiceChatManager['localStream'] !== null);
    });

    const interval = window.setInterval(() => {
      setIsSpeaking(voiceChatManager.isLocalSpeaking());
    }, 200);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  const handleToggleMic = async () => {
    if (!micActive) {
      const ok = await voiceChatManager.initializeMicrophone();
      if (ok) {
        voiceChatManager.setMicMuted(false);
        setMicActive(true);
        setErrorMsg(null);
      } else {
        setErrorMsg('Permissão de microfone negada ou erro.');
        setTimeout(() => setErrorMsg(null), 4000);
      }
    } else {
      const nextMuted = !voiceChatManager.isMicMuted();
      voiceChatManager.setMicMuted(nextMuted);
      setMicActive(!nextMuted);
    }
  };

  const handleToggleSpeaker = () => {
    const next = !speakerMuted;
    voiceChatManager.setSpeakerMuted(next);
    setSpeakerMuted(next);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 bg-black/80 border border-white/25 px-2 py-1 rounded-[2px] shadow-lg pointer-events-auto">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={() => void handleToggleMic()}
          title={micActive ? 'Microfone Ativo (Clique para silenciar)' : 'Ativar Microfone de Voz'}
          className={`relative p-1.5 rounded-[2px] transition-colors cursor-pointer flex items-center justify-center ${
            micActive
              ? isSpeaking
                ? 'bg-emerald-500 text-black animate-pulse shadow-[0_0_10px_#10b981]'
                : 'bg-emerald-600/80 text-white'
              : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
          }`}
        >
          {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          {micActive && isSpeaking && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-300 rounded-full animate-ping" />
          )}
        </button>

        {/* Speaker / Audio Output Toggle */}
        <button
          type="button"
          onClick={handleToggleSpeaker}
          title={speakerMuted ? 'Áudio de voz desativado' : 'Áudio de voz ativado'}
          className={`p-1.5 rounded-[2px] transition-colors cursor-pointer flex items-center justify-center ${
            speakerMuted ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-neutral-800/80 text-white'
          }`}
        >
          {speakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Participants & Mute List Modal Button */}
        <button
          type="button"
          onClick={() => setShowModal((v) => !v)}
          title="Lista de Participantes de Voz"
          className="p-1.5 rounded-[2px] bg-neutral-800/80 hover:bg-neutral-700 text-amber-300 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-mono font-bold"
        >
          <Users className="w-4 h-4" />
          <span>{participants.filter((p) => p.isSpeaking).length > 0 ? '📡' : ''}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 border border-red-600 text-red-200 px-3 py-1.5 text-xs font-bold rounded shadow-xl animate-bounce">
          {errorMsg}
        </div>
      )}

      {/* Participants Mute Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 pointer-events-auto bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border-2 border-amber-400/80 p-4 shadow-2xl rounded text-white">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-amber-400 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">
                  Chat de Voz da Partida ({participants.length + 1})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-white font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {/* Local Player */}
              <div className="flex items-center justify-between bg-neutral-800/80 p-2.5 rounded border border-neutral-700">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-white">Você (Lider / Jogador)</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-300">
                  {micActive ? (isSpeaking ? 'Falando 🎙️' : 'Conectado') : 'Microfone Desligado'}
                </span>
              </div>

              {/* Remote Participants */}
              {participants.length === 0 ? (
                <div className="text-center py-6 text-xs text-neutral-400 italic">
                  Nenhum outro jogador conectado ao chat de voz nesta sala ainda.
                </div>
              ) : (
                participants.map((p) => {
                  const isMutedByMe = voiceChatManager.isPlayerMuted(p.accountId);
                  return (
                    <div
                      key={p.accountId}
                      className="flex items-center justify-between bg-neutral-800/80 p-2.5 rounded border border-neutral-700"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            p.isSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-neutral-500'
                          }`}
                        />
                        <span className="text-xs font-bold text-white truncate max-w-[150px]">{p.nickname}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-amber-300">
                          {p.isSpeaking ? 'Falando 🎙️' : 'Ouvindo'}
                        </span>
                        <button
                          type="button"
                          onClick={() => voiceChatManager.toggleMutePlayer(p.accountId)}
                          className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                            isMutedByMe
                              ? 'bg-red-950 text-red-300 border border-red-700'
                              : 'bg-neutral-700 hover:bg-neutral-600 text-white'
                          }`}
                        >
                          {isMutedByMe ? 'Silenciado 🔇' : 'Silenciar'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded cursor-pointer shadow"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
