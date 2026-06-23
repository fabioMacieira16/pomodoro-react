import api from './client';
import type { Deck, Flashcard, ReviewResult, AnkiStats, AIGenerateRequest } from '../types';

// ── Decks ─────────────────────────────────────────────────────────────────────────────

export const fetchDecks = () =>
  api.get<Deck[]>('/anki/decks/').then((r) => r.data);

export const fetchDeckTree = () =>
  api.get<Deck[]>('/anki/decks/tree').then((r) => r.data);

export const createDeck = (data: Partial<Deck>) =>
  api.post<Deck>('/anki/decks/', data).then((r) => r.data);

export const updateDeck = (id: number, data: Partial<Deck>) =>
  api.put<Deck>(`/anki/decks/${id}`, data).then((r) => r.data);

export const deleteDeck = (id: number) =>
  api.delete(`/anki/decks/${id}`).then((r) => r.data);

// ── Flashcards ───────────────────────────────────────────────────────────────────────

export const fetchFlashcards = (deckId: number) =>
  api.get<Flashcard[]>(`/anki/flashcards/deck/${deckId}`).then((r) => r.data);

export const createFlashcard = (data: Partial<Flashcard>) =>
  api.post<Flashcard>('/anki/flashcards/', data).then((r) => r.data);

export const bulkCreateFlashcards = (cards: Partial<Flashcard>[]) =>
  api.post<Flashcard[]>('/anki/flashcards/bulk', cards).then((r) => r.data);

export const updateFlashcard = (id: number, data: Partial<Flashcard>) =>
  api.put<Flashcard>(`/anki/flashcards/${id}`, data).then((r) => r.data);

export const deleteFlashcard = (id: number) =>
  api.delete(`/anki/flashcards/${id}`).then((r) => r.data);

// ── Review ──────────────────────────────────────────────────────────────────────────

export const fetchReviewQueue = (deckId: number, limit = 50) =>
  api.get<Flashcard[]>(`/anki/review/queue/${deckId}?limit=${limit}`).then((r) => r.data);

export const submitReview = (flashcardId: number, quality: number, responseTimeMs?: number) =>
  api
    .post<ReviewResult>('/anki/review/submit', {
      flashcard_id: flashcardId,
      quality,
      response_time_ms: responseTimeMs,
    })
    .then((r) => r.data);

// ── Stats ───────────────────────────────────────────────────────────────────────

export const fetchAnkiStats = () =>
  api.get<AnkiStats>('/anki/stats/').then((r) => r.data);

// ── AI Generation ───────────────────────────────────────────────────────────────

export const generateFlashcardsAI = (req: AIGenerateRequest) =>
  api.post<{ created_count: number; flashcards: Flashcard[] }>('/anki/ai/generate', req).then((r) => r.data);

export interface AIGenerateFromPDFResult {
  created_count: number;
  flashcards: Flashcard[];
  deck_id: number;
  deck_name: string;
  deck_created: boolean;
}

export const generateFlashcardsFromPDF = (params: {
  file: File;
  deckId?: number | null;
  cardCount: number;
  cardTypes: string[];
  language?: string;
}) => {
  const form = new FormData();
  form.append('file', params.file);
  if (params.deckId != null) form.append('deck_id', String(params.deckId));
  form.append('card_count', String(params.cardCount));
  form.append('card_types', params.cardTypes.join(','));
  form.append('language', params.language ?? 'pt');
  return api
    .post<AIGenerateFromPDFResult>('/anki/ai/generate-from-pdf', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};
