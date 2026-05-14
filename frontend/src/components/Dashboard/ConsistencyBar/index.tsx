import React, { memo } from 'react';
import './styles.css';

interface ConsistencyBarProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  color?: string;
}

const ConsistencyBar: React.FC<ConsistencyBarProps> = ({
  label,
  value,
  max,
  unit = '%',
  color,
}) => {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <div className="consistency-bar">
      <div className="consistency-bar__header">
        <span className="consistency-bar__label">{label}</span>
        <span className="consistency-bar__value">
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="consistency-bar__track">
        <div
          className="consistency-bar__fill"
          style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }}
        />
      </div>
    </div>
  );
};

export default memo(ConsistencyBar);
