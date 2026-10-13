import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// O .env fica na raiz do monorepo; o cwd dos scripts npm é apps/web.
const DIRETORIO_ENV = '../../';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, DIRETORIO_ENV, '');
  // Em Docker o bind-mount do Windows não emite eventos de arquivo, então o polling é opt-in.
  const usarPolling = env.CHOKIDAR_USEPOLLING === 'true';
  const porta = Number(env.WEB_PORT ?? 5173);

  return {
    envDir: DIRETORIO_ENV,
    plugins: [react()],
    server: {
      host: env.WEB_HOST ?? 'localhost',
      port: Number.isFinite(porta) ? porta : 5173,
      watch: usarPolling ? { usePolling: true } : undefined,
    },
  };
});
