import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../store/documentStore';
import { useStudyContext } from '../store/studyContextStore';
import {
  usePlanTaskStore,
  DAY_NAMES,
  getDateForDayOfWeek,
  getTodayDayOfWeek,
  type PlanTask,
} from '../store/planTaskStore';
import { useSelectedTask } from '../store/selectedTaskStore';
import api from '../api/client';
import './EstudosPage.css';
import './PlanoPage.css';

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

type UploadMode = 'edital' | 'plano' | null;
type PlanView = 'kanban' | 'calendar';

interface UploadNotice {
  type: 'success' | 'error';
  message: string;
  detail?: string;
}

// ── Kanban sub-components ─────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  study: '📚',
  review: '🔄',
  quiz: '❓',
};

const PRIORITY_COLOR: Record<number, string> = {
  5: '#ef4444',
  4: '#f97316',
  3: '#eab308',
  2: '#84cc16',
  1: '#10b981',
};

interface KanbanCardProps {
  task: PlanTask;
  onToggle: (id: number) => void;
  onSelect: (task: PlanTask) => void;
  isSelectedForPomodoro: boolean;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ task, onToggle, onSelect, isSelectedForPomodoro }) => (
  <div
    className={[
      'plan-card',
      task.completed ? 'plan-card--done' : '',
      isSelectedForPomodoro ? 'plan-card--active' : '',
      `plan-card--${task.type}`,
    ].filter(Boolean).join(' ')}
  >
    <div className="plan-card__top">
      <button
        className="plan-card__check"
        onClick={() => onToggle(task.id)}
        title={task.completed ? 'Desmarcar' : 'Marcar como concluído'}
      >
        {task.completed ? '✓' : '○'}
      </button>
      <div className="plan-card__body" onClick={() => onSelect(task)}>
        <span className="plan-card__type-icon">{TYPE_ICON[task.type]}</span>
        <span className="plan-card__title">{task.title}</span>
      </div>
      <div
        className="plan-card__priority-dot"
        style={{ background: PRIORITY_COLOR[task.priority] ?? '#888' }}
        title={`Prioridade ${task.priority}`}
      />
    </div>
    <div className="plan-card__meta">
      <span className="plan-card__time">{task.estimated_minutes}min</span>
      <div className="plan-card__pomos">
        {Array.from({ length: task.pomodoros_est }, (_, i) => (
          <span key={i} className={`pomo-dot ${i < task.pomodoros_done ? 'pomo-dot--done' : ''}`}>🍅</span>
        ))}
      </div>
    </div>
    {isSelectedForPomodoro && <div className="plan-card__active-badge">▶ No timer</div>}
  </div>
);

interface KanbanViewProps {
  tasks: PlanTask[];
  weekStart: string | null;
  selectedId: number | null;
  onToggle: (id: number) => void;
  onSelect: (task: PlanTask) => void;
}

const KanbanView: React.FC<KanbanViewProps> = ({ tasks, weekStart, selectedId, onToggle, onSelect }) => {
  const today = new Date().toISOString().split('T')[0];
  const todayDow = getTodayDayOfWeek();
  return (
    <div className="kanban-board">
      {DAY_NAMES.map((name, idx) => {
        const dayDate = getDateForDayOfWeek(idx, weekStart);
        const isToday = idx === todayDow;
        const isPast = dayDate < today && !isToday;
        const dayTasks = tasks.filter(t => t.day_of_week === idx).sort((a, b) => a.position - b.position);
        const done = dayTasks.filter(t => t.completed).length;
        const total = dayTasks.length;
        return (
          <div
            key={name}
            className={['kanban-col', isToday ? 'kanban-col--today' : '', isPast ? 'kanban-col--past' : ''].filter(Boolean).join(' ')}
          >
            <div className="kanban-col__header">
              <div className="kanban-col__title-row">
                <span className="kanban-col__name">{name}</span>
                {isToday && <span className="kanban-col__today-badge">HOJE</span>}
              </div>
              <div className="kanban-col__date-row">
                <span className="kanban-col__date">
                  {new Date(dayDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
                {total > 0 && <span className="kanban-col__count">{done}/{total}</span>}
              </div>
              {total > 0 && (
                <div className="kanban-col__progress">
                  <div className="kanban-col__progress-fill" style={{ width: `${(done / total) * 100}%` }} />
                </div>
              )}
            </div>
            <div className="kanban-col__tasks">
              {dayTasks.length === 0 ? (
                <p className="kanban-col__empty">Dia livre</p>
              ) : (
                dayTasks.map(task => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onToggle={onToggle}
                    onSelect={onSelect}
                    isSelectedForPomodoro={task.id === selectedId}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const START_HOUR = 7;
const END_HOUR = 21;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);

function minutesToTop(minutes: number): number {
  return (minutes / TOTAL_MINUTES) * 100;
}
function minutesToHeight(minutes: number): number {
  return Math.max((minutes / TOTAL_MINUTES) * 100, 3);
}
function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

interface CalendarViewProps {
  tasks: PlanTask[];
  weekStart: string | null;
  selectedId: number | null;
  onSelect: (task: PlanTask) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, weekStart, selectedId, onSelect }) => {
  const todayDow = getTodayDayOfWeek();
  const activeDays = DAY_NAMES.map((name, idx) => {
    const dayDate = getDateForDayOfWeek(idx, weekStart);
    const dayTasks = tasks.filter(t => t.day_of_week === idx).sort((a, b) => a.position - b.position);
    return { name, idx, dayDate, dayTasks };
  }).filter(d => d.dayTasks.length > 0);

  if (activeDays.length === 0) {
    return <p className="plano-empty-msg">Nenhuma tarefa no plano desta semana.</p>;
  }

  return (
    <div className="calendar-view">
      <div className="calendar-grid" style={{ gridTemplateColumns: `56px repeat(${activeDays.length}, 1fr)` }}>
        <div className="cal-corner" />
        {activeDays.map(({ name, idx, dayDate }) => (
          <div key={idx} className={['cal-day-header', idx === todayDow ? 'cal-day-header--today' : ''].filter(Boolean).join(' ')}>
            <span className="cal-day-header__name">{name}</span>
            <span className="cal-day-header__date">
              {new Date(dayDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
            {idx === todayDow && <span className="cal-day-header__badge">HOJE</span>}
          </div>
        ))}
        <div className="cal-times">
          {HOURS.map(h => (
            <div key={h} className="cal-time-slot">{formatTime(h, 0)}</div>
          ))}
        </div>
        {activeDays.map(({ idx, dayTasks }) => {
          let cumMinutes = 60;
          return (
            <div key={idx} className="cal-day-col">
              <div className="cal-day-body">
                {dayTasks.map(task => {
                  const top = minutesToTop(cumMinutes);
                  const height = minutesToHeight(task.estimated_minutes);
                  const startH = START_HOUR + Math.floor(cumMinutes / 60);
                  const startM = cumMinutes % 60;
                  cumMinutes += task.estimated_minutes + 5;
                  return (
                    <div
                      key={task.id}
                      className={[
                        'cal-event',
                        task.completed ? 'cal-event--done' : '',
                        task.id === selectedId ? 'cal-event--active' : '',
                        `cal-event--${task.type}`,
                      ].filter(Boolean).join(' ')}
                      style={{ top: `${top}%`, height: `${height}%` }}
                      onClick={() => onSelect(task)}
                      title={`${task.title} — ${formatTime(startH, startM)}`}
                    >
                      <span className="cal-event__time">{formatTime(startH, startM)}</span>
                      <span className="cal-event__title">{task.title}</span>
                      <span className="cal-event__icon">{TYPE_ICON[task.type]}</span>
                    </div>
                  );
                })}
                {HOURS.map(h => (
                  <div key={h} className="cal-hour-line" style={{ top: `${minutesToTop((h - START_HOUR) * 60)}%` }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const EstudosPage: React.FC = () => {
  const navigate = useNavigate();
  const { uploadFile, isIndexing } = useDocumentStore();
  const { context, fetchContext, updateContext } = useStudyContext();
  const {
    tasks,
    weekStart,
    generatedAt,
    concurso: planConcurso,
    toggleComplete,
    generateFromSchedule,
  } = usePlanTaskStore();
  const { selectedTask, select } = useSelectedTask();

  const [uploadMode, setUploadMode] = useState<UploadMode>(null);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
  const [selectedCargo, setSelectedCargo] = useState<string | null>(null);
  const [showCargoSelection, setShowCargoSelection] = useState(false);
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any | null>(null);
  const [autoGeneratePlan, setAutoGeneratePlan] = useState(false);
  const [planView, setPlanView] = useState<PlanView>('kanban');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  useEffect(() => {
    if (context.available_cargos.length > 1 && !context.cargo) {
      setShowCargoSelection(true);
    }
  }, [context.available_cargos, context.cargo]);

  useEffect(() => {
    if (autoGeneratePlan && context.cargo) {
      setAutoGeneratePlan(false);
      void handleGenerateAIPlan();
    }
  }, [autoGeneratePlan, context.cargo]); // eslint-disable-line react-hooks/exhaustive-deps

  const showNotice = (n: UploadNotice, durationMs = 6000) => {
    setNotice(n);
    setTimeout(() => setNotice(null), durationMs);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const result = await uploadFile(file, undefined, undefined, uploadMode ?? undefined);
      if (uploadMode === 'edital') {
        await fetchContext();
        const edital = result?.edital_info;
        const requiresCargo = result?.requires_cargo_selection;
        
        if (edital?.concurso) {
          showNotice({
            type: 'success',
            message: `✅ Edital importado: ${edital.concurso}`,
            detail: `${edital.cargos?.length || 0} cargos · ${Object.keys(edital.disciplinas || {}).length} disciplinas detectadas`,
          }, 8000);
          
          // Se requer seleção de cargo, mostrar tela de seleção
          if (requiresCargo) {
            setShowCargoSelection(true);
          } else {
            // Cargo único, gerar plano automaticamente após breve pausa
            showNotice({ 
              type: 'success', 
              message: '🎯 Gerando plano de estudos personalizado...', 
              detail: 'Aguarde enquanto preparamos seu cronograma' 
            }, 3000);
            setTimeout(() => setAutoGeneratePlan(true), 500);
          }
        } else {
          showNotice({ type: 'success', message: '✅ Edital importado. Verifique os dados acima.' });
        }
      } else if (uploadMode === 'plano') {
        showNotice({ type: 'success', message: '✅ Plano de estudo importado!' });
        await fetchContext();
      }
    } catch {
      showNotice({ type: 'error', message: '❌ Erro ao enviar o arquivo. Tente novamente.' });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, mode: UploadMode) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file?.name.endsWith('.pdf')) return;
    setUploadMode(mode);
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = fileInputRef.current;
    if (input) {
      input.files = dt.files;
      handleFileSelect({ target: input, currentTarget: input } as any);
    }
  };

  const handleSelectCargo = async (cargo: string) => {
    setSelectedCargo(cargo);
    await updateContext({ cargo });
    await fetchContext();
    setShowCargoSelection(false);
    showNotice({ 
      type: 'success', 
      message: `✅ Cargo selecionado: ${cargo}`, 
      detail: 'Gerando plano de estudos personalizado...' 
    }, 3000);
    setTimeout(() => setAutoGeneratePlan(true), 500);
  };

  const handleGenerateAIPlan = async () => {
    setAiPlanLoading(true);
    setGeneratedPlan(null);
    try {
      const concurso = context.concurso || 'Concurso Público';
      const cargo    = context.cargo    || 'Candidato';
      const banca    = context.banca    || 'CESPE';
      const examDate = context.exam_date
        ? context.exam_date.split('T')[0]
        : new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0];

      // Monta prompt com dados reais do edital
      const subjectList = context.subjects.length > 0
        ? context.subjects.join(', ')
        : 'Conhecimentos Específicos, Língua Portuguesa, Raciocínio Lógico';

      const weightsStr = Object.keys(context.subject_weights).length > 0
        ? Object.entries(context.subject_weights)
            .map(([s, w]) => `${s}(peso ${w})`)
            .join(', ')
        : '';

      const weakSubjects  = context.performances.filter(p => p.accuracy < 50).map(p => p.subject);
      const strongSubjects = context.performances.filter(p => p.accuracy >= 70).map(p => p.subject);

      let prompt = `Gerar plano de estudos para ${concurso}, cargo ${cargo}, banca ${banca}, prova em ${examDate}. `;
      prompt += `Disciplinas do edital: ${subjectList}. `;
      if (weightsStr) prompt += `Pesos por disciplina: ${weightsStr}. `;
      if (weakSubjects.length > 0)  prompt += `Matérias com dificuldade: ${weakSubjects.join(', ')}. `;
      if (strongSubjects.length > 0) prompt += `Matérias dominadas: ${strongSubjects.join(', ')}. `;
      prompt += `Horas diárias disponíveis: ${context.daily_study_hours || 4}.`;

      const res = await api.post('/planner/quick-plan', {
        prompt,
        concurso,
        cargo,
        banca,
        exam_date: examDate,
        daily_hours: context.daily_study_hours || 4,
        available_days: context.available_days?.length > 0 ? context.available_days : [0, 1, 2, 3, 4],
      });
      const plan = res.data;
      setGeneratedPlan(plan);
      await fetchContext();

      const updatedCtx = await api.get('/study-context').then(r => r.data).catch(() => null);
      const schedule = updatedCtx?.weekly_schedule ?? [];
      const performances = updatedCtx?.performances ?? [];
      
      let tasksCreated = 0;
      if (schedule.length > 0) {
        generateFromSchedule(schedule, performances, plan.concurso ?? context.concurso);
        // Conta quantas tarefas foram criadas
        tasksCreated = schedule.reduce((acc: number, s: { subjects?: unknown[] }) => acc + (s.subjects?.length || 0), 0);
      }

      if (plan.weekly_schedule) {
        const concursoLabel = plan.concurso || context.concurso || 'Plano de Estudos';
        const stored = JSON.parse(localStorage.getItem('pomodoro-task-templates') || '[]');
        for (const [day, subjects] of Object.entries(plan.weekly_schedule as Record<string, string[]>)) {
          const tplName = `${concursoLabel} — ${day}`;
          const taskList = (subjects as string[]).map(s => `Estudar: ${s}`);
          const tpl = { id: `plan-${day}-${Date.now()}`, name: tplName, tasks: taskList };
          const idx = stored.findIndex((t: { name: string }) => t.name === tplName);
          if (idx >= 0) stored[idx] = tpl; else stored.push(tpl);
        }
        localStorage.setItem('pomodoro-task-templates', JSON.stringify(stored));
        
        showNotice({ 
          type: 'success', 
          message: `✅ Plano gerado com sucesso!`, 
          detail: `${tasksCreated} tarefas criadas para "${concursoLabel}". Role para baixo para ver o cronograma semanal.` 
        }, 8000);
        
        // Scroll suave para a seção de tarefas após um pequeno delay
        setTimeout(() => {
          const planSection = document.querySelector('.estudos-plan-section');
          if (planSection) {
            planSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      } else {
        showNotice({ type: 'success', message: '✅ Plano de estudos gerado com IA!' }, 5000);
      }
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showNotice({ 
        type: 'error', 
        message: '❌ Erro ao gerar plano', 
        detail: detail || 'Verifique se o edital está ativo e se há um provedor de IA configurado.' 
      });
    } finally {
      setAiPlanLoading(false);
    }
  };

  const handleSelectTask = (task: PlanTask) => {
    if (selectedTask?.id === task.id) {
      select(null);
    } else {
      select({
        id: task.id,
        title: task.title,
        estPomo: task.pomodoros_est,
        actualPomo: task.pomodoros_done,
        subjectId: null,
      });
      navigate('/');
    }
  };

  const triggerUpload = (mode: UploadMode) => {
    setUploadMode(mode);
    fileInputRef.current?.click();
  };

  const renderUploadZone = (mode: 'edital', title: string, description: string, icon: string) => {
    const active = isIndexing && uploadMode === mode;
    return (
      <div className="upload-card">
        <div className="upload-icon">{icon}</div>
        <h3>{title}</h3>
        <p>{description}</p>
        <div
          className={`drop-zone ${active ? 'indexing' : ''}`}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, mode)}
          onClick={() => !active && triggerUpload(mode)}
        >
          {active ? '⏳ Analisando com IA...' : '📎 Arraste o PDF ou clique'}
        </div>
      </div>
    );
  };

  // Cargo selection screen
  if (showCargoSelection) {
    return (
      <div className="estudos-page">
        <div className="cargo-selection">
          <h2>Escolha seu Cargo</h2>
          <p>O edital contém múltiplos cargos. Selecione o cargo que você deseja estudar:</p>
          <div className="cargo-list">
            {context.available_cargos.map(cargo => (
              <button
                key={cargo}
                className={`cargo-btn ${selectedCargo === cargo ? 'selected' : ''}`}
                onClick={() => handleSelectCargo(cargo)}
              >
                {cargo}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const daysLeft = daysUntil(context.exam_date);
  const todayDow = getTodayDayOfWeek();
  const todayTasks = tasks.filter(t => t.day_of_week === todayDow);
  const weekDone = tasks.filter(t => t.completed).length;
  const weekTotal = tasks.length;

  return (
    <div className="estudos-page">
      <input type="file" accept=".pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />

      <header className="estudos-header">
        <h1>📚 Estudos</h1>
        <p>Central de importação e organização de conteúdos</p>
      </header>

      {notice && (
        <div className={`upload-notice upload-notice--${notice.type}`}>
          <strong>{notice.message}</strong>
          {notice.detail && <span>{notice.detail}</span>}
        </div>
      )}

      {aiPlanLoading && (
        <div className="upload-notice upload-notice--info" style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <strong>🤖 Gerando plano de estudos com IA...</strong>
          <span>Analisando edital, disciplinas e criando cronograma personalizado</span>
        </div>
      )}

      {!context.edital_active ? (
        <div className="estudos-onboarding">
          <div className="onboarding-message">
            <h2>Comece importando um edital</h2>
            <p>A IA vai extrair automaticamente:</p>
            <ul>
              <li>✓ Nome do concurso</li>
              <li>✓ Banca organizadora</li>
              <li>✓ Cargos disponíveis</li>
              <li>✓ Disciplinas e pesos</li>
              <li>✓ Data da prova</li>
            </ul>
          </div>
          {renderUploadZone('edital', 'Importar Edital', 'PDF do edital oficial do concurso', '📋')}
        </div>
      ) : (
        <div className="estudos-content">

          {/* Edital ativo */}
          <div className="edital-info-card">
            <div className="edital-info-card__header">
              <h3>📋 Edital Ativo</h3>
              <button
                className="btn-reupload"
                onClick={() => triggerUpload('edital')}
                disabled={isIndexing && uploadMode === 'edital'}
              >
                {isIndexing && uploadMode === 'edital' ? '⏳' : '↩ Substituir'}
              </button>
            </div>
            <div className="edital-details">
              <div className="detail-item">
                <span className="detail-label">Concurso</span>
                <span className="detail-value">{context.concurso || <em>—</em>}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Cargo</span>
                <span className="detail-value">{context.cargo || <em>—</em>}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Banca</span>
                <span className="detail-value">{context.banca || <em>—</em>}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Prova</span>
                <span className="detail-value">
                  {context.exam_date ? new Date(context.exam_date).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Plano de Estudos ── */}
          <div className="estudos-plan-section">
            <div className="estudos-plan-header">
              <h3 className="estudos-plan-title">📅 Plano de Estudos</h3>
              {daysLeft !== null && (
                <div className={`estudos-countdown ${daysLeft <= 30 ? 'estudos-countdown--urgent' : ''}`}>
                  <span className="estudos-countdown__number">{daysLeft}</span>
                  <span className="estudos-countdown__label">dias para a prova</span>
                </div>
              )}
            </div>

            {tasks.length === 0 ? (
              <div className="estudos-plan-empty">
                <p>Nenhum cronograma gerado ainda.</p>
                <div className="estudos-plan-empty-actions">
                  <button
                    className="btn-ai-plan"
                    onClick={handleGenerateAIPlan}
                    disabled={aiPlanLoading}
                    style={{ maxWidth: 260 }}
                  >
                    {aiPlanLoading ? '⏳ Gerando plano...' : '✨ Gerar cronograma com IA'}
                  </button>
                  <div
                    className="drop-zone drop-zone--secondary"
                    style={{ marginTop: 0 }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(e, 'plano')}
                    onClick={() => !(isIndexing && uploadMode === 'plano') && triggerUpload('plano')}
                  >
                    {isIndexing && uploadMode === 'plano' ? '⏳ Importando...' : '📎 Importar PDF de plano'}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Header com stats + view toggle */}
                <div className="plano-header" style={{ padding: '12px 0 10px', border: 'none', background: 'none', marginBottom: 4 }}>
                  <div className="plano-header__left">
                    {planConcurso && <span className="plano-header__concurso">{planConcurso}</span>}
                    {generatedAt && (
                      <span className="plano-header__generated">
                        Gerado em {new Date(generatedAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  <div className="plano-header__right">
                    <div className="plano-mini-stats">
                      <div className="plano-mini-stat">
                        <span className="plano-mini-stat__value">{todayTasks.filter(t => t.completed).length}/{todayTasks.length}</span>
                        <span className="plano-mini-stat__label">Hoje</span>
                      </div>
                      <div className="plano-mini-stat">
                        <span className="plano-mini-stat__value">{weekDone}/{weekTotal}</span>
                        <span className="plano-mini-stat__label">Semana</span>
                      </div>
                    </div>
                    <div className="view-toggle">
                      <button
                        className={`view-toggle__btn ${planView === 'kanban' ? 'view-toggle__btn--active' : ''}`}
                        onClick={() => setPlanView('kanban')}
                      >
                        ▦ Kanban
                      </button>
                      <button
                        className={`view-toggle__btn ${planView === 'calendar' ? 'view-toggle__btn--active' : ''}`}
                        onClick={() => setPlanView('calendar')}
                      >
                        📅 Calendário
                      </button>
                    </div>
                  </div>
                </div>

                {/* Barra de progresso semanal */}
                {weekTotal > 0 && (
                  <div className="plano-week-progress">
                    <div className="plano-week-progress__bar">
                      <div className="plano-week-progress__fill" style={{ width: `${(weekDone / weekTotal) * 100}%` }} />
                    </div>
                    <span className="plano-week-progress__label">
                      {weekDone} de {weekTotal} concluídas ({Math.round((weekDone / weekTotal) * 100)}%)
                    </span>
                  </div>
                )}

                {/* Banner task selecionada */}
                {selectedTask && (
                  <div className="plano-selected-banner">
                    <span>▶ No Pomodoro: <strong>{selectedTask.title}</strong></span>
                    <button onClick={() => select(null)}>✕ Remover</button>
                  </div>
                )}

                {/* Kanban ou Calendário */}
                {planView === 'kanban' ? (
                  <KanbanView
                    tasks={tasks}
                    weekStart={weekStart}
                    selectedId={selectedTask?.id ?? null}
                    onToggle={toggleComplete}
                    onSelect={handleSelectTask}
                  />
                ) : (
                  <CalendarView
                    tasks={tasks}
                    weekStart={weekStart}
                    selectedId={selectedTask?.id ?? null}
                    onSelect={handleSelectTask}
                  />
                )}

                {/* Rodapé */}
                <div className="plano-footer">
                  <button
                    className="plano-footer__btn"
                    onClick={handleGenerateAIPlan}
                    disabled={aiPlanLoading}
                  >
                    {aiPlanLoading ? '⏳ Gerando...' : '↺ Regerar plano'}
                  </button>
                  <span className="plano-footer__hint">
                    Clique em uma tarefa para selecioná-la no Pomodoro
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Plano gerado (feedback pós-geração) */}
          {generatedPlan && (
            <div className="generated-plan">
              <h3>📅 Plano Gerado</h3>
              <div className="plan-stats">
                <span><strong>{generatedPlan.days_until_exam}</strong> dias até a prova</span>
                <span><strong>{generatedPlan.total_study_hours}h</strong> total de estudo</span>
                <span><strong>{generatedPlan.topics?.length || 0}</strong> tópicos</span>
              </div>
              {generatedPlan.weekly_schedule && (
                <div className="plan-week">
                  {Object.entries(generatedPlan.weekly_schedule as Record<string, string[]>).map(([day, subjects]) => (
                    <div key={day} className="plan-day">
                      <span className="plan-day__label">{day}</span>
                      <span className="plan-day__subjects">{(subjects as string[]).join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default EstudosPage;
