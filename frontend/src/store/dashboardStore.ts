import { create } from 'zustand';
import api from '../api/client';
import type { DashboardData } from '../types';

interface StudyRecommendation {
  subject: string;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  suggested_hours: number;
}

interface AdvancedMetrics {
  retention_rate: number;         // % Anki cards remembered
  quiz_performance: number;       // % correct quiz answers
  error_rate_by_subject: Record<string, number>;
  critical_subjects: string[];    // subjects with error_rate > 50%
  efficiency_by_hour: Record<string, number>;  // hour -> productivity score
  streak: number;
  next_review_count: number;      // Anki cards due today
}

interface DashboardState {
  data: DashboardData | null;
  advancedMetrics: AdvancedMetrics | null;
  recommendations: StudyRecommendation[];
  isLoading: boolean;
  error: string | null;
  fetchDashboard: () => Promise<void>;
  fetchAdvancedMetrics: () => Promise<void>;
  fetchRecommendations: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  advancedMetrics: null,
  recommendations: [],
  isLoading: false,
  error: null,

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/dashboard/stats');
      set({ data: res.data, isLoading: false });
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } })?.response?.status;
      const msg = status === 401
        ? 'Faça login para ver o dashboard.'
        : status === 403
        ? 'Acesso negado.'
        : 'Servidor offline. Verifique se o backend está rodando.';
      set({ isLoading: false, error: msg });
    }
  },

  fetchAdvancedMetrics: async () => {
    try {
      const res = await api.get('/metrics/advanced');
      set({ advancedMetrics: res.data });
    } catch {
      // Non-critical — silently skip
    }
  },

  fetchRecommendations: async () => {
    try {
      const res = await api.get('/metrics/recommendations');
      set({ recommendations: res.data });
    } catch {
      // Non-critical — silently skip
    }
  },
}));
