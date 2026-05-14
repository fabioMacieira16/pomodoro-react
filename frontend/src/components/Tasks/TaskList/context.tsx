import { createContext } from 'react';
import { Task } from '../../../types';

interface TaskContextType {
  move: (fromIndex: number, toIndex: number) => void;
  handleStatus: (task: Task) => void;
}

const TaskContext = createContext<TaskContextType>({
  move: () => {},
  handleStatus: () => {},
});

export default TaskContext;
