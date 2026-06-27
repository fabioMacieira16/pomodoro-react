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

// ── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES_KEY = 'pomodoro-task-templates';

interface TaskTemplate {
  id: string;
  name: string;
  tasks: string[];
}

function loadTemplates(): TaskTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
  } catch { return []; }
}

function persistTemplates(templates: TaskTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

const TaskList: React.FC = () => {
  const [input, setInput] = useState('');
  const [tasks, setTasks] = useState<TaskType[]>(
    JSON.parse(window.localStorage.getItem('pomodoro-react-tasks') || '[]')
  );
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [dayCompleted, setDayCompleted] = useState(isDayComplete);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateItems, setTemplateItems] = useState<string[]>(['']);
  const [savedTemplates, setSavedTemplates] = useState<TaskTemplate[]>(loadTemplates);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
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

  // Recebe a conclusão de um ciclo de pomodoro vinda do timer e aplica no estado
  // (em vez do timer escrever direto no localStorage, o que era sobrescrito por edições)
  useEffect(() => {
    const handler = (e: Event) => {
      const taskId = (e as CustomEvent<{ taskId: number }>).detail.taskId;
      setTasks((prev) =>
        produce(prev, (draft) => {
          const t = draft.find((t) => t.id === taskId);
          if (t) t.actual_minutes = (t.actual_minutes || 0) + 25;
        })
      );
    };
    window.addEventListener('pomodoro:cycle-completed', handler);
    return () => window.removeEventListener('pomodoro:cycle-completed', handler);
  }, []);

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
        subjectId: updated.subject_id ?? null,
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
        subjectId: task.subject_id ?? null,
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

  // ── Template handlers ────────────────────────────────────────────────────
  function openCreateTemplate() {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateItems(tasks.length > 0 ? tasks.map(t => t.title) : ['']);
    setListMenuOpen(false);
    setShowCreateTemplate(true);
  }

  function openEditTemplate(tpl: TaskTemplate) {
    setEditingTemplateId(tpl.id);
    setTemplateName(tpl.name);
    setTemplateItems([...tpl.tasks]);
    setShowLoadTemplate(false);
    setShowCreateTemplate(true);
  }

  function closeTemplateModal() {
    setShowCreateTemplate(false);
    setEditingTemplateId(null);
  }

  function handleSaveTemplate() {
    const name = templateName.trim();
    const taskTitles = templateItems.filter(t => t.trim());
    if (!name || taskTitles.length === 0) return;
    let updated: TaskTemplate[];
    if (editingTemplateId) {
      updated = savedTemplates.map(t =>
        t.id === editingTemplateId ? { ...t, name, tasks: taskTitles } : t
      );
    } else {
      const newTpl: TaskTemplate = { id: Date.now().toString(), name, tasks: taskTitles };
      updated = [...savedTemplates, newTpl];
    }
    setSavedTemplates(updated);
    persistTemplates(updated);
    closeTemplateModal();
  }

  function handleDeleteTemplate(id: string) {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    persistTemplates(updated);
  }

  function handleApplyTemplate(tpl: TaskTemplate) {
    const newTasks: TaskType[] = tpl.tasks.map((title, i) => ({
      id: Date.now() + i,
      title,
      completed: false,
      priority: 'Medium',
      estimated_minutes: 25,
      actual_minutes: 0,
      position: i,
      user_id: 1,
    }));
    setTasks(newTasks);
    setDayCompleted(false);
    clearDayComplete();
    select(null);
    setShowLoadTemplate(false);
  }

  function addTemplateItem() {
    setTemplateItems(prev => [...prev, '']);
  }

  function removeTemplateItem(index: number) {
    setTemplateItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateTemplateItem(index: number, value: string) {
    setTemplateItems(prev => prev.map((t, i) => i === index ? value : t));
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
                  <div className="task-list__dropdown-sep" />
                  <button onClick={openCreateTemplate}>
                    📋 Criar template
                  </button>
                  {savedTemplates.length > 0 && (
                    <button onClick={() => { setShowLoadTemplate(true); setListMenuOpen(false); }}>
                      📂 Carregar template
                    </button>
                  )}
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

      {/* ── Modal: Criar / Editar template ───────────────────────────── */}
      {showCreateTemplate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold text-sm">
                {editingTemplateId ? 'Editar Template' : 'Criar Template'}
              </h2>
              <button onClick={closeTemplateModal} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <div>
                <label className="block text-gray-300 text-xs font-medium mb-1">Nome do template</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="Ex: Segunda-feira, Revisão semanal..."
                  autoFocus
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs font-medium mb-2">Tarefas do template</label>
                <div className="space-y-2">
                  {templateItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={e => updateTemplateItem(i, e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addTemplateItem()}
                        placeholder={`Tarefa ${i + 1}`}
                        className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {templateItems.length > 1 && (
                        <button
                          onClick={() => removeTemplateItem(i)}
                          className="text-gray-500 hover:text-red-400 w-5 h-5 flex items-center justify-center shrink-0"
                          title="Remover tarefa"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addTemplateItem}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  + Adicionar tarefa
                </button>
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-white/10">
              <button
                onClick={closeTemplateModal}
                className="flex-1 py-2 border border-white/20 rounded-lg text-xs text-gray-300 hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || templateItems.every(t => !t.trim())}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {editingTemplateId ? 'Salvar alterações' : 'Salvar template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Carregar template ──────────────────────────────────── */}
      {showLoadTemplate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold text-sm">Carregar Template</h2>
              <button onClick={() => setShowLoadTemplate(false)} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {savedTemplates.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Nenhum template salvo</p>
              ) : (
                savedTemplates.map(tpl => (
                  <div key={tpl.id} className="border border-white/10 rounded-xl p-4 bg-white/5">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-white font-semibold text-sm">{tpl.name}</span>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <button
                          onClick={() => openEditTemplate(tpl)}
                          className="text-gray-400 hover:text-blue-400 text-xs"
                          title="Editar template"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="text-gray-600 hover:text-red-400 text-xs"
                          title="Excluir template"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <ul className="space-y-0.5 mb-3">
                      {tpl.tasks.slice(0, 5).map((t, i) => (
                        <li key={i} className="text-gray-400 text-xs">• {t}</li>
                      ))}
                      {tpl.tasks.length > 5 && (
                        <li className="text-gray-600 text-xs">+{tpl.tasks.length - 5} mais...</li>
                      )}
                    </ul>
                    <button
                      onClick={() => handleApplyTemplate(tpl)}
                      className="w-full py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Carregar
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/10">
              <button
                onClick={() => setShowLoadTemplate(false)}
                className="w-full py-2 border border-white/20 rounded-lg text-xs text-gray-300 hover:bg-white/10 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </TaskContext.Provider>
  );
};

export default memo(TaskList);
