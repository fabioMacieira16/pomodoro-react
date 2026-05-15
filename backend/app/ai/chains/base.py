from abc import ABC, abstractmethod
from typing import Any

from app.ai.providers.base import AIProvider


class BaseChain(ABC):
    """
    Abstract base for LangChain-compatible chains.

    When USE_LANGCHAIN=true and langchain is installed, subclasses
    should wire up LangChain LCEL chains. Otherwise they fall back
    to direct provider calls.
    """

    def __init__(self, provider: AIProvider, use_langchain: bool = False):
        self.provider = provider
        self.use_langchain = use_langchain

    @abstractmethod
    async def run(self, inputs: dict[str, Any]) -> dict[str, Any]:
        """Execute the chain with the given inputs and return outputs."""

    def _langchain_available(self) -> bool:
        try:
            import langchain  # noqa: F401
            return True
        except ImportError:
            return False
