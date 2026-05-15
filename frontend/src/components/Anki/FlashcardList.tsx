import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Brain, Zap } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';
import { FlashcardForm } from './FlashcardForm';
import { AIGenerator } from './AIGenerator';
import type { Deck, Flashcard } from '../../types';

const CARD_TYPE_LABELS: Record<string, string> = {
  qa: 'P/R',
  multiple_choice: 'MC',
  cloze: 'Cloze',
  true_false: 'V/F',
};

const CARD_TYPE_COLORS: Record<string, string> = {
  qa: 'bg-blue-100 text-blue-700',
  multiple_choice: 'bg-purple-100 text-purple-700',
  cloze: 'bg-green-100 text-green-700',
  true_false: 'bg-orange-100 text-orange-700',
};

interface FlashcardListProps {
  deck: Deck;
  onBack: () => void;
  onStartReview: (deck: Deck) => void;
}

export function FlashcardList({ deck, onBack, onStartReview }: FlashcardListProps) {
  const { flashcards, fetchFlashcards, deleteFlashcard, isLoadingCards } = useAnkiStore();
  const [showForm, setShowForm] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);

  useEffect(() => {
    fetchFlashcards(deck.id);
  }, [deck.id, fetchFlashcards]);

  const handleDelete = async (card: Flashcard) => {
    if (window.confirm('Excluir este flashcard?')) {
      await deleteFlashcard(card.id);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ← Decks
          </button>
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: deck.color }} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{deck.name}</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAI(true)}
            className="flex items-center gap-2 px-3 py-2 border border-purple-300 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-sm font-medium"
          >
            <Zap size={14} />
            Gerar com IA
          </button>
          <button
            onClick={() => { setEditingCard(null); setShowForm(true); }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={14} />
            Novo Cartão
          </button>
          {deck.card_count > 0 && (
            <button
              onClick={() => onStartReview(deck)}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Brain size={14} />
              Estudar ({deck.due_count + deck.new_count})
            </button>
          )}
        </div>
      </div>

      {isLoadingCards ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : flashcards.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-5xl mb-4">🃏</p>
          <p className="font-medium">Nenhum cartão neste deck</p>
          <p className="text-sm mt-1">Crie manualmente ou use a IA para gerar cartões</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flashcards.map((card) => (
            <div
              key={card.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CARD_TYPE_COLORS[card.card_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CARD_TYPE_LABELS[card.card_type] ?? card.card_type}
                    </span>
                    <span className="text-xs text-gray-400">{card.difficulty}</span>
                    {card.next_review && (
                      <span className="text-xs text-gray-400">
                        Próx: {new Date(card.next_review).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{card.front}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{card.back}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => { setEditingCard(card); setShowForm(true); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(card)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <FlashcardForm
          deck={deck}
          card={editingCard}
          onClose={() => setShowForm(false)}
        />
      )}

      {showAI && (
        <AIGenerator
          deck={deck}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  );
}
