/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POCKETBASE_URL: string;
  readonly VITE_REDIS_HOST: string;
  readonly VITE_REDIS_PORT: string;
  readonly VITE_REDIS_DB: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_E2EE_ENABLED: string;
  readonly VITE_REALTIME_ENABLED: string;
  readonly VITE_FILE_UPLOAD_ENABLED: string;
  readonly VITE_VOICE_VIDEO_ENABLED: string;
  readonly VITE_GOD_MODE_ENABLED: string;
  readonly VITE_ACHIEVEMENTS_ENABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
