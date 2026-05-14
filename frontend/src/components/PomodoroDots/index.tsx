import React, { memo } from 'react';
import './styles.css';

interface PomodoroDotsProps {
  pomodoroCount: number;
  longBreakInterval: number;
}

const PomodoroDots: React.FC<PomodoroDotsProps> = ({ pomodoroCount, longBreakInterval }) => {
  const position = pomodoroCount % longBreakInterval;
  return (
    <div className="pomo-dots" title={`${longBreakInterval - position} pomodoro(s) até a pausa longa`}>
      {Array.from({ length: longBreakInterval }).map((_, i) => (
        <span key={i} className={`pomo-dot ${i < position ? 'filled' : ''}`} />
      ))}
    </div>
  );
};

export default memo(PomodoroDots);
