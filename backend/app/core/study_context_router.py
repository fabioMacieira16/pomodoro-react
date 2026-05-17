"""
Study Context Router - Endpoints para gerenciar o contexto global de estudos
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from datetime import datetime

from app.core.study_context import StudyContextService, StudyContext, ReviewItem

router = APIRouter(prefix="/study-context", tags=["study-context"])


@router.get("", response_model=StudyContext)
def get_context():
    """Retorna o contexto atual de estudos"""
    return StudyContextService.get_context()


@router.put("", response_model=StudyContext)
def update_context(updates: Dict[str, Any]):
    """Atualiza campos do contexto"""
    try:
        return StudyContextService.update_context(**updates)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reset", response_model=StudyContext)
def reset_context():
    """Reseta o contexto de estudos"""
    return StudyContextService.reset_context()


@router.post("/performance", response_model=StudyContext)
def add_performance(
    subject: str,
    correct: bool,
    study_time: float = 0.0
):
    """Registra desempenho em uma disciplina"""
    StudyContextService.add_performance(subject, correct, study_time)
    return StudyContextService.get_context()


@router.post("/review", response_model=StudyContext)
def add_review(
    subject: str,
    topic: str,
    days_ahead: int = 1
):
    """Adiciona uma revisão pendente"""
    StudyContextService.add_review(subject, topic, days_ahead)
    return StudyContextService.get_context()


@router.get("/todays-subjects")
def get_todays_subjects():
    """Retorna as disciplinas do dia atual"""
    subjects = StudyContextService.get_todays_subjects()
    return {"subjects": subjects}


@router.get("/weak-subjects")
def get_weak_subjects():
    """Retorna disciplinas com baixo desempenho"""
    weak = StudyContextService.get_weak_subjects()
    return {"performances": weak}


@router.get("/pending-reviews")
def get_pending_reviews(subject: str = None):
    """Retorna revisões pendentes"""
    if subject:
        reviews = StudyContextService.get_pending_reviews_for_subject(subject)
    else:
        ctx = StudyContextService.get_context()
        now = datetime.now()
        reviews = [r for r in ctx.pending_reviews if r.scheduled_for <= now]
    
    return {"reviews": reviews}


@router.get("/ai-context")
def get_ai_context():
    """Retorna o contexto formatado para a IA"""
    prompt = StudyContextService.get_ai_prompt_context()
    return {"prompt": prompt}
