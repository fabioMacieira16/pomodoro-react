from app.data.database import SessionLocal
from app.domain.models import User, StudyType, Category, Subject, Schedule, Setting
from app.core.security import get_password_hash
from datetime import datetime

def seed():
    db = SessionLocal()
    try:
        # 1. Create Default User
        user = db.query(User).filter(User.username == "admin").first()
        if not user:
            user = User(
                username="admin",
                email="admin@example.com",
                hashed_password=get_password_hash("admin123"),
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 2. Create Study Type
        study_type = db.query(StudyType).filter(StudyType.name == "Concurso Público").first()
        if not study_type:
            study_type = StudyType(name="Concurso Público")
            db.add(study_type)
            db.commit()
            db.refresh(study_type)

        # 3. Create Categories for SEFAZ-CE
        categories_data = ["Tecnologia da Informação", "Conhecimentos Gerais", "Direito", "Contabilidade"]
        categories = {}
        for cat_name in categories_data:
            cat = db.query(Category).filter(Category.name == cat_name).first()
            if not cat:
                cat = Category(name=cat_name, study_type_id=study_type.id)
                db.add(cat)
                db.commit()
                db.refresh(cat)
            categories[cat_name] = cat

        # 4. Create Subjects (Disciplinas) with Priorities and Weights
        subjects_data = [
            # TI
            {"name": "Engenharia de Software", "cat": "Tecnologia da Informação", "priority": 5, "weight": 3.0, "color": "#3182ce"},
            {"name": "Bancos de Dados", "cat": "Tecnologia da Informação", "priority": 5, "weight": 3.0, "color": "#2b6cb0"},
            {"name": "Gestão e Governança de TI", "cat": "Tecnologia da Informação", "priority": 4, "weight": 2.0, "color": "#2c5282"},
            {"name": "Infraestrutura de TI", "cat": "Tecnologia da Informação", "priority": 3, "weight": 2.0, "color": "#2a4365"},
            {"name": "Segurança da Informação", "cat": "Tecnologia da Informação", "priority": 4, "weight": 2.0, "color": "#1a365d"},
            
            # Conhecimentos Gerais
            {"name": "Língua Portuguesa", "cat": "Conhecimentos Gerais", "priority": 4, "weight": 1.0, "color": "#38a169"},
            {"name": "Raciocínio Lógico-Matemático", "cat": "Conhecimentos Gerais", "priority": 3, "weight": 1.0, "color": "#2f855a"},
            {"name": "Fluência em Dados", "cat": "Conhecimentos Gerais", "priority": 5, "weight": 2.0, "color": "#276749"},
            
            # Direito
            {"name": "Direito Constitucional", "cat": "Direito", "priority": 3, "weight": 1.0, "color": "#e53e3e"},
            {"name": "Direito Administrativo", "cat": "Direito", "priority": 3, "weight": 1.0, "color": "#c53030"},
            {"name": "Direito Tributário", "cat": "Direito", "priority": 5, "weight": 3.0, "color": "#9b2c2c"},
            
            # Contabilidade
            {"name": "Contabilidade Geral", "cat": "Contabilidade", "priority": 4, "weight": 2.0, "color": "#d69e2e"},
        ]

        subjects = {}
        for s_data in subjects_data:
            subject = db.query(Subject).filter(Subject.name == s_data["name"]).first()
            if not subject:
                subject = Subject(
                    name=s_data["name"],
                    category_id=categories[s_data["cat"]].id,
                    priority=s_data["priority"],
                    weight=s_data["weight"],
                    color=s_data["color"],
                    difficulty="Hard" if s_data["priority"] >= 4 else "Medium",
                    exam_board="FEPESE" # Exemplo, SEFAZ costuma ser FCC/FGV/CEBRASPE
                )
                db.add(subject)
                db.commit()
                db.refresh(subject)
            subjects[s_data["name"]] = subject

        # 5. Create Schedules (Horários)
        # 0: Mon, 1: Tue, ...
        schedules_data = [
            (0, "Morning", "Língua Portuguesa"),
            (0, "Afternoon", "Engenharia de Software"),
            (1, "Morning", "Direito Tributário"),
            (1, "Afternoon", "Bancos de Dados"),
            (2, "Morning", "Fluência em Dados"),
            (2, "Afternoon", "Segurança da Informação"),
            (3, "Morning", "Direito Constitucional"),
            (3, "Afternoon", "Gestão e Governança de TI"),
            (4, "Morning", "Contabilidade Geral"),
            (4, "Afternoon", "Infraestrutura de TI"),
            (5, "Morning", "Revisão Geral"),
        ]

        for day, time, sub_name in schedules_data:
            if sub_name == "Revisão Geral": continue
            
            sub = subjects.get(sub_name)
            if sub:
                existing = db.query(Schedule).filter(
                    Schedule.day_of_week == day,
                    Schedule.time_of_day == time,
                    Schedule.subject_id == sub.id
                ).first()
                if not existing:
                    schedule = Schedule(
                        day_of_week=day,
                        time_of_day=time,
                        subject_id=sub.id,
                        duration_minutes=120
                    )
                    db.add(schedule)

        # 6. Default Settings
        setting = db.query(Setting).filter(Setting.user_id == user.id).first()
        if not setting:
            setting = Setting(
                user_id=user.id,
                auto_start_breaks=True,
                auto_start_pomodoros=False,
                long_break_interval=4,
                dark_mode=True
            )
            db.add(setting)

        db.commit()
        print("Detailed Seed data for SEFAZ-CE B02 (TI) inserted successfully!")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
