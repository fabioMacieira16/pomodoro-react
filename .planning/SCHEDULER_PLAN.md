# Smart Scheduler — GSD Execution Plan

**Phase goal:** User inputs exam name, date, available hours/days, and topics → backend generates a
complete daily/weekly study plan with spaced repetitions inserted automatically.

**Date:** 2026-05-14  
**Research source:** `.planning/SCHEDULER_RESEARCH.md`  
**Pattern source:** `.planning/intel/PATTERNS.md`

---

## Task Index

| ID | Title | Group |
|----|-------|-------|
| BE-01 | Add Exam, ExamTopic, StudyPlanItem models to models.py | Backend Models |
| BE-02 | Add SchedulerRepository to repositories.py | Backend Repository |
| BE-03 | Create scheduler.py generation algorithm (app/core/scheduler.py) | Backend Service |
| BE-04 | Add Scheduler DTOs to dtos.py | Backend DTOs |
| BE-05 | Create scheduler router (app/api/routers/scheduler.py) | Backend Router |
| BE-06 | Register scheduler router in main.py | Backend main.py |
| FE-01 | Add Scheduler TypeScript interfaces to types/index.ts | Frontend Types |
| FE-02 | Create schedulerStore.ts (Zustand) | Frontend Store |
| FE-03 | Create ExamForm component | Frontend Components |
| FE-04 | Create ExamList component | Frontend Components |
| FE-05 | Create WeeklyView component | Frontend Components |
| FE-06 | Create DailyList and PlanItem components | Frontend Components |
| FE-07 | Create Scheduler container + CSS | Frontend Routing |
| FE-08 | Add /scheduler route and 📅 nav button | Frontend Routing |

---

## Group 1 — Backend Models

### BE-01 — Add Exam, ExamTopic, StudyPlanItem models to models.py

**file_path:** `backend/app/domain/models.py`

**what_to_do:**

1. Add `json` to stdlib — it will be used by the algorithm, not models, but keep it available.

2. Append the three new model classes **after** the last existing class in the file. Do not touch any existing class.

3. Add the `exams` back-reference to `User`.

**Exact code to append at the end of `backend/app/domain/models.py`:**

```python
# ── Smart Scheduler ──────────────────────────────────────────────────────────

class Exam(Base):
    __tablename__ = "exams"
    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    name           = Column(String, nullable=False)
    exam_date      = Column(DateTime(timezone=True), nullable=False)
    daily_hours    = Column(Float, nullable=False)
    available_days = Column(String, nullable=False, default="[0,1,2,3,4]")
    # JSON string of weekday ints 0=Mon … 6=Sun
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
    priority        = Column(Integer, nullable=False, default=2)   # 1=High 2=Medium 3=Low

    exam       = relationship("Exam",       back_populates="topics")
    subject    = relationship("Subject")                            # optional read-only bridge
    plan_items = relationship("StudyPlanItem", back_populates="topic", cascade="all, delete-orphan")


class StudyPlanItem(Base):
    __tablename__ = "study_plan_items"
    id               = Column(Integer,  primary_key=True, index=True)
    exam_id          = Column(Integer,  ForeignKey("exams.id"),       nullable=False)
    exam_topic_id    = Column(Integer,  ForeignKey("exam_topics.id"), nullable=False)
    scheduled_date   = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer,  nullable=False)
    session_type     = Column(String,   nullable=False)   # "first_study" | "review"
    review_interval  = Column(Integer,  nullable=True)    # None for first_study; 1/3/7/14/30 for reviews
    completed        = Column(Boolean,  nullable=False, default=False)

    exam  = relationship("Exam",      back_populates="plan_items")
    topic = relationship("ExamTopic", back_populates="plan_items")
```

4. In the `User` class (lines 7–20), add the `exams` relationship after `exercise_attempts`:

```python
    exams = relationship("Exam", back_populates="user")
```

**Critical notes:**
- `cascade="all, delete-orphan"` is mandatory on both `Exam.topics` and `Exam.plan_items` — see Pitfall 1 in research.
- Do NOT use `Column(JSON, ...)` for `available_days` — SQLite has no native JSON column. Use `Column(String, ...)` and serialize with `json.dumps` / `json.loads` at runtime.
- Do NOT activate the ghost `Schedule` model or modify `Subject.schedules`.
- No Alembic migrations needed — `Base.metadata.create_all` on startup will create the tables.

**acceptance_criteria:**
- `python -c "from app.domain.models import Exam, ExamTopic, StudyPlanItem; print('OK')"` exits 0.
- `Exam.__tablename__ == "exams"`, `ExamTopic.__tablename__ == "exam_topics"`, `StudyPlanItem.__tablename__ == "study_plan_items"`.
- `User` class has `exams` attribute resolving to the `Exam` relationship.
- Starting the backend server (`uvicorn app.main:app`) creates all three tables without errors.

---

## Group 2 — Backend Repository

### BE-02 — Add SchedulerRepository to repositories.py

**file_path:** `backend/app/data/repositories.py`

**what_to_do:**

Append a new `SchedulerRepository` class at the end of `backend/app/data/repositories.py`, after the existing singleton instances. Follow the exact style of `PomodoroSessionRepository`.

**Exact code to append:**

```python
from app.domain.models import Exam, ExamTopic, StudyPlanItem


class SchedulerRepository(BaseRepository[Exam]):
    def __init__(self):
        super().__init__(Exam)

    # ── Exam queries ─────────────────────────────────────────────────────────

    def get_by_user(self, db: Session, user_id: int) -> list[Exam]:
        """Return all exams for a user, without eagerly loading relations."""
        return db.query(Exam).filter(Exam.user_id == user_id).all()

    def get_with_topics(self, db: Session, exam_id: int) -> Exam | None:
        """Return exam with topics eagerly loaded (avoids N+1)."""
        from sqlalchemy.orm import joinedload
        return (
            db.query(Exam)
            .options(joinedload(Exam.topics))
            .filter(Exam.id == exam_id)
            .first()
        )

    # ── Plan item queries ─────────────────────────────────────────────────────

    def get_plan(self, db: Session, exam_id: int) -> list[StudyPlanItem]:
        """Return all StudyPlanItems for one exam, ordered by date, with topic loaded."""
        from sqlalchemy.orm import joinedload
        return (
            db.query(StudyPlanItem)
            .options(joinedload(StudyPlanItem.topic))
            .filter(StudyPlanItem.exam_id == exam_id)
            .order_by(StudyPlanItem.scheduled_date)
            .all()
        )

    def get_today_items(self, db: Session, user_id: int) -> list[StudyPlanItem]:
        from datetime import date
        from sqlalchemy import cast, Date
        from sqlalchemy.orm import joinedload
        today = date.today()
        return (
            db.query(StudyPlanItem)
            .options(joinedload(StudyPlanItem.topic))
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
        from sqlalchemy.orm import joinedload
        today    = date.today()
        week_end = today + timedelta(days=6)
        return (
            db.query(StudyPlanItem)
            .options(joinedload(StudyPlanItem.topic))
            .join(Exam)
            .filter(
                Exam.user_id == user_id,
                cast(StudyPlanItem.scheduled_date, Date) >= today,
                cast(StudyPlanItem.scheduled_date, Date) <= week_end,
            )
            .order_by(StudyPlanItem.scheduled_date)
            .all()
        )

    def get_item(self, db: Session, item_id: int) -> StudyPlanItem | None:
        return db.query(StudyPlanItem).filter(StudyPlanItem.id == item_id).first()

    # ── Mutations ─────────────────────────────────────────────────────────────

    def delete_plan(self, db: Session, exam_id: int) -> None:
        """Bulk-delete all plan items for an exam (used before regenerate)."""
        db.query(StudyPlanItem).filter(StudyPlanItem.exam_id == exam_id).delete()
        db.commit()

    def bulk_create_plan(self, db: Session, exam_id: int, items: list[dict]) -> list[StudyPlanItem]:
        """Insert a list of plan-item dicts returned by the scheduler algorithm."""
        db_items = [StudyPlanItem(exam_id=exam_id, **item) for item in items]
        db.add_all(db_items)
        db.commit()
        for item in db_items:
            db.refresh(item)
        return db_items

    def toggle_item(self, db: Session, item_id: int, completed: bool) -> StudyPlanItem | None:
        item = self.get_item(db, item_id)
        if item:
            item.completed = completed
            db.commit()
            db.refresh(item)
        return item


# Singleton — matches existing convention (e.g., pomodoro_repo, task_repo)
scheduler_repo = SchedulerRepository()
```

**Critical notes:**
- All three plan-query methods use `joinedload(StudyPlanItem.topic)` so that `item.topic.name` is accessible without an extra query — required to populate `topic_name` in `StudyPlanItemResponse`.
- Local imports inside methods (`date`, `timedelta`, `cast`, `Date`, `joinedload`) follow the existing `PomodoroSessionRepository.get_stats` convention.
- `bulk_create_plan` passes `**item` to `StudyPlanItem(exam_id=exam_id, ...)` — the dicts from `generate_plan` do NOT include `exam_id`, so it is passed separately as a positional kwarg.

**acceptance_criteria:**
- `python -c "from app.data.repositories import scheduler_repo; print('OK')"` exits 0.
- `scheduler_repo` is an instance of `SchedulerRepository`.
- All seven methods are present: `get_by_user`, `get_with_topics`, `get_plan`, `get_today_items`, `get_week_items`, `get_item`, `toggle_item`, `delete_plan`, `bulk_create_plan`.

---

## Group 3 — Backend Service

### BE-03 — Create app/core/scheduler.py (generation algorithm)

**file_path:** `backend/app/core/scheduler.py` *(new file)*

**what_to_do:**

Create the file `backend/app/core/scheduler.py`. This module contains a single pure function
`generate_plan(exam, topics) -> list[dict]`. It performs no DB writes and has no side effects.

**Exact file content:**

```python
"""
Smart Scheduler — plan generation algorithm.

Pure function: receives exam + topics ORM objects, returns a list of dict records
shaped like StudyPlanItem (minus exam_id, which is added by bulk_create_plan).
"""
import json
from datetime import date, timedelta, datetime, timezone

REVIEW_INTERVALS = [1, 3, 7, 14, 30]   # days after first-study
REVIEW_MINUTES   = 20                   # fixed duration per review


def generate_plan(exam, topics: list) -> list[dict]:
    """
    Build a complete study plan for *exam* covering *topics*.

    Args:
        exam:   Exam ORM instance — must have .exam_date, .daily_hours, .available_days
        topics: list[ExamTopic] ORM instances — must have .id, .priority, .estimated_hours

    Returns:
        List of dicts ready for StudyPlanItem(**item) insertion.
        Each dict has keys: exam_topic_id, scheduled_date, duration_minutes,
        session_type, review_interval.
    """
    exam_date  = exam.exam_date.date()      # convert datetime → date
    today      = date.today()
    budget_min = int(exam.daily_hours * 60)
    avail_days = set(json.loads(exam.available_days))   # set of int weekdays

    # ── 1. Build ordered list of available dates [today, exam_date) ──────────
    all_dates: list[date] = []
    cursor = today
    while cursor < exam_date:
        if cursor.weekday() in avail_days:
            all_dates.append(cursor)
        cursor += timedelta(days=1)

    if not all_dates:
        return []   # caller should raise HTTP 422

    # ── 2. Per-day budget tracker (minutes remaining) ─────────────────────────
    day_budget: dict[date, int] = {d: budget_min for d in all_dates}

    plan_items: list[dict] = []
    first_study_dates: dict[int, date] = {}   # topic.id → scheduled date

    # ── 3. Sort: priority ASC (1=High first), then estimated_hours DESC ───────
    sorted_topics = sorted(topics, key=lambda t: (t.priority, -t.estimated_hours))

    # ── 4. First-study pass ───────────────────────────────────────────────────
    for topic in sorted_topics:
        needed = int(topic.estimated_hours * 60)

        # Find earliest date with sufficient remaining budget
        chosen = next((d for d in all_dates if day_budget[d] >= needed), None)

        if chosen is None:
            # Fallback: pick the least-loaded day (partial fit)
            chosen = max(all_dates, key=lambda d: day_budget[d])

        day_budget[chosen] = max(0, day_budget[chosen] - needed)
        first_study_dates[topic.id] = chosen

        plan_items.append({
            "exam_topic_id":    topic.id,
            "scheduled_date":   datetime(chosen.year, chosen.month, chosen.day, tzinfo=timezone.utc),
            "duration_minutes": needed,
            "session_type":     "first_study",
            "review_interval":  None,
        })

    # ── 5. Spaced repetition review pass ─────────────────────────────────────
    for topic in sorted_topics:
        first_date = first_study_dates.get(topic.id)
        if first_date is None:
            continue

        for interval in REVIEW_INTERVALS:
            target = first_date + timedelta(days=interval)

            if target >= exam_date:
                break   # all further intervals are also past exam date

            # Nearest available date on or after target
            actual = next((d for d in all_dates if d >= target), None)
            if actual is None:
                continue

            if day_budget.get(actual, 0) >= REVIEW_MINUTES:
                day_budget[actual] -= REVIEW_MINUTES
                plan_items.append({
                    "exam_topic_id":    topic.id,
                    "scheduled_date":   datetime(actual.year, actual.month, actual.day, tzinfo=timezone.utc),
                    "duration_minutes": REVIEW_MINUTES,
                    "session_type":     "review",
                    "review_interval":  interval,
                })
            # If day is full, silently skip this review repetition

    return plan_items
```

**Critical notes:**
- `exam.exam_date.date()` — the ORM field is a `DateTime`; `.date()` strips the time component for comparison.
- `json.loads(exam.available_days)` — `available_days` is stored as a JSON string in SQLite, never as a Python list directly.
- The algorithm is O(T × D) — acceptable for < 100 topics and < 365 days.
- Reviews are silently dropped when the day is full — this is intentional (no cascading overload).
- The returned dicts do NOT include `exam_id` — the router passes it to `bulk_create_plan(db, exam_id, items)`.

**acceptance_criteria:**
- `python -c "from app.core.scheduler import generate_plan; print('OK')"` exits 0.
- Calling `generate_plan` with a mock exam object whose `exam_date` is yesterday or today returns `[]`.
- Calling with a valid future `exam_date` and 2 topics returns a list of dicts each containing keys `exam_topic_id`, `scheduled_date`, `duration_minutes`, `session_type`, `review_interval`.
- `session_type` values are only `"first_study"` or `"review"`.
- `review_interval` is `None` for `"first_study"` items and an int in `[1,3,7,14,30]` for `"review"` items.

---

## Group 4 — Backend DTOs

### BE-04 — Add Scheduler DTOs to dtos.py

**file_path:** `backend/app/api/dtos.py`

**what_to_do:**

Append the following block at the end of `backend/app/api/dtos.py`. Do not modify any existing DTO.

```python
# ── Smart Scheduler ──────────────────────────────────────────────────────────

class ExamTopicCreate(BaseModel):
    name: str
    estimated_hours: float = 1.0
    priority: int = 2           # 1=High  2=Medium  3=Low
    subject_id: Optional[int] = None


class ExamCreate(BaseModel):
    name: str
    exam_date: datetime
    daily_hours: float
    available_days: list[int]   # e.g. [0,1,2,3,4]  (0=Mon … 6=Sun)
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
    """Lightweight exam row — used in list views. topic_count is NOT a column."""
    id: int
    name: str
    exam_date: datetime
    daily_hours: float
    available_days: str     # raw JSON string stored in DB
    created_at: datetime
    topic_count: int        # computed by router from len(exam.topics)

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
    topic_name: str             # NOT a DB column — manually set from item.topic.name

    class Config:
        from_attributes = True


class PlanItemUpdate(BaseModel):
    completed: Optional[bool] = None
```

**Critical notes:**
- `ExamSummary.topic_count` is **not** an ORM attribute. Pydantic `from_attributes=True` cannot populate it automatically. The router must build a plain `dict` (see BE-05) rather than returning the ORM object directly.
- `StudyPlanItemResponse.topic_name` is also not an ORM attribute. Same rule applies.
- `ExamCreate.available_days` is `list[int]` in the DTO — the router serializes it to JSON string before storing in DB.
- `datetime` is already imported at the top of `dtos.py`; `Optional` is already imported from `typing`.

**acceptance_criteria:**
- `python -c "from app.api.dtos import ExamCreate, ExamTopicCreate, ExamResponse, ExamSummary, StudyPlanItemResponse, PlanItemUpdate; print('OK')"` exits 0.
- Instantiating `ExamTopicCreate(name='Math', estimated_hours=2.0, priority=1)` succeeds.
- Instantiating `ExamCreate(name='ENEM', exam_date=datetime.now(), daily_hours=3.0, available_days=[0,1,2,3,4], topics=[])` succeeds.

---

## Group 5 — Backend Router

### BE-05 — Create app/api/routers/scheduler.py

**file_path:** `backend/app/api/routers/scheduler.py` *(new file)*

**what_to_do:**

Create the file with the following complete content. Follow the pattern from `pomodoro_sessions.py` exactly: `APIRouter`, `Depends(get_db)`, `Depends(get_current_user)`, ownership check via `exam.user_id != current_user.id`.

```python
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import scheduler_repo
from app.api.dependencies import get_current_user
from app.domain.models import User
from app.core.scheduler import generate_plan

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _exam_summary(exam) -> dict:
    """Build ExamSummary dict — includes topic_count which is NOT an ORM column."""
    return {
        "id":            exam.id,
        "name":          exam.name,
        "exam_date":     exam.exam_date,
        "daily_hours":   exam.daily_hours,
        "available_days": exam.available_days,
        "created_at":    exam.created_at,
        "topic_count":   len(exam.topics),
    }


def _plan_item_response(item) -> dict:
    """Build StudyPlanItemResponse dict — includes topic_name from joined relation."""
    return {
        "id":               item.id,
        "exam_id":          item.exam_id,
        "exam_topic_id":    item.exam_topic_id,
        "scheduled_date":   item.scheduled_date,
        "duration_minutes": item.duration_minutes,
        "session_type":     item.session_type,
        "review_interval":  item.review_interval,
        "completed":        item.completed,
        "topic_name":       item.topic.name,
    }


# ── POST /scheduler/exams ─────────────────────────────────────────────────────

@router.post("/exams", response_model=dtos.ExamResponse)
def create_exam(
    payload: dtos.ExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create exam + topics, run the scheduler, bulk-insert plan items."""
    # Validate that exam_date is in the future
    from datetime import date
    if payload.exam_date.date() <= date.today():
        raise HTTPException(status_code=422, detail="exam_date must be in the future")

    # 1. Persist Exam
    exam = scheduler_repo.create(db, {
        "user_id":        current_user.id,
        "name":           payload.name,
        "exam_date":      payload.exam_date,
        "daily_hours":    payload.daily_hours,
        "available_days": json.dumps(sorted(payload.available_days)),
    })

    # 2. Persist ExamTopics
    from app.domain.models import ExamTopic
    topics = []
    for t in payload.topics:
        topic = ExamTopic(
            exam_id=exam.id,
            name=t.name,
            estimated_hours=t.estimated_hours,
            priority=t.priority,
            subject_id=t.subject_id,
        )
        db.add(topic)
    db.commit()

    # Reload exam with topics eagerly loaded
    exam = scheduler_repo.get_with_topics(db, exam.id)

    # 3. Generate plan
    plan_dicts = generate_plan(exam, exam.topics)
    if not plan_dicts:
        raise HTTPException(
            status_code=422,
            detail="No available study days between today and exam_date. "
                   "Check available_days and exam_date.",
        )

    # 4. Bulk-insert plan items
    scheduler_repo.bulk_create_plan(db, exam.id, plan_dicts)

    # Reload exam with topics for response
    exam = scheduler_repo.get_with_topics(db, exam.id)
    return exam


# ── GET /scheduler/exams ──────────────────────────────────────────────────────

@router.get("/exams", response_model=list[dtos.ExamSummary])
def list_exams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all exams for the authenticated user."""
    exams = scheduler_repo.get_by_user(db, current_user.id)
    # Eagerly load topics for each exam to compute topic_count
    from sqlalchemy.orm import joinedload
    exams = (
        db.query(__import__("app.domain.models", fromlist=["Exam"]).Exam)
        .options(joinedload(__import__("app.domain.models", fromlist=["Exam"]).Exam.topics))
        .filter(__import__("app.domain.models", fromlist=["Exam"]).Exam.user_id == current_user.id)
        .all()
    )
    return [_exam_summary(e) for e in exams]


# ── DELETE /scheduler/exams/{exam_id} ────────────────────────────────────────

@router.delete("/exams/{exam_id}")
def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete exam and all cascade children (topics + plan items)."""
    exam = scheduler_repo.get(db, exam_id)
    if not exam or exam.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Exam not found")
    scheduler_repo.delete(db, exam_id)
    return {"message": f"Exam {exam_id} deleted"}


# ── GET /scheduler/exams/{exam_id}/plan ──────────────────────────────────────

@router.get("/exams/{exam_id}/plan", response_model=list[dtos.StudyPlanItemResponse])
def get_exam_plan(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all StudyPlanItems for one exam, ordered by date."""
    exam = scheduler_repo.get(db, exam_id)
    if not exam or exam.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Exam not found")
    items = scheduler_repo.get_plan(db, exam_id)
    return [_plan_item_response(i) for i in items]


# ── PATCH /scheduler/plan/items/{item_id} ────────────────────────────────────

@router.patch("/plan/items/{item_id}", response_model=dtos.StudyPlanItemResponse)
def toggle_plan_item(
    item_id: int,
    payload: dtos.PlanItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle the completed flag on a single plan item."""
    item = scheduler_repo.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Plan item not found")

    # Ownership check via parent exam
    exam = scheduler_repo.get(db, item.exam_id)
    if not exam or exam.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Plan item not found")

    if payload.completed is not None:
        # Re-fetch with topic join so topic_name is available in response
        from sqlalchemy.orm import joinedload
        from app.domain.models import StudyPlanItem
        item = scheduler_repo.toggle_item(db, item_id, payload.completed)
        item = (
            db.query(StudyPlanItem)
            .options(joinedload(StudyPlanItem.topic))
            .filter(StudyPlanItem.id == item_id)
            .first()
        )

    return _plan_item_response(item)


# ── POST /scheduler/exams/{exam_id}/regenerate ───────────────────────────────

@router.post("/exams/{exam_id}/regenerate", response_model=list[dtos.StudyPlanItemResponse])
def regenerate_plan(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete existing plan items and regenerate for the exam."""
    exam = scheduler_repo.get_with_topics(db, exam_id)
    if not exam or exam.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Exam not found")

    scheduler_repo.delete_plan(db, exam_id)

    plan_dicts = generate_plan(exam, exam.topics)
    if not plan_dicts:
        raise HTTPException(
            status_code=422,
            detail="No available study days between today and exam_date.",
        )

    items = scheduler_repo.bulk_create_plan(db, exam_id, plan_dicts)
    # Reload with topic join
    items = scheduler_repo.get_plan(db, exam_id)
    return [_plan_item_response(i) for i in items]
```

**Critical notes about `list_exams`:** The inline `__import__` idiom above is ugly. Replace it with a clean import at the top:

```python
# Add to imports at the top of scheduler.py:
from app.domain.models import User, Exam, ExamTopic, StudyPlanItem
```

Then rewrite `list_exams` as:

```python
@router.get("/exams", response_model=list[dtos.ExamSummary])
def list_exams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.orm import joinedload
    exams = (
        db.query(Exam)
        .options(joinedload(Exam.topics))
        .filter(Exam.user_id == current_user.id)
        .all()
    )
    return [_exam_summary(e) for e in exams]
```

**Use this cleaner version.** The file imports block should be:

```python
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import scheduler_repo
from app.api.dependencies import get_current_user
from app.domain.models import User, Exam, ExamTopic, StudyPlanItem
from app.core.scheduler import generate_plan
```

**acceptance_criteria:**
- `python -c "from app.api.routers.scheduler import router; print(len(router.routes), 'routes')"` prints `5 routes` (or more).
- `POST /api/scheduler/exams` with valid payload returns 200 and an `ExamResponse` JSON.
- `GET /api/scheduler/exams` returns `list[ExamSummary]` with `topic_count` populated.
- `DELETE /api/scheduler/exams/{id}` returns `{"message": "..."}` and removes rows from DB.
- `GET /api/scheduler/exams/{id}/plan` returns items sorted by `scheduled_date`.
- `PATCH /api/scheduler/plan/items/{id}` with `{"completed": true}` toggles and returns updated item.
- Unauthenticated requests return 401/403.
- `POST /api/scheduler/exams` with `exam_date = today` returns 422.

---

## Group 6 — Backend main.py

### BE-06 — Register scheduler router in main.py

**file_path:** `backend/app/main.py`

**what_to_do:**

1. Add `scheduler` to the import line (line 3):

```python
from app.api.routers import auth, tasks, pomodoro_sessions, settings, dashboard, scheduler
```

2. Add the include_router call after the last existing one (after `dashboard`):

```python
app.include_router(scheduler.router, prefix="/api")
```

That is all. Do not change anything else in `main.py`.

**acceptance_criteria:**
- `python -c "from app.main import app; routes = [r.path for r in app.routes]; print(any('/api/scheduler' in r for r in routes))"` prints `True`.
- `uvicorn app.main:app --reload` starts without import errors.
- `GET http://localhost:8000/api/scheduler/exams` returns 401 (requires auth, but the route exists).

---

## Group 7 — Frontend Types

### FE-01 — Add Scheduler TypeScript interfaces to types/index.ts

**file_path:** `frontend/src/types/index.ts`

**what_to_do:**

Append the following block at the end of `frontend/src/types/index.ts`. Do not modify any existing interface.

```typescript
// ── Smart Scheduler ──────────────────────────────────────────────────────────

export interface ExamTopicCreate {
  name: string;
  estimated_hours: number;
  priority: number;        // 1=High  2=Medium  3=Low
  subject_id?: number;
}

export interface ExamCreate {
  name: string;
  exam_date: string;         // ISO datetime string  e.g. "2026-11-01T00:00:00Z"
  daily_hours: number;
  available_days: number[];  // e.g. [0,1,2,3,4]  (0=Mon … 6=Sun)
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
  available_days: string;   // raw JSON string from DB e.g. "[0,1,2,3,4]"
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
  scheduled_date: string;   // ISO datetime string (UTC midnight)
  duration_minutes: number;
  session_type: 'first_study' | 'review';
  review_interval: number | null;
  completed: boolean;
  topic_name: string;
}
```

**Critical notes:**
- All date/time fields are `string` — backend sends ISO strings; do not use `Date` objects in interfaces (existing `types/index.ts` convention).
- `ExamSummary.available_days` is `string` (raw JSON from DB) — parse with `JSON.parse()` when needed in components.
- `ExamResponse extends ExamSummary` so it inherits `topic_count` and `available_days`.

**acceptance_criteria:**
- `npx tsc --noEmit` passes with no new errors.
- `import type { ExamSummary, ExamResponse, StudyPlanItemResponse, ExamCreate } from '../types'` compiles in any store/component file.

---

## Group 8 — Frontend Store

### FE-02 — Create frontend/src/store/schedulerStore.ts

**file_path:** `frontend/src/store/schedulerStore.ts` *(new file)*

**what_to_do:**

Create the file with the following complete content. Follows the `pomodoroStore.ts` pattern exactly.

```typescript
import { create } from 'zustand';
import api from '../api/client';
import type {
  ExamSummary,
  ExamResponse,
  StudyPlanItemResponse,
  ExamCreate,
} from '../types';

interface SchedulerState {
  exams: ExamSummary[];
  currentExam: ExamResponse | null;
  planItems: StudyPlanItemResponse[];
  isLoading: boolean;
  error: string | null;

  fetchExams: () => Promise<void>;
  fetchExam: (examId: number) => Promise<void>;
  createExam: (payload: ExamCreate) => Promise<void>;
  deleteExam: (examId: number) => Promise<void>;
  fetchPlan: (examId: number) => Promise<void>;
  toggleItem: (itemId: number, completed: boolean) => Promise<void>;
  regeneratePlan: (examId: number) => Promise<void>;
}

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  exams: [],
  currentExam: null,
  planItems: [],
  isLoading: false,
  error: null,

  fetchExams: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/scheduler/exams');
      set({ exams: res.data });
    } catch (err) {
      console.error('fetchExams failed', err);
      set({ error: 'Failed to load exams' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchExam: async (examId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/scheduler/exams/${examId}`);
      set({ currentExam: res.data });
    } catch (err) {
      console.error('fetchExam failed', err);
      set({ error: 'Failed to load exam' });
    } finally {
      set({ isLoading: false });
    }
  },

  createExam: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/scheduler/exams', payload);
      await get().fetchExams();
    } catch (err) {
      console.error('createExam failed', err);
      set({ error: 'Failed to create exam' });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteExam: async (examId) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/scheduler/exams/${examId}`);
      set((state) => ({
        exams: state.exams.filter((e) => e.id !== examId),
        currentExam: state.currentExam?.id === examId ? null : state.currentExam,
        planItems: state.currentExam?.id === examId ? [] : state.planItems,
      }));
    } catch (err) {
      console.error('deleteExam failed', err);
      set({ error: 'Failed to delete exam' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPlan: async (examId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/scheduler/exams/${examId}/plan`);
      set({ planItems: res.data });
    } catch (err) {
      console.error('fetchPlan failed', err);
      set({ error: 'Failed to load plan' });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleItem: async (itemId, completed) => {
    // Optimistic update
    set((state) => ({
      planItems: state.planItems.map((item) =>
        item.id === itemId ? { ...item, completed } : item
      ),
    }));
    try {
      await api.patch(`/scheduler/plan/items/${itemId}`, { completed });
    } catch (err) {
      console.error('toggleItem failed', err);
      // Revert optimistic update
      set((state) => ({
        planItems: state.planItems.map((item) =>
          item.id === itemId ? { ...item, completed: !completed } : item
        ),
      }));
    }
  },

  regeneratePlan: async (examId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post(`/scheduler/exams/${examId}/regenerate`);
      set({ planItems: res.data });
    } catch (err) {
      console.error('regeneratePlan failed', err);
      set({ error: 'Failed to regenerate plan' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
```

**Critical notes:**
- Auth token is handled automatically by the axios interceptor in `api/client.ts` — never access `localStorage` here.
- `toggleItem` uses optimistic update (sets `completed` locally before the API call) and reverts on error — this matches the "Mark item completed" tier in the Architectural Responsibility Map.
- All API paths are relative to the `/api` base URL configured in `api/client.ts`.
- Uses `console.error` (not silent catch) — matching `taskStore` pattern for easier debugging.

**acceptance_criteria:**
- `npx tsc --noEmit` passes with no new errors.
- `useSchedulerStore.getState().exams` is `[]` on initialization.
- All seven actions are present: `fetchExams`, `fetchExam`, `createExam`, `deleteExam`, `fetchPlan`, `toggleItem`, `regeneratePlan`.

---

## Group 9 — Frontend Components

### FE-03 — Create ExamForm component

**file_path:** `frontend/src/components/Scheduler/ExamForm/index.tsx` *(new file)*

**what_to_do:**

Create the directory `frontend/src/components/Scheduler/ExamForm/` and the file `index.tsx`.

This component renders a form to create a new exam. It manages all form state locally with `useState`. On submit it calls `useSchedulerStore.createExam(payload)`.

**Exact file content:**

```tsx
import React, { memo, useState } from 'react';
import { useSchedulerStore } from '../../../store/schedulerStore';
import type { ExamTopicCreate } from '../../../types';
import './styles.css';

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const defaultTopic = (): ExamTopicCreate => ({
  name: '',
  estimated_hours: 1,
  priority: 2,
});

const ExamForm: React.FC = () => {
  const { createExam, isLoading } = useSchedulerStore();

  const [name, setName]             = useState('');
  const [examDate, setExamDate]     = useState('');
  const [dailyHours, setDailyHours] = useState(2);
  const [availDays, setAvailDays]   = useState<number[]>([0, 1, 2, 3, 4]);
  const [topics, setTopics]         = useState<ExamTopicCreate[]>([defaultTopic()]);

  const toggleDay = (day: number) =>
    setAvailDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );

  const updateTopic = (idx: number, field: keyof ExamTopicCreate, value: string | number) =>
    setTopics((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t))
    );

  const addTopic = () => setTopics((prev) => [...prev, defaultTopic()]);

  const removeTopic = (idx: number) =>
    setTopics((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !examDate || availDays.length === 0 || topics.length === 0) return;

    await createExam({
      name,
      exam_date: new Date(examDate).toISOString(),
      daily_hours: dailyHours,
      available_days: availDays,
      topics,
    });
  };

  return (
    <form className="exam-form" onSubmit={handleSubmit}>
      <h2 className="exam-form__title">Novo Plano de Estudos</h2>

      <div className="exam-form__field">
        <label className="exam-form__label">Nome do concurso / prova</label>
        <input
          className="exam-form__input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: ENEM 2026"
          required
        />
      </div>

      <div className="exam-form__field">
        <label className="exam-form__label">Data da prova</label>
        <input
          className="exam-form__input"
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          required
        />
      </div>

      <div className="exam-form__field">
        <label className="exam-form__label">Horas de estudo por dia disponível</label>
        <input
          className="exam-form__input exam-form__input--short"
          type="number"
          min={0.5}
          max={12}
          step={0.5}
          value={dailyHours}
          onChange={(e) => setDailyHours(parseFloat(e.target.value))}
          required
        />
      </div>

      <div className="exam-form__field">
        <label className="exam-form__label">Dias disponíveis</label>
        <div className="exam-form__days">
          {DAY_LABELS.map((label, idx) => (
            <button
              key={idx}
              type="button"
              className={`exam-form__day-btn${availDays.includes(idx) ? ' exam-form__day-btn--active' : ''}`}
              onClick={() => toggleDay(idx)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="exam-form__field">
        <label className="exam-form__label">Tópicos</label>
        {topics.map((t, idx) => (
          <div key={idx} className="exam-form__topic-row">
            <input
              className="exam-form__input"
              type="text"
              placeholder="Nome do tópico"
              value={t.name}
              onChange={(e) => updateTopic(idx, 'name', e.target.value)}
              required
            />
            <input
              className="exam-form__input exam-form__input--short"
              type="number"
              min={0.5}
              max={20}
              step={0.5}
              title="Horas estimadas"
              value={t.estimated_hours}
              onChange={(e) => updateTopic(idx, 'estimated_hours', parseFloat(e.target.value))}
            />
            <select
              className="exam-form__select"
              value={t.priority}
              onChange={(e) => updateTopic(idx, 'priority', parseInt(e.target.value))}
            >
              <option value={1}>Alta</option>
              <option value={2}>Média</option>
              <option value={3}>Baixa</option>
            </select>
            {topics.length > 1 && (
              <button
                type="button"
                className="exam-form__remove-btn"
                onClick={() => removeTopic(idx)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" className="exam-form__add-topic-btn" onClick={addTopic}>
          + Adicionar tópico
        </button>
      </div>

      <button className="exam-form__submit" type="submit" disabled={isLoading}>
        {isLoading ? 'Gerando plano...' : 'Gerar Plano de Estudos'}
      </button>
    </form>
  );
};

export default memo(ExamForm);
```

Also create `frontend/src/components/Scheduler/ExamForm/styles.css`:

```css
.exam-form {
  max-width: 640px;
  margin: 0 auto;
  padding: 1.5rem;
  background: var(--pomo-surface-alt, rgba(0,0,0,0.04));
  border: 1px solid var(--pomo-border, rgba(0,0,0,0.12));
  border-radius: 12px;
}

.exam-form__title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
  color: var(--pomo-text, #1a1a2e);
}

.exam-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.exam-form__label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
  color: var(--pomo-text, #1a1a2e);
}

.exam-form__input {
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--pomo-border, rgba(0,0,0,0.18));
  border-radius: 6px;
  background: var(--pomo-surface, #fff);
  color: var(--pomo-text, #1a1a2e);
  font-size: 0.9rem;
}

.exam-form__input--short {
  max-width: 100px;
}

.exam-form__select {
  padding: 0.45rem 0.5rem;
  border: 1px solid var(--pomo-border, rgba(0,0,0,0.18));
  border-radius: 6px;
  background: var(--pomo-surface, #fff);
  color: var(--pomo-text, #1a1a2e);
  font-size: 0.85rem;
}

.exam-form__days {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.exam-form__day-btn {
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--pomo-border, rgba(0,0,0,0.18));
  border-radius: 20px;
  background: transparent;
  color: var(--pomo-text, #1a1a2e);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}

.exam-form__day-btn--active {
  background: var(--pomo-accent, #e53e3e);
  color: #fff;
  border-color: transparent;
}

.exam-form__topic-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.4rem;
  flex-wrap: wrap;
}

.exam-form__remove-btn {
  background: transparent;
  border: none;
  color: var(--pomo-text, #1a1a2e);
  opacity: 0.4;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.2rem 0.4rem;
}

.exam-form__remove-btn:hover { opacity: 0.8; }

.exam-form__add-topic-btn {
  background: transparent;
  border: 1px dashed var(--pomo-border, rgba(0,0,0,0.25));
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  font-size: 0.82rem;
  color: var(--pomo-text, #1a1a2e);
  cursor: pointer;
  margin-top: 0.3rem;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.exam-form__add-topic-btn:hover { opacity: 1; }

.exam-form__submit {
  width: 100%;
  margin-top: 1.25rem;
  padding: 0.6rem 1rem;
  background: var(--pomo-accent, #e53e3e);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.exam-form__submit:disabled { opacity: 0.5; cursor: not-allowed; }
```

**acceptance_criteria:**
- `npx tsc --noEmit` passes.
- Form renders without runtime errors.
- Submitting the form with valid data calls `createExam` with correct payload shape (`exam_date` is ISO string, `available_days` is `number[]`).
- Day buttons toggle correctly; removing a topic removes only that row; "Gerar Plano" is disabled during `isLoading`.

---

### FE-04 — Create ExamList component

**file_path:** `frontend/src/components/Scheduler/ExamList/index.tsx` *(new file)*

**what_to_do:**

Create the directory and files.

```tsx
// frontend/src/components/Scheduler/ExamList/index.tsx
import React, { memo } from 'react';
import type { ExamSummary } from '../../../types';
import './styles.css';

interface Props {
  exams: ExamSummary[];
  selectedExamId: number | null;
  onSelect: (examId: number) => void;
  onDelete: (examId: number) => void;
}

const ExamList: React.FC<Props> = ({ exams, selectedExamId, onSelect, onDelete }) => {
  if (exams.length === 0) {
    return <p className="exam-list__empty">Nenhum plano criado ainda.</p>;
  }

  return (
    <ul className="exam-list">
      {exams.map((exam) => {
        const daysLeft = Math.ceil(
          (new Date(exam.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return (
          <li
            key={exam.id}
            className={`exam-list__item${exam.id === selectedExamId ? ' exam-list__item--active' : ''}`}
          >
            <div className="exam-list__info" onClick={() => onSelect(exam.id)}>
              <span className="exam-list__name">{exam.name}</span>
              <span className="exam-list__meta">
                {exam.topic_count} tópico{exam.topic_count !== 1 ? 's' : ''} · {daysLeft > 0 ? `${daysLeft} dias` : 'passado'}
              </span>
            </div>
            <div className="exam-list__actions">
              <button
                className="exam-list__btn exam-list__btn--view"
                onClick={() => onSelect(exam.id)}
                title="Ver plano"
              >
                📅
              </button>
              <button
                className="exam-list__btn exam-list__btn--delete"
                onClick={() => onDelete(exam.id)}
                title="Excluir"
              >
                🗑
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default memo(ExamList);
```

```css
/* frontend/src/components/Scheduler/ExamList/styles.css */
.exam-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.exam-list__empty {
  opacity: 0.5;
  font-size: 0.9rem;
  text-align: center;
  padding: 1rem 0;
}

.exam-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--pomo-border, rgba(0,0,0,0.12));
  border-radius: 8px;
  background: var(--pomo-surface, #fff);
  transition: border-color 0.15s;
}

.exam-list__item--active {
  border-color: var(--pomo-accent, #e53e3e);
}

.exam-list__info {
  cursor: pointer;
  flex: 1;
}

.exam-list__name {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--pomo-text, #1a1a2e);
}

.exam-list__meta {
  display: block;
  font-size: 0.72rem;
  opacity: 0.55;
  margin-top: 0.1rem;
}

.exam-list__actions {
  display: flex;
  gap: 0.3rem;
}

.exam-list__btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.2rem 0.3rem;
  border-radius: 4px;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.exam-list__btn:hover { opacity: 1; }
```

**acceptance_criteria:**
- `npx tsc --noEmit` passes.
- Renders a list of exam rows, each showing name, topic count, days remaining.
- Clicking info area or 📅 calls `onSelect`.
- Clicking 🗑 calls `onDelete`.
- Active exam row has accent border.

---

### FE-05 — Create WeeklyView component

**file_path:** `frontend/src/components/Scheduler/WeeklyView/index.tsx` *(new file)*

**what_to_do:**

Create the directory and files. The component receives `planItems: StudyPlanItemResponse[]` and renders a 7-column CSS grid showing items per day for the current week, with prev/next navigation.

```tsx
// frontend/src/components/Scheduler/WeeklyView/index.tsx
import React, { memo, useState } from 'react';
import type { StudyPlanItemResponse } from '../../../types';
import './styles.css';

interface Props {
  planItems: StudyPlanItemResponse[];
  onSelectDay: (date: string) => void;    // ISO date string "YYYY-MM-DD"
  selectedDay: string | null;
  onToggleItem: (itemId: number, completed: boolean) => void;
}

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Return the ISO date string "YYYY-MM-DD" for a Date object. */
const toDateStr = (d: Date): string => d.toISOString().slice(0, 10);

/** Return the Monday of the week containing `d`. */
const getMonday = (d: Date): Date => {
  const day  = d.getDay();                       // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;        // shift to Monday
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
};

const WeeklyView: React.FC<Props> = ({ planItems, onSelectDay, selectedDay, onToggleItem }) => {
  const [weekOffset, setWeekOffset] = useState(0);  // 0 = current week

  const baseMonday = getMonday(new Date());
  baseMonday.setDate(baseMonday.getDate() + weekOffset * 7);

  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseMonday);
    d.setDate(baseMonday.getDate() + i);
    return d;
  });

  // Group planItems by date string
  const itemsByDate: Record<string, StudyPlanItemResponse[]> = {};
  for (const item of planItems) {
    const key = item.scheduled_date.slice(0, 10);
    if (!itemsByDate[key]) itemsByDate[key] = [];
    itemsByDate[key].push(item);
  }

  const weekLabel = `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <div className="weekly-view">
      <div className="weekly-view__nav">
        <button className="weekly-view__nav-btn" onClick={() => setWeekOffset((o) => o - 1)}>‹</button>
        <span className="weekly-view__week-label">{weekLabel}</span>
        <button className="weekly-view__nav-btn" onClick={() => setWeekOffset((o) => o + 1)}>›</button>
      </div>

      <div className="weekly-view__grid">
        {weekDays.map((day, idx) => {
          const dateStr  = toDateStr(day);
          const items    = itemsByDate[dateStr] || [];
          const isToday  = dateStr === toDateStr(new Date());
          const isSelected = dateStr === selectedDay;
          const totalMin = items.reduce((s, i) => s + i.duration_minutes, 0);

          return (
            <div
              key={idx}
              className={[
                'weekly-view__day',
                isToday    ? 'weekly-view__day--today'    : '',
                isSelected ? 'weekly-view__day--selected' : '',
              ].join(' ').trim()}
              onClick={() => onSelectDay(dateStr)}
            >
              <div className="weekly-view__day-header">
                <span className="weekly-view__day-name">{DAY_NAMES[idx]}</span>
                <span className="weekly-view__day-date">{day.getDate()}</span>
              </div>

              {items.length > 0 && (
                <div className="weekly-view__day-total">{totalMin} min</div>
              )}

              <ul className="weekly-view__items">
                {items.slice(0, 3).map((item) => (
                  <li
                    key={item.id}
                    className={`weekly-view__item weekly-view__item--${item.session_type}${item.completed ? ' weekly-view__item--done' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggleItem(item.id, !item.completed); }}
                    title={`${item.topic_name} · ${item.duration_minutes} min`}
                  >
                    {item.topic_name.slice(0, 10)}
                  </li>
                ))}
                {items.length > 3 && (
                  <li className="weekly-view__item-more">+{items.length - 3}</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(WeeklyView);
```

```css
/* frontend/src/components/Scheduler/WeeklyView/styles.css */
.weekly-view {
  width: 100%;
}

.weekly-view__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.weekly-view__nav-btn {
  background: transparent;
  border: 1px solid var(--pomo-border, rgba(0,0,0,0.15));
  border-radius: 50%;
  width: 28px;
  height: 28px;
  font-size: 1rem;
  cursor: pointer;
  color: var(--pomo-text, #1a1a2e);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.weekly-view__nav-btn:hover {
  background: var(--pomo-surface-alt, rgba(0,0,0,0.06));
}

.weekly-view__week-label {
  font-size: 0.82rem;
  opacity: 0.65;
  color: var(--pomo-text, #1a1a2e);
}

.weekly-view__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.4rem;
}

.weekly-view__day {
  min-height: 110px;
  padding: 0.45rem 0.4rem;
  border: 1px solid var(--pomo-border, rgba(0,0,0,0.1));
  border-radius: 8px;
  background: var(--pomo-surface, #fff);
  cursor: pointer;
  transition: border-color 0.15s;
}

.weekly-view__day:hover { border-color: var(--pomo-accent, #e53e3e); }

.weekly-view__day--today { background: var(--pomo-surface-alt, rgba(0,0,0,0.04)); }

.weekly-view__day--selected { border-color: var(--pomo-accent, #e53e3e); }

.weekly-view__day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3rem;
}

.weekly-view__day-name {
  font-size: 0.68rem;
  text-transform: uppercase;
  opacity: 0.5;
  color: var(--pomo-text, #1a1a2e);
}

.weekly-view__day-date {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--pomo-text, #1a1a2e);
}

.weekly-view__day-total {
  font-size: 0.65rem;
  opacity: 0.5;
  margin-bottom: 0.25rem;
  color: var(--pomo-text, #1a1a2e);
}

.weekly-view__items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.weekly-view__item {
  font-size: 0.65rem;
  padding: 2px 4px;
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  color: #fff;
}

.weekly-view__item--first_study { background: var(--pomo-accent, #e53e3e); }
.weekly-view__item--review       { background: #3182ce; }
.weekly-view__item--done         { opacity: 0.45; text-decoration: line-through; }

.weekly-view__item-more {
  font-size: 0.62rem;
  opacity: 0.5;
  color: var(--pomo-text, #1a1a2e);
}
```

**acceptance_criteria:**
- `npx tsc --noEmit` passes.
- Renders a 7-column grid; each column shows day name + date number.
- Items with `session_type === "first_study"` render with accent color; `"review"` items render blue.
- Clicking prev/next arrows changes the displayed week.
- Clicking a day column calls `onSelectDay` with the ISO date string.
- Completed items show strikethrough + reduced opacity.

---

### FE-06 — Create DailyList and PlanItem components

**file_paths:**
- `frontend/src/components/Scheduler/DailyList/index.tsx` *(new)*
- `frontend/src/components/Scheduler/DailyList/styles.css` *(new)*
- `frontend/src/components/Scheduler/PlanItem/index.tsx` *(new)*
- `frontend/src/components/Scheduler/PlanItem/styles.css` *(new)*

**what_to_do:**

**PlanItem** — renders a single study plan item card:

```tsx
// frontend/src/components/Scheduler/PlanItem/index.tsx
import React, { memo } from 'react';
import type { StudyPlanItemResponse } from '../../../types';
import './styles.css';

interface Props {
  item: StudyPlanItemResponse;
  onToggle: (id: number, completed: boolean) => void;
}

const SESSION_LABELS: Record<string, string> = {
  first_study: 'Estudo',
  review:      'Revisão',
};

const PlanItem: React.FC<Props> = ({ item, onToggle }) => (
  <div className={`plan-item${item.completed ? ' plan-item--done' : ''}`}>
    <input
      className="plan-item__check"
      type="checkbox"
      checked={item.completed}
      onChange={() => onToggle(item.id, !item.completed)}
    />
    <div className="plan-item__body">
      <span className="plan-item__topic">{item.topic_name}</span>
      <span className="plan-item__meta">{item.duration_minutes} min</span>
    </div>
    <span className={`plan-item__badge plan-item__badge--${item.session_type}`}>
      {SESSION_LABELS[item.session_type] ?? item.session_type}
    </span>
  </div>
);

export default memo(PlanItem);
```

```css
/* frontend/src/components/Scheduler/PlanItem/styles.css */
.plan-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--pomo-border, rgba(0,0,0,0.1));
  border-radius: 8px;
  background: var(--pomo-surface, #fff);
  transition: opacity 0.15s;
}

.plan-item--done { opacity: 0.45; }

.plan-item__check {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--pomo-accent, #e53e3e);
  flex-shrink: 0;
}

.plan-item__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.plan-item__topic {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--pomo-text, #1a1a2e);
}

.plan-item__meta {
  font-size: 0.7rem;
  opacity: 0.5;
  color: var(--pomo-text, #1a1a2e);
}

.plan-item__badge {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border-radius: 10px;
  color: #fff;
  flex-shrink: 0;
}

.plan-item__badge--first_study { background: var(--pomo-accent, #e53e3e); }
.plan-item__badge--review       { background: #3182ce; }
```

**DailyList** — renders all plan items for a selected date:

```tsx
// frontend/src/components/Scheduler/DailyList/index.tsx
import React, { memo } from 'react';
import type { StudyPlanItemResponse } from '../../../types';
import PlanItem from '../PlanItem';
import './styles.css';

interface Props {
  date: string | null;                // "YYYY-MM-DD"
  items: StudyPlanItemResponse[];
  onToggle: (id: number, completed: boolean) => void;
}

const DailyList: React.FC<Props> = ({ date, items, onToggle }) => {
  const dayItems = date
    ? items.filter((i) => i.scheduled_date.slice(0, 10) === date)
    : [];

  const totalMin  = dayItems.reduce((s, i) => s + i.duration_minutes, 0);
  const doneCount = dayItems.filter((i) => i.completed).length;

  const formattedDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      })
    : '';

  return (
    <div className="daily-list">
      {date && (
        <div className="daily-list__header">
          <span className="daily-list__date">{formattedDate}</span>
          {dayItems.length > 0 && (
            <span className="daily-list__summary">
              {doneCount}/{dayItems.length} · {totalMin} min
            </span>
          )}
        </div>
      )}

      {dayItems.length === 0 ? (
        <p className="daily-list__empty">
          {date ? 'Sem sessões neste dia.' : 'Selecione um dia no calendário.'}
        </p>
      ) : (
        <ul className="daily-list__items">
          {dayItems.map((item) => (
            <li key={item.id}>
              <PlanItem item={item} onToggle={onToggle} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default memo(DailyList);
```

```css
/* frontend/src/components/Scheduler/DailyList/styles.css */
.daily-list {
  padding: 0.75rem 0;
}

.daily-list__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.65rem;
}

.daily-list__date {
  font-size: 0.88rem;
  font-weight: 600;
  text-transform: capitalize;
  color: var(--pomo-text, #1a1a2e);
}

.daily-list__summary {
  font-size: 0.72rem;
  opacity: 0.5;
  color: var(--pomo-text, #1a1a2e);
}

.daily-list__empty {
  font-size: 0.85rem;
  opacity: 0.45;
  text-align: center;
  padding: 1.5rem 0;
}

.daily-list__items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
```

**acceptance_criteria:**
- `npx tsc --noEmit` passes.
- `PlanItem` renders topic name, duration, session badge, and a checkbox.
- Clicking checkbox calls `onToggle(item.id, !item.completed)`.
- `DailyList` filters `items` to only show the selected date.
- Empty state message is shown when no items exist for the selected date.

---

## Group 10 — Frontend Routing

### FE-07 — Create Scheduler container and CSS

**file_paths:**
- `frontend/src/containers/Scheduler.tsx` *(new)*
- `frontend/src/containers/Scheduler.css` *(new)*

**what_to_do:**

```tsx
// frontend/src/containers/Scheduler.tsx
import React, { memo, useEffect, useState } from 'react';
import { useSchedulerStore } from '../store/schedulerStore';
import ExamForm from '../components/Scheduler/ExamForm';
import ExamList from '../components/Scheduler/ExamList';
import WeeklyView from '../components/Scheduler/WeeklyView';
import DailyList from '../components/Scheduler/DailyList';
import './Scheduler.css';

const Scheduler: React.FC = () => {
  const {
    exams,
    planItems,
    isLoading,
    fetchExams,
    deleteExam,
    fetchPlan,
    toggleItem,
  } = useSchedulerStore();

  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedDay,    setSelectedDay]     = useState<string | null>(null);
  const [showForm,       setShowForm]        = useState(false);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleSelectExam = async (examId: number) => {
    setSelectedExamId(examId);
    setSelectedDay(null);
    await fetchPlan(examId);
  };

  const handleDeleteExam = async (examId: number) => {
    if (!window.confirm('Excluir este plano de estudos?')) return;
    await deleteExam(examId);
    if (selectedExamId === examId) {
      setSelectedExamId(null);
      setSelectedDay(null);
    }
  };

  return (
    <div className="scheduler">
      <header className="scheduler__header">
        <h1 className="scheduler__title">📅 Planejador de Estudos</h1>
        <button
          className="scheduler__new-btn"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? '✕ Fechar' : '+ Novo Plano'}
        </button>
      </header>

      {showForm && (
        <div className="scheduler__form-wrapper">
          <ExamForm />
        </div>
      )}

      {isLoading && exams.length === 0 ? (
        <p className="scheduler__loading">Carregando...</p>
      ) : (
        <div className="scheduler__body">
          <aside className="scheduler__sidebar">
            <ExamList
              exams={exams}
              selectedExamId={selectedExamId}
              onSelect={handleSelectExam}
              onDelete={handleDeleteExam}
            />
          </aside>

          {selectedExamId !== null && (
            <section className="scheduler__plan">
              <WeeklyView
                planItems={planItems}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onToggleItem={(id, completed) => toggleItem(id, completed)}
              />
              <DailyList
                date={selectedDay}
                items={planItems}
                onToggle={(id, completed) => toggleItem(id, completed)}
              />
            </section>
          )}

          {exams.length === 0 && !showForm && (
            <div className="scheduler__onboarding">
              <p>Você ainda não tem nenhum plano.</p>
              <button
                className="scheduler__new-btn"
                onClick={() => setShowForm(true)}
              >
                + Criar primeiro plano
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(Scheduler);
```

```css
/* frontend/src/containers/Scheduler.css */
.scheduler {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.25rem 1rem 2rem;
  color: var(--pomo-text, #1a1a2e);
}

.scheduler__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.scheduler__title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.scheduler__new-btn {
  background: var(--pomo-accent, #e53e3e);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 1rem;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.scheduler__new-btn:hover { opacity: 0.85; }

.scheduler__form-wrapper {
  margin-bottom: 1.25rem;
}

.scheduler__loading {
  text-align: center;
  opacity: 0.5;
  padding: 2rem 0;
}

.scheduler__body {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 1.25rem;
  align-items: start;
}

@media (max-width: 768px) {
  .scheduler__body {
    grid-template-columns: 1fr;
  }
}

.scheduler__sidebar {
  /* sticky sidebar */
  position: sticky;
  top: 1rem;
}

.scheduler__plan {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.scheduler__onboarding {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
  opacity: 0.6;
  font-size: 0.95rem;
}

.scheduler__onboarding .scheduler__new-btn {
  margin-top: 0.75rem;
}
```

**acceptance_criteria:**
- `npx tsc --noEmit` passes.
- Container renders without errors.
- On mount, `fetchExams` is called.
- When no exams exist and form is closed, the onboarding prompt is shown.
- Selecting an exam in `ExamList` triggers `fetchPlan` and renders `WeeklyView` + `DailyList`.
- Delete confirmation dialog appears before `deleteExam` is called.
- "+ Novo Plano" button toggles `ExamForm` visibility.

---

### FE-08 — Add /scheduler route and 📅 nav button

**file_paths:**
- `frontend/src/index.tsx` *(modify)*
- `frontend/src/containers/Pomodoro.tsx` *(modify)*

**what_to_do:**

**1. `frontend/src/index.tsx`** — add the Scheduler import and route:

```tsx
// Add after the Dashboard import line:
import Scheduler from './containers/Scheduler';

// Inside <Routes>, after <Route path="/dashboard" ...>:
<Route path="/scheduler" element={<Scheduler />} />
```

The resulting Routes block should be:

```tsx
<Routes>
  <Route path="/"          element={<Pomodoro />}   />
  <Route path="/dashboard" element={<Dashboard />}  />
  <Route path="/scheduler" element={<Scheduler />}  />
</Routes>
```

**2. `frontend/src/containers/Pomodoro.tsx`** — add the 📅 nav button after the 📊 button:

Find the `<button>` that navigates to `/dashboard` (currently at line ~149-155). Insert this new button immediately after its closing `</button>` tag:

```tsx
<button
  className="icon-btn"
  onClick={() => navigate('/scheduler')}
  title="Planejador de Estudos"
>
  📅
</button>
```

The `navigate` function is already declared on line 32 (`const navigate = useNavigate();`) — no additional import needed.

**acceptance_criteria:**
- `npx tsc --noEmit` passes.
- Visiting `http://localhost:5173/scheduler` renders the Scheduler page (no 404).
- The Pomodoro header shows 📅 button after 📊; clicking it navigates to `/scheduler`.
- Browser back/forward works correctly between `/`, `/dashboard`, `/scheduler`.

---

## Execution Notes

### Order of implementation
Follow the group order: BE-01 → BE-02 → BE-03 → BE-04 → BE-05 → BE-06 → FE-01 → FE-02 → FE-03 → FE-04 → FE-05 → FE-06 → FE-07 → FE-08.

Backend tasks (BE-01 through BE-06) can be verified by restarting the uvicorn dev server and running each acceptance_criteria command.

Frontend tasks (FE-01 through FE-08) should be verified by running `npx tsc --noEmit` after each task, then doing a full `npm run dev` UI smoke-test after FE-08.

### Pitfalls to remember (from research)
1. `cascade="all, delete-orphan"` required on Exam → topics and Exam → plan_items.
2. `available_days` must be `json.dumps(sorted(days))` on write and `json.loads()` on read.
3. `topic_count` in ExamSummary and `topic_name` in StudyPlanItemResponse are NOT ORM columns — always build response dicts manually.
4. All plan queries must use `joinedload(StudyPlanItem.topic)` to avoid N+1 and populate `topic_name`.
5. Do not activate the ghost `Schedule` model or `Subject.schedules` — no changes to those.
6. Algorithm returns `[]` when exam_date is not in the future — router raises HTTP 422 in that case.
