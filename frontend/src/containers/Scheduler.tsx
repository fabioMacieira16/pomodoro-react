import React, { memo, useEffect, useState } from 'react';
import { useSchedulerStore } from '../store/schedulerStore';
import ExamForm from '../components/Scheduler/ExamForm';
import ExamList from '../components/Scheduler/ExamList';
import WeeklyView from '../components/Scheduler/WeeklyView';
import DailyList from '../components/Scheduler/DailyList';
import './Scheduler.css';

const Scheduler: React.FC = () => {
  const {
    exams,
    planItems,
    isLoading,
    fetchExams,
    deleteExam,
    fetchPlan,
    toggleItem,
  } = useSchedulerStore();

  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedDay,    setSelectedDay]     = useState<string | null>(null);
  const [showForm,       setShowForm]        = useState(false);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleSelectExam = async (examId: number) => {
    setSelectedExamId(examId);
    setSelectedDay(null);
    await fetchPlan(examId);
  };

  const handleDeleteExam = async (examId: number) => {
    if (!window.confirm('Excluir este plano de estudos?')) return;
    await deleteExam(examId);
    if (selectedExamId === examId) {
      setSelectedExamId(null);
      setSelectedDay(null);
    }
  };

  const handleFormSuccess = async (examId: number) => {
    setShowForm(false);
    await handleSelectExam(examId);
  };

  return (
    <div className="scheduler">
      <header className="scheduler__header">
        <h1 className="scheduler__title">📅 Planejador de Estudos</h1>
        <button
          className="scheduler__new-btn"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? '✕ Fechar' : '+ Novo Plano'}
        </button>
      </header>

      {showForm && (
        <div className="scheduler__form-wrapper">
          <ExamForm onSuccess={handleFormSuccess} />
        </div>
      )}

      {isLoading && exams.length === 0 ? (
        <p className="scheduler__loading">Carregando...</p>
      ) : (
        <div className="scheduler__body">
          <aside className="scheduler__sidebar">
            <ExamList
              exams={exams}
              selectedExamId={selectedExamId}
              onSelect={handleSelectExam}
              onDelete={handleDeleteExam}
            />
          </aside>

          {selectedExamId !== null && (
            <section className="scheduler__plan">
              <WeeklyView
                planItems={planItems}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onToggleItem={(id, completed) => toggleItem(id, completed)}
              />
              <DailyList
                date={selectedDay}
                items={planItems}
                onToggle={(id, completed) => toggleItem(id, completed)}
              />
            </section>
          )}

          {exams.length === 0 && !showForm && (
            <div className="scheduler__onboarding">
              <p>Você ainda não tem nenhum plano.</p>
              <button
                className="scheduler__new-btn"
                onClick={() => setShowForm(true)}
              >
                + Criar primeiro plano
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(Scheduler);
