import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore, DocumentOut } from '../store/documentStore';
import './DocumentsPage.css';

const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    documents, indexingResults, isLoading, isIndexing, error,
    fetchDocuments, indexFile, scanDirectory, deleteDocument,
  } = useDocumentStore();

  const [dirPath, setDirPath] = useState('');
  const [filterConcurso, setFilterConcurso] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.pdf')) {
      // In Tauri we'd get the full path; in browser we just index the name
      indexFile(file.name);
    }
  };

  const uniqueConcursos = [...new Set(documents.map(d => d.concurso).filter(Boolean))] as string[];

  const filtered = filterConcurso
    ? documents.filter(d => d.concurso === filterConcurso)
    : documents;

  return (
    <div className="docs-page">
      <header className="docs-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Voltar</button>
        <h1>📂 Documentos de Estudo</h1>
      </header>

      <div className="docs-content">
        {/* Drop zone */}
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
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) indexFile(f.name);
            }}
          />
          {isIndexing ? '⏳ Indexando…' : '📎 Arraste um PDF ou clique para selecionar'}
        </div>

        {/* Directory scan */}
        <div className="scan-row">
          <input
            className="scan-input"
            placeholder="Caminho da pasta (ex: C:/docs ou /home/user/docs)"
            value={dirPath}
            onChange={e => setDirPath(e.target.value)}
          />
          <button
            className="scan-btn"
            disabled={!dirPath || isIndexing}
            onClick={() => { scanDirectory(dirPath); setDirPath(''); }}
          >
            {isIndexing ? 'Indexando…' : '🔍 Indexar Pasta'}
          </button>
        </div>

        {/* Last indexing results */}
        {indexingResults.length > 0 && (
          <div className="indexing-results">
            {indexingResults.slice(0, 3).map((r, i) => (
              <div key={i} className={`result-badge ${r.status}`}>
                {r.status === 'indexed' ? '✅' : '❌'} {r.filename} — {r.message}
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        {uniqueConcursos.length > 1 && (
          <div className="filter-row">
            <button
              className={`filter-btn ${!filterConcurso ? 'active' : ''}`}
              onClick={() => setFilterConcurso('')}
            >Todos</button>
            {uniqueConcursos.map(c => (
              <button
                key={c}
                className={`filter-btn ${filterConcurso === c ? 'active' : ''}`}
                onClick={() => setFilterConcurso(c)}
              >{c}</button>
            ))}
          </div>
        )}

        {/* Documents list */}
        {isLoading ? (
          <div className="docs-loading">Carregando documentos…</div>
        ) : filtered.length === 0 ? (
          <div className="docs-empty">
            <p>Nenhum documento indexado ainda.</p>
            <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>
              Organize seus PDFs em: docs/concurso/disciplina/arquivo.pdf
            </p>
          </div>
        ) : (
          <div className="docs-grid">
            {filtered.map((doc: DocumentOut) => (
              <div key={doc.id} className={`doc-card doc-type-${doc.doc_type}`}>
                <div className="doc-icon">
                  {doc.doc_type === 'edital' ? '📋' : doc.doc_type === 'questoes' ? '📝' : '📄'}
                </div>
                <div className="doc-info">
                  <div className="doc-name" title={doc.file_path}>{doc.filename}</div>
                  <div className="doc-meta">
                    {doc.concurso && <span className="doc-tag">{doc.concurso}</span>}
                    {doc.disciplina && <span className="doc-tag">{doc.disciplina}</span>}
                    {doc.page_count && <span className="doc-pages">{doc.page_count}p</span>}
                    {doc.file_size_kb && <span className="doc-size">{doc.file_size_kb}KB</span>}
                  </div>
                </div>
                <button
                  className="doc-delete"
                  onClick={() => deleteDocument(doc.id)}
                  title="Remover"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {error && <div className="docs-error">{error}</div>}
      </div>
    </div>
  );
};

export default DocumentsPage;
