from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# --- Users ---
class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None

# --- Tasks ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "Medium"
    due_date: Optional[datetime] = None
    estimated_minutes: int = 25
    position: int = 0
    subject_id: Optional[int] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    position: Optional[int] = None

class TaskResponse(TaskBase):
    id: int
    completed: bool
    actual_minutes: int
    user_id: int

    class Config:
        from_attributes = True

# --- Pomodoro ---
class PomodoroSessionCreate(BaseModel):
    duration_minutes: int
    session_type: str  # Pomodoro, Short Break, Long Break
    completed: bool = True
    interruptions: int = 0
    productivity_rating: Optional[int] = None
    subject_id: Optional[int] = None

class PomodoroSessionUpdate(BaseModel):
    productivity_rating: Optional[int] = None
    interruptions: Optional[int] = None
    completed: Optional[bool] = None

class PomodoroSessionResponse(BaseModel):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    duration_minutes: int
    session_type: str
    completed: bool
    interruptions: int
    productivity_rating: Optional[int]
    user_id: int
    subject_id: Optional[int]

    class Config:
        from_attributes = True

class PomodoroStatsResponse(BaseModel):
    today_pomodoros: int
    total_focus_minutes: int
    total_sessions: int

# --- Settings ---
class SettingUpdate(BaseModel):
    auto_start_breaks: Optional[bool] = None
    auto_start_pomodoros: Optional[bool] = None
    long_break_interval: Optional[int] = None
    dark_mode: Optional[bool] = None
    focus_mode: Optional[bool] = None
    theme_color: Optional[str] = None
    sound_enabled: Optional[bool] = None

class SettingResponse(BaseModel):
    id: int
    user_id: int
    auto_start_breaks: bool
    auto_start_pomodoros: bool
    long_break_interval: int
    dark_mode: bool
    focus_mode: bool
    theme_color: str
    sound_enabled: bool

    class Config:
        from_attributes = True

# ── Dashboard DTOs ──────────────────────────────────────────────────

class HeatmapEntry(BaseModel):
    date: str   # "YYYY-MM-DD"
    count: int

class WeeklyEvolutionEntry(BaseModel):
    day: str        # "YYYY-MM-DD"
    day_label: str  # "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"
    pomodoros: int
    focus_minutes: int

class DashboardStatsResponse(BaseModel):
    hours_studied_today: float
    hours_studied_week: float
    hours_studied_all: float
    current_streak: int
    consistency_pct: float
    efficiency_pct: float
    weekly_focus_minutes: int
    weekly_goal_minutes: int
    most_studied_subject: Optional[str]
    most_studied_subject_minutes: Optional[int]

class DashboardResponse(BaseModel):
    stats: DashboardStatsResponse
    heatmap: list[HeatmapEntry]
    weekly_evolution: list[WeeklyEvolutionEntry]


# ── Smart Scheduler ──────────────────────────────────────────────────

class ExamTopicCreate(BaseModel):
    name: str
    estimated_hours: float = 1.0
    priority: int = 2
    subject_id: Optional[int] = None


class ExamCreate(BaseModel):
    name: str
    exam_date: datetime
    daily_hours: float
    available_days: list[int]
    topics: list[ExamTopicCreate]


class ExamTopicResponse(BaseModel):
    id: int
    exam_id: int
    name: str
    estimated_hours: float
    priority: int
    subject_id: Optional[int]

    class Config:
        from_attributes = True


class ExamSummary(BaseModel):
    id: int
    name: str
    exam_date: datetime
    daily_hours: float
    available_days: str
    created_at: datetime
    topic_count: int

    class Config:
        from_attributes = True


class ExamResponse(BaseModel):
    id: int
    name: str
    exam_date: datetime
    daily_hours: float
    available_days: str
    created_at: datetime
    topics: list[ExamTopicResponse]

    class Config:
        from_attributes = True


class StudyPlanItemResponse(BaseModel):
    id: int
    exam_id: int
    exam_topic_id: int
    scheduled_date: datetime
    duration_minutes: int
    session_type: str
    review_interval: Optional[int]
    completed: bool
    topic_name: str

    class Config:
        from_attributes = True


class PlanItemUpdate(BaseModel):
    completed: Optional[bool] = None


# ── Anki DTOs ─────────────────────────────────────────────────────────────

class DeckCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#3b82f6"
    subject_id: Optional[int] = None
    parent_deck_id: Optional[int] = None

class DeckUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    subject_id: Optional[int] = None
    parent_deck_id: Optional[int] = None

class DeckResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    color: str
    user_id: int
    subject_id: Optional[int]
    parent_deck_id: Optional[int]
    created_at: datetime
    card_count: int = 0
    due_count: int = 0
    new_count: int = 0

    class Config:
        from_attributes = True

class DeckTreeResponse(DeckResponse):
    subdecks: List["DeckTreeResponse"] = []

    class Config:
        from_attributes = True

DeckTreeResponse.model_rebuild()

# ── Flashcard DTOs ────────────────────────────────────────────────────────────

class FlashcardOptionCreate(BaseModel):
    text: str
    is_correct: bool = False
    position: int = 0

class FlashcardOptionResponse(BaseModel):
    id: int
    text: str
    is_correct: bool
    position: int

    class Config:
        from_attributes = True

class FlashcardCreate(BaseModel):
    deck_id: int
    card_type: str = "qa"  # qa, multiple_choice, cloze, true_false
    front: str
    back: str
    hint: Optional[str] = None
    explanation: Optional[str] = None
    tags: List[str] = []
    difficulty: str = "Medium"
    options: List[FlashcardOptionCreate] = []

class FlashcardUpdate(BaseModel):
    card_type: Optional[str] = None
    front: Optional[str] = None
    back: Optional[str] = None
    hint: Optional[str] = None
    explanation: Optional[str] = None
    tags: Optional[List[str]] = None
    difficulty: Optional[str] = None
    options: Optional[List[FlashcardOptionCreate]] = None

class FlashcardResponse(BaseModel):
    id: int
    deck_id: int
    card_type: str
    front: str
    back: str
    hint: Optional[str]
    explanation: Optional[str] = None
    tags: List[str]
    difficulty: str
    repetitions: int
    easiness_factor: float
    interval: int
    lapses: int
    last_reviewed: Optional[datetime]
    next_review: Optional[datetime]
    created_at: datetime
    options: List[FlashcardOptionResponse] = []

    class Config:
        from_attributes = True

# ── Review DTOs ────────────────────────────────────────────────────────────

class ReviewSubmit(BaseModel):
    flashcard_id: int
    quality: int  # 0-5
    response_time_ms: Optional[int] = None

class ReviewResult(BaseModel):
    flashcard_id: int
    next_review: datetime
    new_interval: int
    new_easiness_factor: float
    new_repetitions: int
    lapses: int

# ── Anki Stats DTOs ────────────────────────────────────────────────────────

class MaturityBucket(BaseModel):
    label: str
    count: int

class AnkiStatsResponse(BaseModel):
    total_cards: int
    due_today: int
    new_cards: int
    retention_rate: float       # % correct over last 30 days
    accuracy_rate: float        # % correct all-time
    total_reviews: int
    streak_days: int
    avg_ease: float
    cards_by_maturity: List[MaturityBucket]  # New / Learning / Young / Mature
    weekly_reviews: List[dict]   # [{day, count}]

# ── AI Generation DTOs ────────────────────────────────────────────────────────

class AIGenerateRequest(BaseModel):
    deck_id: int
    source_type: str = "text"   # text, pdf, url, summary
    content: str
    card_count: int = 10
    card_types: List[str] = ["qa"]
    language: str = "pt"

class AIGenerateResponse(BaseModel):
    created_count: int
    flashcards: List[FlashcardResponse]

class AIGenerateFromPDFResponse(BaseModel):
    created_count: int
    flashcards: List[FlashcardResponse]
    deck_id: int
    deck_name: str
    deck_created: bool
