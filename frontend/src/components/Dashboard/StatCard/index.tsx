import React, { memo } from 'react';
import './styles.css';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, sub }) => (
  <div className="stat-card">
    <span className="stat-card__label">{label}</span>
    <div className="stat-card__value-row">
      <span className="stat-card__value">{value}</span>
      {unit && <span className="stat-card__unit">{unit}</span>}
    </div>
    {sub && <span className="stat-card__sub">{sub}</span>}
  </div>
);

export default memo(StatCard);
