from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings


def _resolve_database_uri(uri: str) -> str:
    sqlite_prefix = "sqlite:///"
    absolute_sqlite_prefix = "sqlite:////"

    if not uri.startswith(sqlite_prefix) or uri.startswith(absolute_sqlite_prefix):
        return uri

    relative_path = uri[len(sqlite_prefix):]
    backend_root = Path(__file__).resolve().parents[2]
    absolute_path = (backend_root / relative_path).resolve()
    return f"{sqlite_prefix}{absolute_path.as_posix()}"

engine = create_engine(
    _resolve_database_uri(settings.SQLALCHEMY_DATABASE_URI),
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
