"""
Mind Map Generator — Gera mapas mentais a partir de documentos ou disciplinas.

Usa IA para extrair a estrutura hierárquica de tópicos e subtópicos.
"""
import asyncio
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.data.database import get_db
from app.api.dependencies import get_current_user
from app.domain.models import User, DocumentIndex
from app.ai.factory import get_provider
from app.core.study_context import StudyContextService

router = APIRouter(prefix="/mindmap", tags=["mindmap"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class MindMapNode(BaseModel):
    id: str
    label: str
    level: int
    children: List["MindMapNode"] = []
    color: Optional[str] = None
    importance: int = 1  # 1-3


MindMapNode.model_rebuild()


class MindMapResponse(BaseModel):
    root: MindMapNode
    subject: str
    source: str  # "document" | "ai_context" | "study_context"
    total_nodes: int


class GenerateMindMapRequest(BaseModel):
    subject_name: Optional[str] = None
    document_id: Optional[int] = None
    depth: int = 3  # max depth levels


# ── Colors per level ─────────────────────────────────────────────────────────

LEVEL_COLORS = {
    0: "#667eea",   # root - purple
    1: "#764ba2",   # level 1 - dark purple
    2: "#10b981",   # level 2 - green
    3: "#f59e0b",   # level 3 - amber
    4: "#ef4444",   # level 4 - red
}


# ── Route ────────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=MindMapResponse, summary="Generate mind map for a subject or document")
async def generate_mindmap(
    req: GenerateMindMapRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = get_provider()
    if not provider.is_available():
        raise HTTPException(status_code=503, detail="AI provider not available")

    ctx = StudyContextService.get_context()
    text_source = ""
    subject_name = req.subject_name or "Conhecimentos Gerais"
    source_type = "ai_context"

    # Se tem document_id, usa o texto do documento
    if req.document_id:
        doc = db.query(DocumentIndex).filter_by(id=req.document_id, user_id=current_user.id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        subject_name = doc.disciplina or doc.filename
        source_type = "document"

        # Extrair texto do PDF
        try:
            text_source = _extract_pdf_text(doc.file_path, max_chars=20000)
        except Exception:
            text_source = ""

        if doc.summary:
            text_source = doc.summary + "\n\n" + (doc.topics_json or "")

    # Contexto extra do concurso
    context_hint = ""
    if ctx.concurso:
        context_hint = f"Contexto: concurso {ctx.concurso}"
        if ctx.banca:
            context_hint += f", banca {ctx.banca}"

    # Prompt para geração do mapa mental
    if text_source:
        prompt = f"""
Analise o texto abaixo sobre {subject_name} e gere um mapa mental hierárquico.
{context_hint}

Texto:
{text_source[:15000]}

Retorne APENAS JSON válido no formato:
{{
  "root": {{
    "label": "{subject_name}",
    "children": [
      {{
        "label": "Tópico Principal 1",
        "importance": 3,
        "children": [
          {{"label": "Subtópico 1.1", "importance": 2, "children": []}},
          {{"label": "Subtópico 1.2", "importance": 2, "children": []}}
        ]
      }},
      {{
        "label": "Tópico Principal 2",
        "importance": 2,
        "children": []
      }}
    ]
  }}
}}

Regras:
- Máximo {req.depth} níveis de profundidade
- Máximo 7 filhos por nó
- importance: 1=baixo, 2=médio, 3=alto (tópicos mais cobrados em concursos)
- Labels concisos (máximo 5 palavras)
- Foque nos tópicos mais importantes para provas
"""
    else:
        prompt = f"""
Gere um mapa mental completo sobre {subject_name} para concursos públicos.
{context_hint}

Retorne APENAS JSON válido no formato:
{{
  "root": {{
    "label": "{subject_name}",
    "children": [
      {{
        "label": "Tópico 1",
        "importance": 3,
        "children": [
          {{"label": "Subtópico 1.1", "importance": 2, "children": []}},
          {{"label": "Subtópico 1.2", "importance": 1, "children": []}}
        ]
      }}
    ]
  }}
}}

Regras:
- Máximo {req.depth} níveis de profundidade
- Máximo 7 filhos por nó
- importance: 1=baixo, 2=médio, 3=alto
- Foque nos tópicos mais cobrados em concursos públicos do Brasil
- Labels concisos (máximo 5 palavras)
"""

    try:
        raw = await provider.complete_json(prompt)
        if not isinstance(raw, dict) or "root" not in raw:
            raise HTTPException(status_code=500, detail="IA retornou estrutura inválida")

        root_node = _build_node(raw["root"], level=0, counter=[0])
        total = _count_nodes(root_node)

        return MindMapResponse(
            root=root_node,
            subject=subject_name,
            source=source_type,
            total_nodes=total,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar mapa mental: {str(e)}")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _build_node(data: dict, level: int, counter: List[int]) -> MindMapNode:
    counter[0] += 1
    node_id = f"node-{counter[0]}"
    label = str(data.get("label", "")).strip() or "Tópico"
    importance = int(data.get("importance", 1))
    children_data = data.get("children", [])

    children = []
    if isinstance(children_data, list):
        for child in children_data[:7]:  # max 7 children
            if isinstance(child, dict):
                children.append(_build_node(child, level + 1, counter))

    return MindMapNode(
        id=node_id,
        label=label[:60],  # truncate long labels
        level=level,
        children=children,
        color=LEVEL_COLORS.get(level, "#94a3b8"),
        importance=max(1, min(3, importance)),
    )


def _count_nodes(node: MindMapNode) -> int:
    return 1 + sum(_count_nodes(c) for c in node.children)


def _extract_pdf_text(file_path: str, max_chars: int = 20000) -> str:
    try:
        import fitz
        doc = fitz.open(file_path)
        text = "\n".join(page.get_text("text") for page in doc)
        doc.close()
        return text[:max_chars]
    except Exception:
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text = "\n".join(p.extract_text() or "" for p in reader.pages)
            return text[:max_chars]
        except Exception:
            return ""
