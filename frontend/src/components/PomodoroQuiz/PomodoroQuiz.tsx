/**
 * PomodoroQuiz - Quiz durante sessão Pomodoro
 *
 * Aparece quando o modo é "with_questions".
 * Busca questões da IA sobre a matéria atual baseadas nos materiais importados.
 * Se não houver conteúdo indexado para a disciplina, exibe mensagem clara.
 */
import React, { useEffect, useState, useCallback } from 'react';
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
  pdfFile?: File | null;
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
  pdfFile = null,
  onClose,
}) => {
  const { addPerformance, addReview } = useStudyContext();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [state, setState] = useState<QuizState>('loading');
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  const loadQuiz = useCallback(async () => {
    setState('loading');
    setErrorMsg(null);

    if (pdfFile) {
      try {
        const form = new FormData();
        form.append('file', pdfFile);
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
      return;
    }

    // Requer matéria selecionada para gerar questões contextualizadas
    if (!subjectId && !subjectName) {
      setState('error');
      setErrorMsg('Nenhuma matéria selecionada. Escolha uma matéria antes de iniciar o Pomodoro com Questões.');
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        num_questions: 5,
        pomodoro_number: pomodoroNumber,
      };

      if (subjectId) {
        payload.subject_id = subjectId;
      }
      if (subjectName) {
        payload.subject_name = subjectName;
      }

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
  }, [pdfFile, subjectId, subjectName, pomodoroNumber]);

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
      const res = await api.post('/quiz/answer', {
        session_id: session.session_id,
        exercise_id: currentQuestion.exercise_id,
        user_answer: String(selected),
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
      <div className="pq-overlay">
        <div className="pq-modal pq-modal--loading">
          <div className="pq-spinner" />
          <p>{pdfFile ? 'Gerando questões a partir do PDF...' : 'Gerando questões com IA...'}</p>
          {pdfFile ? (
            <p className="pq-loading-subject">📎 {pdfFile.name}</p>
          ) : (
            subjectName && <p className="pq-loading-subject">📚 {subjectName}</p>
          )}
        </div>
      </div>
    );
  }

  if (state === 'no_content') {
    return (
      <div className="pq-overlay">
        <div className="pq-modal pq-modal--no-content">
          <div className="pq-no-content-icon">📂</div>
          <h3 className="pq-no-content-title">Conteúdo não encontrado</h3>
          <p className="pq-no-content-msg">
            Não encontrei material indexado para gerar questões de{' '}
            <strong>{subjectName ?? 'esta disciplina'}</strong>.
          </p>
          <p className="pq-no-content-hint">
            Importe PDFs de conteúdo na tela <strong>Estudos</strong> e volte para usar o Pomodoro com Questões.
          </p>
          <div className="pq-actions">
            <button className="pq-btn pq-btn--ghost" onClick={onClose}>
              Continuar sem questões
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="pq-overlay">
        <div className="pq-modal">
          <p className="pq-error">{errorMsg}</p>
          <div className="pq-actions">
            <button className="pq-btn pq-btn--secondary" onClick={loadQuiz}>Tentar novamente</button>
            <button className="pq-btn pq-btn--ghost" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'finished') {
    const grade = accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '📚';
    return (
      <div className="pq-overlay">
        <div className="pq-modal pq-modal--result">
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
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="pq-overlay">
      <div className="pq-modal">
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
            <button className="pq-close-btn" onClick={onClose} title="Fechar quiz">×</button>
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
            let cls = 'pq-option';
            if (state === 'answered') {
              if (opt.is_correct) cls += ' pq-option--correct';
              else if (opt.id === selected && !opt.is_correct) cls += ' pq-option--wrong';
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
                <span className="pq-option-letter">
                  {String.fromCharCode(65 + opt.position)}
                </span>
                <span className="pq-option-text">{opt.text}</span>
                {state === 'answered' && opt.is_correct && (
                  <span className="pq-option-icon">✓</span>
                )}
                {state === 'answered' && opt.id === selected && !opt.is_correct && (
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
    </div>
  );
};

export default PomodoroQuiz;
