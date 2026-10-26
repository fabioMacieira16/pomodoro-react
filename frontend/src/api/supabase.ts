import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Sem as duas variáveis o app roda em modo local, sem tela de login
// (o backend também precisa estar sem SUPABASE_URL).
export const isAuthEnabled = Boolean(url && anonKey);

export const supabase = isAuthEnabled ? createClient(url!, anonKey!) : null;
