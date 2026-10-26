from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings


def _resolve_database_uri(uri: str) -> str:
    # Alguns provedores entregam "postgres://", que o SQLAlchemy 2.x não aceita.
    if uri.startswith("postgres://"):
        uri = "postgresql://" + uri[len("postgres://"):]

    sqlite_prefix = "sqlite:///"
    absolute_sqlite_prefix = "sqlite:////"

    if not uri.startswith(sqlite_prefix) or uri.startswith(absolute_sqlite_prefix):
        return uri

    relative_path = uri[len(sqlite_prefix):]
    backend_root = Path(__file__).resolve().parents[2]
    absolute_path = (backend_root / relative_path).resolve()
    return f"{sqlite_prefix}{absolute_path.as_posix()}"

DATABASE_URI = _resolve_database_uri(settings.SQLALCHEMY_DATABASE_URI)

if DATABASE_URI.startswith("sqlite"):
    # check_same_thread só existe no SQLite.
    engine = create_engine(DATABASE_URI, connect_args={"check_same_thread": False})
else:
    # pre_ping descarta conexões que o pooler (ex.: Supabase) já fechou.
    engine = create_engine(DATABASE_URI, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
