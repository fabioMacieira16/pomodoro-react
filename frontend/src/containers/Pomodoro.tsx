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
import { PomodoroReviewPanel } from '../components/PomodoroReviewPanel';
import { usePomodoroEngine, PHASE_LABELS } from '../hooks/usePomodoroEngine';
import { usePomodoroSettings } from '../store/pomodoroSettingsStore';
import { usePomodoroStore } from '../store/pomodoroStore';
import { useStudyContext } from '../store/studyContextStore';
import { useAnkiStore } from '../store/ankiStore';
import { useSelectedTask } from '../store/selectedTaskStore';
import { useAchievementStore } from '../store/achievementStore';
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
  const { selectedTask, incrementActual } = useSelectedTask();
  const fetchAchievements = useAchievementStore(s => s.fetch);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showStudyModeModal, setShowStudyModeModal] = useState(false);
  const [modalSubject, setModalSubject] = useState<string>('');
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
    if (engine.pomodoroCount > prevPomoCount.current) {
      if (selectedTask) {
        incrementActual();
        // Notifica o TaskList (fonte da verdade do localStorage) em vez de escrever direto,
        // evitando que uma edição de task sobrescreva o ciclo recém-concluído
        window.dispatchEvent(
          new CustomEvent('pomodoro:cycle-completed', { detail: { taskId: selectedTask.id } })
        );
      }
      // Verifica se novas conquistas foram desbloqueadas
      void fetchAchievements();
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
          if (engine.status === 'idle' || engine.status === 'finished') handleStart();
          else if (engine.status === 'running') engine.pause();
          else if (engine.status === 'paused') handlePause();
          break;
        case 'Escape':
          // Encerra a sessão de revisão (contabilizando no dashboard) antes de zerar o timer
          if (useAnkiStore.getState().isReviewing) {
            useAnkiStore.getState().endReview();
          }
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
      setModalSubject(studyCtx.context.current_subject ?? '');
      setShowStudyModeModal(true);
      return;
    }
    if (engine.status === 'finished') engine.changePhase(engine.phase);
    engine.start();
  };

  const handleStudyModeSelect = (mode: 'normal' | 'with_questions' | 'review') => {
    studyCtx.setPomodoroMode(mode);
    if (modalSubject) studyCtx.setCurrentSubject(modalSubject);
    setShowStudyModeModal(false);
    if (engine.status === 'paused') {
      // Retoma de onde parou, não reseta
      engine.resume();
    } else {
      if (engine.status === 'finished') engine.changePhase(engine.phase);
      engine.start();
    }
  };

  const handlePause = () => {
    if (engine.status === 'running') {
      engine.pause();
    } else if (engine.status === 'paused') {
      if (engine.phase === 'pomodoro') {
        setModalSubject(studyCtx.context.current_subject ?? '');
        setShowStudyModeModal(true);
      } else {
        engine.resume();
      }
    }
  };

  const handleChangeMinutes = (minutes: number) => {
    const clamped = Math.min(120, Math.max(1, minutes));
    if (engine.phase === 'pomodoro') settings.update({ pomodoroMinutes: clamped });
    else if (engine.phase === 'shortBreak') settings.update({ shortBreakMinutes: clamped });
    else settings.update({ longBreakMinutes: clamped });
    settings.syncToBackend();
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
  const isReviewMode = studyCtx.context.current_pomodoro_mode === 'review' && isTimerActive;
  const isQuizMode = studyCtx.context.current_pomodoro_mode === 'with_questions' && isTimerActive;

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
            title="Flashcards"
          >
            🧠
          </button>
          <button
            className="icon-btn"
            onClick={() => navigate('/estudos')}
            title="Estudos"
          >
            📚
          </button>
          <button
            className="icon-btn"
            onClick={() => navigate('/plano')}
            title="Plano de Estudos"
          >
            📋
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
            editable={engine.status === 'idle'}
            onChangeMinutes={handleChangeMinutes}
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

          {/* {!isTimerActive && (
            <button
              className="subject-chip"
              onClick={() => setShowStudyModeModal(true)}
              title="Selecionar matéria"
            >
              {studyCtx.context.current_subject
                ? `📚 ${studyCtx.context.current_subject}`
                : '📚 Selecionar matéria…'}
            </button>
          )} */}

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

        {/* Review panel: visible during the whole timer when "Modo Revisão" is active */}
        {isReviewMode && (
          <div className="TaskPainel">
            <PomodoroReviewPanel subjectName={studyCtx.context.current_subject ?? null} />
          </div>
        )}

        {/* Quiz panel: always mounted to preserve session state, hidden when not in quiz mode */}
        <div className={`TaskPainel${isQuizMode ? '' : ' TaskPainel--hidden'}`} style={{ display: isQuizMode ? undefined : 'none' }}>
          <PomodoroQuiz
            subjectId={selectedTask?.subjectId ?? undefined}
            subjectName={selectedTask?.title ?? studyCtx.context.current_subject}
            pomodoroNumber={engine.pomodoroCount}
            onClose={() => studyCtx.setPomodoroMode('normal')}
          />
        </div>

        {/* Task panel: visible when paused or idle/finished (not in review/quiz mode) */}
        {!isReviewMode && !isQuizMode && !isRunning && taskOpen && (
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

      {/* ── Modal: Como deseja estudar? ── */}
      {showStudyModeModal && (
        <div className="study-mode-overlay" onClick={() => setShowStudyModeModal(false)}>
          <div className="study-mode-modal" onClick={e => e.stopPropagation()}>
            <h2 className="study-mode-modal__title">Como deseja estudar?</h2>
            {studyCtx.context.concurso && (
              <p className="study-mode-modal__concurso">{studyCtx.context.concurso}</p>
            )}

            {/* Seletor de matéria */}
            {studyCtx.context.subjects.length > 0 && (
              <div className="study-mode-modal__subject-row">
                <label className="study-mode-modal__subject-label">Matéria:</label>
                <select
                  className="study-mode-modal__subject-select"
                  value={modalSubject}
                  onChange={e => setModalSubject(e.target.value)}
                >
                  <option value="">— Nenhuma selecionada —</option>
                  {studyCtx.context.subjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

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
                className="study-mode-btn study-mode-btn--review"
                onClick={() => handleStudyModeSelect('review')}
              >
                <span className="study-mode-btn__icon">🧠</span>
                <span className="study-mode-btn__title">Modo Revisão</span>
                <span className="study-mode-btn__desc">Revisar flashcards e conteúdos anteriores</span>
              </button>

               <button
                className="study-mode-btn study-mode-btn--questions"
                onClick={() => handleStudyModeSelect('with_questions')}
              >
                <span className="study-mode-btn__icon">📝</span>
                <span className="study-mode-btn__title">Pomodoro com Questões</span>
                <span className="study-mode-btn__desc">Quiz durante a sessão para fixar conteúdo</span>
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
