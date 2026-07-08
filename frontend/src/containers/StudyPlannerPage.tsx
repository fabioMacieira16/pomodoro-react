import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudyPlannerStore, WizardAnswers, EditalFromInput } from '../store/studyPlannerStore';
import { usePlanTaskStore } from '../store/planTaskStore';
import { useDocumentStore } from '../store/documentStore';
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

interface EditalData {
  concurso: string | null;
  banca: string | null;
  cargos: string[];
  disciplinas: Record<string, number>;
  disciplinas_detalhadas?: Array<{
    area: string;
    disciplina: string;
    num_questoes: number;
    peso: number;
    pontuacao_max: number;
  }>;
  programa_por_cargo?: Record<string, string[]>;
  data_prova: string | null;
  vagas: number | null;
  salario: string | null;
  is_retification?: boolean;
  aviso?: string | null;
}

type ImportStep = 'upload' | 'cargo_selection' | 'quick_setup';

const StudyPlannerPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    wizardStep, wizardAnswers, wizardLoading, activePlan, planLoading, planError,
    setWizardStep, updateWizardAnswers, submitWizard, fetchActivePlan, resetWizard,
    generateFromEdital,
  } = useStudyPlannerStore();

  const { uploadFile, isIndexing } = useDocumentStore();
  const { clearTasks } = usePlanTaskStore();

  // Wizard manual
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [showWizard, setShowWizard] = useState(false);
  const [localValue, setLocalValue] = useState('');

  // Fluxo de importação do edital
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [editalData, setEditalData] = useState<EditalData | null>(null);
  const [selectedCargo, setSelectedCargo] = useState<string>('');

  // Quick setup
  const [quickDailyHours, setQuickDailyHours] = useState(4);
  const [quickAvailDays, setQuickAvailDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [quickExamDate, setQuickExamDate] = useState('');
  const [manualCargo, setManualCargo] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchActivePlan(); }, [fetchActivePlan]);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.pdf')) await handleUpload(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    // Sempre envia como edital para que a análise seja feita
    const result = await uploadFile(file, undefined, undefined, 'edital');
    if (!result) return;

    const raw = result.edital_info ?? null;
    if (!raw) {
      setShowWizard(true);
      return;
    }

    // Garante que disciplinas está populado mesmo quando a IA não encontrou a tabela
    const info: EditalData = {
      ...raw,
      is_retification: result.is_retification ?? raw.is_retification ?? false,
      aviso: result.aviso ?? raw.aviso ?? null,
    };
    if (Object.keys(info.disciplinas || {}).length === 0) {
      if (info.disciplinas_detalhadas?.length) {
        info.disciplinas = Object.fromEntries(
          info.disciplinas_detalhadas.map((d) => [d.disciplina, d.pontuacao_max || d.num_questoes || 1])
        );
      } else if (info.programa_por_cargo && Object.keys(info.programa_por_cargo).length > 0) {
        // Usa tópicos do primeiro cargo como disciplinas com peso igual
        const topicos = Object.values(info.programa_por_cargo as Record<string, string[]>).flat();
        const unicos = [...new Set(topicos)];
        info.disciplinas = Object.fromEntries(unicos.map((t) => [t, 1]));
      }
    }

    setEditalData(info);

    // Pré-preenche data da prova se encontrada
    if (info.data_prova) {
      const d = new Date(info.data_prova);
      setQuickExamDate(d.toISOString().split('T')[0]);
    }

    if (result.requires_cargo_selection && info.cargos.length > 1) {
      setImportStep('cargo_selection');
    } else {
      if (info.cargos.length === 1) setSelectedCargo(info.cargos[0]);
      setImportStep('quick_setup');
    }
  };

  const handleCargoSelect = (cargo: string) => {
    setSelectedCargo(cargo);
    setImportStep('quick_setup');
  };

  const handleGenerateFromEdital = async () => {
    if (!editalData) return;

    const cargoFinal = selectedCargo || manualCargo.trim() || 'Candidato';

    const input: EditalFromInput = {
      concurso: editalData.concurso || 'Concurso Público',
      cargo: cargoFinal,
      banca: editalData.banca || undefined,
      exam_date: quickExamDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      daily_hours: quickDailyHours,
      available_days: quickAvailDays,
      disciplinas: editalData.disciplinas,
    };

    await generateFromEdital(input);

    const state = useStudyPlannerStore.getState();
    if (state.activePlan && !state.planError) {
      clearTasks(); // força PlanoPage a buscar o contexto atualizado com o novo concurso/cargo
      navigate('/plano');
    }
  };

  // Wizard manual handlers
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
      const finalAnswers: WizardAnswers = {
        ...(wizardAnswers as WizardAnswers),
        ...updates,
        available_days: selectedDays,
      };
      submitWizard(finalAnswers).then(() => {
        setShowWizard(false);
        clearTasks();
        navigate('/plano');
      });
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

      {/* ── Upload inicial ── */}
      {importStep === 'upload' && !showWizard && (
        <div className="planner-content">
          <div className="planner-header">
            <div className="empty-icon">📋</div>
            <h2>Importe seu Edital</h2>
            <p>Envie o PDF do edital — a IA extrai as disciplinas e cria seu plano automaticamente</p>
          </div>

          <div
            className={`drop-zone ${isIndexing ? 'indexing' : ''}`}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            {isIndexing
              ? '⏳ Analisando edital com IA...'
              : '📎 Arraste o PDF do edital ou clique para selecionar'}
          </div>

          <div className="planner-divider">— ou —</div>

          <button className="start-wizard-btn" onClick={() => setShowWizard(true)}>
            ✏️ Criar plano manualmente
          </button>

          {planError && <div className="plan-error">{planError}</div>}
        </div>
      )}

      {/* ── Seleção de cargo ── */}
      {importStep === 'cargo_selection' && editalData && (
        <div className="planner-content">
          {editalData.aviso && (
            <div className="edital-aviso">
              ⚠️ {editalData.aviso}
            </div>
          )}
          <div className="edital-preview">
            <div className="edital-preview__badge">
              {editalData.is_retification ? '⚠️ Edital de Retificação' : '✅ Edital analisado'}
            </div>
            <div className="edital-preview__title">{editalData.concurso || 'Concurso'}</div>
            {editalData.banca && (
              <div className="edital-preview__meta">Banca: <strong>{editalData.banca}</strong></div>
            )}
            {editalData.data_prova && (
              <div className="edital-preview__meta">
                Data da prova: <strong>{new Date(editalData.data_prova).toLocaleDateString('pt-BR')}</strong>
              </div>
            )}
            <div className="edital-preview__meta">
              {Object.keys(editalData.disciplinas).length} disciplinas encontradas
            </div>
          </div>

          <h3 className="cargo-select-title">Selecione seu cargo:</h3>

          <div className="cargo-list">
            {editalData.cargos.map(cargo => (
              <button
                key={cargo}
                className="cargo-option"
                onClick={() => handleCargoSelect(cargo)}
              >
                <span className="cargo-option__name">{cargo}</span>
                <span className="cargo-option__arrow">→</span>
              </button>
            ))}
          </div>

          <button className="back-btn" style={{ marginTop: 16 }}
            onClick={() => { setImportStep('upload'); setEditalData(null); }}>
            ← Voltar
          </button>
        </div>
      )}

      {/* ── Quick setup ── */}
      {importStep === 'quick_setup' && editalData && (
        <div className="planner-content">
          {editalData.aviso && (
            <div className="edital-aviso">
              ⚠️ {editalData.aviso}
            </div>
          )}
          <div className="edital-preview">
            <div className="edital-preview__badge">
              {editalData.is_retification ? '⚠️ Edital de Retificação' : '✅ Edital analisado'}
            </div>
            <div className="edital-preview__title">{editalData.concurso || 'Concurso'}</div>
            {selectedCargo && (
              <div className="edital-preview__cargo">📌 {selectedCargo}</div>
            )}
            <div className="edital-preview__disc-count">
              {Object.keys(editalData.disciplinas).length > 0
                ? `${Object.keys(editalData.disciplinas).length} disciplinas`
                : 'Disciplinas não identificadas'}{' '}
              • {editalData.banca || 'Banca não identificada'}
            </div>

            {/* Miniatura das disciplinas */}
            {Object.keys(editalData.disciplinas).length > 0 ? (
              <div className="edital-disc-chips">
                {Object.keys(editalData.disciplinas).slice(0, 8).map(d => (
                  <span key={d} className="edital-disc-chip">{d}</span>
                ))}
                {Object.keys(editalData.disciplinas).length > 8 && (
                  <span className="edital-disc-chip edital-disc-chip--more">
                    +{Object.keys(editalData.disciplinas).length - 8}
                  </span>
                )}
              </div>
            ) : (
              <div className="edital-no-disc">
                Nenhuma disciplina foi extraída automaticamente.
                {editalData.is_retification
                  ? ' Importe o edital de abertura para obter as disciplinas.'
                  : ' O plano usará tópicos padrão para a banca selecionada.'}
              </div>
            )}
          </div>

          <div className="quick-setup">
            <h3 className="quick-setup__title">Configure seu plano</h3>

            {/* Campo de cargo — exibe quando não foi auto-detectado */}
            {!selectedCargo && (
              <div className="quick-setup__field">
                <label>💼 Cargo pretendido</label>
                <input
                  type="text"
                  className="wizard-input"
                  placeholder="Ex: Analista Judiciário – TI, Técnico…"
                  value={manualCargo}
                  onChange={e => setManualCargo(e.target.value)}
                />
              </div>
            )}

            <div className="quick-setup__field">
              <label>📅 Data da prova</label>
              <input
                type="date"
                className="wizard-input"
                value={quickExamDate}
                onChange={e => setQuickExamDate(e.target.value)}
              />
            </div>

            <div className="quick-setup__field">
              <label>⏰ Horas de estudo por dia</label>
              <div className="quick-hours-row">
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={0.5}
                  value={quickDailyHours}
                  onChange={e => setQuickDailyHours(Number(e.target.value))}
                  className="quick-hours-range"
                />
                <span className="quick-hours-value">{quickDailyHours}h</span>
              </div>
            </div>

            <div className="quick-setup__field">
              <label>📆 Dias de estudo por semana</label>
              <div className="days-grid">
                {DAYS.map((day, i) => (
                  <button
                    key={i}
                    className={`day-btn ${quickAvailDays.includes(i) ? 'selected' : ''}`}
                    onClick={() => setQuickAvailDays(prev =>
                      prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                    )}
                  >{day}</button>
                ))}
              </div>
            </div>

            {planError && <div className="plan-error">{planError}</div>}

            <button
              className="generate-btn"
              onClick={handleGenerateFromEdital}
              disabled={wizardLoading || !quickExamDate || quickAvailDays.length === 0}
            >
              {wizardLoading ? '⏳ Gerando plano...' : '🚀 Gerar Plano de Estudos'}
            </button>

            <button className="back-btn" style={{ marginTop: 8 }}
              onClick={() => setImportStep(editalData.cargos.length > 1 ? 'cargo_selection' : 'upload')}>
              ← Voltar
            </button>
          </div>
        </div>
      )}

      {/* ── Wizard manual ── */}
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
                    <button className={`bool-btn ${localValue === 'true' ? 'selected' : ''}`}
                      onClick={() => setLocalValue('true')}>Sim</button>
                    <button className={`bool-btn ${localValue === 'false' ? 'selected' : ''}`}
                      onClick={() => setLocalValue('false')}>Não</button>
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

      {/* ── Plano ativo (após geração via wizard ou já existente) ── */}
      {activePlan && importStep === 'upload' && !showWizard && (
        <div className="plan-view">
          <div className="plan-view__actions">
            <button className="edit-btn" onClick={() => navigate('/plano')}>📋 Ver Kanban</button>
            <button className="edit-btn" onClick={() => setShowWizard(true)}>✏️ Editar Plano</button>
          </div>

          {activePlan.is_multi_edital && activePlan.multi_edital_badge && (
            <div className="multi-edital-badge">🔀 {activePlan.multi_edital_badge}</div>
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
                  <span>{topic.difficulty}</span>
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
