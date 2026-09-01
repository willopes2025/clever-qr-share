import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  // Os testes são de domínio puro: sem isto o Vite sobe procurando o
  // postcss.config.js do repositório de fora e quebra a execução.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      '@soul/contracts': resolve(__dirname, 'packages/contracts/src'),
      '@soul/money': resolve(__dirname, 'packages/money/src'),
      '@soul/ui': resolve(__dirname, 'packages/ui/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.spec.ts', 'apps/api/src/**/*.spec.ts'],
    reporters: ['default'],
  },
});
