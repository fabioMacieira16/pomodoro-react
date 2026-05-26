import React, { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { useStudyContext } from '../store/studyContextStore';
import MindMap, { MindMapNodeData } from '../components/MindMap/MindMap';
import api from '../api/client';
import './EstudosPage.css';
import '../components/MindMap/MindMap.css';

type UploadMode = 'edital' | 'conteudo' | 'plano' | null;

interface UploadNotice {
  type: 'success' | 'error';
  message: string;
  detail?: string;
}

const EstudosPage: React.FC = () => {
  const { uploadFile, isIndexing, documents, fetchDocuments } = useDocumentStore();
  const { context, fetchContext, updateContext } = useStudyContext();

  const [uploadMode, setUploadMode] = useState<UploadMode>(null);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
  const [selectedCargo, setSelectedCargo] = useState<string | null>(null);
  const [showCargoSelection, setShowCargoSelection] = useState(false);
  const [mindMapData, setMindMapData] = useState<{ root: MindMapNodeData; subject: string; totalNodes: number } | null>(null);
  const [mindMapLoading, setMindMapLoading] = useState<string | null>(null);
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchContext();
    fetchDocuments();
  }, [fetchContext, fetchDocuments]);

  useEffect(() => {
    if (context.available_cargos.length > 1 && !context.cargo) {
      setShowCargoSelection(true);
    }
  }, [context.available_cargos, context.cargo]);

  const showNotice = (n: UploadNotice, durationMs = 6000) => {
    setNotice(n);
    setTimeout(() => setNotice(null), durationMs);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be selected again
    e.target.value = '';

    try {
      const result = await uploadFile(file, undefined, undefined, uploadMode ?? undefined);

      if (uploadMode === 'edital') {
        // Context is updated server-side during upload â€” fetch immediately
        await fetchContext();
        const edital = result?.edital_info;
        if (edital?.concurso) {
          showNotice({
            type: 'success',
            message: `âœ… Edital importado: ${edital.concurso}`,
            detail: `${edital.cargos?.length || 0} cargos Â· ${Object.keys(edital.disciplinas || {}).length} disciplinas detectadas`,
          }, 8000);
        } else {
          showNotice({ type: 'success', message: 'âœ… Edital importado. Verifique os dados acima.' });
        }
      } else if (uploadMode === 'conteudo') {
        const indexing = result?.indexing;
        const disciplina = indexing?.disciplina || indexing?.filename?.replace('.pdf', '');
        showNotice({
          type: 'success',
          message: `âœ… ConteÃºdo indexado: ${disciplina || file.name}`,
          detail: indexing?.message || 'Arquivo processado com sucesso',
        });
        await fetchDocuments();
      } else if (uploadMode === 'plano') {
        showNotice({ type: 'success', message: 'âœ… Plano de estudo importado!' });
        await fetchContext();
      }
    } catch (err) {
      showNotice({ type: 'error', message: 'âŒ Erro ao enviar o arquivo. Tente novamente.' });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, mode: UploadMode) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file?.name.endsWith('.pdf')) return;
    setUploadMode(mode);
    // synthetic trigger
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
    setShowCargoSelection(false);
  };

  const handleGenerateMindMap = async (subjectName: string) => {
    setMindMapLoading(subjectName);
    try {
      const res = await api.post('/mindmap/generate', { subject_name: subjectName, depth: 3 });
      setMindMapData({ root: res.data.root, subject: res.data.subject, totalNodes: res.data.total_nodes });
    } catch (err) {
      showNotice({ type: 'error', message: 'âŒ Erro ao gerar mapa mental.' });
    } finally {
      setMindMapLoading(null);
    }
  };

  const handleGenerateAIPlan = async () => {
    setAiPlanLoading(true);
    setGeneratedPlan(null);
    try {
      const res = await api.post('/planner/quick-plan', {
        concurso: context.concurso || 'Concurso PÃºblico',
        cargo: context.cargo || 'Analista',
        banca: context.banca || 'CESPE',
        exam_date: context.exam_date
          ? context.exam_date.split('T')[0]
          : new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
      });
      setGeneratedPlan(res.data);
      await fetchContext();
      showNotice({ type: 'success', message: 'âœ… Plano de estudos gerado com IA!' }, 5000);
    } catch (err) {
      showNotice({ type: 'error', message: 'âŒ Erro ao gerar plano. Verifique o edital ativo.' });
    } finally {
      setAiPlanLoading(false);
    }
  };

  const triggerUpload = (mode: UploadMode) => {
    setUploadMode(mode);
    fileInputRef.current?.click();
  };

  // â”€â”€ Upload zone helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderUploadZone = (mode: 'edital' | 'conteudo', title: string, description: string, icon: string) => {
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
          {active ? 'â³ Analisando com IA...' : 'ðŸ“Ž Arraste o PDF ou clique'}
        </div>
      </div>
    );
  };

  // â”€â”€ SeleÃ§Ã£o de cargo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (showCargoSelection) {
    return (
      <div className="estudos-page">
        <div className="cargo-selection">
          <h2>Escolha seu Cargo</h2>
          <p>O edital contÃ©m mÃºltiplos cargos. Selecione o cargo que vocÃª deseja estudar:</p>
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

  // â”€â”€ ConteÃºdos indexados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const contentDocs = documents.filter(d => d.doc_type === 'conteudo' || d.doc_type === 'material');

  return (
    <div className="estudos-page">
      <input type="file" accept=".pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />

      <header className="estudos-header">
        <h1>📚 Estudos</h1>
        <p>Central de importação e organização de conteúdos</p>
      </header>

      {/* ── Notificação ── */}
      {notice && (
        <div className={`upload-notice upload-notice--${notice.type}`}>
          <strong>{notice.message}</strong>
          {notice.detail && <span>{notice.detail}</span>}
        </div>
      )}

      {!context.edital_active ? (
        /* â”€â”€ ONBOARDING â”€â”€ */
        <div className="estudos-onboarding">
          <div className="onboarding-message">
            <h2>Comece importando um edital</h2>
            <p>A IA vai extrair automaticamente:</p>
            <ul>
              <li>âœ“ Nome do concurso</li>
              <li>âœ“ Banca organizadora</li>
              <li>âœ“ Cargos disponÃ­veis</li>
              <li>âœ“ Disciplinas e pesos</li>
              <li>âœ“ Data da prova</li>
            </ul>
          </div>
          {renderUploadZone('edital', 'Importar Edital', 'PDF do edital oficial do concurso', 'ðŸ“‹')}
        </div>
      ) : (
        /* â”€â”€ CONTEÃšDO PRINCIPAL â”€â”€ */
        <div className="estudos-content">

          {/* Edital ativo */}
          <div className="edital-info-card">
            <div className="edital-info-card__header">
              <h3>ðŸ“‹ Edital Ativo</h3>
              <button
                className="btn-reupload"
                onClick={() => triggerUpload('edital')}
                disabled={isIndexing && uploadMode === 'edital'}
              >
                {isIndexing && uploadMode === 'edital' ? 'â³' : 'â†© Substituir'}
              </button>
            </div>
            <div className="edital-details">
              <div className="detail-item">
                <span className="detail-label">Concurso</span>
                <span className="detail-value">{context.concurso || <em>â€”</em>}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Cargo</span>
                <span className="detail-value">{context.cargo || <em>â€”</em>}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Banca</span>
                <span className="detail-value">{context.banca || <em>â€”</em>}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Prova</span>
                <span className="detail-value">
                  {context.exam_date ? new Date(context.exam_date).toLocaleDateString('pt-BR') : 'â€”'}
                </span>
              </div>
            </div>
          </div>

          {/* Upload grid */}
          <div className="upload-grid">
            {/* Importar ConteÃºdo */}
            {renderUploadZone(
              'conteudo',
              'Importar ConteÃºdo',
              'PDF de matÃ©ria/disciplina. A IA detecta automaticamente a disciplina e assunto.',
              'ðŸ“–'
            )}

            {/* Plano de Estudo â€” import ou gerar com IA */}
            <div className="upload-card upload-card--plan">
              <div className="upload-icon">ðŸ“…</div>
              <h3>Plano de Estudo</h3>
              <p>Importe um PDF com cronograma ou deixe a IA gerar automaticamente com base no edital.</p>

              <button
                className="btn-ai-plan"
                onClick={handleGenerateAIPlan}
                disabled={aiPlanLoading}
              >
                {aiPlanLoading ? 'â³ Gerando plano...' : 'âœ¨ Gerar com IA'}
              </button>

              <div
                className={`drop-zone drop-zone--secondary ${isIndexing && uploadMode === 'plano' ? 'indexing' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, 'plano')}
                onClick={() => !(isIndexing && uploadMode === 'plano') && triggerUpload('plano')}
              >
                {isIndexing && uploadMode === 'plano' ? 'â³ Importando...' : 'ðŸ“Ž Importar PDF de plano'}
              </div>
            </div>
          </div>

          {/* Plano gerado */}
          {generatedPlan && (
            <div className="generated-plan">
              <h3>ðŸ“… Plano Gerado</h3>
              <div className="plan-stats">
                <span><strong>{generatedPlan.days_until_exam}</strong> dias atÃ© a prova</span>
                <span><strong>{generatedPlan.total_study_hours}h</strong> total de estudo</span>
                <span><strong>{generatedPlan.topics?.length || 0}</strong> tÃ³picos</span>
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

          {/* ConteÃºdos indexados */}
          {contentDocs.length > 0 && (
            <div className="indexed-docs">
              <h3>ðŸ“ ConteÃºdos Indexados</h3>
              <div className="docs-list">
                {contentDocs.map(doc => (
                  <div key={doc.id} className="doc-item">
                    <span className="doc-icon">ðŸ“„</span>
                    <div className="doc-info">
                      <span className="doc-name">{doc.filename}</span>
                      {doc.disciplina && <span className="doc-disciplina">{doc.disciplina}</span>}
                    </div>
                    {doc.disciplina && context.subjects.includes(doc.disciplina) && (
                      <span className="doc-badge doc-badge--match">âœ“ Na grade</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disciplinas */}
          {context.subjects.length > 0 && (
            <div className="subjects-section">
              <h3>ðŸ“š Disciplinas</h3>
              <div className="subjects-grid">
                {context.subjects.map(subject => {
                  const perf = context.performances.find(p => p.subject === subject);
                  return (
                    <div key={subject} className={`subject-card priority-${perf?.priority || 3}`}>
                      <div className="subject-name">{subject}</div>
                      {perf && (
                        <div className="subject-stats">
                          <span className="accuracy">{perf.accuracy.toFixed(0)}%</span>
                          <span className="hours">{perf.study_hours}h</span>
                          <span className={`difficulty diff-${perf.difficulty_level}`}>
                            {perf.difficulty_level === 'easy' ? 'ðŸ˜Š' : perf.difficulty_level === 'medium' ? 'ðŸ˜' : 'ðŸ˜°'}
                          </span>
                        </div>
                      )}
                      <button
                        className="subject-mindmap-btn"
                        onClick={() => handleGenerateMindMap(subject)}
                        disabled={mindMapLoading === subject}
                        title="Gerar mapa mental"
                      >
                        {mindMapLoading === subject ? 'â³' : 'ðŸ—º'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Modal Mapa Mental â”€â”€ */}
      {mindMapData && (
        <div className="mm-overlay" onClick={() => setMindMapData(null)}>
          <div onClick={e => e.stopPropagation()}>
            <MindMap
              root={mindMapData.root}
              subject={mindMapData.subject}
              totalNodes={mindMapData.totalNodes}
              onClose={() => setMindMapData(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};


export default EstudosPage;
