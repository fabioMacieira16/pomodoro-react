from typing import Any

from .base import BaseChain

_PROMPT = """Você é um assistente especializado em resumir conteúdo educativo.

Crie um resumo claro e objetivo do seguinte conteúdo em {language}.
Formato: parágrafos concisos.

Conteúdo:
---
{content}
---

Retorne APENAS o texto do resumo, sem título ou cabeçalho."""


class SummarizeChain(BaseChain):
    """
    Summarization chain.

    LangChain stub: when USE_LANGCHAIN=true, wraps provider in a
    LangChain PromptTemplate + LLM chain for composability.
    """

    async def run(self, inputs: dict[str, Any]) -> dict[str, Any]:
        content = inputs["content"]
        language = inputs.get("language", "pt")

        if self.use_langchain and self._langchain_available():
            return await self._run_langchain(content, language)

        prompt = _PROMPT.format(content=content[:6000], language=language)
        summary = await self.provider.complete(prompt)
        return {"summary": summary, "provider": self.provider.name}

    async def _run_langchain(self, content: str, language: str) -> dict[str, Any]:
        """
        LangChain LCEL implementation – stub for future use.

        TODO:
            from langchain.prompts import PromptTemplate
            from langchain_core.output_parsers import StrOutputParser
            prompt = PromptTemplate(template=_PROMPT, input_variables=["content", "language"])
            chain = prompt | llm | StrOutputParser()
            summary = await chain.ainvoke({"content": content, "language": language})
        """
        prompt = _PROMPT.format(content=content[:6000], language=language)
        summary = await self.provider.complete(prompt)
        return {"summary": summary, "provider": self.provider.name}
