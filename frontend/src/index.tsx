import React from 'react';
import { createRoot } from 'react-dom/client';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Pomodoro from './containers/Pomodoro';
import Dashboard from './containers/Dashboard';
import AnkiPage from './containers/AnkiPage';
import EstudosPage from './containers/EstudosPage';
import LoginPage from './containers/LoginPage';
import FixedMenu from './components/FixedMenu';
import { isAuthEnabled } from './api/supabase';
import { useAuthStore } from './store/authStore';
import AchievementCelebration from './components/AchievementCelebration';
import { usePomodoroSettings } from './store/pomodoroSettingsStore';
import './style.css';

function ThemeBootstrap() {
  const darkMode = usePomodoroSettings((state) => state.darkMode);
  const syncFromBackend = usePomodoroSettings((state) => state.syncFromBackend);
  const userId = useAuthStore((state) => state.user?.id);

  // Sincroniza as configurações ao abrir o app e de novo quando a pessoa entra.
  useEffect(() => {
    void syncFromBackend();
  }, [syncFromBackend, userId]);

  useEffect(() => {
    const applyDark = (enabled: boolean) => {
      document.documentElement.classList.toggle('dark', enabled);
    };

    if (darkMode === 'dark') {
      applyDark(true);
      return;
    }

    if (darkMode === 'light') {
      applyDark(false);
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    applyDark(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => applyDark(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [darkMode]);

  return null;
}

const RETURN_TO_KEY = 'focoplus-return-to';

// Mantém a sessão do Supabase sincronizada com o authStore durante todo o uso do app.
function AuthBootstrap() {
  const user = useAuthStore((state) => state.user);
  const init = useAuthStore((state) => state.init);
  const navigate = useNavigate();

  useEffect(() => init(), [init]);

  // Depois do redirecionamento do Google / link de e-mail a pessoa volta para "/";
  // aqui devolvemos para a tela em que ela estava.
  useEffect(() => {
    if (!user) return;
    try {
      const target = sessionStorage.getItem(RETURN_TO_KEY);
      if (!target) return;
      sessionStorage.removeItem(RETURN_TO_KEY);
      if (target !== window.location.pathname) navigate(target, { replace: true });
    } catch {
      // sessionStorage indisponível: segue na tela atual.
    }
  }, [user, navigate]);

  return null;
}

// Telas que exigem conta. Sem Supabase configurado (dev local) abrem direto.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  if (!isAuthEnabled) return <>{children}</>;
  if (loading) return <div className="auth-loading">Carregando…</div>;
  if (!user) return <LoginPage />;
  return <>{children}</>;
}

function LoginRoute() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  if (!isAuthEnabled || user) return <Navigate to="/" replace />;
  if (loading) return <div className="auth-loading">Carregando…</div>;
  return <LoginPage />;
}

function AppRoutes() {
  const location = useLocation();
  const recovery = useAuthStore((state) => state.recovery);
  const isPomodoro = location.pathname === '/';

  // Chegou pelo link "esqueci a senha": define a nova senha antes de qualquer outra coisa.
  if (isAuthEnabled && recovery) return <LoginPage />;

  return (
    <>
      <AchievementCelebration />
      {!isPomodoro && <FixedMenu />}
      <Routes>
        {/* O Pomodoro é livre; o resto exige login. */}
        <Route path="/" element={<Pomodoro />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/anki" element={<RequireAuth><AnkiPage /></RequireAuth>} />
        <Route path="/estudos" element={<RequireAuth><EstudosPage /></RequireAuth>} />
        <Route path="/scheduler" element={<Navigate to="/estudos" replace />} />
        <Route path="/study-planner" element={<Navigate to="/estudos" replace />} />
      </Routes>
    </>
  );
}

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <DndProvider backend={HTML5Backend}>
      <BrowserRouter>
        <AuthBootstrap />
        <ThemeBootstrap />
        <AppRoutes />
      </BrowserRouter>
    </DndProvider>
  </React.StrictMode>
);
