from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


class IndexDocumentRequest(BaseModel):
    """Request to index a document from the local filesystem."""
    file_path: str
    # Optional overrides (auto-detected from path if not provided)
    concurso: Optional[str] = None
    disciplina: Optional[str] = None
    doc_type: Optional[str] = None   # edital / material / questoes
    subject_id: Optional[int] = None


class DocumentOut(BaseModel):
    id: int
    filename: str
    file_path: str
    file_type: str
    file_size_kb: Optional[int]
    concurso: Optional[str]
    disciplina: Optional[str]
    doc_type: str
    page_count: Optional[int]
    summary: Optional[str]
    topics_json: Optional[list]
    is_indexed: bool
    indexed_at: datetime

    class Config:
        from_attributes = True


class IndexingStatus(BaseModel):
    document_id: int
    filename: str
    status: str   # pending / indexed / failed
    message: Optional[str] = None


class ScanDirectoryRequest(BaseModel):
    """Scan a directory and index all PDFs found."""
    directory_path: str  # e.g. /home/user/docs or C:/Users/user/docs
