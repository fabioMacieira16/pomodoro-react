import React, { memo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { WeeklyEvolutionEntry } from '../../../types';
import './styles.css';

interface WeeklyChartProps {
  data: WeeklyEvolutionEntry[];
}

const WeeklyChart: React.FC<WeeklyChartProps> = ({ data }) => (
  <div className="weekly-chart">
    <p className="weekly-chart__title">Evolução semanal</p>
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="day_label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="pomodoros" name="Pomodoros" fill="rgba(49, 51, 212, 0.85)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="focus_minutes" name="Minutos focados" fill="rgba(10, 233, 81, 0.85)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default memo(WeeklyChart);
