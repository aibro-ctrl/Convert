// Lightweight Supabase client implementation
// DEPRECATED: Этот файл НЕ используется в production
// Приложение работает с PocketBase через backend-adapter
// Этот файл оставлен только для совместимости с Figma Make песочницей
import { projectId, publicAnonKey } from './info';

const supabaseUrl = projectId ? `https://${projectId}.supabase.co` : '';

// Заглушка - не используется в production
export const supabase = {
  auth: {
    async signInWithPassword() {
      throw new Error('Supabase не настроен. Используйте PocketBase (см. INSTALL.md)');
    },
    async signOut() {
      throw new Error('Supabase не настроен. Используйте PocketBase (см. INSTALL.md)');
    },
    async getSession() {
      return { data: { session: null }, error: new Error('Supabase не настроен') };
    },
    async getUser() {
      throw new Error('Supabase не настроен. Используйте PocketBase (см. INSTALL.md)');
    },
  },
  from() {
    throw new Error('Supabase не настроен. Используйте PocketBase (см. INSTALL.md)');
  },
  storage: {
    from() {
      throw new Error('Supabase не настроен. Используйте PocketBase (см. INSTALL.md)');
    },
  },
};