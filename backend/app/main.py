from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import auth, tasks, pomodoro_sessions, settings, dashboard, scheduler
from app.api.routers import anki_decks, anki_flashcards, anki_review, anki_stats, anki_ai
from app.api.routers import ai_module
from app.core.config import settings as app_settings

app = FastAPI(title=app_settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(pomodoro_sessions.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(scheduler.router, prefix="/api")
app.include_router(anki_decks.router, prefix="/api")
app.include_router(anki_flashcards.router, prefix="/api")
app.include_router(anki_review.router, prefix="/api")
app.include_router(anki_stats.router, prefix="/api")
app.include_router(anki_ai.router, prefix="/api")
app.include_router(ai_module.router, prefix="/api")


@app.get("/")
def read_root():
    return {"message": "Pomodoro API - Clean Architecture"}
