import { create } from 'zustand';
import api from '../api/client';

export interface QuizOption {
  id: number;
  text: string;
  is_correct: boolean;
  position: number;
}

export interface QuizQuestion {
  exercise_id: number;
  question_text: string;
  hint: string | null;
  difficulty: string;
  options: QuizOption[];
  explanation?: string | null;
  correct_answer?: string | null;
}

export interface QuizSession {
  session_id: number;
  subject_id: number | null;
  questions: QuizQuestion[];
  total_questions: number;
  difficulty_level: string;
  session_mode: string;
}

export interface QuizAnswerResult {
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
  hint: string | null;
  flashcard_created: boolean;
  flashcard_id: number | null;
  score_so_far: number;
}

export interface PomodoroQuizMode {
  pomodoro_number: number;
  recommended_mode: 'study' | 'quiz' | 'revision';
  reason: string;
  show_quiz: boolean;
  quiz_subject_id: number | null;
}

interface QuizState {
  currentSession: QuizSession | null;
  currentQuestion: number;  // index
  answers: Record<number, QuizAnswerResult>;  // exercise_id -> result
  mode: PomodoroQuizMode | null;
  isLoading: boolean;
  error: string | null;
  // Notifications
  newFlashcardCount: number;
  // Actions
  fetchMode: (pomodoroNumber: number, subjectId?: number) => Promise<void>;
  generateQuiz: (subjectId: number, pomodoroNumber: number) => Promise<void>;
  submitAnswer: (exerciseId: number, answer: string) => Promise<QuizAnswerResult | null>;
  nextQuestion: () => void;
  resetQuiz: () => void;
  clearFlashcardNotification: () => void;
}

export const useQuizStore = create<QuizState>((set, get) => ({
  currentSession: null,
  currentQuestion: 0,
  answers: {},
  mode: null,
  isLoading: false,
  error: null,
  newFlashcardCount: 0,

  fetchMode: async (pomodoroNumber, subjectId) => {
    try {
      const params = new URLSearchParams({ pomodoro_number: String(pomodoroNumber) });
      if (subjectId) params.set('subject_id', String(subjectId));
      const res = await api.get(`/quiz/mode?${params}`);
      set({ mode: res.data });
    } catch {
      // silently skip
    }
  },

  generateQuiz: async (subjectId, pomodoroNumber) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/quiz/generate', {
        subject_id: subjectId,
        num_questions: 5,
        pomodoro_number: pomodoroNumber,
      });
      set({ currentSession: res.data, currentQuestion: 0, answers: {}, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Erro ao gerar quiz.' });
    }
  },

  submitAnswer: async (exerciseId, answer) => {
    const session = get().currentSession;
    if (!session) return null;
    try {
      const res = await api.post('/quiz/answer', {
        session_id: session.session_id,
        exercise_id: exerciseId,
        user_answer: answer,
      });
      const result: QuizAnswerResult = res.data;
      set((s) => ({
        answers: { ...s.answers, [exerciseId]: result },
        newFlashcardCount: result.flashcard_created
          ? s.newFlashcardCount + 1
          : s.newFlashcardCount,
      }));
      return result;
    } catch {
      return null;
    }
  },

  nextQuestion: () => set((s) => ({ currentQuestion: s.currentQuestion + 1 })),
  resetQuiz: () => set({ currentSession: null, currentQuestion: 0, answers: {} }),
  clearFlashcardNotification: () => set({ newFlashcardCount: 0 }),
}));
