import { useEffect, useMemo, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';
import { fetchPublicDecks } from '../../api/anki';
import { DeckCard } from './DeckCard';
import { DeckForm } from './DeckForm';
import { CSVImporter } from './CSVImporter';
import type { Deck } from '../../types';

const DECK_ORDER_KEY = 'anki:deckOrder';

function loadDeckOrder(): number[] {
  try {
    const raw = localStorage.getItem(DECK_ORDER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDeckOrder(order: number[]) {
  localStorage.setItem(DECK_ORDER_KEY, JSON.stringify(order));
}

function sortByOrder(decks: Deck[], order: number[]): Deck[] {
  const indexOf = (id: number) => {
    const idx = order.indexOf(id);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...decks].sort((a, b) => indexOf(a.id) - indexOf(b.id));
}

interface DeckListProps {
  onSelectDeck: (deck: Deck, isPublic?: boolean) => void;
  onStartReview: (deck: Deck) => void;
  showPublicDecks: boolean;
  onTogglePublicDecks: () => void;
  /** Pre-filtered deck list from parent (when discipline filter is active) */
  filteredDecks?: Deck[];
}

export function DeckList({ onSelectDeck, onStartReview, filteredDecks, showPublicDecks, onTogglePublicDecks }: DeckListProps) {
  const { decks, fetchDecks, deleteDeck, isLoadingDecks } = useAnkiStore();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [publicDecks, setPublicDecks] = useState<Deck[]>([]);
  const [isLoadingPublicDecks, setIsLoadingPublicDecks] = useState(false);
  const [publicDecksError, setPublicDecksError] = useState<string | null>(null);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deckOrder, setDeckOrder] = useState<number[]>(loadDeckOrder);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  useEffect(() => {
    if (!showPublicDecks) return;
    let active = true;
    setIsLoadingPublicDecks(true);
    setPublicDecksError(null);
    fetchPublicDecks()
      .then((items) => { if (active) setPublicDecks(items); })
      .catch(() => { if (active) setPublicDecksError('Não foi possível carregar os decks públicos. Tente novamente.'); })
      .finally(() => { if (active) setIsLoadingPublicDecks(false); });
    return () => { active = false; };
  }, [showPublicDecks]);

  const handleDelete = async (deck: Deck) => {
    if (window.confirm(`Excluir o deck "${deck.name}" e todos os seus cartões?`)) {
      await deleteDeck(deck.id);
    }
  };

  const baseDecks = showPublicDecks ? publicDecks : filteredDecks ?? decks;
  const displayedDecks = useMemo(() => sortByOrder(baseDecks, showPublicDecks ? [] : deckOrder), [baseDecks, deckOrder, showPublicDecks]);
  const loading = showPublicDecks ? isLoadingPublicDecks : isLoadingDecks;

  const handleDragStart = (deck: Deck) => () => {
    setDraggedId(deck.id);
  };

  const handleDragEnter = (deck: Deck) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (deck.id !== draggedId) setDragOverId(deck.id);
  };

  const handleDragOver = () => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (targetDeck: Deck) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedId === null || draggedId === targetDeck.id) return;

    const reordered = [...displayedDecks];
    const fromIndex = reordered.findIndex((d) => d.id === draggedId);
    const toIndex = reordered.findIndex((d) => d.id === targetDeck.id);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const newOrder = reordered.map((d) => d.id);
    setDeckOrder(newOrder);
    saveDeckOrder(newOrder);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {showPublicDecks ? 'Decks públicos' : 'Meus Decks'}
            {!showPublicDecks && filteredDecks && filteredDecks.length !== decks.length && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredDecks.length} de {decks.length})
            </span>
            )}
          </h2>
          <button
            onClick={onTogglePublicDecks}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {showPublicDecks ? 'Meus decks' : 'Explorar públicos'}
          </button>
        </div>
        {!showPublicDecks && <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 border border-green-400 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm font-medium"
          >
            <Upload size={16} />
            Importar
          </button>
          <button
            onClick={() => { setEditingDeck(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Novo Deck
          </button>
        </div>}
      </div>

      {publicDecksError && showPublicDecks && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{publicDecksError}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : displayedDecks.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-5xl mb-4">🗂️</p>
          <p className="font-medium">
            {!showPublicDecks && filteredDecks && filteredDecks.length === 0 && decks.length > 0
              ? 'Nenhum deck encontrado para esta disciplina'
              : showPublicDecks ? 'Nenhum deck público disponível' : 'Nenhum deck ainda'}
          </p>
          <p className="text-sm mt-1">
            {!showPublicDecks && filteredDecks && filteredDecks.length === 0 && decks.length > 0
              ? 'Crie um deck com o nome desta disciplina ou remova o filtro'
              : showPublicDecks ? 'Quando alguém compartilhar um deck, ele aparecerá aqui' : 'Crie seu primeiro deck para começar'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedDecks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onStudy={onStartReview}
              readOnly={showPublicDecks}
              onEdit={(d) => { setEditingDeck(d); setShowForm(true); }}
              onDelete={handleDelete}
              onClick={(d) => onSelectDeck(d, showPublicDecks)}
              draggable={!showPublicDecks}
              isDragging={draggedId === deck.id}
              isDragOver={dragOverId === deck.id}
              onDragStart={handleDragStart(deck)}
              onDragEnter={handleDragEnter(deck)}
              onDragOver={handleDragOver()}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop(deck)}
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

      {showImport && (
        <CSVImporter
          tabs={['anki', 'questoes']}
          defaultTab="anki"
          onClose={() => {
            setShowImport(false);
            fetchDecks();
          }}
        />
      )}
    </div>
  );
}
