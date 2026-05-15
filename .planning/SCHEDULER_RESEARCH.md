# Smart Scheduler — Research

**Date:** 2026-05-14  
**Domain:** Study planning, spaced repetition, FastAPI + React/TypeScript  
**Confidence:** HIGH (all findings grounded in actual codebase)

---

## Summary

The Smart Scheduler feature adds exam-oriented study planning on top of the existing Pomodoro app.
Users register an exam, its topics, their available time, and available days; the backend generates a
concrete dated plan distributing first-study sessions across available days and inserting spaced
repetition review sessions (+1, +3, +7, +14, +30 days).

The existing codebase follows a strict layered pattern (Domain → Data → API) with no service layer —
business logic lives directly in routers. The generation algorithm is simple enough to follow this
convention without needing a separate service module.

**Primary recommendation:** Three new SQLAlchemy models (`Exam`, `ExamTopic`, `StudyPlanItem`), one
new router (`scheduler.py`), one repository class (`SchedulerRepository`), and a single
React container with four sub-components and one Zustand store — all following existing conventions.

---

## 1. Ghost Model Conflict Analysis

> Answer to research question 6 — must be resolved before writing any new model.

### `Subject` (ghost model — no router, no repo, no DTOs)

`Subject` already exists in `models.py` with fields: `name`, `description`, `priority`, `weight`,
`difficulty`, `exam_board`, `color`, `weekly_goal_minutes`, `total_studied_minutes`, `category_id`.

**Decision:** Do NOT reuse `Subject` as the "topic" concept for the scheduler. Reasons:
- `Subject` is entangled with `Task`, `PomodoroSession`, `AnkiDeck`, `Exercise` via FK relationships.
- Activating `Subject` as part of the scheduler would pull in dead code (category, study_type).
- The scheduler needs a lightweight `ExamTopic` with an `estimated_hours` field absent from `Subject`.
- **Optional bridge:** `ExamTopic` can carry a nullable `subject_id` FK so a topic may optionally
  reference an existing Subject without requiring it. This keeps the door open without forcing coupling.

### `Schedule` (ghost model — no router, no repo, no DTOs)

`Schedule` has fields: `day_of_week` (int 0–6), `time_of_day` (string), `duration_minutes`, `subject_id`.

This is a **recurring weekly template** — unrelated to dated, one-off study plan items. There is
**no conflict** with the new `StudyPlanItem` (which is a specific dated slot). The two can coexist.
The planner should never activate the ghost `Schedule` as part of this feature.

---

## 2. New SQLAlchemy Models

Add these three classes to `backend/app/domain/models.py`. Also add the reverse relationships to
`User`.

### 2.1 `Exam`

```python
class Exam(Base):
    __tablename__ = "exams"
    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    name           = Column(String, nullable=False)               # e.g., "ENEM 2026"
    exam_date      = Column(DateTime(timezone=True), nullable=False)
    daily_hours    = Column(Float, nullable=False)                # budget per available day
    available_days = Column(String, nullable=False, default="[0,1,2,3,4]")
    # JSON string of weekday ints 0=Mon … 6=Sun  e.g. "[0,1,2,3,4]"
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    user       = relationship("User",         back_populates="exams")
    topics     = relationship("ExamTopic",    back_populates="exam", cascade="all, delete-orphan")
    plan_items = relationship("StudyPlanItem", back_populates="exam", cascade="all, delete-orphan")
```

Add to `User`:
```python
exams = relationship("Exam", back_populates="user")
```

### 2.2 `ExamTopic`

```python
class ExamTopic(Base):
    __tablename__ = "exam_topics"
    id              = Column(Integer, primary_key=True, index=True)
    exam_id         = Column(Integer, ForeignKey("exams.id"), nullable=False)
    subject_id      = Column(Integer, ForeignKey("subjects.id"), nullable=True)  # optional bridge
    name            = Column(String, nullable=False)              # e.g., "Álgebra Linear"
    estimated_hours = Column(Float, nullable=False, default=1.0)  # first-study time budget
    priority        = Column(Integer, nullable=False, default=2)  # 1=High 2=Medium 3=Low

    exam    = relationship("Exam",    back_populates="topics")
    subject = relationship("Subject")                              # optional, read-only link
    plan_items = relationship("StudyPlanItem", back_populates="topic", cascade="all, delete-orphan")
```

### 2.3 `StudyPlanItem`

```python
class StudyPlanItem(Base):
    __tablename__ = "study_plan_items"
    id              = Column(Integer, primary_key=True, index=True)
    exam_id         = Column(Integer, ForeignKey("exams.id"), nullable=False)
    exam_topic_id   = Column(Integer, ForeignKey("exam_topics.id"), nullable=False)
    scheduled_date  = Column(DateTime(timezone=True), nullable=False)  # UTC midnight of the day
    duration_minutes = Column(Integer, nullable=False)
    session_type    = Column(String, nullable=False)  # "first_study" | "review"
    review_interval = Column(Integer, nullable=True)  # days after first study (1,3,7,14,30); NULL for first_study
    completed       = Column(Boolean, nullable=False, default=False)

    exam  = relationship("Exam",       back_populates="plan_items")
    topic = relationship("ExamTopic",  back_populates="plan_items")
```

---

## 3. Generation Algorithm

### Inputs
| Input | Source | Type |
|-------|--------|------|
| `exam_date` | `Exam.exam_date` | `date` |
| `daily_hours` | `Exam.daily_hours` | `float` |
| `available_days` | `Exam.available_days` (JSON) | `list[int]` weekday 0–6 |
| `topics` | `list[ExamTopic]` | sorted by priority asc |

### Constants
```python
REVIEW_INTERVALS = [1, 3, 7, 14, 30]  # days after first study
REVIEW_MINUTES   = 20                  # fixed duration for each review session
```

### Algorithm (Python)

```python
import json
from datetime import date, timedelta, datetime, timezone

def generate_plan(exam, topics) -> list[dict]:
    exam_date   = exam.exam_date.date()
    today       = date.today()
    budget_min  = int(exam.daily_hours * 60)
    avail_days  = set(json.loads(exam.available_days))  # {0,1,2,3,4}

    # 1. Build ordered list of available dates [today, exam_date)
    all_dates: list[date] = []
    cursor = today
    while cursor < exam_date:
        if cursor.weekday() in avail_days:
            all_dates.append(cursor)
        cursor += timedelta(days=1)

    if not all_dates:
        return []  # no available days → return empty plan

    # 2. Per-day budget tracker (minutes remaining)
    day_budget: dict[date, int] = {d: budget_min for d in all_dates}

    plan_items = []
    first_study_dates: dict[int, date] = {}  # topic_id → scheduled date

    # 3. Sort topics: priority ASC (1=High first), then estimated_hours DESC
    sorted_topics = sorted(topics, key=lambda t: (t.priority, -t.estimated_hours))

    # 4. Schedule first-study sessions
    for topic in sorted_topics:
        needed = int(topic.estimated_hours * 60)

        # Find earliest date with enough remaining budget
        chosen = None
        for d in all_dates:
            if day_budget[d] >= needed:
                chosen = d
                break

        if chosen is None:
            # Fallback: pick day with most remaining budget (partial fit)
            chosen = max(all_dates, key=lambda d: day_budget[d])

        day_budget[chosen] = max(0, day_budget[chosen] - needed)
        first_study_dates[topic.id] = chosen

        plan_items.append({
            "exam_topic_id":   topic.id,
            "scheduled_date":  datetime(chosen.year, chosen.month, chosen.day, tzinfo=timezone.utc),
            "duration_minutes": needed,
            "session_type":    "first_study",
            "review_interval": None,
        })

    # 5. Schedule spaced repetition reviews
    for topic in sorted_topics:
        first_date = first_study_dates.get(topic.id)
        if first_date is None:
            continue

        for interval in REVIEW_INTERVALS:
            target = first_date + timedelta(days=interval)

            if target >= exam_date:
                break  # all further intervals will also be past exam

            # Find nearest available day on or after target
            actual = next((d for d in all_dates if d >= target), None)
            if actual is None:
                continue

            if day_budget.get(actual, 0) >= REVIEW_MINUTES:
                day_budget[actual] -= REVIEW_MINUTES
                plan_items.append({
                    "exam_topic_id":   topic.id,
                    "scheduled_date":  datetime(actual.year, actual.month, actual.day, tzinfo=timezone.utc),
                    "duration_minutes": REVIEW_MINUTES,
                    "session_type":    "review",
                    "review_interval": interval,
                })
            # If budget insufficient for a review, silently skip that repetition

    return plan_items
```

### Algorithm Notes

- **Greedy first-fit** for first-study: O(T × D) where T = topics, D = days to exam. Acceptable for all realistic inputs (< 100 topics, < 365 days).
- **Reviews are opportunistic:** if a day is full, the review is dropped rather than pushed later. This prevents cascading overloads. An alternative (push to next day) can be added later.
- **`available_days` stored as JSON string** because SQLite has no native array type. Parse on read with `json.loads()`.
- Topics with `priority=1` (High) are scheduled before lower-priority topics, ensuring they get earlier, less-crowded slots.
- The algorithm runs synchronously inside the POST endpoint — no background worker needed at this scale.

---

## 4. Backend Endpoints

New router file: `backend/app/api/routers/scheduler.py`  
Prefix: `/scheduler`  
All routes: `Depends(get_current_user)` — no unauthenticated access.

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|--------------|----------|
| `POST` | `/scheduler/exams` | Create exam + topics, generate plan | `ExamCreate` | `ExamResponse` |
| `GET` | `/scheduler/exams` | List user's exams (no plan items) | — | `list[ExamSummary]` |
| `GET` | `/scheduler/exams/{exam_id}` | Get exam + topics | — | `ExamResponse` |
| `DELETE` | `/scheduler/exams/{exam_id}` | Delete exam + cascade plan items | — | `{"message": "..."}` |
| `POST` | `/scheduler/exams/{exam_id}/regenerate` | Re-generate plan (delete old, create new) | — | `list[StudyPlanItemResponse]` |
| `GET` | `/scheduler/exams/{exam_id}/plan` | Full plan for one exam | — | `list[StudyPlanItemResponse]` |
| `GET` | `/scheduler/plan/today` | Today's items across all exams | — | `list[StudyPlanItemResponse]` |
| `GET` | `/scheduler/plan/week` | This week's items (Mon–Sun) | — | `list[StudyPlanItemResponse]` |
| `PATCH` | `/scheduler/plan/{item_id}` | Toggle item completed | `PlanItemUpdate` | `StudyPlanItemResponse` |

### Registration in `main.py`
```python
from app.api.routers import scheduler
app.include_router(scheduler.router, prefix="/api")
```

---

## 5. Pydantic DTOs

Add to `backend/app/api/dtos.py`:

```python
# --- Scheduler ---

class ExamTopicCreate(BaseModel):
    name: str
    estimated_hours: float = 1.0
    priority: int = 2          # 1=High 2=Medium 3=Low
    subject_id: Optional[int] = None

class ExamCreate(BaseModel):
    name: str
    exam_date: datetime
    daily_hours: float
    available_days: list[int]  # e.g., [0,1,2,3,4]
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
    available_days: str        # raw JSON string
    created_at: datetime
    topic_count: int           # computed in repo, not a column

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
    session_type: str           # "first_study" | "review"
    review_interval: Optional[int]
    completed: bool
    topic_name: str             # denormalized — join-loaded in repo

    class Config:
        from_attributes = True

class PlanItemUpdate(BaseModel):
    completed: Optional[bool] = None
```

> Note: `ExamSummary.topic_count` and `StudyPlanItemResponse.topic_name` are not columns — they must
> be populated by the repository query (joined load or manual assignment), not by ORM auto-mapping.
> The router should build a plain `dict` for these fields before returning.

---

## 6. Repository

Add a new class to `backend/app/data/repositories.py`:

```python
from app.domain.models import Exam, ExamTopic, StudyPlanItem

class SchedulerRepository(BaseRepository[Exam]):
    def __init__(self):
        super().__init__(Exam)

    def get_by_user(self, db: Session, user_id: int) -> list[Exam]:
        return db.query(Exam).filter(Exam.user_id == user_id).all()

    def get_with_topics(self, db: Session, exam_id: int) -> Exam | None:
        from sqlalchemy.orm import joinedload
        return (
            db.query(Exam)
            .options(joinedload(Exam.topics))
            .filter(Exam.id == exam_id)
            .first()
        )

    def get_plan(self, db: Session, exam_id: int) -> list[StudyPlanItem]:
        return (
            db.query(StudyPlanItem)
            .filter(StudyPlanItem.exam_id == exam_id)
            .order_by(StudyPlanItem.scheduled_date)
            .all()
        )

    def get_today_items(self, db: Session, user_id: int) -> list[StudyPlanItem]:
        from datetime import date
        from sqlalchemy import cast, Date
        today = date.today()
        return (
            db.query(StudyPlanItem)
            .join(Exam)
            .filter(
                Exam.user_id == user_id,
                cast(StudyPlanItem.scheduled_date, Date) == today,
            )
            .order_by(StudyPlanItem.scheduled_date)
            .all()
        )

    def get_week_items(self, db: Session, user_id: int) -> list[StudyPlanItem]:
        from datetime import date, timedelta
        from sqlalchemy import cast, Date
        today = date.today()
        week_end = today + timedelta(days=6)
        return (
            db.query(StudyPlanItem)
            .join(Exam)
            .filter(
                Exam.user_id == user_id,
                cast(StudyPlanItem.scheduled_date, Date) >= today,
                cast(StudyPlanItem.scheduled_date, Date) <= week_end,
            )
            .order_by(StudyPlanItem.scheduled_date)
            .all()
        )

    def delete_plan(self, db: Session, exam_id: int) -> None:
        db.query(StudyPlanItem).filter(StudyPlanItem.exam_id == exam_id).delete()
        db.commit()

    def bulk_create_plan(self, db: Session, exam_id: int, items: list[dict]) -> list[StudyPlanItem]:
        db_items = [StudyPlanItem(exam_id=exam_id, **item) for item in items]
        db.add_all(db_items)
        db.commit()
        for item in db_items:
            db.refresh(item)
        return db_items

# Singleton
scheduler_repo = SchedulerRepository()
```

---

## 7. Frontend Components

### New Route in `frontend/src/index.tsx`

```tsx
import Scheduler from './containers/Scheduler';

// Inside <Routes>:
<Route path="/scheduler" element={<Scheduler />} />
```

`react-router-dom` is already installed and used — **no new package needed**. [VERIFIED: codebase]

### New Files

```
frontend/src/
├── containers/
│   └── Scheduler.tsx                   # Page container — fetches store data, renders children
├── components/Scheduler/
│   ├── ExamForm/
│   │   └── index.tsx                   # Wizard-like form: exam details + topic list
│   ├── TopicList/
│   │   └── index.tsx                   # Add/remove/edit ExamTopic rows
│   ├── WeeklyCalendar/
│   │   └── index.tsx                   # 7-column grid (Mon-Sun), items placed by date
│   ├── DailyPlanList/
│   │   └── index.tsx                   # Vertical list for a single selected day
│   └── PlanItem/
│       └── index.tsx                   # Card: topic name, duration, badge (first_study|review)
└── store/
    └── schedulerStore.ts               # Zustand store — mirrors pomodoroStore.ts pattern
```

### `schedulerStore.ts` shape

```typescript
interface SchedulerState {
  exams: ExamSummary[];
  currentExam: ExamResponse | null;
  planItems: StudyPlanItemResponse[];
  todayItems: StudyPlanItemResponse[];
  isLoading: boolean;
  error: string | null;
  fetchExams: () => Promise<void>;
  fetchExam: (examId: number) => Promise<void>;
  createExam: (payload: ExamCreate) => Promise<void>;
  deleteExam: (examId: number) => Promise<void>;
  regeneratePlan: (examId: number) => Promise<void>;
  fetchTodayItems: () => Promise<void>;
  fetchWeekItems: () => Promise<void>;
  toggleItemCompleted: (itemId: number, completed: boolean) => Promise<void>;
}
```

### New TypeScript Interfaces (add to `frontend/src/types/index.ts`)

```typescript
export interface ExamTopicCreate {
  name: string;
  estimated_hours: number;
  priority: number;
  subject_id?: number;
}

export interface ExamCreate {
  name: string;
  exam_date: string;         // ISO datetime string
  daily_hours: number;
  available_days: number[];  // [0,1,2,3,4]
  topics: ExamTopicCreate[];
}

export interface ExamTopicResponse {
  id: number;
  exam_id: number;
  name: string;
  estimated_hours: number;
  priority: number;
  subject_id?: number;
}

export interface ExamSummary {
  id: number;
  name: string;
  exam_date: string;
  daily_hours: number;
  available_days: string;    // raw JSON "[0,1,2,3,4]"
  created_at: string;
  topic_count: number;
}

export interface ExamResponse extends ExamSummary {
  topics: ExamTopicResponse[];
}

export interface StudyPlanItemResponse {
  id: number;
  exam_id: number;
  exam_topic_id: number;
  scheduled_date: string;    // ISO datetime string
  duration_minutes: number;
  session_type: 'first_study' | 'review';
  review_interval: number | null;
  completed: boolean;
  topic_name: string;
}
```

---

## 8. Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Exam CRUD | API / Backend | Database | Server-owned data, auth-gated |
| Plan generation algorithm | API / Backend | — | Pure computation, belongs in router/repo, not browser |
| Spaced repetition scheduling | API / Backend | — | Date math is deterministic; done once at generate time |
| Weekly calendar display | Browser / Client | — | Pure render of fetched plan data |
| Daily list display | Browser / Client | — | Pure render |
| Mark item completed | Browser / Client + API | Database | Optimistic update locally, PATCH persists to DB |
| `available_days` encoding/decoding | API / Backend | Browser | Backend stores JSON string; frontend sends `number[]` |

---

## 9. Common Pitfalls

### Pitfall 1: Forgetting `cascade="all, delete-orphan"`
When an `Exam` is deleted, `ExamTopic` and `StudyPlanItem` rows must be deleted too.
Without the cascade both on the ORM relationship and as a DB-level `ON DELETE CASCADE`, rows
become orphaned. Add `cascade="all, delete-orphan"` on both `Exam.topics` and `Exam.plan_items`.

### Pitfall 2: `available_days` round-trip corruption
`Exam.available_days` is stored as `String` (JSON). Always use `json.loads()` to read it and
`json.dumps(sorted(days))` to write it. If the router or DTO passes a `list[int]` to the model,
serialize it before insertion: `"available_days": json.dumps(sorted(payload.available_days))`.

### Pitfall 3: `ExamSummary.topic_count` is not a column
Pydantic's `from_attributes=True` reads ORM attributes directly. `topic_count` does not exist on
the model. The router must build a `dict` manually or use `len(exam.topics)` before serialization.
Do not try to return the ORM object directly for `ExamSummary`.

### Pitfall 4: `StudyPlanItemResponse.topic_name` join requirement
Same issue: `topic_name` is on the related `ExamTopic`, not on `StudyPlanItem`. Use
`joinedload(StudyPlanItem.topic)` in all plan queries, then map `item.topic.name` when building
the response dict.

### Pitfall 5: Timezone-naive dates in SQLite
SQLite stores all datetimes as strings. Use `DateTime(timezone=True)` and store UTC midnight
(`datetime(..., tzinfo=timezone.utc)`) for `scheduled_date`. When comparing dates in queries,
use `cast(StudyPlanItem.scheduled_date, Date)` to strip the time component.

### Pitfall 6: Algorithm produces zero plan items
This happens when `exam_date` is today or in the past, or `available_days` excludes all days
before the exam. The router should return `HTTP 422` with a clear message if `all_dates` is empty
after building the availability list.

### Pitfall 7: Ghost `Schedule` model collision
The existing `Subject.schedules` relationship points to the ghost `Schedule` model. Do not
touch this relationship. The new `StudyPlanItem` is entirely separate and will not conflict as
long as it uses its own table name `study_plan_items`.

---

## 10. Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Date iteration | Custom while-loop reimplementations | Python `timedelta` + standard `datetime` — already in stdlib |
| JSON column in SQLite | Custom serializer class | `json.dumps` / `json.loads` inline — two lines |
| ORM eager loading | N+1 queries in a loop | SQLAlchemy `joinedload()` — one import |
| Frontend date display | Custom date formatter | `date-fns` or `Intl.DateTimeFormat` — already likely in project |

---

## 11. Database Migration Note

The existing database is SQLite using `database/pomodoro.db`. The project has no Alembic migration
files — the app uses `Base.metadata.create_all(bind=engine)` on startup (or equivalent). Adding new
models to `models.py` is sufficient for the tables to be created on next startup in development.

**In production**, the tables will only be created if the DB is reset or if migrations are run.
The planner should include a step: verify that the three new tables appear in the DB after restart.

---

## Sources

- [VERIFIED: codebase] `backend/app/domain/models.py` — all existing models, ghost model status
- [VERIFIED: codebase] `backend/app/data/repositories.py` — BaseRepository pattern, singleton convention
- [VERIFIED: codebase] `backend/app/api/dtos.py` — DTO patterns, `from_attributes` convention
- [VERIFIED: codebase] `backend/app/main.py` — router registration pattern
- [VERIFIED: codebase] `frontend/src/index.tsx` — react-router-dom v6 route structure
- [VERIFIED: codebase] `frontend/src/store/pomodoroStore.ts` — Zustand store pattern
- [VERIFIED: codebase] `frontend/src/types/index.ts` — existing type definitions
- [VERIFIED: codebase] `.planning/intel/ARCH.md` — layered architecture rules
- [VERIFIED: codebase] `.planning/intel/PATTERNS.md` — exact file-role conventions
- [ASSUMED] `date-fns` availability in frontend — not verified against `package.json`
