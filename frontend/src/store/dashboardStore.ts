import { create } from 'zustand';
import api from '../api/client';
import type { DashboardData } from '../types';

interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  fetchDashboard: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/dashboard/stats');
      set({ data: res.data, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
      set({ isLoading: false, error: 'Erro ao carregar dados do dashboard.' });
    }
  },
}));
