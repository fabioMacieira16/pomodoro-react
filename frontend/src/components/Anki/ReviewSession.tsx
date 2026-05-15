import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';
import type { Flashcard } from '../../types';

const QUALITY_BUTTONS = [
  { quality: 0, label: 'De Novo', color: 'bg-red-600 hover:bg-red-700', desc: 'Não lembrei' },
  { quality: 3, label: 'Difícil', color: 'bg-orange-500 hover:bg-orange-600', desc: '< 10 min' },
  { quality: 4, label: 'Bom', color: 'bg-blue-600 hover:bg-blue-700', desc: '< 1 dia' },
  { quality: 5, label: 'Fácil', color: 'bg-green-600 hover:bg-green-700', desc: '4 dias' },
];

export function ReviewSession() {
  const {
    reviewQueue,
    currentCardIndex,
    isReviewing,
    sessionCorrect,
    sessionTotal,
    submitReview,
    endReview,
  } = useAnkiStore();

  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const card: Flashcard | undefined = reviewQueue[currentCardIndex];
  const isFinished = currentCardIndex >= reviewQueue.length;

  useEffect(() => {
    setIsFlipped(false);
    setShowHint(false);
  }, [currentCardIndex]);

  if (!isReviewing) return null;

  if (isFinished) {
    const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-10 text-center max-w-md w-full mx-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Sessão Concluída!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {sessionTotal} cartões revisados &bull; {accuracy}% de acerto
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
              <p className="text-3xl font-bold text-green-600">{sessionCorrect}</p>
              <p className="text-sm text-green-700 dark:text-green-400">Acertos</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
              <p className="text-3xl font-bold text-red-600">{sessionTotal - sessionCorrect}</p>
              <p className="text-sm text-red-700 dark:text-red-400">Erros</p>
            </div>
          </div>
          <button
            onClick={endReview}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const handleRate = async (quality: number) => {
    setSubmitting(true);
    await submitReview(quality);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={endReview}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ✕ Encerrar sessão
        </button>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {currentCardIndex + 1} / {reviewQueue.length}
        </div>
        <div className="text-sm text-gray-500">
          {sessionCorrect}/{sessionTotal} acertos
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${(currentCardIndex / reviewQueue.length) * 100}%` }}
        />
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Card */}
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 min-h-56 flex flex-col cursor-pointer select-none"
            onClick={() => !isFlipped && setIsFlipped(true)}
          >
            <div className="flex-1 p-8 flex items-center justify-center">
              {!isFlipped ? (
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">Pergunta</p>
                  <p className="text-xl font-medium text-gray-900 dark:text-white whitespace-pre-wrap">{card.front}</p>
                  {card.hint && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowHint(!showHint); }}
                      className="mt-4 flex items-center gap-1 text-sm text-yellow-600 hover:text-yellow-700 mx-auto"
                    >
                      <Lightbulb size={14} />
                      {showHint ? 'Ocultar dica' : 'Ver dica'}
                      {showHint ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                  {showHint && card.hint && (
                    <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">{card.hint}</p>
                  )}
                  <p className="mt-6 text-sm text-gray-400">Clique para revelar</p>
                </div>
              ) : (
                <div className="text-center w-full">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">Resposta</p>
                  <p className="text-xl font-medium text-gray-900 dark:text-white whitespace-pre-wrap">{card.back}</p>

                  {/* Multiple choice options */}
                  {card.card_type === 'multiple_choice' && card.options?.length > 0 && (
                    <div className="mt-4 space-y-2 text-left max-w-md mx-auto">
                      {card.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                            opt.is_correct
                              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-medium'
                              : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 line-through opacity-60'
                          }`}
                        >
                          {opt.is_correct && <CheckCircle2 size={14} className="text-green-600 shrink-0" />}
                          {opt.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isFlipped && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 text-center">
                <button
                  onClick={() => setIsFlipped(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mostrar resposta
                </button>
              </div>
            )}
          </div>

          {/* Rating buttons */}
          {isFlipped && (
            <div className="mt-6 grid grid-cols-4 gap-3">
              {QUALITY_BUTTONS.map(({ quality, label, color, desc }) => (
                <button
                  key={quality}
                  onClick={() => handleRate(quality)}
                  disabled={submitting}
                  className={`py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 ${color}`}
                >
                  <p>{label}</p>
                  <p className="text-xs opacity-80 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
