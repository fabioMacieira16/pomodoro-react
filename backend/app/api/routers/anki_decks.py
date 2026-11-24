from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import anki_deck_repo
from app.api.dependencies import get_current_user
from app.domain.models import User

router = APIRouter(prefix="/anki/decks", tags=["anki-decks"])


def _enrich_deck(db, deck) -> dict:
    counts = anki_deck_repo.get_with_counts(db, deck)
    return {
        "id": deck.id,
        "name": deck.name,
        "description": deck.description,
        "color": deck.color,
        "is_public": deck.is_public,
        "user_id": deck.user_id,
        "subject_id": deck.subject_id,
        "parent_deck_id": deck.parent_deck_id,
        "created_at": deck.created_at,
        **counts,
    }


@router.get("/", response_model=list[dtos.DeckResponse])
def list_decks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    decks = anki_deck_repo.get_by_user(db, current_user.id)
    return [_enrich_deck(db, d) for d in decks]


@router.get("/tree", response_model=list[dtos.DeckTreeResponse])
def get_deck_tree(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return hierarchical deck tree (root decks with nested subdecks)."""
    all_decks = anki_deck_repo.get_by_user(db, current_user.id)
    deck_map = {d.id: {**_enrich_deck(db, d), "subdecks": []} for d in all_decks}

    roots = []
    for d in all_decks:
        node = deck_map[d.id]
        if d.parent_deck_id and d.parent_deck_id in deck_map:
            deck_map[d.parent_deck_id]["subdecks"].append(node)
        else:
            roots.append(node)
    return roots


@router.get("/public", response_model=list[dtos.PublicDeckResponse])
def list_public_decks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    decks = anki_deck_repo.get_public(db, current_user.id)
    return [
        {**_enrich_deck(db, deck), "due_count": 0, "new_count": 0}
        for deck in decks
    ]


@router.post("/", response_model=dtos.DeckResponse)
def create_deck(deck_in: dtos.DeckCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = deck_in.model_dump()
    data["user_id"] = current_user.id
    deck = anki_deck_repo.create(db, data)
    return _enrich_deck(db, deck)


@router.get("/{deck_id}", response_model=dtos.DeckResponse)
def get_deck(deck_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deck = anki_deck_repo.get(db, deck_id)
    if not deck or deck.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Deck not found")
    return _enrich_deck(db, deck)


@router.put("/{deck_id}", response_model=dtos.DeckResponse)
def update_deck(deck_id: int, deck_in: dtos.DeckUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deck = anki_deck_repo.get(db, deck_id)
    if not deck or deck.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Deck not found")
    updated = anki_deck_repo.update(db, deck, deck_in.model_dump(exclude_unset=True))
    return _enrich_deck(db, updated)


@router.post("/{deck_id}/copy", response_model=dtos.DeckResponse)
def copy_public_deck(deck_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.domain.models import AnkiDeck, Flashcard, FlashcardOption

    source = anki_deck_repo.get(db, deck_id)
    if not source or not source.is_public or source.user_id == current_user.id:
        raise HTTPException(status_code=404, detail="Public deck not found")

    copied = AnkiDeck(
        name=source.name,
        description=source.description,
        color=source.color,
        is_public=False,
        user_id=current_user.id,
    )
    db.add(copied)
    db.flush()

    for source_card in source.flashcards:
        copied_card = Flashcard(
            deck_id=copied.id,
            card_type=source_card.card_type,
            front=source_card.front,
            back=source_card.back,
            hint=source_card.hint,
            hint_image=source_card.hint_image,
            explanation=source_card.explanation,
            explanation_image=source_card.explanation_image,
            tags=list(source_card.tags or []),
            difficulty=source_card.difficulty,
        )
        db.add(copied_card)
        db.flush()
        db.add_all([
            FlashcardOption(
                flashcard_id=copied_card.id,
                text=option.text,
                is_correct=option.is_correct,
                position=option.position,
            )
            for option in source_card.options
        ])

    db.commit()
    db.refresh(copied)
    return _enrich_deck(db, copied)


@router.delete("/{deck_id}")
def delete_deck(deck_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deck = anki_deck_repo.get(db, deck_id)
    if not deck or deck.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Deck not found")
    anki_deck_repo.delete(db, deck_id)
    return {"message": "Deck deleted"}
