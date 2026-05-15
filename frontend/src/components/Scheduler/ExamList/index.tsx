import React, { memo } from 'react';
import type { ExamSummary } from '../../../types';
import './styles.css';

interface Props {
  exams: ExamSummary[];
  selectedExamId: number | null;
  onSelect: (examId: number) => void;
  onDelete: (examId: number) => void;
}

const ExamList: React.FC<Props> = ({ exams, selectedExamId, onSelect, onDelete }) => {
  if (exams.length === 0) {
    return <p className="exam-list__empty">Nenhum plano criado ainda.</p>;
  }

  return (
    <ul className="exam-list">
      {exams.map((exam) => {
        const daysLeft = Math.ceil(
          (new Date(exam.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return (
          <li
            key={exam.id}
            className={`exam-list__item${exam.id === selectedExamId ? ' exam-list__item--active' : ''}`}
          >
            <div className="exam-list__info" onClick={() => onSelect(exam.id)}>
              <span className="exam-list__name">{exam.name}</span>
              <span className="exam-list__meta">
                {exam.topic_count} tópico{exam.topic_count !== 1 ? 's' : ''} · {daysLeft > 0 ? `${daysLeft} dias` : 'passado'}
              </span>
            </div>
            <div className="exam-list__actions">
              <button
                className="exam-list__btn exam-list__btn--view"
                onClick={() => onSelect(exam.id)}
                title="Ver plano"
              >
                📅
              </button>
              <button
                className="exam-list__btn exam-list__btn--delete"
                onClick={() => onDelete(exam.id)}
                title="Excluir"
              >
                🗑
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default memo(ExamList);
