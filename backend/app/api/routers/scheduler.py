import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import scheduler_repo
from app.api.dependencies import get_current_user
from app.domain.models import User, Exam, ExamTopic, StudyPlanItem
from app.core.scheduler import generate_plan

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _exam_summary(exam) -> dict:
    return {
        "id":            exam.id,
        "name":          exam.name,
        "exam_date":     exam.exam_date,
        "daily_hours":   exam.daily_hours,
        "available_days": exam.available_days,
        "created_at":    exam.created_at,
        "topic_count":   len(exam.topics),
    }


def _plan_item_response(item) -> dict:
    return {
        "id":               item.id,
        "exam_id":          item.exam_id,
        "exam_topic_id":    item.exam_topic_id,
        "scheduled_date":   item.scheduled_date,
        "duration_minutes": item.duration_minutes,
        "session_type":     item.session_type,
        "review_interval":  item.review_interval,
        "completed":        item.completed,
        "topic_name":       item.topic.name,
    }


# ── POST /scheduler/exams ─────────────────────────────────────────────────────

@router.post("/exams", response_model=dtos.ExamResponse)
def create_exam(
    payload: dtos.ExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date
    if payload.exam_date.date() <= date.today():
        raise HTTPException(status_code=422, detail="exam_date must be in the future")

    exam = scheduler_repo.create(db, {
        "user_id":        current_user.id,
        "name":           payload.name,
        "exam_date":      payload.exam_date,
        "daily_hours":    payload.daily_hours,
        "available_days": json.dumps(sorted(payload.available_days)),
    })

    for t in payload.topics:
        topic = ExamTopic(
            exam_id=exam.id,
            name=t.name,
            estimated_hours=t.estimated_hours,
            priority=t.priority,
            subject_id=t.subject_id,
        )
        db.add(topic)
    db.commit()

    exam = scheduler_repo.get_with_topics(db, exam.id)

    plan_dicts = generate_plan(exam, exam.topics)
    if not plan_dicts:
        raise HTTPException(
            status_code=422,
            detail="No available study days between today and exam_date. "
                   "Check available_days and exam_date.",
        )

    scheduler_repo.bulk_create_plan(db, exam.id, plan_dicts)

    exam = scheduler_repo.get_with_topics(db, exam.id)
    return exam


# ── GET /scheduler/exams ──────────────────────────────────────────────────────

@router.get("/exams", response_model=list[dtos.ExamSummary])
def list_exams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exams = (
        db.query(Exam)
        .options(joinedload(Exam.topics))
        .filter(Exam.user_id == current_user.id)
        .all()
    )
    return [_exam_summary(e) for e in exams]


# ── DELETE /scheduler/exams/{exam_id} ────────────────────────────────────────

@router.delete("/exams/{exam_id}")
def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = scheduler_repo.get(db, exam_id)
    if not exam or exam.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Exam not found")
    scheduler_repo.delete(db, exam_id)
    return {"message": f"Exam {exam_id} deleted"}


# ── GET /scheduler/exams/{exam_id}/plan ──────────────────────────────────────

@router.get("/exams/{exam_id}/plan", response_model=list[dtos.StudyPlanItemResponse])
def get_exam_plan(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = scheduler_repo.get(db, exam_id)
    if not exam or exam.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Exam not found")
    items = scheduler_repo.get_plan(db, exam_id)
    return [_plan_item_response(i) for i in items]


# ── PATCH /scheduler/plan/items/{item_id} ────────────────────────────────────

@router.patch("/plan/items/{item_id}", response_model=dtos.StudyPlanItemResponse)
def toggle_plan_item(
    item_id: int,
    payload: dtos.PlanItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = scheduler_repo.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Plan item not found")

    exam = scheduler_repo.get(db, item.exam_id)
    if not exam or exam.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Plan item not found")

    if payload.completed is not None:
        scheduler_repo.toggle_item(db, item_id, payload.completed)
        item = (
            db.query(StudyPlanItem)
            .options(joinedload(StudyPlanItem.topic))
            .filter(StudyPlanItem.id == item_id)
            .first()
        )

    return _plan_item_response(item)


# ── POST /scheduler/exams/{exam_id}/regenerate ───────────────────────────────

@router.post("/exams/{exam_id}/regenerate", response_model=list[dtos.StudyPlanItemResponse])
def regenerate_plan(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = scheduler_repo.get_with_topics(db, exam_id)
    if not exam or exam.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Exam not found")

    scheduler_repo.delete_plan(db, exam_id)

    plan_dicts = generate_plan(exam, exam.topics)
    if not plan_dicts:
        raise HTTPException(
            status_code=422,
            detail="No available study days between today and exam_date.",
        )

    scheduler_repo.bulk_create_plan(db, exam_id, plan_dicts)
    items = scheduler_repo.get_plan(db, exam_id)
    return [_plan_item_response(i) for i in items]
