import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import anki_deck_repo, flashcard_repo, flashcard_option_repo
from app.api.dependencies import get_current_user
from app.domain.models import User, AnkiDeck

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
    try:
        from app.achievements.service import AchievementService
        AchievementService(db).register_event(current_user.id, "FLASHCARD_CREATED")
    except Exception:
        pass
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
    try:
        from app.achievements.service import AchievementService
        AchievementService(db).register_event(current_user.id, "FLASHCARD_CREATED", value=len(created))
    except Exception:
        pass
    return created


@router.post("/import-csv", response_model=list[dtos.FlashcardResponse])
async def import_csv_flashcards(
    deck_id: int = Form(...),
    assunto: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import flashcards from a 2-column CSV (front, back) — no header row."""
    _owns_deck(db, deck_id, current_user.id)

    raw = await file.read()
    text = raw.decode("utf-8-sig", errors="replace")
    extra_tag = f"assunto:{assunto.strip()}" if assunto and assunto.strip() else None

    created = []
    for row in csv.reader(io.StringIO(text)):
        if len(row) < 2:
            continue
        front, back = row[0].strip(), row[1].strip()
        if not front or not back:
            continue
        card = flashcard_repo.create(db, {
            "deck_id": deck_id,
            "card_type": "qa",
            "front": front,
            "back": back,
            "tags": [extra_tag] if extra_tag else [],
            "difficulty": "Medium",
        })
        created.append(card)

    if not created:
        raise HTTPException(status_code=400, detail="Nenhuma linha válida encontrada no CSV. Esperado: frente,verso por linha.")

    return created


_NOTETYPE_DIFFICULTY = {
    "fácil": "Easy", "facil": "Easy", "easy": "Easy",
    "médio": "Medium", "medio": "Medium", "medium": "Medium",
    "difícil": "Hard", "dificil": "Hard", "hard": "Hard",
}

_DAY_SEGMENTS = {"segunda", "terça", "terca", "quarta", "quinta", "sexta", "sábado", "sabado", "domingo",
                 "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira"}


@router.post("/import-anki", summary="Importar export do Anki (.html / .txt / .tsv)")
async def import_anki_export(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Importa um arquivo exportado pelo Anki (Arquivo > Exportar > Notas em texto simples).
    Formato: TSV com cabeçalho de diretivas (#separator:tab, #deck column:N, …).
    O primeiro segmento do caminho do baralho vira o nome do deck; o último segmento vira o assunto.
    """
    raw = await file.read()
    text = raw.decode("utf-8-sig", errors="replace")

    separator = "\t"
    guid_col = 0
    notetype_col = 1
    deck_col = 2
    data_lines: list[str] = []

    for line in text.splitlines():
        if line.startswith("#separator:"):
            val = line.split(":", 1)[1].strip().lower()
            separator = "\t" if val == "tab" else val
        elif line.startswith("#guid column:"):
            guid_col = int(line.split(":", 1)[1].strip()) - 1
        elif line.startswith("#notetype column:"):
            notetype_col = int(line.split(":", 1)[1].strip()) - 1
        elif line.startswith("#deck column:"):
            deck_col = int(line.split(":", 1)[1].strip()) - 1
        elif not line.startswith("#") and line.strip():
            data_lines.append(line)

    # Note fields start right after the last special column
    first_field = max(guid_col, notetype_col, deck_col) + 1

    deck_cache: dict[str, AnkiDeck] = {}
    created = skipped = 0
    errors: list[str] = []

    reader = csv.reader(io.StringIO("\n".join(data_lines)), delimiter=separator)
    for lineno, row in enumerate(reader, start=1):
        if len(row) < first_field + 2:
            skipped += 1
            errors.append(f"Linha {lineno}: colunas insuficientes ({len(row)})")
            continue

        note_type = row[notetype_col].strip()
        deck_path = row[deck_col].strip()
        front = row[first_field].strip()
        back = row[first_field + 1].strip()

        if not front or not back:
            skipped += 1
            continue

        segments = [s.strip() for s in deck_path.split("::") if s.strip()]
        if not segments:
            skipped += 1
            continue

        deck_name = segments[0]
        # Last segment = subject; skip day-of-week segments
        subject_segments = [s for s in segments[1:] if s.lower() not in _DAY_SEGMENTS]
        assunto = subject_segments[-1] if subject_segments else None

        difficulty = _NOTETYPE_DIFFICULTY.get(note_type.lower(), "Medium")

        if deck_name not in deck_cache:
            deck = db.query(AnkiDeck).filter_by(user_id=current_user.id, name=deck_name).first()
            if not deck:
                deck = AnkiDeck(user_id=current_user.id, name=deck_name, color="#3b82f6")
                db.add(deck)
                db.commit()
                db.refresh(deck)
            deck_cache[deck_name] = deck

        deck_obj = deck_cache[deck_name]
        tags = [f"assunto:{assunto}"] if assunto else []

        flashcard_repo.create(db, {
            "deck_id": deck_obj.id,
            "card_type": "qa",
            "front": front,
            "back": back,
            "tags": tags,
            "difficulty": difficulty,
        })
        created += 1

    if created == 0 and errors:
        raise HTTPException(status_code=400, detail=errors[0])

    return {"imported": created, "skipped": skipped, "errors": errors[:10]}


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
