from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import setting_repo
from app.api.dependencies import get_current_user
from app.domain.models import User

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/", response_model=dtos.SettingResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return setting_repo.get_or_create(db, current_user.id)


@router.put("/", response_model=dtos.SettingResponse)
def update_settings(
    setting_in: dtos.SettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    setting = setting_repo.get_or_create(db, current_user.id)
    return setting_repo.update(db, setting, setting_in.model_dump(exclude_unset=True))
