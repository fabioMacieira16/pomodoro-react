import React, { memo } from 'react';
import './styles.css';

interface ProductivityModalProps {
  onSubmit: (rating: number | null) => void;
}

const stars = [1, 2, 3, 4, 5];

const labels = ['Ruim', 'Regular', 'Bom', 'Ótimo', 'Excelente'];

const ProductivityModal: React.FC<ProductivityModalProps> = ({ onSubmit }) => (
  <div className="prod-overlay" role="dialog" aria-modal="true" aria-label="Avaliação de produtividade">
    <div className="prod-card">
      <h2 className="prod-title">Pomodoro concluído! 🍅</h2>
      <p className="prod-sub">Como foi sua produtividade nessa sessão?</p>
      <div className="prod-stars">
        {stars.map((n) => (
          <button
            key={n}
            className="prod-star-btn"
            onClick={() => onSubmit(n)}
            title={labels[n - 1]}
            aria-label={`${labels[n - 1]} (${n} estrela${n > 1 ? 's' : ''})`}
          >
            ⭐
            <span className="prod-star-label">{labels[n - 1]}</span>
          </button>
        ))}
      </div>
      <button className="prod-skip" onClick={() => onSubmit(null)}>
        Pular avaliação
      </button>
    </div>
  </div>
);

export default memo(ProductivityModal);
