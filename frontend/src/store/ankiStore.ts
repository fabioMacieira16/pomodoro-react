import { create } from 'zustand';
import type { Deck, Flashcard, AnkiStats, AIGenerateRequest } from '../types';
import * as ankiApi from '../api/anki';
import type { AIGenerateFromPDFResult } from '../api/anki';

interface AnkiState {
  // Decks
  decks: Deck[];
  currentDeck: Deck | null;
  isLoadingDecks: boolean;

  // Flashcards
  flashcards: Flashcard[];
  isLoadingCards: boolean;

  // Review Session
  reviewQueue: Flashcard[];
  currentCardIndex: number;
  isReviewing: boolean;
  reviewStartTime: number | null;
  sessionCorrect: number;
  sessionTotal: number;

  // Stats
  stats: AnkiStats | null;
  isLoadingStats: boolean;

  // AI
  isGenerating: boolean;
  generateError: string | null;

  // Deck actions
  fetchDecks: () => Promise<void>;
  setCurrentDeck: (deck: Deck | null) => void;
  createDeck: (data: Partial<Deck>) => Promise<Deck>;
  updateDeck: (id: number, data: Partial<Deck>) => Promise<void>;
  deleteDeck: (id: number) => Promise<void>;

  // Flashcard actions
  fetchFlashcards: (deckId: number) => Promise<void>;
  createFlashcard: (data: Partial<Flashcard>) => Promise<void>;
  updateFlashcard: (id: number, data: Partial<Flashcard>) => Promise<void>;
  deleteFlashcard: (id: number) => Promise<void>;

  // Review actions
  startReview: (deckId: number, assunto?: string | null) => Promise<void>;
  submitReview: (quality: number) => Promise<void>;
  endReview: () => void;

  // Stats actions
  fetchStats: () => Promise<void>;

  // AI actions
  generateWithAI: (req: AIGenerateRequest) => Promise<number>;
  generateFromPDF: (params: {
    file: File;
    deckId?: number | null;
    cardCount: number;
    cardTypes: string[];
    language?: string;
  }) => Promise<AIGenerateFromPDFResult>;
}

export const useAnkiStore = create<AnkiState>((set, get) => ({
  decks: [],
  currentDeck: null,
  isLoadingDecks: false,
  flashcards: [],
  isLoadingCards: false,
  reviewQueue: [],
  currentCardIndex: 0,
  isReviewing: false,
  reviewStartTime: null,
  sessionCorrect: 0,
  sessionTotal: 0,
  stats: null,
  isLoadingStats: false,
  isGenerating: false,
  generateError: null,

  // ── Decks ───────────────────────────────────────────────────────────────────────

  fetchDecks: async () => {
    set({ isLoadingDecks: true });
    try {
      const decks = await ankiApi.fetchDecks();
      set({ decks });
    } finally {
      set({ isLoadingDecks: false });
    }
  },

  setCurrentDeck: (deck) => set({ currentDeck: deck }),

  createDeck: async (data) => {
    const deck = await ankiApi.createDeck(data);
    set((s) => ({ decks: [...s.decks, deck] }));
    return deck;
  },

  updateDeck: async (id, data) => {
    const updated = await ankiApi.updateDeck(id, data);
    set((s) => ({
      decks: s.decks.map((d) => (d.id === id ? updated : d)),
      currentDeck: s.currentDeck?.id === id ? updated : s.currentDeck,
    }));
  },

  deleteDeck: async (id) => {
    await ankiApi.deleteDeck(id);
    set((s) => ({
      decks: s.decks.filter((d) => d.id !== id),
      currentDeck: s.currentDeck?.id === id ? null : s.currentDeck,
    }));
  },

  // ── Flashcards ─────────────────────────────────────────────────────────────────

  fetchFlashcards: async (deckId) => {
    set({ isLoadingCards: true });
    try {
      const flashcards = await ankiApi.fetchFlashcards(deckId);
      set({ flashcards });
    } finally {
      set({ isLoadingCards: false });
    }
  },

  createFlashcard: async (data) => {
    const card = await ankiApi.createFlashcard(data);
    set((s) => ({ flashcards: [...s.flashcards, card] }));
    // refresh deck counts
    await get().fetchDecks();
  },

  updateFlashcard: async (id, data) => {
    const updated = await ankiApi.updateFlashcard(id, data);
    set((s) => ({ flashcards: s.flashcards.map((c) => (c.id === id ? updated : c)) }));
  },

  deleteFlashcard: async (id) => {
    await ankiApi.deleteFlashcard(id);
    set((s) => ({ flashcards: s.flashcards.filter((c) => c.id !== id) }));
    await get().fetchDecks();
  },

  // ── Review ──────────────────────────────────────────────────────────────────────

  startReview: async (deckId, assunto) => {
    const queue = await ankiApi.fetchReviewQueue(deckId);
    const filteredQueue = assunto
      ? queue.filter((c) => {
          const tag = c.tags?.find((t) => t.startsWith('assunto:'));
          const cardAssunto = tag ? tag.replace('assunto:', '') : null;
          return assunto === '__none__' ? !cardAssunto : cardAssunto === assunto;
        })
      : queue;
    set({
      reviewQueue: filteredQueue,
      currentCardIndex: 0,
      isReviewing: true,
      reviewStartTime: Date.now(),
      sessionCorrect: 0,
      sessionTotal: 0,
    });
  },

  submitReview: async (quality) => {
    const { reviewQueue, currentCardIndex, reviewStartTime } = get();
    const card = reviewQueue[currentCardIndex];
    if (!card) return;

    const responseTimeMs = reviewStartTime ? Date.now() - reviewStartTime : undefined;
    await ankiApi.submitReview(card.id, quality, responseTimeMs);

    const isCorrect = quality >= 3;
    set((s) => ({
      // "De Novo" (quality 0): card volta para o fim da fila para ser revisado de novo na mesma sessão
      reviewQueue: quality === 0 ? [...s.reviewQueue, card] : s.reviewQueue,
      sessionCorrect: s.sessionCorrect + (isCorrect ? 1 : 0),
      sessionTotal: s.sessionTotal + 1,
      currentCardIndex: s.currentCardIndex + 1,
      reviewStartTime: Date.now(),
    }));
  },

  endReview: () => {
    set({ isReviewing: false, reviewQueue: [], currentCardIndex: 0 });
    get().fetchDecks();
    get().fetchStats();
  },

  // ── Stats ──────────────────────────────────────────────────────────────────────

  fetchStats: async () => {
    set({ isLoadingStats: true });
    try {
      const stats = await ankiApi.fetchAnkiStats();
      set({ stats });
    } finally {
      set({ isLoadingStats: false });
    }
  },

  // ── AI ─────────────────────────────────────────────────────────────────────────

  generateWithAI: async (req) => {
    set({ isGenerating: true, generateError: null });
    try {
      const result = await ankiApi.generateFlashcardsAI(req);
      // Refresh flashcards for the deck
      await get().fetchFlashcards(req.deck_id);
      await get().fetchDecks();
      return result.created_count;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar flashcards';
      set({ generateError: msg });
      throw err;
    } finally {
      set({ isGenerating: false });
    }
  },

  generateFromPDF: async (params) => {
    set({ isGenerating: true, generateError: null });
    try {
      const result = await ankiApi.generateFlashcardsFromPDF(params);
      await get().fetchFlashcards(result.deck_id);
      await get().fetchDecks();
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar flashcards a partir do PDF';
      set({ generateError: msg });
      throw err;
    } finally {
      set({ isGenerating: false });
    }
  },
}));
