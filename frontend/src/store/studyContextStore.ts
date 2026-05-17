/**
 * Study Context Store - Contexto Global de Estudos
 * 
 * Armazena o estado completo do sistema de estudos do usuário.
 * Sincroniza com o backend e é usado por todas as telas.
 */
import { create } from 'zustand';
import api from '../api/client';

export interface SubjectPerformance {
  subject: string;
  correct_answers: number;
  wrong_answers: number;
  accuracy: number;
  study_hours: number;
  last_study: string | null;
  difficulty_level: 'easy' | 'medium' | 'hard';
  priority: number;
}

export interface ReviewItem {
  subject: string;
  topic: string;
  question_id: number | null;
  created_at: string;
  scheduled_for: string;
  review_count: number;
  difficulty: string;
}

export interface WeeklySchedule {
  day_of_week: number;
  subjects: string[];
  study_hours: number;
}

export interface StudyContext {
  // Edital
  edital_active: boolean;
  concurso: string | null;
  banca: string | null;
  cargo: string | null;
  exam_date: string | null;
  available_cargos: string[];
  
  // Disciplinas
  subjects: string[];
  subject_weights: Record<string, number>;
  
  // Agenda
  weekly_schedule: WeeklySchedule[];
  daily_study_hours: number;
  available_days: number[];
  
  // Performance
  performances: SubjectPerformance[];
  total_study_hours: number;
  total_pomodoros: number;
  
  // Revisões
  pending_reviews: ReviewItem[];
  review_mode_active: boolean;
  
  // Metas
  daily_goal_hours: number;
  weekly_goal_pomodoros: number;
  
  // Estado atual
  current_subject: string | null;
  current_pomodoro_mode: 'normal' | 'with_questions' | 'review';
  last_activity: string | null;
  
  // IA Context
  user_strengths: string[];
  user_weaknesses: string[];
  previous_experience: string | null;
  study_style: 'intensive' | 'balanced' | 'light';
}

interface StudyContextState {
  context: StudyContext;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchContext: () => Promise<void>;
  updateContext: (updates: Partial<StudyContext>) => Promise<void>;
  resetContext: () => Promise<void>;
  
  // Helper methods
  getTodaysSubjects: () => string[];
  getWeakSubjects: () => SubjectPerformance[];
  getPendingReviews: (subject?: string) => ReviewItem[];
  addPerformance: (subject: string, correct: boolean, studyTime?: number) => Promise<void>;
  addReview: (subject: string, topic: string, daysAhead?: number) => Promise<void>;
  
  // Local state
  setCurrentSubject: (subject: string | null) => void;
  setPomodoroMode: (mode: 'normal' | 'with_questions' | 'review') => void;
}

const defaultContext: StudyContext = {
  edital_active: false,
  concurso: null,
  banca: null,
  cargo: null,
  exam_date: null,
  available_cargos: [],
  subjects: [],
  subject_weights: {},
  weekly_schedule: [],
  daily_study_hours: 4.0,
  available_days: [0, 1, 2, 3, 4],
  performances: [],
  total_study_hours: 0,
  total_pomodoros: 0,
  pending_reviews: [],
  review_mode_active: false,
  daily_goal_hours: 4.0,
  weekly_goal_pomodoros: 20,
  current_subject: null,
  current_pomodoro_mode: 'normal',
  last_activity: null,
  user_strengths: [],
  user_weaknesses: [],
  previous_experience: null,
  study_style: 'balanced',
};

export const useStudyContext = create<StudyContextState>((set, get) => ({
  context: defaultContext,
  isLoading: false,
  error: null,

  fetchContext: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/study-context');
      set({ context: response.data, isLoading: false });
    } catch (err) {
      set({ 
        error: 'Erro ao carregar contexto de estudos', 
        isLoading: false 
      });
    }
  },

  updateContext: async (updates: Partial<StudyContext>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put('/study-context', updates);
      set({ context: response.data, isLoading: false });
    } catch (err) {
      set({ 
        error: 'Erro ao atualizar contexto', 
        isLoading: false 
      });
    }
  },

  resetContext: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/study-context/reset');
      set({ context: response.data, isLoading: false });
    } catch (err) {
      set({ 
        error: 'Erro ao resetar contexto', 
        isLoading: false 
      });
    }
  },

  getTodaysSubjects: () => {
    const { context } = get();
    const today = new Date().getDay();
    // JavaScript: 0=Dom, precisamos converter para 0=Seg
    const adjustedDay = today === 0 ? 6 : today - 1;
    
    const schedule = context.weekly_schedule.find(
      s => s.day_of_week === adjustedDay
    );
    return schedule?.subjects || [];
  },

  getWeakSubjects: () => {
    const { context } = get();
    return context.performances.filter(p => p.accuracy < 60);
  },

  getPendingReviews: (subject?: string) => {
    const { context } = get();
    const now = new Date();
    
    return context.pending_reviews.filter(r => {
      const scheduled = new Date(r.scheduled_for);
      const isPending = scheduled <= now;
      const matchesSubject = !subject || r.subject === subject;
      return isPending && matchesSubject;
    });
  },

  addPerformance: async (subject: string, correct: boolean, studyTime = 0) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/study-context/performance', {
        subject,
        correct,
        study_time: studyTime,
      });
      set({ context: response.data, isLoading: false });
    } catch (err) {
      set({ 
        error: 'Erro ao registrar desempenho', 
        isLoading: false 
      });
    }
  },

  addReview: async (subject: string, topic: string, daysAhead = 1) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/study-context/review', {
        subject,
        topic,
        days_ahead: daysAhead,
      });
      set({ context: response.data, isLoading: false });
    } catch (err) {
      set({ 
        error: 'Erro ao adicionar revisão', 
        isLoading: false 
      });
    }
  },

  setCurrentSubject: (subject: string | null) => {
    set(state => ({
      context: { ...state.context, current_subject: subject }
    }));
  },

  setPomodoroMode: (mode: 'normal' | 'with_questions' | 'review') => {
    set(state => ({
      context: { ...state.context, current_pomodoro_mode: mode }
    }));
  },
}));
