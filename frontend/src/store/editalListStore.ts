import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedEdital {
  id: string;
  concurso: string;
  banca: string | null;
  cargos: string[];
  disciplinas: Record<string, number>;
  disciplinas_detalhadas: Array<{
    area: string;
    disciplina: string;
    num_questoes: number;
    peso: number;
    pontuacao_max: number;
  }>;
  data_prova: string | null;
  importedAt: string;
}

interface EditalListState {
  editais: SavedEdital[];
  addEdital: (edital: Omit<SavedEdital, 'id' | 'importedAt'>) => string;
  updateDisciplinas: (id: string, disciplinas: Record<string, number>) => void;
  removeEdital: (id: string) => void;
}

export const useEditalListStore = create<EditalListState>()(
  persist(
    (set) => ({
      editais: [],

      addEdital: (edital) => {
        const id = `edital-${Date.now()}`;
        set((s) => ({
          editais: [
            { ...edital, id, importedAt: new Date().toISOString() },
            ...s.editais,
          ],
        }));
        return id;
      },

      updateDisciplinas: (id, disciplinas) =>
        set((s) => ({
          editais: s.editais.map((e) => (e.id === id ? { ...e, disciplinas } : e)),
        })),

      removeEdital: (id) =>
        set((s) => ({ editais: s.editais.filter((e) => e.id !== id) })),
    }),
    { name: 'editais-importados-v1' }
  )
);
