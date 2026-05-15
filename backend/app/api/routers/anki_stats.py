from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import flashcard_repo
from app.api.dependencies import get_current_user
from app.domain.models import User

router = APIRouter(prefix="/anki/stats", tags=["anki-stats"])


@router.get("/", response_model=dtos.AnkiStatsResponse)
def get_anki_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stats = flashcard_repo.get_stats(db, current_user.id)
    return dtos.AnkiStatsResponse(**stats)
