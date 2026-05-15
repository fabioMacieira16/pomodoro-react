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

class StudyType(Base):
    __tablename__ = "study_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) # e.g., Concurso, Certificações
    
    categories = relationship("Category", back_populates="study_type")

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True) # e.g., TI, Direito
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
    exam_board = Column(String, nullable=True) # banca
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
    position = Column(Integer, default=0) # For drag and drop ordering
    
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
    session_type = Column(String) # Pomodoro, Short Break, Long Break
    completed = Column(Boolean, default=False)
    interruptions = Column(Integer, default=0)
    productivity_rating = Column(Integer, nullable=True) # 1-5
    
    user_id = Column(Integer, ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)

    user = relationship("User", back_populates="pomodoro_sessions")
    subject = relationship("Subject", back_populates="pomodoro_sessions")

class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(Integer) # 0-6 (Mon-Sun)
    time_of_day = Column(String) # Morning, Afternoon, Evening
    duration_minutes = Column(Integer, default=60)
    
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    subject = relationship("Subject", back_populates="schedules")

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    auto_start_breaks = Column(Boolean, default=False)
    auto_start_pomodoros = Column(Boolean, default=False)
    long_break_interval = Column(Integer, default=4)
    dark_mode = Column(Boolean, default=False)
    focus_mode = Column(Boolean, default=True)
    theme_color = Column(String, default="blue")
    sound_enabled = Column(Boolean, default=True)

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
    card_type = Column(String, default="qa")  # qa, multiple_choice, cloze, true_false
    front = Column(Text)
    back = Column(Text)
    hint = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    difficulty = Column(String, default="Medium")
    # SM-2 fields
    repetitions = Column(Integer, default=0)
    easiness_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=0)
    lapses = Column(Integer, default=0)
    last_reviewed = Column(DateTime(timezone=True), nullable=True)
    next_review = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    deck = relationship("AnkiDeck", back_populates="flashcards")
    options = relationship("FlashcardOption", back_populates="flashcard", cascade="all, delete-orphan")
    reviews = relationship("FlashcardReview", back_populates="flashcard", cascade="all, delete-orphan")

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
    quality = Column(Integer)  # 0-5 SM-2 quality rating
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
    difficulty = Column(String, default="Medium")
    exam_board = Column(String, nullable=True)

    subject = relationship("Subject", back_populates="exercises")
    attempts = relationship("ExerciseAttempt", back_populates="exercise")

class ExerciseAttempt(Base):
    __tablename__ = "exercise_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    exercise_id = Column(Integer, ForeignKey("exercises.id"))
    user_answer = Column(Text)
    is_correct = Column(Boolean)
    attempted_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="exercise_attempts")
    exercise = relationship("Exercise", back_populates="attempts")

class AiHistory(Base):
    __tablename__ = "ai_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String) # Summarize, Generate Quiz
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
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    user       = relationship("User",          back_populates="exams")
    topics     = relationship("ExamTopic",     back_populates="exam",  cascade="all, delete-orphan")
    plan_items = relationship("StudyPlanItem", back_populates="exam",  cascade="all, delete-orphan")


class ExamTopic(Base):
    __tablename__ = "exam_topics"
    id              = Column(Integer, primary_key=True, index=True)
    exam_id         = Column(Integer, ForeignKey("exams.id"),    nullable=False)
    subject_id      = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    name            = Column(String,  nullable=False)
    estimated_hours = Column(Float,   nullable=False, default=1.0)
    priority        = Column(Integer, nullable=False, default=2)

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
