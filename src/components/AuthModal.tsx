import React, { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { KeyRound, LogIn, LogOut, ShieldCheck, UserPlus, X } from 'lucide-react';
import { multiplayerClient } from '../game/multiplayerClient';
import { loadCharacterConfig, loadProfile } from '../game/storage';
import { auth, googleAuthProvider } from '../lib/firebase';
import { loadOrCreateFirestoreProfile } from '../lib/firestoreProfile';
import { PublicPlayerAccount } from '../shared/multiplayerTypes';

interface AuthModalProps {
  currentAccount: PublicPlayerAccount | null;
  onAuthenticated: (account: PublicPlayerAccount) => void;
  onLoggedOut: () => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentAccount,
  onAuthenticated,
  onLoggedOut,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setBusy(true);
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
            character: {
              ...res.account.character,
              modelId: fsProf.characterModelId,
            },
          }
        : res.account;

      if (fsProf) {
        void multiplayerClient
          .updateProfile({
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
            character: { modelId: fsProf.characterModelId },
          })
          .catch(() => undefined);
      }

      onAuthenticated(mergedAccount);
      onClose();
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setError(
          `Domínio "${host}" ainda não autorizado no Firebase Auth. Adicione "${host}" em Firebase Console → Authentication → Settings → Authorized domains.`,
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Erro ao entrar com Google (Firebase).',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanUser = username.trim();
    if (cleanUser.length < 3) {
      setError('Usuário deve ter pelo menos 3 caracteres.');
      return;
    }
    if (password.length < 4) {
      setError('Senha deve ter pelo menos 4 caracteres.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        const res = await multiplayerClient.register({
          username: cleanUser,
          password,
          nickname: nickname.trim() || cleanUser,
        });
        onAuthenticated(res.account);
        onClose();
      } else {
        const res = await multiplayerClient.login({
          username: cleanUser,
          password,
        });
        onAuthenticated(res.account);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar no servidor.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    await multiplayerClient.logout();
    await signOut(auth).catch(() => undefined);
    setBusy(false);
    onLoggedOut();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 text-white"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#14181e] border-2 border-amber-500 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#1d232c] border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h2 className="font-black text-sm tracking-widest uppercase text-amber-400">
              {currentAccount ? 'CONTA MULTIPLAYER' : 'ENTRAR / CRIAR CONTA'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {currentAccount ? (
          <div className="p-5 space-y-4">
            <div className="bg-[#0e1318] border border-emerald-500/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-black text-emerald-300 uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  <span>CONECTADO AO SERVIDOR</span>
                </span>
                <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono font-black text-amber-300">
                  ID #{currentAccount.publicId}
                </span>
              </div>
              <div className="text-base font-black text-white">
                {currentAccount.nickname}
              </div>
              <div className="text-[11px] font-mono text-neutral-400">
                Usuário: <strong className="text-neutral-200">{currentAccount.username}</strong> · Nv.{currentAccount.level} · {currentAccount.rankPoints} PTS
              </div>
            </div>

            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Sua conta, amigos, patente, ouro e estatísticas estão salvos na nuvem. Informe seu ID{' '}
              <strong className="text-amber-300">#{currentAccount.publicId}</strong> ou apelido para seus amigos te adicionarem.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleLogout}
                className="flex-1 py-2.5 bg-red-950/80 hover:bg-red-900 border border-red-600 text-red-200 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>SAIR DA CONTA</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider cursor-pointer"
              >
                CONTINUAR
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGoogleSignIn()}
              className="w-full py-2.5 px-3 bg-white hover:bg-neutral-100 text-neutral-900 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg"
            >
              <span className="w-4 h-4 rounded-full bg-amber-500 text-black font-black text-[10px] flex items-center justify-center">
                G
              </span>
              <span>{busy ? 'CONECTANDO...' : 'ENTRAR COM GOOGLE (FIREBASE)'}</span>
            </button>

            <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 uppercase">
              <div className="flex-1 h-px bg-neutral-800" />
              <span>OU CONTA CLÁSSICA</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-1.5 bg-[#0d1117] p-1 border border-neutral-700">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`py-2 text-xs font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'login'
                      ? 'bg-amber-500 text-black'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>ENTRAR</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`py-2 text-xs font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'register'
                      ? 'bg-amber-500 text-black'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>CRIAR CONTA</span>
                </button>
              </div>

              {error && (
                <div className="px-3 py-2 bg-red-950/85 border border-red-500 text-red-200 text-xs font-mono">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase text-neutral-300">
                  Usuário
                </label>
                <input
                  type="text"
                  autoFocus
                  maxLength={24}
                  placeholder="ex: nobru17"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#0e1218] border border-neutral-600 focus:border-amber-400 px-3 py-2 text-sm text-white font-mono focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase text-neutral-300">
                  Senha
                </label>
                <input
                  type="password"
                  maxLength={64}
                  placeholder="mínimo 4 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0e1218] border border-neutral-600 focus:border-amber-400 px-3 py-2 text-sm text-white font-mono focus:outline-none"
                />
              </div>

              {mode === 'register' && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase text-neutral-300">
                    Apelido no Jogo (opcional)
                  </label>
                  <input
                    type="text"
                    maxLength={18}
                    placeholder="Como vai aparecer nas partidas"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-[#0e1218] border border-neutral-600 focus:border-amber-400 px-3 py-2 text-sm text-white font-mono focus:outline-none"
                  />
                </div>
              )}

              <p className="text-[10px] font-mono text-neutral-400 leading-relaxed">
                Entre com sua conta Google (Firebase + Firestore) ou crie usuário e senha para salvar seu progresso, adicionar amigos e usar a call de voz da equipe!
              </p>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs uppercase tracking-[0.16em] cursor-pointer disabled:opacity-50"
              >
                {busy
                  ? 'CONECTANDO...'
                  : mode === 'register'
                    ? 'CRIAR CONTA E ENTRAR'
                    : 'ENTRAR NA CONTA'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
