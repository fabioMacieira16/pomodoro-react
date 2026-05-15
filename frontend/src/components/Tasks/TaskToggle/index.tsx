import React, { memo } from 'react';
import { ListTodo } from 'lucide-react';
import './styles.css';

interface TaskToggleProps {
  task: boolean | null;
  toggleTask: () => void;
}

const TaskToggle: React.FC<TaskToggleProps> = ({ task, toggleTask }) => (
  <button
    className={`ToggleTask ${task && 'active'}`}
    onClick={toggleTask}
    title={task ? 'Ocultar tasks' : 'Mostrar tasks'}
    aria-label={task ? 'Ocultar tasks' : 'Mostrar tasks'}
  >
    <ListTodo size={20} strokeWidth={2.25} />
  </button>
);

export default memo(TaskToggle);
