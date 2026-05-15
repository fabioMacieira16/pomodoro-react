"""
AI Module router – unified /api/ai/* endpoints.

All endpoints work out-of-the-box with the Mock provider.
Switch providers via AI_PROVIDER in .env (openai | ollama | mock).
"""
from __future__ import annotations

import base64
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from app.ai import dtos
from app.ai.factory import get_provider, get_transcriber
from app.ai.services.pdf_service import PDFService
from app.ai.services.exercise_service import ExerciseService
from app.ai.services.flashcard_service import FlashcardService
from app.ai.services.mindmap_service import MindMapService
from app.ai.services.media_service import MediaService
from app.api.dependencies import get_current_user
from app.core.config import settings as app_settings
from app.domain.models import User

router = APIRouter(prefix="/ai", tags=["ai-module"])


# ── Health ─────────────────────────────────────────────────────────────────────

@router.get("/health", response_model=dtos.AIHealthResponse)
def ai_health():
    """Check which AI provider and features are active."""
    provider = get_provider()
    transcriber = get_transcriber()

    langchain_ok = False
    try:
        import langchain  # noqa: F401
        langchain_ok = True
    except ImportError:
        pass

    return dtos.AIHealthResponse(
        status="ok",
        provider=dtos.AIProviderInfo(name=provider.name, is_available=provider.is_available()),
        transcription_available=transcriber.is_available(),
        langchain_available=langchain_ok,
        features=[
            "pdf/summarize",
            "pdf/topics",
            "exercises/generate",
            "flashcards/generate",
            "mindmap/generate",
            "audio/summarize",
            "video/summarize",
        ],
    )


# ── PDF ────────────────────────────────────────────────────────────────────────

@router.post("/pdf/summarize", response_model=dtos.PDFSummarizeResponse)
async def pdf_summarize(
    req: dtos.PDFSummarizeRequest,
    current_user: User = Depends(get_current_user),
):
    """Summarize PDF or text content."""
    content = _resolve_content(req.content, req.is_base64)
    service = PDFService(get_provider(), app_settings.USE_LANGCHAIN)
    result = await service.summarize(content, req.language)
    return dtos.PDFSummarizeResponse(**result)


@router.post("/pdf/summarize/upload", response_model=dtos.PDFSummarizeResponse)
async def pdf_summarize_upload(
    file: UploadFile = File(...),
    language: str = Form("pt"),
    current_user: User = Depends(get_current_user),
):
    """Upload a PDF file and receive a summary."""
    content = await file.read()
    service = PDFService(get_provider(), app_settings.USE_LANGCHAIN)
    result = await service.summarize(content, language)
    return dtos.PDFSummarizeResponse(**result)


@router.post("/pdf/topics", response_model=dtos.PDFTopicsResponse)
async def pdf_topics(
    req: dtos.PDFTopicsRequest,
    current_user: User = Depends(get_current_user),
):
    """Extract main topics from PDF or text content."""
    content = _resolve_content(req.content, req.is_base64)
    service = PDFService(get_provider(), app_settings.USE_LANGCHAIN)
    result = await service.extract_topics(content, req.language)
    topics = [dtos.TopicItem(**t) for t in result.get("topics", [])]
    return dtos.PDFTopicsResponse(topics=topics, provider=result["provider"])


@router.post("/pdf/topics/upload", response_model=dtos.PDFTopicsResponse)
async def pdf_topics_upload(
    file: UploadFile = File(...),
    language: str = Form("pt"),
    current_user: User = Depends(get_current_user),
):
    """Upload a PDF file and receive extracted topics."""
    content = await file.read()
    service = PDFService(get_provider(), app_settings.USE_LANGCHAIN)
    result = await service.extract_topics(content, language)
    topics = [dtos.TopicItem(**t) for t in result.get("topics", [])]
    return dtos.PDFTopicsResponse(topics=topics, provider=result["provider"])


# ── Exercises ──────────────────────────────────────────────────────────────────

@router.post("/exercises/generate", response_model=dtos.ExerciseGenerateResponse)
async def exercises_generate(
    req: dtos.ExerciseGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate educational exercises from text content."""
    service = ExerciseService(get_provider(), app_settings.USE_LANGCHAIN)
    result = await service.generate(req.content, req.count, req.types, req.language)
    exercises = [dtos.ExerciseItem(**e) for e in result.get("exercises", [])]
    return dtos.ExerciseGenerateResponse(exercises=exercises, provider=result["provider"])


# ── Flashcards ─────────────────────────────────────────────────────────────────

@router.post("/flashcards/generate", response_model=dtos.FlashcardGenerateResponse)
async def flashcards_generate(
    req: dtos.FlashcardGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate flashcards from text content."""
    service = FlashcardService(get_provider(), app_settings.USE_LANGCHAIN)
    result = await service.generate(req.content, req.count, req.types, req.language)
    cards = [dtos.FlashcardItem(**c) for c in result.get("flashcards", [])]
    return dtos.FlashcardGenerateResponse(flashcards=cards, provider=result["provider"])


# ── Mind Map ───────────────────────────────────────────────────────────────────

@router.post("/mindmap/generate", response_model=dtos.MindMapResponse)
async def mindmap_generate(
    req: dtos.MindMapRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a mind map structure from text content."""
    service = MindMapService(get_provider(), app_settings.USE_LANGCHAIN)
    result = await service.generate(req.content, req.language)
    mindmap = result.get("mindmap", {})
    return dtos.MindMapResponse(
        title=mindmap.get("title", "Mapa Mental"),
        nodes=[dtos.MindMapNode(**n) for n in mindmap.get("nodes", [])],
        provider=result["provider"],
    )


# ── Audio ──────────────────────────────────────────────────────────────────────

@router.post("/audio/summarize", response_model=dtos.MediaSummarizeResponse)
async def audio_summarize(
    file: UploadFile = File(...),
    language: str = Form("pt"),
    current_user: User = Depends(get_current_user),
):
    """Upload an audio file, transcribe with Whisper, and summarize."""
    result = await _process_media(file, language)
    return dtos.MediaSummarizeResponse(**result)


# ── Video ──────────────────────────────────────────────────────────────────────

@router.post("/video/summarize", response_model=dtos.MediaSummarizeResponse)
async def video_summarize(
    file: UploadFile = File(...),
    language: str = Form("pt"),
    current_user: User = Depends(get_current_user),
):
    """Upload a video file, extract audio, transcribe, and summarize."""
    result = await _process_media(file, language)
    return dtos.MediaSummarizeResponse(**result)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _resolve_content(content: str, is_base64: bool) -> bytes | str:
    """Decode base64 PDF bytes or return plain text as-is."""
    if is_base64:
        try:
            return base64.b64decode(content)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid base64 content: {exc}")
    return content


async def _process_media(file: UploadFile, language: str) -> dict:
    """Save upload to temp file and run media service."""
    data = await file.read()
    suffix = Path(file.filename or "media").suffix or ".tmp"
    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)
    try:
        service = MediaService(get_provider(), get_transcriber(), app_settings.USE_LANGCHAIN)
        return await service.summarize_audio(tmp_path, language)
    finally:
        tmp_path.unlink(missing_ok=True)
