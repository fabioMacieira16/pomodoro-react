import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Com Supabase o token vem da sessão (o SDK renova o access token sozinho);
// no modo local usa o token do login próprio, se houver.
api.interceptors.request.use(async (config) => {
  let token: string | null;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
    // Sem sessão não adianta chamar a API (voltaria 401); quem chamou trata como "offline".
    if (!token) throw new axios.CanceledError('Faça login para usar este recurso.');
  } else {
    token = localStorage.getItem('token');
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
