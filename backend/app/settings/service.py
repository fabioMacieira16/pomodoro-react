from __future__ import annotations
from sqlalchemy.orm import Session
from app.core.crypto import encrypt_secret
from app.domain.models import Setting
from app.settings.schemas import (
    PomodoroSettings,
    PomodoroSettingsUpdate,
    DisplaySettings,
    DisplaySettingsUpdate,
    AIPreferencesSettings,
    AIPreferencesUpdate,
    NotificationSettings,
    NotificationSettingsUpdate,
    FullSettingsResponse,
)


class SettingsService:
    """Read and update per-user application settings, grouped by category."""

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    @staticmethod
    def get_or_create(db: Session, user_id: int) -> Setting:
        setting = db.query(Setting).filter(Setting.user_id == user_id).first()
        if not setting:
            setting = Setting(user_id=user_id)
            db.add(setting)
            db.commit()
            db.refresh(setting)
        return setting

    # ── Aggregate ──────────────────────────────────────────────────────────────

    def get_full(self, db: Session, user_id: int) -> FullSettingsResponse:
        s = self.get_or_create(db, user_id)
        return FullSettingsResponse(
            id=s.id,
            user_id=s.user_id,
            pomodoro=self._pomodoro(s),
            display=self._display(s),
            ai=self._ai(s),
            notifications=self._notifications(s),
        )

    # ── Pomodoro ───────────────────────────────────────────────────────────────

    def get_pomodoro(self, db: Session, user_id: int) -> PomodoroSettings:
        return self._pomodoro(self.get_or_create(db, user_id))

    def update_pomodoro(self, db: Session, user_id: int, data: PomodoroSettingsUpdate) -> PomodoroSettings:
        s = self.get_or_create(db, user_id)
        self._patch(db, s, data)
        return self._pomodoro(s)

    # ── Display ────────────────────────────────────────────────────────────────

    def get_display(self, db: Session, user_id: int) -> DisplaySettings:
        return self._display(self.get_or_create(db, user_id))

    def update_display(self, db: Session, user_id: int, data: DisplaySettingsUpdate) -> DisplaySettings:
        s = self.get_or_create(db, user_id)
        self._patch(db, s, data)
        return self._display(s)

    # ── AI ─────────────────────────────────────────────────────────────────────

    def get_ai(self, db: Session, user_id: int) -> AIPreferencesSettings:
        return self._ai(self.get_or_create(db, user_id))

    def update_ai(self, db: Session, user_id: int, data: AIPreferencesUpdate) -> AIPreferencesSettings:
        s = self.get_or_create(db, user_id)
        payload = data.model_dump(exclude_unset=True)
        if "ai_api_key" in payload:
            raw_key = payload.pop("ai_api_key")
            s.ai_api_key_encrypted = encrypt_secret(raw_key) if raw_key else ""
        for field, value in payload.items():
            if hasattr(s, field):
                setattr(s, field, value)
        db.commit()
        db.refresh(s)
        return self._ai(s)

    # ── Notifications ──────────────────────────────────────────────────────────

    def get_notifications(self, db: Session, user_id: int) -> NotificationSettings:
        return self._notifications(self.get_or_create(db, user_id))

    def update_notifications(self, db: Session, user_id: int, data: NotificationSettingsUpdate) -> NotificationSettings:
        s = self.get_or_create(db, user_id)
        self._patch(db, s, data)
        return self._notifications(s)

    # ── Private helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _patch(db: Session, setting: Setting, data) -> None:
        for field, value in data.model_dump(exclude_unset=True).items():
            if hasattr(setting, field):
                setattr(setting, field, value)
        db.commit()
        db.refresh(setting)

    @staticmethod
    def _pomodoro(s: Setting) -> PomodoroSettings:
        return PomodoroSettings(
            work_duration_minutes=getattr(s, "work_duration_minutes", 25),
            short_break_minutes=getattr(s, "short_break_minutes", 5),
            long_break_minutes=getattr(s, "long_break_minutes", 15),
            long_break_interval=s.long_break_interval,
            auto_start_breaks=s.auto_start_breaks,
            auto_start_pomodoros=s.auto_start_pomodoros,
        )

    @staticmethod
    def _display(s: Setting) -> DisplaySettings:
        return DisplaySettings(
            dark_mode=s.dark_mode,
            focus_mode=s.focus_mode,
            theme_color=s.theme_color,
            language=getattr(s, "language", "pt"),
            weekly_goal_minutes=getattr(s, "weekly_goal_minutes", 600),
        )

    @staticmethod
    def _ai(s: Setting) -> AIPreferencesSettings:
        return AIPreferencesSettings(
            ai_provider_preference=getattr(s, "ai_provider_preference", ""),
            ai_api_key_set=bool(getattr(s, "ai_api_key_encrypted", "")),
            ollama_base_url=getattr(s, "ollama_base_url", ""),
            ollama_model=getattr(s, "ollama_model", ""),
            sound_enabled=s.sound_enabled,
        )

    @staticmethod
    def _notifications(s: Setting) -> NotificationSettings:
        return NotificationSettings(
            sound_enabled=s.sound_enabled,
            notifications_enabled=getattr(s, "notifications_enabled", True),
            desktop_notifications=getattr(s, "desktop_notifications", False),
        )


settings_service = SettingsService()
