import React, { useState } from 'react';
import { useAnkiStore } from '../store/ankiStore';
import { useStudyContext } from '../store/studyContextStore';
import { useSubjectStore } from '../store/subjectStore';
import { DeckList } from '../components/Anki/DeckList';
import { FlashcardList } from '../components/Anki/FlashcardList';
import { FlashcardsDashboard } from '../components/Anki/FlashcardsDashboard';
import { ReviewSession } from '../components/Anki/ReviewSession';
import type { Deck } from '../types';

type AnkiView = 'decks' | 'flashcards' | 'dashboard';

const AnkiPage: React.FC = () => {
  const { startReview, isReviewing, resumeReview, reviewQueue, currentCardIndex, sessionCorrect, sessionTotal, decks } = useAnkiStore();
  const { context } = useStudyContext();
  const { subjects: subjectList } = useSubjectStore();

  const [view, setView] = useState<AnkiView>('decks');
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [disciplineFilter, setDisciplineFilter] = useState<string>('');

  const canOpenCards = selectedDeck !== null;
  const hasPausedSession = !isReviewing && reviewQueue.length > 0 && currentCardIndex < reviewQueue.length;

  // All available discipline names for filter dropdown
  const allDisciplines = Array.from(
    new Set([
      ...context.subjects,
      ...subjectList.map(s => s.name),
      ...decks.map(d => d.name),
    ])
  ).filter(Boolean).sort();

  // Filter decks by selected discipline
  const filteredDecks = disciplineFilter
    ? decks.filter(d => {
        const subjectMatch = subjectList.find(s => s.id === d.subject_id);
        const nameMatch = d.name.toLowerCase().includes(disciplineFilter.toLowerCase()) ||
          (subjectMatch && subjectMatch.name.toLowerCase().includes(disciplineFilter.toLowerCase())) ||
          context.subjects.some(cs =>
            cs.toLowerCase() === disciplineFilter.toLowerCase() &&
            d.name.toLowerCase().includes(cs.toLowerCase())
          );
        return nameMatch;
      })
    : decks;

  const handleSelectDeck = (deck: Deck) => {
    setSelectedDeck(deck);
    setView('flashcards');
  };

  const handleStartReview = async (deck: Deck, assunto?: string | null) => {
    await startReview(deck.id, assunto);
  };

  const handleBack = () => {
    setSelectedDeck(null);
    setView('decks');
  };

  const handleSwitchDeck = (deckId: number) => {
    const target = decks.find((d) => d.id === deckId);
    if (target) setSelectedDeck(target);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">🧠 Flashcards</h1>
          </div>

          {/* Discipline filter — only show on decks view */}
          {view === 'decks' && (
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Disciplina:
              </label>
              <select
                value={disciplineFilter}
                onChange={e => setDisciplineFilter(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as disciplinas</option>
                {allDisciplines.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {disciplineFilter && (
                <button
                  onClick={() => setDisciplineFilter('')}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded"
                  title="Limpar filtro"
                >
                  ✕
                </button>
              )}
            </div>
          )}

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
              onClick={() => { if (selectedDeck) setView('flashcards'); }}
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

        {/* Discipline filter summary bar */}
        {view === 'decks' && disciplineFilter && (
          <div className="max-w-6xl mx-auto px-6 pb-2">
            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              Exibindo {filteredDecks.length} deck{filteredDecks.length !== 1 ? 's' : ''} de "{disciplineFilter}"
            </div>
          </div>
        )}
      </header>

      {/* Paused session banner */}
      {hasPausedSession && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20 px-4 py-3">
            <div className="flex items-center gap-3 text-sm text-yellow-800 dark:text-yellow-200">
              <span className="text-base">⏸</span>
              <span>
                Sessão pausada — <strong>{currentCardIndex}/{reviewQueue.length}</strong> cards respondidos
                {sessionTotal > 0 && <span className="ml-1">({sessionCorrect}/{sessionTotal} acertos)</span>}
              </span>
            </div>
            <button
              onClick={resumeReview}
              className="shrink-0 px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'decks' && (
          <div className="space-y-4">
            {!disciplineFilter && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
                Selecione um deck para abrir os cartões, editar flashcards ou iniciar uma revisão.
                Use o filtro de disciplina acima para encontrar decks específicos.
              </div>
            )}
            <DeckList
              onSelectDeck={handleSelectDeck}
              onStartReview={handleStartReview}
              filteredDecks={filteredDecks}
            />
          </div>
        )}

        {view === 'flashcards' && selectedDeck && (
          <FlashcardList
            deck={selectedDeck}
            onBack={handleBack}
            onStartReview={handleStartReview}
            onSwitchDeck={handleSwitchDeck}
          />
        )}

        {view === 'dashboard' && <FlashcardsDashboard />}
      </main>

      {/* Review overlay */}
      {isReviewing && <ReviewSession />}
    </div>
  );
};

export default AnkiPage;
