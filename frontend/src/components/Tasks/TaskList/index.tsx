import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { produce } from 'immer';
import TaskContext from './context';
import Task from '../Task';
import { Task as TaskType } from '../../../types';
import { useSelectedTask } from '../../../store/selectedTaskStore';
import './styles.css';

const TASK_STATS_KEY = 'pomodoro-task-stats';
const DAY_COMPLETED_KEY = 'pomodoro-day-completed';
const TODAY_KEY = () => new Date().toISOString().split('T')[0];

interface DailyStats {
  date: string;
  total: number;
  completed: number;
}

function loadDailyStats(): DailyStats[] {
  try {
    return JSON.parse(localStorage.getItem(TASK_STATS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveDailyStats(total: number, completed: number) {
  const stats = loadDailyStats();
  const today = TODAY_KEY();
  const existing = stats.findIndex(s => s.date === today);
  const entry: DailyStats = { date: today, total, completed };
  if (existing >= 0) {
    stats[existing] = entry;
  } else {
    stats.push(entry);
  }
  const trimmed = stats.slice(-90);
  localStorage.setItem(TASK_STATS_KEY, JSON.stringify(trimmed));
}

function isDayComplete() {
  return localStorage.getItem(DAY_COMPLETED_KEY) === TODAY_KEY();
}

function markDayAsComplete() {
  localStorage.setItem(DAY_COMPLETED_KEY, TODAY_KEY());
}

function clearDayComplete() {
  localStorage.removeItem(DAY_COMPLETED_KEY);
}

const TaskList: React.FC = () => {
  const [input, setInput] = useState('');
  const [tasks, setTasks] = useState<TaskType[]>(
    JSON.parse(window.localStorage.getItem('pomodoro-react-tasks') || '[]')
  );
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [dayCompleted, setDayCompleted] = useState(isDayComplete);
  const [showCelebration, setShowCelebration] = useState(false);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const { selectedTask, select } = useSelectedTask();
  const selectedTaskId = selectedTask?.id ?? null;

  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const allDone = total > 0 && completed === total;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  useEffect(() => {
    window.localStorage.setItem('pomodoro-react-tasks', JSON.stringify(tasks));
    if (total > 0) {
      saveDailyStats(total, completed);
    }
  }, [tasks, total, completed]);

  useEffect(() => {
    if (!listMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setListMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [listMenuOpen]);

  // Quando todas as tasks são concluídas: celebra, marca o dia e limpa a lista
  useEffect(() => {
    if (!allDone) {
      if (showCelebration) setShowCelebration(false);
      return;
    }
    if (showCelebration) return;

    markDayAsComplete();
    setDayCompleted(true);
    setShowCelebration(true);

    const timer = setTimeout(() => {
      setShowCelebration(false);
      setTasks([]);
      select(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [allDone, showCelebration]);

  function move(from: number, to: number) {
    setTasks(produce(tasks, (draft) => {
      const [moved] = draft.splice(from, 1);
      draft.splice(to, 0, moved);
    }));
  }

  function handleStatus(task: TaskType) {
    setTasks(produce(tasks, (draft) => {
      const idx = draft.findIndex((t) => t.id === task.id);
      if (idx !== -1) draft[idx].completed = !draft[idx].completed;
    }));
  }

  function updateTask(updated: TaskType) {
    setTasks(produce(tasks, (draft) => {
      const idx = draft.findIndex((t) => t.id === updated.id);
      if (idx !== -1) draft[idx] = updated;
    }));
    if (selectedTaskId === updated.id) {
      select({
        id: updated.id,
        title: updated.title,
        estPomo: Math.max(1, Math.round((updated.estimated_minutes || 25) / 25)),
        actualPomo: Math.round((updated.actual_minutes || 0) / 25),
      });
    }
  }

  function deleteTask(id: number) {
    setTasks(tasks.filter((t) => t.id !== id));
    if (selectedTaskId === id) select(null);
  }

  function selectTask(task: TaskType) {
    if (selectedTaskId === task.id) {
      select(null);
    } else {
      select({
        id: task.id,
        title: task.title,
        estPomo: Math.max(1, Math.round((task.estimated_minutes || 25) / 25)),
        actualPomo: Math.round((task.actual_minutes || 0) / 25),
      });
    }
  }

  const markAllDone = useCallback(() => {
    setTasks(produce(tasks, (draft) => {
      draft.forEach(t => { t.completed = true; });
    }));
  }, [tasks]);

  function addTask() {
    if (!input.trim()) return;
    const newTask: TaskType = {
      id: Date.now(),
      title: input.trim(),
      completed: false,
      priority: 'Medium',
      estimated_minutes: 25,
      actual_minutes: 0,
      position: tasks.length,
      user_id: 1,
    };
    setTasks([...tasks, newTask]);
    setInput('');
  }

  return (
    <TaskContext.Provider value={{ move, handleStatus, updateTask, deleteTask, selectedTaskId, selectTask }}>
      <div className="task-list">
        <div className="task-list__header">
          <span className="task-list__title">
            Tasks
            {total > 0 && (
              <span className="task-list__count">
                {completed}/{total}
              </span>
            )}
          </span>
          <div className="task-list__header-actions">
            {total > 0 && !allDone && !showCelebration && (
              <button
                className="task-list__mark-done-btn"
                onClick={markAllDone}
                title="Marcar todas como concluídas"
              >
                ✓ Concluir dia
              </button>
            )}
            {dayCompleted && total === 0 && !showCelebration && (
              <span className="task-list__day-done">✓ Dia concluído</span>
            )}
            <div className="task-list__menu-wrap" ref={listMenuRef}>
              <button
                className="task-list__menu-btn"
                onClick={() => setListMenuOpen(!listMenuOpen)}
                title="Opcoes"
              >
                &#8942;
              </button>
              {listMenuOpen && (
                <div className="task-list__dropdown">
                  <button onClick={() => { setTasks(tasks.filter(t => !t.completed)); setListMenuOpen(false); }}>
                    Limpar concluidas
                  </button>
                  <button onClick={() => {
                    setTasks([]);
                    setListMenuOpen(false);
                    setDayCompleted(false);
                    setShowCelebration(false);
                    clearDayComplete();
                    select(null);
                  }}>
                    Limpar todas
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && !showCelebration && (
          <div className="task-list__progress">
            <div
              className={`task-list__progress-fill ${allDone ? 'task-list__progress-fill--done' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {showCelebration ? (
          <div className="task-list__celebration">
            <div className="task-list__celebration-content">
              <span className="task-list__celebration-emoji">🎉</span>
              <p className="task-list__celebration-text">Dia concluído!</p>
              <p className="task-list__celebration-sub">Todas as tarefas foram concluídas</p>
            </div>
          </div>
        ) : (
          <>
            <div className="task-list__items">
              {tasks.length === 0 ? (
                <div className="task-list__empty">
                  {dayCompleted ? 'Dia concluído — adicione novas tarefas' : 'Nenhuma tarefa'}
                </div>
              ) : (
                tasks.map((task, index) => (
                  <Task key={task.id} index={index} task={task} />
                ))
              )}
            </div>

            <div className="task-list__add">
              <input
                className="task-list__add-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="+ Adicionar tarefa"
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
              />
              {input.trim() && (
                <button className="task-list__add-btn" onClick={addTask}>Add</button>
              )}
            </div>
          </>
        )}
      </div>
    </TaskContext.Provider>
  );
};

export default memo(TaskList);
