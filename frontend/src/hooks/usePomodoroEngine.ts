import { useState, useEffect, useCallback, useRef } from 'react';
import { usePomodoroSettings } from '../store/pomodoroSettingsStore';
import { usePomodoroStore } from '../store/pomodoroStore';
import type { TimerPhase, TimerStatus } from '../types';

export type { TimerPhase, TimerStatus };

export const PHASE_LABELS: Record<TimerPhase, string> = {
  pomodoro: 'Pomodoro',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

const PHASE_COLORS: Record<TimerPhase, string> = {
  pomodoro: '#ef4444',
  shortBreak: '#22c55e',
  longBreak: '#3b82f6',
};

interface PersistedState {
  phase: TimerPhase;
  timeRemaining: number;
  pomodoroCount: number;
  startedAtMs: number | null;
}

const STORAGE_KEY = 'pomo-timer-v2';

function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

function savePersisted(s: PersistedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function playWebAudio(type: 'beep' | 'digital') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.5);
    } else {
      osc.type = 'square';
      gain.gain.setValueAtTime(0, ctx.currentTime);
      for (let i = 0; i < 3; i++) {
        const t = ctx.currentTime + i * 0.35;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.setValueAtTime(0, t + 0.18);
        osc.frequency.setValueAtTime(i === 2 ? 660 : 440, t);
      }
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    }
    setTimeout(() => ctx.close(), 2000);
  } catch {
    /* AudioContext not available */
  }
}

function sendNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

export function usePomodoroEngine() {
  // Use refs for stable access inside callbacks/intervals
  const settingsRef = useRef(usePomodoroSettings.getState());
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<TimerPhase>('pomodoro');
  const pomodoroCountRef = useRef<number>(0);
  const interruptionsRef = useRef<number>(0);
  const statusRef = useRef<TimerStatus>('idle');

  const { saveSession, updateSessionRating, fetchStats } = usePomodoroStore.getState();

  // Subscribe to settings changes without causing re-renders
  useEffect(() => {
    const unsub = usePomodoroSettings.subscribe((s) => {
      settingsRef.current = s;
    });
    return unsub;
  }, []);

  // Helper: get duration in seconds for a phase
  const getDuration = useCallback((phase: TimerPhase): number => {
    const s = settingsRef.current;
    switch (phase) {
      case 'pomodoro':    return s.pomodoroMinutes * 60;
      case 'shortBreak':  return s.shortBreakMinutes * 60;
      case 'longBreak':   return s.longBreakMinutes * 60;
    }
  }, []);

  // ── Initialise state from localStorage ─────────────────────────────────────
  const [phase, setPhase] = useState<TimerPhase>(() => {
    const saved = loadPersisted();
    const p = saved?.phase ?? 'pomodoro';
    phaseRef.current = p;
    return p;
  });

  const [pomodoroCount, setPomodoroCount] = useState<number>(() => {
    const saved = loadPersisted();
    const c = saved?.pomodoroCount ?? 0;
    pomodoroCountRef.current = c;
    return c;
  });

  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    const saved = loadPersisted();
    if (!saved) return 25 * 60;
    if (saved.startedAtMs !== null) {
      const elapsed = Math.floor((Date.now() - saved.startedAtMs) / 1000);
      return Math.max(0, saved.timeRemaining - elapsed);
    }
    return saved.timeRemaining;
  });

  const [status, setStatus] = useState<TimerStatus>(() => {
    const saved = loadPersisted();
    if (!saved || saved.startedAtMs === null) return 'idle';
    const elapsed = Math.floor((Date.now() - saved.startedAtMs) / 1000);
    return elapsed < saved.timeRemaining ? 'running' : 'finished';
  });

  const [autoCountdown, setAutoCountdown] = useState(5);
  const [showProductivityModal, setShowProductivityModal] = useState(false);

  // Keep statusRef in sync
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { pomodoroCountRef.current = pomodoroCount; }, [pomodoroCount]);

  // ── Init audio ──────────────────────────────────────────────────────────────
  useEffect(() => {
    bellRef.current = new Audio('/bell.flac');
    bellRef.current.preload = 'auto';
    Notification.requestPermission().catch(() => {});
  }, []);

  // ── Persist state ───────────────────────────────────────────────────────────
  useEffect(() => {
    savePersisted({
      phase,
      timeRemaining,
      pomodoroCount,
      startedAtMs: status === 'running' ? Date.now() - (getDuration(phase) - timeRemaining) * 1000 : null,
    });
  }, [phase, timeRemaining, pomodoroCount, status]);

  // ── Sound ───────────────────────────────────────────────────────────────────
  const REPEAT_COUNT = 3;
  const REPEAT_INTERVAL_MS = 1800;

  const playSound = useCallback(() => {
    const { soundEnabled, soundType } = settingsRef.current;
    if (!soundEnabled || soundType === 'none') return;

    for (let i = 0; i < REPEAT_COUNT; i++) {
      setTimeout(() => {
        if (soundType === 'bell') {
          if (bellRef.current) {
            bellRef.current.currentTime = 0;
            bellRef.current.play().catch(() => {});
          }
        } else {
          playWebAudio(soundType);
        }
      }, i * REPEAT_INTERVAL_MS);
    }
  }, []);

  // ── Stop interval helper ────────────────────────────────────────────────────
  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Completion handler (stable: uses refs) ──────────────────────────────────
  const handleCompletion = useCallback(() => {
    stopInterval();
    const completedPhase = phaseRef.current;
    const count = pomodoroCountRef.current;
    const s = settingsRef.current;

    let newCount = count;
    let nextPhase: TimerPhase;

    if (completedPhase === 'pomodoro') {
      newCount = count + 1;
      nextPhase = newCount % s.longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
    } else {
      nextPhase = 'pomodoro';
    }

    // Update state
    pomodoroCountRef.current = newCount;
    phaseRef.current = nextPhase;
    setPomodoroCount(newCount);
    setPhase(nextPhase);
    setTimeRemaining(getDuration(nextPhase));

    // Sound + notification
    playSound();
    sendNotification(
      `${PHASE_LABELS[completedPhase]} concluído! ✅`,
      `Próximo: ${PHASE_LABELS[nextPhase]}`
    );

    // Save session to backend
    saveSession({
      duration_minutes: getDuration(completedPhase) / 60,
      session_type: PHASE_LABELS[completedPhase],
      completed: true,
      interruptions: interruptionsRef.current,
    });
    fetchStats();

    // Productivity modal for pomodoro sessions
    if (completedPhase === 'pomodoro') {
      setShowProductivityModal(true);
    }

    // Auto-start logic
    const shouldAuto = completedPhase === 'pomodoro' ? s.autoStartBreaks : s.autoStartPomodoros;
    if (shouldAuto) {
      setAutoCountdown(5);
      setStatus('countdown');
      statusRef.current = 'countdown';
    } else {
      setStatus('finished');
      statusRef.current = 'finished';
    }
  }, [stopInterval, getDuration, playSound, saveSession, fetchStats]);

  // ── Tick ────────────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    setTimeRemaining((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        // Schedule completion outside setState
        setTimeout(handleCompletion, 0);
        return 0;
      }
      return next;
    });
  }, [handleCompletion]);

  // ── Auto-start countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'countdown') return;
    if (autoCountdown <= 0) {
      // Start the next timer
      setStatus('running');
      statusRef.current = 'running';
      interruptionsRef.current = 0;
      const id = setInterval(tick, 1000);
      intervalRef.current = id;
      return;
    }
    const id = setTimeout(() => setAutoCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [status, autoCountdown, tick]);

  // ── Resume running timer on mount (persistent timer) ───────────────────────
  useEffect(() => {
    if (status === 'running' && !intervalRef.current) {
      const id = setInterval(tick, 1000);
      intervalRef.current = id;
    }
    return stopInterval;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // ── Document title ──────────────────────────────────────────────────────────
  useEffect(() => {
    const mm = String(Math.floor(timeRemaining / 60)).padStart(2, '0');
    const ss = String(timeRemaining % 60).padStart(2, '0');
    document.title = `(${mm}:${ss}) ${PHASE_LABELS[phase]} | Pomodoro`;
  }, [timeRemaining, phase]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => () => stopInterval(), [stopInterval]);

  // ── Public API ───────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (status === 'running') return;
    interruptionsRef.current = 0;
    setStatus('running');
    statusRef.current = 'running';
    const id = setInterval(tick, 1000);
    intervalRef.current = id;
  }, [status, tick]);

  const pause = useCallback(() => {
    if (status !== 'running') return;
    stopInterval();
    interruptionsRef.current += 1;
    setStatus('paused');
    statusRef.current = 'paused';
  }, [status, stopInterval]);

  const resume = useCallback(() => {
    if (status !== 'paused') return;
    setStatus('running');
    statusRef.current = 'running';
    const id = setInterval(tick, 1000);
    intervalRef.current = id;
  }, [status, tick]);

  const reset = useCallback(() => {
    stopInterval();
    interruptionsRef.current = 0;
    setStatus('idle');
    statusRef.current = 'idle';
    setTimeRemaining(getDuration(phaseRef.current));
  }, [stopInterval, getDuration]);

  const skip = useCallback(() => {
    stopInterval();
    interruptionsRef.current = 0;
    const current = phaseRef.current;
    const count = pomodoroCountRef.current;
    let newCount = count;
    let nextPhase: TimerPhase;
    if (current === 'pomodoro') {
      newCount = count + 1;
      nextPhase = newCount % settingsRef.current.longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
    } else {
      nextPhase = 'pomodoro';
    }
    pomodoroCountRef.current = newCount;
    phaseRef.current = nextPhase;
    setPomodoroCount(newCount);
    setPhase(nextPhase);
    setTimeRemaining(getDuration(nextPhase));
    setStatus('idle');
    statusRef.current = 'idle';
  }, [stopInterval, getDuration]);

  const changePhase = useCallback((newPhase: TimerPhase) => {
    stopInterval();
    interruptionsRef.current = 0;
    phaseRef.current = newPhase;
    setPhase(newPhase);
    setTimeRemaining(getDuration(newPhase));
    setStatus('idle');
    statusRef.current = 'idle';
  }, [stopInterval, getDuration]);

  const cancelAutoStart = useCallback(() => {
    stopInterval();
    setStatus('idle');
    statusRef.current = 'idle';
    setAutoCountdown(5);
  }, [stopInterval]);

  const submitProductivityRating = useCallback(async (rating: number | null) => {
    setShowProductivityModal(false);
    const { lastSessionId } = usePomodoroStore.getState();
    if (rating !== null && lastSessionId) {
      await updateSessionRating(lastSessionId, rating);
    }
  }, [updateSessionRating]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const totalDuration = getDuration(phase);
  const progress = totalDuration > 0 ? ((totalDuration - timeRemaining) / totalDuration) * 100 : 0;
  const phaseColor = PHASE_COLORS[phase];
  const nextPomodoroUntilLongBreak = settingsRef.current.longBreakInterval - (pomodoroCount % settingsRef.current.longBreakInterval);

  return {
    phase,
    phaseLabel: PHASE_LABELS[phase],
    phaseColor,
    timeRemaining,
    status,
    progress,
    pomodoroCount,
    autoCountdown,
    showProductivityModal,
    nextPomodoroUntilLongBreak,
    start,
    pause,
    resume,
    reset,
    skip,
    changePhase,
    cancelAutoStart,
    submitProductivityRating,
  };
}
