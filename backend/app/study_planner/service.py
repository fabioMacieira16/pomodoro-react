"""Study Planner Service — generates AI-powered study plans.

Currently uses the MockProvider (or configured AI provider).
When USE_LANGCHAIN=true, chains are wired via LangChain.
"""
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
import json
import asyncio

from sqlalchemy.orm import Session

from app.domain.models import (
    Exam, ExamTopic, StudyPlanConfig, StudyPlanItem, Subject, DocumentIndex
)
from app.study_planner.schemas import (
    WizardInput, PlanOutput, TopicPlan, MultiEditalComparison, QuickPlanRequest,
    EditalFromInput,
)
from app.ai.factory import get_provider
from app.core.config import settings
from app.core.study_context import StudyContextService


class StudyPlannerService:

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    # ── Wizard → Plan ────────────────────────────────────────────────────────

    def generate_plan(self, wizard: WizardInput) -> PlanOutput:
        """Generate an AI study plan from wizard answers."""
        exam = self._upsert_exam(wizard)
        topics = self._build_topic_plans(exam, wizard)
        self._sync_exam_topics(exam, topics)
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

        # Sync weekly schedule into global study context
        _DAY_MAP = {"Seg": 0, "Ter": 1, "Qua": 2, "Qui": 3, "Sex": 4, "Sáb": 5, "Dom": 6}
        weekly_ctx = [
            {"day_of_week": _DAY_MAP.get(day, i), "subjects": subjects, "study_hours": wizard.daily_hours}
            for i, (day, subjects) in enumerate(weekly_schedule.items())
        ]
        try:
            StudyContextService.update_context(weekly_schedule=weekly_ctx)
        except Exception:
            pass

        return plan_output

    def generate_plan_from_edital(self, edital: EditalFromInput) -> PlanOutput:
        """Gera plano diretamente dos dados do edital — sem wizard de 9 perguntas."""
        wizard = WizardInput(
            concurso=edital.concurso,
            cargo=edital.cargo,
            banca=edital.banca or "Não informada",
            exam_date=edital.exam_date,
            daily_hours=edital.daily_hours,
            available_days=edital.available_days,
            strong_subjects=edital.strong_subjects,
            weak_subjects=edital.weak_subjects,
            previous_experience="none",
            has_studied_edital=True,
        )

        if edital.disciplinas:
            exam = self._upsert_exam(wizard)
            # Remove tópicos anteriores para recriar a partir do edital
            self.db.query(ExamTopic).filter_by(exam_id=exam.id).delete()
            self.db.commit()

            max_pont = max(edital.disciplinas.values(), default=1.0) or 1.0
            sorted_discs = sorted(edital.disciplinas.items(), key=lambda x: -x[1])
            num_discs = len(sorted_discs) or 1

            for i, (disc, pont) in enumerate(sorted_discs, 1):
                peso = max(1.0, min(3.0, round(pont / max_pont * 3, 1)))
                hours = round(max(0.5, wizard.daily_hours * peso / num_discs), 1)
                incid = round(min(0.95, 0.4 + pont / max_pont * 0.55), 2)
                priority = min(i, 5)
                diff = "Hard" if disc.lower() in {s.lower() for s in edital.weak_subjects} \
                    else "Easy" if disc.lower() in {s.lower() for s in edital.strong_subjects} \
                    else "Medium"
                self.db.add(ExamTopic(
                    exam_id=exam.id,
                    name=disc,
                    estimated_hours=hours,
                    priority=priority,
                    peso=peso,
                    incidencia=incid,
                    personal_difficulty=diff,
                ))
            self.db.commit()

        return self.generate_plan(wizard)

    def generate_plan_from_prompt(self, body: QuickPlanRequest) -> PlanOutput:
        parsed = self._parse_prompt_to_wizard(body.prompt)

        concurso = body.concurso or parsed.get("concurso") or self._guess_concurso_from_docs() or "Concurso Público"
        cargo = body.cargo or parsed.get("cargo") or "Analista"
        banca = body.banca or parsed.get("banca") or "CESPE"
        exam_date = body.exam_date or self._safe_date(parsed.get("exam_date")) or (date.today() + timedelta(days=120))
        daily_hours = body.daily_hours or self._safe_float(parsed.get("daily_hours"), default=4.0)
        available_days = body.available_days or parsed.get("available_days") or [0, 1, 2, 3, 4]

        wizard = WizardInput(
            concurso=str(concurso),
            cargo=str(cargo),
            banca=str(banca),
            exam_date=exam_date,
            daily_hours=float(daily_hours),
            available_days=[int(d) for d in available_days if int(d) in range(0, 7)] or [0, 1, 2, 3, 4],
            strong_subjects=self._safe_str_list(parsed.get("strong_subjects")),
            weak_subjects=self._safe_str_list(parsed.get("weak_subjects")),
            previous_experience=str(parsed.get("previous_experience") or body.prompt[:240]),
            has_studied_edital=True,
        )
        return self.generate_plan(wizard)

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
            exam.available_days = json.dumps(wizard.available_days)
            exam.cargo = wizard.cargo
            exam.banca = wizard.banca
            exam.is_active = True
            self.db.commit()
        return exam

    def _build_topic_plans(self, exam: Exam, wizard: WizardInput) -> List[TopicPlan]:
        topics = self.db.query(ExamTopic).filter_by(exam_id=exam.id).all()
        if not topics:
            from_docs = self._topic_plans_from_indexed_documents(wizard)
            if from_docs:
                return from_docs
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

    def _parse_prompt_to_wizard(self, prompt: str) -> Dict[str, Any]:
        provider = get_provider()
        if not provider.is_available():
            return {}

        parse_prompt = (
            "Extraia campos para planejamento de estudos e retorne SOMENTE JSON valido com as chaves: "
            "concurso,cargo,banca,exam_date(YYYY-MM-DD),daily_hours,available_days,strong_subjects,"
            "weak_subjects,previous_experience. Se nao souber, omita a chave. Texto:\n\n"
            f"{prompt[:4000]}"
        )
        try:
            data = asyncio.run(provider.complete_json(parse_prompt))
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _guess_concurso_from_docs(self) -> Optional[str]:
        latest = (
            self.db.query(DocumentIndex)
            .filter(DocumentIndex.user_id == self.user_id, DocumentIndex.is_indexed == True)
            .order_by(DocumentIndex.indexed_at.desc())
            .first()
        )
        return latest.concurso if latest and latest.concurso else None

    def _safe_date(self, value: Any) -> Optional[date]:
        if not value:
            return None
        if isinstance(value, date):
            return value
        try:
            return date.fromisoformat(str(value))
        except Exception:
            return None

    def _safe_float(self, value: Any, default: float = 4.0) -> float:
        try:
            return float(value)
        except Exception:
            return default

    def _safe_str_list(self, value: Any) -> List[str]:
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        if isinstance(value, str) and value.strip():
            return [s.strip() for s in value.split(",") if s.strip()]
        return []

    def _topic_plans_from_indexed_documents(self, wizard: WizardInput) -> List[TopicPlan]:
        docs = (
            self.db.query(DocumentIndex)
            .filter(DocumentIndex.user_id == self.user_id, DocumentIndex.is_indexed == True)
            .order_by(DocumentIndex.indexed_at.desc())
            .all()
        )

        if not docs:
            return []

        target_concurso = (wizard.concurso or "").strip().lower()
        filtered = [
            d for d in docs
            if not target_concurso or (d.concurso or "").strip().lower() == target_concurso
        ]
        if not filtered:
            filtered = docs[:]

        frequency: dict[str, int] = {}
        seed_difficulty: dict[str, str] = {}
        seed_weight: dict[str, int] = {}

        for d in filtered:
            if not isinstance(d.topics_json, list):
                continue
            for item in d.topics_json:
                if isinstance(item, str):
                    title = item.strip()
                    if not title:
                        continue
                    frequency[title] = frequency.get(title, 0) + 1
                    seed_weight.setdefault(title, 2)
                    seed_difficulty.setdefault(title, "Medium")
                    continue
                if isinstance(item, dict):
                    title = str(item.get("title") or item.get("topic") or "").strip()
                    if not title:
                        continue
                    frequency[title] = frequency.get(title, 0) + 1
                    try:
                        weight = int(item.get("weight", 2))
                    except Exception:
                        weight = 2
                    seed_weight[title] = max(seed_weight.get(title, 1), max(1, min(3, weight)))
                    difficulty = str(item.get("difficulty") or "Medium").title()
                    if difficulty not in ("Easy", "Medium", "Hard"):
                        difficulty = "Medium"
                    seed_difficulty.setdefault(title, difficulty)

        if not frequency:
            fallback = {}
            for d in filtered:
                if d.disciplina:
                    key = d.disciplina.strip().title()
                    fallback[key] = fallback.get(key, 0) + 1
            frequency = fallback
            for k in fallback:
                seed_weight.setdefault(k, 2)
                seed_difficulty.setdefault(k, "Medium")

        if not frequency:
            return []

        weak = {s.lower() for s in wizard.weak_subjects}
        strong = {s.lower() for s in wizard.strong_subjects}

        ranked = sorted(frequency.items(), key=lambda x: (-x[1], x[0]))[:15]
        plans: List[TopicPlan] = []
        base_hours = max(1.0, wizard.daily_hours * max(1, len(wizard.available_days)) / 3)

        for idx, (name, freq) in enumerate(ranked, 1):
            lname = name.lower()
            if lname in weak:
                difficulty = "Hard"
            elif lname in strong:
                difficulty = "Easy"
            else:
                difficulty = seed_difficulty.get(name, "Medium")

            weight = float(seed_weight.get(name, 2))
            incidencia = min(0.95, 0.55 + (freq * 0.05))
            factor = 1.35 if difficulty == "Hard" else 0.85 if difficulty == "Easy" else 1.0
            allocated = round(base_hours * factor * (1 + (freq - 1) * 0.08), 1)

            plans.append(
                TopicPlan(
                    topic_name=name,
                    subject=name,
                    priority=max(1, min(5, idx)),
                    weight=weight,
                    incidencia=round(incidencia, 2),
                    difficulty=difficulty,
                    allocated_hours=allocated,
                    study_days=[],
                    review_dates=[],
                )
            )

        return plans

    def _sync_exam_topics(self, exam: Exam, topics: List[TopicPlan]) -> None:
        existing_count = self.db.query(ExamTopic).filter_by(exam_id=exam.id).count()
        if existing_count > 0:
            return

        for t in topics[:20]:
            self.db.add(
                ExamTopic(
                    exam_id=exam.id,
                    name=t.topic_name,
                    estimated_hours=t.allocated_hours,
                    priority=t.priority,
                    peso=t.weight,
                    incidencia=t.incidencia,
                    personal_difficulty=t.difficulty,
                )
            )
        self.db.commit()
