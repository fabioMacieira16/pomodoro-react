import { create } from 'zustand';
import api from '../api/client';
import { PomodoroSession } from '../types';

interface PomodoroState {
  sessions: PomodoroSession[];
  saveSession: (sessionData: Partial<PomodoroSession>) => Promise<void>;
  fetchRecentSessions: () => Promise<void>;
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  sessions: [],
  
  saveSession: async (sessionData) => {
    try {
      const response = await api.post('/pomodoro-sessions/', sessionData);
      set({ sessions: [response.data, ...get().sessions] });
    } catch (error) {
      console.error('Failed to save session', error);
    }
  },
  
  fetchRecentSessions: async () => {
    try {
      const response = await api.get('/pomodoro-sessions/');
      set({ sessions: response.data });
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    }
  },
}));
