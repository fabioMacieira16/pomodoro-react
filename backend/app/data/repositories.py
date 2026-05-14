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
