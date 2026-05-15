import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/client';
import type { DarkModePreference, SoundType } from '../types';

type SettingsResponse = {
  auto_start_breaks?: boolean;
  auto_start_pomodoros?: boolean;
  long_break_interval?: number;
  sound_enabled?: boolean;
  focus_mode?: boolean;
  dark_mode?: boolean;
  pomodoro?: {
    auto_start_breaks?: boolean;
    auto_start_pomodoros?: boolean;
    long_break_interval?: number;
  };
  display?: {
    dark_mode?: boolean;
    focus_mode?: boolean;
  };
  notifications?: {
    sound_enabled?: boolean;
  };
  ai?: {
    sound_enabled?: boolean;
  };
};

interface PomodoroSettingsState {
  // Timer durations
  pomodoroMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  // Automation
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  longBreakInterval: number;
  // Sound
  soundEnabled: boolean;
  soundType: SoundType;
  // Display
  darkMode: DarkModePreference;
  focusMode: boolean;
  // Actions
  update: (partial: Partial<Omit<PomodoroSettingsState, 'update' | 'syncFromBackend' | 'syncToBackend'>>) => void;
  syncFromBackend: () => Promise<void>;
  syncToBackend: () => Promise<void>;
}

export const usePomodoroSettings = create<PomodoroSettingsState>()(
  persist(
    (set, get) => ({
      pomodoroMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      autoStartBreaks: false,
      autoStartPomodoros: false,
      longBreakInterval: 4,
      soundEnabled: true,
      soundType: 'bell',
      darkMode: 'auto',
      focusMode: false,

      update: (partial) => set(partial as Partial<PomodoroSettingsState>),

      syncFromBackend: async () => {
        try {
          const res = await api.get('/settings/');
          const d = res.data as SettingsResponse;
          const pomodoro = d.pomodoro ?? d;
          const display = d.display ?? d;
          const notifications = d.notifications ?? d.ai ?? d;

          set({
            autoStartBreaks: pomodoro.auto_start_breaks ?? get().autoStartBreaks,
            autoStartPomodoros: pomodoro.auto_start_pomodoros ?? get().autoStartPomodoros,
            longBreakInterval: pomodoro.long_break_interval ?? get().longBreakInterval,
            soundEnabled: notifications.sound_enabled ?? get().soundEnabled,
            focusMode: display.focus_mode ?? get().focusMode,
            darkMode:
              display.dark_mode === undefined
                ? get().darkMode
                : display.dark_mode
                  ? 'dark'
                  : 'light',
          });
        } catch {
          // Not authenticated or offline — use localStorage values
        }
      },

      syncToBackend: async () => {
        try {
          const s = get();
          await api.put('/settings/', {
            auto_start_breaks: s.autoStartBreaks,
            auto_start_pomodoros: s.autoStartPomodoros,
            long_break_interval: s.longBreakInterval,
            sound_enabled: s.soundEnabled,
            focus_mode: s.focusMode,
            dark_mode: s.darkMode === 'dark',
          });
        } catch {
          // Offline or not authenticated
        }
      },
    }),
    {
      name: 'pomodoro-settings-v1',
      partialize: (s) => ({
        pomodoroMinutes: s.pomodoroMinutes,
        shortBreakMinutes: s.shortBreakMinutes,
        longBreakMinutes: s.longBreakMinutes,
        autoStartBreaks: s.autoStartBreaks,
        autoStartPomodoros: s.autoStartPomodoros,
        longBreakInterval: s.longBreakInterval,
        soundEnabled: s.soundEnabled,
        soundType: s.soundType,
        darkMode: s.darkMode,
        focusMode: s.focusMode,
      }),
    }
  )
);
