import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  Award,
  KeyRound,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { isGuestAccount, multiplayerClient } from '../game/multiplayerClient';
import { loadCharacterConfig, loadProfile } from '../game/storage';
import { auth, googleAuthProvider } from '../lib/firebase';
import { loadOrCreateFirestoreProfile } from '../lib/firestoreProfile';
import { PublicPlayerAccount } from '../shared/multiplayerTypes';
import winterlandsLoginBg from '../assets/images/winterlands_login_hd_1795808030589.jpg';

interface MainMenuScreenProps {
  onPlay: () => void;
  onGuestLogin: () => Promise<void>;
  onGoogleAuthenticated: (account: PublicPlayerAccount) => void;
  onLogout: () => Promise<void>;
  onOpenCharacter: () => void;
  onOpenSettings: () => void;
  onOpenCredits: () => void;
  onOpenAuth: () => void;
  account: PublicPlayerAccount | null;
  hasActiveSession: boolean;
  muted: boolean;
  onToggleMute: () => void;
  nickname: string;
}

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  onPlay,
  onGuestLogin,
  onGoogleAuthenticated,
  onLogout,
  onOpenCharacter,
  onOpenSettings,
  onOpenCredits,
  onOpenAuth,
  account,
  hasActiveSession,
  muted,
  onToggleMute,
  nickname,
}) => {
  const [busy, setBusy] = useState<'google' | 'guest' | 'logout' | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const isGuest = isGuestAccount(account);
  const isLoggedIn = Boolean(account || hasActiveSession);

  const handleUnlockAndPlay = () => {
    soundEngine.unlock();
    soundEngine.setLobbyMusicMode('lobby');
    onPlay();
  };

  const handleGoogleSignIn = async () => {
    soundEngine.unlock();
    soundEngine.setLobbyMusicMode('lobby');
    setAuthError(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setAuthError('Sem internet no momento. Use Convidado ou verifique sua rede.');
      return;
    }
    setBusy('google');
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const user = cred.user;
      const idToken = await user.getIdToken();
      const localProf = loadProfile();
      const localChar = loadCharacterConfig();

      const res = await multiplayerClient.loginWithFirebase({
        idToken,
        nickname: user.displayName || localProf.nickname,
        character: localChar,
      });

      const fsProf = await loadOrCreateFirestoreProfile(
        user,
        localProf,
        localChar,
        res.account.publicId,
      ).catch(() => null);

      const mergedAccount: PublicPlayerAccount = fsProf
        ? {
            ...res.account,
            nickname: fsProf.nickname,
            level: fsProf.level,
            gold: fsProf.gold,
            gems: fsProf.gems,
            matchesPlayed: fsProf.matchesPlayed,
            wins: fsProf.wins,
            rankPoints: fsProf.rankPoints,
            rankedMatches: fsProf.rankedMatches,
            rankedWins: fsProf.rankedWins,
            totalKills: fsProf.totalKills,
            avatarId: fsProf.avatarId,
            unlockedAvatars: fsProf.unlockedAvatars,
            seasonId: fsProf.seasonId,
            s1PeakRankPoints: fsProf.s1PeakRankPoints,
            s1ClaimedRewards: fsProf.s1ClaimedRewards,
            character: {
              ...res.account.character,
              modelId: fsProf.characterModelId,
              avatarId: fsProf.avatarId,
              equippedSkins: res.account.character?.equippedSkins ?? localChar.equippedSkins,
            },
          }
        : res.account;

      if (fsProf) {
        void multiplayerClient
          .updateProfile({
            nickname: fsProf.nickname,
            avatarId: fsProf.avatarId,
            level: fsProf.level,
            gold: fsProf.gold,
            gems: fsProf.gems,
            matchesPlayed: fsProf.matchesPlayed,
            wins: fsProf.wins,
            rankPoints: fsProf.rankPoints,
            rankedMatches: fsProf.rankedMatches,
            rankedWins: fsProf.rankedWins,
            totalKills: fsProf.totalKills,
            character: {
              modelId: fsProf.characterModelId,
              avatarId: fsProf.avatarId,
              equippedSkins: res.account.character?.equippedSkins ?? localChar.equippedSkins,
            },
          })
          .catch(() => undefined);
      }

      onGoogleAuthenticated(mergedAccount);
      onPlay();
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        setAuthError(
          'Login Google precisa estar ativado no Firebase Auth (Sign-in method → Google).',
        );
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthError(
          `Domínio "${host}" não autorizado no Firebase Auth. Adicione em Authorized domains.`,
        );
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Pop-up bloqueado pelo navegador. Permita pop-ups para entrar com Google.',
        );
      } else if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        setAuthError('Login Google cancelado.');
      } else if (code === 'auth/network-request-failed') {
        setAuthError('Erro de conexão com o Google/Firebase. Tente novamente ou entre como Convidado.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'Erro ao entrar com Google.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleGuestStart = async () => {
    soundEngine.unlock();
    soundEngine.setLobbyMusicMode('lobby');
    setAuthError(null);
    setBusy('guest');
    try {
      await onGuestLogin();
      onPlay();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Não foi possível entrar como convidado.');
    } finally {
      setBusy(null);
    }
  };

  const handleLogoutClick = async () => {
    soundEngine.unlock();
    soundEngine.playUiClick(480);
    setAuthError(null);
    setBusy('logout');
    try {
      await onLogout();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      onPointerDown={() => {
        soundEngine.unlock();
        soundEngine.setLobbyMusicMode('lobby');
      }}
      className="fixed inset-0 z-40 bg-black flex items-center justify-center overflow-hidden select-none text-white"
    >
      {/* Winterlands Free Fire Login / Pre-Lobby Background (HD, clean) */}
      <div className="relative w-full h-full overflow-hidden flex flex-col">
        <img
          src={winterlandsLoginBg}
          alt="Free Fire Battlegrounds"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none brightness-[0.96] contrast-[1.03]"
        />

        {/* Subtle legibility gradient along top-right & bottom center */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,10,16,0.28) 0%, rgba(6,10,16,0.04) 38%, rgba(6,10,16,0.18) 62%, rgba(5,8,12,0.58) 100%)',
          }}
        />

        {/* Top-Right Header (z-30 above everything so LOG OUT & icons ALWAYS register clicks) */}
        <header className="relative z-30 w-full flex items-start justify-end px-2.5 pt-2 sm:px-5 sm:pt-3.5 shrink-0 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute();
                }}
                title={muted ? 'Ativar Som' : 'Mudo'}
                className="bg-black/55 hover:bg-black/80 border border-white/25 p-1.5 cursor-pointer transition-colors"
              >
                {muted ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
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
                className="bg-black/55 hover:bg-black/80 border border-white/25 p-1.5 cursor-pointer transition-colors"
              >
                <User className="w-3.5 h-3.5 text-amber-300" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.unlock();
                  onOpenSettings();
                }}
                title="Configurações"
                className="bg-black/55 hover:bg-black/80 border border-white/25 p-1.5 cursor-pointer transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-neutral-100" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.unlock();
                  onOpenCredits();
                }}
                title="Créditos"
                className="bg-black/55 hover:bg-black/80 border border-white/25 p-1.5 cursor-pointer transition-colors"
              >
                <Award className="w-3.5 h-3.5 text-sky-300" />
              </button>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] sm:text-[11px] font-mono font-bold text-white/95 tracking-wider leading-none mb-1 drop-shadow">
                1.7.13
              </span>
              {isLoggedIn ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleLogoutClick();
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 bg-black/65 hover:bg-black/90 active:scale-95 border border-white/50 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white cursor-pointer transition-all"
                  title="Sair da conta atual e escolher método de login"
                >
                  <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-white/90 text-black flex items-center justify-center rounded-[2px] shrink-0">
                    <LogOut className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </span>
                  <span>{busy === 'logout' ? '...' : 'LOG OUT'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEngine.unlock();
                    onOpenAuth();
                  }}
                  className="flex items-center gap-1.5 bg-black/65 hover:bg-black/90 border border-white/50 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-200 cursor-pointer transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>CONTA</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Responsive Lower-Center Stage: keeps artwork's FREE FIRE title clear above interactive controls */}
        <main className="relative z-20 flex-1 min-h-0 flex flex-col items-center justify-end px-3 pb-[11vh] sm:pb-[14vh] [@media(max-height:460px)]:pb-3 overflow-y-auto pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md flex flex-col items-center">
            {authError && (
              <div className="mb-2.5 max-w-xs sm:max-w-sm w-full bg-red-950/95 border border-red-400 px-2.5 py-1.5 text-[10px] sm:text-[11px] font-mono text-red-100 text-center shadow-xl">
                {authError}
              </div>
            )}

            {isLoggedIn ? (
              <div className="flex flex-col items-center gap-2 sm:gap-2.5 w-full max-w-[300px] sm:max-w-[340px]">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnlockAndPlay();
                  }}
                  className="w-full py-2.5 sm:py-3.5 bg-gradient-to-b from-[#ffce2e] via-[#f4ab05] to-[#df8d00] hover:brightness-110 active:scale-[0.98] border border-[#ffe483] text-[#1a1102] font-extrabold text-xs sm:text-base uppercase tracking-[0.12em] shadow-[0_8px_28px_rgba(0,0,0,0.85)] cursor-pointer transition-all"
                >
                  START GAME
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEngine.unlock();
                    onOpenAuth();
                  }}
                  className="max-w-full flex items-center gap-1.5 px-2.5 py-1 bg-black/75 hover:bg-black/90 border border-white/30 text-[10px] sm:text-[11px] font-mono text-white/95 cursor-pointer transition-colors shadow-lg"
                >
                  {isGuest || !account ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      <span className="truncate">
                        Convidado {account ? `#${account.publicId}` : ''} · {account?.nickname ?? nickname}
                      </span>
                      <span className="text-amber-300 font-bold shrink-0">· Google</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        #{account.publicId} · {account.nickname}
                      </span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="w-full max-w-[285px] sm:max-w-[330px] flex flex-col items-stretch gap-2 bg-black/75 border border-white/25 p-2.5 sm:p-3 shadow-[0_10px_30px_rgba(0,0,0,0.85)]">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleGoogleSignIn();
                  }}
                  className="w-full py-2 sm:py-2.5 px-3 bg-white hover:bg-neutral-100 active:scale-[0.985] text-neutral-900 font-bold text-[11px] sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_6px_22px_rgba(0,0,0,0.75)] cursor-pointer disabled:opacity-60 transition-all"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.49 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.91 6.16-4.91z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-1.99 3.72-4.92 3.72-8.69z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.08.72-2.45 1.16-4.23 1.16-2.86 0-5.29-2.31-6.16-4.91l-3.66 2.84C3.99 20.53 7.7 23 12 23z"
                    />
                  </svg>
                  <span>{busy === 'google' ? 'CONECTANDO...' : 'ENTRAR COM GOOGLE'}</span>
                </button>

                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleGuestStart();
                    }}
                    className="py-2 sm:py-2.5 px-2.5 bg-[#15303b]/95 hover:bg-[#1c4454] border border-cyan-300/60 text-cyan-100 font-bold text-[11px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-60 transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    <span>{busy === 'guest' ? '...' : 'CONVIDADO'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEngine.unlock();
                      onOpenAuth();
                    }}
                    className="py-2 sm:py-2.5 px-2.5 bg-gradient-to-b from-[#d89004] to-[#a96802] hover:brightness-110 border border-[#f5c451]/65 text-[#1a1102] font-bold text-[11px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-60 transition-all"
                  >
                    <KeyRound className="w-3.5 h-3.5 shrink-0" />
                    <span>CONTA</span>
                  </button>
                </div>

                <div className="text-center text-[9px] sm:text-[10px] font-mono text-white/85 drop-shadow leading-tight">
                  Convidados jogam online sem login · Google salva na nuvem
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
