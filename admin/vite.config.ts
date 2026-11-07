import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Проксі на API в режимі розробки.
 *
 * Навіщо: панель і API живуть на різних портах, а JWT їде в httpOnly cookie.
 * Через проксі браузер вважає, що все з одного origin, і cookie працює без
 * CORS-винятків і без SameSite=None.
 *
 * Адреса API береться з VITE_API_URL у корневому .env (там же, де решта
 * налаштувань сервісу).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  const target = env.VITE_API_URL || 'http://localhost:3000';

  return {
    plugins: [react()],
    envDir: '..',
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
  };
});
