import api from './client';
import type { Flashcard } from '../types';

export interface QuizImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface QuizPDFResult {
  session_id: number;
  total_questions: number;
  session_mode: string;
}

export const importQuizCSV = (file: File): Promise<QuizImportResult> => {
  const form = new FormData();
  form.append('file', file);
  return api
    .post<QuizImportResult>('/quiz/import-csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const importQuizPDF = (params: { file: File; numQuestions: number; subjectId?: number | null }): Promise<QuizPDFResult> => {
  const form = new FormData();
  form.append('file', params.file);
  form.append('num_questions', String(params.numQuestions));
  if (params.subjectId != null) form.append('subject_id', String(params.subjectId));
  return api
    .post<QuizPDFResult>('/quiz/generate-from-pdf', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export interface FlashcardCSVResult {
  count: number;
  cards: Flashcard[];
}

export const importFlashcardCSV = (params: { file: File; deckId: number; assunto?: string }): Promise<Flashcard[]> => {
  const form = new FormData();
  form.append('file', params.file);
  form.append('deck_id', String(params.deckId));
  if (params.assunto) form.append('assunto', params.assunto);
  return api
    .post<Flashcard[]>('/anki/flashcards/import-csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export interface FlashcardPDFResult {
  created_count: number;
  deck_name: string;
  deck_created: boolean;
  assunto: string | null;
}

export const importFlashcardPDF = (params: {
  file: File;
  deckId?: number | null;
  cardCount: number;
  cardTypes: string[];
}): Promise<FlashcardPDFResult> => {
  const form = new FormData();
  form.append('file', params.file);
  if (params.deckId != null) form.append('deck_id', String(params.deckId));
  form.append('card_count', String(params.cardCount));
  form.append('card_types', params.cardTypes.join(','));
  form.append('language', 'pt');
  return api
    .post<FlashcardPDFResult>('/anki/ai/generate-from-pdf', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};
