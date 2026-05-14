import { create } from 'zustand';
import api from '../api/client';
import { Subject, Category } from '../types';

interface SubjectState {
  subjects: Subject[];
  categories: Category[];
  fetchSubjects: () => Promise<void>;
  fetchCategories: () => Promise<void>;
}

export const useSubjectStore = create<SubjectState>((set) => ({
  subjects: [],
  categories: [],
  
  fetchSubjects: async () => {
    try {
      const response = await api.get('/subjects/');
      set({ subjects: response.data });
    } catch (error) {
      console.error('Failed to fetch subjects', error);
    }
  },
  
  fetchCategories: async () => {
    try {
      const response = await api.get('/categories/');
      set({ categories: response.data });
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  },
}));
