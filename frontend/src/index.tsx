import React from 'react';
import { createRoot } from 'react-dom/client';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Pomodoro from './containers/Pomodoro';
import Dashboard from './containers/Dashboard';
import AnkiPage from './containers/AnkiPage';
import Scheduler from './containers/Scheduler';
import StudyPlannerPage from './containers/StudyPlannerPage';
import QuizPage from './containers/QuizPage';
import DocumentsPage from './containers/DocumentsPage';
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

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <DndProvider backend={HTML5Backend}>
      <BrowserRouter>
        <ThemeBootstrap />
        <Routes>
          <Route path="/" element={<Pomodoro />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/anki" element={<AnkiPage />} />
          <Route path="/scheduler" element={<Scheduler />} />
          <Route path="/planner" element={<StudyPlannerPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/docs" element={<DocumentsPage />} />
        </Routes>
      </BrowserRouter>
    </DndProvider>
  </React.StrictMode>
);
