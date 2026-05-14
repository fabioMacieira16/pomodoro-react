from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# --- Users ---
class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None

# --- Tasks ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "Medium"
    due_date: Optional[datetime] = None
    estimated_minutes: int = 25
    position: int = 0
    subject_id: Optional[int] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    position: Optional[int] = None

class TaskResponse(TaskBase):
    id: int
    completed: bool
    actual_minutes: int
    user_id: int

    class Config:
        from_attributes = True

# --- Pomodoro ---
class PomodoroSessionCreate(BaseModel):
    duration_minutes: int
    session_type: str  # Pomodoro, Short Break, Long Break
    completed: bool = True
    interruptions: int = 0
    productivity_rating: Optional[int] = None
    subject_id: Optional[int] = None

class PomodoroSessionUpdate(BaseModel):
    productivity_rating: Optional[int] = None
    interruptions: Optional[int] = None
    completed: Optional[bool] = None

class PomodoroSessionResponse(BaseModel):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    duration_minutes: int
    session_type: str
    completed: bool
    interruptions: int
    productivity_rating: Optional[int]
    user_id: int
    subject_id: Optional[int]

    class Config:
        from_attributes = True

class PomodoroStatsResponse(BaseModel):
    today_pomodoros: int
    total_focus_minutes: int
    total_sessions: int

# --- Settings ---
class SettingUpdate(BaseModel):
    auto_start_breaks: Optional[bool] = None
    auto_start_pomodoros: Optional[bool] = None
    long_break_interval: Optional[int] = None
    dark_mode: Optional[bool] = None
    focus_mode: Optional[bool] = None
    theme_color: Optional[str] = None
    sound_enabled: Optional[bool] = None

class SettingResponse(BaseModel):
    id: int
    user_id: int
    auto_start_breaks: bool
    auto_start_pomodoros: bool
    long_break_interval: int
    dark_mode: bool
    focus_mode: bool
    theme_color: str
    sound_enabled: bool

    class Config:
        from_attributes = True
