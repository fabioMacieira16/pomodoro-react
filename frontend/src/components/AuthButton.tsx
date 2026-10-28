import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthEnabled } from '../api/supabase';
import { useAuthStore } from '../store/authStore';

/** Nome completo (Google ou cadastro); sem ele, a parte do e-mail antes do @. */
function displayName(user: { name?: string; email: string }): string {
  return user.name?.trim() || user.email.split('@')[0];
}

/** "Entrar" para visitantes; nome da pessoa e "Sair" para quem já tem sessão. */
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
    <>
      <span className="auth-user" title={`Conectado como ${user.email}`}>
        {displayName(user)}
      </span>
      <button className="auth-btn" onClick={() => void signOut()}>
        Sair
      </button>
    </>
  );
};

export default AuthButton;
