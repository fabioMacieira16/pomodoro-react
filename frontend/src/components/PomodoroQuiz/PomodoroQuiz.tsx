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
import './PomodoroQuiz.css';

interface Option {
  id: number;
  text: string;
  is_correct: boolean;
  position: number;
}

interface Question {
  exercise_id: number;
  question_text: string;
  hint: string | null;
  difficulty: string;
  options: Option[];
  explanation: string | null;
  correct_answer: string | null;
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
      setSession(res.data);
      setCurrentIdx(0);
      setState('question');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '';

      if (isNoContentError(detail)) {
        setState('no_content');
      } else {
        setState('error');
        setErrorMsg(detail || 'Erro ao gerar questões. Verifique se há conteúdos cadastrados para esta disciplina.');
      }
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
      console.error('Erro ao submeter resposta:', err);
    }
  };

  const handleNext = () => {
    if (!session) return;
    setSelected(null);
    setResult(null);
    setShowHint(false);

    if (currentIdx + 1 >= session.questions.length) {
      setState('finished');
    } else {
      setCurrentIdx(i => i + 1);
      setState('question');
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
        <h3 className="pq-no-content-title">Nenhuma questão encontrada</h3>
        <p className="pq-no-content-msg">
          Não encontrei material indexado para gerar questões de{' '}
          <strong>{subjectName ?? 'esta disciplina'}</strong>.
        </p>
        <p className="pq-no-content-hint">
          Importe o PDF da matéria (ex: uma prova anterior) para gerar 10 questões de
          múltipla escolha diretamente a partir dele.
        </p>
        <div className="pq-actions pq-actions--center">
          <button className="pq-btn pq-btn--primary" onClick={() => pdfInputRef.current?.click()}>
            📎 Importar PDF
          </button>
          <button className="pq-btn pq-btn--ghost" onClick={onClose}>
            Continuar sem questões
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
        <button className="pq-btn pq-btn--primary" onClick={onClose}>
          Continuar estudando
        </button>
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

          let cls = 'pq-option';
          if (state === 'answered') {
            if (isCorrectOpt) cls += ' pq-option--correct';
            else if (isWrongSelected) cls += ' pq-option--wrong';
          } else if (opt.id === selected) {
            cls += ' pq-option--selected';
          }
          return (
            <button
              key={opt.id}
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
          {!result.is_correct && result.correct_answer && (
            <p className="pq-feedback-correct-label">
              Resposta correta: <strong>{result.correct_answer}</strong>
              {' — '}
              {currentQuestion.options.find(
                o => String.fromCharCode(65 + o.position) === result.correct_answer?.toUpperCase()
              )?.text}
            </p>
          )}
          {result.explanation && (
            <p className="pq-feedback-text">{result.explanation}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="pq-actions">
        {state === 'question' && (
          <button
            className="pq-btn pq-btn--primary"
            onClick={handleConfirm}
            disabled={selected === null}
          >
            Confirmar
          </button>
        )}
        {state === 'answered' && (
          <button className="pq-btn pq-btn--primary" onClick={handleNext}>
            {currentIdx + 1 >= (session?.total_questions ?? 5) ? 'Ver resultado' : 'Próxima →'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PomodoroQuiz;
