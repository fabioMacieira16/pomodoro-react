import { useEffect, useState, type FormEvent } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';
import { useStudyContext } from '../../store/studyContextStore';
import { useSubjectStore } from '../../store/subjectStore';
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

const emptyOptions = (): Partial<FlashcardOption>[] => [
  { text: '', is_correct: true, position: 0 },
  { text: '', is_correct: false, position: 1 },
  { text: '', is_correct: false, position: 2 },
  { text: '', is_correct: false, position: 3 },
];

export function FlashcardForm({ deck, card, onClose }: FlashcardFormProps) {
  const { createFlashcard, updateFlashcard, flashcards } = useAnkiStore();
  const { context } = useStudyContext();
  const { subjects: subjectList } = useSubjectStore();

  const [cardType, setCardType] = useState<CardType>(card?.card_type ?? 'qa');
  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
  const [hint, setHint] = useState(card?.hint ?? '');
  const [explanation, setExplanation] = useState(card?.explanation ?? '');
  const [difficulty, setDifficulty] = useState(card?.difficulty ?? 'Medium');
  const [assunto, setAssunto] = useState<string>(() => {
    // Recover assunto from tags (format: "assunto:XXX")
    const tag = card?.tags?.find(t => t.startsWith('assunto:'));
    if (tag) return tag.replace('assunto:', '');
    if (card) return '';
    // Cartão novo: sugere o último assunto usado neste deck, para não precisar redigitar
    const lastTag = [...flashcards]
      .reverse()
      .map(c => c.tags?.find(t => t.startsWith('assunto:')))
      .find((t): t is string => !!t);
    return lastTag ? lastTag.replace('assunto:', '') : '';
  });
  const [options, setOptions] = useState<Partial<FlashcardOption>[]>(
    card?.options?.length ? card.options : emptyOptions()
  );
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Determine discipline from deck.subject_id or deck.name
  const deckDiscipline = (() => {
    if (deck.subject_id) {
      const subject = subjectList.find(s => s.id === deck.subject_id);
      if (subject) return subject.name;
    }
    // Fallback: check if deck name matches a context subject
    const contextMatch = context.subjects.find(
      s => deck.name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(deck.name.toLowerCase())
    );
    return contextMatch ?? deck.name;
  })();

  // Assunto suggestions: subjects already used on cards in this deck, plus disciplina names
  const allSubjectNames = Array.from(
    new Set([
      ...flashcards
        .map(c => c.tags?.find(t => t.startsWith('assunto:'))?.replace('assunto:', ''))
        .filter((v): v is string => !!v),
      ...context.subjects,
      ...subjectList.map(s => s.name),
    ])
  ).filter(Boolean);

  useEffect(() => {
    if (card) {
      setCardType(card.card_type);
      setFront(card.front);
      setBack(card.back);
      setHint(card.hint ?? '');
      setExplanation(card.explanation ?? '');
      setDifficulty(card.difficulty);
      const assuntoTag = card.tags?.find(t => t.startsWith('assunto:'));
      setAssunto(assuntoTag ? assuntoTag.replace('assunto:', '') : '');
      setOptions(card.options?.length ? card.options : emptyOptions());
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

  const buildTags = (): string[] => {
    const tags: string[] = [];
    if (deckDiscipline) tags.push(`disciplina:${deckDiscipline}`);
    if (assunto.trim()) tags.push(`assunto:${assunto.trim()}`);
    return tags;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const effectiveBack =
      cardType === 'multiple_choice'
        ? (options.find((o) => o.is_correct)?.text?.trim() ?? '')
        : back.trim();
    if (!front.trim() || !effectiveBack) return;
    setSaving(true);
    try {
      const payload: Partial<Flashcard> = {
        deck_id: deck.id,
        card_type: cardType,
        front: front.trim(),
        back: effectiveBack,
        hint: hint.trim() || undefined,
        explanation: cardType === 'true_false' ? (explanation.trim() || undefined) : undefined,
        difficulty,
        tags: buildTags(),
        options:
          cardType === 'multiple_choice'
            ? options.map((o, i) => ({ ...o, position: i } as FlashcardOption))
            : [],
      };
      if (card) {
        await updateFlashcard(card.id, payload);
        onClose();
      } else {
        await createFlashcard(payload);
        // Stay on screen so the user can immediately register the next card
        setFront('');
        setBack('');
        setHint('');
        setExplanation('');
        setOptions(emptyOptions());
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Disciplina (read-only, from deck) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Disciplina <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{deckDiscipline}</span>
              <span className="text-xs text-gray-400 ml-auto">via deck "{deck.name}"</span>
            </div>
          </div>

          {/* Assunto (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assunto <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              list="assunto-suggestions"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ex: SCRUM, Banco de Dados Relacional, Ponteiros..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="assunto-suggestions">
              {allSubjectNames.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

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

          {/* Back — hidden for multiple_choice (resposta é derivada das opções) */}
          {cardType !== 'multiple_choice' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {cardType === 'cloze'
                  ? 'Resposta da lacuna'
                  : cardType === 'true_false'
                  ? 'Resposta (Verdadeiro / Falso)'
                  : 'Verso / Resposta'}
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
          )}

          {/* Explicação (apenas para Verdadeiro/Falso) */}
          {cardType === 'true_false' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Por que é {back === 'Falso' ? 'falso' : 'verdadeiro'}? <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={2}
                placeholder="Explique o motivo da afirmação ser verdadeira ou falsa..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

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

          {justSaved && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} />
              Cartão criado! Continue cadastrando ou feche quando terminar.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {card ? 'Cancelar' : 'Concluir'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : card ? 'Salvar' : 'Criar e continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
