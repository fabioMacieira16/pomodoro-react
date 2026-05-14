import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/client';
import type { DarkModePreference, SoundType } from '../types';

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
          const d = res.data;
          set({
            autoStartBreaks: d.auto_start_breaks,
            autoStartPomodoros: d.auto_start_pomodoros,
            longBreakInterval: d.long_break_interval,
            soundEnabled: d.sound_enabled,
            focusMode: d.focus_mode,
            darkMode: d.dark_mode ? 'dark' : get().darkMode,
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
