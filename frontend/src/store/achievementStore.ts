import { create } from 'zustand';
import api from '../api/client';
import type { AchievementSummary, AchievementUnlock, AchievementStats } from '../types';

interface AchievementState {
  summary: AchievementSummary | null;
  recent: AchievementUnlock[];
  stats: AchievementStats | null;
  isLoading: boolean;
  fetch: () => Promise<void>;
}

export const useAchievementStore = create<AchievementState>((set) => ({
  summary: null,
  recent: [],
  stats: null,
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const [summaryRes, recentRes, statsRes] = await Promise.all([
        api.get('/achievements/me/summary'),
        api.get('/achievements/me/recent?limit=5'),
        api.get('/achievements/me/stats'),
      ]);
      set({
        summary: summaryRes.data,
        recent: recentRes.data,
        stats: statsRes.data,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
