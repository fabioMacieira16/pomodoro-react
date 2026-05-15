from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


# ── Pomodoro ─────────────────────────────────────────────────────────────────

class PomodoroSettings(BaseModel):
    work_duration_minutes: int = Field(25, ge=1, le=120)
    short_break_minutes: int = Field(5, ge=1, le=60)
    long_break_minutes: int = Field(15, ge=1, le=120)
    long_break_interval: int = Field(4, ge=1, le=10)
    auto_start_breaks: bool = False
    auto_start_pomodoros: bool = False

    class Config:
        from_attributes = True


class PomodoroSettingsUpdate(BaseModel):
    work_duration_minutes: Optional[int] = Field(None, ge=1, le=120)
    short_break_minutes: Optional[int] = Field(None, ge=1, le=60)
    long_break_minutes: Optional[int] = Field(None, ge=1, le=120)
    long_break_interval: Optional[int] = Field(None, ge=1, le=10)
    auto_start_breaks: Optional[bool] = None
    auto_start_pomodoros: Optional[bool] = None


# ── Display ───────────────────────────────────────────────────────────────────

class DisplaySettings(BaseModel):
    dark_mode: bool = False
    focus_mode: bool = True
    theme_color: str = "blue"
    language: str = "pt"
    weekly_goal_minutes: int = Field(600, ge=0)

    class Config:
        from_attributes = True


class DisplaySettingsUpdate(BaseModel):
    dark_mode: Optional[bool] = None
    focus_mode: Optional[bool] = None
    theme_color: Optional[str] = None
    language: Optional[str] = None
    weekly_goal_minutes: Optional[int] = Field(None, ge=0)


# ── AI preferences ────────────────────────────────────────────────────────────

class AIPreferencesSettings(BaseModel):
    """
    Per-user AI preferences.
    'ai_provider_preference' lets a user override the server-level AI_PROVIDER.
    If blank, the server .env value is used.
    """
    ai_provider_preference: str = ""  # "" | "openai" | "ollama" | "mock"
    sound_enabled: bool = True

    class Config:
        from_attributes = True


class AIPreferencesUpdate(BaseModel):
    ai_provider_preference: Optional[str] = None
    sound_enabled: Optional[bool] = None


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationSettings(BaseModel):
    sound_enabled: bool = True
    notifications_enabled: bool = True
    desktop_notifications: bool = False

    class Config:
        from_attributes = True


class NotificationSettingsUpdate(BaseModel):
    sound_enabled: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    desktop_notifications: Optional[bool] = None


# ── Aggregate (full settings response) ───────────────────────────────────────

class FullSettingsResponse(BaseModel):
    id: int
    user_id: int
    pomodoro: PomodoroSettings
    display: DisplaySettings
    ai: AIPreferencesSettings
    notifications: NotificationSettings

    class Config:
        from_attributes = True
