from pathlib import Path
from typing import Optional, List
import shutil
from fastapi import APIRouter, Depends, HTTPException
from fastapi import UploadFile, File, Form
from sqlalchemy.orm import Session

from app.data.database import get_db
from app.api.dependencies import get_current_user
from app.domain.models import User
from app.documents.schemas import (
    IndexDocumentRequest, DocumentOut, IndexingStatus, ScanDirectoryRequest
)
from app.documents.indexer import DocumentIndexerService

router = APIRouter(prefix="/docs", tags=["documents"])


def _svc(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return DocumentIndexerService(db=db, user_id=current_user.id)


@router.post("/index", response_model=IndexingStatus, summary="Index a single document")
def index_document(
    req: IndexDocumentRequest,
    svc: DocumentIndexerService = Depends(_svc),
):
    return svc.index_document(req)


@router.post("/upload", response_model=IndexingStatus, summary="Upload and index a PDF document")
async def upload_document(
    file: UploadFile = File(...),
    concurso: Optional[str] = Form(None),
    disciplina: Optional[str] = Form(None),
    doc_type: Optional[str] = Form(None),
    svc: DocumentIndexerService = Depends(_svc),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    suffix = Path(file.filename).suffix.lower()
    if suffix != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    repo_root = Path(__file__).resolve().parents[3]
    target_dir = repo_root / "docs" / (concurso or "uploads") / (disciplina or "geral")
    target_dir.mkdir(parents=True, exist_ok=True)

    target_path = target_dir / file.filename
    with target_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return svc.index_document(
        IndexDocumentRequest(
            file_path=str(target_path),
            concurso=concurso,
            disciplina=disciplina,
            doc_type=doc_type,
        )
    )


@router.post("/scan", response_model=List[IndexingStatus], summary="Scan directory and index all PDFs")
def scan_directory(
    req: ScanDirectoryRequest,
    svc: DocumentIndexerService = Depends(_svc),
):
    return svc.scan_directory(req.directory_path)


@router.get("/", response_model=List[DocumentOut], summary="List indexed documents")
def list_documents(
    concurso: Optional[str] = None,
    disciplina: Optional[str] = None,
    svc: DocumentIndexerService = Depends(_svc),
):
    return svc.list_documents(concurso=concurso, disciplina=disciplina)


@router.delete("/{doc_id}", summary="Remove document from index")
def delete_document(
    doc_id: int,
    svc: DocumentIndexerService = Depends(_svc),
):
    if not svc.delete_document(doc_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document removed from index"}
