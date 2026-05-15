from app.ai.chains.generate import GenerateChain
from app.ai.providers.base import AIProvider


class MindMapService:
    """Service for AI-powered mind map generation."""

    def __init__(self, provider: AIProvider, use_langchain: bool = False):
        self._chain = GenerateChain(provider, use_langchain)

    async def generate(self, content: str, language: str = "pt") -> dict:
        return await self._chain.run({
            "mode": "mindmap",
            "content": content,
            "language": language,
        })
