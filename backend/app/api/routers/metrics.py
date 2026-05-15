"""Advanced metrics and study recommendations endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List

from app.data.database import get_db
from app.core.security import get_current_user
from app.domain.models import (
    User, ExerciseAttempt, PomodoroSession, Flashcard,
    Subject, Exam, ExamTopic, StudyPlanConfig,
)

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/recommendations", summary="Study recommendations based on performance")
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns subjects the user should prioritise, ranked by:
    - error rate (higher = more urgent)
    - exam topic weight / incidencia
    - days since last studied
    """
    subjects = db.query(Subject).filter_by(user_id=current_user.id).all()
    recommendations = []

    for subj in subjects:
        # Error rate for this subject
        total = db.query(ExerciseAttempt).filter_by(
            user_id=current_user.id, subject_id=subj.id
        ).count()
        wrong = db.query(ExerciseAttempt).filter_by(
            user_id=current_user.id, subject_id=subj.id, is_correct=False
        ).count()
        error_rate = (wrong / total * 100) if total > 0 else 0

        # Days since last studied
        last_session = (
            db.query(PomodoroSession)
            .filter_by(user_id=current_user.id, subject_id=subj.id)
            .order_by(PomodoroSession.created_at.desc())
            .first()
        )
        days_since = (
            (datetime.utcnow() - last_session.created_at).days
            if last_session else 999
        )

        # Urgency score
        urgency_score = error_rate + min(days_since * 2, 40)
        urgency = "high" if urgency_score > 60 else "medium" if urgency_score > 30 else "low"

        if urgency_score > 20:  # Only recommend if there's a real need
            reasons = []
            if error_rate > 40:
                reasons.append(f"{error_rate:.0f}% de erros nos quizzes")
            if days_since > 3:
                reasons.append(f"{days_since} dias sem estudar")

            recommendations.append({
                "subject": subj.name,
                "reason": "; ".join(reasons) or "Baixa prioridade recente",
                "urgency": urgency,
                "suggested_hours": round(min(urgency_score / 20, 4), 1),
            })

    recommendations.sort(key=lambda r: ["high", "medium", "low"].index(r["urgency"]))
    return recommendations[:8]  # Top 8


@router.get("/advanced", summary="Advanced metrics: retention, quiz performance, streak")
def get_advanced_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = datetime.utcnow().date()

    # — Anki retention rate: (reviewed and remembered) / total reviewed in last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    total_reviewed = db.query(Flashcard).filter(
        Flashcard.user_id == current_user.id,
        Flashcard.last_reviewed >= thirty_days_ago,
    ).count()
    retained = db.query(Flashcard).filter(
        Flashcard.user_id == current_user.id,
        Flashcard.last_reviewed >= thirty_days_ago,
        Flashcard.ease_factor >= 2.0,  # ease >= 2 means user knew the card
    ).count()
    retention_rate = round((retained / total_reviewed * 100) if total_reviewed > 0 else 0, 1)

    # — Quiz performance overall
    total_attempts = db.query(ExerciseAttempt).filter_by(user_id=current_user.id).count()
    correct_attempts = db.query(ExerciseAttempt).filter_by(
        user_id=current_user.id, is_correct=True
    ).count()
    quiz_performance = round(
        (correct_attempts / total_attempts * 100) if total_attempts > 0 else 0, 1
    )

    # — Error rate by subject
    subjects = db.query(Subject).filter_by(user_id=current_user.id).all()
    error_rate_by_subject: dict = {}
    critical_subjects: list = []
    for subj in subjects:
        t = db.query(ExerciseAttempt).filter_by(user_id=current_user.id, subject_id=subj.id).count()
        w = db.query(ExerciseAttempt).filter_by(
            user_id=current_user.id, subject_id=subj.id, is_correct=False
        ).count()
        if t > 0:
            rate = round(w / t * 100, 1)
            error_rate_by_subject[subj.name] = rate
            if rate > 50:
                critical_subjects.append(subj.name)

    # — Streak: consecutive days with at least 1 pomodoro
    streak = 0
    check_date = today
    while True:
        day_sessions = db.query(PomodoroSession).filter(
            PomodoroSession.user_id == current_user.id,
            func.date(PomodoroSession.created_at) == check_date,
        ).count()
        if day_sessions == 0:
            break
        streak += 1
        check_date -= timedelta(days=1)

    # — Anki cards due today
    next_review_count = db.query(Flashcard).filter(
        Flashcard.user_id == current_user.id,
        Flashcard.next_review <= datetime.utcnow(),
    ).count()

    return {
        "retention_rate": retention_rate,
        "quiz_performance": quiz_performance,
        "error_rate_by_subject": error_rate_by_subject,
        "critical_subjects": critical_subjects,
        "efficiency_by_hour": {},  # Future: aggregate productivity_rating by hour of day
        "streak": streak,
        "next_review_count": next_review_count,
    }
