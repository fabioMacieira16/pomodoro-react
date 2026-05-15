from app.ai.chains.summarize import SummarizeChain
from app.ai.chains.extract_topics import ExtractTopicsChain
from app.ai.providers.base import AIProvider


class PDFService:
    """
    Service for PDF intelligence features.

    PDF text extraction uses pypdf (optional dep in requirements-ai.txt).
    Falls back to decoding as plain text when pypdf is unavailable.
    """

    def __init__(self, provider: AIProvider, use_langchain: bool = False):
        self._summarize = SummarizeChain(provider, use_langchain)
        self._extract = ExtractTopicsChain(provider, use_langchain)

    async def summarize(self, content: bytes | str, language: str = "pt") -> dict:
        text = self._extract_text(content)
        result = await self._summarize.run({"content": text, "language": language})
        result["word_count"] = len(text.split())
        return result

    async def extract_topics(self, content: bytes | str, language: str = "pt") -> dict:
        text = self._extract_text(content)
        return await self._extract.run({"content": text, "language": language})

    def _extract_text(self, content: bytes | str) -> str:
        if isinstance(content, str):
            return content
        try:
            import pypdf
            import io
            reader = pypdf.PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            return content.decode("utf-8", errors="replace")
        except Exception:
            return content.decode("utf-8", errors="replace")
