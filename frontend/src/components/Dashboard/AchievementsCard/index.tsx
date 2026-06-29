import React from 'react';
import type { AchievementSummary, AchievementUnlock, AchievementStats } from '../../../types';
import './AchievementsCard.css';

interface Props {
  summary: AchievementSummary;
  recent: AchievementUnlock[];
  stats: AchievementStats;
}

const AchievementsCard: React.FC<Props> = ({ summary, recent, stats }) => {
  const rewards = [
    { icon: '⭐', label: 'Estrelas', value: summary.total_stars },
    { icon: '🥇', label: 'Medalhas', value: summary.total_medals },
    { icon: '🏆', label: 'Troféus',  value: summary.total_trophies },
    { icon: '💎', label: 'Diamantes',value: summary.total_diamonds },
    { icon: '👑', label: 'Lendas',   value: summary.total_legends },
  ];

  const statItems = [
    { label: 'Pomodoros', value: stats.pomodoros_completed },
    { label: 'Questões respondidas', value: stats.quizzes_answered },
    { label: 'Acertos', value: stats.quizzes_correct },
    { label: 'Taxa de acerto', value: `${stats.accuracy_pct}%` },
    { label: 'Flashcards criados', value: stats.flashcards_created },
    { label: 'Revisões realizadas', value: stats.flashcards_reviewed },
    { label: 'Horas estudadas', value: `${stats.total_study_hours}h` },
    { label: 'Sequência atual', value: `${stats.current_streak_days} dias` },
    { label: 'Maior sequência', value: `${stats.longest_streak_days} dias` },
  ];

  return (
    <div className="ach-card">
      {/* ── Recompensas ───────────────────────────────── */}
      <h3 className="ach-card__title">🏅 Conquistas</h3>

      <div className="ach-card__rewards">
        {rewards.map((r) => (
          <div key={r.label} className="ach-reward">
            <span className="ach-reward__icon">{r.icon}</span>
            <span className="ach-reward__value">{r.value}</span>
            <span className="ach-reward__label">{r.label}</span>
          </div>
        ))}
      </div>

      {/* ── Barra de progresso ────────────────────────── */}
      <div className="ach-card__progress-section">
        <div className="ach-card__progress-header">
          <span className="ach-card__progress-label">
            ⭐ {summary.stars_in_tier} / 10
          </span>
          <span className="ach-card__progress-next">
            Próxima: {summary.next_reward}
          </span>
        </div>
        <div className="ach-card__track">
          <div
            className="ach-card__fill"
            style={{ width: `${summary.progress_pct}%` }}
          />
        </div>
        <span className="ach-card__pct">{summary.progress_pct}%</span>
      </div>

      {/* ── Últimas conquistas ────────────────────────── */}
      {recent.length > 0 && (
        <div className="ach-card__recent">
          <p className="ach-card__recent-title">Últimas conquistas</p>
          <ul className="ach-card__recent-list">
            {recent.map((u) => (
              <li key={u.code} className="ach-card__recent-item">
                <span className="ach-card__recent-icon">{u.icon ?? '⭐'}</span>
                <span className="ach-card__recent-name">{u.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Stats de desempenho ───────────────────────── */}
      <div className="ach-card__stats">
        <p className="ach-card__stats-title">📊 Desempenho acumulado</p>
        <div className="ach-card__stats-grid">
          {statItems.map((s) => (
            <div key={s.label} className="ach-stat">
              <span className="ach-stat__value">{s.value}</span>
              <span className="ach-stat__label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AchievementsCard;
