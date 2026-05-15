"""
AI-powered flashcard generation.
Uses OpenAI if OPENAI_API_KEY is configured, otherwise returns a mock.
"""
import os
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import anki_deck_repo, flashcard_repo, flashcard_option_repo
from app.api.dependencies import get_current_user
from app.domain.models import User

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
{req.content[:4000]}
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
                    "model": "gpt-3.5-turbo",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao chamar OpenAI: {str(e)}")


@router.post("/generate", response_model=dtos.AIGenerateResponse)
async def generate_flashcards(req: dtos.AIGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deck = anki_deck_repo.get(db, req.deck_id)
    if not deck or deck.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Deck not found")

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
        card = flashcard_repo.create(db, raw)
        if options:
            flashcard_option_repo.replace_options(db, card.id, options)
            db.refresh(card)
        created.append(card)

    return dtos.AIGenerateResponse(created_count=len(created), flashcards=created)
