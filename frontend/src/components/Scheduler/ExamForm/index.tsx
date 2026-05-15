import React, { memo, useState } from 'react';
import { useSchedulerStore } from '../../../store/schedulerStore';
import type { ExamTopicCreate } from '../../../types';
import './styles.css';

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const defaultTopic = (): ExamTopicCreate => ({
  name: '',
  estimated_hours: 1,
  priority: 2,
});

interface Props {
  onSuccess?: (examId: number) => void;
}

const ExamForm: React.FC<Props> = ({ onSuccess }) => {
  const { createExam, isLoading } = useSchedulerStore();

  const [name, setName]             = useState('');
  const [examDate, setExamDate]     = useState('');
  const [dailyHours, setDailyHours] = useState(2);
  const [availDays, setAvailDays]   = useState<number[]>([0, 1, 2, 3, 4]);
  const [topics, setTopics]         = useState<ExamTopicCreate[]>([defaultTopic()]);

  const toggleDay = (day: number) =>
    setAvailDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );

  const updateTopic = (idx: number, field: keyof ExamTopicCreate, value: string | number) =>
    setTopics((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t))
    );

  const addTopic = () => setTopics((prev) => [...prev, defaultTopic()]);

  const removeTopic = (idx: number) =>
    setTopics((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !examDate || availDays.length === 0 || topics.length === 0) return;

    const result = await createExam({
      name,
      exam_date: new Date(examDate).toISOString(),
      daily_hours: dailyHours,
      available_days: availDays,
      topics,
    });

    if (result && onSuccess) {
      onSuccess(result.id);
    }
  };

  return (
    <form className="exam-form" onSubmit={handleSubmit}>
      <h2 className="exam-form__title">Novo Plano de Estudos</h2>

      <div className="exam-form__field">
        <label className="exam-form__label">Nome do concurso / prova</label>
        <input
          className="exam-form__input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: ENEM 2026"
          required
        />
      </div>

      <div className="exam-form__field">
        <label className="exam-form__label">Data da prova</label>
        <input
          className="exam-form__input"
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          required
        />
      </div>

      <div className="exam-form__field">
        <label className="exam-form__label">Horas de estudo por dia disponível</label>
        <input
          className="exam-form__input exam-form__input--short"
          type="number"
          min={0.5}
          max={12}
          step={0.5}
          value={dailyHours}
          onChange={(e) => setDailyHours(parseFloat(e.target.value))}
          required
        />
      </div>

      <div className="exam-form__field">
        <label className="exam-form__label">Dias disponíveis</label>
        <div className="exam-form__days">
          {DAY_LABELS.map((label, idx) => (
            <button
              key={idx}
              type="button"
              className={`exam-form__day-btn${availDays.includes(idx) ? ' exam-form__day-btn--active' : ''}`}
              onClick={() => toggleDay(idx)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="exam-form__field">
        <label className="exam-form__label">Tópicos</label>
        {topics.map((t, idx) => (
          <div key={idx} className="exam-form__topic-row">
            <input
              className="exam-form__input"
              type="text"
              placeholder="Nome do tópico"
              value={t.name}
              onChange={(e) => updateTopic(idx, 'name', e.target.value)}
              required
            />
            <input
              className="exam-form__input exam-form__input--short"
              type="number"
              min={0.5}
              max={20}
              step={0.5}
              title="Horas estimadas"
              value={t.estimated_hours}
              onChange={(e) => updateTopic(idx, 'estimated_hours', parseFloat(e.target.value))}
            />
            <select
              className="exam-form__select"
              value={t.priority}
              onChange={(e) => updateTopic(idx, 'priority', parseInt(e.target.value))}
            >
              <option value={1}>Alta</option>
              <option value={2}>Média</option>
              <option value={3}>Baixa</option>
            </select>
            {topics.length > 1 && (
              <button
                type="button"
                className="exam-form__remove-btn"
                onClick={() => removeTopic(idx)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" className="exam-form__add-topic-btn" onClick={addTopic}>
          + Adicionar tópico
        </button>
      </div>

      <button className="exam-form__submit" type="submit" disabled={isLoading}>
        {isLoading ? 'Gerando plano...' : 'Gerar Plano de Estudos'}
      </button>
    </form>
  );
};

export default memo(ExamForm);
