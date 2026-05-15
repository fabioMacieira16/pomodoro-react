import React, { memo } from 'react';
import type { StudyPlanItemResponse } from '../../../types';
import PlanItem from '../PlanItem';
import './styles.css';

interface Props {
  date: string | null;
  items: StudyPlanItemResponse[];
  onToggle: (id: number, completed: boolean) => void;
}

const DailyList: React.FC<Props> = ({ date, items, onToggle }) => {
  const dayItems = date
    ? items.filter((i) => i.scheduled_date.slice(0, 10) === date)
    : [];

  const totalMin  = dayItems.reduce((s, i) => s + i.duration_minutes, 0);
  const doneCount = dayItems.filter((i) => i.completed).length;

  const formattedDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      })
    : '';

  return (
    <div className="daily-list">
      {date && (
        <div className="daily-list__header">
          <span className="daily-list__date">{formattedDate}</span>
          {dayItems.length > 0 && (
            <span className="daily-list__summary">
              {doneCount}/{dayItems.length} · {totalMin} min
            </span>
          )}
        </div>
      )}

      {dayItems.length === 0 ? (
        <p className="daily-list__empty">
          {date ? 'Sem sessões neste dia.' : 'Selecione um dia no calendário.'}
        </p>
      ) : (
        <ul className="daily-list__items">
          {dayItems.map((item) => (
            <li key={item.id}>
              <PlanItem item={item} onToggle={onToggle} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default memo(DailyList);
