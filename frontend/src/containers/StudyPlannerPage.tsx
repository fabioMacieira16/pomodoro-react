import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudyPlannerStore, WizardAnswers } from '../store/studyPlannerStore';
import './StudyPlannerPage.css';

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const WIZARD_STEPS = [
  { field: 'concurso',            label: 'Qual concurso você está estudando?',         placeholder: 'Ex: SEFAZ-CE, TJCE, INSS…',  type: 'text' },
  { field: 'cargo',               label: 'Qual o cargo desejado?',                      placeholder: 'Ex: Auditor Fiscal, Analista…', type: 'text' },
  { field: 'banca',               label: 'Qual a banca organizadora?',                  placeholder: 'Ex: CESPE, FCC, VUNESP…',       type: 'text' },
  { field: 'exam_date',           label: 'Data prevista da prova?',                     placeholder: '',                              type: 'date' },
  { field: 'daily_hours',         label: 'Quantas horas por dia você pode estudar?',   placeholder: 'Ex: 4',                         type: 'number' },
  { field: 'strong_subjects',     label: 'Quais são suas matérias fortes? (vírgula)',  placeholder: 'Ex: Português, Matemática',     type: 'text' },
  { field: 'weak_subjects',       label: 'Quais são suas matérias fracas? (vírgula)',  placeholder: 'Ex: Direito Constitucional',    type: 'text' },
  { field: 'previous_experience', label: 'Experiência anterior em concursos?',         placeholder: 'Ex: Nenhuma, 2 anos…',          type: 'text' },
  { field: 'has_studied_edital',  label: 'Você já estudou o edital?',                  placeholder: '',                              type: 'boolean' },
];

const StudyPlannerPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    wizardStep, wizardAnswers, wizardLoading, activePlan, planLoading, planError,
    setWizardStep, updateWizardAnswers, submitWizard, fetchActivePlan, editPlan, resetWizard,
  } = useStudyPlannerStore();

  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [showWizard, setShowWizard] = useState(false);
  const [localValue, setLocalValue] = useState('');

  useEffect(() => { fetchActivePlan(); }, [fetchActivePlan]);

  const currentStep = WIZARD_STEPS[wizardStep];

  const handleNext = () => {
    if (!currentStep) return;
    const updates: Partial<WizardAnswers> = {};
    if (currentStep.type === 'boolean') {
      (updates as Record<string, unknown>)[currentStep.field] = localValue === 'true';
    } else if (currentStep.type === 'number') {
      (updates as Record<string, unknown>)[currentStep.field] = Number(localValue);
    } else if (currentStep.field === 'strong_subjects' || currentStep.field === 'weak_subjects') {
      (updates as Record<string, unknown>)[currentStep.field] = localValue.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      (updates as Record<string, unknown>)[currentStep.field] = localValue;
    }
    updateWizardAnswers(updates);
    setLocalValue('');

    if (wizardStep < WIZARD_STEPS.length - 1) {
      setWizardStep(wizardStep + 1);
    } else {
      // Last step: add selected days then submit
      const finalAnswers: WizardAnswers = {
        ...(wizardAnswers as WizardAnswers),
        ...updates,
        available_days: selectedDays,
      };
      submitWizard(finalAnswers).then(() => setShowWizard(false));
    }
  };

  if (planLoading) {
    return (
      <div className="planner-page">
        <div className="planner-loading">Carregando plano…</div>
      </div>
    );
  }

  return (
    <div className="planner-page">
      <header className="planner-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Voltar</button>
        <h1>📖 Planejador de Estudos IA</h1>
        {activePlan && (
          <button className="edit-btn" onClick={() => setShowWizard(true)}>✏️ Editar Plano</button>
        )}
      </header>

      {!activePlan && !showWizard && (
        <div className="planner-empty">
          <div className="empty-icon">🎯</div>
          <h2>Crie seu plano inteligente</h2>
          <p>A IA vai montar um cronograma personalizado baseado no seu edital, cargo e disponibilidade.</p>
          <button className="start-wizard-btn" onClick={() => setShowWizard(true)}>
            Criar Plano de Estudos
          </button>
        </div>
      )}

      {showWizard && (
        <div className="wizard-overlay">
          <div className="wizard-card">
            <div className="wizard-progress">
              {WIZARD_STEPS.map((_, i) => (
                <div key={i} className={`wizard-dot ${i <= wizardStep ? 'active' : ''}`} />
              ))}
            </div>

            {wizardStep < WIZARD_STEPS.length ? (
              <>
                <h2 className="wizard-question">{currentStep.label}</h2>

                {currentStep.type === 'boolean' ? (
                  <div className="boolean-btns">
                    <button
                      className={`bool-btn ${localValue === 'true' ? 'selected' : ''}`}
                      onClick={() => setLocalValue('true')}
                    >Sim</button>
                    <button
                      className={`bool-btn ${localValue === 'false' ? 'selected' : ''}`}
                      onClick={() => setLocalValue('false')}
                    >Não</button>
                  </div>
                ) : (
                  <input
                    className="wizard-input"
                    type={currentStep.type}
                    placeholder={currentStep.placeholder}
                    value={localValue}
                    onChange={e => setLocalValue(e.target.value)}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleNext()}
                  />
                )}

                {/* Days selector on last step */}
                {wizardStep === WIZARD_STEPS.length - 1 && (
                  <div className="days-selector">
                    <label>Dias disponíveis:</label>
                    <div className="days-grid">
                      {DAYS.map((day, i) => (
                        <button
                          key={i}
                          className={`day-btn ${selectedDays.includes(i) ? 'selected' : ''}`}
                          onClick={() => setSelectedDays(prev =>
                            prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                          )}
                        >{day}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="wizard-actions">
                  {wizardStep > 0 && (
                    <button className="wizard-back" onClick={() => setWizardStep(wizardStep - 1)}>← Voltar</button>
                  )}
                  <button
                    className="wizard-next"
                    onClick={handleNext}
                    disabled={wizardLoading || (!localValue && currentStep.type !== 'boolean')}
                  >
                    {wizardStep === WIZARD_STEPS.length - 1
                      ? (wizardLoading ? 'Gerando…' : '🚀 Gerar Plano')
                      : 'Próximo →'
                    }
                  </button>
                </div>
              </>
            ) : null}

            <button className="wizard-close" onClick={() => { setShowWizard(false); resetWizard(); }}>✕</button>
          </div>
        </div>
      )}

      {activePlan && (
        <div className="plan-view">
          {activePlan.is_multi_edital && activePlan.multi_edital_badge && (
            <div className="multi-edital-badge">
              🔀 {activePlan.multi_edital_badge}
            </div>
          )}

          <div className="plan-summary">
            <div className="plan-stat">
              <span className="stat-value">{activePlan.days_until_exam}</span>
              <span className="stat-label">dias até a prova</span>
            </div>
            <div className="plan-stat">
              <span className="stat-value">{activePlan.total_study_hours}h</span>
              <span className="stat-label">horas planejadas</span>
            </div>
            <div className="plan-stat">
              <span className="stat-value">{activePlan.topics.length}</span>
              <span className="stat-label">tópicos</span>
            </div>
          </div>

          <h2>{activePlan.concurso} — {activePlan.cargo}</h2>
          <p className="plan-meta">Banca: <strong>{activePlan.banca}</strong> · Prova: <strong>{activePlan.exam_date}</strong></p>

          <div className="topics-list">
            {activePlan.topics.map((topic, i) => (
              <div key={i} className={`topic-card priority-${topic.priority}`}>
                <div className="topic-name">{topic.topic_name}</div>
                <div className="topic-meta">
                  <span>{topic.allocated_hours}h</span>
                  <span className="topic-diff diff-{topic.difficulty.toLowerCase()}">{topic.difficulty}</span>
                  <span>P{topic.priority}</span>
                </div>
              </div>
            ))}
          </div>

          {activePlan.priorities.length > 0 && (
            <div className="priorities-section">
              <h3>🎯 Prioridades</h3>
              <ul>{activePlan.priorities.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}

          {planError && <div className="plan-error">{planError}</div>}
        </div>
      )}
    </div>
  );
};

export default StudyPlannerPage;
