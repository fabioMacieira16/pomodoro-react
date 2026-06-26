"""Quiz Service — adaptive quiz generation + auto error-card on wrong answers."""
import asyncio
import json
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
from app.ai.factory import get_provider
from app.core.study_context import StudyContextService

MAX_PDF_CONTENT_CHARS = 20000


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
        subject_id = req.subject_id

        # Resolve subject by name when no ID provided
        if not subject_id and req.subject_name:
            subject = (
                self.db.query(Subject)
                .filter(func.lower(Subject.name) == req.subject_name.strip().lower())
                .first()
            )
            if not subject:
                subject = Subject(name=req.subject_name.strip())
                self.db.add(subject)
                self.db.commit()
                self.db.refresh(subject)
            subject_id = subject.id

        difficulty = req.difficulty or (self._auto_difficulty(subject_id) if subject_id else "Medium")

        exercises: List[Exercise] = []
        if subject_id:
            exercises = (
                self.db.query(Exercise)
                .filter_by(subject_id=subject_id)
                .filter(Exercise.difficulty == difficulty)
                .order_by(func.random())
                .limit(req.num_questions)
                .all()
            )

            # Fallback: any difficulty for this subject
            if len(exercises) < req.num_questions:
                exercises = (
                    self.db.query(Exercise)
                    .filter_by(subject_id=subject_id)
                    .order_by(func.random())
                    .limit(req.num_questions)
                    .all()
                )

        # AI fallback: generate questions when DB is empty
        ai_generated = False
        if len(exercises) == 0:
            exercises = self._generate_ai_exercises(subject_id, req.num_questions, difficulty, req.subject_name)
            ai_generated = True

        session = QuizSession(
            user_id=self.user_id,
            pomodoro_session_id=pomodoro_session_id,
            subject_id=req.subject_id,
            total_questions=len(exercises),
            difficulty_level=difficulty,
            session_mode="quiz_ai" if ai_generated else "quiz",
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
            session_mode=session.session_mode,
        )

    # ── AI question generation ───────────────────────────────────────────

    def _generate_ai_exercises(self, subject_id: Optional[int], num_questions: int, difficulty: str, subject_name: Optional[str] = None) -> List[Exercise]:
        """Generate questions via AI when no exercises exist in the DB."""
        if subject_id:
            subject = self.db.query(Subject).filter_by(id=subject_id).first()
            subject_name = subject.name if subject else (subject_name or "Conhecimentos Gerais")
        else:
            subject_name = subject_name or "Conhecimentos Gerais"

        # Enrich with study context
        ctx = StudyContextService.get_context()
        context_hint = ""
        if ctx.concurso:
            context_hint = f"para o concurso {ctx.concurso}"
            if ctx.banca:
                context_hint += f" (banca {ctx.banca})"

        provider = get_provider()
        if not provider.is_available():
            return []

        prompt = f"""
Gere {num_questions} questões de múltipla escolha sobre {subject_name} {context_hint}.
Dificuldade: {difficulty}.

Retorne SOMENTE JSON válido no formato:
[
  {{
    "question_text": "Texto da questão?",
    "hint": "Dica opcional",
    "explanation": "Explicação detalhada",
    "difficulty": "{difficulty}",
    "correct_answer": "B",
    "options": [
      {{"position": 0, "text": "Opção A"}},
      {{"position": 1, "text": "Opção B (correta)"}},
      {{"position": 2, "text": "Opção C"}},
      {{"position": 3, "text": "Opção D"}}
    ]
  }}
]

Regras:
- Exatamente 4 opções por questão (A, B, C, D)
- correct_answer deve ser a letra (A, B, C ou D)
- Questões objetivas, claras e relevantes para concursos públicos
- Não use markdown, apenas JSON puro
"""
        try:
            raw = asyncio.run(provider.complete_json(prompt))
            if not isinstance(raw, list):
                return []
            return [self._ai_question_to_exercise(q, subject_id) for q in raw[:num_questions]]
        except Exception as e:
            print(f"[QuizService] AI generation error: {e}")
            return []

    def _ai_question_to_exercise(self, data: dict, subject_id: Optional[int]) -> Exercise:
        """Persist AI-generated question and return Exercise."""
        letter_to_pos = {"A": 0, "B": 1, "C": 2, "D": 3}
        correct_letter = str(data.get("correct_answer", "A")).upper().strip()
        correct_pos = letter_to_pos.get(correct_letter, 0)

        exercise = Exercise(
            subject_id=subject_id,
            question_text=data.get("question_text", ""),
            hint=data.get("hint"),
            explanation=data.get("explanation"),
            difficulty=data.get("difficulty", "Medium"),
            correct_answer=correct_letter,
        )
        self.db.add(exercise)
        self.db.flush()  # get ID without commit

        for opt in data.get("options", []):
            pos = opt.get("position", 0)
            option = ExerciseOption(
                exercise_id=exercise.id,
                text=opt.get("text", ""),
                is_correct=(pos == correct_pos),
                position=pos,
            )
            self.db.add(option)

        self.db.commit()
        self.db.refresh(exercise)
        return exercise

    # ── Generate quiz from an uploaded PDF (e.g. a past exam) ────────────

    async def generate_quiz_from_pdf(
        self,
        content_text: str,
        num_questions: int,
        subject_id: Optional[int] = None,
        pomodoro_session_id: Optional[int] = None,
    ) -> QuizSessionOut:
        exercises = await self._generate_ai_exercises_from_text(content_text, num_questions, subject_id)
        if not exercises:
            raise ValueError(
                "Não foi possível gerar questões a partir do PDF. Configure um provedor de IA em Configurações."
            )

        session = QuizSession(
            user_id=self.user_id,
            pomodoro_session_id=pomodoro_session_id,
            subject_id=subject_id,
            total_questions=len(exercises),
            difficulty_level="Medium",
            session_mode="quiz_pdf",
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        questions = [self._to_question_out(e, hide_answer=True) for e in exercises]
        return QuizSessionOut(
            session_id=session.id,
            subject_id=subject_id,
            questions=questions,
            total_questions=len(exercises),
            difficulty_level="Medium",
            session_mode=session.session_mode,
        )

    async def _generate_ai_exercises_from_text(
        self, content_text: str, num_questions: int, subject_id: Optional[int]
    ) -> List[Exercise]:
        """Generate multiple-choice questions from PDF content (e.g. a past exam)."""
        provider = get_provider()
        if not provider.is_available():
            return []

        prompt = f"""Você é um especialista em criar questões de concursos públicos.
Com base no conteúdo abaixo (pode ser uma prova, apostila ou material de estudo), gere {num_questions} questões de múltipla escolha.
Sempre que o conteúdo já contiver questões, replique-as fielmente (questões de fixação baseadas no material original).
Quando não houver questões suficientes no texto, crie novas questões objetivas sobre os temas abordados no conteúdo.

Conteúdo:
---
{content_text[:MAX_PDF_CONTENT_CHARS]}
---

Retorne SOMENTE JSON válido no formato:
[
  {{
    "question_text": "Texto da questão?",
    "hint": "Dica opcional",
    "explanation": "Explicação detalhada",
    "difficulty": "Medium",
    "correct_answer": "B",
    "options": [
      {{"position": 0, "text": "Opção A"}},
      {{"position": 1, "text": "Opção B (correta)"}},
      {{"position": 2, "text": "Opção C"}},
      {{"position": 3, "text": "Opção D"}}
    ]
  }}
]

Regras:
- Exatamente 4 opções por questão (A, B, C, D)
- correct_answer deve ser a letra (A, B, C ou D)
- Questões objetivas, claras e fiéis ao conteúdo fornecido
- Não use markdown, apenas JSON puro
"""
        try:
            raw = await provider.complete_json(prompt)
            if not isinstance(raw, list):
                return []
            return [self._ai_question_to_exercise(q, subject_id) for q in raw[:num_questions]]
        except Exception as e:
            print(f"[QuizService] AI PDF generation error: {e}")
            return []

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

        subject = self.db.query(Subject).filter_by(id=exercise.subject_id).first()
        if subject:
            StudyContextService.add_performance(subject=subject.name, correct=is_correct)

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
