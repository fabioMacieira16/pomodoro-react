from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.data.database import get_db
from app.api.dependencies import get_current_user
from app.domain.models import User
from app.achievements.service import AchievementService

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("/me/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AchievementService(db).get_summary(current_user.id)


@router.get("/me/recent")
def get_recent(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AchievementService(db).get_recent_unlocks(current_user.id, limit)


@router.get("/me")
def get_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AchievementService(db).get_all_achievements(current_user.id)


@router.get("/me/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AchievementService(db).get_user_stats(current_user.id)
