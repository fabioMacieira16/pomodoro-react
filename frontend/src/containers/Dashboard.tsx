import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { useStudyContext } from '../store/studyContextStore';
import StatCard from '../components/Dashboard/StatCard';
import Heatmap from '../components/Dashboard/Heatmap';
import ConsistencyBar from '../components/Dashboard/ConsistencyBar';
import WeeklyChart from '../components/Dashboard/WeeklyChart';
import './Dashboard.css';

const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, fetchDashboard } = useDashboardStore();
  const { context, fetchContext, getTodaysSubjects, getWeakSubjects, getPendingReviews } = useStudyContext();

  useEffect(() => {
    fetchDashboard();
    fetchContext();
  }, [fetchDashboard, fetchContext]);

  const todaysSubjects = getTodaysSubjects();
  const weakSubjects = getWeakSubjects();
  const pendingReviews = getPendingReviews();
  const daysLeft = daysUntil(context.exam_date);

  const statsLoading = isLoading || (!data && !error);

  return (
    <div className="dashboard">
      {/* ── Plano Ativo ────────────────────────────────── */}
      {context.edital_active && (
        <section className="dashboard__plano-ativo">
          <div className="dashboard__plano-header">
            <div className="dashboard__plano-info">
              <span className="dashboard__plano-badge">📋 Plano Ativo</span>
              <h2 className="dashboard__plano-title">{context.concurso ?? 'Concurso'}</h2>
              <div className="dashboard__plano-meta">
                {context.banca && <span>🏛 {context.banca}</span>}
                {context.cargo && <span>💼 {context.cargo}</span>}
              </div>
            </div>
            {daysLeft !== null && (
              <div className={`dashboard__countdown ${daysLeft <= 30 ? 'countdown--urgent' : ''}`}>
                <span className="countdown__number">{daysLeft}</span>
                <span className="countdown__label">dias para a prova</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Stats (Pomodoro) ───────────────────────────── */}
      {statsLoading ? (
        <section className="dashboard__section"><p className="dashboard__loading-text">Carregando métricas...</p></section>
      ) : error || !data ? (
        <section className="dashboard__section">
          <p className="dashboard__error-text">{error ?? 'Erro ao carregar dados.'}</p>
          <button className="dashboard__back-btn" onClick={() => navigate('/')}>← Ir para Pomodoro</button>
        </section>
      ) : (
        <>
          <section className="dashboard__stats-grid">
            <StatCard label="Horas hoje" value={data.stats.hours_studied_today.toFixed(1)} unit="h" />
            <StatCard label="Horas esta semana" value={data.stats.hours_studied_week.toFixed(1)} unit="h" />
            <StatCard label="Horas no total" value={data.stats.hours_studied_all.toFixed(1)} unit="h" />
            <StatCard label="Sequência" value={data.stats.current_streak} unit="dias" />
            <StatCard
              label="Matéria mais estudada"
              value={data.stats.most_studied_subject ?? '—'}
              sub={data.stats.most_studied_subject_minutes != null
                ? `${data.stats.most_studied_subject_minutes} min`
                : undefined}
            />
          </section>

          <section className="dashboard__section">
            <ConsistencyBar label="Consistência (últimos 30 dias)" value={data.stats.consistency_pct} max={100} unit="%" />
            <ConsistencyBar label="Eficiência" value={data.stats.efficiency_pct} max={100} unit="%" color="rgba(16, 185, 129, 0.85)" />
            <ConsistencyBar
              label={`Tempo focado esta semana (meta: ${Math.round(data.stats.weekly_goal_minutes / 60)}h)`}
              value={data.stats.weekly_focus_minutes}
              max={data.stats.weekly_goal_minutes}
              unit=" min"
            />
          </section>
        </>
      )}

      {/* ── Agenda de Hoje ─────────────────────────────── */}
      {todaysSubjects.length > 0 && (
        <section className="dashboard__section">
          <h3 className="dashboard__section-title">📅 Agenda de Hoje</h3>
          <div className="dashboard__today-subjects">
            {todaysSubjects.map(subject => {
              const perf = context.performances.find(p => p.subject === subject);
              return (
                <div key={subject} className="dashboard__subject-chip">
                  <span className="subject-chip__name">{subject}</span>
                  {perf && (
                    <span className={`subject-chip__acc ${perf.accuracy >= 70 ? 'acc--good' : perf.accuracy >= 50 ? 'acc--mid' : 'acc--bad'}`}>
                      {Math.round(perf.accuracy)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Agenda Semanal ─────────────────────────────── */}
      {context.weekly_schedule.length > 0 && (
        <section className="dashboard__section">
          <h3 className="dashboard__section-title">📆 Agenda Semanal</h3>
          <div className="dashboard__weekly-agenda">
            {context.weekly_schedule.map(slot => {
              const today = new Date().getDay();
              const adjustedToday = today === 0 ? 6 : today - 1;
              const isToday = slot.day_of_week === adjustedToday;
              return (
                <div key={slot.day_of_week} className={`agenda-day ${isToday ? 'agenda-day--today' : ''}`}>
                  <div className="agenda-day__label">{DAY_NAMES[slot.day_of_week]}</div>
                  <div className="agenda-day__subjects">
                    {slot.subjects.map(s => <span key={s} className="agenda-day__subject">{s}</span>)}
                  </div>
                  <div className="agenda-day__hours">{slot.study_hours}h</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Revisões Pendentes ─────────────────────────── */}
      {pendingReviews.length > 0 && (
        <section className="dashboard__section">
          <h3 className="dashboard__section-title">🔁 Revisões Pendentes ({pendingReviews.length})</h3>
          <div className="dashboard__reviews">
            {pendingReviews.slice(0, 5).map((r, i) => (
              <div key={i} className="dashboard__review-item">
                <span className="review-item__subject">{r.subject}</span>
                <span className="review-item__topic">{r.topic}</span>
              </div>
            ))}
            {pendingReviews.length > 5 && (
              <button className="dashboard__view-all" onClick={() => navigate('/anki')}>
                Ver todas ({pendingReviews.length}) →
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── Disciplinas com baixo desempenho ───────────── */}
      {weakSubjects.length > 0 && (
        <section className="dashboard__section">
          <h3 className="dashboard__section-title">⚠️ Disciplinas para Reforçar</h3>
          <div className="dashboard__weak-subjects">
            {weakSubjects.map(p => (
              <div key={p.subject} className="dashboard__weak-item">
                <div className="weak-item__name">{p.subject}</div>
                <div className="weak-item__stats">
                  <span className="weak-item__acc">Acerto: {Math.round(p.accuracy)}%</span>
                  <span className="weak-item__hours">{p.study_hours.toFixed(1)}h estudadas</span>
                </div>
                <div className="weak-item__bar">
                  <div className="weak-item__bar-fill" style={{ width: `${p.accuracy}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Desempenho por Disciplina ──────────────────── */}
      {context.performances.length > 0 && (
        <section className="dashboard__section">
          <h3 className="dashboard__section-title">📊 Desempenho por Disciplina</h3>
          <div className="dashboard__performances">
            {[...context.performances]
              .sort((a, b) => b.study_hours - a.study_hours)
              .map(p => (
                <div key={p.subject} className="dashboard__perf-row">
                  <span className="perf-row__name">{p.subject}</span>
                  <div className="perf-row__bar-wrap">
                    <div
                      className={`perf-row__bar ${p.accuracy >= 70 ? 'bar--good' : p.accuracy >= 50 ? 'bar--mid' : 'bar--bad'}`}
                      style={{ width: `${p.accuracy}%` }}
                    />
                  </div>
                  <span className="perf-row__pct">{Math.round(p.accuracy)}%</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ── Gráficos (quando há dados) ─────────────────── */}
      {data && (
        <>
          <section className="dashboard__section">
            <WeeklyChart data={data.weekly_evolution} />
          </section>
          <section className="dashboard__section">
            <Heatmap data={data.heatmap} />
          </section>
        </>
      )}

      {/* ── Sem plano ativo ────────────────────────────── */}
      {!context.edital_active && (
        <div className="dashboard__empty-plan">
          <p>Nenhum plano de estudos ativo.</p>
          <button className="dashboard__cta" onClick={() => navigate('/estudos')}>
            📚 Importar Edital
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
