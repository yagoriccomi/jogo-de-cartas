import { defineConfig, devices } from '@playwright/test';

/**
 * Portas próprias dos testes de tela: não colidem com o Docker de desenvolvimento (3011/5173),
 * então dá para rodar os testes com o ambiente local no ar.
 */
const PORTA_DO_SERVIDOR = 3101;
const PORTA_DO_WEB = 5199;
const ORIGEM_DO_WEB = `http://localhost:${PORTA_DO_WEB}`;
const ORIGEM_DO_SERVIDOR = `http://localhost:${PORTA_DO_SERVIDOR}`;
/** Bots instantâneos: ninguém está olhando a jogada deles; só a tela final importa. */
const ATRASO_DO_BOT_NOS_TESTES_MS = '120';
const NA_CI = Boolean(process.env.CI);
const RAIZ_DO_REPOSITORIO = '../..';

/**
 * Tamanhos que já quebraram ou que o público usa: celular baixo, iPhone comum, Android grande,
 * notebook e monitor. Cada teste roda em todos.
 */
const TELAS = [
  { name: 'celular-360x640', viewport: { width: 360, height: 640 }, celular: true },
  { name: 'celular-375x812', viewport: { width: 375, height: 812 }, celular: true },
  { name: 'celular-430x932', viewport: { width: 430, height: 932 }, celular: true },
  { name: 'notebook-1366x768', viewport: { width: 1366, height: 768 }, celular: false },
  { name: 'monitor-1920x1080', viewport: { width: 1920, height: 1080 }, celular: false },
] as const;

export default defineConfig({
  testDir: './testes',
  // Cada teste cria a própria sala; em paralelo o servidor de dev aguenta bem.
  fullyParallel: true,
  forbidOnly: NA_CI,
  retries: NA_CI ? 1 : 0,
  workers: NA_CI ? 2 : undefined,
  timeout: 90_000,
  reporter: NA_CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: ORIGEM_DO_WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: TELAS.map(({ name, viewport, celular }) => ({
    name,
    use: {
      ...devices['Desktop Chrome'],
      viewport,
      isMobile: celular,
      hasTouch: celular,
    },
  })),
  webServer: [
    {
      command: 'npm run dev -w @fodinha/server',
      cwd: RAIZ_DO_REPOSITORIO,
      // 127.0.0.1: o servidor escuta só em IPv4 e `localhost` pode resolver para ::1.
      url: `http://127.0.0.1:${PORTA_DO_SERVIDOR}/health`,
      reuseExistingServer: !NA_CI,
      timeout: 60_000,
      env: {
        PORT: String(PORTA_DO_SERVIDOR),
        CORS_ORIGINS: ORIGEM_DO_WEB,
        CENARIOS_DE_TESTE: 'true',
        BOT_DELAY_MS: ATRASO_DO_BOT_NOS_TESTES_MS,
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `npm run dev -w @fodinha/web -- --port ${PORTA_DO_WEB} --strictPort`,
      cwd: RAIZ_DO_REPOSITORIO,
      url: ORIGEM_DO_WEB,
      reuseExistingServer: !NA_CI,
      timeout: 60_000,
      env: { VITE_SERVER_URL: ORIGEM_DO_SERVIDOR },
    },
  ],
});
