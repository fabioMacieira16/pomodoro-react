import React, { memo } from 'react';
import { usePomodoroSettings } from '../../store/pomodoroSettingsStore';
import type { DarkModePreference, SoundType } from '../../types';
import './styles.css';

interface SettingsPanelProps {
  onClose: () => void;
}

const SoundOptions: { value: SoundType; label: string }[] = [
  { value: 'bell', label: '🔔 Sino' },
  { value: 'beep', label: '📡 Beep' },
  { value: 'digital', label: '🎵 Digital' },
  { value: 'none', label: '🔇 Nenhum' },
];

const DarkModeOptions: { value: DarkModePreference; label: string }[] = [
  { value: 'auto', label: '🌗 Automático' },
  { value: 'light', label: '☀️ Claro' },
  { value: 'dark', label: '🌙 Escuro' },
];

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const s = usePomodoroSettings();

  const handleChange = <K extends keyof typeof s>(key: K, value: (typeof s)[K]) => {
    s.update({ [key]: value } as any);
  };

  const handleSave = () => {
    s.syncToBackend();
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel" role="dialog" aria-label="Configurações do Pomodoro">
        <div className="settings-header">
          <h2>⚙️ Configurações</h2>
          <button className="settings-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="settings-body">
          {/* Timer durations */}
          <section className="settings-section">
            <h3>⏱ Durações (minutos)</h3>
            <div className="settings-grid">
              <label>
                Pomodoro
                <input
                  type="number"
                  min={1} max={120}
                  value={s.pomodoroMinutes}
                  onChange={(e) => handleChange('pomodoroMinutes', Number(e.target.value))}
                />
              </label>
              <label>
                Pausa Curta
                <input
                  type="number"
                  min={1} max={60}
                  value={s.shortBreakMinutes}
                  onChange={(e) => handleChange('shortBreakMinutes', Number(e.target.value))}
                />
              </label>
              <label>
                Pausa Longa
                <input
                  type="number"
                  min={1} max={120}
                  value={s.longBreakMinutes}
                  onChange={(e) => handleChange('longBreakMinutes', Number(e.target.value))}
                />
              </label>
              <label>
                Pomodoros p/ pausa longa
                <input
                  type="number"
                  min={1} max={10}
                  value={s.longBreakInterval}
                  onChange={(e) => handleChange('longBreakInterval', Number(e.target.value))}
                />
              </label>
            </div>
          </section>

          {/* Auto-start */}
          <section className="settings-section">
            <h3>🔄 Início automático</h3>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={s.autoStartBreaks}
                onChange={(e) => handleChange('autoStartBreaks', e.target.checked)}
              />
              <span>Iniciar pausas automaticamente</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={s.autoStartPomodoros}
                onChange={(e) => handleChange('autoStartPomodoros', e.target.checked)}
              />
              <span>Iniciar pomodoros automaticamente</span>
            </label>
          </section>

          {/* Sound */}
          <section className="settings-section">
            <h3>🔊 Som</h3>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={s.soundEnabled}
                onChange={(e) => handleChange('soundEnabled', e.target.checked)}
              />
              <span>Ativar sons</span>
            </label>
            <div className="settings-radio-group">
              {SoundOptions.map((opt) => (
                <label key={opt.value} className={`settings-radio ${s.soundType === opt.value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="soundType"
                    value={opt.value}
                    checked={s.soundType === opt.value}
                    onChange={() => handleChange('soundType', opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </section>

          {/* Dark mode */}
          <section className="settings-section">
            <h3>🎨 Tema</h3>
            <div className="settings-radio-group">
              {DarkModeOptions.map((opt) => (
                <label key={opt.value} className={`settings-radio ${s.darkMode === opt.value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="darkMode"
                    value={opt.value}
                    checked={s.darkMode === opt.value}
                    onChange={() => handleChange('darkMode', opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <button className="settings-cancel" onClick={onClose}>Cancelar</button>
          <button className="settings-save" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
};

export default memo(SettingsPanel);
