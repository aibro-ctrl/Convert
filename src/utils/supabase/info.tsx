// Supabase project configuration
// Источник настроек:
// 1) В первую очередь читаем переменные окружения Vite: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// 2) Если их нет, пытаемся прочитать NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (для совместимости)
// 3) В самом конце используем встроенные значения по умолчанию (можно переопределить при необходимости)

const env = import.meta.env as unknown as {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

export const supabaseUrl =
  env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  "http://158.255.0.177:8000";

export const publicAnonKey =
  env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY0NjA4NDAwLCJleHAiOjE5MjIzNzQ4MDB9.2gUFerGIGcIrX5Rcm5s-v2y_I6e_rcfqzoWuVlt7eEM"
