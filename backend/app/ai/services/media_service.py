from pathlib import Path

from app.ai.chains.summarize import SummarizeChain
from app.ai.chains.extract_topics import ExtractTopicsChain
from app.ai.providers.base import AIProvider
from app.ai.transcription.base import Transcriber


class MediaService:
    """Service for audio and video summarization using Whisper + LLM."""

    def __init__(
        self,
        provider: AIProvider,
        transcriber: Transcriber,
        use_langchain: bool = False,
    ):
        self._transcriber = transcriber
        self._summarize = SummarizeChain(provider, use_langchain)
        self._extract = ExtractTopicsChain(provider, use_langchain)

    async def summarize_audio(
        self, file_path: str | Path, language: str = "pt"
    ) -> dict:
        transcript = await self._transcriber.transcribe(file_path, language)
        summary_result = await self._summarize.run({"content": transcript, "language": language})
        topics_result = await self._extract.run({"content": transcript, "language": language})
        return {
            "transcript": transcript,
            "summary": summary_result["summary"],
            "key_points": [t["title"] for t in topics_result.get("topics", [])],
            "provider": summary_result["provider"],
        }

    async def summarize_video(
        self, file_path: str | Path, language: str = "pt"
    ) -> dict:
        audio_path = await self._extract_audio_from_video(file_path)
        return await self.summarize_audio(audio_path, language)

    async def _extract_audio_from_video(self, video_path: str | Path) -> Path:
        """
        Extract audio track from video using ffmpeg (stub).

        In production:
            ffmpeg -i video.mp4 -q:a 0 -map a audio.mp3

        TODO: implement with subprocess + ffmpeg
        Whisper also accepts video files directly, so this is a pass-through for now.
        """
        return Path(video_path)
