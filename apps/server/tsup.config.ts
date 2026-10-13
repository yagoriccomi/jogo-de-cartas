import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // O pacote compartilhado é TypeScript puro: é embutido no bundle em vez de resolvido em runtime.
  noExternal: ['@fodinha/shared'],
});
