import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';
import type { Deck, Flashcard, FlashcardOption, CardType } from '../../types';

const CARD_TYPES: { value: CardType; label: string; desc: string }[] = [
  { value: 'qa', label: 'Pergunta / Resposta', desc: 'Frente e verso simples' },
  { value: 'multiple_choice', label: 'Múltipla Escolha', desc: '4 opções, 1 correta' },
  { value: 'cloze', label: 'Cloze Deletion', desc: 'Preencha a lacuna ___' },
  { value: 'true_false', label: 'Verdadeiro / Falso', desc: 'Afirmação V ou F' },
];

interface FlashcardFormProps {
  deck: Deck;
  card?: Flashcard | null;
  onClose: () => void;
}

export function FlashcardForm({ deck, card, onClose }: FlashcardFormProps) {
  const { createFlashcard, updateFlashcard } = useAnkiStore();
  const [cardType, setCardType] = useState<CardType>(card?.card_type ?? 'qa');
  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
  const [hint, setHint] = useState(card?.hint ?? '');
  const [difficulty, setDifficulty] = useState(card?.difficulty ?? 'Medium');
  const [options, setOptions] = useState<Partial<FlashcardOption>[]>(
    card?.options?.length
      ? card.options
      : [{ text: '', is_correct: true, position: 0 }, { text: '', is_correct: false, position: 1 }, { text: '', is_correct: false, position: 2 }, { text: '', is_correct: false, position: 3 }]
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card) {
      setCardType(card.card_type);
      setFront(card.front);
      setBack(card.back);
      setHint(card.hint ?? '');
      setDifficulty(card.difficulty);
      setOptions(card.options?.length ? card.options : [{ text: '', is_correct: true, position: 0 }, { text: '', is_correct: false, position: 1 }, { text: '', is_correct: false, position: 2 }, { text: '', is_correct: false, position: 3 }]);
    }
  }, [card]);

  const handleOptionChange = (index: number, field: keyof FlashcardOption, value: string | boolean) => {
    setOptions((prev) =>
      prev.map((opt, i) => {
        if (field === 'is_correct' && value === true) {
          return { ...opt, is_correct: i === index };
        }
        if (i === index) return { ...opt, [field]: value };
        return opt;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    setSaving(true);
    try {
      const payload: Partial<Flashcard> = {
        deck_id: deck.id,
        card_type: cardType,
        front: front.trim(),
        back: back.trim(),
        hint: hint.trim() || undefined,
        difficulty,
        options: cardType === 'multiple_choice' ? options.map((o, i) => ({ ...o, position: i } as FlashcardOption)) : [],
      };
      if (card) {
        await updateFlashcard(card.id, payload);
      } else {
        await createFlashcard(payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {card ? 'Editar Cartão' : 'Novo Cartão'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Card Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Cartão</label>
            <div className="grid grid-cols-2 gap-2">
              {CARD_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setCardType(ct.value)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    cardType === ct.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{ct.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{ct.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Front */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {cardType === 'cloze' ? 'Frase (use ___ para a lacuna)' : 'Frente / Pergunta'}
            </label>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              rows={2}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Back */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {cardType === 'cloze' ? 'Resposta da lacuna' : cardType === 'true_false' ? 'Resposta (Verdadeiro / Falso)' : 'Verso / Resposta'}
            </label>
            {cardType === 'true_false' ? (
              <div className="flex gap-3">
                {['Verdadeiro', 'Falso'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBack(v)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      back === v
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={back}
                onChange={(e) => setBack(e.target.value)}
                rows={2}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            )}
          </div>

          {/* Multiple Choice Options */}
          {cardType === 'multiple_choice' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Opções</label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={!!opt.is_correct}
                      onChange={() => handleOptionChange(i, 'is_correct', true)}
                      className="accent-blue-600"
                    />
                    <input
                      type="text"
                      value={opt.text ?? ''}
                      onChange={(e) => handleOptionChange(i, 'text', e.target.value)}
                      placeholder={`Opção ${String.fromCharCode(65 + i)}`}
                      className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hint & Difficulty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dica (opcional)</label>
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dificuldade</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Salvando...' : card ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
