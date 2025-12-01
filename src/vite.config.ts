import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  define: {
    // Обеспечиваем доступность переменных окружения
    'import.meta.env.VITE_POCKETBASE_URL': JSON.stringify(
      process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:54739'
    ),
    'import.meta.env.VITE_E2EE_ENABLED': JSON.stringify(
      process.env.VITE_E2EE_ENABLED || 'true'
    ),
    'import.meta.env.VITE_REALTIME_ENABLED': JSON.stringify(
      process.env.VITE_REALTIME_ENABLED || 'true'
    ),
    'import.meta.env.VITE_FILE_UPLOAD_ENABLED': JSON.stringify(
      process.env.VITE_FILE_UPLOAD_ENABLED || 'true'
    ),
    'import.meta.env.VITE_VOICE_VIDEO_ENABLED': JSON.stringify(
      process.env.VITE_VOICE_VIDEO_ENABLED || 'true'
    ),
    'import.meta.env.VITE_GOD_MODE_ENABLED': JSON.stringify(
      process.env.VITE_GOD_MODE_ENABLED || 'true'
    ),
    'import.meta.env.VITE_ACHIEVEMENTS_ENABLED': JSON.stringify(
      process.env.VITE_ACHIEVEMENTS_ENABLED || 'true'
    ),
  },
  server: {
    port: 5173,
    host: true,
  },
});
