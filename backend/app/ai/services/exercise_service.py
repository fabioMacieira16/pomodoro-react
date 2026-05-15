from app.ai.chains.generate import GenerateChain
from app.ai.providers.base import AIProvider


class ExerciseService:
    """Service for AI-powered exercise generation."""

    def __init__(self, provider: AIProvider, use_langchain: bool = False):
        self._chain = GenerateChain(provider, use_langchain)

    async def generate(
        self,
        content: str,
        count: int = 5,
        types: list[str] | None = None,
        language: str = "pt",
    ) -> dict:
        return await self._chain.run({
            "mode": "exercises",
            "content": content,
            "count": count,
            "types": types or ["multiple_choice"],
            "language": language,
        })
