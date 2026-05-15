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

export interface DashboardStats {
  hours_studied_today: number;
  hours_studied_week: number;
  hours_studied_all: number;
  current_streak: number;
  consistency_pct: number;
  efficiency_pct: number;
  weekly_focus_minutes: number;
  weekly_goal_minutes: number;
  most_studied_subject?: string;
  most_studied_subject_minutes?: number;
}

export interface HeatmapEntry {
  date: string;
  count: number;
}

export interface WeeklyEvolutionEntry {
  day: string;
  day_label: string;
  pomodoros: number;
  focus_minutes: number;
}

export interface DashboardData {
  stats: DashboardStats;
  heatmap: HeatmapEntry[];
  weekly_evolution: WeeklyEvolutionEntry[];
}

// ── Smart Scheduler ──────────────────────────────────────────────────────────

export interface ExamTopicCreate {
  name: string;
  estimated_hours: number;
  priority: number;
  subject_id?: number;
}

export interface ExamCreate {
  name: string;
  exam_date: string;
  daily_hours: number;
  available_days: number[];
  topics: ExamTopicCreate[];
}

export interface ExamTopicResponse {
  id: number;
  exam_id: number;
  name: string;
  estimated_hours: number;
  priority: number;
  subject_id?: number;
}

export interface ExamSummary {
  id: number;
  name: string;
  exam_date: string;
  daily_hours: number;
  available_days: string;
  created_at: string;
  topic_count: number;
}

export interface ExamResponse extends ExamSummary {
  topics: ExamTopicResponse[];
}

export interface StudyPlanItemResponse {
  id: number;
  exam_id: number;
  exam_topic_id: number;
  scheduled_date: string;
  duration_minutes: number;
  session_type: 'first_study' | 'review';
  review_interval: number | null;
  completed: boolean;
  topic_name: string;
}
