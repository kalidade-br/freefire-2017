import React, { useEffect, useState } from 'react';
import { Mic, MicOff, PhoneOff, Radio, Users, Volume2, VolumeX } from 'lucide-react';
import { voiceChatManager, VoiceParticipant } from '../game/voiceChat';

interface VoiceChatHudWidgetProps {
  compact?: boolean;
}

export const VoiceChatHudWidget: React.FC<VoiceChatHudWidgetProps> = ({ compact = false }) => {
  const [callActive, setCallActive] = useState(false);
  const [callAudioMuted, setCallAudioMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const syncSnapshot = (parts: VoiceParticipant[]) => {
      setParticipants(parts);
      setIsSpeaking(voiceChatManager.isLocalSpeaking());
      setCallAudioMuted(voiceChatManager.isSpeakerMuted());
      setCallActive(voiceChatManager.isCallActive());
    };

    const unsubscribe = voiceChatManager.subscribe(syncSnapshot);
    const interval = window.setInterval(() => {
      setIsSpeaking(voiceChatManager.isLocalSpeaking());
      setCallActive(voiceChatManager.isCallActive());
      setCallAudioMuted(voiceChatManager.isSpeakerMuted());
    }, 200);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  const handleToggleCall = async () => {
    voiceChatManager.resumeAudioPlayback();
    if (!callActive) {
      const ok = await voiceChatManager.startCall();
      if (ok) {
        setCallActive(true);
        setErrorMsg(null);
      } else {
        setErrorMsg(
          voiceChatManager.getLastMicError() ||
            'Permissão de microfone negada ou microfone indisponível.',
        );
        window.setTimeout(() => setErrorMsg(null), 5000);
      }
    } else {
      voiceChatManager.stopCall();
      setCallActive(false);
    }
  };

  const handleToggleMuteCall = () => {
    voiceChatManager.resumeAudioPlayback();
    const nextMuted = voiceChatManager.toggleSpeakerMuted();
    setCallAudioMuted(nextMuted);
  };

  const speakingTeammates = participants.filter((p) => p.isSpeaking).length;
  const inCallTeammates = participants.filter((p) => p.inCall).length;

  return (
    <>
      <div className="flex items-center gap-1 bg-black/80 border border-white/25 px-1.5 py-1 rounded-[2px] shadow-lg pointer-events-auto">
        {/* Button 1: MUTAR / DESMUTAR CALL */}
        <button
          type="button"
          onClick={handleToggleMuteCall}
          title={
            callAudioMuted
              ? 'Call Mutada — Clique para ouvir a equipe'
              : 'Mutar áudio da call da equipe'
          }
          className={`px-2 py-1 rounded-[2px] transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${
            callAudioMuted
              ? 'bg-red-950/90 text-red-300 border border-red-600/80'
              : 'bg-neutral-800/90 hover:bg-neutral-700 text-neutral-100 border border-white/10'
          }`}
        >
          {callAudioMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          )}
          <span className={compact ? 'hidden sm:inline' : ''}>
            {callAudioMuted ? 'MUTADO' : 'MUTAR'}
          </span>
        </button>

        {/* Button 2: FALAR / LIGAR E DESLIGAR A CALL */}
        <button
          type="button"
          onClick={() => void handleToggleCall()}
          title={
            callActive
              ? 'Call Ligada — Clique para desligar a call e fechar o microfone'
              : 'Falar — Clique para ligar a call da equipe'
          }
          className={`relative px-2 py-1 rounded-[2px] transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${
            callActive
              ? isSpeaking
                ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.75)]'
                : 'bg-emerald-700/90 hover:bg-red-700 text-white border border-emerald-400/70'
              : 'bg-amber-500 hover:bg-amber-400 text-black'
          }`}
        >
          {callActive ? (
            isSpeaking ? (
              <Mic className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <PhoneOff className="w-3.5 h-3.5 shrink-0" />
            )
          ) : (
            <MicOff className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{callActive ? 'DESLIGAR' : 'FALAR'}</span>
          {callActive && isSpeaking && (
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping shrink-0" />
          )}
        </button>

        {/* Team Voice Call Status / Participants Modal */}
        <button
          type="button"
          onClick={() => setShowModal((v) => !v)}
          title="Participantes da Call da Equipe"
          className="px-1.5 py-1 rounded-[2px] bg-neutral-800/80 hover:bg-neutral-700 text-amber-300 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold"
        >
          <Users className="w-3.5 h-3.5" />
          <span>{inCallTeammates + (callActive ? 1 : 0)}</span>
          {speakingTeammates > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 border border-red-600 text-red-200 px-3 py-1.5 text-xs font-bold rounded shadow-xl">
          {errorMsg}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 pointer-events-auto bg-black/75 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md bg-neutral-900 border-2 border-amber-400/80 p-4 shadow-2xl rounded text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">
                  Call da Equipe ({participants.length + 1})
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

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={handleToggleMuteCall}
                className={`py-2 px-3 text-xs font-black uppercase rounded flex items-center justify-center gap-1.5 cursor-pointer border ${
                  callAudioMuted
                    ? 'bg-red-950 text-red-200 border-red-600'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-600'
                }`}
              >
                {callAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{callAudioMuted ? 'CALL MUTADA' : 'MUTAR CALL'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleToggleCall()}
                className={`py-2 px-3 text-xs font-black uppercase rounded flex items-center justify-center gap-1.5 cursor-pointer border ${
                  callActive
                    ? 'bg-red-700 hover:bg-red-600 text-white border-red-400'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                }`}
              >
                {callActive ? <PhoneOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{callActive ? 'DESLIGAR CALL' : 'LIGAR CALL / FALAR'}</span>
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <div className="flex items-center justify-between bg-neutral-800/80 p-2.5 rounded border border-neutral-700">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      callActive
                        ? isSpeaking
                          ? 'bg-emerald-400 animate-ping'
                          : 'bg-emerald-400'
                        : 'bg-neutral-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-white">Você</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-300">
                  {callActive
                    ? isSpeaking
                      ? 'Falando'
                      : 'Na Call'
                    : 'Call Desligada'}
                </span>
              </div>

              {participants.length === 0 ? (
                <div className="text-center py-6 text-xs text-neutral-400 italic">
                  Entre em um grupo Duo/Squad ou partida em equipe para conversar na call.
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
                            p.isSpeaking
                              ? 'bg-emerald-400 animate-ping'
                              : p.inCall
                                ? 'bg-sky-400'
                                : 'bg-neutral-500'
                          }`}
                        />
                        <span className="text-xs font-bold text-white truncate max-w-[150px]">
                          {p.nickname}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-amber-300">
                          {p.isSpeaking ? 'Falando' : p.inCall ? 'Na Call' : 'Offline na call'}
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
                          {isMutedByMe ? 'Mutado' : 'Mutar'}
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
