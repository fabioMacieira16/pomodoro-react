import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Brain, Zap, ChevronRight, Layers, Upload } from 'lucide-react';
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
  onStartReview: (deck: Deck, assunto?: string | null) => void;
  onSwitchDeck?: (deckId: number) => void;
}

function getAssunto(card: Flashcard): string | null {
  const tag = card.tags?.find((t) => t.startsWith('assunto:'));
  return tag ? tag.replace('assunto:', '') : null;
}

function isDue(card: Flashcard): boolean {
  return !!card.next_review && new Date(card.next_review) <= new Date();
}

function isNew(card: Flashcard): boolean {
  return card.repetitions === 0;
}

interface Baralho {
  key: string;
  label: string;
  cards: Flashcard[];
}

export function FlashcardList({ deck, onBack, onStartReview, onSwitchDeck }: FlashcardListProps) {
  const { flashcards, fetchFlashcards, deleteFlashcard, isLoadingCards, importCSV } = useAnkiStore();
  const [showForm, setShowForm] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [selectedAssunto, setSelectedAssunto] = useState<string | null>(null);
  const [importingCSV, setImportingCSV] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFlashcards(deck.id);
  }, [deck.id, fetchFlashcards]);

  useEffect(() => {
    setSelectedAssunto(null);
  }, [deck.id]);

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const assunto = window.prompt(
      'Nome do assunto/sub-tópico para estes cartões (deixe em branco para nenhum):',
      selectedAssunto ?? ''
    );
    if (assunto === null) return; // usuário cancelou

    setImportingCSV(true);
    try {
      const created = await importCSV({ file, deckId: deck.id, assunto: assunto.trim() || null });
      window.alert(`${created.length} flashcard(s) importado(s) com sucesso!`);
    } catch {
      window.alert('Erro ao importar CSV. Verifique se o arquivo tem 2 colunas: frente,verso.');
    } finally {
      setImportingCSV(false);
    }
  };

  const handleDelete = async (card: Flashcard) => {
    if (window.confirm('Excluir este flashcard?')) {
      await deleteFlashcard(card.id);
    }
  };

  // Group cards into "baralhos" (sub-decks) by assunto, Flashcards-style
  const groups = new Map<string, Flashcard[]>();
  for (const card of flashcards) {
    const key = getAssunto(card) ?? '__none__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }
  const baralhos: Baralho[] = Array.from(groups.entries())
    .map(([key, cards]) => ({ key, label: key === '__none__' ? 'Sem assunto' : key, cards }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const currentBaralho = selectedAssunto ? baralhos.find((b) => b.key === selectedAssunto) ?? null : null;
  const visibleCards = currentBaralho ? currentBaralho.cards : [];

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
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
            onClick={() => csvInputRef.current?.click()}
            disabled={importingCSV}
            className="flex items-center gap-2 px-3 py-2 border border-green-300 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Upload size={14} />
            {importingCSV ? 'Importando...' : 'Importar CSV'}
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={handleImportCSV}
          />
          <button
            onClick={() => { setEditingCard(null); setShowForm(true); }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={14} />
            Novo Cartão
          </button>
          {deck.card_count > 0 && (
            <button
              onClick={() => onStartReview(deck, selectedAssunto)}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Brain size={14} />
              {currentBaralho ? `Estudar "${currentBaralho.label}" (${visibleCards.length})` : `Estudar (${deck.due_count + deck.new_count})`}
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
      ) : !currentBaralho ? (
        /* ── Lista de baralhos por assunto ──────────────────── */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="grid grid-cols-[1fr_70px_70px_60px] items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-700">
            <span>Assunto</span>
            <span className="text-center text-blue-500">Novos</span>
            <span className="text-center text-orange-500">Revisão</span>
            <span className="text-center">Total</span>
          </div>
          {baralhos.map((b) => {
            const novos = b.cards.filter(isNew).length;
            const revisao = b.cards.filter(isDue).length;
            return (
              <button
                key={b.key}
                onClick={() => setSelectedAssunto(b.key)}
                className="w-full grid grid-cols-[1fr_70px_70px_60px] items-center px-4 py-3 text-left border-b border-gray-50 dark:border-gray-700/50 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Layers size={15} className="text-gray-400 shrink-0" />
                  <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{b.label}</span>
                </span>
                <span className={`text-center text-sm font-semibold ${novos > 0 ? 'text-blue-600' : 'text-gray-300 dark:text-gray-600'}`}>
                  {novos || '–'}
                </span>
                <span className={`text-center text-sm font-semibold ${revisao > 0 ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600'}`}>
                  {revisao || '–'}
                </span>
                <span className="flex items-center justify-center gap-1 text-sm text-gray-400">
                  {b.cards.length}
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* ── Cartões do baralho selecionado ─────── */
        <div>
          <button
            onClick={() => setSelectedAssunto(null)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-3"
          >
            ← Baralhos
          </button>

          {visibleCards.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <p className="font-medium">Nenhum cartão neste baralho</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="grid grid-cols-[60px_1fr_70px_90px_70px] items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <span>Tipo</span>
                <span>Pergunta</span>
                <span className="text-center">Status</span>
                <span className="text-center">Dificul.</span>
                <span className="text-right">Ações</span>
              </div>
              {visibleCards.map((card, idx) => (
                <div
                  key={card.id}
                  className={`grid grid-cols-[60px_1fr_70px_90px_70px] items-center px-4 py-2.5 gap-2 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0 ${
                    idx % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-700/20' : ''
                  }`}
                >
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium text-center ${CARD_TYPE_COLORS[card.card_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {CARD_TYPE_LABELS[card.card_type] ?? card.card_type}
                  </span>
                  <span className="min-w-0 truncate text-sm text-gray-900 dark:text-white">{card.front}</span>
                  <span className="text-center">
                    {isNew(card) ? (
                      <span className="text-[11px] font-semibold text-blue-600">Novo</span>
                    ) : isDue(card) ? (
                      <span className="text-[11px] font-semibold text-orange-500">Revisar</span>
                    ) : (
                      <span className="text-[11px] text-gray-400">
                        {card.next_review ? new Date(card.next_review).toLocaleDateString('pt-BR') : '—'}
                      </span>
                    )}
                  </span>
                  <span className="text-center text-xs text-gray-400">{card.difficulty}</span>
                  <span className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => { setEditingCard(card); setShowForm(true); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(card)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
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
          onClose={(resultDeckId) => {
            setShowAI(false);
            if (resultDeckId && resultDeckId !== deck.id) onSwitchDeck?.(resultDeckId);
          }}
        />
      )}
    </div>
  );
}
