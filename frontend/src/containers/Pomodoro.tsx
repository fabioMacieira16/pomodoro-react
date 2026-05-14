import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TypeSelect from '../components/TypeSelect';
import TimeDisplay from '../components/TimeDisplay';
import Controls from '../components/Controls';
import Shortcuts from '../components/Shortcuts';
import ToggleSound from '../components/ToggleSound';
import ToggleTask from '../components/Tasks/TaskToggle';
import TaskList from '../components/Tasks/TaskList';
import ProductivityModal from '../components/ProductivityModal';
import SettingsPanel from '../components/SettingsPanel';
import PomodoroStats from '../components/PomodoroStats';
import PomodoroDots from '../components/PomodoroDots';
import { usePomodoroEngine, PHASE_LABELS } from '../hooks/usePomodoroEngine';
import { usePomodoroSettings } from '../store/pomodoroSettingsStore';
import type { TimerPhase } from '../types';
import './Pomodoro.css';

const PHASE_ITEMS = [
  { name: 'Pomodoro',    time: 0, phase: 'pomodoro'   as TimerPhase },
  { name: 'Pausa Curta', time: 0, phase: 'shortBreak' as TimerPhase },
  { name: 'Pausa Longa', time: 0, phase: 'longBreak'  as TimerPhase },
];

const STATUS_MAP: Record<string, 'Finished' | 'Paused' | 'Running' | null> = {
  finished: 'Finished',
  paused:   'Paused',
  running:  'Running',
};

const Pomodoro: React.FC = () => {
  const navigate  = useNavigate();
  const engine   = usePomodoroEngine();
  const settings = usePomodoroSettings();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(() => {
    const saved = localStorage.getItem('pomodoro-react-taskStatus');
    return saved ? JSON.parse(saved) : false;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Dark mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const applyDark = (dark: boolean) => {
      document.documentElement.classList.toggle('dark', dark);
    };
    if (settings.darkMode === 'dark') {
      applyDark(true);
      return;
    }
    if (settings.darkMode === 'light') {
      applyDark(false);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.darkMode]);

  // ── Sync settings from backend on mount ───────────────────────────────────
  useEffect(() => {
    settings.syncFromBackend();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch { /* not supported */ }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (engine.status === 'idle' || engine.status === 'finished') engine.start();
          else if (engine.status === 'running') engine.pause();
          else if (engine.status === 'paused') engine.resume();
          break;
        case 'Escape':
          engine.reset();
          setSettingsOpen(false);
          break;
        case 'f': case 'F':
          settings.update({ focusMode: !settings.focusMode });
          break;
        case 'd': case 'D':
          toggleFullscreen();
          break;
        case '1': engine.changePhase('pomodoro');   break;
        case '2': engine.changePhase('shortBreak'); break;
        case '3': engine.changePhase('longBreak');  break;
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [engine, settings, toggleFullscreen]);

  // ── Controls adapter ───────────────────────────────────────────────────────
  const controlStatus = STATUS_MAP[engine.status] ?? null;

  const handleStart = () => {
    if (engine.status === 'finished') engine.changePhase(engine.phase);
    engine.start();
  };

  const handlePause = () => {
    if (engine.status === 'running') engine.pause();
    else if (engine.status === 'paused') engine.resume();
  };

  const handleToggleTask = () => {
    setTaskOpen((p: boolean) => {
      const next = !p;
      localStorage.setItem('pomodoro-react-taskStatus', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div
      className={[
        'app-root',
        `phase-${engine.phase}`,
        settings.focusMode ? 'focus-mode' : '',
        isFullscreen ? 'is-fullscreen' : '',
      ].join(' ')}
    >
      {/* ── Header ── */}
      <header className="app-header">
        <PomodoroStats />
        <div className="header-actions">
          <button
            className={`icon-btn ${settings.focusMode ? 'active' : ''}`}
            onClick={() => settings.update({ focusMode: !settings.focusMode })}
            title="Modo foco (F)"
          >
            🎯
          </button>
          <button
            className="icon-btn"
            onClick={() => setSettingsOpen(true)}
            title="Configurações"
          >
            ⚙️
          </button>
          <button
            className={`icon-btn ${isFullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title="Tela cheia (D)"
          >
            {isFullscreen ? '⊡' : '⛶'}
          </button>
          <ToggleSound
            sound={settings.soundEnabled}
            toggleSound={() => settings.update({ soundEnabled: !settings.soundEnabled })}
          />
        </div>
      </header>

      {/* ── Main area ── */}
      <main className="app-main">
        <div className="Pomodoro">
          <TypeSelect
            types={PHASE_ITEMS}
            selected={{ name: PHASE_LABELS[engine.phase], time: engine.timeRemaining }}
            changeType={(t) => {
              const item = PHASE_ITEMS.find((p) => p.name === t.name);
              if (item) engine.changePhase(item.phase);
            }}
          />

          <TimeDisplay
            time={engine.timeRemaining}
            status={controlStatus}
            progress={engine.progress}
            phaseColor={engine.phaseColor}
          />

          <PomodoroDots
            pomodoroCount={engine.pomodoroCount}
            longBreakInterval={settings.longBreakInterval}
          />

          <Controls
            start={handleStart}
            reset={engine.reset}
            pause={handlePause}
            status={controlStatus}
          />

          {(engine.status === 'running' || engine.status === 'paused') && (
            <button className="skip-btn" onClick={engine.skip}>
              Pular →
            </button>
          )}

          {engine.status === 'countdown' && (
            <div className="auto-banner">
              <span>
                Iniciando <strong>{PHASE_LABELS[engine.phase]}</strong> em{' '}
                <strong>{engine.autoCountdown}s</strong>…
              </span>
              <button className="auto-cancel" onClick={engine.cancelAutoStart}>
                Cancelar
              </button>
            </div>
          )}

          {!settings.focusMode && (
            <>
              <ToggleTask task={taskOpen} toggleTask={handleToggleTask} />
              <Shortcuts />
            </>
          )}
        </div>

        {!settings.focusMode && taskOpen && (
          <div className="TaskPainel">
            <TaskList />
          </div>
        )}
      </main>

      {/* ── Overlays ── */}
      {engine.showProductivityModal && (
        <ProductivityModal onSubmit={engine.submitProductivityRating} />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
};

export default Pomodoro;
