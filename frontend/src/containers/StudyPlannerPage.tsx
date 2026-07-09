import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudyPlannerStore, WizardAnswers, EditalFromInput } from '../store/studyPlannerStore';
import { usePlanTaskStore } from '../store/planTaskStore';
import { useDocumentStore } from '../store/documentStore';
import { useEditalListStore, SavedEdital } from '../store/editalListStore';
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

// ── Edital Card na lista ───────────────────────────────────────────────────────

interface EditalCardProps {
  edital: SavedEdital;
  onUse: () => void;
  onRemove: () => void;
}

const EditalCard: React.FC<EditalCardProps> = ({ edital, onUse, onRemove }) => {
  const numDisc = Object.keys(edital.disciplinas).length;
  const dateStr = edital.data_prova
    ? new Date(edital.data_prova).toLocaleDateString('pt-BR')
    : 'Data não informada';

  return (
    <div className="edital-saved-card">
      <div className="edital-saved-card__info">
        <div className="edital-saved-card__title">{edital.concurso}</div>
        <div className="edital-saved-card__meta">
          {edital.banca && <span>{edital.banca}</span>}
          <span>{numDisc} disciplinas</span>
          <span>Prova: {dateStr}</span>
        </div>
      </div>
      <div className="edital-saved-card__actions">
        <button className="edital-saved-card__use-btn" onClick={onUse}>
          Usar este
        </button>
        <button className="edital-saved-card__remove-btn" onClick={onRemove} title="Remover">
          ✕
        </button>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const StudyPlannerPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    wizardStep, wizardAnswers, wizardLoading, activePlan, planLoading, planError,
    setWizardStep, updateWizardAnswers, submitWizard, fetchActivePlan, resetWizard,
    generateFromEdital,
  } = useStudyPlannerStore();

  const { uploadFile, isIndexing } = useDocumentStore();
  const { clearTasks } = usePlanTaskStore();
  const { editais, addEdital, updateDisciplinas, removeEdital } = useEditalListStore();

  // Wizard manual
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [showWizard, setShowWizard] = useState(false);
  const [localValue, setLocalValue] = useState('');

  // Fluxo de importação do edital
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [editalData, setEditalData] = useState<EditalData | null>(null);
  const [selectedCargo, setSelectedCargo] = useState<string>('');
  const [currentEditalId, setCurrentEditalId] = useState<string | null>(null);

  // Disciplinas editáveis na tela quick_setup
  const [editableDisciplinas, setEditableDisciplinas] = useState<Record<string, number>>({});
  const [newDiscName, setNewDiscName] = useState('');

  // Quick setup
  const [quickDailyHours, setQuickDailyHours] = useState(4);
  const [quickAvailDays, setQuickAvailDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [quickExamDate, setQuickExamDate] = useState('');
  const [manualCargo, setManualCargo] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchActivePlan(); }, [fetchActivePlan]);

  // Sincroniza disciplinas editáveis quando edital muda
  useEffect(() => {
    if (editalData) {
      setEditableDisciplinas({ ...editalData.disciplinas });
    }
  }, [editalData]);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.pdf')) await handleUpload(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleUpload(file);
    e.target.value = '';
  };

  const handleUpload = async (file: File) => {
    const result = await uploadFile(file, undefined, undefined, 'edital');
    if (!result) return;

    const raw = result.edital_info ?? null;
    if (!raw) {
      setShowWizard(true);
      return;
    }

    const info: EditalData = {
      ...raw,
      is_retification: result.is_retification ?? raw.is_retification ?? false,
      aviso: result.aviso ?? raw.aviso ?? null,
    };

    // Garante disciplinas populadas
    if (Object.keys(info.disciplinas || {}).length === 0) {
      if (info.disciplinas_detalhadas?.length) {
        info.disciplinas = Object.fromEntries(
          info.disciplinas_detalhadas.map((d) => [d.disciplina, d.pontuacao_max || d.num_questoes || 1])
        );
      } else if (info.programa_por_cargo && Object.keys(info.programa_por_cargo).length > 0) {
        const topicos = Object.values(info.programa_por_cargo as Record<string, string[]>).flat();
        const unicos = [...new Set(topicos)];
        info.disciplinas = Object.fromEntries(unicos.map((t) => [t, 1]));
      }
    }

    setEditalData(info);

    if (info.data_prova) {
      const d = new Date(info.data_prova);
      setQuickExamDate(d.toISOString().split('T')[0]);
    }

    // Salva no store de editais
    const editalId = addEdital({
      concurso: info.concurso || 'Concurso',
      banca: info.banca,
      cargos: info.cargos,
      disciplinas: info.disciplinas,
      disciplinas_detalhadas: info.disciplinas_detalhadas || [],
      data_prova: info.data_prova,
    });
    setCurrentEditalId(editalId);

    if (result.requires_cargo_selection && info.cargos.length > 1) {
      setImportStep('cargo_selection');
    } else {
      if (info.cargos.length === 1) setSelectedCargo(info.cargos[0]);
      setImportStep('quick_setup');
    }
  };

  // Usa um edital já salvo no store
  const handleUseSavedEdital = (edital: SavedEdital) => {
    const info: EditalData = {
      concurso: edital.concurso,
      banca: edital.banca,
      cargos: edital.cargos,
      disciplinas: edital.disciplinas,
      disciplinas_detalhadas: edital.disciplinas_detalhadas,
      data_prova: edital.data_prova,
      vagas: null,
      salario: null,
    };
    setEditalData(info);
    setCurrentEditalId(edital.id);

    if (edital.data_prova) {
      const d = new Date(edital.data_prova);
      setQuickExamDate(d.toISOString().split('T')[0]);
    }

    if (edital.cargos.length > 1) {
      setImportStep('cargo_selection');
    } else {
      if (edital.cargos.length === 1) setSelectedCargo(edital.cargos[0]);
      setImportStep('quick_setup');
    }
  };

  const handleCargoSelect = (cargo: string) => {
    setSelectedCargo(cargo);
    setImportStep('quick_setup');
  };

  // Disciplinas editáveis
  const handleAddDisciplina = () => {
    const name = newDiscName.trim();
    if (!name) return;
    setEditableDisciplinas((prev) => ({ ...prev, [name]: 1 }));
    setNewDiscName('');
    if (currentEditalId) {
      updateDisciplinas(currentEditalId, { ...editableDisciplinas, [name]: 1 });
    }
  };

  const handleRemoveDisciplina = (disc: string) => {
    setEditableDisciplinas((prev) => {
      const next = { ...prev };
      delete next[disc];
      if (currentEditalId) updateDisciplinas(currentEditalId, next);
      return next;
    });
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
      disciplinas: editableDisciplinas,
    };

    await generateFromEdital(input);

    const state = useStudyPlannerStore.getState();
    if (state.activePlan && !state.planError) {
      clearTasks();
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

          {/* Lista de editais já importados */}
          {editais.length > 0 && (
            <div className="editais-salvos">
              <h3 className="editais-salvos__title">Editais importados</h3>
              {editais.map((edital) => (
                <EditalCard
                  key={edital.id}
                  edital={edital}
                  onUse={() => handleUseSavedEdital(edital)}
                  onRemove={() => removeEdital(edital.id)}
                />
              ))}
            </div>
          )}

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
          </div>

          {/* ── Disciplinas editáveis ── */}
          <div className="disc-editor">
            <div className="disc-editor__header">
              <h3 className="disc-editor__title">
                Disciplinas do Kanban
                <span className="disc-editor__count">{Object.keys(editableDisciplinas).length}</span>
              </h3>
              <p className="disc-editor__hint">
                Confira, adicione ou remova disciplinas antes de gerar o plano
              </p>
            </div>

            <div className="disc-editor__list">
              {Object.keys(editableDisciplinas).length === 0 ? (
                <p className="disc-editor__empty">
                  Nenhuma disciplina extraída — adicione manualmente abaixo
                </p>
              ) : (
                Object.keys(editableDisciplinas).map((disc) => (
                  <div key={disc} className="disc-editor__item">
                    <span className="disc-editor__item-name">{disc}</span>
                    <button
                      className="disc-editor__item-remove"
                      onClick={() => handleRemoveDisciplina(disc)}
                      title="Remover"
                    >✕</button>
                  </div>
                ))
              )}
            </div>

            <div className="disc-editor__add-row">
              <input
                type="text"
                className="disc-editor__input"
                placeholder="Ex: Direito Tributário"
                value={newDiscName}
                onChange={(e) => setNewDiscName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDisciplina()}
              />
              <button
                className="disc-editor__add-btn"
                onClick={handleAddDisciplina}
                disabled={!newDiscName.trim()}
              >
                + Adicionar
              </button>
            </div>
          </div>

          {/* ── Configurações ── */}
          <div className="quick-setup">
            <h3 className="quick-setup__title">Configure seu plano</h3>

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
              disabled={wizardLoading || !quickExamDate || quickAvailDays.length === 0 || Object.keys(editableDisciplinas).length === 0}
            >
              {wizardLoading ? '⏳ Gerando plano...' : '🚀 Gerar Plano de Estudos'}
            </button>

            {Object.keys(editableDisciplinas).length === 0 && (
              <p className="disc-editor__warning">
                ⚠️ Adicione pelo menos uma disciplina para gerar o plano
              </p>
            )}

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
