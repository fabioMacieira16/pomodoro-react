import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_LABEL, APP_NAME, APP_TAGLINE } from '../appInfo';
import { useAuthStore } from '../store/authStore';
import './LoginPage.css';

type Mode = 'signin' | 'signup' | 'forgot';

const MIN_PASSWORD = 8;
const RETURN_TO_KEY = 'focoplus-return-to';

// Google e o link de confirmação por e-mail recarregam o app em "/"; guardamos a tela
// atual para devolver a pessoa a ela depois (lido em index.tsx).
function rememberReturnPath() {
  try {
    const path = window.location.pathname;
    if (path !== '/' && path !== '/login') sessionStorage.setItem(RETURN_TO_KEY, path);
  } catch {
    // sessionStorage indisponível: a pessoa cai em "/".
  }
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const recovery = useAuthStore((s) => s.recovery);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const updatePassword = useAuthStore((s) => s.updatePassword);

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword('');
    setConfirm('');
  };

  const validatePasswords = (): string | null => {
    if (password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
    if (password !== confirm) return 'As senhas não conferem.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);

    const cleanEmail = email.trim().toLowerCase();

    if (recovery) {
      const invalid = validatePasswords();
      if (invalid) return setError(invalid);
      setBusy(true);
      const err = await updatePassword(password);
      setBusy(false);
      if (err) setError(err);
      return;
    }

    if (mode === 'signup') {
      const invalid = validatePasswords();
      if (invalid) return setError(invalid);
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        const err = await signIn(cleanEmail, password);
        if (err) setError(err);
      } else if (mode === 'signup') {
        rememberReturnPath();
        const { error: err, needsConfirmation } = await signUp(cleanEmail, password);
        if (err) {
          setError(err);
        } else if (needsConfirmation) {
          setInfo(`Enviamos um link de confirmação para ${cleanEmail}. Confirme o e-mail para ativar a conta e depois entre.`);
          setMode('signin');
          setPassword('');
          setConfirm('');
        }
      } else {
        const err = await sendPasswordReset(cleanEmail);
        if (err) {
          setError(err);
        } else {
          setInfo('Se esse e-mail tiver cadastro, enviamos um link para redefinir a senha.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    rememberReturnPath();
    const err = await signInWithGoogle();
    // Em caso de sucesso a página é redirecionada ao Google.
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  const title = recovery
    ? 'Definir nova senha'
    : mode === 'signin'
      ? 'Entrar'
      : mode === 'signup'
        ? 'Criar conta'
        : 'Recuperar senha';

  const needsPassword = recovery || mode !== 'forgot';
  const needsConfirm = recovery || mode === 'signup';

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <header className="login-brand">
          <span className="login-brand-name">{APP_NAME}</span>
          <span className="login-brand-tagline">{APP_TAGLINE}</span>
        </header>

        <h1 id="login-title" className="login-title">{title}</h1>

        {!recovery && mode !== 'forgot' && (
          <>
            <button type="button" className="login-google" onClick={handleGoogle} disabled={busy}>
              <GoogleIcon />
              <span>Continuar com Google</span>
            </button>
            <div className="login-divider"><span>ou</span></div>
          </>
        )}

        <form onSubmit={handleSubmit}>
          {!recovery && (
            <label className="login-field">
              <span>E-mail</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </label>
          )}

          {needsPassword && (
            <label className="login-field">
              <span>{recovery ? 'Nova senha' : 'Senha'}</span>
              <input
                type="password"
                autoComplete={mode === 'signin' && !recovery ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'signin' && !recovery ? undefined : MIN_PASSWORD}
                required
              />
            </label>
          )}

          {needsConfirm && (
            <label className="login-field">
              <span>Confirmar senha</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
          )}

          {error && <p className="login-message login-error" role="alert">{error}</p>}
          {info && <p className="login-message login-info" role="status">{info}</p>}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy
              ? 'Aguarde…'
              : recovery
                ? 'Salvar nova senha'
                : mode === 'signin'
                  ? 'Entrar'
                  : mode === 'signup'
                    ? 'Criar conta'
                    : 'Enviar link'}
          </button>
        </form>

        {!recovery && (
          <nav className="login-links" aria-label="Opções de acesso">
            {mode === 'signin' && (
              <>
                <button type="button" onClick={() => switchMode('forgot')}>Esqueci a senha</button>
                <button type="button" onClick={() => switchMode('signup')}>Criar conta</button>
              </>
            )}
            {mode !== 'signin' && (
              <button type="button" onClick={() => switchMode('signin')}>Voltar para entrar</button>
            )}
          </nav>
        )}

        {!recovery && (
          <div className="login-links login-links-center">
            <button type="button" onClick={() => navigate('/')}>Voltar ao Pomodoro</button>
          </div>
        )}

        <footer className="login-footer">{APP_LABEL}</footer>
      </section>
    </main>
  );
};

export default LoginPage;
