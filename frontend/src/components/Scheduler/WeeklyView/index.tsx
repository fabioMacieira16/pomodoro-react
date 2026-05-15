import React, { memo, useState } from 'react';
import type { StudyPlanItemResponse } from '../../../types';
import './styles.css';

interface Props {
  planItems: StudyPlanItemResponse[];
  onSelectDay: (date: string) => void;
  selectedDay: string | null;
  onToggleItem: (itemId: number, completed: boolean) => void;
}

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const toDateStr = (d: Date): string => d.toISOString().slice(0, 10);

const getMonday = (d: Date): Date => {
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
};

const WeeklyView: React.FC<Props> = ({ planItems, onSelectDay, selectedDay, onToggleItem }) => {
  const [weekOffset, setWeekOffset] = useState(0);

  const baseMonday = getMonday(new Date());
  baseMonday.setDate(baseMonday.getDate() + weekOffset * 7);

  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseMonday);
    d.setDate(baseMonday.getDate() + i);
    return d;
  });

  const itemsByDate: Record<string, StudyPlanItemResponse[]> = {};
  for (const item of planItems) {
    const key = item.scheduled_date.slice(0, 10);
    if (!itemsByDate[key]) itemsByDate[key] = [];
    itemsByDate[key].push(item);
  }

  const weekLabel = `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <div className="weekly-view">
      <div className="weekly-view__nav">
        <button className="weekly-view__nav-btn" onClick={() => setWeekOffset((o) => o - 1)}>‹</button>
        <span className="weekly-view__week-label">{weekLabel}</span>
        <button className="weekly-view__nav-btn" onClick={() => setWeekOffset((o) => o + 1)}>›</button>
      </div>

      <div className="weekly-view__grid">
        {weekDays.map((day, idx) => {
          const dateStr   = toDateStr(day);
          const items     = itemsByDate[dateStr] || [];
          const isToday   = dateStr === toDateStr(new Date());
          const isSelected = dateStr === selectedDay;
          const totalMin  = items.reduce((s, i) => s + i.duration_minutes, 0);

          return (
            <div
              key={idx}
              className={[
                'weekly-view__day',
                isToday    ? 'weekly-view__day--today'    : '',
                isSelected ? 'weekly-view__day--selected' : '',
              ].join(' ').trim()}
              onClick={() => onSelectDay(dateStr)}
            >
              <div className="weekly-view__day-header">
                <span className="weekly-view__day-name">{DAY_NAMES[idx]}</span>
                <span className="weekly-view__day-date">{day.getDate()}</span>
              </div>

              {items.length > 0 && (
                <div className="weekly-view__day-total">{totalMin} min</div>
              )}

              <ul className="weekly-view__items">
                {items.slice(0, 3).map((item) => (
                  <li
                    key={item.id}
                    className={`weekly-view__item weekly-view__item--${item.session_type}${item.completed ? ' weekly-view__item--done' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggleItem(item.id, !item.completed); }}
                    title={`${item.topic_name} · ${item.duration_minutes} min`}
                  >
                    {item.topic_name.slice(0, 10)}
                  </li>
                ))}
                {items.length > 3 && (
                  <li className="weekly-view__item-more">+{items.length - 3}</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(WeeklyView);
