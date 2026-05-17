from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.database import get_db
from app.api.dependencies import get_current_user
from app.domain.models import User
from app.study_planner.schemas import WizardInput, PlanOutput, MultiEditalComparison, PlanEditRequest
from app.study_planner.service import StudyPlannerService

router = APIRouter(prefix="/planner", tags=["study-planner"])


def _svc(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> StudyPlannerService:
    return StudyPlannerService(db=db, user_id=current_user.id)


@router.post("/wizard", response_model=PlanOutput, summary="Generate study plan from wizard answers")
def run_wizard(
    wizard: WizardInput,
    svc: StudyPlannerService = Depends(_svc),
):
    return svc.generate_plan(wizard)


@router.get("/plan", response_model=PlanOutput, summary="Get the active study plan")
def get_plan(svc: StudyPlannerService = Depends(_svc)):
    plan = svc.get_active_plan()
    if not plan:
        raise HTTPException(status_code=404, detail="No active study plan. Run /wizard first.")
    return plan


@router.put("/plan/{plan_id}", response_model=PlanOutput, summary="Edit and recalculate study plan")
def edit_plan(
    plan_id: int,
    body: PlanEditRequest,
    svc: StudyPlannerService = Depends(_svc),
):
    if not body.wizard_answers:
        raise HTTPException(status_code=400, detail="wizard_answers required to recalculate")
    try:
        return svc.edit_plan(plan_id, body.wizard_answers)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/multi-edital", response_model=MultiEditalComparison, summary="Compare two editais and build hybrid plan")
def compare_editais(
    wizard: WizardInput,
    svc: StudyPlannerService = Depends(_svc),
):
    try:
        return svc.compare_editais(wizard)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
