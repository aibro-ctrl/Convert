/**
 * Backend Configuration
 * Централизованная конфигурация для переключения между бэкендами
 */

import { BackendConfig } from './interface';

export const BACKEND_TYPE = (import.meta.env?.VITE_BACKEND_TYPE || 'pocketbase') as 'supabase' | 'pocketbase' | 'firebase' | 'custom';

export const configs: Record<string, BackendConfig> = {
  supabase: {
    type: 'supabase',
    url: import.meta.env?.VITE_SUPABASE_URL || '',
    apiKey: import.meta.env?.VITE_SUPABASE_ANON_KEY || '',
    features: {
      realtime: true,
      fileUpload: true,
      voiceVideo: true,
      e2ee: true,
    },
  },

  pocketbase: {
    type: 'pocketbase',
    url: import.meta.env?.VITE_POCKETBASE_URL || 'http://localhost:8090',
    features: {
      realtime: true,
      fileUpload: true,
      voiceVideo: true,
      e2ee: true,
    },
  },

  firebase: {
    type: 'firebase',
    url: '',
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || '',
    features: {
      realtime: true,
      fileUpload: true,
      voiceVideo: true,
      e2ee: true,
    },
  },

  custom: {
    type: 'custom',
    url: import.meta.env?.VITE_API_URL || 'http://localhost:3000',
    apiKey: import.meta.env?.VITE_API_KEY || '',
    features: {
      realtime: true,
      fileUpload: true,
      voiceVideo: true,
      e2ee: true,
    },
  },
};

export function getBackendConfig(): BackendConfig {
  const config = configs[BACKEND_TYPE];
  
  if (!config) {
    console.warn(`Backend type "${BACKEND_TYPE}" not found, falling back to supabase`);
    return configs.supabase;
  }

  return config;
}

export function getCurrentBackendType(): string {
  return BACKEND_TYPE;
}

// Feature flags
export const FEATURES = {
  E2EE_ENABLED: import.meta.env?.VITE_E2EE_ENABLED !== 'false',
  REALTIME_ENABLED: import.meta.env?.VITE_REALTIME_ENABLED !== 'false',
  FILE_UPLOAD_ENABLED: import.meta.env?.VITE_FILE_UPLOAD_ENABLED !== 'false',
  VOICE_VIDEO_ENABLED: import.meta.env?.VITE_VOICE_VIDEO_ENABLED !== 'false',
  GOD_MODE_ENABLED: import.meta.env?.VITE_GOD_MODE_ENABLED !== 'false',
  ACHIEVEMENTS_ENABLED: import.meta.env?.VITE_ACHIEVEMENTS_ENABLED !== 'false',
};

// Redis configuration (for caching and real-time)
export const REDIS_CONFIG = {
  host: import.meta.env?.VITE_REDIS_HOST || 'localhost',
  port: parseInt(import.meta.env?.VITE_REDIS_PORT || '6379'),
  password: import.meta.env?.VITE_REDIS_PASSWORD || '',
  db: parseInt(import.meta.env?.VITE_REDIS_DB || '0'),
};

export default {
  BACKEND_TYPE,
  configs,
  getBackendConfig,
  getCurrentBackendType,
  FEATURES,
  REDIS_CONFIG,
};