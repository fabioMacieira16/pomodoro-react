import React, { memo } from 'react';
import './TypeSelect.css';

interface TimerType {
  name: string;
  time: number;
}

interface TypeSelectProps {
  types: TimerType[];
  changeType: (type: TimerType) => void;
  selected: TimerType;
}

const TypeSelect: React.FC<TypeSelectProps> = ({ types, changeType, selected }) => (
  <div className="TypeSelect">
    {types.map((type) => (
      <button
        key={type.name}
        onClick={() => changeType(type)}
        className={type.name === selected.name ? 'active' : ''}
      >
        {type.name}
      </button>
    ))}
  </div>
);

export default memo(TypeSelect);
