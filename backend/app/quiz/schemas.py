from typing import List, Optional
from pydantic import BaseModel


class ExerciseOptionOut(BaseModel):
    id: int
    text: str
    is_correct: bool = False  # only sent after answer
    position: int

    class Config:
        from_attributes = True


class QuizQuestionOut(BaseModel):
    exercise_id: int
    question_text: str
    hint: Optional[str]
    difficulty: str
    options: List[ExerciseOptionOut]
    explanation: Optional[str] = None  # only after answer
    correct_answer: Optional[str] = None  # only after answer

    class Config:
        from_attributes = True


class QuizSessionOut(BaseModel):
    session_id: int
    subject_id: Optional[int]
    questions: List[QuizQuestionOut]
    total_questions: int
    difficulty_level: str
    session_mode: str

    class Config:
        from_attributes = True


class QuizAnswerRequest(BaseModel):
    session_id: int
    exercise_id: int
    user_answer: str
    pomodoro_number: int = 1  # which pomodoro this belongs to


class QuizAnswerResult(BaseModel):
    is_correct: bool
    correct_answer: str
    explanation: Optional[str]
    hint: Optional[str]
    flashcard_created: bool = False  # True when error-card auto-generated
    flashcard_id: Optional[int] = None
    score_so_far: float


class PomodoroQuizMode(BaseModel):
    """Decides what the current Pomodoro should do."""
    pomodoro_number: int
    recommended_mode: str   # study / quiz / revision
    reason: str
    show_quiz: bool
    quiz_subject_id: Optional[int] = None


class QuizGenerateRequest(BaseModel):
    subject_id: int
    num_questions: int = 5
    difficulty: Optional[str] = None   # auto-detect if None
    pomodoro_number: int = 1
