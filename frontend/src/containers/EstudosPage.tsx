import React, { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { useStudyContext } from '../store/studyContextStore';
import './EstudosPage.css';

type UploadMode = 'edital' | 'conteudo' | 'plano' | null;

const EstudosPage: React.FC = () => {
  const {
    uploadFile, isIndexing,
  } = useDocumentStore();

  const {
    context,
    updateContext,
    isLoading: contextLoading,
  } = useStudyContext();

  const [uploadMode, setUploadMode] = useState<UploadMode>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<string | null>(null);
  const [showCargoSelection, setShowCargoSelection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Mostra seleção de cargo se houver múltiplos cargos disponíveis
    if (context.available_cargos.length > 1 && !context.cargo) {
      setShowCargoSelection(true);
    }
  }, [context.available_cargos, context.cargo]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadFile(file);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);

      // Se foi edital, aguardar detecção automática
      if (uploadMode === 'edital') {
        // A IA vai processar automaticamente e retornar os cargos detectados
        setTimeout(() => {
          // Simular detecção (em produção virá do backend)
          // TODO: integrar com endpoint de análise de edital
        }, 2000);
      }
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.pdf')) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        handleFileSelect({ target: input } as any);
      }
    }
  };

  const handleSelectCargo = async (cargo: string) => {
    setSelectedCargo(cargo);
    await updateContext({ cargo });
    setShowCargoSelection(false);
    // Após escolher cargo, gerar plano automaticamente
    // TODO: chamar endpoint de geração de plano
  };

  const renderUploadZone = (mode: 'edital' | 'conteudo' | 'plano', title: string, description: string, icon: string) => (
    <div className="upload-card">
      <div className="upload-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      
      <div
        className={`drop-zone ${isIndexing && uploadMode === mode ? 'indexing' : ''} ${uploadSuccess && uploadMode === mode ? 'success' : ''}`}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => {
          setUploadMode(mode);
          fileInputRef.current?.click();
        }}
      >
        {uploadSuccess && uploadMode === mode ? (
          '✅ Arquivo enviado!'
        ) : isIndexing && uploadMode === mode ? (
          '⏳ Analisando com IA...'
        ) : (
          '📎 Arraste o PDF ou clique'
        )}
      </div>
    </div>
  );

  // Seleção de cargo
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

  // Tela principal de estudos
  return (
    <div className="estudos-page">
      <input
        type="file"
        accept=".pdf"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <header className="estudos-header">
        <h1>📚 Estudos</h1>
        <p>Central de importação e organização de conteúdos</p>
      </header>

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

          {renderUploadZone(
            'edital',
            'Importar Edital',
            'PDF do edital oficial do concurso',
            '📋'
          )}
        </div>
      ) : (
        <div className="estudos-content">
          {/* Informações do edital ativo */}
          <div className="edital-info-card">
            <h3>📋 Edital Ativo</h3>
            <div className="edital-details">
              <div className="detail-item">
                <span className="detail-label">Concurso:</span>
                <span className="detail-value">{context.concurso}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Cargo:</span>
                <span className="detail-value">{context.cargo}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Banca:</span>
                <span className="detail-value">{context.banca}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Prova:</span>
                <span className="detail-value">
                  {context.exam_date ? new Date(context.exam_date).toLocaleDateString('pt-BR') : 'Não definida'}
                </span>
              </div>
            </div>
          </div>

          {/* Upload adicional de conteúdos */}
          <div className="upload-grid">
            {renderUploadZone(
              'conteudo',
              'Importar Conteúdo',
              'PDF de matéria/disciplina específica. A IA vai detectar automaticamente a disciplina e assunto.',
              '📖'
            )}

            {renderUploadZone(
              'plano',
              'Importar Plano de Estudo',
              'PDF com cronograma de estudos, horários e metas.',
              '📅'
            )}
          </div>

          {/* Disciplinas organizadas */}
          {context.subjects.length > 0 && (
            <div className="subjects-section">
              <h3>📚 Disciplinas</h3>
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
                            {perf.difficulty_level === 'easy' ? '😊' : perf.difficulty_level === 'medium' ? '😐' : '😰'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EstudosPage;
