import { defineConfig } from 'vitest/config';

// Só módulos puros (cálculo de layout, ordem, formatação, roteiro): ambiente node basta.
// Componentes e interação ficam com os testes de tela (apps/e2e).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['test/apoio/armazenamento.ts'],
  },
});
