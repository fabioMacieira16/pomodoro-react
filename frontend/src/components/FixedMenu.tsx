import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FixedMenu: React.FC = () => {
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen API may be unavailable in some environments.
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <header className="app-header">
      <div />
      <div className="header-actions">
        <button className="icon-btn" onClick={() => navigate('/dashboard')} title="Dashboard">
          📊
        </button>
        <button className="icon-btn" onClick={() => navigate('/anki')} title="Anki - Flashcards">
          🧠
        </button>
        <button className="icon-btn" onClick={() => navigate('/scheduler')} title="Planejador de Estudos">
          📅
        </button>
        <button className="icon-btn" onClick={() => navigate('/study-planner')} title="Planejador IA">
          📖
        </button>
        <button className="icon-btn" onClick={() => navigate('/')} title="Configurações">
          ⚙️
        </button>
        <button
          className={`icon-btn ${isFullscreen ? 'active' : ''}`}
          onClick={toggleFullscreen}
          title="Tela cheia (D)"
        >
          {isFullscreen ? '⊞' : '⛶'}
        </button>
      </div>
    </header>
  );
};

export default FixedMenu;