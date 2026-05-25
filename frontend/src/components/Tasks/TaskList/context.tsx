import { createContext } from 'react';
import { Task } from '../../../types';

interface TaskContextType {
  move: (fromIndex: number, toIndex: number) => void;
  handleStatus: (task: Task) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: number) => void;
}

const TaskContext = createContext<TaskContextType>({
  move: () => {},
  handleStatus: () => {},
  updateTask: () => {},
  deleteTask: () => {},
});

export default TaskContext;
