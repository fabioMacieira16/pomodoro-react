import { create } from 'zustand';
import api from '../api/client';

export interface DocumentOut {
  id: number;
  filename: string;
  file_path: string;
  file_type: string;
  file_size_kb: number | null;
  concurso: string | null;
  disciplina: string | null;
  doc_type: string;
  page_count: number | null;
  summary: string | null;
  topics_json: string[] | null;
  is_indexed: boolean;
  indexed_at: string;
}

export interface IndexingStatus {
  document_id: number;
  filename: string;
  status: 'pending' | 'indexed' | 'failed';
  message: string | null;
}

interface DocumentState {
  documents: DocumentOut[];
  indexingResults: IndexingStatus[];
  isLoading: boolean;
  isIndexing: boolean;
  error: string | null;
  // Filters
  filterConcurso: string | null;
  filterDisciplina: string | null;
  // Actions
  fetchDocuments: (concurso?: string, disciplina?: string) => Promise<void>;
  uploadFile: (file: File, concurso?: string, disciplina?: string, docType?: string) => Promise<any>;
  indexFile: (filePath: string, concurso?: string, disciplina?: string) => Promise<void>;
  scanDirectory: (dirPath: string) => Promise<void>;
  deleteDocument: (id: number) => Promise<void>;
  setFilter: (concurso: string | null, disciplina: string | null) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  indexingResults: [],
  isLoading: false,
  isIndexing: false,
  error: null,
  filterConcurso: null,
  filterDisciplina: null,

  fetchDocuments: async (concurso, disciplina) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      const c = concurso ?? get().filterConcurso;
      const d = disciplina ?? get().filterDisciplina;
      if (c) params.set('concurso', c);
      if (d) params.set('disciplina', d);
      const res = await api.get(`/docs/?${params}`);
      set({ documents: res.data, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Erro ao carregar documentos.' });
    }
  },

  uploadFile: async (file, concurso, disciplina, docType) => {
    set({ isIndexing: true, error: null });
    try {
      const form = new FormData();
      form.append('file', file);
      if (concurso) form.append('concurso', concurso);
      if (disciplina) form.append('disciplina', disciplina);
      if (docType) form.append('doc_type', docType);

      const res = await api.post('/docs/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      set((s) => ({
        indexingResults: [res.data, ...s.indexingResults],
        isIndexing: false,
      }));
      await get().fetchDocuments();
      return res.data;
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({
        isIndexing: false,
        error: detail || 'Erro ao enviar/indexar PDF.',
      });
      return null;
    }
  },

  indexFile: async (filePath, concurso, disciplina) => {
    set({ isIndexing: true });
    try {
      const res = await api.post('/docs/index', {
        file_path: filePath,
        concurso,
        disciplina,
      });
      set((s) => ({
        indexingResults: [res.data, ...s.indexingResults],
        isIndexing: false,
      }));
      // Refresh list
      await get().fetchDocuments();
    } catch {
      set({ isIndexing: false });
    }
  },

  scanDirectory: async (dirPath) => {
    set({ isIndexing: true });
    try {
      const res = await api.post('/docs/scan', { directory_path: dirPath });
      set((s) => ({
        indexingResults: [...res.data, ...s.indexingResults],
        isIndexing: false,
      }));
      await get().fetchDocuments();
    } catch {
      set({ isIndexing: false });
    }
  },

  deleteDocument: async (id) => {
    try {
      await api.delete(`/docs/${id}`);
      set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
    } catch {
      // silently skip
    }
  },

  setFilter: (concurso, disciplina) => set({ filterConcurso: concurso, filterDisciplina: disciplina }),
}));
