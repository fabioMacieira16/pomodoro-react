from pathlib import Path

from .base import Transcriber


class WhisperTranscriber(Transcriber):
    """
    Whisper-based transcription provider.

    Falls back to a mock message if `openai-whisper` is not installed.
    Set USE_WHISPER=true and WHISPER_MODEL=base|small|medium|large in .env.
    """

    def __init__(self, model_name: str = "base"):
        self._model_name = model_name
        self._model = None

    def is_available(self) -> bool:
        try:
            import whisper  # noqa: F401
            return True
        except ImportError:
            return False

    def _load_model(self):
        if self._model is None:
            import whisper
            self._model = whisper.load_model(self._model_name)

    async def transcribe(self, file_path: str | Path, language: str = "pt") -> str:
        if not self.is_available():
            return (
                "[Mock Transcription] openai-whisper não está instalado. "
                "Execute: pip install openai-whisper"
            )
        self._load_model()
        result = self._model.transcribe(str(file_path), language=language)
        return result.get("text", "")
