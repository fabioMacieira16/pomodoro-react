import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { isAuthEnabled, supabase } from '../api/supabase';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  /** true enquanto a sessão salva ainda está sendo lida */
  loading: boolean;
  /** true quando a pessoa chegou pelo link de "esqueci a senha" e precisa definir uma nova */
  recovery: boolean;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<string | null>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const NOT_CONFIGURED = 'Login não configurado.';

function toUser(session: Session | null): AuthUser | null {
  const user = session?.user;
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? '',
    name: meta.full_name ?? meta.name,
    avatarUrl: meta.avatar_url ?? meta.picture,
  };
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (m.includes('password should be')) return 'A senha não atende aos requisitos de segurança.';
  if (m.includes('same password') || m.includes('different from the old')) return 'A nova senha precisa ser diferente da anterior.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Tente novamente.';
  return 'Não foi possível concluir a operação. Tente novamente.';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: isAuthEnabled,
  recovery: false,

  init: () => {
    if (!supabase) {
      set({ loading: false });
      return () => {};
    }
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) set({ user: toUser(data.session), loading: false });
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      set({
        user: toUser(session),
        loading: false,
        recovery: event === 'PASSWORD_RECOVERY' ? true : event === 'SIGNED_OUT' ? false : get().recovery,
      });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  },

  signIn: async (email, password) => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? friendlyError(error.message) : null;
  },

  signUp: async (email, password) => {
    if (!supabase) return { error: NOT_CONFIGURED, needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { error: friendlyError(error.message), needsConfirmation: false };
    // Para e-mails já cadastrados o Supabase responde "sucesso" sem identidades,
    // para não revelar quem tem conta; avisamos a pessoa de forma útil.
    if (data.user && data.user.identities?.length === 0) {
      return { error: 'Este e-mail já tem cadastro. Entre ou use "Esqueci a senha".', needsConfirmation: false };
    }
    return { error: null, needsConfirmation: !data.session };
  },

  signInWithGoogle: async () => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return error ? friendlyError(error.message) : null;
  },

  sendPasswordReset: async (email) => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    return error ? friendlyError(error.message) : null;
  },

  updatePassword: async (password) => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return friendlyError(error.message);
    set({ recovery: false });
    return null;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  },
}));
