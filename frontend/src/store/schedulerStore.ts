import { create } from 'zustand';
import api from '../api/client';
import type {
  ExamSummary,
  ExamResponse,
  StudyPlanItemResponse,
  ExamCreate,
} from '../types';

interface SchedulerState {
  exams: ExamSummary[];
  currentExam: ExamResponse | null;
  planItems: StudyPlanItemResponse[];
  isLoading: boolean;
  error: string | null;

  fetchExams: () => Promise<void>;
  createExam: (payload: ExamCreate) => Promise<ExamResponse | null>;
  deleteExam: (examId: number) => Promise<void>;
  fetchPlan: (examId: number) => Promise<void>;
  toggleItem: (itemId: number, completed: boolean) => Promise<void>;
  regeneratePlan: (examId: number) => Promise<void>;
}

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  exams: [],
  currentExam: null,
  planItems: [],
  isLoading: false,
  error: null,

  fetchExams: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/scheduler/exams');
      set({ exams: res.data });
    } catch (err) {
      console.error('fetchExams failed', err);
      set({ error: 'Failed to load exams' });
    } finally {
      set({ isLoading: false });
    }
  },

  createExam: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<ExamResponse>('/scheduler/exams', payload);
      await get().fetchExams();
      return res.data;
    } catch (err) {
      console.error('createExam failed', err);
      set({ error: 'Failed to create exam' });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteExam: async (examId) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/scheduler/exams/${examId}`);
      set((state) => ({
        exams: state.exams.filter((e) => e.id !== examId),
        currentExam: state.currentExam?.id === examId ? null : state.currentExam,
        planItems: state.currentExam?.id === examId ? [] : state.planItems,
      }));
    } catch (err) {
      console.error('deleteExam failed', err);
      set({ error: 'Failed to delete exam' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPlan: async (examId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/scheduler/exams/${examId}/plan`);
      set({ planItems: res.data });
    } catch (err) {
      console.error('fetchPlan failed', err);
      set({ error: 'Failed to load plan' });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleItem: async (itemId, completed) => {
    set((state) => ({
      planItems: state.planItems.map((item) =>
        item.id === itemId ? { ...item, completed } : item
      ),
    }));
    try {
      await api.patch(`/scheduler/plan/items/${itemId}`, { completed });
    } catch (err) {
      console.error('toggleItem failed', err);
      set((state) => ({
        planItems: state.planItems.map((item) =>
          item.id === itemId ? { ...item, completed: !completed } : item
        ),
      }));
    }
  },

  regeneratePlan: async (examId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post(`/scheduler/exams/${examId}/regenerate`);
      set({ planItems: res.data });
    } catch (err) {
      console.error('regeneratePlan failed', err);
      set({ error: 'Failed to regenerate plan' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
