import { create } from 'zustand';
import api from '../api/client';
import type { AchievementSummary, AchievementUnlock, AchievementStats, AchievementItem } from '../types';

const SEEN_KEY = 'pomo-seen-achievements';

function getSeenCodes(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveSeenCodes(codes: string[]) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(codes)); } catch {}
}

interface AchievementState {
  summary: AchievementSummary | null;
  recent: AchievementUnlock[];
  allAchievements: AchievementItem[];
  stats: AchievementStats | null;
  isLoading: boolean;
  newUnlocks: AchievementUnlock[];
  fetch: () => Promise<void>;
  clearNewUnlocks: () => void;
}

export const useAchievementStore = create<AchievementState>((set) => ({
  summary: null,
  recent: [],
  allAchievements: [],
  stats: null,
  isLoading: false,
  newUnlocks: [],

  fetch: async () => {
    set({ isLoading: true });
    try {
      const seenCodes = getSeenCodes();
      const [summaryRes, recentRes, statsRes, allRes] = await Promise.all([
        api.get('/achievements/me/summary'),
        api.get('/achievements/me/recent?limit=5'),
        api.get('/achievements/me/stats'),
        api.get('/achievements/me'),
      ]);

      const allAchievements: AchievementItem[] = allRes.data;
      const unlockedItems = allAchievements.filter(a => a.unlocked);

      const newUnlocks: AchievementUnlock[] = unlockedItems
        .filter(a => !seenCodes.has(a.code))
        .map(a => ({
          code: a.code,
          title: a.title,
          icon: a.icon,
          category: a.category,
          unlocked_at: a.unlocked_at ?? new Date().toISOString(),
        }));

      saveSeenCodes(unlockedItems.map(a => a.code));

      set({
        summary: summaryRes.data,
        recent: recentRes.data,
        allAchievements,
        stats: statsRes.data,
        isLoading: false,
        newUnlocks,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  clearNewUnlocks: () => set({ newUnlocks: [] }),
}));
