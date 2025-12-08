// Lightweight Supabase client implementation
// This avoids the need for @supabase/supabase-js package
import { supabaseUrl, publicAnonKey } from './info';

interface AuthSession {
  access_token: string;
  user: {
    id: string;
    email: string;
  };
}

interface SupabaseClient {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{ data: { session: AuthSession | null }; error: Error | null }>;
    signOut: () => Promise<{ error: Error | null }>;
    getSession: () => Promise<{ data: { session: AuthSession | null }; error: Error | null }>;
    getUser: (accessToken?: string) => Promise<{ data: { user: any }; error: Error | null }>;
  };
  from: (table: string) => any;
  storage: {
    from: (bucket: string) => any;
  };
}

// Create a minimal Supabase client for browser
export const supabase: SupabaseClient = {
  auth: {
    async signInWithPassword(credentials: { email: string; password: string }) {
      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': publicAnonKey,
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return { data: { session: null }, error: new Error(error.message || 'Authentication failed') };
        }

        const data = await response.json();
        
        // Store session in localStorage
        if (data.access_token) {
          localStorage.setItem('envelope-auth-token', JSON.stringify({
            access_token: data.access_token,
            user: data.user,
          }));
        }

        return {
          data: {
            session: {
              access_token: data.access_token,
              user: data.user,
            },
          },
          error: null,
        };
      } catch (error) {
        return { data: { session: null }, error: error as Error };
      }
    },

    async signOut() {
      try {
        const session = this.getSession();
        if (session) {
          await fetch(`${supabaseUrl}/auth/v1/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': publicAnonKey,
              'Authorization': `Bearer ${(await session).data.session?.access_token}`,
            },
          });
        }
        
        localStorage.removeItem('envelope-auth-token');
        return { error: null };
      } catch (error) {
        return { error: error as Error };
      }
    },

    async getSession() {
      try {
        const stored = localStorage.getItem('envelope-auth-token');
        if (!stored) {
          return { data: { session: null }, error: null };
        }

        const session = JSON.parse(stored) as AuthSession;
        
        // Validate token is still valid
        const userCheck = await this.getUser(session.access_token);
        if (userCheck.error) {
          localStorage.removeItem('envelope-auth-token');
          return { data: { session: null }, error: null };
        }

        return { data: { session }, error: null };
      } catch (error) {
        return { data: { session: null }, error: error as Error };
      }
    },

    async getUser(accessToken?: string) {
      try {
        const token = accessToken || (await this.getSession()).data.session?.access_token;
        if (!token) {
          return { data: { user: null }, error: new Error('No access token') };
        }

        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          return { data: { user: null }, error: new Error('Failed to get user') };
        }

        const user = await response.json();
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error: error as Error };
      }
    },
  },

  from(table: string) {
    // This is a placeholder - actual database queries should go through the backend
    console.warn('Direct database access from client is not implemented. Use API endpoints instead.');
    return {
      select: () => Promise.resolve({ data: null, error: new Error('Use API endpoints') }),
      insert: () => Promise.resolve({ data: null, error: new Error('Use API endpoints') }),
      update: () => Promise.resolve({ data: null, error: new Error('Use API endpoints') }),
      delete: () => Promise.resolve({ data: null, error: new Error('Use API endpoints') }),
    };
  },

  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File) {
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token || publicAnonKey;

          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
            method: 'POST',
            headers: {
              'apikey': publicAnonKey,
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const error = await response.text();
            return { data: null, error: new Error(error) };
          }

          const data = await response.json();
          return { data, error: null };
        },

        async getPublicUrl(path: string) {
          return {
            data: {
              publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
            },
          };
        },
      };
    },
  },
};
