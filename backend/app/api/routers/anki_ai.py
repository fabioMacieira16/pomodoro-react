"""
AI-powered flashcard generation.
Uses OpenAI if OPENAI_API_KEY is configured, otherwise returns a mock.
"""
import os
import json
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.ai.factory import get_provider
from app.ai.services.pdf_service import PDFService
from app.api import dtos
from app.core.config import settings as app_settings
from app.data.database import get_db
from app.data.repositories import anki_deck_repo, flashcard_repo, flashcard_option_repo
from app.api.dependencies import get_current_user
from app.domain.models import AnkiDeck, User

# Conteúdo do PDF enviado à IA: gpt-4o-mini tem contexto de 128k tokens,
# então cortamos bem mais do que o necessário para um PDF de várias páginas.
MAX_CONTENT_CHARS = 20000
MAX_DETECTION_CHARS = 6000

router = APIRouter(prefix="/anki/ai", tags=["anki-ai"])


def _build_prompt(req: dtos.AIGenerateRequest) -> str:
    types_desc = {
        "qa": "pergunta/resposta",
        "multiple_choice": "múltipla escolha (4 opções, 1 correta)",
        "cloze": "preenchimento de lacuna (use ___ para a lacuna)",
        "true_false": "verdadeiro ou falso",
    }
    type_labels = ", ".join(types_desc.get(t, t) for t in req.card_types)
    return f"""Você é um especialista em criar flashcards educativos para memorização com spaced repetition.

Crie {req.card_count} flashcards do tipo: {type_labels}.
Idioma: {req.language}

Conteúdo de origem:
---
{req.content[:MAX_CONTENT_CHARS]}
---

Retorne SOMENTE um JSON válido com a seguinte estrutura (array de objetos):
[
  {{
    "card_type": "qa",
    "front": "Pergunta aqui",
    "back": "Resposta aqui",
    "hint": "dica opcional ou null",
    "tags": ["tag1", "tag2"],
    "difficulty": "Easy|Medium|Hard",
    "options": []
  }},
  {{
    "card_type": "multiple_choice",
    "front": "Pergunta aqui",
    "back": "Texto explicativo da resposta correta",
    "hint": null,
    "tags": [],
    "difficulty": "Medium",
    "options": [
      {{"text": "Opção A", "is_correct": false, "position": 0}},
      {{"text": "Opção B", "is_correct": true, "position": 1}},
      {{"text": "Opção C", "is_correct": false, "position": 2}},
      {{"text": "Opção D", "is_correct": false, "position": 3}}
    ]
  }}
]

Para cloze: use ___ (três underscores) na parte frontal para marcar a lacuna. A resposta vai na parte back.
Para true_false: back deve ser "Verdadeiro" ou "Falso".
Retorne SOMENTE o JSON, sem markdown, sem explicações."""


def _mock_flashcards(req: dtos.AIGenerateRequest) -> list[dict]:
    """Return mock flashcards when no AI API is configured."""
    cards = []
    words = req.content.split()[:50]
    for i in range(min(req.card_count, 3)):
        snippet = " ".join(words[i * 5: i * 5 + 10]) if words else "conteúdo"
        card_type = req.card_types[i % len(req.card_types)] if req.card_types else "qa"
        if card_type == "multiple_choice":
            cards.append({
                "card_type": "multiple_choice",
                "front": f"Sobre '{snippet}', qual afirmação é correta?",
                "back": "A opção A está correta porque...",
                "hint": None,
                "tags": ["gerado-ia"],
                "difficulty": "Medium",
                "options": [
                    {"text": snippet[:30] if snippet else "Opção A", "is_correct": True, "position": 0},
                    {"text": "Opção incorreta B", "is_correct": False, "position": 1},
                    {"text": "Opção incorreta C", "is_correct": False, "position": 2},
                    {"text": "Opção incorreta D", "is_correct": False, "position": 3},
                ],
            })
        elif card_type == "cloze":
            cards.append({
                "card_type": "cloze",
                "front": f"___ é relacionado ao contexto: {snippet[:40]}",
                "back": snippet.split()[0] if snippet.split() else "resposta",
                "hint": None,
                "tags": ["gerado-ia"],
                "difficulty": "Medium",
                "options": [],
            })
        elif card_type == "true_false":
            cards.append({
                "card_type": "true_false",
                "front": f"'{snippet[:60]}' é uma afirmação verdadeira.",
                "back": "Verdadeiro",
                "hint": None,
                "tags": ["gerado-ia"],
                "difficulty": "Easy",
                "options": [],
            })
        else:
            cards.append({
                "card_type": "qa",
                "front": f"O que significa '{snippet[:40]}'?",
                "back": f"Refere-se a: {snippet}",
                "hint": None,
                "tags": ["gerado-ia"],
                "difficulty": "Medium",
                "options": [],
            })
    return cards


async def _call_openai(req: dtos.AIGenerateRequest) -> list[dict]:
    try:
        import httpx
        api_key = os.environ.get("OPENAI_API_KEY", "")
        prompt = _build_prompt(req)
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": app_settings.OPENAI_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao chamar OpenAI: {str(e)}")


async def _generate_and_save(req: dtos.AIGenerateRequest, db: Session, extra_tag: str | None = None) -> list:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if api_key:
        raw_cards = await _call_openai(req)
    else:
        raw_cards = _mock_flashcards(req)

    created = []
    for raw in raw_cards:
        options = raw.pop("options", [])
        raw["deck_id"] = req.deck_id
        raw.setdefault("tags", [])
        if extra_tag and extra_tag not in raw["tags"]:
            raw["tags"] = [*raw["tags"], extra_tag]
        card = flashcard_repo.create(db, raw)
        if options:
            flashcard_option_repo.replace_options(db, card.id, options)
            db.refresh(card)
        created.append(card)
    return created


async def _detect_discipline(content: str, api_key: str) -> str:
    """Identifica a disciplina/matéria principal do conteúdo via IA. 'Geral' como fallback."""
    if not api_key:
        return "Geral"
    try:
        import httpx
        prompt = (
            "Identifique a disciplina/matéria principal abordada no texto abaixo "
            "(ex: 'Arquitetura de Software', 'Metodologias Ágeis', 'Direito Tributário'). "
            "Responda APENAS com o nome curto da disciplina, sem explicações nem aspas.\n\n"
            f"Texto:\n---\n{content[:MAX_DETECTION_CHARS]}\n---"
        )
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": app_settings.OPENAI_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"].strip()
            return text.strip('"').strip("'")[:60] or "Geral"
    except Exception:
        return "Geral"


async def _detect_assunto(content: str, deck_name: str, api_key: str) -> str:
    """Identifica o assunto/sub-tópico específico dentro do deck. 'Geral' como fallback."""
    if not api_key:
        return "Geral"
    try:
        import httpx
        prompt = (
            f"O conteúdo abaixo faz parte do material de estudos do baralho '{deck_name}'. "
            "Identifique o assunto/sub-tópico específico abordado — algo mais específico que a disciplina geral "
            "(ex: 'ICMS', 'Processo Administrativo Tributário', 'Scrum - Papéis e Cerimônias'). "
            "Responda APENAS com o nome curto do assunto, sem explicações nem aspas.\n\n"
            f"Texto:\n---\n{content[:MAX_DETECTION_CHARS]}\n---"
        )
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": app_settings.OPENAI_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"].strip()
            return text.strip('"').strip("'")[:60] or "Geral"
    except Exception:
        return "Geral"


def _find_matching_deck(decks: list[AnkiDeck], discipline: str) -> AnkiDeck | None:
    """Casa a disciplina detectada com um deck já cadastrado (nome igual ou contido)."""
    target = discipline.lower().strip()
    for deck in decks:
        name = deck.name.lower().strip()
        if name == target or name in target or target in name:
            return deck
    return None


def _find_matching_text(candidates: set[str], target: str) -> str | None:
    """Casa um texto detectado com um valor já existente (nome igual ou contido)."""
    t = target.lower().strip()
    for candidate in candidates:
        c = candidate.lower().strip()
        if c == t or c in t or t in c:
            return candidate
    return None


@router.post("/generate", response_model=dtos.AIGenerateResponse)
async def generate_flashcards(req: dtos.AIGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deck = anki_deck_repo.get(db, req.deck_id)
    if not deck or deck.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Deck not found")

    created = await _generate_and_save(req, db)
    return dtos.AIGenerateResponse(created_count=len(created), flashcards=created)


@router.post("/generate-from-pdf", response_model=dtos.AIGenerateFromPDFResponse)
async def generate_flashcards_from_pdf(
    file: UploadFile = File(...),
    deck_id: Optional[int] = Form(None),
    card_count: int = Form(10),
    card_types: str = Form("qa"),
    language: str = Form("pt"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Importa um PDF, extrai o texto e gera flashcards.

    - Se deck_id for informado (uso normal, dentro de um deck aberto): os cartões
      ficam nesse deck, e o ASSUNTO (sub-tópico) é detectado e casado com os já
      usados nesse deck; se não existir, o novo assunto é aplicado como tag.
    - Se deck_id não for informado: identifica a DISCIPLINA e busca/cria o deck
      correspondente (fallback para quando não há um deck já aberto).
    """
    raw_bytes = await file.read()
    text = PDFService(get_provider())._extract_text(raw_bytes)
    if len(text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail=(
                "Não foi possível extrair texto suficiente do PDF. "
                "Se o arquivo for escaneado/imagem (sem texto selecionável), "
                "ele precisa passar por OCR antes de ser importado."
            ),
        )

    api_key = os.environ.get("OPENAI_API_KEY", "")
    deck_created = False
    assunto: str | None = None
    assunto_created = False
    extra_tag: str | None = None

    if deck_id is not None:
        deck = anki_deck_repo.get(db, deck_id)
        if not deck or deck.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Deck not found")

        detected_assunto = await _detect_assunto(text, deck.name, api_key)
        existing_cards = flashcard_repo.get_by_deck(db, deck.id)
        existing_assuntos = {
            tag.replace("assunto:", "", 1)
            for card in existing_cards
            for tag in (card.tags or [])
            if tag.startswith("assunto:")
        }
        matched = _find_matching_text(existing_assuntos, detected_assunto)
        assunto = matched or detected_assunto
        assunto_created = matched is None
        extra_tag = f"assunto:{assunto}"
    else:
        discipline = await _detect_discipline(text, api_key)
        existing_decks = anki_deck_repo.get_by_user(db, current_user.id)
        deck = _find_matching_deck(existing_decks, discipline)
        if not deck:
            deck = anki_deck_repo.create(db, {"name": discipline, "color": "#3b82f6", "user_id": current_user.id})
            deck_created = True

    types_list = [t.strip() for t in card_types.split(",") if t.strip()] or ["qa"]
    req = dtos.AIGenerateRequest(
        deck_id=deck.id,
        source_type="pdf",
        content=text,
        card_count=card_count,
        card_types=types_list,
        language=language,
    )
    created = await _generate_and_save(req, db, extra_tag=extra_tag)
    return dtos.AIGenerateFromPDFResponse(
        created_count=len(created),
        flashcards=created,
        deck_id=deck.id,
        deck_name=deck.name,
        deck_created=deck_created,
        assunto=assunto,
        assunto_created=assunto_created,
    )
