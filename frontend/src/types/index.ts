export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface StudyType {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  study_type_id: number;
}

export interface Subject {
  id: number;
  name: string;
  description?: string;
  priority: number;
  weight: number;
  difficulty: string;
  exam_board?: string;
  color: string;
  weekly_goal_minutes: number;
  total_studied_minutes: number;
  category_id: number;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
  completed: boolean;
  estimated_minutes: number;
  actual_minutes: number;
  position: number;
  user_id: number;
  subject_id?: number;
}

export interface PomodoroSession {
  id: number;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  session_type: string;
  completed: boolean;
  interruptions: number;
  productivity_rating?: number;
  user_id: number;
  subject_id?: number;
}

export interface PomodoroStats {
  today_pomodoros: number;
  total_focus_minutes: number;
  total_sessions: number;
}

export interface Schedule {
  id: number;
  day_of_week: number;
  time_of_day: string;
  duration_minutes: number;
  subject_id: number;
}

export interface Setting {
  id: number;
  user_id: number;
  auto_start_breaks: boolean;
  auto_start_pomodoros: boolean;
  long_break_interval: number;
  dark_mode: boolean;
  focus_mode: boolean;
  theme_color: string;
  sound_enabled: boolean;
}

export type TimerPhase = 'pomodoro' | 'shortBreak' | 'longBreak';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished' | 'countdown';
export type DarkModePreference = 'auto' | 'dark' | 'light';
export type SoundType = 'bell' | 'beep' | 'digital' | 'none';

export interface StudyMetric {
  id: number;
  user_id: number;
  date: string;
  total_minutes: number;
  streak_days: number;
}
