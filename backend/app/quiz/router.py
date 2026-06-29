from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.ai.factory import get_provider
from app.ai.services.pdf_service import PDFService
from app.data.database import get_db
from app.api.dependencies import get_current_user
from app.domain.models import User, QuizSession
from app.quiz.schemas import (
    QuizGenerateRequest, QuizSessionOut, QuizAnswerRequest,
    QuizAnswerResult, PomodoroQuizMode
)
from app.quiz.service import QuizService

router = APIRouter(prefix="/quiz", tags=["quiz"])


def _svc(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> QuizService:
    return QuizService(db=db, user_id=current_user.id)


@router.get("/mode", response_model=PomodoroQuizMode, summary="Decide quiz/study/revision mode for current Pomodoro")
def get_mode(
    pomodoro_number: int = 1,
    subject_id: Optional[int] = None,
    svc: QuizService = Depends(_svc),
):
    return svc.decide_pomodoro_mode(pomodoro_number, subject_id)


@router.post("/generate", response_model=QuizSessionOut, summary="Generate a quiz for a subject")
def generate_quiz(
    req: QuizGenerateRequest,
    pomodoro_session_id: Optional[int] = None,
    svc: QuizService = Depends(_svc),
):
    try:
        return svc.generate_quiz(req, pomodoro_session_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/generate-from-pdf",
    response_model=QuizSessionOut,
    summary="Generate a multiple-choice quiz from an uploaded PDF (e.g. a past exam)",
)
async def generate_quiz_from_pdf(
    file: UploadFile = File(...),
    num_questions: int = Form(10),
    subject_id: Optional[int] = Form(None),
    pomodoro_session_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raw_bytes = await file.read()
    text = PDFService(get_provider())._extract_text(raw_bytes)
    if len(text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail=(
                "Não foi possível extrair texto suficiente do PDF. "
                "Se o arquivo for escaneado/imagem (sem texto selecionável), "
                "ele precisa passar por OCR antes de ser importado."
            ),
        )

    svc = QuizService(db=db, user_id=current_user.id)
    try:
        return await svc.generate_quiz_from_pdf(text, num_questions, subject_id, pomodoro_session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/answer", response_model=QuizAnswerResult, summary="Submit an answer; auto-creates flashcard if wrong")
def submit_answer(
    req: QuizAnswerRequest,
    svc: QuizService = Depends(_svc),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = svc.submit_answer(req)
        try:
            from app.achievements.service import AchievementService
            event = "QUIZ_CORRECT" if result.is_correct else "QUIZ_WRONG"
            AchievementService(db).register_event(current_user.id, event)
        except Exception:
            pass
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/session/{session_id}", response_model=QuizSessionOut, summary="Get quiz session details")
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(QuizSession).filter_by(id=session_id, user_id=current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session.id,
        "subject_id": session.subject_id,
        "questions": [],
        "total_questions": session.total_questions,
        "difficulty_level": session.difficulty_level,
        "session_mode": session.session_mode,
    }
