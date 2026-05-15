"""
Provider factory – instantiates the active AIProvider and Transcriber
based on AI_PROVIDER and related settings from .env / config.
"""
from app.core.config import settings as app_settings
from app.ai.providers.base import AIProvider, ProviderConfig
from app.ai.providers.mock import MockProvider
from app.ai.providers.openai import OpenAIProvider
from app.ai.providers.ollama import OllamaProvider
from app.ai.transcription.base import Transcriber
from app.ai.transcription.whisper import WhisperTranscriber


def get_provider() -> AIProvider:
    """Return the active LLM provider based on AI_PROVIDER config."""
    name = app_settings.AI_PROVIDER.lower()

    if name == "openai":
        return OpenAIProvider(
            api_key=app_settings.OPENAI_API_KEY,
            config=ProviderConfig(model=app_settings.OPENAI_MODEL),
        )

    if name == "ollama":
        return OllamaProvider(
            base_url=app_settings.OLLAMA_BASE_URL,
            model=app_settings.OLLAMA_MODEL,
            config=ProviderConfig(model=app_settings.OLLAMA_MODEL),
        )

    return MockProvider()


def get_transcriber() -> Transcriber:
    """Return the active transcription provider."""
    if app_settings.USE_WHISPER:
        return WhisperTranscriber(model_name=app_settings.WHISPER_MODEL)
    return _MockTranscriber()


class _MockTranscriber(Transcriber):
    """Development mock transcriber – active when USE_WHISPER=false."""

    def is_available(self) -> bool:
        return True

    async def transcribe(self, file_path, language: str = "pt") -> str:
        return (
            "[Mock Transcript] Configure USE_WHISPER=true e instale openai-whisper "
            "para transcrição real de áudio/vídeo."
        )
