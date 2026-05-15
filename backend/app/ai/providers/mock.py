import json
from typing import Any

from .base import AIProvider, ProviderConfig


class MockProvider(AIProvider):
    """Mock provider for development and testing. Returns structured stubs."""

    def __init__(self, config: ProviderConfig | None = None):
        super().__init__(config or ProviderConfig(model="mock"))

    @property
    def name(self) -> str:
        return "mock"

    def is_available(self) -> bool:
        return True

    async def complete(self, prompt: str) -> str:
        p = prompt.lower()
        if "summary" in p or "resumo" in p:
            return (
                "[Mock] Este é um resumo gerado pelo provider mock. "
                "Configure AI_PROVIDER=openai ou AI_PROVIDER=ollama para respostas reais."
            )
        if "topic" in p or "tópico" in p:
            return json.dumps([
                {"title": "Tópico Mock 1", "description": "Descrição do tópico 1", "keywords": ["mock", "exemplo"]},
                {"title": "Tópico Mock 2", "description": "Descrição do tópico 2", "keywords": ["mock", "teste"]},
            ])
        if "exercício" in p or "exercise" in p:
            return json.dumps([
                {
                    "question": "Qual é a resposta mock para esta questão?",
                    "type": "multiple_choice",
                    "options": ["Opção A (correta)", "Opção B", "Opção C", "Opção D"],
                    "answer": "Opção A (correta)",
                    "explanation": "Esta é uma resposta mock de exemplo.",
                    "difficulty": "Medium",
                }
            ])
        if "flashcard" in p:
            return json.dumps([
                {"front": "Pergunta mock?", "back": "Resposta mock", "tags": ["mock"], "difficulty": "Medium"},
            ])
        if "mindmap" in p or "mapa" in p:
            return json.dumps({
                "title": "Mapa Mental Mock",
                "nodes": [
                    {
                        "id": "root",
                        "label": "Tópico Central",
                        "children": [
                            {"id": "n1", "label": "Subtópico 1", "children": []},
                            {"id": "n2", "label": "Subtópico 2", "children": []},
                        ],
                    }
                ],
            })
        return "[Mock] Resposta genérica do provider mock."

    async def complete_json(self, prompt: str) -> Any:
        text = await self.complete(prompt)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"text": text}
