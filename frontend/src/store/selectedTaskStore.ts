import { create } from 'zustand';

export interface SelectedTask {
  id: number;
  title: string;
  estPomo: number;    // estimated_minutes / 25
  actualPomo: number; // actual_minutes / 25
}

interface SelectedTaskState {
  selectedTask: SelectedTask | null;
  select: (task: SelectedTask | null) => void;
  incrementActual: () => void;
}

export const useSelectedTask = create<SelectedTaskState>((set) => ({
  selectedTask: null,
  select: (task) => set({ selectedTask: task }),
  incrementActual: () =>
    set((s) =>
      s.selectedTask
        ? { selectedTask: { ...s.selectedTask, actualPomo: s.selectedTask.actualPomo + 1 } }
        : s
    ),
}));
