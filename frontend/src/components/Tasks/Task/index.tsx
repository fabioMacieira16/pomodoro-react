import { useRef, useContext } from 'react';
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import './styles.css';

import TaskContext from '../TaskList/context';
import { Task as TaskType } from '../../../types';

interface TaskProps {
  task: TaskType;
  index: number;
}

interface DragItem {
  type: string;
  id: number;
  index: number;
  order?: number;
}

export default function Task({ task, index }: TaskProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { move, handleStatus } = useContext(TaskContext);
  
  const [{ isDragging }, dragRef] = useDrag({
    type: 'TASK',
    item: { id: task.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, dropRef] = useDrop({
    accept: 'TASK',
    hover(item: unknown, monitor: DropTargetMonitor) {
      const dragItem = item as DragItem;
      if (!ref.current) return;
      if (dragItem.id === task.id) return;

      const targetSize = ref.current.getBoundingClientRect();
      const targetCenter = (targetSize.bottom - targetSize.top) / 2;
      const draggedOffset = monitor.getClientOffset();
      if (!draggedOffset) return;
      const draggedTop = draggedOffset.y - targetSize.top;

      // item.index and index are used for moving
      if (dragItem.index < index && draggedTop < targetCenter) return;
      if (dragItem.index > index && draggedTop > targetCenter) return;

      move(dragItem.index, index);
      dragItem.index = index;
    },
  });

  dragRef(dropRef(ref));

  return (
    <div ref={ref} className={isDragging ? 'Task Dragging' : 'Task'}>
      <div>{task.title}</div>
      <span onClick={() => handleStatus(task)}>
        {task.completed ? 'Open' : 'Close'}
      </span>
    </div>
  );
}
