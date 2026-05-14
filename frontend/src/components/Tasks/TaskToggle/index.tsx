import React, { memo } from 'react';
import './styles.css';

interface TaskToggleProps {
  task: boolean | null;
  toggleTask: () => void;
}

const TaskToggle: React.FC<TaskToggleProps> = ({ task, toggleTask }) => (
  <button
    className={`ToggleTask ${task && 'active'}`}
    onClick={toggleTask}
    title={task ? 'Disable Task' : 'Enable Task'}
  >
    <i className={'fa fa-tasks'} />
  </button>
);

export default memo(TaskToggle);
