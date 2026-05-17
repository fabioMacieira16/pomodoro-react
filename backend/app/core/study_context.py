"""
Study Context - Contexto Global do Sistema de Estudos

Armazena o estado completo do estudo do usuário:
- Edital ativo
- Cargo escolhido
- Disciplinas
- Agenda
- Métricas
- Dificuldades
- Revisões pendentes
- Desempenho

Este contexto é usado por toda a IA para tomar decisões inteligentes.
"""
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class SubjectPerformance(BaseModel):
    """Desempenho em uma disciplina"""
    subject: str
    correct_answers: int = 0
    wrong_answers: int = 0
    accuracy: float = 0.0
    study_hours: float = 0.0
    last_study: Optional[datetime] = None
    difficulty_level: str = "medium"  # easy, medium, hard
    priority: int = 3  # 1-5


class ReviewItem(BaseModel):
    """Item de revisão pendente"""
    subject: str
    topic: str
    question_id: Optional[int] = None
    created_at: datetime
    scheduled_for: datetime
    review_count: int = 0
    difficulty: str = "medium"


class WeeklySchedule(BaseModel):
    """Agenda semanal"""
    day_of_week: int  # 0=Seg, 6=Dom
    subjects: List[str] = []
    study_hours: float = 0.0


class StudyContext(BaseModel):
    """Contexto Global de Estudos"""
    
    # Edital
    edital_active: bool = False
    concurso: Optional[str] = None
    banca: Optional[str] = None
    cargo: Optional[str] = None
    exam_date: Optional[datetime] = None
    available_cargos: List[str] = []
    
    # Disciplinas
    subjects: List[str] = []
    subject_weights: Dict[str, float] = {}  # peso por disciplina
    
    # Agenda
    weekly_schedule: List[WeeklySchedule] = []
    daily_study_hours: float = 4.0
    available_days: List[int] = [0, 1, 2, 3, 4]  # Seg-Sex
    
    # Performance
    performances: List[SubjectPerformance] = []
    total_study_hours: float = 0.0
    total_pomodoros: int = 0
    
    # Revisões
    pending_reviews: List[ReviewItem] = []
    review_mode_active: bool = False
    
    # Metas
    daily_goal_hours: float = 4.0
    weekly_goal_pomodoros: int = 20
    
    # Estado atual
    current_subject: Optional[str] = None
    current_pomodoro_mode: str = "normal"  # normal, with_questions, review
    last_activity: Optional[datetime] = None
    
    # IA Context
    user_strengths: List[str] = []  # matérias fortes
    user_weaknesses: List[str] = []  # matérias fracas
    previous_experience: Optional[str] = None
    study_style: str = "balanced"  # intensive, balanced, light
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class StudyContextService:
    """Serviço para gerenciar o contexto de estudos"""
    
    _instance: Optional[StudyContext] = None
    
    @classmethod
    def get_context(cls) -> StudyContext:
        """Retorna o contexto atual (singleton)"""
        if cls._instance is None:
            cls._instance = StudyContext()
        return cls._instance
    
    @classmethod
    def update_context(cls, **kwargs) -> StudyContext:
        """Atualiza campos do contexto"""
        context = cls.get_context()
        for key, value in kwargs.items():
            if hasattr(context, key):
                setattr(context, key, value)
        context.last_activity = datetime.now()
        return context
    
    @classmethod
    def reset_context(cls) -> StudyContext:
        """Reseta o contexto"""
        cls._instance = StudyContext()
        return cls._instance
    
    @classmethod
    def get_ai_prompt_context(cls) -> str:
        """Retorna o contexto formatado para a IA"""
        ctx = cls.get_context()
        
        prompt = f"""
## Contexto do Aluno

Concurso: {ctx.concurso or 'Não definido'}
Cargo: {ctx.cargo or 'Não definido'}
Banca: {ctx.banca or 'Não definido'}
Prova: {ctx.exam_date.strftime('%d/%m/%Y') if ctx.exam_date else 'Não definida'}

Disciplinas: {', '.join(ctx.subjects) if ctx.subjects else 'Nenhuma'}
Matérias Fortes: {', '.join(ctx.user_strengths) if ctx.user_strengths else 'Não informado'}
Matérias Fracas: {', '.join(ctx.user_weaknesses) if ctx.user_weaknesses else 'Não informado'}

Horas de Estudo: {ctx.total_study_hours}h
Pomodoros Completos: {ctx.total_pomodoros}
Revisões Pendentes: {len(ctx.pending_reviews)}

Estilo de Estudo: {ctx.study_style}
Experiência Anterior: {ctx.previous_experience or 'Não informado'}
"""
        return prompt.strip()
    
    @classmethod
    def add_performance(cls, subject: str, correct: bool, study_time: float = 0.0):
        """Registra desempenho em uma disciplina"""
        ctx = cls.get_context()
        
        # Procura disciplina existente
        perf = next((p for p in ctx.performances if p.subject == subject), None)
        
        if not perf:
            perf = SubjectPerformance(subject=subject)
            ctx.performances.append(perf)
        
        if correct:
            perf.correct_answers += 1
        else:
            perf.wrong_answers += 1
        
        total = perf.correct_answers + perf.wrong_answers
        perf.accuracy = (perf.correct_answers / total * 100) if total > 0 else 0.0
        perf.study_hours += study_time
        perf.last_study = datetime.now()
        
        # Atualiza dificuldade baseada na performance
        if perf.accuracy >= 80:
            perf.difficulty_level = "easy"
            perf.priority = 2
        elif perf.accuracy >= 60:
            perf.difficulty_level = "medium"
            perf.priority = 3
        else:
            perf.difficulty_level = "hard"
            perf.priority = 5
        
        return perf
    
    @classmethod
    def add_review(cls, subject: str, topic: str, days_ahead: int = 1) -> ReviewItem:
        """Adiciona item de revisão"""
        ctx = cls.get_context()
        
        from datetime import timedelta
        
        review = ReviewItem(
            subject=subject,
            topic=topic,
            created_at=datetime.now(),
            scheduled_for=datetime.now() + timedelta(days=days_ahead)
        )
        
        ctx.pending_reviews.append(review)
        return review
    
    @classmethod
    def get_todays_subjects(cls) -> List[str]:
        """Retorna disciplinas do dia atual"""
        ctx = cls.get_context()
        today = datetime.now().weekday()
        
        schedule = next((s for s in ctx.weekly_schedule if s.day_of_week == today), None)
        return schedule.subjects if schedule else []
    
    @classmethod
    def get_weak_subjects(cls) -> List[SubjectPerformance]:
        """Retorna disciplinas com baixo desempenho"""
        ctx = cls.get_context()
        return [p for p in ctx.performances if p.accuracy < 60]
    
    @classmethod
    def get_pending_reviews_for_subject(cls, subject: str) -> List[ReviewItem]:
        """Retorna revisões pendentes de uma disciplina"""
        ctx = cls.get_context()
        now = datetime.now()
        return [
            r for r in ctx.pending_reviews 
            if r.subject == subject and r.scheduled_for <= now
        ]
