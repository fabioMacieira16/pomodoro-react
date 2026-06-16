import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';
import { DeckCard } from './DeckCard';
import { DeckForm } from './DeckForm';
import type { Deck } from '../../types';

interface DeckListProps {
  onSelectDeck: (deck: Deck) => void;
  onStartReview: (deck: Deck) => void;
  /** Pre-filtered deck list from parent (when discipline filter is active) */
  filteredDecks?: Deck[];
}

export function DeckList({ onSelectDeck, onStartReview, filteredDecks }: DeckListProps) {
  const { decks, fetchDecks, deleteDeck, isLoadingDecks } = useAnkiStore();
  const [showForm, setShowForm] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  const handleDelete = async (deck: Deck) => {
    if (window.confirm(`Excluir o deck "${deck.name}" e todos os seus cartões?`)) {
      await deleteDeck(deck.id);
    }
  };

  const displayedDecks = filteredDecks ?? decks;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Meus Decks
          {filteredDecks && filteredDecks.length !== decks.length && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredDecks.length} de {decks.length})
            </span>
          )}
        </h2>
        <button
          onClick={() => { setEditingDeck(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Novo Deck
        </button>
      </div>

      {isLoadingDecks ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : displayedDecks.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-5xl mb-4">🗂️</p>
          <p className="font-medium">
            {filteredDecks && filteredDecks.length === 0 && decks.length > 0
              ? 'Nenhum deck encontrado para esta disciplina'
              : 'Nenhum deck ainda'}
          </p>
          <p className="text-sm mt-1">
            {filteredDecks && filteredDecks.length === 0 && decks.length > 0
              ? 'Crie um deck com o nome desta disciplina ou remova o filtro'
              : 'Crie seu primeiro deck para começar'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedDecks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onStudy={onStartReview}
              onEdit={(d) => { setEditingDeck(d); setShowForm(true); }}
              onDelete={handleDelete}
              onClick={onSelectDeck}
            />
          ))}
        </div>
      )}

      {showForm && (
        <DeckForm
          deck={editingDeck}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
