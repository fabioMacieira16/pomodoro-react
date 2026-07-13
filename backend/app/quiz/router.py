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
from app.settings.service import settings_service

router = APIRouter(prefix="/quiz", tags=["quiz"])


def _svc(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> QuizService:
    setting = settings_service.get_or_create(db, current_user.id)
    return QuizService(db=db, user_id=current_user.id, user_setting=setting)


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


@router.post("/bank", response_model=QuizSessionOut, summary="Get existing questions from question bank (no generation)")
def get_question_bank(
    req: QuizGenerateRequest,
    pomodoro_session_id: Optional[int] = None,
    svc: QuizService = Depends(_svc),
):
    """
    Busca questões já geradas/armazenadas no banco de dados para a disciplina.
    Diferente do /generate, este endpoint NÃO gera novas questões via IA.
    """
    try:
        return svc.get_question_bank(req, pomodoro_session_id)
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

    setting = settings_service.get_or_create(db, current_user.id)
    svc = QuizService(db=db, user_id=current_user.id, user_setting=setting)
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


@router.post(
    "/import-csv",
    summary="Importar questões de múltipla escolha via CSV",
)
async def import_csv_questions(
    file: UploadFile = File(...),
    deck_id: Optional[int] = Form(None),
    default_assunto: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Importa questões de múltipla escolha a partir de um CSV com cabeçalho.

    Colunas obrigatórias: enunciado, a, b, c, d, gabarito
    Colunas opcionais: disciplina, e, explicacao, dificuldade, banca, ano

    deck_id: quando fornecido, cria flashcards multiple_choice no deck para exibição na lista.
    default_assunto: tag de assunto usada quando o CSV não tem coluna disciplina.
    """
    raw = await file.read()
    svc = QuizService(db=db, user_id=current_user.id)
    result = svc.import_csv(raw, deck_id=deck_id, default_assunto=default_assunto)
    if result["imported"] == 0 and result["errors"]:
        raise HTTPException(status_code=400, detail=result["errors"][0])
    return result


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
