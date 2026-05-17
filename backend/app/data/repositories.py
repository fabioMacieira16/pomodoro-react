from typing import Generic, TypeVar, Type, Any
from sqlalchemy.orm import Session
from app.data.database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: Any) -> ModelType | None:
        return db.query(self.model).filter(self.model.id == id).first()

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> list[ModelType]:
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, obj_in: dict) -> ModelType:
        db_obj = self.model(**obj_in)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: ModelType, obj_in: dict) -> ModelType:
        for field in obj_in:
            if hasattr(db_obj, field):
                setattr(db_obj, field, obj_in[field])
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, id: Any) -> ModelType | None:
        obj = db.query(self.model).get(id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj

from app.domain.models import User, Task, PomodoroSession, Setting, AnkiDeck, Flashcard, FlashcardOption, FlashcardReview

class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)
        
    def get_by_username(self, db: Session, username: str) -> User | None:
        return db.query(self.model).filter(self.model.username == username).first()

class TaskRepository(BaseRepository[Task]):
    def __init__(self):
        super().__init__(Task)

    def get_by_user(self, db: Session, user_id: int) -> list[Task]:
        return db.query(self.model).filter(self.model.user_id == user_id).order_by(self.model.position).all()

class PomodoroSessionRepository(BaseRepository[PomodoroSession]):
    def __init__(self):
        super().__init__(PomodoroSession)

    def get_by_user(self, db: Session, user_id: int, limit: int = 50) -> list[PomodoroSession]:
        return (
            db.query(self.model)
            .filter(self.model.user_id == user_id)
            .order_by(self.model.start_time.desc())
            .limit(limit)
            .all()
        )

    def get_stats(self, db: Session, user_id: int) -> dict:
        from datetime import date
        from sqlalchemy import func
        today = date.today()
        start_date_expr = func.date(self.model.start_time)
        today_count = (
            db.query(func.count(self.model.id))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                start_date_expr == today.isoformat(),
            )
            .scalar()
        ) or 0
        total_minutes = (
            db.query(func.sum(self.model.duration_minutes))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
            )
            .scalar()
        ) or 0
        total_sessions = (
            db.query(func.count(self.model.id))
            .filter(self.model.user_id == user_id, self.model.completed == True)
            .scalar()
        ) or 0
        return {
            "today_pomodoros": today_count,
            "total_focus_minutes": total_minutes,
            "total_sessions": total_sessions,
        }

    def get_dashboard_data(self, db: Session, user_id: int) -> dict:
        from datetime import date, timedelta
        from sqlalchemy import func

        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        cutoff_heatmap = today - timedelta(days=83)
        cutoff_30 = today - timedelta(days=29)
        start_date_expr = func.date(self.model.start_time)

        today_minutes = (
            db.query(func.sum(self.model.duration_minutes))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                start_date_expr == today.isoformat(),
            )
            .scalar()
        ) or 0

        week_minutes = (
            db.query(func.sum(self.model.duration_minutes))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                start_date_expr >= week_start.isoformat(),
            )
            .scalar()
        ) or 0

        all_minutes = (
            db.query(func.sum(self.model.duration_minutes))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
            )
            .scalar()
        ) or 0

        heatmap_rows = (
            db.query(
                start_date_expr.label("day"),
                func.count(self.model.id).label("count"),
            )
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                start_date_expr >= cutoff_heatmap.isoformat(),
            )
            .group_by(start_date_expr)
            .order_by(start_date_expr)
            .all()
        )
        heatmap = [{"date": str(row.day), "count": row.count} for row in heatmap_rows]

        day_labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
        weekly_rows = (
            db.query(
                start_date_expr.label("day"),
                func.count(self.model.id).label("pomodoros"),
                func.sum(self.model.duration_minutes).label("focus_minutes"),
            )
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                start_date_expr >= (today - timedelta(days=6)).isoformat(),
            )
            .group_by(start_date_expr)
            .order_by(start_date_expr)
            .all()
        )
        weekly_map = {str(row.day): row for row in weekly_rows}
        weekly_evolution = []
        for i in range(7):
            d = today - timedelta(days=6 - i)
            key = str(d)
            row = weekly_map.get(key)
            weekly_evolution.append({
                "day": key,
                "day_label": day_labels[d.weekday()],
                "pomodoros": row.pomodoros if row else 0,
                "focus_minutes": int(row.focus_minutes) if row else 0,
            })

        all_days = (
            db.query(start_date_expr.label("day"))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
            )
            .group_by(start_date_expr)
            .order_by(start_date_expr.desc())
            .all()
        )
        streak = 0
        if all_days:
            cursor = today
            for row in all_days:
                day = row.day if isinstance(row.day, date) else date.fromisoformat(str(row.day))
                if day == cursor or day == cursor - timedelta(days=1):
                    streak += 1
                    cursor = day - timedelta(days=1)
                elif day < cursor:
                    break

        distinct_days_30 = (
            db.query(func.count(func.distinct(start_date_expr)))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                start_date_expr >= cutoff_30.isoformat(),
            )
            .scalar()
        ) or 0
        consistency_pct = round((distinct_days_30 / 30) * 100, 1)

        avg_rating = (
            db.query(func.avg(self.model.productivity_rating))
            .filter(
                self.model.user_id == user_id,
                self.model.productivity_rating.isnot(None),
            )
            .scalar()
        )
        efficiency_pct = round((float(avg_rating) / 5 * 100), 1) if avg_rating else 0.0

        from app.domain.models import Subject
        subject_row = (
            db.query(
                Subject.name,
                func.sum(self.model.duration_minutes).label("total_minutes"),
            )
            .join(Subject, self.model.subject_id == Subject.id)
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                self.model.subject_id.isnot(None),
            )
            .group_by(Subject.id, Subject.name)
            .order_by(func.sum(self.model.duration_minutes).desc())
            .first()
        )

        return {
            "stats": {
                "hours_studied_today": round(today_minutes / 60, 2),
                "hours_studied_week": round(week_minutes / 60, 2),
                "hours_studied_all": round(all_minutes / 60, 2),
                "current_streak": streak,
                "consistency_pct": consistency_pct,
                "efficiency_pct": efficiency_pct,
                "weekly_focus_minutes": week_minutes,
                "weekly_goal_minutes": 1500,
                "most_studied_subject": subject_row.name if subject_row else None,
                "most_studied_subject_minutes": int(subject_row.total_minutes) if subject_row else None,
            },
            "heatmap": heatmap,
            "weekly_evolution": weekly_evolution,
        }

class SettingRepository(BaseRepository[Setting]):
    def __init__(self):
        super().__init__(Setting)

    def get_by_user(self, db: Session, user_id: int) -> Setting | None:
        return db.query(self.model).filter(self.model.user_id == user_id).first()

    def get_or_create(self, db: Session, user_id: int) -> Setting:
        setting = self.get_by_user(db, user_id)
        if not setting:
            setting = self.create(db, {"user_id": user_id})
        return setting

user_repo = UserRepository()
task_repo = TaskRepository()
pomodoro_repo = PomodoroSessionRepository()
setting_repo = SettingRepository()


from app.domain.models import Exam, ExamTopic, StudyPlanItem


class SchedulerRepository(BaseRepository[Exam]):
    def __init__(self):
        super().__init__(Exam)

    def get_by_user(self, db: Session, user_id: int) -> list[Exam]:
        from sqlalchemy.orm import joinedload
        return (
            db.query(Exam)
            .options(joinedload(Exam.topics))
            .filter(Exam.user_id == user_id)
            .all()
        )

    def get_with_topics(self, db: Session, exam_id: int) -> Exam | None:
        from sqlalchemy.orm import joinedload
        return (
            db.query(Exam)
            .options(joinedload(Exam.topics))
            .filter(Exam.id == exam_id)
            .first()
        )

    def get_plan(self, db: Session, exam_id: int) -> list[StudyPlanItem]:
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

    def get_item(self, db: Session, item_id: int) -> StudyPlanItem | None:
        return db.query(StudyPlanItem).filter(StudyPlanItem.id == item_id).first()

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

    def toggle_item(self, db: Session, item_id: int, completed: bool) -> StudyPlanItem | None:
        item = self.get_item(db, item_id)
        if item:
            item.completed = completed
            db.commit()
            db.refresh(item)
        return item


scheduler_repo = SchedulerRepository()


# ── Anki Repositories ─────────────────────────────────────────────────────────────

class AnkiDeckRepository(BaseRepository[AnkiDeck]):
    def __init__(self):
        super().__init__(AnkiDeck)

    def get_by_user(self, db: Session, user_id: int) -> list[AnkiDeck]:
        return db.query(self.model).filter(self.model.user_id == user_id).order_by(self.model.name).all()

    def get_root_decks(self, db: Session, user_id: int) -> list[AnkiDeck]:
        """Return top-level decks (no parent)."""
        return (
            db.query(self.model)
            .filter(self.model.user_id == user_id, self.model.parent_deck_id.is_(None))
            .order_by(self.model.name)
            .all()
        )

    def get_with_counts(self, db: Session, deck: AnkiDeck) -> dict:
        from datetime import datetime, timezone
        from sqlalchemy import func
        now = datetime.now(timezone.utc)
        total = db.query(func.count(Flashcard.id)).filter(Flashcard.deck_id == deck.id).scalar() or 0
        due = (
            db.query(func.count(Flashcard.id))
            .filter(Flashcard.deck_id == deck.id, Flashcard.next_review <= now)
            .scalar()
        ) or 0
        new = db.query(func.count(Flashcard.id)).filter(Flashcard.deck_id == deck.id, Flashcard.next_review.is_(None)).scalar() or 0
        return {"card_count": total, "due_count": due, "new_count": new}


class FlashcardRepository(BaseRepository[Flashcard]):
    def __init__(self):
        super().__init__(Flashcard)

    def get_by_deck(self, db: Session, deck_id: int) -> list[Flashcard]:
        return db.query(self.model).filter(self.model.deck_id == deck_id).order_by(self.model.created_at).all()

    def get_review_queue(self, db: Session, deck_id: int, limit: int = 50) -> list[Flashcard]:
        """Return cards due now (next_review <= now) + new cards (next_review is None)."""
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        due = (
            db.query(self.model)
            .filter(self.model.deck_id == deck_id, self.model.next_review <= now)
            .order_by(self.model.next_review)
            .all()
        )
        new_cards = (
            db.query(self.model)
            .filter(self.model.deck_id == deck_id, self.model.next_review.is_(None))
            .order_by(self.model.created_at)
            .all()
        )
        combined = due + new_cards
        return combined[:limit]

    def apply_sm2(self, db: Session, card: Flashcard, quality: int, response_time_ms: int | None = None, user_id: int | None = None) -> Flashcard:
        from app.core.sm2 import calculate_next_review
        from datetime import datetime, timezone
        result = calculate_next_review(quality, card.repetitions, card.easiness_factor, card.interval)
        card.repetitions = result.repetitions
        card.easiness_factor = result.easiness_factor
        card.interval = result.interval
        card.next_review = result.next_review
        card.last_reviewed = datetime.now(timezone.utc)
        if quality < 3:
            card.lapses = (card.lapses or 0) + 1
        db.add(card)
        # Record review history
        if user_id:
            review = FlashcardReview(
                flashcard_id=card.id,
                user_id=user_id,
                quality=quality,
                response_time_ms=response_time_ms,
            )
            db.add(review)
        db.commit()
        db.refresh(card)
        return card

    def get_stats(self, db: Session, user_id: int) -> dict:
        from datetime import datetime, timezone, timedelta
        from sqlalchemy import func
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        # All flashcards across user's decks
        subq = db.query(AnkiDeck.id).filter(AnkiDeck.user_id == user_id).subquery()
        total = db.query(func.count(self.model.id)).filter(self.model.deck_id.in_(subq)).scalar() or 0
        due_today = (
            db.query(func.count(self.model.id))
            .filter(self.model.deck_id.in_(subq), self.model.next_review <= now)
            .scalar()
        ) or 0
        new_cards = (
            db.query(func.count(self.model.id))
            .filter(self.model.deck_id.in_(subq), self.model.next_review.is_(None))
            .scalar()
        ) or 0

        # Review stats
        total_reviews = db.query(func.count(FlashcardReview.id)).filter(FlashcardReview.user_id == user_id).scalar() or 0
        correct_30 = (
            db.query(func.count(FlashcardReview.id))
            .filter(FlashcardReview.user_id == user_id, FlashcardReview.quality >= 3, FlashcardReview.reviewed_at >= thirty_days_ago)
            .scalar()
        ) or 0
        total_30 = (
            db.query(func.count(FlashcardReview.id))
            .filter(FlashcardReview.user_id == user_id, FlashcardReview.reviewed_at >= thirty_days_ago)
            .scalar()
        ) or 0
        retention_rate = round((correct_30 / total_30 * 100), 1) if total_30 else 0.0

        correct_all = db.query(func.count(FlashcardReview.id)).filter(FlashcardReview.user_id == user_id, FlashcardReview.quality >= 3).scalar() or 0
        accuracy_rate = round((correct_all / total_reviews * 100), 1) if total_reviews else 0.0

        avg_ease = db.query(func.avg(self.model.easiness_factor)).filter(self.model.deck_id.in_(subq)).scalar()
        avg_ease = round(float(avg_ease), 2) if avg_ease else 2.5

        # Maturity buckets
        new_count = db.query(func.count(self.model.id)).filter(self.model.deck_id.in_(subq), self.model.repetitions == 0).scalar() or 0
        learning_count = (
            db.query(func.count(self.model.id))
            .filter(self.model.deck_id.in_(subq), self.model.repetitions.between(1, 2))
            .scalar()
        ) or 0
        young_count = (
            db.query(func.count(self.model.id))
            .filter(self.model.deck_id.in_(subq), self.model.interval.between(3, 20))
            .scalar()
        ) or 0
        mature_count = (
            db.query(func.count(self.model.id))
            .filter(self.model.deck_id.in_(subq), self.model.interval >= 21)
            .scalar()
        ) or 0

        # Streak
        review_days = (
            db.query(func.date(FlashcardReview.reviewed_at).label("day"))
            .filter(FlashcardReview.user_id == user_id)
            .group_by(func.date(FlashcardReview.reviewed_at))
            .order_by(func.date(FlashcardReview.reviewed_at).desc())
            .all()
        )
        from datetime import date
        streak = 0
        today = date.today()
        cursor = today
        for row in review_days:
            d = row.day if isinstance(row.day, date) else date.fromisoformat(str(row.day))
            if d == cursor or d == cursor - timedelta(days=1):
                streak += 1
                cursor = d - timedelta(days=1)
            elif d < cursor:
                break

        # Weekly reviews (last 7 days)
        weekly_rows = (
            db.query(
                func.date(FlashcardReview.reviewed_at).label("day"),
                func.count(FlashcardReview.id).label("count"),
            )
            .filter(FlashcardReview.user_id == user_id, FlashcardReview.reviewed_at >= now - timedelta(days=6))
            .group_by(func.date(FlashcardReview.reviewed_at))
            .order_by(func.date(FlashcardReview.reviewed_at))
            .all()
        )
        weekly_map = {str(r.day): r.count for r in weekly_rows}
        weekly_reviews = []
        for i in range(7):
            d = (now - timedelta(days=6 - i)).date()
            weekly_reviews.append({"day": str(d), "count": weekly_map.get(str(d), 0)})

        return {
            "total_cards": total,
            "due_today": due_today,
            "new_cards": new_cards,
            "retention_rate": retention_rate,
            "accuracy_rate": accuracy_rate,
            "total_reviews": total_reviews,
            "streak_days": streak,
            "avg_ease": avg_ease,
            "cards_by_maturity": [
                {"label": "Novo", "count": new_count},
                {"label": "Aprendendo", "count": learning_count},
                {"label": "Jovem", "count": young_count},
                {"label": "Maduro", "count": mature_count},
            ],
            "weekly_reviews": weekly_reviews,
        }


class FlashcardOptionRepository(BaseRepository[FlashcardOption]):
    def __init__(self):
        super().__init__(FlashcardOption)

    def get_by_flashcard(self, db: Session, flashcard_id: int) -> list[FlashcardOption]:
        return db.query(self.model).filter(self.model.flashcard_id == flashcard_id).order_by(self.model.position).all()

    def replace_options(self, db: Session, flashcard_id: int, options: list[dict]) -> list[FlashcardOption]:
        db.query(self.model).filter(self.model.flashcard_id == flashcard_id).delete()
        result = []
        for opt in options:
            obj = FlashcardOption(flashcard_id=flashcard_id, **opt)
            db.add(obj)
            result.append(obj)
        db.commit()
        return result


anki_deck_repo = AnkiDeckRepository()
flashcard_repo = FlashcardRepository()
flashcard_option_repo = FlashcardOptionRepository()
