import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { useStudyContext } from '../store/studyContextStore';
import { useAnkiStore } from '../store/ankiStore';
import { useAchievementStore } from '../store/achievementStore';
import StatCard from '../components/Dashboard/StatCard';
import ConsistencyBar from '../components/Dashboard/ConsistencyBar';
import WeeklyChart from '../components/Dashboard/WeeklyChart';
import AchievementsCard from '../components/Dashboard/AchievementsCard';
import './Dashboard.css';

const TASK_STATS_KEY = 'pomodoro-task-stats';

interface DailyTaskStat {
  date: string;
  total: number;
  completed: number;
}

function loadTaskStats(): DailyTaskStat[] {
  try {
    return JSON.parse(localStorage.getItem(TASK_STATS_KEY) || '[]');
  } catch {
    return [];
  }
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, fetchDashboard } = useDashboardStore();
  const { context, fetchContext, getWeakSubjects, getPendingReviews } = useStudyContext();
  const { stats: ankiStats, fetchStats: fetchAnkiStats } = useAnkiStore();
  const { summary: achSummary, recent: achRecent, stats: achStats, fetch: fetchAchievements } = useAchievementStore();

  const taskStats = useMemo(() => {
    const stats = loadTaskStats();
    const today = new Date().toISOString().split('T')[0];
    const todayStat = stats.find(s => s.date === today);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const weekStats = stats.filter(s => new Date(s.date) >= weekAgo);
    const monthStats = stats.filter(s => new Date(s.date) >= monthAgo);

    return {
      todayCompleted: todayStat?.completed ?? 0,
      todayTotal: todayStat?.total ?? 0,
      weekCompleted: weekStats.reduce((sum, s) => sum + s.completed, 0),
      weekTotal: weekStats.reduce((sum, s) => sum + s.total, 0),
      monthCompleted: monthStats.reduce((sum, s) => sum + s.completed, 0),
      monthTotal: monthStats.reduce((sum, s) => sum + s.total, 0),
      completionPct: todayStat && todayStat.total > 0
        ? Math.round((todayStat.completed / todayStat.total) * 100)
        : 0,
    };
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchContext();
    fetchAnkiStats();
    fetchAchievements();
  }, [fetchDashboard, fetchContext, fetchAnkiStats, fetchAchievements]);

  const weakSubjects = getWeakSubjects();
  const pendingReviews = getPendingReviews();

  // Computed metrics from context performances
  const totalQuestions = context.performances.reduce(
    (sum, p) => sum + p.correct_answers + p.wrong_answers,
    0
  );
  const totalCorrect = context.performances.reduce((sum, p) => sum + p.correct_answers, 0);
  const totalWrong = context.performances.reduce((sum, p) => sum + p.wrong_answers, 0);
  const overallAccuracy = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  // Discipline rankings from performances
  const rankedByHours = [...context.performances].sort((a, b) => b.study_hours - a.study_hours);
  const topStudied = rankedByHours.slice(0, 5);
  const leastStudied = [...rankedByHours].reverse().slice(0, 3).filter(p => p.study_hours < 1);

  const statsLoading = isLoading || (!data && !error);

  return (
    <div className="dashboard">
      {/* ── Stats de Estudo ────────────────────────────── */}
      {statsLoading ? (
        <section className="dashboard__section">
          <p className="dashboard__loading-text">Carregando métricas...</p>
        </section>
      ) : error || !data ? (
        <section className="dashboard__section">
          <p className="dashboard__error-text">{error ?? 'Erro ao carregar dados.'}</p>
          <button className="dashboard__back-btn" onClick={() => navigate('/')}>← Ir para Pomodoro</button>
        </section>
      ) : (
        <>
          {/* Stats principais */}
          <section className="dashboard__stats-grid">
            <StatCard label="Horas hoje" value={data.stats.hours_studied_today.toFixed(1)} unit="h" />
            <StatCard label="Horas esta semana" value={data.stats.hours_studied_week.toFixed(1)} unit="h" />
            <StatCard label="Horas no total" value={data.stats.hours_studied_all.toFixed(1)} unit="h" />
            <StatCard label="Sequência atual" value={data.stats.current_streak} unit="dias" />
            <StatCard
              label="Matéria + estudada"
              value={data.stats.most_studied_subject ?? '—'}
              sub={data.stats.most_studied_subject_minutes != null
                ? `${data.stats.most_studied_subject_minutes} min`
                : undefined}
            />
          </section>

          {/* ── Conquistas ─────────────────────────────── */}
          {achSummary && achStats && (
            <section className="dashboard__section">
              <AchievementsCard
                summary={achSummary}
                recent={achRecent}
                stats={achStats}
              />
            </section>
          )}

          {/* Stats de Questões e Flashcards */}
          <section className="dashboard__metrics-extended">
            <h3 className="dashboard__section-title">📊 Questões & Flashcards</h3>
            <div className="dashboard__stats-grid dashboard__stats-grid--compact">
              <StatCard label="Questões respondidas" value={totalQuestions} />
              <StatCard label="Corretas" value={totalCorrect} />
              <StatCard label="Erradas" value={totalWrong} />
              <StatCard
                label="Taxa de acerto"
                value={totalQuestions > 0 ? `${overallAccuracy}%` : '—'}
              />
              <StatCard label="Flashcards criados" value={ankiStats?.total_cards ?? '—'} />
              <StatCard label="Revisões realizadas" value={ankiStats?.total_reviews ?? '—'} />
              <StatCard label="Retenção Flashcards" value={ankiStats ? `${Math.round(ankiStats.retention_rate)}%` : '—'} />
              <StatCard label="Dias de revisão" value={ankiStats?.streak_days ?? '—'} unit="dias" />
            </div>
          </section>

          {/* Tasks concluídas */}
          {taskStats.todayTotal > 0 && (
            <section className="dashboard__metrics-extended">
              <h3 className="dashboard__section-title">✅ Tarefas</h3>
              <div className="dashboard__stats-grid dashboard__stats-grid--compact">
                <StatCard
                  label="Concluídas hoje"
                  value={`${taskStats.todayCompleted}/${taskStats.todayTotal}`}
                  sub={`${taskStats.completionPct}% concluídas`}
                />
                <StatCard
                  label="Concluídas na semana"
                  value={taskStats.weekCompleted}
                  sub={taskStats.weekTotal > 0 ? `de ${taskStats.weekTotal} totais` : undefined}
                />
                <StatCard
                  label="Concluídas no mês"
                  value={taskStats.monthCompleted}
                  sub={taskStats.monthTotal > 0 ? `de ${taskStats.monthTotal} totais` : undefined}
                />
              </div>
              {taskStats.todayTotal > 0 && (
                <div className="dashboard__task-progress">
                  <div
                    className={`dashboard__task-progress-fill ${taskStats.completionPct === 100 ? 'dashboard__task-progress-fill--done' : ''}`}
                    style={{ width: `${taskStats.completionPct}%` }}
                  />
                </div>
              )}
            </section>
          )}

          {/* Barras de consistência */}
          <section className="dashboard__section">
            <ConsistencyBar label="Consistência (últimos 30 dias)" value={data.stats.consistency_pct} max={100} unit="%" />
            <ConsistencyBar label="Eficiência" value={data.stats.efficiency_pct} max={100} unit="%" color="rgba(16, 185, 129, 0.85)" />
            <ConsistencyBar
              label={`Tempo focado esta semana (meta: ${Math.round(data.stats.weekly_goal_minutes / 60)}h)`}
              value={data.stats.weekly_focus_minutes}
              max={data.stats.weekly_goal_minutes}
              unit=" min"
            />
            {ankiStats && totalQuestions > 0 && (
              <ConsistencyBar
                label="Taxa de acerto geral"
                value={overallAccuracy}
                max={100}
                unit="%"
                color="rgba(139, 92, 246, 0.85)"
              />
            )}
          </section>
        </>
      )}

      {/* ── Ranking de Disciplinas ─────────────────────── */}
      {context.performances.length > 0 && (
        <section className="dashboard__section">
          <h3 className="dashboard__section-title">🏆 Ranking de Disciplinas</h3>
          <div className="dashboard__ranking">
            <div className="ranking-col">
              <div className="ranking-col__title ranking-col__title--top">Mais estudadas</div>
              {topStudied.map((p, i) => (
                <div key={p.subject} className="ranking-item ranking-item--top">
                  <span className="ranking-item__pos">{i + 1}</span>
                  <span className="ranking-item__name">{p.subject}</span>
                  <div className="ranking-item__info">
                    <span className="ranking-item__hours">{p.study_hours.toFixed(1)}h</span>
                    <span className={`ranking-item__acc ${
                      p.accuracy >= 70 ? 'acc--good' : p.accuracy >= 50 ? 'acc--mid' : 'acc--bad'
                    }`}>
                      {Math.round(p.accuracy)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {leastStudied.length > 0 && (
              <div className="ranking-col">
                <div className="ranking-col__title ranking-col__title--low">Menos estudadas</div>
                {leastStudied.map((p, i) => (
                  <div key={p.subject} className="ranking-item ranking-item--low">
                    <span className="ranking-item__pos">{i + 1}</span>
                    <span className="ranking-item__name">{p.subject}</span>
                    <div className="ranking-item__info">
                      <span className="ranking-item__hours">{p.study_hours.toFixed(1)}h</span>
                      <span className="ranking-item__warn">⚠ Reforçar</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
          <h3 className="dashboard__section-title">📈 Desempenho por Disciplina</h3>
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
                  <span className="perf-row__hours">{p.study_hours.toFixed(1)}h</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ── Gráfico Semanal ────────────────────────────── */}
      {data && (
        <section className="dashboard__section">
          <WeeklyChart data={data.weekly_evolution} />
        </section>
      )}

    </div>
  );
};

export default Dashboard;
