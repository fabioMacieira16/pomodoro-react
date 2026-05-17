import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import StatCard from '../components/Dashboard/StatCard';
import Heatmap from '../components/Dashboard/Heatmap';
import ConsistencyBar from '../components/Dashboard/ConsistencyBar';
import WeeklyChart from '../components/Dashboard/WeeklyChart';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, fetchDashboard } = useDashboardStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading || (!data && !error)) {
    return (
      <div className="dashboard dashboard--loading">
        <p>Carregando...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="dashboard dashboard--loading">
        <p>{error ?? 'Erro ao carregar dados.'}</p>
        <button className="dashboard__back-btn" onClick={() => navigate('/')}>← Voltar</button>
      </div>
    );
  }

  const { stats, heatmap, weekly_evolution } = data;

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1 className="dashboard__title">Dashboard</h1>
      </header>

      <section className="dashboard__stats-grid">
        <StatCard label="Horas hoje" value={stats.hours_studied_today.toFixed(1)} unit="h" />
        <StatCard label="Horas esta semana" value={stats.hours_studied_week.toFixed(1)} unit="h" />
        <StatCard label="Horas no total" value={stats.hours_studied_all.toFixed(1)} unit="h" />
        <StatCard label="Sequência" value={stats.current_streak} unit="dias" />
        <StatCard
          label="Matéria mais estudada"
          value={stats.most_studied_subject ?? '—'}
          sub={
            stats.most_studied_subject_minutes != null
              ? `${stats.most_studied_subject_minutes} min`
              : undefined
          }
        />
      </section>

      <section className="dashboard__section">
        <ConsistencyBar
          label="Consistência (últimos 30 dias)"
          value={stats.consistency_pct}
          max={100}
          unit="%"
        />
        <ConsistencyBar
          label="Eficiência"
          value={stats.efficiency_pct}
          max={100}
          unit="%"
          color="rgba(16, 185, 129, 0.85)"
        />
        <ConsistencyBar
          label={`Tempo focado esta semana (meta: ${Math.round(stats.weekly_goal_minutes / 60)}h)`}
          value={stats.weekly_focus_minutes}
          max={stats.weekly_goal_minutes}
          unit=" min"
        />
      </section>

      <section className="dashboard__section">
        <WeeklyChart data={weekly_evolution} />
      </section>

      <section className="dashboard__section">
        <Heatmap data={heatmap} />
      </section>
    </div>
  );
};

export default Dashboard;
