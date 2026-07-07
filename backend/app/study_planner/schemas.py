from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class WizardInput(BaseModel):
    """Answers to the 10-question study planning wizard."""
    concurso: str = Field(..., description="Nome do concurso. Ex: SEFAZ-CE, TJCE")
    cargo: str = Field(..., description="Cargo pretendido. Ex: Analista de TI")
    banca: str = Field(..., description="Banca organizadora. Ex: CESPE, FCC, FGV")
    exam_date: date = Field(..., description="Data da prova")
    daily_hours: float = Field(..., ge=0.5, le=16, description="Horas disponíveis por dia")
    available_days: List[int] = Field(
        default=[0, 1, 2, 3, 4],
        description="Dias disponíveis (0=Seg, 6=Dom)"
    )
    strong_subjects: List[str] = Field(default=[], description="Matérias que domina")
    weak_subjects: List[str] = Field(default=[], description="Matérias com dificuldade")
    previous_experience: str = Field(
        default="none",
        description="none / some / experienced"
    )
    has_studied_edital: bool = Field(default=False, description="Já estudou o edital?")
    # Optional second edital (multi-edital)
    second_concurso: Optional[str] = None
    second_cargo: Optional[str] = None
    second_exam_date: Optional[date] = None


class TopicPlan(BaseModel):
    topic_name: str
    subject: str
    priority: int          # 1 (highest) - 5 (lowest)
    weight: float          # weight in the exam
    incidencia: float      # banca incidence 0-1
    difficulty: str        # Easy/Medium/Hard
    allocated_hours: float
    study_days: List[str]  # e.g. ["Mon", "Wed"]
    review_dates: List[str]


class PlanOutput(BaseModel):
    plan_id: Optional[int] = None
    concurso: str
    cargo: str
    banca: str
    exam_date: str
    days_until_exam: int
    total_study_hours: float
    topics: List[TopicPlan]
    weekly_schedule: Dict[str, List[str]]  # day -> [topic names]
    priorities: List[str]
    is_multi_edital: bool = False
    multi_edital_badge: Optional[str] = None
    generated_at: str


class MultiEditalComparison(BaseModel):
    plan_id: Optional[int] = None
    concurso_1: str
    concurso_2: str
    compatibility_pct: float
    shared_topics: List[str]
    exclusive_to_1: List[str]
    exclusive_to_2: List[str]
    study_leverage_pct: float  # % de aproveitamento cruzado
    recommendation: str
    hybrid_plan: Optional[PlanOutput] = None


class PlanEditRequest(BaseModel):
    plan_id: int
    wizard_answers: Optional[WizardInput] = None
    manual_adjustments: Optional[Dict[str, Any]] = None
    recalculate: bool = True


class QuickPlanRequest(BaseModel):
    prompt: str = Field(..., min_length=8, description="Briefing in natural language")
    concurso: Optional[str] = None
    cargo: Optional[str] = None
    banca: Optional[str] = None
    exam_date: Optional[date] = None
    daily_hours: Optional[float] = Field(default=4.0, ge=0.5, le=16)
    available_days: Optional[List[int]] = Field(default=[0, 1, 2, 3, 4])


class EditalFromInput(BaseModel):
    """Gera plano diretamente a partir da análise do edital — sem wizard completo."""
    concurso: str = Field(..., description="Nome do concurso")
    cargo: str = Field(..., description="Cargo selecionado pelo usuário")
    banca: Optional[str] = Field(default=None)
    exam_date: date = Field(..., description="Data da prova")
    daily_hours: float = Field(default=4.0, ge=0.5, le=16)
    available_days: List[int] = Field(default=[0, 1, 2, 3, 4])
    disciplinas: Dict[str, float] = Field(
        default={},
        description="Mapa disciplina → pontuacao_max extraído do edital"
    )
    strong_subjects: List[str] = Field(default=[])
    weak_subjects: List[str] = Field(default=[])
