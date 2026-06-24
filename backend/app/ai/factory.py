"""
Provider factory – instantiates the active AIProvider and Transcriber.

Resolution order: per-user Setting (chosen in Configurações) overrides the
server-level AI_PROVIDER / .env values when present.
"""
from typing import TYPE_CHECKING, Optional

from app.core.config import settings as app_settings
from app.core.crypto import decrypt_secret
from app.ai.providers.base import AIProvider, ProviderConfig
from app.ai.providers.mock import MockProvider
from app.ai.providers.openai import OpenAIProvider
from app.ai.providers.ollama import OllamaProvider
from app.ai.transcription.base import Transcriber
from app.ai.transcription.whisper import WhisperTranscriber

if TYPE_CHECKING:
    from app.domain.models import Setting


def get_provider(user_setting: Optional["Setting"] = None) -> AIProvider:
    """Return the active LLM provider, honoring a user's saved preference if any."""
    name = (
        (user_setting.ai_provider_preference if user_setting and user_setting.ai_provider_preference else "")
        or app_settings.AI_PROVIDER
    ).lower()

    if name == "openai":
        api_key = app_settings.OPENAI_API_KEY
        if user_setting and user_setting.ai_api_key_encrypted:
            api_key = decrypt_secret(user_setting.ai_api_key_encrypted) or api_key
        return OpenAIProvider(
            api_key=api_key,
            config=ProviderConfig(model=app_settings.OPENAI_MODEL),
        )

    if name == "ollama":
        base_url = (user_setting and user_setting.ollama_base_url) or app_settings.OLLAMA_BASE_URL
        model = (user_setting and user_setting.ollama_model) or app_settings.OLLAMA_MODEL
        return OllamaProvider(
            base_url=base_url,
            model=model,
            config=ProviderConfig(model=model),
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
