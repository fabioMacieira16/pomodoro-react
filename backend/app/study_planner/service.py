"""Study Planner Service — generates AI-powered study plans.

Currently uses the MockProvider (or configured AI provider).
When USE_LANGCHAIN=true, chains are wired via LangChain.
"""
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
import json

from sqlalchemy.orm import Session

from app.domain.models import (
    Exam, ExamTopic, StudyPlanConfig, StudyPlanItem, Subject
)
from app.study_planner.schemas import (
    WizardInput, PlanOutput, TopicPlan, MultiEditalComparison
)
from app.ai.factory import get_provider
from app.core.config import settings


class StudyPlannerService:

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    # ── Wizard → Plan ────────────────────────────────────────────────────────

    def generate_plan(self, wizard: WizardInput) -> PlanOutput:
        """Generate an AI study plan from wizard answers."""
        exam = self._upsert_exam(wizard)
        topics = self._build_topic_plans(exam, wizard)
        days_until = max(1, (wizard.exam_date - date.today()).days)
        total_hours = wizard.daily_hours * len(wizard.available_days) / 7 * days_until

        weekly_schedule = self._build_weekly_schedule(topics, wizard.available_days)
        priorities = self._build_priorities(topics, wizard)

        is_multi = bool(wizard.second_concurso)
        badge = "🎯 Plano Multi Edital" if is_multi else None

        plan_output = PlanOutput(
            concurso=wizard.concurso,
            cargo=wizard.cargo,
            banca=wizard.banca,
            exam_date=str(wizard.exam_date),
            days_until_exam=days_until,
            total_study_hours=round(total_hours, 1),
            topics=topics,
            weekly_schedule=weekly_schedule,
            priorities=priorities,
            is_multi_edital=is_multi,
            multi_edital_badge=badge,
            generated_at=datetime.utcnow().isoformat(),
        )

        config = StudyPlanConfig(
            user_id=self.user_id,
            exam_id=exam.id,
            is_multi_edital=is_multi,
            wizard_answers=wizard.model_dump(mode="json"),
            generated_plan=plan_output.model_dump(mode="json"),
            status="active",
        )
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        plan_output.plan_id = config.id
        return plan_output

    def get_active_plan(self) -> Optional[PlanOutput]:
        config = (
            self.db.query(StudyPlanConfig)
            .filter_by(user_id=self.user_id, status="active")
            .order_by(StudyPlanConfig.created_at.desc())
            .first()
        )
        if not config or not config.generated_plan:
            return None
        data = config.generated_plan
        data["plan_id"] = config.id
        return PlanOutput(**data)

    def edit_plan(self, plan_id: int, wizard: WizardInput) -> PlanOutput:
        config = self.db.query(StudyPlanConfig).filter_by(
            id=plan_id, user_id=self.user_id
        ).first()
        if not config:
            raise ValueError("Plan not found")
        # Archive current, generate new
        config.status = "archived"
        self.db.commit()
        return self.generate_plan(wizard)

    # ── Multi-Edital Comparison ──────────────────────────────────────────────

    def compare_editais(self, wizard: WizardInput) -> MultiEditalComparison:
        if not wizard.second_concurso:
            raise ValueError("second_concurso is required for multi-edital comparison")

        exam1 = self.db.query(Exam).filter(
            Exam.user_id == self.user_id,
            Exam.name == wizard.concurso,
            Exam.is_active == True,
        ).first()
        exam2 = self.db.query(Exam).filter(
            Exam.user_id == self.user_id,
            Exam.name == wizard.second_concurso,
            Exam.is_active == True,
        ).first()

        topics1 = [t.name.lower() for t in (exam1.topics if exam1 else [])]
        topics2 = [t.name.lower() for t in (exam2.topics if exam2 else [])]

        shared = [t for t in topics1 if t in topics2]
        excl1 = [t for t in topics1 if t not in topics2]
        excl2 = [t for t in topics2 if t not in topics1]

        total = len(set(topics1 + topics2)) or 1
        compat = round(len(shared) / total * 100, 1)
        leverage = round(len(shared) / (len(topics1) or 1) * 100, 1)

        rec = (
            f"Com {compat:.0f}% de compatibilidade, estudar {wizard.concurso} e "
            f"{wizard.second_concurso} em paralelo aproveita {leverage:.0f}% do conteúdo."
        )

        return MultiEditalComparison(
            concurso_1=wizard.concurso,
            concurso_2=wizard.second_concurso,
            compatibility_pct=compat,
            shared_topics=[t.title() for t in shared],
            exclusive_to_1=[t.title() for t in excl1],
            exclusive_to_2=[t.title() for t in excl2],
            study_leverage_pct=leverage,
            recommendation=rec,
        )

    # ── Internal helpers ─────────────────────────────────────────────────────

    def _upsert_exam(self, wizard: WizardInput) -> Exam:
        exam = self.db.query(Exam).filter(
            Exam.user_id == self.user_id,
            Exam.name == wizard.concurso,
        ).first()
        if not exam:
            exam = Exam(
                user_id=self.user_id,
                name=wizard.concurso,
                exam_date=datetime.combine(wizard.exam_date, datetime.min.time()),
                daily_hours=wizard.daily_hours,
                available_days=json.dumps(wizard.available_days),
                cargo=wizard.cargo,
                banca=wizard.banca,
                is_active=True,
            )
            self.db.add(exam)
            self.db.commit()
            self.db.refresh(exam)
        else:
            exam.exam_date = datetime.combine(wizard.exam_date, datetime.min.time())
            exam.daily_hours = wizard.daily_hours
            exam.cargo = wizard.cargo
            exam.banca = wizard.banca
            self.db.commit()
        return exam

    def _build_topic_plans(self, exam: Exam, wizard: WizardInput) -> List[TopicPlan]:
        topics = self.db.query(ExamTopic).filter_by(exam_id=exam.id).all()
        if not topics:
            # Generate default topics from subjects if no exam topics exist
            return self._default_topic_plans(wizard)

        plans = []
        days_until = max(1, (wizard.exam_date - date.today()).days)
        for t in topics:
            difficulty = "Hard" if t.name.lower() in [s.lower() for s in wizard.weak_subjects] \
                else "Easy" if t.name.lower() in [s.lower() for s in wizard.strong_subjects] \
                else t.personal_difficulty
            alloc = round(t.estimated_hours * (1.5 if difficulty == "Hard" else 0.8 if difficulty == "Easy" else 1.0), 1)
            plans.append(TopicPlan(
                topic_name=t.name,
                subject=t.subject.name if t.subject else t.name,
                priority=t.priority,
                weight=t.peso,
                incidencia=t.incidencia,
                difficulty=difficulty,
                allocated_hours=alloc,
                study_days=[],
                review_dates=[],
            ))
        return sorted(plans, key=lambda p: (p.priority, -p.weight))

    def _default_topic_plans(self, wizard: WizardInput) -> List[TopicPlan]:
        """Fallback when no exam topics are registered yet."""
        base_topics = [
            ("Conhecimentos Específicos de TI", 8.0, 3.0, 0.9),
            ("Raciocínio Lógico", 6.0, 2.5, 0.85),
            ("Língua Portuguesa", 4.0, 2.0, 0.8),
            ("Direito Constitucional", 3.0, 1.5, 0.7),
            ("Administração Pública", 2.0, 1.5, 0.6),
        ] if wizard.banca.upper() in ("CESPE", "CEBRASPE") else [
            ("Conhecimentos Específicos", 10.0, 3.0, 0.8),
            ("Língua Portuguesa", 5.0, 2.0, 0.7),
            ("Raciocínio Lógico", 4.0, 2.0, 0.75),
            ("Informática", 3.0, 1.5, 0.65),
            ("Legislação Específica", 2.0, 1.0, 0.5),
        ]
        plans = []
        for i, (name, hours, weight, incid) in enumerate(base_topics, 1):
            diff = "Hard" if name.lower() in [s.lower() for s in wizard.weak_subjects] \
                else "Easy" if name.lower() in [s.lower() for s in wizard.strong_subjects] \
                else "Medium"
            plans.append(TopicPlan(
                topic_name=name,
                subject=name,
                priority=i,
                weight=weight,
                incidencia=incid,
                difficulty=diff,
                allocated_hours=round(hours * (1.5 if diff == "Hard" else 0.8 if diff == "Easy" else 1.0), 1),
                study_days=[],
                review_dates=[],
            ))
        return plans

    def _build_weekly_schedule(self, topics: List[TopicPlan], available_days: List[int]) -> Dict[str, List[str]]:
        day_names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
        schedule: Dict[str, List[str]] = {day_names[d]: [] for d in available_days}
        for i, topic in enumerate(topics):
            day = available_days[i % len(available_days)]
            schedule[day_names[day]].append(topic.topic_name)
        return schedule

    def _build_priorities(self, topics: List[TopicPlan], wizard: WizardInput) -> List[str]:
        hard_topics = [t.topic_name for t in topics if t.difficulty == "Hard"]
        high_weight = [t.topic_name for t in topics if t.weight >= 2.5 and t.topic_name not in hard_topics]
        prios = []
        if hard_topics:
            prios.append(f"🔴 Reforçar urgente: {', '.join(hard_topics[:3])}")
        if high_weight:
            prios.append(f"🟡 Alto peso na prova: {', '.join(high_weight[:3])}")
        prios.append(f"📅 {(wizard.exam_date - date.today()).days} dias até a prova — mantenha consistência diária")
        return prios
