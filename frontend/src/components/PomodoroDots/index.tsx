import React, { memo } from 'react';
import './styles.css';

interface PomodoroDotsProps {
  pomodoroCount: number;
  longBreakInterval: number;
  totalDots?: number;   // override with task's estimated pomodoros
  filledDots?: number;  // override with task's actual pomodoros
}

const PomodoroDots: React.FC<PomodoroDotsProps> = ({
  pomodoroCount,
  longBreakInterval,
  totalDots,
  filledDots,
}) => {
  const total = totalDots != null ? totalDots : longBreakInterval;
  const filled = filledDots != null ? filledDots : pomodoroCount % longBreakInterval;
  return (
    <div className="pomo-dots" title={totalDots != null ? `${filled}/${total} pomodoros` : `${longBreakInterval - (pomodoroCount % longBreakInterval)} pomodoro(s) até a pausa longa`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`pomo-dot ${i < filled ? 'filled' : ''}`} />
      ))}
    </div>
  );
};

export default memo(PomodoroDots);
