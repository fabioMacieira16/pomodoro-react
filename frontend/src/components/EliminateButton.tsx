import { Scissors } from 'lucide-react';

interface Props {
  eliminated: boolean;
  onToggle: (e: React.MouseEvent) => void;
  className?: string;
}

export function EliminateButton({ eliminated, onToggle, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(e); }}
      title={eliminated ? 'Restaurar alternativa' : 'Eliminar alternativa'}
      className={className}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 5px',
        color: eliminated ? '#ef4444' : 'currentColor',
        opacity: eliminated ? 0.85 : 0.25,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        transition: 'opacity 0.15s, color 0.15s',
        lineHeight: 1,
      }}
    >
      <Scissors size={13} />
    </button>
  );
}
