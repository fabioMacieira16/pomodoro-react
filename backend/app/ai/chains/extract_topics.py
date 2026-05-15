from typing import Any

from .base import BaseChain

_PROMPT = """Você é um especialista em análise de conteúdo educativo.

Extraia os principais tópicos do seguinte conteúdo em {language}.

Retorne SOMENTE um JSON válido (array de objetos):
[
  {{
    "title": "Nome do tópico",
    "description": "Descrição breve (1-2 frases)",
    "keywords": ["palavra1", "palavra2"]
  }}
]

Conteúdo:
---
{content}
---

Retorne SOMENTE o JSON, sem markdown."""


class ExtractTopicsChain(BaseChain):
    """
    Topic extraction chain.

    LangChain stub: when USE_LANGCHAIN=true, will use
    LangChain structured output parsing.
    """

    async def run(self, inputs: dict[str, Any]) -> dict[str, Any]:
        content = inputs["content"]
        language = inputs.get("language", "pt")

        if self.use_langchain and self._langchain_available():
            return await self._run_langchain(content, language)

        prompt = _PROMPT.format(content=content[:6000], language=language)
        topics = await self.provider.complete_json(prompt)
        return {
            "topics": topics if isinstance(topics, list) else [],
            "provider": self.provider.name,
        }

    async def _run_langchain(self, content: str, language: str) -> dict[str, Any]:
        """
        LangChain LCEL stub.

        TODO:
            from langchain_core.output_parsers import JsonOutputParser
            parser = JsonOutputParser(pydantic_object=TopicList)
            chain = prompt | llm | parser
        """
        prompt = _PROMPT.format(content=content[:6000], language=language)
        topics = await self.provider.complete_json(prompt)
        return {
            "topics": topics if isinstance(topics, list) else [],
            "provider": self.provider.name,
        }
