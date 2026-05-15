"""
Settings router – mounts under /api/settings.

Endpoints
---------
GET  /settings/           Full settings (all categories)
PUT  /settings/           Patch any fields (backward-compatible)

GET  /settings/pomodoro   Pomodoro-specific settings
PUT  /settings/pomodoro   Update pomodoro settings

GET  /settings/display    Display / theme settings
PUT  /settings/display    Update display settings

GET  /settings/ai         AI provider preferences
PUT  /settings/ai         Update AI preferences

GET  /settings/notifications  Notification settings
PUT  /settings/notifications  Update notification settings
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.data.database import get_db
from app.domain.models import User
from app.settings.schemas import (
    FullSettingsResponse,
    PomodoroSettings,
    PomodoroSettingsUpdate,
    DisplaySettings,
    DisplaySettingsUpdate,
    AIPreferencesSettings,
    AIPreferencesUpdate,
    NotificationSettings,
    NotificationSettingsUpdate,
)
from app.settings.service import settings_service

# Legacy DTO for backward-compat PUT /settings/
from app.api import dtos as legacy_dtos
from app.data.repositories import setting_repo

router = APIRouter(prefix="/settings", tags=["settings"])


# ── Full settings (backward-compatible) ──────────────────────────────────────

@router.get("/", response_model=FullSettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settings_service.get_full(db, current_user.id)


@router.put("/", response_model=legacy_dtos.SettingResponse)
def update_settings(
    setting_in: legacy_dtos.SettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Backward-compatible flat update (existing frontend contract)."""
    setting = setting_repo.get_or_create(db, current_user.id)
    return setting_repo.update(db, setting, setting_in.model_dump(exclude_unset=True))


# ── Pomodoro ──────────────────────────────────────────────────────────────────

@router.get("/pomodoro", response_model=PomodoroSettings)
def get_pomodoro(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settings_service.get_pomodoro(db, current_user.id)


@router.put("/pomodoro", response_model=PomodoroSettings)
def update_pomodoro(
    data: PomodoroSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settings_service.update_pomodoro(db, current_user.id, data)


# ── Display ───────────────────────────────────────────────────────────────────

@router.get("/display", response_model=DisplaySettings)
def get_display(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settings_service.get_display(db, current_user.id)


@router.put("/display", response_model=DisplaySettings)
def update_display(
    data: DisplaySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settings_service.update_display(db, current_user.id, data)


# ── AI Preferences ────────────────────────────────────────────────────────────

@router.get("/ai", response_model=AIPreferencesSettings)
def get_ai_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settings_service.get_ai(db, current_user.id)


@router.put("/ai", response_model=AIPreferencesSettings)
def update_ai_preferences(
    data: AIPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settings_service.update_ai(db, current_user.id, data)


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=NotificationSettings)
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settings_service.get_notifications(db, current_user.id)


@router.put("/notifications", response_model=NotificationSettings)
def update_notifications(
    data: NotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settings_service.update_notifications(db, current_user.id, data)
