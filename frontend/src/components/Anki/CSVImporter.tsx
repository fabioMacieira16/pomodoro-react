import { useRef, useState } from 'react';
import { X, Upload, FileText, ClipboardCopy } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';
import { importQuizCSV, type QuizImportResult } from '../../api/imports';
import { importAnkiExport, type AnkiImportResult } from '../../api/anki';
import type { Deck } from '../../types';
import { useSubjectStore } from '../../store/subjectStore';

const QUIZ_PROMPT = `Gere 20 questões de múltipla escolha sobre [DISCIPLINA] para concursos públicos.

Retorne APENAS um CSV com o cabeçalho abaixo (sem texto extra, sem markdown):
disciplina,enunciado,a,b,c,d,gabarito,explicacao,dificuldade

Regras:
- Cada linha = 1 questão
- Gabarito = apenas a letra (A, B, C ou D)
- Não coloque "(correta)" ou "(X)" nas alternativas
- dificuldade = Easy, Medium ou Hard
- Se o texto tiver vírgula, envolva em aspas duplas`;

const FLASH_PROMPT = `Gere 30 flashcards sobre [TEMA] no formato CSV puro (sem cabeçalho, sem markdown):
frente da pergunta,resposta objetiva

Regras:
- Respostas curtas (máx 2 linhas)
- Se o texto tiver vírgula, envolva em aspas duplas`;

type TabType = 'flashcards' | 'questoes' | 'anki';

interface Props {
  deck?: Deck | null;
  onClose: () => void;
  /** Quais abas exibir. Padrão: todas. */
  tabs?: TabType[];
  /** Aba aberta ao montar. Padrão: primeira da lista. */
  defaultTab?: TabType;
  /** Assunto/disciplina pré-selecionado (ex: sub-baralho clicado no FlashcardList). */
  defaultAssunto?: string | null;
}

const ALL_TABS: TabType[] = ['flashcards', 'questoes', 'anki'];

export function CSVImporter({ deck, onClose, tabs = ALL_TABS, defaultTab, defaultAssunto }: Props) {
  const { importCSV, decks } = useAnkiStore();
  const { subjects } = useSubjectStore();

  const visibleTabs = tabs.length > 0 ? tabs : ALL_TABS;
  const [tab, setTab] = useState<TabType>(defaultTab ?? visibleTabs[0]);
  const [isLoading, setIsLoading] = useState(false);

  // Flashcard CSV state
  const [flashFile, setFlashFile] = useState<File | null>(null);
  const [assunto, setAssunto] = useState(defaultAssunto ?? '');
  const [assuntoSuggestions, setAssuntoSuggestions] = useState<string[]>([]);
  const [flashResult, setFlashResult] = useState<{ count: number } | null>(null);

  // Quiz CSV state
  const [quizFile, setQuizFile] = useState<File | null>(null);
  const [quizResult, setQuizResult] = useState<QuizImportResult | null>(null);

  // Anki export state
  const [ankiFile, setAnkiFile] = useState<File | null>(null);
  const [ankiResult, setAnkiResult] = useState<AnkiImportResult | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const [copiedQuiz, setCopiedQuiz] = useState(false);

  const flashInputRef = useRef<HTMLInputElement>(null);
  const quizInputRef = useRef<HTMLInputElement>(null);
  const ankiInputRef = useRef<HTMLInputElement>(null);

  const copy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleAssuntoChange = (value: string) => {
    setAssunto(value);
    if (value.trim().length >= 3) {
      const q = value.trim().toLowerCase();
      const deckNames = decks.map((d) => d.name);
      const subjectNames = subjects.map((s) => s.name);
      const all = Array.from(new Set([...deckNames, ...subjectNames]));
      setAssuntoSuggestions(all.filter((n) => n.toLowerCase().includes(q)).slice(0, 6));
    } else {
      setAssuntoSuggestions([]);
    }
  };

  const handleFlashImport = async () => {
    if (!flashFile || !deck) return;
    setIsLoading(true);
    setError(null);
    setFlashResult(null);
    try {
      const created = await importCSV({
        file: flashFile,
        deckId: deck.id,
        assunto: assunto.trim() || null,
      });
      setFlashResult({ count: created.length });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Erro ao importar CSV. Verifique se o arquivo tem 2 colunas: frente,verso.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizImport = async () => {
    if (!quizFile) return;
    setIsLoading(true);
    setError(null);
    setQuizResult(null);
    try {
      const result = await importQuizCSV(quizFile, deck?.id, defaultAssunto);
      setQuizResult(result);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Erro ao importar questões.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnkiImport = async () => {
    if (!ankiFile) return;
    setIsLoading(true);
    setError(null);
    setAnkiResult(null);
    try {
      const result = await importAnkiExport(ankiFile);
      setAnkiResult(result);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Erro ao importar export do Anki.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Importar CSV</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs — only render tabs that are in visibleTabs */}
        {visibleTabs.length > 1 && (
          <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
            {visibleTabs.includes('flashcards') && (
              <button
                onClick={() => { setTab('flashcards'); setError(null); }}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'flashcards'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Flashcards
              </button>
            )}
            {visibleTabs.includes('questoes') && (
              <button
                onClick={() => { setTab('questoes'); setError(null); }}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'questoes'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Questões MC
              </button>
            )}
            {visibleTabs.includes('anki') && (
              <button
                onClick={() => { setTab('anki'); setError(null); }}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'anki'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Importar Anki
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">

          {/* ── Flashcards tab ──────────────────────────────────── */}
          {tab === 'flashcards' && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Formato: duas colunas <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">frente,verso</code> sem cabeçalho.
                {deck && <> Os cartões vão para o deck <strong>"{deck.name}"</strong>.</>}
              </p>

              {flashResult ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-semibold text-gray-900 dark:text-white">{flashResult.count} flashcard(s) importado(s)!</p>
                  {deck && <p className="text-sm text-gray-500 mt-1">Deck: "{deck.name}"</p>}
                  <button
                    onClick={onClose}
                    className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Ver Cartões
                  </button>
                </div>
              ) : (
                <>
                  {/* File picker */}
                  <label className="flex flex-col items-center justify-center gap-2 w-full py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-green-400 transition-colors">
                    <input
                      ref={flashInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => setFlashFile(e.target.files?.[0] ?? null)}
                    />
                    {flashFile ? (
                      <>
                        <FileText size={26} className="text-green-600" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{flashFile.name}</span>
                        <span className="text-xs text-gray-400">Clique para trocar</span>
                      </>
                    ) : (
                      <>
                        <Upload size={26} className="text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Clique para selecionar o CSV</span>
                      </>
                    )}
                  </label>

                  {/* Assunto */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Assunto / Tag <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={assunto}
                      onChange={(e) => handleAssuntoChange(e.target.value)}
                      onBlur={() => setTimeout(() => setAssuntoSuggestions([]), 150)}
                      placeholder="ex: Direito Penal, Matemática Financeira…"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {assuntoSuggestions.length > 0 && (
                      <ul className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
                        {assuntoSuggestions.map((s) => (
                          <li key={s}>
                            <button
                              type="button"
                              onMouseDown={() => { setAssunto(s); setAssuntoSuggestions([]); }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                            >
                              {s}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Prompt helper */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Prompt para ChatGPT
                      </span>
                      <button
                        onClick={() => copy(FLASH_PROMPT, setCopiedFlash)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                          copiedFlash
                            ? 'border-green-400 text-green-600'
                            : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <ClipboardCopy size={11} />
                        {copiedFlash ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {FLASH_PROMPT}
                    </pre>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Anki Export tab ─────────────────────────────────── */}
          {tab === 'anki' && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Importe um arquivo exportado diretamente do{' '}
                <strong>Anki</strong> (<em>Arquivo → Exportar → Notas em texto simples</em>).
                O primeiro segmento do caminho do baralho vira o nome do deck; o último segmento vira o assunto.
              </p>

              {ankiResult ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">{ankiResult.imported > 0 ? '✅' : '⚠️'}</div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {ankiResult.imported} flashcard(s) importado(s)
                  </p>
                  {ankiResult.skipped > 0 && (
                    <p className="text-sm text-gray-500 mt-1">{ankiResult.skipped} linha(s) ignorada(s)</p>
                  )}
                  {ankiResult.errors.length > 0 && (
                    <ul className="text-xs text-red-500 mt-2 text-left list-disc list-inside space-y-0.5">
                      {ankiResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                  <button
                    onClick={onClose}
                    className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Ver Decks
                  </button>
                </div>
              ) : (
                <>
                  <label className="flex flex-col items-center justify-center gap-2 w-full py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-green-400 transition-colors">
                    <input
                      ref={ankiInputRef}
                      type="file"
                      accept=".html,.txt,.tsv,.apkg"
                      className="hidden"
                      onChange={(e) => setAnkiFile(e.target.files?.[0] ?? null)}
                    />
                    {ankiFile ? (
                      <>
                        <FileText size={26} className="text-green-600" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{ankiFile.name}</span>
                        <span className="text-xs text-gray-400">Clique para trocar</span>
                      </>
                    ) : (
                      <>
                        <Upload size={26} className="text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Clique para selecionar o arquivo</span>
                        <span className="text-xs text-gray-400">.html · .txt · .tsv</span>
                      </>
                    )}
                  </label>

                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-semibold text-gray-600 dark:text-gray-300">Como exportar do Anki:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Abra o Anki → <strong>Arquivo</strong> → <strong>Exportar</strong></li>
                      <li>Formato: <strong>Notas em texto simples (.txt)</strong></li>
                      <li>Marque <strong>Incluir baralho</strong> e <strong>Incluir tipo de nota</strong></li>
                      <li>Exporte e selecione o arquivo aqui</li>
                    </ol>
                    <p className="mt-2">
                      O sistema cria automaticamente um deck com o nome do baralho raiz
                      e organiza os cartões por <strong>assunto</strong> (último nível do caminho).
                    </p>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Questões tab ────────────────────────────────────── */}
          {tab === 'questoes' && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Importa questões de múltipla escolha para o banco de questões.
                Ficam disponíveis no quiz de cada disciplina.
              </p>

              {quizResult ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">{quizResult.imported > 0 ? '✅' : '⚠️'}</div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {quizResult.imported} questão(ões) importada(s)
                  </p>
                  {deck && quizResult.imported > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Adicionadas ao deck <strong>"{deck.name}"</strong> e ao banco de questões.
                    </p>
                  )}
                  {quizResult.skipped > 0 && (
                    <p className="text-sm text-gray-500 mt-1">{quizResult.skipped} linha(s) ignorada(s)</p>
                  )}
                  {quizResult.errors.length > 0 && (
                    <ul className="text-xs text-red-500 mt-2 text-left list-disc list-inside space-y-0.5">
                      {quizResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                      {quizResult.errors.length > 5 && <li>…e mais {quizResult.errors.length - 5} erros.</li>}
                    </ul>
                  )}
                  <button
                    onClick={onClose}
                    className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    {deck ? 'Ver Cartões' : 'Fechar'}
                  </button>
                </div>
              ) : (
                <>
                  {/* File picker */}
                  <label className="flex flex-col items-center justify-center gap-2 w-full py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-green-400 transition-colors">
                    <input
                      ref={quizInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => setQuizFile(e.target.files?.[0] ?? null)}
                    />
                    {quizFile ? (
                      <>
                        <FileText size={26} className="text-green-600" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{quizFile.name}</span>
                        <span className="text-xs text-gray-400">Clique para trocar</span>
                      </>
                    ) : (
                      <>
                        <Upload size={26} className="text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Clique para selecionar o CSV</span>
                      </>
                    )}
                  </label>

                  {/* Column reference */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Colunas do CSV
                    </p>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      {[
                        ['disciplina', 'Nome da matéria (opcional — cria automaticamente)'],
                        ['enunciado', 'Texto da questão (obrigatório)'],
                        ['a, b, c, d', 'Texto de cada alternativa (obrigatório)'],
                        ['e', '5ª alternativa (opcional, ex: CESPE)'],
                        ['gabarito', 'Letra correta: A, B, C, D ou E (obrigatório)'],
                        ['explicacao', 'Explicação da resposta (opcional)'],
                        ['dificuldade', 'Easy / Medium / Hard (opcional)'],
                      ].map(([col, desc]) => (
                        <>
                          <code key={col} className="text-green-600 dark:text-green-400 font-mono">{col}</code>
                          <span key={desc} className="text-gray-500 dark:text-gray-400">{desc}</span>
                        </>
                      ))}
                    </div>
                  </div>

                  {/* Prompt helper */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Prompt para ChatGPT
                      </span>
                      <button
                        onClick={() => copy(QUIZ_PROMPT, setCopiedQuiz)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                          copiedQuiz
                            ? 'border-green-400 text-green-600'
                            : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <ClipboardCopy size={11} />
                        {copiedQuiz ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {QUIZ_PROMPT}
                    </pre>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {((tab === 'flashcards' && !flashResult) || (tab === 'questoes' && !quizResult) || (tab === 'anki' && !ankiResult)) && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={tab === 'flashcards' ? handleFlashImport : tab === 'questoes' ? handleQuizImport : handleAnkiImport}
              disabled={isLoading || (tab === 'flashcards' ? (!flashFile || !deck) : tab === 'questoes' ? !quizFile : !ankiFile)}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><span className="animate-spin">⏳</span> Importando…</>
              ) : (
                <><Upload size={15} /> Importar</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
