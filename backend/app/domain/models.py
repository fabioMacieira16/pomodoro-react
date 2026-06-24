from sqlalchemy import Boolean, Column, Integer, String, ForeignKey, DateTime, Float, Enum, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.data.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tasks = relationship("Task", back_populates="user")
    pomodoro_sessions = relationship("PomodoroSession", back_populates="user")
    anki_decks = relationship("AnkiDeck", back_populates="user")
    exercise_attempts = relationship("ExerciseAttempt", back_populates="user")
    exams = relationship("Exam", back_populates="user")
    study_plan_configs = relationship("StudyPlanConfig", back_populates="user")
    quiz_sessions = relationship("QuizSession", back_populates="user")

class StudyType(Base):
    __tablename__ = "study_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    categories = relationship("Category", back_populates="study_type")

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    study_type_id = Column(Integer, ForeignKey("study_types.id"))
    study_type = relationship("StudyType", back_populates="categories")
    subjects = relationship("Subject", back_populates="category")

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    priority = Column(Integer, default=1)
    weight = Column(Float, default=1.0)
    difficulty = Column(String, default="Medium")
    exam_board = Column(String, nullable=True)
    color = Column(String, default="#3182ce")
    weekly_goal_minutes = Column(Integer, default=0)
    total_studied_minutes = Column(Integer, default=0)
    category_id = Column(Integer, ForeignKey("categories.id"))

    category = relationship("Category", back_populates="subjects")
    tasks = relationship("Task", back_populates="subject")
    schedules = relationship("Schedule", back_populates="subject")
    pomodoro_sessions = relationship("PomodoroSession", back_populates="subject")
    anki_decks = relationship("AnkiDeck", back_populates="subject")
    exercises = relationship("Exercise", back_populates="subject")
    document_indexes = relationship("DocumentIndex", back_populates="subject")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    priority = Column(String, default="Medium")
    due_date = Column(DateTime(timezone=True), nullable=True)
    completed = Column(Boolean, default=False)
    estimated_minutes = Column(Integer, default=25)
    actual_minutes = Column(Integer, default=0)
    position = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    user = relationship("User", back_populates="tasks")
    subject = relationship("Subject", back_populates="tasks")

class PomodoroSession(Base):
    __tablename__ = "pomodoro_sessions"
    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer)
    session_type = Column(String)  # Pomodoro, Short Break, Long Break
    completed = Column(Boolean, default=False)
    interruptions = Column(Integer, default=0)
    productivity_rating = Column(Integer, nullable=True)
    # New: track study content + early stop
    topic_id = Column(Integer, ForeignKey("exam_topics.id"), nullable=True)
    early_stopped = Column(Boolean, default=False)
    focus_score = Column(Float, nullable=True)  # 0-100
    user_id = Column(Integer, ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    user = relationship("User", back_populates="pomodoro_sessions")
    subject = relationship("Subject", back_populates="pomodoro_sessions")
    topic = relationship("ExamTopic", foreign_keys=[topic_id])
    quiz_sessions = relationship("QuizSession", back_populates="pomodoro_session")

class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(Integer)
    time_of_day = Column(String)
    duration_minutes = Column(Integer, default=60)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    subject = relationship("Subject", back_populates="schedules")

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    work_duration_minutes = Column(Integer, default=25)
    short_break_minutes = Column(Integer, default=5)
    long_break_minutes = Column(Integer, default=15)
    long_break_interval = Column(Integer, default=4)
    auto_start_breaks = Column(Boolean, default=False)
    auto_start_pomodoros = Column(Boolean, default=False)
    dark_mode = Column(Boolean, default=False)
    focus_mode = Column(Boolean, default=True)
    theme_color = Column(String, default="blue")
    language = Column(String, default="pt")
    weekly_goal_minutes = Column(Integer, default=600)
    ai_provider_preference = Column(String, default="")
    ai_api_key_encrypted = Column(String, default="")
    ollama_base_url = Column(String, default="")
    ollama_model = Column(String, default="")
    sound_enabled = Column(Boolean, default=True)
    notifications_enabled = Column(Boolean, default=True)
    desktop_notifications = Column(Boolean, default=False)

class StudyMetric(Base):
    __tablename__ = "study_metrics"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime(timezone=True), server_default=func.now())
    total_minutes = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)

# ── Anki System ───────────────────────────────────────────────────────────────

class CardType(str, enum.Enum):
    qa = "qa"
    multiple_choice = "multiple_choice"
    cloze = "cloze"
    true_false = "true_false"

class AnkiDeck(Base):
    __tablename__ = "anki_decks"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    color = Column(String, default="#3b82f6")
    user_id = Column(Integer, ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    parent_deck_id = Column(Integer, ForeignKey("anki_decks.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", back_populates="anki_decks")
    subject = relationship("Subject", back_populates="anki_decks")
    flashcards = relationship("Flashcard", back_populates="deck", cascade="all, delete-orphan")
    subdecks = relationship(
        "AnkiDeck",
        backref=__import__('sqlalchemy.orm', fromlist=['backref']).backref("parent", remote_side="AnkiDeck.id"),
    )

class Flashcard(Base):
    __tablename__ = "flashcards"
    id = Column(Integer, primary_key=True, index=True)
    deck_id = Column(Integer, ForeignKey("anki_decks.id"))
    card_type = Column(String, default="qa")
    front = Column(Text)
    back = Column(Text)
    hint = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    difficulty = Column(String, default="Medium")
    repetitions = Column(Integer, default=0)
    easiness_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=0)
    lapses = Column(Integer, default=0)
    last_reviewed = Column(DateTime(timezone=True), nullable=True)
    next_review = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Auto-generated from error?
    from_error = Column(Boolean, default=False)
    deck = relationship("AnkiDeck", back_populates="flashcards")
    options = relationship("FlashcardOption", back_populates="flashcard", cascade="all, delete-orphan")
    reviews = relationship("FlashcardReview", back_populates="flashcard", cascade="all, delete-orphan")
    error_card = relationship("ErrorCard", back_populates="flashcard", uselist=False)

class FlashcardOption(Base):
    __tablename__ = "flashcard_options"
    id = Column(Integer, primary_key=True, index=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"))
    text = Column(Text)
    is_correct = Column(Boolean, default=False)
    position = Column(Integer, default=0)
    flashcard = relationship("Flashcard", back_populates="options")

class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"
    id = Column(Integer, primary_key=True, index=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    quality = Column(Integer)
    response_time_ms = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())
    flashcard = relationship("Flashcard", back_populates="reviews")
    user = relationship("User")

# ── Exercises ─────────────────────────────────────────────────────────────────

class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    question_text = Column(Text)
    correct_answer = Column(Text)
    explanation = Column(Text, nullable=True)
    hint = Column(Text, nullable=True)
    difficulty = Column(String, default="Medium")
    difficulty_score = Column(Float, default=0.5)  # 0-1 for adaptive system
    exam_board = Column(String, nullable=True)
    subject = relationship("Subject", back_populates="exercises")
    attempts = relationship("ExerciseAttempt", back_populates="exercise")
    options = relationship("ExerciseOption", back_populates="exercise", cascade="all, delete-orphan")

class ExerciseOption(Base):
    """Multiple-choice options for exercises."""
    __tablename__ = "exercise_options"
    id = Column(Integer, primary_key=True, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"))
    text = Column(Text)
    is_correct = Column(Boolean, default=False)
    position = Column(Integer, default=0)
    exercise = relationship("Exercise", back_populates="options")

class ExerciseAttempt(Base):
    __tablename__ = "exercise_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    exercise_id = Column(Integer, ForeignKey("exercises.id"))
    quiz_session_id = Column(Integer, ForeignKey("quiz_sessions.id"), nullable=True)
    user_answer = Column(Text)
    is_correct = Column(Boolean)
    attempted_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", back_populates="exercise_attempts")
    exercise = relationship("Exercise", back_populates="attempts")
    quiz_session = relationship("QuizSession", back_populates="attempts", foreign_keys=[quiz_session_id])
    error_card = relationship("ErrorCard", back_populates="attempt", uselist=False)

class AiHistory(Base):
    __tablename__ = "ai_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ── Smart Scheduler ──────────────────────────────────────────────────────────

class Exam(Base):
    __tablename__ = "exams"
    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    name           = Column(String, nullable=False)
    exam_date      = Column(DateTime(timezone=True), nullable=False)
    daily_hours    = Column(Float, nullable=False)
    available_days = Column(String, nullable=False, default="[0,1,2,3,4]")
    # Extended for concurso context
    cargo          = Column(String, nullable=True)       # cargo pretendido
    banca          = Column(String, nullable=True)       # ex: CESPE, FCC, FGV
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    user       = relationship("User",          back_populates="exams")
    topics     = relationship("ExamTopic",     back_populates="exam",  cascade="all, delete-orphan")
    plan_items = relationship("StudyPlanItem", back_populates="exam",  cascade="all, delete-orphan")
    study_plan_configs = relationship(
        "StudyPlanConfig",
        back_populates="exam",
        foreign_keys="StudyPlanConfig.exam_id",
    )

class ExamTopic(Base):
    __tablename__ = "exam_topics"
    id              = Column(Integer, primary_key=True, index=True)
    exam_id         = Column(Integer, ForeignKey("exams.id"),    nullable=False)
    subject_id      = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    name            = Column(String,  nullable=False)
    estimated_hours = Column(Float,   nullable=False, default=1.0)
    priority        = Column(Integer, nullable=False, default=2)
    # Extended for intelligent planner
    peso            = Column(Float, default=1.0)          # peso na prova (0-10)
    incidencia      = Column(Float, default=0.5)          # incidência da banca (0-1)
    personal_difficulty = Column(String, default="Medium") # Easy/Medium/Hard

    exam       = relationship("Exam",       back_populates="topics")
    subject    = relationship("Subject")
    plan_items = relationship("StudyPlanItem", back_populates="topic", cascade="all, delete-orphan")

class StudyPlanItem(Base):
    __tablename__ = "study_plan_items"
    id               = Column(Integer,  primary_key=True, index=True)
    exam_id          = Column(Integer,  ForeignKey("exams.id"),       nullable=False)
    exam_topic_id    = Column(Integer,  ForeignKey("exam_topics.id"), nullable=False)
    scheduled_date   = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer,  nullable=False)
    session_type     = Column(String,   nullable=False)
    review_interval  = Column(Integer,  nullable=True)
    completed        = Column(Boolean,  nullable=False, default=False)
    exam  = relationship("Exam",      back_populates="plan_items")
    topic = relationship("ExamTopic", back_populates="plan_items")

# ── Study Planner (AI Wizard) ─────────────────────────────────────────────────

class StudyPlanConfig(Base):
    """Stores the wizard answers and generated plan metadata."""
    __tablename__ = "study_plan_configs"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    exam_id     = Column(Integer, ForeignKey("exams.id"), nullable=True)
    exam_id_2   = Column(Integer, ForeignKey("exams.id"), nullable=True)  # multi-edital
    is_multi_edital = Column(Boolean, default=False)
    compatibility_pct = Column(Float, nullable=True)  # % compatibilidade multi-edital
    # Wizard answers stored as JSON
    wizard_answers  = Column(JSON, default=dict)
    # Generated plan metadata
    generated_plan  = Column(JSON, nullable=True)
    shared_topics   = Column(JSON, nullable=True)   # multi-edital: tópicos em comum
    exclusive_topics = Column(JSON, nullable=True)  # multi-edital: exclusivos
    status      = Column(String, default="draft")   # draft / active / archived
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="study_plan_configs")
    exam = relationship("Exam", foreign_keys=[exam_id], back_populates="study_plan_configs")

# ── Quiz System ──────────────────────────────────────────────────────────────

class QuizSession(Base):
    """A quiz run during or after a Pomodoro session."""
    __tablename__ = "quiz_sessions"
    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=False)
    pomodoro_session_id = Column(Integer, ForeignKey("pomodoro_sessions.id"), nullable=True)
    subject_id        = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    total_questions   = Column(Integer, default=5)
    correct_answers   = Column(Integer, default=0)
    score_pct         = Column(Float, default=0.0)
    difficulty_level  = Column(String, default="Medium")  # Easy/Medium/Hard
    session_mode      = Column(String, default="quiz")    # quiz / revision / mixed
    completed         = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    user             = relationship("User", back_populates="quiz_sessions")
    pomodoro_session = relationship("PomodoroSession", back_populates="quiz_sessions")
    attempts         = relationship("ExerciseAttempt", back_populates="quiz_session",
                                    primaryjoin="QuizSession.id == ExerciseAttempt.quiz_session_id")

# ── Error Cards (auto-generated from wrong answers) ─────────────────────────

class ErrorCard(Base):
    """Auto-generated flashcard link when user answers incorrectly."""
    __tablename__ = "error_cards"
    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    attempt_id   = Column(Integer, ForeignKey("exercise_attempts.id"), nullable=False, unique=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"), nullable=False, unique=True)
    subject_id   = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    subdeck      = Column(String, nullable=True)   # subdeck name within the subject deck
    origin_text  = Column(Text, nullable=True)     # question text that caused the error
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    attempt   = relationship("ExerciseAttempt", back_populates="error_card")
    flashcard = relationship("Flashcard", back_populates="error_card")

# ── Document Index ───────────────────────────────────────────────────────────

class DocumentIndex(Base):
    """Metadata for indexed study documents (PDFs, etc)."""
    __tablename__ = "document_indexes"
    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id   = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    # File info
    filename     = Column(String, nullable=False)
    file_path    = Column(String, nullable=False)
    file_type    = Column(String, default="pdf")   # pdf, txt, docx
    file_size_kb = Column(Integer, nullable=True)
    # Detected context from path structure docs/concurso/disciplina/
    concurso     = Column(String, nullable=True)   # e.g., sefaz-ce
    disciplina   = Column(String, nullable=True)   # e.g., banco-de-dados
    doc_type     = Column(String, default="material")  # edital / material / questoes
    # Extracted content
    page_count   = Column(Integer, nullable=True)
    summary      = Column(Text, nullable=True)
    topics_json  = Column(JSON, nullable=True)     # extracted topics
    metadata_json = Column(JSON, default=dict)
    indexed_at   = Column(DateTime(timezone=True), server_default=func.now())
    is_indexed   = Column(Boolean, default=False)

    user    = relationship("User")
    subject = relationship("Subject", back_populates="document_indexes")
