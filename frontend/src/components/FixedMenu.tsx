import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const FixedMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="app-header">
      <div />
      <div className="header-actions">
        <button
          className={`icon-btn ${isActive('/') ? 'active' : ''}`}
          onClick={() => navigate('/')}
          title="Pomodoro"
        >
          🍅
        </button>

        <button
          className={`icon-btn ${isActive('/dashboard') ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}
          title="Dashboard"
        >
          📊
        </button>

        <button
          className={`icon-btn ${isActive('/anki') ? 'active' : ''}`}
          onClick={() => navigate('/anki')}
          title="Revisões"
        >
          🧠
        </button>

        <button
          className={`icon-btn ${isActive('/estudos') ? 'active' : ''}`}
          onClick={() => navigate('/estudos')}
          title="Estudos"
        >
          📚
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