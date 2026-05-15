"""Quiz Service — adaptive quiz generation + auto error-card on wrong answers."""
from typing import List, Optional
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.domain.models import (
    Exercise, ExerciseAttempt, ExerciseOption,
    QuizSession, ErrorCard, Flashcard, AnkiDeck, Subject
)
from app.quiz.schemas import (
    QuizSessionOut, QuizQuestionOut, ExerciseOptionOut,
    QuizAnswerRequest, QuizAnswerResult, PomodoroQuizMode,
    QuizGenerateRequest
)


class QuizService:

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    # ── Mode decision ─────────────────────────────────────────────────────

    def decide_pomodoro_mode(self, pomodoro_number: int, subject_id: Optional[int] = None) -> PomodoroQuizMode:
        """P1=study, P2=quiz, P3=revision, P4=study, ..."""
        cycle = pomodoro_number % 3
        if cycle == 1:  # P1, P4, P7...
            return PomodoroQuizMode(
                pomodoro_number=pomodoro_number,
                recommended_mode="study",
                reason="Primeiro pomodoro do ciclo: foco puro no conteúdo.",
                show_quiz=False,
            )
        if cycle == 2:  # P2, P5, P8...
            return PomodoroQuizMode(
                pomodoro_number=pomodoro_number,
                recommended_mode="quiz",
                reason="Segundo pomodoro: hora de testar o que aprendeu!",
                show_quiz=True,
                quiz_subject_id=subject_id,
            )
        # cycle == 0 → P3, P6...
        return PomodoroQuizMode(
            pomodoro_number=pomodoro_number,
            recommended_mode="revision",
            reason="Terceiro pomodoro: revisão dos cartões pendentes.",
            show_quiz=False,
        )

    # ── Generate quiz ────────────────────────────────────────────────────

    def generate_quiz(self, req: QuizGenerateRequest, pomodoro_session_id: Optional[int] = None) -> QuizSessionOut:
        difficulty = req.difficulty or self._auto_difficulty(req.subject_id)

        exercises = (
            self.db.query(Exercise)
            .filter_by(subject_id=req.subject_id)
            .filter(Exercise.difficulty == difficulty)
            .order_by(func.random())
            .limit(req.num_questions)
            .all()
        )

        # Fallback: any difficulty
        if len(exercises) < req.num_questions:
            exercises = (
                self.db.query(Exercise)
                .filter_by(subject_id=req.subject_id)
                .order_by(func.random())
                .limit(req.num_questions)
                .all()
            )

        session = QuizSession(
            user_id=self.user_id,
            pomodoro_session_id=pomodoro_session_id,
            subject_id=req.subject_id,
            total_questions=len(exercises),
            difficulty_level=difficulty,
            session_mode="quiz",
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        questions = [self._to_question_out(e, hide_answer=True) for e in exercises]
        return QuizSessionOut(
            session_id=session.id,
            subject_id=req.subject_id,
            questions=questions,
            total_questions=len(exercises),
            difficulty_level=difficulty,
            session_mode="quiz",
        )

    # ── Submit answer ────────────────────────────────────────────────────

    def submit_answer(self, req: QuizAnswerRequest) -> QuizAnswerResult:
        exercise = self.db.query(Exercise).filter_by(id=req.exercise_id).first()
        if not exercise:
            raise ValueError("Exercise not found")

        is_correct = req.user_answer.strip().lower() == exercise.correct_answer.strip().lower()

        attempt = ExerciseAttempt(
            user_id=self.user_id,
            exercise_id=req.exercise_id,
            quiz_session_id=req.session_id,
            user_answer=req.user_answer,
            is_correct=is_correct,
        )
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)

        flashcard_id: Optional[int] = None
        if not is_correct:
            flashcard_id = self._create_error_card(attempt, exercise)

        # Update quiz session score
        self._update_session_score(req.session_id)
        score = self._get_session_score(req.session_id)

        return QuizAnswerResult(
            is_correct=is_correct,
            correct_answer=exercise.correct_answer,
            explanation=exercise.explanation,
            hint=exercise.hint,
            flashcard_created=not is_correct,
            flashcard_id=flashcard_id,
            score_so_far=score,
        )

    # ── Error card auto-generation ───────────────────────────────────────────

    def _create_error_card(self, attempt: ExerciseAttempt, exercise: Exercise) -> Optional[int]:
        """Auto-generate a flashcard when user answers incorrectly."""
        # Find or create deck for the subject
        subject = self.db.query(Subject).filter_by(id=exercise.subject_id).first()
        deck_name = f"Erros — {subject.name}" if subject else "Erros Gerais"

        deck = (
            self.db.query(AnkiDeck)
            .filter_by(user_id=self.user_id, name=deck_name)
            .first()
        )
        if not deck:
            deck = AnkiDeck(
                user_id=self.user_id,
                name=deck_name,
                description=f"Cartões gerados automaticamente de erros em {deck_name}",
                color="#ef4444",
                subject_id=exercise.subject_id,
            )
            self.db.add(deck)
            self.db.commit()
            self.db.refresh(deck)

        # Calculate next review: same weekday next week
        next_review = datetime.utcnow() + timedelta(days=7)

        flashcard = Flashcard(
            deck_id=deck.id,
            card_type="qa",
            front=exercise.question_text,
            back=exercise.correct_answer,
            hint=exercise.hint,
            difficulty=exercise.difficulty,
            from_error=True,
            next_review=next_review,
        )
        self.db.add(flashcard)
        self.db.commit()
        self.db.refresh(flashcard)

        error_card = ErrorCard(
            user_id=self.user_id,
            attempt_id=attempt.id,
            flashcard_id=flashcard.id,
            subject_id=exercise.subject_id,
            subdeck=subject.name if subject else None,
            origin_text=exercise.question_text[:500],
        )
        self.db.add(error_card)
        self.db.commit()

        return flashcard.id

    # ── Adaptive difficulty ──────────────────────────────────────────────

    def _auto_difficulty(self, subject_id: int) -> str:
        """Pick difficulty based on historical error rate for this subject."""
        total = (
            self.db.query(ExerciseAttempt)
            .join(Exercise)
            .filter(
                ExerciseAttempt.user_id == self.user_id,
                Exercise.subject_id == subject_id,
            )
            .count()
        )
        if total < 5:
            return "Easy"  # not enough data → start easy

        wrong = (
            self.db.query(ExerciseAttempt)
            .join(Exercise)
            .filter(
                ExerciseAttempt.user_id == self.user_id,
                ExerciseAttempt.is_correct == False,
                Exercise.subject_id == subject_id,
            )
            .count()
        )
        error_rate = wrong / total
        if error_rate > 0.5:
            return "Easy"
        if error_rate > 0.25:
            return "Medium"
        return "Hard"

    def _update_session_score(self, session_id: int) -> None:
        session = self.db.query(QuizSession).filter_by(id=session_id).first()
        if not session:
            return
        total = (
            self.db.query(ExerciseAttempt)
            .filter_by(quiz_session_id=session_id)
            .count()
        )
        correct = (
            self.db.query(ExerciseAttempt)
            .filter_by(quiz_session_id=session_id, is_correct=True)
            .count()
        )
        session.correct_answers = correct
        session.score_pct = round(correct / total * 100, 1) if total else 0.0
        self.db.commit()

    def _get_session_score(self, session_id: int) -> float:
        session = self.db.query(QuizSession).filter_by(id=session_id).first()
        return session.score_pct if session else 0.0

    def _to_question_out(self, exercise: Exercise, hide_answer: bool = True) -> QuizQuestionOut:
        opts = [
            ExerciseOptionOut(
                id=o.id,
                text=o.text,
                is_correct=False if hide_answer else o.is_correct,
                position=o.position,
            )
            for o in sorted(exercise.options, key=lambda x: x.position)
        ]
        return QuizQuestionOut(
            exercise_id=exercise.id,
            question_text=exercise.question_text,
            hint=exercise.hint,
            difficulty=exercise.difficulty,
            options=opts,
            explanation=None if hide_answer else exercise.explanation,
            correct_answer=None if hide_answer else exercise.correct_answer,
        )
