import React, { memo, useState, useEffect } from 'react';
import { produce } from 'immer';
import TaskContext from './context';
import Task from '../Task';
import TypeSelect from '../../TypeSelect';
import { Task as TaskType } from '../../../types';

import './styles.css';

interface StatusType {
  name: string;
  value: boolean | number;
}

const TaskList: React.FC = () => {
  const [input, setInput] = useState('');
  const taskStatus: StatusType[] = [
    { name: 'All', value: -1 },
    { name: 'Open', value: false },
    { name: 'Closed', value: true }
  ];

  const [tasks, setTasks] = useState<TaskType[]>(
    JSON.parse(window.localStorage.getItem('pomodoro-react-tasks') || '[]')
  );
  const [selectedStatus, setSelectedStatus] = useState<StatusType>(taskStatus[0]);

  useEffect(() => {
    window.localStorage.setItem('pomodoro-react-tasks', JSON.stringify(tasks));
  }, [tasks]);

  function move(from: number, to: number) {
    setTasks(
      produce(tasks, (draft) => {
        const [taskMoved] = draft.splice(from, 1);
        draft.splice(to, 0, taskMoved);
      })
    );
  }

  function handleStatus(task: TaskType) {
    setTasks(
      produce(tasks, (draft) => {
        const foundIndex = draft.findIndex((item) => item.id === task.id);
        if (foundIndex !== -1) {
          draft[foundIndex].completed = !draft[foundIndex].completed;
        }
      })
    );
  }

  function addTask() {
    if (!input.trim()) return;
    const newTask: TaskType = {
      id: Date.now(), // Temporary ID until backend integration
      title: input,
      completed: false,
      priority: 'Medium',
      estimated_minutes: 25,
      actual_minutes: 0,
      position: tasks.length,
      user_id: 1, // Placeholder
    };
    setTasks([...tasks, newTask]);
    setInput('');
  }

  const filteredTasks = tasks.filter(
    (task) =>
      selectedStatus.value === -1 || task.completed === selectedStatus.value
  );

  return (
    <TaskContext.Provider value={{ move, handleStatus }}>
      <TypeSelect
        types={taskStatus as any} // StatusType matches the shape of TimerType enough for now
        selected={selectedStatus as any}
        changeType={setSelectedStatus as any}
      />
      <div className="Tasks">
        <div className="Tasks-box">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task, index) => (
              <Task key={task.id} index={index} task={task} />
            ))
          ) : (
            <div className="Task">No Tasks</div>
          )}
        </div>
      </div>
      <div className="Task">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="New Task"
          onKeyPress={(e) => e.key === 'Enter' && addTask()}
        />
        <span onClick={addTask}>{'Add'}</span>
      </div>
    </TaskContext.Provider>
  );
};

export default memo(TaskList);
