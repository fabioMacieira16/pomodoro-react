import { create } from 'zustand';
import api from '../api/client';
import type { PomodoroSession, PomodoroStats } from '../types';

interface SessionPayload {
  duration_minutes: number;
  session_type: string;
  completed?: boolean;
  interruptions?: number;
  productivity_rating?: number;
  subject_id?: number;
  topic_id?: number;
  early_stopped?: boolean;
  focus_score?: number;
}

interface PomodoroState {
  sessions: PomodoroSession[];
  stats: PomodoroStats;
  lastSessionId: number | null;
  // Current session tracking
  currentSubjectId: number | null;
  currentTopicId: number | null;
  interruptionCount: number;
  pomodoroCount: number;  // total pomodoros in current streak
  setCurrentSubject: (subjectId: number | null) => void;
  setCurrentTopic: (topicId: number | null) => void;
  incrementInterruption: () => void;
  resetInterruptions: () => void;
  // API
  saveSession: (payload: SessionPayload) => Promise<void>;
  updateSessionRating: (sessionId: number, rating: number) => Promise<void>;
  fetchRecentSessions: () => Promise<void>;
  fetchStats: () => Promise<void>;
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  sessions: [],
  stats: { today_pomodoros: 0, total_focus_minutes: 0, total_sessions: 0 },
  lastSessionId: null,
  currentSubjectId: null,
  currentTopicId: null,
  interruptionCount: 0,
  pomodoroCount: 0,

  setCurrentSubject: (subjectId) => set({ currentSubjectId: subjectId }),
  setCurrentTopic: (topicId) => set({ currentTopicId: topicId }),
  incrementInterruption: () => set((s) => ({ interruptionCount: s.interruptionCount + 1 })),
  resetInterruptions: () => set({ interruptionCount: 0 }),

  saveSession: async (payload) => {
    try {
      const { currentSubjectId, currentTopicId, interruptionCount } = get();
      const enriched: SessionPayload = {
        ...payload,
        subject_id: payload.subject_id ?? currentSubjectId ?? undefined,
        topic_id: payload.topic_id ?? currentTopicId ?? undefined,
        interruptions: payload.interruptions ?? interruptionCount,
      };
      // Compute focus_score: 100 - (interruptions * 15) - (early_stopped ? 30 : 0)
      const focusPenalty = (enriched.interruptions ?? 0) * 15 + (enriched.early_stopped ? 30 : 0);
      enriched.focus_score = Math.max(0, 100 - focusPenalty);

      const res = await api.post('/pomodoro-sessions/', enriched);
      set((s) => ({
        sessions: [res.data, ...s.sessions],
        lastSessionId: res.data.id,
        interruptionCount: 0,
        pomodoroCount: s.pomodoroCount + (payload.session_type === 'Pomodoro' ? 1 : 0),
      }));
    } catch {
      // Offline or not authenticated — silently skip
    }
  },

  updateSessionRating: async (sessionId, rating) => {
    try {
      const res = await api.patch(`/pomodoro-sessions/${sessionId}`, {
        productivity_rating: rating,
      });
      set((s) => ({
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId ? res.data : sess
        ),
      }));
    } catch {
      // Silently skip
    }
  },

  fetchRecentSessions: async () => {
    try {
      const res = await api.get('/pomodoro-sessions/');
      set({ sessions: res.data });
    } catch {
      // Silently skip
    }
  },

  fetchStats: async () => {
    try {
      const res = await api.get('/pomodoro-sessions/stats');
      set({ stats: res.data });
    } catch {
      // Silently skip
    }
  },
}));
