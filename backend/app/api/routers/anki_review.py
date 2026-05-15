from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import anki_deck_repo, flashcard_repo
from app.api.dependencies import get_current_user
from app.domain.models import User

router = APIRouter(prefix="/anki/review", tags=["anki-review"])


@router.get("/queue/{deck_id}", response_model=list[dtos.FlashcardResponse])
def get_review_queue(deck_id: int, limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deck = anki_deck_repo.get(db, deck_id)
    if not deck or deck.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Deck not found")
    return flashcard_repo.get_review_queue(db, deck_id, limit=limit)


@router.post("/submit", response_model=dtos.ReviewResult)
def submit_review(review_in: dtos.ReviewSubmit, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if review_in.quality < 0 or review_in.quality > 5:
        raise HTTPException(status_code=422, detail="Quality must be 0-5")
    card = flashcard_repo.get(db, review_in.flashcard_id)
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    deck = anki_deck_repo.get(db, card.deck_id)
    if not deck or deck.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    updated_card = flashcard_repo.apply_sm2(
        db,
        card,
        quality=review_in.quality,
        response_time_ms=review_in.response_time_ms,
        user_id=current_user.id,
    )
    return dtos.ReviewResult(
        flashcard_id=updated_card.id,
        next_review=updated_card.next_review,
        new_interval=updated_card.interval,
        new_easiness_factor=updated_card.easiness_factor,
        new_repetitions=updated_card.repetitions,
        lapses=updated_card.lapses,
    )
