import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WeeklySchedule, SubjectPerformance } from './studyContextStore';

export type PlanTaskType = 'study' | 'review' | 'quiz';

export interface PlanTask {
  id: number;               // day_of_week * 100 + position (0–699 = plan, >1000 = review)
  title: string;
  subject: string;
  day_of_week: number;      // 0=Segunda … 6=Domingo
  day_name: string;
  position: number;
  estimated_minutes: number;
  actual_minutes: number;
  pomodoros_est: number;
  pomodoros_done: number;
  completed: boolean;
  type: PlanTaskType;
  week_start: string;       // ISO date da Segunda da semana gerada
  assigned_date: string;    // ISO date do dia específico
  priority: number;
}

const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface PlanTaskState {
  tasks: PlanTask[];
  generatedAt: string | null;
  weekStart: string | null;
  concurso: string | null;

  generateFromSchedule: (
    weeklySchedule: WeeklySchedule[],
    performances: SubjectPerformance[],
    concurso?: string | null,
  ) => void;

  toggleComplete: (id: number) => void;
  incrementPomodoro: (id: number) => void;

  addReviewTask: (subject: string, daysFromNow: number) => void;

  clearTasks: () => void;
}

let reviewIdCounter = 1000;

export const usePlanTaskStore = create<PlanTaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      generatedAt: null,
      weekStart: null,
      concurso: null,

      generateFromSchedule: (weeklySchedule, performances, concurso = null) => {
        const monday = getMondayOfWeek(new Date());
        const weekStart = monday.toISOString().split('T')[0];
        const tasks: PlanTask[] = [];

        for (const slot of weeklySchedule) {
          const dayDate = new Date(monday);
          dayDate.setDate(monday.getDate() + slot.day_of_week);
          const assignedDate = dayDate.toISOString().split('T')[0];

          const count = slot.subjects.length || 1;
          const hoursPerSubject = slot.study_hours / count;
          const pomosPerSubject = Math.max(1, Math.round((hoursPerSubject * 60) / 25));

          slot.subjects.forEach((subject, index) => {
            const perf = performances.find(p => p.subject === subject);
            tasks.push({
              id: slot.day_of_week * 100 + index,
              title: subject,
              subject,
              day_of_week: slot.day_of_week,
              day_name: DAY_NAMES[slot.day_of_week],
              position: index,
              estimated_minutes: Math.round(hoursPerSubject * 60),
              actual_minutes: 0,
              pomodoros_est: pomosPerSubject,
              pomodoros_done: 0,
              completed: false,
              type: 'study',
              week_start: weekStart,
              assigned_date: assignedDate,
              priority: perf?.priority ?? 3,
            });
          });
        }

        set({ tasks, generatedAt: new Date().toISOString(), weekStart, concurso: concurso ?? null });
      },

      toggleComplete: (id) =>
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === id ? { ...t, completed: !t.completed } : t
          ),
        })),

      incrementPomodoro: (id) =>
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === id
              ? { ...t, pomodoros_done: t.pomodoros_done + 1, actual_minutes: t.actual_minutes + 25 }
              : t
          ),
        })),

      addReviewTask: (subject, daysFromNow) => {
        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);
        date.setHours(0, 0, 0, 0);
        const jsDay = date.getDay();
        const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
        const monday = getMondayOfWeek(date);
        const assignedDate = date.toISOString().split('T')[0];

        const existing = get().tasks;
        const dayTasks = existing.filter(t => t.assigned_date === assignedDate);

        const reviewTask: PlanTask = {
          id: reviewIdCounter++,
          title: `Revisão: ${subject}`,
          subject,
          day_of_week: dayOfWeek,
          day_name: DAY_NAMES[dayOfWeek],
          position: dayTasks.length,
          estimated_minutes: 25,
          actual_minutes: 0,
          pomodoros_est: 1,
          pomodoros_done: 0,
          completed: false,
          type: 'review',
          week_start: monday.toISOString().split('T')[0],
          assigned_date: assignedDate,
          priority: 5,
        };

        set(state => ({ tasks: [...state.tasks, reviewTask] }));
      },

      clearTasks: () => set({ tasks: [], generatedAt: null, weekStart: null, concurso: null }),
    }),
    { name: 'study-plan-tasks-v1' }
  )
);

// Helpers exportados
export { DAY_NAMES, getMondayOfWeek };

export function getDateForDayOfWeek(dayOfWeek: number, weekStart: string | null): string {
  if (!weekStart) {
    const monday = getMondayOfWeek(new Date());
    monday.setDate(monday.getDate() + dayOfWeek);
    return monday.toISOString().split('T')[0];
  }
  const monday = new Date(weekStart + 'T00:00:00');
  monday.setDate(monday.getDate() + dayOfWeek);
  return monday.toISOString().split('T')[0];
}

export function getTodayDayOfWeek(): number {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}
