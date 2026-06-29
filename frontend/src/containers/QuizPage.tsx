import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuizStore } from '../store/quizStore';
import { usePomodoroStore } from '../store/pomodoroStore';
import { EliminateButton } from '../components/EliminateButton';
import './QuizPage.css';

const QuizPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentSession, currentQuestion, answers, isLoading, error, newFlashcardCount,
    generateQuiz, submitAnswer, nextQuestion, resetQuiz, clearFlashcardNotification,
  } = useQuizStore();
  const { currentSubjectId } = usePomodoroStore();

  const [selectedOption, setSelectedOption] = useState<string>('');
  const [result, setResult] = useState<import('../store/quizStore').QuizAnswerResult | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<Set<number>>(new Set());

  // Auto-start quiz for current subject
  useEffect(() => {
    if (!currentSession && currentSubjectId) {
      generateQuiz(currentSubjectId, 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const question = currentSession?.questions[currentQuestion];
  const isFinished = currentSession && currentQuestion >= currentSession.questions.length;
  const correctCount = Object.values(answers).filter(r => r.is_correct).length;

  const handleSubmit = async () => {
    if (!question || !selectedOption) return;
    const r = await submitAnswer(question.exercise_id, selectedOption);
    setResult(r);
    setSubmitted(true);
  };

  const handleNext = () => {
    setSelectedOption('');
    setResult(null);
    setSubmitted(false);
    setEliminatedOptions(new Set());
    nextQuestion();
  };

  const handleStartNew = () => {
    resetQuiz();
    clearFlashcardNotification();
    if (currentSubjectId) generateQuiz(currentSubjectId, 1);
    else navigate('/');
  };

  if (isLoading) {
    return (
      <div className="quiz-page">
        <div className="quiz-loading">🧠 Gerando quiz adaptativo…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-page">
        <div className="quiz-error">
          <p>{error}</p>
          <button onClick={() => navigate('/')}>← Voltar</button>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="quiz-page">
        <div className="quiz-empty">
          <div className="quiz-empty-icon">📝</div>
          <h2>Quiz Inteligente</h2>
          <p>Selecione uma matéria no Pomodoro antes de iniciar o quiz.</p>
          <button className="quiz-start-btn" onClick={() => navigate('/')}>← Voltar ao Pomodoro</button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    const pct = Math.round(correctCount / currentSession.total_questions * 100);
    return (
      <div className="quiz-page">
        <div className="quiz-result">
          <div className="result-score">{pct}%</div>
          <h2>Quiz Concluído!</h2>
          <p>{correctCount} de {currentSession.total_questions} corretas</p>
          {newFlashcardCount > 0 && (
            <div className="flashcard-notification">
              🧠 {newFlashcardCount} flashcard{newFlashcardCount > 1 ? 's' : ''} criado{newFlashcardCount > 1 ? 's' : ''} automaticamente!
            </div>
          )}
          <div className="result-actions">
            <button className="quiz-btn secondary" onClick={() => navigate('/anki')}>Ver Flashcards →</button>
            <button className="quiz-btn primary" onClick={handleStartNew}>Novo Quiz</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <header className="quiz-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Voltar</button>
        <div className="quiz-progress-text">
          Questão {currentQuestion + 1} / {currentSession.total_questions}
        </div>
        <div className="quiz-difficulty">Dificuldade: {currentSession.difficulty_level}</div>
      </header>

      <div className="quiz-progress-bar">
        <div
          className="quiz-progress-fill"
          style={{ width: `${((currentQuestion) / currentSession.total_questions) * 100}%` }}
        />
      </div>

      {question && (
        <div className="quiz-card">
          <div className="question-text">{question.question_text}</div>

          {question.hint && !submitted && (
            <details className="hint-block">
              <summary>💡 Ver dica</summary>
              <p>{question.hint}</p>
            </details>
          )}

          <div className="options-list">
            {question.options.map((opt) => {
              const isEliminated = eliminatedOptions.has(opt.id);
              let cls = 'option-btn';
              if (submitted && result) {
                if (opt.text === result.correct_answer) cls += ' correct';
                else if (opt.text === selectedOption && !result.is_correct) cls += ' incorrect';
              } else if (opt.text === selectedOption) {
                cls += ' selected';
              }
              if (isEliminated && !submitted) cls += ' eliminated';
              return (
                <div key={opt.id} className="option-row">
                  {!submitted && (
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
                    onClick={() => !submitted && setSelectedOption(opt.text)}
                    disabled={submitted}
                  >
                    {opt.text}
                  </button>
                </div>
              );
            })}
          </div>

          {submitted && result && (
            <div className={`result-feedback ${result.is_correct ? 'correct' : 'incorrect'}`}>
              {result.is_correct ? '✅ Correto!' : '❌ Incorreto'}
              {result.explanation && <p className="explanation">{result.explanation}</p>}
              {result.flashcard_created && (
                <div className="auto-flashcard">🃏 Flashcard criado automaticamente para revisão!</div>
              )}
            </div>
          )}

          <div className="quiz-card-actions">
            {!submitted ? (
              <button
                className="quiz-btn primary"
                onClick={handleSubmit}
                disabled={!selectedOption}
              >Confirmar</button>
            ) : (
              <button className="quiz-btn primary" onClick={handleNext}>
                {currentQuestion + 1 >= currentSession.total_questions ? 'Ver Resultado' : 'Próxima →'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizPage;
