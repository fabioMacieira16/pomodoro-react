import React from 'react';
import { BookOpen, Brain, Clock } from 'lucide-react';
import type { Deck } from '../../types';

interface DeckCardProps {
  deck: Deck;
  onStudy: (deck: Deck) => void;
  onEdit: (deck: Deck) => void;
  onDelete: (deck: Deck) => void;
  onClick: (deck: Deck) => void;
}

export function DeckCard({ deck, onStudy, onEdit, onDelete, onClick }: DeckCardProps) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick(deck)}
    >
      {/* Color bar */}
      <div className="h-2 rounded-t-xl" style={{ backgroundColor: deck.color }} /}

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${deck.color}20` }}
            >
              <BookOpen size={16} style={{ color: deck.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{deck.name}</h3>
              {deck.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{deck.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mb-3">
          <span className="flex items-center gap-1">
            <Brain size={12} />
            {deck.card_count} cartões
          </span>
          {deck.due_count > 0 && (
            <span className="flex items-center gap-1 text-orange-500 font-medium">
              <Clock size={12} />
              {deck.due_count} para revisar
            </span>
          )}
          {deck.new_count > 0 && (
            <span className="text-blue-500 font-medium">{deck.new_count} novos</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onStudy(deck)}
            disabled={deck.card_count === 0}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Estudar
          </button>
          <button
            onClick={() => onEdit(deck)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Editar
          </button>
          <button
            onClick={() => onDelete(deck)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
