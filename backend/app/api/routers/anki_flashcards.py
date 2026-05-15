from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import anki_deck_repo, flashcard_repo, flashcard_option_repo
from app.api.dependencies import get_current_user
from app.domain.models import User

router = APIRouter(prefix="/anki/flashcards", tags=["anki-flashcards"])


def _owns_deck(db, deck_id, user_id):
    deck = anki_deck_repo.get(db, deck_id)
    if not deck or deck.user_id != user_id:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


@router.get("/deck/{deck_id}", response_model=list[dtos.FlashcardResponse])
def list_flashcards(deck_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _owns_deck(db, deck_id, current_user.id)
    return flashcard_repo.get_by_deck(db, deck_id)


@router.post("/", response_model=dtos.FlashcardResponse)
def create_flashcard(card_in: dtos.FlashcardCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _owns_deck(db, card_in.deck_id, current_user.id)
    data = card_in.model_dump(exclude={"options"})
    card = flashcard_repo.create(db, data)
    if card_in.options:
        flashcard_option_repo.replace_options(db, card.id, [o.model_dump() for o in card_in.options])
        db.refresh(card)
    return card


@router.post("/bulk", response_model=list[dtos.FlashcardResponse])
def bulk_create_flashcards(cards: list[dtos.FlashcardCreate], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    created = []
    for card_in in cards:
        _owns_deck(db, card_in.deck_id, current_user.id)
        data = card_in.model_dump(exclude={"options"})
        card = flashcard_repo.create(db, data)
        if card_in.options:
            flashcard_option_repo.replace_options(db, card.id, [o.model_dump() for o in card_in.options])
            db.refresh(card)
        created.append(card)
    return created


@router.get("/{card_id}", response_model=dtos.FlashcardResponse)
def get_flashcard(card_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    card = flashcard_repo.get(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    _owns_deck(db, card.deck_id, current_user.id)
    return card


@router.put("/{card_id}", response_model=dtos.FlashcardResponse)
def update_flashcard(card_id: int, card_in: dtos.FlashcardUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    card = flashcard_repo.get(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    _owns_deck(db, card.deck_id, current_user.id)
    update_data = card_in.model_dump(exclude_unset=True, exclude={"options"})
    flashcard_repo.update(db, card, update_data)
    if card_in.options is not None:
        flashcard_option_repo.replace_options(db, card.id, [o.model_dump() for o in card_in.options])
        db.refresh(card)
    return card


@router.delete("/{card_id}")
def delete_flashcard(card_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    card = flashcard_repo.get(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    _owns_deck(db, card.deck_id, current_user.id)
    flashcard_repo.delete(db, card_id)
    return {"message": "Flashcard deleted"}
