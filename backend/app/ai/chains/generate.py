from typing import Any

from .base import BaseChain

_EXERCISES_PROMPT = """Você é um especialista em criar exercícios educativos.

Crie {count} exercícios do(s) tipo(s): {types}.
Idioma: {language}

Conteúdo:
---
{content}
---

Retorne SOMENTE um JSON válido (array de objetos):
[
  {{
    "question": "Enunciado da questão",
    "type": "multiple_choice|open|true_false",
    "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
    "answer": "Resposta correta",
    "explanation": "Explicação da resposta",
    "difficulty": "Easy|Medium|Hard"
  }}
]

Retorne SOMENTE o JSON, sem markdown."""

_FLASHCARDS_PROMPT = """Você é um especialista em criar flashcards para memorização.

Crie {count} flashcards do(s) tipo(s): {types}.
Idioma: {language}

Conteúdo:
---
{content}
---

Retorne SOMENTE um JSON válido (array de objetos):
[
  {{
    "front": "Frente do flashcard",
    "back": "Verso do flashcard",
    "tags": ["tag1", "tag2"],
    "difficulty": "Easy|Medium|Hard"
  }}
]

Retorne SOMENTE o JSON, sem markdown."""

_MINDMAP_PROMPT = """Você é um especialista em criar mapas mentais educativos.

Crie um mapa mental do seguinte conteúdo em {language}.

Conteúdo:
---
{content}
---

Retorne SOMENTE um JSON válido:
{{
  "title": "Título do mapa mental",
  "nodes": [
    {{
      "id": "root",
      "label": "Conceito central",
      "children": [
        {{
          "id": "n1",
          "label": "Subtópico 1",
          "children": [{"id": "n1a", "label": "Detalhe 1.1", "children": []}]
        }}
      ]
    }}
  ]
}}

Retorne SOMENTE o JSON, sem markdown."""


class GenerateChain(BaseChain):
    """
    Generation chain for exercises, flashcards, and mind maps.

    LangChain stub: when USE_LANGCHAIN=true, will use LCEL chains.
    """

    async def run(self, inputs: dict[str, Any]) -> dict[str, Any]:
        mode = inputs.get("mode", "exercises")  # exercises | flashcards | mindmap
        if mode == "exercises":
            return await self._generate_exercises(inputs)
        if mode == "flashcards":
            return await self._generate_flashcards(inputs)
        if mode == "mindmap":
            return await self._generate_mindmap(inputs)
        raise ValueError(f"Unknown generation mode: {mode}")

    async def _generate_exercises(self, inputs: dict[str, Any]) -> dict[str, Any]:
        prompt = _EXERCISES_PROMPT.format(
            count=inputs.get("count", 5),
            types=", ".join(inputs.get("types", ["multiple_choice"])),
            language=inputs.get("language", "pt"),
            content=inputs["content"][:6000],
        )
        # TODO: LangChain stub – if self.use_langchain and self._langchain_available()
        result = await self.provider.complete_json(prompt)
        return {"exercises": result if isinstance(result, list) else [], "provider": self.provider.name}

    async def _generate_flashcards(self, inputs: dict[str, Any]) -> dict[str, Any]:
        prompt = _FLASHCARDS_PROMPT.format(
            count=inputs.get("count", 10),
            types=", ".join(inputs.get("types", ["qa"])),
            language=inputs.get("language", "pt"),
            content=inputs["content"][:6000],
        )
        result = await self.provider.complete_json(prompt)
        return {"flashcards": result if isinstance(result, list) else [], "provider": self.provider.name}

    async def _generate_mindmap(self, inputs: dict[str, Any]) -> dict[str, Any]:
        prompt = _MINDMAP_PROMPT.format(
            language=inputs.get("language", "pt"),
            content=inputs["content"][:6000],
        )
        result = await self.provider.complete_json(prompt)
        return {"mindmap": result if isinstance(result, dict) else {}, "provider": self.provider.name}
