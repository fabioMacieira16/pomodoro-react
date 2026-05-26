import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import PomodoroQuiz from '../components/PomodoroQuiz/PomodoroQuiz';
import { usePomodoroEngine, PHASE_LABELS } from '../hooks/usePomodoroEngine';
import { usePomodoroSettings } from '../store/pomodoroSettingsStore';
import { usePomodoroStore } from '../store/pomodoroStore';
import { useStudyContext } from '../store/studyContextStore';
import { useSubjectStore } from '../store/subjectStore';
import { useSelectedTask } from '../store/selectedTaskStore';
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
  const pomodoroStore = usePomodoroStore();

  const studyCtx = useStudyContext();
  const { subjects: subjectList, fetchSubjects } = useSubjectStore();
  const { selectedTask, incrementActual } = useSelectedTask();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showStudyModeModal, setShowStudyModeModal] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(studyCtx.context.current_subject ?? '');
  const [taskOpen, setTaskOpen] = useState(() => {
    const saved = localStorage.getItem('pomodoro-react-taskStatus');
    return saved ? JSON.parse(saved) : false;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const headerRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const prevPomoCount = useRef(engine.pomodoroCount);

  // ── Increment selected task actual pomodoros when engine completes one ──
  useEffect(() => {
    if (engine.pomodoroCount > prevPomoCount.current && selectedTask) {
      incrementActual();
      // Also update actual_minutes in localStorage tasks
      const raw = localStorage.getItem('pomodoro-react-tasks');
      if (raw) {
        try {
          const stored = JSON.parse(raw) as Array<{ id: number; actual_minutes: number }>;
          const updated = stored.map((t) =>
            t.id === selectedTask.id ? { ...t, actual_minutes: (t.actual_minutes || 0) + 25 } : t
          );
          localStorage.setItem('pomodoro-react-tasks', JSON.stringify(updated));
        } catch { /* ignore */ }
      }
    }
    prevPomoCount.current = engine.pomodoroCount;
  }, [engine.pomodoroCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-enable focus mode when timer starts ───────────────────────────
  useEffect(() => {
    if (engine.status === 'running' && engine.phase === 'pomodoro') {
      settings.update({ focusMode: true });
      // Track early stop
    } else if (engine.status === 'idle' || engine.status === 'finished') {
      settings.update({ focusMode: false });
    }
  }, [engine.status, engine.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch subjects on mount ──────────────────────────────────────────
  useEffect(() => {
    void fetchSubjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync selectedSubject when modal opens ────────────────────────────
  useEffect(() => {
    if (showStudyModeModal) {
      setSelectedSubject(studyCtx.context.current_subject ?? '');
    }
  }, [showStudyModeModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Show quiz when Pomodoro finishes in with_questions mode ────────────
  useEffect(() => {
    if (
      engine.status === 'finished' &&
      engine.phase === 'pomodoro' &&
      studyCtx.context.current_pomodoro_mode === 'with_questions'
    ) {
      setShowQuiz(true);
    }
  }, [engine.status, engine.phase, studyCtx.context.current_pomodoro_mode]);

  // ── Track early interruption ──────────────────────────────────────────
  const prevStatus = useRef(engine.status);
  useEffect(() => {
    // If timer was running and user paused → count as interruption
    if (prevStatus.current === 'running' && engine.status === 'paused') {
      pomodoroStore.incrementInterruption();
    }
    prevStatus.current = engine.status;
  }, [engine.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Header reveal on hover near top in focus mode ─────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!settings.focusMode) return;
    if (e.clientY < 64) {
      setHeaderVisible(true);
      if (headerRevealTimer.current) clearTimeout(headerRevealTimer.current);
      headerRevealTimer.current = setTimeout(() => setHeaderVisible(false), 3000);
    }
  }, [settings.focusMode]);

  // Hide header after 2s when focus mode activates
  useEffect(() => {
    if (settings.focusMode) {
      const t = setTimeout(() => setHeaderVisible(false), 2000);
      return () => clearTimeout(t);
    } else {
      setHeaderVisible(true);
    }
  }, [settings.focusMode]);

  // ── Fullscreen ─────────────────────────────────────────────────────────
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

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
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

  // ── Controls adapter ─────────────────────────────────────────────────────
  const controlStatus = STATUS_MAP[engine.status] ?? null;

  const handleStart = () => {
    // Mostrar modal de modo de estudo antes de iniciar Pomodoro (só na fase pomodoro)
    if (engine.phase === 'pomodoro' && (engine.status === 'idle' || engine.status === 'finished')) {
      setShowStudyModeModal(true);
      return;
    }
    if (engine.status === 'finished') engine.changePhase(engine.phase);
    engine.start();
  };

  const handleStudyModeSelect = (mode: 'normal' | 'with_questions' | 'review') => {
    studyCtx.setCurrentSubject(selectedSubject.trim() || null);
    studyCtx.setPomodoroMode(mode);
    setShowStudyModeModal(false);
    if (engine.status === 'finished') engine.changePhase(engine.phase);
    engine.start();
  };

  const handlePause = () => {
    if (engine.status === 'running') {
      engine.pause();
      // Auto-open task panel so user can track/select tasks
      setTaskOpen((prev: boolean) => {
        if (!prev) localStorage.setItem('pomodoro-react-taskStatus', 'true');
        return true;
      });
    } else if (engine.status === 'paused') {
      engine.resume();
    }
  };

  const handleToggleTask = () => {
    setTaskOpen((p: boolean) => {
      const next = !p;
      localStorage.setItem('pomodoro-react-taskStatus', JSON.stringify(next));
      return next;
    });
  };

  const isTimerActive = engine.status === 'running' || engine.status === 'paused';
  const isRunning = engine.status === 'running';

  const allSubjectOptions = Array.from(new Set([
    ...studyCtx.context.subjects,
    ...subjectList.map(s => s.name),
  ])).filter(Boolean);

  const headerClass = [
    'app-header',
    settings.focusMode && !headerVisible ? 'header-hidden' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={[
        'app-root',
        `phase-${engine.phase}`,
        settings.focusMode ? 'focus-mode' : '',
        isFullscreen ? 'is-fullscreen' : '',
      ].join(' ')}
      onMouseMove={handleMouseMove}
    >
      {/* ── Header ── */}
      <header className={headerClass}>
        <PomodoroStats />
        <div className="header-actions">
          <button
            className="icon-btn active"
            onClick={() => navigate('/')}
            title="Pomodoro"
          >
            🍅
          </button>
          <button
            className="icon-btn"
            onClick={() => navigate('/dashboard')}
            title="Dashboard"
          >
            📊
          </button>
          <button
            className="icon-btn"
            onClick={() => navigate('/anki')}
            title="Anki - Flashcards"
          >
            🧠
          </button>
          <button
            className="icon-btn"
            onClick={() => navigate('/estudos')}
            title="Plano de Estudos"
          >
            📚
          </button>
          <button
            className={`icon-btn ${isFullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title="Tela cheia (D)"
          >
            {isFullscreen ? '⊞' : '⛶'}
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
          {!isTimerActive && (
            <TypeSelect
              types={PHASE_ITEMS}
              selected={PHASE_ITEMS.find((p) => p.phase === engine.phase) ?? PHASE_ITEMS[0]}
              changeType={(t) => {
                const item = PHASE_ITEMS.find((p) => p.name === t.name);
                if (item) engine.changePhase(item.phase);
              }}
            />
          )}

          <TimeDisplay
            time={engine.timeRemaining}
            status={controlStatus}
            progress={engine.progress}
            phaseColor={engine.phaseColor}
          />

          {/* Dots: always show when task selected; only show without task when not running */}
          {(!isRunning || selectedTask) && (
            <PomodoroDots
              pomodoroCount={engine.pomodoroCount}
              longBreakInterval={settings.longBreakInterval}
              totalDots={selectedTask ? selectedTask.estPomo : undefined}
              filledDots={selectedTask ? selectedTask.actualPomo : undefined}
            />
          )}

          {/* Active task name: always visible when a task is selected */}
          {selectedTask && (
            <div className="active-task-label" title={selectedTask.title}>
              {selectedTask.title}
            </div>
          )}

          {!isTimerActive && (
            <button
              className="subject-chip"
              onClick={() => setShowStudyModeModal(true)}
              title="Selecionar matéria"
            >
              {studyCtx.context.current_subject
                ? `📚 ${studyCtx.context.current_subject}`
                : '📚 Selecionar matéria…'}
            </button>
          )}

          <Controls
            start={handleStart}
            reset={engine.reset}
            pause={handlePause}
            status={controlStatus}
          />

          {isTimerActive && (
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

          {/* Util row: show when not actively running (idle, paused, finished) */}
          {!isRunning && (
            <div className="pomo-util-row">
              <ToggleTask task={taskOpen} toggleTask={handleToggleTask} />
              {!isTimerActive && (
                <button
                  className="icon-btn pomo-settings-btn"
                  onClick={() => setSettingsOpen(true)}
                  title="Configurações"
                >
                  ⚙️
                </button>
              )}
            </div>
          )}

          {!isTimerActive && !settings.focusMode && <Shortcuts />}
        </div>

        {/* Task panel: visible when paused or idle/finished */}
        {!isRunning && taskOpen && (
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

      {/* ── Quiz pós-Pomodoro ── */}
      {showQuiz && (
        <PomodoroQuiz
          subjectName={studyCtx.context.current_subject}
          pomodoroNumber={engine.pomodoroCount}
          onClose={() => setShowQuiz(false)}
        />
      )}

      {/* ── Modal: Como deseja estudar? ── */}
      {showStudyModeModal && (
        <div className="study-mode-overlay" onClick={() => setShowStudyModeModal(false)}>
          <div className="study-mode-modal" onClick={e => e.stopPropagation()}>
            <h2 className="study-mode-modal__title">Como deseja estudar?</h2>
            {studyCtx.context.concurso && (
              <p className="study-mode-modal__concurso">{studyCtx.context.concurso}</p>
            )}

            <div className="subject-picker">
              <label className="subject-picker__label">📚 Matéria</label>
              <input
                className="subject-picker__input"
                list="subject-suggestions"
                placeholder="Ex: Direito Tributário…"
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
              />
              <datalist id="subject-suggestions">
                {allSubjectOptions.map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="study-mode-modal__options">
              <button
                className="study-mode-btn study-mode-btn--normal"
                onClick={() => handleStudyModeSelect('normal')}
              >
                <span className="study-mode-btn__icon">🍅</span>
                <span className="study-mode-btn__title">Pomodoro Normal</span>
                <span className="study-mode-btn__desc">Timer focado sem interrupções</span>
              </button>

              <button
                className="study-mode-btn study-mode-btn--questions"
                onClick={() => handleStudyModeSelect('with_questions')}
              >
                <span className="study-mode-btn__icon">📝</span>
                <span className="study-mode-btn__title">Pomodoro com Questões</span>
                <span className="study-mode-btn__desc">Quiz durante a sessão para fixar conteúdo</span>
              </button>

              <button
                className="study-mode-btn study-mode-btn--review"
                onClick={() => handleStudyModeSelect('review')}
              >
                <span className="study-mode-btn__icon">🔁</span>
                <span className="study-mode-btn__title">Modo Revisão</span>
                <span className="study-mode-btn__desc">Revisar flashcards e conteúdos anteriores</span>
              </button>
            </div>

            <button className="study-mode-modal__cancel" onClick={() => setShowStudyModeModal(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pomodoro;
