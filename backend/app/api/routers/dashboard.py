from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import pomodoro_repo
from app.api.dependencies import get_current_user
from app.domain.models import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=dtos.DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return pomodoro_repo.get_dashboard_data(db, current_user.id)
