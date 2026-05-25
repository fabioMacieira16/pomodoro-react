import React, { memo, useState, useEffect, useRef } from 'react';
import { produce } from 'immer';
import TaskContext from './context';
import Task from '../Task';
import { Task as TaskType } from '../../../types';
import './styles.css';

const TaskList: React.FC = () => {
  const [input, setInput] = useState('');
  const [tasks, setTasks] = useState<TaskType[]>(
    JSON.parse(window.localStorage.getItem('pomodoro-react-tasks') || '[]')
  );
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const listMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.setItem('pomodoro-react-tasks', JSON.stringify(tasks));
  }, [tasks]);

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
  }

  function deleteTask(id: number) {
    setTasks(tasks.filter((t) => t.id !== id));
  }

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
    <TaskContext.Provider value={{ move, handleStatus, updateTask, deleteTask }}>
      <div className="task-list">
        <div className="task-list__header">
          <span className="task-list__title">Tasks</span>
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
                <button onClick={() => { setTasks([]); setListMenuOpen(false); }}>
                  Limpar todas
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="task-list__items">
          {tasks.length === 0 ? (
            <div className="task-list__empty">Nenhuma tarefa</div>
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
      </div>
    </TaskContext.Provider>
  );
};

export default memo(TaskList);
