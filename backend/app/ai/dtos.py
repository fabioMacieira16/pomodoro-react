from __future__ import annotations
from pydantic import BaseModel
from typing import Optional


# ── Shared ────────────────────────────────────────────────────────────────────

class AIProviderInfo(BaseModel):
    name: str
    is_available: bool


# ── PDF ───────────────────────────────────────────────────────────────────────

class PDFSummarizeRequest(BaseModel):
    content: str  # plain text or base64-encoded PDF bytes
    language: str = "pt"
    is_base64: bool = False  # set True when content is base64 PDF


class PDFSummarizeResponse(BaseModel):
    summary: str
    word_count: int
    provider: str


class PDFTopicsRequest(BaseModel):
    content: str
    language: str = "pt"
    is_base64: bool = False


class TopicItem(BaseModel):
    title: str
    description: str
    keywords: list[str] = []


class PDFTopicsResponse(BaseModel):
    topics: list[TopicItem]
    provider: str


# ── Exercises ─────────────────────────────────────────────────────────────────

class ExerciseGenerateRequest(BaseModel):
    content: str
    count: int = 5
    types: list[str] = ["multiple_choice"]  # multiple_choice | open | true_false
    language: str = "pt"


class ExerciseItem(BaseModel):
    question: str
    type: str
    options: list[str] = []
    answer: str
    explanation: str = ""
    difficulty: str = "Medium"


class ExerciseGenerateResponse(BaseModel):
    exercises: list[ExerciseItem]
    provider: str


# ── Flashcards ────────────────────────────────────────────────────────────────

class FlashcardGenerateRequest(BaseModel):
    content: str
    count: int = 10
    types: list[str] = ["qa"]  # qa | cloze | true_false
    language: str = "pt"


class FlashcardItem(BaseModel):
    front: str
    back: str
    tags: list[str] = []
    difficulty: str = "Medium"


class FlashcardGenerateResponse(BaseModel):
    flashcards: list[FlashcardItem]
    provider: str


# ── Mind Map ──────────────────────────────────────────────────────────────────

class MindMapRequest(BaseModel):
    content: str
    language: str = "pt"


class MindMapNode(BaseModel):
    id: str
    label: str
    children: list[MindMapNode] = []

MindMapNode.model_rebuild()


class MindMapResponse(BaseModel):
    title: str
    nodes: list[MindMapNode]
    provider: str


# ── Audio / Video ─────────────────────────────────────────────────────────────

class MediaSummarizeResponse(BaseModel):
    transcript: str
    summary: str
    key_points: list[str] = []
    provider: str


# ── Health ────────────────────────────────────────────────────────────────────

class AIHealthResponse(BaseModel):
    status: str
    provider: AIProviderInfo
    transcription_available: bool
    langchain_available: bool
    features: list[str]
