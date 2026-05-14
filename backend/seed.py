from app.data.database import SessionLocal
from app.domain.models import StudyType, Category, Subject

def seed_data():
    db = SessionLocal()
    
    # 1. Create Study Type
    concurso = db.query(StudyType).filter_by(name="Concurso").first()
    if not concurso:
        concurso = StudyType(name="Concurso")
        db.add(concurso)
        db.commit()
        db.refresh(concurso)

    # 2. Create Categories
    categories_data = ["TI", "Direito", "Contabilidade", "Estatística", "Matemática"]
    cat_objs = {}
    for c_name in categories_data:
        cat = db.query(Category).filter_by(name=c_name).first()
        if not cat:
            cat = Category(name=c_name, study_type_id=concurso.id)
            db.add(cat)
            db.commit()
            db.refresh(cat)
        cat_objs[c_name] = cat

    # 3. Create Subjects (SEFAZ-CE B02 TI)
    subjects_data = [
        {"name": "Banco de Dados", "category": "TI", "color": "#f56565"},
        {"name": "Engenharia de Software", "category": "TI", "color": "#4299e1"},
        {"name": "Redes e Segurança", "category": "TI", "color": "#48bb78"},
        {"name": "Sistemas Operacionais", "category": "TI", "color": "#ed8936"},
        {"name": "Direito Tributário", "category": "Direito", "color": "#9f7aea"},
        {"name": "Contabilidade", "category": "Contabilidade", "color": "#38b2ac"},
        {"name": "Estatística", "category": "Estatística", "color": "#e53e3e"}
    ]

    for subj in subjects_data:
        cat = cat_objs.get(subj["category"])
        if cat:
            existing_subj = db.query(Subject).filter_by(name=subj["name"]).first()
            if not existing_subj:
                new_subj = Subject(
                    name=subj["name"],
                    category_id=cat.id,
                    color=subj["color"],
                    description=f"Disciplina de {subj['name']} para SEFAZ-CE",
                    exam_board="CEBRASPE"
                )
                db.add(new_subj)
    
    db.commit()
    db.close()
    print("Seed data inserted successfully!")

if __name__ == "__main__":
    seed_data()
