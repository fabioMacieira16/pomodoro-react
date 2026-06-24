import React, { useState } from 'react';
import { formatTime } from '../helpers';
import './TimeDisplay.css';

interface TimeDisplayProps {
  time: number;
  status: string | null;
  progress: number;
  phaseColor?: string;
  editable?: boolean;
  onChangeMinutes?: (minutes: number) => void;
}

const TimeDisplay: React.FC<TimeDisplayProps> = ({ time, status, progress, phaseColor = '#ef4444', editable = false, onChangeMinutes }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftMinutes, setDraftMinutes] = useState('');

  const startEditing = () => {
    if (!editable) return;
    setDraftMinutes(String(Math.round(time / 60)));
    setIsEditing(true);
  };

  const commitEdit = () => {
    const minutes = parseInt(draftMinutes, 10);
    if (!isNaN(minutes) && minutes > 0 && onChangeMinutes) {
      onChangeMinutes(minutes);
    }
    setIsEditing(false);
  };

  const radius = 150;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="TimeDisplay">
      <svg width="100%" viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
        <circle
          className="time-ring-bg"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={phaseColor}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.9s ease, stroke 0.4s ease' }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div>
        {isEditing ? (
          <input
            type="number"
            min={1}
            max={120}
            autoFocus
            className="time-digits-input"
            value={draftMinutes}
            onChange={(e) => setDraftMinutes(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
          />
        ) : (
          <h1
            className={`time-digits ${editable ? 'time-digits--editable' : ''}`}
            onClick={startEditing}
            title={editable ? 'Clique para editar a duração' : undefined}
          >
            {formatTime(time)}
          </h1>
        )}
        {status && <p className="time-status">{status}</p>}
      </div>
    </div>
  );
};

export default TimeDisplay;
