/**
 * PomodoroQuiz - Quiz inline durante a sessão Pomodoro
 *
 * Aparece quando o modo é "with_questions", lado a lado com o relógio
 * (mesmo padrão visual do Modo Revisão).
 * Busca questões da IA sobre a matéria atual baseadas nos materiais importados.
 * Se não houver conteúdo indexado para a disciplina, oferece importar um PDF
 * (ex: uma prova) para gerar as questões diretamente a partir dele.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../api/client';
import { useStudyContext } from '../../store/studyContextStore';
import { EliminateButton } from '../EliminateButton';
import './PomodoroQuiz.css';

interface Option {
  id: number;
  text: string;
  is_correct: boolean;
  position: number;
}

interface AttemptHistory {
  attempted_at: string;
  is_correct: boolean;
}

interface Question {
  exercise_id: number;
  question_text: string;
  hint: string | null;
  difficulty: string;
  options: Option[];
  explanation: string | null;
  correct_answer: string | null;
  previous_attempts: AttemptHistory[];
}

interface QuizSession {
  session_id: number;
  subject_id: number | null;
  questions: Question[];
  total_questions: number;
  difficulty_level: string;
  session_mode: string;
}

interface AnswerResult {
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
  hint: string | null;
  flashcard_created: boolean;
  score_so_far: number;
}

interface PomodoroQuizProps {
  subjectId?: number | null;
  subjectName?: string | null;
  pomodoroNumber?: number;
  onClose: () => void;
}

type QuizState = 'loading' | 'error' | 'no_content' | 'question' | 'answered' | 'finished';

const NO_CONTENT_MESSAGES = [
  'no content',
  'sem conteúdo',
  'no material',
  'not found',
  'nenhum material',
  'insufficient',
  'insuficiente',
];

const isNoContentError = (detail: string): boolean =>
  NO_CONTENT_MESSAGES.some((m) => detail.toLowerCase().includes(m));

const PomodoroQuiz: React.FC<PomodoroQuizProps> = ({
  subjectId,
  subjectName,
  pomodoroNumber = 1,
  onClose,
}) => {
  const { addPerformance, addReview } = useStudyContext();
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [state, setState] = useState<QuizState>('loading');
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, { selectedId: number; result: AnswerResult }>>({});
  const [isReviewing, setIsReviewing] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<Set<number>>(new Set());

  // Tenta gerar questões a partir da matéria/tarefa atual sendo estudada.
  // Se não houver conteúdo suficiente, cai no estado "no_content", que oferece
  // importar um PDF (ex: uma prova) para gerar as questões a partir dele.
  const loadQuiz = useCallback(async () => {
    setState('loading');
    setErrorMsg(null);
    setPdfFileName(null);

    if (!subjectId && !subjectName) {
      setState('no_content');
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        num_questions: 5,
        pomodoro_number: pomodoroNumber,
      };
      if (subjectId) payload.subject_id = subjectId;
      if (subjectName) payload.subject_name = subjectName;

      const res = await api.post('/quiz/generate', payload);
      const data = res.data as QuizSession;

      // Backend returned 200 but with no questions → no_content fallback
      if (!data.questions || data.questions.length === 0) {
        setState('no_content');
        return;
      }

      setSession(data);
      setCurrentIdx(0);
      setSelected(null);
      setResult(null);
      setScore(0);
      setTotalAnswered(0);
      setAnswers({});
      setIsReviewing(false);
      setState('question');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '';
      setState('no_content');
      if (!isNoContentError(detail) && detail) setErrorMsg(detail);
    }
  }, [subjectId, subjectName, pomodoroNumber]);

  // Gera questões a partir de um PDF importado (ex: uma prova anterior),
  // usado como alternativa quando não há conteúdo indexado para a matéria.
  const loadQuizFromPdf = useCallback(async (file: File) => {
    setState('loading');
    setErrorMsg(null);
    setPdfFileName(file.name);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('num_questions', '10');
      if (subjectId) form.append('subject_id', String(subjectId));

      const res = await api.post('/quiz/generate-from-pdf', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSession(res.data);
      setCurrentIdx(0);
      setSelected(null);
      setResult(null);
      setScore(0);
      setTotalAnswered(0);
      setAnswers({});
      setIsReviewing(false);
      setState('question');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '';
      setState('error');
      setErrorMsg(detail || 'Erro ao gerar questões a partir do PDF.');
    }
  }, [subjectId]);

  const handlePickPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) loadQuizFromPdf(file);
  };

  useEffect(() => {
    loadQuiz();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentQuestion = session?.questions[currentIdx];

  const handleSelectOption = (optionId: number) => {
    if (state === 'answered') return;
    setSelected(optionId);
  };

  const handleConfirm = async () => {
    if (!session || selected === null || !currentQuestion) return;

    try {
      const selectedOpt = currentQuestion.options.find(o => o.id === selected);
      const userAnswerLetter = selectedOpt
        ? String.fromCharCode(65 + selectedOpt.position)
        : String(selected);

      const res = await api.post('/quiz/answer', {
        session_id: session.session_id,
        exercise_id: currentQuestion.exercise_id,
        user_answer: userAnswerLetter,
        pomodoro_number: pomodoroNumber,
      });

      const answerResult: AnswerResult = res.data;
      setResult(answerResult);
      setState('answered');
      setIsReviewing(false);
      setAnswers(prev => ({ ...prev, [currentIdx]: { selectedId: selected!, result: answerResult } }));

      if (answerResult.is_correct) {
        setScore(s => s + 1);
      }
      setTotalAnswered(t => t + 1);

      const subject = subjectName ?? 'Geral';
      await addPerformance(subject, answerResult.is_correct, 0);

      if (!answerResult.is_correct && subject) {
        await addReview(subject, currentQuestion.question_text.slice(0, 80), 1);
      }
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMsg(detail ?? 'Erro ao registrar resposta. Tente novamente.');
      // Mantém estado 'question' para o usuário poder clicar Confirmar de novo
    }
  };

  const handleBack = () => {
    const prevIdx = currentIdx - 1;
    if (prevIdx < 0) return;
    const prev = answers[prevIdx];
    if (!prev) return;
    setCurrentIdx(prevIdx);
    setSelected(prev.selectedId);
    setResult(prev.result);
    setState('answered');
    setIsReviewing(true);
    setShowHint(false);
    setErrorMsg(null);
  };

  const handleNext = () => {
    if (!session) return;
    setShowHint(false);
    setErrorMsg(null);
    setEliminatedOptions(new Set());

    const nextIdx = currentIdx + 1;
    if (nextIdx >= session.questions.length) {
      setState('finished');
      setIsReviewing(false);
      return;
    }

    const nextAnswer = answers[nextIdx];
    if (nextAnswer) {
      setCurrentIdx(nextIdx);
      setSelected(nextAnswer.selectedId);
      setResult(nextAnswer.result);
      setState('answered');
      setIsReviewing(true);
    } else {
      setCurrentIdx(nextIdx);
      setSelected(null);
      setResult(null);
      setState('question');
      setIsReviewing(false);
    }
  };

  const accuracy = totalAnswered > 0 ? Math.round((score / totalAnswered) * 100) : 0;

  if (state === 'loading') {
    return (
      <div className="pq-panel pq-panel--loading">
        <div className="pq-spinner" />
        <p>{pdfFileName ? 'Gerando questões a partir do PDF...' : 'Gerando questões com IA...'}</p>
        {pdfFileName ? (
          <p className="pq-loading-subject">📎 {pdfFileName}</p>
        ) : (
          subjectName && <p className="pq-loading-subject">📚 {subjectName}</p>
        )}
      </div>
    );
  }

  if (state === 'no_content') {
    return (
      <div className="pq-panel pq-panel--no-content">
        <div className="pq-no-content-icon">📂</div>
        <h3 className="pq-no-content-title">Sem questões disponíveis</h3>
        {subjectName ? (
          <p className="pq-no-content-msg">
            Nenhuma questão encontrada para <strong>{subjectName}</strong>.
            {errorMsg && <span className="pq-no-content-detail"> {errorMsg}</span>}
          </p>
        ) : (
          <p className="pq-no-content-msg">
            Selecione uma disciplina ao iniciar o Pomodoro, ou importe um PDF com uma prova.
          </p>
        )}
        <p className="pq-no-content-hint">
          Importe o PDF de uma prova anterior para gerar questões de múltipla escolha diretamente a partir dela.
        </p>
        <div className="pq-no-content-actions">
          <button className="pq-btn pq-btn--primary" onClick={() => pdfInputRef.current?.click()}>
            📎 Importar PDF
          </button>
          <div className="pq-no-content-secondary">
            <button className="pq-btn pq-btn--secondary" onClick={loadQuiz}>
              ↻ Tentar novamente
            </button>
            <button className="pq-btn pq-btn--ghost" onClick={onClose}>
              Continuar sem questões
            </button>
          </div>
        </div>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={handlePickPdf}
        />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="pq-panel">
        <p className="pq-error">{errorMsg}</p>
        <div className="pq-actions">
          <button className="pq-btn pq-btn--secondary" onClick={loadQuiz}>Tentar novamente</button>
          <button className="pq-btn pq-btn--ghost" onClick={onClose}>Fechar</button>
        </div>
      </div>
    );
  }

  if (state === 'finished') {
    const grade = accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '📚';
    const wrongQuestions = session
      ? session.questions.filter((_, idx) => answers[idx] && !answers[idx].result.is_correct)
      : [];

    const handleReviewErrors = () => {
      if (!session || wrongQuestions.length === 0) return;
      setSession({ ...session, questions: wrongQuestions, total_questions: wrongQuestions.length });
      setCurrentIdx(0);
      setSelected(null);
      setResult(null);
      setScore(0);
      setTotalAnswered(0);
      setAnswers({});
      setIsReviewing(false);
      setState('question');
    };

    return (
      <div className="pq-panel pq-panel--result">
        <div className="pq-result-grade">{grade}</div>
        <h2 className="pq-result-title">Sessão concluída!</h2>
        {subjectName && <div className="pq-result-subject">{subjectName}</div>}
        <div className="pq-result-score">
          <span className="pq-result-number">{score}</span>
          <span className="pq-result-total">/{totalAnswered}</span>
        </div>
        <div className={`pq-result-pct ${accuracy >= 70 ? 'pct--good' : 'pct--bad'}`}>
          {accuracy}% de acerto
        </div>
        {accuracy < 70 && (
          <p className="pq-result-tip">
            💡 Revisões automáticas foram agendadas para os erros.
          </p>
        )}
        <div className="pq-result-actions">
          {wrongQuestions.length > 0 && (
            <button className="pq-btn pq-btn--primary" onClick={handleReviewErrors}>
              🔄 Revisar erros ({wrongQuestions.length})
            </button>
          )}
          <button className="pq-btn pq-btn--secondary" onClick={() => pdfInputRef.current?.click()}>
            📎 Importar PDF
          </button>
          <button className="pq-btn pq-btn--ghost" onClick={onClose}>
            Continuar estudando
          </button>
        </div>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={handlePickPdf}
        />
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="pq-panel">
      {/* Header */}
      <div className="pq-header">
        <div className="pq-progress-wrap">
          <div
            className="pq-progress-bar"
            style={{ width: `${((currentIdx + 1) / (session?.total_questions ?? 5)) * 100}%` }}
          />
        </div>
        <div className="pq-meta">
          <span className="pq-counter">
            {currentIdx + 1} / {session?.total_questions ?? 5}
          </span>
          {totalAnswered > 0 && (
            <span className="pq-score-live">
              <span className="pq-score-correct">✓{score}</span>
              <span className="pq-score-wrong">✗{totalAnswered - score}</span>
            </span>
          )}
          <span className={`pq-diff pq-diff--${currentQuestion.difficulty.toLowerCase()}`}>
            {currentQuestion.difficulty}
          </span>
          <button className="pq-close-btn" onClick={onClose} title="Encerrar quiz">×</button>
        </div>
      </div>

      {/* Subject */}
      {subjectName && (
        <div className="pq-subject">{subjectName}</div>
      )}

      {/* Question */}
      <p className="pq-question">{currentQuestion.question_text}</p>

      {/* Hint */}
      {currentQuestion.hint && state === 'question' && (
        <div className="pq-hint-wrap">
          {showHint ? (
            <div className="pq-hint">💡 {currentQuestion.hint}</div>
          ) : (
            <button className="pq-hint-btn" onClick={() => setShowHint(true)}>
              Ver dica
            </button>
          )}
        </div>
      )}

      {/* Options */}
      <div className="pq-options">
        {currentQuestion.options.map(opt => {
          const optLetter = String.fromCharCode(65 + opt.position);
          const isCorrectOpt = state === 'answered' && result
            ? optLetter === result.correct_answer?.toUpperCase()
            : false;
          const isWrongSelected = state === 'answered' && opt.id === selected && !isCorrectOpt;
          const isEliminated = eliminatedOptions.has(opt.id);

          let cls = 'pq-option';
          if (state === 'answered') {
            if (isCorrectOpt) cls += ' pq-option--correct';
            else if (isWrongSelected) cls += ' pq-option--wrong';
          } else if (opt.id === selected) {
            cls += ' pq-option--selected';
          }
          if (isEliminated && state === 'question') cls += ' pq-option--eliminated';
          return (
            <div key={opt.id} className="pq-option-row">
              {state === 'question' && (
                <EliminateButton
                  eliminated={isEliminated}
                  onToggle={() => setEliminatedOptions(prev => {
                    const next = new Set(prev);
                    if (next.has(opt.id)) next.delete(opt.id); else next.add(opt.id);
                    return next;
                  })}
                />
              )}
              <button
                className={cls}
                onClick={() => handleSelectOption(opt.id)}
                disabled={state === 'answered'}
              >
                <span className="pq-option-letter">{optLetter}</span>
                <span className="pq-option-text">{opt.text}</span>
                {state === 'answered' && isCorrectOpt && (
                  <span className="pq-option-icon">✓</span>
                )}
                {state === 'answered' && isWrongSelected && (
                  <span className="pq-option-icon">✗</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feedback */}
      {state === 'answered' && result && (
        <div className={`pq-feedback ${result.is_correct ? 'pq-feedback--correct' : 'pq-feedback--wrong'}`}>
          <div className="pq-feedback-header">
            {result.is_correct ? '✅ Correto!' : '❌ Incorreto'}
            {result.flashcard_created && (
              <span className="pq-flashcard-badge">🃏 Flashcard criado</span>
            )}
          </div>
          {result.explanation && (
            <p className="pq-feedback-text">{result.explanation}</p>
          )}
        </div>
      )}

      {/* Histórico de tentativas anteriores */}
      {state === 'answered' && currentQuestion.previous_attempts.length > 0 && (
        <div className="pq-history">
          <span className="pq-history-label">Tentativas anteriores:</span>
          {currentQuestion.previous_attempts.map((a, i) => {
            const date = new Date(a.attempted_at);
            const formatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
            return (
              <span key={i} className={`pq-history-item ${a.is_correct ? 'pq-history-item--ok' : 'pq-history-item--err'}`}>
                {a.is_correct ? '✓' : '✗'} {formatted}
              </span>
            );
          })}
        </div>
      )}

      {/* Submit error */}
      {state === 'question' && errorMsg && (
        <p className="pq-error" style={{ marginBottom: 8 }}>{errorMsg}</p>
      )}

      {/* Actions */}
      <div className="pq-actions">
        {/* Anterior — aparece em 'answered' e 'question' quando há questões respondidas atrás */}
        {(state === 'answered' || state === 'question') && currentIdx > 0 && (
          <button className="pq-btn pq-btn--secondary" onClick={handleBack}>
            ← Anterior
          </button>
        )}

        {state === 'question' && (
          <button
            className="pq-btn pq-btn--primary"
            onClick={() => { setErrorMsg(null); handleConfirm(); }}
            disabled={selected === null}
          >
            Confirmar
          </button>
        )}
        {state === 'answered' && (
          <button className="pq-btn pq-btn--primary" onClick={handleNext}>
            {currentIdx + 1 >= (session?.total_questions ?? 5)
              ? (isReviewing ? 'Ver resultado' : 'Ver resultado')
              : (isReviewing ? 'Avançar →' : 'Próxima →')}
          </button>
        )}
      </div>
    </div>
  );
};

export default PomodoroQuiz;
