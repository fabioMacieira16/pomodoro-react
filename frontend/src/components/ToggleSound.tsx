import React, { memo } from 'react';
import './ToggleSound.css';

interface ToggleSoundProps {
  sound: boolean;
  toggleSound: () => void;
}

const ToggleSound: React.FC<ToggleSoundProps> = ({ sound, toggleSound }) => (
  <button
    className={`ToggleSound ${sound && 'active'}`}
    onClick={toggleSound}
    title={sound ? 'Disable Sound' : 'Enable Sound'}
  >
    <i className={`fa fa-volume-${sound ? 'up' : 'mute'}`} />
  </button>
);

export default memo(ToggleSound);
