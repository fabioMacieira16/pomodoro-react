import { memo } from 'react';
import './styles.css';

interface StatusType {
  name: string;
  value: boolean | number;
}

const TypeSelect = ({ types, changeType, selected }: { types: StatusType[]; changeType: (t: StatusType) => void; selected: StatusType }) => (
  <div className="TypeSelect">
    {types.map((type) => (
      <button
        key={type.name}
        onClick={() => changeType(type)}
        className={type === selected ? 'active' : ''}
      >
        {type.name}
      </button>
    ))}
  </div>
);

export default memo(TypeSelect);
