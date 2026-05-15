from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ProviderConfig:
    model: str
    temperature: float = 0.7
    max_tokens: int = 2048
    timeout: int = 60


class AIProvider(ABC):
    """Abstract base class for LLM providers."""

    def __init__(self, config: ProviderConfig):
        self.config = config

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name."""

    @abstractmethod
    async def complete(self, prompt: str) -> str:
        """Send a prompt and return the text completion."""

    @abstractmethod
    async def complete_json(self, prompt: str) -> Any:
        """Send a prompt expecting a JSON response; return parsed object."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if the provider is properly configured and reachable."""
