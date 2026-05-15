from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Pomodoro API"
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///../database/pomodoro.db"
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"  # Update in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # ── AI Module ──────────────────────────────────────────────────────────────
    # Provider: "mock" (default, no API key needed) | "openai" | "ollama"
    AI_PROVIDER: str = "mock"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Ollama (local)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    # Whisper transcription (audio/video)
    USE_WHISPER: bool = False
    WHISPER_MODEL: str = "base"  # tiny | base | small | medium | large

    # LangChain orchestration (requires langchain package)
    USE_LANGCHAIN: bool = False

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
