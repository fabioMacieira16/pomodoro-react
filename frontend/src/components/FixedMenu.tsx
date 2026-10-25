import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { APP_LABEL, APP_NAME, APP_TAGLINE } from '../appInfo';

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
      <div className="app-title" title={`${APP_NAME} — ${APP_TAGLINE}`}>
        <span className="app-title-name">{APP_NAME}</span>
        <span className="app-title-label">{APP_LABEL}</span>
      </div>

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