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

from app.domain.models import User, Task, PomodoroSession, Setting

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
        from sqlalchemy import func, cast, Date
        today = date.today()
        today_count = (
            db.query(func.count(self.model.id))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                cast(self.model.start_time, Date) == today,
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
        from sqlalchemy import func, cast, Date

        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        cutoff_heatmap = today - timedelta(days=83)
        cutoff_30 = today - timedelta(days=29)

        today_minutes = (
            db.query(func.sum(self.model.duration_minutes))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                cast(self.model.start_time, Date) == today,
            )
            .scalar()
        ) or 0

        week_minutes = (
            db.query(func.sum(self.model.duration_minutes))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                cast(self.model.start_time, Date) >= week_start,
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
                cast(self.model.start_time, Date).label("day"),
                func.count(self.model.id).label("count"),
            )
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                cast(self.model.start_time, Date) >= cutoff_heatmap,
            )
            .group_by(cast(self.model.start_time, Date))
            .order_by(cast(self.model.start_time, Date))
            .all()
        )
        heatmap = [{"date": str(row.day), "count": row.count} for row in heatmap_rows]

        day_labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
        weekly_rows = (
            db.query(
                cast(self.model.start_time, Date).label("day"),
                func.count(self.model.id).label("pomodoros"),
                func.sum(self.model.duration_minutes).label("focus_minutes"),
            )
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                cast(self.model.start_time, Date) >= today - timedelta(days=6),
            )
            .group_by(cast(self.model.start_time, Date))
            .order_by(cast(self.model.start_time, Date))
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
            db.query(cast(self.model.start_time, Date).label("day"))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
            )
            .group_by(cast(self.model.start_time, Date))
            .order_by(cast(self.model.start_time, Date).desc())
            .all()
        )
        streak = 0
        if all_days:
            cursor = today
            for row in all_days:
                if row.day == cursor or row.day == cursor - timedelta(days=1):
                    streak += 1
                    cursor = row.day - timedelta(days=1)
                elif row.day < cursor:
                    break

        distinct_days_30 = (
            db.query(func.count(func.distinct(cast(self.model.start_time, Date))))
            .filter(
                self.model.user_id == user_id,
                self.model.session_type == "Pomodoro",
                self.model.completed == True,
                cast(self.model.start_time, Date) >= cutoff_30,
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
