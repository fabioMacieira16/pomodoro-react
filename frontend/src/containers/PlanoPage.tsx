import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanTaskStore, DAY_NAMES, getDateForDayOfWeek, getTodayDayOfWeek, type PlanTask } from '../store/planTaskStore';
import { useSelectedTask } from '../store/selectedTaskStore';
import { useStudyContext } from '../store/studyContextStore';
import './PlanoPage.css';

type View = 'kanban' | 'calendar';

const TYPE_ICON: Record<string, string> = {
  study: '📚',
  review: '🔄',
  quiz: '❓',
};

const PRIORITY_COLOR: Record<number, string> = {
  5: '#ef4444',
  4: '#f97316',
  3: '#eab308',
  2: '#84cc16',
  1: '#10b981',
};

// ── Kanban ────────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  task: PlanTask;
  onToggle: (id: number) => void;
  onSelect: (task: PlanTask) => void;
  isSelectedForPomodoro: boolean;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ task, onToggle, onSelect, isSelectedForPomodoro }) => {
  const dotsFilled = task.pomodoros_done;
  const dotsTotal = task.pomodoros_est;

  return (
    <div
      className={[
        'plan-card',
        task.completed ? 'plan-card--done' : '',
        isSelectedForPomodoro ? 'plan-card--active' : '',
        `plan-card--${task.type}`,
      ].filter(Boolean).join(' ')}
    >
      <div className="plan-card__top">
        <button
          className="plan-card__check"
          onClick={() => onToggle(task.id)}
          title={task.completed ? 'Desmarcar' : 'Marcar como concluído'}
        >
          {task.completed ? '✓' : '○'}
        </button>

        <div className="plan-card__body" onClick={() => onSelect(task)}>
          <span className="plan-card__type-icon">{TYPE_ICON[task.type]}</span>
          <span className="plan-card__title">{task.title}</span>
        </div>

        <div
          className="plan-card__priority-dot"
          style={{ background: PRIORITY_COLOR[task.priority] ?? '#888' }}
          title={`Prioridade ${task.priority}`}
        />
      </div>

      <div className="plan-card__meta">
        <span className="plan-card__time">{task.estimated_minutes}min</span>
        <div className="plan-card__pomos">
          {Array.from({ length: dotsTotal }, (_, i) => (
            <span key={i} className={`pomo-dot ${i < dotsFilled ? 'pomo-dot--done' : ''}`}>🍅</span>
          ))}
        </div>
      </div>

      {isSelectedForPomodoro && (
        <div className="plan-card__active-badge">▶ No timer</div>
      )}
    </div>
  );
};

// ── Kanban View ───────────────────────────────────────────────────────────────

interface KanbanViewProps {
  tasks: PlanTask[];
  weekStart: string | null;
  selectedId: number | null;
  concurso?: string | null;
  onToggle: (id: number) => void;
  onSelect: (task: PlanTask) => void;
}

const KanbanView: React.FC<KanbanViewProps> = ({ tasks, weekStart, selectedId, concurso, onToggle, onSelect }) => {
  const today = new Date().toISOString().split('T')[0];
  const todayDow = getTodayDayOfWeek();

  return (
    <div className="kanban-board">
      {DAY_NAMES.map((name, idx) => {
        const dayDate = getDateForDayOfWeek(idx, weekStart);
        const isToday = idx === todayDow;
        const isPast = dayDate < today && !isToday;
        const dayTasks = tasks.filter(t => t.day_of_week === idx).sort((a, b) => a.position - b.position);
        const done = dayTasks.filter(t => t.completed).length;
        const total = dayTasks.length;

        return (
          <div key={name} className={['kanban-col', isToday ? 'kanban-col--today' : '', isPast ? 'kanban-col--past' : ''].filter(Boolean).join(' ')}>
            <div className="kanban-col__header">
              <div className="kanban-col__title-row">
                <span className="kanban-col__name">
                  {concurso ? `${concurso} — ${name}` : name}
                </span>
                {isToday && <span className="kanban-col__today-badge">HOJE</span>}
              </div>
              <div className="kanban-col__date-row">
                <span className="kanban-col__date">
                  {new Date(dayDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
                {total > 0 && (
                  <span className="kanban-col__count">{done}/{total}</span>
                )}
              </div>
              {total > 0 && (
                <div className="kanban-col__progress">
                  <div
                    className="kanban-col__progress-fill"
                    style={{ width: `${(done / total) * 100}%` }}
                  />
                </div>
              )}
            </div>

            <div className="kanban-col__tasks">
              {dayTasks.length === 0 ? (
                <p className="kanban-col__empty">Dia livre</p>
              ) : (
                dayTasks.map(task => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onToggle={onToggle}
                    onSelect={onSelect}
                    isSelectedForPomodoro={task.id === selectedId}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Calendar View ─────────────────────────────────────────────────────────────

const START_HOUR = 7;
const END_HOUR = 21;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);

function minutesToTop(minutes: number): number {
  return (minutes / TOTAL_MINUTES) * 100;
}

function minutesToHeight(minutes: number): number {
  return Math.max((minutes / TOTAL_MINUTES) * 100, 3);
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

interface CalendarViewProps {
  tasks: PlanTask[];
  weekStart: string | null;
  selectedId: number | null;
  onSelect: (task: PlanTask) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, weekStart, selectedId, onSelect }) => {
  const todayDow = getTodayDayOfWeek();

  const activeDays = DAY_NAMES.map((name, idx) => {
    const dayDate = getDateForDayOfWeek(idx, weekStart);
    const dayTasks = tasks.filter(t => t.day_of_week === idx).sort((a, b) => a.position - b.position);
    return { name, idx, dayDate, dayTasks };
  }).filter(d => d.dayTasks.length > 0);

  if (activeDays.length === 0) {
    return <p className="plano-empty-msg">Nenhuma tarefa no plano desta semana.</p>;
  }

  return (
    <div className="calendar-view">
      <div className="calendar-grid" style={{ gridTemplateColumns: `56px repeat(${activeDays.length}, 1fr)` }}>
        {/* Time column header */}
        <div className="cal-corner" />
        {activeDays.map(({ name, idx, dayDate }) => (
          <div key={idx} className={['cal-day-header', idx === todayDow ? 'cal-day-header--today' : ''].filter(Boolean).join(' ')}>
            <span className="cal-day-header__name">{name}</span>
            <span className="cal-day-header__date">
              {new Date(dayDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
            {idx === todayDow && <span className="cal-day-header__badge">HOJE</span>}
          </div>
        ))}

        {/* Time column */}
        <div className="cal-times">
          {HOURS.map(h => (
            <div key={h} className="cal-time-slot">
              {formatTime(h, 0)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {activeDays.map(({ idx, dayTasks }) => {
          let cumMinutes = 60; // start at 08:00 = 1h after START_HOUR
          return (
            <div key={idx} className="cal-day-col">
              <div className="cal-day-body">
                {dayTasks.map(task => {
                  const top = minutesToTop(cumMinutes);
                  const height = minutesToHeight(task.estimated_minutes);
                  const startH = START_HOUR + Math.floor(cumMinutes / 60);
                  const startM = cumMinutes % 60;
                  cumMinutes += task.estimated_minutes + 5; // +5min break

                  return (
                    <div
                      key={task.id}
                      className={[
                        'cal-event',
                        task.completed ? 'cal-event--done' : '',
                        task.id === selectedId ? 'cal-event--active' : '',
                        `cal-event--${task.type}`,
                      ].filter(Boolean).join(' ')}
                      style={{ top: `${top}%`, height: `${height}%` }}
                      onClick={() => onSelect(task)}
                      title={`${task.title} — ${formatTime(startH, startM)}`}
                    >
                      <span className="cal-event__time">{formatTime(startH, startM)}</span>
                      <span className="cal-event__title">{task.title}</span>
                      <span className="cal-event__icon">{TYPE_ICON[task.type]}</span>
                    </div>
                  );
                })}
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div key={h} className="cal-hour-line" style={{ top: `${minutesToTop((h - START_HOUR) * 60)}%` }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const PlanoPage: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('kanban');
  const { tasks, weekStart, generatedAt, concurso, toggleComplete, generateFromSchedule } = usePlanTaskStore();
  const { selectedTask, select } = useSelectedTask();
  const { context, fetchContext } = useStudyContext();

  // Carrega o contexto e gera as tarefas automaticamente se necessário
  useEffect(() => {
    const loadContextAndGenerateTasks = async () => {
      // Se não temos tarefas, tenta carregar do backend
      if (tasks.length === 0) {
        await fetchContext();
      }
    };
    loadContextAndGenerateTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gera as tarefas quando o contexto é carregado
  useEffect(() => {
    if (tasks.length === 0 && context.weekly_schedule.length > 0) {
      generateFromSchedule(
        context.weekly_schedule, 
        context.performances, 
        context.concurso
      );
    }
  }, [context.weekly_schedule, context.performances, context.concurso, tasks.length, generateFromSchedule]);

  const todayTasks = tasks.filter(t => t.day_of_week === getTodayDayOfWeek());
  const todayDone = todayTasks.filter(t => t.completed).length;
  const weekDone = tasks.filter(t => t.completed).length;
  const weekTotal = tasks.length;

  const handleSelectTask = (task: PlanTask) => {
    if (selectedTask?.id === task.id) {
      select(null);
    } else {
      select({
        id: task.id,
        title: task.title,
        estPomo: task.pomodoros_est,
        actualPomo: task.pomodoros_done,
        subjectId: null,
      });
      navigate('/');
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="plano-page plano-page--empty">
        <div className="plano-empty-state">
          <div className="plano-empty-icon">📋</div>
          <h2>Nenhum plano gerado ainda</h2>
          <p>Importe um edital e gere seu plano de estudos para ver as tasks aqui.</p>
          <button className="plano-empty-cta" onClick={() => navigate('/estudos')}>
            📚 Ir para Estudos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="plano-page">
      {/* ── Header ── */}
      <div className="plano-header">
        <div className="plano-header__left">
          <h1 className="plano-header__title">📋 Plano de Estudos</h1>
          {concurso && <span className="plano-header__concurso">{concurso}</span>}
          {generatedAt && (
            <span className="plano-header__generated">
              Gerado em {new Date(generatedAt).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>

        <div className="plano-header__right">
          {/* Stats compactos */}
          <div className="plano-mini-stats">
            <div className="plano-mini-stat">
              <span className="plano-mini-stat__value">{todayDone}/{todayTasks.length}</span>
              <span className="plano-mini-stat__label">Hoje</span>
            </div>
            <div className="plano-mini-stat">
              <span className="plano-mini-stat__value">{weekDone}/{weekTotal}</span>
              <span className="plano-mini-stat__label">Semana</span>
            </div>
          </div>

          {/* View toggle */}
          <div className="view-toggle">
            <button
              className={`view-toggle__btn ${view === 'kanban' ? 'view-toggle__btn--active' : ''}`}
              onClick={() => setView('kanban')}
            >
              ▦ Kanban
            </button>
            <button
              className={`view-toggle__btn ${view === 'calendar' ? 'view-toggle__btn--active' : ''}`}
              onClick={() => setView('calendar')}
            >
              📅 Calendário
            </button>
          </div>
        </div>
      </div>

      {/* ── Week progress bar ── */}
      {weekTotal > 0 && (
        <div className="plano-week-progress">
          <div className="plano-week-progress__bar">
            <div
              className="plano-week-progress__fill"
              style={{ width: `${(weekDone / weekTotal) * 100}%` }}
            />
          </div>
          <span className="plano-week-progress__label">
            {weekDone} de {weekTotal} concluídas ({Math.round((weekDone / weekTotal) * 100)}%)
          </span>
        </div>
      )}

      {/* ── Selected task banner ── */}
      {selectedTask && (
        <div className="plano-selected-banner">
          <span>▶ No Pomodoro: <strong>{selectedTask.title}</strong></span>
          <button onClick={() => select(null)}>✕ Remover</button>
        </div>
      )}

      {/* ── Views ── */}
      {view === 'kanban' ? (
        <KanbanView
          tasks={tasks}
          weekStart={weekStart}
          selectedId={selectedTask?.id ?? null}
          concurso={concurso}
          onToggle={toggleComplete}
          onSelect={handleSelectTask}
        />
      ) : (
        <CalendarView
          tasks={tasks}
          weekStart={weekStart}
          selectedId={selectedTask?.id ?? null}
          onSelect={handleSelectTask}
        />
      )}

      {/* ── Regenerate ── */}
      <div className="plano-footer">
        <button className="plano-footer__btn" onClick={() => navigate('/estudos')}>
          ↺ Regerar plano
        </button>
        <span className="plano-footer__hint">
          Clique em uma tarefa para selecioná-la no Pomodoro
        </span>
      </div>
    </div>
  );
};

export default PlanoPage;
