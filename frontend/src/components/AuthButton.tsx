import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthEnabled } from '../api/supabase';
import { useAuthStore } from '../store/authStore';

/** "Entrar" para visitantes e "Sair" para quem já tem sessão. */
const AuthButton: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();

  if (!isAuthEnabled) return null;

  if (!user) {
    return (
      <button className="auth-btn auth-btn-primary" onClick={() => navigate('/login')}>
        Entrar
      </button>
    );
  }

  return (
    <button className="auth-btn" onClick={() => void signOut()} title={`Conectado como ${user.email}`}>
      Sair
    </button>
  );
};

export default AuthButton;
