import React, { memo } from 'react';
import type { StudyPlanItemResponse } from '../../../types';
import './styles.css';

interface Props {
  item: StudyPlanItemResponse;
  onToggle: (id: number, completed: boolean) => void;
}

const SESSION_LABELS: Record<string, string> = {
  first_study: 'Estudo',
  review:      'Revisão',
};

const PlanItem: React.FC<Props> = ({ item, onToggle }) => (
  <div className={`plan-item${item.completed ? ' plan-item--done' : ''}`}>
    <input
      className="plan-item__check"
      type="checkbox"
      checked={item.completed}
      onChange={() => onToggle(item.id, !item.completed)}
    />
    <div className="plan-item__body">
      <span className="plan-item__topic">{item.topic_name}</span>
      <span className="plan-item__meta">{item.duration_minutes} min</span>
    </div>
    <span className={`plan-item__badge plan-item__badge--${item.session_type}`}>
      {SESSION_LABELS[item.session_type] ?? item.session_type}
    </span>
  </div>
);

export default memo(PlanItem);
