import React, { memo, useEffect } from 'react';
import { usePomodoroStore } from '../../store/pomodoroStore';
import './styles.css';

const PomodoroStats: React.FC = () => {
  const { stats, fetchStats } = usePomodoroStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const hours = Math.floor(stats.total_focus_minutes / 60);
  const mins = stats.total_focus_minutes % 60;

  return (
    <div className="pomo-stats">
      <div className="pomo-stat" title="Pomodoros hoje">
        <span className="pomo-stat-value">{stats.today_pomodoros}</span>
        <span className="pomo-stat-label">hoje</span>
      </div>
      <div className="pomo-stat-divider" />
      <div className="pomo-stat" title="Foco total acumulado">
        <span className="pomo-stat-value">
          {hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ''}` : `${mins}m`}
        </span>
        <span className="pomo-stat-label">total</span>
      </div>
    </div>
  );
};

export default memo(PomodoroStats);
