import { create } from 'zustand';
import api from '../api/client';

export interface TopicPlan {
  topic_name: string;
  subject: string;
  priority: number;
  weight: number;
  incidencia: number;
  difficulty: string;
  allocated_hours: number;
  study_days: string[];
  review_dates: string[];
}

export interface PlanOutput {
  plan_id: number | null;
  concurso: string;
  cargo: string;
  banca: string;
  exam_date: string;
  days_until_exam: number;
  total_study_hours: number;
  topics: TopicPlan[];
  weekly_schedule: Record<string, string[]>;
  priorities: string[];
  is_multi_edital: boolean;
  multi_edital_badge: string | null;
  generated_at: string;
}

export interface MultiEditalComparison {
  plan_id: number | null;
  concurso_1: string;
  concurso_2: string;
  compatibility_pct: number;
  shared_topics: string[];
  exclusive_to_1: string[];
  exclusive_to_2: string[];
  study_leverage_pct: number;
  recommendation: string;
}

export interface WizardAnswers {
  concurso: string;
  cargo: string;
  banca: string;
  exam_date: string;       // ISO date string YYYY-MM-DD
  daily_hours: number;
  available_days: number[];  // 0=Mon..6=Sun
  strong_subjects: string[];
  weak_subjects: string[];
  previous_experience: string;
  has_studied_edital: boolean;
  // Multi-edital (optional)
  second_concurso?: string;
  second_cargo?: string;
  second_exam_date?: string;
}

interface StudyPlannerState {
  // Wizard
  wizardStep: number;
  wizardAnswers: Partial<WizardAnswers>;
  wizardLoading: boolean;
  // Plan
  activePlan: PlanOutput | null;
  planLoading: boolean;
  planError: string | null;
  // Multi-edital
  multiEditalComparison: MultiEditalComparison | null;
  // Actions
  setWizardStep: (step: number) => void;
  updateWizardAnswers: (answers: Partial<WizardAnswers>) => void;
  resetWizard: () => void;
  submitWizard: (answers: WizardAnswers) => Promise<void>;
  fetchActivePlan: () => Promise<void>;
  editPlan: (planId: number, answers: WizardAnswers) => Promise<void>;
  compareEditais: (answers: WizardAnswers) => Promise<void>;
}

export const useStudyPlannerStore = create<StudyPlannerState>((set) => ({
  wizardStep: 0,
  wizardAnswers: {},
  wizardLoading: false,
  activePlan: null,
  planLoading: false,
  planError: null,
  multiEditalComparison: null,

  setWizardStep: (step) => set({ wizardStep: step }),
  updateWizardAnswers: (answers) =>
    set((s) => ({ wizardAnswers: { ...s.wizardAnswers, ...answers } })),
  resetWizard: () => set({ wizardStep: 0, wizardAnswers: {} }),

  submitWizard: async (answers) => {
    set({ wizardLoading: true, planError: null });
    try {
      const res = await api.post('/planner/wizard', answers);
      set({ activePlan: res.data, wizardLoading: false, wizardStep: 0 });
    } catch (err: unknown) {
      set({
        wizardLoading: false,
        planError: 'Erro ao gerar plano. Verifique o backend.',
      });
    }
  },

  fetchActivePlan: async () => {
    set({ planLoading: true, planError: null });
    try {
      const res = await api.get('/planner/plan');
      set({ activePlan: res.data, planLoading: false });
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } })?.response?.status;
      if (status === 404) {
        set({ activePlan: null, planLoading: false });
      } else {
        set({ planLoading: false, planError: 'Erro ao carregar plano.' });
      }
    }
  },

  editPlan: async (planId, answers) => {
    set({ planLoading: true });
    try {
      const res = await api.put(`/planner/plan/${planId}`, {
        wizard_answers: answers,
        recalculate: true,
      });
      set({ activePlan: res.data, planLoading: false });
    } catch {
      set({ planLoading: false, planError: 'Erro ao editar plano.' });
    }
  },

  compareEditais: async (answers) => {
    try {
      const res = await api.post('/planner/multi-edital', answers);
      set({ multiEditalComparison: res.data });
    } catch {
      // silently skip
    }
  },
}));
