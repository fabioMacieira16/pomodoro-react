import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';
import type { Flashcard } from '../../types';
import { EliminateButton } from '../EliminateButton';

const QUALITY_BUTTONS = [
  { quality: 0, label: 'De Novo', color: 'bg-red-600 hover:bg-red-700', desc: 'Não lembrei' },
  { quality: 3, label: 'Difícil', color: 'bg-orange-500 hover:bg-orange-600', desc: '< 10 min' },
  { quality: 4, label: 'Bom', color: 'bg-blue-600 hover:bg-blue-700', desc: '< 1 dia' },
  { quality: 5, label: 'Fácil', color: 'bg-green-600 hover:bg-green-700', desc: '4 dias' },
];

function getAssunto(card: Flashcard): string | null {
  const tag = card.tags?.find((t) => t.startsWith('assunto:'));
  return tag ? tag.replace('assunto:', '') : null;
}

export function ReviewSession() {
  const {
    reviewQueue,
    currentCardIndex,
    isReviewing,
    sessionCorrect,
    sessionTotal,
    submitReview,
    endReview,
    cancelReview,
    decks,
  } = useAnkiStore();

  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOptionPos, setSelectedOptionPos] = useState<number | null>(null);
  const [selectedTrueFalse, setSelectedTrueFalse] = useState<string | null>(null);
  const [eliminatedOptions, setEliminatedOptions] = useState<Set<number>>(new Set());

  const card: Flashcard | undefined = reviewQueue[currentCardIndex];
  const isFinished = currentCardIndex >= reviewQueue.length;

  useEffect(() => {
    setIsFlipped(false);
    setShowHint(false);
    setSelectedOptionPos(null);
    setSelectedTrueFalse(null);
    setEliminatedOptions(new Set());
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

  const deck = decks.find((d) => d.id === card.deck_id);
  const assunto = getAssunto(card);

  const handleRate = async (quality: number) => {
    setSubmitting(true);
    await submitReview(quality);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={cancelReview}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Fechar sem encerrar a sessão — cards já revisados permanecem salvos"
          >
            ← Fechar
          </button>
          {sessionTotal > 0 && (
            <button
              onClick={endReview}
              className="text-sm text-red-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Encerrar e salvar estatísticas da sessão"
            >
              ✕ Encerrar sessão
            </button>
          )}
        </div>
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
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-4xl h-full flex flex-col">
          {/* Card */}
          <div
            className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex-1 min-h-[26rem] flex flex-col ${card.card_type !== 'multiple_choice' && card.card_type !== 'true_false' ? 'cursor-pointer select-none' : ''}`}
            onClick={() => card.card_type !== 'multiple_choice' && card.card_type !== 'true_false' && !isFlipped && setIsFlipped(true)}
          >
            {deck && (
              <div className="flex items-center justify-center gap-2 px-6 py-3 border-b border-gray-100 dark:border-gray-700">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: deck.color }}
                />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{deck.name}</span>
                {assunto && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{assunto}</span>
                  </>
                )}
              </div>
            )}
            <div className="flex-1 p-10 flex items-center justify-center overflow-y-auto">
              {card.card_type === 'multiple_choice' ? (
                /* Múltipla escolha: mostra pergunta + opções clicáveis */
                <div className="w-full">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-3 text-center">Pergunta</p>
                  <p className="text-xl font-medium text-gray-900 dark:text-white whitespace-pre-wrap mb-6 text-center">{card.front}</p>
                  {card.hint && (
                    <div className="text-center mb-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowHint(!showHint); }}
                        className="flex items-center gap-1 text-sm text-yellow-600 hover:text-yellow-700 mx-auto"
                      >
                        <Lightbulb size={14} />
                        {showHint ? 'Ocultar dica' : 'Ver dica'}
                        {showHint ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {showHint && (
                        <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">{card.hint}</p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2 max-w-md mx-auto">
                    {(card.options ?? []).map((opt, idx) => {
                      const isSelected = selectedOptionPos === opt.position;
                      const answered = isFlipped;
                      const isEliminated = eliminatedOptions.has(opt.position);
                      let cls = 'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10';
                      if (answered) {
                        if (opt.is_correct) cls = 'border border-green-400 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-semibold';
                        else if (isSelected) cls = 'border border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 line-through opacity-70';
                        else cls = 'border border-gray-200 dark:border-gray-600 text-gray-400 opacity-40';
                      }
                      return (
                        <div key={opt.position} className="flex items-center gap-1">
                          {!answered && (
                            <EliminateButton
                              eliminated={isEliminated}
                              onToggle={() => setEliminatedOptions(prev => {
                                const next = new Set(prev);
                                if (next.has(opt.position)) next.delete(opt.position); else next.add(opt.position);
                                return next;
                              })}
                            />
                          )}
                          <button
                            type="button"
                            disabled={answered}
                            onClick={(e) => { e.stopPropagation(); setSelectedOptionPos(opt.position); setIsFlipped(true); }}
                            className={`flex-1 flex items-center gap-3 p-3 rounded-lg text-sm text-left transition-colors ${cls} ${!answered ? 'cursor-pointer' : 'cursor-default'} ${isEliminated && !answered ? 'opacity-40 border-dashed' : ''}`}
                          >
                            <span className="shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-bold">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className={`flex-1 ${isEliminated && !answered ? 'line-through' : ''}`}>{opt.text}</span>
                            {answered && opt.is_correct && <CheckCircle2 size={14} className="text-green-600 shrink-0" />}
                            {answered && isSelected && !opt.is_correct && <span className="text-red-500 font-bold shrink-0">✗</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : card.card_type === 'true_false' ? (
                /* Verdadeiro/Falso: mostra afirmação + botões V/F */
                <div className="w-full">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-3 text-center">Afirmação</p>
                  <p className="text-xl font-medium text-gray-900 dark:text-white whitespace-pre-wrap mb-6 text-center">{card.front}</p>
                  {card.hint && (
                    <div className="text-center mb-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowHint(!showHint); }}
                        className="flex items-center gap-1 text-sm text-yellow-600 hover:text-yellow-700 mx-auto"
                      >
                        <Lightbulb size={14} />
                        {showHint ? 'Ocultar dica' : 'Ver dica'}
                        {showHint ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {showHint && (
                        <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">{card.hint}</p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-3 max-w-md mx-auto">
                    {['Verdadeiro', 'Falso'].map((v) => {
                      const isSelected = selectedTrueFalse === v;
                      const answered = isFlipped;
                      const isCorrectAnswer = v === card.back;
                      let cls = 'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10';
                      if (answered) {
                        if (isCorrectAnswer) cls = 'border border-green-400 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-semibold';
                        else if (isSelected) cls = 'border border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 line-through opacity-70';
                        else cls = 'border border-gray-200 dark:border-gray-600 text-gray-400 opacity-40';
                      }
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={answered}
                          onClick={(e) => { e.stopPropagation(); setSelectedTrueFalse(v); setIsFlipped(true); }}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors ${cls} ${!answered ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          {v}
                          {answered && isCorrectAnswer && <CheckCircle2 size={14} className="text-green-600" />}
                          {answered && isSelected && !isCorrectAnswer && <span className="text-red-500 font-bold">✗</span>}
                        </button>
                      );
                    })}
                  </div>
                  {isFlipped && (
                    <div className="mt-5 max-w-md mx-auto text-center">
                      <p className={`text-sm font-semibold ${selectedTrueFalse === card.back ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedTrueFalse === card.back ? 'Você acertou!' : 'Você errou.'} A afirmação é {card.back.toLowerCase()}.
                      </p>
                      {card.explanation && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                          {card.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : !isFlipped ? (
                /* Frente — cartões normais */
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
                /* Verso — cartões normais */
                <div className="text-center w-full">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">Resposta</p>
                  <p className="text-xl font-medium text-gray-900 dark:text-white whitespace-pre-wrap">{card.back}</p>
                </div>
              )}
            </div>

            {/* "Mostrar resposta" apenas para cartões de resposta livre */}
            {!isFlipped && card.card_type !== 'multiple_choice' && card.card_type !== 'true_false' && (
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
            <div className="mt-6 grid grid-cols-4 gap-3 shrink-0">
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
