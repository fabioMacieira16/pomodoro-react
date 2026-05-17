/**
 * MindMap — Visualização hierárquica de mapa mental
 *
 * Renderiza uma árvore recursiva com nós coloridos por nível.
 * Suporta colapso/expansão de branches.
 */
import React, { useState } from 'react';
import './MindMap.css';

export interface MindMapNodeData {
  id: string;
  label: string;
  level: number;
  children: MindMapNodeData[];
  color?: string;
  importance: number;
}

interface MindMapNodeProps {
  node: MindMapNodeData;
  isRoot?: boolean;
}

const IMPORTANCE_ICONS = ['', '●', '◆', '★'];

const MindMapNode: React.FC<MindMapNodeProps> = ({ node, isRoot = false }) => {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div className={`mm-node mm-node--level-${node.level} ${isRoot ? 'mm-node--root' : ''}`}>
      <div
        className={`mm-node__label ${hasChildren ? 'mm-node__label--clickable' : ''}`}
        style={{ borderColor: node.color, '--node-color': node.color } as React.CSSProperties}
        onClick={() => hasChildren && setCollapsed(c => !c)}
      >
        <span className="mm-node__importance" style={{ color: node.color }}>
          {IMPORTANCE_ICONS[node.importance] || ''}
        </span>
        <span className="mm-node__text">{node.label}</span>
        {hasChildren && (
          <span className="mm-node__toggle">{collapsed ? '+' : '−'}</span>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div className="mm-node__children">
          {node.children.map(child => (
            <MindMapNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};

interface MindMapProps {
  root: MindMapNodeData;
  subject: string;
  totalNodes: number;
  onClose?: () => void;
}

const MindMap: React.FC<MindMapProps> = ({ root, subject, totalNodes, onClose }) => {
  return (
    <div className="mm-container">
      <div className="mm-header">
        <div>
          <h3 className="mm-title">🗺 {subject}</h3>
          <span className="mm-meta">{totalNodes} tópicos</span>
        </div>
        {onClose && (
          <button className="mm-close" onClick={onClose}>×</button>
        )}
      </div>

      <div className="mm-tree">
        <MindMapNode node={root} isRoot />
      </div>

      <div className="mm-legend">
        <span className="mm-legend__item"><span style={{ color: '#667eea' }}>★</span> Alta relevância</span>
        <span className="mm-legend__item"><span style={{ color: '#667eea' }}>◆</span> Média relevância</span>
        <span className="mm-legend__item"><span style={{ color: '#667eea' }}>●</span> Baixa relevância</span>
      </div>
    </div>
  );
};

export default MindMap;
