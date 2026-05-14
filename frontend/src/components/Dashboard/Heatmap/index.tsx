import React, { memo } from 'react';
import type { HeatmapEntry } from '../../../types';
import './styles.css';

interface HeatmapProps {
  data: HeatmapEntry[];
}

function countToLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function buildCells(data: HeatmapEntry[]): { date: string; count: number }[] {
  const map = new Map(data.map((e) => [e.date, e.count]));
  const today = new Date();
  const cells: { date: string; count: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, count: map.get(key) ?? 0 });
  }
  return cells;
}

const Heatmap: React.FC<HeatmapProps> = ({ data }) => {
  const cells = buildCells(data);

  return (
    <div className="heatmap">
      <p className="heatmap__title">Atividade (últimos 84 dias)</p>
      <div className="heatmap__grid">
        {cells.map((cell) => (
          <div
            key={cell.date}
            className={`heatmap__cell heatmap__cell--l${countToLevel(cell.count)}`}
            title={`${cell.date}: ${cell.count} pomodoro${cell.count !== 1 ? 's' : ''}`}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(Heatmap);
