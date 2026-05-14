import React, { useState, useEffect, useCallback, useRef } from 'react';
import TypeSelect from '../components/TypeSelect';
import TimeDisplay from '../components/TimeDisplay';
import Controls from '../components/Controls';
import Shortcuts from '../components/Shortcuts';
import ToggleSound from '../components/ToggleSound';
import ToggleTask from '../components/Tasks/TaskToggle';
import TaskList from '../components/Tasks/TaskList';
import './Pomodoro.css';

interface TimerType {
  name: string;
  time: number;
}

interface PomodoroProps {
  types?: TimerType[];
}

const DEFAULT_TYPES: TimerType[] = [
  { name: 'Pomodoro', time: 1500 },
  { name: 'Short Break', time: 300 },
  { name: 'Long Break', time: 900 }
];

const Pomodoro: React.FC<PomodoroProps> = ({ types = DEFAULT_TYPES }) => {
  const [selectedType, setSelectedType] = useState<TimerType>(types[0]);
  const [time, setTime] = useState<number>(types[0].time);
  const [running, setRunning] = useState<boolean>(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [sound, setSound] = useState<boolean>(() => {
    const saved = window.localStorage.getItem('pomodoro-react-sound');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [taskStatus, setTaskStatus] = useState<boolean>(() => {
    const saved = window.localStorage.getItem('pomodoro-react-taskStatus');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const soundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    soundRef.current = new Audio('bell.flac');
    soundRef.current.preload = 'auto';

    const handleKeyUp = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName === 'INPUT') return;
      if (event.key === ' ') {
        pauseTimer();
      } else if (event.key === 'Escape') {
        resetTimer();
      } else if (parseInt(event.key) >= 1 && parseInt(event.key) <= types.length) {
        changeType(types[parseInt(event.key) - 1]);
      }
    };

    document.addEventListener('keyup', handleKeyUp);
    Notification.requestPermission();

    return () => {
      document.removeEventListener('keyup', handleKeyUp);
      if (intervalId) clearInterval(intervalId);
    };
  }, [types, intervalId]);

  const stopInterval = useCallback(() => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [intervalId]);

  const tick = useCallback(() => {
    setTime((prevTime) => {
      if (prevTime <= 1) {
        stopInterval();
        setRunning(false);
        if (sound && soundRef.current) soundRef.current.play();
        
        try {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
              registration.showNotification(`${selectedType.name} finished!`);
            });
          }
        } catch (e) {
          console.log('Notification error', e);
        }
        return 0;
      }
      return prevTime - 1;
    });
  }, [selectedType.name, sound, stopInterval]);

  const startTimer = useCallback(() => {
    setRunning(true);
    const id = setInterval(tick, 1000);
    setIntervalId(id);
    if (soundRef.current) {
        soundRef.current.pause();
        soundRef.current.currentTime = 0;
    }
  }, [tick]);

  const resetTimer = useCallback(() => {
    stopInterval();
    setRunning(false);
    setTime(selectedType.time);
  }, [selectedType.time, stopInterval]);

  const pauseTimer = useCallback(() => {
    if (intervalId) {
      stopInterval();
    } else {
      startTimer();
    }
  }, [intervalId, startTimer, stopInterval]);

  const changeType = useCallback((type: TimerType) => {
    stopInterval();
    setRunning(false);
    setSelectedType(type);
    setTime(type.time);
  }, [stopInterval]);

  const getStatus = (): 'Finished' | 'Paused' | 'Running' | null => {
    if (time === 0) return 'Finished';
    if (running && !intervalId) return 'Paused';
    if (running) return 'Running';
    return null;
  };

  const getProgress = (): number => {
    const total = selectedType.time;
    return ((total - time) / total) * 100;
  };

  const handleToggleSound = () => {
    setSound((prev) => {
      const newVal = !prev;
      window.localStorage.setItem('pomodoro-react-sound', JSON.stringify(newVal));
      return newVal;
    });
  };

  const handleToggleTask = () => {
    setTaskStatus((prev) => {
      const newVal = !prev;
      window.localStorage.setItem('pomodoro-react-taskStatus', JSON.stringify(newVal));
      return newVal;
    });
  };

  return (
    <div className="Content">
      <div className="Pomodoro">
        <TypeSelect
          types={types}
          selected={selectedType}
          changeType={changeType}
        />
        <TimeDisplay
          time={time}
          status={getStatus()}
          progress={getProgress()}
        />
        <Controls
          start={startTimer}
          reset={resetTimer}
          pause={pauseTimer}
          status={getStatus()}
        />
        <ToggleTask task={taskStatus} toggleTask={handleToggleTask} />
        <Shortcuts />
        <ToggleSound sound={sound} toggleSound={handleToggleSound} />
      </div>
      {taskStatus && (
        <div className="TaskPainel">
          <TaskList />
        </div>
      )}
    </div>
  );
};

export default Pomodoro;
