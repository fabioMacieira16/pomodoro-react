import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnkiStore } from '../store/ankiStore';
import { DeckList } from '../components/Anki/DeckList';
import { FlashcardList } from '../components/Anki/FlashcardList';
import { AnkiDashboard } from '../components/Anki/AnkiDashboard';
import { ReviewSession } from '../components/Anki/ReviewSession';
import type { Deck } from '../types';

type AnkiView = 'decks' | 'flashcards' | 'dashboard';

const AnkiPage: React.FC = () => {
  const navigate = useNavigate();
  const { startReview, isReviewing } = useAnkiStore();
  const [view, setView] = useState<AnkiView>('decks');
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const canOpenCards = selectedDeck !== null;

  const handleSelectDeck = (deck: Deck) => {
    setSelectedDeck(deck);
    setView('flashcards');
  };

  const handleStartReview = async (deck: Deck) => {
    await startReview(deck.id);
  };

  const handleBack = () => {
    setSelectedDeck(null);
    setView('decks');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ← Pomodoro
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">🧠 Anki</h1>
          </div>

          <nav className="flex gap-1">
            <button
              onClick={() => { setView('decks'); setSelectedDeck(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'decks'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Decks
            </button>
            <button
              onClick={() => {
                if (selectedDeck) {
                  setView('flashcards');
                }
              }}
              disabled={!canOpenCards}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                view === 'flashcards'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={selectedDeck ? `Abrir cartões do deck ${selectedDeck.name}` : 'Selecione um deck para abrir os cartões'}
            >
              Cartões
            </button>
            <button
              onClick={() => setView('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'dashboard'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Estatísticas
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'decks' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
              Selecione um deck para abrir os cartões, editar flashcards ou iniciar uma revisão.
            </div>
            <DeckList
              onSelectDeck={handleSelectDeck}
              onStartReview={handleStartReview}
            />
          </div>
        )}

        {view === 'flashcards' && selectedDeck && (
          <FlashcardList
            deck={selectedDeck}
            onBack={handleBack}
            onStartReview={handleStartReview}
          />
        )}

        {view === 'dashboard' && <AnkiDashboard />}
      </main>

      {/* Review overlay */}
      {isReviewing && <ReviewSession />}
    </div>
  );
};

export default AnkiPage;
