import { create } from 'zustand';
import api from '../api/client';

export interface Task {
  id: number;
  title: string;
  description?: string;
  priority: string;
  completed: boolean;
  estimated_minutes: number;
  actual_minutes: number;
  position: number;
  subject_id?: number | null;
}

interface TaskState {
  tasks: Task[];
  fetchTasks: () => Promise<void>;
  addTask: (title: string, estimated_minutes?: number) => Promise<void>;
  updateTask: (id: number, data: Partial<Task>) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  reorderTasks: (startIndex: number, endIndex: number) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  fetchTasks: async () => {
    try {
      const response = await api.get('/tasks/');
      set({ tasks: response.data });
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    }
  },
  addTask: async (title, estimated_minutes = 25) => {
    try {
      const response = await api.post('/tasks/', { title, estimated_minutes });
      set((state) => ({ tasks: [...state.tasks, response.data] }));
    } catch (error) {
      console.error('Failed to add task', error);
    }
  },
  updateTask: async (id, data) => {
    try {
      const response = await api.put(`/tasks/${id}`, data);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? response.data : t)),
      }));
    } catch (error) {
      console.error('Failed to update task', error);
    }
  },
  deleteTask: async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  },
  reorderTasks: async (startIndex, endIndex) => {
    const { tasks } = get();
    const result = Array.from(tasks);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    
    // Update local state immediately
    set({ tasks: result });
    
    // In a real app we'd update positions in backend too
    try {
        await Promise.all(result.map((task, index) => api.put(`/tasks/${task.id}`, { position: index })));
    } catch(err) {
        console.error(err);
    }
  },
}));
