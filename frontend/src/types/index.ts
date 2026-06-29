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

// ── Smart Scheduler ──────────────────────────────────────────────────

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

// ── Anki Types ─────────────────────────────────────────────────────────────────────────────

export type CardType = 'qa' | 'multiple_choice' | 'cloze' | 'true_false';

export interface FlashcardOption {
  id: number;
  text: string;
  is_correct: boolean;
  position: number;
}

export interface Flashcard {
  id: number;
  deck_id: number;
  card_type: CardType;
  front: string;
  back: string;
  hint?: string;
  explanation?: string;
  tags: string[];
  difficulty: string;
  repetitions: number;
  easiness_factor: number;
  interval: number;
  lapses: number;
  last_reviewed?: string;
  next_review?: string;
  created_at: string;
  options: FlashcardOption[];
}

export interface Deck {
  id: number;
  name: string;
  description?: string;
  color: string;
  user_id: number;
  subject_id?: number;
  parent_deck_id?: number;
  created_at: string;
  card_count: number;
  due_count: number;
  new_count: number;
  subdecks?: Deck[];
}

export interface ReviewResult {
  flashcard_id: number;
  next_review: string;
  new_interval: number;
  new_easiness_factor: number;
  new_repetitions: number;
  lapses: number;
}

export interface MaturityBucket {
  label: string;
  count: number;
}

export interface AnkiStats {
  total_cards: number;
  due_today: number;
  new_cards: number;
  retention_rate: number;
  accuracy_rate: number;
  total_reviews: number;
  streak_days: number;
  avg_ease: number;
  cards_by_maturity: MaturityBucket[];
  weekly_reviews: { day: string; count: number }[];
}

export interface AIGenerateRequest {
  deck_id: number;
  source_type: string;
  content: string;
  card_count: number;
  card_types: CardType[];
  language: string;
}

// ── Achievements ────────────────────────────────────────────────────────────

export interface AchievementSummary {
  total_stars: number;
  total_medals: number;
  total_trophies: number;
  total_diamonds: number;
  total_legends: number;
  next_reward: string;
  stars_in_tier: number;
  next_milestone: number;
  progress_pct: number;
}

export interface AchievementUnlock {
  code: string;
  title: string;
  icon: string | null;
  category: string;
  unlocked_at: string;
}

export interface AchievementItem {
  code: string;
  category: string;
  title: string;
  icon: string | null;
  threshold: number | null;
  progress: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface AchievementStats {
  pomodoros_completed: number;
  quizzes_answered: number;
  quizzes_correct: number;
  flashcards_created: number;
  flashcards_reviewed: number;
  total_study_minutes: number;
  total_study_hours: number;
  current_streak_days: number;
  longest_streak_days: number;
  accuracy_pct: number;
}
