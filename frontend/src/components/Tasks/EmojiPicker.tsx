import React, { useState, useRef, useEffect } from 'react';

const EMOJIS = [
  // Estudo
  '📚', '📖', '📝', '✏️', '📌', '📋', '📊', '📈', '💻', '🖥️',
  '📐', '🔬', '🧪', '🗒️', '📎', '🖊️', '🗂️', '📓', '📗', '📘',
  // Motivação / status
  '✅', '⭐', '🔥', '💡', '⚡', '🎯', '🏆', '🎉', '✨', '💪',
  '🧠', '👊', '🚀', '💎', '🔑', '🏅', '🥇', '💯', '🎓', '🌟',
  // Tempo / organização
  '⏰', '⏱️', '📅', '🗓️', '🔔', '🍅', '🔄', '📦', '🗃️', '🗄️',
  // Misc
  '🎵', '🎮', '🏃', '❤️', '🌈', '🌙', '☀️', '🌱', '🧩', '👀',
];

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  placement?: 'up' | 'down';
}

export const EmojiPicker: React.FC<Props> = ({ value, onChange, placement = 'up' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dropPos = placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1';

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={value ? `${value} — clique para alterar` : 'Adicionar emoji'}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 transition-colors text-base leading-none select-none"
      >
        {value || <span className="text-xs text-white/50 font-bold">+😊</span>}
      </button>

      {open && (
        <div
          className={`absolute left-0 ${dropPos} z-[100] bg-gray-800 border border-white/20 rounded-xl shadow-2xl p-2`}
          style={{ width: 228 }}
        >
          <div className="grid grid-cols-10 gap-0.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onChange(value === emoji ? '' : emoji); setOpen(false); }}
                className={`w-[20px] h-[20px] text-xs flex items-center justify-center rounded transition-colors hover:bg-white/20 ${value === emoji ? 'bg-blue-600/60 ring-1 ring-blue-400' : ''}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="mt-1.5 w-full text-xs text-gray-400 hover:text-white text-center py-1 rounded hover:bg-white/10 transition-colors"
            >
              ✕ Remover emoji
            </button>
          )}
        </div>
      )}
    </div>
  );
};
