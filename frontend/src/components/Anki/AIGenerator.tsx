import React, { useState } from 'react';
import { X, Zap, Loader2 } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';
import type { Deck, CardType } from '../../types';

const SOURCE_TYPES = [
  { value: 'text', label: 'Texto / Resumo' },
  { value: 'pdf', label: 'PDF (cole o texto)' },
  { value: 'url', label: 'URL / Página web' },
  { value: 'summary', label: 'Tópicos / Notas' },
];

const CARD_TYPE_OPTIONS: { value: CardType; label: string }[] = [
  { value: 'qa', label: 'Pergunta / Resposta' },
  { value: 'multiple_choice', label: 'Múltipla Escolha' },
  { value: 'cloze', label: 'Cloze Deletion' },
  { value: 'true_false', label: 'Verdadeiro / Falso' },
];

interface AIGeneratorProps {
  deck: Deck;
  onClose: () => void;
}

export function AIGenerator({ deck, onClose }: AIGeneratorProps) {
  const { generateWithAI, isGenerating, generateError } = useAnkiStore();
  const [sourceType, setSourceType] = useState('text');
  const [content, setContent] = useState('');
  const [cardCount, setCardCount] = useState(10);
  const [cardTypes, setCardTypes] = useState<CardType[]>(['qa']);
  const [success, setSuccess] = useState<number | null>(null);

  const toggleCardType = (type: CardType) => {
    setCardTypes((prev) =>
      prev.includes(type) ? (prev.length > 1 ? prev.filter((t) => t !== type) : prev) : [...prev, type]
    );
  };

  const handleGenerate = async () => {
    if (!content.trim()) return;
    try {
      const count = await generateWithAI({
        deck_id: deck.id,
        source_type: sourceType,
        content: content.trim(),
        card_count: cardCount,
        card_types: cardTypes,
        language: 'pt',
      });
      setSuccess(count);
    } catch {
      // error handled in store
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Gerar Flashcards com IA</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {success !== null ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✨</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{success} cartões gerados!</h3>
              <p className="text-gray-500 mb-6">Os flashcards foram adicionados ao deck “{deck.name}”.</p>
              <button onClick={onClose} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                Ver Cartões
              </button>
            </div>
          ) : (
            <>
              {/* Source type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Conteúdo</label>
                <div className="grid grid-cols-2 gap-2">
                  {SOURCE_TYPES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSourceType(s.value)}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        sourceType === s.value
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {sourceType === 'url' ? 'URL' : 'Conteúdo'}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  placeholder={
                    sourceType === 'url'
                      ? 'Cole a URL aqui...'
                      : 'Cole ou escreva o conteúdo aqui. Quanto mais detalhado, melhores os flashcards gerados.'
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Card types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipos de Cartão</label>
                <div className="flex flex-wrap gap-2">
                  {CARD_TYPE_OPTIONS.map((ct) => (
                    <button
                      key={ct.value}
                      type="button"
                      onClick={() => toggleCardType(ct.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        cardTypes.includes(ct.value)
                          ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Número de Cartões: <span className="text-purple-600 font-bold">{cardCount}</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={30}
                  value={cardCount}
                  onChange={(e) => setCardCount(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>3</span>
                  <span>30</span>
                </div>
              </div>

              {generateError && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{generateError}</p>
              )}

              {!process.env.OPENAI_API_KEY && (
                <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                  ⚠️ <strong>OPENAI_API_KEY</strong> não configurada &mdash; serão gerados cartões de demonstração.
                </p>
              )}
            </>
          )}
        </div>

        {success === null && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !content.trim()}
              className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <><Loader2 size={16} className="animate-spin" /> Gerando...</>
              ) : (
                <><Zap size={16} /> Gerar {cardCount} Cartões</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
