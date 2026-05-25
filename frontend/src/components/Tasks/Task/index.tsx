import { useState, useRef, useContext, useEffect } from 'react';
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import './styles.css';
import TaskContext from '../TaskList/context';
import { Task as TaskType } from '../../../types';

interface TaskProps {
  task: TaskType;
  index: number;
}

interface DragItem {
  id: number;
  index: number;
}

export default function Task({ task, index }: TaskProps) {
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { move, handleStatus, updateTask, deleteTask } = useContext(TaskContext);

  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNote, setEditNote] = useState(task.description ?? '');
  const [showNote, setShowNote] = useState(!!(task.description));
  const [estPomo, setEstPomo] = useState(Math.max(1, Math.round((task.estimated_minutes || 25) / 25)));
  const actPomo = Math.round((task.actual_minutes || 0) / 25);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const [{ isDragging }, dragRef] = useDrag({
    type: 'TASK',
    item: { id: task.id, index },
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  const [, dropRef] = useDrop({
    accept: 'TASK',
    hover(item: unknown, monitor: DropTargetMonitor) {
      const drag = item as DragItem;
      if (!ref.current || drag.id === task.id) return;
      const rect = ref.current.getBoundingClientRect();
      const mid = (rect.bottom - rect.top) / 2;
      const offset = monitor.getClientOffset();
      if (!offset) return;
      const top = offset.y - rect.top;
      if (drag.index < index && top < mid) return;
      if (drag.index > index && top > mid) return;
      move(drag.index, index);
      drag.index = index;
    },
  });

  dragRef(dropRef(ref));

  const openEdit = () => {
    setEditTitle(task.title);
    setEditNote(task.description ?? '');
    setEstPomo(Math.max(1, Math.round((task.estimated_minutes || 25) / 25)));
    setShowNote(!!(task.description));
    setEditing(true);
    setMenuOpen(false);
  };

  const handleSave = () => {
    updateTask({
      ...task,
      title: editTitle.trim() || task.title,
      description: editNote,
      estimated_minutes: estPomo * 25,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  return (
    <div
      ref={ref}
      className={`pomo-task${isDragging ? ' pomo-task--dragging' : ''}${task.completed ? ' pomo-task--done' : ''}`}
    >
      {!editing ? (
        <div className="pomo-task__row" onClick={openEdit}>
          <button
            className={`pomo-task__check${task.completed ? ' pomo-task__check--done' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleStatus(task); }}
            title={task.completed ? 'Reabrir' : 'Concluir'}
          >
            {task.completed && (
              <svg viewBox="0 0 12 12" width="11" height="11">
                <polyline
                  points="1.5,6 4.5,9.5 10.5,2"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <span className="pomo-task__title">{task.title}</span>
          <span className="pomo-task__count">{actPomo}/{estPomo}</span>
          <div className="pomo-task__menu-wrap" ref={menuRef}>
            <button
              className="pomo-task__menu-btn"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              title="Opcoes"
            >
              &#8942;
            </button>
            {menuOpen && (
              <div className="pomo-task__dropdown">
                <button onClick={openEdit}>Editar</button>
                <button onClick={() => { deleteTask(task.id); setMenuOpen(false); }}>Excluir</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="pomo-task__edit">
          <input
            className="pomo-task__edit-title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="O que voce esta trabalhando?"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="pomo-task__pomo-row">
            <span className="pomo-task__pomo-label">Act / Est Pomodoros</span>
            <div className="pomo-task__pomo-inputs">
              <input className="pomo-task__pomo-num" type="number" value={actPomo} readOnly />
              <span className="pomo-task__pomo-sep">/</span>
              <input
                className="pomo-task__pomo-num"
                type="number"
                value={estPomo}
                min={1}
                onChange={(e) => setEstPomo(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button className="pomo-task__pomo-adj" onClick={() => setEstPomo(p => Math.max(1, p - 1))}>&#9660;</button>
              <button className="pomo-task__pomo-adj" onClick={() => setEstPomo(p => p + 1)}>&#9650;</button>
            </div>
          </div>

          {showNote && (
            <textarea
              className="pomo-task__note"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Adicionar nota..."
              rows={3}
            />
          )}

          <div className="pomo-task__links-row">
            <button className="pomo-task__link" onClick={() => setShowNote(!showNote)}>
              {showNote ? '- Remover Nota' : '+ Add Note'}
            </button>
          </div>

          <div className="pomo-task__edit-footer">
            <button className="pomo-task__delete-btn" onClick={() => { deleteTask(task.id); setEditing(false); }} title="Excluir tarefa">
              &#128465;
            </button>
            <div className="pomo-task__footer-right">
              <button className="pomo-task__cancel-btn" onClick={handleCancel}>Cancelar</button>
              <button className="pomo-task__save-btn" onClick={handleSave}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
