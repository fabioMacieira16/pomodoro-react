from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Pomodoro API"
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///../database/pomodoro.db"
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"  # Update in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    ALLOW_DEV_AUTH_BYPASS: bool = True
    DEV_AUTH_USERNAME: str = "admin"

    # ── Supabase Auth ──────────────────────────────────────────────────────────
    # Com SUPABASE_URL definido, o backend aceita só tokens do Supabase e ignora
    # ALLOW_DEV_AUTH_BYPASS. Vazio = modo local (login próprio / usuário de dev).
    SUPABASE_URL: str = ""
    # Só necessário em projetos que ainda assinam o JWT com HS256.
    SUPABASE_JWT_SECRET: str = ""

    # ── CORS ───────────────────────────────────────────────────────────────────
    # Origens permitidas além do localhost, separadas por vírgula
    # (ex.: "https://meuapp.vercel.app,https://meuapp-stg.vercel.app").
    CORS_ORIGINS: str = ""
    # Regex extra opcional (ex.: previews do Vercel: r"https://meuapp-.*\.vercel\.app").
    CORS_ORIGIN_REGEX: str = ""

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

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.SUPABASE_URL.strip())

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


def get_settings() -> "Settings":
    """Recarrega as configurações do .env a cada chamada (útil em dev com --reload)."""
    return Settings()


settings = Settings()
