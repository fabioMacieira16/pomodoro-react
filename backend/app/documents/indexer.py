"""Document Indexer Service.

Reads PDFs from the local filesystem (docs/concurso/disciplina/ structure),
extracts metadata, and stores in DocumentIndex.

Future stubs ready for:
- OCR (Tesseract / pytesseract)
- Heavy AI summarization (uncomment AI chain calls)
- Video/audio transcription (Whisper)
"""
import os
from pathlib import Path
from typing import Optional, List

from sqlalchemy.orm import Session

from app.domain.models import DocumentIndex, Subject
from app.documents.schemas import IndexDocumentRequest, DocumentOut, IndexingStatus
from app.core.config import settings


class DocumentIndexerService:

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    # ── Index single document ─────────────────────────────────────────────

    def index_document(self, req: IndexDocumentRequest) -> IndexingStatus:
        path = Path(req.file_path)
        if not path.exists():
            return IndexingStatus(
                document_id=-1,
                filename=path.name,
                status="failed",
                message=f"File not found: {req.file_path}",
            )

        # Detect context from path structure: docs/concurso/disciplina/file.pdf
        concurso, disciplina, doc_type = self._detect_context(path, req)

        # Find matching subject
        subject_id = req.subject_id or self._find_subject(disciplina)

        # Extract metadata
        meta = self._extract_metadata(path)

        # Upsert DocumentIndex
        existing = self.db.query(DocumentIndex).filter_by(
            user_id=self.user_id,
            file_path=str(path),
        ).first()

        if existing:
            doc = existing
        else:
            doc = DocumentIndex(
                user_id=self.user_id,
                filename=path.name,
                file_path=str(path),
            )
            self.db.add(doc)

        doc.file_type = path.suffix.lstrip(".").lower()
        doc.file_size_kb = meta.get("file_size_kb")
        doc.concurso = concurso
        doc.disciplina = disciplina
        doc.doc_type = doc_type
        doc.page_count = meta.get("page_count")
        doc.subject_id = subject_id
        doc.metadata_json = meta
        doc.is_indexed = True

        self.db.commit()
        self.db.refresh(doc)

        return IndexingStatus(
            document_id=doc.id,
            filename=doc.filename,
            status="indexed",
            message=f"Indexed {doc.page_count or '?'} pages from {doc.filename}",
        )

    # ── Scan directory ───────────────────────────────────────────────────

    def scan_directory(self, directory: str) -> List[IndexingStatus]:
        base = Path(directory)
        if not base.is_dir():
            return [IndexingStatus(document_id=-1, filename=directory, status="failed",
                                   message="Directory not found")]
        results = []
        for pdf in base.rglob("*.pdf"):
            req = IndexDocumentRequest(file_path=str(pdf))
            results.append(self.index_document(req))
        return results

    # ── List documents ────────────────────────────────────────────────────

    def list_documents(
        self,
        concurso: Optional[str] = None,
        disciplina: Optional[str] = None,
    ) -> List[DocumentOut]:
        q = self.db.query(DocumentIndex).filter_by(user_id=self.user_id)
        if concurso:
            q = q.filter(DocumentIndex.concurso == concurso)
        if disciplina:
            q = q.filter(DocumentIndex.disciplina == disciplina)
        return [DocumentOut.model_validate(d) for d in q.order_by(DocumentIndex.indexed_at.desc()).all()]

    def delete_document(self, doc_id: int) -> bool:
        doc = self.db.query(DocumentIndex).filter_by(id=doc_id, user_id=self.user_id).first()
        if not doc:
            return False
        self.db.delete(doc)
        self.db.commit()
        return True

    # ── Internal helpers ──────────────────────────────────────────────────

    def _detect_context(self, path: Path, req: IndexDocumentRequest):
        """Detect concurso/disciplina/doc_type from path structure.

        Expected: .../docs/<concurso>/<disciplina>/<file>.pdf
        """
        parts = path.parts
        concurso = req.concurso
        disciplina = req.disciplina
        doc_type = req.doc_type or "material"

        # Try to find 'docs' anchor in path
        try:
            docs_idx = next(i for i, p in enumerate(parts) if p.lower() == "docs")
            if concurso is None and docs_idx + 1 < len(parts) - 1:
                concurso = parts[docs_idx + 1]
            if disciplina is None and docs_idx + 2 < len(parts) - 1:
                disciplina = parts[docs_idx + 2]
        except StopIteration:
            pass

        # Detect doc_type from filename
        fname_lower = path.name.lower()
        if "edital" in fname_lower:
            doc_type = "edital"
        elif any(k in fname_lower for k in ("questao", "questoes", "simulado", "prova")):
            doc_type = "questoes"

        return concurso, disciplina, doc_type

    def _find_subject(self, disciplina: Optional[str]) -> Optional[int]:
        if not disciplina:
            return None
        # Fuzzy match: find subject whose name contains disciplina (case-insensitive)
        subjs = self.db.query(Subject).all()
        disciplina_lower = disciplina.lower().replace("-", " ")
        for s in subjs:
            if disciplina_lower in s.name.lower() or s.name.lower() in disciplina_lower:
                return s.id
        return None

    def _extract_metadata(self, path: Path) -> dict:
        """Extract basic metadata from PDF.

        Heavy extraction (PyMuPDF/pdfminer) is a future stub.
        Currently reads file size and page count if PyMuPDF available.
        """
        meta: dict = {}
        try:
            meta["file_size_kb"] = path.stat().st_size // 1024
        except OSError:
            pass

        # Try PyMuPDF (fitz) if installed
        try:
            import fitz  # type: ignore
            doc = fitz.open(str(path))
            meta["page_count"] = len(doc)
            meta["title"] = doc.metadata.get("title", "")
            meta["author"] = doc.metadata.get("author", "")
            doc.close()
        except ImportError:
            meta["page_count"] = None
            meta["note"] = "Install PyMuPDF (pip install pymupdf) for page count extraction"
        except Exception as e:
            meta["error"] = str(e)

        # Future stubs:
        # - OCR: pytesseract.image_to_string(page_image)
        # - AI summary: await summarize_chain.run(text)
        # - Topic extraction: await extract_topics_chain.run(text)

        return meta
