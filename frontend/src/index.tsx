import React from 'react';
import { createRoot } from 'react-dom/client';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
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

  useEffect(() => {
    void syncFromBackend();
  }, [syncFromBackend]);

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

function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const recovery = useAuthStore((state) => state.recovery);
  const init = useAuthStore((state) => state.init);

  useEffect(() => init(), [init]);

  // Sem Supabase configurado (dev local) o app abre direto, como antes.
  if (!isAuthEnabled) return <>{children}</>;
  if (loading) return <div className="auth-loading">Carregando…</div>;
  if (!user || recovery) return <LoginPage />;
  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();
  const isPomodoro = location.pathname === '/';

  return (
    <>
      <AchievementCelebration />
      {!isPomodoro && <FixedMenu />}
      <Routes>
        <Route path="/" element={<Pomodoro />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/anki" element={<AnkiPage />} />
        <Route path="/estudos" element={<EstudosPage />} />
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
        <AuthGate>
          <ThemeBootstrap />
          <AppRoutes />
        </AuthGate>
      </BrowserRouter>
    </DndProvider>
  </React.StrictMode>
);
