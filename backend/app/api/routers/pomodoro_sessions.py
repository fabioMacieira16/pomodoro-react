from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import pomodoro_repo
from app.api.dependencies import get_current_user
from app.domain.models import User

router = APIRouter(prefix="/pomodoro-sessions", tags=["pomodoro-sessions"])


@router.post("/", response_model=dtos.PomodoroSessionResponse)
def create_session(
    session_in: dtos.PomodoroSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = session_in.model_dump()
    data["user_id"] = current_user.id
    created = pomodoro_repo.create(db, data)
    if created.completed and created.session_type == "Pomodoro":
        try:
            from app.achievements.service import AchievementService
            AchievementService(db).register_event(
                current_user.id, "POMODORO_COMPLETED",
                value=created.duration_minutes or 25,
            )
        except Exception:
            pass
    return created


@router.get("/stats", response_model=dtos.PomodoroStatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return pomodoro_repo.get_stats(db, current_user.id)


@router.get("/", response_model=list[dtos.PomodoroSessionResponse])
def get_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return pomodoro_repo.get_by_user(db, current_user.id)


@router.patch("/{session_id}", response_model=dtos.PomodoroSessionResponse)
def update_session(
    session_id: int,
    session_in: dtos.PomodoroSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = pomodoro_repo.get(db, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    was_completed = bool(session.completed)
    updated = pomodoro_repo.update(db, session, session_in.model_dump(exclude_unset=True))
    if not was_completed and updated.completed and updated.session_type == "Pomodoro":
        try:
            from app.achievements.service import AchievementService
            AchievementService(db).register_event(
                current_user.id, "POMODORO_COMPLETED",
                value=updated.duration_minutes or 25,
            )
        except Exception:
            pass
    return updated
