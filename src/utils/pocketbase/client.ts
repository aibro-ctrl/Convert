// PocketBase client для работы с API
// Используется как основной клиент для всех запросов

// Получаем URL из переменной окружения
const POCKETBASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_POCKETBASE_URL) 
  || 'http://127.0.0.1:54739';

// Создаем простой клиент для PocketBase API
// Вместо использования npm пакета, работаем напрямую с REST API
class PocketBaseClient {
  baseUrl: string;
  token: string | null = null;
  model: any = null;

  constructor(url: string) {
    this.baseUrl = url;
    this.loadAuth();
  }

  // Загрузка сохраненной авторизации
  loadAuth() {
    const token = localStorage.getItem('pb_token');
    const model = localStorage.getItem('pb_model');
    
    if (token && model) {
      this.token = token;
      try {
        this.model = JSON.parse(model);
      } catch (e) {
        console.error('Failed to parse saved model:', e);
      }
    }
  }

  // Сохранение авторизации
  saveAuth(token: string | null, model: any) {
    this.token = token;
    this.model = model;
    
    if (token && model) {
      localStorage.setItem('pb_token', token);
      localStorage.setItem('pb_model', JSON.stringify(model));
      
      // Для совместимости с остальным кодом
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('pb_token');
      localStorage.removeItem('pb_model');
      localStorage.removeItem('access_token');
    }
  }

  // Очистка авторизации
  clearAuth() {
    this.saveAuth(null, null);
  }

  // Проверка валидности токена
  get isValid(): boolean {
    if (!this.token || !this.model) return false;
    
    // Простая проверка формата JWT токена
    try {
      const parts = this.token.split('.');
      if (parts.length !== 3) return false;
      
      const payload = JSON.parse(atob(parts[1]));
      
      // Проверяем expiry
      if (payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        return payload.exp > now;
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }

  // Базовый метод для запросов
  async request(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };
    
    if (this.token) {
      headers['Authorization'] = this.token;
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  }

  // Collection wrapper
  collection(name: string) {
    return {
      // Auth with password
      authWithPassword: async (emailOrUsername: string, password: string) => {
        const data = await this.request(`/collections/${name}/auth-with-password`, {
          method: 'POST',
          body: JSON.stringify({
            identity: emailOrUsername,
            password
          })
        });
        
        this.saveAuth(data.token, data.record);
        
        return {
          token: data.token,
          record: data.record
        };
      },
      
      // Create record
      create: async (body: any) => {
        return this.request(`/collections/${name}/records`, {
          method: 'POST',
          body: JSON.stringify(body)
        });
      },
      
      // Get one record
      getOne: async (id: string) => {
        return this.request(`/collections/${name}/records/${id}`);
      },
      
      // Get list
      getList: async (page = 1, perPage = 50, options: any = {}) => {
        const params = new URLSearchParams({
          page: page.toString(),
          perPage: perPage.toString()
        });
        
        if (options.filter) params.append('filter', options.filter);
        if (options.sort) params.append('sort', options.sort);
        if (options.expand) params.append('expand', options.expand);
        
        return this.request(`/collections/${name}/records?${params}`);
      },
      
      // Get full list
      getFullList: async (options: any = {}) => {
        const params = new URLSearchParams({
          perPage: '500'
        });
        
        if (options.filter) params.append('filter', options.filter);
        if (options.sort) params.append('sort', options.sort);
        if (options.expand) params.append('expand', options.expand);
        
        const data = await this.request(`/collections/${name}/records?${params}`);
        return data.items || [];
      },
      
      // Update record
      update: async (id: string, body: any) => {
        return this.request(`/collections/${name}/records/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(body)
        });
      },
      
      // Delete record
      delete: async (id: string) => {
        return this.request(`/collections/${name}/records/${id}`, {
          method: 'DELETE'
        });
      },
      
      // Subscribe (basic implementation)
      subscribe: (recordIdOrFilter: string, callback: (data: any) => void) => {
        console.log('Real-time subscriptions not implemented in basic client');
        // TODO: Implement WebSocket subscriptions if needed
      },
      
      // Unsubscribe
      unsubscribe: () => {
        console.log('Unsubscribe called');
      }
    };
  }

  // Auth store getter
  get authStore() {
    return {
      isValid: this.isValid,
      model: this.model,
      token: this.token,
      save: (token: string | null, model: any) => this.saveAuth(token, model),
      clear: () => this.clearAuth(),
      onChange: (callback: (token: string | null, model: any) => void) => {
        // Basic implementation - just call once
        callback(this.token, this.model);
      },
      loadFromCookie: (cookie: string) => {
        // Not implemented
      }
    };
  }

  // Files helper
  get files() {
    return {
      getUrl: (record: any, filename: string, options: any = {}) => {
        if (!record || !filename) return '';
        
        const collection = record.collectionId || record.collectionName;
        let url = `${this.baseUrl}/api/files/${collection}/${record.id}/${filename}`;
        
        if (options.thumb) {
          url += `?thumb=${options.thumb}`;
        }
        
        return url;
      }
    };
  }
}

// Создаем singleton instance
export const pb = new PocketBaseClient(POCKETBASE_URL);

// Экспортируем URL для использования в других частях приложения
export const POCKETBASE_API_URL = POCKETBASE_URL;

export default pb;