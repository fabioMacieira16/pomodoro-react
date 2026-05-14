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
}

interface PomodoroState {
  sessions: PomodoroSession[];
  stats: PomodoroStats;
  lastSessionId: number | null;
  saveSession: (payload: SessionPayload) => Promise<void>;
  updateSessionRating: (sessionId: number, rating: number) => Promise<void>;
  fetchRecentSessions: () => Promise<void>;
  fetchStats: () => Promise<void>;
}

export const usePomodoroStore = create<PomodoroState>((set) => ({
  sessions: [],
  stats: { today_pomodoros: 0, total_focus_minutes: 0, total_sessions: 0 },
  lastSessionId: null,

  saveSession: async (payload) => {
    try {
      const res = await api.post('/pomodoro-sessions/', payload);
      set((s) => ({
        sessions: [res.data, ...s.sessions],
        lastSessionId: res.data.id,
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

