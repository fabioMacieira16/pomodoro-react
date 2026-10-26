import React from 'react';
import { isAuthEnabled } from '../api/supabase';
import { useAuthStore } from '../store/authStore';

const LogoutButton: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  if (!isAuthEnabled || !user) return null;

  return (
    <button
      className="icon-btn"
      onClick={() => void signOut()}
      title={`Sair (${user.email})`}
      aria-label="Sair"
    >
      🚪
    </button>
  );
};

export default LogoutButton;
