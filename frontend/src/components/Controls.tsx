import React, { memo } from 'react';
import './Controls.css';

interface ControlsProps {
  start: () => void;
  reset: () => void;
  pause: () => void;
  status: 'Finished' | 'Paused' | 'Running' | null;
}

const Controls: React.FC<ControlsProps> = ({ start, pause, status }) => (
  <div className="Controls">
    {!status && (
      <button onClick={start} className="start">
        Start Timer
      </button>
    )}

    {status === 'Finished' && (
      <button onClick={start} className="start">
        Restart Timer
      </button>
    )}

    {(status === 'Paused' || status === 'Running') && (
      <div>
        <button
          onClick={pause}
          className={status === 'Paused' ? 'resume' : 'pause'}
        >
          {status === 'Paused' ? 'Retornar' : 'Pause'}
        </button>
      </div>
    )}
  </div>
);

export default memo(Controls);
