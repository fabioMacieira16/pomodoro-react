from abc import ABC, abstractmethod
from pathlib import Path


class Transcriber(ABC):
    """Abstract base for audio/video transcription providers."""

    @abstractmethod
    async def transcribe(self, file_path: str | Path, language: str = "pt") -> str:
        """Transcribe audio/video file and return text."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if transcription backend is available."""
