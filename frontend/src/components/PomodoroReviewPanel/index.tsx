import { useEffect, useMemo, useState } from 'react';
import { useAnkiStore } from '../../store/ankiStore';
import type { Deck } from '../../types';
import './styles.css';

interface PomodoroReviewPanelProps {
  subjectName: string | null;
}

const QUALITY_BUTTONS = [
  { quality: 0, label: 'De Novo', cls: 'rp-q rp-q--again' },
  { quality: 3, label: 'Difícil', cls: 'rp-q rp-q--hard' },
  { quality: 4, label: 'Bom', cls: 'rp-q rp-q--good' },
  { quality: 5, label: 'Fácil', cls: 'rp-q rp-q--easy' },
];

function matchesSubject(deck: Deck, subjectName: string | null): boolean {
  if (!subjectName) return false;
  const s = subjectName.toLowerCase();
  return deck.name.toLowerCase().includes(s) || s.includes(deck.name.toLowerCase());
}

export function PomodoroReviewPanel({ subjectName }: PomodoroReviewPanelProps) {
  const {
    decks,
    fetchDecks,
    reviewQueue,
    currentCardIndex,
    isReviewing,
    sessionCorrect,
    sessionTotal,
    startReview,
    submitReview,
    endReview,
  } = useAnkiStore();

  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (decks.length === 0) void fetchDecks();
  }, [decks.length, fetchDecks]);

  const suggestedDeck = useMemo(
    () => decks.find((d) => matchesSubject(d, subjectName)) ?? null,
    [decks, subjectName]
  );

  useEffect(() => {
    if (suggestedDeck && selectedDeckId === null && !isReviewing) {
      setSelectedDeckId(suggestedDeck.id);
      void startReview(suggestedDeck.id);
    }
  }, [suggestedDeck, selectedDeckId, isReviewing, startReview]);

  useEffect(() => {
    setIsFlipped(false);
  }, [currentCardIndex]);

  const handlePickDeck = (deckId: number) => {
    setSelectedDeckId(deckId);
    void startReview(deckId);
  };

  const handleSwitchDeck = () => {
    endReview();
    setSelectedDeckId(null);
  };

  const handleRate = async (quality: number) => {
    setSubmitting(true);
    await submitReview(quality);
    setSubmitting(false);
  };

  const card = reviewQueue[currentCardIndex];
  const isFinished = isReviewing && currentCardIndex >= reviewQueue.length;

  if (!isReviewing || selectedDeckId === null) {
    return (
      <div className="rp-panel">
        <h3 className="rp-title">🔁 Modo Revisão</h3>
        <p className="rp-hint">Escolha um baralho para revisar enquanto o tempo corre:</p>
        <div className="rp-deck-list">
          {decks.filter((d) => d.card_count > 0).map((d) => (
            <button key={d.id} className="rp-deck-item" onClick={() => handlePickDeck(d.id)}>
              <span className="rp-deck-dot" style={{ backgroundColor: d.color }} />
              <span className="rp-deck-name">{d.name}</span>
              <span className="rp-deck-count">{d.due_count + d.new_count}</span>
            </button>
          ))}
          {decks.filter((d) => d.card_count > 0).length === 0 && (
            <p className="rp-hint">Nenhum baralho com cartões disponível.</p>
          )}
        </div>
      </div>
    );
  }

  if (isFinished) {
    const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
    return (
      <div className="rp-panel">
        <h3 className="rp-title">🎉 Revisão concluída!</h3>
        <p className="rp-hint">{sessionTotal} cartões &bull; {accuracy}% de acerto</p>
        <button className="rp-switch-btn" onClick={handleSwitchDeck}>Revisar outro baralho</button>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="rp-panel">
      <div className="rp-header">
        <span className="rp-progress">{currentCardIndex + 1} / {reviewQueue.length}</span>
        <span className="rp-score">{sessionCorrect}/{sessionTotal} acertos</span>
        <button className="rp-switch-link" onClick={handleSwitchDeck}>Trocar baralho</button>
      </div>

      <div className="rp-card" onClick={() => !isFlipped && setIsFlipped(true)}>
        {!isFlipped ? (
          <>
            <p className="rp-card-label">Pergunta</p>
            <p className="rp-card-text">{card.front}</p>
            <p className="rp-card-cta">Clique para revelar</p>
          </>
        ) : (
          <>
            <p className="rp-card-label">Resposta</p>
            <p className="rp-card-text">{card.back}</p>
            {card.card_type === 'true_false' && card.explanation && (
              <p className="rp-card-explanation">{card.explanation}</p>
            )}
          </>
        )}
      </div>

      {isFlipped && (
        <div className="rp-quality-row">
          {QUALITY_BUTTONS.map(({ quality, label, cls }) => (
            <button key={quality} className={cls} disabled={submitting} onClick={() => handleRate(quality)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
