import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';
import { useStudyContext } from '../../store/studyContextStore';
import { useSubjectStore } from '../../store/subjectStore';
import type { Deck } from '../../types';

const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#64748b',
];

interface DeckFormProps {
  deck?: Deck | null;
  onClose: () => void;
}

export function DeckForm({ deck, onClose }: DeckFormProps) {
  const { decks, createDeck, updateDeck } = useAnkiStore();
  const { context } = useStudyContext();
  const { subjects: subjectList, fetchSubjects } = useSubjectStore();

  const [name, setName] = useState(deck?.name ?? '');
  const [description, setDescription] = useState(deck?.description ?? '');
  const [color, setColor] = useState(deck?.color ?? COLORS[0]);
  const [parentDeckId, setParentDeckId] = useState<number | ''>(deck?.parent_deck_id ?? '');
  const [subjectId, setSubjectId] = useState<number | ''>(deck?.subject_id ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    if (deck) {
      setName(deck.name);
      setDescription(deck.description ?? '');
      setColor(deck.color);
      setParentDeckId(deck.parent_deck_id ?? '');
      setSubjectId(deck.subject_id ?? '');
    }
  }, [deck]);

  // Only use backend subjects (have real IDs) for the dropdown
  const allSubjects = subjectList;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload: Partial<Deck> = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        parent_deck_id: parentDeckId || undefined,
        subject_id: subjectId || undefined,
      };
      if (deck) {
        await updateDeck(deck.id, payload);
      } else {
        await createDeck(payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {deck ? 'Editar Deck' : 'Novo Deck'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Engenharia de Software, Banco de Dados..."
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Disciplina */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Disciplina <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sem disciplina</option>
              {allSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {context.subjects.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Ou associe ao nome do deck usando o nome exato da disciplina do edital.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subdeck de (opcional)</label>
            <select
              value={parentDeckId}
              onChange={(e) => setParentDeckId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Nenhum (deck raiz)</option>
              {decks
                .filter((d) => d.id !== deck?.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : deck ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
